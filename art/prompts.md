# Промпты ассетов

Сгенерировано командой `node tools/render-prompts.mjs` из `art/manifest.json`
и `art/prompts.json`. Руками не править — правьте исходные файлы.

**Референс стиля для каждого запроса:** `art/style-test/flowershop-keyart.png`
передаётся параметром `images`. Без него словесное описание стиля не работает.

**Лимит генерации:** 10 изображений за один ход. Очередь партии печатает
`tools/next-batch.py` по манифесту.

---

## Шаблоны промптов

### item

```text
Isolated single {SUBJECT}, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

### building

```text
Isolated single {SUBJECT}, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```

### uiIcon

```text
Isolated single {SUBJECT}, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, {PALETTE}, clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, icon fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

### Варианты палитры

- **gold**: `pastel palette with gold accents (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63)`
- **darkAccents**: `pastel palette with dark accents (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, gold)`
- **terracotta**: `pastel palette plus terracotta red accent (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, terracotta #C4674F)`
- **navy**: `pastel palette plus deep navy blue accent (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, navy #34435E)`
- **warmGold**: `warm gold and cream palette`

---

## Приёмы, которые пришлось выяснить на практике

- Всегда передавать flowershop-keyart.png как референс: слова «matching the reference art style» без картинки не работают.
- Однотонный светло-серый фон + требование «plain flat uniform light gray background filling the entire frame» — тогда tools/cutout.py вырезает предмет без остатков.
- «no cast shadow on ground» обязательно: тень на полу создаёт размытый ореол, который не отделяется от фона.
- «no text, no letters» обязательно: генератор любит добавлять подписи, которые потом приходится вырезать.
- Лестницу цепочки описывать как РАЗНЫЕ предметы (бутон → букет → корзина → арка), а не «то же, но больше»: разные объекты генератор рисует консистентно, масштабирование одного — нет.
- Для верхних уровней добавлять «legendary ... with a soft warm glow» и менять палитру (золото, тёмные акценты) — это визуально выделяет редкое.
- Когда уровни сливаются — менять не только цвет, но и материал/силуэт (дерево → металл → золото), иначе генератор повторит форму.

---

## Ассеты


### Роза (rose)

**rose-01** — 1. Бутон розы

```text
Isolated single closed pink rosebud on a short green stem with two small leaves, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-02** — 2. Роза

```text
Isolated single single fully bloomed dusty-pink rose with stem and two leaves, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-03** — 3. Три розы

```text
Isolated single small posy of three pink roses tied with a cream ribbon, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-04** — 4. Букет в бумаге

```text
Isolated single bouquet of pink roses wrapped in a cone of kraft paper, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-05** — 5. Корзина роз

```text
Isolated single wicker basket filled with pink and cream roses, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-06** — 6. Композиция в вазе

```text
Isolated single rose arrangement in a cream ceramic vase, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-07** — 7. Свадебный букет

```text
Isolated single wedding bouquet of white and blush roses with eucalyptus sprigs and a trailing ribbon, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-08** — 8. Арт-бокс

```text
Isolated single elegant round hat-box flower arrangement of pink roses with a satin ribbon, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-09** — 9. Цветочная арка

_Попытка 1 (отклонён):_ переделан: в превью читалась как зеркало, а не как арка

```text
Isolated single grand round flower arch decorated with pink roses and greenery on a wooden stand, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят

```text
Isolated single freestanding arch-shaped trellis made of thin curved wooden laths standing on two wooden posts, completely open in the middle with clearly empty space inside the arch opening, densely covered on its frame with pink roses, cream flowers and green leaves, no glass, no mirror, no reflective surface, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**rose-10** — 10. Чёрная роза

```text
Isolated single legendary single black rose with deep crimson-black velvet petals and a thin gold ribbon tied on the stem, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette with dark accents (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, gold), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят с первого раза_


### Полевые (wild)

**wild-01** — 1. Ромашка

```text
Isolated single single white daisy with a yellow center on a green stem, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-02** — 2. Пучок ромашек

