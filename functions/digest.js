// Scheduled email engine for Should I Boat? — runs from the Worker's cron
// trigger (hourly). Two products, both opt-in per user on the account page:
//
//   • Daily digest (prefs.dailyEmail)  — 10:00 UTC (6am ET): every favorite
//     port's GO / CAUTION / NO-GO verdict in one morning email.
//   • NO-GO alerts (prefs.alertEmails) — every daytime run: a favorite port
//     flips to NO-GO → one email, deduped per port per day, so we warn before
//     someone tows the boat for nothing.
//
// Both respect the global emailOptOut, carry the unsubscribe footer, and reuse
// the same summary data the homepage directory shows (two batched Open-Meteo
// calls for all ports — cheap enough to run hourly).
import { sendEmail, ensureUnsubToken, notify, emailFooter } from "./auth.js";
import { fetchSummary, fetchTodayWindows } from "./marine/conditions.js";

const SITE = "https://shouldiboat.com";
export const DIGEST_UTC_HOUR = 10; // 6am ET / 5am CT
const ALERT_UTC_FROM = 9, ALERT_UTC_TO = 23; // only alert 5am–7pm ET

const V_COLOR = { GO: "#1B936A", CAUTION: "#A9831C", "NO-GO": "#C0392B" };
const chip = (level) =>
  `<span style="display:inline-block;min-width:64px;text-align:center;background:${V_COLOR[level] || "#667"};color:#fff;font-weight:700;font-size:12px;padding:4px 8px;border-radius:6px">${level || "—"}</span>`;

const portRow = (s) => `
  <tr>
    <td style="padding:8px 10px 8px 0">${chip(s.level)}</td>
    <td style="padding:8px 0;font-family:system-ui,sans-serif">
      <a href="${SITE}/?spot=${encodeURIComponent(s.id)}" style="color:#008BA8;font-weight:600;text-decoration:none">${s.name}</a>
      <span style="color:#5b6b78;font-size:13px"> · ${s.windKt != null ? `${s.windKt} kt${s.dir ? ` ${s.dir}` : ""}` : "—"} · ${s.waveFt != null ? `${s.waveFt} ft` : "—"}${s.win ? ` · <b style="color:#1B936A">best ${s.win.from}–${s.win.to}</b>` : ""}</span>
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
    <h2 style="margin:0 0 10px">⛔ NO-GO at your port${nogoSpots.length > 1 ? "s" : ""}</h2>
    <p style="margin:0 0 14px;color:#5b6b78">Conditions have turned rough — before you tow the boat, take a look:</p>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${nogoSpots.map(portRow).join("")}</table>
    <p style="margin:18px 0 0"><a href="${SITE}" style="display:inline-block;background:#C0392B;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">See when it clears</a></p>
    <p style="color:#8a99a6;font-size:12px;margin:18px 0 0">NO-GO alerts are on in your <a href="${SITE}/account" style="color:#8a99a6">account settings</a> — one email per port per day, daytime only.</p>
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

export async function runScheduled(env, utcHour) {
  if (!env.USERS) return { skipped: "no KV" };
  const isDigestRun = utcHour === DIGEST_UTC_HOUR;
  const isAlertWindow = utcHour >= ALERT_UTC_FROM && utcHour <= ALERT_UTC_TO;
  if (!isDigestRun && !isAlertWindow) return { skipped: "outside windows" };

  const summary = await fetchSummary();
  const byId = Object.fromEntries((summary.spots || []).map((s) => [s.id, s]));
  // Today's best GO window per port — digest runs only (2 extra batched calls).
  const windows = isDigestRun ? await fetchTodayWindows().catch(() => ({})) : {};
  const today = new Date().toISOString().slice(0, 10);

  let digests = 0, alerts = 0, failures = 0;
  const users = await allUsers(env);
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
          ? `⚓ Best window at ${home.name}: ${home.win.from}–${home.win.to} · Should I Boat?`
          : `⚓ ${c ? `${c} of ${favSpots.length} ports are GO` : `Your ports this morning`} · Should I Boat?`;
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
          const r = await sendEmail(env, u.email, `⛔ NO-GO: ${names} · Should I Boat?`, alertHtml(fresh.map(({ s }) => s), unsub));
          if (r.ok) {
            alerts++;
            for (const { key } of fresh) await env.USERS.put(key, "1", { expirationTtl: 129600 }); // 36h — resets for the next day
          } else failures++;
        }
      }
    } catch (e) { failures++; }
  }

  // One log line per run that did something (or every digest run, for visibility).
  if (digests || alerts || failures || isDigestRun) {
    await notify(env, "email_run", { utcHour, users: users.length, digests, alerts, failures });
  }
  return { digests, alerts, failures, users: users.length };
}
