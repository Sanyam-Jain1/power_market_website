/* Zoltiq — hero animation: one day on India's grid, looping slowly.
   The sun crosses the sky, the 96 fifteen-minute blocks of the day light up as the day passes,
   solar hours glow warm and the evening peak glows blue. The bar heights are a sample shape, not prices. */
(function () {
  "use strict";
  var canvas = document.getElementById("hero-canvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var clock = document.getElementById("hero-clock");
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
  var bars = [];
  for (var i = 0; i < 96; i++) bars.push(Math.max(0.08, level((i + 0.5) / 4) + 0.03 * Math.sin(i * 1.7)));
  var lights = [];
  for (var j = 0; j < 140; j++) lights.push([Math.random(), 0.72 + Math.random() * 0.26, Math.random() * 6.28]);

  var PHASES = [[0, "Night"], [6, "Morning ramp"], [9.5, "Solar hours"], [16, "Sunset"], [18, "Evening peak"], [23, "Night"]];
  function phase(h) { var p = PHASES[0][1]; PHASES.forEach(function (x) { if (h >= x[0]) p = x[1]; }); return p; }

  var band = document.querySelector(".hero-band");
  var copy = canvas.parentElement.querySelector(".wrap");
  var W = 0, H = 0, dpr = 1, margin = 16, bandTop = 0, base = 0;
  function size() {
    if (band) { bandTop = band.offsetTop; base = bandTop + band.offsetHeight; }
    if (copy) margin = copy.offsetLeft + parseFloat(getComputedStyle(copy).paddingLeft);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  addEventListener("resize", function () { size(); if (reduce) draw(19.25); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { size(); if (reduce) draw(19.25); });

  var DAY_MS = 28000;
  var lastLabel = "";

  function draw(hour) {
    ctx.clearRect(0, 0, W, H);
    var narrow = W < 700;
    if (!base) { bandTop = H * 0.7; base = H - 20; }
    var bandH = base - bandTop;

    // Sun: rises at 6:00, sets at 18:30.
    var dayT = (hour - 6) / 12.5;
    if (dayT > 0 && dayT < 1) {
      var sx = margin + dayT * (W - margin * 2);
      var sy = bandTop - Math.sin(Math.PI * dayT) * bandTop * 0.8;
      var elev = Math.sin(Math.PI * dayT);
      var glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.55);
      glow.addColorStop(0, "rgba(200,232,255," + (0.30 * elev + 0.04).toFixed(3) + ")");
      glow.addColorStop(0.35, "rgba(150,205,255," + (0.10 * elev).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(150,205,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      var core = ctx.createRadialGradient(sx, sy, 0, sx, sy, narrow ? 34 : 56);
      core.addColorStop(0, "rgba(255,246,220," + (0.75 * elev + 0.1).toFixed(3) + ")");
      core.addColorStop(1, "rgba(255,246,220,0)");
      ctx.fillStyle = core;
      ctx.fillRect(sx - 60, sy - 60, 120, 120);
    }
    // Night: a cool wash and city lights after sunset.
    var night = hour >= 18 ? Math.min(1, (hour - 18) / 2) : hour < 6 ? 1 - hour / 6 * 0.6 : 0;
    if (night > 0) {
      ctx.fillStyle = "rgba(40,70,160," + (0.16 * night).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    // The 96 blocks of the day.
    var step = (W - margin * 2) / 96, gap = Math.max(1, step * 0.28);
    var current = Math.floor(hour * 4);
    for (var i = 0; i < 96; i++) {
      var h = bars[i] * bandH;
      var x = margin + i * step;
      var bh = (i + 0.5) / 4;
      var passed = i <= current;
      var color;
      if (!passed) color = "rgba(255,255,255,0.09)";
      else if (bh >= 9 && bh < 16.5) color = "rgba(255,195,90,0.88)";
      else if (bh >= 17.5 && bh < 23) color = "rgba(255,138,106,0.92)";
      else color = "rgba(243,242,239,0.45)";
      if (i === current) color = "#fff";
      ctx.fillStyle = color;
      ctx.fillRect(x + gap / 2, base - h, step - gap, h);
    }
    // Time cursor.
    var cx = margin + (current + 0.5) * step;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(cx - 0.5, bandTop, 1, bandH - bars[current] * bandH);
    // Base line.
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(margin, base + 6, W - margin * 2, 1);

    // City lights at night.
    if (night > 0.05) {
      lights.forEach(function (l, k) {
        var a = night * (0.25 + 0.25 * Math.sin(l[2] + hour * 3 + k));
        ctx.fillStyle = "rgba(190,210,255," + a.toFixed(3) + ")";
        ctx.fillRect(margin + l[0] * (W - margin * 2), bandTop + bandH * (l[1] - 0.72) * 2.5, 1.5, 1.5);
      });
    }

    var hh = Math.floor(hour), mm = Math.floor((hour - hh) * 4) * 15;
    var label = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
    if (label !== lastLabel) {
      lastLabel = label;
      if (clock) clock.textContent = label;
      if (phaseEl) phaseEl.textContent = phase(hour);
    }
  }

  if (reduce) { draw(19.25); return; }

  var start = performance.now() - DAY_MS * (7 / 24); // begin the loop in the morning
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
    new IntersectionObserver(function (e) { setRunning(e[0].isIntersecting && !document.hidden); }).observe(canvas);
  }
  document.addEventListener("visibilitychange", function () { setRunning(!document.hidden); });
  raf = requestAnimationFrame(frame);
})();
