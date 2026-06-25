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

export async function handleAuth(request, env, url) {
  const path = url.pathname;
  if (!env.USERS) return json({ error: "Accounts are not configured yet." }, 503);

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
    return json({ user: u ? publicUser(u) : null });
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
    const state = randHex(16);
    const redirect = `${url.origin}/auth/google/callback`;
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
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: `${url.origin}/auth/google/callback`, grant_type: "authorization_code" }),
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

  return json({ error: "Not found" }, 404);
}
