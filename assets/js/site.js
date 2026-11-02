/* Zoltiq — shared behaviour for every page. */
(function () {
  "use strict";

  /* ---- Site settings ---------------------------------------------------- */
  var CONFIG = {
    // Shown on the site. Placeholder until the mailbox exists.
    contactEmail: "hello@zoltiq.in",
    // Where forms are delivered (FormSubmit forwards submissions to this inbox by email).
    formEndpoint: "https://formsubmit.co/ajax/hello@zoltiq.in"
  };
  window.ZOLTIQ = CONFIG;

  [].forEach.call(document.querySelectorAll("[data-contact-email]"), function (el) {
    el.textContent = CONFIG.contactEmail;
    if (el.tagName === "A") el.href = "mailto:" + CONFIG.contactEmail;
  });

  /* ---- Mobile menu ------------------------------------------------------ */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Sky: midday at the top of the page, night at the bottom ---------- */
  var root = document.documentElement;
  var header = document.querySelector(".site-header");
  // [progress, skyTop, skyBottom, glow rgba, sunX %, sunY %]
  var SKY = [
    [0.00, [36, 22, 13], [95, 52, 21], [255, 186, 110, 0.50], 72, 8],
    [0.30, [30, 22, 34], [86, 44, 30], [255, 140, 80, 0.42], 80, 40],
    [0.60, [12, 19, 44], [36, 30, 66], [255, 120, 95, 0.22], 86, 86],
    [1.00, [4, 6, 13], [9, 17, 44], [100, 140, 255, 0.16], 50, 115]
  ];
  function mix(a, b, t) { return a + (b - a) * t; }
  function rgb(a, b, t) {
    return "rgb(" + Math.round(mix(a[0], b[0], t)) + "," + Math.round(mix(a[1], b[1], t)) + "," + Math.round(mix(a[2], b[2], t)) + ")";
  }
  function paintSky() {
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var p = Math.min(1, Math.max(0, scrollY / max));
    var i = 0;
    while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++;
    var a = SKY[i], b = SKY[i + 1];
    var t = (p - a[0]) / (b[0] - a[0]);
    root.style.setProperty("--sky-top", rgb(a[1], b[1], t));
    root.style.setProperty("--sky-bottom", rgb(a[2], b[2], t));
    var g = a[3], h = b[3];
    root.style.setProperty("--sky-glow", "rgba(" + Math.round(mix(g[0], h[0], t)) + "," + Math.round(mix(g[1], h[1], t)) + "," +
      Math.round(mix(g[2], h[2], t)) + "," + mix(g[3], h[3], t).toFixed(3) + ")");
    root.style.setProperty("--sun-x", mix(a[4], b[4], t).toFixed(1) + "%");
    root.style.setProperty("--sun-y", mix(a[5], b[5], t).toFixed(1) + "%");
    if (header) header.classList.toggle("is-solid", scrollY > 40);
  }
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; paintSky(); });
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  paintSky();

  /* ---- Forms: any <form data-form="name"> posts to the form endpoint ---- */
  [].forEach.call(document.querySelectorAll("form[data-form]"), function (form) {
    var status = form.querySelector(".form-status");
    var submit = form.querySelector("[type=submit]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var data = { _subject: "zoltiq.in: " + form.getAttribute("data-form"), _template: "table" };
      [].forEach.call(form.elements, function (el) { if (el.name) data[el.name] = el.value.trim(); });
      if (data._honey) return;
      if (submit) submit.disabled = true;
      if (status) { status.className = "form-status"; status.textContent = "Sending…"; }
      fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      }).then(function (r) {
        if (!r.ok || String(r.body.success) !== "true") throw new Error("not sent");
        form.reset();
        if (status) status.textContent = form.getAttribute("data-success") || "Thanks. We’ll be in touch by email.";
      }).catch(function () {
        if (status) {
          status.className = "form-status is-error";
          status.textContent = "That didn’t send. Please email " + CONFIG.contactEmail + " instead.";
        }
      }).then(function () { if (submit) submit.disabled = false; });
    });
  });

  /* ---- Data helper ------------------------------------------------------ */
  window.ZOLTIQ.loadJSON = function (path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " " + r.status);
      return r.json();
    });
  };
})();
