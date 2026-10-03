/**
 * Звук, синтезируемый кодом.
 *
 * Почему не файлы: звуковые ассеты весят больше, чем вся остальная игра,
 * их надо где-то брать и лицензировать. Простые «щелчок», «перелив» и «звон
 * монет» синтезируются осцилляторами за десяток строк, весят ноль, работают
 * офлайн и не требуют разрешения на использование.
 *
 * Требование площадки: звук обязан глушиться на время рекламы. Для этого
 * модуль отдаёт setMuted, а площадка дёргает его по game_api_pause/resume.
 *
 * Полировка: баланс громкости, новые звуки для мета-слоя, mute по умолчанию
 * на мобиле (coarse pointer), мягкая атака без щелчков.
 *
 * Фонового эмбиента нет — был убран по просьбе пользователя как гул в ушах.
 */

export type SoundName =
  | 'click'
  | 'merge'
  | 'order'
  | 'coin'
  | 'error'
  | 'upgrade'
  | 'sell'
  | 'herbarium'
  | 'decor'
  | 'reputation'
  | 'tutorial'
  | 'building'
  | 'rare';

const STORAGE_KEY = 'flower-quarter/muted';
const VOLUME_KEY = 'flower-quarter/volume';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
let volume = readVolume();

function readMuted(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === '1';
    // mute по умолчанию на мобиле (coarse pointer, no hover)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const isCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      if (isCoarse) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function readVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    if (stored !== null) {
      const v = parseFloat(stored);
      if (!isNaN(v) && v >= 0 && v <= 1) return v;
    }
    return 1;
  } catch {
    return 1;
  }
}

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Готовит звук к работе. Вызывать по действию игрока: браузеры запрещают
 * запускать звук до первого касания или клика.
 */
export function unlockAudio(): boolean {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return false;
  try {
    if (!context) {
      context = new Ctor();
      master = context.createGain();
      // баланс громкости: мастер тише, чтобы не резало уши на мобиле
      master.gain.value = 0.32 * volume;
      master.connect(context.destination);

    }
    if (context.state === 'suspended') void context.resume();
    return true;
  } catch {
    return false;
  }
}

interface ToneOptions {
  freq: number;
  to?: number;
  dur: number;
  type: OscillatorType;
  gain: number;
  at?: number;
  // фильтр для мягкости
  lowpass?: number;
}

/*
 * Эмбиента здесь больше нет — и это осознанное решение.
 *
 * Была попытка сделать «атмосферу» синтезом: ветер из коричневого шума,
 * пэд из двух синусоид 110 и 110.5 Гц с биением и случайные «птички».
 * На слух это давало ровный низкочастотный гул, который резал уши, и звучал
 * он всё время, пока открыта игра. Пользователь попросил убрать — убрано
 * полностью: ни фонового гула, ни птичек.
 *
 * Остались только короткие звуки действий (клик, слияние, заказ, монеты).
 * Если атмосфера понадобится снова, это должен быть отдельный звуковой файл
 * с записью, зацикленный с плавным появлением, и по умолчанию выключенный.
 */
function tone({ freq, to, dur, type, gain, at = 0, lowpass }: ToneOptions): void {
  if (!context || !master || muted) return;
  const start = context.currentTime + at;
  const osc = context.createOscillator();
  const envelope = context.createGain();

  osc.type = type;
  // Верхняя граница 8 кГц: некоторые «взлёты» тона уезжали выше слышимого
  // диапазона и превращались в писк на грани восприятия.
  const clamp = (f: number) => Math.max(30, Math.min(8000, f));
  osc.frequency.setValueAtTime(clamp(freq), start);
  if (to) osc.frequency.exponentialRampToValueAtTime(clamp(to), start + dur);

  // опциональный lowpass для мягкости (убирает резкие гармоники)
  if (lowpass && context) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpass, start);
    envelope.connect(filter);
    filter.connect(master);
  } else {
    envelope.connect(master);
  }

  // Мягкая атака и затухание: резкие края звучат как щелчок помехи
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain * volume, start + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(envelope);
  osc.start(start);
  osc.stop(start + dur + 0.04);
}

function noiseTone(dur: number, gain: number, at = 0): void {
  if (!context || !master || muted) return;
  const start = context.currentTime + at;
  const bufferSize = Math.floor(context.sampleRate * dur);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const envelope = context.createGain();
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.5;

  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain * volume * 0.3, start + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(master);
  source.start(start);
  source.stop(start + dur + 0.02);
}

export interface PlayOptions {
  /** Уровень предмета: чем выше, тем выше нота — слияние «звучит» как рост. */
  level?: number;
}

