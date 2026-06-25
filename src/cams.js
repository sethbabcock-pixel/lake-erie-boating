// Great Lakes live cams. The property present decides how each renders:
//   iframe  → angelcam / pixelcaster / wetmet / ipcamlive / youtube (channel or video)
//   image   → refreshing JPEG snapshot (WTOL, NOAA GLERL, etc.)
// All entries are verified live + embeddable (no X-Frame-Options) by
// scripts/check-cams.mjs, which the cam-health GitHub Action runs weekly.
export const CAMS = [
  { name: "Edgewater Beach · Cleveland", lat: 41.49, lon: -81.74, angelcam: "91yx8ek0ro" },
  { name: "Vermilion · Main St Beach", lat: 41.42, lon: -82.36, pixelcaster: "lesi/vermilion/mainstreet" },
  // WTOL (Toledo) refreshing snapshots
  { name: "Jet Express · Lake Erie (Port Clinton)", lat: 41.51, lon: -82.94, img: "https://cdn.tegna-media.com/wtol/weather/webcams/jetexpress/snap_c1.jpg", link: "https://www.wtol.com/webcams" },
  { name: "Toledo · Fifth Third Field (WTOL)", lat: 41.65, lon: -83.54, img: "https://cdn.tegna-media.com/wtol/weather/webcams/fifththird/snap_c1.jpg", link: "https://www.wtol.com/webcams" },
  { name: "Toledo · Mercy Health (WTOL)", lat: 41.66, lon: -83.55, img: "https://cdn.tegna-media.com/wtol/weather/webcams/mercy/snap_c1.jpg", link: "https://www.wtol.com/webcams" },
  // Lake Erie Shores & Islands (Pixelcaster) — central/western basin video
  { name: "Catawba Island · Lake Erie", lat: 41.57, lon: -82.86, pixelcaster: "lesi/catawba" },
  { name: "Miller Ferry · Put-in-Bay", lat: 41.62, lon: -82.83, pixelcaster: "lesi/miller" },
  { name: "Port Clinton · City Beach", lat: 41.51, lon: -82.93, pixelcaster: "lesi/port-clinton" },
  { name: "Lakeside · Marblehead", lat: 41.55, lon: -82.75, pixelcaster: "lesi/lakeside" },
  { name: "Sandusky · State Theatre", lat: 41.45, lon: -82.71, pixelcaster: "lesi/sandusky" },
  { name: "Old Fish House · Port Clinton", lat: 41.51, lon: -82.94, pixelcaster: "lesi/fishhouse" },
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
  // Lake Ontario
  { name: "Rochester · Charlotte-Genesee Light", lat: 43.22, lon: -77.62, yt: "NHDgasBPtRY", lake: "Lake Ontario" },
  { name: "Sodus Bay · Sodus Lighthouse", lat: 43.27, lon: -76.97, yt: "68XVh5TcgBk", lake: "Lake Ontario" },
  { name: "Oswego · Lake Ontario (SUNY)", lat: 43.47, lon: -76.51, yt: "wfhQTU0HrpY", lake: "Lake Ontario" },
  { name: "Olcott · Harborcam", lat: 43.34, lon: -78.72, yt: "NpoCG3w-NXI", lake: "Lake Ontario" },
  // Lake Huron
  { name: "Port Huron · St. Clair River (BoatNerd)", lat: 42.98, lon: -82.42, yt: "dqrwY6i-Zz4", lake: "Lake Huron" },
  { name: "Port Huron · St. Clair River (StreamTime)", lat: 42.98, lon: -82.42, yt: "AwP_Q6IGwFs", lake: "Lake Huron" },
  { name: "Alpena · Thunder Bay (NOAA GLERL)", lat: 45.06, lon: -83.42, img: "https://www.glerl.noaa.gov/metdata/cams/apn04.jpg", link: "https://www.glerl.noaa.gov/metdata/", lake: "Lake Huron" },
  // Lake Superior
  { name: "Duluth · Canal Cam", lat: 46.78, lon: -92.08, yt: "HPS48TMmNag", lake: "Lake Superior" },
  { name: "Duluth · Western Harbor", lat: 46.78, lon: -92.08, yt: "mpMdJJjw59E", lake: "Lake Superior" },
  { name: "Duluth · Pier B", lat: 46.78, lon: -92.08, yt: "c1kfkIoF0k0", lake: "Lake Superior" },
  { name: "Marquette · Lower Harbor", lat: 46.54, lon: -87.38, wetmet: "08a47e963e2f369ca92e4fe022b7f329", lake: "Lake Superior" },
  { name: "Houghton · Portage Lift Bridge", lat: 47.12, lon: -88.57, wetmet: "040f3085e8b73aa13a4d4c98fdc7f0ac", lake: "Lake Superior" },
  { name: "Grand Marais · Harbor Cam", lat: 47.75, lon: -90.33, yt: "n0H5FkWkjjs", lake: "Lake Superior" },
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
    { name: "Bayfield Inn live HD", url: "https://www.bayfieldlive.com/" },
    { name: "Great Lakes cam directory", url: "https://lakerart.com/links.htm" },
  ],
};
export const getLinkCams = (lake) => LINK_CAMS[lake] || [];

export const camIsImage = (c) => Boolean(c && c.img);
export const camKind = (c) => (c && c.img ? "photo" : "video");
export const camKindLabel = (c) => (c && c.img ? "📷 refreshing photo" : "📹 live video");

export const camSrc = (c) =>
  c.angelcam ? `https://v.angelcam.com/iframe?v=${c.angelcam}&autoplay=1`
    : c.pixelcaster ? `https://pixelcaster.com/live/${c.pixelcaster}/`
      : c.wetmet ? `https://api.wetmet.net/widgets/stream/frame.php?uid=${c.wetmet}`
        : c.ipcamlive ? `https://www.ipcamlive.com/player/player.php?alias=${c.ipcamlive}&autoplay=1&disablehd=0`
          : c.ytChannel ? `https://www.youtube.com/embed/live_stream?channel=${c.ytChannel}&autoplay=1&mute=1`
            : `https://www.youtube.com/embed/${c.yt}?autoplay=1&mute=1&rel=0`;

export const camLink = (c) =>
  c.img ? (c.link || c.img)
    : c.angelcam ? `https://v.angelcam.com/${c.angelcam}`
      : c.pixelcaster ? `https://pixelcaster.com/live/${c.pixelcaster}/`
        : c.wetmet ? `https://api.wetmet.net/widgets/stream/frame.php?uid=${c.wetmet}`
          : c.ipcamlive ? `https://www.ipcamlive.com/${c.ipcamlive}`
            : c.ytChannel ? `https://www.youtube.com/channel/${c.ytChannel}/live`
              : `https://www.youtube.com/watch?v=${c.yt}`;

// Rough planar distance for "nearest cam" sorting.
export const dist = (la, lo, la2, lo2) => {
  const dx = (lo - lo2) * Math.cos(((la + la2) / 2) * Math.PI / 180);
  return Math.hypot(dx, la - la2);
};

// Cams for the spot's own lake (cams without a `lake` default to Lake Erie),
// nearest first. Lakes with no cams yet get an empty state in the UI.
export const nearestCams = (lat, lon, lake, n = 8) => {
  const want = lake || "Lake Erie";
  return CAMS.filter((c) => (c.lake || "Lake Erie") === want)
    .sort((a, b) => dist(lat, lon, a.lat, a.lon) - dist(lat, lon, b.lat, b.lon))
    .slice(0, n);
};
