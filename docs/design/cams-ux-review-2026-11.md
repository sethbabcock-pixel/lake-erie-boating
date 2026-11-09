# Live-cam UX review (2026-11-09)

Scope: `src/Cams.jsx`, `src/cams.js`, `src/admin/CamsPage.jsx`, and the `<Cams>` placement in `src/App.jsx:1428-1432`. I checked the live site (shouldiboat.com) at 390x844 and 1280x800, dsf 1, with headless Chromium. Spots: Put-in-Bay, Duluth, Key West, Sackets Harbor, Harbor Beach, Marquette. Screenshots are in `docs/design/img/cams-2026-11/`.

Caveats:
- Headless Chromium and the sandbox proxy can show YouTube "Video unavailable" for cams that play fine for users. Treat the Key West and Sackets cases as "the chrome failed to notice", not as proof the cam is dead.
- **Correction (COO check, same day):** the live site *was* running the audited list; the bundle contains the new entries, and `/marine/cams` reports all Duluth cams `live`. Duluth showing only Bayfield is a sandbox artifact: headless Chromium couldn't play the Duluth YouTube cams, so `Cams.jsx` marked them failed and hid them. The Marquette Windy cam ("Big Bay › South-east (Windy · replay)") is real. The server adds it, and it's labelled "Live video", so item 1 stands.
- No code was edited.

## Priority list

| # | Pri | Item | Effort |
|---|---|---|---|
| 1 | P0 | "Live video" badge and hint over a failed, replay, or timelapse feed | M |
| 2 | P0 | No distance or location on the cam, and a fallback cam up to about 110 mi away is presented as "Live cams" | S |
| 3 | P0 | A cam must never imply "go": add a one-line "A cam shows one spot and one moment" note and a captured-at time | S |
| 4 | P1 | Dead YouTube feeds are only caught client-side, late, and not for every failure | M |
| 5 | P1 | Page loads one autoplaying embed plus a third-party script, about 1 MB, before any user choice | M |
| 6 | P1 | "More cams" link-outs are lake-wide, not spot-near, and some are wrong for the spot | S |
| 7 | P1 | Report flow: 18px target, vague, no per-cam report, no feedback to the user, and admin has no "disable this cam" shortcut | M |
| 8 | P1 | Cam picker: native select, long names truncate, no thumbnails | M |
| 9 | P1 | Accessibility gaps (iframe title, live regions, spinner, keyboard) | S |
| 10 | P2 | Night, black, and frozen-frame detection for snapshot cams | M |
| 11 | P2 | Layout: 16:9 box letterboxes 4:3 feeds, the link block outweighs the cam, and the cookie banner covers the card | S |
| 12 | P2 | Admin: health checks only on demand, no history, no "last verified", reports not linked to cams | M |
| 13 | P2 | Ad and sponsor separation (currently good, add a guardrail) | S |

---

## P0

### 1. "Live video" is claimed whatever the feed is actually doing
- **Problem.** The header pill and hint are derived only from the data shape: `camKindLabel` returns "Live video" for anything that is not an `img` (`src/cams.js:350-351`). `Cams.jsx:246` and `:282-284` print it regardless of player state.
  - Marquette (live site) shows a Windy player with a "24 hours" scrubber and the name "(Windy · replay)". It is labelled "Live video" in the pill and the hint, and the clock reads "Mon 15:10".
  - Key West and Sackets Harbor showed the YouTube "Video unavailable" panel inside the frame while our chrome still said "Live video" and the spinner was gone.
  - A YouTube cam that stalls after `onReady` only gets the 9 s watchdog (`Cams.jsx:120-123`). Non-YouTube iframes call `setLoaded(true)` after 4 s whether or not anything loaded (`:213-217`), so a blank or error frame looks "loaded". `onLoad` only fires on document load, not on a provider error page.
- **Evidence.** `img/cams-2026-11/m-marquette.png`, `m-key-west.png`, `m-sackets-harbor.png`; `src/Cams.jsx:213-217, 246, 282-284`.
- **Change.** Replace the static pill with a state-driven status chip. Always pair icon, word, and color.
  - States: `Live` (player reported playing, or the server check says live), `Photo · updated 2 min ago`, `Replay / timelapse` (Windy or any `embed`), `Can't confirm live` (iframe with no signal), `Not responding`.
  - Never show "Live video" until a player or server signal supports it. For providers with no signal, say "Video (live status unknown)".
  - Add an `isReplay` flag for Windy entries so they render as "Replay" and are excluded from "Live cams" ordering.
- **Effort.** M

