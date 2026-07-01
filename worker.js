// Worker entry for Cloudflare Workers Builds (static assets + API).
//
// Static files in ./public are served automatically (assets-first); this Worker
// only runs for non-asset requests, so it just routes the marine API to the
// existing handler. Keeping conditions.js as a module means the same code also
// works as a Pages Function.
import { onRequest } from "./functions/marine/conditions.js";
import { handleAuth } from "./functions/auth.js";

// Baseline security headers applied to every response. These are intentionally
// conservative: no script/style CSP directives, so the Google Ads/Analytics/
// Stripe stack keeps working, while still hardening clickjacking, MIME sniffing,
// referrer leakage, transport security, and base-tag/plugin injection.
function withSecurityHeaders(resp) {
  const h = new Headers(resp.headers);
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "SAMEORIGIN");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  h.set("Content-Security-Policy", "frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  // Canonical host: send www.* to the bare domain (one host for SEO + sender reputation).
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
    return Response.redirect(url.toString(), 301);
  }
  const p = url.pathname;
  if (p.startsWith("/marine/")) return onRequest({ request, env, ctx });
  if (p.startsWith("/auth/") || p.startsWith("/api/") || p.startsWith("/stripe/") || p === "/unsubscribe") return handleAuth(request, env, url, ctx);
  // SPA fallback: a non-asset, non-API navigation (e.g. /account) should serve
  // the app shell so client-side routing and direct refreshes work, not 404.
  // Real asset 404s (paths with a file extension) still 404.
  if (request.method === "GET" && env.ASSETS && !/\.[a-z0-9]+$/i.test(p)) {
    const shell = new URL(request.url);
    shell.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(shell, request));
  }
  // Not an API route and not a static asset that was already served.
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    return withSecurityHeaders(await route(request, env, ctx));
  },
};
