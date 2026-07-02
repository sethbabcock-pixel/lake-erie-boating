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
import { runScheduled } from "../functions/digest.js";

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
    async list({ prefix = "", limit = 1000 } = {}) {
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name }));
      return { keys, list_complete: true, cursor: "" };
    },
    _map: m,
  };
}

// ── Stripe fetch stub — records calls, returns canned responses ───────────────
let stripeCalls = [];
let emailCalls = [];
let priceResolves = true;
let stormMode = false; // Open-Meteo stub: every spot NO-GO (true) vs calm GO (false)
let subGetCancelState = false; // what a GET subscription retrieve reports
const makeSub = (cancelAtPeriodEnd) => ({
  id: "sub_123", status: "active", cancel_at_period_end: cancelAtPeriodEnd,
  current_period_end: 1790000000, cancel_at: cancelAtPeriodEnd ? 1790000000 : null,
  items: { data: [{ price: { unit_amount: 299, currency: "usd", recurring: { interval: "month" } } }] },
});
function installFetchStub() {
  globalThis.fetch = async (urlStr, opts = {}) => {
    const u = String(urlStr);
    if (u.includes("api.brevo.com")) {
      emailCalls.push(JSON.parse(opts.body || "{}"));
      return jsonResp({ messageId: "<msg@brevo>" }, 201);
    }
    // Open-Meteo batched summary + today-hourly (used by the email digest engine).
    const omTimes = Array.from({ length: 24 }, (_, h) => `2026-07-02T${String(h).padStart(2, "0")}:00`);
    if (u.includes("api.open-meteo.com/v1/forecast")) {
      const n = (u.match(/latitude=([^&]*)/)?.[1] || "").split(",").length;
      return jsonResp(Array.from({ length: n }, () => ({
        current: { wind_speed_10m: stormMode ? 28 : 8, wind_gusts_10m: stormMode ? 35 : 12, wind_direction_10m: 220 },
        hourly: { time: omTimes, wind_speed_10m: omTimes.map(() => (stormMode ? 28 : 8)) },
      })));
    }
    if (u.includes("marine-api.open-meteo.com")) {
      const n = (u.match(/latitude=([^&]*)/)?.[1] || "").split(",").length;
      return jsonResp(Array.from({ length: n }, () => ({
        current: { wave_height: stormMode ? 1.8 : 0.2 },
        hourly: { time: omTimes, wave_height: omTimes.map(() => (stormMode ? 1.8 : 0.2)) },
      })));
    }
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

// Compute a PBKDF2-SHA256 hash the same way auth.js does — used to seed a
// "legacy" (100k-iteration) password account and prove the login-time upgrade.
async function pbkdf2Hex(password, saltHex, iterations) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

  // 27. admin user management: search, view, toggle ad-free; gating
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com");
    await seedUser(env, "alice@example.com", { created: "2026-03-01T00:00:00Z", via: "google", prefs: { boatType: "pontoon", maxWaveFt: 2 }, favorites: ["sandusky"] });
    await seedUser(env, "bob@example.com", { adFree: true, stripeSubId: "sub_1", stripeCustomerId: "cus_1" });

    // gating
    eq("admin users: signed out → 401", (await call(req("GET", "/api/admin/users"), { USERS: env.USERS })).status, 401);
    const rando = await seedUser(env, "rando@example.com");
    eq("admin users: non-admin → 403", (await call(req("GET", "/api/admin/users", { cookie: rando }), env)).status, 403);

    // search by email substring (key-based filter, no full scan)
    const sr = await call(req("GET", "/api/admin/users?q=alice", { cookie: admin }), env);
    const found = (await sr.json()).users;
    check("admin users: search finds match", found.length === 1 && found[0].email === "alice@example.com", JSON.stringify(found));
    eq("admin users: summary has boatType", found[0].boatType, "pontoon");

    // detail view never leaks secrets
    const dv = await (await call(req("GET", "/api/admin/user?email=bob@example.com", { cookie: admin }), env)).json();
    eq("admin user: detail plan", dv.user.adFree, true);
    eq("admin user: detail hasSubscription", dv.user.hasSubscription, true);
    const dvStr = JSON.stringify(dv);
    check("admin user: no password hash leaked", !/\"pass\"|\"salt\"/.test(dvStr), dvStr.slice(0, 80));

    // toggle ad-free off, then on; persists to the real record
    const off = await (await call(req("POST", "/api/admin/user", { cookie: admin, body: { email: "bob@example.com", adFree: false } }), env)).json();
    eq("admin user: toggle ad-free off", off.user.adFree, false);
    const stored = await env.USERS.get("user:bob@example.com", "json");
    eq("admin user: toggle persists to KV", stored.adFree, false);
    const on = await (await call(req("POST", "/api/admin/user", { cookie: admin, body: { email: "alice@example.com", adFree: true } }), env)).json();
    eq("admin user: grant ad-free to free user", on.user.adFree, true);

    // missing user → 404
    eq("admin user: missing → 404", (await call(req("GET", "/api/admin/user?email=nobody@example.com", { cookie: admin }), env)).status, 404);
  }

  // 28. /auth/me exposes the admin flag (so the account page can link to /admin)
  {
    const env = { USERS: makeKV() }; // no ADMIN_EMAIL → owner default applies
    const owner = await seedUser(env, "seth.babcock@gmail.com");
    eq("auth/me: owner admin=true", (await (await call(req("GET", "/auth/me", { cookie: owner }), env)).json()).user.admin, true);
    const other = await seedUser(env, "guest@example.com");
    eq("auth/me: non-admin admin=false", (await (await call(req("GET", "/auth/me", { cookie: other }), env)).json()).user.admin, false);
  }

  // 29. admin stats: gating + computed totals/sessions/signupsByDay
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com", { created: "2026-01-01T00:00:00Z" });
    const today = new Date().toISOString();
    await seedUser(env, "g1@example.com", { created: today, via: "google", adFree: true, prefs: { boatType: "pontoon" } });
    await seedUser(env, "p1@example.com", { created: today, via: "password" });
    eq("admin stats: signed out → 401", (await call(req("GET", "/api/admin/stats"), { USERS: env.USERS })).status, 401);
    const rando = await seedUser(env, "rando@example.com");
    eq("admin stats: non-admin → 403", (await call(req("GET", "/api/admin/stats", { cookie: rando }), env)).status, 403);
    const st = (await (await call(req("GET", "/api/admin/stats?fresh=1", { cookie: admin }), env)).json()).stats;
    eq("admin stats: counts all users", st.totalUsers, 4);
    eq("admin stats: ad-free count", st.adFree, 1);
    eq("admin stats: via breakdown google", st.via.google, 3); // admin + g1 + rando default to google
    eq("admin stats: withBoat", st.withBoat, 1);
    eq("admin stats: active sessions = seeded sessions", st.activeSessions, 4);
    eq("admin stats: 30-day series", st.signupsByDay.length, 30);
    eq("admin stats: new today counts today's signups", st.newToday, 2);
  }

  // 30. hit beacon increments visits/visitors; stats reflects them + conversion
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com");
    await seedUser(env, "paid@example.com", { adFree: true });
    // 3 visits, 1 a new daily visitor
    eq("hit: → 204", (await call(req("POST", "/api/hit?v=1"), env)).status, 204);
    await call(req("POST", "/api/hit"), env);
    await call(req("POST", "/api/hit"), env);
    const st = (await (await call(req("GET", "/api/admin/stats?fresh=1", { cookie: admin }), env)).json()).stats;
    eq("stats: visits counted today", st.visitsByDay[st.visitsByDay.length - 1].count, 3);
    eq("stats: visitors counted today", st.visitorsToday, 1);
    eq("stats: visits30 total", st.visits30, 3);
    eq("stats: conversion pct (1 of 2 ad-free)", st.conversionPct, 50);
  }

  // 31. password reset: forgot creates a token (only for real password users); reset consumes it
  {
    const env = { USERS: makeKV() };
    await seedUser(env, "reset.me@example.com", { via: "password", pass: "oldhash", salt: "abcd" });
    const resetKeys = () => [...env.USERS._map.keys()].filter((k) => k.startsWith("reset:"));
    eq("forgot: unknown email still 200", (await call(req("POST", "/auth/forgot", { body: { email: "nobody@example.com" } }), env)).status, 200);
    check("forgot: no token for unknown email", resetKeys().length === 0);
    await call(req("POST", "/auth/forgot", { body: { email: "reset.me@example.com" } }), env);
    check("forgot: token created for real user", resetKeys().length === 1, JSON.stringify(resetKeys()));
    const token = resetKeys()[0].slice("reset:".length);
    eq("reset: bad token → 400", (await call(req("POST", "/auth/reset", { body: { token: "nope", password: "Abcdef1!" } }), env)).status, 400);
    eq("reset: short password → 400", (await call(req("POST", "/auth/reset", { body: { token, password: "short" } }), env)).status, 400);
    const ok = await call(req("POST", "/auth/reset", { body: { token, password: "Abcdef1!" } }), env);
    eq("reset: valid → 200", ok.status, 200);
    check("reset: token consumed", !env.USERS._map.has(`reset:${token}`));
    check("reset: password changed", (await env.USERS.get("user:reset.me@example.com", "json")).pass !== "oldhash");
  }

  // 32. register requires email verification: no session, verify token + verification notice, no signup yet
  {
    const env = { USERS: makeKV() };
    const r = await call(req("POST", "/auth/register", { body: { email: "newbie@example.com", password: "Abcdef1!" } }), env);
    eq("register: pending (no auto-login)", (await r.json()).pending, true);
    check("register: no session cookie", !(r.headers.get("Set-Cookie") || "").includes("sib_session="), r.headers.get("Set-Cookie"));
    check("register: verify token created", [...env.USERS._map.keys()].some((k) => k.startsWith("verify:")));
    const u = await env.USERS.get("user:newbie@example.com", "json");
    eq("register: account starts unverified", u.emailVerified, false);
    const notifs = [...env.USERS._map.keys()].filter((k) => k.startsWith("admin:notification:")).map((k) => JSON.parse(env.USERS._map.get(k)));
    const rec = notifs.find((n) => n.type === "email_verification");
    check("register notif: email_verification present", !!rec, JSON.stringify(notifs.map((n) => n.type)));
    eq("register notif: emailSent false without email key", rec.emailSent, false);
    check("register: no signup notice until verified", !notifs.some((n) => n.type === "signup"));
  }

  // 33. admin notifications endpoint + sendReset action + email diagnostic
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com", STRIPE_SECRET_KEY: "sk_test_x", BREVO_API_KEY: "brevo_x" };
    const admin = await seedUser(env, "admin@example.com");
    await env.USERS.put("admin:notification:1700000000000", JSON.stringify({ type: "signup", email: "x@y.com", emailSent: false, timestamp: "2026-01-01T00:00:00Z" }));
    eq("notifications: signed out → 401", (await call(req("GET", "/api/admin/notifications"), { USERS: env.USERS })).status, 401);
    const list = await (await call(req("GET", "/api/admin/notifications", { cookie: admin }), env)).json();
    check("notifications: lists records", list.notifications.length >= 1, JSON.stringify(list));
    // sendReset for a password user creates a reset token
    await seedUser(env, "pwuser@example.com", { via: "password", pass: "h", salt: "s" });
    eq("sendReset: → 200", (await call(req("POST", "/api/admin/user", { cookie: admin, body: { email: "pwuser@example.com", action: "sendReset" } }), env)).status, 200);
    check("sendReset: token created", [...env.USERS._map.keys()].some((k) => k.startsWith("reset:")));
    await seedUser(env, "goog@example.com", { via: "google" });
    eq("sendReset: google user → 400", (await call(req("POST", "/api/admin/user", { cookie: admin, body: { email: "goog@example.com", action: "sendReset" } }), env)).status, 400);
    // diagnostics surface email provider presence
    eq("billing-status: email present", (await (await call(req("GET", "/api/billing-status", { cookie: admin }), env)).json()).email.present, true);
  }

  // 34. register sends a verification email; verifying it sends welcome + signs in
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    emailCalls = [];
    await call(req("POST", "/auth/register", { body: { email: "welcomeme@example.com", password: "Abcdef1!" } }), env);
    check("register: sends verification email", emailCalls.some((c) => /confirm your email/i.test(c.subject)), JSON.stringify(emailCalls.map((c) => c.subject)));
    check("register: does NOT send welcome yet", !emailCalls.some((c) => /welcome/i.test(c.subject)));
    const vkey = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:"));
    const token = vkey.slice("verify:".length);
    emailCalls = [];
    const vr = await call(req("POST", "/auth/verify", { body: { token } }), env);
    eq("verify: → 200", vr.status, 200);
    eq("verify: returns verified user", (await vr.json()).user.emailVerified, true);
    check("verify: sets session cookie", (vr.headers.get("Set-Cookie") || "").includes("sib_session="));
    check("verify: sends welcome email", emailCalls.some((c) => /welcome/i.test(c.subject)), JSON.stringify(emailCalls.map((c) => c.subject)));
    eq("verify: persists emailVerified", (await env.USERS.get("user:welcomeme@example.com", "json")).emailVerified, true);
    check("verify: token consumed", !env.USERS._map.has(vkey));
    eq("verify: bad token → 400", (await call(req("POST", "/auth/verify", { body: { token: "nope" } }), env)).status, 400);
  }

  // 35. checkout.session.completed sends an ad-free-activated email
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right", BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "newpaid@example.com");
    emailCalls = [];
    const evt = { type: "checkout.session.completed", data: { object: { client_reference_id: "newpaid@example.com", customer: "cus_9", subscription: "sub_9" } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    check("webhook: sends ad-free email", emailCalls.some((c) => /ad-free/i.test(c.subject)), JSON.stringify(emailCalls.map((c) => c.subject)));
    const notifs = [...env.USERS._map.keys()].filter((k) => k.startsWith("admin:notification:")).map((k) => JSON.parse(env.USERS._map.get(k)));
    check("webhook: adfree_activated notification logged", notifs.some((n) => n.type === "adfree_activated"), JSON.stringify(notifs.map((n) => n.type)));
  }

  // 36. notifyEmails in site config drives admin notification recipients
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "owner@example.com", BREVO_API_KEY: "brevo_x" };
    const admin = await seedUser(env, "owner@example.com");
    // save config with notifyEmails via the admin PUT (also exercises sanitize)
    const put = await call(req("PUT", "/api/admin/config", { cookie: admin, body: { config: { notifyEmails: ["Ops@Example.com ", "bad-email", "alerts@example.com"] } } }), env);
    eq("config PUT: → 200", put.status, 200);
    const saved = await put.json();
    eq("notifyEmails: sanitized + lowercased", JSON.stringify(saved.config.notifyEmails), JSON.stringify(["ops@example.com", "alerts@example.com"]));
    // a verified signup should email the configured recipients, not the owner default
    await call(req("POST", "/auth/register", { body: { email: "fresh@example.com", password: "Abcdef1!" } }), env);
    const token = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:")).slice("verify:".length);
    emailCalls = [];
    await call(req("POST", "/auth/verify", { body: { token } }), env);
    const signup = emailCalls.find((c) => /signup/i.test(c.subject));
    const signupTo = (signup.to || []).map((r) => r.email);
    check("signup email targets configured recipients", JSON.stringify(signupTo) === JSON.stringify(["ops@example.com", "alerts@example.com"]), JSON.stringify(signup && signup.to));
  }

  // 37. login is gated on verification; old accounts (no flag) are grandfathered in
  {
    const env = { USERS: makeKV() };
    await call(req("POST", "/auth/register", { body: { email: "unv@example.com", password: "Abcdef1!" } }), env);
    const blocked = await call(req("POST", "/auth/login", { body: { email: "unv@example.com", password: "Abcdef1!" } }), env);
    eq("login unverified → 403", blocked.status, 403);
    eq("login unverified: needsVerification flag", (await blocked.json()).needsVerification, true);
    // verify, then login succeeds
    const token = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:")).slice("verify:".length);
    await call(req("POST", "/auth/verify", { body: { token } }), env);
    eq("login after verify → 200", (await call(req("POST", "/auth/login", { body: { email: "unv@example.com", password: "Abcdef1!" } }), env)).status, 200);
    // grandfather: an account with no emailVerified field logs in fine
    const old = await env.USERS.get("user:unv@example.com", "json");
    delete old.emailVerified;
    await env.USERS.put("user:unv@example.com", JSON.stringify(old));
    eq("login grandfathered (no flag) → 200", (await call(req("POST", "/auth/login", { body: { email: "unv@example.com", password: "Abcdef1!" } }), env)).status, 200);
  }

  // 38. resend-verification re-issues a token for unverified accounts only (no enumeration)
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await call(req("POST", "/auth/register", { body: { email: "again@example.com", password: "Abcdef1!" } }), env);
    // consume the original token so we can detect a fresh one
    for (const k of [...env.USERS._map.keys()].filter((k) => k.startsWith("verify:"))) env.USERS._map.delete(k);
    emailCalls = [];
    const rr = await call(req("POST", "/auth/resend-verification", { body: { email: "again@example.com" } }), env);
    eq("resend: → 200", rr.status, 200);
    check("resend: issues a fresh token", [...env.USERS._map.keys()].some((k) => k.startsWith("verify:")));
    check("resend: sends verification email", emailCalls.some((c) => /confirm your email/i.test(c.subject)));
    // unknown / already-verified address: still 200, but no token, no email
    emailCalls = [];
    const rr2 = await call(req("POST", "/auth/resend-verification", { body: { email: "ghost@example.com" } }), env);
    eq("resend unknown: → 200 (no enumeration)", rr2.status, 200);
    check("resend unknown: no email sent", emailCalls.length === 0);
  }

  // 39. unsubscribe: welcome email carries a token; endpoint opts out / resubscribes
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await call(req("POST", "/auth/register", { body: { email: "unsub@example.com", password: "Abcdef1!" } }), env);
    const vtok = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:")).slice("verify:".length);
    emailCalls = [];
    await call(req("POST", "/auth/verify", { body: { token: vtok } }), env);
    const u = await env.USERS.get("user:unsub@example.com", "json");
    check("welcome: user has unsub token", !!u.unsubToken);
    eq("welcome: reverse index resolves to email", await env.USERS.get(`unsub:${u.unsubToken}`), "unsub@example.com");
    const welcome = emailCalls.find((c) => /welcome/i.test(c.subject));
    check("welcome email includes unsubscribe link", /\/unsubscribe\?u=/.test(welcome.htmlContent), welcome && welcome.htmlContent.slice(-160));
    // GET unsubscribe → opts out + serves an HTML page
    const us = await call(req("GET", `/unsubscribe?u=${u.unsubToken}`), env);
    eq("unsubscribe GET → 200", us.status, 200);
    check("unsubscribe GET → HTML", (us.headers.get("Content-Type") || "").includes("text/html"));
    eq("unsubscribe sets emailOptOut", (await env.USERS.get("user:unsub@example.com", "json")).emailOptOut, true);
    // resubscribe
    await call(req("GET", `/unsubscribe?u=${u.unsubToken}&action=resubscribe`), env);
    eq("resubscribe clears emailOptOut", (await env.USERS.get("user:unsub@example.com", "json")).emailOptOut, false);
    // one-click POST (RFC 8058) opts out
    await call(req("POST", `/unsubscribe?u=${u.unsubToken}`), env);
    eq("one-click POST opts out", (await env.USERS.get("user:unsub@example.com", "json")).emailOptOut, true);
    // bad token → still a 200 page, no crash
    eq("unsubscribe bad token → 200", (await call(req("GET", "/unsubscribe?u=nope"), env)).status, 200);
  }

  // 40. opted-out users don't get the welcome email (essential mail still flows)
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await call(req("POST", "/auth/register", { body: { email: "quiet@example.com", password: "Abcdef1!" } }), env);
    // pre-set opt-out before verifying
    const pre = await env.USERS.get("user:quiet@example.com", "json");
    pre.emailOptOut = true; await env.USERS.put("user:quiet@example.com", JSON.stringify(pre));
    const vtok = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:")).slice("verify:".length);
    emailCalls = [];
    await call(req("POST", "/auth/verify", { body: { token: vtok } }), env);
    check("opted-out: no welcome email sent", !emailCalls.some((c) => /welcome/i.test(c.subject)), JSON.stringify(emailCalls.map((c) => c.subject)));
    check("opted-out: signup notice still sent", emailCalls.some((c) => /signup/i.test(c.subject)));
  }

  // 41. password policy: register rejects weak passwords, accepts a strong one
  {
    const env = { USERS: makeKV() };
    const status = (pw) => call(req("POST", "/auth/register", { body: { email: "pw@example.com", password: pw } }), env).then((r) => r.status);
    eq("policy: too short → 400", await status("Ab1!"), 400);
    eq("policy: no number → 400", await status("Abcdefg!"), 400);
    eq("policy: no special → 400", await status("Abcdefg1"), 400);
    eq("policy: no letter → 400", await status("12345678!"), 400);
    check("policy: weak attempts create no account", (await env.USERS.get("user:pw@example.com", "json")) === null);
    eq("policy: strong → pending", (await (await call(req("POST", "/auth/register", { body: { email: "pw@example.com", password: "Abcdef1!" } }), env)).json()).pending, true);
  }

  // 42. account deletion purges data + cancels the subscription immediately
  {
    stripeCalls = [];
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const cookie = await seedUser(env, "bye@example.com", { adFree: true, stripeSubId: "sub_del", stripeCustomerId: "cus_del", unsubToken: "unsubtok" });
    await env.USERS.put("unsub:unsubtok", "bye@example.com");
    await env.USERS.put("stripecust:cus_del", "bye@example.com");
    await env.USERS.put("verify:vtok", "bye@example.com");
    // signed out → 401
    eq("delete: signed out → 401", (await call(req("POST", "/api/delete-account", { body: { email: "bye@example.com" } }), env)).status, 401);
    // wrong confirmation email → 400, nothing deleted
    eq("delete: wrong email → 400", (await call(req("POST", "/api/delete-account", { cookie, body: { email: "nope@example.com" } }), env)).status, 400);
    check("delete: account intact after failed confirm", !!(await env.USERS.get("user:bye@example.com", "json")));
    // correct confirmation → purge everything
    const r = await call(req("POST", "/api/delete-account", { cookie, body: { email: "bye@example.com" } }), env);
    eq("delete: → 200", r.status, 200);
    check("delete: clears session cookie", (r.headers.get("Set-Cookie") || "").includes("Max-Age=0"));
    check("delete: user purged", (await env.USERS.get("user:bye@example.com", "json")) === null);
    check("delete: session purged", (await env.USERS.get("sess:tok_byeexamplecom")) === null);
    check("delete: unsub index purged", (await env.USERS.get("unsub:unsubtok")) === null);
    check("delete: stripecust index purged", (await env.USERS.get("stripecust:cus_del")) === null);
    check("delete: verify token purged", (await env.USERS.get("verify:vtok")) === null);
    const delCall = stripeCalls.find((c) => c.url.includes("/v1/subscriptions/sub_del") && c.method === "DELETE");
    check("delete: cancels stripe subscription immediately", !!delCall, JSON.stringify(stripeCalls.map((c) => c.method + " " + c.url)));
  }

  // 43. legacy (100k-iteration) password hash is upgraded on next login
  {
    const env = { USERS: makeKV() };
    const salt = "aabbccddeeff00112233445566778899";
    const legacyHash = await pbkdf2Hex("Legacy1!", salt, 100000);
    // Pre-passIter account (grandfathered): no passIter field, 100k hash.
    await seedUser(env, "legacy@example.com", { via: "password", salt, pass: legacyHash, emailVerified: true });
    const wrong = await call(req("POST", "/auth/login", { body: { email: "legacy@example.com", password: "nope!" } }), env);
    eq("legacy: wrong password → 401", wrong.status, 401);
    const ok = await call(req("POST", "/auth/login", { body: { email: "legacy@example.com", password: "Legacy1!" } }), env);
    eq("legacy: correct password → 200", ok.status, 200);
    const u = await env.USERS.get("user:legacy@example.com", "json");
    eq("legacy: work factor upgraded to 300k", u.passIter, 300000);
    check("legacy: hash re-salted on upgrade", u.salt !== salt);
    // and the upgraded hash still verifies on the next login
    eq("legacy: still logs in after upgrade", (await call(req("POST", "/auth/login", { body: { email: "legacy@example.com", password: "Legacy1!" } }), env)).status, 200);
  }

  // 44. per-IP rate limiting on login
  {
    const env = { USERS: makeKV() };
    let last;
    for (let i = 0; i < 21; i++) last = await call(req("POST", "/auth/login", { body: { email: "nobody@example.com", password: "x" } }), env);
    eq("login: 21st attempt → 429", last.status, 429);
  }

  // 45. tightened email validation rejects injection-y addresses
  {
    const env = { USERS: makeKV() };
    const reg = (email) => call(req("POST", "/auth/register", { body: { email, password: "Abcdef1!" } }), env).then((r) => r.status);
    eq("email: angle brackets → 400", await reg('a<script>@x.com'), 400);
    eq("email: quotes → 400", await reg('a"b@x.com'), 400);
    eq("email: over-long → 400", await reg("a".repeat(250) + "@x.com"), 400);
  }

  // 46. CSP report collector stores deduped violations; admin can list them
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com");
    const report = { "csp-report": { "effective-directive": "frame-src", "blocked-uri": "https://cam.example.com/live", "document-uri": "https://shouldiboat.com/" } };
    const r = await call(req("POST", "/api/csp-report", { body: report }), env);
    eq("csp-report: → 204", r.status, 204);
    check("csp-report: stored under deduped key", [...env.USERS._map.keys()].some((k) => k.startsWith("csp:frame-src:cam.example.com")));
    // a second identical report collapses to the same key
    await call(req("POST", "/api/csp-report", { body: report }), env);
    eq("csp-report: dedupes by directive+host", [...env.USERS._map.keys()].filter((k) => k.startsWith("csp:")).length, 1);
    // admin can list
    eq("csp-reports: signed out → 401", (await call(req("GET", "/api/admin/csp-reports"), { USERS: env.USERS })).status, 401);
    const list = await (await call(req("GET", "/api/admin/csp-reports", { cookie: admin }), env)).json();
    check("csp-reports: lists violation", list.reports.some((x) => x.directive === "frame-src" && /cam\.example\.com/.test(x.blocked)));
    const rando = await seedUser(env, "rando@example.com");
    eq("csp-reports: non-admin → 403", (await call(req("GET", "/api/admin/csp-reports", { cookie: rando }), env)).status, 403);
  }

  // 47. daily digest: opted-in users with favorites get one morning email
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "digest@example.com", { favorites: ["sandusky", "cleveland"], prefs: { dailyEmail: true } });
    await seedUser(env, "nopref@example.com", { favorites: ["sandusky"] });
    await seedUser(env, "optout@example.com", { favorites: ["sandusky"], prefs: { dailyEmail: true }, emailOptOut: true });
    emailCalls = [];
    const res = await runScheduled(env, 10);
    eq("digest: exactly one digest sent", res.digests, 1);
    const d = emailCalls.find((c) => /Should I Boat/i.test(c.subject));
    check("digest: goes to the opted-in user", d && d.to[0].email === "digest@example.com", JSON.stringify(emailCalls.map((c) => c.to)));
    check("digest: subject leads with home-port best window", /Best window at Sandusky/i.test(d.subject), d.subject);
    check("digest: rows carry the best window", /best 6am–9pm/.test(d.htmlContent));
    check("digest: includes both favorite ports", /Sandusky/.test(d.htmlContent) && /Cleveland/.test(d.htmlContent));
    check("digest: carries unsubscribe link", /\/unsubscribe\?u=/.test(d.htmlContent));
    check("digest: run logged for admin", [...env.USERS._map.keys()].some((k) => k.startsWith("admin:notification:")));
    // outside both windows → no work
    eq("digest: 3am UTC run skipped", (await runScheduled(env, 3)).skipped, "outside windows");
  }

  // 48. NO-GO alerts: sent in the daytime window, deduped per port per day
  {
    stormMode = true;
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "alerts@example.com", { favorites: ["sandusky"], prefs: { alertEmails: true } });
    await seedUser(env, "quiet@example.com", { favorites: ["sandusky"] }); // no pref → no alert
    emailCalls = [];
    const r1 = await runScheduled(env, 15);
    eq("alerts: one alert sent", r1.alerts, 1);
    check("alerts: subject flags NO-GO", /NO-GO/.test(emailCalls[0].subject), emailCalls[0] && emailCalls[0].subject);
    const r2 = await runScheduled(env, 16);
    eq("alerts: deduped for the rest of the day", r2.alerts, 0);
    stormMode = false;
  }

  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
