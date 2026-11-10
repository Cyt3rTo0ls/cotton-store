# PASO A PASO — Cómo se construyó la web de Cotton Store

> Documento para retomar el proyecto sin contexto previo.
> Última actualización: 7 de noviembre de 2026.

---

## 1. De qué trata la web

Cotton Store es una tienda de ropa urbana en San Felipe, Yaracuy (Venezuela).
La web es un **catálogo digital + embudo de pedidos por WhatsApp**:

- Muestra el catálogo 2026 organizado en **13 categorías** y sus líneas, sin publicar cantidades de inventario.
- Permite buscar, filtrar por categoría/línea y ordenar por precio o nombre.
- Cada pieza abre una ficha con foto grande, referencia, precio (si está definido) y botón de WhatsApp con el mensaje ya escrito.
- Tiene enlaces compartibles: `?p=FR-ALI-01` abre la ficha; `?cat=franelas&line=Oversize` abre filtrado.
- No hay carrito, pagos ni cuentas. El pedido se cierra por WhatsApp (+58 412-0522641).
- Estética blanco y negro, tipografía pesada y editorial, alineada con el logotipo.

**En línea:** https://cyt3rto0ls.github.io/cotton-store/
**Repo:** https://github.com/Cyt3rTo0ls/cotton-store

---

## 2. Información de origen

Todo salió del archivo `Datos` del directorio (hoy ignorado por git):

- Nombre: Cotton Store — ropa urbana, San Felipe, Yaracuy.
- Logotipo: `logotipo.jpeg` (esfera geométrica + wordmark, blanco sobre negro).
- WhatsApp Business: +58 412-0522641 → `wa.me/584120522641`.
- Correo: `Cottonstore75@gmail.com`.
- Dirección: 87M5+WR5, Avenida 5 Libertador, San Felipe 3201, Yaracuy.
- Instagram: https://www.instagram.com/cottonstore.ven/
- Facebook: https://www.facebook.com/people/Cotton-Store/100085036136711/
- TikTok: https://www.tiktok.com/@cottonstore.ven
- Catálogo: carpeta pública de Google Drive.
- Token de GitHub para publicar (NO está en el repo; ver seguridad en el punto 11).

Se verificó el perfil de Instagram (4.179 seguidores, 489 publicaciones) y la página de Facebook.
No se inventaron horarios, métodos de pago, años de fundación ni testimonios.

---

## 3. Descarga del catálogo

La carpeta de Drive se descargó completa a:

```
Cotton Store Catalogo 2026🌐/
```

**Herramienta:** `tools/sync_catalog.py`

Cómo funciona:

1. Lista recursivamente la carpeta pública usando `embeddedfolderview` de Drive (no requiere API key).
2. Guarda el listado en `tools/drive_manifest.json` (caché).
3. Descarga en paralelo (6 workers) solo lo que falta o está corrupto.
4. Valida por magic bytes: JPEG, PNG, WebP y **HEIC/HEIF**.
5. Es reanudable: se puede cortar y volver a ejecutar.

Detalles que costaron tiempo:

- `gdown` fallaba con estos archivos y además no reanudaba; se cambió a `requests` + `curl`-like con hilos.
- Había **18 archivos HEIC** (iPhone) y uno sin extensión (`Flare Jean`).
  Se instaló `pillow-heif` y el validador acepta HEIC.
- Resultado: el catálogo completo descargado (1.6 GB). Los originales se quedan en local y están en `.gitignore`.

Comando:

```bash
python3 tools/sync_catalog.py
```

Estructura real de categorías (nombres originales con emojis):

```
Accesorios (9)          Bandoleros 🔥 (21)     Bermudas (15)
Camisas (1)             Chemises (13)          Conjuntos (1)
Franelas (190)          Gorras 🧢 (84)          Monos deportivos (17)
Pantalones 👖 (61)      Shorts (17)            Sueters (28)
Zapatos (27)
```

Franelas se subdivide en Alicrada, Alta Gama 1.1, Alta Gama 20$, Alta Gama 32$,
Deportiva, Deportiva 15$, Full Estampado, Fútbol, Manga Cero, Manga Cero 8$,
Oversize, Pedrería, Promo 1x8·2x15 y Unicolor.
Pantalones: Baggy, Básico 12$, Calle 8, Multicargo, Purple, Texas, Urbano y Urbano 20$.
Gorras: AAA, Cerrada, Línea 1.1, Top Quality.
Sueters: Con Capucha, Cuello Redondo, Deportivo 20$, Sudadera.

