/* Zoltiq Research — The 1pm / 10pm rule. Charts read data/research/one-pm-ten-pm-rule.json. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  ZOLTIQ.loadJSON("../../data/research/one-pm-ten-pm-rule.json").then(function (d) {
    var years = Object.keys(d.by_year).sort();
    C.lineChart($("by-year"), {
      label: "Share of the hindsight best by year",
      series: [
        { name: "Planned on last week's prices", values: years.map(function (y) { return d.by_year[y].b2_capture; }), color: "var(--c1)" },
        { name: "Fixed 11:00 / 18:00", values: years.map(function (y) { return d.by_year[y].b0_capture; }), color: "var(--c3)" },
        { name: "1pm / 10pm rule", values: years.map(function (y) { return d.by_year[y].s1_capture; }), color: "var(--c2)", width: 3 }
      ],
      labels: years, zero: true, height: 260, endLabels: false,
      xTick: function (i) { return years[i] || null; }, xTickGap: 20,
      yFormat: function (v) { return F.pct(v); }, tipFormat: function (v) { return F.pct(v); }
    });
    var hy = years[years.length - 1];
    function drawHours() {
      var h = d.window_hours[hy];
      C.barChart($("hours"), {
        label: "Start hour of the day's dearest two-hour window, " + hy,
        values: h.sell_start_hour, labels: h.sell_start_hour.map(function (_, i) { return (i < 10 ? "0" : "") + i + ":00"; }),
        color: function (i) { return i === 22 ? "var(--c2)" : "var(--c1)"; }, height: 220,
        xTick: function (i) { return i % 3 === 0 ? (i < 10 ? "0" : "") + i + ":00" : null; }, xTickGap: 20,
        tip: function (i) { return [["Days", F.num(h.sell_start_hour[i])], ["Share of " + hy, F.pct(h.sell_start_hour[i] / h.days)]]; }
      });
    }
    C.segmented($("hour-year"), years.map(function (y) { return [y, y]; }), hy, function (v) { hy = v; drawHours(); });
    drawHours();
    C.table($("windows"), ["Year", "11:00–13:00", "13:00–15:00", "18:00–20:00", "22:00–24:00"], years.map(function (y) {
      var r = d.by_year[y]; return [y, F.num(r.price_11_13), F.num(r.price_13_15), F.num(r.price_18_20), F.num(r.price_22_24)];
    }));
    var ms = Object.keys(d.by_month).sort();
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    C.barChart($("by-month"), {
      label: "Share of the hindsight best by calendar month",
      values: ms.map(function (m) { return d.by_month[m].s1_capture; }), labels: ms.map(function (m) { return names[+m - 1]; }),
      color: function (i, v) { return v < 0 ? "var(--c2)" : "var(--c1)"; }, height: 240,
      yFormat: function (v) { return F.pct(v); },
      xTick: function (i) { return names[i]; }, xTickGap: 10,
      tip: function (i) { var r = d.by_month[ms[i]]; return [["1pm / 10pm rule", F.pct(r.s1_capture, 1)], ["Planned on last week's prices", F.pct(r.b2_capture, 1)]]; }
    });
    C.table($("worst"), ["Day", "1pm / 10pm rule, ₹ per MW", "Hindsight best, ₹ per MW"], d.worst_days.map(function (w) {
      return [F.date(w.date), F.num(w.s1_rs_mw), F.num(w.ph_rs_mw)];
    }), { caption: "The eight days with the largest gap between the rule and the hindsight best." });
  }).catch(function (e) { console.error(e); });
})();
