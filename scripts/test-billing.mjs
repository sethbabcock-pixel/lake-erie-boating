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
      const keys = [...m.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name }));
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
let scaMode = false; // NWS alerts stub: an active Small Craft Advisory at every point
let alertsDown = false; // NWS alerts stub: the alerts endpoint fails
let zoneAlert = null; // NWS alerts stub: "gale" = a Gale Warning on the zone query only; "down" = zone query fails
let alertFeatures = null; // NWS alerts stub: every alerts query returns these raw features
let alertTestStatus = null; // NWS alerts stub: every alerts query returns one Gale Warning with this status (e.g. "Test")
let landAlertGeom = null; // with landAlert: a GeoJSON geometry for the warned polygon (null = zone-based, no polygon)
let landAlertMotion = null; // with landAlert: an NWS eventMotionDescription string (null = none)
let landAlert = null; // NWS alerts stub: an event name issued for the land county OHC043 (every mock launch point is in it)
let pointsNoZones = false;
let pointsCalls = 0; // NWS /points stub: lookups served
let pointsFail = null; // NWS /points stub: a function (lat, lon) → true to answer 503
let pointsOnWater = null; // NWS /points stub: a function (lat, lon) → true when that point is on the water (marine zone, no county) // NWS /points stub: omit the launch point's forecastZone/county
let zoneAlertOnly = null; // with zoneAlert "gale": only these zones carry it (null = every queried zone)
let zoneAlertSpan = null; // with zoneAlert "gale": { onsetH, endsH } hours from now (null = in effect now, open-ended)
let alertsZoneDown = false; // NWS alerts stub: only the by-zone lookup fails (the point lookup still answers)
let barMode = null; // NWS alerts stub: a Small Craft Advisory for this zone only (e.g. "PZZ210"), answered by zone lookups
// NWS grid stub override: "gusty" = 13 kt gusting 24 kt, 1.5 ft (lake NO-GO on
// the gust); "nowind" = no wind/gust layers at all, calm 1 ft waves;
// "gustonly" = a 9 kt gust but no sustained wind (grid or hourly) and no waves.
let gridMode = null;
// NWS grid stub, per sample point: (lat, lon) → a wave layer override for the
// grid cell at that point, or undefined for the default. Overrides: "filler"
// (one 0 m value held for 7 days, like DTX/84,67 off Port Huron), "zeros"
// (several valid times, all 0 m), "calm" (a real 0–1 ft day: 0 m and 0.3 m
// in turn), or a number = a real forecast of that many metres.
let nshMock = null; // NWS products stub: CLE NSH text (null = no product)
let gridWavesAt = null;
let gridCalls = []; // NWS grid stub: the "lat,lon" sample point of each grid fetch
let hourlyLagH = 0; // hourly stub: lead with this many already-past hours
let ndbcFiles = {}; // NDBC realtime2 stub: station → file text (unlisted → 404)
let fcUpdateAgeH = null; // NWS stub: hours since the forecaster's last update (null → no updateTime sent)
let dailyStub = null; // NWS daily point-forecast stub: periods array (null → none served)
let subGetCancelState = false; // what a GET subscription retrieve reports
let subStatus = {}; // sub id → status a GET retrieve reports ("missing" → 404); default active
let subCustomer = {}; // sub id → customer a GET retrieve reports (default: none)
let stripeDown = false; // every Stripe API call → 500
let stripeFailIds = new Set(); // sub ids whose GET retrieve returns a 500
let subInvoice = {}; // sub id → latest_invoice.status when expanded (default "paid")
let subList = {}; // customer → [{ id, status, purpose, invoice }] for GET /v1/subscriptions?customer=
let subListDown = false; // the list endpoint → 500
const makeSub = (cancelAtPeriodEnd) => ({
  id: "sub_123", status: "active", cancel_at_period_end: cancelAtPeriodEnd,
  current_period_end: 1790000000, cancel_at: cancelAtPeriodEnd ? 1790000000 : null,
  items: { data: [{ price: { unit_amount: 299, currency: "usd", recurring: { interval: "month" } } }] },
});
let googleIdPayload = null; // claims the stubbed Google token exchange returns
function installFetchStub() {
  globalThis.fetch = async (urlStr, opts = {}) => {
    const u = String(urlStr);
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      const b64 = Buffer.from(JSON.stringify(googleIdPayload || {})).toString("base64url");
      return jsonResp({ id_token: `h.${b64}.s` });
    }
    if (u.includes("api.brevo.com")) {
      emailCalls.push(JSON.parse(opts.body || "{}"));
      return jsonResp({ messageId: "<msg@brevo>" }, 201);
    }
    // NWS api.weather.gov (the conditions engine behind the digest + alerts):
    // /points → a grid, /gridpoints → 4 days of flat weather. Calm by default
    // (8 kt, 1 ft @ 5 s → GO all day); stormMode = 28 kt, 6 ft → NO-GO.
    if (u.includes("api.weather.gov/points/")) {
      pointsCalls++;
      if (pointsFail && pointsFail(...u.split("/points/")[1].split(",").map(Number))) return new Response("", { status: 503 });
      return jsonResp({ properties: { gridId: "CLE", gridX: 1, gridY: 1, timeZone: "America/New_York",
        // The query names the sample point, so the grid stub can vary by cell.
        forecastGridData: `https://api.weather.gov/gridpoints/CLE/1,1?at=${u.split("/points/")[1]}`,
        forecast: "https://api.weather.gov/gridpoints/CLE/1,1/forecast",
        forecastHourly: "https://api.weather.gov/gridpoints/CLE/1,1/forecast/hourly",
        // Land zones for the launch point (land warnings are issued for these).
        ...(pointsNoZones ? {} : pointsOnWater && pointsOnWater(...u.split("/points/")[1].split(",").map(Number)) ? { forecastZone: "https://api.weather.gov/zones/forecast/LEZ144" } : { forecastZone: "https://api.weather.gov/zones/forecast/OHZ007", county: "https://api.weather.gov/zones/county/OHC043" }) } });
    }
    if (/api\.weather\.gov\/gridpoints\/[^/]+\/[^/]+$/.test(u)) {
      const start = new Date(Date.now() - 30 * 3600e3); start.setUTCMinutes(0, 0, 0);
      const span = (value) => ({ values: [{ validTime: `${start.toISOString().replace(".000Z", "+00:00")}/PT240H`, value }] });
      // A real forecast breaks the period into many valid times (a single
      // 10-day value is a placeholder and is ignored as wave data): 6-hour
      // steps, value(i) for step i.
      const steps = (value) => (value == null ? { values: [] } : { values: Array.from({ length: 40 }, (_, i) => ({
        validTime: `${new Date(start.getTime() + i * 6 * 3600e3).toISOString().replace(".000Z", "+00:00")}/PT6H`, value: typeof value === "function" ? value(i) : value })) });
      gridCalls.push(new URL(u).searchParams.get("at"));
      const at = new URL(u).searchParams.get("at")?.split(",").map(Number) || [];
      const ov = gridWavesAt ? gridWavesAt(...at) : undefined;
      const waveLayer = ov === "filler" ? { values: [{ validTime: `${start.toISOString().replace(".000Z", "+00:00")}/P7DT4H`, value: 0 }] }
        : ov === "zeros" ? steps(0)
        : ov === "calm" ? steps((i) => (i % 2 ? 0.3048 : 0))
        : typeof ov === "number" ? steps(ov)
        : steps(gridMode === "gustonly" ? null : gridMode === "gusty" ? 0.457 : stormMode ? 1.83 : 0.3);
      return jsonResp({ properties: {
        ...(fcUpdateAgeH != null ? { updateTime: new Date(Date.now() - fcUpdateAgeH * 3600e3).toISOString() } : {}),
        windSpeed: { uom: "wmoUnit:km_h-1", ...span(gridMode === "nowind" || gridMode === "gustonly" ? null : gridMode === "gusty" ? 24 : stormMode ? 52 : 15) },
        windGust: { uom: "wmoUnit:km_h-1", ...span(gridMode === "nowind" ? null : gridMode === "gustonly" ? 16.7 : gridMode === "gusty" ? 44.5 : stormMode ? 65 : 20) },
        windDirection: span(225),
        waveHeight: waveLayer,
        wavePeriod: ov === "filler" ? { values: [{ validTime: waveLayer.values[0].validTime, value: 0 }] } : steps(5),
        probabilityOfPrecipitation: span(0),
        weather: span([]),
      } });
    }
    // Hourly point forecast (the spot page's timeline): 48 calm or stormy hours.
    if (/\/forecast\/hourly$/.test(u)) {
      const t0 = new Date(Date.now() - hourlyLagH * 3600e3); t0.setUTCMinutes(0, 0, 0);
      const periods = Array.from({ length: 48 }, (_, i) => ({ startTime: new Date(t0.getTime() + i * 3600e3).toISOString(), temperature: 60,
        windSpeed: stormMode ? "32 mph" : gridMode === "gusty" ? "15 mph" : gridMode === "gustonly" ? "" : "9 mph", windDirection: "SW", shortForecast: "Sunny", probabilityOfPrecipitation: { value: 0 } }));
      return jsonResp({ properties: { periods, ...(fcUpdateAgeH != null ? { updateTime: new Date(Date.now() - fcUpdateAgeH * 3600e3).toISOString() } : {}) } });
    }
    if (/\/forecast$/.test(u) && dailyStub) return jsonResp({ properties: { periods: dailyStub } });
    if (u.includes("api.weather.gov/alerts/active") && alertsDown) return new Response("", { status: 503 });
    if (u.includes("api.weather.gov/alerts/active") && alertFeatures) return jsonResp({ features: alertFeatures });
    if (u.includes("api.weather.gov/alerts/active") && alertTestStatus) {
      return jsonResp({ features: [{ properties: { status: alertTestStatus, event: "Gale Warning", severity: "Moderate", headline: "TEST Gale Warning", sent: new Date().toISOString(), geocode: { UGC: ["LEZ143"] } } }] });
    }
    if (u.includes("api.weather.gov/alerts/active?zone=") && landAlert && decodeURIComponent(u).includes("OHC043")) {
      return jsonResp({ features: [{ geometry: landAlertGeom, properties: { status: "Actual", event: landAlert, severity: "Severe", headline: `${landAlert} in effect`, sent: new Date().toISOString(), geocode: { UGC: ["OHC043"] }, parameters: landAlertMotion ? { eventMotionDescription: [landAlertMotion] } : {} } }] });
    }
    if (u.includes("api.weather.gov/alerts/active?zone=") && zoneAlert === "down") return new Response("", { status: 503 });
    if (u.includes("api.weather.gov/alerts/active?zone=") && zoneAlert === "gale") {
      const asked = decodeURIComponent(u.split("zone=")[1] || "").split(",");
      const UGC = zoneAlertOnly ? asked.filter((z) => zoneAlertOnly.includes(z)) : asked;
      if (!UGC.length) return jsonResp({ features: [] });
      const at = (h) => new Date(Date.now() + h * 3600e3).toISOString();
      const span = zoneAlertSpan ? { onset: at(zoneAlertSpan.onsetH), ends: at(zoneAlertSpan.endsH) } : {};
      return jsonResp({ features: [{ properties: { event: "Gale Warning", severity: "Moderate", headline: "Gale Warning in effect", sent: new Date().toISOString(), ...span, geocode: { UGC } } }] });
    }
    if (u.includes("api.weather.gov/alerts/active?zone=") && alertsZoneDown) return new Response("", { status: 503 });
    if (u.includes("api.weather.gov/alerts/active") && barMode) {
      // Zone-coded advisory: only a lookup that names the zone gets it (a shore
      // point outside the marine polygon does not), as on the live API.
      const hit = decodeURIComponent(u).includes(`zone=`) && decodeURIComponent(u).split("zone=")[1].split(",").some((z) => z.startsWith(barMode));
      return jsonResp({ features: hit ? [{ id: `sca-${barMode}`, properties: { event: "Small Craft Advisory", severity: "Minor", headline: "Small Craft Advisory in effect", sent: new Date().toISOString(), geocode: { UGC: [barMode] } } }] : [] });
    }
    if (u.includes("api.weather.gov/alerts/active") && scaMode) {
      return jsonResp({ features: [{ properties: { event: "Small Craft Advisory", severity: "Minor", headline: "Small Craft Advisory in effect", sent: new Date().toISOString() } }] });
    }
    if (nshMock && u.includes("api.weather.gov/products/types/NSH/locations/CLE")) return jsonResp({ "@graph": [{ id: "nsh-cle-test" }] });
    if (nshMock && u.endsWith("api.weather.gov/products/nsh-cle-test")) return jsonResp({ productText: nshMock, issuanceTime: new Date().toISOString() });
    if (u.includes("api.weather.gov")) return jsonResp({ features: [], "@graph": [], properties: { periods: [] } });
    if (u.includes("ndbc.noaa.gov")) {
      const st = u.match(/realtime2\/([^/.]+)\.txt$/)?.[1];
      return st && ndbcFiles[st] != null ? new Response(ndbcFiles[st], { status: 200 }) : new Response("", { status: 404 });
    }
    const body = opts.body ? Object.fromEntries(new URLSearchParams(opts.body)) : null;
    stripeCalls.push({ url: u, method: opts.method || "GET", body });
    if (u.includes("/v1/checkout/sessions"))
      return jsonResp({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" });
    if (u.includes("/v1/billing_portal/sessions"))
      return jsonResp({ id: "bps_123", url: "https://billing.stripe.com/p/session/bps_123" });
    if (stripeDown) return jsonResp({ error: { message: "stripe is down" } }, 500);
    if (/\/v1\/subscriptions\?/.test(u)) {
      if (subListDown) return jsonResp({ error: { message: "list down" } }, 500);
      const cus = new URL(u).searchParams.get("customer");
      const data = (subList[cus] || []).map((x) => ({ id: x.id, customer: cus, status: x.status,
        metadata: x.purpose ? { purpose: x.purpose } : {}, latest_invoice: { id: `in_${x.id}`, status: x.invoice || "paid" } }));
      return jsonResp({ object: "list", data, has_more: false });
    }
    if (u.includes("/v1/subscriptions/")) {
      // POST = update (cancel/resume) → mirror the request; GET = retrieve.
      if ((opts.method || "GET") === "POST") return jsonResp(makeSub(body?.cancel_at_period_end === "true"));
      const id = decodeURIComponent(u.split("/v1/subscriptions/")[1].split(/[/?]/)[0]);
      if (stripeFailIds.has(id)) return jsonResp({ error: { type: "api_error" } }, 500);
      if (subStatus[id] === "missing") return jsonResp({ error: { type: "invalid_request_error", code: "resource_missing" } }, 404);
      const expandInvoice = u.includes("expand") && decodeURIComponent(u).includes("latest_invoice");
      return jsonResp({ ...makeSub(subGetCancelState), status: subStatus[id] || "active", ...(subCustomer[id] ? { customer: subCustomer[id] } : {}),
        ...(expandInvoice ? { latest_invoice: { id: `in_${id}`, status: subInvoice[id] || "paid" } } : {}) });
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

// `secrets` may be an array to mimic webhook-secret rotation, where Stripe
// sends one `v1=` per active secret. `scheme` swaps the signature key (e.g. v0).
function stripeWebhookReq(eventObj, secret, { skewSeconds = 0, scheme = "v1" } = {}) {
  const payload = JSON.stringify(eventObj);
  const t = Math.floor(Date.now() / 1000) + skewSeconds;
  const sigs = [].concat(secret).map((s) => `${scheme}=${createHmac("sha256", s).update(`${t}.${payload}`).digest("hex")}`);
  const request = new Request(ORIGIN + "/stripe/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": `t=${t},${sigs.join(",")}`, "Content-Type": "application/json" },
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
    eq("checkout: tags purpose=adfree", sent?.body?.["metadata[purpose]"], "adfree");
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
      data: { object: { mode: "subscription", payment_status: "paid", metadata: { purpose: "adfree" }, client_reference_id: "buyer@example.com", customer: "cus_123", subscription: "sub_123" } },
    };
    const r = await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: completed → 200", r.status, 200);
    const u = await env.USERS.get("user:buyer@example.com", "json");
    eq("webhook: completed grants ad-free", u.adFree, true);
    eq("webhook: stores stripeCustomerId", u.stripeCustomerId, "cus_123");
    eq("webhook: stores stripeSubId", u.stripeSubId, "sub_123");
    eq("webhook: writes reverse index", await env.USERS.get("stripecust:cus_123"), "buyer@example.com");
  }

  // 6b. A non-ad-free checkout (one-time merch payment) must not grant ad-free
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right", BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "shopper@example.com");
    emailCalls = [];
    const evt = { type: "checkout.session.completed", data: { object: { mode: "payment", client_reference_id: "shopper@example.com", customer: "cus_m1", subscription: null, metadata: { purpose: "merch" } } } };
    const r = await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: merch payment → 200", r.status, 200);
    const u = await env.USERS.get("user:shopper@example.com", "json");
    check("webhook: merch payment does not grant ad-free", !u.adFree, JSON.stringify(u.adFree));
    check("webhook: merch payment sends no ad-free email", !emailCalls.some((c) => /ad-free|Welcome to shouldiboat Pro/i.test(c.subject)));
  }

  // 6c. An existing subscriber buying merch keeps their stored subscription
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "sub@example.com", { adFree: true, stripeCustomerId: "cus_s1", stripeSubId: "sub_keep" });
    const evt = { type: "checkout.session.completed", data: { object: { mode: "payment", client_reference_id: "sub@example.com", customer: "cus_s1", subscription: null } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    const u = await env.USERS.get("user:sub@example.com", "json");
    eq("webhook: merch keeps stripeSubId", u.stripeSubId, "sub_keep");
    eq("webhook: merch keeps ad-free on", u.adFree, true);
  }

  // 6d. A subscription checkout tagged for another purpose is ignored too
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "club@example.com");
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_x", client_reference_id: "club@example.com", metadata: { purpose: "merch-club" } } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    const u = await env.USERS.get("user:club@example.com", "json");
    check("webhook: other-purpose subscription does not grant ad-free", !u.adFree);
  }

  // 6d2. An untagged subscription checkout is ignored (purpose=adfree is required)
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right", BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "untagged@example.com");
    emailCalls = [];
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", subscription: "sub_u", customer: "cus_u", client_reference_id: "untagged@example.com" } } };
    const r = await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: untagged subscription → 200", r.status, 200);
    const u = await env.USERS.get("user:untagged@example.com", "json");
    check("webhook: untagged subscription does not grant ad-free", !u.adFree);
    check("webhook: untagged subscription stores no stripeSubId", !u.stripeSubId);
    check("webhook: untagged subscription writes no reverse index", !(await env.USERS.get("stripecust:cus_u")));
    check("webhook: untagged subscription sends no welcome email", !emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)));
  }

  // 6d3. Async payment (ACH/SEPA): `completed` arrives unpaid → no grant; the
  // grant waits for `async_payment_succeeded`. A failed async payment grants nothing.
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right", BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "ach@example.com");
    emailCalls = [];
    const session = { mode: "subscription", metadata: { purpose: "adfree" }, subscription: "sub_ach", customer: "cus_ach", client_reference_id: "ach@example.com" };
    const unpaid = { type: "checkout.session.completed", data: { object: { ...session, payment_status: "unpaid" } } };
    eq("webhook: unpaid completed → 200", (await call(stripeWebhookReq(unpaid, "whsec_right"), env)).status, 200);
    let u = await env.USERS.get("user:ach@example.com", "json");
    check("webhook: unpaid completed does not grant ad-free", !u.adFree);
    check("webhook: unpaid completed stores no stripeSubId", !u.stripeSubId);
    check("webhook: unpaid completed sends no welcome email", !emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)));
    const failed = { type: "checkout.session.async_payment_failed", data: { object: { ...session, payment_status: "unpaid" } } };
    await call(stripeWebhookReq(failed, "whsec_right"), env);
    check("webhook: async_payment_failed does not grant ad-free", !(await env.USERS.get("user:ach@example.com", "json")).adFree);
    const succeeded = { type: "checkout.session.async_payment_succeeded", data: { object: { ...session, payment_status: "paid" } } };
    eq("webhook: async_payment_succeeded → 200", (await call(stripeWebhookReq(succeeded, "whsec_right"), env)).status, 200);
    u = await env.USERS.get("user:ach@example.com", "json");
    eq("webhook: async_payment_succeeded grants ad-free", u.adFree, true);
    eq("webhook: async_payment_succeeded stores stripeSubId", u.stripeSubId, "sub_ach");
    eq("webhook: async_payment_succeeded writes reverse index", await env.USERS.get("stripecust:cus_ach"), "ach@example.com");
    check("webhook: async_payment_succeeded sends welcome email", emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)));
    // A forged/odd async success for an untagged or one-time session still grants nothing.
    await seedUser(env, "achmerch@example.com");
    const merch = { type: "checkout.session.async_payment_succeeded", data: { object: { mode: "payment", payment_status: "paid", metadata: { purpose: "merch" }, subscription: null, client_reference_id: "achmerch@example.com" } } };
    await call(stripeWebhookReq(merch, "whsec_right"), env);
    check("webhook: async success for merch does not grant ad-free", !(await env.USERS.get("user:achmerch@example.com", "json")).adFree);
  }

  // 6d4. payment_status=no_payment_required (e.g. a free trial / 100% coupon) grants
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "trial@example.com");
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "no_payment_required", metadata: { purpose: "adfree" }, subscription: "sub_t", customer: "cus_t", client_reference_id: "trial@example.com" } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: no_payment_required grants ad-free", (await env.USERS.get("user:trial@example.com", "json")).adFree, true);
    await seedUser(env, "nostatus@example.com");
    const evt2 = { type: "checkout.session.completed", data: { object: { mode: "subscription", metadata: { purpose: "adfree" }, subscription: "sub_n", client_reference_id: "nostatus@example.com" } } };
    await call(stripeWebhookReq(evt2, "whsec_right"), env);
    check("webhook: missing payment_status does not grant ad-free", !(await env.USERS.get("user:nostatus@example.com", "json")).adFree);
  }

  // 6d5. Secret rotation: several v1 signatures — accept if ANY matches
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_new" };
    await seedUser(env, "rot@example.com");
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", metadata: { purpose: "adfree" }, subscription: "sub_r", customer: "cus_r", client_reference_id: "rot@example.com" } } };
    // Matching signature first, then last — the old code kept only the last v1.
    eq("webhook: rotation (match first) → 200", (await call(stripeWebhookReq(evt, ["whsec_new", "whsec_old"]), env)).status, 200);
    eq("webhook: rotation (match last) → 200", (await call(stripeWebhookReq(evt, ["whsec_old", "whsec_new"]), env)).status, 200);
    eq("webhook: rotation grants ad-free", (await env.USERS.get("user:rot@example.com", "json")).adFree, true);
    await seedUser(env, "rot2@example.com");
    const evt2 = { ...evt, data: { object: { ...evt.data.object, client_reference_id: "rot2@example.com" } } };
    eq("webhook: rotation (none match) → 400", (await call(stripeWebhookReq(evt2, ["whsec_old", "whsec_older"]), env)).status, 400);
    eq("webhook: v0-only signature → 400", (await call(stripeWebhookReq(evt2, "whsec_new", { scheme: "v0" }), env)).status, 400);
    check("webhook: rejected rotations grant nothing", !(await env.USERS.get("user:rot2@example.com", "json")).adFree);
  }

  // 6d6. Malformed signature headers: duplicate t=, or more than 8 v1 values
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "hdr@example.com");
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", metadata: { purpose: "adfree" }, subscription: "sub_h", client_reference_id: "hdr@example.com" } } };
    const payload = JSON.stringify(evt);
    const t = Math.floor(Date.now() / 1000);
    const good = createHmac("sha256", "whsec_right").update(`${t}.${payload}`).digest("hex");
    const mk = (hdr) => ({ request: new Request(ORIGIN + "/stripe/webhook", { method: "POST", headers: { "Stripe-Signature": hdr, "Content-Type": "application/json" }, body: payload }), url: new URL(ORIGIN + "/stripe/webhook") });
    eq("webhook: duplicate t= → 400", (await call(mk(`t=${t},t=${t},v1=${good}`), env)).status, 400);
    const many = Array.from({ length: 8 }, (_, i) => `v1=${"0".repeat(63)}${i}`).join(",");
    eq("webhook: >8 v1 values → 400", (await call(mk(`t=${t},${many},v1=${good}`), env)).status, 400);
    check("webhook: malformed headers grant nothing", !(await env.USERS.get("user:hdr@example.com", "json")).adFree);
  }

  // 6d7. Legacy user (no stripeSubId): a TAGGED subscription.updated must match a
  // stored id, so a new unpaid ACH subscription going active can't grant early.
  // Untagged (legacy) subscription events still use the customer fallback.
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "legacy@example.com", { adFree: false, stripeCustomerId: "cus_l" });
    await env.USERS.put("stripecust:cus_l", "legacy@example.com");
    const tagged = { type: "customer.subscription.updated", data: { object: { id: "sub_new", customer: "cus_l", status: "active", metadata: { purpose: "adfree" } } } };
    // Realistic live state: Stripe reports the sub as this customer's and
    // "active" while the ACH first payment is still processing (invoice open).
    subCustomer = { sub_new: "cus_l" }; subInvoice = { sub_new: "open" };
    await call(stripeWebhookReq(tagged, "whsec_right"), env);
    check("webhook: legacy user + tagged unmatched sub does not grant", !(await env.USERS.get("user:legacy@example.com", "json")).adFree);
    subCustomer = {}; subInvoice = {};
    const untagged = { type: "customer.subscription.updated", data: { object: { id: "sub_old", customer: "cus_l", status: "active" } } };
    await call(stripeWebhookReq(untagged, "whsec_right"), env);
    eq("webhook: legacy user + untagged sub uses fallback", (await env.USERS.get("user:legacy@example.com", "json")).adFree, true);
  }

  // 6e. Deleting a different subscription on the same customer keeps ad-free
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right" };
    await seedUser(env, "two@example.com", { adFree: true, stripeCustomerId: "cus_2", stripeSubId: "sub_adfree" });
    await env.USERS.put("stripecust:cus_2", "two@example.com");
    const evt = { type: "customer.subscription.deleted", data: { object: { id: "sub_other", customer: "cus_2", status: "canceled" } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    eq("webhook: other sub deleted keeps ad-free", (await env.USERS.get("user:two@example.com", "json")).adFree, true);
    const evt2 = { type: "customer.subscription.deleted", data: { object: { id: "sub_adfree", customer: "cus_2", status: "canceled" } } };
    await call(stripeWebhookReq(evt2, "whsec_right"), env);
    eq("webhook: own sub deleted revokes ad-free", (await env.USERS.get("user:two@example.com", "json")).adFree, false);
  }

  // 6f. Webhook with no secret configured → 503, never verified against an empty key
  {
    const env = { USERS: makeKV() };
    await seedUser(env, "forge@example.com");
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", metadata: { purpose: "adfree" }, subscription: "sub_f", client_reference_id: "forge@example.com" } } };
    const r = await call(stripeWebhookReq(evt, ""), env);
    eq("webhook: missing secret → 503", r.status, 503);
    check("webhook: missing secret grants nothing", !(await env.USERS.get("user:forge@example.com", "json")).adFree);
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
      hero: { image: "/x.jpg", headline: "Boat?", sub: "s", showVerdict: false,
        spots: { "put-in-bay": "/api/asset/abc123", "Bad Id!": "/y.jpg", sandusky: "javascript:alert(1)", erie: "//evil.test/x.jpg", toledo: "https://tracker.test/p.jpg" } },
      takeovers: [{ sponsor: "Acme", headline: "Buy", start: "2000-01-01", end: "2999-01-01", href: "https://acme.test" }],
      gam: { networkCode: "12345678" },
      bogusField: "should be dropped",
    };
    const r = await call(req("PUT", "/api/admin/config", { cookie: admin, body: { config } }), env);
    eq("admin/config PUT: → 200", r.status, 200);
    const saved = (await r.json()).config;
    eq("admin/config PUT: hero saved", saved.hero.image, "/x.jpg");
    eq("admin/config PUT: launch photo saved", saved.hero.spots["put-in-bay"], "/api/asset/abc123");
    eq("admin/config PUT: launch photos drop bad ids and unsafe URLs", JSON.stringify(Object.keys(saved.hero.spots)), JSON.stringify(["put-in-bay"]));
    {
      const { SPOT_PHOTOS } = await import("../src/spot-photos.js");
      const bad = Object.entries(SPOT_PHOTOS).filter(([id, p]) => !/^\/spots\/[a-z0-9-]+\.jpe?g$/.test(p.src || "")
        || !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.source || "") || !p.credit || !p.license);
      check("spot photos: bundled entries are local JPEGs with a Commons source, credit and license", !bad.length, JSON.stringify(bad.slice(0, 3)));
    }
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
    eq("asset: nosniff", got.headers.get("X-Content-Type-Options"), "nosniff");
    check("asset: sandboxed CSP", /sandbox/.test(got.headers.get("Content-Security-Policy") || ""), got.headers.get("Content-Security-Policy"));
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

  // 27b. ADMIN_EMAIL takes a comma-separated list; listed admins must be verified
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: " Owner@Example.com, second@example.com ;third@example.com,not-an-email" };
    const owner = await seedUser(env, "owner@example.com");
    const second = await seedUser(env, "second@example.com", { via: "password", emailVerified: true });
    const third = await seedUser(env, "third@example.com", { via: "password" }); // legacy: no emailVerified field
    const pending = await seedUser(env, "pending@example.com", { via: "password", emailVerified: false });
    const rando = await seedUser(env, "rando2@example.com");
    eq("multi-admin: first (mixed case, padded) → 200", (await call(req("GET", "/api/admin/users", { cookie: owner }), env)).status, 200);
    eq("multi-admin: second → 200", (await call(req("GET", "/api/admin/users", { cookie: second }), env)).status, 200);
    eq("multi-admin: semicolon-separated → 200", (await call(req("GET", "/api/admin/users", { cookie: third }), env)).status, 200);
    eq("multi-admin: unlisted → 403", (await call(req("GET", "/api/admin/users", { cookie: rando }), env)).status, 403);
    eq("multi-admin: default admin not added when a list is set", (await call(req("GET", "/api/admin/users", { cookie: await seedUser(env, "seth.babcock@gmail.com") }), env)).status, 403);
    // Listed but unverified (e.g. someone registered the address before the real admin)
    env.ADMIN_EMAIL += ",pending@example.com";
    eq("multi-admin: listed but unverified → 403", (await call(req("GET", "/api/admin/users", { cookie: pending }), env)).status, 403);
    const me = await (await call(req("GET", "/auth/me", { cookie: second }), env)).json();
    eq("multi-admin: /auth/me admin flag for second admin", me.user.admin, true);
    const meP = await (await call(req("GET", "/auth/me", { cookie: pending }), env)).json();
    check("multi-admin: /auth/me no admin flag when unverified", meP.user && meP.user.admin === false, JSON.stringify(meP));
    // comp.by records whichever admin flipped it
    await seedUser(env, "fam@example.com");
    const r = await call(req("POST", "/api/admin/user", { cookie: second, body: { email: "fam@example.com", adFree: true } }), env);
    eq("multi-admin: second admin can toggle Pro", r.status, 200);
  }

  // 27c. Unset / empty ADMIN_EMAIL falls back to the default owner; set but
  // with no valid address (a typo) fails closed — nobody is admin
  {
    for (const v of [undefined, "", "   "]) {
      const env = { USERS: makeKV(), ...(v === undefined ? {} : { ADMIN_EMAIL: v }) };
      const owner = await seedUser(env, "seth.babcock@gmail.com");
      eq(`multi-admin: default owner when ADMIN_EMAIL=${JSON.stringify(v)}`, (await call(req("GET", "/api/admin/users", { cookie: owner }), env)).status, 200);
    }
    const warn = console.warn; console.warn = () => {};
    for (const v of [" , ", "someone@typo"]) {
      const env = { USERS: makeKV(), ADMIN_EMAIL: v };
      const owner = await seedUser(env, "seth.babcock@gmail.com");
      eq(`multi-admin: all-invalid ADMIN_EMAIL=${JSON.stringify(v)} locks /admin`, (await call(req("GET", "/api/admin/users", { cookie: owner }), env)).status, 403);
    }
    console.warn = warn;
  }

  // 27f. Pre-hijack: a squatter registers an address with a password and never
  // verifies; when the real owner signs in with Google, the account is promoted
  // to a verified Google account and the squatter's password is dropped
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "boss2@example.com", GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", BREVO_API_KEY: "brevo_x" };
    const reg = await call(req("POST", "/auth/register", { body: { email: "boss2@example.com", password: "Squatter-pass-123!" } }), env);
    eq("pre-hijack: squatter registration pending", reg.status, 200);
    googleIdPayload = { email: "boss2@example.com", email_verified: true };
    const cb = new URL(ORIGIN + "/auth/google/callback?code=c&state=s3");
    const r = await call({ request: new Request(cb, { headers: { cookie: "sib_oauth=s3" } }), url: cb }, env);
    eq("pre-hijack: owner Google sign-in → 302", r.status, 302);
    const u = await env.USERS.get("user:boss2@example.com", "json");
    check("pre-hijack: squatter password removed", !u.pass && !u.salt && !u.passIter, JSON.stringify(Object.keys(u)));
    eq("pre-hijack: account now verified via Google", `${u.via}/${u.emailVerified}`, "google/true");
    const login = await call(req("POST", "/auth/login", { body: { email: "boss2@example.com", password: "Squatter-pass-123!" } }), env);
    check("pre-hijack: squatter password no longer signs in", login.status === 401, String(login.status));
    const tok = /sib_session=([^;]+)/.exec(r.headers.get("Set-Cookie") || "")?.[1];
    const me = await (await call(req("GET", "/auth/me", { cookie: `sib_session=${tok}` }), env)).json();
    eq("pre-hijack: owner is admin after Google sign-in", me.user && me.user.admin, true);
    // A real member who skipped verification but used the account (Google
    // sign-in before it was checked) keeps everything, including paid Pro
    await seedUser(env, "skipper@example.com", { via: "password", emailVerified: false, pass: "h", salt: "s", adFree: true, stripeSubId: "sub_sk", stripeCustomerId: "cus_sk", favorites: ["sandusky"] });
    googleIdPayload = { email: "skipper@example.com", email_verified: true };
    const cbS = new URL(ORIGIN + "/auth/google/callback?code=c&state=s5");
    await call({ request: new Request(cbS, { headers: { cookie: "sib_oauth=s5" } }), url: cbS }, env);
    const sk = await env.USERS.get("user:skipper@example.com", "json");
    eq("pre-hijack: used unverified account keeps Pro + subscription", `${sk.adFree}/${sk.stripeSubId}/${sk.favorites[0]}`, "true/sub_sk/sandusky");
    check("pre-hijack: used unverified account promoted, password dropped", sk.emailVerified === true && !sk.pass);
    // A verified password account is NOT replaced by Google sign-in
    await seedUser(env, "keep@example.com", { via: "password", emailVerified: true, pass: "h", salt: "s", prefs: { boatName: "mine" } });
    googleIdPayload = { email: "keep@example.com", email_verified: true };
    const cb2 = new URL(ORIGIN + "/auth/google/callback?code=c&state=s4");
    await call({ request: new Request(cb2, { headers: { cookie: "sib_oauth=s4" } }), url: cb2 }, env);
    const k = await env.USERS.get("user:keep@example.com", "json");
    eq("pre-hijack: verified account kept as-is", `${k.pass}/${k.prefs.boatName}`, "h/mine");
    googleIdPayload = null;
  }

  // 27g. Daily cleanup removes password sign-ups never confirmed within 48h
  {
    const env = { USERS: makeKV() };
    const now = new Date("2026-11-10T10:00:00Z");
    await seedUser(env, "stale-squat@example.com", { via: "password", emailVerified: false, created: "2026-11-07T09:00:00Z" });
    await seedUser(env, "fresh-pending@example.com", { via: "password", emailVerified: false, created: "2026-11-09T12:00:00Z" });
    await seedUser(env, "legacy-old@example.com", { via: "password", created: "2025-01-01T00:00:00Z" }); // no emailVerified field
    await seedUser(env, "verified-old@example.com", { via: "password", emailVerified: true, created: "2025-01-01T00:00:00Z" });
    await seedUser(env, "used-unverified@example.com", { via: "password", emailVerified: false, created: "2026-10-01T00:00:00Z", adFree: true, stripeSubId: "sub_u", favorites: ["sandusky"] });
    await seedUser(env, "old-nocreated@example.com", { via: "password", emailVerified: false, created: null });
    await runScheduled(env, 15, now); // not the digest hour → no cleanup
    check("cleanup: only on the daily digest run", !!(await env.USERS.get("user:stale-squat@example.com")));
    await runScheduled(env, 10, now);
    check("cleanup: stale unverified sign-up removed", !(await env.USERS.get("user:stale-squat@example.com")));
    check("cleanup: recent unverified sign-up kept", !!(await env.USERS.get("user:fresh-pending@example.com")));
    check("cleanup: legacy (grandfathered) account kept", !!(await env.USERS.get("user:legacy-old@example.com")));
    check("cleanup: verified account kept", !!(await env.USERS.get("user:verified-old@example.com")));
    check("cleanup: unverified account with signs of use kept", !!(await env.USERS.get("user:used-unverified@example.com")));
    check("cleanup: record without a created date kept", !!(await env.USERS.get("user:old-nocreated@example.com")));
  }

  // 27h. Verifying a listed admin address by email drops the password set at
  // registration (it may be a squatter's); the clicker still gets a session
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "newadmin@example.com", BREVO_API_KEY: "brevo_x" };
    await call(req("POST", "/auth/register", { body: { email: "newadmin@example.com", password: "Squatter-pass-123!" } }), env);
    const vkey = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:") && env.USERS._map.get(k) === "newadmin@example.com");
    const r = await call(req("POST", "/auth/verify", { body: { token: vkey.slice(7) } }), env);
    eq("admin verify: → 200", r.status, 200);
    check("admin verify: session issued", /sib_session=/.test(r.headers.get("Set-Cookie") || ""));
    check("admin verify: registration password dropped", !(await env.USERS.get("user:newadmin@example.com", "json")).pass);
    eq("admin verify: old password can't sign in", (await call(req("POST", "/auth/login", { body: { email: "newadmin@example.com", password: "Squatter-pass-123!" } }), env)).status, 401);
    // ...and the admin can set their own via Forgot password (not locked out)
    await call(req("POST", "/auth/forgot", { body: { email: "newadmin@example.com" } }), env);
    const rkey = [...env.USERS._map.keys()].find((k) => k.startsWith("reset:") && env.USERS._map.get(k) === "newadmin@example.com");
    check("admin verify: forgot password sends a reset link", !!rkey);
    eq("admin verify: reset → 200", (await call(req("POST", "/auth/reset", { body: { token: rkey.slice(6), password: "Owner-chosen-123!" } }), env)).status, 200);
    eq("admin verify: owner's new password signs in", (await call(req("POST", "/auth/login", { body: { email: "newadmin@example.com", password: "Owner-chosen-123!" } }), env)).status, 200);
    // Google accounts still get no reset link
    await seedUser(env, "googly@example.com", { via: "google", emailVerified: true });
    await call(req("POST", "/auth/forgot", { body: { email: "googly@example.com" } }), env);
    check("forgot: Google account gets no reset link", ![...env.USERS._map.entries()].some(([k, v]) => k.startsWith("reset:") && v === "googly@example.com"));
    // A normal (non-admin) address keeps its password on verify
    await call(req("POST", "/auth/register", { body: { email: "normal@example.com", password: "Normal-pass-123!" } }), env);
    const nkey = [...env.USERS._map.keys()].find((k) => k.startsWith("verify:") && env.USERS._map.get(k) === "normal@example.com");
    await call(req("POST", "/auth/verify", { body: { token: nkey.slice(7) } }), env);
    eq("verify: normal address keeps its password", (await call(req("POST", "/auth/login", { body: { email: "normal@example.com", password: "Normal-pass-123!" } }), env)).status, 200);
  }

  // 27d. Admin notifications go to every listed admin when no notifyEmails are configured
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "a1@example.com,a2@example.com", BREVO_API_KEY: "brevo_x", GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec" };
    emailCalls = [];
    googleIdPayload = { email: "newbie@example.com", email_verified: true };
    const cb = new URL(ORIGIN + "/auth/google/callback?code=c&state=s1");
    const r = await call({ request: new Request(cb, { headers: { cookie: "sib_oauth=s1" } }), url: cb }, env);
    eq("google: verified email → signed in (302)", r.status, 302);
    const signup = emailCalls.find((c) => /New shouldiboat.com signup/.test(c.subject));
    const to = signup ? signup.to.map((x) => x.email).sort() : [];
    eq("multi-admin: signup notice goes to every admin", JSON.stringify(to), JSON.stringify(["a1@example.com", "a2@example.com"]));
  }

  // 27e. Google sign-in refuses an address Google hasn't verified
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "boss@example.com", GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec" };
    for (const claim of [false, undefined]) {
      googleIdPayload = { email: "boss@example.com", ...(claim === undefined ? {} : { email_verified: claim }) };
      const cb = new URL(ORIGIN + "/auth/google/callback?code=c&state=s2");
      const r = await call({ request: new Request(cb, { headers: { cookie: "sib_oauth=s2" } }), url: cb }, env);
      eq(`google: email_verified=${claim} → 403`, r.status, 403);
      check(`google: email_verified=${claim} sets no session`, !r.headers.get("Set-Cookie"));
    }
    check("google: unverified creates no account", !(await env.USERS.get("user:boss@example.com", "json")));
    googleIdPayload = null;
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
    const evt = { type: "checkout.session.completed", data: { object: { mode: "subscription", payment_status: "paid", metadata: { purpose: "adfree" }, client_reference_id: "newpaid@example.com", customer: "cus_9", subscription: "sub_9" } } };
    await call(stripeWebhookReq(evt, "whsec_right"), env);
    check("webhook: sends Pro welcome email", emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)), JSON.stringify(emailCalls.map((c) => c.subject)));
    const notifs = [...env.USERS._map.keys()].filter((k) => k.startsWith("admin:notification:")).map((k) => JSON.parse(env.USERS._map.get(k)));
    check("webhook: adfree_activated notification logged", notifs.some((n) => n.type === "adfree_activated"), JSON.stringify(notifs.map((n) => n.type)));
  }

  // 35b. Redeliveries: Stripe retries for up to 3 days with a fresh signature
  // timestamp. A checkout event retried after cancellation must not re-grant;
  // a repeated event id is a no-op; redelivery sends only one welcome email.
  {
    const env = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right", STRIPE_SECRET_KEY: "sk_test_x", BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "redeliver@example.com");
    emailCalls = []; stripeCalls = []; subStatus = {}; subCustomer = { sub_rd: "cus_rd" };
    const session = { mode: "subscription", payment_status: "paid", metadata: { purpose: "adfree" }, client_reference_id: "redeliver@example.com", customer: "cus_rd", subscription: "sub_rd" };
    const completed = { id: "evt_rd_1", type: "checkout.session.completed", data: { object: session } };
    eq("redelivery: first completed → 200", (await call(stripeWebhookReq(completed, "whsec_right"), env)).status, 200);
    check("redelivery: grant retrieves the subscription from Stripe", stripeCalls.some((c) => c.method === "GET" && c.url.endsWith("/v1/subscriptions/sub_rd")), JSON.stringify(stripeCalls.map((c) => c.url)));
    eq("redelivery: first completed grants ad-free", (await env.USERS.get("user:redeliver@example.com", "json")).adFree, true);
    check("redelivery: event id recorded", !!(await env.USERS.get("stripecust:cus_rd")) && !!(await env.USERS.get("stripeevt:evt_rd_1")));

    // Same event id again → no-op (no Stripe call, no email, no write).
    stripeCalls = [];
    const dup = await call(stripeWebhookReq(completed, "whsec_right"), env);
    eq("dedupe: duplicate event id → 200", dup.status, 200);
    eq("dedupe: duplicate flagged", (await dup.json()).duplicate, true);
    eq("dedupe: duplicate makes no Stripe call", stripeCalls.length, 0);

    // A different event id for the same, already-granted session (e.g.
    // completed then async_payment_succeeded) → still only one welcome email.
    const again = { id: "evt_rd_2", type: "checkout.session.async_payment_succeeded", data: { object: session } };
    eq("redelivery: second event for same session → 200", (await call(stripeWebhookReq(again, "whsec_right"), env)).status, 200);
    eq("redelivery: only one welcome email", emailCalls.filter((c) => /Welcome to shouldiboat Pro/i.test(c.subject)).length, 1);
    eq("redelivery: one adfree_activated notification", [...env.USERS._map.keys()].filter((k) => k.startsWith("admin:notification:")).map((k) => JSON.parse(env.USERS._map.get(k))).filter((n) => n.type === "adfree_activated").length, 1);

    // Cancel → revoked. Then a retried completed (new event id, as when the
    // first delivery failed) arrives: Stripe now reports the sub canceled.
    const deleted = { id: "evt_rd_3", type: "customer.subscription.deleted", data: { object: { id: "sub_rd", customer: "cus_rd", status: "canceled", metadata: { purpose: "adfree" } } } };
    await call(stripeWebhookReq(deleted, "whsec_right"), env);
    eq("redelivery: deletion revokes ad-free", (await env.USERS.get("user:redeliver@example.com", "json")).adFree, false);
    subStatus.sub_rd = "canceled";
    emailCalls = [];
    const late = { id: "evt_rd_late", type: "checkout.session.completed", data: { object: session } };
    const lr = await call(stripeWebhookReq(late, "whsec_right"), env);
    eq("redelivery after deletion → 200", lr.status, 200);
    eq("redelivery after deletion: ignored", (await lr.json()).ignored, true);
    eq("redelivery after deletion does NOT re-grant", (await env.USERS.get("user:redeliver@example.com", "json")).adFree, false);
    check("redelivery after deletion sends no email", !emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)));
    check("redelivery after deletion is recorded (not retried)", !!(await env.USERS.get("stripeevt:evt_rd_late")));

    // Subscription gone entirely (404) → no grant.
    await seedUser(env, "gone@example.com");
    subStatus.sub_gone = "missing";
    const gone = { id: "evt_gone", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "gone@example.com", customer: "cus_gone", subscription: "sub_gone" } } };
    eq("missing subscription → 200", (await call(stripeWebhookReq(gone, "whsec_right"), env)).status, 200);
    eq("missing subscription does NOT grant", (await env.USERS.get("user:gone@example.com", "json")).adFree, false);

    // Live subscription but for a different customer than the session → no grant.
    await seedUser(env, "mixup@example.com");
    subCustomer.sub_mix = "cus_someone_else";
    const mix = { id: "evt_mix", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "mixup@example.com", customer: "cus_mix", subscription: "sub_mix" } } };
    await call(stripeWebhookReq(mix, "whsec_right"), env);
    eq("customer mismatch does NOT grant", (await env.USERS.get("user:mixup@example.com", "json")).adFree, false);

    // Trialing counts as live.
    await seedUser(env, "trial@example.com");
    subStatus.sub_trial = "trialing";
    const trial = { id: "evt_trial", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "trial@example.com", customer: "cus_trial", subscription: "sub_trial" } } };
    await call(stripeWebhookReq(trial, "whsec_right"), env);
    eq("trialing subscription grants", (await env.USERS.get("user:trial@example.com", "json")).adFree, true);

    // Stripe unreachable → fail closed with 503, no grant, event NOT recorded
    // (so Stripe's retry is processed once Stripe is back).
    await seedUser(env, "outage@example.com");
    const outage = { id: "evt_outage", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "outage@example.com", customer: "cus_out", subscription: "sub_out" } } };
    stripeDown = true;
    const or = await call(stripeWebhookReq(outage, "whsec_right"), env);
    stripeDown = false;
    eq("stripe down → 503", or.status, 503);
    eq("stripe down: no grant", (await env.USERS.get("user:outage@example.com", "json")).adFree, false);
    check("stripe down: event not recorded", !(await env.USERS.get("stripeevt:evt_outage")));
    eq("stripe back: retry → 200", (await call(stripeWebhookReq(outage, "whsec_right"), env)).status, 200);
    eq("stripe back: retry grants", (await env.USERS.get("user:outage@example.com", "json")).adFree, true);

    // A stale `updated` (status active) retried after `deleted` must not re-grant.
    await seedUser(env, "stale@example.com", { adFree: false, stripeCustomerId: "cus_st", stripeSubId: "sub_st" });
    await env.USERS.put("stripecust:cus_st", "stale@example.com");
    subStatus.sub_st = "canceled";
    const staleUpd = { id: "evt_st", type: "customer.subscription.updated", data: { object: { id: "sub_st", customer: "cus_st", status: "active", metadata: { purpose: "adfree" } } } };
    eq("stale updated → 200", (await call(stripeWebhookReq(staleUpd, "whsec_right"), env)).status, 200);
    eq("stale updated after deletion does NOT re-grant", (await env.USERS.get("user:stale@example.com", "json")).adFree, false);
    subStatus.sub_st = "past_due";
    await call(stripeWebhookReq({ ...staleUpd, id: "evt_st2" }, "whsec_right"), env);
    eq("updated with live past_due keeps ad-free on", (await env.USERS.get("user:stale@example.com", "json")).adFree, true);
    stripeDown = true;
    const sd = await call(stripeWebhookReq({ ...staleUpd, id: "evt_st3" }, "whsec_right"), env);
    stripeDown = false;
    eq("updated grant with Stripe down → 503", sd.status, 503);

    // A paid checkout whose sub is past_due at delivery: no grant, but the
    // reverse index is written so a later `updated` (active) can grant.
    await seedUser(env, "pastdue@example.com");
    subStatus.sub_pd = "past_due";
    emailCalls = [];
    const pd = { id: "evt_pd", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "pastdue@example.com", customer: "cus_pd", subscription: "sub_pd" } } };
    await call(stripeWebhookReq(pd, "whsec_right"), env);
    eq("past_due at checkout: no grant", (await env.USERS.get("user:pastdue@example.com", "json")).adFree, false);
    eq("past_due at checkout: reverse index written", await env.USERS.get("stripecust:cus_pd"), "pastdue@example.com");
    check("past_due at checkout: no welcome email", !emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)));
    // No customer on the live sub → can't confirm the match → nothing stored.
    eq("past_due at checkout without customer match: stripeSubId not stored", (await env.USERS.get("user:pastdue@example.com", "json")).stripeSubId, undefined);
    // With a confirmed customer, the sub is recorded (not granted) so the
    // tagged subscription.updated that follows payment can grant.
    subCustomer.sub_pd = "cus_pd";
    await call(stripeWebhookReq({ ...pd, id: "evt_pd_retry" }, "whsec_right"), env);
    let pdu = await env.USERS.get("user:pastdue@example.com", "json");
    eq("past_due at checkout: still not granted", pdu.adFree, false);
    eq("past_due at checkout: stripeSubId stored", pdu.stripeSubId, "sub_pd");
    eq("past_due at checkout: stripeCustomerId stored", pdu.stripeCustomerId, "cus_pd");
    subStatus.sub_pd = "active";
    const paidUp = { id: "evt_pd_upd", type: "customer.subscription.updated", data: { object: { id: "sub_pd", customer: "cus_pd", status: "active", metadata: { purpose: "adfree" } } } };
    eq("past_due → active update → 200", (await call(stripeWebhookReq(paidUp, "whsec_right"), env)).status, 200);
    eq("past_due → active update grants ad-free", (await env.USERS.get("user:pastdue@example.com", "json")).adFree, true);

    // A canceled-at-delivery checkout must not overwrite the user's current sub.
    await seedUser(env, "current@example.com", { adFree: true, stripeCustomerId: "cus_cur", stripeSubId: "sub_cur_live" });
    subStatus.sub_cur_old = "canceled"; subCustomer.sub_cur_old = "cus_cur";
    await call(stripeWebhookReq({ id: "evt_cur_old", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "current@example.com", customer: "cus_cur", subscription: "sub_cur_old" } } }, "whsec_right"), env);
    let cu = await env.USERS.get("user:current@example.com", "json");
    eq("canceled checkout retry keeps current stripeSubId", cu.stripeSubId, "sub_cur_live");
    eq("canceled checkout retry keeps ad-free", cu.adFree, true);
    // Nor may a recoverable (past_due) other sub replace a granting one.
    subStatus.sub_cur_pd = "past_due"; subCustomer.sub_cur_pd = "cus_cur";
    await call(stripeWebhookReq({ id: "evt_cur_pd", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "current@example.com", customer: "cus_cur", subscription: "sub_cur_pd" } } }, "whsec_right"), env);
    eq("past_due other-sub checkout keeps current stripeSubId", (await env.USERS.get("user:current@example.com", "json")).stripeSubId, "sub_cur_live");

    // F1: two checkouts (two tabs) leave subs A (older) and B (newer) both
    // pending. B is stored; a stale retry for A must not displace it while B
    // is still in grace (R1). When B is paid, its `updated` grants.
    await seedUser(env, "twotabs@example.com");
    subStatus.sub_tA = "past_due"; subCustomer.sub_tA = "cus_tt";
    subStatus.sub_tB = "past_due"; subCustomer.sub_tB = "cus_tt";
    const tabSess = (sub) => ({ ...session, client_reference_id: "twotabs@example.com", customer: "cus_tt", subscription: sub });
    await call(stripeWebhookReq({ id: "evt_tB", type: "checkout.session.completed", data: { object: tabSess("sub_tB") } }, "whsec_right"), env);
    await call(stripeWebhookReq({ id: "evt_tA_retry", type: "checkout.session.completed", data: { object: tabSess("sub_tA") } }, "whsec_right"), env);
    eq("two tabs: stale retry for A doesn't displace pending B (R1)", (await env.USERS.get("user:twotabs@example.com", "json")).stripeSubId, "sub_tB");
    emailCalls = [];
    subStatus.sub_tB = "active";
    const bPaid = { id: "evt_tB_upd", type: "customer.subscription.updated", data: { object: { id: "sub_tB", customer: "cus_tt", status: "active", metadata: { purpose: "adfree" } } } };
    eq("two tabs: B paid update → 200", (await call(stripeWebhookReq(bPaid, "whsec_right"), env)).status, 200);
    let tt = await env.USERS.get("user:twotabs@example.com", "json");
    eq("two tabs: B adopted → ad-free granted", tt.adFree, true);
    eq("two tabs: B adopted → stripeSubId = B", tt.stripeSubId, "sub_tB");
    eq("two tabs: adoption sends one welcome email", emailCalls.filter((c) => /Welcome to shouldiboat Pro/i.test(c.subject)).length, 1);
    // Now granting via B: A's later updates/deletes and stale retries don't touch it.
    subStatus.sub_tA = "canceled";
    await call(stripeWebhookReq({ id: "evt_tA_del", type: "customer.subscription.deleted", data: { object: { id: "sub_tA", customer: "cus_tt", status: "canceled", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    await call(stripeWebhookReq({ id: "evt_tA_retry2", type: "checkout.session.completed", data: { object: tabSess("sub_tA") } }, "whsec_right"), env);
    tt = await env.USERS.get("user:twotabs@example.com", "json");
    eq("two tabs: A deleted/retried after → still ad-free", tt.adFree, true);
    eq("two tabs: A deleted/retried after → stripeSubId stays B", tt.stripeSubId, "sub_tB");

    // Adoption guards: event says active but Stripe says canceled → no grant.
    await seedUser(env, "adoptstale@example.com", { stripeCustomerId: "cus_as", stripeSubId: "sub_as_old" });
    await env.USERS.put("stripecust:cus_as", "adoptstale@example.com");
    subStatus.sub_as_new = "canceled"; subCustomer.sub_as_new = "cus_as";
    await call(stripeWebhookReq({ id: "evt_as", type: "customer.subscription.updated", data: { object: { id: "sub_as_new", customer: "cus_as", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    eq("adopt: live canceled → no grant", (await env.USERS.get("user:adoptstale@example.com", "json")).adFree, false);
    // Untagged sub on the customer → not adopted.
    subStatus.sub_as_untag = "active"; subCustomer.sub_as_untag = "cus_as";
    await call(stripeWebhookReq({ id: "evt_as_u", type: "customer.subscription.updated", data: { object: { id: "sub_as_untag", customer: "cus_as", status: "active" } } }, "whsec_right"), env);
    eq("adopt: untagged sub → no grant", (await env.USERS.get("user:adoptstale@example.com", "json")).adFree, false);
    // Live sub belongs to another customer → no grant.
    subStatus.sub_as_x = "active"; subCustomer.sub_as_x = "cus_other";
    await call(stripeWebhookReq({ id: "evt_as_x", type: "customer.subscription.updated", data: { object: { id: "sub_as_x", customer: "cus_as", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    eq("adopt: live customer mismatch → no grant", (await env.USERS.get("user:adoptstale@example.com", "json")).adFree, false);
    // ACH first payment still processing: sub "active" but invoice open → no grant.
    subStatus.sub_as_ach = "active"; subCustomer.sub_as_ach = "cus_as"; subInvoice.sub_as_ach = "open";
    stripeCalls = [];
    await call(stripeWebhookReq({ id: "evt_as_ach", type: "customer.subscription.updated", data: { object: { id: "sub_as_ach", customer: "cus_as", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    eq("adopt: invoice still open (ACH processing) → no grant", (await env.USERS.get("user:adoptstale@example.com", "json")).adFree, false);
    check("adopt: retrieves sub with latest_invoice expanded", stripeCalls.some((c) => c.url.includes("sub_as_ach") && decodeURIComponent(c.url).includes("expand[]=latest_invoice")), JSON.stringify(stripeCalls.map((c) => c.url)));
    subInvoice.sub_as_ach = "paid";
    await call(stripeWebhookReq({ id: "evt_as_ach2", type: "customer.subscription.updated", data: { object: { id: "sub_as_ach", customer: "cus_as", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    eq("adopt: invoice paid → grant", (await env.USERS.get("user:adoptstale@example.com", "json")).adFree, true);
    await env.USERS.put("user:adoptstale@example.com", JSON.stringify({ ...(await env.USERS.get("user:adoptstale@example.com", "json")), adFree: false, stripeSubId: "sub_as_old" }));
    // Stripe down during adoption → 503.
    stripeDown = true;
    const ad = await call(stripeWebhookReq({ id: "evt_as_down", type: "customer.subscription.updated", data: { object: { id: "sub_as_x", customer: "cus_as", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    stripeDown = false;
    eq("adopt: Stripe down → 503", ad.status, 503);
    // Already ad-free via another sub → a second live sub isn't adopted.
    await seedUser(env, "hasone@example.com", { adFree: true, stripeCustomerId: "cus_h1", stripeSubId: "sub_h1" });
    await env.USERS.put("stripecust:cus_h1", "hasone@example.com");
    subStatus.sub_h2 = "active"; subCustomer.sub_h2 = "cus_h1";
    await call(stripeWebhookReq({ id: "evt_h2", type: "customer.subscription.updated", data: { object: { id: "sub_h2", customer: "cus_h1", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    eq("adopt: already ad-free → stripeSubId unchanged", (await env.USERS.get("user:hasone@example.com", "json")).stripeSubId, "sub_h1");

    // G1: paying for two subs (A recorded, B also live). A ends → switch to B
    // instead of revoking, and alert the admins.
    {
      const genv = { USERS: makeKV(), STRIPE_WEBHOOK_SECRET: "whsec_right", STRIPE_SECRET_KEY: "sk_test_x", BREVO_API_KEY: "brevo_x", ADMIN_EMAIL: "owner@example.com" };
      const seedTwo = async (em, cus) => {
        await seedUser(genv, em, { adFree: true, stripeCustomerId: cus, stripeSubId: `${cus}_A` });
        await genv.USERS.put(`stripecust:${cus}`, em);
      };
      const delA = (cus, id) => ({ id, type: "customer.subscription.deleted", data: { object: { id: `${cus}_A`, customer: cus, status: "canceled", metadata: { purpose: "adfree" } } } });
      await seedTwo("double@example.com", "cus_g1");
      subList.cus_g1 = [{ id: "cus_g1_A", status: "canceled", purpose: "adfree" }, { id: "cus_g1_B", status: "active", purpose: "adfree" }];
      emailCalls = [];
      eq("G1: recorded sub deleted → 200", (await call(stripeWebhookReq(delA("cus_g1", "evt_g1"), "whsec_right"), genv)).status, 200);
      let g = await genv.USERS.get("user:double@example.com", "json");
      eq("G1: still ad-free via the other live sub", g.adFree, true);
      eq("G1: stripeSubId switched to B", g.stripeSubId, "cus_g1_B");
      check("G1: admins alerted about the double subscription", emailCalls.some((c) => /Double Pro subscription/i.test(c.subject) && (c.to || []).some((r) => r.email === "owner@example.com")), JSON.stringify(emailCalls.map((c) => c.subject)));
      check("G1: user gets no welcome email on switch", !emailCalls.some((c) => /Welcome to shouldiboat Pro/i.test(c.subject)));
      // Then B ends too, nothing else live → revoked.
      subList.cus_g1 = [{ id: "cus_g1_A", status: "canceled", purpose: "adfree" }, { id: "cus_g1_B", status: "canceled", purpose: "adfree" }];
      await call(stripeWebhookReq({ id: "evt_g1_b", type: "customer.subscription.deleted", data: { object: { id: "cus_g1_B", customer: "cus_g1", status: "canceled", metadata: { purpose: "adfree" } } } }, "whsec_right"), genv);
      eq("G1: last sub ends → revoked", (await genv.USERS.get("user:double@example.com", "json")).adFree, false);

      // Non-qualifying others don't keep ad-free: unpaid invoice, untagged, past_due.
      for (const [label, other] of [
        ["open invoice", { id: "x", status: "active", purpose: "adfree", invoice: "open" }],
        ["untagged", { id: "x", status: "active" }],
        ["past_due", { id: "x", status: "past_due", purpose: "adfree" }],
      ]) {
        const cus = `cus_g1_${label.replace(/\W/g, "")}`;
        await seedTwo(`g1${label.replace(/\W/g, "")}@example.com`, cus);
        subList[cus] = [{ ...other, id: `${cus}_B` }];
        await call(stripeWebhookReq(delA(cus, `evt_${cus}`), "whsec_right"), genv);
        eq(`G1: other sub ${label} → revoked`, (await genv.USERS.get(`user:g1${label.replace(/\W/g, "")}@example.com`, "json")).adFree, false);
      }
      // H1: list endpoint down → 503 so Stripe retries; user keeps ad-free
      // meanwhile; event not recorded. When Stripe recovers, the retry switches.
      await seedTwo("g1retry@example.com", "cus_g1r");
      subList.cus_g1r = [{ id: "cus_g1r_B", status: "active", purpose: "adfree" }];
      subListDown = true;
      const gr = await call(stripeWebhookReq(delA("cus_g1r", "evt_g1r"), "whsec_right"), genv);
      eq("H1: list down → 503", gr.status, 503);
      eq("H1: list down → ad-free kept while retrying", (await genv.USERS.get("user:g1retry@example.com", "json")).adFree, true);
      check("H1: list down → event not recorded", !(await genv.USERS.get("stripeevt:evt_g1r")));
      eq("H1: still down on a retry within 24h → 503", (await call(stripeWebhookReq(delA("cus_g1r", "evt_g1r"), "whsec_right"), genv)).status, 503);
      subListDown = false;
      eq("H1: Stripe back → retry 200", (await call(stripeWebhookReq(delA("cus_g1r", "evt_g1r"), "whsec_right"), genv)).status, 200);
      let gru = await genv.USERS.get("user:g1retry@example.com", "json");
      eq("H1: Stripe back → switched to B, still ad-free", gru.adFree && gru.stripeSubId, "cus_g1r_B");

      // H1 bound: failing for over 24h → revoke anyway (Stripe stops retrying
      // after ~3 days, so 503 forever would leave a canceled user ad-free).
      await seedTwo("g1down@example.com", "cus_g1d");
      subList.cus_g1d = [{ id: "cus_g1d_B", status: "active", purpose: "adfree" }];
      subListDown = true;
      eq("H1: first failure → 503", (await call(stripeWebhookReq(delA("cus_g1d", "evt_g1d"), "whsec_right"), genv)).status, 503);
      await genv.USERS.put("stripeevtfail:evt_g1d", String(Date.now() - 25 * 3600e3)); // first failure 25h ago
      const gd = await call(stripeWebhookReq(delA("cus_g1d", "evt_g1d"), "whsec_right"), genv);
      subListDown = false;
      eq("H1: failing >24h → 200", gd.status, 200);
      eq("H1: failing >24h → revoked", (await genv.USERS.get("user:g1down@example.com", "json")).adFree, false);
      check("H1: failing >24h → event recorded", !!(await genv.USERS.get("stripeevt:evt_g1d")));
      // ...and B's next updated re-adopts it (F1 path).
      subStatus.cus_g1d_B = "active"; subCustomer.cus_g1d_B = "cus_g1d";
      await call(stripeWebhookReq({ id: "evt_g1d_upd", type: "customer.subscription.updated", data: { object: { id: "cus_g1d_B", customer: "cus_g1d", status: "active", metadata: { purpose: "adfree" } } } }, "whsec_right"), genv);
      eq("G1: other sub's next update re-adopts", (await genv.USERS.get("user:g1down@example.com", "json")).adFree, true);
      // A non-recorded sub's deletion never triggers the lookup.
      stripeCalls = [];
      await call(stripeWebhookReq({ id: "evt_g1_other", type: "customer.subscription.deleted", data: { object: { id: "sub_unrelated", customer: "cus_g1d", status: "canceled", metadata: { purpose: "adfree" } } } }, "whsec_right"), genv);
      check("G1: unrelated sub deletion makes no list call", !stripeCalls.some((c) => /\/v1\/subscriptions\?/.test(c.url)));
      eq("G1: unrelated sub deletion keeps ad-free", (await genv.USERS.get("user:g1down@example.com", "json")).adFree, true);
      subList = {};
    }

    // --- Stored-sub live check, duplicate alert, lookup-failure alert ---
    const notes = () => [...env.USERS._map.keys()].filter((k) => k.startsWith("admin:notification:")).map((k) => JSON.parse(env.USERS._map.get(k)));
    const ck = (id, who, cus, sub) => ({ id, type: "checkout.session.completed", data: { object: { ...session, client_reference_id: who, customer: cus, subscription: sub } } });

    // R2: admin revoked ad-free but the stored sub is still active → a stale
    // past_due checkout doesn't displace it.
    await seedUser(env, "r2@example.com", { adFree: false, stripeCustomerId: "cus_r2", stripeSubId: "sub_r2A" });
    subStatus.sub_r2A = "active"; subStatus.sub_r2B = "past_due"; subCustomer.sub_r2B = "cus_r2";
    await call(stripeWebhookReq(ck("evt_r2", "r2@example.com", "cus_r2", "sub_r2B"), "whsec_right"), env);
    eq("R2: active stored sub not displaced after admin revoke", (await env.USERS.get("user:r2@example.com", "json")).stripeSubId, "sub_r2A");

    // Stored sub ended (unpaid) → a newer past_due checkout does replace it.
    await seedUser(env, "r1b@example.com", { adFree: false, stripeCustomerId: "cus_r1b", stripeSubId: "sub_r1bB" });
    subStatus.sub_r1bB = "unpaid"; subStatus.sub_r1bC = "past_due"; subCustomer.sub_r1bC = "cus_r1b";
    await call(stripeWebhookReq(ck("evt_r1b", "r1b@example.com", "cus_r1b", "sub_r1bC"), "whsec_right"), env);
    eq("unpaid stored sub replaced by newer past_due sub", (await env.USERS.get("user:r1b@example.com", "json")).stripeSubId, "sub_r1bC");

    // Stored-sub lookup fails on the recoverable path → 503, nothing stored, not recorded.
    await seedUser(env, "r3@example.com", { adFree: false, stripeCustomerId: "cus_r3", stripeSubId: "sub_r3A" });
    subStatus.sub_r3B = "past_due"; subCustomer.sub_r3B = "cus_r3";
    stripeFailIds = new Set(["sub_r3A"]);
    const r3 = await call(stripeWebhookReq(ck("evt_r3", "r3@example.com", "cus_r3", "sub_r3B"), "whsec_right"), env);
    stripeFailIds = new Set();
    eq("stored-sub lookup error → 503", r3.status, 503);
    check("stored-sub lookup error: event not recorded", !(await env.USERS.get("stripeevt:evt_r3")));
    eq("stored-sub lookup error: nothing stored", (await env.USERS.get("user:r3@example.com", "json")).stripeSubId, "sub_r3A");

    // L1: already ad-free on active A; a second paid checkout B → ad-free
    // follows B (main's rule) and the admins are told about the duplicate.
    await seedUser(env, "dup@example.com", { adFree: true, stripeCustomerId: "cus_dup", stripeSubId: "sub_dupA" });
    subStatus.sub_dupA = "active"; subCustomer.sub_dupB = "cus_dup";
    emailCalls = [];
    eq("L1: duplicate checkout → 200", (await call(stripeWebhookReq(ck("evt_dup", "dup@example.com", "cus_dup", "sub_dupB"), "whsec_right"), env)).status, 200);
    const dupU = await env.USERS.get("user:dup@example.com", "json");
    eq("L1: tracks the new sub", dupU.stripeSubId, "sub_dupB");
    eq("L1: still ad-free", dupU.adFree, true);
    check("L1: admin emailed about duplicate", emailCalls.some((c) => /Duplicate shouldiboat Pro subscription/.test(c.subject)), JSON.stringify(emailCalls.map((c) => c.subject)));
    const dn = notes().find((n) => n.type === "adfree_duplicate_subscription" && n.email === "dup@example.com");
    check("L1: notice names both subs", dn && dn.trackedSub === "sub_dupB" && dn.otherSub === "sub_dupA" && dn.otherStatus === "active", JSON.stringify(dn));
    // If B ends first, main's switch-back logic finds A (still live, paid).
    subList = { cus_dup: [{ id: "sub_dupA", status: "active", purpose: "adfree", invoice: "paid" }] };
    await env.USERS.put("stripecust:cus_dup", "dup@example.com");
    await call(stripeWebhookReq({ id: "evt_dupB_del", type: "customer.subscription.deleted", data: { object: { id: "sub_dupB", customer: "cus_dup", status: "canceled", metadata: { purpose: "adfree" } } } }, "whsec_right"), env);
    const dupU2 = await env.USERS.get("user:dup@example.com", "json");
    check("L1: B ends → ad-free follows A", dupU2.adFree === true && dupU2.stripeSubId === "sub_dupA", JSON.stringify(dupU2));
    subList = {};

    // Duplicate check is alert-only: a failing stored-sub lookup never blocks the grant.
    await seedUser(env, "dupdown@example.com", { adFree: false, stripeCustomerId: "cus_dd", stripeSubId: "sub_ddA" });
    subCustomer.sub_ddB = "cus_dd";
    stripeFailIds = new Set(["sub_ddA"]);
    const dd = await call(stripeWebhookReq(ck("evt_dd", "dupdown@example.com", "cus_dd", "sub_ddB"), "whsec_right"), env);
    stripeFailIds = new Set();
    eq("dup check lookup error: still 200", dd.status, 200);
    eq("dup check lookup error: still grants", (await env.USERS.get("user:dupdown@example.com", "json")).adFree, true);

    // Re-subscribe after the old sub ended: no duplicate notice.
    await seedUser(env, "resub@example.com", { adFree: false, stripeCustomerId: "cus_rs", stripeSubId: "sub_rsOld" });
    subStatus.sub_rsOld = "canceled"; subCustomer.sub_rsNew = "cus_rs";
    await call(stripeWebhookReq(ck("evt_rs", "resub@example.com", "cus_rs", "sub_rsNew"), "whsec_right"), env);
    eq("re-subscribe: grants", (await env.USERS.get("user:resub@example.com", "json")).adFree, true);
    check("re-subscribe: no duplicate notice", !notes().some((n) => n.type === "adfree_duplicate_subscription" && n.email === "resub@example.com"));

    // Lookup keeps failing → admins alerted once, on the 3rd failed delivery.
    await seedUser(env, "lf@example.com");
    subCustomer.sub_lf = "cus_lf";
    stripeFailIds = new Set(["sub_lf"]);
    emailCalls = [];
    const lfEvt = ck("evt_lf", "lf@example.com", "cus_lf", "sub_lf");
    const alerts = () => emailCalls.filter((c) => /lookup keeps failing/.test(c.subject)).length;
    eq("lookup failing: 1st → 503", (await call(stripeWebhookReq(lfEvt, "whsec_right"), env)).status, 503);
    eq("lookup failing: 2nd → 503", (await call(stripeWebhookReq(lfEvt, "whsec_right"), env)).status, 503);
    eq("lookup failing: no alert after 2", alerts(), 0);
    await call(stripeWebhookReq(lfEvt, "whsec_right"), env);
    eq("lookup failing: alert on the 3rd", alerts(), 1);
    await call(stripeWebhookReq(lfEvt, "whsec_right"), env);
    eq("lookup failing: no repeat alert", alerts(), 1);
    check("lookup failing: notification names the lookup", notes().some((n) => n.type === "stripe_lookup_failing" && n.eventId === "evt_lf" && n.where === "checkout" && n.sub === "sub_lf"));
    stripeFailIds = new Set();
    eq("lookup recovers: retry → 200", (await call(stripeWebhookReq(lfEvt, "whsec_right"), env)).status, 200);
    eq("lookup recovers: grants", (await env.USERS.get("user:lf@example.com", "json")).adFree, true);
    // Same alert on the subscription.updated lookup.
    await seedUser(env, "lfu@example.com", { adFree: false, stripeCustomerId: "cus_lfu", stripeSubId: "sub_lfu" });
    await env.USERS.put("stripecust:cus_lfu", "lfu@example.com");
    stripeFailIds = new Set(["sub_lfu"]);
    const lfu = { id: "evt_lfu", type: "customer.subscription.updated", data: { object: { id: "sub_lfu", customer: "cus_lfu", status: "active", metadata: { purpose: "adfree" } } } };
    for (let i = 0; i < 3; i++) await call(stripeWebhookReq(lfu, "whsec_right"), env);
    stripeFailIds = new Set();
    check("lookup failing on updated: alerted", notes().some((n) => n.type === "stripe_lookup_failing" && n.eventId === "evt_lfu" && n.where === "subscription-update"));

    // A stored past_due sub that becomes paid sends the welcome email once.
    emailCalls = [];
    subStatus.sub_lfu = "active";
    await call(stripeWebhookReq(lfu, "whsec_right"), env);
    eq("matched update grant: ad-free on", (await env.USERS.get("user:lfu@example.com", "json")).adFree, true);
    eq("matched update grant: one welcome", emailCalls.filter((c) => /Welcome to shouldiboat Pro/i.test(c.subject)).length, 1);

    // Account deleted, then a late checkout retry: no reverse index re-created.
    subStatus.sub_del = "active";
    await call(stripeWebhookReq({ id: "evt_del", type: "checkout.session.completed", data: { object: { ...session, client_reference_id: "deleted@example.com", customer: "cus_del", subscription: "sub_del" } } }, "whsec_right"), env);
    eq("no account: reverse index not written", await env.USERS.get("stripecust:cus_del"), null);
    subStatus = {}; subCustomer = {}; subInvoice = {};
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

  // 43. grandfathered (100k-iteration) password hash still verifies on login.
  // 100k is the Cloudflare Workers PBKDF2 ceiling, so it's already the current
  // work factor — it must NOT be re-hashed above the cap (that would throw).
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
    eq("legacy: work factor stays at the 100k Workers cap", u.passIter ?? 100000, 100000);
    check("legacy: not re-hashed above the cap (salt unchanged)", u.salt === salt);
    // and it still verifies on the next login
    eq("legacy: still logs in", (await call(req("POST", "/auth/login", { body: { email: "legacy@example.com", password: "Legacy1!" } }), env)).status, 200);
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
    const d = emailCalls.find((c) => /shouldiboat.com/i.test(c.subject));
    check("digest: goes to the opted-in user", d && d.to[0].email === "digest@example.com", JSON.stringify(emailCalls.map((c) => c.to)));
    check("digest: subject leads with home-port best window", /Best window at Sandusky/i.test(d.subject), d.subject);
    check("digest: rows carry the best window", /best 6am–9pm/.test(d.htmlContent));
    check("digest: waves shown as height @ period", /ft @ 5s/.test(d.htmlContent), d.htmlContent.match(/[\d.]+ ft[^<·]*/)?.[0]);
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

  // 49. Pro: free plan caps starred ports; Pro is unlimited; existing ports are kept
  {
    const env = { USERS: makeKV() };
    const free = await seedUser(env, "free@example.com", { favorites: ["a", "b"] });
    eq("pro: free can star up to the cap", (await call(req("PUT", "/api/favorites", { cookie: free, body: { favorites: ["a", "b", "c"] } }), env)).status, 200);
    const over = await call(req("PUT", "/api/favorites", { cookie: free, body: { favorites: ["a", "b", "c", "d"] } }), env);
    eq("pro: free past the cap → 402", over.status, 402);
    const od = await over.json();
    check("pro: 402 asks to upgrade", od.upgrade === true && od.limit === 3, JSON.stringify(od));
    eq("pro: rejected save leaves ports unchanged", (await env.USERS.get("user:free@example.com", "json")).favorites.length, 3);
    eq("pro: removing a port still works", (await call(req("PUT", "/api/favorites", { cookie: free, body: { favorites: ["a"] } }), env)).status, 200);
    const lapsed = await seedUser(env, "lapsed@example.com", { favorites: ["a", "b", "c", "d", "e"] });
    eq("pro: lapsed member keeps existing ports (reorder ok)", (await call(req("PUT", "/api/favorites", { cookie: lapsed, body: { favorites: ["e", "d", "c", "b", "a"] } }), env)).status, 200);
    eq("pro: lapsed member can't add more", (await call(req("PUT", "/api/favorites", { cookie: lapsed, body: { favorites: ["a", "b", "c", "d", "e", "f"] } }), env)).status, 402);
    const pro = await seedUser(env, "pro@example.com", { adFree: true });
    const many = Array.from({ length: 12 }, (_, i) => `p${i}`);
    eq("pro: Pro stars unlimited ports", (await call(req("PUT", "/api/favorites", { cookie: pro, body: { favorites: many } }), env)).status, 200);
    const me = await (await call(req("GET", "/auth/me", { cookie: pro }), env)).json();
    check("pro: /auth/me reports pro + no limit", me.user.pro === true && me.user.limits.favorites === null, JSON.stringify(me.user.limits));
    const meFree = await (await call(req("GET", "/auth/me", { cookie: free }), env)).json();
    check("pro: /auth/me reports free limit", meFree.user.pro === false && meFree.user.limits.favorites === 3);
  }

  // 50. Pro-only prefs can't be switched on from a free account
  {
    const env = { USERS: makeKV() };
    const free = await seedUser(env, "fp@example.com");
    await call(req("PUT", "/api/prefs", { cookie: free, body: { prefs: { goAlerts: true, weekendEmail: true, dailyEmail: true } } }), env);
    const fu = await env.USERS.get("user:fp@example.com", "json");
    check("pro prefs: free can't enable GO alerts / weekend", !fu.prefs.goAlerts && !fu.prefs.weekendEmail, JSON.stringify(fu.prefs));
    eq("pro prefs: free prefs still save", fu.prefs.dailyEmail, true);
    const pro = await seedUser(env, "pp@example.com", { adFree: true });
    await call(req("PUT", "/api/prefs", { cookie: pro, body: { prefs: { goAlerts: true, weekendEmail: true } } }), env);
    const pu = await env.USERS.get("user:pp@example.com", "json");
    check("pro prefs: Pro can enable both", pu.prefs.goAlerts === true && pu.prefs.weekendEmail === true, JSON.stringify(pu.prefs));
  }

  // 51. Plans + yearly checkout
  {
    const env = { USERS: makeKV(), STRIPE_SECRET_KEY: "sk_test_x" };
    const plans = await (await call(req("GET", "/api/plans"), env)).json();
    check("plans: monthly listed with live amount", plans.plans.length === 1 && plans.plans[0].id === "month" && plans.plans[0].amount === 299, JSON.stringify(plans));
    eq("plans: no billing key → empty", (await (await call(req("GET", "/api/plans"), { USERS: env.USERS })).json()).plans.length, 0);
    const cookie = await seedUser(env, "yr@example.com");
    eq("checkout: yearly without a yearly price → 400", (await call(req("POST", "/api/checkout", { cookie, body: { plan: "year" } }), env)).status, 400);
    env.STRIPE_PRICE_ID_YEARLY = "price_year_abc";
    stripeCalls = [];
    eq("checkout: yearly → 200", (await call(req("POST", "/api/checkout", { cookie, body: { plan: "year" } }), env)).status, 200);
    const sent = stripeCalls.find((c) => c.url.includes("checkout/sessions"));
    eq("checkout: yearly uses the yearly price", sent?.body?.["line_items[0][price]"], "price_year_abc");
    eq("checkout: plan recorded in metadata", sent?.body?.["metadata[plan]"], "year");
    const plans2 = await (await call(req("GET", "/api/plans"), env)).json();
    eq("plans: yearly listed once configured", plans2.plans.map((p) => p.id).join(","), "month,year");
  }

  // 52. GO alerts (Pro): fire when a starred port improves to GO, once per day
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "go@example.com", { adFree: true, favorites: ["sandusky"], prefs: { goAlerts: true } });
    await seedUser(env, "gofree@example.com", { favorites: ["sandusky"], prefs: { goAlerts: true } }); // stale pref, not Pro
    stormMode = true;
    emailCalls = [];
    const r1 = await runScheduled(env, 13);
    eq("go alerts: none while rough", r1.goAlerts, 0);
    check("go alerts: level recorded with today's date", (await env.USERS.get("lvl:sandusky")) === `NO-GO|${new Date().toISOString().slice(0, 10)}`, await env.USERS.get("lvl:sandusky"));
    stormMode = false;
    const r2 = await runScheduled(env, 14);
    eq("go alerts: one sent on the turn to GO (Pro only)", r2.goAlerts, 1);
    const m = emailCalls.find((c) => /^GO now/.test(c.subject));
    check("go alerts: to the Pro member", m && m.to[0].email === "go@example.com", JSON.stringify(emailCalls.map((c) => [c.subject, c.to])));
    stormMode = true; await runScheduled(env, 15);
    stormMode = false;
    eq("go alerts: deduped for the rest of the day", (await runScheduled(env, 16)).goAlerts, 0);
    // An active advisory makes the full page verdict CAUTION: no GO email even
    // though the grid tile alone reads GO.
    const env3 = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await seedUser(env3, "go@example.com", { adFree: true, favorites: ["sandusky"], prefs: { goAlerts: true } });
    stormMode = true; await runScheduled(env3, 13); stormMode = false;
    scaMode = true;
    eq("go alerts: advisory in effect → no GO email", (await runScheduled(env3, 14)).goAlerts, 0);
    scaMode = false;
    // A level recorded on an earlier day never counts as "was rough".
    // Alerts feed down: a failed lookup is not "no advisories" → no GO email.
    const env5 = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await seedUser(env5, "go@example.com", { adFree: true, favorites: ["sandusky"], prefs: { goAlerts: true } });
    stormMode = true; await runScheduled(env5, 13); stormMode = false;
    alertsDown = true;
    eq("go alerts: alerts feed down → no GO email", (await runScheduled(env5, 14)).goAlerts, 0);
    alertsDown = false;
    const yesterday = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
    const env4 = { USERS: makeKV({ "lvl:sandusky": `NO-GO|${yesterday}` }), BREVO_API_KEY: "brevo_x" };
    await seedUser(env4, "go@example.com", { adFree: true, favorites: ["sandusky"], prefs: { goAlerts: true } });
    eq("go alerts: stale level from yesterday → no GO email", (await runScheduled(env4, 14)).goAlerts, 0);
    // First run of the window only records (an overnight change isn't an alert).
    const env2 = { USERS: makeKV({ "lvl:sandusky": "NO-GO" }), BREVO_API_KEY: "brevo_x" };
    await seedUser(env2, "go@example.com", { adFree: true, favorites: ["sandusky"], prefs: { goAlerts: true } });
    eq("go alerts: first window run doesn't fire", (await runScheduled(env2, 9)).goAlerts, 0);
  }

  // 53. Weekend outlook (Pro): Thursday evening, Saturday + Sunday per port
  {
    const env = { USERS: makeKV(), BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "wk@example.com", { adFree: true, favorites: ["sandusky"], prefs: { weekendEmail: true } });
    await seedUser(env, "wkfree@example.com", { favorites: ["sandusky"], prefs: { weekendEmail: true } });
    const thu = new Date(); thu.setUTCDate(thu.getUTCDate() + ((4 - thu.getUTCDay() + 7) % 7)); thu.setUTCHours(22, 0, 0, 0);
    const notThu = new Date(thu.getTime() + 86400e3);
    emailCalls = [];
    eq("weekend: not sent on other days", (await runScheduled(env, 22, notThu)).weekends, 0);
    const r = await runScheduled(env, 22, thu);
    eq("weekend: one sent (Pro only)", r.weekends, 1);
    const m = emailCalls.find((c) => /Weekend outlook/.test(c.subject));
    check("weekend: to the Pro member", m && m.to[0].email === "wk@example.com");
    check("weekend: has Saturday + Sunday columns", m && /Saturday/.test(m.htmlContent) && /Sunday/.test(m.htmlContent));
  }

  // 54. Email HTML escapes user-built spot names (no injected links/markup)
  {
    const { esc } = await import("../functions/digest.js");
    eq("email esc: tags neutralized", esc('<a href="x">Pay</a> & co'), "&lt;a href=&quot;x&quot;&gt;Pay&lt;/a&gt; &amp; co");
    const env = { USERS: makeKV({ "builtspot:evil": JSON.stringify({ slug: "evil", name: '<a href="https://evil.example">Update card</a>', lat: 41.5, lon: -82.7, zone: "LEZ144", office: "CLE", product: "NSH", lake: "Lake Erie" }) }), BREVO_API_KEY: "brevo_x" };
    await seedUser(env, "esc@example.com", { favorites: ["evil"], prefs: { dailyEmail: true } });
    emailCalls = [];
    await runScheduled(env, 10);
    const m = emailCalls.find((c) => c.to[0].email === "esc@example.com");
    check("email esc: digest carries the escaped name, not a live link", m && !/href="https:\/\/evil/.test(m.htmlContent) && /&lt;a href=/.test(m.htmlContent), m && m.htmlContent.slice(0, 400));
  }

  // 55. Summary/day verdicts: lake gusts count; missing wind is never GO but
  //     never softens a wave-driven call either.
  {
    const { riskLevel } = await import("../functions/marine/conditions.js");
    eq("riskLevel: lake 13 kt gusting 24 → NO-GO (gust counts)", riskLevel(13, 24, 0, "", 1.5, 4, "lake"), "NO-GO");
    eq("riskLevel: lake 10 kt gusting 16 → CAUTION", riskLevel(10, 16, 0, "", 1, 4, "lake"), "CAUTION");
    eq("riskLevel: lake 8 kt, no gust data → GO", riskLevel(8, null, 0, "", 1, 4, "lake"), "GO");
    eq("riskLevel: no wind, calm waves → no call (null), not GO", riskLevel(null, null, 0, "", 1, 4, "lake"), null);
    eq("riskLevel: no wind, 5 ft waves → still NO-GO", riskLevel(null, null, 0, "", 5, 5, "lake"), "NO-GO");
    eq("riskLevel: no wind, 3 ft waves → still CAUTION", riskLevel(null, null, 0, "", 3, 5, "lake"), "CAUTION");
    eq("riskLevel: no sustained wind but a 24 kt gust → NO-GO", riskLevel(null, 24, 0, "", 1, 4, "lake"), "NO-GO");
    eq("riskLevel: ocean rates sustained + gust separately (12 g18 → GO)", riskLevel(12, 18, 0, "", 2, 10, "ocean"), "GO");
    eq("riskLevel: ocean gust 28 → NO-GO", riskLevel(12, 28, 0, "", 2, 10, "ocean"), "NO-GO");
    eq("riskLevel: thunder with no wind data → still NO-GO", riskLevel(null, null, 40, "thunderstorms", null, null, "lake"), "NO-GO");
    const { buildRecommendation } = await import("../functions/marine/conditions.js");
    const rec = (wind, waves = { ft: null }) => buildRecommendation({ buoy: null, alerts: [], wind, waves, read: null, hours: [], profile: "lake" }).level;
    eq("headline: gust only (8 kt), no sustained wind, no waves → CAUTION, not GO", rec({ speedKt: null, gustKt: 8, source: null, gustSrc: "forecast" }), "CAUTION");
    eq("headline: gust only (24 kt), no sustained wind → still NO-GO", rec({ speedKt: null, gustKt: 24, source: null, gustSrc: "forecast" }), "NO-GO");
    const r = buildRecommendation({ buoy: null, alerts: [], wind: { speedKt: 7, gustKt: 16, source: "buoy", gustSrc: "forecast" }, waves: { ft: 1 }, read: null, hours: [], profile: "lake" });
    check("headline: forecast gust driving the call is tagged (forecast)", r.reasons.some((x) => /16 kt \(forecast\)/.test(x)), JSON.stringify(r.reasons));
  }

  // 56. Lake gusts count everywhere a verdict is made (tile, week, digest
  //     window, spot headline), and missing wind never reads GO.
  {
    const { fetchSummary, fetchWeeks, fetchTodayWindows, onRequest } = await import("../functions/marine/conditions.js");
    const env = { USERS: makeKV() };
    stormMode = false; scaMode = false; alertsDown = false;
    gridMode = "gusty"; // 13 kt gusting 24 kt, 1.5 ft on Lake Erie
    const tile = (await fetchSummary(env)).spots.find((x) => x.id === "sandusky");
    eq("gusty lake: tile wind is 13 kt", tile?.windKt, 13);
    eq("gusty lake: tile gust is 24 kt", tile?.gustKt, 24);
    eq("gusty lake: tile is NO-GO on the gust", tile?.level, "NO-GO");
    const week = (await fetchWeeks(env, ["sandusky"])).sandusky || [];
    check("gusty lake: week has days", week.length > 0);
    check("gusty lake: every week day is NO-GO", week.length && week.every((d) => d.level === "NO-GO"), JSON.stringify(week.map((d) => d.level)));
    const wins = await fetchTodayWindows();
    check("gusty lake: digest has no GO window anywhere", Object.values(wins).every((w) => w == null), JSON.stringify(wins).slice(0, 200));
    const page = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    eq("gusty lake: no-buoy headline gets the grid gust", page.wind?.gustKt, 24);
    eq("gusty lake: headline gust source is forecast", page.wind?.gustSrc, "forecast");
    eq("gusty lake: spot headline is NO-GO", page.recommendation?.level, "NO-GO");
    check("gusty lake: forecast gust reason is tagged (forecast)", (page.recommendation?.reasons || []).some((r) => /Strong wind: 13 kt, gusts 24 kt \(forecast\)/.test(r)), JSON.stringify(page.recommendation?.reasons));
    const pageWeek = page.week || [];
    check("gusty lake: spot page week strip agrees (NO-GO)", pageWeek.length && pageWeek.every((d) => d.level === "NO-GO"), JSON.stringify(pageWeek.map((d) => d.level)));

    gridMode = "nowind"; // waves present, no wind/gust layers
    const t2 = (await fetchSummary(env)).spots.find((x) => x.id === "sandusky");
    eq("no wind: tile wind is null", t2?.windKt, null);
    check("no wind: tile still has waves", t2?.waveFt != null, JSON.stringify(t2));
    eq("no wind: tile level is null (—), not GO", t2?.level, null);
    const w2 = (await fetchWeeks(env, ["sandusky"])).sandusky || [];
    check("no wind: no week day reads GO (all —)", w2.length && w2.every((d) => d.level === null), JSON.stringify(w2.map((d) => d.level)));
    const wins2 = await fetchTodayWindows();
    check("no wind: digest has no GO window", Object.values(wins2).every((w) => w == null));

    // No buoy, daily forecast down (no sustained wind), grid gust 9 kt, no
    // waves: a lone gust is missing data, not calm, so never GO.
    gridMode = "gustonly";
    const p3 = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    eq("gust only: sustained wind missing", p3.wind?.speedKt, null);
    eq("gust only: grid gust present", p3.wind?.gustKt, 9);
    check("gust only: unparseable hourly wind is null, not 0 kt", (p3.hourly || []).length && p3.hourly.every((h) => h.windKt === null), JSON.stringify((p3.hourly || []).slice(0, 2)));
    check("gust only: no-wind hours in the strip are not GO (null)", (p3.hourly || []).length && p3.hourly.every((h) => h.level === null), JSON.stringify((p3.hourly || []).slice(0, 2).map((h) => h.level)));
    check("gust only: current-hour outlook is not GO", p3.outlook?.nowLevel !== "GO", JSON.stringify(p3.outlook));
    check("gust only: headline is not GO", p3.recommendation?.level && p3.recommendation.level !== "GO", JSON.stringify(p3.recommendation));
    gridMode = null;
  }

  // 56. Week strip rates forecast thunder (hour by hour, with that hour's rain
  //     chance); the outlook never counts no-data hours as good.
  {
    const { buildWeek, computeOutlook, buildRecommendation } = await import("../functions/marine/conditions.js");
    const nowH = Math.floor(Date.now() / 3600000);
    // A calm 3-day grid (UTC), 8 kt / 1 ft / dry, with thunder injected per test.
    const grid = (thunderHours = {}, precip = {}) => {
      const mk = (v) => new Map(Array.from({ length: 72 }, (_, i) => [nowH + i, typeof v === "function" ? v(nowH + i) : v]));
      return { tz: "UTC", windKt: mk(8), gustKt: mk(10), waveFt: mk(1), periodSec: mk(4), windDirDeg: mk(225),
        precipPct: mk((h) => precip[h] ?? 0), thunder: mk((h) => !!thunderHours[h]) };
    };
    const day2 = (w) => w.find((d) => d.date === new Date((nowH + 30) * 3600e3).toISOString().slice(0, 10));
    eq("week: calm day stays GO", day2(buildWeek(grid())).level, "GO");
    const h = nowH + 30;
    eq("week: thunder hour with 40% rain → day NO-GO", day2(buildWeek(grid({ [h]: true }, { [h]: 40 }))).level, "NO-GO");
    eq("week: slight thunder chance (10% rain) → day CAUTION", day2(buildWeek(grid({ [h]: true }, { [h]: 10 }))).level, "CAUTION");
    eq("week: dry thunder hour + unrelated wet hour → CAUTION, not NO-GO", day2(buildWeek(grid({ [h]: true }, { [h]: 5, [h + 3]: 40 }))).level, "CAUTION");
    check("week: day reports thunder flag", day2(buildWeek(grid({ [h]: true }, { [h]: 40 }))).thunder === true);

    const hr = (level, i) => ({ time: new Date((nowH + i) * 3600e3).toISOString(), level, short: "" });
    const o1 = computeOutlook([hr(null, 0), hr("GO", 1), hr("GO", 2)]);
    check("outlook: no data this hour → noData, 0 good hours", o1.noData === true && o1.goodHours === 0, JSON.stringify(o1));
    const o2 = computeOutlook([hr("GO", 0), hr("GO", 1), hr(null, 2), hr("GO", 3)]);
    check("outlook: good window stops at the first no-data hour", o2.goodHours === 2 && o2.dataEndsAt === hr(null, 2).time && !o2.headInBy, JSON.stringify(o2));
    const o3 = computeOutlook([hr("GO", 0), hr("NO-GO", 1), hr(null, 2)]);
    check("outlook: an earlier NO-GO still sets be-in-by", o3.goodHours === 1 && o3.headInBy === hr("NO-GO", 1).time, JSON.stringify(o3));
    const storm = { ...hr("NO-GO", 2), short: "Chance Showers And Thunderstorms" };
    const o4 = computeOutlook([hr(null, 0), hr(null, 1), storm]);
    check("outlook: missing wind keeps a known storm cutoff", o4.noData === true && o4.goodHours === 0 && o4.headInBy === storm.time && o4.headInReason === "thunderstorms", JSON.stringify(o4));
    const o5 = computeOutlook([hr("GO", 0), hr(null, 1), storm]);
    const o6 = computeOutlook([hr("NO-GO", 0), hr(null, 1), hr("GO", 2)]);
    check("outlook: NO-GO now then a data gap → be in now, no dataEndsAt", o6.goodHours === 0 && o6.headInBy === hr("NO-GO", 0).time && !o6.dataEndsAt, JSON.stringify(o6));
    check("outlook: data gap before a storm keeps both", o5.goodHours === 1 && o5.dataEndsAt === hr(null, 1).time && o5.headInBy === storm.time, JSON.stringify(o5));

    const r24 = buildRecommendation({ buoy: null, alerts: [], wind: { speedKt: null, gustKt: 24, source: null, gustSrc: "forecast" }, waves: { ft: null }, read: null, hours: [], profile: "lake" });
    check("summary: gust-driven NO-GO with no other data reads as NO-GO, not 'no live data'", r24.level === "NO-GO" && !/No live data/.test(r24.summary), r24.summary);
  }

  // 57. Follow-ups: Great Lakes GO needs waves; sparse future days can't GO;
  //     the hourly strip starts at the current hour.
  {
    const { riskLevel, buildWeek, onRequest } = await import("../functions/marine/conditions.js");
    eq("riskLevel: Great Lakes, wind but no waves → no call (null), not GO", riskLevel(8, 10, 0, "", null, null, "lake"), null);
    eq("riskLevel: Great Lakes, no waves but 24 kt gust → still NO-GO", riskLevel(8, 24, 0, "", null, null, "lake"), "NO-GO");
    eq("riskLevel: Great Lakes, no waves, 16 kt → still CAUTION", riskLevel(16, null, 0, "", null, null, "lake"), "CAUTION");
    eq("riskLevel: sheltered water rates on wind alone (no waves → GO)", riskLevel(8, 10, 0, "", null, null, "sheltered"), "GO");

    // Grid in UTC: tomorrow fully covered, the day after only 6 hours.
    const nowH = Math.floor(Date.now() / 3600000);
    const dayStart = (k) => Math.floor(nowH / 24) * 24 + 24 * k;
    const mk = () => ({ tz: "UTC", windKt: new Map(), gustKt: new Map(), precipPct: new Map(), waveFt: new Map(), periodSec: new Map() });
    const g = mk();
    const put = (h, w, gu, ft) => { g.windKt.set(h, w); g.gustKt.set(h, gu); g.waveFt.set(h, ft); g.periodSec.set(h, 4); g.precipPct.set(h, 0); };
    for (let h = dayStart(1); h < dayStart(2); h++) put(h, 8, 10, 1);
    for (let h = dayStart(2); h < dayStart(2) + 6; h++) put(h, 8, 10, 1);
    for (let h = dayStart(3); h < dayStart(3) + 4; h++) put(h, 20, 26, 5); // sparse but rough
    const wk = Object.fromEntries(buildWeek(g, "lake").map((d) => [d.date, d.level]));
    const iso = (k) => new Date(dayStart(k) * 3600000).toISOString().slice(0, 10);
    eq("week: fully covered calm day → GO", wk[iso(1)], "GO");
    eq("week: sparsely covered calm day (6 h) → null, not GO", wk[iso(2)], null);
    eq("week: sparse day that's rough still → NO-GO", wk[iso(3)], "NO-GO");
    const g2 = mk();
    for (let h = dayStart(1); h < dayStart(2); h++) { g2.windKt.set(h, 8); g2.gustKt.set(h, 10); g2.precipPct.set(h, 0); }
    for (let h = dayStart(1); h < dayStart(1) + 3; h++) { g2.waveFt.set(h, 1); g2.periodSec.set(h, 4); }
    const wk2 = Object.fromEntries(buildWeek(g2, "lake").map((d) => [d.date, d.level]));
    eq("week: Great Lakes day with full wind but 3 h of waves → null, not GO", wk2[iso(1)], null);
    eq("week: same coverage on sheltered water → GO (wind-only by design)", Object.fromEntries(buildWeek(g2, "sheltered").map((d) => [d.date, d.level]))[iso(1)], "GO");
    const { buildRecommendation } = await import("../functions/marine/conditions.js");
    const hr = (profile) => buildRecommendation({ buoy: null, alerts: [], wind: { speedKt: 8, gustKt: 10, source: "forecast", gustSrc: "forecast" }, waves: { ft: null }, read: null, hours: [], profile }).level;
    eq("headline: Great Lakes, light wind, no wave data → CAUTION, not GO", hr("lake"), "CAUTION");
    eq("headline: sheltered, light wind, no wave data → GO (wind-only by design)", hr("sheltered"), "GO");

    stormMode = false; scaMode = false; alertsDown = false; gridMode = null;
    hourlyLagH = 3;
    const pg = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env: { USERS: makeKV() } })).json();
    hourlyLagH = 0;
    const firstH = pg.hourly?.[0] && Math.floor(Date.parse(pg.hourly[0].time) / 3600000);
    check("hourly strip: past hours dropped, starts at the current hour", firstH === nowH || firstH === nowH + 1, `got ${firstH}, now ${nowH}`);
  }

  // 58. Alerts are looked up by the spot's marine zone as well as its point:
  //     zone-issued warnings reach launches outside the zone polygon, and a
  //     failed zone lookup is never read as "no advisories".
  {
    const { onRequest, fetchAlerts, SPOTS } = await import("../functions/marine/conditions.js");
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null;
    const page = async () => (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env: { USERS: makeKV() } })).json();
    zoneAlert = "gale";
    const g = await page();
    check("zone alerts: a Gale Warning on the zone only → NO-GO", g.recommendation?.level === "NO-GO", JSON.stringify(g.recommendation));
    check("zone alerts: the zone's Gale Warning is listed", (g.alerts || []).some((a) => a.event === "Gale Warning") && g.alertsOk === true, JSON.stringify(g.alerts));
    scaMode = true;
    const both = await fetchAlerts(SPOTS.sandusky);
    check("zone alerts: point and zone alerts merge", both.ok && both.alerts.map((a) => a.event).sort().join() === "Gale Warning,Small Craft Advisory", JSON.stringify(both));
    zoneAlert = null;
    const dup = await fetchAlerts(SPOTS.sandusky);
    eq("zone alerts: the same advisory from point and zone shows once", dup.alerts.length, 1);
    scaMode = false;
    zoneAlert = "down";
    const d = await page();
    check("zone alerts: zone lookup failed → alertsOk false, page not GO", d.alertsOk === false && d.recommendation?.level !== "GO", JSON.stringify({ ok: d.alertsOk, level: d.recommendation?.level }));
    scaMode = true;
    const part = await fetchAlerts(SPOTS.sandusky);
    check("zone alerts: point alerts still shown when only the zone lookup fails", !part.ok && part.alerts?.[0]?.event === "Small Craft Advisory", JSON.stringify(part));
    scaMode = false; zoneAlert = null;
    const noZone = await fetchAlerts({ lat: 41.5, lon: -82.7 });
    check("zone alerts: a spot with no zone uses the point lookup alone", noZone.ok && Array.isArray(noZone.alerts), JSON.stringify(noZone));
    alertsDown = true;
    const none = await fetchAlerts(SPOTS.sandusky);
    check("zone alerts: every lookup failed → alerts null, ok false", none.alerts === null && none.ok === false, JSON.stringify(none));
    alertsDown = false;
  }

  // 59. Active alerts raise every verdict view, not just the spot headline:
  //     the hourly strip + outlook, the week strip, directory tiles, the
  //     digest's best window and the weekend outlook.
  {
    const { alertLevel, applyAlertsToHours, applyAlertsToWeek, computeOutlook, fetchZoneAlerts, fetchSummary, fetchWeeks, fetchTodayWindows, onRequest } = await import("../functions/marine/conditions.js");
    const env = { USERS: makeKV() };
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; zoneAlert = null; zoneAlertOnly = null; zoneAlertSpan = null;

    eq("alertLevel: gale → NO-GO", alertLevel({ event: "Gale Warning" }), "NO-GO");
    eq("alertLevel: SCA → CAUTION", alertLevel({ event: "Small Craft Advisory" }), "CAUTION");
    eq("alertLevel: watch → CAUTION", alertLevel({ event: "Gale Watch" }), "CAUTION");
    eq("alertLevel: shore-side alert → no effect", alertLevel({ event: "Rip Current Statement" }), null);

    const now = Date.now(), H = 3600e3;
    const t0 = Math.floor(now / H) * H;
    const hrs = Array.from({ length: 60 }, (_, i) => ({ time: new Date(t0 + i * H).toISOString(), level: "GO", short: "" }));
    const sca = { event: "Small Craft Advisory", onset: new Date(t0 + 2 * H).toISOString(), ends: new Date(t0 + 5 * H).toISOString() };
    const h1 = applyAlertsToHours(hrs, [sca], true, now);
    eq("hours: before the advisory stays GO", h1[1].level, "GO");
    check("hours: advisory hours (2-4) are CAUTION", [2, 3, 4].every((i) => h1[i].level === "CAUTION"), JSON.stringify(h1.slice(0, 6).map((h) => h.level)));
    eq("hours: after the advisory ends, GO again", h1[5].level, "GO");
    const gale = { event: "Gale Warning", onset: new Date(t0 + 3 * H).toISOString(), ends: new Date(t0 + 9 * H).toISOString() };
    const o = computeOutlook(applyAlertsToHours(hrs, [gale], true, now));
    check("outlook: be in by the gale's onset, reason 'a marine warning'", o.headInBy === hrs[3].time && o.goodHours === 3 && o.headInReason === "a marine warning", JSON.stringify(o));
    const h2 = applyAlertsToHours(hrs, [], false, now);
    check("hours: alerts unknown → next 48 h not GO", h2.slice(0, 48).every((h) => h.level === "CAUTION"), JSON.stringify(h2.slice(0, 48).map((h) => h.level)));
    eq("hours: alerts unknown → beyond 48 h unchanged", h2[49].level, "GO");
    // NWS "until further notice": no event end. toAlert keeps ends = expires for
    // the card, but timing must not end the warning at the product's expiry.
    const ufn = { event: "Hurricane Warning", onset: null, ends: new Date(t0 + 3 * H).toISOString(), eventEnds: null };
    const hU = applyAlertsToHours(hrs, [ufn], true, now);
    check("hours: until-further-notice warning stays in force past its product expiry", hU[10].level === "NO-GO" && hU[59].level === "NO-GO", JSON.stringify([hU[10].level, hU[59].level]));
    const stmt = { event: "Marine Weather Statement", onset: null, ends: new Date(t0 + 2 * H).toISOString(), eventEnds: null };
    const hS = applyAlertsToHours(hrs, [stmt], true, now);
    check("hours: a statement (no event end by design) ends at its expiry", hS[1].level === "CAUTION" && hS[3].level === "GO", JSON.stringify([hS[1].level, hS[3].level]));
    // DST: an SCA spanning the fall-back night (2026-11-01 01:00 EDT repeats).
    const dstHrs = Array.from({ length: 8 }, (_, i) => ({ time: new Date(Date.parse("2026-11-01T04:00:00Z") + i * H).toISOString(), level: "GO" }));
    const dstSca = { event: "Small Craft Advisory", onset: "2026-11-01T01:00:00-04:00", ends: "2026-11-01T03:00:00-05:00" }; // 05Z → 08Z
    const hD = applyAlertsToHours(dstHrs, [dstSca], true, Date.parse("2026-11-01T04:00:00Z"));
    eq("hours: across the DST change, exactly the 3 UTC hours of the advisory", hD.map((h) => h.level).join(","), "GO,CAUTION,CAUTION,CAUTION,GO,GO,GO,GO");
    const dstWk = applyAlertsToWeek([{ date: "2026-10-31", level: "GO" }, { date: "2026-11-01", level: "GO" }, { date: "2026-11-02", level: "GO" }], [{ event: "Gale Warning", onset: "2026-10-31T23:30:00-04:00", ends: "2026-11-01T23:00:00-05:00" }], true, "America/New_York", Date.parse("2026-10-31T12:00:00Z"));
    eq("week: across the DST change, the gale's local days (onset in EDT, end in EST)", dstWk.map((d) => d.level).join(","), "NO-GO,NO-GO,GO");
    const sca2 = { event: "Small Craft Advisory", onset: new Date(t0 + 20 * H).toISOString(), ends: new Date(t0 + 22 * H).toISOString() };
    const h3 = applyAlertsToHours(hrs, [sca, sca2], true, now);
    check("hours: two issuances of one event each cover their own hours", h3[3].level === "CAUTION" && h3[21].level === "CAUTION" && h3[10].level === "GO", JSON.stringify([h3[3].level, h3[10].level, h3[21].level]));
    const nowFirst = applyAlertsToHours([{ ...hrs[0], level: "NO-GO" }], [sca], true, now)[0];
    eq("hours: an alert never lowers a level", nowFirst.level, "NO-GO");

    const iso = (k) => new Date(t0 + k * 24 * H).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const wk = [0, 1, 2, 3, 4].map((k) => ({ date: iso(k), level: "GO" }));
    const tomorrowGale = { event: "Gale Warning", onset: new Date(Date.parse(`${iso(1)}T12:00:00-05:00`)).toISOString(), ends: new Date(Date.parse(`${iso(1)}T20:00:00-05:00`)).toISOString() };
    const w1 = applyAlertsToWeek(wk, [tomorrowGale], true, "America/New_York", now);
    check("week: gale tomorrow → tomorrow NO-GO, other days GO", w1[0].level === "GO" && w1[1].level === "NO-GO" && w1[2].level === "GO", JSON.stringify(w1.map((d) => d.level)));
    const w2 = applyAlertsToWeek(wk, [], false, "America/New_York", now);
    check("week: alerts unknown → the days the 48 h hourly cap reaches are not GO, later days unchanged", w2[0].level === "CAUTION" && w2[1].level === "CAUTION" && w2[4].level === "GO", JSON.stringify(w2.map((d) => d.level)));

    zoneAlert = "gale"; zoneAlertOnly = ["LEZ143"];
    const many = Array.from({ length: 30 }, (_, i) => `LEZ${String(100 + i).padStart(3, "0")}`).concat(["LEZ143", "bogus", null]);
    const za = await fetchZoneAlerts(many);
    check("zone batch: gale lands on its zone only", za.ok && za.byZone.get("LEZ143")?.[0]?.event === "Gale Warning" && za.byZone.get("LEZ100").length === 0, JSON.stringify([...za.byZone].filter(([, a]) => a.length)));
    check("zone batch: invalid zone IDs are dropped", !za.byZone.has("bogus"));

    const tiles = (await fetchSummary(env)).spots;
    eq("tiles: Sandusky (LEZ143, gale) is NO-GO", tiles.find((x) => x.id === "sandusky")?.level, "NO-GO");
    eq("tiles: a calm spot in another zone stays GO", tiles.find((x) => x.id === "erie")?.level, "GO");
    const wins = await fetchTodayWindows();
    eq("digest: no GO window under the gale (Sandusky)", wins.sandusky, null);
    check("digest: other spots keep their windows", wins.erie != null, JSON.stringify(wins.erie));
    const weeks = await fetchWeeks(env, ["sandusky", "erie"]);
    eq("weekend: Sandusky today is NO-GO under an open-ended gale", weeks.sandusky?.[0]?.level, "NO-GO");
    eq("weekend: Erie today stays GO", weeks.erie?.[0]?.level, "GO");

    const page = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    check("spot page: hourly strip has no GO hour under the gale", (page.hourly || []).length && page.hourly.every((h) => h.level !== "GO"), JSON.stringify((page.hourly || []).slice(0, 3).map((h) => h.level)));
    check("spot page: outlook is not GO now", page.outlook?.nowLevel !== "GO", JSON.stringify(page.outlook));
    eq("spot page: week strip today is NO-GO", page.week?.[0]?.level, "NO-GO");

    // Tile lookahead: a gale starting within 6 h makes the tile at least CAUTION.
    zoneAlertSpan = { onsetH: 1, endsH: 12 };
    eq("tiles: gale starting next hour → NO-GO", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "NO-GO");
    zoneAlertSpan = { onsetH: 4, endsH: 12 };
    eq("tiles: gale starting in 4 h → CAUTION, not GO", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "CAUTION");
    zoneAlertSpan = { onsetH: 9, endsH: 12 };
    eq("tiles: gale starting in 9 h → tile follows the weather (GO)", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "GO");
    zoneAlertSpan = { onsetH: -6, endsH: -1 };
    eq("tiles: a gale that has already ended → tile follows the weather (GO)", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "GO");

    zoneAlertSpan = { onsetH: 6, endsH: 12 };
    const later = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    eq("spot page: gale starting in 6 h → headline still lists it", later.recommendation?.level, "NO-GO");
    const ix = (later.hourly || []).findIndex((h) => h.level === "NO-GO");
    check("spot page: strip turns NO-GO when the gale starts, GO before", ix >= 5 && ix <= 7 && later.hourly[0].level === "GO", JSON.stringify((later.hourly || []).slice(0, 9).map((h) => h.level)));

    // A built spot saved without a zone had no alerts checked: never GO.
    zoneAlert = null; zoneAlertOnly = null; zoneAlertSpan = null;
    const kvNz = makeKV();
    await kvNz.put("builtspot:nozone-cove", JSON.stringify({ slug: "nozone-cove", name: "No-Zone Cove", lat: 41.5, lon: -82.0, lake: "Lake Erie", office: "CLE", product: "NSH", featured: true }));
    const { fetchBuiltSummaries } = await import("../functions/marine/conditions.js");
    const nz = (await fetchBuiltSummaries({ USERS: kvNz }, ["nozone-cove"]))[0];
    check("zone-less built spot: tile is not GO (alerts unchecked)", nz && nz.level !== "GO", JSON.stringify(nz));
    const nzWeek = (await fetchWeeks({ USERS: kvNz }, ["nozone-cove"]))["nozone-cove"] || [];
    check("zone-less built spot: today is not GO in the weekend outlook", nzWeek.length && nzWeek[0].level !== "GO", JSON.stringify(nzWeek.slice(0, 2)));

    zoneAlert = "down"; zoneAlertOnly = null; zoneAlertSpan = null;
    const tilesDown = (await fetchSummary(env)).spots;
    check("tiles: zone alerts unknown → no GO tile", tilesDown.every((t) => t.level !== "GO"), JSON.stringify(tilesDown.slice(0, 3).map((t) => t.level)));
    const winsDown = await fetchTodayWindows();
    check("digest: zone alerts unknown → no GO windows", Object.values(winsDown).every((w) => w == null));
    zoneAlert = null;
  }

  // 60. Alert classifier: wind/ice warnings that end a trip are NO-GO; no
  //     existing level is loosened; NWS test messages never count.
  {
    const { alertLevel, fetchAlerts, SPOTS } = await import("../functions/marine/conditions.js");
    for (const ev of ["Tornado Warning", "High Wind Warning", "Extreme Wind Warning", "Heavy Freezing Spray Warning"]) eq(`classifier: ${ev} → NO-GO`, alertLevel({ event: ev }), "NO-GO");
    for (const ev of ["Blizzard Warning", "Snow Squall Warning", "Lake Effect Snow Warning", "High Surf Warning", "Typhoon Warning", "Winter Storm Warning", "Ice Storm Warning", "Storm Surge Warning", "Tsunami Advisory"]) eq(`classifier: ${ev} → NO-GO`, alertLevel({ event: ev }), "NO-GO");
    for (const ev of ["High Surf Advisory", "Winter Weather Advisory", "Typhoon Watch", "Winter Storm Watch", "Dense Fog Advisory", "Low Water Advisory", "Brisk Wind Advisory", "Lake Wind Advisory", "Extreme Cold Warning", "Ashfall Warning", "Tropical Cyclone Local Statement"]) eq(`classifier: ${ev} → CAUTION`, alertLevel({ event: ev }), "CAUTION");
    // Stricter than the original classifier (was CAUTION): any freezing spray
    // ices a small boat's topsides; the advisory grade is still NO-GO.
    eq("classifier: Freezing Spray Advisory → NO-GO", alertLevel({ event: "Freezing Spray Advisory" }), "NO-GO");
    eq("classifier: Freezing Spray Watch → CAUTION", alertLevel({ event: "Freezing Spray Watch" }), "CAUTION");
    eq("classifier: High Wind Watch → CAUTION", alertLevel({ event: "High Wind Watch" }), "CAUTION");
    eq("classifier: Tornado Watch → CAUTION", alertLevel({ event: "Tornado Watch" }), "CAUTION");
    eq("classifier: Wind Advisory → CAUTION", alertLevel({ event: "Wind Advisory" }), "CAUTION");
    for (const [ev, lvl] of [["Gale Warning", "NO-GO"], ["Storm Warning", "NO-GO"], ["Severe Thunderstorm Warning", "NO-GO"], ["Special Marine Warning", "NO-GO"], ["Hurricane Force Wind Warning", "NO-GO"], ["Small Craft Advisory", "CAUTION"], ["Gale Watch", "CAUTION"], ["Freeze Warning", null], ["Rip Current Statement", null]]) {
      eq(`classifier unchanged: ${ev}`, alertLevel({ event: ev }), lvl);
    }
    alertTestStatus = "Test";
    const t = await fetchAlerts(SPOTS.sandusky);
    check("NWS test message is ignored (no alert, lookup ok)", t.ok && t.alerts.length === 0, JSON.stringify(t));
    alertTestStatus = "Exercise";
    const x = await fetchAlerts(SPOTS.sandusky);
    check("NWS exercise message is ignored", x.ok && x.alerts.length === 0, JSON.stringify(x));
    alertTestStatus = null;
  }

  // 61. Flash Flood Warning is CAUTION (debris/current at river ramps); a Flash
  //     Flood Emergency (catastrophic threat) is NO-GO; the watch, statement
  //     and other flood products stay shore-side notes.
  {
    const { alertLevel, buildRecommendation } = await import("../functions/marine/conditions.js");
    eq("flash flood: warning → CAUTION", alertLevel({ event: "Flash Flood Warning" }), "CAUTION");
    // NWS sends an emergency as event "Flash Flood Warning" + flashFloodDamageThreat CATASTROPHIC.
    eq("flash flood: emergency (catastrophic threat) → NO-GO", alertLevel({ event: "Flash Flood Warning", ffThreat: "CATASTROPHIC" }), "NO-GO");
    eq("flash flood: considerable threat stays CAUTION", alertLevel({ event: "Flash Flood Warning", ffThreat: "CONSIDERABLE" }), "CAUTION");
    eq("flash flood: literal emergency event → NO-GO", alertLevel({ event: "Flash Flood Emergency" }), "NO-GO");
    for (const ev of ["Flash Flood Watch", "Flash Flood Statement", "Flood Warning", "Flood Watch", "Flood Advisory", "Coastal Flood Warning", "Lakeshore Flood Warning"]) eq(`flash flood: ${ev} stays a note`, alertLevel({ event: ev }), null);
    // End to end: the threat parameter survives parsing, and when an emergency
    // and a later ordinary warning are both active, the emergency is the card kept.
    const { fetchAlerts, SPOTS } = await import("../functions/marine/conditions.js");
    const ffw = (sent, threat) => ({ properties: { status: "Actual", event: "Flash Flood Warning", severity: "Severe", sent, parameters: threat ? { flashFloodDamageThreat: [threat] } : {}, geocode: { UGC: ["OHC095"] } } });
    alertFeatures = [ffw("2026-07-01T10:00:00Z", "CATASTROPHIC"), ffw("2026-07-01T11:00:00Z", "CONSIDERABLE")];
    const fe = await fetchAlerts(SPOTS.toledo);
    check("flash flood: emergency card kept over a later ordinary warning", fe.ok && fe.alerts.length === 1 && alertLevel(fe.alerts[0]) === "NO-GO", JSON.stringify(fe.alerts));
    alertFeatures = [ffw("2026-07-01T10:00:00Z", null)];
    const fo = await fetchAlerts(SPOTS.toledo);
    check("flash flood: parsed warning without a threat tag → CAUTION", fo.ok && alertLevel(fo.alerts[0]) === "CAUTION", JSON.stringify(fo.alerts));
    alertFeatures = null;
    const em = buildRecommendation({ buoy: null, alerts: [{ event: "Flash Flood Warning", ffThreat: "CATASTROPHIC" }], wind: { speedKt: 6, gustKt: 8, source: "forecast", gustSrc: "forecast" }, waves: { ft: 1, source: "forecast" }, read: null, hours: [], profile: "lake" });
    eq("flash flood: calm day under a Flash Flood Emergency is NO-GO", em.level, "NO-GO");
    const r = buildRecommendation({ buoy: null, alerts: [{ event: "Flash Flood Warning" }], wind: { speedKt: 6, gustKt: 8, source: "forecast", gustSrc: "forecast" }, waves: { ft: 1, source: "forecast" }, read: null, hours: [], profile: "lake" });
    check("flash flood: calm day under a Flash Flood Warning is CAUTION, with the reason", r.level === "CAUTION" && r.reasons.some((x) => /Active Flash Flood Warning/.test(x)), JSON.stringify(r));
  }

  // 62. Land warnings (issued for counties / land forecast zones, never for
  //     marine zones) reach tiles, the digest window and the weekend outlook
  //     via the launch point's land zones; unresolved land zones block GO.
  {
    const { fetchSummary, fetchTodayWindows, fetchWeeks, fetchBuiltSummaries, fetchSpotsAlerts, SPOTS, landZonesFor: landZonesFor0 } = await import("../functions/marine/conditions.js");
    const env = { USERS: makeKV() };
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; zoneAlert = null; zoneAlertOnly = null; zoneAlertSpan = null;

    const calm = (await fetchSummary(env)).spots.find((x) => x.id === "sandusky");
    eq("land alerts: calm day, no land warning → tile GO", calm?.level, "GO");
    const sa = await fetchSpotsAlerts([SPOTS.sandusky]);
    check("land alerts: a curated spot uses its stored land zones", JSON.stringify(sa.land.get(`${SPOTS.sandusky.lat},${SPOTS.sandusky.lon}`)) === JSON.stringify(SPOTS.sandusky.land), JSON.stringify([...sa.land]));
    eq("land alerts: Mackinaw City watches both Cheboygan and Emmet counties", JSON.stringify(SPOTS.mackinaw.land), JSON.stringify(["MIZ017", "MIC031", "MIZ016", "MIC047"]));
    check("land alerts: every curated spot carries valid land zones", Object.values(SPOTS).every((x) => Array.isArray(x.land) && x.land.length && x.land.every((z) => /^[A-Z]{3}\d{3}$/.test(z))), Object.entries(SPOTS).filter(([, x]) => !Array.isArray(x.land)).map(([k]) => k).join());
    pointsCalls = 0;
    await fetchSpotsAlerts(Object.values(SPOTS));
    eq("land alerts: curated spots make no /points lookups for land zones", pointsCalls, 0);

    landAlert = "Tornado Warning";
    eq("land alerts: Tornado Warning on the county → tile NO-GO", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "NO-GO");
    eq("land alerts: no digest window under a Tornado Warning", (await fetchTodayWindows()).sandusky, null);
    eq("land alerts: weekend outlook today NO-GO", (await fetchWeeks(env, ["sandusky"])).sandusky?.[0]?.level, "NO-GO");

    landAlert = "Flash Flood Warning";
    eq("land alerts: Flash Flood Warning → tile CAUTION", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "CAUTION");

    landAlert = "Frost Advisory";
    eq("land alerts: shore-side land note doesn't move the tile", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "GO");
    landAlert = null;

    // A launch point whose /points has no land zones: land warnings unchecked → no GO.
    pointsNoZones = true;
    const kv = makeKV();
    await kv.put("builtspot:noland-cove", JSON.stringify({ slug: "noland-cove", name: "No-Land Cove", lat: 41.4321, lon: -82.1234, zone: "LEZ145", lake: "Lake Erie", office: "CLE", product: "NSH", featured: true }));
    const nl = (await fetchBuiltSummaries({ USERS: kv }, ["noland-cove"]))[0];
    check("land alerts: launch point's land zones unresolved → tile not GO", nl && nl.level !== "GO", JSON.stringify(nl));
    const nlw = (await fetchWeeks({ USERS: kv }, ["noland-cove"]))["noland-cove"] || [];
    check("land alerts: … and weekend today not GO", nlw.length && nlw[0].level !== "GO", JSON.stringify(nlw.slice(0, 1)));
    const { onRequest } = await import("../functions/marine/conditions.js");
    const nlp = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=noland-cove"), env: { USERS: kv } })).json();
    check("land alerts: … and its spot page reads alerts unknown, not GO", nlp.alertsOk === false && nlp.recommendation?.level !== "GO", JSON.stringify({ ok: nlp.alertsOk, level: nlp.recommendation?.level }));
    pointsNoZones = false;

    // The spot page checks the same land zones as its tile, so a zone-issued
    // land warning (no polygon; a water launch point is in no land zone) can't
    // leave the page softer than the tile.
    const spotPage = async () => (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env: { USERS: makeKV() } })).json();
    landAlert = "High Wind Warning";
    const hw = await spotPage();
    check("land alerts: spot page lists the county/zone High Wind Warning and is NO-GO", hw.recommendation?.level === "NO-GO" && (hw.alerts || []).some((a) => a.event === "High Wind Warning") && hw.alertsOk === true, JSON.stringify({ level: hw.recommendation?.level, alerts: hw.alerts }));
    eq("land alerts: … and its tile agrees", (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level, "NO-GO");
    landAlert = null;
    eq("land alerts: spot page calm with no land warning → GO", (await spotPage()).recommendation?.level, "GO");

    // Curated overrides where the nearest-land walk picks the wrong county.
    eq("land zones: San Juan → San Juan municipio, not Guaynabo", JSON.stringify(await landZonesFor0(SPOTS["san-juan"])), JSON.stringify(["PRZ001", "PRC127"]));
    check("land zones: Vermilion / Lorain watches both counties", ["OHC043", "OHC093"].every((z) => SPOTS.vermilion.land.includes(z)), JSON.stringify(SPOTS.vermilion.land));
    eq("land zones: Miami / Government Cut → coastal Miami-Dade zone", JSON.stringify(await landZonesFor0(SPOTS.miami)), JSON.stringify(["FLZ173", "FLC086"]));
    check("land zones: Sebastian Inlet watches Brevard and Indian River", ["FLC009", "FLC061"].every((z) => SPOTS["sebastian-inlet"].land.includes(z)), JSON.stringify(SPOTS["sebastian-inlet"].land));

    // A launch on the water (marine forecast zone, no county) resolves to the
    // county a step inland — never to the marine zone.
    const { landZonesFor } = await import("../functions/marine/conditions.js");
    pointsOnWater = (lat) => lat > 41.2; // everything north of 41.2 N is "lake"
    const wet = await landZonesFor({ lat: 41.25, lon: -82.5, zone: "LEZ145", lake: "Lake Erie" });
    check("land zones: on-water launch steps inland to its county", JSON.stringify(wet) === JSON.stringify(["OHZ007", "OHC043"]), JSON.stringify(wet));
    pointsOnWater = () => true;
    eq("land zones: no county anywhere nearby → null (unknown, not none)", await landZonesFor({ lat: 45.6789, lon: -84.321, zone: "LHZ345", lake: "Lake Huron" }), null);
    pointsOnWater = null;

    // Budget: one call walks at most 10 uncached built spots; the rest are
    // unknown (null → no GO) until a later call.
    const many = Array.from({ length: 14 }, (_, i) => ({ lat: 40.1 + i * 0.01, lon: -81.9, zone: "LEZ145", lake: "Lake Erie" }));
    pointsNoZones = true;
    pointsCalls = 0;
    const bud = await fetchSpotsAlerts(many);
    check("land walk budget: at most 10 uncached walks per call", [...bud.land.values()].every((v) => v === null) && pointsCalls <= 10 * 20, `${pointsCalls} lookups`);
    pointsNoZones = false;
    const many2 = many.map((x) => ({ ...x, lon: -81.7 })); // fresh points (the no-zone answers above are cached)
    const bud2 = await fetchSpotsAlerts(many2);
    eq("land walk budget: 10 resolve, the rest wait (unknown)", [...bud2.land.values()].filter(Boolean).length, 10);
    const bud3 = await fetchSpotsAlerts(many2);
    eq("land walk budget: the next call finishes them (first 10 cached)", [...bud3.land.values()].filter(Boolean).length, 14);

    // Shared budget: two calls in one invocation draw on one budget of 10.
    const { landWalkBudget } = await import("../functions/marine/conditions.js");
    const shared = landWalkBudget();
    const sixA = Array.from({ length: 6 }, (_, i) => ({ lat: 39.1 + i * 0.01, lon: -81.3, zone: "LEZ145", lake: "Lake Erie" }));
    const sixB = sixA.map((x) => ({ ...x, lon: -81.1 }));
    const ra = await fetchSpotsAlerts(sixA, shared);
    const rb = await fetchSpotsAlerts(sixB, shared);
    eq("land walk budget: shared across calls (6 + 4 resolve, 2 wait)", [...ra.land.values(), ...rb.land.values()].filter(Boolean).length, 10);
    eq("land walk budget: shared budget spent", shared.walks, 0);
    const own = await fetchSpotsAlerts(sixB.map((x) => ({ ...x, lon: -80.9 })));
    eq("land walk budget: a lone call still gets its own 10", [...own.land.values()].filter(Boolean).length, 6);

    // An errored closer candidate: use the farther county now, but don't cache it.
    pointsFail = (lat, lon) => lat === 39.5 && lon === -81.5;
    const errSpot = { lat: 39.5, lon: -81.5, zone: "LEZ145", lake: "Lake Erie" };
    check("land walk: still resolves past an errored lookup", Array.isArray(await landZonesFor(errSpot)));
    pointsFail = null; pointsCalls = 0;
    await landZonesFor(errSpot);
    check("land walk: a walk that hit an error isn't cached (walks again)", pointsCalls > 0, `${pointsCalls} lookups`);
    pointsCalls = 0;
    await landZonesFor(errSpot);
    eq("land walk: a clean walk is cached (no lookups next time)", pointsCalls, 0);

    // The spot page walks inland steps only (no ring): ≤ 4 lookups per request.
    pointsOnWater = () => true; pointsCalls = 0;
    eq("land walk (page): no ring → unresolved", await landZonesFor({ lat: 38.123, lon: -80.456, zone: "LEZ145", lake: "Lake Erie" }, null, { ring: false }), null);
    check("land walk (page): at most 4 /points lookups", pointsCalls <= 4, `${pointsCalls} lookups`);
    pointsOnWater = null;
  }

  // 63. Warned polygons: a storm-based warning listed for a whole county
  //     only reaches launches inside its polygon or within 10 nm of it;
  //     storm-track products also sweep 30 min along the storm's motion;
  //     marine products, Flash Flood Emergencies, track products without a
  //     motion, and malformed geometry all stay zone-wide.
  {
    const { alertReachesSpot, fetchSummary, fetchTodayWindows, onRequest, SPOTS } = await import("../functions/marine/conditions.js");
    const env = { USERS: makeKV() };
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; zoneAlert = null;
    const S = SPOTS.sandusky; // 41.46, -82.71
    const box = (lat, lon, d) => ({ type: "Polygon", coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]] });
    const rings = (g) => (g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]));
    const still = { towardDeg: 0, kt: 0 }; // parsed motion, stationary storm
    const poly = (g, event = "Tornado Warning", extra = { motion: still }) => ({ event, polygons: rings(g), ...extra });
    check("polygon: launch inside → applies", alertReachesSpot(poly(box(S.lat, S.lon, 0.05)), S));
    check("polygon: edge ~6 nm away → applies (within 10 nm)", alertReachesSpot(poly(box(S.lat - 0.15, S.lon, 0.05)), S));
    check("polygon: ~25 nm away, stationary → doesn't apply", !alertReachesSpot(poly(box(S.lat - 0.5, S.lon, 0.05)), S));
    check("polygon: MultiPolygon, one part near → applies", alertReachesSpot(poly({ type: "MultiPolygon", coordinates: [box(S.lat - 2, S.lon, 0.05).coordinates, box(S.lat, S.lon + 0.1, 0.05).coordinates] }), S));
    check("polygon: no polygon (zone-based) → applies zone-wide", alertReachesSpot({ event: "High Wind Warning", polygons: null }, S));
    // Box edge ~17 nm south of the launch. A storm moving north (from 180°) at
    // 30 kt covers 15 nm in the 30-min sweep: 17 - 15 = 2 nm ≤ 10 → applies.
    const south = box(S.lat - 0.33, S.lon, 0.05);
    check("polygon: storm 17 nm away moving at the launch (30 kt) → applies", alertReachesSpot(poly(south, "Severe Thunderstorm Warning", { motion: { towardDeg: 0, kt: 30 } }), S));
    check("polygon: same storm moving away → doesn't apply", !alertReachesSpot(poly(south, "Severe Thunderstorm Warning", { motion: { towardDeg: 180, kt: 30 } }), S));
    check("polygon: track product with no motion → applies county-wide", alertReachesSpot(poly(south, "Severe Thunderstorm Warning", {}), S));
    check("polygon: Snow Squall Warning with no motion → applies county-wide", alertReachesSpot(poly(south, "Snow Squall Warning", {}), S));
    check("polygon: plain Flash Flood Warning 25 nm away → doesn't apply", !alertReachesSpot(poly(box(S.lat - 0.5, S.lon, 0.05), "Flash Flood Warning", {}), S));
    check("polygon: Flash Flood Emergency (CATASTROPHIC) 25 nm away → applies county-wide", alertReachesSpot(poly(box(S.lat - 0.5, S.lon, 0.05), "Flash Flood Warning", { ffThreat: "CATASTROPHIC" }), S));
    check("polygon: Special Marine Warning 25 nm away → applies zone-wide", alertReachesSpot(poly(box(S.lat + 0.5, S.lon, 0.05), "Special Marine Warning"), S));
    check("polygon: Marine Weather Statement 25 nm away → applies zone-wide", alertReachesSpot(poly(box(S.lat + 0.5, S.lon, 0.05), "Marine Weather Statement"), S));
    // Antimeridian: a launch inside a polygon straddling 180°, every edge
    // ~18 nm away (unwrapped longitudes would put it outside and far off).
    const am = { lat: 52, lon: 179.99 };
    const amRing = [[179.5, 51.7], [-179.5, 51.7], [-179.5, 52.3], [179.5, 52.3], [179.5, 51.7]];
    check("polygon: launch inside a polygon across the antimeridian → applies", alertReachesSpot({ event: "Flash Flood Warning", polygons: [amRing] }, am));
    // Box east of the launch whose west side (~9 nm away) is the closing edge;
    // without it the nearest point would be a corner ~15 nm away.
    const unclosed = box(S.lat, S.lon + 0.4, 0.2).coordinates[0].slice(0, 4).reverse(); // NW, NE, SE, SW: the west side is the implied closing edge
    check("polygon: unclosed ring still measures its closing edge (~9 nm → applies)", alertReachesSpot({ event: "Flash Flood Warning", polygons: [unclosed] }, S));

    const tile = async () => (await fetchSummary(env)).spots.find((x) => x.id === "sandusky")?.level;
    const MOT_STILL = "2026-11-07T00:00:00-00:00...storm...270DEG...0KT...41.0,-83.0";
    landAlert = "Tornado Warning"; landAlertMotion = MOT_STILL;
    landAlertGeom = box(S.lat - 0.5, S.lon - 0.3, 0.05); // far end of the county (~30 nm)
    eq("polygon: far-county Tornado Warning → tile follows the weather (GO)", await tile(), "GO");
    check("polygon: … and a digest window is still offered", (await fetchTodayWindows()).sandusky != null);
    const pFar = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    check("polygon: … and the spot page agrees (no NO-GO, not listed)", pFar.recommendation?.level !== "NO-GO" && !(pFar.alerts || []).some((a) => a.event === "Tornado Warning"), JSON.stringify({ l: pFar.recommendation?.level, a: (pFar.alerts || []).map((a) => a.event) }));
    landAlertMotion = null;
    eq("polygon: same far Tornado Warning without a motion → tile NO-GO (fails toward applying)", await tile(), "NO-GO");
    landAlertMotion = MOT_STILL;
    landAlertGeom = { type: "Polygon", coordinates: [[[-82.7, 41.0], ["x", 41.1], [-82.6, 41.1], [-82.7, 41.0]]] };
    eq("polygon: malformed geometry → tile NO-GO (zone-wide)", await tile(), "NO-GO");
    landAlertGeom = { type: "GeometryCollection", geometries: [box(S.lat - 0.5, S.lon - 0.3, 0.05)] };
    eq("polygon: GeometryCollection → tile NO-GO (zone-wide)", await tile(), "NO-GO");
    landAlertGeom = box(S.lat - 0.1, S.lon, 0.05); // ~3 nm from the launch
    eq("polygon: nearby Tornado Warning → tile NO-GO", await tile(), "NO-GO");
    const pNear = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    eq("polygon: … spot page NO-GO", pNear.recommendation?.level, "NO-GO");
    landAlert = "High Wind Warning"; landAlertGeom = null; landAlertMotion = null; // zone-based, no polygon
    eq("polygon: zone-based High Wind Warning still applies county-wide", await tile(), "NO-GO");
    landAlert = null; landAlertGeom = null; landAlertMotion = null;
  }

  // 58b. Grid sampling: a spot's gridSteps override skips an enclosed inner-bay
  //     cell; spots without one (all of Lake Erie) sample exactly as before.
  {
    const { SPOTS, gridStepsFor, gridSamplePoints } = await import("../functions/marine/conditions.js");
    const erie = Object.entries(SPOTS).filter(([, s]) => (s.lake || "Lake Erie") === "Lake Erie");
    check("grid steps: every Lake Erie spot keeps the default lake steps", erie.length > 0 && erie.every(([, s]) => gridStepsFor(s).join() === "0.035,0.1,0.22"), erie.filter(([, s]) => gridStepsFor(s).join() !== "0.035,0.1,0.22").map(([k]) => k).join());
    const sand = gridSamplePoints(SPOTS.sandusky)[0];
    check("grid steps: Sandusky's first sample is still 0.035 deg toward the lake center", sand.step === 0.035 && Math.abs(Math.hypot(sand.lat - SPOTS.sandusky.lat, sand.lon - SPOTS.sandusky.lon) - 0.035) < 1e-3, JSON.stringify(sand));
    eq("grid steps: Alpena starts at the Thunder Bay mouth, not the inner bay", JSON.stringify(gridSamplePoints(SPOTS.alpena)[0]), JSON.stringify({ step: 0.14, lat: 45.0008, lon: -83.2404 }));
    check("grid steps: Alpena never samples the inner-bay cell (0.035)", !gridSamplePoints(SPOTS.alpena).some((p) => p.step < 0.14));
    eq("grid steps: ocean spots keep the ocean steps", gridStepsFor(SPOTS.jacksonville).join(), "0.06,0.1,0.22");
    eq("grid steps: inland water samples the point only", gridStepsFor({ lat: 40, lon: -80, lake: "Some Reservoir" }).join(), "0");
    eq("grid steps: an empty override falls back to the defaults", gridStepsFor({ ...SPOTS.alpena, gridSteps: [] }).join(), "0.035,0.1,0.22");
  }

  // 58c. Spot geometry (Nov 2026 live audit): zones that cover the launch,
  //      sea bearings whose grid walk reaches real wave cells, and exposure
  //      lists that match the shoreline.
  {
    const { SPOTS, gridSamplePoints, windExposure, alertZonesFor, ugcZones, nshPeriodsForZone } = await import("../functions/marine/conditions.js");
    const { regionForLake } = await import("../src/regions.js");
    const h = SPOTS.houghton;
    eq("geometry: Houghton's zone is LSZ242 (Ontonagon to the Portage Canal upper entrance), not LSZ267", h.zone, "LSZ242");
    eq("geometry: Houghton is forecast by MQT's NSH", `${h.office}|${h.product || "NSH"}`, "MQT|NSH");
    check("geometry: Houghton also watches LSZ243 (east of the North Entry)", alertZonesFor(h).includes("LSZ243") && alertZonesFor(h).includes("LSZ242"), JSON.stringify(alertZonesFor(h)));
    check("geometry: Houghton also watches LSZ246 (Portage waterway / Keweenaw Bay)", alertZonesFor(h).includes("LSZ246"), JSON.stringify(alertZonesFor(h)));
    eq("geometry: Houghton's walk starts in Superior off the North Entry", JSON.stringify(gridSamplePoints(h)[0]), JSON.stringify({ step: 0.13, lat: 47.2326, lon: -88.6655 }));
    const exp = (id) => { const e = windExposure(SPOTS[id]); return `${e.onshore.join()}|${e.offshore.join()}`; };
    const bearings = {
      mackinaw: [20, "N,NNE,NE,ENE,NNW|SSE,S,SSW,SW,WSW"],          // the Straits, north of the tip
      petoskey: [300, "WSW,W,WNW,NW,NNW|ENE,E,ESE,SE,SSE"],          // out Little Traverse Bay
      "traverse-city": [15, "N,NNE,NE,ENE,NNW|SSE,S,SSW,SW,WSW"],   // up West Grand Traverse Bay
      houghton: [330, "N,NNE,WNW,NW,NNW|ESE,SE,SSE,S,SSW"],          // toward the North Entry
      muskegon: [270, "SW,WSW,W,WNW,NW|NE,ENE,E,ESE,SE"],            // west-facing shore
      holland: [270, "SW,WSW,W,WNW,NW|NE,ENE,E,ESE,SE"],
      "cross-village": [270, "SW,WSW,W,WNW,NW|NE,ENE,E,ESE,SE"],
    };
    for (const [id, [sea, want]] of Object.entries(bearings)) {
      eq(`geometry: ${id} sea bearing`, SPOTS[id].sea, sea);
      eq(`geometry: ${id} onshore|offshore`, exp(id), want);
    }
    eq("geometry: Muskegon's zone is LMZ847 (Grand Haven to Whitehall), not St Joseph's LMZ844", SPOTS.muskegon.zone, "LMZ847");
    eq("geometry: Bayfield's zone is LSZ147 (Sand Island to Bayfield), not Silver Bay MN's LSZ143", SPOTS.bayfield.zone, "LSZ147");
    eq("geometry: Sandusky's zone is LEZ144 (Sandusky Bay, Cedar Point)", SPOTS.sandusky.zone, "LEZ144");
    check("geometry: Sandusky still watches LEZ143 (the islands)", alertZonesFor(SPOTS.sandusky).includes("LEZ143"));
    check("geometry: Vermilion watches LEZ144 and LEZ145", ["LEZ144", "LEZ145"].every((z) => alertZonesFor(SPOTS.vermilion).includes(z)));
    // Every curated zone is a well-formed marine zone whose prefix belongs to
    // its region (a Superior spot can't carry an Erie zone, etc.).
    const PREFIXES = {
      greatlakes: /^L[EOHMS]Z/, florida: /^(AMZ|GMZ)/, "gulf-coast": /^GMZ/, southeast: /^AMZ/, socal: /^PZZ/,
      islands: /^(PHZ|AMZ)/, pnw: /^PZZ/, oregon: /^PZZ/, norcal: /^PZZ/, northeast: /^ANZ/, alaska: /^PKZ/,
      chesapeake: /^ANZ/, carolina: /^AMZ/,
    };
    const bad = Object.entries(SPOTS).filter(([, s]) => {
      const r = regionForLake(s.lake || "Lake Erie");
      const zones = [s.zone, ...(s.alertZones || []), ...(s.bar?.zone ? [s.bar.zone] : [])];
      return !r || !PREFIXES[r.slug] || !zones.every((z) => /^[A-Z]{3}\d{3}$/.test(String(z)) && PREFIXES[r.slug].test(z));
    }).map(([id, s]) => `${id}:${s.zone}`);
    check("geometry: every spot zone is ^[A-Z]{3}\\d{3}$ with its region's prefix", Object.keys(SPOTS).length >= 90 && bad.length === 0, bad.join(", "));
    const glNsh = Object.entries(SPOTS).filter(([, s]) => /^L[EOHMS]Z/.test(s.zone) !== ((s.product || "NSH") === "NSH")).map(([id]) => id);
    check("geometry: Great Lakes zones read NSH, coastal zones CWF", glNsh.length === 0, glNsh.join(", "));

    // UGC parsing keeps the zone prefix: APX's NSH carries LMZ345 (Point
    // Betsie to Sleeping Bear) ahead of LHZ345 (Straits of Mackinac).
    eq("ugc: range", ugcZones("LEZ144>148").join(), "LEZ144,LEZ145,LEZ146,LEZ147,LEZ148");
    eq("ugc: list", ugcZones("LMZ344-345").join(), "LMZ344,LMZ345");
    eq("ugc: prefix change mid-list", ugcZones("LMZ344-345-LHZ345>346").join(), "LMZ344,LMZ345,LHZ345,LHZ346");
    const apx = [
      "LMZ344-345-071930-", "Sleeping Bear Point to Grand Traverse Light MI-", "626 AM EST Sat Nov 7 2026", "",
      ".TODAY...West wind 10 knots. Waves 2 feet or less.", ".TONIGHT...Southwest wind 15 to 20 knots. Waves 4 to 6 feet.", "", "$$",
      "LHZ345-071930-", "Straits of Mackinac within 5 nm of Mackinac Bridge-", "626 AM EST Sat Nov 7 2026", "",
      ".TODAY...West wind 10 to 15 knots. Waves 1 foot or less.", ".TONIGHT...Southwest wind 15 to 25 knots. Waves 3 to 5 feet.", "", "$$",
    ].join("\n");
    eq("nsh: LHZ345 reads the Straits forecast, not LMZ345's", nshPeriodsForZone(apx, "LHZ345")[1]?.forecast, "Southwest wind 15 to 25 knots. Waves 3 to 5 feet.");
    eq("nsh: LMZ345 still reads its own block", nshPeriodsForZone(apx, "LMZ345")[1]?.forecast, "Southwest wind 15 to 20 knots. Waves 4 to 6 feet.");
    eq("nsh: a zone that isn't in the product reads nothing", nshPeriodsForZone(apx, "LHZ346").length, 0);
    eq("nsh: a range header still matches (LEZ144>148)", nshPeriodsForZone("LEZ144>148-072115-\n.TODAY...NE wind 10 knots. Waves 2 feet.\n$$", "LEZ146")[0]?.name, "Today");
  }

  // 58d. Digest windows use the same nearshore wave floor as tiles and weeks:
  //      no window on a calm grid cell when the official NSH says 5-7 ft.
  {
    const { fetchTodayWindows } = await import("../functions/marine/conditions.js");
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; zoneAlert = null; gridWavesAt = null;
    nshMock = null;
    // The digest is built in the morning; pin the clock to 7 AM Eastern (12:00
    // UTC) so the floor's "current half-day" is today's daytime. Run in the
    // evening, the day's earlier hours fall before the floor and the test
    // flipped with the time of day.
    const realNow = Date.now;
    const pinned = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 12);
    Date.now = () => pinned;
    try {
      check("digest floor: calm grid, no NSH text → Sandusky gets a window", (await fetchTodayWindows()).sandusky != null);
      const per = ["TODAY", "TONIGHT", "SUNDAY", "SUNDAY NIGHT", "MONDAY", "MONDAY NIGHT"].map((n) => `.${n}...Northeast wind 20 to 25 knots. Waves 5 to 7 feet.`);
      nshMock = ["LEZ144>148-072115-", "Vermilion to Avon Point OH-", "", ...per, "", "$$"].join("\n");
      eq("digest floor: NSH 5-7 ft for LEZ144 → no Sandusky window", (await fetchTodayWindows()).sandusky, null);
    } finally { Date.now = realNow; nshMock = null; }
  }

  // ── Windy player URLs: only https windy.com hosts reach the iframe src ──
  {
    const { safeWindyPlayer } = await import("../functions/marine/conditions.js");
    const ok = "https://webcams.windy.com/webcams/public/embed/player/123/live";
    eq("windy player: https webcams.windy.com kept", safeWindyPlayer(ok), ok);
    eq("windy player: https windy.com apex kept", safeWindyPlayer("https://windy.com/x"), "https://windy.com/x");
    eq("windy player: javascript: rejected", safeWindyPlayer("javascript:alert(1)"), null);
    eq("windy player: data: rejected", safeWindyPlayer("data:text/html,<script>alert(1)</script>"), null);
    eq("windy player: http: rejected", safeWindyPlayer("http://webcams.windy.com/p/1"), null);
    eq("windy player: lookalike host rejected", safeWindyPlayer("https://evilwindy.com/p/1"), null);
    eq("windy player: windy.com as subdomain of another host rejected", safeWindyPlayer("https://windy.com.evil.example/p"), null);
    eq("windy player: userinfo trick rejected", safeWindyPlayer("https://windy.com@evil.example/p"), null);
    eq("windy player: unparseable rejected", safeWindyPlayer("not a url"), null);
    eq("windy player: non-string rejected", safeWindyPlayer({ embed: ok }), null);
    eq("windy player: protocol-relative rejected", safeWindyPlayer("//webcams.windy.com/p/1"), null);
    // End to end: a hostile player entry never reaches a cam's embed.
    const { fetchWindyCams } = await import("../functions/marine/conditions.js");
    const realFetch = globalThis.fetch;
    const water = [{ id: "harbor", name: "Harbor" }];
    globalThis.fetch = async (u) => (String(u).startsWith("https://api.windy.com/")
      ? new Response(JSON.stringify({ webcams: [
          { webcamId: 111, title: "Marina", categories: water, player: { live: "javascript:alert(1)", day: "https://evil.example/day" } },
          { webcamId: 222, title: "Beach", categories: water, player: { live: ok } },
          { webcamId: 333, title: "Pier", categories: water, player: { day: { embed: "data:text/html,x" } } },
        ] }), { status: 200, headers: { "content-type": "application/json" } })
      : realFetch(u));
    try {
      const cams = await fetchWindyCams({ WINDY_WEBCAMS_KEY: "test" }, 41.5, -82.7, "Lake Erie");
      const by = Object.fromEntries((cams || []).map((c) => [c.link.match(/\d+$/)?.[0], c]));
      eq("windy cams: hostile live+day → id-built day player", by["111"]?.embed, "https://webcams.windy.com/webcams/public/embed/player/111/day");
      eq("windy cams: replay player flagged replay:true", by["111"]?.replay, true);
      check("windy cams: live player not flagged replay", !by["222"]?.replay);
      check("windy cams: rejected live URL is not labeled live", /replay/.test(by["111"]?.name || ""), by["111"]?.name);
      eq("windy cams: valid live player kept", by["222"]?.embed, ok);
      eq("windy cams: hostile v2 embed object → id-built day player", by["333"]?.embed, "https://webcams.windy.com/webcams/public/embed/player/333/day");
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  // ── Windy cam links: only https windy.com detail / https provider reach <a href> ──
  {
    const { safeWindyLink, fetchWindyCams } = await import("../functions/marine/conditions.js");
    const detail = "https://www.windy.com/webcams/123";
    const fb = (id) => `https://www.windy.com/webcams/${id}`;
    eq("windy link: https windy.com detail kept", safeWindyLink({ detail, provider: "https://owner.test/" }, 123), detail);
    eq("windy link: https provider used when detail missing", safeWindyLink({ provider: "https://owner.test/cam" }, 123), "https://owner.test/cam");
    eq("windy link: off-host detail skipped for https provider", safeWindyLink({ detail: "https://evil.example/d", provider: "https://owner.test/" }, 1), "https://owner.test/");
    eq("windy link: http detail rejected", safeWindyLink({ detail: "http://www.windy.com/webcams/1" }, 1), fb(1));
    eq("windy link: javascript: provider rejected", safeWindyLink({ provider: "javascript:alert(1)" }, 7), fb(7));
    eq("windy link: data: provider rejected", safeWindyLink({ provider: "data:text/html,x" }, 7), fb(7));
    eq("windy link: http provider rejected", safeWindyLink({ provider: "http://owner.test/" }, 7), fb(7));
    eq("windy link: lookalike detail host rejected", safeWindyLink({ detail: "https://windy.com.evil.example/x" }, 7), fb(7));
    eq("windy link: no urls → id-built page", safeWindyLink(undefined, 7), fb(7));
    eq("windy link: fallback id is URI-encoded", safeWindyLink({}, "1/../x?y"), "https://www.windy.com/webcams/1%2F..%2Fx%3Fy");
    const realFetch = globalThis.fetch;
    const water = [{ id: "harbor", name: "Harbor" }];
    globalThis.fetch = async (u) => (String(u).startsWith("https://api.windy.com/")
      ? new Response(JSON.stringify({ webcams: [
          { webcamId: 444, title: "Marina", categories: water, urls: { detail: "javascript:alert(1)", provider: "javascript:alert(2)" } },
          { webcamId: 555, title: "Beach", categories: water, urls: { detail: "https://www.windy.com/webcams/555" } },
        ] }), { status: 200, headers: { "content-type": "application/json" } })
      : realFetch(u));
    try {
      const cams = await fetchWindyCams({ WINDY_WEBCAMS_KEY: "test" }, 41.5, -82.7, "Lake Erie");
      const by = Object.fromEntries((cams || []).map((c) => [c.embed.match(/player\/(\d+)/)?.[1], c]));
      eq("windy cams: hostile detail+provider → windy page link", by["444"]?.link, fb(444));
      eq("windy cams: valid detail link kept", by["555"]?.link, "https://www.windy.com/webcams/555");
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  // ── Custom cams: admin-entered image/link URLs must be https; ids are URI-encoded ──
  {
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const admin = await seedUser(env, "admin@example.com");
    const base = { lake: "Lake Erie", lat: 41.5, lon: -82.7 };
    const config = { cams: { disabled: [], custom: [
      { ...base, name: "Good photo", kind: "img", id: "https://cams.test/a.jpg", link: "https://cams.test/" },
      { ...base, name: "Bad link", kind: "img", id: "https://cams.test/b.jpg", link: "javascript:alert(1)" },
      { ...base, name: "Http link", kind: "img", id: "https://cams.test/c.jpg", link: "http://cams.test/" },
      { ...base, name: "JS image", kind: "img", id: "javascript:alert(1)" },
      { ...base, name: "Data image", kind: "img", id: "data:image/svg+xml,<svg onload=alert(1)>" },
      { ...base, name: "Http image", kind: "img", id: "http://cams.test/d.jpg" },
      { ...base, name: "YT", kind: "yt", id: "abc123", link: "javascript:alert(1)" },
    ] } };
    const r = await call(req("PUT", "/api/admin/config", { cookie: admin, body: { config } }), env);
    eq("custom cams PUT: → 200", r.status, 200);
    const by = Object.fromEntries((await r.json()).config.cams.custom.map((e) => [e.name, e]));
    eq("custom cams: https image + link kept", JSON.stringify([by["Good photo"]?.id, by["Good photo"]?.link]), JSON.stringify(["https://cams.test/a.jpg", "https://cams.test/"]));
    eq("custom cams: javascript: link dropped, cam kept", JSON.stringify([by["Bad link"]?.id, by["Bad link"]?.link]), JSON.stringify(["https://cams.test/b.jpg", ""]));
    eq("custom cams: http link dropped", by["Http link"]?.link, "");
    check("custom cams: javascript:/data:/http: image URLs drop the entry", !by["JS image"] && !by["Data image"] && !by["Http image"], JSON.stringify(Object.keys(by)));
    eq("custom cams: non-image id untouched, bad link dropped", JSON.stringify([by.YT?.id, by.YT?.link]), JSON.stringify(["abc123", ""]));

    // Client repeats the checks (config could predate the server fix).
    const { normalizeCustomCam, camLink, camSrc, safeHttps } = await import("../src/cams.js");
    const n = (e) => normalizeCustomCam({ ...base, ...e });
    eq("normalizeCustomCam: https image + link kept", camLink(n({ name: "a", kind: "img", id: "https://cams.test/a.jpg", link: "https://cams.test/" })), "https://cams.test/");
    eq("normalizeCustomCam: javascript: image rejected", n({ name: "a", kind: "img", id: "javascript:alert(1)" }), null);
    eq("normalizeCustomCam: data: image rejected", n({ name: "a", kind: "img", id: "data:image/png;base64,AA" }), null);
    eq("normalizeCustomCam: http image rejected", n({ name: "a", kind: "img", id: "http://cams.test/a.jpg" }), null);
    const badLink = n({ name: "a", kind: "img", id: "https://cams.test/a.jpg", link: "javascript:alert(1)" });
    check("normalizeCustomCam: javascript: link dropped", badLink && !("link" in badLink), JSON.stringify(badLink));
    eq("camLink: unsafe link falls back to the https image", camLink(badLink), "https://cams.test/a.jpg");
    eq("camLink: unsafe link on a raw cam object never returned", camLink({ img: "https://cams.test/a.jpg", link: "javascript:alert(1)" }), "https://cams.test/a.jpg");
    eq("camLink: unsafe embed link falls back to the embed", camLink({ embed: "https://webcams.windy.com/p/1", link: "javascript:x" }), "https://webcams.windy.com/p/1");
    eq("safeHttps: protocol-relative rejected", safeHttps("//cams.test/a.jpg"), "");
    // Provider ids are URI-encoded, so they can't inject params or paths.
    const evil = "x&autoplay=0#\"/../y";
    const e = encodeURIComponent(evil);
    for (const kind of ["angelcam", "wetmet", "ipcamlive", "ozolio", "ytChannel", "yt"]) {
      check(`camSrc: ${kind} id URI-encoded`, camSrc({ [kind]: evil }).includes(e) && !camSrc({ [kind]: evil }).includes(evil), camSrc({ [kind]: evil }));
      check(`camLink: ${kind} id URI-encoded`, camLink({ [kind]: evil }).includes(e) && !camLink({ [kind]: evil }).includes(evil), camLink({ [kind]: evil }));
    }
    eq("normalizeCustomCam: valid yt id kept", n({ name: "a", kind: "yt", id: "ZZevIUr2cTk" })?.yt, "ZZevIUr2cTk");
    eq("normalizeCustomCam: path-like yt id rejected", n({ name: "a", kind: "yt", id: "x/../../somepath" }), null);
    eq("normalizeCustomCam: odd-case kind rejected", n({ name: "a", kind: "IMG", id: "https://cams.test/a.jpg" }), null);
    const { CAMS } = await import("../src/cams.js");
    eq("camSrc: built-in yt id unchanged by encoding", camSrc({ yt: "ZZevIUr2cTk" }), "https://www.youtube.com/embed/ZZevIUr2cTk?autoplay=1&mute=1&rel=0");
    const kinds = ["angelcam", "wetmet", "ipcamlive", "ozolio", "ytChannel", "yt"];
    const changed = CAMS.filter((c) => kinds.some((k) => c[k] != null && encodeURIComponent(c[k]) !== String(c[k])));
    check("cams: built-in provider ids are already URL-safe (encoding is a no-op)", !changed.length, JSON.stringify(changed.map((c) => c.name)));
  }

  // ── Launch-facts card: a configured buoy is not a live buoy ──
  {
    const { SPOTS, spotFacts } = await import("../functions/marine/conditions.js");
    const { seoForPath } = await import("../functions/seo.js");
    const fc = { source: "forecast" };
    const off = spotFacts(SPOTS.duluth, { buoy: null, wind: fc, waves: fc }).liveData;
    check("facts: pulled buoy (Duluth 45027) → not live, listed offline", off.checked && off.live === null && off.offline.join() === "45027", JSON.stringify(off));
    const on = spotFacts({ buoys: ["45176", "45164", "45005"] }, { buoy: { station: "45164", ageMinutes: 30, observedAt: "2026-07-01T12:00:00Z" }, wind: { source: "buoy" }, waves: fc }).liveData;
    check("facts: fallback buoy live → earlier station offline, later unchecked omitted", on.live === "45164" && on.offline.join() === "45176" && on.ageMinutes === 30 && on.wavesFrom === "forecast", JSON.stringify(on));
    const stray = spotFacts({ buoys: ["45004"] }, { buoy: { station: "99999", ageMinutes: 5 }, wind: fc, waves: fc }).liveData;
    check("facts: buoy not in the spot's list is never called live", stray.live === null, JSON.stringify(stray));
    const dbl = spotFacts(SPOTS.duluth, { buoy: null, wind: { source: null }, waves: { source: null } }).liveData;
    check("facts: buoy pulled AND forecast down → sources null, not 'forecast'", dbl.windFrom === null && dbl.wavesFrom === null, JSON.stringify(dbl));
    const temps = spotFacts({ buoys: ["45005"] }, { buoy: { station: "45005", ageMinutes: -3, observedAt: "bad" }, wind: fc, waves: { source: null } }).liveData;
    check("facts: fresh buoy with temps only → live, wind forecast, waves null; skewed age clamped; bad time dropped", temps.live === "45005" && temps.windFrom === "forecast" && temps.wavesFrom === null && temps.ageMinutes === 0 && temps.observedAt === null, JSON.stringify(temps));
    check("facts: no conditions fetch → liveData.checked false", spotFacts(SPOTS.marquette).liveData.checked === false);
    const html = JSON.stringify(seoForPath("/spot/marquette"));
    check("seo: spot page never advertises a buoy as live", !/Live (observations|data)/.test(html) && /Buoy stations/.test(html));
    check("seo: Great Lakes page mentions winter buoy pulls", /pulled in winter/.test(html));
    const coastId = Object.keys(SPOTS).find((id) => SPOTS[id].water && SPOTS[id].water !== "lake" && (SPOTS[id].buoys || []).length);
    const chtml = JSON.stringify(seoForPath(`/spot/${coastId}`));
    check("seo: coastal page has no Great Lakes winter note", /Buoy stations/.test(chtml) && !/pulled in winter/.test(chtml) && !/Live (observations|data)/.test(chtml), coastId);
  }

  // 58. Buoy fallback: a fresh temps-only station (no wind, no waves) must not
  //     stand in for the live buoy. The walk continues to a later station that
  //     reports wind/waves, and when none does the verdict says it is running
  //     on the forecast (wind.source / waves.source, not the buoy object).
  {
    const { fetchBuoy, buildRecommendation, onRequest } = await import("../functions/marine/conditions.js");
    // NDBC realtime2 line: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
    const ndbc = ({ ageMin = 20, wdir = "MM", wspd = "MM", gst = "MM", wvht = "MM", dpd = "MM", atmp = "MM", wtmp = "MM" } = {}) => {
      const t = new Date(Date.now() - ageMin * 60000);
      const p2 = (n) => String(n).padStart(2, "0");
      return "#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE\n#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC  degC  degC  nmi  hPa    ft\n"
        + [t.getUTCFullYear(), p2(t.getUTCMonth() + 1), p2(t.getUTCDate()), p2(t.getUTCHours()), p2(t.getUTCMinutes()), wdir, wspd, gst, wvht, dpd, "MM", "MM", "1015.0", atmp, wtmp, "MM", "MM", "MM", "MM"].join(" ") + "\n";
    };
    const TEMPS = ndbc({ atmp: "12.0", wtmp: "10.0" }); // temps-only: 50°F water, 53.6°F air
    const MET = ndbc({ wdir: "220", wspd: "5.0", gst: "6.0", wvht: "0.5", dpd: "4", atmp: "14.0" }); // ~10 kt, 1.6 ft, no water temp

    ndbcFiles = { TMPS1: TEMPS, METB1: MET };
    let r = await fetchBuoy(["TMPS1", "METB1"]);
    eq("fetchBuoy: temps-only first station is skipped for the wind/wave buoy", r.buoy?.station, "METB1");
    eq("fetchBuoy: temps-only station kept for the tiles", r.tempsObs?.station, "TMPS1");
    r = await fetchBuoy(["TMPS1"]);
    eq("fetchBuoy: temps-only alone → no live buoy", r.buoy, null);
    eq("fetchBuoy: temps-only alone → temps still available", r.tempsObs?.waterTempF, 50);
    ndbcFiles = { WAVE1: ndbc({ wvht: "1.0", dpd: "5" }) };
    r = await fetchBuoy(["WAVE1"]);
    eq("fetchBuoy: waves-only station is accepted", r.buoy?.station, "WAVE1");
    ndbcFiles = { GUST1: ndbc({ gst: "8.0", atmp: "12.0" }) };
    r = await fetchBuoy(["GUST1"]);
    eq("fetchBuoy: gust-only station still counts as a met station", r.buoy?.station, "GUST1");
    ndbcFiles = { OLD01: ndbc({ ageMin: 240, wspd: "5.0" }), METB1: MET };
    r = await fetchBuoy(["OLD01", "METB1"]);
    eq("fetchBuoy: stale (>3 h) station still skipped", r.buoy?.station, "METB1");
    ndbcFiles = {};
    r = await fetchBuoy(["GONE1"]);
    check("fetchBuoy: nothing reporting → { buoy: null, tempsObs: null }", r.buoy === null && r.tempsObs === null, JSON.stringify(r));

    const FC_NOTE = /No live buoy here; using the NWS forecast/;
    const recOf = (buoy, wind, waves) => buildRecommendation({ buoy, alerts: [], wind, waves, read: null, hours: [], profile: "lake" });
    const tempsBuoy = { station: "TMPS1", windKt: null, waveHeightFt: null, waterTempF: 70 };
    let rr = recOf(tempsBuoy, { speedKt: 8, source: "forecast" }, { ft: 1, source: "forecast" });
    check("headline: temps-only buoy object, forecast wind+waves → forecast-only reason shown", rr.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(rr.reasons));
    rr = recOf({ station: "METB1", windKt: 9 }, { speedKt: 9, source: "buoy" }, { ft: 1, source: "forecast" });
    check("headline: buoy wind → no forecast-only reason", !rr.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(rr.reasons));
    rr = recOf({ station: "WAVE1", waveHeightFt: 1 }, { speedKt: 9, source: "forecast" }, { ft: 1, source: "buoy" });
    check("headline: buoy waves → no forecast-only reason", !rr.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(rr.reasons));
    rr = recOf({ station: "GUST1", windGustKt: 16 }, { speedKt: 8, gustKt: 16, source: "forecast", gustSrc: "buoy" }, { ft: 1, source: "forecast" });
    check("headline: buoy gust only → no forecast-only reason (agrees with the facts card)", !rr.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(rr.reasons));
    rr = recOf(null, { speedKt: null, source: null }, { ft: null, source: null });
    check("headline: no data → CAUTION, no forecast-only reason (no-data reason covers it)", rr.level === "CAUTION" && !rr.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(rr));

    // End to end through the spot page (stubbed NWS: calm, 9 mph SW, 1 ft).
    const page = async (spot) => (await onRequest({ request: new Request(`https://shouldiboat.com/marine/conditions?spot=${spot}`), env: {} })).json();
    const sandusky = (await import("../functions/marine/conditions.js")).SPOTS.sandusky;
    const saved = sandusky.buoys;
    try {
      sandusky.buoys = ["TMPS1", "METB1"];
      ndbcFiles = { TMPS1: TEMPS, METB1: MET };
      let d = await page("sandusky");
      eq("page: fallback met buoy supplies wind", d.wind?.source, "buoy");
      eq("page: fallback met buoy supplies waves", d.waves?.source, "buoy");
      eq("page: buoy is the met station", d.buoy?.station, "METB1");
      eq("page: water tile from the temps-only station", d.temps?.waterSource, "NDBC TMPS1");
      eq("page: air tile from the earlier-listed station", d.temps?.airSource, "NDBC TMPS1");
      eq("page: earlier-listed station's water temp wins", d.temps?.waterF, 50);
      eq("page: facts card calls the fallback met buoy live", d.facts?.liveData?.live, "METB1");
      eq("page: facts card lists the temps-only station as not reporting wind/waves", d.facts?.liveData?.offline?.join(), "TMPS1");
      check("page: facts card sources agree with the verdict", d.facts?.liveData?.windFrom === "buoy" && d.facts?.liveData?.wavesFrom === "buoy", JSON.stringify(d.facts?.liveData));
      check("page: no forecast-only reason when the fallback buoy reports", !d.recommendation.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(d.recommendation.reasons));

      sandusky.buoys = ["TMPS1"];
      d = await page("sandusky");
      eq("page: temps-only → buoy null", d.buoy, null);
      // (The stub serves no daily point forecast, so forecast wind is null here.)
      check("page: temps-only → wind not credited to a buoy", d.wind?.source !== "buoy", JSON.stringify(d.wind));
      eq("page: temps-only → waves from forecast", d.waves?.source, "forecast");
      eq("page: temps-only → water tile still from the station", d.temps?.waterSource, "NDBC TMPS1");
      eq("page: temps-only → water tile value", d.temps?.waterF, 50);
      check("page: temps-only → forecast-only reason shown", d.recommendation.reasons.some((x) => FC_NOTE.test(x)), JSON.stringify(d.recommendation.reasons));
      check("page: temps-only → cold-water reason still from the station", d.recommendation.reasons.some((x) => /Water 50°F/.test(x)), JSON.stringify(d.recommendation.reasons));
      eq("page: temps-only → sources.buoy says no live buoy", d.sources?.buoy, "no live buoy");
      eq("page: temps-only → facts card shows no live buoy", d.facts?.liveData?.live, null);
      eq("page: temps-only → facts card waves from forecast", d.facts?.liveData?.wavesFrom, "forecast");
    } finally {
      sandusky.buoys = saved;
      ndbcFiles = {};
    }
  }

  // ── Wind-only buoy: forecast waves are called out, never a level change ──
  {
    const { buildRecommendation } = await import("../functions/marine/conditions.js");
    const WAVES_FC = /Waves are from the NWS forecast/;
    const NO_BUOY = /No live buoy here/;
    const rec = (wind, waves, profile = "lake") => buildRecommendation({ buoy: { station: "X" }, alerts: [], wind, waves, read: null, hours: [], profile });
    const buoyWind = { speedKt: 6, gustKt: 8, source: "buoy", gustSrc: "buoy" };
    const a = rec(buoyWind, { ft: 0.8, source: "forecast" });
    check("wind-only buoy: forecast-waves caveat shown", a.reasons.some((x) => WAVES_FC.test(x)), JSON.stringify(a.reasons));
    check("wind-only buoy: no 'No live buoy' line", !a.reasons.some((x) => NO_BUOY.test(x)), JSON.stringify(a.reasons));
    const a0 = rec(buoyWind, { ft: 0.8, source: "buoy" });
    eq("wind-only buoy: caveat doesn't change the level", a.level, a0.level);
    check("wind+wave buoy: no forecast-waves caveat", !a0.reasons.some((x) => WAVES_FC.test(x)), JSON.stringify(a0.reasons));
    const g = rec({ speedKt: 6, gustKt: 8, source: "forecast", gustSrc: "buoy" }, { ft: 0.8, source: "forecast" });
    check("gust-only buoy: forecast-waves caveat shown", g.reasons.some((x) => WAVES_FC.test(x)), JSON.stringify(g.reasons));
    const n = rec(buoyWind, { ft: null, source: null });
    check("wind-only buoy, no wave data: no forecast-waves caveat (waves aren't from anywhere)", !n.reasons.some((x) => WAVES_FC.test(x)) && n.level !== "GO", JSON.stringify(n));
    const f = buildRecommendation({ buoy: null, alerts: [], wind: { speedKt: 6, source: "forecast" }, waves: { ft: 0.8, source: "forecast" }, read: null, hours: [], profile: "lake" });
    check("no buoy: only the 'No live buoy' line, not both", f.reasons.some((x) => NO_BUOY.test(x)) && !f.reasons.some((x) => WAVES_FC.test(x)), JSON.stringify(f.reasons));
    const o = rec(buoyWind, { ft: 1, source: "forecast" }, "ocean");
    check("wind-only shore station on the coast: caveat shown too", o.reasons.some((x) => WAVES_FC.test(x)), JSON.stringify(o.reasons));
  }

  // ── N1/N2/X4 (2026-11 UX review): one wind story, freshness, no-data state ──
  {
    const { buildRecommendation, windPhrase, onRequest, fetchSummary, fetchTodayWindows, fetchWeeks, capStaleGo, STALE_LIMITS } = await import("../functions/marine/conditions.js");
    const R = (o) => buildRecommendation({ buoy: null, alerts: [], read: null, hours: [], profile: "lake", ...o });

    // N1: the reason names sustained AND gust with sources; the level still
    // rates on the stronger of the two (thresholds unchanged).
    eq("wind phrase: buoy sustained + buoy gust", windPhrase({ speedKt: 16.2, gustKt: 19.4, source: "buoy", gustSrc: "buoy" }), "16 kt, gusts 19 kt (buoy)");
    eq("wind phrase: buoy sustained + forecast gust", windPhrase({ speedKt: 7, gustKt: 16, source: "buoy", gustSrc: "forecast" }), "7 kt (buoy), gusts 16 kt (forecast)");
    eq("wind phrase: gust not above sustained is omitted", windPhrase({ speedKt: 12, gustKt: 12, source: "forecast", gustSrc: "forecast" }), "12 kt (forecast)");
    eq("wind phrase: gust only", windPhrase({ speedKt: null, gustKt: 24, source: null, gustSrc: "forecast" }), "gusts 24 kt (forecast), no sustained wind reading");
    const sdk = R({ buoy: { station: "45005", ageMinutes: 12 }, wind: { speedKt: 16.2, gustKt: 19.4, source: "buoy", gustSrc: "buoy" }, waves: { ft: 1, source: "buoy", periodSec: 4 } });
    eq("Sandusky case: 16 kt gusting 19 → CAUTION on the gust (unchanged)", sdk.level, "CAUTION");
    check("Sandusky case: reason shows the tile's 16 kt and the 19 kt gust", sdk.reasons.includes("Windy: 16 kt, gusts 19 kt (buoy)"), JSON.stringify(sdk.reasons));
    eq("wind level: 13 kt gust 24 lake still NO-GO", R({ wind: { speedKt: 13, gustKt: 24, source: "forecast", gustSrc: "forecast" }, waves: { ft: 1, source: "forecast" } }).level, "NO-GO");
    eq("wind level: 10 kt gust 13 lake still CAUTION (breezy)", R({ wind: { speedKt: 10, gustKt: 13, source: "forecast", gustSrc: "forecast" }, waves: { ft: 1, source: "forecast" } }).level, "CAUTION");
    eq("wind level: ocean 12 g18 still GO", R({ profile: "ocean", wind: { speedKt: 12, gustKt: 18, source: "forecast", gustSrc: "forecast" }, waves: { ft: 2, periodSec: 10, source: "forecast" } }).level, "GO");

    // N2: stale inputs never carry a GO; fresh ones are unchanged.
    const calmBuoy = (age) => R({ buoy: { station: "45005", ageMinutes: age }, wind: { speedKt: 6, gustKt: 8, source: "buoy", gustSrc: "buoy" }, waves: { ft: 0.8, source: "buoy", periodSec: 3 } });
    eq("stale: thresholds", JSON.stringify(STALE_LIMITS), JSON.stringify({ buoyMin: 120, forecastMin: 1080, pageMin: 30 }));
    eq("stale buoy: 60 min calm → GO", calmBuoy(60).level, "GO");
    eq("stale buoy: 119 min calm → GO", calmBuoy(119).level, "GO");
    const sb = calmBuoy(150);
    eq("stale buoy: 150 min calm → CAUTION (never GO)", sb.level, "CAUTION");
    check("stale buoy: reason gives the age", sb.reasons.some((x) => /buoy reading is 2 h 30 min old/.test(x)), JSON.stringify(sb.reasons));
    check("stale buoy: summary says data is out of date, flagged stale", sb.stale === true && /out of date/.test(sb.summary), JSON.stringify(sb));
    const tempsOnly = R({ buoy: { station: "T", ageMinutes: 170 }, wind: { speedKt: 6, source: "forecast" }, waves: { ft: 0.8, source: "forecast" } });
    eq("stale buoy: an old buoy that didn't feed wind/waves doesn't cap", tempsOnly.level, "GO");
    const fill = (age) => R({ buoy: { station: "45005", ageMinutes: 10 }, buoyAgeMin: age, wind: { speedKt: 6, gustKt: 8, source: "buoy", gustSrc: "buoy" }, waves: { ft: 0.8, source: "buoy", periodSec: 3 } });
    eq("stale buoy: fresh primary but 150-min feeding station (buoyAgeMin) → CAUTION", fill(150).level, "CAUTION");
    eq("stale buoy: buoyAgeMin 20 → GO", fill(20).level, "GO");
    const calmFc = (age) => R({ wind: { speedKt: 6, gustKt: 8, source: "forecast", gustSrc: "forecast" }, waves: { ft: 0.8, source: "forecast" }, forecastAgeMin: age });
    eq("stale forecast: unknown age → GO (unknown is shown, not capped)", calmFc(null).level, "GO");
    eq("stale forecast: 6 h old → GO", calmFc(360).level, "GO");
    const sf = calmFc(20 * 60);
    eq("stale forecast: 20 h old → CAUTION", sf.level, "CAUTION");
    check("stale forecast: reason gives the age", sf.reasons.some((x) => /hasn't been updated in 20 h/.test(x)), JSON.stringify(sf.reasons));
    const sfNo = R({ wind: { speedKt: 25, source: "forecast" }, waves: { ft: 5, source: "forecast" }, forecastAgeMin: 30 * 60 });
    check("stale forecast: NO-GO stays NO-GO, not flagged as a stale cap", sfNo.level === "NO-GO" && sfNo.stale === false && sfNo.reasons.some((x) => /hasn't been updated/.test(x)), JSON.stringify(sfNo));

    // Strip/email cap: GO → CAUTION (flagged stale) on an overdue forecast;
    // CAUTION, NO-GO, no call and alert-raised rows are left alone.
    const rows = [{ level: "GO" }, { level: "CAUTION" }, { level: "NO-GO", alert: true }, { level: null }];
    eq("capStaleGo: stale → GO capped, others untouched", JSON.stringify(capStaleGo(rows, true)), JSON.stringify([{ level: "CAUTION", stale: true }, { level: "CAUTION" }, { level: "NO-GO", alert: true }, { level: null }]));
    check("capStaleGo: fresh → same rows", capStaleGo(rows, false) === rows);

    // X4: a no-data CAUTION is flagged so the page can show it as NO DATA.
    const nd = R({ wind: { speedKt: null, source: null }, waves: { ft: null, source: null } });
    check("no data: level CAUTION (never GO), flagged noData", nd.level === "CAUTION" && nd.noData === true, JSON.stringify(nd));
    const ndGust = R({ wind: { speedKt: null, gustKt: 24, source: null, gustSrc: "forecast" }, waves: { ft: null } });
    check("no data but a 24 kt gust → NO-GO, not flagged noData", ndGust.level === "NO-GO" && ndGust.noData === false, JSON.stringify(ndGust));
    check("real CAUTION is not flagged noData", sdk.noData === false);

    // End to end through the spot page (stubbed calm NWS, no buoy).
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; ndbcFiles = {};
    const page = async () => (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env: { USERS: makeKV() } })).json();
    try {
      fcUpdateAgeH = 3;
      let d = await page();
      eq("page: fresh forecast, calm → GO", d.recommendation?.level, "GO");
      check("page: fresh forecast → hourly strip has GO hours", (d.hourly || []).some((h) => h.level === "GO"), JSON.stringify((d.hourly || []).slice(0, 3).map((h) => h.level)));
      check("page: fresh forecast → week strip has GO days", (d.week || []).some((x) => x.level === "GO"), JSON.stringify((d.week || []).map((x) => x.level)));
      check("weekend email: fresh grid → GO days", ((await fetchWeeks({ USERS: makeKV() }, ["sandusky"])).sandusky || []).some((x) => x.level === "GO"));
      check("page: freshness reports the forecast issue time and age", d.freshness && d.freshness.forecastIssuedAt && d.freshness.forecastAgeMinutes >= 179 && d.freshness.forecastAgeMinutes <= 181 && d.freshness.stale.length === 0 && d.freshness.buoy === null, JSON.stringify(d.freshness));
      eq("page: wind basis is the hourly forecast", d.wind?.basis, "hour");
      fcUpdateAgeH = 20;
      d = await page();
      eq("page: 20 h old forecast, calm → CAUTION (GO on stale data was possible before)", d.recommendation?.level, "CAUTION");
      check("page: freshness flags the stale forecast", (d.freshness?.stale || []).some((x) => x.kind === "forecast"), JSON.stringify(d.freshness));
      const tile = (await fetchSummary({ USERS: makeKV() })).spots.find((x) => x.id === "sandusky");
      check("summary tile: stale grid → no call, not GO", tile && tile.level === null, JSON.stringify(tile));
      check("digest: stale grid → no GO window", Object.values(await fetchTodayWindows()).every((w) => w == null));
      check("page: stale forecast → no GO hour in the hourly strip", (d.hourly || []).length && d.hourly.every((h) => h.level !== "GO"), JSON.stringify((d.hourly || []).map((h) => h.level)));
      check("page: stale forecast → capped hours are CAUTION, flagged stale", d.hourly.some((h) => h.level === "CAUTION" && h.stale === true), JSON.stringify(d.hourly.slice(0, 3)));
      check("page: stale forecast → no GO day in the week strip", (d.week || []).length && d.week.every((x) => x.level !== "GO"), JSON.stringify((d.week || []).map((x) => x.level)));
      check("page: stale forecast → capped days are CAUTION, flagged stale", d.week.some((x) => x.level === "CAUTION" && x.stale === true), JSON.stringify(d.week));
      eq("page: stale forecast → outlook's current hour isn't GO either", d.outlook?.nowLevel === "GO", false);
      const sw = (await fetchWeeks({ USERS: makeKV() }, ["sandusky"])).sandusky || [];
      check("weekend email: stale grid → no GO day (CAUTION, flagged stale)", sw.length && sw.every((x) => x.level !== "GO") && sw.some((x) => x.level === "CAUTION" && x.stale === true), JSON.stringify(sw.map((x) => x.level)));
      // An advisory still raises a stale strip to its own level.
      stormMode = true;
      d = await page();
      check("page: stale + storm → NO-GO hours/days stay NO-GO", d.hourly.some((h) => h.level === "NO-GO") && d.week.some((x) => x.level === "NO-GO"), JSON.stringify({ h: d.hourly.slice(0, 3).map((h) => h.level), w: d.week.map((x) => x.level) }));
      stormMode = false;
      alertsDown = true;
      d = await page();
      check("page: stale + alerts unknown → no GO hour or day", d.hourly.every((h) => h.level !== "GO") && d.week.every((x) => x.level !== "GO"), JSON.stringify({ h: d.hourly.slice(0, 3).map((h) => h.level), w: d.week.map((x) => x.level) }));
      alertsDown = false;
      fcUpdateAgeH = null;
      d = await page();
      eq("page: no updateTime sent → age unknown, not stale", d.freshness?.forecastAgeMinutes, null);

      // An expired daily period must not stand in for the current wind.
      const iso = (h) => new Date(Date.now() + h * 3600e3).toISOString();
      dailyStub = [
        { name: "This Afternoon", startTime: iso(-14), endTime: iso(-2), windSpeed: "5 mph", windDirection: "SW", temperature: 60, shortForecast: "Sunny" },
        { name: "Tonight", startTime: iso(-2), endTime: iso(10), windSpeed: "25 to 30 mph", windDirection: "W", temperature: 50, shortForecast: "Windy" },
      ];
      d = await page();
      eq("page: current daily period used (Tonight, 30 mph → 26 kt), not the expired one", d.wind?.speedKt, 26.1);
      eq("page: wind basis/period labelled", `${d.wind?.basis}|${d.wind?.periodName}`, "period|Tonight");
      eq("page: current-period wind drives the call", d.recommendation?.level, "NO-GO");
      dailyStub = [{ name: "This Afternoon", startTime: iso(-14), endTime: iso(-2), windSpeed: "5 mph", windDirection: "SW", temperature: 60, shortForecast: "Sunny" }];
      d = await page();
      eq("page: only an expired daily period → falls back to the hourly forecast (8 kt)", d.wind?.speedKt, 8);

      // A fresh buoy is reported with its age; a 150-min one caps GO.
      const p2 = (n) => String(n).padStart(2, "0");
      const line = (ageMin) => { const t = new Date(Date.now() - ageMin * 60000);
        return "#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE\n"
          + [t.getUTCFullYear(), p2(t.getUTCMonth() + 1), p2(t.getUTCDate()), p2(t.getUTCHours()), p2(t.getUTCMinutes()), "220", "3.0", "4.0", "0.3", "3", "MM", "MM", "1015.0", "14.0", "MM", "MM", "MM", "MM", "MM"].join(" ") + "\n"; };
      dailyStub = null; fcUpdateAgeH = 2;
      const sandusky = (await import("../functions/marine/conditions.js")).SPOTS.sandusky;
      const saved = sandusky.buoys;
      try {
        sandusky.buoys = ["FRSH1"]; ndbcFiles = { FRSH1: line(15) };
        d = await page();
        check("page: fresh buoy → freshness.buoy with age, GO kept", d.freshness?.buoy?.station === "FRSH1" && d.freshness.buoy.ageMinutes >= 15 && d.freshness.buoy.ageMinutes <= 16 && d.recommendation?.level === "GO", JSON.stringify({ f: d.freshness, r: d.recommendation }));
        ndbcFiles = { FRSH1: line(150) };
        d = await page();
        check("page: 150-min buoy → CAUTION, flagged stale", d.recommendation?.level === "CAUTION" && d.freshness.stale.some((x) => x.kind === "buoy"), JSON.stringify({ f: d.freshness, r: d.recommendation }));

        // Wind filled from a second station (windBuoy): ITS age must be checked,
        // and the freshness line must name it, not the fresh wave-only primary.
        const lineX = (ageMin, wspd, gst, wvht) => line(ageMin).replace(/\n(\S+ \S+ \S+ \S+ \S+) 220 3\.0 4\.0 0\.3 /, `\n$1 ${wspd === "MM" ? "MM" : "220"} ${wspd} ${gst} ${wvht} `);
        sandusky.buoys = ["WAVE1", "WIND2"];
        ndbcFiles = { WAVE1: lineX(15, "MM", "MM", "0.3"), WIND2: lineX(150, "3.0", "4.0", "MM") };
        d = await page();
        check("page: wave-only primary fresh + 150-min wind station → wind from WIND2, waves from WAVE1", d.wind?.station === "WIND2" && d.waves?.station === "WAVE1", JSON.stringify({ w: d.wind, v: d.waves }));
        check("page: stale wind-fill station → CAUTION, never GO", d.recommendation?.level === "CAUTION" && d.recommendation.reasons.some((x) => /buoy reading is 2 h 3[01] min old/.test(x)), JSON.stringify(d.recommendation));
        check("page: freshness names the stale wind station, lists both feeders", d.freshness?.buoy?.station === "WIND2" && d.freshness.buoy.ageMinutes >= 150 && d.freshness.stale.some((x) => x.kind === "buoy")
          && d.freshness.buoys.length === 2 && d.freshness.buoys.find((b) => b.station === "WAVE1")?.feeds.join() === "waves" && d.freshness.buoys.find((b) => b.station === "WIND2")?.feeds.join() === "wind", JSON.stringify(d.freshness));
        ndbcFiles = { WAVE1: lineX(150, "MM", "MM", "0.3"), WIND2: lineX(15, "3.0", "4.0", "MM") };
        d = await page();
        check("page: stale wave-only primary + fresh wind station → CAUTION, names WAVE1", d.recommendation?.level === "CAUTION" && d.freshness?.buoy?.station === "WAVE1", JSON.stringify({ f: d.freshness, r: d.recommendation }));
        ndbcFiles = { WAVE1: lineX(15, "MM", "MM", "0.3"), WIND2: lineX(20, "3.0", "4.0", "MM") };
        d = await page();
        check("page: both feeding stations fresh → GO kept, oldest (WIND2, 20 min) reported", d.recommendation?.level === "GO" && d.freshness?.buoy?.station === "WIND2" && d.freshness.stale.length === 0, JSON.stringify({ f: d.freshness, r: d.recommendation }));
      } finally { sandusky.buoys = saved; ndbcFiles = {}; }
    } finally { fcUpdateAgeH = null; dailyStub = null; }
  }

  // ── Cold-water regions + bar harbors: bar advisories can never read GO ──
  {
    const { SPOTS, alertEffects, alertZonesFor, buildRecommendation, fetchSummary, fetchTodayWindows, onRequest, riskLevel, fetchBuoy } = await import("../functions/marine/conditions.js");
    const { REGIONS } = await import("../src/regions.js");
    const lakes = new Set(REGIONS.flatMap((r) => r.lakes));
    const orphans = Object.entries(SPOTS).filter(([, s]) => !lakes.has(s.lake || "Lake Erie")).map(([id]) => id);
    check("regions: every curated spot's water body belongs to a region", orphans.length === 0, orphans.join(","));
    for (const slug of ["pnw", "oregon", "norcal", "northeast", "alaska"]) {
      const r = REGIONS.find((x) => x.slug === slug);
      const n = r ? Object.values(SPOTS).filter((s) => r.lakes.includes(s.lake)).length : 0;
      check(`regions: ${slug} exists, is not warm, and has 5+ spots`, r && !r.warm && n >= 5, `n=${n}`);
    }
    const coldIds = Object.entries(SPOTS).filter(([, s]) => /Puget|San Juan|Washington|Oregon|California Coast|San Francisco|New England|Long Island|New York|Alaska/.test(s.lake || ""));
    check("regions: new spots have zone, office, CWF product, and a seaward bearing", coldIds.every(([, s]) => /^[A-Z]{2}Z\d{3}$/.test(s.zone) && s.office && s.product === "CWF" && s.sea != null && s.water), coldIds.filter(([, s]) => !(s.zone && s.office && s.sea != null && s.water)).map(([id]) => id).join(","));
    const barIds = Object.entries(SPOTS).filter(([, s]) => s.bar).map(([id]) => id);
    check("bars: Oregon and Washington/Humboldt bar harbors are flagged", ["astoria", "garibaldi", "depoe-bay", "newport-or", "coos-bay", "brookings", "westport", "humboldt-bay"].every((id) => barIds.includes(id)), barIds.join(","));
    const z = alertZonesFor(SPOTS.astoria);
    check("bars: alert lookup names the spot zone, the bar zone and the outside zone", z.includes("PZZ210") && z.includes("PZZ251"), z.join(","));
    check("bars: Humboldt lookup includes the bar and the bay", alertZonesFor(SPOTS["humboldt-bay"]).includes("PZZ410") && alertZonesFor(SPOTS["humboldt-bay"]).includes("PZZ415"));
    const sca = [{ event: "Small Craft Advisory" }];
    eq("bars: SCA at a bar harbor → NO-GO", alertEffects(sca, SPOTS["newport-or"])[0].to, "NO-GO");
    eq("bars: SCA away from a bar → CAUTION (unchanged)", alertEffects(sca, SPOTS.seattle)[0].to, "CAUTION");
    eq("bars: High Surf Advisory at a bar harbor → NO-GO", alertEffects([{ event: "High Surf Advisory" }], SPOTS["coos-bay"])[0].to, "NO-GO");
    eq("bars: Gale Watch at a bar harbor → CAUTION", alertEffects([{ event: "Gale Watch" }], SPOTS.astoria)[0].to, "CAUTION");
    eq("bars: Rip Current Statement stays a note", alertEffects([{ event: "Rip Current Statement" }], SPOTS.astoria)[0].to, null);
    const calm = { buoy: null, wind: { speedKt: 6, gustKt: 8, source: "forecast", gustSrc: "forecast" }, waves: { ft: 2, periodSec: 12, source: "forecast" }, read: null, hours: [], profile: "ocean" };
    const r0 = buildRecommendation({ ...calm, alerts: [], spot: SPOTS.astoria });
    eq("bars: calm sea, no advisory → GO", r0.level, "GO");
    check("bars: the standing bar-crossing note is listed", r0.reasons.some((x) => /Bar crossing: the Columbia River Bar/.test(x)), JSON.stringify(r0.reasons));
    eq("bars: calm sea + SCA → NO-GO at the bar harbor", buildRecommendation({ ...calm, alerts: sca, spot: SPOTS.astoria }).level, "NO-GO");
    eq("alerts feed down → never GO (bar harbor)", buildRecommendation({ ...calm, alerts: null, alertsOk: false, spot: SPOTS.astoria }).level, "CAUTION");
    eq("alerts feed down → never GO (any spot)", buildRecommendation({ ...calm, alerts: null, alertsOk: false, spot: SPOTS.monterey }).level, "CAUTION");
    const env = { USERS: makeKV() };
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; ndbcFiles = {};
    const page0 = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=astoria"), env })).json();
    eq("bars: astoria baseline (calm grid, no advisory) → GO", page0.recommendation?.level, "GO");
    const tile0 = (await fetchSummary(env)).spots.find((x) => x.id === "astoria");
    eq("bars: astoria baseline tile → GO", tile0?.level, "GO");
    check("bars: astoria baseline has a digest window", (await fetchTodayWindows()).astoria != null);
    alertsZoneDown = true;
    const pPart = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=astoria"), env })).json();
    eq("alerts: zone lookup fails, point answers → alerts unknown (alertsOk false)", pPart.alertsOk, false);
    eq("alerts: partial alerts failure → CAUTION, not GO", pPart.recommendation?.level, "CAUTION");
    const sPart = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    check("alerts: partial failure at a non-bar spot → not GO", sPart.recommendation?.level !== "GO", JSON.stringify(sPart.recommendation));
    alertsZoneDown = false;
    barMode = "PZZ210";
    const page = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=astoria"), env })).json();
    eq("bars: zone-only bar advisory reaches the astoria page → NO-GO", page.recommendation?.level, "NO-GO");
    const tile = (await fetchSummary(env)).spots.find((x) => x.id === "astoria");
    eq("bars: directory tile is NO-GO under the bar advisory", tile?.level, "NO-GO");
    eq("bars: bar-driven NO-GO summary says don't cross", page.recommendation?.summary, "Not recommended. Don't cross the bar.");
    const other = (await fetchSummary(env)).spots.find((x) => x.id === "newport-or");
    eq("bars: another bar's tile isn't touched by the Columbia advisory (stays GO)", other?.level, "GO");
    const wins = await fetchTodayWindows();
    eq("bars: no digest GO window at astoria under the bar advisory", wins.astoria, null);
    // The bar rule runs through main's timed views too, not just the headline.
    check("bars: astoria hourly strip has no hour below NO-GO under the bar SCA", (page.hourly || []).length && page.hourly.every((h) => h.level === "NO-GO"), JSON.stringify((page.hourly || []).slice(0, 3).map((h) => h.level)));
    eq("bars: astoria week strip today NO-GO under the bar SCA", page.week?.[0]?.level, "NO-GO");
    const { fetchWeeks: fetchWeeksB, applyAlertsToHours: aah, alertLevel: alB } = await import("../functions/marine/conditions.js");
    eq("bars: weekend outlook today NO-GO at astoria under the bar SCA", (await fetchWeeksB(env, ["astoria"])).astoria?.[0]?.level, "NO-GO");
    eq("bars: alertLevel with the spot applies the bar rule", alB({ event: "Small Craft Advisory" }, SPOTS.astoria), "NO-GO");
    eq("bars: alertLevel without a spot is the any-spot level", alB({ event: "Small Craft Advisory" }), "CAUTION");
    eq("bars: applyAlertsToHours with the spot → NO-GO hour", aah([{ time: new Date().toISOString(), level: "GO" }], sca, true, Date.now(), SPOTS["coos-bay"])[0].level, "NO-GO");
    // A bar zone that is not the spot's own zone still reaches page, tile and digest.
    barMode = "PZZ410";
    const hb = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=humboldt-bay"), env })).json();
    eq("bars: SCA on Humboldt's bar zone only → page NO-GO", hb.recommendation?.level, "NO-GO");
    eq("bars: … tile NO-GO (bar zone in the batched lookup)", (await fetchSummary(env)).spots.find((x) => x.id === "humboldt-bay")?.level, "NO-GO");
    eq("bars: … no digest window", (await fetchTodayWindows())["humboldt-bay"], null);
    barMode = "PZZ251";
    eq("bars: SCA on astoria's outside zone (alertZones) → tile NO-GO", (await fetchSummary(env)).spots.find((x) => x.id === "astoria")?.level, "NO-GO");
    barMode = "PZZ210";
    barMode = "LEZ143";
    const sand = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    check("alerts: a zone-coded marine advisory reaches a shore-point spot (sandusky, LEZ143) → not GO", sand.recommendation?.level !== "GO" && sand.alerts.some((a) => a.event === "Small Craft Advisory"), JSON.stringify(sand.recommendation));
    const sTile = (await fetchSummary(env)).spots.find((x) => x.id === "sandusky");
    eq("alerts: zone-coded SCA lifts a non-bar directory tile (sandusky) to CAUTION", sTile?.level, "CAUTION");
    const tTile = (await fetchSummary(env)).spots.find((x) => x.id === "toledo");
    eq("alerts: a different zone's tile (toledo, LEZ142) is untouched", tTile?.level, "GO");
    const sw = await fetchTodayWindows();
    check("alerts: no digest GO window at sandusky under its zone SCA", sw.sandusky == null && sw.toledo != null, JSON.stringify({ s: sw.sandusky, t: sw.toledo }));
    barMode = null;
    alertsDown = true;
    const sumDown = (await fetchSummary(env)).spots;
    eq("bars: alerts feed down → astoria tile CAUTION", sumDown.find((x) => x.id === "astoria")?.level, "CAUTION");
    eq("alerts: alerts feed down → a calm non-bar tile is CAUTION, not GO", sumDown.find((x) => x.id === "toledo")?.level, "CAUTION");
    check("alerts: alerts feed down → no digest GO windows", Object.values(await fetchTodayWindows()).every((w) => w == null));
    alertsDown = false;

    // Land storms: still NO-GO, but not worded as a bar hazard.
    const ws = alertEffects([{ event: "Winter Storm Warning" }], SPOTS.astoria)[0];
    check("bars: Winter Storm Warning → NO-GO, not blamed on the bar", ws.to === "NO-GO" && !ws.bar && !/crossing/.test(ws.why), JSON.stringify(ws));
    const ds = alertEffects([{ event: "Dust Storm Warning" }], SPOTS.astoria)[0];
    check("bars: Dust Storm Warning → not bar-worded", !ds.bar, JSON.stringify(ds));
    const sw2 = alertEffects([{ event: "Storm Warning" }], SPOTS.astoria)[0];
    check("bars: marine Storm Warning → bar-worded NO-GO", sw2.to === "NO-GO" && sw2.bar, JSON.stringify(sw2));
    eq("alerts: Winter Storm Watch at a bar → CAUTION", alertEffects([{ event: "Winter Storm Watch" }], SPOTS.astoria)[0].to, "CAUTION");
    eq("alerts: Heavy Freezing Spray Warning → NO-GO", alertEffects([{ event: "Heavy Freezing Spray Warning" }], SPOTS.juneau)[0].to, "NO-GO");
    eq("alerts: High Wind Warning → NO-GO", alertEffects([{ event: "High Wind Warning" }], SPOTS.seattle)[0].to, "NO-GO");
    eq("alerts: High Wind Watch → CAUTION", alertEffects([{ event: "High Wind Watch" }], SPOTS.seattle)[0].to, "CAUTION");
    eq("alerts: Dense Fog Advisory at a bar stays CAUTION", alertEffects([{ event: "Dense Fog Advisory" }], SPOTS.astoria)[0].to, "CAUTION");

    // Inlets: Barnegat + the Atlantic inlet spots carry the inlet treatment.
    for (const id of ["barnegat", "ponce-inlet", "sebastian-inlet", "jupiter", "st-augustine", "oregon-inlet"]) {
      check(`inlets: ${id} is flagged as an inlet crossing`, SPOTS[id]?.bar?.inlet === true, JSON.stringify(SPOTS[id]?.bar));
    }
    const bi = buildRecommendation({ ...calm, alerts: sca, spot: SPOTS.barnegat });
    eq("inlets: SCA at Barnegat → NO-GO", bi.level, "NO-GO");
    eq("inlets: summary says don't cross the inlet", bi.summary, "Not recommended. Don't cross the inlet.");
    check("inlets: reason names the inlet", bi.reasons.some((x) => /crossing the Barnegat Inlet/.test(x)), JSON.stringify(bi.reasons));
    const seaNoGo = buildRecommendation({ ...calm, waves: { ft: 9, periodSec: 12, source: "forecast" }, alerts: [], spot: SPOTS.astoria });
    eq("bars: NO-GO from seas alone keeps the plain summary", seaNoGo.summary, "Not recommended. Stay in.");

    // B1: no wave data on the ocean / at a bar is never GO.
    const noWave = { ...calm, buoy: { station: "X" }, wind: { speedKt: 5, gustKt: 7, source: "buoy", gustSrc: "buoy" }, waves: { ft: null, source: null } };
    for (const id of ["coos-bay", "sitka", "monterey", "astoria"]) {
      const r = buildRecommendation({ ...noWave, alerts: [], spot: SPOTS[id], profile: "ocean" });
      eq(`no waves: ${id} light wind, no wave data → CAUTION`, r.level, "CAUTION");
      check(`no waves: ${id} never says "Calm conditions reported"`, !r.reasons.includes("Calm conditions reported"), JSON.stringify(r.reasons));
    }
    const shel = buildRecommendation({ ...noWave, alerts: [], spot: SPOTS.berkeley, profile: "sheltered" });
    eq("no waves: sheltered bay rates on wind alone (unchanged) → GO", shel.level, "GO");
    check("no waves: sheltered GO doesn't claim calm seas", !shel.reasons.includes("Calm conditions reported"), JSON.stringify(shel.reasons));
    eq("riskLevel: ocean, light wind, no waves → no call (null), not GO", riskLevel(5, 7, 0, "", null, null, "ocean"), null);
    eq("riskLevel: ocean, no waves, 24 kt → still NO-GO", riskLevel(24, 28, 0, "", null, null, "ocean"), "NO-GO");
    eq("riskLevel: ocean with waves still GO when calm", riskLevel(5, 7, 0, "", 2, 12, "ocean"), "GO");

    // San Francisco Bay: Berkeley's grid walk must stay inside the Golden Gate
    // (Point Bonita ~122.53 W), or a bay launch is rated on open-Pacific swell.
    const { gridSamplePoints: gsp } = await import("../functions/marine/conditions.js");
    check("grid walk: Berkeley never samples west of the Golden Gate", gsp(SPOTS.berkeley).every((p) => p.lon > -122.47), JSON.stringify(gsp(SPOTS.berkeley)));

    // fetchBuoy merges a wind-only first station with a later wave buoy.
    const nd = ({ wspd = "MM", gst = "MM", wvht = "MM", dpd = "MM", wtmp = "MM" } = {}) => {
      const t = new Date(Date.now() - 20 * 60000), p2 = (n) => String(n).padStart(2, "0");
      return "#hdr\n#units\n" + [t.getUTCFullYear(), p2(t.getUTCMonth() + 1), p2(t.getUTCDate()), p2(t.getUTCHours()), p2(t.getUTCMinutes()), "270", wspd, gst, wvht, dpd, "MM", "MM", "1015.0", "MM", wtmp, "MM", "MM", "MM", "MM"].join(" ") + "\n";
    };
    ndbcFiles = { WPTW1: nd({ wspd: "3.0", gst: "4.0", wtmp: "11.5" }), "46211": nd({ wvht: "1.2", dpd: "14" }) };
    const fb = await fetchBuoy(["WPTW1", "46211"]);
    check("fetchBuoy: wind-only first station stays primary, wave buoy fills waves", fb.buoy?.station === "WPTW1" && fb.waveBuoy?.station === "46211" && fb.windBuoy === null, JSON.stringify({ b: fb.buoy?.station, v: fb.waveBuoy?.station, w: fb.windBuoy?.station }));
    ndbcFiles = { "46278": nd({ wvht: "1.0", dpd: "12" }), WINDX: nd({ wspd: "4.0" }) };
    const fb2 = await fetchBuoy(["46278", "WINDX"]);
    check("fetchBuoy: wave-only first station, later wind station fills wind", fb2.buoy?.station === "46278" && fb2.windBuoy?.station === "WINDX", JSON.stringify({ b: fb2.buoy?.station, w: fb2.windBuoy?.station }));
    ndbcFiles = { WPTW1: nd({ wspd: "3.0", gst: "4.0", wtmp: "11.5" }), "46211": nd({ wvht: "1.2", dpd: "14" }) };
    const wp = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=westport"), env })).json();
    check("page: westport wind from WPTW1, waves from 46211 (both live)", wp.wind?.source === "buoy" && wp.wind?.station === "WPTW1" && wp.waves?.source === "buoy" && wp.waves?.station === "46211" && wp.waves?.ft === 3.9, JSON.stringify({ wind: wp.wind, waves: wp.waves }));
    check("page: merged stations listed in sources", /WPTW1 \+ 46211/.test(wp.sources?.buoy || ""), wp.sources?.buoy);
    check("page: no 'forecast waves' caveat when a live wave buoy filled in", !wp.recommendation.reasons.some((x) => /Waves are from the NWS forecast/.test(x)), JSON.stringify(wp.recommendation.reasons));
    ndbcFiles = {};
  }

  // ── Placeholder ("filler") grid wave layers are not wave data ──────────────
  // Some NWS cells carry one 0 m value held for ~7 days (DTX/84,67 off Port
  // Huron, APX/104,65 near Alpena). That must not read as "0 ft, calm", must
  // not stop the seaward step search, and must never enable a lake GO.
  {
    const { isFillerWaveLayer, gridSamplePoints, SPOTS, fetchSummary, fetchWeeks, fetchTodayWindows, onRequest } = await import("../functions/marine/conditions.js");
    const L = (...e) => ({ values: e.map(([validTime, value]) => ({ validTime, value })) });
    // Shapes copied from live cells (Nov 2026).
    check("filler: DTX/84,67 one 0 m value for P7DT4H", isFillerWaveLayer(L(["2026-11-06T16:00:00+00:00/P7DT4H", 0])));
    check("filler: one non-zero value for the whole week (MHX/61,90)", isFillerWaveLayer(L(["2026-11-06T18:00:00+00:00/P6DT19H", 0.3048])));
    check("filler: P6D of 0 plus 1-h stubs (TBW/73,83)", isFillerWaveLayer(L(["2026-11-06T13:00:00+00:00/P6D", 0], ["2026-11-12T18:00:00+00:00/PT1H", 0], ["2026-11-13T00:00:00+00:00/PT1H", 0], ["2026-11-13T06:00:00+00:00/PT1H", 0])));
    check("filler: many valid times, all 0", isFillerWaveLayer(L(["2026-11-06T00:00:00+00:00/PT12H", 0], ["2026-11-06T12:00:00+00:00/PT12H", 0], ["2026-11-07T00:00:00+00:00/P5D", 0])));
    check("filler: one small value (1 ft) over 90% of the period", isFillerWaveLayer(L(["2026-11-06T00:00:00+00:00/P6D", 0.3048], ["2026-11-12T00:00:00+00:00/PT6H", 0], ["2026-11-12T06:00:00+00:00/PT6H", 0])));
    check("real: a 2 ft value held over 90% of the period is kept (real height)", !isFillerWaveLayer(L(["2026-11-06T00:00:00+00:00/P6D", 0.6], ["2026-11-12T00:00:00+00:00/PT6H", 0.3], ["2026-11-12T06:00:00+00:00/PT6H", 0.3])));
    check("real: a 5 ft trade-wind sea held all week is kept (ocean)", !isFillerWaveLayer(L(["2026-11-06T00:00:00+00:00/P6DT20H", 1.524])));
    check("real: a single 4 ft entry is kept, never dropped as filler", !isFillerWaveLayer(L(["2026-11-06T00:00:00+00:00/P7D", 1.2192])));
    check("filler: missing / empty layer", isFillerWaveLayer(null) && isFillerWaveLayer({ values: [] }));
    check("real: calm 0–1 ft lake week (DLH/93,69: 0, 0.3 m for 7 h, 0)", !isFillerWaveLayer(L(["2026-11-06T17:00:00+00:00/P1DT6H", 0], ["2026-11-07T23:00:00+00:00/PT7H", 0.3048], ["2026-11-08T06:00:00+00:00/P5DT1H", 0])));
    check("real: a long-held swell (SJU/210,120: 3 ft for 144 of 198 h)", !isFillerWaveLayer(L(["2026-11-06T00:00:00+00:00/P6D", 0.9144], ["2026-11-12T00:00:00+00:00/PT24H", 0.6096], ["2026-11-13T00:00:00+00:00/PT30H", 0.9144])));
    check("real: two valid times (MOB/56,59)", !isFillerWaveLayer(L(["2026-11-06T15:00:00+00:00/P3DT1H", 0.3048], ["2026-11-09T16:00:00+00:00/P4DT9H", 0])));

    const env = { USERS: makeKV() };
    stormMode = false; scaMode = false; alertsDown = false; gridMode = null; zoneAlert = null;
    const pts = gridSamplePoints(SPOTS.sandusky);
    const stepAt = (lat, lon) => pts.findIndex((p) => Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lon - lon) < 1e-6);
    const sanduskyCalls = () => gridCalls.map((a) => stepAt(...a.split(",").map(Number))).filter((i) => i >= 0);
    const tileOf = async () => (await fetchSummary(env)).spots.find((x) => x.id === "sandusky");

    // 1. First cell filler, second a real 2 ft forecast → the 2 ft cell's waves.
    gridWavesAt = (lat, lon) => ({ 0: "filler", 1: 0.6096 })[stepAt(lat, lon)];
    gridCalls = [];
    const t1 = await tileOf();
    eq("filler skipped: tile reads the next cell's 2 ft, not 0 ft", t1?.waveFt, 2);
    eq("filler skipped: wind still from the nearest cell (8 kt)", t1?.windKt, 8);
    check("filler skipped: the walk went past the filler cell", sanduskyCalls().join() === "0,1", JSON.stringify(sanduskyCalls()));
    const p1 = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
    check("filler skipped: spot page hours carry 2 ft, never 0 ft", (p1.hourly || []).length && p1.hourly.every((h) => h.waveFt === 2), JSON.stringify((p1.hourly || []).slice(0, 2)));

    // 2. Every cell filler (and the all-zero variant) → no waves → no lake GO.
    for (const mode of ["filler", "zeros"]) {
      gridWavesAt = (lat, lon) => (stepAt(lat, lon) >= 0 ? mode : undefined);
      gridCalls = [];
      const t2 = await tileOf();
      eq(`all ${mode}: tile has no waves (not 0 ft)`, t2?.waveFt, null);
      check(`all ${mode}: every step was tried`, sanduskyCalls().join() === "0,1,2", JSON.stringify(sanduskyCalls()));
      check(`all ${mode}: calm wind but the tile is not GO`, t2 && t2.windKt === 8 && t2.level !== "GO", JSON.stringify(t2));
      const w2 = (await fetchWeeks(env, ["sandusky"])).sandusky || [];
      check(`all ${mode}: no week day is GO`, w2.length && w2.every((d) => d.level !== "GO" && d.waveFt == null), JSON.stringify(w2.map((d) => [d.level, d.waveFt])));
      const wins = await fetchTodayWindows();
      eq(`all ${mode}: no digest GO window for sandusky`, wins.sandusky ?? null, null);
      const p2 = await (await onRequest({ request: new Request("https://shouldiboat.com/marine/conditions?spot=sandusky"), env })).json();
      check(`all ${mode}: spot page hours have no waves and no GO`, (p2.hourly || []).length && p2.hourly.every((h) => h.waveFt == null && h.level !== "GO"), JSON.stringify((p2.hourly || []).slice(0, 2)));
      check(`all ${mode}: spot headline is not GO`, p2.recommendation?.level && p2.recommendation.level !== "GO", JSON.stringify(p2.recommendation?.level));
    }

    // 2b. Ocean spot: all-filler is no wave data, and on the open ocean no
    //     wave data is never GO (a light wind says nothing about the swell):
    //     the tile is "—" while a real 1 ft sea still reads GO. Stricter than
    //     the original assertion (filler and 1 ft rated alike).
    {
      const jp = gridSamplePoints(SPOTS.jacksonville);
      const jAt = (lat, lon) => jp.findIndex((p) => Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lon - lon) < 1e-6);
      const jTile = async () => (await fetchSummary(env)).spots.find((x) => x.id === "jacksonville");
      gridWavesAt = (lat, lon) => (jAt(lat, lon) >= 0 ? "filler" : undefined);
      const jf = await jTile();
      gridWavesAt = (lat, lon) => (jAt(lat, lon) >= 0 ? 0.3048 : undefined);
      const j1 = await jTile();
      check("ocean all-filler: no waves (not 0 ft)", jf?.waveFt == null, JSON.stringify(jf));
      check("ocean all-filler: no wave data → no call (\u2014), never GO; a real 1 ft sea → GO", jf && jf.level == null && j1?.level === "GO" && j1?.waveFt === 1, JSON.stringify({ filler: jf?.level, oneFt: j1?.level, ft: j1?.waveFt }));
    }

    // 3. A genuine calm 0–1 ft forecast is kept (and stops the walk).
    gridWavesAt = (lat, lon) => (stepAt(lat, lon) === 0 ? "calm" : stepAt(lat, lon) > 0 ? 1.2 : undefined);
    gridCalls = [];
    const t3 = await tileOf();
    check("calm kept: tile reads 0–1 ft from the first cell", t3?.waveFt === 0 || t3?.waveFt === 1, JSON.stringify(t3));
    eq("calm kept: the walk stopped at the first cell", sanduskyCalls().join(), "0");
    eq("calm kept: calm day is still GO", t3?.level, "GO");
    const w3 = (await fetchWeeks(env, ["sandusky"])).sandusky || [];
    check("calm kept: week days read 1 ft and GO", w3.length && w3.every((d) => d.waveFt === 1 && d.level === "GO"), JSON.stringify(w3.map((d) => [d.level, d.waveFt])));

    // 4. Grid-step memo: a remembered cell that turns filler is not reused.
    const store = new Map();
    globalThis.caches = { default: {
      async match(req) { const v = store.get(req.url); return v == null ? undefined : new Response(v); },
      async put(req, resp) { store.set(req.url, await resp.text()); },
      async delete(req) { return store.delete(req.url); },
    } };
    try {
      const memoKeys = () => [...store.keys()].filter((k) => k.startsWith("https://grid-step.local/") && k.includes(`${Math.round(SPOTS.sandusky.lat * 1000) / 1000},`));
      gridWavesAt = (lat, lon) => (stepAt(lat, lon) >= 0 ? 0.3048 : undefined);
      await tileOf();
      check("memo: the first real cell is remembered", memoKeys().length === 1 && store.get(memoKeys()[0]) === String(pts[0].step), JSON.stringify(memoKeys()));
      gridWavesAt = (lat, lon) => ({ 0: "filler", 1: 0.6096 })[stepAt(lat, lon)];
      gridCalls = [];
      const t4 = await tileOf();
      eq("memo: remembered cell gone filler → walks on to the 2 ft cell", t4?.waveFt, 2);
      check("memo: the stale step is forgotten", memoKeys().length === 0, JSON.stringify(memoKeys().map((k) => store.get(k))));
      gridWavesAt = (lat, lon) => (stepAt(lat, lon) >= 0 ? "filler" : undefined);
      await tileOf(); // seed nothing: an all-filler walk memoizes no step
      check("memo: an all-filler walk remembers no step", memoKeys().length === 0);
    } finally {
      delete globalThis.caches;
    }
    gridWavesAt = null; gridCalls = [];
  }

  // ── /api/request-cam: per-cam report validation + admin grouping ──
  {
    const { groupCamReports } = await import("../functions/auth.js");
    const env = { USERS: makeKV(), ADMIN_EMAIL: "admin@example.com" };
    const mkCam = (name) => ({ name, lake: "Lake Erie", lat: 41.5, lon: -82.7, kind: "yt", id: "abcdefghijk" });
    await env.USERS.put("site:config", JSON.stringify({ cams: { disabled: [], custom: [mkCam("Cam A"), mkCam("Cam B")] } }));
    let ipN = 0;
    const post = (body, ip = "203.0.113.1") => {
      const url = new URL(ORIGIN + "/api/request-cam");
      return handleAuth(new Request(url, { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip }, body: JSON.stringify(body) }), env, url);
    };
    const reports = () => [...env.USERS._map.entries()].filter(([k]) => k.startsWith("camreq:")).map(([, v]) => JSON.parse(v));
    eq("request-cam: legacy suggestion still ok", (await post({ spot: "Sandusky", webcam: "https://example.com/cam" })).status, 200);
    check("request-cam: legacy record has no cam/reason", reports()[0] && reports()[0].cam === undefined && reports()[0].reason === undefined);
    eq("request-cam: bad reason → 400", (await post({ spot: "Sandusky", cam: "Cam A", reason: "spam" })).status, 400);
    eq("request-cam: reason without cam → 400", (await post({ spot: "Sandusky", reason: "offline" })).status, 400);
    eq("request-cam: spot only → 400", (await post({ spot: "Sandusky" })).status, 400);
    eq("request-cam: cam+reason ok", (await post({ spot: "Sandusky", cam: "Cam A", reason: "Offline" })).status, 200);
    eq("request-cam: cam alone defaults reason=other", (await post({ spot: "Sandusky", cam: "Cam A" })).status, 200);
    await post({ spot: "Sandusky", cam: "Cam A\u0000" + "x".repeat(400), reason: "not-water" });
    const stored = reports().filter((r) => r.cam);
    check("request-cam: reason normalised to lowercase", stored.some((r) => r.reason === "offline"));
    check("request-cam: cam name length-limited + control chars stripped", stored.every((r) => r.cam.length <= 160 && !/[\u0000-\u001f]/.test(r.cam)));
    await post({ spot: "Duluth", cam: "Cam B", reason: "wrong-place" }, "203.0.113.9");
    eq("request-cam: cam not in any list → 400", (await post({ spot: "Duluth", cam: "Nope cam", reason: "offline" })).status, 400);
    eq("request-cam: built-in cam name accepted", (await post({ spot: "Cleveland", cam: "Edgewater Beach · Cleveland", reason: "offline" }, "203.0.113.5")).status, 200);
    eq("request-cam: Windy replay fallback name accepted", (await post({ spot: "Marquette", cam: "Big Bay › South-east (Windy · replay)", reason: "not-water" }, "203.0.113.6")).status, 200);
    eq("request-cam: Windy live fallback name accepted", (await post({ spot: "Marquette", cam: "Presque Isle (Windy)", reason: "offline" }, "203.0.113.6")).status, 200);
    eq("request-cam: arbitrary text mimicking Windy rejected", (await post({ spot: "x", cam: "anything (Windy) extra", reason: "other" })).status, 400);
    eq("request-cam: over-long Windy-style label rejected", (await post({ spot: "x", cam: "a".repeat(73) + " (Windy)", reason: "other" })).status, 400);
    eq("request-cam: bare suffix rejected", (await post({ spot: "x", cam: " (Windy)", reason: "other" })).status, 400);
    check("request-cam: reporter stored as hash, not raw IP", reports().filter((r) => r.cam).every((r) => /^[0-9a-f]{16}$/.test(r.rh)) && !JSON.stringify(reports()).includes("203.0.113"));
    check("request-cam: new keys are reverse-time", [...env.USERS._map.keys()].filter((k) => k.startsWith("camreq:")).every((k) => k.startsWith("camreq:r")));
    // admin: gated, and grouped per cam
    eq("cam-requests: signed out → 401", (await call(req("GET", "/api/admin/cam-requests"), env)).status, 401);
    const other = await seedUser(env, "rando@example.com");
    eq("cam-requests: non-admin → 403", (await call(req("GET", "/api/admin/cam-requests", { cookie: other }), env)).status, 403);
    const admin = await seedUser(env, "admin@example.com");
    const d = await (await call(req("GET", "/api/admin/cam-requests", { cookie: admin }), env)).json();
    eq("cam-requests: Cam A count", d.byCam["Cam A"]?.count, 2);
    eq("cam-requests: Cam A offline reason", d.byCam["Cam A"]?.reasons.offline, 1);
    eq("cam-requests: Cam B grouped", d.byCam["Cam B"]?.reasons["wrong-place"], 1);
    eq("cam-requests: Cam A unique reporters (same IP twice)", d.byCam["Cam A"]?.reporters, 1);
    eq("cam-requests: Cam B unique reporters", d.byCam["Cam B"]?.reporters, 1);
    check("cam-requests: hashed IP not exposed", !JSON.stringify(d).includes('"rh"'));
    // newest-first beyond the legacy cap: 250 newer reports, then one very old legacy key
    await env.USERS.put("camreq:1700000000000:abc", JSON.stringify({ spot: "Old", cam: "Cam B", reason: "offline", at: "2023-11-14T00:00:00Z" }));
    for (let i = 0; i < 250; i++) await env.USERS.put(`camreq:r${String(1e13 - (Date.now() + i + 1)).padStart(14, "0")}:${i}`, JSON.stringify({ spot: "S", cam: "Cam A", reason: "offline", at: new Date(Date.now() + i + 1).toISOString(), rh: "h" + i }));
    const d2 = await (await call(req("GET", "/api/admin/cam-requests", { cookie: admin }), env)).json();
    eq("cam-requests: newest 200 shown past 250 records", d2.requests.length, 150);
    check("cam-requests: newest first", d2.requests[0].at > d2.requests[1].at);
    check("cam-requests: oldest legacy record dropped from newest 200", d2.byCam["Cam B"] === undefined, JSON.stringify(d2.byCam["Cam B"]) + d2.requests.length);
    check("cam-requests: raw list still returned", Array.isArray(d.requests) && d.requests.length >= 5);
    const g = groupCamReports([{ cam: "__proto__", reason: "offline", at: "2026-01-02" }, { cam: "X", reason: "bogus", at: "2026-01-01" }, { cam: "X", reason: "offline", at: "2026-01-03" }, { spot: "no cam" }]);
    eq("groupCamReports: unknown reason → other", g.X.reasons.other, 1);
    eq("groupCamReports: last = newest", g.X.last, "2026-01-03");
    eq("groupCamReports: __proto__ name is just a key", g["__proto__"]?.count, 1);
  }

  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
