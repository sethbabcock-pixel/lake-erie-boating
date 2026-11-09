// Cam health check — verifies every entry in src/cams.js is still live and
// embeddable, so the live-cams section never shows a dead/spinning feed.
//
//   node scripts/check-cams.mjs
//
// Exit codes: 0 = no DEAD cams; 1 = at least one cam is DEAD (or the run
// errored); 2 = nothing could be verified at all (every cam WARN, e.g. rate
// limited or no network) -- not healthy, but not a DEAD finding either.
// WARN (offline right now / unverified / rate limited) never counts as DEAD.
// The summary reports verified vs unverified so an all-WARN run can't look green.
// The cam-health GitHub Action runs this weekly and opens an issue only on
// DEAD results (exit 1).
//
// Proxied sandboxes: set HTTPS_PROXY (and NODE_EXTRA_CA_CERTS for a re-signing
// proxy). Node's fetch only honors the proxy with NODE_USE_ENV_PROXY=1; this
// script enables it itself via scripts/lib/cam-net.mjs when HTTPS_PROXY is set.
import { CAMS, camSrc } from "../src/cams.js";
import { setupProxy, isRateLimited, summarize, RATE_LIMITED } from "./lib/cam-net.mjs";

const proxyNote = await setupProxy();
if (proxyNote) console.log(proxyNote);

const UA = "Mozilla/5.0 (compatible; ShouldIBoat-CamHealth/1.0)";
const TIMEOUT_MS = 20000;
const CONCURRENCY = 6;