---

## 4. Generación de assets web

**Herramienta:** `tools/build_assets.py` (Pillow + pillow-heif).

Salidas:

- `assets/img/catalog/<categoria>/<archivo>.webp` → imagen grande (máx. 1280×1600, q80).
- `assets/img/catalog/thumbs/...` → miniatura (máx. 600×760, q74).
- `assets/img/categories/<slug>.webp` → portada de cada categoría.
- `assets/img/hero/*.webp` → 3 fotos del hero (bandolero Amiri, franela Godspeed, Vans).
- `assets/img/logo.webp/png`, `mark.webp` (solo la esfera), iconos 32/180/192/512, `favicon.ico`.
- `assets/img/og.jpg` → tarjeta social 1200×630 generada con el logo y tipografía.
- `assets/data/catalog.json` → todos los datos de la tienda y las piezas.

Decisiones:

- **WebP** para bajar peso: originales ~3 MB → ~250 KB por imagen grande.
- Se corrige la orientación EXIF (`ImageOps.exif_transpose`).
- Total de `assets/`: **~144 MB** (998 archivos). El JSON pesa ~172 KB.
- Los nombres de carpeta con emojis (`Bandoleros 🔥`, `Gorras 🧢`, `Pantalones 👖`)
  se resuelven con matching tolerante, porque el emoji cambia el path.

### Modelo de datos (`catalog.json`)

```json
{
  "generated": "2026-11-07",
  "store": { "whatsapp": "584120522641", "instagram": "...", "...": "..." },
  "hero": [{ "img": "assets/img/hero/img-1285.webp" }],
  "categories": [{
    "slug": "franelas", "label": "Franelas", "count": 190,
    "cover": "assets/img/categories/franelas.webp",
    "lines": [{ "label": "Oversize", "count": 34, "price": null }]
  }],
  "items": [{
    "ref": "FR-ALI-01",
    "name": "Franela Alicrada 01",
    "category": "franelas", "categoryLabel": "Franelas",
    "line": "Alicrada", "price": 17, "priceNote": null,
    "img": "assets/img/catalog/franelas/alicradaimg-1701.webp",
    "thumb": "assets/img/catalog/thumbs/franelas/alicradaimg-1701.webp",
    "w": 1280, "h": 1600,
    "alt": "Franela Alicrada 01 — Franelas de Cotton Store"
  }]
}
```

Reglas de naming y referencias:

- **Nombre:** `singular + línea + número por línea` (ej. `Gorra AAA 03`).
  El precio de la línea **no** va en el nombre.
- **Referencia:** `prefijo categoría - código de línea - número`.
  Ej.: `FR-ALT20-01`, `GO-AAA-02`, `PA-BAG-03`.
- Los códigos de línea se generan con `line_code_map()` para evitar colisiones
  (`ALT`, `ALT20`, `ALT32`, `DEP`, `DEP15`...). Verificado: todas las referencias
  y todos los nombres quedan únicos.
- Precios: se toman de `PRICE_RULES` (solo las líneas cuyo nombre de carpeta trae precio).
  Las demás muestran “Precio por WhatsApp”. Actualmente **116 piezas con precio** y 368 a consultar.

Comando:

```bash
python3 tools/build_assets.py
```

---

## 5. Diseño y UI/UX

Sistema visual:

- **Paleta:** negro `#0a0a0a`, papel `#fbf9f5`, hueso `#f1eee7`, gris `#6f6960`,
  verde WhatsApp `#25d366` solo en iconos. Sin colores inventados de marca.
- **Tipografía:** `Archivo` 400–900 para títulos (muy pesada, tracking negativo) e
  `Inter` para texto. Titulares con palabras en contorno (`-webkit-text-stroke`).
- **Formas:** esquinas rectas, bordes de 1 px, mucho aire, retícula editorial.
- **Logo:** la esfera se usa como marca suelta en el header; el logo completo en footer/OG.
- **Fotos:** en blanco y negro por defecto en hero y categorías, color al pasar el mouse.
  En el catálogo van a color para que el producto se vea real.

Secciones de `index.html`:

