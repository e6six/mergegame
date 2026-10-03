import './style.css';
import { Game, type SerializedGame } from './core/game';
import { load, save, clear } from './core/save';
import { mountApp } from './ui/app';
import { spriteCount } from './ui/sprites';

/**
 * Точка входа. Здесь только сборка: ядро, сейв, интерфейс, игровой цикл
 * и отладочная панель.
 */

const root = document.getElementById('app');
if (!root) throw new Error('Не найден контейнер #app');

const game = new Game();
const saved = load();
if (saved) {
  game.restore(saved);
  // Оффлайн: начисляем энергию и остывание заказов за время отсутствия
  game.tick();
}

const app = mountApp(root, game);

// Игровой цикл: состояние обновляем 4 раза в секунду (энергия, таймеры),
// полный рендер — раз в секунду, чтобы не дёргать DOM зря.
let lastFullRender = 0;
function loop(): void {
  game.tick();
  const now = performance.now();
  if (now - lastFullRender > 1000) {
    lastFullRender = now;
    app.render();
  }
  requestAnimationFrame(loop);
}
app.render();
requestAnimationFrame(loop);

// Автосохранение
const SAVE_INTERVAL = 10_000;
setInterval(() => save(game.serialize()), SAVE_INTERVAL);
window.addEventListener('beforeunload', () => save(game.serialize()));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save(game.serialize());
});

// --------------------------------------------------------- отладочная панель
// Панель с читами нужна только при разработке и проверке баланса. В обычной
// игре её быть не должно: игрок не обязан видеть «+1000 монет» в углу.
// Включается адресом с ?debug=1 — в том числе на площадке, если понадобится.
const devEnabled =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';

if (devEnabled) {
  const dev = document.createElement('div');
  dev.className = 'dev';
  dev.append(
    Object.assign(document.createElement('div'), {
      textContent: `Отладка · спрайтов ${spriteCount}`,
    }),
  );
  const devRow = (label: string, action: () => void) => {
    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      action();
      app.render();
    });
    return button;
  };
  const row1 = document.createElement('div');
  row1.className = 'dev__row';
  row1.append(
    devRow('+1000 монет', () => {
      game.coins += 1000;
    }),
    devRow('+100 энергии', () => {
      game.addEnergy(100);
    }),
    devRow('+100 репутации', () => {
      game.reputation += 100;
    }),
  );
  const row2 = document.createElement('div');
  row2.className = 'dev__row';
  row2.append(
    devRow('+1 день', () => {
      game.startedAt -= 24 * 60 * 60 * 1000;
      game.tick();
    }),
    devRow('Сбросить', () => {
      clear();
      const fresh = new Game();
      game.restore(fresh.serialize());
      game.tick();
    }),
  );
  dev.append(row1, row2);
  root.append(dev);
}

// Экспорт для отладки в консоли и для тестов сценариев
declare global {
  interface Window {
    flowerQuarter?: { game: Game; serialize: () => SerializedGame };
  }
}
window.flowerQuarter = { game, serialize: () => game.serialize() };
