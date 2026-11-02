"""Build the site's data/*.json from real IEX prices and the battery backtester.

    python tools/build_data.py --backtester ../power_market --terminal ../power_price_terminal

Inputs
  --backtester  a checkout of power_market. Its bess.py holds the battery model, the optimiser
                and every strategy; its power.db holds IEX day-ahead and real-time blocks
                (build it with `python bess.py init && python bess.py ingest raw/ &&
                python bess.py ingest-csv <terminal>/data`).
  --terminal    a checkout of power_price_terminal (Dhruva). Its data/ folder holds the
                daily-refreshed IEX month CSVs, including green and high-price day-ahead.

Outputs (all in data/, read by the pages)
  market-snapshot.json   the latest complete delivery day, 96 blocks, day-ahead and real-time
  markets.json           the last 60 days block by block (DAM, RTM, G-DAM, HP-DAM), every day's
                         summary since Apr 2022, and a month-by-month table
  backtests.json         every battery x market x strategy x cycle x charging-rule run:
                         monthly earnings per MW and summary metrics
  battery-index.json     the headline Zoltiq Battery Index series (a slice of backtests.json)
  research/day-ahead-or-real-time.json   figures for the first research note

Nothing is invented: every number comes from IEX prices through the backtester.
Backtest results are cached in tools/.cache so a daily run only simulates new days.
"""

import argparse
import calendar
import csv
import gzip
import hashlib
import json
import pickle
import sys
import warnings
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np

SITE = Path(__file__).resolve().parent.parent
DATA = SITE / "data"
CACHE = Path(__file__).resolve().parent / ".cache"
IST = timezone(timedelta(hours=5, minutes=30))

SOLAR = (37, 64)      # blocks 37-64: 09:00-16:00
EVENING = (73, 88)    # blocks 73-88: 18:00-22:00

DURATIONS = {"2h": 200.0, "4h": 400.0}   # 100 MW battery; energy in MWh
CHARGING = {"any": None, "solar": (41, 60)}  # solar = charging only 10:00-15:00
WEAR = 300.0

STRATEGIES = {  # id -> public name, short description
    "PH": ("Perfect hindsight", "The best schedule possible, with every price known in advance. A ceiling, not achievable."),
    "B2": ("7-day average plan", "Plans each day on the average of the last 7 days' prices known at bid time."),
    "B4": ("Yesterday's prices", "Plans each day on the most recent day's prices known at bid time."),
    "B3": ("Same day last week", "Plans each day on the prices of the same weekday one week earlier."),
    "B1": ("Monthly windows", "Picks one charge window and one sell window each month from the last 90 days, then repeats them."),
    "B0": ("Fixed 11:00 / 18:00", "Charges from 11:00 and sells from 18:00 every day."),
    "T1": ("Day-ahead plan, corrected in real-time", "Commits the 7-day average plan in day-ahead at noon; at 22:00, re-plans on a blend of the next day's day-ahead prices and last week's real-time prices, and trades the difference in real-time."),
    "XF": ("Best market per block, chosen ahead", "At noon the day before, buys each block in whichever market last week's prices say is cheaper and sells in the dearer."),
}
SINGLE = ["PH", "B2", "B4", "B3", "B1", "B0"]       # strategies run in one market at a time
BOTH = ["PH", "T1", "XF"]                           # strategies that use both markets
MARKET_NAMES = {"DAM": "Day-ahead", "RTM": "Real-time", "BOTH": "Day-ahead + real-time"}
HEADLINE = "2h|DAM|B2|c1|any"
CEILING_OF = lambda key: "|".join([*key.split("|")[:2], "PH", *key.split("|")[3:]])


def r(x, nd=1):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), nd)


def arr(a, nd=2):
    return [None if not np.isfinite(v) else round(float(v), nd) for v in a]


# ------------------------------------------------------------------ inputs

def load_terminal(terminal, folder):
    """{date: (prices[96], volumes[96])} from the terminal's month CSVs; NaN where nothing cleared."""
    out = {}
    for path in sorted((Path(terminal) / "data" / folder).glob("????-??.csv")):
        with path.open(newline="") as f:
            for row in csv.DictReader(f):
                d, b = row["date"], int(row["block"])
                p, v = out.setdefault(d, (np.full(96, np.nan), np.full(96, np.nan)))
                p[b - 1] = float(row["mcp"]) if row["mcp"] not in ("", None) else np.nan
                v[b - 1] = float(row["mcv_mw"]) if row["mcv_mw"] not in ("", None) else np.nan
    return out


