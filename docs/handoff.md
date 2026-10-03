# Передача работы: «Цветочный квартал» — актуально на 2026-10-03, main 229d8e6

Всё, что нужно, чтобы продолжить разработку другому человеку или агенту в другом чате.
Читать целиком перед первым действием.

---

## 0. Первым делом: окружение и ветки

**Всё в `main`, без веток** — пользователь явно попросил свести работу в `main`, не оставлять arena-ветку как основную. Сейчас `main` и `arena/01a102eb-mergegame` одинаковые (229d8e6), но работа идёт в `main`.

**`node_modules` и `tools/venv` не сохраняются.** 

```bash
tools/setup.sh          # восстановить окружение
npm test                # 53 теста должны быть зелёными
npm run build           # сборка + проверка требований площадки (3.7MB, 75 картинок)
```

Если git история откатилась:

```bash
git fetch origin main
git reset --hard origin/main
```

Пушьте часто в `main`.

---

## 1. Что это за проект

Браузерная игра для Yandex Games: мердж цветов кормит тайкун цветочного магазина, магазин вырастает в квартал. Сессия 9-11 минут.

Три слоя петли:
1. Поле — клик по генератору за энергию, предметы соединяются: 3→1, 5→2, теперь drag&drop.
2. Заказы — собранные предметы сдаются за монеты.
3. Магазин и квартал — монеты → апгрейды, апгрейды открывают цепочки и здания, репутация → декор.

---

## 2. Состояние на момент передачи — main 229d8e6

### Что работает и уже в main

| Что | Где | Проверено |
|---|---|---|
| Логика поля и слияния | `src/core/board.ts` | 11 тестов |
| Игровое состояние: энергия, заказы, магазин, продажа, сейв, репутация, гербарий, декор | `src/core/game.ts` | 23 теста |
| Интерфейс: доска, заказы, магазин, квартал, гербарий, декор | `src/ui/` | 12 тестов + 3 tutorial |
| Звук синтезом + эмбиент | `src/ui/audio.ts` | 4 теста |
| Экран квартала, 6 зданий по дням, карта | `src/ui/quarter.ts` | дымовой тест |
| Туториал интерактивный spotlight | `src/ui/tutorial.ts` | 3 теста |
| Drag&drop доски мышкой и пальцем | `src/ui/app.ts` buildBoard | pointerdown/move/up + touch |
| Корзина продажи — перетаскивание в корзину | `src/ui/app.ts` sell-zone + `art/sprites/ui-sell-basket.png` | тест |
| Доска облагорожена — садовый стол с деревянной рамкой | `src/style.css` board-wrap/board | визуально |
| Энергия иконка | `src/ui/app.ts` теперь `ui-energy.png` вместо ☘ | |
| Отладка: +1000 монет, +100 энергии, +100 репутации, +1 день, Сбросить | `src/main.ts` | |
| Симулятор экономики | `tools/simulate.py` | 30 дней |
| Арт-пакет: 75 картинок в сборке (65 старых + 10 новых), 2 фона | `art/sprites`, `art/backgrounds` | QA |

**Итого: 53 теста проходят, сборка 3.7MB (лимит 100MB), 75 картинок, JS 83KB, CSS 30KB.**

### Что сгенерировано и используется

- **Старый пакет (63 спрайта):** 5 цепочек по 10 уровней (rose, wild, exotic, pack, tools) =50, 3 генератора gen-bed-01..03, 6 зданий bld-*, 4 иконки ui-coin, ui-energy, ui-rep, ui-locked, 2 фона stage-board.jpg, stage-quarter.jpg.
- **Новый пакет (10 спрайтов, в этом коммите):**
  - `ui-sell-basket.png` (19KB) — плетёная корзина с монетами, для продажи drag&drop
  - `decor-bench.png` 40KB, `decor-lantern.png` 37KB, `decor-fountain.png` 41KB, `decor-flowerbed.png` 58KB, `decor-sign.png` 64KB, `decor-birdhouse.png` 36KB, `decor-windchime.png` 20KB, `decor-gnome.png` 31KB, `decor-butterfly.png` 64KB — 9 из 11 декоров
- **Осталось сгенерировать (лимит 10 изображений за ход):** `decor-hammock.png`, `decor-cat.png` — 2 последних декора из 11. Промты уже в `art/prompts.md` и `art/manifest.json`, нужно сгенерировать в следующем чате.

### Что было забыто и пофикшено в этом цикле

