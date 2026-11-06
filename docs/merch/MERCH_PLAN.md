# shouldiboat.com Merch Plan v1 (draft)

**Owner:** merch-manager · **Drafted:** 2026-11-06 · **Status:** awaiting owner decisions (see §9)

**Price labels used throughout:**
- **[V]** = figure appears on the vendor's own domain, but I saw it only as a search-result snippet. I could not open the page.
- **[3P]** = third-party blog or review, not the vendor.
- **[EST]** = my estimate, with no source.

Every price in this plan is **unverified at the primary source**. This session's network blocked direct fetches of printful.com, printify.com, shopify.com and stripe.com, so the figures come from web-search results checked on 2026-11-06. Confirm each one in the vendor dashboard before setting retail prices. Sources are listed at the end.

---

## 1. Recommendation (decide this)

| Question | Recommendation |
|---|---|
| **Vendor** | **Printful** as the primary vendor, with **Printify** as a fallback for SKUs Printful lacks (UPF sun shirts, possibly koozies). One vendor for the core line keeps quality, branding and support simple. |
| **Integration path** | **Phase 1: link out to a hosted Printful store** (zero monthly fee, zero Worker code). **Phase 3: build an on-site shop with our existing Stripe and the Printful API**, only if the §8 thresholds are met. **Skip Shopify:** its $39/mo [3P] needs about 3 orders every month just to break even, and that includes the Nov–Apr off-season. |
| **First products** | Core 6 for spring: signal tee, Lake Erie tee, dad hat, sticker 3-pack, UPF sun shirt, dock/garden flag. Add-ons: hoodie (gift season), koozie (only if a POD source is confirmed). See §3. |
| **When** | **Gift mini-drop (optional), live Dec 1, 2026:** tee, hoodie, hat and stickers, link-out only, announced to existing users. Do it **only if** vector art and the terms update are done by **Nov 24**. Otherwise skip it; rushing legal is not worth holiday revenue at off-season traffic. **Spring soft launch: Apr 15, 2027**, about 2 weeks before the season opens in May. **Gift season 2: Nov 2027.** |
| **Inventory** | None. Print-on-demand only until sales data exists (agent rule). |
| **Blocker found** | The brand mark exists only as a 248×82 PNG (`public/boat-mark.png`), which is too small to print or embroider. **A vector (SVG/AI) master is required** before anything ships. |

---

## 2. Vendor comparison

