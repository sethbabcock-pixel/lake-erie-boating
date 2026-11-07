// Shared region model: the top-level grouping above individual water bodies.
//
// Used by the homepage directory, the region subpages (e.g. /greatlakes), and
// the server-side SEO in functions/seo.js. The order here drives display order
// everywhere, and `lakes` ties each region to the `lake` field on a spot in
// functions/marine/conditions.js. Add a region here (plus its water bodies to
// WATER_CENTERS and some spots) and it gets a directory group and its own page.
export const REGIONS = [
  {
    slug: "greatlakes",
    title: "Great Lakes",
    blurb: "GO / CAUTION / NO-GO calls for launches across all five Great Lakes, from Toledo to Duluth.",
    lakes: ["Lake Erie", "Lake Ontario", "Lake Huron", "Lake Michigan", "Lake Superior"],
  },
  {
    slug: "florida",
    title: "Florida",
    warm: true,
    blurb: "GO / CAUTION / NO-GO calls for Florida's Atlantic inlets, Biscayne Bay, the Keys and the Gulf coast, rated for ocean swell, not just height.",
    lakes: ["Florida Atlantic Coast", "Florida Keys", "Florida Gulf Coast"],
  },
  {
    slug: "gulf-coast",
    title: "Gulf Coast",
    warm: true,
    blurb: "GO / CAUTION / NO-GO calls from Orange Beach and Mobile Bay to Galveston and South Padre Island.",
    lakes: ["Alabama & Mississippi Coast", "Louisiana & Texas Coast"],
  },
  {
    slug: "southeast",
    title: "Georgia & the Carolinas",
    warm: true,
    blurb: "GO / CAUTION / NO-GO calls for the Georgia and Carolina coast, from St. Simons Island to the Outer Banks.",
    lakes: ["Georgia & South Carolina Coast", "North Carolina Coast"],
  },
  {
    slug: "socal",
    title: "Southern California",
    warm: true,
    blurb: "GO / CAUTION / NO-GO calls for Southern California harbors, from San Diego to Santa Barbara.",
    lakes: ["Southern California Coast"],
  },
  {
    slug: "islands",
    title: "Hawaii & Puerto Rico",
    warm: true,
    blurb: "GO / CAUTION / NO-GO calls for harbors on Oahu, Maui and the Big Island, and around Puerto Rico.",
    lakes: ["Hawaii", "Puerto Rico"],
  },
  {
    slug: "pnw",
    title: "Pacific Northwest",
    blurb: "GO / CAUTION / NO-GO calls for Puget Sound, the San Juan Islands, Admiralty Inlet and the Washington coast, from Olympia to Friday Harbor and Westport.",
    lakes: ["Puget Sound", "San Juan Islands & Admiralty Inlet", "Washington Coast"],
  },
  {
    slug: "oregon",
    title: "Oregon Coast",
    blurb: "GO / CAUTION / NO-GO calls for Oregon's bar harbors, from the Columbia River Bar to Brookings, with bar advisories built into every call.",
    lakes: ["Oregon Coast"],
  },
  {
    slug: "norcal",
    title: "Northern California",
    blurb: "GO / CAUTION / NO-GO calls for San Francisco Bay and the Northern California coast, from Monterey and Santa Cruz to Bodega Bay and Humboldt Bay.",
    lakes: ["San Francisco Bay", "Northern California Coast"],
  },
  {
    slug: "northeast",
    title: "Northeast",
    blurb: "GO / CAUTION / NO-GO calls from Casco Bay and Boston Harbor to Cape Cod, Narragansett Bay, Long Island Sound, New York Harbor and the Jersey shore.",
    lakes: ["New England Coast", "Long Island Sound", "New York & New Jersey Coast"],
  },
  {
    slug: "alaska",
    title: "Alaska",
    blurb: "GO / CAUTION / NO-GO calls for Southeast and Southcentral Alaska harbors, from Ketchikan, Juneau and Sitka to Seward, Homer, Whittier and Valdez.",
    lakes: ["Southeast Alaska", "Southcentral Alaska"],
  },
  {
    slug: "chesapeake",
    title: "Chesapeake Bay",
    blurb: "GO / CAUTION / NO-GO calls for the Chesapeake Bay and its tidal rivers.",
    lakes: ["Chesapeake Bay"],
  },
  {
    slug: "carolina",
    title: "Carolina Sounds",
    blurb: "GO / CAUTION / NO-GO calls for the sounds and tidal rivers of coastal North Carolina.",
    lakes: ["Pamlico Sound"],
  },
];

