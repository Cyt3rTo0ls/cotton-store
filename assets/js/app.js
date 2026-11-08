/* =========================================================
   COTTON STORE — Catálogo 2026
   Catálogo estático + filtros + ficha de producto + WhatsApp
   ========================================================= */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const WA = "584120522641";
  const PAGE_SIZE = 24;

  const grid = $("#productGrid");
  const chipsWrap = $("#categoryChips");
  const rail = $("#categoriesRail");
  const lineSelect = $("#lineSelect");
  const sortSelect = $("#sortSelect");
  const searchInput = $("#searchInput");
  const searchClear = $("#searchClear");
  const resultsCount = $("#resultsCount");
  const resetFilters = $("#resetFilters");
  const emptyState = $("#emptyState");
  const loadMoreBtn = $("#loadMore");
  const loadMoreNote = $("#loadMoreNote");
  const sentinel = $("#sentinel");
  const modal = $("#productModal");
  const modalImg = $("#modalImg");
  const modalTitle = $("#modalTitle");
  const modalCat = $("#modalCat");
  const modalRef = $("#modalRef");
  const modalPrice = $("#modalPrice");
  const modalPriceNote = $("#modalPriceNote");
  const modalDesc = $("#modalDesc");
  const modalWa = $("#modalWa");
  const modalCounter = $("#modalCounter");
  const modalPrev = $("#modalPrev");
  const modalNext = $("#modalNext");
  const modalClose = $("#modalClose");
  const toast = $("#toast");

  const state = {
    items: [],
    categories: [],
    store: {},
    filtered: [],
    cat: "all",
    line: "",
    q: "",
    sort: "default",
    shown: 0,
    current: -1,
    lastFocus: null,
    menuOpen: false,
    modalOpen: false,
  };

  const catBySlug = () => Object.fromEntries(state.categories.map((c) => [c.slug, c]));

  /* ---------- utilidades ---------- */
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));

  const norm = (str) =>
    String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const pad = (n) => String(n).padStart(2, "0");

  const waLink = (msg) => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;

  const productMessage = (item) =>
    `Hola Cotton Store 👋 Me interesa ${item.name} (Ref. ${item.ref})` +
    (item.price ? ` — $${item.price}` : "") +
    ". ¿Está disponible?";

  const toastTimer = { id: 0 };
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer.id);
    toastTimer.id = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function syncBodyLock() {
    document.body.classList.toggle("is-locked", state.menuOpen || state.modalOpen);
  }

  function priceHTML(item) {
    if (item.price) {
      return `<p class="card-price">$${item.price} <span>USD</span></p>`;
    }
    return `<p class="card-price is-consult">Precio por WhatsApp</p>`;
  }

  /* ---------- datos ---------- */
  async function loadCatalog() {
    // se guarda antes de sincronizar la URL (syncURL limpia ?p)
    const deepRef = new URLSearchParams(window.location.search).get("p");
    try {
      const res = await fetch("assets/data/catalog.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.items = data.items || [];
      state.categories = data.categories || [];
      state.store = data.store || {};

      state.items.forEach((item) => {
        item._search = norm(
          `${item.name} ${item.ref} ${item.categoryLabel} ${item.line} ${item.price ?? ""}`
        );
      });

      const totalEl = $("#totalPieces");
      if (totalEl) totalEl.textContent = state.items.length;
      const statTotal = $("[data-stat-total]");
      if (statTotal) statTotal.textContent = state.items.length;
      const statCats = $("[data-stat-cats]");
      if (statCats) statCats.textContent = state.categories.length;

      renderCategories();
      renderChips();
      restoreFromURL();
      buildLineOptions();
      applyFilters({ scroll: false });
      handleDeepProduct(deepRef);
    } catch (err) {
      console.error("No se pudo cargar el catálogo:", err);
      if (grid) {
        grid.setAttribute("aria-busy", "false");
        grid.innerHTML = "";
      }
      if (resultsCount) resultsCount.textContent = "No se pudo cargar el catálogo";
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.querySelector("h3").textContent = "El catálogo no cargó.";
        emptyState.querySelector("p").textContent =
          "Revisa tu conexión y recarga la página, o escríbenos por WhatsApp y te enviamos el catálogo al momento.";
      }
    }
  }

  /* ---------- categorías ---------- */
  function renderCategories() {
    if (!rail) return;
    rail.innerHTML = state.categories
      .map(
        (cat, i) => `
      <a class="cat-card" href="#catalogo" data-cat="${cat.slug}" aria-label="Ver ${cat.label}: ${cat.count} piezas">
        <img src="${cat.cover}" alt="" loading="lazy" decoding="async" width="600" height="750">
        <span class="cat-index">${pad(i + 1)}</span>
        <div class="cat-body">
          <div>
            <h3>${esc(cat.label)}</h3>
            <p>${cat.count} piezas</p>
          </div>
          <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>
        </div>
      </a>`
      )
      .join("");

    $$(".cat-card", rail).forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        setCategory(card.dataset.cat);
        document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    requestAnimationFrame(updateRailArrows);
  }

  function renderChips() {
    if (!chipsWrap) return;
    const all = `<button type="button" class="chip is-active" data-cat="all">Todo <span>${state.items.length}</span></button>`;
    chipsWrap.innerHTML =
      all +
      state.categories
        .map(
          (cat) =>
            `<button type="button" class="chip" data-cat="${cat.slug}">${esc(cat.label)} <span>${cat.count}</span></button>`
        )
        .join("");

    $$(".chip", chipsWrap).forEach((chip) => {
      chip.addEventListener("click", () => setCategory(chip.dataset.cat));
    });
  }

  function setCategory(slug) {
    state.cat = slug || "all";
    state.line = "";
    $$(".chip", chipsWrap).forEach((chip) =>
      chip.classList.toggle("is-active", chip.dataset.cat === state.cat)
    );
    buildLineOptions();
    applyFilters();
  }

  function buildLineOptions() {
    if (!lineSelect) return;

    // una línea siempre pertenece a una categoría
    if (state.cat === "all" && state.line) {
      const parent = state.categories.find((c) =>
        c.lines.some((l) => l.label === state.line)
      );
      if (parent) {
        state.cat = parent.slug;
        $$(".chip", chipsWrap).forEach((chip) =>
          chip.classList.toggle("is-active", chip.dataset.cat === state.cat)
        );
      }
    }

    const cats = state.cat === "all"
      ? state.categories
      : state.categories.filter((c) => c.slug === state.cat);

    if (state.line && !cats.some((c) => c.lines.some((l) => l.label === state.line))) {
      state.line = "";
    }

    const groups = cats
      .filter((c) => c.lines.length)
      .map(
        (c) =>
          `<optgroup label="${esc(c.label)}">` +
          c.lines
            .map(
              (l) =>
                `<option value="${c.slug}|${esc(l.label)}">${esc(l.label)} (${l.count})</option>`
            )
            .join("") +
          `</optgroup>`
      )
      .join("");

    lineSelect.innerHTML = `<option value="">Todas las líneas</option>${groups}`;
    lineSelect.value = state.line ? `${state.cat}|${state.line}` : "";
  }

  /* ---------- filtros ---------- */
  function filteredItems() {
    let list = state.items;

    if (state.cat !== "all") {
      list = list.filter((item) => item.category === state.cat);
    }
    if (state.line) {
      list = list.filter((item) => item.line === state.line);
    }
    if (state.q) {
      const q = norm(state.q).trim();
      if (q) {
        const terms = q.split(/\s+/).filter(Boolean);
        list = list.filter((item) => terms.every((t) => item._search.includes(t)));
      }
    }

    if (state.sort === "az") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
    } else if (state.sort === "price-asc" || state.sort === "price-desc") {
      const dir = state.sort === "price-asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (a.price == null && b.price == null) return a.name.localeCompare(b.name, "es");
        if (a.price == null) return 1;
        if (b.price == null) return -1;
        return (a.price - b.price) * dir;
      });
    }
    return list;
  }

  function applyFilters({ scroll = false } = {}) {
    state.filtered = filteredItems();
    state.shown = 0;
    grid.innerHTML = "";
    grid.setAttribute("aria-busy", "true");

    const active = state.q || state.cat !== "all" || state.line;
    if (resetFilters) resetFilters.hidden = !active;

    if (!state.filtered.length) {
      emptyState.hidden = false;
      loadMoreBtn.hidden = true;
      loadMoreNote.hidden = true;
      resultsCount.textContent = "0 piezas";
      grid.setAttribute("aria-busy", "false");
      syncURL();
      return;
    }

    emptyState.hidden = true;
    renderBatch();
    grid.setAttribute("aria-busy", "false");
    syncURL();

    if (scroll) {
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderBatch() {
    const next = state.filtered.slice(state.shown, state.shown + PAGE_SIZE);
    const frag = document.createDocumentFragment();

    next.forEach((item, i) => {
      const article = document.createElement("article");
      article.className = "card";
      article.dataset.ref = item.ref;
      article.innerHTML = `
        <button class="card-media" type="button" aria-label="Ver ${esc(item.name)}, referencia ${esc(item.ref)}">
          <img src="${item.thumb}" alt="${esc(item.alt)}" width="${item.w}" height="${item.h}"
               loading="${state.shown === 0 && i < 4 ? "eager" : "lazy"}" decoding="async">
          <span class="card-ref">${esc(item.ref)}</span>
          <span class="card-cta">Ver pieza <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></span>
        </button>
        <div class="card-info">
          <p class="card-cat">${esc(item.categoryLabel)}${item.line ? ` · ${esc(item.line)}` : ""}</p>
          <h3>${esc(item.name)}</h3>
          ${priceHTML(item)}
        </div>`;
      frag.appendChild(article);
    });

    grid.appendChild(frag);
    state.shown += next.length;

    const remaining = state.filtered.length - state.shown;
    loadMoreBtn.hidden = remaining <= 0;
    loadMoreNote.hidden = remaining <= 0;
    if (remaining > 0) {
      loadMoreNote.textContent = `Mostrando ${state.shown} de ${state.filtered.length} piezas`;
    }

    updateResultsLabel();
    observeCards();
  }

  function updateResultsLabel() {
    const total = state.filtered.length;
    const shown = state.shown;
    const pieceWord = total === 1 ? "pieza" : "piezas";
    if (shown < total) {
      resultsCount.textContent = `Mostrando ${shown} de ${total} ${pieceWord}`;
    } else {
      resultsCount.textContent = `${total} ${pieceWord}`;
    }
  }

  function observeCards() {
    if (!("IntersectionObserver" in window)) return;
    // El centinela se encarga del scroll infinito; no hace falta observar cada card.
  }

  function syncURL() {
    const params = new URLSearchParams(window.location.search);
    if (state.cat === "all") params.delete("cat");
    else params.set("cat", state.cat);

    if (state.line) params.set("line", state.line);
    else params.delete("line");

    if (state.q.trim()) params.set("q", state.q.trim());
    else params.delete("q");

    if (!state.modalOpen) params.delete("p");

    const qs = params.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    history.replaceState(null, "", url);
  }

  function restoreFromURL() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    if (cat && state.categories.some((c) => c.slug === cat)) {
      state.cat = cat;
      $$(".chip", chipsWrap).forEach((chip) =>
        chip.classList.toggle("is-active", chip.dataset.cat === state.cat)
      );
    }
    const line = params.get("line");
    if (line) state.line = line;
    const q = params.get("q");
    if (q) {
      state.q = q;
      searchInput.value = q;
      searchClear.hidden = false;
    }
    const sort = params.get("sort");
    if (["default", "price-asc", "price-desc", "az"].includes(sort)) {
      state.sort = sort;
      sortSelect.value = sort;
    }
  }

  function resetAll() {
    state.cat = "all";
    state.line = "";
    state.q = "";
    state.sort = "default";
    searchInput.value = "";
    searchClear.hidden = true;
    sortSelect.value = "default";
    $$(".chip", chipsWrap).forEach((chip) =>
      chip.classList.toggle("is-active", chip.dataset.cat === "all")
    );
    buildLineOptions();
    applyFilters();
  }

  /* ---------- modal ---------- */
  function fillModal(item, index) {
    const cat = catBySlug()[item.category];
    modalImg.src = item.img;
    modalImg.alt = item.alt;
    modalImg.width = item.w;
    modalImg.height = item.h;
    modalTitle.textContent = item.name;
    modalCat.textContent = `${item.categoryLabel}${item.line ? ` · Línea ${item.line}` : ""}`;
    modalRef.textContent = item.ref;
    modalCounter.textContent = `${pad(index + 1)} / ${pad(state.filtered.length)}`;

    if (item.price) {
      modalPrice.classList.remove("is-consult");
      modalPrice.innerHTML = `$${item.price} <span>USD</span>`;
    } else {
      modalPrice.classList.add("is-consult");
      modalPrice.textContent = "Precio por WhatsApp";
    }

    if (item.priceNote) {
      modalPriceNote.hidden = false;
      modalPriceNote.textContent = item.priceNote;
    } else {
      modalPriceNote.hidden = true;
      modalPriceNote.textContent = "";
    }

    modalDesc.textContent =
      (cat ? cat.blurb : "Pieza seleccionada por Cotton Store.") +
      " Selección de Cotton Store, San Felipe. Envíos a toda Venezuela.";

    modalWa.href = waLink(productMessage(item));
    modalWa.setAttribute("aria-label", `Pedir ${item.name} por WhatsApp`);

    const hasMany = state.filtered.length > 1;
    modalPrev.hidden = !hasMany;
    modalNext.hidden = !hasMany;

    // precarga de vecinos
    if (hasMany) {
      [index - 1, index + 1].forEach((i) => {
        const neighbor = state.filtered[(i + state.filtered.length) % state.filtered.length];
        if (neighbor) new Image().src = neighbor.img;
      });
    }
  }

  function openModal(item) {
    const index = state.filtered.findIndex((i) => i.ref === item.ref);
    if (index < 0) return;
    state.current = index;
    state.lastFocus = document.activeElement;
    fillModal(item, index);

    modal.hidden = false;
    state.modalOpen = true;
    syncBodyLock();
    requestAnimationFrame(() => modal.classList.add("is-open"));
    modalClose.focus({ preventScroll: true });

    const params = new URLSearchParams(window.location.search);
    params.set("p", item.ref);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
  }

  function closeModal() {
    if (!state.modalOpen) return;
    state.modalOpen = false;
    modal.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setTimeout(() => {
      modal.hidden = true;
      modalImg.src = "";
      syncBodyLock();
    }, 280);
    if (state.lastFocus && typeof state.lastFocus.focus === "function") {
      state.lastFocus.focus({ preventScroll: true });
    }
    syncURL();
  }

  function navigate(delta) {
    if (!state.filtered.length) return;
    state.current = (state.current + delta + state.filtered.length) % state.filtered.length;
    fillModal(state.filtered[state.current], state.current);
    const params = new URLSearchParams(window.location.search);
    params.set("p", state.filtered[state.current].ref);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
  }

  async function shareCurrent() {
    const item = state.filtered[state.current];
    if (!item) return;
    const url = `${location.origin}${location.pathname}?p=${encodeURIComponent(item.ref)}`;
    const data = {
      title: `${item.name} — Cotton Store`,
      text: `${item.name} (${item.ref}) en Cotton Store.`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Enlace copiado al portapapeles");
    } catch {
      showToast("Copia el enlace de la barra de direcciones");
    }
  }

  function handleDeepProduct(ref) {
    if (!ref) return;
    const item = state.items.find((i) => i.ref.toLowerCase() === ref.toLowerCase());
    if (!item) return;

    // si los filtros de la URL esconden la pieza, los limpiamos
    if (!state.filtered.some((i) => i.ref === item.ref)) {
      state.cat = item.category;
      state.line = "";
      state.q = "";
      searchInput.value = "";
      searchClear.hidden = true;
      $$(".chip", chipsWrap).forEach((chip) =>
        chip.classList.toggle("is-active", chip.dataset.cat === state.cat)
      );
      buildLineOptions();
      applyFilters();
    }
    setTimeout(() => openModal(item), 150);
  }

  /* ---------- categorías: flechas del rail ---------- */
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
      ".section-head:not(.reveal), .steps-grid:not(.reveal), .steps-cta, .about-panel, .about-copy, .contact-grid"
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

  /* ---------- eventos ---------- */
  function bind() {
    searchInput.addEventListener("input", () => {
      state.q = searchInput.value;
      searchClear.hidden = !searchInput.value;
      clearTimeout(searchInput._t);
      searchInput._t = setTimeout(() => applyFilters(), 140);
    });

    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      state.q = "";
      searchClear.hidden = true;
      searchInput.focus();
      applyFilters();
    });

    lineSelect.addEventListener("change", () => {
      const val = lineSelect.value;
      if (!val) {
        state.line = "";
      } else {
        const [cat, ...rest] = val.split("|");
        state.cat = cat;
        state.line = rest.join("|");
        $$(".chip", chipsWrap).forEach((chip) =>
          chip.classList.toggle("is-active", chip.dataset.cat === state.cat)
        );
      }
      applyFilters();
    });

    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      applyFilters();
    });

    resetFilters.addEventListener("click", resetAll);

    loadMoreBtn.addEventListener("click", renderBatch);

    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".card");
      if (!card) return;
      const item = state.items.find((i) => i.ref === card.dataset.ref);
      if (item) openModal(item);
    });

    modalClose.addEventListener("click", closeModal);
    modal.querySelector("[data-close]").addEventListener("click", closeModal);
    modalPrev.addEventListener("click", () => navigate(-1));
    modalNext.addEventListener("click", () => navigate(1));
    $("#modalShare").addEventListener("click", shareCurrent);

    document.addEventListener("keydown", (event) => {
      if (state.modalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeModal();
        } else if (event.key === "ArrowLeft") {
          navigate(-1);
        } else if (event.key === "ArrowRight") {
          navigate(1);
        } else if (event.key === "Tab") {
          trapFocus(event);
        }
      } else if (event.key === "Escape" && state.menuOpen) {
        closeMenu();
      }
    });

    // swipe en móvil
    let touchX = null;
    let touchY = null;
    modal.querySelector(".modal-media").addEventListener(
      "touchstart",
      (event) => {
        touchX = event.touches[0].clientX;
        touchY = event.touches[0].clientY;
      },
      { passive: true }
    );
    modal.querySelector(".modal-media").addEventListener(
      "touchend",
      (event) => {
        if (touchX == null) return;
        const dx = event.changedTouches[0].clientX - touchX;
        const dy = event.changedTouches[0].clientY - touchY;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          navigate(dx < 0 ? 1 : -1);
        }
        touchX = null;
        touchY = null;
      },
      { passive: true }
    );

    $("#menuToggle").addEventListener("click", openMenu);
    $("#menuClose").addEventListener("click", closeMenu);
    $$("#mobileMenu a").forEach((link) => link.addEventListener("click", closeMenu));

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && state.shown < state.filtered.length) {
            renderBatch();
          }
        },
        { rootMargin: "500px 0px" }
      );
      if (sentinel) io.observe(sentinel);
    }

    // año dinámico
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  function trapFocus(event) {
    const panel = modal.querySelector(".modal-panel");
    const focusable = $$(
      'a[href], button:not([disabled]):not([hidden]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      panel
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openMenu() {
    const menu = $("#mobileMenu");
    if (!menu) return;
    menu.hidden = false;
    state.menuOpen = true;
    syncBodyLock();
    requestAnimationFrame(() => menu.classList.add("is-open"));
    $("#menuToggle").setAttribute("aria-expanded", "true");
    $("#menuClose").focus({ preventScroll: true });
  }

  function closeMenu() {
    const menu = $("#mobileMenu");
    if (!menu || !state.menuOpen) return;
    state.menuOpen = false;
    menu.classList.remove("is-open");
    $("#menuToggle").setAttribute("aria-expanded", "false");
    setTimeout(() => {
      menu.hidden = true;
      syncBodyLock();
    }, 300);
  }

  /* ---------- arranque ---------- */
  initReveal();
  bind();
  initRail();
  loadCatalog();
})();
