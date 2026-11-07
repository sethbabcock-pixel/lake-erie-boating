# East / Gulf / Caribbean cam candidates (2026-11-07, ~10:00 US Eastern, daylight)

Input for `scripts/verify-cam-candidates.mjs`: `scripts/cam-candidates-east.json` (56 rows). Several cams serve more than one spot, so
the JSON repeats a `kind`+`id` under each spot; add each cam to `src/cams.js` once (`nearestCams()` matches by distance + `lake`).

Method: YouTube live search, oEmbed (HTTP 200 = embeddable; 401 = embedding off), live thumbnail viewed. Only YouTube was reachable;
every YouTube cam below is **embeddable and listed LIVE by the search index, thumbnail viewed** ("verified here") but liveness is
still unproven (bot-wall), so the Action may print WARN. Non-YouTube hosts (Ozolio, harbor/tourism sites, WebCOOS) were
unreachable, so those are "needs Action check" or leads only (no ids invented).

## Remove from src/cams.js (exact names)
- `Cape May · Cove Beach` (gV2Lj_a-IoQ): daylight frame is dune grass and sky, no water visible. Replace with Sea Isle City cams below.

Re-checked and **keep** (daylight frames show water): `Beverly · Jubilee Yacht Club dock` (harbor + docks, grey), `Provincetown · MacMillan Pier (Dolphin Fleet)`
(boats at pier), `Holgate · Little Egg Harbor Bay` (bay + docks), `New York Harbor · Brooklyn Navy Yard` (harbor + skyline, good).
Title-card thumbnails over water (live frame not seen, keep): `Boston · Gloucester Annisquam Yacht Club`, `Barnstable · Harbor`, `Woods Hole · Harbor (GOMV)`,
`Block Island · North Lighthouse`, `New York Harbor · Brooklyn (StreamTime)`. `Rocky Point · Tides Beach` thumbnail is a sunset beach/water still, weakest of these; keep but re-check.
Promoted from earlier rejects: **Portland Head Light** (rArvNLNmhOo: rocks + Casco Bay, daylight) and **Cape Cod Canal** (_OeFhA2XqqA: canal + bridge, daylight).

## Per spot (existing in range + proposed = total)
"VH" = verified here. "Action" = needs Action check.

