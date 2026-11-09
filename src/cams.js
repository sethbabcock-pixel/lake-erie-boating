// Live cams (Great Lakes + coastal regions). The property present decides how each renders:
//   iframe  → angelcam / wetmet / ipcamlive / ozolio / youtube (channel or video)
//   image   → refreshing JPEG snapshot (NOAA GLERL, etc.)
// All entries are verified live + embeddable (no X-Frame-Options) by
// scripts/check-cams.mjs, which the cam-health GitHub Action runs weekly.
// Great Lakes entries were re-audited 2026-11-09 for what each cam actually SHOWS
// (not the host site's name) — see docs/ops/cams-great-lakes-audit-2026-11.md.
export const CAMS = [
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
  // Lake Ontario (2026-11-09 audit). Removed: Oswego SUNY Hart Hall (campus view), Olcott Harborcam (YouTube id 404).
  { name: "Rochester · Charlotte-Genesee Light", lat: 43.22, lon: -77.62, yt: "NHDgasBPtRY", lake: "Lake Ontario" },
  { name: "Sodus Bay · Sodus Point marina (WROC)", lat: 43.27, lon: -76.97, yt: "68XVh5TcgBk", lake: "Lake Ontario" },
  { name: "Lyndonville · Lake Ontario shore", lat: 43.36, lon: -78.39, yt: "w2COKOM5USU", lake: "Lake Ontario" },
  // Navy Point Marine's own YouTube stream (embedded on navypointmarine.com/live); oEmbed 200, current thumbnail = dock basin + boats
  { name: "Sackets Harbor · Navy Point Marine docks", lat: 43.95, lon: -76.123, yt: "DzhFkmug-Ec", lake: "Lake Ontario" },
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
  // Lake Superior (audited 2026-11-09: every cam below was seen on a thumbnail/snapshot or has an operator label naming a water view)
  { name: "Duluth · Canal Cam", lat: 46.78, lon: -92.08, yt: "HPS48TMmNag", lake: "Lake Superior" },
  { name: "Duluth · South Pier Lighthouse", lat: 46.78, lon: -92.08, yt: "a-ADUhRp0yk", lake: "Lake Superior" },
  { name: "Duluth · Pier B", lat: 46.78, lon: -92.08, yt: "c1kfkIoF0k0", lake: "Lake Superior" },
  { name: "Silver Bay · Marina (Duluth Harbor Cam)", lat: 47.295, lon: -91.257, yt: "zTVWJ3Mc0Ag", lake: "Lake Superior" },
  { name: "Grand Marais · Harbor Cam", lat: 47.75, lon: -90.33, yt: "n0H5FkWkjjs", lake: "Lake Superior" },
  { name: "Bayfield · Port Superior Marina", lat: 46.757, lon: -90.864, angelcam: "m1ervgoxr7", lake: "Lake Superior" },
  { name: "Bayfield · Pikes Bay Marina", lat: 46.83, lon: -90.83, yt: "O8kPCPZEFE4", lake: "Lake Superior" },
  { name: "Saxon Harbor, WI · Marina", lat: 46.565, lon: -90.437, ipcamlive: "saxonharbor", lake: "Lake Superior" },
  { name: "Isle Royale · Mott Island dock (NPS)", lat: 48.108, lon: -88.556, img: "https://www.nps.gov/webcams-isro/mottmain.jpg", link: "https://www.nps.gov/isro/learn/photosmultimedia/webcams.htm", lake: "Lake Superior" },
  // Florida Atlantic Coast (2026-11 water-cam audit — every entry is a 24/7 water view;
  // YouTube confirmed it exists + allows embedding; the player hides any that are offline)
  // Coastal review applied 2026-11-09 (docs/ops/cams-coastal-review-2026-11.md), non-Great Lakes entries:
  //   REMOVED (not water / stale / no frame): Gulf Shores-Fairhope SkyCams, Oceanside Rooftop Bar, Pacifica Sharp Park / Pier & beach / Mori Point,
  //   Highlands NJ Bahrs Landing, East River NYC Ferry, Kohanaiki, Beverly Jubilee (southwest), Beaufort Rhumbar, Dania Beach Pier,
  //   Galveston Seawall surf / Cruise terminals, Aransas Pass Harbor Park. Also dropped (unverifiable, spot well covered): Honolulu Harbor
  //   (eCHeZDEVSeU, frame clock stuck on 7 Nov) and Concessions surf break (EuR8OkQxOgk, personal channel, rights unconfirmed).
  //   WEAK, dropped because the spot keeps other cams: Sombrero Beach, Marathon Sunset Grille, Frenchy's, Fort Lauderdale PTZtv, both Fort Myers Beach cams,
  //   Galveston Yacht Basin + Ship Channel, South Padre Sand Rose + Queen Isabella, Fairhope pier, Sea Pines, Surfside Pier, Pacifica Pier close-up,
  //   Angel Island, Channel Islands Harbor, Everett launch, Union Bay (freshwater), Hood Canal ramp, Oregon Coast Aquarium, Newport RI Sightsailing, Cape Cod Canal.
  //   WEAK, kept as the spot's only cam: Galveston ABC13, Trinidad Bay, Isla Verde (Royal Sonesta).
  { name: "St. Augustine · Matanzas River & Bridge of Lions", lat: 29.892, lon: -81.31, yt: "uLJBad4vSno", lake: "Florida Atlantic Coast" },
  { name: "St. Augustine Beach · Surf Station surf cam", lat: 29.85, lon: -81.264, yt: "H2q_DJc33kg", lake: "Florida Atlantic Coast" },
  { name: "Port Canaveral · Harbor (Gator's Dockside)", lat: 28.41, lon: -80.62, yt: "mQnOcuGV334", lake: "Florida Atlantic Coast" },
  { name: "Cocoa Beach · Surf", lat: 28.32, lon: -80.607, yt: "6QmQtFXG9vM", lake: "Florida Atlantic Coast" },
  { name: "Cocoa Beach · Surfer's View", lat: 28.33, lon: -80.607, yt: "gAvFqhNwZm0", lake: "Florida Atlantic Coast" },
  { name: "Miami · PortMiami channel", lat: 25.77, lon: -80.16, yt: "i8ScwT2PT-0", lake: "Florida Atlantic Coast" },
  { name: "Miami · Biscayne Bay", lat: 25.79, lon: -80.18, yt: "4mM_w7P5cWw", lake: "Florida Atlantic Coast" },
  // Florida Keys
  { name: "Islamorada · Little Basin (Florida Bay)", lat: 24.93, lon: -80.62, yt: "HfSOXLUtYmA", lake: "Florida Keys" },
  { name: "Islamorada · Charter boat docks", lat: 24.93, lon: -80.6, yt: "8ShFKuTCmhQ", lake: "Florida Keys" },
  { name: "Islamorada · Lazy Days oceanfront", lat: 24.91, lon: -80.64, yt: "5pFDytRb4Qc", lake: "Florida Keys" },
  { name: "Key West · Harbor (PTZtv)", lat: 24.56, lon: -81.808, yt: "iHJbTrQSZys", lake: "Florida Keys" },
  { name: "Key West · Bight Marina", lat: 24.561, lon: -81.801, yt: "Y5ypYTZs-7o", lake: "Florida Keys" },
  // Florida Gulf Coast
  { name: "Clearwater Beach · Pier 60 (FOX 13)", lat: 27.977, lon: -82.829, yt: "S8-G3uJOqZw", lake: "Florida Gulf Coast" },
  { name: "St. Petersburg · Waterfront (FOX 13)", lat: 27.76, lon: -82.633, yt: "OeYHEp9_KYk", lake: "Florida Gulf Coast" },
  { name: "Siesta Key · Beach", lat: 27.265, lon: -82.553, yt: "GU5CkKxOPbM", lake: "Florida Gulf Coast" },
  { name: "Panama City Beach · Pineapple Willy's Pier", lat: 30.18, lon: -85.81, yt: "0pLm61T8qCU", lake: "Florida Gulf Coast" },
  { name: "Destin · Gulf beach", lat: 30.38, lon: -86.48, yt: "_Zqi24i0fl4", lake: "Florida Gulf Coast" },
  { name: "Pensacola Beach · Pier", lat: 30.328, lon: -87.142, yt: "O6fLjzZLALY", lake: "Florida Gulf Coast" },
  { name: "Pensacola · Bay", lat: 30.4, lon: -87.2, yt: "O-tdY-lbISg", lake: "Florida Gulf Coast" },
  // Alabama & Mississippi Coast
  // Louisiana & Texas Coast
  // WEAK, kept 2026-11-09: ~40% road, but it is the only Galveston/Kemah cam left (the Yacht Basin and Ship Channel cams were weaker and dropped). Frame carried a live clock.
  { name: "Galveston · Seawall beach (ABC13)", lat: 29.29, lon: -94.79, yt: "HkHhXsWci7Q", lake: "Louisiana & Texas Coast" },
  // Georgia & South Carolina / North Carolina / Chesapeake
  { name: "Nags Head · Jennette's Pier", lat: 35.91, lon: -75.6, yt: "sgnlB7lhknM", lake: "North Carolina Coast" },
  { name: "Kitty Hawk · Oceanfront (Twiddy)", lat: 36.07, lon: -75.7, yt: "WEhuDqlxHmM", lake: "North Carolina Coast" },
  // Southern California Coast (2026-11 audit: every entry is a YouTube live stream with
  // embedding allowed (oEmbed 200) that showed up in YouTube's "Live" filter and whose frame
  // shows water. South to north.)
  { name: "San Diego Bay · Shelter Island", lat: 32.714, lon: -117.227, yt: "ct7IRmzDggk", lake: "Southern California Coast" },
  { name: "Mission Bay · San Diego Rowing Club", lat: 32.7835, lon: -117.254, yt: "7esMbPeSjpk", lake: "Southern California Coast" },
  { name: "Huntington Beach · Pier & surf (City of HB)", lat: 33.6555, lon: -118.0033, yt: "mhQjsLBfOoY", lake: "Southern California Coast" },
  { name: "Redondo Beach · King Harbor (City)", lat: 33.846, lon: -118.393, yt: "Ni7v-aIa3bw", lake: "Southern California Coast" },
  { name: "Redondo Beach · King Harbor Yacht Club channel", lat: 33.845, lon: -118.395, yt: "g1IHHYlgzy8", lake: "Southern California Coast" },
  { name: "Santa Monica · Beach & Pier (explore.org)", lat: 34.0095, lon: -118.4975, yt: "v97JpT3ZA0w", lake: "Southern California Coast" },
  // Hawaii & Puerto Rico
  { name: "Kona · Keauhou Bay", lat: 19.56, lon: -155.96, yt: "RxDQLIwxyhA", lake: "Hawaii" },
  { name: "Maui · Wailea Beach", lat: 20.68, lon: -156.44, yt: "mrUciA_XZxA", lake: "Hawaii" },
  // FIX 2026-11-09: oEmbed title is "Royal Sonesta San Juan Live Cam" (pool/hotel, beach strip <10% of frame). WEAK: kept only because it is the sole Puerto Rico cam.
  { name: "Isla Verde · Royal Sonesta resort (beach strip)", lat: 18.4455, lon: -66.0185, yt: "taI7GiyvDxE", lake: "Puerto Rico" },
  // Added after a visual frame check (2026-11-06)
  { name: "Havre de Grace · Upper Chesapeake (Decoy Museum)", lat: 39.545, lon: -76.09, yt: "uOC4CPHiOFM", lake: "Chesapeake Bay" },
  { name: "Baltimore · Shipping channel (StreamTime)", lat: 39.22, lon: -76.52, yt: "t_VfYNtprYE", lake: "Chesapeake Bay" },
  { name: "Myrtle Beach · Oceanfront (Captain's Quarters)", lat: 33.69, lon: -78.89, yt: "GKOyGoRE0Tg", lake: "Georgia & South Carolina Coast" },
  // Cold-water coasts (2026-11-07 audit, docs/ops/cams-new-regions.md). Thumbnail frame
  // checked for a water view; YouTube confirmed it exists + allows embedding.
  // Puget Sound / San Juans / Admiralty Inlet
  { name: "Seattle · Shilshole Bay (Ballard Elks Paddling Club)", lat: 47.68, lon: -122.41, yt: "JVTvtCZcSWk", lake: "Puget Sound" },
  { name: "Friday Harbor · Port of Friday Harbor", lat: 48.535, lon: -123.012, yt: "pr2p_uvmXh8", lake: "San Juan Islands & Admiralty Inlet" },
  { name: "Friday Harbor · Shipyard Cove Marina", lat: 48.526, lon: -123.017, yt: "g2_KQNjZ0vg", lake: "San Juan Islands & Admiralty Inlet" },
  { name: "Port Angeles · Harbor (Port of Port Angeles)", lat: 48.12, lon: -123.43, yt: "TXGu1Kv2bao", lake: "San Juan Islands & Admiralty Inlet" },
  { name: "Bellingham Bay · Marine Park (Port of Bellingham)", lat: 48.72, lon: -122.51, yt: "DH0x6KOTreU", lake: "San Juan Islands & Admiralty Inlet" },
  // Oregon coast
  { name: "Newport · Yaquina Bay (OSU Hatfield)", lat: 44.625, lon: -124.045, yt: "sRPP5b3J_VY", lake: "Oregon Coast" },
  // USCG bar cams via ODOT TripCheck (government JPEGs; frames seen 2026-11-09, timestamps current, not the "This image is currently unavailable" placeholder).
  // NOT added: Barview Jetty, Chetco River (brookings), Grays Harbor Westport (westport), Siuslaw River, Yaquina Bay: all serve the placeholder (stale since Oct 5-17). Retry periodically; list at weather.gov/pqr/barcams.
  { name: "Coos Bay · Charleston bar & jetties (USCG)", lat: 43.345, lon: -124.322, img: "https://tripcheck.com/RoadCams/cams/Coos%20River%20Charleston%20USCG_pid4908.jpg", link: "https://www.weather.gov/pqr/barcams", lake: "Oregon Coast" },
  { name: "Depoe Bay · Harbor entrance & surf (USCG)", lat: 44.809, lon: -124.063, img: "https://tripcheck.com/RoadCams/cams/Depoe%20Bay%20USCG_pid4906.jpg", link: "https://www.weather.gov/pqr/barcams", lake: "Oregon Coast" },
  { name: "Winchester Bay · Umpqua River bar & jetty (USCG)", lat: 43.667, lon: -124.2, img: "https://tripcheck.com/RoadCams/cams/Umpqua%20River%20Winchester%20Bay%20(USCG)_pid4922.jpg", link: "https://www.weather.gov/pqr/barcams", lake: "Oregon Coast" },
  // Northern California coast
  { name: "Monterey Bay · Shoreline (Monterey Bay Aquarium)", lat: 36.618, lon: -121.902, yt: "fVa6-zCBR7A", lake: "Northern California Coast" },
  // New England coast
  { name: "Boston · Gloucester Annisquam Yacht Club", lat: 42.66, lon: -70.68, yt: "_j1qgdMnifk", lake: "New England Coast" },
  { name: "Beverly · Jubilee Yacht Club dock", lat: 42.55, lon: -70.85, yt: "5Vf5cSVHtQA", lake: "New England Coast" },
  // FIX 2026-11-09: Old Orchard Beach is on Saco Bay (open Atlantic), not Casco Bay. Operator: Abellona Inn ("Old Orchard Maine Beach Cam"); frame seen is a summer promo still, so liveness is label-only.
  { name: "Old Orchard Beach · Saco Bay beach (Abellona Inn)", lat: 43.52, lon: -70.38, yt: "HSQpqIWLViI", lake: "New England Coast" },
  { name: "Woods Hole · Harbor (GOMV)", lat: 41.523, lon: -70.671, yt: "5-ClAzUV2UA", lake: "New England Coast" },
  { name: "Barnstable · Harbor", lat: 41.71, lon: -70.3, yt: "cCg-J04fSuQ", lake: "New England Coast" },
  { name: "Provincetown · MacMillan Pier (Dolphin Fleet)", lat: 42.05, lon: -70.18, yt: "Yy-Eo5NMkVE", lake: "New England Coast" },
  { name: "Block Island · North Lighthouse", lat: 41.227, lon: -71.58, yt: "ejDld-hWwiU", lake: "New England Coast" },
  // Long Island Sound
  { name: "Rocky Point · Tides Beach (Long Island Sound)", lat: 40.96, lon: -72.95, yt: "rBWBGg2c5Jg", lake: "Long Island Sound" },
  // WEAK stopgaps for norwalk / new-haven (1 cam each otherwise): frames seen 2026-11-09 with on-frame clock, harbor/Sound in the top ~45%, ferry ramp and lot below. Operator unconfirmed (overlay "Ferry Line, Northport"). Rank last.
  { name: "Northport · Ferry dock & harbor (queue cam)", lat: 40.9, lon: -73.345, yt: "Zot8ShPuuKg", lake: "Long Island Sound" },
  { name: "Northport · Ferry dock ramp & Sound", lat: 40.9, lon: -73.345, yt: "TXQcLxneF5A", lake: "Long Island Sound" },
  // New York & New Jersey coast
  { name: "New York Harbor · Brooklyn (StreamTime)", lat: 40.7, lon: -74.0, yt: "l7b5RFAkKhY", lake: "New York & New Jersey Coast" },
  { name: "New York Harbor · Brooklyn Navy Yard", lat: 40.7, lon: -73.97, yt: "obqnslJKrxc", lake: "New York & New Jersey Coast" },
  { name: "Holgate · Little Egg Harbor Bay", lat: 39.5, lon: -74.28, yt: "fkE4O-5qsKU", lake: "New York & New Jersey Coast" },
  // Alaska
  { name: "Valdez · South Boat Harbor (City of Valdez, rotating)", lat: 61.125, lon: -146.35, yt: "JsgsCLKnwB8", lake: "Southcentral Alaska" },
  // Coverage pass (Nov 2026): verified embeddable via the Run script Action;
  // water views confirmed from daytime thumbnails. See docs/ops/cams-*-candidates.md.
  { name: "Treasure Island · Alcatraz & bay (ABC7)", lat: 37.823, lon: -122.37, yt: "_VqvVJfmyfs", lake: "San Francisco Bay" },
  { name: "Treasure Island · Mersea bay view", lat: 37.8225, lon: -122.3705, yt: "BSWhGNXxT9A", lake: "San Francisco Bay" },
  { name: "San Francisco · Pier 23 Cafe waterfront (StreamTime)", lat: 37.8095, lon: -122.4005, yt: "PDKGik7Np88", lake: "San Francisco Bay" },
  { name: "Pacifica · Linda Mar Beach cam", lat: 37.592, lon: -122.5, yt: "TDcKozRHlKs", lake: "Northern California Coast" },
  { name: "Point Reyes · Marine Mammal Center shoreline cam", lat: 38.03, lon: -122.8, yt: "k-rsgU8-Inw", lake: "Northern California Coast" },
  // WEAK, kept 2026-11-09: trees fill ~60% of the frame, but it is the only humboldt-bay cam.
  { name: "Trinidad Harbor · Trinidad Bay", lat: 41.0587, lon: -124.1436, yt: "31ViUog5FV4", lake: "Northern California Coast" },
  { name: "Union · Hood Canal water & mountain cam (Hood Canal Communications)", lat: 47.357, lon: -123.097, yt: "DNz4t_CRxuI", lake: "Puget Sound" },
  { name: "Waikiki · South Shore 180° (Waikiki Aquarium / UH SOEST)", lat: 21.2655, lon: -157.8225, yt: "WIUg8wzhq1g", lake: "Hawaii" },
  { name: "Waikiki Beach · Marriott (Ozolio)", lat: 21.275, lon: -157.825, yt: "4CK0CsimBHs", lake: "Hawaii" },
  { name: "Waikiki · Park Shore Hotel (Ozolio Plus)", lat: 21.2735, lon: -157.8235, yt: "kCPppYpcY_s", lake: "Hawaii" },
  // FIX 2026-11-09: "WOZ ERE" is an individual's channel (not a known re-stream brand); good lagoon view but ownership of the feed is unconfirmed. Drop if the owner objects.
  { name: "Ala Moana · Magic Island lagoon (WOZ ERE)", lat: 21.2885, lon: -157.8445, yt: "y5XS3fMISRk", lake: "Hawaii" },
  { name: "Kahala · Resort beach & reef (Ozolio)", lat: 21.2745, lon: -157.7835, yt: "TZAvviB_o-4", lake: "Hawaii" },
  { name: "Kihei · Hale Pau Hana surf cam", lat: 20.7545, lon: -156.4579, yt: "hPvl6IACa2k", lake: "Hawaii" },
  { name: "Wailea · Fairmont Kea Lani (Ozolio)", lat: 20.6558, lon: -156.4415, yt: "G1zgkkguCyc", lake: "Hawaii" },
  { name: "Kaanapali · Sheraton Maui (Ozolio)", lat: 20.9167, lon: -156.6944, yt: "YXji6UQ0bwY", lake: "Hawaii" },
  { name: "Napili · Napili Kai Beach Resort (Ozolio)", lat: 20.9925, lon: -156.6675, yt: "fwX04Gsb8W4", lake: "Hawaii" },
  // FIX 2026-11-09: lighthouse is not in frame (roof, rocks, open water; overlay "Cape Elizabeth"), so named for what it shows.
  { name: "Cape Elizabeth · rocky shore & Casco Bay", lat: 43.623, lon: -70.208, yt: "rArvNLNmhOo", lake: "New England Coast" },
  { name: "Scarborough Beach · Surf", lat: 43.55, lon: -70.32, yt: "-JZf3deL-Rs", lake: "New England Coast" },
  { name: "Cape Porpoise · Outer Harbor", lat: 43.362, lon: -70.428, yt: "xROnFN6dIZQ", lake: "New England Coast" },
  { name: "Weymouth · Fore River", lat: 42.25, lon: -70.95, yt: "dtIcEq1itmU", lake: "New England Coast" },
  { name: "Nahant · Ocean House Surf & Skate", lat: 42.425, lon: -70.93, yt: "KziwCV7db9s", lake: "New England Coast" },
  { name: "Plum Island · Beach South (Newburyport)", lat: 42.79, lon: -70.81, yt: "ZPbgf9jLD4E", lake: "New England Coast" },
  { name: "Edgartown · Harbor & Lighthouse (GOMV)", lat: 41.39, lon: -70.51, yt: "FoAvYeGRjU4", lake: "New England Coast" },
  { name: "Vineyard Haven · Harbor & Ferry (GOMV)", lat: 41.455, lon: -70.6, yt: "bdjXsDufCQY", lake: "New England Coast" },
  { name: "Sea Isle City · Beach Patrol", lat: 39.153, lon: -74.693, yt: "FYOGiFH60uM", lake: "New York & New Jersey Coast" },
  { name: "Sea Isle City · Spinnaker beach", lat: 39.153, lon: -74.693, yt: "BY_Lar5zLr8", lake: "New York & New Jersey Coast" },
  // FIX 2026-11-09: frame is beach and surf with no skyline; renamed to match.
  { name: "Margate · Beach", lat: 39.3326, lon: -74.51, yt: "2MNsMmfdpx8", lake: "New York & New Jersey Coast" },
  { name: "Savannah River · Upper East River", lat: 32.08, lon: -81.09, yt: "Nto6QNZZnQ0", lake: "Georgia & South Carolina Coast" },
  // FIX 2026-11-09: operator's own channel (oEmbed "Express Watersports Dock Cam") but thumbnail is an ad slate, not a frame: label-only. Operator's real feed is Ozolio EQPH00001687; ask them for the embed.
  { name: "Murrells Inlet · Express Watersports dock", lat: 33.54, lon: -79.03, yt: "En6HTsRLAAU", lake: "Georgia & South Carolina Coast" },
  { name: "North Myrtle Beach · Elliott Beach Rentals", lat: 33.69, lon: -78.88, yt: "6NofiKBWXIk", lake: "Georgia & South Carolina Coast" },
  { name: "Wrightsville Beach · Johnnie Mercer's Pier (south)", lat: 34.21, lon: -77.79, yt: "itXoEFJZtD0", lake: "North Carolina Coast" },
  { name: "Wrightsville Beach · Johnnie Mercer's Pier (north)", lat: 34.21, lon: -77.79, yt: "yQG1M1GU_pI", lake: "North Carolina Coast" },
  { name: "Bald Head Island · Beach Access 15", lat: 33.86, lon: -77.97, yt: "lcANlrXCR0Q", lake: "North Carolina Coast" },
  { name: "Jupiter · Reef Club oceanfront (cam 2)", lat: 26.921, lon: -80.067, yt: "4y7kDbwBuh0", lake: "Florida Atlantic Coast" },
  { name: "Deerfield Beach · Fishing pier", lat: 26.318, lon: -80.075, yt: "H33wtprQqSM", lake: "Florida Atlantic Coast" },
  { name: "Deerfield Beach · Beach camera", lat: 26.318, lon: -80.075, yt: "rdeoEeJ00xA", lake: "Florida Atlantic Coast" },
  { name: "Pine Island · Four Winds Marina", lat: 26.65, lon: -82.1, yt: "xp1b7w3qPd8", lake: "Florida Gulf Coast" },
  { name: "Orange Beach · Gulf (FOX10)", lat: 30.27, lon: -87.58, yt: "5Ijk8QsR-nw", lake: "Alabama & Mississippi Coast" },
  { name: "Orange Beach · The Moorings marina", lat: 30.29, lon: -87.57, yt: "nkA40olKP5s", lake: "Alabama & Mississippi Coast" },
  { name: "Orange Beach · Turquoise Place beach", lat: 30.27, lon: -87.6, yt: "pJqrjIuvGFE", lake: "Alabama & Mississippi Coast" },
  { name: "Perdido Key · Gulf beach (ENCO)", lat: 30.28, lon: -87.44, yt: "Qoouv_9QG5Q", lake: "Alabama & Mississippi Coast" },
  { name: "D'Iberville · Back Bay of Biloxi (FOX10)", lat: 30.43, lon: -88.89, yt: "fYsEy6RFskY", lake: "Alabama & Mississippi Coast" },
  // FIX 2026-11-09: operator (packerysurfcam) labels it a surf cam; thumbnail is a logo, so label-only. Sole cam for port-aransas: needs a daylight look.
  { name: "Corpus Christi · Packery Channel surf cam", lat: 27.6, lon: -97.2, yt: "5s6X2045OTs", lake: "Louisiana & Texas Coast" },
  { name: "South Padre · Courtyard beach cam", lat: 26.1, lon: -97.17, yt: "dzylsC0KcOE", lake: "Louisiana & Texas Coast" },
  // FIX 2026-11-09: operator title "South Padre Surf Cam 4K Isla Blanca Beach Park" (South Padre Surf Company); thumbnail is a logo, so label-only.
  { name: "South Padre · Isla Blanca (South Padre Surf Co)", lat: 26.07, lon: -97.16, yt: "0FaRaPPTS8M", lake: "Louisiana & Texas Coast" },
];

