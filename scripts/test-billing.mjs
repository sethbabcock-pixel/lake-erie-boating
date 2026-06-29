// End-to-end tests for the Stripe ad-free flow in functions/auth.js.
//
// Runs fully offline: an in-memory KV stands in for the USERS namespace and a
// fetch() stub intercepts api.stripe.com, so no network and no real charges.
// The webhook test signs payloads with a real HMAC-SHA256 so stripeVerify()'s
// signature check is genuinely exercised, not bypassed.
//
//   node scripts/test-billing.mjs
//
import { createHmac } from "node:crypto";
import { handleAuth } from "../functions/auth.js";

// ── tiny test harness ────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];
function check(name, cond, detail = "") {
  if (cond) { passed++; results.push(`  ✓ ${name}`); }
  else { failed++; results.push(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
const eq = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ── in-memory KV (subset of the Cloudflare KV API used by auth.js) ────────────
function makeKV(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    async get(k, type) {
      const v = m.get(k);
      if (v === undefined) return null;
      if (type === "json") return JSON.parse(v);
      if (type === "arrayBuffer") return v instanceof ArrayBuffer ? v : (ArrayBuffer.isView(v) ? v.buffer : v);
      return v;
    },
    async put(k, v) { m.set(k, v); }, // store as-is (strings stay strings; ArrayBuffers stay binary)
    async delete(k) { m.delete(k); },
    _map: m,
  };
}

// ── Stripe fetch stub — records calls, returns canned responses ───────────────
let stripeCalls = [];
let priceResolves = true;
let subGetCancelState = false; // what a GET subscription retrieve reports
const makeSub = (cancelAtPeriodEnd) => ({
  id: "sub_123", status: "active", cancel_at_period_end: cancelAtPeriodEnd,
  current_period_end: 1790000000, cancel_at: cancelAtPeriodEnd ? 1790000000 : null,
  items: { data: [{ price: { unit_amount: 299, currency: "usd", recurring: { interval: "month" } } }] },
});
function installFetchStub() {
  globalThis.fetch = async (urlStr, opts = {}) => {
    const u = String(urlStr);
    const body = opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : null;
    stripeCalls.push({ url: u, method: opts.method || "GET", body });
    if (u.includes("/v1/checkout/sessions"))
      return jsonResp({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" });
    if (u.includes("/v1/billing_portal/sessions"))
      return jsonResp({ id: "bps_123", url: "https://billing.stripe.com/p/session/bps_123" });
    if (u.includes("/v1/subscriptions/")) {
      // POST = update (cancel/resume) → mirror the request; GET = retrieve.
      if ((opts.method || "GET") === "POST") return jsonResp(makeSub(body?.cancel_at_period_end === "true"));
      return jsonResp(makeSub(subGetCancelState));
    }
    if (u.includes("/v1/prices/"))
      return priceResolves
        ? jsonResp({ id: "price_x", active: true, unit_amount: 299, currency: "usd", recurring: { interval: "month" }, livemode: false })
        : jsonResp({ error: { message: "No such price" } });
    return jsonResp({ error: { message: `unexpected stripe call: ${u}` } }, 400);
  };
}
const jsonResp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

// ── helpers to drive handleAuth ───────────────────────────────────────────────
const ORIGIN = "https://shouldiboat.com";
function req(method, path, { cookie, body } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const request = new Request(ORIGIN + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { request, url: new URL(ORIGIN + path) };
}
const call = ({ request, url }, env) => handleAuth(request, env, url);

// Seed a signed-in user directly into KV (mirrors what register/login produce).
async function seedUser(env, email, extra = {}) {
  const user = { id: "u1", email, created: "2026-01-01T00:00:00Z", prefs: {}, favorites: [], adFree: false, via: "google", ...extra };
  await env.USERS.put(`user:${email}`, JSON.stringify(user));
  const token = "tok_" + email.replace(/\W/g, "");
  await env.USERS.put(`sess:${token}`, email);
  return `sib_session=${token}`;
}

function stripeWebhookReq(eventObj, secret, { skewSeconds = 0 } = {}) {
  const payload = JSON.stringify(eventObj);
  const t = Math.floor(Date.now() / 1000) + skewSeconds;
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const request = new Request(ORIGIN + "/stripe/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": `t=${t},v1=${sig}`, "Content-Type": "application/json" },
    body: payload,
  });
  return { request, url: new URL(ORIGIN + "/stripe/webhook") };
}

// ── tests ─────────────────────────────────────────────────────────────────────
async function run() {
  installFetchStub();

  // 1. Checkout with no Stripe key configured → 503
  {
    const env = { USERS: makeKV() };
    const r = await call(req("POST", "/api/checkout"), env);
    eq("checkout: no STRIPE_SECRET_KEY → 503", r.status, 503);
  }

  // 2. Checkout while signed out → 401
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const r = await call(req("POST", "/api/checkout"), env);
    eq("checkout: signed out → 401", r.status, 401);
  }

  // 3. Checkout happy path → 200 + Stripe session url, correct params sent
  {
    stripeCalls = [];
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID: "price_test_abc" };
    const cookie = await seedUser(env, "buyer@example.com");
    const r = await call(req("POST", "/api/checkout", { cookie }), env);
    eq("checkout: happy path → 200", r.status, 200);
    const data = await r.json();
    check("checkout: returns Stripe url", typeof data.url === "string" && data.url.includes("checkout.stripe.com"), data.url);
    const sent = stripeCalls.find((c) => c.url.includes("checkout/sessions"));
    eq("checkout: mode=subscription", sent?.body?.mode, "subscription");
    eq("checkout: uses STRIPE_PRICE_ID override", sent?.body?.["line_items[0][price]"], "price_test_abc");
    eq("checkout: client_reference_id = email", sent?.body?.client_reference_id, "buyer@example.com");
    eq("checkout: passes customer_email for new buyer", sent?.body?.customer_email, "buyer@example.com");
  }

  // 4. Already ad-free → 400 (no duplicate subscription)
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "vip@example.com", { adFree: true });
    const r = await call(req("POST", "/api/checkout", { cookie }), env);
    eq("checkout: already ad-free → 400", r.status, 400);
  }

  // 5. Webhook with a bad signature → 400 (the security gate)
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "buyer@example.com");
    const bad = stripeWebhookReq({ type: "checkout.session.completed", data: { object: {} } }, "whsec_WRONG");
    const r = await call(bad, env);
    eq("webhook: bad signature → 400", r.status, 400);
    const u = await env.USERS.get("user:buyer@example.com", "json");
    eq("webhook: bad signature does NOT grant ad-free", u.adFree, false);
  }

  // 6. Webhook checkout.session.completed → flips user to ad-free + indexes customer
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "buyer@example.com");
    const evt = {
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "buyer@example.com", customer: "cus_123", subscription: "sub_123" } },
    };
    const r = await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: completed → 200", r.status, 200);
    const u = await env.USERS.get("user:buyer@example.com", "json");
    eq("webhook: completed grants ad-free", u.adFree, true);
    eq("webhook: stores stripeCustomerId", u.stripeCustomerId, "cus_123");
    eq("webhook: stores stripeSubId", u.stripeSubId, "sub_123");
    eq("webhook: writes reverse index", await env.USERS.get("stripecust:cus_123"), "buyer@example.com");
  }

  // 7. subscription.deleted → revokes ad-free (via reverse index)
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "buyer@example.com", { adFree: true, stripeCustomerId: "cus_123" });
    await env.USERS.put("stripecust:cus_123", "buyer@example.com");
    const evt = { type: "customer.subscription.deleted", data: { object: { customer: "cus_123", status: "canceled" } } };
    const r = await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: deleted → 200", r.status, 200);
    const u = await env.USERS.get("user:buyer@example.com", "json");
    eq("webhook: deleted revokes ad-free", u.adFree, false);
  }

  // 8. subscription.updated (active) → keeps ad-free on
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "buyer@example.com", { adFree: false, stripeCustomerId: "cus_123" });
    await env.USERS.put("stripecust:cus_123", "buyer@example.com");
    const evt = { type: "customer.subscription.updated", data: { object: { customer: "cus_123", status: "active" } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    const u = await env.USERS.get("user:buyer@example.com", "json");
    eq("webhook: updated(active) grants ad-free", u.adFree, true);
  }

  // 9. Webhook replay window: a stale timestamp (>5 min) is rejected
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "buyer@example.com");
    const evt = { type: "checkout.session.completed", data: { object: { client_reference_id: "buyer@example.com" } } };
    const r = await call(stripeWebhookReq(evt, "whsec_right", { skewSeconds: -600 }), env);
    eq("webhook: stale timestamp → 400", r.status, 400);
  }

  // 10. billing-status: gating + report shape
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_abc", STRIPE_WEBHOOK_SECRET: "whsec_right", ADMIN_EMAIL: "admin@example.com" };
    // signed out
    eq("billing-status: signed out → 401", (await call(req("GET", "/api/billing-status"), env)).status, 401);
    // non-admin
    const nonAdmin = await seedUser(env, "rando@example.com");
    eq("billing-status: non-admin → 403", (await call(req("GET", "/api/billing-status", { cookie: nonAdmin }), env)).status, 403);
    // admin
    const admin = await seedUser(env, "admin@example.com");
    const r = await call(req("GET", "/api/billing-status", { cookie: admin }), env);
    eq("billing-status: admin → 200", r.status, 200);
    const s = await r.json();
    eq("billing-status: detects test mode", s.secretKey.mode, "test");
    eq("billing-status: webhook secret present", s.webhookSecret.present, true);
    eq("billing-status: price resolves", s.price.resolved, true);
    eq("billing-status: ready=true when all set", s.ready, true);
  }

  // 11. billing-status: never leaks secret values
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_SUPERSECRET", STRIPE_WEBHOOK_SECRET: "whsec_SUPERSECRET" };
    const admin = await seedUser(env, "anyone@example.com");
    const r = await call(req("GET", "/api/billing-status", { cookie: admin }), env);
    const txt = JSON.stringify(await r.json());
    check("billing-status: secret values not exposed", !txt.includes("SUPERSECRET"), txt);
  }

  // 12. GET /api/subscription gating
  {
    const env = { USERS: makeKV() };
    eq("subscription GET: no key → 503", (await call(req("GET", "/api/subscription"), env)).status, 503);
    const env2 = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    eq("subscription GET: signed out → 401", (await call(req("GET", "/api/subscription"), env2)).status, 401);
  }

  // 13. GET /api/subscription with no sub on file → { subscription: null }
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "free@example.com");
    const r = await call(req("GET", "/api/subscription", { cookie }), env);
    eq("subscription GET: no sub → 200", r.status, 200);
    eq("subscription GET: null when no subId", (await r.json()).subscription, null);
  }

  // 14. GET /api/subscription returns the live summary
  {
    subGetCancelState = false;
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "vip@example.com", { adFree: true, stripeSubId: "sub_123" });
    const r = await call(req("GET", "/api/subscription", { cookie }), env);
    const { subscription } = await r.json();
    eq("subscription GET: status active", subscription.status, "active");
    eq("subscription GET: amount", subscription.amount, 299);
    eq("subscription GET: interval", subscription.interval, "month");
    eq("subscription GET: not cancelling", subscription.cancelAtPeriodEnd, false);
    check("subscription GET: has period end", subscription.currentPeriodEnd === 1790000000);
  }

  // 15. POST cancel → cancel_at_period_end=true sent + reflected
  {
    stripeCalls = [];
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "vip@example.com", { adFree: true, stripeSubId: "sub_123" });
    const r = await call(req("POST", "/api/subscription", { cookie, body: { action: "cancel" } }), env);
    eq("subscription cancel: → 200", r.status, 200);
    eq("subscription cancel: now cancelling", (await r.json()).subscription.cancelAtPeriodEnd, true);
    const sent = stripeCalls.find((c) => c.url.includes("/subscriptions/") && c.method === "POST");
    eq("subscription cancel: sent cancel_at_period_end=true", sent?.body?.cancel_at_period_end, "true");
  }

  // 16. POST resume → cancel_at_period_end=false
  {
    stripeCalls = [];
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "vip@example.com", { adFree: true, stripeSubId: "sub_123" });
    const r = await call(req("POST", "/api/subscription", { cookie, body: { action: "resume" } }), env);
    eq("subscription resume: not cancelling", (await r.json()).subscription.cancelAtPeriodEnd, false);
    const sent = stripeCalls.find((c) => c.url.includes("/subscriptions/") && c.method === "POST");
    eq("subscription resume: sent cancel_at_period_end=false", sent?.body?.cancel_at_period_end, "false");
  }

  // 17. POST guards: no subscription, bad action
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const noSub = await seedUser(env, "nosub@example.com", { adFree: true });
    eq("subscription POST: no subId → 400", (await call(req("POST", "/api/subscription", { cookie: noSub, body: { action: "cancel" } }), env)).status, 400);
    const withSub = await seedUser(env, "vip2@example.com", { adFree: true, stripeSubId: "sub_123" });
    eq("subscription POST: bad action → 400", (await call(req("POST", "/api/subscription", { cookie: withSub, body: { action: "frobnicate" } }), env)).status, 400);
  }

  // 18. publicUser exposes created + hasSubscription (account page needs these)
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "meta@example.com", { stripeSubId: "sub_123", created: "2026-02-02T00:00:00Z" });
    const me = await (await call(req("GET", "/auth/me", { cookie }), env)).json();
    eq("auth/me: exposes created", me.user.created, "2026-02-02T00:00:00Z");
    eq("auth/me: exposes hasSubscription", me.user.hasSubscription, true);
  }

  // 19. site-config: public, returns hero defaults + resolves today's takeover
  {
    const env = { USERS: makeKV() };
    const r = await call(req("GET", "/api/site-config"), env);
    eq("site-config: public 200", r.status, 200);
    const d = await r.json();
    eq("site-config: default hero image", d.hero.image, "/hero-sunset.svg");
    eq("site-config: no takeover by default", d.takeover, null);
  }

  // 20. site-config: resolves a campaign whose window includes today
  {
    const today = new Date().toISOString().slice(0, 10);
    const env = { USERS: makeKV({ "site:config": JSON.stringify({
      takeovers: [{ id: "x", sponsor: "Acme", headline: "Hi", start: "2000-01-01", end: "2999-01-01" }],
    }) }) };
    const d = await (await call(req("GET", "/api/site-config"), env)).json();
    check("site-config: active takeover resolved", d.takeover && d.takeover.sponsor === "Acme", JSON.stringify(d.takeover));
    // a past-only campaign should NOT resolve
    const env2 = { USERS: makeKV({ "site:config": JSON.stringify({ takeovers: [{ sponsor: "Old", headline: "h", start: "2000-01-01", end: "2000-01-02" }] }) }) };
    eq("site-config: past campaign not active", (await (await call(req("GET", "/api/site-config"), env2)).json()).takeover, null);
    void today;
  }

  // 21. admin/config: gating (signed out, no ADMIN_EMAIL, wrong user, admin)
  {
    const base = { USERS: makeKV() };
    eq("admin/config: signed out → 401", (await call(req("GET", "/api/admin/config"), base)).status, 401);
    const noAdminEnv = { USERS: makeKV() };
    const c1 = await seedUser(noAdminEnv, "someone@example.com");
    eq("admin/config: no ADMIN_EMAIL → 403", (await call(req("GET", "/api/admin/config", { cookie: c1 }), noAdminEnv)).status, 403);
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const nonAdmin = await seedUser(env, "rando@example.com");
    eq("admin/config: wrong user → 403", (await call(req("GET", "/api/admin/config", { cookie: nonAdmin }), env)).status, 403);
    const admin = await seedUser(env, "admin@example.com");
    const r = await call(req("GET", "/api/admin/config", { cookie: admin }), env);
    eq("admin/config: admin → 200", r.status, 200);
    eq("admin/config: returns default hero", (await r.json()).config.hero.image, "/hero-sunset.svg");
  }

  // 22. admin/config: PUT saves, sanitizes, and feeds site-config
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com");
    const config = {
      hero: { image: "/x.jpg", headline: "Boat?", sub: "s", showVerdict: false },
      takeovers: [{ sponsor: "Acme", headline: "Buy", start: "2000-01-01", end: "2999-01-01", href: "https://acme.test" }],
      gam: { networkCode: "12345678" },
      bogusField: "should be dropped",
    };
    const r = await call(req("PUT", "/api/admin/config", { cookie: admin, body: { config } }), env);
    eq("admin/config PUT: → 200", r.status, 200);
    const saved = (await r.json()).config;
    eq("admin/config PUT: hero saved", saved.hero.image, "/x.jpg");
    check("admin/config PUT: strips unknown fields", !("bogusField" in saved), JSON.stringify(saved));
    check("admin/config PUT: assigns campaign id", !!saved.takeovers[0].id, JSON.stringify(saved.takeovers[0]));
    // public site-config now reflects it
    const pub = await (await call(req("GET", "/api/site-config"), env)).json();
    eq("admin/config PUT: feeds site-config", pub.takeover.sponsor, "Acme");
    eq("admin/config PUT: gam networkCode public", pub.gam.networkCode, "12345678");
  }

  // 23. admin/config: non-admin cannot write
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const rando = await seedUser(env, "rando@example.com");
    eq("admin/config PUT: non-admin → 403", (await call(req("PUT", "/api/admin/config", { cookie: rando, body: { config: {} } }), env)).status, 403);
  }

  // 24. admin upload: gating + round-trip + serve
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    // signed out
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const upReq = (cookie, ct = "image/png", body = pngBytes) => {
      const request = new Request(ORIGIN + "/api/admin/upload", { method: "POST", headers: { ...(cookie ? { Cookie: cookie } : {}), "Content-Type": ct }, body });
      return { request, url: new URL(ORIGIN + "/api/admin/upload") };
    };
    eq("upload: signed out → 401", (await call(upReq(null), env)).status, 401);
    const rando = await seedUser(env, "rando@example.com");
    eq("upload: non-admin → 403", (await call(upReq(rando), env)).status, 403);
    const admin = await seedUser(env, "admin@example.com");
    eq("upload: non-image → 400", (await call(upReq(admin, "text/plain", new TextEncoder().encode("hi")), env)).status, 400);
    const r = await call(upReq(admin), env);
    eq("upload: admin image → 200", r.status, 200);
    const { url } = await r.json();
    check("upload: returns /api/asset/ url", /^\/api\/asset\/[a-f0-9]+$/.test(url), url);
    // serve it back (public)
    const got = await call(req("GET", url), env);
    eq("asset: served 200", got.status, 200);
    eq("asset: correct content-type", got.headers.get("Content-Type"), "image/png");
    const back = new Uint8Array(await got.arrayBuffer());
    check("asset: bytes round-trip", back.length === pngBytes.length && back[0] === 0x89, `len ${back.length}`);
    // missing asset → 404
    eq("asset: missing → 404", (await call(req("GET", "/api/asset/deadbeef"), env)).status, 404);
  }

  // 25. owner default admin: /admin works with no ADMIN_EMAIL set
  {
    const env = { USERS: makeKV() }; // no ADMIN_EMAIL
    const owner = await seedUser(env, "seth.babcock@gmail.com");
    eq("admin: owner is admin by default", (await call(req("GET", "/api/admin/config", { cookie: owner }), env)).status, 200);
    const other = await seedUser(env, "notowner@example.com");
    eq("admin: non-owner still blocked by default", (await call(req("GET", "/api/admin/config", { cookie: other }), env)).status, 403);
    // ADMIN_EMAIL override wins over the default owner
    const env2 = { USERS: makeKV(), ADMIN_EMAIL: "ops@example.com" };
    const ops = await seedUser(env2, "ops@example.com");
    eq("admin: ADMIN_EMAIL override grants access", (await call(req("GET", "/api/admin/config", { cookie: ops }), env2)).status, 200);
    const sethBlocked = await seedUser(env2, "seth.babcock@gmail.com");
    eq("admin: default owner not admin when ADMIN_EMAIL set elsewhere", (await call(req("GET", "/api/admin/config", { cookie: sethBlocked }), env2)).status, 403);
  }

  // 26. video upload: accepted under cap, rejected over cap; hero.video round-trips
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com");
    const upReq = (ct, body) => ({ request: new Request(ORIGIN + "/api/admin/upload", { method: "POST", headers: { Cookie: admin, "Content-Type": ct }, body }), url: new URL(ORIGIN + "/api/admin/upload") });
    const small = new Uint8Array(1024);
    const r = await call(upReq("video/mp4", small), env);
    eq("upload: small video → 200", r.status, 200);
    check("upload: video served from /api/asset/", /^\/api\/asset\//.test((await r.json()).url));
    const big = new Uint8Array(12 * 1024 * 1024 + 1);
    eq("upload: oversized video → 413", (await call(upReq("video/mp4", big), env)).status, 413);
    // hero.video persists through admin config + surfaces in public site-config
    const cfg = { hero: { image: "/p.jpg", video: "/api/asset/vid1", headline: "x", sub: "", showVerdict: true }, takeovers: [], gam: { networkCode: "" } };
    await call(req("PUT", "/api/admin/config", { cookie: admin, body: { config: cfg } }), env);
    const pub = await (await call(req("GET", "/api/site-config"), env)).json();
    eq("site-config: hero.video round-trips", pub.hero.video, "/api/asset/vid1");
  }

  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
