# shouldiboat.com

A go/no-go boating conditions app for the Great Lakes and US coastal waters —
it started on Lake Erie and now covers the other Great Lakes plus Florida, the
Gulf, the Southeast, Chesapeake Bay, Southern California, Hawaii and Puerto Rico.
Tap a launch spot and get a clear **GO / CAUTION / NO-GO** call backed by live
NOAA data, a wind-direction read, a weather map, and live webcams — everything
you need to decide whether to head out, in one place.

🌐 Live: **https://shouldiboat.com**

## What it does

- **GO / CAUTION / NO-GO verdict** for ~90 launch spots: the original Lake Erie
  ports plus the other Great Lakes and coastal regions (Florida, Gulf Coast,
  Georgia & the Carolinas, Carolina Sounds, Chesapeake Bay, Southern California,
  Hawaii & Puerto Rico), each with its own region
  page (e.g. `/greatlakes`, `/florida`). Coastal spots are rated for ocean swell.
- **Wind and waves that never go blank** — live NDBC buoys, falling back to the
  NWS forecast and the Nearshore Marine Forecast where buoys are missing.
- **Wind read** — plain-language guidance on what the wind *direction* means.
- **Weather map** (embedded Windy) and **live webcams** per spot.
- **Formal NOAA report** — the official NWS marine forecast text.
- **Accounts** — saved ports, daily verdict digest and NO-GO alert emails, and
  a $2.99/mo ad-free subscription via Stripe (see `MONETIZATION.md`).
- **Boating guides** under `/guides/` and server-rendered SEO pages per region.
  Launch pages (`/spot/*`) are server-rendered too but `noindex` and out of the
  sitemap: ~90 pages on one template read as thin content to AdSense, so the
  index is the homepage, region pages and the editorial guides.
- **Admin** at `/admin` (ads, sponsorships, users).

## Data sources

Conditions data is free and needs no API key:

- **NWS api.weather.gov** — point forecast, marine alerts, marine forecast text products
- **NOAA NDBC buoys** — live wave height and period, wind, water temp
- **Windy** — embedded weather map
- **Webcams** — curated feeds in `src/cams.js` (YouTube live, ipcamlive, et al.),
  plus the **Windy Webcams API** for the nearest cam when `WINDY_WEBCAMS_KEY` is
  set (optional)

## Architecture (Cloudflare Worker + static assets)

```
worker.js                       # Worker entry: routing, www→apex redirect, security headers, cron
functions/marine/conditions.js  # GET /marine/conditions — NOAA aggregation + verdicts
functions/auth.js               # /auth, /api, /stripe: accounts, Stripe billing, admin API, Brevo email
functions/digest.js             # hourly cron: NO-GO alerts + daily 6am ET digest
functions/seo.js                # robots.txt, sitemap.xml, per-page <head>/SSR content
src/                            # Vite + React 18 frontend
index.html, account.html, admin.html   # multi-page Vite entries → dist/
public/                         # static pages, guides, icons (copied into dist/)
```

- Deployed as a **Cloudflare Worker** (`wrangler.jsonc`, `main: worker.js`).
  Built assets in `./dist` are served via the `ASSETS` binding with
  `run_worker_first`, so the Worker fronts every request.
- **KV** namespace bound as `USERS` (accounts, settings, admin config).
- **Cron** `0 * * * *` runs `functions/digest.js`.
- `/marine/conditions?spots` lists spots; `?spot=<id>` returns conditions + verdict.

### Secrets / vars

Set in production with `npx wrangler secret put <NAME>` (or the dashboard);
locally in `.dev.vars` (copy `.dev.vars.example`).

| Name | Purpose |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Ad-free subscription billing |
| `BREVO_API_KEY` | Transactional email (resets, digests, alerts) |
| `WINDY_WEBCAMS_KEY` | Optional — nearest Windy webcam for spots without a curated cam |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional — Google sign-in |
| `EMAIL_FROM`, `ADMIN_EMAIL`, `OAUTH_REDIRECT_BASE`, `STRIPE_PRICE_ID` | Optional overrides |

Everything degrades gracefully when an optional key is absent.

## Deploy

Cloudflare **Workers Builds** connected to this repo, production branch `main`.
The build command comes from `wrangler.jsonc` (`npm install && npm run build`),
then `wrangler deploy` publishes `worker.js` with `./dist` as assets. Every push
to `main` deploys. Custom domain is attached to the Worker; set secrets as above.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in keys as needed
npm run build                    # Vite → dist/
npx wrangler dev                 # Worker + assets + API at http://localhost:8787
```

Re-run `npm run build` after frontend changes (`npm run dev` serves the Vite
frontend alone, without the Worker API).

### Scripts

- `npm test` — offline end-to-end tests for Stripe billing + digest (`scripts/test-billing.mjs`)
- `npm run check:cams` — verifies every webcam in `src/cams.js` is still live (also runs weekly in CI)
