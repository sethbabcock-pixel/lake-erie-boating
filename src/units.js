// Canonical wave formatting — the height and the time between waves always
// travel together, everywhere waves appear: "2.5 ft @ 4s".
export const fmtWaves = (ft, sec) => (ft == null ? "—" : `${ft} ft${sec ? ` @ ${sec}s` : ""}`);

// 16-point compass → degrees (direction the wind comes FROM).
const COMPASS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
export const compassToDeg = (c) => { const i = COMPASS_16.indexOf(c); return i < 0 ? null : i * 22.5; };

// Qualitative ride feel from height : period. Great Lakes / sheltered rule of
// thumb: period (s) ≤ 2× height (ft) = steep, punishing chop; ≥ 3× = easy
// rollers. Open ocean (water === "ocean") rates by period alone: ≥ 10 s is
// swell, ≤ 6 s steep wind waves (matches the server's ocean thresholds).
export function waveFeel(ft, sec, water) {
  if (ft == null || sec == null || ft < 0.5) return null;
  if (water === "ocean") {
    if (sec <= 6) return { word: "steep seas", cls: "rough" };
    if (sec >= 10) return { word: "long swell", cls: "easy" };
    return { word: "moderate seas", cls: "mid" };
  }
  if (sec <= ft * 2) return { word: "steep chop", cls: "rough" };
  if (sec >= ft * 3) return { word: "long rollers", cls: "easy" };
  return { word: "moderate chop", cls: "mid" };
}
