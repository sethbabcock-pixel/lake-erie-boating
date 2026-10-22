import React, { useEffect, useState } from "react";
import { useAuth, AuthModal } from "./auth.jsx";
import { Icon } from "./admin/ui.jsx";
import OverviewPage from "./admin/OverviewPage.jsx";
import AdsPage from "./admin/AdsPage.jsx";
import SponsorsPage, { HomepagePage, campaignState } from "./admin/SponsorsPage.jsx";
import CamsPage from "./admin/CamsPage.jsx";
import { UsersPage, BuiltPagesPage, InboxPage, SystemPage } from "./admin/ManagePages.jsx";

// Admin console. Sections are hash-routed (#ads, #users…) so a refresh or a
// bookmarked link lands on the same page. Everything stored in the site config
// (ads, sponsors, hero, cams, recipients) is edited locally and saved with one
// button; users/pages/inbox act immediately through their own endpoints.
const NAV = [
  { id: "overview", label: "Overview", icon: "overview" },
  { group: "Revenue" },
  { id: "ads", label: "Ads", icon: "ads" },
  { id: "sponsors", label: "Sponsors", icon: "sponsors" },
  { group: "Site" },
  { id: "homepage", label: "Homepage hero", icon: "home" },
  { id: "cams", label: "Live cams", icon: "cams" },
  { id: "pages", label: "Built pages", icon: "pages", count: "pages" },
  { group: "People" },
  { id: "users", label: "Users", icon: "users" },
  { id: "inbox", label: "Inbox", icon: "inbox", count: "inbox" },
  { id: "system", label: "Settings", icon: "settings" },
];
const IDS = NAV.filter((n) => n.id).map((n) => n.id);
const routeFromHash = () => { const h = window.location.hash.slice(1); return IDS.includes(h) ? h : "overview"; };

