// SEO surface for shouldiboat.com.
//
// The app is a single-page app served from one index.html shell, so without
// this every launch spot shared one generic <title> and Google saw a single
// page. The Worker runs first (run_worker_first), so here we:
//   • serve /robots.txt and a dynamic /sitemap.xml enumerating every spot,
//   • rewrite the shell's <head> per page so each spot is its own indexable
//     result ("Should I boat at <spot> today?") with canonical + JSON-LD.
// The client reads /spot/<id> from the path (App.jsx) and renders normally.
import { SPOTS } from "./marine/conditions.js";
import { REGIONS, regionBySlug } from "../src/regions.js";

const SITE = "https://shouldiboat.com";
const lakeOf = (s) => s.lake || "Lake Erie";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const websiteJsonld = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "shouldiboat.com",
  url: `${SITE}/`,
  description: "Live GO / CAUTION / NO-GO boating conditions for the Great Lakes.",
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
      { "@type": "ListItem", position: 1, name: "Great Lakes", item: `${SITE}/` },
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
function ssrBody({ h1, description, body, links }) {
  const l = (links || []).map((x) => `<a href="${x.href}" style="color:#008BA8;text-decoration:none">${esc(x.text)}</a>`).join(" · ");
  return `<div style="max-width:680px;margin:0 auto;padding:40px 20px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#27323d">`
    + `<h1 style="font-size:1.7rem;line-height:1.2;color:#004777;margin:0 0 10px">${esc(h1)}</h1>`
    + `<p style="margin:0 0 12px">${esc(description)}</p>`
    + (body ? `<p style="margin:0 0 12px">${esc(body)}</p>` : "")
    + (l ? `<p style="margin:0;font-weight:600">${l}</p>` : "")
    + `</div>`;
}

// Per-page <head> content for an SEO-relevant path, or null to serve the shell
// unchanged (real asset pages like /about and /legal carry their own meta).
export function seoForPath(pathname) {
  if (pathname === "/" || pathname === "") {
    const description = "A clear GO / CAUTION / NO-GO call for boating across the Great Lakes, from live NOAA wind, waves, gusts, an hour-by-hour risk timeline, marine warnings, weather maps and live webcams for 30+ launch spots.";
    return {
      url: `${SITE}/`,
      title: "Should I boat today? Live Great Lakes boating conditions · shouldiboat.com",
      description,
      jsonld: websiteJsonld(),
      bodyHtml: ssrBody({
        h1: "Should I boat today? Live Great Lakes boating conditions",
        description,
        body: "Choose your launch for a live GO / CAUTION / NO-GO verdict from NOAA wind, gusts and wave data, an hour-by-hour risk timeline, marine warnings, weather maps and live webcams. Loading live conditions…",
        links: [{ href: "/greatlakes", text: "Great Lakes" }, { href: "/guides/", text: "Boating guides" }, { href: "/about", text: "About" }],
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
      bodyHtml: ssrBody({
        h1: `${region.title} boating conditions`,
        description,
        body: `Live GO / CAUTION / NO-GO verdicts for ${count} launch spots across ${region.title}, from NOAA wind, gusts and wave data, marine warnings and live webcams. Loading live conditions…`,
        links: [{ href: "/", text: "All waters" }, { href: "/guides/", text: "Boating guides" }],
      }),
    };
  }
  const m = pathname.match(/^\/spot\/([a-z0-9-]{1,40})\/?$/);
  if (m && SPOTS[m[1]]) {
    const s = SPOTS[m[1]];
    const lake = lakeOf(s);
    const description = `Live GO / CAUTION / NO-GO boating conditions for ${s.name} on ${lake}, from NOAA wind, waves, gusts, an hour-by-hour risk timeline, marine warnings and live webcams.`;
    return {
      url: `${SITE}/spot/${m[1]}`,
      title: `Should I boat at ${s.name} today? Live conditions · shouldiboat.com`,
      description,
      jsonld: spotJsonld(m[1], s, lake),
      bodyHtml: ssrBody({
        h1: `Should I boat at ${s.name} today?`,
        description,
        body: `${s.name} on ${lake}. Live GO / CAUTION / NO-GO verdict from NOAA/NWS wind, gusts and wave height, an hour-by-hour risk timeline, marine warnings, a weather map and live webcams. Loading live conditions…`,
        links: [{ href: "/", text: "All Great Lakes launches" }, { href: "/guides/reading-a-marine-forecast", text: "How to read a marine forecast" }, { href: "/guides/", text: "Boating guides" }],
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
];

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
    .map((x) => `  <url><loc>${x.loc}</loc><changefreq>${x.freq}</changefreq><priority>${x.priority}</priority></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