```text
Isolated single small bunch of white daisies tied with rough twine, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-03** — 3. Венок

```text
Isolated single delicate flower crown woven from daisies and small white blossoms, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-04** — 4. Сноп полевых

```text
Isolated single sheaf of mixed wildflowers: cornflowers, red poppies and daisies, tied with a straw band, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-05** — 5. Кашпо с полевыми

```text
Isolated single terracotta pot filled with wildflowers and grasses, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-06** — 6. Лукошко

```text
Isolated single shallow wicker trug filled with wildflowers and cornflowers, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-07** — 7. Сухоцвет

```text
Isolated single hanging bundle of dried wildflowers in muted warm wheat and lavender tones, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-08** — 8. Полевой букет

```text
Isolated single large rustic bouquet of wildflowers wrapped in burlap and tied with twine, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-09** — 9. Луг в ящике

```text
Isolated single long wooden planter box containing a miniature meadow of wildflowers and grasses, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**wild-10** — 10. Золотой луг

```text
Isolated single legendary golden wildflower arrangement of sunflowers and golden wheat with a soft warm glow and a thin gold ribbon, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_первая попытка не прошла генерацию, повторная принята_


### Экзотика (exotic)

**exotic-01** — 1. Суккулент

```text
Isolated single small green succulent in a tiny terracotta pot, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-02** — 2. Орхидея

```text
Isolated single single white orchid in a small ceramic pot, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-03** — 3. Цветущий кактус

```text
Isolated single round flowering cactus with a pink blossom in a terracotta pot, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-04** — 4. Орхидея в кашпо

```text
Isolated single tall purple orchid in a decorative glazed pot, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-05** — 5. Монстера

```text
Isolated single potted monstera plant with large split leaves in a woven basket, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-06** — 6. Бонсай

```text
Isolated single small bonsai tree in a shallow ceramic tray with moss, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-07** — 7. Тропическая композиция

```text
Isolated single tropical flower arrangement with a bird of paradise flower and broad leaves in a tall vase, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-08** — 8. Пальма в кадке

```text
Isolated single tall potted palm tree in a wooden barrel planter, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-09** — 9. Оранжерейный гигант

```text
Isolated single huge exotic plant with giant glossy leaves and hanging blossoms in an ornate stone planter, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**exotic-10** — 10. Райская птица

```text
Isolated single legendary bird of paradise flower with iridescent orange and blue petals, gold accents and a subtle glow, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят_


### Упаковка (pack)

**pack-01** — 1. Бумага

```text
Isolated single roll of kraft wrapping paper with a loose sheet curling out, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-02** — 2. Розовая лента

_Попытка 1 (отклонён):_ переделан: кремовая гамма сливалась с pack-01 и pack-03

```text
Isolated single spool of cream satin ribbon with a loose bow, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят

```text
Isolated single spool of dusty pink satin ribbon with a loose bow, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-03** — 3. Подарочный пакет

_Попытка 1 (отклонён):_ переделан: кремовая гамма

```text
Isolated single small cream ceramic vase with a fluted neck, empty, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят: крафтовый пакет вместо вазы — другой силуэт и цвет

```text
Isolated single kraft paper gift bag with cream tissue paper sticking out and a small pink ribbon handle, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-04** — 4. Корзина

```text
Isolated single empty wicker basket with an arched handle, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-05** — 5. Бирюзовая ваза

_Попытка 1 (отклонён):_ переделан: кремово-терракотовая гамма

```text
Isolated single painted terracotta planter decorated with a simple hand-painted floral pattern, empty, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят: бирюзовая ваза читается сразу

```text
Isolated single turquoise glazed ceramic vase with a fluted neck, empty, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-06** — 6. Расписной ящик

_Попытка 1 (отклонён):_ переделан: почти не отличался от pack-04 (корзина) и pack-01 (бумага)

```text
Isolated single sturdy wooden crate made of pale slats, empty, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят

