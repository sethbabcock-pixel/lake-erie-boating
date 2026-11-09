# Coastal cam review (non-Great Lakes), 2026-11-09

Scope: every `src/cams.js` entry whose `lake` is not a Great Lake, checked against `functions/marine/conditions.js` `SPOTS`. **`src/cams.js` was NOT edited.** This file is a report only.

The bar and method follow `docs/ops/cams-great-lakes-audit-2026-11.md`: a cam stays only if a frame was seen, or the operator's label names a water view. We trust what the camera shows, not the host's name.

The brief said "about 160" entries. The count is **136** coastal cams, across **96** coastal spots (130 spots in total).

## Method and limits

- **oEmbed:** all 136 YouTube ids returned 200. That proves only that the video exists and allows embedding. It says nothing about whether it is live or what it shows. 0 of 136 were caught by oEmbed.
- **Thumbnails:** downloaded for all 136 (`maxresdefault_live`, then `hqdefault_live`, then `hqdefault`) and viewed on 12 contact sheets.
- **`_live` is not a freshness signal.** For every sample I compared, the `_live` and static thumbnails were byte-identical. The only real freshness evidence is a clock or overlay burned into the frame.
- **Live today:** about 18 frames carry a 2026-11-09 clock (for example Shilshole, Bellingham, Friday Harbor, Newport OR, Brooklyn Navy Yard, the South Padre cams, and Galveston ABC13). Those are confirmed live.
- **Promo or slate thumbnails:** 35 cams show a promo banner, a logo, or a custom still ("LIVE WEBCAM STREAMING NOW", "Myrtle Beach 24/7", an AI-style "Linda Mar" illustration, and so on). These are marked **U** (frame unverified). They stay only on the operator-label rule, and the YouTube player must hide them if they are offline.
- **Not done:** YouTube watch pages return 429, and I did not work around that. There was no Referer or UA spoofing and no HLS pulling. Liveness of U cams therefore rests on labels only.
- **Time of day:** the audit ran at about 13:00 Pacific and 16:00 Eastern, so most frames are daylight. Thumbnails are one moment in time.

Verdict key:

| Verdict | Meaning |
|---|---|
| KEEP | Water is the main subject. |
| WEAK | Water is the subject but under about 40% of the frame, or other things dominate. Keep only if the spot would otherwise be empty. Rank last. |
| FIX | Rename, re-verify, or a provenance question. |
| REMOVE | Not a water view, stale, or no frame. |

## 1. Per-region summary

| Region | Cams | KEEP | WEAK | FIX | REMOVE | U (frame unverified) |
|---|---|---|---|---|---|---|
| Florida (Atlantic, Keys, Gulf) | 30 | 23 | 6 | 0 | 1 | 8 |
| Gulf (AL/MS, LA/TX) | 18 | 6 | 6 | 2 | 4 | 2 |
| Carolinas and Georgia | 12 | 8 | 2 | 1 | 1 | 4 |
| Chesapeake | 2 | 2 | 0 | 0 | 0 | 1 |
| New England | 18 | 13 | 2 | 2 | 1 | 10 |
| NY/NJ and Long Island Sound | 9 | 6 | 0 | 1 | 2 | 2 |
| California (SoCal, NorCal, SF Bay) | 20 | 12 | 4 | 0 | 4 | 6 |
| Pacific Northwest | 11 | 7 | 4 | 0 | 0 | 0 |
| Alaska | 1 | 1 | 0 | 0 | 0 | 0 |
| Hawaii | 14 | 10 | 0 | 3 | 1 | 2 |
| Puerto Rico | 1 | 0 | 0 | 1 | 0 | 0 |
| **Total** | **136** | **88** | **24** | **10** | **14** | **35** |

U cams overlap the other columns (a cam can be KEEP and U).

Weak views by region:

- **Florida:**
  - Sombrero Beach: the beach fills the frame and the water is a strip.
  - Marathon Sunset Grille: the pool fills about 60% of the frame, with the bridge in a strip.
  - Frenchy's: shade sails over sand.
  - Fort Lauderdale PTZtv: the thumbnail is a close-up of people on the beach. It looks canned and is not a boating view.
  - Fort Myers Beach: the Visit Fort Myers cam shows a beach construction site, and Margaritaville shows a resort with the Gulf as a strip.
