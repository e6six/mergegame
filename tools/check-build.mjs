#!/usr/bin/env node
/**
 * Проверка собранной игры на требования Yandex Games.
 *
 * Площадка снимает с публикации за формальные нарушения, а ловятся они
 * за секунду: index.html в корне архива, никаких абсолютных путей, никаких
 * пробелов и кириллицы в именах файлов, размер в пределах лимита.
 *
 * Запуск: node tools/check-build.mjs   (или npm run build целиком)
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const LIMIT_MB = 100;

if (!existsSync(DIST)) {
  console.error(`нет папки ${DIST} — сначала соберите проект (npm run build)`);
  process.exit(1);
}

const problems = [];
const notes = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);

// 1. index.html в корне архива
if (!existsSync(join(DIST, 'index.html'))) {
  problems.push('index.html отсутствует в корне сборки');
} else {
  notes.push('index.html в корне');
}

// 2. пробелы и кириллица в именах файлов и папок
const badNames = files.filter((f) => /[а-яА-ЯёЁ\s]/.test(relative(DIST, f)));
if (badNames.length) {
  problems.push(`пробелы или кириллица в именах: ${badNames.slice(0, 3).map((f) => relative(DIST, f)).join(', ')}`);
} else {
  notes.push('имена файлов без пробелов и кириллицы');
}

// 3. размер распакованной сборки
let total = 0;
for (const file of files) total += statSync(file).size;
const sizeMb = total / 1024 / 1024;
if (sizeMb > LIMIT_MB) {
  problems.push(`размер сборки ${sizeMb.toFixed(1)} МБ превышает лимит площадки ${LIMIT_MB} МБ`);
} else {
  notes.push(`размер ${sizeMb.toFixed(1)} МБ (лимит ${LIMIT_MB} МБ)`);
}

// 4. абсолютные пути и ссылки на чужие хранилища
const textFiles = files.filter((f) => /\.(html|css|js|json)$/.test(f));
const absolute = [];
const s3 = [];
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(DIST, file);
  for (const match of text.matchAll(/["'(](https?:\/\/[^"')]+)["')]/g)) {
    if (/storage\.yandexcloud|s3\.|yandex\.net\/games/i.test(match[1])) s3.push(`${rel}: ${match[1]}`);
  }
  if (file.endsWith('.html')) {
    for (const match of text.matchAll(/(?:src|href)="(\/[^"]*)"/g)) absolute.push(`${rel}: ${match[1]}`);
  }
}
if (s3.length) problems.push(`ссылки на хранилища площадки: ${s3.slice(0, 2).join('; ')}`);
else notes.push('ссылок на хранилища площадки нет');

if (absolute.length) problems.push(`абсолютные пути в html: ${absolute.slice(0, 3).join('; ')}`);
else notes.push('все пути к ассетам относительные');

// 5. спрайты на месте
const sprites = files.filter((f) => /\.(png|jpg)$/.test(f)).length;
if (sprites < 60) problems.push(`в сборке всего ${sprites} картинок — похоже, часть спрайтов не попала`);
else notes.push(`картинок в сборке: ${sprites}`);

console.log(`Проверка сборки: файлов ${files.length}`);
for (const note of notes) console.log(`  ок: ${note}`);
for (const problem of problems) console.log(`  ПРОБЛЕМА: ${problem}`);

if (problems.length) {
  console.error(`\nНарушений требований площадки: ${problems.length}`);
  process.exit(1);
}
console.log('\nСборка готова к загрузке на площадку.');