### 2. The user cannot tell where the cam is or how far it is from their launch
- **Problem.** The picker shows only the cam name. `nearestCams()` ranks by distance (`cams.js:391-400`) but the distance is never shown.
  - Duluth's only cam is "Bayfield · Port Superior Marina", about 70 mi from the Duluth launch. That is within the 0.85 deg rule, but the panel reads as if it were Duluth.
  - Marquette's Windy cam is "Big Bay", with the frame labelled "Halfway Village, MI". That is a different place.
  - The single-nearest fallback (0.85 to 1.6 deg, about 110 mi, `cams.js:398`) is shown under the same "Live cams" heading with no warning.
  - The footer hint says "2 offline cams hidden" (`Cams.jsx:285`). That is internal jargon, and it tells the user nothing useful.
- **Evidence.** `m-duluth.png`, `m-marquette.png`; `src/Cams.jsx:251-256, 285`; `src/cams.js:389-399`.
- **Change.**
  - Return distance (miles, one decimal under 10) and bearing from `nearestCams()` and show it as the option subtitle and in a one-line caption under the frame: "Bayfield, WI · 68 mi NE of Duluth · NOAA / marina cam".
  - Beyond about 25 mi, use a muted-warning caption: "Not at this launch. 68 mi away."
  - For the fallback single cam, change the heading to "Nearest cam (68 mi away)".
  - Replace "2 offline cams hidden" with "2 cams not responding. Show them" (a disclosure that lists them), or drop it.
  - Split the name into `place` and `view` (for example "Put-in-Bay" and "Harbor, boardwalk, looking W") so the caption can be built from data.
- **Effort.** S for distance and caption; M for the name-schema split.

### 3. Trust and safety copy
- **Problem.** Nothing in the panel says what a cam does not tell you. A calm-looking marina next to a CAUTION or NO-GO verdict is a mixed signal. A cam is a single point at a single moment. The page above says CAUTION (see `d-put-in-bay.png`: CAUTION in the sticky bar while the cam shows a sunny harbour). The footer disclaimer (`App.jsx:1474`) is far below the cams.
  - No capture time is shown for photo cams.
  - The existing copy is otherwise safe. "Live cams" is a heading, not a promise. The hint says "Live video. Some players need a tap to start."
- **Change.** Add one fixed line under the frame, hint size, not collapsible: "One view, one moment. A calm harbor doesn't mean calm water outside it. The verdict above uses buoy and forecast data, not this cam." Never reorder or recolor the cam by verdict.
  - Where the verdict is CAUTION or NO-GO, no change to the cam. Do not hide cams, because a cam can also confirm the warning.
  - Show "Photo taken 14:32" if the image provides it. Otherwise say "Photo, refreshes every 15 s" (this already exists).
  - Cam alt text must describe the source, not the conditions: "Still from {name}", never "calm water".
  - Route the final wording through `legal-compliance`. No verdict logic is touched, so no `marine-data-scientist` review is needed.
- **Effort.** S

---

## P1

### 4. Dead feeds are caught late and incompletely
- **Problem.**
  - YouTube cams come back "unknown" from the server (`functions/marine/conditions.js:2063-2110`). Detection relies on the client watchdog (`Cams.jsx:105-147`). It only runs after `onReady`, and the YT "Video unavailable" panel can appear without `onError` (see `m-key-west.png`, `m-sackets-harbor.png`, taken after 6+ s).
  - `failed` is per session. Every visitor pays for the dead cam again.
  - If all cams fail, the code falls back to showing the full list so "the section is never empty" (`Cams.jsx:186-190`). That means a user can land on a dead frame with no explanation.
- **Change.**
  - After the watchdog fires, show an inline "This cam isn't responding. Try the next one / Open it directly" with a next-cam button, not just the link in the hint (`Cams.jsx:260-265` only covers the image and iframe-load error paths).
  - Auto-advance to the next candidate after failure, once.
  - Send a beacon (`/api/cam-health`, a KV counter by cam name) when the client sees a failure. Auto-demote a cam after N distinct failures in 24 h and surface it in `/admin`. Combine with a user "Report" (item 7).
  - When every candidate has failed, replace the frames with the empty state, not a dead player.
- **Effort.** M (S for the in-panel message and auto-advance)

