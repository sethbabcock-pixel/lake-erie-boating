import React, { useState } from "react";
import { CAMS, CAM_KINDS, camSrc, camIsImage, normalizeCustomCam } from "../cams.js";
import { PageHead, Panel, Field, Switch, Badge, Icon } from "./ui.jsx";

const LAKES = ["Lake Erie", "Lake Michigan", "Lake Huron", "Lake Ontario", "Lake Superior"];
const camKindOf = (c) => (c.img ? "img" : c.yt ? "yt" : c.ytChannel ? "ytChannel" : c.angelcam ? "angelcam" : c.wetmet ? "wetmet" : c.ipcamlive ? "ipcamlive" : c.ozolio ? "ozolio" : "");
const camKindLabelOf = (c) => (CAM_KINDS.find((k) => k.kind === camKindOf(c)) || {}).label || "—";
const blankCustomCam = () => ({ name: "", lake: "Lake Erie", lat: "", lon: "", kind: "yt", id: "", link: "" });

function CamPreview({ cam }) {
  if (!cam) return null;
  return (
    <div className="adm-campreview">
      {camIsImage(cam)
        ? <img src={cam.img} alt={cam.name} />
        : <iframe title={cam.name} src={camSrc(cam)} allow="autoplay; fullscreen; encrypted-media" />}
    </div>
  );
}

