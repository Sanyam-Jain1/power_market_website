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
        ["DAM", "S1", "1pm / 10pm rule", "var(--c2)"]
      ];
      C.lineChart($("race"), {
        label: "Cumulative earnings per MW since May 2022",
        series: lines.map(function (l) { var r = get(l[0], l[1]); return { name: l[2], short: l[2].replace(", day-ahead", " DA").replace(", real-time", " RT").replace("Hindsight, both markets", "Both, hindsight"), values: r ? cumulative(r.monthly_rs_mw) : [], color: l[3], dash: !!l[4] }; }),
        labels: months.map(function (m) { return "To end of " + F.monthLong(m); }), zero: true, height: 380, endLabels: true, right: 150,
        xTick: function (i) { return i < months.length && (months[i].slice(5) === "01" || i === 0) ? months[i].slice(0, 4) : null; },
        yFormat: function (v) { return "₹" + F.num(v / 1e5, 0) + "L"; }, tipFormat: function (v) { return F.lakh(v, 1); }
      });

      // the ladder: last 12 months, both markets
      var order = ["S1", "B0", "B1", "B3", "B4", "B2", "PH"];
      var rows = [];
      order.forEach(function (s) { ["DAM", "RTM"].forEach(function (m) { var r = get(m, s); if (r) rows.push({ s: s, m: m, r: r }); }); });
      var x = get("BOTH", "PH"); if (x) rows.push({ s: "X", m: "BOTH", r: x });
      C.barChart($("ladder"), {
        label: "Earnings per MW-year over the last 12 months, by strategy and market",
        values: rows.map(function (o) { return o.r.last_12m.lakh_mw_yr * 1e5; }),
        labels: rows.map(function (o) { return (o.s === "X" ? "Best of both markets, hindsight" : S[o.s].name) + " · " + bt.markets[o.m]; }),
        color: function (i) { var o = rows[i]; return o.s === "PH" || o.s === "X" ? "var(--bar)" : o.m === "DAM" ? "var(--c1)" : "var(--c3)"; },
        height: 300, format: function (v) { return F.lakh(v, 1); }, yFormat: function (v) { return "₹" + F.num(v / 1e5, 0) + "L"; },
        xTick: function (i) { var o = rows[i]; return o.m === "DAM" || o.s === "X" ? (o.s === "X" ? "Both" : o.s === "PH" ? "Hindsight" : S[o.s].name.split(" ")[0] + (o.s === "S1" ? "" : "")) : null; },
        xTickGap: 30,
        tip: function (i) { var o = rows[i], w = o.r.last_12m; return [["Per MW-year", lakhY(w.lakh_mw_yr)], ["Of hindsight", o.s === "PH" || o.s === "X" ? "100%" : F.pct(w.capture)], ["Since May 2022", lakhY(o.r.all.lakh_mw_yr)]]; }
      });

      // cards
      var host = $("cards"); host.textContent = "";
      var cards = [
        ["DAM", "S1", "Works from April to August, when it earns 80–90% of the hindsight best: cheap after lunch, dear late at night.", "Misses winter: from November to February the evening peak comes earlier and late-night prices fall, and the rule loses money over those months as a whole."],
        ["DAM", "B0", "Works when the peak is early evening, the most common shape in the record.", "Misses days when the solar trough shifts later or the peak moves, and every chance of a second cycle."],
        ["DAM", "B2", "Works because day-ahead prices repeat: last week is a very good guide to tomorrow.", "Misses sudden changes: the first days of a heatwave, a monsoon break, a holiday."],
        ["RTM", "B2", "Works on the same weekly pattern, in a market that clears closer to delivery.", "Misses more than day-ahead: real-time prices are less repeatable, so a plan made the evening before leaves more behind."],
        ["DAM", "PH", "The ceiling: what a battery would earn knowing every price in advance.", "Not achievable. It shows how much room is left for better forecasting."],
        ["BOTH", "PH", "The ceiling for trading both markets, block by block.", "Not achievable, and larger than any single-market gap. This is where a two-stage strategy has room to work."]
      ];
      cards.forEach(function (c) {
        var r = get(c[0], c[1]); if (!r) return;
        var art = document.createElement("article"); art.className = "panel strat-card";
        var name = c[0] === "BOTH" ? "Best of both markets, hindsight" : S[c[1]].name + (c[1] === "PH" ? ", day-ahead" : "") + (c[1] === "B2" ? " · " + bt.markets[c[0]].toLowerCase() : "");
        art.innerHTML = "<h3></h3><p class='big-num'></p><ul></ul>";
        art.querySelector("h3").textContent = name;
        art.querySelector(".big-num").textContent = lakhY(r.last_12m.lakh_mw_yr) + " per MW-year";
        var ul = art.querySelector("ul");
        var items = [
          ["Last 12 months, share of the hindsight best", c[1] === "PH" ? "100%" : F.pct(r.last_12m.capture)],
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
      var da2s = R[k("DAM", "B2", 2, "solar")], s1 = get("DAM", "S1"), b0 = get("DAM", "B0");
      var f = [];
      f.push(["Day-ahead prices are predictable from last week", "Planning on the last 7 days' average earned " + F.pct(da.all.capture) + " of the hindsight best on day-ahead since May 2022 (" + F.pct(da.last_12m.capture) + " in the last 12 months). Little is left for a better day-ahead forecast."]);
      f.push(["Real-time leaves more on the table", "The same plan in real-time earned " + F.pct(rt.all.capture) + " of its hindsight best: " + lakhY(rtPH.all.lakh_mw_yr - rt.all.lakh_mw_yr) + " per MW-year left behind, against " + lakhY(daPH.all.lakh_mw_yr - da.all.lakh_mw_yr) + " on day-ahead."]);
      if (da2 && both2) f.push(["Trading both markets is the big prize", "With two cycles a day, the hindsight ceiling across both markets is " + lakhY(both2.all.lakh_mw_yr) + " per MW-year, against " + lakhY(da2.all.lakh_mw_yr) + " for the best day-ahead plan: a gap of " + lakhY(both2.all.lakh_mw_yr - da2.all.lakh_mw_yr) + ". It is an upper bound, but it is larger than any single-market gap."]);
      if (da2) f.push(["A second cycle pays, even after wear", "Allowing two cycles a day lifts the day-ahead plan from " + lakhY(da.all.lakh_mw_yr) + " to " + lakhY(da2.all.lakh_mw_yr) + " per MW-year. The battery averages " + F.num(da2.cycles_per_day, 2) + " cycles a day: it skips second cycles that don't cover the wear."]);
      if (solar && da2s && da2) f.push(["Charging only in the solar hours costs the second cycle", "If charging is allowed only from 10:00 to 15:00, the two-cycle plan drops from " + lakhY(da2.all.lakh_mw_yr) + " to " + lakhY(da2s.all.lakh_mw_yr) + " per MW-year; the one-cycle plan barely moves (" + lakhY(da.all.lakh_mw_yr) + " to " + lakhY(solar.all.lakh_mw_yr) + ")."]);
      f.push(["A fixed rule is a weak floor", "The 1pm / 10pm rule earned " + lakhY(s1.all.lakh_mw_yr) + " per MW-year since May 2022 and the fixed 11:00 / 18:00 rule " + lakhY(b0.all.lakh_mw_yr) + ", against " + lakhY(da.all.lakh_mw_yr) + " for planning on last week's prices."]);
      var fl = $("findings"); fl.textContent = "";
      f.forEach(function (x) { var li = document.createElement("li"); li.innerHTML = "<h3></h3><p></p>"; li.firstChild.textContent = x[0]; li.lastChild.textContent = x[1]; fl.appendChild(li); });
      $("sel-note").textContent = bt.battery.durations[sel.duration] + " battery, up to " + sel.cycles + " cycle" + (sel.cycles > 1 ? "s" : "") + " a day (fixed rules: 1). After fees and ₹300/MWh wear.";
    }
    C.segmented($("st-duration"), [["2h", "2-hour"], ["4h", "4-hour"]], sel.duration, function (v) { sel.duration = v; draw(); });
    C.segmented($("st-cycles"), [[1, "1 cycle"], [2, "2 cycles"]], sel.cycles, function (v) { sel.cycles = v; draw(); });
    draw();
  }).catch(function (e) { console.error(e); var m = $("data-error"); if (m) m.hidden = false; });
})();
