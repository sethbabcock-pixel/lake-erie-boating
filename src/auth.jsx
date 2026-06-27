import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Auth state + actions. user: undefined = loading, null = signed out, object = signed in.
export function useAuth() {
  const [user, setUser] = useState(undefined);
  const [available, setAvailable] = useState(false); // accounts backend (KV) configured?
  const [billing, setBilling] = useState(false); // Stripe configured?
  useEffect(() => {
    fetch("/auth/me").then(async (r) => {
      if (r.status === 503) { setAvailable(false); setUser(null); return; }
      setAvailable(true);
      const d = await r.json().catch(() => ({}));
      setBilling(!!d.billing);
      setUser(d.user || null);
    }).catch(() => setUser(null));
  }, []);
  // After returning from Stripe Checkout, re-poll a couple times so the plan
  // flips to ad-free as soon as the webhook lands.
  useEffect(() => {
    if (!/[?&]upgraded=1/.test(window.location.search)) return;
    let n = 0;
    const id = setInterval(async () => {
      n += 1;
      const d = await fetch("/auth/me").then((r) => r.json()).catch(() => null);
      if (d && d.user) setUser(d.user);
      if (n >= 4 || (d && d.user && d.user.adFree)) clearInterval(id);
    }, 2500);
    return () => clearInterval(id);
  }, []);
  const post = async (path, body) => {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Something went wrong.");
    return d;
  };
  const go = async (path) => {
    const r = await fetch(path, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (d.url) { window.location.href = d.url; return; }
    throw new Error(d.error || "Something went wrong.");
  };
  const refresh = async () => {
    const d = await fetch("/auth/me").then((r) => r.json()).catch(() => null);
    if (d) setUser(d.user || null);
  };
  return {
    user, setUser, available, billing, refresh,
    checkout: () => go("/api/checkout"),
    portal: () => go("/api/portal"),
    subscription: () => fetch("/api/subscription").then((r) => r.json()).catch(() => ({ subscription: null })),
    updateSubscription: async (action) => {
      const d = await post("/api/subscription", { action });
      return d.subscription;
    },
    login: async (email, password) => { const d = await post("/auth/login", { email, password }); setUser(d.user); },
    register: async (email, password) => { const d = await post("/auth/register", { email, password }); setUser(d.user); },
    logout: async () => { await post("/auth/logout"); setUser(null); },
    savePrefs: async (partial) => {
      try {
        const merged = { ...(user?.prefs || {}), ...partial }; // merge so one save never wipes others (spot/theme/comfort)
        const r = await fetch("/api/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefs: merged }) });
        const d = await r.json(); if (d.user) setUser(d.user);
      } catch (e) { /* ignore */ }
    },
    saveFavorites: async (favorites) => {
      try { const r = await fetch("/api/favorites", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorites }) }); const d = await r.json(); if (d.user) setUser(d.user); } catch (e) { /* ignore */ }
    },
  };
}

