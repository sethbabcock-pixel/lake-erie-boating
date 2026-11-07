# shouldiboat.com UX review and user feasibility study (2026-11-06)

Reviewer: ux-designer. Review only; no code was edited.

Method and limits
- Live site https://shouldiboat.com, Playwright/Chromium, 390x844 and 1440x900, light and dark (theme forced via `localStorage.theme`), plus a 360px pass that measured tap targets, heading order and font sizes. Screenshots are in `docs/design/review-2026-11/`.
- Live site captured at review time (Sandusky was NO-GO with a Small Craft Advisory; no GO or CAUTION example was live, so those states were judged from CSS). The live spot hero is the older photo band; the working tree already has the new `.hero-band`. Header and hero are being redesigned elsewhere, so they are commented on only.
- The sandbox blocks some third parties: the weather map and cam player render blank/black in screenshots. That is the environment, not a verified bug. Ad units never filled, so no ad was seen in situ. Ad findings come from code.
- "Time-to-answer" figures are heuristic walkthrough estimates, not measured with users. Treat the confidence column accordingly.
- Rules respected: nothing here asks the app to call GO on missing or stale data. Items that touch verdict presentation are marked for marine-data-scientist review.

---

## 1. Executive summary

Verdict: the product is useful and the core answer is fast. A repeat user with a saved port gets a trusted answer in about 3 seconds. The weaknesses are not features, they are craft and consistency. The app reads as "vibe coded" for specific, fixable reasons: emoji used as icons next to a custom SVG set, a pile of near-identical tinted cards, uppercase 10-11px micro-labels everywhere, glassy gradients and soft shadows on every surface, a stock photo hero with centred-nothing, and numbers that disagree with each other. The biggest real risks are trust (conflicting numbers, buried freshness) and accessibility (verdict colour contrast, colour-only status, tiny tap targets).

Top 10 issues, ranked by user impact x effort (best return first)

