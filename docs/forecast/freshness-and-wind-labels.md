# Freshness, stale limits, wind labels and the NO DATA state

Owner: marine-data-scientist. Date: 2026-11-06. Source review: `docs/design/UX-REVIEW-2026-11.md` items N1, N2 and X4.

The app helps a boater decide. It does not promise that conditions are safe. Nothing in this doc changes that.

## 1. Wind figures (N1)

### Where each Sandusky number came from

| Place | Field | What it is |
|---|---|---|
| WIND stat tile (big number) | `wind.speedKt`, rounded | Sustained wind. Comes from the live buoy if it reports wind, otherwise the NWS daily period's upper figure (for example "10 to 15 mph" gives 15), otherwise this hour of the NWS hourly forecast. |
| Sticky header strip `.hdr-verdict` | `wind.speedKt`, rounded | The same field as the tile. |
| Reasons ("Wind ~19 kt") | `max(wind.speedKt, wind.gustKt)` | The gust when it is higher than the sustained wind. The text said "Wind" without saying it was a gust. |

The tile and the strip always read the same field. The review saw 18 kt on one and 16 kt on the other because the screenshots came from different page loads a few minutes apart (18:52 and 18:55), and buoy 45005 reported a new reading in between. On a single load both showed 16. The real inconsistency was the reason line, which showed the 19 kt gust and called it "Wind".

### What the verdict uses (unchanged)

- Lakes, bays and sounds: the stronger of sustained wind and gust (`topWind`). Breezy from 12 kt (CAUTION), windy from 17 kt (CAUTION), NO-GO from 22 kt.
- Ocean: sustained wind and gust are rated separately (15/20, 17/24, 22/28).
- The gust is the buoy gust when the buoy reports one. Otherwise it is the highest NWS grid gust for this hour or the next.

No thresholds changed.

### Labels now

- Reasons give both figures and their sources, matching the tile: "Windy: 16 kt, gusts 19 kt (buoy)" and "Breezy: 7 kt (buoy), gusts 16 kt (forecast)". The prefix (Light wind, Breezy, Windy, Strong wind) follows the same thresholds as before.
- The tile's label reads "WIND sustained". Its sub-line reads "W · gusts 19 · buoy 45005, 12 min ago". For forecast wind it reads "NWS forecast, tonight (top of range)" or "NWS forecast, this hour".
- The sticky strip shows "16 kt W, gusts 19" whenever the gust is higher, so it carries the number the verdict rates on.
- New API fields: `wind.basis` (`buoy`, `period`, `hour` or null) and `wind.periodName`.

The hour-by-hour table's Wind and Gusts rows are forecast values for each hour, so they can differ from a live buoy reading. Labelling that table is left open (section 6).

## 2. Freshness and stale limits (N2)

| Input | Fresh | Stale (amber notice, and never GO) | Already in place |
|---|---|---|---|
| Live buoy reading (only when it supplies wind, gust or waves) | under 120 min | 120 min or more | Readings 180 min or older are dropped by `fetchBuoy`, and the next buoy or the forecast is used |
| NWS forecast (oldest `updateTime` among the hourly, daily and gridpoint products) | under 18 h | 18 h or more | none |
| Page left open in the browser (`updatedAt`) | under 30 min | 30 min or more, amber notice only (the browser never changes the level) | none |

Defined in `functions/marine/conditions.js` as `STALE_LIMITS`. The response's `freshness.limits` sends them to the client.

Why these numbers:
- Buoy, 120 min. NDBC stations report every hour, and many C-MAN and shore stations every 10 min. A report usually reaches the realtime2 files 20 to 50 min after the observation. A reading 2 h old means at least one full report cycle was missed, and on Lake Erie a front can raise short steep chop well within 2 h. The 180 min drop limit is unchanged. This adds a "can't be GO" band from 120 to 179 min.
- Forecast, 18 h. NWS routine forecasts are issued at least twice a day (about 4 AM and 4 PM local for the zone and point forecasts), and forecasters update the grids between issuances. Normal age is 0 to about 13 h. 18 h means an issuance was missed or api.weather.gov is serving a stuck cache, which has happened before. A shorter limit would raise a false alarm every afternoon just before the PM issuance.
- An unknown issue time (the NWS sometimes omits `updateTime`) is not treated as stale. The page says "issue time not given".
- Page, 30 min. Gusts and imminent-hour hazards are re-evaluated on every fetch. The spot response is cached for about 5 min, so 30 min is several refresh cycles.

