import React, { useEffect, useRef, useState } from "react";
import Cams from "./Cams.jsx";
import WxIcon from "./WxIcon.jsx";
import { IconStar, IconCheck, IconClock, IconNoGo, IconAlert, IconSunrise, IconSunset, IconDoc, IconRefresh } from "./icons.jsx";
import { useAdsense, useAnalytics, getConsent, updateConsentMode, AdSlot, GearBlock, ConsentBanner, StickyFooterAd, track } from "./monetize.jsx";
import { useAuth, Account, AuthModal } from "./auth.jsx";
import Takeover from "./Takeover.jsx";
import Landing from "./Landing.jsx";
import { fmtWaves, waveFeel, compassToDeg } from "./units.js";

const fmt = (v, unit) => (v == null ? "—" : `${v}${unit || ""}`);
const verdictClass = (lvl) => (lvl === "NO-GO" ? "nogo" : lvl === "CAUTION" ? "caution" : "go");
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

// One NWS nearshore period as icon + wind/wave chips + weather sentence.
// Shared by the full forecast card and the week-ahead day panel.
function MarinePeriodRow({ p }) {
  const m = parseMarine(p.forecast);
  return (
    <div className="mrow">
      <div className="mrow-head"><WxIcon short={p.forecast} size={24} /><span className="mrow-name">{p.name}</span></div>
      <div className="mchips">
        {m.wind && <span className="mchip wind"><WindGlyph /><span>{m.wind}</span></span>}
        {m.waves && <span className="mchip wave"><WaveGlyph /><span>{m.waves}</span></span>}
      </div>
      {m.weather && <div className="mweather">{m.weather}.</div>}
    </div>
  );
}

