#!/usr/bin/env python3
"""
Уменьшение сырья AI-генерации до рабочего разрешения.

Зачем: генератор отдаёт ~1264 px, а спрайт в игре — 256 px (то есть 2–3 крат
запаса хватает с головой). Полноразмерное сырьё весит ~1 МБ на картинку,
и пакет из сотни ассетов превращается в сотни мегабайт в репозитории.

Скрипт идемпотентен: файлы, уже уложившиеся в лимит, не трогает.

Использование:
  .venv/bin/python tools/shrink-raw.py                 # всё из art/raw
  .venv/bin/python tools/shrink-raw.py art/raw/rose-01.png --max 800
"""
from __future__ import annotations

import argparse
import glob
import sys
from pathlib import Path

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None


def shrink(path: Path, max_side: int = 800, quality_level: int = 9) -> tuple[int, int]:
    before = path.stat().st_size
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    # pngтекстуры без потерь, максимальное сжатие для однотонного фона
    im.save(path, optimize=True, compress_level=quality_level)
    return before, path.stat().st_size


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Уменьшение сырья до рабочего разрешения")
    ap.add_argument("inputs", nargs="*", type=Path)
    ap.add_argument("--max", type=int, default=800, help="максимальная сторона, px")
    args = ap.parse_args(argv[1:])

    paths = args.inputs or [Path(p) for p in sorted(glob.glob("art/raw/*.png"))]
    if not paths:
        print("нечего обрабатывать", file=sys.stderr)
        return 1

    saved_before = saved_after = 0
    for p in paths:
        if not p.exists():
            print(f"нет файла: {p}", file=sys.stderr)
            continue
        b, a = shrink(p, args.max)
        saved_before += b
        saved_after += a
        mark = " " if b == a else "↓"
        print(f"{mark} {p.name:16s} {b/1024:7.1f} КБ -> {a/1024:7.1f} КБ")
    if saved_before:
        print(
            f"\nитого: {saved_before/1024/1024:.1f} МБ -> {saved_after/1024/1024:.1f} МБ "
            f"(-{(1 - saved_after/saved_before)*100:.0f}%)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