- **Gulf:**
  - Galveston: ABC13 is about 40% road. Yacht Basin and Ship Channel are marsh and buildings with some water.
  - South Padre Sand Rose: a flooded patio fills two thirds of the frame.
  - Queen Isabella Causeway: a bridge and palms with a haze strip of bay.
  - Fairhope: the pier is the top 15% of the frame, over a parking lot.
- **Carolinas:** Sea Pines shows a patio and dune with about 15% ocean. Surfside Pier shows deck boards, with the ocean as a sliver on the left.
- **California:**
  - Pacifica Pier close-up: a crane and parking lot with the surf at the top.
  - Trinidad: trees fill about 60% of the frame.
  - Angel Island: trees, with the cove as a strip.
  - Channel Islands: a single custom sunset still.
- **Pacific Northwest:**
  - Everett: a boat ramp, with pavement filling about half the frame.
  - Union Bay (UW): this is freshwater Lake Washington, with a stadium and parking lot in front.
  - Hood Canal ramp: a truck and a wall.
  - Oregon Coast Aquarium: a marsh and town, with the bay as a thin band.
- **New England:**
  - Newport RI Sightsailing: dock lines and boats.
  - Cape Cod Canal: a lawn and parking lot, with the canal and bridge in the right half.
  - Portland Head: a roof and rocks. The lighthouse is not in view.

## 2. REMOVE and FIX (with evidence)

The id column holds YouTube ids. The numbers are 1-based positions among the 136 coastal cams in `src/cams.js` order, for cross-reference only. Do not use them as keys.

### REMOVE (14)

| # | Cam | id | Evidence |
|---|---|---|---|
| 24 | Gulf Shores → Fairhope · Coastal SkyCams (rotating) | `3Rp_9FUKH4I` | Frame is **downtown Mobile**: the Alabama Weather Network banner, the I-10 and I-165 interchange, and the port. It is a rotating skycam, not Gulf Shores or Fairhope, and the road dominates. |
| 31 | Oceanside · Pier & surf (Rooftop Bar) | `cvP_F-c2Upw` | On-frame clock reads **08-27-2025**, so the stream is stale by 14 months. The 11-06 audit pulled two other Oceanside cams for being frozen, and this one slipped through. |
| 50 | Pacifica · Sharp Park Beach surf | `lmec_rcEIL4` | On-frame clock **2020-02-09 12:55**. Same operator's Pier close-up shows 2026-11-09, so this one is a dead or frozen stream. |
| 71 | Pacifica · Pier & beach (Chamberlin) | `_-_hg_aJrKU` | Clock **2020-02-09 12:55**. Same as above. |
| 72 | Pacifica · Mori Point (Chamberlin) | `iQ7XJDXYSMo` | Clock **2020-02-11 08:44**. Same as above. |
| 63 | Highlands NJ · Shrewsbury River (Bahrs Landing) | `Str1003ecZU` | Clock **2025-12-18 07:48**, and the frame shows YouTube player chrome. About 11 months stale. |
| 102 | East River · NYC Ferry (E 34th St) | `roEn_E6sMfc` | Clock **2026-11-07 23:04**, two days old and night. The lens is smeared and apartment towers fill the frame, with the river as a strip. |
| 91 | Kohanaiki · Web Camera | `Sb6v9lXIDjc` | A resort lawn with a volleyball net and soccer goal fills about 85% of the frame, and the sea is a strip at the top. It does not show the water. |
| 98 | Beverly · Jubilee Yacht Club (southwest) | `ZlmEdBfHqsM` | A boatyard and storage deck fill the frame, with a sunburst glare. It is a near-duplicate of the other Jubilee dock cam (`5Vf5cSVHtQA`), which is the better view. |
| 114 | Beaufort · Rhumbar waterfront deck | `ATYJsuZqEUU` | The thumbnail is the YouTube **default letter avatar ("R")**, so there is no stream frame at all. Replace it with the Duke Marine Lab cams in section 3. |
| 118 | Dania Beach · Pier | `o1eTLR7Degs` | Frame is sand, palms and the pier railing, with **no water visible**, although the weather overlay is current. |
| 128 | Galveston · Seawall surf cam | `r9PwbZwEFas` | School buses and cars on Seawall Blvd fill the frame, and the Gulf is a thin strip. It looks like a traffic cam. The 11-06 audit pulled another "seawall surf" cam for the same reason. |
| 131 | Galveston · Cruise terminals | `Mnj84qrUbXc` | Frame is a gangway, rigging, a paddle-steamer deck and a terminal wall. **No open water** is visible. |
| 132 | Aransas Pass · Harbor Park | `Mn3vY8bordE` | A parking lot, a monument tower and a road. **No water**. |

