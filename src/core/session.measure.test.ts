import { describe, it } from 'vitest';
import { playSession } from './player-model';

/**
 * Замер реального темпа игры — не проверка, а измерительный прибор.
 *
 * По умолчанию тест пропускается, чтобы не тормозить `npm test`. Запуск:
 *
 *   MEASURE=1 npx vitest run src/core/session.measure.test.ts
 *
 * Зачем: питоновский симулятор (tools/simulate.py) считает предметы по всему
 * полю разом и потому переоценивает прогресс — он не знает, что мерджить можно
 * только связную группу и что генератор кладёт предмет в первую свободную
 * клетку. Здесь партия проходится настоящим кодом игры, и видно, сколько
 * заказов игрок закрывает за сессию на самом деле.
 */
// process берём через globalThis: @types/node в проект не ставится намеренно,
// а окружение vitest переменные окружения отдаёт.
const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
const enabled = env?.MEASURE === '1';
const seeds = Array.from({ length: 24 }, (_, i) => i + 1);

describe.skipIf(!enabled)('замер реального темпа', () => {
  it('24 сессии по 10 минут', () => {
    let orders = 0;
    let clicks = 0;
    let worst = Infinity;
    let best = 0;

    for (const seed of seeds) {
      const result = playSession(seed, 10);
      orders += result.game.stats.ordersDone;
      clicks += result.clicks;
      worst = Math.min(worst, result.game.stats.ordersDone);
      best = Math.max(best, result.game.stats.ordersDone);
      console.log(
        `сид ${String(seed).padStart(2)}: заказов ${result.game.stats.ordersDone}, ` +
          `кликов ${result.clicks}, мерджей ${result.game.stats.merges}, ` +
          `монет ${result.game.coins}, поле ${result.game.board.usedCells()}/${result.game.board.openCells}, ` +
          `гербарий ${result.game.herbariumProgress().discovered}`,
      );
    }

    const perSession = orders / seeds.length;
    console.log(
      `\nИтог: заказов за сессию в среднем ${perSession.toFixed(2)} ` +
        `(мин ${worst}, макс ${best}), кликов за сессию ${(clicks / seeds.length).toFixed(0)}`,
    );
    console.log('Для сравнения: tools/simulate.py обещает 4.86 заказа за сессию — он считает без геометрии поля.');
  }, 600_000);
});
