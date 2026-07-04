# Monetization wiring

Every revenue stream is plumbed and **idle-safe**: nothing renders or charges
until you paste in the one value that turns it on. Enable them one at a time —
no code changes needed beyond the value itself. After editing, commit + push (a
deploy rebuilds automatically).

| Stream | Status | What to do |
|---|---|---|
| Display ads (AdSense) | Publisher ID set; **0 ad units placed** | Create ad units, paste slot IDs (below) |
| Affiliate (Amazon) | Wired; **tag empty** | Paste your Associates tag (below) |
| Subscription (Stripe) | Live — $2.99/mo ad-free | Test a real checkout end-to-end |
| Direct sponsorships | Wired (admin UI) | Sell a takeover, enter it at `/admin` |
| Programmatic (GAM) | Wired; **network code empty** | Optional; paste GAM network code |
| Analytics (GA4) | Live (consent-gated) | Nothing — funnel events already fire |

---

## 1. AdSense display ads — `src/monetize.jsx`

First get your AdSense account **approved** (it's under review once the site is
live). Then in AdSense: **Ads → By ad unit → Display → create a unit**, and copy
its 10-digit **slot ID**. Paste into `ADSENSE.slots`:

```js
export const ADSENSE = {
  client: "ca-pub-9213366013949616", // already set
  slots: {
    detailTop: "",  // ← paste slot ID: spot page, under the conditions row (highest traffic)
    detailMid: "",  // ← paste slot ID: spot page, lower down
    landing: "",    // ← paste slot ID: homepage, under the port directory
  },
};
```

Each placement renders **nothing** until its slot is filled, so you can turn
them on one by one. `ads.txt` is already correct. Ads only load after a visitor
consents (Consent Mode v2) and never show for ad-free subscribers.

## 2. Amazon affiliate — `src/monetize.jsx`

Sign up for **Amazon Associates**, then set your tag:

```js
export const AMAZON_TAG = "shouldiboat-20"; // ← your tag
```

The "Gear for the water" block (PFDs, VHF radios, anchors, cold-water layers)
immediately starts carrying your tag and the "As an Amazon Associate…"
disclosure. Terms already disclose affiliate links.

## 3. Stripe subscription — already live

The $2.99/mo ad-free plan is wired (`STRIPE_PRICE` in `functions/auth.js`).
Before launch: run one real checkout to confirm the webhook flips the account to
ad-free. Requires `STRIPE_SECRET_KEY` / webhook secret set as Worker secrets.

## 4. Direct sponsorships — `/admin` (no code)

The hero "takeover" is sold inventory — far higher value than AdSense for a
hyperlocal boating audience (marinas, charters, dealers, bait shops). Sign in as
the admin account, go to **/admin → Sponsor takeovers**, and enter the sponsor
name, logo, link, and run dates. It shows automatically during the window.

## 5. Programmatic (Google Ad Manager) — `src/sponsor.js` (optional)

If you later run GAM, set `GAM.networkCode`. Leave empty to stay on AdSense only.

## Measuring it (GA4)

The funnel already emits events (consent-gated): `spot_view`,
`signup_gate_view`, `signup_gate_click`, `subscribe_click`, `share_verdict`.
In GA4 you can watch: visits → spot views → gate → signup → subscribe.

## Priority order

1. **AdSense slot IDs + Amazon tag** — turns $0 into real revenue per visitor.
2. **Submit `/sitemap.xml`** in Google Search Console — starts organic traffic.
3. **Drive traffic** — Great Lakes boating/fishing communities, marinas.
4. **Direct sponsorships** — once you have traffic to sell.
