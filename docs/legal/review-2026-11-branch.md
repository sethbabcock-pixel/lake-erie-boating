# Legal/compliance review: branch claude/upbeat-galileo-meqnuz (2026-11-07)

Reviewer: Compliance agent. Not a lawyer; items marked ATTORNEY need a real one.

Method note: this session had no shell, so I could not run `git diff origin/main...HEAD`. I reviewed the files at the branch checkout against the engineer's list (docs/legal/ads-consent-review-2026-11.md). Anything not in that list or in the files I opened is not covered. I could not tell what the spot-page footer said before the branch (see B1).

Files read: src/monetize.jsx, src/Takeover.jsx, src/spot-photos.js, src/App.jsx (freshness, NO DATA, footer), functions/marine/conditions.js (buildRecommendation), src/styles.css (consent, ad label, credit CSS), index.html (Consent Mode default), public/legal.html.

## Summary

Merge blockers: none that stop the code changes in this branch. The ad labels, consent bar, gear block and stale/NO DATA copy are an improvement and I found no new risk. One blocker is conditional on photos shipping (B2), and one pre-existing safety gap needs a decision before or soon after merge (B1).

| ID | Severity | Item | Blocks merge? |
|---|---|---|---|
| B1 | High | No visible safety disclaimer on the spot page (only a Terms link) | Decide now; I recommend fixing in this merge |
| B2 | High | Photo credit CSS truncates the credit, and the credit lacks a license link and a change note | Blocks the first Commons photo going live (SPOT_PHOTOS is empty today, so the code can merge) |
| B3 | Medium | EEA/UK: no certified CMP, but AdSense still loads | Not a blocker for a US-only site; needs a geo decision |
| N1 | Low | Sticky footer ad has no visible "Advertisement" label | Nice-to-have, but cheap; I recommend adding it |
| N2 | Low | Amazon disclosure wording differs from Amazon's stock sentence | Nice-to-have |
| N3 | Low | "Looks good to boat." GO summary and the share text | Nice-to-have |
| N4 | Low | Admin photo uploads carry no rights check or credit | Nice-to-have |

## 1. Ads, consent, affiliate

### Ad labels: OK
- AdSlot "Advertisement" (src/monetize.jsx:152) is 12px in `--text-muted` (styles.css:1415). The engineer measured 6.0 to 7.1:1. The label appears only after Google fills the unit. That is acceptable: Google's policies require the label "Advertisement" or "Sponsored Links", and no label is needed on an empty collapsed unit.
- GAM hero "Advertisement" (src/Takeover.jsx:245) is 12px and muted. OK.
- Sponsor hero: the bordered "Sponsored" tag (Takeover.jsx:104) always shows, including when the sponsor sets a custom eyebrow. This is better than before, when a custom eyebrow replaced the only plain-language label. It is consistent with FTC native-advertising guidance (clear, unavoidable, plain wording). I confirmed it is not suppressed by the eyebrow check (line 105 only hides a duplicate eyebrow).
- The sponsor skin (full-page background) is an `<a>` with `aria-label="X sponsor"` and `rel="sponsored"`, and is inert on touch. Good: it avoids accidental-click problems. The skin itself has no visible label, but the hero carries "Sponsored".
- Sponsored content does not touch verdict code. Confirmed: Takeover.jsx only takes `verdict` as display input.

### Sticky footer ad (N1)
The sticky ad has only `aria-label="Advertisement"` (monetize.jsx:173). Google's AdSense policies do not require a label on every unit and say publishers may add one. Because this unit overlays page content, a visible label is cheap protection. Suggested: a 12px "Advertisement" text tab beside the close button, using the same `.adlabel` style.
Answer to the engineer's question 3: not strictly required, but recommended.

### Amazon Associates: compliant, with one small wording item
- Removed: "Top rated" and "Top-rated on Amazon". Good. Replaced by "Amazon search" and "Search on Amazon". Accurate: these are search links, not endorsements.
- "Our pick" appears only when an ASIN is set (monetize.jsx:240). OK if a human actually picked it. Do not set ASINs from guesses (code comment already says so).
- No hardcoded prices, ratings or product images. Good.
- Links carry `rel="sponsored nofollow noopener"`. Good.
- Disclosure: the header legend reads "Amazon search links · we earn from qualifying purchases" (line 266), and the footer sentence is retained (line 254). On NO-GO the block is collapsed, with legend "Amazon links · tap to open" and the disclosure inside the opened body. The links are not visible while collapsed, so the disclosure is next to the links whenever they can be clicked. Acceptable.
  - Nice-to-have: add "we earn from qualifying purchases" to the collapsed NO-GO summary so the commercial nature is visible before opening.
