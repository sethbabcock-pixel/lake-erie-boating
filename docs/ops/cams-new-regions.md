# Cams for the new cold-water regions (audit 2026-11-07)

Method: YouTube live search (live filter) for each spot, then `scripts/verify-cam-candidates.mjs` run locally
(oEmbed: exists + embeddable; every entry below returned WARN = embeddable, live status not provable from this IP
because of the YouTube bot-wall; the search index listed each as LIVE). Each cam's live thumbnail frame was then
viewed. Caveats: the audit ran after dark in the US, so many frames were night shots; several providers use a
static title-card thumbnail (noted). Most regional tourism / harbor sites (santacruzharbor.org, oregonsadventurecoast.com,
discovernewport.com, alaskacollection.com, ...) are not reachable from this sandbox, so non-YouTube providers
(Angelcam / WetMet / IPCamLive / harbor-hosted JPEGs) could not be searched. Follow-up: run `cam-scout.yml`
with those directories (see "Directories to scout").

Entries are already in `src/cams.js` (block "Cold-water coasts"); `lake` values match the `lake:` strings now
in `functions/marine/conditions.js`. `npm run check:cams`: 105 cams, 0 DEAD (102 WARN = bot-wall).

## Verified cams, by spot

### Pacific Northwest
- **seattle** (Puget Sound): Shilshole Bay, Ballard Elks Paddling Club (night frame, bay + shoreline, timestamped cam overlay).
```js
{ name: "Seattle · Shilshole Bay (Ballard Elks Paddling Club)", lat: 47.68, lon: -122.41, yt: "JVTvtCZcSWk", lake: "Puget Sound" },
```
- **everett** (Puget Sound): Port of Everett boat launch (docks + water at dusk).
```js
{ name: "Everett · Port of Everett boat launch", lat: 47.99, lon: -122.226, yt: "ywLLbC8AUyQ", lake: "Puget Sound" },
```
- **tacoma**, **olympia**: no cam of their own. Tacoma and Olympia fall back to the Seattle/Everett cams (within 0.85 deg
  of Tacoma; Olympia gets Shilshole only). Honest empty-ish state.
- **friday-harbor**, **anacortes**, **port-townsend** (San Juan Islands & Admiralty Inlet): shared pool.
```js
{ name: "Friday Harbor · Port of Friday Harbor", lat: 48.535, lon: -123.012, yt: "pr2p_uvmXh8", lake: "San Juan Islands & Admiralty Inlet" },
{ name: "Friday Harbor · Shipyard Cove Marina", lat: 48.526, lon: -123.017, yt: "g2_KQNjZ0vg", lake: "San Juan Islands & Admiralty Inlet" },
{ name: "Port Angeles · Harbor (Port of Port Angeles)", lat: 48.12, lon: -123.43, yt: "TXGu1Kv2bao", lake: "San Juan Islands & Admiralty Inlet" },
{ name: "Bellingham Bay · Marine Park (Port of Bellingham)", lat: 48.72, lon: -122.51, yt: "DH0x6KOTreU", lake: "San Juan Islands & Admiralty Inlet" },
```
  Bellingham Bay frame was very dark (shoreline lights across water); title is explicit and the owner is the Port.
  Re-check in daylight. Port Angeles is on the Strait, ~0.45 deg from Port Townsend; Port Townsend has no cam in its own town.
- **westport** (Washington Coast): none found. Gap: ask Westport Marina / Grays Harbor Historical Seaport / Port of Grays Harbor.

### Oregon
- **newport-or** (Oregon Coast): Yaquina Bay, OSU Hatfield Marine Science Center (bay at night with town lights).
```js
{ name: "Newport · Yaquina Bay (OSU Hatfield)", lat: 44.625, lon: -124.045, yt: "sRPP5b3J_VY", lake: "Oregon Coast" },
```
  Serves depoe-bay (0.2 deg), garibaldi (1.1 deg, nearest-one fallback), astoria (1.6 deg edge) and coos-bay (1.3 deg fallback).
  Honest note: Newport is a bay-bridge/bay view, not a bar view, for the farther spots.
- **astoria, garibaldi, depoe-bay, coos-bay, brookings**: no embeddable water cam found. Brookings: none (nearest cam out of range, empty state).
  Known-but-not-embeddable: Brookings (EarthCam), Newport (Skyline Webcams), Florence Siuslaw (KEZI Sky Cam). Directories only.

### Northern California
- **half-moon-bay**, **bodega-bay**: Sharp Park Beach, Pacifica (surf + beach, daylight frame).
```js
{ name: "Pacifica · Sharp Park Beach surf", lat: 37.62, lon: -122.5, yt: "lmec_rcEIL4", lake: "Northern California Coast" },
```
- **monterey**, **santa-cruz**: Monterey Bay Aquarium "Live Monterey Bay Cam" (rocky shoreline + surf, daylight frame).
```js
{ name: "Monterey Bay · Shoreline (Monterey Bay Aquarium)", lat: 36.618, lon: -121.902, yt: "fVa6-zCBR7A", lake: "Northern California Coast" },
```
- **sausalito, berkeley, alameda, redwood-city** (San Francisco Bay): none added. Candidates were bridge/skyline cams or title-card thumbnails, see rejects.
- **humboldt-bay**: none on YouTube (a bar cam exists on a harbor/KMUD page, not reachable here). **bodega-bay**: only Pacifica (0.7 deg).

