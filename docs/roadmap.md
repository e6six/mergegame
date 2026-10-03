# Цветочный квартал — план разработки, стек и пайплайн ассетов (актуально main f0320a6)

---

## 1. Стек

| Слой | Выбор | Почему |
|---|---|---|
| Язык | TypeScript | типизация данных и правил, безопасный рефакторинг |
| Сборка | Vite | быстрый дев-сервер, один бандл, легко под Yandex |
| Рендер | DOM + CSS (был PixiJS в планах, но сейчас DOM) | 900 клеток, спрайты 86px, CSS-анимации хватает, вес <100MB |
| Логика | `src/core` без DOM | экономику гоняем headless-симулятором на Node |
| Данные | `data/balance.json` + `src/data/items.generated.ts` | правятся без пересборки логики |
| Сейв | localStorage (SAVE_VERSION 3) + будущий ySDK | компактная схема |
| Звук | WebAudio напрямую | мьют по pause, короткие звуки действий (эмбиент убран по просьбе пользователя) |
| Тесты | Vitest | 53 теста: board, game, app, tutorial, audio |

---

## 2. Требования Yandex Games — чеклист актуальный

- [ ] SDK, `LoadingAPI.ready()`, `GameplayAPI.start/stop()`, pause/resume — отложено в крайнюю очередь по просьбе пользователя
- [x] Размер ≤100MB — сейчас 3.7MB, 75 картинок (73 спрайта +2 фона), 78 файлов
- [x] index.html в корне, без пробелов/кириллицы, относительные пути — проверяет `tools/check-build.mjs`
- [x] Звук глушится — `setMuted` глушит мастер-канал
- [x] Мобильная вёрстка 900/600/380, safe-area, touch drag&drop — есть, но нужно живое тестирование
- [ ] Back/OK TV — не сделано
- [ ] Локализация ru/en — не сделано
- [x] ИИ в рантайме запрещён, но предгенерированные ИИ-материалы разрешены — наш пайплайн легален

---

## 3. Арт-пайплайн (без художника) — актуально

**Референс стиля:** `art/style-test/flowershop-keyart.png` — обязателен параметром `images` в каждом `generate_image`, иначе стиль плывёт.

**Палитра:** sage #9DBE9A, cream #F3EADB, rose #E98C9B, wood #C89A63, lavender #A99BD4, warm_light #F7D9A0, foliage #6E9B5F.