- N2: Amazon's Operating Agreement asks for the statement "As an Amazon Associate I earn from qualifying purchases." The site uses "As an Amazon Associate, shouldiboat.com earns from qualifying purchases." This variant is widely used and Amazon's guidance allows the site-name form. I could not confirm the current Operating Agreement wording in this session. To remove the doubt, use Amazon's exact sentence. Source to check: https://affiliate-program.amazon.com/help/operating/agreement (ATTORNEY or owner to confirm current text).
- Legal page (public/legal.html:92) says gear links "may be" affiliate and "are marked". That matches. No change needed.
- `s=review-rank` is only the sort order of an Amazon search. It makes no claim on our page. OK. Stale code comments still say "top-rated results" (monetize.jsx:192, 211) but are not user-visible.

### Gear copy on NO-GO: OK
- Heading "Safety-prep gear", collapsed, only cold layer, PFD, VHF, first-aid kit and dry bag. No fun items, no anchor, no bilge pump. This does not encourage launching.
- "Required gear" on the PFD is true under US rules for recreational boats (a wearable PFD per person), but it is an absolute phrase. Acceptable. If you want zero risk: "Carry one for every person aboard".
- "For calling for help" and "For cold water" avoid promising coverage or protection. Good.
- "Safety-prep gear" is a mild risk because "safety" in a heading could be read as "buying this makes it safe". It sits under a NO-GO verdict and is collapsed, and the engineer's list says no copy implies the gear makes a trip safe. Suggested alternative if you want to be stricter: "Gear worth having for another day". I leave this to the owner (nice-to-have).
- Non-NO-GO: "Gear to have aboard" for CAUTION, with anchor and bilge pump first. Fine. Note the NO DATA state has level CAUTION on the wire, so it shows "Gear to have aboard". Acceptable.

### Consent banner
What is good:
- Reject and Accept are the same size, weight, fill and contrast (styles.css:1440), 44px tall, equal width. Equal prominence satisfies the EDPB/CNIL expectation that refusing be as easy as accepting.
- No pre-ticked boxes. Nothing non-essential loads before Accept. Consent Mode default is denied unless `sib.consent === "all"` (index.html:53-55), and the banner updates it (monetize.jsx:55). Reject writes "essential".
- Banner is non-modal and the page stays usable. A footer "Cookie settings" link (App.jsx:1489) lets a user change the choice later, which is the withdraw-as-easy-as-give requirement.
- The shortened sentence "Accept or reject non-essential cookies" still names analytics and ads, and links to the Cookie Policy. For engineer question 1: the sentence is sufficient for a US audience. Under GDPR "informed" consent a short bar generally needs a layered link, which you have. Suggested wording that is a little more explicit at no length cost: "We use cookies for analytics and ads. Accept or reject them; the site works either way. Learn more." Optional.
- For question 2: for a US-only site, identical Reject/Accept is enough for CCPA/CPRA-style expectations. A "Manage" option is only needed if you serve EEA/UK, where granular purposes are expected.