async function fetchOnce(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, ...(opts.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

// Retry once on a network-level failure (timeout / connection reset) so a
// transient blip — or an upstream's brief outage — doesn't false-flag a cam.
async function fetchT(url, opts = {}) {
  try {
    return await fetchOnce(url, opts);
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    return await fetchOnce(url, opts);
  }
}

// A header set that blocks this site from iframing the page.
function blocksEmbedding(res) {
  const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return true;
  const csp = (res.headers.get("content-security-policy") || "").toLowerCase();
  const m = csp.match(/frame-ancestors([^;]*)/);
  if (m && !m[1].includes("*") && !m[1].includes("shouldiboat")) return true;
  return false;
}

async function checkImage(c) {
  const res = await fetchT(c.img);
  if (!res.ok) return { status: "DEAD", detail: `image HTTP ${res.status}` };
  const ct = res.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) return { status: "DEAD", detail: `not an image (${ct || "no content-type"})` };
  return { status: "OK", detail: ct };
}

async function checkYouTube(id) {
  const res = await fetchT(`https://www.youtube.com/watch?v=${id}`);
  if (isRateLimited(res)) return { status: "WARN", detail: `${RATE_LIMITED} (HTTP ${res.status})` };
  if (!res.ok) return { status: "DEAD", detail: `watch HTTP ${res.status}` };
  const body = await res.text();
  // YouTube increasingly serves a bot-wall (consent/challenge page) to
  // datacenter IPs; that page has no player JSON at all. Absence of the
  // playableInEmbed key means "couldn't verify", not "dead" — the app's
  // IFrame Player validates these client-side where it matters.
  if (!body.includes("playableInEmbed")) {
    // Bot-walled: oEmbed still answers per video. 200 = exists + embedding allowed;
    // 401/403/404/400 = embedding disabled, private or deleted.
    try {
      const oe = await fetchT(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
      if (oe.status === 429) return { status: "WARN", detail: `${RATE_LIMITED} (oEmbed 429)` };
      if (oe.ok) return { status: "WARN", detail: "embeddable (oEmbed ok), liveness unconfirmed — YouTube bot-wall" };
      if ([400, 401, 403, 404].includes(oe.status)) return { status: "DEAD", detail: `oEmbed HTTP ${oe.status} — embedding disabled / video gone` };
    } catch { /* fall through */ }
    return { status: "WARN", detail: `${RATE_LIMITED} (YouTube bot-wall)` };
  }
  const embeddable = body.includes('"playableInEmbed":true');
  const liveNow = body.includes('"isLiveNow":true');
  if (!embeddable) return { status: "DEAD", detail: "embedding disabled / video gone" };
  if (!liveNow) return { status: "WARN", detail: "embeddable but not live right now" };
  return { status: "OK", detail: "live + embeddable" };
}

async function checkIpcamlive(alias) {
  const res = await fetchT(`https://www.ipcamlive.com/player/player.php?alias=${alias}&autoplay=1`);
  if (!res.ok) return { status: "DEAD", detail: `player HTTP ${res.status}` };
  const body = await res.text();
  const sid = (body.match(/var streamid = '([^']+)'/) || [])[1];
  const server = (body.match(/address = '(https?:\/\/s\d+\.ipcamlive\.com\/?)'/) || [])[1];
  if (!sid || !server) return { status: "DEAD", detail: "no stream assigned (offline)" };
  const snap = await fetchT(`${server.replace(/\/$/, "")}/streams/${sid}/snapshot.jpg`);
  if (!snap.ok) return { status: "WARN", detail: "stream assigned but no current snapshot" };
  return { status: "OK", detail: "live snapshot ok" };
}

// Embedded iframe page (wetmet / angelcam / ozolio): healthy if it loads, does
// not block framing, and its media stream is HTTPS. An insecure http / Wowza
// :1935 stream is mixed-content blocked on our HTTPS site (pixelcaster's flaw).
async function checkFramePage(url) {
  const res = await fetchT(url);
  if (!res.ok) return { status: "DEAD", detail: `HTTP ${res.status}` };
  if (blocksEmbedding(res)) return { status: "DEAD", detail: "blocks iframe embedding" };
  const body = await res.text().catch(() => "");
  const media = body.match(/(?:https?:)?\/\/[^\s"'<>]+?\.(?:m3u8|mp4)\b[^\s"'<>]*/i);
  if (media && (/:1935\b/.test(media[0]) || /^http:\/\//i.test(media[0]))) {
    return { status: "DEAD", detail: `insecure stream (mixed-content blocked): ${media[0].slice(0, 60)}` };
  }
  return { status: "OK", detail: `HTTP ${res.status}` };
}

async function checkCam(c) {
  try {
    if (c.img) return await checkImage(c);
    if (c.yt) return await checkYouTube(c.yt);
    if (c.ytChannel) return await checkFramePage(camSrc(c));
    if (c.ipcamlive) return await checkIpcamlive(c.ipcamlive);
    return await checkFramePage(camSrc(c)); // wetmet / pixelcaster / angelcam
  } catch (e) {
    // Network-level failure (timeout / connection error / upstream outage) is
    // not proof a cam is dead — flag it WARN so the run doesn't fail on a blip.
    return { status: "WARN", detail: `unreachable: ${e.name === "AbortError" ? "timeout" : (e.cause?.code || e.message || "error")}` };
  }
}

async function run() {
  const results = new Array(CAMS.length);
  let next = 0;
  async function worker() {
    while (next < CAMS.length) {
      const i = next++;
      results[i] = { cam: CAMS[i], ...(await checkCam(CAMS[i])) };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const icon = { OK: "✓", WARN: "△", DEAD: "✗" };
  for (const r of results) {
    const lake = (r.cam.lake || "Lake Erie").replace("Lake ", "");
    console.log(`${icon[r.status]} [${r.status.padEnd(4)}] ${lake.padEnd(9)} ${r.cam.name}  —  ${r.detail}`);
  }
  const dead = results.filter((r) => r.status === "DEAD");
  const sum = summarize("cams", results);
  if (dead.length) {
    console.log("\nDEAD cams need replacing in src/cams.js:");
    for (const r of dead) console.log(`  - ${r.cam.name} (${r.detail})`);
    process.exit(1);
  }
  if (sum.allUnverified) process.exit(2);
}

run().catch((e) => { console.error(e); process.exit(1); });
