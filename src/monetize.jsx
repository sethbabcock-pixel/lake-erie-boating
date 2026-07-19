import React, { useEffect, useState } from "react";

/* ============================================================================
   Monetization config — FILL THESE IN, then redeploy.
   Until the AdSense client is a real "ca-pub-…", no ad code loads (the site
   stays clean). Affiliate links work as soon as AMAZON_TAG is set.
   ============================================================================ */
export const ADSENSE = {
  client: "ca-pub-9213366013949616", // AdSense publisher ID (set)
  // Ad-unit slot IDs. In AdSense: Ads → By ad unit → Display → create a unit →
  // copy its 10-digit slot ID here. Empty means that placement renders nothing,
  // so you can switch them on one at a time. See MONETIZATION.md.
  slots: {
    detailTop: "9841170882",  // spot page, right under the current-conditions row (every /spot visitor sees it — highest value)
    detailMid: "8915670243",  // spot page, lower in the toolkit
    landing: "3032908319",    // homepage, under the port directory
    landingTop: "1882789819", // homepage, high up (under the join strip)
    footerSticky: "",         // ← paste slot ID to turn on the dismissible sticky footer ad (site-wide)
  },
};
export const AMAZON_TAG = "shouldiboat-20"; // Amazon Associates tag (lights up the Gear block)
export const GA_ID = "G-D2199LJV2T"; // GA4 Measurement ID (loads only after cookie consent)

// Lightweight GA4 event push, shared across the app. No-op until analytics is
// consented + loaded, so it's always safe to call.
export function track() { try { if (window.dataLayer) window.dataLayer.push(arguments); } catch (e) { /* ignore */ } }

