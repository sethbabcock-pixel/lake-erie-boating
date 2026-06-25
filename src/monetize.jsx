import React, { useEffect, useState } from "react";

/* ============================================================================
   Monetization config — FILL THESE IN, then redeploy.
   Until the AdSense client is a real "ca-pub-…", no ad code loads (the site
   stays clean). Affiliate links work as soon as AMAZON_TAG is set.
   ============================================================================ */
export const ADSENSE = {
  client: "ca-pub-0000000000000000", // ← your AdSense publisher ID (after approval)
  slots: {
    inContent: "0000000000", // ← an ad-unit slot ID from AdSense
  },
};
export const AMAZON_TAG = ""; // ← your Amazon Associates tag, e.g. "shouldiboat-20"
export const GA_ID = "";      // ← your GA4 Measurement ID, e.g. "G-XXXXXXXXXX"

// Load Google Analytics (GA4) only when a real Measurement ID is configured.
export function useAnalytics() {
  useEffect(() => {
    if (!/^G-[A-Z0-9]{6,}$/.test(GA_ID) || document.querySelector("script[data-ga]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    s.setAttribute("data-ga", "1");
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag("js", new Date());
    gtag("config", GA_ID);
  }, []);
}

export const ADSENSE_ENABLED = /^ca-pub-\d{6,}$/.test(ADSENSE.client) && ADSENSE.client !== "ca-pub-0000000000000000";

// Inject the AdSense library once, only when a real client is configured.
export function useAdsense() {
  useEffect(() => {
    if (!ADSENSE_ENABLED || document.querySelector("script[data-adsbygoogle]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.client}`;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-adsbygoogle", "1");
    document.head.appendChild(s);
  }, []);
}

// A single responsive in-content ad unit. Renders nothing until configured.
export function AdSlot({ slot = ADSENSE.slots.inContent }) {
  useEffect(() => {
    if (!ADSENSE_ENABLED) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
  }, []);
  if (!ADSENSE_ENABLED) return null;
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
      {AMAZON_TAG && <div className="hint">As an Amazon Associate, Should I Boat earns from qualifying purchases.</div>}
    </section>
  );
}

// Lightweight cookie/ads notice. (For EEA/UK traffic, also enable Google's
// certified consent management in your AdSense account.)
export function ConsentBanner() {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem("sib.consent"); } catch (e) { return true; }
  });
  if (!show) return null;
  return (
    <div className="consent" role="dialog" aria-label="Cookie notice">
      <span>We use cookies for analytics and ads to keep Should I Boat free. See our{" "}
        <a href="/privacy" target="_blank" rel="noopener">privacy policy</a>.</span>
      <button onClick={() => { try { localStorage.setItem("sib.consent", "1"); } catch (e) {} setShow(false); }}>
        Got it
      </button>
    </div>
  );
}
