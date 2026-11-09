// Shared helpers for the cam check scripts (check-cams.mjs,
// verify-cam-candidates.mjs): proxy setup and result summarising.
import http from "node:http";
import { spawnSync } from "node:child_process";

// Node's global fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set.
// When a proxy is configured, turn that on programmatically so the scripts
// work in proxied sandboxes without extra flags. Uses Node's built-in
// http.setGlobalProxyFromEnv() (Node >= 22.21 / 24.5); otherwise falls back to
// undici's EnvHttpProxyAgent if undici is installed, else re-executes the
// script with NODE_USE_ENV_PROXY=1. For a proxy
// that re-signs TLS, also export NODE_EXTRA_CA_CERTS=<ca bundle>.
export async function setupProxy() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxy || process.env.NODE_USE_ENV_PROXY === "1") return "";
  if (typeof http.setGlobalProxyFromEnv === "function") {
    http.setGlobalProxyFromEnv();
    return "proxy: enabled via http.setGlobalProxyFromEnv()";
  }
  try {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
    return "proxy: enabled via undici EnvHttpProxyAgent";
  } catch {
    // Neither is available: re-run this same script with NODE_USE_ENV_PROXY=1
    // (supported by Node 22.21+/24), which makes the built-in fetch use the proxy.
    const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
    process.exit(r.status ?? 1);
  }
}

// YouTube answers datacenter IPs with HTTP 429 or a consent/"unusual traffic"
// bot-wall page. Neither says anything about the cam, so callers report them
// as WARN "unverified — rate limited", never DEAD.
export const RATE_LIMITED = "unverified — rate limited";
export function isRateLimited(res, body = "") {
  if (res && res.status === 429) return true;
  return /unusual traffic|consent\.youtube\.com|g-recaptcha|captcha-form/i.test(body);
}

// Summary line + verified/unverified split. "Verified" = OK or DEAD (we got a
// real answer). A WARN is unverified, so a run where everything is unverified
// is reported loudly instead of looking green.
export function summarize(label, results) {
  const n = { OK: 0, WARN: 0, DEAD: 0 };
  let limited = 0;
  for (const r of results) { n[r.status]++; if (r.detail && r.detail.includes(RATE_LIMITED)) limited++; }
  const verified = n.OK + n.DEAD;
  const unverified = n.WARN;
  console.log(`\n${results.length} ${label} · ${n.OK} OK · ${n.WARN} WARN · ${n.DEAD} DEAD`);
  console.log(`verified ${verified}/${results.length} · unverified ${unverified}${limited ? ` (${limited} rate limited)` : ""}`);
  const allUnverified = results.length > 0 && verified === 0;
  if (allUnverified) console.log("\nNOT VERIFIED: no cam could be checked from this network (rate limited / blocked / unreachable). Do not treat this run as healthy.");
  else if (results.length && unverified / results.length > 0.5) console.log("\nCAUTION: over half the cams are unverified; this run is only a partial check.");
  return { ...n, verified, unverified, allUnverified };
}
