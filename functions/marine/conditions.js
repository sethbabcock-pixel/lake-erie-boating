// Lake Erie marine conditions aggregator.
//
// Pulls live, authoritative NOAA data from the Cloudflare edge (which can reach
// the NOAA hosts) and folds it into a single GO / CAUTION / NO-GO call for a
// chosen launch spot between Toledo and Erie, PA.
//
// Data sources (all free, no API key):
//   - NWS API (api.weather.gov): point forecast + active marine alerts
//   - NWS nearshore marine zone forecast (text periods)
//   - NDBC realtime buoy observations (waves, wind, water temp)
//
// GET /marine/conditions?spot=sandusky
// GET /marine/conditions?spots  -> list available spots

import { CAMS, camSrc } from "../../src/cams.js";

const UA = "lake-erie-boating (seth.babcock@gmail.com)";
const NWS = "https://api.weather.gov";

// Curated launch spots. Each maps to the nearest NWS nearshore marine zone and
// the closest reporting NDBC buoy(s), ordered by preference. Buoys in Lake Erie
// are seasonal (recovered over winter), so we list fallbacks and degrade
// gracefully when none are reporting.
const SPOTS = {
  toledo: {
    name: "Toledo / Maumee Bay",
    lat: 41.694, lon: -83.32, zone: "LEZ142", buoys: ["45005", "THLO1"],
  },
  "port-clinton": {
    name: "Port Clinton / Catawba",
    lat: 41.512, lon: -82.94, zone: "LEZ143", buoys: ["45005"],
  },
  "put-in-bay": {
    name: "Put-in-Bay / South Bass Island",
    lat: 41.652, lon: -82.82, zone: "LEZ143", buoys: ["SBIO1", "45005"],
  },
  sandusky: {
    name: "Sandusky / Cedar Point",
    lat: 41.46, lon: -82.71, zone: "LEZ143", buoys: ["45005"],
  },
  vermilion: {
    name: "Vermilion / Lorain",
    lat: 41.47, lon: -82.31, zone: "LEZ144", buoys: ["45176", "45164", "45005"],
  },
  cleveland: {
    name: "Cleveland",
    lat: 41.507, lon: -81.706, zone: "LEZ146", buoys: ["45164", "45176"],
  },
  fairport: {
    name: "Fairport Harbor / Mentor",
    lat: 41.76, lon: -81.28, zone: "LEZ147", buoys: ["45207", "45164", "45167"],
  },
  conneaut: {
    name: "Conneaut / Ashtabula",
    lat: 41.96, lon: -80.55, zone: "LEZ148", buoys: ["45207", "45167"],
  },
  erie: {
    name: "Erie, PA / Presque Isle",
    lat: 42.16, lon: -80.11, zone: "LEZ149", buoys: ["45167"],
  },

  // ── Other Great Lakes (US shores). zone/office resolved from NWS; buoys
  // optional (wind from forecast, waves from Open-Meteo cover spots w/o buoys).
  rochester: { name: "Rochester", lat: 43.22, lon: -77.62, zone: "LOZ043", office: "BUF", buoys: ["45012"], lake: "Lake Ontario" },
  "sodus-bay": { name: "Sodus Bay", lat: 43.27, lon: -76.97, zone: "LOZ043", office: "BUF", buoys: ["45012"], lake: "Lake Ontario" },
  oswego: { name: "Oswego", lat: 43.47, lon: -76.51, zone: "LOZ044", office: "BUF", buoys: ["45012"], lake: "Lake Ontario" },
  "sackets-harbor": { name: "Sackets Harbor", lat: 43.94, lon: -76.12, zone: "LOZ045", office: "BUF", buoys: [], lake: "Lake Ontario" },
  olcott: { name: "Olcott / Wilson", lat: 43.34, lon: -78.72, zone: "LOZ042", office: "BUF", buoys: [], lake: "Lake Ontario" },

  "port-huron": { name: "Port Huron", lat: 42.98, lon: -82.42, zone: "LHZ443", office: "DTX", buoys: [], lake: "Lake Huron" },
  tawas: { name: "Tawas Bay", lat: 44.26, lon: -83.44, zone: "LHZ345", office: "APX", buoys: [], lake: "Lake Huron" },
  alpena: { name: "Alpena / Thunder Bay", lat: 45.06, lon: -83.42, zone: "LHZ348", office: "APX", buoys: ["45003"], lake: "Lake Huron" },
  "harbor-beach": { name: "Harbor Beach", lat: 43.84, lon: -82.64, zone: "LHZ442", office: "DTX", buoys: [], lake: "Lake Huron" },
  mackinaw: { name: "Mackinaw City / Straits", lat: 45.78, lon: -84.72, zone: "LHZ345", office: "APX", buoys: [], lake: "Lake Michigan" },

  chicago: { name: "Chicago", lat: 41.89, lon: -87.60, zone: "LMZ741", office: "LOT", buoys: ["45198"], lake: "Lake Michigan" },
  milwaukee: { name: "Milwaukee", lat: 43.03, lon: -87.88, zone: "LMZ645", office: "MKX", buoys: ["45013"], lake: "Lake Michigan" },
  muskegon: { name: "Muskegon", lat: 43.23, lon: -86.34, zone: "LMZ844", office: "GRR", buoys: ["45161"], lake: "Lake Michigan" },
  holland: { name: "Holland", lat: 42.77, lon: -86.21, zone: "LMZ846", office: "GRR", buoys: [], lake: "Lake Michigan" },
  "traverse-city": { name: "Traverse City", lat: 44.76, lon: -85.62, zone: "LMZ323", office: "APX", buoys: [], lake: "Lake Michigan" },
  sheboygan: { name: "Sheboygan", lat: 43.75, lon: -87.715, zone: "LMZ643", office: "MKX", buoys: [], lake: "Lake Michigan" },
  "michigan-city": { name: "Michigan City", lat: 41.72, lon: -86.91, zone: "LMZ046", office: "IWX", buoys: ["45198"], lake: "Lake Michigan" },
  petoskey: { name: "Petoskey", lat: 45.373, lon: -84.955, zone: "LMZ342", office: "APX", buoys: [], lake: "Lake Michigan" },
  "harbor-springs": { name: "Harbor Springs", lat: 45.431, lon: -84.992, zone: "LMZ342", office: "APX", buoys: [], lake: "Lake Michigan" },
  "cross-village": { name: "Cross Village", lat: 45.641, lon: -85.032, zone: "LMZ342", office: "APX", buoys: [], lake: "Lake Michigan" },

  duluth: { name: "Duluth", lat: 46.78, lon: -92.08, zone: "LSZ145", office: "DLH", buoys: ["45027"], lake: "Lake Superior" },
  bayfield: { name: "Bayfield / Apostle Is.", lat: 46.81, lon: -90.82, zone: "LSZ143", office: "DLH", buoys: [], lake: "Lake Superior" },
  marquette: { name: "Marquette", lat: 46.54, lon: -87.38, zone: "LSZ249", office: "MQT", buoys: ["45004"], lake: "Lake Superior" },
  houghton: { name: "Houghton / Keweenaw", lat: 47.12, lon: -88.57, zone: "LSZ267", office: "MQT", buoys: [], lake: "Lake Superior" },
  "grand-marais": { name: "Grand Marais, MN", lat: 47.75, lon: -90.33, zone: "LSZ140", office: "DLH", buoys: [], lake: "Lake Superior" },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });

