// Accounts backend for Should I Boat? — Cloudflare KV + Web Crypto.
// Routes (handled by worker.js):
//   POST /auth/register {email,password}
//   POST /auth/login    {email,password}
//   POST /auth/logout
//   GET  /auth/me
//   GET  /auth/google              -> redirect to Google
//   GET  /auth/google/callback
//   PUT  /api/prefs     {prefs}
//   PUT  /api/favorites {favorites}
// Email/password needs only the USERS KV namespace. Google sign-in also needs
// GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET secrets.

const SESSION_DAYS = 30;
const enc = new TextEncoder();

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...headers } });

const bufToHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const hexToBuf = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
const randHex = (n) => bufToHex(crypto.getRandomValues(new Uint8Array(n)));

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}

async function pbkdf2(password, saltHex) {
  const salt = hexToBuf(saltHex);
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return bufToHex(bits);
}

const emailKey = (email) => `user:${email.trim().toLowerCase()}`;
const sessKey = (token) => `sess:${token}`;
const validEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

function cookie(name, value, maxAgeSec) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax"];
  parts.push(maxAgeSec === 0 ? "Max-Age=0" : `Max-Age=${maxAgeSec}`);
  return parts.join("; ");
}
function getCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

const publicUser = (u) => ({ email: u.email, prefs: u.prefs || {}, favorites: u.favorites || [], adFree: !!u.adFree, via: u.via || "password" });

async function createSession(env, email) {
  const token = randHex(32);
  await env.USERS.put(sessKey(token), email, { expirationTtl: SESSION_DAYS * 86400 });
  return token;
}
async function userFromRequest(env, request) {
  const token = getCookie(request, "sib_session");
  if (!token) return null;
  const email = await env.USERS.get(sessKey(token));
  if (!email) return null;
  const u = await env.USERS.get(emailKey(email), "json");
  return u ? { ...u, _token: token } : null;
}
async function saveUser(env, u) {
  const { _token, ...store } = u;
  await env.USERS.put(emailKey(u.email), JSON.stringify(store));
}

// ── Stripe (ad-free $2.99/mo) ────────────────────────────────────────────────
const STRIPE_PRICE = "price_1TmmTRD2Xq09ZtSPFFRrN1jH"; // $2.99/mo recurring
async function stripeAPI(env, path, params) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return r.json();
}
// Verify the Stripe-Signature header (HMAC-SHA256 over `t.payload`).
async function stripeVerify(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = {};
  for (const kv of sigHeader.split(",")) { const i = kv.indexOf("="); if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1); }
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5-min replay window
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
  return timingSafeEqual(bufToHex(sig), v1);
}

// Google's registered redirect URI uses https. A bare http://shouldiboat.com
// hit (common on mobile before HSTS is cached) would otherwise make url.origin
// http:// and trigger redirect_uri_mismatch. Force https — and let an explicit
// canonical base (e.g. https://shouldiboat.com) override host + scheme entirely.
function googleRedirectUri(env, url) {
  const base = env.OAUTH_REDIRECT_BASE
    ? env.OAUTH_REDIRECT_BASE.replace(/\/+$/, "")
    : `https://${url.host}`;
  return `${base}/auth/google/callback`;
}