// Load Google Analytics (GA4) only when configured AND the user consented.
export function useAnalytics(enabled) {
  useEffect(() => {
    if (!enabled || !/^G-[A-Z0-9]{6,}$/.test(GA_ID) || document.querySelector("script[data-ga]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    s.setAttribute("data-ga", "1");
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag("js", new Date());
    gtag("config", GA_ID);
  }, [enabled]);
}

export const ADSENSE_ENABLED = /^ca-pub-\d{6,}$/.test(ADSENSE.client) && ADSENSE.client !== "ca-pub-0000000000000000";

// Test mode: visiting any page with ?adtest=1 makes Google serve *sample* ads
// (data-adtest="on") instead of real ones. Impressions aren't counted and it
// won't trip invalid-traffic protection, so it's the safe way for the owner to
// confirm units render end-to-end even though live ads are suppressed on their
// own device. Real visitors never hit this unless they hand-craft the URL.
function adTestOn() {
  try { return new URLSearchParams(window.location.search).get("adtest") === "1"; } catch (e) { return false; }
}

export function getConsent() {
  try { return localStorage.getItem("sib.consent"); } catch (e) { return null; }
}

// Google Consent Mode v2 update — flips cookie permissions when the user makes
// a banner choice. The page-load default (denied unless previously accepted) is
// set inline in index.html before any Google script loads.
export function updateConsentMode(choice) {
  const v = choice === "all" ? "granted" : "denied";
  window.dataLayer = window.dataLayer || [];
  // gtag consent commands must be pushed as an `arguments` object — a plain
  // array is silently ignored by Google's tag.
  function gtag() { window.dataLayer.push(arguments); }
  gtag("consent", "update", { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
}

// Inject the AdSense library once when ads are allowed (not ad-free).
// Consent Mode (index.html) still controls personalization; denied consent gets
// limited non-personalized ads, matching the privacy policy. The library is also
// loaded from index.html for site review — this is a backup for shells that omit it.
export function useAdsense(enabled) {
  useEffect(() => {
    if (!enabled || !ADSENSE_ENABLED || document.querySelector("script[data-sib-ads],script[src*='adsbygoogle.js']")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.client}`;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-sib-ads", "1");
    document.head.appendChild(s);
  }, [enabled]);
}

// A responsive in-content ad unit for a named placement (see ADSENSE.slots).
// Renders nothing until that placement's slot ID is filled — so unconfigured
// placements stay fully invisible (no blank boxes), and you enable each by
// pasting one slot ID.
export function AdSlot({ name = "detailTop" }) {
  const slot = ADSENSE.slots[name] || "";
  const ready = ADSENSE_ENABLED && !!slot;
  useEffect(() => {
    if (!ready) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
  }, [ready]);
  if (!ready) return null;
  return (
    <div className="adwrap">
      <span className="adlabel">Advertisement</span>
      <ins className="adsbygoogle" style={{ display: "block" }}
        data-ad-client={ADSENSE.client} data-ad-slot={slot}
        data-ad-format="auto" data-full-width-responsive="true"
        {...(adTestOn() ? { "data-adtest": "on" } : {})} />
    </div>
  );
}

// Dismissible sticky footer (anchor) ad, shown site-wide. Idle-safe: renders
// nothing until ADSENSE.slots.footerSticky is filled. Consent-gated and hidden
// for ad-free subscribers via the `enabled` prop. Google's Better Ads policy
// requires an easy way to close an overlay ad, so it carries a close button and
// stays dismissed for the rest of the session.
export function StickyFooterAd({ enabled }) {
  const slot = ADSENSE.slots.footerSticky || "";
  const [closed, setClosed] = useState(false);
  const ready = ADSENSE_ENABLED && !!slot && !!enabled && !closed;
  useEffect(() => {
    if (!ready) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
  }, [ready]);
  if (!ready) return null;
  return (
    <div className="sticky-ad" role="complementary" aria-label="Advertisement">
      <button className="sticky-ad-close" aria-label="Close ad" onClick={() => setClosed(true)}>×</button>
      <ins className="adsbygoogle" style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client={ADSENSE.client} data-ad-slot={slot}
        data-ad-format="horizontal" data-full-width-responsive="true"
        {...(adTestOn() ? { "data-adtest": "on" } : {})} />
    </div>
  );
}

// Affiliate "gear for the water" carousel. It reads today's conditions and
// surfaces the gear that fits — cold water → cold-water layers, a rough/NO-GO
// day → safety & bailing gear, a calm sunny day → coolers, tubes & fishing —
// so it shows each visitor what's relevant now. Links are tagged Amazon
// searches (a real product carousel with photos/prices needs Amazon's Product
// Advertising API, which unlocks after the account's first qualifying sales).
const GEAR = {
  pfd:    { icon: "🦺", label: "Life jacket (PFD)", q: "coast guard approved life jacket", why: "Required gear" },
  vhf:    { icon: "📻", label: "Handheld VHF radio", q: "floating handheld marine VHF radio", why: "Reach help anywhere" },
  anchor: { icon: "⚓", label: "Anchor kit", q: "boat anchor kit with rode", why: "Hold your spot" },
  aid:    { icon: "🧰", label: "Marine first-aid kit", q: "marine first aid kit", why: "On-water essentials" },
  dry:    { icon: "🎒", label: "Dry bag", q: "waterproof dry bag", why: "Keep phone & keys dry" },
  cold:   { icon: "🥶", label: "Cold-water layer", q: "neoprene wetsuit top", why: "Cold-shock protection" },
  bail:   { icon: "🪣", label: "Bilge / bailing pump", q: "portable bilge pump boat", why: "For a sloppy day" },
  cooler: { icon: "🧊", label: "Cooler", q: "marine cooler", why: "Long day on the water" },
  tube:   { icon: "🛟", label: "Towable tube", q: "towable tube for boating", why: "Flat-water fun" },
  sun:    { icon: "🧴", label: "Reef-safe sunscreen", q: "reef safe sport sunscreen", why: "Sunny & calm" },
  rod:    { icon: "🎣", label: "Rod & tackle", q: "fishing rod reel combo", why: "Bite's on" },
};
export function GearBlock({ waterTempF, airTempF, windKt, level }) {
  const url = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}${AMAZON_TAG ? `&tag=${AMAZON_TAG}` : ""}`;
  const cold = waterTempF != null && waterTempF < 60;
  const rough = level === "NO-GO" || level === "CAUTION" || (windKt != null && windKt >= 15);
  const nice = level === "GO" && (windKt == null || windKt < 12) && (airTempF == null || airTempF >= 72);
  const featured = [];
  if (cold) featured.push(GEAR.cold);
  if (rough) featured.push(GEAR.bail, GEAR.anchor);
  if (nice) featured.push(GEAR.cooler, GEAR.tube, GEAR.sun, GEAR.rod);
  const seen = new Set();
  const items = [...featured, GEAR.pfd, GEAR.vhf, GEAR.anchor, GEAR.aid, GEAR.dry]
    .filter((it) => (seen.has(it.q) ? false : seen.add(it.q)));
  const heading = cold ? "Gear for cold water" : rough ? "Rough-day gear" : nice ? "Gear for a day out" : "Gear for the water";
  return (
    <section className="card gear">
      <div className="card-head"><h2>{heading}</h2><span className="legend">picked for today's conditions</span></div>
      <div className="gear-rail">
        {items.map((it) => (
          <a key={it.q} className="gear-card" href={url(it.q)} target="_blank" rel="sponsored nofollow noopener">
            <span className="gear-ic" aria-hidden="true">{it.icon}</span>
            <span className="gear-label">{it.label}</span>
            <span className="gear-why">{it.why}</span>
            <span className="gear-cta">Shop on Amazon ↗</span>
          </a>
        ))}
      </div>
      {AMAZON_TAG && <div className="hint">As an Amazon Associate, shouldiboat.com earns from qualifying purchases.</div>}
    </section>
  );
}

// Lightweight cookie/ads notice. (For EEA/UK traffic, also enable Google's
// certified consent management in your AdSense account.)
// GDPR/CCPA banner: non-essential cookies (analytics + ads) load only on Accept.
export function ConsentBanner({ consent, onChoose }) {
  if (consent === "all" || consent === "essential") return null;
  return (
    <div className="consent" role="dialog" aria-label="Cookie notice">
      <span>We use cookies for analytics and ads to keep shouldiboat.com free. Accept to allow them, or reject non-essential cookies.{" "}
        <a href="/legal#cookies" target="_blank" rel="noopener" aria-label="Learn more about our cookie and privacy policy">Learn more</a>.</span>
      <div className="consent-actions">
        <button className="cbtn ghost" onClick={() => onChoose("essential")}>Reject</button>
        <button className="cbtn" onClick={() => onChoose("all")}>Accept</button>
      </div>
    </div>
  );
}
