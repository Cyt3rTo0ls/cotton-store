"use strict";

/* ------------------------------------------------------------------
   Cotton Store · panel privado
   El token de GitHub se guarda cifrado en auth-config.js y solo se
   descifra en memoria al iniciar sesión. No se escribe en el repo.
------------------------------------------------------------------- */

const OWNER = "Cyt3rTo0ls";
const REPO = "cotton-store";
const BRANCH = "main";
const CATALOG_PATH = "assets/data/catalog.json";
const API_BASE = "https://api.github.com";
const SESSION_KEY = "cs_admin_token_v1";

const CAT_META = {
  franelas:   { prefix: "FR", order: 1,  singular: "Franela" },
  chemises:   { prefix: "CH", order: 2,  singular: "Chemise" },
  camisas:    { prefix: "CA", order: 3,  singular: "Camisa" },
  sueters:    { prefix: "SU", order: 4,  singular: "Suéter" },
  bandoleros: { prefix: "BA", order: 5,  singular: "Bandolero" },
  bermudas:   { prefix: "BE", order: 6,  singular: "Bermuda" },
  shorts:     { prefix: "SH", order: 7,  singular: "Short" },
  pantalones: { prefix: "PA", order: 8,  singular: "Pantalón" },
  monos:      { prefix: "MO", order: 9,  singular: "Mono deportivo" },
  zapatos:    { prefix: "ZA", order: 10, singular: "Zapatos" },
  gorras:     { prefix: "GO", order: 11, singular: "Gorra" },
  accesorios: { prefix: "AC", order: 12, singular: "Accesorio" },
  conjuntos:  { prefix: "CO", order: 13, singular: "Conjunto" }
};

const state = {
  data: null,
  headSha: "",
  sessionToken: "",
  query: "",
  catFilter: "",
  limit: 36,
  editing: null,
  pendingPhoto: null,
  photoBusy: false,
  saving: false,
  deleteRef: null,
  toastTimer: 0
};

const $ = (id) => document.getElementById(id);
const el = {
  loginView: $("loginView"),
  loginForm: $("loginForm"),
  loginUser: $("loginUser"),
  loginPass: $("loginPass"),
  loginError: $("loginError"),
  loginBtn: $("loginBtn"),
  passToggle: $("passToggle"),
  panelView: $("panelView"),
  logoutBtn: $("logoutBtn"),
  statTotal: $("statTotal"),
  statCats: $("statCats"),
  statDate: $("statDate"),
  productList: $("productList"),
  listEmpty: $("listEmpty"),
  resultCount: $("resultCount"),
  loadMoreBtn: $("loadMoreBtn"),
  searchInput: $("searchInput"),
  filterCat: $("filterCat"),
  clearFilters: $("clearFilters"),
  refreshBtn: $("refreshBtn"),
  editorCard: $("editorCard"),
  editorKicker: $("editorKicker"),
  editorTitle: $("editorTitle"),
  cancelEdit: $("cancelEdit"),
  productForm: $("productForm"),
  uploadZone: $("uploadZone"),
  photoInput: $("photoInput"),
  uploadEmpty: $("uploadEmpty"),
  uploadPreview: $("uploadPreview"),
  previewImg: $("previewImg"),
  previewStatus: $("previewStatus"),
  previewMeta: $("previewMeta"),
  changePhoto: $("changePhoto"),
  uploadWorking: $("uploadWorking"),
  photoHint: $("photoHint"),
  pName: $("pName"),
  pCategory: $("pCategory"),
  pLine: $("pLine"),
  lineOptions: $("lineOptions"),
  pPrice: $("pPrice"),
  pPriceNote: $("pPriceNote"),
  pRef: $("pRef"),
  formError: $("formError"),
  saveBtn: $("saveBtn"),
  saveBtnText: $("saveBtnText"),
  deleteOverlay: $("deleteOverlay"),
  deleteTitle: $("deleteTitle"),
  deleteText: $("deleteText"),
  deleteCancel: $("deleteCancel"),
  deleteConfirm: $("deleteConfirm"),
  busy: $("busy"),
  busyTitle: $("busyTitle"),
  busyText: $("busyText"),
  toast: $("toast")
};

/* ---------------- utilidades ---------------- */

