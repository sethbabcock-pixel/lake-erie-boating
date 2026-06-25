import React, { useEffect, useMemo, useState } from "react";
import { getLinkCams, camSrc, camLink, camIsImage, camKind, camKindLabel, nearestCams } from "./cams.js";

export default function Cams({ lat, lon, spotName, lake }) {
  // Pull more than we'll show so we can drop any that are offline right now.
  const candidates = useMemo(() => nearestCams(lat, lon, lake, 12), [lat, lon, lake]);

  // View-time liveness from the worker: { "<cam name>": "live" | "offline" }.
  // null = still checking. {} = check failed → fall back to showing all.
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let abort = false;
    setStatus(null);
    fetch(`/marine/cams?lake=${encodeURIComponent(lake || "Lake Erie")}`)
      .then((r) => r.json())
      .then((d) => { if (!abort) setStatus(d.status || {}); })
      .catch(() => { if (!abort) setStatus({}); });
    // Safety: never block the section forever if the check stalls.
    const t = setTimeout(() => { if (!abort) setStatus((s) => s ?? {}); }, 8000);
    return () => { abort = true; clearTimeout(t); };
  }, [lake]);

  // Only show cams confirmed working. If none verify live (or check failed),
  // fall back to the full list so the section is never needlessly empty.
  const cams = useMemo(() => {
    if (!status) return candidates.slice(0, 8);
    const live = candidates.filter((c) => status[c.name] !== "offline");
    return (live.length ? live : candidates).slice(0, 8);
  }, [candidates, status]);
  const hiddenCount = status ? candidates.length - candidates.filter((c) => status[c.name] !== "offline").length : 0;

  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cam = cams[sel] || cams[0];

  useEffect(() => { setSel(0); }, [lat, lon, lake]);
  useEffect(() => { if (sel >= cams.length) setSel(0); }, [cams, sel]);
  useEffect(() => { setLoaded(false); setFailed(false); }, [cam]);

  // Refresh snapshot (image) cams on a timer with a cache-buster.
  const [bust, setBust] = useState(0);
  useEffect(() => {
    if (!camIsImage(cam)) return;
    const t = setInterval(() => setBust((b) => b + 1), 15000);
    return () => clearInterval(t);
  }, [cam]);

  // Safety: if a player iframe never fires onLoad, drop the spinner after a bit.
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 7000);
    return () => clearTimeout(t);
  }, [cam, loaded]);

  // Still checking which cams are live — hold off rendering a possibly-dead feed.
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
        {!loaded && !failed && <div className="camloading"><span className="spinner" />loading {cam.name}…</div>}
        {failed && (
          <div className="camloading">
            This cam isn't responding right now.{" "}
            <a href={camLink(cam)} target="_blank" rel="noopener">Open it directly ↗</a>
          </div>
        )}
        {camIsImage(cam) ? (
          <img key={cam.name} alt={cam.name} src={`${cam.img}?t=${bust}`}
            onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            style={{ opacity: loaded ? 1 : 0 }} />
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