async function getJSON(url, timeoutMs = 12000) {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json,application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`${url} -> ${resp.status}`);
  return resp.json();
}

async function getText(url, timeoutMs = 12000) {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) throw new Error(`${url} -> ${resp.status}`);
  return resp.text();
}

// ---- unit helpers ----
const mToFt = (m) => m * 3.28084;
const msToKt = (ms) => ms * 1.943844;
const mphToKt = (mph) => mph * 0.868976;
const cToF = (c) => (c * 9) / 5 + 32;
const round = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const isMissing = (v) => v == null || v === "MM" || v === "999" || v === "99.0" || v === "999.0";

function degToCompass(deg) {
  if (deg == null || Number.isNaN(deg)) return null;
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Parse the most recent observation from an NDBC realtime2 standard met file.
// Header columns: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
function parseBuoy(text, station) {
  const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  if (!lines.length) return null;
  const c = lines[0].trim().split(/\s+/);
  if (c.length < 15) return null;
  const num = (i) => (isMissing(c[i]) ? null : parseFloat(c[i]));

  const wvhtM = num(8);
  const wspdMs = num(6);
  const gstMs = num(7);
  const wdir = num(5);
  const wtmpC = num(14);
  const atmpC = num(13);
  const dpd = num(9);

  const obsTime = `${c[0]}-${c[1]}-${c[2]}T${c[3]}:${c[4]}:00Z`;
  return {
    station,
    observedAt: obsTime,
    ageMinutes: Math.round((Date.now() - Date.parse(obsTime)) / 60000),
    waveHeightFt: round(wvhtM == null ? null : mToFt(wvhtM)),
    waveHeightM: round(wvhtM, 2),
    dominantPeriodSec: round(dpd),
    windKt: round(wspdMs == null ? null : msToKt(wspdMs)),
    windGustKt: round(gstMs == null ? null : msToKt(gstMs)),
    windDir: degToCompass(wdir),
    windDirDeg: wdir,
    waterTempF: round(wtmpC == null ? null : cToF(wtmpC)),
    airTempF: round(atmpC == null ? null : cToF(atmpC)),
  };
}

async function fetchBuoy(buoys) {
  for (const station of buoys) {
    try {
      const text = await getText(`https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`);
      const obs = parseBuoy(text, station);
      // Skip stale (>3h) or empty observations; try the next fallback buoy.
      if (obs && obs.ageMinutes != null && obs.ageMinutes < 180) return obs;
      if (obs && obs.ageMinutes == null) return obs;
    } catch (e) {
      // try next buoy
    }
  }
  return null;
}

// One /points lookup → both the day/night forecast AND the hourly forecast.
async function fetchForecasts(lat, lon) {
  try {
    const pt = await getJSON(`${NWS}/points/${lat},${lon}`);
    const fUrl = pt?.properties?.forecast;
    const hUrl = pt?.properties?.forecastHourly;
    const [fc, hc] = await Promise.all([
      fUrl ? getJSON(fUrl).catch(() => null) : null,
      hUrl ? getJSON(hUrl).catch(() => null) : null,
    ]);
    const daily = (fc?.properties?.periods || []).slice(0, 4).map((p) => ({
      name: p.name,
      isDaytime: p.isDaytime,
      tempF: p.temperature,
      wind: `${p.windDirection || ""} ${p.windSpeed || ""}`.trim(),
      windSpeed: p.windSpeed || null,
      windDir: p.windDirection || null,
      shortForecast: p.shortForecast,
      detailed: p.detailedForecast,
      precipPct: p.probabilityOfPrecipitation?.value ?? null,
    }));
    const hourly = (hc?.properties?.periods || []).slice(0, 72).map((p) => {
      const mph = parseInt(String(p.windSpeed || "").match(/\d+/)?.[0] || "0", 10);
      return {
        time: p.startTime,
        tempF: p.temperature,
        windKt: round(mphToKt(mph), 0),
        precipPct: p.probabilityOfPrecipitation?.value ?? 0,
        short: p.shortForecast || "",
      };
    });
    return { daily, hourly };
  } catch (e) {
    return { daily: [], hourly: [] };
  }
}

// Hourly wave height (ft) keyed by "YYYY-MM-DDTHH" (local) from Open-Meteo's
// marine model — covers the whole lake incl. the buoy-poor western basin.
async function fetchMarineHourly(lat, lon) {
  try {
    const d = await getJSON(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
      `&hourly=wave_height,wave_period&forecast_days=4&timezone=America%2FNew_York`
    );
    const times = d?.hourly?.time || [];
    const wh = d?.hourly?.wave_height || [];
    const wp = d?.hourly?.wave_period || [];
    const map = {};
    for (let i = 0; i < times.length; i++) {
      map[times[i].slice(0, 13)] = {
        waveFt: wh[i] == null ? null : round(mToFt(wh[i]), 1),
        periodSec: wp[i] == null ? null : round(wp[i], 0),
      };
    }
    return map;
  } catch (e) {
    return {};
  }
}

async function fetchMarineForecast(zone) {
  try {
    const data = await getJSON(`${NWS}/zones/marine/${zone}/forecast`);
    return (data?.properties?.periods || []).slice(0, 6).map((p) => ({
      name: p.name,
      forecast: p.detailedForecast,
    }));
  } catch (e) {
    return null;
  }
}

async function fetchAlerts(lat, lon) {
  try {
    const data = await getJSON(`${NWS}/alerts/active?point=${lat},${lon}`);
    return (data?.features || []).map((f) => ({
      event: f.properties?.event,
      severity: f.properties?.severity,
      headline: f.properties?.headline,
      description: f.properties?.description,
      ends: f.properties?.ends || f.properties?.expires,
    }));
  } catch (e) {
    return null;
  }
}

// Latest official NWS Nearshore Marine Forecast (NSH) text product. This is the
// formal NOAA report boaters read — full text, all Lake Erie zones.
async function fetchNSH(office = "CLE") {
  try {
    const list = await getJSON(`${NWS}/products/types/NSH/locations/${office}`);
    const id = (list?.["@graph"] || list?.products || [])[0]?.id;
    if (!id) return null;
    const prod = await getJSON(`${NWS}/products/${id}`);
    if (!prod?.productText) return null;
    return { text: prod.productText, issued: prod.issuanceTime || null, office };
  } catch (e) {
    return null;
  }
}

// Pull a wind speed (kt) + direction from an NWS forecast period like
// "SW 10 to 15 mph" — the fallback when no buoy is reporting wind.
function parseForecastWind(period) {
  if (!period) return null;
  const nums = String(period.windSpeed || "").match(/\d+/g);
  if (!nums || !nums.length) return null;
  const mph = Math.max(...nums.map(Number));
  return { speedKt: round(mphToKt(mph)), dir: period.windDir || null, mph };
}

// Pull a wave height (ft) from NWS marine/nearshore forecast text like
// "Waves 2 to 4 feet" or "Waves 1 foot or less" — the fallback when no buoy is
// reporting waves (common in the buoy-poor western basin).
function parseForecastWaves(periods) {
  for (const p of periods || []) {
    const t = (p.forecast || p.detailed || "").toLowerCase();
    let m = t.match(/waves?\s+(\d+)\s+to\s+(\d+)\s*f(?:ee|oo)t/);
    if (m) return Math.max(+m[1], +m[2]);
    m = t.match(/waves?\s+(?:around |about |up to |near )?(\d+)\s*f(?:ee|oo)t/);
    if (m) return +m[1];
    if (/waves?[^.]*(?:foot or less|less than a foot|1 foot or less)/.test(t)) return 1;
  }
  return null;
}

// Expand a UGC zone spec ("LEZ142>144", "LEZ145-146") to its zone numbers.
function zoneNumbers(spec) {
  const nums = [];
  let prev = null, m;
  const re = /([>-]?)(\d{3})/g;
  while ((m = re.exec(spec.replace(/^[A-Z]{3}/, "")))) {
    const n = +m[2];
    if (m[1] === ">" && prev != null) for (let k = prev + 1; k <= n; k++) nums.push(k);
    else nums.push(n);
    prev = n;
  }
  return nums;
}

// Parse the current-period wave height (ft) for a specific zone out of the NSH
// text product (the reliable wave source for nearshore zones, which the API's
// zone-forecast endpoint leaves blank).
function nshWavesForZone(text, zone) {
  if (!text || !zone) return null;
  const want = parseInt(String(zone).replace(/\D/g, ""), 10);
  if (!want) return null;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^([A-Z]{3}[\d>\-]+?)-\d{6}-\s*$/);
    if (!h || !zoneNumbers(h[1]).includes(want)) continue;
    let body = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (/^[A-Z]{3}[\d>\-]+?-\d{6}-\s*$/.test(lines[j])) break;
      body += lines[j] + " ";
    }
    return parseForecastWaves([{ forecast: body }]);
  }
  return null;
}

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Parse the named periods (.TODAY... / .TONIGHT... / .THURSDAY...) for a zone
// out of the NSH text — the real nearshore forecast (the API leaves it blank).
function nshPeriodsForZone(text, zone) {
  if (!text || !zone) return [];
  const want = parseInt(String(zone).replace(/\D/g, ""), 10);
  if (!want) return [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^([A-Z]{3}[\d>\-]+?)-\d{6}-\s*$/);
    if (!h || !zoneNumbers(h[1]).includes(want)) continue;
    let body = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (/^[A-Z]{3}[\d>\-]+?-\d{6}-\s*$/.test(lines[j])) break;
      body += lines[j] + " ";
    }
    const periods = [];
    const re = /\.([A-Z][A-Z ]+?)\.\.\.\s*([\s\S]*?)(?=\.[A-Z][A-Z ]+?\.\.\.|$)/g;
    let m;
    while ((m = re.exec(body))) {
      const forecast = m[2].replace(/\s+/g, " ").trim();
      if (forecast) periods.push({ name: titleCase(m[1].trim()), forecast });
    }
    return periods.slice(0, 5);
  }
  return [];
}