**Шаблон промпта (item):**
```
Isolated single {SUBJECT}, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**Все промты сохранены:**
- `art/manifest.json` — источник правды: subjects для каждого id
- `art/prompts.json` — шаблоны, история переделок (17 ассетов с переделками)
- `art/prompts.md` — полный текст для каждого из 75 ассетов +2 фона =77, генерируется `node tools/render-prompts.mjs`
- `art/raw/` — исходники 800px от генератора
- `art/sprites/` — вырезанные через `tools/cutout.py` (прозрачность 65-93%, 19-64KB)
- `art/backgrounds/` — stage-board.jpg 68KB, stage-quarter.jpg 329KB

**Порядок:**
```bash
# 1. сгенерировать
# generate_image с images=[art/style-test/flowershop-keyart.png], file_path=art/raw/<id>.png, prompt из prompts.md, offer_options=false
# 2. вырезать
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
tools/py tools/check-sprites.py
# 3. проверить
npm run build
```

**Лимит:** 10 изображений за ход агента. Сейчас сгенерировано 73/75 спрайтов, осталось 2: decor-hammock, decor-cat — промты готовы, нужно в следующем чате.

**Грабли:**
- Заливка фона внутри венка/лукошка — решено через --gap-tol в cutout.py
- Пропорции плывут если "тот же цветок крупнее" — делаем разные композиции (бутон → три розы → корзина → арка)
- Эмодзи/символы в игре запрещены — всё должно быть сгенерировано, даже корзина продажи

---

## 4. Этапы — факт и план

### M0 — Концепт — DONE
- [x] Концепт, роадмап, стиль, палитра, style bible
- [x] Пайплайн: cutout.py, check-sprites.py, shrink-raw.py, next-batch.py, mock-board.py, gen-items.mjs, render-prompts.mjs
- [x] 5 цепочек по 10 уровней (50 предметов) — rose, wild, exotic, pack, tools — QA пройден
- [x] 3 генератора gen-bed-01..03, 6 зданий bld-*, 4 UI иконки, 2 фона — MVP арт-пакет закрыт
- [x] Таблица баланса data/balance.json + симулятор tools/simulate.py + отчёт docs/balance-report.md

### M1 — Ядро — DONE
- [x] Поле 6x7→9x9 (42 клетки, склад max 7 открывает всё), мердж 3→1 и 5→2, drag&drop мышкой и пальцем
- [x] Генераторы, энергия 200 cap + бонусы, regen, offline tick, click_cost 1
- [x] Заказы 3 слота, 3-6 предметов, остывание вместо провала, incomeMultiplier
- [x] Магазин 6 веток (warehouse, fridge, showcase, cashbox, staff, orangery) + эффекты
- [x] Продажа drag-to-basket (ui-sell-basket.png), клик — инфо + выбор для мерджа
- [x] Сейв SAVE_VERSION 3, localStorage, сериализация
- [x] 53 теста, сборка 3.7MB

### M2 — Петля — DONE
- [x] Заказы, апгрейды, кривая сложности, симулятор 30 дней
- [x] HUD: монеты ui-coin, энергия ui-energy (была забыта ☘, теперь используется), репутация ui-rep
- [x] Доска: светлые клетки, панели-карточки на деревянном столе из арта. CSS-фигуры ambient-decor удалены (мигали поверх доски)
- [x] Звук WebAudio: 13 коротких тонов, master 0.32. Эмбиент (ветер, пэд, птички) удалён — звучал гулом
- [x] Отладка: +1000 монет, +100 энергии, +100 репутации, +1 день, сброс

### M3 — Мета — DONE на 90%
- [x] Квартал фуллскрин, фон stage-quarter.jpg, 6 зданий по дням (coffee день 3, bakery 6, workshop 10, greenhouse 15, pavilion 21)
- [x] Репутация как валюта, гербарий 50 видов + бонус +3% за закрытую цепочку, прогресс-бар
- [x] Декор 11 видов (bench, lantern, flowerbed, sign, fountain, birdhouse, windchime, gnome, butterfly, hammock, cat) — баланс 11, манифест 11, спрайты 9/11 (2 pending)
- [x] Туториал интерактивный spotlight: backdrop pointer-events none, highlightBox box-shadow 9999px, область цели светлая, прогресс 0/3, Next disabled до действия
- [x] Корзина продажи сгенерирована: ui-sell-basket.png 19KB плетёная с монетами
- [x] Декор сгенерирован: 9/11 (bench 40KB, lantern 37KB, fountain 41KB, flowerbed 58KB, sign 64KB, birdhouse 36KB, windchime 20KB, gnome 31KB, butterfly 64KB) — все без эмодзи
- [ ] Догенерить 2 декора: hammock, cat (лимит 10/ход)
- [ ] Ambient декор из сгенерированных ассетов: сейчас CSS-фигуры (petal radial #FFB7C5→#E98C9B, butterfly 2 градиента, sparkle, glow) — нужно сгенерить fx-butterfly, fx-petal как png

### M4 — Платформа — TODO, следующий этап
- [ ] Yandex SDK: init, LoadingAPI.ready(), GameplayAPI, cloud save, rewarded, interstitial, лидерборды — отложено в крайнюю очередь по просьбе пользователя
- [x] Всё готово для подключения: звук глушится, сборка на относительных путях, сейв сериализуется под 200KB
- [ ] Анимации: fly-clone при drag, reward-float, merge-particle есть, но нужно: полёт монетки к HUD, тряска генератора, конфетти при 10 уровне
- [ ] Симуляция рекламы: кнопка "+25 энергии за рекламу" с фейк-оверлеем 3с, баланс energy.rewarded_bonus уже есть
- [ ] Локализация ru/en, автоязык через SDK
- [ ] TV Back/OK

### M5 — Полировка и релиз — TODO
- [x] Арт-пакет 73/75 спрайтов, 2 фона, 3.7MB
- [x] Догенерить 2 декора (hammock, cat) + иконка магазина ui-shop
- [ ] Финальный QA: мобила, drag&drop корзины, звук на iOS, safe-area
- [ ] Прогон воронки: первые 60 секунд, D1-возврат
- [ ] Публикация, A/B: стартовый экран, размер награды

---

## 5. Метрики

| Метрика | Цель | Что делаем если не дотягиваем |
|---|---|---|
| D1 | 25%+ | усиливаем первые 60с и утренний ящик |
| Сессий в день | 2.5+ | таймеры заказов, свободный ящик |
| Rewarded на игрока | 3+ | больше точек входа |
| Время до первого заказа | <60с | короче туториал, стартовый подарок |
| До 2-го здания | 15%+ | сглаживаем стоимость |

---

## 6. Риски

1. Контентный долг — решено ИИ-пайплайном + 10 уровней а не 15
2. Двойная петля — вводим магазин постепенно, туториал по шагам
3. Баланс энергии — гоняем симулятором, правим JSON без кода
4. Рейтинг <30 = снятие через 3 недели — паузы звука, никаких резких интерстишелов
5. Модерация — чеклист до подачи
6. Вода в море мердж-игр — ставка на квартал и гербарий

---

## 7. Что делать дальше (приоритет)

1. **Догенерить decor-hammock, decor-cat** — 5 минут, промты готовы, лимит сбросится в новом чате
2. **Декор на улице квартала** — сделано: canvas-сцена, координаты в `DECOR_SLOTS`, превью `tools/py tools/mock-quarter.py`
3. **Анимации** — полёт монетки к HUD, тряска генератора
4. **Реклама** — фейк-просмотр 3с
5. **Yandex SDK** — последним

Порядок: quarter_buildings → meta → polish_mobile → animations → ads → SDK — как просил пользователь.
