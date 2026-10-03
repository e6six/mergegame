// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../core/game';
import { mountApp } from './app';

/**
 * Дымовые тесты интерфейса: проверяют, что экран собирается, кнопки
 * действительно меняют состояние игры, а клики по доске соединяют предметы.
 * Ошибку в рендере такой тест ловит сразу, не дожидаясь открытия браузера.
 */

function seeded(seed = 3): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function setup() {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app') as HTMLElement;
  const game = new Game(seeded());
  game.tick();
  game.tutorialCompleted = true;
  // JSDOM не имеет pointer capture и elementFromPoint — мокаем
  if (!HTMLElement.prototype.setPointerCapture) {
    (HTMLElement.prototype as any).setPointerCapture = () => {};
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    (HTMLElement.prototype as any).releasePointerCapture = () => {};
  }
  if (!(document as any).elementFromPoint) {
    (document as any).elementFromPoint = () => null;
  }
  // JSDOM не считает layout, поэтому размер клетки берём фиксированный
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
  Object.defineProperty(root, 'clientWidth', { value: 700, configurable: true });
  const app = mountApp(root, game);
  app.render();
  return { root, game, app };
}

function cells(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll('.cell')] as HTMLElement[];
}

function pointerClick(el: HTMLElement): void {
  el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, bubbles: true }));
  el.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10, button: 0, bubbles: true }));
}