// How a wind DIRECTION plays on Lake Erie's south shore. Open water is to the
// north (so N'ly = onshore, S'ly = offshore), and the lake's long axis runs
// WSW–ENE, so those directions have the longest fetch and build the biggest
// waves. tone drives the verdict; advice is the plain-language explainer.
const WIND_READS = {
  N:   { tone: "bad",     short: "N onshore — chop piles on this shore", advice: "North wind blows straight across the lake onto the Ohio shore — choppy right at the launch, usually rougher than the open-water number." },
  NNE: { tone: "bad",     short: "NNE onshore + long fetch — steep waves", advice: "Out of the NNE: long fetch down the lake plus onshore. Builds steep, closely-spaced waves." },
  NE:  { tone: "bad",     short: "NE — long fetch, Erie's roughest direction", advice: "NE has the longest fetch down the lake and blows onshore here. Notorious on Erie for steep, dangerous waves — be very cautious." },
  ENE: { tone: "caution", short: "ENE — long fetch, chop building", advice: "East-northeast with a long fetch down the lake; chop builds through the day." },
  E:   { tone: "caution", short: "E cross-shore — watch it build", advice: "Easterly cross-shore wind. Moderate chop that can build with a long fetch behind it." },
  ESE: { tone: "caution", short: "ESE offshore — calm at ramp, rougher out", advice: "Out of the SE (offshore): flat at the launch but it builds offshore and pushes you away from shore." },
  SE:  { tone: "caution", short: "SE offshore — deceptive at the ramp", advice: "Offshore from the SE. Water looks calm at the dock but gets rougher as you head out, and the wind pushes small boats away from shore." },
  SSE: { tone: "caution", short: "SSE offshore — deceptive, pushes you out", advice: "Southerly offshore wind: deceptively flat at the launch, rougher offshore, and it pushes you out. Mind the return trip." },
  S:   { tone: "caution", short: "S offshore — flat at shore, rough offshore", advice: "South wind is offshore here — calm near the beach but it builds offshore and you'll fight it coming back. Easy to underestimate." },
  SSW: { tone: "caution", short: "SSW — offshore + long fetch to the east", advice: "SSW is offshore at the Ohio shore but runs the lake's long axis — waves build toward the central/eastern basin." },
  SW:  { tone: "caution", short: "SW — long fetch, waves build down the lake", advice: "Prevailing SW: longest fetch down the lake. Builds through the day, biggest toward Cleveland and east." },
  WSW: { tone: "caution", short: "WSW — long fetch building waves east", advice: "WSW runs the lake's long axis — waves build through the day, largest toward the eastern basin." },
  W:   { tone: "ok",      short: "W — cross/offshore, moderate", advice: "Westerly: cross-to-offshore here. Moderate chop, building toward the east end of the lake." },
  WNW: { tone: "caution", short: "WNW — gusty post-front, chop onshore", advice: "WNW often follows a cold front — gusty and shifting, bringing chop onto the shore." },
  NW:  { tone: "caution", short: "NW onshore — chop onshore, often gusty", advice: "Northwest is onshore-ish and frequently post-frontal (gusty). Pushes chop onto the shore." },
  NNW: { tone: "bad",     short: "NNW onshore — chop piles on the shore", advice: "Out of the NNW: onshore, piling chop onto the Ohio shore." },
};
function windRead(dirCompass) {
  const r = dirCompass && WIND_READS[dirCompass];
  return r ? { dir: dirCompass, ...r } : null;
}

