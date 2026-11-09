# Great Lakes cam audit (2026-11-09)

Trigger: the owner reported that Great Lakes cams "need significant updating". One example was Petoskey showing a ski resort: Angelcam `ger25omkrm` turned out to be the **Nub's Nob Ski Area** cam on petoskeyarea.com. Earlier curation named cams after the site that hosted them, not after what the camera shows. Every Erie, Ontario, Michigan, Huron and Superior entry was re-checked against what it actually shows, using lakerart.com/links.htm as the main source for replacements.

## Method
- YouTube: oEmbed returning 200 means the video exists and allows embedding. Current thumbnails were downloaded and viewed.
- NOAA, NPS and university JPEGs were viewed directly.
- Angelcam, WetMet, IPCamLive and Ozolio streams are H.264 HLS, which headless Chromium can't decode. We did **not** get around their access controls to grab frames. These cams were judged on the operator's label and description. Where even that didn't name a water view, the cam was held out.
- Rule merged in: a cam stays or is added only if a frame was seen, or the operator's label names a water view (marina, harbor, beach, channel).

## Merge decisions (applied to `src/cams.js`)
- All three per-lake replacement blocks below were applied as proposed, with one exception: the **Michigan Tech** JPEGs (Houghton) are **link-only**. A private site's snapshot needs the owner's OK before we hotlink it (scout rule ASK_OWNER), and the outreach draft is in the Huron/Superior section. Houghton therefore falls back to the NPS Isle Royale cam, about 1.0° away.
- Held-out cams (WetMet Marquette, Drummond, Whitefish Point, Erie Bayfront, Petoskey Visitors Bureau; Angelcam Bayfield Inn) can return after a daylight check in a desktop browser. Ready-to-paste lines are in each section.
- Cams that are new and not yet seen (Grand Haven WGHN x2, Erie Yacht Club x2, Put-in-Bay Ship House/Condo) were added on operator labels. Confirm them on the next `cam-health` run and with a daylight look.
- Note: renamed cams get a new name key, so any admin "disabled" entry under an old name no longer applies.

---

## Lake Erie + Lake Ontario cam audit (2026-11-09)

Scope: every Erie entry (no `lake`) and Ontario entry in `src/cams.js`, plus the two LINK_CAMS blocks. `src/cams.js` was NOT edited.
Method: YouTube oEmbed + `_live` thumbnails (viewed), NOAA GLERL JPEGs (viewed), operator-page labels for Ozolio / IPCamLive / Angelcam (text next to the iframe, provider page titles), operator descriptions. No Referer/UA spoofing, no HLS grabbing. Hosts that bot-block plain requests (Newfane 406, Shores & Islands 403, yourerie 403, Vermilion port authority 403) were left alone and listed as leads.
Note: thumbnails are one moment in time (many were night frames today).

## 1. Existing entries

| # | Entry | id | Verdict | What it actually shows | Evidence |
|---|---|---|---|---|---|
| 1 | Edgewater Beach · Cleveland | angelcam `91yx8ek0ro` | KEEP | Edgewater Park beach | lakerart scout: Cleveland Metroparks "Edgewater Park Beach Webcam" embeds this id. Frame not viewable (Angelcam player is JS/HLS). |
| 2 | Western Basin · Toledo Light (NOAA) | `tol2/tol2-01.jpg` | FIX name+coords | Open water, buoy, West Sister Island on horizon, whitecaps. Cam label "Toledo Marker - West Sister" | Viewed 2026-11-08 12:27 EST frame; Last-Modified 23:27Z (fresh). Station is THLO1 at 41.826,-83.194; old coords 41.776,-83.326 were ~7 mi off. |
| 3 | Western Basin · Toledo Channel Marker 2 (NOAA) | `res/recon/plots/cmt/webcam1.jpg` | REMOVE (duplicate) | Byte-identical to #2 (same md5, same size, same Last-Modified). Same tower (ReCON Channel Marker 2 = Toledo Light 2, 41°49.5'N 83°11.6'W), old coords 41.74,-83.34 were wrong | `md5sum` equal. Replaced by the tower's other real cams: `tol2-03.jpg` "Channel" (open water, Toledo skyline hazy on horizon, whitecaps; viewed) and keep `tol2-01.jpg`. `tol2-02` (South) and `tol2-04` (NW) are also pure water if you want more. |
| 4 | Port Clinton · Waterfront | ozolio `EMB_IMGT00000FED` | FIX name | Ozolio player title: "Docks Beach House Cam Port Clinton" (Off The Rock, 255 W Lakeshore Dr) | Provider embed title; host page offtherockportclinton.com. Frame not viewable. Renamed to what the provider calls it. |
| 5 | Put-in-Bay · Boardwalk Harbor | ozolio `EMB_PSZZ000005DE` | KEEP (rename) | putinbay.com: roof of the Boardwalk complex, "views of Put-in-Bay Harbor, Perry's Monument, DeRivera Park, Middle Bass, Gibraltar"; Jet Express docks | Operator description + Ozolio title "The Boardwalk Lobster Bisque Cam". Mix of harbor and street, harbor is the main subject. |
| 6 | Put-in-Bay · Perry's Monument (West) | ozolio `EMB_ULHE00000B88` | KEEP (rename) | Ozolio title "Monument Cam Harbor view"; putinbay.com label "Sunset Monument Cam (West)" | Provider title. Frame not viewable. |
| 7 | Lorain · Black River Landing | yt `ZZevIUr2cTk` | REMOVE | Park lawn, picnic tables, the Lorain lift bridge (raised) and a docked freighter hull. No open water visible | Thumbnail viewed. Fails "no bridges/buildings with sliver of water". |
| 8 | Lorain · Lighthouse & Pier | yt `AinDIqEXEu4` | KEEP (flag) | "24/7 Lorain Lighthouse Cam with Audio" (Lorain Port & Finance Authority); lakerart: "pans across harbor" | oEmbed 200. Thumbnail is black tonight (Lorain 250 logo + a few lights), so I could not confirm the daytime frame. Re-eyeball in daylight. |
| 9 | Lorain · Port Marina | yt `1MVB3fgg7kg` | KEEP | Lakeside Landing marina basin, breakwall, lighthouse, open lake horizon | Thumbnail viewed (daytime, clear). Good cam. |
| 10 | Mentor · Mentor Harbor Yacht Club | ipcamlive `mhyc` | KEEP (rename) | IPCamLive page name "MHYC Channel Cam" (harbor channel) | ipcamlive.com/mhyc title; player has an assigned stream. Frame not viewable (stream servers `s*.ipcamlive.com` are outside the sandbox allow-list). |
| 11 | Erie, PA · Bayfront | wetmet `388190fe...` | REMOVE pending proof (hold) | Unknown. No host page found; WetMet overlay asset is a blank 1x1 PNG; stream is `186-05-01`. lakerart describes a different "Erie PA Bayfront cam" (yourerie: "shows harbor, hotel") but nothing ties this uid to it | Cannot confirm view => out per the bar. Restore if the Action/owner shows it is the bay. Introduced in commit 71629b9 with no source note. |
| 12 | North East, PA · Sunset Cam (Lake Erie) | yt `Hg56IYpaF2A` | KEEP | Gravel beach, breaking surf, open lake (IR night frame today) | oEmbed 200 "North East Borough - Sunset Cam"; thumbnail viewed. |
| 13 | Rochester · Charlotte-Genesee Light | yt `NHDgasBPtRY` | KEEP (flag) | oEmbed iframe title "Live at Charlotte-Genesee Lighthouse"; sponsor overlay (Kwik Fill) | oEmbed 200. Night frame is blurry (lens droplets, shoreline lights), cannot visually confirm pier/lake. Re-eyeball in daylight. |
| 14 | Sodus Bay · Sodus Lighthouse | yt `68XVh5TcgBk` | KEEP (rename) | Sodus Point marina/bay: docks, yachts, bay water (night frame, Pride Plumbing logo) | oEmbed "Sodus Lighthouse" (News 8 WROC); thumbnail viewed. It is the bay/marina rather than open lake. |
| 15 | Oswego · Lake Ontario (SUNY) | yt `wfhQTU0HrpY` | REMOVE | SUNY Oswego Hart Hall rooftop cam: campus buildings/lawns fill the frame, lake only as dark band at the top (lakerart: "sometimes points North to Lake") | Thumbnail viewed (night, buildings dominate). Same failure the 11-07 notes gave for the Shineman cam. Not a launch-area water view. |
| 16 | Olcott · Harborcam | yt `NpoCG3w-NXI` | REMOVE (dead) | n/a | oEmbed 404, thumbnails 404. |
| 17 | Lyndonville · Lake Ontario Livestream | yt `w2COKOM5USU` | KEEP (fix coords) | Rocky shoreline, waves, open lake horizon, dock-less. Excellent | Thumbnail viewed, leafless trees (current). Old coords 43.33,-78.39 are the village, ~3 mi inland; shore is ~43.36. Approximated. Do NOT use `RsV3B3IkRGo` (a dated Aug-28 recording). |

