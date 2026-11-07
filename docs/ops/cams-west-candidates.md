# West coast, Alaska and Hawaii cam candidates (2026-11-07)

Input file: `scripts/cam-candidates-west.json` (38 candidates, exact `verify-cam-candidates.mjs` format; one entry per distinct cam, `spot` = nearest launch, other spots it serves are named in `view`). Nothing here is in `src/cams.js` yet.

## How these were checked (sandbox: YouTube and NDBC reachable, everything else blocked)
- **verified here (yt)**: appeared in a YouTube live-filtered search on 2026-11-07, `oembed` returned 200 (exists and embeddable), and the current thumbnail was viewed. The Action run should still confirm `OK` vs `WARN`.
- **verified here (NDBC img)**: `https://www.ndbc.noaa.gov/buoycam.php?station=NNNNN` returned `image/jpeg` with a frame stamped 2026-11-07 14:10 UTC. These are NOAA offshore buoy panoramas (2880x300), not launch views. Many were black at capture (06:10 PST). Treat as low-rank "sea state" cams.
- **needs Action check**: any non-YouTube provider, or a YouTube cam whose thumbnail was stale, a title card, or too dark to judge.
- Windy page URLs and weather.gov, FAA, city, port, Ozolio, Angelcam, WetMet, IPCamLive hosts were unreachable from the sandbox, so no id of those kinds could be confirmed. No such id was invented.

## Coverage after this file (existing within 0.85 deg + proposed, same `lake`)
| Spot | Existing | Proposed | Notes |
|---|---|---|---|
| sausalito / berkeley / alameda / redwood-city | 0 each | 4 each (shared set) | Central Bay views only; Redwood City sees no South Bay cam |
| humboldt-bay | 0 | 2 | Trinidad Bay + buoy |
| brookings | 0 | 2 | both offshore buoys |
| westport | 0 | 1 | offshore buoy only |
| astoria | 0 | 1 | offshore buoy only |
| garibaldi | 0 | 1 | same Columbia bar buoy |
| coos-bay | 0 | 1 | offshore buoy only |
| depoe-bay / newport-or | 1 / 1 | 2 / 2 | buoy + aquarium estuary view |
| half-moon-bay | 1 | 7 | Pacifica set plus Point Reyes plus buoy |
| bodega-bay | 1 | 6 | |
| monterey | 1 | 1 | buoy only: still weak |
| santa-barbara | 1 | 0 | gap |
| olympia | 1 | 3 | Hood Canal x2 + UW |
| seattle / tacoma | 2 / 2 | 3 / 3 | adds UW Lake Washington + Hood Canal x2 |
| honolulu | 0 | 7 | |
| maalaea | 1 | 4 | |
| kona | 1 | 1 | one needs recheck |
| whittier / valdez / sitka | 0 / 1 / 0 | 1 each | offshore/Sound buoy cams, dark at capture |
| juneau, ketchikan, seward, homer | 0 | 0 | still empty (see leads) |

## Candidates by spot

### SF Bay (sausalito, berkeley, alameda, redwood-city), lake "San Francisco Bay"
| Cam | Id | Status | Why it is a water view |
|---|---|---|---|
| Angel Island, Ayala Cove (Angel Island) | yt OIyy1ZmRryM | verified here (dusk thumbnail) | Cove and Raccoon Strait water from the beach; best fit for Sausalito/Berkeley |
| Treasure Island, Alcatraz and bay (ABC7 News Bay Area) | yt _VqvVJfmyfs | verified here (daytime) | Open Central Bay toward Alcatraz |
| Treasure Island, Mersea restaurant (Teleport.camera) | yt BSWhGNXxT9A | verified here, thumbnail is a title card over a bay shot | Shore, bay, Golden Gate. Recheck the live frame |
| Pier 23 Cafe (StreamTime Live) | yt PDKGik7Np88 | verified here (night frame, cruise ship at pier) | Embarcadero piers and bay water |

Rejects: ABC7 Bay Bridge cam (CXYr04BWvmc, bridge deck traffic dominates; borderline) and ABC7 KGO rooftop (G8RIAgPxaMc, Embarcadero street scene); Golden Gate Bridge (MQEu33EtfbI, PicturesqueFM, aggregator-style channel); Pier 39 (6As7EICUBy8, unknown re-streamer); pforce9 "Sausalito Richardson Bay Live Cam" (eTywKp_thcQ, embeddable but not live, it is a VOD); Farallon Islands (fHb0eB9RUgA, wildlife).
Leads (not embeddable here): Sausalito Galilee Harbor bayfront cam (City of Sausalito, announced 2025-10-17, WebCOOS-backed, so needs auth: ask WebCOOS/Galilee Harbor for a public image URL). Cal Sailing Club webcam at Berkeley Marina (Alcatraz view; cal-sailing.org). Sausalito Yacht Club ferry-dock cam. Scout `https://www.oursausalito.com/` webcam pages.

