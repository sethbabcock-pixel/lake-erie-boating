import React, { useEffect, useMemo, useState } from "react";
import { PageHead, Panel, Field, Switch, Badge, Empty, Icon, todayISO, fmtNum, useAdminFetch } from "./ui.jsx";
import { REGIONS, regionForLake } from "../regions.js";
import { targetLabel } from "../sponsor-target.js";

const blankCampaign = () => ({
  id: "", sponsor: "", start: todayISO(), end: todayISO(),
  eyebrow: "Today's forecast brought to you by", headline: "", sub: "",
  cta: "Learn more", href: "", logo: "", bgImage: "",
  bg: "#304CB2", fg: "#ffffff", accent: "#f9b612", accentFg: "#11151c", hideForAdFree: false,
  regions: [], spots: [],
});

const plural = (n, w) => `${fmtNum(n)} ${w}${n === 1 ? "" : "s"}`;

// Every launch (curated + featured built pages), for the targeting picker.
function useLaunches() {
  const [list, setList] = useState([]);
  useEffect(() => {
    let alive = true;
    fetch("/marine/conditions?spots").then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setList(d.spots || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return list;
}

// Two campaigns collide when their dates overlap and they can show on the same
// page at the same specificity; the one higher in the list wins there.
const overlapsDates = (a, b) => a.start && b.start && a.start <= (b.end || b.start) && b.start <= (a.end || a.start);
const isEverywhere = (c) => !(c.regions || []).length && !(c.spots || []).length;
function collides(a, b) {
  if (!overlapsDates(a, b)) return false;
  if (isEverywhere(a) && isEverywhere(b)) return true;
  if ((a.spots || []).some((x) => (b.spots || []).includes(x))) return true;
  return (a.regions || []).some((x) => (b.regions || []).includes(x));
}

function Targeting({ c, set, launches }) {
  const [q, setQ] = useState("");
  const targeted = !isEverywhere(c) || c._targeted;
  const regions = c.regions || [], spots = c.spots || [];
  const toggle = (k, v) => set(k, (c[k] || []).includes(v) ? c[k].filter((x) => x !== v) : [...(c[k] || []), v]);
  const name = (id) => (launches.find((l) => l.id === id) || {}).name || id;
  const matches = q.trim().length < 2 ? [] : launches
    .filter((l) => !spots.includes(l.id) && `${l.name} ${l.lake}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return (
    <div className="wide adm-target">
      <span className="adm-label">Where it shows</span>
      <div className="adm-seg" role="radiogroup">
        <button type="button" role="radio" aria-checked={!targeted} className={!targeted ? "on" : ""}
          onClick={() => setTargets({ regions: [], spots: [], _targeted: false })}>Everywhere</button>
        <button type="button" role="radio" aria-checked={targeted} className={targeted ? "on" : ""}
          onClick={() => setTargets({ _targeted: true })}>Selected regions or launches</button>
      </div>
      {targeted && (
        <>
          <div className="adm-chips">
            {REGIONS.map((r) => (
              <button type="button" key={r.slug} className={`adm-chip${regions.includes(r.slug) ? " on" : ""}`} aria-pressed={regions.includes(r.slug)}
                onClick={() => toggle("regions", r.slug)}>{r.title}</button>
            ))}
          </div>
          <div className="adm-launchpick">
            <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a specific launch: type a town, e.g. Fort Lauderdale" aria-label="Find a launch" />
            {matches.length > 0 && (
              <div className="adm-launchlist">
                {matches.map((l) => (
                  <button type="button" key={l.id} onClick={() => { set("spots", [...spots, l.id]); setQ(""); }}>
                    {l.name} <small>{(regionForLake(l.lake) || {}).title || l.lake}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          {spots.length > 0 && (
            <div className="adm-chips">
              {spots.map((id) => (
                <span key={id} className="adm-chip on">{name(id)}
                  <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => toggle("spots", id)}>×</button></span>
              ))}
            </div>
          )}
          <p className="adm-muted" style={{ margin: 0 }}>
            {regions.length || spots.length
              ? <>Shows on {targetLabel(c, REGIONS, name)} pages. On those pages it beats an Everywhere campaign; a launch pick beats a region pick.</>
              : "Pick at least one region or launch, or switch back to Everywhere."}
          </p>
        </>
      )}
    </div>
  );
  function setTargets(patch) { set(null, patch); }
}

function CampaignStats({ st }) {
  if (!st) return null;
  const max = Math.max(1, ...st.days.map((d) => d.views));
  return (
    <div className="adm-campstats">
      <div className="adm-kv"><span>Views</span><b>{fmtNum(st.views)}</b></div>
      <div className="adm-kv"><span>Clicks</span><b>{fmtNum(st.clicks)}</b></div>
      <div className="adm-kv"><span>Click-through rate</span><b>{st.views ? `${((st.clicks / st.views) * 100).toFixed(1)}%` : "—"}</b></div>
      {st.days.length > 1 && (
        <div className="adm-bars brand" style={{ height: 48, marginTop: 8 }} role="img" aria-label="Views per day">
          {st.days.map((d) => (
            <div key={d.date} className="adm-bar-col" title={`${d.date}: ${d.views} views, ${d.clicks} clicks`}>
              <div className="adm-bar" style={{ height: `${Math.max(d.views ? 4 : 0, Math.round((d.views / max) * 100))}%` }} />
            </div>
          ))}
        </div>
      )}
      <p className="adm-muted" style={{ margin: "6px 0 0" }}>Counted from the page, without cookies. Share these with the sponsor.</p>
    </div>
  );
}

export const campaignState = (c, today = todayISO()) =>
  !c.start ? "draft" : c.start > today ? "scheduled" : today > (c.end || c.start) ? "ended" : "live";
const STATE_TONE = { live: "ok", scheduled: "info", ended: "neutral", draft: "warn" };

// Text URL + an "Upload" button that stores the file in KV and fills its URL.
export function UploadField({ label, hint, value, onChange, kind = "image" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isVideo = kind === "video";
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/upload", { method: "POST", headers: { "Content-Type": f.type }, body: f });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed.");
      onChange(d.url);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <div className="adm-field">
      <span className="adm-label">{label}{hint && <em>{hint}</em>}</span>
      <div className="adm-upload">
        {value && !isVideo && <img className="adm-thumb" src={value} alt="" onError={(e) => { e.target.style.visibility = "hidden"; }} />}
        {value && isVideo && <video className="adm-thumb" src={value} muted loop autoPlay playsInline />}
        <input className="adm-input" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="/path, https://…, or upload" />
        <label className="adm-btn ghost sm">{busy ? "Uploading…" : "Upload"}
          <input type="file" accept={isVideo ? "video/*" : "image/*"} onChange={onFile} hidden disabled={busy} />
        </label>
      </div>
      {err && <div className="adm-error">{err}</div>}
    </div>
  );
}

// A scaled-down render of the sponsor hero so the admin sees what ships.
function SponsorPreview({ c }) {
  const bg = c.bgImage
    ? `linear-gradient(90deg, ${c.bg} 15%, color-mix(in srgb, ${c.bg} 35%, transparent)), url(${c.bgImage}) center/cover`
    : c.bg;
  return (
    <div className="adm-preview" style={{ background: bg, color: c.fg }}>
      <div className="adm-preview-text">
        <small>{c.eyebrow || "Sponsored"}</small>
        {c.logo && <img src={c.logo} alt="" />}
        <strong>{c.headline || "Your headline here"}</strong>
        {c.sub && <span>{c.sub}</span>}
      </div>
      {c.cta && <span className="adm-preview-cta" style={{ background: c.accent, color: c.accentFg }}>{c.cta} →</span>}
      <em className="adm-preview-ad">Ad</em>
    </div>
  );
}

function CampaignEditor({ c, onChange, onRemove, onClose, launches, conflicts, stats }) {
  const set = (k, v) => onChange(k == null ? { ...c, ...v } : { ...c, [k]: v });
  const bad = c.end && c.start && c.end < c.start;
  return (
    <div className="adm-editor">
      <SponsorPreview c={c} />
      <div className="adm-form">
        <Field label="Sponsor"><input className="adm-input" value={c.sponsor} onChange={(e) => set("sponsor", e.target.value)} placeholder="Catawba Island Marina" /></Field>
        <Field label="Starts"><input className="adm-input" type="date" value={c.start} onChange={(e) => set("start", e.target.value)} /></Field>
        <Field label="Ends"><input className="adm-input" type="date" value={c.end} onChange={(e) => set("end", e.target.value)} /></Field>
        {bad && <div className="adm-error wide">The end date is before the start date.</div>}
        <Field label="Eyebrow" hint="small line above the headline" wide><input className="adm-input" value={c.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></Field>
        <Field label="Headline" wide><input className="adm-input" value={c.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Slips open for the fall run" /></Field>
        <Field label="Subtext" wide><input className="adm-input" value={c.sub} onChange={(e) => set("sub", e.target.value)} /></Field>
        <Field label="Button text"><input className="adm-input" value={c.cta} onChange={(e) => set("cta", e.target.value)} /></Field>
        <Field label="Click-through URL" wide><input className="adm-input" value={c.href} onChange={(e) => set("href", e.target.value)} placeholder="https://…" /></Field>
        {c.href && !/^(https?:\/\/|\/(?!\/))/i.test(c.href) && <div className="adm-error wide">Use a full web address starting with https:// (or a /path on this site). Anything else is removed on save.</div>}
        <div className="wide adm-form-2">
          <UploadField label="Logo" value={c.logo} onChange={(v) => set("logo", v)} />
          <UploadField label="Background photo" hint="optional" value={c.bgImage} onChange={(v) => set("bgImage", v)} />
        </div>
        <div className="wide adm-colors">
          {[["bg", "Background"], ["fg", "Text"], ["accent", "Button"], ["accentFg", "Button text"]].map(([k, l]) => (
            <label key={k} className="adm-color">
              <input type="color" value={c[k]} onChange={(e) => set(k, e.target.value)} />
              <span>{l}<code>{c[k]}</code></span>
            </label>
          ))}
        </div>
        <Targeting c={c} set={set} launches={launches} />
        {conflicts.length > 0 && (
          <div className="wide adm-warnbox">
            Overlaps with {conflicts.map((x) => x.sponsor || x.headline || "another campaign").join(", ")} on the same pages and dates.
            Where both match, the one higher in this list shows.
          </div>
        )}
        <div className="wide">
          <Switch checked={c.hideForAdFree} onChange={(v) => set("hideForAdFree", v)} label="Hide from ad-free subscribers" sub="Off by default: direct sponsors usually want every visitor." />
        </div>
        {stats && <div className="wide"><span className="adm-label">Performance</span><CampaignStats st={stats} /></div>}
      </div>
      <div className="adm-editor-foot">
        <button className="adm-btn danger ghost sm" onClick={onRemove}><Icon name="trash" /> Delete campaign</button>
        <button className="adm-btn sm" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export default function SponsorsPage({ cfg, setCfg }) {
  const [open, setOpen] = useState(null);
  const list = cfg.takeovers;
  const launches = useLaunches();
  const statsF = useAdminFetch("/api/admin/sponsor-stats", (d) => d.stats);
  const stats = statsF.data || {};
  const lname = (id) => (launches.find((l) => l.id === id) || {}).name || id;
  const conflictsFor = useMemo(() => (i) => list.filter((x, j) => j !== i && campaignState(x) !== "ended" && collides(list[i], x)), [list]);
  const setAt = (i, next) => setCfg((c) => ({ ...c, takeovers: c.takeovers.map((t, j) => (j === i ? next : t)) }));
  const removeAt = (i) => { setCfg((c) => ({ ...c, takeovers: c.takeovers.filter((_, j) => j !== i) })); setOpen(null); };
  const add = () => { setCfg((c) => ({ ...c, takeovers: [blankCampaign(), ...c.takeovers] })); setOpen(0); };
  const order = { live: 0, scheduled: 1, draft: 2, ended: 3 };
  const rows = list.map((c, i) => ({ c, i, st: campaignState(c) })).sort((a, b) => order[a.st] - order[b.st] || (a.c.start || "").localeCompare(b.c.start || ""));

  return (
    <>
      <PageHead title="Sponsors" sub="Direct-sold takeovers: a full-page brand skin plus the hero. Run one everywhere, or sell a region (Florida) or specific launches (Fort Lauderdale) to a local business. On each page the most specific live campaign wins; with none, Ad Manager or the house hero shows.">
        <button className="adm-btn" onClick={add}><Icon name="plus" /> New campaign</button>
      </PageHead>
      <Panel>
        {!rows.length && <Empty>No campaigns yet. Marinas, charters, dealers and bait shops are the natural buyers. A booked day here outearns AdSense many times over.</Empty>}
        <div className="adm-table">
          {rows.map(({ c, i, st }) => (
            <div key={c.id || i} className={`adm-campaign${open === i ? " open" : ""}`}>
              <button className="adm-row adm-row-btn" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                <span className="adm-swatch" style={{ background: c.bg }} />
                <div className="adm-row-main">
                  <div className="adm-row-title">{c.sponsor || c.headline || "Untitled campaign"} <Badge tone={STATE_TONE[st]}>{st}</Badge></div>
                  <div className="adm-row-sub">{c.start}{c.end && c.end !== c.start ? ` → ${c.end}` : ""} · <b>{targetLabel(c, REGIONS, lname)}</b> · {c.headline || "no headline"}</div>
                </div>
                {stats[c.id] && stats[c.id].views > 0 && <span className="adm-muted">{plural(stats[c.id].views, "view")} · {plural(stats[c.id].clicks, "click")}</span>}
                <span className="adm-muted">{open === i ? "Close" : "Edit"}</span>
              </button>
              {open === i && <CampaignEditor c={c} onChange={(n) => setAt(i, n)} onRemove={() => removeAt(i)} onClose={() => setOpen(null)}
                launches={launches} conflicts={conflictsFor(i)} stats={stats[c.id]} />}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export function HomepagePage({ cfg, setCfg }) {
  const h = cfg.hero;
  const set = (k, v) => setCfg((c) => ({ ...c, hero: { ...c.hero, [k]: v } }));
  return (
    <>
      <PageHead title="Homepage hero" sub="The banner at the top of the homepage and spot pages whenever no sponsor is running." />
      <div className="adm-grid2 wide-left">
        <Panel title="Content">
          <div className="adm-form">
            <Field label="Headline" hint="{spot} inserts the spot name" wide><input className="adm-input" value={h.headline} onChange={(e) => set("headline", e.target.value)} /></Field>
            <Field label="Subtext" hint="shown when there's no live verdict" wide><input className="adm-input" value={h.sub} onChange={(e) => set("sub", e.target.value)} /></Field>
            <div className="wide"><UploadField label="Background image" hint="wide landscape; text sits on the darker left side" value={h.image} onChange={(v) => set("image", v)} /></div>
            <div className="wide"><UploadField label="Background video" hint="optional muted loop, ≤12 MB; the image is its poster" value={h.video} onChange={(v) => set("video", v)} kind="video" /></div>
            <div className="wide"><Switch checked={h.showVerdict} onChange={(v) => set("showVerdict", v)} label="Show the live GO / CAUTION / NO-GO badge in the hero" /></div>
          </div>
        </Panel>
        <Panel title="Preview">
          <div className="adm-preview house" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,20,38,.85), rgba(5,20,38,.2)), url(${h.image})` }}>
            <div className="adm-preview-text">
              <strong>{(h.headline || "").replace("{spot}", " at Port Clinton")}</strong>
              {h.showVerdict ? <span><b className="adm-go">GO</b> right now</span> : h.sub && <span>{h.sub}</span>}
            </div>
          </div>
          <p className="adm-muted">Approximate. <a href="/spot/port-clinton" target="_blank" rel="noopener">Open a spot page</a> after saving to see it for real.</p>
        </Panel>
      </div>
    </>
  );
}