### FIX (10)

| # | Cam | id | Problem and fix |
|---|---|---|---|
| 39 | San Juan · Isla Verde beach | `taI7GiyvDxE` | This is the **Royal Sonesta resort cam**. The oEmbed title is "Royal Sonesta San Juan Live Cam", and the frame is the pool and hotel with a beach strip at the top (water under 10%). Rename it "Isla Verde · Royal Sonesta resort" and mark it weak. It is the only Puerto Rico cam, so an honest label matters. |
| 54 | Old Orchard Beach · "Casco Bay coast" | `HSQpqIWLViI` | Old Orchard Beach is on **Saco Bay**, open Atlantic, not Casco Bay. The frame is a summer beach photo from a promo thumbnail. Rename and re-check liveness. |
| 92 | Portland Head Light · Casco Bay | `rArvNLNmhOo` | The lighthouse is **not in frame**: it shows a roof, rocks and open water (weather overlay "Cape Elizabeth"). Rename it "Cape Elizabeth · rocky shore & Casco Bay". |
| 105 | Margate · "Atlantic City skyline cam" | `2MNsMmfdpx8` | Frame is beach and surf with **no skyline**. Rename it "Margate · Beach". |
| 85 | Honolulu Harbor webcam (The Bridge Guy) | `eCHeZDEVSeU` | Clock reads `07/11/2026 12:54:50 SAT`, which is **7 Nov**, two days old. The view is a good harbor with a cruise ship. Re-check whether the stream is stuck. |
| 83 | Ala Moana · Magic Island lagoon ("WOZ ERE") | `y5XS3fMISRk` | Good water view, but the operator is a re-streamer ("WOZ ERE") with a promo thumbnail. Confirm the channel owns or licenses the feed. |
| 84 | Ala Moana · Concessions surf break ("ONLYVIEWS 4K") | `EuR8OkQxOgk` | Same provenance question (an "ONLYVIEWS" re-stream channel, promo thumbnail). Confirm the owner and rights or drop it. Honolulu has plenty of other cams. |
| 109 | Murrells Inlet · Express Watersports dock | `En6HTsRLAAU` | The thumbnail is an **ad slate** (parasailing, jet-ski rentals), not a frame. The 11-06 notes say the operator's real feed is an Ozolio cam (`EQPH00001687`). Confirm what this video shows, or ask for the Ozolio embed. |
| 133 | Corpus Christi · Packery Channel surf cam | `5s6X2045OTs` | The thumbnail is a **logo** (packerysurfcam.com), not a frame. It passes on the operator label ("surf cam"), but it is the only cam serving Port Aransas, so it needs a daylight look. |
| 136 | South Padre · Isla Blanca (South Padre Surf Co) | `0FaRaPPTS8M` | The thumbnail is a **logo**. Same fix as above. South Padre has 3 other cams with live frames. |

## 3. Spots with 0 or 1 cams

`nearestCams()` was run for each of the 96 coastal spots (at most 6 cams, 0.85° near radius, plus the single-nearest fallback out to 1.6°).

**Before: 25 spots have 0 or 1 cams.**

- **0 cams (9):** bath-nc, grand-isle, westport, brookings, juneau, ketchikan, sitka, seward, homer.
- **1 cam (16):** fort-pierce, st-simons, charleston, morehead-city, santa-barbara, san-juan, fajardo, astoria, garibaldi, coos-bay, monterey, humboldt-bay, norwalk, new-haven, whittier, valdez.