// Off-season for the northern waters (mid-October to mid-April): warm-water
// regions lead the directory and region chips; in season the Great Lakes do.
export const isNorthernOffSeason = (d = new Date()) => {
  const m = d.getMonth(), day = d.getDate();
  return (m > 9 || (m === 9 && day >= 15)) || (m < 3 || (m === 3 && day < 15));
};
export const seasonalRegions = (d = new Date()) =>
  isNorthernOffSeason(d) ? [...REGIONS.filter((r) => r.warm), ...REGIONS.filter((r) => !r.warm)] : REGIONS;

// In-depth guide for a water body, linked from its launches (spot page card +
// server-rendered page).
const GULF_GUIDE = { href: "/guides/boating-the-gulf-coast", text: "Boating the Gulf Coast guide" };
const SOUTHEAST_GUIDE = { href: "/guides/boating-georgia-and-the-carolinas", text: "Boating Georgia & the Carolinas guide" };
export const LAKE_GUIDES = {
  "Lake Erie": { href: "/guides/boating-lake-erie", text: "Boating Lake Erie guide" },
  "Lake Michigan": { href: "/guides/boating-lake-michigan", text: "Boating Lake Michigan guide" },
  "Lake Superior": { href: "/guides/boating-lake-superior", text: "Boating Lake Superior guide" },
  "Chesapeake Bay": { href: "/guides/boating-the-chesapeake-bay", text: "Boating the Chesapeake Bay guide" },
  "Lake Huron": { href: "/guides/boating-lake-huron", text: "Boating Lake Huron guide" },
  "Lake Ontario": { href: "/guides/boating-lake-ontario", text: "Boating Lake Ontario guide" },
  "Hawaii": { href: "/guides/boating-hawaii", text: "Boating Hawaii guide" },
  "Puerto Rico": { href: "/guides/boating-puerto-rico", text: "Boating Puerto Rico guide" },
  "Florida Atlantic Coast": { href: "/guides/boating-florida-atlantic-inlets", text: "Florida Atlantic coast & inlets guide" },
  "Florida Gulf Coast": GULF_GUIDE,
  "Alabama & Mississippi Coast": GULF_GUIDE,
  "Louisiana & Texas Coast": GULF_GUIDE,
  "Georgia & South Carolina Coast": SOUTHEAST_GUIDE,
  "North Carolina Coast": SOUTHEAST_GUIDE,
  "Pamlico Sound": SOUTHEAST_GUIDE,
  "Florida Keys": { href: "/guides/boating-the-florida-keys", text: "Boating the Florida Keys guide" },
  "Southern California Coast": { href: "/guides/boating-southern-california", text: "Boating Southern California guide" },
};

// Every water body in display order (was the hard-coded list in Landing).
// The in-depth guides that cover a region's waters (deduped), for the region
// pages' "Read before you go" links — server-rendered and in the app alike.
const GENERAL_GUIDE = { href: "/guides/reading-a-marine-forecast", text: "How to read a marine forecast" };
export const regionGuides = (region) => {
  const seen = new Set(), out = [];
  for (const g of [...(region.lakes || []).map((l) => LAKE_GUIDES[l]), region.warm ? { href: "/guides/boating-the-coast", text: "Boating the coast guide" } : { href: "/guides/cold-water-safety", text: "Cold-water safety guide" }, GENERAL_GUIDE]) {
    if (g && !seen.has(g.href)) { seen.add(g.href); out.push(g); }
  }
  return out;
};

export const LAKE_ORDER = REGIONS.flatMap((r) => r.lakes);
export const seasonalLakeOrder = (d = new Date()) => seasonalRegions(d).flatMap((r) => r.lakes);

export const regionBySlug = (slug) =>
  REGIONS.find((r) => r.slug === String(slug || "").toLowerCase()) || null;

export const regionForLake = (lake) =>
  REGIONS.find((r) => (r.lakes || []).includes(lake)) || null;