### Northeast
```js
// New England Coast
{ name: "Boston · Gloucester Annisquam Yacht Club", lat: 42.66, lon: -70.68, yt: "_j1qgdMnifk", lake: "New England Coast" },
{ name: "Beverly · Jubilee Yacht Club dock", lat: 42.55, lon: -70.85, yt: "5Vf5cSVHtQA", lake: "New England Coast" },
{ name: "Old Orchard Beach · Casco Bay coast", lat: 43.52, lon: -70.38, yt: "HSQpqIWLViI", lake: "New England Coast" },
{ name: "Woods Hole · Harbor (GOMV)", lat: 41.523, lon: -70.671, yt: "5-ClAzUV2UA", lake: "New England Coast" },
{ name: "Barnstable · Harbor", lat: 41.71, lon: -70.3, yt: "cCg-J04fSuQ", lake: "New England Coast" },
{ name: "Provincetown · MacMillan Pier (Dolphin Fleet)", lat: 42.05, lon: -70.18, yt: "Yy-Eo5NMkVE", lake: "New England Coast" },
{ name: "Newport, RI · Sightsailing waterfront", lat: 41.484, lon: -71.315, yt: "yvJlIBJ5m1o", lake: "New England Coast" },
{ name: "Block Island · North Lighthouse", lat: 41.227, lon: -71.58, yt: "ejDld-hWwiU", lake: "New England Coast" },
// Long Island Sound
{ name: "Rocky Point · Tides Beach (Long Island Sound)", lat: 40.96, lon: -72.95, yt: "rBWBGg2c5Jg", lake: "Long Island Sound" },
// New York & New Jersey Coast
{ name: "New York Harbor · Brooklyn (StreamTime)", lat: 40.7, lon: -74.0, yt: "l7b5RFAkKhY", lake: "New York & New Jersey Coast" },
{ name: "New York Harbor · Brooklyn Navy Yard", lat: 40.7, lon: -73.97, yt: "obqnslJKrxc", lake: "New York & New Jersey Coast" },
{ name: "Highlands NJ · Shrewsbury River (Bahrs Landing)", lat: 40.4, lon: -73.99, yt: "Str1003ecZU", lake: "New York & New Jersey Coast" },
{ name: "Holgate · Little Egg Harbor Bay", lat: 39.5, lon: -74.28, yt: "fkE4O-5qsKU", lake: "New York & New Jersey Coast" },
{ name: "Cape May · Cove Beach", lat: 38.93, lon: -74.96, yt: "gV2Lj_a-IoQ", lake: "New York & New Jersey Coast" },
```
Spot coverage: boston (Jubilee, Annisquam, Provincetown, Barnstable), hyannis/buzzards-bay (Woods Hole, Barnstable, Newport,
Provincetown), newport-ri (Sightsailing, Block Island), portland-me (Old Orchard only, ~0.15 deg), norwalk/new-haven (Rocky Point
only; Connecticut shore itself has no cam, Greenwich/Stamford/Mystic/Port Jefferson: none), ny-harbor (2 Brooklyn + Highlands),
barnegat (Holgate, Highlands), cape-may (Cape May Cove, Holgate).
Frame notes: Annisquam, Barnstable, Brooklyn StreamTime, Woods Hole, Block Island and Rocky Point thumbnails were
daylight/title-card images showing water (provider may show a static card; the live frame was not seen). Jubilee, Provincetown,
Holgate, Cape May Cove, Brooklyn Navy Yard are night frames (dock/bay/beach visible). Cape May Cove frame is a dark beach/dune
with water beyond; weakest of the set. Highlands thumbnail dated 2025-12 (a real marina/bridge frame, but old).

### Alaska
```js
{ name: "Valdez · South Boat Harbor (City of Valdez, rotating)", lat: 61.125, lon: -146.35, yt: "JsgsCLKnwB8", lake: "Southcentral Alaska" },
```
City of Valdez live stream rotates through city cameras; the frame seen was the South Boat Harbor. It also surfaces as
the single nearest cam (1.1 deg) for whittier. **juneau, ketchikan, sitka, seward, homer**: zero embeddable water cams found.
Leads (not embeddable here or unverifiable): Seward Small Boat Harbor image (Kenai Fjords Tours, JPEG refresh 5 min), Homer Spit harbor
(Windfinder/Windy), Juneau Harbor (PTZtv, currently only in the rotating PTZtv "Scenic Cameras" stream), Ketchikan/Sitka (FAA
weathercams show airport/float-plane water; EarthCam Sitka not allowed). Candidate "More cams" link: https://aptalaska.com/livewebcams/
(AP&T Alaska cams) and https://alaskacollection.com/plan-your-trip/webcams.