**After the REMOVEs** (before adding anything), three more spots lose their good cams:

- **galveston and kemah:** they keep 3 cams, but all three are WEAK, so strong coverage is **0**.
- **port-aransas:** 1 cam, and it is a logo-thumbnail cam.
- **bodega-bay:** drops from 5 to 2.
- **kona:** drops from 2 to 1.
- **Also zero strong cams:** charleston, santa-barbara, san-juan, fajardo and humboldt-bay each have exactly one cam, and it is WEAK or far away.

### Verified replacement candidates

**A. Duke Marine Lab, Beaufort NC** (university IPCamLive, official player). This is the best find. Duke's own pages (`nicholas.duke.edu/marinelab/visiting/webcams`, and `www.ml.duke.edu/webcam/ipcamlive/dock` and `/noaa`) embed them.

| Cam | kind | id | Evidence |
|---|---|---|---|
| Beaufort · Duke Marine Lab dock | ipcamlive | `65777379614e9` | Operator page "Marine Lab Dock Webcam". The player returns an assigned stream (`s100`). The Duke page still for this cam (viewed) shows the Beaufort Channel with a pier, waterfront houses and open water. |
| Beaufort · NOAA CO-OPS tide-gauge cam | ipcamlive | `69a5f2a095c4a` | Operator text: "positioned at the NOAA NOS CO-OPS tide gauge at the Duke University Marine Lab in Beaufort, NC" (CO-OPS/WebCOOS). Stream assigned (`s165`). |

- **Caveat:** snapshot hosts `s*.ipcamlive.com` are outside the sandbox allow-list, so I **did not see a live frame**. That makes these WARN-level until the Run-script workflow and a daylight look confirm them.
- **Use:** use lat 34.718, lon -76.671, `lake: "North Carolina Coast"`. They replace the Rhumbar cam and give morehead-city 2 cams.
- **Bath NC:** the spot is in lake "Pamlico Sound", so it still gets nothing until the region-alias fix in section 4. The cams are 0.73° away.
- Do not use the Algae Ponds or Pilkey Center cams on that Duke page.

**B. USCG bar cams via ODOT TripCheck** (government JPEGs, linked from `weather.gov/pqr/barcams`). They suit `img`.

| Cam | URL | State seen |
|---|---|---|
| Coos Bay · USCG Charleston | `https://tripcheck.com/RoadCams/cams/Coos%20River%20Charleston%20USCG_pid4908.jpg` | Frame stamped **Nov 09 2026 12:56 PM**: jetties and open water. Serves coos-bay, and brookings only through the far fallback. |
| Depoe Bay · USCG | `https://tripcheck.com/RoadCams/cams/Depoe%20Bay%20USCG_pid4906.jpg` | **12:55 PM today**: surf breaking on the rocks and jetty. Serves depoe-bay, newport-or and garibaldi (0.76°). |
| Umpqua River / Winchester Bay · USCG | `https://tripcheck.com/RoadCams/cams/Umpqua%20River%20Winchester%20Bay%20(USCG)_pid4922.jpg` | **12:55 PM today**: jetty and bar. Serves coos-bay (0.3°). |

- **Dimensions and attribution:** the images are small (328x334) and carry a TripCheck banner reading "Camera courtesy of United States Coast Guard".
- **Terms:** check ODOT's hotlink terms, or ask, before shipping.
- **Placeholder trap:** five sibling cams currently serve a **"This image is currently unavailable" placeholder**: Barview Jetty (since Nov 5), Chetco River, Grays Harbor Westport, Siuslaw River and Yaquina Bay (all since Oct 17). They return HTTP 200, `image/jpeg` and a fresh `Last-Modified`, so `check-cams.mjs` `checkImage` would score them **OK**. Do not add these until they show a real frame. Chetco is the only Brookings lead and Grays Harbor Westport is the only Westport lead, so retry them periodically.
- **Pattern for other regions:** NWS publishes the same list at `weather.gov/pqr/barcams`.

**C. Northport Pier ferry cams, Long Island Sound** (YouTube, oEmbed 200, author "Michael Street"; frame overlay reads "Ferry Line, Northport", operator unconfirmed).

