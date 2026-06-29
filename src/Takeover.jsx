import React, { useEffect, useState } from "react";
import { activeTakeover, GAM } from "./sponsor.js";

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
    <a className="takeover-skin" href={s.href} target="_blank" rel="sponsored noopener"
      aria-label={`${s.sponsor} — sponsor`} style={{ background: bg }} />
  );
}

function SponsorHero({ s, splash, children }) {
  const fg = s.fg || "#ffffff";
  const background = s.bgImage
    ? `linear-gradient(90deg, ${s.bg || "#102036"} 12%, color-mix(in srgb, ${s.bg || "#102036"} 40%, transparent) 100%), url(${s.bgImage}) center/cover no-repeat`
    : s.bg;
  return (
    <section className={`hero hero-sponsor${splash ? " hero-splash" : ""}`} style={{ background, color: fg }}>
      <a className="hero-inner hero-sponsor-link" href={s.href} target="_blank" rel="sponsored noopener" style={{ color: fg }}>
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

// ── House hero (brand band over the Great Lakes photo or video) ───────────────
function HouseHero({ hero, spotName, verdict, adFree, splash, children }) {
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
        <div className="hero-eyebrow">Live Great Lakes boating conditions</div>
        <h1 className="hero-title">
          {parts[0]}
          {parts.length > 1 && spotName ? <> at <span className="hero-spot">{spotName}</span></> : ""}
          {parts[1] ?? ""}
        </h1>
        {h.showVerdict && verdict ? (
          <div className="hero-verdict">
            <span className={`hv-badge ${vclass(verdict)}`}>{verdict}</span>
            <span className="hv-text">right now — full breakdown below.</span>
          </div>
        ) : (
          <p className="hero-subtitle">{h.sub || "A clear GO / CAUTION / NO-GO call from live NOAA wind, waves & weather."}</p>
        )}
        {children}
        {!adFree && !splash && <a className="hero-housecta" href="/account">Go ad-free — no banners, ever →</a>}
      </div>
    </section>
  );
}

// ── Public entry ──────────────────────────────────────────────────────────────
export default function Takeover({ adFree, spotName, verdict, splash = false, children = null }) {
  const [cfg, setCfg] = useState({ hero: DEFAULT_HERO, takeover: null, gam: { networkCode: "" }, loaded: false });
  useEffect(() => {
    let alive = true;
    fetch("/api/site-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setCfg({ hero: { ...DEFAULT_HERO, ...(d.hero || {}) }, takeover: d.takeover || null, gam: d.gam || {}, loaded: true }); })
      .catch(() => { if (alive) setCfg((c) => ({ ...c, takeover: activeTakeover(), loaded: true })); });
    return () => { alive = false; };
  }, []);

  const sponsor = cfg.takeover;
  const showSponsor = sponsor && (!adFree || !sponsor.hideForAdFree);
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
  return <HouseHero hero={cfg.hero} spotName={spotName} verdict={verdict} adFree={adFree} splash={splash}>{splash ? children : null}</HouseHero>;
}
