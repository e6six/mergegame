import { BALANCE } from '../core/balance';
import type { Game } from '../core/game';
import { spriteUrl } from './sprites';

/**
 * Экран квартала: шесть зданий, которые открываются по дням прогресса.
 * Это визуальная мета-прогрессия — «посмотри, что я построил».
 */

export interface QuarterHandle {
  render(): void;
  destroy(): void;
}

const BUILDINGS = [
  { id: 'flowershop', chain: null, day: 1 },
  { id: 'coffee', chain: null, day: 3 },
  { id: 'bakery', chain: null, day: 6 },
  { id: 'workshop', chain: 'pack', day: 10 },
  { id: 'greenhouse', chain: 'exotic', day: 15 },
  { id: 'pavilion', chain: null, day: 21 },
] as const;

const UPGRADE_BY_ID = new Map(BALANCE.upgrades.map((u) => [u.id, u]));

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

export function mountQuarter(root: HTMLElement, game: Game, onClose: () => void): QuarterHandle {
  const overlay = el('div', 'quarter');
  const panel = el('div', 'quarter__panel');

  const head = el('div', 'quarter__head');
  head.append(el('div', 'quarter__title', 'Квартал'));
  const repStat = el('div', 'stat');
  repStat.append(
    Object.assign(el('img'), { src: spriteUrl('ui-rep') ?? '', alt: 'репутация' }),
    document.createTextNode('0'),
  );
  const close = el('button', 'button', 'Вернуться к магазину');
  close.addEventListener('click', onClose);
  head.append(repStat, close);

  const strip = el('div', 'quarter__strip');
  const hint = el('div', 'quarter__hint');
  panel.append(head, strip, hint);
  overlay.append(panel);
  root.append(overlay);

  function render(): void {
    const day = game.day();
    strip.innerHTML = '';
    for (const building of BUILDINGS) {
      const rule = (
        BALANCE.content_schedule as unknown as {
          buildings?: { id: string; unlock_day: number; income_multiplier: number }[];
        }
      ).buildings?.find((b) => b.id === building.id);
      const unlockDay = rule?.unlock_day ?? building.day;
      const open = day >= unlockDay;
      const tile = el('div', `quarter__tile${open ? '' : ' quarter__tile--locked'}`);
      const image = el('img');
      image.src = spriteUrl(`bld-${building.id}`) ?? '';
      image.alt = building.id;
      if (!open) image.style.filter = 'grayscale(0.85) brightness(0.85)';

      const names: Record<string, string> = {
        flowershop: 'Цветочная лавка',
        coffee: 'Кофейня «Ромашка»',
        bakery: 'Пекарня',
        workshop: 'Мастерская декора',
        greenhouse: 'Оранжерея',
        pavilion: 'Павильон на площади',
      };
      const chainNames: Record<string, string> = {
        pack: 'открывает цепочку «Упаковка»',
        exotic: 'открывает цепочку «Экзотика»',
      };

      tile.append(image);
      tile.append(el('div', 'quarter__name', names[building.id] ?? building.id));
      tile.append(
        el(
          'div',
          'quarter__note',
          open
            ? chainNames[building.chain ?? ''] ?? `×${rule?.income_multiplier ?? 1} к доходу`
            : `откроется в день ${unlockDay}`,
        ),
      );
      if (open) tile.append(el('span', 'quarter__badge', '×' + (rule?.income_multiplier ?? 1)));
      strip.append(tile);
    }

    repStat.lastChild?.remove();
    repStat.append(document.createTextNode(String(game.stats.ordersDone)));

    hint.textContent =
      `День ${day} · выполнено заказов: ${game.stats.ordersDone} · ` +
      `множитель дохода ×${game.incomeMultiplier().toFixed(2)} · ` +
      `куплено апгрейдов: ${Object.values(game.levels).reduce((a, b) => a + b, 0)}`;
  }

  return {
    render,
    destroy() {
      overlay.remove();
    },
  };
}

export function upgradeDisplayName(id: string): string {
  return UPGRADE_BY_ID.get(id)?.name ?? id;
}