What the page shows:
- A line directly under the summary, for example: "Buoy 45005 (wind) · 12 min ago · NWS forecast issued 1:47 PM · checked 11:06 PM", or "No live buoy: forecast only · NWS forecast issued 4:10 AM · checked …". Ages are recomputed every minute from timestamps, so an open tab keeps counting.
- Over a limit: an amber notice "Data is 2 h 30 min old (buoy 45005 reading). Check before you go." with a Refresh button. For an old tab it reads "This page loaded 45 min ago."

### Could GO show on stale data before this change? Yes, in three ways

1. A buoy reading 120 to 179 min old fed the verdict as if it were current. A calm reading taken before a front could give GO.
2. Forecast age was never checked. A forecast from a stuck api.weather.gov cache, a day or more old, could still give GO.
3. A bug: the current wind came from `point[0]`, the first daily period, without checking its `endTime`. A stale or cached daily forecast could start with a period that had already ended (for example "This Afternoon" when it is now night), and that old period's wind stood in for the current wind. The fix uses the period that covers now. If no daily period covers now, it falls back to this hour of the hourly forecast (which is already filtered by time), and then to "no data".

All three are now fixed on the server. A stale input caps GO at CAUTION, with a reason giving the age and the summary "Data is out of date. Check before you go." (`recommendation.stale = true`). On a call that is already CAUTION or NO-GO, the age reason is added and the level stays. Directory tiles (`summaryTile`) show no call ("—") instead of GO when the grid is stale. The digest's "GO window" (`fetchTodayWindows`) gives no window when the grid is stale. On the spot page, the hourly strip and the week strip drop any GO hour or day to CAUTION (flagged `stale: true`) when the page's forecast age (the oldest of the hourly, daily and grid updates) is at or over the limit; this is applied after alerts, so an advisory still raises an hour or day to its own level. The Pro weekend-outlook email (`fetchWeeks`) applies the same GO → CAUTION cap (`capStaleGo`) when its grid is stale (`gridStale`, the grid's own age, since the week is built from the grid alone). `fetchSpotVerdict` (the GO alert email) inherits the headline cap.

## 3. NO DATA state (X4)

When no sustained wind and no wave data arrived (`noData`), and nothing else (an alert, a strong gust, a storm) pushed the call higher, the server still returns `level: "CAUTION"`. Emails, tiles and API consumers are unchanged and never see GO. It also now sets `recommendation.noData = true`.

The page shows that case as a neutral state:
- Label "NO DATA". It describes what is missing, it can't be read as a go-ahead, and it is short enough for every badge.
- Class `unknown`: neutral slate grey (`--text-muted` on the call card, `#5B6770` on solid badges with white text) and a dashed outline as a cue that doesn't rely on colour. Never green, never amber.
- Appears on the call card badge, the sticky strip (`.hdr-verdict.unknown`), the hero pill (Takeover gets the label "NO DATA", and its existing `vclass` maps that to `unknown`; CSS `.hv-badge.unknown`), the share text and the "Wrong call?" email.
- The summary stays "No live data right now. Check before you go."

### What the shared VerdictMark (X5) should show for it

- Input: `level == null` OR `noData === true` gives the "unknown" variant. Hourly, week and tile levels use `null` for no call. The headline uses `noData`.
- Shape: a circle with a "?" or an em dash inside, outline only (not filled). It must not reuse the check (GO), triangle (CAUTION) or octagon (NO-GO).
- Colour: neutral `--text-muted`. No success, warning or danger tokens.
- Word: "NO DATA" where a word fits. In compact slots where a letter is used (glance band, hour row), use "–" (an en dash), not "N" (which could be misread as "NO-GO").
- Accessible name: "No data: no call".
- Never animated or emphasised more than a real verdict.

## 4. Scenario table (expected level, before → after)

| # | Scenario | Before | After | Risk moves |
|---|---|---|---|---|
| 1 | Sandusky: buoy 16 kt gusting 19, waves 1 ft (fresh) | CAUTION, "Wind ~19 kt" | CAUTION, "Windy: 16 kt, gusts 19 kt (buoy)" | none (text only) |
| 2 | Lake, forecast 13 kt gusting 24 | NO-GO | NO-GO, "Strong wind: 13 kt, gusts 24 kt (forecast)" | none |
| 3 | Lake, buoy 7 kt, forecast gust 16 | CAUTION | CAUTION, "Breezy: 7 kt (buoy), gusts 16 kt (forecast)" | none |
| 4 | Ocean, 12 kt gusting 18, 2 ft at 10 s | GO | GO | none |
| 5 | Calm buoy (6 kt, 0.8 ft), 60 min old | GO | GO | none |
| 6 | Same calm buoy, 150 min old | GO | CAUTION (stale) | safer |
| 7 | Old temps-only station, forecast wind and waves | GO | GO (the old station doesn't feed the call) | none |
| 8 | Forecast-only calm, forecast updated 3 h ago | GO | GO | none |
| 9 | Forecast-only calm, forecast updated 20 h ago | GO | CAUTION (stale) | safer |
| 10 | Forecast with no `updateTime` | GO | GO, "issue time not given" | none |
| 11 | 25 kt, 5 ft, forecast 30 h old | NO-GO | NO-GO, plus age reason | none |
| 12 | Daily period 0 has ended (5 mph), current period 25-30 mph | about 4 kt from the expired period, GO possible | 26 kt, NO-GO | safer (bug fix) |
| 13 | Only an expired daily period, hourly says 9 mph | 4 kt from the expired period | 8 kt from the hourly forecast | correct figure. In principle this can also lower the wind if the expired period was windier, but that period wasn't describing now |
| 14 | Nothing received (no wind, no waves) | CAUTION shown amber | CAUTION, shown as grey "NO DATA" | none (presentation only) |
| 15 | No sustained wind, gust 24 | NO-GO | NO-GO (not NO DATA) | none |
| 16 | Directory tile, grid 20 h old, calm | GO | — (no call) | safer |
| 17 | Digest GO window, grid 20 h old | window listed | none | safer |

Scenarios 1-3, 5-7, 9, 11-12 and 14-17 are covered in `scripts/test-billing.mjs` (block "N1/N2/X4").

## 5. Sources

- NWS API (api.weather.gov): forecast and gridpoint products carry `updateTime` (the forecaster's last update), separate from `generatedAt` (when the API built the response). Staleness uses `updateTime`.
- NWS Directive 10-503 (WFO Public Weather Forecast Products) and NWSI 10-310 (Coastal Waters, Great Lakes Nearshore and Open Lakes Forecast Products): routine forecasts are issued at least twice a day and amended as needed.
- NOAA NDBC realtime data: standard meteorological reports are hourly, with 10-min data at many stations. Files update shortly after transmission.
- Lake and ocean wind and wave thresholds: unchanged. See comments in `buildRecommendation` and `waterProfile`.

## 6. Open

- The hour-by-hour Wind and Gusts rows are forecast values. Add a "forecast" caption to that table (frontend-engineer).
- The landing page's `.loc-status` prints "—" for no call. When VerdictMark lands, use the unknown variant there too (the landing page was out of scope).
- The forecast issue time is shown in the viewer's time zone, not the spot's. That's fine for local users. Revisit for cross-country viewers.
- Week strip (`buildWeek`) days are not capped on a stale grid. They are multi-day forecasts already. The amber notice on the page covers them.
