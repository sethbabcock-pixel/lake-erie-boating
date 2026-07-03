// Cam scout — crawls a Great Lakes webcam directory (lakerart.com/links.htm),
// probes every outbound link one level deep, and reports which cams are
// embeddable on shouldiboat.com on clean legal footing:
//
//   OK_EMBED  — YouTube live with embedding enabled (official player), a known
//               embed player (Angelcam/IPCamLive/Ozolio/WetMet), or a
//               government (.gov/.mil) snapshot image → safe to add.
//   ASK_OWNER — a private site's snapshot/stream with no embed player on offer
//               → works technically, but ask the operator before hotlinking.
//   LINK_ONLY — blocks iframing, or a provider whose terms disallow embedding
//               (e.g. EarthCam) → list under "More cams" links instead.
//   DEAD      — gone / offline / not a cam.
//
//   node scripts/scout-cams.mjs
//
// Output: human-readable lines plus machine-parseable "CAM|{json}" lines.
// Run from GitHub Actions (cam-scout workflow) — the dev sandbox has no
// outbound network.

const SEED = "https://lakerart.com/links.htm";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 15000;
const CONCURRENCY = 8;
const MAX_PAGES = 300;
const MAX_BODY = 600_000;

async function fetchT(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: "follow", signal: ctrl.signal, ...opts, headers: { "User-Agent": UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}
async function readBody(res) {
  const text = await res.text().catch(() => "");
  return text.slice(0, MAX_BODY);
}

const stripTags = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function blocksEmbedding(res) {
  const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return true;
  const csp = (res.headers.get("content-security-policy") || "").toLowerCase();
  const m = csp.match(/frame-ancestors([^;]*)/);
  if (m && !m[1].includes("*")) return true;
  return false;
}

const isGov = (host) => /\.(gov|mil)$/.test(host) || host.endsWith(".noaa.gov");

// ── extraction helpers ───────────────────────────────────────────────────────
const YT_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/(?!live_stream)|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/i;
function extractEmbeds(body) {
  const found = { yt: new Set(), angelcam: new Set(), ipcamlive: new Set(), ozolio: new Set(), wetmet: new Set(), imgs: new Set(), m3u8: new Set() };
  for (const m of body.matchAll(/(?:youtube\.com\/(?:watch\?v=|embed\/(?!live_stream)|live\/)|youtu\.be\/)([\w-]{11})/gi)) found.yt.add(m[1]);
  for (const m of body.matchAll(/"videoId"\s*:\s*"([\w-]{11})"/g)) found.yt.add(m[1]);
  for (const m of body.matchAll(/v\.angelcam\.com\/iframe\?v=([a-z0-9]+)/gi)) found.angelcam.add(m[1]);
  for (const m of body.matchAll(/ipcamlive\.com\/(?:player\/player\.php\?alias=)?([a-z0-9_-]{3,40})/gi)) {
    if (!["player", "embed", "index"].includes(m[1].toLowerCase())) found.ipcamlive.add(m[1]);
  }
  for (const m of body.matchAll(/relay\.ozolio\.com\/pub\.api\?cmd=embed&(?:amp;)?oid=([A-Z0-9_]+)/g)) found.ozolio.add(m[1]);
  for (const m of body.matchAll(/api\.wetmet\.net\/widgets\/stream\/frame\.php\?uid=([0-9a-f]{16,40})/gi)) found.wetmet.add(m[1]);
  for (const m of body.matchAll(/https?:\/\/[^"'\s<>]+\.(?:jpe?g)\b[^"'\s<>]*/gi)) {
    const u = m[0];
    if (/logo|icon|banner|button|thumb|sprite|badge|\/wp-content\/themes|gravatar/i.test(u)) continue;
    found.imgs.add(u);
    if (found.imgs.size >= 4) break;
  }
  for (const m of body.matchAll(/https:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi)) found.m3u8.add(m[0]);
  return found;
}

// ── probes ───────────────────────────────────────────────────────────────────
async function probeYouTube(id) {
  try {
    const res = await fetchT(`https://www.youtube.com/watch?v=${id}`);
    if (!res.ok) return { ok: false, detail: `watch HTTP ${res.status}` };
    const body = await readBody(res);
    const title = stripTags((body.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/ - YouTube$/, "");
    // No player JSON at all = YouTube bot-wall, not a dead video.
    if (!body.includes("playableInEmbed")) return { ok: false, detail: "YouTube bot-wall — unverifiable from this IP" };
    const embeddable = body.includes('"playableInEmbed":true');
    const live = body.includes('"isLiveNow":true');
    return { ok: embeddable && live, embeddable, live, title, detail: embeddable ? (live ? "live + embeddable" : "embeddable, not live now") : "embedding disabled" };
  } catch (e) {
    return { ok: false, detail: `unreachable (${e.name})` };
  }
}

async function probeImage(url) {
  try {
    const res = await fetchT(url);
    const ct = res.headers.get("content-type") || "";
    return { ok: res.ok && ct.startsWith("image/"), detail: res.ok ? ct : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: `unreachable (${e.name})` };
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function run() {
  const seedRes = await fetchT(SEED);
  if (!seedRes.ok) throw new Error(`seed fetch failed: HTTP ${seedRes.status}`);
  const seedBody = await readBody(seedRes);

  const links = [];
  const seen = new Set();
  for (const m of seedBody.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href;
    try { href = new URL(m[1], SEED).toString(); } catch { continue; }
    if (!/^https?:/i.test(href)) continue;
    const host = new URL(href).hostname;
    if (host.endsWith("lakerart.com")) continue; // internal nav
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ url: href, name: stripTags(m[2]) || host });
  }
  console.log(`seed: ${links.length} outbound links on ${SEED}\n`);
  const work = links.slice(0, MAX_PAGES);

  const results = new Array(work.length);
  let next = 0;
  async function probeLink({ url, name }) {
    const host = new URL(url).hostname;

    // Direct YouTube link
    const yt = url.match(YT_ID);
    if (yt || /youtube\.com\/(channel|c|user|@)/i.test(url)) {
      let id = yt && yt[1];
      if (!id) {
        // channel link → resolve the current live stream
        try {
          const res = await fetchT(url.replace(/\/+$/, "") + "/live");
          const body = await readBody(res);
          id = (body.match(/"videoId"\s*:\s*"([\w-]{11})"/) || [])[1];
        } catch {}
        if (!id) return { name, url, kind: "youtube", verdict: "DEAD", detail: "channel has no live stream" };
      }
      const p = await probeYouTube(id);
      return { name: p.title || name, url, kind: "youtube", yt: id, verdict: p.ok ? "OK_EMBED" : p.embeddable === false ? "LINK_ONLY" : "DEAD", detail: p.detail };
    }

    // Direct image link
    if (/\.(jpe?g|png)(\?|$)/i.test(url)) {
      const p = await probeImage(url);
      if (!p.ok) return { name, url, kind: "image", verdict: "DEAD", detail: p.detail };
      return { name, url, kind: "image", img: url, verdict: isGov(host) ? "OK_EMBED" : "ASK_OWNER", detail: `snapshot ${p.detail}${isGov(host) ? " (government feed)" : ""}` };
    }

    // EarthCam and similar embed-hostile providers: link out only.
    if (/earthcam\.com/i.test(host)) return { name, url, kind: "earthcam", verdict: "LINK_ONLY", detail: "EarthCam terms disallow third-party embedding" };

    // Generic page: fetch and mine it for embeds.
    let res;
    try { res = await fetchT(url); } catch (e) { return { name, url, kind: "page", verdict: "DEAD", detail: `unreachable (${e.name})` }; }
    if (!res.ok) return { name, url, kind: "page", verdict: "DEAD", detail: `HTTP ${res.status}` };
    const body = await readBody(res);
    const found = extractEmbeds(body);

    // Prefer the strongest signal: known embed player > YouTube > gov image.
    if (found.angelcam.size) return { name, url, kind: "angelcam", angelcam: [...found.angelcam][0], verdict: "OK_EMBED", detail: "Angelcam embed player on page" };
    if (found.ozolio.size) return { name, url, kind: "ozolio", ozolio: [...found.ozolio][0], verdict: "OK_EMBED", detail: "Ozolio embed player on page" };
    if (found.wetmet.size) return { name, url, kind: "wetmet", wetmet: [...found.wetmet][0], verdict: "OK_EMBED", detail: "WetMet embed player on page" };
    if (host.endsWith("ipcamlive.com") && found.ipcamlive.size) return { name, url, kind: "ipcamlive", ipcamlive: [...found.ipcamlive][0], verdict: "OK_EMBED", detail: "IPCamLive player page" };
    if (found.yt.size) {
      const id = [...found.yt][0];
      const p = await probeYouTube(id);
      if (p.ok) return { name: p.title || name, url, kind: "youtube", yt: id, verdict: "OK_EMBED", detail: `YouTube embed found on page — ${p.detail}` };
      return { name, url, kind: "youtube", yt: id, verdict: p.embeddable === false ? "LINK_ONLY" : "DEAD", detail: `YouTube on page — ${p.detail}` };
    }
    if (found.imgs.size) {
      const img = [...found.imgs][0];
      const p = await probeImage(img);
      if (p.ok) {
        const gov = isGov(new URL(img).hostname);
        return { name, url, kind: "image", img, verdict: gov ? "OK_EMBED" : "ASK_OWNER", detail: `snapshot on page${gov ? " (government feed)" : ""}` };
      }
    }
    if (found.m3u8.size) return { name, url, kind: "hls", verdict: "ASK_OWNER", detail: "raw HLS stream on page — needs owner OK + player work" };
    if (!blocksEmbedding(res)) return { name, url, kind: "page", verdict: "ASK_OWNER", detail: "page is frameable but no recognized player found" };
    return { name, url, kind: "page", verdict: "LINK_ONLY", detail: "no embeddable cam found / blocks framing" };
  }

  async function worker() {
    while (next < work.length) {
      const i = next++;
      try {
        results[i] = await probeLink(work[i]);
      } catch (e) {
        results[i] = { ...work[i], kind: "page", verdict: "DEAD", detail: `error: ${e.message}` };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const order = { OK_EMBED: 0, ASK_OWNER: 1, LINK_ONLY: 2, DEAD: 3 };
  results.sort((a, b) => order[a.verdict] - order[b.verdict]);
  for (const r of results) console.log(`CAM|${JSON.stringify(r)}`);
  const counts = results.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
  console.log(`\nscouted ${results.length} links → ${JSON.stringify(counts)}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