function MarineForecast({ periods, zone }) {
  if (!periods || !periods.length) return null;
  return (
    <section className="card">
      <h2>Nearshore marine forecast{zone ? ` · ${zone}` : ""}</h2>
      <div className="mlist">
        {periods.map((p, i) => <MarinePeriodRow p={p} key={i} />)}
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
        ? <p className="nsh-period" key={i}><b>{b.name}</b>{b.body ? `: ${b.body}` : ""}</p>
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
        <span>{s.name}</span>{s.id === active && <span className="check"><IconCheck /></span>}
      </button>
      {onToggleFav && (
        <button className={`favstar ${favSet.has(s.id) ? "on" : ""}`} title="Favorite"
          onClick={(e) => { e.stopPropagation(); onToggleFav(s.id); }}><IconStar filled={favSet.has(s.id)} /></button>
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
                <div className="locpick-lake"><IconStar filled /> Favorites</div>
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

// "Today at a glance" — the next 18 hours as one color band, with the best
// contiguous GO window called out. The answer to "when do I go?" in one look.
function GlanceBand({ hours }) {
  if (!hours || hours.length < 6) return null;
  const win = hours.slice(0, 18);
  const runs = [];
  let start = 0;
  for (let i = 1; i <= win.length; i++) {
    if (i === win.length || win[i].level !== win[start].level) { runs.push({ level: win[start].level, from: start, to: i - 1 }); start = i; }
  }
  const best = runs.filter((r) => r.level === "GO").sort((a, b) => (b.to - b.from) - (a.to - a.from))[0] || null;
  const label = best
    ? <>Best window: <b>{best.from === 0 ? "now" : fmtHour(win[best.from].time)} – {fmtHour(win[Math.min(best.to + 1, win.length - 1)].time)}</b> ({best.to - best.from + 1}h)</>
    : <>No clean GO window in the next 18h. Check the week ahead</>;
  // Tap an hour → jump the hour-by-hour strip to it (and pulse the tile).
  const jumpTo = (time) => {
    const tile = document.querySelector(`[data-t="${time}"]`);
    if (!tile) return;
    tile.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    tile.classList.add("pulse");
    setTimeout(() => tile.classList.remove("pulse"), 1600);
  };
  return (
    <section className="card glance">
      <div className="card-head"><h2>Today at a glance</h2><span className="glance-label">{label}</span></div>
      <div className="glance-band">
        {win.map((h, i) => (
          <button key={h.time} onClick={() => jumpTo(h.time)}
            className={`gb ${verdictClass(h.level)} ${best && i >= best.from && i <= best.to ? "best" : ""}`}
            title={`${fmtHour(h.time)} · ${h.level}, see the detail`}
            aria-label={`${fmtHour(h.time)}: ${h.level}. Jump to hour detail.`} />
        ))}
      </div>
      <div className="glance-x">
        <span>{fmtHour(win[0].time)}</span>
        <span>{fmtHour(win[Math.floor(win.length / 2)].time)}</span>
        <span>{fmtHour(win[win.length - 1].time)}</span>
      </div>
      <div className="hint">Tap an hour to jump to its detail below.</div>
    </section>
  );
}

// Rising / steady / easing over the next ~3 hours, from the hourly forecast.
function trendOf(nowV, laterV) {
  if (nowV == null || laterV == null) return null;
  const d = laterV - nowV;
  if (Math.abs(d) < Math.max(1, Math.abs(nowV) * 0.15)) return null; // steady → say nothing
  return d > 0 ? { glyph: "↗", cls: "up", word: "building" } : { glyph: "↘", cls: "down", word: "easing" };
}
const Trend = ({ t }) => (t ? <span className={`trend ${t.cls}`}>{t.glyph} {t.word}</span> : null);

// Same-lake pivot: every other port on this lake with its live verdict.
// "This launch is rough — where's it calmer?" answered without leaving the page.
function NearbyPorts({ lake, current, onSelect }) {
  const [sum, setSum] = useState(null);
  useEffect(() => {
    let ok = true;
    fetch("/marine/conditions?summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (ok) setSum((d && d.spots) || []); })
      .catch(() => { if (ok) setSum([]); });
    return () => { ok = false; };
  }, []);
  const order = { GO: 0, CAUTION: 1, "NO-GO": 2 };
  const near = (sum || [])
    .filter((s) => (s.lake || "Lake Erie") === lake && s.id !== current)
    .sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
  if (!near.length) return null;
  return (
    <section className="card nearby">
      <div className="card-head"><h2>Nearby on {lake}</h2><span className="legend">calmer launch? tap to switch</span></div>
      <div className="nearby-row">
        {near.map((s) => (
          <button key={s.id} className="nearby-chip" onClick={() => onSelect(s.id)}>
            <span className={`ndot ${verdictClass(s.level)}`} />
            <span className="nname">{s.name}</span>
            <small>{s.windKt != null ? `${s.windKt}kt` : "—"}{s.waveFt != null ? ` · ${s.waveFt}ft${s.periodSec ? `@${s.periodSec}s` : ""}` : ""}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

// Share today's verdict — native share sheet on mobile, clipboard elsewhere.
function ShareButton({ spot, rec, wind, wv }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    track("event", "share_verdict", { spot: spot.id, level: rec.level });
    const text = `${spot.name}: ${rec.level} right now. Wind ${wind.speedKt ?? "–"} kt, waves ${wv.ft ?? "–"} ft.`;
    const url = `https://shouldiboat.com/spot/${encodeURIComponent(spot.id)}`;
    if (navigator.share) { try { await navigator.share({ title: "shouldiboat.com", text, url }); } catch (e) { /* dismissed */ } return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { /* ignore */ }
  };
  return (
    <button className="share-btn" onClick={share} title="Share today's verdict">
      {copied ? <><IconCheck /> Copied</> : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

// Which NWS nearshore periods belong to a given date. Period names read like
// "TODAY", "TONIGHT", "THURSDAY", "THURSDAY NIGHT" — the zone forecast only
// reaches ~2–3 days, so weekday names can't collide with next week.
function periodsForDate(periods, dateISO, isToday) {
  const wd = new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  return (periods || []).filter((p) => {
    const n = (p.name || "").toUpperCase();
    if (n.startsWith(wd)) return true;
    if (isToday) return /^(TODAY|THIS\b|TONIGHT|OVERNIGHT|REST OF)/.test(n);
    return false;
  });
}

// 7-day planning strip — per-day verdict, weekend highlighted. Tap a day to
// read that day's official nearshore forecast. "Pick Saturday on Wednesday."
function WeekStrip({ week, marineForecast }) {
  const [sel, setSel] = useState(null);
  if (!week || week.length < 2) return null;
  const fmtDay = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return { wd: d.toLocaleDateString([], { weekday: "short" }), md: d.toLocaleDateString([], { month: "numeric", day: "numeric" }), long: d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }), weekend: d.getDay() === 0 || d.getDay() === 6 };
  };
  const selDay = sel != null ? week[sel] : null;
  const selPeriods = selDay ? periodsForDate(marineForecast, selDay.date, sel === 0) : [];
  return (
    <section className="card">
      <div className="card-head">
        <h2>Week ahead</h2>
        <span className="legend">tap a day for its nearshore forecast</span>
      </div>
      <div className="week">
        {week.map((d, i) => {
          const f = fmtDay(d.date);
          return (
            <button key={d.date} onClick={() => setSel(sel === i ? null : i)} aria-expanded={sel === i}
              className={`wday ${verdictClass(d.level)} ${f.weekend ? "weekend" : ""} ${sel === i ? "sel" : ""}`} title={`${f.wd} ${f.md}, tap for the day's forecast`}>
              <div className="wd-name">{i === 0 ? "Today" : f.wd}{f.weekend && <span className="wd-star">•</span>}</div>
              <div className={`wd-level ${verdictClass(d.level)}`}>{d.level === "NO-GO" ? "NO" : d.level}</div>
              <div className="wd-m"><b>{d.windKt ?? "—"}</b><small>kt</small></div>
              <div className="wd-m wave"><b>{d.waveFt ?? "—"}</b><small>ft{d.periodSec ? ` @${d.periodSec}s` : ""}</small></div>
              <div className="wd-p">
                {d.precipPct != null && d.precipPct >= 30
                  ? `${d.precipPct}% rain`
                  : (d.gustKt != null && d.windKt != null && d.gustKt - d.windKt >= 5 ? `gusts ${d.gustKt}` : "")}
              </div>
            </button>
          );
        })}
      </div>
      {selDay && (
        <div className="wpanel">
          <div className="wpanel-head">
            <b>{fmtDay(selDay.date).long}</b>
            <span className="wpanel-stats">
              wind to <b>{selDay.windKt ?? "—"} kt</b>{selDay.gustKt && selDay.gustKt - (selDay.windKt || 0) >= 3 ? ` (gusts ${selDay.gustKt})` : ""} · waves to <b>{fmtWaves(selDay.waveFt, selDay.periodSec)}</b>{selDay.precipPct != null && selDay.precipPct >= 20 ? ` · ${selDay.precipPct}% rain` : ""}
            </span>
            <button className="linklike wpanel-close" onClick={() => setSel(null)}>close ×</button>
          </div>
          {selPeriods.length > 0 ? (
            <div className="mlist">{selPeriods.map((p, i) => <MarinePeriodRow p={p} key={i} />)}</div>
          ) : (
            <p className="acct-note wpanel-note">The official NWS nearshore text only reaches about 2 to 3 days out, so there's no written forecast for this day yet. The numbers above are the model outlook. Check back as it gets closer.</p>
          )}
        </div>
      )}
      <div className="hint">Daily max wind &amp; waves (height @ seconds between waves). Dot = weekend. Confidence drops past ~3 days.</div>
    </section>
  );
}

// One-time nudge for signed-in boaters who haven't chosen email delivery yet.
function EmailNudge({ auth }) {
  const [gone, setGone] = useState(false);
  const u = auth.user;
  if (gone || !u || !(u.favorites || []).length) return null;
  if (u.prefs?.dailyEmail !== undefined || u.emailOptOut) return null;
  const choose = (on) => { auth.savePrefs({ dailyEmail: on, alertEmails: on }); setGone(true); };
  return (
    <div className="joinstrip email-nudge">
      <span><b>Want your ports' verdict with your coffee?</b> A daily 6am email + a heads-up when a starred port turns NO-GO.</span>
      <span className="nudge-btns">
        <button className="cbtn" onClick={() => choose(true)}>Yes, email me</button>
        <button className="cbtn ghost" onClick={() => choose(false)}>No thanks</button>
      </span>
    </div>
  );
}

// The gold "yellow time" — when to head back in.
function OutlookPill({ outlook }) {
  if (!outlook) return null;
  if (outlook.goodHours === 0) return <span className="opill bad"><IconNoGo /> not right now</span>;
  if (outlook.headInBy)
    return <span className="opill warn"><IconClock /> be in by <b>{fmtHour(outlook.headInBy, true)}</b> · {outlook.headInReason || "weather turns"}</span>;
  return <span className="opill good"><IconClock /> good for {outlook.goodHours}h+</span>;
}

// Today's daylight window — boaters plan around first light and dusk.
function SunTimes({ sun }) {
  if (!sun || !sun.sunrise) return null;
  const f = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
  return <span className="suntimes" title="Sunrise · sunset today"><IconSunrise /> {f(sun.sunrise)} → <IconSunset /> {f(sun.sunset)}</span>;
}

// Windy-style hourly table: labeled metric rows × hour columns, color-coded
// cells, wind-direction arrows, day bands — with our verdict strip on top.
const windTint = (kt) => (kt == null ? "" : kt >= 22 ? "bad" : kt >= 15 ? "warn" : kt >= 12 ? "mild" : "ok");
const waveTint = (ft) => (ft == null ? "" : ft >= 4 ? "bad" : ft >= 2.5 ? "warn" : ft >= 2 ? "mild" : "ok");
const rainTint = (p) => (p == null || p < 30 ? "" : p >= 55 ? "wet" : "damp");

// Temperature heat-strip: a diverging tint around a ~60°F comfortable midpoint —
// cool blue below, warm orange above, near-neutral in between. Deliberately blue/
// orange (not the green/amber/red risk hues) so it reads as "temperature," not a
// verdict, and never passes through green (no rainbow). Semi-transparent so it
// works over either theme's surface.
function tempTint(f) {
  if (f == null) return undefined;
  const d = Math.max(-35, Math.min(35, f - 60)) / 35; // -1 cold … +1 hot
  const hue = d < 0 ? 208 : 24;
  const sat = Math.round(Math.abs(d) * 58 + 6);
  const alpha = (Math.abs(d) * 0.2 + 0.03).toFixed(3);
  return `hsl(${hue} ${sat}% 52% / ${alpha})`;
}

// Group consecutive equal-height hours into Windy-style bands: the wave row then
// reads as continuous blocks with one centered number each, instead of the same
// digit repeated across a calm stretch. Runs break at day boundaries so a band
// never crosses midnight. Returns per-hour { start, end, mid }.
function waveBands(hours, dayStarts) {
  const key = (h) => (h.waveFt == null ? "∅" : h.waveFt < 1 ? "<1" : String(h.waveFt));
  const meta = new Array(hours.length);
  let i = 0;
  while (i < hours.length) {
    const k = key(hours[i]);
    let j = i;
    while (j + 1 < hours.length && key(hours[j + 1]) === k && !dayStarts.has(hours[j + 1].time)) j++;
    const mid = Math.floor((i + j) / 2);
    for (let x = i; x <= j; x++) meta[x] = { start: x === i, end: x === j, mid: x === mid };
    i = j + 1;
  }
  return meta;
}

function WindArrow({ dir }) {
  const deg = compassToDeg(dir);
  if (deg == null) return null;
  // "↓" points where a north wind blows (south); rotate by the FROM bearing.
  return (
    <svg className="hx-arrow" width="11" height="11" viewBox="0 0 24 24" style={{ transform: `rotate(${deg}deg)` }}
      fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M6 15l6 6 6-6" />
    </svg>
  );
}

function HourStrip({ hours, headInBy }) {
  if (!hours || !hours.length) return null;
  const days = groupByDay(hours);
  const dayStarts = new Set(days.map((d) => d.hours[0].time));
  const waveBand = waveBands(hours, dayStarts);
  const cls = (h, extra = "") => `hx-c ${dayStarts.has(h.time) ? "hx-ds" : ""} ${extra}`;
  const cols = { gridTemplateColumns: `minmax(96px, auto) repeat(${hours.length}, minmax(52px, 1fr))` };
  const Label = ({ children, unit }) => <div className="hx-l">{children}{unit && <small> {unit}</small>}</div>;
  return (
    <section className="card hourcard">
      <div className="card-head">
        <h2>Hour-by-hour · next {hours.length} hours</h2>
        <span className="legend"><i className="lg go" />go <i className="lg caution" />caution <i className="lg nogo" />stay in</span>
      </div>
      <div className="hx-scroll">
        <div className="hx" style={cols}>
          {/* day bands */}
          <div className="hx-l hx-dayl" />
          {days.map((d) => (
            <div className="hx-day" key={d.key} style={{ gridColumn: `span ${d.hours.length}` }}>
              {d.label} <small>{new Date(d.hours[0].time).toLocaleDateString([], { month: "short", day: "numeric" })}</small>
            </div>
          ))}
          {/* hours */}
          <Label>&nbsp;</Label>
          {hours.map((h) => (
            <div key={h.time} data-t={h.time} className={cls(h, `hx-hour ${headInBy === h.time ? "cutoff" : ""}`)}>
              {fmtHour(h.time).replace(" ", "").toLowerCase()}
            </div>
          ))}
          {/* sky */}
          <Label>&nbsp;</Label>
          {hours.map((h) => <div key={h.time} className={cls(h, "hx-ico")} title={h.short}><WxIcon short={h.short} size={18} /></div>)}
          {/* verdict strip */}
          <Label>Verdict</Label>
          {hours.map((h) => <div key={h.time} className={cls(h, "hx-vwrap")} title={`${fmtHour(h.time)} · ${h.level}`}><i className={`hx-v ${verdictClass(h.level)}`} /></div>)}
          {/* temp — diverging heat-strip behind the numbers */}
          <Label unit="°F">Temp</Label>
          {hours.map((h) => <div key={h.time} className={cls(h)} style={{ background: tempTint(h.tempF) }}>{h.tempF ?? "—"}</div>)}
          {/* wind */}
          <Label unit="kt">Wind</Label>
          {hours.map((h) => (
            <div key={h.time} className={cls(h, `hx-tint-${windTint(h.windKt)}`)} title={h.windDir ? `out of the ${h.windDir}` : undefined}>
              <WindArrow dir={h.windDir} /><b>{h.windKt ?? "—"}</b>
            </div>
          ))}
          {/* gusts (from the NWS grid; the strongest hour is what bites) */}
          <Label unit="kt">Gusts</Label>
          {hours.map((h) => (
            <div key={h.time} className={cls(h, h.gustKt != null && h.windKt != null && h.gustKt - h.windKt >= 5 ? `hx-tint-${windTint(h.gustKt)}` : "hx-dim")}>
              {h.gustKt ?? "—"}
            </div>
          ))}
          {/* waves — Windy-style bands: one centered number per equal-height run.
              "<1" reads as the calm it is, not as missing data. */}
          <Label unit="ft">Waves</Label>
          {hours.map((h, idx) => {
            const b = waveBand[idx];
            return (
              <div key={h.time} className={cls(h, `hx-tint-${waveTint(h.waveFt)} hx-wb ${b.start ? "wb-s" : ""} ${b.end ? "wb-e" : ""}`)}
                title={`${fmtHour(h.time)} · ${h.waveFt == null ? "no data" : `${h.waveFt} ft`}`}>
                {b.mid ? <b>{h.waveFt == null ? "—" : h.waveFt < 1 ? "<1" : h.waveFt}</b> : null}
              </div>
            );
          })}
          {/* period — meaningless on flat water, so quiet it to a dot */}
          <Label unit="s">Between waves</Label>
          {hours.map((h) => (
            <div key={h.time} className={cls(h, "hx-dim")}>
              {h.periodSec == null || (h.waveFt != null && h.waveFt < 1) ? "·" : h.periodSec}
            </div>
          ))}
          {/* rain */}
          <Label unit="%">Rain</Label>
          {hours.map((h) => <div key={h.time} className={cls(h, `hx-rain-${rainTint(h.precipPct)}`)}>{h.precipPct ? h.precipPct : "·"}</div>)}
        </div>
      </div>
      <div className="hint">Arrows show where the wind is blowing to. Red-ringed hour = be back in by then. Scroll for up to 3 days.</div>
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
const GateIcon = ({ children }) => (
  <svg className="gate-ico" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IcoClock = () => <GateIcon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></GateIcon>;
const IcoBack = () => <GateIcon><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /><path d="M12 8v4l2.5 1.5" /></GateIcon>;
const IcoCam = () => <GateIcon><rect x="3" y="7" width="13" height="11" rx="2" /><path d="M16 11l5-3v9l-5-3" /></GateIcon>;
const IcoDoc = () => <GateIcon><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></GateIcon>;
const IcoBoat = () => <GateIcon><path d="M4 17h16l-2 4H6l-2-4z" /><path d="M12 3v14M12 4l7 9H12" /></GateIcon>;
const IcoCal = () => <GateIcon><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /><path d="M15 15l2 2 3-4" /></GateIcon>;

// Soft, non-blocking signup nudge. The whole toolkit is now free for everyone
// (more traffic, ad impressions & SEO); a free account only adds saved ports +
// alert/digest emails, so this invites rather than walls.
function SignupNudge({ spotName, onSignup, onSignin }) {
  useEffect(() => { track("event", "signup_gate_view", { spot: spotName }); }, [spotName]);
  return (
    <section className="card signup-nudge">
      <div className="nudge-main">
        <IcoBoat />
        <div className="nudge-copy">
          <b>Boating {spotName || "these waters"} often?</b>
          <span> Create a free account to ⭐ save your launch spots and get a morning verdict + NO-GO alerts by email.</span>
        </div>
      </div>
      <div className="nudge-actions">
        <button className="cbtn" onClick={() => { track("event", "signup_gate_click", { spot: spotName, action: "register" }); onSignup(); }}>Create free account</button>
        <button className="linklike" onClick={() => { track("event", "signup_gate_click", { spot: spotName, action: "login" }); onSignin(); }}>Sign in</button>
      </div>
    </section>
  );
}

export default function App() {
  const { choice, setChoice, effective } = useTheme();
  const auth = useAuth();
  const [consent, setConsent] = useState(getConsent());
  const chooseConsent = (c) => { try { if (c) localStorage.setItem("sib.consent", c); else localStorage.removeItem("sib.consent"); } catch (e) {} updateConsentMode(c); setConsent(c); };
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
  // Prefer the clean SEO path /spot/<id>; fall back to the legacy ?spot=<id>.
  const urlSpot = () => {
    const m = window.location.pathname.match(/^\/spot\/([a-z0-9-]{1,40})\/?$/);
    return (m && m[1]) || new URLSearchParams(window.location.search).get("spot");
  };
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

  // Pick a location → navigate to its clean detail URL (/spot/X), without a reload.
  const selectLocation = (id) => {
    window.history.pushState({}, "", `/spot/${id}`);
    setActive(id);
    setLanding(false);
    window.scrollTo(0, 0);
  };
  const goLanding = () => {
    window.history.pushState({}, "", "/");
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
      .then((d) => { setData(d); setLoading(false); track("event", "spot_view", { spot: id, level: d?.recommendation?.level }); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { if (!landing) loadSpot(active); localStorage.setItem("boating.spot", active); }, [active, landing]);
  // Per-view titles → share cards, tabs, and search results name the port.
  useEffect(() => {
    const name = (spots.find((s) => s.id === active) || {}).name;
    document.title = landing || !name
      ? "shouldiboat.com · Live Great Lakes boating conditions"
      : `${name} boating conditions · shouldiboat.com`;
  }, [landing, active, spots]);
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
          <a className="brand" href="/" aria-label="shouldiboat.com home" onClick={(e) => { e.preventDefault(); goLanding(); }}>
            <img className="logo" width="248" height="82" src={effective === "dark" ? "/boat-mark-white.png" : "/boat-mark.png"} alt="" />
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
        <Landing adFree={adFree} consent={consent} onSelect={selectLocation} favorites={auth.user ? (auth.user.favorites || []) : []}
          onCookieSettings={() => chooseConsent(null)}
          signedIn={!!auth.user}
          nudge={auth.user ? <EmailNudge auth={auth} /> : null}
          onJoin={gated ? () => { track("event", "signup_gate_click", { spot: "landing", action: "register" }); setGateAuth("register"); } : null}
          onSignIn={gated ? () => { track("event", "signup_gate_click", { spot: "landing", action: "login" }); setGateAuth("login"); } : null} />
      ) : (
      <>
      {/* FlightAware-style hero: sponsor takeover when sold, else house hero. */}
      <Takeover adFree={adFree} spotName={activeName} verdict={rec?.level} signedIn={!gated} onJoin={() => setGateAuth("register")} />

      <main className="app">
        {auth.user && <EmailNudge auth={auth} />}
        {loading && !data && <div className="loading">Loading live conditions…</div>}
        {error && <div className="err">Couldn't load conditions: {error}. <button onClick={() => loadSpot(active)}>Retry</button></div>}

        {data && (
          <>
            {/* ── The Call ── */}
            <section className={`call ${verdictClass(rec.level)}`}>
              <div className="call-badge"><span>{rec.level}</span></div>
              <div className="call-body">
                <div className="call-top">
                  <span className="call-spot">
                    {spot.name}
                    {auth.user && (
                      <button
                        className={`favstar call-fav ${(auth.user.favorites || []).includes(active) ? "on" : ""}`}
                        title={(auth.user.favorites || []).includes(active) ? "Remove from my ports" : "Add to my ports: front and center on the homepage + morning email"}
                        onClick={() => toggleFav(active)}><IconStar filled={(auth.user.favorites || []).includes(active)} /></button>
                    )}
                  </span>
                  <OutlookPill outlook={data.outlook} />
                  <SunTimes sun={data.sun} />
                  <ShareButton spot={spot} rec={rec} wind={wind} wv={wv} />
                </div>
                <div className="call-sum">{rec.summary}</div>
                <ul className="reasons">{rec.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
                {comfort && (
                  <div className={`comfort ${comfort.ok ? "ok" : "over"}`}>
                    <b>Your comfort ({comfort.limits}):</b>{" "}
                    {comfort.ok ? "today's conditions are within your limits." : `above your limit: ${comfort.over.join("; ")}.`}
                  </div>
                )}
              </div>
            </section>

            {(data.alerts || []).map((a, i) => (
              <div className="alert" key={i}>
                <div className="ev"><IconAlert /> {a.event || "Marine alert"}</div>
                <div className="hl">{a.headline || ""}</div>
              </div>
            ))}

            {/* ── Right now ── */}
            <div className="grid stats">
              <div className="stat hero">
                <div className="k">Wind</div>
                <div className="v">{fmt(wind.speedKt, "")}<small>kt</small> <Trend t={trendOf(data.hourly?.[0]?.windKt, data.hourly?.[3]?.windKt)} /></div>
                <div className="sub">{[wind.dir, wind.gustKt ? `gust ${wind.gustKt}` : null, wind.source].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <div className="stat">
                <div className="k">Waves</div>
                <div className="v">{fmt(wv.ft, "")}<small>ft</small> <Trend t={trendOf(data.hourly?.[0]?.waveFt, data.hourly?.[3]?.waveFt)} /></div>
                <div className="sub">
                  {(() => {
                    const sec = wv.periodSec ?? data.hourly?.[0]?.periodSec ?? null;
                    const feel = waveFeel(wv.ft, sec);
                    return (
                      <>
                        {sec ? `@ ${sec}s between waves` : (wv.source || "—")}
                        {feel && <> · <span className={`feel ${feel.cls}`}>{feel.word}</span></>}
                      </>
                    );
                  })()}
                </div>
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

            {/* Top ad — under the public verdict + conditions, so every visitor
                to a /spot page (incl. signed-out SEO traffic) sees one. */}
            {!adFree && consent === "all" && <AdSlot name="detailTop" />}

            {/* ── Full toolkit — free for everyone. A free account only adds
                   saved ports + alert emails, nudged softly below, not walled. ── */}
            {!authPending && (
              <>
                {/* ── When do I go? — one-look answer ── */}
                <GlanceBand hours={data.hourly} />

                {gated && (
                  <SignupNudge spotName={spot.name} onSignup={() => setGateAuth("register")} onSignin={() => setGateAuth("login")} />
                )}

                {wr && (
                  <section className={`card wr-${wr.tone} windread`}>
                    <div className="card-head"><h2>Wind read</h2><span className="wr-dir">out of the {wr.dir}</span></div>
                    <div className="advice">{wr.advice}</div>
                  </section>
                )}

                {/* ── Timeline ── */}
                <HourStrip hours={data.hourly} headInBy={data.outlook?.headInBy} />

                {/* ── Week ahead / weekend planning ── */}
                <WeekStrip week={data.week} marineForecast={data.marineForecast} />

                {/* ── Map + Cams ── */}
                <div className="dash2">
                  <MapCard spot={spot} />
                  <Cams lat={spot.lat} lon={spot.lon} spotName={spot.name} lake={spot.lake} />
                </div>

                {/* ── Same-lake pivot ── */}
                <NearbyPorts lake={spot.lake || "Lake Erie"} current={active} onSelect={selectLocation} />

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
                    <summary><IconDoc /> Full NWS nearshore report (NSH · {data.noaaReport.office})</summary>
                    <RawNSH text={data.noaaReport.text} />
                  </details>
                )}
              </>
            )}

            <GearBlock waterTempF={buoy ? buoy.waterTempF : null} airTempF={buoy ? buoy.airTempF : null} windKt={wind ? wind.speedKt : null} level={rec ? rec.level : null} />
            {!adFree && consent === "all" && <AdSlot name="detailMid" />}

            <footer className="meta">
              Source: {buoy ? `Buoy ${buoy.station} · ${buoy.ageMinutes != null ? `${buoy.ageMinutes} min ago` : "latest"}` : "forecast only"}
              {" · NWS & NDBC (NOAA), Windy. Updated "}{new Date(data.updatedAt).toLocaleTimeString()}
              <span className="buildtag" title="Deployed version">{typeof __BUILD__ !== "undefined" ? ` · v ${__BUILD__}` : ""}</span>
              <button onClick={() => loadSpot(active)}><IconRefresh /> Refresh</button>
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
      <StickyFooterAd enabled={!adFree && consent === "all"} />
      {resetToken && <AuthModal auth={auth} initialMode="reset" resetToken={resetToken} onClose={() => setResetToken("")} />}
      {!resetToken && verifyToken && <AuthModal auth={auth} initialMode="verify" verifyToken={verifyToken} onClose={() => setVerifyToken("")} />}
      {!resetToken && !verifyToken && gateAuth && <AuthModal auth={auth} initialMode={gateAuth} spotId={!landing ? active : ""} onClose={() => setGateAuth(null)} />}
    </>
  );
}
