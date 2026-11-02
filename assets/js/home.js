/* Zoltiq — Home page behaviour. */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Now trading: the current 15-minute block in India (IST = UTC+5:30) ---- */
  function istMinutes(d) { return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440; }
  function hhmm(m) { m = (m + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm; }
  var blockEl = document.getElementById("now-block");
  var timeEl = document.getElementById("now-time");
  function tick() {
    var m = istMinutes(new Date());
    var block = Math.floor(m / 15) + 1;
    if (blockEl) blockEl.textContent = block;
    if (timeEl) timeEl.textContent = hhmm((block - 1) * 15) + "–" + hhmm(block * 15) + " IST";
    var marker = document.getElementById("now-marker");
    if (marker) marker.style.left = ((block - 0.5) / 96 * 100).toFixed(2) + "%";
  }
  tick();
  setInterval(tick, 30000);

  /* ---- Sheets: choose a document, see it on the stage ---- */
  var tabs = [].slice.call(document.querySelectorAll("[data-sheet-tab]"));
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-sheet-tab");
      tabs.forEach(function (t) { t.setAttribute("aria-pressed", t === tab ? "true" : "false"); });
      [].forEach.call(document.querySelectorAll("[data-sheet]"), function (s) {
        var on = s.getAttribute("data-sheet") === id;
        s.hidden = !on;
        if (on) { s.classList.remove("swap"); void s.offsetWidth; s.classList.add("swap"); }
      });
    });
  });

  /* ---- Research deck: cards fold into spines as you scroll (wide screens) ---- */
  var deckWrap = document.querySelector(".deck-wrap");
  var cards = deckWrap ? [].slice.call(deckWrap.querySelectorAll(".deck-card")) : [];
  function deckActive(i) {
    cards.forEach(function (c, k) {
      c.classList.toggle("is-spine", k < i);
      c.classList.toggle("is-active", k === i);
    });
  }
  function onDeckScroll() {
    if (!deckWrap || innerWidth < 1000) return;
    var r = deckWrap.getBoundingClientRect();
    var span = deckWrap.offsetHeight - innerHeight;
    var p = Math.min(1, Math.max(0, -r.top / (span || 1)));
    deckActive(Math.min(cards.length - 1, Math.floor(p * cards.length)));
  }
  if (cards.length) {
    deckActive(0);
    addEventListener("scroll", onDeckScroll, { passive: true });
    addEventListener("resize", onDeckScroll);
    cards.forEach(function (c, k) {
      c.querySelector(".spine-hit").addEventListener("click", function () {
        var span = deckWrap.offsetHeight - innerHeight;
        scrollTo({ top: deckWrap.offsetTop + span * (k + 0.5) / cards.length, behavior: reduce ? "auto" : "smooth" });
      });
    });
  }

  /* ---- Live data from data/ ---- */
  var F = ZoltiqCharts.fmt;
  function each(sel, fn) { [].forEach.call(document.querySelectorAll(sel), fn); }
  function set(sel, text) { each(sel, function (e) { e.textContent = text; }); }

  var curve = document.getElementById("day-curve");
  ZOLTIQ.loadJSON("data/market-snapshot.json").then(function (d) {
    if (curve) ZoltiqCharts.dayCurve(curve, d);
    var sd = d.stats.dam;
    set('[data-snap="date"]', F.date(d.date));
    set('[data-snap="spread"]', F.rs(sd.spread) + " / MWh");
    set('[data-snap="rtda"]', (d.stats.rt_minus_da > 0 ? "+" : "") + F.rs(d.stats.rt_minus_da).replace("₹-", "−₹") + " / MWh");
    set('[data-snap="high"]', F.block(sd.max_block) + " · " + F.rs(sd.max));
    set('[data-snap="low"]', F.block(sd.min_block) + " · " + F.rs(sd.min));
    // the hero's 96 bars take the day's real day-ahead shape
    var bars = document.querySelectorAll("#daybars i"), lo = sd.min, hi = sd.max;
    d.dam.forEach(function (v, i) {
      if (bars[i] && v != null) bars[i].style.setProperty("--h", (0.08 + 0.92 * (v - lo) / ((hi - lo) || 1)).toFixed(3));
    });
    set("#hero-note", "Day-ahead prices on " + F.date(d.date) + ", 96 blocks · ₹" + F.num(lo) + " to ₹" + F.num(hi) + " /MWh");
  }).catch(function () { if (curve) curve.replaceWith(Object.assign(document.createElement("p"), { textContent: "Market data is unavailable right now." })); });

  var bars = document.getElementById("index-bars");
  ZOLTIQ.loadJSON("data/backtests.json").then(function (bt) {
    var R = bt.results, months = bt.months, n = months.length;
    var head = R[bt.headline], ph = R["2h|DAM|PH|c1|any"], b0 = R["2h|DAM|B0|c1|any"], t1 = R["2h|BOTH|T1|c1|any"], x = R["2h|BOTH|PH|c1|any"];
    var last = head.monthly_rs_mw[n - 1];
    set('[data-idx="month"]', F.monthLong(months[n - 1]));
    set("#hero-index-month", F.month(months[n - 1]));
    set('[data-idx="value"]', F.lakh(last, 2));
    set('[data-idx="lakh"]', "₹" + F.num(last / 1e5, 2) + " lakh");
    set('[data-idx="claim"]', "Last 12 months: ₹" + F.num(head.last_12m.lakh_mw_yr, 1) + " lakh per MW-year, " + F.pct(head.last_12m.capture) + " of the best possible in hindsight.");
    var mini = document.getElementById("mini-bars");
    if (mini) {
      var vals = head.monthly_rs_mw.slice(-12), top = Math.max.apply(null, vals);
      vals.forEach(function (v) { var i = document.createElement("i"); i.style.height = Math.max(4, 100 * v / top).toFixed(1) + "%"; mini.appendChild(i); });
    }
    if (bars) {
      var v14 = head.monthly_rs_mw.slice(-14), m14 = months.slice(-14);
      ZoltiqCharts.edgeBars(bars, v14, { labels: m14.map(F.monthLong), valueText: function (v) { return F.lakh(v, 2) + " per MW"; } });
    }
    var cr = function (r) { return F.crore(r.last_12m.lakh_mw_yr * 1e5 * 100, 1); };
    set('[data-est="ph"]', cr(ph)); set('[data-est="b2"]', cr(head)); set('[data-est="b0"]', cr(b0)); if (t1) set('[data-est="t1"]', cr(t1));
    var l = function (r) { return "₹" + F.num(r.last_12m.lakh_mw_yr, 1) + " lakh"; };
    set('[data-st="b0"]', l(b0)); set('[data-st="b2"]', l(head)); if (x) set('[data-st="x"]', l(x)); if (t1) set('[data-st="t1"]', l(t1));
    set('[data-st="b0cap"]', F.pct(b0.last_12m.capture)); set('[data-st="b2cap"]', F.pct(head.last_12m.capture));
    var max = x ? x.last_12m.lakh_mw_yr : ph.last_12m.lakh_mw_yr;
    each('[data-bar="b0"]', function (e) { e.style.width = (100 * b0.last_12m.lakh_mw_yr / max).toFixed(1) + "%"; });
    if (t1) each('[data-bar="t1"]', function (e) { e.style.width = (100 * t1.last_12m.lakh_mw_yr / max).toFixed(1) + "%"; });
    each('[data-bar="b2"]', function (e) { e.style.width = (100 * head.last_12m.lakh_mw_yr / max).toFixed(1) + "%"; });
    each('[data-bar="x"]', function (e) { e.style.width = "100%"; });
    var plans = bt.latest_day && bt.latest_day.plans;
    if (plans) {
      fill("sched-simple", plans.B0);
      fill("sched-opt", plans.B2);
      set('[data-st="plandate"]', F.date(bt.latest_day.date));
    }
  }).catch(function () { if (bars) bars.remove(); });

  /* An hour-by-hour schedule (c = charge, s = sell). */
  function fill(id, plan) {
    var ol = document.getElementById(id); if (!ol) return;
    ol.textContent = "";
    for (var hr = 0; hr < 24; hr++) {
      var li = document.createElement("li");
      li.className = plan[hr] || "";
      li.innerHTML = (hr < 10 ? "0" : "") + hr + ":00<span></span>";
      ol.appendChild(li);
    }
  }
})();
