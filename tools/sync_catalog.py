#!/usr/bin/env python3
"""
Sincroniza el catálogo público de Google Drive a la carpeta local.

- Lista recursivamente la carpeta pública (embeddedfolderview).
- Descarga SOLO los archivos que faltan o están corruptos.
- Valida que cada descarga sea una imagen JPEG real.
- Es reanudable: se puede cortar y volver a ejecutar.

Uso:  python3 tools/sync_catalog.py [--list] [--workers 6]
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT_ID = "12xshpS-Mvfilz5_4W_6ltPLiGtzkDaI4"
BASE = Path(__file__).resolve().parent.parent
DEST = BASE / "Cotton Store Catalogo 2026🌐"
MANIFEST = BASE / "tools" / "drive_manifest.json"
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

session = requests.Session()
session.headers.update({"User-Agent": UA})

ENTRY_RE = re.compile(
    r'<div class="flip-entry" id="entry-(?P<id>[^"]+)".*?<a href="(?P<href>[^"]+)".*?'
    r'<div class="flip-entry-title">(?P<name>.*?)</div>',
    re.S,
)
lock = threading.Lock()
failed: list[dict] = []


def list_folder(fid: str) -> list[dict]:
    url = f"https://drive.google.com/embeddedfolderview?id={fid}#list"
    r = session.get(url, timeout=60)
    r.raise_for_status()
    out = []
    for m in ENTRY_RE.finditer(r.text):
        href = html.unescape(m.group("href"))
        name = html.unescape(re.sub(r"<[^>]+>", "", m.group("name"))).strip()
        out.append(
            {"id": m.group("id"), "name": name, "folder": "/folders/" in href}
        )
    return out


def walk(fid: str, path: str, acc: list[dict], depth: int = 0) -> None:
    entries = list_folder(fid)
    print(f"{'  ' * depth}[{path or '/'}] {len(entries)}", flush=True)
    for e in entries:
        p = f"{path}/{e['name']}" if path else e["name"]
        if e["folder"]:
            walk(e["id"], p, acc, depth + 1)
        else:
            acc.append({"id": e["id"], "name": e["name"], "path": p})


def is_valid_image(path: Path) -> bool:
    """Acepta JPEG, HEIC/HEIF, PNG y WebP (iPhone sube HEIC)."""
    try:
        if path.stat().st_size < 20_000:
            return False
        head = path.open("rb").read(32)
        if head[:3] == b"\xff\xd8\xff":  # JPEG
            return True
        if head[:4] == b"\x89PNG":  # PNG
            return True
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            return True
        if b"ftyp" in head:  # HEIC / HEIF / AVIF
            return True
        return False
    except OSError:
        return False


def download(item: dict) -> tuple[dict, str]:
    dest = DEST / item["path"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if is_valid_image(dest):
        return item, "skip"
    tmp = dest.with_suffix(dest.suffix + ".part")
    url = f"https://drive.google.com/uc?export=download&id={item['id']}"
    for attempt in range(4):
        try:
            with session.get(url, timeout=180, stream=True) as r:
                r.raise_for_status()
                ctype = r.headers.get("content-type", "")
                if "text/html" in ctype:
                    raise RuntimeError("respuesta HTML (posible límite de Drive)")
                with tmp.open("wb") as f:
                    for chunk in r.iter_content(1 << 16):
                        f.write(chunk)
            if not is_valid_image(tmp):
                raise RuntimeError("el archivo no es una imagen válida")
            os.replace(tmp, dest)
            return item, "ok"
        except Exception as exc:  # noqa: BLE001
            if attempt == 3:
                tmp.unlink(missing_ok=True)
                return item, f"fail: {exc}"
    return item, "fail"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()

    if MANIFEST.exists() and not args.list:
        acc = json.loads(MANIFEST.read_text(encoding="utf-8"))
        print(f"Manifiesto en caché: {len(acc)} archivos")
    else:
        acc = []
        walk(ROOT_ID, "", acc)
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(
            json.dumps(acc, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"TOTAL: {len(acc)}")

    if args.list:
        for a in acc:
            print(a["path"])
        print(f"TOTAL {len(acc)}")
        return 0

    pending = [a for a in acc if not is_valid_image(DEST / a["path"])]
    print(f"Faltan: {len(pending)} de {len(acc)}", flush=True)
    if not pending:
        return 0

    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download, a): a for a in pending}
        for fut in as_completed(futures):
            item, status = fut.result()
            with lock:
                done += 1
                if status.startswith("fail"):
                    failed.append({"path": item["path"], "error": status})
                print(f"[{done}/{len(pending)}] {status} {item['path']}", flush=True)

    if failed:
        (MANIFEST.parent / "failed.json").write_text(
            json.dumps(failed, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        print(f"Fallos: {len(failed)} (ver tools/failed.json)")
        return 1
    print("Catálogo completo ✔")
    return 0


if __name__ == "__main__":
    sys.exit(main())
