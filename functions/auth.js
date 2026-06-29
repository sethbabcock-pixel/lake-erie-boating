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
//   GET  /api/site-config           -> public homepage hero + today's takeover
//   GET/PUT /api/admin/config       -> admin-only site config (hero, takeovers)
//   GET  /api/admin/users           -> admin-only user search
//   GET/POST /api/admin/user        -> admin-only user detail + flag toggle
//   POST /api/admin/upload          -> admin image upload (stored in KV)
//   GET  /api/asset/<id>            -> serve an uploaded image
//   GET  /api/billing-status        -> admin-only Stripe config diagnostics
//   POST /api/checkout              -> start Stripe Checkout (ad-free)
//   GET  /api/subscription          -> current subscription details
//   POST /api/subscription {action} -> cancel | resume (at period end)
//   POST /api/portal                -> Stripe billing portal
//   POST /stripe/webhook            -> subscription lifecycle -> adFree
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

const publicUser = (u) => ({ email: u.email, prefs: u.prefs || {}, favorites: u.favorites || [], adFree: !!u.adFree, via: u.via || "password", created: u.created || null, hasSubscription: !!u.stripeSubId });

// ── Admin-managed site config (homepage hero + sponsor takeovers) ─────────────
const isoDay = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const DEFAULT_SITE_CONFIG = {
  hero: { image: "/hero-sunset.svg", video: "", headline: "Should I boat{spot} today?", sub: "", showVerdict: true },
  takeovers: [],
  gam: { networkCode: "" },
};
// Site owner — admin by default so /admin works with no Cloudflare setup.
// Override (or add more admins) with the ADMIN_EMAIL env var.
const DEFAULT_ADMIN = "seth.babcock@gmail.com";
const isAdmin = (env, u) => !!(u && u.email === (env.ADMIN_EMAIL || DEFAULT_ADMIN).trim().toLowerCase());
// Admin views of a user — never expose the password hash/salt or tokens.
const adminUserSummary = (u) => ({
  email: u.email, created: u.created || null, via: u.via || "password",
  adFree: !!u.adFree, hasSubscription: !!u.stripeSubId, favorites: (u.favorites || []).length,
  boatType: (u.prefs && u.prefs.boatType) || null,
});
const adminUserView = (u) => ({
  ...adminUserSummary(u),
  stripeCustomerId: u.stripeCustomerId || null,
  hasStripeCustomer: !!u.stripeCustomerId,
  prefs: u.prefs || {},
  favoriteSpots: u.favorites || [],
});
function sanitizeSiteConfig(input) {
  const c = input && typeof input === "object" ? input : {};
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const hero = c.hero && typeof c.hero === "object" ? c.hero : {};
  const gam = c.gam && typeof c.gam === "object" ? c.gam : {};
  const takeovers = (Array.isArray(c.takeovers) ? c.takeovers : []).slice(0, 50).map((t) => ({
    id: str(t.id, 60) || randHex(4),
    sponsor: str(t.sponsor, 120), start: str(t.start, 10), end: str(t.end, 10),
    eyebrow: str(t.eyebrow, 120), headline: str(t.headline, 160), sub: str(t.sub, 240),
    cta: str(t.cta, 40), href: str(t.href, 400), logo: str(t.logo, 400), bgImage: str(t.bgImage, 400),
    bg: str(t.bg, 40), fg: str(t.fg, 40), accent: str(t.accent, 40), accentFg: str(t.accentFg, 40),
    hideForAdFree: !!t.hideForAdFree,
  })).filter((t) => t.sponsor || t.headline);
  return {
    hero: {
      image: str(hero.image, 400) || DEFAULT_SITE_CONFIG.hero.image,
      video: str(hero.video, 400),
      headline: str(hero.headline, 160) || DEFAULT_SITE_CONFIG.hero.headline,
      sub: str(hero.sub, 240),
      showVerdict: hero.showVerdict !== false,
    },
    takeovers,
    gam: { networkCode: str(gam.networkCode, 30) },
  };
}

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
async function stripeGET(env, path) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  return r.json();
}
// Normalize a Stripe subscription object into the shape the account page needs.
// current_period_end moved to the item level in recent API versions, so read both.
function subSummary(s) {
  const item = s.items?.data?.[0] || {};
  const price = item.price || {};
  return {
    status: s.status,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
    currentPeriodEnd: s.current_period_end || item.current_period_end || null,
    cancelAt: s.cancel_at || null,
    amount: price.unit_amount ?? null,
    currency: price.currency || null,
    interval: price.recurring?.interval || null,
  };
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

  // ---- public site config (homepage hero + today's takeover) ----
  if (path === "/api/site-config" && request.method === "GET") {
    const stored = (await env.USERS.get("site:config", "json")) || {};
    const cfg = sanitizeSiteConfig({ ...DEFAULT_SITE_CONFIG, ...stored });
    const today = isoDay();
    const takeover = cfg.takeovers.find((t) => t.start && t.start <= today && today <= (t.end || t.start)) || null;
    return json({ hero: cfg.hero, takeover, gam: cfg.gam });
  }

  // ---- admin: read / write full site config ----
  if (path === "/api/admin/config" && (request.method === "GET" || request.method === "PUT")) {
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!isAdmin(env, u)) return json({ error: "Forbidden — not an admin account." }, 403);
    if (request.method === "GET") {
      const stored = (await env.USERS.get("site:config", "json")) || {};
      return json({ config: sanitizeSiteConfig({ ...DEFAULT_SITE_CONFIG, ...stored }), adminEmail: u.email });
    }
    const body = await request.json().catch(() => ({}));
    const cfg = sanitizeSiteConfig(body.config);
    await env.USERS.put("site:config", JSON.stringify({ ...cfg, updatedAt: new Date().toISOString(), updatedBy: u.email }));
    return json({ config: cfg, savedAt: new Date().toISOString() });
  }

  // ---- admin: search users ----
  if (path === "/api/admin/users" && request.method === "GET") {
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!isAdmin(env, u)) return json({ error: "Forbidden — not an admin account." }, 403);
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const list = await env.USERS.list({ prefix: "user:", limit: 1000 });
    // Email is in the key, so we can filter without fetching every record.
    const matches = list.keys.filter((k) => !q || k.name.slice(5).toLowerCase().includes(q)).slice(0, 200);
    const users = [];
    for (const k of matches) {
      const rec = await env.USERS.get(k.name, "json");
      if (rec && rec.email) users.push(adminUserSummary(rec));
    }
    users.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
    return json({ users, total: list.keys.length, shown: users.length });
  }

  // ---- admin: read / update a single user ----
  if (path === "/api/admin/user" && (request.method === "GET" || request.method === "POST")) {
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!isAdmin(env, u)) return json({ error: "Forbidden — not an admin account." }, 403);
    const email = request.method === "GET"
      ? (url.searchParams.get("email") || "").trim().toLowerCase()
      : ((await request.clone().json().catch(() => ({}))).email || "").trim().toLowerCase();
    if (!email) return json({ error: "email required." }, 400);
    const target = await env.USERS.get(emailKey(email), "json");
    if (!target) return json({ user: null }, 404);
    if (request.method === "GET") return json({ user: adminUserView(target) });
    // POST: toggle account flags (manual override; does not touch Stripe billing).
    const body = await request.json().catch(() => ({}));
    if (typeof body.adFree === "boolean") target.adFree = body.adFree;
    await env.USERS.put(emailKey(target.email), JSON.stringify(target));
    return json({ user: adminUserView(target) });
  }

  // ---- serve an admin-uploaded image (public) ----
  if (path.startsWith("/api/asset/") && request.method === "GET") {
    const id = path.slice("/api/asset/".length);
    if (!/^[a-z0-9]+$/i.test(id)) return new Response("Not found", { status: 404 });
    const buf = await env.USERS.get(`asset:${id}`, "arrayBuffer");
    if (!buf) return new Response("Not found", { status: 404 });
    const ct = (await env.USERS.get(`asset:${id}:ct`)) || "image/jpeg";
    return new Response(buf, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=31536000, immutable" } });
  }

  // ---- admin: upload an image (stored in KV, served at /api/asset/<id>) ----
  if (path === "/api/admin/upload" && request.method === "POST") {
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!isAdmin(env, u)) return json({ error: "Forbidden — not an admin account." }, 403);
    const ct = request.headers.get("Content-Type") || "";
    const isImage = /^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/i.test(ct);
    const isVideo = /^video\/(mp4|webm|quicktime)$/i.test(ct);
    if (!isImage && !isVideo) return json({ error: "Only images (PNG/JPG/WebP/GIF/SVG) or video (MP4/WebM) are allowed." }, 400);
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) return json({ error: "Empty upload." }, 400);
    const cap = isVideo ? 12 * 1024 * 1024 : 4 * 1024 * 1024;
    if (buf.byteLength > cap) return json({ error: isVideo ? "Video too large — max 12 MB (use a short, compressed loop, or host on Cloudflare Stream)." : "Image too large — max 4 MB." }, 413);
    const id = randHex(8);
    await env.USERS.put(`asset:${id}`, buf);
    await env.USERS.put(`asset:${id}:ct`, ct);
    return json({ url: `/api/asset/${id}`, bytes: buf.byteLength });
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

  // ---- Stripe: config diagnostics (admin-only, no secrets leaked) ----
  if (path === "/api/billing-status" && request.method === "GET") {
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!isAdmin(env, u)) return json({ error: "Forbidden — not an admin account." }, 403);
    const sk = env.STRIPE_SECRET_KEY || "";
    const mode = sk.startsWith("sk_live") ? "live" : sk.startsWith("sk_test") ? "test" : sk ? "unknown" : "none";
    const priceId = env.STRIPE_PRICE_ID || STRIPE_PRICE;
    const status = {
      secretKey: { present: !!sk, mode },
      webhookSecret: { present: !!env.STRIPE_WEBHOOK_SECRET },
      priceId,
      priceOverride: !!env.STRIPE_PRICE_ID,
    };
    // If we have a key, resolve the price live so you can confirm it actually
    // exists in this account/mode — the usual "No such price" cause of failures.
    if (sk) {
      const r = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
        headers: { Authorization: `Bearer ${sk}` },
      }).then((x) => x.json()).catch(() => null);
      status.price = r && r.id
        ? { resolved: true, active: r.active, amount: r.unit_amount, currency: r.currency, interval: r.recurring?.interval || null, livemode: r.livemode }
        : { resolved: false, error: r?.error?.message || "lookup failed" };
      status.ready = !!sk && !!env.STRIPE_WEBHOOK_SECRET && status.price.resolved === true && status.price.active === true;
    } else {
      status.ready = false;
    }
    return json(status);
  }

  // ---- Stripe: subscription details (for the account page) ----
  if (path === "/api/subscription" && request.method === "GET") {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Billing is not configured yet." }, 503);
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!u.stripeSubId) return json({ subscription: null });
    const s = await stripeGET(env, `subscriptions/${encodeURIComponent(u.stripeSubId)}`);
    if (!s || s.error) return json({ subscription: null, error: s?.error?.message || "Could not load subscription." });
    return json({ subscription: subSummary(s) });
  }

  // ---- Stripe: cancel / resume at period end ----
  if (path === "/api/subscription" && request.method === "POST") {
    if (!env.STRIPE_SECRET_KEY) return json({ error: "Billing is not configured yet." }, 503);
    const u = await userFromRequest(env, request);
    if (!u) return json({ error: "Not signed in." }, 401);
    if (!u.stripeSubId) return json({ error: "No active subscription." }, 400);
    const { action } = await request.json().catch(() => ({}));
    if (action !== "cancel" && action !== "resume") return json({ error: "Unknown action." }, 400);
    // cancel_at_period_end keeps ad-free until the paid-through date; the
    // subscription.updated webhook leaves adFree on until it actually ends.
    const s = await stripeAPI(env, `subscriptions/${encodeURIComponent(u.stripeSubId)}`, {
      cancel_at_period_end: action === "cancel" ? "true" : "false",
    });
    if (!s || s.error) return json({ error: s?.error?.message || "Could not update subscription." }, 502);
    return json({ subscription: subSummary(s) });
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
