# Partial-data cap: wind without waves is never GO

Reviewer: Marine Forecast & Safety Lead (marine-data-scientist)
Change under review: `buildRecommendation` in `functions/marine/conditions.js`, branch `claude/adoring-goodall-dlzvra`. It was reviewed as an uncommitted diff and has since landed unchanged as commit 7a32612. The "before" baseline is 2c63ef7.
Snapshot: a single live run on **2026-11-06, about 13:50 UTC**. This is late season, so several Great Lakes buoys are already pulled for the winter (45167 Erie, 45003 Alpena, 45198 Chicago and Michigan City, 45027 Duluth), and 45005 is reporting with no wave sensor.

## Problem

Wind is the decisive signal when wave data is missing, but it is not the only one. Before this change, `buildRecommendation` returned GO when it had sustained wind but `waves.ft == null`. That happens when every wave source is empty: no buoy wave sensor, no grid wave value for the current hour (or no hourly rows to carry it), and no number in the zone text. Issue #55 already capped the other half of the case (waves present, wind missing). Light wind with unknown seas is the most dangerous kind of false GO on the coasts. Swell is generated far away, so it does not scale with local wind. In this snapshot Port Canaveral and Sebastian Inlet had 5 ft forecast seas under 0 to 3 kt of buoy wind.

## Rule (as implemented)

In `buildRecommendation`, after the existing `noData` and wind-missing branches:

- `wind.speedKt != null && waves.ft == null` → bump to **CAUTION** with the reason "Wave data is unavailable right now. Check the NWS marine forecast before you launch". `bump` never lowers a level, so wind of 22 kt or more, or a warning, still gives NO-GO.
- Info only: when a buoy is present, `wind.source === "forecast"` and topWind < 12 kt, add the reason "Wind ~N kt from the NWS forecast (buoy not reporting wind)". The level does not change.

The rule is the same for all three profiles (lake, sheltered, ocean). This is a data-completeness gate, not a threshold, so the separate lake and ocean calibrations are untouched.

Direction of risk: **conservative only.** The cap can only raise GO to CAUTION, and only when wave data is absent.

## Logic review

