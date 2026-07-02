import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Password policy (mirrors the server): 8+ chars with a letter, number, and
// special character. Returns an error string, or "" if acceptable.
export function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Add a letter.";
  if (!/[0-9]/.test(pw)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Add a special character (e.g. ! ? @ # $).";
  return "";
}

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
    if (!r.ok) { const e = new Error(d.error || "Something went wrong."); e.data = d; e.status = r.status; throw e; }
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
    register: async (email, password, spot) => await post("/auth/register", { email, password, spot }), // returns {pending}; verify link returns to `spot`
    setEmailOptOut: async (optOut) => { const d = await post("/api/email-optout", { optOut }); setUser(d.user); },
    verifyEmail: async (token) => { const d = await post("/auth/verify", { token }); setUser(d.user); return d; },
    resendVerification: async (email) => { await post("/auth/resend-verification", { email }); },
    forgotPassword: async (email) => { await post("/auth/forgot", { email }); },
    resetPassword: async (token, password) => { const d = await post("/auth/reset", { token, password }); setUser(d.user); },
    logout: async () => { await post("/auth/logout"); setUser(null); },
    deleteAccount: async (email) => { await post("/api/delete-account", { email }); setUser(null); },
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

const clearAuthParams = () => {
  try {
    const u = new URL(window.location.href);
    let changed = false;
    for (const p of ["reset", "verify"]) if (u.searchParams.has(p)) { u.searchParams.delete(p); changed = true; }
    if (changed) window.history.replaceState({}, "", u);
  } catch (e) {}
};

export function AuthModal({ auth, onClose, initialMode = "login", resetToken = "", verifyToken = "", spotId = "" }) {
  const [mode, setMode] = useState(initialMode); // login | register | forgot | reset | verify
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState(""); // confirm password (register + reset)
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false); // forgot: reset link sent
  const [registered, setRegistered] = useState(""); // email we just sent a verify link to
  const [needsVerify, setNeedsVerify] = useState(""); // login blocked: email needing verification
  const [resent, setResent] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false); // verify link confirmed
  const close = () => { clearAuthParams(); onClose(); };

  // Email-verification link (?verify=token): confirm on open.
  useEffect(() => {
    if (mode !== "verify" || !verifyToken) return;
    let cancelled = false;
    setBusy(true); setErr("");
    auth.verifyEmail(verifyToken)
      .then(() => { if (!cancelled) setVerifyDone(true); })
      .catch((ex) => { if (!cancelled) setErr(ex.message || "Verification failed."); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [mode, verifyToken]);

  const resend = async () => {
    setErr("");
    try { await auth.resendVerification(needsVerify || registered || email); setResent(true); }
    catch (ex) { setErr(ex.message); }
  };
  const submit = async (e) => {
    e.preventDefault();
    // Client-side password rules for the two flows that set a new password.
    if (mode === "register" || mode === "reset") {
      const p = passwordProblem(pw);
      if (p) { setErr(p); return; }
      if (pw !== pw2) { setErr("Passwords don't match."); return; }
    }
    setErr(""); setBusy(true);
    try {
      if (mode === "login") {
        try { await auth.login(email, pw); close(); }
        catch (ex) { if (ex.data?.needsVerification) { setNeedsVerify(ex.data.email || email); setResent(false); } else throw ex; }
      }
      else if (mode === "register") { const d = await auth.register(email, pw, spotId || undefined); setRegistered(d.email || email); }
      else if (mode === "forgot") { await auth.forgotPassword(email); setSent(true); }
      else if (mode === "reset") { await auth.resetPassword(resetToken, pw); close(); }
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  const title = { login: "Sign in", register: "Create account", forgot: "Reset your password", reset: "Set a new password", verify: "Confirm your email" }[mode];
  const social = (mode === "login" || mode === "register") && !needsVerify && !registered;
  // Portal to <body>: the header has a backdrop-filter, which would otherwise
  // make this position:fixed modal anchor to the header box instead of the viewport.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={close} aria-label="Close">×</button>
        <h2>{title}</h2>
        {social && <p className="modal-sub">Save your spots & preferences across devices.</p>}
        {mode === "forgot" && !sent && <p className="modal-sub">Enter your email and we'll send a reset link.</p>}
        {mode === "reset" && <p className="modal-sub">Choose a new password for your account.</p>}

        {social && (
          <>
            <a className="gbtn" href="/auth/google">
              <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#4285F4" d="M45 24c0-1.6-.1-2.8-.4-4H24v7.6h11.9c-.2 1.9-1.5 4.8-4.4 6.8l6.7 5.2C42.3 36 45 30.6 45 24z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.7-5.2c-1.8 1.3-4.3 2.2-7.8 2.2-6 0-11-4-12.8-9.5l-7 5.4C7.9 40.9 15.3 46 24 46z"/><path fill="#FBBC05" d="M11.2 28.2C10.8 27 10.5 25.5 10.5 24s.3-3 .7-4.2l-7-5.4C2.8 17.3 2 20.5 2 24s.8 6.7 2.2 9.6l7-5.4z"/><path fill="#EA4335" d="M24 10.5c3.4 0 5.7 1.5 7 2.7l5.9-5.7C33.4 4.1 29.4 2 24 2 15.3 2 7.9 7.1 4.2 14.4l7 5.4C13 14.5 18 10.5 24 10.5z"/></svg>
              Continue with Google
            </a>
            <div className="modal-or"><span>or</span></div>
          </>
        )}

        {mode === "verify" ? (
          verifyDone ? (
            <>
              <p className="modal-sub">Your email is confirmed — you're signed in. 🎉</p>
              <button className="cbtn modal-submit" onClick={close}>Continue</button>
            </>
          ) : busy ? (
            <p className="modal-sub">Confirming your email…</p>
          ) : (
            <>
              {err && <div className="modal-err">{err}</div>}
              <p className="modal-sub">That link didn't work — it may have expired. Enter your email to get a fresh one.</p>
              <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              {resent ? <p className="modal-sub">Sent — check your inbox.</p> : <button className="cbtn modal-submit" onClick={resend} disabled={!email}>Resend verification</button>}
            </>
          )
        ) : registered ? (
          <>
            <p className="modal-sub">Almost there — we sent a confirmation link to <b>{registered}</b>. Click it to activate your account, then sign in. (Check spam if you don't see it.)</p>
            {err && <div className="modal-err">{err}</div>}
            {resent ? <p className="modal-sub">Sent again ✓</p> : <button className="linklike" onClick={resend}>Resend email</button>}
          </>
        ) : needsVerify ? (
          <>
            <p className="modal-sub">Please confirm your email first. We sent a link to <b>{needsVerify}</b> when you signed up.</p>
            {err && <div className="modal-err">{err}</div>}
            {resent ? <p className="modal-sub">A fresh link is on its way ✓</p> : <button className="cbtn modal-submit" onClick={resend}>Resend verification email</button>}
          </>
        ) : mode === "forgot" && sent ? (
          <p className="modal-sub">If an account exists for that email, a reset link is on its way. Check your inbox (and spam).</p>
        ) : (
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            )}
            {(mode === "login" || mode === "register" || mode === "reset") && (
              <input className="field" type="password" placeholder={mode === "login" ? "Password" : "Password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            )}
            {(mode === "register" || mode === "reset") && (
              <>
                <input className="field" type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
                <p className="modal-hint">
                  {pw2 && pw !== pw2
                    ? <span className="modal-hint-bad">Passwords don't match.</span>
                    : (passwordProblem(pw)
                        ? <>At least 8 characters, with a letter, a number, and a special character.</>
                        : <span className="modal-hint-ok">Strong password ✓</span>)}
                </p>
              </>
            )}
            {err && <div className="modal-err">{err}</div>}
            <button className="cbtn modal-submit" type="submit" disabled={busy}>
              {busy ? "…" : { login: "Sign in", register: "Create account", forgot: "Send reset link", reset: "Set new password" }[mode]}
            </button>
          </form>
        )}

        <div className="modal-switch">
          {mode === "login" && !needsVerify && <>
            <button onClick={() => { setErr(""); setMode("forgot"); setSent(false); }}>Forgot password?</button>
            <span style={{ margin: "0 6px", color: "var(--text-faint)" }}>·</span>
            No account? <button onClick={() => { setErr(""); setMode("register"); }}>Create one</button>
          </>}
          {mode === "register" && !registered && <>Have an account? <button onClick={() => { setErr(""); setMode("login"); }}>Sign in</button></>}
          {(needsVerify || registered) && <button onClick={() => { setErr(""); setResent(false); setNeedsVerify(""); setRegistered(""); setMode("login"); }}>Back to sign in</button>}
          {(mode === "forgot" || mode === "reset") && <button onClick={() => { setErr(""); setSent(false); setMode("login"); }}>Back to sign in</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}

const IconGear = () => (
  <svg className="acct-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15z" />
  </svg>
);
const IconSignOut = () => (
  <svg className="acct-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export function Account({ auth }) {
  const [modal, setModal] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [billErr, setBillErr] = useState("");
  const doBilling = async (fn) => {
    setBusy(true); setBillErr("");
    try { await fn(); } catch (e) { setBillErr(e.message); setBusy(false); } // success redirects away
  };
  useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);

  if (!auth.available || auth.user === undefined) return null; // accounts off or still loading
  if (!auth.user) {
    // The business goal is the signup — lead with it; sign-in lives inside the modal.
    return (
      <>
        <button className="signin-btn" onClick={() => setModal(true)}>Sign up free</button>
        {modal && <AuthModal auth={auth} initialMode="register" onClose={() => setModal(false)} />}
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
        <div className="acct-menu" role="menu">
          <div className="acct-menu-head">
            <span className="acct-avatar lg">{initial}</span>
            <div className="acct-menu-id">
              <div className="acct-email">{auth.user.email}</div>
              <span className={`acct-pill ${auth.user.adFree ? "ok" : ""}`}>{auth.user.adFree ? "Ad-free" : "Free plan"}</span>
            </div>
          </div>
          {auth.billing && !auth.user.adFree && (
            <button className="upgrade-btn" disabled={busy} onClick={() => doBilling(auth.checkout)}>{busy ? "…" : "Go ad-free — $2.99/mo"}</button>
          )}
          {billErr && <div className="modal-err" style={{ margin: "4px 0" }}>{billErr}</div>}
          <div className="acct-menu-sep" />
          {auth.user.admin && <a className="acct-item" href="/admin" role="menuitem"><IconGear /> Site admin</a>}
          <a className="acct-item" href="/account" role="menuitem"><IconGear /> Account &amp; boat settings</a>
          <button className="acct-item" role="menuitem" onClick={() => { setMenu(false); auth.logout(); }}><IconSignOut /> Sign out</button>
        </div>
      )}
    </div>
  );
}
