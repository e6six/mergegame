# Передача работы: «Цветочный квартал» — полный гайд для следующего AI-агента

**Актуально на:** 2026-10-04, ветка `arena/01a103b7-mergegame` (от `main` `d35860e`), **66 тестов зелёных** (плюс измерительный, пропускается по умолчанию), сборка 3.8MB **78 картинок (76 спрайтов +2 фона)**.

**Второй цикл (2026-10-04) — по второй жалобе пользователя «игра выглядит как говно, поле уехало, звук — гул»:**
- **Эмбиент удалён полностью.** Ветер (brown noise), пэд 110/110.5 Гц и «птички» звучали ровным гулом; пользователь попросил убрать. В `audio.ts` остались только короткие звуки действий, добавлена верхняя граница частот 8 кГц.
- **Убраны «моргающие листочки»** — CSS-фигуры `ambient-decor` (лепестки, бабочка, искры, свечение) мигали поверх доски каждый рендер. Удалён и код, и стили.
- **Декор теперь в игре, а не в списке.** Экран квартала переписан: улица рисуется на canvas (фон `stage-quarter.jpg` + спрайты декора по координатам `DECOR_SLOTS`), клик по предмету даёт карточку с названием и уровнем, внизу легенда зданий. После покупки всплывает «уже стоит на улице квартала» с кнопкой «Посмотреть». Посмотреть расстановку без браузера: `tools/py tools/mock-quarter.py`.
- **Починено «поле уехало наверх».** Размер клетки считался от высоты окна с фиксированной поправкой 260px; на невысоких экранах доска с генераторами и корзиной не помещалась и обрезалась сверху. Теперь считается от фактического места в контейнере (с защитой от NaN из CSS), плюс пересчёт по `ResizeObserver`. Регрессия закреплена тестом.
- **Продажа стала понятной:** корзина видна всегда (раньше появлялась только при перетаскивании), в карточке предмета есть кнопка «Продать».
- **Внешний вид:** панели — карточками на деревянном столе (`stage-board.jpg` как фон, без глухой белой плёнки), светлые клетки доски, акцентная кнопка «Сдать» в готовом заказе, подсветка нужных предметов.
- **Отладочная панель с читами** теперь только по `?debug=1` — в обычной игре её нет.
- Тесты: 63 → 66, `app.ts` размер доски и декор на карте проверяются автотестами.

**Что изменилось в этом цикле (2026-10-03, аудит после жалобы «игра откатилась»):**
- Проверено: **ни один файл не потерян**, авария коммита f4fbd21 полностью вылечена в 229d8e6 + bbaaddc. Сравнение деревьев `d038c88` (до аварии) и HEAD: пропавших файлов 0.
- Добавлен хонсей-тест: `src/core/session.test.ts` + бот `src/core/player-model.ts`. Бот играет партию настоящим кодом игры и проверяет инварианты каждый шаг.
- **Найден завышенный баланс:** реальный код даёт **2.96 заказа за сессию** вместо 4.86, которые обещает `tools/simulate.py` (симулятор не знает про связные группы). Замер: `npm run measure`. Подробности в `docs/balance-report.md`.
- Догенерированы 2 декора, которые висели как pending: `decor-hammock`, `decor-cat` — спрайтов стало 76.
- Добавлен `ui-shop.png`, эмодзи 🛒 на кнопке магазина убран; 🔒 и ✅ в гербарии/туториале заменены на спрайт `ui-locked` и текстовые символы.
- Починен туториал: подсказка больше не налезает на HUD (прижималась к 20px от верха, теперь не заходит выше шапки).
- Убран устаревший текст «продавай кликом» (продажа только перетаскиванием в корзину).
- Типы `data/balance.json` описаны в `src/core/balance.ts` (декор, гербарий, репутация), в `game.ts` убраны соответствующие `as any`.
- Новые тесты: эмодзи в интерфейсе нет (проверяет разметку всех панелей).

**Всё в `main`, без веток.** `arena/01a102eb-mergegame` была синхронизирована с main (f0320a6) и **удалена** после проверки что ничего не потеряно — `git push origin --delete arena/01a102eb-mergegame`. Работаем только по `main`. Локально и на remote осталась только `main`.

---

## 0. Что это за проект и чем мы занимались