function normalize(value) {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const clean = String(b64).replace(/\s+/g, "");
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeUtf8Base64(b64) {
  return new TextDecoder().decode(base64ToBytes(b64));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPrice(price) {
  if (price === null || price === undefined || price === "") return "—";
  const n = Number(price);
  if (!Number.isFinite(n)) return "—";
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return value;
  return new Date(parts[0], parts[1] - 1, parts[2])
    .toLocaleDateString("es-VE", { day: "2-digit", month: "short" })
    .replace(".", "");
}

function slugify(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "pieza";
}

function catMeta(slug) {
  return CAT_META[slug] || { prefix: String(slug || "XX").slice(0, 2).toUpperCase(), order: 99, singular: "Pieza" };
}

function publicPath(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\.\.\/)/.test(path)) return path;
  return `../${String(path).replace(/^\/+/, "")}`;
}

function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle("is-error", Boolean(isError));
  el.toast.classList.add("is-on");
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => el.toast.classList.remove("is-on"), 4600);
}

function setBusy(show, title = "Publicando…", text = "Guardando cambios en GitHub") {
  el.busy.hidden = !show;
  if (show) {
    el.busyTitle.textContent = title;
    el.busyText.textContent = text;
  }
}

function showLogin(message = "") {
  el.loginView.hidden = false;
  el.panelView.hidden = true;
  if (message) {
    el.loginError.textContent = message;
    el.loginError.hidden = false;
  } else {
    el.loginError.hidden = true;
  }
  window.setTimeout(() => el.loginUser.focus(), 40);
}

function setSessionToken(token) {
  state.sessionToken = token || "";
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sessionStorage bloqueado: la sesión vive solo en memoria */
  }
}

function getStoredToken() {
  try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch { return ""; }
}

function showFormError(message) {
  el.formError.textContent = message;
  el.formError.hidden = false;
  el.formError.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ---------------- autenticación ---------------- */

async function deriveBits(secret, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]
  );
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material, 256
  ));
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function unlockPanel(user, password) {
  const cfg = window.CS_AUTH;
  if (!cfg || !cfg.cred || !cfg.saltCred || !cfg.saltEnc || !cfg.token || !cfg.iv) {
    const err = new Error("La configuración de acceso no está disponible.");
    err.code = "config";
    throw err;
  }
  const secret = `${String(user).trim().toLowerCase()}\n${password}`;
  const iterations = Number(cfg.iter) || 600000;
  const credential = await deriveBits(secret, base64ToBytes(cfg.saltCred), iterations);
  if (!equalBytes(credential, base64ToBytes(cfg.cred))) {
    const err = new Error("Usuario o clave incorrectos.");
    err.code = "bad-credentials";
    throw err;
  }
  const keyBits = await deriveBits(secret, base64ToBytes(cfg.saltEnc), iterations);
  const key = await crypto.subtle.importKey("raw", keyBits, { name: "AES-GCM" }, false, ["decrypt"]);
  let plain;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(cfg.iv) },
      key,
      base64ToBytes(cfg.token)
    );
  } catch {
    const err = new Error("No se pudo desbloquear el acceso. Revisa la configuración.");
    err.code = "decrypt";
    throw err;
  }
  return new TextDecoder().decode(plain);
}

async function handleLogin(event) {
  event.preventDefault();
  if (state.saving) return;
  el.loginError.hidden = true;
  const user = el.loginUser.value.trim();
  const password = el.loginPass.value;
  if (!user || !password) {
    el.loginError.textContent = "Escribe tu usuario y tu clave.";
    el.loginError.hidden = false;
    return;
  }
  const original = el.loginBtn.querySelector("span").textContent;
  el.loginBtn.disabled = true;
  el.loginBtn.querySelector("span").textContent = "Verificando…";
  try {
    const token = await unlockPanel(user, password);
    setSessionToken(token);
    await openPanel();
    el.loginPass.value = "";
    el.loginError.hidden = true;
  } catch (err) {
    if (err.code === "bad-credentials") {
      el.loginError.textContent = "Usuario o clave incorrectos.";
    } else if (err.code === "config") {
      el.loginError.textContent = err.message;
    } else if (err.status === 401 || err.status === 403) {
      setSessionToken("");
      el.loginError.textContent = "El acceso a GitHub fue rechazado. Revisa el token del panel.";
    } else {
      el.loginError.textContent = describeError(err);
    }
    el.loginError.hidden = false;
    el.loginPass.select();
  } finally {
    el.loginBtn.disabled = false;
    el.loginBtn.querySelector("span").textContent = original;
  }
}

function logout() {
  if (state.saving) return;
  setSessionToken("");
  state.data = null;
  state.headSha = "";
  state.editing = null;
  state.pendingPhoto = null;
  showLogin();
  toast("Sesión cerrada.");
}

/* ---------------- GitHub API ---------------- */

