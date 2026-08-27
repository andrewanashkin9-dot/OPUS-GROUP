import type { Locale } from "./locale";

/**
 * Тексты переведённых страниц.
 *
 * Один файл на оба языка, а не два рядом. Так пропущенный перевод виден
 * глазами при чтении — строки стоят вплотную, — и типы не дают забыть
 * ключ: английский словарь обязан повторять форму русского, иначе сборка
 * не пройдёт.
 *
 * Сюда попадает только то, что действительно переведено: главная (вместе с
 * тарифами — это её раздел) и бригады. Кабинет, формы и магазин остаются
 * русскими, и тащить их ключи сюда «на будущее» нельзя — словарь с
 * половиной неиспользованных строк перестаёт показывать, что переведено, а
 * что нет.
 */

export interface Dictionary {
  nav: {
    howItWorks: string;
    market: string;
    estimate: string;
    services: string;
    education: string;
    pricing: string;
    moderation: string;
    account: string;
    signIn: string;
    startFree: string;
    openMenu: string;
    closeMenu: string;
    estimateCount: (n: number) => string;
  };
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
    ctaPrimary: string;
    ctaSecondary: string;
    scrollHint: string;
    fields: { object: string; size: string; floors: string; facade: string; estimate: string; scale: string };
    values: { object: string; floors: string; size: string; facade: string };
  };
  home: {
    stepsTitle: string;
    steps: { title: string; body: string }[];
    materialsTitle: string;
    materialsIntro: string;
    materialsAction: string;
    pricingTitle: string;
    pricingIntro: string;
    freeLabel: string;
    freePrice: string;
    freeLede: string;
    freeFeatures: string[];
    freeCta: string;
    proLabel: string;
    proPer: string;
    proLede: string;
    proFeatures: string[];
    proCta: string;
    proofTitle: string;
    proof: { quote: string; name: string }[];
  };
  services: {
    title: string;
    demoLede: string;
    modelLede: string;
    modelHint: string;
    demoNotice: string;
    demoNoCta: string;
    requestQuote: string;
    requestSent: string;
    noCity: string;
    noPrice: string;
    noReviews: string;
    noDeals: string;
    completed: (n: number) => string;
    completionRate: (percent: number) => string;
    reviews: (n: number) => string;
    showAll: string;
    onlyMine: string;
    reviewsFrom: string;
    empty: string;
  };
  market: {
    title: string;
    introWithModel: string;
    introPlain: string;
    filtersLabel: string;
    category: string;
    brand: string;
    priceUpTo: (price: string) => string;
    onlyMyModel: string;
    found: string;
    reset: string;
    more: (n: number) => string;
    nothing: string;
    fitsModel: string;
    addToEstimate: string;
    inEstimate: string;
    breadcrumb: string;
    specs: string;
    related: (category: string) => string;
    reviews: string;
    noReviews: string;
    suggestion: (qty: string, from: string) => string;
    quantity: string;
    decrease: string;
    increase: string;
    alreadyIn: (amount: string) => string;
    inEstimateShort: (amount: string) => string;
  };
  footer: {
    tagline: string;
    product: string;
    company: string;
    support: string;
    links: { editor: string; market: string; cart: string; services: string; education: string; pricing: string; howItWorks: string };
    rights: string;
    entity: string;
  };
  langSwitch: { label: string; to: (name: string) => string };
  theme: { blue: string; black: string; switchTo: (name: string) => string };
  /** ⚠️ ВРЕМЕННО: подпись у демо-отзывов. Удалить вместе с сид-скриптом. */
  demoReviews: { badge: string; title: string };
}