// Add/edit form for a custom cam. Values stay strings while typing;
// normalizeCustomCam validates the finished entry (and powers the preview).
function CamEditor({ initial, onSave, onCancel }) {
  const [e, setE] = useState(initial);
  const [preview, setPreview] = useState(false);
  const set = (k, v) => { setE((p) => ({ ...p, [k]: v })); setPreview(false); };
  const cam = normalizeCustomCam(e);
  const hint = (CAM_KINDS.find((k) => k.kind === e.kind) || {}).hint;
  return (
    <div className="adm-editor">
      <div className="adm-form">
        <Field label="Cam name" hint="shown in the picker" wide><input className="adm-input" value={e.name} onChange={(ev) => set("name", ev.target.value)} placeholder="Port Clinton · Waterfront" /></Field>
        <Field label="Lake">
          <select className="adm-input" value={e.lake} onChange={(ev) => set("lake", ev.target.value)}>
            {LAKES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Latitude"><input className="adm-input mono" value={e.lat} onChange={(ev) => set("lat", ev.target.value)} placeholder="41.512" inputMode="decimal" /></Field>
        <Field label="Longitude"><input className="adm-input mono" value={e.lon} onChange={(ev) => set("lon", ev.target.value)} placeholder="-82.937" inputMode="decimal" /></Field>
        <Field label="Provider">
          <select className="adm-input" value={e.kind} onChange={(ev) => set("kind", ev.target.value)}>
            {CAM_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
        </Field>
        <Field label={e.kind === "img" ? "Image URL" : "Cam ID"} hint={hint} wide>
          <input className="adm-input mono" value={e.id} onChange={(ev) => set("id", ev.target.value)} />
        </Field>
        {e.kind === "img" && (
          <Field label="Source page URL" hint="where “Open this cam” goes" wide>
            <input className="adm-input" value={e.link} onChange={(ev) => set("link", ev.target.value)} placeholder="https://…" />
          </Field>
        )}
      </div>
      {preview && cam && <CamPreview cam={cam} />}
      <div className="adm-editor-foot">
        <button className="adm-btn ghost sm" onClick={onCancel}>Cancel</button>
        <span style={{ flex: 1 }} />
        <button className="adm-btn ghost sm" disabled={!cam} onClick={() => setPreview((p) => !p)}>{preview ? "Hide preview" : "Preview"}</button>
        <button className="adm-btn sm" disabled={!cam} onClick={() => onSave(e)}>{cam ? "Done" : "Fill in name, coordinates & ID"}</button>
      </div>
    </div>
  );
}

export default function CamsPage({ cfg, setCfg }) {
  const camCfg = cfg.cams || { disabled: [], custom: [] };
  const disabled = new Set(camCfg.disabled || []);
  const custom = camCfg.custom || [];
  const setCams = (next) => setCfg((c) => ({ ...c, cams: { disabled: [...disabled], custom, ...next } }));
  const [lake, setLake] = useState(LAKES[0]);
  const [stat, setStat] = useState({}); // lake -> { busy, status }
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const toggleBuiltin = (name, on) => {
    const d = new Set(disabled);
    if (on) d.delete(name); else d.add(name);
    setCams({ disabled: [...d] });
  };
  const saveCustom = (idx, entry) => {
    setCams({ custom: idx == null ? [...custom, entry] : custom.map((c, i) => (i === idx ? entry : c)) });
    setEditing(null); setAdding(false);
  };
  const removeCustom = (idx) => { setCams({ custom: custom.filter((_, i) => i !== idx) }); setEditing(null); };

  // Live check against the SAVED config (the endpoint spot pages use, cache bypassed).
  const check = async () => {
    setStat((s) => ({ ...s, [lake]: { busy: true, status: s[lake]?.status } }));
    try {
      const r = await fetch(`/marine/cams?lake=${encodeURIComponent(lake)}&fresh=1`);
      const d = await r.json();
      setStat((s) => ({ ...s, [lake]: { busy: false, status: d.status || {} } }));
    } catch {
      setStat((s) => ({ ...s, [lake]: { busy: false, status: s[lake]?.status } }));
    }
  };

  const builtIns = CAMS.filter((c) => (c.lake || "Lake Erie") === lake);
  const customHere = custom.map((e, i) => [e, i]).filter(([e]) => (e.lake || "Lake Erie") === lake);
  const s = stat[lake];
  const count = (l) => CAMS.filter((c) => (c.lake || "Lake Erie") === l).length + custom.filter((c) => (c.lake || "Lake Erie") === l).length;

  const row = (cam, extra, key) => {
    const st = s?.status?.[cam.name];
    const open = preview === cam.name;
    return (
      <div key={key} className="adm-camwrap">
        <div className={`adm-row${disabled.has(cam.name) ? " off" : ""}`}>
          <span className={`adm-dot ${st || "unknown"}`} title={st || "unchecked"} />
          <div className="adm-row-main">
            <div className="adm-row-title">{cam.name}</div>
            <div className="adm-row-sub">{camKindLabelOf(cam)}</div>
          </div>
          <button className="adm-btn ghost sm" onClick={() => setPreview(open ? null : cam.name)}>{open ? "Hide" : "Preview"}</button>
          {extra}
        </div>
        {open && <CamPreview cam={cam} />}
      </div>
    );
  };

  return (
    <>
      <PageHead title="Live cams" sub="Every feed the site can show. Spot pages pick the nearest ones automatically. Switch off a dead feed to hide it; add your own.">
        <button className="adm-btn" onClick={() => { setAdding(true); setEditing(null); }}><Icon name="plus" /> Add a cam</button>
      </PageHead>
      <div className="adm-tabs" role="tablist">
        {LAKES.map((l) => (
          <button key={l} role="tab" aria-selected={lake === l} className={lake === l ? "on" : ""} onClick={() => { setLake(l); setPreview(null); }}>
            {l.replace("Lake ", "")} <span>{count(l)}</span>
          </button>
        ))}
      </div>
      {adding && <Panel title="New cam"><CamEditor initial={{ ...blankCustomCam(), lake }} onSave={(entry) => saveCustom(null, entry)} onCancel={() => setAdding(false)} /></Panel>}
      <Panel title={lake} sub="Green = live, red = offline, gray = can't verify (YouTube blocks server checks). Checks run against the saved list, so save first."
        actions={<button className="adm-btn ghost sm" disabled={s?.busy} onClick={check}><Icon name="refresh" /> {s?.busy ? "Checking…" : "Check now"}</button>}>
        <div className="adm-table">
          {builtIns.map((cam) => row(cam, (
            <Switch checked={!disabled.has(cam.name)} onChange={(on) => toggleBuiltin(cam.name, on)} label="" />
          ), cam.name))}
          {customHere.map(([e, i]) => editing === i ? (
            <CamEditor key={`edit-${i}`} initial={e} onSave={(entry) => saveCustom(i, entry)} onCancel={() => setEditing(null)} />
          ) : row(normalizeCustomCam(e) || { name: e.name || `Custom cam ${i + 1}` }, (
            <>
              <Badge tone="info">custom</Badge>
              <button className="adm-btn ghost sm" onClick={() => { setEditing(i); setAdding(false); }}>Edit</button>
              <button className="adm-btn ghost sm danger" onClick={() => removeCustom(i)} aria-label="Remove cam"><Icon name="trash" /></button>
            </>
          ), `c${i}`))}
          {!builtIns.length && !customHere.length && <div className="adm-empty">No cams on {lake} yet.</div>}
        </div>
      </Panel>
    </>
  );
}