### 5. Weight and autoplay
- **Problem.**
  - On one spot (Sackets Harbor, mobile) one cam load pulled about 1.05 MB of cam-provider traffic by `content-length` alone, plus the `iframe_api` script. It autoplays muted, immediately, with no tap (`Cams.jsx:116`, `cams.js:360-365`: `autoplay=1`).
  - The panel is mid-page, so it normally loads below the fold, yet the player and `loadYT()` start at mount.
  - `loading="eager"` is set explicitly on the non-YT iframe (`Cams.jsx:274`).
  - Snapshot cams refresh every 15 s forever (`Cams.jsx:206-210`), even when the tab is hidden or the card is off-screen.
  - On LTE at a ramp this costs data and delays the verdict page it sits on.
- **Change.**
  - Use a poster plus a tap-to-play: show a thumbnail (YouTube `i.ytimg.com/vi/<id>/mqdefault.jpg`; for others a static placeholder) with a 56px play button. Load the player on tap, or when it scrolls into view and `navigator.connection.saveData` is not set and the connection is not 2g/3g.
  - Respect `prefers-reduced-motion` by never autoplaying.
  - Pause the snapshot timer on `document.hidden` and when the card is off-screen (IntersectionObserver). Use a longer interval (60 s) when `saveData` is on.
  - Show an estimate: "Video, about 1 MB to start".
  - Only one player is mounted at a time, which is already true. Keep that rule.
- **Effort.** M

### 6. "More cams" link-outs
- **Problem.** `LINK_CAMS` is per lake (`cams.js:251-290`), so every Lake Superior spot gets the same six chips.
  - Duluth lists "Marquette · Presque Isle Middle Bay", Munising, Isle Royale, and Keweenaw (all 100 to 250 mi away). Sackets Harbor lists Olcott and Youngstown (about 100 mi).
  - Marquette's page reads: "Open this cam, Duluth Harbor Cam hub ...", with Marquette itself buried in the second row.
  - Key West has no directory chips at all (only "Open this cam", `m-key-west.png`), because only five Great Lakes entries exist.
  - On mobile the chips take about 330 px of height. The cam link block outweighs the cam (see `m-put-in-bay.png`).
  - The chips open new tabs with no warning of leaving, and the labels are long ("FishUSA Erie cams (Lampe Marina, Avonia Beach, Walnut Creek)").
- **Change.**
  - Give each link `lat/lon` and sort and filter by distance with the same `nearestCams()` rule. Show up to 3, then a "More cams (N)" disclosure.
  - Put the current cam's "Open this cam" first (already done) and keep the rest in a collapsed `<details>`.
  - Use short labels and put the detail into the `title`/description.
  - Add `aria-label="... (opens in new tab)"` and add `rel="noopener noreferrer"`.
  - The audit flagged some links as dead or stale (for example Olcott). Add the link-outs to `check-cams.mjs`.
- **Effort.** S to M

### 7. Reporting a bad cam
- **Problem.**
  - The trigger is a text link, 18.6 px tall (measured), grey `--text-faint` and `--fs-xs`. That is below the 44px target rule, and `styles.css:1347-1349` does not cover `.camsuggest`. The copy "Cams wrong or not working? Suggest a better one" is easy to miss and asks the user to do work.
  - The user cannot report the specific cam they are looking at. The form does send `current` as the whole list of names (`Cams.jsx:287`), not the selected cam.
  - The form is free-text. Success says "we'll take a look" with no way to see results. Errors use a plain `.modal-err` div with no `role="alert"`. The form is not reachable by focus management (focus is not moved to the first field on open).
  - Server side (`functions/auth.js:881-903`): rate limited (12/h), stored 180 days, emailed to the first admin. There is no cam id, no structured reason, no dedupe, and no link back to the cam in `/admin`.
  - Admin side: `src/admin/ManagePages.jsx:169` lists requests. The cams tab (`CamsPage.jsx`) does not show how many reports a cam has.
- **Change.**
  - Put a 44px "Report this cam" button beside "Open this cam", before the "More cams" label, and send `cam: cam.name` plus a reason enum: `Not the water / Not working / Frozen or old image / Wrong place / Other`. Keep the free-text and suggestion field behind "Suggest a better cam".
  - Add `role="status"` to the success message and `role="alert"` plus `aria-describedby` to the error, and move focus to the first field.
  - Honest reply copy: "Thanks. We review reports weekly." Do not promise a fix.
  - Admin: group reports by cam name, show a count badge on the cam row in `CamsPage.jsx`, and add a one-click "Disable" from the report. Reports of "Not working" from 3 or more distinct visitors could auto-hide the cam pending review.
  - Privacy: the form collects an optional email, so make sure the existing privacy copy covers it.
- **Effort.** M