| | **Printful** | **Printify** | **Shopify + POD app** | **Stripe Checkout + POD API** |
|---|---|---|---|---|
| Monthly fee | $0 on Free; paid tiers lower base costs [3P] | $0 Free; Premium **$39/mo or $299/yr**, up from $29 on 2026-02-17 [V] | Basic **$39/mo, or $29/mo billed annually** [3P]; POD app free to install [EST] | $0 platform fee; Stripe Tax **0.5%/txn** where tax is calculated [3P] |
| Payment fees | Included in hosted store (verify) | Via your sales channel | 2.9% + 30¢ (Shopify Payments) [3P] | **2.9% + 30¢** US cards; +1.5% on international cards [3P] |
| Tee base (Bella+Canvas 3001) | **$12.95** Free / ~$9.05 Growth [3P]; one Sept 2026 API reading said $11.92 [3P] | **~$10.98** Free / ~$8.77 Premium, varies by print provider [3P] | Vendor's cost | Vendor's cost |
| Hat base (dad hat, embroidered) | **$14.02** (Yupoong 6245CM) [V]; digitization fee extra, amount unverified | ~$13.50 [3P] | Vendor's cost | Vendor's cost |
| Sticker base (3×3 kiss-cut) | **$1.95** Free / $1.59 Growth [3P] | ~$1.20–1.52 [3P] | Vendor's cost | Vendor's cost |
| US shipping, 1 tee | **$4.75 first / $2.20 each additional** (most consistent figure) [3P]; **+$0.40 US surcharge Oct 15, 2026 – Jan 17, 2027** [V] | Varies by provider; similar range [3P] | Vendor's rates | Vendor's rates |
| Production time | **2–5 business days** [V] | **2–7 business days**, provider-dependent [V] | Vendor's | Vendor's |
| UPF / performance sun shirts | A product page lists "UPF 50+" (product 919); type and print method unconfirmed [V] | **Yes:** Men's UV Protection LS AOP, UPF 50, from $48.84; Sport-Tek Women's Posi-UV Pro from $20.21 (UPF not shown in snippet) [V] | Via app | Via API |
| Flags | **Yes:** garden from $8.67, outdoor w/ rod pocket $12.16, all-over-print flag $22.79 [V] | Not checked | Via app | Via API |
| Koozies | Not found | Not found in search; check catalog | — | — |
| Quality consistency | Printful-owned facilities; one quality bar [EST, common reputation] | Network of third-party providers; quality varies by provider [3P] | Vendor's | Vendor's |
| Returns / defects | Reprint or refund for **misprint/damage within 30 days of delivery**; **no returns** for wrong size or change of mind [V] | Not checked; assume similar [EST] | Our own policy plus vendor's | Our own policy plus vendor's |
| Sales tax | **Quick Stores: Printful is seller of record** and collects/remits [V] | Collects on US orders in states where Printify is registered, unless we hold a resale cert [V] | Shopify Tax tools; **we are the seller** | **We are the seller.** Stripe Tax calculates, but registration and filing are on us |
| Effort for our Worker + React site | **S:** add a link | **S:** add a link (or Etsy/eBay channel) | **M:** separate storefront, DNS for `shop.` subdomain, second brand surface | **L:** new endpoints, webhook routing, order forwarding, refunds (see §5) |
| Verdict | **Phase 1 pick** | Fallback for sun shirts | Not justified at our volume | **Phase 3, if thresholds are met** |

---

## 3. Starter product line (8 SKUs)

**Brand palette for print** (`src/styles.css` overrides `tokens.css`):
- Navy `#004777`, teal `#008BA8`, mint `#33CC99`, gold `#D4AF37`.
- Verdict colors: GO `#1B936A`, CAUTION `#A9831C`, NO-GO `#C0392B`.
- Type: Inter (open-source, OFL).

**Rules for every design:**
- No NOAA/NWS/USCG marks or seals.
- No copy that implies the app keeps you safe.
- No red-pennant layouts that resemble official marine warning displays.
- No sports-team marks.

| # | SKU | Blank (vendor) | Design brief | Copy (draft; product-marketing-manager to finalize) |
|---|---|---|---|---|
| 1 | **Signal Tee** | Bella+Canvas 3001, navy and white (Printful) | Three stacked rounded "verdict pills" (GO green, CAUTION gold, NO-GO red), left-chest 3.5 in. Back: boat-mark plus `shouldiboat.com`. | "Check the call." |
| 2 | **Lake Erie Tee** | Bella+Canvas 3001, heather/teal (Printful) | Line-art Lake Erie outline with Western/Central/Eastern basins hinted by contour lines, plus the boat-mark wake. One color, teal on light. | "Lake Erie. Shallow lake, deep opinions." |
| 3 | **Dad Hat** | Yupoong 6245CM, navy/khaki (Printful, embroidered) | Boat-mark embroidered front, white thread. Side: small "GO / CAUTION / NO-GO" in three thread colors. Needs a simplified embroidery-safe mark (thin wave lines will fill in). | none on front |
| 4 | **Sticker 3-Pack** | 3×3 kiss-cut (Printful) | Three stickers: (a) boat-mark on navy circle, (b) "NO-GO DAY" pill, (c) "should i boat?" wordmark. Must be legible from 3 ft on a cooler or tackle box. | "NO-GO DAY" is a joke, not advice |
| 5 | **UPF Sun Shirt** | Sport-Tek Posi-UV Pro LS (Printify; confirm UPF rating on the spec sheet) | Light colors only (white/pearl) for heat. Small chest mark; back yoke with the three verdict pills, horizontal. The shirt's own UPF rating describes the fabric; copy must not exaggerate it. | "Check the call." on back yoke |
| 6 | **Dock / Garden Flag** | Printful outdoor flag w/ rod pocket, or garden flag | Navy field, large boat-mark, "should i boat?" Do **not** design it as a GO/NO-GO status flag someone could fly to signal conditions. Brand flag only. | "should i boat?" |
| 7 | **Off-Season Hoodie** (gift) | Mid-weight pullover (Printful; blank TBD) | Front: "OFF-SEASON" in Inter caps. Sleeve: "NO-GO until May". Dry, self-aware. | "NO-GO until May." |
| 8 | **Koozie** (conditional) | POD source not yet found | Navy, boat-mark plus "Waiting out the wind." Must not reference drinking while operating a boat (legal review). | "Waiting out the wind." |

