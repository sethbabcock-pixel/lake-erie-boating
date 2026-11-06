import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "./monetize.jsx";

// Pro plan UI, shared by the account page, the account menu and the
// starred-port limit prompt. Prices come live from Stripe via /api/plans, so
// the site never shows a price Checkout won't charge. Safety info stays free:
// Pro is convenience (no ads, more ports, smarter emails), never the verdict.

export const PRO_FEATURES = [
  { k: "ads", t: "No ads", d: "No display ads anywhere on the site." },
  { k: "ports", t: "Unlimited starred ports", d: "Free accounts can star 3." },
  { k: "go", t: "GO alerts", d: "An email the moment a starred port turns GO." },
  { k: "weekend", t: "Weekend outlook", d: "Every Thursday: Saturday and Sunday at your ports." },
];

const money = (cents, cur) =>
  cents == null ? "" : (cents / 100).toLocaleString(undefined, { style: "currency", currency: (cur || "usd").toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 });

let plansPending = null;
export function usePlans() {
  const [plans, setPlans] = useState(null); // null = loading
  useEffect(() => {
    let alive = true;
    plansPending = plansPending || fetch("/api/plans").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    plansPending.then((d) => { if (alive) setPlans((d && d.plans) || []); });
    return () => { alive = false; };
  }, []);
  return plans;
}

// "$2.99/mo" from the monthly plan, for compact buttons. Empty while loading.
export function monthlyLabel(plans) {
  const m = (plans || []).find((p) => p.id === "month");
  return m ? `${money(m.amount, m.currency)}/mo` : "";
}

function savingsPct(month, year) {
  if (!month || !year || !month.amount || !year.amount) return 0;
  return Math.round((1 - year.amount / (month.amount * 12)) * 100);
}

// Feature list + plan picker + checkout. `where` tags the analytics event.
export function ProUpsell({ auth, where, compact = false }) {
  const plans = usePlans();
  const month = (plans || []).find((p) => p.id === "month");
  const year = (plans || []).find((p) => p.id === "year");
  const [plan, setPlan] = useState("year");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const chosen = plan === "year" && year ? "year" : "month";
  const save = savingsPct(month, year);

  const go = async () => {
    track("event", "subscribe_click", { where, plan: chosen });
    setBusy(true); setErr("");
    try { await auth.checkout(chosen); } catch (e) { setErr(e.message); setBusy(false); } // success redirects away
  };

  return (
    <div className={`pro-upsell${compact ? " compact" : ""}`}>
      <ul className="pro-feats">
        {PRO_FEATURES.map((f) => (
          <li key={f.k}><span className="pro-check" aria-hidden="true">✓</span><span><b>{f.t}</b>{!compact && <> · {f.d}</>}</span></li>
        ))}
      </ul>
      {year && month && (
        <div className="pro-plans" role="radiogroup" aria-label="Billing">
          <button type="button" role="radio" aria-checked={chosen === "year"} className={`pro-plan${chosen === "year" ? " on" : ""}`} onClick={() => setPlan("year")}>
            <span className="pro-plan-name">Yearly{save > 0 && <span className="pro-save">Save {save}%</span>}</span>
            <span className="pro-plan-price">{money(year.amount, year.currency)}<small>/yr</small></span>
          </button>
          <button type="button" role="radio" aria-checked={chosen === "month"} className={`pro-plan${chosen === "month" ? " on" : ""}`} onClick={() => setPlan("month")}>
            <span className="pro-plan-name">Monthly</span>
            <span className="pro-plan-price">{money(month.amount, month.currency)}<small>/mo</small></span>
          </button>
        </div>
      )}
      <button className="cbtn pro-cta" disabled={busy || plans === null || !month} onClick={go}>
        {busy ? "…" : plans === null ? "Loading…" : !month ? "Pro is coming soon"
          : `Go Pro · ${chosen === "year" ? `${money(year.amount, year.currency)}/yr` : `${money(month.amount, month.currency)}/mo`}`}
      </button>
      <p className="pro-fine">Cancel anytime from your account. You keep Pro through the end of the period you paid for.</p>
      {err && <div className="modal-err">{err}</div>}
    </div>
  );
}

// Shown when a free member tries to star a port past the free limit.
export function UpgradeModal({ auth, reason, onClose }) {
  useEffect(() => { track("event", "pro_prompt_view", { reason }); }, [reason]);
  const limit = auth.user?.limits?.favorites || 3;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal pro-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pro-modal-title">
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <span className="pro-tag">Pro</span>
        <h2 id="pro-modal-title">Star more than {limit} ports</h2>
        <p className="modal-sub">The free plan covers {limit} starred ports. Pro covers as many as you like, plus:</p>
        <ProUpsell auth={auth} where={`modal_${reason}`} compact />
        <button className="linklike pro-later" onClick={onClose}>Not now</button>
      </div>
    </div>,
    document.body
  );
}
