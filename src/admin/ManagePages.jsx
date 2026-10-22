import React, { useEffect, useState } from "react";
import { PageHead, Panel, Field, Switch, Badge, Check, Empty, ErrorLine, RefreshButton, Icon, fmtDate, postJSON, useAdminFetch } from "./ui.jsx";

// ── Users ────────────────────────────────────────────────────────────────────
function UserDetail({ email, onBack, onChanged }) {
  const [u, setU] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/user?email=${encodeURIComponent(email)}`).then((r) => r.json().then((d) => [r, d]))
      .then(([r, d]) => { if (!alive) return; if (!r.ok) setErr(d.error || "Could not load user."); else setU(d.user); })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [email]);
  const act = async (body, after) => {
    setBusy(true); setErr(""); setMsg("");
    try { const d = await postJSON("/api/admin/user", { email, ...body }); after(d); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const p = (u && u.prefs) || {};
  return (
    <Panel title={email} actions={<button className="adm-btn ghost sm" onClick={onBack}><Icon name="back" /> All users</button>}>
      <ErrorLine err={err} />
      {!u ? <div className="adm-skeleton" style={{ height: 160 }} /> : (
        <div className="adm-grid2">
          <div>
            <div className="adm-kv"><span>Member since</span><b>{fmtDate(u.created)}</b></div>
            <div className="adm-kv"><span>Sign-in</span><b>{u.via === "google" ? "Google" : "Email & password"}</b></div>
            <div className="adm-kv"><span>Plan</span><b>{u.adFree ? "Ad-free" : "Free"}</b></div>
            <div className="adm-kv"><span>Stripe</span><b>{u.hasSubscription ? "Active subscription" : u.hasStripeCustomer ? "Customer, no active sub" : "—"}</b></div>
            <div className="adm-kv"><span>Boat</span><b>{p.boatName || p.boatType || "—"}</b></div>
            <div className="adm-kv"><span>Comfort limits</span><b>{[p.maxWaveFt != null ? `${p.maxWaveFt} ft` : null, p.maxWindKt != null ? `${p.maxWindKt} kt` : null].filter(Boolean).join(" · ") || "—"}</b></div>
            <div className="adm-kv"><span>Saved ports</span><b>{(u.favoriteSpots || []).length}</b></div>
          </div>
          <div className="adm-stack">
            <Switch checked={u.adFree} disabled={busy} label="Ad-free"
              sub="Manual override. Doesn't start or cancel Stripe billing."
              onChange={(v) => act({ adFree: v }, (d) => { setU(d.user); onChanged(d.user); })} />
            <div className="adm-actions">
              <button className="adm-btn ghost sm" disabled={busy || u.via === "google"}
                onClick={() => act({ action: "sendReset" }, (d) => setMsg(d.emailSent ? "Reset link emailed." : `Logged, but not emailed (${d.emailError || "BREVO_API_KEY not set"}).`))}>
                Email a password reset
              </button>
            </div>
            {u.via === "google" && <p className="adm-muted">Google account, so there's no password to reset.</p>}
            {msg && <p className="adm-ok">{msg}</p>}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function UsersPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(null);
  const list = useAdminFetch(`/api/admin/users?q=${encodeURIComponent(query)}`, (d) => d.users);
  const [rows, setRows] = useState(null);
  useEffect(() => { if (list.data) setRows(list.data); }, [list.data]);

  if (sel) return (
    <>
      <PageHead title="Users" />
      <UserDetail email={sel} onBack={() => setSel(null)} onChanged={(u) => setRows((rs) => rs && rs.map((r) => (r.email === u.email ? { ...r, adFree: u.adFree } : r)))} />
    </>
  );
  return (
    <>
      <PageHead title="Users" sub="Search accounts, grant ad-free, send password resets." />
      <Panel>
        <form className="adm-search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
          <Icon name="search" />
          <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email. Leave blank for recent accounts" aria-label="Search users" />
          <button className="adm-btn sm" type="submit">Search</button>
        </form>
        <ErrorLine err={list.err} />
        {list.loading && !rows && <div className="adm-skeleton" style={{ height: 200 }} />}
        {rows && !rows.length && <Empty>No users match.</Empty>}
        {rows && rows.length > 0 && (
          <div className="adm-table">
            <div className="adm-row adm-row-head"><span className="adm-row-main">Account</span><span>Joined</span><span>Plan</span></div>
            {rows.map((u) => (
              <button key={u.email} className="adm-row adm-row-btn" onClick={() => setSel(u.email)}>
                <div className="adm-row-main">
                  <div className="adm-row-title">{u.email}</div>
                  <div className="adm-row-sub">{u.via === "google" ? "Google" : "Email"}{u.boatType ? ` · ${u.boatType}` : ""}{u.favorites ? ` · ${u.favorites} saved` : ""}</div>
                </div>
                <span className="adm-muted">{fmtDate(u.created)}</span>
                <Badge tone={u.adFree ? "ok" : "neutral"}>{u.adFree ? (u.hasSubscription ? "Paid" : "Ad-free") : "Free"}</Badge>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

// ── Built pages ──────────────────────────────────────────────────────────────
export function BuiltPagesPage({ onCount }) {
  const list = useAdminFetch("/api/admin/built-spots", (d) => d.spots);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("review");
  useEffect(() => { if (list.data) onCount(list.data.filter((b) => !b.featured && !b.disabled).length); }, [list.data]);
  const act = async (slug, action) => {
    if (action === "delete" && !window.confirm("Delete this page for good?")) return;
    setBusy(slug + action); setErr("");
    try { await postJSON("/api/admin/built-spot", { slug, action }); await list.reload(); } catch (e) { setErr(e.message); } finally { setBusy(""); }
  };
  const all = list.data || [];
  const groups = {
    review: all.filter((b) => !b.featured && !b.disabled),
    featured: all.filter((b) => b.featured && !b.disabled),
    disabled: all.filter((b) => b.disabled),
  };
  const shown = groups[filter];
  return (
    <>
      <PageHead title="Built pages" sub="Pages visitors built for their own spots. Feature one to index it and list it in the directory. Un-featured pages work by direct link but stay out of search.">
        <RefreshButton onClick={list.reload} busy={list.loading} />
      </PageHead>
      <div className="adm-tabs">
        {[["review", "To review"], ["featured", "Featured"], ["disabled", "Disabled"]].map(([k, l]) => (
          <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l} <span>{groups[k].length}</span></button>
        ))}
      </div>
      <Panel>
        <ErrorLine err={list.err || err} />
        {list.data && !shown.length && <Empty>Nothing here.</Empty>}
        <div className="adm-table">
          {shown.map((b) => (
            <div className="adm-row" key={b.slug}>
              <div className="adm-row-main">
                <div className="adm-row-title"><a href={`/spot/${b.slug}`} target="_blank" rel="noopener noreferrer">{b.name} <Icon name="external" size={12} /></a></div>
                <div className="adm-row-sub">{b.lake}{b.zone ? ` · ${b.zone}` : ""} · {fmtDate(b.createdAt)}</div>
              </div>
              <div className="adm-actions">
                {!b.disabled && <button className="adm-btn sm" disabled={!!busy} onClick={() => act(b.slug, b.featured ? "unfeature" : "feature")}>{b.featured ? "Unfeature" : "Feature"}</button>}
                <button className="adm-btn ghost sm" disabled={!!busy} onClick={() => act(b.slug, b.disabled ? "enable" : "disable")}>{b.disabled ? "Enable" : "Disable"}</button>
                <button className="adm-btn ghost sm danger" disabled={!!busy} onClick={() => act(b.slug, "delete")} aria-label="Delete"><Icon name="trash" /></button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

// ── Inbox: location requests, cam suggestions, email log ────────────────────
function Feed({ f, render, empty }) {
  return (
    <>
      <div className="adm-feed-tools"><RefreshButton onClick={f.reload} busy={f.loading} /></div>
      <ErrorLine err={f.err} />
      {f.data && !f.data.length && <Empty>{empty}</Empty>}
      <div className="adm-table">{(f.data || []).map(render)}</div>
    </>
  );
}
const LinkLine = ({ href }) => href ? <div className="adm-row-sub"><a href={href} target="_blank" rel="noopener noreferrer nofollow">{href}</a></div> : null;

export function InboxPage({ onCount }) {
  const [tab, setTab] = useState("locations");
  const loc = useAdminFetch("/api/admin/location-requests", (d) => d.requests);
  const cam = useAdminFetch("/api/admin/cam-requests", (d) => d.requests);
  const mail = useAdminFetch("/api/admin/notifications", (d) => d.notifications);
  useEffect(() => { if (loc.data && cam.data) onCount(loc.data.length + cam.data.length); }, [loc.data, cam.data]);
  const tabs = [["locations", "Location requests", loc.data?.length], ["cams", "Cam suggestions", cam.data?.length], ["email", "Email log"]];
  return (
    <>
      <PageHead title="Inbox" sub="What boaters are asking for, and every email the site has sent." />
      <div className="adm-tabs">
        {tabs.map(([k, l, n]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}{n != null && <span>{n}</span>}</button>)}
      </div>
      <Panel>
        {tab === "locations" && (
          <Feed f={loc} empty="No location requests yet."
            render={(r, i) => (
              <div className="adm-row adm-row-top" key={i}>
                <div className="adm-row-main">
                  <div className="adm-row-title">{r.location}</div>
                  <div className="adm-row-sub">{r.email || "anonymous"}{r.note ? ` · ${r.note}` : ""}</div>
                  <LinkLine href={r.webcam} />
                </div>
                <span className="adm-muted">{fmtDate(r.at)}</span>
              </div>
            )} />
        )}
        {tab === "cams" && (
          <Feed f={cam} empty="No cam suggestions yet."
            render={(r, i) => (
              <div className="adm-row adm-row-top" key={i}>
                <div className="adm-row-main">
                  <div className="adm-row-title">{r.spot}</div>
                  <div className="adm-row-sub">{r.email || "anonymous"}{r.note ? ` · ${r.note}` : ""}{r.current ? ` · was showing ${r.current}` : ""}</div>
                  <LinkLine href={r.webcam} />
                </div>
                <span className="adm-muted">{fmtDate(r.at)}</span>
              </div>
            )} />
        )}
        {tab === "email" && (
          <Feed f={mail} empty="No emails yet."
            render={(n, i) => (
              <div className="adm-row adm-row-top" key={i}>
                <div className="adm-row-main">
                  <div className="adm-row-title">{n.type.replace(/_/g, " ")}</div>
                  <div className="adm-row-sub">{n.email || ""}{!n.emailSent && n.emailError ? ` · ${n.emailError}` : ""}</div>
                </div>
                <Badge tone={n.emailSent ? "ok" : "warn"}>{n.emailSent ? "sent" : "logged only"}</Badge>
                <span className="adm-muted">{fmtDate(n.timestamp)}</span>
              </div>
            )} />
        )}
      </Panel>
    </>
  );
}

// ── System: recipients, integrations, CSP ───────────────────────────────────
export function SystemPage({ cfg, setCfg }) {
  const billing = useAdminFetch("/api/billing-status");
  const csp = useAdminFetch("/api/admin/csp-reports", (d) => d.reports);
  const b = billing.data;
  const [emails, setEmails] = useState((cfg.notifyEmails || []).join(", "));
  return (
    <>
      <PageHead title="Settings" sub="Who gets notified, and whether the Worker's integrations are configured." />
      <div className="adm-grid2">
        <Panel title="Admin notifications" sub="Emailed on new signups and other site events. Blank sends to the owner account.">
          <Field label="Recipients" hint="comma-separated">
            <input className="adm-input" value={emails} placeholder="you@example.com, ops@example.com"
              onChange={(e) => { setEmails(e.target.value); setCfg((c) => ({ ...c, notifyEmails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })); }} />
          </Field>
        </Panel>
        <Panel title="Integrations" sub="Secrets live in Cloudflare → Worker → Settings → Variables and Secrets." actions={<RefreshButton onClick={billing.reload} busy={billing.loading} />}>
          <ErrorLine err={billing.err} />
          {b && (
            <div className="adm-checks">
              <Check state={b.email?.present ? "ok" : "warn"} title="Email delivery (Brevo)">{b.email?.present ? "BREVO_API_KEY set." : "BREVO_API_KEY missing: no welcome, reset or alert emails go out."}</Check>
              <Check state={b.secretKey?.present ? "ok" : "bad"} title={`Stripe secret key${b.secretKey?.present ? ` · ${b.secretKey.mode} mode` : ""}`}>{b.secretKey?.present ? null : "STRIPE_SECRET_KEY missing: the ad-free plan can't be purchased."}</Check>
              <Check state={b.webhookSecret?.present ? "ok" : "bad"} title="Stripe webhook secret">{b.webhookSecret?.present ? null : "Without it, paid subscriptions never flip accounts to ad-free."}</Check>
              {b.price && (
                <Check state={b.price.resolved && b.price.active ? "ok" : "bad"} title={`Ad-free price ${b.priceId}`}>
                  {b.price.resolved ? `${(b.price.amount / 100).toFixed(2)} ${String(b.price.currency).toUpperCase()} / ${b.price.interval}${b.price.active ? "" : " · INACTIVE"}` : b.price.error}
                </Check>
              )}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Content-Security-Policy reports" sub="What a stricter CSP would block. Nothing is blocked yet; use this to tighten the allowlist before enforcing."
        actions={<RefreshButton onClick={csp.reload} busy={csp.loading} />}>
        <ErrorLine err={csp.err} />
        {csp.data && !csp.data.length && <Empty>No violations reported.</Empty>}
        <div className="adm-table">
          {(csp.data || []).slice(0, 50).map((r, i) => (
            <div className="adm-row" key={i}>
              <div className="adm-row-main"><div className="adm-row-title mono">{r.directive}</div><div className="adm-row-sub mono">{r.blocked || "inline"}</div></div>
              <span className="adm-muted">{fmtDate(r.timestamp)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