/** «3 отзыва» — русские окончания. */
function ruPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const ru: Dictionary = {
  nav: {
    howItWorks: "Как это работает",
    market: "Магазин",
    estimate: "Смета",
    services: "Услуги",
    education: "База знаний",
    pricing: "Тарифы",
    moderation: "Модерация",
    account: "Кабинет",
    signIn: "Войти",
    startFree: "Начать бесплатно",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    estimateCount: (n) => `Смета, позиций: ${n}`,
  },
  hero: {
    eyebrow: "Фото → 3D-модель → смета → бригада",
    title: "Ваш дом в 3D — из четырёх фотографий",
    lede: "Дом целиком — по фотографиям; комнату — по вашим замерам. Материалы и стоимость считаются сами.",
    ctaPrimary: "Начать расчёт",
    ctaSecondary: "Как это работает",
    scrollHint: "Листайте, чтобы приблизиться",
    fields: {
      object: "Объект",
      size: "Габариты",
      floors: "Этажность",
      facade: "Площадь фасадов",
      estimate: "Смета",
      scale: "Масштаб",
    },
    values: { object: "Частный дом", floors: "2 этажа", size: "9,5 × 8,2 м", facade: "186,7 м²" },
  },
  home: {
    stepsTitle: "Путь от фото до стройки",
    steps: [
      {
        title: "Загрузите",
        body: "Четыре фото дома, комнаты или участка — с телефона, без специальной съёмки.",
      },
      {
        title: "Сгенерируйте",
        body: "Neural4D строит по фотографиям 3D-модель со всеми поверхностями и размерами.",
      },
      {
        title: "Настройте",
        body: "Меняйте крышу, фасад, цвета и забор — как в конструкторе, без CAD.",
      },
      {
        title: "Стройте",
        body: "Смета на материалы и бригады, готовые взяться за работу, — сразу в модели.",
      },
    ],
    materialsTitle: "Материалы под вашу модель",
    materialsIntro:
      "Кровля, фасад, утепление и изоляция от поставщиков, с которыми работают наши бригады. Количество подставляется из геометрии дома.",
    materialsAction: "Весь магазин",
    pricingTitle: "От первого макета до точной сметы",
    pricingIntro:
      "Начните бесплатно и переходите на точную настройку, когда решите, что строите по-настоящему.",
    freeLabel: "Бесплатно",
    freePrice: "0 ₽",
    freeLede: "Крупные детали, чтобы быстро увидеть общий образ дома.",
    freeFeatures: [
      "Базовый конструктор — крыша, цвета, забор",
      "Просмотр 3D-модели со всех сторон",
      "Смета по укрупнённым позициям",
    ],
    freeCta: "Начать бесплатно",
    proLabel: "Подписка",
    proPer: " / мес.",
    proLede: "Точные размеры, слои материалов и готовая спецификация для стройки.",
    proFeatures: [
      "Точные размеры и слои материалов",
      "Полная спецификация и экспорт",
      "Расширенная библиотека материалов",
      "Приоритетные заявки бригадам",
    ],
    proCta: "Оформить подписку",
    proofTitle: "Уже строят с OPUS GROUP",
    proof: [
      { quote: "Собрал смету на фасад за вечер вместо трёх поездок в магазин.", name: "Игорь, Челябинск" },
      { quote: "Показал бригаде готовую модель — согласовали объём работ за один звонок.", name: "Анна, Пермь" },
      { quote: "Наконец понятно, зачем нужен угол ската — не за красоту, а по СНиПу.", name: "Дмитрий, Тюмень" },
    ],
  },
  services: {
    title: "Бригады для монтажа",
    demoLede: "Так будет выглядеть подбор бригад под вашу модель дома.",
    modelLede: "Показаны бригады, которые закрывают именно те работы, что есть в вашей модели.",
    modelHint: "Постройте модель дома в конструкторе — и здесь останутся только нужные вам бригады.",
    demoNotice:
      "Это примеры карточек, а не настоящие бригады: регистрация исполнителей ещё готовится. Ни телефонов, ни договоров за ними нет — и заявка по ним никуда не уйдёт.",
    demoNoCta: "Заявка — после регистрации бригад",
    requestQuote: "Запросить смету",
    requestSent: "Заявка отправлена ✓",
    noCity: "город не указан",
    noPrice: "цена по смете объекта",
    noReviews: "Пока нет отзывов",
    noDeals: "Пока без завершённых заявок",
    completed: (n) => `${n} ${ruPlural(n, "завершённая заявка", "завершённые заявки", "завершённых заявок")}`,
    completionRate: (p) => ` · доведено до конца ${p}%`,
    reviews: (n) => `${n} ${ruPlural(n, "отзыв", "отзыва", "отзывов")}`,
    showAll: "Показать все бригады",
    onlyMine: "Показать только нужные для моей модели",
    reviewsFrom: "Отзывы",
    empty: "Под вашу модель пока никто не подходит — посмотрите всех.",
  },
  market: {
    title: "Магазин материалов",
    introWithModel:
      "Всё, что нужно докупить сверх сметы по модели: изоляция, крепёж, смеси. Позиции, которые подходят вашему дому, отмечены — количество подставится из его геометрии.",
    introPlain:
      "Кровля, фасад, утепление и изоляция от поставщиков, с которыми работают наши бригады. Соберите модель дома — и количество подставится из его геометрии.",
    filtersLabel: "Фильтры каталога",
    category: "Категория",
    brand: "Производитель",
    priceUpTo: (price) => `Цена — до ${price}`,
    onlyMyModel: "Только для моей модели",
    found: "Найдено:",
    reset: "Сбросить",
    more: (n) => `Ещё ${n}`,
    nothing: "По этим условиям ничего нет — снимите часть фильтров.",
    fitsModel: "Подходит вашей модели",
    addToEstimate: "В смету",
    inEstimate: "В смете ✓",
    breadcrumb: "Магазин материалов",
    specs: "Характеристики",
    related: (category) => `Ещё в разделе «${category}»`,
    reviews: "Отзывы",
    noReviews: "Этот материал ещё никто не оценил",
    suggestion: (qty, from) =>
      `По вашей модели нужно ${qty} — посчитано по геометрии: ${from}. Количество можно изменить.`,
    quantity: "Количество",
    decrease: "Уменьшить количество",
    increase: "Увеличить количество",
    alreadyIn: (amount) => `Уже в смете: ${amount}`,
    inEstimateShort: (amount) => `В смете · ${amount}`,
  },
  footer: {
    tagline: "От фото дома до бригады на объекте — в одном месте.",
    product: "Продукт",
    company: "Компания",
    support: "Поддержка",
    links: {
      editor: "Конструктор",
      market: "Магазин материалов",
      cart: "Смета",
      services: "Бригады",
      education: "База знаний",
      pricing: "Тарифы",
      howItWorks: "Как это работает",
    },
    rights: "Все права защищены.",
    entity: "ООО «Опус Групп», Екатеринбург",
  },
  langSwitch: { label: "Язык", to: (name) => `Переключить на ${name}` },
  demoReviews: {
    badge: "демо-данные",
    title: "Отзывы заведены для примера — настоящих покупателей у этого товара ещё не было.",
  },
  theme: {
    blue: "Синяя калька",
    black: "Чёрная калька",
    switchTo: (name) => `Переключить на: ${name}`,
  },
};

