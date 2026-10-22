import React, { useEffect, useMemo, useState } from "react";
import { AD_PLACEMENTS, isPubId, isSlotId } from "../ads-config.js";
import { AMAZON_TAG } from "../monetize.jsx";
import { PageHead, Panel, Field, Switch, Badge, Check, Stat, Icon, ErrorLine, RefreshButton, useAdminFetch } from "./ui.jsx";

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

// Sum the sampled beacon counts over the last `n` days, per placement and total.
function summarize(days, n = 7) {
  const per = {};
  const total = { filled: 0, unfilled: 0, noresponse: 0 };
  for (const d of (days || []).slice(-n)) {
    for (const [p, c] of Object.entries(d.byPlacement || {})) {
      per[p] = per[p] || { filled: 0, unfilled: 0, noresponse: 0 };
      for (const k of ["filled", "unfilled", "noresponse"]) { per[p][k] += c[k] || 0; total[k] += c[k] || 0; }
    }
  }
  return { per, total, n: total.filled + total.unfilled + total.noresponse };
}

// Turn fill numbers into a plain-language diagnosis — the question the owner
// actually has is "is it my code or my account?"
function diagnose({ total: t, n }) {
  if (!n) return { state: "info", title: "No ad responses recorded yet", body: "Fill data comes from 1 in 4 real visits. It starts showing within a few hours of this version going live." };
  const answered = t.filled + t.unfilled;
  const fill = pct(t.filled, answered);
  const blocked = pct(t.noresponse, n);
  if (answered && fill === 0) return { state: "bad", title: "Google is answering, but with no ads (0% fill)",
    body: "The site code is working: Google receives every request and replies \"unfilled\". That is an account-side status. Check AdSense → Sites (shouldiboat.com should say Ready) and Policy center for any restriction or \"low value content\" flag." };
  if (fill != null && fill < 40) return { state: "warn", title: `Low fill: ${fill}% of answered requests got an ad`,
    body: "Ads are serving, but sparsely. Common causes are a recent approval (fill ramps up over 1–2 weeks), limited ads for visitors who haven't accepted cookies, and low advertiser demand off-season." };
  if (blocked >= 50) return { state: "warn", title: `${blocked}% of visitors never loaded the ad script`,
    body: "Those visitors run ad blockers or privacy DNS. Nothing to fix on the site; the ad-free plan is the monetization path for them." };
  return { state: "ok", title: `Ads are serving: ${fill}% fill`, body: `${blocked}% of sampled visits blocked the ad script.` };
}

function FillBar({ c }) {
  const n = c ? c.filled + c.unfilled + c.noresponse : 0;
  if (!n) return <span className="adm-fill adm-muted">no data</span>;
  return (
    <div className="adm-fill" title={`${c.filled} filled · ${c.unfilled} unfilled · ${c.noresponse} blocked`}>
      <div className="adm-fill-bar">
        <i className="f" style={{ width: `${(c.filled / n) * 100}%` }} />
        <i className="u" style={{ width: `${(c.unfilled / n) * 100}%` }} />
        <i className="b" style={{ width: `${(c.noresponse / n) * 100}%` }} />
      </div>
      <span>{pct(c.filled, c.filled + c.unfilled) ?? 0}% fill · {n}</span>
    </div>
  );
}

function useAdsTxt(client) {
  const [st, setSt] = useState({ state: "pending" });
  useEffect(() => {
    const pub = (client || "").replace(/^ca-/, "");
    fetch("/ads.txt", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => {
        const line = t.split("\n").find((l) => l.includes(pub));
        if (!line) setSt({ state: "bad", detail: `ads.txt is live but doesn't list ${pub}.` });
        else if (!/DIRECT/i.test(line)) setSt({ state: "warn", detail: "Your publisher line should say DIRECT." });
        else setSt({ state: "ok", detail: line.trim() });
      })
      .catch((e) => setSt({ state: "bad", detail: `Couldn't load /ads.txt (${e.message}).` }));
  }, [client]);
  return st;
}

