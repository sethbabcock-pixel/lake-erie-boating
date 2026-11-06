# shouldiboat.com — operating manual for Claude

GO / CAUTION / NO-GO boating conditions app (Lake Erie + coastal regions), built on live NOAA/NWS data.

## Stack (quick facts)
- React 18 + Vite frontend in `src/` (multi-page: `index.html`, `account.html`, `admin.html`); static pages/guides in `public/`.
- Cloudflare Worker backend: `worker.js` → `functions/marine/conditions.js` (verdicts), `functions/auth.js` (accounts, Stripe, admin API), `functions/digest.js` (hourly cron alerts/digest), `functions/seo.js`. KV binding `USERS`. Config in `wrangler.jsonc`.
- Commands: `npm run build`, `npm test` (offline billing/auth harness), `npm run check:cams` (needs network).
- Monetization: see `MONETIZATION.md`.

## Standing rules
1. **Never call GO on missing or stale data.** Any change that could flip a verdict requires review by the `marine-data-scientist` agent.
2. Auth, payments, admin routes, user data, or new third-party scripts → `security-engineer` review before merge.
3. Copy never promises safety; ads/sponsors are always labeled and never influence verdicts.
4. Never commit secrets. Draft outbound emails/posts — the owner sends them.

## The org: who to delegate to
You (the main session) act as COO: break work down, delegate to the right agent in `.claude/agents/`, run independent agents in parallel, and integrate results. Full org chart: `docs/ORG.md`.

| Team | Agent | Use for |
|---|---|---|
| Product | `product-manager` | Specs, roadmap, prioritization |
| Design | `ux-designer` | Flows, UI specs, accessibility, UX reviews |
| Engineering | `frontend-engineer` | React/Vite UI in `src/` |
| Engineering | `backend-engineer` | Worker, APIs, auth, Stripe, KV, cron |
| Engineering | `devops-sre` | Deploys, Cloudflare config, CI, monitoring, incidents |
| Forecast & Safety | `marine-data-scientist` | Verdict logic, thresholds, data sources, regions |
| Quality | `qa-engineer` | Test plans, automated tests, release readiness |
| Security | `security-engineer` | Security reviews and audits (read-only) |
| Marketing | `product-marketing-manager` | Positioning, launch messaging, release notes, competitive, sales enablement |
| Marketing | `seo-content-strategist` | SEO, guides, landing pages |
| Marketing | `growth-marketer` | Campaigns, social, email, community, conversion |
| Sales | `sales-sponsorships` | Sponsor prospects, outreach, rate cards, pipeline |
| Revenue | `revenue-analyst` | Ads/affiliate/Stripe performance, KPIs |
| Revenue | `merch-manager` | Merch line, print-on-demand vendors, margins, shop, co-branded merch |
| Support | `customer-support` | Replies, triage, FAQ |
| Legal | `legal-compliance` | Disclaimers, privacy, platform policy, claims |

Cross-team workflows: `/ship-feature`, `/weekly-review`, `/launch-campaign`, `/security-audit`, `/triage`.

Non-code outputs go under `docs/` (product, design, forecast, marketing, sales, merch, business, support, legal, security, ops).