### Northern California Coast (humboldt-bay, bodega-bay, half-moon-bay, monterey)
| Cam | Id | Spot | Status |
|---|---|---|---|
| Pacifica Pier close-up (Chamberlin Nature) | yt BrUaOjjXgZM | half-moon-bay | verified here (on-screen stamp 2026-11-07 06:58) |
| Pacifica Pier and Beach | yt _-_hg_aJrKU | half-moon-bay | needs check: thumbnail stamp was 2020-02-09 |
| Mori Point | yt iQ7XJDXYSMo | half-moon-bay | needs check: thumbnail stamp 2026-02-11 |
| Linda Mar Beach cam | yt TDcKozRHlKs | half-moon-bay | needs check: thumbnail is a title card |
| Marine Mammal Center, Point Reyes shoreline | yt k-rsgU8-Inw | bodega-bay | verified here (cove water, stamp 2026-11-07); lat/lon approximate |
| Trinidad Harbor webcam | yt 31ViUog5FV4 | humboldt-bay | verified here (bay and harbor mouth at dusk), 20 mi north |
| NDBC 46022 Eel River | img buoycam | humboldt-bay | verified here (dark) |
| NDBC 46013 Bodega Bay | img buoycam | bodega-bay | verified here (dark) |
| NDBC 46026 San Francisco | img buoycam | half-moon-bay | verified here (sea visible) |
| NDBC 46042 Monterey | img buoycam | monterey | verified here (sea visible) |

Rejects: Monterey Bay Aquarium tank cams (shark, kelp, open sea, otter, jelly); Destination Monterey "Monterey Webcam" (mP_GOrhtVD4, street intersection) and "Depot Webcam"; Rio Sands Beachcam (hXtYKDio1rQ, embedding disabled and rooftops); Further Reach Mendocino Bay (kRrsAMDCkSo, 60+ mi from Bodega Bay).
Leads for the Action / `cam-scout.yml` directory sweep: `https://santacruzharbor.org/webcams` and `https://www.santacruz.org/webcams/santa-cruz-harbor-cam` (Santa Cruz Harbor entrance, Visit Santa Cruz County added a 2026 harbor cam); `https://www.smharbor.com/pillar-point-harbor-scenes` (Pillar Point; the Harbor District also runs a Surfers Beach camera from Sept 2025); Bodega Marine Reserve Horseshoe Cove cam (UC Davis BOON, `https://boon.ucdavis.edu/tools/coastal-conditions`, a research cam: best `img`/stream candidate for Bodega Bay); NWS Eureka Humboldt Bay bar cam (`weather.gov/eureka/marine`, may be defunct); Windy "Santa Cruz Harbor Westside" (windy.com/webcams/1387798802).

### Oregon Coast (astoria, garibaldi, depoe-bay, newport-or, coos-bay, brookings)
| Cam | Id | Spot | Status |
|---|---|---|---|
| NDBC 46029 Columbia River Bar (20 NM W) | img buoycam | astoria, garibaldi | verified here (dark) |
| NDBC 46050 Stonewall Bank (20 NM W of Newport) | img buoycam | newport-or, depoe-bay | verified here (dark) |
| NDBC 46015 Port Orford | img buoycam | coos-bay, brookings | verified here (dark) |
| NDBC 46027 St Georges | img buoycam | brookings | verified here (dark) |
| Oregon Coast Aquarium, Yaquina Bay (KOIN 6) | yt lc8LAAh2jMI | newport-or, depoe-bay | verified here (estuary in lower third, stamp 2026-11-07). Borderline: town and marsh fill much of the frame |

Rejects: Hatfield "Under Pier" (underwater/grey, _hg-GqSFD8A) and "Blue Whale Camera 2" (building, 4GLOK7W52dE); Port of Kalama (87md001uRvA, night tree/dock, Columbia River 0.78 deg from Astoria, unclear view); Cam Nomad "Pacific Cams" tour (KJNbhGO-OjM, rotating compilation); Seaside Osprey cam; Ko-Kwel Casino.
Leads (the real bar and harbor views; all need an Action run or operator ask):
- `https://www.weather.gov/pqr/barcams` (NWS Portland bar cams: Columbia River bar etc.; government images, best `img` source if direct JPEG URLs exist).
- `https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html` (official Chetco River bar camera; likely a link cam or snapshot).
- `https://www.oregonsadventurecoast.com/live-cam` (Coos Bay/Charleston cams) and USPS Coos Bay bar page `https://www.usps.org/localusps/coos/cbbar.html` (Lower Coos Bay cam, refreshes every 15 s).
- `https://research.oregonstate.edu/port-orford/webcam-and-sea-conditions` (OSU Port Orford cam, 0.7 deg from Brookings, university).
- Port of Garibaldi (portofgaribaldi.org), Port of Newport, Port of Astoria: no public cam page found; ask.

