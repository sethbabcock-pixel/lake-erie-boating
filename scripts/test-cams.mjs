// Offline tests for the cam-matching helpers in src/cams.js.  node scripts/test-cams.mjs
import { nearestCams, nearestCamsWithDist, camIsReplay, haversineMi } from "../src/cams.js";
let failed = 0;
const check = (n, c) => { console.log(`${c ? "  ok" : "  FAIL"} ${n}`); if (!c) failed++; };
const L = (lake, lat, lon, name) => ({ name, lat, lon, ...(lake ? { lake } : {}), yt: "x" });
const list = [
  L(null, 41.5, -82.9, "Erie A"), L("Lake Superior", 41.5, -82.9, "Sup same spot"),
  L("North Carolina Coast", 34.72, -76.66, "Beaufort"), L("Florida Keys", 24.55, -81.8, "Key West"),
  L("Alabama & Mississippi Coast", 30.27, -87.58, "Orange Beach"),
];
check("Lake Erie spot sees only Erie/no-lake cams", nearestCams(41.5, -82.9, "Lake Erie", 6, list).map((c) => c.name).join() === "Erie A");
check("Great Lakes never see coastal cams", nearestCams(34.72, -76.66, "Lake Erie", 6, list).length === 0);
check("coastal spot matches a neighbouring region by distance", nearestCams(35.1, -76.6, "Georgia & South Carolina Coast", 6, list).map((c) => c.name).join() === "Beaufort");
check("coastal spot never sees Great Lakes cams", nearestCams(41.5, -82.9, "Florida Keys", 6, list).length === 0);
const far = nearestCamsWithDist(31.4, -87.58, "Florida Gulf Coast", 6, list);
check("far fallback flagged and single", far.length === 1 && far[0].far && far[0].miles > 60 && far[0].miles < 110);
check("beyond MAX_DEG is empty", nearestCams(28, -87.58, "Florida Gulf Coast", 6, list).length === 0);
check("haversine ~69 mi per degree", Math.abs(haversineMi(0, 0, 1, 0) - 69) < 1);
check("replay flag + name regex", camIsReplay({ replay: true, name: "x" }) && camIsReplay({ name: "Big Bay (Windy · replay)" }) && camIsReplay({ name: "Timelapse" }) && !camIsReplay({ name: "Harbor" }));
process.exit(failed ? 1 : 0);
