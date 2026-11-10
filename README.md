# Cotton Store — Web / Catálogo 2026

Sitio estático del catálogo de **Cotton Store**, tienda de ropa urbana en San Felipe, Yaracuy (Venezuela).

- **Web publicada:** https://cyt3rto0ls.github.io/cotton-store/
- **Repositorio:** https://github.com/Cyt3rTo0ls/cotton-store
- **Catálogo completo** organizado en 13 categorías · pedidos por WhatsApp · envíos a toda Venezuela.

## Stack

HTML + CSS + JavaScript vanilla. Sin frameworks, sin build step, sin backend.
Los datos viven en `assets/data/catalog.json` y las imágenes en `assets/img/catalog/`.

## Estructura

```
.
├── index.html                  # Página principal
├── catalogo.html               # Catálogo por categorías
├── 404.html                    # Página de error
├── assets/
│   ├── css/styles.css          # Sistema visual completo
│   ├── js/home.js              # Inicio: categorías y menú
│   ├── js/catalogo.js          # Catálogo: selector, filtros, ficha, WhatsApp
│   ├── data/catalog.json       # Datos del catálogo
│   └── img/                    # WebP optimizados, logo, OG, iconos
│       ├── about/              # Arte de la sección Nosotros
│       └── share/              # Miniatura JPEG por pieza (vista previa WhatsApp)
├── p/                          # Página de cada pieza con Open Graph (generada)
├── tools/
│   ├── sync_catalog.py         # Descarga el Drive (reanudable, soporta HEIC)
│   ├── build_assets.py         # Genera WebP + catalog.json + branding
│   ├── build_share.py          # Genera p/ y assets/img/share/
│   └── drive_manifest.json     # Caché del listado (ignorado por git)
├── PASO-A-PASO.md              # Bitácora técnica del proyecto
├── site.webmanifest
├── robots.txt / sitemap.xml
└── Datos                       # Info privada de la tienda (IGNORADO por git)
```

## Ver la web en local

```bash
cd /home/onaha06/Cotton
python3 -m http.server 8099
# http://127.0.0.1:8099
```

Abre siempre con un servidor: el catálogo se carga con `fetch()` y necesita HTTP.

El inicio no muestra el inventario: lleva a `catalogo.html`, donde se elige una categoría y recién ahí se ven las piezas.

## Regenerar el catálogo (cuando hay piezas nuevas)

1. Agrega las fotos al Drive dentro de la carpeta de su categoría/línea.
2. Sincroniza los originales:

```bash
python3 tools/sync_catalog.py
```

3. Genera los assets web, el JSON y las páginas de compartir:

```bash
python3 tools/build_assets.py
```

O, para regenerar solo las páginas de pieza (`p/`) y las miniaturas de
vista previa:

```bash
python3 tools/build_share.py
```

4. Verifica y publica:

```bash
git add -A && git commit -m "Actualiza catálogo"
git push
```

GitHub Pages reconstruye solo en ~1 minuto.

### Precios y nombres de línea

Se editan en `tools/build_assets.py`:

- `LINE_LABELS`: nombre visible de cada subcarpeta.
- `PRICE_RULES`: precio USD y nota por línea.
- `CATEGORIES`: orden, prefijo de referencia y descripción de cada categoría.

Después de cambiarlos, vuelve a correr `build_assets.py`.

## Publicación

El repositorio es un **GitHub Pages de proyecto** (`cotton-store`), publicado en `https://cyt3rto0ls.github.io/cotton-store/`.
Pages está configurado desde la rama `main`, carpeta `/`.

> **Seguridad:** el archivo `Datos` (token de GitHub, contactos internos) está en `.gitignore`
> y los originales de 1.6 GB también. Nunca los agregues al repositorio.
> El token que se usó para publicar debería rotarse en GitHub → Settings → Developer settings.

## Panel privado

En `CottonStore/` vive el panel para publicar sin usar la terminal. Tiene dos
modos de carga: **Una pieza** y **Varias por grupo** (elige categoría/línea,
suelta varias fotos y publícalas juntas en un solo commit). También genera la
página de cada pieza y su vista previa para WhatsApp.

## Notas

- El botón "Pedir esta pieza" abre WhatsApp directo con la referencia, el precio
  y el enlace `p/<referencia>.html`, que muestra la foto del producto en la
  vista previa del chat.
- Los precios en la web son de referencia en USD; se confirman por WhatsApp.
- No hay carrito ni pasarela: el flujo es catálogo → WhatsApp → coordinación directa.
- Las fotos originales viven en `Cotton Store Catalogo 2026🌐/` (1.6 GB, ignorado por git).
  La web solo usa los WebP de `assets/` (~144 MB).
