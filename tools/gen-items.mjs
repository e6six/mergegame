#!/usr/bin/env node
/**
 * Генерация данных предметов для игры из art/manifest.json.
 *
 * Манифест — источник правды по цепочкам, уровням и названиям. Скрипт превращает
 * его в типизированный TS-модуль, чтобы игра и арт-пайплайн не разъезжались:
 * переименовали предмет в манифесте — пересобрали, игра знает новое имя.
 *
 * Запуск: node tools/gen-items.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'art/manifest.json'), 'utf8'));
const balance = JSON.parse(readFileSync(resolve(root, 'data/balance.json'), 'utf8'));

const role = new Map(balance.content_schedule.chains.map((c) => [c.id, c]));

const chains = manifest.chains.map((chain) => ({
  id: chain.id,
  name: chain.name,
  role: role.get(chain.id)?.role ?? 'service',
  unlockDay: role.get(chain.id)?.unlock_day ?? 0,
  items: chain.items.map((item) => ({
    id: item.id,
    level: item.level,
    name: item.name,
  })),
}));

const header = `// СГЕНЕРИРОВАНО tools/gen-items.mjs из art/manifest.json и data/balance.json
// Руками не править: правьте манифест и запускайте генератор.

export interface ItemDef {
  readonly id: string;
  readonly level: number;
  readonly name: string;
}

export interface ChainDef {
  readonly id: string;
  readonly name: string;
  /** order — из цепочки приходят заказы; service — вспомогательная, заказов не даёт */
  readonly role: 'order' | 'service';
  readonly unlockDay: number;
  readonly items: readonly ItemDef[];
}

export const CHAINS: readonly ChainDef[] = `;

const body = JSON.stringify(chains, null, 2)
  .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1:')
  .replace(/\n/g, '\n');

const footer = ` as const;

export const ITEM_BY_ID = new Map<string, ItemDef>(
  CHAINS.flatMap((chain) => chain.items.map((item) => [item.id, item] as const)),
);

export const ITEM_BY_KEY = new Map<string, ItemDef>(
  CHAINS.flatMap((chain) => chain.items.map((item) => [\`\${chain.id}:\${item.level}\`, item] as const)),
);

/** Ключ предмета в формате «цепочка:уровень» — так он хранится на поле и в сейве. */
export function itemKey(chainId: string, level: number): string {
  return \`\${chainId}:\${level}\`;
}

/** Адрес спрайта в art/sprites. Имена файлов = id предметов из манифеста. */
export function spritePath(itemId: string): string {
  return \`/art/sprites/\${itemId}.png\`;
}
`;

mkdirSync(resolve(root, 'src/data'), { recursive: true });
writeFileSync(resolve(root, 'src/data/items.generated.ts'), header + body + footer, 'utf8');

const total = chains.reduce((n, c) => n + c.items.length, 0);
console.log(`src/data/items.generated.ts: цепочек ${chains.length}, предметов ${total}`);
