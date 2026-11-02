/* Zoltiq — small SVG chart helpers, drawn for the white document sheets.
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

  /* One day of 96 fifteen-minute blocks: day-ahead as a heavy step line, real-time dashed,
     solar hours tinted saffron and the evening peak in grey. */
  function dayCurve(svg, data) {
    var W = 960, H = 340, top = 14, base = 320;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.textContent = "";
    var ex = extent([data.dam].concat(data.rtm ? [data.rtm] : []));
    var x = function (i) { return (i / 96) * W; };
    var y = function (v) { return base - ((v - ex[0]) / (ex[1] - ex[0])) * (base - top) * 0.9 - (base - top) * 0.05; };
    el("rect", { x: x(36), y: 0, width: x(64) - x(36), height: base, fill: "#ffd2ad" }, svg);
    el("rect", { x: x(72), y: 0, width: x(88) - x(72), height: base, fill: "#e4e1d8" }, svg);
    function stepPath(vals) {
      var d = "M0 " + y(vals[0]).toFixed(1);
      vals.forEach(function (v, i) { if (i) d += "V" + y(v).toFixed(1); d += "H" + x(i + 1).toFixed(1); });
      return d;
    }
    if (data.rtm) el("path", { d: stepPath(data.rtm), fill: "none", stroke: "#8a877e", "stroke-width": 2, "stroke-dasharray": "6 5" }, svg);
    el("path", { d: stepPath(data.dam), fill: "none", stroke: "#111", "stroke-width": 3 }, svg);
    el("rect", { x: 0, y: base, width: W, height: 3, fill: "#111" }, svg);
  }

  /* Monthly bars standing on the bottom edge; the last bar takes the accent. */
  function edgeBars(container, values, opts) {
    opts = opts || {};
    container.textContent = "";
    var hi = Math.max.apply(null, values), lo = Math.min.apply(null, values);
    values.forEach(function (v, i) {
      var bar = document.createElement("button");
      bar.type = "button";
      bar.className = "edge-bar" + (i === values.length - 1 ? " is-latest" : "");
      var label = (opts.labels && opts.labels[i]) || ("Month " + (i + 1));
      bar.setAttribute("aria-label", label + ": " + (opts.valueText ? opts.valueText(v, i) : "₹[X]"));
      bar.style.setProperty("--h", (0.22 + 0.78 * (v - lo) / (hi - lo || 1)).toFixed(3));
      var tip = document.createElement("span");
      tip.className = "edge-tip";
      tip.textContent = label + " · " + (opts.valueText ? opts.valueText(v, i) : "₹[X]");
      bar.appendChild(tip);
      container.appendChild(bar);
    });
  }

  window.ZoltiqCharts = { dayCurve: dayCurve, edgeBars: edgeBars };
})();
