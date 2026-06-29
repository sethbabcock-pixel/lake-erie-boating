// First-party, cookieless pageview beacon. Fires once per full page load.
// Uses localStorage only to dedupe "new daily visitor" (not a cookie, not PII,
// never sent anywhere) — so the counter sees every visitor, including those who
// decline the cookie banner. Aggregate counts land in KV (pv:/uv: by day).
export function recordPageview() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let isNewVisitor = false;
    if (localStorage.getItem("sib.lastVisitDay") !== today) {
      isNewVisitor = true;
      localStorage.setItem("sib.lastVisitDay", today);
    }
    const url = `/api/hit${isNewVisitor ? "?v=1" : ""}`;
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else fetch(url, { method: "POST", keepalive: true }).catch(() => {});
  } catch (e) { /* never let analytics break the page */ }
}
