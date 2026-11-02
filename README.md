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
index.html                       Home: hero, the latest day's sheet, Index, strategies, research
battery-index/index.html         Zoltiq Battery Index: headline, history, every battery x strategy, method, CSV
markets/index.html               Markets: any of the last 60 days block by block, spreads, month table, CSV
research/index.html              Research notes
research/one-pm-ten-pm-rule/     First note: the 1pm / 10pm rule
strategies/index.html            Strategies: cumulative earnings, the ladder, findings, cards
asset-owners/index.html          Battery estimate on last year's prices, and the estimate request form
assets/css/site.css              Shared design system (incl. panels, charts, tables)
assets/js/site.js                Shared behaviour and site settings (contact email, form endpoint)
assets/js/charts.js              SVG charts (line, bar, with hover), tables, controls, CSV download, formats
assets/js/home.js                Home page behaviour and live data
assets/js/index-page.js          Battery Index page
assets/js/markets-page.js        Markets page
assets/js/strategies-page.js     Strategies page
assets/js/owners-page.js         For asset owners page
assets/js/note-1pm.js            Charts in the 1pm / 10pm note
assets/js/hero.js                Hero animation (the Home hero's 96 bars take the latest day's real prices)
assets/img/                      Illustrations (risograph style). `_source-illustrations.html` draws them.
data/                            Data the pages read (built by tools/build_data.py; see Data)
tools/build_data.py              Builds data/ from IEX prices and the battery backtester
.github/workflows/refresh-data.yml   Daily rebuild of data/, committed to master
```

## Updating styles or scripts

Pages link to `assets/...?v=<number>` (currently `v=9`). After changing any file in `assets/`, bump that number in every page so browsers fetch the new file instead of a cached copy.

## Data

Every figure on the site is real: IEX prices, and backtests of them. Nothing is a placeholder.

| File | What it holds |
|---|---|
| `data/market-snapshot.json` | The latest delivery day complete in both markets: 96 day-ahead and real-time prices (₹/MWh) and the day's stats |
| `data/markets.json` | The last 60 days block by block (DAM, RTM, G-DAM, HP-DAM), every day's summary since Apr 2022, and a month table |
| `data/backtests.json` | Every run: 2-hour and 4-hour battery × day-ahead, real-time and both × seven strategies × 1 or 2 cycles × charging any hour or 10:00–15:00 only. Monthly ₹ per MW and summaries |
| `data/battery-index.json` | The headline Index series |
| `data/research/*.json` | Figures for research notes |

**Sources.**
- Prices: IEX day-ahead and real-time 15-minute results. Apr 2022 – Sep 2026 from the raw snapshot pages kept in `power_market/raw/`; later days from the Dhruva terminal's daily CSVs (`power_price_terminal/data/`), which match the snapshot pages block for block. G-DAM and HP-DAM from the terminal's CSVs (from Apr 2024).
- Backtests: `power_market/bess.py` (battery model, exact optimiser, strategies, no look-ahead).

**The Index** is the 7-day average plan (B2) on day-ahead for a 100 MW / 200 MWh battery, 1 cycle a day, 87% round trip, 10–90% charge, ₹20/MWh fees each side and ₹300/MWh wear, summed per calendar month and divided by power: ₹ per MW per month.

**Rebuild locally:**

```bash
cd ../power_market && python bess.py init && python bess.py ingest raw/ && python bess.py ingest-csv ../power_price_terminal/data
cd ../power_market_website && python tools/build_data.py --backtester ../power_market --terminal ../power_price_terminal
```

The first build simulates every run (about an hour). Results are cached in `tools/.cache/` (git-ignored), so later builds only simulate new days.
`--markets-only` rebuilds the market files alone in seconds.

**Daily refresh.** `.github/workflows/refresh-data.yml` runs every evening: it checks out both repositories, rebuilds `data/` and commits it to `master`. It uses `power_market` at `BACKTESTER_REF` (`main`), which must include the `ingest-csv` command and the `S1` rule.

## Forms and email

Forms post to the endpoint in `assets/js/site.js` (`formEndpoint`, FormSubmit). The site shows and delivers to `zoltiqenergy@gmail.com`.
FormSubmit sends a one-time activation email to that inbox on the first submission; click it before forms deliver.

## Rules for content

- Never publish invented numbers. Every figure comes from `data/`.
- Baseline strategies are published in full; Zoltiq's own strategies are published as results only.
- Backtested results are not a guarantee of future returns.
- Founder names, the year founded and the city are left off until they are confirmed.
