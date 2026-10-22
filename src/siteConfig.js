import { useEffect, useState } from "react";
import { ADSENSE_DEFAULTS, sanitizeAds } from "./ads-config.js";

// One /api/site-config fetch per page load, shared by every consumer (hero,
// takeover, ad slots). Falls back to built-in defaults if the request fails,
// so ads and the hero still work when KV or the API is unavailable.
let pending = null;
export function loadSiteConfig() {
  if (!pending) {
    pending = fetch("/api/site-config")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => ({ ...(d || {}), ads: sanitizeAds(d && d.ads ? d.ads : ADSENSE_DEFAULTS), ok: !!d }));
  }
  return pending;
}

// null until loaded, then the config object.
export function useSiteConfig() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    let alive = true;
    loadSiteConfig().then((c) => { if (alive) setCfg(c); });
    return () => { alive = false; };
  }, []);
  return cfg;
}