| # | Issue | Impact | Effort | Evidence |
|---|---|---|---|---|
| 1 | The same spot shows three different wind numbers: stat tile 18 kt, sticky bar 16 kt, reasons "~19 kt". A boater who sees this stops trusting the verdict. Needs one source per number and a label ("sustained", "gust", "forecast"). | Very high | S-M | `03-spot-fold-d-light.png`, `04-spot-scroll1-d-dark.png`, `04-spot-scroll1-m-light.png` |
| 2 | Data freshness lives only in the page footer (`App.jsx:1327-1328`, "Updated 1:49:51 PM"). The verdict card says nothing about age or whether waves are live or forecast, except as the last bullet. No stale or offline state exists (no service worker, error state only shows a retry). | Very high | S | `04-spot-full-m-light.png` |
| 3 | Light-theme verdict contrast fails. GO text `#1B936A` is 3.9:1 on white and about 3.0:1 on its own badge tint; CAUTION `#A9831C` is 3.5:1 and 2.8:1; small status chips and "go/caution" tallies at 10-14px need 4.5:1 and miss. This is the hero element. | Very high | S | `styles.css` `:root` tokens, `.call`, `.opill`, `.loc-status` |
| 4 | The verdict word has no icon in the card (`App.jsx:1179`, `.call-badge`). Rule is icon + word + colour. The hour-by-hour verdict row, "Today at a glance" band and region tally bars are colour only. | High | S-M | `04-spot-scroll2-m-light.png`, `04-spot-scroll1-m-light.png` |
| 5 | Default theme is forced dark (`index.html:33`, `App.jsx:164`), ignoring `prefers-color-scheme` until the user finds the toggle. Dark UI on a dock in bright sun is the worst case. Guides, about, advertise and legal have no dark mode at all. | High | S | `01-landing-first-visit-*-light.png` (light OS, still dark) |
| 6 | 49 interactive elements under 44px on the spot page at 360px. The 24 "glance" hour bars are 14x32 each; map tabs, cam links, footer links, "Wrong call?" are 15-37px high. Landing region chips are 36px, `.cbtn` is 35px. | High | M | audit output, section 4 |
| 7 | The spot page is about 7,200px tall on a phone (about 8.5 screens) with a fixed order that ignores intent: map and cams come before nearby launches and gear. A sticky header (about 120px) plus a sticky verdict strip eats about 20% of the viewport. | High | M | `04-spot-scroll*-m-light.png`, `11-360w-spot.png` |
| 8 | Looks templated. Emoji icons (📍 🌊 ⭐ 🦺 📻 ⚓ 🧰) mixed with a custom SVG set; every card the same radius/tint/uppercase eyebrow; stock-photo hero; gradients plus shadow on the call card. Details in section 5. | Medium-high | M | `01-*`, `02-landing-full-m-light.png`, `04-spot-scroll4-m-light.png` |
| 9 | Ads and affiliate subordination is under-built. `.adlabel` is 10px `--text-faint` (3.1:1 on white); `.hero-adlabel` is 9.5px; the gear block says "Top rated" (it is just Amazon's review sort) and sells bilge pumps and anchors directly under a NO-GO verdict; sponsor colours are admin-free-form with no contrast check. | Medium-high | S-M | `Takeover.jsx:60`, `monetize.jsx` GEAR, `styles.css:343,550` |
| 10 | "No data" is presented as CAUTION in the same amber as a real wind caution (`conditions.js:1347`). Correct from a safety standpoint, but the user cannot tell "conditions are marginal" from "we cannot see conditions". Needs a distinct treatment (verdict logic unchanged; marine-data-scientist to confirm). | Medium-high | M | code |

What is working (keep it)
- The verdict is above the fold on a phone and the desktop spot page; "Not recommended. Stay in." is plain language, not safety-promising.
- Signup is a soft nudge, not a wall. Signed-out users get the full verdict, forecast and cams. Gate cost is low (section 3).
- Reasons list is concrete ("Short-period chop: 4 ft at 3s feels rougher than the number") and honest about forecast-only waves.
- "Wrong call? Tell us what you saw" is a strong trust device.
- Reduced motion is handled globally in `tokens.css:68-70`.

---

## 2. Per-screen findings

### 2.1 Landing (`src/Landing.jsx`, `02-landing-full-*`, `01-landing-first-visit-*`, `05-landing-search-typed-m-light.png`)

Now
- The first screen asks a question and gives a search box. For a returning user the fastest path (home port chip with live verdict, `Landing.jsx` `.splash-home`) only appears after a favourite or last-visited spot is stored. First-time and signed-out-on-new-device users must search, pick near-me (permission prompt), or scroll to a directory. On a cold visit nothing on the first screen shows any verdict. The product promise is a GO/CAUTION/NO-GO, but the fold shows zero. Add a "Right now" strip with 3-5 nearest or most-popular launches with real verdict chips (only from live data; if absent show "No data", never a default).
- The cookie banner covers the free-account card at 390px and, on desktop, floats mid-screen over the region chips (`01-landing-first-visit-d-dark.png`). It is `role="dialog"` without focus handling and is not modal. Accept is primary, Reject is a ghost button: fine functionally, but ask legal-compliance whether EEA/UK equal prominence applies.
- Search copy and affordances: placeholder is truncated at 390px ("Search a lake, town, marina"). Search is a 52px control, good. "Near me" uses an emoji pin (`Landing.jsx` splash-near). "Browse all covered locations" is 22px tall.
- Typing "sand" shows the match, a "Find the closest launches to..." action and "Request a location". Good logic, but three stacked calls to action in one panel plus the home chip inserted between "Near me" and the panel creates visual noise (`05-landing-search-typed-m-light.png`).
- The free-account card ("Every verdict, forecast and cam here is free.") sits above the directory and below the hero on the first scroll. It is the first thing after the search. On a dock it delays the directory and is a conversion ask before value. Move below the "Right now" strip or the directory.
- Directory: 14 collapsed `<details>` regions with tally text and a thin colour bar (`.region-bar`, colour only). Tally text in 10-12px. Good compact summary, but the bar is aria-hidden and colour only (fine because tally text duplicates it).
- Page is about 5,900px on mobile; the "Boating near a city" and "Learn the water" blocks are SEO sections that read as such.
- Desktop hero is a 480px photo with content hugging the left and about 60% empty (`01-landing-first-visit-d-dark.png`). It is the clearest "template" signal on the site.

### 2.2 Spot / verdict page (`src/App.jsx`, `03-*`, `04-*`)

The call card
- Mobile: badge 28px (`styles.css` `.call-badge span` under 560px). The rule is "legible at arm's length"; 28px bold is borderline. Use at least 40px on phones; the badge row has room.
- Badge has no icon; the "not right now" pill beside it has a prohibition icon, which is the only non-colour cue, and it is smaller than the word. Put one shape per verdict inside the badge (check / triangle / octagon-stop). Not red/green only (colour-blind and sun glare).
- Verdict word is a `<span>`, not a heading or live region. Screen readers read "NO-GO" as stray text before the spot name. Give the card `role="region"`/aria-labelledby and make the verdict the first text with the spot name as context.
- Order inside the card: verdict, spot name, pill, sun times, share, summary, reasons, wrong-call link. Four meta items (pill, sun times, share, spot name) sit between the verdict and the summary. The one-line summary should immediately follow the verdict; the rest can go below the reasons.
- Reasons: the most decision-relevant caveat ("Waves are from the NWS forecast; no live wave reading") is last, at the same weight as everything else. Mark data-quality reasons with a distinct "Data" label or icon and put them at the top when they limit confidence.
- Light-theme card: pink wash with red type. Contrast numbers in section 4.

Header and hero (comment only; owned elsewhere)
- On 390px the live header is two rows (logo, then picker + theme + Sign up) at about 120px, plus a sticky verdict strip of about 40px that appears after scroll. Total sticky chrome is about 160px of 844. This is the biggest mobile space cost. Recommend a single 56px row and merge the sticky verdict strip into it.
- The old spot photo hero repeated the question, the verdict, and a signup link before the real verdict card. The new `.hero-band` direction (title band, no second verdict badge) is correct. Make sure the band stays under about 90px on phones.
- Sticky verdict strip shows "16 kt W - 4 ft @ 3s" which disagrees with the tile (issue 1).

Stats row
- Tiles are clear and well sized (wind, waves, water, air). The first tile is highlighted with a cyan gradient for no reason (it implies "selected" but nothing is selectable).
- Units and labels at 10-11px (`WIND`, `kt`, `buoy`, `NWS`) are small. "@ 3s between waves - steep chop" is the most important sentence in the tile and is the smallest.

Glance, hour-by-hour, week ahead
- "Today at a glance": 24 bars, each 14x32px and tappable, colour only. Fails 1.4.1 and the target size rules. Add a verdict initial or icon under every 3rd bar, and make the tap area at least 24px wide on desktop and give the band a larger gesture (drag to scrub).
- Hour-by-hour table: the "Verdict" row is a colour pill with no text. Waves row prints the value only on change (4, 6, 6) with merged shading, which reads as missing data. Print every cell or use a clear "same as left" mark.
- Table is a horizontally scrolled grid on phones with a sticky label column; works but there is no scroll hint other than caption text.
- Week ahead cards show "NO" in a pill; elsewhere it is "NO-GO". Pick one.

Map, cams
- Weather map is above cams and loads an iframe on the first scroll; on a poor LTE link that is a big, mostly empty card (`04-spot-scroll3-m-light.png` shows the grey block). Add a static poster, lazy-load on tap, or move below cams.
- Cam block: player black until tapped ("Some players need a tap to start"), four secondary links as 32px chips. The cam is the second most trusted artefact after the verdict (people look at the water); make it the next card after the stats and make the cam age visible.
- `Open this cam` links open external sites: label as external (an icon is present; add "opens in new tab" text for AT).

Nearby launches
- "Nearby on Lake Erie" chips have inconsistent widths, wrap mid-name ("Toledo / Maumee Bay" on two lines) and put mono-spaced stats in a different weight. This is the "calmer launch? tap to switch" feature, which is the single most useful action on a NO-GO day, and it is buried at card 8. Move it directly under the verdict when the verdict is not GO, formatted as a list with a verdict chip per row (same `.loc-status` component as the landing page), sorted by distance.

Footer and gear
- Gear block sits above the footer even on NO-GO. See issue 9.
- Freshness and source are in the footer (issue 2).
- Footer links are 15-19px tall.

### 2.3 Location picker (`06-locpicker-m-light.png`)
- Opens as a full-height dropdown over the verdict; lists names only, no verdict or distance, no "near me". Users choosing a better launch on a NO-GO day cannot see which one is better without opening each. Add a verdict chip and distance per row (same data as `summary`).
- Item rows are about 40px; list height `min(420px, 60vh)`. Raise to 48px rows.
- The search field has no visible label and the picker has no "no results" guidance beyond a build-a-page footer.

### 2.4 Signup / sign-in (`src/auth.jsx`, `07-signup-gate-*.png`)
- Cost is low: the nudge card (`App.jsx:836-856`) and hero link are optional. The modal itself is clean and the Google button comes first.
- Inputs use placeholders as labels (`auth.jsx:193,216,219,223`); once typed, the label disappears. Add visible labels, a show-password toggle, and show the password rule before the user fails it ("letter, number and a special character" is stricter than most users expect).
- Confirm-password plus a special-character rule is a heavy form for "get an email at 6am". Offer email magic link or code as the default for a benefit this small. Owner: backend-engineer + security-engineer.
- Close button is a "x" glyph at about 24px; make it 44px.
- Nudge copy uses an emoji star mid-sentence.
- "Sign in to build this page" for preview spots (`App.jsx:1169-1170`) is a real gate: someone searching a new town gets a live preview, then must register to keep it. Acceptable, but say why ("so we can save it to your ports").

### 2.5 Account and Pro (`src/AccountPage.jsx`, `src/Pro.jsx`, `08-account-signedout-*.png`)
- Signed out, `/account` is a pricing table with a "Back to conditions" link and a mismatched header (different logo lockup from the app header: no sun/moon toggle, no picker).
- Plans: Free vs Pro with clear lists. Good. Pro copy is honest ("Local sponsor banners, always labeled, may still appear"). Keep that.
- "GO alerts" as a paid feature is fine only because NO-GO alerts stay free. Keep safety information free as the comment in `Pro.jsx` says.
- Pro CTA text is generated from live Stripe prices; "Pro is coming soon" appears when plans fail to load, which on spotty LTE looks like the product is dead. Retry state needed.
- The upsell link in the signed-in hero ("Go Pro: no Google ads + GO alerts") is a house ad in the most valuable pixel on the page for free signed-in users. Move to account menu and the ad slot area.

### 2.6 Consent banner, ads, sponsor takeover (`src/monetize.jsx`, `src/Takeover.jsx`)
- Banner: see 2.1. On a phone it is a 3-4 line card covering about 25% of the screen on the first view, over the free-account card.
- `AdSlot` collapses when unfilled and only labels "Advertisement" once filled; good practice. Label is 10px at `--text-faint` (fails contrast).
- Sticky footer ad has a 22px close button (`styles.css` `.sticky-ad-close`); Better Ads and WCAG target size both want larger. It also stacks with the consent banner and the iOS home bar.
- Sponsor takeover: skin is a full-page link behind content (`SponsorSkin`, `aria-label="<sponsor> sponsor"`). On touch, mis-taps near the page edges can open a sponsor, which is the exact accidental-click pattern the demo code avoids. Keep it desktop-only (min-width 1440px) and non-clickable on phones.
- Hero sponsor: "Ad" label is absolute, 9.5px, top-right (`styles.css:550`). Should say "Sponsored" in 12px minimum and sit inline with the eyebrow. Sponsor `bg/fg/accent` are free-form hex; add an admin-side contrast guard (4.5:1) and force a neutral frame so a sponsor cannot imitate verdict colours (red/green/amber backgrounds should be rejected).
- Never place a sponsor or ad directly above the verdict card on a phone. Current order on spot pages keeps verdict first: keep that as a documented invariant.
- Affiliate block: "Top rated" tags on category searches and a rough-day set (bilge pump, anchor) under a NO-GO may read as "buy this and you will be fine". Copy-never-promises-safety; ask legal-compliance. Replace the emoji icons with the SVG set, call the tag "Sponsored link" or "Amazon search", and drop the block above the fold-of-the-footer on NO-GO or show it collapsed.

### 2.7 Guides (`public/guides/*`, `09-guides-index-*`, `10-guide-article-*`)
- Readable, well typeset, good lede. Always light; ignores the app's theme, `prefers-color-scheme`, and the user's stored choice (no theme rule in `guides.css`). Standalone shell: no logo, no link to "check today's conditions", no picker. A new boater who reads "What GO, CAUTION and NO-GO mean" has no one-tap path to the live verdict for their spot.
- Breadcrumb duplicates the back link; breadcrumb font 13px at `--faint` (contrast about 3:1).
- Pills in the GO/CAUTION/NO-GO legend are tinted with coloured text at 13px (fails 4.5:1) and, again, colour only except for the word, which is present (OK).
- Guide ad script (`guide-ad.js`) loads AdSense on safety articles; check that the label and spacing match the app's `.adwrap` and that no ad sits between a safety instruction and its heading.

---

## 3. Feasibility study: can each persona get a trustworthy answer in under about 10 seconds?

Assumptions: LTE with 1-2 bars (about 1.5-3 s to first contents), glove or wet hands on a phone in sun.

| Persona | Task | Time-to-answer (est.) | Blockers | Confidence |
|---|---|---|---|---|
| Weekend recreational boater, at home, return visit | Check home port before leaving | 3-4 s (home chip on landing, one tap, verdict above fold) | Cookie banner on first-ever visit; wind numbers disagree; no "as of" next to the verdict | High in the answer, medium in trust |
| Same, new visit / new device | Find their marina | 10-25 s (search or near me; permission prompt; pick from list) | No verdict on landing fold; picker has no verdict chips; sign-up card in the way | Medium |
| Kayak / paddleboard user | Is it calm enough for me? | 15+ s, often a fail | Verdict is tuned for boats ("Small boats take care"); no per-craft threshold; wind direction/offshore wind (the real paddler killer) is in a lower card, "Wind read"; cold water is a number, not a warning; comfort limits only for signed-in users | Low-medium |
| Charter captain / angler, 5 am, phone | Is it fishable, when does it turn? | 6-10 s to verdict; 30+ s to the "window" | Dark default is fine at 5 am; the glance band is colour only and tiny; hour-by-hour needs horizontal scroll; no sunrise/"first light" next to the verdict; tapping 14px bars with wet fingers fails | Medium |
| New boater, unsure what the numbers mean | Understand "Waves 4 ft at 3 s, wind 18 kt" | 20-60 s, often abandons or trusts blindly | "New to the numbers?" links are 15px grey text under the tiles and open new pages; no inline glossary; "steep chop" is the only plain-language cue; guides do not return to the app | Low (but the reasons list helps) |
| Any user, bad LTE / offline | Get any answer | Unknown | No service worker, no cached last verdict, error state is a retry text. Map and cam iframes hurt the load. Nothing says how old the shown data is | Low |

Cost of friction
- Signup gate: soft nudge only. Task-completion cost for answering the question is about 0 s; the cost is attention (a full card plus a hero link plus a banner line). Preview-spot "sign in to build" is a real gate for the newcomer-in-a-new-town case. Recommendation: keep soft; test the card lower on the page.
- Cookie banner: 1 extra tap on the first visit (about 2-4 s) and it hides lower content until dismissed.
- Ads: collapsed when unfilled, so on most loads there is no visible cost; when filled, the mid-page ads add scroll distance to the cams and nearby launches. Sticky footer ad plus consent banner plus sticky verdict strip plus header can leave under 50% of a 740px viewport for content.
- Sponsor takeover/hero: on landing it replaces the house hero. Verify the search box stays above the fold with a sponsor hero (the sponsor hero has its own `splash-slot`); a failed layout here costs the primary task.

---

## 4. Accessibility (WCAG 2.2 AA)

Contrast (computed from tokens)

| Pair | Ratio | Needed | Status |
|---|---|---|---|
| Light GO `#1B936A` on white / on call-badge tint | 3.9 / about 3.0 | 3 (large) / 4.5 (small) | Large text passes only on white; chips and tallies fail |
| Light CAUTION `#A9831C` on white / on tint | 3.5 / about 2.8 | same | Fails on tint, fails small |
| Light NO-GO `#C0392B` on white / on tint | 5.4 / about 3.9 | | OK large, fails small on tint |
| `--gold` `#D4AF37` as text on white | 2.1 | 4.5 | Fail (`.opill.warn` uses gold) |
| `--text-faint` `#8595A1` on white | 3.1 | 4.5 | Fail (ad labels, crumbs, buoy captions, 10px tile units) |
| `--accent` `#008BA8` text/links on white / on `--bg` | 4.0 / 3.7 | 4.5 | Fail for body links and active tabs (white on accent is 4.0) |
| Dark NO-GO `#E2664E` on its tint | 3.7 | 3 (large) / 4.5 | Small text fails |
| Dark `--text-faint` `#6B8299` on `#0F2942` | 3.7 | 4.5 | Fail |
| Dark GO/CAUTION | 5.3-8.4 | | Pass |

Fix direction: darken light GO to about `#0E7A55` (check at 4.5 on the tint), CAUTION text to about `#7A5A00`, accent text to `#00708A`, `--text-faint` to about `#657583`. Keep the brand colours for fills and use a separate `--*-text` token for type. Do not invent new one-offs; add `--success-text`, `--warning-text`, `--danger-text`.

Other findings
- 1.4.1 Use of colour: hour-by-hour verdict row, glance band, region tally bar, forecast-day cells, sticky verdict strip (word present, no icon), verdict badge (word, no icon).
- 2.5.8 / 2.5.5 Target size: 49 elements under 44px (21 on landing) at 360px; 24 glance bars are 14px wide (below the 24px minimum). `.cbtn` 35px; region chips 36px; `.signin-btn` 40px; map/cam chips 30-34px; footer links 15-19px; sticky ad close 22px; modal close about 24px.
- 1.4.4 Resize/legibility: text sizes found at 8.75, 10, 10.5, 11px on the spot page. Set a floor of 12px for any informational text and 14px for anything a user needs to decide.
- 1.3.1 / 2.4.6 Headings: single H1, sensible H2s on the spot page. The verdict is not a heading or landmark; the first heading a screen-reader user hears is the hero title, not the verdict. Landing jumps H1 to H3 inside collapsed regions (H2 "All locations" then H3 region names: OK) but "Boating near a city" regions use H3 under H2: fine. Add `aria-live="polite"` on the verdict card region so changes on refresh are announced.
- 2.4.7 Focus visible: global `:focus-visible` (2px accent, offset 2px) is good, but it uses `--accent` `#008BA8` which is under 3:1 against some backgrounds (3.7 vs bg; fine) and against the dark hero photo it can disappear. Add a second white inner ring on photo and sponsor surfaces. `.locpick-search` has `outline: none` and no replacement (`styles.css` `.locpick-search`).
- 2.1.1 / 4.1.2: cookie banner is a `role="dialog"` that is neither modal nor focus-managed. Either make it a non-modal `region` or manage focus. Custom picker should expose `aria-expanded`/`listbox` roles (not verified in code; test with a screen reader).
- 2.3.3 / reduced motion: `tokens.css` kills animation and transition durations globally. Gaps: the hero `<video autoplay loop>` (`Takeover.jsx`) is not paused under reduced motion; JS `scrollIntoView({behavior:"smooth"})` in `Landing.jsx` ignores the preference; `.live::before` pulse and skeleton pulse are covered by the global rule.
- prefers-color-scheme: default is dark regardless of OS (issue 5); `system` is available but not default. Guides/static pages ignore both.
- 3.3.2 Labels: auth inputs rely on placeholders.
- 3.2.6 / consistent help: the "Wrong call?" link is consistent; good.
- Language, zoom: viewport allows zoom (not verified for every page); no horizontal overflow found at 360px (scrollWidth 360).

---

## 5. Visual-design critique ("why it looks vibe coded")

Specific tells and how to fix them. Prioritised by how much they change the impression.

1. Emoji as icons. `📍 Near me`, `🌊 build a live page`, `⭐` mid-sentence, `🦺📻⚓🧰🎒🥶🪣🧊🛟🧴🎣` in the gear block, while the rest of the app uses a custom SVG set (`icons.jsx`, `WxIcon.jsx`). Emoji render differently per OS and read as generated. Replace all with the SVG set, one stroke weight, one size grid.
2. Same card everywhere. Rounded 16px, tinted gradient, shadow, uppercase 11px eyebrow, content. The verdict card, nudge, wind read, glance, map, cams, nearby, gear and about all use it. There is no hierarchy between "the answer" and "reference material". Fix: the call card is the only elevated surface; everything else is a flat section with a hairline and a real H2 (sentence case, 18-20px). Drop the gradient on the call card; use a solid verdict-coloured band with an icon.
3. Micro-type. Uppercase letter-spaced 10-12px labels (`WIND`, `TODAY AT A GLANCE`, `NEARBY ON LAKE ERIE`, `GEAR`) used as the main heading style. Looks like a dashboard template and is hard to read in sun. Use sentence-case 16-18px semibold section titles; keep uppercase only for 2-3 status chips.
4. Stock hero. A drone photo of Perry's Monument, headline on the left, search box, a pale gradient. On desktop it fills 480px with mostly nothing. For a utility used on a dock, replace with a compact search plus a live "Right now" strip. If a photo stays, use a real, local, high-contrast image on a thin band.
5. Palette. Navy plus teal plus mint plus gold is a stock "marine startup" palette; combined with tinted pastel backgrounds (`color-mix` is used 57 times, 7 gradients, 23 shadows) everything is a soft mid-tone. The result is a lot of 12%-tint-on-white with 3:1 text. Use fewer, firmer surfaces: white or deep navy, and solid verdict colours.
6. Typography. Inter everywhere with a mono face for numbers. Inter is the default AI-app font. Not a defect, but the scale is not applied consistently (8.75 to 28px with 14 distinct sizes on one page). Define 6 steps, floor at 12px, set the verdict at 40-56px, and give numbers (tiles, hour grid) a tabular-figures treatment instead of a second font where it is not needed.
7. Copy. Friendly-assistant voice in places ("Boating Sandusky often?", "Don't see your water?", "Every verdict, forecast and cam here is free.") next to hard-edged safety copy. Make the safety surface terse and operational; keep personality for guides and the account area. The paragraph under the free-account card is the type of line that reads generated.
8. Inconsistent status components. Verdict shown as a big word (call card), a pill with icon (`.opill`), a solid chip (`.loc-status`), a sticky strip chip, a "NO" pill (week ahead), a coloured dot (nearby, reasons), and coloured bars. Seven treatments of one concept. Define one `VerdictMark` (icon + word + colour) at three sizes (hero, row, dot-with-icon) and use it everywhere.
9. Header. The brand lockup is a sail-wave line logo plus "SHOULDIBOAT.com" with a superscript ".com", tagline at small size, then two control rows on phones. Being redesigned elsewhere; make sure it fits one row at 360px and the tap area is 44px.
10. Dark mode feels like a skin. The light and dark palettes are not mirrored for contrast (see section 4), and the default is dark. Define a high-contrast "daylight" mode as the default on phones: white surfaces, solid verdict colours, thick text, no tints.
11. Static pages (guides, about, advertise, legal) have their own CSS and look like a different site; the shared header/footer and tokens are not reused.

---

## 6. Prioritised fix list

Owners are agents in `.claude/agents/`. Effort: S under 0.5 day, M 1-3 days, L over 3 days.

### Now (this week)
| # | Fix | Effort | Owner |
|---|---|---|---|
| N1 | Reconcile wind figures across tile, sticky bar and reasons; label each (sustained / gust / forecast) | S-M | frontend-engineer, with marine-data-scientist to confirm which figure feeds the verdict |
| N2 | Add "Updated N min ago / buoy X, live or forecast" line directly under the verdict; show amber "Data is N min old" banner when over a threshold; never change the level in the UI | S | frontend-engineer (copy from ux-designer); marine-data-scientist sets stale thresholds |
| N3 | Add `--success-text/--warning-text/--danger-text/--accent-text`, raise `--text-faint`; apply to chips, tallies, ad labels, links | S | frontend-engineer |
| N4 | Verdict icon inside `.call-badge`, sticky strip, `.loc-status`; icon or letter on hour-by-hour and glance bands | S-M | ux-designer (icon spec) then frontend-engineer |
| N5 | Default theme to `system`; add the toggle's "Auto"; apply guides CSS dark support | S | frontend-engineer |
| N6 | Phone verdict badge to 40px+; verdict as heading with `aria-live` region | S | frontend-engineer |
| N7 | Ad labels to 12px and AA contrast; "Sponsored" inline with eyebrow; sticky ad close to 44px; sponsor skin non-clickable on touch | S | frontend-engineer; security-engineer review not needed (no new scripts) |
| N8 | Replace emoji icons with the SVG set (search, build, gear, star in copy) | S | frontend-engineer |

### Next (within the month)
| # | Fix | Effort | Owner |
|---|---|---|---|
| X1 | Tap targets: min 44px for `.cbtn`, region chips, map/cam chips, footer links, glance bars (bigger scrub area), modal close | M | frontend-engineer |
| X2 | Landing "Right now" strip with live verdict chips (nearest, home port, popular) and verdict+distance in the location picker and search results | M | ux-designer (spec), frontend-engineer |
| X3 | Spot page reorder on non-GO: calmer launches directly under the verdict; cams before map; map lazy on tap with poster; gear collapsed on NO-GO | M | ux-designer, frontend-engineer |
| X4 | Distinct "No data" visual state (new label/icon) while the level logic is unchanged | M | marine-data-scientist (confirm), ux-designer, frontend-engineer |
| X5 | One `VerdictMark` component to replace seven status treatments | M | frontend-engineer |
| X6 | Auth form: visible labels, show-password, passwordless email-link option, clearer rule text | M | frontend-engineer, backend-engineer, security-engineer review |
| X7 | Consent banner: non-modal region, smaller, not over primary content; legal check on equal prominence | S-M | frontend-engineer, legal-compliance |
| X8 | Affiliate block: replace "Top rated" with "Sponsored link/Amazon search"; reconsider the rough-day set under NO-GO | S | legal-compliance, ux-designer |
| X9 | Sponsor admin: contrast guard, disallow verdict-like colours | M | backend-engineer, frontend-engineer |
| X10 | Pause the hero video and disable smooth scroll under reduced motion | S | frontend-engineer |

### Later
| # | Fix | Effort | Owner |
|---|---|---|---|
| L1 | Offline/poor-LTE: service worker caching the last verdict with a visible "saved N min ago" state, lighter first load | L | frontend-engineer, devops-sre |
| L2 | Craft-aware presentation (kayak/SUP, small boat, offshore) with the same verdict logic but persona-specific explanation and wind-direction emphasis; comfort limits for signed-out users via local storage | L | product-manager, marine-data-scientist, ux-designer |
| L3 | Inline glossary for the numbers (tap "4 ft @ 3s" for a plain-language sheet) and guides that link back to the live verdict | M | seo-content-strategist, ux-designer |
| L4 | Shared shell for static pages (header, footer, theme), merged type scale | M-L | frontend-engineer, seo-content-strategist |
| L5 | Visual refresh pass: type scale, firmer surfaces, local photography, spacing rhythm, new hero | L | ux-designer |
| L6 | Usability test with five real users (two kayak/SUP, one charter, two new boaters) to replace the estimated times above | M | product-manager, ux-designer |

---

## 7. Screenshot index (`docs/design/review-2026-11/`)

Naming: `<n>-<name>-<m|d>-<light|dark>.png` where m = 390x844, d = 1440x900.
- `01-landing-first-visit-*` landing with consent banner
- `02-landing-full-*` full landing page (light only; very tall)
- `03-spot-fold-*` spot page first screen
- `04-spot-scroll1..4-*` spot page scrolled in 0.9-viewport steps
- `05-landing-search-typed-*` search typed with panel open
- `06-locpicker-*` header location picker open
- `07-signup-gate-*` Create account modal
- `08-account-signedout-*` account/plans page signed out
- `09-guides-index-*`, `10-guide-article-*`, `10b-guide-scroll-*` guides
- `11-360w-landing.png`, `11-360w-spot.png` 360px width check

A few light and dark captures exist for every item above except where a step failed silently; if a file is missing, the interaction did not complete in headless mode.