| spot | existing | proposed | total | notes |
|---|---|---|---|---|
| portland-me | 1 | 3 | 4 | Portland Head Light (VH), Scarborough Beach surf (VH, thumbnail looked like a promo photo), Cape Porpoise outer harbor (VH, card) |
| boston | 4 | 4 | 8 | Weymouth Fore River (card), Nahant Ocean House (VH), Plum Island (VH), Jubilee SW (VH). Barnstable at the 0.84 deg edge |
| hyannis | 3-4 | 3 | 6+ | Cape Cod Canal, Edgartown, Vineyard Haven (all VH) |
| buzzards-bay | 3 | 1 | 4 | Canal (shared) |
| newport-ri | 2 | 1 (shared) | 3+ | Edgartown 0.62 deg; Vineyard Haven (0.54) and Woods Hole also in range. No cam in Narragansett Bay besides Sightsailing |
| norwalk | 1 | 0 | 1 | GAP, only Rocky Point (0.37 deg) |
| new-haven | 1 | 0 | 1 | GAP, only Rocky Point |
| ny-harbor | 3 | 1 | 4 | East River NYC Ferry E 34th St (VH; river view, borderline) |
| barnegat | 2 | 1-2 | 3-4 | Margate (0.6 deg), Sea Isle (0.76 deg) |
| cape-may | 2 (1 removed) | 3 | 4 | Sea Isle Beach Patrol + Spinnaker (both VH), Margate (VH). None shows Cape May Inlet itself |
| tybee | 0 | 2 | 2 | Sea Pines Beach Club (VH, 0.1 deg), Upper East River "Savannah River View" (Action; title only, location unconfirmed, thumbnail river + bridge) |
| hilton-head | 0 | 2 | 2 | Sea Pines Beach Club (VH), Westin Ozolio (Action; page id YQCM0000134E seen in search, `EMB_` prefix assumed) |
| st-simons | 0 | 0 | 0 | GAP |
| charleston | 0 (Myrtle Beach is 1.2 deg away) | 0 | 0 | GAP, see leads |
| murrells-inlet | 1 | 3 | 4 | Surfside Pier (VH), Express Watersports dock (card; Ozolio page confirms Murrells Inlet), Elliott Beach Rentals (VH dim frame, North Myrtle) |
| wrightsville | 0 | 3 | 3 | Johnnie Mercer's Pier S + N (VH), Bald Head Island Beach Access 15 (VH, 0.35 deg) |
| morehead-city | 0 in range (Nags Head 1.2 deg) | 1 | 1 | Rhumbar Beaufort deck over Taylor Creek (VH); it is a bar's exterior deck, docks and water in frame. Drop if you want zero bar-affiliated cams |
| bath-nc | 0 | 0 | 0 | GAP |
| fort-pierce | 0 in range (Cocoa 0.85+) | 1 | 1 | Jupiter Reef Club cam 2 at 0.55 deg |
| jupiter | 0-1 | 1 | 1-2 | Jupiter Reef Club cam 2 (VH, beach and surf; coords 26.921,-80.067 from a webcam listing) |
| palm-beach | 1 (Fort Lauderdale 0.67 deg) | 4 | 5 | JRC2, Deerfield Pier + Beach (cards, Deerfield Beach Live; sister cams of theirs are OFFLINE, so confirm), Dania Pier (0.7 deg) |
| marco-island | 0 | 1 | 1 | Fort Myers Beach cam at 0.6 deg; GAP for local |
| naples | 0-1 | 2 | 2-3 | Fort Myers Beach x2 at 0.38 deg |
| fort-myers-beach | 1 (Siesta Key 0.8 deg) | 3 | 4 | Visit Fort Myers webcam, Margaritaville License to Chill, Pine Island Four Winds Marina (all VH) |
| orange-beach | 1 | 4 | 5 | FOX10 aerial, The Moorings marina, Turquoise Place beach, Perdido Key (all VH). Beach Club Resort & Spa (l2em7gqBj00) is almost surely Gulf Shores but the title has no city: not in JSON |
| mobile-bay | 1 | 1 | 2 | Fairhope Municipal Pier (VH) |
| biloxi | 0 in range (Coastal SkyCams 1.1 deg) | 1 | 1 | D'Iberville Back Bay water + bridge (VH). GAP for Gulf side |
| grand-isle | 0 | 0 | 0 | GAP |
| galveston | 1 | 4 | 5 | Seawall surf, Yacht Basin marina, Ship Channel, Cruise terminals (all VH) |
| kemah | 1 | 2 (shared) | 3 | Galveston Yacht Basin + Ship Channel at 0.25-0.3 deg. No Clear Lake / Kemah cam |
| port-aransas | 0 | 2 | 2 | Aransas Pass Harbor Park (VH), Packery Channel surf (card) |
| south-padre | 1 | 3 | 4 | Courtyard beach, Queen Isabella Causeway/Laguna Madre (VH), Isla Blanca surf co (card) |
| san-juan | 1 | 0 | 1 | GAP |
| fajardo | 1 (Isla Verde 0.49 deg) | 0 | 1 | GAP |

