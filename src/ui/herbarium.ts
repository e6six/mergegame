import type { Game } from '../core/game';
import { CHAINS } from '../data/items.generated';
import { ITEM_BY_KEY } from '../data/items.generated';
import { spriteUrl } from './sprites';

export interface HerbariumHandle {
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

export function mountHerbarium(root: HTMLElement, game: Game, onClose: () => void): HerbariumHandle {
  const overlay = el('div', 'quarter');
  overlay.style.background = '#2a2f33';
  const panel = el('div', 'quarter__panel');
  panel.style.maxWidth = '1100px';

  const head = el('div', 'quarter__head');
  head.append(el('div', 'quarter__title', 'Гербарий — коллекция видов'));

  const stats = el('div', 'stat');
  const progress = game.herbariumProgress();
  stats.append(
    Object.assign(el('img'), { src: spriteUrl('ui-rep') ?? '', alt: 'виды' }),
    document.createTextNode(`${progress.discovered}/${progress.total}`),
  );

  const close = el('button', 'button', 'Вернуться');
  close.addEventListener('click', onClose);
  head.append(stats, close);

  const hint = el('div', 'quarter__hint');
  hint.textContent = `Бонус гербария: +${(game.herbariumBonus * 100).toFixed(1)}% к доходу · Закрыто цепочек: ${game.completedChainsCount()}/${CHAINS.length} · Каждый новый вид +0.5%, цепочка +3%, макс +25%`;

  const progressBar = el('div', 'quarter__progress');
  progressBar.style.cssText = 'height:8px;background:#d5d0c4;border-radius:4px;overflow:hidden;margin:8px 0;';
  const progressFill = el('div');
  progressFill.style.cssText = `height:100%;background:linear-gradient(90deg,#9DBE9A,#E98C9B);width:${(progress.discovered / progress.total) * 100}%;transition:width 0.6s ease;`;
  progressBar.append(progressFill);

  const chainsWrap = el('div', 'herbarium__chains');
  chainsWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  panel.append(head, progressBar, hint, chainsWrap);
  overlay.append(panel);
  root.append(overlay);

  function render(): void {
    const prog = game.herbariumProgress();
    progressFill.style.width = `${(prog.discovered / prog.total) * 100}%`;
    stats.lastChild?.remove();
    stats.append(document.createTextNode(`${prog.discovered}/${prog.total}`));
    hint.textContent = `Бонус гербария: +${(game.herbariumBonus * 100).toFixed(1)}% к доходу · Закрыто цепочек: ${game.completedChainsCount()}/${CHAINS.length} · Каждый новый вид +0.5%, цепочка +3%, макс +25%`;

    chainsWrap.innerHTML = '';

    for (const chain of CHAINS) {
      const chainProg = prog.byChain[chain.id];
      const isCompleted = chainProg.discovered >= chainProg.total;
      const chainEl = el('div', `herbarium__chain${isCompleted ? ' herbarium__chain--completed' : ''}`);
      // Используем CSS-классы, inline только для динамики
      chainEl.style.cssText = '';

      const chainHead = el('div', 'herbarium__chain-head');
      chainHead.append(el('span', '', `${chain.name} — ${chainProg.discovered}/${chainProg.total}`));
      const chainBonus = el('span', 'upgrade__effect', isCompleted ? '✓ +3% к доходу' : `${chainProg.discovered * 0.5}%`);
      chainHead.append(chainBonus);
      chainEl.append(chainHead);

      const chainBar = el('div', 'quarter__progress');
      chainBar.style.cssText = 'height:4px;background:#d5d0c4;border-radius:2px;overflow:hidden;';
      const chainFill = el('div');
      chainFill.style.cssText = `height:100%;background:${isCompleted ? '#9DBE9A' : '#C89A63'};width:${(chainProg.discovered / chainProg.total) * 100}%;transition:width 0.4s ease;`;
      chainBar.append(chainFill);
      chainEl.append(chainBar);

      const itemsRow = el('div', 'herbarium__items');
      // grid задаётся через CSS, здесь только gap если нужно

      for (let lvl = 1; lvl <= 10; lvl++) {
        const key = `${chain.id}:${lvl}`;
        const discovered = game.herbarium.has(key);
        const itemDef = ITEM_BY_KEY.get(key);

        const itemEl = el('div', `herbarium__item${discovered ? '' : ' herbarium__item--locked'}`);

        if (discovered && itemDef) {
          const sprite = spriteUrl(itemDef.id);
          itemEl.append(img(sprite, itemDef.name, ''));
          itemEl.append(el('span', '', `${lvl}. ${itemDef.name}`));
        } else {
          itemEl.append(img(spriteUrl('ui-locked'), 'не открыт'));
          itemEl.append(el('span', '', `${lvl}. ???`));
        }

        if (discovered) {
          itemEl.title = itemDef?.name ?? key;
          itemEl.style.cursor = 'pointer';
          itemEl.addEventListener('mouseenter', () => {
            itemEl.style.transform = 'scale(1.05)';
          });
          itemEl.addEventListener('mouseleave', () => {
            itemEl.style.transform = 'scale(1)';
          });
        }

        itemsRow.append(itemEl);
      }

      chainEl.append(itemsRow);
      chainsWrap.append(chainEl);
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
