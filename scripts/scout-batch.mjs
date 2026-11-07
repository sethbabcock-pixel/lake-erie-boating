// Scout several webcam pages in one go and print only usable hits
// (OK_EMBED / ASK_OWNER), tagged with the seed they came from.
// Run from the "Run script" GitHub Action (the dev sandbox has no network).
import { spawnSync } from "node:child_process";

const SEEDS = [
  "https://www.weather.gov/pqr/barcams",
  "https://weather.gov/arh/weathercams",
  "https://santacruzharbor.org/webcams",
  "https://www.santacruz.org/webcams/santa-cruz-harbor-cam",
  "https://www.smharbor.com/pillar-point-harbor-scenes",
  "https://www.portofbrookingsharbor.com/chetco-river-bar-camera.html",
  "https://www.oregonsadventurecoast.com/live-cam",
  "https://research.oregonstate.edu/port-orford/webcam-and-sea-conditions",
  "https://www.usps.org/localusps/coos/cbbar.html",
  "https://boon.ucdavis.edu/tools/coastal-conditions",
  "https://www.oursausalito.com/",
  "https://alaskacollection.com/plan-your-trip/webcams",
  "https://uas.alaska.edu/juneau/rec/campusviews.html",
  "https://www.mtu.edu/webcams/",
  "https://www.mauihawaii.org/hawaii-webcams",
];

for (const seed of SEEDS) {
  const r = spawnSync(process.execPath, ["scripts/scout-cams.mjs"], { env: { ...process.env, SCOUT_SEED: seed }, encoding: "utf8", timeout: 180000 });
  const lines = (r.stdout || "").split("\n");
  const hits = lines.filter((l) => /"verdict":"(OK_EMBED|ASK_OWNER)"/.test(l) && !/youtube\.com\/(?:@|channel|user)|facebook|instagram|twitter|x\.com/.test(l));
  const summary = lines.find((l) => l.startsWith("scouted")) || "(no summary)";
  console.log(`SEED ${seed} — ${summary}`);
  for (const h of hits.slice(0, 40)) console.log("  " + h);
}
