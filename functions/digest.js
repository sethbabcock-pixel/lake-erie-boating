// Scheduled email engine for shouldiboat.com — runs from the Worker's cron
// trigger (hourly). Two products, both opt-in per user on the account page:
//
//   • Daily digest (prefs.dailyEmail)  — 10:00 UTC (6am ET): every favorite
//     port's GO / CAUTION / NO-GO verdict in one morning email.
//   • NO-GO alerts (prefs.alertEmails) — every daytime run: a favorite port
//     flips to NO-GO → one email, deduped per port per day, so we warn before
//     someone tows the boat for nothing.
//   • GO alerts (prefs.goAlerts, Pro) — a favorite port that was CAUTION or
//     NO-GO on the previous hourly run turns GO → one email per port per day.
//   • Weekend outlook (prefs.weekendEmail, Pro) — Thursdays at 22:00 UTC
//     (6pm EDT / 5pm EST): Saturday + Sunday verdicts at every favorite port.
//
// Both respect the global emailOptOut, carry the unsubscribe footer, and reuse
// the same summary data the homepage directory shows (pooled NWS grid calls
// for all ports, with cached /points lookups — cheap enough to run hourly).
import { sendEmail, ensureUnsubToken, notify, emailFooter, isPro } from "./auth.js";
import { fetchSummary, fetchTodayWindows, fetchBuiltSummaries, fetchWeeks, fetchSpotVerdict } from "./marine/conditions.js";

const SITE = "https://shouldiboat.com";
export const DIGEST_UTC_HOUR = 10; // 6am ET / 5am CT
const ALERT_UTC_FROM = 9, ALERT_UTC_TO = 23; // only alert 5am–7pm ET
export const WEEKEND_UTC_DAY = 4, WEEKEND_UTC_HOUR = 22; // Thursday evening ET

// Spot names can come from user-built pages (free text), so escape them before
// they go into email HTML; otherwise a crafted name is a phishing link in our mail.
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const V_COLOR = { GO: "#1B936A", CAUTION: "#A9831C", "NO-GO": "#C0392B" };
const chip = (level) =>
  `<span style="display:inline-block;min-width:64px;text-align:center;background:${V_COLOR[level] || "#667"};color:#fff;font-weight:700;font-size:12px;padding:4px 8px;border-radius:6px">${level || "—"}</span>`;

const portRow = (s) => `
  <tr>
    <td style="padding:8px 10px 8px 0">${chip(s.level)}</td>
    <td style="padding:8px 0;font-family:system-ui,sans-serif">
      <a href="${SITE}/?spot=${encodeURIComponent(s.id)}" style="color:#008BA8;font-weight:600;text-decoration:none">${esc(s.name)}</a>
      <span style="color:#5b6b78;font-size:13px"> · ${s.windKt != null ? `${s.windKt} kt${s.dir ? ` ${s.dir}` : ""}` : "—"} · ${s.waveFt != null ? `${s.waveFt} ft${s.periodSec ? ` @ ${s.periodSec}s` : ""}` : "—"}${s.win ? ` · <b style="color:#1B936A">best ${s.win.from}–${s.win.to}</b>` : ""}</span>
    </td>
  </tr>`;

function digestHtml(favSpots, unsubUrl) {
  const counts = { GO: 0, CAUTION: 0, "NO-GO": 0 };
  favSpots.forEach((s) => { if (s.level) counts[s.level] = (counts[s.level] || 0) + 1; });
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#1a2b38">
    <h2 style="margin:0 0 4px">Your ports this morning</h2>
    <p style="margin:0 0 14px;color:#5b6b78">${counts.GO} GO · ${counts.CAUTION} caution · ${counts["NO-GO"]} no-go</p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${favSpots.map(portRow).join("")}</table>
    <p style="margin:18px 0 0"><a href="${SITE}" style="display:inline-block;background:#008BA8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Full hour-by-hour forecast</a></p>
    <p style="color:#8a99a6;font-size:12px;margin:18px 0 0">You're getting this daily verdict because it's turned on in your <a href="${SITE}/account" style="color:#8a99a6">account settings</a>.</p>
  </div>${emailFooter(unsubUrl)}`;
}

function alertHtml(nogoSpots, unsubUrl) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#1a2b38">
    <h2 style="margin:0 0 10px">NO-GO at your port${nogoSpots.length > 1 ? "s" : ""}</h2>
    <p style="margin:0 0 14px;color:#5b6b78">Conditions have turned rough. Before you tow the boat, take a look:</p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${nogoSpots.map(portRow).join("")}</table>
    <p style="margin:18px 0 0"><a href="${SITE}" style="display:inline-block;background:#C0392B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">See when it clears</a></p>
    <p style="color:#8a99a6;font-size:12px;margin:18px 0 0">NO-GO alerts are on in your <a href="${SITE}/account" style="color:#8a99a6">account settings</a>: one email per port per day, daytime only.</p>
  </div>${emailFooter(unsubUrl)}`;
}

