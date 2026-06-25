import React, { useEffect, useMemo, useRef, useState } from "react";
import { getLinkCams, camSrc, camLink, camIsImage, camKind, camKindLabel, nearestCams } from "./cams.js";

// Load the YouTube IFrame Player API once. The player reports real errors
// (ended stream / "recording not available" / embedding disabled) that a plain
// iframe's onLoad can't — that's how we catch dead YouTube cams client-side,
// since YouTube blocks server-side liveness checks from datacenter IPs.
let ytApiPromise;
function loadYT() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

function YouTubeCam({ videoId, onLoaded, onFail }) {
  const holder = useRef(null);
  useEffect(() => {
    let player, watchdog, cancelled = false;
    const inner = document.createElement("div");
    inner.style.width = "100%"; inner.style.height = "100%";
    if (holder.current) holder.current.appendChild(inner);
    loadYT().then((YT) => {
      if (cancelled || !YT) return;
      player = new YT.Player(inner, {
        width: "100%", height: "100%", videoId,
        playerVars: { autoplay: 1, mute: 1, rel: 0, playsinline: 1, modestbranding: 1 },
        events: {
          onReady: () => {
            // If it never actually starts playing/buffering, the stream is dead.
            watchdog = setTimeout(() => {
              const st = player && player.getPlayerState && player.getPlayerState();
              if (st !== 1 && st !== 3) onFail();
            }, 9000);
          },
          onStateChange: (e) => {
            if (e.data === 1 || e.data === 3) { clearTimeout(watchdog); onLoaded(); } // playing / buffering
            else if (e.data === 0) onFail(); // ended
          },
          onError: () => { clearTimeout(watchdog); onFail(); },
        },
      });
    });
    return () => {
      cancelled = true; clearTimeout(watchdog);
      try { player && player.destroy(); } catch {}
    };
  }, [videoId]);
  return <div ref={holder} className="ytholder" />;
}

export default function Cams({ lat, lon, spotName, lake }) {
  // Pull more than we'll show so we can drop any that are offline right now.
  const candidates = useMemo(() => nearestCams(lat, lon, lake, 12), [lat, lon, lake]);

  // Server-side liveness for the NON-YouTube feeds (images, ipcamlive, wetmet,
  // pixelcaster): { "<cam name>": "live" | "offline" | "unknown" }.
  // YouTube cams come back "unknown" (YT blocks edge checks) and are validated
  // client-side by the player instead. null = still checking.
  const [status, setStatus] = useState(null);
  // YouTube cams the player reported dead this session → also hidden.
  const [failed, setFailed] = useState({});

  useEffect(() => {
    let abort = false;
    setStatus(null); setFailed({});
    fetch(`/marine/cams?lake=${encodeURIComponent(lake || "Lake Erie")}`)
      .then((r) => r.json())
      .then((d) => { if (!abort) setStatus(d.status || {}); })
      .catch(() => { if (!abort) setStatus({}); });
    const t = setTimeout(() => { if (!abort) setStatus((s) => s ?? {}); }, 8000);
    return () => { abort = true; clearTimeout(t); };
  }, [lake]);

  // Hide cams confirmed offline (server) or reported dead (player). Fall back to
  // the full list if that would leave nothing, so the section is never empty.
  const cams = useMemo(() => {
    const base = status ? candidates.filter((c) => status[c.name] !== "offline") : candidates.slice();
    const ok = base.filter((c) => !failed[c.name]);
    return (ok.length ? ok : base).slice(0, 8);
  }, [candidates, status, failed]);
  const hiddenCount = candidates.length - cams.length;

  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [iframeFail, setIframeFail] = useState(false);
  const cam = cams[sel] || cams[0];

  useEffect(() => { setSel(0); }, [lat, lon, lake]);
  useEffect(() => { setSel(0); }, [cams.length]); // a cam dropped out → jump to a working one
  useEffect(() => { setLoaded(false); setIframeFail(false); }, [cam]);

  const markFailed = (name) => setFailed((f) => (f[name] ? f : { ...f, [name]: true }));

  // Refresh snapshot (image) cams on a timer with a cache-buster.
  const [bust, setBust] = useState(0);
  useEffect(() => {
    if (!camIsImage(cam)) return;
    const t = setInterval(() => setBust((b) => b + 1), 15000);
    return () => clearInterval(t);
  }, [cam]);

  // Spinner safety for image/non-YT-iframe cams (YouTube manages its own).
  useEffect(() => {
    if (loaded || !cam || cam.yt) return;
    const t = setTimeout(() => setLoaded(true), 7000);
    return () => clearTimeout(t);
  }, [cam, loaded]);

  if (status === null) {
    return (
      <section className="card">
        <div className="card-head"><h2>Live cams</h2></div>
        <div className="camloading"><span className="spinner" />finding live cams…</div>
      </section>
    );
  }

  if (!cams.length) {
    return (
      <section className="card">
        <div className="card-head"><h2>Live cams</h2></div>
        <div className="camempty">No live webcams for this lake right now — they come and go. Check the directory links below or your local harbor cam.</div>
        {getLinkCams(lake).length > 0 && (
          <div className="linkcams">
            More:{" "}
            {getLinkCams(lake).map((c) => (
              <a key={c.name} href={c.url} target="_blank" rel="noopener">{c.name} ↗</a>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Live cams</h2>
        <span className={`cam-kind ${camKind(cam)}`}>{camKindLabel(cam)}</span>
      </div>

      <select className="sel camsel" value={sel} onChange={(e) => setSel(Number(e.target.value))} aria-label="Choose a webcam">
        {cams.map((c, i) => (
          <option key={c.name} value={i}>{camIsImage(c) ? "📷 " : "📹 "}{c.name}</option>
        ))}
      </select>

      <div className="camwrap">
        {!loaded && !iframeFail && <div className="camloading"><span className="spinner" />loading {cam.name}…</div>}
        {iframeFail && (
          <div className="camloading">
            This cam isn't responding right now.{" "}
            <a href={camLink(cam)} target="_blank" rel="noopener">Open it directly ↗</a>
          </div>
        )}
        {camIsImage(cam) ? (
          <img key={cam.name} alt={cam.name} src={`${cam.img}?t=${bust}`}
            onLoad={() => setLoaded(true)} onError={() => setIframeFail(true)}
            style={{ opacity: loaded ? 1 : 0 }} />
        ) : cam.yt ? (
          <YouTubeCam key={cam.name} videoId={cam.yt}
            onLoaded={() => setLoaded(true)} onFail={() => markFailed(cam.name)} />
        ) : (
          <iframe key={cam.name} title={cam.name} src={camSrc(cam)} loading="eager"
            allow="autoplay; fullscreen" allowFullScreen
            onLoad={() => setLoaded(true)} style={{ opacity: loaded ? 1 : 0 }} />
        )}
      </div>

      <div className="hint">
        <a href={camLink(cam)} target="_blank" rel="noopener">Open this cam ↗</a>
        {camIsImage(cam)
          ? " · still image, refreshes every 15s"
          : " · live video — some players need a tap to start"}
        {hiddenCount > 0 && ` · ${hiddenCount} offline cam${hiddenCount > 1 ? "s" : ""} hidden`}
      </div>
      {getLinkCams(lake).length > 0 && (
        <div className="linkcams">
          More:{" "}
          {getLinkCams(lake).map((c) => (
            <a key={c.name} href={c.url} target="_blank" rel="noopener">{c.name} ↗</a>
          ))}
        </div>
      )}
    </section>
  );
}
