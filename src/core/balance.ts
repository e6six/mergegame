import balanceJson from '../../data/balance.json';

/**
 * Числа баланса. Источник — data/balance.json, тот же файл читает симулятор
 * (tools/simulate.py). Одна таблица на игру и на модель — иначе баланс
 * в документе и в коде разъедется.
 */
export interface UpgradeDef {
  id: string;
  name: string;
  base_cost: number;
  cost_growth: number;
  max_level: number;
  effect: string;
  effect_params: Record<string, number>;
}

export interface Balance {
  energy: {
    cap_base: number;
    regen_seconds: number;
    regen_min_seconds: number;
    click_cost: number;
    session_stop_threshold: number;
    rewarded_bonus: number;
  };
  board: { cols: number; rows: number; total_cells: number; open_at_start: number };
  merge: { max_level: number; rules: { input: number; output: number }[] };
  items: { click_cost_by_level: number[] };
  generator: { display_bonus_per_level: number; display_levels: number };
  orders: {
    slots: number;
    item_count_weights: Record<string, number>;
    level_weights: Record<string, number>;
    coins_per_click: number;
  };
  board_relief: { emergency_merge_at: number; sell_at: number; sell_value_per_click: number };
  timing: Record<string, number>;
  upgrades: UpgradeDef[];
  content_schedule: { chains: { id: string; unlock_day: number; role?: string }[] };
  /** Декор квартала: покупается за репутацию, даёт бонусы к доходу. */
  decor: DecorDef[];
  /** Гербарий: бонус за новый вид и за полностью открытую цепочку. */
  herbarium: {
    bonus_per_new_species: number;
    bonus_per_chain_complete: number;
    bonus_max: number;
    [key: string]: unknown;
  };
  /** Репутация: сколько даёт один заказ. */
  reputation: {
    per_order_base: number;
    per_level_bonus: number;
    per_item_bonus: number;
    stale_penalty: number;
    [key: string]: unknown;
  };
}

export interface DecorDef {
  id: string;
  name: string;
  description: string;
  base_cost: number;
  cost_growth: number;
  max_level: number;
  /** Декор покупается за репутацию, а не за монеты. */
  cost_currency: 'reputation';
  effect: string;
  /** Прибавка за уровень: смысл зависит от вида декора (доход, энергия, редкость). */
  bonus_per_level: number;
}

export const BALANCE = balanceJson as unknown as Balance;

/** Стоимость следующего уровня апгрейда. */
export function upgradeCost(upgrade: UpgradeDef, level: number): number {
  return Math.round(upgrade.base_cost * upgrade.cost_growth ** level);
}

/** Эффекты магазина при заданных уровнях апгрейдов. */
export interface ShopEffects {
  energyCap: number;
  regenSeconds: number;
  openCells: number;
  displayBonus: number;
  cashMultiplier: number;
  staffTimeBonus: number;
}

export function shopEffects(levels: Record<string, number>): ShopEffects {
  const byId = new Map(BALANCE.upgrades.map((u) => [u.id, u]));
  const lv = (id: string) => levels[id] ?? 0;
  const p = (id: string, key: string) => byId.get(id)?.effect_params[key] ?? 0;

  const cap = BALANCE.energy.cap_base + p('fridge', 'cap_per_level') * lv('fridge');
  const regen = Math.max(
    BALANCE.energy.regen_min_seconds,
    BALANCE.energy.regen_seconds * p('fridge', 'regen_factor_per_level') ** lv('fridge'),
  );
  const cells = Math.min(
    BALANCE.board.total_cells,
    BALANCE.board.open_at_start + p('warehouse', 'cells_per_level') * lv('warehouse'),
  );

  return {
    energyCap: cap,
    regenSeconds: regen,
    openCells: cells,
    displayBonus: p('display', 'bonus_per_level') * lv('display'),
    cashMultiplier: (1 + p('cash', 'multiplier_per_level')) ** lv('cash'),
    staffTimeBonus: Math.min(0.3, p('staff', 'time_bonus_per_level') * lv('staff')),
  };
}
