#!/usr/bin/env python3
"""
Очередная партия генераций — по манифесту, без ручного списка.

Зачем: пакет собирается партиями по 10 (лимит генерации за ход), и ручной
список файлов легко ошибиться на единицу — 10-й предмет партии просто теряется.
Этот скрипт берёт манифест как единственный источник правды, находит ассеты,
у которых ещё нет спрайта, и печатает готовые промпты.

Использование:
  .venv/bin/python tools/next-batch.py              # следующие 10
  .venv/bin/python tools/next-batch.py --count 5    # следующие 5
  .venv/bin/python tools/next-batch.py --json       # машинный формат
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "art" / "manifest.json"
SPRITES = ROOT / "art" / "sprites"


def collect(manifest: dict) -> list[dict]:
    """Все ассеты манифеста по порядку: цепочки, генераторы, здания, UI."""
    suffix = manifest["style"]["promptSuffix"]
    out: list[dict] = []
    for chain in manifest.get("chains", []):
        for item in chain["items"]:
            out.append({"id": item["id"], "name": item["name"], "group": chain["id"], "subject": item["subject"]})
    for key in ("generators", "buildings", "ui"):
        for item in manifest.get(key, []):
            out.append({"id": item["id"], "name": item["name"], "group": key, "subject": item["subject"]})
    for item in out:
        item["prompt"] = suffix.replace("{SUBJECT}", item["subject"])
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Следующая партия генераций по манифесту")
    ap.add_argument("--count", type=int, default=10, help="сколько ассетов в партии")
    ap.add_argument("--json", action="store_true", help="вывести JSON вместо текста")
    args = ap.parse_args(argv[1:])

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = collect(manifest)

    done = {p.stem for p in SPRITES.glob("*.png")}
    todo = [a for a in assets if a["id"] not in done]
    batch = todo[: args.count]

    if args.json:
        print(json.dumps({"total": len(assets), "done": len(done & {a['id'] for a in assets}), "batch": batch}, ensure_ascii=False, indent=2))
        return 0

    print(f"всего в манифесте: {len(assets)}   готово спрайтов: {len(done & {a['id'] for a in assets})}   осталось: {len(todo)}")
    print(f"партия из {len(batch)}:\n")
    for a in batch:
        print(f"[{a['id']}] {a['name']}")
        print(f"    {a['prompt']}\n")
    if len(todo) > len(batch):
        rest = ", ".join(a["id"] for a in todo[len(batch):len(batch) + 6])
        print(f"дальше в очереди: {rest} ...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