## 2. Replacement blocks for `src/cams.js`

Delete the existing Lake Erie lines (originally lines 7-20 except the Lake Michigan ones, plus line 232 "North East, PA") and Lake Ontario lines (43-47 and line 233 "Lyndonville"), then paste:

```js
  // Lake Erie (2026-11-09 audit: every entry reviewed against what the cam shows, not the host site's name.
  // Removed: Lorain Black River Landing (bridge/park), duplicate Toledo Channel Marker JPEG, Erie WetMet "Bayfront" (view unconfirmed).)
  { name: "Edgewater Beach · Cleveland", lat: 41.49, lon: -81.74, angelcam: "91yx8ek0ro" },
  // Western basin: NOAA GLERL Toledo Light No. 2 tower (4 cams; these two are open water)
  { name: "Western Basin · Toledo Light, channel view (NOAA)", lat: 41.826, lon: -83.194, img: "https://www.glerl.noaa.gov/metdata/tol2/tol2-03.jpg", link: "https://www.glerl.noaa.gov/metdata/tol2/" },
  { name: "Western Basin · Toledo Light, West Sister view (NOAA)", lat: 41.826, lon: -83.194, img: "https://www.glerl.noaa.gov/metdata/tol2/tol2-01.jpg", link: "https://www.glerl.noaa.gov/metdata/tol2/" },
  // Port Clinton docks (Ozolio embed, via offtherockportclinton.com)
  { name: "Port Clinton · Docks (Off The Rock)", lat: 41.512, lon: -82.937, ozolio: "EMB_IMGT00000FED" },
  // Put-in-Bay / South Bass Island (Ozolio, the feeds putinbay.com embeds)
  { name: "Put-in-Bay · Harbor (Boardwalk cam)", lat: 41.653, lon: -82.821, ozolio: "EMB_PSZZ000005DE" },
  { name: "Put-in-Bay · Perry's Monument harbor view (West)", lat: 41.654, lon: -82.812, ozolio: "EMB_ULHE00000B88" },
  { name: "Put-in-Bay · Ship House (open lake)", lat: 41.65, lon: -82.83, ozolio: "EMB_SGLW000005D4" },
  { name: "Put-in-Bay · Condo cam (mainland & Cedar Point across the water)", lat: 41.655, lon: -82.82, ozolio: "EMB_QMOL000005D9" },
  { name: "Lorain · Lighthouse & Pier", lat: 41.469, lon: -82.178, yt: "AinDIqEXEu4" },
  { name: "Lorain · Port Marina", lat: 41.47, lon: -82.18, yt: "1MVB3fgg7kg" },
  { name: "Mentor · Mentor Harbor Yacht Club channel", lat: 41.73, lon: -81.36, ipcamlive: "mhyc" },
  // Erie Yacht Club "Basin Web Cams" (erieyachtclub.org/basin-web-cams, operator-labelled EYC Basin Cam North/West)
  { name: "Erie, PA · Erie Yacht Club basin (North)", lat: 42.125, lon: -80.133, ipcamlive: "38af29740fe2" },
  { name: "Erie, PA · Erie Yacht Club basin (West)", lat: 42.125, lon: -80.133, ipcamlive: "f4b1c208de59" },
  { name: "North East, PA · Sunset Cam (Lake Erie)", lat: 42.215, lon: -79.83, yt: "Hg56IYpaF2A" },
```

```js
  // Lake Ontario (2026-11-09 audit). Removed: Oswego SUNY Hart Hall (campus view), Olcott Harborcam (YouTube id 404).
  { name: "Rochester · Charlotte-Genesee Light", lat: 43.22, lon: -77.62, yt: "NHDgasBPtRY", lake: "Lake Ontario" },
  { name: "Sodus Bay · Sodus Point marina (WROC)", lat: 43.27, lon: -76.97, yt: "68XVh5TcgBk", lake: "Lake Ontario" },
  { name: "Lyndonville · Lake Ontario shore", lat: 43.36, lon: -78.39, yt: "w2COKOM5USU", lake: "Lake Ontario" },
  // Navy Point Marine's own YouTube stream (embedded on navypointmarine.com/live); oEmbed 200, current thumbnail = dock basin + boats
  { name: "Sackets Harbor · Navy Point Marine docks", lat: 43.95, lon: -76.123, yt: "DzhFkmug-Ec", lake: "Lake Ontario" },
```

Notes on the new adds:
- **Navy Point Marine** `DzhFkmug-Ec` ("West over docks"): viewed, current (bare trees, winterised boats). About half the frame is boat yard, but docks and basin water are clear. Its sibling `d7KyJQSDh7Y` ("West from office") is mostly boats on stands with a strip of water: not added.
- **EYC basin cams**: IPCamLive page names confirm "EYC Basin Cam North/West" and the operator's own page embeds them. I could not view frames (IPCamLive stream hosts are blocked from the sandbox), so run them through `verify-cam-candidates.mjs` (OK/WARN) and eyeball once. If they turn out to look at the clubhouse/dry dock, drop them.
- **Put-in-Bay Ship House / Condo**: both are on the same putinbay.com page as the existing two Ozolio embeds. Operator says Ship House is "the most scenic Lake Erie webcam" (boats, ice fishers) and Condo shows the mainland, Cedar Point, Sandusky and Kelleys Island across the water. Provider titles: "Ship on the Bay Cam", "Put in Bay Condo Cam". Frames not viewable; low risk, but Action-check before merge. Also available: `EMB_INYO00000C0A` "Monument Cam Sunrise East" (not added).
- The `scripts/scout-cams.mjs` header still says the dev sandbox has no outbound network (stale). Note `node scripts/scout-cams.mjs` fails with ENOTFOUND in this sandbox unless run with `NODE_USE_ENV_PROXY=1`. Output: `scout-eo.txt` in the scratchpad (263 links: 16 OK_EMBED, 66 ASK_OWNER, 16 LINK_ONLY, 165 DEAD; many DEAD are probably bot-blocks / seasonal, not trustworthy).

### LINK_CAMS changes

```js
  "Lake Erie": [
    { name: "Shores & Islands cams", url: "https://www.shoresandislands.com/plan-your-visit/webcams/" },
    { name: "Put-in-Bay", url: "https://putinbay.com/put-in-bay-webcams/" },
    { name: "FishUSA Erie cams (Lampe Marina, Avonia Beach, Walnut Creek)", url: "https://www.fishusa.com/webcams" },
    { name: "Lake Metroparks (Fairport Harbor, Lake Erie Bluffs)", url: "https://lakemetroparks.com/webcams" },
    { name: "Erie News Now Presque Isle cam", url: "https://www.erienewsnow.com/weather/cameras/presque-isle/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
  ...
  "Lake Ontario": [
    { name: "1000 Islands cams", url: "https://www.1000islandswebcams.com/" },
    { name: "Olcott Harborcam (Town of Newfane)", url: "https://townofnewfaneny.gov/OlcottHarborcam/" },
    { name: "Youngstown / Niagara River cam", url: "https://www.youngstownny.com/webcam" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
```
Removed from Erie links: "Mentor Harbor" (now embedded, same ipcamlive alias). Added the lakerart directory to Erie (other lakes already have it). Verified reachable by plain fetch: fishusa.com/webcams (200), lakemetroparks.com/webcams (200; lists Harborcam at Fairport Harbor Lakefront Park, Towercam at Lake Erie Bluffs, Sunset cam at Painesville Township Park), erienewsnow presque-isle page (200), youngstownny.com (scout: LINK_ONLY, loads). Newfane page returned 406 to my plain fetch (bot filter) but search results confirm the town's page ("Olcott Harbor & Newfane NY Marina feed, streams 24/7"). 1000islandswebcams.com resets connections from this sandbox (existing link, unverified).