### Washington Coast (westport)
- NDBC 46041 Cape Elizabeth buoy cam: verified here (dark).
- Ozolio ids `WVWC00001849` and `YPVN00001844` appeared in a Westport WA webcam search, but they are `explore` ids (not the `EMB_...` embed oid the verifier expects; the verifier returned 404) and the location is unconfirmed. Not in the JSON.
- Real Westport views: Experience Westport live webcam (marina, Half Moon Bay, jetty; also mirrored on webcamtaxi and liveworldwebcams) and Port of Grays Harbor marina page. Ask Experience Westport for an embed. The NWS/USCG Grays Harbor bar cams may be shut down (AMSEA notice for 2026-07-01).

### Puget Sound (olympia, seattle, tacoma; existing: Shilshole, Everett)
| Cam | Id | Spot | Status |
|---|---|---|---|
| UW Lake Washington cam (UW Video) | yt NCzKkn0wD30 | seattle | verified here. Union Bay and 520 bridge; fresh water, not the Sound |
| Hood Canal Communications, Union boat ramp | yt sFX2tlGIl_Y | olympia | verified here (shoreline, fog) |
| Hood Canal Communications, Union water and mountain cam | yt DNz4t_CRxuI | olympia | verified here; fog-bound at capture |

Rejects: Pierce County "Tacoma skyline" (tB1W4974yFA, skyline only, no water in frame); Seattle Aquarium otter cam; FOX 13 / Seattle Channel news streams; Steel Highway railcams (Olympia-Lacey station); Port of Port Angeles and Bellingham cams belong to the San Juan lake. Leads: Port of Seattle, Port of Olympia, Port of Tacoma harbor cams (no public embed found); PCTV Pierce County cam may offer a Foss Waterway view.

### Hawaii (honolulu, maalaea, kona), lake "Hawaii"
| Cam | Id | Spot | Status |
|---|---|---|---|
| Waikiki South Shore 180 deg (Waikiki Aquarium / UH SOEST) | yt WIUg8wzhq1g | honolulu | verified here (daytime, university cam) |
| Waikiki Beach, Marriott (Ozolio Live) | yt 4CK0CsimBHs | honolulu | verified here (daytime) |
| Waikiki, Park Shore Hotel (Ozolio Plus) | yt kCPppYpcY_s | honolulu | verified here (night: pier and beach only) |
| Ala Moana, Magic Island (WOZ ERE) | yt y5XS3fMISRk | honolulu | verified here (title-card style thumbnail with lagoon and open water). Individual operator |
| Ala Moana, Concessions surf break (Richard Taylor) | yt EuR8OkQxOgk | honolulu | thumbnail is a title card over the surf break; recheck |
| Honolulu Harbor webcam (The Bridge Guy) | yt eCHeZDEVSeU | honolulu | verified here (night frame, overlay stamped 07/11/2026). Individual operator |
| Kahala Resort (Ozolio Live) | yt TZAvviB_o-4 | honolulu | verified here (daytime reef and sea) |
| Kihei, Hale Pau Hana surf cam | yt hPvl6IACa2k | maalaea | verified here (night frame only) |
| Wailea, Fairmont Kea Lani (Ozolio Live) | yt G1zgkkguCyc | maalaea | verified here (daytime) |
| Kaanapali, Sheraton Maui (Ozolio Live) | yt YXji6UQ0bwY | maalaea | verified here (daytime) |
| Napili Kai (Ozolio Live) | yt fwX04Gsb8W4 | maalaea | verified here (daytime) |
| Kohanaiki Web Camera | yt Sb6v9lXIDjc | kona | blurry gray at capture; recheck |