def day_stats(p, v=None):
    if p is None or not np.isfinite(p).any():
        return None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        solar = np.nanmean(p[SOLAR[0] - 1:SOLAR[1]])
        eve = np.nanmean(p[EVENING[0] - 1:EVENING[1]])
        vw = np.nansum(p * v) / np.nansum(np.where(np.isfinite(p), v, np.nan)) if v is not None else np.nan
    hi, lo = int(np.nanargmax(p)), int(np.nanargmin(p))
    return {"avg": r(np.nanmean(p), 0), "vwap": r(vw, 0), "solar": r(solar, 0), "evening": r(eve, 0),
            "spread": r(eve - solar, 0), "max": r(p[hi], 0), "max_block": hi + 1, "min": r(p[lo], 0),
            "min_block": lo + 1, "at_cap": int(np.sum(p >= 9999.5)), "blocks": int(np.isfinite(p).sum())}


# ------------------------------------------------------------------ backtests

SIM_VERSION = "2"  # bump when the run matrix or the stored fields change


def code_hash(bess):
    return hashlib.sha256(Path(bess.__file__).read_bytes() + SIM_VERSION.encode()).hexdigest()[:12]


def run_matrix():
    for dur, energy in DURATIONS.items():
        for charge in CHARGING:
            for market in ("DAM", "RTM", "BOTH"):
                strategies = BOTH if market == "BOTH" else SINGLE
                for s in strategies:
                    for c in ((1,) if s in ("B0", "B1") else (1, 2)):
                        yield f"{dur}|{market}|{s}|c{c}|{charge}", energy, market, s, c, CHARGING[charge]


def simulate(bess, days, P, V, eval_from):
    """Daily results for every run. Days are independent, so cached days are reused and only
    new days are simulated (from a month boundary 4 months earlier, so B1's windows match)."""
    CACHE.mkdir(exist_ok=True)
    cache_file = CACHE / f"runs_{code_hash(bess)}.pkl"
    cache = pickle.loads(cache_file.read_bytes()) if cache_file.exists() else {}
    fields = ["profit_rs", "sell_revenue_rs", "buy_cost_rs", "fees_rs", "wear_rs", "sold_mwh", "bought_mwh", "cycles"]
    # fingerprint each day's prices and volumes, so a revised day is re-simulated
    fp = [hashlib.md5(np.nan_to_num(np.concatenate([P[m][i] for m in ("DAM", "RTM")] +
                                                   [V[m][i] for m in ("DAM", "RTM")]), nan=-1).tobytes()).hexdigest()
          for i in range(len(days))]
    out = {}
    for key, energy, market, s, c, charge in run_matrix():
        bat = bess.Battery(energy_mwh=energy, wear_rs_mwh=WEAR, max_cycles=c, charge_blocks=charge)
        hit = cache.get(key)
        start = same = 0
        if hit:
            same = 0
            for i, d in enumerate(hit["days"]):
                if i < len(days) and days[i] == d and fp[i] == hit["fp"][i]:
                    same = i + 1
                else:
                    break
            if same >= len(days):
                out[key] = hit
                continue
            first_new = date.fromisoformat(days[same]) if same < len(days) else None
            back = (first_new - timedelta(days=125)).replace(day=1)
            start = max(0, days.index(max(back.isoformat(), days[0])))
        sl = slice(start, None)
        res = bess.run_baseline(s, market, bat, days[sl], {m: P[m][sl] for m in P}, {m: V[m][sl] for m in V})
        new = {k: np.asarray(res[k], dtype=float) for k in fields}
        if hit and start:
            # keep the cached days; take new days only from well inside the slice
            merged = {k: np.concatenate([hit[k][:same], new[k][same - start:]]) for k in fields}
        else:
            merged = new
        merged.update(days=list(days), fp=fp)
        out[key] = merged
        cache[key] = merged
        print(f"  {key:24} simulated from {days[start]}", file=sys.stderr)
    cache_file.write_bytes(pickle.dumps(cache))
    for old in CACHE.glob("runs_*.pkl"):
        if old != cache_file:
            old.unlink()
    return out


