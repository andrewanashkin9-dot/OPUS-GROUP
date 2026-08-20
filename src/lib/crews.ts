import type { NodeKind } from "./3d/types";

export interface Crew {
  id: string;
  name: string;
  city: string;
  specialties: NodeKind[];
  rating: number;
  reviewsCount: number;
  priceRangeLabel: string;
  bio: string;
}

export const CREWS: Crew[] = [
  {
    id: "crew-krovlya-ural",
    name: "«Кровля Урала»",
    city: "Екатеринбург",
    specialties: ["roof"],
    rating: 4.9,
    reviewsCount: 132,
    priceRangeLabel: "от 450 ₽/м²",
    bio: "Монтаж металлочерепицы и фальцевой кровли, гарантия на работы 5 лет.",
  },
  {
    id: "crew-fasad-master",
    name: "«ФасадМастер»",
    city: "Пермь",
    specialties: ["facade"],
    rating: 4.8,
    reviewsCount: 96,
    priceRangeLabel: "от 700 ₽/м²",
    bio: "Штукатурные и вентилируемые фасады, работа с клинкером и планкеном.",
  },
  {
    id: "crew-zabor-pro",
    name: "«ЗаборПро»",
    city: "Челябинск",
    specialties: ["fence"],
    rating: 4.7,
    reviewsCount: 58,
    priceRangeLabel: "от 900 ₽/пог. м",
    bio: "Заборы из профнастила и евроштакетника под ключ, включая столбы.",
  },
  {
    id: "crew-fundament-stroy",
    name: "«ФундаментСтрой»",
    city: "Тюмень",
    specialties: ["foundation"],
    rating: 4.9,
    reviewsCount: 74,
    priceRangeLabel: "от 6 500 ₽/м²",
    bio: "Ленточные и плитные фундаменты, геологическая разведка участка.",
  },
  {
    id: "crew-okna-vector",
    name: "«ОкнаВектор»",
    city: "Екатеринбург",
    specialties: ["window"],
    rating: 4.6,
    reviewsCount: 41,
    priceRangeLabel: "от 3 500 ₽/окно",
    bio: "Установка и замер окон ПВХ и алюминия, вывоз старых рам.",
  },
  {
    id: "crew-dom-pod-klyuch",
    name: "«Дом под ключ»",
    city: "Екатеринбург",
    specialties: ["roof", "facade", "foundation"],
    rating: 4.9,
    reviewsCount: 210,
    priceRangeLabel: "по смете объекта",
    bio: "Полный цикл строительных работ — от фундамента до кровли.",
  },
];
