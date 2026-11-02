/* Zoltiq — hero animation: one day on India's grid, looping slowly.
   The canvas paints the sky and ground in the colours of the hour (night, dawn, midday, golden
   hour, sunset, dusk), with the sun or moon, stars and city lights. The pylons are a see-through
   picture on top (a dark-ink version by day, a light-ink version by night). The headline switches
   between dark and light text with the sky. Underneath, the day's 96 blocks light up in step.
   Bar heights are a sample shape, not prices. */
(function () {
  "use strict";
  var hero = document.querySelector(".hero");
  var canvas = document.getElementById("hero-sky");
  var dayInk = document.querySelector(".hero-pylons.day");
  var nightInk = document.querySelector(".hero-pylons.night");
  var barsEl = document.getElementById("daybars");
  var header = document.querySelector(".site-header");
  if (!hero || !canvas || !canvas.getContext || !dayInk) return;
  var ctx = canvas.getContext("2d");
  var clockEl = document.getElementById("hero-clock");
  var phaseEl = document.getElementById("hero-phase");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Sample price shape and phases of the day ---- */
  var keys = [[0, .50], [3, .42], [5, .45], [7, .60], [9, .55], [10.5, .30], [12, .13], [14, .15], [15.5, .30],
    [17, .55], [18.5, .88], [19.5, 1], [21, .94], [22.5, .70], [24, .52]];
  function level(h) {
    for (var i = 1; i < keys.length; i++) {
      if (h <= keys[i][0]) { var a = keys[i - 1], b = keys[i]; return a[1] + (b[1] - a[1]) * (h - a[0]) / (b[0] - a[0]); }
    }
    return keys[keys.length - 1][1];
  }
  var PHASES = [[0, "Night"], [5.5, "Dawn"], [7, "Morning ramp"], [9.5, "Solar hours"], [16, "Golden hour"], [18, "Evening peak"], [23, "Night"]];
  function phase(h) { var p = PHASES[0][1]; PHASES.forEach(function (x) { if (h >= x[0]) p = x[1]; }); return p; }

  /* ---- Colours of the sky by hour: [hour, sky top, sky at horizon, ground, sun] ---- */
  var SKY = [
    [0,    "#060a19", "#141f47", "#070a14", "#e8edff"],
    [4.8,  "#0b1230", "#2a2f63", "#0a0e1c", "#e8edff"],
    [5.8,  "#2c3a7a", "#e3828a", "#2a2236", "#ff8a4c"],
    [6.8,  "#5f8fd6", "#ffc29a", "#8a8790", "#ffb06a"],
    [8.5,  "#4f9ff0", "#cfe6ff", "#c9ced6", "#fff1c8"],
    [12.5, "#3f97ef", "#e4f2ff", "#d6dbe2", "#fff8e0"],
    [15.5, "#4d93e4", "#ffe7bd", "#cdc6bb", "#ffe3a0"],
    [17.2, "#5a6fbf", "#ffb46a", "#a8907c", "#ffa24a"],
    [18.3, "#3a347a", "#ff6a4a", "#4a2c3a", "#ff6a3a"],
    [19.2, "#1b1d50", "#9b3f6c", "#1a1426", "#ff6a3a"],
    [20.5, "#0a1028", "#1d2856", "#080b16", "#e8edff"],
    [24,   "#060a19", "#141f47", "#070a14", "#e8edff"]
  ];
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  SKY.forEach(function (row) { for (var k = 1; k < 5; k++) row[k] = hex(row[k]); });
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, a) { return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (a == null ? 1 : a) + ")"; }
  function luminance(c) {
    var v = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function skyAt(h) {
    var i = 0;
    while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
    var A = SKY[i], B = SKY[i + 1], t = (h - A[0]) / (B[0] - A[0]);
    t = t * t * (3 - 2 * t);
    return { top: mix(A[1], B[1], t), horizon: mix(A[2], B[2], t), ground: mix(A[3], B[3], t), sun: mix(A[4], B[4], t) };
  }
  // How dark the sky is (0 day … 1 night), used for the headline colour, pylon ink, stars and lights.
  function nightness(h) {
    if (h < 5.2 || h >= 20) return 1;
    if (h < 7) return 1 - (h - 5.2) / 1.8;
    if (h < 17.8) return 0;
    return (h - 17.8) / 2.2;
  }

  /* ---- The 96 bars ---- */
  var bars = [];
  if (barsEl) {
    for (var i = 0; i < 96; i++) {
      var b = document.createElement("i"), hour = (i + 0.5) / 4;
      b.style.setProperty("--h", Math.max(0.08, level(hour) + 0.03 * Math.sin(i * 1.7)).toFixed(3));
      if (hour >= 9 && hour < 16.5) b.className = "sun";
      else if (hour >= 17.5 && hour < 23) b.className = "eve";
      barsEl.appendChild(b); bars.push(b);
    }
  }

  /* ---- Where the picture's horizon sits on screen (object-fit: cover) ---- */
  var IW = 2000, IH = 1170, HORIZON = 0.72;
  var W = 0, H = 0, dpr = 1, geo = null;
  var stars = [], lights = [];
  function seeded(n) { var s = n; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hr = hero.getBoundingClientRect(), r = dayInk.getBoundingClientRect();
    var scale = Math.max(r.width / IW, r.height / IH);
    var pos = getComputedStyle(dayInk).objectPosition.split(" ").map(function (v) { return parseFloat(v) / 100; });
    var offX = r.left - hr.left + (r.width - IW * scale) * (isNaN(pos[0]) ? 0.5 : pos[0]);
    var offY = r.top - hr.top + (r.height - IH * scale) * (isNaN(pos[1]) ? 0.5 : pos[1]);
    geo = {
      horizon: offY + HORIZON * IH * scale,
      x0: Math.max(W < 760 ? W * 0.12 : W * 0.5, offX + 0.32 * IW * scale),
      x1: Math.min(W * 0.98, offX + 0.97 * IW * scale),
      r: Math.max(18, 0.07 * IH * scale)
    };
    geo.top = Math.max(geo.r * 1.6, offY + 0.12 * IH * scale);
    var rnd = seeded(7);
    stars = []; for (var k = 0; k < 160; k++) stars.push([rnd() * W, rnd() * geo.horizon * 0.95, rnd() * 1.3 + 0.4, rnd() * 6.28]);
    lights = []; for (var j = 0; j < 220; j++) lights.push([rnd() * W, geo.horizon - 2 - rnd() * 10, rnd() * 6.28, rnd() < 0.7]);
  }

  var lastBlock = -1, wasNight = null;
  function draw(h) {
    if (!geo) return;
    var sky = skyAt(h), night = nightness(h);
    // Sky
    var g = ctx.createLinearGradient(0, 0, 0, geo.horizon);
    g.addColorStop(0, rgb(sky.top)); g.addColorStop(1, rgb(sky.horizon));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, geo.horizon + 1);
    // Stars
    if (night > 0.05) {
      stars.forEach(function (s) {
        ctx.fillStyle = "rgba(235,240,255," + (night * (0.35 + 0.45 * Math.sin(s[3] + h * 2.4))).toFixed(3) + ")";
        ctx.fillRect(s[0], s[1], s[2], s[2]);
      });
    }
    // Sun (06:00 to 18:30) or moon (evening and night)
    var t = (h - 6) / 12.5;
    if (t > -0.06 && t < 1.06) {
      var sx = geo.x0 + t * (geo.x1 - geo.x0);
      var sy = geo.horizon + geo.r * 1.1 - Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * (geo.horizon - geo.top);
      var glow = ctx.createRadialGradient(sx, sy, geo.r * 0.6, sx, sy, geo.r * 6);
      glow.addColorStop(0, rgb(sky.sun, 0.45)); glow.addColorStop(1, rgb(sky.sun, 0));
      ctx.fillStyle = glow; ctx.fillRect(sx - geo.r * 6, sy - geo.r * 6, geo.r * 12, geo.r * 12);
      ctx.fillStyle = rgb(sky.sun); ctx.beginPath(); ctx.arc(sx, sy, geo.r, 0, Math.PI * 2); ctx.fill();
    } else {
      var mt = ((h + 24 - 18.8) % 24) / 11;         // moon from about 19:00 to 06:00
      if (mt > 0 && mt < 1) {
        var mx = geo.x1 - mt * (geo.x1 - geo.x0), my = geo.horizon + geo.r - Math.sin(Math.PI * mt) * (geo.horizon - geo.top) * 0.85, mr = geo.r * 0.62;
        ctx.fillStyle = "rgba(232,237,255,0.95)"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(skyAt(h).top); ctx.beginPath(); ctx.arc(mx + mr * 0.42, my - mr * 0.22, mr * 0.86, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Ground, with the far ridge a shade darker
    ctx.fillStyle = rgb(mix(sky.ground, [0, 0, 0], 0.18));
    ctx.beginPath(); ctx.moveTo(0, geo.horizon);
    for (var X = 0; X <= W + 20; X += 20) ctx.lineTo(X, geo.horizon - 6 - 10 * (0.5 + 0.5 * Math.sin(X / W * 7 + 11)));
    ctx.lineTo(W, geo.horizon + 2); ctx.lineTo(0, geo.horizon + 2); ctx.fill();
    var gg = ctx.createLinearGradient(0, geo.horizon, 0, H);
    gg.addColorStop(0, rgb(sky.ground)); gg.addColorStop(1, rgb(mix(sky.ground, [0, 0, 0], 0.25)));
    ctx.fillStyle = gg; ctx.fillRect(0, geo.horizon, W, H - geo.horizon);
    // City lights along the horizon after dark
    if (night > 0.2) {
      lights.forEach(function (l) {
        ctx.fillStyle = (l[3] ? "rgba(255,206,110," : "rgba(255,140,110,") + (night * (0.5 + 0.4 * Math.sin(l[2] + h * 3))).toFixed(3) + ")";
        ctx.fillRect(l[0], l[1], 2, 2);
      });
    }
    // Pylon ink follows the sky; headline colour too.
    dayInk.style.opacity = (1 - night).toFixed(3);
    if (nightInk) nightInk.style.opacity = night.toFixed(3);
    // Light text whenever the sky behind the words is dark (by its actual brightness, not the clock).
    var behind = mix(sky.top, sky.horizon, 0.3);
    var isNight = luminance(behind) < 0.18;
    if (isNight !== wasNight) {
      wasNight = isNight;
      hero.classList.toggle("is-night", isNight);
      if (header) header.classList.toggle("over-night", isNight);
    }
    // Time bar
    var block = Math.floor(h * 4);
    if (block !== lastBlock) {
      lastBlock = block;
      bars.forEach(function (bar, k) { bar.classList.toggle("on", k <= block); bar.classList.toggle("cur", k === block); });
      var hh = Math.floor(h), mm = Math.floor((h - hh) * 4) * 15;
      if (clockEl) clockEl.textContent = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
      if (phaseEl) phaseEl.textContent = phase(h);
    }
  }

  // A page can freeze the sky at one hour with data-hour on the hero (the other pages do this).
  var fixedHour = hero.hasAttribute("data-hour") ? parseFloat(hero.getAttribute("data-hour")) : null;
  var current = fixedHour != null ? fixedHour : 17.4;
  function setup() { size(); lastBlock = -1; wasNight = null; draw(current); }
  setup();
  addEventListener("resize", setup);
  if (!dayInk.complete) dayInk.addEventListener("load", setup);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup);

  if (reduce || fixedHour != null) return;  // still frame

  var DAY_MS = 40000;                       // one day every 40 seconds
  var start = performance.now() - DAY_MS * (5 / 24);   // begin before dawn
  var running = true, raf = 0;
  function frame(now) {
    current = ((now - start) % DAY_MS) / DAY_MS * 24;
    draw(current);
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
