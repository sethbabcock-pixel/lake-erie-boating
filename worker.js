// Worker entry for Cloudflare Workers Builds (static assets + API).
//
// The Worker runs first for every request (run_worker_first in wrangler.jsonc)
// so the canonical-host redirect and security headers cover page loads too;
// static assets are served through the ASSETS binding in route(). Keeping
// conditions.js as a module means the same code also works as a Pages Function.
import { onRequest } from "./functions/marine/conditions.js";
import { handleAuth } from "./functions/auth.js";
import { runScheduled } from "./functions/digest.js";
import { robotsTxt, sitemapXml, seoForPath, injectSeo } from "./functions/seo.js";

// Baseline security headers applied to every response. These are intentionally
// conservative: no script/style CSP directives, so the Google Ads/Analytics/
// Stripe stack keeps working, while still hardening clickjacking, MIME sniffing,
// referrer leakage, transport security, and base-tag/plugin injection.
// Report-only CSP: browsers report violations to /api/csp-report but nothing is
// blocked, so it can't break the ads/analytics/Stripe stack. We watch the
// reports, tighten the allowlist, then promote this to an enforced policy.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://securepubads.g.doubleclick.net https://*.doubleclick.net https://www.googletagservices.com https://js.stripe.com https://adservice.google.com https://fundingchoicesmessages.google.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.doubleclick.net https://pagead2.googlesyndication.com https://*.googlesyndication.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://api.stripe.com https://region1.google-analytics.com",
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.doubleclick.net https://*.googlesyndication.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google https://*.adtrafficquality.google https://js.stripe.com https://*.stripe.com https://www.google.com https://fundingchoicesmessages.google.com https://embed.windy.com https://*.ozolio.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
].join("; ");

function withSecurityHeaders(resp) {
  const h = new Headers(resp.headers);
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "SAMEORIGIN");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Allow first-party geolocation (the "find the nearest launch" button); still
  // deny mic/camera. (self) means our own origin may prompt, third parties can't.
  h.set("Permissions-Policy", "geolocation=(self), microphone=(), camera=()");
  h.set("Content-Security-Policy", "frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
  h.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
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
  // SEO endpoints (see functions/seo.js).
  if (p === "/robots.txt") return new Response(robotsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
  if (p === "/sitemap.xml") return new Response(sitemapXml(), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  // With run_worker_first (wrangler.jsonc) the Worker fronts every request so
  // the www redirect above applies to page loads, not just API calls — which
  // means assets must be served here instead of by the assets-first layer.
  if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) {
    // SEO pages (home + /spot/<id>): serve the shell with per-page <head> meta
    // so each spot is its own indexable result, not one generic SPA page.
    const seo = seoForPath(p);
    if (seo) {
      const shellUrl = new URL(request.url);
      shellUrl.pathname = "/index.html";
      const shell = await env.ASSETS.fetch(new Request(shellUrl, { headers: request.headers }));
      if (shell.ok) {
        const body = request.method === "HEAD" ? null : injectSeo(await shell.text(), seo);
        return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
      }
    }
    // Fetch the app shell with a fresh GET (redirect: follow). The incoming
    // request defaults to redirect:"manual", which would pass through the
    // assets layer's /index.html→/ canonicalization 307 instead of resolving it.
    const fetchShell = () => {
      const shellUrl = new URL(request.url);
      shellUrl.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(shellUrl, { headers: request.headers }));
    };
    // Unknown /spot/* (e.g. a stale link) is still an SPA route — serve the app
    // shell so the client can handle it, not the assets layer's 307/404.
    if (p.startsWith("/spot/")) return fetchShell();
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;
    // SPA fallback: a non-asset, non-API navigation (e.g. /account) should serve
    // the app shell so client-side routing and direct refreshes work, not 404.
    // Real asset 404s (paths with a file extension) still 404.
    if (!/\.[a-z0-9]+$/i.test(p)) return fetchShell();
    return asset;
  }
  // Not an API route and not a servable static asset.
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env, ctx) {
    return withSecurityHeaders(await route(request, env, ctx));
  },
  // Hourly cron (wrangler.jsonc triggers): daily digest + NO-GO alert emails.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env, new Date(event.scheduledTime).getUTCHours()).catch(() => {}));
  },
};
