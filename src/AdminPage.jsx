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

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

function StatsPanel() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const load = async (fresh) => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/stats${fresh ? "?fresh=1" : ""}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load stats.");
      setS(d.stats);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(false); }, []);

  const days = (s && s.signupsByDay) || [];
  const visitors = (s && s.visitorsByDay) || [];
  const max = Math.max(1, ...days.map((d) => d.count));
  const vmax = Math.max(1, ...visitors.map((d) => d.count));
  const cards = s ? [
    { k: "Total users", v: s.totalUsers },
    { k: "Ad-free", v: s.adFree },
    { k: "Conversion", v: `${s.conversionPct ?? 0}%` },
    { k: "Active sessions", v: s.activeSessions },
    { k: "Visitors today", v: s.visitorsToday ?? 0 },
    { k: "Visitors · 30d", v: s.visitors30 ?? 0 },
    { k: "New today", v: s.newToday },
    { k: "New · 30 days", v: s.new30d },
  ] : [];

  return (
    <section className="card acct-sec">
      <div className="card-head">
        <h2>Traffic &amp; accounts</h2>
        {s && <button className="linklike" onClick={() => load(true)}>↻ refresh</button>}
      </div>
      {err && <div className="modal-err">{err}</div>}
      {!s && !err && <p className="acct-note" style={{ marginTop: 0 }}>Loading stats…</p>}
      {s && (
        <>
          <div className="stat-cards">
            {cards.map((c) => <div className="stat-card" key={c.k}><div className="stat-card-v">{c.v}</div><div className="stat-card-k">{c.k}</div></div>)}
          </div>
          <div className="stat-chart-head">New signups · last 30 days</div>
          <div className="stat-chart" role="img" aria-label="Signups per day, last 30 days">
            {days.map((d) => (
              <div className="stat-bar-wrap" key={d.date} title={`${d.date}: ${d.count}`}>
                <div className="stat-bar" style={{ height: `${Math.round((d.count / max) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="stat-chart-x"><span>{days[0]?.date.slice(5)}</span><span>today</span></div>

          <div className="stat-chart-head" style={{ marginTop: "var(--s4)" }}>Daily visitors · last 30 days <span style={{ color: "var(--text-faint)", textTransform: "none", letterSpacing: 0, fontWeight: "var(--fw-regular)" }}>· first-party, {s.visits30 ?? 0} visits/30d</span></div>
          <div className="stat-chart" role="img" aria-label="Visitors per day, last 30 days">
            {visitors.map((d) => (
              <div className="stat-bar-wrap" key={d.date} title={`${d.date}: ${d.count}`}>
                <div className="stat-bar visitors" style={{ height: `${Math.round((d.count / vmax) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="stat-chart-x"><span>{visitors[0]?.date.slice(5)}</span><span>today</span></div>

          <p className="acct-note">
            Sign-in: <b>{s.via.google} Google</b> · <b>{s.via.password} email</b> · <b>{s.withBoat}</b> with a boat profile.
            {s.capped ? " (user counts capped at 1,000 — paginate for more.)" : ""}
          </p>
          <p className="acct-note" style={{ marginTop: 0 }}>
            Visitors are first-party &amp; cookieless (counts everyone, even cookie-decliners). For full traffic breakdowns
            (sources, geography, pages) see Google Analytics — also wired in.
          </p>
        </>
      )}
    </section>
  );
}

function UsersPanel() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [sel, setSel] = useState(null); // detailed user view
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const search = async () => {
    setBusy(true); setErr(""); setSel(null);
    try {
      const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Search failed.");
      setResults(d.users);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const open = async (email) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/admin/user?email=${encodeURIComponent(email)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load user.");
      setSel(d.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const setFlag = async (patch) => {
    if (!sel) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sel.email, ...patch }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed.");
      setSel(d.user);
      setResults((rs) => rs && rs.map((u) => (u.email === d.user.email ? { ...u, adFree: d.user.adFree } : u)));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const [resetMsg, setResetMsg] = useState("");
  const sendReset = async () => {
    if (!sel) return;
    setBusy(true); setErr(""); setResetMsg("");
    try {
      const r = await fetch("/api/admin/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: sel.email, action: "sendReset" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not send.");
      setResetMsg(d.emailSent ? "Reset link emailed ✓" : `Logged, but email not sent (${d.emailError || "RESEND_API_KEY not set"}).`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const p = (sel && sel.prefs) || {};
  return (
    <section className="card acct-sec">
      <h2>Users</h2>
      <div className="admin-upload" style={{ marginBottom: "var(--s3)" }}>
        <input className="field" value={q} placeholder="Search by email (blank = recent users)"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} />
        <button className="cbtn admin-uploadbtn" disabled={busy} onClick={search}>{busy ? "…" : "Search"}</button>
      </div>
      {err && <div className="modal-err">{err}</div>}

      {results && !sel && (
        results.length === 0 ? <p className="acct-note">No users found.</p> : (
          <div className="admin-userlist">
            {results.map((u) => (
              <button key={u.email} className="admin-userrow" onClick={() => open(u.email)}>
                <span className="admin-useremail">{u.email}</span>
                <span className={`acct-pill ${u.adFree ? "ok" : ""}`}>{u.adFree ? "Ad-free" : "Free"}</span>
              </button>
            ))}
          </div>
        )
      )}

      {sel && (
        <div className="admin-userdetail">
          <button className="linklike" onClick={() => setSel(null)}>← back to results</button>
          <div className="acct-kv"><span>Email</span><b>{sel.email}</b></div>
          <div className="acct-kv"><span>Member since</span><b>{fmtDate(sel.created)}</b></div>
          <div className="acct-kv"><span>Sign-in</span><b>{sel.via === "google" ? "Google" : "Email & password"}</b></div>
          <div className="acct-kv"><span>Plan</span><b>{sel.adFree ? "Ad-free" : "Free"}</b></div>
          <div className="acct-kv"><span>Stripe subscription</span><b>{sel.hasSubscription ? "Active sub on file" : "—"}</b></div>
          <div className="acct-kv"><span>Stripe customer</span><b>{sel.hasStripeCustomer ? "Yes" : "—"}</b></div>
          <div className="acct-kv"><span>Boat</span><b>{p.boatName || p.boatType || "—"}</b></div>
          <div className="acct-kv"><span>Comfort limits</span><b>{[p.maxWaveFt != null ? `${p.maxWaveFt} ft` : null, p.maxWindKt != null ? `${p.maxWindKt} kt` : null].filter(Boolean).join(" · ") || "—"}</b></div>
          <div className="acct-kv"><span>Favorite spots</span><b>{(sel.favoriteSpots || []).length}</b></div>

          <div className="admin-toggles">
            <label className="admin-check">
              <input type="checkbox" checked={!!sel.adFree} disabled={busy} onChange={(e) => setFlag({ adFree: e.target.checked })} />
              Ad-free (manual override)
            </label>
            <p className="acct-note" style={{ marginTop: 0 }}>Grants/revokes ad-free directly. This is a manual flag — it doesn't start or cancel Stripe billing.</p>
            <div className="acct-actions" style={{ marginTop: "var(--s3)" }}>
              <button className="cbtn ghost" disabled={busy || sel.via === "google"} onClick={sendReset}>Email password reset link</button>
              {sel.via === "google" && <span className="acct-note">Google account — no password to reset.</span>}
              {resetMsg && <span className={resetMsg.includes("✓") ? "acct-saved" : "acct-note"}>{resetMsg}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function NotificationsPanel() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const load = async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/notifications");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load.");
      setItems(d.notifications);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);
  return (
    <section className="card acct-sec">
      <div className="card-head">
        <h2>Notifications</h2>
        {items && <button className="linklike" onClick={load}>↻ refresh</button>}
      </div>
      <p className="acct-note" style={{ marginTop: 0 }}>Recent email events (signups, password resets). Logged even if email delivery is off.</p>
      {err && <div className="modal-err">{err}</div>}
      {items && items.length === 0 && <p className="acct-note">No notifications yet.</p>}
      {items && items.map((n, i) => (
        <div className="acct-kv admin-notif" key={i}>
          <span><b>{n.type}</b>{n.email ? ` · ${n.email}` : ""}</span>
          <b className={n.emailSent ? "notif-ok" : "notif-off"}>
            {n.emailSent ? "sent" : "logged"} · {fmtDate(n.timestamp)}
          </b>
        </div>
      ))}
    </section>
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
        <a className="acctpage-brand" href="/"><img className="logo" src="/boat-mark-white.png" alt="" /><span>Should I Boat? · Admin</span></a>
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
            <StatsPanel />

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

            {/* Notification recipients */}
            <section className="card acct-sec" style={{ marginTop: "var(--s5)" }}>
              <h2>Notification recipients</h2>
              <p className="acct-note" style={{ marginTop: 0 }}>Who gets emailed on new signups and other admin notices. Comma-separated. Leave blank to default to the owner account.</p>
              <Field label="Recipient emails" hint="(comma-separated)">
                <input
                  className="field"
                  value={(cfg.notifyEmails || []).join(", ")}
                  onChange={(e) => setCfg((c) => ({ ...c, notifyEmails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                  placeholder="you@example.com, ops@example.com"
                />
              </Field>
            </section>

            <UsersPanel />

            <NotificationsPanel />

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
