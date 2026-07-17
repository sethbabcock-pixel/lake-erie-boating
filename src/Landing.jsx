import React, { useEffect, useState } from "react";
import Takeover from "./Takeover.jsx";
import { IconStar } from "./icons.jsx";
import { fmtWaves } from "./units.js";
import { AdSlot } from "./monetize.jsx";
import { REGIONS, LAKE_ORDER } from "./regions.js";

const vclass = (v) => (v === "NO-GO" ? "nogo" : v === "CAUTION" ? "caution" : v === "GO" ? "go" : "unknown");

function StatusChip({ level }) {
  return <span className={`loc-status ${level ? vclass(level) : "unknown"}`}>{level || "—"}</span>;
}

function LocCard({ s, onSelect }) {
  return (
    <button className="loc-card" onClick={() => onSelect(s.id)}>
      <div className="loc-card-top">
        <span className="loc-name">{s.name}</span>
        <StatusChip level={s.level} />
      </div>
      <div className="loc-card-meta">
        {s.windKt != null ? <>{s.windKt} kt{s.dir ? ` ${s.dir}` : ""}</> : "—"} · {fmtWaves(s.waveFt, s.periodSec)}
      </div>
    </button>
  );
}

function SplashSelector({ q, setQ, summary, onSelect, favorites }) {
  const ql = q.trim().toLowerCase();
  const matches = ql ? (summary || []).filter((s) => s.name.toLowerCase().includes(ql)).slice(0, 6) : [];
  const favCards = (favorites || []).map((id) => (summary || []).find((x) => x.id === id)).filter(Boolean).slice(0, 4);
  return (
    <div className="splash-pick">
      <input className="splash-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your launch, search a spot…" aria-label="Search spots" />
      {matches.length > 0 && (
        <div className="splash-matches">
          {matches.map((s) => (
            <button key={s.id} className="splash-match" onClick={() => onSelect(s.id)}>
              <span>{s.name}</span><StatusChip level={s.level} />
            </button>
          ))}
        </div>
      )}
      {!ql && favCards.length > 0 && (
        <div className="splash-favs">
          {favCards.map((s) => <button key={s.id} className="splash-fav" onClick={() => onSelect(s.id)}><IconStar filled /> {s.name}</button>)}
        </div>
      )}
      <a className="splash-scroll" href="#all-locations">Browse all locations ↓</a>
    </div>
  );
}

// Deep link (?lake=erie or ?lake=Lake%20Erie): which region to open + scroll to.
function lakeParam() {
  try {
    const v = (new URLSearchParams(window.location.search).get("lake") || "").trim().toLowerCase();
    if (!v) return null;
    return LAKE_ORDER.find((l) => l.toLowerCase() === v || l.toLowerCase().replace(/^lake\s+/, "") === v) || null;
  } catch (e) { return null; }
}

// Crawlable chips linking to each region page. Real <a href="/slug"> so search
// engines follow them, with an onClick for in-app navigation (no reload).
function RegionNav({ region, onRegion }) {
  return (
    <nav className="region-nav" aria-label="Regions">
      <a href="/" className={`region-chip ${!region ? "on" : ""}`}
        onClick={(e) => { if (onRegion) { e.preventDefault(); onRegion(null); } }}>All waters</a>
      {REGIONS.map((r) => (
        <a key={r.slug} href={`/${r.slug}`} className={`region-chip ${region?.slug === r.slug ? "on" : ""}`}
          onClick={(e) => { if (onRegion) { e.preventDefault(); onRegion(r.slug); } }}>{r.title}</a>
      ))}
    </nav>
  );
}