1. **Header sticky negro:** navegación, Instagram, CTA de WhatsApp, menú móvil.
2. **Hero:** “ROPA URBANA SIN FILTROS”, texto de valor, 2 CTAs, métricas y collage de 3 fotos.
3. **Ticker** animado con envíos/pedidos (se pausa al hover, se apaga con `reduced-motion`).
4. **Categorías:** carrusel horizontal con scroll-snap y flechas; cada tarjeta lleva a su categoría. Sin contadores.
5. **CTA de catálogo:** botón grande “Ver catálogo” que abre `catalogo.html`. El inicio no muestra inventario.
6. **Cómo comprar:** 3 pasos + CTA.
7. **Nosotros:** panel negro con logo, texto de tienda y valores.
8. **Contacto:** WhatsApp, correo, dirección (Google Maps) y redes.
9. **Footer:** wordmark gigante en contorno, navegación y aviso legal de precios.
10. **Catálogo (`catalogo.html`):** primero el selector de 13 categorías; al elegir una se muestran sus piezas con buscador, línea, orden, “cargar más” y ficha.
11. **Ficha de producto (modal):** foto grande, categoría/línea, ref, precio, nota,
    descripción, CTA de WhatsApp, compartir, flechas, swipe y teclado. Sin conteos de inventario.

Responsive:

- **Móvil (≤720 px):** 2 columnas de producto, menú fullscreen, hero apilado,
  modal a pantalla completa, barra de filtros no sticky, botón flotante de WhatsApp.
- **Tablet (≤980 px):** 3 columnas, hero apilado, panel “Nosotros” horizontal.
- **Laptop/desktop (≥1024 px):** grilla de 4 columnas, hero a dos columnas, filtros sticky y flechas del carrusel.

Accesibilidad y detalles:

- Skip link, `aria-label`, `aria-live` en resultados, foco visible.
- Trampa de foco en el modal, cierre con `Esc`, flechas ←/→, swipe en móvil.
- `prefers-reduced-motion` desactiva animaciones.
- `loading="lazy"` + `decoding="async"` + dimensiones para evitar CLS.
- Metadatos Open Graph/Twitter, JSON-LD `ClothingStore`, sitemap, robots, manifest y 404.

---

## 6. Estructura de archivos

```
index.html                     Página principal
404.html                       Error 404 con estética de la tienda
assets/css/styles.css          Todo el diseño (tokens, componentes, responsive)
assets/js/home.js              Inicio: categorías, menú y animaciones
assets/js/catalogo.js          Catálogo: selector, filtros, modal, deep links, WA
assets/data/catalog.json       Datos generados
assets/img/catalog/            WebP grandes + thumbs/
assets/img/categories/         Portadas de categorías
assets/img/hero/               3 fotos del hero
assets/img/about/              Arte de la marca en la sección Nosotros
assets/img/share/              Miniatura JPEG por pieza (vista previa WhatsApp)
p/                             Página de cada pieza con Open Graph (generadas)
assets/img/logo.* mark.*        Marca
assets/img/og.jpg              Imagen social
tools/sync_catalog.py          Descarga del Drive
tools/build_assets.py          Procesa imágenes y genera el JSON
tools/build_share.py           Genera p/ y assets/img/share/
tools/drive_manifest.json      Caché (ignorado)
PASO-A-PASO.md                 Este documento
README.md                      Resumen y comandos
Datos                          Info privada (ignorado)
Cotton Store Catalogo 2026🌐/  Originales 1.6 GB (ignorado)
```

---

## 7. Cómo retomar el proyecto

```bash
cd /home/onaha06/Cotton

# 1. Ver la web en local
python3 -m http.server 8099
# abrir http://127.0.0.1:8099

# 2. Si faltan fotos originales
python3 tools/sync_catalog.py

# 3. Reconstruir imágenes y JSON (después de agregar piezas o cambiar precios)
#    build_assets.py ya regenera también las páginas de compartir.
python3 tools/build_assets.py

# 3b. Solo regenerar las páginas de compartir (sin tocar imágenes)
python3 tools/build_share.py

# 4. Verificar sintaxis
node --check assets/js/catalogo.js && node --check assets/js/home.js

# 5. Publicar
git add -A
git commit -m "Actualiza catálogo"
git push
```

Dependencias usadas (ya instaladas con `pip --user`):

- `Pillow` (imágenes), `pillow-heif` (HEIC), `requests` (Drive), `gdown` (alternativa).

---

## 8. Publicación en GitHub Pages

1. Se creó el repositorio **público** `Cyt3rTo0ls/cotton-store`
   (GitHub Pages de proyecto: la web vive en `/cotton-store/`).
