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

// Per-page <head> content for an SEO-relevant path, or null to serve the shell
// unchanged (real asset pages like /about and /legal carry their own meta).
export function seoForPath(pathname) {
  if (pathname === "/" || pathname === "") {
    return {
      url: `${SITE}/`,
      title: "Should I boat today? Live Great Lakes boating conditions · shouldiboat.com",
      description: "A clear GO / CAUTION / NO-GO call for boating across the Great Lakes — live NOAA wind, waves, gusts, an hour-by-hour risk timeline, marine warnings, weather maps and live webcams for 30+ launch spots.",
      jsonld: websiteJsonld(),
    };
  }
  const m = pathname.match(/^\/spot\/([a-z0-9-]{1,40})\/?$/);
  if (m && SPOTS[m[1]]) {
    const s = SPOTS[m[1]];
    const lake = lakeOf(s);
    return {
      url: `${SITE}/spot/${m[1]}`,
      title: `Should I boat at ${s.name} today? Live conditions · shouldiboat.com`,
      description: `Live GO / CAUTION / NO-GO boating conditions for ${s.name} on ${lake} — NOAA wind, waves, gusts, an hour-by-hour risk timeline, marine warnings and live webcams.`,
      jsonld: spotJsonld(m[1], s, lake),
    };
  }
  return null;
}

// Targeted single-purpose rewrites of the shell's existing head tags, so this
// stays robust to unrelated head edits. Adds a JSON-LD block before </head>.
export function injectSeo(html, meta) {
  const t = esc(meta.title), d = esc(meta.description), u = esc(meta.url);
  const ld = `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${u}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${d}$2`)
    .replace("</head>", `${ld}</head>`);
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /account\nDisallow: /admin\nDisallow: /api/\nDisallow: /auth/\n\nSitemap: ${SITE}/sitemap.xml\n`;
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

export function sitemapXml() {
  const urls = [
    { loc: `${SITE}/`, freq: "hourly", priority: "1.0" },
    ...Object.keys(SPOTS).map((id) => ({ loc: `${SITE}/spot/${id}`, freq: "hourly", priority: "0.8" })),
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
