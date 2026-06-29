import React, { useEffect, useState } from "react";
import Takeover from "./Takeover.jsx";

const vclass = (v) => (v === "NO-GO" ? "nogo" : v === "CAUTION" ? "caution" : v === "GO" ? "go" : "unknown");
const LAKE_ORDER = ["Lake Erie", "Lake Ontario", "Lake Huron", "Lake Michigan", "Lake Superior"];

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
        {s.windKt != null ? <>{s.windKt} kt{s.dir ? ` ${s.dir}` : ""}</> : "—"} · {s.waveFt != null ? `${s.waveFt} ft` : "—"}
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
      <input className="splash-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your launch — search a spot…" aria-label="Search spots" />
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
          {favCards.map((s) => <button key={s.id} className="splash-fav" onClick={() => onSelect(s.id)}>★ {s.name}</button>)}
        </div>
      )}
      <a className="splash-scroll" href="#all-locations">Browse all locations ↓</a>
    </div>
  );
}

function RegionDirectory({ summary, q, onSelect }) {
  const ql = q.trim().toLowerCase();
  const byLake = {};
  (summary || []).forEach((s) => {
    if (ql && !s.name.toLowerCase().includes(ql) && !(s.lake || "").toLowerCase().includes(ql)) return;
    (byLake[s.lake || "Lake Erie"] ||= []).push(s);
  });
  const lakes = Object.keys(byLake).sort((a, b) => {
    const ia = LAKE_ORDER.indexOf(a), ib = LAKE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const tally = (list) => {
    const c = { GO: 0, CAUTION: 0, "NO-GO": 0 };
    list.forEach((s) => { if (s.level) c[s.level] = (c[s.level] || 0) + 1; });
    return c;
  };
  return (
    <section className="directory" id="all-locations">
      <h2 className="directory-title">All locations</h2>
      {summary == null && <p className="acct-note">Loading live conditions…</p>}
      {summary != null && lakes.length === 0 && <p className="acct-note">No spots match “{q}”.</p>}
      {lakes.map((lake) => {
        const list = byLake[lake];
        const c = tally(list);
        return (
          <details className="region" key={lake} open={lake === "Lake Erie" || !!ql}>
            <summary className="region-head">
              <span className="region-name">{lake}</span>
              <span className="region-tally">
                {c.GO ? <em className="go">{c.GO} GO</em> : null}
                {c.CAUTION ? <em className="caution">{c.CAUTION} caution</em> : null}
                {c["NO-GO"] ? <em className="nogo">{c["NO-GO"]} no-go</em> : null}
                <span className="region-count">{list.length} spots</span>
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

export default function Landing({ adFree, onSelect, favorites }) {
  const [summary, setSummary] = useState(null);
  const [q, setQ] = useState("");
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
      <Takeover splash adFree={adFree}>
        <SplashSelector q={q} setQ={setQ} summary={summary} onSelect={onSelect} favorites={favorites} />
      </Takeover>
      <main className="app">
        <RegionDirectory summary={summary} q={q} onSelect={onSelect} />
      </main>
    </>
  );
}
