// Verify proposed cams BEFORE they go into src/cams.js.
//
//   node scripts/verify-cam-candidates.mjs [scripts/cam-candidates.json]
//
// Input: a JSON array of { spot, name, lake, lat, lon, kind, id, link?, view? }
// where kind is one of yt | ytChannel | angelcam | wetmet | ipcamlive | ozolio | img.
// For each candidate this prints one line:
//   VERDICT|kind|id|name|detail|title
// VERDICT is OK (live + embeddable), WARN (exists + embeddable, couldn't
// confirm live from this IP), or DEAD (gone / not embeddable / not an image).
// `title` is the provider's own title (YouTube oEmbed / page <title>) — read it
// to confirm the cam is a WATER view, not a street or traffic cam.
//
// Needs outbound network. In a proxied sandbox set HTTPS_PROXY (and
// NODE_EXTRA_CA_CERTS for a re-signing proxy); the proxy is enabled
// automatically (Node's fetch alone needs NODE_USE_ENV_PROXY=1). YouTube HTTP
// 429 / bot-walls are reported as WARN "unverified — rate limited", never DEAD,
// and the summary shows verified vs unverified. Exit 2 = nothing verified.
// The "Run script" GitHub Action (workflow_dispatch) also works.
import { readFileSync } from "node:fs";
import { setupProxy, isRateLimited, summarize, RATE_LIMITED } from "./lib/cam-net.mjs";

const proxyNote = await setupProxy();
if (proxyNote) console.log(proxyNote);

const FILE = process.argv[2] || "scripts/cam-candidates.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 20000;
const CONCURRENCY = 6;

async function fetchT(url, opts = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, { redirect: "follow", signal: ctrl.signal, ...opts, headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...(opts.headers || {}) } });
    } catch (e) {
      if (attempt) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      clearTimeout(t);
    }
  }
}

function blocksEmbedding(res) {
  const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return true;
  const csp = (res.headers.get("content-security-policy") || "").toLowerCase();
  const m = csp.match(/frame-ancestors([^;]*)/);
  return Boolean(m && !m[1].includes("*") && !m[1].includes("shouldiboat"));
}