function describeError(err) {
  if (!navigator.onLine) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (err && err.status === 401) return "La sesión con GitHub no es válida. Vuelve a entrar.";
  if (err && err.status === 403) return "GitHub rechazó la operación. Puede ser el límite de peticiones o permisos del token.";
  if (err && err.status === 404) return "No se encontró el repositorio o el catálogo.";
  if (err && err.status === 409) return "El catálogo cambió mientras trabajabas. Recarga y vuelve a intentar.";
  if (err && err.status === 422) return "El catálogo cambió mientras trabajabas. Recarga y vuelve a intentar.";
  if (err && err.message) return err.message;
  return "No se pudo completar la operación. Intenta de nuevo.";
}

async function api(path, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${state.sessionToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });
  } catch {
    const err = new Error("No se pudo conectar con GitHub. Revisa tu conexión.");
    err.status = 0;
    throw err;
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body && body.message ? body.message : "";
    } catch {
      /* respuesta sin JSON */
    }
    const err = new Error(detail || `GitHub respondió ${response.status}.`);
    err.status = response.status;
    if (response.status === 401) setSessionToken("");
    throw err;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadCatalog() {
  const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const file = await api(
    `/repos/${OWNER}/${REPO}/contents/${CATALOG_PATH}?ref=${encodeURIComponent(BRANCH)}&t=${Date.now()}`
  );
  let data;
  try {
    data = JSON.parse(decodeUtf8Base64(file.content || ""));
  } catch {
    throw new Error("El catálogo no se pudo leer. Revisa que catalog.json sea válido.");
  }
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.categories)) {
    throw new Error("El catálogo tiene un formato inesperado.");
  }
  state.data = data;
  state.headSha = ref.object.sha;
}