Gaps:
- B3, EEA/UK. Google requires a Google-certified CMP that integrates with the IAB TCF for ads served to users in the EEA, UK and Switzerland (this applies to personalized and non-personalized ads, since January 2024). The banner is a custom one, not a certified CMP, and the AdSense library loads from index.html and monetize.jsx for everyone. The legal page (legal.html:180) says the site is for a US audience and that you will add a TCF CMP before extending personalized advertising to the EEA/UK. That is honest, but it does not match what happens if an EEA visitor loads a page: ads are still requested, in limited mode. Options: (a) enable Google's free Privacy and messaging (Funding Choices) CMP in the AdSense account and let it handle EEA/UK, (b) block ad requests from EEA/UK/CH by country at the Worker, or (c) accept the risk of limited ad serving. This is a decision for the owner. ATTORNEY to confirm which option and how far the "US audience" statement protects. Sources: https://support.google.com/adsense/answer/13554116 and https://support.google.com/adsense/answer/7670013
- US state privacy: some states (California, Colorado, Connecticut and others) expect recognition of Global Privacy Control signals as an opt-out. The banner does not read `navigator.globalPrivacyControl`. If the site meets any state threshold, a GPC check is expected. Not a blocker, and likely under thresholds today. ATTORNEY to confirm applicability. Cheap fix: treat GPC as "essential" by default when no choice has been stored.
- Ad fill telemetry (`/api/adstat`, sampled sendBeacon, monetize.jsx:88-103) is cookieless and carries only placement and status. It is not mentioned in public/legal.html (my search found no mention). It is low risk, but the privacy policy should match the code. Add a sentence under Cookies/Analytics: "We measure whether ad slots load, as anonymous counts with no identifier." Nice-to-have.

## 2. Verdict copy

### Freshness and stale notice: OK
- App.jsx:494-506: "Data is N min old (buoy XXXXX reading). Check before you go." and "This page loaded N min ago. Check before you go." Neither promises safety. The code comment says the browser never changes the level. A stale input is capped to CAUTION on the server (conditions.js:1361-1373), so GO is not shown on stale data, matching the standing rule.
- FreshLine (App.jsx:480-492) states sources and ages plainly ("No live buoy: forecast only").
- NO DATA: summary "No live data right now. Check before you go." (conditions.js:1408), reason "Live wind and wave data are unavailable right now. Check the NWS marine forecast before you launch". It renders as a neutral "NO DATA" badge, not GO. The level stays CAUTION on the wire for emails and API consumers, which is the safe choice. The share text for NO DATA says there is no data and to check the NWS marine forecast (App.jsx:586). Good.
- Stale summary: "Data is out of date. Check before you go." Good.

### Disclaimers: B1 gap
- The spot-page footer (App.jsx:1477-1491) shows Source/Updated, Guides, About, Feedback, Advertise, Terms, Privacy, Cookie settings. There is no visible disclaimer there. The only visible "planning aid, not an official forecast or a navigation tool" line I found is on the landing page (src/Landing.jsx:719) and in the legal page footer (legal.html:184). I did not find a "use your own judgment" statement on the spot page, where the GO/CAUTION/NO-GO call is made. The Terms (legal.html:71, 95) contain the "as is" and liability language, but one click away.
- I could not check whether the main branch had a disclaimer that this branch removed. Whether it is new or old, the safety rule in the project instructions (prominent, plain, consistent across the app) is not met on the page that matters most.
- Proposed text for the spot-page footer, directly under the verdict card or at least in the `footer.meta` block, above the links:

  > shouldiboat.com is a planning aid, not an official forecast or a navigation tool. Conditions can change quickly and local conditions can differ from the data. GO / CAUTION / NO-GO is an automated summary, not a guarantee of safety. You are responsible for the decision to boat. Check the latest NWS marine forecast and warnings before you launch.

- ATTORNEY should review the final disclaimer, especially "You are responsible for the decision" and the interaction with the liability limits in Terms.

### GO summary wording (N3)
- conditions.js:1412 "Looks good to boat." is a positive statement on a safety call. It is conditional on a verdict and not a promise, but it is the line most likely to be quoted back in a dispute. Suggested: "Conditions look favorable right now. Check before you go." Changing the string is not a verdict change, but because the summary is returned by the verdict function, the `marine-data-scientist` review rule should still be run.
- "Boatable with caution. Small boats take care." and "Not recommended. Stay in." are fine. The share text for non-NO-DATA verdicts (App.jsx:587) is "X: GO right now. Wind ..." with no hedge. Suggested suffix: " Check conditions before you go."

## 3. Photo credits (Wikimedia Commons)

State today: `SPOT_PHOTOS` in src/spot-photos.js is empty, and public/spots/ does not exist yet. So no Commons photo is live. Admin uploads show no credit (credit and license are empty strings, Takeover.jsx:137 skips the line). The rest of this section applies when entries land.

