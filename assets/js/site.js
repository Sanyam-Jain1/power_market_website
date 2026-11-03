/* Zoltiq — shared behaviour for every page. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---- Site settings ---------------------------------------------------- */
  var CONFIG = {
    // Shown on the site, and where forms are delivered.
    contactEmail: "zoltiqenergy@gmail.com",
    // Where forms are delivered (FormSubmit forwards submissions to this inbox by email).
    formEndpoint: "https://formsubmit.co/ajax/zoltiqenergy@gmail.com",
    // Cloudflare Web Analytics site token for zoltiq.in (dash.cloudflare.com → Web Analytics →
    // zoltiq.in → JS snippet: the value of "token" in data-cf-beacon). Empty = analytics off.
    cfAnalyticsToken: "dca5516bfbe747499c815c3705cef666"
  };
  window.ZOLTIQ = CONFIG;

  /* ---- Visitor analytics: Cloudflare Web Analytics (no cookies), on the live domain only ---- */
  if (CONFIG.cfAnalyticsToken && /(^|\.)zoltiq\.in$/.test(location.hostname)) {
    var beacon = document.createElement("script");
    beacon.type = "module";  // as in Cloudflare's own snippet
    beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
    beacon.setAttribute("data-cf-beacon", JSON.stringify({ token: CONFIG.cfAnalyticsToken }));
    document.body.appendChild(beacon);
  }

  [].forEach.call(document.querySelectorAll("[data-contact-email]"), function (el) {
    if (!el.hasAttribute("data-keep-text")) el.textContent = CONFIG.contactEmail;
    if (el.tagName === "A") el.href = "mailto:" + CONFIG.contactEmail;
  });

  /* ---- Theme: light (paper and ink) or dark (night and gold) -------------
     Follows the device setting until the visitor picks one, then remembers it.
     Pictures carry data-light / data-dark sources and follow the theme. */
  var root = document.documentElement;
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function currentTheme() {
    var t = root.getAttribute("data-theme");
    return t === "dark" || t === "light" ? t : (mq && mq.matches ? "dark" : "light");
  }
  function applyTheme() {
    var t = currentTheme();
    [].forEach.call(document.querySelectorAll("img[data-light][data-dark]"), function (img) {
      var src = img.getAttribute("data-" + t);
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    });
    var btn = document.querySelector(".theme-toggle");
    if (btn) {
      btn.setAttribute("data-mode", t);
      btn.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0b0d12" : "#f4f3ee");
  }
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) toggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    applyTheme();
  });
  if (mq && mq.addEventListener) mq.addEventListener("change", applyTheme);
  applyTheme();

  /* ---- Mobile menu ------------------------------------------------------ */
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.textContent = open ? "Close" : "Menu";
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.textContent = "Menu";
      }
    });
  }

  /* ---- Header: transparent over the first screen, paper once you scroll -- */
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("is-solid", scrollY > 60); }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- Entrances: each .rise element rises once as it comes into view --- */
  var risers = document.querySelectorAll(".rise, .watch");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    [].forEach.call(risers, function (el) { io.observe(el); });
  } else {
    [].forEach.call(risers, function (el) { el.classList.add("in"); });
  }

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
      if (status) status.textContent = "Sending…";
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
        if (status) status.textContent = "That didn’t send. Please email " + CONFIG.contactEmail + " instead.";
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