async function commitTree(entries, message) {
  const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (state.headSha && ref.object.sha !== state.headSha) {
    const err = new Error("El catálogo cambió mientras trabajabas. Recarga y vuelve a intentar.");
    err.status = 409;
    throw err;
  }
  const baseCommit = await api(`/repos/${OWNER}/${REPO}/git/commits/${ref.object.sha}`);
  const treeEntries = [];
  for (const entry of entries) {
    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: entry.content,
        encoding: entry.encoding || "utf-8"
      })
    });
    treeEntries.push({
      path: entry.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }
  const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries })
  });
  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [ref.object.sha]
    })
  });
  try {
    await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: false })
    });
  } catch (err) {
    if (err.status === 422 || err.status === 409) {
      const conflict = new Error("El catálogo cambió mientras trabajabas. Recarga y vuelve a intentar.");
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
  return commit;
}

/* ---------------- catálogo y render ---------------- */

function categoryList() {
  return [...state.data.categories].sort((a, b) => {
    const oa = catMeta(a.slug).order;
    const ob = catMeta(b.slug).order;
    return oa - ob || a.label.localeCompare(b.label, "es");
  });
}

function hydrateSelects() {
  const cats = categoryList();
  const previousFilter = el.filterCat.value;
  const previousCategory = el.pCategory.value;
  el.filterCat.innerHTML = `<option value="">Todas las categorías</option>` +
    cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join("");
  el.pCategory.innerHTML = cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join("");
  if (cats.some((c) => c.slug === previousFilter)) el.filterCat.value = previousFilter;
  if (cats.some((c) => c.slug === previousCategory)) el.pCategory.value = previousCategory;
  else if (cats[0]) el.pCategory.value = cats[0].slug;
}

function hydratePanel() {
  hydrateSelects();
  renderStats();
  renderList();
  updateLineOptions();
  resetEditor();
}

function renderStats() {
  el.statTotal.textContent = String(state.data.items.length);
  el.statCats.textContent = String(state.data.categories.length);
  el.statDate.textContent = formatDate(state.data.generated);
}

function filteredItems() {
  const q = normalize(state.query);
  return state.data.items.filter((item) => {
    if (state.catFilter && item.category !== state.catFilter) return false;
    if (!q) return true;
    return normalize([
      item.name, item.ref, item.line, item.categoryLabel, item.category
    ].join(" ")).includes(q);
  });
}

function renderList() {
  if (!state.data) return;
  const items = filteredItems();
  const visible = items.slice(0, state.limit);
  el.resultCount.textContent = items.length === state.data.items.length
    ? `${items.length} pieza${items.length === 1 ? "" : "s"} en el catálogo`
    : `${items.length} de ${state.data.items.length} piezas`;
  el.clearFilters.hidden = !state.query && !state.catFilter;
  el.listEmpty.hidden = items.length !== 0;
  el.loadMoreBtn.hidden = items.length <= state.limit;

  el.productList.innerHTML = visible.map((item) => {
    const label = item.categoryLabel || (state.data.categories.find((c) => c.slug === item.category) || {}).label || item.category;
    const line = item.line ? `<span>${esc(item.line)}</span>` : "";
    return `
      <article class="prod">
        <img class="prod-img" src="${esc(publicPath(item.thumb || item.img))}" alt="${esc(item.alt || item.name)}" loading="lazy" decoding="async" width="58" height="70">
        <div class="prod-info">
          <span class="prod-name">${esc(item.name)}</span>
          <div class="prod-meta">
            <span class="prod-cat">${esc(label)}</span>
            ${line}
            <span class="prod-ref">${esc(item.ref)}</span>
          </div>
        </div>
        <div class="prod-price">${esc(formatPrice(item.price))}<small>USD</small></div>
        <div class="prod-actions">
          <button class="act-btn" type="button" data-action="edit" data-ref="${esc(item.ref)}" aria-label="Editar ${esc(item.name)}" title="Editar">✎</button>
          <button class="act-btn act-del" type="button" data-action="delete" data-ref="${esc(item.ref)}" aria-label="Eliminar ${esc(item.name)}" title="Eliminar">×</button>
        </div>
      </article>`;
  }).join("");
}

function updateLineOptions(preferred) {
  if (!state.data) return;
  const category = el.pCategory.value;
  const labels = new Set();
  for (const item of state.data.items) {
    if (item.category === category && item.line) labels.add(item.line);
  }
  for (const cat of state.data.categories) {
    if (cat.slug === category && Array.isArray(cat.lines)) {
      for (const line of cat.lines) if (line && line.label) labels.add(line.label);
    }
  }
  const sorted = [...labels].sort((a, b) => a.localeCompare(b, "es"));
  el.lineOptions.innerHTML = sorted.map((label) => `<option value="${esc(label)}"></option>`).join("");
  if (preferred !== undefined) {
    el.pLine.value = preferred || "";
  }
  updateNamePlaceholder();
}

function updateNamePlaceholder() {
  const cat = state.data && state.data.categories.find((c) => c.slug === el.pCategory.value);
  if (!cat) return;
  const line = el.pLine.value.trim();
  el.pName.placeholder = `Ej. ${cat.singular || cat.label}${line ? ` ${line}` : ""}`;
}

function lineCode(line) {
  const words = normalize(line).replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  let code = words[0];
  if (code.length < 3 && words[1]) code += words[1];
  return code.slice(0, 3).toUpperCase();
}

function nextRef(catSlug, line) {
  const meta = catMeta(catSlug);
  const code = lineCode(line);
  const prefix = code ? `${meta.prefix}-${code}-` : `${meta.prefix}-`;
  const used = new Set();
  for (const item of state.data.items) {
    if (!item.ref || !item.ref.startsWith(prefix)) continue;
    const tail = item.ref.slice(prefix.length);
    if (/^\d+$/.test(tail)) used.add(Number(tail));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

function refreshGeneratedRef() {
  if (state.editing) return;
  el.pRef.value = nextRef(el.pCategory.value, el.pLine.value);
}

function resetEditor(preferredCategory, preferredLine) {
  state.editing = null;
  state.refTouched = false;
  state.photoBusy = false;
  if (state.pendingPhoto && state.pendingPhoto.previewUrl) {
    URL.revokeObjectURL(state.pendingPhoto.previewUrl);
  }
  state.pendingPhoto = null;
  el.productForm.reset();
  el.photoInput.value = "";
  el.pCategory.disabled = false;
  el.uploadEmpty.hidden = false;
  el.uploadPreview.hidden = true;
  el.uploadWorking.hidden = true;
  el.previewImg.removeAttribute("src");
  el.previewMeta.textContent = "—";
  el.previewStatus.textContent = "Foto lista";
  el.photoHint.textContent = "La foto es obligatoria para una pieza nueva.";
  el.formError.hidden = true;
  el.saveBtn.disabled = false;
  el.editorKicker.textContent = "Nueva pieza";
  el.editorTitle.textContent = "Agregar producto";
  el.saveBtnText.textContent = "Publicar producto";
  el.cancelEdit.hidden = true;
  el.pPrice.value = "";
  el.pPriceNote.value = "";
  el.pLine.value = "";

  if (!state.data) return;
  const cats = categoryList();
  if (preferredCategory && cats.some((c) => c.slug === preferredCategory)) {
    el.pCategory.value = preferredCategory;
  } else if (cats[0]) {
    el.pCategory.value = cats[0].slug;
  }
  updateLineOptions();
  if (preferredLine) el.pLine.value = preferredLine;
  refreshGeneratedRef();
  updateNamePlaceholder();
}

function startEdit(ref) {
  const item = state.data.items.find((i) => i.ref === ref);
  if (!item) return;
  resetEditor();
  state.editing = item.ref;
  state.refTouched = true;
  el.pCategory.value = item.category;
  el.pCategory.disabled = true;
  updateLineOptions(item.line || "");
  el.pName.value = item.name || "";
  el.pLine.value = item.line || "";
  el.pPrice.value = item.price === null || item.price === undefined ? "" : String(item.price);
  el.pPriceNote.value = item.priceNote || "";
  el.pRef.value = item.ref;
  el.uploadEmpty.hidden = true;
  el.uploadPreview.hidden = false;
  el.previewImg.src = publicPath(item.thumb || item.img);
  el.previewStatus.textContent = "Foto actual";
  el.previewMeta.textContent = `${item.w || "—"} × ${item.h || "—"} px · puedes cambiarla`;
  el.photoHint.textContent = "Si no eliges otra foto, se conserva la actual.";
  el.editorKicker.textContent = "Editando pieza";
  el.editorTitle.textContent = "Editar producto";
  el.saveBtnText.textContent = "Guardar cambios";
  el.cancelEdit.hidden = false;
  el.formError.hidden = true;
  el.editorCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------- imágenes ---------------- */

async function decodeImage(file) {
  if ("createImageBitmap" in window) {
    try { return await createImageBitmap(file); } catch { /* fallback */ }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen. Prueba con JPG, PNG o WebP."));
    };
    image.src = url;
  });
}

function sourceSize(source) {
  return {
    width: source.width || source.naturalWidth || 0,
    height: source.height || source.naturalHeight || 0
  };
}

async function renderImage(source, maxWidth, maxHeight, quality) {
  const size = sourceSize(source);
  if (!size.width || !size.height) throw new Error("La imagen no tiene dimensiones válidas.");
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  const preferred = "image/webp";
  const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  const type = supportsWebp ? preferred : "image/jpeg";
  if (!supportsWebp) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
  }
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("El navegador no pudo procesar la foto."));
    }, type, quality);
  });
  return { blob, width, height, ext: blob.type === "image/jpeg" ? "jpg" : "webp" };
}