function Gate({ title, children }) {
  return (
    <div className="adm-gate">
      <div className="adm-gate-card">
        <img src="/boat-mark-white.png" alt="" width="124" height="41" />
        <h1>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const auth = useAuth();
  const [cfg, setCfg] = useState(null);
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ok | unauth | forbidden | error
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(false);
  const [route, setRoute] = useState(routeFromHash);
  const [navOpen, setNavOpen] = useState(false);
  const [counts, setCounts] = useState({ pages: 0, inbox: 0 });

  const load = async () => {
    try {
      const r = await fetch("/api/admin/config");
      if (r.status === 401) { setStatus("unauth"); return; }
      if (r.status === 403) { const d = await r.json().catch(() => ({})); setMsg(d.error || "Forbidden."); setStatus("forbidden"); return; }
      const d = await r.json();
      setCfg(d.config); setSaved(JSON.stringify(d.config)); setStatus("ok");
    } catch { setStatus("error"); }
  };
  useEffect(() => {
    if (auth.user === undefined) return;
    if (auth.user === null) { setStatus("unauth"); return; }
    load();
  }, [auth.user]);

  // Badge counts for the sidebar, fetched once; the pages refresh them on visit.
  useEffect(() => {
    if (status !== "ok") return;
    const get = (u, f) => fetch(u).then((r) => (r.ok ? r.json() : null)).then(f).catch(() => 0);
    get("/api/admin/built-spots", (d) => (d?.spots || []).filter((b) => !b.featured && !b.disabled).length).then((n) => setCounts((c) => ({ ...c, pages: n || 0 })));
    Promise.all([get("/api/admin/location-requests", (d) => (d?.requests || []).length), get("/api/admin/cam-requests", (d) => (d?.requests || []).length)])
      .then(([a, b]) => setCounts((c) => ({ ...c, inbox: (a || 0) + (b || 0) })));
  }, [status]);

  useEffect(() => {
    const on = () => { setRoute(routeFromHash()); setNavOpen(false); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (id) => { window.location.hash = id; };

  const dirty = cfg && JSON.stringify(cfg) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async () => {
    setSaving(true); setToast("");
    try {
      const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Save failed.");
      setCfg(d.config); setSaved(JSON.stringify(d.config));
      setToast("Saved. Live on the site now.");
      setTimeout(() => setToast(""), 3500);
    } catch (e) { setToast(e.message); } finally { setSaving(false); }
  };
  const discard = () => { setCfg(JSON.parse(saved)); setToast(""); };
  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s" && dirty) { e.preventDefault(); save(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  if (status === "loading") return <Gate title="Admin"><p className="adm-muted">Loading…</p></Gate>;
  if (status === "unauth") return (
    <Gate title="Sign in to admin">
      <p>Use the owner account.</p>
      <button className="adm-btn" onClick={() => setModal(true)}>Sign in</button>
      <a className="adm-gate-back" href="/">← Back to shouldiboat.com</a>
      {modal && <AuthModal auth={auth} onClose={() => setModal(false)} />}
    </Gate>
  );
  if (status === "forbidden") return (
    <Gate title="Not authorized">
      <p>{msg || "This account isn't the admin."}</p>
      <p className="adm-muted">Signed in as {auth.user?.email}. The admin is set by the <code>ADMIN_EMAIL</code> variable on the Worker.</p>
      <a className="adm-gate-back" href="/">← Back to shouldiboat.com</a>
    </Gate>
  );
  if (status === "error" || !cfg) return <Gate title="Couldn't load admin"><button className="adm-btn" onClick={load}>Retry</button></Gate>;

  const liveSponsor = cfg.takeovers.some((t) => campaignState(t) === "live");
  const props = { cfg, setCfg, go, counts };
  const page = {
    overview: <OverviewPage {...props} />,
    ads: <AdsPage {...props} />,
    sponsors: <SponsorsPage {...props} />,
    homepage: <HomepagePage {...props} />,
    cams: <CamsPage {...props} />,
    pages: <BuiltPagesPage onCount={(n) => setCounts((c) => ({ ...c, pages: n }))} />,
    users: <UsersPage />,
    inbox: <InboxPage onCount={(n) => setCounts((c) => ({ ...c, inbox: n }))} />,
    system: <SystemPage {...props} />,
  }[route];

  return (
    <div className={`adm${navOpen ? " nav-open" : ""}`}>
      <aside className="adm-side">
        <div className="adm-brand">
          <a href="/" aria-label="shouldiboat.com home"><img src="/boat-mark-white.png" alt="" width="88" height="29" /></a>
          <div><b>shouldiboat</b><span>Admin</span></div>
          <button className="adm-navtoggle" onClick={() => setNavOpen((o) => !o)} aria-label="Menu" aria-expanded={navOpen}><Icon name={navOpen ? "x" : "menu"} size={20} /></button>
        </div>
        <nav className="adm-nav">
          {NAV.map((n, i) => n.group ? <div key={i} className="adm-nav-group">{n.group}</div> : (
            <a key={n.id} href={`#${n.id}`} className={route === n.id ? "on" : ""} aria-current={route === n.id ? "page" : undefined}>
              <Icon name={n.icon} size={17} />
              <span>{n.label}</span>
              {n.id === "sponsors" && liveSponsor && <i className="adm-nav-live" title="A sponsor is live today" />}
              {n.count && counts[n.count] > 0 && <em>{counts[n.count]}</em>}
            </a>
          ))}
        </nav>
        <div className="adm-side-foot">
          <a href="/" target="_blank" rel="noopener"><Icon name="external" size={14} /> View site</a>
          <span title={auth.user?.email}>{auth.user?.email}</span>
        </div>
      </aside>

      <main className="adm-main">
        {page}
      </main>

      <div className={`adm-savebar${dirty || toast ? " show" : ""}${toast && !dirty ? " done" : ""}`} role="status">
        {dirty ? (
          <>
            <span><i className="adm-dirty-dot" /> Unsaved changes</span>
            <button className="adm-btn ghost sm" onClick={discard} disabled={saving}>Discard</button>
            <button className="adm-btn sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          </>
        ) : <span>{toast}</span>}
        {dirty && toast && <span className="adm-error">{toast}</span>}
      </div>
    </div>
  );
}
