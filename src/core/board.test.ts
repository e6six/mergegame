import { describe, expect, it } from 'vitest';
import { Board, itemKey, mergeCluster } from './board';

function put(board: Board, indexes: number[], item: { chainId: string; level: number }): void {
  for (const i of indexes) board.cells[i].item = { ...item };
}

describe('поле', () => {
  it('кладёт предмет в первую свободную клетку и считает занятость', () => {
    const board = new Board();
    board.openCells = 4;
    expect(board.place({ chainId: 'rose', level: 1 })).toBe(0);
    expect(board.place({ chainId: 'rose', level: 1 })).toBe(1);
    expect(board.usedCells()).toBe(2);
    expect(board.freeCells()).toBe(2);
    expect(board.fillRatio()).toBeCloseTo(0.5);
  });

  it('не кладёт предмет за пределы открытых клеток', () => {
    const board = new Board();
    board.openCells = 2;
    board.place({ chainId: 'rose', level: 1 });
    board.place({ chainId: 'rose', level: 1 });
    expect(board.place({ chainId: 'rose', level: 1 })).toBe(-1);
  });

  it('считает связную группу только по соседям, а не по всему полю', () => {
    const board = new Board();
    board.openCells = 12;
    // 0,1 — соседи по горизонтали; 8 (ряд 1, столбец 2) не сосед ни одному из них
    put(board, [0, 1, 8], { chainId: 'rose', level: 2 });
    expect(board.cluster(0)).toEqual([0, 1]);
    expect(board.cluster(8)).toEqual([8]);
  });

  it('объединяет группу через промежуточные клетки', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1, 2, 3], { chainId: 'wild', level: 1 });
    expect(board.cluster(0)).toHaveLength(4);
  });

  it('не смешивает разные уровни и цепочки в одну группу', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1], { chainId: 'rose', level: 1 });
    put(board, [2], { chainId: 'rose', level: 2 });
    put(board, [3], { chainId: 'wild', level: 1 });
    expect(board.cluster(0)).toEqual([0, 1]);
    expect(board.cluster(2)).toEqual([2]);
  });
});

describe('слияние', () => {
  it('3 → 1: три предмета дают один уровнем выше', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1, 2], { chainId: 'rose', level: 1 });

    const result = mergeCluster(board, 0);

    expect(result.merged).toBe(true);
    expect(result.consumed).toBe(3);
    expect(result.produced).toBe(1);
    expect(result.level).toBe(2);
    expect(board.countOf('rose', 2)).toBe(1);
    expect(board.countOf('rose', 1)).toBe(0);
  });

  it('5 → 2: правило пятёрки проверяется раньше тройки', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1, 2, 3, 4], { chainId: 'rose', level: 2 });

    const result = mergeCluster(board, 0);

    expect(result.consumed).toBe(5);
    expect(result.produced).toBe(2);
    expect(board.countOf('rose', 3)).toBe(2);
    // Пятый предмет не остаётся на поле обрубком первого уровня
    expect(board.countOf('rose', 2)).toBe(0);
  });

  it('не сливает два предмета', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1], { chainId: 'rose', level: 1 });
    expect(mergeCluster(board, 0).merged).toBe(false);
    expect(board.countOf('rose', 1)).toBe(2);
  });

  it('сливает группу целиком, даже если рядом больше пяти', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1, 2, 3, 4, 5], { chainId: 'rose', level: 1 });

    const result = mergeCluster(board, 0);

    expect(result.consumed).toBe(5);
    expect(board.countOf('rose', 2)).toBe(2);
    expect(board.countOf('rose', 1)).toBe(1);
  });

  it('не поднимает предмет выше максимального уровня', () => {
    const board = new Board();
    board.openCells = 12;
    put(board, [0, 1, 2], { chainId: 'rose', level: 10 });
    expect(mergeCluster(board, 0).merged).toBe(false);
  });

  it('ключ предмета — это цепочка и уровень', () => {
    expect(itemKey({ chainId: 'rose', level: 3 })).toBe('rose:3');
  });
});
