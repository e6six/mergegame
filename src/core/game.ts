import { BALANCE, shopEffects, upgradeCost, type ShopEffects } from './balance';
import { Board, itemKey, mergeCluster, type Item } from './board';
import { canFulfil, coolDown, makeOrder, orderCost, type Order, type Rng } from './orders';
import { CHAINS, type ChainDef } from '../data/items.generated';

/**
 * Состояние игры и все действия игрока. Никакого DOM: этот модуль можно
 * прогонять в тестах и в headless-режиме, а рендер только читает состояние.
 * Теперь с мета-слоем: репутация, гербарий, декор квартала.
 */

export const SAVE_VERSION = 3;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_MS = 10 * 60 * 1000;

export interface SerializedGame {
  version: number;
  startedAt: number;
  lastSeen: number;
  energy: number;
  coins: number;
  reputation: number;
  levels: Record<string, number>;
  decorLevels: Record<string, number>;
  herbarium: string[]; // массив ключей "chain:level"
  /** Поле: индекс клетки → предмет или null. */
  cells: (Item | null)[];
  orders: Order[];
  nextOrderId: number;
  stats: { clicks: number; merges: number; ordersDone: number; sold: number; reputationEarned: number; speciesDiscovered: number };
  tutorialCompleted?: boolean;
  tutorialStep?: number;
}

export interface GameEvent {
  type: 'merge' | 'order' | 'sell' | 'generate' | 'upgrade' | 'blocked' | 'stale' | 'herbarium' | 'reputation' | 'decor';
  message: string;
}

function defaultRng(): Rng {
  return Math.random;
}

export class Game {
  board = new Board();
  energy = BALANCE.energy.cap_base;
  coins = 0;
  reputation = 0;
  levels: Record<string, number> = {};
  decorLevels: Record<string, number> = {};
  herbarium = new Set<string>();
  orders: Order[] = [];
  startedAt = Date.now();
  lastSeen = Date.now();
  nextOrderId = 1;
  stats = { clicks: 0, merges: 0, ordersDone: 0, sold: 0, reputationEarned: 0, speciesDiscovered: 0 };
  events: GameEvent[] = [];
  tutorialCompleted = false;
  tutorialStep = 0;

  private rng: Rng;

  constructor(rng: Rng = defaultRng()) {
    this.rng = rng;
    for (const upgrade of BALANCE.upgrades) this.levels[upgrade.id] = 0;
    const decor = BALANCE.decor;
    if (decor) {
      for (const d of decor) this.decorLevels[d.id] = 0;
    }
    this.applyShop();
  }

  // ---------------------------------------------------------------- магазин

  get effects(): ShopEffects {
    return shopEffects(this.levels);
  }

  get decorEffects(): { incomeBonus: number; energyBonus: number; rareBonus: number; repBonus: number; passiveBonus: number } {
    const decorCfg = BALANCE.decor;
    if (!decorCfg) return { incomeBonus: 0, energyBonus: 0, rareBonus: 0, repBonus: 0, passiveBonus: 0 };
    let income = 0;
    let energy = 0;
    let rare = 0;
    let rep = 0;
    let passive = 0;
    for (const d of decorCfg) {
      const lvl = this.decorLevels[d.id] ?? 0;
      if (lvl === 0) continue;
      const bonus = d.bonus_per_level * lvl;
      switch (d.id) {
        case 'bench':
          income += bonus;
          break;
        case 'lantern':
          energy += bonus;
          break;
        case 'flowerbed':
          rare += bonus;
          break;
        case 'sign':
          rep += bonus;
          break;
        case 'fountain':
          passive += bonus;
          break;
      }
    }
    return { incomeBonus: income, energyBonus: energy, rareBonus: rare, repBonus: rep, passiveBonus: passive };
  }

  get herbariumBonus(): number {
    const herbCfg = BALANCE.herbarium;
    if (!herbCfg) return 0;
    const species = this.herbarium.size;
    const chainCompleteBonus = this.completedChainsCount() * herbCfg.bonus_per_chain_complete;
    const speciesBonus = species * herbCfg.bonus_per_new_species;
    return Math.min(herbCfg.bonus_max, speciesBonus + chainCompleteBonus);
  }

