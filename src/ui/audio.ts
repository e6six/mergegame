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
 */

export type SoundName = 'click' | 'merge' | 'order' | 'coin' | 'error' | 'upgrade';

const STORAGE_KEY = 'flower-quarter/muted';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
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
      master.gain.value = 0.22;
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
}

function tone({ freq, to, dur, type, gain, at = 0 }: ToneOptions): void {
  if (!context || !master || muted) return;
  const start = context.currentTime + at;
  const osc = context.createOscillator();
  const envelope = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);

  // Мягкая атака и затухание: резкие края звучат как щелчок помехи
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(envelope);
  envelope.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.03);
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
      tone({ freq: 660, to: 520, dur: 0.06, type: 'triangle', gain: 0.16 });
      break;
    case 'merge':
      tone({ freq: 392 * step, dur: 0.1, type: 'sine', gain: 0.2 });
      tone({ freq: 587 * step, dur: 0.14, type: 'sine', gain: 0.16, at: 0.06 });
      break;
    case 'order':
      tone({ freq: 523, dur: 0.12, type: 'sine', gain: 0.18 });
      tone({ freq: 659, dur: 0.12, type: 'sine', gain: 0.18, at: 0.09 });
      tone({ freq: 784, dur: 0.2, type: 'sine', gain: 0.16, at: 0.18 });
      break;
    case 'coin':
      tone({ freq: 1046, dur: 0.07, type: 'square', gain: 0.08 });
      tone({ freq: 1568, dur: 0.12, type: 'square', gain: 0.06, at: 0.05 });
      break;
    case 'error':
      tone({ freq: 196, to: 160, dur: 0.16, type: 'sawtooth', gain: 0.12 });
      break;
    case 'upgrade':
      tone({ freq: 330, to: 880, dur: 0.28, type: 'triangle', gain: 0.18 });
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

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}