function RegionDirectory({ summary, q, onSelect, deepLake, region, onRegion }) {
  const ql = q.trim().toLowerCase();
  const inRegion = (lake) => !region || (region.lakes || []).includes(lake || "Lake Erie");
  const byLake = {};
  (summary || []).forEach((s) => {
    if (!inRegion(s.lake)) return;
    if (ql && !s.name.toLowerCase().includes(ql) && !(s.lake || "").toLowerCase().includes(ql)) return;
    (byLake[s.lake || "Lake Erie"] ||= []).push(s);
  });
  const lakes = Object.keys(byLake).sort((a, b) => {
    const ia = LAKE_ORDER.indexOf(a), ib = LAKE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  // Deep-linked lake: scroll its section into view once conditions render.
  useEffect(() => {
    if (!deepLake || summary == null) return;
    const el = document.getElementById(`lake-${deepLake.toLowerCase().replace(/\s+/g, "-")}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [deepLake, summary == null]);
  const tally = (list) => {
    const c = { GO: 0, CAUTION: 0, "NO-GO": 0 };
    list.forEach((s) => { if (s.level) c[s.level] = (c[s.level] || 0) + 1; });
    return c;
  };
  return (
    <section className="directory" id="all-locations">
      <RegionNav region={region} onRegion={onRegion} />
      <h2 className="directory-title">{region ? region.title : "All locations"}</h2>
      {region && <p className="directory-blurb">{region.blurb}</p>}
      {summary == null && (
        // Reserve the directory's height with skeleton cards so the footer
        // doesn't jump when live conditions load (kills the homepage CLS).
        <div className="region-skeletons" aria-hidden="true">
          {["Erie", "Ontario", "Huron", "Michigan", "Superior"].map((k) => <div className="region region-skel" key={k} />)}
        </div>
      )}
      {summary != null && lakes.length === 0 && <p className="acct-note">{ql ? <>No spots match “{q}”.</> : "No spots here yet."}</p>}
      {lakes.map((lake) => {
        const list = byLake[lake];
        const c = tally(list);
        return (
          <details className="region" key={lake} id={`lake-${lake.toLowerCase().replace(/\s+/g, "-")}`}
            open={deepLake ? lake === deepLake : (!!ql || !!region)}>
            <summary className="region-head">
              <span className="region-title">
                <span className="region-name">{lake}</span>
                <span className="region-sub">{list.length} port{list.length === 1 ? "" : "s"}</span>
              </span>
              <span className="region-side">
                <span className="region-tally">
                  {c.GO ? <em className="go">{c.GO} GO</em> : null}
                  {c.CAUTION ? <em className="caution">{c.CAUTION} caution</em> : null}
                  {c["NO-GO"] ? <em className="nogo">{c["NO-GO"]} no-go</em> : null}
                </span>
                {(c.GO + c.CAUTION + c["NO-GO"]) > 0 && (
                  <span className="region-bar" aria-hidden="true">
                    {c.GO ? <i className="go" style={{ flexGrow: c.GO }} /> : null}
                    {c.CAUTION ? <i className="caution" style={{ flexGrow: c.CAUTION }} /> : null}
                    {c["NO-GO"] ? <i className="nogo" style={{ flexGrow: c["NO-GO"] }} /> : null}
                  </span>
                )}
              </span>
            </summary>
            <div className="loc-grid">
              {list.map((s) => <LocCard key={s.id} s={s} onSelect={onSelect} />)}
            </div>
          </details>
        );
      })}
    </section>
  );
}

// Signed-in boaters with starred ports get their shoreline first, side-by-side.
function MyPorts({ summary, favorites, onSelect }) {
  const mine = (favorites || []).map((id) => (summary || []).find((s) => s.id === id)).filter(Boolean);
  if (!mine.length) return null;
  return (
    <section className="directory myports">
      <h2 className="directory-title"><IconStar filled /> My ports</h2>
      <div className="loc-grid">
        {mine.map((s) => <LocCard key={s.id} s={s} onSelect={onSelect} />)}
      </div>
    </section>
  );
}

export default function Landing({ adFree, consent, onSelect, favorites, onCookieSettings, onJoin, onSignIn, signedIn, nudge, region, onRegion }) {
  const [summary, setSummary] = useState(null);
  const [q, setQ] = useState("");
  const deepLake = lakeParam();
  useEffect(() => {
    let alive = true;
    fetch("/marine/conditions?summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setSummary((d && d.spots) || []); })
      .catch(() => { if (alive) setSummary([]); });
    return () => { alive = false; };
  }, []);
  return (
    <>
      <Takeover splash adFree={adFree} signedIn={signedIn} onJoin={onJoin}>
        <SplashSelector q={q} setQ={setQ} summary={summary} onSelect={onSelect} favorites={favorites} />
      </Takeover>
      <main className="app">
        {onJoin && (
          <div className="joinstrip">
            <span><b>Every port's verdict is below, free.</b> Create an account for the hour-by-hour picture, live cams &amp; “be back in by” times.</span>
            <div className="joinstrip-actions">
              <button className="cbtn" onClick={onJoin}>Create free account</button>
              {onSignIn && <button className="linklike joinstrip-signin" onClick={onSignIn}>Already have an account? Sign in</button>}
            </div>
          </div>
        )}
        {signedIn && (favorites || []).length === 0 && (
          <div className="joinstrip fav-nudge">
            <span><b><IconStar filled /> Star your home port</b> and it'll be front and center here, and in your morning verdict email. Tap any port below, then hit the star.</span>
          </div>
        )}
        {nudge}
        {!adFree && consent === "all" && <AdSlot name="landingTop" />}
        {signedIn && <MyPorts summary={summary} favorites={favorites} onSelect={onSelect} />}
        <RegionDirectory summary={summary} q={q} onSelect={onSelect} deepLake={region ? null : deepLake} region={region} onRegion={onRegion} />
        {!adFree && consent === "all" && <AdSlot name="landing" />}
        <footer className="meta">
          Live data from NOAA/NWS &amp; NDBC buoys, maps by Windy. A planning aid, not an official forecast or a navigation tool.
          <div className="footlinks">
            <a href="/about" target="_blank" rel="noopener">About</a>
            <a href="/legal#terms" target="_blank" rel="noopener">Terms</a>
            <a href="/legal#privacy" target="_blank" rel="noopener">Privacy</a>
            {onCookieSettings && <button className="linklike" onClick={onCookieSettings}>Cookie settings</button>}
          </div>
        </footer>
      </main>
    </>
  );
}
