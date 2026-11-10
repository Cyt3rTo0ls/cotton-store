/* =========================================================
   COTTON STORE — Inicio
   Categorías + menú móvil + animaciones
   ========================================================= */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, "0");
  const state = { menuOpen: false };

  const rail = $("#categoriesRail");
  const menu = $("#mobileMenu");

  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));

  /* ---------- categorías ---------- */
  async function loadCategories() {
    if (!rail) return;
    try {
      const data = await window.CS_DATA.load();
      const categories = data.categories || [];

      rail.innerHTML = categories
        .map(
          (cat, i) => `
        <a class="cat-card" href="catalogo.html?cat=${encodeURIComponent(cat.slug)}" aria-label="Ver la categoría ${esc(cat.label)}">
          <img src="${cat.coverFull || cat.cover || 'assets/img/logo.webp'}" alt="" loading="lazy" decoding="async" width="600" height="750">
          <span class="cat-index">${pad(i + 1)}</span>
          <div class="cat-body">
            <div>
              <h3>${esc(cat.label)}</h3>
              <p>Ver categoría</p>
            </div>
            <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>
          </div>
        </a>`
        )
        .join("");

      requestAnimationFrame(updateRailArrows);
    } catch (err) {
      console.error("No se pudieron cargar las categorías:", err);
      rail.innerHTML = '<p class="rail-loading">No pudimos cargar las categorías. Escríbenos por WhatsApp.</p>';
    }
  }

  /* ---------- flechas del rail ---------- */
  function updateRailArrows() {
    const prev = $("#railPrev");
    const next = $("#railNext");
    if (!prev || !next || !rail) return;
    const max = rail.scrollWidth - rail.clientWidth - 2;
    const scrollable = max > 4;
    prev.hidden = !scrollable || rail.scrollLeft <= 2;
    next.hidden = !scrollable || rail.scrollLeft >= max;
  }

  function initRail() {
    const prev = $("#railPrev");
    const next = $("#railNext");
    if (!prev || !next || !rail) return;
    const step = () => {
      const card = rail.querySelector(".cat-card");
      return card ? (card.getBoundingClientRect().width + 12) * 2 : 560;
    };
    prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));
    rail.addEventListener("scroll", updateRailArrows, { passive: true });
    window.addEventListener("resize", updateRailArrows);
    updateRailArrows();
  }

  /* ---------- animaciones de entrada ---------- */
  function initReveal() {
    const targets = $$(
      ".section-head:not(.reveal), .steps-grid:not(.reveal), .steps-cta, .about-panel, .about-copy, .contact-grid, .catalog-cta-inner"
    );
    targets.forEach((el, i) => {
      el.classList.add("reveal");
      if (i % 3 === 1) el.classList.add("reveal-delay-1");
      if (i % 3 === 2) el.classList.add("reveal-delay-2");
    });

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ---------- menú móvil ---------- */
  function syncBodyLock() {
    document.body.classList.toggle("is-locked", state.menuOpen);
  }

  function openMenu() {
    if (!menu) return;
    menu.hidden = false;
    state.menuOpen = true;
    syncBodyLock();
    requestAnimationFrame(() => menu.classList.add("is-open"));
    $("#menuToggle").setAttribute("aria-expanded", "true");
    $("#menuClose").focus({ preventScroll: true });
  }

  function closeMenu() {
    if (!menu || !state.menuOpen) return;
    state.menuOpen = false;
    menu.classList.remove("is-open");
    $("#menuToggle").setAttribute("aria-expanded", "false");
    setTimeout(() => {
      menu.hidden = true;
      syncBodyLock();
    }, 300);
  }

  function bind() {
    $("#menuToggle").addEventListener("click", openMenu);
    $("#menuClose").addEventListener("click", closeMenu);
    $$("#mobileMenu a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.menuOpen) closeMenu();
    });

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  initReveal();
  bind();
  initRail();
  loadCategories();
})();
