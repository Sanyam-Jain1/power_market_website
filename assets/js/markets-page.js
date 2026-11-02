/* Zoltiq — Markets page. Reads data/markets.json. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var finite = function (v) { return typeof v === "number" && isFinite(v); };
  var rsTick = function (v) { return v === 0 ? "₹0" : "₹" + F.num(v / 1000, v % 1000 ? 1 : 0) + "k"; };

  ZOLTIQ.loadJSON("../data/markets.json").then(function (mk) {
    var days = mk.recent, idx = days.length - 1;
    [].forEach.call(document.querySelectorAll("[data-through]"), function (e) { e.textContent = F.date(mk.through); });
    var picker = $("day-pick");
    days.forEach(function (d, i) { var o = document.createElement("option"); o.value = i; o.textContent = F.date(d.date); picker.appendChild(o); });
    picker.value = idx;
    var show = { dam: true, rtm: true, gdam: false, hpdam: false };

    function stats(a, vol) {
      var v = a.filter(finite); if (!v.length) return null;
      var hi = -Infinity, lo = Infinity, hb = 0, lb = 0, s = 0, cap = 0;
      a.forEach(function (x, i) { if (!finite(x)) return; s += x; if (x > hi) { hi = x; hb = i + 1; } if (x < lo) { lo = x; lb = i + 1; } if (x >= 9999.5) cap++; });
      var mean = function (from, to) { var t = 0, n = 0; for (var i = from - 1; i < to; i++) if (finite(a[i])) { t += a[i]; n++; } return n ? t / n : NaN; };
      var vw = NaN;
      if (vol) { var pv = 0, vv = 0; a.forEach(function (x, i) { if (finite(x) && finite(vol[i])) { pv += x * vol[i]; vv += vol[i]; } }); vw = vv ? pv / vv : NaN; }
      return { avg: s / v.length, vwap: vw, max: hi, maxb: hb, min: lo, minb: lb, solar: mean(37, 64), eve: mean(73, 88), cap: cap, n: v.length };
    }

    function drawDay() {
      var d = days[idx];
      var sd = stats(d.dam, d.dam_mcv), sr = stats(d.rtm);
      $("day-title").textContent = F.date(d.date);
      $("prev-day").disabled = idx === 0; $("next-day").disabled = idx === days.length - 1;
      var tiles = [
        ["Day-ahead average", F.rs(sd.avg), "per MWh, simple mean of 96 blocks. Volume-weighted: " + F.rs(sd.vwap) + "."],
        ["Real-time average", sr ? F.rs(sr.avg) : "–", sr ? "per MWh. " + (sr.avg >= sd.avg ? "Above" : "Below") + " day-ahead by " + F.rs(Math.abs(sr.avg - sd.avg)) + "." : ""],
        ["Evening minus solar", F.rs(sd.eve - sd.solar), "per MWh on day-ahead: 18–22h " + F.rs(sd.eve) + ", 09–16h " + F.rs(sd.solar) + "."],
        ["Highest block", F.rs(sd.max), "day-ahead, " + F.blockRange(sd.maxb) + ". " + sd.cap + " of 96 blocks at the ₹10,000 cap."],
        ["Lowest block", F.rs(sd.min), "day-ahead, " + F.blockRange(sd.minb) + "."]
      ];
      var host = $("day-stats"); host.textContent = "";
      tiles.forEach(function (t) {
        var div = document.createElement("div"); div.className = "stat";
        div.innerHTML = "<span class='k'></span><span class='v'></span><span class='n'></span>";
        div.children[0].textContent = t[0]; div.children[1].textContent = t[1]; div.children[2].textContent = t[2];
        host.appendChild(div);
      });
      var series = [];
      if (show.dam) series.push({ name: "Day-ahead (DAM)", values: d.dam, color: "var(--c1)", width: 2.5, step: true });
      if (show.rtm) series.push({ name: "Real-time (RTM)", values: d.rtm, color: "var(--c2)", step: true });
      if (show.gdam && d.gdam) series.push({ name: "Green day-ahead (G-DAM)", values: d.gdam, color: "var(--c3)", step: true });
      if (show.hpdam && d.hpdam) series.push({ name: "High-price day-ahead (HP-DAM)", values: d.hpdam, color: "var(--c4)", step: true });
      C.lineChart($("day-chart"), {
        label: "Clearing price in each 15-minute block on " + F.date(d.date), series: series, height: 340, zero: true,
        legend: true,
        bands: [{ from: 36, to: 64, color: "color-mix(in srgb, var(--accent) 12%, transparent)" }, { from: 72, to: 88, color: "var(--bg-2)" }],
        labels: d.dam.map(function (_, i) { return "Block " + (i + 1) + " · " + F.blockRange(i + 1); }),
        xTick: function (i) { return i % 16 === 0 ? (i === 96 ? "24:00" : F.block(i + 1)) : null; }, xTickGap: 30,
        yFormat: rsTick, tipFormat: function (v) { return F.rs(v); }
      });
      var hpCleared = d.hpdam ? d.hpdam.filter(finite).length : 0;
      $("hp-note").textContent = d.hpdam ? (hpCleared ? "HP-DAM cleared in " + hpCleared + " blocks this day." : "HP-DAM: nothing cleared this day.") : "";
      // block table
      C.table($("day-table"), ["Block", "Time", "Day-ahead", "Real-time", "Green DA", "High-price DA", "DA cleared MW"],
        d.dam.map(function (v, i) {
          return [String(i + 1), F.blockRange(i + 1), F.num(v), F.num(d.rtm[i]), d.gdam ? F.num(d.gdam[i]) : "–", d.hpdam ? F.num(d.hpdam[i]) : "–", F.num(d.dam_mcv[i])];
        }), { caption: "₹/MWh, as cleared on IEX. Empty: nothing cleared." });
    }
    function go(i) { idx = Math.max(0, Math.min(days.length - 1, i)); picker.value = idx; drawDay(); }
    picker.addEventListener("change", function () { go(+picker.value); });
    $("prev-day").addEventListener("click", function () { go(idx - 1); });
    $("next-day").addEventListener("click", function () { go(idx + 1); });
    [].forEach.call(document.querySelectorAll("[data-series]"), function (cb) {
      cb.checked = show[cb.getAttribute("data-series")];
      cb.addEventListener("change", function () { show[cb.getAttribute("data-series")] = cb.checked; drawDay(); });
    });
    drawDay();

    /* ---- Recent daily series ---- */
    var f = mk.daily_fields, col = function (name) { return f.indexOf(name); };
    var daily = mk.daily;
    var last30 = daily.slice(-30);
    C.barChart($("spread-chart"), {
      label: "Day-ahead evening minus solar-hours price, last 30 days",
      values: last30.map(function (r) { return r[col("dam_spread")]; }),
      labels: last30.map(function (r) { return F.date(r[0]); }), color: "var(--c1)", height: 260,
      yFormat: rsTick, format: function (v) { return F.rs(v) + " /MWh"; },
      xTick: function (i) { return i % 7 === 0 ? F.date(last30[i][0]).replace(/ \d{4}$/, "") : null; },
      tip: function (i) { var r = last30[i]; return [["Spread", F.rs(r[col("dam_spread")])], ["Evening 18–22h", F.rs(r[col("dam_evening")])], ["Solar 09–16h", F.rs(r[col("dam_solar")])], ["Real-time spread", F.rs(r[col("rtm_spread")])]]; }
    });
    var range = 90;
    function drawAvg() {
      var rows = daily.slice(-range);
      C.lineChart($("avg-chart"), {
        label: "Daily average price, day-ahead and real-time",
        series: [
          { name: "Day-ahead, simple average", values: rows.map(function (r) { return r[col("dam_avg")]; }), color: "var(--c1)" },
          { name: "Day-ahead, volume-weighted", values: rows.map(function (r) { return r[col("dam_vwap")]; }), color: "var(--c3)" },
          { name: "Real-time, simple average", values: rows.map(function (r) { return r[col("rtm_avg")]; }), color: "var(--c2)" }
        ],
        labels: rows.map(function (r) { return F.date(r[0]); }), height: 300, zero: true,
        xTick: function (i) { return i < rows.length && (rows[i][0].slice(8) === "01") ? F.month(rows[i][0].slice(0, 7)) : null; },
        yFormat: rsTick, tipFormat: function (v) { return F.rs(v); }
      });
    }
    C.segmented($("avg-range"), [[90, "90 days"], [365, "1 year"], [daily.length, "All, from Apr 2022"]], range, function (v) { range = v; drawAvg(); });
    drawAvg();

    /* ---- Monthly table ---- */
    var months = mk.months.slice().reverse();
    C.table($("month-table"), ["Month", "DA average", "DA volume-weighted", "DA solar 09–16h", "DA evening 18–22h", "DA spread", "RT average", "RT spread", "G-DAM average", "HP-DAM blocks cleared"],
      months.map(function (m) {
        return { cls: m.complete ? "" : "is-ref", cells: [F.month(m.month) + (m.complete ? "" : " (" + m.days + " days)"), F.num(m.dam.avg), F.num(m.dam.vwap), F.num(m.dam.solar), F.num(m.dam.evening), F.num(m.dam.spread), F.num(m.rtm.avg), F.num(m.rtm.spread),
          m.gdam ? F.num(m.gdam.avg) : "–", m.hpdam ? F.num(m.hpdam.cleared_blocks) : "–"] };
      }), { caption: "₹/MWh. Averages are simple means of 15-minute blocks unless marked volume-weighted. G-DAM and HP-DAM from April 2024." });
    $("csv-months").addEventListener("click", function () {
      C.downloadCSV("zoltiq-iex-monthly.csv", ["month", "days", "dam_avg", "dam_vwap", "dam_solar_09_16", "dam_evening_18_22", "dam_spread", "rtm_avg", "rtm_solar_09_16", "rtm_evening_18_22", "rtm_spread", "gdam_avg", "hpdam_blocks_cleared"],
        mk.months.map(function (m) { return [m.month, m.days, m.dam.avg, m.dam.vwap, m.dam.solar, m.dam.evening, m.dam.spread, m.rtm.avg, m.rtm.solar, m.rtm.evening, m.rtm.spread, m.gdam ? m.gdam.avg : "", m.hpdam ? m.hpdam.cleared_blocks : ""]; }));
    });
    $("csv-daily").addEventListener("click", function () { C.downloadCSV("zoltiq-iex-daily.csv", f, daily); });
  }).catch(function (e) { console.error(e); var m = $("data-error"); if (m) m.hidden = false; });
})();
