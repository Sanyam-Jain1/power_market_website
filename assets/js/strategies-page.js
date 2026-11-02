/* Zoltiq — Strategies page. Reads data/backtests.json. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var lakhY = function (v) { return v == null ? "–" : "₹" + F.num(v, 1) + " lakh"; };

  ZOLTIQ.loadJSON("../data/backtests.json").then(function (bt) {
    var R = bt.results, months = bt.months, S = bt.strategies;
    var sel = { duration: "2h", cycles: 1 };
    var k = function (m, s, c, ch) { return [sel.duration, m, s, "c" + (c || sel.cycles), ch || "any"].join("|"); };
    var get = function (m, s, c, ch) { return R[k(m, s, c, ch)] || R[k(m, s, 1, ch)]; };
    [].forEach.call(document.querySelectorAll("[data-through]"), function (e) { e.textContent = F.date(bt.through); });

    function cumulative(vals) { var t = 0; return vals.map(function (v) { t += v || 0; return t; }); }

    function draw() {
      var lines = [
        ["BOTH", "PH", "Hindsight, both markets", "var(--c4)", true],
        ["DAM", "PH", "Hindsight, day-ahead", "var(--c-ref)", true],
        ["DAM", "B2", "7-day average plan, day-ahead", "var(--c1)"],
        ["RTM", "B2", "7-day average plan, real-time", "var(--c3)"],
        ["BOTH", "T1", "Day-ahead plan, corrected in real-time", "var(--c2)"],
        ["DAM", "B0", "Fixed 11:00 / 18:00", "var(--bar)"]
      ];
      C.lineChart($("race"), {
        label: "Cumulative earnings per MW since May 2022",
        series: lines.map(function (l) { var r = get(l[0], l[1]); return { name: l[2], short: l[2].replace(", day-ahead", " DA").replace(", real-time", " RT").replace("Hindsight, both markets", "Both, hindsight").replace("Day-ahead plan, corrected in real-time", "DA + RT correction"), values: r ? cumulative(r.monthly_rs_mw) : [], color: l[3], dash: !!l[4] }; }),
        labels: months.map(function (m) { return "To end of " + F.monthLong(m); }), zero: true, height: 380,
        xTick: function (i) { return i < months.length && (months[i].slice(5) === "01" || i === 0) ? months[i].slice(0, 4) : null; },
        yFormat: function (v) { return "₹" + F.num(v / 1e5, 0) + "L"; }, tipFormat: function (v) { return F.lakh(v, 1); }
      });

      // the ladder: last 12 months, both markets
      var order = ["B0", "B1", "B3", "B4", "B2", "PH"];
      var rows = [];
      order.forEach(function (s) { ["DAM", "RTM"].forEach(function (m) { var r = get(m, s); if (r) rows.push({ s: s, m: m, r: r }); }); });
      ["XF", "T1"].forEach(function (s) { var r = get("BOTH", s); if (r) rows.push({ s: s, m: "BOTH", r: r }); });
      var x = get("BOTH", "PH"); if (x) rows.push({ s: "X", m: "BOTH", r: x });
      C.barChart($("ladder"), {
        label: "Earnings per MW-year over the last 12 months, by strategy and market",
        values: rows.map(function (o) { return o.r.last_12m.lakh_mw_yr * 1e5; }),
        labels: rows.map(function (o) { return (o.s === "X" ? "Best of both markets, hindsight" : S[o.s].name) + " · " + bt.markets[o.m]; }),
        color: function (i) { var o = rows[i]; return o.s === "PH" || o.s === "X" ? "var(--bar)" : o.m === "DAM" ? "var(--c1)" : o.m === "RTM" ? "var(--c3)" : "var(--c2)"; },
        height: 300, format: function (v) { return F.lakh(v, 1); }, yFormat: function (v) { return "₹" + F.num(v / 1e5, 0) + "L"; },
        xTick: function (i) { var o = rows[i]; return o.m === "RTM" ? null : ({ X: "Both, hindsight", PH: "Hindsight", T1: "DA + RT", XF: "Pick market", B0: "Fixed", B1: "Monthly", B3: "Last week", B4: "Yesterday", B2: "7-day" })[o.s]; },
        xTickGap: 30,
        tip: function (i) { var o = rows[i], w = o.r.last_12m; return [["Per MW-year", lakhY(w.lakh_mw_yr)], ["Of hindsight", o.s === "PH" || o.s === "X" ? "100%" : F.pct(w.capture)], ["Since May 2022", lakhY(o.r.all.lakh_mw_yr)]]; }
      });

      // cards
      var host = $("cards"); host.textContent = "";
      var cards = [
        ["BOTH", "T1", "Works because by 22:00 the next day's day-ahead prices are public, and blended with last week's real-time prices they are a better guide to real-time than either alone.", "Needs that blend: re-planning on day-ahead prices alone earned less than day-ahead only. Each correction pays a second exchange fee, so small differences are not worth trading."],
        ["BOTH", "XF", "Works when one market is reliably cheaper at the same hours. Real-time has been cheaper than day-ahead overnight and in the evening.", "Those are the hours a battery sells, not buys, and last week's averages rarely separate the two markets by enough: it ends up level with day-ahead alone."],
        ["DAM", "B0", "Works when the peak is early evening, the most common shape in the record.", "Misses days when the solar trough shifts later or the peak moves, and every chance of a second cycle."],
        ["DAM", "B2", "Works because day-ahead prices repeat: last week is a very good guide to tomorrow.", "Misses sudden changes: the first days of a heatwave, a monsoon break, a holiday."],
        ["RTM", "B2", "Works on the same weekly pattern, in a market that clears closer to delivery.", "Misses more than day-ahead: real-time prices are less repeatable, so a plan made the evening before leaves more behind."],
        ["DAM", "PH", "The ceiling: what a battery would earn knowing every price in advance.", "Not achievable. It shows how much room is left for better forecasting."],
        ["BOTH", "PH", "The ceiling for trading both markets, block by block.", "Not achievable, and larger than any single-market gap. This is where a two-stage strategy has room to work."]
      ];
      cards.forEach(function (c) {
        var r = get(c[0], c[1]); if (!r) return;
        var art = document.createElement("article"); art.className = "panel strat-card";
        var name = c[0] === "BOTH" ? (c[1] === "PH" ? "Best of both markets, hindsight" : S[c[1]].name) : S[c[1]].name + (c[1] === "PH" ? ", day-ahead" : "") + (c[1] === "B2" ? " · " + bt.markets[c[0]].toLowerCase() : "");
        art.innerHTML = "<h3></h3><p class='big-num'></p><ul></ul>";
        art.querySelector("h3").textContent = name;
        art.querySelector(".big-num").textContent = lakhY(r.last_12m.lakh_mw_yr) + " per MW-year";
        var ul = art.querySelector("ul");
        var items = [
          [c[0] === "BOTH" ? "Last 12 months, share of the both-markets hindsight best" : "Last 12 months, share of the hindsight best", c[1] === "PH" ? "100%" : F.pct(r.last_12m.capture)],
          ["Since May 2022", lakhY(r.all.lakh_mw_yr) + " per MW-year"],
          ["Best and worst month", F.month(r.best_month) + " " + F.lakh(r.best_month_rs_mw, 1) + " · " + F.month(r.worst_month) + " " + F.lakh(r.worst_month_rs_mw, 1)],
          ["Losing days", F.pct(r.losing_days, 1)]
        ];
        items.forEach(function (it) { var li = document.createElement("li"); li.innerHTML = "<span></span><b></b>"; li.firstChild.textContent = it[0]; li.lastChild.textContent = it[1]; ul.appendChild(li); });
        var p1 = document.createElement("p"); p1.innerHTML = "<b>Works:</b> "; p1.appendChild(document.createTextNode(c[2]));
        var p2 = document.createElement("p"); p2.innerHTML = "<b>Misses:</b> "; p2.appendChild(document.createTextNode(c[3]));
        art.appendChild(p1); art.appendChild(p2);
        host.appendChild(art);
      });

      // findings, computed
      var da = get("DAM", "B2"), daPH = get("DAM", "PH"), rt = get("RTM", "B2"), rtPH = get("RTM", "PH");
      var da2 = R[k("DAM", "B2", 2)], both2 = R[k("BOTH", "PH", 2)], solar = R[k("DAM", "B2", 1, "solar")];
      var da2s = R[k("DAM", "B2", 2, "solar")], b0 = get("DAM", "B0"), t1 = get("BOTH", "T1"), lease = bt.tolling && bt.tolling[sel.duration];
      var f = [];
      f.push(["Day-ahead prices are predictable from last week", "Planning on the last 7 days' average earned " + F.pct(da.all.capture) + " of the hindsight best on day-ahead since May 2022 (" + F.pct(da.last_12m.capture) + " in the last 12 months). Little is left for a better day-ahead forecast."]);
      f.push(["Real-time leaves more on the table", "The same plan in real-time earned " + F.pct(rt.all.capture) + " of its hindsight best: " + lakhY(rtPH.all.lakh_mw_yr - rt.all.lakh_mw_yr) + " per MW-year left behind, against " + lakhY(daPH.all.lakh_mw_yr - da.all.lakh_mw_yr) + " on day-ahead."]);
      if (da2 && both2) f.push(["Trading both markets is the big prize", "With two cycles a day, the hindsight ceiling across both markets is " + lakhY(both2.all.lakh_mw_yr) + " per MW-year, against " + lakhY(da2.all.lakh_mw_yr) + " for the best day-ahead plan: a gap of " + lakhY(both2.all.lakh_mw_yr - da2.all.lakh_mw_yr) + ". It is an upper bound, but it is larger than any single-market gap."]);
      if (da2) f.push(["A second cycle pays, even after wear", "Allowing two cycles a day lifts the day-ahead plan from " + lakhY(da.all.lakh_mw_yr) + " to " + lakhY(da2.all.lakh_mw_yr) + " per MW-year. The battery averages " + F.num(da2.cycles_per_day, 2) + " cycles a day: it skips second cycles that don't cover the wear."]);
      if (solar && da2s && da2) f.push(["Charging only in the solar hours costs the second cycle", "If charging is allowed only from 10:00 to 15:00, the two-cycle plan drops from " + lakhY(da2.all.lakh_mw_yr) + " to " + lakhY(da2s.all.lakh_mw_yr) + " per MW-year; the one-cycle plan barely moves (" + lakhY(da.all.lakh_mw_yr) + " to " + lakhY(solar.all.lakh_mw_yr) + ")."]);
      if (t1) f.splice(2, 0, ["Real-time pays as a correction, not on its own", "Committing the day-ahead plan and correcting it in real-time at 22:00 earned " + lakhY(t1.all.lakh_mw_yr) + " per MW-year since May 2022, against " + lakhY(da.all.lakh_mw_yr) + " for day-ahead alone, and " + lakhY(t1.last_12m.lakh_mw_yr) + " over the last 12 months against " + lakhY(da.last_12m.lakh_mw_yr) + "."]);
      f.push(["A fixed schedule is a weak floor", "Charging at 11:00 and selling at 18:00 every day earned " + lakhY(b0.all.lakh_mw_yr) + " per MW-year since May 2022, " + F.pct(b0.all.capture) + " of the hindsight best, against " + lakhY(da.all.lakh_mw_yr) + " for planning on last week's prices."]);
      if (lease) f.push(["Trading beat the latest tender tariff", "Leased at " + lease.authority + "'s " + F.month(lease.result_date.slice(0, 7)) + " tariff of ₹" + F.num(lease.lakh_mw_month, 2) + " lakh per MW-month, the battery would earn " + lakhY(lease.lakh_mw_yr) + " a year, fixed. On the exchange the day-ahead plan earned " + lakhY(da.last_12m.lakh_mw_yr) + " over the last 12 months, but with no guarantee for the next twelve."]);
      var fl = $("findings"); fl.textContent = "";
      f.forEach(function (x) { var li = document.createElement("li"); li.innerHTML = "<h3></h3><p></p>"; li.firstChild.textContent = x[0]; li.lastChild.textContent = x[1]; fl.appendChild(li); });
      $("sel-note").textContent = bt.battery.durations[sel.duration] + " battery, up to " + sel.cycles + " cycle" + (sel.cycles > 1 ? "s" : "") + " a day (fixed rules: 1). After fees and ₹300/MWh wear.";
    }
    C.segmented($("st-duration"), [["2h", "2-hour"], ["4h", "4-hour"]], sel.duration, function (v) { sel.duration = v; draw(); });
    C.segmented($("st-cycles"), [[1, "1 cycle"], [2, "2 cycles"]], sel.cycles, function (v) { sel.cycles = v; draw(); });
    draw();
  }).catch(function (e) { console.error(e); var m = $("data-error"); if (m) m.hidden = false; });
})();
