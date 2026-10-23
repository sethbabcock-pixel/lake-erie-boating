import React from "react";
import { PageHead, Panel, Stat, Bars, Check, ErrorLine, RefreshButton, fmtNum, todayISO, useAdminFetch } from "./ui.jsx";
import { AD_PLACEMENTS, isSlotId } from "../ads-config.js";

// Landing view: the numbers that matter plus a "needs attention" list that
// links to the page where each thing gets fixed.
export default function OverviewPage({ cfg, go, counts }) {
  const st = useAdminFetch("/api/admin/stats", (d) => d.stats);
  const billing = useAdminFetch("/api/billing-status");
  const s = st.data;

  const today = todayISO();
  const live = cfg.takeovers.filter((t) => t.start && t.start <= today && today <= (t.end || t.start));
  const isEverywhere = (t) => !(t.regions || []).length && !(t.spots || []).length;
  // The homepage shows only an everywhere campaign; targeted ones show on their own pages.
  const liveCampaign = live.find(isEverywhere);
  const targetedLive = live.filter((t) => !isEverywhere(t)).length;
  const nextCampaign = cfg.takeovers.filter((t) => t.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  const liveAds = AD_PLACEMENTS.filter((p) => isSlotId(cfg.ads.slots[p.key]) && !(cfg.ads.off || []).includes(p.key)).length;

  const attention = [];
  if (!cfg.ads.enabled) attention.push({ state: "bad", title: "Display ads are switched off", to: "ads" });
  else if (!liveAds) attention.push({ state: "bad", title: "No ad placements are live", to: "ads" });
  const b = billing.data;
  if (b && !b.secretKey?.present) attention.push({ state: "warn", title: "Stripe isn't configured, so the ad-free plan can't be bought", to: "system" });
  if (b && b.secretKey?.present && !b.webhookSecret?.present) attention.push({ state: "warn", title: "Stripe webhook secret missing: paid subscriptions won't switch to ad-free", to: "system" });
  if (b && !b.email?.present) attention.push({ state: "warn", title: "Email delivery is off (BREVO_API_KEY not set)", to: "system" });
  if (counts.pages) attention.push({ state: "info", title: `${counts.pages} built page${counts.pages === 1 ? "" : "s"} waiting to be reviewed`, to: "pages" });
  if (counts.inbox) attention.push({ state: "info", title: `${counts.inbox} location and cam request${counts.inbox === 1 ? "" : "s"} in the inbox`, to: "inbox" });

  return (
    <>
      <PageHead title="Overview" sub={s ? `Updated ${new Date(s.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Traffic, accounts and anything that needs you."}>
        <RefreshButton onClick={st.reload} busy={st.loading} />
      </PageHead>
      <ErrorLine err={st.err} />

      <div className="adm-stats">
        <Stat label="Visitors today" value={s ? fmtNum(s.visitorsToday) : "—"} sub={s ? `${fmtNum(s.visitors30)} in 30 days` : ""} />
        <Stat label="Page views · 30d" value={s ? fmtNum(s.visits30) : "—"} sub="first-party, cookieless" />
        <Stat label="Accounts" value={s ? fmtNum(s.totalUsers) : "—"} sub={s ? `+${s.new7d} this week` : ""} />
        <Stat label="Ad-free subscribers" value={s ? fmtNum(s.adFree) : "—"} sub={s ? `${s.conversionPct}% of accounts` : ""} tone={s && s.adFree ? "ok" : undefined} />
      </div>

      <div className="adm-grid2 wide-left">
        <Panel title="Traffic">
          {s ? (
            <>
              <Bars data={s.visitorsByDay} label="Daily visitors · 30 days" tone="brand" />
              <Bars data={s.signupsByDay} label="New accounts · 30 days" tone="accent" height={80} />
              <p className="adm-muted">
                Sign-in mix: {s.via.google} Google · {s.via.password} email · {s.withBoat} with a boat profile · {s.activeSessions} active sessions.
                {s.capped ? " Counts cap at 1,000 records." : ""}
              </p>
            </>
          ) : <div className="adm-skeleton" style={{ height: 240 }} />}
        </Panel>

        <div className="adm-stack">
          <Panel title="Needs attention">
            {attention.length ? (
              <div className="adm-checks">
                {attention.map((a) => (
                  <button key={a.title} className="adm-check-link" onClick={() => go(a.to)}>
                    <Check state={a.state} title={a.title} />
                  </button>
                ))}
              </div>
            ) : <Check state="ok" title="All clear" />}
          </Panel>
          <Panel title="Homepage right now">
            <div className="adm-kv"><span>Hero</span><b>{liveCampaign ? `Sponsor: ${liveCampaign.sponsor || liveCampaign.headline}` : cfg.gam.networkCode ? "Ad Manager takeover" : "House hero"}</b></div>
            <div className="adm-kv"><span>Targeted sponsors live</span><b>{targetedLive || "None"}</b></div>
            <div className="adm-kv"><span>Next sponsor</span><b>{nextCampaign ? `${nextCampaign.sponsor || nextCampaign.headline} · ${nextCampaign.start}` : "None booked"}</b></div>
            <div className="adm-kv"><span>Ad placements</span><b>{liveAds} live</b></div>
            <div className="adm-kv"><span>Cams hidden</span><b>{(cfg.cams.disabled || []).length}</b></div>
            <div className="adm-actions">
              <button className="adm-btn ghost sm" onClick={() => go("sponsors")}>Book a sponsor</button>
              <a className="adm-btn ghost sm" href="/" target="_blank" rel="noopener">Open site</a>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
