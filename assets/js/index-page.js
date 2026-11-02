/* Zoltiq — Battery Index page. Reads data/backtests.json and data/markets.json. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var lakhM = function (v) { return F.lakh(v, 2); };            // ₹ per MW in a month
  var lakhY = function (v) { return v == null ? "–" : "₹" + F.num(v, 1) + " lakh"; };  // already lakh/MW/yr

  Promise.all([ZOLTIQ.loadJSON("../data/backtests.json"), ZOLTIQ.loadJSON("../data/markets.json")]).then(function (res) {
    var bt = res[0], mk = res[1];
    var R = bt.results, months = bt.months;
    var head = R[bt.headline], ceil = R["2h|DAM|PH|c1|any"], simple = R["2h|DAM|S1|c1|any"];
    var last = months.length - 1;

    /* ---- Headline figures ---- */
    $("hl-month").textContent = F.monthLong(months[last]);
    $("hl-value").textContent = lakhM(head.monthly_rs_mw[last]);
    var prev = head.monthly_rs_mw[last - 1], yago = head.monthly_rs_mw[last - 12];
    $("hl-note").textContent = "per MW. " + F.month(months[last - 1]) + ": " + lakhM(prev) + "; " + F.month(months[last - 12]) + ": " + lakhM(yago) + ".";
    $("hl-12m").textContent = lakhY(head.last_12m.lakh_mw_yr);
    $("hl-12m-note").textContent = "per MW-year, " + F.month(months[last - 11]) + " to " + F.month(months[last]) + ". Since May 2022: " + lakhY(head.all.lakh_mw_yr) + ".";
    $("hl-capture").textContent = F.pct(head.last_12m.capture);
    $("hl-capture-note").textContent = "of the perfect-hindsight best (" + lakhY(ceil.last_12m.lakh_mw_yr) + "), last 12 months.";
    var simpleShare = simple.last_12m.lakh_mw_yr / head.last_12m.lakh_mw_yr;
    $("hl-simple").textContent = F.pct(simple.last_12m.capture);
    $("hl-simple-note").textContent = "of the hindsight best went to the fixed 1pm / 10pm rule (" + lakhY(simple.last_12m.lakh_mw_yr) + ", " + F.pct(simpleShare) + " of the Index).";
    var mrow = mk.months.filter(function (m) { return m.month === months[last]; })[0];
    if (mrow) {
      $("hl-spread").textContent = F.rs(mrow.dam.spread);
      $("hl-spread-note").textContent = "per MWh: day-ahead evening (18–22h) average " + F.rs(mrow.dam.evening) + " minus solar hours (09–16h) " + F.rs(mrow.dam.solar) + ", " + F.month(months[last]) + ".";
    }
    if (bt.month_to_date && bt.month_to_date.rs_mw[bt.headline] != null) {
      $("hl-mtd").textContent = F.monthLong(bt.month_to_date.month) + " so far (" + bt.month_to_date.days + " days): " + lakhM(bt.month_to_date.rs_mw[bt.headline]) + " per MW.";
    }
    [].forEach.call(document.querySelectorAll("[data-through]"), function (e) { e.textContent = F.date(bt.through); });

    /* ---- History chart ---- */
    var range = "all";
    function drawHistory() {
      var n = range === "1y" ? 12 : range === "3y" ? 36 : months.length;
      var ms = months.slice(-n);
      C.lineChart($("index-chart"), {
        label: "Zoltiq Battery Index by month, with the hindsight ceiling and the 1pm / 10pm rule",
        series: [
          { name: "Perfect hindsight", short: "Hindsight", values: ceil.monthly_rs_mw.slice(-n), color: "var(--c-ref)", dash: true },
          { name: "Zoltiq Battery Index (7-day average plan)", short: "Index", values: head.monthly_rs_mw.slice(-n), color: "var(--c1)", width: 3 },
          { name: "1pm / 10pm rule", short: "1pm / 10pm", values: simple.monthly_rs_mw.slice(-n), color: "var(--c2)" }
        ],
        labels: ms.map(F.monthLong), endLabels: true, zero: true, height: 340,
        xTick: function (i) { return i < ms.length && (n <= 12 || ms[i].slice(5) === "01" || i === 0) ? F.month(ms[i]) : null; },
        yFormat: function (v) { return "₹" + F.num(v / 1e5, 1) + "L"; }, tipFormat: lakhM
      });
    }
    C.segmented($("index-range"), [["1y", "1 year"], ["3y", "3 years"], ["all", "All, from May 2022"]], range, function (v) { range = v; drawHistory(); });
    drawHistory();

    /* ---- Explorer: every battery, market, strategy ---- */
    var sel = { duration: "2h", market: "DAM", cycles: 1, charging: "any", window: "last_12m" };
    var order = ["PH", "B2", "B4", "B3", "B1", "B0", "S1"];
    function key(s, m, c) { return [sel.duration, m || sel.market, s, "c" + (c || sel.cycles), sel.charging].join("|"); }
    function drawExplorer() {
      var rows = [];
      order.forEach(function (s) {
        var c = sel.cycles;
        var k = key(s, null, c), r = R[k], note = "";
        if (!r && c === 2 && R[key(s, null, 1)]) { r = R[key(s, null, 1)]; note = " (1 cycle)"; }
        if (!r) return;
        var w = r[sel.window];
        rows.push({ cls: k === bt.headline ? "is-head" : (s === "PH" ? "is-ref" : ""), s: s, r: r, cells: [
          bt.strategies[s].name + note + (k === bt.headline ? " · Index" : ""),
          lakhY(w.lakh_mw_yr), s === "PH" ? "100%" : F.pct(w.capture), F.pct(w.capture_both), F.num(r.cycles_per_day, 2),
          F.rs(r.avg_buy), F.rs(r.avg_sell), F.pct(r.losing_days, 1), F.month(r.worst_month) + " · " + lakhM(r.worst_month_rs_mw)] });
      });
      var both = R[[sel.duration, "BOTH", "PH", "c" + sel.cycles, sel.charging].join("|")];
      if (both && sel.market !== "BOTH") {
        var wb = both[sel.window];
        rows.push({ cls: "is-ref", cells: ["Best of both markets, hindsight", lakhY(wb.lakh_mw_yr), "–", "100%", F.num(both.cycles_per_day, 2),
          F.rs(both.avg_buy), F.rs(both.avg_sell), F.pct(both.losing_days, 1), F.month(both.worst_month) + " · " + lakhM(both.worst_month_rs_mw)] });
      }
      var winName = { last_12m: "last 12 months", last_24m: "last 24 months", all: "since May 2022" }[sel.window];
      C.table($("explorer-table"), ["Strategy", "Earned, per MW-year", "Of hindsight, this market", "Of hindsight, both markets",
        "Cycles a day", "Avg buy ₹/MWh", "Avg sell ₹/MWh", "Losing days", "Worst month"], rows,
        { caption: bt.battery.durations[sel.duration] + " battery, " + bt.markets[sel.market].toLowerCase() + ", up to " + sel.cycles +
          " cycle" + (sel.cycles > 1 ? "s" : "") + " a day, " + bt.charging[sel.charging].toLowerCase() + ", " + winName +
          ". After exchange fees and ₹300/MWh wear; before transmission charges and O&M." });
      var pick = [["PH", "var(--c-ref)", true], ["B2", "var(--c1)"], ["B0", "var(--c3)"], ["S1", "var(--c2)"]];
      C.lineChart($("explorer-chart"), {
        label: "Monthly earnings per MW for the selected battery",
        series: pick.map(function (p) {
          var r = R[key(p[0])] || R[key(p[0], null, 1)];
          return { name: bt.strategies[p[0]].name, values: r ? r.monthly_rs_mw : [], color: p[1], dash: !!p[2] };
        }),
        labels: months.map(F.monthLong), zero: true, height: 300,
        xTick: function (i) { return i < months.length && (months[i].slice(5) === "01" || i === 0) ? months[i].slice(0, 4) : null; },
        yFormat: function (v) { return "₹" + F.num(v / 1e5, 1) + "L"; }, tipFormat: lakhM
      });
      // by year for the selected market's 7-day plan and hindsight
      var yrs = Object.keys((R[key("B2")] || {}).by_year || {}).sort();
      C.table($("explorer-years"), ["Year"].concat(yrs), order.map(function (s) {
        var r = R[key(s)] || R[key(s, null, 1)];
        if (!r) return null;
        return [bt.strategies[s].name].concat(yrs.map(function (y) { return r.by_year[y] ? lakhY(r.by_year[y].lakh_mw_yr) : "–"; }));
      }).filter(Boolean), { caption: "₹ lakh per MW-year by calendar year (2022 from May; " + yrs[yrs.length - 1] + " to date)." });
    }
    C.segmented($("ex-duration"), [["2h", "2-hour"], ["4h", "4-hour"]], sel.duration, function (v) { sel.duration = v; drawExplorer(); });
    C.segmented($("ex-market"), [["DAM", "Day-ahead"], ["RTM", "Real-time"]], sel.market, function (v) { sel.market = v; drawExplorer(); });
    C.segmented($("ex-cycles"), [[1, "1 cycle"], [2, "2 cycles"]], sel.cycles, function (v) { sel.cycles = v; drawExplorer(); });
    C.segmented($("ex-charging"), [["any", "Any hour"], ["solar", "10:00–15:00 only"]], sel.charging, function (v) { sel.charging = v; drawExplorer(); });
    C.segmented($("ex-window"), [["last_12m", "12 months"], ["last_24m", "24 months"], ["all", "Since May 2022"]], sel.window, function (v) { sel.window = v; drawExplorer(); });
    drawExplorer();

    /* ---- Against tender tariffs ---- */
    if (bt.tenders && $("tender-table")) {
      var t4 = R["4h|DAM|B2|c1|any"], t2 = head;
      C.table($("tender-table"), ["Tender", "Battery", "Tariff, ₹ lakh/MW/month", "Zoltiq, same duration, last 12 months"],
        bt.tenders.map(function (t) {
          var dur = t.energy_mwh / t.capacity_mw >= 3 ? t4 : t2;
          var link = document.createElement("a"); link.href = t.source; link.textContent = t.authority + ", " + F.date(t.result_date); link.rel = "noopener";
          return [link, F.num(t.capacity_mw) + " MW / " + F.num(t.energy_mwh) + " MWh", t.tariff_low === t.tariff_high ? F.num(t.tariff_low, 2) : F.num(t.tariff_low, 2) + "–" + F.num(t.tariff_high, 2),
            F.num(dur.last_12m.lakh_mw_yr / 12, 2) + " (" + (dur === t4 ? "4" : "2") + "-hour)"];
        }), { text: [1], caption: "Zoltiq figure: the 7-day average plan on the day-ahead market, one cycle a day, as ₹ lakh per MW per month. A tender tariff is a fixed payment for 12 years or more; the Zoltiq figure is what the exchange paid, month by month." });
    }

    /* ---- CSV ---- */
    $("csv-index").addEventListener("click", function () {
      C.downloadCSV("zoltiq-battery-index.csv", ["month", "zoltiq_battery_index_rs_per_mw", "perfect_hindsight_rs_per_mw", "one_pm_ten_pm_rule_rs_per_mw"],
        months.map(function (m, i) { return [m, head.monthly_rs_mw[i], ceil.monthly_rs_mw[i], simple.monthly_rs_mw[i]]; }));
    });
    $("csv-all").addEventListener("click", function () {
      var head2 = ["month"], keys = bt.runs.map(function (r) { return r.key; });
      keys.forEach(function (k) { head2.push(k.replace(/\|/g, "_")); });
      C.downloadCSV("zoltiq-backtests-monthly.csv", head2, months.map(function (m, i) { return [m].concat(keys.map(function (k) { return R[k].monthly_rs_mw[i]; })); }));
    });
  }).catch(function (e) {
    console.error(e);
    var m = $("index-error"); if (m) m.hidden = false;
  });
})();
