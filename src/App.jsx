import React, { useEffect, useRef, useState } from "react";
import Cams from "./Cams.jsx";
import WxIcon from "./WxIcon.jsx";
import { useAdsense, useAnalytics, getConsent, AdSlot, GearBlock, ConsentBanner } from "./monetize.jsx";
import { useAuth, Account, AuthModal } from "./auth.jsx";
import Takeover from "./Takeover.jsx";
import Landing from "./Landing.jsx";

const fmt = (v, unit) => (v == null ? "—" : `${v}${unit || ""}`);
const verdictClass = (lvl) => (lvl === "NO-GO" ? "nogo" : lvl === "CAUTION" ? "caution" : "go");
// GA4 event, if analytics is loaded (mirrors the gtag() arguments pattern).
function track() { try { if (window.dataLayer) window.dataLayer.push(arguments); } catch (e) { /* ignore */ } }
const fmtHour = (t, withMin) =>
  new Date(t).toLocaleTimeString([], withMin ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });

// Compare live conditions against a signed-in boater's comfort limits.
function comfortCheck(prefs, windKt, waveFt) {
  if (!prefs) return null;
  const maxW = prefs.maxWaveFt, maxK = prefs.maxWindKt;
  if (maxW == null && maxK == null) return null;
  const over = [];
  if (maxW != null && waveFt != null && waveFt > maxW) over.push(`waves ${waveFt} ft over your ${maxW} ft`);
  if (maxK != null && windKt != null && windKt > maxK) over.push(`wind ${windKt} kt over your ${maxK} kt`);
  const limits = [maxW != null ? `≤${maxW} ft` : null, maxK != null ? `≤${maxK} kt` : null].filter(Boolean).join(" · ");
  return { ok: over.length === 0, over, limits };
}

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

// Split a nearshore-forecast period into Wind / Waves / Weather facts. NSH
// periods read like: "NW winds 10 to 15 kt. Waves 2 to 4 ft. A chance of
// showers." Sentence-splitting keeps each fact clean instead of one blob.
function parseMarine(text) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return { wind: null, waves: null, weather: null };
  const sentences = t.split(/\.(?:\s+|$)/).map((s) => s.trim()).filter(Boolean);
  let wind = null, waves = null;
  const weather = [];
  for (const s of sentences) {
    const isWave = /\b(waves?|seas)\b/i.test(s);
    const isWind = /\b(winds?|gust|variable)\b/i.test(s);
    if (isWave && !waves) waves = s.replace(/^(combined\s+)?(seas|waves?)\s+/i, "").replace(/\s+/g, " ").trim();
    else if (isWind && !wind) wind = s.replace(/\s+/g, " ").trim();
    else weather.push(s);
  }
  return { wind, waves, weather: weather.join(". ") || null };
}

// Small inline icons for the wind / waves chips.
const WindGlyph = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 8h12a2.5 2.5 0 1 0-2.5-2.5M2 12h17a2.5 2.5 0 1 1-2.5 2.5M2 16h10a2.5 2.5 0 1 1-2.5 2.5" />
  </svg>
);
const WaveGlyph = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 7c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 13c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 19c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
  </svg>
);

