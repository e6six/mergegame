import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE, shopEffects, upgradeCost } from './balance';
import { Game } from './game';
import { CHAINS } from '../data/items.generated';

/** Предсказуемый генератор случайных чисел для детерминированных тестов. */
function seeded(seed = 42): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('энергия и добыча', () => {
  let game: Game;
  beforeEach(() => {
    game = new Game(seeded());
  });

  it('клик по генератору тратит энергию и ставит предмет', () => {
    const before = game.energy;
    const result = game.generate('rose');
    expect(result.ok).toBe(true);
    expect(game.energy).toBeLessThan(before);
    expect(game.board.usedCells()).toBe(1);
  });

  it('не даёт кликать без энергии', () => {
    game.energy = 0;
    const result = game.generate('rose');
    expect(result.ok).toBe(false);
    expect(game.board.usedCells()).toBe(0);
  });

  it('не даёт ставить предметы, когда поле заполнено', () => {
    game.board.openCells = 1;
    expect(game.generate('rose').ok).toBe(true);
    const result = game.generate('rose');
    expect(result.ok).toBe(false);
    // Энергия за неудавшийся клик не списывается
    expect(game.energy).toBeCloseTo(BALANCE.energy.cap_base - BALANCE.energy.click_cost);
  });

  it('восстанавливает энергию со временем и упирается в кап', () => {
    game.energy = 0;
    game.lastSeen = Date.now() - 60 * 60 * 1000;
    game.tick();
    expect(game.energy).toBeGreaterThan(0);
    expect(game.energy).toBeLessThanOrEqual(game.effects.energyCap);

    game.lastSeen = Date.now() - 100 * 60 * 60 * 1000;
    game.tick();
    expect(game.energy).toBeCloseTo(game.effects.energyCap);
  });

  it('апгрейд холодильника поднимает кап', () => {
    const before = game.effects.energyCap;
    game.coins = 1_000_000;
    game.buyUpgrade('fridge');
    expect(game.effects.energyCap).toBeGreaterThan(before);
  });

  it('склад расширяет поле', () => {
    const before = game.board.openCells;
    game.coins = 1_000_000;
    game.buyUpgrade('warehouse');
    expect(game.board.openCells).toBe(before + 2);
  });

  it('не покупает апгрейд без денег', () => {
    game.coins = 0;
    expect(game.buyUpgrade('fridge')).toBe(false);
    expect(game.upgradeLevel('fridge')).toBe(0);
  });
});

describe('заказы', () => {
  it('на старте ровно столько заказов, сколько слотов', () => {
    const game = new Game(seeded());
    game.tick();
    expect(game.orders).toHaveLength(BALANCE.orders.slots);
  });

  it('нельзя сдать заказ без предметов', () => {
    const game = new Game(seeded());
    game.tick();
    const order = game.orders[0];
    expect(game.fulfilOrder(order.id)).toBe(false);
    expect(game.coins).toBe(0);
  });

  it('сдача заказа списывает предметы и начисляет монеты', () => {
    const game = new Game(seeded());
    game.tick();
    const order = game.orders[0];
    for (const need of order.needs) {
      game.board.place({ chainId: need.chainId, level: need.level });
    }
    const coinsBefore = game.coins;
    expect(game.fulfilOrder(order.id)).toBe(true);
    expect(game.coins).toBe(coinsBefore + order.rewardCoins);
    expect(game.board.usedCells()).toBe(0);
    // Слот сразу заполняется новым заказом
    expect(game.orders).toHaveLength(BALANCE.orders.slots);
  });

  it('берёт из награды только нужное количество предметов', () => {
    const game = new Game(seeded());
    game.tick();
    const order = game.orders[0];
    const need = order.needs[0];
    // Кладём на один предмет больше, чем нужно
    for (const n of order.needs) game.board.place({ chainId: n.chainId, level: n.level });
    game.board.place({ chainId: need.chainId, level: need.level });

    game.fulfilOrder(order.id);

    expect(game.board.countOf(need.chainId, need.level)).toBe(1);
  });

  it('остывание не отнимает заказ, а снижает награду', () => {
    const game = new Game(seeded());
    game.tick();
    const order = game.orders[0];
    const reward = order.rewardCoins;
    order.deadline = Date.now() - 1000;
    game.tick();

    const cooled = game.orders.find((o) => o.id === order.id);
    expect(cooled).toBeDefined();
    expect(cooled!.stale).toBe(true);
    expect(cooled!.rewardCoins).toBeLessThan(reward);
  });
});