### 8. The picker
- **Problem.** A native `<select>` with long names ("Put-in-Bay · Condo cam (mainland & Cedar Point across the water)"). On a 390px screen the selected name truncates (`m-sackets-harbor.png`: "Sackets Harbor · Navy Point Marine d..."). Users cannot see how many cams there are or what each looks like, and there is no prev/next. Switching resets the player and shows the spinner again, with no cached thumbnail.
  - The unused `.camtabs` CSS (`styles.css:295-299`) hints at an earlier tab design.
- **Change.**
  - Keep the select as the accessible fallback, and add a horizontal snap-scroll strip of thumbnail chips (each 44px+ tall, with the short place name and distance). Show "1 of 8" and prev/next buttons.
  - Wrap long names to two lines in the closed select, and use the `place` field from item 2 for the subtitle.
  - Preserve the sel across a re-render when the list changes (`Cams.jsx:198-199` resets to 0, which can jump the user away from the cam they chose when a status check finishes).
- **Effort.** M

### 9. Accessibility (WCAG 2.2 AA)
Items with file references:
- **Iframe title.** The YouTube player's iframe title is the video's own title ("West over docks", measured on Sackets Harbor), not our cam name. The non-YT iframe uses `title={cam.name}` (`Cams.jsx:274`). Set `title` after creation: "Live webcam: {cam.name}, {distance}". (4.1.2)
- **Spinner and status.** `.camloading` has no `role="status"` or `aria-live` (`Cams.jsx:226, 259-265`). Screen reader users get silence when a cam loads, fails, or switches. The hint at `:281-286` is not a live region either. (4.1.3)
- **Image alt.** `alt={cam.name}` (`:267`) is fine, but the alt for a refreshing photo should include "updated" and not change every 15 s.
- **Keyboard.** The select is keyboard-friendly. The embedded players trap focus in cross-origin frames, so add a visible "Skip past video" link or put the "Open this cam" link before the frame. The "Cams wrong" button is a `.linklike` button with no visible focus style check, and it is 18.6 px tall (target size, 2.5.8). `.camlink.primary` has `min-height:32px` at base and 44 only via the override (`styles.css:306, 1347`). Confirm the override loads in all breakpoints.
- **Contrast.** Hint text `rgb(94,109,121)` on white is about 5.3:1 (passes). The `.camlinks-label` uses `--text-faint` at xs uppercase, so check it in dark mode.
- **Pause.** Autoplaying video over 5 s needs a pause control (2.2.2). YouTube's chrome has one. Ozolio and Angelcam show only a partial one, and Windy shows its own. Add our own pause for snapshots, and honour `prefers-reduced-motion` (item 5).
- **Reduced motion.** `.spinner` rotates unconditionally (`styles.css:293`). Add a `prefers-reduced-motion` rule for it.
- **Effort.** S

---

## P2

### 10. Night, black, and frozen frames
- Snapshot cams (`img`) refresh blindly. At night a NOAA tower photo is black, and a stuck feed shows yesterday's frame, but we label it "Still image, refreshes every 15 seconds."
- Change: read the `Last-Modified` header via the server status check (`/marine/cams`) and return `ageMin`. Show "Updated 3 h ago. May be dark or stale" past a 30 min threshold, and dim the image. For night, compute sunrise/sunset from lat/lon (already available in the weather data) and show "Night. Cam may be dark." Do not hide the cam.
- Effort: M

### 11. Layout
- **Letterboxing.** The Angelcam 4:3 feed sits in a 16:9 box with black bars (`m-duluth.png`). Add an optional `ratio` on the cam entry, or `aspect-ratio: auto` for `angelcam`.
- **Weight.** The chip list is 55 to 65% of the card height on mobile (card height 645 to 770 px on live, about 437 px with no directory). Collapse it (item 6).
- **Cookie banner.** On first visit the consent banner covers the lower part of the card (all mobile shots). That is expected, but check that the banner does not cover the cam's own controls.
- **CLS.** The pending state reserves 16:9 (`Cams.jsx:226`), good. The empty and loaded states differ in height and the `.hint` and chips appear later, so measure CLS with a trace. I did not.
- **Desktop.** The cam sits next to `MapCard` in `.dash2 camsmap`. At 1280 the card is half-width (about 550 px), so the video is small. Consider letting the cam span two columns with the map below, or make it larger on click-to-expand.
- **Fullscreen.** `allow="fullscreen"` is set, but the YT player gets `fs` by default and Ozolio shows its own. Fine.
- Effort: S

