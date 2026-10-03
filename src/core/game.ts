import { BALANCE, shopEffects, upgradeCost, type ShopEffects } from './balance';
import { Board, itemKey, mergeCluster, type Item } from './board';
import { canFulfil, coolDown, makeOrder, orderCost, type Order, type Rng } from './orders';
import { CHAINS, type ChainDef } from '../data/items.generated';

/**
 * Состояние игры и все действия игрока. Никакого DOM: этот модуль можно
 * прогонять в тестах и в headless-режиме, а рендер только читает состояние.
 */

export const SAVE_VERSION = 1;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_MS = 10 * 60 * 1000;

export interface SerializedGame {
  version: number;
  startedAt: number;
  lastSeen: number;
  energy: number;
  coins: number;
  levels: Record<string, number>;
  /** Поле: индекс клетки → предмет или null. */
  cells: (Item | null)[];
  orders: Order[];
  nextOrderId: number;
  stats: { clicks: number; merges: number; ordersDone: number; sold: number };
}

export interface GameEvent {
  type: 'merge' | 'order' | 'sell' | 'generate' | 'upgrade' | 'blocked' | 'stale';
  message: string;
}

function defaultRng(): Rng {
  return Math.random;
}

export class Game {
  board = new Board();
  energy = BALANCE.energy.cap_base;
  coins = 0;
  levels: Record<string, number> = {};
  orders: Order[] = [];
  startedAt = Date.now();
  lastSeen = Date.now();
  nextOrderId = 1;
  stats = { clicks: 0, merges: 0, ordersDone: 0, sold: 0 };
  events: GameEvent[] = [];

  private rng: Rng;

  constructor(rng: Rng = defaultRng()) {
    this.rng = rng;
    for (const upgrade of BALANCE.upgrades) this.levels[upgrade.id] = 0;
    this.applyShop();
  }

  // ---------------------------------------------------------------- магазин

  get effects(): ShopEffects {
    return shopEffects(this.levels);
  }

  applyShop(): void {
    const effects = this.effects;
    this.board.openCells = effects.openCells;
    this.energy = Math.min(this.energy, effects.energyCap);
  }

  upgradeLevel(id: string): number {
    return this.levels[id] ?? 0;
  }

  nextUpgradeCost(id: string): number | null {
    const def = BALANCE.upgrades.find((u) => u.id === id);
    if (!def) return null;
    const level = this.upgradeLevel(id);
    if (level >= def.max_level) return null;
    return upgradeCost(def, level);
  }

  buyUpgrade(id: string): boolean {
    const def = BALANCE.upgrades.find((u) => u.id === id);
    const cost = this.nextUpgradeCost(id);
    if (!def || cost === null || this.coins < cost) {
      this.events.push({ type: 'blocked', message: 'Не хватает монет' });
      return false;
    }
    this.coins -= cost;
    this.levels[id] = this.upgradeLevel(id) + 1;
    this.applyShop();
    this.events.push({ type: 'upgrade', message: `${def.name} — уровень ${this.levels[id]}` });
    return true;
  }

  // ------------------------------------------------------------ прогрессия

  /** Игровой день, начиная с 1 — от первого запуска, а не от календаря. */
  day(now = Date.now()): number {
    return Math.floor((now - this.startedAt) / DAY_MS) + 1;
  }

  /** Здания, открытые к текущему дню. Каждое даёт множитель дохода. */
  buildings(now = Date.now()): { id: string; multiplier: number; chainId: string | null }[] {
    const day = this.day(now);
    return (BALANCE.content_schedule as unknown as { buildings?: any[] }).buildings
      ?.filter((b) => b.unlock_day <= day)
      .map((b) => ({ id: b.id, multiplier: b.income_multiplier, chainId: b.unlocks_chain ?? null })) ?? [];
  }