```text
Isolated single wooden crate with painted sage green panels and a small floral stencil on the front, empty, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-07** — 7. Ручная тележка

_Попытка 1 (отклонён):_ переделан: не отличался от pack-08 и pack-09

```text
Isolated single small wooden tiered display stand with two shelves, empty, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (отклонён):_ переделан: остался деревянной этажеркой

```text
Isolated single small wooden tiered display stand with two shelves holding two small potted plants and a sprig of lavender, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 3 (принят):_ принят: смена силуэта (тележка) и цвета колёс

```text
Isolated single small wooden handcart with two large spoked wheels painted terracotta red, carrying a wicker basket of dried flowers, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette plus terracotta red accent (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, terracotta #C4674F), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-08** — 8. Этажерка с цветами

_Попытка 1 (отклонён):_ переделан: не отличался от pack-07 и pack-09

```text
Isolated single elegant empty glass display cabinet with a wooden frame and a curved top, no contents inside, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят: металл и тёмно-синий цвет

```text
Isolated single deep navy blue painted metal plant stand with three shelves holding small potted plants and a watering can, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette plus deep navy blue accent (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, navy #34435E), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-09** — 9. Золочёная витрина

_Попытка 1 (отклонён):_ переделан

```text
Isolated single tall ornate wooden flower stand with carved legs and three empty levels, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_Попытка 2 (принят):_ принят: золото и купол

```text
Isolated single tall gilded golden display cabinet with a domed top, ornate carved floral details and glass doors, no contents inside, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette with gold accents (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**pack-10** — 10. Подарочный набор

```text
Isolated single luxurious gift set: a cream gift box with a large dusty pink satin bow, a folded kraft paper sheet and a small bunch of dried lavender laid beside it, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят_


### Инструменты (tools)

**tools-01** — 1. Секатор

```text
Isolated single gardening pruning shears with wooden handles, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-02** — 2. Лейка

```text
Isolated single sage green watering can with a long spout, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-03** — 3. Опрыскиватель

```text
Isolated single small glass plant mister with a brass pump, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-04** — 4. Перчатки

```text
Isolated single pair of canvas gardening gloves with leather cuffs and a small flower print, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-05** — 5. Лопатка

```text
Isolated single small garden trowel with a wooden handle and a steel blade, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-06** — 6. Тачка

```text
Isolated single wooden wheelbarrow with a single front wheel filled with soil, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-07** — 7. Тепличка

```text
Isolated single small glass cold frame with a wooden frame and tiny seedlings inside, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-08** — 8. Набор инструментов

```text
Isolated single gardener's tool set arranged in an open wooden box with brass fittings, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-09** — 9. Тележка

```text
Isolated single sturdy garden cart with shelves holding pots, tools and a watering can, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**tools-10** — 10. Золотые инструменты

```text
Isolated single legendary golden gardening tool set: golden shears and a golden trowel crossed over a golden watering can, all with ornate engraved floral handles, surrounded by a subtle warm glow, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette with gold accents (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят_


### Генераторы

**gen-bed-01** — Грядка

```text
Isolated single wooden garden bed filled with dark soil and small green seedlings, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**gen-bed-02** — Теплица

```text
Isolated single small glass greenhouse with a wooden frame and young plants on shelves inside, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

**gen-bed-03** — Оранжерея

```text
Isolated single tall ornate glass greenhouse pavilion filled with lush green plants, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, object fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```


### Здания

**bld-flowershop** — Цветочная лавка

```text
Isolated single charming small flower shop on a street corner with a cream and sage striped awning and wooden flower crates on the sidewalk, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```

**bld-coffee** — Кофейня «Ромашка»

```text
Isolated single cozy small coffee house with a daisy-shaped sign and one outdoor table with two chairs, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```

**bld-bakery** — Пекарня

```text
Isolated single warm bakery shopfront with baguettes in the window and a round loaf sign, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```

**bld-workshop** — Мастерская декора

```text
Isolated single small craftsman workshop with wooden planks, hanging tools and potted plants by the door, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```

**bld-greenhouse** — Оранжерея

```text
Isolated single large elegant glass orangery pavilion filled with exotic plants, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```

**bld-pavilion** — Павильон на площади

```text
Isolated single festive open-air pavilion with flower garlands and striped canopy, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4), clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, building fully inside the frame with generous margin, no cast shadow on ground, no other buildings, no people, no text, no letters.
```


### Интерфейс

**ui-energy** — Энергия

```text
Isolated single glossy green leaf game icon with a rounded friendly shape and a subtle dewdrop highlight, game UI icon style with clean edges, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, {PALETTE}, clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, icon fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят_

**ui-coin** — Монеты

```text
Isolated single shiny golden game coin with a small pink flower embossed on its face, glossy game UI icon style with clean edges, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, {PALETTE}, clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, icon fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят_

**ui-rep** — Репутация

```text
Isolated single round bronze badge game icon with a tiny cottage and a small flower embossed on its face, game UI icon style with clean edges, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, {PALETTE}, clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, icon fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят_

**ui-locked** — ui-locked

```text
Isolated single small locked garden plot marker: a short wooden peg with a tiny padlock and a few dry twigs, game UI icon style with clean edges, centered, soft 3/4 view, cozy painterly storybook illustration matching the reference art style, {PALETTE}, clean readable silhouette, warm light from upper left, plain flat uniform light gray background filling the entire frame, icon fully inside the frame with generous margin, no cast shadow on ground, no other objects, no people, no text, no letters.
```

_принят. Добавлен сверх манифеста: нужна метка закрытой клетки вместо эмодзи_


---

## Фоны (не вырезаются)

**stage-board** → `art/backgrounds/stage-board.jpg`

```text
Soft muted background for a puzzle board game screen: a weathered pale wooden workbench top seen directly from above, very low contrast, small scattered fallen petals in the corners, gentle warm light from the upper left, no objects, no tools, no flowers in the middle, plenty of calm empty space in the center, cozy painterly storybook style, pastel palette (pale wood #D8C3A5, cream #F3EADB, sage green accents #9DBE9A), no text, no letters, wide composition.
```

_Обработка:_ Не вырезается: занимает кадр целиком. Ужимается до 1024 px по ширине и сохраняется в JPEG (quality 82) — для мягких текстур это в разы легче PNG. Итог 66 КБ.

_Итог:_ принят

**stage-quarter** → `art/backgrounds/stage-quarter.jpg`

```text
Wide cozy illustration of a small European quarter street at golden hour, seen from a slightly elevated 3/4 view: a flower shop with a cream and sage striped awning on the left, a small coffee house with a daisy sign next to it, a bakery, a craftsman workshop, a glass orangery pavilion and a festive flower pavilion further down the cobblestone street, lanterns, wooden crates with flowers, vines on the walls, soft warm light, no people, no text, no letters, no logos, cozy painterly storybook style, pastel palette (sage green #9DBE9A, cream #F3EADB, dusty rose #E98C9B, warm wood #C89A63, lavender #A99BD4).
```

_Обработка:_ Не вырезается. Ужимается до 1600 px по ширине, JPEG quality 84. Итог 321 КБ.

_Итог:_ принят. На фоне видны все шесть зданий квартала — совпадает с составом bld-* 

---

## Как повторить генерацию одного ассета

1. Взять промпт ассета из этого файла.
2. Приложить к запросу `art/style-test/flowershop-keyart.png` как референс.
3. Сохранить результат в `art/raw/<id>.png`.
4. Обработать:

```bash
tools/py tools/shrink-raw.py art/raw/<id>.png --max 800
tools/py tools/cutout.py art/raw/<id>.png --outdir art/sprites
tools/py tools/check-sprites.py
```

5. Проверить читаемость в игровом размере: `art/style-test/level-readability.md`
   описывает процедуру, `tools/mock-board.py` собирает макет доски.
