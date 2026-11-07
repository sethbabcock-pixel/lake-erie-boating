import React from "react";
import { IconCheck, IconAlert, IconNoGo, IconDash } from "./icons.jsx";

// One verdict treatment for the whole app: an icon + the level word, so the
// result is never conveyed by colour alone. Presentation only: it renders the
// level it is given and never derives or changes one. An unknown/missing level
// is neutral (dash, never green).
export const levelClass = (lvl) =>
  (lvl === "NO-GO" ? "nogo" : lvl === "CAUTION" ? "caution" : lvl === "GO" ? "go" : "unknown");

export function VerdictIcon({ level, size = "1em" }) {
  const c = levelClass(level);
  return c === "go" ? <IconCheck size={size} /> : c === "caution" ? <IconAlert size={size} />
    : c === "nogo" ? <IconNoGo size={size} /> : <IconDash size={size} />;
}

// text=false renders the icon only (with an sr-only label).
export default function VerdictMark({ level, text = true, label, size = "1em", className = "" }) {
  const c = levelClass(level);
  return (
    <span className={`vmark vm-${c} ${className}`.trim()}>
      <VerdictIcon level={level} size={size} />
      {text ? <span className="vm-word">{label ?? (level || "No data")}</span> : null}
      {!text && <span className="sr-only">{label ?? (level || "No data")}</span>}
    </span>
  );
}