- **Ordering with `noData`.** `noData` (no wave height and no sustained wind) is checked first and keeps its own summary, "No live data right now. Check before you go.". The wind-missing branch comes next and the new waves-missing branch last, so only one of the three "unavailable" reasons can fire. A lone gust with no waves is still `noData`.
- **Wind of 0 kt** (`speedKt: 0`) counts as wind present. It reaches the new branch and gives CAUTION with no wind line, which is correct.
- **Waves of 0 ft** (the grid often reports 0 in sheltered bays) count as present. 0 is not null, so Biscayne Bay, Tampa Bay and Kemah stay GO. That is correct.
- **Strong wind with no waves** keeps NO-GO. The "unavailable" reason is appended, which is harmless and accurate.
- **"Calm conditions reported"** can no longer print when waves are missing. That is correct.
- **Lake profile.** The light-wind line ("Wind ~N kt, light") still prints next to the cap. Tested.
- **Sheltered profile.** Behaves the same as lake. Tested.
- **Ocean profile (gap, non-blocking).** The ocean wind block has no "light" line, and the `else if` chain for light wind hangs off the non-ocean branch. On an ocean spot with light wind and no seas, the reasons therefore show only "Wave data is unavailable..." and no wind number. In the simulation, St. Augustine's reasons were exactly that one line. Recommended fix below.
- **Info-only forecast-wind line.** This line is in the same non-ocean `else if` chain, so it never prints on the ocean. The `wind.source === "forecast"` test implies `buoy.windKt == null`, so it is precise. In this snapshot it fired at 0 spots. The only waves-only buoy was Muskegon (45161), where forecast wind was 17 to 21 kt and already tagged "(forecast)".
- **Summary text.** When the only reason for the cap is missing data, the headline reads "Boatable with caution. Small boats take care.". That sentence makes a claim about conditions we have not measured. It is a mild version of promising safety, and it is inconsistent with the honest `noData` summary. The wind-missing path (#55) already has the same issue. Recommended fix below. I do not block on it because the reason line directly under the headline says the data is unavailable.
- **Other surfaces.**
  - Email: `fetchSpotVerdict` re-reads the headline, so GO alert emails now also refuse to say GO without waves. The digest GO trigger already required `waveFt != null`. Both are consistent.
  - Directory tiles and the hourly/week strips still go through `riskLevel`, which allows GO with `waveFt == null`. In a wave outage, a tile or `outlook.nowLevel` can say GO while the page headline says CAUTION. Today this cannot happen for curated spots, because the grid wave layer covered 72 of 72 hourly rows everywhere it existed. It is a follow-up item, not a blocker.

## Live before/after (90 curated spots)

Method: the HEAD copy of `conditions.js` (scratch copy) and the working-tree copy were both driven through `onRequest` against live api.weather.gov and ndbc.noaa.gov. A memoizing `fetch` gave both modules byte-identical upstream responses. The run used concurrency 4, a generic User-Agent and an in-memory KV.

Outcome:

| Transition | Count |
|---|---|
| GO → GO | 43 |
| CAUTION → CAUTION | 19 |
| NO-GO → NO-GO | 28 |
| **GO → CAUTION (flips)** | **0** |

In this snapshot every curated spot had a current-hour wave number: 12 from a buoy and 78 from the forecast. So **no spot flipped, and no spot sits at CAUTION permanently because of this change.** The info-only forecast-wind line fired at 0 spots.

Input mix (profile / wind source / wave source):

| Profile | Wind source | Wave source | Spots |
|---|---|---|---|
| lake | buoy | buoy | 9 |
| lake | buoy | forecast | 4 |
| lake | forecast | buoy | 1 (Muskegon, waves-only 45161) |
| lake | forecast | forecast | 20 |
| sheltered | buoy | forecast | 7 |
| sheltered | forecast | forecast | 1 |
| ocean | buoy | buoy | 2 |
| ocean | buoy | forecast | 42 |
| ocean | forecast | forecast | 4 |

53 of the "buoys" are wind-only stations (C-MAN/NOS such as LKWF1 and SAUF1, plus 45005 and SBIO1 on Erie). On those spots the forecast is the only wave source, so the new cap is what protects them in a wave-feed outage.

### Simulated wave outage (same live inputs, waves forced null)

To show what the rule actually guards against, I took a third live fetch and ran the old and new `buildRecommendation` on each spot's real inputs, with `waves` and the hourly `waveFt`/`periodSec` set to null and the hourly levels re-rated.

- 58 spots flip GO → CAUTION: 8 lake, 6 sheltered, 44 ocean.
- **In 15 of those 58, the real verdict with waves was CAUTION.** The old code would have shown **GO** during an outage at all 15. Examples: Port Canaveral (5 ft seas, 0 to 1 kt wind), Sebastian Inlet (5 ft, 3 to 4 kt), St. Augustine, Jacksonville, Ponce Inlet, Fort Pierce, St. Simons, Oregon Inlet and San Juan (4 ft each), Santa Barbara (6.2 ft buoy), plus Duluth, Grand Marais, Sackets Harbor, Biloxi and Charleston (2 ft each).
- No spot moved down. The NO-GO and CAUTION calls driven by wind, alerts or storms were unchanged.

This is the core justification. On swell coasts, light wind tells you nothing about seas.

## Spots structurally exposed to the cap (not flipped today)

These spots have a short fallback chain for waves. When a single source drops, they will show CAUTION, which is the correct behaviour.

1. **Vermilion / Lorain (lake, LEZ144): structural gap.** Its point (41.47, -82.31) is a marine grid cell. `gridpoints/CLE/62,62/forecast/hourly` returns 404 "Marine Forecast Not Supported", and the spot has no `sea` bearing for the shore-nudge fallback. The page therefore has **no hourly rows**. Grid waves never reach the verdict, even though the raw grid has wave values, and there is no hourly fallback wind. Today the waves come from buoy 45176 and the wind from the buoy. When 45176 is pulled, waves fall back to the LEZ144 NSH text, which parses ("Waves 2 to 4 feet"), and wind depends on 45164. I checked that a nudge to 41.43, -82.31 returns a 200 hourly forecast. **Recommendation:** add `sea: 0` (the lake lies to the north) to the Vermilion entry. That is a separate change, because adding the hourly strip can move the verdict either way.
2. **20 spots where the zone text yields no wave number**, so the grid's current hour is their only non-buoy wave source: chicago, houghton (no zone periods at all), middle-river, bath-nc, biscayne-bay, tampa-bay, kemah, hilton-head, tybee, morehead-city, charleston, murrells-inlet, wrightsville, newport-beach, oregon-inlet, marina-del-rey, dana-point, channel-islands, long-beach, santa-barbara. Causes:
   - **Parser does not recognise "ft"** (pre-existing bug). `periodWaveFt` matches only "feet" or "foot". CWF coastal products and some Great Lakes offices write "Seas 3 to 4 ft" or "Waves 5 to 8 ft". The same parser feeds `applyMarineWaveFloor`, so **the nearshore floor is also silently skipped at these spots**. That can under-call waves, and it is the larger risk. It is separate from this change and needs its own review.
   - Descriptive wording with no number: "Light chop", "Bay waters smooth", "Bay and inland waters..." (biscayne-bay, tampa-bay, kemah, bath-nc).
3. **Transient only.** At every other spot the wave value comes from at least the grid plus a parseable zone text, so a CAUTION from this cap means a real feed outage.

User-built pages (in KV, not enumerated here) on small bays or rivers may have no grid wave cell and no numeric text. Those would now sit at CAUTION permanently. That is the intended behaviour under rule 1, but expect "why is it always CAUTION?" support tickets. The reason line explains it.

## False-CAUTION risk

- Today: none. Under a real outage, CAUTION is the correct call.
- Structural: possible on user-built inland or estuary pages, and at Vermilion if its buoy and the NSH both lapse. Mitigation: the parser fix and the Vermilion `sea` fix above. We will not mitigate it by relaxing the rule.
- Headline/tile disagreement during a wave outage, as described in the logic review above.

## Requested changes

Non-blocking. Ship the cap as is and follow up with these:

1. **Partial-data summary** (copy and safety, small). Do not say "Boatable" when the only reason for CAUTION is missing data:
   ```js
   let partial = false;
   // in each of the two partial-data branches, before bump():
   partial = level === "GO";
   const summary = noData ? "No live data right now. Check before you go."
     : partial ? "Incomplete data right now. Check before you go."
     : { GO: ..., CAUTION: ..., "NO-GO": ... }[level];
   ```
   This covers both the wind-missing and the waves-missing paths. Add tests for both.
2. **Ocean light-wind line when seas are missing.** In the ocean wind block add `else if (wv == null) reasons.push(\`Wind ~${desc}, light\`)` so the wind number is visible. Info only.
3. **Separate reviews:**
   - Add "ft" to `periodWaveFt`, using `f(?:ee|oo)?t` anchored after a digit. This raises waves through the nearshore floor, so risk moves conservative. Before/after work is needed.
   - Add `sea: 0` to Vermilion.
   - Decide whether `riskLevel` should withhold GO on lake and sheltered hours with `waveFt == null`, to align the tiles and strip with the headline. Watch the far week days, where the wave grid may end.

## Test scenarios → expected level

| Scenario | Profile | Expected |
|---|---|---|
| Wind 7 kt (buoy), waves null | lake | CAUTION + "Wave data is unavailable" + "Wind ~9 kt, light" |
| Forecast wind 6 kt, waves null, no buoy | lake / sheltered / ocean | CAUTION |
| Wind 24 kt, waves null | lake | NO-GO |
| Wind 0 kt, waves null | any | CAUTION |
| Wind 7 kt, waves 1 ft | lake | GO, no "unavailable" line |
| Wind 5 kt, waves 0 ft (grid) | sheltered | GO |
| Waves-only buoy 1 ft, forecast wind 8 kt | lake | GO + "Wind ~8 kt from the NWS forecast (buoy not reporting wind)" |
| Waves 1 ft buoy, wind null | lake | CAUTION ("Live wind data is unavailable") |
| Wind null, waves null | any | CAUTION, summary "No live data right now" |
| Gale Warning, waves null | any | NO-GO |

`npm test`: 370 passed, 0 failed.

## Sign-off

**Approved.** The change moves risk only toward caution and closes a real false-GO path. The simulated outage shows that path would have shown GO at 15 spots that were actually CAUTION. Live impact today is 0 flips. The requested changes above are follow-ups, not blockers.

## Appendix: per-spot table (live run, 2026-11-06 ~13:50 UTC)

"Outage sim" is a later fetch on the same morning, with waves forced null.

| Spot | Region | Profile | Buoy | Wind src | Wave src | Before | After | Reasons added | Outage sim (old → new) |
|---|---|---|---|---|---|---|---|---|---|
| toledo | Lake Erie | lake | 45005 | buoy | forecast (4 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| put-in-bay | Lake Erie | lake | SBIO1 | buoy | forecast (4 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| sandusky | Lake Erie | lake | 45005 | buoy | forecast (4 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| port-clinton | Lake Erie | lake | 45005 | buoy | forecast (4 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| cleveland | Lake Erie | lake | 45164 | buoy | buoy (3.6 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| fairport | Lake Erie | lake | 45207 | buoy | buoy (3.3 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| vermilion | Lake Erie | lake | 45176 | buoy | buoy (3.6 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| conneaut | Lake Erie | lake | 45207 | buoy | buoy (3.3 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| rochester | Lake Ontario | lake | 45012 | buoy | buoy (1.3 ft) | GO | GO | none | GO → CAUTION |
| sodus-bay | Lake Ontario | lake | 45012 | buoy | buoy (1.3 ft) | GO | GO | none | GO → CAUTION |
| erie | Lake Erie | lake | none | forecast | forecast (4 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| sackets-harbor | Lake Ontario | lake | none | forecast | forecast (2 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| olcott | Lake Ontario | lake | none | forecast | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| oswego | Lake Ontario | lake | 45012 | buoy | buoy (1.3 ft) | GO | GO | none | GO → CAUTION |
| port-huron | Lake Huron | lake | none | forecast | forecast (3 ft) | CAUTION | CAUTION | none | CAUTION → CAUTION |
| tawas | Lake Huron | lake | none | forecast | forecast (8 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| harbor-beach | Lake Huron | lake | none | forecast | forecast (5 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| alpena | Lake Huron | lake | none | forecast | forecast (9 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| mackinaw | Lake Michigan | lake | none | forecast | forecast (8 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| muskegon | Lake Michigan | lake | 45161 | forecast | buoy (3.6 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| chicago | Lake Michigan | lake | none | forecast | forecast (5 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| milwaukee | Lake Michigan | lake | 45013 | buoy | buoy (5.2 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| holland | Lake Michigan | lake | none | forecast | forecast (8 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| traverse-city | Lake Michigan | lake | none | forecast | forecast (7 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| michigan-city | Lake Michigan | lake | none | forecast | forecast (12 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| harbor-springs | Lake Michigan | lake | none | forecast | forecast (7 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| petoskey | Lake Michigan | lake | none | forecast | forecast (7 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| sheboygan | Lake Michigan | lake | none | forecast | forecast (6 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| duluth | Lake Superior | lake | none | forecast | forecast (2 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| cross-village | Lake Michigan | lake | none | forecast | forecast (7 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| bayfield | Lake Superior | lake | none | forecast | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| marquette | Lake Superior | lake | 45004 | buoy | buoy (5.9 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| grand-marais | Lake Superior | lake | none | forecast | forecast (2 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| houghton | Lake Superior | lake | none | forecast | forecast (0 ft) | CAUTION | CAUTION | none | CAUTION → CAUTION |
| middle-river | Chesapeake Bay | sheltered | FSKM2 | buoy | forecast (0 ft) | CAUTION | CAUTION | none | CAUTION → CAUTION |
| bath-nc | Pamlico Sound | sheltered | none | forecast | forecast (0 ft) | CAUTION | CAUTION | none | CAUTION → CAUTION |
| ponce-inlet | Florida Atlantic Coast | ocean | 41069 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| st-augustine | Florida Atlantic Coast | ocean | SAUF1 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| jacksonville | Florida Atlantic Coast | ocean | MYPF1 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| port-canaveral | Florida Atlantic Coast | ocean | TRDF1 | buoy | forecast (5 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| fort-pierce | Florida Atlantic Coast | ocean | 41068 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| sebastian-inlet | Florida Atlantic Coast | ocean | SIPF1 | buoy | forecast (5 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| jupiter | Florida Atlantic Coast | ocean | LKWF1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| palm-beach | Florida Atlantic Coast | ocean | LKWF1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| fort-lauderdale | Florida Atlantic Coast | ocean | PEGF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| miami | Florida Atlantic Coast | ocean | VAKF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| key-largo | Florida Keys | ocean | none | forecast | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| islamorada | Florida Keys | ocean | WRBF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| marathon | Florida Keys | ocean | VCAF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| biscayne-bay | Florida Atlantic Coast | sheltered | VAKF1 | buoy | forecast (0 ft) | GO | GO | none | GO → CAUTION |
| key-west | Florida Keys | ocean | KYWF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| marco-island | Florida Gulf Coast | ocean | RKXF1 | buoy | forecast (0 ft) | GO | GO | none | GO → CAUTION |
| naples | Florida Gulf Coast | ocean | RKXF1 | buoy | forecast (0 ft) | GO | GO | none | GO → CAUTION |
| sarasota | Florida Gulf Coast | ocean | VENF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| tampa-bay | Florida Gulf Coast | sheltered | SAPF1 | buoy | forecast (0 ft) | GO | GO | none | GO → CAUTION |
| fort-myers-beach | Florida Gulf Coast | ocean | FMRF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| clearwater | Florida Gulf Coast | ocean | CWBF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| pensacola | Florida Gulf Coast | ocean | PCLF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| panama-city | Florida Gulf Coast | ocean | PCBF1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| destin | Florida Gulf Coast | ocean | none | forecast | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| orange-beach | Alabama & Mississippi Coast | ocean | PPTA1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| grand-isle | Louisiana & Texas Coast | ocean | GISL1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| mobile-bay | Alabama & Mississippi Coast | sheltered | WKXA1 | buoy | forecast (1 ft) | GO | GO | none | GO → CAUTION |
| biloxi | Alabama & Mississippi Coast | sheltered | PTBM6 | buoy | forecast (2 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| galveston | Louisiana & Texas Coast | ocean | GTOT2 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| port-aransas | Louisiana & Texas Coast | ocean | MIST2 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| st-simons | Georgia & South Carolina Coast | ocean | SAXG1 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| kemah | Louisiana & Texas Coast | sheltered | EPTT2 | buoy | forecast (0 ft) | GO | GO | none | GO → CAUTION |
| south-padre | Louisiana & Texas Coast | ocean | BZST2 | buoy | forecast (3 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| tybee | Georgia & South Carolina Coast | ocean | FPKG1 | buoy | forecast (3 ft) | GO | GO | none | GO → CAUTION |
| hilton-head | Georgia & South Carolina Coast | ocean | FPKG1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| murrells-inlet | Georgia & South Carolina Coast | ocean | MROS1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| charleston | Georgia & South Carolina Coast | sheltered | CHTS1 | buoy | forecast (2 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| wrightsville | North Carolina Coast | ocean | JMPN7 | buoy | forecast (3 ft) | GO | GO | none | GO → CAUTION |
| morehead-city | North Carolina Coast | ocean | BFTN7 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| oregon-inlet | North Carolina Coast | ocean | ORIN7 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| oceanside | Southern California Coast | ocean | none | forecast | forecast (3 ft) | GO | GO | none | GO → CAUTION |
| san-diego | Southern California Coast | ocean | TIXC1 | buoy | forecast (3 ft) | GO | GO | none | GO → CAUTION |
| dana-point | Southern California Coast | ocean | none | forecast | forecast (3 ft) | GO | GO | none | GO → CAUTION |
| mission-bay | Southern California Coast | ocean | LJAC1 | buoy | forecast (3 ft) | GO | GO | none | GO → CAUTION |
| newport-beach | Southern California Coast | ocean | PRJC1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| marina-del-rey | Southern California Coast | ocean | ICAC1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| long-beach | Southern California Coast | ocean | PRJC1 | buoy | forecast (2 ft) | GO | GO | none | GO → CAUTION |
| channel-islands | Southern California Coast | ocean | 46025 | buoy | buoy (3.6 ft) | GO | GO | none | GO → CAUTION |
| honolulu | Hawaii | ocean | OOUH1 | buoy | forecast (9 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| kona | Hawaii | ocean | KWHH1 | buoy | forecast (7 ft) | NO-GO | NO-GO | none | CAUTION → CAUTION |
| maalaea | Hawaii | ocean | KLIH1 | buoy | forecast (3 ft) | NO-GO | NO-GO | none | NO-GO → NO-GO |
| san-juan | Puerto Rico | ocean | 41053 | buoy | forecast (4 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| santa-barbara | Southern California Coast | ocean | 46053 | buoy | buoy (6.2 ft) | CAUTION | CAUTION | none | GO → CAUTION |
| fajardo | Puerto Rico | ocean | 41056 | buoy | forecast (3 ft) | GO | GO | none | GO → CAUTION |

## Follow-ups applied in this PR

- **Summary text (follow-up 1):** when missing data is the only thing that raised GO to CAUTION, whether wind or waves is the missing half, the summary now reads "Incomplete data right now. Check before you go." It no longer says "Boatable with caution…". When the conditions themselves justify CAUTION (e.g. 18 kt wind with waves missing), the normal CAUTION summary stays. Tests cover both cases.
- **Ocean wind line (follow-up 2):** the ocean wind block now prints `Wind ~N kt, light` when seas are missing, so the wind number isn't lost. This adds a reason only and doesn't change the level.
- Follow-up 3 (the `periodWaveFt` "ft" parsing, Vermilion `sea: 0`, and `riskLevel` withholding GO when wave data is missing) is left to separate changes, each with its own review.
