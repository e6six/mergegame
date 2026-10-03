import type { Game } from '../core/game';
import { BALANCE } from '../core/balance';
import { spriteUrl } from './sprites';
import { play } from './audio';

export interface DecorHandle {
  render(): void;
  destroy(): void;
}

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

const DECOR_ICONS: Record<string, string> = {
  bench: 'decor-bench',
  lantern: 'decor-lantern',
  flowerbed: 'decor-flowerbed',
  sign: 'decor-sign',
  fountain: 'decor-fountain',
  birdhouse: 'decor-birdhouse',
  windchime: 'decor-windchime',
  gnome: 'decor-gnome',
  butterfly: 'decor-butterfly',
  hammock: 'decor-hammock',
  cat: 'decor-cat',
};

export function mountDecor(root: HTMLElement, game: Game, onClose: () => void): DecorHandle {
  const overlay = el('div', 'quarter');
  overlay.style.background = '#2a2f33';
  const panel = el('div', 'quarter__panel');
  panel.style.maxWidth = '1000px';

  const head = el('div', 'quarter__head');
  head.append(el('div', 'quarter__title', 'Декор квартала'));

  const repStat = el('div', 'stat');
  repStat.append(
    Object.assign(el('img'), { src: spriteUrl('ui-rep') ?? '', alt: 'репутация' }),
    document.createTextNode(String(Math.floor(game.reputation))),
  );

  const close = el('button', 'button', 'Вернуться');
  close.addEventListener('click', onClose);
  head.append(repStat, close);

  const hint = el('div', 'quarter__hint');
  hint.textContent = 'Декор покупается за репутацию и даёт микро-бонусы. Это не обязаловка, а приятные улучшения квартала.';

  const effects = el('div', 'quarter__hint');
  effects.style.cssText = 'background:#FBF6EC;border:1px solid #9DBE9A;border-radius:10px;padding:8px;font-size:12px;';

  const strip = el('div', 'quarter__strip decor__strip');

  panel.append(head, hint, effects, strip);
  overlay.append(panel);
  root.append(overlay);

  function render(): void {
    repStat.lastChild?.remove();
    repStat.append(document.createTextNode(String(Math.floor(game.reputation))));

    const decorEff = game.decorEffects;
    effects.innerHTML = `
      <div><strong>Бонусы декора:</strong></div>
      <div>Доход: +${(decorEff.incomeBonus * 100).toFixed(0)}% · Энергия: +${decorEff.energyBonus} · Редкие: +${(decorEff.rareBonus * 100).toFixed(0)}% · Репутация: +${(decorEff.repBonus * 100).toFixed(0)}% · Пассив: +${(decorEff.passiveBonus * 100).toFixed(0)}%</div>
      <div>Гербарий: +${(game.herbariumBonus * 100).toFixed(1)}% · Всего бонусов: +${((decorEff.incomeBonus + game.herbariumBonus) * 100).toFixed(1)}% к доходу</div>
    `;

    strip.innerHTML = '';
    const decorCfg = (BALANCE as any).decor as any[] | undefined;
    if (!decorCfg) return;

    for (const decor of decorCfg) {
      const level = game.decorLevel(decor.id);
      const cost = game.nextDecorCost(decor.id);
      const isMax = cost === null;

      const tile = el('div', `quarter__tile${isMax ? '' : ''}`);
      tile.style.cssText += ';padding:12px;';
      if (isMax) {
        tile.style.borderColor = '#9DBE9A';
        tile.style.background = 'linear-gradient(135deg,#FBF6EC,#E8F5E9)';
      }

      const iconId = DECOR_ICONS[decor.id] ?? 'ui-rep';
      const image = el('img');
      image.src = spriteUrl(iconId) ?? '';
      image.alt = decor.name;
      image.style.height = '80px';
      if (level === 0) image.style.filter = 'grayscale(0.6) opacity(0.7)';

      tile.append(image);
      tile.append(el('div', 'quarter__name', `${decor.name} ${level}/${decor.max_level}`));
      tile.append(el('div', 'quarter__note', decor.description));
      tile.append(el('div', 'upgrade__effect', decor.effect));

      const row = el('div', 'upgrade__row');
      row.style.marginTop = '8px';
      if (isMax) {
        row.append(el('span', 'upgrade__effect', '✓ максимум'));
      } else {
        const costEl = el('span', 'order__reward', `${cost} репутации`);
        costEl.style.display = 'flex';
        costEl.style.alignItems = 'center';
        costEl.style.gap = '4px';
        const repIcon = img(spriteUrl('ui-rep'), '', '');
        repIcon.style.width = '16px';
        repIcon.style.height = '16px';
        costEl.prepend(repIcon);
        row.append(costEl);

        const buy = el('button', 'button button--small', 'Купить');
        buy.disabled = game.reputation < cost;
        buy.addEventListener('click', () => {
          if (game.buyDecor(decor.id)) {
            play('decor');
            // эффекты
            const rect = tile.getBoundingClientRect();
            const fx = document.createElement('div');
            fx.className = 'reward-float reward-float--coins';
            fx.textContent = `-${cost} реп`;
            fx.style.left = `${rect.left + rect.width / 2}px`;
            fx.style.top = `${rect.top}px`;
            fx.style.transform = 'translate(-50%, -50%)';
            document.body.append(fx);
            setTimeout(() => fx.remove(), 1250);

            tile.style.animation = 'building-grow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            setTimeout(() => (tile.style.animation = ''), 600);
          }
          render();
        });
        row.append(buy);
      }

      tile.append(row);

      // прогресс-бар уровня
      const lvlBar = el('div', 'quarter__progress');
      lvlBar.style.cssText = 'height:4px;background:#d5d0c4;border-radius:2px;overflow:hidden;margin-top:6px;';
      const lvlFill = el('div');
      lvlFill.style.cssText = `height:100%;background:linear-gradient(90deg,#9DBE9A,#7FA37D);width:${(level / decor.max_level) * 100}%;transition:width 0.4s ease;`;
      lvlBar.append(lvlFill);
      tile.append(lvlBar);

      strip.append(tile);
    }
  }

  overlay.style.animation = 'board-appear 0.4s ease';
  panel.style.animation = 'building-grow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';

  return {
    render,
    destroy() {
      overlay.style.animation = 'toast-out 0.25s ease forwards';
      overlay.remove();
    },
  };
}
