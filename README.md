# Zoltiq website

Energy Intelligence for India: market data, research and strategies for India's power exchanges, and a door for asset owners.
Live at https://zoltiq.in (GitHub Pages, served from `master`; the `CNAME` file sets the domain).

Plain HTML, CSS and JavaScript. No build step.

Design: an energy control room, in black and white. Archivo (wide cut for headings) with JetBrains Mono for data labels,
rounded app-style panels and halftone illustrations of India's grid.
Light mode is paper and ink with one saffron accent; dark mode is night and gold. The site follows the
visitor's device setting and the header button switches it (remembered per browser). Sections alternate
plain and banded. Illustrations of India's grid come in a light and a dark version (`*-light.jpg`,
`*-dark.jpg`) and swap with the theme. The hero marks the 15-minute block India is trading right now (IST).

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
assets/js/home.js           Home page behaviour (hero crossfade, live IST block, document switcher, research deck)
assets/img/                 Illustrations (risograph style). `_source-illustrations.html` draws them; open it in a browser and call render(name, w, h) to redraw.
data/*.json                 Data the charts read
```

## Updating styles or scripts

Pages link to `assets/...?v=<number>` (currently `v=4`). After changing any file in `assets/`, bump that number in every page so browsers fetch the new file instead of a cached copy.

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
