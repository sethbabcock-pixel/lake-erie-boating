# Ads / consent / sponsor / affiliate copy changes (UX review 2026-11: N7, X7, X8, X9)

For legal-compliance review. Every user-visible string or label changed. Code: `src/monetize.jsx`, `src/Takeover.jsx`, `src/admin/SponsorsPage.jsx`, `src/styles.css`.

## Cookie consent banner (X7)
| Before | After |
|---|---|
| "We use cookies for analytics and ads to keep shouldiboat.com free. Accept to allow them, or reject non-essential cookies. Learn more." | "We use cookies for analytics and ads to keep shouldiboat.com free. Accept or reject non-essential cookies. Learn more." (shortened to fit a compact bar; same purposes named, same link to /legal#cookies) |
| Reject = outlined/ghost, muted text; Accept = filled | Reject and Accept are identical: same size (44px tall, equal width on phones), weight (700), fill and contrast |
| `role="dialog"`, floating card | `role="region"` (non-modal) full-width bottom bar; page stays scrollable, body gets bottom padding equal to the bar height |
| "Learn more" link in accent colour (4.0:1) | Body text colour, underlined |

Behaviour is unchanged: nothing non-essential loads until Accept; Reject sets "essential".

## Ad labels (N7)
- "Advertisement" (AdSlot) and "Advertisement" (GAM hero): 10px / 9.5px at faint grey (3.1:1) became 12px at `--text-muted` (6.4:1 on white, 6.0:1 on the page background, 7.1:1 on dark surface). Wording unchanged. Still shown only once Google fills the unit.
- Sponsor hero: the corner label "Ad" (9.5px) is removed. A bordered "Sponsored" tag (12px, same colour as the hero text) now sits inline before the eyebrow. It always shows, even when the sponsor sets their own eyebrow (the eyebrow follows it). Previously a custom eyebrow replaced the only "Sponsored" text, leaving just the tiny "Ad".
- Admin sponsor preview mirrors this ("Sponsored" tag instead of "Ad").
- Sticky footer ad has no visible text label today (aria-label "Advertisement" only). Not changed; consider adding a visible label.
- Sticky ad close button: "x" is now a 44x44 tab above the ad (was 22px and half clipped). aria-label "Close ad" unchanged.
- Full-page sponsor skin is no longer a link on touch devices (hover: none / pointer: coarse). Desktop unchanged.

## Affiliate gear block (X8)
| Before | After |
|---|---|
| Tag "Top rated" | "Amazon search" ("Our pick" unchanged, only used once an ASIN is set) |
| CTA "Top-rated on Amazon ↗" | "Search on Amazon ↗" |
| Header note "picked for today's conditions" | "Amazon search links · we earn from qualifying purchases" (disclosure now at the top of the block as well) |
| Footer "As an Amazon Associate, shouldiboat.com earns from qualifying purchases." | Unchanged text; contrast raised (muted instead of faint grey) |
| Heading "Rough-day gear" (CAUTION or wind 15 kt+) | "Gear to have aboard" |
| Heading on NO-GO: "Rough-day gear" with bilge pump and anchor first | "Safety-prep gear", collapsed by default ("Amazon links · tap to open"), containing only: cold-water layer (if water is cold), life jacket, handheld VHF, first-aid kit, dry bag. No bilge pump, anchor, cooler, tube, sunscreen or tackle. |
| "Reach help anywhere" (VHF) | "For calling for help" (avoids a coverage promise) |
| "Cold-shock protection" (cold layer) | "For cold water" (avoids a protection claim) |
| "For a sloppy day" (bilge pump) | "Moves water out of the boat" |

Link behaviour is unchanged (tagged Amazon search sorted by Amazon's review rank; `rel="sponsored nofollow noopener"`). No copy states or implies the gear makes a trip safe.

## Sponsor colour guard (X9)
- Public hero: if the sponsor's text colour on its background (or button text on button) is under 4.5:1, white or near-black is used instead. No copy change.
- Admin Sponsors editor: new advisory warnings, e.g. "Text on background is 2.1:1, under the 4.5:1 minimum. Visitors will see white or near-black text instead." and "Background colour is close to GO green. Pick something that can't be mistaken for a GO / CAUTION / NO-GO signal." Also shows the live contrast ratios. Warnings do not block saving.
- Sponsored content remains labelled and never affects verdicts.

## Questions for legal
1. Is the compact consent copy sufficient given the shortened wording (the sentence "Accept to allow them" was dropped)?
2. Is identical Reject/Accept styling enough for the jurisdictions you care about, or do you want a "Manage" option as well?
3. Does the sticky footer ad need a visible "Advertisement" text label?
