# Zoltiq website

Energy Intelligence for India: market data, research and strategies for India's power exchanges, and a door for asset owners.
Live at https://zoltiq.in (GitHub Pages, served from `master`; the `CNAME` file sets the domain).

Plain HTML, CSS and JavaScript. No build step.

Design: one Indian day on the grid. The Home hero plays a full day (night, dawn, midday, golden hour,
sunset) behind a line of pylons; the sections below continue it as you scroll (morning, midday, golden hour,
sunset, dusk, then night with stars at the footer). Each other page opens on the same sky frozen at its own
hour (Research at dawn, Markets at noon, Index at golden hour, Strategies at sunset, For asset owners at night).
Section colours are set by the `.sky-*` classes in `site.css`. Type: Archivo, with JetBrains Mono for data labels.

## Structure

```
index.html                  Home
battery-index/index.html    Zoltiq Battery Index        (placeholder page for now)
markets/index.html          Markets dashboards          (placeholder page for now)
research/index.html         Research notes              (placeholder page for now)
strategies/index.html       Strategies: results, not rules (placeholder page for now)
asset-owners/index.html     For asset owners + estimate (placeholder page for now)
assets/css/site.css         Shared design system
assets/js/site.js           Shared behaviour and site settings (contact email, form endpoint)
assets/js/charts.js         Small SVG chart helpers
assets/js/home.js           Home page behaviour (live IST block, document switcher, research deck, charts)
assets/js/hero.js           Hero animation: the sky changes colour through one day (night, dawn, midday, golden hour, sunset), with sun, moon, stars and city lights, while the day's 96 blocks light up
assets/img/                 Illustrations (risograph style). `_source-illustrations.html` draws them; open it in a browser and call render(name, w, h) to redraw.
data/*.json                 Data the charts read
```

## Updating styles or scripts

Pages link to `assets/...?v=<number>` (currently `v=8`). After changing any file in `assets/`, bump that number in every page so browsers fetch the new file instead of a cached copy.

## Data

Charts read `data/*.json`. Each file currently holds a **sample shape** with `"sample": true` and unitless values, not prices.
To go live with real numbers, have the `power_market` pipeline write the same files with real values (₹/MWh etc.) and `"sample": false`.
Every on-page figure is a placeholder such as `₹[X]`, `[date]` or `[Month YYYY]` until then.

## Forms and email

Forms post to the endpoint in `assets/js/site.js` (`formEndpoint`, FormSubmit). The site shows `hello@zoltiq.in`.
That mailbox (or forwarding to an existing inbox) must exist, and FormSubmit's one-time activation email must be clicked, before forms deliver.

## Rules for content

- Never publish invented numbers. Use placeholders until real backtest or market data is connected.
- Sample charts must be labelled as sample.
- Strategy rules are not published, only results.
- Backtested results are not a guarantee of future returns.