async function handlePhoto(file) {
  if (!file) return;
  el.formError.hidden = true;
  if (!file.type || !file.type.startsWith("image/")) {
    showFormError("Ese archivo no es una imagen. Usa JPG, PNG, WebP o HEIC.");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showFormError("La foto pesa demasiado. Usa una imagen de menos de 25 MB.");
    return;
  }
  state.photoBusy = true;
  el.uploadWorking.hidden = false;
  el.saveBtn.disabled = true;
  let source = null;
  try {
    source = await decodeImage(file);
    const full = await renderImage(source, 1280, 1600, 0.80);
    const thumb = await renderImage(source, 600, 760, 0.74);
    if (state.pendingPhoto && state.pendingPhoto.previewUrl) {
      URL.revokeObjectURL(state.pendingPhoto.previewUrl);
    }
    const previewUrl = URL.createObjectURL(full.blob);
    state.pendingPhoto = {
      full: full.blob,
      thumb: thumb.blob,
      ext: full.ext,
      thumbExt: thumb.ext,
      width: full.width,
      height: full.height,
      previewUrl
    };
    el.previewImg.src = previewUrl;
    el.uploadEmpty.hidden = true;
    el.uploadPreview.hidden = false;
    el.previewStatus.textContent = "Foto optimizada";
    el.previewMeta.textContent = `${full.width} × ${full.height} px · ${formatBytes(full.blob.size)}`;
    el.photoHint.textContent = "Si la foto no es la correcta, cámbiala antes de publicar.";
  } catch (err) {
    showFormError(err.message || "No se pudo procesar la foto.");
  } finally {
    if (source && typeof source.close === "function") source.close();
    state.photoBusy = false;
    el.uploadWorking.hidden = true;
    el.saveBtn.disabled = false;
    el.photoInput.value = "";
  }
}

/* ---------------- mutaciones del catálogo ---------------- */

function cloneCatalog() {
  return JSON.parse(JSON.stringify(state.data));
}