| Cam | id | Evidence |
|---|---|---|
| Northport · Ferry dock cam #1 (queue) | `Zot8ShPuuKg` | Frame clock **11/09/26 ~2:59 PM**: harbor water and a pier in the top 45%, with the ferry ramp and lot below. WEAK. |
| Northport · Ferry dock cam #2 | `TXQcLxneF5A` | Clock **11/09/26 2:58 PM**: dock ramp and Sound, with road in the foreground. WEAK. |

- Lat 40.90, lon -73.345, `lake: "Long Island Sound"`. Both are within range of norwalk and new-haven (about 0.5°), which currently share one cam, Rocky Point.
- Add them only as a stopgap, and rank them last.

**D. Verified embeddable, optional extras** (oEmbed 200, frame viewed, but not gap-fillers):

- `o76PCTDyR0Q`: Port of Port Angeles "JWM Main Webcam" (John Wayne Marina). The frame is a full marina basin with boats and water, which is better than most. It is good for port-townsend, but that spot already has 4.
- `gV2Lj_a-IoQ`: Cape May Cove (beach, surf and light). Cape May already has 4.
- `bDwBwOLG_Hw`: a "Newport Yacht Club HarbourCam" with a harbor and jetty frame stamped 2026-11-09. **Location not confirmed**, so do not add it until it is.

**Rejected on viewing:**

- `eTywKp_thcQ`: Sausalito Richardson Bay. A person's legs on a dock fill the frame.
- `mP_GOrhtVD4`: Monterey, a street cam (a fog-bound intersection stamped 2020).
- `vVyBOU9Huvo`: Resorts Casino boardwalk.
- `ceV1NZCTH0o`: a golf course.
- `uK-eZz0w-go`: Pink Shell, a pool.
- `sF5hFDGN20Y`: Sitka. It is EarthCam, which the project bans.
- `DpwTAxPlqBI`: the San Juan Sky Cam on worldcams.tv. oEmbed returns nothing, so it is dead.
- The Visit Folly ids (`3qNcBvNcRt4` and others): promo videos, not streams.

### Spots with no verified embeddable candidate (leads, owner to send outreach)

| Spot | Lead |
|---|---|
| charleston | WebCOOS `nwlon_charleston` (Charleston Harbor, "live") and `folly6thavenue`. The WebCOOS API returns 500 or 404 without auth, and no public JPEG URL was found. Ask `webcoos@secoora.org` for a public image URL. Also the Charleston Branch Pilots pier cam, and Folly Beach Tides Hotel (needs an embed id). |
| fort-pierce, st-simons | No new verified cam found. See the leads in `docs/ops/cams/2026-11-06-coastal-audit.md`. |
| grand-isle | Town of Grand Isle camera page (`townofgrandisle.com/?p=2256`). Not embeddable as found. |
| santa-barbara | City of Santa Barbara Waterfront says its HarborCam stream is "below the Mission Statement". The page HTML I fetched exposes no player or id. Ask the city. |
| monterey | Port of Monterey (Portola Hotel) is on HDOnTap, which is not an allowed embed. No official YouTube or snapshot found. |
| santa-cruz / pillar point | Santa Cruz Harbor serves a signed `hdrelay.io` player. It is not on our approved list, so use it as a link-only candidate or ask the harbor for a YouTube id. |
| san-juan, fajardo | Only the Royal Sonesta cam (already used). No marina cam found. |
| juneau, ketchikan, sitka, seward, homer | No allowed embed found. Sitka's only 24/7 stream is EarthCam (banned). Seward: Alaska Collection and Kenai Fjords Tours publish a harbor image refreshed every 5 minutes, but no direct URL is exposed, so ask. Homer: only HDOnTap and Windfinder. Juneau: UAS Auke Bay cell-tower cam (university) and FAA weathercams are worth an ask. |

### After applying every change above

Removing the 14 REMOVEs and adding Duke x2, USCG x3 and Northport x2 leaves **23 spots with 0 or 1 cams**, down from 25. Of those, only fort-pierce, st-simons, charleston, santa-barbara, monterey, humboldt-bay, san-juan, fajardo, westport, astoria, garibaldi, brookings, grand-isle, the five Alaska spots and bath-nc remain truly short.

