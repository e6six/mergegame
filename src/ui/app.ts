import { BALANCE } from '../core/balance';
import { itemKey, type Item } from '../core/board';
import { Game } from '../core/game';
import type { Order } from '../core/orders';
import { ITEM_BY_KEY } from '../data/items.generated';
import { isMuted, play, toggleMuted, unlockAudio } from './audio';
import { spriteUrl } from './sprites';
import { mountQuarter, type QuarterHandle } from './quarter';
import { mountHerbarium, type HerbariumHandle } from './herbarium';
import { mountDecor, type DecorHandle } from './decor';
import { mountTutorial, type TutorialHandle } from './tutorial';

/**
 * Интерфейс: доска, заказы, магазин, генераторы.
 *
 * Рендер — обычный DOM, а не WebGL. Причины: спрайты это PNG, сетка статична,
 * а DOM даёт бесплатную поддержку тач-событий, масштабирования и доступности.
 * Плюс бандл остаётся лёгким, что критично для загрузки в iframe площадки.
 * Анимации реализованы на CSS + Web Animations API, без канваса.
 */

const CHAIN_ICON: Record<string, string> = {
  rose: 'rose-02',
  wild: 'wild-01',
  exotic: 'exotic-02',
  pack: 'pack-03',
  tools: 'tools-02',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function img(src: string | undefined, alt = '', className?: string): HTMLImageElement {
  const node = el('img', className);
  if (src) node.src = src;
  node.alt = alt;
  node.draggable = false;
  return node;
}

function shortName(item: Item | null): string {
  if (!item) return '';
  const def = ITEM_BY_KEY.get(`${item.chainId}:${item.level}`);
  return def?.name ?? `${item.chainId} ${item.level}`;
}

function spriteFor(item: Item | null): string | undefined {
  if (!item) return undefined;
  return spriteUrl(ITEM_BY_KEY.get(`${item.chainId}:${item.level}`)?.id);
}

function formatTime(ms: number): string {
  if (ms <= 0) return 'остыл';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface AppHandle {
  render(): void;
  destroy(): void;
}

export function mountApp(root: HTMLElement, game: Game): AppHandle {
  root.innerHTML = '';
  let selected: number | null = null;
  let popup: HTMLElement | null = null;
  let lastToastAt = 0;
  let prevCoins = Math.floor(game.coins);
  let prevEnergy = Math.floor(game.energy);
  let prevRep = Math.floor(game.reputation);
  let prevDay = game.day();

  /**
   * Размер клетки считаем от реального места, которое есть у доски.
   *
   * Раньше здесь вычитались фиксированные 260px от высоты окна «на заголовки»,
   * и на невысоких экранах доска вместе с генераторами и корзиной не помещалась:
   * её верх уезжал под шапку и обрезался. Теперь берём фактическую высоту
   * контейнера доски и вычитаем высоту того, что лежит под ней (генераторы,
   * корзина, отступы), а сами размеры зажаты рамками — доска всегда целиком
   * видна на экране.
   */
  const cellSize = () => {
    const wrap = root.querySelector('.board-wrap') as HTMLElement | null;
    const isMobile = window.innerWidth <= 900;
    const minSize = isMobile ? 34 : 40;
    const maxSize = isMobile ? 58 : 68;

    // Числа из CSS приходят строками, и там бывает 'normal' или пусто:
    // parseFloat вернул бы NaN, а NaN распространяется на весь расчёт.
    const px = (value: string | undefined, fallback: number): number => {
      const parsed = parseFloat(value ?? '');
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const wrapStyle = wrap ? getComputedStyle(wrap) : null;
    const padX =
      px(wrapStyle?.paddingLeft, 20) + px(wrapStyle?.paddingRight, 20);
    const padY =
      px(wrapStyle?.paddingTop, 20) + px(wrapStyle?.paddingBottom, 20);
    const rowGap = px(wrapStyle?.rowGap, 12);
    const boardStyle = getComputedStyle(board);
    const boardPad = px(boardStyle.paddingLeft, 14) + px(boardStyle.paddingRight, 14);
    const boardPadY = px(boardStyle.paddingTop, 14) + px(boardStyle.paddingBottom, 14);
    const gap = px(boardStyle.gap, 6);

    const width = wrap?.clientWidth ?? Math.min(window.innerWidth - 20, 700);
    const byWidth = Math.floor(
      (width - padX - boardPad - gap * (game.board.cols - 1)) / game.board.cols,
    );

    // Что стоит под доской внутри той же колонки
    const below = generators.offsetHeight + sellZone.offsetHeight + rowGap * 2;
    const availableHeight = Math.max(
      200,
      (wrap?.clientHeight ?? window.innerHeight - 120) - padY - below,
    );
    // Из доступной высоты вычитаем и внутренние отступы доски: без этого
    // доска оказывалась на пару десятков пикселей выше контейнера и её верх
    // обрезался — именно это выглядело как «поле уехало наверх».
    const byHeight = Math.floor(
      (availableHeight - boardPadY - gap * (game.board.rows - 1)) / game.board.rows,
    );

    return Math.max(minSize, Math.min(maxSize, byWidth, byHeight));
  };

  // ------------------------------------------------------------------- HUD
  const hud = el('div', 'hud');
  const title = el('div', 'hud__title', 'Цветочный квартал');
  const quarterButton = el('button', 'button button--small', 'Квартал');
  quarterButton.title = 'Посмотреть, что построено — интерактивная карта';
  const herbariumButton = el('button', 'button button--small', 'Гербарий');
  herbariumButton.title = 'Коллекция открытых видов';
  const decorButton = el('button', 'button button--small', 'Декор');
  decorButton.title = 'Украшения квартала за репутацию';
  const shopButton = el('button', 'button button--small button--icon');
  shopButton.append(img(spriteUrl('ui-shop'), ''), document.createTextNode('Магазин'));
  shopButton.title = 'Магазин улучшений — холодильник, витрина, касса, склад';
  const soundButton = el('button', 'button button--small');
  const refreshSound = () => {
    soundButton.textContent = isMuted() ? 'Звук выкл' : 'Звук вкл';
    soundButton.title = 'Включить или выключить звук';
  };
  soundButton.addEventListener('click', () => {
    unlockAudio();
    toggleMuted();
    refreshSound();
  });
  refreshSound();
  const dayStat = el('div', 'stat');
  const coinsStat = el('div', 'stat');
  const energyStat = el('div', 'stat stat--energy');
  const repStat = el('div', 'stat');
  repStat.title = 'Репутация — за заказы, тратится на декор';
  hud.append(title, dayStat, coinsStat, energyStat, repStat, quarterButton, herbariumButton, decorButton, shopButton, soundButton);

  // ------------------------------------------------------------- панели
  const layout = el('div', 'layout');
  const boardWrap = el('div', 'board-wrap');
  const board = el('div', 'board');
  const generators = el('div', 'generators');
  const sellZone = el('div', 'sell-zone');
  const basketImg = img(spriteUrl('ui-sell-basket'), 'корзина');
  basketImg.className = 'sell-zone__icon-img';
  const sellContent = el('div', 'sell-zone__content');
  sellContent.append(
    el('div', 'sell-zone__text', 'Корзина для продажи'),
    el('div', 'sell-zone__value', 'Перетащи предмет сюда, чтобы продать'),
  );
  sellZone.append(basketImg, sellContent);
  boardWrap.append(board, generators, sellZone);

  const ordersPanel = el('div', 'panel');
  const ordersHead = el('div', 'panel__head');
  const ordersBody = el('div', 'panel__body');
  ordersPanel.append(ordersHead, ordersBody);

  const shopPanel = el('div', 'panel panel--right');
  const shopHead = el('div', 'panel__head', 'Магазин');
  const shopBody = el('div', 'panel__body');
  shopPanel.append(shopHead, shopBody);

  layout.append(ordersPanel, boardWrap, shopPanel);
  const toasts = el('div', 'toasts');
  const fxLayer = el('div', 'fx-layer');
  fxLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45;';
  root.append(hud, layout, toasts, fxLayer);

  // ------------------------------------------------------- анимации: утилиты
  function getCellCenter(index: number): { x: number; y: number } | null {
    const node = cellNodes[index];
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function showRewardFloat(text: string, x: number, y: number, kind: 'coins' | 'energy' = 'coins'): void {
    const node = el('div', `reward-float reward-float--${kind}`, text);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.transform = 'translate(-50%, -50%)';
    fxLayer.append(node);
    setTimeout(() => node.remove(), 1250);
  }

  function createFlyClone(fromIdx: number, toIdx: number, spriteSrc: string | undefined, delayMs = 0): void {
    const from = getCellCenter(fromIdx);
    const to = getCellCenter(toIdx);
    if (!from || !to || !spriteSrc) return;

    const clone = el('div', 'fly-clone');
    clone.style.left = `${from.x}px`;
    clone.style.top = `${from.y}px`;
    clone.style.width = `${cellSize() * 0.9}px`;
    clone.style.height = `${cellSize() * 0.9}px`;
    clone.style.transform = 'translate(-50%, -50%)';

    const image = img(spriteSrc, '');
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'contain';
    clone.append(image);

    // случайный изгиб траектории
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const bend = (Math.random() - 0.5) * Math.min(80, dist * 0.3);

    clone.style.setProperty('--tx', `${dx}px`);
    clone.style.setProperty('--ty', `${dy}px`);
    clone.style.setProperty('--tx1', `${dx * 0.4 + bend}px`);
    clone.style.setProperty('--ty1', `${dy * 0.4 - Math.abs(bend) * 0.5}px`);

    fxLayer.append(clone);

    // запуск с задержкой
    setTimeout(() => {
      clone.style.animation = `fly-to-target 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;
    }, delayMs);

    setTimeout(() => clone.remove(), delayMs + 500);
  }

  function createMergeParticles(x: number, y: number, color = '#E98C9B'): void {
    const count = 8;
    for (let i = 0; i < count; i += 1) {
      const p = el('div', 'merge-particle');
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.background = color;
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 30 + Math.random() * 40;
      p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
      p.style.animationDelay = `${i * 18}ms`;
      fxLayer.append(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  function animateMerge(cluster: number[], targetIdx: number, spriteSrc: string | undefined): void {
    if (cluster.length < 2) return;
    const targetCenter = getCellCenter(targetIdx);
    if (!targetCenter) return;

    // клоны для всех кроме цели
    const others = cluster.filter((i) => i !== targetIdx);
    others.forEach((idx, j) => {
      createFlyClone(idx, targetIdx, spriteSrc, j * 45);
      // исходные клетки сжимаются
      const node = cellNodes[idx];
      if (node) {
        node.classList.add('cell--source-merge');
        setTimeout(() => node.classList.remove('cell--source-merge'), 300);
      }
    });

    // частицы в точке слияния
    setTimeout(() => {
      createMergeParticles(targetCenter.x, targetCenter.y, '#E98C9B');
      // дополнительное свечение цели
      const targetNode = cellNodes[targetIdx];
      if (targetNode) {
        targetNode.classList.add('cell--merging');
        setTimeout(() => targetNode.classList.remove('cell--merging'), 400);
      }
    }, others.length * 45 + 120);
  }

  function bumpStat(node: HTMLElement): void {
    node.classList.remove('stat--updated');
    // force reflow
    void node.offsetWidth;
    node.classList.add('stat--updated');
    setTimeout(() => node.classList.remove('stat--updated'), 450);
  }

  // --------------------------------------------------------------- доска
  const cellNodes: HTMLElement[] = [];
  let draggedIndex: number | null = null;
  let touchClone: HTMLElement | null = null;
  let touchStartPos: { x: number; y: number } | null = null;
  let isDragging = false;

  function showSellZone(item: { level: number } | null): void {
    if (!item) {
      sellZone.classList.remove('sell-zone--visible');
      return;
    }
    const value = game.sellValue(item.level);
    const valueEl = sellZone.querySelector('.sell-zone__value') as HTMLElement;
    if (valueEl) valueEl.textContent = `+${value} монет`;
    sellZone.classList.add('sell-zone--visible');
  }

  function hideSellZone(): void {
    // Корзина остаётся на месте: она часть стола и подсказка, как продавать.
    // Снимаем только акцент «брошено сюда».
    sellZone.classList.remove('sell-zone--active');
    const valueEl = sellZone.querySelector('.sell-zone__value') as HTMLElement;
    if (valueEl) valueEl.textContent = 'Перетащи предмет сюда, чтобы продать';
  }

  function sellItemAt(index: number): void {
    const item = game.board.at(index);
    if (!item) return;
    const value = game.sellValue(item.level);
    const center = getCellCenter(index) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    showRewardFloat(`+${value}`, center.x, center.y, 'coins');
    createMergeParticles(center.x, center.y, '#C89A63');
    game.sellAt(index);
    play('sell');
    selected = null;
    closePopup();
    render();
  }

  // sell-zone drag handlers
  sellZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggedIndex !== null) sellZone.classList.add('sell-zone--active');
  });
  sellZone.addEventListener('dragleave', () => {
    sellZone.classList.remove('sell-zone--active');
  });
  sellZone.addEventListener('drop', (e) => {
    e.preventDefault();
    sellZone.classList.remove('sell-zone--active');
    if (draggedIndex !== null) {
      sellItemAt(draggedIndex);
      draggedIndex = null;
      hideSellZone();
      if (touchClone) { touchClone.remove(); touchClone = null; }
      setTimeout(() => { isDragging = false; }, 100);
    }
  });

  function buildBoard(): void {
    board.innerHTML = '';
    cellNodes.length = 0;
    board.style.gridTemplateColumns = `repeat(${game.board.cols}, var(--cell))`;
    for (let i = 0; i < game.board.cols * game.board.rows; i += 1) {
      const cell = el('div', 'cell');
      cell.dataset.index = String(i);

      // drag & drop мышкой
      cell.draggable = true;
      cell.addEventListener('dragstart', (e) => {
        const item = game.board.at(i);
        if (!item) {
          e.preventDefault();
          return;
        }
        draggedIndex = i;
        isDragging = true;
        cell.classList.add('cell--dragging');
        showSellZone(item);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
          const img = new Image();
          img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          e.dataTransfer.setDragImage(img, 0, 0);
        }
        const src = spriteFor(item);
        if (src) {
          const clone = document.createElement('div');
          clone.className = 'fly-clone';
          clone.style.width = '64px';
          clone.style.height = '64px';
          clone.style.left = '0';
          clone.style.top = '0';
          clone.style.pointerEvents = 'none';
          clone.style.zIndex = '100';
          const image = document.createElement('img');
          image.src = src;
          image.style.width = '100%';
          image.style.height = '100%';
          image.style.objectFit = 'contain';
          clone.append(image);
          document.body.append(clone);
          touchClone = clone;
        }
      });

      cell.addEventListener('dragend', () => {
        cell.classList.remove('cell--dragging');
        cellNodes.forEach((n) => n.classList.remove('cell--drag-over'));
        hideSellZone();
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }
        draggedIndex = null;
        setTimeout(() => {
          isDragging = false;
        }, 100);
      });

      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === i) return;
        if (!game.board.isOpen(i)) return;
        cell.classList.add('cell--drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });

      cell.addEventListener('dragleave', () => {
        cell.classList.remove('cell--drag-over');
      });

      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('cell--drag-over');
        if (draggedIndex === null || draggedIndex === i) return;
        handleMoveOrMerge(draggedIndex, i);
      });

      // pointer drag — работает и мышкой и пальцем, надёжнее HTML5 drag
      cell.addEventListener('pointerdown', (e) => {
        const item = game.board.at(i);
        if (!item) return;
        // только левая кнопка или touch
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        touchStartPos = { x: e.clientX, y: e.clientY };
        // захватываем указатель чтобы получать move даже вне клетки
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
      });

      cell.addEventListener('pointermove', (e) => {
        if (!touchStartPos) return;
        const dx = e.clientX - touchStartPos.x;
        const dy = e.clientY - touchStartPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10 && !isDragging) return;

        if (!isDragging) {
          const item = game.board.at(i);
          if (!item) return;
          isDragging = true;
          draggedIndex = i;
          cell.classList.add('cell--dragging');
          selected = i;
          closePopup();
          renderBoard();
          showSellZone(item);
          const src = spriteFor(item);
          if (src) {
            const clone = document.createElement('div');
            clone.className = 'fly-clone';
            clone.style.width = '64px';
            clone.style.height = '64px';
            clone.style.left = `${e.clientX - 32}px`;
            clone.style.top = `${e.clientY - 32}px`;
            clone.style.pointerEvents = 'none';
            clone.style.zIndex = '100';
            const image = document.createElement('img');
            image.src = src;
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.objectFit = 'contain';
            clone.append(image);
            document.body.append(clone);
            touchClone = clone;
          }
        }

        if (touchClone) {
          touchClone.style.left = `${e.clientX - 32}px`;
          touchClone.style.top = `${e.clientY - 32}px`;
        }

        const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const sellUnder = elUnder?.closest('.sell-zone') as HTMLElement | null;
        const cellUnder = elUnder?.closest('.cell') as HTMLElement | null;
        cellNodes.forEach((n) => n.classList.remove('cell--drag-over'));
        sellZone.classList.remove('sell-zone--active');
        if (sellUnder) {
          sellZone.classList.add('sell-zone--active');
        } else if (cellUnder && cellUnder.dataset.index) {
          const idx = parseInt(cellUnder.dataset.index, 10);
          if (idx !== draggedIndex && game.board.isOpen(idx)) {
            cellUnder.classList.add('cell--drag-over');
          }
        }
      });

      cell.addEventListener('pointerup', (e) => {
        if (!isDragging || draggedIndex === null) {
          touchStartPos = null;
          // если не было драга — это клик, обрабатываем как обычно
          if (!isDragging) {
            onCellClick(i);
          }
          return;
        }
        const elUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const cellUnder = elUnder?.closest('.cell') as HTMLElement | null;
        let targetIdx: number | null = null;
        if (cellUnder && cellUnder.dataset.index) {
          targetIdx = parseInt(cellUnder.dataset.index, 10);
        }

        cellNodes.forEach((n) => {
          n.classList.remove('cell--drag-over');
          n.classList.remove('cell--dragging');
        });
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }

        const elUp = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const sellUp = elUp?.closest('.sell-zone') as HTMLElement | null;
        if (sellUp && draggedIndex !== null) {
          sellItemAt(draggedIndex);
        } else if (targetIdx !== null && targetIdx !== draggedIndex) {
          handleMoveOrMerge(draggedIndex, targetIdx);
        } else {
          selected = null;
          closePopup();
          renderBoard();
        }

        hideSellZone();
        draggedIndex = null;
        touchStartPos = null;
        setTimeout(() => {
          isDragging = false;
        }, 100);
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      });

      cell.addEventListener('pointercancel', () => {
        cellNodes.forEach((n) => {
          n.classList.remove('cell--drag-over');
          n.classList.remove('cell--dragging');
        });
        hideSellZone();
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }
        draggedIndex = null;
        touchStartPos = null;
        isDragging = false;
      });

      // touch drag для мобилы — оставляем как фолбэк
      cell.addEventListener('touchstart', (e) => {
        const item = game.board.at(i);
        if (!item) return;
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
      }, { passive: true });

      cell.addEventListener('touchmove', (e) => {
        if (!touchStartPos) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartPos.x;
        const dy = touch.clientY - touchStartPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12 && !isDragging) return;

        if (!isDragging) {
          const item = game.board.at(i);
          if (!item) return;
          isDragging = true;
          draggedIndex = i;
          cell.classList.add('cell--dragging');
          selected = i;
          closePopup();
          renderBoard();
          showSellZone(item);
          const src = spriteFor(item);
          if (src) {
            const clone = document.createElement('div');
            clone.className = 'fly-clone';
            clone.style.width = '64px';
            clone.style.height = '64px';
            clone.style.left = `${touch.clientX - 32}px`;
            clone.style.top = `${touch.clientY - 32}px`;
            clone.style.pointerEvents = 'none';
            clone.style.zIndex = '100';
            const image = document.createElement('img');
            image.src = src;
            image.style.width = '100%';
            image.style.height = '100%';
            image.style.objectFit = 'contain';
            clone.append(image);
            document.body.append(clone);
            touchClone = clone;
          }
        }

        e.preventDefault();
        if (touchClone) {
          touchClone.style.left = `${touch.clientX - 32}px`;
          touchClone.style.top = `${touch.clientY - 32}px`;
        }

        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
        const cellUnder = elUnder?.closest('.cell') as HTMLElement | null;
        cellNodes.forEach((n) => n.classList.remove('cell--drag-over'));
        if (cellUnder && cellUnder.dataset.index) {
          const idx = parseInt(cellUnder.dataset.index, 10);
          if (idx !== draggedIndex && game.board.isOpen(idx)) {
            cellUnder.classList.add('cell--drag-over');
          }
        }
      }, { passive: false });

      cell.addEventListener('touchend', (e) => {
        if (!isDragging || draggedIndex === null) {
          touchStartPos = null;
          return;
        }
        const touch = e.changedTouches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
        const sellUnder = elUnder?.closest('.sell-zone') as HTMLElement | null;
        const cellUnder = elUnder?.closest('.cell') as HTMLElement | null;
        let targetIdx: number | null = null;
        if (cellUnder && cellUnder.dataset.index) {
          targetIdx = parseInt(cellUnder.dataset.index, 10);
        }

        cellNodes.forEach((n) => {
          n.classList.remove('cell--drag-over');
          n.classList.remove('cell--dragging');
        });
        if (touchClone) {
          touchClone.remove();
          touchClone = null;
        }

        if (sellUnder && draggedIndex !== null) {
          sellItemAt(draggedIndex);
        } else if (targetIdx !== null && targetIdx !== draggedIndex) {
          handleMoveOrMerge(draggedIndex, targetIdx);
        } else {
          selected = null;
          closePopup();
          renderBoard();
        }

        hideSellZone();
        draggedIndex = null;
        touchStartPos = null;
        setTimeout(() => {
          isDragging = false;
        }, 100);
      }, { passive: true });

      board.append(cell);
      cellNodes.push(cell);
    }
  }

  function handleMoveOrMerge(fromIdx: number, toIdx: number): void {
    const fromItem = game.board.at(fromIdx);
    const toItem = game.board.at(toIdx);
    if (!fromItem) return;
    if (!game.board.isOpen(toIdx)) {
      toast('Клетка закрыта', 'warn');
      selected = null;
      closePopup();
      renderBoard();
      return;
    }

    if (!toItem) {
      const fromCenter = getCellCenter(fromIdx);
      const toCenter = getCellCenter(toIdx);
      const src = spriteFor(fromItem);
      if (fromCenter && toCenter && src) {
        createFlyClone(fromIdx, toIdx, src, 0);
      }
      game.board.removeAt(fromIdx);
      game.board.placeAt(toIdx, fromItem);
      selected = null;
      closePopup();
      render();
      setTimeout(() => {
        const node = cellNodes[toIdx];
        if (node) {
          node.classList.add('cell--merging');
          setTimeout(() => node.classList.remove('cell--merging'), 350);
        }
      }, 180);
      return;
    }

    if (itemKey(fromItem) === itemKey(toItem)) {
      const cluster = game.board.cluster(toIdx);
      if (cluster.length < 3) {
        toast(`Рядом только ${cluster.length} — нужно 3 или 5`, 'warn');
        selected = toIdx;
        openPopup(toIdx);
        renderBoard();
        return;
      }
      const before = game.board.at(toIdx);
      const spriteSrc = spriteFor(before);
      const clusterIndices = [...cluster];
      animateMerge(clusterIndices, toIdx, spriteSrc);
      const newLevel = (before?.level ?? 1) + 1;
      if (newLevel >= 7) play('rare', { level: newLevel });
      else play('merge', { level: newLevel });
      game.mergeAt(toIdx);
      selected = null;
      closePopup();
      render();
      tutorial?.onMerge();
      const after = game.board.at(toIdx);
      if (after && before && after.level > before.level) {
        const center = getCellCenter(toIdx);
        if (center && after.level >= 5) {
          showRewardFloat(`Ур. ${after.level}!`, center.x, center.y - 20, 'coins');
          createMergeParticles(center.x, center.y, '#FFD700');
        }
      }
      return;
    }

    selected = toIdx;
    openPopup(toIdx);
    renderBoard();
  }

  function positionPopup(index: number): void {
    if (!popup) return;
    const node = cellNodes[index];
    const rect = node.getBoundingClientRect();
    const isMobile = window.innerWidth <= 900;
    const width = isMobile ? Math.min(160, window.innerWidth - 16) : 150;
    const popupHeight = 130;
    const margin = 8;

    // Центр по горизонтали относительно клетки, с clamp к краям экрана
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.min(window.innerWidth - width - margin, Math.max(margin, left));

    // По вертикали: если сверху мало места (< popupHeight + 20), показываем снизу
    let top: number;
    if (rect.top < popupHeight + 20) {
      top = rect.bottom + 8;
      // если снизу тоже не влезает — центрируем по экрану по вертикали
      if (top + popupHeight > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight / 2 - popupHeight / 2);
      }
    } else {
      top = Math.max(margin, rect.top - popupHeight - 8);
    }

    // На мобиле — если попап близко к низу, поднимаем выше
    if (isMobile && top + popupHeight > window.innerHeight - 60) {
      top = Math.max(margin, window.innerHeight - popupHeight - 70);
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.width = isMobile ? `${width}px` : '';
    popup.style.maxWidth = isMobile ? `${width}px` : '';
  }

  function closePopup(): void {
    popup?.remove();
    popup = null;
  }

  function openPopup(index: number): void {
    closePopup();
    const item = game.board.at(index);
    if (!item) return;
    popup = el('div', 'selection');
    popup.append(img(spriteFor(item), shortName(item)));
    popup.append(el('div', '', shortName(item)));
    const value = game.sellValue(item.level);
    const levelInfo = el('div', '', `Уровень ${item.level} · ${value} монет`);
    levelInfo.style.cssText = 'font-size:11px;opacity:0.8;font-weight:700;';
    popup.append(levelInfo);
    const hint = el('div', '', 'Найди 3 или 5 таких же рядом — они соединятся\nили перетащи предмет в корзину внизу');
    hint.style.cssText = 'font-size:10px;line-height:1.2;white-space:pre-line;text-align:center;opacity:0.85;';
    popup.append(hint);

    // Продажа из карточки: перетаскивание в корзину осталось, но теперь
    // у продажи есть понятная кнопка — игрок видит, что предмет можно сбыть.
    const sell = el('button', 'button button--small button--rose', `Продать · ${value} монет`);
    sell.addEventListener('click', (event) => {
      event.stopPropagation();
      sellItemAt(index);
    });
    popup.append(sell);

    root.append(popup);
    positionPopup(index);
  }

  function onCellClick(index: number): void {
    const item = game.board.at(index);

    if (selected === null) {
      if (!item) return;
      selected = index;
      openPopup(index);
      renderBoard();
      return;
    }

    if (selected === index) {
      selected = null;
      closePopup();
      renderBoard();
      return;
    }

    const current = game.board.at(selected);
    // Перемещение предмета в пустую клетку
    if (!item) {
      if (current) {
        const fromCenter = getCellCenter(selected);
        const toCenter = getCellCenter(index);
        const src = spriteFor(current);
        if (fromCenter && toCenter && src) {
          createFlyClone(selected, index, src, 0);
        }
        game.board.removeAt(selected);
        game.board.placeAt(index, current);
        selected = null;
        closePopup();
        render();
        // анимация появления в цели
        setTimeout(() => {
          const node = cellNodes[index];
          if (node) {
            node.classList.add('cell--merging');
            setTimeout(() => node.classList.remove('cell--merging'), 350);
          }
        }, 180);
      }
      return;
    }

    // Слияние: только одинаковые предметы одной цепочки и уровня
    if (current && itemKey(current) === itemKey(item)) {
      const cluster = game.board.cluster(index);
      if (cluster.length < 3) {
        toast(`Рядом только ${cluster.length} ${cluster.length === 1 ? 'предмет' : 'предмета'} — нужно 3 или 5`, 'warn');
        selected = index;
        openPopup(index);
        renderBoard();
        return;
      }
      const target = index;
      const before = game.board.at(index);
      const spriteSrc = spriteFor(before);
      const clusterIndices = [...cluster];

      // анимация полёта — параллельно логике, не задерживает геймплей
      animateMerge(clusterIndices, target, spriteSrc);
      const newLevel = (before?.level ?? 1) + 1;
      if (newLevel >= 7) {
        play('rare', { level: newLevel });
      } else {
        play('merge', { level: newLevel });
      }

      game.mergeAt(target);
      selected = null;
      closePopup();
      render();
      tutorial?.onMerge();

      // награда за уровень
      const after = game.board.at(target);
      if (after && before && after.level > before.level) {
        const center = getCellCenter(target);
        if (center) {
          const isHighLevel = after.level >= 5;
          if (isHighLevel) {
            showRewardFloat(`Ур. ${after.level}!`, center.x, center.y - 20, 'coins');
            createMergeParticles(center.x, center.y, '#FFD700');
          }
        }
      }

      return;
    }

    selected = index;
    openPopup(index);
    renderBoard();
  }

  // ------------------------------------------------------------ генераторы
  function renderGenerators(): void {
    generators.innerHTML = '';
    const chains = game.unlockedChains();
    for (const chain of chains) {
      const button = el('button', 'gen') as HTMLButtonElement;
      button.append(img(spriteUrl(CHAIN_ICON[chain.id]), chain.name));
      button.append(el('span', 'gen__name', chain.name));
      button.append(el('span', 'gen__cost', `−${game.clickCost} энергии`));
      button.disabled = game.energy < game.clickCost;
      button.addEventListener('click', () => {
        const result = game.generate(chain.id);
        if (!result.ok) {
          play('error');
          button.classList.add('gen--clicked');
          setTimeout(() => button.classList.remove('gen--clicked'), 400);
          render();
          return;
        }
        play('click');
        button.classList.remove('gen--clicked');
        void button.offsetWidth;
        button.classList.add('gen--clicked');
        setTimeout(() => button.classList.remove('gen--clicked'), 450);

        // всплытие -1 энергии
        const rect = button.getBoundingClientRect();
        showRewardFloat(`-1`, rect.left + rect.width / 2, rect.top, 'energy');

        render();
        tutorial?.onGenerate();
        const node = cellNodes[result.index];
        if (node) {
          node.classList.add('cell--merging');
          setTimeout(() => node.classList.remove('cell--merging'), 380);
          const center = getCellCenter(result.index);
          if (center) {
            createMergeParticles(center.x, center.y, '#9DBE9A');
          }
        }
      });
      generators.append(button);
    }
  }

  // -------------------------------------------------------------- динамика
  function renderHud(): void {
    const cap = Math.round(game.effectiveEnergyCap());
    const value = Math.floor(game.energy);
    const coins = Math.floor(game.coins);
    const rep = Math.floor(game.reputation);
    const day = game.day();

    // определяем изменения для анимаций
    const coinsChanged = coins !== prevCoins;
    const energyChanged = value !== prevEnergy;
    const repChanged = rep !== prevRep;
    const dayChanged = day !== prevDay;

    dayStat.textContent = '';
    coinsStat.textContent = '';
    energyStat.textContent = '';
    repStat.textContent = '';

    coinsStat.append(img(spriteUrl('ui-coin'), 'монеты'));
    coinsStat.append(document.createTextNode(String(coins)));

    energyStat.append(img(spriteUrl('ui-energy'), 'энергия'));
    energyStat.append(document.createTextNode(`${value}/${cap}`));
    const bar = el('div', 'stat__bar');
    const fill = el('div', 'stat__fill');
    fill.style.width = `${Math.round((value / cap) * 100)}%`;
    bar.append(fill);
    energyStat.append(bar);

    repStat.append(img(spriteUrl('ui-rep'), 'репутация'));
    repStat.append(document.createTextNode(String(rep)));

    dayStat.append(document.createTextNode(`День ${day}`));

    // low energy индикатор
    energyStat.classList.toggle('stat--low', value < cap * 0.2);

    // bump анимации при изменении
    if (coinsChanged && coins > prevCoins) {
      bumpStat(coinsStat);
      if (coins - prevCoins >= 10) {
        const rect = coinsStat.getBoundingClientRect();
        showRewardFloat(`+${coins - prevCoins}`, rect.left + rect.width / 2, rect.bottom + 4, 'coins');
      }
    }
    if (energyChanged) {
      if (value > prevEnergy) {
        bumpStat(energyStat);
      }
    }
    if (repChanged && rep > prevRep) {
      bumpStat(repStat);
      const rect = repStat.getBoundingClientRect();
      showRewardFloat(`+${rep - prevRep} реп`, rect.left + rect.width / 2, rect.bottom + 4, 'coins');
    }
    if (dayChanged) {
      bumpStat(dayStat);
      if (day > prevDay) {
        toast(`День ${day}! Открылись новые возможности`, 'info');
        // конфетти для нового дня
        const center = { x: window.innerWidth / 2, y: 80 };
        for (let i = 0; i < 12; i++) {
          setTimeout(() => createMergeParticles(center.x + (Math.random() - 0.5) * 100, center.y, ['#E98C9B', '#9DBE9A', '#F7D9A0', '#A99BD4'][i % 4]), i * 60);
        }
      }
    }

    prevCoins = coins;
    prevEnergy = value;
    prevRep = rep;
    prevDay = day;

    const prog = game.herbariumProgress();
    title.title = `Зданий: ${game.buildings().length} · доход ×${game.incomeMultiplier().toFixed(2)} · гербарий ${prog.discovered}/${prog.total} (+${(game.herbariumBonus * 100).toFixed(1)}%) · декор +${(game.decorEffects.incomeBonus * 100).toFixed(0)}%`;
  }

  function renderBoard(): void {
    const size = cellSize();
    board.style.setProperty('--cell', `${size}px`);
    for (let i = 0; i < cellNodes.length; i += 1) {
      const node = cellNodes[i];
      const open = game.board.isOpen(i);
      node.classList.toggle('cell--locked', !open);
      node.classList.toggle('cell--odd', (Math.floor(i / game.board.cols) + (i % game.board.cols)) % 2 === 1);
      node.classList.toggle('cell--selected', selected === i);

      const item = game.board.at(i);
      const wanted = item ? `${item.chainId}:${item.level}` : null;
      const signature = open
        ? wanted
          ? `${wanted}#${ITEM_BY_KEY.get(wanted)?.id ?? ''}`
          : ''
        : 'locked';
      if (node.dataset.signature !== signature) {
        node.innerHTML = '';
        if (!open) {
          node.append(img(spriteUrl('ui-locked'), 'закрыто'));
        } else if (item) {
          node.append(img(spriteFor(item), shortName(item)));
          const def = ITEM_BY_KEY.get(`${item.chainId}:${item.level}`);
          if (def && def.level > 1) node.append(el('span', 'cell__badge', String(def.level)));
        }
        node.dataset.signature = signature;
      }
    }

    if (selected !== null) positionPopup(selected);
  }

  function needRow(order: Order): HTMLElement {
    const wrap = el('div', 'order__needs');
    const want = new Map<string, { item: Item; count: number }>();
    for (const need of order.needs) {
      const key = `${need.chainId}:${need.level}`;
      const entry = want.get(key);
      if (entry) entry.count += 1;
      else want.set(key, { item: { chainId: need.chainId, level: need.level }, count: 1 });
    }
    for (const { item, count } of want.values()) {
      const enough = game.board.countOf(item.chainId, item.level) >= count;
      const tile = el('div', `need${enough ? '' : ' need--short'}`);
      tile.append(img(spriteFor(item), shortName(item)));
      const def = ITEM_BY_KEY.get(`${item.chainId}:${item.level}`);
      tile.append(el('span', '', `${def?.name ?? ''}${count > 1 ? ` ×${count}` : ''}`));
      wrap.append(tile);
    }
    return wrap;
  }

  function renderOrders(): void {
    ordersHead.innerHTML = '';
    ordersHead.append(el('span', '', 'Заказы'));
    const refresh = el('button', 'button button--ghost button--small', 'Обновить · 50');
    refresh.disabled = game.coins < 50;
    refresh.addEventListener('click', () => {
      game.refreshOrders();
      play('click');
      render();
      const rect = refresh.getBoundingClientRect();
      showRewardFloat('-50', rect.left + rect.width / 2, rect.top, 'coins');
    });
    ordersHead.append(refresh);

    ordersBody.innerHTML = '';
    const now = Date.now();

    if (game.needsRelief) {
      const relief = el('div', 'relief');
      relief.append(
        el(
          'div',
          '',
          `Поле заполнено на ${Math.round(game.board.fillRatio() * 100)}%. Перетащи лишнее в корзину или соединяй — иначе некуда будет ставить новые.`,
        ),
      );
      ordersBody.append(relief);
    }

    const buildings = game.buildings();
    if (buildings.length) {
      const line = el('div', 'upgrade__effect');
      const prog = game.herbariumProgress();
      line.textContent = `Зданий: ${buildings.length} · доход ×${game.incomeMultiplier().toFixed(2)} (гербарий +${(game.herbariumBonus * 100).toFixed(0)}%, декор +${(game.decorEffects.incomeBonus * 100).toFixed(0)}%) · гербарий ${prog.discovered}/${prog.total}`;
      ordersBody.append(line);
    }

    for (const order of game.orders) {
      const ready = game.orderAvailable(order);
      const card = el('div', `order${ready ? ' order--ready' : ''}${order.stale ? ' order--stale' : ''}`);
      card.append(needRow(order));
      const foot = el('div', 'order__foot');
      const left = order.deadline - now;
      const info = el('div', '');
      const repReward = game.calcReputationReward(order);
      const rewardLine = el('div', 'order__reward');
      rewardLine.style.display = 'flex';
      rewardLine.style.gap = '8px';
      rewardLine.style.alignItems = 'center';
      rewardLine.append(document.createTextNode(`${order.rewardCoins} монет`));
      const repSpan = el('span', '');
      repSpan.style.cssText = 'display:flex;align-items:center;gap:2px;font-size:11px;opacity:0.9;';
      repSpan.append(img(spriteUrl('ui-rep'), '', ''));
      (repSpan.querySelector('img') as HTMLImageElement).style.width = '14px';
      (repSpan.querySelector('img') as HTMLImageElement).style.height = '14px';
      repSpan.append(document.createTextNode(`+${repReward}`));
      rewardLine.append(repSpan);
      info.append(rewardLine);
      info.append(el('div', 'upgrade__effect', order.stale ? `остыл · ${formatTime(left)}` : formatTime(left)));
      foot.append(info);

      const accept = el('button', 'button', ready ? 'Сдать' : 'Не хватает');
      accept.disabled = !ready;
      accept.addEventListener('click', () => {
        const rect = card.getBoundingClientRect();
        if (game.fulfilOrder(order.id)) {
          play('order');
          tutorial?.onOrder();
          // всплытие награды
          showRewardFloat(`+${order.rewardCoins}`, rect.left + rect.width / 2, rect.top + 20, 'coins');
          setTimeout(() => showRewardFloat(`+${repReward} реп`, rect.left + rect.width / 2 + 30, rect.top + 35, 'coins'), 150);
          createMergeParticles(rect.left + rect.width / 2, rect.top + 20, '#FFD700');
          // анимация сдачи — карточка улетает
          card.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
          card.style.transform = 'translateX(20px) scale(0.9)';
          card.style.opacity = '0';
          setTimeout(() => render(), 280);
        } else {
          render();
        }
      });
      foot.append(accept);
      card.append(foot);
      ordersBody.append(card);
    }
  }

  function renderShop(): void {
    shopBody.innerHTML = '';
    for (const upgrade of BALANCE.upgrades) {
      const level = game.upgradeLevel(upgrade.id);
      const cost = game.nextUpgradeCost(upgrade.id);
      const card = el('div', 'upgrade');
      const head = el('div', 'upgrade__head');
      head.append(el('span', '', upgrade.name));
      head.append(el('span', '', `${level}/${upgrade.max_level}`));
      card.append(head);
      card.append(el('div', 'upgrade__effect', upgrade.effect));
      const row = el('div', 'upgrade__row');
      if (cost === null) {
        row.append(el('span', 'upgrade__effect', 'максимум'));
      } else {
        row.append(el('span', 'order__reward', `${cost} монет`));
        const buy = el('button', 'button button--small', 'Купить');
        buy.disabled = game.coins < cost;
        buy.addEventListener('click', () => {
          const rect = card.getBoundingClientRect();
          if (game.buyUpgrade(upgrade.id)) {
            play('upgrade');
            tutorial?.onShop();
            showRewardFloat(`-${cost}`, rect.left + rect.width / 2, rect.top, 'coins');
            createMergeParticles(rect.left + rect.width / 2, rect.top + 20, '#9DBE9A');
            card.style.animation = 'building-grow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            setTimeout(() => (card.style.animation = ''), 600);
          } else play('error');
          render();
        });
        row.append(buy);
      }
      card.append(row);
      shopBody.append(card);
    }
  }

  function toast(message: string, kind: 'info' | 'warn' = 'info'): void {
    const now = Date.now();
    if (kind === 'warn' && now - lastToastAt < 400) return;
    lastToastAt = now;
    const node = el('div', `toast${kind === 'warn' ? ' toast--warn' : ''}`, message);
    toasts.append(node);
    setTimeout(() => {
      node.classList.add('toast--out');
      setTimeout(() => node.remove(), 320);
    }, 2200);
  }

  function flushEvents(): void {
    if (!game.events.length) return;
    for (const event of game.events) {
      if (event.type === 'blocked') toast(event.message, 'warn');
      else if (event.type === 'stale') toast(event.message, 'warn');
      else if (event.type === 'order') {
        toast(event.message);
        // звук уже сыгран в месте сдачи, но дублируем для внешних событий
      } else if (event.type === 'herbarium') {
        toast(event.message, 'info');
        play('herbarium');
      } else if (event.type === 'reputation') {
        toast(event.message, 'info');
        play('reputation');
      } else if (event.type === 'decor') {
        toast(event.message, 'info');
        play('decor');
      }
    }
    game.events = [];
  }

  function render(): void {
    flushEvents();
    renderHud();
    renderBoard();
    renderGenerators();
    renderOrders();
    renderShop();
  }

  // ------------------------------------------------------------- квартал / гербарий / декор / магазин / туториал
  let quarter: QuarterHandle | null = null;
  let herbarium: HerbariumHandle | null = null;
  let decor: DecorHandle | null = null;
  let shopOverlay: { render(): void; destroy(): void } | null = null;
  let tutorial: TutorialHandle | null = null;

  function closeAllOverlays(): void {
    quarter?.destroy();
    quarter = null;
    herbarium?.destroy();
    herbarium = null;
    decor?.destroy();
    decor = null;
    shopOverlay?.destroy();
    shopOverlay = null;
  }

  function openQuarter(): void {
    if (quarter) return;
    closeAllOverlays();
    play('click');
    tutorial?.onQuarter();
    quarter = mountQuarter(root, game, () => {
      quarter?.destroy();
      quarter = null;
    });
    quarter.render();
  }

  function openHerbarium(): void {
    if (herbarium) return;
    closeAllOverlays();
    play('herbarium');
    herbarium = mountHerbarium(root, game, () => {
      herbarium?.destroy();
      herbarium = null;
    });
    herbarium.render();
  }

  function openDecor(): void {
    if (decor) return;
    closeAllOverlays();
    play('decor');
    decor = mountDecor(
      root,
      game,
      () => {
        decor?.destroy();
        decor = null;
      },
      // «Посмотреть на улице»: закрываем панель и открываем квартал
      () => {
        decor?.destroy();
        decor = null;
        openQuarter();
      },
    );
    decor.render();
  }

  function openShopOverlay(): void {
    if (shopOverlay) return;
    closeAllOverlays();
    play('click');
    // используем тот же стиль что и квартал
    const overlay = document.createElement('div');
    overlay.className = 'quarter';
    const panel = document.createElement('div');
    panel.className = 'quarter__panel';
    panel.style.maxWidth = '1000px';

    const head = document.createElement('div');
    head.className = 'quarter__head';
    const title = document.createElement('div');
    title.className = 'quarter__title';
    title.textContent = 'Магазин улучшений';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'button';
    closeBtn.textContent = 'Вернуться';
    closeBtn.addEventListener('click', () => {
      shopOverlay?.destroy();
      shopOverlay = null;
    });
    head.append(title, closeBtn);

    const hint = document.createElement('div');
    hint.className = 'quarter__hint';
    hint.textContent = 'Улучшай холодильник, витрину, кассу, склад, персонал и оранжерею. Каждое улучшение приближает квартал к процветанию.';

    const body = document.createElement('div');
    body.className = 'quarter__strip';
    body.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';

    panel.append(head, hint, body);
    overlay.append(panel);
    root.append(overlay);

    function renderShopOverlay(): void {
      body.innerHTML = '';
      for (const upgrade of BALANCE.upgrades) {
        const level = game.upgradeLevel(upgrade.id);
        const cost = game.nextUpgradeCost(upgrade.id);
        const card = document.createElement('div');
        card.className = `panel-tile${cost === null ? ' panel-tile--max' : ''}`;

        const name = document.createElement('div');
        name.className = 'panel-tile__name';
        name.textContent = `${upgrade.name} ${level}/${upgrade.max_level}`;

        const effect = document.createElement('div');
        effect.className = 'panel-tile__note';
        effect.textContent = upgrade.effect;

        const row = document.createElement('div');
        row.className = 'upgrade__row';
        row.style.marginTop = '8px';

        if (cost === null) {
          row.append(Object.assign(document.createElement('span'), { className: 'upgrade__effect', textContent: '✓ максимум' }));
        } else {
          const costEl = document.createElement('span');
          costEl.className = 'order__reward';
          costEl.textContent = `${cost} монет`;
          row.append(costEl);
          const buy = document.createElement('button');
          buy.className = 'button button--small';
          buy.textContent = 'Купить';
          (buy as HTMLButtonElement).disabled = game.coins < cost;
          buy.addEventListener('click', () => {
            if (game.buyUpgrade(upgrade.id)) {
              play('upgrade');
              const rect = card.getBoundingClientRect();
              const fx = document.createElement('div');
              fx.className = 'reward-float reward-float--coins';
              fx.textContent = `-${cost}`;
              fx.style.left = `${rect.left + rect.width / 2}px`;
              fx.style.top = `${rect.top}px`;
              fx.style.transform = 'translate(-50%, -50%)';
              document.body.append(fx);
              setTimeout(() => fx.remove(), 1250);
              card.style.animation = 'building-grow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
              setTimeout(() => (card.style.animation = ''), 600);
            } else play('error');
            render();
            renderShopOverlay();
          });
          row.append(buy);
        }

        const lvlBar = document.createElement('div');
        lvlBar.className = 'panel-tile__bar';
        const lvlFill = document.createElement('span');
        lvlFill.style.width = `${(level / upgrade.max_level) * 100}%`;
        lvlBar.append(lvlFill);

        card.append(name, effect, row, lvlBar);
        body.append(card);
      }
    }

    renderShopOverlay();

    shopOverlay = {
      render: renderShopOverlay,
      destroy() {
        overlay.style.animation = 'toast-out 0.25s ease forwards';
        setTimeout(() => overlay.remove(), 250);
      },
    };
  }

  function openTutorial(): void {
    if (tutorial || game.tutorialCompleted) return;
    tutorial = mountTutorial(root, game, () => {
      tutorial?.destroy();
      tutorial = null;
    });
    tutorial.render();
  }

  quarterButton.addEventListener('click', openQuarter);
  herbariumButton.addEventListener('click', openHerbarium);
  decorButton.addEventListener('click', openDecor);
  shopButton.addEventListener('click', openShopOverlay);

  // Звук готовим к работе по первому действию игрока: браузеры не дают
  // запускать аудио раньше, а фонового эмбиента у нас больше нет.
  const unlockOnce = () => unlockAudio();
  root.addEventListener('pointerdown', unlockOnce, { once: true });
  root.addEventListener('click', unlockOnce, { once: true });

  // ------------------------------------------------------------- служебное
  buildBoard();

  // туториал — показываем с задержкой 600ms после старта, если не пройден
  if (!game.tutorialCompleted) {
    setTimeout(() => {
      openTutorial();
    }, 700);
  }

  let resizeTimer: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const relayout = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      renderBoard();
      if (selected !== null && popup) {
        positionPopup(selected);
      }
    }, 60) as unknown as number;
  };
  window.addEventListener('resize', relayout);

  // Доска реагирует и на изменение самого контейнера: панели, скроллбар,
  // поворот экрана и мобильная адресная строка меняют высоту без resize окна.
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => relayout());
    observer.observe(boardWrap);
    resizeObserver = observer;
  }
  // ориентация мобилы
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      renderBoard();
      if (selected !== null && popup) positionPopup(selected);
    }, 300);
  });

  document.addEventListener('click', (event) => {
    if (!popup) return;
    const target = event.target as Node;
    if (popup.contains(target)) return;
    if (cellNodes.some((node) => node.contains(target))) return;
    selected = null;
    closePopup();
    renderBoard();
  });

  // закрытие попапа свайпом на мобиле
  let touchStartY = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0]?.clientY ?? 0;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!popup || selected === null) return;
    const touchEndY = e.changedTouches[0]?.clientY ?? 0;
    const deltaY = Math.abs(touchEndY - touchStartY);
    // если свайп больше 50px — закрываем попап
    if (deltaY > 50) {
      const target = e.target as Node;
      if (popup.contains(target)) return;
      if (cellNodes.some((node) => node.contains(target))) return;
    }
  }, { passive: true });

  return {
    render() {
      render();
      quarter?.render();
      herbarium?.render();
      decor?.render();
      shopOverlay?.render();
      tutorial?.render();
    },
    destroy() {
      window.removeEventListener('resize', relayout);
      resizeObserver?.disconnect();
      quarter?.destroy();
      herbarium?.destroy();
      decor?.destroy();
      shopOverlay?.destroy();
      tutorial?.destroy();
    },
  };
}
