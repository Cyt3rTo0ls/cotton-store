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
// Páginas de compartir (vista previa con la foto en WhatsApp)
const SITE = "https://cyt3rto0ls.github.io/cotton-store";
const SHARE_PAGE_DIR = "p";
const SHARE_IMG_DIR = "assets/img/share";
const UPLOAD_CONCURRENCY = 5;
// Supabase: catálogo y fotos se publican al instante (sin recompilar Pages)
const SB_URL = "https://ggehmhtlruvszuqgqhvc.supabase.co";
const SB_KEY = "sb_publishable_6GA6Olv0U_g6z1gkqv9YxA_X3Ei4cGu";
const SB_BUCKET = "catalog";
const SB_DOC = "main";
const SB_EMAIL = "panel@cottonstore.local";
const SB_SESSION_KEY = "cs_admin_sb_v1";

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
  sb: null,
  query: "",
  catFilter: "",
  limit: 36,
  editing: null,
  pendingPhoto: null,
  photoBusy: false,
  pendingBack: null,
  backBusy: false,
  removeBack: false,
  saving: false,
  mode: "single",
  batch: [],
  batchSeq: 0,
  batchBackTarget: "",
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
  backZone: $("backZone"),
  backInput: $("backInput"),
  backEmpty: $("backEmpty"),
  backPreview: $("backPreview"),
  backPreviewImg: $("backPreviewImg"),
  backPreviewStatus: $("backPreviewStatus"),
  backPreviewMeta: $("backPreviewMeta"),
  backChange: $("backChange"),
  backRemove: $("backRemove"),
  backWorking: $("backWorking"),
  backHint: $("backHint"),
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
  tabSingle: $("tabSingle"),
  tabBatch: $("tabBatch"),
  singlePane: $("singlePane"),
  batchPane: $("batchPane"),
  batchForm: $("batchForm"),
  bCategory: $("bCategory"),
  bLine: $("bLine"),
  batchLineOptions: $("batchLineOptions"),
  bPrice: $("bPrice"),
  bPriceNote: $("bPriceNote"),
  bDropZone: $("bDropZone"),
  bPhotoInput: $("bPhotoInput"),
  bBackInput: $("bBackInput"),
  bCount: $("bCount"),
  bClear: $("bClear"),
  bList: $("bList"),
  bError: $("bError"),
  bSaveBtn: $("bSaveBtn"),
  bSaveText: $("bSaveText"),
  bProgress: $("bProgress"),
  deleteOverlay: $("deleteOverlay"),
  deleteTitle: $("deleteTitle"),
  deleteText: $("deleteText"),
  deleteCancel: $("deleteCancel"),
  deleteConfirm: $("deleteConfirm"),
  busy: $("busy"),
  busyTitle: $("busyTitle"),
  busyText: $("busyText"),
  toast: $("toast"),
  categoriesBtn: $("categoriesBtn"),
  catOverlay: $("catOverlay"),
  catList: $("catList"),
  catForm: $("catForm"),
  catLabel: $("catLabel"),
  catSingular: $("catSingular"),
  catPrefix: $("catPrefix"),
  catBlurb: $("catBlurb"),
  catError: $("catError"),
  catClose: $("catClose")
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
  const cat = state.data && Array.isArray(state.data.categories)
    ? state.data.categories.find((c) => c.slug === slug)
    : null;
  if (cat && (cat.prefix || cat.order || cat.singular)) {
    return {
      prefix: cat.prefix || String(slug || "XX").slice(0, 2).toUpperCase(),
      order: Number(cat.order) || 99,
      singular: cat.singular || cat.label || "Pieza"
    };
  }
  if (CAT_META[slug]) return CAT_META[slug];
  return { prefix: String(slug || "XX").slice(0, 2).toUpperCase(), order: 99, singular: "Pieza" };
}

function publicPath(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\.\.\/)/.test(path)) return path;
  return `../${String(path).replace(/^\/+/, "")}`;
}

function pagePath(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
  return `../${String(path).replace(/^\/+/, "")}`;
}

function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle("is-error", Boolean(isError));
  el.toast.classList.add("is-on");
  clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => el.toast.classList.remove("is-on"), 4600);
}

