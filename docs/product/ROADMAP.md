# shouldiboat.com Roadmap

Last updated: 2026-11-06 (week-ending review). Principles: safety first; revenue already built but possibly broken beats new features.

## Now (next 7 days)
1. Verify the money and safety paths already shipped (no new features):
   - Stripe webhook: confirm STRIPE_WEBHOOK_SECRET is set in Cloudflare; run one real checkout and confirm the account flips to Pro. Confirm /admin System shows both prices green. (owner: devops-sre + backend-engineer)
   - Hourly NO-GO alert cron after the digest.js rewrite: prove it fires on a forced NO-GO. (owner: backend-engineer, review: marine-data-scientist)
2. PR CI (build + test on PRs) before merging #51. (owner: devops-sre)
3. In-app "Wrong call? Tell us" link plus a mailto/form path to hello@shouldiboat.com. (spec: ux-designer + product-manager; build: frontend-engineer; legal-compliance on copy)
4. Fix stale welcome email ("ad-free for $2.99/mo") in functions/auth.js ~353. (backend-engineer)

## Next (2-6 weeks)
- Define revenue targets and baseline GA4 funnel (spot_view -> signup_gate_view -> subscribe_click). Owner provides GA4 numbers. (revenue-analyst)
- Uptime monitoring and basic observability (Worker errors, cron heartbeat). (devops-sre)
- Re-enable or replace Cam health workflow; close stale issue #39; demote YouTube-cam WARN noise. (devops-sre)
- Sponsor kit: rate card, one-pager, first 20 prospects; ready by early January (marinas plan Jan-Mar spend). Blocked on GA4 traffic numbers. (sales-sponsorships)
- Merge #51 guides after CI is green (SEO). (seo-content-strategist)

## Later
- Merch go/no-go Feb 15, 2027 (needs vector logo first). (merch-manager)
- Cleveland Boat Show 2027 presence once dates/venue are confirmed.
- Yearly Pro price (set STRIPE_PRICE_ID_YEARLY) once monthly conversion is measured.
- Fill footerSticky ad slot only if fill data supports it.
- More coastal regions (each needs marine-data-scientist review).

## Not doing
- New paid features or new regions before the Stripe and NO-GO alert paths are verified.
- More SEO page volume (sitemap was cut 116 -> 27 for AdSense quality; do not regress).
- Merch spend before the Feb 15 go/no-go.
- Paywalling any safety information (verdicts, NO-GO alerts stay free).