## Rejected candidates
| id | what | why |
|---|---|---|
| tB1W4974yFA | Tacoma PCTV Mountain Cam | Skyline + Mt. Rainier, no water in frame |
| o76PCTDyR0Q | John Wayne Marina, Sequim | Frame blurred by rain; could not tell it shows the marina water |
| 4hw3XEvfUmk | Port of Friday Harbor Airport | Airport, not water |
| fys6aYdwIvs | Orcas Island YC, West Sound | Frame showed parked cars/shore; unclear |
| sFX2tlGIl_Y | Hood Canal Comms, Union boat ramp | Not a planned spot; dark/grainy |
| _hg-GqSFD8A | OSU Newport under-pier | Frame too dark to tell |
| CXYr04BWvmc, G8RIAgPxaMc | ABC7 Bay Bridge / Ferry Building rooftop | Bridge/traffic and Embarcadero views, stock thumbnail |
| _VqvVJfmyfs | ABC7 Treasure Island | Stock thumbnail (Alcatraz + bay) only; live frame not seen. Re-check, could serve Sausalito/Berkeley/Alameda |
| PDKGik7Np88 | Pier 23 Cafe, SF Bay (StreamTime) | Thumbnail was a title card; live frame not seen. Likely good, re-check |
| BSWhGNXxT9A | Mersea restaurant, SF (Teleport) | Skyline-style title card, restaurant view |
| MQEu33EtfbI | Golden Gate (PicturesqueFM) | Embedding disabled (DEAD) |
| BrUaOjjXgZM | Pacifica Pier closeup | Dim frame with crane/structure; unclear |
| 2WmTS_bBwyM | Atlantic City live cams | Boardwalk/beach collage, not a clear water view |
| 3I_cIS24AfY | Boston Harbor, Hyatt (Boston & Maine Live) | Title-card skyline; live frame not seen |
| 1kvGNR_A3DY | NYC from St. George Tower | Night skyline-dominated frame |
| xIxvTSVeHGk | Above the Hook, Highlands/Sandy Hook | Graphic title card only; Bahrs Landing used instead |
| rArvNLNmhOo | Portland Head Light / Casco Bay | Frame black (night) with weather widget; title says Casco Bay. Re-check in daylight, strong candidate for portland-me |
| _OeFhA2XqqA | Cape Cod Canal (MMA) | Night frame unreadable. Re-check in daylight, strong candidate for buzzards-bay |
| XTlwxO5bCUA | Heights Beach, Falmouth | Dark frame |
| 4G2_gC7P32E | Sebasco Harbor Resort | Embedding disabled (DEAD) |
| 1JoT-YM4kuo | The Dragging Anchor (Homer) | Embedding disabled (DEAD); also a bar |
| 61pi8UjLOlo | Lake Hood Seaplane Base, Anchorage | Not a planned spot; seaplane lake, 1.3+ deg from Whittier |
| M7n9cyLo9aQ, syUwhlkKI5Y, ffEAlQlLXFY | Shelter Island ferry, Montauk, Great South Bay | Peconic/Atlantic/south shore, not Long Island Sound |
| y0XPkjM9-P4 | PTZtv scenic rotation | Rotating graphic, no single water view |
| (n/a) | EarthCam (NYC, Statue of Liberty, Coney Island, Sitka, Brookings), Skyline Webcams (Newport OR) | Not allowed providers |

## Gaps and asks (for operators / "More cams" links)
- Puget Sound: Tacoma (Foss Waterway / Point Defiance marina), Olympia (Port of Olympia, Budd Inlet).
- Washington coast: Westport Marina, Grays Harbor bar. Oregon: Astoria/Columbia bar, Garibaldi, Depoe Bay (Whale Watching Center), Coos Bay/Charleston, Brookings.
- SF Bay (Sausalito, Berkeley, Alameda, Redwood City), Half Moon Bay/Pillar Point harbor, Santa Cruz Harbor (harbor-run webcam, santacruzharbor.org), Humboldt Bay bar cam.
- Connecticut shore (Norwalk, Stamford, Greenwich, Mystic), Port Jefferson, Barnegat Inlet itself, Boston Harbor from the water side.
- Alaska: Juneau/Auke Bay, Ketchikan, Sitka, Seward, Homer, Whittier: all empty. Seward and Homer harbors have small-boat-harbor webcams on
  tour-operator sites; ask Kenai Fjords Tours / Homer Port & Harbor for embed permission.

## Directories to scout (cam-scout.yml `directory`)
https://santacruzharbor.org/webcams, https://www.oregonsadventurecoast.com/live-cam, https://www.discovernewport.com/webcams-newport,
https://aptalaska.com/livewebcams/, https://www.santacruz.org/webcams/santa-cruz-harbor-cam

## Re-check list (YouTube bot-wall: liveness unconfirmed for all)
Everything above is WARN. After the next `cam-health.yml` run, any DEAD feed opens an issue. Do a daylight frame check of
Bellingham Bay, Provincetown, Holgate, Cape May Cove, Jubilee YC; promote Portland Head Light, Cape Cod Canal, Pier 23 and
ABC7 Treasure Island if their daylight frames show water.
