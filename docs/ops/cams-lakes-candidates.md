# Great Lakes cam candidates (2026-11-07)

Input for `scripts/verify-cam-candidates.mjs`: `scripts/cam-candidates-lakes.json`.
"Verified here" = YouTube oEmbed returned 200 (exists + embeddable), shown in YouTube's Live filter, and a daytime thumbnail was viewed. YouTube's `hqdefault_live` thumbnail can lag, so the Action's liveness check is still wanted. Non-YouTube hosts were unreachable from the sandbox.

## Per spot (counts = cams that `nearestCams()` returns within 0.85 deg)

| Spot | Existing | Proposed | Total |
|---|---|---|---|
| erie | 1 | +1 | 2 |
| conneaut | 2 | +1 (shared) | 3 |
| olcott | 2 | +1 | 3 |
| sackets-harbor | 1 | 0 (leads only) | 1 |
| tawas | 1 | 0 (leads only) | 1 |
| alpena | 1 | +3 | 4 |
| harbor-beach | 1 | 0 (leads only) | 1 |
| port-huron | 2 | +2 | 4 |
| chicago | 2 | +1 | 3 |
| michigan-city | 2 | +1 | 3 |
| muskegon | 2 | +1 | 3 |
| holland | 2 | +1 (+1 via North Muskegon) | 4 |
| marquette | 1 | 0 (leads only) | 1 |
| houghton | 1 | 0 (leads only) | 1 |
| grand-marais | 1 | +1 | 2 |

Cleveland (5), Sandusky (6), Put-in-Bay (6), Milwaukee (4), Duluth (4), Rochester (4) already have 4+ and were left alone.

## Candidates

### Erie, PA / Conneaut
- **North East, PA · Sunset Cam** `yt Hg56IYpaF2A` (North East Borough). Thumbnail: gravel beach, whitecaps, open lake horizon. Water view. **Verified here.** About 0.2 deg from Erie and 0.6 deg from Conneaut.
- Rejected: Lake Shore Railway Museum cams (`DFOARJuSfwQ`, `QzsJeFEQglo`) are rail cams. Erie News Now Skyview (bay from Niagara Pier) and FishUSA Lampe Marina (`fishusa.com/lampe-webcam`) are good leads but I couldn't see the player type. Fairview Twp "Avonia Beach / Walnut Creek Access live streams" (`fairviewtownship.com/home/pages/avonia-beach-and-walnut-creek-access-live-streams`) is also a lead. All three **need an Action check / scout** (run `cam-scout.yml` with those URLs).

### Olcott
- **Lyndonville · Lake Ontario Livestream** `yt w2COKOM5USU` (channel "Lake Ontario Live Stream - Lyndonville, NY"). Thumbnail: rocky shore, open lake. Water view. **Verified here.** About 0.33 deg east of Olcott.

### Sackets Harbor (still 1 cam, the Oswego SUNY cam)
- Rejected: SUNY Oswego "Shineman Science Center" (`yVnVm0aiIm4`) shows campus buildings and a parking lot with only a lake horizon. nny.live Watertown cams are not water.
- Leads, **need Action check / scout** (not embeddable as listed): Navy Point Marine livestream `navypointmarine.com/live/` (probably a YouTube or similar embed, so scout the page for the id), Madison Barracks Marina (WebcamTaxi, third-party, likely not licensable), Ventusky/NYS Mesonet Cape Vincent cam, SkylineWebcams (never). Sackets Harbor village `sacketsharbor-ny.gov/live` is only a news stream. Draft an outreach email to Navy Point Marine if the embed isn't official.

### Tawas (still 1)
- No embeddable cam found. `tawasbayweather.com/dockcamera.htm` is already a LINK_CAM. Ask the owner for permission or an embed; draft outreach in `docs/ops/cams/outreach/`.

