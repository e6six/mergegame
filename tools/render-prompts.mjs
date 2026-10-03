#!/usr/bin/env node
/**
 * Сборка art/prompts.md — полного текста промптов для каждого ассета.
 *
 * Зачем: art/manifest.json хранит состав пакета и subjects, art/prompts.json —
 * шаблоны, переделки и причины. Для человека нужен один читаемый файл, где
 * напротив каждого ассета лежит готовый промпт, который можно скопировать
 * и повторить генерацию.
 *
 * Запуск: node tools/render-prompts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'art/manifest.json'), 'utf8'));
const prompts = JSON.parse(readFileSync(resolve(root, 'art/prompts.json'), 'utf8'));

const overrides = new Map(prompts.assets.map((a) => [a.id, a]));

/** Подставляет subject и палитру в шаблон. */
function buildPrompt(id, template, subject, paletteKey) {
  const tpl = prompts.templates[template] ?? prompts.templates.item;
  const palette = paletteKey ? prompts.paletteOverrides[paletteKey] : null;
  let text = tpl.replace('{SUBJECT}', subject);
  if (palette) {
    // заменяем стандартное перечисление палитры на вариант
    text = text.replace(
      /pastel palette \([^)]*\)/,
      palette,
    );
  }
  return text;
}

/** Все ассеты пакета: цепочки, генераторы, здания, UI из манифеста. */
function collectAssets() {
  const out = [];
  for (const chain of manifest.chains) {
    for (const item of chain.items) {
      out.push({
        id: item.id,
        group: `${chain.name} (${chain.id})`,
        level: item.level,
        name: item.name,
        template: 'item',
        subject: item.subject,
      });
    }
  }
  for (const gen of manifest.generators) {
    out.push({ id: gen.id, group: 'Генераторы', template: 'item', subject: gen.subject, name: gen.name });
  }
  for (const bld of manifest.buildings) {
    out.push({ id: bld.id, group: 'Здания', template: 'building', subject: bld.subject, name: bld.name });
  }
  for (const ui of manifest.ui) {
    out.push({ id: ui.id, group: 'Интерфейс', template: 'uiIcon', subject: ui.subject, name: ui.name, palette: 'sage green and cream palette' });
  }
  if (manifest.decor) {
    for (const d of manifest.decor) {
      out.push({ id: d.id, group: 'Декор', template: 'item', subject: d.subject, name: d.name });
    }
  }
  return out;
}

const assets = collectAssets();

// Ассеты сверх манифеста (появились по ходу работы) добавляем в конец
const extras = prompts.assets
  .filter((a) => !assets.some((x) => x.id === a.id))
  .map((a) => ({ id: a.id, group: 'Интерфейс', template: a.template, subject: a.subject, name: a.id, palette: a.palette }));

const all = [...assets, ...extras];

let md = `# Промпты ассетов

Сгенерировано командой \`node tools/render-prompts.mjs\` из \`art/manifest.json\`
и \`art/prompts.json\`. Руками не править — правьте исходные файлы.

**Референс стиля для каждого запроса:** \`art/style-test/flowershop-keyart.png\`
передаётся параметром \`images\`. Без него словесное описание стиля не работает.

**Лимит генерации:** 10 изображений за один ход. Очередь партии печатает
\`tools/next-batch.py\` по манифесту.

---

## Шаблоны промптов

`;

for (const [name, tpl] of Object.entries(prompts.templates)) {
  md += `### ${name}\n\n\`\`\`text\n${tpl}\n\`\`\`\n\n`;
}

md += `### Варианты палитры\n\n`;
for (const [name, text] of Object.entries(prompts.paletteOverrides)) {
  md += `- **${name}**: \`${text}\`\n`;
}

md += `\n---

## Приёмы, которые пришлось выяснить на практике

`;
for (const rule of prompts.promptEngineering) {
  md += `- ${rule}\n`;
}

md += `\n---

## Ассеты

`;

let currentGroup = null;
for (const asset of all) {
  const override = overrides.get(asset.id);

  if (asset.group !== currentGroup) {
    currentGroup = asset.group;
    md += `\n### ${currentGroup}\n\n`;
  }

  const title = asset.level ? `${asset.level}. ${asset.name}` : `${asset.name}`;
  md += `**${asset.id}** — ${title}\n\n`;

  const attempts = override?.attempts;
  if (attempts) {
    attempts.forEach((attempt, i) => {
      const prompt = buildPrompt(asset.id, override.template ?? asset.template, attempt.subject, attempt.palette ?? override.palette ?? asset.palette);
      const label = i === attempts.length - 1 ? 'принят' : 'отклонён';
      md += `_Попытка ${i + 1} (${label}):_ ${attempt.verdict}\n\n`;
      md += `\`\`\`text\n${prompt}\n\`\`\`\n\n`;
    });
  } else {
    const subject = override?.subject ?? asset.subject;
    const palette = override?.palette ?? asset.palette;
    const prompt = buildPrompt(asset.id, override?.template ?? asset.template, subject, palette);
    md += `\`\`\`text\n${prompt}\n\`\`\`\n\n`;
    if (override?.verdict) md += `_${override.verdict}_\n\n`;
  }
}

md += `\n---\n\n## Фоны (не вырезаются)\n\n`;
for (const bg of prompts.backgrounds) {
  md += `**${bg.id}** → \`${bg.file}\`\n\n\`\`\`text\n${bg.prompt}\n\`\`\`\n\n`;
  md += `_Обработка:_ ${bg.processing}\n\n`;
  md += `_Итог:_ ${bg.verdict}\n\n`;
}

md += `---

## Как повторить генерацию одного ассета

1. Взять промпт ассета из этого файла.
2. Приложить к запросу \`art/style-test/flowershop-keyart.png\` как референс.
3. Сохранить результат в \`art/raw/<id>.png\`.
4. Обработать:

\`\`\`bash
tools/py tools/shrink-raw.py art/raw/<id>.png --max 800
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
tools/py tools/check-sprites.py
\`\`\`

5. Проверить читаемость в игровом размере: \`art/style-test/level-readability.md\`
   описывает процедуру, \`tools/mock-board.py\` собирает макет доски.
`;

writeFileSync(resolve(root, 'art/prompts.md'), md, 'utf8');

const count = all.length + prompts.backgrounds.length;
console.log(`art/prompts.md: ассетов ${all.length}, фонов ${prompts.backgrounds.length}, всего ${count}`);
console.log(`переделки задокументированы у ${overrides.size} ассетов`);
