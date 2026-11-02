/* Zoltiq — For asset owners: a battery estimate from the backtests, and the request form. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };

  ZOLTIQ.loadJSON("../data/backtests.json").then(function (bt) {
    var R = bt.results, months = bt.months;
    var sel = { duration: "2h", cycles: 1, charging: "any" };
    var mwInput = $("est-mw");
    function key(m, s, c) { return [sel.duration, m, s, "c" + (c || sel.cycles), sel.charging].join("|"); }
    function get(m, s) { return R[key(m, s)] || R[key(m, s, 1)]; }
    function draw() {
      var mw = Math.max(1, Math.min(5000, +mwInput.value || 0));
      var yr = function (r) { return r ? r.last_12m.lakh_mw_yr * 1e5 * mw : NaN; };
      var rows = [
        ["Best possible, day-ahead (hindsight)", get("DAM", "PH"), "A ceiling, not achievable."],
        ["Planned on last week's prices, day-ahead", get("DAM", "B2"), "What a disciplined day-ahead schedule earned."],
        ["Planned on last week's prices, real-time", get("RTM", "B2"), "The same plan in the real-time market."],
        ["Fixed 11:00 / 18:00", get("DAM", "B0"), "Charges and sells at the same hours every day."],
        ["Day-ahead plan, corrected in real-time", get("BOTH", "T1"), "The same plan, re-planned at 22:00 and adjusted in real-time."]
      ];
      var both = get("BOTH", "PH");
      $("est-head").textContent = F.crore(yr(get("DAM", "B2")), 1);
      $("est-head-note").textContent = "a year for a " + F.num(mw) + " MW / " + F.num(mw * (sel.duration === "4h" ? 4 : 2)) + " MWh battery on IEX day-ahead, " +
        F.month(months[months.length - 12]) + " to " + F.month(months[months.length - 1]) + ", after fees and wear.";
      C.table($("est-table"), ["Schedule", "Last 12 months", "Per MW", "Note"], rows.map(function (r) {
        return [r[0], F.crore(yr(r[1]), 2), r[1] ? "₹" + F.num(r[1].last_12m.lakh_mw_yr, 1) + " lakh" : "–", r[2]];
      }).concat(bt.tolling && bt.tolling[sel.duration] ? [["Lease at the latest tender tariff", F.crore(bt.tolling[sel.duration].lakh_mw_yr * 1e5 * mw, 2), "₹" + F.num(bt.tolling[sel.duration].lakh_mw_yr, 1) + " lakh",
        bt.tolling[sel.duration].authority + ", " + F.month(bt.tolling[sel.duration].result_date.slice(0, 7)) + ": fixed ₹" + F.num(bt.tolling[sel.duration].lakh_mw_month, 2) + " lakh per MW-month."]] : []).concat(both ? [["Best of both markets (hindsight)", F.crore(yr(both), 2), "₹" + F.num(both.last_12m.lakh_mw_yr, 1) + " lakh", "Upper bound for trading day-ahead and real-time together."]] : []),
        { text: [3], caption: "Before transmission charges, O&M and financing. " + (mw > 300 ? "Above a few hundred MW a battery starts to move evening prices, so these figures overstate what it would earn." : "A battery of this size is assumed not to move prices.") });
    }
    C.segmented($("est-duration"), [["2h", "2-hour"], ["4h", "4-hour"]], sel.duration, function (v) { sel.duration = v; draw(); });
    C.segmented($("est-cycles"), [[1, "1 cycle a day"], [2, "Up to 2"]], sel.cycles, function (v) { sel.cycles = v; draw(); });
    C.segmented($("est-charging"), [["any", "Charge any hour"], ["solar", "Only 10:00–15:00"]], sel.charging, function (v) { sel.charging = v; draw(); });
    mwInput.addEventListener("input", draw);
    draw();
  }).catch(function (e) { console.error(e); var m = $("data-error"); if (m) m.hidden = false; });
})();
