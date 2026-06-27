// Worker entry for Cloudflare Workers Builds (static assets + API).
//
// Static files in ./public are served automatically (assets-first); this Worker
// only runs for non-asset requests, so it just routes the marine API to the
// existing handler. Keeping conditions.js as a module means the same code also
// works as a Pages Function.
import { onRequest } from "./functions/marine/conditions.js";
import { handleAuth } from "./functions/auth.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p.startsWith("/marine/")) return onRequest({ request, env, ctx });
    if (p.startsWith("/auth/") || p.startsWith("/api/") || p.startsWith("/stripe/")) return handleAuth(request, env, url);
    // Not an API route and not a static asset that was already served.
    return new Response("Not found", { status: 404 });
  },
};