  completedChainsCount(): number {
    const counts = new Map<string, Set<number>>();
    for (const key of this.herbarium) {
      const [chain, lvlStr] = key.split(':');
      const lvl = parseInt(lvlStr, 10);
      if (!counts.has(chain)) counts.set(chain, new Set());
      counts.get(chain)!.add(lvl);
    }
    let completed = 0;
    for (const [chainId, levels] of counts) {
      const chainDef = CHAINS.find((c) => c.id === chainId);
      if (chainDef && levels.size >= 10) completed += 1;
    }
    return completed;
  }

  applyShop(): void {
    const effects = this.effects;
    this.board.openCells = effects.openCells;
    this.energy = Math.min(this.energy, this.effectiveEnergyCap());
  }

  effectiveEnergyCap(): number {
    return this.effects.energyCap + this.decorEffects.energyBonus;
  }

  effectiveDisplayBonus(): number {
    return this.effects.displayBonus + this.decorEffects.rareBonus;
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

  // ------------------------------------------------------------ декор
  decorLevel(id: string): number {
    return this.decorLevels[id] ?? 0;
  }

  nextDecorCost(id: string): number | null {
    const decorCfg = BALANCE.decor;
    if (!decorCfg) return null;
    const def = decorCfg.find((d) => d.id === id);
    if (!def) return null;
    const level = this.decorLevel(id);
    if (level >= def.max_level) return null;
    return Math.round(def.base_cost * Math.pow(def.cost_growth, level));
  }

  buyDecor(id: string): boolean {
    const decorCfg = BALANCE.decor;
    if (!decorCfg) return false;
    const def = decorCfg.find((d) => d.id === id);
    const cost = this.nextDecorCost(id);
    if (!def || cost === null || this.reputation < cost) {
      this.events.push({ type: 'blocked', message: 'Не хватает репутации' });
      return false;
    }
    this.reputation -= cost;
    this.decorLevels[id] = this.decorLevel(id) + 1;
    this.applyShop();
    this.events.push({ type: 'decor', message: `${def.name} — уровень ${this.decorLevels[id]}` });
    return true;
  }

  // ------------------------------------------------------------ гербарий
  discoverSpecies(item: Item): boolean {
    const key = itemKey(item);
    if (this.herbarium.has(key)) return false;
    this.herbarium.add(key);
    this.stats.speciesDiscovered += 1;
    // получаем имя для сообщения
    const itemName = `${item.chainId} ур.${item.level}`;
    this.events.push({ type: 'herbarium', message: `Новый вид в гербарии: ${itemName}` });

    // бонус за закрытие цепочки
    const chainItems = Array.from(this.herbarium).filter((k) => k.startsWith(item.chainId + ':')).length;
    if (chainItems === 10) {
      this.events.push({ type: 'herbarium', message: `Цепочка «${item.chainId}» закрыта! +3% к доходу` });
    }

    return true;
  }

  herbariumProgress(): { total: number; discovered: number; byChain: Record<string, { discovered: number; total: number }> } {
    const total = CHAINS.length * 10;
    const discovered = this.herbarium.size;
    const byChain: Record<string, { discovered: number; total: number }> = {};
    for (const chain of CHAINS) {
      const count = Array.from(this.herbarium).filter((k) => k.startsWith(chain.id + ':')).length;
      byChain[chain.id] = { discovered: count, total: 10 };
    }
    return { total, discovered, byChain };
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
      return day >= rule.unlock_day || built.has(chain.id);
    });
  }

  unlockedChainIds(now = Date.now()): string[] {
    return this.unlockedChains(now).map((c) => c.id);
  }

  incomeMultiplier(now = Date.now()): number {
    const buildings = this.buildings(now).reduce((mult, b) => mult * b.multiplier, 1);
    const decor = 1 + this.decorEffects.incomeBonus;
    const herb = 1 + this.herbariumBonus;
    return this.effects.cashMultiplier * buildings * decor * herb;
  }

  // --------------------------------------------------------------- энергия

  regenPerMs(): number {
    return 1 / (this.effects.regenSeconds * 1000);
  }

  /** Начисляет энергию за прошедшее время. Вызывать регулярно. */
  tick(now = Date.now()): void {
    const elapsed = Math.max(0, now - this.lastSeen);
    this.lastSeen = now;
    const cap = this.effectiveEnergyCap();
    if (this.energy < cap) {
      this.energy = Math.min(cap, this.energy + elapsed * this.regenPerMs());
    }

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
    this.energy = Math.min(this.effectiveEnergyCap(), this.energy + amount);
  }

  // ------------------------------------------------------------ генераторы

  get clickCost(): number {
    return BALANCE.energy.click_cost;
  }

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

    if (this.rng() < this.effectiveDisplayBonus()) {
      this.board.cells[index].item = { chainId, level: 2 };
    }

    const placed = this.board.at(index) as Item;
    this.discoverSpecies(placed);
    this.events.push({ type: 'generate', message: `+${placed.level}` });
    return { ok: true, index, item: placed };
  }

  // --------------------------------------------------------------- слияние

  mergeAt(index: number): boolean {
    const result = mergeCluster(this.board, index);
    if (!result.merged) return false;
    this.stats.merges += 1;
    const newItem = this.board.at(result.resultIndex);
    if (newItem) this.discoverSpecies(newItem);
    this.events.push({ type: 'merge', message: `Уровень ${result.level}` });
    return true;
  }

  // ----------------------------------------------------------------- заказ

  orderAvailable(order: Order): boolean {
    return canFulfil(order, (chainId, level) => this.board.countOf(chainId, level));
  }

  calcReputationReward(order: Order): number {
    const repCfg = BALANCE.reputation;
    if (!repCfg) return 1;
    let rep = repCfg.per_order_base;
    for (const need of order.needs) {
      rep += need.level * repCfg.per_level_bonus;
      rep += repCfg.per_item_bonus;
    }
    if (order.stale) rep *= repCfg.stale_penalty;
    rep *= 1 + this.decorEffects.repBonus;
    return Math.max(1, Math.round(rep));
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
    const rep = this.calcReputationReward(order);
    this.reputation += rep;
    this.stats.ordersDone += 1;
    this.stats.reputationEarned += rep;
    this.orders.splice(index, 1);
    this.refillOrders();
    this.events.push({ type: 'order', message: `Заказ выполнен: +${order.rewardCoins} монет, +${rep} репутации` });
    this.events.push({ type: 'reputation', message: `+${rep} репутации` });
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
      reputation: this.reputation,
      levels: { ...this.levels },
      decorLevels: { ...this.decorLevels },
      herbarium: Array.from(this.herbarium),
      cells: this.board.cells.slice(0, BALANCE.board.total_cells).map((c) => c.item),
      orders: this.orders,
      nextOrderId: this.nextOrderId,
      stats: { ...this.stats },
      tutorialCompleted: this.tutorialCompleted,
      tutorialStep: this.tutorialStep,
    };
  }

  restore(save: SerializedGame, now = Date.now()): void {
    this.startedAt = save.startedAt ?? now;
    this.lastSeen = save.lastSeen ?? now;
    this.energy = save.energy ?? BALANCE.energy.cap_base;
    this.coins = save.coins ?? 0;
    this.reputation = (save as any).reputation ?? 0;
    this.levels = { ...save.levels };
    this.decorLevels = (save as any).decorLevels ?? {};
    // мигрируем старые сейвы: если decorLevels пустой, инициализируем
    const decorCfg = BALANCE.decor;
    if (decorCfg) {
      for (const d of decorCfg) {
        if (!(d.id in this.decorLevels)) this.decorLevels[d.id] = 0;
      }
    }
    this.herbarium = new Set((save as any).herbarium ?? []);
    this.orders = save.orders ?? [];
    this.nextOrderId = save.nextOrderId ?? 1;
    this.stats = (save as any).stats ?? { clicks: 0, merges: 0, ordersDone: 0, sold: 0, reputationEarned: 0, speciesDiscovered: 0 };
    this.tutorialCompleted = (save as any).tutorialCompleted ?? (save.version < 3 ? false : true);
    this.tutorialStep = (save as any).tutorialStep ?? 0;
    // для старых игроков, у которых уже есть прогресс — считаем туториал пройденным
    if (save.version < 3 && (this.stats.merges > 0 || this.stats.ordersDone > 0)) {
      this.tutorialCompleted = true;
    }
    // миграция для старых stats
    if (!('reputationEarned' in this.stats)) (this.stats as any).reputationEarned = 0;
    if (!('speciesDiscovered' in this.stats)) (this.stats as any).speciesDiscovered = this.herbarium.size;
    this.applyShop();
    this.board.clear();
    const cells = save.cells ?? [];
    for (let i = 0; i < cells.length && i < this.board.cells.length; i += 1) {
      const item = cells[i];
      if (item && item.chainId && item.level) {
        this.board.cells[i].item = { ...item };
        this.herbarium.add(itemKey(item));
      }
    }
  }

  inventory(): Map<string, number> {
    const out = new Map<string, number>();
    for (const { item } of this.board.entries()) {
      const key = itemKey(item);
      out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
  }
}
