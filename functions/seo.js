// SEO surface for shouldiboat.com.
//
// The app is a single-page app served from one index.html shell, so without
// this every launch spot shared one generic <title> and Google saw a single
// page. The Worker runs first (run_worker_first), so here we:
//   • serve /robots.txt and a dynamic /sitemap.xml enumerating every spot,
//   • rewrite the shell's <head> per page so each spot is its own indexable
//     result ("Should I boat at <spot> today?") with canonical + JSON-LD.
// The client reads /spot/<id> from the path (App.jsx) and renders normally.
import { SPOTS, spotFacts } from "./marine/conditions.js";
import { REGIONS, regionBySlug, nearMetroBySlug, seasonalRegions } from "../src/regions.js";

const SITE = "https://shouldiboat.com";
const lakeOf = (s) => s.lake || "Lake Erie";

// Great-circle miles — for ranking the nearest launches to a /near/<metro>.
const haversineMi = (a, b) => {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const nearestSpotLinks = (pt, limit = 8) =>
  Object.entries(SPOTS)
    .filter(([, s]) => s.lat != null && s.lon != null)
    .map(([id, s]) => ({ id, s, mi: haversineMi(pt, s) }))
    .sort((a, b) => a.mi - b.mi)
    .slice(0, limit)
    .map(({ id, s, mi }) => ({ href: `/spot/${id}`, text: `${s.name} (${Math.round(mi)} mi)` }));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const websiteJsonld = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "shouldiboat.com",
  url: `${SITE}/`,
  description: "Live GO / CAUTION / NO-GO boating conditions for the Great Lakes and the warm-water coasts.",
});
const spotJsonld = (id, s, lake) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `Should I boat at ${s.name} today?`,
  url: `${SITE}/spot/${id}`,
  about: `Boating conditions for ${s.name} on ${lake}`,
  isPartOf: { "@type": "WebSite", name: "shouldiboat.com", url: `${SITE}/` },
  // Two levels only: every non-final crumb needs a real URL, and we don't have
  // per-lake pages yet — a middle "lake" crumb with no `item` fails validation.
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "shouldiboat.com", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: s.name, item: `${SITE}/spot/${id}` },
    ],
  },
});

const regionJsonld = (region, count) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `${region.title} boating conditions`,
  url: `${SITE}/${region.slug}`,
  about: `Boating conditions for ${count} launch spots across ${region.title}`,
  isPartOf: { "@type": "WebSite", name: "shouldiboat.com", url: `${SITE}/` },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "shouldiboat.com", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: region.title, item: `${SITE}/${region.slug}` },
    ],
  },
});

// A minimal, UNIQUE server-rendered body for each SPA page. Without this every
// spot/region/home page shipped the same empty `<div id="root">`, so Googlebot's
// first fetch saw byte-identical bodies and clustered them as "Duplicate without
// user-selected canonical" (only the <head> differed). This gives each URL its
// own crawlable <h1> + summary + links. React's createRoot() clears #root on
// mount, so users still get the full live app — this is only the pre-hydration
// view (a faithful summary, not cloaked/different content).
function ssrBody({ h1, description, body, links, nearby }) {
  const row = (arr) => (arr || []).map((x) => `<a href="${x.href}" style="color:#008BA8;text-decoration:none">${esc(x.text)}</a>`).join(" · ");
  const l = row(links);
  const n = nearby && (nearby.links || []).length
    ? `<p style="margin:8px 0 0"><strong>${esc(nearby.label)}:</strong> ${row(nearby.links)}</p>` : "";
  return `<div style="max-width:680px;margin:0 auto;padding:40px 20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#27323d">`
    + `<h1 style="font-size:1.7rem;line-height:1.2;color:#004777;margin:0 0 10px">${esc(h1)}</h1>`
    + `<p style="margin:0 0 12px">${esc(description)}</p>`
    + (body ? `<p style="margin:0 0 12px">${esc(body)}</p>` : "")
    + (l ? `<p style="margin:0;font-weight:600">${l}</p>` : "")
    + n
    + `</div>`;
}