function recomputeCatalog(data) {
  data.items.sort((a, b) => {
    return (Number(a.order) || 99) - (Number(b.order) || 99)
      || String(a.line || "").localeCompare(String(b.line || ""), "es")
      || String(a.name || "").localeCompare(String(b.name || ""), "es");
  });
  data.total = data.items.length;
  for (const cat of data.categories) {
    const catItems = data.items.filter((item) => item.category === cat.slug);
    cat.count = catItems.length;
    const oldPositions = new Map((cat.lines || []).map((line, index) => [line.label, index]));
    const lineMap = new Map();
    for (const item of catItems) {
      const label = String(item.line || "").trim();
      if (!label) continue;
      if (!lineMap.has(label)) {
        lineMap.set(label, { label, count: 0, price: null, priceNote: null });
      }
      const line = lineMap.get(label);
      line.count += 1;
      if (line.price === null && item.price !== null && item.price !== undefined) line.price = item.price;
      if (!line.priceNote && item.priceNote) line.priceNote = item.priceNote;
    }
    cat.lines = [...lineMap.values()].sort((a, b) => {
      const pa = oldPositions.has(a.label) ? oldPositions.get(a.label) : 999;
      const pb = oldPositions.has(b.label) ? oldPositions.get(b.label) : 999;
      return pa - pb || a.label.localeCompare(b.label, "es");
    });
    if (catItems[0]) cat.coverFull = catItems[0].img;
  }
  data.generated = new Date().toISOString().slice(0, 10);
}

function imagePaths(category, ref, ext, ignoreRef) {
  const stem = slugify(ref);
  let suffix = 1;
  let image;
  let thumb;
  do {
    const name = suffix === 1 ? stem : `${stem}-${suffix}`;
    image = `assets/img/catalog/${category}/${name}.${ext}`;
    thumb = `assets/img/catalog/thumbs/${category}/${name}.${ext}`;
    suffix += 1;
  } while (state.data.items.some((item) => item.ref !== ignoreRef && (item.img === image || item.thumb === thumb)));
  return { img: image, thumb };
}

function validateForm() {
  const name = el.pName.value.trim();
  const category = el.pCategory.value;
  const line = el.pLine.value.trim();
  const ref = el.pRef.value.trim().toUpperCase();
  const rawPrice = el.pPrice.value.trim();
  const priceNote = el.pPriceNote.value.trim();
  if (!name) return { error: "Escribe el nombre de la pieza." };
  if (!category) return { error: "Elige una categoría." };
  if (!ref) return { error: "La referencia no puede quedar vacía." };
  if (!/^[A-Z0-9-]{2,28}$/.test(ref)) return { error: "La referencia solo puede tener letras, números y guiones (2 a 28)." };
  const duplicate = state.data.items.some((item) => item.ref.toLowerCase() === ref.toLowerCase() && item.ref !== state.editing);
  if (duplicate) return { error: `La referencia ${ref} ya existe en el catálogo.` };
  if (!state.editing && !state.pendingPhoto) return { error: "Sube una foto para la pieza nueva." };
  if (state.photoBusy) return { error: "Espera a que la foto termine de optimizarse." };
  if (state.pendingPhoto && state.pendingPhoto.ext !== state.pendingPhoto.thumbExt) {
    return { error: "La foto no se pudo preparar completa. Vuelve a cargarla." };
  }
  let price = null;
  if (rawPrice !== "") {
    price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) return { error: "Escribe un precio válido, sin símbolos." };
    price = Math.round(price * 100) / 100;
  }
  return { name, category, line, ref, price, priceNote: priceNote || null };
}

