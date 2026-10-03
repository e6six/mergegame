/**
 * Модель игрока: бот играет в игру теми же вызовами, что и интерфейс.
 *
 * Нужна для сквозных тестов (session.test.ts) и для оценки баланса: питоновский
 * симулятор tools/simulate.py считает предметы по всему полю разом и потому
 * переоценивает прогресс — здесь игра проходится по-настоящему, со связными
 * группами и перетаскиванием предметов, то есть ровно так, как играет человек.
 *
 * Правила поведения:
 *   - цепочку выбираем по недобору в кликах, а не по числу предметов;
 *   - мерджим всё, кроме предметов, зарезервированных под заказы;
 *   - группу для мерджа собираем перетаскиванием (removeAt + placeAt);
 *   - когда поле под завязку — продаём лишнее, чтобы освободить место.
 */

import { BALANCE } from './balance';
import { Game } from './game';
export interface SessionResult {
  game: Game;
  clicks: number;
  minutes: number;
}

/**
 * Играет партию: по умолчанию это `minutes` минут реального времени, по одной
 * секунде на шаг. Колбэк `onStep` вызывается после каждого шага — тесты
 * проверяют в нём инварианты, а замеры баланса собирают статистику.
 */
export function playSession(
  seed: number,
  minutes: number,
  onStep?: (game: Game, step: number) => void,
): SessionResult {
  const game = new Game(seeded(seed));
  let now = game.startedAt;
  game.tick(now);
  const steps = minutes * 60;
  let clicks = 0;

  for (let step = 0; step < steps; step += 1) {
    now += 1000; // одна секунда игрового времени на шаг
    game.tick(now);
    const chains = game.unlockedChainIds(now);

    // 1. Сначала сдаём всё, что собрано: это монеты и репутация
    let fulfilled = false;
    for (const order of [...game.orders]) {
      if (game.orderAvailable(order)) {
        if (!game.fulfilOrder(order.id)) break;
        fulfilled = true;
      }
    }
    if (fulfilled) {
      onStep?.(game, step);
      continue;
    }

    // 2. Клик по генератору — цепочка по недобору в кликах
    if (game.energy >= game.clickCost && game.board.freeCells() > 0) {
      const chain = pickChain(game, chains, reservedCounts(game));
      const result = game.generate(chain);
      if (result.ok) clicks += 1;
    }

    // 3. Мердж: собираем группы перетаскиванием и соединяем всё, что не
    //    забронировано под заказы (правило 5→2 проверяет уже сама игра).
    for (let guard = 0; guard < 25; guard += 1) {
      let merged = false;
      for (const candidate of pickMergeCandidates(game, reservedCounts(game))) {
        // Сначала пробуем собрать пятёрку (5 → 2), если не выходит — тройку
        let index = gatherCluster(game, candidate.chainId, candidate.level, candidate.want);
        if (index === null && candidate.want === 5) {
          index = gatherCluster(game, candidate.chainId, candidate.level, 3);
        }
        if (index === null) continue;
        if (!game.mergeAt(index)) break;
        merged = true;
        break;
      }
      if (!merged) break;
    }

    // 4. Поле под завязку — аварийный мердж, затем продажа самого дешёвого лишнего
    if (game.board.fillRatio() >= BALANCE.board_relief.sell_at && game.board.freeCells() <= 2) {
      const fresh = reservedCounts(game);
      let soldSomething = false;
      for (let i = 0; i < game.board.cells.length; i += 1) {
        const item = game.board.at(i);
        if (!item) continue;
        if ((fresh.get(`${item.chainId}:${item.level}`) ?? 0) > 0) continue;
        if (!game.sellAt(i)) break;
        soldSomething = true;
        break;
      }
      if (!soldSomething) {
        const index = lowestValueIndex(game);
        if (index >= 0) game.sellAt(index);
      }
    }

    // 5. Покупаем самое дешёвое из доступных улучшений
    const affordable = BALANCE.upgrades
      .map((u) => ({ id: u.id, cost: game.nextUpgradeCost(u.id) }))
      .filter((u): u is { id: string; cost: number } => u.cost !== null && u.cost <= game.coins)
      .sort((a, b) => a.cost - b.cost)[0];
    if (affordable) game.buyUpgrade(affordable.id);

    onStep?.(game, step);
  }

  return { game, clicks, minutes };
}


export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const clickCostOf = (level: number): number =>
  BALANCE.items.click_cost_by_level[Math.min(level - 1, BALANCE.items.click_cost_by_level.length - 1)];

/** Сколько предметов каждого вида забронировано под заказы (прямые нужды). */
function reservedCounts(game: Game): Map<string, number> {
  const need = new Map<string, number>();
  for (const order of game.orders) {
    for (const item of order.needs) {
      const key = `${item.chainId}:${item.level}`;
      need.set(key, (need.get(key) ?? 0) + 1);
    }
  }
  return need;
}