Note on Ozolio-on-YouTube streams: the existing Wailea cam in `src/cams.js` is the same kind of feed, so they follow the same pattern.
Rejects: Whaler Maui "Maui Live Cam" (h-D8aOjlcGc, embedding disabled); Maui Surfer Girls (WbNSQGqLvuI, dark and unclear); MEGA Lab (underwater promo); afarTV Maui whale sanctuary (compilation/title card); AlohaLiveCam Big Island "webcam tour" (cZFdBkHKbH4, rotating); Maui Visitor Channel; Banzai Pipeline (north shore, 30+ mi from Honolulu is fine but not a boating view); Surfline TV (not allowed).
Leads: Kona (still one cam): Royal Kona Resort Kailua Bay cam, Fish Hopper Alii Drive cam, Skyline "Kailua-Kona Bay" (not allowed). Maui: Windfinder "Maalaea Harbor" page; Maui Ocean Center harbor platform. PacIOOS Waikiki Beach Cameras 001/002 are archival (2009 to 2013). Scout `https://www.mauihawaii.org/hawaii-webcams`.

### Alaska (juneau, ketchikan, sitka, seward, homer, whittier, valdez)
- Buoy cams (NDBC, verified here, dark at capture): 46084 Cape Edgecumbe (sitka), 46081 Western Prince William Sound (whittier), 46060 West Orca Bay (valdez). For Seward the nearest buoy cam is 46076 Cape Cleare at 0.93 deg, just outside range; Juneau's 46083 has no image.
- No embeddable harbor cam turned up for Juneau, Ketchikan, Seward or Homer.
- Rejects: EarthCam Sitka (sF5hFDGN20Y, not allowed); PTZtv "Scenic Cameras" stream (y0XPkjM9-P4, rotates Florida/Caribbean and a few Alaska views; not a dedicated harbor cam); The Dragging Anchor (1JoT-YM4kuo, oEmbed 401 = embedding disabled, infrared night frame); Explore.org Mendenhall/Katmai/Brooks Falls (not harbors); Lake Hood seaplane base (Anchorage, not our spots); HDOnTap Homer cams (Inspiration Ridge/northern lights; HDOnTap not an allowed provider).
- Leads to sweep with `cam-scout.yml` (each needs an Action run): `https://alaskacollection.com/plan-your-trip/webcams` (Seward Small Boat Harbor, Kenai Fjords Tours, 5-minute images); `https://uas.alaska.edu/juneau/rec/campusviews.html` (UAS Auke Bay cell-tower cam, university); `https://weather.gov/arh/weathercams` (NWS Alaska cams); `https://www.windfinder.com/webcams/homer_spit1`; FAA WeatherCams at `weathercams.faa.gov` (Ketchikan Airport, Juneau, Sitka, Homer, Seward, Valdez, Whittier sites; direct image URL pattern not confirmed, so check whether the site exposes stable JPEG URLs before using `img`); 511.alaska.gov Whittier and Valdez cameras (road cams, reject unless they face water); Port San Juan Whittier cam (listed inactive). Windy has Seward "East" boat harbor (1585594642) and Juneau Douglas cams (1680337386, 1680335976); these only feed the Windy fallback.
- Outreach candidates (draft emails for the owner): City of Seward Harbormaster, Homer Port and Harbor, Juneau Docks and Harbors, Ketchikan Port and Harbors, Sitka Harbors (all city/borough harbor departments), Kenai Fjords Tours (Seward harbor cam).

## Remaining gaps and asks
- **Empty:** juneau, ketchikan, seward, homer.
- **Weak (only offshore buoy cams, no launch or harbor view):** westport, astoria, garibaldi, coos-bay, brookings, monterey, sitka, whittier. Best fixes: NWS Portland bar cams, Port of Brookings Chetco bar cam, Experience Westport, Santa Cruz Harbor, Pillar Point (Harbor District).
- **Santa Barbara:** still only Channel Islands Harbor (Oxnard, 0.45 deg). The city HarborCam (Waterfront Dept, `santabarbaraca.gov/waterfront`, faces north across City Pier to the breakwater) is the right cam; no embed id found. Ask the Waterfront Department.
- **Kona:** one cam. Kona Inn/Royal Kona/Fish Hopper cams exist on aggregators only.
- **Main-session action:** dispatch Run script on `scripts/cam-candidates-west.json`, then send results back. Also consider `cam-scout.yml` on: santacruzharbor.org/webcams, smharbor.com/pillar-point-harbor-scenes, weather.gov/pqr/barcams, oregonsadventurecoast.com/live-cam, alaskacollection.com/plan-your-trip/webcams, uas.alaska.edu/juneau/rec/campusviews.html, mauihawaii.org/hawaii-webcams.
- **Caveat on buoy cams:** they show offshore sea state, are black at night, and do not show a launch. Rank below any real harbor or beach cam and word the copy as "offshore buoy camera". If you prefer to keep the panel to launch-area views only, drop all 12 `buoycam` entries.