  unlockedChains(now = Date.now()): ChainDef[] {
    const day = this.day(now);
    const built = new Set(this.buildings(now).map((b) => b.chainId).filter(Boolean));
    return CHAINS.filter((chain) => {
      const rule = BALANCE.content_schedule.chains.find((c) => c.id === chain.id);
      if (!rule) return false;
      // Цепочка открывается по дню прогресса либо сразу, если построено
      // здание, которое её открывает.
      return day >= rule.unlock_day || built.has(chain.id);
    });
  }

  unlockedChainIds(now = Date.now()): string[] {
    return this.unlockedChains(now).map((c) => c.id);
  }

  incomeMultiplier(now = Date.now()): number {
    const buildings = this.buildings(now).reduce((mult, b) => mult * b.multiplier, 1);
    return this.effects.cashMultiplier * buildings;
  }

  // --------------------------------------------------------------- энергия

  regenPerMs(): number {
    return 1 / (this.effects.regenSeconds * 1000);
  }

  /** Начисляет энергию за прошедшее время. Вызывать регулярно. */
  tick(now = Date.now()): void {
    const elapsed = Math.max(0, now - this.lastSeen);
    this.lastSeen = now;
    const cap = this.effects.energyCap;
    if (this.energy < cap) {
      this.energy = Math.min(cap, this.energy + elapsed * this.regenPerMs());
    }

    // остывание заказов: время вышло — не сгорают, а ждут с урезанной наградой
    const ctx = this.orderContext(now);
    for (let i = 0; i < this.orders.length; i += 1) {
      const order = this.orders[i];
      if (now > order.deadline) {
        this.orders[i] = coolDown(order, now, ctx);
        this.events.push({ type: 'stale', message: 'Заказ остыл — награда уменьшилась' });
      }
    }
    this.refillOrders(now);
  }

  private orderContext(now: number) {
    return {
      clickCost: (level: number) => BALANCE.items.click_cost_by_level[Math.min(level - 1, BALANCE.items.click_cost_by_level.length - 1)],
      incomeMultiplier: this.incomeMultiplier(now),
      lifetimeMs: 4 * 60 * 60 * 1000,
    };
  }

  refillOrders(now = Date.now()): void {
    const ctx = this.orderContext(now);
    while (this.orders.length < BALANCE.orders.slots) {
      this.orders.push(makeOrder(this.nextOrderId++, this.unlockedChainIds(now), now, this.rng, ctx));
    }
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(this.effects.energyCap, this.energy + amount);
  }

  // ------------------------------------------------------------ генераторы

  /** Стоимость одного клика по генератору. */
  get clickCost(): number {
    return BALANCE.energy.click_cost;
  }

  /**
   * Клик по генератору: тратит энергию и кладёт предмет на поле.
   * Энергия тратится только на добычу — слияние бесплатно, иначе игрок
   * начнёт бояться соединять, а соединение и есть удовольствие.
   */
  generate(chainId: string): { ok: boolean; index: number; item?: Item } {
    if (this.energy < this.clickCost) {
      this.events.push({ type: 'blocked', message: 'Кончилась энергия' });
      return { ok: false, index: -1 };
    }
    const item: Item = { chainId, level: 1 };
    const index = this.board.place(item);
    if (index < 0) {
      this.events.push({ type: 'blocked', message: 'На поле нет места' });
      return { ok: false, index: -1 };
    }

    this.energy -= this.clickCost;
    this.stats.clicks += 1;

    // Витрина даёт шанс сразу получить предмет уровнем выше
    if (this.rng() < this.effects.displayBonus) {
      this.board.cells[index].item = { chainId, level: 2 };
    }

    const placed = this.board.at(index) as Item;
    this.events.push({ type: 'generate', message: `+${placed.level}` });
    return { ok: true, index, item: placed };
  }

  // --------------------------------------------------------------- слияние

  mergeAt(index: number): boolean {
    const result = mergeCluster(this.board, index);
    if (!result.merged) return false;
    this.stats.merges += 1;
    this.events.push({ type: 'merge', message: `Уровень ${result.level}` });
    return true;
  }

  // ----------------------------------------------------------------- заказ

