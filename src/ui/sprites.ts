/**
 * Спрайты: адреса картинок из art/sprites.
 *
 * Vite собирает их в бандл и отдаёт с хешами — значит, в собранной игре
 * не будет абсолютных путей и запросов «мимо» архива, что запрещено
 * требованиями Yandex Games.
 */
const modules = import.meta.glob('../../art/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byId = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const file = path.split('/').pop() ?? '';
  byId.set(file.replace(/\.png$/, ''), url);
}

/** Адрес спрайта по id предмета («rose-01») или undefined, если картинки нет. */
export function spriteUrl(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function hasSprite(id: string): boolean {
  return byId.has(id);
}

export const spriteCount = byId.size;
