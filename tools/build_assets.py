#!/usr/bin/env python3
"""
Genera los assets del sitio a partir del catálogo original de Google Drive.

Salidas:
  assets/img/catalog/<cat>/<archivo>.webp          -> imagen grande (lightbox)
  assets/img/catalog/<cat>/thumbs/<archivo>.webp   -> miniatura (grid)
  assets/data/catalog.json                         -> datos del catálogo
  assets/img/logo.png / logo.webp                  -> logotipo
  assets/img/hero/*.webp                           -> imágenes del hero
  assets/img/og.jpg, favicon*, apple-touch-icon    -> branding
  assets/img/categories/<slug>.webp                -> portadas de categoría

Uso: python3 tools/build_assets.py [--force] [--workers N]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import unicodedata
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:  # soporte HEIC (fotos de iPhone)
    from pillow_heif import register_heif_opener

    register_heif_opener()
    HEIF = True
except Exception:  # noqa: BLE001
    HEIF = False

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / "Cotton Store Catalogo 2026🌐"
OUT = BASE / "assets"
IMG_OUT = OUT / "img"
CAT_OUT = IMG_OUT / "catalog"
DATA_OUT = OUT / "data"
LOGO = BASE / "logotipo.jpeg"

FULL_SIZE = (1280, 1600)
THUMB_SIZE = (600, 760)
FULL_Q = 80
THUMB_Q = 74

# ---------------------------------------------------------------- categorías
# order define el orden en la web. prefix se usa para las referencias.
CATEGORIES = [
    ("Franelas", "franelas", "Franelas", "Franela", "FR", 1,
     "Franelas, oversize, pedrería y deportivas."),
    ("Chemises", "chemises", "Chemises", "Chemise", "CH", 2,
     "Chemises de vestir y casuales."),
    ("Camisas", "camisas", "Camisas", "Camisa", "CA", 3,
     "Camisas para completar el fit."),
    ("Sueters", "sueters", "Sueters", "Suéter", "SU", 4,
     "Hoodies, sudaderas y cuello redondo."),
    ("Bandoleros", "bandoleros", "Bandoleros", "Bandolero", "BA", 5,
     "Bandoleros y crossbody."),
    ("Bermudas", "bermudas", "Bermudas", "Bermuda", "BE", 6,
     "Bermudas denim y cargo."),
    ("Shorts", "shorts", "Shorts", "Short", "SH", 7,
     "Shorts para el clima de acá."),
    ("Pantalones", "pantalones", "Pantalones", "Pantalón", "PA", 8,
     "Baggy, cargo, denim y más."),
    ("Monos deportivos", "monos", "Monos deportivos", "Mono deportivo", "MO", 9,
     "Monos y conjuntos deportivos."),
    ("Zapatos", "zapatos", "Zapatos", "Zapatos", "ZA", 10,
     "Sneakers y calzado urbano."),
    ("Gorras", "gorras", "Gorras", "Gorra", "GO", 11,
     "Cerradas, AAA y top quality."),
    ("Accesorios", "accesorios", "Accesorios", "Accesorio", "AC", 12,
     "Morrales, cangureras y detalles."),
    ("Conjuntos", "conjuntos", "Conjuntos", "Conjunto", "CO", 13,
     "Sets listos para usar."),
]

# Etiqueta legible para cada subcarpeta (sin precios ni emojis).
LINE_LABELS = {
    "Alicradas (17$)": "Alicrada",
    "Alta Gama 1.1": "Alta Gama 1.1",
    "Alta Gama de 20$": "Alta Gama 20$",
    "Alta Gama 32$": "Alta Gama 32$",
    "Franelas 1x8$ y 2x15": "Promo 1x8 · 2x15",
    "Franelas deportivas": "Deportiva",
    "Deportivas de 15$": "Deportiva 15$",
    "Full estampados": "Full Estampado",
    "Futbol": "Fútbol",
    "Manga cero": "Manga Cero",
    "Manga cero de 8$ a bcv": "Manga Cero 8$",
    "Oversize": "Oversize",
    "Unicolor": "Unicolor",
    "Pedreria": "Pedrería",
    "Cerradas": "Cerrada",
    "Gorras 1.1": "Línea 1.1",
    "Gorras AAA": "AAA",
    "Top quality": "Top Quality",
    "Baggy": "Baggy",
    "Multicargo": "Multicargo",
    "Pantalones 12$🚨‼️": "Básico 12$",
    "Pantalones Urbanos🔥": "Urbano",
    "Pantalones de 20$": "Urbano 20$",
    "Pantalones calle 8": "Calle 8",
    "Purple": "Purple",
    "Texas": "Texas",
    "Cuello redondo": "Cuello Redondo",
    "Deportivos 20$": "Deportivo 20$",
    "Sudadera": "Sudadera",
    "Sueters con capucha": "Con Capucha",
    "Monos deportivos": "Deportivo",
}

# Precio en USD y nota, tomados del nombre de la carpeta.
PRICE_RULES = {
    "Alicradas (17$)": (17, None),
    "Alta Gama de 20$": (20, None),
    "Alta Gama 32$": (32, None),
    "Franelas 1x8$ y 2x15": (8, "1 por $8 · 2 por $15"),
    "Deportivas de 15$": (15, None),
    "Manga cero de 8$ a bcv": (8, "Precio en $ a tasa BCV"),
    "Pantalones 12$🚨‼️": (12, None),
    "Pantalones de 20$": (20, None),
    "Pantalones calle 8": (8, None),
    "Deportivos 20$": (20, None),
}

# Imágenes elegidas para el hero (se validan al construir).
HERO_PATHS = [
    "Bandoleros 🔥/IMG_1285.JPG",
    "Franelas/Oversize/IMG_1177.JPG",
    "Zapatos/IMG_0323.JPG",
]


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("🔥", "").replace("🧢", "").replace("👖", "")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "item"


def line_code_map(labels: list[str]) -> dict[str, str]:
    """Códigos cortos y únicos por línea (ALT, ALT20, ALT32...)."""
    used: dict[str, str] = {}
    mapping: dict[str, str] = {}
    for label in sorted({lb for lb in labels if lb}):
        slug = slugify(label).replace("-", "")
        base = (slug[:3] or "GEN").upper()
        code = base
        if code in used and used[code] != label:
            digits = re.sub(r"\D", "", label)[:2]
            code = (base + digits).upper() if digits else slug[3:5].upper()
        i = 5
        while code in used and used[code] != label:
            code = (base + slug[3:i]).upper()
            i += 1
        used[code] = label
        mapping[label] = code
    return mapping


def parse_price(folder: str) -> tuple[int | None, str | None]:
    if folder in PRICE_RULES:
        return PRICE_RULES[folder]
    m = re.search(r"(\d+)\s*\$", folder)
    if m:
        return int(m.group(1)), None
    m = re.search(r"calle\s*(\d+)", folder)
    if m:
        return int(m.group(1)), None
    return None, None


def resolve_image(src: Path) -> Path | None:
    for cand in (src, src.with_suffix(".jpg"), src.with_suffix(".jpeg")):
        if cand.exists() and cand.stat().st_size > 20_000:
            return cand
    # búsqueda tolerante a mayúsculas
    if src.parent.exists():
        want = src.stem.lower()
        for f in src.parent.iterdir():
            if f.stem.lower() == want and f.is_file():
                return f
    return None


def process_image(job: dict) -> dict | None:
    src = Path(job["src"])
    rel = job["rel"]
    try:
        if HEIF:
            register_heif_opener()
        im = Image.open(src)
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        elif im.mode == "L":
            im = im.convert("RGB")

        cat_out = Path(job.get("cat_out", CAT_OUT))
        full = im.copy()
        full.thumbnail(FULL_SIZE, Image.LANCZOS)
        full_path = cat_out / f"{rel}.webp"
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full.save(full_path, "WEBP", quality=FULL_Q, method=4)

        if job.get("thumb", True):
            thumb = im.copy()
            thumb.thumbnail(THUMB_SIZE, Image.LANCZOS)
            thumb_path = cat_out / "thumbs" / f"{rel}.webp"
            thumb_path.parent.mkdir(parents=True, exist_ok=True)
            thumb.save(thumb_path, "WEBP", quality=THUMB_Q, method=4)

        return {
            "ok": True,
            "w": full.width,
            "h": full.height,
            "full": str(full_path),
            "thumb": str(thumb_path) if job.get("thumb", True) else None,
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"{src}: {exc}"}


def build_logo() -> None:
    im = Image.open(LOGO).convert("RGB")
    im.save(IMG_OUT / "logo.png", optimize=True)
    im.save(IMG_OUT / "logo.webp", quality=92, method=4)

    # marca suelta (solo la esfera) para el header
    mark = im.crop((140, 45, 500, 385))
    canvas = Image.new("RGB", (512, 512), "#000000")
    canvas.paste(mark.resize((512, 483), Image.LANCZOS), (0, 14))
    canvas.save(IMG_OUT / "mark.png", optimize=True)
    canvas.save(IMG_OUT / "mark.webp", quality=92, method=4)

    # favicon cuadrado (el logo ya lo es)
    icon = im.copy()
    icon.thumbnail((512, 512), Image.LANCZOS)
    icon.save(IMG_OUT / "icon-512.png", optimize=True)
    for size in (192, 180, 32):
        icon.resize((size, size), Image.LANCZOS).save(
            IMG_OUT / f"icon-{size}.png", optimize=True
        )
    icon.resize((64, 64), Image.LANCZOS).save(
        BASE / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )


def build_og() -> None:
    W, H = 1200, 630
    canvas = Image.new("RGB", (W, H), "#0a0a0a")
    draw = ImageDraw.Draw(canvas)

    # textura sutil de puntos
    for y in range(0, H, 4):
        for x in range(0, W, 4):
            if (x * 7 + y * 13) % 97 == 0:
                draw.point((x, y), fill="#1c1c1c")

    logo = Image.open(LOGO).convert("RGB")
    logo.thumbnail((420, 420), Image.LANCZOS)
    canvas.paste(logo, (70, (H - logo.height) // 2))

    def font(size: int) -> ImageFont.FreeTypeFont:
        for p in (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ):
            if Path(p).exists():
                return ImageFont.truetype(p, size)
        return ImageFont.load_default()

    x = 545
    draw.text((x, 175), "ROPA URBANA", font=font(66), fill="#ffffff")
    draw.text((x, 262), "SAN FELIPE · YARACUY", font=font(28), fill="#b9b4aa")
    draw.line((x, 318, x + 560, 318), fill="#3a3a3a", width=2)
    draw.text((x, 352), "ENVÍOS A TODA", font=font(40), fill="#ffffff")
    draw.text((x, 400), "VENEZUELA", font=font(40), fill="#ffffff")
    draw.text((x, 492), "PEDIDOS POR WHATSAPP", font=font(26), fill="#b9b4aa")
    canvas.save(IMG_OUT / "og.jpg", quality=90, optimize=True, progressive=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="reprocesar todo")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    if not SRC.exists():
        raise SystemExit(f"No existe el catálogo: {SRC}")
    for d in (CAT_OUT, CAT_OUT / "thumbs", DATA_OUT, IMG_OUT / "hero", IMG_OUT / "categories"):
        d.mkdir(parents=True, exist_ok=True)

    items: list[dict] = []
    jobs: list[dict] = []
    stats = {"found": 0, "missing": 0}

    for folder, cslug, clabel, singular, prefix, order, blurb in CATEGORIES:
        cat_dir = SRC / folder
        if not cat_dir.exists():  # las carpetas originales traen emojis
            plain = re.sub(r"[^\w\s]", "", folder).strip().lower()
            for cand in SRC.iterdir():
                if cand.is_dir() and (
                    re.sub(r"[^\w\s]", "", cand.name).strip().lower() == plain
                ):
                    cat_dir = cand
                    break
        if not cat_dir.exists():
            print(f"! Sin carpeta: {folder}")
            continue
        cat_items = []
        image_files = [
            p
            for p in cat_dir.rglob("*")
            if p.is_file()
            and (
                p.suffix.lower() in {".jpg", ".jpeg", ".heic", ".heif", ".png", ".webp"}
                or p.suffix == ""
            )
        ]
        for src in sorted(image_files):
            rel_dir = src.parent.relative_to(cat_dir)
            parts = [] if str(rel_dir) == "." else list(rel_dir.parts)
            leaf = parts[-1] if parts else folder
            line_label = LINE_LABELS.get(leaf, re.sub(r"\s*\(.*?\)\s*", "", leaf).strip())
            price, price_note = parse_price(leaf)
            cat_items.append(
                {
                    "src": src,
                    "line": line_label if parts else "",
                    "price": price,
                    "price_note": price_note,
                    "stem": src.stem,
                }
            )

        # numerar por línea para referencias estables
        counters: dict[str, int] = {}
        used_rels: set[str] = set()
        codes = line_code_map([it["line"] for it in cat_items])
        for it in sorted(cat_items, key=lambda x: (x["line"], x["stem"])):
            line = it["line"]
            # el precio de la línea no forma parte del nombre de la pieza
            name_line = "Promo" if line == "Promo 1x8 · 2x15" else re.sub(
                r"\s*\d+\s*\$", "", line
            ).strip()
            key = name_line or "base"
            counters[key] = counters.get(key, 0) + 1
            n = counters[key]
            name = f"{singular} {name_line} {n:02d}" if name_line else f"{singular} {n:02d}"
            name = re.sub(r"\s+", " ", name).strip()
            ref = (
                f"{prefix}-{codes[line]}-{n:02d}"
                if line
                else f"{prefix}-{n:02d}"
            )
            rel = f"{cslug}/{slugify(line + '-' if line else '')}{slugify(it['stem'])}"
            if rel in used_rels:
                rel = f"{rel}-{n:02d}"
            used_rels.add(rel)
            job = {"src": str(it["src"]), "rel": rel}
            job["meta"] = {
                "ref": ref,
                "name": name,
                "category": cslug,
                "categoryLabel": clabel,
                "line": line,
                "price": it["price"],
                "priceNote": it["price_note"],
                "img": f"assets/img/catalog/{rel}.webp",
                "thumb": f"assets/img/catalog/thumbs/{rel}.webp",
                "order": order,
            }
            jobs.append(job)
            stats["found"] += 1

    # procesar en paralelo
    results: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_image, j): j for j in jobs}
        for i, fut in enumerate(as_completed(futures), 1):
            job = futures[fut]
            res = fut.result()
            if not res or not res.get("ok"):
                stats["missing"] += 1
                print(f"! {res.get('error') if res else 'sin resultado'}")
                continue
            key = job["meta"]["img"]
            results[key] = res
            if i % 25 == 0 or i == len(jobs):
                print(f"  imágenes {i}/{len(jobs)}", flush=True)

    for job in jobs:
        meta = job["meta"]
        res = results.get(meta["img"])
        if not res:
            continue
        meta["w"] = res["w"]
        meta["h"] = res["h"]
        meta["alt"] = (
            f"{meta['name']} — {meta['categoryLabel']} de Cotton Store"
        )
        items.append(meta)

    # orden final: categoría, línea, nombre
    items.sort(key=lambda m: (m["order"], m["line"], m["name"]))

    # metadatos de categorías y líneas
    categories = []
    for folder, cslug, clabel, singular, prefix, order, blurb in CATEGORIES:
        cat_items = [m for m in items if m["category"] == cslug]
        if not cat_items:
            continue
        lines: dict[str, dict] = {}
        for m in cat_items:
            if not m["line"]:
                continue
            key = m["line"]
            if key not in lines:
                lines[key] = {
                    "label": key,
                    "count": 0,
                    "price": m["price"],
                    "priceNote": m["priceNote"],
                }
            lines[key]["count"] += 1
        categories.append(
            {
                "slug": cslug,
                "label": clabel,
                "singular": singular,
                "blurb": blurb,
                "count": len(cat_items),
                "cover": cat_items[0]["thumb"],
                "coverFull": cat_items[0]["img"],
                "lines": sorted(lines.values(), key=lambda x: x["label"]),
            }
        )

    # hero: usar las rutas elegidas si existen; si no, portadas
    hero = []
    for hp in HERO_PATHS:
        p = SRC / hp
        if p.exists():
            rel = slugify(p.stem)
            res = process_image(
                {
                    "src": str(p),
                    "rel": rel,
                    "cat_out": IMG_OUT / "hero",
                    "thumb": False,
                }
            )
            if res and res.get("ok"):
                hero.append({"img": f"assets/img/hero/{rel}.webp"})
    if not hero:
        hero = [{"img": c["coverFull"]} for c in categories[:3]]

    # portadas de categoría (copia optimizada)
    for c in categories:
        src_thumb = BASE / c["cover"]
        if src_thumb.exists():
            dest = IMG_OUT / "categories" / f"{c['slug']}.webp"
            shutil.copyfile(src_thumb, dest)
            c["cover"] = f"assets/img/categories/{c['slug']}.webp"

    catalog = {
        "generated": date.today().isoformat(),
        "store": {
            "name": "Cotton Store",
            "tagline": "Ropa urbana",
            "city": "San Felipe, Yaracuy",
            "whatsapp": "584120522641",
            "whatsappDisplay": "+58 412-0522641",
            "email": "Cottonstore75@gmail.com",
            "instagram": "https://www.instagram.com/cottonstore.ven/",
            "facebook": "https://www.facebook.com/people/Cotton-Store/100085036136711/",
            "tiktok": "https://www.tiktok.com/@cottonstore.ven",
            "address": "87M5+WR5, Avenida 5 Libertador, San Felipe 3201, Yaracuy, Venezuela",
            "maps": "https://maps.google.com/?q=87M5%2BWR5+Avenida+5+Libertador+San+Felipe+Yaracuy+Venezuela",
        },
        "total": len(items),
        "hero": hero,
        "categories": categories,
        "items": items,
    }
    (DATA_OUT / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    build_logo()
    build_og()

    print(f"OK  {len(items)} productos  |  {len(categories)} categorías")
    print(f"    faltantes/errores: {stats['missing']}")
    print(f"    JSON: {(DATA_OUT / 'catalog.json').stat().st_size / 1024:.0f} KB")
    return 0 if items else 1


if __name__ == "__main__":
    raise SystemExit(main())
