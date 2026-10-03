import type { Game } from '../core/game';
import { play } from './audio';

export interface TutorialHandle {
  render(): void;
  destroy(): void;
  onGenerate(): void;
  onMerge(): void;
  onOrder(): void;
  onShop(): void;
  onQuarter(): void;
}

interface TutorialStep {
  id: string;
  title: string;
  text: string;
  hint: string; // короткий текст что делать
  getTarget: (root: HTMLElement) => HTMLElement | null;
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right';
  waitFor?: 'generate' | 'merge' | 'order' | 'shop' | 'quarter' | 'click';
  arrow?: boolean;
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

export function mountTutorial(
  root: HTMLElement,
  game: Game,
  onComplete: () => void,
): TutorialHandle {
  const steps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Добро пожаловать!',
      text: 'Это твой цветочный квартал. Здесь ты выращиваешь цветы, соединяешь их в редкие букеты и выполняешь заказы жителей. Давай покажу, как всё устроено — это займёт 60 секунд.',
      hint: 'Нажми «Начать» чтобы пройти обучение',
      getTarget: () => null,
      placement: 'center',
    },
    {
      id: 'generate',
      title: 'Шаг 1 — вырасти цветы',
      text: 'Внизу доски — 3 генератора. Каждый тратит 1 энергию и даёт цветок. Нажми на «Роза» несколько раз, чтобы вырастить 3 одинаковых розы.',
      hint: 'Нажми на генератор «Роза» 3 раза',
      getTarget: (r) => r.querySelector('.generators') as HTMLElement | null,
      placement: 'top',
      waitFor: 'generate',
      arrow: true,
    },
    {
      id: 'merge',
      title: 'Шаг 2 — соедини!',
      text: 'Отлично! У тебя 3 одинаковые розы. Теперь нажми на любую из них — они сольются в одну более редкую. Так работают все цепочки до 10 уровня.',
      hint: 'Нажми на розу на поле, чтобы соединить 3 в 1',
      getTarget: (r) => r.querySelector('.board') as HTMLElement | null,
      placement: 'top',
      waitFor: 'merge',
      arrow: true,
    },
    {
      id: 'order',
      title: 'Шаг 3 — выполни заказ',
      text: 'Слева — заказы жителей. Собери нужные цветы и нажми «Сдать». Первый заказ уже можно выполнить — попробуй!',
      hint: 'Нажми «Сдать» у заказа слева',
      getTarget: (r) => r.querySelector('.panel:not(.panel--right)') as HTMLElement | null,
      placement: 'left',
      waitFor: 'order',
      arrow: true,
    },
    {
      id: 'shop',
      title: 'Шаг 4 — улучшай магазин',
      text: 'Ты заработал монеты! Справа — магазин: можно расширить поле, увеличить энергию и доход. Купи улучшение «Склад» за 900 монет.',
      hint: 'Купи любое улучшение в магазине справа',
      getTarget: (r) => r.querySelector('.panel--right') as HTMLElement | null,
      placement: 'right',
      waitFor: 'shop',
      arrow: true,
    },
    {
      id: 'quarter',
      title: 'Шаг 5 — твой квартал',
      text: 'Нажми «Квартал» вверху — там 6 зданий на фоне улицы. Новые откроются в дни 3, 6, 10, 15, 21. А ещё есть гербарий и декор за репутацию!',
      hint: 'Нажми кнопку «Квартал» в верхней панели',
      getTarget: (r) => {
        const buttons = r.querySelectorAll('.hud .button, .hud button');
        for (const b of Array.from(buttons)) {
          if (b.textContent?.includes('Квартал')) return b as HTMLElement;
        }
        return r.querySelector('.hud') as HTMLElement | null;
      },
      placement: 'bottom',
      waitFor: 'quarter',
      arrow: true,
    },
    {
      id: 'finish',
      title: 'Готово!',
      text: 'Ты освоил основы! Собирай все 50 видов цветов в гербарий, украшай квартал декором и строй репутацию. Удачного цветения!',
      hint: 'Нажми «Играть!»',
      getTarget: () => null,
      placement: 'center',
    },
  ];

  let currentStep = game.tutorialStep;
  let overlay: HTMLElement | null = null;
  let backdrop: HTMLElement | null = null;
  let tooltip: HTMLElement | null = null;
  let highlight: HTMLElement | null = null;
  let arrowEl: HTMLElement | null = null;
  let progressEl: HTMLElement | null = null;
  let actionDone = false;

  if (game.tutorialCompleted) {
    return {
      render() {},
      destroy() {},
      onGenerate() {},
      onMerge() {},
      onOrder() {},
      onShop() {},
      onQuarter() {},
    };
  }

  function createOverlay(): void {
    if (overlay) return;
    overlay = el('div', 'tutorial');
    // полностью не блокирует игру — затемнение визуальное, клики проходят сквозь
    overlay.style.cssText = 'position:fixed;inset:0;z-index:80;pointer-events:none;display:grid;place-items:center;';

    backdrop = el('div', 'tutorial__backdrop');
    // backdrop тоже не блокирует, только визуально затемняет, клики идут в игру
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(42,47,51,0.35);backdrop-filter:blur(1px);pointer-events:none;';

    tooltip = el('div', 'tutorial__tooltip');
    tooltip.style.cssText = `
      position:fixed;z-index:82;max-width:min(440px,92vw);background:#FBF6EC;border:3px solid var(--sage-dark);
      border-radius:18px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;
      box-shadow:0 12px 32px rgba(0,0,0,0.25);animation:building-grow 0.5s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events:auto;
    `;

    overlay.append(backdrop, tooltip);
    root.append(overlay);
  }

  function positionTooltip(target: HTMLElement | null, placement: TutorialStep['placement']): void {
    if (!tooltip) return;
    const isMobile = window.innerWidth <= 900;

    if (!target || placement === 'center') {
      tooltip.style.left = '50%';
      tooltip.style.top = '50%';
      tooltip.style.transform = 'translate(-50%,-50%)';
      tooltip.style.bottom = '';
      tooltip.style.right = '';
      return;
    }

    const rect = target.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const margin = 20;
    const gap = 32;

    // Подсказка не должна заезжать на шапку с монетами и энергией: раньше её
    // прижимало к 20px от верха окна, и текст налезал на счётчики.
    // Если сама цель находится в шапке, запрет не действует.
    const hud = root.querySelector('.hud') as HTMLElement | null;
    const hudBottom = hud && !hud.contains(target) ? hud.getBoundingClientRect().bottom : 0;
    const minTop = Math.max(margin, hudBottom + 8);

    let left = 0;
    let top = 0;

    switch (placement) {
      case 'top':
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        top = rect.top - tipRect.height - margin - gap;
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        top = rect.bottom + margin + gap;
        break;
      case 'left':
        left = rect.left - tipRect.width - margin - gap;
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        break;
      case 'right':
        left = rect.right + margin + gap;
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        break;
    }

    left = Math.max(margin, Math.min(window.innerWidth - tipRect.width - margin, left));
    top = Math.max(isMobile ? Math.max(minTop, 60) : minTop, Math.min(window.innerHeight - tipRect.height - margin - 20, top));

    if (isMobile && (placement === 'left' || placement === 'right')) {
      left = (window.innerWidth - tipRect.width) / 2;
      if (placement === 'left') {
        top = rect.top - tipRect.height - margin - gap;
      } else {
        top = rect.bottom + margin + gap;
      }
      top = Math.max(minTop, Math.min(window.innerHeight - tipRect.height - margin, top));
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'none';
    tooltip.style.right = '';
    tooltip.style.bottom = '';
  }

  let highlightBox: HTMLElement | null = null;

  function highlightTarget(target: HTMLElement | null): void {
    if (highlight) {
      highlight.classList.remove('tutorial__highlight');
      highlight.style.zIndex = '';
      highlight.style.pointerEvents = '';
      highlight = null;
    }
    if (highlightBox) {
      highlightBox.remove();
      highlightBox = null;
    }
    if (arrowEl) {
      arrowEl.remove();
      arrowEl = null;
    }

    if (!target) {
      // нет цели — показываем полное затемнение
      if (backdrop) {
        backdrop.style.display = 'block';
        backdrop.style.background = 'rgba(42,47,51,0.55)';
      }
      return;
    }
    highlight = target;
    target.classList.add('tutorial__highlight');

    // прячем общий backdrop — затемнение будет только через spotlight бокс
    if (backdrop) {
      backdrop.style.display = 'none';
    }

    const rect = target.getBoundingClientRect();
    highlightBox = el('div', 'tutorial__highlight-box');
    // spotlight: прозрачное окно над целью, всё остальное затемнено через огромный box-shadow
    highlightBox.style.cssText = `
      position:fixed;left:${rect.left - 6}px;top:${rect.top - 6}px;
      width:${rect.width + 12}px;height:${rect.height + 12}px;
      border:3px solid #E98C9B;border-radius:14px;
      background:transparent;
      box-shadow:
        0 0 0 6px rgba(233,140,155,0.25),
        0 0 20px rgba(233,140,155,0.4),
        0 0 0 9999px rgba(42,47,51,0.55);
      z-index:81;pointer-events:none;
      animation:tutorial-pulse 1.2s ease-in-out infinite alternate;
    `;
    document.body.append(highlightBox);

    const step = steps[currentStep];
    if (step.arrow) {
      arrowEl = el('div', 'tutorial__arrow');
      arrowEl.textContent = step.placement === 'top' ? '↓' : step.placement === 'bottom' ? '↑' : step.placement === 'left' ? '→' : step.placement === 'right' ? '←' : '↓';
      arrowEl.style.cssText = `
        position:fixed;z-index:83;font-size:32px;font-weight:900;color:#E98C9B;
        text-shadow:0 2px 8px rgba(0,0,0,0.3);animation:tutorial-bounce 0.8s ease-in-out infinite alternate;
        pointer-events:none;
      `;
      let aLeft = 0;
      let aTop = 0;
      switch (step.placement) {
        case 'top':
          aLeft = rect.left + rect.width / 2 - 16;
          aTop = rect.top - 48;
          break;
        case 'bottom':
          aLeft = rect.left + rect.width / 2 - 16;
          aTop = rect.bottom + 14;
          break;
        case 'left':
          aLeft = rect.left - 44;
          aTop = rect.top + rect.height / 2 - 16;
          break;
        case 'right':
          aLeft = rect.right + 16;
          aTop = rect.top + rect.height / 2 - 16;
          break;
        default:
          aLeft = rect.left + rect.width / 2 - 16;
          aTop = rect.top - 48;
      }
      arrowEl.style.left = `${aLeft}px`;
      arrowEl.style.top = `${aTop}px`;
      document.body.append(arrowEl);
    }
  }

  function getGenerateProgress(): { done: number; total: number; ready: boolean } {
    // считаем сколько роз на поле + инвентаре
    const entries = game.board.entries().filter((e) => e.item);
    // ищем любой тип с >=3
    const inv = game.inventory();
    let maxCount = 0;
    for (const c of inv.values()) {
      if (c > maxCount) maxCount = c;
    }
    // также считаем на доске по типу
    const boardCounts = new Map<string, number>();
    for (const e of game.board.entries()) {
      if (!e.item) continue;
      const key = `${e.item.chainId}:${e.item.level}`;
      boardCounts.set(key, (boardCounts.get(key) ?? 0) + 1);
    }
    for (const c of boardCounts.values()) {
      if (c > maxCount) maxCount = c;
    }
    const totalItems = entries.length;
    // для первого шага нужно 3 предмета любого одного типа
    return { done: Math.min(maxCount, 3), total: 3, ready: maxCount >= 3 || totalItems >= 3 };
  }

  function render(): void {
    if (game.tutorialCompleted) {
      destroy();
      return;
    }

    if (currentStep >= steps.length) {
      complete();
      return;
    }

    const step = steps[currentStep];
    if (!step) {
      complete();
      return;
    }

    createOverlay();
    if (!tooltip || !overlay) return;

    tooltip.innerHTML = '';
    const titleEl = el('div', 'tutorial__title', step.title);
    titleEl.style.cssText = 'font-size:18px;font-weight:800;line-height:1.2;';
    const textEl = el('div', 'tutorial__text', step.text);
    textEl.style.cssText = 'font-size:14px;line-height:1.4;opacity:0.9;';

    const hintEl = el('div', 'tutorial__hint');
    hintEl.style.cssText = 'background:#E8F5E9;border:2px dashed var(--sage);border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;color:#2a4a2a;display:flex;align-items:center;gap:6px;';
    // Без эмодзи: подсказку помечаем цветом и границей, а не картинкой-рукой
    hintEl.append(el('span', 'tutorial__hint-mark', '→'), el('span', '', step.hint));

    const foot = el('div', 'tutorial__foot');
    foot.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;';

    const progress = el('div', 'tutorial__progress', `${currentStep + 1}/${steps.length}`);
    progress.style.cssText = 'font-size:12px;opacity:0.6;font-weight:700;';

    // прогресс для generate
    if (step.waitFor === 'generate') {
      const p = getGenerateProgress();
      progressEl = el('div', 'tutorial__gen-progress');
      progressEl.style.cssText = 'font-size:11px;font-weight:800;color:var(--sage-dark);background:#fff;border-radius:999px;padding:2px 8px;border:1px solid var(--sage);';
      progressEl.textContent = `${p.done}/${p.total}`;
      if (p.ready) {
        progressEl.style.background = '#9DBE9A';
        progressEl.style.color = '#fff';
      }
    } else {
      progressEl = null;
    }

    const actions = el('div', 'tutorial__actions');
    actions.style.cssText = 'display:flex;gap:8px;margin-left:auto;';

    const skipBtn = el('button', 'button button--ghost button--small', 'Пропустить');
    skipBtn.addEventListener('click', () => {
      complete();
    });

    const nextBtn = el('button', 'button button--small', currentStep === 0 ? 'Начать →' : currentStep === steps.length - 1 ? 'Играть!' : 'Дальше →') as HTMLButtonElement;

    if (step.waitFor) {
      if (actionDone) {
        nextBtn.textContent = 'Отлично! Дальше →';
        nextBtn.style.background = 'var(--sage)';
        nextBtn.style.borderColor = 'var(--sage-dark)';
        nextBtn.disabled = false;
        hintEl.style.background = '#D4EDDA';
        hintEl.style.borderColor = '#7FA37D';
        hintEl.textContent = '';
        hintEl.append(el('span', 'tutorial__hint-mark', '✓'), el('span', '', 'Готово! Нажми «Дальше»'));
      } else {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.4';
        nextBtn.style.pointerEvents = 'none';
        nextBtn.textContent = 'Выполни действие →';
      }
    }

    nextBtn.addEventListener('click', () => {
      if (step.waitFor && !actionDone) return;
      next();
    });

    actions.append(skipBtn, nextBtn);
    foot.append(progress);
    if (progressEl) foot.append(progressEl);
    foot.append(actions);

    tooltip.append(titleEl, textEl, hintEl, foot);

    requestAnimationFrame(() => {
      const target = step.getTarget(root);
      highlightTarget(target);
      requestAnimationFrame(() => {
        positionTooltip(target, step.placement);
      });
    });

    game.tutorialStep = currentStep;
  }

  function next(): void {
    play('tutorial');
    actionDone = false;
    currentStep += 1;
    game.tutorialStep = currentStep;
    if (currentStep >= steps.length) {
      complete();
    } else {
      render();
    }
  }

  function complete(): void {
    play('building');
    game.tutorialCompleted = true;
    game.tutorialStep = steps.length;
    destroy();
    onComplete();
  }

  function destroy(): void {
    if (highlight) {
      highlight.classList.remove('tutorial__highlight');
      highlight = null;
    }
    if (highlightBox) {
      highlightBox.remove();
      highlightBox = null;
    }
    if (arrowEl) {
      arrowEl.remove();
      arrowEl = null;
    }
    overlay?.remove();
    overlay = null;
    tooltip = null;
    backdrop = null;
    progressEl = null;
  }

  function markDoneAndNext(delay = 700): void {
    if (actionDone) return;
    actionDone = true;
    play('merge');
    render();
    setTimeout(() => {
      if (actionDone) next();
    }, delay);
  }

  function onGenerate(): void {
    if (game.tutorialCompleted) return;
    const step = steps[currentStep];
    if (step?.waitFor === 'generate') {
      const p = getGenerateProgress();
      if (progressEl) {
        progressEl.textContent = `${p.done}/${p.total}`;
        if (p.ready) {
          progressEl.style.background = '#9DBE9A';
          progressEl.style.color = '#fff';
        }
      }
      if (p.ready) {
        markDoneAndNext(800);
      } else {
        render();
      }
    }
  }

  function onMerge(): void {
    if (game.tutorialCompleted) return;
    const step = steps[currentStep];
    if (step?.waitFor === 'merge') {
      markDoneAndNext(600);
    }
  }

  function onOrder(): void {
    if (game.tutorialCompleted) return;
    const step = steps[currentStep];
    if (step?.waitFor === 'order') {
      markDoneAndNext(600);
    }
  }

  function onShop(): void {
    if (game.tutorialCompleted) return;
    const step = steps[currentStep];
    if (step?.waitFor === 'shop') {
      markDoneAndNext(600);
    }
  }

  function onQuarter(): void {
    if (game.tutorialCompleted) return;
    const step = steps[currentStep];
    if (step?.waitFor === 'quarter') {
      markDoneAndNext(500);
    }
  }

  render();

  const onResize = () => {
    if (!overlay) return;
    const step = steps[currentStep];
    if (!step) return;
    const target = step.getTarget(root);
    positionTooltip(target, step.placement);
    if (target && highlightBox) {
      const rect = target.getBoundingClientRect();
      highlightBox.style.left = `${rect.left - 6}px`;
      highlightBox.style.top = `${rect.top - 6}px`;
      highlightBox.style.width = `${rect.width + 12}px`;
      highlightBox.style.height = `${rect.height + 12}px`;
    }
    if (highlight && target && arrowEl) {
      const rect = target.getBoundingClientRect();
      let aLeft = 0;
      let aTop = 0;
      switch (step.placement) {
        case 'top':
          aLeft = rect.left + rect.width / 2 - 16;
          aTop = rect.top - 52;
          break;
        case 'bottom':
          aLeft = rect.left + rect.width / 2 - 16;
          aTop = rect.bottom + 18;
          break;
        case 'left':
          aLeft = rect.left - 48;
          aTop = rect.top + rect.height / 2 - 16;
          break;
        case 'right':
          aLeft = rect.right + 20;
          aTop = rect.top + rect.height / 2 - 16;
          break;
        default:
          aLeft = rect.left + rect.width / 2 - 16;
          aTop = rect.top - 52;
      }
      arrowEl.style.left = `${aLeft}px`;
      arrowEl.style.top = `${aTop}px`;
    }
  };
  window.addEventListener('resize', onResize);

  return {
    render,
    destroy() {
      window.removeEventListener('resize', onResize);
      destroy();
    },
    onGenerate,
    onMerge,
    onOrder,
    onShop,
    onQuarter,
  };
}
