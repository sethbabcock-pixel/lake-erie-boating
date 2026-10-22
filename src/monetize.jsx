import React, { useEffect, useRef, useState } from "react";
import { isPubId } from "./ads-config.js";
import { useSiteConfig } from "./siteConfig.js";

/* ============================================================================
   Monetization config.
   AdSense publisher ID + slot IDs live in src/ads-config.js as defaults and are
   editable at runtime in /admin → Ads (stored in KV), so no redeploy is needed
   to turn a placement on/off or swap a slot. Affiliate + analytics IDs below.
   ============================================================================ */
export const AMAZON_TAG = "shouldiboat-20"; // Amazon Associates tag (lights up the Gear block)
// Optional: your Amazon Storefront / Idea List URL. When set, the gear block
// shows a "Shop all our recommended gear →" link to your curated shelf. Build
// one in Amazon Associates → Your Storefront / Idea Lists, then paste the URL.
// Leave empty to hide the link. Example: "https://www.amazon.com/shop/shouldiboat"
export const AMAZON_STOREFRONT = "";
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
  const cfg = useSiteConfig();
  const ads = cfg && cfg.ads;
  useEffect(() => {
    if (!enabled || !ads || !ads.enabled || !isPubId(ads.client)) return;
    if (document.querySelector("script[src*='adsbygoogle.js']")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}`;
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }, [enabled, ads]);
}

// ── Fill telemetry ────────────────────────────────────────────────────────────
// Each placement reports how Google answered on real visitors' devices —
// filled, unfilled (Google had no ad), or noresponse (script blocked / never
// ran) — so /admin can show live fill rates without AdSense access. Sampled
// (1 in 4 page loads) and batched into one request per page to keep KV writes
// low; skipped in ?adtest=1 mode so test ads never skew the numbers.
const AD_SAMPLE = Math.random() < 0.25 && !adTestOn();
let adBuf = [];
let adTimer = null;
function reportAd(placement, status) {
  if (!AD_SAMPLE) return;
  adBuf.push({ p: placement, s: status });
  clearTimeout(adTimer);
  adTimer = setTimeout(() => {
    const body = JSON.stringify({ r: adBuf });
    adBuf = [];
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/adstat", new Blob([body], { type: "application/json" }));
      else fetch("/api/adstat", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch (e) { /* never let telemetry break the page */ }
  }, 2500);
}

// Pushes one <ins> to AdSense and tracks Google's answer. Returns the status:
// "pending" → "filled" | "unfilled" | "noresponse".
function useAdUnit(ref, slot, placement) {
  const [status, setStatus] = useState("pending");
  useEffect(() => {
    const ins = ref.current;
    if (!slot || !ins) return;
    setStatus("pending");
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
    let done = false;
    const finish = (s) => { if (done) return; done = true; setStatus(s); reportAd(placement, s); };
    const read = () => {
      const s = ins.getAttribute("data-ad-status");
      if (s === "filled" || s === "unfilled") finish(s);
    };
    const mo = new MutationObserver(read);
    mo.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
    read();
    // No answer in 12s: the library was blocked (ad blocker, privacy DNS) or
    // never ran. Collapse the placement so it doesn't leave a hole.
    const t = setTimeout(() => finish("noresponse"), 12000);
    return () => { mo.disconnect(); clearTimeout(t); };
  }, [slot, placement]);
  return status;
}

function useAdSlotId(name) {
  const cfg = useSiteConfig();
  const ads = cfg && cfg.ads;
  if (!ads || !ads.enabled || !isPubId(ads.client)) return { client: "", slot: "" };
  if ((ads.off || []).includes(name)) return { client: "", slot: "" };
  return { client: ads.client, slot: ads.slots[name] || "" };
}

// A responsive in-content ad unit for a named placement (see ads-config.js).
// Renders nothing until that placement has a slot ID. The "Advertisement"
// label appears only once Google actually fills it; an unfilled or blocked
// unit collapses entirely, so the page never shows an empty labeled box.
// In ?adtest=1 mode the label always shows with the fill status, for testing.
export function AdSlot({ name = "detailTop" }) {
  const { client, slot } = useAdSlotId(name);
  const ref = useRef(null);
  const status = useAdUnit(ref, slot, name);
  if (!slot) return null;
  const test = adTestOn();
  return (
    <div className={`adwrap is-${status}${test ? " is-test" : ""}`}>
      <span className="adlabel">Advertisement{test ? ` · ${status}` : ""}</span>
      <ins ref={ref} className="adsbygoogle" style={{ display: "block" }}
        data-ad-client={client} data-ad-slot={slot}
        data-ad-format="auto" data-full-width-responsive="true"
        {...(test ? { "data-adtest": "on" } : {})} />
    </div>
  );
}

// Dismissible sticky footer (anchor) ad, shown site-wide. Renders nothing until
// the footerSticky placement has a slot ID. Hidden for ad-free subscribers via
// `enabled`. Google's Better Ads policy requires an easy way to close an overlay
// ad, so it carries a close button and stays dismissed for the session.
export function StickyFooterAd({ enabled }) {
  const { client, slot } = useAdSlotId("footerSticky");
  const [closed, setClosed] = useState(false);
  const ref = useRef(null);
  const live = !!slot && !!enabled && !closed;
  const status = useAdUnit(ref, live ? slot : "", "footerSticky");
  if (!live) return null;
  return (
    <div className={`sticky-ad is-${status}${adTestOn() ? " is-test" : ""}`} role="complementary" aria-label="Advertisement">
      <button className="sticky-ad-close" aria-label="Close ad" onClick={() => setClosed(true)}>×</button>
      <ins ref={ref} className="adsbygoogle" style={{ display: "block", width: "100%", height: "100%" }}
        data-ad-client={client} data-ad-slot={slot}
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
// Each item can become a specific "Our pick" once you fill in its `asin` (the
// 10-char product ID from any Amazon product URL, e.g. amazon.com/dp/B0ABC12345
// → "B0ABC12345"). Until then it links to that category's top-rated results
// (Amazon search sorted by customer review), so every link is useful today and
// upgrades to a hand-picked product the moment you paste an ASIN — no code
// change. (Live price/photo/star rating require Amazon's PA-API, which unlocks
// after the account's first qualifying sales; the card is structured for them.)
const GEAR = {
  pfd:    { icon: "🦺", label: "Life jacket (PFD)", q: "coast guard approved life jacket", why: "Required gear", asin: "" },
  vhf:    { icon: "📻", label: "Handheld VHF radio", q: "floating handheld marine VHF radio", why: "Reach help anywhere", asin: "" },
  anchor: { icon: "⚓", label: "Anchor kit", q: "boat anchor kit with rode", why: "Hold your spot", asin: "" },
  aid:    { icon: "🧰", label: "Marine first-aid kit", q: "marine first aid kit", why: "On-water essentials", asin: "" },
  dry:    { icon: "🎒", label: "Dry bag", q: "waterproof dry bag", why: "Keep phone & keys dry", asin: "" },
  cold:   { icon: "🥶", label: "Cold-water layer", q: "neoprene wetsuit top", why: "Cold-shock protection", asin: "" },
  bail:   { icon: "🪣", label: "Bilge / bailing pump", q: "portable bilge pump boat", why: "For a sloppy day", asin: "" },
  cooler: { icon: "🧊", label: "Cooler", q: "marine cooler", why: "Long day on the water", asin: "" },
  tube:   { icon: "🛟", label: "Towable tube", q: "towable tube for boating", why: "Flat-water fun", asin: "" },
  sun:    { icon: "🧴", label: "Reef-safe sunscreen", q: "reef safe sport sunscreen", why: "Sunny & calm", asin: "" },
  rod:    { icon: "🎣", label: "Rod & tackle", q: "fishing rod reel combo", why: "Bite's on", asin: "" },
};
const isAsin = (a) => /^[A-Z0-9]{10}$/.test(a || "");
// A specific product page when we have an ASIN ("Our pick"); otherwise the
// category's top-rated results (Amazon's own review-rank sort). Both carry the
// affiliate tag. Never fabricate an ASIN — a wrong one links to the wrong item.
function gearUrl(it) {
  if (isAsin(it.asin)) return `https://www.amazon.com/dp/${it.asin}${AMAZON_TAG ? `?tag=${AMAZON_TAG}` : ""}`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(it.q)}&s=review-rank${AMAZON_TAG ? `&tag=${AMAZON_TAG}` : ""}`;
}
export function GearBlock({ waterTempF, airTempF, windKt, level }) {
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
        {items.map((it) => {
          const pick = isAsin(it.asin);
          return (
            <a key={it.q} className={`gear-card${pick ? " ourpick" : ""}`} href={gearUrl(it)} target="_blank" rel="sponsored nofollow noopener">
              <span className={`gear-tag ${pick ? "pick" : "top"}`}>{pick ? "Our pick" : "Top rated"}</span>
              <span className="gear-ic" aria-hidden="true">{it.icon}</span>
              <span className="gear-label">{it.label}</span>
              <span className="gear-why">{it.why}</span>
              <span className="gear-cta">{pick ? "See it on Amazon ↗" : "Top-rated on Amazon ↗"}</span>
            </a>
          );
        })}
      </div>
      {AMAZON_STOREFRONT && (
        <a className="gear-storefront" href={AMAZON_STOREFRONT} target="_blank" rel="sponsored nofollow noopener">
          Shop all our recommended gear on Amazon →
        </a>
      )}
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