function setBusy(show, title = "Publicando…", text = "Guardando cambios") {
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
    await sbLogin(password);
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
  sbSaveSession(null);
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
  if (err && err.supabase) {
    if (err.status === 401 || err.status === 403) return "La sesión del panel caducó. Vuelve a entrar.";
    if (err.status === 404) return "No se encontró el catálogo en Supabase.";
    return err.message || "Supabase rechazó la operación.";
  }
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

/* ---------------- Supabase (catálogo y fotos) ---------------- */

function sbSaveSession(session) {
  state.sb = session;
  try {
    if (session) sessionStorage.setItem(SB_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SB_SESSION_KEY);
  } catch {
    /* sessionStorage bloqueado: la sesión vive solo en memoria */
  }
}

function sbStoredSession() {
  try {
    const raw = sessionStorage.getItem(SB_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sbError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.supabase = true;
  return err;
}

async function sbAuth(path, body) {
  let response;
  try {
    response = await fetch(`${SB_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw sbError(0, "No se pudo conectar con Supabase. Revisa tu conexión.");
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* sin cuerpo */
  }
  if (!response.ok) {
    throw sbError(
      response.status,
      (data && (data.msg || data.error_description || data.message || data.error)) || "Supabase rechazó el acceso."
    );
  }
  return data;
}

// Abre (o crea la primera vez) la sesión del panel en Supabase con la misma
// clave del panel. La cuenta vive solo en este proyecto y sirve para escribir.
async function sbLogin(password) {
  const credentials = { email: SB_EMAIL, password: `cottonstore|${password}` };
  let data = null;
  try {
    data = await sbAuth("token?grant_type=password", credentials);
  } catch (err) {
    if (err.status !== 400 && err.status !== 401) throw err;
    try {
      await sbAuth("signup", credentials);
    } catch {
      /* la cuenta ya existía */
    }
    data = await sbAuth("token?grant_type=password", credentials);
  }
  sbSaveSession({ access: data.access_token, refresh: data.refresh_token });
}

async function sbRefresh() {
  const current = state.sb || sbStoredSession();
  if (!current || !current.refresh) {
    throw sbError(401, "La sesión del panel caducó. Vuelve a entrar.");
  }
  const data = await sbAuth("token?grant_type=refresh_token", { refresh_token: current.refresh });
  sbSaveSession({ access: data.access_token, refresh: data.refresh_token });
}

async function sbRequest(path, options = {}, retried = false) {
  const token = (state.sb && state.sb.access) || SB_KEY;
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${token}`, ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${SB_URL}${path}`, { ...options, headers, cache: "no-store" });
  } catch {
    throw sbError(0, "No se pudo conectar con Supabase. Revisa tu conexión.");
  }
  if (response.status === 401 && !retried) {
    await sbRefresh();
    return sbRequest(path, options, true);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body && (body.message || body.error_description || body.error);
    } catch {
      /* respuesta sin JSON */
    }
    throw sbError(response.status, detail || `Supabase respondió ${response.status}.`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function storageUrl(path) {
  return `${SB_URL}/storage/v1/object/public/${SB_BUCKET}/${path}`;
}

async function uploadPhoto(path, blob) {
  await sbRequest(`/storage/v1/object/${SB_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "application/octet-stream",
      "x-upsert": "true"
    },
    body: blob
  });
  return storageUrl(path);
}

async function loadCatalog() {
  const rows = await sbRequest(`/rest/v1/catalog_doc?id=eq.${SB_DOC}&select=data`);
  const data = rows && rows[0] && rows[0].data;
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.categories)) {
    throw new Error("El catálogo no se pudo leer. Revisa la conexión y recarga.");
  }
  state.data = data;
}

async function saveCatalogDoc(data) {
  await sbRequest(`/rest/v1/catalog_doc?id=eq.${SB_DOC}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ data, updated_at: new Date().toISOString() })
  });
}

// La página con Open Graph todavía vive en GitHub Pages: si falla, la pieza
// igual queda publicada y solo se retrasa la vista previa de WhatsApp.
async function publishShareFiles(entries, message) {
  if (!entries.length) return true;
  // Reintenta unas veces: el commit de vista previa es best-effort y no debe
  // dejar la pieza sin publicar, pero sí intentamos crearla al instante.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await commitTree(entries, message);
      return true;
    } catch (err) {
      console.warn(`Vista previa (intento ${attempt + 1}/3):`, err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  return false;
}

async function commitTree(entries, message) {
  const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  if (state.headSha && ref.object.sha !== state.headSha) {
    const err = new Error("El catálogo cambió mientras trabajabas. Recarga y vuelve a intentar.");
    err.status = 409;
    throw err;
  }
  const baseCommit = await api(`/repos/${OWNER}/${REPO}/git/commits/${ref.object.sha}`);
  // Los blobs se suben en paralelo: un grupo de fotos tarda mucho menos.
  const uploads = entries.filter((entry) => !entry.remove);
  const blobs = await mapPool(uploads, UPLOAD_CONCURRENCY, (entry) =>
    api(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: entry.content,
        encoding: entry.encoding || "utf-8"
      })
    })
  );
  let blobIndex = 0;
  const treeEntries = entries.map((entry) => {
    if (entry.remove) {
      return { path: entry.path, mode: "100644", type: "blob", sha: null };
    }
    const blob = blobs[blobIndex];
    blobIndex += 1;
    return {
      path: entry.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    };
  });
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
  const previousBatch = el.bCategory ? el.bCategory.value : "";
  const options = cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.label)}</option>`).join("");
  el.filterCat.innerHTML = `<option value="">Todas las categorías</option>` + options;
  el.pCategory.innerHTML = options;
  if (el.bCategory) el.bCategory.innerHTML = options;
  if (cats.some((c) => c.slug === previousFilter)) el.filterCat.value = previousFilter;
  if (cats.some((c) => c.slug === previousCategory)) el.pCategory.value = previousCategory;
  else if (cats[0]) el.pCategory.value = cats[0].slug;
  if (el.bCategory) {
    if (cats.some((c) => c.slug === previousBatch)) el.bCategory.value = previousBatch;
    else if (cats[0]) el.bCategory.value = cats[0].slug;
    updateBatchLineOptions();
  }
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
            ${item.imgBack ? '<span class="prod-back-flag">frente + atrás</span>' : ""}
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
  state.removeBack = false;
  resetBackUI();
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
  state.removeBack = false;
  if (item.imgBack) {
    el.backEmpty.hidden = true;
    el.backPreview.hidden = false;
    el.backPreviewImg.src = publicPath(item.thumbBack || item.imgBack);
    el.backPreviewStatus.textContent = "Parte trasera actual";
    el.backPreviewMeta.textContent = "Puedes cambiarla o quitarla";
    el.backHint.textContent = "Así verá el cliente la espalda de la pieza.";
  }
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

/* ---------------- parte trasera (opcional) ---------------- */

const BACK_HINT = "Opcional: súbela si la pieza tiene diseño en la espalda. El cliente podrá ver la parte frontal y la trasera.";

function resetBackUI() {
  if (state.pendingBack && state.pendingBack.previewUrl) {
    URL.revokeObjectURL(state.pendingBack.previewUrl);
  }
  state.pendingBack = null;
  state.backBusy = false;
  el.backInput.value = "";
  el.backPreviewImg.removeAttribute("src");
  el.backPreview.hidden = true;
  el.backEmpty.hidden = false;
  el.backWorking.hidden = true;
  el.backPreviewStatus.textContent = "Parte trasera lista";
  el.backPreviewMeta.textContent = "—";
  el.backHint.textContent = BACK_HINT;
}

function removeBackPhoto() {
  if (state.pendingBack && state.pendingBack.previewUrl) {
    URL.revokeObjectURL(state.pendingBack.previewUrl);
  }
  state.pendingBack = null;
  state.removeBack = true;
  el.backInput.value = "";
  el.backPreviewImg.removeAttribute("src");
  el.backPreview.hidden = true;
  el.backEmpty.hidden = false;
  el.backPreviewStatus.textContent = "Parte trasera lista";
  el.backPreviewMeta.textContent = "—";
  el.backHint.textContent = "Se quitará la parte trasera al guardar los cambios.";
}

async function handleBackPhoto(file) {
  if (!file) return;
  el.formError.hidden = true;
  if (!file.type || !file.type.startsWith("image/")) {
    showFormError("Esa parte trasera no es una imagen. Usa JPG, PNG, WebP o HEIC.");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showFormError("La foto de atrás pesa demasiado. Usa una imagen de menos de 25 MB.");
    return;
  }
  state.backBusy = true;
  el.backWorking.hidden = false;
  el.saveBtn.disabled = true;
  let source = null;
  try {
    source = await decodeImage(file);
    const full = await renderImage(source, 1280, 1600, 0.80);
    const thumb = await renderImage(source, 600, 760, 0.74);
    if (state.pendingBack && state.pendingBack.previewUrl) {
      URL.revokeObjectURL(state.pendingBack.previewUrl);
    }
    const previewUrl = URL.createObjectURL(full.blob);
    state.pendingBack = {
      full: full.blob,
      thumb: thumb.blob,
      ext: full.ext,
      thumbExt: thumb.ext,
      width: full.width,
      height: full.height,
      previewUrl
    };
    state.removeBack = false;
    el.backPreviewImg.src = previewUrl;
    el.backEmpty.hidden = true;
    el.backPreview.hidden = false;
    el.backPreviewStatus.textContent = "Parte trasera lista";
    el.backPreviewMeta.textContent = `${full.width} × ${full.height} px · ${formatBytes(full.blob.size)}`;
    el.backHint.textContent = "Así verá el cliente la espalda de la pieza.";
  } catch (err) {
    showFormError(err.message || "No se pudo procesar la parte trasera.");
  } finally {
    if (source && typeof source.close === "function") source.close();
    state.backBusy = false;
    el.backWorking.hidden = true;
    el.saveBtn.disabled = false;
    el.backInput.value = "";
  }
}

/* ---------------- compartir: vista previa con la foto ---------------- */

function shareSlug(ref) {
  return normalize(ref).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "pieza";
}

function priceLabel(price) {
  if (price === null || price === undefined || price === "") return "Precio por WhatsApp";
  const value = Number(price);
  if (!Number.isFinite(value)) return "Precio por WhatsApp";
  return `$${Number.isInteger(value) ? value : value.toFixed(2)} USD`;
}

function shareDescription(item) {
  const where = item.line
    ? `${item.categoryLabel} · Línea ${item.line}`
    : item.categoryLabel;
  return `${priceLabel(item.price)} · ${where} · Ref. ${item.ref}. Pídelo por WhatsApp. Envíos a toda Venezuela.`;
}

function waMessage(item) {
  return `Hola Cotton Store 👋 Me interesa ${item.name} (Ref. ${item.ref})` +
    (item.price || item.price === 0 ? ` — $${item.price}` : "") +
    ". ¿Está disponible?";
}

// Misma estructura que tools/build_share.py: WhatsApp lee estos metadatos.
function sharePageHTML(item) {
  const slug = shareSlug(item.ref);
  const pageURL = `${SITE}/p/${slug}.html`;
  const imageURL = `${SITE}/assets/img/share/${slug}.jpg`;
  const catalogURL = `${SITE}/catalogo.html?cat=${encodeURIComponent(item.category)}&p=${encodeURIComponent(item.ref)}`;
  const localURL = `../catalogo.html?cat=${encodeURIComponent(item.category)}&p=${encodeURIComponent(item.ref)}`;
  const desc = shareDescription(item);
  const phone = (state.data && state.data.store && state.data.store.whatsapp) || "584120522641";
  const waHref = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage(item))}`;
  const kicker = item.line ? `${item.categoryLabel} · ${item.line}` : item.categoryLabel;
  const note = item.priceNote ? `<p class="note">${esc(item.priceNote)}</p>` : "";
  const backMedia = item.imgBack
    ? `\n  <a class="media" href="${esc(localURL)}"><img src="${esc(pagePath(item.thumbBack || item.imgBack))}" alt="${esc(item.altBack || `${item.name} — parte trasera`)}" width="${Number(item.wBack) || 1280}" height="${Number(item.hBack) || 1600}"></a>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(item.name)} | Cotton Store</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${esc(catalogURL)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cotton Store">
<meta property="og:title" content="${esc(item.name)} — Cotton Store">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageURL)}">
<meta property="og:image" content="${esc(imageURL)}">
<meta property="og:image:secure_url" content="${esc(imageURL)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta property="og:image:alt" content="${esc(item.alt || item.name)}">
<meta property="og:locale" content="es_VE">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(item.name)} — Cotton Store">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(imageURL)}">
<meta name="theme-color" content="#0a0a0a">
<link rel="icon" href="../favicon.ico">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0a;color:#f4f1ea;font-family:"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}
.card{width:100%;max-width:420px;background:#111;border:1px solid #262626}
.media{display:block;background:#000}
.media img{display:block;width:100%;height:auto}
.info{padding:20px}
.kicker{margin:0 0 8px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8b857a}
h1{margin:0;font-size:24px;line-height:1.05;letter-spacing:-.03em;text-transform:uppercase}
.ref{margin:6px 0 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b857a}
.price{margin:14px 0 0;font-size:25px;font-weight:800;letter-spacing:-.03em}
.note{margin:6px 0 0;font-size:11px;color:#8b857a}
.btn{display:block;margin-top:18px;padding:14px;background:#f4f1ea;color:#0a0a0a;text-align:center;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.link{display:block;margin-top:10px;padding:12px;border:1px solid #333;color:#f4f1ea;text-align:center;text-decoration:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.foot{margin:18px 0 0;padding-top:14px;border-top:1px solid #242424;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#6f6a61}
</style>
</head>
<body>
<main class="card">
  <a class="media" href="${esc(localURL)}"><img src="${esc(pagePath(item.thumb || item.img || ""))}" alt="${esc(item.alt || item.name)}" width="${Number(item.w) || 1280}" height="${Number(item.h) || 1600}"></a>${backMedia}
  <div class="info">
    <p class="kicker">${esc(kicker)}</p>
    <h1>${esc(item.name)}</h1>
    <p class="ref">Ref. ${esc(item.ref)}</p>
    <p class="price">${esc(priceLabel(item.price))}</p>
    ${note}
    <a class="btn" href="${esc(waHref)}" rel="noopener">Pedir por WhatsApp</a>
    <a class="link" href="${esc(localURL)}">Ver en el catálogo</a>
    <p class="foot">Cotton Store · San Felipe, Yaracuy · Envíos a toda Venezuela</p>
  </div>
</main>
</body>
</html>
`;
}

// Miniatura cuadrada JPEG (WhatsApp no previsualiza WebP de forma fiable).
async function squareJpeg(blob) {
  const source = await decodeImage(blob);
  const size = sourceSize(source);
  const side = Math.min(size.width, size.height);
  if (!side) throw new Error("La imagen no tiene dimensiones válidas.");
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 600);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    Math.round((size.width - side) / 2),
    Math.round((size.height - side) / 2),
    side,
    side,
    0,
    0,
    600,
    600
  );
  if (typeof source.close === "function") source.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("No se pudo preparar la vista previa de la pieza."));
    }, "image/jpeg", 0.76);
  });
}

async function blobToBase64(blob) {
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

async function mapPool(list, limit, worker) {
  const results = new Array(list.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(list[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ---------------- carga por grupo ---------------- */

function batchCategory() {
  if (!state.data) return null;
  return state.data.categories.find((category) => category.slug === el.bCategory.value) || null;
}

function showBatchError(message) {
  el.bError.textContent = message;
  el.bError.hidden = false;
  el.bError.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function setMode(mode) {
  state.mode = mode === "batch" ? "batch" : "single";
  const isBatch = state.mode === "batch";
  if (el.tabSingle) {
    el.tabSingle.classList.toggle("is-active", !isBatch);
    el.tabSingle.setAttribute("aria-selected", String(!isBatch));
  }
  if (el.tabBatch) {
    el.tabBatch.classList.toggle("is-active", isBatch);
    el.tabBatch.setAttribute("aria-selected", String(isBatch));
  }
  if (el.singlePane) el.singlePane.hidden = isBatch;
  if (el.batchPane) el.batchPane.hidden = !isBatch;
  if (isBatch) updateBatchControls();
}

function updateBatchLineOptions() {
  if (!state.data || !el.batchLineOptions) return;
  const category = el.bCategory.value;
  const labels = new Set();
  for (const item of state.data.items) {
    if (item.category === category && item.line) labels.add(item.line);
  }
  const cat = state.data.categories.find((c) => c.slug === category);
  if (cat && Array.isArray(cat.lines)) {
    for (const line of cat.lines) if (line && line.label) labels.add(line.label);
  }
  el.batchLineOptions.innerHTML = [...labels]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((label) => `<option value="${esc(label)}"></option>`)
    .join("");
}

function batchStateText(row) {
  if (row.error) return row.error;
  if (row.status === "working") return "Optimizando…";
  if (row.status === "ready" && row.full) return `Listo · ${formatBytes(row.full.size)}`;
  return "En espera";
}

function updateBatchRow(row) {
  if (!el.bList) return;
  const li = el.bList.querySelector(`[data-id="${row.id}"]`);
  if (!li) return;
  li.classList.toggle("is-error", Boolean(row.error));
  const status = li.querySelector(".batch-state");
  if (status) status.textContent = batchStateText(row);
  const img = li.querySelector(".batch-thumb");
  if (img && row.previewUrl && img.getAttribute("src") !== row.previewUrl) {
    img.src = row.previewUrl;
  }
}

function batchBackText(row) {
  if (row.backStatus === "working") return "Optimizando parte trasera…";
  if (row.backStatus === "error") return row.backError || "No se pudo cargar la parte trasera.";
  if (row.backPreviewUrl) return "Parte trasera lista";
  return "";
}

function renderBatchList() {
  if (!el.bList) return;
  const blank = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  el.bList.innerHTML = state.batch
    .map(
      (row) => `
      <li class="batch-item${row.error ? " is-error" : ""}" data-id="${row.id}">
        <img class="batch-thumb" src="${row.previewUrl || blank}" alt="" width="44" height="54">
        <div class="batch-fields">
          <input class="batch-name" data-field="name" value="${esc(row.name)}" maxlength="80" placeholder="Nombre de la pieza" aria-label="Nombre de la pieza">
          <input class="batch-ref" data-field="ref" value="${esc(row.ref)}" maxlength="28" placeholder="Referencia" aria-label="Referencia de la pieza">
          <span class="batch-state">${esc(batchStateText(row))}</span>
          <div class="batch-back">
            <img class="batch-back-thumb" src="${row.backPreviewUrl || blank}" alt="" width="26" height="32"${row.backPreviewUrl ? "" : " hidden"}>
            <button class="batch-back-btn" type="button" data-action="back">${row.backPreviewUrl ? "Cambiar parte trasera" : "＋ Parte trasera (opcional)"}</button>
            ${row.backPreviewUrl ? '<button class="batch-back-del" type="button" data-action="back-remove">Quitar</button>' : ""}
            <span class="batch-back-state">${esc(batchBackText(row))}</span>
          </div>
        </div>
        <button class="batch-remove" type="button" data-action="remove" aria-label="Quitar esta foto">×</button>
      </li>`
    )
    .join("");
}

async function processBatchBack(row, file) {
  if (!row || !file) return;
  if (!file.type || !file.type.startsWith("image/") || file.size > 25 * 1024 * 1024) {
    showBatchError("La parte trasera debe ser una imagen de menos de 25 MB.");
    return;
  }
  row.backStatus = "working";
  row.backError = "";
  renderBatchList();
  let source = null;
  try {
    source = await decodeImage(file);
    const full = await renderImage(source, 1280, 1600, 0.8);
    const thumb = await renderImage(source, 600, 760, 0.74);
    if (row.backPreviewUrl) URL.revokeObjectURL(row.backPreviewUrl);
    row.backFull = full.blob;
    row.backThumb = thumb.blob;
    row.backExt = full.ext;
    row.backWidth = full.width;
    row.backHeight = full.height;
    row.backPreviewUrl = URL.createObjectURL(full.blob);
    row.backStatus = "ready";
  } catch (err) {
    row.backStatus = "error";
    row.backError = err && err.message ? err.message : "No se pudo procesar la parte trasera.";
  } finally {
    if (source && typeof source.close === "function") source.close();
    renderBatchList();
    updateBatchControls();
  }
}

function syncBatchNames() {
  updateBatchControls();
  if (!state.data || !state.batch.length) {
    renderBatchList();
    return;
  }
  const cat = batchCategory();
  if (!cat) return;
  const line = el.bLine.value.trim();
  const code = lineCode(line);
  const prefix = `${catMeta(cat.slug).prefix}-${code ? `${code}-` : ""}`;

  const used = new Set();
  for (const item of state.data.items) {
    if (!item.ref || !item.ref.startsWith(prefix)) continue;
    const tail = item.ref.slice(prefix.length);
    if (/^\d+$/.test(tail)) used.add(Number(tail));
  }
  for (const row of state.batch) {
    if (!row.refTouched || !row.ref || !row.ref.startsWith(prefix)) continue;
    const tail = row.ref.slice(prefix.length);
    if (/^\d+$/.test(tail)) used.add(Number(tail));
  }

  let next = 1;
  for (const row of state.batch) {
    if (!row.refTouched) {
      while (used.has(next)) next += 1;
      row.ref = `${prefix}${String(next).padStart(2, "0")}`;
      used.add(next);
    }
    if (!row.nameTouched) {
      const number = Number(String(row.ref || "").slice(prefix.length));
      const parts = [cat.singular || cat.label];
      if (line) parts.push(line);
      if (Number.isFinite(number) && number > 0) parts.push(String(number).padStart(2, "0"));
      row.name = parts.join(" ");
    }
  }
  renderBatchList();
}

function updateBatchControls() {
  const total = state.batch.length;
  const ready = state.batch.filter((row) => row.status === "ready").length;
  const busy = state.batch.some((row) => row.status === "working");
  if (el.bCount) {
    el.bCount.textContent = total === 0
      ? "0 piezas en el grupo"
      : `${total} pieza${total === 1 ? "" : "s"} · ${ready} lista${ready === 1 ? "" : "s"}`;
  }
  if (el.bClear) el.bClear.hidden = total === 0;
  if (el.bSaveBtn) {
    el.bSaveBtn.disabled = state.saving || total === 0 || busy || ready !== total;
  }
  if (el.bSaveText) {
    el.bSaveText.textContent = total === 0
      ? "Publicar grupo"
      : `Publicar ${total} pieza${total === 1 ? "" : "s"}`;
  }
}

function clearBatch() {
  for (const row of state.batch) {
    if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    if (row.backPreviewUrl) URL.revokeObjectURL(row.backPreviewUrl);
  }
  state.batch = [];
  renderBatchList();
  updateBatchControls();
}

async function processBatchRow(row) {
  row.status = "working";
  updateBatchRow(row);
  let source = null;
  try {
    source = await decodeImage(row.file);
    const full = await renderImage(source, 1280, 1600, 0.8);
    const thumb = await renderImage(source, 600, 760, 0.74);
    row.full = full.blob;
    row.thumb = thumb.blob;
    row.ext = full.ext;
    row.thumbExt = thumb.ext;
    row.width = full.width;
    row.height = full.height;
    if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    row.previewUrl = URL.createObjectURL(full.blob);
    row.status = "ready";
    row.error = "";
  } catch (err) {
    row.status = "error";
    row.error = err && err.message ? err.message : "No se pudo procesar la foto.";
  } finally {
    if (source && typeof source.close === "function") source.close();
    row.file = null;
    updateBatchRow(row);
    updateBatchControls();
  }
}

async function addBatchFiles(files) {
  if (!state.data) return;
  const list = Array.from(files || []);
  if (!list.length) return;
  if (!batchCategory()) {
    showBatchError("Elige la categoría del grupo antes de subir las fotos.");
    return;
  }
  const accepted = list.filter(
    (file) => file.type && file.type.startsWith("image/") && file.size <= 25 * 1024 * 1024
  );
  if (!accepted.length) {
    showBatchError("Esas fotos no son válidas. Usa JPG, PNG, WebP o HEIC de menos de 25 MB.");
    return;
  }
  if (accepted.length < list.length) {
    toast(`${list.length - accepted.length} archivo(s) no se agregaron por formato o tamaño.`, true);
  }
  el.bError.hidden = true;
  const rows = accepted.map((file) => {
    state.batchSeq += 1;
    return {
      id: `b${state.batchSeq}`,
      file,
      name: "",
      ref: "",
      nameTouched: false,
      refTouched: false,
      status: "waiting",
      previewUrl: "",
      full: null,
      thumb: null,
      ext: "",
      thumbExt: "",
      width: 0,
      height: 0,
      error: "",
      backFull: null,
      backThumb: null,
      backExt: "",
      backWidth: 0,
      backHeight: 0,
      backPreviewUrl: "",
      backStatus: "none",
      backError: ""
    };
  });
  state.batch.push(...rows);
  syncBatchNames();
  updateBatchControls();
  await mapPool(rows, 3, processBatchRow);
  updateBatchControls();
}

async function saveBatch(event) {
  event.preventDefault();
  if (state.saving || !state.data) return;
  el.bError.hidden = true;

  const cat = batchCategory();
  if (!cat) return showBatchError("Elige la categoría del grupo.");
  if (!state.batch.length) return showBatchError("Agrega al menos una foto.");
  if (state.batch.some((row) => row.status === "working")) {
    return showBatchError("Espera a que las fotos terminen de optimizarse.");
  }
  if (state.batch.some((row) => row.status !== "ready")) {
    return showBatchError("Hay fotos con error. Quítalas o vuelve a subirlas.");
  }

  const line = el.bLine.value.trim();
  const priceNote = el.bPriceNote.value.trim();
  const rawPrice = el.bPrice.value.trim();
  let price = null;
  if (rawPrice !== "") {
    price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0) {
      return showBatchError("Escribe un precio válido, sin símbolos.");
    }
    price = Math.round(price * 100) / 100;
  }

  const seen = new Set();
  for (const row of state.batch) {
    row.name = row.name.trim();
    row.ref = String(row.ref || "").trim().toUpperCase();
    if (!row.name) return showBatchError("Cada pieza necesita un nombre.");
    if (!/^[A-Z0-9-]{2,28}$/.test(row.ref)) {
      return showBatchError(`Revisa la referencia “${row.ref}”: solo letras, números y guiones (2 a 28).`);
    }
    if (seen.has(row.ref)) return showBatchError(`La referencia ${row.ref} está repetida en el grupo.`);
    seen.add(row.ref);
    if (state.data.items.some((item) => item.ref.toLowerCase() === row.ref.toLowerCase())) {
      return showBatchError(`La referencia ${row.ref} ya existe en el catálogo.`);
    }
  }

  state.saving = true;
  updateBatchControls();
  setBusy(true, `Publicando ${state.batch.length} pieza${state.batch.length === 1 ? "" : "s"}…`, "Preparando fotos y vistas previas");
  try {
    const next = cloneCatalog();
    const entries = [];
    const rows = [...state.batch];
    let done = 0;

    for (const row of rows) {
      if (el.bProgress) el.bProgress.textContent = `Subiendo foto ${done + 1} de ${rows.length}…`;
      const paths = storagePaths(cat.slug, row.ref, row.ext);
      const img = await uploadPhoto(paths.imgPath, row.full);
      const thumb = await uploadPhoto(paths.thumbPath, row.thumb);
      const item = {
        ref: row.ref,
        name: row.name,
        category: cat.slug,
        categoryLabel: cat.label,
        line,
        price,
        priceNote: priceNote || null,
        img,
        thumb,
        order: catMeta(cat.slug).order,
        w: row.width,
        h: row.height,
        alt: `${row.name} — ${cat.label} de Cotton Store`
      };
      if (row.backFull && row.backThumb) {
        const backPaths = storagePaths(cat.slug, row.ref, row.backExt, "back");
        item.imgBack = await uploadPhoto(backPaths.imgPath, row.backFull);
        item.thumbBack = await uploadPhoto(backPaths.thumbPath, row.backThumb);
        item.wBack = row.backWidth;
        item.hBack = row.backHeight;
        item.altBack = `${row.name} — parte trasera · ${cat.label} de Cotton Store`;
      }
      next.items.push(item);

      const slug = shareSlug(item.ref);
      const preview = await squareJpeg(row.thumb);
      entries.push({ path: `${SHARE_IMG_DIR}/${slug}.jpg`, encoding: "base64", content: await blobToBase64(preview) });
      entries.push({ path: `${SHARE_PAGE_DIR}/${slug}.html`, encoding: "utf-8", content: sharePageHTML(item) });

      done += 1;
      if (el.bProgress) el.bProgress.textContent = `Publicando ${done} de ${rows.length}…`;
    }

    recomputeCatalog(next);
    if (el.bProgress) el.bProgress.textContent = "Guardando el catálogo…";
    await saveCatalogDoc(next);
    state.data = next;

    const message = `Panel: agrega ${rows.length} pieza${rows.length === 1 ? "" : "s"}` +
      ` (${cat.label}${line ? ` · ${line}` : ""})`;
    const previewSaved = await publishShareFiles(entries, message);
    renderStats();
    renderList();
    hydrateSelects();
    clearBatch();
    el.bCategory.value = cat.slug;
    el.bLine.value = line;
    el.bPrice.value = rawPrice;
    el.bPriceNote.value = priceNote;
    updateBatchLineOptions();
    toast(
      `${rows.length} pieza${rows.length === 1 ? "" : "s"} publicada${rows.length === 1 ? "" : "s"}.` +
      " Ya aparece" + (rows.length === 1 ? "" : "n") + " en la web." +
      (previewSaved ? "" : " La vista previa de WhatsApp se actualizará en breve.")
    );
  } catch (err) {
    showBatchError(describeError(err));
  } finally {
    state.saving = false;
    updateBatchControls();
    setBusy(false);
    if (el.bProgress) el.bProgress.textContent = "Todo el grupo se publica en un solo commit.";
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
    if (catItems[0]) {
      cat.coverFull = catItems[0].img;
      cat.cover = catItems[0].img;
    } else if (!cat.cover) {
      cat.cover = "assets/img/logo.webp";
      cat.coverFull = null;
    }
  }
  data.categories.sort((a, b) => {
    const oa = Number(a.order) || (CAT_META[a.slug] && CAT_META[a.slug].order) || 99;
    const ob = Number(b.order) || (CAT_META[b.slug] && CAT_META[b.slug].order) || 99;
    return oa - ob || String(a.label || "").localeCompare(String(b.label || ""), "es");
  });
  data.generated = new Date().toISOString().slice(0, 10);
}

function storagePaths(category, ref, ext, variant = "") {
  const stem = slugify(ref);
  const variantName = variant ? `-${variant}` : "";
  let suffix = 1;
  let name;
  let path;
  let thumbPath;
  do {
    name = suffix === 1 ? stem : `${stem}-${suffix}`;
    path = `catalog/${category}/${name}${variantName}.${ext}`;
    thumbPath = `thumbs/${category}/${name}${variantName}.${ext}`;
    suffix += 1;
  } while (state.data.items.some((item) => {
    const usedImg = String(item.img || "");
    const usedThumb = String(item.thumb || "");
    return usedImg.endsWith(`/${path}`) || usedThumb.endsWith(`/${thumbPath}`);
  }));
  return { imgPath: path, thumbPath };
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
  if (state.backBusy) return { error: "Espera a que la parte trasera termine de optimizarse." };
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
  setBusy(true, editingItem ? "Guardando cambios…" : "Subiendo producto…", "Subiendo la foto y guardando la pieza");
  try {
    const next = cloneCatalog();
    const entries = [];
    let img = editingItem ? editingItem.img : "";
    let thumb = editingItem ? editingItem.thumb : "";
    let width = editingItem ? editingItem.w : 0;
    let height = editingItem ? editingItem.h : 0;
    if (state.pendingPhoto) {
      const paths = storagePaths(values.category, values.ref, state.pendingPhoto.ext);
      img = await uploadPhoto(paths.imgPath, state.pendingPhoto.full);
      thumb = await uploadPhoto(paths.thumbPath, state.pendingPhoto.thumb);
      width = state.pendingPhoto.width;
      height = state.pendingPhoto.height;
    }
    if (!img || !thumb) throw new Error("La pieza necesita una foto. Vuelve a cargarla.");

    // Parte trasera: opcional. Se conserva la actual si no se cambia ni se quita.
    let imgBack = editingItem ? editingItem.imgBack || "" : "";
    let thumbBack = editingItem ? editingItem.thumbBack || "" : "";
    let widthBack = editingItem ? editingItem.wBack || 0 : 0;
    let heightBack = editingItem ? editingItem.hBack || 0 : 0;
    if (state.pendingBack) {
      const pathsBack = storagePaths(values.category, values.ref, state.pendingBack.ext, "back");
      imgBack = await uploadPhoto(pathsBack.imgPath, state.pendingBack.full);
      thumbBack = await uploadPhoto(pathsBack.thumbPath, state.pendingBack.thumb);
      widthBack = state.pendingBack.width;
      heightBack = state.pendingBack.height;
    } else if (state.removeBack) {
      imgBack = "";
      thumbBack = "";
      widthBack = 0;
      heightBack = 0;
    }

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
    if (imgBack && thumbBack) {
      item.imgBack = imgBack;
      item.thumbBack = thumbBack;
      item.wBack = widthBack;
      item.hBack = heightBack;
      item.altBack = `${values.name} — parte trasera · ${category.label} de Cotton Store`;
    }

    let message;
    if (editingItem) {
      const index = next.items.findIndex((entry) => entry.ref === editingItem.ref);
      next.items[index] = item;
      message = `Panel: actualiza ${item.name} (${item.ref})`;
    } else {
      next.items.push(item);
      message = `Panel: agrega ${item.name} (${item.ref})`;
    }

    // Vista previa para WhatsApp: miniatura JPEG + página con Open Graph
    const slug = shareSlug(item.ref);
    let preview = null;
    if (state.pendingPhoto) {
      preview = await squareJpeg(state.pendingPhoto.thumb);
    } else {
      try {
        const res = await fetch(publicPath(item.thumb));
        if (res.ok) preview = await squareJpeg(await res.blob());
      } catch {
        preview = null;
      }
    }
    if (preview) {
      entries.push({
        path: `${SHARE_IMG_DIR}/${slug}.jpg`,
        encoding: "base64",
        content: await blobToBase64(preview)
      });
    }
    entries.push({
      path: `${SHARE_PAGE_DIR}/${slug}.html`,
      encoding: "utf-8",
      content: sharePageHTML(item)
    });
    if (editingItem && editingItem.ref !== item.ref) {
      const oldSlug = shareSlug(editingItem.ref);
      entries.push({ path: `${SHARE_PAGE_DIR}/${oldSlug}.html`, remove: true });
      entries.push({ path: `${SHARE_IMG_DIR}/${oldSlug}.jpg`, remove: true });
    }

    recomputeCatalog(next);
    await saveCatalogDoc(next);
    state.data = next;
    const previewSaved = await publishShareFiles(entries, message);
    renderStats();
    renderList();
    hydrateSelects();
    resetEditor(values.category, values.line);
    toast(
      (editingItem ? "Cambios publicados." : "Producto publicado.") +
      " Ya aparece en la web." +
      (previewSaved ? "" : " La vista previa de WhatsApp se actualizará en breve.")
    );
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
  setBusy(true, "Eliminando pieza…", "Guardando el cambio");
  try {
    const next = cloneCatalog();
    next.items = next.items.filter((entry) => entry.ref !== item.ref);
    recomputeCatalog(next);
    const slug = shareSlug(item.ref);
    await saveCatalogDoc(next);
    state.data = next;
    await publishShareFiles([{
      path: `${SHARE_PAGE_DIR}/${slug}.html`,
      remove: true
    }, {
      path: `${SHARE_IMG_DIR}/${slug}.jpg`,
      remove: true
    }], `Panel: elimina ${item.name} (${item.ref})`);
    closeDelete();
    if (state.editing === item.ref) resetEditor();
    renderStats();
    renderList();
    toast("Pieza eliminada. Ya no aparece en la web.");
  } catch (err) {
    closeDelete();
    toast(describeError(err), true);
  } finally {
    state.saving = false;
    el.deleteConfirm.disabled = false;
    setBusy(false);
  }
}

/* ---------------- gestión de categorías ---------------- */

function showCatError(message) {
  if (!el.catError) return;
  el.catError.textContent = message;
  el.catError.hidden = false;
}

function slugifyCategory(label) {
  const base = normalize(label).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "categoria";
  let slug = base;
  let n = 2;
  const existing = new Set((state.data && state.data.categories || []).map((c) => c.slug));
  while (existing.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function renderCatList() {
  if (!el.catList || !state.data) return;
  const cats = categoryList();
  el.catList.innerHTML = cats.map((c) => {
    const count = state.data.items.filter((item) => item.category === c.slug).length;
    const title = count > 0
      ? `Eliminar categoría y sus ${count} pieza${count === 1 ? "" : "s"}`
      : "Eliminar categoría vacía";
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.08);">
        <div style="min-width:0;">
          <strong style="display:block;">${esc(c.label)}</strong>
          <small style="display:block;color:#6b6560;font-size:11px;">
            ${esc(c.slug)} · ${count} pieza${count === 1 ? "" : "s"} · prefijo ${esc(catMeta(c.slug).prefix)}
          </small>
        </div>
        <button class="text-btn" type="button" data-cat-delete="${esc(c.slug)}" title="${esc(title)}">Eliminar</button>
      </div>`;
  }).join("");
  el.catList.querySelectorAll("[data-cat-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.catDelete));
  });
}

