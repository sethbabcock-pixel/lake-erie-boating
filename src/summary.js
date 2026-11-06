// One shared fetch of the per-spot directory summary (/marine/conditions?summary)
// so the landing page, header location picker and "calmer launches nearby" all
// reuse a single request. Cached briefly; failures are never cached.
let cache = null; // { t, p }
const TTL = 120000;
export function getSummary() {
  if (cache && Date.now() - cache.t < TTL) return cache.p;
  const p = fetch("/marine/conditions?summary")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const list = d && Array.isArray(d.spots) ? d.spots : null;
      if (!list) { cache = null; return []; }
      return list;
    })
    .catch(() => { cache = null; return []; });
  cache = { t: Date.now(), p };
  return p;
}

export const milesBetween = (a, b) => {
  if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