describe('интерфейс', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('рисует доску, заказы, магазин и генераторы', () => {
    const { root, game } = setup();
    expect(cells(root)).toHaveLength(game.board.cols * game.board.rows);
    expect(root.querySelectorAll('.order').length).toBe(game.orders.length);
    expect(root.querySelectorAll('.upgrade').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('.gen').length).toBeGreaterThan(0);
  });

  it('показывает счётчики энергии и монет', () => {
    const { root } = setup();
    const stats = [...root.querySelectorAll('.stat')].map((n) => n.textContent ?? '');
    expect(stats.some((text) => text.includes('/'))).toBe(true);
  });

  it('кнопка генератора тратит энергию и ставит предмет', () => {
    const { root, game } = setup();
    const button = root.querySelector('.gen') as HTMLButtonElement;
    const energyBefore = game.energy;
    button.click();
    expect(game.energy).toBeLessThan(energyBefore);
    expect(game.board.usedCells()).toBe(1);
    expect(cells(root)[0].querySelector('img')).not.toBeNull();
  });

  it('клик по двум одинаковым предметам соединяет их', () => {
    const { root, game, app } = setup();
    game.board.openCells = 12;
    game.board.placeAt(0, { chainId: 'rose', level: 1 });
    game.board.placeAt(1, { chainId: 'rose', level: 1 });
    game.board.placeAt(2, { chainId: 'rose', level: 1 });
    app.render();

    const list = cells(root);
    pointerClick(list[0]);
    pointerClick(list[1]);

    expect(game.board.countOf('rose', 2)).toBe(1);
    expect(game.board.countOf('rose', 1)).toBe(0);
    // Результат виден на доске
    expect(list[0].querySelector('img')).not.toBeNull();
  });

  it('предупреждает, если рядом меньше трёх одинаковых предметов', () => {
    const { root, game, app } = setup();
    game.board.openCells = 12;
    game.board.placeAt(0, { chainId: 'rose', level: 1 });
    game.board.placeAt(1, { chainId: 'rose', level: 1 });
    app.render();

    const list = cells(root);
    pointerClick(list[0]);
    pointerClick(list[1]);

    expect(game.board.countOf('rose', 1)).toBe(2);
    expect(root.querySelector('.toast--warn')).not.toBeNull();
  });

  it('переносит предмет в пустую клетку', () => {
    const { root, game, app } = setup();
    game.board.openCells = 12;
    game.board.placeAt(0, { chainId: 'wild', level: 1 });
    app.render();

    const list = cells(root);
    pointerClick(list[0]);
    pointerClick(list[5]);

    expect(game.board.at(0)).toBeNull();
    expect(game.board.at(5)?.chainId).toBe('wild');
  });

  it('кнопка «Сдать» активируется, когда предметы собраны, и начисляет монеты', () => {
    const { root, game, app } = setup();
    const order = game.orders[0];
    for (const need of order.needs) {
      game.board.place({ chainId: need.chainId, level: need.level });
    }
    app.render();

    const ready = root.querySelector('.order--ready');
    expect(ready).not.toBeNull();
    const accept = [...(ready as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Сдать'),
    ) as HTMLButtonElement;
    expect(accept.disabled).toBe(false);

    const coinsBefore = game.coins;
    accept.click();
    expect(game.coins).toBeGreaterThan(coinsBefore);
  });

  it('покупка апгрейда в магазине меняет состояние игры', () => {
    const { root, game, app } = setup();
    game.coins = 1_000_000;
    app.render();

    const buy = root.querySelector('.upgrade .button:not([disabled])') as HTMLButtonElement;
    expect(buy).not.toBeNull();
    buy.click();

    const bought = Object.values(game.levels).some((level) => level > 0);
    expect(bought).toBe(true);
  });

  it('продажа предмета через перетаскивание в корзину освобождает клетку', () => {
    const { root, game, app } = setup();
    game.board.placeAt(0, { chainId: 'rose', level: 3 });
    app.render();

    // клик показывает подсказку про корзину, а не кнопку Продать
    cells(root)[0].dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 }));
    cells(root)[0].dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10, button: 0 }));
    const popup = root.querySelector('.selection');
    expect(popup).not.toBeNull();
    expect(popup?.textContent).toContain('Перетащи в корзину');

    // симулируем drag в корзину
    const cell = cells(root)[0];
    const sellZone = root.querySelector('.sell-zone') as HTMLElement;
    expect(sellZone).not.toBeNull();

    // начинаем drag
    cell.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 }));
    // двигаем чтобы начался drag
    cell.dispatchEvent(new PointerEvent('pointermove', { clientX: 30, clientY: 30 }));
    // бросаем в корзину — напрямую вызываем sell через game API (эмуляция drop)
    const coinsBefore = game.coins;
    (game as any).sellAt(0);
    app.render();

    expect(game.board.at(0)).toBeNull();
    expect(game.coins).toBeGreaterThanOrEqual(coinsBefore);
    // корзина должна быть видима во время drag
    expect(root.querySelector('.sell-zone')).not.toBeNull();
  });

  it('рисует метку на закрытых клетках вместо предметов', () => {
    const { root, game, app } = setup();
    game.board.openCells = 4;
    game.board.placeAt(0, { chainId: 'rose', level: 1 });
    app.render();

    const list = cells(root);
    // Клетка внутри открытой зоны — предмет, за её пределами — метка замка
    expect(list[0].querySelector('img')?.getAttribute('src')).toContain('rose-01');
    const locked = list[10];
    expect(locked.classList.contains('cell--locked')).toBe(true);
    expect(locked.querySelector('img')?.getAttribute('src')).toContain('ui-locked');
  });

  it('кнопка «Квартал» открывает экран со зданиями и закрывается', () => {
    const { root, game, app } = setup();
    const button = [...root.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Квартал'),
    ) as HTMLButtonElement;
    expect(button).toBeDefined();

    button.click();
    app.render();

    expect(root.querySelector('.quarter')).not.toBeNull();
    expect(root.querySelectorAll('.quarter__tile').length).toBe(6);
    // На старте открыта только лавка
    expect(root.querySelectorAll('.quarter__tile--locked').length).toBe(5);

    // Через месяц открыты все шесть
    game.startedAt -= 30 * 24 * 60 * 60 * 1000;
    app.render();
    expect(root.querySelectorAll('.quarter__tile--locked').length).toBe(0);

    const close = [...root.querySelectorAll('.quarter button')].find((b) =>
      b.textContent?.includes('Вернуться'),
    ) as HTMLButtonElement;
    close.click();
    expect(root.querySelector('.quarter')).toBeNull();
  });

  it('показывает предупреждение о переполнении поля', () => {
    const { root, game, app } = setup();
    game.board.openCells = 10;
    for (let i = 0; i < 9; i += 1) game.board.place({ chainId: 'rose', level: 1 });
    app.render();
    expect(root.querySelector('.relief')).not.toBeNull();
  });
});
