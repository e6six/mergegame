#!/usr/bin/env python3
"""
Предпросмотр игровой доски в реальном размере.

Зачем: спрайты, которые выглядят отлично по отдельности, на сетке могут
сливаться друг с другом. Проверять надо пачкой, в масштабе, близком к игровому,
и именно на тех сочетаниях, что чаще всего встречаются на доске.

Скрипт рисует макет: HUD сверху, сетка клеток, спрайты в заданных позициях.

Использование:
  .venv/bin/python tools/mock-board.py --cols 6 --rows 7 --cell 76
  .venv/bin/python tools/mock-board.py --layout art/layouts/board-pack.json

Раскладка — JSON: {"place": [{"id": "pack-01", "col": 0, "row": 0}, ...]}
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "art" / "sprites"

CELL_BG_A = (220, 231, 214)   # светлая клетка
CELL_BG_B = (210, 224, 203)   # тёмная клетка
BOARD_BG = (200, 216, 194)
HUD_BG = (243, 234, 219)
INK = (59, 64, 70)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def render(layout: dict, cols: int, rows: int, cell: int, out: Path) -> Path:
    pad_board = 10
    hud_h = 92
    w = cols * cell + pad_board * 2
    h = rows * cell + pad_board * 2 + hud_h

    img = Image.new("RGB", (w, h), BOARD_BG)
    d = ImageDraw.Draw(img)

    # HUD
    d.rectangle([0, 0, w, hud_h - 6], fill=HUD_BG)
    f_title = load_font(26)
    f_small = load_font(19)
    d.text((pad_board + 4, 10), "Цветочный квартал", font=f_title, fill=INK)
    d.text((pad_board + 4, 46), "Заказы: 2 из 3 — нужны 3 розы и 2 ромашки", font=f_small, fill=INK)

    # «монеты» и «энергия» справа
    coin = SPRITES / "ui-coin.png"
    energy = SPRITES / "ui-energy.png"
    x = w - pad_board - 4
    for sprite, label in ((energy, "100"), (coin, "1 240")):
        text_w = d.textlength(label, font=f_small)
        x -= text_w
        d.text((x, 52), label, font=f_small, fill=INK)
        x -= 30
        if sprite.exists():
            ic = Image.open(sprite).convert("RGBA").resize((26, 26), Image.LANCZOS)
            img.paste(ic, (int(x), 50), ic)
        x -= 16

    # сетка
    for row in range(rows):
        for col in range(cols):
            x0 = pad_board + col * cell
            y0 = hud_h + pad_board + row * cell
            color = CELL_BG_A if (row + col) % 2 == 0 else CELL_BG_B
            d.rectangle([x0 + 1, y0 + 1, x0 + cell - 2, y0 + cell - 2], fill=color)

    # предметы
    placed = []
    for item in layout.get("place", []):
        path = SPRITES / f"{item['id']}.png"
        if not path.exists():
            d.text((pad_board + item["col"] * cell, hud_h + pad_board + item["row"] * cell), "?", font=f_title, fill=(200, 60, 60))
            continue
        sprite = Image.open(path).convert("RGBA")
        sprite = sprite.resize((cell - 6, cell - 6), Image.LANCZOS)
        x0 = pad_board + item["col"] * cell + 3
        y0 = hud_h + pad_board + item["row"] * cell + 3
        img.paste(sprite, (x0, y0), sprite)
        placed.append(item["id"])

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print(f"макет: {out}  {img.size[0]}x{img.size[1]}, предметов {len(placed)}")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Предпросмотр игровой доски")
    ap.add_argument("--layout", type=Path, help="JSON с раскладкой")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--rows", type=int, default=7)
    ap.add_argument("--cell", type=int, default=76)
    ap.add_argument("--out", type=Path, default=ROOT / "art" / "style-test" / "mock-board.png")
    args = ap.parse_args()

    if args.layout:
        layout = json.loads(args.layout.read_text(encoding="utf-8"))
    else:
        layout = {"place": []}

    render(layout, args.cols, args.rows, args.cell, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