def summarise(runs, days, eval_from, last_month_end):
    """Monthly ₹/MW and summary metrics for every run."""
    d = np.array(days)
    ev = (d >= eval_from) & (d <= last_month_end)
    months = sorted({x[:7] for x in d[ev]})
    month_idx = {m: np.where((np.char.startswith(d.astype(str), m)) & ev)[0] for m in months}
    years = sorted({m[:4] for m in months})
    last12 = months[-12:]
    last24 = months[-24:]
    power = 100.0

    def per_mw_year(profit, n):
        return profit / 1e5 / power / (n / 365.25)

    out = {}
    for key, res in runs.items():
        p = res["profit_rs"]
        ceil = runs[CEILING_OF(key)]["profit_rs"] if CEILING_OF(key) in runs else None
        both = "|".join([key.split("|")[0], "BOTH", "PH", key.split("|")[3], key.split("|")[4]])
        xceil = runs[both]["profit_rs"] if both in runs else None

        def window(ms):
            idx = np.concatenate([month_idx[m] for m in ms])
            prof = p[idx].sum()
            row = {"lakh_mw_yr": r(per_mw_year(prof, len(idx)), 2), "days": int(len(idx))}
            if ceil is not None:
                row["capture"] = r(prof / ceil[idx].sum(), 3)
            if xceil is not None:
                row["capture_both"] = r(prof / xceil[idx].sum(), 3)
            return row

        all_idx = np.concatenate([month_idx[m] for m in months])
        sold, bought = res["sold_mwh"][all_idx].sum(), res["bought_mwh"][all_idx].sum()
        monthly = [r(p[month_idx[m]].sum() / power, 0) for m in months]  # ₹ per MW in the month
        worst = int(np.argmin(monthly))
        out[key] = {
            "monthly_rs_mw": monthly,
            "all": window(months), "last_12m": window(last12), "last_24m": window(last24),
            "by_year": {y: window([m for m in months if m.startswith(y)]) for y in years},
            "losing_days": r((p[all_idx] < 0).mean(), 3),
            "cycles_per_day": r(res["cycles"][all_idx].mean(), 2),
            "avg_sell": r(res["sell_revenue_rs"][all_idx].sum() / sold, 0) if sold else None,
            "avg_buy": r(res["buy_cost_rs"][all_idx].sum() / bought, 0) if bought else None,
            "worst_month": months[worst], "worst_month_rs_mw": monthly[worst],
            "best_month": months[int(np.argmax(monthly))], "best_month_rs_mw": max(monthly),
        }
    return months, out


# ------------------------------------------------------------------ research: day-ahead or real-time?

def research_waiting(runs, days, P, eval_from, last_day):
    """Figures for the note 'Day-ahead or real-time? What waiting is worth' (2-hour battery, 1 cycle)."""
    d = np.array(days)
    ev = (d >= eval_from) & (d <= last_day)
    idx = np.where(ev)[0]
    keys = {"da": "2h|DAM|B2|c1|any", "da_ph": "2h|DAM|PH|c1|any", "rt": "2h|RTM|B2|c1|any", "rt_ph": "2h|RTM|PH|c1|any",
            "t1": "2h|BOTH|T1|c1|any", "xf": "2h|BOTH|XF|c1|any", "x_ph": "2h|BOTH|PH|c1|any"}
    pr = {k: runs[v]["profit_rs"] for k, v in keys.items()}
    rate = lambda a, ix: r(a[ix].sum() / 1e7 / (len(ix) / 365.25), 2)  # ₹ lakh per MW-year, 100 MW battery
    by_year = {}
    for y in sorted({x[:4] for x in d[ev]}):
        yi = np.array([i for i in idx if days[i].startswith(y)])
        by_year[y] = {k: rate(v, yi) for k, v in pr.items()}
        by_year[y]["t1_beats_da_days"] = r((pr["t1"][yi] > pr["da"][yi] + 1).mean(), 3)
        by_year[y]["days"] = int(len(yi))
    by_month = {}
    for m in range(1, 13):
        mi = np.array([i for i in idx if int(days[i][5:7]) == m])
        by_month[f"{m:02d}"] = {"t1_minus_da": rate(pr["t1"] - pr["da"], mi), "rt_minus_da": rate(pr["rt"] - pr["da"], mi)}
    # the average real-time minus day-ahead price, block by block, over the last 12 months
    last12 = np.array([i for i in idx if days[i] > (date.fromisoformat(last_day) - timedelta(days=365)).isoformat()])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        basis = np.nanmean(P["RTM"][last12] - P["DAM"][last12], axis=0)
        absdiff = np.nanmean(np.abs(P["RTM"][last12] - P["DAM"][last12]), axis=0)
    diff = pr["t1"][idx] - pr["da"][idx]
    total = {k: rate(v, idx) for k, v in pr.items()}
    total.update(t1_beats_da_days=r((diff > 1).mean(), 3), t1_loses_to_da_days=r((diff < -1).mean(), 3),
                 days=int(len(idx)), first=days[idx[0]], last=days[idx[-1]])
    return {"total": total, "by_year": by_year, "by_month": by_month,
            "basis_last_12m": arr(basis, 0), "abs_gap_last_12m": arr(absdiff, 0)}


