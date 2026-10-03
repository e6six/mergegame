import { BALANCE } from '../core/balance';
import type { Game } from '../core/game';
import { spriteUrl } from './sprites';
import stageUrl from '../../art/backgrounds/stage-quarter.jpg?url';

/**
 * Экран квартала — вид на улицу, где живёт купленный декор.
 *
 * Почему canvas, а не DOM: фон — одна большая картинка улицы (1536×1024), а
 * поверх неё в конкретных местах ставятся спрайты. Canvas масштабирует всё
 * вместе, поэтому декор всегда совпадает с местом на улице, будь то телефон
 * или широкий монитор. DOM-вёрстка на процентах такой точности не даёт и
 * расползается при смене размера окна.
 *
 * Здания открываются по дням и рисуются прямо на фоне, а купленный декор
 * встаёт на свои места: скамейка — на улице, фонарь — у лавки, скворечник —
 * на стене дома, котик — там, где ему вздумается лежать.
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

const BUILDING_NAMES: Record<string, string> = {
  flowershop: 'Цветочная лавка',
  coffee: 'Кофейня «Ромашка»',
  bakery: 'Пекарня',
  workshop: 'Мастерская декора',
  greenhouse: 'Оранжерея',
  pavilion: 'Павильон на площади',
};

const CHAIN_NAMES: Record<string, string> = {
  pack: 'открывает цепочку «Упаковка»',
  exotic: 'открывает цепочку «Экзотика»',
};

/**
 * Место каждого декора на улице. Координаты — доли от ширины и высоты фона,
 * точка привязки — нижний центр спрайта (так предмет «стоит» на земле).
 * Значения подобраны по фону: фонарь у угла лавки, скворечник на стене дома,
 * скамейка и клумба — на брусчатке, гамак — у зелени слева.
 */
interface DecorSlot {
  x: number;
  y: number;
  /** Размер спрайта как доля ширины фона. */
  size: number;
  /** Лёгкий наклон, чтобы предметы не выглядели приклеенными. */
  rotate?: number;
}

const DECOR_SLOTS: Record<string, DecorSlot> = {
  // Подвешенное на стене дома: музыка ветра, скворечник и кормушка для бабочек
  // собираются рядом, чтобы не раскидывать мелкие предметы по всей карте.
  windchime: { x: 0.664, y: 0.29, size: 0.05 },
  birdhouse: { x: 0.588, y: 0.318, size: 0.058 },
  butterfly: { x: 0.633, y: 0.352, size: 0.046 },
  // На стене лавки
  sign: { x: 0.372, y: 0.412, size: 0.062, rotate: -2 },
  // Стоит в витрине среди цветов
  lantern: { x: 0.318, y: 0.487, size: 0.075 },
  // На брусчатке: скамейка у входа, фонтан и клумба на площади
  bench: { x: 0.452, y: 0.635, size: 0.105 },
  fountain: { x: 0.662, y: 0.645, size: 0.10 },
  flowerbed: { x: 0.545, y: 0.735, size: 0.095 },
  // Гамак — на свободной брусчатке справа, у мастерской
  hammock: { x: 0.755, y: 0.705, size: 0.095, rotate: -1 },
  gnome: { x: 0.607, y: 0.775, size: 0.058 },
  // Котик лежит на брусчатке у входа в лавку
  cat: { x: 0.402, y: 0.80, size: 0.075 },
};

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

/** Загруженные картинки: фон и спрайты. Кэш на всё время жизни экрана. */
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): HTMLImageElement {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const image = new Image();
  image.src = src;
  imageCache.set(src, image);
  return image;
}