2. Se inicializó git en esta carpeta y se subió `main`. Luego el repo se renombró a `cotton-store`.
3. Se activó Pages por API con origen `main` / `/`; GitHub ajustó la URL al nombre del repo.
4. URL final: **https://cyt3rto0ls.github.io/cotton-store/**

Comandos de referencia:

```bash
git init -b main
git add -A
git commit -m "Cotton Store — catálogo web 2026"
git remote add origin https://github.com/Cyt3rTo0ls/cotton-store.git
git push -u origin main
```

Para activar Pages (una sola vez):

```bash
curl -X POST -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/Cyt3rTo0ls/cotton-store/pages \
  -d '{"source":{"branch":"main","path":"/"}}'
```

---

## 9. Cómo actualizar el catálogo

### Agregar piezas

1. Subir las fotos al Drive en la carpeta de categoría/línea correcta.
2. `python3 tools/sync_catalog.py`
3. `python3 tools/build_assets.py`
4. `git add -A && git commit -m "Nuevas piezas" && git push`

La referencia y el nombre se generan solos (el número interno no se publica).
Si una línea es nueva, agregarla a `LINE_LABELS` y, si tiene precio, a `PRICE_RULES`.
Si es una categoría nueva, agregarla a `CATEGORIES` (slug, prefijo, orden y descripción).

### Cambiar precios

Editar `PRICE_RULES` en `tools/build_assets.py` y reconstruir.
Para precios por pieza individual habría que agregar un campo manual en el JSON
(no existe hoy: el precio es por línea).

### Cambiar textos de la tienda

- Copy general: `index.html`.
- Datos de contacto del JSON: `tools/build_assets.py` → bloque `catalog["store"]`.
- Estilos: variables al inicio de `assets/css/styles.css`.

---

## 9b. Pedidos por WhatsApp con vista previa de la pieza

El botón **Pedir esta pieza** es un enlace directo `wa.me` (sin JavaScript de por
medio), así que abre WhatsApp en Android, iPhone y computadora. El mensaje lleva
la referencia, el precio y una URL propia de la pieza:

```
https://cyt3rto0ls.github.io/cotton-store/p/fr-ali-01.html
```

Esa página (`p/<referencia>.html`) trae metadatos `og:title`, `og:description` y
`og:image` con la foto cuadrada `assets/img/share/<referencia>.jpg`, de modo que
WhatsApp muestra la vista previa del producto en el chat. Las páginas son
`noindex` para no duplicar el catálogo en buscadores.

- Se generan con `tools/build_share.py` (y `build_assets.py` lo llama al final).
- El panel privado las crea también al publicar una pieza nueva, editarla o
  borrarla. Si cambia la referencia, mueve la página y la miniatura.
- La constante `SITE` (JS, `tools/build_share.py`) apunta a la URL de Pages; si
  se pasa a dominio propio hay que actualizarla en esos dos lugares.

### Subir varias piezas de un grupo (panel)

El panel (`CottonStore/`) tiene dos pestañas en el editor: **Una pieza** y
**Varias por grupo**. La segunda permite:

1. Elegir categoría y línea (y precio/nota para todo el grupo).
2. Arrastrar o seleccionar todas las fotos a la vez.
3. Revisar nombre y referencia generados (editables) y publicar.

Las fotos se optimizan en el navegador (WebP grande + miniatura), se suben al
bucket de Supabase y el catálogo se guarda al instante: no hay que esperar la
recompilación de GitHub Pages. Lo único que todavía se commitea es la vista
previa de WhatsApp (`p/<ref>.html` + `assets/img/share/<ref>.jpg`), porque
WhatsApp necesita HTML estático para mostrarla.

### Base de datos (Supabase, plan gratis sin tarjeta)

- Proyecto `CottonStore` (Postgres 17), URL `https://ggehmhtlruvszuqgqhvc.supabase.co`.
- Una sola tabla `public.catalog_doc (id text primary key, data jsonb, updated_at)`
  con la fila `main`: la misma forma que tenía `catalog.json`, así que el panel y
  la web no cambiaron su modelo de datos.
- Bucket público `catalog` en Storage para fotos y miniaturas nuevas. Las 487
  piezas anteriores siguen apuntando a `assets/img/...` del repositorio.
- RLS: lectura pública; escritura solo para la cuenta `panel@cottonstore.local`.
  El panel usa la `publishable key` (pública, de lectura) y crea esa cuenta en el
  primer inicio de sesión con la misma clave del login; la `service_role` nunca
  llega al navegador.
