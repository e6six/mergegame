import { describe, expect, it } from 'vitest';
import { BALANCE } from './balance';
import { Game } from './game';
import { playSession, seeded } from './player-model';
import type { Item } from './board';

/**
 * Сквозной прогон сессии: бот (src/core/player-model.ts) играет в игру через
 * то же API, что и интерфейс, и после каждого шага проверяются инварианты.
 *
 * Одиночные юнит-тесты проверяют функции по отдельности; здесь проверяется,
 * что игра остаётся играбельной и не рассыпается подряд: энергия не уходит в
 * минус, поле не забивается намертво, заказы закрываются, сейв не теряет данных.
 */

/**
 * Проверки, которые должны выполняться всегда, в любой момент партии.
 * Если игра «сломалась», чаще всего ломается именно что-то из этого списка.
 */
function assertInvariants(game: Game, step: number): void {
  const where = `шаг ${step}`;

  // Энергия: конечное число в границах 0..кап
  expect(Number.isFinite(game.energy), `энергия не число: ${game.energy} (${where})`).toBe(true);
  expect(game.energy).toBeGreaterThanOrEqual(-1e-6);
  expect(game.energy).toBeLessThanOrEqual(game.effectiveEnergyCap() + 1e-6);

  // Монеты и репутация не уходят в минус и не превращаются в NaN
  expect(Number.isFinite(game.coins)).toBe(true);
  expect(game.coins).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(game.reputation)).toBe(true);
  expect(game.reputation).toBeGreaterThanOrEqual(0);

  // Поле: предметы только в открытых клетках, уровни в допустимых границах
  let placed = 0;
  for (let i = 0; i < game.board.cells.length; i += 1) {
    const item = game.board.at(i) as Item | null;
    if (!item) continue;
    placed += 1;
    expect(game.board.isOpen(i), `предмет в закрытой клетке ${i} (${where})`).toBe(true);
    expect(item.level).toBeGreaterThanOrEqual(1);
    expect(item.level).toBeLessThanOrEqual(BALANCE.merge.max_level);
    expect(item.chainId.length).toBeGreaterThan(0);
  }
  expect(placed).toBe(game.board.usedCells());
  expect(game.board.usedCells()).toBeLessThanOrEqual(game.board.openCells);

  // Заказы: слоты всегда заняты, идентификаторы уникальны
  expect(game.orders.length).toBe(BALANCE.orders.slots);
  expect(new Set(game.orders.map((o) => o.id)).size).toBe(game.orders.length);
  for (const order of game.orders) {
    expect(order.needs.length).toBeGreaterThan(0);
    expect(order.rewardCoins).toBeGreaterThan(0);
  }
}

describe('сквозной прогон сессии', () => {
  it('игра остаётся целостной 40 минут игры подряд (3 разных сида)', () => {
    for (const seed of [1, 7, 42]) {
      const { game, clicks } = playSession(seed, 40, assertInvariants);
      // Игрок обязан что-то сделать за 40 минут: без прогресса петля не работает
      expect(clicks, `сид ${seed}: ни одного клика генератора`).toBeGreaterThan(20);
      expect(game.stats.merges, `сид ${seed}: ни одного мерджа`).toBeGreaterThan(5);
      expect(game.stats.ordersDone, `сид ${seed}: ни одного заказа`).toBeGreaterThan(0);
      expect(game.coins, `сид ${seed}: не заработано монет`).toBeGreaterThan(0);
    }
  });

  it('заказы закрываются регулярно, а не раз в вечность', () => {
    // Питоновский симулятор обещает 4.86 заказа за сессию, но он считает
    // предметы по всему полю и не знает про связные группы. По реальному коду
    // выходит около 3 заказов за сессию — этот порог и закрепляем, чтобы
    // баланс не просел незаметно.
    const seeds = [1, 2, 3, 4, 5, 6];
    let total = 0;
    for (const seed of seeds) {
      const { game } = playSession(seed, 10, assertInvariants);
      total += game.stats.ordersDone;
      expect(game.orders.length).toBe(BALANCE.orders.slots);
    }
    const perSession = total / seeds.length;
    expect(perSession, `заказов за сессию: ${perSession.toFixed(2)}`).toBeGreaterThanOrEqual(2);
  });

  it('поле не забивается намертво: место всегда освобождается продажей', () => {
    const { game } = playSession(5, 25, assertInvariants);
    expect(game.board.freeCells()).toBeGreaterThan(0);
  });

  it('гербарий наполняется по ходу игры, а не стоит на нуле', () => {
    const { game } = playSession(11, 40, assertInvariants);
    const progress = game.herbariumProgress();
    expect(progress.discovered).toBeGreaterThan(1);
    expect(progress.discovered).toBeLessThanOrEqual(progress.total);
    expect(game.herbariumBonus).toBeGreaterThan(0);
  });

  it('сейв переживает сохранение и загрузку без потерь', () => {
    const { game } = playSession(3, 15, assertInvariants);
    const snapshot = game.serialize();

    const restored = new Game(seeded(3));
    restored.restore(snapshot);

    expect(restored.coins).toBe(game.coins);
    expect(Math.round(restored.energy * 1000)).toBe(Math.round(game.energy * 1000));
    expect(restored.reputation).toBe(game.reputation);
    expect(restored.levels).toEqual(game.levels);
    expect(restored.decorLevels).toEqual(game.decorLevels);
    expect(restored.herbarium.size).toBe(game.herbarium.size);
    expect(restored.stats).toEqual(game.stats);
    expect(restored.board.usedCells()).toBe(game.board.usedCells());
    expect(restored.orders.length).toBe(game.orders.length);

    // После загрузки игра продолжает работать, а не падает
    restored.tick();
    restored.addEnergy(5);
    expect(restored.generate('rose').ok || restored.board.freeCells() === 0).toBe(true);
  });

  it('репутация тратится на декор и даёт бонусы', () => {
    const game = new Game(seeded(21));
    game.tick();
    game.reputation = 100000;

    const first = BALANCE.decor[0];
    const cost = game.nextDecorCost(first.id);
    expect(cost).not.toBeNull();
    expect(game.buyDecor(first.id)).toBe(true);
    expect(game.decorLevel(first.id)).toBe(1);
    expect(game.reputation).toBeLessThan(100000);
    expect(game.decorEffects.incomeBonus).toBeGreaterThan(0);
  });
});