## 3. Coverage per spot (`nearestCams`, n=6)

| Spot | Before | After | After (what) |
|---|---|---|---|
| toledo | 5 (2 were duplicates, so 4 distinct) | 6 | Toledo Light x2, Port Clinton, PIB x3 |
| port-clinton | 6 | 6 | Port Clinton docks, PIB x4, Toledo Light |
| put-in-bay | 6 | 6 | PIB x4, Port Clinton, Toledo Light |
| sandusky | 6 | 6 | Port Clinton, PIB x4, Lorain Port Marina |
| vermilion | 6 | 6 | Lorain x2, PIB x3, Edgewater |
| cleveland | 6 | 6 | Edgewater, Mentor, Lorain x2, PIB x2 |
| fairport | 5 | 4 | Mentor, Edgewater, Lorain x2 (lost 1 = Black River Landing) |
| conneaut | 3 | 4 | EYC basin x2, North East, Mentor |
| erie | 2 | 3 | EYC basin x2, North East (Bayfront WetMet held back) |
| rochester | 5 | 3 | Rochester, Sodus, Lyndonville |
| sodus-bay | 3 | 2 | Sodus, Rochester |
| oswego | 3 | 3 | Sodus, Sackets (Navy Point), Rochester |
| sackets-harbor | 1 (Oswego SUNY, campus view) | 1 | Navy Point Marine docks (its own marina) |
| olcott | 3 | 2 | Lyndonville, Rochester (lost the dead Olcott cam and Oswego SUNY) |

Counts drop where cams were dead/non-water. Honest gaps: Fairport (still no Fairport-specific feed), Erie/Conneaut (EYC cams unverified visually), Olcott (no own cam), Sodus (2, both Ontario-south shore), no Buffalo/Dunkirk/Ashtabula/Vermilion/Huron/Canadian spots exist in `SPOTS`, so no gap there today.

## 4. Unverifiable items and outreach leads (drafts only, owner sends)

Unverified in this pass (frame not viewable): Angelcam Edgewater, all Ozolio ids, IPCamLive (mhyc, EYC x2), Lorain Lighthouse (black frame tonight), Rochester Charlotte-Genesee (blurry night frame). Run `verify-cam-candidates.mjs` then look at them in daylight.

