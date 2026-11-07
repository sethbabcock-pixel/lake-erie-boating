# Coastal webcam audit — 2026-11-06

**Trigger:** St. Augustine's Live Cams panel showed an I-95 traffic cam ("Saint Augustine South (Windy · replay)").

**Root cause:** No coastal spot had a single curated cam, so all 60 coastal spots relied on Windy's nearest webcam. That ranking put water cams first but still showed a non-water cam when it found nothing better.

## What changed
- **Windy fallback is water-only.** A Windy cam is used only if its categories or title indicate water and nothing indicates a road (traffic, highway, I-95, US-1, street, etc.). Otherwise the panel shows its honest empty state instead of a wrong view. (`fetchWindyCams()`, `functions/marine/conditions.js`)
- **52 curated water-view cams added** across every coastal region (`src/cams.js`). Spots with no curated cam within about 60 mi: **60 → 14.**
- **Ended streams are hidden client-side.** If YouTube says a stream is no longer live, the player hides it rather than replaying an old recording (`src/Cams.jsx`).
- **New `webcam-curator` agent** owns this list from now on (`.claude/agents/webcam-curator.md`).
- **New `scripts/verify-cam-candidates.mjs`** is run via the *Run script* GitHub Action. It checks each candidate with YouTube oEmbed (exists, allows embedding, real title and channel) or the provider's player before it ships.

## How candidates were vetted
- 104 candidates came from web research. Every one was run through the verifier in GitHub Actions.
- **Rejected (≈50):** gone or private, embedding disabled, verified not live (ended streams), or the title showed a non-water or unrelated video. One "Port Miami" id is now a craps video.
- **Also rejected:** EarthCam, Skyline, unknown re-streamers, and one-off hurricane streams.
- **Shipped:** only dedicated 24/7 cams from identifiable operators. These are TV stations (FOX 13, ABC13, WFAA, WPDE), PTZtv, FloridaKeysTV, Ozolio, HD Beach Cams, county beach services, and hotels, marinas or bars filming the water.

**Limitation:** YouTube bot-walls datacenter IPs, so "live right now" could not be confirmed server-side for most cams. The site's YouTube player does that check in each viewer's browser and hides cams that are offline or ended. The weekly `cam-health` run keeps checking existence and embeddability.

## Remaining gaps (no curated cam within ~60 mi)

| Spot | Best lead (needs the operator's embed id or permission) |
|---|---|
| fort-pierce | Visit St. Lucie "Fort Pierce Jetty" + City Marina cams (reportedly paused) |
| st-simons | Golden Isles CVB Pier Village cam (goldenisles.com/webcams) |
| tybee / hilton-head | Sea Pines livestreams, Palmetto Dunes Shelter Cove Marina, Harbour Town |
| charleston | WebCOOS / NOAA `nwlon_charleston` (Branch Pilots pier, harbor view) |
| wrightsville | Johnnie Mercer's Pier cams (streams currently offline); Surfchex |
| morehead-city | WebCOOS `nwlon_duke_marine_lab` (Beaufort waterfront) |
| bath-nc | none found |
| biloxi, grand-isle | none embeddable (Skyline/aggregators only) |
| honolulu | Ala Moana/Magic Island streams exist but are offline |
| harbor-beach (Lake Huron) | Harbor Beach marina PTZ cam (thumbwind.com list) |

Other leads:
- **Sebastian Inlet:** SITD north-jetty snapshot (floridastateparks.org), offline during jetty work.
- **Palm Beach Inlet:** PTZtv / PBC ERM cams.
- **Port Aransas:** WebCOOS UTMSI pier cams.
- **Santa Barbara:** the city HarborCam.

The WebCOOS cameras are NOAA-funded snapshot cams, the best fit for our `img` type. Ask WebCOOS (SECOORA / Axiom) about a public image URL. The owner sends that request.

## Update — visual frame check (later on 2026-11-06)
With YouTube thumbnails and Windy previews now reachable, every shipped coastal cam's current frame was checked by eye.
- **Pulled 15 cams** (sethbabcock-pixel/lake-erie-boating#83). Reasons:
  - Frames frozen since 2024–2026: Middle River, Seal Beach, Oceanside ×2, Channel Islands wildlife.
  - No water in view or a street scene: Sanibel, Fort Myers Beach Margaritaville, Galveston seawall surf, South Padre Laguna Madre.
  - Broadcast down: Murrells Inlet WPDE.
  - No live frame: Ponce NE, Port Aransas, Okaloosa, Dana Point ×2.
- **Added 3 cams**, each live today with water in view: Havre de Grace (upper Chesapeake), Baltimore shipping channel (StreamTime), Myrtle Beach oceanfront.
- **The water-only Windy fallback** now fills 7 spots with real water cams, all checked visually: St. Simons, Tybee, Hilton Head, Charleston, Wrightsville, Morehead City, Honolulu.

**Live coverage:** curated 36 coastal cams. Spots with no cam at all: Fort Pierce, Marco Island, Naples, Fort Myers Beach, Biloxi, Grand Isle, Port Aransas, Newport Beach, Long Beach, Bath NC, Harbor Beach.

**Why they're empty:** each was searched. They have only EarthCam, Skyline or HDOnTap cams (not allowed), Ozolio cams without a public embed id, WebCOOS cams behind authentication, or streams that have ended.

**Next steps (owner sends outreach):**
- Ask Visit St. Lucie (Fort Pierce jetty), Bath Harbor, and Express Watersports in Murrells Inlet (Ozolio EQPH00001687) for an embed.
- Ask WebCOOS/SECOORA for public image URLs. That covers UTMSI Port Aransas, Charleston and Beaufort.

**Note for the curator:** an `*_live.jpg` thumbnail can exist for a dead stream. Trust an on-screen timestamp, or the frame itself, over the HTTP status.