describe('продажа и переполнение', () => {
  it('продажа даёт часть стоимости и освобождает клетку', () => {
    const game = new Game(seeded());
    game.generate('rose');
    const coins = game.coins;
    expect(game.sellAt(0)).toBe(true);
    expect(game.coins).toBeGreaterThan(coins);
    expect(game.board.usedCells()).toBe(0);
  });

  it('сигнализирует о переполнении поля', () => {
    const game = new Game(seeded());
    game.board.openCells = 10;
    for (let i = 0; i < 8; i += 1) game.board.place({ chainId: 'rose', level: 1 });
    expect(game.needsRelief).toBe(false);
    game.board.place({ chainId: 'rose', level: 1 });
    expect(game.needsRelief).toBe(true);
  });
});

describe('прогрессия', () => {
  it('цепочки открываются по дням', () => {
    const game = new Game(seeded());
    const firstDay = game.unlockedChainIds().sort();
    expect(firstDay).toContain('rose');
    expect(firstDay).not.toContain('exotic');

    game.startedAt -= 5 * 24 * 60 * 60 * 1000;
    expect(game.unlockedChainIds()).toContain('exotic');
  });

  it('здания со временем добавляют множитель дохода', () => {
    const game = new Game(seeded());
    const before = game.incomeMultiplier();
    game.startedAt -= 5 * 24 * 60 * 60 * 1000;
    expect(game.incomeMultiplier()).toBeGreaterThan(before);
  });

  it('все цепочки манифеста по 10 уровней', () => {
    for (const chain of CHAINS) {
      expect(chain.items).toHaveLength(10);
      expect(chain.items.map((i) => i.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it('стоимость апгрейда растёт с уровнем', () => {
    const def = BALANCE.upgrades[0];
    expect(upgradeCost(def, 1)).toBeGreaterThan(upgradeCost(def, 0));
  });

  it('эффекты магазина согласованы с уровнями', () => {
    const none = shopEffects({});
    expect(none.openCells).toBe(BALANCE.board.open_at_start);
    expect(none.cashMultiplier).toBe(1);
  });
});

describe('сохранение', () => {
  it('состояние переживает запись и чтение', () => {
    const game = new Game(seeded());
    game.generate('rose');
    game.coins = 1_000_000;
    game.buyUpgrade('fridge');
    // Монеты ставим после покупки: апгрейд списывает стоимость
    game.coins = 1234;

    const snapshot = game.serialize();
    const restored = new Game(seeded());
    restored.restore(snapshot);

    expect(restored.coins).toBe(1234);
    expect(restored.upgradeLevel('fridge')).toBe(1);
    expect(restored.board.usedCells()).toBe(1);
    expect(restored.board.at(0)?.chainId).toBe('rose');
  });

  it('сейв переживает сериализацию в JSON', () => {
    const game = new Game(seeded());
    game.generate('wild');
    const parsed = JSON.parse(JSON.stringify(game.serialize()));
    const restored = new Game(seeded());
    restored.restore(parsed);
    expect(restored.board.at(0)?.chainId).toBe('wild');
  });

  it('восстановление сбрасывает поле от прежнего состояния', () => {
    const game = new Game(seeded());
    game.generate('rose');
    game.generate('rose');
    const snapshot = game.serialize();
    snapshot.cells = snapshot.cells.map(() => null);

    game.restore(snapshot);
    expect(game.board.usedCells()).toBe(0);
  });
});

describe('полный цикл', () => {
  it('за сессию игрок закрывает хотя бы один заказ', () => {
    const game = new Game(seeded(7));
    game.tick();

    let guard = 0;
    while (game.orders.every((o) => !game.orderAvailable(o)) && guard < 4000) {
      guard += 1;
      if (game.energy < game.clickCost) {
        game.energy = game.effects.energyCap;
      }
      const order = game.orders[0];
      const need = order.needs[0];
      game.generate(need.chainId);
      // Пробуем соединять всё, что соединяется
      for (let i = 0; i < game.board.openCells; i += 1) {
        if (game.board.at(i)) game.mergeAt(i);
      }
      if (game.board.freeCells() < 3) {
        for (let i = game.board.openCells - 1; i >= 0; i -= 1) {
          if (game.board.at(i)) game.sellAt(i);
        }
      }
    }

    expect(guard).toBeLessThan(4000);
    const order = game.orders.find((o) => game.orderAvailable(o));
    expect(order).toBeDefined();
  });
});