export function play(name: SoundName, options: PlayOptions = {}): void {
  if (!unlockAudio()) return;
  const level = Math.max(1, Math.min(10, options.level ?? 1));
  const step = 2 ** ((level - 1) / 12);

  switch (name) {
    case 'click':
      // мягкий клик — треугольник, коротко, без высоких гармоник
      tone({ freq: 600, to: 480, dur: 0.05, type: 'triangle', gain: 0.31, lowpass: 2000 });
      break;
    case 'merge':
      // перелив вверх — два тона, второй выше, как рост
      tone({ freq: 380 * step, dur: 0.09, type: 'sine', gain: 0.42 });
      tone({ freq: 560 * step, dur: 0.13, type: 'sine', gain: 0.34, at: 0.05 });
      if (level >= 5) {
        // редкий уровень — добавляем третий высокий тон
        tone({ freq: 880 * step, dur: 0.18, type: 'triangle', gain: 0.26, at: 0.12, lowpass: 3000 });
      }
      break;
    case 'rare':
      // редкое слияние — золотистый перезвон
      tone({ freq: 659 * step, dur: 0.1, type: 'sine', gain: 0.47 });
      tone({ freq: 880 * step, dur: 0.15, type: 'sine', gain: 0.39, at: 0.08 });
      tone({ freq: 1318 * step, dur: 0.22, type: 'triangle', gain: 0.31, at: 0.16, lowpass: 4000 });
      break;
    case 'order':
      // мажорный аккорд — до-ми-соль
      tone({ freq: 523, dur: 0.11, type: 'sine', gain: 0.39 });
      tone({ freq: 659, dur: 0.11, type: 'sine', gain: 0.39, at: 0.08 });
      tone({ freq: 784, dur: 0.18, type: 'sine', gain: 0.34, at: 0.16 });
      break;
    case 'coin':
      // звон монет — два коротких square, но тише
      tone({ freq: 1046, dur: 0.06, type: 'sine', gain: 0.26 });
      tone({ freq: 1568, dur: 0.1, type: 'sine', gain: 0.21, at: 0.04 });
      break;
    case 'sell':
      // продажа — мягкий «дзынь» вниз
      tone({ freq: 880, to: 659, dur: 0.09, type: 'triangle', gain: 0.26, lowpass: 2500 });
      break;
    case 'error':
      // ошибка — низкий saw, но с lowpass чтобы не резало
      tone({ freq: 180, to: 140, dur: 0.14, type: 'sawtooth', gain: 0.21, lowpass: 800 });
      noiseTone(0.08, 0.04);
      break;
    case 'upgrade':
      // апгрейд — взлёт от низкого к высокому
      tone({ freq: 330, to: 880, dur: 0.26, type: 'triangle', gain: 0.36, lowpass: 3000 });
      tone({ freq: 440, to: 1108, dur: 0.22, type: 'sine', gain: 0.26, at: 0.06 });
      break;
    case 'herbarium':
      // гербарий — нежный перезвон, как открытие
      tone({ freq: 523, dur: 0.12, type: 'sine', gain: 0.36 });
      tone({ freq: 659, dur: 0.12, type: 'sine', gain: 0.31, at: 0.07 });
      tone({ freq: 1046, dur: 0.2, type: 'triangle', gain: 0.23, at: 0.14, lowpass: 3500 });
      break;
    case 'decor':
      // декор — тёплый аккорд, уютный
      tone({ freq: 392, dur: 0.14, type: 'sine', gain: 0.34 });
      tone({ freq: 494, dur: 0.14, type: 'sine', gain: 0.29, at: 0.06 });
      tone({ freq: 659, dur: 0.2, type: 'triangle', gain: 0.23, at: 0.12, lowpass: 3000 });
      break;
    case 'reputation':
      // репутация — короткий фанфарный
      tone({ freq: 659, dur: 0.08, type: 'sine', gain: 0.36 });
      tone({ freq: 784, dur: 0.12, type: 'sine', gain: 0.31, at: 0.06 });
      break;
    case 'building':
      // здание открыто — торжественный, с ревербом эффектом
      tone({ freq: 330, dur: 0.18, type: 'sine', gain: 0.39 });
      tone({ freq: 440, dur: 0.18, type: 'sine', gain: 0.34, at: 0.1 });
      tone({ freq: 659, dur: 0.28, type: 'triangle', gain: 0.31, at: 0.2, lowpass: 3500 });
      tone({ freq: 880, dur: 0.32, type: 'sine', gain: 0.23, at: 0.28 });
      break;
    case 'tutorial':
      // туториал — мягкий «поп», дружелюбный
      tone({ freq: 700, to: 900, dur: 0.1, type: 'sine', gain: 0.31 });
      break;
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

export function setVolume(value: number): void {
  volume = Math.max(0, Math.min(1, value));
  if (master) {
    master.gain.value = 0.32 * volume;
  }
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
    /* ignore */
  }
}

export function getVolume(): number {
  return volume;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}