### What the licenses require
CC BY 4.0, section 3(a)(1), and BY-SA 4.0 (same) require, when you share the licensed material:
1. Identification of the creator (and anyone else designated), in a reasonable manner.
2. A copyright notice, if supplied.
3. A notice that refers to the license.
4. A notice that refers to the disclaimer of warranties.
5. A URI or hyperlink to the material, to the extent reasonably practicable.
6. An indication if you modified the material, and an indication of any previous modifications.
7. An indication that the material is licensed under the license, with the license text or a URI/hyperlink to it.

Section 3(a)(2) lets you satisfy this in any reasonable manner for the medium, and says it may be reasonable to satisfy it by linking to a resource that holds the information.
Older versions (2.0, 2.5, 3.0): credit the author (and any designated parties), the title of the work if supplied, a URI to the work if supplied, and a license notice that includes the license URI or text. For adaptations, 3.0 also requires a credit that identifies the adaptation (for example "cropped version of...").
The Commons "Reusing content" guidance (https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) suggests the form: author, title (linked to the file page), license (linked to the license deed), and a note of changes.
CC best practices (TASL: title, author, source, license): https://wiki.creativecommons.org/wiki/Best_practices_for_attribution
License deeds: https://creativecommons.org/licenses/by/4.0/ and https://creativecommons.org/licenses/by-sa/4.0/

### Does "Photo: <author> · <license>" linked to the file page satisfy it?
Mostly, under the 4.0 licenses, and not clearly under the older ones. Assessment:
- Author: shown. OK (author must be the name as Commons attributes them; some require a specific attribution text on the file page; honor it).
- Source: the link goes to the file page. OK, and that satisfies the "URI to the material".
- License: only the short name is shown as text. The single link goes to the file page, not to the license. A reasonable reader gets the license one click later. Under 4.0 section 3(a)(2) that is defensible, but it is the weakest part. Older versions require the license URI or text with the work, so a direct link on the license name is safer. Public domain and CC0 need no link, but a link to the file page is still good practice.
- Title: not shown. Required in 2.0/2.5/3.0 "if supplied" and part of TASL. Cheap to add, though length is a problem in a hero corner (see below).
- Modification: not shown. See next.
- Warranty disclaimer notice: the file page and deed carry it; a link to the deed covers it.

### Crop, resize and the dark overlay: is it an adaptation?
- The image is resized to public/spots/ and `object-fit: cover; object-position: center 55%` crops it on screen, and a dark gradient is laid over it (styles.css:1464-1467).
- Under 4.0, "technical modifications necessary to exercise the Licensed Rights" (e.g., format changes needed to share) do not by themselves create Adapted Material (section 2(a)(4)). Straight downscaling for web is usually in that bucket. A deliberate crop and a visual overlay that changes how the photo looks go further. Treat them as modifications.
- 4.0 requires you to indicate if you modified the material. 3.0 and earlier require a credit of the adaptation if you create a derivative.
- Recommendation: be conservative and say so in the credit: "cropped, darkened". It costs a few characters and removes the argument. If the gradient is only CSS and the file we host is only resized, the "changes" note is still the safe course because the user sees the modified picture.
- ATTORNEY: confirm whether resizing alone needs a note. I recommend noting it regardless.

### Share-alike (BY-SA) in practice
- BY-SA 4.0 section 3(b): if you share Adapted Material, you must license your contributions to it under BY-SA 4.0 (or a BY-SA Compatible License), include the license text/URI for the Adapter's License, and not apply additional restrictions or technical measures that stop recipients from using the adapted material under the license. Earlier versions (e.g., 3.0) require the same or a later version or a compatible license.
- What this means for us:
  - The resized/cropped JPEG in public/spots/ is the adaptation. Anyone must be free to copy and reuse that file under BY-SA, with attribution. Do not put "all rights reserved" on it, and do not mark it as covered by the site's content restrictions.
  - The rest of the page (verdict, text, code, ads) is not "adapted material" merely because it sits next to or over the photo; combining in a page layout is generally treated as a collection, not an adaptation. This is the common reading but it has no settled case law for text-over-image and CSS overlays. ATTORNEY to confirm, especially if the overlay or the headline is baked into an image file (e.g., an Open Graph card). Practical safe rule: never bake text or logos into a BY-SA photo file, keep the overlay in CSS, and keep the headline as HTML text.
  - Check the site Terms (public/legal.html section on content/IP and the line against scraping, lines 83-89) so they do not claim rights over the photos or forbid copying them. Add a carve-out sentence: "Photos credited to others are used under their Creative Commons licenses; see the credit on each page."
  - Prefer CC BY, CC0 and public domain over BY-SA where there is a choice. It removes the share-alike question.
  - No hotlinking issue: images are self-hosted from public/spots/. Keep the license and source stored with each entry (spot-photos.js already has the fields). Also keep a copy of the Commons file-page text (author, license) as of the date used, in case the page changes.
  - Verify each license on the file page itself (Commons marks some files with bad or disputed license tags), and exclude "NC" and "ND" (already excluded in the file header) and files with extra restrictions (personality rights, trademarks, "no commercial use" templates).

