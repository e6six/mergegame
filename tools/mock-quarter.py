#!/usr/bin/env python3
"""Собирает превью улицы квартала: фон + купленный декор на своих местах.

Зачем: координаты декора (src/ui/quarter.ts, DECOR_SLOTS) подбираются в долях
от фона, и проверить их «на глаз» без браузера нельзя. Этот скрипт рисует ту же
композицию тем же способом, что и canvas в игре, — значит размещение можно
посмотреть и поправить до запуска игры на живом экране.

Скрипт читает координаты прямо из src/ui/quarter.ts, чтобы превью и игра не
разъезжались.

Использование:
    tools/py tools/mock-quarter.py                      # все 11 предметов
    tools/py tools/mock-quarter.py --decor bench,cat    # только указанные
    tools/py tools/mock-quarter.py --out /tmp/q.png
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
QUARTER_TS = ROOT / "src" / "ui" / "quarter.ts"
BACKGROUND = ROOT / "art" / "backgrounds" / "stage-quarter.jpg"
SPRITES = ROOT / "art" / "sprites"
MANIFEST = ROOT / "art" / "manifest.json"


def parse_slots() -> dict[str, dict]:
    """Достаёт DECOR_SLOTS из TypeScript-файла: x, y, size, rotate."""
    source = QUARTER_TS.read_text(encoding="utf-8")
    body = source[source.index("const DECOR_SLOTS"): source.index("const DECOR_ICONS")]
    slots: dict[str, dict] = {}
    for match in re.finditer(
        r"(\w+):\s*\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*size:\s*([\d.]+)(?:,\s*rotate:\s*(-?[\d.]+))?\s*\}",
        body,
    ):
        slots[match.group(1)] = {
            "x": float(match.group(2)),
            "y": float(match.group(3)),
            "size": float(match.group(4)),
            "rotate": float(match.group(5) or 0),
        }
    return slots


def parse_icons() -> dict[str, str]:
    source = QUARTER_TS.read_text(encoding="utf-8")
    body = source[source.index("const DECOR_ICONS"):]
    body = body[: body.index("}")]
    return dict(re.findall(r"(\w+):\s*'([\w-]+)'", body))


def decor_names() -> dict[str, str]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {item["id"]: item["name"] for item in manifest.get("decor", [])}


def main() -> int:
    parser = argparse.ArgumentParser(description="Превью улицы квартала с декором")
    parser.add_argument("--decor", help="список id через запятую (по умолчанию все)")
    parser.add_argument("--out", default=str(ROOT / "screenshots" / "quarter-decor-preview.png"))
    args = parser.parse_args()

    slots = parse_slots()
    icons = parse_icons()
    names = decor_names()

    wanted = args.decor.split(",") if args.decor else list(slots.keys())
    unknown = [item for item in wanted if item not in slots]
    if unknown:
        print(f"нет координат для: {', '.join(unknown)}", file=sys.stderr)
        return 1

    canvas = Image.open(BACKGROUND).convert("RGBA")
    canvas = canvas.resize((1536, 1024), Image.LANCZOS)
    placed: list[str] = []

    for decor_id in wanted:
        slot = slots[decor_id]
        sprite_name = icons.get(decor_id)
        if not sprite_name:
            continue
        path = SPRITES / f"{sprite_name}.png"
        if not path.exists():
            print(f"нет спрайта: {path.name}", file=sys.stderr)
            continue

        sprite = Image.open(path).convert("RGBA")
        width = int(canvas.width * slot["size"])
        height = max(1, round(sprite.height * width / sprite.width))
        sprite = sprite.resize((width, height), Image.LANCZOS)
        if slot["rotate"]:
            # В игре canvas вращает вокруг точки привязки; здесь угол небольшой,
            # поэтому достаточно поворота вокруг центра с расширением холста.
            sprite = sprite.rotate(-slot["rotate"], resample=Image.BICUBIC, expand=True)

        x = round(slot["x"] * canvas.width - sprite.width / 2)
        y = round(slot["y"] * canvas.height - sprite.height)
        canvas.alpha_composite(sprite, (x, y))
        placed.append(decor_id)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, quality=92)
    print(f"готово: {out}")
    print(f"предметов на улице: {len(placed)} — {', '.join(names.get(i, i) for i in placed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