The bigger win is structural. See "Cross-region visibility" below. Adding `lakes` aliases would give about 8 of these spots a nearby cam with no new feeds.

## 4. Systemic suggestions for the cam program

### Cross-region visibility (biggest structural gap)

`nearestCams()` filters on an exact `lake` string, so a cam only serves spots in its own region. That hides good, close cams. Examples from the data (distance in degrees):

- **pensacola** (Florida Gulf) cannot see Orange Beach (0.37°), Perdido Key (0.26°) or Fairhope. It shows 3 cams while 5 sit next door.
- **bath-nc** (Pamlico Sound) cannot see Beaufort (0.73°). That is why Pamlico Sound has 0 cams.
- **norwalk** (Long Island Sound) cannot see the NY Harbor cams (0.55°).
- The **San Francisco Bay** spots cannot see the 6 Pacifica and Point Reyes cams (0.22 to 0.30°).
- **half-moon-bay** cannot see the SF Bay cams (0.33°).
- **port-townsend and anacortes** cannot see the Puget Sound cams (0.49 to 0.84°).
- **everett** cannot see the Friday Harbor and Bellingham cams.
- **westport** (Washington Coast) cannot see the Hood Canal cams (0.82°). Those are not good, but the pattern holds.
- **key-largo** cannot see the two Miami cams (0.73°).

Fix: let `nearestCams` match a region's `neighbors` list, or drop the lake filter for coastal regions and rely on distance. A coastal spot can still need a lake filter, for example Lake Washington versus Puget Sound.

### Data-model fields (additions to the cam object)

- `id`: a stable key. Admin "disabled" entries are keyed by `name` today, so every rename silently re-enables a cam (the Great Lakes audit noted this too).
- `verified`: `"YYYY-MM-DD"` of the last visual check, plus `seen: "frame" | "label"`. Today the file header claims "all entries are verified live", which is not true: 35 of 136 coastal cams have no real frame. Show the date in `/admin`.
- `view`: a short operator-confirmed text ("Beaufort Channel from Duke dock"). It makes drift obvious (Rhumbar, Old Orchard, Portland Head).
- `quality`: `"strong" | "weak"`. `nearestCams` should sort strong first and hide weak cams when 3 or more strong ones exist.
- `seasonal`: `{ months: [5..10] }`, or `"rotating"`. It is needed for Valdez (rotating), Alaska generally, and boat-mounted cams (the Little Traverse ferry). Outside the season the UI should say so honestly.
- `operator` and `source` (the official page) so the "identifiable operator" rule can be audited. Several current cams are re-streams ("WOZ ERE", "ONLYVIEWS", StreamTime).
- `lakes: []` for secondary regions, as above.
- `lat/lon`: use the view's location, not the town. Most Galveston, Pacifica and Deerfield cams share one point, which makes distance ranking meaningless.

### Health check (`cam-health`)

1. **The workflow is disabled.** `gh workflow list --all` shows `Cam health  disabled_inactivity` (id 302303941). GitHub turns off scheduled workflows after 60 days of repo inactivity. The last scheduled run was 2026-09-21 (success, 15 s). The owner can re-enable it with `gh workflow enable 302303941`. I did not. Add a small keep-alive, because a weekly cron is the very thing GitHub disables.
2. **"Success" meant nothing for YouTube.** The 2026-09-21 run printed about 17 `YouTube bot-wall — can't verify` WARNs and passed. It reported Harbor Springs Steeple as WARN, though its oEmbed is 404 today. A run that cannot check YouTube still goes green.
3. **429 is scored DEAD.** In `scripts/check-cams.mjs` `checkYouTube`, `if (!res.ok) return DEAD "watch HTTP ..."` fires on the 429 bot-wall. From this proxy or a datacenter IP, every YouTube cam would read DEAD. The report tool's first branch is wrong. Treat 429, 403 and 5xx as UNKNOWN, not DEAD, and do not retry in a loop. Do not spoof headers to get around it.
4. **Use the official API.** Replace the watch-page scrape with YouTube Data API v3 `videos.list?part=status,liveStreamingDetails&id=<50 ids>`. It costs 1 quota unit per 50 ids, so one call covers all coastal cams. `status.embeddable`, `liveStreamingDetails.actualEndTime` (ended) and `concurrentViewers` (live) give a real live verdict. It needs an API key stored as a repo secret, which the owner must create.
5. **Detect frozen cams without scraping.** Store the md5 of each cam's thumbnail or JPEG per run (an artifact or KV). Flag STALE if it is byte-identical for 14 days. This would have caught the 2020-dated Pacifica cams and the Highlands cam.
6. **Image checks need content checks.** `checkImage` accepts any `image/*` 200. The TripCheck "unavailable" placeholder passes, and so would a dead NOAA tile. Require a `Last-Modified` age under 6 hours, a minimum size, and a hash that is not a known placeholder.
7. **Node and proxy.** In this sandbox, `fetch` ignores the proxy unless `NODE_USE_ENV_PROXY=1` is set. The headers of `check-cams.mjs` and `verify-cam-candidates.mjs` still say "the sandbox has no outbound network". Update both comments and add `NODE_USE_ENV_PROXY=1` to the docs. IPCamLive snapshot hosts (`s*.ipcamlive.com`) and Angelcam, WetMet and Ozolio frames are still unreachable from here, so those stay label-only.