// Extra cam directories to link out to, per lake (sites that block embedding).
export const LINK_CAMS = {
  "Lake Erie": [
    { name: "Shores & Islands cams", url: "https://www.shoresandislands.com/plan-your-visit/webcams/" },
    { name: "Put-in-Bay", url: "https://putinbay.com/put-in-bay-webcams/" },
    { name: "FishUSA Erie cams (Lampe Marina, Avonia Beach, Walnut Creek)", url: "https://www.fishusa.com/webcams" },
    { name: "Lake Metroparks (Fairport Harbor, Lake Erie Bluffs)", url: "https://lakemetroparks.com/webcams" },
    { name: "Erie News Now Presque Isle cam", url: "https://www.erienewsnow.com/weather/cameras/presque-isle/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
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
  "Lake Huron": [
    { name: "Tawas Bay dock cam", url: "https://www.tawasbayweather.com/dockcamera.htm" },
    { name: "Caseville breakwater cams", url: "https://www.casevillewebcams.com/" },
    { name: "Goderich sunset cams", url: "https://exploregoderich.ca/sunset-cameras/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
  "Lake Ontario": [
    { name: "1000 Islands cams", url: "https://www.1000islandswebcams.com/" },
    { name: "Olcott Harborcam (Town of Newfane)", url: "https://townofnewfaneny.gov/OlcottHarborcam/" },
    { name: "Youngstown / Niagara River cam", url: "https://www.youngstownny.com/webcam" },
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
  // Coastal regions (2026-11-09; every URL returned HTTP 200). Pages that can't be embedded or aren't on the approved player list.
  "Oregon Coast": [
    { name: "NWS Portland bar cams (USCG, Oregon & SW Washington bars)", url: "https://www.weather.gov/pqr/barcams" },
  ],
  // (Visit St. Lucie's Fort Pierce jetty cams say they are down as of 2026-10-26, so no link yet.)
  "Southcentral Alaska": [
    { name: "Alaska Collection webcams (Seward area)", url: "https://alaskacollection.com/plan-your-trip/webcams" },
  ],
};
export const getLinkCams = (lake) => LINK_CAMS[lake] || [];

// ── Admin-managed cam config ─────────────────────────────────────────────────
// The admin page stores { disabled: [names], custom: [entries] } in the site
// config (KV). Custom entries are provider-agnostic: { name, lake, lat, lon,
// kind, id, link? } where `kind` picks the embed player and `id` is the
// provider's cam id (or the image/watch URL for snapshot cams).
export const CAM_KINDS = [
  { kind: "yt", label: "YouTube live video", hint: "video id, e.g. ZZevIUr2cTk" },
  { kind: "ytChannel", label: "YouTube channel live", hint: "channel id, e.g. UCxxxxxxxx" },
  { kind: "angelcam", label: "Angelcam", hint: "cam id, e.g. 91yx8ek0ro" },
  { kind: "wetmet", label: "WetMet", hint: "stream uid (32 hex chars)" },
  { kind: "ipcamlive", label: "IPCamLive", hint: "alias, e.g. mhyc" },
  { kind: "ozolio", label: "Ozolio", hint: "embed id, e.g. EMB_PSZZ000005DE" },
  { kind: "img", label: "Refreshing photo (JPEG URL)", hint: "full https:// image URL" },
];

// A stored custom entry → the property-keyed cam shape the site renders.
// Absolute https: URL (normalized) or "". Admin-entered image/link URLs end
// up as an <img src> / <a href>, so nothing else (javascript:, data:, http:)
// gets through. Mirrors httpsUrl() in functions/auth.js.
export function safeHttps(u) {
  if (typeof u !== "string" || !u) return "";
  try { const url = new URL(u); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

export function normalizeCustomCam(e) {
  if (!e || typeof e !== "object") return null;
  const name = String(e.name || "").trim();
  const lat = Number(e.lat), lon = Number(e.lon);
  const kind = String(e.kind || "");
  const id = String(e.id || "").trim();
  if (!name || !id || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!CAM_KINDS.some((k) => k.kind === kind)) return null;
  // The main player hands yt ids straight to YT.Player({ videoId }), not
  // through camSrc(), so only accept the shape of a real YouTube video id.
  if (kind === "yt" && !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
  const cam = { name, lat, lon, custom: true };
  if (e.lake && e.lake !== "Lake Erie") cam.lake = String(e.lake);
  if (kind === "img") {
    const img = safeHttps(id);
    if (!img) return null;
    cam.img = img;
    const link = safeHttps(String(e.link || "").trim());
    if (link) cam.link = link;
  }
  else cam[kind] = id;
  return cam;
}

// Built-in list + admin config → the effective cam list the site shows.
export function applyCamConfig(camCfg) {
  const cfg = camCfg && typeof camCfg === "object" ? camCfg : {};
  const disabled = new Set(Array.isArray(cfg.disabled) ? cfg.disabled : []);
  const custom = (Array.isArray(cfg.custom) ? cfg.custom : []).map(normalizeCustomCam).filter(Boolean);
  return [...CAMS.filter((c) => !disabled.has(c.name)), ...custom];
}

export const camIsImage = (c) => Boolean(c && c.img);
export const camKind = (c) => (c && c.img ? "photo" : "video");
// Legacy shape-derived label; the UI now uses camStatusLabel() (state-driven).
export const camKindLabel = (c) => (c && c.img ? "Refreshing photo" : "Live video");
// Replays/timelapses: explicit flag (server-added Windy cams) or name fallback.
export const camIsReplay = (c) => Boolean(c && (c.replay || /replay|timelapse/i.test(c.name || "")));
// "Bayfield · Port Superior Marina" -> "Bayfield" (place = text before the first " · " / " › ").
export const camPlace = (c) => String((c && c.name) || "").split(/\s[·›]\s/)[0].trim();

// Provider ids are interpolated into URLs, so they are URI-encoded: an id
// can't add query parameters or change the path. (Built-in ids are plain
// [A-Za-z0-9_-] and encode to themselves.)
const enc = (v) => encodeURIComponent(String(v ?? ""));

export const camSrc = (c) =>
  c.embed ? c.embed // ready-made embed URL (e.g. a Windy webcam player)
    : c.angelcam ? `https://v.angelcam.com/iframe?v=${enc(c.angelcam)}&autoplay=1`
    : c.wetmet ? `https://api.wetmet.net/widgets/stream/frame.php?uid=${enc(c.wetmet)}`
      : c.ipcamlive ? `https://www.ipcamlive.com/player/player.php?alias=${enc(c.ipcamlive)}&autoplay=1&disablehd=0`
        : c.ozolio ? `https://relay.ozolio.com/pub.api?cmd=embed&oid=${enc(c.ozolio)}`
          : c.ytChannel ? `https://www.youtube.com/embed/live_stream?channel=${enc(c.ytChannel)}&autoplay=1&mute=1`
            : `https://www.youtube.com/embed/${enc(c.yt)}?autoplay=1&mute=1&rel=0`;

// The "Open this cam" href. Explicit links are only used if they are https.
export const camLink = (c) =>
  c.img ? (safeHttps(c.link) || safeHttps(c.img))
    : c.embed ? (safeHttps(c.link) || c.embed)
    : c.angelcam ? `https://v.angelcam.com/${enc(c.angelcam)}`
      : c.wetmet ? `https://api.wetmet.net/widgets/stream/frame.php?uid=${enc(c.wetmet)}`
        : c.ipcamlive ? `https://www.ipcamlive.com/${enc(c.ipcamlive)}`
          : c.ozolio ? `https://relay.ozolio.com/pub.api?cmd=embed&oid=${enc(c.ozolio)}`
            : c.ytChannel ? `https://www.youtube.com/channel/${enc(c.ytChannel)}/live`
              : `https://www.youtube.com/watch?v=${enc(c.yt)}`;

// Rough planar distance for "nearest cam" sorting.
export const dist = (la, lo, la2, lo2) => {
  const dx = (lo - lo2) * Math.cos(((la + la2) / 2) * Math.PI / 180);
  return Math.hypot(dx, la - la2);
};

// Great Lakes regions are "Lake …"; a cam with no `lake` defaults to Lake Erie.
const isGreatLake = (l) => /^Lake /.test(l || "");
// Great-circle distance in miles.
export const haversineMi = (la, lo, la2, lo2) => {
  const r = Math.PI / 180, dLa = (la2 - la) * r, dLo = (lo2 - lo) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
};

// Cams near the selected spot, nearest first, with distances. Great Lakes spots
// ("Lake …") stay same-lake-only (cams without a `lake` default to Lake Erie).
// Coastal spots match any non-Great-Lakes cam by distance, whatever its region
// string, so neighbouring regions (e.g. Beaufort for bath-nc) are visible.
// Scoped to the launch area: prefer cams within ~0.85° (≈60 mi); if none are
// that close, just the single nearest within ~1.6° (≈110 mi, `far: true`);
// beyond that, empty. ~1° ≈ 69 mi.
const NEAR_DEG = 0.85;
const MAX_DEG = 1.6;
export const nearestCamsWithDist = (lat, lon, lake, n = 6, list = CAMS) => {
  const want = lake || "Lake Erie";
  const lakeSpot = isGreatLake(want);
  const ranked = list
    .filter((c) => (lakeSpot ? (c.lake || "Lake Erie") === want : c.lake && !isGreatLake(c.lake)))
    .map((c) => [c, dist(lat, lon, c.lat, c.lon)])
    .sort((a, b) => a[1] - b[1]);
  const near = ranked.filter(([, d]) => d <= NEAR_DEG);
  const far = !near.length;
  const chosen = far ? ranked.filter(([, d]) => d <= MAX_DEG).slice(0, 1) : near;
  return chosen.slice(0, n).map(([c]) => ({ cam: c, miles: haversineMi(lat, lon, c.lat, c.lon), far }));
};
export const nearestCams = (lat, lon, lake, n = 6, list = CAMS) =>
  nearestCamsWithDist(lat, lon, lake, n, list).map((x) => x.cam);

export const fmtMiles = (m) => (m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m)} mi`);

// Link-out directories: drop ones whose name clearly names another place (a
// "Marquette · …" chip on a Duluth page) when the name matches a CAMS place we
// can locate and it is far from the spot. Generic directories (no match) stay.
export const relevantLinkCams = (lat, lon, lake, list = CAMS) => {
  const links = getLinkCams(lake);
  if (lat == null || lon == null) return links;
  return links.filter((l) => {
    const head = String(l.name).split(/\s[·›(]\s?|\s\(/)[0].trim().toLowerCase();
    if (head.length < 4) return true;
    const hit = list.filter((c) => camPlace(c).toLowerCase() === head);
    if (!hit.length) return true;
    return hit.some((c) => dist(lat, lon, c.lat, c.lon) <= MAX_DEG);
  });
};