// ---- Hourly risk timeline ----
// Per-hour GO/CAUTION/NO-GO from the NWS hourly forecast (sustained wind +
// precip chance + thunderstorm wording; hourly has no gust data).
function hourRisk(windKt, precipPct, short, waveFt) {
  const s = (short || "").toLowerCase();
  const thunder = /thunder|tstm|waterspout/.test(s);
  const pop = precipPct ?? 0;
  if (thunder && pop >= 25) return "NO-GO";        // real storm chance
  if (waveFt != null && waveFt >= 4) return "NO-GO";
  if (windKt != null && windKt >= 22) return "NO-GO";
  if (thunder) return "CAUTION";                   // slight storm chance
  if (waveFt != null && waveFt >= 2.5) return "CAUTION";
  if (windKt != null && windKt >= 15) return "CAUTION";
  if (pop >= 55) return "CAUTION";                 // likely rain
  return "GO";
}

function withRisk(hours) {
  return (hours || []).map((h) => ({ ...h, level: hourRisk(h.windKt, h.precipPct, h.short, h.waveFt) }));
}

// Turn the hourly timeline into an actionable "go now / be in by X" outlook.
function computeOutlook(hours) {
  if (!hours || !hours.length) return null;
  const win = hours.slice(0, 18); // actionable "today/tonight" window for "be in by"
  const idx = win.findIndex((h) => h.level === "NO-GO");
  const out = { nowLevel: hours[0].level, headInBy: null, headInReason: null, goodHours: win.length };
  if (idx === 0) { out.headInBy = win[0].time; out.goodHours = 0; }
  else if (idx > 0) {
    const h = win[idx];
    out.headInBy = h.time;
    out.goodHours = idx;
    const s = (h.short || "").toLowerCase();
    out.headInReason = /thunder|tstm|waterspout/.test(s) ? "thunderstorms"
      : (h.waveFt != null && h.waveFt >= 4 ? "building waves"
      : (h.windKt >= 22 ? "building wind" : "deteriorating weather"));
  }
  return out;
}