// ── Live, data-backed page bodies ────────────────────────────────────────────
// Spot, region and home pages render today's real verdicts and numbers (from
// the edge-cached directory summary) plus verifiable launch facts, so each
// page's HTML is distinct and useful on its own. The React app shows the same
// facts (the launch-notes card), so crawlers and visitors get the same page.
const LEVEL_MEANING = {
  GO: "Conditions are within typical limits for small and mid-size recreational boats.",
  CAUTION: "Boatable with care: expect chop or building wind. Small boats should think twice.",
  "NO-GO": "Conditions are rough or hazardous for recreational boats. Stay in.",
};
const fmtET = (iso) => {
  try { return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET"; }
  catch (e) { return ""; }
};
const tileLine = (t) => {
  const bits = [];
  if (t.windKt != null) bits.push(`wind ${t.dir ? `${t.dir} ` : ""}${t.windKt} kt${t.gustKt != null && t.gustKt > t.windKt ? `, gusts ${t.gustKt} kt` : ""}`);
  if (t.waveFt != null) bits.push(`waves ${t.waveFt < 1 ? "under 1" : `about ${t.waveFt}`} ft${t.periodSec ? ` every ${t.periodSec} s` : ""}`);
  return bits.join("; ");
};
const S = {
  wrap: "max-width:720px;margin:0 auto;padding:40px 20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#27323d",
  h1: "font-size:1.7rem;line-height:1.2;color:#004777;margin:0 0 10px",
  h2: "font-size:1.1rem;color:#004777;margin:22px 0 6px",
  a: "color:#008BA8;text-decoration:none",
};
const link = (href, text) => `<a href="${esc(href)}" style="${S.a}">${esc(text)}</a>`;
function ssrPage({ h1, lede, sections, links }) {
  return `<div style="${S.wrap}"><h1 style="${S.h1}">${esc(h1)}</h1>`
    + `<p style="margin:0 0 12px">${esc(lede)}</p>`
    + sections.filter(Boolean).map((x) => `<section><h2 style="${S.h2}">${esc(x.h2)}</h2>${x.html}</section>`).join("")
    + (links && links.length ? `<p style="margin:22px 0 0;font-weight:600">${links.map((x) => link(x.href, x.text)).join(" · ")}</p>` : "")
    + `</div>`;
}
const dirList = (arr) => (arr && arr.length ? esc(arr.join(", ")) : "none");

function spotSections(id, s, lake, tile, updatedAt) {
  const f = spotFacts(s);
  const out = [];
  if (tile && tile.level) {
    out.push({ h2: "Conditions right now", html:
      `<p style="margin:0"><strong>${esc(tile.level)}</strong>${updatedAt ? ` as of ${esc(fmtET(updatedAt))}` : ""}${tileLine(tile) ? `: ${esc(tileLine(tile))}.` : "."} ${esc(LEVEL_MEANING[tile.level] || "")}</p>`
      + `<p style="margin:6px 0 0;font-size:.9em;color:#50616f">From the NWS gridded forecast for this launch. The live page adds buoy observations, marine warnings and an hour-by-hour timeline.</p>` });
  }
  const facts = [`<li>Water: ${esc(lake)}</li>`, `<li>Location: ${esc(f.lat.toFixed(3))}, ${esc(f.lon.toFixed(3))}</li>`];
  if (f.zone) facts.push(`<li>NWS marine forecast zone: ${esc(f.zone)}</li>`);
  if (f.buoys.length) facts.push(`<li>Live observations: ${f.buoys.map((b) => link(`https://www.ndbc.noaa.gov/station_page.php?station=${b.toLowerCase()}`, `NDBC ${b}`)).join(", ")}</li>`);
  else facts.push(`<li>Live observations: no reporting buoy close by, so wind and waves come from the NWS forecast</li>`);
  out.push({ h2: `About ${s.name}`, html: `<ul style="margin:0;padding-left:20px">${facts.join("")}</ul>` });
  const e = f.exposure;
  if (e.onshore.length || e.offshore.length) {
    out.push({ h2: "How the wind direction plays here", html:
      `<ul style="margin:0;padding-left:20px">`
      + `<li><strong>Onshore</strong> (waves pile up at the launch, often rougher than the open-water number): ${dirList(e.onshore)}</li>`
      + `<li><strong>Offshore</strong> (deceptively calm at the ramp, rougher farther out, and it pushes you away from shore): ${dirList(e.offshore)}</li>`
      + `<li><strong>Cross-shore</strong> (moderate; watch which way it trends): ${dirList(e.cross)}</li>`
      + (e.roughest.length ? `<li><strong>Roughest directions here</strong>: ${dirList(e.roughest)}</li>` : "")
      + `</ul><p style="margin:6px 0 0;font-size:.9em">Why direction matters: ${link("/guides/wind-direction-and-fetch", "wind direction and fetch")}.</p>` });
  }
  return { out, f };
}

function verdictListHtml(tiles) {
  return `<ul style="margin:0;padding-left:20px">${tiles.map((t) =>
    `<li>${link(`/spot/${t.id}`, t.name)}: <strong>${esc(t.level || "no data")}</strong>${tileLine(t) ? `, ${esc(tileLine(t))}` : ""}</li>`).join("")}</ul>`;
}
const tally = (tiles) => {
  const c = { GO: 0, CAUTION: 0, "NO-GO": 0 };
  tiles.forEach((t) => { if (t.level) c[t.level]++; });
  return [c.GO && `${c.GO} GO`, c.CAUTION && `${c.CAUTION} CAUTION`, c["NO-GO"] && `${c["NO-GO"]} NO-GO`].filter(Boolean).join(", ");
};
function lakeSections(tiles, lakes) {
  return lakes.map((lake) => {
    const list = tiles.filter((t) => lakeOf(t) === lake && SPOTS[t.id]);
    if (!list.length) return null;
    return { h2: `${lake}: ${tally(list) || `${list.length} launches`}`, html: verdictListHtml(list) };
  }).filter(Boolean);
}

// Internal-link helpers: give each page crawlable paths to sibling spot pages,
// so Google can reach and prioritize the launch pages (fixes "Discovered –
// currently not indexed"), and so each page's content is genuinely distinct.
// Same-lake launches ranked by real distance (not declaration order — that
// listed Toledo as "near" Erie, PA, ~180 miles away).
const sameLakeSpots = (excludeId, lake, limit = 6) => {
  const me = SPOTS[excludeId];
  return Object.entries(SPOTS)
    .filter(([id, s]) => id !== excludeId && lakeOf(s) === lake && s.lat != null)
    .map(([id, s]) => ({ id, s, mi: me ? haversineMi(me, s) : 0 }))
    .sort((a, b) => a.mi - b.mi)
    .slice(0, limit)
    .map(({ id, s, mi }) => ({ id, href: `/spot/${id}`, text: s.name, mi: Math.round(mi) }));
};
const regionSpots = (region, limit = 14) =>
  Object.entries(SPOTS)
    .filter(([, s]) => (region.lakes || []).includes(lakeOf(s)))
    .slice(0, limit)
    .map(([id, s]) => ({ href: `/spot/${id}`, text: s.name }));

// Per-page <head> content for an SEO-relevant path, or null to serve the shell
// unchanged (real asset pages like /about and /legal carry their own meta).
export function seoForPath(pathname, live = null) {
  // Only tiles with a verdict count as live data; during an NOAA outage every
  // tile comes back empty and the pages fall back to their static launch lists.
  const tiles = ((live && live.spots) || []).filter((t) => t && t.level);
  const asOf = live && live.updatedAt ? ` as of ${fmtET(live.updatedAt)}` : "";
  if (pathname === "/" || pathname === "") {
    const description = "A clear GO / CAUTION / NO-GO call for boating on the Great Lakes and the warm-water coasts: Florida, the Gulf, the Carolinas, Southern California, Hawaii and Puerto Rico. Built from live NOAA wind, waves, swell, marine warnings, an hour-by-hour timeline, maps and webcams.";
    return {
      url: `${SITE}/`,
      title: "Should I boat today? Live boating conditions · shouldiboat.com",
      description,
      jsonld: websiteJsonld(),
      bodyHtml: ssrPage({
        h1: "Should I boat today? Live boating conditions",
        lede: `${description} Every launch gets its own page with the verdict, the numbers behind it, how the wind direction plays at that shore, and an hour-by-hour timeline.`,
        sections: tiles.length
          ? [{ h2: `Today's verdicts${asOf}`, html: `<p style="margin:0">${esc(tally(tiles))} across ${tiles.length} launches.</p>` },
             ...lakeSections(tiles, seasonalRegions().flatMap((r) => r.lakes))]
          : [{ h2: "Launches", html: `<p style="margin:0">${Object.entries(SPOTS).map(([id, s]) => link(`/spot/${id}`, s.name)).join(" · ")}</p>` }],
        links: [{ href: "/guides/", text: "Boating guides" }, { href: "/about", text: "About" }],
      }),
    };
  }
  // Region subpages (/greatlakes, /chesapeake, …) — each an indexable page for
  // its water bodies, so the site ranks beyond "Great Lakes" as coverage grows.
  const rm = pathname.match(/^\/([a-z0-9-]{2,40})\/?$/);
  const region = rm && regionBySlug(rm[1]);
  if (region) {
    const count = Object.values(SPOTS).filter((s) => (region.lakes || []).includes(s.lake || "Lake Erie")).length;
    const description = `Live boating conditions for ${region.title}: a clear GO / CAUTION / NO-GO call for ${count} launch spots, from NOAA wind, waves, gusts, an hour-by-hour risk timeline, marine warnings and live webcams.`;
    return {
      url: `${SITE}/${region.slug}`,
      title: `${region.title} boating conditions · GO / CAUTION / NO-GO · shouldiboat.com`,
      description,
      jsonld: regionJsonld(region, count),
      bodyHtml: ssrPage({
        h1: `${region.title} boating conditions`,
        lede: `${description}${region.blurb ? ` ${region.blurb}` : ""}`,
        sections: tiles.length
          ? lakeSections(tiles, region.lakes || [])
          : [{ h2: "Launches", html: `<p style="margin:0">${regionSpots(region, 99).map((x) => link(x.href, x.text)).join(" · ")}</p>` }],
        links: [{ href: "/", text: "All waters" }, { href: "/guides/", text: "Boating guides" }],
      }),
    };
  }
  // "Boating near <city>" pages (/near/<slug>) — a landing page for people who
  // search their inland metro rather than a lakeside town. Ranks the nearest
  // covered launches so the page is genuinely useful and its content unique.
  const nm = pathname.match(/^\/near\/([a-z0-9-]{2,40})\/?$/);
  const metro = nm && nearMetroBySlug(nm[1]);
  if (metro) {
    const nearby = nearestSpotLinks(metro);
    const nearNames = nearby.slice(0, 3).map((x) => x.text.replace(/\s*\(.*\)$/, "")).join(", ");
    const description = `The closest boating launches to ${metro.name}, ranked by distance and drive time, each with a live GO / CAUTION / NO-GO call from NOAA wind, waves, gusts and marine warnings${nearNames ? ` — ${nearNames} and more` : ""}.`;
    return {
      // Kept for visitors, but out of the index: these ranked-distance pages
      // are near-templated, and AdSense flagged the site for thin content.
      noindex: true,
      url: `${SITE}/near/${metro.slug}`,
      title: `Boating near ${metro.name} — where can I launch today? · shouldiboat.com`,
      description,
      jsonld: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `Boating near ${metro.name}`,
        url: `${SITE}/near/${metro.slug}`,
        about: `Nearest boating launches to ${metro.name} with live conditions`,
        isPartOf: { "@type": "WebSite", name: "shouldiboat.com", url: `${SITE}/` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "shouldiboat.com", item: `${SITE}/` },
            { "@type": "ListItem", position: 2, name: `Near ${metro.name}`, item: `${SITE}/near/${metro.slug}` },
          ],
        },
      },
      bodyHtml: ssrBody({
        h1: `Boating near ${metro.name}`,
        description,
        body: `Don't live on the water? These are the closest launches we cover to ${metro.name}, ranked by distance and drive time, each with a live GO / CAUTION / NO-GO verdict from NOAA wind, gusts and wave data, an hour-by-hour risk timeline and marine warnings. Loading live conditions…`,
        links: [{ href: "/", text: "All launches" }, { href: "/guides/", text: "Boating guides" }],
        nearby: nearby.length ? { label: `Closest launches to ${metro.name}`, links: nearby } : null,
      }),
    };
  }
  const m = pathname.match(/^\/spot\/([a-z0-9-]{1,40})\/?$/);
  if (m && SPOTS[m[1]]) {
    const s = SPOTS[m[1]];
    const lake = lakeOf(s);
    const description = `Live GO / CAUTION / NO-GO boating conditions for ${s.name} on ${lake}, from NOAA wind, waves, gusts, an hour-by-hour risk timeline, marine warnings and live webcams.`;
    const nearby = sameLakeSpots(m[1], lake);
    const byId = Object.fromEntries(tiles.map((t) => [t.id, t]));
    const { out } = spotSections(m[1], s, lake, byId[m[1]], live && live.updatedAt);
    if (nearby.length) {
      out.push({ h2: `Nearby launches on ${lake}`, html: `<ul style="margin:0;padding-left:20px">${nearby.map((x) => {
        const t = byId[x.id];
        return `<li>${link(x.href, x.text)} (${x.mi} mi)${t && t.level ? `: <strong>${esc(t.level)}</strong>${tileLine(t) ? `, ${esc(tileLine(t))}` : ""}` : ""}</li>`;
      }).join("")}</ul>` });
    }
    return {
      url: `${SITE}/spot/${m[1]}`,
      title: `Should I boat at ${s.name} today? Live conditions · shouldiboat.com`,
      description,
      jsonld: spotJsonld(m[1], s, lake),
      bodyHtml: ssrPage({
        h1: `Should I boat at ${s.name} today?`,
        lede: description,
        sections: out,
        links: [{ href: "/", text: "All launches" },
          ...(lake === "Lake Erie" ? [{ href: "/guides/boating-lake-erie", text: "Boating Lake Erie guide" }] : []),
          ...(s.water ? [{ href: "/guides/boating-the-coast", text: "Boating the coast guide" }] : []),
          { href: "/guides/reading-a-marine-forecast", text: "How to read a marine forecast" }, { href: "/guides/go-caution-nogo-explained", text: "What GO / CAUTION / NO-GO means" }],
      }),
    };
  }
  return null;
}