// A bare-path region slug ("/greatlakes" → "greatlakes"), or null. Guarded by
// the known-slug list so only curated region words are treated as region pages;
// anything else falls through to normal SPA / landing behavior.
export const regionFromPath = (pathname) => {
  const seg = String(pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase();
  return seg && !seg.includes("/") ? regionBySlug(seg) : null;
};

// "Near a city" landing pages: /near/<slug>. These serve people who search
// where they *live* (an inland metro) rather than a lakeside town — the page
// ranks the nearest covered launches by distance. Each is a curated, crawlable
// URL (finite set, so it stays indexable). Coords are the metro centroid; keep
// to cities within a reasonable drive of covered water so the page has value.
export const NEAR_METROS = [
  // Great Lakes
  { slug: "cleveland", name: "Cleveland, OH", lat: 41.4993, lon: -81.6944, region: "greatlakes" },
  { slug: "akron", name: "Akron, OH", lat: 41.0814, lon: -81.519, region: "greatlakes" },
  { slug: "columbus", name: "Columbus, OH", lat: 39.9612, lon: -82.9988, region: "greatlakes" },
  { slug: "toledo", name: "Toledo, OH", lat: 41.6528, lon: -83.5379, region: "greatlakes" },
  { slug: "buffalo", name: "Buffalo, NY", lat: 42.8864, lon: -78.8784, region: "greatlakes" },
  { slug: "rochester-ny", name: "Rochester, NY", lat: 43.1566, lon: -77.6088, region: "greatlakes" },
  { slug: "detroit", name: "Detroit, MI", lat: 42.3314, lon: -83.0458, region: "greatlakes" },
  { slug: "grand-rapids", name: "Grand Rapids, MI", lat: 42.9634, lon: -85.6681, region: "greatlakes" },
  { slug: "chicago", name: "Chicago, IL", lat: 41.8781, lon: -87.6298, region: "greatlakes" },
  { slug: "milwaukee", name: "Milwaukee, WI", lat: 43.0389, lon: -87.9065, region: "greatlakes" },
  { slug: "pittsburgh", name: "Pittsburgh, PA", lat: 40.4406, lon: -79.9959, region: "greatlakes" },
  // Warm-water coasts: inland or big metros within an easy drive of covered launches
  { slug: "miami", name: "Miami, FL", lat: 25.7617, lon: -80.1918, region: "florida" },
  { slug: "orlando", name: "Orlando, FL", lat: 28.5384, lon: -81.3789, region: "florida" },
  { slug: "tampa", name: "Tampa, FL", lat: 27.9506, lon: -82.4572, region: "florida" },
  { slug: "jacksonville-fl", name: "Jacksonville, FL", lat: 30.3322, lon: -81.6557, region: "florida" },
  { slug: "houston", name: "Houston, TX", lat: 29.7604, lon: -95.3698, region: "gulf-coast" },
  { slug: "new-orleans", name: "New Orleans, LA", lat: 29.9511, lon: -90.0715, region: "gulf-coast" },
  { slug: "mobile", name: "Mobile, AL", lat: 30.6954, lon: -88.0399, region: "gulf-coast" },
  { slug: "corpus-christi", name: "Corpus Christi, TX", lat: 27.8006, lon: -97.3964, region: "gulf-coast" },
  { slug: "savannah", name: "Savannah, GA", lat: 32.0809, lon: -81.0912, region: "southeast" },
  { slug: "los-angeles", name: "Los Angeles, CA", lat: 34.0522, lon: -118.2437, region: "socal" },
  { slug: "san-diego-ca", name: "San Diego, CA", lat: 32.7157, lon: -117.1611, region: "socal" },
  // Mid-Atlantic
  { slug: "baltimore", name: "Baltimore, MD", lat: 39.2904, lon: -76.6122, region: "chesapeake" },
  // Cold-water coasts
  { slug: "seattle", name: "Seattle, WA", lat: 47.6062, lon: -122.3321, region: "pnw" },
  { slug: "portland-or", name: "Portland, OR", lat: 45.5152, lon: -122.6784, region: "oregon" },
  { slug: "san-francisco", name: "San Francisco, CA", lat: 37.7749, lon: -122.4194, region: "norcal" },
  { slug: "sacramento", name: "Sacramento, CA", lat: 38.5816, lon: -121.4944, region: "norcal" },
  { slug: "boston", name: "Boston, MA", lat: 42.3601, lon: -71.0589, region: "northeast" },
  { slug: "providence", name: "Providence, RI", lat: 41.824, lon: -71.4128, region: "northeast" },
  { slug: "hartford", name: "Hartford, CT", lat: 41.7658, lon: -72.6734, region: "northeast" },
  { slug: "new-york", name: "New York, NY", lat: 40.7128, lon: -74.006, region: "northeast" },
  { slug: "philadelphia", name: "Philadelphia, PA", lat: 39.9526, lon: -75.1652, region: "northeast" },
  { slug: "anchorage", name: "Anchorage, AK", lat: 61.2181, lon: -149.9003, region: "alaska" },
  { slug: "juneau-ak", name: "Juneau, AK", lat: 58.3019, lon: -134.4197, region: "alaska" },
];

export const nearMetroBySlug = (slug) =>
  NEAR_METROS.find((m) => m.slug === String(slug || "").toLowerCase()) || null;

// A "/near/<slug>" path → its metro object, or null.
export const nearMetroFromPath = (pathname) => {
  const m = String(pathname || "").match(/^\/near\/([a-z0-9-]{2,40})\/?$/i);
  return m ? nearMetroBySlug(m[1]) : null;
};
