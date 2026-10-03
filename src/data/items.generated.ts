// СГЕНЕРИРОВАНО tools/gen-items.mjs из art/manifest.json и data/balance.json
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

export const CHAINS: readonly ChainDef[] = [
  {
    id: "rose",
    name: "Роза",
    role: "order",
    unlockDay: 0,
    items: [
      {
        id: "rose-01",
        level: 1,
        name: "Бутон розы"
      },
      {
        id: "rose-02",
        level: 2,
        name: "Роза"
      },
      {
        id: "rose-03",
        level: 3,
        name: "Три розы"
      },
      {
        id: "rose-04",
        level: 4,
        name: "Букет в бумаге"
      },
      {
        id: "rose-05",
        level: 5,
        name: "Корзина роз"
      },
      {
        id: "rose-06",
        level: 6,
        name: "Композиция в вазе"
      },
      {
        id: "rose-07",
        level: 7,
        name: "Свадебный букет"
      },
      {
        id: "rose-08",
        level: 8,
        name: "Арт-бокс"
      },
      {
        id: "rose-09",
        level: 9,
        name: "Цветочная арка"
      },
      {
        id: "rose-10",
        level: 10,
        name: "Чёрная роза"
      }
    ]
  },
  {
    id: "wild",
    name: "Полевые",
    role: "order",
    unlockDay: 0,
    items: [
      {
        id: "wild-01",
        level: 1,
        name: "Ромашка"
      },
      {
        id: "wild-02",
        level: 2,
        name: "Пучок ромашек"
      },
      {
        id: "wild-03",
        level: 3,
        name: "Венок"
      },
      {
        id: "wild-04",
        level: 4,
        name: "Сноп полевых"
      },
      {
        id: "wild-05",
        level: 5,
        name: "Кашпо с полевыми"
      },
      {
        id: "wild-06",
        level: 6,
        name: "Лукошко"
      },
      {
        id: "wild-07",
        level: 7,
        name: "Сухоцвет"
      },
      {
        id: "wild-08",
        level: 8,
        name: "Полевой букет"
      },
      {
        id: "wild-09",
        level: 9,
        name: "Луг в ящике"
      },
      {
        id: "wild-10",
        level: 10,
        name: "Золотой луг"
      }
    ]
  },
  {
    id: "exotic",
    name: "Экзотика",
    role: "order",
    unlockDay: 4,
    items: [
      {
        id: "exotic-01",
        level: 1,
        name: "Суккулент"
      },
      {
        id: "exotic-02",
        level: 2,
        name: "Орхидея"
      },
      {
        id: "exotic-03",
        level: 3,
        name: "Цветущий кактус"
      },
      {
        id: "exotic-04",
        level: 4,
        name: "Орхидея в кашпо"
      },
      {
        id: "exotic-05",
        level: 5,
        name: "Монстера"
      },
      {
        id: "exotic-06",
        level: 6,
        name: "Бонсай"
      },
      {
        id: "exotic-07",
        level: 7,
        name: "Тропическая композиция"
      },
      {
        id: "exotic-08",
        level: 8,
        name: "Пальма в кадке"
      },
      {
        id: "exotic-09",
        level: 9,
        name: "Оранжерейный гигант"
      },
      {
        id: "exotic-10",
        level: 10,
        name: "Райская птица"
      }
    ]
  },
  {
    id: "pack",
    name: "Упаковка",
    role: "service",
    unlockDay: 1,
    items: [
      {
        id: "pack-01",
        level: 1,
        name: "Бумага"
      },
      {
        id: "pack-02",
        level: 2,
        name: "Розовая лента"
      },
      {
        id: "pack-03",
        level: 3,
        name: "Подарочный пакет"
      },
      {
        id: "pack-04",
        level: 4,
        name: "Корзина"
      },
      {
        id: "pack-05",
        level: 5,
        name: "Бирюзовая ваза"
      },
      {
        id: "pack-06",
        level: 6,
        name: "Расписной ящик"
      },
      {
        id: "pack-07",
        level: 7,
        name: "Ручная тележка"
      },
      {
        id: "pack-08",
        level: 8,
        name: "Этажерка с цветами"
      },
      {
        id: "pack-09",
        level: 9,
        name: "Золочёная витрина"
      },
      {
        id: "pack-10",
        level: 10,
        name: "Подарочный набор"
      }
    ]
  },
  {
    id: "tools",
    name: "Инструменты",
    role: "service",
    unlockDay: 2,
    items: [
      {
        id: "tools-01",
        level: 1,
        name: "Секатор"
      },
      {
        id: "tools-02",
        level: 2,
        name: "Лейка"
      },
      {
        id: "tools-03",
        level: 3,
        name: "Опрыскиватель"
      },
      {
        id: "tools-04",
        level: 4,
        name: "Перчатки"
      },
      {
        id: "tools-05",
        level: 5,
        name: "Лопатка"
      },
      {
        id: "tools-06",
        level: 6,
        name: "Тачка"
      },
      {
        id: "tools-07",
        level: 7,
        name: "Тепличка"
      },
      {
        id: "tools-08",
        level: 8,
        name: "Набор инструментов"
      },
      {
        id: "tools-09",
        level: 9,
        name: "Тележка"
      },
      {
        id: "tools-10",
        level: 10,
        name: "Золотые инструменты"
      }
    ]
  }
] as const;

export const ITEM_BY_ID = new Map<string, ItemDef>(
  CHAINS.flatMap((chain) => chain.items.map((item) => [item.id, item] as const)),
);

export const ITEM_BY_KEY = new Map<string, ItemDef>(
  CHAINS.flatMap((chain) => chain.items.map((item) => [`${chain.id}:${item.level}`, item] as const)),
);

/** Ключ предмета в формате «цепочка:уровень» — так он хранится на поле и в сейве. */
export function itemKey(chainId: string, level: number): string {
  return `${chainId}:${level}`;
}

/** Адрес спрайта в art/sprites. Имена файлов = id предметов из манифеста. */
export function spritePath(itemId: string): string {
  return `/art/sprites/${itemId}.png`;
}
