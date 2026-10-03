#!/usr/bin/env python3
"""
Симулятор экономики «Цветочного квартала».

Зачем: числа в документе выглядят правдоподобно, но проверить их можно только
прогоном. Симулятор воспроизводит реальную петлю — клик по генератору стоит
энергии, предметы ложатся на поле, мердж 5→2 и 3→1, заказы требуют предметы
конкретных уровней, монеты уходят в апгрейды — и отвечает на вопросы:

  * сколько заказов игрок закрывает за сессию и не упирается ли в стену;
  * сколько реально длится сессия (целевые 10-15 минут из концепта);
  * забивается ли поле так, что ходов не остаётся (главный убийца мердж-игр);
  * хватает ли дохода на апгрейды и не растёт ли цена быстрее дохода.

Использование:
  .venv/bin/python tools/simulate.py --days 7 --sessions 4 --seed 1
  .venv/bin/python tools/simulate.py --days 30 --quiet
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BALANCE = ROOT / "data" / "balance.json"


# ---------------------------------------------------------------- поле и мердж

class Board:
    """Поле: сколько клеток занято и сколько предметов каждого вида лежит."""

    def __init__(self, cells: int):
        self.cells = cells
        self.items: dict[tuple[str, int], int] = defaultdict(int)

    def used(self) -> int:
        return sum(self.items.values())

    def free(self) -> int:
        return self.cells - self.used()

    def add(self, chain: str, level: int) -> bool:
        if self.free() <= 0:
            return False
        self.items[(chain, level)] += 1
        return True

    def count(self, chain: str, level: int) -> int:
        return self.items.get((chain, level), 0)

    def take(self, chain: str, level: int, n: int = 1) -> bool:
        key = (chain, level)
        if self.items.get(key, 0) < n:
            return False
        self.items[key] -= n
        if self.items[key] == 0:
            del self.items[key]
        return True

    def total(self) -> int:
        return self.used()


def merge_pass(board: Board, needed: dict[tuple[str, int], int], max_level: int,
               rules: list[dict], force: bool = False) -> int:
    """Один проход мерджа по возрастанию уровня.

    Предметы, которые нужны текущим заказам, не трогаем: иначе жадный мердж
    съест то, что игрок копил под заказ, и это не поведение живого игрока.

    force=True — аварийная уборка, когда поле под завязку: броня снимается,
    потому что забитое поле хуже, чем потеря брони.
    """
    merges = 0
    for level in range(1, max_level):
        for chain in {c for c, _ in board.items}:
            key = (chain, level)
            count = board.count(chain, level)
            if count == 0:
                continue
            available = count if force else count - needed.get(key, 0)
            for rule in rules:  # сначала 5→2, потом 3→1
                while available >= rule["input"]:
                    board.items[key] -= rule["input"]
                    board.items[(chain, level + 1)] = board.count(chain, level + 1) + rule["output"]
                    merges += 1
                    available -= rule["input"]
            if board.items.get(key, 0) <= 0:
                board.items.pop(key, None)
    return merges


# ------------------------------------------------------------------- заказы

def weighted_choice(weights: dict, rng: random.Random):
    items = list(weights.items())
    total = sum(w for _, w in items)
    r = rng.random() * total
    acc = 0.0
    for key, w in items:
        acc += w
        if r <= acc:
            return key
    return items[-1][0]


def make_order(chains: list[str], cfg_orders: dict, rng: random.Random) -> list[tuple[str, int]]:
    size = int(weighted_choice(cfg_orders["item_count_weights"], rng))
    items: list[tuple[str, int]] = []
    for _ in range(size):
        chain = rng.choice(chains)
        level = int(weighted_choice(cfg_orders["level_weights"], rng))
        items.append((chain, level))
    return items


def order_clicks(items: list[tuple[str, int]], click_cost: list[int]) -> int:
    return sum(click_cost[level - 1] for _, level in items)


def needed_from_orders(orders: list, fulfilled_idx: int | None = None) -> dict[tuple[str, int], int]:
    need: dict[tuple[str, int], int] = defaultdict(int)
    for i, order in enumerate(orders):
        if i == fulfilled_idx:
            continue
        for key in order:
            need[key] += 1
    return need


def can_fulfil(board: Board, order: list[tuple[str, int]]) -> bool:
    want: dict[tuple[str, int], int] = defaultdict(int)
    for key in order:
        want[key] += 1
    return all(board.count(c, l) >= n for (c, l), n in want.items())


# ------------------------------------------------------------------ апгрейды

def upgrade_cost(up: dict, level: int) -> float:
    return up["base_cost"] * (up["cost_growth"] ** level)


def shop_effect(levels: dict[str, int], cfg: dict) -> dict:
    up = {u["id"]: u for u in cfg["upgrades"]}
    energy = cfg["energy"]
    cap = energy["cap_base"] + up["fridge"]["effect_params"]["cap_per_level"] * levels["fridge"]
    regen = energy["regen_seconds"] * (up["fridge"]["effect_params"]["regen_factor_per_level"] ** levels["fridge"])
    regen = max(energy["regen_min_seconds"], regen)
    cells = cfg["board"]["open_at_start"] + up["warehouse"]["effect_params"]["cells_per_level"] * levels["warehouse"]
    cells = min(cells, cfg["board"]["total_cells"])
    return {
        "cap": cap,
        "regen": regen,
        "cells": cells,
        "display": levels["display"] * up["display"]["effect_params"]["bonus_per_level"],
        "cash": (1 + up["cash"]["effect_params"]["multiplier_per_level"]) ** levels["cash"],
        "staff_time": min(0.3, levels["staff"] * up["staff"]["effect_params"]["time_bonus_per_level"]),
    }


def buy_upgrades(coins: float, levels: dict[str, int], cfg: dict) -> tuple[float, list[str]]:
    """Игрок покупает самый дешёвый доступный апгрейд, пока хватает монет."""
    bought = []
    changed = True
    while changed:
        changed = False
        options = []
        for up in cfg["upgrades"]:
            lvl = levels[up["id"]]
            if lvl >= up["max_level"]:
                continue
            cost = upgrade_cost(up, lvl)
            if cost <= coins:
                options.append((cost, up["id"]))
        if options:
            cost, uid = min(options)
            coins -= cost
            levels[uid] += 1
            bought.append(uid)
            changed = True
    return coins, bought


def chain_value(items: list[tuple[tuple[str, int], int]], click_cost: list[int]) -> dict[str, float]:
    """Ценность запасов/потребности в кликах по цепочкам.

    Считать «сколько предметов нужно» недостаточно: игрок вкладывает клики
    в одну цепочку и уходит в перепроизводство, а до остальных не доходит.
    Поэтому и потребность, и запас измеряем в кликах — тогда видно перекос.
    """
    out: dict[str, float] = defaultdict(float)
    for (chain, level), n in items:
        out[chain] += n * click_cost[level - 1]
    return out


def pick_chain(board: Board, need: dict, chains: list[str], click_cost: list[int],
               rng: random.Random) -> str:
    need_v = chain_value(list(need.items()), click_cost)
    have_v = chain_value(list(board.items.items()), click_cost)
    deficit = {c: need_v.get(c, 0) - have_v.get(c, 0) for c in chains}
    best = max(deficit.values())
    if best > 0:
        # берём цепочку с наибольшим недобором, среди равных — случайную,
        # чтобы не залипать в одну и ту же при одинаковом дефиците
        candidates = [c for c, v in deficit.items() if v == best]
        return rng.choice(candidates)
    # потребности закрыты по стоимости — копим запас в самой пустой цепочке,
    # чтобы разгрузить поле и подготовиться к следующим заказам
    return min(chains, key=lambda c: (have_v.get(c, 0), c))


# -------------------------------------------------------------------- сессия

def run_session(state: dict, cfg: dict, rng: random.Random, session_no: int) -> dict:
    eff = shop_effect(state["levels"], cfg)
    board = state["board"]
    board.cells = eff["cells"]
    energy = state["energy"]
    chains = state["chains"]
    timing = cfg["timing"]
    click_cost = cfg["items"]["click_cost_by_level"]
    orders_cfg = cfg["orders"]

    relief = cfg["board_relief"]
    clicks = merges = orders_done = sold = 0
    coins_earned = 0.0
    stuck = False
    board_peak = board.used()
    secs = 0.0

    # добор заказов до полного числа слотов
    while len(state["orders"]) < orders_cfg["slots"]:
        state["orders"].append(make_order(chains, orders_cfg, rng))

    guard = 0
    while energy >= cfg["energy"]["session_stop_threshold"] and guard < 5000:
        guard += 1

        # какую цепочку качать: где наибольший недобор по ценности в кликах
        need = needed_from_orders(state["orders"])
        target = pick_chain(board, need, chains, click_cost, rng)

        # клик по генератору
        if board.free() <= 0:
            stuck = True
            break
        level = 2 if rng.random() < eff["display"] else 1
        board.add(target, level)
        energy -= cfg["energy"]["click_cost"]
        clicks += 1
        secs += timing["seconds_per_click"]

        # мердж
        need = needed_from_orders(state["orders"])
        m = merge_pass(board, need, cfg["merge"]["max_level"], cfg["merge"]["rules"])
        merges += m
        secs += m * timing["seconds_per_merge"] * (1 - eff["staff_time"])

        # выполнить заказы, которые собрались
        for i, order in enumerate(list(state["orders"])):
            if can_fulfil(board, order):
                want: dict[tuple[str, int], int] = defaultdict(int)
                for key in order:
                    want[key] += 1
                for (c, l), n in want.items():
                    board.take(c, l, n)
                reward = (order_clicks(order, click_cost) * orders_cfg["coins_per_click"]
                          * eff["cash"] * state.get("building_mult", 1.0))
                coins_earned += reward
                orders_done += 1
                secs += timing["seconds_per_order"]
                state["orders"][i] = make_order(chains, orders_cfg, rng)

        board_peak = max(board_peak, board.used())

        # --- аварийные клапаны: поле под завязку ---
        fill = board.used() / board.cells
        if fill >= relief["emergency_merge_at"]:
            m = merge_pass(board, {}, cfg["merge"]["max_level"], cfg["merge"]["rules"], force=True)
            merges += m
            secs += m * timing["seconds_per_merge"] * (1 - eff["staff_time"])

        if fill >= relief["sell_at"] and board.free() <= 2:
            # продаём самое дешёвое, что не забронировано под заказы
            need2 = needed_from_orders(state["orders"])
            options = [(l, c) for (c, l), n in board.items.items() if n > need2.get((c, l), 0)]
            if options:
                level_sold, chain_sold = min(options)
                board.take(chain_sold, level_sold)
                coins_earned += click_cost[level_sold - 1] * relief["sell_value_per_click"]
                sold += 1

        if board.free() <= 0:
            stuck = True
            break

    state["energy"] = energy
    state["coins"] += coins_earned

    return {
        "session": session_no,
        "clicks": clicks,
        "merges": merges,
        "orders": orders_done,
        "coins": coins_earned,
        "minutes": secs / 60.0,
        "board_peak": board_peak,
        "cells": eff["cells"],
        "stuck": stuck,
        "sold": sold,
        "energy_left": energy,
    }


def run(days: int, sessions_per_day: int, seed: int, quiet: bool = False) -> dict:
    cfg = json.loads(BALANCE.read_text(encoding="utf-8"))
    rng = random.Random(seed)

    levels = {u["id"]: 0 for u in cfg["upgrades"]}
    eff0 = shop_effect(levels, cfg)

    state = {
        "energy": eff0["cap"],
        "coins": 0.0,
        "levels": levels,
        "board": Board(eff0["cells"]),
        "orders": [],
        "chains": [],
    }

    report = {
        "days": [],
        "sessions": [],
        "stuck_total": 0,
        "targets": cfg["targets"],
    }

    for day in range(1, days + 1):
        state["chains"] = [c["id"] for c in cfg["content_schedule"]["chains"]
                           if c["unlock_day"] <= day - 1 and c.get("role") == "order"]
        buildings = [b for b in cfg["content_schedule"].get("buildings", []) if b["unlock_day"] <= day - 1]
        mult = 1.0
        for b in buildings:
            mult *= b["income_multiplier"]
        state["building_mult"] = mult
        state["buildings"] = len(buildings)
        day_coins = 0.0
        active_coins = 0.0
        active_minutes = 0.0
        day_orders = 0
        day_sold = 0
        day_wasted = 0.0
        day_sessions = []
        for s in range(sessions_per_day):
            res = run_session(state, cfg, rng, s + 1)
            res["day"] = day
            report["sessions"].append(res)
            day_coins += res["coins"]
            active_coins += res["coins"]
            active_minutes += res["minutes"]
            day_orders += res["orders"]
            day_sold += res["sold"]
            day_sessions.append(res)
            if res["stuck"]:
                report["stuck_total"] += 1

            # перерыв между сессиями: энергия восстанавливается
            hours = 24 / sessions_per_day
            eff = shop_effect(state["levels"], cfg)
            gained = hours * 3600 / eff["regen"]
            state["energy"] = min(eff["cap"], state["energy"] + gained)
            day_wasted += max(0.0, state["energy"] + gained - eff["cap"])

            # прилавок: пассивный доход за время отсутствия.
            # Считаем от активного заработка, иначе прилавок кормит сам себя
            # и экономика уходит в гипер-инфляцию (проверено: 500k/день к месяцу).
            pas = cfg.get("passive")
            if pas and active_minutes > 0:
                rate = active_coins / active_minutes             # монет в минуту активной игры
                passive = rate * 60 * min(hours, pas["cap_hours"]) * pas["share_of_active"]
                day_coins += passive
                state["coins"] += passive

        # покупки в конце дня
        spent_before = state["coins"]
        state["coins"], bought = buy_upgrades(state["coins"], state["levels"], cfg)

        report["days"].append({
            "day": day,
            "orders": day_orders,
            "coins_earned": day_coins,
            "coins_left": state["coins"],
            "spent": spent_before - state["coins"],
            "upgrades": len(bought),
            "levels": dict(state["levels"]),
            "minutes_avg": statistics.mean(r["minutes"] for r in day_sessions),
            "orders_avg": statistics.mean(r["orders"] for r in day_sessions),
            "boards": [r["board_peak"] for r in day_sessions],
            "stuck": sum(1 for r in day_sessions if r["stuck"]),
            "sold": day_sold,
            "energy_wasted": day_wasted,
            "buildings": state.get("buildings", 0),
        })

    if not quiet:
        print_report(report, cfg)
    return report


def print_report(report: dict, cfg: dict) -> None:
    print("=" * 78)
    print("СИМУЛЯЦИЯ «ЦВЕТОЧНОГО КВАРТАЛА»")
    print("=" * 78)
    print(f"{'день':>4} {'заказы':>7} {'монет/д':>9} {'покупок':>8} {'зд':>3} "
          f"{'мин/сес':>8} {'зак/сес':>8} {'залипаний':>10}")
    for d in report["days"]:
        print(f"{d['day']:>4} {d['orders']:>7} {d['coins_earned']:>9.0f} {d['upgrades']:>8} "
              f"{d['buildings']:>3} {d['minutes_avg']:>8.1f} {d['orders_avg']:>8.1f} "
              f"{d['stuck']:>10}")

    sessions = report["sessions"]
    mins = [s["minutes"] for s in sessions]
    ords = [s["orders"] for s in sessions]
    t = report["targets"]

    print("\n" + "-" * 78)
    print(f"сессий: {len(sessions)}   заказов за сессию: среднее {statistics.mean(ords):.2f}, "
          f"медиана {statistics.median(ords):.1f}, худшая {min(ords)}")
    print(f"длительность сессии: среднее {statistics.mean(mins):.1f} мин, "
          f"медиана {statistics.median(mins):.1f}, макс {max(mins):.1f}")
    print(f"залипаний (поле забито, ходов нет): {report['stuck_total']}")

    # хвост распределения: сколько сессий игрок уходит почти ни с чем
    bad = sum(1 for o in ords if o <= 1)
    print(f"сессий с 0-1 заказом: {bad} из {len(ords)} ({bad/len(ords)*100:.0f}%)")
    hist = {}
    for o in ords:
        hist[o] = hist.get(o, 0) + 1
    print("распределение заказов за сессию: " +
          ", ".join(f"{k}->{v}" for k, v in sorted(hist.items())))

    print("\nПРОВЕРКИ:")
    checks = [
        ("заказов за сессию >= %.1f" % t["orders_per_session_min"], statistics.mean(ords) >= t["orders_per_session_min"]),
        ("заказов за сессию <= %.1f" % t["orders_per_session_max"], statistics.mean(ords) <= t["orders_per_session_max"]),
        ("длительность >= %.0f мин" % t["session_minutes_min"], statistics.mean(mins) >= t["session_minutes_min"]),
        ("длительность <= %.0f мин" % t["session_minutes_max"], statistics.mean(mins) <= t["session_minutes_max"]),
        ("залипаний не больше %d" % t["stuck_events_max"], report["stuck_total"] <= t["stuck_events_max"]),
    ]
    for name, ok in checks:
        print(f"  [{'ок' if ok else 'ПРОВАЛ'}] {name}")

    last_buy = max((d["day"] for d in report["days"] if d["upgrades"] > 0), default=0)
    total_levels = sum(report["days"][-1]["levels"].values())
    tree = cfg["meta"].get("tree_total_cost")
    print(f"последняя покупка: день {last_buy}; куплено уровней: {total_levels} "
          f"из {sum(u['max_level'] for u in cfg['upgrades'])}"
          + (f"; полное дерево стоит {tree:,.0f} монет" if tree else ""))

    first = report["days"][0]
    last = report["days"][-1]
    print(f"\nпрогресс: день 1 — {first['orders']} заказов, "
          f"{sum(first['levels'].values())} уровней апгрейдов; "
          f"день {last['day']} — {last['orders']} заказов, "
          f"{sum(last['levels'].values())} уровней, "
          f"{last['coins_earned']:.0f} монет за день")


def main() -> int:
    ap = argparse.ArgumentParser(description="Симулятор экономики")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--sessions", type=int, default=4)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()
    run(args.days, args.sessions, args.seed, args.quiet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