def tolling(tenders):
    """The latest 2-hour and 4-hour tender tariff, as a 'lease the battery' benchmark."""
    out = {}
    for dur, lo, hi in (("2h", 1.5, 2.5), ("4h", 3.5, 4.5)):
        for t in tenders:  # newest first
            if lo <= t["energy_mwh"] / t["capacity_mw"] <= hi:
                rate = t["tariff_low"]
                out[dur] = {**t, "lakh_mw_month": rate, "lakh_mw_yr": round(rate * 12, 2)}
                break
    return out


def load_tenders(terminal):
    """Standalone battery tenders priced in Rs lakh/MW/month, from the terminal's curated list."""
    path = Path(terminal) / "data" / "reference" / "tenders.csv"
    out = []
    if path.exists():
        with path.open(newline="") as f:
            for row in csv.DictReader(f):
                if row["category"] == "BESS" and row["unit"].startswith("Rs lakh/MW/month") and row["capacity_mw"] and row["energy_mwh"]:
                    out.append({"result_date": row["result_date"], "authority": row["authority"], "title": row["title"],
                                "capacity_mw": float(row["capacity_mw"]), "energy_mwh": float(row["energy_mwh"]),
                                "tariff_low": float(row["tariff_low"]), "tariff_high": float(row["tariff_high"] or row["tariff_low"]),
                                "source": row["source"]})
    return sorted(out, key=lambda t: t["result_date"], reverse=True)


def latest_plans(bess, P, V):
    """Hour-by-hour schedule on the latest day for the 2-hour battery: c = charging, s = selling."""
    bat = bess.Battery(wear_rs_mwh=WEAR)
    A, Vm = P["DAM"], V["DAM"]

    def hours(plan):
        out = []
        for hr in range(24):
            q = plan[hr * 4:hr * 4 + 4]
            out.append("c" if (q > 0).sum() >= 2 else "s" if (q < 0).sum() >= 2 else "")
        return out
    prof = bess.profile("B2", "DAM", A)[-1:]
    vols = bess.profile("B2", "DAM", Vm)[-1:]
    ch, dis = bess.step_limits(bat, vols)
    b2, _ = bess.plan_days(bat, prof, prof, ch, dis)
    ch, dis = bess.step_limits(bat, Vm[-1:])
    ph, _ = bess.plan_days(bat, A[-1:], A[-1:], ch, dis)
    b0 = bess.window_plan(bat, [bess.FIXED_WINDOWS])
    return {"B2": hours(b2[0]), "PH": hours(ph[0]), "B0": hours(b0[0])}


