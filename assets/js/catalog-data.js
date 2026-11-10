/* =========================================================
   COTTON STORE — datos del catálogo
   El catálogo vive en Supabase: al publicar una pieza aparece
   al instante, sin esperar la recompilación de GitHub Pages.
   Si Supabase o la red fallan se usa la copia guardada en el
   navegador y, como último recurso, el JSON del repositorio.
   ========================================================= */
(() => {
  "use strict";

  const SB_URL = "https://ggehmhtlruvszuqgqhvc.supabase.co";
  const SB_KEY = "sb_publishable_6GA6Olv0U_g6z1gkqv9YxA_X3Ei4cGu";
  const REMOTE = `${SB_URL}/rest/v1/catalog_doc?id=eq.main&select=data`;
  const FALLBACK = "assets/data/catalog.json";
  const CACHE_KEY = "cs_catalog_v1";
  const TIMEOUT = 9000;

  function isValid(data) {
    return (
      !!data &&
      Array.isArray(data.items) &&
      Array.isArray(data.categories) &&
      data.items.length > 0
    );
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      /* sin espacio en el navegador: no pasa nada */
    }
  }

  async function withTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fromSupabase() {
    const res = await withTimeout(REMOTE, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`Supabase respondió ${res.status}`);
    const rows = await res.json();
    const data = rows && rows[0] && rows[0].data;
    if (!isValid(data)) throw new Error("El catálogo llegó vacío");
    return data;
  }

  async function fromFile() {
    const res = await fetch(FALLBACK, { cache: "no-cache" });
    if (!res.ok) throw new Error(`El respaldo respondió ${res.status}`);
    const data = await res.json();
    if (!isValid(data)) throw new Error("El respaldo está vacío");
    return data;
  }

  async function load() {
    try {
      const data = await fromSupabase();
      writeCache(data);
      return data;
    } catch (err) {
      const cached = readCache();
      if (cached) {
        console.warn("Catálogo desde la copia del navegador:", err.message);
        return cached;
      }
      console.warn("Catálogo desde el respaldo del repositorio:", err.message);
      return fromFile();
    }
  }

  window.CS_DATA = Object.freeze({ load, fromSupabase, fromFile });
})();
