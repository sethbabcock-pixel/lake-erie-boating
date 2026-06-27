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
    async get(k, type) { const v = m.get(k); if (v === undefined) return null; return type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, typeof v === "string" ? v : JSON.stringify(v)); },
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

  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