// ---- Recommendation engine ----
// Thresholds tuned for small/mid recreational power boats (16-26 ft) on the
// notoriously short, steep chop of Lake Erie's shallow western/central basin.
function buildRecommendation({ buoy, alerts, wind, waves, read, hours }) {
  const reasons = [];
  let level = "GO"; // GO < CAUTION < NO-GO
  const bump = (to, why) => {
    const order = { GO: 0, CAUTION: 1, "NO-GO": 2 };
    if (order[to] > order[level]) level = to;
    if (why) reasons.push(why);
  };

  // Active marine warnings dominate.
  for (const a of alerts || []) {
    const ev = (a.event || "").toLowerCase();
    if (ev.includes("gale") || ev.includes("storm") || ev.includes("special marine")) {
      bump("NO-GO", `Active ${a.event}`);
    } else if (ev) {
      bump("CAUTION", `Active ${a.event}`);
    }
  }

  // Wave height — observed buoy if available, else NWS forecast, so it's never
  // blank (the western basin rarely has a reporting wave buoy).
  const wv = waves?.ft;
  if (wv != null) {
    const tag = waves.source === "forecast" ? " (forecast)" : "";
    if (wv >= 4) bump("NO-GO", `Waves ~${wv} ft${tag} — very rough`);
    else if (wv >= 3) bump("CAUTION", `Waves ~${wv} ft${tag} — rough for small boats`);
    else if (wv >= 2) bump("CAUTION", `Waves ~${wv} ft${tag} — choppy`);
    else reasons.push(`Waves ~${wv} ft${tag} — manageable`);
  }

  // Wind / gusts — buoy if reporting, otherwise NWS forecast, so wind ALWAYS
  // factors in (the decisive signal when wave data is missing).
  const topWind = Math.max(wind?.speedKt ?? 0, wind?.gustKt ?? 0);
  if (topWind) {
    const tag = wind?.source === "forecast" ? " (forecast)" : "";
    if (topWind >= 22) bump("NO-GO", `Wind/gusts ~${round(topWind)} kt${tag}`);
    else if (topWind >= 17) bump("CAUTION", `Wind ~${round(topWind)} kt${tag}`);
    else if (topWind >= 12) bump("CAUTION", `Breezy ~${round(topWind)} kt${tag}`);
    else if (wv == null) reasons.push(`Wind ~${round(topWind)} kt${tag} — light`);
  }

  // Wind DIRECTION on Erie's fetch — only matters once there's some wind.
  if (read && topWind >= 10) {
    if (read.tone === "bad") bump("CAUTION", read.short);
    else if (read.tone === "caution") reasons.push(read.short);
  }

  // IMMINENT hazard only (this hour / next) — storms happening now are a hard
  // stop, but a storm 6 hours out should NOT make right-now a NO-GO. The hourly
  // timeline + outlook tell the boater when to head back in.
  const imminent = (hours || []).slice(0, 2);
  const badNow = imminent.find((h) => h.level === "NO-GO");
  if (badNow) {
    const s = (badNow.short || "").toLowerCase();
    bump("NO-GO", /thunder|tstm|waterspout/.test(s) ? "Thunderstorms now / imminent" : "Hazardous conditions right now");
  } else if ((hours || []).some((h) => /thunder|tstm/.test((h.short || "").toLowerCase()))) {
    // Storms later in the window — note it, but don't sink the current verdict.
    reasons.push("Thunderstorms later — watch the hourly timeline");
  }

  if (reasons.length === 0) reasons.push("Calm conditions reported");
  if (!buoy) reasons.push("No live buoy here — using NWS forecast; verify before launch");

  const summary = {
    GO: "Looks good to boat.",
    CAUTION: "Boatable with caution — small boats take care.",
    "NO-GO": "Not recommended — stay in.",
  }[level];

  return { level, summary, reasons };
}

