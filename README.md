# Lake Erie — Should I Boat?

A go/no-go boating conditions app for **Lake Erie**, from Toledo to Erie, PA.
Tap a launch spot and get a clear **GO / CAUTION / NO-GO** call backed by live
NOAA data, a wind-direction read, a weather map, and live webcams — everything
you need to decide whether to head out, in one place.

🌐 Live: _(custom domain — connect in Cloudflare Pages)_

## What it does

- **GO / CAUTION / NO-GO verdict** for 9 launch spots (Toledo, Port Clinton,
  Put-in-Bay, Sandusky, Vermilion, Cleveland, Fairport, Conneaut, Erie PA),
  tuned for small/mid recreational boats on Erie's short, steep chop.
- **Wind that never goes blank** — uses the live buoy, falling back to the NWS
  forecast when no buoy reports wind.
- **Waves that never go blank** — live wave buoys plus a forecast-wave fallback
  parsed from the NWS Nearshore Marine Forecast for the buoy-poor western basin.
- **Wind read** — plain-language guidance on what the wind *direction* means for
  Erie's south shore (onshore chop vs. deceptive offshore vs. long-fetch builds).
- **Weather map** — embedded Windy map per spot (wind / gusts / waves / radar).
- **Live webcams** — nearest embeddable Lake Erie cams, plus one-tap links to
  the rest.
- **Formal NOAA report** — the official NWS Nearshore Marine Forecast (NSH) text.

## Data sources (all free, no API key)

- **NWS api.weather.gov** — point forecast, marine alerts, NSH text product
- **NOAA NDBC buoys** — live wave height, wind, water temp (45005/45164/45167/45176/45207, …)
- **Windy** — embedded weather map
- Webcams — Angelcam, Pixelcaster, YouTube live, et al.

## Architecture (Cloudflare Pages + Functions)

```
index.html                      # the whole frontend (no build step)
functions/marine/conditions.js  # GET /marine/conditions  (runs on the edge)
```

- `?spots` → lists the launch spots
- `?spot=<id>` → full conditions + verdict for that spot

No build, no dependencies, no secrets. The edge Function reaches the NOAA hosts
(which the public web sometimes can't) and aggregates everything server-side.

## Deploy

Cloudflare **Pages → Connect to Git** → this repo · production branch `main` ·
framework preset **None** · no build command · output dir `/`. Pages auto-detects
`functions/` and deploys on every push. Add a custom domain under the project's
**Custom domains** tab.

## Local preview

```bash
npx wrangler pages dev .
```

(Use `wrangler pages dev` rather than a plain static server, so the `/marine`
Function runs.)