### Curation rules to adopt

1. **A frame or a label, recorded.** Add a cam only after seeing a frame (record the date and the on-frame clock), or after an operator label names a water place. Promo or logo slates are "label" only, and they get `seen: "label"`.
2. **Water share.** If water is under about 40% of the frame, mark it weak. If it is under about 15% (Sea Pines, Surfside, Isla Verde), do not ship it where a better cam exists. A pool, a lawn and a parking lot are not water views.
3. **No rotating or re-streamed skycams.** The Mobile "Coastal SkyCams" shows I-10. The rule should also cover city "skyline" names ("Atlantic City skyline cam", "Boston skyline" and so on). Reject if the name and the frame disagree.
4. **Cap near-duplicates.** Max 2 cams per operator per spot, and drop twins (Beverly x2, Deerfield x2, Sea Isle x2, Wrightsville N/S, Waikiki x3, Galveston x5). Honolulu has 6 near-identical Waikiki and Ala Moana cams while Kona has 1.
5. **Stale = removed.** Any on-frame clock older than 30 days is a REMOVE. Re-audit every 90 days (the next one is due about 2027-02).
6. **Names must match the view.** Name by what the cam shows (Isla Verde, Old Orchard Beach, Portland Head), as in the Great Lakes audit. Do not use the host's name, a nearby city, or the cruise skyline.
7. **Freshwater vs salt:** mark Lake Washington (Union Bay) as a lake cam. It sits under "Puget Sound", but a boater reading it for the Sound will be misled.
8. **Copy:** cam labels and the Windy fallback are context only. Never imply safety from a cam view.

### Other gaps to flag

- **Chesapeake** has one spot (middle-river) and 2 cams. Annapolis, Norfolk, Ocean City MD and Solomons have no spots at all, so it is a coverage hole, not a cam problem.
- **Hawaii** has 14 cams for 3 spots, but only 1 for Kona and none for Kauai or Hilo. Rebalance by trimming Waikiki duplicates and finding a Kona or Hilo cam.
- **Alaska:** 1 cam (Valdez harbor, rotating). 7 Alaska spots, and every one of them is empty or single-cam.
- **FIX list in the UI:** `Cams.jsx` hides ended streams, but it cannot hide a frozen thumbnail, a placeholder, or a re-streamer. The server-side stale check above is the only defence for those.

## 5. Suggested order of work

1. Owner re-enables `cam-health` (`gh workflow enable 302303941`) and fixes the 429 mapping in `checkYouTube`.
2. Apply the 14 REMOVEs and the 10 FIXes (names, then verification).
3. Add Duke x2 (after a daylight look), USCG Coos, Depoe Bay and Umpqua (after an ODOT terms check), and the Northport pair as last-rank stopgaps.
4. Add `lakes` aliases to `nearestCams` so existing cams reach nearby spots.
5. Draft outreach emails (owner sends) to WebCOOS/SECOORA, the City of Santa Barbara, Santa Cruz Harbor, Kenai Fjords Tours, and the Express Watersports (Murrells Inlet) Ozolio owner.

