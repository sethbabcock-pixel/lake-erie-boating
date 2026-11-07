import React, { useEffect, useState } from "react";
import { activeTakeover, GAM } from "./sponsor.js";
import { loadSiteConfig } from "./siteConfig.js";
import { pickCampaign } from "./sponsor-target.js";
import { regionBySlug } from "./regions.js";
import { readableOn } from "./contrast.js";
import { spotPhoto } from "./spot-photos.js";

// The hero photo for a page: the region's own upload, else the coastal
// illustration for warm-water regions (the main photo is a Great Lakes scene),
// else the main hero image.
export function heroImageFor(hero, region) {
  if (region === undefined) return ""; // spot page still resolving its region: no photo yet, never the wrong one
  const r = region && regionBySlug(region);
  return (r && hero.regions && hero.regions[r.slug]) || (r && r.warm ? "/hero-coast.svg" : hero.image);
}

// Sponsor reporting: one view per page shown, one click per click-through.
// Cookieless; counts land in KV per campaign per day (admin → Sponsors).
function sponsorHit(id, k) {
  if (!id) return; // the /advertise demo (and any id-less campaign) is never counted
  try {
    const body = JSON.stringify({ id, k });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/sponsor-hit", new Blob([body], { type: "application/json" }));
    else fetch("/api/sponsor-hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch (e) { /* reporting never breaks the page */ }
}

// /advertise "see it live" preview: ?sponsor=demo on any page shows a sample
// banner, clearly marked as a sample. No id, so no view/click is ever counted
// and no real campaign's report is touched.
const DEMO_SPONSOR = {
  id: "", sponsor: "Sample sponsor", eyebrow: "Sample sponsor banner · preview",
  headline: "Your marina, front and center", sub: "Your logo, your headline and a button, on the page boaters check before they launch.",
  cta: "Your button", href: "/advertise#book", bg: "#0b3a5c", fg: "#ffffff", accent: "#f9b612", accentFg: "#11151c",
};
const isSponsorDemo = () => { try { return new URLSearchParams(window.location.search).get("sponsor") === "demo"; } catch (e) { return false; } };

const vclass = (v) => (v === "NO-GO" ? "nogo" : v === "CAUTION" ? "caution" : v === "GO" ? "go" : "unknown");
const DEFAULT_HERO = { image: "/hero-sunset.svg", video: "", headline: "Should I boat{spot} today?", sub: "", showVerdict: true };

// ── Google Ad Manager (GPT) ───────────────────────────────────────────────────
function useGPT(code) {
  useEffect(() => {
    if (!code || document.querySelector("script[data-gpt]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    s.setAttribute("data-gpt", "1");
    document.head.appendChild(s);
    window.googletag = window.googletag || { cmd: [] };
  }, [code]);
}

function GamSlot({ code, unit, sizes, id, className }) {
  useEffect(() => {
    if (!code) return;
    const gt = (window.googletag = window.googletag || { cmd: [] });
    gt.cmd.push(() => {
      const slot = gt.defineSlot(`/${code}/${unit}`, sizes, id);
      if (!slot) return;
      slot.addService(gt.pubads());
      gt.pubads().enableSingleRequest();
      gt.enableServices();
      gt.display(id);
    });
  }, [code, unit, id]);
  if (!code) return null;
  return <div id={id} className={className} />;
}

// ── Full-page sponsor skin (behind the centered content) ──────────────────────
function SponsorSkin({ s }) {
  useEffect(() => {
    document.body.classList.add("has-takeover");
    return () => document.body.classList.remove("has-takeover");
  }, []);
  const bg = s.bgImage ? `${s.bg || "#102036"} url(${s.bgImage}) center/cover no-repeat` : s.bg;
  // The /advertise sample (no id) gets a plain, non-clickable background: a
  // full-page click target beside real ad units invites accidental clicks.
  // Touch devices (no hover / coarse pointer) get the same plain background:
  // edge mis-taps must never open a sponsor. Desktop keeps the click-through.
  const touch = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  if (!s.id || touch) return <div className="takeover-skin" aria-hidden="true" style={{ background: bg }} />;
  return (
    <a className="takeover-skin" href={s.href} target="_blank" rel="sponsored noopener" onClick={() => sponsorHit(s.id, "c")}
      aria-label={`${s.sponsor} sponsor`} style={{ background: bg }} />
  );
}

function SponsorHero({ s, splash, children }) {
  // Contrast guard: a sponsor's text colour that fails AA (4.5:1) on its
  // background is replaced by white or near-black, whichever passes.
  const fg = readableOn(s.fg || "#ffffff", s.bg || "#102036");
  const ctaFg = readableOn(s.accentFg || "#11151c", s.accent || "#ffffff");
  const background = s.bgImage
    ? `linear-gradient(90deg, ${s.bg || "#102036"} 12%, color-mix(in srgb, ${s.bg || "#102036"} 40%, transparent) 100%), url(${s.bgImage}) center/cover no-repeat`
    : s.bg;
  return (
    <section className={`hero hero-sponsor${splash ? " hero-splash" : ""}`} style={{ background, color: fg }}>
      <a className="hero-inner hero-sponsor-link" href={s.href} target="_blank" rel="sponsored noopener" style={{ color: fg }} onClick={() => sponsorHit(s.id, "c")}>
        <div className="hero-text">
          <div className="hero-eyebrow">
            <span className="hero-sponsored">Sponsored</span>
            {s.eyebrow && s.eyebrow.trim().toLowerCase() !== "sponsored" && <span className="hero-eyebrow-text">{s.eyebrow}</span>}
          </div>
          {s.logo && <img className="hero-logo" src={s.logo} alt={s.sponsor} />}
          <h2 className="hero-title">{s.headline}</h2>
          {s.sub && <p className="hero-subtitle">{s.sub}</p>}
        </div>
        {s.cta && (
          <span className="hero-cta" style={{ background: s.accent || "#ffffff", color: ctaFg }}>
            {s.cta} →
          </span>
        )}
      </a>
      {children && <div className="hero-inner hero-splash-slot">{children}</div>}
    </section>
  );
}

// ── House hero (brand band over the hero photo or video) ─────────────────────
// title / subtitle replace the admin headline on pages with their own subject
// (a /near/<city> page reads "Boating near Cleveland, OH").
function HouseHero({ hero, spotName, verdict, adFree, splash, children, signedIn, onJoin, title, subtitle, region, authPending, spot }) {
  const h = { ...DEFAULT_HERO, ...(hero || {}) };
  // Spot pages get a compact title band: the verdict card right below is the
  // headline, so no second verdict badge. With a photo of that launch (or its
  // region) the band sits on it; without one it's a plain title, never a
  // photo of somewhere else.
  if (!splash) {
    const parts = (h.headline || DEFAULT_HERO.headline).split("{spot}");
    const pic = spotPhoto(h, spot, region || null);
    return (
      <section className={`hero hero-band${pic ? " has-photo" : ""}`}>
        {pic && <img className="hero-band-img" src={pic.src} alt="" fetchpriority="high" decoding="async" referrerPolicy="no-referrer" />}
        {pic && pic.credit && (
          <a className="hero-band-credit" href={pic.source} target="_blank" rel="noopener">
            Photo: {pic.credit}{pic.license ? ` · ${pic.license}` : ""}
          </a>
        )}
        <div className="hero-inner">
          <div className="hero-band-text">
            <div className="hero-eyebrow">Live conditions · NOAA / NWS data</div>
            {title ? <h1 className="hero-title">{title}</h1> : <h1 className="hero-title">
              {parts[0]}
              {parts.length > 1 && spotName ? <> at {spotName}</> : ""}
              {parts[1] ?? ""}
            </h1>}
            {subtitle && <p className="hero-subtitle">{subtitle}</p>}
          </div>
          {authPending && <span className="hero-housecta hero-cta-pending" aria-hidden="true">&nbsp;</span>}
          {!authPending && !signedIn && onJoin && (
            <button className="hero-housecta linkbtn" onClick={onJoin}>Get this port's 6am verdict by email, free →</button>
          )}
          {!authPending && signedIn && !adFree && <a className="hero-housecta" href="/account#pro">Go Pro: no Google ads + GO alerts →</a>}
        </div>
      </section>
    );
  }
  const photo = heroImageFor(h, region);
  // A hero video belongs to the main hero; a regional photo replaces it.
  const pending = region === undefined; // keep the photo styling; image arrives once the region is known
  const video = !pending && photo === h.image ? h.video : "";
  const shade = "linear-gradient(90deg, rgba(7,24,43,0.94) 0%, rgba(7,24,43,0.66) 46%, rgba(7,24,43,0.14) 100%)";
  const bgStyle = !video && photo ? { backgroundImage: `${shade}, url(${photo})` }
    : pending ? { backgroundImage: `${shade}, linear-gradient(180deg, #0f2a4a, #0b3a5c)` } : undefined;
  const parts = (h.headline || DEFAULT_HERO.headline).split("{spot}");
  return (
    <section className={`hero hero-house${photo || video || pending ? " has-photo" : ""}${splash ? " hero-splash" : ""}`} style={bgStyle}>
      {video && (
        <>
          <video className="hero-video" autoPlay muted loop playsInline poster={photo || undefined}>
            <source src={video} />
          </video>
          <div className="hero-video-scrim" />
        </>
      )}
      <div className="hero-inner">
        <div className="hero-eyebrow">Live boating conditions from NOAA</div>
        {title ? <h1 className="hero-title">{title}</h1> : <h1 className="hero-title">
          {parts[0]}
          {parts.length > 1 && spotName ? <> at <span className="hero-spot">{spotName}</span></> : ""}
          {parts[1] ?? ""}
        </h1>}
        {subtitle ? <p className="hero-subtitle">{subtitle}</p> : h.showVerdict && verdict ? (
          <div className="hero-verdict">
            <span className={`hv-badge ${vclass(verdict)}`}>{verdict}</span>
            <span className="hv-text">right now. Full breakdown below.</span>
          </div>
        ) : (
          <p className="hero-subtitle">{h.sub || "A clear GO / CAUTION / NO-GO call from live NOAA wind, waves & weather."}</p>
        )}
        {children}
        {/* One goal per audience: signed-out → sign up; signed-in free → Pro upsell.
            Everything on the page is already free, so the signup pitch is what an
            account adds: the morning email + alerts. While auth loads, hold the
            line's space so the CTA doesn't pop in and shift the page. */}
        {!splash && authPending && <span className="hero-housecta hero-cta-pending" aria-hidden="true">&nbsp;</span>}
        {!splash && !authPending && !signedIn && onJoin && (
          <button className="hero-housecta linkbtn" onClick={onJoin}>Get this port's verdict by email at 6am, free →</button>
        )}
        {!splash && !authPending && signedIn && !adFree && <a className="hero-housecta" href="/account#pro">Go Pro: no Google ads + GO alerts →</a>}
      </div>
    </section>
  );
}

// ── Public entry ──────────────────────────────────────────────────────────────
// spot / region: where this hero sits (a launch id, a REGIONS slug), so a
// targeted campaign shows on its own pages (see src/sponsor-target.js).
export default function Takeover({ adFree, spotName, verdict, splash = false, children = null, signedIn = true, onJoin = null, spot = null, region = null, title = null, subtitle = null, authPending = false }) {
  const [cfg, setCfg] = useState({ hero: DEFAULT_HERO, takeovers: [], gam: { networkCode: "" }, loaded: false });
  useEffect(() => {
    let alive = true;
    loadSiteConfig().then((d) => {
      if (!alive) return;
      if (d.ok) setCfg({ hero: { ...DEFAULT_HERO, ...(d.hero || {}) }, takeovers: d.takeovers || (d.takeover ? [d.takeover] : []), gam: d.gam || {}, loaded: true });
      else { const t = activeTakeover(); setCfg((c) => ({ ...c, takeovers: t ? [t] : [], loaded: true })); }
    });
    return () => { alive = false; };
  }, []);

  // region === undefined means "not known yet": hold the house hero.
  const sponsor = isSponsorDemo() ? DEMO_SPONSOR : region === undefined ? null : pickCampaign(cfg.takeovers, { spot, region });
  const showSponsor = sponsor && (!adFree || !sponsor.hideForAdFree);
  // One view per campaign per page (a new launch or region counts again).
  const viewKey = showSponsor && sponsor.id ? `${sponsor.id}|${spot || ""}|${region || ""}` : "";
  useEffect(() => { if (viewKey) sponsorHit(sponsor.id, "v"); }, [viewKey]);
  const code = (cfg.gam && cfg.gam.networkCode) || "";
  const showGam = !sponsor && !adFree && /^\d{5,}$/.test(code);
  useGPT(showGam ? code : "");

  if (showSponsor) {
    return (
      <>
        <SponsorSkin s={sponsor} />
        <SponsorHero s={sponsor} splash={splash}>{splash ? children : null}</SponsorHero>
      </>
    );
  }
  if (showGam && !splash) {
    return (
      <section className="hero hero-gam">
        <span className="hero-adlabel">Advertisement</span>
        <GamSlot code={code} unit={GAM.heroUnit} sizes={GAM.heroSizes} id="sib-takeover-hero" className="hero-gam-slot" />
      </section>
    );
  }
  return <HouseHero hero={cfg.hero} spot={spot} spotName={spotName} verdict={verdict} adFree={adFree} splash={splash} signedIn={signedIn} onJoin={onJoin}
    title={title} subtitle={subtitle} region={region} authPending={authPending}>{splash ? children : null}</HouseHero>;
}
