# Security backlog

Open items that were found in reviews and deliberately deferred. Each item notes where it came from.

## Enforce `frame-src` (from the Windy cam URL review, Nov 2026)

**Where:** `worker.js`. `frame-src` is only in `CSP_REPORT_ONLY`. The enforced
`Content-Security-Policy` header has only `frame-ancestors`, `base-uri` and `object-src`.

**Why:** Cam players are iframes built from data (Windy API, admin custom cams).
`safeWindyPlayer()` and the URI-encoded provider ids in `camSrc()` protect this today.
An enforced `frame-src` would be a browser-side backstop if one of those checks regresses.

**Why deferred:** The frame allowlist also covers AdSense/GAM, Funding Choices and Stripe.
A missing host in an enforced policy blanks ads or checkout. Before promoting it:
1. Review `/api/csp-report` for `frame-src` violations over at least 2 weeks of normal traffic.
2. Add any legitimate hosts that are missing.
3. Move only the `frame-src` directive into the enforced header and keep the rest report-only.
4. Smoke-test ads, the consent banner, Stripe checkout and every cam provider (YouTube,
   Angelcam, WetMet, IPCamLive, Ozolio, Windy) on a preview deploy.

Owner: devops-sre (deploy), security-engineer (review).