export async function handleAuth(request, env, url) {
  const path = url.pathname;
  if (!env.USERS) return json({ error: "Accounts are not configured yet." }, 503);

  try {
  // ---- register ----
  if (path === "/auth/register" && request.method === "POST") {
    const { email, password } = await request.json().catch(() => ({}));
    if (!validEmail(email)) return json({ error: "Enter a valid email." }, 400);
    if (!password || password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    if (await env.USERS.get(emailKey(email), "json")) return json({ error: "An account with that email already exists." }, 409);
    const salt = randHex(16);
    const user = { id: randHex(8), email: email.trim().toLowerCase(), salt, pass: await pbkdf2(password, salt), created: new Date().toISOString(), prefs: {}, favorites: [], adFree: false, via: "password" };
    await env.USERS.put(emailKey(user.email), JSON.stringify(user));
    const token = await createSession(env, user.email);
    return json({ user: publicUser(user) }, 200, { "Set-Cookie": cookie("sib_session", token, SESSION_DAYS * 86400) });
  }

  // ---- login ----
  if (path === "/auth/login" && request.method === "POST") {
    const { email, password } = await request.json().catch(() => ({}));
    if (!validEmail(email) || !password) return json({ error: "Email and password required." }, 400);
    const user = await env.USERS.get(emailKey(email), "json");
    if (!user || !user.pass) return json({ error: "Invalid email or password." }, 401);
    const hash = await pbkdf2(password, user.salt);
    if (!timingSafeEqual(hash, user.pass)) return json({ error: "Invalid email or password." }, 401);
    const token = await createSession(env, user.email);
    return json({ user: publicUser(user) }, 200, { "Set-Cookie": cookie("sib_session", token, SESSION_DAYS * 86400) });
  }

  // ---- logout ----
  if (path === "/auth/logout" && request.method === "POST") {
    const token = getCookie(request, "sib_session");
    if (token) await env.USERS.delete(sessKey(token));
    return json({ ok: true }, 200, { "Set-Cookie": cookie("sib_session", "", 0) });
  }

  // ---- me ----
  if (path === "/auth/me" && request.method === "GET") {
    const u = await userFromRequest(env, request);
    return json({ user: u ? publicUser(u) : null, billing: !!env.STRIPE_SECRET_KEY });
  }

  // ---- save prefs / favorites ----
  if ((path === "/api/prefs" || path === "/api/favorites") && request.method === "PUT") {
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    const body = await request.json().catch(() => ({}));
    if (path === "/api/prefs" && body.prefs && typeof body.prefs === "object") u.prefs = body.prefs;
    if (path === "/api/favorites" && Array.isArray(body.favorites)) u.favorites = body.favorites.slice(0, 50);
    const { _token, ...store } = u;
    await env.USERS.put(emailKey(u.email), JSON.stringify(store));
    return json({ user: publicUser(u) });
  }

  // ---- Google OAuth ----
  if (path === "/auth/google" && request.method === "GET") {
    if (!env.GOOGLE_CLIENT_ID) return json({ error: "Google sign-in not configured." }, 503);
    // The Secure state cookie below only sticks over https; if the flow starts on
    // http (bare-domain mobile hit) the cookie is dropped and the callback fails
    // state validation. Upgrade to https first so the whole flow stays secure.
    if (url.protocol === "http:") {
      const https = new URL(url.toString());
      https.protocol = "https:";
      return new Response(null, { status: 302, headers: { Location: https.toString() } });
    }
    const state = randHex(16);
    const redirect = googleRedirectUri(env, url);
    const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    g.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    g.searchParams.set("redirect_uri", redirect);
    g.searchParams.set("response_type", "code");
    g.searchParams.set("scope", "openid email");
    g.searchParams.set("state", state);
    return new Response(null, { status: 302, headers: { Location: g.toString(), "Set-Cookie": cookie("sib_oauth", state, 600) } });
  }
  if (path === "/auth/google/callback" && request.method === "GET") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ error: "Google sign-in not configured." }, 503);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || state !== getCookie(request, "sib_oauth")) return new Response("Invalid OAuth state", { status: 400 });
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: googleRedirectUri(env, url), grant_type: "authorization_code" }),
    }).then((r) => r.json()).catch(() => null);
    if (!tok || !tok.id_token) return new Response("OAuth exchange failed", { status: 502 });
    const payload = JSON.parse(atob(tok.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const email = (payload.email || "").toLowerCase();
    if (!email) return new Response("No email from Google", { status: 502 });
    let user = await env.USERS.get(emailKey(email), "json");
    if (!user) {
      user = { id: randHex(8), email, created: new Date().toISOString(), prefs: {}, favorites: [], adFree: false, via: "google" };
      await env.USERS.put(emailKey(email), JSON.stringify(user));
    }
    const token = await createSession(env, email);
    return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": cookie("sib_session", token, SESSION_DAYS * 86400) } });
  }

  // ---- Stripe: start checkout for ad-free ----
  if (path === "/api/checkout" && request.method === "POST") {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Billing is not configured yet." }, 503);
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (u.adFree) return json({ error: "You're already ad-free." }, 400);
    const params = {
      mode: "subscription",
      "line_items[0][price]": env.STRIPE_PRICE_ID || STRIPE_PRICE, // env override lets you use a test-mode price

      "line_items[0][quantity]": "1",
      success_url: `${url.origin}/?upgraded=1`,
      cancel_url: `${url.origin}/`,
      client_reference_id: u.email,
      allow_promotion_codes: "true",
    };
    if (u.stripeCustomerId) params.customer = u.stripeCustomerId;
    else params.customer_email = u.email;
    let session = await stripeAPI(env, "checkout/sessions", params);
    // A stale/invalid customer id (e.g. from another sandbox) → retry by email.
    if ((!session || !session.url) && params.customer && /customer/i.test(session?.error?.message || "")) {
      delete params.customer;
      params.customer_email = u.email;
      session = await stripeAPI(env, "checkout/sessions", params);
    }
    if (!session || !session.url) return json({ error: session?.error?.message || "Could not start checkout." }, 502);
    return json({ url: session.url });
  }

  // ---- Stripe: manage subscription (billing portal) ----
  if (path === "/api/portal" && request.method === "POST") {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Billing is not configured yet." }, 503);
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!u.stripeCustomerId) return json({ error: "No subscription found." }, 400);
    const session = await stripeAPI(env, "billing_portal/sessions", { customer: u.stripeCustomerId, return_url: `${url.origin}/` });
    if (!session || !session.url) return json({ error: session?.error?.message || "Could not open billing portal." }, 502);
    return json({ url: session.url });
  }

  // ---- Stripe: webhook (subscription lifecycle → adFree) ----
  if (path === "/stripe/webhook" && request.method === "POST") {
    const raw = await request.text();
    const ok = await stripeVerify(raw, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET || "");
    if (!ok) return json({ error: "Bad signature" }, 400);
    let event;
    try { event = JSON.parse(raw); } catch { return json({ error: "Bad payload" }, 400); }
    const obj = event?.data?.object || {};
    const setAdFree = async (email, value, extra = {}) => {
      if (!email) return;
      const user = await env.USERS.get(emailKey(email), "json");
      if (!user) return;
      await saveUser(env, { ...user, adFree: value, ...extra });
    };
    if (event.type === "checkout.session.completed") {
      const email = (obj.client_reference_id || obj.customer_email || obj.customer_details?.email || "").toLowerCase();
      if (obj.customer && email) await env.USERS.put(`stripecust:${obj.customer}`, email); // reverse index for later events
      await setAdFree(email, true, { stripeCustomerId: obj.customer || null, stripeSubId: obj.subscription || null });
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const email = await env.USERS.get(`stripecust:${obj.customer}`);
      const active = event.type !== "customer.subscription.deleted" && ["active", "trialing", "past_due"].includes(obj.status);
      await setAdFree(email, active);
    }
    return json({ received: true });
  }

  return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e && e.message ? e.message : "Server error" }, 500);
  }
}