export function mountQuarter(root: HTMLElement, game: Game, onClose: () => void): QuarterHandle {
  const overlay = el('div', 'quarter');

  const bar = el('div', 'quarter__bar');
  const title = el('div', 'quarter__title', 'Квартал');
  const repStat = el('div', 'stat');
  repStat.append(
    Object.assign(el('img'), { src: spriteUrl('ui-rep') ?? '', alt: 'репутация' }),
    document.createTextNode('0'),
  );
  const close = el('button', 'button', 'Вернуться');
  close.addEventListener('click', onClose);
  bar.append(title, repStat, close);

  const stage = el('div', 'quarter__stage');
  const canvas = document.createElement('canvas');
  canvas.className = 'quarter__canvas';
  const info = el('div', 'quarter__info');
  info.hidden = true;
  stage.append(canvas, info);

  const legend = el('div', 'quarter__legend');
  const decorLine = el('div', 'quarter__decor-line');

  overlay.append(bar, stage, legend, decorLine);
  root.append(overlay);

  const ctx = canvas.getContext('2d');
  const background = loadImage(stageUrl);
  let frame = 0;

  /**
   * Размер буфера canvas берём от самой картинки улицы (1536×1024), а не
   * оставляем по умолчанию 300×150: иначе карта рисуется в маленький буфер
   * и растягивается по ширине экрана — получается мыло.
   */
  function syncCanvasSize(): void {
    if (background.naturalWidth === 0) return;
    if (canvas.width === background.naturalWidth && canvas.height === background.naturalHeight) return;
    canvas.width = background.naturalWidth;
    canvas.height = background.naturalHeight;
    draw();
  }

  if (background.complete) {
    syncCanvasSize();
  } else {
    background.addEventListener('load', syncCanvasSize, { once: true });
  }

  /** Точки попадания по нарисованному декору — для клика и подписи. */
  let hits: { key: string; x: number; y: number; w: number; h: number }[] = [];

  /**
   * Что стоит на улице прямо сейчас. Список считается независимо от отрисовки:
   * canvas может быть недоступен (например, в тестовой среде без поддержки
   * canvas), но состав декора всё равно должен быть известен и проверяем.
   */
  function placedDecor(): { id: string; slot: DecorSlot }[] {
    const out: { id: string; slot: DecorSlot }[] = [];
    for (const decor of BALANCE.decor) {
      if (decorLevel(decor.id) <= 0) continue;
      const slot = DECOR_SLOTS[decor.id];
      if (slot) out.push({ id: decor.id, slot });
    }
    return out;
  }

  function decorLevel(id: string): number {
    return game.decorLevel(id);
  }

  function drawDecor(now: number): void {
    if (!ctx) return;
    hits = [];
    for (const { id, slot } of placedDecor()) {
      const icon = DECOR_ICONS[id];
      if (!icon) continue;

      const image = loadImage(spriteUrl(icon) ?? '');
      if (!image.complete || image.naturalWidth === 0) continue;

      const w = canvas.width * slot.size;
      const h = (image.naturalHeight / image.naturalWidth) * w;

      // Бабочка летает: пока экран открыт, у неё плавная траектория и она
      // «дышит» по размеру. Это единственная анимация на карте — остальной
      // декор стоит спокойно, чтобы глаза не уставали.
      let x = slot.x * canvas.width;
      let y = slot.y * canvas.height;
      let scale = 1;
      if (id === 'butterfly') {
        const t = now / 1000;
        x += Math.sin(t * 0.9) * canvas.width * 0.06;
        y += Math.sin(t * 1.3 + 1) * canvas.height * 0.03;
        scale = 1 + Math.sin(t * 3.2) * 0.12;
      }

      ctx.save();
      ctx.globalAlpha = id === 'butterfly' ? 0.92 : 1;
      ctx.translate(x, y);
      if (slot.rotate) ctx.rotate((slot.rotate * Math.PI) / 180);
      ctx.drawImage(image, (-w * scale) / 2, -h * scale, w * scale, h * scale);
      ctx.restore();

      hits.push({ key: id, x: x - w / 2, y: y - h, w, h });
    }
  }

  function draw(): void {
    // Состав декора на улице известен всегда, даже если canvas недоступен
    canvas.dataset.decor = placedDecor().map((item) => item.id).join(',');

    if (!ctx) return;
    if (background.naturalWidth === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (background.complete && background.naturalWidth > 0) {
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    }
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    drawDecor(now);
  }

  function loop(): void {
    draw();
    frame = requestAnimationFrame(loop);
  }

  function renderLegend(): void {
    const day = game.day();
    legend.innerHTML = '';
    for (const building of BUILDINGS) {
      const rule = (
        BALANCE.content_schedule as unknown as {
          buildings?: { id: string; unlock_day: number; income_multiplier: number }[];
        }
      ).buildings?.find((b) => b.id === building.id);
      const unlockDay = rule?.unlock_day ?? building.day;
      const open = day >= unlockDay;

      const chip = el('div', `quarter__tile${open ? '' : ' quarter__tile--locked'}`);
      const image = el('img');
      image.src = spriteUrl(`bld-${building.id}`) ?? '';
      image.alt = BUILDING_NAMES[building.id] ?? building.id;
      if (!open) image.style.filter = 'grayscale(0.9) brightness(0.9)';
      chip.append(image);
      chip.append(el('span', 'quarter__tile-name', BUILDING_NAMES[building.id] ?? building.id));
      chip.append(
        el(
          'span',
          'quarter__tile-note',
          open
            ? CHAIN_NAMES[building.chain ?? ''] ?? `доход ×${rule?.income_multiplier ?? 1}`
            : `откроется в день ${unlockDay}`,
        ),
      );
      legend.append(chip);
    }
  }

  function renderHint(): void {
    const total = BALANCE.decor.length;
    const placed = BALANCE.decor.filter((d) => decorLevel(d.id) > 0).length;
    const buildings = BUILDINGS.filter((building) => {
      const rule = (
        BALANCE.content_schedule as unknown as {
          buildings?: { id: string; unlock_day: number }[];
        }
      ).buildings?.find((b) => b.id === building.id);
      return game.day() >= (rule?.unlock_day ?? building.day);
    }).length;

    decorLine.textContent =
      `День ${game.day()} · зданий открыто ${buildings} из ${BUILDINGS.length} · ` +
      `декора на улице ${placed} из ${total} · множитель дохода ×${game.incomeMultiplier().toFixed(2)}`;
    if (placed === 0) {
      decorLine.append(
        document.createTextNode(' · декор покупается за репутацию в разделе «Декор»'),
      );
    }
  }

  // Клик по карте: если попал в декор — показываем карточку с названием
  // и уровнем. Так видно, что куплено, и ради чего покупать дальше.
  stage.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    const hit = [...hits].reverse().find(
      (item) => px >= item.x - 6 && px <= item.x + item.w + 6 && py >= item.y - 6 && py <= item.y + item.h + 6,
    );
    if (!hit) {
      info.hidden = true;
      return;
    }
    const decor = BALANCE.decor.find((d) => d.id === hit.key);
    if (!decor) return;
    const level = decorLevel(decor.id);
    const rectCss = canvas.getBoundingClientRect();
    info.hidden = false;
    info.textContent =
      `${decor.name} · уровень ${level}/${decor.max_level}. ${decor.description}. ${decor.effect}`;
    info.style.left = `${Math.min(Math.max(hit.x / scaleX - 60, 8), Math.max(rectCss.width - 268, 8))}px`;
    info.style.top = `${Math.max(hit.y / scaleY - 78, 8)}px`;
  });

  return {
    render() {
      renderLegend();
      renderHint();
      repStat.lastChild?.remove();
      repStat.append(document.createTextNode(String(game.reputation)));
      draw();
      if (!frame) loop();
    },
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      overlay.remove();
    },
  };
}
