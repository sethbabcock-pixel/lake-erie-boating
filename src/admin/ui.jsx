import React, { useCallback, useEffect, useState } from "react";

// ── Shared admin primitives ──────────────────────────────────────────────────

// GET a JSON admin endpoint. Returns { data, err, loading, reload }.
export function useAdminFetch(url, pick = (d) => d) {
  const [state, setState] = useState({ data: null, err: "", loading: true });
  const load = useCallback(async (fresh) => {
    setState((s) => ({ ...s, loading: true, err: "" }));
    try {
      const r = await fetch(fresh ? `${url}${url.includes("?") ? "&" : "?"}fresh=1` : url);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load.");
      setState({ data: pick(d), err: "", loading: false });
    } catch (e) { setState((s) => ({ ...s, err: e.message, loading: false })); }
  }, [url]);
  useEffect(() => { load(false); }, [load]);
  return { ...state, reload: load };
}

export async function postJSON(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Request failed.");
  return d;
}

export const fmtDate = (s) => (s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
export const fmtNum = (n) => (n == null ? "—" : Number(n).toLocaleString());
export const todayISO = () => new Date().toISOString().slice(0, 10);

export function PageHead({ title, sub, children }) {
  return (
    <div className="adm-pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="adm-pagehead-actions">{children}</div>}
    </div>
  );
}

export function Panel({ title, sub, actions, children, className = "", tone }) {
  return (
    <section className={`adm-panel ${tone ? `tone-${tone}` : ""} ${className}`}>
      {(title || actions) && (
        <header className="adm-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {actions && <div className="adm-panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`adm-field${wide ? " wide" : ""}`}>
      <span className="adm-label">{label}{hint && <em>{hint}</em>}</span>
      {children}
    </label>
  );
}

export function Switch({ checked, onChange, label, sub, disabled }) {
  return (
    <label className={`adm-switch${disabled ? " disabled" : ""}`}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="adm-switch-track" aria-hidden="true"><span className="adm-switch-thumb" /></span>
      {(label || sub) && (
        <span className="adm-switch-text">
          {label && <b>{label}</b>}
          {sub && <small>{sub}</small>}
        </span>
      )}
    </label>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`adm-badge ${tone}`}>{children}</span>;
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={`adm-stat ${tone ? `tone-${tone}` : ""}`}>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{value}</div>
      {sub && <div className="adm-stat-sub">{sub}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="adm-empty">{children}</div>;
}

export function ErrorLine({ err }) {
  return err ? <div className="adm-error" role="alert">{err}</div> : null;
}

export function RefreshButton({ onClick, busy }) {
  return (
    <button className="adm-btn ghost sm" onClick={() => onClick(true)} disabled={busy}>
      <Icon name="refresh" /> {busy ? "Loading…" : "Refresh"}
    </button>
  );
}

// A status row in a checklist: ok | warn | bad | info, with a title + detail.
export function Check({ state, title, children }) {
  const glyph = { ok: "check", warn: "alert", bad: "x", info: "info", pending: "dots" }[state] || "info";
  return (
    <div className={`adm-check ${state}`}>
      <span className="adm-check-ico"><Icon name={glyph} /></span>
      <div>
        <div className="adm-check-title">{title}</div>
        {children && <div className="adm-check-detail">{children}</div>}
      </div>
    </div>
  );
}

// Daily bar chart with a hover/focus readout. data: [{date, count}].
export function Bars({ data, label, tone = "brand", height = 120 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, b) => a + b.count, 0);
  const shown = hover != null ? data[hover] : null;
  return (
    <div className="adm-chart">
      <div className="adm-chart-head">
        <span>{label}</span>
        <b>{shown ? `${shown.date.slice(5)} · ${fmtNum(shown.count)}` : `${fmtNum(total)} total`}</b>
      </div>
      <div className={`adm-bars ${tone}`} style={{ height }} role="img" aria-label={`${label}: ${total} total`}
        onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.date} className={`adm-bar-col${hover === i ? " on" : ""}`} onMouseEnter={() => setHover(i)}>
            <div className="adm-bar" style={{ height: `${Math.max(d.count ? 4 : 0, Math.round((d.count / max) * 100))}%` }} />
          </div>
        ))}
      </div>
      <div className="adm-chart-x"><span>{data[0]?.date.slice(5)}</span><span>today</span></div>
    </div>
  );
}

// Minimal monochrome icon set for the admin (currentColor strokes).
const PATHS = {
  overview: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  ads: "M3 5h18v14H3zM7 15l2.5-6L12 15M8 13h3M15 9v6m0-6h1.5a1.5 1.5 0 010 3H15",
  sponsors: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2z",
  home: "M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5",
  cams: "M15 10l5-3v10l-5-3M3 7h12v10H3z",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  pages: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6L5.5 5z",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  refresh: "M21 12a9 9 0 11-2.6-6.4M21 3v6h-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  alert: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  info: "M12 16v-4m0-4h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0z",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  back: "M19 12H5m7 7l-7-7 7-7",
  plus: "M12 5v14M5 12h14",
  trash: "M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14",
  menu: "M3 6h18M3 12h18M3 18h18",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zm10 2l-4.3-4.3",
  play: "M6 4l14 8-14 8V4z",
};
export function Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="adm-ico">
      <path d={PATHS[name] || ""} />
    </svg>
  );
}