export function AuthModal({ auth, onClose }) {
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await (mode === "login" ? auth.login(email, pw) : auth.register(email, pw)); onClose(); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  // Portal to <body>: the header has a backdrop-filter, which would otherwise
  // make this position:fixed modal anchor to the header box instead of the
  // viewport (trapping it under the header).
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
        <p className="modal-sub">Save your spots & preferences across devices.</p>
        <a className="gbtn" href="/auth/google">
          <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#4285F4" d="M45 24c0-1.6-.1-2.8-.4-4H24v7.6h11.9c-.2 1.9-1.5 4.8-4.4 6.8l6.7 5.2C42.3 36 45 30.6 45 24z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.7-5.2c-1.8 1.3-4.3 2.2-7.8 2.2-6 0-11-4-12.8-9.5l-7 5.4C7.9 40.9 15.3 46 24 46z"/><path fill="#FBBC05" d="M11.2 28.2C10.8 27 10.5 25.5 10.5 24s.3-3 .7-4.2l-7-5.4C2.8 17.3 2 20.5 2 24s.8 6.7 2.2 9.6l7-5.4z"/><path fill="#EA4335" d="M24 10.5c3.4 0 5.7 1.5 7 2.7l5.9-5.7C33.4 4.1 29.4 2 24 2 15.3 2 7.9 7.1 4.2 14.4l7 5.4C13 14.5 18 10.5 24 10.5z"/></svg>
          Continue with Google
        </a>
        <div className="modal-or"><span>or</span></div>
        <form onSubmit={submit}>
          <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <input className="field" type="password" placeholder="Password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          {err && <div className="modal-err">{err}</div>}
          <button className="cbtn modal-submit" type="submit" disabled={busy}>{busy ? "…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="modal-switch">
          {mode === "login"
            ? <>No account? <button onClick={() => { setErr(""); setMode("register"); }}>Create one</button></>
            : <>Have an account? <button onClick={() => { setErr(""); setMode("login"); }}>Sign in</button></>}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Account({ auth }) {
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  // Local copies of the comfort limits; persisted on blur.
  const prefs = (auth.user && auth.user.prefs) || {};
  const [wave, setWave] = useState("");
  const [windkt, setWindkt] = useState("");
  const [busy, setBusy] = useState(false);
  const [billErr, setBillErr] = useState("");
  const doBilling = async (fn) => {
    setBusy(true); setBillErr("");
    try { await fn(); } catch (e) { setBillErr(e.message); setBusy(false); } // success redirects away
  };
  useEffect(() => {
    setWave(prefs.maxWaveFt ?? "");
    setWindkt(prefs.maxWindKt ?? "");
  }, [auth.user]);
  const saveComfort = () => auth.savePrefs({
    comfortMode: "custom", // a hand-tweaked limit is an override of the boat-type recommendation
    maxWaveFt: wave === "" ? null : Number(wave),
    maxWindKt: windkt === "" ? null : Number(windkt),
  });
  useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);

  if (!auth.available || auth.user === undefined) return null; // accounts off or still loading
  if (!auth.user) {
    return (
      <>
        <button className="signin-btn" onClick={() => setModal(true)}>Sign in</button>
        {modal && <AuthModal auth={auth} onClose={() => setModal(false)} />}
      </>
    );
  }
  const initial = (auth.user.email || "?")[0].toUpperCase();
  return (
    <div className="acct" ref={ref}>
      <button className="acct-btn" onClick={() => setMenu((m) => !m)} aria-label="Account">
        <span className="acct-avatar">{initial}</span>
      </button>
      {menu && (
        <div className="acct-menu">
          <div className="acct-email">{auth.user.email}</div>
          <div className="acct-plan">{auth.user.adFree ? "Ad-free ✓" : "Free plan"}</div>
          {auth.billing && (auth.user.adFree
            ? <button className="acct-item billing" disabled={busy} onClick={() => doBilling(auth.portal)}>{busy ? "…" : "Manage subscription"}</button>
            : <button className="upgrade-btn" disabled={busy} onClick={() => doBilling(auth.checkout)}>{busy ? "…" : "Go ad-free — $2.99/mo"}</button>)}
          {billErr && <div className="modal-err" style={{ margin: "4px 0" }}>{billErr}</div>}
          <div className="acct-prefs">
            <div className="acct-prefs-title">Comfort limits</div>
            <label className="acct-pref">Max waves
              <span><input type="number" min="0" step="0.5" inputMode="decimal" value={wave}
                onChange={(e) => setWave(e.target.value)} onBlur={saveComfort} placeholder="any" /> ft</span>
            </label>
            <label className="acct-pref">Max wind
              <span><input type="number" min="0" step="1" inputMode="numeric" value={windkt}
                onChange={(e) => setWindkt(e.target.value)} onBlur={saveComfort} placeholder="any" /> kt</span>
            </label>
            <div className="acct-prefs-hint">We'll flag conditions above these on the call.</div>
          </div>
          <a className="acct-item" href="/account">Account &amp; boat settings →</a>
          <button className="acct-item" onClick={() => { setMenu(false); auth.logout(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
