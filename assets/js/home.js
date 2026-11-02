/* Zoltiq — Home page behaviour. */
(function () {
  "use strict";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Now trading: the current 15-minute block in India (IST = UTC+5:30) ---- */
  function istMinutes(d) { return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440; }
  function hhmm(m) { m = (m + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm; }
  function phaseFor(m) {
    if (m >= 600 && m < 900) return "noon";
    if ((m >= 360 && m < 600) || (m >= 900 && m < 1050)) return "day";
    if (m >= 1050 && m < 1170) return "sunset";
    return "night";
  }
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

  /* ---- Hero: the same view at four times of day, crossfading slowly ---- */
  var hero = document.querySelector(".hero");
  var slides = hero ? [].slice.call(hero.querySelectorAll(".hero-slide")) : [];
  if (slides.length) {
    var order = ["noon", "day", "sunset", "night"];
    var current = order.indexOf(phaseFor(istMinutes(new Date())));
    function show(i) {
      slides.forEach(function (s) {
        var on = s.getAttribute("data-phase") === order[i];
        s.classList.toggle("is-on", on);
        if (on && s.dataset.src && !s.getAttribute("src")) s.setAttribute("src", s.dataset.src);
      });
      hero.setAttribute("data-phase", order[i]);
      if (header) header.classList.toggle("on-dark", order[i] === "night");
    }
    var header = document.querySelector(".site-header");
    show(current);
    if (!reduce) {
      // Load the other three views after the page is ready, then cycle every 6 seconds.
      addEventListener("load", function () {
        slides.forEach(function (s) { if (s.dataset.src && !s.getAttribute("src")) s.setAttribute("src", s.dataset.src); });
      });
      var timer = setInterval(function () {
        if (document.hidden || scrollY > innerHeight) return;
        current = (current + 1) % order.length;
        show(current);
      }, 6000);
    }
  }

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

  /* ---- Charts from data/ ---- */
  var curve = document.getElementById("day-curve");
  if (curve) ZOLTIQ.loadJSON("data/market-snapshot.json").then(function (d) {
    ZoltiqCharts.dayCurve(curve, d);
  }).catch(function () { curve.replaceWith(Object.assign(document.createElement("p"), { textContent: "Market data is unavailable right now." })); });

  var bars = document.getElementById("index-bars");
  if (bars) ZOLTIQ.loadJSON("data/battery-index.json").then(function (d) {
    var vals = d.values.slice(-14);
    var labels = vals.map(function (_, i) { var back = vals.length - 1 - i; return back === 0 ? "Last month" : back === 1 ? "1 month earlier" : back + " months earlier"; });
    ZoltiqCharts.edgeBars(bars, vals, { labels: labels });
  }).catch(function () { bars.remove(); });
})();
