import React, { useEffect } from "react";
import { activeTakeover, GAM, GAM_ENABLED, gamPath } from "./sponsor.js";

const vclass = (v) => (v === "NO-GO" ? "nogo" : v === "CAUTION" ? "caution" : "go");

// ── Google Ad Manager (GPT) ───────────────────────────────────────────────────
function useGPT(enabled) {
  useEffect(() => {
    if (!enabled || !GAM_ENABLED || document.querySelector("script[data-gpt]")) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
    s.setAttribute("data-gpt", "1");
    document.head.appendChild(s);
    window.googletag = window.googletag || { cmd: [] };
  }, [enabled]);
}

function GamSlot({ unit, sizes, id, className }) {
  useEffect(() => {
    if (!GAM_ENABLED) return;
    const gt = (window.googletag = window.googletag || { cmd: [] });
    gt.cmd.push(() => {
      const slot = gt.defineSlot(gamPath(unit), sizes, id);
      if (!slot) return;
      slot.addService(gt.pubads());
      gt.pubads().enableSingleRequest();
      gt.enableServices();
      gt.display(id);
    });
  }, [unit, id]);
  if (!GAM_ENABLED) return null;
  return <div id={id} className={className} />;
}

// ── Full-page sponsor skin (the gutters behind the centered content) ──────────
function SponsorSkin({ s }) {
  useEffect(() => {
    document.body.classList.add("has-takeover");
    return () => document.body.classList.remove("has-takeover");
  }, []);
  const bg = s.bgImage ? `${s.bg} url(${s.bgImage}) center/cover no-repeat` : s.bg;
  return (
    <a className="takeover-skin" href={s.href} target="_blank" rel="sponsored noopener"
      aria-label={`${s.sponsor} — sponsor`} style={{ background: bg }} />
  );
}

// ── Sponsor hero panel (full-width band under the header) ─────────────────────
function SponsorHero({ s }) {
  const fg = s.fg || "#ffffff";
  const background = s.bgImage
    ? `linear-gradient(90deg, ${s.bg} 12%, color-mix(in srgb, ${s.bg} 40%, transparent) 100%), url(${s.bgImage}) center/cover no-repeat`
    : s.bg;
  return (
    <section className="hero hero-sponsor" style={{ background, color: fg }}>
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
      <span className="hero-adlabel">Ad</span>
    </section>
  );
}

// ── House hero (FlightAware-style branded band when nothing is sold) ──────────
function HouseHero({ spotName, verdict, adFree }) {
  return (
    <section className="hero hero-house">
      <div className="hero-inner">
        <div className="hero-eyebrow">Live Great Lakes boating conditions</div>
        <h1 className="hero-title">
          Should I boat{spotName ? <> at <span className="hero-spot">{spotName}</span></> : ""} today?
        </h1>
        {verdict ? (
          <div className="hero-verdict">
            <span className={`hv-badge ${vclass(verdict)}`}>{verdict}</span>
            <span className="hv-text">right now — full breakdown below.</span>
          </div>
        ) : (
          <p className="hero-subtitle">A clear GO / CAUTION / NO-GO call from live NOAA wind, waves &amp; weather.</p>
        )}
        {!adFree && <a className="hero-housecta" href="/account">Go ad-free — no banners, ever →</a>}
      </div>
    </section>
  );
}

// ── Public entry: decide which hero (and skin) to show ────────────────────────
export default function Takeover({ adFree, spotName, verdict }) {
  const sponsor = activeTakeover();
  const showSponsor = sponsor && (!adFree || !sponsor.hideForAdFree);
  const showGam = !sponsor && GAM_ENABLED && !adFree;
  useGPT(showGam);

  if (showSponsor) {
    return (
      <>
        <SponsorSkin s={sponsor} />
        <SponsorHero s={sponsor} />
      </>
    );
  }
  if (showGam) {
    return (
      <section className="hero hero-gam">
        <span className="hero-adlabel">Advertisement</span>
        <GamSlot unit={GAM.heroUnit} sizes={GAM.heroSizes} id="sib-takeover-hero" className="hero-gam-slot" />
      </section>
    );
  }
  return <HouseHero spotName={spotName} verdict={verdict} adFree={adFree} />;
}
