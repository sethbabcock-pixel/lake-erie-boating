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
    detailTop: "", // spot page, right under the current-conditions row (every /spot visitor sees it — highest value)
    detailMid: "", // spot page, lower in the toolkit
    landing: "",   // homepage, under the port directory
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

// Inject the AdSense library once — only when configured AND the user consented.
export function useAdsense(enabled) {
  useEffect(() => {
    if (!enabled || !ADSENSE_ENABLED || document.querySelector("script[data-adsbygoogle]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.client}`;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-adsbygoogle", "1");
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
        data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}

// Affiliate "gear for the water" block. Condition-aware: cold water surfaces a
// cold-water item. Amazon search links carry the associate tag when set.
export function GearBlock({ waterTempF }) {
  const url = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}${AMAZON_TAG ? `&tag=${AMAZON_TAG}` : ""}`;
  const items = [
    { label: "Life jackets (PFDs)", q: "coast guard approved life jacket" },
    { label: "Handheld VHF radio", q: "handheld marine VHF radio floating" },
    { label: "Anchor kit", q: "boat anchor kit with rode" },
    { label: "Dry bag", q: "waterproof dry bag" },
    { label: "Marine first-aid kit", q: "marine first aid kit" },
  ];
  if (waterTempF != null && waterTempF < 60) {
    items.unshift({ label: "Cold-water layer", q: "neoprene wetsuit top paddling" });
  }
  return (
    <section className="card gear">
      <div className="card-head"><h2>Gear for the water</h2></div>
      <div className="gear-grid">
        {items.map((it) => (
          <a key={it.q} className="gear-item" href={url(it.q)} target="_blank" rel="sponsored nofollow noopener">
            {it.label} <span>↗</span>
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
        <a href="/legal#cookies" target="_blank" rel="noopener">Learn more</a>.</span>
      <div className="consent-actions">
        <button className="cbtn ghost" onClick={() => onChoose("essential")}>Reject</button>
        <button className="cbtn" onClick={() => onChoose("all")}>Accept</button>
      </div>
    </div>
  );
}