function openCatManager() {
  if (!state.data) return;
  renderCatList();
  if (el.catForm) el.catForm.reset();
  if (el.catError) el.catError.hidden = true;
  if (el.catPrefix) {
    delete el.catPrefix.dataset.touched;
    el.catPrefix.value = "";
  }
  if (el.catOverlay) {
    el.catOverlay.hidden = false;
    document.body.classList.add("is-locked");
  }
}

function closeCatManager() {
  if (el.catOverlay) {
    el.catOverlay.hidden = true;
    document.body.classList.remove("is-locked");
  }
}

async function addCategory(event) {
  event.preventDefault();
  if (state.saving || !state.data) return;
  if (el.catError) el.catError.hidden = true;

  const label = (el.catLabel && el.catLabel.value || "").trim();
  if (!label) {
    showCatError("Escribe el nombre de la categoría.");
    return;
  }
  const singular = (el.catSingular && el.catSingular.value || "").trim() || label;
  let prefix = (el.catPrefix && el.catPrefix.value || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  if (!prefix) prefix = normalize(label).replace(/[^a-z]/g, "").slice(0, 2).toUpperCase() || "XX";
  const blurb = (el.catBlurb && el.catBlurb.value || "").trim() || `${label} seleccionados por Cotton Store.`;
  const slug = slugifyCategory(label);
  if (state.data.categories.some((c) => c.slug === slug)) {
    showCatError("Ya existe una categoría con ese nombre.");
    return;
  }

  state.saving = true;
  setBusy(true, "Agregando categoría…", "Guardando el catálogo");
  try {
    const next = cloneCatalog();
    const order = next.categories.reduce((max, c) => {
      const o = Number(c.order) || (CAT_META[c.slug] && CAT_META[c.slug].order) || 0;
      return Math.max(max, o);
    }, 0) + 1;
    next.categories.push({
      slug,
      label,
      singular,
      blurb,
      prefix,
      order,
      count: 0,
      cover: "assets/img/logo.webp",
      coverFull: null,
      lines: []
    });
    recomputeCatalog(next);
    await saveCatalogDoc(next);
    state.data = next;
    hydrateSelects();
    renderStats();
    renderCatList();
    if (el.catForm) el.catForm.reset();
    if (el.catPrefix) delete el.catPrefix.dataset.touched;
    toast("Categoría agregada. Ya aparece en la web.");
  } catch (err) {
    showCatError(describeError(err));
  } finally {
    state.saving = false;
    setBusy(false);
  }
}

async function deleteCategory(slug) {
  if (state.saving || !state.data) return;
  const cat = state.data.categories.find((c) => c.slug === slug);
  if (!cat) return;
  const items = state.data.items.filter((item) => item.category === slug);
  const count = items.length;
  const message = count > 0
    ? `¿Eliminar la categoría “${cat.label}” y sus ${count} pieza${count === 1 ? "" : "s"}? Esta acción no se puede deshacer.`
    : `¿Eliminar la categoría “${cat.label}”?`;
  if (!window.confirm(message)) return;

  state.saving = true;
  setBusy(true, "Eliminando categoría…", "Guardando el catálogo");
  try {
    const next = cloneCatalog();
    const removedItems = next.items.filter((item) => item.category === slug);
    next.items = next.items.filter((item) => item.category !== slug);
    next.categories = next.categories.filter((c) => c.slug !== slug);
    recomputeCatalog(next);
    await saveCatalogDoc(next);
    state.data = next;

    // Vista previa de WhatsApp: elimina las páginas de las piezas borradas.
    const shareEntries = [];
    for (const item of removedItems) {
      const s = shareSlug(item.ref);
      shareEntries.push({ path: `${SHARE_PAGE_DIR}/${s}.html`, remove: true });
      shareEntries.push({ path: `${SHARE_IMG_DIR}/${s}.jpg`, remove: true });
    }
    if (shareEntries.length) {
      await publishShareFiles(shareEntries, `Panel: elimina categoría ${cat.label} (${removedItems.length} piezas)`);
    }

    hydrateSelects();
    renderStats();
    renderCatList();
    toast(`Categoría eliminada${removedItems.length ? ` con ${removedItems.length} pieza${removedItems.length === 1 ? "" : "s"}` : ""}.`);
  } catch (err) {
    toast(describeError(err), true);
  } finally {
    state.saving = false;
    setBusy(false);
  }
}

/* ---------------- apertura y eventos ---------------- */

async function openPanel() {
  setBusy(true, "Abriendo catálogo…", "Leyendo el catálogo desde Supabase");
  try {
    try {
      await api(`/repos/${OWNER}/${REPO}`);
    } catch (err) {
      console.warn("GitHub no respondió; la vista previa de WhatsApp puede fallar.", err);
    }
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
  setBusy(true, "Actualizando catálogo…", "Leyendo el catálogo desde Supabase");
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

  if (el.backZone) {
    el.backZone.setAttribute("role", "button");
    el.backZone.setAttribute("tabindex", "0");
    el.backZone.setAttribute("aria-label", "Subir parte trasera de la pieza (opcional)");
    el.backZone.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      el.backInput.click();
    });
    el.backZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        el.backInput.click();
      }
    });
    el.backInput.addEventListener("change", () => handleBackPhoto(el.backInput.files && el.backInput.files[0]));
    el.backChange.addEventListener("click", (event) => {
      event.stopPropagation();
      el.backInput.click();
    });
    el.backRemove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeBackPhoto();
    });
  }
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

  // ----- carga por grupo -----
  if (el.tabSingle) el.tabSingle.addEventListener("click", () => setMode("single"));
  if (el.tabBatch) el.tabBatch.addEventListener("click", () => setMode("batch"));
  if (el.batchForm) el.batchForm.addEventListener("submit", saveBatch);
  if (el.bCategory) {
    el.bCategory.addEventListener("change", () => {
      updateBatchLineOptions();
      syncBatchNames();
    });
  }
  if (el.bLine) {
    el.bLine.addEventListener("input", () => {
      if (!state.batch.some((row) => row.refTouched)) syncBatchNames();
    });
    el.bLine.addEventListener("change", syncBatchNames);
  }
  if (el.bPrice) el.bPrice.addEventListener("input", () => { el.bError.hidden = true; });
  if (el.bPriceNote) el.bPriceNote.addEventListener("input", () => { el.bError.hidden = true; });
  if (el.bClear) el.bClear.addEventListener("click", clearBatch);

  if (el.bList) {
    el.bList.addEventListener("input", (event) => {
      const li = event.target.closest(".batch-item");
      if (!li) return;
      const row = state.batch.find((entry) => entry.id === li.dataset.id);
      if (!row) return;
      if (event.target.dataset.field === "name") {
        row.name = event.target.value;
        row.nameTouched = true;
      } else if (event.target.dataset.field === "ref") {
        row.ref = event.target.value.toUpperCase();
        event.target.value = row.ref;
        row.refTouched = true;
      }
      el.bError.hidden = true;
    });
    el.bList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const li = button.closest(".batch-item");
      const row = state.batch.find((entry) => entry.id === (li && li.dataset.id));
      if (!row) return;
      const action = button.dataset.action;
      if (action === "back") {
        state.batchBackTarget = row.id;
        if (el.bBackInput) el.bBackInput.click();
        return;
      }
      if (action === "back-remove") {
        if (row.backPreviewUrl) URL.revokeObjectURL(row.backPreviewUrl);
        row.backPreviewUrl = "";
        row.backFull = null;
        row.backThumb = null;
        row.backStatus = "none";
        row.backError = "";
        renderBatchList();
        updateBatchControls();
        return;
      }
      if (action === "remove") {
        const index = state.batch.indexOf(row);
        if (index < 0) return;
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
        if (row.backPreviewUrl) URL.revokeObjectURL(row.backPreviewUrl);
        state.batch.splice(index, 1);
        renderBatchList();
        updateBatchControls();
      }
    });

    if (el.bBackInput) {
      el.bBackInput.addEventListener("change", () => {
        const file = el.bBackInput.files && el.bBackInput.files[0];
        const row = state.batch.find((entry) => entry.id === state.batchBackTarget);
        el.bBackInput.value = "";
        state.batchBackTarget = "";
        if (row && file) processBatchBack(row, file);
      });
    }
  }

  if (el.bDropZone && el.bPhotoInput) {
    el.bDropZone.setAttribute("role", "button");
    el.bDropZone.setAttribute("tabindex", "0");
    el.bDropZone.setAttribute("aria-label", "Subir varias fotos del grupo");
    el.bDropZone.addEventListener("click", () => el.bPhotoInput.click());
    el.bDropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        el.bPhotoInput.click();
      }
    });
    el.bPhotoInput.addEventListener("change", () => {
      const files = el.bPhotoInput.files ? Array.from(el.bPhotoInput.files) : [];
      el.bPhotoInput.value = "";
      addBatchFiles(files);
    });
    ["dragenter", "dragover"].forEach((name) => {
      el.bDropZone.addEventListener(name, (event) => {
        event.preventDefault();
        el.bDropZone.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((name) => {
      el.bDropZone.addEventListener(name, (event) => {
        event.preventDefault();
        el.bDropZone.classList.remove("is-drag");
      });
    });
    el.bDropZone.addEventListener("drop", (event) => {
      const files = event.dataTransfer && event.dataTransfer.files
        ? Array.from(event.dataTransfer.files)
        : [];
      addBatchFiles(files);
    });
  }

  if (el.categoriesBtn) el.categoriesBtn.addEventListener("click", openCatManager);
  if (el.catForm) el.catForm.addEventListener("submit", addCategory);
  if (el.catClose) el.catClose.addEventListener("click", closeCatManager);
  if (el.catOverlay) {
    el.catOverlay.addEventListener("click", (event) => {
      if (event.target === el.catOverlay && !state.saving) closeCatManager();
    });
  }
  if (el.catLabel) {
    el.catLabel.addEventListener("input", () => {
      if (el.catPrefix && !el.catPrefix.dataset.touched) {
        el.catPrefix.value = normalize(el.catLabel.value).replace(/[^a-z]/g, "").slice(0, 2).toUpperCase();
      }
    });
  }
  if (el.catPrefix) {
    el.catPrefix.addEventListener("input", () => {
      if (el.catPrefix.value.trim() === "") delete el.catPrefix.dataset.touched;
      else el.catPrefix.dataset.touched = "1";
    });
    el.catPrefix.addEventListener("focus", () => {
      try { el.catPrefix.select(); } catch { /* ignore */ }
    });
  }

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
  const sbStored = sbStoredSession();
  if (!stored || !sbStored) {
    if (stored) showLogin("Vuelve a entrar para publicar.");
    else el.loginUser.focus();
    return;
  }
  state.sessionToken = stored;
  state.sb = sbStored;
  try {
    await openPanel();
  } catch (err) {
    try {
      await sbRefresh();
      await openPanel();
    } catch {
      sbSaveSession(null);
      setSessionToken("");
      state.sessionToken = "";
      showLogin(describeError(err));
    }
  }
}

boot();
