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

// Every water body in display order (was the hard-coded list in Landing).
export const LAKE_ORDER = REGIONS.flatMap((r) => r.lakes);

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
  { slug: "cleveland", name: "Cleveland, OH", lat: 41.4993, lon: -81.6944 },
  { slug: "akron", name: "Akron, OH", lat: 41.0814, lon: -81.519 },
  { slug: "columbus", name: "Columbus, OH", lat: 39.9612, lon: -82.9988 },
  { slug: "toledo", name: "Toledo, OH", lat: 41.6528, lon: -83.5379 },
  { slug: "buffalo", name: "Buffalo, NY", lat: 42.8864, lon: -78.8784 },
  { slug: "rochester-ny", name: "Rochester, NY", lat: 43.1566, lon: -77.6088 },
  { slug: "detroit", name: "Detroit, MI", lat: 42.3314, lon: -83.0458 },
  { slug: "grand-rapids", name: "Grand Rapids, MI", lat: 42.9634, lon: -85.6681 },
  { slug: "chicago", name: "Chicago, IL", lat: 41.8781, lon: -87.6298 },
  { slug: "milwaukee", name: "Milwaukee, WI", lat: 43.0389, lon: -87.9065 },
  { slug: "pittsburgh", name: "Pittsburgh, PA", lat: 40.4406, lon: -79.9959 },
  { slug: "baltimore", name: "Baltimore, MD", lat: 39.2904, lon: -76.6122 },
];

export const nearMetroBySlug = (slug) =>
  NEAR_METROS.find((m) => m.slug === String(slug || "").toLowerCase()) || null;

// A "/near/<slug>" path → its metro object, or null.
export const nearMetroFromPath = (pathname) => {
  const m = String(pathname || "").match(/^\/near\/([a-z0-9-]{2,40})\/?$/i);
  return m ? nearMetroBySlug(m[1]) : null;
};