function goAlertHtml(goSpots, unsubUrl) {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#1a2b38">
    <h2 style="margin:0 0 10px">It's GO at ${goSpots.length > 1 ? "your ports" : esc(goSpots[0].name)}</h2>
    <p style="margin:0 0 14px;color:#5b6b78">Conditions just improved. If you can get out, now's the window:</p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${goSpots.map(portRow).join("")}</table>
    <p style="margin:18px 0 0"><a href="${SITE}/spot/${encodeURIComponent(goSpots[0].id)}" style="display:inline-block;background:#1B936A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">See how long it lasts</a></p>
    <p style="color:#8a99a6;font-size:12px;margin:18px 0 0">GO alerts are a Pro feature, on in your <a href="${SITE}/account" style="color:#8a99a6">account settings</a>: one email per port per day.</p>
  </div>${emailFooter(unsubUrl)}`;
}

const dayName = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
const dayCell = (d) => d
  ? `${chip(d.level)}<div style="color:#5b6b78;font-size:12px;margin-top:3px">${d.windKt != null ? `${d.windKt}${d.gustKt != null && d.gustKt > d.windKt ? `–${d.gustKt}` : ""} kt` : "—"} · ${d.waveFt != null ? `${d.waveFt} ft` : "—"}</div>`
  : `<span style="color:#8a99a6">—</span>`;

// The coming Saturday + Sunday in a port's 7-day outlook (local dates).
export function weekendDays(week) {
  const dow = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
  const sat = (week || []).find((d) => dow(d.date) === 6) || null;
  const sun = (week || []).find((d) => dow(d.date) === 0 && (!sat || d.date > sat.date)) || null;
  return { sat, sun };
}

function weekendHtml(rows, unsubUrl) {
  const any = rows.find((r) => r.sat || r.sun) || {};
  const satLabel = any.sat ? dayName(any.sat.date) : "Saturday", sunLabel = any.sun ? dayName(any.sun.date) : "Sunday";
  const tr = (r) => `<tr>
      <td style="padding:10px 12px 10px 0;font-family:system-ui,sans-serif"><a href="${SITE}/spot/${encodeURIComponent(r.id)}" style="color:#008BA8;font-weight:600;text-decoration:none">${esc(r.name)}</a></td>
      <td style="padding:10px 12px 10px 0">${dayCell(r.sat)}</td>
      <td style="padding:10px 0">${dayCell(r.sun)}</td>
    </tr>`;
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;color:#1a2b38">
    <h2 style="margin:0 0 4px">Your weekend on the water</h2>
    <p style="margin:0 0 14px;color:#5b6b78">The forecast for your starred ports. Weekend forecasts firm up by Friday, so check again before you launch.</p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse">
      <tr><th></th><th style="text-align:left;font-size:12px;color:#5b6b78;padding:0 12px 4px 0">${satLabel}</th><th style="text-align:left;font-size:12px;color:#5b6b78;padding:0 0 4px">${sunLabel}</th></tr>
      ${rows.map(tr).join("")}
    </table>
    <p style="color:#8a99a6;font-size:12px;margin:18px 0 0">The weekend outlook is a Pro feature, on in your <a href="${SITE}/account" style="color:#8a99a6">account settings</a>.</p>
  </div>${emailFooter(unsubUrl)}`;
}

