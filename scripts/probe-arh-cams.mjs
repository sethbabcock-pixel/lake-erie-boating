// Check NWS Alaska Region office camera snapshots: freshness + dump small
// base64 previews so a reviewer can confirm the view shows water.
// Run from the "Run script" GitHub Action (sandbox has no network).
const UA = "Mozilla/5.0 (compatible; shouldiboat-cam-check)";
const SITES = ["juneau"];
const DIRS = ["northeast", "northwest", "southeast"];
const hits = [];
for (const s of SITES) for (const d of DIRS) {
  const u = `https://www.arh.noaa.gov/arhdata/photo/PHOTO_${s}_${d}.jpg`;
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (r.ok && /image/.test(r.headers.get("content-type") || "")) {
      const buf = Buffer.from(await r.arrayBuffer());
      console.log(`HIT ${u} ${buf.length}B last-modified=${r.headers.get("last-modified")}`);
      hits.push([u, buf]);
    }
  } catch {}
}
for (const [u, buf] of hits.slice(0, 6)) {
  if (buf.length < 400000) console.log(`B64 ${u} ${buf.toString("base64")}`);
}
console.log(`done ${hits.length} hits`);
