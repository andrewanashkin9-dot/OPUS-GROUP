import type { MaterialOption } from "./types";

export const MATERIALS: MaterialOption[] = [
  // Крыша
  {
    id: "roof-metal-tile-terracotta",
    nodeKind: "roof",
    name: "Металлочерепица «Терракота»",
    description: "Полимерное покрытие, гарантия 25 лет.",
    pricePerUnit: 640,
    unit: "m2",
    colorHex: "#8A4A32",
    tier: "free",
  },
  {
    id: "roof-metal-tile-graphite",
    nodeKind: "roof",
    name: "Металлочерепица «Графит»",
    description: "Матовое покрытие Pural, устойчива к выцветанию.",
    pricePerUnit: 690,
    unit: "m2",
    colorHex: "#3A3A3D",
    tier: "free",
  },
  {
    id: "roof-soft-shingle",
    nodeKind: "roof",
    name: "Битумная черепица «Антик»",
    description: "Гибкая черепица, точная подгонка под сложные скаты.",
    pricePerUnit: 980,
    unit: "m2",
    colorHex: "#5C4A3A",
    tier: "pro",
  },
  {
    id: "roof-seam",
    nodeKind: "roof",
    name: "Фальцевая кровля, цинк-титан",
    description: "Инженерный шов вручную, для сложных геометрий.",
    pricePerUnit: 2450,
    unit: "m2",
    colorHex: "#9CA3AA",
    tier: "pro",
  },

  // Фасад
  {
    id: "facade-brick-cream",
    nodeKind: "facade",
    name: "Клинкерный кирпич «Крем»",
    description: "Морозостойкий, класс F100.",
    pricePerUnit: 1450,
    unit: "m2",
    colorHex: "#D9C6A5",
    tier: "free",
  },
  {
    id: "facade-plaster-warm-white",
    nodeKind: "facade",
    name: "Декоративная штукатурка «Тёплый белый»",
    description: "Минеральная база, паропроницаемая.",
    pricePerUnit: 890,
    unit: "m2",
    colorHex: "#EDE6D6",
    tier: "free",
  },
  {
    id: "facade-wood-siding",
    nodeKind: "facade",
    name: "Планкен лиственница, «Тёмный дуб»",
    description: "Термообработанная древесина, вентилируемый фасад.",
    pricePerUnit: 2100,
    unit: "m2",
    colorHex: "#4A3626",
    tier: "pro",
  },
  {
    id: "facade-hpl-panel",
    nodeKind: "facade",
    name: "HPL-панели «Антрацит»",
    description: "Композитные панели, скрытый крепёж.",
    pricePerUnit: 3200,
    unit: "m2",
    colorHex: "#2B2B2B",
    tier: "pro",
  },

  // Забор
  {
    id: "fence-profnastil-brown",
    nodeKind: "fence",
    name: "Профнастил С8, «Шоколад»",
    description: "Оцинкованный лист с полимерным покрытием.",
    pricePerUnit: 1650,
    unit: "m",
    colorHex: "#3E2A1F",
    tier: "free",
  },
  {
    id: "fence-euro-штакетник",
    nodeKind: "fence",
    name: "Евроштакетник, «Графит»",
    description: "Двусторонняя покраска, вентилируемый профиль.",
    pricePerUnit: 1900,
    unit: "m",
    colorHex: "#41454A",
    tier: "free",
  },
  {
    id: "fence-forged",
    nodeKind: "fence",
    name: "Кованые секции, порошковая окраска",
    description: "Индивидуальный рисунок ковки.",
    pricePerUnit: 8400,
    unit: "m",
    colorHex: "#1C1C1C",
    tier: "pro",
  },

  // Фундамент
  {
    id: "foundation-strip",
    nodeKind: "foundation",
    name: "Ленточный фундамент, монолит",
    description: "Заглубление ниже точки промерзания.",
    pricePerUnit: 8900,
    unit: "m2",
    colorHex: "#6B6660",
    tier: "free",
  },
  {
    id: "foundation-slab",
    nodeKind: "foundation",
    name: "Плитный фундамент УШП",
    description: "Утеплённая шведская плита с тёплым полом.",
    pricePerUnit: 14200,
    unit: "m2",
    colorHex: "#7A756E",
    tier: "pro",
  },

  // Окна
  {
    id: "window-pvc-white",
    nodeKind: "window",
    name: "ПВХ, белый, двухкамерный стеклопакет",
    description: "Стандартная теплоизоляция для средней полосы.",
    pricePerUnit: 19500,
    unit: "pcs",
    colorHex: "#F2EFE8",
    tier: "free",
  },
  {
    id: "window-alu-graphite",
    nodeKind: "window",
    name: "Алюминий, «Графит», тройной стеклопакет",
    description: "Узкая рама, повышенная теплоизоляция для Урала.",
    pricePerUnit: 41000,
    unit: "pcs",
    colorHex: "#33363A",
    tier: "pro",
  },
];

export function materialsForKind(kind: MaterialOption["nodeKind"]) {
  return MATERIALS.filter((m) => m.nodeKind === kind);
}

export function materialById(id: string) {
  return MATERIALS.find((m) => m.id === id);
}
