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

// Every water body in display order (was the hard-coded list in Landing).
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
];

export const nearMetroBySlug = (slug) =>
  NEAR_METROS.find((m) => m.slug === String(slug || "").toLowerCase()) || null;

// A "/near/<slug>" path → its metro object, or null.
export const nearMetroFromPath = (pathname) => {
  const m = String(pathname || "").match(/^\/near\/([a-z0-9-]{2,40})\/?$/i);
  return m ? nearMetroBySlug(m[1]) : null;
};