const pageTitle = (body) => ((body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim();

// oEmbed answers from datacenter IPs even when the watch page is bot-walled:
// 200 + title = exists and embeddable; 401 = embedding disabled; 404 = gone.
async function ytOembed(id) {
  const r = await fetchT(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
  if (r.status === 429) return { limited: true };
  if (r.status === 401 || r.status === 403) return { embeddable: false };
  if (!r.ok) return { gone: true, status: r.status };
  const d = await r.json().catch(() => ({}));
  return { embeddable: true, title: `${d.title || ""} — ${d.author_name || ""}` };
}

async function checkYouTube(id) {
  const o = await ytOembed(id);
  if (o.limited) return { v: "WARN", detail: `${RATE_LIMITED} (oEmbed 429)` };
  if (o.gone) return { v: "DEAD", detail: `oEmbed HTTP ${o.status} (video gone/private)` };
  if (!o.embeddable) return { v: "DEAD", detail: "embedding disabled" };
  const res = await fetchT(`https://www.youtube.com/watch?v=${id}`);
  const body = res.ok ? await res.text() : "";
  if (isRateLimited(res, body)) return { v: "WARN", detail: `embeddable; live status ${RATE_LIMITED}`, title: o.title };
  if (!body.includes("playableInEmbed")) return { v: "WARN", detail: "embeddable; live status unverified (bot-wall)", title: o.title };
  if (body.includes('"isLiveNow":true')) return { v: "OK", detail: "live + embeddable", title: o.title };
  if (body.includes('"isLiveContent":true')) return { v: "WARN", detail: "live stream, offline right now", title: o.title };
  return { v: "DEAD", detail: "not a live stream (VOD)", title: o.title };
}

async function checkYtChannel(id) {
  const res = await fetchT(`https://www.youtube.com/channel/${id}/live`);
  if (isRateLimited(res)) return { v: "WARN", detail: `${RATE_LIMITED} (channel HTTP ${res.status})` };
  if (!res.ok) return { v: "DEAD", detail: `channel HTTP ${res.status}` };
  const body = await res.text();
  const vid = (body.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1];
  if (!vid) {
    if (!body.includes("ytInitialData")) return { v: "WARN", detail: "bot-wall — couldn't resolve live video", title: pageTitle(body) };
    return { v: "DEAD", detail: "channel has no live stream now", title: pageTitle(body) };
  }
  const r = await checkYouTube(vid);
  return { ...r, detail: `${r.detail} (live video ${vid})` };
}

async function checkImage(url) {
  const res = await fetchT(url);
  if (!res.ok) return { v: "DEAD", detail: `image HTTP ${res.status}` };
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) return { v: "DEAD", detail: `not an image (${ct || "none"})` };
  const lm = res.headers.get("last-modified");
  const ageH = lm ? (Date.now() - Date.parse(lm)) / 3.6e6 : null;
  if (ageH != null && ageH > 24) return { v: "DEAD", detail: `stale snapshot (${Math.round(ageH)} h old)` };
  return { v: "OK", detail: `${ct}${ageH != null ? `, ${ageH.toFixed(1)} h old` : ""}` };
}

async function checkIpcamlive(alias) {
  const res = await fetchT(`https://www.ipcamlive.com/player/player.php?alias=${alias}&autoplay=1`);
  if (!res.ok) return { v: "DEAD", detail: `player HTTP ${res.status}` };
  const body = await res.text();
  const sid = (body.match(/var streamid = '([^']+)'/) || [])[1];
  const server = (body.match(/address = '(https?:\/\/s\d+\.ipcamlive\.com\/?)'/) || [])[1];
  if (!sid || !server) return { v: "DEAD", detail: "no stream assigned (offline)" };
  const snap = await fetchT(`${server.replace(/\/$/, "")}/streams/${sid}/snapshot.jpg`);
  return snap.ok ? { v: "OK", detail: "live snapshot ok" } : { v: "WARN", detail: "stream assigned, no snapshot" };
}

async function checkFrame(url) {
  const res = await fetchT(url);
  if (!res.ok) return { v: "DEAD", detail: `HTTP ${res.status}` };
  if (blocksEmbedding(res)) return { v: "DEAD", detail: "blocks iframe embedding" };
  const body = await res.text().catch(() => "");
  const media = body.match(/(?:https?:)?\/\/[^\s"'<>]+?\.(?:m3u8|mp4)\b[^\s"'<>]*/i);
  if (media && (/:1935\b/.test(media[0]) || /^http:\/\//i.test(media[0]))) return { v: "DEAD", detail: "insecure stream (mixed content)" };
  if (/offline|not found|does not exist|no longer available/i.test(pageTitle(body))) return { v: "DEAD", detail: "player says offline/not found", title: pageTitle(body) };
  return { v: "OK", detail: `HTTP ${res.status}${media ? ", https stream" : ""}`, title: pageTitle(body) };
}

const FRAME = {
  angelcam: (id) => `https://v.angelcam.com/iframe?v=${id}&autoplay=1`,
  wetmet: (id) => `https://api.wetmet.net/widgets/stream/frame.php?uid=${id}`,
  ozolio: (id) => `https://relay.ozolio.com/pub.api?cmd=embed&oid=${id}`,
};

async function check(c) {
  try {
    if (c.kind === "yt") return await checkYouTube(c.id);
    if (c.kind === "ytChannel") return await checkYtChannel(c.id);
    if (c.kind === "img") return await checkImage(c.id);
    if (c.kind === "ipcamlive") return await checkIpcamlive(c.id);
    if (FRAME[c.kind]) return await checkFrame(FRAME[c.kind](c.id));
    return { v: "DEAD", detail: `unknown kind ${c.kind}` };
  } catch (e) {
    return { v: "WARN", detail: `unreachable: ${e.name === "AbortError" ? "timeout" : (e.cause?.code || e.message)}` };
  }
}

const list = JSON.parse(readFileSync(FILE, "utf8"));
const out = new Array(list.length);
let next = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < list.length) {
    const i = next++;
    out[i] = await check(list[i]);
  }
}));
list.forEach((c, i) => {
  const r = out[i];
  console.log(`${r.v}|${c.kind}|${c.id}|${c.name}|${r.detail}|${(r.title || "").slice(0, 120)}`);
});
const sum = summarize("candidates", out.map((r) => ({ status: r.v, detail: r.detail })));
if (sum.allUnverified) process.exit(2);
