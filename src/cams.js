// Great Lakes live cams. The property present decides how each renders:
//   iframe  → angelcam / wetmet / ipcamlive / ozolio / youtube (channel or video)
//   image   → refreshing JPEG snapshot (NOAA GLERL, etc.)
// All entries are verified live + embeddable (no X-Frame-Options) by
// scripts/check-cams.mjs, which the cam-health GitHub Action runs weekly.
export const CAMS = [
  { name: "Edgewater Beach · Cleveland", lat: 41.49, lon: -81.74, angelcam: "91yx8ek0ro" },
  // Western basin — Toledo Harbor Light + Channel Marker 2 (NOAA GLERL snapshots)
  { name: "Western Basin · Toledo Light (NOAA)", lat: 41.776, lon: -83.326, img: "https://www.glerl.noaa.gov/metdata/tol2/tol2-01.jpg", link: "https://www.glerl.noaa.gov/metdata/" },
  { name: "Western Basin · Toledo Channel Marker 2 (NOAA)", lat: 41.74, lon: -83.34, img: "https://www.glerl.noaa.gov/res/recon/plots/cmt/webcam1.jpg", link: "https://www.glerl.noaa.gov/res/recon/station-cmt-webcam-boats.html" },
  // Port Clinton waterfront (Ozolio embed, via offtherockportclinton.com)
  { name: "Port Clinton · Waterfront", lat: 41.512, lon: -82.937, ozolio: "EMB_IMGT00000FED" },
  // Put-in-Bay / South Bass Island (Ozolio — HTTPS, the feeds putinbay.com embeds)
  { name: "Put-in-Bay · Boardwalk Harbor", lat: 41.653, lon: -82.821, ozolio: "EMB_PSZZ000005DE" },
  { name: "Put-in-Bay · Perry's Monument (West)", lat: 41.654, lon: -82.812, ozolio: "EMB_ULHE00000B88" },
  { name: "Lorain · Black River Landing", lat: 41.47, lon: -82.18, yt: "ZZevIUr2cTk" },
  { name: "Mentor · Mentor Harbor Yacht Club", lat: 41.73, lon: -81.36, ipcamlive: "mhyc" },
  { name: "Erie, PA · Bayfront", lat: 42.14, lon: -80.09, wetmet: "388190fe4f8b3159810f66712ba47065" },
  // Northern Lake Michigan (Little Traverse Bay)
  { name: "Harbor Springs · Steeple", lat: 45.43, lon: -84.99, yt: "iPm4jZcBKPU", lake: "Lake Michigan" },
  { name: "Petoskey · Bay", lat: 45.37, lon: -84.95, angelcam: "ger25omkrm", lake: "Lake Michigan" },
  { name: "Petoskey · Bayfront", lat: 45.37, lon: -84.96, wetmet: "8e442be557e9221ea31ed33e75a38071", lake: "Lake Michigan" },
  // Lake Michigan (researched + verified live)
  { name: "Chicago · Lakefront (Playpen 4K)", lat: 41.89, lon: -87.60, yt: "ATz12otMpf4", lake: "Lake Michigan" },
  { name: "Milwaukee · Lakefront", lat: 43.03, lon: -87.88, yt: "MT5Og9gOKuM", lake: "Lake Michigan" },
  { name: "Sheboygan · Harbor Centre Marina", lat: 43.75, lon: -87.715, yt: "lu-YXDumeps", lake: "Lake Michigan" },
  { name: "Sheboygan · North Beach", lat: 43.75, lon: -87.715, yt: "13j5iZkMpbE", lake: "Lake Michigan" },
  { name: "Traverse City · W Grand Traverse Bay", lat: 44.76, lon: -85.62, yt: "2ETj1sUmEmU", lake: "Lake Michigan" },
  { name: "Mackinaw City · Straits & Bridge", lat: 45.78, lon: -84.72, yt: "Mf_qId_7mlM", lake: "Lake Michigan" },
  { name: "Charlevoix · Pine River Channel", lat: 45.32, lon: -85.26, yt: "HeZbPbqO-6M", lake: "Lake Michigan" },
  { name: "Leland · Leelanau Harbor", lat: 45.02, lon: -85.76, yt: "s7sY1waeOf4", lake: "Lake Michigan" },
  { name: "Muskegon · Harbor (NOAA GLERL)", lat: 43.23, lon: -86.34, img: "https://www.glerl.noaa.gov/metdata/cams/mkg08.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Michigan" },
  { name: "New Buffalo · Harbor", lat: 41.79, lon: -86.74, ipcamlive: "cnbharbor", lake: "Lake Michigan" },
  // Found via the lakerart.com directory scout (all official embed players)
  { name: "Muskegon · Channel (USS Silversides)", lat: 43.228, lon: -86.331, wetmet: "75d6541617a2c940bd4d8a798aa35a69", lake: "Lake Michigan" },
  { name: "Port Washington · Harbor", lat: 43.387, lon: -87.868, wetmet: "e6c8abb0ca38a3035b522d5e7c316241", lake: "Lake Michigan" },
  { name: "Sturgeon Bay · Westwood Shores", lat: 44.811, lon: -87.39, angelcam: "24r4vn43r0", lake: "Lake Michigan" },
  { name: "Sturgeon Bay · Bay Shore Inn", lat: 44.87, lon: -87.331, angelcam: "17yd2417le", lake: "Lake Michigan" },
  // Lake Ontario
  { name: "Rochester · Charlotte-Genesee Light", lat: 43.22, lon: -77.62, yt: "NHDgasBPtRY", lake: "Lake Ontario" },
  { name: "Sodus Bay · Sodus Lighthouse", lat: 43.27, lon: -76.97, yt: "68XVh5TcgBk", lake: "Lake Ontario" },
  { name: "Oswego · Lake Ontario (SUNY)", lat: 43.47, lon: -76.51, yt: "wfhQTU0HrpY", lake: "Lake Ontario" },
  { name: "Olcott · Harborcam", lat: 43.34, lon: -78.72, yt: "NpoCG3w-NXI", lake: "Lake Ontario" },
  // Lake Huron
  { name: "Port Huron · St. Clair River (BoatNerd)", lat: 42.98, lon: -82.42, yt: "dqrwY6i-Zz4", lake: "Lake Huron" },
  { name: "Port Huron · St. Clair River (StreamTime)", lat: 42.98, lon: -82.42, yt: "AwP_Q6IGwFs", lake: "Lake Huron" },
  { name: "Alpena · Thunder Bay (NOAA GLERL)", lat: 45.06, lon: -83.42, img: "https://www.glerl.noaa.gov/metdata/cams/apn04.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Huron" },
  { name: "DeTour · Drummond Island Ferry", lat: 45.993, lon: -83.899, wetmet: "609fd1e6905ac5196fb8534a64f36993", lake: "Lake Huron" },
  // Lake Superior
  { name: "Duluth · Canal Cam", lat: 46.78, lon: -92.08, yt: "HPS48TMmNag", lake: "Lake Superior" },
  { name: "Duluth · Western Harbor", lat: 46.78, lon: -92.08, yt: "mpMdJJjw59E", lake: "Lake Superior" },
  { name: "Duluth · Pier B", lat: 46.78, lon: -92.08, yt: "c1kfkIoF0k0", lake: "Lake Superior" },
  { name: "Marquette · Lower Harbor", lat: 46.54, lon: -87.38, wetmet: "08a47e963e2f369ca92e4fe022b7f329", lake: "Lake Superior" },
  { name: "Houghton · Portage Lift Bridge", lat: 47.12, lon: -88.57, wetmet: "040f3085e8b73aa13a4d4c98fdc7f0ac", lake: "Lake Superior" },
  { name: "Grand Marais · Harbor Cam", lat: 47.75, lon: -90.33, yt: "n0H5FkWkjjs", lake: "Lake Superior" },
  // Found via the lakerart.com directory scout (official embed players + NPS)
  { name: "Bayfield · Bayfield Inn", lat: 46.812, lon: -90.818, angelcam: "v8ypjjj8y6", lake: "Lake Superior" },
  { name: "Bayfield · Port Superior Marina", lat: 46.757, lon: -90.864, angelcam: "m1ervgoxr7", lake: "Lake Superior" },
  { name: "Saxon Harbor, WI · Marina", lat: 46.565, lon: -90.437, ipcamlive: "saxonharbor", lake: "Lake Superior" },
  { name: "Whitefish Point · Shipwreck Museum", lat: 46.771, lon: -84.958, wetmet: "977a312d5da91e21bc63f295c0b12cc7", lake: "Lake Superior" },
  { name: "Isle Royale · Mott Island (NPS)", lat: 48.108, lon: -88.556, img: "https://www.nps.gov/webcams-isro/mottmain.jpg", link: "https://www.nps.gov/isro/learn/photosmultimedia/webcams.htm", lake: "Lake Superior" },
  // Florida Atlantic Coast (2026-11 water-cam audit — every entry is a 24/7 water view;
  // YouTube confirmed it exists + allows embedding; the player hides any that are offline)
  { name: "St. Augustine · Matanzas River & Bridge of Lions", lat: 29.892, lon: -81.31, yt: "uLJBad4vSno", lake: "Florida Atlantic Coast" },
  { name: "St. Augustine Beach · Surf Station surf cam", lat: 29.85, lon: -81.264, yt: "H2q_DJc33kg", lake: "Florida Atlantic Coast" },
  { name: "Port Canaveral · Harbor (Gator's Dockside)", lat: 28.41, lon: -80.62, yt: "mQnOcuGV334", lake: "Florida Atlantic Coast" },
  { name: "Cocoa Beach · Surf", lat: 28.32, lon: -80.607, yt: "6QmQtFXG9vM", lake: "Florida Atlantic Coast" },
  { name: "Cocoa Beach · Surfer's View", lat: 28.33, lon: -80.607, yt: "gAvFqhNwZm0", lake: "Florida Atlantic Coast" },
  { name: "Fort Lauderdale · Beach (PTZtv)", lat: 26.1, lon: -80.105, yt: "pXx3YQVSUGg", lake: "Florida Atlantic Coast" },
  { name: "Miami · PortMiami channel", lat: 25.77, lon: -80.16, yt: "i8ScwT2PT-0", lake: "Florida Atlantic Coast" },
  { name: "Miami · Biscayne Bay", lat: 25.79, lon: -80.18, yt: "4mM_w7P5cWw", lake: "Florida Atlantic Coast" },
  // Florida Keys
  { name: "Islamorada · Little Basin (Florida Bay)", lat: 24.93, lon: -80.62, yt: "HfSOXLUtYmA", lake: "Florida Keys" },
  { name: "Islamorada · Charter boat docks", lat: 24.93, lon: -80.6, yt: "8ShFKuTCmhQ", lake: "Florida Keys" },
  { name: "Islamorada · Lazy Days oceanfront", lat: 24.91, lon: -80.64, yt: "5pFDytRb4Qc", lake: "Florida Keys" },
  { name: "Marathon · Sombrero Beach", lat: 24.69, lon: -81.08, yt: "jE4og3o_SXs", lake: "Florida Keys" },
  { name: "Marathon · Sunset Grille (7 Mile Bridge)", lat: 24.705, lon: -81.115, yt: "SXMC-MzSncI", lake: "Florida Keys" },
  { name: "Key West · Harbor (PTZtv)", lat: 24.56, lon: -81.808, yt: "iHJbTrQSZys", lake: "Florida Keys" },
  { name: "Key West · Bight Marina", lat: 24.561, lon: -81.801, yt: "Y5ypYTZs-7o", lake: "Florida Keys" },
  // Florida Gulf Coast
  { name: "Clearwater Beach · Frenchy's", lat: 27.98, lon: -82.83, yt: "rxBBRLWF0mM", lake: "Florida Gulf Coast" },
  { name: "Clearwater Beach · Pier 60 (FOX 13)", lat: 27.977, lon: -82.829, yt: "S8-G3uJOqZw", lake: "Florida Gulf Coast" },
  { name: "St. Petersburg · Waterfront (FOX 13)", lat: 27.76, lon: -82.633, yt: "OeYHEp9_KYk", lake: "Florida Gulf Coast" },
  { name: "Siesta Key · Beach", lat: 27.265, lon: -82.553, yt: "GU5CkKxOPbM", lake: "Florida Gulf Coast" },
  { name: "Panama City Beach · Pineapple Willy's Pier", lat: 30.18, lon: -85.81, yt: "0pLm61T8qCU", lake: "Florida Gulf Coast" },
  { name: "Destin · Gulf beach", lat: 30.38, lon: -86.48, yt: "_Zqi24i0fl4", lake: "Florida Gulf Coast" },
  { name: "Pensacola Beach · Pier", lat: 30.328, lon: -87.142, yt: "O6fLjzZLALY", lake: "Florida Gulf Coast" },
  { name: "Pensacola · Bay", lat: 30.4, lon: -87.2, yt: "O-tdY-lbISg", lake: "Florida Gulf Coast" },
  // Alabama & Mississippi Coast
  { name: "Gulf Shores → Fairhope · Coastal SkyCams (rotating)", lat: 30.35, lon: -87.75, yt: "3Rp_9FUKH4I", lake: "Alabama & Mississippi Coast" },
  // Louisiana & Texas Coast
  { name: "Galveston · Seawall beach (ABC13)", lat: 29.29, lon: -94.79, yt: "HkHhXsWci7Q", lake: "Louisiana & Texas Coast" },
  { name: "South Padre · North Beach (Sand Rose)", lat: 26.13, lon: -97.17, yt: "kJ_EXhKsH30", lake: "Louisiana & Texas Coast" },
  // Georgia & South Carolina / North Carolina / Chesapeake
  { name: "Nags Head · Jennette's Pier", lat: 35.91, lon: -75.6, yt: "sgnlB7lhknM", lake: "North Carolina Coast" },
  { name: "Kitty Hawk · Oceanfront (Twiddy)", lat: 36.07, lon: -75.7, yt: "WEhuDqlxHmM", lake: "North Carolina Coast" },
  // Southern California Coast (2026-11 audit: every entry is a YouTube live stream with
  // embedding allowed (oEmbed 200) that showed up in YouTube's "Live" filter and whose frame
  // shows water. South to north.)
  { name: "San Diego Bay · Shelter Island", lat: 32.714, lon: -117.227, yt: "ct7IRmzDggk", lake: "Southern California Coast" },
  { name: "Mission Bay · San Diego Rowing Club", lat: 32.7835, lon: -117.254, yt: "7esMbPeSjpk", lake: "Southern California Coast" },
  { name: "Oceanside · Pier & surf (Rooftop Bar)", lat: 33.1945, lon: -117.3815, yt: "cvP_F-c2Upw", lake: "Southern California Coast" },
  { name: "Huntington Beach · Pier & surf (City of HB)", lat: 33.6555, lon: -118.0033, yt: "mhQjsLBfOoY", lake: "Southern California Coast" },
  { name: "Redondo Beach · King Harbor (City)", lat: 33.846, lon: -118.393, yt: "Ni7v-aIa3bw", lake: "Southern California Coast" },
  { name: "Redondo Beach · King Harbor Yacht Club channel", lat: 33.845, lon: -118.395, yt: "g1IHHYlgzy8", lake: "Southern California Coast" },
  { name: "Santa Monica · Beach & Pier (explore.org)", lat: 34.0095, lon: -118.4975, yt: "v97JpT3ZA0w", lake: "Southern California Coast" },
  { name: "Channel Islands Harbor · Boat launch (Oxnard)", lat: 34.157, lon: -119.2265, yt: "5LEWwFzJ6rg", lake: "Southern California Coast" },
  // Hawaii & Puerto Rico
  { name: "Kona · Keauhou Bay", lat: 19.56, lon: -155.96, yt: "RxDQLIwxyhA", lake: "Hawaii" },
  { name: "Maui · Wailea Beach", lat: 20.68, lon: -156.44, yt: "mrUciA_XZxA", lake: "Hawaii" },
  { name: "San Juan · Isla Verde beach", lat: 18.445, lon: -66.02, yt: "taI7GiyvDxE", lake: "Puerto Rico" },
  // Added after a visual frame check (2026-11-06)
  { name: "Havre de Grace · Upper Chesapeake (Decoy Museum)", lat: 39.545, lon: -76.09, yt: "uOC4CPHiOFM", lake: "Chesapeake Bay" },
  { name: "Baltimore · Shipping channel (StreamTime)", lat: 39.22, lon: -76.52, yt: "t_VfYNtprYE", lake: "Chesapeake Bay" },
  { name: "Myrtle Beach · Oceanfront (Captain's Quarters)", lat: 33.69, lon: -78.89, yt: "GKOyGoRE0Tg", lake: "Georgia & South Carolina Coast" },
];