- `assets/js/catalog-data.js` centraliza la lectura: Supabase → copia en
  `localStorage` → `assets/data/catalog.json`. `home.js` y `catalogo.js` solo
  llaman a `window.CS_DATA.load()`.
- La CSP del panel (`CottonStore/index.html`) permite `connect-src` e `img-src`
  hacia el dominio del proyecto; si algún día se cambia de proyecto, hay que
  actualizarla junto con las constantes `SB_*` de `admin.js` y `catalog-data.js`.
- Plan gratis: 500 MB de base, 1 GB de Storage; el proyecto se pausa tras ~1
  semana sin actividad y el tráfico normal de la web lo mantiene despierto.

## 10. Verificación hecha

- `node --check assets/js/catalogo.js && node --check assets/js/home.js` → OK.
- JSON y manifest parsean correctamente.
- Inicio sin inventario visible: 0 tarjetas de producto, 13 categorías y CTA a `catalogo.html`.
- Catálogo sin categoría: selector de categorías visible y grilla oculta.
- Categoría elegida: 24 tarjetas iniciales y 13 chips para cambiar de categoría.
- Filtro por URL `catalogo.html?cat=franelas&line=Oversize` → piezas de la línea.
- Deep link `catalogo.html?cat=gorras&p=GO-AAA-02` → modal abierto con título, imagen y link de WhatsApp.
- Búsqueda sin resultados → estado vacío visible.
- Prueba real con CDP: clic en categoría, cambio de categoría, cargar más, modal, cierre con Esc, menú móvil y 0 errores de consola.
- Referencias y nombres únicos, y **0 archivos de imagen faltantes**.
- No se pudo completar una prueba E2E con Selenium/Playwright por incompatibilidad
  de los drivers del entorno (no por errores de la web). Las pruebas de DOM y de
  lógica de datos sí pasaron.

### Prueba de Supabase (CDP, contra el proyecto real)

- Login del panel con la clave del panel → sesión de Supabase OK (y creación de la
  cuenta en el primer intento).
- Catálogo leído de Supabase: 487 piezas, 13 categorías.
- Escritura anónima bloqueada por RLS (la fila queda intacta).
- Foto subida al bucket y accesible por su URL pública.
- Pieza de prueba guardada → visible al instante por REST, sin commit ni espera de
  Pages; luego borrada y catálogo devuelto a 487.
- Web pública: `catalogo.html?cat=franelas` lee Supabase y renderiza (24 tarjetas
  iniciales, 168 tras hacer scroll), inicio con 13 categorías, 0 errores de consola.
- El usuario de prueba de Auth y el objeto de Storage se borraron al terminar, así
  que el primer login real crea la cuenta con la clave del usuario.

---

## 11. Seguridad y pendientes

**Importante:** el token de GitHub se compartió en texto plano y quedó en `Datos`.
Está en `.gitignore`, pero **debe rotarse** en GitHub → Settings → Developer settings →
Personal access tokens. Después de rotarlo, actualizar el remoto si se usa con token.

La `publishable key` de Supabase sí es pública (va en el JS de la web y solo lee).
La `service_role`, la contraseña de la base y el token de gestión no están en el
repo ni en el código: se usaron solo desde la terminal para crear la tabla, las
políticas y el bucket.

Pendientes sugeridos (no implementados):

- Dominio propio (`cottonstoreven.com` o similar) con CNAME.
- Precios por pieza y control de tallas/stock (hoy todo se confirma por WhatsApp).
- Analítica privacy-friendly (Plausible/Umami) para medir clics a WhatsApp.
- Subir el catálogo también como PDF/WhatsApp catalog.
- Revisar nombres comerciales de las piezas (hoy son referencias de catálogo).
- Comprimir aún más las imágenes si se quiere bajar de 144 MB (por ejemplo AVIF).

---

## 12. Contactos y enlaces

- WhatsApp: +58 412-0522641
- Correo: Cottonstore75@gmail.com
- Instagram: https://www.instagram.com/cottonstore.ven/
- TikTok: https://www.tiktok.com/@cottonstore.ven
- Facebook: https://www.facebook.com/people/Cotton-Store/100085036136711/
- Dirección: 87M5+WR5, Avenida 5 Libertador, San Felipe 3201, Yaracuy, Venezuela
- Web: https://cyt3rto0ls.github.io/cotton-store/
