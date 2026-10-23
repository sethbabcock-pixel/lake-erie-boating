// Lake Erie marine conditions aggregator.
//
// Pulls live, authoritative NOAA data from the Cloudflare edge (which can reach
// the NOAA hosts) and folds it into a single GO / CAUTION / NO-GO call for a
// chosen launch spot between Toledo and Erie, PA.
//
// Data sources (all free, public-domain NOAA, no API key):
//   - NWS API (api.weather.gov): point forecast + active marine alerts
//   - NWS raw forecast grid (waveHeight/wavePeriod/wind/gusts/precip hourly)
//   - NWS nearshore marine zone forecast (text periods)
//   - NDBC realtime buoy observations (waves, wind, water temp)
//
// GET /marine/conditions?spot=sandusky
// GET /marine/conditions?spots  -> list available spots

import { camSrc, applyCamConfig } from "../../src/cams.js";

const UA = "lake-erie-boating (seth.babcock@gmail.com)";
const NWS = "https://api.weather.gov";

// Curated launch spots. Each maps to the nearest NWS nearshore marine zone and
// the closest reporting NDBC buoy(s), ordered by preference. Buoys in Lake Erie
// are seasonal (recovered over winter), so we list fallbacks and degrade
// gracefully when none are reporting.
export const SPOTS = {
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
  // optional (wind from forecast, waves from the NWS grid cover spots w/o buoys).
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

  // ── Beyond the Great Lakes: coastal / tidal waters. Same NWS grid + marine
  // zone + NDBC pipeline — the water body (`lake`) just needs a WATER_CENTERS
  // entry so a seaward wave cell gets sampled. Zone/office/buoy IDs are the
  // NWS/NDBC identifiers for each area; verify against live data when adding more.
  "middle-river": { name: "Middle River / Essex, MD", lat: 39.31, lon: -76.40, zone: "ANZ531", office: "LWX", product: "CWF", buoys: ["FSKM2", "44062"], lake: "Chesapeake Bay" },
  "bath-nc": { name: "Bath / Pamlico River, NC", lat: 35.44, lon: -76.75, zone: "AMZ136", office: "MHX", product: "CWF", buoys: [], lake: "Pamlico Sound" },
  // ── Warm-weather coasts. Zone/office/buoys resolved from api.weather.gov and
  // NDBC's active-station list (Oct 2026); `sea` is the bearing toward open
  // water (wave sampling + onshore/offshore reads); `water` picks the verdict
  // thresholds (see waterProfile); `openWater` is the prose name.
  // Florida Atlantic Coast, Biscayne Bay and the Keys
  jacksonville: { name: "Jacksonville / Mayport, FL", lat: 30.395, lon: -81.41, zone: "AMZ452", office: "JAX", product: "CWF", buoys: ["MYPF1", "BLIF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "st-augustine": { name: "St. Augustine, FL", lat: 29.89, lon: -81.29, zone: "AMZ454", office: "JAX", product: "CWF", buoys: ["SAUF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "ponce-inlet": { name: "Ponce Inlet / New Smyrna, FL", lat: 29.08, lon: -80.93, zone: "AMZ550", office: "MLB", product: "CWF", buoys: ["41069"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "port-canaveral": { name: "Port Canaveral / Cocoa Beach, FL", lat: 28.41, lon: -80.61, zone: "AMZ552", office: "MLB", product: "CWF", buoys: ["TRDF1", "41009"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "sebastian-inlet": { name: "Sebastian Inlet, FL", lat: 27.86, lon: -80.45, zone: "AMZ552", office: "MLB", product: "CWF", buoys: ["SIPF1", "41068"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "fort-pierce": { name: "Fort Pierce, FL", lat: 27.47, lon: -80.3, zone: "AMZ555", office: "MLB", product: "CWF", buoys: ["41068", "SIPF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  jupiter: { name: "Jupiter Inlet, FL", lat: 26.945, lon: -80.075, zone: "AMZ650", office: "MFL", product: "CWF", buoys: ["LKWF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "palm-beach": { name: "Palm Beach Inlet, FL", lat: 26.77, lon: -80.04, zone: "AMZ650", office: "MFL", product: "CWF", buoys: ["LKWF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 90, openWater: "the Atlantic" },
  "fort-lauderdale": { name: "Fort Lauderdale, FL", lat: 26.1, lon: -80.11, zone: "AMZ651", office: "MFL", product: "CWF", buoys: ["PEGF1", "VAKF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  miami: { name: "Miami / Government Cut, FL", lat: 25.765, lon: -80.135, zone: "AMZ651", office: "MFL", product: "CWF", buoys: ["VAKF1", "PEGF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 135, openWater: "the Atlantic" },
  "biscayne-bay": { name: "Biscayne Bay / Coconut Grove, FL", lat: 25.72, lon: -80.23, zone: "AMZ630", office: "MFL", product: "CWF", buoys: ["VAKF1", "PEGF1"], lake: "Florida Atlantic Coast", water: "sheltered", sea: 135, openWater: "Biscayne Bay" },
  "key-largo": { name: "Key Largo, FL", lat: 25.09, lon: -80.44, zone: "GMZ042", office: "KEY", product: "CWF", buoys: [], lake: "Florida Keys", water: "ocean", sea: 120, openWater: "the Atlantic" },
  islamorada: { name: "Islamorada, FL", lat: 24.92, lon: -80.63, zone: "GMZ042", office: "KEY", product: "CWF", buoys: ["WRBF1"], lake: "Florida Keys", water: "ocean", sea: 135, openWater: "the Atlantic" },
  marathon: { name: "Marathon, FL", lat: 24.71, lon: -81.09, zone: "GMZ032", office: "KEY", product: "CWF", buoys: ["VCAF1", "SMKF1"], lake: "Florida Keys", water: "ocean", sea: 160, openWater: "the Atlantic" },
  "key-west": { name: "Key West, FL", lat: 24.555, lon: -81.8, zone: "GMZ044", office: "KEY", product: "CWF", buoys: ["KYWF1", "SANF1"], lake: "Florida Keys", water: "ocean", sea: 180, openWater: "the Atlantic" },
  // Florida Gulf Coast
  "marco-island": { name: "Marco Island, FL", lat: 25.94, lon: -81.72, zone: "GMZ656", office: "MFL", product: "CWF", buoys: ["RKXF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 225, openWater: "the Gulf" },
  naples: { name: "Naples, FL", lat: 26.14, lon: -81.8, zone: "GMZ656", office: "MFL", product: "CWF", buoys: ["RKXF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 248, openWater: "the Gulf" },
  "fort-myers-beach": { name: "Fort Myers Beach, FL", lat: 26.45, lon: -81.95, zone: "GMZ856", office: "TBW", product: "CWF", buoys: ["FMRF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 248, openWater: "the Gulf" },
  sarasota: { name: "Sarasota, FL", lat: 27.33, lon: -82.55, zone: "GMZ853", office: "TBW", product: "CWF", buoys: ["VENF1", "MTBF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 248, openWater: "the Gulf" },
  "tampa-bay": { name: "Tampa Bay / St. Petersburg, FL", lat: 27.77, lon: -82.63, zone: "GMZ830", office: "TBW", product: "CWF", buoys: ["SAPF1", "OPTF1"], lake: "Florida Gulf Coast", water: "sheltered", sea: 135, openWater: "Tampa Bay" },
  clearwater: { name: "Clearwater, FL", lat: 27.98, lon: -82.83, zone: "GMZ853", office: "TBW", product: "CWF", buoys: ["CWBF1", "OPTF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 293, openWater: "the Gulf" },
  "panama-city": { name: "Panama City Beach, FL", lat: 30.16, lon: -85.8, zone: "GMZ751", office: "TAE", product: "CWF", buoys: ["PCBF1", "PACF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 202, openWater: "the Gulf" },
  destin: { name: "Destin, FL", lat: 30.39, lon: -86.51, zone: "GMZ655", office: "MOB", product: "CWF", buoys: [], lake: "Florida Gulf Coast", water: "ocean", sea: 180, openWater: "the Gulf" },
  pensacola: { name: "Pensacola Beach, FL", lat: 30.33, lon: -87.14, zone: "GMZ655", office: "MOB", product: "CWF", buoys: ["PCLF1", "PPTA1"], lake: "Florida Gulf Coast", water: "ocean", sea: 135, openWater: "the Gulf" },
  // Northern Gulf: Alabama, Mississippi, Louisiana and Texas
  "orange-beach": { name: "Orange Beach / Gulf Shores, AL", lat: 30.27, lon: -87.58, zone: "GMZ650", office: "MOB", product: "CWF", buoys: ["PPTA1", "42012"], lake: "Alabama & Mississippi Coast", water: "ocean", sea: 158, openWater: "the Gulf" },
  "mobile-bay": { name: "Fairhope / Mobile Bay, AL", lat: 30.52, lon: -87.91, zone: "GMZ630", office: "MOB", product: "CWF", buoys: ["WKXA1", "MCGA1"], lake: "Alabama & Mississippi Coast", water: "sheltered", sea: 248, openWater: "Mobile Bay" },
  biloxi: { name: "Biloxi, MS", lat: 30.39, lon: -88.88, zone: "GMZ532", office: "LIX", product: "CWF", buoys: ["PTBM6", "WYCM6"], lake: "Alabama & Mississippi Coast", water: "sheltered", sea: 180, openWater: "the Mississippi Sound" },
  "grand-isle": { name: "Grand Isle, LA", lat: 29.24, lon: -90, zone: "GMZ553", office: "LIX", product: "CWF", buoys: ["GISL1"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 160, openWater: "the Gulf" },
  galveston: { name: "Galveston, TX", lat: 29.3, lon: -94.78, zone: "GMZ355", office: "HGX", product: "CWF", buoys: ["GTOT2", "GNJT2"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 135, openWater: "the Gulf" },
  kemah: { name: "Kemah / Galveston Bay, TX", lat: 29.545, lon: -95.02, zone: "GMZ335", office: "HGX", product: "CWF", buoys: ["EPTT2", "MGPT2"], lake: "Louisiana & Texas Coast", water: "sheltered", sea: 90, openWater: "Galveston Bay" },
  "port-aransas": { name: "Port Aransas, TX", lat: 27.83, lon: -97.06, zone: "GMZ255", office: "CRP", product: "CWF", buoys: ["MIST2", "RTAT2"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 135, openWater: "the Gulf" },
  "south-padre": { name: "South Padre Island, TX", lat: 26.07, lon: -97.16, zone: "GMZ150", office: "BRO", product: "CWF", buoys: ["BZST2", "PCGT2"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 90, openWater: "the Gulf" },
  // Southeast Atlantic: Georgia and the Carolinas
  "st-simons": { name: "St. Simons Island / Brunswick, GA", lat: 31.14, lon: -81.39, zone: "AMZ450", office: "JAX", product: "CWF", buoys: ["SAXG1"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 135, openWater: "the Atlantic" },
  tybee: { name: "Savannah / Tybee Island, GA", lat: 32.01, lon: -80.85, zone: "AMZ362", office: "CHS", product: "CWF", buoys: ["FPKG1"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 135, openWater: "the Atlantic" },
  "hilton-head": { name: "Hilton Head, SC", lat: 32.17, lon: -80.73, zone: "AMZ362", office: "CHS", product: "CWF", buoys: ["FPKG1", "41033"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  charleston: { name: "Charleston Harbor, SC", lat: 32.76, lon: -79.87, zone: "AMZ340", office: "CHS", product: "CWF", buoys: ["CHTS1", "FBIS1"], lake: "Georgia & South Carolina Coast", water: "sheltered", sea: 135, openWater: "Charleston Harbor" },
  "murrells-inlet": { name: "Murrells Inlet / Myrtle Beach, SC", lat: 33.55, lon: -79.04, zone: "AMZ254", office: "ILM", product: "CWF", buoys: ["MROS1", "NIWS1"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  wrightsville: { name: "Wilmington / Wrightsville Beach, NC", lat: 34.21, lon: -77.79, zone: "AMZ250", office: "ILM", product: "CWF", buoys: ["JMPN7", "MBNN7"], lake: "North Carolina Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  "morehead-city": { name: "Morehead City / Beaufort, NC", lat: 34.7, lon: -76.69, zone: "AMZ158", office: "MHX", product: "CWF", buoys: ["BFTN7", "CLKN7"], lake: "North Carolina Coast", water: "ocean", sea: 180, openWater: "the Atlantic" },
  "oregon-inlet": { name: "Oregon Inlet / Outer Banks, NC", lat: 35.79, lon: -75.54, zone: "AMZ150", office: "MHX", product: "CWF", buoys: ["ORIN7", "41082"], lake: "North Carolina Coast", water: "ocean", sea: 90, openWater: "the Atlantic" },
  // Southern California
  "san-diego": { name: "San Diego / Point Loma, CA", lat: 32.71, lon: -117.18, zone: "PZZ740", office: "SGX", product: "CWF", buoys: ["TIXC1", "LJAC1"], lake: "Southern California Coast", water: "ocean", sea: 248, openWater: "the Pacific" },
  "mission-bay": { name: "Mission Bay, CA", lat: 32.765, lon: -117.24, zone: "PZZ740", office: "SGX", product: "CWF", buoys: ["LJAC1", "LJPC1"], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  oceanside: { name: "Oceanside Harbor, CA", lat: 33.21, lon: -117.4, zone: "PZZ740", office: "SGX", product: "CWF", buoys: [], lake: "Southern California Coast", water: "ocean", sea: 248, openWater: "the Pacific" },
  "dana-point": { name: "Dana Point, CA", lat: 33.46, lon: -117.7, zone: "PZZ655", office: "LOX", product: "CWF", buoys: [], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  "newport-beach": { name: "Newport Beach, CA", lat: 33.6, lon: -117.88, zone: "PZZ655", office: "LOX", product: "CWF", buoys: ["PRJC1", "PFXC1"], lake: "Southern California Coast", water: "ocean", sea: 203, openWater: "the Pacific" },
  "long-beach": { name: "Long Beach, CA", lat: 33.75, lon: -118.19, zone: "PZZ655", office: "LOX", product: "CWF", buoys: ["PRJC1", "PFXC1"], lake: "Southern California Coast", water: "ocean", sea: 180, openWater: "the Pacific" },
  "marina-del-rey": { name: "Marina del Rey, CA", lat: 33.97, lon: -118.45, zone: "PZZ655", office: "LOX", product: "CWF", buoys: ["ICAC1", "PXAC1"], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  "channel-islands": { name: "Channel Islands Harbor / Oxnard, CA", lat: 34.16, lon: -119.23, zone: "PZZ650", office: "LOX", product: "CWF", buoys: ["46025"], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  "santa-barbara": { name: "Santa Barbara, CA", lat: 34.4, lon: -119.69, zone: "PZZ650", office: "LOX", product: "CWF", buoys: ["46053"], lake: "Southern California Coast", water: "ocean", sea: 180, openWater: "the Pacific" },
  // Hawaii and Puerto Rico
  honolulu: { name: "Honolulu / Kewalo Basin, HI", lat: 21.29, lon: -157.86, zone: "PHZ115", office: "HFO", product: "CWF", buoys: ["OOUH1", "PRHH1"], lake: "Hawaii", water: "ocean", sea: 200, openWater: "the Pacific" },
  kona: { name: "Kona / Honokohau Harbor, HI", lat: 19.67, lon: -156.03, zone: "PHZ123", office: "HFO", product: "CWF", buoys: ["KWHH1"], lake: "Hawaii", water: "ocean", sea: 270, openWater: "the Pacific" },
  maalaea: { name: "Ma'alaea, Maui, HI", lat: 20.79, lon: -156.51, zone: "PHZ119", office: "HFO", product: "CWF", buoys: ["KLIH1"], lake: "Hawaii", water: "ocean", sea: 200, openWater: "Ma'alaea Bay" },
  "san-juan": { name: "San Juan, PR", lat: 18.47, lon: -66.11, zone: "AMZ712", office: "SJU", product: "CWF", buoys: ["41053", "SJNP4"], lake: "Puerto Rico", water: "ocean", sea: 0, openWater: "the Atlantic" },
  fajardo: { name: "Fajardo, PR", lat: 18.33, lon: -65.63, zone: "AMZ726", office: "SJU", product: "CWF", buoys: ["41056", "ESPP4"], lake: "Puerto Rico", water: "ocean", sea: 90, openWater: "Vieques Sound" },
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
    const pt = await cachedJSON(`${NWS}/points/${lat},${lon}`, 86400);
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
        windDir: p.windDirection || null,
        precipPct: p.probabilityOfPrecipitation?.value ?? 0,
        short: p.shortForecast || "",
      };
    });
    return { daily, hourly };
  } catch (e) {
    return { daily: [], hourly: [] };
  }
}

// Some shoreline points map to a water grid cell whose hourly forecast 404s
// (e.g. Biscayne Bay, Biloxi, Santa Barbara). Retry a step inland, away from
// the sea bearing, where NWS always has a land forecast.
async function fetchForecastsNear(spot) {
  const fc = await fetchForecasts(spot.lat, spot.lon);
  if ((fc.hourly && fc.hourly.length) || spot.sea == null) return fc;
  const r = (((spot.sea + 180) % 360) * Math.PI) / 180;
  const kLon = 1 / Math.max(0.2, Math.cos((spot.lat * Math.PI) / 180));
  const alt = await fetchForecasts(round(spot.lat + Math.cos(r) * 0.04, 4), round(spot.lon + Math.sin(r) * 0.04 * kLon, 4));
  return alt.hourly && alt.hourly.length ? alt : fc;
}

// ── NWS raw gridpoint data ───────────────────────────────────────────────────
// The forecaster-edited ~2.5 km grid behind api.weather.gov. Over the Great
// Lakes the marine cells carry waveHeight/wavePeriod, so this one endpoint
// supplies hourly waves, wind, gusts, and precip — the public-domain NOAA
// replacement for the former Open-Meteo dependency (whose free tier is
// licensed non-commercial).

const kmhToKt = (kmh) => kmh * 0.539957;

// Cached JSON: edge cache on Workers, in-memory fallback for local/test runs.
const memCache = new Map();
async function cachedJSON(url, ttlSec) {
  if (typeof caches !== "undefined" && caches.default) {
    const key = new Request(`https://nws-cache.local/${encodeURIComponent(url)}`);
    const hit = await caches.default.match(key).catch(() => null);
    if (hit) return hit.json();
    const data = await getJSON(url);
    const resp = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttlSec}` },
    });
    await caches.default.put(key, resp).catch(() => {});
    return data;
  }
  const m = memCache.get(url);
  if (m && m.exp > Date.now()) return m.data;
  const data = await getJSON(url);
  memCache.set(url, { data, exp: Date.now() + ttlSec * 1000 });
  return data;
}

// "2026-07-03T18:00:00+00:00/PT3H" → [firstEpochHour, hourCount]
function expandValidTime(vt) {
  const [start, dur] = String(vt).split("/");
  const t = Date.parse(start);
  if (Number.isNaN(t)) return null;
  const m = String(dur || "PT1H").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  const hours = m ? Math.max(1, (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + Math.round((+(m[3] || 0)) / 60)) : 1;
  return [Math.floor(t / 3600000), hours];
}

// Gridpoint layer {uom, values:[{validTime, value}]} → Map(epochHour → value).
function gridSeries(prop, xf = (v) => v) {
  const map = new Map();
  for (const { validTime, value } of prop?.values || []) {
    if (value == null) continue;
    const span = expandValidTime(validTime);
    if (!span) continue;
    for (let h = 0; h < span[1]; h++) map.set(span[0] + h, xf(value));
  }
  return map;
}

// A speed layer declares its unit in `uom` (km/h by default, sometimes m/s).
const speedToKt = (prop) => (String(prop?.uom || "").includes("m_s") ? msToKt : kmhToKt);

async function fetchGridAt(lat, lon) {
  try {
    const pt = await cachedJSON(`${NWS}/points/${lat},${lon}`, 86400); // grid mapping is static
    const gUrl = pt?.properties?.forecastGridData;
    if (!gUrl) return null;
    const p = (await getJSON(gUrl))?.properties || {};
    return {
      tz: pt?.properties?.timeZone || "America/New_York",
      windKt: gridSeries(p.windSpeed, speedToKt(p.windSpeed)),
      gustKt: gridSeries(p.windGust, speedToKt(p.windGust)),
      windDirDeg: gridSeries(p.windDirection),
      waveFt: gridSeries(p.waveHeight, mToFt),
      periodSec: gridSeries(p.wavePeriod),
      precipPct: gridSeries(p.probabilityOfPrecipitation),
      // weather layer → per-hour thunderstorm flag, so summary verdicts and GO
      // windows see storms the same way the detail page does.
      thunder: gridSeries(p.weather, (v) => (Array.isArray(v) ? v : []).some((c) => /thunder/i.test(c?.weather || ""))),
    };
  } catch (e) {
    return null;
  }
}

// Launch coords sit on the shoreline, whose grid cell is often a LAND cell
// with no wave layers. Sample a touch seaward instead — wind/precip barely
// change over ~3 km, and the marine cell carries waves. Land cells can run a
// few cells deep off harbors (Port Clinton's did), so step progressively
// farther until a cell carries waves; keep the NEAREST cell's wind/precip and
// graft the wave layers from the marine cell, since wind barely changes over
// a few km but waves only exist over water.
// Seaward = a spot's `sea` bearing (degrees toward open water) when it has
// one — every ocean launch does, since an ocean has no useful "center" — else
// the direction toward the middle of its lake/bay (WATER_CENTERS).
function seawardPoint(spot, stepDeg) {
  if (spot.sea != null) {
    const r = (spot.sea * Math.PI) / 180;
    // Degrees of longitude shrink with latitude; keep the step a true distance.
    const kLon = 1 / Math.max(0.2, Math.cos((spot.lat * Math.PI) / 180));
    return { lat: round(spot.lat + Math.cos(r) * stepDeg, 4), lon: round(spot.lon + Math.sin(r) * stepDeg * kLon, 4) };
  }
  const c = WATER_CENTERS[spot.lake || "Lake Erie"];
  if (!c) return { lat: round(spot.lat, 4), lon: round(spot.lon, 4) }; // inland: no marine cell to reach toward — sample at the point
  const dLat = c.lat - spot.lat, dLon = c.lon - spot.lon;
  const len = Math.hypot(dLat, dLon) || 1;
  return { lat: round(spot.lat + (dLat / len) * stepDeg, 4), lon: round(spot.lon + (dLon / len) * stepDeg, 4) };
}
const isOpenWater = (spot) => spot.sea != null || !!WATER_CENTERS[spot.lake || "Lake Erie"];
const GRID_STEPS = [0.035, 0.1, 0.22];
async function fetchSpotGrid(spot) {
  // Open water (lakes, bays, sounds, ocean): nudge seaward until we hit a
  // marine cell that carries waves. Inland waters have no wave grid, so just
  // sample the point once (wind/gusts/precip/temp exist on land; waves blank).
  const steps = isOpenWater(spot) ? GRID_STEPS : [0];
  // Remember which step reached a wave cell, so steady state costs one grid
  // fetch per spot instead of up to three (the directory summary fetches every
  // spot in one request, and Workers cap subrequests per request).
  const memoKey = typeof caches !== "undefined" && caches.default
    ? new Request(`https://grid-step.local/${round(spot.lat, 3)},${round(spot.lon, 3)},${spot.sea ?? ""},${spot.lake || ""}`) : null;
  let known = null;
  if (memoKey) known = await caches.default.match(memoKey).then((r) => (r ? r.text() : null)).catch(() => null);
  if (known != null && steps.includes(Number(known))) {
    const p = seawardPoint(spot, Number(known));
    const g = await fetchGridAt(p.lat, p.lon);
    if (g && (g.waveFt.size || !isOpenWater(spot))) return g;
  }
  let base = null;
  for (const step of steps) {
    const p = seawardPoint(spot, step);
    const g = await fetchGridAt(p.lat, p.lon);
    if (!g) continue;
    if (!base) base = g;
    if (g.waveFt.size) {
      if (g !== base) { base.waveFt = g.waveFt; base.periodSec = g.periodSec; }
      // Only memo a step that is itself the base (no grafting needed).
      if (memoKey && g === base) await caches.default.put(memoKey, new Response(String(step), { headers: { "Cache-Control": "public, max-age=604800" } })).catch(() => {});
      return base;
    }
  }
  return base;
}

// Nearest defined hour, so a "current" sample tolerates layers with gaps.
function sampleNear(map, h) {
  if (!map) return null;
  return map.get(h) ?? map.get(h + 1) ?? map.get(h - 1) ?? map.get(h + 2) ?? map.get(h - 2) ?? null;
}

// Local calendar bucketing in a spot's timezone → { date: "YYYY-MM-DD", hour }.
function localParts(tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  });
  return (epochHour) => {
    const parts = {};
    for (const p of fmt.formatToParts(new Date(epochHour * 3600000))) parts[p.type] = p.value;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: +parts.hour };
  };
}

// Small concurrency pool for the multi-spot endpoints (be polite to the API).
async function pooled(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i).catch(() => null);
    }
  }));
  return out;
}

// Today's sunrise/sunset (UTC ISO) — the standard NOAA/SunCalc solar position
// algorithm, computed locally so no weather API is needed for it.
function sunTimes(lat, lon, date = new Date()) {
  const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
  const lw = rad * -lon, phi = rad * lat;
  const d = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(L) * Math.sin(e));
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const cosH = (Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null; // polar day/night — not the Great Lakes
  const w = Math.acos(cosH);
  const Jset = J2000 + 0.0009 + (w + lw) / (2 * Math.PI) + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const Jrise = Jnoon - (Jset - Jnoon);
  const toISO = (j) => new Date((j + 0.5 - J1970) * dayMs).toISOString();
  return { sunrise: toISO(Jrise), sunset: toISO(Jset) };
}

// 7-day planning outlook from the grid: per-day max wind/gust/precip/wave in
// the SPOT's local calendar. Powers the "week ahead / weekend" strip — a
// per-day verdict so a boater can pick Saturday on Wednesday.
function buildWeek(grid, profile = "lake") {
  if (!grid) return [];
  const toLocal = localParts(grid.tz);
  const days = new Map();
  const keys = new Set([...grid.windKt.keys(), ...grid.waveFt.keys(), ...grid.precipPct.keys()]);
  const max = (a, b) => (b == null ? a : a == null ? b : Math.max(a, b));
  for (const h of keys) {
    const { date } = toLocal(h);
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, windKt: null, gustKt: null, precipPct: null, waveFt: null, periodSec: null }));
    d.windKt = max(d.windKt, grid.windKt.get(h));
    d.gustKt = max(d.gustKt, grid.gustKt.get(h));
    d.precipPct = max(d.precipPct, grid.precipPct.get(h));
    d.waveFt = max(d.waveFt, grid.waveFt.get(h));
    d.periodSec = max(d.periodSec, grid.periodSec.get(h));
  }
  const today = toLocal(Math.floor(Date.now() / 3600000)).date;
  return [...days.values()]
    .filter((d) => d.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 7)
    .map((d) => ({
      date: d.date,
      windKt: round(d.windKt, 0),
      gustKt: round(d.gustKt, 0),
      precipPct: d.precipPct == null ? null : Math.round(d.precipPct),
      waveFt: round(d.waveFt, 1),
      periodSec: round(d.periodSec, 0),
      level: hourRisk(round(d.windKt, 0), d.precipPct ?? 0, "", round(d.waveFt, 1), round(d.periodSec, 0), profile, { sustained: round(d.windKt, 0), gust: round(d.gustKt, 0) }),
    }));
}

async function fetchMarineForecast(zone) {
  if (!zone) return null; // inland lake: no NWS marine zone
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
    return dedupeAlerts((data?.features || []).map((f) => ({
      event: f.properties?.event,
      severity: f.properties?.severity,
      headline: f.properties?.headline,
      description: f.properties?.description,
      sent: f.properties?.sent || f.properties?.effective || null,
      ends: f.properties?.ends || f.properties?.expires,
    })));
  } catch (e) {
    return null;
  }
}

// NWS re-issues the same advisory repeatedly (e.g. three "Air Quality Alert"
// features minutes apart). Collapse to one card per event type, keeping the
// most recently sent, so the page shows one Air Quality Alert, not three.
function dedupeAlerts(alerts) {
  if (!alerts || !alerts.length) return alerts;
  const byEvent = new Map();
  for (const a of alerts) {
    const key = (a.event || "").toLowerCase().trim();
    const prev = byEvent.get(key);
    if (!prev || (a.sent || "") > (prev.sent || "")) byEvent.set(key, a);
  }
  return [...byEvent.values()];
}

// Latest official NWS marine text product for an office. This is the formal
// NOAA report boaters read, and the real source of the per-zone forecast
// periods (the structured /zones/marine/{id}/forecast API is largely
// unpopulated now). The Great Lakes use NSH (Nearshore Marine Forecast); the
// ocean coasts use CWF (Coastal Waters Forecast) — same text layout (UGC zone
// headers + .PERIOD... blocks), so the same parser reads both.
async function fetchMarineText(office = "CLE", product = "NSH") {
  try {
    const list = await getJSON(`${NWS}/products/types/${product}/locations/${office}`);
    const id = (list?.["@graph"] || list?.products || [])[0]?.id;
    if (!id) return null;
    const prod = await getJSON(`${NWS}/products/${id}`);
    if (!prod?.productText) return null;
    return { text: prod.productText, issued: prod.issuanceTime || null, office, product };
  } catch (e) {
    return null;
  }
}

// ── Coordinate-driven spot resolution ───────────────────────────────────────
// A curated SPOTS entry is just a cache of the marine context I resolve by hand.
// This resolves the same context for ANY point straight from api.weather.gov, so
// the app can build a full conditions page for a searched location, not only the
// hand-listed ports. Returns a synthetic spot, or null when NWS has no marine
// zone there (i.e. it isn't boatable open water we forecast).
const GL_ZONE = /^(?:LEZ|LOZ|LHZ|LMZ|LSZ)/; // Great Lakes marine-zone prefixes → NSH product

async function oneMarineZone(lat, lon) {
  try {
    const d = await cachedJSON(`${NWS}/zones?type=marine&point=${round(lat, 4)},${round(lon, 4)}`, 86400);
    const f = (d?.features || [])[0];
    return f?.properties?.id ? { id: f.properties.id, name: f.properties.name || "" } : null;
  } catch (e) {
    return null;
  }
}

// A searched place is usually a town centroid on LAND, but marine zones only
// cover water — so a point-in-zone lookup at the exact spot misses. Try the
// point, then expanding rings of nearby offsets, until one lands in a marine
// zone (i.e. the nearest water). Inland points exhaust the rings and return
// null, which is how we tell "not boatable water".
async function marineZoneAt(lat, lon) {
  const center = await oneMarineZone(lat, lon);
  if (center) return center;
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const r of [0.08, 0.18]) {                 // ~5.5 mi, then ~12 mi
    const hits = await Promise.all(dirs.map(([dLat, dLon]) => oneMarineZone(lat + dLat * r, lon + dLon * r)));
    const hit = hits.find(Boolean);
    if (hit) return hit;
  }
  return null;
}

// A short water-body label from a verbose zone name ("Chesapeake Bay from Pooles
// Island to Sandy Point MD" → "Chesapeake Bay"), for grouping. null if unknown.
function waterBodyFromZone(zoneName) {
  const m = String(zoneName || "").match(/\b(Lake (?:Erie|Ontario|Huron|Michigan|Superior)|Chesapeake Bay|Delaware Bay|Pamlico Sound|Albemarle Sound|Long Island Sound|San Francisco Bay|Puget Sound|Galveston Bay|Tampa Bay|Sabine Lake)\b/i);
  return m ? m[1] : null;
}

// Which way is the water from a point? Probe marine-zone membership in 8
// directions (~8 mi out) and average the directions that land on water. null
// when no direction (or every direction) is water — then there's no shoreline
// to orient to. The probes share the 1-day zone-lookup cache.
async function seaBearingAt(lat, lon) {
  const r = 0.12;
  const dirs = [0, 45, 90, 135, 180, 225, 270, 315];
  const hits = await Promise.all(dirs.map((d) => {
    const rad = (d * Math.PI) / 180;
    const kLon = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    return oneMarineZone(lat + Math.cos(rad) * r, lon + Math.sin(rad) * r * kLon).then((z) => !!z);
  }));
  const n = hits.filter(Boolean).length;
  if (!n || n === dirs.length) return null;
  let x = 0, y = 0;
  dirs.forEach((d, i) => { if (hits[i]) { x += Math.sin((d * Math.PI) / 180); y += Math.cos((d * Math.PI) / 180); } });
  if (Math.hypot(x, y) < 0.01) return null;
  return Math.round(((Math.atan2(x, y) * 180) / Math.PI + 360) % 360);
}

// Sheltered water (bays, sounds, rivers, the Intracoastal) vs open coastal
// ocean, from the NWS marine zone name. Great Lakes zones are "lake".
function waterFromZone(zoneId, zoneName) {
  if (GL_ZONE.test(zoneId)) return "lake";
  const n = String(zoneName || "");
  // Coastal-waters names win: they mention towns, rivers and sounds only as
  // boundaries ("Coastal waters from Little River Inlet to Murrells Inlet").
  if (/\bcoastal waters\b|\bout (to )?\d+ ?nm\b|\b\d+\s*-\s*\d+ ?nm\b|\b(leeward|windward|inner) waters\b/i.test(n)) return "ocean";
  if (/\b(bay|sound|intracoastal|river|harbor|harbour|lagoon|lake|estuary|channel)\b/i.test(n)) return "sheltered";
  // Unknown: the stricter (sheltered) thresholds are the safe default.
  return "sheltered";
}

// The live NWS resolution — the costly part: /points + the seaward ring search.
export async function resolveMarineContext(lat, lon) {
  const [pt, mz, sea] = await Promise.all([
    cachedJSON(`${NWS}/points/${lat},${lon}`, 86400).catch(() => null),
    marineZoneAt(lat, lon),
    seaBearingAt(lat, lon).catch(() => null),
  ]);
  if (!mz) return null; // no marine zone here → not boatable water we forecast
  const rel = pt?.properties?.relativeLocation?.properties;
  const product = GL_ZONE.test(mz.id) ? "NSH" : "CWF";
  return {
    zone: mz.id, zoneName: mz.name,
    office: pt?.properties?.gridId || "CLE",
    product,
    lake: waterBodyFromZone(mz.name) || (product === "NSH" ? "Great Lakes" : "Coastal waters"),
    water: waterFromZone(mz.id, mz.name),
    sea,
    relName: rel?.city ? `${rel.city}, ${rel.state}` : null,
  };
}

// Resolved context is ~static per cell and the ring search is the costly part,
// so cache it in KV keyed by snapped (~1 km) coords — a repeat or nearby search
// then costs one KV read, not up to ~17 NWS calls. Negatives (inland) are cached
// too (shorter TTL) behind a `marine` sentinel, so a cached miss is
// distinguishable from "never resolved". Falls back to a live resolve with no KV.
// ── User-built spots (self-serve "build a page") ─────────────────────────────
// Published points live in KV as builtspot:<slug>. They serve like a curated
// spot, but stay out of the directory/sitemap and are noindex until an admin
// features them (and an admin can disable or delete them).
async function getBuiltSpot(env, slug) {
  if (!env?.USERS) return null;
  const b = await env.USERS.get(`builtspot:${slug}`, "json").catch(() => null);
  if (!b || b.disabled) return null;
  return {
    name: b.name, lat: b.lat, lon: b.lon, zone: b.zone, zoneName: b.zoneName || null,
    office: b.office, product: b.product, buoys: b.buoys || [], lake: b.lake,
    // Pages built before coastal support carry no water/sea: derive the water
    // type from the zone name; without a bearing the grid is sampled at the point.
    water: b.water || waterFromZone(b.zone, b.zoneName), sea: b.sea ?? null,
    adHoc: true, built: true, slug: b.slug, featured: !!b.featured,
  };
}
export async function listFeaturedBuiltSpots(env) {
  if (!env?.USERS) return [];
  try {
    const list = await env.USERS.list({ prefix: "builtspot:", limit: 1000 });
    const out = [];
    for (const k of list.keys) {
      const b = await env.USERS.get(k.name, "json").catch(() => null);
      if (b && b.featured && !b.disabled) out.push(b);
    }
    return out;
  } catch (e) {
    return [];
  }
}

const snapCoord = (n) => Math.round(n * 100) / 100;
async function resolveSpotFromPoint(lat, lon, name, env) {
  lat = round(lat, 4); lon = round(lon, 4);
  // v2: contexts now carry water type + sea bearing; v1 entries treated coastal
  // points as inland (no waves), so they must not be reused.
  const key = `geoctx2:${snapCoord(lat)},${snapCoord(lon)}`;
  let cached = null;
  if (env?.USERS) cached = await env.USERS.get(key, "json").catch(() => null);
  let ctx;
  if (cached) {
    if (!cached.marine) return null; // cached inland point
    ctx = cached;
  } else {
    ctx = await resolveMarineContext(lat, lon);
    if (env?.USERS) {
      await env.USERS.put(key, JSON.stringify(ctx ? { marine: true, ...ctx } : { marine: false }),
        { expirationTtl: (ctx ? 60 : 7) * 86400 }).catch(() => {});
    }
    if (!ctx) return null;
  }
  const derivedName = name || ctx.relName || `${lat}, ${lon}`;
  return { name: derivedName, lat, lon, zone: ctx.zone, zoneName: ctx.zoneName, office: ctx.office, product: ctx.product, buoys: [], lake: ctx.lake, water: ctx.water || waterFromZone(ctx.zone, ctx.zoneName), sea: ctx.sea ?? null, adHoc: true };
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

// Highest wave height (ft) a single marine/nearshore period calls for, e.g.
// "Waves 1 to 3 feet building to 3 to 5 feet" -> 5, "2 feet or less" -> 2.
// We take the period's PEAK (not the first number): the nearshore product is
// the authoritative open-water forecast a boater actually meets once they leave
// the sheltered ramp, so under-reporting it would under-warn. "Occasionally" /
// "at times" gust-equivalent clauses are dropped so it reflects the sustained
// forecast, not the odd rogue wave.
function periodWaveFt(text) {
  let t = (text || "").toLowerCase();
  if (!t) return null;
  t = t.replace(/\b(?:occasionally|at times|isolated)\b[^.]*?f(?:ee|oo)t/g, " ");
  let max = null;
  const bump = (v) => { if (v != null && !Number.isNaN(v) && (max == null || v > max)) max = v; };
  let m, re = /(\d+)\s+to\s+(\d+)\s*f(?:ee|oo)t/g;       // "3 to 5 feet"
  while ((m = re.exec(t))) bump(Math.max(+m[1], +m[2]));
  re = /(?:around |about |up to |near )?(\d+)\s*f(?:ee|oo)t/g; // "around 4 feet" / bare "2 feet"
  while ((m = re.exec(t))) bump(+m[1]);
  if (max == null && /f(?:oo|ee)t or less|less than a foot/.test(t)) max = 1;
  return max;
}

// Current-period wave height (ft) from the marine/nearshore periods (the first
// period is "now"). The authoritative human forecast for the zone.
function parseForecastWaves(periods) {
  for (const p of periods || []) {
    const v = periodWaveFt(p.forecast || p.detailed || "");
    if (v != null) return v;
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

// Raise the grid's hourly waves to the authoritative nearshore forecast. The
// forecaster-edited grid samples the cell just off the ramp, which is sheltered
// and reads low; the nearshore product forecasts the open water a boater
// actually crosses. So we floor each hour's grid wave at its period's forecast
// peak (never lower it), which keeps the grid's timing but the nearshore's
// magnitude — and makes the headline, the hour-by-hour strip, and the week all
// agree with the nearshore report. Marine periods run in ~12h day/night blocks
// starting from "now", so we bucket each hour into a period by local half-day.
function applyMarineWaveFloor(grid, marine) {
  if (!grid || !marine || !marine.length) return;
  // Drop leading advisory / synopsis entries (e.g. a "Dense Smoke Advisory"
  // headline) that aren't day/night forecast periods, so period[0] lines up with
  // the current half-day. Real periods always carry a wind or wave number.
  const periods = marine.filter((p) => /\b(?:knots?|kt|mph|f(?:ee|oo)t|seas)\b/i.test(p.forecast || p.detailed || ""));
  if (!periods.length) return;
  const periodWaves = periods.map((p) => periodWaveFt(p.forecast || p.detailed || ""));
  if (!periodWaves.some((v) => v != null)) return;
  const toLocal = localParts(grid.tz);
  const halfIdx = (h) => {                       // monotonic day(06-18)/night index
    const { date, hour } = toLocal(h);
    const day = Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000);
    if (hour < 6) return (day - 1) * 2 + 1;      // small hours belong to the prior night
    if (hour < 18) return day * 2;               // daytime
    return day * 2 + 1;                          // evening / overnight
  };
  const base = halfIdx(Math.floor(Date.now() / 3600000));
  const keys = new Set([...grid.waveFt.keys(), ...grid.windKt.keys()]); // fill blank wave cells too
  for (const h of keys) {
    const slot = halfIdx(h) - base;
    if (slot < 0 || slot >= periodWaves.length) continue;
    const floor = periodWaves[slot];
    if (floor == null) continue;
    const g = grid.waveFt.get(h);
    if (g == null || floor > g) grid.waveFt.set(h, floor);
  }
}

// Water temperature (°F) parsed from the NSH text, which lists a few ports:
// "...water temperature off Toledo is 81 degrees, off Cleveland 73 degrees,
// and off Erie 76 degrees." Pick the port named in the spot, else a rough
// basin average — the fallback when a spot has no live buoy water temp.
function nshWaterTempF(text, spot) {
  if (!text) return null;
  const pairs = [];
  const re = /off\s+([a-z .'\-]+?)\s+(?:is\s+)?(\d{2,3})\s*degrees/gi;
  let m;
  while ((m = re.exec(text))) pairs.push({ place: m[1].trim().toLowerCase(), temp: +m[2] });
  if (!pairs.length) return null;
  const name = (spot.name || "").toLowerCase();
  const hit = pairs.find((p) => p.place && (name.includes(p.place) || name.split(/[ ,/]+/)[0] === p.place));
  if (hit) return hit.temp;
  return Math.round(pairs.reduce((a, p) => a + p.temp, 0) / pairs.length);
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
  N:   { tone: "bad",     short: "N onshore, chop piles on this shore", advice: "North wind blows straight across the lake onto the Ohio shore. Choppy right at the launch, usually rougher than the open-water number." },
  NNE: { tone: "bad",     short: "NNE onshore with a long fetch, steep waves", advice: "Out of the NNE: long fetch down the lake plus onshore. Builds steep, closely-spaced waves." },
  NE:  { tone: "bad",     short: "NE long fetch, Erie's roughest direction", advice: "NE has the longest fetch down the lake and blows onshore here. Notorious on Erie for steep, dangerous waves, so be very cautious." },
  ENE: { tone: "caution", short: "ENE long fetch, chop building", advice: "East-northeast with a long fetch down the lake; chop builds through the day." },
  E:   { tone: "caution", short: "E cross-shore, watch it build", advice: "Easterly cross-shore wind. Moderate chop that can build with a long fetch behind it." },
  ESE: { tone: "caution", short: "ESE offshore, calm at ramp, rougher out", advice: "Out of the SE (offshore): flat at the launch but it builds offshore and pushes you away from shore." },
  SE:  { tone: "caution", short: "SE offshore, deceptive at the ramp", advice: "Offshore from the SE. Water looks calm at the dock but gets rougher as you head out, and the wind pushes small boats away from shore." },
  SSE: { tone: "caution", short: "SSE offshore, deceptive, pushes you out", advice: "Southerly offshore wind: deceptively flat at the launch, rougher offshore, and it pushes you out. Mind the return trip." },
  S:   { tone: "caution", short: "S offshore, flat at shore, rough offshore", advice: "South wind is offshore here: calm near the beach but it builds offshore and you'll fight it coming back. Easy to underestimate." },
  SSW: { tone: "caution", short: "SSW offshore, long fetch to the east", advice: "SSW is offshore at the Ohio shore but runs the lake's long axis, so waves build toward the central and eastern basin." },
  SW:  { tone: "caution", short: "SW long fetch, waves build down the lake", advice: "Prevailing SW: longest fetch down the lake. Builds through the day, biggest toward Cleveland and east." },
  WSW: { tone: "caution", short: "WSW long fetch, building waves east", advice: "WSW runs the lake's long axis, so waves build through the day, largest toward the eastern basin." },
  W:   { tone: "ok",      short: "W cross/offshore, moderate", advice: "Westerly: cross-to-offshore here. Moderate chop, building toward the east end of the lake." },
  WNW: { tone: "caution", short: "WNW gusty post-front, chop onshore", advice: "WNW often follows a cold front: gusty and shifting, bringing chop onto the shore." },
  NW:  { tone: "caution", short: "NW onshore, chop onshore, often gusty", advice: "Northwest is onshore-ish and frequently post-frontal (gusty). Pushes chop onto the shore." },
  NNW: { tone: "bad",     short: "NNW onshore, chop piles on the shore", advice: "Out of the NNW: onshore, piling chop onto the Ohio shore." },
};
function windRead(dirCompass) {
  const r = dirCompass && WIND_READS[dirCompass];
  return r ? { dir: dirCompass, ...r } : null;
}

// ── Port-aware wind read for waters other than Lake Erie ─────────────────────
// The curated WIND_READS above are written for Lake Erie's Ohio/PA shore.
// Elsewhere we derive onshore / offshore / cross-shore from geometry: the
// bearing from the port toward the middle of its water body is "seaward" — wind
// blowing FROM seaward is onshore (chop stacks at the launch), FROM the
// opposite is offshore (deceptively flat at the ramp), the rest is cross-shore.
// A body listed here is treated as open water (a lakeward/seaward wave cell is
// sampled); a body NOT listed is treated as inland (waves stay blank). This is
// what lets the engine reach past the Great Lakes to coastal bays and sounds.
const WATER_CENTERS = {
  "Lake Erie": { lat: 42.2, lon: -81.2 }, // used by seawardPoint (wind reads use the curated table)
  "Lake Ontario": { lat: 43.7, lon: -77.9 },
  "Lake Huron": { lat: 44.8, lon: -82.4 },
  "Lake Michigan": { lat: 43.8, lon: -87.0 },
  "Lake Superior": { lat: 47.7, lon: -87.5 },
  // Coastal / tidal waters (NWS models waves + marine zones here too).
  "Chesapeake Bay": { lat: 38.7, lon: -76.4 },
  "Pamlico Sound": { lat: 35.35, lon: -75.95 },
};
const COMPASS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const compassToDeg = (c) => { const i = COMPASS_16.indexOf(c); return i < 0 ? null : i * 22.5; };
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function windReadFor(spot, dirCompass) {
  const lake = spot.lake || "Lake Erie";
  if (lake === "Lake Erie") return windRead(dirCompass); // curated south-shore reads
  const center = WATER_CENTERS[lake];
  const windDeg = compassToDeg(dirCompass);
  if ((!center && spot.sea == null) || windDeg == null) return null;
  // wind FROM the seaward bearing = onshore
  const seaward = spot.sea != null ? spot.sea : bearingDeg(spot.lat, spot.lon, center.lat, center.lon);
  const water = spot.openWater || lake; // prose name: "the Atlantic", "Tampa Bay", "Lake Huron"
  let diff = Math.abs(windDeg - seaward);
  if (diff > 180) diff = 360 - diff;
  if (diff <= 56.25) {
    return { dir: dirCompass, tone: "caution", short: `${dirCompass} onshore, chop stacks up at the launch`,
      advice: `${dirCompass} wind blows in off ${water}, piling waves onto this shore, and it's usually rougher at the ramp than the open-water number.` };
  }
  if (diff >= 123.75) {
    return { dir: dirCompass, tone: "caution", short: `${dirCompass} offshore, deceptively calm at the ramp`,
      advice: `${dirCompass} blows from shore out over ${water}: flat at the dock, but it builds as you head out and pushes you away from shore. Mind the trip back.` };
  }
  return { dir: dirCompass, tone: "ok", short: `${dirCompass} cross-shore, moderate`,
    advice: `${dirCompass} runs along the shoreline here: moderate chop; watch whether it trends onshore through the day.` };
}

// How each of the 16 wind directions plays at a launch, grouped the same way
// the live wind read describes it (windReadFor), so the launch-notes card and
// the server-rendered page never disagree with the live call. Lake Erie uses
// the curated south-shore table; other waters use the shoreline geometry.
export function windExposure(spot) {
  const out = { onshore: [], offshore: [], cross: [], roughest: [] };
  for (const d of COMPASS_16) {
    const r = windReadFor(spot, d);
    if (!r) continue;
    // The short label decides; only a label with no direction word (a few
    // curated Erie entries, e.g. "NE long fetch") falls back to the advice.
    const kind = (t) => (/\bcross[- ]?shore|cross\//.test(t) ? "cross" : /\bonshore/.test(t) ? "onshore" : /\boffshore/.test(t) ? "offshore" : null);
    out[kind(r.short.toLowerCase()) || kind((r.advice || "").toLowerCase()) || "cross"].push(d);
    if (r.tone === "bad") out.roughest.push(d);
  }
  return out;
}

// Static, verifiable facts about a launch: which NWS marine zone forecasts it,
// which NDBC stations feed it, and its wind exposure. Shown on the spot page
// and server-rendered into its HTML.
export function spotFacts(spot) {
  return {
    lake: spot.lake || "Lake Erie",
    lat: spot.lat, lon: spot.lon,
    zone: spot.zone || null,
    buoys: (spot.buoys || []).filter(Boolean),
    exposure: windExposure(spot),
  };
}

// ---- Water profiles ----
// The same numbers mean different things on different water. Great Lakes and
// sheltered bays/sounds build short, steep chop, so a couple of feet is already
// rough. Open ocean carries longer-period swell that rides far easier at the
// same height, and a 12-15 kt afternoon sea breeze is normal, not a warning.
// Ocean thresholds anchor to NWS marine practice: Florida offices advise
// "small craft should exercise caution" from 15 kt, and Small Craft Advisories
// start around 20-25 kt or 7 ft seas. Active NWS alerts override all of this.
//   lake      — Great Lakes (and inland lakes)
//   sheltered — bays, sounds, the Intracoastal: chop like a lake
//   ocean     — coastal waters out to 20 NM
export function waterProfile(spot) {
  if (spot.water === "ocean" || spot.water === "sheltered" || spot.water === "lake") return spot.water;
  const lake = spot.lake || "Lake Erie";
  if (/^Lake (Erie|Ontario|Huron|Michigan|Superior)$/.test(lake) || lake === "Great Lakes") return "lake";
  return "sheltered";
}
// Ocean seas → "NO-GO" | "CAUTION" | null. Steep (short-period) seas count
// for more: 5 ft every 7 s is a beating, 5 ft every 12 s is a long swell.
function oceanSeaRisk(ft, periodSec) {
  if (ft == null) return null;
  const steep = periodSec != null && periodSec > 0 && periodSec <= 7;
  if (ft >= 7 || (steep && ft >= 5)) return "NO-GO";
  if (ft >= 4 || (periodSec != null && periodSec > 0 && periodSec <= 6 && ft >= 3)) return "CAUTION";
  return null;
}

// ---- Hourly risk timeline ----
// Per-hour GO/CAUTION/NO-GO from the NWS hourly forecast + grid (wind or gusts,
// whichever is stronger — same treatment as the headline verdict — plus precip
// chance, thunderstorm wording, and wave height).
// windKt is the stronger of wind/gust (lakes); ocean also gets the sustained
// speed and gust separately via `ocean` = { sustained, gust }.
function hourRisk(windKt, precipPct, short, waveFt, periodSec = null, profile = "lake", ocean = null) {
  const s = (short || "").toLowerCase();
  const thunder = /thunder|tstm|waterspout/.test(s);
  const pop = precipPct ?? 0;
  if (thunder && pop >= 25) return "NO-GO";        // real storm chance
  if (profile === "ocean") {
    const sea = oceanSeaRisk(waveFt, periodSec);
    const w = ocean ? ocean.sustained : windKt, gu = ocean ? ocean.gust : null;
    if (sea === "NO-GO" || (w != null && w >= 22) || (gu != null && gu >= 28)) return "NO-GO";
    if (thunder || sea === "CAUTION" || (w != null && w >= 15) || (gu != null && gu >= 20) || pop >= 55) return "CAUTION";
    return "GO";
  }
  if (waveFt != null && waveFt >= 4) return "NO-GO";
  if (windKt != null && windKt >= 22) return "NO-GO";
  if (thunder) return "CAUTION";                   // slight storm chance
  if (waveFt != null && waveFt >= 2.5) return "CAUTION";
  if (windKt != null && windKt >= 15) return "CAUTION";
  if (pop >= 55) return "CAUTION";                 // likely rain
  return "GO";
}

function withRisk(hours, profile = "lake") {
  return (hours || []).map((h) => {
    const top = Math.max(h.windKt ?? -1, h.gustKt ?? -1);
    return { ...h, level: hourRisk(top < 0 ? null : top, h.precipPct, h.short, h.waveFt, h.periodSec, profile, { sustained: h.windKt ?? null, gust: h.gustKt ?? null }) };
  });
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
function buildRecommendation({ buoy, alerts, wind, waves, read, hours, profile = "lake" }) {
  const reasons = [];
  let level = "GO"; // GO < CAUTION < NO-GO
  const bump = (to, why) => {
    const order = { GO: 0, CAUTION: 1, "NO-GO": 2 };
    if (order[to] > order[level]) level = to;
    if (why) reasons.push(why);
  };

  // Active marine warnings dominate.
  // Shore-side alerts (air quality, rip currents for swimmers, coastal
  // flooding, heat) are listed but don't move a boating verdict: on the coasts
  // they run most days and would pin every launch at CAUTION. Watches are a
  // heads-up (CAUTION); marine warnings decide.
  const NOTE_ONLY = /air quality|rip current|beach hazard|coastal flood|lakeshore flood|flood (watch|warning|advisory|statement)|hydrologic|heat|frost|freeze|red flag|fire weather/;
  for (const a of alerts || []) {
    const ev = (a.event || "").toLowerCase();
    if (!ev) continue;
    if (NOTE_ONLY.test(ev)) reasons.push(`${a.event} in effect (shoreline, not a boating limit)`);
    else if (ev.includes("watch")) bump("CAUTION", `Active ${a.event}`);
    else if (ev.includes("gale") || ev.includes("storm") || ev.includes("special marine") || ev.includes("hurricane") || ev.includes("hazardous seas") || ev.includes("tsunami")) {
      bump("NO-GO", `Active ${a.event}`);
    } else bump("CAUTION", `Active ${a.event}`);
  }

  // Wave height — observed buoy if available, else NWS forecast, so it's never
  // blank (the western basin rarely has a reporting wave buoy).
  const wv = waves?.ft;
  const per = waves?.periodSec ?? hours?.[0]?.periodSec ?? null;
  if (wv != null && profile === "ocean") {
    // Open ocean: rate seas by height AND period (see oceanSeaRisk).
    const tag = waves.source === "forecast" ? " (forecast)" : "";
    const at = per ? ` at ${per}s` : "";
    const sea = oceanSeaRisk(wv, per);
    if (sea === "NO-GO") bump("NO-GO", `Seas ~${wv} ft${at}${tag}, hazardous for recreational boats`);
    else if (sea === "CAUTION") bump("CAUTION", `Seas ~${wv} ft${at}${tag}, rough for small boats`);
    else reasons.push(`Seas ~${wv} ft${at}${tag}, manageable`);
  } else if (wv != null) {
    const tag = waves.source === "forecast" ? " (forecast)" : "";
    if (wv >= 4) bump("NO-GO", `Waves ~${wv} ft${tag}, very rough`);
    else if (wv >= 3) bump("CAUTION", `Waves ~${wv} ft${tag}, rough for small boats`);
    else if (wv >= 2) bump("CAUTION", `Waves ~${wv} ft${tag}, choppy`);
    else reasons.push(`Waves ~${wv} ft${tag}, manageable`);
  }

  // Wind / gusts — buoy if reporting, otherwise NWS forecast, so wind ALWAYS
  // factors in (the decisive signal when wave data is missing).
  const topWind = Math.max(wind?.speedKt ?? 0, wind?.gustKt ?? 0);
  if (topWind) {
    const tag = wind?.source === "forecast" ? " (forecast)" : "";
    // Ocean: no "breezy" step at 12 kt; a 12-15 kt sea breeze is a normal
    // coastal afternoon, and the seas rule above carries the wave risk.
    if (profile === "ocean") {
      // Ocean trade/sea-breeze gusts run well above the sustained wind, and NWS
      // coastal advisories key on sustained speed, so rate them separately.
      const w = wind?.speedKt ?? 0, gu = wind?.gustKt ?? 0;
      const desc = `${round(w)} kt${gu > w ? `, gusts ${round(gu)}` : ""}${tag}`;
      if (w >= 22 || gu >= 28) bump("NO-GO", `Wind ~${desc}`);
      else if (w >= 17 || gu >= 24) bump("CAUTION", `Wind ~${desc}`);
      else if (w >= 15 || gu >= 20) bump("CAUTION", `Breezy ~${desc}`);
    }
    else if (topWind >= 22) bump("NO-GO", `Wind/gusts ~${round(topWind)} kt${tag}`);
    else if (topWind >= 17) bump("CAUTION", `Wind ~${round(topWind)} kt${tag}`);
    else if (topWind >= 12) bump("CAUTION", `Breezy ~${round(topWind)} kt${tag}`);
    else if (wv == null) reasons.push(`Wind ~${round(topWind)} kt${tag}, light`);
  }

  // Wind DIRECTION on the lake's fetch — only matters once there's some wind.
  if (read && topWind >= 10) {
    if (read.tone === "bad") bump("CAUTION", read.short);
    else if (read.tone === "caution") reasons.push(read.short);
  }

  // Wave STEEPNESS — period matters as much as height. Short-period chop is
  // the Great Lakes' signature misery; long-period rollers ride far easier.
  const periodSec = waves?.periodSec ?? hours?.[0]?.periodSec ?? null;
  if (wv != null && wv >= 2 && periodSec) {
    if (periodSec <= wv * 2) reasons.push(`Short-period chop: ${wv} ft at ${periodSec}s feels rougher than the number`);
    else if (periodSec >= wv * 3) reasons.push(`Longer-period waves (${periodSec}s): smoother ride than ${wv} ft suggests`);
  }

  // Cold water is a safety fact regardless of the verdict: under ~60°F,
  // unexpected immersion is dangerous (cold-shock). Flag, don't bump.
  if (buoy?.waterTempF != null && buoy.waterTempF < 60) {
    reasons.push(`Water ${round(buoy.waterTempF, 0)}°F, cold-shock risk if you go in; dress for immersion`);
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
    reasons.push("Thunderstorms later, watch the hourly timeline");
  }

  // No wind AND no waves means the upstream feeds failed (NOAA outage, timeout),
  // not that it's calm. Never call GO on missing data — fail to CAUTION and
  // say why, so a blank page can't read as "looks good".
  const noData = wv == null && wind?.speedKt == null && wind?.gustKt == null;
  if (noData) {
    bump("CAUTION", "Live wind and wave data are unavailable right now. Check the NWS marine forecast before you launch");
  } else if (reasons.length === 0) {
    reasons.push("Calm conditions reported");
  }
  if (!buoy && !noData) reasons.push("No live buoy here; using the NWS forecast, so verify before launch");

  const summary = noData
    ? "No live data right now. Check before you go."
    : {
        GO: "Looks good to boat.",
        CAUTION: "Boatable with caution. Small boats take care.",
        "NO-GO": "Not recommended. Stay in.",
      }[level];

  // Collapse duplicates (e.g. three concurrent Air Quality Alerts) so the
  // reason list stays clean instead of repeating the same line.
  return { level, summary, reasons: [...new Set(reasons)] };
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
async function camStatusFor(cams) {
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

// The effective cam list = built-ins minus admin-disabled, plus admin-added
// custom feeds (managed on /admin, stored in the site config in KV).
async function effectiveCams(env) {
  try {
    const cfg = env?.USERS ? await env.USERS.get("site:config", "json") : null;
    return applyCamConfig(cfg?.cams);
  } catch {
    return applyCamConfig(null);
  }
}

// GET /marine/cams?lake=… → { lake, status, cams } — the effective cam list for
// the lake plus per-cam liveness. ?fresh=1 (admin panel) bypasses the cache so
// saved changes and re-checks show up immediately.
// Nearest Windy webcams to a point, as embeddable cam entries. This is how any
// spot without a curated cam (built pages, coastal spots) still gets a live
// view. Requires WINDY_WEBCAMS_KEY; any failure returns [] so cams degrade to
// the curated list, never breaking the panel.
// Returns an array on success (possibly empty) or null on API failure, so the
// caller can report "no key" / "error" / "ok" distinctly in the response's
// `windy` field — otherwise a missing key and a dead API look identical.
async function fetchWindyCams(env, lat, lon, lake) {
  const key = env?.WINDY_WEBCAMS_KEY;
  if (!key || lat == null || lon == null) return null;
  try {
    // Over-fetch so we can rank: water views (harbor, bay, beach…) beat city
    // and traffic cams for a boating audience, and live streams beat replays.
    const u = `https://api.windy.com/webcams/api/v3/webcams?nearby=${round(lat, 3)},${round(lon, 3)},60&limit=20&include=categories,location,player,urls`;
    const r = await fetch(u, { headers: { "X-WINDY-API-KEY": key, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    const list = d?.webcams || d?.result?.webcams || [];
    const WATER = /beach|harbou?r|\bbay\b|coast|lake|river|marina|\bpier\b|\bport\b|water|island|\bsea\b/i;
    const scored = [];
    for (const w of list) {
      const id = w.webcamId ?? w.id;
      if (!id) continue;
      // v3 returns player entries as plain URL strings; v2 wrapped them in
      // objects with an .embed property. Accept both. Live stream first —
      // the day player is a 24 h replay, not a live view — and only fall back
      // to the id-built day player when no player was listed at all.
      const p = w.player || {};
      const asUrl = (v) => (typeof v === "string" ? v : v?.embed);
      const live = asUrl(p.live);
      const embed = live || asUrl(p.day) || asUrl(p.lifetime) || asUrl(p.month) || asUrl(p.year)
        || `https://webcams.windy.com/webcams/public/embed/player/${id}/day`;
      const loc = w.location || {};
      // Windy sometimes returns the literal string "unknown" for city/region.
      const clean = (v) => (v && !/^unknown$/i.test(String(v).trim()) ? v : "");
      const city = clean(loc.city) || clean(loc.region) || "";
      const title = (w.title || city || "Webcam").trim();
      const label = `${title}${city && !title.toLowerCase().includes(String(city).toLowerCase()) ? ` · ${city}` : ""}`.slice(0, 72);
      const catStr = (w.categories || []).map((c) => `${c?.id || ""} ${c?.name || ""}`).join(" ");
      const watery = WATER.test(catStr) || WATER.test(title);
      const traffic = /traffic/i.test(catStr);
      scored.push({
        watery, live: !!live, traffic,
        cam: {
          name: `${label} (${live ? "Windy" : "Windy · replay"})`, lat: loc.latitude ?? lat, lon: loc.longitude ?? lon, lake,
          embed, link: w.urls?.detail || w.urls?.provider || `https://www.windy.com/webcams/${id}`, source: "windy",
        },
      });
    }
    // Water first, live before replay, traffic cams last; ties keep Windy's
    // nearest-first order. Cut to 5 after ranking.
    scored.sort((a, b) => (b.watery - a.watery) || (a.traffic - b.traffic) || (b.live - a.live));
    const out = scored.slice(0, 5).map((s) => s.cam);
    out.raw = list.length;
    return out;
  } catch (e) {
    return null;
  }
}

// Planar-ish distance in degrees (only for "is there a curated cam near here").
function degDist(la, lo, la2, lo2) {
  const dx = (lo - lo2) * Math.cos(((la + la2) / 2) * Math.PI / 180);
  return Math.hypot(dx, la - la2);
}

async function handleCamStatus(url, env) {
  const lake = url.searchParams.get("lake") || "Lake Erie";
  const lat = url.searchParams.has("lat") ? parseFloat(url.searchParams.get("lat")) : null;
  const lon = url.searchParams.has("lon") ? parseFloat(url.searchParams.get("lon")) : null;
  const hasPt = Number.isFinite(lat) && Number.isFinite(lon);
  const fresh = url.searchParams.get("fresh") === "1";
  const cellKey = hasPt ? `${round(lat, 2)},${round(lon, 2)}` : lake;
  const cacheKey = new Request(`https://cam-status.local/${encodeURIComponent(cellKey)}`);
  const cache = caches.default;
  if (!fresh) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  const cams = (await effectiveCams(env)).filter((c) => (c.lake || "Lake Erie") === lake);
  const status = await camStatusFor(cams);
  // No curated cam within ~60 mi of the point? Pull in nearby Windy webcams.
  // `windy` reports why there aren't any: "no-key" (secret unset), "error"
  // (API call failed), "ok:N", or "curated"/"off" when Windy wasn't consulted.
  const nearCurated = hasPt && cams.some((c) => degDist(lat, lon, c.lat, c.lon) <= 0.85);
  let windy = hasPt ? (nearCurated ? "curated" : "no-key") : "off";
  if (hasPt && !nearCurated && env?.WINDY_WEBCAMS_KEY) {
    const found = await fetchWindyCams(env, lat, lon, lake);
    if (found == null) windy = "error";
    else {
      // ok:<usable>/<returned-by-api> — distinguishes "API found nothing
      // nearby" from "cams returned but none parsed into an embed".
      windy = `ok:${found.length}/${found.raw ?? found.length}`;
      for (const w of found) { cams.push(w); status[w.name] = "live"; }
    }
  }
  const resp = new Response(JSON.stringify({ lake, status, cams, windy }), {
    headers: { "Content-Type": "application/json", "Cache-Control": fresh ? "no-store" : "public, max-age=180" },
  });
  if (!fresh) await cache.put(cacheKey, resp.clone());
  return resp;
}

// Lightweight GO/CAUTION/NO-GO + wind/wave for every spot, for the homepage
// directory. Per-spot NWS grid fetches through a small pool; /points lookups
// are edge-cached a day and the whole result ~10 min, so the API isn't hammered.
// One directory/email tile (verdict + wind/wave) from a spot and its grid.
function summaryTile(id, s, g, nowH) {
  const windKt = round(sampleNear(g?.windKt, nowH), 0);
  const gustKt = round(sampleNear(g?.gustKt, nowH), 0);
  const dirDeg = sampleNear(g?.windDirDeg, nowH);
  const dir = dirDeg == null ? null : degToCompass(dirDeg);
  const waveFt = round(sampleNear(g?.waveFt, nowH), 1);
  const periodSec = round(sampleNear(g?.periodSec, nowH), 0);
  // Storm-aware verdict: precip + thunder from the grid, so a calm-wind
  // thunderstorm evening doesn't show a wall of GO tiles while the detail
  // page (correctly) says NO-GO. Same "now or imminent" window as the detail
  // verdict: this hour or the next.
  const precipPct = Math.max(g?.precipPct.get(nowH) ?? 0, g?.precipPct.get(nowH + 1) ?? 0);
  const thunder = g?.thunder.get(nowH) === true || g?.thunder.get(nowH + 1) === true;
  const level = windKt == null && waveFt == null ? null : hourRisk(windKt, precipPct, thunder ? "thunderstorms" : "", waveFt, periodSec, waterProfile(s), { sustained: windKt, gust: gustKt });
  // lat/lon travel with each spot so the homepage can find the nearest launch
  // from a ZIP or the browser's location without a second request.
  return { id, name: s.name, lake: s.lake || "Lake Erie", lat: s.lat, lon: s.lon, level, windKt, gustKt, dir, waveFt, periodSec };
}

// Lightweight GO/CAUTION/NO-GO + wind/wave for every spot, for the homepage
// directory. Per-spot NWS grid fetches through a small pool; /points lookups
// are edge-cached a day and the whole result ~10 min, so the API isn't hammered.
export async function fetchSummary(env) {
  // Curated spots + admin-featured user-built pages (both render in the directory).
  const built = await listFeaturedBuiltSpots(env);
  const entries = [...Object.entries(SPOTS), ...built.map((b) => [b.slug, { name: b.name, lat: b.lat, lon: b.lon, zone: b.zone, office: b.office, product: b.product, lake: b.lake, buoys: b.buoys || [], water: b.water || waterFromZone(b.zone, b.zoneName), sea: b.sea ?? null }])];
  const grids = await pooled(entries, 8, ([, s]) => fetchSpotGrid(s));
  const nowH = Math.floor(Date.now() / 3600000);
  const spots = entries.map(([id, s], i) => summaryTile(id, s, grids[i], nowH));
  return { spots, updatedAt: new Date().toISOString() };
}

// Summary tiles for specific user-built pages by slug — so the daily digest /
// alert emails can cover a member's built page even before it's featured.
export async function fetchBuiltSummaries(env, slugs) {
  const resolved = [];
  for (const slug of [...new Set(slugs)]) { const b = await getBuiltSpot(env, slug); if (b) resolved.push([slug, b]); }
  if (!resolved.length) return [];
  const grids = await pooled(resolved, 8, ([, s]) => fetchSpotGrid(s));
  const nowH = Math.floor(Date.now() / 3600000);
  return resolved.map(([id, s], i) => summaryTile(id, s, grids[i], nowH));
}

// Today's best GO window for every port (for the daily digest email): per-spot
// NWS grid hourlies, then the longest contiguous GO run between 6am and 8pm in
// the spot's local time. Returns { spotId: {from, to, hours} | null }.
const fmtH12 = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
export async function fetchTodayWindows() {
  const entries = Object.entries(SPOTS);
  const grids = await pooled(entries, 8, ([, s]) => fetchSpotGrid(s));
  const nowH = Math.floor(Date.now() / 3600000);
  const out = {};
  entries.forEach(([id], i) => {
    const g = grids[i];
    if (!g) { out[id] = null; return; }
    const toLocal = localParts(g.tz);
    const today = toLocal(nowH).date;
    let best = null, run = null;
    for (let h = nowH - 23; h <= nowH + 30; h++) {
      const loc = toLocal(h);
      if (loc.date !== today || loc.hour < 6 || loc.hour > 20) { run = null; continue; }
      const windKt = round(g.windKt.get(h), 0);
      const waveFt = round(g.waveFt.get(h), 1);
      const ok = windKt != null && hourRisk(windKt, g.precipPct.get(h) ?? 0, g.thunder.get(h) ? "thunderstorms" : "", waveFt, round(g.periodSec.get(h), 0), waterProfile(SPOTS[id] || {})) === "GO";
      if (!ok) { run = null; continue; }
      if (!run) { run = { fromH: loc.hour, toH: loc.hour }; } else run.toH = loc.hour;
      if (!best || (run.toH - run.fromH) > (best.toH - best.fromH)) best = { ...run };
    }
    out[id] = best ? { from: fmtH12(best.fromH), to: fmtH12(best.toH + 1), hours: best.toH - best.fromH + 1 } : null;
  });
  return out;
}

async function handleSummary(env) {
  const cacheKey = new Request("https://sib-summary.local/all");
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const resp = new Response(JSON.stringify(await fetchSummary(env)), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
  });
  await cache.put(cacheKey, resp.clone());
  return resp;
}

// The edge-cached directory summary as an object (same cache as the homepage
// fetch). Server-rendered pages use it to put today's real verdicts in their
// HTML; null on failure.
export async function cachedSummary(env) {
  try { return await (await handleSummary(env)).json(); } catch (e) { return null; }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.pathname.endsWith("/cams")) return handleCamStatus(url, context.env);
  if (url.searchParams.has("summary")) return handleSummary(context.env);

  if (url.searchParams.has("spots")) {
    const built = await listFeaturedBuiltSpots(context.env);
    return json({
      spots: [
        ...Object.entries(SPOTS).map(([id, s]) => ({
          id, name: s.name, zone: s.zone, lat: s.lat, lon: s.lon,
          lake: s.lake || "Lake Erie", // each spot carries its lake → grouped picker, scales to all 5
        })),
        ...built.map((b) => ({ id: b.slug, name: b.name, zone: b.zone, lat: b.lat, lon: b.lon, lake: b.lake, built: true })),
      ],
    });
  }

  // Ad-hoc point (?lat=&lon=): the coordinate-driven engine behind location
  // search and "build a page" — resolve the marine context for ANY point and
  // run the same pipeline. Falls back to the curated ?spot= lookup otherwise.
  const latP = parseFloat(url.searchParams.get("lat"));
  const lonP = parseFloat(url.searchParams.get("lon"));
  let spot, spotId;
  if (Number.isFinite(latP) && Number.isFinite(lonP) && Math.abs(latP) <= 90 && Math.abs(lonP) <= 180) {
    spot = await resolveSpotFromPoint(latP, lonP, url.searchParams.get("name") || null, context.env);
    if (!spot) {
      return json({ error: "No NWS marine forecast covers that spot — it doesn't look like boatable open water.", notMarine: true }, 422);
    }
    spotId = `@${round(latP, 3)},${round(lonP, 3)}`;
  } else {
    spotId = (url.searchParams.get("spot") || "sandusky").toLowerCase();
    spot = SPOTS[spotId] || await getBuiltSpot(context.env, spotId); // curated, else a user-built page
    if (!spot) {
      return json({ error: `Unknown spot '${spotId}'` }, 404);
    }
  }

  // Fetch all sources concurrently; each resolves to null on failure so one
  // bad source never sinks the whole response.
  const [buoy, fc, marine, alerts, noaaReport, grid] = await Promise.all([
    fetchBuoy(spot.buoys),
    fetchForecastsNear(spot),
    fetchMarineForecast(spot.zone),
    fetchAlerts(spot.lat, spot.lon),
    fetchMarineText(spot.office || "CLE", spot.product || "NSH"), // NSH on the lakes, CWF on the coasts
    fetchSpotGrid(spot),
  ]);
  const point = fc.daily;
  // The nearshore periods, from the marine-zone API or (fallback) the NSH text.
  const marinePeriods = (marine && marine.length) ? marine : nshPeriodsForZone(noaaReport?.text, spot.zone);
  // Floor the grid's hourly waves at the authoritative nearshore forecast BEFORE
  // deriving the week and the hourly strip, so every wave number on the page
  // comes from one (nearshore-corrected) series and they can't disagree.
  applyMarineWaveFloor(grid, marinePeriods);
  const profile = waterProfile(spot);
  const week = buildWeek(grid, profile);
  const sun = sunTimes(spot.lat, spot.lon);
  // Merge hourly wave height (NWS grid) into the NWS hourly rows, then rate
  // risk. Keyed by epoch hour, so spots outside Eastern time line up too.
  const hourly = withRisk(
    fc.hourly.map((h) => {
      const eh = Math.floor(Date.parse(h.time) / 3600000);
      return {
        ...h,
        waveFt: round(grid?.waveFt.get(eh), 1),
        periodSec: round(grid?.periodSec.get(eh), 0),
        gustKt: round(grid?.gustKt.get(eh), 0), // NWS hourly forecast has no gusts; the grid does
      };
    }),
    profile
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

  // Effective waves reflect RIGHT NOW and agree with the hour-by-hour strip,
  // because the strip's current hour is already floored at the nearshore
  // forecast (applyMarineWaveFloor above). Order: live buoy, then that
  // nearshore-corrected current hour, then the zone text where the grid has no
  // cell at all (some coastal/estuary spots).
  const gridNowFt = hourly[0]?.waveFt ?? null;
  const gridNowPeriod = hourly[0]?.periodSec ?? null;
  const textWaveFt = parseForecastWaves(marinePeriods) ?? null;
  const currentWaveFt = gridNowFt ?? textWaveFt;
  const waves = {
    ft: buoy?.waveHeightFt ?? currentWaveFt ?? null,
    periodSec: buoy?.dominantPeriodSec ?? gridNowPeriod ?? null,
    source: buoy?.waveHeightFt != null ? "buoy" : currentWaveFt != null ? "forecast" : null,
  };

  // Water temp: live buoy, else the NSH text (which lists a few ports). Air
  // temp: live buoy, else the current hour of the NWS point forecast. So the
  // Water/Air tiles aren't blank at the many spots with no reporting buoy.
  const waterTempF = buoy?.waterTempF ?? nshWaterTempF(noaaReport?.text, spot);
  const airTempF = buoy?.airTempF ?? hourly[0]?.tempF ?? null;
  const temps = {
    waterF: waterTempF ?? null,
    waterSource: buoy?.waterTempF != null ? "buoy" : waterTempF != null ? "NWS" : null,
    airF: airTempF ?? null,
    airSource: buoy?.airTempF != null ? "buoy" : airTempF != null ? "NWS" : null,
  };

  const read = windReadFor(spot, wind.dir);
  const recommendation = buildRecommendation({ buoy, alerts, wind, waves, read, hours: hourly, profile });

  return json({
    spot: { id: spotId, name: spot.name, zone: spot.zone, lat: spot.lat, lon: spot.lon, lake: spot.lake || "Lake Erie", adHoc: !!spot.adHoc, zoneName: spot.zoneName || null, built: !!spot.built, slug: spot.slug || null, featured: !!spot.featured },
    updatedAt: new Date().toISOString(),
    recommendation,
    wind,
    waves,
    temps,
    windRead: read,
    facts: spotFacts(spot),
    hourly,
    outlook,
    week,
    sun,
    buoy,
    alerts: alerts || [],
    marineForecast: marinePeriods,
    pointForecast: point || [],
    noaaReport,
    sources: {
      buoy: buoy ? `NDBC ${buoy.station}` : "no live buoy",
      forecast: "NWS api.weather.gov",
      marineZone: spot.zone,
    },
  });
}
