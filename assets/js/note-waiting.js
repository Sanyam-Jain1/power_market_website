/* Zoltiq Research — Day-ahead or real-time? Charts read data/research/day-ahead-or-real-time.json. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var lakh = function (v) { return v == null ? "–" : "₹" + F.num(v, 1) + " lakh"; };
  ZOLTIQ.loadJSON("../../data/research/day-ahead-or-real-time.json").then(function (d) {
    var years = Object.keys(d.by_year).sort();
    C.lineChart($("by-year"), {
      label: "Earnings per MW-year by calendar year, by strategy",
      series: [
        { name: "Hindsight best, day-ahead", values: years.map(function (y) { return d.by_year[y].da_ph; }), color: "var(--c-ref)", dash: true },
        { name: "Day-ahead plan, corrected in real-time", values: years.map(function (y) { return d.by_year[y].t1; }), color: "var(--c2)", width: 3 },
        { name: "Day-ahead only (7-day plan)", values: years.map(function (y) { return d.by_year[y].da; }), color: "var(--c1)" },
        { name: "Real-time only (7-day plan)", values: years.map(function (y) { return d.by_year[y].rt; }), color: "var(--c3)" }
      ],
      labels: years, zero: true, height: 280,
      xTick: function (i) { return years[i] || null; }, xTickGap: 20,
      yFormat: function (v) { return "₹" + F.num(v, 0) + "L"; }, tipFormat: lakh
    });
    var ms = Object.keys(d.by_month).sort();
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    C.barChart($("by-month"), {
      label: "Gain from the real-time correction over day-ahead alone, by calendar month",
      values: ms.map(function (m) { return d.by_month[m].t1_minus_da; }), labels: ms.map(function (m) { return names[+m - 1]; }),
      color: function (i, v) { return v < 0 ? "var(--c2)" : "var(--c1)"; }, height: 240,
      yFormat: function (v) { return "₹" + F.num(v, 1) + "L"; },
      xTick: function (i) { return names[i]; }, xTickGap: 10,
      tip: function (i) { var r = d.by_month[ms[i]]; return [["Correction vs day-ahead", lakh(r.t1_minus_da) + "/MW-yr"], ["Real-time only vs day-ahead", lakh(r.rt_minus_da) + "/MW-yr"]]; }
    });
    C.barChart($("basis"), {
      label: "Average real-time minus day-ahead price in each block, last 12 months",
      values: d.basis_last_12m, labels: d.basis_last_12m.map(function (_, i) { return F.blockRange(i + 1); }),
      color: function (i, v) { return v < 0 ? "var(--c3)" : "var(--c2)"; }, height: 220,
      yFormat: function (v) { return "₹" + F.num(v, 0); },
      xTick: function (i) { return i % 16 === 0 ? F.block(i + 1) : null; }, xTickGap: 30,
      tip: function (i) { return [["Real-time minus day-ahead, average", F.rs(d.basis_last_12m[i])], ["Typical gap either way", F.rs(d.abs_gap_last_12m[i])]]; }
    });
    var t = d.total;
    C.table($("summary"), ["Strategy", "Since May 2022", "Against day-ahead only"], [
      ["Real-time only, 7-day plan", lakh(t.rt), lakh(t.rt - t.da)],
      ["Day-ahead only, 7-day plan", lakh(t.da), "–"],
      ["Best market per block, chosen at noon", lakh(t.xf), lakh(t.xf - t.da)],
      ["Day-ahead plan, corrected in real-time", lakh(t.t1), lakh(t.t1 - t.da)],
      ["Hindsight best, day-ahead", lakh(t.da_ph), lakh(t.da_ph - t.da)],
      ["Hindsight best, real-time", lakh(t.rt_ph), lakh(t.rt_ph - t.da)],
      ["Hindsight best, both markets", lakh(t.x_ph), lakh(t.x_ph - t.da)]
    ], { caption: "₹ lakh per MW-year, 2-hour battery, one cycle a day, after fees and wear." });
  }).catch(function (e) { console.error(e); });
})();
