# Zoltiq website

Energy Intelligence for India: market data, research and strategies for India's power exchanges, and a door for asset owners.
Live at https://zoltiq.in (GitHub Pages, served from `master`; the `CNAME` file sets the domain).

Plain HTML, CSS and JavaScript. No build step.

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
assets/js/hero.js           Home hero animation
data/*.json                 Data the charts read
```

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
