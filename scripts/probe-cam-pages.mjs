// Print every image / cam-looking URL on a few pages, then HEAD-check guessed
// snapshot URLs. Run from the "Run script" GitHub Action (sandbox has no network).
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const PAGES = [
  "https://www.weather.gov/pqr/barcams",
  "https://www.mtu.edu/webcams/",
  "https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html",
  "https://weather.gov/arh/weathercams",
  "https://www.usps.org/localusps/coos/cbbar.html",
  "https://research.oregonstate.edu/port-orford/webcam-and-sea-conditions",
];
const get = async (u) => { try { const r = await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) }); return { ok: r.ok, status: r.status, type: r.headers.get("content-type") || "", len: r.headers.get("content-length"), lm: r.headers.get("last-modified"), text: r.ok && /html/.test(r.headers.get("content-type") || "") ? await r.text() : "" }; } catch (e) { return { ok: false, status: String(e.name) }; } };
for (const p of PAGES) {
  const r = await get(p);
  console.log(`PAGE ${p} ${r.status}`);
  const urls = new Set();
  for (const m of (r.text || "").matchAll(/(?:src|href|data-src)=["']([^"']+)["']/gi)) {
    const u = new URL(m[1].replace(/&amp;/g, "&"), p).href;
    if (/\.(jpe?g|png|gif)(\?|$)|cam|webcam|stream|m3u8|embed|iframe/i.test(u) && !/logo|icon|sprite|\.css|\.js(\?|$)|facebook|twitter|instagram/i.test(u)) urls.add(u);
  }
  for (const m of (r.text || "").matchAll(/<iframe[^>]+src=["']([^"']+)/gi)) urls.add("IFRAME " + m[1]);
  for (const u of [...urls].slice(0, 80)) console.log("  " + u);
}
const GUESS = [];
for (const n of ["QRiver", "GraysHarbor", "Grays", "Columbia", "ColumbiaRiver", "Tillamook", "DepoeBay", "Depoe", "Yaquina", "Siuslaw", "Umpqua", "CoosBay", "Coos", "Chetco", "Newport"]) GUESS.push(`https://www.weather.gov/images/pqr/barcams/${n}.jpg`);
for (const n of ["glrc-west", "glrc-east", "glrc", "waterway", "portage-lake", "lift-bridge", "great-lakes-research-center"]) GUESS.push(`https://www.mtu.edu/mtu_resources/php/webcams/cache/${n}.jpg`);
for (const u of GUESS) { const r = await fetch(u, { method: "GET", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).catch((e) => ({ status: e.name, headers: new Map() })); console.log(`GUESS ${r.status} ${r.headers.get?.("content-type") || ""} ${r.headers.get?.("last-modified") || ""} ${u}`); }
