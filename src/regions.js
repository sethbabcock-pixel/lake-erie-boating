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