// ── Live-cam health, checked at view time ───────────────────────────────────
// Third-party feeds die or go offline without notice (a YouTube stream that
// restarts shows "recording not available"), and an iframe's onLoad fires even
// then — so the client can't tell. We check each cam server-side and only show
// the ones that are actually working right now. Cached per-lake to stay cheap.
const camFetch = (u, opts = {}) =>
  fetch(u, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA, ...(opts.headers || {}) }, ...opts });

// Tri-state: "live" | "offline" | "unknown". We only return "offline" on a
// DEFINITIVE negative (HTTP error, YouTube not-live/un-embeddable, no stream
// assigned). Timeouts and anything ambiguous are "unknown" so a slow check
// never hides a cam that's actually fine — the client hides "offline" only.
async function camLiveness(c) {
  try {
    if (c.img) {
      const r = await camFetch(c.img);
      if (!r.ok) return "offline";
      return (r.headers.get("content-type") || "").startsWith("image/") ? "live" : "offline";
    }
    if (c.yt) {
      const r = await camFetch(`https://www.youtube.com/watch?v=${c.yt}`);
      if (!r.ok) return "unknown";
      const b = await r.text();
      if (!b.includes('"playableInEmbed":true')) return "offline"; // embedding disabled / video gone
      return b.includes('"isLiveNow":true') ? "live" : "offline";  // stream ended / not broadcasting
    }
    if (c.ipcamlive) {
      const r = await camFetch(`https://www.ipcamlive.com/player/player.php?alias=${c.ipcamlive}&autoplay=1`);
      if (!r.ok) return "unknown";
      const b = await r.text();
      const sid = (b.match(/var streamid = '([^']+)'/) || [])[1];
      const srv = (b.match(/address = '(https?:\/\/s\d+\.ipcamlive\.com\/?)'/) || [])[1];
      if (!sid || !srv) return "offline"; // camera not assigned a stream → down
      const snap = await camFetch(`${srv.replace(/\/$/, "")}/streams/${sid}/snapshot.jpg`);
      return snap.ok ? "live" : "unknown";
    }
    // wetmet / angelcam / ozolio / ytChannel: a loadable, frame-able embed is
    // "live". Two definitive negatives: the page blocks framing, or its media
    // stream is insecure (http / Wowza :1935) — that's mixed-content blocked on
    // our HTTPS site and spins forever (the pixelcaster failure mode).
    const r = await camFetch(camSrc(c));
    if (!r.ok) return "unknown";
    const xfo = (r.headers.get("x-frame-options") || "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) return "offline";
    const b = await r.text();
    const media = b.match(/(?:https?:)?\/\/[^\s"'<>]+?\.(?:m3u8|mp4)\b[^\s"'<>]*/i);
    if (media && (/:1935\b/.test(media[0]) || /^http:\/\//i.test(media[0]))) return "offline";
    return "live";
  } catch {
    return "unknown"; // timeout / network error → don't hide, just can't confirm
  }
}

// Pool the checks so a lake's slow feeds don't starve the rest (and to stay
// gentle on upstreams). 5 in flight at a time.
async function camStatusForLake(lake) {
  const want = lake || "Lake Erie";
  const cams = CAMS.filter((c) => (c.lake || "Lake Erie") === want);
  const status = {};
  let next = 0;
  const worker = async () => {
    while (next < cams.length) {
      const c = cams[next++];
      status[c.name] = await camLiveness(c);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, cams.length) }, worker));
  return status;
}

async function handleCamStatus(url) {
  const lake = url.searchParams.get("lake") || "Lake Erie";
  const cacheKey = new Request(`https://cam-status.local/${encodeURIComponent(lake)}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const status = await camStatusForLake(lake);
  const resp = new Response(JSON.stringify({ lake, status }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=180" },
  });
  await cache.put(cacheKey, resp.clone());
  return resp;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname.endsWith("/cams")) return handleCamStatus(url);

  if (url.searchParams.has("spots")) {
    return json({
      spots: Object.entries(SPOTS).map(([id, s]) => ({
        id, name: s.name, zone: s.zone, lat: s.lat, lon: s.lon,
        lake: s.lake || "Lake Erie", // each spot carries its lake → grouped picker, scales to all 5
      })),
    });
  }

  const spotId = (url.searchParams.get("spot") || "sandusky").toLowerCase();
  const spot = SPOTS[spotId];
  if (!spot) {
    return json({ error: `Unknown spot '${spotId}'`, spots: Object.keys(SPOTS) }, 400);
  }

  // Fetch all sources concurrently; each resolves to null on failure so one
  // bad source never sinks the whole response.
  const [buoy, fc, marine, alerts, noaaReport, waveMap] = await Promise.all([
    fetchBuoy(spot.buoys),
    fetchForecasts(spot.lat, spot.lon),
    fetchMarineForecast(spot.zone),
    fetchAlerts(spot.lat, spot.lon),
    fetchNSH(spot.office || "CLE"), // per-spot WFO (Erie spots default to Cleveland)
    fetchMarineHourly(spot.lat, spot.lon),
  ]);
  const point = fc.daily;
  // Merge hourly wave height (Open-Meteo) into the NWS hourly rows, then rate risk.
  const hourly = withRisk(
    fc.hourly.map((h) => ({ ...h, waveFt: (waveMap[h.time.slice(0, 13)] || {}).waveFt ?? null }))
  );
  const outlook = computeOutlook(hourly);

  // Effective wind: prefer the live buoy, fall back to the NWS forecast so wind
  // is present even when no buoy (and no wave data) is available.
  const forecastWind = parseForecastWind(point?.[0]);
  const wind = {
    speedKt: buoy?.windKt ?? forecastWind?.speedKt ?? null,
    gustKt: buoy?.windGustKt ?? null,
    dir: buoy?.windDir ?? forecastWind?.dir ?? null,
    source: buoy?.windKt != null ? "buoy" : forecastWind?.speedKt != null ? "forecast" : null,
  };

  // Effective waves: live buoy, else parsed from the marine forecast text, so a
  // wave height is shown even where no buoy reports (the western basin).
  // Current waves: buoy → NSH/zone text → Open-Meteo's first hour (covers any
  // spot, incl. lakes with no buoy and no parsed zone).
  const forecastWaveFt = parseForecastWaves(marine) ?? nshWavesForZone(noaaReport?.text, spot.zone) ?? hourly[0]?.waveFt ?? null;
  const waves = {
    ft: buoy?.waveHeightFt ?? forecastWaveFt ?? null,
    periodSec: buoy?.dominantPeriodSec ?? null,
    source: buoy?.waveHeightFt != null ? "buoy" : forecastWaveFt != null ? "forecast" : null,
  };

  const read = windRead(wind.dir);
  const recommendation = buildRecommendation({ buoy, alerts, wind, waves, read, hours: hourly });

  return json({
    spot: { id: spotId, name: spot.name, zone: spot.zone, lat: spot.lat, lon: spot.lon, lake: spot.lake || "Lake Erie" },
    updatedAt: new Date().toISOString(),
    recommendation,
    wind,
    waves,
    windRead: read,
    hourly,
    outlook,
    buoy,
    alerts: alerts || [],
    marineForecast: (marine && marine.length) ? marine : nshPeriodsForZone(noaaReport?.text, spot.zone),
    pointForecast: point || [],
    noaaReport,
    sources: {
      buoy: buoy ? `NDBC ${buoy.station}` : "no live buoy",
      forecast: "NWS api.weather.gov",
      marineZone: spot.zone,
    },
  });
}
