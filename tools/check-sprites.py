#!/usr/bin/env python3
"""
Проверка спрайтов перед сборкой атласа.

Ловит типовые браки AI-пайплайна:
  - не тот размер (атлас ожидает квадрат)
  - непрозрачный фон в углах (вырезание не сработало)
  - предмет обрезан краем кадра (нужен больший отступ в промпте)
  - слишком прозрачный (пустой) или слишком плотный (фон не убран) спрайт

Использование:
  .venv/bin/python tools/check-sprites.py art/sprites/*.png
  .venv/bin/python tools/check-sprites.py            # все из art/sprites
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

import numpy as np
from PIL import Image

CORNER = 8          # размер уголка в пикселях для проверки фона
EDGE_ALPHA_MAX = 8  # допустимая альфа на самой кромке кадра
CORNER_ALPHA_MAX = 8
MIN_CONTENT = 0.05  # минимум непрозрачных пикселей
MAX_CONTENT = 0.92  # больше — похоже, фон не убран


def check(path: Path, size: int = 256) -> list[str]:
    problems: list[str] = []
    im = Image.open(path).convert("RGBA")
    if im.size != (size, size):
        problems.append(f"размер {im.size[0]}x{im.size[1]} вместо {size}x{size}")

    a = np.asarray(im)
    alpha = a[:, :, 3]

    corners = [
        alpha[:CORNER, :CORNER],
        alpha[:CORNER, -CORNER:],
        alpha[-CORNER:, :CORNER],
        alpha[-CORNER:, -CORNER:],
    ]
    cmax = max(int(c.max()) for c in corners)
    if cmax > CORNER_ALPHA_MAX:
        problems.append(f"непрозрачный фон в углу (alpha {cmax})")

    emax = max(
        int(alpha[0].max()), int(alpha[-1].max()),
        int(alpha[:, 0].max()), int(alpha[:, -1].max()),
    )
    if emax > EDGE_ALPHA_MAX:
        problems.append(f"предмет обрезан краем кадра (alpha {emax})")

    content = float((alpha > 128).mean())
    if content < MIN_CONTENT:
        problems.append(f"почти пустой ({content:.1%} содержимого)")
    elif content > MAX_CONTENT:
        problems.append(f"фон не убран ({content:.1%} содержимого)")

    return problems


def main(argv: list[str]) -> int:
    paths = [Path(p) for p in argv[1:]]
    if not paths:
        paths = [Path(p) for p in sorted(glob.glob("art/sprites/*.png"))]
    if not paths:
        print("нечего проверять: art/sprites пуст", file=sys.stderr)
        return 1

    bad = 0
    for p in paths:
        if not p.exists():
            print(f"НЕТ      {p}")
            bad += 1
            continue
        problems = check(p)
        if problems:
            bad += 1
            print(f"БРАК     {p.name}: " + "; ".join(problems))
        else:
            print(f"ок       {p.name}")
    print(f"\nвсего {len(paths)}, проблемных {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
