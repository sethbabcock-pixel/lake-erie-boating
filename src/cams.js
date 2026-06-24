// Lake Erie live cams. `kind` decides how each renders:
//   iframe  → angelcam / pixelcaster / youtube (channel or video)
//   image   → refreshing JPEG snapshot (WTOL)
export const CAMS = [
  { name: "Edgewater Beach · Cleveland", lat: 41.49, lon: -81.74, angelcam: "91yx8ek0ro" },
  { name: "Vermilion · Main St Beach", lat: 41.42, lon: -82.36, pixelcaster: "lesi/vermilion/mainstreet" },
  { name: "Cleveland Water Crib", lat: 41.54, lon: -81.71, ytChannel: "UCzmBlmDzPkaDGV72tSQ0yYw" },
  { name: "Cranberry Creek · Huron", lat: 41.39, lon: -82.55, yt: "zwlq7jscPc4" },
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
];

// Cams whose sites block embedding — opened in a new tab.
export const LINK_CAMS = [
  { name: "Mentor Harbor (MHYC)", url: "https://www.ipcamlive.com/mhyc" },
  { name: "Put-in-Bay", url: "https://putinbay.com/put-in-bay-webcams/" },
  { name: "Shores & Islands (all cams)", url: "https://www.shoresandislands.com/plan-your-visit/webcams/" },
  { name: "Boat-launch cam", url: "http://boat-launch-kbgwjqzpppc.dynamic-m.com:8080/1118e736-acf4-47d7-a21d-80311f39f172.html" },
];

export const camIsImage = (c) => Boolean(c.img);

export const camSrc = (c) =>
  c.angelcam ? `https://v.angelcam.com/iframe?v=${c.angelcam}&autoplay=1`
    : c.pixelcaster ? `https://pixelcaster.com/live/${c.pixelcaster}/`
      : c.ytChannel ? `https://www.youtube.com/embed/live_stream?channel=${c.ytChannel}&autoplay=1&mute=1`
        : `https://www.youtube.com/embed/${c.yt}?autoplay=1&mute=1&rel=0`;

export const camLink = (c) =>
  c.img ? (c.link || c.img)
    : c.angelcam ? `https://v.angelcam.com/${c.angelcam}`
      : c.pixelcaster ? `https://pixelcaster.com/live/${c.pixelcaster}/`
        : c.ytChannel ? `https://www.youtube.com/channel/${c.ytChannel}/live`
          : `https://www.youtube.com/watch?v=${c.yt}`;

// Rough planar distance for "nearest cam" sorting.
export const dist = (la, lo, la2, lo2) => {
  const dx = (lo - lo2) * Math.cos(((la + la2) / 2) * Math.PI / 180);
  return Math.hypot(dx, la - la2);
};

export const nearestCams = (lat, lon, n = 7) =>
  CAMS.slice().sort((a, b) => dist(lat, lon, a.lat, a.lon) - dist(lat, lon, b.lat, b.lon)).slice(0, n);
