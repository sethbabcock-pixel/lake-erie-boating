import React, { useEffect, useState } from "react";
import Cams from "./Cams.jsx";
import WxIcon from "./WxIcon.jsx";
import { useAdsense, AdSlot, GearBlock, ConsentBanner } from "./monetize.jsx";

const fmt = (v, unit) => (v == null ? "—" : `${v}${unit || ""}`);
const verdictClass = (lvl) => (lvl === "NO-GO" ? "nogo" : lvl === "CAUTION" ? "caution" : "go");
const fmtHour = (t, withMin) =>
  new Date(t).toLocaleTimeString([], withMin ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });

function windyUrl(lat, lon, overlay = "wind") {
  return (
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}` +
    `&detailLat=${lat}&detailLon=${lon}&zoom=9&level=surface&overlay=${overlay}&product=ecmwf` +
    `&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates` +
    `&detail=&metricWind=kt&metricTemp=%C2%B0F&radarRange=-1`
  );
}

// Compact weather glyph from an NWS shortForecast.
function wxGlyph(short) {
  const s = (short || "").toLowerCase();
  if (/thunder|tstm|waterspout/.test(s)) return "⛈️";
  if (/snow|flurr|sleet|wintry|ice/.test(s)) return "🌨️";
  if (/rain|shower|drizzle/.test(s)) return /sunny|partly|mostly sunny|few/.test(s) ? "🌦️" : "🌧️";
  if (/fog|haze|mist|smoke/.test(s)) return "🌫️";
  if (/mostly cloudy|overcast|^cloudy|broken/.test(s)) return "☁️";
  if (/partly|mostly sunny|few clouds|partly cloudy/.test(s)) return "⛅";
  if (/sunny|clear/.test(s)) return "☀️";
  return "🌤️";
}

function dayLabel(d) {
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((d0 - t0) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short" });
}

function groupByDay(hours) {
  const out = [];
  let cur = null;
  for (const h of hours) {
    const d = new Date(h.time);
    const key = d.toDateString();
    if (!cur || cur.key !== key) { cur = { key, label: dayLabel(d), hours: [] }; out.push(cur); }
    cur.hours.push(h);
  }
  return out;
}

// Theme choice: "dark" | "light" | "system" (default DARK).
function useTheme() {
  const [choice, setChoice] = useState(() => {
    try { return localStorage.getItem("theme") || "dark"; } catch (e) { return "dark"; }
  });
  const [effective, setEffective] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );
  useEffect(() => {
    const apply = () => {
      const eff = choice === "system"
        ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
        : choice;
      document.documentElement.setAttribute("data-theme", eff);
      setEffective(eff);
    };
    apply();
    try { localStorage.setItem("theme", choice); } catch (e) { /* ignore */ }
    if (choice === "system") {
      const mq = matchMedia("(prefers-color-scheme: light)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [choice]);
  return { choice, setChoice, effective };
}

// The gold "yellow time" — when to head back in.
function OutlookPill({ outlook }) {
  if (!outlook) return null;
  if (outlook.goodHours === 0) return <span className="opill bad">⛔ not right now</span>;
  if (outlook.headInBy)
    return <span className="opill warn">🕐 be in by <b>{fmtHour(outlook.headInBy, true)}</b> · {outlook.headInReason || "weather turns"}</span>;
  return <span className="opill good">🕐 good for {outlook.goodHours}h+</span>;
}

function HourStrip({ hours, headInBy }) {
  if (!hours || !hours.length) return null;
  const days = groupByDay(hours);
  return (
    <section className="card hourcard">
      <div className="card-head">
        <h2>Hour-by-hour · next {hours.length} hours</h2>
        <span className="legend"><i className="lg go" />go <i className="lg caution" />caution <i className="lg nogo" />stay in</span>
      </div>
      <div className="hours">
        {days.map((day) => (
          <React.Fragment key={day.key}>
            <div className="day-sep"><span>{day.label}</span></div>
            {day.hours.map((h) => (
              <div key={h.time}
                className={`hour ${h.level === "NO-GO" ? "nogo" : h.level.toLowerCase()} ${headInBy === h.time ? "cutoff" : ""}`}
                title={h.short}>
                <div className="ht">{fmtHour(h.time).replace(" ", "")}</div>
                <div className="hicon" aria-hidden="true">{wxGlyph(h.short)}</div>
                <div className="hbar" />
                <div className="hm"><b>{h.windKt ?? "—"}</b><small>kt</small></div>
                <div className="hm wave"><b>{h.waveFt ?? "—"}</b><small>ft</small></div>
                <div className="hp">{h.precipPct ? `${h.precipPct}%` : "·"}</div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="hint">Wind (kt) · wave (ft) · rain chance per hour. Red-ringed hour = be back in by then. Scroll for up to 3 days.</div>
    </section>
  );
}

function MapCard({ spot }) {
  const [layer, setLayer] = useState("wind");
  const layers = [["wind", "Wind"], ["waves", "Waves"], ["rain", "Rain"]];
  return (
    <section className="card">
      <div className="card-head">
        <h2>Weather map</h2>
        <div className="maptabs">
          {layers.map(([k, label]) => (
            <button key={k} className={layer === k ? "active" : ""} onClick={() => setLayer(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="mapwrap">
        <iframe key={layer} title={`Windy ${layer} map`} src={windyUrl(spot.lat, spot.lon, layer)} loading="lazy" allow="fullscreen" />
      </div>
      <div className="hint">{spot.name} · switch layers above; pan & zoom inside the map.</div>
    </section>
  );
}

export default function App() {
  const { choice, setChoice, effective } = useTheme();
  useAdsense();
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

  // Location options grouped by lake (scales to all five lakes).
  const spotOptions = spots.length ? spots : (spot ? [{ ...spot, lake: "Lake Erie" }] : [{ id: active, name: "Loading…", lake: "Lake Erie" }]);
  const byLake = {};
  spotOptions.forEach((s) => { (byLake[s.lake || "Lake Erie"] ||= []).push(s); });

  return (
    <>
      <header className="appheader">
        <div className="appheader-inner">
          <a className="brand" href="/" aria-label="Should I Boat — home">
            <img className="logo" src={effective === "dark" ? "/boat-mark-white.png" : "/boat-mark.png"} alt="" />
            <span className="wordmark">
              <span className="wm-name">SHOULDI<b>BOAT</b><span className="wm-dot">.com</span></span>
              <span className="wm-tag">The navigator for all your nautical decisions</span>
            </span>
          </a>
          <div className="controls">
            <select className="sel locsel" value={active} onChange={(e) => setActive(e.target.value)} aria-label="Launch location">
              {Object.entries(byLake).map(([lake, list]) => (
                <optgroup key={lake} label={lake}>
                  {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              ))}
            </select>
            <select className="sel themesel" value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Theme">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">Auto</option>
            </select>
          </div>
        </div>
      </header>

      <main className="app">
        {loading && !data && <div className="loading">Loading live conditions…</div>}
        {error && <div className="err">Couldn't load conditions: {error}. <button onClick={() => loadSpot(active)}>Retry</button></div>}

        {data && (
          <>
            {/* ── The Call ── */}
            <section className={`call ${verdictClass(rec.level)}`}>
              <div className="call-badge"><span>{rec.level}</span></div>
              <div className="call-body">
                <div className="call-top">
                  <span className="call-spot">{spot.name}</span>
                  <OutlookPill outlook={data.outlook} />
                </div>
                <div className="call-sum">{rec.summary}</div>
                <ul className="reasons">{rec.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            </section>

            {(data.alerts || []).map((a, i) => (
              <div className="alert" key={i}>
                <div className="ev">⚠ {a.event || "Marine alert"}</div>
                <div className="hl">{a.headline || ""}</div>
              </div>
            ))}

            {/* ── Right now ── */}
            <div className="grid stats">
              <div className="stat hero">
                <div className="k">Wind</div>
                <div className="v">{fmt(wind.speedKt, "")}<small>kt</small></div>
                <div className="sub">{[wind.dir, wind.gustKt ? `gust ${wind.gustKt}` : null, wind.source].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="stat">
                <div className="k">Waves</div>
                <div className="v">{fmt(wv.ft, "")}<small>ft</small></div>
                <div className="sub">{wv.periodSec ? `${wv.periodSec}s period` : (wv.source || "—")}</div>
              </div>
              <div className="stat">
                <div className="k">Water</div>
                <div className="v">{fmt(buoy ? buoy.waterTempF : null, "")}<small>°F</small></div>
                <div className="sub">{buoy ? "buoy" : "—"}</div>
              </div>
              <div className="stat">
                <div className="k">Air</div>
                <div className="v">{fmt(buoy && buoy.airTempF != null ? buoy.airTempF : null, "")}<small>°F</small></div>
                <div className="sub">{buoy && buoy.airTempF != null ? "buoy" : "—"}</div>
              </div>
            </div>

            {wr && (
              <section className={`card wr-${wr.tone} windread`}>
                <div className="card-head"><h2>Wind read</h2><span className="wr-dir">out of the {wr.dir}</span></div>
                <div className="advice">{wr.advice}</div>
              </section>
            )}

            {/* ── Timeline ── */}
            <HourStrip hours={data.hourly} headInBy={data.outlook?.headInBy} />

            {/* ── Map + Cams ── */}
            <div className="dash2">
              <MapCard spot={spot} />
              <Cams lat={spot.lat} lon={spot.lon} spotName={spot.name} />
            </div>

            {/* ── Details ── */}
            <div className="dash2">
              {(data.pointForecast || []).length > 0 && (
                <section className="card">
                  <h2>Local weather · {spot.name}</h2>
                  {data.pointForecast.map((p, i) => (
                    <div className="wxrow" key={i}>
                      <div className="wxicon"><WxIcon short={p.shortForecast} /></div>
                      <div className="wxmid">
                        <div className="wxname">{p.name}</div>
                        <div className="wxshort">{p.shortForecast}</div>
                        <div className="wxmeta">Wind {p.wind || "—"}{p.precipPct ? ` · ${p.precipPct}% rain` : ""}</div>
                      </div>
                      <div className="wxtemp">{fmt(p.tempF, "°")}</div>
                    </div>
                  ))}
                </section>
              )}
              {(data.marineForecast || []).length > 0 && (
                <section className="card">
                  <h2>Nearshore marine forecast · {spot.zone}</h2>
                  {data.marineForecast.map((p, i) => (
                    <div className="wxrow" key={i}>
                      <div className="wxicon"><WxIcon short={p.forecast} /></div>
                      <div className="wxmid">
                        <div className="wxname">{p.name}</div>
                        <div className="wxshort marine">{p.forecast}</div>
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </div>

            {data.noaaReport?.text && (
              <details className="card">
                <summary>📋 Full NWS nearshore report (NSH · {data.noaaReport.office})</summary>
                <pre className="nsh">{data.noaaReport.text}</pre>
              </details>
            )}

            <GearBlock waterTempF={buoy ? buoy.waterTempF : null} />
            <AdSlot />

            <footer className="meta">
              Source: {buoy ? `Buoy ${buoy.station} · ${buoy.ageMinutes != null ? `${buoy.ageMinutes} min ago` : "latest"}` : "forecast only"}
              {" · NWS & NDBC (NOAA), Windy. Updated "}{new Date(data.updatedAt).toLocaleTimeString()}
              <button onClick={() => loadSpot(active)}>↻ Refresh</button>
              <div className="footlinks"><a href="/privacy.html" target="_blank" rel="noopener">Privacy</a></div>
            </footer>
          </>
        )}
      </main>
      <ConsentBanner />
    </>
  );
}