async function saveProduct(event) {
  event.preventDefault();
  if (state.saving) return;
  if (!state.data) return;
  el.formError.hidden = true;
  const values = validateForm();
  if (values.error) {
    showFormError(values.error);
    return;
  }
  const editingItem = state.editing ? state.data.items.find((item) => item.ref === state.editing) : null;
  if (state.editing && !editingItem) {
    showFormError("La pieza que editabas ya no existe. Recarga el catálogo.");
    return;
  }
  const category = state.data.categories.find((c) => c.slug === values.category);
  if (!category) {
    showFormError("La categoría no existe. Recarga el catálogo.");
    return;
  }

  state.saving = true;
  el.saveBtn.disabled = true;
  el.saveBtnText.textContent = editingItem ? "Guardando cambios…" : "Subiendo pieza…";
  setBusy(true, editingItem ? "Guardando cambios…" : "Subiendo producto…", "Creando el commit en GitHub");
  try {
    const next = cloneCatalog();
    const entries = [];
    let img = editingItem ? editingItem.img : "";
    let thumb = editingItem ? editingItem.thumb : "";
    let width = editingItem ? editingItem.w : 0;
    let height = editingItem ? editingItem.h : 0;
    if (state.pendingPhoto) {
      const paths = imagePaths(values.category, values.ref, state.pendingPhoto.ext, editingItem ? editingItem.ref : null);
      img = paths.img;
      thumb = paths.thumb;
      width = state.pendingPhoto.width;
      height = state.pendingPhoto.height;
      entries.push({
        path: paths.img,
        encoding: "base64",
        content: bytesToBase64(new Uint8Array(await state.pendingPhoto.full.arrayBuffer()))
      });
      entries.push({
        path: paths.thumb,
        encoding: "base64",
        content: bytesToBase64(new Uint8Array(await state.pendingPhoto.thumb.arrayBuffer()))
      });
    }
    if (!img || !thumb) throw new Error("La pieza necesita una foto. Vuelve a cargarla.");

    const item = {
      ref: values.ref,
      name: values.name,
      category: values.category,
      categoryLabel: category.label,
      line: values.line,
      price: values.price,
      priceNote: values.priceNote,
      img,
      thumb,
      order: catMeta(values.category).order,
      w: width,
      h: height,
      alt: `${values.name} — ${category.label} de Cotton Store`
    };

    let message;
    if (editingItem) {
      const index = next.items.findIndex((entry) => entry.ref === editingItem.ref);
      next.items[index] = item;
      message = `Panel: actualiza ${item.name} (${item.ref})`;
    } else {
      next.items.push(item);
      message = `Panel: agrega ${item.name} (${item.ref})`;
    }
    recomputeCatalog(next);
    entries.unshift({
      path: CATALOG_PATH,
      encoding: "utf-8",
      content: JSON.stringify(next)
    });
    const commit = await commitTree(entries, message);
    state.data = next;
    state.headSha = commit.sha;
    renderStats();
    renderList();
    hydrateSelects();
    resetEditor(values.category, values.line);
    toast(editingItem ? "Cambios publicados. La web se actualiza en 1–2 min." : "Producto subido. La web se actualiza en 1–2 min.");
  } catch (err) {
    showFormError(describeError(err));
    if (err.status === 401) {
      toast("La sesión ya no es válida. Vuelve a entrar.", true);
    }
  } finally {
    state.saving = false;
    el.saveBtn.disabled = false;
    el.saveBtnText.textContent = state.editing ? "Guardar cambios" : "Publicar producto";
    setBusy(false);
  }
}

function openDelete(ref) {
  const item = state.data.items.find((i) => i.ref === ref);
  if (!item) return;
  const category = state.data.categories.find((c) => c.slug === item.category);
  if (category && category.count <= 1) {
    toast("No puedes dejar una categoría vacía. Agrega otra pieza primero.", true);
    return;
  }
  state.deleteRef = item.ref;
  el.deleteTitle.textContent = `¿Eliminar “${item.name}”?`;
  el.deleteText.textContent = `La pieza ${item.ref} dejará de aparecer en el catálogo público. La imagen se conserva para no romper portadas.`;
  el.deleteOverlay.hidden = false;
  document.body.classList.add("is-locked");
  window.setTimeout(() => el.deleteCancel.focus(), 30);
}

function closeDelete() {
  state.deleteRef = null;
  el.deleteOverlay.hidden = true;
  document.body.classList.remove("is-locked");
}

async function confirmDelete() {
  const ref = state.deleteRef;
  const item = state.data && state.data.items.find((i) => i.ref === ref);
  if (!item || state.saving) return;
  const category = state.data.categories.find((c) => c.slug === item.category);
  if (category && category.count <= 1) {
    closeDelete();
    toast("No puedes dejar una categoría vacía. Agrega otra pieza primero.", true);
    return;
  }
  state.saving = true;
  el.deleteConfirm.disabled = true;
  setBusy(true, "Eliminando pieza…", "Creando el commit en GitHub");
  try {
    const next = cloneCatalog();
    next.items = next.items.filter((entry) => entry.ref !== item.ref);
    recomputeCatalog(next);
    const commit = await commitTree([{
      path: CATALOG_PATH,
      encoding: "utf-8",
      content: JSON.stringify(next)
    }], `Panel: elimina ${item.name} (${item.ref})`);
    state.data = next;
    state.headSha = commit.sha;
    closeDelete();
    if (state.editing === item.ref) resetEditor();
    renderStats();
    renderList();
    toast("Pieza eliminada del catálogo. La web se actualiza en 1–2 min.");
  } catch (err) {
    closeDelete();
    toast(describeError(err), true);
  } finally {
    state.saving = false;
    el.deleteConfirm.disabled = false;
    setBusy(false);
  }
}

/* ---------------- apertura y eventos ---------------- */

async function openPanel() {
  setBusy(true, "Abriendo catálogo…", "Leyendo datos desde GitHub");
  try {
    await api(`/repos/${OWNER}/${REPO}`);
    await loadCatalog();
    hydratePanel();
    el.loginView.hidden = true;
    el.panelView.hidden = false;
    window.scrollTo({ top: 0, behavior: "instant" });
  } finally {
    setBusy(false);
  }
}