// A user-built /spot/<slug> page (KV). Indexable meta once an admin features it;
// otherwise a noindex shell so pending pages stay out of search. null = unknown.
export async function seoForBuiltSpot(env, slug) {
  if (!env?.USERS) return null;
  const b = await env.USERS.get(`builtspot:${slug}`, "json").catch(() => null);
  if (!b || b.disabled) return null;
  const lake = b.lake || "the water";
  const description = `Live GO / CAUTION / NO-GO boating conditions for ${b.name} on ${lake}, from NOAA wind, waves, an hour-by-hour risk timeline and marine warnings.`;
  return {
    url: `${SITE}/spot/${slug}`,
    title: `Should I boat at ${b.name} today? Live conditions · shouldiboat.com`,
    description,
    jsonld: spotJsonld(slug, b, lake),
    noindex: !b.featured,
    bodyHtml: ssrBody({
      h1: `Should I boat at ${b.name} today?`,
      description,
      body: `${b.name} on ${lake}. Live GO / CAUTION / NO-GO verdict from NOAA/NWS wind, gusts and wave height, an hour-by-hour risk timeline and marine warnings. Loading live conditions…`,
      links: [{ href: "/", text: "All launches" }, { href: "/guides/", text: "Boating guides" }],
    }),
  };
}

