import { BALANCE } from './balance';
import { CHAINS, type ChainDef } from '../data/items.generated';

/**
 * Заказы. Чистая логика: генерация, проверка выполнимости, сдача.
 * Случайность передаётся снаружи (rng), чтобы тесты были детерминированы.
 */

export type Rng = () => number;

export interface OrderNeed {
  chainId: string;
  level: number;
}

export interface Order {
  id: number;
  needs: OrderNeed[];
  rewardCoins: number;
  /** Монотонное время (мс) окончания таймера. */
  deadline: number;
  /** Заказ «остыл»: время вышло, награда урезана. */
  stale: boolean;
  /** Сколько раз заказ уже остывал — растёт, чтобы награда не падала до нуля. */
  stales: number;
}

export interface OrderContext {
  /** Стоимость предмета в кликах по уровню — из balance.items.click_cost_by_level. */
  clickCost: (level: number) => number;
  /** Множитель дохода (касса × здания). */
  incomeMultiplier: number;
  /** Длительность таймера в мс. */
  lifetimeMs: number;
}

/** Цепочки, из которых приходят заказы (служебные не дают заказов). */
export function orderChains(unlockedChainIds: readonly string[]): ChainDef[] {
  return CHAINS.filter((c) => c.role === 'order' && unlockedChainIds.includes(c.id));
}

function weightedPick(weights: Record<string, number>, rng: Rng): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function makeOrder(
  id: number,
  unlockedChainIds: readonly string[],
  now: number,
  rng: Rng,
  ctx: OrderContext,
): Order {
  const chains = orderChains(unlockedChainIds);
  const pool = chains.length ? chains : CHAINS.filter((c) => c.role === 'order');
  const size = Number(weightedPick(BALANCE.orders.item_count_weights, rng));

  const needs: OrderNeed[] = [];
  for (let i = 0; i < size; i += 1) {
    const chain = pool[Math.floor(rng() * pool.length)];
    const maxLevel = BALANCE.merge.max_level - 1;
    const level = Math.min(maxLevel, Number(weightedPick(BALANCE.orders.level_weights, rng)));
    needs.push({ chainId: chain.id, level });
  }

  const clicks = needs.reduce((sum, need) => sum + ctx.clickCost(need.level), 0);
  return {
    id,
    needs,
    rewardCoins: Math.round(clicks * BALANCE.orders.coins_per_click * ctx.incomeMultiplier),
    deadline: now + ctx.lifetimeMs,
    stale: false,
    stales: 0,
  };
}

/** Хватает ли на поле предметов под заказ. */
export function canFulfil(
  order: Order,
  available: (chainId: string, level: number) => number,
): boolean {
  const want = new Map<string, number>();
  for (const need of order.needs) {
    const key = `${need.chainId}:${need.level}`;
    want.set(key, (want.get(key) ?? 0) + 1);
  }
  for (const [key, n] of want) {
    const [chainId, level] = key.split(':');
    if (available(chainId, Number(level)) < n) return false;
  }
  return true;
}

/** Сколько и каких предметов списать при сдаче заказа. */
export function orderCost(order: Order): Map<string, { chainId: string; level: number; count: number }> {
  const out = new Map<string, { chainId: string; level: number; count: number }>();
  for (const need of order.needs) {
    const key = `${need.chainId}:${need.level}`;
    const entry = out.get(key);
    if (entry) entry.count += 1;
    else out.set(key, { chainId: need.chainId, level: need.level, count: 1 });
  }
  return out;
}

/**
 * Остывание заказа: время вышло — не сгорает, а ждёт дальше с урезанной наградой.
 * Прогресс игрока не отнимаем никогда: это главный убийца удержания в казуалках.
 */
export function coolDown(order: Order, now: number, ctx: OrderContext): Order {
  const stales = order.stales + 1;
  const factor = Math.max(0.4, 1 - 0.2 * stales);
  const base = order.rewardCoins / Math.max(0.4, 1 - 0.2 * order.stales);
  return {
    ...order,
    stales,
    stale: true,
    rewardCoins: Math.round(base * factor),
    deadline: now + ctx.lifetimeMs,
  };
}