  orderAvailable(order: Order): boolean {
    return canFulfil(order, (chainId, level) => this.board.countOf(chainId, level));
  }

  fulfilOrder(orderId: number): boolean {
    const index = this.orders.findIndex((o) => o.id === orderId);
    if (index < 0) return false;
    const order = this.orders[index];
    if (!this.orderAvailable(order)) {
      this.events.push({ type: 'blocked', message: 'Не хватает предметов' });
      return false;
    }

    for (const { chainId, level, count } of orderCost(order).values()) {
      let left = count;
      for (let i = 0; i < this.board.cells.length && left > 0; i += 1) {
        const item = this.board.at(i);
        if (item && item.chainId === chainId && item.level === level) {
          this.board.removeAt(i);
          left -= 1;
        }
      }
    }

    this.coins += order.rewardCoins;
    this.stats.ordersDone += 1;
    this.orders.splice(index, 1);
    this.refillOrders();
    this.events.push({ type: 'order', message: `Заказ выполнен: +${order.rewardCoins}` });
    return true;
  }

  refreshOrders(): boolean {
    const cost = 50;
    if (this.coins < cost) {
      this.events.push({ type: 'blocked', message: 'Обновление стоит 50 монет' });
      return false;
    }
    this.coins -= cost;
    this.orders = [];
    this.refillOrders();
    return true;
  }

  // ---------------------------------------------------------------- продажа

  /**
   * Продажа предмета — аварийный клапан, когда поле забито.
   * Возвращает 35% стоимости в кликах: это выпуск пара, а не способ заработка.
   */
  sellValue(level: number): number {
    const clicks = BALANCE.items.click_cost_by_level[Math.min(level - 1, BALANCE.items.click_cost_by_level.length - 1)];
    return Math.max(1, Math.round(clicks * BALANCE.board_relief.sell_value_per_click * this.effects.cashMultiplier));
  }

  sellAt(index: number): boolean {
    const item = this.board.at(index);
    if (!item) return false;
    this.board.removeAt(index);
    this.coins += this.sellValue(item.level);
    this.stats.sold += 1;
    this.events.push({ type: 'sell', message: `Продано за ${this.sellValue(item.level)}` });
    return true;
  }

  /** Поле почти забито: пора показать игроку подсказку про продажу. */
  get needsRelief(): boolean {
    return this.board.fillRatio() >= BALANCE.board_relief.emergency_merge_at;
  }

  // ------------------------------------------------------------- сохранение

  serialize(now = Date.now()): SerializedGame {
    return {
      version: SAVE_VERSION,
      startedAt: this.startedAt,
      lastSeen: now,
      energy: this.energy,
      coins: this.coins,
      levels: { ...this.levels },
      cells: this.board.cells.slice(0, BALANCE.board.total_cells).map((c) => c.item),
      orders: this.orders,
      nextOrderId: this.nextOrderId,
      stats: { ...this.stats },
    };
  }

  restore(save: SerializedGame, now = Date.now()): void {
    this.startedAt = save.startedAt ?? now;
    this.lastSeen = save.lastSeen ?? now;
    this.energy = save.energy ?? BALANCE.energy.cap_base;
    this.coins = save.coins ?? 0;
    this.levels = { ...save.levels };
    this.orders = save.orders ?? [];
    this.nextOrderId = save.nextOrderId ?? 1;
    this.stats = save.stats ?? { clicks: 0, merges: 0, ordersDone: 0, sold: 0 };
    this.applyShop();
    this.board.clear();
    const cells = save.cells ?? [];
    for (let i = 0; i < cells.length && i < this.board.cells.length; i += 1) {
      const item = cells[i];
      if (item && item.chainId && item.level) this.board.cells[i].item = { ...item };
    }
  }

  /** Подсчёт предметов на поле по ключу «цепочка:уровень» — для подсказок UI. */
  inventory(): Map<string, number> {
    const out = new Map<string, number>();
    for (const { item } of this.board.entries()) {
      const key = itemKey(item);
      out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
  }
}