const en: Dictionary = {
  nav: {
    howItWorks: "How it works",
    market: "Shop",
    estimate: "Estimate",
    services: "Crews",
    education: "Guides",
    pricing: "Pricing",
    moderation: "Moderation",
    account: "Account",
    signIn: "Sign in",
    startFree: "Start free",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    estimateCount: (n) => `Estimate, ${n} item${n === 1 ? "" : "s"}`,
  },
  hero: {
    eyebrow: "Photo → 3D model → estimate → crew",
    title: "Your house in 3D, from four photographs",
    lede: "The whole house from photos; a single room from your own measurements. Materials and costs are worked out for you.",
    ctaPrimary: "Start an estimate",
    ctaSecondary: "How it works",
    scrollHint: "Scroll to move closer",
    fields: {
      object: "Object",
      size: "Footprint",
      floors: "Storeys",
      facade: "Façade area",
      estimate: "Estimate",
      scale: "Scale",
    },
    // Единицы тоже перевод: «186,7 м²» в английской строке читается как
    // опечатка, хотя это те же самые метры.
    values: { object: "Detached house", floors: "2 storeys", size: "9.5 × 8.2 m", facade: "186.7 m²" },
  },
  home: {
    stepsTitle: "From photograph to building site",
    steps: [
      {
        title: "Upload",
        body: "Four photos of the house, room or plot — from your phone, no special equipment.",
      },
      {
        title: "Generate",
        body: "Neural4D turns the photographs into a 3D model with every surface and dimension.",
      },
      {
        title: "Adjust",
        body: "Change the roof, façade, colours and fence — like a configurator, without CAD.",
      },
      {
        title: "Build",
        body: "A materials estimate and crews ready to take the job — right inside the model.",
      },
    ],
    materialsTitle: "Materials for your model",
    materialsIntro:
      "Roofing, façade, insulation and waterproofing from the suppliers our crews work with. Quantities come from the geometry of your house.",
    materialsAction: "Browse the shop",
    pricingTitle: "From first sketch to an exact estimate",
    pricingIntro:
      "Start free and move up to exact figures when you decide you are really building.",
    freeLabel: "Free",
    freePrice: "0 ₽",
    freeLede: "Broad strokes, enough to see the shape of the house quickly.",
    freeFeatures: [
      "Basic configurator — roof, colours, fence",
      "The 3D model from every side",
      "Estimate by broad line items",
    ],
    freeCta: "Start free",
    proLabel: "Subscription",
    proPer: " / month",
    proLede: "Exact dimensions, material layers and a specification ready for the site.",
    proFeatures: [
      "Exact dimensions and material layers",
      "Full specification and export",
      "Extended material library",
      "Priority requests to crews",
    ],
    proCta: "Subscribe",
    proofTitle: "Already building with OPUS GROUP",
    proof: [
      { quote: "Put together a façade estimate in one evening instead of three trips to the shop.", name: "Igor, Chelyabinsk" },
      { quote: "Showed the crew the finished model — we agreed the scope of work in one call.", name: "Anna, Perm" },
      { quote: "Finally clear why the roof pitch matters — not for looks, but for the building code.", name: "Dmitry, Tyumen" },
    ],
  },
  services: {
    title: "Crews for installation",
    demoLede: "This is how crew matching against your own model will look.",
    modelLede: "Showing the crews that cover exactly the work your model contains.",
    modelHint: "Build your house in the configurator, and only the crews you actually need will stay here.",
    demoNotice:
      "These are sample cards, not real crews: registration for contractors is still being prepared. There are no phone numbers or contracts behind them, and a request would go nowhere.",
    demoNoCta: "Requests open once crews register",
    requestQuote: "Request a quote",
    requestSent: "Request sent ✓",
    noCity: "city not given",
    noPrice: "priced per project",
    noReviews: "No reviews yet",
    noDeals: "No completed jobs yet",
    completed: (n) => `${n} completed job${n === 1 ? "" : "s"}`,
    completionRate: (p) => ` · ${p}% seen through`,
    reviews: (n) => `${n} review${n === 1 ? "" : "s"}`,
    showAll: "Show every crew",
    onlyMine: "Show only the ones my model needs",
    reviewsFrom: "Reviews",
    empty: "Nobody matches your model yet — take a look at everyone.",
  },
  market: {
    title: "Materials shop",
    introWithModel:
      "Everything to buy beyond what the model already estimates: insulation, fixings, mixes. Items that suit your house are marked — quantities come from its geometry.",
    introPlain:
      "Roofing, façade, insulation and waterproofing from the suppliers our crews work with. Build your house and quantities will come from its geometry.",
    filtersLabel: "Catalogue filters",
    category: "Category",
    brand: "Manufacturer",
    priceUpTo: (price) => `Price — up to ${price}`,
    onlyMyModel: "Only for my model",
    found: "Found:",
    reset: "Reset",
    more: (n) => `${n} more`,
    nothing: "Nothing matches these filters — drop a few of them.",
    fitsModel: "Suits your model",
    addToEstimate: "Add to estimate",
    inEstimate: "In the estimate ✓",
    breadcrumb: "Materials shop",
    specs: "Specification",
    related: (category) => `More in “${category}”`,
    reviews: "Reviews",
    noReviews: "Nobody has rated this material yet",
    suggestion: (qty, from) =>
      `Your model needs ${qty} — worked out from the geometry: ${from}. You can change the amount.`,
    quantity: "Quantity",
    decrease: "Decrease the amount",
    increase: "Increase the amount",
    alreadyIn: (amount) => `Already in the estimate: ${amount}`,
    inEstimateShort: (amount) => `In estimate · ${amount}`,
  },
  footer: {
    tagline: "From a photo of the house to a crew on site — in one place.",
    product: "Product",
    company: "Company",
    support: "Support",
    links: {
      editor: "Configurator",
      market: "Materials shop",
      cart: "Estimate",
      services: "Crews",
      education: "Guides",
      pricing: "Pricing",
      howItWorks: "How it works",
    },
    rights: "All rights reserved.",
    entity: "OOO Opus Group, Yekaterinburg",
  },
  langSwitch: { label: "Language", to: (name) => `Switch to ${name}` },
  demoReviews: {
    badge: "sample data",
    title: "These reviews are seeded as an example — this product has had no real buyers yet.",
  },
  theme: {
    blue: "Blue tracing paper",
    black: "Black tracing paper",
    switchTo: (name) => `Switch to: ${name}`,
  },
};

const DICTIONARIES: Record<Locale, Dictionary> = { ru, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