// Extra cam directories to link out to, per lake (sites that block embedding).
export const LINK_CAMS = {
  "Lake Erie": [
    { name: "Shores & Islands cams", url: "https://www.shoresandislands.com/plan-your-visit/webcams/" },
    { name: "Put-in-Bay", url: "https://putinbay.com/put-in-bay-webcams/" },
    { name: "Mentor Harbor", url: "https://www.ipcamlive.com/mhyc" },
  ],
  "Lake Michigan": [
    { name: "Petoskey Area cams", url: "https://petoskeyarea.com/planning/live-area-webcams/" },
    { name: "Grand Haven (EarthCam)", url: "https://www.earthcam.com/usa/michigan/grandhaven/lakemichigan/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
  "Lake Huron": [
    { name: "Tawas Bay dock cam", url: "https://www.tawasbayweather.com/dockcamera.htm" },
    { name: "Goderich sunset cams", url: "https://exploregoderich.ca/sunset-cameras/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
  "Lake Ontario": [
    { name: "1000 Islands cams", url: "https://www.1000islandswebcams.com/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
  "Lake Superior": [
    { name: "Duluth Harbor Cam hub", url: "https://www.duluthharborcam.com/p/canal-park-cams.html" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
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
  { kind: "img", label: "Refreshing photo (JPEG URL)", hint: "full image URL" },
];

// A stored custom entry → the property-keyed cam shape the site renders.
export function normalizeCustomCam(e) {
  if (!e || typeof e !== "object") return null;
  const name = String(e.name || "").trim();
  const lat = Number(e.lat), lon = Number(e.lon);
  const kind = String(e.kind || "");
  const id = String(e.id || "").trim();
  if (!name || !id || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!CAM_KINDS.some((k) => k.kind === kind)) return null;
  const cam = { name, lat, lon, custom: true };
  if (e.lake && e.lake !== "Lake Erie") cam.lake = String(e.lake);
  if (kind === "img") { cam.img = id; if (e.link) cam.link = String(e.link); }
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
export const camKindLabel = (c) => (c && c.img ? "Refreshing photo" : "Live video");

export const camSrc = (c) =>
  c.embed ? c.embed // ready-made embed URL (e.g. a Windy webcam player)
    : c.angelcam ? `https://v.angelcam.com/iframe?v=${c.angelcam}&autoplay=1`
    : c.wetmet ? `https://api.wetmet.net/widgets/stream/frame.php?uid=${c.wetmet}`
      : c.ipcamlive ? `https://www.ipcamlive.com/player/player.php?alias=${c.ipcamlive}&autoplay=1&disablehd=0`
        : c.ozolio ? `https://relay.ozolio.com/pub.api?cmd=embed&oid=${c.ozolio}`
          : c.ytChannel ? `https://www.youtube.com/embed/live_stream?channel=${c.ytChannel}&autoplay=1&mute=1`
            : `https://www.youtube.com/embed/${c.yt}?autoplay=1&mute=1&rel=0`;

export const camLink = (c) =>
  c.img ? (c.link || c.img)
    : c.embed ? (c.link || c.embed)
    : c.angelcam ? `https://v.angelcam.com/${c.angelcam}`
      : c.wetmet ? `https://api.wetmet.net/widgets/stream/frame.php?uid=${c.wetmet}`
        : c.ipcamlive ? `https://www.ipcamlive.com/${c.ipcamlive}`
          : c.ozolio ? `https://relay.ozolio.com/pub.api?cmd=embed&oid=${c.ozolio}`
            : c.ytChannel ? `https://www.youtube.com/channel/${c.ytChannel}/live`
              : `https://www.youtube.com/watch?v=${c.yt}`;

// Rough planar distance for "nearest cam" sorting.
export const dist = (la, lo, la2, lo2) => {
  const dx = (lo - lo2) * Math.cos(((la + la2) / 2) * Math.PI / 180);
  return Math.hypot(dx, la - la2);
};

// Cams near the selected spot (same lake; cams without a `lake` default to Lake
// Erie), nearest first. Scoped to the launch area — the Great Lakes are huge, so
// showing every cam on a lake is too broad. Prefer cams within ~0.85° (≈60 mi);
// if none are that close, show just the single nearest within ~1.6° (≈110 mi);
// beyond that the UI shows an empty state. ~1° ≈ 69 mi.
const NEAR_DEG = 0.85;
const MAX_DEG = 1.6;
export const nearestCams = (lat, lon, lake, n = 6, list = CAMS) => {
  const want = lake || "Lake Erie";
  const ranked = list
    .filter((c) => (c.lake || "Lake Erie") === want)
    .map((c) => [c, dist(lat, lon, c.lat, c.lon)])
    .sort((a, b) => a[1] - b[1]);
  const near = ranked.filter(([, d]) => d <= NEAR_DEG);
  const chosen = near.length ? near : ranked.filter(([, d]) => d <= MAX_DEG).slice(0, 1);
  return chosen.slice(0, n).map(([c]) => c);
};