## Rejects
| id / cam | why |
|---|---|
| gV2Lj_a-IoQ Cape May Cove | no water in frame (existing; remove) |
| 7TYPekQAoZs Old Sloop (Rockport MA) | oEmbed 401, embedding disabled |
| 90Dq7oxyE6A Cherry Grove, qUfyZ66eRHI Wilmington Riverwalk | oEmbed 401, embedding disabled |
| bDwBwOLG_Hw Newport Yacht Club HarbourCam | search suggests Rochester NY (Irondequoit Bay), not Newport RI |
| Zot8ShPuuKg / TXQcLxneF5A Northport Pier Ferry | Michigan, not Long Island |
| 9S4VUEFfo_g Ocean City Fishing Club | empty sand frame |
| 1l-nqyyhzro, 2WmTS_bBwyM, vVyBOU9Huvo | Ocean City / Atlantic City collage and boardwalk |
| WkjZg22TBfQ, VsuSbXPN93o Newburyport | streets |
| aZ0tx7eeLYU Galveston Murdochs | pier shop and street |
| ceV1NZCTH0o Harbour Town Clubhouse, Z3hu1sZF40Y et al Palmetto Dunes | golf |
| 1FYgBpkM7SA Jupiter Reef Club cam 1 | pool, blurred lens |
| g4fuUj6X7GY Enclave, uK-eZz0w-go Pink Shell, spyttB6YiaU Fins Up | pool decks |
| ZtrNffrXPdw Sanibel Lighthouse | lighthouse and trees, no water |
| kpWnoebtRSI Downtown Fort Myers | road in foreground, river only at edge |
| zclpD3QKEK4 Pompano | dark frame |
| DscmQzgXAYw Sunset Beach Pier | black frame (re-check) |
| 3NjeXF2dvBM Falmouth ME Town Landing | window glare and weather overlay, water unclear |
| KfELrHrocmQ Chatham Fish Pier | foggy four-up of the pier deck, water unclear |
| qjgslTtqcOk Sea Tow Harborcam | marina in rain; "South Shore" could be Long Island or Massachusetts, unconfirmed |
| 3I_cIS24AfY Boston Hyatt | skyline card |
| En6HTsRLAAU, PdudbIiVIKQ River City Cafe | ad cards; Express kept above, River City unclear |
| cVRG4zYdUP0 Tony Silvagni Hamlet Ave | location unconfirmed (Wrightsville vs Carolina Beach) |
| EarthCam / Skyline (Marco Island, Naples, Sanibel, Seaside Heights, Statue of Liberty) | disallowed providers |

## Leads for the Action / scout (not in JSON, no ids)
- Charleston: Folly Beach Tides Hotel cam (visitfolly.com/?p=10668), WebCOOS Folly 6th Ave beachfront camera (webcoos.srv.axds.co/cameras, `img`), SECOORA Charleston flood-camera network, USGS Cooper River at Filbin Creek cam, Charleston Branch Pilots pier cam, Coastal Conservation League Pelicam, Hotel Tybee beach cam.
- Hilton Head: Shelter Cove Marina and Broad Creek webcams (Island Packet list), Windfinder Singleton Beach.
- Fort Pierce: visitstlucie.com/fort-pierce-inlet-webcam-surf (inlet and jetty), City Marina cam, IRSC Marine Science Center cam (St. Lucie County Tourism trio).
- Port Aransas: UTMSI pier ship-channel cam (utmsi.utexas.edu/currents-weather), portaransas.org/plan/webcam (900 N Station St cam), The Preserve at Farley Boat Works, Dolphin Docks, TAMUCC Lighthouse.
- Grand Isle: townofgrandisle.com camera page (?p=2256), cruisingearth Grand Isle Beach (may be offline).
- Ozolio explore pages seen (Fort Myers area, ids from search, camera content unknown): IKMS000015B0 North Fort Myers, plus OIIQ000014A7, FWAU000015BA, QAFB000014A2, BPBP0000173B, IWIS00001740, FQOH000015B5. Check which are water views, embed id likely `EMB_<id>`.
- Fajardo: Windfinder Villa Marina, El Conquistador resort cam (livebeaches). San Juan: Windfinder, USGS PR cams.
- Jupiter: Town of Jupiter "Jup Life" live cams (jupiter.fl.us/livecams), Jupiter Inlet North Jetty (surf-forecast). Naples/Marco: none embeddable found; paradisecoast.com/places-to-go/web-cams.
- Connecticut shore, St. Simons / Brunswick, Bath NC: nothing found at all; draft operator outreach (Jekyll/Golden Isles, Norwalk/Mystic harbor masters, Bath/Washington NC waterfront).

## Notes for the main session
- Express Watersports and Westin Hilton Head have Ozolio pages; if the YouTube row for Express fails, try `ozolio` id `EMB_EQPH00001687` (page id EQPH00001687 seen in search, prefix assumed).
- Coordinates are approximate venue locations (not read from the streams); Jupiter Reef Club's come from a webcam listing.
