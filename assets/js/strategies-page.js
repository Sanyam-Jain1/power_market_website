/* Zoltiq — Strategies page. Reads data/backtests.json. */
(function () {
  "use strict";
  var C = window.ZoltiqCharts, F = C.fmt;
  var $ = function (id) { return document.getElementById(id); };
  var lakhY = function (v) { return v == null ? "–" : "₹" + F.num(v, 1) + " lakh"; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  ZOLTIQ.loadJSON("../data/backtests.json").then(function (bt) {
    var R = bt.results, months = bt.months, S = bt.strategies;
    var sel = { duration: "2h", cycles: 1 };
    var k = function (m, s, c, ch) { return [sel.duration, m, s, "c" + (c || sel.cycles), ch || "any"].join("|"); };
    var get = function (m, s, c, ch) { return R[k(m, s, c, ch)] || R[k(m, s, 1, ch)]; };
    [].forEach.call(document.querySelectorAll("[data-through]"), function (e) { e.textContent = F.date(bt.through); });

    function cumulative(vals) { var t = 0; return vals.map(function (v) { t += v || 0; return t; }); }

    /* ---- The answer: one number and four bars ---- */
    function drawResult() {
      var t1 = get("BOTH", "T1"), da = get("DAM", "B2"), b0 = get("DAM", "B0"), x = get("BOTH", "PH");
      var lease = bt.tolling && bt.tolling[sel.duration];
      if (!t1 || !x) return;
      $("r-val").textContent = "₹" + F.num(t1.last_12m.lakh_mw_yr, 1);
      $("r-name").textContent = S.T1 ? S.T1.name : "Day-ahead plan, corrected in real-time";
      var chips = $("r-chips"); chips.textContent = "";
      [["Share of the best possible", F.pct(t1.last_12m.capture)],
       ["Fixed schedule", lakhY(b0 && b0.last_12m.lakh_mw_yr)],
       lease ? ["Leased at " + lease.authority + "'s " + F.month(lease.result_date.slice(0, 7)) + " tariff", lakhY(lease.lakh_mw_yr)] : null
      ].forEach(function (c) { if (!c) return; var ch = el("span", "chip"); ch.appendChild(document.createTextNode(c[0])); ch.appendChild(el("b", null, c[1])); chips.appendChild(ch); });

      var rows = [
        [b0, "Fixed 11:00 / 18:00, no software", ""],
        [da, "Plan on last week's prices, day-ahead", ""],
        [t1, "Day-ahead plan, corrected in real-time", "win"],
        [x, "Best possible, both markets (hindsight)", "ceil"]
      ].filter(function (r) { return r[0]; });
      var max = x.last_12m.lakh_mw_yr * 1.04;
      var pod = $("podium");
      [].slice.call(pod.querySelectorAll(".pod-row")).forEach(function (n) { n.remove(); });
      var line = $("lease-line");
      rows.forEach(function (r) {
        var row = el("div", "pod-row " + r[2]);
        var top = el("div", "pod-top"); top.appendChild(el("span", null, r[1])); top.appendChild(el("span", null, lakhY(r[0].last_12m.lakh_mw_yr)));
        var track = el("div", "pod-track"), bar = el("i", "pod-bar");
        track.appendChild(bar); row.appendChild(top); row.appendChild(track);
        pod.insertBefore(row, line);
        requestAnimationFrame(function () { bar.style.width = (r[0].last_12m.lakh_mw_yr / max * 100).toFixed(1) + "%"; });
      });
      if (lease) {
        line.hidden = false;
        var pad = parseFloat(getComputedStyle(pod).paddingLeft);
        var inner = pod.clientWidth - pad * 2;
        line.style.left = (pad + lease.lakh_mw_yr / max * inner).toFixed(1) + "px";
        $("lease-tag").textContent = "Lease: " + lakhY(lease.lakh_mw_yr);
        var cap = $("pod-cap"); cap.hidden = false;
        cap.textContent = "Leasing the battery at " + lease.authority + "'s " + F.month(lease.result_date.slice(0, 7)) + " tender tariff: " + lakhY(lease.lakh_mw_yr) + " a year, fixed.";
        // the line spans the bars only, from the first track's top edge to the last track's bottom
        var tracks = pod.querySelectorAll(".pod-track"), first = tracks[0], last = tracks[tracks.length - 1];
        if (first && last) {
          var t0 = first.offsetTop - 10, t1 = last.offsetTop + last.offsetHeight + 6;
          line.style.top = t0 + "px";
          line.style.bottom = "auto";
          line.style.height = (t1 - t0) + "px";
        }
      }
    }

    /* ---- Over time ---- */
    function drawRace() {
      var lines = [
        ["BOTH", "PH", "Best possible, both markets (hindsight)", "#9aa6bd", true],
        ["BOTH", "T1", "Day-ahead plan, corrected in real-time", "#ff7a1a"],
        ["DAM", "B2", "Plan on last week's prices, day-ahead", "#0b1230"],
        ["DAM", "B0", "Fixed 11:00 / 18:00", "#b9c2d3"]
      ];
      C.lineChart($("race"), {
        label: "Cumulative earnings per MW since May 2022",
        series: lines.map(function (l) { var r = get(l[0], l[1]); return { name: l[2], short: l[2], values: r ? cumulative(r.monthly_rs_mw) : [], color: l[3], dash: !!l[4] }; }),
        labels: months.map(function (m) { return "To end of " + F.monthLong(m); }), zero: true, height: 380,
        xTick: function (i) { return i < months.length && (months[i].slice(5) === "01" || i === 0) ? months[i].slice(0, 4) : null; },
        yFormat: function (v) { return "₹" + F.num(v / 1e5, 0) + "L"; }, tipFormat: function (v) { return F.lakh(v, 1); }
      });
      $("sel-note").textContent = bt.battery.durations[sel.duration] + " battery, up to " + sel.cycles + " cycle" + (sel.cycles > 1 ? "s" : "") +
        " a day (the fixed schedule always does 1). After exchange fees and ₹300/MWh wear.";
    }

    /* ---- Each schedule, side by side ---- */
    function drawSchedules() {
      var list = [
        ["BOTH", "T1", "By 22:00 the next day's day-ahead prices are public. Blended with last week's real-time prices, they are a better guide to real-time than either alone.", "Needs that blend: re-planning on day-ahead prices alone earned less than day-ahead only. Each correction pays a second exchange fee, so small differences are not worth trading."],
        ["BOTH", "XF", "When one market is reliably cheaper at the same hours. Real-time has been cheaper than day-ahead overnight and in the evening.", "Those are the hours a battery sells, not buys, and last week's averages rarely separate the two markets by enough. It ends up level with day-ahead alone."],
        ["DAM", "B2", "Day-ahead prices repeat: last week is a very good guide to tomorrow.", "Sudden changes: the first days of a heatwave, a monsoon break, a holiday."],
        ["RTM", "B2", "The same weekly pattern, in a market that clears closer to delivery.", "More than day-ahead: real-time prices are less repeatable, so a plan made the evening before leaves more behind."],
        ["DAM", "B0", "When the peak is early evening, the most common shape in the record.", "Days when the solar trough shifts later or the peak moves, and every chance of a second cycle."],
        ["DAM", "PH", "What a battery would earn knowing every day-ahead price in advance.", "It is not achievable. It shows how much room is left for better forecasting.", true],
        ["BOTH", "PH", "The same ceiling when trading both markets, block by block.", "It is not achievable, and larger than any single-market gap: the room a two-stage strategy has to work with.", true]
      ];
      var host = $("cards"); host.textContent = "";
      list.forEach(function (c) {
        var r = get(c[0], c[1]); if (!r) return;
        var name = c[0] === "BOTH" ? (c[1] === "PH" ? "Best possible, both markets" : S[c[1]].name) : S[c[1]].name;
        var market = c[1] === "PH" ? "Hindsight ceiling · " + bt.markets[c[0]].toLowerCase() : bt.markets[c[0]];
        var cap = c[1] === "PH" ? 1 : r.last_12m.capture;
        var row = el("article", "srow" + (c[1] === "T1" ? " win" : ""));
        var a = el("div"); a.appendChild(el("h3", null, name)); a.appendChild(el("p", "tagline", market));
        var b = el("div");
        var v = el("p", "val", lakhY(r.last_12m.lakh_mw_yr)); v.appendChild(el("small", null, "/ MW-yr")); b.appendChild(v);
        var m = el("div", "meter"), mi = el("i"); mi.style.width = Math.round(Math.min(1, cap) * 100) + "%"; m.appendChild(mi); b.appendChild(m);
        b.appendChild(el("p", "meter-lbl", c[1] === "PH" ? "The ceiling" : F.pct(cap) + " of the best possible" + (c[0] === "BOTH" ? " (both markets)" : "")));
        var n = el("div", "notes");
        (c[4] ? [["What it is", c[2]], ["Why it matters", c[3]]] : [["When it works", c[2]], ["What it misses", c[3]]]).forEach(function (t) { var p = el("p"); p.appendChild(el("b", null, t[0])); p.appendChild(document.createTextNode(t[1])); n.appendChild(p); });
        var facts = el("div", "facts");
        [["Since May 2022", lakhY(r.all.lakh_mw_yr) + " / MW-yr"],
         ["Best month", F.month(r.best_month) + " " + F.lakh(r.best_month_rs_mw, 1)],
         ["Worst month", F.month(r.worst_month) + " " + F.lakh(r.worst_month_rs_mw, 1)],
         ["Losing days", F.pct(r.losing_days, 1)]
        ].forEach(function (f) { var sp = el("span"); sp.appendChild(document.createTextNode(f[0] + " ")); sp.appendChild(el("b", null, f[1])); facts.appendChild(sp); });
        row.appendChild(a); row.appendChild(b); row.appendChild(n); row.appendChild(facts);
        host.appendChild(row);
      });
    }

    /* ---- What the backtests say ---- */
    function drawFindings() {
      var da = get("DAM", "B2"), daPH = get("DAM", "PH"), rt = get("RTM", "B2"), rtPH = get("RTM", "PH");
      var da2 = R[k("DAM", "B2", 2)], both2 = R[k("BOTH", "PH", 2)], solar = R[k("DAM", "B2", 1, "solar")];
      var da2s = R[k("DAM", "B2", 2, "solar")], b0 = get("DAM", "B0"), t1 = get("BOTH", "T1"), lease = bt.tolling && bt.tolling[sel.duration];
      var f = [];
      f.push([F.pct(da.all.capture), "Day-ahead prices are predictable from last week", "Planning on the last 7 days' average earned " + F.pct(da.all.capture) + " of the hindsight best on day-ahead since May 2022 (" + F.pct(da.last_12m.capture) + " in the last 12 months). Little is left for a better day-ahead forecast.", "of the hindsight best"]);
      f.push([lakhY(rtPH.all.lakh_mw_yr - rt.all.lakh_mw_yr), "Real-time leaves more on the table", "The same plan in real-time earned " + F.pct(rt.all.capture) + " of its hindsight best: " + lakhY(rtPH.all.lakh_mw_yr - rt.all.lakh_mw_yr) + " per MW-year left behind, against " + lakhY(daPH.all.lakh_mw_yr - da.all.lakh_mw_yr) + " on day-ahead.", "per MW-year left in real-time"]);
      if (t1) f.push(["+" + lakhY(t1.last_12m.lakh_mw_yr - da.last_12m.lakh_mw_yr), "Real-time pays as a correction, not on its own", "Committing the day-ahead plan and correcting it in real-time at 22:00 earned " + lakhY(t1.all.lakh_mw_yr) + " per MW-year since May 2022, against " + lakhY(da.all.lakh_mw_yr) + " for day-ahead alone, and " + lakhY(t1.last_12m.lakh_mw_yr) + " over the last 12 months against " + lakhY(da.last_12m.lakh_mw_yr) + ".", "a year from the correction"]);
      if (da2 && both2) f.push([lakhY(both2.all.lakh_mw_yr - da2.all.lakh_mw_yr), "Trading both markets is the big prize", "With two cycles a day, the hindsight ceiling across both markets is " + lakhY(both2.all.lakh_mw_yr) + " per MW-year, against " + lakhY(da2.all.lakh_mw_yr) + " for the best day-ahead plan. It is an upper bound, but larger than any single-market gap.", "room in two markets"]);
      if (da2) f.push(["+" + lakhY(da2.all.lakh_mw_yr - da.all.lakh_mw_yr), "A second cycle pays, even after wear", "Allowing two cycles a day lifts the day-ahead plan from " + lakhY(da.all.lakh_mw_yr) + " to " + lakhY(da2.all.lakh_mw_yr) + " per MW-year. The battery averages " + F.num(da2.cycles_per_day, 2) + " cycles a day: it skips second cycles that don't cover the wear.", "a year from a second cycle"]);
      if (solar && da2s && da2) f.push(["−" + lakhY(da2.all.lakh_mw_yr - da2s.all.lakh_mw_yr), "Charging only in the solar hours costs the second cycle", "If charging is allowed only from 10:00 to 15:00, the two-cycle plan drops from " + lakhY(da2.all.lakh_mw_yr) + " to " + lakhY(da2s.all.lakh_mw_yr) + " per MW-year; the one-cycle plan barely moves (" + lakhY(da.all.lakh_mw_yr) + " to " + lakhY(solar.all.lakh_mw_yr) + ").", "a year if charging is solar-only"]);
      f.push([F.pct(b0.all.capture), "A fixed schedule is a weak floor", "Charging at 11:00 and selling at 18:00 every day earned " + lakhY(b0.all.lakh_mw_yr) + " per MW-year since May 2022, " + F.pct(b0.all.capture) + " of the hindsight best, against " + lakhY(da.all.lakh_mw_yr) + " for planning on last week's prices.", "of the best, fixed schedule"]);
      if (lease) f.push([lakhY(lease.lakh_mw_yr), "Trading beat the latest tender tariff", "Leased at " + lease.authority + "'s " + F.month(lease.result_date.slice(0, 7)) + " tariff of ₹" + F.num(lease.lakh_mw_month, 2) + " lakh per MW-month, the battery would earn " + lakhY(lease.lakh_mw_yr) + " a year, fixed. On the exchange the day-ahead plan earned " + lakhY(da.last_12m.lakh_mw_yr) + " over the last 12 months, with no guarantee for the next twelve.", "a year, leased"]);
      var fl = $("findings"); fl.textContent = "";
      f.forEach(function (x) {
        var li = el("li"), st = el("p", "fstat", x[0]); st.appendChild(el("small", null, x[3] || "")); li.appendChild(st);
        var d = el("div"); d.appendChild(el("h3", null, x[1])); d.appendChild(el("p", null, x[2])); li.appendChild(d);
        fl.appendChild(li);
      });
    }

    function draw() { drawResult(); drawRace(); drawSchedules(); drawFindings(); }
    C.segmented($("st-duration"), [["2h", "2-hour"], ["4h", "4-hour"]], sel.duration, function (v) { sel.duration = v; draw(); });
    C.segmented($("st-cycles"), [[1, "1"], [2, "2"]], sel.cycles, function (v) { sel.cycles = v; draw(); });
    draw();
    addEventListener("resize", drawResult);
  }).catch(function (e) { console.error(e); var m = $("data-error"); if (m) m.hidden = false; });
})();
