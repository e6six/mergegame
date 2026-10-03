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

/**
 * Сообщение «куплено и уже стоит на улице»: спрайт, название, уровень и
 * переход к кварталу. Без него покупка ощущалась как строчка в списке —
 * игрок не видел, что декор реально появился в мире.
 */
function showPlacedBanner(
  decor: { id: string; name: string; max_level: number },
  level: number,
  onShowQuarter?: () => void,
): void {
  const banner = el('div', 'placed-banner');
  const image = el('img');
  image.src = spriteUrl(DECOR_ICONS[decor.id] ?? 'ui-rep') ?? '';
  image.alt = decor.name;
  banner.append(image);

  const text = el('div', 'placed-banner__text');
  text.append(el('div', 'placed-banner__title', `${decor.name} · уровень ${level}`));
  text.append(el('div', 'placed-banner__note', 'Уже стоит на улице квартала'));
  banner.append(text);

  if (onShowQuarter) {
    const show = el('button', 'button button--small button--rose', 'Посмотреть');
    show.addEventListener('click', () => {
      banner.remove();
      onShowQuarter();
    });
    banner.append(show);
  }

  const close = el('button', 'placed-banner__close', '×');
  close.addEventListener('click', () => banner.remove());
  banner.append(close);

  document.body.append(banner);
  setTimeout(() => banner.remove(), 7000);
}

export function mountDecor(
  root: HTMLElement,
  game: Game,
  onClose: () => void,
  onShowQuarter?: () => void,
): DecorHandle {
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
  hint.textContent =
    'Декор покупается за репутацию. Купленное сразу встаёт на своё место на улице квартала — скамейка у дома, фонарь у лавки, котик там, где ему вздумается лежать.';

  // Переход «купил — посмотрел»: без него декор ощущался списком в меню,
  // а не частью мира.
  if (onShowQuarter) {
    const seeBtn = el('button', 'button button--small button--rose', 'Посмотреть на улице');
    seeBtn.addEventListener('click', onShowQuarter);
    hint.append(document.createTextNode(' '), seeBtn);
  }

  const effects = el('div', 'quarter__hint');
  effects.style.cssText = 'background:#FBF6EC;border:1px solid #9DBE9A;border-radius:10px;padding:8px;font-size:12px;';

  const strip = el('div', 'decor__strip');

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

      const tile = el('div', `panel-tile${isMax ? ' panel-tile--max' : ''}`);

      const iconId = DECOR_ICONS[decor.id] ?? 'ui-rep';
      const image = el('img');
      image.src = spriteUrl(iconId) ?? '';
      image.alt = decor.name;
      if (level === 0) image.style.filter = 'grayscale(0.65) opacity(0.72)';

      tile.append(image);
      tile.append(el('div', 'panel-tile__name', `${decor.name} ${level}/${decor.max_level}`));
      tile.append(el('div', 'panel-tile__note', decor.description));
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

            showPlacedBanner(decor, game.decorLevel(decor.id), onShowQuarter);
          }
          render();
        });
        row.append(buy);
      }

      tile.append(row);

      // прогресс-бар уровня
      const lvlBar = el('div', 'panel-tile__bar');
      const lvlFill = el('span');
      lvlFill.style.width = `${(level / decor.max_level) * 100}%`;
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
