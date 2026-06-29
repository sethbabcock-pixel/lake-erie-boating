import React, { useEffect, useState } from "react";
import { useAuth, AuthModal } from "./auth.jsx";

const todayISO = () => new Date().toISOString().slice(0, 10);
const blankCampaign = () => ({
  id: "", sponsor: "", start: todayISO(), end: todayISO(),
  eyebrow: "Today's forecast brought to you by", headline: "", sub: "",
  cta: "Learn more", href: "", logo: "", bgImage: "",
  bg: "#304CB2", fg: "#ffffff", accent: "#f9b612", accentFg: "#11151c", hideForAdFree: false,
});

function Field({ label, hint, children }) {
  return (
    <label className="acct-field">
      <span>{label}{hint && <em> {hint}</em>}</span>
      {children}
    </label>
  );
}

// Text URL + an "Upload" button that stores the file and fills in its URL.
// kind: "image" (default) or "video".
function ImageField({ label, hint, value, onChange, kind = "image" }) {
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
    <div className="acct-field">
      <span>{label}{hint && <em> {hint}</em>}</span>
      <div className="admin-upload">
        <input className="field" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="/path, https://…, or upload →" />
        <label className="cbtn ghost admin-uploadbtn">{busy ? "Uploading…" : "Upload"}
          <input type="file" accept={isVideo ? "video/*" : "image/*"} onChange={onFile} hidden disabled={busy} />
        </label>
      </div>
      {value && !isVideo && <img className="admin-thumb" src={value} alt="" onError={(e) => { e.target.style.display = "none"; }} />}
      {value && isVideo && <video className="admin-thumb" src={value} muted loop autoPlay playsInline onError={(e) => { e.target.style.display = "none"; }} />}
      {err && <div className="modal-err" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function CampaignCard({ c, onChange, onRemove, idx }) {
  const set = (k, v) => onChange({ ...c, [k]: v });
  const liveNow = c.start && c.start <= todayISO() && todayISO() <= (c.end || c.start);
  return (
    <div className="card acct-sec admin-campaign">
      <div className="admin-camp-head">
        <h3>{c.sponsor || c.headline || `Campaign ${idx + 1}`} {liveNow && <span className="acct-badge ok">Live today</span>}</h3>
        <button className="cbtn ghost" onClick={onRemove}>Remove</button>
      </div>
      <div className="acct-field-row">
        <Field label="Sponsor name"><input className="field" value={c.sponsor} onChange={(e) => set("sponsor", e.target.value)} placeholder="Southwest Airlines" /></Field>
        <Field label="Start date"><input className="field" type="date" value={c.start} onChange={(e) => set("start", e.target.value)} /></Field>
        <Field label="End date"><input className="field" type="date" value={c.end} onChange={(e) => set("end", e.target.value)} /></Field>
      </div>
      <Field label="Eyebrow" hint="(small text above headline)"><input className="field" value={c.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></Field>
      <Field label="Headline"><input className="field" value={c.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Fly Southwest to your next lake weekend" /></Field>
      <Field label="Subtext"><input className="field" value={c.sub} onChange={(e) => set("sub", e.target.value)} /></Field>
      <div className="acct-field-row">
        <Field label="CTA button text"><input className="field" value={c.cta} onChange={(e) => set("cta", e.target.value)} placeholder="Book a flight" /></Field>
        <Field label="CTA / click URL"><input className="field" value={c.href} onChange={(e) => set("href", e.target.value)} placeholder="https://…" /></Field>
      </div>
      <div className="acct-field-row">
        <ImageField label="Sponsor logo" hint="(upload or URL)" value={c.logo} onChange={(v) => set("logo", v)} />
        <ImageField label="Hero photo" hint="(optional)" value={c.bgImage} onChange={(v) => set("bgImage", v)} />
      </div>
      <div className="acct-field-row admin-colors">
        <Field label="Background"><input className="field admin-color" type="color" value={c.bg} onChange={(e) => set("bg", e.target.value)} /></Field>
        <Field label="Text"><input className="field admin-color" type="color" value={c.fg} onChange={(e) => set("fg", e.target.value)} /></Field>
        <Field label="CTA color"><input className="field admin-color" type="color" value={c.accent} onChange={(e) => set("accent", e.target.value)} /></Field>
        <Field label="CTA text"><input className="field admin-color" type="color" value={c.accentFg} onChange={(e) => set("accentFg", e.target.value)} /></Field>
      </div>
      <label className="admin-check">
        <input type="checkbox" checked={!!c.hideForAdFree} onChange={(e) => set("hideForAdFree", e.target.checked)} />
        Hide this takeover from ad-free subscribers
      </label>
    </div>
  );
}

export default function AdminPage() {
  const auth = useAuth();
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | unauth | forbidden | error
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/admin/config");
      if (r.status === 401) { setStatus("unauth"); return; }
      if (r.status === 403) { const d = await r.json().catch(() => ({})); setMsg(d.error || "Forbidden."); setStatus("forbidden"); return; }
      const d = await r.json();
      setCfg(d.config); setStatus("ok");
    } catch { setStatus("error"); }
  };
  useEffect(() => {
    if (auth.user === undefined) return;
    if (auth.user === null) { setStatus("unauth"); return; }
    load();
  }, [auth.user]);

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed.");
      setCfg(d.config); setMsg("Saved ✓ — live on the homepage now.");
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  };

  const setHero = (k, v) => setCfg((c) => ({ ...c, hero: { ...c.hero, [k]: v } }));
  const setCampaign = (i, next) => setCfg((c) => ({ ...c, takeovers: c.takeovers.map((t, j) => (j === i ? next : t)) }));
  const addCampaign = () => setCfg((c) => ({ ...c, takeovers: [...c.takeovers, blankCampaign()] }));
  const removeCampaign = (i) => setCfg((c) => ({ ...c, takeovers: c.takeovers.filter((_, j) => j !== i) }));

  return (
    <div className="acctpage">
      <header className="acctpage-header">
        <a className="acctpage-back" href="/">← Back to site</a>
        <a className="acctpage-brand" href="/"><img className="logo" src="/boat-mark-white.png" alt="" width="26" height="26" /><span>Should I Boat? · Admin</span></a>
      </header>

      <main className="acctpage-main admin-main">
        <h1 className="acctpage-title">Site admin</h1>

        {status === "loading" && <p className="acct-note">Loading…</p>}

        {status === "unauth" && (
          <section className="card acct-sec">
            <h2>Sign in</h2>
            <p className="acct-lead">Sign in with the admin account to manage the homepage.</p>
            <button className="cbtn" onClick={() => setModal(true)}>Sign in</button>
            {modal && <AuthModal auth={auth} onClose={() => { setModal(false); }} />}
          </section>
        )}

        {status === "forbidden" && (
          <section className="card acct-sec">
            <h2>Not authorized</h2>
            <p className="acct-lead">{msg || "This account isn't the admin."}</p>
            <p className="acct-note">The admin is set by the <code>ADMIN_EMAIL</code> environment variable on the Worker.</p>
          </section>
        )}

        {status === "error" && <section className="card acct-sec"><p className="acct-lead">Couldn't load admin config. <button className="linklike" onClick={load}>Retry</button></p></section>}

        {status === "ok" && cfg && (
          <>
            {/* Hero */}
            <section className="card acct-sec">
              <h2>Homepage hero</h2>
              <p className="acct-note" style={{ marginTop: 0 }}>Shown when no sponsor takeover is running.</p>
              <ImageField label="Background image" hint="(upload a photo, or /hero-sunset.svg)" value={cfg.hero.image} onChange={(v) => setHero("image", v)} />
              <p className="acct-note" style={{ marginTop: 0 }}>Tip: a wide landscape photo works best — text sits over a darkened left edge.</p>
              <ImageField label="Background video" hint="(optional — overrides the image; muted loop. ≤12 MB upload, or a Stream/R2/hosted URL)" value={cfg.hero.video} onChange={(v) => setHero("video", v)} kind="video" />
              <p className="acct-note" style={{ marginTop: 0 }}>The image above is used as the poster/fallback (mobile data-saver & iOS Low Power won't autoplay video).</p>
              <Field label="Headline" hint="(use {spot} to insert the chosen spot)">
                <input className="field" value={cfg.hero.headline} onChange={(e) => setHero("headline", e.target.value)} />
              </Field>
              <Field label="Subtext" hint="(shown when no live verdict)">
                <input className="field" value={cfg.hero.sub} onChange={(e) => setHero("sub", e.target.value)} />
              </Field>
              <label className="admin-check">
                <input type="checkbox" checked={cfg.hero.showVerdict !== false} onChange={(e) => setHero("showVerdict", e.target.checked)} />
                Show the live GO / CAUTION / NO-GO verdict in the hero
              </label>
            </section>

            {/* Takeovers */}
            <section className="card acct-sec">
              <h2>Sponsor takeovers</h2>
              <p className="acct-note" style={{ marginTop: 0 }}>The campaign whose date range includes today takes over the homepage (full-page skin + hero). First match wins.</p>
            </section>
            {cfg.takeovers.map((c, i) => (
              <CampaignCard key={c.id || i} c={c} idx={i} onChange={(next) => setCampaign(i, next)} onRemove={() => removeCampaign(i)} />
            ))}
            <button className="cbtn ghost" onClick={addCampaign}>+ Add takeover campaign</button>

            {/* GAM */}
            <section className="card acct-sec" style={{ marginTop: "var(--s5)" }}>
              <h2>Programmatic ads (Google Ad Manager)</h2>
              <p className="acct-note" style={{ marginTop: 0 }}>Fallback takeover when no direct campaign is live. Leave blank to keep off. Hidden from ad-free subscribers.</p>
              <Field label="GAM network code" hint="(digits only)">
                <input className="field" value={cfg.gam.networkCode} onChange={(e) => setCfg((c) => ({ ...c, gam: { ...c.gam, networkCode: e.target.value } }))} placeholder="e.g. 23001234567" />
              </Field>
            </section>

            <div className="admin-savebar">
              <button className="cbtn" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
              {msg && <span className={msg.includes("✓") ? "acct-saved" : "modal-err"}>{msg}</span>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
