import React, { useEffect, useState } from "react";
import Cams from "./Cams.jsx";

const fmt = (v, unit) => (v == null ? "—" : `${v}${unit || ""}`);
const verdictClass = (lvl) => (lvl === "NO-GO" ? "nogo" : lvl === "CAUTION" ? "caution" : "go");

function windyUrl(lat, lon) {
  return (
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}` +
    `&detailLat=${lat}&detailLon=${lon}&zoom=9&level=surface&overlay=wind&product=ecmwf` +
    `&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates` +
    `&detail=&metricWind=kt&metricTemp=%C2%B0F&radarRange=-1`
  );
}

// Flips data-theme on <html> and remembers the choice. Initial value comes from
// the no-flash script in index.html (localStorage or prefers-color-scheme).
function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute("data-theme") || "light"
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch (e) { /* ignore */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

const fmtHour = (t, withMin) =>
  new Date(t).toLocaleTimeString([], withMin ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });

function OutlookBanner({ outlook }) {
  if (!outlook) return null;
  if (outlook.goodHours === 0)
    return <div className="outlook bad">🚫 Not a window right now — conditions are poor at the moment.</div>;
  if (outlook.headInBy)
    return (
      <div className="outlook warn">
        🕐 Good to head out now — plan to be back in by <b>{fmtHour(outlook.headInBy, true)}</b>
        {" "}({outlook.headInReason || "conditions turn"}).
      </div>
    );
  return <div className="outlook good">🕐 Clear window — conditions hold for the next {outlook.goodHours}+ hours.</div>;
}

function HourStrip({ hours, headInBy }) {
  if (!hours || !hours.length) return null;
  return (
    <section className="card hourcard">
      <h2>Hour-by-hour · next {hours.length} hours</h2>
      <div className="hours">
        {hours.map((h) => (
          <div
            key={h.time}
            className={`hour ${h.level === "NO-GO" ? "nogo" : h.level.toLowerCase()} ${headInBy === h.time ? "cutoff" : ""}`}
            title={h.short}
          >
            <div className="ht">{fmtHour(h.time).replace(" ", "")}</div>
            <div className="hbar" />
            <div className="hw">{h.windKt ?? "—"}<span>kt</span></div>
            <div className="hp">{h.precipPct ? `${h.precipPct}%` : ""}</div>
          </div>
        ))}
      </div>
      <div className="hint">Green = go · amber = caution · red = stay in. A red-ringed hour is when to be back in. Wind in knots; % = rain chance.</div>
    </section>
  );
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [spots, setSpots] = useState([]);
  const [active, setActive] = useState(() => localStorage.getItem("boating.spot") || "sandusky");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/marine/conditions?spots")
      .then((r) => r.json())
      .then((d) => setSpots(d.spots || []))
      .catch(() => {});
  }, []);

  const loadSpot = (id) => {
    setLoading(true);
    setError(null);
    fetch(`/marine/conditions?spot=${encodeURIComponent(id)}`)
      .then((r) => { if (!r.ok) throw new Error(`Server returned ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { loadSpot(active); localStorage.setItem("boating.spot", active); }, [active]);

  const spot = data?.spot;
  const rec = data?.recommendation;
  const wind = data?.wind || {};
  const wv = data?.waves || {};
  const buoy = data?.buoy;
  const wr = data?.windRead;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src={theme === "dark" ? "/boat-mark-white.png" : "/boat-mark.png"} alt="Should I Boat?" />
          <div>
            <h1>Should I Boat?</h1>
            <div className="region">Lake Erie · Toledo → Erie, PA</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="live">live</span>
          <button className="themebtn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} title="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      <nav className="spots">
        {spots.map((s) => (
          <button key={s.id} className={s.id === active ? "active" : ""} onClick={() => setActive(s.id)}>
            {s.name}
          </button>
        ))}
      </nav>

      {loading && !data && <div className="loading">Loading live Lake Erie conditions…</div>}
      {error && <div className="err">Couldn't load conditions: {error}. <button onClick={() => loadSpot(active)}>Retry</button></div>}

      {data && (
        <>
          <section className={`verdict ${verdictClass(rec.level)}`}>
            <div className="where">{spot.name}</div>
            <div className="lvl">{rec.level}</div>
            <div className="sum">{rec.summary}</div>
            <ul className="reasons">{rec.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </section>

          {(data.alerts || []).map((a, i) => (
            <div className="alert" key={i}>
              <div className="ev">⚠ {a.event || "Marine alert"}</div>
              <div className="hl">{a.headline || ""}</div>
            </div>
          ))}

          <OutlookBanner outlook={data.outlook} />
          <HourStrip hours={data.hourly} headInBy={data.outlook?.headInBy} />

          <div className="dash">
            {/* Left column: the quick read + visuals */}
            <div className="col">
              <div className="grid">
                <div className="stat hero">
                  <div className="k">Wind</div>
                  <div className="v">{fmt(wind.speedKt, " kt")}</div>
                  <div className="sub">
                    {[wind.dir, wind.gustKt ? `gust ${wind.gustKt} kt` : null, wind.source]
                      .filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="stat">
                  <div className="k">Waves</div>
                  <div className="v">{fmt(wv.ft, " ft")}</div>
                  <div className="sub">{wv.periodSec ? `${wv.periodSec}s period` : (wv.source || "—")}</div>
                </div>
                <div className="stat">
                  <div className="k">Water</div>
                  <div className="v">{fmt(buoy ? buoy.waterTempF : null, "°")}</div>
                  <div className="sub">{buoy && buoy.airTempF != null ? `air ${buoy.airTempF}°` : ""}</div>
                </div>
              </div>

              {wr && (
                <section className={`card wr-${wr.tone}`}>
                  <h2>Wind read · out of the {wr.dir}</h2>
                  <div className="advice">{wr.advice}</div>
                </section>
              )}

              <section className="card">
                <h2>Weather map · {spot.name}</h2>
                <div className="mapwrap">
                  <iframe title="Windy weather map" src={windyUrl(spot.lat, spot.lon)} loading="lazy" allow="fullscreen" />
                </div>
                <div className="hint">Tap the layer buttons in the map for wind · gusts · waves · rain · radar.</div>
              </section>

              <Cams lat={spot.lat} lon={spot.lon} spotName={spot.name} />
            </div>

            {/* Right column: the detailed forecasts */}
            <div className="col">
              {(data.marineForecast || []).length > 0 && (
                <section className="card">
                  <h2>Marine zone forecast · {spot.zone}</h2>
                  {data.marineForecast.map((p, i) => (
                    <div className="fc" key={i}><div className="nm">{p.name}</div><div className="tx">{p.forecast || ""}</div></div>
                  ))}
                </section>
              )}

              {(data.pointForecast || []).length > 0 && (
                <section className="card">
                  <h2>Local weather</h2>
                  {data.pointForecast.map((p, i) => (
                    <div className="fc" key={i}>
                      <div className="nm">{p.name} · {fmt(p.tempF, "°")}{p.precipPct ? ` · ${p.precipPct}% precip` : ""}</div>
                      <div className="tx">{p.shortForecast || ""}. Wind {p.wind || ""}.</div>
                    </div>
                  ))}
                </section>
              )}

              {data.noaaReport?.text && (
                <details className="card">
                  <summary>📋 Formal NOAA Nearshore Forecast (NSH · {data.noaaReport.office})</summary>
                  <pre className="nsh">{data.noaaReport.text}</pre>
                </details>
              )}
            </div>
          </div>

          <footer className="meta">
            Source: {buoy ? `Buoy ${buoy.station} · ${buoy.ageMinutes != null ? `${buoy.ageMinutes} min ago` : "latest"}` : "forecast only"}
            {" · NWS & NDBC (NOAA), Windy. Updated "}{new Date(data.updatedAt).toLocaleTimeString()}
            <button onClick={() => loadSpot(active)}>↻ Refresh</button>
          </footer>
        </>
      )}
    </div>
  );
}
