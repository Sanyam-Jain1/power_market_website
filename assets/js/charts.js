/* Zoltiq — small SVG chart helpers. Colours come from the page theme (CSS variables).
   Every chart reads real values from data/*.json. Line and bar charts carry a hover layer
   (crosshair and tooltip) and a legend; series colours are --c1 … --c4 from site.css. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function finite(v) { return typeof v === "number" && isFinite(v); }
  function extent(arrays) {
    var lo = Infinity, hi = -Infinity;
    arrays.forEach(function (a) { a.forEach(function (v) { if (finite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }); });
    if (lo === Infinity) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 1; hi += 1; }
    return [lo, hi];
  }
  /* Round tick values: 1, 2, 2.5 or 5 x 10^n */
  function ticks(lo, hi, n) {
    var span = hi - lo, raw = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).filter(function (s) { return s >= raw; })[0];
    var out = [], v = Math.floor(lo / step) * step;
    for (; v <= hi + step * 0.5; v += step) out.push(+v.toFixed(10));
    return out;
  }

  /* ---- Formats (Indian grouping) ---- */
  var fmt = {
    num: function (v, d) { return finite(v) ? v.toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : "–"; },
    rs: function (v) { return finite(v) ? "₹" + fmt.num(v) : "–"; },
    lakh: function (v, d) { return finite(v) ? "₹" + fmt.num(v / 1e5, d == null ? 2 : d) + " lakh" : "–"; },
    crore: function (v, d) { return finite(v) ? "₹" + fmt.num(v / 1e7, d == null ? 1 : d) + " crore" : "–"; },
    pct: function (v, d) { return finite(v) ? (v * 100).toFixed(d || 0) + "%" : "–"; },
    month: function (m) { var p = m.split("-"); return new Date(+p[0], +p[1] - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" }); },
    monthLong: function (m) { var p = m.split("-"); return new Date(+p[0], +p[1] - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" }); },
    date: function (d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" }); },
    block: function (b) { var m = (b - 1) * 15, hh = Math.floor(m / 60), mm = m % 60; return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm; },
    blockRange: function (b) { return fmt.block(b) + "–" + (b === 96 ? "24:00" : fmt.block(b + 1)); }
  };

  /* Redraw on resize (charts draw at their container's real width). */
  var drawers = [];
  var resizeTimer;
  addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { drawers.forEach(function (d) { if (d.el.isConnected) d.draw(); }); }, 120);
  });
  function register(container, draw) {
    var rec = drawers.filter(function (d) { return d.el === container; })[0];
    if (rec) rec.draw = draw; else drawers.push({ el: container, draw: draw });
    draw();
  }

  function legendFor(container, series) {
    var lg = h("div", "viz-legend");
    series.forEach(function (s) {
      var item = h("span", "viz-key");
      var sw = h("i", "sw" + (s.dash ? " dash" : "") + (s.kind === "bar" ? " box" : ""));
      sw.style.setProperty("--sw", s.color);
      item.appendChild(sw);
      item.appendChild(document.createTextNode(s.name));
      lg.appendChild(item);
    });
    container.appendChild(lg);
  }

  /* Line chart. opts: series [{name, values, color, dash, width, step}], labels (per x, for the
     tooltip), xTick(i) -> label or null, yFormat, height, bands [{from, to, color}] in x units,
     zero (include 0), legend (default true when >1 series), endLabels (direct labels at the right). */
  function lineChart(container, opts) {
    register(container, function () {
      container.textContent = "";
      container.classList.add("viz");
      var series = opts.series.filter(function (s) { return s.values && s.values.some(finite); });
      if (opts.legend !== false && series.length > 1) legendFor(container, series);
      var wrap = h("div", "viz-plot");
      container.appendChild(wrap);
      var W = Math.max(280, wrap.clientWidth || container.clientWidth || 600);
      var H = opts.height || 300;
      var left = opts.left || 64, right = opts.right || (opts.endLabels ? 92 : 12), top = 12, bottom = 28;
      var n = Math.max.apply(null, series.map(function (s) { return s.values.length; }));
      var ex = extent(series.map(function (s) { return s.values; }));
      if (opts.zero) { ex[0] = Math.min(0, ex[0]); ex[1] = Math.max(0, ex[1]); }
      var tk = ticks(ex[0], ex[1], 4);
      ex = [Math.min(ex[0], tk[0]), Math.max(ex[1], tk[tk.length - 1])];
      var step = series.some(function (s) { return s.step; });
      var xs = function (i) { return left + (step ? i / n : (n > 1 ? i / (n - 1) : 0.5)) * (W - left - right); };
      var ys = function (v) { return top + (1 - (v - ex[0]) / (ex[1] - ex[0])) * (H - top - bottom); };
      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.label || "" }, wrap);
      (opts.bands || []).forEach(function (b) {
        el("rect", { x: xs(b.from), y: top, width: Math.max(0, xs(b.to) - xs(b.from)), height: H - top - bottom, style: "fill:" + b.color }, svg);
      });
      tk.forEach(function (t) {
        el("line", { x1: left, x2: W - right, y1: ys(t), y2: ys(t), class: t === 0 ? "viz-zero" : "viz-grid" }, svg);
        var tx = el("text", { x: left - 8, y: ys(t) + 4, "text-anchor": "end", class: "viz-tick" }, svg);
        tx.textContent = (opts.yFormat || fmt.num)(t);
      });
      var lastTickX = -1e9;
      for (var i = 0; i <= n; i++) {
        var lab = opts.xTick ? opts.xTick(i) : null;
        if (lab == null) continue;
        var x = xs(i);
        if (x - lastTickX < (opts.xTickGap || 46)) continue;
        lastTickX = x;
        var t2 = el("text", { x: x, y: H - 8, "text-anchor": i === 0 ? "start" : "middle", class: "viz-tick" }, svg);
        t2.textContent = lab;
      }
      series.forEach(function (s) {
        var d = "", pen = false;
        s.values.forEach(function (v, i) {
          if (!finite(v)) { pen = false; return; }
          if (s.step) {
            d += (pen ? "L" : "M") + xs(i).toFixed(1) + " " + ys(v).toFixed(1) + "L" + xs(i + 1).toFixed(1) + " " + ys(v).toFixed(1);
          } else {
            d += (pen ? "L" : "M") + xs(i).toFixed(1) + " " + ys(v).toFixed(1);
          }
          pen = true;
        });
        el("path", { d: d, fill: "none", style: "stroke:" + s.color, "stroke-width": s.width || 2, "stroke-linejoin": "round",
          "stroke-linecap": "round", "stroke-dasharray": s.dash ? "6 5" : "none" }, svg);
        if (opts.endLabels) {
          for (var j = s.values.length - 1; j >= 0; j--) if (finite(s.values[j])) break;
          if (j >= 0) {
            var lt = el("text", { x: xs(s.step ? j + 1 : j) + 6, y: ys(s.values[j]) + 4, class: "viz-end" }, svg);
            lt.textContent = s.short || s.name;
          }
        }
      });
      // hover layer
      var cross = el("line", { y1: top, y2: H - bottom, class: "viz-cross", visibility: "hidden" }, svg);
      var dots = series.map(function (s) { return el("circle", { r: 4.5, style: "fill:" + s.color, class: "viz-dot", visibility: "hidden" }, svg); });
      var tip = h("div", "viz-tip"); tip.hidden = true; wrap.appendChild(tip);
      function show(clientX) {
        var box = svg.getBoundingClientRect();
        var px = (clientX - box.left) * (W / box.width);
        var f = (px - left) / (W - left - right);
        var i = step ? Math.floor(f * n) : Math.round(f * (n - 1));
        if (i < 0 || i >= n) { hide(); return; }
        var cx = step ? (xs(i) + xs(i + 1)) / 2 : xs(i);
        cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
        tip.textContent = "";
        tip.appendChild(h("b", null, opts.labels ? opts.labels[i] : String(i + 1)));
        series.forEach(function (s, k) {
          var v = s.values[i];
          if (finite(v)) { dots[k].setAttribute("cx", cx); dots[k].setAttribute("cy", ys(v)); dots[k].setAttribute("visibility", "visible"); }
          else dots[k].setAttribute("visibility", "hidden");
          var row = h("span");
          var sw = h("i", "sw" + (s.dash ? " dash" : "")); sw.style.setProperty("--sw", s.color);
          row.appendChild(sw);
          row.appendChild(document.createTextNode(s.name + " "));
          row.appendChild(h("em", null, finite(v) ? (opts.tipFormat || opts.yFormat || fmt.num)(v) : "–"));
          tip.appendChild(row);
        });
        tip.hidden = false;
        var tw = tip.offsetWidth, x = cx * (box.width / W);
        tip.style.left = Math.min(box.width - tw, Math.max(0, x + (x > box.width / 2 ? -tw - 14 : 14))) + "px";
      }
      function hide() { tip.hidden = true; cross.setAttribute("visibility", "hidden"); dots.forEach(function (d) { d.setAttribute("visibility", "hidden"); }); }
      svg.addEventListener("pointermove", function (e) { show(e.clientX); });
      svg.addEventListener("pointerdown", function (e) { show(e.clientX); });
      svg.addEventListener("pointerleave", hide);
    });
  }

  /* Bar chart. opts: values, labels, color(i) or color, format, height, xTick(i), ref {value, name} */
  function barChart(container, opts) {
    register(container, function () {
      container.textContent = "";
      container.classList.add("viz");
      var wrap = h("div", "viz-plot");
      container.appendChild(wrap);
      var W = Math.max(280, wrap.clientWidth || container.clientWidth || 600);
      var H = opts.height || 260, left = opts.left || 64, right = 12, top = 12, bottom = 28;
      var vals = opts.values, n = vals.length;
      var ex = extent([vals.concat(opts.ref ? [opts.ref.value] : [])]);
      ex = [Math.min(0, ex[0]), Math.max(0, ex[1])];
      var tk = ticks(ex[0], ex[1], 4);
      ex = [Math.min(ex[0], tk[0]), Math.max(ex[1], tk[tk.length - 1])];
      var bw = (W - left - right) / n;
      var ys = function (v) { return top + (1 - (v - ex[0]) / (ex[1] - ex[0])) * (H - top - bottom); };
      var svg = el("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": opts.label || "" }, wrap);
      tk.forEach(function (t) {
        el("line", { x1: left, x2: W - right, y1: ys(t), y2: ys(t), class: t === 0 ? "viz-zero" : "viz-grid" }, svg);
        var tx = el("text", { x: left - 8, y: ys(t) + 4, "text-anchor": "end", class: "viz-tick" }, svg);
        tx.textContent = (opts.yFormat || opts.format || fmt.num)(t);
      });
      var gap = bw > 6 ? 2 : (bw > 3 ? 1 : 0);
      var rects = vals.map(function (v, i) {
        if (!finite(v)) return null;
        var y0 = ys(0), y1 = ys(v), x = left + i * bw + gap / 2, w = Math.max(1, bw - gap);
        var r = Math.min(4, w / 2, Math.abs(y0 - y1));
        var up = v >= 0, yTop = Math.min(y0, y1), hgt = Math.abs(y0 - y1);
        // rounded at the data end only
        var d = up
          ? "M" + x + " " + y0 + "V" + (yTop + r) + "Q" + x + " " + yTop + " " + (x + r) + " " + yTop + "H" + (x + w - r) + "Q" + (x + w) + " " + yTop + " " + (x + w) + " " + (yTop + r) + "V" + y0 + "Z"
          : "M" + x + " " + y0 + "V" + (yTop + hgt - r) + "Q" + x + " " + (yTop + hgt) + " " + (x + r) + " " + (yTop + hgt) + "H" + (x + w - r) + "Q" + (x + w) + " " + (yTop + hgt) + " " + (x + w) + " " + (yTop + hgt - r) + "V" + y0 + "Z";
        var col = typeof opts.color === "function" ? opts.color(i, v) : (opts.color || "var(--c1)");
        return el("path", { d: d, style: "fill:" + col, class: "viz-bar" }, svg);
      });
      if (opts.ref && finite(opts.ref.value)) {
        el("line", { x1: left, x2: W - right, y1: ys(opts.ref.value), y2: ys(opts.ref.value), class: "viz-ref" }, svg);
        var rt = el("text", { x: W - right, y: ys(opts.ref.value) - 6, "text-anchor": "end", class: "viz-end" }, svg);
        rt.textContent = opts.ref.name;
      }
      var lastTickX = -1e9;
      for (var i = 0; i < n; i++) {
        var lab = opts.xTick ? opts.xTick(i) : null;
        if (lab == null) continue;
        var x = left + (i + 0.5) * bw;
        if (x - lastTickX < (opts.xTickGap || 46)) continue;
        lastTickX = x;
        var t2 = el("text", { x: x, y: H - 8, "text-anchor": "middle", class: "viz-tick" }, svg);
        t2.textContent = lab;
      }
      var tip = h("div", "viz-tip"); tip.hidden = true; wrap.appendChild(tip);
      var active = null;
      function show(clientX) {
        var box = svg.getBoundingClientRect();
        var px = (clientX - box.left) * (W / box.width);
        var i = Math.floor((px - left) / bw);
        if (i < 0 || i >= n) { hide(); return; }
        if (active) active.classList.remove("is-hover");
        active = rects[i]; if (active) active.classList.add("is-hover");
        tip.textContent = "";
        tip.appendChild(h("b", null, opts.labels ? opts.labels[i] : String(i + 1)));
        var lines = opts.tip ? opts.tip(i) : [[opts.name || "Value", (opts.format || fmt.num)(vals[i])]];
        lines.forEach(function (l) { var row = h("span", null, l[0] + " "); row.appendChild(h("em", null, l[1])); tip.appendChild(row); });
        tip.hidden = false;
        var tw = tip.offsetWidth, x = (left + (i + 0.5) * bw) * (box.width / W);
        tip.style.left = Math.min(box.width - tw, Math.max(0, x + (x > box.width / 2 ? -tw - 12 : 12))) + "px";
      }
      function hide() { tip.hidden = true; if (active) active.classList.remove("is-hover"); active = null; }
      svg.addEventListener("pointermove", function (e) { show(e.clientX); });
      svg.addEventListener("pointerdown", function (e) { show(e.clientX); });
      svg.addEventListener("pointerleave", hide);
    });
  }

  /* One day of 96 fifteen-minute blocks for the Home sheet: day-ahead as a heavy step line,
     real-time dashed, solar hours tinted saffron and the evening peak in grey. */
  function dayCurve(svg, data) {
    var W = 960, H = 340, top = 14, base = 320;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.textContent = "";
    var ex = extent([data.dam].concat(data.rtm ? [data.rtm] : []));
    var x = function (i) { return (i / 96) * W; };
    var y = function (v) { return base - ((v - ex[0]) / (ex[1] - ex[0])) * (base - top) * 0.9 - (base - top) * 0.05; };
    el("rect", { x: x(36), y: 0, width: x(64) - x(36), height: base, rx: 4, style: "fill: var(--accent-soft)" }, svg);
    el("rect", { x: x(72), y: 0, width: x(88) - x(72), height: base, rx: 4, style: "fill: var(--bg-2)" }, svg);
    function stepPath(vals) {
      var d = "", pen = false;
      vals.forEach(function (v, i) {
        if (!finite(v)) { pen = false; return; }
        d += (pen ? "V" : "M" + x(i).toFixed(1) + " ") + y(v).toFixed(1) + "H" + x(i + 1).toFixed(1);
        pen = true;
      });
      return d;
    }
    if (data.rtm) el("path", { d: stepPath(data.rtm), fill: "none", style: "stroke: var(--ink-soft)", "stroke-width": 2, "stroke-dasharray": "6 5" }, svg);
    el("path", { d: stepPath(data.dam), fill: "none", stroke: "currentColor", "stroke-width": 3, "stroke-linejoin": "round" }, svg);
    el("rect", { x: 0, y: base, width: W, height: 2, fill: "currentColor" }, svg);
    [[0, ex[1]], [1, ex[0]]].forEach(function (p) {
      var t = el("text", { x: 6, y: p[0] ? base - 8 : top + 14, class: "viz-tick" }, svg);
      t.textContent = "₹" + fmt.num(p[1]);
    });
  }

  /* Monthly bars standing on the bottom edge; the last bar takes the accent. */
  function edgeBars(container, values, opts) {
    opts = opts || {};
    container.textContent = "";
    var hi = Math.max.apply(null, values), lo = Math.min(0, Math.min.apply(null, values));
    values.forEach(function (v, i) {
      var bar = document.createElement("button");
      bar.type = "button";
      bar.className = "edge-bar" + (i === values.length - 1 ? " is-latest" : "");
      var label = (opts.labels && opts.labels[i]) || ("Month " + (i + 1));
      var text = opts.valueText ? opts.valueText(v, i) : fmt.num(v);
      bar.setAttribute("aria-label", label + ": " + text);
      bar.style.setProperty("--h", (0.06 + 0.94 * (v - lo) / (hi - lo || 1)).toFixed(3));
      var tip = document.createElement("span");
      tip.className = "edge-tip";
      tip.textContent = label + " · " + text;
      bar.appendChild(tip);
      container.appendChild(bar);
    });
  }

  /* A plain table from rows of cells; numeric cells right-aligned. */
  function table(container, head, rows, opts) {
    opts = opts || {};
    var wrap = h("div", "table-wrap");
    var t = h("table", "data-table");
    if (opts.caption) t.appendChild(h("caption", null, opts.caption));
    var th = h("thead"), tr = h("tr");
    var isNum = function (i) { return i && opts.numeric !== false && !(opts.text && opts.text.indexOf(i) >= 0); };
    head.forEach(function (c, i) { var x = h("th", isNum(i) ? "num" : "", c); x.scope = "col"; tr.appendChild(x); });
    th.appendChild(tr); t.appendChild(th);
    var tb = h("tbody");
    rows.forEach(function (r) {
      var row = h("tr", r.cls || "");
      (r.cells || r).forEach(function (c, i) {
        var cell = h(i ? "td" : "th", isNum(i) ? "num" : "");
        if (!i) cell.scope = "row";
        if (c && c.nodeType) cell.appendChild(c); else cell.textContent = c == null ? "–" : c;
        row.appendChild(cell);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    container.textContent = "";
    container.appendChild(wrap);
    return t;
  }

  /* Segmented control: buttons with aria-pressed; calls onChange(value). */
  function segmented(container, items, value, onChange) {
    container.textContent = "";
    container.classList.add("seg");
    items.forEach(function (it) {
      var b = h("button", null, it[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", it[0] === value ? "true" : "false");
      b.addEventListener("click", function () {
        [].forEach.call(container.children, function (c) { c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
        onChange(it[0]);
      });
      container.appendChild(b);
    });
  }

  /* CSV download from rows */
  function downloadCSV(name, head, rows) {
    var esc = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var text = [head].concat(rows).map(function (r) { return r.map(esc).join(","); }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  window.ZoltiqCharts = { dayCurve: dayCurve, edgeBars: edgeBars, lineChart: lineChart, barChart: barChart,
    table: table, segmented: segmented, downloadCSV: downloadCSV, fmt: fmt };
})();