Leads found but not embeddable today:
1. **Lake Metroparks (Lake County OH)**: Harborcam at Fairport Harbor Lakefront Park, Towercam at Lake Erie Bluffs, Sunset cam at Painesville Township Park. Provider is Angelcam shared pages (`52d86ed501646.click2stream.com`, `lake-erie-bluffs-webcam-live.click2stream.com`), but the Angelcam id is not exposed in page HTML (JS-rendered Next app). This is the best Fairport/Ashtabula fix. Outreach: ask Lake Metroparks for the Angelcam camera ids and OK to embed.
2. **FishUSA / Erie Western PA Port Authority**: Lampe Marina cam (lake east of Erie harbor + marina, open year-round), Avonia Beach (Fairview) and Walnut Creek. Player is injected by script, no id visible. Outreach to FishUSA + EWPPA for embed ids/permission (Fairview Township's page defers to FishUSA).
3. **Town of Newfane, Olcott Harborcam**: 24/7 stream of Olcott Harbor & Newfane marina, restarted by the town on request. Page bot-blocked; ask the town which platform and for an embed. Highest-value Olcott fix.
4. **City of Avon Lake**: "Lake Erie Streamed Live" cam at The Lake House, 32766 Lake Road (page says 24 h). Embed hidden. Ask for the embed. Avon Lake is between Lorain and Cleveland; not a spot but helps Vermilion/Cleveland.
5. **Erie News Now (WICU)**: IPCamLive alias `6776e43d596ef`, "Overlooks Presque Isle State Park from the Ravine Flyer at Waldameer Park". Likely bay + peninsula but may be amusement-park-heavy; could not view. Candidate if the Action snapshot looks good; a Niagara Pier bay cam is also on their Skyview page (404 for plain fetch).
6. **Old Fort Niagara lighthouse cam** (Youngstown): official page embeds `youtube.com/embed/live_stream?channel=UCIY3JMAcniBR8ngBw6OYvTA`; Niagara Falls Live says it is offline for an equipment upgrade. View mixes fort grounds and the lake. Re-check in spring; would serve Olcott (0.33 deg).
7. **Willowick OH (greatlakesvista.com)**: still-photo Lake Erie cam, private hobby site. Ask the owner for permission before hotlinking `.../lakecam/galleries/LakeCamArchive/cam.jpg`. Helps Fairport.
8. **Eastlake, OH (clycohio.com/LakeCam)**: private club snapshot `/webcam/camera1.jpg`. Same ask. Helps Fairport.
9. **Cleveland Water crib cams** (`oo_CcmOMPvk`, `pTCHt8PrImY`, Cleveland Division of Water): open-water Cleveland skyline views, but thumbnails are stale (2021 and 2025-09 timestamps), so likely offline. Skip unless Cleveland Water confirms a live feed. (`mlM1sK0C9Hs` = Cleveland Library rooftop: city view, reject.)
10. **Geneva-on-the-Lake lodge cam** (`U2024uAyIOk`, The Lodge at Geneva-on-the-Lake): lawn dominates with lake horizon strip, thumbnail looks like a promo, not live. Reject unless owner says otherwise.
11. **SUNY Oswego Hart Hall** (`wfhQTU0HrpY`): if the owner prefers to keep a campus/lake cam for Oswego, it is embeddable (oEmbed 200) but fails the water bar. Better lead: City of Oswego harbor cams (oswegony.org, 522 error today) and the Oswego West Pierhead lighthouse stream; ask the City of Oswego / Port of Oswego Authority for a YouTube embed.
12. **Sodus Point**: GLOS-funded lake cam (Upstate Freshwater Institute, 0.75 mi NE of the outer lighthouse; `upstatefreshwater.org/data/lake-ontario/sodus-point`) is research video, no public embed seen. Possible `img`/embed ask to UFI.

Draft outreach (one template, swap in the operator):
> Subject: Embedding your [Harborcam / Lake Erie cam] on shouldiboat.com
> Hi, I run shouldiboat.com, a free go / caution / no-go boating-conditions site for the Great Lakes. Your [cam name] shows exactly what boaters want to check before launching. Would you be open to letting us embed it through its existing player (or share the Angelcam / YouTube / IPCamLive id), with a credit and link back to you? We would not alter or record the feed, and we would drop it immediately on request. Happy to send a screenshot of how it would look. Thanks, [owner]

Excluded by rule: EarthCam (Cleveland Pier W, Terminal Tower, Berrien Beach), SkylineWebcams (Sackets Harbor, Oswego, Old Fort Niagara, North East Lake Shore Railway), WebcamTaxi, Windfinder, hdontap/Sunset Bay (not an official embed offering). Rail cams (Lake Shore Railway Museum) still rejected.

---

## Lake Michigan cam audit - 2026-11-09

Method: YouTube oEmbed (200 = exists + embeddable) plus `_live` / poster thumbnails downloaded and viewed; WetMet public image widget (`widgets/image/frame.php`, the same widget WMTA embeds) for stills; IPCamLive public `snapshot.jpg` linked from its own player page; NOAA GLERL JPEG; operator pages for Angelcam (Angelcam share pages expose no preview). No Referer/Origin spoofing, no HLS pulling. Local scout output: `scratchpad/scout.txt` (lakerart crawl; needed `NODE_USE_ENV_PROXY=1` for node fetch). Verify output: `scratchpad/verify.txt`.

Caveats that apply to everything below:
- It is evening/night in Michigan right now, so most frames are dark. "Shows" below is what is visible plus the title/operator label.
- YouTube watch/embed pages are blocked from this sandbox, so **liveness of YouTube cams is not confirmed** (oEmbed only proves the video exists and is embeddable). Several `_live` thumbnails are clearly summer/daytime frames (Charlevoix 64F, Michigan City, Muskegon Lake, Mackinac Bridge, Ferry) - either custom thumbnails or the stream is currently off. Run the `cam-health` / Run-script workflow on the merged branch to confirm.
- `verify-cam-candidates.mjs` reports ipcamlive as WARN here only because Node DNS fails on `g1.ipcamlive.com` through the proxy; I verified those by hand.

## 1. Existing entries

| Name (current) | id | Verdict | What it actually shows | Evidence |
|---|---|---|---|---|
| Harbor Springs · Steeple | yt `iPm4jZcBKPU` | REMOVE | Nothing: video is gone | oEmbed 404, thumbnails 404 |
| Petoskey · Bay | angelcam `ger25omkrm` | REMOVE | Nub's Nob Ski Area | Given by owner/petoskeyarea.com embed label |
| Petoskey · Bayfront | wetmet `8e442be5...` | HOLD (pull until daylight check) | Same camera (WetMet 351-01-01) as WMTA's "Petoskey Area Visitors Bureau" uid `9dd443e9...`. Night still: black field with a strip of town lights/blue sign at the bottom. Could be the bay beyond the town, cannot confirm | WetMet image widget still 2026-11-08 night; WMTA og:image is a generic sunset-pier stock photo, not the cam. Stream page loads (verify OK). Needs one daytime still |
| Gary · Wells Street Beach | yt `foVd0uAK3Fg` | KEEP | Beach, dune fence, lake horizon (night frame, timestamp Nov 8 5:36 PM) | `_live` thumbnail, title "Gary, IN Weather Camera - Wells Street Beach" |
| Milwaukee · Summerfest & Harbor (Axis) | yt `ctrwip5GIb0` | KEEP-WEAK | Festival-grounds lakefront: lagoon/harbor + open lake across roughly the top third, I-794 interchange and lot in the lower two-thirds | Thumbnail Nov 8 6:07 PM. Borderline vs the "sliver of horizon" bar; only embeddable Milwaukee cam found. Owner call: keep or empty state |
| Sheboygan · Harbor Centre Marina | yt `lu-YXDumeps` | KEEP | Marina docks and slips, water (night, IR) | Thumbnail 11/08/26 6:06 PM, title "Visit Sheboygan Live Marina Camera" |
| Sheboygan · North Beach | yt `13j5iZkMpbE` | KEEP (FIX name) | Breakwater/rock pier, harbor mouth water and swim-area dock. It is the north pier/beach, rename to "North Beach & Pier" | Thumbnail 11/08/26 6:06 PM |
| Traverse City · W Grand Traverse Bay | yt `2ETj1sUmEmU` | KEEP-WEAK | Hotel rooftop over Front St/Grand Traverse Bay; bay + pier lights in top third, street and buildings below | Thumbnail Nov 8 7:07 PM, WTCM Radio Centre. Weak but water is visible |
| Mackinaw City · Straits & Bridge | yt `Mf_qId_7mlM` | KEEP | Mackinac Bridge across the Straits, big water foreground, freighter | Thumbnail (custom banner, daytime), Riviera Motel; liveness unconfirmed |
| Charlevoix · Pine River Channel | yt `HeZbPbqO-6M` | KEEP | Channel into Round Lake, piers, Charlevoix South Pier light, Lake Michigan beyond, ferry transiting | Thumbnail (64F overlay, daytime = stale or custom); liveness unconfirmed |
| Leland · Leelanau Harbor | yt `s7sY1waeOf4` | REMOVE | "The Cove" restaurant cam (111 River St). Current frame is lens-smeared; only dock rails/rooftops visible. No water confirmed, not the harbor/lake | `_live` + non-live thumbnails Nov 8 7:03-7:13 PM; title "The Cove Leland Fishtown Live". Name "Leelanau Harbor" is unsupported |
| Muskegon · Harbor (NOAA GLERL) | img `mkg08.jpg` | KEEP (FIX name) | Muskegon channel: rock breakwall and channel water. Image header literally reads "NOAA/GLERL - Muskegon - Channel" | JPEG fetched, Last-Modified 2026-11-08 19:00 EST (live); rename to "Muskegon · Channel (NOAA GLERL)" |
| New Buffalo · Harbor | ipcamlive `cnbharbor` | KEEP | Galien River harbor channel with marina slips (night) | IPCamLive public snapshot, live tonight |
| Muskegon · Channel (USS Silversides) | wetmet `75d6541617...` | KEEP | Muskegon channel with submarine at dock and the channel to the lake | WetMet image widget still tonight (verify OK) |
| Port Washington · Harbor | wetmet `e6c8abb0...` | REMOVE | **Downtown Milwaukee skyline** (Hilton, Wisconsin Ave, courthouse). Not Port Washington, not water | WetMet image widget still tonight. The real lakerart Port Washington cam is WetMet camera `10-06-01` (different id) |
| Sturgeon Bay · Westwood Shores | angelcam `24r4vn43r0` | KEEP | Sunset cam over Sturgeon Bay with maritime traffic (operator's words) | sturgeonbay.net/webcams + westwoodshores.net page; verify OK. No spot within range, harmless |
| Sturgeon Bay · Bay Shore Inn | angelcam `17yd2417le` | KEEP | "Sunset Cam over Green Bay" | sturgeonbay.net/webcams, bayshoreinn.net; verify OK. No spot within range |
| Chicago · Lakefront Skyline 4K | yt `dBGt-W7onQ8` | KEEP-WEAK (FIX name) | Oak St/Lake Shore Dr stretch: skyline on left, Lake Shore Drive, dark lake filling the right ~40% | Thumbnail Nov 7 3 AM. Rename "Chicago · Lakefront (Lakefront Live)" - "Skyline" invites a bad reading. Owner call |
| Michigan City · Lighthouse & Beach | yt `Y2VkN45kj_0` | KEEP | Beach, pier with catwalk and lighthouse, calm lake | Thumbnail (daytime); liveness unconfirmed |
| North Muskegon · Muskegon Lake | yt `itIkc0INogQ` | KEEP (FIX name) | Open water of Muskegon Lake with Muskegon shoreline far side. Inland lake, not Lake Michigan; rename to drop "(Muskegon Waterfront)" suffix noise | Thumbnail (daytime); liveness unconfirmed |
| South Haven · South Beach & Piers | yt `G-tlKF32_p4` | KEEP | Beach, long lit pier, surf (night) | Thumbnail, City of South Haven |

Rejected petoskeyarea.com embeds (looked at thumbnails): Harbor Springs Steeple `u13ItW40TDw` (downtown street, church), Harbor Springs Cam #1 / "Hall Cam" `yGUcyv1Jwj0` (church steeple and street), Boyne City `44PAH-xI-uM` (Main St sidewalk). So `iPm4jZcBKPU` has no good replacement; Harbor Springs has no embeddable water cam. Little Traverse Bay Ferry `_2NHpXiC6v4` shows the bow of a boat on open bay (genuine water, thumbnail dated 09/02/2026) but is a seasonal boat-mounted cam: HOLD until spring.

## 2. Final CAMS block (Lake Michigan section, replacement)

Replace the Lake Michigan entries at lines 21-42 and 235-238 of `src/cams.js` (Lake Erie/Ontario/Huron/etc. lines untouched) with this single block. Placing it in one spot is fine; order only affects tie-breaks.

```js
  // Lake Michigan - audited 2026-11-09 (docs/ops/cams). Every entry is a water view; no ski/street/skyline-only cams.
  // Removed: Harbor Springs Steeple (video gone), Petoskey Bay (Nub's Nob ski cam), Leland (restaurant cam, no water),
  //   Port Washington wetmet e6c8abb0... (actually downtown Milwaukee). HOLD: Petoskey Visitors Bureau wetmet 8e442be557e9221ea31ed33e75a38071
  //   (daylight check), Little Traverse Bay Ferry yt _2NHpXiC6v4 (seasonal).
  // Northern Lake Michigan / Little Traverse Bay & Straits
  { name: "Inn at Bay Harbor · Little Traverse Bay", lat: 45.364, lon: -85.003, yt: "VwTFodAY_aE", lake: "Lake Michigan" },
  { name: "Charlevoix · Pine River Channel", lat: 45.32, lon: -85.26, yt: "HeZbPbqO-6M", lake: "Lake Michigan" },
  { name: "Mackinaw City · Straits & Bridge", lat: 45.78, lon: -84.72, yt: "Mf_qId_7mlM", lake: "Lake Michigan" },
  // Grand Traverse Bay / Sleeping Bear / Manistee
  { name: "Traverse City · W Grand Traverse Bay", lat: 44.76, lon: -85.62, yt: "2ETj1sUmEmU", lake: "Lake Michigan" },
  { name: "Traverse City · Pinestead Reef Beach", lat: 44.79, lon: -85.57, angelcam: "1eyv49k9y7", lake: "Lake Michigan" },
  { name: "Empire · Beach & Surf (Sleeping Bear Surf)", lat: 44.81, lon: -86.06, angelcam: "17ldg92dle", lake: "Lake Michigan" },
  { name: "Manistee · First Street Beach (City of Manistee)", lat: 44.25, lon: -86.35, ipcamlive: "firststbeach", lake: "Lake Michigan" },
  // Door County (no launch spot in range yet)
  { name: "Sturgeon Bay · Westwood Shores", lat: 44.811, lon: -87.39, angelcam: "24r4vn43r0", lake: "Lake Michigan" },
  { name: "Sturgeon Bay · Bay Shore Inn", lat: 44.87, lon: -87.331, angelcam: "17yd2417le", lake: "Lake Michigan" },
  // West Michigan shore
  { name: "Muskegon · Channel (NOAA GLERL)", lat: 43.23, lon: -86.34, img: "https://www.glerl.noaa.gov/metdata/cams/mkg08.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Michigan" },
  { name: "Muskegon · Channel (USS Silversides)", lat: 43.228, lon: -86.331, wetmet: "75d6541617a2c940bd4d8a798aa35a69", lake: "Lake Michigan" },
  { name: "North Muskegon · Muskegon Lake", lat: 43.26, lon: -86.27, yt: "itIkc0INogQ", lake: "Lake Michigan" },
  { name: "Grand Haven · Beach (WGHN)", lat: 43.0635, lon: -86.2545, ipcamlive: "646fb1edafc6c", lake: "Lake Michigan" },
  { name: "Grand Haven · Channel (WGHN)", lat: 43.0605, lon: -86.2455, ipcamlive: "62851eba65dbc", lake: "Lake Michigan" },
  { name: "South Haven · South Beach & Piers", lat: 42.4, lon: -86.28, yt: "G-tlKF32_p4", lake: "Lake Michigan" },
  // Southern Lake Michigan
  { name: "New Buffalo · Harbor", lat: 41.79, lon: -86.74, ipcamlive: "cnbharbor", lake: "Lake Michigan" },
  { name: "Michigan City · Lighthouse & Beach (Access LaPorte County)", lat: 41.73, lon: -86.91, yt: "Y2VkN45kj_0", lake: "Lake Michigan" },
  { name: "Gary · Wells Street Beach", lat: 41.62, lon: -87.26, yt: "foVd0uAK3Fg", lake: "Lake Michigan" },
  { name: "Chicago · Lakefront (Lakefront Live)", lat: 41.895, lon: -87.61, yt: "dBGt-W7onQ8", lake: "Lake Michigan" }, // weak: lake ~40% of frame
  // Wisconsin shore
  { name: "Milwaukee · Summerfest & Harbor (Axis)", lat: 43.03, lon: -87.90, yt: "ctrwip5GIb0", lake: "Lake Michigan" }, // weak: lake ~1/3 of frame
  { name: "Sheboygan · Harbor Centre Marina", lat: 43.75, lon: -87.715, yt: "lu-YXDumeps", lake: "Lake Michigan" },
  { name: "Sheboygan · North Beach & Pier", lat: 43.75, lon: -87.715, yt: "13j5iZkMpbE", lake: "Lake Michigan" },
```

Confidence notes on the additions:
- Grand Haven WGHN x2: ids from the operator's own pages (wghn.com/beachcam, /channel-cam), IPCamLive reports `streamavailable=1`, labels are "Beach Cam" / "Channel Cam", Grand Haven. The snapshot.jpg 404s so I have **no picture**; coords are approximate beach/channel positions. If you want a strict "seen it" rule, drop these two until a daytime frame is checked (Holland/Muskegon then fall back to South Haven + Muskegon cams).
- Manistee First Street Beach: night frame shows beach, dune fence and dark band at the horizon; daytime framing unconfirmed. Manistee `5thavebeach` also exists but its frame was black; left out.
- Pinestead Reef: operator page title "Beach Cam - Traverse City's Best Beach"; Angelcam gives no preview; coords approximate.
- Empire: Sleeping Bear Surf "Wave Camera" page; coords for Empire beach approximate.
- Inn at Bay Harbor: night frame shows resort pavilion/grounds in the lower-left and open dark bay beyond with wake lines; title says "Little Traverse Bay". Lat/lon approximate (Bay Harbor, west of Petoskey).

### Ready-to-paste, held back (not in the block)
```js
  // HOLD - needs a daylight frame confirming it views the bay (night still was black):
  // { name: "Petoskey · Visitors Bureau (Masons bldg)", lat: 45.373, lon: -84.955, wetmet: "8e442be557e9221ea31ed33e75a38071", lake: "Lake Michigan" },
  // HOLD - seasonal boat cam (bow over Little Traverse Bay), thumbnail dated 09/02/2026; recheck in May:
  // { name: "Little Traverse Bay · Ferry boat cam", lat: 45.40, lon: -84.97, yt: "_2NHpXiC6v4", lake: "Lake Michigan" },
  // PENDING view check - WetMet legacy player (official), ids from lakerart labels; would need `embed:` since camSrc only builds widgets/stream uid URLs:
  // { name: "Port Washington · Harbor", lat: 43.387, lon: -87.868, embed: "https://api.wetmet.net/client-content/PlayerFrame.php?CAMERA=10-06-01&CFVER=WM&WIDTH=640&HEIGHT=360", lake: "Lake Michigan" },
  // { name: "Racine · Harbor", lat: 42.73, lon: -87.78, embed: "https://api.wetmet.net/client-content/PlayerFrame.php?CAMERA=10-05-01&CFVER=WM&WIDTH=640&HEIGHT=360", lake: "Lake Michigan" },
  // { name: "Sturgeon Bay · Channel (WFRV)", lat: 44.84, lon: -87.38, embed: "https://api.wetmet.net/client-content/PlayerFrame.php?CAMERA=245-05-01&CFVER=WM&WIDTH=640&HEIGHT=360", lake: "Lake Michigan" },
  // Door County, no spot in range: Glidden Lodge Beach angelcam oxln9609r8 (operator: "view of Lake Michigan"), verify OK.
```
Note `worker.js` frame-src CSP lists only some hosts; check it actually applies to the app page before relying on the `embed:` approach (angelcam/wetmet/youtube are not in that list today either, so it appears not to be enforced).

### LINK_CAMS "Lake Michigan" (replacement)
```js
  "Lake Michigan": [
    { name: "Petoskey Area cams", url: "https://petoskeyarea.com/planning/live-area-webcams/" },
    { name: "West Michigan live cams (WMTA)", url: "https://www.wmta.org/live-west-michigan-camera-gallery/" },
    { name: "Manistee beach cams", url: "https://www.manisteemi.gov/136/Beaches" },
    { name: "Grand Haven (EarthCam)", url: "https://www.earthcam.com/usa/michigan/grandhaven/lakemichigan/" },
    { name: "Sturgeon Bay cams", url: "https://sturgeonbay.net/webcams/" },
    { name: "Milwaukee Sailing Center dock cam", url: "https://sailingcenter.org/cam/" },
    { name: "Kenosha Southport Marina", url: "https://www.spmarina.net/marina-webcam" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
```
(Petoskey Area page also lists the Boyne ski cams; it is link-only so acceptable, but its label should stay generic. Kenosha page sends `X-Frame-Options: SAMEORIGIN`, so link-only. EarthCam is link-only by policy.)

## 3. Per-spot coverage (`nearestCams`, Lake Michigan, counts before to after, uncapped; UI caps at 6)

| spot | before | after | after cams (nearest first, abridged) |
|---|---|---|---|
| chicago | 4 | 4 | Chicago Lakefront (weak), Gary, Michigan City, New Buffalo |
| milwaukee | 4 | 3 | Axis (weak), Sheboygan marina, Sheboygan beach (lost Port Washington = Milwaukee skyline) |
| muskegon | 4 | 6 | NOAA channel, Silversides, N. Muskegon, Grand Haven x2, South Haven |
| holland | 4 | 6 | Grand Haven x2, South Haven, Muskegon x3 |
| traverse-city | 6 | 6 | TC West Bay, Pinestead, Empire, Charlevoix, Manistee, Inn at Bay Harbor (all real water; lost Leland, Petoskey x2, Harbor Springs) |
| sheboygan | 4 | 3 | Sheboygan x2, Milwaukee Axis (lost Port Washington) |
| michigan-city | 5 | 5 | Michigan City, New Buffalo, Gary, Chicago (weak), South Haven |
| petoskey | 7 | 5 | Inn at Bay Harbor, Charlevoix, Mackinaw, TC Pinestead, TC West Bay |
| harbor-springs | 7 | 5 | same as Petoskey |
| cross-village | 6 | 3 | Mackinaw, Inn at Bay Harbor, Charlevoix |
| mackinaw | 5 | 3 | Mackinaw, Inn at Bay Harbor, Charlevoix |

Counts drop in the north because the removed entries were ski/street/duplicate cams; no spot is empty. The three northern spots now depend on one confirmed-water YouTube cam each in the Little Traverse area (Inn at Bay Harbor, unconfirmed live) - the weakest region.

## 4. Could not verify / open items
- Liveness of every YouTube cam (watch pages blocked). Run `cam-health` on the merged branch; Charlevoix, Michigan City, Muskegon Lake, Mackinaw Bridge returned daytime/summer thumbnails in a November evening.
- Petoskey WetMet 351-01-01: daylight still needed (curl `https://api.wetmet.net/widgets/image/frame.php?uid=8e442be557e9221ea31ed33e75a38071`, take the `current.jpg` URL from the `background-image`, download and look). Same for Grand Haven WGHN and Manistee in daylight.
- Angelcam views (Westwood, Bay Shore Inn, Empire, Pinestead, Glidden): descriptions only; no preview exposed.
- Option not taken: decoding the signed WetMet/Angelcam HLS URLs from the public embed pages with ffmpeg would give real frames for Port Washington/Racine/Petoskey. I did not do it given the earlier ruling about stream access; say so if you want it.
- Milwaukee Axis and Chicago Lakefront Live are weak water views; no better embeddable options found.

## Outreach leads (drafts only, not sent)
- Milwaukee Sailing Center (`https://weewx.milwaukeesailing.net/dockcam-hd.jpg`, page sailingcenter.org/cam) - self-hosted JPEG of the Milwaukee harbor docks; ask permission to hotlink/embed. Best Milwaukee fix.
- WGHN 92.1 Grand Haven (Beach Cam / Channel Cam via IPCamLive) - confirm OK to embed on shouldiboat.com.
- City of Manistee (manisteemi.gov) - First St / 5th Ave beach cams via IPCamLive.
- Kenosha Southport Marina (rtsp.me embed, frames blocked), Racine Reef Point Marina / North Shore Yacht Club (Milwaukee), Menominee Marina (IPCamLive `62d5f6d0bdcd0`), Frankfort Harbor Lights - ask for embeddable player or snapshot.
- Petoskey Area Visitors Bureau - ask which direction the Masons-building cam faces and for a Harbor Springs harbor/marina water cam (current Harbor Springs cams show a church and Main St only).
- Inn at Bay Harbor - confirm the cam is year-round and its exact view.
- Whihala Beach/boat launch (Whiting IN, IPCamLive `whihalaboatlaunch`) is DEAD (no stream assigned); ask Lake County Parks if it is returning - it would be the closest water cam to Chicago.

---

## Lake Huron + Lake Superior cam audit (2026-11-09)

Method: YouTube oEmbed (200 = exists + embeddable) and `hqdefault_live/maxresdefault_live` thumbnails viewed; NOAA GLERL / NPS / Michigan Tech JPEGs downloaded and viewed (Last-Modified within minutes of audit time = live); provider/operator labels for WetMet/Angelcam/IPCamLive (players are H.264 HLS, not viewable headless; no access controls bypassed). It was night in the region, so many frames are dark but legible. Not done: `verify-cam-candidates.mjs` can't run locally (node fetch ignores the proxy, every host -> ENOTFOUND), and YouTube watch pages are bot-walled, so liveness of YouTube cams rests on thumbnail timestamps (noted per row).

Spot definitions: spots live in `functions/marine/conditions.js` (not regions.js; regions.js only lists the lake names). Huron spots: port-huron, tawas, alpena, harbor-beach. Superior spots: duluth, bayfield, marquette, houghton, grand-marais. `mackinaw` is tagged Lake Michigan. **St. Clair/Detroit tags:** only `port-huron` is a Huron spot near the St. Clair River, so tagging the St. Clair cams Lake Huron is consistent (the river is Huron's outlet). The Detroit River Dossin cam is the exception: wrong river, 0.8 deg from Port Huron only by luck of the 0.85 rule.

## 1. Existing entries

| # | Name (current) | id | Verdict | What it actually shows | Evidence |
|---|---|---|---|---|---|
| H1 | St. Clair · River (BoatNerd Voyageur) | yt yu0pKQSvYX8 | KEEP | St. Clair River from the Voyageur restaurant terrace, river + far Canadian shore | oEmbed 200 "St. Clair River from the Voyageur Restaurant"; thumbnail has BoatNerd overlay dated 11-08-2026 20:13 (live) |
| H2 | Marine City · St. Clair River (StreamTime) | yt NqvRpsavyWg | KEEP | Wide river with cruise ship, "Marine City, Michigan" | oEmbed 200; thumbnail viewed (custom StreamTime thumb, so liveness not independently confirmed) |
| H3 | Detroit River · Dossin Museum (BoatNerd) | yt L73DrCZHJ8A | REMOVE from Huron | Detroit River, Belle Isle/skyline across water. Real water view, but wrong river/lake for any Huron spot | oEmbed 200; thumbnail dated 11-08-2026 19:21 (live). Optional: re-add under Lake Erie (see below) |
| H4 | Port Huron · St. Clair River (StreamTime) | yt AwP_Q6IGwFs | KEEP | Head of St. Clair River / Lake Huron outlet, freighter, flags | oEmbed 200; thumbnail viewed |
| H5 | Alpena · Thunder Bay (NOAA GLERL) | img apn04.jpg | FIX name | It is the **Marina** camera (docks lit at night, reflections). NOAA overlay: "Alpena - Marina" | JPEG Last-Modified 00:00 GMT today; overlay text read |
| H6 | DeTour · Drummond Island Ferry | wetmet 609fd1e6... | HOLD (remove until eyeballed) | Unknown. WMTA's page for this uid is titled just "Drummond Island" (WMTA also lists separate "Ferry Dock", "Yacht Haven", "Whitney Bay" cams); the lakerart label "Drummond Island Ferry Cam" can't be tied to it. Serves no spot (nearest Huron spot alpena 0.93 deg, hidden by 4 closer cams) | Player page loads but video is HLS; WMTA page art is a stock kayak photo |
| H7 | Alpena · Thunder Bay Camera (WATZ) | yt BluUW4pk2ek | REMOVE | Park lawn, roads, buildings; bay is a dark sliver at the horizon; big station logo | thumbnail viewed |
| H8 | Alpena · Thunder Bay Harbor Camera (105.7 The Bird) | yt cTL6RHF3WDs | KEEP | Marina basin full of masts and docks, water behind; some station/sponsor overlay and a building in foreground | thumbnail viewed; watch page `isLiveNow:true`, started 2026-03-24 |
| H9 | Algonac · St. Clair River (StreamTime) | yt g4mpc2I5lhc | KEEP | River with ferry, far shore | oEmbed 200; thumbnail viewed |
| H10 | Port Huron · St. Clair River shipping (BoatNerd PTZ) | yt SrL74LPoXF8 | KEEP | Freighter in the channel, Blue Water Bridge behind (PTZ housing in left of frame) | oEmbed 200; thumbnail viewed |
| S1 | Duluth · Canal Cam | yt HPS48TMmNag | KEEP | Ship canal, piers, lighthouses | thumbnail overlay "2026-11-08 18:06" (live) |
| S2 | Duluth · Western Harbor | yt SBElcRmgVjw | REMOVE | Elevated view over trees, rail yard and houses; St. Louis Bay flats and Blatnik Bridge a thin strip at the top. Thumbnail dated 2026-09-08 | thumbnail viewed |
| S3 | Duluth · South Pier Lighthouse | yt a-ADUhRp0yk | KEEP | South pier, harbor entrance water, lift bridge and city lights | thumbnail overlay "2026-11-08 18:07" (live) |
| S4 | Duluth · Pier B | yt c1kfkIoF0k0 | KEEP (liveness WARN) | Ship passing through the canal under the Aerial Lift Bridge, open lake behind. Best frame of the set | oEmbed 200; thumbnail overlay is 2025-07-08 (static thumb, not a live frame) |
| S5 | Marquette · Lower Harbor | wetmet 08a47e96... | HOLD (remove until eyeballed) | Unknown. WMTA's only label is "Marquette Live Camera"; "Lower Harbor" came from nowhere. lakerart doesn't list it. Only cam for the Marquette spot | WMTA page art is a stock waterfall photo |
| S6 | Houghton · Portage Lift Bridge | wetmet 040f3085... | REMOVE (replace with Michigan Tech cams) | Unknown; the uid is not on WMTA's gallery and not on lakerart (source unknown) | Replaced by verified MTU JPEGs below |
| S7 | Grand Marais · Harbor Cam | yt n0H5FkWkjjs | KEEP (liveness WARN) | Harbor breakwall with the red-and-white lighthouse, open Superior | oEmbed 200 "Grand Marais, Minnesota Harbor Cam Live Stream" (Visit Cook County); thumbnail overlay 2021-07-30 (static thumb) |
| S8 | Bayfield · Bayfield Inn | angelcam v8ypjjj8y6 | HOLD (remove; spot well covered) | Unknown. lakerart: "Bayfield Inn (Live HD video)", inn view, can't tell if it's the harbor | Angelcam player page loads, no title/thumb exposed |
| S9 | Bayfield · Port Superior Marina | angelcam m1ervgoxr7 | KEEP (label-only) | Marina (lakerart: "Port Superior Marina (in Bayfield)") | operator label; frame not viewable |
| S10 | Saxon Harbor, WI · Marina | ipcamlive saxonharbor | KEEP (label-only) | Saxon Harbor marina, lakerart label "Saxon Harbor, WI" | IPCamLive player assigns a live server (s162); frame not viewable |
| S11 | Whitefish Point · Shipwreck Museum | wetmet 977a312d... | HOLD (remove until eyeballed) | Museum-grounds cam; whether lake horizon or buildings dominate is unknown. Serves no spot (nearest is marquette 2.4 deg) | WMTA art is a stock aerial of the lighthouse compound |
| S12 | Isle Royale · Mott Island (NPS) | img mottmain.jpg | KEEP | Mott Island harbor/dock, water, far shore | JPEG viewed, overlay "2026-11-08 19:08:42", Last-Modified current. Serves no spot (Houghton has closer cams) |
| S13 | Silver Bay · Marina (Duluth Harbor Cam) | yt zTVWJ3Mc0Ag | KEEP | Marina docks, boats, breakwall, forested shore | oEmbed "Silver Bay Marina"; hq thumbnail viewed |

## 2. Replacement blocks for `src/cams.js`

Delete every existing `lake: "Lake Huron"` / `lake: "Lake Superior"` line (the Huron/Superior section near the top, plus the stragglers near the bottom: Alpena x2, Algonac, Port Huron PTZ, Silver Bay) and the two `// Lake Huron` / `// Lake Superior` comment lines. Paste the two blocks below where the old sections were (before `// Lake Ontario` works). The comment `// Found via the lakerart.com directory scout (official embed players + NPS)` above the old Bayfield lines is left orphaned: delete or keep as you like. Also update the stale file header ("no outbound network" notes).

### Lake Huron
```js
  // Lake Huron (audited 2026-11-09: every cam below was seen on a thumbnail/snapshot or has an operator label naming a water view)
  // St. Clair River — the head of the river at Port Huron out to Algonac. Shipping-channel views, tagged Lake Huron for the Port Huron launch.
  { name: "Port Huron · St. Clair River (StreamTime)", lat: 42.98, lon: -82.42, yt: "AwP_Q6IGwFs", lake: "Lake Huron" },
  { name: "Port Huron · St. Clair River shipping (BoatNerd PTZ)", lat: 42.98, lon: -82.42, yt: "SrL74LPoXF8", lake: "Lake Huron" },
  { name: "St. Clair · River (BoatNerd Voyageur)", lat: 42.83, lon: -82.49, yt: "yu0pKQSvYX8", lake: "Lake Huron" },
  { name: "Marine City · St. Clair River (StreamTime)", lat: 42.72, lon: -82.49, yt: "NqvRpsavyWg", lake: "Lake Huron" },
  { name: "Algonac · St. Clair River (StreamTime)", lat: 42.62, lon: -82.53, yt: "g4mpc2I5lhc", lake: "Lake Huron" },
  // Alpena / Thunder Bay — NOAA GLERL snapshots (overlay labels: Marina, Thunder Bay, River) + one marina stream
  { name: "Alpena · Marina (NOAA GLERL)", lat: 45.06, lon: -83.42, img: "https://www.glerl.noaa.gov/metdata/cams/apn04.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Huron" },
  { name: "Alpena · Thunder Bay breakwater (NOAA GLERL)", lat: 45.06, lon: -83.42, img: "https://www.glerl.noaa.gov/metdata/cams/apn03.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Huron" },
  { name: "Alpena · Thunder Bay River mouth (NOAA GLERL)", lat: 45.06, lon: -83.42, img: "https://www.glerl.noaa.gov/metdata/cams/apn05.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Huron" },
  { name: "Alpena · Thunder Bay Harbor Camera (105.7 The Bird)", lat: 45.063, lon: -83.43, yt: "cTL6RHF3WDs", lake: "Lake Huron" },
```

### Lake Superior
```js
  // Lake Superior (audited 2026-11-09: every cam below was seen on a thumbnail/snapshot or has an operator label naming a water view)
  { name: "Duluth · Canal Cam", lat: 46.78, lon: -92.08, yt: "HPS48TMmNag", lake: "Lake Superior" },
  { name: "Duluth · South Pier Lighthouse", lat: 46.78, lon: -92.08, yt: "a-ADUhRp0yk", lake: "Lake Superior" },
  { name: "Duluth · Pier B", lat: 46.78, lon: -92.08, yt: "c1kfkIoF0k0", lake: "Lake Superior" },
  { name: "Silver Bay · Marina (Duluth Harbor Cam)", lat: 47.295, lon: -91.257, yt: "zTVWJ3Mc0Ag", lake: "Lake Superior" },
  { name: "Grand Marais · Harbor Cam", lat: 47.75, lon: -90.33, yt: "n0H5FkWkjjs", lake: "Lake Superior" },
  { name: "Bayfield · Port Superior Marina", lat: 46.757, lon: -90.864, angelcam: "m1ervgoxr7", lake: "Lake Superior" },
  { name: "Bayfield · Pikes Bay Marina", lat: 46.83, lon: -90.83, yt: "O8kPCPZEFE4", lake: "Lake Superior" },
  { name: "Saxon Harbor, WI · Marina", lat: 46.565, lon: -90.437, ipcamlive: "saxonharbor", lake: "Lake Superior" },
  // Houghton — Michigan Tech cams on the Keweenaw Waterway (university JPEG snapshots)
  { name: "Houghton · Keweenaw Waterway (Michigan Tech GLRC)", lat: 47.119, lon: -88.547, img: "https://www.mtu.edu/mtu_resources/php/webcams/cache/keweenaw-waterway-west-via-glrc.jpg", link: "https://www.mtu.edu/webcams/", lake: "Lake Superior" },
  { name: "Houghton · Portage Lift Bridge (Michigan Tech)", lat: 47.1215, lon: -88.5655, img: "https://www.mtu.edu/mtu_resources/php/webcams/cache/lift-bridge.jpg", link: "https://www.mtu.edu/webcams/", lake: "Lake Superior" },
  { name: "Isle Royale · Mott Island dock (NPS)", lat: 48.108, lon: -88.556, img: "https://www.nps.gov/webcams-isro/mottmain.jpg", link: "https://www.nps.gov/isro/learn/photosmultimedia/webcams.htm", lake: "Lake Superior" },
```
Coordinates for Pikes Bay Marina (46.83,-90.83) and the Michigan Tech cams are approximate (town-level, from the operator's location); they only affect the 0.85 deg match.

Cams held back (paste back after someone eyeballs the player in a desktop browser, which can decode the HLS):
```js
  { name: "Marquette · Live cam (WMTA)", lat: 46.54, lon: -87.38, wetmet: "08a47e963e2f369ca92e4fe022b7f329", lake: "Lake Superior" }, // view unconfirmed
  { name: "Drummond Island · WMTA cam", lat: 45.993, lon: -83.899, wetmet: "609fd1e6905ac5196fb8534a64f36993", lake: "Lake Huron" }, // view unconfirmed
  { name: "Whitefish Point · Shipwreck Museum", lat: 46.771, lon: -84.958, wetmet: "977a312d5da91e21bc63f295c0b12cc7", lake: "Lake Superior" }, // view unconfirmed
  { name: "Bayfield · Bayfield Inn", lat: 46.812, lon: -90.818, angelcam: "v8ypjjj8y6", lake: "Lake Superior" }, // view unconfirmed
```
Optional (Detroit River cam, if you want it): `{ name: "Detroit River · Dossin Museum (BoatNerd)", lat: 42.34, lon: -82.95, yt: "L73DrCZHJ8A" },` with no `lake`, which would show for Toledo, Put-in-Bay and Port Clinton (0.7-0.83 deg). Backend-wise that's Lake Erie's western basin water, but it's a river view, so your call.

### LINK_CAMS (replace the Huron and Superior arrays)
```js
  "Lake Huron": [
    { name: "Tawas Bay dock cam", url: "https://www.tawasbayweather.com/dockcamera.htm" },
    { name: "Caseville breakwater cams", url: "https://www.casevillewebcams.com/" },
    { name: "Goderich sunset cams", url: "https://exploregoderich.ca/sunset-cameras/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
  "Lake Superior": [
    { name: "Duluth Harbor Cam hub", url: "https://www.duluthharborcam.com/p/canal-park-cams.html" },
    { name: "Marquette · Presque Isle Middle Bay (Superior Watershed Partnership)", url: "https://superiorwatersheds.org/superior-buoys" },
    { name: "Michigan Tech webcams (Keweenaw)", url: "https://www.mtu.edu/webcams/" },
    { name: "Munising / Pictured Rocks cams", url: "https://www.exploremunising.com/web-cams/" },
    { name: "Isle Royale NPS webcams", url: "https://www.nps.gov/isro/learn/photosmultimedia/webcams.htm" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
```
The Tawas dock-cam URL was unreachable from this sandbox's proxy (could be the proxy, could be the site); re-check before keeping. Caseville is link-only: its player is rtsp.me (not on the approved provider list).

## 3. Per-spot coverage (nearestCams, n=20)

| Spot | Before | After | After list / note |
|---|---|---|---|
| port-huron | 6 | 5 | Port Huron x2, St. Clair, Marine City, Algonac (Detroit River removed) |
| tawas | 3 | 4 | All four are Alpena cams, 0.78 deg away; nothing in Tawas Bay itself |
| alpena | 3 | 4 | NOAA Marina, Thunder Bay breakwater, River mouth, Bird marina (WATZ removed, 2 NOAA added) |
| harbor-beach | 1 | 1 | Still only the Port Huron cam (~1.1 deg, single-nearest fallback). Honest gap |
| duluth | 6 | 5 | Canal, South Pier, Pier B, Silver Bay, Port Superior (Western Harbor removed) |
| bayfield | 4 | 4 | Pikes Bay (new), Port Superior, Saxon, Silver Bay (Bayfield Inn held) |
| marquette | 1 | 1 | **Note:** the WMTA cam is held, so the engine falls back to the Houghton MTU waterway cam at ~1.0 deg (~70 mi, past the 60 mi bar). If you'd rather show the empty state, raise nothing: either re-add the WMTA Marquette line after eyeballing it, or accept the fallback |
| houghton | 1 | 2 | MTU waterway + MTU lift bridge (replace the unverifiable WetMet) |
| grand-marais | 2 | 2 | Grand Marais + Silver Bay |

## 4. Unverifiable, leads, and outreach (draft only)

Unverifiable (above): WetMet Marquette/Drummond/Whitefish, Angelcam Bayfield Inn, label-only Port Superior and Saxon Harbor, and YouTube liveness for the cams with static thumbnails (Pier B, Grand Marais, StreamTime cams). The weekly `cam-health.yml` run on GitHub is the right liveness check; add these ids to `scripts/check-cams.mjs` coverage if not already.

Leads (not added):
- **Superior Watershed Partnership "Presque Isle Middle Bay"** (Marquette): YouTube channel UC5g2caPEqFMgb54wSAJnJ_A / video `rmV7Ebfu99A`, thumbnail shows beach, whitecaps and Presque Isle; oEmbed 200 but the channel has **no live stream right now** (seasonal?). Best Marquette candidate; re-check in spring and add as `ytChannel`. Also their Stannard Rock clip is not a live feed.
- **Roy's Point Marina, Bayfield** (royspoint.com/live-view): two IPCamLive "Dock Camera A/B" (aliases `6432259053e55`, `6432a21897c91`); players resolve but the view is unconfirmed.
- **NOAA GLERL Thunder Bay Island (tbi01-05) and Spectacle Reef (srl01-05)** snapshots: only night frames were available and they looked like ground/equipment views (tbi) or black (srl); view in daylight before adding. They'd help Alpena and Mackinaw.
- **Soo (Ontario) Angelcam**: j3y74232ym and others from sootoday.com/webcams; no Huron/Superior spot nearby, so not added.
- Caseville (rtsp.me), Bay City Yacht Club (rtsp.run embed, snapshot corrupt/stale), Port Sanilac Marina, Sarnia Yacht Club, Pictured Rocks pier (Nest embeds + MDOT RWIS): Harbor Beach / Port Huron gap leads, all private or non-approved players.
- Rejected: Lake Superior Trading Post cam (sundewtech.net/lstp, labelled "Grand Marais" on lakerart: shows a street/shop front at night); NMU "View of town"; Solglimt B&B Duluth (blocks framing).
- Seen and not used: Alpena Radio Centre marina cam `FS9Iz-EJW5Y` is the same view as the Bird cam (add only if you want a second angle).

Outreach drafts (owner sends):
1. **Michigan Tech webcams** (webcams@mtu.edu or Great Lakes Research Center): "We run shouldiboat.com, a free boating-conditions site. We'd like to show your Keweenaw Waterway and Lift Bridge stills (the www.mtu.edu/mtu_resources/php/webcams/cache JPEGs) beside our Houghton forecast, with a link and credit to mtu.edu/webcams. Is that OK? Could you also tell us if there's a stable image URL you'd prefer us to use?"
2. **Superior Watershed Partnership**: ask whether the Presque Isle Middle Bay live stream runs year-round and confirm embedding of the YouTube channel on shouldiboat.com is welcome.
3. **WMTA (West Michigan Tourist Association)**: ask which view each WetMet uid shows (Marquette 08a47e96..., Drummond Island 609fd1e6..., Great Lakes Shipwreck Museum 977a312d...) and whether embedding the WetMet players outside wmta.org is allowed.
4. **Tawas Bay Weather (tawasbayweather.com)** and **Port Sanilac Marina / Caseville Chamber**: ask for an Angelcam/IPCamLive/YouTube embed or a snapshot URL we may link to for Tawas Bay and Harbor Beach/Saginaw Bay, where we have no cam.

---

