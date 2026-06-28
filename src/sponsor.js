// Homepage sponsor "takeover" — a full-page background skin + a hero panel,
// modeled on FlightAware's sponsored homepage. Two fill sources, in order:
//   1. A direct-sold campaign in TAKEOVERS whose date window includes today.
//   2. Google Ad Manager (programmatic) — inert until GAM.networkCode is set.
// If neither fills, the house hero shows (no skin). Ad-free users never see the
// programmatic (GAM) takeover; direct-sold brand campaigns show to everyone
// unless the campaign sets hideForAdFree.

// ── 1. Direct-sold campaigns ──────────────────────────────────────────────────
// Launch one by adding an entry. Dates are inclusive and use the viewer's local
// day. The first campaign matching today wins. Drop image assets in
// /public/sponsors/ and reference them as "/sponsors/<file>".
export const TAKEOVERS = [
  // {
  //   id: "southwest-2026-06-29",
  //   sponsor: "Southwest Airlines",
  //   start: "2026-06-29",
  //   end: "2026-06-30",
  //   eyebrow: "Today's forecast brought to you by",
  //   headline: "Fly Southwest to your next lake weekend",
  //   sub: "Low fares to Cleveland, Detroit & Buffalo — and bags fly free.",
  //   cta: "Book a flight",
  //   href: "https://www.southwest.com/",
  //   logo: "/sponsors/southwest.png",   // optional
  //   bg: "#304CB2",                      // skin + hero background color
  //   bgImage: "",                        // optional hero photo (overlays bg)
  //   fg: "#ffffff",                      // hero text color
  //   accent: "#f9b612",                  // CTA button background
  //   accentFg: "#11151c",                // CTA button text
  //   hideForAdFree: false,
  // },
];

// ── 2. Google Ad Manager (programmatic) ───────────────────────────────────────
export const GAM = {
  networkCode: "",            // your GAM network code, e.g. "23001234567"
  heroUnit: "sib_takeover_hero",
  skinUnit: "sib_takeover_skin",
  heroSizes: [[970, 250], [728, 90], [336, 280], [320, 100]],
};
export const GAM_ENABLED = /^\d{5,}$/.test(GAM.networkCode);
export const gamPath = (unit) => `/${GAM.networkCode}/${unit}`;

// ── Resolver ──────────────────────────────────────────────────────────────────
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function activeTakeover(now = new Date()) {
  const t = isoDay(now);
  return TAKEOVERS.find((c) => c && c.start <= t && t <= (c.end || c.start)) || null;
}
