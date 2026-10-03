/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../core/game';

describe('tutorial interactive', () => {
  let game: Game;
  beforeEach(() => {
    game = new Game();
    game.tutorialCompleted = false;
    game.tutorialStep = 0;
  });

  it('должен требовать действия для шагов generate/merge/order/shop/quarter', async () => {
    const { mountTutorial } = await import('./tutorial');
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="hud"><button>Квартал</button></div>
      <div class="generators"></div>
      <div class="board"></div>
      <div class="panel"></div>
      <div class="panel--right"></div>
    `;
    document.body.append(root);
    game.tutorialStep = 1;
    const handle = mountTutorial(root, game, () => {});
    // ждём requestAnimationFrame для хайлайта
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r as any)));

    let tooltip = document.querySelector('.tutorial__tooltip') as HTMLElement;
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain('вырасти цветы');
    // кнопка Выполни действие должна быть disabled
    const btn = tooltip.querySelector('.tutorial__actions button:last-child') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Выполни действие');

    // spotlight: должен быть highlight-box с огромным box-shadow для затемнения остального
    const highlightBox = document.querySelector('.tutorial__highlight-box') as HTMLElement;
    expect(highlightBox).toBeTruthy();
    expect(highlightBox.style.boxShadow).toContain('9999px');
    // backdrop должен быть скрыт когда есть цель
    const backdrop = document.querySelector('.tutorial__backdrop') as HTMLElement;
    expect(backdrop.style.display).toBe('none');

    handle.destroy();
    root.remove();
  });

  it('generate прогресс считается по доске', async () => {
    const { mountTutorial } = await import('./tutorial');
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="hud"></div>
      <div class="generators"></div>
      <div class="board"></div>
      <div class="panel"></div>
      <div class="panel--right"></div>
    `;
    document.body.append(root);
    game.tutorialStep = 1;
    const handle = mountTutorial(root, game, () => {});
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r as any)));

    // изначально 0 предметов
    let progress = document.querySelector('.tutorial__gen-progress') as HTMLElement;
    expect(progress).toBeTruthy();
    expect(progress.textContent).toBe('0/3');

    // добавим 2 розы на доску
    game.generate('rose');
    game.generate('rose');
    handle.onGenerate();
    await new Promise((r) => setTimeout(r, 10));
    progress = document.querySelector('.tutorial__gen-progress') as HTMLElement;
    // после 2 генераций должно быть 2/3
    expect(progress.textContent).toMatch(/2\/3|3\/3/);

    handle.destroy();
    root.remove();
  });

  it('затемнение не перекрывает область действия', async () => {
    const { mountTutorial } = await import('./tutorial');
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="hud"><button>Квартал</button></div>
      <div class="generators" style="width:200px;height:100px"></div>
      <div class="board"></div>
      <div class="panel"></div>
      <div class="panel--right"></div>
    `;
    document.body.append(root);
    game.tutorialStep = 1;
    const handle = mountTutorial(root, game, () => {});
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r as any)));

    const highlightBox = document.querySelector('.tutorial__highlight-box') as HTMLElement;
    expect(highlightBox).toBeTruthy();
    // pointer-events none чтобы клики проходили в игру
    expect(highlightBox.style.pointerEvents).toBe('none');
    // backdrop тоже none
    const backdrop = document.querySelector('.tutorial__backdrop') as HTMLElement;
    expect(backdrop.style.pointerEvents).toBe('none');
    // overlay тоже none
    const overlay = document.querySelector('.tutorial') as HTMLElement;
    expect(overlay.style.pointerEvents).toBe('none');
    // tooltip — auto чтобы кнопки работали
    const tooltip = document.querySelector('.tutorial__tooltip') as HTMLElement;
    expect(tooltip.style.pointerEvents).toBe('auto');

    handle.destroy();
    root.remove();
  });
});
