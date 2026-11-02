/* Zoltiq — hero animation: one day on India's grid, looping slowly.
   The sun rises from behind the ground on the left, crosses the sky and sets on the right
   (it is drawn on a canvas behind the pylon picture, so the horizon hides it). Underneath, the
   96 fifteen-minute blocks of the day light up as the day passes: solar hours in the accent
   colour, the evening peak in full ink. Bar heights are a sample shape, not prices. */
(function () {
  "use strict";
  var hero = document.querySelector(".hero");
  var canvas = document.getElementById("hero-sky");
  var layer = document.querySelector(".hero-slide");
  var barsEl = document.getElementById("daybars");
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var clockEl = document.getElementById("hero-clock");
  var phaseEl = document.getElementById("hero-phase");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Typical intraday shape: overnight plateau, morning ramp, solar dip, evening peak (sample).
  var keys = [[0, .50], [3, .42], [5, .45], [7, .60], [9, .55], [10.5, .30], [12, .13], [14, .15], [15.5, .30],
    [17, .55], [18.5, .88], [19.5, 1], [21, .94], [22.5, .70], [24, .52]];
  function level(h) {
    for (var i = 1; i < keys.length; i++) {
      if (h <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i];
        return a[1] + (b[1] - a[1]) * (h - a[0]) / (b[0] - a[0]);
      }
    }
    return keys[keys.length - 1][1];
  }
  var PHASES = [[0, "Night"], [6, "Morning ramp"], [9.5, "Solar hours"], [16, "Sunset"], [18, "Evening peak"], [23, "Night"]];
  function phase(h) { var p = PHASES[0][1]; PHASES.forEach(function (x) { if (h >= x[0]) p = x[1]; }); return p; }

  // The 96 bars.
  var bars = [];
  if (barsEl) {
    for (var i = 0; i < 96; i++) {
      var b = document.createElement("i");
      var hour = (i + 0.5) / 4;
      b.style.setProperty("--h", Math.max(0.08, level(hour) + 0.03 * Math.sin(i * 1.7)).toFixed(3));
      if (hour >= 9 && hour < 16.5) b.className = "sun";
      else if (hour >= 17.5 && hour < 23) b.className = "eve";
      barsEl.appendChild(b);
      bars.push(b);
    }
  }

  // Where the picture's horizon and sky sit on screen (the picture is object-fit: cover).
  var IW = 2000, IH = 1170, HORIZON = 0.72;
  var W = 0, H = 0, dpr = 1, geo = null;
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hr = hero.getBoundingClientRect(), r = layer.getBoundingClientRect();
    var scale = Math.max(r.width / IW, r.height / IH);
    var pos = getComputedStyle(layer).objectPosition.split(" ").map(function (v) { return parseFloat(v) / 100; });
    var offX = r.left - hr.left + (r.width - IW * scale) * (isNaN(pos[0]) ? 0.5 : pos[0]);
    var offY = r.top - hr.top + (r.height - IH * scale) * (isNaN(pos[1]) ? 0.5 : pos[1]);
    var toX = function (u) { return offX + u * IW * scale; };
    geo = {
      horizon: offY + HORIZON * IH * scale,
      x0: Math.max(W < 760 ? W * 0.12 : W * 0.5, toX(0.32)),
      x1: Math.min(W * 0.98, toX(0.97)),
      r: Math.max(18, 0.07 * IH * scale)
    };
    geo.top = Math.max(geo.r * 1.6, offY + 0.12 * IH * scale);
  }

  var accent = "#ff7a1a";
  function readColours() { accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || accent; }

  var lastBlock = -1;
  function draw(h) {
    if (!geo) return;
    ctx.clearRect(0, 0, W, H);
    // Sun: rises at 06:00, sets at 18:30, behind the horizon of the picture.
    var t = (h - 6) / 12.5;
    if (t > -0.05 && t < 1.05) {
      var sx = geo.x0 + t * (geo.x1 - geo.x0);
      var sy = geo.horizon + geo.r * 1.1 - Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * (geo.horizon - geo.top);
      var glow = ctx.createRadialGradient(sx, sy, geo.r * 0.8, sx, sy, geo.r * 4.5);
      glow.addColorStop(0, hexA(accent, 0.28));
      glow.addColorStop(1, hexA(accent, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(sx - geo.r * 5, sy - geo.r * 5, geo.r * 10, geo.r * 10);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(sx, sy, geo.r, 0, Math.PI * 2); ctx.fill();
    }
    var block = Math.floor(h * 4);
    if (block !== lastBlock) {
      lastBlock = block;
      bars.forEach(function (b, k) { b.classList.toggle("on", k <= block); b.classList.toggle("cur", k === block); });
      var hh = Math.floor(h), mm = Math.floor((h - hh) * 4) * 15;
      if (clockEl) clockEl.textContent = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
      if (phaseEl) phaseEl.textContent = phase(h);
    }
  }
  function hexA(c, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (!m) return "rgba(255,122,26," + a + ")";
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }

  function setup() { size(); readColours(); lastBlock = -1; }
  setup();
  addEventListener("resize", function () { setup(); if (reduce) draw(12.5); });
  if (layer && !layer.complete) layer.addEventListener("load", setup);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup);
  new MutationObserver(readColours).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  var mq = matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", readColours);

  if (reduce) { draw(12.5); return; }

  var DAY_MS = 30000;                       // one day every 30 seconds
  var start = performance.now() - DAY_MS * (5.5 / 24);   // begin just before sunrise
  var running = true, raf = 0;
  function frame(now) {
    draw(((now - start) % DAY_MS) / DAY_MS * 24);
    raf = running ? requestAnimationFrame(frame) : 0;
  }
  function setRunning(on) {
    if (on && !running) { running = true; raf = requestAnimationFrame(frame); }
    if (!on) { running = false; cancelAnimationFrame(raf); }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { setRunning(e[0].isIntersecting && !document.hidden); }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { setRunning(!document.hidden); });
  raf = requestAnimationFrame(frame);
})();
