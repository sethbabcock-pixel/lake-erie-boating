# Monetization wiring

Every revenue stream is plumbed and **idle-safe**: nothing renders or charges
until you paste in the one value that turns it on. Enable them one at a time —
no code changes needed beyond the value itself. After editing, commit + push (a
deploy rebuilds automatically).

| Stream | Status | What to do |
|---|---|---|
| Display ads (AdSense) | Live; managed at `/admin#ads` with fill telemetry | Check the Ads health panel; confirm site is **Ready** in AdSense |
| Affiliate (Amazon) | Wired; **tag empty** | Paste your Associates tag (below) |
| Subscription (Stripe) | Live — $2.99/mo ad-free | Test a real checkout end-to-end |
| Direct sponsorships | Wired (admin UI) | Sell a takeover, enter it at `/admin` |
| Programmatic (GAM) | Wired; **network code empty** | Optional; paste the network code at `/admin#ads` |
| Analytics (GA4) | Live (consent-gated) | Nothing — funnel events already fire |

---

## 1. AdSense display ads — `/admin#ads` (no code)

Everything is managed in **/admin → Ads**, saved to KV, live on save — no
redeploy:

- **Master switch** and a **per-placement on/off** (pausing keeps the slot ID).
- **Slot IDs** for each placement. In AdSense: **Ads → By ad unit → Display →
  create a unit**, copy its 10-digit slot ID, paste it next to the placement.
- **Health check**: publisher ID, `ads.txt` (fetched live), placements, and a
  plain-language diagnosis of real fill.
- **Fill rates**: 1 in 4 real page loads report, per placement, whether Google
  *filled*, returned *unfilled* (no ad — an account-side status), or got
  *blocked* (ad blocker). This answers "is it my code or my account?" with
  production data. 0% fill with plenty of *unfilled* = check AdSense Sites
  (must say **Ready**) and Policy center.
- **Live render test** (embeds `/adtest.html`) and an AdSense account checklist
  with deep links.

Built-in defaults live in `src/ads-config.js` and apply until the admin saves.
Placements: `detailTop` (spot page, under the verdict), `detailMid` (spot
page, after gear), `landingTop` (homepage, after the directory), `landing`
(homepage, after the guides), `footerSticky` (off until it has a slot).

A placement renders nothing until it has a slot ID, shows its "Advertisement"
label only once Google fills it, and collapses entirely when unfilled or
blocked — no empty labeled boxes. Ads show for free visitors (Consent Mode
serves limited non-personalized ads until Accept) and never for ad-free
subscribers.

### Diagnose: https://shouldiboat.com/adtest

Standalone page (no consent / React / ad-free). Expect:

| Result | Meaning |
|---|---|
| **FILLED** | Serving works end-to-end |
| **UNFILLED** | Code OK; Google returned no creative — check Sites → **Ready**, unit Active, wait for inventory |
| **NO RESPONSE** | Script blocked (ad blocker / privacy DNS) |

Owner preview on the real app: add `?adtest=1` (sample ads, no real
impressions); each placement then shows its fill status in its label.

## 2. Amazon affiliate — `src/monetize.jsx`

Sign up for **Amazon Associates**, then set your tag:

```js
export const AMAZON_TAG = "shouldiboat-20"; // ← your tag
```

The "Gear for the water" block (PFDs, VHF radios, anchors, cold-water layers)
immediately starts carrying your tag and the "As an Amazon Associate…"
disclosure. Terms already disclose affiliate links.

### Upgrade a category to a specific "Our pick" (optional)

Each gear item links to that category's **top-rated** results by default (Amazon
search sorted by customer review). To promote one to a hand-picked product,
paste its **ASIN** — the 10-character ID in any product URL
(`amazon.com/dp/B0ABC12345` → `B0ABC12345`) — into `GEAR` in `src/monetize.jsx`:

```js
pfd: { icon: "🦺", label: "Life jacket (PFD)", q: "coast guard approved life jacket", why: "Required gear", asin: "B0ABC12345" },
```

That card then reads **"Our pick"** and links straight to that product. Leave
`asin: ""` to keep the top-rated fallback. **Never guess an ASIN** — a wrong one
links to the wrong item; copy it from the real product page.

### Storefront shelf (optional)

Build an **Idea List / Storefront** in Amazon Associates, then paste its URL into
`AMAZON_STOREFRONT`. A "Shop all our recommended gear →" link appears under the
rail. Empty = hidden.

> **Live prices, photos & star ratings** need Amazon's **Product Advertising
> API (PA-API 5.0)**, which unlocks only after your account's first ~3 qualifying
> sales. Don't hardcode prices — that violates the Operating Agreement. The gear
> cards are built to accept live PA-API data once it's available.

## 3. Stripe subscription — already live

The $2.99/mo ad-free plan is wired (`STRIPE_PRICE` in `functions/auth.js`).
Before launch: run one real checkout to confirm the webhook flips the account to
ad-free. Requires `STRIPE_SECRET_KEY` / webhook secret set as Worker secrets.

## 4. Direct sponsorships — `/admin` (no code)

The hero "takeover" is sold inventory — far higher value than AdSense for a
hyperlocal boating audience (marinas, charters, dealers, bait shops). Sign in as
the admin account, go to **/admin → Sponsor takeovers**, and enter the sponsor
name, logo, link, and run dates. It shows automatically during the window.

## 5. Programmatic (Google Ad Manager) — `/admin#ads` (optional)

If you later run GAM, paste the network code under **Ads → Programmatic
takeover**. Leave empty to stay on AdSense only.

## Measuring it (GA4)

The funnel already emits events (consent-gated): `spot_view`,
`signup_gate_view`, `signup_gate_click`, `subscribe_click`, `share_verdict`.
In GA4 you can watch: visits → spot views → gate → signup → subscribe.

## Priority order

1. **AdSense slot IDs + Amazon tag** — turns $0 into real revenue per visitor.
2. **Submit `/sitemap.xml`** in Google Search Console — starts organic traffic.
3. **Drive traffic** — Great Lakes boating/fishing communities, marinas.
4. **Direct sponsorships** — once you have traffic to sell.