### B2: credit presentation problems
styles.css:1474-1476 sets `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: min(70%, 420px)`, at 11px (10px under 640px wide). Attribution that is cut with an ellipsis can drop the license name, which is the last part, and part of the author. A truncated credit does not meet "reasonable manner". Contrast is helped by the gradient (rgba white .82 plus text-shadow over a darkened bottom), but 10 to 11px with a text-shadow is hard to read on a bright photo. Fixes needed before the first Commons photo goes live:
- Allow the credit to wrap (`white-space: normal`), remove `text-overflow: ellipsis`, and keep at least 12px.
- Separate links: author/title/source goes to the file page, license name goes to the license deed.
- Add the change note.

### Recommended exact credit format
Rendered (12px, wraps, white on the existing dark overlay):

> Photo: "{Title}" by {Author}, [file page link] · [CC BY-SA 4.0] (link to deed) · cropped and darkened

Concrete example (BY-SA):

> Photo: <a href="{commonsFilePage}">"Put-in-Bay harbor" by Jane Doe</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · cropped, darkened

Public domain / CC0:

> Photo: <a href="{commonsFilePage}">"{Title}" by {Author}</a> · Public domain (or CC0 1.0)

Notes:
- If the "Title" makes it too long on mobile, use "by {Author}" as the file-page link text; the title is on the file page. Under 4.0 the title is not required, under 2.x/3.0 it is "if supplied", so including it is the safe choice when the license version is older than 4.0.
- Add a `licenseUrl` field (and optionally `title` and `changes`) to SPOT_PHOTOS entries in src/spot-photos.js; have Takeover.jsx render two links. The entry shape today has only `credit`, `license` and `source`.
- Both links should open with `rel="noopener"`. The credit must stay visible on the page, not just in the alt text or the page source (`alt=""` is correct for a decorative image).
- ATTORNEY to confirm the final format, particularly for any BY-SA 2.x/3.0 file and the "cropped, darkened" note.

### N4: admin uploads
Takeover.jsx:129 and spot-photos.js:24 give uploads blank credit and license. That is correct only if the owner owns the photo or holds a license that needs no credit. Add an admin note near the upload: "Upload only photos you own or have written permission to use. Photos from other people need a credit; add it here." Optionally add a credit field to the admin form. Not a blocker.

## Proposed actions (owner approval needed for live copy)

Before merge:
1. B1: add the spot-page disclaimer above (or confirm the footer text lives elsewhere and show me where).
2. Make sure `SPOT_PHOTOS` stays empty, or its entries carry the new format, until B2 is fixed.

Before first Commons photo goes live:
3. B2: CSS wrap fix, separate license link, change note, `licenseUrl` field, Terms carve-out sentence.

Soon after:
4. B3: decide EEA/UK handling (Google CMP or geo-block). ATTORNEY.
5. N1: visible "Advertisement" tab on the sticky ad.
6. N2: use Amazon's exact Associates sentence; add "we earn from qualifying purchases" to the collapsed NO-GO summary.
7. N3: soften "Looks good to boat." and add a hedge to the share text (run the `marine-data-scientist` review).
8. GPC handling; mention ad-fill counts in the privacy policy.
9. N4: admin upload rights note.

ATTORNEY items: spot-page disclaimer final wording and its interaction with the Terms; EEA/UK approach; GPC and state-law thresholds; whether resizing needs a modification note and what BY-SA share-alike covers for a hero photo with overlay text.
