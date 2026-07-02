// Canonical wave formatting — the height and the time between waves always
// travel together, everywhere waves appear: "2.5 ft @ 4s".
export const fmtWaves = (ft, sec) => (ft == null ? "—" : `${ft} ft${sec ? ` @ ${sec}s` : ""}`);

// Qualitative ride feel from height : period. Great Lakes rule of thumb:
// period (s) ≤ 2× height (ft) = steep, punishing chop; ≥ 3× = easy rollers.
export function waveFeel(ft, sec) {
  if (ft == null || sec == null || ft < 0.5) return null;
  if (sec <= ft * 2) return { word: "steep chop", cls: "rough" };
  if (sec >= ft * 3) return { word: "long rollers", cls: "easy" };
  return { word: "moderate chop", cls: "mid" };
}
