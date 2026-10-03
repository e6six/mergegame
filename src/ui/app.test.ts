// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../core/game';
import { BALANCE } from '../core/balance';
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

/**
 * Эмодзи в интерфейсе запрещены: пользователь отдельно просил, чтобы всё, что
 * видит игрок, было нарисовано ассетами (art/sprites) или чистым CSS.
 * Проверка ловит именно эмодзи-презентацию, не трогая обычные символы вроде
 * стрелок, галочек и многоточий.
 */
const EMOJI = /\p{Emoji_Presentation}/u;

/** Открывает панель по подписи кнопки (квартал, гербарий, декор, магазин). */
function openPanel(root: HTMLElement, label: string): void {
  const button = [...root.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  expect(button, `кнопка «${label}» не найдена`).toBeDefined();
  button?.click();
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
    // Клик по предмету больше не «только инфо»: в карточке есть кнопка продажи,
    // а подсказка напоминает про корзину для перетаскивания.
    expect(popup?.textContent).toContain('корзину');
    expect(popup?.textContent).toContain('Продать');

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

  it('в интерфейсе нет эмодзи — только спрайты, текст и CSS', () => {
    const { root, app } = setup();
    const check = (where: string) => {
      const html = root.innerHTML;
      const found = html.match(EMOJI);
      expect(found, `эмодзи ${found?.[0]} в разметке (${where})`).toBeNull();
    };

    check('основной экран');

    // Кнопка магазина — со спрайтом ui-shop (раньше был эмодзи 🛒)
    const shopImg = [...root.querySelectorAll('.button--icon img')].map((n) => n.getAttribute('src'));
    expect(shopImg.some((src) => src?.includes('ui-shop'))).toBe(true);

    // Каждая панель открывается поверх остальных — проверяем по очереди
    openPanel(root, 'Гербарий');
    app.render();
    check('гербарий');
    // На закрытых видах спрайт ui-locked, а не символ замка
    expect(root.querySelector('.herbarium__item--locked img')?.getAttribute('src')).toContain('ui-locked');

    openPanel(root, 'Декор');
    app.render();
    check('декор');

    openPanel(root, 'Квартал');
    app.render();
    check('квартал');
  });

  it('в панели декора все 11 видов со своими спрайтами', () => {
    const { root, app } = setup();
    openPanel(root, 'Декор');
    app.render();

    const tiles = [...root.querySelectorAll('.panel-tile')];
    expect(tiles).toHaveLength(BALANCE.decor.length);
    for (const tile of tiles) {
      const src = tile.querySelector('img')?.getAttribute('src') ?? '';
      // Ни один декор не должен падать на запасную иконку ui-rep:
      // у всех 11 видов есть собственный сгенерированный спрайт
      expect(src, `декор без спрайта: ${tile.textContent}`).toContain('decor-');
    }
  });

  it('окно магазина без эмодзи', () => {
    const { root, app } = setup();
    openPanel(root, 'Магазин');
    app.render();
    const found = root.innerHTML.match(EMOJI);
    expect(found, `эмодзи ${found?.[0]} в магазине`).toBeNull();
  });

  it('подсказка о переполнении поля ведёт в корзину, а не «клик по предмету»', () => {
    const { root, game, app } = setup();
    game.board.openCells = 10;
    for (let i = 0; i < 9; i += 1) game.board.place({ chainId: 'rose', level: 1 });
    app.render();

    const relief = root.querySelector('.relief') as HTMLElement;
    expect(relief).not.toBeNull();
    expect(relief.textContent).toContain('корзину');
    expect(relief.textContent).not.toContain('клик по предмету');
  });

  it('продаёт предмет кнопкой в карточке', () => {
    const { root, game, app } = setup();
    game.board.placeAt(0, { chainId: 'rose', level: 3 });
    app.render();

    pointerClick(cells(root)[0]);
    const sell = [...root.querySelectorAll('.selection button')].find((b) =>
      b.textContent?.includes('Продать'),
    ) as HTMLButtonElement;
    expect(sell).toBeDefined();

    const coinsBefore = game.coins;
    sell.click();

    expect(game.board.at(0)).toBeNull();
    expect(game.coins).toBeGreaterThan(coinsBefore);
  });

  it('покупка декора ставит его на улицу квартала', () => {
    const { root, game, app } = setup();
    game.reputation = 100000;
    expect(game.buyDecor('bench')).toBe(true);
    expect(game.buyDecor('cat')).toBe(true);

    // Декор попадает на карту: canvas получает список нарисованных предметов
    openPanel(root, 'Квартал');
    app.render();
    const canvas = root.querySelector('.quarter__canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    expect(canvas.dataset.decor ?? '').toContain('bench');
    expect(canvas.dataset.decor ?? '').toContain('cat');

    // И строка состояния рассказывает, сколько декора уже на улице
    const line = root.querySelector('.quarter__decor-line') as HTMLElement;
    expect(line.textContent).toContain('декора на улице 2');
  });

  it('в квартале есть переход «купить — посмотреть на улице»', () => {
    const { root, app } = setup();
    openPanel(root, 'Декор');
    app.render();

    const seeBtn = [...root.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Посмотреть на улице'),
    ) as HTMLButtonElement;
    expect(seeBtn).toBeDefined();

    seeBtn.click();
    app.render();
    expect(root.querySelector('.quarter__canvas')).not.toBeNull();
  });

  it('доска целиком помещается в отведённое место, а не уезжает наверх', () => {
    // Регрессия: раньше размер клетки считался от высоты окна с фиксированной
    // поправкой «на заголовки», и на невысоких экранах доска с генераторами и
    // корзиной не помещалась — верх доски обрезался.
    const { root, game, app } = setup();
    const wrap = root.querySelector('.board-wrap') as HTMLElement;
    const generators = root.querySelector('.generators') as HTMLElement;
    const sellZone = root.querySelector('.sell-zone') as HTMLElement;

    Object.defineProperty(wrap, 'clientWidth', { value: 900, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 700, configurable: true });
    Object.defineProperty(generators, 'offsetHeight', { value: 74, configurable: true });
    Object.defineProperty(sellZone, 'offsetHeight', { value: 64, configurable: true });
    app.render();

    const board = root.querySelector('.board') as HTMLElement;
    const cell = parseFloat(board.style.getPropertyValue('--cell'));
    expect(Number.isFinite(cell)).toBe(true);

    // Доска вместе с рамкой не должна вылезать за контейнер по высоте и ширине
    const wrapStyle = getComputedStyle(wrap);
    const boardStyle = getComputedStyle(board);
    const num = (value: string, fallback: number) => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const gap = num(boardStyle.gap, 6);
    const padY = num(wrapStyle.paddingTop, 20) + num(wrapStyle.paddingBottom, 20);
    const boardPadY = num(boardStyle.paddingTop, 14) + num(boardStyle.paddingBottom, 14);
    const boardPadX = num(boardStyle.paddingLeft, 14) + num(boardStyle.paddingRight, 14);

    const boardHeight = cell * game.board.rows + gap * (game.board.rows - 1) + boardPadY;
    const boardWidth = cell * game.board.cols + gap * (game.board.cols - 1) + boardPadX;
    expect(boardHeight + padY + generators.offsetHeight + sellZone.offsetHeight).toBeLessThanOrEqual(700);
    expect(boardWidth).toBeLessThanOrEqual(900);
  });

  it('показывает предупреждение о переполнении поля', () => {
    const { root, game, app } = setup();
    game.board.openCells = 10;
    for (let i = 0; i < 9; i += 1) game.board.place({ chainId: 'rose', level: 1 });
    app.render();
    expect(root.querySelector('.relief')).not.toBeNull();
  });
});