// List every user record (paginated; fine at launch scale).
async function allUsers(env) {
  const users = [];
  let cursor;
  do {
    const page = await env.USERS.list({ prefix: "user:", limit: 1000, cursor });
    for (const k of page.keys) {
      const u = await env.USERS.get(k.name, "json").catch(() => null);
      if (u && u.email) users.push(u);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return users;
}

export async function runScheduled(env, utcHour, now = new Date()) {
  if (!env.USERS) return { skipped: "no KV" };
  const isDigestRun = utcHour === DIGEST_UTC_HOUR;
  const isWeekendRun = utcHour === WEEKEND_UTC_HOUR && now.getUTCDay() === WEEKEND_UTC_DAY;
  const isAlertWindow = utcHour >= ALERT_UTC_FROM && utcHour <= ALERT_UTC_TO;
  if (!isDigestRun && !isAlertWindow) return { skipped: "outside windows" };

  const users = await allUsers(env);
  const summary = await fetchSummary(env); // curated + featured built pages
  const byId = Object.fromEntries((summary.spots || []).map((s) => [s.id, s]));
  // Favorited user-built pages that aren't already covered (not featured yet):
  // resolve them so members get emails for their own built spots too.
  const missing = [...new Set(users.flatMap((u) => u.favorites || []))].filter((id) => !byId[id]);
  if (missing.length) {
    for (const t of await fetchBuiltSummaries(env, missing).catch(() => [])) byId[t.id] = t;
  }
  // Today's best GO window per port — digest runs only (pooled NWS grid calls).
  const windows = isDigestRun ? await fetchTodayWindows().catch(() => ({})) : {};
  const today = now.toISOString().slice(0, 10);

  // GO alerts compare each port's level with the previous hourly run's, so they
  // fire on a real improvement rather than on every run that happens to be GO.
  const favIds = [...new Set(users.flatMap((u) => u.favorites || []))].filter((id) => byId[id]);
  // Stored as "LEVEL|YYYY-MM-DD"; a level from an earlier day is ignored, so a
  // missed run can't turn an old CAUTION into a false "just improved".
  const prevRaw = {}, prevLevel = {};
  if (isAlertWindow) {
    for (const id of favIds) {
      const v = await env.USERS.get(`lvl:${id}`).catch(() => null);
      prevRaw[id] = v;
      const [lvl, day] = String(v || "").split("|");
      prevLevel[id] = v && day === today ? lvl : null;
    }
  }
  // The first run of the window only records levels: an overnight change isn't
  // news (the 6am digest covers the morning), so no GO alert fires on it. A
  // candidate also needs real wind AND wave data on its tile.
  const tileTurnedGo = (id) => {
    const s = byId[id];
    return utcHour > ALERT_UTC_FROM && s?.level === "GO" && s.windKt != null && s.waveFt != null && prevLevel[id] && prevLevel[id] !== "GO";
  };
  // Then confirm with the full spot-page verdict (marine advisories, gusts,
  // buoys, nearshore text) — the tile alone is not enough to email "GO".
  const goConfirmed = {};
  if (isAlertWindow) {
    const wanted = new Set(users.filter((u) => isPro(u) && (u.prefs || {}).goAlerts).flatMap((u) => u.favorites || []));
    for (const id of favIds.filter((id) => wanted.has(id) && tileTurnedGo(id))) {
      goConfirmed[id] = (await fetchSpotVerdict(env, id).catch(() => null)) === "GO";
    }
  }
  const turnedGo = (id) => goConfirmed[id] === true;

  // Weekend outlook: only the starred ports of opted-in Pro members are fetched.
  const wantsWeekend = (u) => isPro(u) && (u.prefs || {}).weekendEmail && !u.emailOptOut && u.emailVerified !== false;
  const weeks = isWeekendRun
    ? await fetchWeeks(env, users.filter(wantsWeekend).flatMap((u) => u.favorites || [])).catch(() => ({}))
    : {};

  let digests = 0, alerts = 0, goAlerts = 0, weekends = 0, failures = 0;
  for (const u of users) {
    try {
      if (u.emailOptOut || u.emailVerified === false) continue;
      const favSpots = (u.favorites || []).map((id) => byId[id]).filter(Boolean);
      if (!favSpots.length) continue;
      const prefs = u.prefs || {};

      if (isDigestRun && prefs.dailyEmail) {
        const unsub = `${SITE}/unsubscribe?u=${await ensureUnsubToken(env, u)}`;
        const withWin = favSpots.map((s) => ({ ...s, win: windows[s.id] || null }));
        // Subject leads with the home port's (first favorite's) best window.
        const home = withWin[0];
        const c = favSpots.filter((s) => s.level === "GO").length;
        const subject = home?.win
          ? `Best window at ${home.name}: ${home.win.from}–${home.win.to} · shouldiboat.com`
          : `${c ? `${c} of ${favSpots.length} ports are GO` : `Your ports this morning`} · shouldiboat.com`;
        const r = await sendEmail(env, u.email, subject, digestHtml(withWin, unsub));
        r.ok ? digests++ : failures++;
      }

      if (isAlertWindow && prefs.alertEmails) {
        const nogo = favSpots.filter((s) => s.level === "NO-GO");
        const fresh = [];
        for (const s of nogo) {
          const key = `alerted:${u.email}:${s.id}:${today}`;
          if (!(await env.USERS.get(key))) fresh.push({ s, key });
        }
        if (fresh.length) {
          const unsub = `${SITE}/unsubscribe?u=${await ensureUnsubToken(env, u)}`;
          const names = fresh.map(({ s }) => s.name).join(", ");
          const r = await sendEmail(env, u.email, `NO-GO alert: ${names} · shouldiboat.com`, alertHtml(fresh.map(({ s }) => s), unsub));
          if (r.ok) {
            alerts++;
            for (const { key } of fresh) await env.USERS.put(key, "1", { expirationTtl: 129600 }); // 36h — resets for the next day
          } else failures++;
        }
      }

      if (isAlertWindow && prefs.goAlerts && isPro(u)) {
        const fresh = [];
        for (const s of favSpots.filter((s) => turnedGo(s.id))) {
          const key = `goalerted:${u.email}:${s.id}:${today}`;
          if (!(await env.USERS.get(key))) fresh.push({ s, key });
        }
        if (fresh.length) {
          const unsub = `${SITE}/unsubscribe?u=${await ensureUnsubToken(env, u)}`;
          const names = fresh.map(({ s }) => s.name).join(", ");
          const r = await sendEmail(env, u.email, `GO now: ${names} · shouldiboat.com`, goAlertHtml(fresh.map(({ s }) => s), unsub));
          if (r.ok) {
            goAlerts++;
            for (const { key } of fresh) await env.USERS.put(key, "1", { expirationTtl: 129600 });
          } else failures++;
        }
      }

      if (isWeekendRun && wantsWeekend(u)) {
        const rows = favSpots.map((s) => ({ id: s.id, name: s.name, ...weekendDays(weeks[s.id]) })).filter((r) => r.sat || r.sun);
        if (rows.length) {
          const unsub = `${SITE}/unsubscribe?u=${await ensureUnsubToken(env, u)}`;
          const good = rows.filter((r) => r.sat?.level === "GO" || r.sun?.level === "GO").length;
          const subject = good ? `Weekend outlook: ${good} of ${rows.length} port${rows.length > 1 ? "s" : ""} look GO · shouldiboat.com` : `Weekend outlook for your ports · shouldiboat.com`;
          const r = await sendEmail(env, u.email, subject, weekendHtml(rows, unsub));
          r.ok ? weekends++ : failures++;
        }
      }
    } catch (e) { failures++; }
  }

  // Remember each starred port's level for the next run's GO check. Written
  // only when it changes or is from an earlier day (≈1 write per port per day
  // plus real changes), to stay well inside KV's daily write quota.
  if (isAlertWindow) {
    for (const id of favIds) {
      const lvl = byId[id].level;
      const val = `${lvl}|${today}`;
      if (lvl && prevRaw[id] !== val) await env.USERS.put(`lvl:${id}`, val).catch(() => {});
    }
  }

  // One log line per run that did something (or every digest run, for visibility).
  if (digests || alerts || goAlerts || weekends || failures || isDigestRun) {
    await notify(env, "email_run", { utcHour, users: users.length, digests, alerts, goAlerts, weekends, failures });
  }
  return { digests, alerts, goAlerts, weekends, failures, users: users.length };
}
