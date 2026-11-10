/* =========================================================
   COTTON STORE — Catálogo
   Selector de categoría + piezas + ficha + WhatsApp
   ========================================================= */
(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const WA = "584120522641";
  const PAGE_SIZE = 24;

  const picker = $("#categoryPicker");
  const categoryGrid = $("#categoryGrid");
  const browser = $("#catalogBrowser");
  const browserTitle = $("#browserTitle");
  const browserDesc = $("#browserDesc");
  const chipsWrap = $("#categoryChips");
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
    filtered: [],
    cat: "",
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
  const currentCat = () => catBySlug()[state.cat];

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

  // Página propia de la pieza: lleva los metadatos Open Graph con su foto,
  // así WhatsApp muestra la vista previa del producto en el chat.
  // (Se genera al publicar cada pieza, desde el panel o con tools/build_share.py)
  const SITE = "https://cyt3rto0ls.github.io/cotton-store";
  const shareSlug = (ref) =>
    norm(ref).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pieza";
  const shareURL = (item) => `${SITE}/p/${shareSlug(item.ref)}.html`;

  const productMessage = (item) =>
    `Hola Cotton Store 👋 Me interesa ${item.name} (Ref. ${item.ref})` +
    (item.price ? ` — $${item.price}` : "") +
    `. ¿Está disponible?\n${shareURL(item)}`;

  const toastTimer = { id: 0 };
  function showToast(msg) {
    if (!toast) return;
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
    const deepRef = new URLSearchParams(window.location.search).get("p");
    try {
      const data = await window.CS_DATA.load();
      state.items = data.items || [];
      state.categories = data.categories || [];

      state.items.forEach((item) => {
        item._search = norm(
          `${item.name} ${item.ref} ${item.categoryLabel} ${item.line} ${item.price ?? ""}`
        );
      });

      renderPicker();
      renderChips();
      restoreFromURL();

      if (deepRef) {
        const item = state.items.find((i) => i.ref.toLowerCase() === deepRef.toLowerCase());
        if (item) {
          state.cat = item.category;
          state.line = "";
          state.q = "";
          searchInput.value = "";
          searchClear.hidden = true;
          syncChips();
        }
      }

      if (state.cat && currentCat()) {
        showBrowser();
        buildLineOptions();
        applyFilters({ scroll: false });
        if (deepRef) {
          const item = state.items.find((i) => i.ref.toLowerCase() === deepRef.toLowerCase());
          if (item) setTimeout(() => openModal(item), 180);
        }
      } else {
        showPicker();
      }
    } catch (err) {
      console.error("No se pudo cargar el catálogo:", err);
      if (categoryGrid) {
        categoryGrid.innerHTML =
          '<p class="rail-loading">No pudimos cargar las categorías. Revisa tu conexión o escríbenos por WhatsApp.</p>';
      }
    }
  }

  /* ---------- selector de categorías ---------- */
  function renderPicker() {
    if (!categoryGrid) return;
    categoryGrid.innerHTML = state.categories
      .map(
        (cat, i) => `
      <a class="cat-card" href="catalogo.html?cat=${encodeURIComponent(cat.slug)}" data-cat="${cat.slug}">
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
  }

  function renderChips() {
    if (!chipsWrap) return;
    chipsWrap.innerHTML = state.categories
      .map(
        (cat) =>
          `<button type="button" class="chip${cat.slug === state.cat ? " is-active" : ""}" data-cat="${cat.slug}">${esc(cat.label)}</button>`
      )
      .join("");

    $$(".chip", chipsWrap).forEach((chip) => {
      chip.addEventListener("click", () => setCategory(chip.dataset.cat));
    });
  }

  function syncChips() {
    $$(".chip", chipsWrap).forEach((chip) =>
      chip.classList.toggle("is-active", chip.dataset.cat === state.cat)
    );
  }

  function showPicker() {
    if (picker) picker.hidden = false;
    if (browser) browser.hidden = true;
    document.title = "Catálogo | Cotton Store";
  }

  function showBrowser() {
    const cat = currentCat();
    if (!cat) {
      showPicker();
      return;
    }
    if (picker) picker.hidden = true;
    if (browser) browser.hidden = false;
    if (browserTitle) browserTitle.textContent = cat.label.toUpperCase();
    if (browserDesc) {
      browserDesc.textContent =
        cat.blurb || "Piezas seleccionadas por Cotton Store. Tallas y disponibilidad por WhatsApp.";
    }
    document.title = `${cat.label} | Cotton Store`;
  }

  function setCategory(slug) {
    if (!catBySlug()[slug]) return;
    state.cat = slug;
    state.line = "";
    state.q = "";
    searchInput.value = "";
    searchClear.hidden = true;
    syncChips();
    showBrowser();
    buildLineOptions();
    applyFilters();
  }

  function buildLineOptions() {
    if (!lineSelect) return;
    const cat = currentCat();
    if (!cat) return;

    if (state.line && !cat.lines.some((l) => l.label === state.line)) {
      state.line = "";
    }

    const groups = cat.lines.length
      ? cat.lines
          .map(
            (l) => `<option value="${esc(l.label)}">${esc(l.label)}</option>`
          )
          .join("")
      : "";

    lineSelect.innerHTML = `<option value="">Todas las líneas</option>${groups}`;
    lineSelect.value = state.line || "";
  }

  /* ---------- filtros ---------- */
  function filteredItems() {
    if (!state.cat) return [];
    let list = state.items.filter((item) => item.category === state.cat);

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
    if (!state.cat || !currentCat()) {
      showPicker();
      return;
    }

    showBrowser();
    state.filtered = filteredItems();
    state.shown = 0;
    $("#productGrid").innerHTML = "";
    $("#productGrid").setAttribute("aria-busy", "true");

    const active = Boolean(state.q || state.line);
    if (resetFilters) resetFilters.hidden = !active;

    if (!state.filtered.length) {
      emptyState.hidden = false;
      loadMoreBtn.hidden = true;
      loadMoreNote.hidden = true;
      resultsCount.textContent = "Sin resultados";
      $("#productGrid").setAttribute("aria-busy", "false");
      syncURL();
      return;
    }

    emptyState.hidden = true;
    renderBatch();
    $("#productGrid").setAttribute("aria-busy", "false");
    syncURL();

    if (scroll) {
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderBatch() {
    const grid = $("#productGrid");
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
    if (remaining > 0) loadMoreNote.textContent = "Hay más piezas disponibles";

    updateResultsLabel();
  }

  function updateResultsLabel() {
    if (!resultsCount) return;
    if (!state.filtered.length) {
      resultsCount.textContent = "Sin resultados";
      return;
    }
    const cat = currentCat();
    resultsCount.textContent = state.line
      ? `Línea ${state.line}`
      : `Piezas de ${cat ? cat.label : "la categoría"}`;
  }

  function syncURL() {
    const params = new URLSearchParams(window.location.search);
    if (state.cat) params.set("cat", state.cat);
    else params.delete("cat");

    if (state.line) params.set("line", state.line);
    else params.delete("line");

    if (state.q.trim()) params.set("q", state.q.trim());
    else params.delete("q");

    if (state.sort !== "default") params.set("sort", state.sort);
    else params.delete("sort");

    if (!state.modalOpen) params.delete("p");

    const qs = params.toString();
    history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }

  function restoreFromURL() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    if (cat && state.categories.some((c) => c.slug === cat)) state.cat = cat;

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

    syncChips();
  }

  function resetAll() {
    state.line = "";
    state.q = "";
    state.sort = "default";
    searchInput.value = "";
    searchClear.hidden = true;
    sortSelect.value = "default";
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
    if (modalCounter) {
      modalCounter.textContent = `${pad(index + 1)} / ${pad(state.filtered.length)}`;
      modalCounter.hidden = true;
    }

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

    if (hasMany) {
      [index - 1, index + 1].forEach((i) => {
        const neighbor = state.filtered[(i + state.filtered.length) % state.filtered.length];
        if (neighbor) new Image().src = neighbor.img;
      });
    }
  }

  function modalURL(item) {
    const params = new URLSearchParams(window.location.search);
    if (state.cat) params.set("cat", state.cat);
    params.set("p", item.ref);
    return `${location.pathname}?${params}${location.hash}`;
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
    history.replaceState(null, "", modalURL(item));
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
    const item = state.filtered[state.current];
    fillModal(item, state.current);
    history.replaceState(null, "", modalURL(item));
  }

  async function shareCurrent() {
    const item = state.filtered[state.current];
    if (!item) return;
    const url = shareURL(item);
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

  /* ---------- menú móvil ---------- */
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
      state.line = lineSelect.value;
      applyFilters();
    });

    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      applyFilters();
    });

    resetFilters.addEventListener("click", resetAll);
    loadMoreBtn.addEventListener("click", renderBatch);

    $("#productGrid").addEventListener("click", (event) => {
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

    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  bind();
  loadCatalog();
})();
