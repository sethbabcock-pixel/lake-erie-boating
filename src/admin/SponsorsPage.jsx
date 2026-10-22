import React, { useState } from "react";
import { PageHead, Panel, Field, Switch, Badge, Empty, Icon, todayISO } from "./ui.jsx";

const blankCampaign = () => ({
  id: "", sponsor: "", start: todayISO(), end: todayISO(),
  eyebrow: "Today's forecast brought to you by", headline: "", sub: "",
  cta: "Learn more", href: "", logo: "", bgImage: "",
  bg: "#304CB2", fg: "#ffffff", accent: "#f9b612", accentFg: "#11151c", hideForAdFree: false,
});

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

function CampaignEditor({ c, onChange, onRemove, onClose }) {
  const set = (k, v) => onChange({ ...c, [k]: v });
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
        <div className="wide">
          <Switch checked={c.hideForAdFree} onChange={(v) => set("hideForAdFree", v)} label="Hide from ad-free subscribers" sub="Off by default: direct sponsors usually want every visitor." />
        </div>
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
  const setAt = (i, next) => setCfg((c) => ({ ...c, takeovers: c.takeovers.map((t, j) => (j === i ? next : t)) }));
  const removeAt = (i) => { setCfg((c) => ({ ...c, takeovers: c.takeovers.filter((_, j) => j !== i) })); setOpen(null); };
  const add = () => { setCfg((c) => ({ ...c, takeovers: [blankCampaign(), ...c.takeovers] })); setOpen(0); };
  const order = { live: 0, scheduled: 1, draft: 2, ended: 3 };
  const rows = list.map((c, i) => ({ c, i, st: campaignState(c) })).sort((a, b) => order[a.st] - order[b.st] || (a.c.start || "").localeCompare(b.c.start || ""));

  return (
    <>
      <PageHead title="Sponsors" sub="Direct-sold homepage takeovers: a full-page brand skin plus the hero. The campaign running today wins; when none is, Ad Manager or the house hero shows.">
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
                  <div className="adm-row-sub">{c.start}{c.end && c.end !== c.start ? ` → ${c.end}` : ""} · {c.headline || "no headline"}</div>
                </div>
                <span className="adm-muted">{open === i ? "Close" : "Edit"}</span>
              </button>
              {open === i && <CampaignEditor c={c} onChange={(n) => setAt(i, n)} onRemove={() => removeAt(i)} onClose={() => setOpen(null)} />}
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