export default function AdsPage({ cfg, setCfg }) {
  const ads = cfg.ads;
  const setAds = (patch) => setCfg((c) => ({ ...c, ads: { ...c.ads, ...patch } }));
  const setSlot = (k, v) => setAds({ slots: { ...ads.slots, [k]: v.replace(/\D/g, "").slice(0, 12) } });
  const setOff = (k, paused) => setAds({ off: paused ? [...new Set([...(ads.off || []), k])] : (ads.off || []).filter((x) => x !== k) });

  const stats = useAdminFetch("/api/admin/adstats");
  const s7 = useMemo(() => summarize(stats.data?.days, 7), [stats.data]);
  const dx = diagnose(s7);
  const adsTxt = useAdsTxt(ads.client);
  const [testing, setTesting] = useState(false);

  const live = AD_PLACEMENTS.filter((p) => isSlotId(ads.slots[p.key]) && !(ads.off || []).includes(p.key));
  const pubOk = isPubId(ads.client);
  const pub = ads.client.replace(/^ca-/, "");
  const acct = (path) => `https://www.google.com/adsense/new/u/0/${pub}/${path}`;
  const answered = s7.total.filled + s7.total.unfilled;

  return (
    <>
      <PageHead title="Ads & revenue" sub="AdSense placements, live fill from real visitors, and the account checks that decide whether Google serves.">
        <Switch checked={ads.enabled} onChange={(v) => setAds({ enabled: v })} label={ads.enabled ? "Ads on" : "Ads off"} />
      </PageHead>

      <div className="adm-stats">
        <Stat label="Fill rate · 7d" value={answered ? `${pct(s7.total.filled, answered)}%` : "—"} sub={`${s7.n} sampled responses`}
          tone={answered ? (pct(s7.total.filled, answered) >= 40 ? "ok" : "warn") : undefined} />
        <Stat label="Filled · 7d" value={s7.total.filled} sub="sampled 1 in 4 visits" />
        <Stat label="Blocked · 7d" value={s7.n ? `${pct(s7.total.noresponse, s7.n)}%` : "—"} sub="ad blocker / privacy DNS" />
        <Stat label="Live placements" value={`${live.length} / ${AD_PLACEMENTS.length}`} sub={ads.enabled ? "master switch on" : "master switch OFF"} tone={ads.enabled ? undefined : "bad"} />
      </div>

      <Panel title="Health check" sub="What has to be true for Google to show ads here, checked live."
        actions={<RefreshButton onClick={stats.reload} busy={stats.loading} />}>
        <div className="adm-checks">
          <Check state={dx.state} title={dx.title}>{dx.body}</Check>
          <Check state={ads.enabled ? "ok" : "bad"} title={ads.enabled ? "Ads are switched on" : "Ads are switched off site-wide"}>
            {ads.enabled ? "Free visitors see ads. Ad-free subscribers never do." : "No ad units render anywhere. Flip the switch above and save to turn them on."}
          </Check>
          <Check state={pubOk ? "ok" : "bad"} title={pubOk ? `Publisher ID ${ads.client}` : "Publisher ID is missing or invalid"} />
          <Check state={adsTxt.state} title="ads.txt authorizes Google">{adsTxt.detail}</Check>
          <Check state={live.length ? "ok" : "bad"} title={`${live.length} placement${live.length === 1 ? "" : "s"} live`}>
            {live.length ? live.map((p) => p.label).join(" · ") : "Add a slot ID to at least one placement below."}
          </Check>
          <Check state="info" title="Consent Mode is default-denied">
            Until a visitor taps Accept on the cookie banner, Google serves limited, non-personalized ads, which fill less and pay less. This matches your privacy policy.
          </Check>
        </div>
      </Panel>

      <Panel title="Placements" sub="Each spot on the site that can show a display ad. Paste the 10-digit slot ID from AdSense → Ads → By ad unit. Pause keeps the ID but stops serving."
        actions={<span className="adm-muted">fill · last 7 days</span>}>
        <ErrorLine err={stats.err} />
        <div className="adm-table adm-placements">
          {AD_PLACEMENTS.map((p) => {
            const id = ads.slots[p.key] || "";
            const valid = isSlotId(id);
            const paused = (ads.off || []).includes(p.key);
            const state = !id ? ["neutral", "No slot"] : !valid ? ["bad", "Invalid ID"] : paused ? ["warn", "Paused"] : !ads.enabled ? ["warn", "Ads off"] : ["ok", "Live"];
            return (
              <div className="adm-row" key={p.key}>
                <div className="adm-row-main">
                  <div className="adm-row-title">{p.label} <Badge tone={state[0]}>{state[1]}</Badge></div>
                  <div className="adm-row-sub">{p.where}</div>
                </div>
                <input className="adm-input mono" value={id} placeholder="slot ID" inputMode="numeric" aria-label={`${p.label} slot ID`}
                  onChange={(e) => setSlot(p.key, e.target.value)} />
                <FillBar c={s7.per[p.key]} />
                <Switch checked={!paused && valid} disabled={!valid} onChange={(on) => setOff(p.key, !on)} label="" />
              </div>
            );
          })}
        </div>
        <details className="adm-details">
          <summary>Advanced: publisher ID</summary>
          <Field label="AdSense publisher ID" hint="ca-pub-…">
            <input className="adm-input mono" value={ads.client} onChange={(e) => setAds({ client: e.target.value.trim() })} />
          </Field>
          <p className="adm-muted">The page head also loads AdSense with the ID baked into the HTML (needed for site verification). If you ever change accounts, update index.html and the static pages too.</p>
        </details>
      </Panel>

      <div className="adm-grid2">
        <Panel title="Live render test" sub="Requests a Google test ad from your browser. Turn off ad blockers first.">
          {testing ? (
            <iframe className="adm-adtest" src={`/adtest.html?t=${Date.now()}`} title="AdSense render test" />
          ) : (
            <button className="adm-btn" onClick={() => setTesting(true)}><Icon name="play" /> Run test</button>
          )}
          <p className="adm-muted" style={{ marginTop: 12 }}>
            Want to see the real pages with sample ads? Open <a href="/?adtest=1" target="_blank" rel="noopener">the homepage</a> or{" "}
            <a href="/spot/port-clinton?adtest=1" target="_blank" rel="noopener">a spot page</a> with <code>?adtest=1</code>. Each slot then shows its fill status.
          </p>
        </Panel>

        <Panel title="In your AdSense account" sub="The parts only you can check. Each opens AdSense in a new tab.">
          <ol className="adm-steps">
            <li><a href={acct("sites/my-sites")} target="_blank" rel="noopener">Sites <Icon name="external" size={12} /></a> → shouldiboat.com must say <b>Ready</b>. "Needs attention" means a policy review; fix what it lists, then <b>Request review</b>.</li>
            <li><a href={acct("policy-center")} target="_blank" rel="noopener">Policy center <Icon name="external" size={12} /></a> → no site-level restrictions or "low value content" issues.</li>
            <li><a href={acct("home")} target="_blank" rel="noopener">Home <Icon name="external" size={12} /></a> → no banners asking for identity, address PIN, tax, or payment info. An unverified account stops serving.</li>
            <li>Ads → <b>By ad unit</b> → each slot ID above exists and is <b>Active</b>.</li>
            <li>Turn off <b>Auto ads</b> for this site. The placements above are hand-tuned; Auto ads would add more units on top.</li>
          </ol>
        </Panel>
      </div>

      <div className="adm-grid2">
        <Panel title="Programmatic takeover (Google Ad Manager)" sub="Fills the homepage hero when no sponsor is booked. Leave blank to keep it off.">
          <Field label="GAM network code" hint="digits only">
            <input className="adm-input mono" value={cfg.gam.networkCode} placeholder="e.g. 23001234567"
              onChange={(e) => setCfg((c) => ({ ...c, gam: { ...c.gam, networkCode: e.target.value.replace(/\D/g, "") } }))} />
          </Field>
        </Panel>
        <Panel title="Amazon affiliate" sub="The condition-aware gear rail on every spot page.">
          <Check state={AMAZON_TAG ? "ok" : "warn"} title={AMAZON_TAG ? `Associates tag ${AMAZON_TAG}` : "No Associates tag set"}>
            Set in <code>src/monetize.jsx</code>. Add product ASINs there to turn "Top rated" cards into "Our pick".
          </Check>
        </Panel>
      </div>
    </>
  );
}