/** Ценность запаса в кликах — так видно перекос в одну цепочку. */
function chainValueInClicks(game: Game, need: Map<string, number>): Map<string, number> {
  const value = new Map<string, number>();
  for (const [key, count] of need.entries()) {
    const [chainId, level] = key.split(':');
    value.set(chainId, (value.get(chainId) ?? 0) + count * clickCostOf(Number(level)));
  }
  for (const { item } of game.board.entries()) {
    value.set(item.chainId, (value.get(item.chainId) ?? 0) - clickCostOf(item.level));
  }
  return value;
}

/** Цепочка с наибольшим недобором; если всё закрыто — самая пустая. */
function pickChain(game: Game, chains: string[], need: Map<string, number>): string {
  const value = chainValueInClicks(game, need);
  let best = chains[0];
  let bestDeficit = -Infinity;
  for (const chain of chains) {
    const deficit = value.get(chain) ?? 0;
    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      best = chain;
    }
  }
  if (bestDeficit > 0) return best;
  // Потребности закрыты — копим в самой пустой цепочке
  return chains.reduce((acc, chain) =>
    (value.get(chain) ?? 0) > (value.get(acc) ?? 0) ? chain : acc,
  chains[0]);
}

interface Candidate {
  chainId: string;
  level: number;
  /** Сколько предметов нужно собрать в одну связную группу: 5 или 3. */
  want: number;
}

/**
 * Слияние в игре возможно только для связной группы, а генератор всегда кладёт
 * предмет в первую свободную клетку. Значит, игрок обязан перетаскивать
 * предметы друг к другу — здесь бот делает то же самое теми же вызовами, что
 * и интерфейс при drag&drop (removeAt + placeAt).
 */
function neighboursOf(game: Game, index: number): number[] {
  const col = index % game.board.cols;
  const row = Math.floor(index / game.board.cols);
  const out: number[] = [];
  if (col > 0) out.push(game.board.index(col - 1, row));
  if (col < game.board.cols - 1) out.push(game.board.index(col + 1, row));
  if (row > 0) out.push(game.board.index(col, row - 1));
  if (row < game.board.rows - 1) out.push(game.board.index(col, row + 1));
  return out;
}

/** Индексы всех предметов нужного вида. */
function indicesOf(game: Game, chainId: string, level: number): number[] {
  const out: number[] = [];
  for (const { index, item } of game.board.entries()) {
    if (item.chainId === chainId && item.level === level) out.push(index);
  }
  return out;
}

/**
 * Собирает связную группу нужного размера, перетаскивая предметы к самой
 * большой существующей группе. Возвращает индекс группы или null, если
 * собрать не удалось (нет места рядом).
 */
function gatherCluster(game: Game, chainId: string, level: number, want: number): number | null {
  let cluster: number[] = [];
  for (const index of indicesOf(game, chainId, level)) {
    const found = game.board.cluster(index);
    if (found.length > cluster.length) cluster = found;
  }
  if (cluster.length >= want) return cluster[0];

  for (let guard = 0; guard < want * 2 && cluster.length < want; guard += 1) {
    // Свободные соседи группы — туда можно подтащить предмет
    const spots = [...new Set(cluster.flatMap((index) => neighboursOf(game, index)))]
      .filter((index) => game.board.isOpen(index) && game.board.at(index) === null);
    const loose = indicesOf(game, chainId, level).filter((index) => !cluster.includes(index));
    if (spots.length === 0 || loose.length === 0) return null;

    const item = game.board.removeAt(loose[0]);
    if (!item) return null;
    if (!game.board.placeAt(spots[0], item)) return null;

    cluster = game.board.cluster(spots[0]);
  }

  return cluster.length >= want ? cluster[0] : null;
}

/** Что выгодно соединить: есть минимум 3 свободных (не под заказ) предмета. */
function pickMergeCandidates(game: Game, need: Map<string, number>): Candidate[] {
  const seen = new Set<string>();
  for (const { item } of game.board.entries()) {
    seen.add(`${item.chainId}:${item.level}`);
  }
  const out: Candidate[] = [];
  for (const key of seen) {
    const [chainId, level] = key.split(':');
    const lvl = Number(level);
    if (lvl >= BALANCE.merge.max_level) continue;
    const free = game.board.countOf(chainId, lvl) - (need.get(key) ?? 0);
    if (free < 3) continue;
    // Пятёрка выгоднее (5 → 2), но её нужно суметь собрать: если места рядом
    // мало, берём тройку. Ниже уровнем — раньше в очереди: из них растёт всё.
    out.push({ chainId, level: lvl, want: free >= 5 && game.board.freeCells() >= 2 ? 5 : 3 });
  }
  return out.sort((a, b) => a.level - b.level || a.chainId.localeCompare(b.chainId));
}

function lowestValueIndex(game: Game): number {
  let best = -1;
  let bestValue = Infinity;
  for (let i = 0; i < game.board.cells.length; i += 1) {
    const item = game.board.at(i);
    if (!item) continue;
    const value = game.sellValue(item.level);
    if (value < bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}
