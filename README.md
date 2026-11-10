# Cotton Store — Web / Catálogo 2026

Sitio estático del catálogo de **Cotton Store**, tienda de ropa urbana en San Felipe, Yaracuy (Venezuela).

- **Web publicada:** https://cyt3rto0ls.github.io/cotton-store/
- **Repositorio:** https://github.com/Cyt3rTo0ls/cotton-store
- **Catálogo completo** organizado en 13 categorías · pedidos por WhatsApp · envíos a toda Venezuela.

## Stack

HTML + CSS + JavaScript vanilla. Sin frameworks ni build step. Sigue publicado en
GitHub Pages, pero el catálogo ya no se sirve desde el repositorio: vive en
**Supabase** (Postgres + Storage, plan gratis) y la web lo lee por REST. Así, al
publicar una pieza desde el panel aparece **al instante**, sin esperar la
recompilación de Pages.

- Tabla `catalog_doc` (una fila, `id = main`, columna `data jsonb`): el catálogo completo.
- Bucket público `catalog` de Storage: fotos y miniaturas nuevas.
- Las piezas antiguas conservan sus rutas `assets/img/...` dentro del repo (~169 MB).
- `assets/data/catalog.json` se mantiene como respaldo: `assets/js/catalog-data.js`
  usa primero Supabase, luego una copia en `localStorage` y al final ese JSON.

## Estructura

```
.
├── index.html                  # Página principal
├── catalogo.html               # Catálogo por categorías
├── 404.html                    # Página de error
├── assets/
│   ├── css/styles.css          # Sistema visual completo
│   ├── js/catalog-data.js      # Lee el catálogo de Supabase (respaldo: caché y JSON)
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

> **Ojo:** la web lee de Supabase, no de `assets/data/catalog.json`. Si cambiaste
> fotos por el flujo del Drive, publica desde el panel o vuelve a sembrar el JSON
> (ver “Base de datos” abajo); si no, esos cambios no se verán.

### Precios y nombres de línea

Se editan en `tools/build_assets.py`:

- `LINE_LABELS`: nombre visible de cada subcarpeta.
- `PRICE_RULES`: precio USD y nota por línea.
- `CATEGORIES`: orden, prefijo de referencia y descripción de cada categoría.

Después de cambiarlos, vuelve a correr `build_assets.py`.

## Base de datos (Supabase)

Proyecto `CottonStore` — `https://ggehmhtlruvszuqgqhvc.supabase.co`.

| Pieza | Dónde |
|---|---|
| Catálogo (487 piezas) | tabla `public.catalog_doc`, fila `main`, columna `data` |
| Fotos nuevas | bucket público `catalog` (`catalog/<categoría>/<archivo>.webp`, `thumbs/...`) |
| Escritura del panel | Supabase Auth, cuenta `panel@cottonstore.local` con la clave del panel |

Seguridad: la web usa solo la clave `publishable` (lectura pública). El panel
inicia sesión con la clave que ya pide el login y RLS solo deja escribir a esa
cuenta; la clave `service_role` **nunca** se envía al navegador. Las páginas
`p/<ref>.html` y `assets/img/share/` sí siguen en GitHub porque WhatsApp
necesita HTML estático para la vista previa; el panel las commitea aparte y, si
falla, la pieza igual queda publicada.

Volver a sembrar el catálogo desde el JSON del repo:

```bash
. /tmp/sb.env   # SBP, REF, URL, PUB
python3 - <<'PY'
import json, urllib.request
svc = json.load(open('/tmp/sb-keys.json'))
key = [k for k in svc if k['name'] == 'service_role'][0]['api_key']
body = json.dumps([{'id': 'main', 'data': json.load(open('assets/data/catalog.json'))}]).encode()
req = urllib.request.Request('https://ggehmhtlruvszuqgqhvc.supabase.co/rest/v1/catalog_doc',
    data=body, method='POST', headers={'apikey': key, 'Authorization': f'Bearer {key}',
    'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal'})
print(urllib.request.urlopen(req).status)
PY
```

Plan gratis: 500 MB de base y 1 GB de Storage; el proyecto se pausa tras ~1
semana sin actividad (el tráfico normal de la web lo evita).

## Publicación

El repositorio es un **GitHub Pages de proyecto** (`cotton-store`), publicado en `https://cyt3rto0ls.github.io/cotton-store/`.
Pages está configurado desde la rama `main`, carpeta `/`.

> **Seguridad:** el archivo `Datos` (token de GitHub, contactos internos) está en `.gitignore`
> y los originales de 1.6 GB también. Nunca los agregues al repositorio.
> El token que se usó para publicar debería rotarse en GitHub → Settings → Developer settings.

## Panel privado

En `CottonStore/` vive el panel para publicar sin usar la terminal. Tiene dos
modos de carga: **Una pieza** y **Varias por grupo** (elige categoría/línea,
suelta varias fotos y publícalas juntas). La primera vez que entres se crea la
cuenta de Supabase del panel con la clave que ya usas; después todo se publica
al instante, incluidas las fotos. También genera la página de cada pieza y su
vista previa para WhatsApp.

## Notas

- El botón "Pedir esta pieza" abre WhatsApp directo con la referencia, el precio
  y el enlace `p/<referencia>.html`, que muestra la foto del producto en la
  vista previa del chat.
- Los precios en la web son de referencia en USD; se confirman por WhatsApp.
- No hay carrito ni pasarela: el flujo es catálogo → WhatsApp → coordinación directa.
- Las fotos originales viven en `Cotton Store Catalogo 2026🌐/` (1.6 GB, ignorado por git).
  La web solo usa los WebP de `assets/` (~144 MB).