1. **ui-energy иконка не использовалась:** в HUD была `☘` в `stat__dot`, а `ui-energy.png` лежала без дела. Пофикшено — теперь `img(spriteUrl('ui-energy'))` в `energyStat`.
2. **Декор из символов:** ambient-decor использовал эмодзи 🦋🐦🐱🍄✨🎐🌸 и корзина 🧺 — пользователь сказал "мне не нужен декор из символов, всё должно быть сгенерировано". Пофикшено: эмодзи убраны, корзина теперь сгенерированный ассет `ui-sell-basket.png`, ambient-decor теперь только CSS-фигуры (petal radial-gradient #FFB7C5→#E98C9B, butterfly два градиента, sparkle, glow) без символов. В идеале и ambient-decor тоже должны быть сгенерированными картинками (маленькие бабочки, птички), но пока CSS.
3. **Продажа кликом неинтересна:** раньше клик открывал попап с кнопкой Продать. Пользователь попросил только drag&drop в корзину. Пофикшено — клик теперь только инфо-попап "Перетащи в корзину" + выбор для мерджа, продажа только через корзину с анимацией.
4. **Звуков нет:** master gain 0.18 и ambient 0.12*0.18=0.0216 — слишком тихо. Пофикшено — master 0.32, ambientVolume 0.35, wind 0.25, pad 0.15, birds 0.28, все tone gains *2.6 (0.12→0.32, 0.16→0.42 и тд). Эмбиент: brown noise 400Hz lowpass, пэд 110Hz+110.5Hz биение, птички 1200-2000Hz каждые 3.5-7.5с.
5. **Отладка репутации:** не было кнопки +репутации. Добавлено +100 репутации в dev панель.
6. **Обучение перекрывало игру:** затемнение не давало нажать на генераторы. Пофикшено spotlight — затемнение только через `highlightBox` box-shadow 9999px, область цели светлая и кликабельная, overlay/backdrop pointer-events none, tooltip auto.

### Что не сделано

- **Yandex Games SDK не подключён** — отложен по просьбе пользователя в крайнюю очередь.
- **2 декора не сгенерированы:** decor-hammock, decor-cat — лимит 10 изображений за ход, нужно в следующем чате.
- **Ambient декор из сгенерированных ассетов:** сейчас CSS-фигуры, нужно сгенерировать маленькие иконки бабочек/птичек как спрайты и использовать вместо CSS.
- **Анимации:** полёт монетки к счётчику, тряска генератора, конфетти при 10 уровне — частично есть (fly-clone, reward-float, merge-particle), но можно больше.
- **Симуляция рекламы:** пользователь выбирал next_step=animations, ads_balance=yes_sim — нужно добавить кнопку "+25 энергии за рекламу" с фейк-просмотром.
- **Локализация en, TV back/ok, лидерборды** — не сделано.

---

## 3. Как запустить и проверить

```bash
tools/setup.sh
npm test          # 53 теста
npm run build     # сборка 3.7MB, 75 картинок, проверки площадки зелёные
npm run dev       # live preview
```

Баланс:
```bash
tools/py tools/simulate.py --days 30 --sessions 4 --seed 7
```

Арт:
```bash
node tools/gen-items.mjs       # из manifest.json в items.generated.ts
node tools/render-prompts.mjs  # из manifest.json + prompts.json в prompts.md
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
tools/py tools/check-sprites.py
tools/py tools/mock-board.py --layout art/layouts/board-play.json --cell 86
```

Деплой на сервер (как делает пользователь):
```bash
cd /opt/mergegame
git fetch origin main
git reset --hard origin/main
npm ci && npm run build
rm -rf /var/www/merge/* && cp -r dist/* /var/www/merge/
chown -R www-data:www-data /var/www/merge
nginx -t && systemctl reload nginx
# Cloudflare Purge Everything, открыть ?v=13
```

---

## 4. Карта репозитория — актуально

```
src/core/            логика без DOM
  board.ts           поле, группы, слияние 3→1 и 5→2, 42 клетки
  game.ts            состояние, энергия 200 cap, заказы 3 слота, магазин 6 веток, склад max 7 открывает 42, репутация, гербарий, декор 11, сериализация
  balance.ts         чтение data/balance.json
  save.ts            localStorage

src/ui/
  app.ts             доска (board-wrap с деревянной рамкой #C89A63, board белый градиент, cell 14px radius grab, drag-over розовый, sell-zone корзина ui-sell-basket.png, ambient-decor CSS), заказы, магазин, генераторы, HUD с ui-coin/ui-energy/ui-rep, туториал, звуки
  quarter.ts         квартал фуллскрин, фон через ?url импорт, карта зданий
  herbarium.ts       гербарий 50 видов
  decor.ts           декор 11 видов, теперь с иконками decor-* (сгенерированы 9)
  tutorial.ts        интерактивный spotlight: backdrop скрыт когда есть цель, highlightBox с box-shadow 9999px затемняет остальное, область цели светлая, pointer-events none, прогресс 0/3, Next disabled до действия
  audio.ts           WebAudio синтез 13 звуков + эмбиент (ветер brown noise 400Hz, пэд 110Hz биение, птички 1200-2000Hz), master 0.32, ambient 0.35, mute на мобиле по умолчанию
  sprites.ts         import.meta.glob всех png из art/sprites

art/
  manifest.json      ИСТОЧНИК ПРАВДЫ по арт-пакету: 50 предметов + 3 генератора + 6 зданий + 5 ui (energy, coin, rep, locked, sell-basket) + 11 decor =75 ассетов
  prompts.json       шаблоны, история переделок, причины
  prompts.md         полный текст промпта для каждого ассета (генерируется render-prompts.mjs) — 75 ассетов +2 фона =77, 17 с переделками
  sprites/           75 спрайтов (65 старых + 10 новых) — все с прозрачностью, без фона
  raw/               исходники от генератора 800px, нужны для перерезки
  backgrounds/       stage-board.jpg 68KB, stage-quarter.jpg 329KB
  style-test/        flowershop-keyart.png — референс стиля для КАЖДОЙ генерации (параметр images)
  layouts/           раскладки для mock-board

data/balance.json    ИСТОЧНИК ПРАВДЫ по числам: warehouse max 7 открывает всё поле, decor 11 видов (5 старых +6 новых: birdhouse, windchime, gnome, butterfly, hammock, cat)
docs/
  handoff.md         этот файл
  balance-report.md  отчёт симулятора
  concept.md, roadmap.md, style.md

tools/
  setup.sh, py, simulate.py, cutout.py, check-sprites.py, shrink-raw.py, mock-board.py, next-batch.py, gen-items.mjs, render-prompts.mjs, check-build.mjs
```

---

## 5. Арт-пайплайн — как генерировать новые ассеты (важно для продолжения в другом чате)

**Всё должно быть сгенерировано, без эмодзи и CSS-рисования.**

Шаблон промпта (из prompts.md, раздел item):
```
Isolated single {SUBJECT}, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**Обязательно передавать референс:** `art/style-test/flowershop-keyart.png` параметром `images` — без него стиль не консистентен.

**Лимит:** 10 изображений за один ход агента. Очередь партии печатает `tools/next-batch.py`.

**Порядок обработки одного ассета:**
```bash
# 1. сгенерировать по промпту из art/prompts.md, приложив ключевой арт как референс
#    сохранить в art/raw/<id>.png — используйте generate_image с images=[flowershop-keyart.png], file_path=art/raw/<id>.png, offer_options=false (чтобы не ждать выбора пользователя)
# 2. вырезать фон
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
tools/py tools/check-sprites.py
# 3. проверить в игре
npm run build
```

**Что осталось сгенерировать:**
- `decor-hammock` — "cozy hammock between two wooden posts with cream fabric"
- `decor-cat` — "cute orange tabby cat sleeping on a cream cushion"
- Промты уже в manifest.json и prompts.md, нужно только вызвать generate_image и cutout.

**Как добавить новый ассет в игру:**
1. Добавить в `art/manifest.json` в соответствующий массив (ui, decor, buildings и тд) с id и subject.
2. `node tools/render-prompts.mjs` — обновит `art/prompts.md`.
3. Сгенерировать картинку в `art/raw/<id>.png` и вырезать в `art/sprites/<id>.png`.
4. В коде использовать `spriteUrl('<id>')` — Vite подхватит автоматически через `import.meta.glob`.
5. Если это декор — добавить в `data/balance.json` в массив `decor` с ценой и эффектом, и в `src/ui/decor.ts` в `DECOR_ICONS`.

---

## 6. Что было использовано и что забыли — чеклист для следующего агента

| Ассет | Статус | Используется? |
|---|---|---|
| rose-01..10, wild-01..10, exotic-01..10, pack-01..10, tools-01..10 (50) | готово, в sprites | да, на доске и в заказах |
| gen-bed-01..03 (3) | готово | да, генераторы внизу доски |
| bld-flowershop, coffee, bakery, workshop, greenhouse, pavilion (6) | готово | да, в квартале |
| ui-coin | готово | да, в HUD монеты |
| ui-rep | готово | да, в HUD репутация и декор |
| ui-locked | готово (был extra) | да, закрытые клетки |
| ui-energy | готово, **был не использован** (в HUD был ☘) | **пофикшено** — теперь в HUD энергии |
| ui-sell-basket | **сгенерирован в этом цикле** 19KB | да, корзина продажи drag&drop |
| decor-bench, lantern, fountain, flowerbed, sign, birdhouse, windchime, gnome, butterfly (9) | **сгенерированы в этом цикле** 20-64KB | да, в экране декора |
| decor-hammock, decor-cat (2) | в manifest и prompts.md, **не сгенерированы** из-за лимита 10/ход | нет, нужно сгенерировать |
| ambient-decor (бабочки, птички из эмодзи) | был из эмодзи, **переделан** на CSS-фигуры без символов, но **должен быть из сгенерированных ассетов** | частично, нужно сгенерировать маленькие иконки |

**Итого:** из 77 ассетов в prompts.md сгенерировано 73 спрайта (65 старых +10 новых -2 фона =73? фактически 75 картинок в сборке включая фоны? check-build говорит 75 картинок — это 73 спрайта +2 фона =75). Осталось 2.

---

## 7. Требования площадки — чеклист

| Требование | Статус |
|---|---|
| SDK, LoadingAPI.ready(), GameplayAPI, pause/resume | не сделано, отложено в крайнюю очередь |
| Размер ≤100MB | ок 3.7MB |
| index.html в корне, без кириллицы/пробелов, относительные пути | ок, check-build.mjs |
| Звук глушится на рекламу | setMuted готов, ambient тоже |
| Мобильная вёрстка 900/600/380, safe-area, touch | ок, но drag&drop и корзина на мобиле нужно потестить вживую |
| Back/OK TV | не сделано |

---

## 8. Что делать дальше — предложения (запас 96MB)

1. **Догенерировать 2 декора** (hammock, cat) — 5 минут, промты готовы.
2. **Сгенерировать ambient ассеты** — маленькие бабочки, птички, лепестки как отдельные png (например `fx-butterfly-01`, `fx-petal-01`) и использовать вместо CSS в `ambient-decor` — будет красивее и соответствует требованию "всё сгенерировано".
3. **Анимации** — полёт монетки к HUD, тряска генератора, конфетти при 10 уровне (уже есть fly-clone, reward-float, merge-particle, но можно больше).
4. **Симуляция рекламы** — кнопка "+25 энергии за рекламу" с фейк-оверлеем 3с, баланс уже в `energy.rewarded_bonus`.
5. **Yandex SDK** — последним, как просил пользователь.

Порядок: сначала догенерить декор, затем ambient ассеты, затем анимации/реклама.

---

## 9. Журнал последних работ

- **b80d903..396ad16:** board-wrap деревянная рамка #C89A63 4px, board белый градиент, cell grab, drag&drop pointer events + fly-clone, sell-zone корзина, tutorial spotlight без затемнения зоны действия, energy иконка, +100 реп в отладке, звук громче, декор без эмодзи.
- **f4fbd21:** сгенерированы 10 новых ассетов (sell-basket +9 decor) через generate_image с референсом flowershop-keyart.png, cutout.py, 75 картинок в сборке.
- **229d8e6:** восстановлены удалённые файлы (herbarium, tutorial, screenshots) — единая ветка main.

---

## 10. Как продолжить в другом чате

```bash
git clone ... && cd mergegame
git checkout main
tools/setup.sh
npm test && npm run build
# посмотреть что не сгенерировано
node tools/render-prompts.mjs
cat art/prompts.md | grep -A2 "decor-hammock\|decor-cat"
# сгенерировать оставшиеся 2
# используйте generate_image с images=[art/style-test/flowershop-keyart.png], file_path=art/raw/<id>.png, prompt из prompts.md, offer_options=false
tools/py tools/cutout.py art/raw/decor-hammock.png art/raw/decor-cat.png --outdir art/sprites
npm run build
# проверить что иконка энергии используется
grep -rn "ui-energy" src/ui/app.ts
# проверить что нет эмодзи в декоре
grep -rn "🧺\|🦋\|🐦" src/
# запушить в main
git add art/raw art/sprites art/manifest.json art/prompts.md
git commit -m "feat: догенерить decor-hammock, decor-cat"
git push origin main
```

Всё, что нужно для генерации — в `art/manifest.json` (subjects), `art/prompts.json` (шаблоны и история переделок), `art/prompts.md` (готовые промты), `art/style-test/flowershop-keyart.png` (референс). Никаких внешних зависимостей.
