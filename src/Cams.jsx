import React, { useEffect, useMemo, useState } from "react";
import { CAMS, LINK_CAMS, camSrc, camLink, camIsImage, nearestCams } from "./cams.js";

export default function Cams({ lat, lon, spotName }) {
  const cams = useMemo(() => nearestCams(lat, lon, 7), [lat, lon]);
  const [sel, setSel] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cam = cams[sel] || cams[0];

  // Reset selection + loading when the spot (and therefore the cam list) changes.
  useEffect(() => { setSel(0); }, [lat, lon]);
  useEffect(() => { setLoaded(false); setFailed(false); }, [cam]);

  // Refresh snapshot (image) cams on a timer with a cache-buster.
  const [bust, setBust] = useState(0);
  useEffect(() => {
    if (!camIsImage(cam)) return;
    const t = setInterval(() => setBust((b) => b + 1), 15000);
    return () => clearInterval(t);
  }, [cam]);

  // Safety: if a player iframe never fires onLoad, drop the spinner anyway.
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 6000);
    return () => clearTimeout(t);
  }, [cam, loaded]);

  return (
    <section className="card">
      <h2>Live cams · nearest to {spotName}</h2>
      <div className="camtabs">
        {cams.map((c, i) => (
          <button key={c.name} className={i === sel ? "active" : ""} onClick={() => setSel(i)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="camwrap">
        {!loaded && !failed && <div className="camloading"><span className="spinner" />loading {cam.name}…</div>}
        {failed && <div className="camloading">Couldn't load this cam. <a href={camLink(cam)} target="_blank" rel="noopener">Open it directly ↗</a></div>}
        {camIsImage(cam) ? (
          <img
            key={cam.name}
            alt={cam.name}
            src={`${cam.img}?t=${bust}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : (
          <iframe
            key={cam.name}
            title={cam.name}
            src={camSrc(cam)}
            loading="eager"
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        )}
      </div>

      <div className="hint">
        <a href={camLink(cam)} target="_blank" rel="noopener">Open this cam full ↗</a>
        {!camIsImage(cam) && " · some cams need a tap to start"}
      </div>
      <div className="linkcams">
        More cams (new tab):{" "}
        {LINK_CAMS.map((c) => (
          <a key={c.name} href={c.url} target="_blank" rel="noopener">{c.name} ↗</a>
        ))}
      </div>
    </section>
  );
}
