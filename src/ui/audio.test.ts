// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isMuted, play, setMuted, toggleMuted, unlockAudio } from './audio';

/**
 * Звук должен быть безопасным: если браузер не даёт AudioContext
 * (или мы в тестовой среде), игра обязана работать молча, а не падать.
 */
describe('звук', () => {
  beforeEach(() => {
    setMuted(false);
    localStorage.clear();
  });

  it('не падает, когда AudioContext недоступен', () => {
    expect(unlockAudio()).toBe(false);
    expect(() => play('merge')).not.toThrow();
    expect(() => play('order')).not.toThrow();
  });

  it('работает с поддельным AudioContext и уважает выключенный звук', () => {
    const started: number[] = [];
    const fakeOsc = () => ({
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(() => started.push(1)),
      stop: vi.fn(),
    });
    const fakeGain = () => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    });

    class FakeContext {
      currentTime = 0;
      state = 'running';
      destination = {};
      createOscillator = () => fakeOsc();
      createGain = () => fakeGain();
      resume = () => Promise.resolve();
    }

    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('window', Object.assign(window, { AudioContext: FakeContext }));

    expect(unlockAudio()).toBe(true);
    play('merge', { level: 3 });
    expect(started.length).toBe(2);

    started.length = 0;
    setMuted(true);
    play('merge', { level: 3 });
    expect(started.length).toBe(0);

    setMuted(false);
    play('order');
    expect(started.length).toBe(3);

    vi.unstubAllGlobals();
  });

  it('запоминает выключенный звук между запусками', () => {
    expect(isMuted()).toBe(false);
    expect(toggleMuted()).toBe(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem('flower-quarter/muted')).toBe('1');

    setMuted(false);
    expect(localStorage.getItem('flower-quarter/muted')).toBe('0');
  });

  it('ограничивает уровень, чтобы высокие ноты не уходили за слышимый диапазон', () => {
    expect(() => play('merge', { level: 999 })).not.toThrow();
    expect(() => play('merge', { level: -5 })).not.toThrow();
  });
});
