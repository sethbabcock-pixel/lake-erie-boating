import React, { useEffect, useState } from "react";
import { useAuth, AuthModal } from "./auth.jsx";
import { BOAT_TYPES, boatById, effectiveLimits } from "./boats.js";
import { track } from "./monetize.jsx";
import { ProUpsell, PlanCompare } from "./Pro.jsx";

const fmtDate = (unixSec) =>
  unixSec ? new Date(unixSec * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
const fmtMoney = (cents, cur) =>
  cents == null ? null : `${(cents / 100).toLocaleString(undefined, { style: "currency", currency: (cur || "usd").toUpperCase() })}`;

// ── Subscription card ─────────────────────────────────────────────────────────
function SubscriptionCard({ auth }) {
  const [sub, setSub] = useState(undefined); // undefined = loading, null = none
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    if (!auth.user?.adFree || !auth.user?.hasSubscription) { setSub(null); return; }
    const d = await auth.subscription();
    setSub(d.subscription || null);
    if (d.error) setErr(d.error);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [auth.user]);
  // /account#pro (the menu's "Go Pro" link): the card renders after auth loads,
  // so the browser's own hash scroll misses it.
  useEffect(() => {
    if (auth.user && window.location.hash === "#pro") document.getElementById("pro")?.scrollIntoView({ block: "start" });
  }, [auth.user]);

  const act = async (action) => {
    setBusy(true); setErr("");
    try {
      const next = await auth.updateSubscription(action);
      setSub(next);
      setConfirming(false);
      await auth.refresh();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!auth.billing) return null;

  // Free plan → Pro upsell
  if (!auth.user.adFree) {
    return (
      <section className="card acct-sec" id="pro">
        <h2>Go Pro</h2>
        <p className="acct-lead">You're on the <b>free plan</b>: every verdict, the week ahead, the daily email and NO-GO alerts, supported by ads.</p>
        <ProUpsell auth={auth} where="account_page" />
      </section>
    );
  }

  const through = sub ? fmtDate(sub.cancelAt || sub.currentPeriodEnd) : null;
  const price = sub ? fmtMoney(sub.amount, sub.currency) : null;

  return (
    <section className="card acct-sec">
      <h2>Subscription</h2>
      <div className="acct-badge ok">Pro ✓</div>

      {sub === undefined && <p className="acct-note">Loading subscription details…</p>}

      {sub && !sub.cancelAtPeriodEnd && (
        <>
          <p className="acct-lead">{price ? `Pro, ${price}/${sub.interval || "month"}` : "Pro plan"}, active.</p>
          {through && <p className="acct-note">Renews on <b>{through}</b>.</p>}
        </>
      )}

      {sub && sub.cancelAtPeriodEnd && (
        <>
          <p className="acct-lead">Your subscription is set to cancel.</p>
          <p className="acct-note acct-through">You keep Pro through <b>{through || "the end of the current period"}</b>, then your account reverts to the free plan.</p>
        </>
      )}

      {sub === null && (
        <p className="acct-note">You're on Pro, but we couldn't load the billing schedule. You can manage it in the billing portal.</p>
      )}

      <div className="acct-actions">
        {sub && !sub.cancelAtPeriodEnd && !confirming && (
          <button className="cbtn ghost" disabled={busy} onClick={() => setConfirming(true)}>Cancel subscription</button>
        )}
        {sub && !sub.cancelAtPeriodEnd && confirming && (
          <div className="acct-confirm">
            <span>Cancel Pro?{through ? ` You'll keep it through ${through}.` : ""}</span>
            <div className="acct-confirm-btns">
              <button className="cbtn" disabled={busy} onClick={() => act("cancel")}>{busy ? "…" : "Yes, cancel"}</button>
              <button className="cbtn ghost" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
            </div>
          </div>
        )}
        {sub && sub.cancelAtPeriodEnd && (
          <button className="cbtn" disabled={busy} onClick={() => act("resume")}>{busy ? "…" : "Resume subscription"}</button>
        )}
        <button className="cbtn ghost" disabled={busy} onClick={async () => { setBusy(true); setErr(""); try { await auth.portal(); } catch (e) { setErr(e.message); setBusy(false); } }}>
          Billing portal & receipts
        </button>
      </div>
      {err && <div className="modal-err" style={{ marginTop: 8 }}>{err}</div>}
    </section>
  );
}

// ── Email preferences ─────────────────────────────────────────────────────────
function EmailCard({ auth }) {
  const u = auth.user;
  const prefs = u?.prefs || {};
  const [busy, setBusy] = useState(false);
  const favCount = (u?.favorites || []).length;
  const pro = !!u?.adFree;
  const setPref = async (k, v) => { setBusy(true); try { await auth.savePrefs({ [k]: v }); } finally { setBusy(false); } };
  return (
    <section className="card acct-sec">
      <h2>Email</h2>
      {u.emailOptOut ? (
        <>
          <p className="acct-note">You've unsubscribed from non-essential email, so the daily verdict and alerts are paused. (Account &amp; security emails are always delivered.)</p>
          <button className="cbtn" disabled={busy} onClick={async () => { setBusy(true); try { await auth.setEmailOptOut(false); } finally { setBusy(false); } }}>
            {busy ? "…" : "Resubscribe"}
          </button>
        </>
      ) : (
        <>
          <label className="acct-toggle">
            <input type="checkbox" checked={!!prefs.dailyEmail} disabled={busy} onChange={(e) => setPref("dailyEmail", e.target.checked)} />
            <span><b>Daily verdict email</b>: every starred port's GO / CAUTION / NO-GO, 6am ET.</span>
          </label>
          <label className="acct-toggle">
            <input type="checkbox" checked={!!prefs.alertEmails} disabled={busy} onChange={(e) => setPref("alertEmails", e.target.checked)} />
            <span><b>NO-GO alerts</b>: a heads-up when a starred port turns rough. One per port per day, daytime only.</span>
          </label>
          <label className={`acct-toggle${pro ? "" : " locked"}`}>
            <input type="checkbox" checked={pro && !!prefs.goAlerts} disabled={busy || !pro} onChange={(e) => setPref("goAlerts", e.target.checked)} />
            <span><b>GO alerts</b> <span className="pro-tag sm">Pro</span>: an email when a starred port turns GO during the day. One per port per day.</span>
          </label>
          <label className={`acct-toggle${pro ? "" : " locked"}`}>
            <input type="checkbox" checked={pro && !!prefs.weekendEmail} disabled={busy || !pro} onChange={(e) => setPref("weekendEmail", e.target.checked)} />
            <span><b>Weekend outlook</b> <span className="pro-tag sm">Pro</span>: Saturday and Sunday at your ports, every Thursday evening.</span>
          </label>
          {!pro && <p className="acct-note"><a href="#pro">Go Pro</a> to turn on GO alerts and the weekend outlook.</p>}
          <p className="acct-note">
            {favCount
              ? `Covers your ${favCount} starred port${favCount > 1 ? "s" : ""}.`
              : "Star a port first (tap the star on any port page); these emails cover your starred ports."}
          </p>
        </>
      )}
    </section>
  );
}

// ── Boat + comfort card ───────────────────────────────────────────────────────
function BoatCard({ auth }) {
  const prefs = auth.user?.prefs || {};
  const [boatType, setBoatType] = useState("");
  const [boatName, setBoatName] = useState("");
  const [boatLength, setBoatLength] = useState("");
  const [mode, setMode] = useState("recommended"); // recommended | custom
  const [wave, setWave] = useState("");
  const [wind, setWind] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBoatType(prefs.boatType || "");
    setBoatName(prefs.boatName || "");
    setBoatLength(prefs.boatLengthFt ?? "");
    setMode(prefs.comfortMode || (prefs.boatType ? "recommended" : "custom"));
    setWave(prefs.maxWaveFt ?? "");
    setWind(prefs.maxWindKt ?? "");
    // eslint-disable-next-line
  }, [auth.user]);

  const rec = boatById(boatType);
  // What the inputs show: recommended mode mirrors the boat type; custom is editable.
  const shownWave = mode === "custom" ? wave : (rec ? rec.maxWaveFt : "");
  const shownWind = mode === "custom" ? wind : (rec ? rec.maxWindKt : "");

  const save = async () => {
    setBusy(true); setSaved(false);
    const partial = {
      boatType: boatType || null,
      boatName: boatName.trim() || null,
      boatLengthFt: boatLength === "" ? null : Number(boatLength),
      comfortMode: mode,
    };
    if (mode === "custom") {
      partial.maxWaveFt = wave === "" ? null : Number(wave);
      partial.maxWindKt = wind === "" ? null : Number(wind);
    } else {
      partial.maxWaveFt = rec ? rec.maxWaveFt : null;
      partial.maxWindKt = rec ? rec.maxWindKt : null;
    }
    await auth.savePrefs(partial);
    setBusy(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const eff = effectiveLimits({ comfortMode: mode, boatType, maxWaveFt: wave === "" ? null : Number(wave), maxWindKt: wind === "" ? null : Number(wind) });

  return (
    <section className="card acct-sec">
      <h2>Your boat</h2>
      <label className="acct-field">
        <span>Boat name <em>(optional)</em></span>
        <input className="field" type="text" maxLength={40} value={boatName} placeholder="e.g. Wet Bandit" onChange={(e) => setBoatName(e.target.value)} />
      </label>
      <div className="acct-field-row">
        <label className="acct-field">
          <span>Boat type</span>
          <select className="field" value={boatType} onChange={(e) => setBoatType(e.target.value)}>
            <option value="">Select a type…</option>
            {BOAT_TYPES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label className="acct-field acct-field-sm">
          <span>Length <em>(ft, optional)</em></span>
          <input className="field" type="number" min="0" step="1" inputMode="numeric" value={boatLength} placeholder="—" onChange={(e) => setBoatLength(e.target.value)} />
        </label>
      </div>
      {rec && (
        <p className="acct-rec">Recommended for a {rec.label.toLowerCase()}: <b>≤{rec.maxWaveFt} ft</b> waves · <b>≤{rec.maxWindKt} kt</b> wind.</p>
      )}

      <h2 style={{ marginTop: "var(--s5)" }}>Comfort conditions</h2>
      <div className="acct-modes">
        <label className={`acct-mode ${mode === "recommended" ? "on" : ""}`}>
          <input type="radio" name="cmode" checked={mode === "recommended"} onChange={() => setMode("recommended")} />
          <span>Use recommended for my boat</span>
        </label>
        <label className={`acct-mode ${mode === "custom" ? "on" : ""}`}>
          <input type="radio" name="cmode" checked={mode === "custom"} onChange={() => setMode("custom")} />
          <span>Set my own limits</span>
        </label>
      </div>
      {mode === "recommended" && !rec && (
        <p className="acct-note">Pick a boat type above to use recommended limits, or choose "Set my own limits."</p>
      )}
      <div className="acct-field-row">
        <label className="acct-field acct-field-sm">
          <span>Max waves (ft)</span>
          <input className="field" type="number" min="0" step="0.5" inputMode="decimal" value={shownWave}
            disabled={mode !== "custom"} placeholder="any" onChange={(e) => setWave(e.target.value)} />
        </label>
        <label className="acct-field acct-field-sm">
          <span>Max wind (kt)</span>
          <input className="field" type="number" min="0" step="1" inputMode="numeric" value={shownWind}
            disabled={mode !== "custom"} placeholder="any" onChange={(e) => setWind(e.target.value)} />
        </label>
      </div>
      <p className="acct-note">
        {eff.maxWaveFt == null && eff.maxWindKt == null
          ? "No limits set, so we won't add a personal comfort flag to the call."
          : <>On the main call we'll flag conditions above {eff.maxWaveFt != null ? <b>{eff.maxWaveFt} ft waves</b> : "—"}{eff.maxWaveFt != null && eff.maxWindKt != null ? " or " : ""}{eff.maxWindKt != null ? <b>{eff.maxWindKt} kt wind</b> : ""}.</>}
      </p>

      <div className="acct-actions">
        <button className="cbtn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save boat settings"}</button>
        {saved && <span className="acct-saved">Saved ✓</span>}
      </div>
    </section>
  );
}

// ── Danger zone: delete account ───────────────────────────────────────────────
function DangerZone({ auth }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const hasSub = auth.user?.adFree && auth.user?.hasSubscription;

  const del = async () => {
    setBusy(true); setErr("");
    try {
      await auth.deleteAccount(confirmEmail.trim());
      window.location.href = "/";
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <section className="card acct-sec acct-danger">
      <h2>Delete account</h2>
      <p className="acct-note">Permanently deletes your account, boat profile, and saved spots. This can't be undone.</p>
      {hasSub && (
        <p className="acct-note"><b>Heads up:</b> deleting your account cancels your Pro subscription immediately. As with any cancellation, payments already made aren't refunded.</p>
      )}
      {!open ? (
        <div className="acct-actions">
          <button className="cbtn danger" onClick={() => { setOpen(true); setErr(""); }}>Delete my account</button>
        </div>
      ) : (
        <div className="acct-confirm-block">
          <label className="acct-field">
            <span>Type your email <em>({auth.user.email})</em> to confirm</span>
            <input className="field" type="email" autoComplete="off" value={confirmEmail} placeholder={auth.user.email} onChange={(e) => setConfirmEmail(e.target.value)} />
          </label>
          {err && <div className="modal-err">{err}</div>}
          <div className="acct-confirm-btns">
            <button className="cbtn danger" disabled={busy || confirmEmail.trim().toLowerCase() !== auth.user.email} onClick={del}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button className="cbtn ghost" disabled={busy} onClick={() => { setOpen(false); setConfirmEmail(""); setErr(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const auth = useAuth();
  const [modal, setModal] = useState(false); // false | "login" | "register"
  const dark = (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : "dark") !== "light";

  const created = auth.user?.created ? new Date(auth.user.created).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;

  return (
    <div className="acctpage">
      {/* Same header as the main app (styles.css .appheader). */}
      <header className="appheader">
        <div className="appheader-inner">
          <a className="brand" href="/" aria-label="shouldiboat.com home">
            <img className="logo" width="248" height="82" src={dark ? "/boat-mark-white.png" : "/boat-mark.png"} alt="" />
            <span className="wordmark">Should I Boat</span>
          </a>
          <div className="controls">
            <a className="signin-btn ghost acctpage-back" href="/">← Back to conditions</a>
          </div>
        </div>
      </header>

      <main className="acctpage-main">
        <h1 className="acctpage-title">Your account</h1>

        {auth.user === undefined && <p className="acct-note">Loading…</p>}

        {auth.user === null && (
          <section className="card acct-sec" id="pro">
            <h2>Plans</h2>
            <p className="acct-lead">Sign in to manage your starred ports, boat profile, emails and subscription. New here? Start free.</p>
            <PlanCompare onStart={() => setModal("register")} onSignIn={() => setModal("login")} />
            {modal && <AuthModal key={modal} auth={auth} initialMode={modal} onClose={() => setModal(false)} />}
          </section>
        )}

        {auth.user && (
          <>
            <section className="card acct-sec">
              <h2>Account</h2>
              <div className="acct-kv"><span>Email</span><b>{auth.user.email}</b></div>
              <div className="acct-kv"><span>Plan</span><b>{auth.user.adFree ? "Pro" : "Free"}</b></div>
              {created && <div className="acct-kv"><span>Member since</span><b>{created}</b></div>}
              <div className="acct-kv"><span>Sign-in</span><b>{auth.user.via === "google" ? "Google" : "Email & password"}</b></div>
            </section>

            {auth.user.admin && (
              <section className="card acct-sec">
                <h2>Admin</h2>
                <p className="acct-lead">You have admin access to the site.</p>
                <a className="cbtn" href="/admin">Open site admin →</a>
              </section>
            )}

            <SubscriptionCard auth={auth} />
            <EmailCard auth={auth} />
            <BoatCard auth={auth} />
            <DangerZone auth={auth} />

            <div className="acct-actions" style={{ marginTop: "var(--s5)" }}>
              <button className="cbtn ghost" onClick={() => auth.logout().then(() => { window.location.href = "/"; })}>Sign out</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
