# Cam coverage pass — November 2026

## Result
- 82 water-view cams added to `src/cams.js`. All passed `scripts/verify-cam-candidates.mjs` in the Run script Action (exist and embeddable). Curators confirmed each one shows water from a daytime thumbnail.
- Removed:
  - Chicago Playpen (`ATz12otMpf4`): embedding disabled.
  - Milwaukee Lakefront (`MT5Og9gOKuM`): EarthCam stream, not an allowed provider.
  - Cape May Cove Beach (`gV2Lj_a-IoQ`): shows dunes, no water.
- Dropped candidates:
  - Hilton Head "Westin" Ozolio ID: it actually resolves to a Toledo Zoo aquarium cam.
  - NDBC buoycam panoramas: offshore views, not launch views.
  - One of the three Alpena radio-station cams: duplicate view.
- Spots with 0 cams: 19 → 9. Spots with 1 cam: 43 → 20.

Per-spot candidates and rejects are in `docs/ops/cams-{west,east,lakes}-candidates.md`.

## Still no cam
Juneau, Ketchikan, Sitka, Seward, Homer, Westport, Brookings, Grand Isle, Bath NC.

## Still one cam
Sackets Harbor, Harbor Beach, Marquette, Houghton, Fort Pierce, St. Simons, Charleston, Morehead City, Santa Barbara, San Juan, Fajardo, Astoria, Garibaldi, Coos Bay, Monterey, Humboldt Bay, Norwalk, New Haven, Whittier, Valdez.

## Dead ends checked through the Action
- **NWS Portland bar cams** (weather.gov/pqr/barcams): the page loads its images client-side, and the only static snapshot (`QRiver.jpg`) was last modified in Feb 2025. Stale, so not usable.
- **NWS Alaska Region office cams** (arh.noaa.gov/arhdata/photo/PHOTO_juneau_*.jpg): the host did not respond. It looks retired.
- **Santa Cruz Harbor, Pillar Point Harbor, Port of Brookings bar cam, Alaska Collection (Seward), UAS Juneau:** no embeddable player on the page. These are owner-hosted feeds, so they need permission.

## Owner outreach (draft asks; owner sends)
| Spot | Operator | What to ask |
|---|---|---|
| Houghton | Michigan Tech webcams: `keweenaw-waterway-west-via-glrc.jpg`, `keweenaw-waterway-east-via-glrc.jpg`, `lift-bridge.jpg` (fresh JPEGs under mtu.edu/mtu_resources/php/webcams/cache/) | Permission to show the snapshot with credit and a link back |
| Brookings | Port of Brookings Harbor (Chetco River bar camera) | Embed or snapshot permission |
| Santa Cruz | Santa Cruz Port District (harbor webcams) | Embed permission |
| Half Moon Bay | San Mateo County Harbor District (Pillar Point) | Embed permission |
| Westport | Port of Grays Harbor / Experience Westport | Embed permission |
| Santa Barbara | City of Santa Barbara Waterfront Dept (HarborCam) | Embed permission |
| Sausalito | City of Sausalito / WebCOOS (Galilee Harbor cam) | Public embed access |
| Juneau, Ketchikan, Sitka, Seward, Homer | City harbor departments | Whether any harbor cam can be embedded |
| Charleston | WebCOOS (Folly Beach camera) | Public embed or snapshot access |
| Tawas | tawasbayweather.com | Embed permission |

## Tools
- `scripts/scout-batch.mjs`: scouts many cam pages in one Action run and prints only the usable hits.
- `scripts/probe-cam-pages.mjs`: lists every snapshot, cam or iframe URL on a page, and HEAD-checks guessed snapshot URLs.
- Run either one with the "Run script" workflow, setting the ref to your branch.