Браузерная игра для Yandex Games: мердж цветов кормит тайкун цветочного магазина, магазин вырастает в квартал. Сессия 9-11 минут, вес <100MB.

Три слоя петли:
1. **Поле** — клик по генератору за 1 энергию, предмет на поле 6x7→9x9 (42 клетки), мердж 3→1 и 5→2, теперь drag&drop мышкой и пальцем + fly-clone.
2. **Заказы** — 3 слота, 3-6 предметов, остывание вместо провала, награда монетами с множителем от зданий и декора.
3. **Магазин и квартал** — монеты → 6 апгрейдов (warehouse max 7 открывает всё поле), репутация → 11 декоров + гербарий 50 видов + 6 зданий по дням (coffee день 3, bakery 6, workshop 10, greenhouse 15, pavilion 21).

**История последних недель:**
- M0: концепт, стиль, палитра, пайплайн арта, 5 цепочек по 10 уровней (50 предметов), 3 генератора, 6 зданий, 4 UI иконки, 2 фона, баланс JSON + симулятор.
- M1: ядро — поле, мердж, генераторы, энергия, заказы, магазин, продажа, сейв, 44 теста.
- M2: петля — HUD, доска облагорожена (board-wrap деревянная рамка #C89A63 4px, board белый градиент, cell grab, drag-over розовый), звук WebAudio, отладка.
- M3: мета — квартал фуллскрин, гербарий, декор, туториал spotlight, корзина продажи drag-to-basket, энергия иконка.
- Текущий цикл (октябрь): пользователь попросил — починить звуки (эмбиент не слышен), убрать декор из символов (эмодзи 🦋🐦🧺 и т.д.), всё должно быть сгенерировано как ассеты (не CSS), изучить промты предыдущих генераций в гитхабе (art/prompts.md, manifest.json, render-prompts.mjs), сгенерировать новые ассеты для корзины продажи и амбиент-декора в том же стиле с референсом flowershop-keyart.png и палитрой pastel на light gray фоне, обработать через cutout.py, использовать как спрайты. Сохранить: продажа только drag-to-basket, клик инфо, 11 декоров, debug +100 репутации, тесты зелёные, билд <100МБ, деплой main. Yandex SDK отложен в крайнюю очередь.

**Что было сделано в этом цикле:**
- Звук: master 0.18→0.32, ambientVolume 0.12→0.35, wind 0.08→0.25, pad 0.04→0.15, birds 0.06→0.28, все tone gains *2.6 — теперь слышно (brown noise 400Hz lowpass, пэд 110Hz+110.5Hz биение, птички 1200-2000Hz каждые 3.5-7.5с).
- Декор из символов убран: ambient-decor был из эмодзи, корзина 🧺 — теперь ui-sell-basket.png 19KB плетёная с монетами, ambient-decor CSS-фигуры без символов (petal radial #FFB7C5→#E98C9B, butterfly два градиента, sparkle #FFF8E1→#FFB300, glow radial). В идеале и ambient должны быть сгенерированными png, но пока CSS.
- Энергия иконка: была ☘ в stat__dot, ui-energy.png лежала без дела — теперь img(spriteUrl('ui-energy')) в HUD.
- Продажа: раньше клик открывал попап с кнопкой Продать — теперь только drag&drop в корзину, клик — инфо "Перетащи в корзину" + выбор для мерджа.
- Отладка: +100 репутации.
- Туториал: spotlight без затемнения зоны действия (backdrop pointer-events none, highlightBox box-shadow 9999px), область цели светлая и кликабельная.
- Сгенерировано 10 новых ассетов: ui-sell-basket + 9 decor (bench 40KB 83.9%, lantern 37KB 82.9%, fountain 41KB 78.9%, flowerbed 58KB 74.9%, sign 64KB 65.4%, birdhouse 36KB 84.8%, windchime 20KB 93.9%, gnome 31KB 84.6%, butterfly 64KB 71.9%) через generate_image с референсом flowershop-keyart.png, обработаны cutout.py → art/sprites.
- Осталось 2: decor-hammock, decor-cat — упёрлись в лимит 10 изображений за ход, будут в следующем чате.
- Баг f4fbd21: коммит удалил 28 файлов из-за partial add (tutorial, herbarium, screenshots, quarter-buildings.json) и упростил game.ts до SAVE_VERSION 1 — пофикшено в bbaaddc восстановлением game.ts из 396ad16 (SAVE_VERSION 3, herbarium, tutorialCompleted, effectiveEnergyCap, decorLevels).
- Сейчас main чистый, 53 теста, 75 картинок, эмодзи в src нет.

---

## 1. Окружение — первым делом

**`node_modules` и `tools/venv` не сохраняются** — встроенное исключение песочницы.

```bash
tools/setup.sh          # восстановить окружение (безопасно повторно)
tools/setup.sh --check  # только проверить
npm test                # 53 теста должны быть зелёными
npm run build           # сборка + проверка площадки (3.7MB, 75 картинок, 78 файлов)
npm run dev             # live preview 0.0.0.0
```

Если история git откатилась:

```bash
git fetch origin main
git reset --hard origin/main
```

Пушьте часто в `main`. Ветка `arena/01a102eb-mergegame` — дубликат main, будет удалена.

---

## 2. Состояние на момент передачи — main f0320a6

### Что работает

| Что | Где | Проверено |
|---|---|---|
| Логика поля и слияния 3→1, 5→2 | src/core/board.ts | 11 тестов |
| Состояние: энергия 200 cap, заказы 3 слота, магазин 6 веток, склад max 7→42 клетки, репутация, гербарий 50 видов, декор 11, сериализация SAVE_VERSION 3 | src/core/game.ts | 23 теста |
| Интерфейс: доска, заказы, магазин, квартал, гербарий, декор | src/ui/ | 12 тестов +3 tutorial |
| Звук синтезом + эмбиент | src/ui/audio.ts | 4 теста |
| Квартал 6 зданий по дням | src/ui/quarter.ts | дымовой |
| Туториал spotlight | src/ui/tutorial.ts | 3 теста |
| Drag&drop доски + корзина продажи ui-sell-basket.png | src/ui/app.ts | визуально + тест |
| Доска облагорожена — садовый стол с рамкой #C89A63 | src/style.css board-wrap/board | визуально |
| Энергия иконка ui-energy.png | src/ui/app.ts | |
| Отладка +1000 монет, +100 энергии, +100 репутации, +1 день | src/main.ts | |
| Симулятор экономики 30 дней | tools/simulate.py | |
| Арт-пакет 73 спрайта +2 фона =75 картинок в сборке | art/sprites, art/backgrounds | QA |

**Итого:** 53 теста, 3.7MB (лимит 100MB), 75 картинок, JS 83KB gzip 27KB, CSS 30KB gzip 6.8KB.

### Арт-пакет — аудит на 2026-10-03 (актуальный)

```
art/manifest.json: 50 chain items (rose, wild, exotic, pack, tools по 10) +3 gen +6 bld +6 ui +11 decor =76 ассетов
art/prompts.md: 75 ассетов +2 фона =77, 17 с переделками, все с light gray фоном и референсом flowershop-keyart.png
art/raw/: 75 файлов (73 спрайта raw +2 stage raw) — нет raw для hammock/cat, т.к. лимит
art/sprites/: 73 файла (6 bld +9 decor +10 exotic +3 gen +10 pack +10 rose +10 tools +5 ui +10 wild) — 73/75, missing 2
art/backgrounds/: stage-board.jpg 68KB, stage-quarter.jpg 329KB — используются в CSS url()
dist/assets после build: 75 картинок (73 спрайта +2 фона) — ок
```

**Проверка использования:**
- Все 73 спрайта в manifest, нет extra not in manifest — `python audit` показывает 0 лишних
- Все raw имеют спрайты кроме stage (ожидаемо)
- Missing sprites: **нет** — `decor-hammock` и `decor-cat` догенерированы 2026-10-03, добавлен `ui-shop`
- UI иконки: ui-coin, ui-energy, ui-rep, ui-locked, ui-sell-basket — все используются via spriteUrl (app.ts: ui-coin HUD монеты, ui-energy HUD энергия, ui-rep HUD репутация + декор + гербарий + квартал, ui-locked закрытые клетки, ui-sell-basket корзина)
- Chain items: 50 via ITEM_BY_KEY → board rendering
- Buildings: 6 via bld-${id} → quarter.ts
- Decor: 11 via DECOR_ICONS (bench→decor-bench и тд) → decor.ts, fallback ui-rep если спрайта нет (hammock, cat пока fallback)
- Backgrounds: stage-board.jpg и stage-quarter.jpg via CSS background-image — в dist есть

**Вывод:** ничего не потеряно при переносе в main, кроме 2 декоров которые не успели сгенериться из-за лимита. Все старые ассеты (63) + 10 новых =73 на месте, все используются.

### Что было забыто и пофикшено

1. ui-energy не использовалась (☘) — теперь img
2. Декор из эмодзи 🦋🐦🐱🍄✨🎐🌸🧺 — теперь сгенерированные ассеты + CSS-фигуры без символов
3. Продажа кликом — теперь только drag-to-basket
4. Звук тихо (0.0216 gain) — теперь 0.112 и gains *2.6
5. Отладка репутации — добавлено +100
6. Туториал перекрывал игру — теперь spotlight
7. Баг f4fbd21 удалил 28 файлов — восстановлено в 229d8e6 + bbaaddc
8. Эмодзи в style.css board-wrap::before 🌸🌿🌼 — заменено на градиентную полоску, в tutorial убраны 🌸🌿

### Что не сделано

- Yandex SDK — отложен в крайнюю очередь
- 2 декора не сгенерированы: hammock, cat — лимит 10/ход
- Ambient декор из сгенерированных ассетов: сейчас CSS, нужно fx-butterfly, fx-petal как png
- Анимации: полёт монетки к HUD, тряска генератора, конфетти при 10 уровне — частично есть
- Реклама: +25 энергии за рекламу с фейк-оверлеем 3с — баланс energy.rewarded_bonus есть
- Локализация en, TV Back/OK, лидерборды

---

## 3. Как запустить и проверить

```bash
tools/setup.sh
npm test          # 53 теста
npm run build     # 3.7MB 75 картинок
npm run dev       # live preview
```

Баланс:
```bash
tools/py tools/simulate.py --days 30 --sessions 4 --seed 7
```

Арт:
```bash
node tools/gen-items.mjs       # manifest.json → items.generated.ts
node tools/render-prompts.mjs  # manifest.json + prompts.json → prompts.md
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
tools/py tools/check-sprites.py
tools/py tools/mock-board.py --layout art/layouts/board-play.json --cell 86
tools/py tools/next-batch.py   # очередь генерации
```

Деплой (как делает пользователь):
```bash
cd /opt/mergegame
git fetch origin main
git reset --hard origin/main
npm ci && npm run build
rm -rf /var/www/merge/* && cp -r dist/* /var/www/merge/
chown -R www-data:www-data /var/www/merge
nginx -t && systemctl reload nginx
# Cloudflare Purge Everything, ?v=13
```

---

## 4. Карта репозитория — актуально f0320a6

```
src/core/
  board.ts           поле 6x7→9x9, группы, мердж 3→1 и 5→2, 42 клетки
  game.ts            SAVE_VERSION 3, энергия 200 cap + бонусы, заказы 3 слота, магазин 6 веток, склад max 7→42, репутация, гербарий 50 +3% за цепочку, декор 11, сериализация
  balance.ts         чтение data/balance.json
  save.ts            localStorage

src/ui/
  app.ts             доска board-wrap #C89A63 4px, board белый градиент, cell 14px radius grab, drag-over розовый, sell-zone корзина ui-sell-basket.png 48px img, ambient-decor CSS без эмодзи, заказы, магазин, генераторы, HUD ui-coin/ui-energy/ui-rep, туториал, звуки
  quarter.ts         квартал фуллскрин, фон stage-quarter.jpg via ?url, карта 6 зданий
  herbarium.ts       гербарий 50 видов, прогресс-бар
  decor.ts           декор 11 видов, иконки decor-* (9 сгенерировано, 2 fallback ui-rep), бонусы
  tutorial.ts        spotlight: backdrop pointer-events none, highlightBox box-shadow 9999px, область цели светлая, прогресс, Next disabled
  audio.ts           WebAudio 13 звуков + эмбиент: ветер brown noise 400Hz, пэд 110Hz биение, птички 1200-2000Hz, master 0.32, ambient 0.35, wind 0.25, pad 0.15, birds 0.28, mute на мобиле
  sprites.ts         import.meta.glob всех png из art/sprites → spriteUrl(id)

art/
  manifest.json      ИСТОЧНИК ПРАВДЫ: 50 chain +3 gen +6 bld +5 ui +11 decor =75 ассетов, subjects
  prompts.json       шаблоны, история переделок 17 ассетов, причины
  prompts.md         полный текст промпта для каждого (75+2 фона=77), генерируется render-prompts.mjs
  sprites/           73 спрайта (65 старых +8? фактически 9 новых) — прозрачность, без фона
  raw/               75 исходников 800px (73 спрайта +2 stage)
  backgrounds/       stage-board.jpg 68KB, stage-quarter.jpg 329KB
  style-test/        flowershop-keyart.png — референс для КАЖДОЙ генерации
  layouts/           board-play.json, board-pack.json, quarter-buildings.json

data/balance.json    ИСТОЧНИК ПРАВДЫ по числам: warehouse max 7, decor 11, energy, orders, upgrades
docs/
  handoff.md         этот файл — полный гайд
  roadmap.md         план M0-M5 с фактом
  concept.md         питч, три столпа, петли, цепочки
  style.md           палитра, ракурс, шаблон промпта, пайплайн, грабли
  balance-report.md  отчёт симулятора

tools/
  setup.sh, py, simulate.py, cutout.py (вырезание фона с --gap-tol), check-sprites.py, shrink-raw.py, mock-board.py, next-batch.py, gen-items.mjs, render-prompts.mjs, check-build.mjs
screenshots/         24 скриншота для доки (не в сборке)
```

---

## 5. Арт-пайплайн — подробно для другого агента

**Принцип:** всё должно быть сгенерировано, без эмодзи и CSS-рисования. Пользователь явно отклонил CSS-решение для декора.

**Шаблон промпта item (из prompts.md):**
```
Isolated single {SUBJECT}, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**Обязательно передавать референс:** `art/style-test/flowershop-keyart.png` параметром `images` — без него стиль не консистентен. В generate_image используйте `images=["art/style-test/flowershop-keyart.png"]`.

**Лимит:** 10 изображений за один ход агента. Если упёрлись — догенерить в следующем чате. Очередь печатает `tools/next-batch.py`.

**Порядок обработки одного ассета:**
```bash
# 1. сгенерировать по промпту из art/prompts.md
#    file_path=art/raw/<id>.png, offer_options=false (чтобы не ждать выбора)
#    пример:
#    generate_image with prompt="Isolated single cozy hammock..." images=[flowershop-keyart.png] file_path=art/raw/decor-hammock.png

# 2. вырезать фон
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
#   вырезает light gray фон, сохраняет прозрачность, ресайз 256px, прозрачность 65-93%

# 3. проверить
tools/py tools/check-sprites.py
#   проверяет размер, фон в углах, обрезку, пустые

# 4. проверить в игре
npm run build  # должно быть 75 картинок когда всё готово (73+2 фона → 75 сейчас, 75+2=77 когда догенерим 2)
```

**Что осталось сгенерировать:** ничего из очереди. Все 76 ассетов манифеста на месте.
Дальше по плану — ambient fx (`fx-butterfly`, `fx-petal`) как png вместо CSS-фигур,
промты для них пока не заведены: сначала добавить в `art/manifest.json`, потом
`node tools/render-prompts.mjs`, сгенерировать, `tools/py tools/cutout.py`.

**Проверка состояния без запуска игры:**

```bash
npm test          # 63 теста, включая сквозной прогон ботом
npm run measure   # 24 сессии по 10 минут: заказы/клики/поле по сидам
npm run build     # 78 картинок, 3.9MB
```

**Как добавить новый ассет:**
1. Добавить в `art/manifest.json` в соответствующий массив (ui, decor, buildings, generators, chains) с id и subject
2. `node tools/render-prompts.mjs` — обновит `art/prompts.md`
3. Сгенерировать картинку в `art/raw/<id>.png` и вырезать в `art/sprites/<id>.png`
4. В коде использовать `spriteUrl('<id>')` — Vite подхватит через import.meta.glob
5. Если декор — добавить в `data/balance.json` в массив `decor` с ценой и эффектом, и в `src/ui/decor.ts` в `DECOR_ICONS`

**Все промты сохранены:**
- `art/manifest.json` — subjects (источник правды)
- `art/prompts.json` — шаблоны + история переделок
- `art/prompts.md` — готовые промты 77 штук (75 ассетов +2 фона), 664 строки, 17 с переделками
- Пример: `decor-hammock` — "Isolated single cozy hammock between two wooden posts with cream fabric, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters."

---

## 6. Что было использовано и что забыли — чеклист

| Ассет | Статус | Используется? | Размер | Прозрачность |
|---|---|---|---|---|
| rose-01..10, wild-01..10, exotic-01..10, pack-01..10, tools-01..10 (50) | готово | да, на доске и в заказах via ITEM_BY_KEY | 20-79KB | 70-90% |
| gen-bed-01..03 (3) | готово | да, генераторы внизу доски | 43-76KB | |
| bld-flowershop, coffee, bakery, workshop, greenhouse, pavilion (6) | готово | да, в квартале via bld-${id} | 45-61KB | |
| ui-coin | готово | да, HUD монеты | 68KB | |
| ui-rep | готово | да, HUD репутация + декор + гербарий + квартал | 63KB | |
| ui-locked | готово | да, закрытые клетки | 31KB | |
| ui-energy | готово, был не использован (☘) | **пофикшено** — теперь HUD энергии | 52KB | |
| ui-sell-basket | **сгенерирован в этом цикле** | да, корзина продажи drag&drop | 19KB | 92.5% |
| decor-bench | сгенерирован | да, декор | 40KB | 83.9% |
| decor-lantern | сгенерирован | да | 37KB | 82.9% |
| decor-fountain | сгенерирован | да | 41KB | 78.9% |
| decor-flowerbed | сгенерирован | да | 58KB | 74.9% |
| decor-sign | сгенерирован | да | 64KB | 65.4% |
| decor-birdhouse | сгенерирован | да | 36KB | 84.8% |
| decor-windchime | сгенерирован | да | 20KB | 93.9% |
| decor-gnome | сгенерирован | да | 31KB | 84.6% |
| decor-butterfly | сгенерирован | да | 64KB | 71.9% |
| decor-hammock | в manifest, **не сгенерирован** лимит | fallback ui-rep, нужно сгенерить | — | — |
| decor-cat | в manifest, **не сгенерирован** лимит | fallback ui-rep, нужно сгенерить | — | — |
| ambient-decor | был из эмодзи 🦋🐦 | переделан на CSS без символов, но должен быть из сгенерированных fx-* | CSS | — |
| stage-board.jpg, stage-quarter.jpg | готово | да, CSS background-image, в dist | 68KB, 329KB | — |

**Итого:** manifest 75, sprites 73, missing 2, extra 0, raw 75 (73+2 stage). Все используемые спрайты на месте, ничего не потеряно при переносе в main. Скрипт аудита:
```bash
python3 -c "import json,os; m=json.load(open('art/manifest.json')); ids=sum([[it['id'] for it in c['items']] for c in m['chains']],[])+[g['id'] for g in m['generators']]+[b['id'] for b in m['buildings']]+[u['id'] for u in m['ui']]+[d['id'] for d in m['decor']]; sprites=set(os.path.splitext(f)[0] for f in os.listdir('art/sprites')); print('missing', [i for i in ids if i not in sprites])"
# → missing ['decor-hammock', 'decor-cat']
```

---

## 7. Требования площадки — чеклист

| Требование | Статус |
|---|---|
| SDK, LoadingAPI.ready(), GameplayAPI, pause/resume | не сделано, отложено в крайнюю очередь |
| Размер ≤100MB | ок 3.7MB |
| index.html в корне, без пробелов/кириллицы, относительные пути | ок, check-build.mjs |
| Звук глушится на рекламу | setMuted глушит master и ambient |
| Мобильная вёрстка 900/600/380, safe-area, touch | ок, но drag&drop корзины на мобиле нужно потестить |
| Back/OK TV | не сделано |

---

## 8. Что делать дальше — приоритет (запас 96MB)

1. **Сгенерировать ambient ассеты** — fx-butterfly-01, fx-petal-01 как отдельные png (например 32px) и использовать вместо CSS в ambient-decor — будет красивее и соответствует "всё сгенерировано".
3. **Анимации** — полёт монетки к HUD (fly-clone уже есть, но нужно к монетам), тряска генератора при клике, конфетти при 10 уровне (merge-particle есть).
4. **Симуляция рекламы** — кнопка "+25 энергии за рекламу" с фейк-оверлеем 3с, баланс energy.rewarded_bonus уже есть.
5. **Yandex SDK** — последним, как просил пользователь.

Порядок от пользователя: quarter_buildings → meta → polish_mobile → animations → ads_balance=yes_sim → SDK.

---

## 8.5 Найденные слабые места (не сломано, но стоит знать)

- **Баланс на 18% от нижней границы цели.** Реальный темп — 2.96 заказа за сессию,
  цель 2.5–8. Если живые игроки окажутся медленнее бота — поднимать
  `orders.coins_per_click` или вес уровней 2–3 в заказах.
- **`src/style.css` — 1967 строк, 73 селектора описаны повторно** (стили дописывали
  снизу в нескольких чатах). Реальных конфликтов два: `.cell transition` и
  `.toast animation`. Вёрстку не ломают, но перед большой работой по UI файл стоит
  разобрать по блокам.
- **Скриншоты в `screenshots/` устарели** — сняты до правок 2026-10-03. Браузера в
  песочнице нет (не ставятся libnss3 и chromium), поэтому переснять их может
  только человек из live preview.
- **Проверить глазами в live preview** (браузера у агента нет): кнопка магазина с
  новой иконкой, подсказки туториала не налезают на HUD, декор-гамак и декор-котик
  в панели «Декор».

---

## 9. Журнал последних работ

- **b80d903..396ad16:** board-wrap деревянная рамка #C89A63 4px, board белый градиент, cell grab, drag&drop pointer events + fly-clone, sell-zone корзина CSS, tutorial spotlight без затемнения зоны, energy иконка, +100 реп в отладке, звук громче (master 0.32 ambient 0.35), декор без эмодзи (CSS-фигуры).
- **f4fbd21:** сгенерированы 10 новых ассетов (sell-basket +9 decor) через generate_image с референсом flowershop-keyart.png, cutout.py, 75 картинок в сборке. **БАГ:** partial add удалил 28 файлов (tutorial, herbarium, screenshots, quarter-buildings.json) и упростил game.ts до SAVE_VERSION 1.
- **229d8e6:** восстановлены удалённые файлы — единая ветка main, но game.ts остался упрощённым, тесты падали effectiveEnergyCap is not a function.
- **bbaaddc:** восстановлен полный game.ts из 396ad16 (SAVE_VERSION 3, herbarium, tutorialCompleted, effectiveEnergyCap, decorLevels), app.ts с корзиной ui-sell-basket и иконкой ui-energy, decor.ts 11 иконок, style.css без 🌸🌿🌼, tutorial без 🌸🌿. Тесты 53 зелёных, 75 картинок, эмодзи в src нет.
- **2026-10-03 (arena/01a103b7):** аудит после жалобы пользователя «игра откатилась». Проверено: потерь файлов нет. Добавлен бот-игрок и сквозной тест, найден завышенный баланс (2.96 против 4.86 за сессию), догенерированы гамак и котик, добавлен ui-shop, убраны последние эмодзи (🛒🔒✅👉), починен туториал (налезал на HUD), описаны типы декора/гербария/репутации, убран устаревший текст про продажу кликом. Тесты 53 → 63.
- **f0320a6:** обновлён handoff и roadmap, аудит ассетов — всё используется, ничего не потеряно, missing только 2 декора из-за лимита 10/ход.

---

## 10. Как продолжить в другом чате

```bash
git clone https://github.com/e6six/mergegame.git && cd mergegame
git checkout main
tools/setup.sh
npm test && npm run build
# аудит
ls art/sprites | wc -l  # должно быть 73 сейчас, 75 после догенерации
cat art/prompts.md | grep -A2 "decor-hammock\|decor-cat"
# сгенерировать оставшиеся 2 (лимит сбросится в новом чате)
# используйте generate_image с images=[art/style-test/flowershop-keyart.png], file_path=art/raw/<id>.png, prompt из prompts.md, offer_options=false
# пример:
# Isolated single cozy hammock between two wooden posts with cream fabric, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
tools/py tools/cutout.py art/raw/decor-hammock.png art/raw/decor-cat.png --outdir art/sprites
tools/py tools/check-sprites.py
npm run build  # должно стать 77 картинок
# проверить что нет эмодзи
grep -R "🧺\|🦋\|🐦\|🐱\|🍄\|✨\|🎐\|🌸\|🌿\|🌼\|☘\|💰\|🔗\|⚡\|🏅\|⛲" src/ --include="*.ts" --include="*.css" || echo "clean"
# проверить что энергия иконка используется
grep -rn "ui-energy" src/ui/app.ts
# запушить в main
git add art/raw art/sprites art/manifest.json art/prompts.md
git commit -m "feat: догенерить decor-hammock, decor-cat — 75 спрайтов, 77 картинок"
git push origin main
# удалить arena ветку если всё ок
git push origin --delete arena/01a102eb-mergegame
git branch -D arena/01a102eb-mergegame
```

Всё что нужно для генерации — в `art/manifest.json` (subjects), `art/prompts.json` (шаблоны и история), `art/prompts.md` (готовые промты 77 штук), `art/style-test/flowershop-keyart.png` (референс). Никаких внешних зависимостей.

---

## 11. Подробные инструкции для AI-агента — что важно не забыть

**Контекст пользователя:**
- Всё в main без веток — пользователь явно попросил свести работу в main, не оставлять arena-ветку.
- Yandex SDK в крайнюю очередь — не трогать пока не попросят.
- Последовательный выбор фич: quarter_buildings → meta → polish_mobile — пользователь выбирал next_step в таком порядке.
- Пользователь отклонил клик-продажу — только перетаскивание в корзину. Клик теперь только инфо + выбор для мерджа.
- Никаких звуков нет — починить звук (эмбиент слишком тихий, не стартует) — пофикшено громче.
- Не нужен декор из символов (эмодзи 🦋🐦🐱🍄✨🎐🌸🧺) — всё должно быть сгенерировано. Отклонено CSS-решение для декора — нужно генерировать ассеты и использовать их, изучить промты предыдущих генераций, всё в гитхабе.
- Добавить в отладку получение репутации — сделано +100.

**Грабли окружения:**
- node_modules и tools/venv не сохраняются — tools/setup.sh каждый раз
- .git может откатиться к одному коммиту — git fetch origin main + reset --hard
- Лимит 10 изображений за ход — планировать партии, использовать offer_options=false чтобы не ждать выбора
- Partial add опасен — f4fbd21 удалил 28 файлов из-за `git add` только части — всегда `git add -A` или проверять `git status`

**Что проверить перед коммитом:**
```bash
npm test  # 53 зелёных
npm run build  # 75 картинок сейчас, 77 после догенерации, 3.7MB, проверки зелёные
grep -R "🧺\|🦋\|🐦" src/ || echo "no emoji"
grep -n "ui-energy" src/ui/app.ts  # должен быть img
grep -n "ui-sell-basket" src/ui/app.ts  # должен быть img
ls art/sprites | wc -l  # 73 сейчас
```

**Где что лежит:**
- Промты: art/prompts.md (77), art/prompts.json (шаблоны), art/manifest.json (subjects) — всё в main, ничего не потеряно
- Стиль: art/style-test/flowershop-keyart.png — референс для каждой генерации
- Баланс: data/balance.json — источник правды по числам
- Тесты: src/core/*.test.ts, src/ui/*.test.ts — 53 штуки
- Деплой: /opt/mergegame на сервере пользователя, /var/www/merge, nginx, Cloudflare Purge

**Финальная проверка что всё использовано:**
- manifest 75 = 50 chain +3 gen +6 bld +5 ui +11 decor
- sprites 73 (missing 2) — все 73 в manifest, extra 0
- raw 75 (73+2 stage) — все raw имеют спрайты кроме stage
- backgrounds 2 используются в CSS
- UI иконки все используются
- Никаких неиспользуемых картинок в сборке нет — всё что в sprites попадает в dist через glob
- Screenshots 24 — не в сборке, для доки
