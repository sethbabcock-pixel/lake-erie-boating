// End-to-end check of the NWS-gridpoint data layer (the Open-Meteo
// replacement) against the real api.weather.gov. Run from GitHub Actions
// (the "Run script" workflow) — the dev sandbox has no outbound network.
//
//   node scripts/test-nws.mjs
//
// Exit 0 = all checks pass; 1 = at least one failed.
import { onRequest, fetchSummary, fetchTodayWindows } from "../functions/marine/conditions.js";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  —  ${detail}` : ""}`);
  if (!ok) failures++;
};

// Full conditions endpoint: an Eastern spot, a Central spot (tz-merge check),
// and the buoy-poor western basin.
for (const spot of ["cleveland", "chicago", "toledo"]) {
  const resp = await onRequest({ request: new Request(`https://shouldiboat.com/marine/conditions?spot=${spot}`) });
  const d = await resp.json();
  const wavesMerged = d.hourly.filter((h) => h.waveFt != null).length;
  check(`${spot}: hourly rows`, d.hourly.length >= 24, `${d.hourly.length} rows`);
  check(`${spot}: waves merged into hourly`, wavesMerged >= 12, `${wavesMerged}/${d.hourly.length} rows have waveFt`);
  const gustsMerged = d.hourly.filter((h) => h.gustKt != null).length;
  check(`${spot}: gusts merged into hourly`, gustsMerged >= 12, `${gustsMerged}/${d.hourly.length} rows have gustKt`);
  check(`${spot}: week outlook days`, d.week.length >= 5, `${d.week.length} days`);
  check(`${spot}: week has wind everywhere`, d.week.every((w) => w.windKt != null));
  check(`${spot}: week has waves`, d.week.filter((w) => w.waveFt != null).length >= 3, d.week.map((w) => `${w.date}:${w.waveFt ?? "—"}ft/${w.windKt ?? "—"}kt`).join(" "));
  check(`${spot}: sun present`, !!(d.sun && d.sun.sunrise && d.sun.sunset), `${d.sun?.sunrise} → ${d.sun?.sunset}`);
  if (d.sun?.sunrise) {
    const daylightH = (new Date(d.sun.sunset) - new Date(d.sun.sunrise)) / 36e5;
    check(`${spot}: daylight plausible`, daylightH > 8 && daylightH < 17, `${daylightH.toFixed(1)}h`);
  }
  check(`${spot}: current waves resolved`, d.waves.ft != null, `${d.waves.ft} ft (${d.waves.source})`);
  // The headline "current" wave must match the first hour of the strip when the
  // grid supplied it (source "forecast" with a grid hour-0 value), so the banner
  // never disagrees with the hour-by-hour table below it.
  if (d.waves.source === "forecast" && d.hourly[0]?.waveFt != null) {
    check(`${spot}: headline wave matches hourly strip`, d.waves.ft === d.hourly[0].waveFt,
      `headline ${d.waves.ft} ft vs strip[0] ${d.hourly[0].waveFt} ft`);
  }
  check(`${spot}: verdict computed`, ["GO", "CAUTION", "NO-GO"].includes(d.recommendation?.level), d.recommendation?.level);
}

// Homepage directory summary — every spot, "current" wind + waves from the grid.
const summary = await fetchSummary();
const withWind = summary.spots.filter((s) => s.windKt != null).length;
const withWave = summary.spots.filter((s) => s.waveFt != null).length;
check("summary: spot count", summary.spots.length >= 30, `${summary.spots.length} spots`);
check("summary: wind coverage", withWind >= summary.spots.length - 2, `${withWind}/${summary.spots.length}`);
check("summary: wave coverage ≥80%", withWave >= Math.floor(summary.spots.length * 0.8), `${withWave}/${summary.spots.length}`);
for (const s of summary.spots) {
  console.log(`   ${String(s.level ?? "—").padEnd(7)} ${String(s.windKt ?? "—").padStart(3)}kt g${String(s.gustKt ?? "—").padStart(3)} ${String(s.waveFt ?? "—").padStart(4)}ft  ${s.name}`);
}

// Digest "best GO window today" per port.
const windows = await fetchTodayWindows();
check("windows: covers every spot", Object.keys(windows).length === summary.spots.length, `${Object.keys(windows).length} entries`);
const withWin = Object.entries(windows).filter(([, w]) => w);
console.log(`   ${withWin.length} spots have a GO window today; sample: ${withWin.slice(0, 4).map(([id, w]) => `${id} ${w.from}–${w.to}`).join(", ") || "none"}`);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
