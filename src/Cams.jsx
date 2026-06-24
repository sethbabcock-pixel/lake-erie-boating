import React, { useEffect, useMemo, useState } from "react";
import { LINK_CAMS, camSrc, camLink, camIsImage, camKind, camKindLabel, nearestCams } from "./cams.js";

export default function Cams({ lat, lon, spotName }) {
  const cams = useMemo(() => nearestCams(lat, lon, 8), [lat, lon]);
  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cam = cams[sel] || cams[0];

  useEffect(() => { setSel(0); }, [lat, lon]);
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
      </div>
      <div className="linkcams">
        More:{" "}
        {LINK_CAMS.map((c) => (
          <a key={c.name} href={c.url} target="_blank" rel="noopener">{c.name} ↗</a>
        ))}
      </div>
    </section>
  );
}
