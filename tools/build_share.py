#!/usr/bin/env python3
"""Genera las páginas de compartir de cada pieza.

Cada pieza del catálogo tiene dos archivos:

- ``p/<referencia>.html``  → página con metadatos Open Graph para que WhatsApp
  (y cualquier red) muestre la vista previa con la foto, el nombre y el precio.
- ``assets/img/share/<referencia>.jpg`` → miniatura cuadrada JPEG (WhatsApp no
  previsualiza WebP de forma fiable).

La web enlaza esa página en el mensaje de "Pedir esta pieza" y en el botón de
compartir. El panel privado genera los mismos archivos al publicar una pieza.

Uso:
    python3 tools/build_share.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / "assets" / "data" / "catalog.json"
SHARE_IMG = BASE / "assets" / "img" / "share"
SHARE_PAGES = BASE / "p"

SITE = "https://cyt3rto0ls.github.io/cotton-store"
WHATSAPP = "584120522641"
JPEG_SIZE = 600


def share_slug(ref: str) -> str:
    plain = unicodedata.normalize("NFD", str(ref)).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")
    return slug or "pieza"


def price_label(item: dict) -> str:
    price = item.get("price")
    if price in (None, ""):
        return "Precio por WhatsApp"
    value = float(price)
    number = str(int(value)) if value.is_integer() else f"{value:.2f}"
    return f"${number} USD"


def description(item: dict) -> str:
    line = item.get("line")
    cat = item.get("categoryLabel") or item.get("category") or "Cotton Store"
    where = f"{cat} · Línea {line}" if line else cat
    return (
        f"{price_label(item)} · {where} · Ref. {item['ref']}. "
        "Pídelo por WhatsApp. Envíos a toda Venezuela."
    )


def wa_text(item: dict) -> str:
    price = item.get("price")
    extra = f" — ${price}" if price not in (None, "") else ""
    return (
        f"Hola Cotton Store 👋 Me interesa {item['name']} (Ref. {item['ref']})"
        f"{extra}. ¿Está disponible?"
    )


def page_html(item: dict) -> str:
    e = lambda value: html.escape(str(value), quote=True)
    slug = share_slug(item["ref"])
    url = f"{SITE}/p/{slug}.html"
    image = f"{SITE}/assets/img/share/{slug}.jpg"
    title = f"{item['name']} | Cotton Store"
    desc = description(item)
    line = item.get("line")
    cat = e(item.get("categoryLabel") or "")
    kicker = f"{cat} · {e(line)}" if line else cat
    catalog_url = (
        f"../catalogo.html?cat={e(item.get('category', ''))}&p={e(item['ref'])}"
    )
    media = item.get("thumb") or item.get("img") or ""
    wa = f"https://wa.me/{WHATSAPP}?text=" + html.escape(
        __import__("urllib.parse", fromlist=["quote"]).quote(wa_text(item)),
        quote=True,
    )
    note = (
        f'<p class="note">{e(item["priceNote"])}</p>' if item.get("priceNote") else ""
    )

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{e(f"{SITE}/catalogo.html?cat={item.get('category', '')}&p={item['ref']}")}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cotton Store">
<meta property="og:title" content="{e(item['name'])} — Cotton Store">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:image" content="{e(image)}">
<meta property="og:image:secure_url" content="{e(image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="{JPEG_SIZE}">
<meta property="og:image:height" content="{JPEG_SIZE}">
<meta property="og:image:alt" content="{e(item.get('alt') or item['name'])}">
<meta property="og:locale" content="es_VE">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(item['name'])} — Cotton Store">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{e(image)}">
<meta name="theme-color" content="#0a0a0a">
<link rel="icon" href="../favicon.ico">
<style>
*{{box-sizing:border-box}}
body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0a0a0a;color:#f4f1ea;font-family:"Helvetica Neue",Arial,sans-serif;-webkit-text-size-adjust:100%}}
.card{{width:100%;max-width:420px;background:#111;border:1px solid #262626}}
.media{{display:block;background:#000}}
.media img{{display:block;width:100%;height:auto}}
.info{{padding:20px}}
.kicker{{margin:0 0 8px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8b857a}}
h1{{margin:0;font-size:24px;line-height:1.05;letter-spacing:-.03em;text-transform:uppercase}}
.ref{{margin:6px 0 0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b857a}}
.price{{margin:14px 0 0;font-size:25px;font-weight:800;letter-spacing:-.03em}}
.note{{margin:6px 0 0;font-size:11px;color:#8b857a}}
.btn{{display:block;margin-top:18px;padding:14px;background:#f4f1ea;color:#0a0a0a;text-align:center;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}}
.link{{display:block;margin-top:10px;padding:12px;border:1px solid #333;color:#f4f1ea;text-align:center;text-decoration:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase}}
.foot{{margin:18px 0 0;padding-top:14px;border-top:1px solid #242424;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#6f6a61}}
</style>
</head>
<body>
<main class="card">
  <a class="media" href="{catalog_url}"><img src="../{e(media)}" alt="{e(item.get('alt') or item['name'])}" width="{int(item.get('w') or 1280)}" height="{int(item.get('h') or 1600)}"></a>
  <div class="info">
    <p class="kicker">{kicker}</p>
    <h1>{e(item['name'])}</h1>
    <p class="ref">Ref. {e(item['ref'])}</p>
    <p class="price">{e(price_label(item))}</p>
    {note}
    <a class="btn" href="{wa}" rel="noopener">Pedir por WhatsApp</a>
    <a class="link" href="{catalog_url}">Ver en el catálogo</a>
    <p class="foot">Cotton Store · San Felipe, Yaracuy · Envíos a toda Venezuela</p>
  </div>
</main>
</body>
</html>
"""


def square_thumb(item: dict) -> bool:
    """Crea la miniatura cuadrada JPEG que usa la vista previa."""
    relative = item.get("thumb") or item.get("img")
    if not relative:
        return False
    source = BASE / relative
    if not source.is_file():
        return False
    dest = SHARE_IMG / f"{share_slug(item['ref'])}.jpg"
    with Image.open(source) as image:
        image = image.convert("RGB")
        width, height = image.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        image = image.resize((JPEG_SIZE, JPEG_SIZE), Image.LANCZOS)
        image.save(dest, "JPEG", quality=76, optimize=True, progressive=True)
    return True


def build_share_pages(verbose: bool = True) -> int:
    if not DATA.is_file():
        raise SystemExit(f"No existe {DATA}")
    catalog = json.loads(DATA.read_text(encoding="utf-8"))
    items = catalog.get("items") or []

    SHARE_IMG.mkdir(parents=True, exist_ok=True)
    SHARE_PAGES.mkdir(parents=True, exist_ok=True)
    for stale in SHARE_PAGES.glob("*.html"):
        stale.unlink()
    for stale in SHARE_IMG.glob("*.jpg"):
        stale.unlink()

    pages = 0
    thumbs = 0
    for item in items:
        (SHARE_PAGES / f"{share_slug(item['ref'])}.html").write_text(
            page_html(item), encoding="utf-8"
        )
        pages += 1
        if square_thumb(item):
            thumbs += 1

    if verbose:
        print(f"OK  {pages} páginas de compartir  |  {thumbs} miniaturas JPEG")
    return pages


if __name__ == "__main__":
    built = build_share_pages()
    sys.exit(0 if built else 1)
