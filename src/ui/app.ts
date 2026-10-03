import { BALANCE } from '../core/balance';
import { itemKey, type Item } from '../core/board';
import { Game } from '../core/game';
import type { Order } from '../core/orders';
import { ITEM_BY_KEY } from '../data/items.generated';
import { isMuted, play, toggleMuted, unlockAudio } from './audio';
import { spriteUrl } from './sprites';
import { mountQuarter, type QuarterHandle } from './quarter';

/**
 * Интерфейс: доска, заказы, магазин, генераторы.
 *
 * Рендер — обычный DOM, а не WebGL. Причины: спрайты это PNG, сетка статична,
 * а DOM даёт бесплатную поддержку тач-событий, масштабирования и доступности.
 * Плюс бандл остаётся лёгким, что критично для загрузки в iframe площадки.
 * Если позже понадобятся частицы и сложные эффекты — рендер можно заменить,
 * логика в src/core от него не зависит.
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
  const cellSize = () => {
    const wrap = root.querySelector('.board-wrap') as HTMLElement | null;
    const width = wrap?.clientWidth ?? 700;
    const gutter = 20;
    const byWidth = Math.floor((width - gutter) / game.board.cols);
    const byHeight = Math.floor((window.innerHeight - 260) / game.board.rows);
    return Math.max(44, Math.min(76, byWidth, byHeight));
  };

  // ------------------------------------------------------------------- HUD
  const hud = el('div', 'hud');
  const title = el('div', 'hud__title', 'Цветочный квартал');
  const quarterButton = el('button', 'button button--small', 'Квартал');
  quarterButton.title = 'Посмотреть, что построено';
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
  hud.append(title, dayStat, coinsStat, energyStat, quarterButton, soundButton);

  // ------------------------------------------------------------- панели
  const layout = el('div', 'layout');
  const boardWrap = el('div', 'board-wrap');
  const board = el('div', 'board');
  const generators = el('div', 'generators');
  boardWrap.append(board, generators);

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
  root.append(hud, layout, toasts);

  // --------------------------------------------------------------- доска
  const cellNodes: HTMLElement[] = [];
  function buildBoard(): void {
    board.innerHTML = '';
    cellNodes.length = 0;
    board.style.gridTemplateColumns = `repeat(${game.board.cols}, var(--cell))`;
    for (let i = 0; i < game.board.cols * game.board.rows; i += 1) {
      const cell = el('div', 'cell');
      cell.addEventListener('click', () => onCellClick(i));
      board.append(cell);
      cellNodes.push(cell);
    }
  }

  function positionPopup(index: number): void {
    if (!popup) return;
    const node = cellNodes[index];
    const rect = node.getBoundingClientRect();
    const width = 150;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + rect.width / 2 - width / 2));
    const top = Math.max(8, rect.top - 118);
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
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
    const sell = el('button', 'button button--small button--rose', `Продать · ${value} монет`);
    sell.addEventListener('click', (event) => {
      event.stopPropagation();
      game.sellAt(index);
      play('coin');
      selected = null;
      closePopup();
      render();
    });
    popup.append(sell);
    popup.append(el('div', '', 'Найди 3 или 5 таких же рядом, чтобы соединить'));
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
        game.board.removeAt(selected);
        game.board.placeAt(index, current);
        selected = null;
        closePopup();
        render();
      }
      return;
    }

    // Слияние: только одинаковые предметы одной цепочки и уровня
    if (current && itemKey(current) === itemKey(item)) {
      const cluster = game.board.cluster(index).length;
      if (cluster < 3) {
        toast(`Рядом только ${cluster} ${cluster === 1 ? 'предмет' : 'предмета'} — нужно 3 или 5`, 'warn');
        selected = index;
        openPopup(index);
        renderBoard();
        return;
      }
      const target = index;
      const before = game.board.at(index);
      game.mergeAt(target);
      play('merge', { level: (before?.level ?? 1) + 1 });
      selected = null;
      closePopup();
      render();
      const after = game.board.at(target);
      if (before && after && after.level > before.level) {
        const node = cellNodes[target];
        node.classList.add('cell--merging');
        setTimeout(() => node.classList.remove('cell--merging'), 260);
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
          render();
          return;
        }
        play('click');
        render();
        const node = cellNodes[result.index];
        if (node) {
          node.classList.add('cell--merging');
          setTimeout(() => node.classList.remove('cell--merging'), 260);
        }
      });
      generators.append(button);
    }
  }

  // -------------------------------------------------------------- динамика
  function renderHud(): void {
    dayStat.textContent = '';
    coinsStat.textContent = '';
    energyStat.textContent = '';

    const cap = Math.round(game.effects.energyCap);
    const value = Math.floor(game.energy);

    coinsStat.append(img(spriteUrl('ui-coin'), 'монеты'));
    coinsStat.append(document.createTextNode(String(Math.floor(game.coins))));

    energyStat.append(el('span', 'stat__dot', '☘'));
    energyStat.append(document.createTextNode(`${value}/${cap}`));
    const bar = el('div', 'stat__bar');
    const fill = el('div', 'stat__fill');
    fill.style.width = `${Math.round((value / cap) * 100)}%`;
    bar.append(fill);
    energyStat.append(bar);

    dayStat.append(document.createTextNode(`День ${game.day()}`));

    title.title = `Зданий: ${game.buildings().length} · множитель дохода ×${game.incomeMultiplier().toFixed(2)}`;
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
      // Клетка в подписи обязана учитывать признак «закрыто»: иначе после
      // расширения склада метка замка осталась бы на уже открытой клетке.
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
      render();
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
          `Поле заполнено на ${Math.round(game.board.fillRatio() * 100)}%. Продавай лишнее (клик по предмету) или соединяй — иначе некуда будет ставить новые.`,
        ),
      );
      ordersBody.append(relief);
    }

    const buildings = game.buildings();
    if (buildings.length) {
      const line = el('div', 'upgrade__effect');
      line.textContent = `Зданий: ${buildings.length} · множитель дохода ×${game.incomeMultiplier().toFixed(2)}`;
      ordersBody.append(line);
    }

    for (const order of game.orders) {
      const ready = game.orderAvailable(order);
      const card = el('div', `order${ready ? ' order--ready' : ''}${order.stale ? ' order--stale' : ''}`);
      card.append(needRow(order));
      const foot = el('div', 'order__foot');
      const left = order.deadline - now;
      const info = el('div', '');
      info.append(el('div', 'order__reward', `${order.rewardCoins} монет`));
      info.append(el('div', 'upgrade__effect', order.stale ? `остыл · ${formatTime(left)}` : formatTime(left)));
      foot.append(info);

      const accept = el('button', 'button', ready ? 'Сдать' : 'Не хватает');
      accept.disabled = !ready;
      accept.addEventListener('click', () => {
        if (game.fulfilOrder(order.id)) play('order');
        render();
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
          if (game.buyUpgrade(upgrade.id)) play('upgrade');
          else play('error');
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
    setTimeout(() => node.remove(), 1800);
  }

  function flushEvents(): void {
    if (!game.events.length) return;
    for (const event of game.events) {
      if (event.type === 'blocked') toast(event.message, 'warn');
      else if (event.type === 'stale') toast(event.message, 'warn');
      else if (event.type === 'order') toast(event.message);
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

  // ------------------------------------------------------------- квартал
  let quarter: QuarterHandle | null = null;
  function openQuarter(): void {
    if (quarter) return;
    quarter = mountQuarter(root, game, () => {
      quarter?.destroy();
      quarter = null;
    });
    quarter.render();
  }
  quarterButton.addEventListener('click', openQuarter);

  // ------------------------------------------------------------- служебное
  buildBoard();

  const onResize = () => renderBoard();
  window.addEventListener('resize', onResize);
  document.addEventListener('click', (event) => {
    if (!popup) return;
    const target = event.target as Node;
    if (popup.contains(target)) return;
    if (cellNodes.some((node) => node.contains(target))) return;
    selected = null;
    closePopup();
    renderBoard();
  });

  return {
    render() {
      render();
      quarter?.render();
    },
    destroy() {
      window.removeEventListener('resize', onResize);
      quarter?.destroy();
    },
  };
}