function MarineForecast({ periods, zone }) {
  if (!periods || !periods.length) return null;
  return (
    <section className="card">
      <h2>Nearshore marine forecast{zone ? ` · ${zone}` : ""}</h2>
      <div className="mlist">
        {periods.map((p, i) => {
          const m = parseMarine(p.forecast);
          return (
            <div className="mrow" key={i}>
              <div className="mrow-head"><WxIcon short={p.forecast} size={24} /><span className="mrow-name">{p.name}</span></div>
              <div className="mchips">
                {m.wind && <span className="mchip wind"><WindGlyph /><span>{m.wind}</span></span>}
                {m.waves && <span className="mchip wave"><WaveGlyph /><span>{m.waves}</span></span>}
              </div>
              {m.weather && <div className="mweather">{m.weather}.</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Format the raw NSH product into readable blocks: each ".PERIOD...text"
// becomes a titled paragraph (wrapped continuation lines rejoined); the WMO
// header / zone codes / boilerplate are dimmed as metadata.
function formatNSH(text) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let cur = null;
  const push = () => { if (cur) { blocks.push(cur); cur = null; } };
  for (const ln of lines) {
    const t = ln.trimEnd();
    if (/^\.[A-Z]/.test(t)) {
      push();
      const idx = t.indexOf("...");
      cur = { type: "period", name: (idx >= 0 ? t.slice(1, idx) : t.slice(1)).trim(), body: (idx >= 0 ? t.slice(idx + 3) : "").trim() };
    } else if (cur) {
      if (!t.trim() || t.startsWith("$$")) push();
      else cur.body += " " + t.trim();
    } else if (t.trim() && !t.startsWith("$$")) {
      blocks.push({ type: "meta", text: t.trim() });
    }
  }
  push();
  return blocks;
}

function RawNSH({ text }) {
  const blocks = formatNSH(text);
  if (!blocks.length) return <pre className="nsh">{text}</pre>;
  return (
    <div className="nshfmt">
      {blocks.map((b, i) => b.type === "period"
        ? <p className="nsh-period" key={i}><b>{b.name}</b>{b.body ? ` — ${b.body}` : ""}</p>
        : <div className="nsh-meta" key={i}>{b.text}</div>)}
    </div>
  );
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

// Slick sun/moon theme toggle.
function ThemeToggle({ effective, onToggle }) {
  const dark = effective === "dark";
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title="Toggle theme">
      {dark ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5V4M12 20v1.5M2.5 12H4M20 12h1.5M5.1 5.1l1 1M17.9 17.9l1 1M18.9 5.1l-1 1M6.1 17.9l-1 1" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a7 7 0 1 0 11 11z" />
        </svg>
      )}
    </button>
  );
}

// Custom, searchable, lake-grouped location picker (replaces the bland select).
function LocationPicker({ byLake, active, activeName, onSelect, favorites = [], onToggleFav }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const favSet = new Set(favorites);
  const allSpots = Object.values(byLake).flat();
  const favSpots = favorites.map((id) => allSpots.find((s) => s.id === id)).filter(Boolean);
  const Row = (s) => (
    <div key={s.id} className={`locpick-item ${s.id === active ? "active" : ""}`}>
      <button className="locpick-pick" onClick={() => { onSelect(s.id); setOpen(false); setQ(""); }}>
        <span>{s.name}</span>{s.id === active && <span className="check">✓</span>}
      </button>
      {onToggleFav && (
        <button className={`favstar ${favSet.has(s.id) ? "on" : ""}`} title="Favorite"
          onClick={(e) => { e.stopPropagation(); onToggleFav(s.id); }}>★</button>
      )}
    </div>
  );
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const ql = q.trim().toLowerCase();
  return (
    <div className="locpick" ref={ref}>
      <button className="locpick-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <svg className="pin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" />
        </svg>
        <span className="locpick-cur">{activeName || "Choose a spot"}</span>
        <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="locpick-panel" role="listbox">
          <input className="locpick-search" placeholder="Search spots…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="locpick-list">
            {onToggleFav && favSpots.length > 0 && !ql && (
              <div className="locpick-group">
                <div className="locpick-lake">★ Favorites</div>
                {favSpots.map((s) => Row(s))}
              </div>
            )}
            {Object.entries(byLake).map(([lake, list]) => {
              const items = ql ? list.filter((s) => s.name.toLowerCase().includes(ql) || lake.toLowerCase().includes(ql)) : list;
              if (!items.length) return null;
              return (
                <div className="locpick-group" key={lake}>
                  <div className="locpick-lake">{lake}</div>
                  {items.map((s) => Row(s))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
                <div className="hm"><b>{h.windKt ?? "—"}</b><small>kt{h.windDir ? ` ${h.windDir}` : ""}</small></div>
                <div className="hm wave"><b>{h.waveFt ?? "—"}</b><small>ft{h.periodSec ? ` · ${h.periodSec}s` : ""}</small></div>
                <div className="hp">{h.precipPct ? `${h.precipPct}%` : "·"}</div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="hint">Wind (kt + direction) · wave height (ft) &amp; period (s) · rain chance, per hour. Red-ringed hour = be back in by then. Scroll for up to 3 days.</div>
    </section>
  );
}

function MapCard({ spot }) {
  const [layer, setLayer] = useState("waves");
  const layers = [["waves", "Waves"], ["wind", "Wind"], ["gust", "Gusts"], ["radar", "Radar"], ["temp", "Temp"]];
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

// Conversion gate: signed-out visitors get the verdict + current conditions
// free; the full toolkit (hour-by-hour, cams, maps, forecasts) needs a free
// account. The skeleton behind the card is decorative — gated data is simply
// not rendered, so nothing leaks into the DOM.
function SignupGate({ spotName, onSignup, onSignin }) {
  useEffect(() => { track("event", "signup_gate_view", { spot: spotName }); }, [spotName]);
  return (
    <section className="gate">
      <div className="gate-preview" aria-hidden="true">
        <div className="gate-sk-row">
          {Array.from({ length: 9 }, (_, i) => (
            <div className="gate-sk-hour" key={i}>
              <span className="gate-sk-bar" style={{ height: `${22 + ((i * 13) % 34)}px` }} />
            </div>
          ))}
        </div>
        <div className="gate-sk-wide" />
        <div className="gate-sk-grid"><div className="gate-sk-card" /><div className="gate-sk-card" /></div>
      </div>
      <div className="gate-card">
        <h2>See the full picture{spotName ? ` for ${spotName}` : ""} — free</h2>
        <ul className="gate-list">
          <li>⏱️ <b>Hour-by-hour</b> wind, waves &amp; rain — up to 3 days out</li>
          <li>🕐 <b>“Be back in by”</b> — the hour the weather turns</li>
          <li>📷 <b>Live harbor cams</b> + wave / wind / radar maps</li>
          <li>📋 The <b>full NWS nearshore forecast</b> for your zone</li>
          <li>⛵ Comfort limits tuned to <b>your boat</b> + favorite ports</li>
        </ul>
        <div className="gate-actions">
          <button className="cbtn gate-cta" onClick={() => { track("event", "signup_gate_click", { spot: spotName, action: "register" }); onSignup(); }}>Create free account</button>
          <button className="cbtn ghost" onClick={() => { track("event", "signup_gate_click", { spot: spotName, action: "login" }); onSignin(); }}>Sign in</button>
        </div>
        <p className="gate-note">Free forever · no card required · unsubscribe anytime</p>
      </div>
    </section>
  );
}

export default function App() {
  const { choice, setChoice, effective } = useTheme();
  const auth = useAuth();
  const [consent, setConsent] = useState(getConsent());
  const chooseConsent = (c) => { try { if (c) localStorage.setItem("sib.consent", c); else localStorage.removeItem("sib.consent"); } catch (e) {} setConsent(c); };
  const adFree = !!(auth.user && auth.user.adFree);
  useAdsense(consent === "all" && !adFree);
  useAnalytics(consent === "all");

  const toggleFav = (id) => {
    if (!auth.user) return;
    const f = auth.user.favorites || [];
    auth.saveFavorites(f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
  };
  // Sync prefs: apply the account's saved spot/theme once on sign-in; save on change.
  const appliedRef = useRef(false);
  const authRef = useRef(auth); authRef.current = auth;
  useEffect(() => {
    if (auth.user && !appliedRef.current) {
      appliedRef.current = true;
      const p = auth.user.prefs || {};
      if (p.spot) setActive(p.spot);
      if (p.theme) setChoice(p.theme);
    } else if (!auth.user) {
      appliedRef.current = false;
    }
  }, [auth.user]);
  const [spots, setSpots] = useState([]);
  const urlSpot = () => new URLSearchParams(window.location.search).get("spot");
  const [active, setActive] = useState(() => urlSpot() || localStorage.getItem("boating.spot") || "sandusky");
  const [landing, setLanding] = useState(() => !urlSpot()); // bare "/" = splash + directory; ?spot=X = detail
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") || ""); // password-reset email link
  const [verifyToken, setVerifyToken] = useState(() => new URLSearchParams(window.location.search).get("verify") || ""); // email-confirmation link
  const [gateAuth, setGateAuth] = useState(null); // signup-gate modal: "register" | "login" | null
  // Gate the deep detail for signed-out visitors (only when accounts are live).
  // auth.user === undefined means still checking — render neither, no flash.
  const gated = auth.available && auth.user === null;
  const authPending = auth.available && auth.user === undefined;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pick a location → navigate to its detail view (?spot=X), without a reload.
  const selectLocation = (id) => {
    const u = new URL(window.location.href);
    u.searchParams.set("spot", id);
    window.history.pushState({}, "", u);
    setActive(id);
    setLanding(false);
    window.scrollTo(0, 0);
  };
  const goLanding = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete("spot");
    window.history.pushState({}, "", u);
    setLanding(true);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPop = () => { const sp = urlSpot(); setLanding(!sp); if (sp) setActive(sp); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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

  useEffect(() => { if (!landing) loadSpot(active); localStorage.setItem("boating.spot", active); }, [active, landing]);
  // Save spot/theme to the account (debounced) once the signed-in prefs are applied.
  useEffect(() => {
    if (!appliedRef.current || !authRef.current.user) return;
    const t = setTimeout(() => authRef.current.savePrefs({ spot: active, theme: choice }), 800);
    return () => clearTimeout(t);
  }, [active, choice]);

  const spot = data?.spot;
  const rec = data?.recommendation;
  const wind = data?.wind || {};
  const wv = data?.waves || {};
  const buoy = data?.buoy;
  const wr = data?.windRead;
  const comfort = data ? comfortCheck(auth.user?.prefs, wind.speedKt, wv.ft) : null;

  // Location options grouped by lake (scales to all five lakes).
  const spotOptions = spots.length ? spots : (spot ? [{ ...spot, lake: "Lake Erie" }] : [{ id: active, name: "Loading…", lake: "Lake Erie" }]);
  const byLake = {};
  spotOptions.forEach((s) => { (byLake[s.lake || "Lake Erie"] ||= []).push(s); });
  const activeName = (spots.find((s) => s.id === active) || data?.spot || {}).name;

  return (
    <>
      <header className="appheader">
        <div className="appheader-inner">
          <a className="brand" href="/" aria-label="Should I Boat — home" onClick={(e) => { e.preventDefault(); goLanding(); }}>
            <img className="logo" src={effective === "dark" ? "/boat-mark-white.png" : "/boat-mark.png"} alt="" />
            <span className="wordmark">
              <span className="wm-name">SHOULDI<b>BOAT</b><span className="wm-dot">.com</span></span>
              <span className="wm-tag">Live Great Lakes boating conditions</span>
            </span>
          </a>
          <div className="controls">
            <LocationPicker byLake={byLake} active={active} activeName={activeName} onSelect={selectLocation}
              favorites={auth.user ? (auth.user.favorites || []) : []} onToggleFav={auth.user ? toggleFav : undefined} />
            <ThemeToggle effective={effective} onToggle={() => setChoice(effective === "dark" ? "light" : "dark")} />
            <Account auth={auth} />
          </div>
        </div>
      </header>

      {landing ? (
        <Landing adFree={adFree} onSelect={selectLocation} favorites={auth.user ? (auth.user.favorites || []) : []}
          onCookieSettings={() => chooseConsent(null)}
          onJoin={gated ? () => { track("event", "signup_gate_click", { spot: "landing", action: "register" }); setGateAuth("register"); } : null} />
      ) : (
      <>
      {/* FlightAware-style hero: sponsor takeover when sold, else house hero. */}
      <Takeover adFree={adFree} spotName={activeName} verdict={rec?.level} />

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
                {comfort && (
                  <div className={`comfort ${comfort.ok ? "ok" : "over"}`}>
                    <b>Your comfort ({comfort.limits}):</b>{" "}
                    {comfort.ok ? "today's conditions are within your limits." : `above your limit — ${comfort.over.join("; ")}.`}
                  </div>
                )}
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

            {/* ── Full detail: free accounts only. The verdict + current
                   conditions above stay public (that's what social posts
                   link to); everything deeper drives the signup. ── */}
            {gated && (
              <SignupGate spotName={spot.name} onSignup={() => setGateAuth("register")} onSignin={() => setGateAuth("login")} />
            )}
            {!gated && !authPending && (
              <>
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
                  <Cams lat={spot.lat} lon={spot.lon} spotName={spot.name} lake={spot.lake} />
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
                  <MarineForecast periods={data.marineForecast} zone={spot.zone} />
                </div>

                {data.noaaReport?.text && (
                  <details className="card">
                    <summary>📋 Full NWS nearshore report (NSH · {data.noaaReport.office})</summary>
                    <RawNSH text={data.noaaReport.text} />
                  </details>
                )}
              </>
            )}

            <GearBlock waterTempF={buoy ? buoy.waterTempF : null} />
            {!adFree && consent === "all" && <AdSlot />}

            <footer className="meta">
              Source: {buoy ? `Buoy ${buoy.station} · ${buoy.ageMinutes != null ? `${buoy.ageMinutes} min ago` : "latest"}` : "forecast only"}
              {" · NWS & NDBC (NOAA), Windy. Updated "}{new Date(data.updatedAt).toLocaleTimeString()}
              <button onClick={() => loadSpot(active)}>↻ Refresh</button>
              <div className="footlinks">
                <a href="/about" target="_blank" rel="noopener">About</a>
                <a href="/legal#terms" target="_blank" rel="noopener">Terms</a>
                <a href="/legal#privacy" target="_blank" rel="noopener">Privacy</a>
                <button className="linklike" onClick={() => chooseConsent(null)}>Cookie settings</button>
              </div>
            </footer>
          </>
        )}
      </main>
      </>
      )}
      <ConsentBanner consent={consent} onChoose={chooseConsent} />
      {resetToken && <AuthModal auth={auth} initialMode="reset" resetToken={resetToken} onClose={() => setResetToken("")} />}
      {!resetToken && verifyToken && <AuthModal auth={auth} initialMode="verify" verifyToken={verifyToken} onClose={() => setVerifyToken("")} />}
      {!resetToken && !verifyToken && gateAuth && <AuthModal auth={auth} initialMode={gateAuth} onClose={() => setGateAuth(null)} />}
    </>
  );
}
