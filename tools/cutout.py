#!/usr/bin/env python3
"""
Вырезание предмета из AI-генерации.

Задача: убрать однотонный фон, но НЕ пробить дырки в самом предмете.
Наивное «сделать прозрачным всё, что похоже на фон» ломает светлые объекты
(фарфоровая ваза, кремовая бумага). Поэтому работаем через связные области:

  1. фон = пиксели, близкие к цвету рамки (L1-расстояние <= tol)
  2. внешний фон = компонента связности, которая касается края картинки
  3. остальные компоненты фона — это ЩЕЛИ внутри силуэта (например, просвет
     между стеблями). Мелкие из них тоже фон; крупные оставляем, потому что
     это может быть светлая часть самого предмета.

Использование:
  .venv/bin/python tools/cutout.py art/raw/rose-01.png art/sprites/rose-01.png
  .venv/bin/python tools/cutout.py art/raw/*.png --outdir art/sprites

Требуется: pillow, numpy (см. tools/requirements.txt)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None


def _flood(mask: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """Компонента связности внутри mask, содержащая любой из seed-пикселей."""
    h, w = mask.shape
    out = np.zeros((h, w), dtype=bool)
    stack = list(map(int, seeds))
    flat_mask = mask.ravel()
    flat_out = out.ravel()
    W = w
    while stack:
        i = stack.pop()
        if flat_out[i] or not flat_mask[i]:
            continue
        flat_out[i] = True
        x = i % W
        if x > 0:
            j = i - 1
            if flat_mask[j] and not flat_out[j]:
                stack.append(j)
        if x < W - 1:
            j = i + 1
            if flat_mask[j] and not flat_out[j]:
                stack.append(j)
        if i >= W:
            j = i - W
            if flat_mask[j] and not flat_out[j]:
                stack.append(j)
        if i < len(flat_mask) - W:
            j = i + W
            if flat_mask[j] and not flat_out[j]:
                stack.append(j)
    return out


def _border_seeds(mask: np.ndarray) -> np.ndarray:
    """Плоские индексы пикселей фона, лежащих на рамке картинки."""
    h, w = mask.shape
    return np.concatenate(
        [
            np.flatnonzero(mask[0]),                              # верхняя строка
            np.flatnonzero(mask[-1]) + (h - 1) * w,               # нижняя строка
            np.flatnonzero(mask[:, 0]) * w,                       # левый столбец
            np.flatnonzero(mask[:, -1]) * w + (w - 1),            # правый столбец
        ]
    ).astype(np.int64)


def cutout(
    src: Path,
    dst: Path,
    size: int = 256,
    tol: float = 30.0,
    gap_max_frac: float = 0.30,
    gap_tol: float = 14.0,
    erode: int = 1,
    feather: float = 0.7,
    pad_frac: float = 0.125,
    verbose: bool = True,
) -> dict:
    im = Image.open(src).convert("RGB")
    rgb = np.asarray(im, dtype=np.int16)

    # цвет фона = медиана рамки в 3 px (устойчиво к случайным пикселям)
    ring = np.concatenate(
        [
            rgb[0:3].reshape(-1, 3),
            rgb[-3:].reshape(-1, 3),
            rgb[:, 0:3].reshape(-1, 3),
            rgb[:, -3:].reshape(-1, 3),
        ]
    )
    bg = np.median(ring, axis=0)

    dist = np.abs(rgb - bg).sum(axis=2)
    near_bg = dist <= tol
    total = near_bg.size

    exterior = _flood(near_bg, _border_seeds(near_bg))

    # остатки — кандидаты в «щели» внутри силуэта
    rest = near_bg & ~exterior
    background = exterior.copy()
    gaps = 0
    gap_px = 0
    if rest.any():
        visited = np.zeros_like(rest)
        idxs = np.flatnonzero(rest)
        for start in idxs:
            if visited.flat[start]:
                continue
            comp = _flood(rest, np.array([start]))
            visited |= comp
            area = int(comp.sum())
            touches_border = (
                comp[0].any() or comp[-1].any() or comp[:, 0].any() or comp[:, -1].any()
            )
            if touches_border or area > total * gap_max_frac:
                continue
            # Запертый фон бывает крупным: кольцо вокруг венка, просвет в арке.
            # Поэтому решает не размер, а цвет: настоящий фон совпадает с фоном
            # рамки почти точно, а светлая часть предмета — нет.
            comp_rgb = rgb[comp]
            comp_med = np.median(comp_rgb, axis=0)
            if np.abs(comp_med - bg).sum() <= gap_tol:
                background |= comp
                gaps += 1
                gap_px += area

    alpha = Image.fromarray((~background).astype(np.uint8) * 255, mode="L")
    out = im.convert("RGBA")
    out.putalpha(alpha)

    bbox = out.getbbox()  # по непрозрачным пикселям
    if bbox:
        out = out.crop(bbox)

    inner = max(1, int(round(size * (1 - 2 * pad_frac))))
    w, h = out.size
    scale = min(inner / w, inner / h)
    out = out.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

    # Эрозия и растушёвка — ПОСЛЕ масштабирования, в пикселях итогового спрайта.
    # Иначе толщина съедаемой кромки зависела бы от разрешения исходника,
    # и спрайты из сырья разного размера получались бы с разным краем.
    final_alpha = out.getchannel("A")
    if erode > 0:
        final_alpha = final_alpha.filter(ImageFilter.MinFilter(3 if erode == 1 else 5))
    if feather > 0:
        final_alpha = final_alpha.filter(ImageFilter.GaussianBlur(feather))
    out.putalpha(final_alpha)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(out, ((size - out.width) // 2, (size - out.height) // 2), out)

    dst.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dst, optimize=True)

    stats = {
        "src": src.name,
        "dst": str(dst),
        "size": canvas.size,
        "bytes": dst.stat().st_size,
        "bg": [int(v) for v in bg],
        "transparent_pct": round(float((1 - np.asarray(canvas)[:, :, 3] / 255).mean()) * 100, 1),
        "gaps_filled": gaps,
        "gap_px": gap_px,
    }
    if verbose:
        print(
            f"{src.name:16s} -> {dst.name:16s} {stats['bytes']/1024:6.1f} КБ  "
            f"прозрачно {stats['transparent_pct']:5.1f}%  щелей убрано: {gaps} ({gap_px} px)"
        )
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(description="Вырезание предмета из AI-картинки")
    ap.add_argument("inputs", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path, help="выходной файл (только для одного входа)")
    ap.add_argument("--outdir", type=Path, default=Path("art/sprites"))
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--tol", type=float, default=30.0, help="L1-расстояние до цвета фона")
    ap.add_argument("--gap-max-frac", type=float, default=0.30, help="макс. площадь щели")
    ap.add_argument("--gap-tol", type=float, default=14.0, help="L1-расстояние до фона для щели внутри силуэта")
    ap.add_argument("--erode", type=int, default=1)
    ap.add_argument("--feather", type=float, default=0.7)
    ap.add_argument("-q", "--quiet", action="store_true")
    args = ap.parse_args()

    rc = 0
    for src in args.inputs:
        if not src.exists():
            print(f"нет файла: {src}", file=sys.stderr)
            rc = 1
            continue
        dst = args.out if (args.out and len(args.inputs) == 1) else args.outdir / src.name
        try:
            cutout(
                src,
                dst,
                size=args.size,
                tol=args.tol,
                gap_max_frac=args.gap_max_frac,
                gap_tol=args.gap_tol,
                erode=args.erode,
                feather=args.feather,
                verbose=not args.quiet,
            )
        except Exception as exc:  # noqa: BLE001
            print(f"ошибка на {src}: {exc}", file=sys.stderr)
            rc = 1
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
