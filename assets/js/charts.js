/* Zoltiq — small SVG chart helpers. No library; each function draws into an <svg> it is given.
   Values are drawn relative to their own min/max, so the same code draws sample shapes now and real ₹/MWh later. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function extent(arrays) {
    var lo = Infinity, hi = -Infinity;
    arrays.forEach(function (a) { a.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
    if (lo === hi) { lo -= 1; hi += 1; }
    return [lo, hi];
  }

  /* A day of 96 fifteen-minute blocks: day-ahead as a filled step line, real-time as a dashed line,
     with the solar hours and the evening peak shaded. */
  function dayCurve(svg, data) {
    var W = 960, H = 320, top = 16, base = 300;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.textContent = "";
    var series = [data.dam].concat(data.rtm ? [data.rtm] : []);
    var ex = extent(series);
    var span = ex[1] - ex[0];
    var x = function (i) { return (i / 96) * W; };
    var y = function (v) { return base - ((v - ex[0]) / span) * (base - top) * 0.92 - (base - top) * 0.04; };

    el("rect", { x: x(36), y: 0, width: x(64) - x(36), height: base, fill: "rgba(255,182,92,0.10)" }, svg);
    el("rect", { x: x(72), y: 0, width: x(88) - x(72), height: base, fill: "rgba(143,176,255,0.12)" }, svg);
    for (var g = 0; g <= 24; g += 6) {
      el("line", { x1: x(g * 4), x2: x(g * 4), y1: 0, y2: base, stroke: "rgba(255,255,255,0.10)", "stroke-dasharray": g % 24 ? "2 6" : "" }, svg);
    }
    function stepPath(vals) {
      var d = "M0 " + y(vals[0]).toFixed(1);
      vals.forEach(function (v, i) {
        if (i) d += "V" + y(v).toFixed(1);
        d += "H" + x(i + 1).toFixed(1);
      });
      return d;
    }
    var dam = stepPath(data.dam);
    el("path", { d: dam + "V" + base + "H0Z", fill: "rgba(243,242,239,0.08)" }, svg);
    if (data.rtm) el("path", { d: stepPath(data.rtm), fill: "none", stroke: "#8fb0ff", "stroke-width": 1.6, "stroke-dasharray": "5 4" }, svg);
    el("path", { d: dam, fill: "none", stroke: "#f3f2ef", "stroke-width": 2 }, svg);
    el("line", { x1: 0, x2: W, y1: base, y2: base, stroke: "rgba(255,255,255,0.35)" }, svg);
  }

  /* A compact trend line with an emphasised last point. */
  function sparkline(svg, values) {
    var W = 320, H = 96, pad = 6;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.textContent = "";
    var ex = extent([values]);
    var x = function (i) { return pad + (i / (values.length - 1)) * (W - pad * 2); };
    var y = function (v) { return H - pad - ((v - ex[0]) / (ex[1] - ex[0])) * (H - pad * 2); };
    var d = values.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join("");
    el("path", { d: d + "L" + x(values.length - 1) + " " + H + "L" + x(0) + " " + H + "Z", fill: "rgba(255,182,92,0.12)" }, svg);
    el("path", { d: d, fill: "none", stroke: "#ffb65c", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    var last = values.length - 1;
    el("circle", { cx: x(last), cy: y(values[last]), r: 4.5, fill: "#ffb65c", stroke: "#07090f", "stroke-width": 2 }, svg);
  }

  window.ZoltiqCharts = { dayCurve: dayCurve, sparkline: sparkline };
})();