### Alpena
All three are Radio Centre stations' cams, same operator, same town, so they're only "different angles". **Verified here** (thumbnails viewed, daytime).
- `BluUW4pk2ek` WATZ: waterfront and bay horizon.
- `cTL6RHF3WDs` 105.7 The Bird: marina basin and breakwall, open bay behind.
- `FS9Iz-EJW5Y` Radio Centre "Thunder Bay Marina Camera": marina and breakwall, open bay.
Overlays include station ads/phone numbers (WATZ and Larry's Collision logos). Consider adding only two. Existing NOAA GLERL snapshot stays.

### Harbor Beach (still 1)
- Nothing embeddable found. Thumbwind (April 2024) lists a Harbor Beach harbor PTZ cam and a Caseville breakwall cam; both are **needs Action check / scout** (`thumbwind.com/michigan-upper-thumb-webcams`). Windfinder pages aren't embeddable.

### Port Huron
- **Algonac · St. Clair River (StreamTime)** `yt g4mpc2I5lhc`: river and ferry at sunset. Water view (river). **Verified here.**
- **Port Huron · St. Clair River shipping (BoatNerd)** `yt SrL74LPoXF8`: freighter in the channel, Blue Water Bridge behind, camera housing in frame. **Verified here.** Possible overlap with the two existing Port Huron cams (BoatNerd `dqrwY6i-Zz4`, StreamTime `AwP_Q6IGwFs`); keep only if the angle differs.
- Rejected: Detroit River/Dossin (`L73DrCZHJ8A`, 0.8 deg away, wrong river), Lake St. Clair guide `fKnJf2X2k_Y` (location unconfirmed).

### Chicago
- **Chicago · Lakefront Skyline 4K (Lakefront Live)** `yt dBGt-W7onQ8`: lake on right, Lake Shore Drive on left. Mostly water and shoreline, with a road in the left of frame. Acceptable. **Verified here.**
- Rejected: Waukegan Harbor `idY4GyCj5Jk` (oEmbed 401, embedding disabled); EarthCam Skydeck (never).

### Michigan City
- **Access LaPorte County BeachCam** `yt Y2VkN45kj_0`: East Pierhead lighthouse, pier and beach. **Verified here.**

### Muskegon / Holland
- **North Muskegon · Muskegon Lake** `yt itIkc0INogQ`: open water and boats, city skyline across the lake (Muskegon Lake, not the open lake). **Verified here.**
- **South Haven · South Beach** `yt G-tlKF32_p4` (City of South Haven): piers, red lighthouse, beach, open lake. **Verified here.** About 0.37 deg from Holland, 0.9 from Muskegon.
- Lead: Holland/Big Red and Grand Haven have no embeddable feed found (Grand Haven is EarthCam, already a link).

### Marquette (still 1)
- Nothing embeddable found. Leads, **need Action check / scout**: Superior Watersheds Partnership "Presque Isle Middle Bay" cam (`superiorwatersheds.org/superior-buoys`), WZMQ 19 waterfront/ore-dock cam (`wzmq19.com` camera page), NMU live cam. Rejected: "Lake Superior Live Camera" (Jake Cormier, `aEsm_UkwRsA`): thumbnail shows a real Superior beach with whitecaps but the location is unstated and uses metric units, so it may be Ontario; don't use unless the owner confirms.

### Houghton (still 1)
- Leads, **need Action check / scout**: Michigan Tech GLRC cams on the Keweenaw Waterway (`mtu.edu/webcams/glrc-west/`, `glrc-east/`, `bridge/`) offer still, stream and time-lapse; I couldn't see the JPEG path, so run `cam-scout.yml` on `https://www.mtu.edu/webcams/`. University source qualifies for `img`. Copper Harbor cam is listed on michigan4you.com but only as a page. Houghton Lake MI cams are the wrong "Houghton"; ignore.

### Grand Marais, MN
- **Silver Bay · Marina (Duluth Harbor Cam)** `yt zTVWJ3Mc0Ag`: boats at docks, breakwall, forested shore. **Verified here** (thumbnail looks like dawn/dusk). 0.78 deg away.
- Rejected for distance: Split Rock Lighthouse `9EnmgL3fXW8` (~0.9 deg; its thumbnail was dated 2024-05-07, possibly stale), Two Harbors Boat Launch `sThx7mQM3Uc` (1.2 deg).

## Problems found in existing `src/cams.js` (not edited)
- **Chicago · Lakefront (Playpen 4K)** `ATz12otMpf4`: YouTube oEmbed returns 403, so it is probably no longer embeddable or live. `dBGt-W7onQ8` above likely replaces it.
- **Milwaukee · Lakefront** `MT5Og9gOKuM` is titled "EarthCam Live: Milwaukee, WI". That breaks the "never EarthCam" rule. The MKE.com cam `7fZ2JLtv_c8` shows an arena and street, not water (rejected), so Milwaukee needs a real replacement.
- Lorain extras if wanted for Cleveland/Vermilion: `1MVB3fgg7kg`, `AinDIqEXEu4`, `vDjvX3GlRXM` (Lorain Port Authority / Visitors Bureau lighthouse cams; oEmbed 200 for the first; thumbnails not viewed).

## Still needed
Sackets Harbor, Tawas, Harbor Beach, Marquette, Houghton remain at one cam each pending the Action scouting above or operator permission. Erie and Grand Marais are at two.
