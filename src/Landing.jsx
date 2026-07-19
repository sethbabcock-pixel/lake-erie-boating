import React, { useEffect, useState } from "react";
import Takeover from "./Takeover.jsx";
import { IconStar } from "./icons.jsx";
import { fmtWaves } from "./units.js";
import { AdSlot } from "./monetize.jsx";
import { REGIONS, LAKE_ORDER } from "./regions.js";

const vclass = (v) => (v === "NO-GO" ? "nogo" : v === "CAUTION" ? "caution" : v === "GO" ? "go" : "unknown");

// Great-circle miles between two {lat, lon} points (nearest-launch ranking).
const haversineMi = (a, b) => {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const COVERAGE_MI = 75; // beyond this, we treat the area as "not covered yet"

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

// Search a town/lake/ZIP (or use the browser's location): point to the nearest
// covered launch, and offer to build a live page for that exact spot from NOAA
// data. No coverage nearby → build a page and/or request a curated spot.
function NearestFinder({ summary, onSelect, onRequest, onPreview }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { label, pt:{lat,lon}, near:[{s,mi}], covered, nearest }
  const withCoords = (summary || []).filter((s) => s.lat != null && s.lon != null);
  const findFrom = (lat, lon, label) => {
    const pt = { lat, lon };
    const ranked = withCoords.map((s) => ({ s, mi: haversineMi({ lat, lon }, s) })).sort((a, b) => a.mi - b.mi);
    const near = ranked.filter((r) => r.mi <= COVERAGE_MI).slice(0, 3);
    setErr("");
    setResult({ label, pt, near, covered: near.length > 0, nearest: ranked[0] || null });
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) { setErr("Your browser can't share location. Type a place or ZIP instead."); return; }
    setBusy(true); setErr("");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setBusy(false); findFrom(pos.coords.latitude, pos.coords.longitude, "your location"); },
      (e) => { setBusy(false); setErr(e.code === 1 ? "Location permission denied. Type a place or ZIP instead." : "Couldn't get your location. Type a place or ZIP."); },
      { timeout: 8000, maximumAge: 300000 },
    );
  };
  const lookup = async (e) => {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) { setErr("Type a town, lake, or 5-digit ZIP."); return; }
    setBusy(true); setErr("");
    try {
      const param = /^\d{5}$/.test(term) ? `zip=${term}` : `q=${encodeURIComponent(term)}`;
      const r = await fetch(`/api/geocode?${param}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Couldn't look up that place.");
      findFrom(d.lat, d.lon, d.place || term);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const label = result ? (result.label === "your location" ? "your spot" : result.label) : "";
  const buildPage = () => onPreview && result?.pt && onPreview({ ...result.pt, name: result.label === "your location" ? "" : result.label });
  return (
    <section className="nearby-finder">
      <h2 className="directory-title" style={{ margin: 0 }}>Find or build a page for any spot</h2>
      <p className="directory-blurb" style={{ margin: "4px 0 0" }}>Search a town, lake, or ZIP. We'll point you at the nearest covered launch, or build a live page for that exact spot straight from NOAA.</p>
      {/* Search-first: the type-a-place bar is the primary action and grows to
          fill the card; geolocation is the compact secondary beside it (its own
          full-width row on phones). */}
      <div className="nf-controls">
        <form className="nf-bar" onSubmit={lookup}>
          <input className="field nf-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Town, lake, or ZIP" aria-label="Search a place or ZIP" />
          <button className="cbtn nf-go" type="submit" disabled={busy}>{busy ? "…" : "Search"}</button>
        </form>
        <button className="cbtn ghost nf-locbtn" type="button" onClick={useMyLocation} disabled={busy}>📍 Use my location</button>
      </div>
      {err && <div className="modal-err" style={{ marginTop: 8 }}>{err}</div>}
      {result && (
        <div className="nf-results">
          {result.covered ? (
            <>
              <p className="acct-note" style={{ margin: "10px 0 6px" }}>Closest covered launches to {label}:</p>
              <div className="loc-grid">
                {result.near.map(({ s, mi }) => (
                  <button key={s.id} className="loc-card" onClick={() => onSelect(s.id)}>
                    <div className="loc-card-top"><span className="loc-name">{s.name}</span><StatusChip level={s.level} /></div>
                    <div className="loc-card-meta">{Math.round(mi)} mi away · {s.lake}</div>
                  </button>
                ))}
              </div>
              {onPreview && <p className="acct-note" style={{ margin: "8px 0 0" }}>Or <button className="linklike" onClick={buildPage}>build a live page for {label} →</button></p>}
            </>
          ) : (
            <div className="nf-nocover">
              <p>No covered launch within {COVERAGE_MI} miles{result.nearest ? ` (closest is ${result.nearest.s.name}, ${Math.round(result.nearest.mi)} mi)` : ""}. Build a live page for {label} straight from NOAA data:</p>
              <div className="nf-actions">
                {onPreview && <button className="cbtn" onClick={buildPage}>Build this page</button>}
                <button className="cbtn ghost" onClick={() => onRequest(result.label === "your location" ? "" : result.label)}>Request a curated spot</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Request a water body we don't cover yet. Doubles as our expansion demand
// signal, and collects the one thing we can't automate: the local webcam URL.
// openToken bumps to force-open + prefill from the "near me" no-coverage funnel.
function RequestLocation({ userEmail, openToken, prefill }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState(userEmail || "");
  const [webcam, setWebcam] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  const [err, setErr] = useState("");
  useEffect(() => { if (openToken) { setOpen(true); if (prefill) setLocation(prefill); } }, [openToken]);
  useEffect(() => { if (userEmail && !email) setEmail(userEmail); }, [userEmail]);
  const submit = async (e) => {
    e.preventDefault();
    if (location.trim().length < 2) { setErr("Please enter a location."); return; }
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/request-location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, email, webcam, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
      setState("done");
    } catch (e2) { setErr(e2.message); }
  };
  // Collapsed by default: a one-line invitation, not a second feature card —
  // the finder above is the primary path and its no-coverage flow force-opens
  // this form via openToken.
  if (state !== "done" && !open) {
    return (
      <section className="reqloc reqloc-slim" id="request-location">
        <p className="reqloc-line">Don't see your water? <button className="linklike" onClick={() => setOpen(true)}>Request a location →</button></p>
      </section>
    );
  }
  return (
    <section className="reqloc" id="request-location">
      {state === "done" ? (
        <div className="reqloc-done"><b>Request received.</b> Thanks. We log every request and use them to decide where to add water, and cameras, next.</div>
      ) : (
        <>
          <div className="reqloc-head">
            <div>
              <h2 className="directory-title" style={{ marginBottom: 4 }}>Don't see your water?</h2>
              <p className="directory-blurb" style={{ margin: 0 }}>Tell us where you boat. Requests drive where we expand next, and if you know the local harbor webcam, that's the piece we can't automate.</p>
            </div>
          </div>
          {open && (
            <form className="reqloc-form" onSubmit={submit}>
              <label className="acct-field"><span>Location <em className="req-star">*</em></span>
                <input className="field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, lake, bay, or river (e.g. Middle River, MD)" maxLength={120} required /></label>
              <label className="acct-field"><span>Your email <span className="opt">(optional, so we can tell you when it's live)</span></span>
                <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={254} /></label>
              <label className="acct-field"><span>Local webcam URL <span className="opt">(optional)</span></span>
                <input className="field" value={webcam} onChange={(e) => setWebcam(e.target.value)} placeholder="Link to a public harbor or marina cam" maxLength={300} /></label>
              <label className="acct-field"><span>Anything else <span className="opt">(optional)</span></span>
                <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Launch ramp, nearest buoy, whatever helps" /></label>
              {err && <div className="modal-err">{err}</div>}
              <div className="reqloc-actions">
                <button className="cbtn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send request"}</button>
              </div>
            </form>
          )}
        </>
      )}
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

// Editorial hub teaser — genuine written content on the homepage, and the entry
// point to the /guides library (static, indexable articles). A few featured
// guides plus a link to the full set.
const FEATURED_GUIDES = [
  { href: "/guides/reading-a-marine-forecast", title: "How to read a marine forecast", blurb: "Wind, gusts, wave height and the wave-period number most boaters miss." },
  { href: "/guides/cold-water-safety", title: "Cold-water safety", blurb: "Cold shock, the 1-10-1 rule, and why the water can be the real danger." },
  { href: "/guides/wind-direction-and-fetch", title: "Wind direction & fetch", blurb: "Why the same wind speed is flat one day and a beating the next." },
];
function GuidesTeaser() {
  return (
    <section className="directory guides-teaser">
      <h2 className="directory-title">Learn the water</h2>
      <p className="guides-teaser-lede">
        The Great Lakes make their own weather — short steep chop, cold water most of the year, and a
        wind that's harmless off one shore and dangerous off another. Our plain-English
        {" "}<a href="/guides/" target="_blank" rel="noopener">boating guides</a> explain how to read the
        conditions — and every number on a spot page — so you can make a good call before you tow the boat.
      </p>
      <div className="loc-grid">
        {FEATURED_GUIDES.map((g) => (
          <a className="loc-card guide-teaser-card" key={g.href} href={g.href} target="_blank" rel="noopener">
            <div className="loc-card-top"><span className="loc-name">{g.title}</span></div>
            <div className="loc-card-meta">{g.blurb}</div>
          </a>
        ))}
      </div>
      <a className="guides-all-link" href="/guides/" target="_blank" rel="noopener">Browse all boating guides →</a>
    </section>
  );
}

export default function Landing({ adFree, onSelect, favorites, onCookieSettings, onJoin, onSignIn, signedIn, nudge, region, onRegion, userEmail, onPreview }) {
  const [summary, setSummary] = useState(null);
  const [q, setQ] = useState("");
  const [reqToken, setReqToken] = useState(0);
  const [reqPrefill, setReqPrefill] = useState("");
  const openRequest = (name = "") => {
    setReqPrefill(name);
    setReqToken((n) => n + 1);
    setTimeout(() => document.getElementById("request-location")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
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
        <NearestFinder summary={summary} onSelect={onSelect} onRequest={openRequest} onPreview={onPreview} />
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
        {!adFree && <AdSlot name="landingTop" />}
        {signedIn && <MyPorts summary={summary} favorites={favorites} onSelect={onSelect} />}
        <RegionDirectory summary={summary} q={q} onSelect={onSelect} deepLake={region ? null : deepLake} region={region} onRegion={onRegion} />
        <GuidesTeaser />
        <RequestLocation userEmail={userEmail} openToken={reqToken} prefill={reqPrefill} />
        {!adFree && <AdSlot name="landing" />}
        <footer className="meta">
          Live data from NOAA/NWS &amp; NDBC buoys, maps by Windy. A planning aid, not an official forecast or a navigation tool.
          <div className="footlinks">
            <a href="/guides/" target="_blank" rel="noopener">Guides</a>
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