### 12. Admin workflow (`src/admin/CamsPage.jsx`)
- What works: per-lake tabs, a `Switch` to disable a built-in, a "Check now" with green/red/gray dots, preview, and add/edit custom cams.
- Gaps:
  - Disabled names are matched by display name (`applyCamConfig`, `cams.js:342-347`). Renaming a cam in a code change silently re-enables it. Use a stable id.
  - Status dots are only populated after "Check now" and are not stored. There is no "last verified" date and no history.
  - YouTube is always gray, which is the most common type. The "can't verify" state needs a manual "Verified on 11/09" stamp and a thumbnail check (the YT thumbnail URL returns 404 for removed videos).
  - Changes need a "Save" elsewhere ("save first" in the panel sub-copy). Make the unsaved state obvious and the check able to test unsaved edits.
  - There is no search or sort across lakes, no "region" tab for the coastal lakes (`LAKES` is just the five Great Lakes, `CamsPage.jsx:5`), so coastal cams (Key West, etc.) cannot be edited or disabled from the UI even though `CAMS` has them.
  - No place or "what it shows" field, no distance-to-spot preview, and no "which spots show this cam" list, so the owner cannot see the blast radius of a disable.
  - Reports are in a different admin tab (`ManagePages.jsx:169`) from the cams.
- Change: add the coastal regions as tabs, a "Used by N spots" count, per-row "last checked" and "reports", a daily server check written to KV (the weekly `cam-health` Action already exists), and a "Disable and reply" button on each report.
- Effort: M

### 13. Ads and sponsors near cams
- Current state is good. `AdSlot detailTop` sits under the verdict and above the glance band (`App.jsx:1402`). `detailMid` sits after the gear block (`:1471`). Neither is adjacent to `<Cams>` (`:1430`), and I saw no ad inside the card. The 3rd-party ad scripts load on every spot page (up to 129 requests on Key West).
- Risks to guard: a future "sponsored by" placement or an affiliate chip in `.camlinks` would blur with the chips, because those look like ads. The cam link chips use the same pill style as any sponsor chip would.
- Change: add a code comment and a design rule: no ad, sponsor, or affiliate unit inside the cam card or directly above or below it without a "Sponsored" label and a 24px gap. A branded cam ("Cam presented by X") must be a labelled sponsor, never a cam name, and it must not appear in the picker. The ad should never sit between the frame and "Open this cam".
- Effort: S

---

## States checklist

| State | Today | Proposed |
|---|---|---|
| Loading | Spinner "finding live cams..." in a reserved 16:9 box (good), then "loading {name}..." | Add `role="status"`. Show the thumbnail poster. |
| Empty | "No live webcams for this spot right now; they come and go..." plus directory chips plus suggest (`Cams.jsx:231-239`). Reasonable. | Nearest cam and distance if any, 44px "Suggest a cam" button, link chips filtered by distance. |
| Error / dead | Per-cam text only for image and iframe load errors. YouTube dead shows the provider's own panel. | Inline message, next-cam button, auto-advance, beacon to admin (item 4). |
| Stale / night | Not handled. | Age and night captions (item 10). |
| Offline (user's network) | Fetch failure goes to `status = {}` and shows cams from the bundled list. Nothing tells the user they are offline, and the frame just spins. | Use `navigator.onLine` plus the 4 s timeout to show "You're offline. Cams need a connection. Verdict data may be old." |
| Fallback cam (far) | Shown as normal. | "Nearest cam, 68 mi away" (item 2). |
| Replay / timelapse | Labelled "Live video". | "Replay" chip (item 1). |

## Copy proposals
- Heading: "Live cams" becomes "Cams near {spot}" (and "Nearest cam" when the fallback applies).
- Caption: "{Place} · {distance} {bearing} · {source}".
- Safety line: "One view, one moment. A calm harbor doesn't mean calm water outside it. The verdict above uses buoy and forecast data, not this cam."
- Failure: "This cam isn't responding. Try the next one, or open it on its own site."
- Report success: "Thanks. We review reports weekly."
- Avoid: "check conditions", "safe", "clear", "looks good" in any cam label or alt text.

## Token and CSS changes
- No new tokens needed. Reuse `--warning`/`--warning-text` for the "not at this launch" caption and `--r-pill` for the status chip.
- Add `.cam-kind.replay` (neutral) and `.cam-kind.warn`. Always an icon plus a word.
- Add `.camsuggest` to the 44px target override (`styles.css:1347-1349`).
- `@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }`.

## Suggested order
1. Items 1, 2, 3 and the 44px report button (one small PR, mostly `Cams.jsx` and `cams.js`).
2. Item 4 and the item 7 admin report grouping.
3. Items 5 and 6 (data and performance).
4. Items 8 to 12.
