// Sponsor campaign targeting, shared by the page (Takeover) and the admin.
//
// A campaign targets everywhere (no regions, no spots), one or more regions
// (REGIONS slugs, e.g. "florida"), and/or specific launches (spot ids, e.g.
// "fort-lauderdale"). On any page the most specific live match wins:
//   launch match (3) > region match (2) > everywhere (1).
// The all-waters homepage has no region or launch, so only everywhere
// campaigns show there. Ties go to the first campaign in the admin list.
export function campaignScore(c, { spot = null, region = null } = {}) {
  const spots = (c && c.spots) || [];
  const regions = (c && c.regions) || [];
  if (!spots.length && !regions.length) return 1;
  if (spot && spots.includes(spot)) return 3;
  if (region && regions.includes(region)) return 2;
  return 0;
}

export function pickCampaign(list, ctx = {}) {
  let best = null, bestScore = 0;
  for (const c of list || []) {
    const s = campaignScore(c, ctx);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return best;
}

// "Everywhere" | "Florida, Gulf Coast" | "Florida + 2 launches" — for admin rows.
export function targetLabel(c, regions, spotName = (id) => id) {
  const r = (c.regions || []).map((slug) => (regions.find((x) => x.slug === slug) || {}).title || slug);
  const s = c.spots || [];
  if (!r.length && !s.length) return "Everywhere";
  const parts = [];
  if (r.length) parts.push(r.join(", "));
  if (s.length) parts.push(s.length <= 2 ? s.map(spotName).join(", ") : `${s.length} launches`);
  return parts.join(" + ");
}
