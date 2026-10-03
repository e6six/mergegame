import { BALANCE } from './balance';

/**
 * Поле и правила слияния. Чистая логика без DOM — покрыта тестами
 * (src/core/board.test.ts).
 */

export interface Item {
  /** Ключ вида «роза:2» — цепочка и уровень. */
  chainId: string;
  level: number;
}

export interface Cell {
  item: Item | null;
}

export function itemKey(item: Item): string {
  return `${item.chainId}:${item.level}`;
}

export class Board {
  readonly cols: number;
  readonly rows: number;
  readonly cells: Cell[];
  /** Сколько клеток открыто. Остальные заблокированы (паутина, мусор). */
  openCells: number;

  constructor(cols = BALANCE.board.cols, rows = BALANCE.board.rows, openCells = BALANCE.board.open_at_start) {
    this.cols = cols;
    this.rows = rows;
    this.openCells = openCells;
    this.cells = Array.from({ length: cols * rows }, () => ({ item: null }));
  }

  index(col: number, row: number): number {
    return row * this.cols + col;
  }

  isOpen(index: number): boolean {
    return index >= 0 && index < this.openCells;
  }

  at(index: number): Item | null {
    return this.cells[index]?.item ?? null;
  }

  freeCells(): number {
    let n = 0;
    for (let i = 0; i < this.openCells; i += 1) if (!this.cells[i].item) n += 1;
    return n;
  }

  usedCells(): number {
    return this.openCells - this.freeCells();
  }

  fillRatio(): number {
    return this.openCells === 0 ? 1 : this.usedCells() / this.openCells;
  }

  /** Кладёт предмет в первую свободную клетку. Возвращает индекс или -1. */
  place(item: Item): number {
    for (let i = 0; i < this.openCells; i += 1) {
      if (!this.cells[i].item) {
        this.cells[i].item = item;
        return i;
      }
    }
    return -1;
  }

  placeAt(index: number, item: Item): boolean {
    if (!this.isOpen(index) || this.cells[index].item) return false;
    this.cells[index].item = item;
    return true;
  }

  removeAt(index: number): Item | null {
    if (!this.isOpen(index)) return null;
    const item = this.cells[index].item;
    this.cells[index].item = null;
    return item;
  }

  clear(): void {
    for (const cell of this.cells) cell.item = null;
  }

  /** Все предметы поля (для сейва и подсчётов). */
  entries(): { index: number; item: Item }[] {
    const out: { index: number; item: Item }[] = [];
    for (let i = 0; i < this.openCells; i += 1) {
      const item = this.cells[i].item;
      if (item) out.push({ index: i, item });
    }
    return out;
  }

  countOf(chainId: string, level: number): number {
    let n = 0;
    for (const cell of this.cells) {
      if (cell.item && cell.item.chainId === chainId && cell.item.level === level) n += 1;
    }
    return n;
  }

  /**
   * Связная группа одинаковых предметов, включающая клетку.
   *
   * Именно группа, а не «все такие предметы на поле»: в мердж-играх соединяется
   * то, что стоит рядом. Иначе игрок одним кликом сметал бы предметы из разных
   * углов доски, и пространственная задача исчезла бы.
   */
  cluster(index: number): number[] {
    const start = this.at(index);
    if (!start) return [];
    const seen = new Set<number>([index]);
    const stack = [index];
    const key = itemKey(start);
    while (stack.length) {
      const current = stack.pop() as number;
      const col = current % this.cols;
      const row = Math.floor(current / this.cols);
      const neighbours = [
        col > 0 ? current - 1 : -1,
        col < this.cols - 1 ? current + 1 : -1,
        row > 0 ? current - this.cols : -1,
        row < this.rows - 1 ? current + this.cols : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || seen.has(n) || !this.isOpen(n)) continue;
        const item = this.at(n);
        if (item && itemKey(item) === key) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return [...seen].sort((a, b) => a - b);
  }
}

export interface MergeResult {
  merged: boolean;
  /** Сколько предметов было в группе. */
  consumed: number;
  /** Сколько получилось на выходе. */
  produced: number;
  level: number;
  chainId: string;
  /** Клетка, куда лёг результат. */
  resultIndex: number;
}

/**
 * Слияние группы: 5 → 2, 3 → 1.
 *
 * Порядок правил важен: сначала проверяется пятёрка. Иначе игрок, собрав пять
 * одинаковых предметов, получал бы за них один — и правило «пятёрка даёт два»
 * никогда бы не сработало.
 */
export function mergeCluster(board: Board, index: number): MergeResult {
  const item = board.at(index);
  const empty: MergeResult = {
    merged: false,
    consumed: 0,
    produced: 0,
    level: 0,
    chainId: '',
    resultIndex: -1,
  };
  if (!item) return empty;

  const cluster = board.cluster(index);
  const rule = BALANCE.merge.rules.find((r) => cluster.length >= r.input);
  if (!rule) return empty;
  if (item.level >= BALANCE.merge.max_level) return empty;

  const consumed = cluster.slice(0, rule.input);
  const resultIndex = consumed[0];
  for (const idx of consumed) board.removeAt(idx);

  // Результат кладём в освободившиеся клетки группы. Их ровно rule.input,
  // а выходных предметов не больше — места всегда хватает.
  const result: Item = { chainId: item.chainId, level: item.level + 1 };
  for (let n = 0; n < rule.output; n += 1) {
    const target = consumed[n] ?? resultIndex;
    board.cells[target].item = { ...result };
  }

  return {
    merged: true,
    consumed: rule.input,
    produced: rule.output,
    level: item.level + 1,
    chainId: item.chainId,
    resultIndex,
  };
}
