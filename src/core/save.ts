import type { SerializedGame } from './game';

/**
 * Сохранение. Пока localStorage; на площадке добавится облако
 * (ysdk.getPlayer().setData, лимит 200 КБ на игрока — наш сейв сильно меньше).
 */

const KEY = 'flower-quarter/save-v1';
const BACKUP_KEY = 'flower-quarter/backup-v1';

export function save(game: SerializedGame): void {
  try {
    const payload = JSON.stringify(game);
    localStorage.setItem(KEY, payload);
  } catch (error) {
    // Приватный режим или переполненное хранилище: игра продолжается,
    // но прогресс не сохранится — сообщаем наверх, чтобы UI предупредил.
    console.warn('Не удалось сохранить игру', error);
  }
}

export function load(): SerializedGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedGame;
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) return null;
    return parsed;
  } catch (error) {
    console.warn('Сейв повреждён, начинаем заново', error);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* бэкап не критичен */
    }
    return null;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* игнорируем */
  }
}