// Targeted single-purpose rewrites of the shell's existing head tags, so this
// stays robust to unrelated head edits. Adds a JSON-LD block before </head>.
export function injectSeo(html, meta) {
  const t = esc(meta.title), d = esc(meta.description), u = esc(meta.url);
  const ld = `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>`;
  return html
    // Seed #root with unique, crawlable content (React clears it on mount).
    .replace(/<div id="root">\s*<\/div>/, `<div id="root">${meta.bodyHtml || ""}</div>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace("</head>", `${meta.noindex ? '<meta name="robots" content="noindex,follow">' : ""}${ld}</head>`);
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /admin\nDisallow: /api/\nDisallow: /auth/\nDisallow: /preview\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

// Editorial guides (static content pages under /guides). Listed explicitly so
// each is a first-class indexable result; keep in sync with public/guides/.
const GUIDES = [
  "reading-a-marine-forecast",
  "go-caution-nogo-explained",
  "cold-water-safety",
  "wind-direction-and-fetch",
  "small-craft-advisory-explained",
  "safety-gear-checklist",
  "before-you-launch",
  "boating-lake-erie",
  "boating-the-coast",
];

// Date the page templates / on-page content last changed materially. Google
// uses <lastmod> (far more than changefreq/priority) to decide what to recrawl,
// but only trusts it when it's accurate — so BUMP THIS when you ship a change
// that alters what's on the pages (new content, layout, copy), not on every
// deploy. W3C date format (YYYY-MM-DD).
const CONTENT_UPDATED = "2026-10-22";

export async function sitemapXml(env) {
  // Admin-featured user-built pages join the sitemap; pending ones stay out.
  let built = [];
  try {
    if (env?.USERS) {
      const list = await env.USERS.list({ prefix: "builtspot:", limit: 1000 });
      for (const k of list.keys) { const b = await env.USERS.get(k.name, "json").catch(() => null); if (b && b.featured && !b.disabled) built.push(b.slug); }
    }
  } catch (e) { built = []; }
  const urls = [
    { loc: `${SITE}/`, freq: "hourly", priority: "1.0" },
    ...REGIONS.map((r) => ({ loc: `${SITE}/${r.slug}`, freq: "hourly", priority: "0.9" })),
    ...Object.keys(SPOTS).map((id) => ({ loc: `${SITE}/spot/${id}`, freq: "hourly", priority: "0.8" })),
    ...built.map((slug) => ({ loc: `${SITE}/spot/${slug}`, freq: "hourly", priority: "0.7" })),
    { loc: `${SITE}/guides/`, freq: "weekly", priority: "0.6" },
    ...GUIDES.map((slug) => ({ loc: `${SITE}/guides/${slug}`, freq: "monthly", priority: "0.5" })),
    { loc: `${SITE}/about`, freq: "monthly", priority: "0.3" },
    { loc: `${SITE}/legal`, freq: "yearly", priority: "0.2" },
  ];
  const body = urls
    .map((x) => `  <url><loc>${x.loc}</loc><lastmod>${CONTENT_UPDATED}</lastmod><changefreq>${x.freq}</changefreq><priority>${x.priority}</priority></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