**Dry-humor bank** (for drops; all are jokes about conditions, none make promises):
- "The lake said no."
- "CAUTION: Captain is optimistic."
- "4-footers. I'll be on the porch."
- "My boat's GO. My spouse's call is NO-GO."

**Banned:** "Always safe to go", "Certified safe", "Safe boating guaranteed", anything implying official forecast authority.

---

## 4. Unit economics (per single-item order)

**How margin is calculated:**
- The customer pays shipping at cost (pass-through), and sales tax is excluded (pass-through).
- Payment fee = 2.9% × (retail + shipping) + $0.30 [3P].
- Margin = retail − base − payment fee.
- This models the Phase 3 own-Stripe path. A hosted Printful store's fee structure differs and is unverified.

| SKU | Retail | Base | Ship (to customer) | Pay fee = 2.9%×(R+S)+0.30 | **Margin $** | **Margin %** |
|---|---|---|---|---|---|---|
| Signal / Lake Erie Tee | $28.00 [EST price] | $12.95 [3P] | $4.75 [3P] | 0.029×32.75+0.30 = **$1.25** | 28−12.95−1.25 = **$13.80** | 49% |
| Dad Hat | $30.00 | $14.02 [V] | $4.69 [V "from"] | 0.029×34.69+0.30 = **$1.31** | 30−14.02−1.31 = **$14.67** | 49% |
| UPF Sun Shirt | $42.00 | $20.21 [V "from"] | $5.00 [EST] | 0.029×47.00+0.30 = **$1.66** | 42−20.21−1.66 = **$20.13** | 48% |
| Sticker 3-Pack | $10.00 | 3×$1.95 = $5.85 [3P] | $4.29 [3P] | 0.029×14.29+0.30 = **$0.71** | 10−5.85−0.71 = **$3.44** | 34% |
| Garden Flag | $24.00 | $8.67 [V] | $4.69 [EST, using Printful's "from" rate] | 0.029×28.69+0.30 = **$1.13** | 24−8.67−1.13 = **$14.20** | 59% |
| Outdoor Dock Flag | $34.00 | $12.16 [V] | $4.69 [EST] | 0.029×38.69+0.30 = **$1.42** | 34−12.16−1.42 = **$20.42** | 60% |
| Off-Season Hoodie | $48.00 | $24.00 [EST] | $8.00 [EST] | 0.029×56.00+0.30 = **$1.92** | 48−24−1.92 = **$22.08** | 46% |
| Koozie | $12.00 | $6.00 [EST] | $4.50 [EST] | 0.029×16.50+0.30 = **$0.78** | 12−6−0.78 = **$5.22** | 44% |

**Notes:**
- **Stickers lose money as a standalone order** once shipping is shown ($14.29 for $10 of stickers kills conversion). Sell them as an **add-on or bundle**, and use them as **marina giveaways** (a marketing cost, not revenue).
- **Holiday surcharge:** add $0.40 per US order through Jan 17, 2027 [V]. Absorb it, or fold it into flat shipping.
- **One-time costs:** sample orders (budget about $150 for 8 SKUs at base plus shipping [EST]), embroidery digitization (amount unverified), and vector logo work.
- **Printful paid tiers** would cut tee base about $3.90 (to ~$9.05 [3P]). This is not worth a subscription until about 50+ orders/mo [EST].
- **Shopify break-even:** $39/mo ÷ ~$14 margin = **about 3 orders every month just to cover the plan**, including off-season months.

---

## 5. Site integration options

| Level | What | Effort | Pros | Cons | Agents |
|---|---|---|---|---|---|
| **A. Link-out** (Phase 1) | "Shop" link in footer/account plus a small labeled merch card near the gear block, pointing to the hosted Printful store | **S**, hours | Zero backend; vendor handles checkout, tax (Quick Stores [V]) and support; reversible | Off-site brand experience; no first-party order data; vendor's store fees and limits unverified | frontend-engineer, ux-designer |
| **B. Embedded catalog** | Static product cards on a `/shop` page, each deep-linking to the vendor product | **S–M** | Feels native; good for SEO ("Lake Erie boating gifts") | Manual sync of prices and images; still off-site checkout | frontend-engineer, seo-content-strategist |
| **C. Shopify subdomain** | `shop.shouldiboat.com` on Shopify plus the Printful app | **M** | Full cart, reviews, discount codes | $39/mo; second admin and brand; separate customer accounts | devops-sre (DNS), frontend-engineer |
| **D. On-site shop, own Stripe** (Phase 3) | React `/shop` with cart → Worker `POST /api/merch/checkout` (Stripe Checkout `mode=payment`, shipping address, Stripe Tax) → webhook → Printful API order | **L**, est. 1–2 sprints | Own the customer and data; one checkout; bundles with ad-free | **We become seller of record:** sales tax registration, returns, chargebacks, order-failure handling, API secret in Worker | backend-engineer, frontend-engineer, **security-engineer (required, CLAUDE.md rule 2)**, legal-compliance, qa-engineer |

**Required before Level D (found in `functions/auth.js`, `/stripe/webhook`, ~line 1264).**

**What the code does today:** every `checkout.session.completed` event calls `setAdFree(email, true, { stripeSubId: obj.subscription || null, … })`.

**What would break if merch reused the same Stripe account and webhook:**
- A logged-in user's merch purchase would **grant ad-free for free**.
- It would also **overwrite an existing subscriber's `stripeSubId` with null**, which breaks their cancel/resume flow.

**Fix before launch:** route on `session.mode` and/or `metadata.kind`. This is a backend-engineer task with security-engineer review. No code was changed in this plan.

**Placement rule:** a merch card must never displace or pose as a verdict, and must be visually distinct from sponsor takeovers and the affiliate gear block. Merch is our own product, so label it "Our merch" and not "Sponsored".

---

## 6. Co-branded and sponsor merch (with sales-sponsorships)

| Offer | Mechanics | Pricing idea [EST] | Guardrails |
|---|---|---|---|
| **Marina co-brand hat/tee** | Marina logo plus small boat-mark on sleeve or back. Marina buys at wholesale (base + $6–8) and resells in its ship store. **Their inventory, not ours.** | Hat ~$22/unit wholesale, 12-unit minimum | Written logo permission; marina's mark used only on their run |
| **Charter crew shirts** | UPF sun shirt with charter logo front and small "should i boat?" on the sleeve | ~$32/unit | No implication that we vouch for the charter's safety |
| **Sponsorship bundle add-on** | Season takeover (`/advertise`) includes 24 co-branded hats or 200 stickers | Price into the season package; COGS ~$340 hats / ~$390 stickers at base | Merch never changes sponsor placement rules or verdicts (rule 3) |
| **Sticker drops at ramps and tackle shops** | Free boat-mark stickers with a QR code to the launch page | Marketing cost, ~$2 each [3P base] | QR goes to our page, not to a sponsor |

Note: bulk co-brand runs may be cheaper through a local screen printer than through POD. Get one quote before pricing these [EST].

---

## 7. Legal / ops checklist (for legal-compliance)

| # | Item | Question for legal | Owner |
|---|---|---|---|
| 1 | **Sales tax** | Phase 1 (Printful Quick Stores) says Printful is seller of record [V]; confirm. Phase 3 (own Stripe): which states require registration, and should we enable Stripe Tax? | legal-compliance, owner |
| 2 | **Returns policy** | Draft a policy matching vendor terms: defects/misprints within 30 days of delivery get a reprint or refund; no size or change-of-mind returns [V]. Is that acceptable to state, and how do we handle state consumer-law edge cases? | legal-compliance, customer-support |
| 3 | **Trademark "Should I Boat"** | Clearance search, then a USPTO filing in Class 25 (apparel) and possibly Class 9/42 (app/software). Base fee **$350 per class**, plus surcharges of $100–$200/class for free-form IDs or long descriptions [3P, law-firm summaries of the Jan 2025 fee rule]. | legal-compliance, owner |
| 4 | **IP hygiene** | Confirm the boat-mark is original or owned (who drew it?). Inter font license (OFL) covers print use. No NOAA/NWS/USCG marks. Lake outline from public-domain geography. | legal-compliance |
| 5 | **Terms page** | Add a "Merchandise" section to `public/legal.html`: seller of record, shipping, returns, and a statement that merch carries no safety claim. Privacy: shipping-address handling (vendor as processor). | legal-compliance, frontend-engineer |
| 6 | **Product claims** | UPF wording must match the manufacturer's spec sheet. Koozie copy must not encourage drinking while operating a boat. | legal-compliance |
| 7 | **Customer support** | FAQ: order status, defects, sizing; who answers (vendor vs. us) | customer-support |

---

## 8. KPIs and go/no-go test

**Pre-launch interest (Jan–Mar 2027), measured with consent-gated GA4 events. New events are needed: `merch_card_view`, `merch_click`, `merch_notify_signup`.**

| Signal | Go threshold [EST targets, not benchmarks] |
|---|---|
| Gift mini-drop orders (if run) | ≥ 15 orders by Dec 31 |
| "Notify me" signups for spring merch | ≥ 150 |
| Click-through on the merch card | ≥ 1% of card views |
| Marina/charter co-brand interest | ≥ 2 verbal yeses |

**Go/no-go for spring launch (decide Feb 15, 2027):** **GO** if any 2 of the 4 signals above are met. **NO-GO** means keep only the sticker giveaways and revisit in fall.

**First 90 days after Apr 15 launch (through mid-July):**

| KPI | Target [EST] |
|---|---|
| Orders | ≥ 75 total |
| Shop conversion (store visits → order) | ≥ 1.5% |
| Average order value | ≥ $35 |
| Blended gross margin (after base, shipping, fees) | ≥ 40% |
| Defect/reprint rate | < 5% of orders |
| Co-brand deals signed | ≥ 2 |
| Ad-free subs and affiliate clicks | No decline vs. the same weeks pre-launch (cannibalization check, revenue-analyst) |

**Trigger to build the Phase 3 on-site shop:** ≥ 50 orders/month for 2 consecutive in-season months **and** margin ≥ 40%.

---

## 9. Phased timeline and owner questions

| When | Phase | Milestones |
|---|---|---|
| **Nov 6–14, 2026** | 0. Decide | Owner answers the questions below; commissions vector logo; legal-compliance starts checklist §7 |
| **Nov 14–24** | 0. Prep | Art for SKUs 1, 3, 4, 7; order samples (2–5 business days production [V] plus transit); terms update drafted |
| **Dec 1** *(optional)* | 1a. Gift mini-drop | Link-out store live with 4 SKUs; email existing users (growth-marketer drafts, owner sends). Holiday order-by date set conservatively [EST ~Dec 10]. |
| **Jan–Feb 2027** | 1b. Learn | Review mini-drop; add "Notify me" for spring; trademark filing; **Feb 15 go/no-go** |
| **Mar 2027** | 1c. Spring prep | UPF shirt and flag samples tested in real sun, wind and spray; marina co-brand pitch (sales-sponsorships) |
| **Apr 15, 2027** | 2. Spring soft launch | Full core line; Level A/B integration; launch email and social |
| **May–Jul 2027** | 2. Season | Track KPIs; 2 marina pilots; 90-day review in mid-July |
| **Aug–Sep 2027** | 3. Decide deeper integration | If the trigger is met: spec Level D (product-manager → backend/frontend → security review) |
| **Nov 2027** | 4. Gift season 2 | Hoodie, bundles, possibly an "ad-free year + hat" gift bundle |

**Open questions for the owner:**
1. Is a Dec 1 gift mini-drop worth the rush, or should we wait for spring?
2. Who created the boat-mark, and is a vector master available? Is there budget for a designer (art for 8 SKUs)?
3. Do you approve about $150 [EST] for samples, plus the trademark filing ($350+ per class [3P]) and any attorney fees?
4. Hosted Printful store first (recommended), or go straight to Shopify?
5. Should merch be offered as a perk in sponsorship packages from 2027?
6. Bundle merch with the ad-free plan (for example, an annual plan plus a hat), or keep them separate?
7. Is the market Lake Erie only at first, or also coastal regions (FL/Gulf/SoCal designs)?
8. Who handles merch support email: you, or customer-support drafts with you sending?

---

### Sources (all checked 2026-11-06 via web search; vendor pages could not be opened directly)
- Printify Premium price change: https://help.printify.com/hc/en-us/articles/42641734110225 [V]; https://printify.com/blog/new-printify-premium/ [V]; https://www.ecommerceceo.com/printify-pricing/ [3P]
- Printful Bella+Canvas 3001 base: https://podvector.ai/articles/printful/costs-and-charges/printful-bella-canvas-3001-price-base-cost-full-breakdown-for-pod-sellers [3P]; https://www.builtbyfoundry.io/blog/is-creator-merch-worth-it-2026-7-costs-30-dollar-tee [3P]
- Printify 3001 base: https://podvector.ai/articles/printify/costs-and-charges/printify-bella-canvas-3001-cost-full-breakdown-for-pod-sellers [3P]
- Printful dad hat: https://www.printful.com/custom/embroidered/hats/yupoong-6245cm-unstructured-classic-dad-cap [V]
- Printful stickers: https://podvector.ai/articles/printful/costs-and-charges/printful-sticker-pricing-full-breakdown-for-pod-sellers [3P]; https://podvector.ai/articles/print-on-demand/costs-and-suppliers/printful-sticker-cost-vs-printify [3P]
- Printful flags: https://www.printful.com/custom-flags [V]; https://www.printful.com/custom/product/490 [V]
- Printful shipping and US surcharge: https://www.printful.com/shipping [V]; https://ecommerceceo.com/printful-pricing/ [3P]
- UPF shirts: https://printify.com/app/products/1605/generic-brand/men-s-uv-protection-long-sleeve-shirt-aop [V]; https://printify.com/app/products/2865/sport-tek/women-s-posi-uv-pro-long-sleeve [V]; https://www.printful.com/custom/product/919 [V]
- Production times: https://support.printful.com/hc/en-us/articles/41396645431441-What-are-Printful-s-production-times-like [V]; https://help.printify.com/hc/en-us/articles/4483629751825-What-are-Printify-s-production-times-like [V]
- Returns: https://help.printful.com/hc/en-us/articles/360014006840-What-is-Printful-s-return-and-refund-policy [V]; https://support.printful.com/hc/en-us/articles/41396595299729 [V]
- Sales tax: https://help.printful.com/hc/en-us/articles/15045922586780-Why-is-the-sales-tax-collected-on-my-Quick-Stores-orders-and-who-pays-it [V]; https://help.printify.com/hc/en-us/articles/4483601209489-Does-Printify-charge-sales-tax- [V]
- Shopify plans: https://www.websitebuilderexpert.com/ecommerce-website-builders/shopify-pricing/ [3P]; https://craftshift.com/shopify-basic-plan-2026/ [3P]
- Stripe fees and Stripe Tax: https://www.nerdwallet.com/business/software/learn/stripe-fees [3P]; https://dodopayments.com/blogs/stripe-fees-calculator [3P]
- USPTO fees: https://www.reedsmith.com/en/perspectives/2025/01/uspto-announces-trademark-fee-increases-effective [3P]; https://www.bsk.com/news-events-videos/fee-changes-for-trademark-matters [3P]
