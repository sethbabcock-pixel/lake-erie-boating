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
    lat: 41.694, lon: -83.32, zone: "LEZ142", land: ["OHZ003", "OHC095"], buoys: ["45005", "THLO1"],
  },
  "port-clinton": {
    name: "Port Clinton / Catawba",
    lat: 41.512, lon: -82.94, zone: "LEZ143", land: ["OHZ007", "OHC123"], buoys: ["45005"],
  },
  "put-in-bay": {
    name: "Put-in-Bay / South Bass Island",
    lat: 41.652, lon: -82.82, zone: "LEZ143", land: ["OHZ007", "OHC123"], buoys: ["SBIO1", "45005"],
  },
  sandusky: {
    name: "Sandusky / Cedar Point",
    lat: 41.46, lon: -82.71, zone: "LEZ144", land: ["OHZ009", "OHC043"], buoys: ["45005"],
    // Sandusky Bay, Cedar Point and the launch are all in LEZ144 (The Islands
    // to Vermilion); the islands a boater runs out to are LEZ143: watch both.
    alertZones: ["LEZ143"],
  },
  vermilion: {
    name: "Vermilion / Lorain",
    lat: 41.47, lon: -82.31, zone: "LEZ144", buoys: ["45176", "45164", "45005"],
    // Spans the Erie/Lorain county line (launch point is on the Lorain side;
    // the inland walk lands in Erie County): watch both.
    land: ["OHZ009", "OHC043", "OHZ010", "OHC093"],
    // Vermilion harbor is the LEZ144/LEZ145 line; the launch point and the
    // whole grid walk sit in LEZ145 (Vermilion to Avon Point, Lorain): watch both.
    alertZones: ["LEZ145"],
  },
  cleveland: {
    name: "Cleveland",
    lat: 41.507, lon: -81.706, zone: "LEZ146", land: ["OHZ011", "OHC035"], buoys: ["45164", "45176"],
  },
  fairport: {
    name: "Fairport Harbor / Mentor",
    lat: 41.76, lon: -81.28, zone: "LEZ147", land: ["OHZ012", "OHC085"], buoys: ["45207", "45164", "45167"],
  },
  conneaut: {
    name: "Conneaut / Ashtabula",
    lat: 41.96, lon: -80.55, zone: "LEZ148", land: ["OHZ089", "OHC007"], buoys: ["45207", "45167"],
  },
  erie: {
    name: "Erie, PA / Presque Isle",
    lat: 42.16, lon: -80.11, zone: "LEZ149", land: ["PAZ001", "PAC049"], buoys: ["45167"],
  },

  // ── Other Great Lakes (US shores). zone/office resolved from NWS; buoys
  // optional (wind from forecast, waves from the NWS grid cover spots w/o buoys).
  rochester: { name: "Rochester", lat: 43.22, lon: -77.62, zone: "LOZ043", land: ["NYZ003", "NYC055"], office: "BUF", buoys: ["45012"], lake: "Lake Ontario", sea: 0 },
  "sodus-bay": { name: "Sodus Bay", lat: 43.27, lon: -76.97, zone: "LOZ043", land: ["NYZ004", "NYC117"], office: "BUF", buoys: ["45012"], lake: "Lake Ontario", sea: 0 },
  oswego: { name: "Oswego", lat: 43.47, lon: -76.51, zone: "LOZ044", land: ["NYZ006", "NYC075"], office: "BUF", buoys: ["45012"], lake: "Lake Ontario", sea: 315 },
  "sackets-harbor": { name: "Sackets Harbor", lat: 43.94, lon: -76.12, zone: "LOZ045", land: ["NYZ007", "NYC045"], office: "BUF", buoys: [], lake: "Lake Ontario" },
  olcott: { name: "Olcott / Wilson", lat: 43.34, lon: -78.72, zone: "LOZ042", land: ["NYZ001", "NYC063"], office: "BUF", buoys: [], lake: "Lake Ontario", sea: 20 },

  "port-huron": { name: "Port Huron", lat: 42.98, lon: -82.42, zone: "LHZ443", land: ["MIZ063", "MIC147"], office: "DTX", buoys: [], lake: "Lake Huron", sea: 15, waterBuoys: ["45209", "AGCM4"] },
  tawas: { name: "Tawas Bay", lat: 44.2775, lon: -83.488, zone: "LHZ349", land: ["MIZ036", "MIC069"], office: "APX", buoys: [], lake: "Lake Huron", sea: 175, gridSteps: [0.1, 0.22] },
  alpena: { name: "Alpena / Thunder Bay", lat: 45.06, lon: -83.42, zone: "LHZ348", land: ["MIZ024", "MIC007"], office: "APX", buoys: ["45003"], lake: "Lake Huron", sea: 115, gridSteps: [0.14, 0.18, 0.22], waterBuoys: ["LPNM4", "45212"] },
  "harbor-beach": { name: "Harbor Beach", lat: 43.84, lon: -82.64, zone: "LHZ442", land: ["MIZ049", "MIC063"], office: "DTX", buoys: [], lake: "Lake Huron", sea: 45, waterBuoys: ["HRBM4", "45149"] },
  mackinaw: { name: "Mackinaw City / Straits", lat: 45.78, lon: -84.72, zone: "LHZ345", land: ["MIZ017", "MIC031", "MIZ016", "MIC047"] /* ~1 km east of the Cheboygan/Emmet line: watch both counties */, office: "APX", buoys: [], lake: "Lake Michigan", sea: 20, waterBuoys: ["MACM4", "45194"] },

  chicago: { name: "Chicago", lat: 41.89, lon: -87.60, zone: "LMZ741", land: ["ILZ104", "ILC031"], office: "LOT", buoys: ["45198"], lake: "Lake Michigan", waterBuoys: ["45170"] },
  milwaukee: { name: "Milwaukee", lat: 43.03, lon: -87.88, zone: "LMZ645", land: ["WIZ066", "WIC079"], office: "MKX", buoys: ["45013"], lake: "Lake Michigan" },
  muskegon: { name: "Muskegon", lat: 43.23, lon: -86.34, zone: "LMZ847", land: ["MIZ050", "MIC121"], office: "GRR", buoys: ["45161"], lake: "Lake Michigan", sea: 270, waterBuoys: ["45029", "HLNM4"] },
  holland: { name: "Holland", lat: 42.77, lon: -86.21, zone: "LMZ846", land: ["MIZ064", "MIC005"], office: "GRR", buoys: [], lake: "Lake Michigan", sea: 270, waterBuoys: ["HLNM4", "45029"] },
  "traverse-city": { name: "Traverse City", lat: 44.76, lon: -85.62, zone: "LMZ323", land: ["MIZ026", "MIC055"], office: "APX", buoys: [], lake: "Lake Michigan", sea: 15 },
  sheboygan: { name: "Sheboygan", lat: 43.75, lon: -87.715, zone: "LMZ643", land: ["WIZ052", "WIC117"], office: "MKX", buoys: [], lake: "Lake Michigan", waterBuoys: ["45210"] },
  "michigan-city": { name: "Michigan City", lat: 41.72, lon: -86.91, zone: "LMZ046", land: ["INZ103", "INC091"], office: "IWX", buoys: ["45198"], lake: "Lake Michigan", waterBuoys: ["45170", "45026"] },
  petoskey: { name: "Petoskey", lat: 45.373, lon: -84.955, zone: "LMZ342", land: ["MIZ016", "MIC047"], office: "APX", buoys: [], lake: "Lake Michigan", sea: 300, waterBuoys: ["MACM4", "45194"] },
  "harbor-springs": { name: "Harbor Springs", lat: 45.431, lon: -84.992, zone: "LMZ342", land: ["MIZ016", "MIC047"], office: "APX", buoys: [], lake: "Lake Michigan", waterBuoys: ["MACM4", "45194"] },
  "cross-village": { name: "Cross Village", lat: 45.641, lon: -85.032, zone: "LMZ342", land: ["MIZ016", "MIC047"], office: "APX", buoys: [], lake: "Lake Michigan", sea: 270, waterBuoys: ["45194", "MACM4"] },

  duluth: { name: "Duluth", lat: 46.78, lon: -92.08, zone: "LSZ145", land: ["MNZ037", "MNC137"], office: "DLH", buoys: ["45027"], lake: "Lake Superior", waterBuoys: ["DULM5"] },
  bayfield: { name: "Bayfield / Apostle Is.", lat: 46.81, lon: -90.82, zone: "LSZ147", land: ["WIZ002", "WIC007"], office: "DLH", buoys: [], lake: "Lake Superior", alertZones: ["LSZ121"] /* Chequamegon Bay, just south of the launch */ },
  marquette: { name: "Marquette", lat: 46.54, lon: -87.38, zone: "LSZ249", land: ["MIZ005", "MIC103"], office: "MQT", buoys: ["45004"], lake: "Lake Superior" },
  // Houghton sits on Portage Lake, whose grid cells are only placeholders, so
  // its waves are rated on open Superior at the Portage Canal's North Entry
  // (~13 km NNW): LSZ242 just west of the entry (the grid walk's cells),
  // LSZ243 just east of it. The waterway itself and Keweenaw Bay at the
  // Lower Entrance (the other way out) are LSZ246, which often carries its
  // own advisories/gales on NE-E winds: watch all three.
  houghton: { name: "Houghton / Keweenaw", lat: 47.12, lon: -88.57, zone: "LSZ242", alertZones: ["LSZ243", "LSZ246"], openWater: "Lake Superior off the North Entry", land: ["MIZ003", "MIC061"], office: "MQT", buoys: [], lake: "Lake Superior", sea: 330, gridSteps: [0.13, 0.16, 0.22] },
  "grand-marais": { name: "Grand Marais, MN", lat: 47.75, lon: -90.33, zone: "LSZ140", land: ["MNZ021", "MNC031"], office: "DLH", buoys: [], lake: "Lake Superior", waterBuoys: ["GDMM5", "45006"] },

  // ── Beyond the Great Lakes: coastal / tidal waters. Same NWS grid + marine
  // zone + NDBC pipeline — the water body (`lake`) just needs a WATER_CENTERS
  // entry so a seaward wave cell gets sampled. Zone/office/buoy IDs are the
  // NWS/NDBC identifiers for each area; verify against live data when adding more.
  "middle-river": { name: "Middle River / Essex, MD", lat: 39.31, lon: -76.40, zone: "ANZ531", land: ["MDZ011", "MDC005"], office: "LWX", product: "CWF", buoys: ["FSKM2", "44062"], lake: "Chesapeake Bay", waterBuoys: ["44080", "BLTM2"] },
  "bath-nc": { name: "Bath / Pamlico River, NC", lat: 35.44, lon: -76.75, zone: "AMZ136", land: ["NCZ080", "NCC013"], office: "MHX", product: "CWF", buoys: [], lake: "Pamlico Sound" },
  // ── Warm-weather coasts. Zone/office/buoys resolved from api.weather.gov and
  // NDBC's active-station list (Oct 2026); `sea` is the bearing toward open
  // water (wave sampling + onshore/offshore reads); `water` picks the verdict
  // thresholds (see waterProfile); `openWater` is the prose name.
  // Florida Atlantic Coast, Biscayne Bay and the Keys
  jacksonville: { name: "Jacksonville / Mayport, FL", lat: 30.395, lon: -81.41, zone: "AMZ452", land: ["FLZ125", "FLC031"], office: "JAX", product: "CWF", buoys: ["MYPF1", "BLIF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  "st-augustine": { name: "St. Augustine, FL", lat: 29.89, lon: -81.29, zone: "AMZ454", land: ["FLZ333", "FLC109"], office: "JAX", product: "CWF", buoys: ["SAUF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic", bar: { name: "St. Augustine Inlet", inlet: true }, waterBuoys: ["41117", "MYPF1"] },
  "ponce-inlet": { name: "Ponce Inlet / New Smyrna, FL", lat: 29.08, lon: -80.93, zone: "AMZ550", land: ["FLZ141", "FLC127"], office: "MLB", product: "CWF", buoys: ["41069"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic", bar: { name: "Ponce de Leon Inlet", inlet: true } },
  "port-canaveral": { name: "Port Canaveral / Cocoa Beach, FL", lat: 28.41, lon: -80.61, zone: "AMZ552", land: ["FLZ447", "FLC009"], office: "MLB", product: "CWF", buoys: ["TRDF1", "41009"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic", waterBuoys: ["41113"] },
  "sebastian-inlet": { name: "Sebastian Inlet, FL", lat: 27.86, lon: -80.45, zone: "AMZ552", land: ["FLZ747", "FLC009", "FLZ154", "FLC061"] /* inlet is the Brevard/Indian River line; walk picked the mainland zone */, office: "MLB", product: "CWF", buoys: ["SIPF1", "41068"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic", bar: { name: "Sebastian Inlet", inlet: true }, waterBuoys: ["41114", "41113"] },
  "fort-pierce": { name: "Fort Pierce, FL", lat: 27.47, lon: -80.3, zone: "AMZ555", land: ["FLZ159", "FLC111"], office: "MLB", product: "CWF", buoys: ["41068", "SIPF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic" },
  jupiter: { name: "Jupiter Inlet, FL", lat: 26.945, lon: -80.075, zone: "AMZ650", land: ["FLZ168", "FLC099"], office: "MFL", product: "CWF", buoys: ["LKWF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 68, openWater: "the Atlantic", bar: { name: "Jupiter Inlet", inlet: true } },
  "palm-beach": { name: "Palm Beach Inlet, FL", lat: 26.77, lon: -80.04, zone: "AMZ650", land: ["FLZ168", "FLC099"], office: "MFL", product: "CWF", buoys: ["LKWF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 90, openWater: "the Atlantic" },
  "fort-lauderdale": { name: "Fort Lauderdale, FL", lat: 26.1, lon: -80.11, zone: "AMZ651", land: ["FLZ172", "FLC011"], office: "MFL", product: "CWF", buoys: ["PEGF1", "VAKF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 113, openWater: "the Atlantic", waterBuoys: ["41122", "LKWF1"] },
  miami: { name: "Miami / Government Cut, FL", lat: 25.765, lon: -80.135, zone: "AMZ651", land: ["FLZ173", "FLC086"] /* coastal Miami-Dade; walk reached the inland metro zone */, office: "MFL", product: "CWF", buoys: ["VAKF1", "PEGF1"], lake: "Florida Atlantic Coast", water: "ocean", sea: 135, openWater: "the Atlantic" },
  "biscayne-bay": { name: "Biscayne Bay / Coconut Grove, FL", lat: 25.72, lon: -80.23, zone: "AMZ630", land: ["FLZ173", "FLC086"], office: "MFL", product: "CWF", buoys: ["VAKF1", "PEGF1"], lake: "Florida Atlantic Coast", water: "sheltered", sea: 135, openWater: "Biscayne Bay" },
  "key-largo": { name: "Key Largo, FL", lat: 25.09, lon: -80.44, zone: "GMZ042", land: ["FLZ076", "FLC087"], office: "KEY", product: "CWF", buoys: [], lake: "Florida Keys", water: "ocean", sea: 120, openWater: "the Atlantic" },
  islamorada: { name: "Islamorada, FL", lat: 24.92, lon: -80.63, zone: "GMZ042", land: ["FLZ076", "FLC087"], office: "KEY", product: "CWF", buoys: ["WRBF1"], lake: "Florida Keys", water: "ocean", sea: 135, openWater: "the Atlantic" },
  marathon: { name: "Marathon, FL", lat: 24.71, lon: -81.09, zone: "GMZ032", land: ["FLZ077", "FLC087"], office: "KEY", product: "CWF", buoys: ["VCAF1", "SMKF1"], lake: "Florida Keys", water: "ocean", sea: 160, openWater: "the Atlantic" },
  "key-west": { name: "Key West, FL", lat: 24.555, lon: -81.8, zone: "GMZ044", land: ["FLZ078", "FLC087"], office: "KEY", product: "CWF", buoys: ["KYWF1", "SANF1"], lake: "Florida Keys", water: "ocean", sea: 180, openWater: "the Atlantic" },
  // Florida Gulf Coast
  "marco-island": { name: "Marco Island, FL", lat: 25.94, lon: -81.72, zone: "GMZ656", land: ["FLZ069", "FLC021"], office: "MFL", product: "CWF", buoys: ["RKXF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 225, openWater: "the Gulf" },
  naples: { name: "Naples, FL", lat: 26.14, lon: -81.8, zone: "GMZ656", land: ["FLZ069", "FLC021"], office: "MFL", product: "CWF", buoys: ["RKXF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 248, openWater: "the Gulf", waterBuoys: ["FMRF1"] },
  "fort-myers-beach": { name: "Fort Myers Beach, FL", lat: 26.45, lon: -81.95, zone: "GMZ856", land: ["FLZ165", "FLC071"], office: "TBW", product: "CWF", buoys: ["FMRF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 248, openWater: "the Gulf" },
  sarasota: { name: "Sarasota, FL", lat: 27.33, lon: -82.55, zone: "GMZ853", land: ["FLZ160", "FLC115"], office: "TBW", product: "CWF", buoys: ["VENF1", "MTBF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 248, openWater: "the Gulf", waterBuoys: ["PMAF1", "42013"] },
  "tampa-bay": { name: "Tampa Bay / St. Petersburg, FL", lat: 27.77, lon: -82.63, zone: "GMZ830", land: ["FLZ050", "FLC103"], office: "TBW", product: "CWF", buoys: ["SAPF1", "OPTF1"], lake: "Florida Gulf Coast", water: "sheltered", sea: 135, openWater: "Tampa Bay" },
  clearwater: { name: "Clearwater, FL", lat: 27.98, lon: -82.83, zone: "GMZ853", land: ["FLZ050", "FLC103"], office: "TBW", product: "CWF", buoys: ["CWBF1", "OPTF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 293, openWater: "the Gulf" },
  "panama-city": { name: "Panama City Beach, FL", lat: 30.16, lon: -85.8, zone: "GMZ751", land: ["FLZ112", "FLC005"], office: "TAE", product: "CWF", buoys: ["PCBF1", "PACF1"], lake: "Florida Gulf Coast", water: "ocean", sea: 202, openWater: "the Gulf" },
  destin: { name: "Destin, FL", lat: 30.39, lon: -86.51, zone: "GMZ655", land: ["FLZ206", "FLC091"], office: "MOB", product: "CWF", buoys: [], lake: "Florida Gulf Coast", water: "ocean", sea: 180, openWater: "the Gulf", waterBuoys: ["PCBF1"] },
  pensacola: { name: "Pensacola Beach, FL", lat: 30.33, lon: -87.14, zone: "GMZ655", land: ["FLZ202", "FLC033"], office: "MOB", product: "CWF", buoys: ["PCLF1", "PPTA1"], lake: "Florida Gulf Coast", water: "ocean", sea: 135, openWater: "the Gulf" },
  // Northern Gulf: Alabama, Mississippi, Louisiana and Texas
  "orange-beach": { name: "Orange Beach / Gulf Shores, AL", lat: 30.27, lon: -87.58, zone: "GMZ650", land: ["ALZ266", "ALC003"], office: "MOB", product: "CWF", buoys: ["PPTA1", "42012"], lake: "Alabama & Mississippi Coast", water: "ocean", sea: 158, openWater: "the Gulf" },
  "mobile-bay": { name: "Fairhope / Mobile Bay, AL", lat: 30.52, lon: -87.91, zone: "GMZ630", land: ["ALZ264", "ALC003"], office: "MOB", product: "CWF", buoys: ["WKXA1", "MCGA1"], lake: "Alabama & Mississippi Coast", water: "sheltered", sea: 248, openWater: "Mobile Bay", waterBuoys: ["OBLA1", "DILA1"] },
  biloxi: { name: "Biloxi, MS", lat: 30.39, lon: -88.88, zone: "GMZ532", land: ["MSZ087", "MSC047"], office: "LIX", product: "CWF", buoys: ["PTBM6", "WYCM6"], lake: "Alabama & Mississippi Coast", water: "sheltered", sea: 180, openWater: "the Mississippi Sound", waterBuoys: ["PNLM6"] },
  "grand-isle": { name: "Grand Isle, LA", lat: 29.24, lon: -90, zone: "GMZ553", land: ["LAZ093", "LAC051"], office: "LIX", product: "CWF", buoys: ["GISL1"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 160, openWater: "the Gulf" },
  galveston: { name: "Galveston, TX", lat: 29.3, lon: -94.78, zone: "GMZ355", land: ["TXZ438", "TXC167"], office: "HGX", product: "CWF", buoys: ["GTOT2", "GNJT2"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 135, openWater: "the Gulf" },
  kemah: { name: "Kemah / Galveston Bay, TX", lat: 29.545, lon: -95.02, zone: "GMZ335", land: ["TXZ338", "TXC167"], office: "HGX", product: "CWF", buoys: ["EPTT2", "MGPT2"], lake: "Louisiana & Texas Coast", water: "sheltered", sea: 90, openWater: "Galveston Bay" },
  "port-aransas": { name: "Port Aransas, TX", lat: 27.83, lon: -97.06, zone: "GMZ255", land: ["TXZ443", "TXC355"], office: "CRP", product: "CWF", buoys: ["MIST2", "RTAT2"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 135, openWater: "the Gulf", alertZones: ["GMZ250"] /* the inlet is the GMZ250/255 line; the grid walk is in GMZ250 */, waterBuoys: ["MHBT2", "RCPT2"] },
  "south-padre": { name: "South Padre Island, TX", lat: 26.07, lon: -97.16, zone: "GMZ150", land: ["TXZ455", "TXC061"], office: "BRO", product: "CWF", buoys: ["BZST2", "PCGT2"], lake: "Louisiana & Texas Coast", water: "ocean", sea: 90, openWater: "the Gulf" },
  // Southeast Atlantic: Georgia and the Carolinas
  "st-simons": { name: "St. Simons Island / Brunswick, GA", lat: 31.14, lon: -81.39, zone: "AMZ450", land: ["GAZ154", "GAC127"], office: "JAX", product: "CWF", buoys: ["SAXG1"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 135, openWater: "the Atlantic", waterBuoys: ["41112"] },
  tybee: { name: "Savannah / Tybee Island, GA", lat: 32.01, lon: -80.85, zone: "AMZ362", land: ["GAZ219", "GAC051"], office: "CHS", product: "CWF", buoys: ["FPKG1"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 135, openWater: "the Atlantic", alertZones: ["AMZ364"] /* the Savannah River entrance is the AMZ362/364 line; the grid walk is in AMZ364 */ },
  "hilton-head": { name: "Hilton Head, SC", lat: 32.17, lon: -80.73, zone: "AMZ362", land: ["SCZ148", "SCC013"], office: "CHS", product: "CWF", buoys: ["FPKG1", "41033"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  charleston: { name: "Charleston Harbor, SC", lat: 32.76, lon: -79.87, zone: "AMZ340", land: ["SCZ150", "SCC019"], office: "CHS", product: "CWF", buoys: ["CHTS1", "FBIS1"], lake: "Georgia & South Carolina Coast", water: "sheltered", sea: 135, openWater: "Charleston Harbor" },
  "murrells-inlet": { name: "Murrells Inlet / Myrtle Beach, SC", lat: 33.55, lon: -79.04, zone: "AMZ254", land: ["SCZ056", "SCC043"], office: "ILM", product: "CWF", buoys: ["MROS1", "NIWS1"], lake: "Georgia & South Carolina Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  wrightsville: { name: "Wilmington / Wrightsville Beach, NC", lat: 34.21, lon: -77.79, zone: "AMZ250", land: ["NCZ108", "NCC129"], office: "ILM", product: "CWF", buoys: ["JMPN7", "MBNN7"], lake: "North Carolina Coast", water: "ocean", sea: 113, openWater: "the Atlantic" },
  "morehead-city": { name: "Morehead City / Beaufort, NC", lat: 34.7, lon: -76.69, zone: "AMZ158", land: ["NCZ195", "NCC031"], office: "MHX", product: "CWF", buoys: ["BFTN7", "CLKN7"], lake: "North Carolina Coast", water: "ocean", sea: 180, openWater: "the Atlantic" },
  "oregon-inlet": { name: "Oregon Inlet / Outer Banks, NC", lat: 35.79, lon: -75.54, zone: "AMZ150", land: ["NCZ203", "NCC055"], office: "MHX", product: "CWF", buoys: ["ORIN7", "41082"], lake: "North Carolina Coast", water: "ocean", sea: 90, openWater: "the Atlantic", bar: { name: "Oregon Inlet", inlet: true } },
  // Southern California
  "san-diego": { name: "San Diego / Point Loma, CA", lat: 32.71, lon: -117.18, zone: "PZZ740", land: ["CAZ043", "CAC073"], office: "SGX", product: "CWF", buoys: ["TIXC1", "LJAC1"], lake: "Southern California Coast", water: "ocean", sea: 248, openWater: "the Pacific", waterBuoys: ["SDBC1", "46254"] },
  "mission-bay": { name: "Mission Bay, CA", lat: 32.765, lon: -117.24, zone: "PZZ740", land: ["CAZ043", "CAC073"], office: "SGX", product: "CWF", buoys: ["LJAC1", "LJPC1"], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  oceanside: { name: "Oceanside Harbor, CA", lat: 33.21, lon: -117.4, zone: "PZZ740", land: ["CAZ043", "CAC073"], office: "SGX", product: "CWF", buoys: [], lake: "Southern California Coast", water: "ocean", sea: 248, openWater: "the Pacific", waterBuoys: ["46224", "46275"] },
  "dana-point": { name: "Dana Point, CA", lat: 33.46, lon: -117.7, zone: "PZZ655", land: ["CAZ552", "CAC059"], office: "LOX", product: "CWF", buoys: [], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific", waterBuoys: ["46285", "46277"] },
  "newport-beach": { name: "Newport Beach, CA", lat: 33.6, lon: -117.88, zone: "PZZ655", land: ["CAZ552", "CAC059"], office: "LOX", product: "CWF", buoys: ["PRJC1", "PFXC1"], lake: "Southern California Coast", water: "ocean", sea: 203, openWater: "the Pacific", waterBuoys: ["46285", "46253"] },
  "long-beach": { name: "Long Beach, CA", lat: 33.75, lon: -118.19, zone: "PZZ655", land: ["CAZ366", "CAC037"], office: "LOX", product: "CWF", buoys: ["PRJC1", "PFXC1"], lake: "Southern California Coast", water: "ocean", sea: 180, openWater: "the Pacific", waterBuoys: ["46256", "46222"] },
  "marina-del-rey": { name: "Marina del Rey, CA", lat: 33.97, lon: -118.45, zone: "PZZ655", land: ["CAZ366", "CAC037"], office: "LOX", product: "CWF", buoys: ["ICAC1", "PXAC1"], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  "channel-islands": { name: "Channel Islands Harbor / Oxnard, CA", lat: 34.16, lon: -119.23, zone: "PZZ650", land: ["CAZ354", "CAC111"], office: "LOX", product: "CWF", buoys: ["46025"], lake: "Southern California Coast", water: "ocean", sea: 225, openWater: "the Pacific" },
  "santa-barbara": { name: "Santa Barbara, CA", lat: 34.4, lon: -119.69, zone: "PZZ650", land: ["CAZ350", "CAC083"], office: "LOX", product: "CWF", buoys: ["46053"], lake: "Southern California Coast", water: "ocean", sea: 180, openWater: "the Pacific" },
  // Hawaii and Puerto Rico
  honolulu: { name: "Honolulu / Kewalo Basin, HI", lat: 21.29, lon: -157.86, zone: "PHZ115", land: ["HIZ033", "HIC003"], office: "HFO", product: "CWF", buoys: ["OOUH1", "PRHH1"], lake: "Hawaii", water: "ocean", sea: 200, openWater: "the Pacific" },
  kona: { name: "Kona / Honokohau Harbor, HI", lat: 19.67, lon: -156.03, zone: "PHZ123", land: ["HIZ023", "HIC001"], office: "HFO", product: "CWF", buoys: ["KWHH1"], lake: "Hawaii", water: "ocean", sea: 270, openWater: "the Pacific" },
  maalaea: { name: "Ma'alaea, Maui, HI", lat: 20.79, lon: -156.51, zone: "PHZ119", land: ["HIZ046", "HIC009"], office: "HFO", product: "CWF", buoys: ["KLIH1"], lake: "Hawaii", water: "ocean", sea: 200, openWater: "Ma'alaea Bay" },
  "san-juan": { name: "San Juan, PR", lat: 18.47, lon: -66.11, zone: "AMZ712", land: ["PRZ001", "PRC127"] /* San Juan municipio; the walk south crossed the bay into Guaynabo */, office: "SJU", product: "CWF", buoys: ["41053", "SJNP4"], lake: "Puerto Rico", water: "ocean", sea: 0, openWater: "the Atlantic", waterBuoys: ["41121"] },
  fajardo: { name: "Fajardo, PR", lat: 18.33, lon: -65.63, zone: "AMZ726", land: ["PRZ002", "PRC053"], office: "SJU", product: "CWF", buoys: ["41056", "ESPP4"], lake: "Puerto Rico", water: "ocean", sea: 90, openWater: "Vieques Sound", waterBuoys: ["CLBP4", "SJNP4"] },

  // ── Cold-water coasts: Pacific Northwest, Oregon, Northern California, the
  // Northeast and Alaska. Every zone checked against api.weather.gov
  // (/zones?type=marine&point=) and every zone's text against its office's
  // latest CWF; every station against NDBC realtime2 (fresh, reporting wind or
  // waves) in Nov 2026. Stations that were 404 or weeks stale (e.g. the UW
  // Puget Sound buoys 46120-46125, MYSound 44039/44040/44022, the SATURN
  // Columbia estuary buoys) are left out on purpose. `land` (forecast zone +
  // county) resolved with landZonesFor's walk against api.weather.gov in Nov
  // 2026 and checked against each launch's town.
  // `bar` = the harbor's only way to sea is a river/harbor bar. Any marine
  // advisory or warning for the spot's zone or its bar zone is NO-GO there
  // (see alertEffect), the alerts lookup also asks for the bar zone by ID,
  // and the hourly/week strips, directory tile, digest window and weekend
  // outlook honor it too. `alertZones` =
  // extra NWS zones whose advisories apply (e.g. the sea just outside a bar).
  // `notes` = standing local hazards, always listed, never a level change.
  // Pacific Northwest: Puget Sound, the San Juans and Admiralty Inlet (sheltered inland waters), Washington coast
  seattle: { name: "Seattle / Shilshole Bay, WA", lat: 47.68, lon: -122.41, zone: "PZZ135", land: ["WAZ315", "WAC033"], office: "SEW", product: "CWF", buoys: ["WPOW1"], lake: "Puget Sound", water: "sheltered", sea: 270, openWater: "Puget Sound", waterBuoys: ["TCNW1"] },
  everett: { name: "Everett, WA", lat: 47.98, lon: -122.23, zone: "PZZ135", land: ["WAZ312", "WAC061"], office: "SEW", product: "CWF", buoys: [], lake: "Puget Sound", water: "sheltered", sea: 270, openWater: "Possession Sound", waterBuoys: ["PTWW1"] },
  tacoma: { name: "Tacoma / Commencement Bay, WA", lat: 47.29, lon: -122.43, zone: "PZZ135", land: ["WAZ316", "WAC053"], office: "SEW", product: "CWF", buoys: ["TCMW1"], lake: "Puget Sound", water: "sheltered", sea: 330, openWater: "Commencement Bay", waterBuoys: ["TCNW1"] },
  olympia: { name: "Olympia / Budd Inlet, WA", lat: 47.07, lon: -122.9, zone: "PZZ135", land: ["WAZ317", "WAC067"], office: "SEW", product: "CWF", buoys: [], lake: "Puget Sound", water: "sheltered", sea: 0, openWater: "Budd Inlet", waterBuoys: ["TCNW1"],
    notes: ["South Sound tides run 14+ ft with strong currents in the narrows; check the tide and current tables before you go"] },
  "port-townsend": { name: "Port Townsend, WA", lat: 48.11, lon: -122.76, zone: "PZZ134", land: ["WAZ324", "WAC031"], office: "SEW", product: "CWF", buoys: ["PTWW1", "46088"], lake: "San Juan Islands & Admiralty Inlet", water: "sheltered", sea: 70, openWater: "Admiralty Inlet",
    notes: ["Wind against the ebb in Admiralty Inlet and Point Wilson rips stacks up steep, dangerous seas fast; time the tide"] },
  anacortes: { name: "Anacortes, WA", lat: 48.51, lon: -122.61, zone: "PZZ133", land: ["WAZ311", "WAC057"], office: "SEW", product: "CWF", buoys: ["46118", "SISW1"], lake: "San Juan Islands & Admiralty Inlet", water: "sheltered", sea: 30, openWater: "Guemes Channel", waterBuoys: ["PTWW1"],
    notes: ["Strong tidal currents through Rosario Strait and the San Juan channels; wind against current gets rough quickly"] },
  "friday-harbor": { name: "Friday Harbor, San Juan Island, WA", lat: 48.54, lon: -123.01, zone: "PZZ133", land: ["WAZ001", "WAC055"], office: "SEW", product: "CWF", buoys: ["FRDW1", "46088"], lake: "San Juan Islands & Admiralty Inlet", water: "sheltered", sea: 90, openWater: "San Juan Channel",
    notes: ["Strong tidal currents through the San Juan channels; wind against current gets rough quickly"] },
  westport: { name: "Westport / Grays Harbor, WA", lat: 46.905, lon: -124.11, zone: "PZZ156", land: ["WAZ331", "WAC027"], office: "SEW", product: "CWF", buoys: ["WPTW1", "46211"], lake: "Washington Coast", water: "ocean", sea: 300, openWater: "the Pacific",
    bar: { name: "Grays Harbor Bar", zone: "PZZ110" } },
  // Oregon coast: every harbor here reaches the sea over a bar.
  astoria: { name: "Astoria / Hammond, Columbia River Bar, OR", lat: 46.203, lon: -123.948, zone: "PZZ210", land: ["ORZ101", "ORC007", "WAZ201", "WAC049"] /* the bar is shared with Washington: watch Clatsop and Pacific counties */, office: "PQR", product: "CWF", buoys: ["ASTO3", "46243"], lake: "Oregon Coast", water: "ocean", sea: 280, openWater: "the Columbia River Bar", alertZones: ["PZZ251"], waterBuoys: ["46243", "46029"],
    bar: { name: "Columbia River Bar", zone: "PZZ210" } },
  garibaldi: { name: "Garibaldi / Tillamook Bay, OR", lat: 45.555, lon: -123.915, zone: "PZZ252", land: ["ORZ102", "ORC057"], office: "PQR", product: "CWF", buoys: ["46278"], lake: "Oregon Coast", water: "ocean", sea: 280, openWater: "the Pacific",
    bar: { name: "Tillamook Bay Bar" } },
  "depoe-bay": { name: "Depoe Bay, OR", lat: 44.81, lon: -124.06, zone: "PZZ252", land: ["ORZ103", "ORC041"], office: "PQR", product: "CWF", buoys: ["NWPO3", "46050"], lake: "Oregon Coast", water: "ocean", sea: 270, openWater: "the Pacific", waterBuoys: ["46097"],
    bar: { name: "Depoe Bay entrance" } },
  "newport-or": { name: "Newport / Yaquina Bay, OR", lat: 44.62, lon: -124.05, zone: "PZZ253", land: ["ORZ103", "ORC041"], office: "PQR", product: "CWF", buoys: ["NWPO3", "46050"], lake: "Oregon Coast", water: "ocean", sea: 270, openWater: "the Pacific", waterBuoys: ["46097"],
    bar: { name: "Yaquina Bay Bar" } },
  "coos-bay": { name: "Coos Bay / Charleston, OR", lat: 43.35, lon: -124.32, zone: "PZZ350", land: ["ORZ021", "ORC011"], office: "MFR", product: "CWF", buoys: ["CHAO3", "46229"], lake: "Oregon Coast", water: "ocean", sea: 300, openWater: "the Pacific", waterBuoys: ["46229"],
    bar: { name: "Coos Bay Bar" } },
  brookings: { name: "Brookings / Chetco River, OR", lat: 42.045, lon: -124.27, zone: "PZZ356", land: ["ORZ022", "ORC015"], office: "MFR", product: "CWF", buoys: ["46027", "CECC1"], lake: "Oregon Coast", water: "ocean", sea: 225, openWater: "the Pacific",
    bar: { name: "Chetco River Bar" } },
  // Northern California: San Francisco Bay (sheltered, but the afternoon sea breeze is the rule) and the outer coast
  sausalito: { name: "Sausalito / Richardson Bay, CA", lat: 37.86, lon: -122.48, zone: "PZZ530", land: ["CAZ502", "CAC041"], office: "MTR", product: "CWF", buoys: ["FTPC1", "PXOC1"], lake: "San Francisco Bay", water: "sheltered", sea: 135, openWater: "San Francisco Bay", waterBuoys: ["RCMC1", "AAMC1"],
    notes: ["Afternoon sea breeze through the Golden Gate routinely builds to 20-25 kt from midday; plan to be in early", "Ebb against a westerly swell at the Golden Gate and the Potato Patch (Four Fathom Bank) gets dangerous; don't head outside the Gate on a strong ebb"] },
  // gridSteps: the default 0.22° step due west lands outside the Golden Gate
  // in open-Pacific swell (MTR/79,110), and the bay cells only carry a
  // placeholder wave layer, so without this the walk rated a bay launch on
  // ocean seas. In-bay steps only: no bay wave cell reads "no waves" (wind decides).
  berkeley: { name: "Berkeley Marina, CA", lat: 37.865, lon: -122.315, zone: "PZZ530", land: ["CAZ508", "CAC001"], office: "MTR", product: "CWF", buoys: ["PPXC1", "OKXC1"], lake: "San Francisco Bay", water: "sheltered", sea: 270, gridSteps: [0.035, 0.1], openWater: "San Francisco Bay", waterBuoys: ["RCMC1", "AAMC1"],
    notes: ["Afternoon sea breeze through the Golden Gate routinely builds to 20-25 kt from midday; plan to be in early"] },
  alameda: { name: "Alameda / Ballena Bay, CA", lat: 37.765, lon: -122.29, zone: "PZZ531", land: ["CAZ508", "CAC001"], office: "MTR", product: "CWF", buoys: ["AAMC1", "OMHC1"], lake: "San Francisco Bay", water: "sheltered", sea: 225, openWater: "San Francisco Bay",
    notes: ["Afternoon sea breeze through the Golden Gate routinely builds to 20-25 kt from midday; plan to be in early"] },
  "redwood-city": { name: "Redwood City, CA", lat: 37.51, lon: -122.21, zone: "PZZ531", land: ["CAZ508", "CAC081"], office: "MTR", product: "CWF", buoys: ["RTYC1"], lake: "San Francisco Bay", water: "sheltered", sea: 45, openWater: "the South Bay", waterBuoys: ["AAMC1"],
    notes: ["South Bay afternoon westerlies build steep chop over the shallows, and the flats dry at low tide; check the tide"] },
  "half-moon-bay": { name: "Half Moon Bay / Pillar Point, CA", lat: 37.5, lon: -122.48, zone: "PZZ545", land: ["CAZ509", "CAC081"], office: "MTR", product: "CWF", buoys: ["46012"], lake: "Northern California Coast", water: "ocean", sea: 200, openWater: "the Pacific", waterBuoys: ["46237"],
    notes: ["Big winter swell breaks across the reefs off Pillar Point (Mavericks); stay well clear of the reef outside the harbor"] },
  "bodega-bay": { name: "Bodega Bay, CA", lat: 38.33, lon: -123.05, zone: "PZZ540", land: ["CAZ505", "CAC097"], office: "MTR", product: "CWF", buoys: ["46013"], lake: "Northern California Coast", water: "ocean", sea: 190, openWater: "the Pacific", waterBuoys: ["BDXC1"] },
  "santa-cruz": { name: "Santa Cruz Harbor, CA", lat: 36.96, lon: -122.0, zone: "PZZ535", land: ["CAZ529", "CAC087"], office: "MTR", product: "CWF", buoys: ["46092", "46042"], lake: "Northern California Coast", water: "ocean", sea: 180, openWater: "Monterey Bay", waterBuoys: ["46236"],
    notes: ["The harbor entrance shoals and can break in a south swell; look at the entrance before you commit"] },
  monterey: { name: "Monterey, CA", lat: 36.605, lon: -121.89, zone: "PZZ535", land: ["CAZ530", "CAC053"], office: "MTR", product: "CWF", buoys: ["46092", "46042"], lake: "Northern California Coast", water: "ocean", sea: 20, openWater: "Monterey Bay", waterBuoys: ["MEYC1"] },
  "humboldt-bay": { name: "Eureka / Humboldt Bay, CA", lat: 40.8, lon: -124.17, zone: "PZZ450", land: ["CAZ103", "CAC023"], office: "EKA", product: "CWF", buoys: ["46022", "46244"], lake: "Northern California Coast", water: "ocean", sea: 260, openWater: "the Pacific", alertZones: ["PZZ415"], waterBuoys: ["HBYC1"],
    bar: { name: "Humboldt Bay Bar", zone: "PZZ410" } },
  // Northeast: New England, Long Island Sound, New York Harbor and the Jersey shore
  "portland-me": { name: "Portland, ME / Casco Bay", lat: 43.66, lon: -70.24, zone: "ANZ153", land: ["MEZ024", "MEC005"], office: "GYX", product: "CWF", buoys: ["CASM1", "44007"], lake: "New England Coast", water: "sheltered", sea: 120, openWater: "Casco Bay" },
  boston: { name: "Boston Harbor, MA", lat: 42.35, lon: -71.03, zone: "ANZ230", land: ["MAZ015", "MAC025"], office: "BOX", product: "CWF", buoys: ["CSIM3", "44013"], lake: "New England Coast", water: "sheltered", sea: 90, openWater: "Boston Harbor" },
  hyannis: { name: "Hyannis / Nantucket Sound, MA", lat: 41.63, lon: -70.28, zone: "ANZ232", land: ["MAZ022", "MAC001"], office: "BOX", product: "CWF", buoys: ["44020"], lake: "New England Coast", water: "sheltered", sea: 180, openWater: "Nantucket Sound", waterBuoys: ["44090", "NTKM3"] },
  "buzzards-bay": { name: "Buzzards Bay / Mattapoisett, MA", lat: 41.65, lon: -70.8, zone: "ANZ234", land: ["MAZ021", "MAC023"], office: "BOX", product: "CWF", buoys: ["NBGM3", "BUZM3"], lake: "New England Coast", water: "sheltered", sea: 180, openWater: "Buzzards Bay", waterBuoys: ["BZBM3"],
    notes: ["The afternoon southwesterly funnels up Buzzards Bay and builds a short, steep chop; mornings are usually calmer"] },
  "newport-ri": { name: "Newport, RI / Narragansett Bay", lat: 41.485, lon: -71.32, zone: "ANZ236", land: ["RIZ007", "RIC005"], office: "BOX", product: "CWF", buoys: ["NWPR1", "PDVR1"], lake: "New England Coast", water: "sheltered", sea: 225, openWater: "Narragansett Bay" },
  norwalk: { name: "Norwalk, CT", lat: 41.09, lon: -73.41, zone: "ANZ335", land: ["CTZ009", "CTC001"], office: "OKX", product: "CWF", buoys: ["BRHC3", "KPTN6"], lake: "Long Island Sound", water: "sheltered", sea: 160, openWater: "Long Island Sound" },
  "new-haven": { name: "New Haven, CT", lat: 41.29, lon: -72.91, zone: "ANZ335", land: ["CTZ010", "CTC009"], office: "OKX", product: "CWF", buoys: ["NWHC3", "BRHC3"], lake: "Long Island Sound", water: "sheltered", sea: 180, openWater: "Long Island Sound" },
  "ny-harbor": { name: "New York Harbor / Liberty Landing, NJ", lat: 40.71, lon: -74.04, zone: "ANZ338", land: ["NJZ006", "NJC017"], office: "OKX", product: "CWF", buoys: ["ROBN4", "MHRN6"], lake: "New York & New Jersey Coast", water: "sheltered", sea: 160, openWater: "New York Harbor", waterBuoys: ["BATN6"],
    notes: ["Heavy commercial traffic, ferries and strong tidal currents; keep clear of the channels and monitor VHF 13 and 16"] },
  barnegat: { name: "Barnegat Light / Barnegat Inlet, NJ", lat: 39.76, lon: -74.11, zone: "ANZ451", land: ["NJZ026", "NJC029"], office: "PHI", product: "CWF", buoys: ["44091"], lake: "New York & New Jersey Coast", water: "ocean", sea: 90, openWater: "the Atlantic", bar: { name: "Barnegat Inlet", inlet: true },
    notes: ["Barnegat Inlet shoals and breaks on an ebb against an easterly swell; look at the inlet before you commit"] },
  "cape-may": { name: "Cape May, NJ", lat: 38.95, lon: -74.9, zone: "ANZ453", land: ["NJZ024", "NJC009"], office: "PHI", product: "CWF", buoys: ["BRND1", "LWSD1"], lake: "New York & New Jersey Coast", water: "ocean", sea: 120, openWater: "the Atlantic" },
  // Alaska: thin buoy coverage, so every launch here has a fresh harbor-side
  // wind station (Marine Exchange of Alaska / NOS); waves come from the NWS
  // grid and CWF text. Spots without a live wind source were not added.
  juneau: { name: "Juneau / Auke Bay, AK", lat: 58.38, lon: -134.65, zone: "PKZ031", land: ["AKZ325", "AKC110"], office: "AJK", product: "CWF", buoys: ["SRXA2", "ABYA2", "JNEA2"], lake: "Southeast Alaska", water: "sheltered", sea: 200, openWater: "Stephens Passage", waterBuoys: ["JNEA2"],
    notes: ["Tides run 16-20 ft here; plan launch and retrieval around the tide and watch for fast-rising water on beached boats"] },
  ketchikan: { name: "Ketchikan / Tongass Narrows, AK", lat: 55.34, lon: -131.65, zone: "PKZ036", land: ["AKZ330", "AKC130"], office: "AJK", product: "CWF", buoys: ["KEXA2", "KECA2", "SLXA2"], lake: "Southeast Alaska", water: "sheltered", sea: 225, openWater: "Tongass Narrows", waterBuoys: ["KECA2"],
    notes: ["Floatplane and cruise-ship traffic in Tongass Narrows; keep a sharp lookout"] },
  sitka: { name: "Sitka, AK", lat: 57.05, lon: -135.34, zone: "PKZ642", land: ["AKZ323", "AKC220"], office: "AEG", product: "CWF", buoys: ["SHXA2", "STXA2"], lake: "Southeast Alaska", water: "ocean", sea: 250, openWater: "Sitka Sound", waterBuoys: ["ITKA2"] },
  seward: { name: "Seward / Resurrection Bay, AK", lat: 60.1, lon: -149.44, zone: "PKZ714", land: ["AKZ725", "AKC122"], office: "AER", product: "CWF", buoys: ["SWXA2", "PILA2"], lake: "Southcentral Alaska", water: "sheltered", sea: 180, openWater: "Resurrection Bay",
    notes: ["Outflow (north) winds can scream down Resurrection Bay with little warning, and the Gulf of Alaska swell at the mouth is open ocean"] },
  homer: { name: "Homer Spit / Kachemak Bay, AK", lat: 59.6, lon: -151.42, zone: "PKZ741", land: ["AKZ722", "AKC122"], office: "AER", product: "CWF", buoys: ["HMSA2", "46108"], lake: "Southcentral Alaska", water: "sheltered", sea: 90, openWater: "Kachemak Bay", waterBuoys: ["46108", "OVIA2"],
    notes: ["Cook Inlet tides run 20+ ft with strong currents; wind against the tide off the end of the Spit gets rough fast, and the flats drain at low water"] },
  whittier: { name: "Whittier / Passage Canal, AK", lat: 60.78, lon: -148.68, zone: "PKZ723", land: ["AKZ728", "AKC063"], office: "AER", product: "CWF", buoys: ["WIXA2", "46081"], lake: "Southcentral Alaska", water: "sheltered", sea: 90, openWater: "Passage Canal", waterBuoys: ["46081"],
    notes: ["Williwaws and gap winds funnel down Passage Canal; tunnel hours limit when you can get back to the road"] },
  valdez: { name: "Valdez, AK", lat: 61.12, lon: -146.35, zone: "PKZ720", land: ["AKZ731", "AKC063"], office: "AER", product: "CWF", buoys: ["VDXA2", "VDZA2", "POTA2"], lake: "Southcentral Alaska", water: "sheltered", sea: 225, openWater: "Port Valdez", waterBuoys: ["VDZA2"],
    notes: ["Valdez Narrows funnels strong outflow winds, and Prince William Sound beyond is far rougher than the port"] },
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

// Walk spot.buoys in preference order and return { buoy, tempsObs }:
//   buoy     — the first fresh (<3 h) observation that reports wind/gust OR waves,
//              the only kind that may drive the verdict, or null.
//   tempsObs — the first fresh observation at all (it may report only water/
//              air temperature), kept for the Water/Air tiles.
// A temps-only station must not stop the walk: a later fallback buoy may carry
// the wind/wave sensors, and accepting it would also hide that the verdict is
// running on the NWS forecast alone.
// The primary buoy is still the first fresh station with wind or waves (it
// names the page's live station). If it lacks one half, the walk continues so
// a later station can fill it: a wind-only harbor station (CHAO3, ASTO3,
// WPTW1) must not hide a live wave buoy listed after it (46229, 46243, 46211).
//   windBuoy / waveBuoy — the station that filled the missing half, or null.
const hasWind = (o) => !!o && (o.windKt != null || o.windGustKt != null);
const hasWaves = (o) => !!o && o.waveHeightFt != null;
export async function fetchBuoy(buoys) {
  let tempsObs = null, buoy = null, windBuoy = null, waveBuoy = null;
  for (const station of buoys || []) {
    try {
      const text = await getText(`https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`);
      const obs = parseBuoy(text, station);
      // Skip stale (>3h) or unparseable observations; try the next fallback buoy.
      if (!obs || !(obs.ageMinutes == null || obs.ageMinutes < 180)) continue;
      if (!tempsObs && (obs.waterTempF != null || obs.airTempF != null)) tempsObs = obs;
      if (!buoy) { if (hasWind(obs) || hasWaves(obs)) buoy = obs; }
      else {
        if (!hasWind(buoy) && !windBuoy && hasWind(obs)) windBuoy = obs;
        if (!hasWaves(buoy) && !waveBuoy && hasWaves(obs)) waveBuoy = obs;
      }
      if (buoy && (hasWind(buoy) || windBuoy) && (hasWaves(buoy) || waveBuoy)) break;
    } catch (e) {
      // try next buoy
    }
  }
  if (buoy) return { buoy, tempsObs: tempsObs || buoy, windBuoy, waveBuoy };
  return { buoy: null, tempsObs, windBuoy: null, waveBuoy: null };
}

// Water temperature from the nearest station that reports one (spot.waterBuoys),
// for launches whose wind/wave buoy has no water sensor or is pulled for the
// season. First fresh (<3 h) reading wins; null when none report.
async function fetchWaterTemp(stations) {
  for (const station of stations || []) {
    try {
      const obs = parseBuoy(await getText(`https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`), station);
      if (obs && obs.waterTempF != null && (obs.ageMinutes == null || obs.ageMinutes < 180)) return { f: obs.waterTempF, station };
    } catch (e) { /* try the next station */ }
  }
  return null;
}

// One /points lookup → both the day/night forecast AND the hourly forecast.
const validIso = (t) => (t && Number.isFinite(Date.parse(t)) ? new Date(Date.parse(t)).toISOString() : null);
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
      startTime: p.startTime || null,
      endTime: p.endTime || null,
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
      // Missing/unparseable wind is null (unknown), never 0 kt (calm).
      const m = String(p.windSpeed || "").match(/\d+/);
      return {
        time: p.startTime,
        tempF: p.temperature,
        windKt: m ? round(mphToKt(parseInt(m[0], 10)), 0) : null,
        windDir: p.windDirection || null,
        precipPct: p.probabilityOfPrecipitation?.value ?? 0,
        short: p.shortForecast || "",
      };
    });
    // When the forecaster last updated each product (not when the API served
    // it): the age that matters for "is this forecast stale?".
    const issuedAt = { daily: validIso(fc?.properties?.updateTime), hourly: validIso(hc?.properties?.updateTime) };
    return { daily, hourly, issuedAt };
  } catch (e) {
    return { daily: [], hourly: [], issuedAt: { daily: null, hourly: null } };
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

// Some grid cells carry a placeholder wave layer, not a forecast: one value
// held for the whole ~7-day period (DTX/84,67 off Port Huron and APX/104,65
// near Alpena were a single 0 m valid for P7DT4H). They are mostly LAND
// cells the seaward walk crosses on its way to open water: in Nov 2026 the
// walks from Mackinaw, Petoskey and Traverse City (toward mid-Lake Michigan)
// and Houghton (toward mid-Superior) hit only such cells (they now carry
// `sea` bearings that reach real cells), while real marine
// cells sat a few km away in other directions; Bath, NC (MHX) was likewise
// all-placeholder (0.3 m held all week).
// Read as data, that is a false "0 ft, calm" that can enable a GO. Real
// cells, even on flat-calm days, break the period into several valid times
// and almost always carry some non-zero value (GFE encodes "1 ft or less" as
// 0 for hours to days, then 0.3 m). Thresholds were checked live against all
// 3 sample cells of the 90 curated spots (Nov 2026): the real cells had >= 2
// entries and their longest single value covered at most 77% of the period
// (SJU/210,120 held 3 ft for 144 of 198 h); every placeholder had 1 entry,
// or 98% in one zero value. A layer is filler when ANY of:
//   - fewer than WAVE_MIN_TIMES valid times carry a value;
//   - every value is 0 (a whole week of exactly 0 is not a forecast; real
//     calm reads 0 with some 0.3 m hours, and a truly flat week costs only
//     a GO on lakes, which is the safe direction);
//   - one value spans more than WAVE_FILLER_SPAN_H and covers at least
//     WAVE_FILLER_SHARE of all the layer's hours.
// …and only if no value exceeds WAVE_FILLER_MAX_M (~1 ft): dropping a layer
// can only loosen a verdict when it held real height (ocean seas would go
// unrated; a held 4 ft lake value would stop reading NO-GO), so a layer with
// any value above ~1 ft is always kept. Every placeholder seen live was 0 or
// 0.3048 m.
const WAVE_FILLER_MAX_M = 0.31;
const WAVE_MIN_TIMES = 2;
const WAVE_FILLER_SPAN_H = 48;
const WAVE_FILLER_SHARE = 0.9;
export function isFillerWaveLayer(prop) {
  const spans = [];
  let anyNonZero = false, maxM = 0;
  for (const { validTime, value } of prop?.values || []) {
    if (value == null || !Number.isFinite(+value)) continue;
    const span = expandValidTime(validTime);
    if (!span) continue;
    spans.push(span[1]);
    if (+value > 0) anyNonZero = true;
    maxM = Math.max(maxM, +value);
  }
  if (maxM > WAVE_FILLER_MAX_M) return false; // real height: never drop it
  if (spans.length < WAVE_MIN_TIMES) return true;
  if (!anyNonZero) return true;
  const total = spans.reduce((a, b) => a + b, 0);
  const longest = Math.max(...spans);
  return longest > WAVE_FILLER_SPAN_H && longest >= WAVE_FILLER_SHARE * total;
}

async function fetchGridAt(lat, lon) {
  try {
    const pt = await cachedJSON(`${NWS}/points/${lat},${lon}`, 86400); // grid mapping is static
    const gUrl = pt?.properties?.forecastGridData;
    if (!gUrl) return null;
    const p = (await getJSON(gUrl))?.properties || {};
    // A placeholder wave layer is no wave data: drop it (and its period) so
    // the step search keeps looking for a real marine cell, and a cell with
    // nothing better reads "no waves", never a GO-enabling "0 ft".
    const waveFiller = !!p.waveHeight && isFillerWaveLayer(p.waveHeight);
    return {
      waveFiller,
      tz: pt?.properties?.timeZone || "America/New_York",
      updateTime: validIso(p.updateTime), // forecaster's last grid update (staleness)
      windKt: gridSeries(p.windSpeed, speedToKt(p.windSpeed)),
      gustKt: gridSeries(p.windGust, speedToKt(p.windGust)),
      windDirDeg: gridSeries(p.windDirection),
      waveFt: waveFiller ? new Map() : gridSeries(p.waveHeight, mToFt),
      periodSec: waveFiller ? new Map() : gridSeries(p.wavePeriod),
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
// Ocean launches are rated on the sea outside the inlet, not the harbor: the
// first cell off Port Canaveral reads 0-1 ft while 4-6 ft runs offshore. Start
// ~4 mi out (still well inside the NWS 0-20 NM coastal zone).
const OCEAN_GRID_STEPS = [0.06, 0.1, 0.22];
// Grid sample distances (degrees along the seaward bearing) for a spot. A spot
// may set `gridSteps` when the default first cells are an enclosed inner bay
// that reads far calmer than the water a boater from that launch heads into
// (e.g. inner Thunder Bay at Alpena). Inland waters sample the point only.
export function gridStepsFor(spot) {
  if (!isOpenWater(spot)) return [0];
  if (Array.isArray(spot.gridSteps) && spot.gridSteps.length) return spot.gridSteps;
  return waterProfile(spot) === "ocean" ? OCEAN_GRID_STEPS : GRID_STEPS;
}
// The grid sample points, nearest first (what fetchSpotGrid walks). Exported
// for tests.
export const gridSamplePoints = (spot) => gridStepsFor(spot).map((step) => ({ step, ...seawardPoint(spot, step) }));
async function fetchSpotGrid(spot) {
  // Open water (lakes, bays, sounds, ocean): nudge seaward until we hit a
  // marine cell that carries waves. Inland waters have no wave grid, so just
  // sample the point once (wind/gusts/precip/temp exist on land; waves blank).
  const steps = gridStepsFor(spot);
  // Remember which step reached a wave cell, so steady state costs one grid
  // fetch per spot instead of up to three (the directory summary fetches every
  // spot in one request, and Workers cap subrequests per request). A spot's
  // own gridSteps are part of the key, so editing them never reuses a step
  // memoized under the old list (spots without gridSteps keep their old key).
  const stepTag = Array.isArray(spot.gridSteps) && spot.gridSteps.length ? `,s${spot.gridSteps.join("/")}` : "";
  const memoKey = typeof caches !== "undefined" && caches.default
    ? new Request(`https://grid-step.local/${round(spot.lat, 3)},${round(spot.lon, 3)},${spot.sea ?? ""},${spot.lake || ""}${stepTag}`) : null;
  let known = null;
  if (memoKey) known = await caches.default.match(memoKey).then((r) => (r ? r.text() : null)).catch(() => null);
  if (known != null && steps.includes(Number(known))) {
    const p = seawardPoint(spot, Number(known));
    const g = await fetchGridAt(p.lat, p.lon);
    if (g && (g.waveFt.size || !isOpenWater(spot))) return g;
    // The remembered cell has no real waves now (e.g. it only carries a
    // placeholder layer — fetchGridAt drops those): forget it and walk again.
    if (g) await caches.default.delete(memoKey).catch(() => {});
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
const MIN_DAY_WIND_HOURS = 12; // hours of wind (and, on the Great Lakes, wave) forecast a future day needs to be rated GO
export function buildWeek(grid, profile = "lake") {
  if (!grid) return [];
  const toLocal = localParts(grid.tz);
  const days = new Map();
  const keys = new Set([...grid.windKt.keys(), ...grid.waveFt.keys(), ...grid.precipPct.keys(), ...(grid.thunder ? grid.thunder.keys() : [])]);
  const max = (a, b) => (b == null ? a : a == null ? b : Math.max(a, b));
  for (const h of keys) {
    const { date } = toLocal(h);
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, windKt: null, gustKt: null, precipPct: null, waveFt: null, periodSec: null, windHours: 0, waveHours: 0, storm: null }));
    if (grid.windKt.get(h) != null) d.windHours++;
    if (grid.waveFt.get(h) != null) d.waveHours++;
    // Thunder is rated hour by hour against THAT hour's rain chance (as the
    // hourly strip does): >= 25% with thunder is NO-GO, a slight chance is
    // CAUTION. Pairing it with the day's max rain chance instead would let a
    // dry storm hour and an unrelated wet hour add up to a NO-GO day.
    if (grid.thunder && grid.thunder.get(h) === true) {
      const lvl = (grid.precipPct.get(h) ?? 0) >= 25 ? "NO-GO" : "CAUTION";
      d.storm = worseLevel(d.storm, lvl);
    }
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
    .map((d) => {
      const level = riskLevel(round(d.windKt, 0), round(d.gustKt, 0), d.precipPct ?? 0, "", round(d.waveFt, 1), round(d.periodSec, 0), profile);
      // A future day the grid only partly covers (often the last one) has a
      // max taken over a few hours: it can't make GO, though what it does
      // show can still make CAUTION/NO-GO. Today is exempt: its remaining
      // hours are what matter and they're covered.
      // Great Lakes days also need the waves covered (the NWS wave grid often
      // ends before the wind grid), not a max over a couple of hours.
      const sparse = d.date !== today && (d.windHours < MIN_DAY_WIND_HOURS || (profile === "lake" && d.waveHours < MIN_DAY_WIND_HOURS));
      return {
        date: d.date,
        windKt: round(d.windKt, 0),
        gustKt: round(d.gustKt, 0),
        precipPct: d.precipPct == null ? null : Math.round(d.precipPct),
        waveFt: round(d.waveFt, 1),
        periodSec: round(d.periodSec, 0),
        thunder: d.storm != null,
        // Sparse days can't be GO; then any forecast thunder that day raises it.
        level: worseLevel(sparse && level === "GO" ? null : level, d.storm),
      };
    });
}

// The more cautious of two levels; null (no call) loses to any real level.
function worseLevel(a, b) {
  const rank = { GO: 0, CAUTION: 1, "NO-GO": 2 };
  if (a == null) return b ?? null;
  if (b == null) return a;
  return rank[b] > rank[a] ? b : a;
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

// The NWS zones whose alerts apply to a spot, besides whatever covers its point:
// its own marine zone, its bar zone, and any extra `alertZones`. Asked for by
// ID because a launch's coordinates usually sit on the shore, outside the
// marine-zone polygon, where a point lookup never returns marine advisories
// (true for over half the curated spots when checked in Nov 2026).
const ALERT_ZONE_ID = /^[A-Z]{2}Z\d{3}$/;
export function alertZonesFor(spot) {
  return [...new Set([spot?.zone, spot?.bar?.zone, ...(spot?.alertZones || [])].filter((z) => ALERT_ZONE_ID.test(String(z || ""))))];
}

// Outer rings ([[lon, lat], ...]) of a GeoJSON Polygon/MultiPolygon, or null
// (= no usable polygon, so the alert applies zone-wide). Fails toward
// applying: any malformed ring (too few points, non-finite or out-of-range
// coordinates) voids the whole geometry rather than being skipped, and other
// geometry types (GeometryCollection, Point) count as no polygon.
const okRing = (r) => Array.isArray(r) && r.length >= 4 &&
  r.every((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]) && Math.abs(pt[0]) <= 180 && Math.abs(pt[1]) <= 90);
function alertPolygons(g) {
  if (!g) return null;
  let rings = null;
  if (g.type === "Polygon" && Array.isArray(g.coordinates)) rings = [g.coordinates[0]];
  else if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) rings = g.coordinates.map((p) => (Array.isArray(p) ? p[0] : null));
  return rings && rings.length && rings.every(okRing) ? rings : null;
}
// Storm motion from NWS eventMotionDescription ("<time>...storm...259DEG...21KT...41.68,-71.1").
// DEG is the direction the storm moves FROM (TIME...MOT...LOC convention), so
// it travels toward DEG + 180. null when absent or unparseable.
function alertMotion(desc) {
  const m = /\.\.\.(\d{1,3})DEG\.\.\.(\d{1,3})KT/.exec(String(desc || ""));
  if (!m || +m[1] > 360) return null;
  return { towardDeg: (+m[1] + 180) % 360, kt: +m[2] };
}
// Does an alert reach this launch? An alert with a warned polygon applies
// when the launch is inside it or within ALERT_POLYGON_BUFFER_NM of its edge
// (a boat from that launch can be that far out). One without a polygon
// applies to its whole zone, as listed. A county-wide UGC on a storm-based
// warning otherwise flags launches at the far end of a big county (Kona under
// a Hilo-side flash flood, Grand Isle under a New Orleans one).
// Exceptions, all failing toward applying the alert:
// - Marine products (Special Marine Warning, Marine Weather Statement) stay
//   zone-wide: the marine zone is the water the boater will be on, and the
//   launch point sits on its shore, not at its centre.
// - A Flash Flood Emergency (catastrophic damage threat) stays county-wide.
// - Storm-track products (tornado, severe thunderstorm, snow squall, extreme
//   wind, special weather statement) are drawn along a moving storm: the
//   polygon is also carried ALERT_TRACK_SWEEP_H further along the storm's
//   motion, so a launch just ahead of the leading edge (where the storm will
//   be within the hour, and beyond our 5-10 min response cache) is still
//   flagged. Without a parseable motion they apply county-wide.
export const ALERT_POLYGON_BUFFER_NM = 10;
export const ALERT_TRACK_SWEEP_H = 0.5;
const ZONE_WIDE_ALERTS = /marine/;
const TRACK_ALERTS = /tornado|thunderstorm|snow squall|extreme wind|special weather statement|dust storm/;
export function alertReachesSpot(a, spot) {
  if (!a?.polygons || !a.polygons.length || !Number.isFinite(spot?.lat) || !Number.isFinite(spot?.lon)) return true;
  const ev = String(a.event || "").toLowerCase();
  if (ZONE_WIDE_ALERTS.test(ev) || /catastrophic/i.test(a.ffThreat || "") || ev === "flash flood emergency") return true;
  const motion = a.motion || null;
  if (TRACK_ALERTS.test(ev) && !motion) return true;
  // Local plane centred on the launch, in nm (equirectangular; fine at
  // warning-polygon scale). Longitudes are wrapped relative to the launch so
  // a polygon across the antimeridian stays contiguous.
  const kx = 60 * Math.cos((spot.lat * Math.PI) / 180);
  const rings = a.polygons.map((r) => r.map(([lon, lat]) => [((((lon - spot.lon) % 360) + 540) % 360 - 180) * kx, (lat - spot.lat) * 60]));
  // Shifts along the motion vector, every <= 1 nm out to the sweep distance.
  const sweep = motion ? motion.kt * ALERT_TRACK_SWEEP_H : 0;
  const n = Math.ceil(sweep);
  const ux = motion ? Math.sin((motion.towardDeg * Math.PI) / 180) : 0, uy = motion ? Math.cos((motion.towardDeg * Math.PI) / 180) : 0;
  for (let k = 0; k <= n; k++) {
    const d = n ? (sweep * k) / n : 0;
    // The launch is at the origin; shifting the ring by +d equals moving the launch by -d.
    const px = -ux * d, py = -uy * d;
    if (rings.some((ring) => pointInRing(px, py, ring) || ringDistance(px, py, ring) <= ALERT_POLYGON_BUFFER_NM)) return true;
  }
  return false;
}
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Shortest distance from (x, y) to a ring's edges, same planar units. Walks
// the closing edge too, so an unclosed ring isn't read as farther away.
function ringDistance(x, y, ring) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0] - x, ay = ring[j][1] - y;
    const dx = ring[i][0] - ring[j][0], dy = ring[i][1] - ring[j][1], len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}
const toAlert = (f) => ({
  event: f.properties?.event,
  severity: f.properties?.severity,
  headline: f.properties?.headline,
  description: f.properties?.description,
  sent: f.properties?.sent || f.properties?.effective || null,
  onset: f.properties?.onset || f.properties?.effective || null,
  ends: f.properties?.ends || f.properties?.expires,
  // The event's own end, null when NWS gives none ("until further notice",
  // e.g. hurricane/tropical warnings). `ends` above falls back to `expires`,
  // which is only when the PRODUCT lapses (often hours before the event ends),
  // so timing uses this instead (see alertSpan).
  eventEnds: f.properties?.ends ?? null,
  zones: f.properties?.geocode?.UGC || [],
  // NWS issues a Flash Flood Emergency as an ordinary "Flash Flood Warning"
  // event; only this parameter (CATASTROPHIC) tells them apart.
  ffThreat: f.properties?.parameters?.flashFloodDamageThreat?.[0] || null,
  // Storm-based products (Severe Thunderstorm, Tornado, Flash Flood, Snow
  // Squall, Special Marine, polygon SPS/MWS) carry the warned polygon and,
  // for storm tracks, its motion; zone-based products have neither.
  polygons: alertPolygons(f.geometry),
  motion: alertMotion(f.properties?.parameters?.eventMotionDescription?.[0]),
});
async function alertsAt(query) {
  try {
    const data = await getJSON(`${NWS}/alerts/active?${query}`);
    if (!data || !Array.isArray(data.features)) return null;
    // Only real alerts: NWS also publishes Test/Exercise/System messages,
    // which must never move a verdict.
    return data.features.filter((f) => (f.properties?.status ?? "Actual") === "Actual").map(toAlert);
  } catch (e) {
    return null;
  }
}
// Active alerts for a spot: by its launch point AND by its marine zone. Marine
// warnings (SCA, Gale) are issued per marine zone, and a launch point on the
// shoreline is often outside its zone polygon, so a point-only lookup misses
// them (Petoskey missed a Gale Warning that way). Returns { alerts, ok }:
// alerts merges whatever answered (null only if nothing did), and ok is false
// if any lookup failed, so a partial answer is never read as "no advisories".
// Also by the launch point's land zones (forecast zone + county, see
// landZonesFor), the same ones the tiles, digest and weekend email use: a
// launch point on the water is in no land zone, so the point query alone
// misses zone-issued land warnings (High Wind, Blizzard, Winter Storm, Lake
// Effect Snow) and the page would read softer than its own tile. Unresolved
// land zones count as a failed lookup (ok false).
// Bar harbors also ask for their bar zone and any `alertZones` (alertZonesFor).
export async function fetchAlerts(spot) {
  const queries = [`point=${spot.lat},${spot.lon}`];
  // spot.zone is asked for even when malformed (an old built record), so a
  // bad zone reads as a failed lookup, never as "no advisories".
  const marineZones = [...new Set([spot.zone, ...alertZonesFor(spot)].filter(Boolean))];
  if (marineZones.length) queries.push(`zone=${marineZones.map(encodeURIComponent).join(",")}`);
  // Request path: inland steps only (no ring), so an arbitrary ?lat=&lon=
  // can cost at most 4 /points lookups. Ring-only spots are resolved and
  // cached by the summary/cron walk; until then the page reads "unknown".
  const landQ = landZonesFor(spot, null, { ring: false }).catch(() => null)
    .then((land) => (land && land.length ? alertsAt(`zone=${land.map(encodeURIComponent).join(",")}`) : null));
  const results = await Promise.all([...queries.map(alertsAt), landQ]);
  // The point query already matches warned polygons; zone/county queries
  // return every alert listing the zone, so keep only those that reach the
  // launch (see alertReachesSpot).
  const answered = results.map((r, i) => (r == null || i === 0 ? r : r.filter((a) => alertReachesSpot(a, spot)))).filter((r) => r != null);
  return {
    alerts: answered.length ? dedupeAlerts(answered.flat()) : null, // one card per event type
    all: answered.flat(), // every issuance, for timing (two SCAs can cover different hours)
    ok: answered.length === results.length,
  };
}

// How an active alert moves a boating verdict. Shore-side alerts (air
// quality, rip currents for swimmers, coastal flooding, heat) are listed but
// don't move it: on the coasts they run most days and would pin every launch
// at CAUTION. Watches are a heads-up (CAUTION); marine warnings decide.
const NOTE_ONLY = /air quality|rip current|beach hazard|coastal flood|lakeshore flood|flood (watch|warning|advisory|statement)|hydrologic|heat|frost|freeze|red flag|fire weather/;
// Warnings that end a small-boat trip outright. Matched as substrings of the
// lowercased NWS event name, alongside the broad gale/storm/hurricane terms
// (storms of every kind: a land Winter/Ice Storm Warning still means a
// dangerous day on the water).
// Tornado and high/extreme wind warnings mean damaging wind at the launch.
// Freezing spray of any grade (advisory or heavy-spray warning) ices a small
// boat's topsides and can capsize it (late-season Great Lakes, Alaska).
// Blizzard, snow squall and lake effect snow warnings mean near-zero
// visibility in strong wind over near-freezing water (lake effect bands come
// with the fetch-aligned wind that builds Great Lakes chop). A high surf
// warning makes inlet/bar crossings and beach launches unsafe. "typhoon"
// keeps the tropical set complete (watches are caught above as CAUTION).
const NO_GO_ALERTS = ["gale", "storm", "special marine", "hurricane", "typhoon", "hazardous seas", "tsunami",
  "tornado warning", "high wind warning", "extreme wind", "freezing spray",
  "blizzard warning", "snow squall warning", "lake effect snow warning", "high surf warning"];
// Bar harbors (spot.bar): NWS folded "Small Craft Advisory for Rough Bar" into
// the plain "Small Craft Advisory" (the bar wording is only in the text), and
// the Oregon coastal-zone advisories that cover Yaquina, Depoe Bay, Coos Bay
// and the Chetco often don't mention bars at all. So at a bar harbor ANY
// marine advisory or warning for its zones (incl. High Surf: surf is what
// breaks on a bar) is NO-GO: bars break well before the open sea looks bad,
// above all on the ebb, and the bar is the only way out.
// Marine-weather events that make a bar/inlet crossing dangerous. "storm
// warning" (not bare "storm") so a land Winter/Ice/Dust Storm Warning isn't
// worded as a bar hazard; those still go NO-GO as storms.
const BAR_HAZARD = /small craft|brisk wind|hazardous seas|rough bar|high surf|gale|storm warning|storm watch|special marine|hurricane|typhoon|tropical storm|tsunami|freezing spray|high wind|extreme wind/;
const LAND_STORM = /winter storm|ice storm|dust storm|snow squall|blizzard/;
const isBarHazard = (ev) => BAR_HAZARD.test(ev) && !LAND_STORM.test(ev);
// "Bar" vs "inlet" wording for a spot's crossing.
const crossing = (bar) => (bar?.inlet ? "inlet" : "bar");
// The level any spot gets from an alert (null = shore-side note only).
function baseAlertLevel(a) {
  const ev = (a?.event || "").toLowerCase();
  if (!ev) return null;
  // A Flash Flood Warning means flooding is happening or imminent: debris and
  // fast current at river-mouth and estuary ramps. CAUTION, not a shore-only
  // note. Flash Flood Watches/Statements stay notes (common in summer; they
  // would pin coastal launches at CAUTION).
  // A Flash Flood Emergency (catastrophic damage threat, severe threat to
  // life) arrives as event "Flash Flood Warning" with flashFloodDamageThreat
  // CATASTROPHIC: NO-GO. The literal event name is kept in case NWS ever
  // issues it as its own event.
  if (ev === "flash flood emergency") return "NO-GO";
  if (ev === "flash flood warning") return /catastrophic/i.test(a?.ffThreat || "") ? "NO-GO" : "CAUTION";
  if (NOTE_ONLY.test(ev)) return null;
  if (ev.includes("watch")) return "CAUTION";
  if (NO_GO_ALERTS.some((k) => ev.includes(k))) return "NO-GO";
  return "CAUTION";
}
// One alert's effect at a spot: { to: level | null, why, bar? } (to null =
// listed as a note, no level change), or null for an alert with no event.
// The bar rule only ever raises baseAlertLevel, never lowers it.
function alertEffect(a, spot = null) {
  const ev = (a?.event || "").toLowerCase();
  if (!ev) return null;
  const base = baseAlertLevel(a);
  if (!base) return { to: null, why: `${a.event} in effect (shoreline, not a boating limit)` };
  const bar = spot?.bar || null;
  if (ev.includes("watch")) return { to: base, why: bar && isBarHazard(ev) ? `Active ${a.event}: the ${bar.name} may turn dangerous` : `Active ${a.event}` };
  if (bar && isBarHazard(ev)) return { to: "NO-GO", bar: true, why: `${a.event} in effect: dangerous for crossing the ${bar.name}. Don't cross; check USCG ${crossing(bar)} restrictions` };
  return { to: base, why: `Active ${a.event}` };
}
// The level an alert sets at a spot (pass the spot so bar harbors get the bar
// rule; without it, the any-spot level).
export function alertLevel(a, spot = null) {
  return alertEffect(a, spot)?.to ?? null;
}
// Effects of a list of alerts, in order (the headline's reasons).
export function alertEffects(alerts, spot = null) {
  return (alerts || []).map((a) => alertEffect(a, spot)).filter(Boolean);
}
// [start, end) in epoch ms. No onset = already in effect; no end = open-ended.
// A warning/watch/advisory with no event end (NWS "until further notice") is
// open-ended: its `expires` is just the product's re-issue time, and treating
// that as the end would show GO hours under a warning that is still in force.
// Statements (Marine/Special Weather Statement) carry no event end by design;
// for those `expires` is the meaningful end.
function alertSpan(a) {
  const s = Date.parse(a.onset || "");
  const ufn = "eventEnds" in a && a.eventEnds == null && /warning|watch|advisory/i.test(a.event || "");
  const e = ufn ? NaN : Date.parse(a.ends || "");
  return [Number.isFinite(s) ? s : -Infinity, Number.isFinite(e) ? e : Infinity];
}
// The worst alert level in effect at any time in [fromMs, toMs).
function alertLevelBetween(alerts, fromMs, toMs, spot = null) {
  let lvl = null;
  for (const a of alerts || []) {
    const al = alertLevel(a, spot);
    if (!al) continue;
    const [s, e] = alertSpan(a);
    if (s < toMs && e > fromMs) lvl = worseLevel(lvl, al);
  }
  return lvl;
}
// When the alerts lookup failed, how far ahead to refuse GO: a missing feed
// hides whatever has already been issued. Small Craft Advisories usually lead
// by 12-36 h, but gale/storm and tropical watches are issued up to ~48 h ahead,
// so 48 h covers essentially every product that could exist.
const ALERTS_UNKNOWN_CAP_H = 48;
// Raise hourly rows ({time, level}) to any alert in effect that hour; when
// alerts couldn't be checked, GO hours within ALERTS_UNKNOWN_CAP_H become CAUTION.
// `spot` (optional) applies the bar-harbor rule.
export function applyAlertsToHours(hours, alerts, alertsOk = true, nowMs = Date.now(), spot = null) {
  return (hours || []).map((h) => {
    const t = Date.parse(h.time);
    if (!Number.isFinite(t)) return h;
    let level = worseLevel(h.level, alertLevelBetween(alerts, t, t + 3600e3, spot));
    if (!alertsOk && level === "GO" && t < nowMs + ALERTS_UNKNOWN_CAP_H * 3600e3) level = "CAUTION";
    return level === h.level ? h : { ...h, level, alert: true };
  });
}
// Same for the week strip ({date, level} in the spot's local calendar).
export function applyAlertsToWeek(week, alerts, alertsOk, tz, nowMs = Date.now(), spot = null) {
  if (!week || !week.length) return week;
  const toLocal = localParts(tz || "America/New_York");
  const spans = (alerts || []).filter((a) => alertLevel(a, spot)).map((a) => {
    const [s, e] = alertSpan(a);
    const nowH = Math.floor(nowMs / 3600e3);
    const from = Number.isFinite(s) ? toLocal(Math.floor(s / 3600e3)).date : toLocal(nowH).date;
    const to = Number.isFinite(e) ? toLocal(Math.floor((e - 1) / 3600e3)).date : "9999-12-31";
    return { from, to, level: alertLevel(a, spot) };
  });
  // Alerts unknown: no GO on any local day the hourly cap reaches (same
  // window as applyAlertsToHours, so the two strips agree).
  const capTo = toLocal(Math.floor((nowMs + ALERTS_UNKNOWN_CAP_H * 3600e3 - 1) / 3600e3)).date;
  return week.map((d) => {
    let level = d.level;
    for (const sp of spans) if (d.date >= sp.from && d.date <= sp.to) level = worseLevel(level, sp.level);
    if (!alertsOk && d.date <= capTo && level === "GO") level = "CAUTION";
    return level === d.level ? d : { ...d, level, alert: true };
  });
}
// Active marine alerts for many zones at once (the directory, digest and
// weekend email cover dozens of spots): the NWS API takes a comma-separated
// zone list, so this is a handful of requests, not one per spot. Returns
// { byZone: Map(zone -> alerts[]), ok } — ok false if any chunk failed.
const ZONE_RE = /^[A-Z]{3}\d{3}$/;
export async function fetchZoneAlerts(zones) {
  const list = [...new Set((zones || []).filter((z) => ZONE_RE.test(z || "")))];
  const byZone = new Map(list.map((z) => [z, []]));
  if (!list.length) return { byZone, ok: true };
  const chunks = [];
  for (let i = 0; i < list.length; i += 25) chunks.push(list.slice(i, i + 25));
  const results = await Promise.all(chunks.map((c) => alertsAt(`zone=${c.join(",")}`)));
  for (const r of results) {
    for (const a of r || []) for (const z of a.zones) if (byZone.has(z)) byZone.get(z).push(a);
  }
  // Not deduped: two issuances of one event can cover different hours.
  return { byZone, ok: results.every((r) => r != null) };
}
// Land zones (NWS forecast zone + county) for a launch point. Land products —
// flash flood, tornado, high wind, blizzard, severe thunderstorm warnings —
// are issued for these, never for marine zones, so a marine-zone lookup alone
// misses them. Curated spots carry them in SPOTS; user-built pages resolve
// them from NWS /points (walked, budgeted, cached a week).
// null = the lookup failed (unknown, not "none").
const pointKey = (spot) => `${spot.lat},${spot.lon}`;
// About half our launch points sit on the water itself: NWS maps them to a
// marine forecast zone with no county. Step inland (away from the seaward
// bearing, as fetchForecastsNear does) until a point lands in a county.
// Barrier islands, keys and river launches can have water inland too, so
// after the inland steps, search a small ring around the launch.
const LAND_STEPS = [0, 0.02, 0.05, 0.1];
const LAND_RING = [0.02, 0.05].flatMap((r) => [0, 45, 90, 135, 180, 225, 270, 315].map((b) => [r, b]));
// The resolved zones are cached a week per launch point (counties don't move),
// so steady state is one cache read per spot, not a /points walk.
const landMemo = new Map();
// `budget` ({ walks }) caps how many uncached walks one invocation may do (a
// cold walk is 1-20 /points lookups); past it the spot is unknown (no GO)
// until a later run resolves it. Omit it for a single spot (the spot page).
export async function landZonesFor(spot, budget = null, { ring = true } = {}) {
  // Every curated spot carries its land zones (SPOTS[*].land, resolved once
  // and checked by hand: county lines, launches across a bay), so the walk
  // below only runs for user-built pages.
  if (Array.isArray(spot?.land) && spot.land.length) return spot.land;
  if (spot?.lat == null || spot?.lon == null) return null;
  const key = `https://land-zones.local/v1/${spot.lat},${spot.lon},${spot.sea ?? ""},${spot.lake || ""}`;
  const edge = typeof caches !== "undefined" && caches.default;
  if (edge) {
    const hit = await caches.default.match(new Request(key)).then((r) => (r ? r.json() : null)).catch(() => null);
    if (Array.isArray(hit) && hit.length) return hit;
  } else if (landMemo.has(key)) return landMemo.get(key);
  if (budget) { if (budget.walks <= 0) return null; budget.walks--; }
  const { zones: found, clean } = await resolveLandZones(spot, ring);
  // Only cache a clean walk: if an earlier (closer) candidate errored, the
  // county found farther out may not be the launch's own. Use it this time,
  // but walk again next time rather than pin a possibly-wrong county a week.
  if (found && clean) {
    if (edge) await caches.default.put(new Request(key), new Response(JSON.stringify(found), { headers: { "Cache-Control": "public, max-age=604800" } })).catch(() => {});
    else landMemo.set(key, found);
  }
  return found; // null (unknown) is never cached, so a blip retries next time
}
async function resolveLandZones(spot, ring = true) {
  const kLon = 1 / Math.max(0.2, Math.cos((spot.lat * Math.PI) / 180));
  const candidates = [
    ...LAND_STEPS.map((step) => (step ? seawardPoint(spot, -step) : { lat: spot.lat, lon: spot.lon })),
    ...(ring ? LAND_RING : []).map(([r, b]) => ({ lat: round(spot.lat + Math.cos((b * Math.PI) / 180) * r, 4), lon: round(spot.lon + Math.sin((b * Math.PI) / 180) * r * kLon, 4) })),
  ];
  let clean = true;
  for (const pt of candidates) {
    try {
      const p = (await cachedJSON(`${NWS}/points/${pt.lat},${pt.lon}`, 86400))?.properties;
      const county = String(p?.county || "").split("/").pop();
      if (!ZONE_RE.test(county)) continue; // on the water: no county here
      const fz = String(p?.forecastZone || "").split("/").pop();
      return { zones: ZONE_RE.test(fz) ? [fz, county] : [county], clean };
    } catch (e) {
      clean = false; // a failed lookup is not "no county": try the next, but don't cache
    }
  }
  return { zones: null, clean };
}
// Alerts for many spots at once (directory, digest, weekend email): each
// spot's marine zones (its own, plus a bar harbor's bar zone and any
// `alertZones`, see alertZonesFor) plus its launch point's land zones, in one batched
// zone query. Returns the fetchZoneAlerts shape plus land: Map(pointKey ->
// zone ids | null).
// Uncached built-spot walks allowed per invocation (curated spots never walk).
// A caller that makes several fetchSpotsAlerts calls in one invocation (the
// hourly cron: summary, built summaries, weeks) passes one shared budget from
// landWalkBudget(); a lone call gets its own.
const LAND_WALKS_PER_INVOCATION = 10;
export const landWalkBudget = () => ({ walks: LAND_WALKS_PER_INVOCATION });
export async function fetchSpotsAlerts(spots, budget = landWalkBudget()) {
  const land = new Map();
  const list = (spots || []).filter(Boolean);
  const zonesPerSpot = await pooled(list, 8, (s) => landZonesFor(s, budget));
  list.forEach((s, i) => land.set(pointKey(s), zonesPerSpot[i] ?? null));
  const za = await fetchZoneAlerts([...list.flatMap((s) => [s.zone, ...alertZonesFor(s)]), ...zonesPerSpot.flat().filter(Boolean)]);
  return { ...za, land };
}
const zoneAlertsFor = (za, spot) => {
  if (!za || !spot) return [];
  const zones = new Set([spot.zone, ...alertZonesFor(spot), ...((za.land && za.land.get(pointKey(spot))) || [])]);
  // One alert can list several of the spot's zones (the bar and the sea
  // outside it): count each issuance once.
  return [...new Set([...zones].flatMap((z) => (z && za.byZone.get(z)) || []))].filter((a) => alertReachesSpot(a, spot));
};
// Were this spot's zone alerts actually checked? Every directory spot is
// marine (built pages require a marine zone), so a spot with no valid zone —
// e.g. an old user-built record — had nothing looked up: missing data, not
// "no advisories".
// Land alerts count too: if the launch point's land zones couldn't be
// resolved, its land warnings weren't checked either.
// Fails closed: without land-zone results (za.land from fetchSpotsAlerts)
// the spot's land warnings weren't checked.
const zoneAlertsOkFor = (za, spot) => !!za && za.ok && ZONE_RE.test(spot?.zone || "")
  && za.land instanceof Map && za.land.get(pointKey(spot)) != null;

// NWS re-issues the same advisory repeatedly (e.g. three "Air Quality Alert"
// features minutes apart). Collapse to one card per event type, keeping the
// most recently sent, so the page shows one Air Quality Alert, not three.
function dedupeAlerts(alerts) {
  if (!alerts || !alerts.length) return alerts;
  const byEvent = new Map();
  for (const a of alerts) {
    const key = (a.event || "").toLowerCase().trim();
    const prev = byEvent.get(key);
    // Keep the worse-graded issuance first (a Flash Flood Emergency and an
    // ordinary Flash Flood Warning share an event name), then the latest.
    const rank = (x) => ({ CAUTION: 1, "NO-GO": 2 })[alertLevel(x)] || 0;
    if (!prev || rank(a) > rank(prev) || (rank(a) === rank(prev) && (a.sent || "") > (prev.sent || ""))) byEvent.set(key, a);
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

// Expand a UGC zone spec ("LEZ142>144", "LEZ145-146", "LMZ344-345-LHZ345")
// to full zone IDs. The prefix matters: one office's NSH carries the same
// number on different lakes (APX: LMZ345 is Point Betsie to Sleeping Bear
// Point, LHZ345 the Straits of Mackinac), and matching on the number alone
// gave Mackinaw City the Sleeping Bear forecast from ~150 km away.
export function ugcZones(spec) {
  const ids = [];
  let prefix = null, prev = null, m;
  const re = /([>-]?)([A-Z]{3})?(\d{3})/g;
  while ((m = re.exec(String(spec || "")))) {
    if (m[2]) { prefix = m[2]; if (m[1] !== ">") prev = null; }
    if (!prefix) continue;
    const n = +m[3];
    if (m[1] === ">" && prev != null) for (let k = prev + 1; k <= n; k++) ids.push(prefix + String(k).padStart(3, "0"));
    else ids.push(prefix + String(n).padStart(3, "0"));
    prev = n;
  }
  return ids;
}

// Raise the grid's hourly waves to the authoritative nearshore forecast. The
// forecaster-edited grid samples the cell just off the ramp, which is sheltered
// and reads low; the nearshore product forecasts the open water a boater
// actually crosses. So we floor each hour's grid wave at its period's forecast
// peak (never lower it), which keeps the grid's timing but the nearshore's
// magnitude — and makes the headline, the hour-by-hour strip, and the week all
// agree with the nearshore report. Marine periods run in ~12h day/night blocks
// starting from "now", so we bucket each hour into a period by local half-day.
// Physical sanity check for a wave period: a wave can't be steeper than about
// 1:7 (height / deep-water wavelength, wavelength ≈ 1.56·T² m) before it breaks.
// The grid's period layer and the nearshore wave floor come from different
// sources, so a raised height can sit on a tiny period ("7 ft @ 1s"). DISPLAY
// ONLY: such a period is blanked ("—") in what the page shows, but the verdict
// is always computed from the raw series first (a missing period must never
// soften a call: short period is what makes seas steep).
export function plausiblePeriod(waveFt, sec) {
  if (sec == null || !(sec > 0)) return null;
  if (sec < 1.5) return null;
  // Periods arrive rounded to whole seconds, so allow +0.5 s before calling a
  // pair impossible: real Lake Erie chop like 3–4 ft @ 2 s must stay visible.
  const T = sec + 0.5;
  if (waveFt != null && waveFt * 0.3048 > (1.56 * T * T) / 7) return null;
  return sec;
}

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
// A UGC header line: zone list (a prefix may change mid-list) + expiry.
const UGC_LINE = /^([A-Z]{3}\d{3}(?:[>-](?:[A-Z]{3})?\d{3})*)-\d{6}-\s*$/;
export function nshPeriodsForZone(text, zone) {
  if (!text || !zone) return [];
  const want = String(zone).trim().toUpperCase();
  if (!/^[A-Z]{3}\d{3}$/.test(want)) return [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(UGC_LINE);
    if (!h || !ugcZones(h[1]).includes(want)) continue;
    let body = "";
    for (let j = i + 1; j < lines.length; j++) {
      if (UGC_LINE.test(lines[j])) break;
      body += lines[j] + " ";
    }
    const periods = [];
    const re = /\.([A-Z][A-Z ]+?)\.\.\.\s*([\s\S]*?)(?=\.[A-Z][A-Z ]+?\.\.\.|$)/g;
    let m;
    while ((m = re.exec(body))) {
      // The last period runs into the product's "$$" terminator (and any trailing
      // boilerplate after it): cut there so it never shows in the forecast card.
      const forecast = m[2].split("$$")[0].replace(/\s+/g, " ").trim();
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
// Launch facts for the "About <spot>" card. `obs` is this response's live
// readings ({ buoy, wind, waves }); pass it whenever a conditions fetch ran so
// the card only calls a station live if it returned a fresh (<3 h) observation
// in THIS response. Great Lakes offshore buoys are pulled for the winter, and
// a configured station is not a live one. Without `obs` (static/SSR render)
// liveData.checked is false and callers must not claim any station is live.
export function spotFacts(spot, obs) {
  const buoys = (spot.buoys || []).filter(Boolean);
  let liveData = { checked: false, live: null, ageMinutes: null, observedAt: null, offline: [], windFrom: null, wavesFrom: null };
  if (obs) {
    const live = obs.buoy && obs.buoy.station && buoys.includes(obs.buoy.station) ? obs.buoy.station : null;
    // fetchBuoy tries stations in order and stops at the first fresh one that
    // reports wind or waves, so every station ahead of the live one (or all, if
    // none) failed, was stale, or reported only temperatures.
    // Stations after the live one were never checked, so they're omitted.
    const idx = live ? buoys.indexOf(live) : buoys.length;
    liveData = {
      checked: true,
      live,
      ageMinutes: live && Number.isFinite(obs.buoy.ageMinutes) ? Math.max(0, obs.buoy.ageMinutes) : null,
      observedAt: live && Number.isFinite(Date.parse(obs.buoy.observedAt)) ? obs.buoy.observedAt : null,
      offline: buoys.slice(0, idx),
      windFrom: obs.wind?.source ?? null, // "buoy" | "forecast" | null (null = no data at all)
      wavesFrom: obs.waves?.source ?? null,
    };
  }
  return {
    lake: spot.lake || "Lake Erie",
    lat: spot.lat, lon: spot.lon,
    zone: spot.zone || null,
    buoys, // configured stations, NOT a claim that any is reporting; see liveData
    liveData,
    exposure: windExposure(spot),
    coastal: !!spot.water && spot.water !== "lake",
    water: waterProfile(spot),
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

// One verdict for an hour/day/tile summary, consistent with the hour-by-hour
// strip (withRisk). On lakes and bays the gust counts against the wind limits,
// as it does hourly; on the ocean, sustained and gust are rated separately
// (coastal advisories key on sustained speed). Without wind data there is no
// GO: the call is null (shown "—"), but anything the waves/storms alone
// already make CAUTION or NO-GO is kept, so missing wind never softens a call.
export function riskLevel(windKt, gustKt, precipPct, short, waveFt, periodSec, profile) {
  let lvl;
  if (profile === "ocean") lvl = hourRisk(windKt, precipPct, short, waveFt, periodSec, profile, { sustained: windKt ?? null, gust: gustKt ?? null });
  else {
    const top = Math.max(windKt ?? -1, gustKt ?? -1);
    lvl = hourRisk(top < 0 ? null : top, precipPct, short, waveFt, periodSec, profile);
  }
  if (windKt == null && lvl === "GO") return null;
  // Great Lakes: waves are half the call (short steep chop), so no wave data
  // → no GO either. Inland/sheltered waters rate on wind alone by design.
  // Open ocean: swell is half the call too (a calm wind says nothing about a
  // 12 ft groundswell), so no wave data → no GO there either.
  if ((profile === "lake" || profile === "ocean") && waveFt == null && lvl === "GO") return null;
  return lvl;
}

function withRisk(hours, profile = "lake") {
  // Same rule as tiles/week (riskLevel): lake gusts count, and an hour with no
  // sustained wind is never GO (null, shown "no data"), though waves/storms
  // can still make it CAUTION/NO-GO.
  return (hours || []).map((h) => ({ ...h, level: riskLevel(h.windKt ?? null, h.gustKt ?? null, h.precipPct, h.short, h.waveFt, h.periodSec, profile) }));
}

// Turn the hourly timeline into an actionable "go now / be in by X" outlook.
export function computeOutlook(hours) {
  if (!hours || !hours.length) return null;
  const win = hours.slice(0, 18); // actionable "today/tonight" window for "be in by"
  const out = { nowLevel: hours[0].level, headInBy: null, headInReason: null, goodHours: win.length };
  const idx = win.findIndex((h) => h.level === "NO-GO");
  if (idx === 0) { out.headInBy = win[0].time; out.goodHours = 0; }
  else if (idx > 0) {
    const h = win[idx];
    out.headInBy = h.time;
    out.goodHours = idx;
    const s = (h.short || "").toLowerCase();
    out.headInReason = h.alert ? "a marine warning" : /thunder|tstm|waterspout/.test(s) ? "thunderstorms"
      : (h.waveFt != null && h.waveFt >= 4 ? "building waves"
      : (h.windKt >= 22 ? "building wind" : "deteriorating weather"));
  }
  // An hour with no call (missing wind) is not a good hour: it only SHORTENS
  // the "good for Nh" count. The NO-GO cutoff above is always kept, so a known
  // storm deadline never disappears just because wind data is missing.
  const unknownAt = win.findIndex((h) => h.level == null);
  if (unknownAt === 0) { out.goodHours = 0; out.noData = true; }
  else if (unknownAt > 0 && (idx < 0 || unknownAt < idx)) { out.goodHours = unknownAt; out.dataEndsAt = win[unknownAt].time; }
  return out;
}

// ---- Data freshness ----
// When an input is too old to support a GO (docs/forecast/freshness-and-wind-labels.md).
//   buoyMin     — a live buoy reading this old (or older) can't carry a GO. NDBC
//                 stations report hourly (some every 10 min) and land ~20-50 min
//                 later, so 120 min means at least one report cycle was missed.
//                 Readings over 180 min are already dropped by fetchBuoy.
//   forecastMin — NWS forecasts are routinely re-issued at least twice a day and
//                 the grids amended between; 18 h without an update means a
//                 missed issuance (or a stuck api.weather.gov cache).
//   pageMin     — client-only: a page left open this long gets the amber notice
//                 (the level itself is never changed in the browser).
export const STALE_LIMITS = { buoyMin: 120, forecastMin: 18 * 60, pageMin: 30 };
const ageMinOf = (iso, now = Date.now()) => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60000)) : null; };
const fmtAge = (m) => (m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${Math.round(m / 1440)} days`);
// A grid whose forecaster update is known and overdue. Unknown age is not
// stale (the NWS doesn't always send updateTime); it's shown as unknown.
export function gridStale(g, now = Date.now()) {
  const a = g?.updateTime ? ageMinOf(g.updateTime, now) : null;
  return a != null && a >= STALE_LIMITS.forecastMin;
}

// Wind as one phrase that names the sustained speed AND the gust, each with
// its source, so the reason matches the stat tile and the header strip (the
// level itself rates on the stronger of the two; see buildRecommendation).
// "16 kt, gusts 19 kt (buoy)", "7 kt (buoy), gusts 16 kt (forecast)".
export function windPhrase(wind) {
  const w = wind?.speedKt != null ? round(wind.speedKt, 0) : null;
  const g = wind?.gustKt != null ? round(wind.gustKt, 0) : null;
  const tag = (src) => (src === "buoy" ? " (buoy)" : src === "forecast" ? " (forecast)" : "");
  const showG = g != null && (w == null || g > w);
  if (w == null) return g == null ? null : `gusts ${g} kt${tag(wind.gustSrc)}, no sustained wind reading`;
  if (!showG) return `${w} kt${tag(wind.source)}`;
  if (wind.source === wind.gustSrc) return `${w} kt, gusts ${g} kt${tag(wind.source)}`;
  return `${w} kt${tag(wind.source)}, gusts ${g} kt${tag(wind.gustSrc)}`;
}

// ---- Recommendation engine ----
// Thresholds tuned for small/mid recreational power boats (16-26 ft) on the
// notoriously short, steep chop of Lake Erie's shallow western/central basin.
// Standing local hazards listed on every verdict (never a level change).
function spotNotes(spot) {
  const out = [];
  if (spot?.bar) out.push(`${spot.bar.inlet ? "Inlet" : "Bar"} crossing: the ${spot.bar.name} can break when the open sea looks fine, worst on the ebb. Check the NWS forecast and USCG ${crossing(spot.bar)} restrictions before you cross`);
  return [...out, ...(spot?.notes || [])];
}

// `forecastAgeMin`: minutes since the NWS forecast behind this call was last
// updated (null = unknown). A stale forecast or buoy never carries a GO.
// `buoyAgeMin`: age of the OLDEST station that actually fed wind, gusts or
// waves (fetchBuoy can fill wind from a second station, see windBuoy); when
// omitted, the primary buoy's ageMinutes is used.
export function buildRecommendation({ buoy, alerts, wind, waves, read, hours, profile = "lake", waterF = null, spot = null, forecastAgeMin = null, alertsOk = true, buoyAgeMin }) {
  const reasons = [];
  let level = "GO"; // GO < CAUTION < NO-GO
  const bump = (to, why) => {
    const order = { GO: 0, CAUTION: 1, "NO-GO": 2 };
    if (order[to] > order[level]) level = to;
    if (why) reasons.push(why);
  };

  // Active marine warnings dominate (see alertEffect for what counts, and the
  // bar-harbor rule).
  const effects = alertEffects(alerts, spot);
  for (const x of effects) x.to ? bump(x.to, x.why) : reasons.push(x.why);
  const barNoGo = effects.some((x) => x.bar);
  // A failed alerts lookup is missing data, not "no advisories": never GO on it.
  if (!alertsOk) {
    bump("CAUTION", spot?.bar
      ? `Couldn't confirm NWS advisories, so ${spot.bar.name} conditions are unknown. Check the NWS bar forecast and USCG before you cross`
      : "Couldn't confirm NWS marine alerts; check for advisories before heading out");
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
  // The level rates on topWind (the stronger of sustained and gust); the
  // reason names both, with sources, so it reads the same as the stat tile.
  const topWind = Math.max(wind?.speedKt ?? 0, wind?.gustKt ?? 0);
  if (topWind) {
    const desc = windPhrase(wind);
    // Ocean: no "breezy" step at 12 kt; a 12-15 kt sea breeze is a normal
    // coastal afternoon, and the seas rule above carries the wave risk.
    if (profile === "ocean") {
      // Ocean trade/sea-breeze gusts run well above the sustained wind, and NWS
      // coastal advisories key on sustained speed, so rate them separately.
      const w = wind?.speedKt ?? 0, gu = wind?.gustKt ?? 0;
      if (w >= 22 || gu >= 28) bump("NO-GO", `Strong wind: ${desc}`);
      else if (w >= 17 || gu >= 24) bump("CAUTION", `Windy: ${desc}`);
      else if (w >= 15 || gu >= 20) bump("CAUTION", `Breezy: ${desc}`);
    }
    else if (topWind >= 22) bump("NO-GO", `Strong wind: ${desc}`);
    else if (topWind >= 17) bump("CAUTION", `Windy: ${desc}`);
    else if (topWind >= 12) bump("CAUTION", `Breezy: ${desc}`);
    else if (wv == null) reasons.push(`Light wind: ${desc}`);
  }

  // Wind DIRECTION on the lake's fetch — only matters once there's some wind.
  if (read && topWind >= 10) {
    if (read.tone === "bad") bump("CAUTION", read.short);
    else if (read.tone === "caution") reasons.push(read.short);
  }

  // Wave STEEPNESS — period matters as much as height. Short-period chop is
  // the Great Lakes' signature misery; long-period rollers ride far easier.
  // On the ocean the scale shifts: anything ~10 s+ is swell, <=6 s is steep.
  const periodSec = waves?.periodSec ?? hours?.[0]?.periodSec ?? null;
  if (wv != null && wv >= 2 && periodSec && profile === "ocean") {
    if (periodSec <= 6) reasons.push(`Steep seas: ${wv} ft every ${periodSec}s feels rougher than the number`);
    else if (periodSec >= 10 && spot?.bar) reasons.push(`Long-period swell (${periodSec}s): easier offshore, but it stacks up and breaks on the ${spot.bar.name}, worst on the ebb`);
    else if (periodSec >= 10) reasons.push(`Long-period swell (${periodSec}s): a smoother ride than ${wv} ft suggests, but watch inlets on the ebb`);
  } else if (wv != null && wv >= 2 && periodSec) {
    if (periodSec <= wv * 2) reasons.push(`Short-period chop: ${wv} ft at ${periodSec}s feels rougher than the number`);
    else if (periodSec >= wv * 3) reasons.push(`Longer-period waves (${periodSec}s): smoother ride than ${wv} ft suggests`);
  }

  // Cold water is a safety fact regardless of the verdict: under ~60°F,
  // unexpected immersion is dangerous (cold-shock). Flag, don't bump.
  // Any source the page shows (buoy, nearby station, NWS text), not only the
  // launch's own buoy, so the warning doesn't vanish when a buoy is pulled.
  const wt = waterF ?? buoy?.waterTempF ?? null;
  if (wt != null && wt < 60) {
    reasons.push(`Water ${round(wt, 0)}°F, cold-shock risk if you go in; dress for immersion`);
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

  // Stale inputs never carry a GO (standing rule). The reason is added even
  // when the call is already CAUTION/NO-GO, so the boater knows the age.
  const liveObs = wind?.source === "buoy" || wind?.gustSrc === "buoy" || waves?.source === "buoy";
  const preStale = level;
  const rawBuoyAge = buoyAgeMin !== undefined ? buoyAgeMin : buoy?.ageMinutes;
  const buoyAge = liveObs && Number.isFinite(rawBuoyAge) ? Math.max(0, rawBuoyAge) : null;
  if (buoyAge != null && buoyAge >= STALE_LIMITS.buoyMin) {
    bump("CAUTION", `The buoy reading is ${fmtAge(buoyAge)} old; conditions may have changed. Check before you launch`);
  }
  const anyData = wv != null || wind?.speedKt != null || wind?.gustKt != null || (hours || []).length > 0;
  if (anyData && forecastAgeMin != null && forecastAgeMin >= STALE_LIMITS.forecastMin) {
    bump("CAUTION", `The NWS forecast hasn't been updated in ${fmtAge(forecastAgeMin)}; check the latest marine forecast before you launch`);
  }
  const staleCapped = preStale === "GO" && level !== "GO";

  // No wind AND no waves means the upstream feeds failed (NOAA outage, timeout),
  // not that it's calm. Never call GO on missing data — fail to CAUTION and
  // say why, so a blank page can't read as "looks good".
  // A gust alone is not wind data: with no sustained wind and no waves there is
  // no basis for a call (a strong gust still escalates via topWind above).
  const noData = wv == null && wind?.speedKt == null;
  if (noData) {
    bump("CAUTION", "Live wind and wave data are unavailable right now. Check the NWS marine forecast before you launch");
  } else if (wind?.speedKt == null) {
    // Waves alone (or a lone gust) can't make GO: wind is the decisive signal.
    bump("CAUTION", "Live wind data is unavailable right now. Check the NWS marine forecast before you launch");
  } else if (profile === "lake" && wv == null) {
    // Great Lakes: waves are half the call (tiles/hours show "—" here), so
    // wind alone can't make the headline GO either.
    bump("CAUTION", "Wave data is unavailable right now. On the Great Lakes, check the NWS nearshore forecast before you launch");
  } else if ((profile === "ocean" || spot?.bar) && wv == null) {
    // Ocean and bar harbors: light wind says nothing about the swell (or what
    // it does on the bar), so no wave data → no GO.
    bump("CAUTION", spot?.bar
      ? `Wave data is unavailable right now, so conditions on the ${spot.bar.name} are unknown. Check the NWS bar forecast before you cross`
      : "Wave data is unavailable right now. Check the NWS coastal waters forecast for seas before you launch");
  } else if (reasons.length === 0) {
    // "Calm" only when waves were actually measured or forecast.
    reasons.push(wv != null ? "Calm conditions reported" : "Light wind reported; no wave data for this water");
  }
  // Say so whenever neither wind nor waves came from a live buoy, even if some
  // station reported temperatures: the verdict is then the forecast alone.
  if (!liveObs && !noData) reasons.push("No live buoy here; using the NWS forecast, so verify before launch");
  // A buoy that supplies wind (or gusts) but no wave height leaves the wave
  // half of the call on the forecast. Say so: a live wind reading must not
  // make forecast waves look measured. Reason line only, never a level change.
  else if (liveObs && waves?.source === "forecast" && wv != null) reasons.push("Waves are from the NWS forecast (no live wave reading); verify before launch");

  reasons.push(...spotNotes(spot));

  // The "no data" line only when that's the whole story: a gust or storm that
  // drove the call higher gets the normal summary for its level.
  // noCall: the CAUTION is there only because nothing was received; the page
  // shows it as a neutral "NO DATA" state, never as GO (level stays CAUTION
  // for every API consumer, e.g. emails and the summary tiles).
  const noCall = noData && level === "CAUTION";
  const summary = noCall
    ? "No live data right now. Check before you go."
    : staleCapped && level === "CAUTION"
    ? "Data is out of date. Check before you go."
    : {
        GO: "Looks good to boat.",
        CAUTION: "Boatable with caution. Small boats take care.",
        "NO-GO": barNoGo ? `Not recommended. Don't cross the ${crossing(spot.bar)}.` : "Not recommended. Stay in.",
      }[level];

  // Collapse duplicates (e.g. three concurrent Air Quality Alerts) so the
  // reason list stays clean instead of repeating the same line.
  return { level, summary, reasons: [...new Set(reasons)], noData: noCall, stale: staleCapped };
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
    // The ranking below throws away road/city cams, so ask Windy for water
    // categories FIRST: in dense coastal metros (LA / Orange County / San Diego)
    // the 20 nearest cams are all city/traffic cams and the post-filter left 0
    // ("ok:0/20"). If the category filter is rejected or empty, fall back to the
    // plain nearby list (wider limit, still filtered below).
    const base = `https://api.windy.com/webcams/api/v3/webcams?nearby=${round(lat, 3)},${round(lon, 3)},60&include=categories,location,player,urls`;
    const hdrs = { "X-WINDY-API-KEY": key, Accept: "application/json" };
    const grab = async (u) => {
      const r = await fetch(u, { headers: hdrs, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.webcams || d?.result?.webcams || [];
    };
    let list = null;
    try { list = await grab(`${base}&categories=beach,coast,harbor,lake,port&limit=50`); } catch { list = null; }
    if (!list || !list.length) list = await grab(`${base}&limit=50`);
    if (list == null) return null;
    // Boaters need to see the water. Windy's "nearest" list is mostly traffic
    // and city cams (St. Augustine's top hit was an I-95 cam), so a cam is only
    // used when its categories or title say water AND nothing says road.
    const WATER = /beach|harbou?r|\bbay\b|coast|lake|river|marina|\bpier\b|\bport\b|water|island|\bsea\b|ocean|inlet|surf|sound|channel|lagoon|dock|boat|yacht|lighthouse|waterfront|shore|jetty|intracoastal/i;
    const ROAD = /traffic|highway|\bhwy\b|interstate|\bI-?\s?\d{1,3}\b|\b(?:US|SR|FL|CR)[-\s]?\d{1,3}\b|freeway|expressway|turnpike|parkway|\bpkwy\b|\bexit\b|intersection|\broad\b|\brd\b|\bstreet\b|\bave(?:nue)?\b|\bblvd\b|\bdot\b|\bfdot\b|toll|\bmile marker\b/i;
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
      if (!watery || ROAD.test(catStr) || ROAD.test(title)) continue;
      scored.push({
        live: !!live,
        cam: {
          name: `${label} (${live ? "Windy" : "Windy · replay"})`, lat: loc.latitude ?? lat, lon: loc.longitude ?? lon, lake,
          embed, link: w.urls?.detail || w.urls?.provider || `https://www.windy.com/webcams/${id}`, source: "windy",
        },
      });
    }
    // Water views only (filtered above); live before replay; ties keep
    // Windy's nearest-first order. Cut to 5 after ranking. An empty list is
    // fine — the panel shows the directory links instead of a wrong view.
    scored.sort((a, b) => b.live - a.live);
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
const TILE_ALERT_LOOKAHEAD_H = 6; // ~a half-day trip
function summaryTile(id, s, g, nowH, za = null) {
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
  let level = riskLevel(windKt, gustKt, precipPct, thunder ? "thunderstorms" : "", waveFt, periodSec, waterProfile(s));
  // An overdue NWS grid can't carry a GO: no call ("—") instead.
  if (level === "GO" && gridStale(g)) level = null;
  // An advisory in effect for the spot's zones now or next hour raises the
  // tile to its level (bar/inlet rule included); one starting within the
  // next few hours (a trip launched now is still out when it begins) leaves
  // it at least CAUTION. If the zone alerts couldn't be checked, no GO.
  if (za) {
    const zoneAlerts = zoneAlertsFor(za, s);
    level = worseLevel(level, alertLevelBetween(zoneAlerts, nowH * 3600e3, (nowH + 2) * 3600e3, s));
    if (level === "GO" && alertLevelBetween(zoneAlerts, nowH * 3600e3, (nowH + TILE_ALERT_LOOKAHEAD_H) * 3600e3, s)) level = "CAUTION";
    if (!zoneAlertsOkFor(za, s) && level === "GO") level = "CAUTION";
  }
  // lat/lon travel with each spot so the homepage can find the nearest launch
  // from a ZIP or the browser's location without a second request.
  return { id, name: s.name, lake: s.lake || "Lake Erie", lat: s.lat, lon: s.lon, level, windKt, gustKt, dir, waveFt, periodSec: plausiblePeriod(waveFt, periodSec) }; // level above used the raw period
}

// Lightweight GO/CAUTION/NO-GO + wind/wave for every spot, for the homepage
// directory. Per-spot NWS grid fetches through a small pool; /points lookups
// are edge-cached a day and the whole result ~10 min, so the API isn't hammered.
// Floor each spot's grid waves at its zone's official NWS text forecast (one
// NSH/CWF fetch per office, not per spot) — the same correction the spot page
// applies, so a directory tile can't say 1 ft while the spot page says 6.
async function floorWithMarineText(entries, grids) {
  const offices = [...new Set(entries.map(([, s]) => `${s.office || "CLE"}|${s.product || "NSH"}`))];
  const texts = Object.fromEntries(await pooled(offices, 6, async (k) => {
    const [office, product] = k.split("|");
    const t = await fetchMarineText(office, product).catch(() => null);
    return [k, t && t.text];
  }));
  entries.forEach(([, s], i) => {
    const text = texts[`${s.office || "CLE"}|${s.product || "NSH"}`];
    if (grids[i] && text && s.zone) applyMarineWaveFloor(grids[i], nshPeriodsForZone(text, s.zone));
  });
}

export async function fetchSummary(env, { landBudget } = {}) {
  // Curated spots + admin-featured user-built pages (both render in the directory).
  const built = await listFeaturedBuiltSpots(env);
  const entries = [...Object.entries(SPOTS), ...built.map((b) => [b.slug, { name: b.name, lat: b.lat, lon: b.lon, zone: b.zone, office: b.office, product: b.product, lake: b.lake, buoys: b.buoys || [], water: b.water || waterFromZone(b.zone, b.zoneName), sea: b.sea ?? null }])];
  const [grids, za] = await Promise.all([
    pooled(entries, 8, ([, s]) => fetchSpotGrid(s)),
    fetchSpotsAlerts(entries.map(([, s]) => s), landBudget),
  ]);
  await floorWithMarineText(entries, grids);
  const nowH = Math.floor(Date.now() / 3600000);
  const spots = entries.map(([id, s], i) => summaryTile(id, s, grids[i], nowH, za));
  return { spots, updatedAt: new Date().toISOString() };
}

// Summary tiles for specific user-built pages by slug — so the daily digest /
// alert emails can cover a member's built page even before it's featured.
export async function fetchBuiltSummaries(env, slugs, { landBudget } = {}) {
  const resolved = [];
  for (const slug of [...new Set(slugs)]) { const b = await getBuiltSpot(env, slug); if (b) resolved.push([slug, b]); }
  if (!resolved.length) return [];
  const [grids, za] = await Promise.all([
    pooled(resolved, 8, ([, s]) => fetchSpotGrid(s)),
    fetchSpotsAlerts(resolved.map(([, s]) => s), landBudget),
  ]);
  await floorWithMarineText(resolved, grids).catch(() => {}); // same nearshore wave floor as the directory
  const nowH = Math.floor(Date.now() / 3600000);
  return resolved.map(([id, s], i) => summaryTile(id, s, grids[i], nowH, za));
}

// 7-day outlook (same per-day verdicts as the spot page's week strip) for
// specific ports, curated or user-built: { id: [{date, level, windKt, ...}] }.
// Powers the Pro weekend-outlook email; only the requested ports are fetched.
export async function fetchWeeks(env, ids, { landBudget } = {}) {
  const entries = [];
  for (const id of [...new Set(ids)]) {
    if (SPOTS[id]) entries.push([id, SPOTS[id]]);
    else { const b = await getBuiltSpot(env, id).catch(() => null); if (b) entries.push([id, b]); }
  }
  if (!entries.length) return {};
  const [grids, za] = await Promise.all([
    pooled(entries, 8, ([, s]) => fetchSpotGrid(s)),
    fetchSpotsAlerts(entries.map(([, s]) => s), landBudget),
  ]);
  await floorWithMarineText(entries, grids).catch(() => {});
  // Same per-day verdicts as the week strip (buildWeek → riskLevel: no wind
  // data is "—", lake gusts count), raised by the zone's active alerts.
  return Object.fromEntries(entries.map(([id, s], i) => [id, applyAlertsToWeek(buildWeek(grids[i], waterProfile(s)), zoneAlertsFor(za, s), zoneAlertsOkFor(za, s), grids[i]?.tz, Date.now(), s)]));
}

// The full spot-page verdict (alerts, gusts, buoy, nearshore text) for one
// port, as the page computes it. The GO alert email re-checks with this before
// sending, so an email never says GO when the page wouldn't. null on failure.
export async function fetchSpotVerdict(env, id) {
  const r = await onRequest({ request: new Request(`https://shouldiboat.com/marine/conditions?spot=${encodeURIComponent(id)}`), env }).catch(() => null);
  if (!r || !r.ok) return null;
  const d = await r.json().catch(() => null);
  if (!d || !d.recommendation) return null;
  const level = d.recommendation.level || null;
  // An email may only say GO when nothing is missing: the alerts feed answered
  // (a failed lookup isn't "no advisories"), and the current hour of the
  // timeline (grid gusts, thunder, rain chance) agrees with the headline.
  if (level === "GO" && (!d.alertsOk || d.outlook?.nowLevel !== "GO")) return "CAUTION";
  return level;
}

// Today's best GO window for every port (for the daily digest email): per-spot
// NWS grid hourlies, then the longest contiguous GO run between 6am and 8pm in
// the spot's local time. Returns { spotId: {from, to, hours} | null }.
const fmtH12 = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
export async function fetchTodayWindows({ landBudget } = {}) {
  const entries = Object.entries(SPOTS);
  const [grids, za] = await Promise.all([
    pooled(entries, 8, ([, s]) => fetchSpotGrid(s)),
    fetchSpotsAlerts(entries.map(([, s]) => s), landBudget),
  ]);
  // Same nearshore wave floor as tiles and weeks: a window is never offered
  // on a grid cell calmer than the official NSH/CWF text for the zone.
  await floorWithMarineText(entries, grids).catch(() => {});
  const nowH = Math.floor(Date.now() / 3600000);
  const out = {};
  entries.forEach(([id, s], i) => {
    const g = grids[i];
    // No grid, an overdue grid, or the zone alerts couldn't be checked: offer no GO window.
    if (!g || gridStale(g) || !zoneAlertsOkFor(za, s)) { out[id] = null; return; }
    const spotAlerts = zoneAlertsFor(za, s);
    const toLocal = localParts(g.tz);
    const today = toLocal(nowH).date;
    let best = null, run = null;
    for (let h = nowH - 23; h <= nowH + 30; h++) {
      const loc = toLocal(h);
      if (loc.date !== today || loc.hour < 6 || loc.hour > 20) { run = null; continue; }
      const windKt = round(g.windKt.get(h), 0);
      const waveFt = round(g.waveFt.get(h), 1);
      const lvl = riskLevel(windKt, round(g.gustKt.get(h), 0), g.precipPct.get(h) ?? 0, g.thunder.get(h) ? "thunderstorms" : "", waveFt, round(g.periodSec.get(h), 0), waterProfile(s));
      const ok = worseLevel(lvl, alertLevelBetween(spotAlerts, h * 3600e3, (h + 1) * 3600e3, s)) === "GO";
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
  const [{ buoy, tempsObs, windBuoy, waveBuoy }, fc, marine, alertRes, noaaReport, grid, waterStation] = await Promise.all([
    fetchBuoy(spot.buoys),
    fetchForecastsNear(spot),
    fetchMarineForecast(spot.zone),
    fetchAlerts(spot),
    fetchMarineText(spot.office || "CLE", spot.product || "NSH"), // NSH on the lakes, CWF on the coasts
    fetchSpotGrid(spot),
    spot.waterBuoys && spot.waterBuoys.length ? fetchWaterTemp(spot.waterBuoys) : null,
  ]);
  const { alerts, all: allAlerts, ok: alertsOk } = alertRes;
  const point = fc.daily;
  // The nearshore periods, from the marine-zone API or (fallback) the NSH text.
  const marinePeriods = (marine && marine.length) ? marine : nshPeriodsForZone(noaaReport?.text, spot.zone);
  // Floor the grid's hourly waves at the authoritative nearshore forecast BEFORE
  // deriving the week and the hourly strip, so every wave number on the page
  // comes from one (nearshore-corrected) series and they can't disagree.
  applyMarineWaveFloor(grid, marinePeriods);
  const profile = waterProfile(spot);
  // Alerts in effect raise the strips too, not just the headline, so the week
  // and hourly views never show GO under an active advisory.
  const week = applyAlertsToWeek(buildWeek(grid, profile), allAlerts, alertsOk, grid?.tz, Date.now(), spot);
  const sun = sunTimes(spot.lat, spot.lon);
  // Merge hourly wave height (NWS grid) into the NWS hourly rows, then rate
  // risk. Keyed by epoch hour, so spots outside Eastern time line up too.
  // Drop hours that have already passed (the NWS hourly product can lead with
  // them), so the strip's first row, the outlook, and the headline's
  // imminent-hazard check all start at the current hour.
  const nowEH = Math.floor(Date.now() / 3600000);
  const hourly = applyAlertsToHours(withRisk(
    fc.hourly.filter((h) => Math.floor(Date.parse(h.time) / 3600000) >= nowEH).map((h) => {
      const eh = Math.floor(Date.parse(h.time) / 3600000);
      return {
        ...h,
        waveFt: round(grid?.waveFt.get(eh), 1),
        periodSec: round(grid?.periodSec.get(eh), 0),
        gustKt: round(grid?.gustKt.get(eh), 0), // NWS hourly forecast has no gusts; the grid does
      };
    }),
    profile
  ), allAlerts, alertsOk, Date.now(), spot);
  const outlook = computeOutlook(hourly);

  // Effective wind: prefer the live buoy, fall back to the NWS forecast so wind
  // is present even when no buoy (and no wave data) is available.
  // The daily period that covers NOW. Not blindly point[0]: a stale/cached
  // NWS forecast can lead with a period that has already ended, and its wind
  // must not stand in for the current wind. No current period → fall through
  // to the hourly forecast's current hour (time-filtered) or to "no data".
  const nowMs = Date.now();
  const curPeriod = (point || []).find((p) => { const e = Date.parse(p.endTime); return !Number.isFinite(e) || e > nowMs; }) || null;
  const forecastWind = parseForecastWind(curPeriod);
  // "Now or imminent" rows of the hourly strip (this hour or the next, like the
  // directory tiles), picked by timestamp: the hourly product can lead with
  // hours that have already passed.
  const nowRows = hourly.filter((h) => { const eh = Math.floor(Date.parse(h.time) / 3600000); return eh === nowEH || eh === nowEH + 1; });
  const nowGusts = nowRows.map((h) => h.gustKt).filter((v) => v != null);
  const gridNowGust = nowGusts.length ? Math.max(...nowGusts) : null;
  // Last-resort sustained wind: the hourly forecast's current hour, when the
  // daily period is unavailable (it's a separate NWS fetch that fails alone).
  const hourlyNowWind = nowRows.find((h) => h.windKt != null)?.windKt ?? null;
  // Wind from the primary buoy, else the station that filled in wind; waves
  // likewise (fetchBuoy merges a wind-only and a wave-only station).
  const wb = hasWind(buoy) ? buoy : windBuoy;
  const vb = hasWaves(buoy) ? buoy : waveBuoy;
  const wind = {
    speedKt: wb?.windKt ?? forecastWind?.speedKt ?? hourlyNowWind,
    // Buoy gust when it reports one, else the grid's current gust (the
    // hourly strip already rates on it), so a no-buoy lake port's headline
    // can't read GO under gusts the timeline calls CAUTION.
    gustKt: wb?.windGustKt ?? gridNowGust,
    gustSrc: wb?.windGustKt != null ? "buoy" : gridNowGust != null ? "forecast" : null,
    dir: wb?.windDir ?? forecastWind?.dir ?? null,
    station: wb?.windKt != null || wb?.windGustKt != null ? wb.station : null,
    source: wb?.windKt != null ? "buoy" : (forecastWind?.speedKt ?? hourlyNowWind) != null ? "forecast" : null,
    // What the sustained figure IS, for labels: "buoy" (measured now), "period"
    // (upper end of the NWS forecast range for `periodName`), "hour" (the NWS
    // hourly forecast for this hour), null (none).
    basis: wb?.windKt != null ? "buoy" : forecastWind?.speedKt != null ? "period" : hourlyNowWind != null ? "hour" : null,
    periodName: wb?.windKt == null && forecastWind?.speedKt != null ? (curPeriod?.name || null) : null,
  };

  // Effective waves reflect RIGHT NOW and agree with the hour-by-hour strip,
  // because the strip's current hour is already floored at the nearshore
  // forecast (applyMarineWaveFloor above). Order: live buoy, then that
  // nearshore-corrected current hour, then the zone text where the grid has no
  // cell at all (some coastal/estuary spots).
  // The current hour by timestamp (the hourly product can lead with past hours).
  const nowRow = nowRows[0] ?? null;
  const gridNowFt = nowRow?.waveFt ?? null;
  const gridNowPeriod = nowRow?.periodSec ?? null;
  const textWaveFt = parseForecastWaves(marinePeriods) ?? null;
  const currentWaveFt = gridNowFt ?? textWaveFt;
  const nowFt = vb?.waveHeightFt ?? currentWaveFt ?? null;
  const waves = {
    ft: nowFt,
    periodSec: vb?.dominantPeriodSec ?? gridNowPeriod ?? null,
    source: vb?.waveHeightFt != null ? "buoy" : currentWaveFt != null ? "forecast" : null,
    station: vb?.waveHeightFt != null ? vb.station : null,
  };

  // Water temp: live buoy, else the NSH text (which lists a few ports). Air
  // temp: live buoy, else the current hour of the NWS point forecast. So the
  // Water/Air tiles aren't blank at the many spots with no reporting buoy.
  // A temps-only station on spot.buoys (no wind/wave sensors) still feeds the
  // tiles, labelled by station since it isn't the page's live buoy. It is
  // listed ahead of the met buoy (usually closer inshore, where autumn water
  // runs colder), so its reading wins, as it did before this split.
  const tempsStation = tempsObs && tempsObs !== buoy ? tempsObs : null;
  const waterTempF = tempsStation?.waterTempF ?? buoy?.waterTempF ?? waterStation?.f ?? nshWaterTempF(noaaReport?.text, spot);
  const airTempF = tempsStation?.airTempF ?? buoy?.airTempF ?? nowRow?.tempF ?? null;
  const temps = {
    waterF: round(waterTempF, 0), // display; the verdict gets the unrounded value below
    waterSource: tempsStation?.waterTempF != null ? `NDBC ${tempsStation.station}` : buoy?.waterTempF != null ? "buoy" : waterStation?.f != null ? `NDBC ${waterStation.station}` : waterTempF != null ? "NWS" : null,
    airF: round(airTempF, 0),
    airSource: tempsStation?.airTempF != null ? `NDBC ${tempsStation.station}` : buoy?.airTempF != null ? "buoy" : airTempF != null ? "NWS" : null,
  };

  // Freshness: the observation time of every station that actually supplied
  // wind/gust/waves (the wind can come from windBuoy, a different station than
  // the primary), and the OLDEST known forecaster update across the NWS
  // products feeding the call (hourly, daily, grid): conservative when they
  // disagree. freshness.buoy is the oldest feeding station, so the stale cap
  // and the page's freshness line name the reading that is actually that old.
  const obsAge = (o) => (Number.isFinite(Date.parse(o.observedAt)) ? ageMinOf(o.observedAt, nowMs) : o.ageMinutes ?? null);
  const fedBy = new Map();
  if (wb && (wind.source === "buoy" || wind.gustSrc === "buoy")) fedBy.set(wb, ["wind"]);
  if (vb && waves.source === "buoy") fedBy.set(vb, [...(fedBy.get(vb) || []), "waves"]);
  const buoyStations = [...fedBy].map(([o, feeds]) => ({ station: o.station, feeds, observedAt: o.observedAt || null, ageMinutes: obsAge(o) }));
  // Oldest first; an unknown age doesn't outrank a known one.
  const oldestBuoy = [...buoyStations].sort((x, y) => (y.ageMinutes ?? -1) - (x.ageMinutes ?? -1))[0] || null;
  const issued = [fc.issuedAt?.hourly, fc.issuedAt?.daily, grid?.updateTime].filter(Boolean).sort();
  const forecastIssuedAt = issued[0] || null;
  const forecastAgeMin = forecastIssuedAt ? ageMinOf(forecastIssuedAt, nowMs) : null;
  const buoyAgeMin = oldestBuoy ? oldestBuoy.ageMinutes : null;
  const freshness = {
    buoy: oldestBuoy ? { station: oldestBuoy.station, observedAt: oldestBuoy.observedAt, ageMinutes: oldestBuoy.ageMinutes } : null,
    buoys: buoyStations, // every station feeding the call, with what it fed
    forecastIssuedAt,
    forecastAgeMinutes: forecastAgeMin,
    stale: [
      ...(buoyAgeMin != null && buoyAgeMin >= STALE_LIMITS.buoyMin ? [{ kind: "buoy", ageMinutes: buoyAgeMin }] : []),
      ...(forecastAgeMin != null && forecastAgeMin >= STALE_LIMITS.forecastMin ? [{ kind: "forecast", ageMinutes: forecastAgeMin }] : []),
    ],
    limits: STALE_LIMITS,
  };

  const read = windReadFor(spot, wind.dir);
  const recommendation = buildRecommendation({ buoy, alerts, wind, waves, read, hours: hourly, profile, waterF: waterTempF ?? null, spot, forecastAgeMin, alertsOk, buoyAgeMin });

  // Display-only cleanup, AFTER every verdict above is computed from raw data.
  const showPeriod = (ft, sec) => plausiblePeriod(ft, sec);
  return json({
    spot: { id: spotId, name: spot.name, zone: spot.zone, lat: spot.lat, lon: spot.lon, lake: spot.lake || "Lake Erie", adHoc: !!spot.adHoc, zoneName: spot.zoneName || null, built: !!spot.built, slug: spot.slug || null, featured: !!spot.featured },
    updatedAt: new Date().toISOString(),
    freshness,
    recommendation,
    wind,
    waves: { ...waves, periodSec: showPeriod(waves.ft, waves.periodSec) },
    temps,
    windRead: read,
    facts: spotFacts(spot, { buoy, wind, waves }),
    hourly: hourly.map((h) => ({ ...h, periodSec: showPeriod(h.waveFt, h.periodSec) })),
    outlook,
    week: week.map((d) => ({ ...d, periodSec: showPeriod(d.waveFt, d.periodSec) })),
    sun,
    buoy,
    alerts: (alerts || []).map(({ polygons, motion, ...a }) => a), // geometry is for matching, not the page
    alertsOk, // false = an NWS alerts lookup failed (not "no alerts")
    marineForecast: marinePeriods,
    pointForecast: point || [],
    noaaReport,
    sources: {
      buoy: buoy ? `NDBC ${[buoy.station, windBuoy?.station, waveBuoy?.station].filter(Boolean).join(" + ")}` : "no live buoy",
      forecast: "NWS api.weather.gov",
      marineZone: spot.zone,
    },
  });
}
