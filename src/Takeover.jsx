import React, { useEffect, useState } from "react";
import { activeTakeover, GAM } from "./sponsor.js";
import { loadSiteConfig } from "./siteConfig.js";
import { pickCampaign } from "./sponsor-target.js";

// Sponsor reporting: one view per page shown, one click per click-through.
// Cookieless; counts land in KV per campaign per day (admin → Sponsors).
function sponsorHit(id, k) {
  try {
    const body = JSON.stringify({ id, k });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/sponsor-hit", new Blob([body], { type: "application/json" }));
    else fetch("/api/sponsor-hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch (e) { /* reporting never breaks the page */ }
}

const vclass = (v) => (v === "NO-GO" ? "nogo" : v === "CAUTION" ? "caution" : "go");
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
  return (
    <a className="takeover-skin" href={s.href} target="_blank" rel="sponsored noopener" onClick={() => sponsorHit(s.id, "c")}
      aria-label={`${s.sponsor} sponsor`} style={{ background: bg }} />
  );
}

function SponsorHero({ s, splash, children }) {
  const fg = s.fg || "#ffffff";
  const background = s.bgImage
    ? `linear-gradient(90deg, ${s.bg || "#102036"} 12%, color-mix(in srgb, ${s.bg || "#102036"} 40%, transparent) 100%), url(${s.bgImage}) center/cover no-repeat`
    : s.bg;
  return (
    <section className={`hero hero-sponsor${splash ? " hero-splash" : ""}`} style={{ background, color: fg }}>
      <a className="hero-inner hero-sponsor-link" href={s.href} target="_blank" rel="sponsored noopener" style={{ color: fg }} onClick={() => sponsorHit(s.id, "c")}>
        <div className="hero-text">
          <div className="hero-eyebrow">{s.eyebrow || "Sponsored"}</div>
          {s.logo && <img className="hero-logo" src={s.logo} alt={s.sponsor} />}
          <h2 className="hero-title">{s.headline}</h2>
          {s.sub && <p className="hero-subtitle">{s.sub}</p>}
        </div>
        {s.cta && (
          <span className="hero-cta" style={{ background: s.accent || "#ffffff", color: s.accentFg || "#11151c" }}>
            {s.cta} →
          </span>
        )}
      </a>
      {children && <div className="hero-inner hero-splash-slot">{children}</div>}
      <span className="hero-adlabel">Ad</span>
    </section>
  );
}

// ── House hero (brand band over the hero photo or video) ─────────────────────
function HouseHero({ hero, spotName, verdict, adFree, splash, children, signedIn, onJoin }) {
  const h = { ...DEFAULT_HERO, ...(hero || {}) };
  const photo = h.image;
  const video = h.video;
  const bgStyle = !video && photo
    ? { backgroundImage: `linear-gradient(90deg, rgba(7,24,43,0.94) 0%, rgba(7,24,43,0.66) 46%, rgba(7,24,43,0.14) 100%), url(${photo})` }
    : undefined;
  const parts = (h.headline || DEFAULT_HERO.headline).split("{spot}");
  return (
    <section className={`hero hero-house${photo || video ? " has-photo" : ""}${splash ? " hero-splash" : ""}`} style={bgStyle}>
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
        <h1 className="hero-title">
          {parts[0]}
          {parts.length > 1 && spotName ? <> at <span className="hero-spot">{spotName}</span></> : ""}
          {parts[1] ?? ""}
        </h1>
        {h.showVerdict && verdict ? (
          <div className="hero-verdict">
            <span className={`hv-badge ${vclass(verdict)}`}>{verdict}</span>
            <span className="hv-text">right now. Full breakdown below.</span>
          </div>
        ) : (
          <p className="hero-subtitle">{h.sub || "A clear GO / CAUTION / NO-GO call from live NOAA wind, waves & weather."}</p>
        )}
        {children}
        {/* One goal per audience: signed-out → sign up; signed-in free → ad-free upsell. */}
        {!splash && !signedIn && onJoin && (
          <button className="hero-housecta linkbtn" onClick={onJoin}>Create a free account for hour-by-hour, cams &amp; alerts →</button>
        )}
        {!splash && signedIn && !adFree && <a className="hero-housecta" href="/account">Go ad-free, no banners ever →</a>}
      </div>
    </section>
  );
}

// ── Public entry ──────────────────────────────────────────────────────────────
// spot / region: where this hero sits (a launch id, a REGIONS slug), so a
// targeted campaign shows on its own pages (see src/sponsor-target.js).
export default function Takeover({ adFree, spotName, verdict, splash = false, children = null, signedIn = true, onJoin = null, spot = null, region = null }) {
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
  const sponsor = region === undefined ? null : pickCampaign(cfg.takeovers, { spot, region });
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
  return <HouseHero hero={cfg.hero} spotName={spotName} verdict={verdict} adFree={adFree} splash={splash} signedIn={signedIn} onJoin={onJoin}>{splash ? children : null}</HouseHero>;
}
