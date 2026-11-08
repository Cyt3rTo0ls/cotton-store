# Cotton Store — Web / Catálogo 2026

Sitio estático del catálogo de **Cotton Store**, tienda de ropa urbana en San Felipe, Yaracuy (Venezuela).

- **Web publicada:** https://cyt3rto0ls.github.io/
- **Repositorio:** https://github.com/Cyt3rTo0ls/Cyt3rTo0ls.github.io
- **Catálogo:** 484 piezas · 13 categorías · pedidos por WhatsApp · envíos a toda Venezuela.

## Stack

HTML + CSS + JavaScript vanilla. Sin frameworks, sin build step, sin backend.
Los datos viven en `assets/data/catalog.json` y las imágenes en `assets/img/catalog/`.

## Estructura

```
.
├── index.html                  # Página principal
├── 404.html                    # Página de error
├── assets/
│   ├── css/styles.css          # Sistema visual completo
│   ├── js/app.js               # Catálogo, filtros, modal, WhatsApp
│   ├── data/catalog.json       # Datos generados (484 piezas)
│   └── img/                    # WebP optimizados, logo, OG, iconos
├── tools/
│   ├── sync_catalog.py         # Descarga el Drive (reanudable, soporta HEIC)
│   ├── build_assets.py         # Genera WebP + catalog.json + branding
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

## Regenerar el catálogo (cuando hay piezas nuevas)

1. Agrega las fotos al Drive dentro de la carpeta de su categoría/línea.
2. Sincroniza los originales:

```bash
python3 tools/sync_catalog.py
```

3. Genera los assets web y el JSON:

```bash
python3 tools/build_assets.py
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

El repositorio es un **GitHub Pages de usuario** (`Cyt3rTo0ls.github.io`), por lo que la web queda en la raíz del dominio.
Pages está configurado desde la rama `main`, carpeta `/`.

> **Seguridad:** el archivo `Datos` (token de GitHub, contactos internos) está en `.gitignore`
> y los originales de 1.6 GB también. Nunca los agregues al repositorio.
> El token que se usó para publicar debería rotarse en GitHub → Settings → Developer settings.

## Notas

- Los precios en la web son de referencia en USD; se confirman por WhatsApp.
- No hay carrito ni pasarela: el flujo es catálogo → WhatsApp → coordinación directa.
- Las fotos originales viven en `Cotton Store Catalogo 2026🌐/` (1.6 GB, ignorado por git).
  La web solo usa los WebP de `assets/` (~144 MB).