# ------------------------------------------------------------------ main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--backtester", required=True, help="power_market checkout (bess.py and power.db)")
    ap.add_argument("--terminal", required=True, help="power_price_terminal checkout")
    ap.add_argument("--markets-only", action="store_true", help="skip the backtests")
    args = ap.parse_args(argv)

    sys.path.insert(0, str(Path(args.backtester).resolve()))
    import bess  # noqa: E402
    con = bess.connect(Path(args.backtester).resolve() / "power.db")
    days, P, V = bess.load_market_arrays(con)
    # last delivery day complete in both markets
    complete = [i for i in range(len(days)) if np.isfinite(P["DAM"][i]).sum() >= 90 and np.isfinite(P["RTM"][i]).sum() >= 90]
    last = complete[-1]
    days = days[:last + 1]
    P = {m: P[m][:last + 1] for m in P}
    V = {m: V[m][:last + 1] for m in V}
    last_day = days[-1]
    now = datetime.now(IST).isoformat(timespec="minutes")
    gd = load_terminal(args.terminal, "gdam")
    hp = load_terminal(args.terminal, "hpdam")

    # --- the latest day
    i = len(days) - 1
    snap = {"sample": False, "date": last_day, "unit": "Rs/MWh", "blocks": 96, "updated": now,
            "source": "IEX day-ahead and real-time market snapshots, 15-minute blocks",
            "dam": arr(P["DAM"][i]), "rtm": arr(P["RTM"][i]),
            "stats": {"dam": day_stats(P["DAM"][i], V["DAM"][i]), "rtm": day_stats(P["RTM"][i], V["RTM"][i])}}
    snap["stats"]["rt_minus_da"] = r(np.nanmean(P["RTM"][i]) - np.nanmean(P["DAM"][i]), 0)
    (DATA / "market-snapshot.json").write_text(json.dumps(snap, separators=(",", ":")))

    # --- markets: recent days in full, every day summarised, and months
    recent = days[-60:]
    rec = []
    for d in recent:
        k = days.index(d)
        g, h = gd.get(d), hp.get(d)
        rec.append({"date": d, "dam": arr(P["DAM"][k], 0), "rtm": arr(P["RTM"][k], 0),
                    "gdam": arr(g[0], 0) if g else None, "hpdam": arr(h[0], 0) if h else None,
                    "dam_mcv": arr(V["DAM"][k], 0)})
    daily = []
    for k, d in enumerate(days):
        sd, sr = day_stats(P["DAM"][k], V["DAM"][k]), day_stats(P["RTM"][k], V["RTM"][k])
        daily.append([d, *(sd[x] if sd else None for x in ("avg", "vwap", "solar", "evening", "spread", "max", "at_cap")),
                      *(sr[x] if sr else None for x in ("avg", "solar", "evening", "spread"))])
    months = {}
    for k, d in enumerate(days):
        months.setdefault(d[:7], []).append(k)
    mtable = []
    for m, ks in months.items():
        row = {"month": m, "days": len(ks), "complete": len(ks) == calendar.monthrange(int(m[:4]), int(m[5:]))[1]}
        for name, src in (("dam", P["DAM"]), ("rtm", P["RTM"])):
            block = src[ks]
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                row[name] = {"avg": r(np.nanmean(block), 0), "solar": r(np.nanmean(block[:, SOLAR[0] - 1:SOLAR[1]]), 0),
                             "evening": r(np.nanmean(block[:, EVENING[0] - 1:EVENING[1]]), 0)}
            row[name]["spread"] = r(row[name]["evening"] - row[name]["solar"], 0)
        vd = V["DAM"][ks]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            row["dam"]["vwap"] = r(np.nansum(P["DAM"][ks] * vd) / np.nansum(np.where(np.isfinite(P["DAM"][ks]), vd, np.nan)), 0)
        for name, src in (("gdam", gd), ("hpdam", hp)):
            vals = [src[d][0] for d in (days[k] for k in ks) if d in src]
            if vals:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", RuntimeWarning)
                    a = np.vstack(vals)
                    row[name] = {"avg": r(np.nanmean(a), 0), "cleared_blocks": int(np.isfinite(a).sum())}
        mtable.append(row)
    markets = {"sample": False, "updated": now, "through": last_day, "unit": "Rs/MWh",
               "windows": {"solar": "09:00–16:00", "evening": "18:00–22:00"},
               "recent": rec,
               "daily_fields": ["date", "dam_avg", "dam_vwap", "dam_solar", "dam_evening", "dam_spread", "dam_max",
                                "dam_blocks_at_cap", "rtm_avg", "rtm_solar", "rtm_evening", "rtm_spread"],
               "daily": daily, "months": mtable}
    (DATA / "markets.json").write_text(json.dumps(markets, separators=(",", ":")))
    print(f"markets: through {last_day}", file=sys.stderr)
    if args.markets_only:
        return

    # --- backtests
    eval_from = bess.EVAL_START.isoformat()
    last_dt = date.fromisoformat(last_day)
    month_end = (last_dt + timedelta(days=1)).replace(day=1) - timedelta(days=1)
    last_complete_month_end = last_day if month_end == last_dt else (last_dt.replace(day=1) - timedelta(days=1)).isoformat()
    runs = simulate(bess, days, P, V, eval_from)
    mlist, summary = summarise(runs, days, eval_from, last_complete_month_end)
    # month to date for the month in progress
    mtd_month = last_day[:7] if last_complete_month_end != last_day else None
    mtd = {}
    if mtd_month:
        idx = [k for k, d in enumerate(days) if d.startswith(mtd_month)]
        for key, res in runs.items():
            mtd[key] = r(res["profit_rs"][idx].sum() / 100.0, 0)
    runs_meta = []
    for key in summary:
        dur, market, s, c, charge = key.split("|")
        runs_meta.append({"key": key, "duration": dur, "market": market, "strategy": s, "cycles": int(c[1:]),
                          "charging": charge})
    bt = {
        "sample": False, "updated": now, "through": last_day, "from": eval_from, "months": mlist,
        "month_to_date": {"month": mtd_month, "days": len([d for d in days if mtd_month and d.startswith(mtd_month)]),
                          "rs_mw": mtd} if mtd_month else None,
        "battery": {"power_mw": 100, "durations": {"2h": "100 MW / 200 MWh", "4h": "100 MW / 400 MWh"},
                    "rte": 0.87, "soc_band": [0.10, 0.90], "fee_rs_mwh": 20.0, "wear_rs_mwh": WEAR,
                    "participation": 0.10, "day_start_end_soc": 0.10},
        "strategies": {k: {"name": v[0], "about": v[1]} for k, v in STRATEGIES.items()},
        "markets": MARKET_NAMES,
        "charging": {"any": "Charge at any hour", "solar": "Charge 10:00–15:00 only"},
        "headline": HEADLINE, "runs": runs_meta, "results": summary,
        "tenders": load_tenders(args.terminal),
        "tolling": tolling(load_tenders(args.terminal)),
        "latest_day": {"date": last_day, "plans": latest_plans(bess, P, V),
                       "profit_rs_mw": {k: r(runs[f"2h|DAM|{k}|c1|any"]["profit_rs"][-1] / 100.0, 0) for k in ("PH", "B2", "B0")}},
        "units": {"monthly_rs_mw": "₹ per MW of power in the month, after fees and wear",
                  "lakh_mw_yr": "₹ lakh per MW per year, after fees and wear"},
    }
    (DATA / "backtests.json").write_text(json.dumps(bt, separators=(",", ":")))
    h = summary[HEADLINE]
    ceiling = summary[CEILING_OF(HEADLINE)]
    simple = summary["2h|DAM|B0|c1|any"]
    idx = {
        "sample": False, "updated": now, "through": last_day, "unit": "Rs per MW per month",
        "name": "Zoltiq Battery Index", "definition": "What a 100 MW / 200 MWh battery earned per MW each month on the IEX "
        "day-ahead market, planning each day on the last 7 days' prices (no look-ahead), one cycle a day, after fees and wear.",
        "months": mlist, "values": h["monthly_rs_mw"], "ceiling": ceiling["monthly_rs_mw"],
        "fixed_windows": simple["monthly_rs_mw"],
        "last_month": mlist[-1], "last_value": h["monthly_rs_mw"][-1],
        "month_to_date": {"month": mtd_month, "value": mtd.get(HEADLINE)} if mtd_month else None,
    }
    (DATA / "battery-index.json").write_text(json.dumps(idx, separators=(",", ":")))
    (DATA / "research").mkdir(exist_ok=True)
    note = research_waiting(runs, days, P, eval_from, last_complete_month_end)
    note.update(updated=now)
    (DATA / "research" / "day-ahead-or-real-time.json").write_text(json.dumps(note, separators=(",", ":")))
    old = DATA / "research" / "one-pm-ten-pm-rule.json"
    if old.exists():
        old.unlink()
    print(f"backtests: {len(summary)} runs, {mlist[0]} to {mlist[-1]}", file=sys.stderr)


if __name__ == "__main__":
    main()
