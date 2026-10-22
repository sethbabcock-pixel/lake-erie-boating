// AdSense defaults — shared by the browser (monetize.jsx) and the Worker
// (functions/auth.js). These are the fallback values; the admin console can
// override every one of them at runtime (stored in KV site:config.ads), so
// turning a placement on/off or swapping a slot ID never needs a code change.
export const ADSENSE_DEFAULTS = {
  enabled: true,
  off: [], // placement keys paused in /admin (slot ID kept, nothing renders)
  client: "ca-pub-9213366013949616",
  slots: {
    detailTop: "9841170882",  // spot page, under the verdict + conditions row
    detailMid: "8915670243",  // spot page, after the gear block
    landingTop: "1882789819", // homepage, after the directory
    landing: "3032908319",    // homepage, after the guides
    footerSticky: "",         // dismissible sticky footer (site-wide); empty = off
  },
};

// Every placement the site knows about, in page order — drives the admin UI.
export const AD_PLACEMENTS = [
  { key: "detailTop", label: "Spot page · top", where: "Under the verdict and current conditions on every /spot page. Highest traffic." },
  { key: "detailMid", label: "Spot page · lower", where: "After the gear block, lower on the spot page." },
  { key: "landingTop", label: "Homepage · after directory", where: "Below the lake directory on the homepage." },
  { key: "landing", label: "Homepage · after guides", where: "Below the boating-guides section on the homepage." },
  { key: "footerSticky", label: "Sticky footer", where: "Dismissible anchor bar at the bottom of every page. Off unless a slot ID is set." },
];

export const isPubId = (s) => /^ca-pub-\d{10,20}$/.test(s || "");
export const isSlotId = (s) => /^\d{8,12}$/.test(s || "");

// Clamp untrusted input (admin PUT, or a stale KV record) to a valid ads config.
export function sanitizeAds(input) {
  const a = input && typeof input === "object" ? input : {};
  const slotsIn = a.slots && typeof a.slots === "object" ? a.slots : {};
  const slots = {};
  for (const p of AD_PLACEMENTS) {
    const v = typeof slotsIn[p.key] === "string" ? slotsIn[p.key].trim() : ADSENSE_DEFAULTS.slots[p.key];
    slots[p.key] = isSlotId(v) ? v : "";
  }
  const client = typeof a.client === "string" && isPubId(a.client.trim()) ? a.client.trim() : ADSENSE_DEFAULTS.client;
  const off = (Array.isArray(a.off) ? a.off : []).filter((k) => AD_PLACEMENTS.some((p) => p.key === k));
  return { enabled: a.enabled !== false, off, client, slots };
}