async function refreshCatalog() {
  if (state.saving) return;
  if ((state.editing || state.pendingPhoto) && !window.confirm("Hay cambios sin publicar. ¿Recargar y perderlos?")) return;
  setBusy(true, "Actualizando catálogo…", "Leyendo datos desde GitHub");
  try {
    await loadCatalog();
    hydratePanel();
    toast("Catálogo actualizado.");
  } catch (err) {
    toast(describeError(err), true);
  } finally {
    setBusy(false);
  }
}

function bindEvents() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.passToggle.addEventListener("click", () => {
    const showing = el.loginPass.type === "text";
    el.loginPass.type = showing ? "password" : "text";
    el.passToggle.textContent = showing ? "Ver" : "Ocultar";
    el.passToggle.setAttribute("aria-label", showing ? "Mostrar clave" : "Ocultar clave");
    el.loginPass.focus();
  });
  el.logoutBtn.addEventListener("click", logout);
  el.refreshBtn.addEventListener("click", refreshCatalog);
  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value;
    state.limit = 36;
    renderList();
  });
  el.filterCat.addEventListener("change", () => {
    state.catFilter = el.filterCat.value;
    state.limit = 36;
    renderList();
  });
  el.clearFilters.addEventListener("click", () => {
    state.query = "";
    state.catFilter = "";
    state.limit = 36;
    el.searchInput.value = "";
    el.filterCat.value = "";
    renderList();
  });
  el.loadMoreBtn.addEventListener("click", () => {
    state.limit += 36;
    renderList();
  });
  el.productList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || !state.data) return;
    const ref = button.dataset.ref;
    if (button.dataset.action === "edit") startEdit(ref);
    if (button.dataset.action === "delete") openDelete(ref);
  });
  el.cancelEdit.addEventListener("click", () => resetEditor());
  el.productForm.addEventListener("submit", saveProduct);
  el.productForm.addEventListener("input", (event) => {
    if (event.target !== el.pRef) el.formError.hidden = true;
  });
  el.pRef.addEventListener("input", () => {
    state.refTouched = true;
    el.formError.hidden = true;
  });
  el.pCategory.addEventListener("change", () => {
    updateLineOptions();
    if (!state.editing && !state.refTouched) refreshGeneratedRef();
    updateNamePlaceholder();
  });
  el.pLine.addEventListener("input", () => {
    if (!state.editing && !state.refTouched) refreshGeneratedRef();
    updateNamePlaceholder();
  });
  el.pLine.addEventListener("change", () => {
    if (!state.editing && !state.refTouched) refreshGeneratedRef();
    updateNamePlaceholder();
  });

  el.uploadZone.setAttribute("role", "button");
  el.uploadZone.setAttribute("tabindex", "0");
  el.uploadZone.setAttribute("aria-label", "Subir foto de la pieza");
  el.uploadZone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    el.photoInput.click();
  });
  el.uploadZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      el.photoInput.click();
    }
  });
  el.changePhoto.addEventListener("click", (event) => {
    event.stopPropagation();
    el.photoInput.click();
  });
  el.photoInput.addEventListener("change", () => handlePhoto(el.photoInput.files && el.photoInput.files[0]));
  ["dragenter", "dragover"].forEach((name) => {
    el.uploadZone.addEventListener(name, (event) => {
      event.preventDefault();
      el.uploadZone.classList.add("is-drag");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    el.uploadZone.addEventListener(name, (event) => {
      event.preventDefault();
      el.uploadZone.classList.remove("is-drag");
    });
  });
  el.uploadZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handlePhoto(file);
  });

  el.deleteCancel.addEventListener("click", closeDelete);
  el.deleteConfirm.addEventListener("click", confirmDelete);
  el.deleteOverlay.addEventListener("click", (event) => {
    if (event.target === el.deleteOverlay) closeDelete();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.deleteOverlay.hidden && !state.saving) closeDelete();
  });
}

async function boot() {
  bindEvents();
  if (!window.CS_AUTH) {
    el.loginBtn.disabled = true;
    el.loginError.textContent = "Falta la configuración de acceso del panel.";
    el.loginError.hidden = false;
    return;
  }
  if (!window.isSecureContext || !window.crypto || !window.crypto.subtle) {
    el.loginBtn.disabled = true;
    el.loginError.textContent = "Abre este panel por HTTPS para poder iniciar sesión.";
    el.loginError.hidden = false;
    return;
  }
  const stored = getStoredToken();
  if (!stored) {
    el.loginUser.focus();
    return;
  }
  state.sessionToken = stored;
  try {
    await openPanel();
  } catch (err) {
    setSessionToken("");
    state.sessionToken = "";
    showLogin(describeError(err));
  }
}

boot();