## 6. Applied 2026-11-09

Edited `src/cams.js` (non-Great Lakes `CAMS` entries and `LINK_CAMS` only; Great Lakes entries and every function below the arrays are byte-identical). Coastal cams went from 136 to 103 (total list 161).

**Removed (38 entries):**
- All 14 REMOVEs.
- 22 WEAK cams, where the spot keeps other cams: Sombrero Beach, Marathon Sunset Grille, Frenchy's, Fort Lauderdale PTZtv, both Fort Myers Beach cams, Galveston Yacht Basin and Ship Channel, South Padre Sand Rose and Queen Isabella, Fairhope, Sea Pines, Surfside Pier, Pacifica Pier close-up, Angel Island, Channel Islands Harbor, Everett, Union Bay, Hood Canal ramp, Oregon Coast Aquarium, Newport RI Sightsailing and Cape Cod Canal.
- 2 FIX cams that could not be re-verified: Honolulu Harbor (frame clock still stuck on 7 Nov) and Concessions surf break (personal channel, rights unconfirmed). Honolulu keeps 5+ other cams.

**Kept WEAK because the spot would have 0 cams:** Galveston ABC13 (galveston, kemah), Trinidad Bay (humboldt-bay), Isla Verde Royal Sonesta (san-juan, fajardo).

**Renamed (FIX):** Isla Verde · Royal Sonesta resort, Old Orchard Beach · Saco Bay (Abellona Inn), Cape Elizabeth · rocky shore & Casco Bay, Margate · Beach. Comments added on Magic Island (WOZ ERE), Murrells Inlet, Packery and Isla Blanca (label-only, thumbnail is a logo or slate).

**Added (5):** USCG Coos Bay, Depoe Bay and Winchester Bay (Umpqua) via ODOT TripCheck JPEGs. Real frames stamped 2026-11-09 1:04-1:07 PM, 19-25 KB, against about 15.8-16.2 KB for the "This image is currently unavailable" placeholder. Plus the two Northport ferry-dock cams (WEAK stopgaps for norwalk and new-haven; oEmbed 200, "NORTHPORT PIER FERRY DOCK CAMERA #1/#2", author Michael Street).

**New `LINK_CAMS`:** Oregon Coast (NWS Portland bar cams), Southcentral Alaska (Alaska Collection). All URLs returned 200.

**Coverage (0-1 cam spots):** 25 before, 34 after (8 with 0, 26 with 1). The rise is the WEAK/REMOVE drops: marco-island, naples, fort-myers-beach, biloxi, galveston, kemah, port-aransas, tybee, hilton-head, kona, everett, bodega-bay now sit at 1. They are not at 0, per the keep rule. brookings went 0 to 1 via the far (1.3 degree) fallback to Coos Bay.

**Still open:**
- **Duke Marine Lab (Beaufort):** not added. The IPCamLive snapshot hosts returned 404 from here, so no real frame was seen. Needs the Run-script workflow and a daylight look.
- **Placeholder USCG cams:** Barview, Chetco (brookings), Grays Harbor Westport (westport), Siuslaw and Yaquina Bay still serve the placeholder. Retry periodically.
- **ODOT hotlink terms:** unchecked for the three TripCheck JPEGs. Check before shipping.
- **No allowed embed found:** fort-pierce (Visit St. Lucie jetty cams are down and use VistaWebCams, not on the approved list), charleston (WebCOOS has no public JPEG; the Pelicam is a bird cam), st-simons, grand-isle, santa-barbara (NPS Anacapa is an explore.org video), monterey, the Alaska spots, san-juan and fajardo. Outreach drafts are still to be written.
- **Unverified liveness:** Old Orchard (promo still), Murrells Inlet, Packery and Isla Blanca are label-only. WOZ ERE provenance unconfirmed.
- **Program fixes** (section 4: `lakes` aliases, data-model fields, the `cam-health` workflow and 429 mapping) are not touched here.
- The file header still says "All entries are verified live", which is untrue for label-only cams. It is outside the scope of this pass.
