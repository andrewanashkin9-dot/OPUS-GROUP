/**
 * TODO: удалить перед запуском — витрина без базы.
 *
 * Собирает из выдуманных данных (`showcase.ts`) ровно то, что обычно
 * приходит из PostgreSQL: рейтинги товаров, отзывы, карточки бригад, очередь
 * модерации, менеджеров. Включается сама, когда базы в окружении нет, —
 * настраивать нечего и нажимать нечего.
 *
 * Зачем так, а не «подключить базу»: сайт должен показывать функции любому,
 * кто открыл ссылку, ещё до того как база вообще заведена. Раньше без базы
 * магазин был без оценок, «Услуги» — с пятью пустыми образцами, модерация не
 * открывалась вовсе. Теперь всё это выглядит и ведёт себя как настоящее.
 *
 * Что здесь **не** происходит: никакие данные никуда не записываются. Отзыв,
 * оставленный без базы, живёт до перезагрузки страницы, и это честнее, чем
 * делать вид, что он сохранён.
 *
 * Числа обязаны быть одинаковыми при каждом вызове — иначе сервер и браузер
 * нарисуют разное, и React отметит расхождение разметки. Поэтому ни
 * `Math.random`, ни `Date.now` здесь нет: всё выводится из позиции элемента
 * в списке.
 */

import { CLIENTS, CREWS, MANAGERS, MODERATION_QUEUE, PRODUCT_REVIEWS } from "./showcase";

/** Метка, по которой интерфейс рисует подпись «демо-данные». Та же, что у сида. */
const DEMO_PREFIX = "[демо] ";

/**
 * Точка отсчёта для дат.
 *
 * Фиксированная, а не «сегодня»: дата, посчитанная от текущего момента,
 * отличалась бы у собранной страницы и у браузера, и React сообщил бы о
 * расхождении. Отзывы от этого стареют — через год «два месяца назад»
 * станет неправдой, но столько эта вставка не проживёт.
 */
const BASE_DATE = Date.UTC(2026, 6, 1);
const DAY = 86_400_000;

/** Дата, отстоящая от точки отсчёта на предсказуемое число дней назад. */
function dateFor(seed: number): string {
  return new Date(BASE_DATE - (seed % 180) * DAY).toISOString();
}

/** Имя автора из списка заказчиков — по кругу, чтобы имена не повторялись подряд. */
function authorFor(seed: number): string {
  return CLIENTS[seed % CLIENTS.length];
}

export interface DemoProductRating {
  productId: string;
  average: number;
  count: number;
}

export interface DemoProductReview {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
  isDemo: boolean;
}

/** Средние оценки всех товаров — как `listProductRatings()`, но без базы. */
export function demoProductRatings(): DemoProductRating[] {
  return PRODUCT_REVIEWS.map((entry) => {
    const sum = entry.items.reduce((acc, [rating]) => acc + rating, 0);
    return {
      productId: entry.productId,
      // Один знак после запятой — так же, как округляет база: «4,7» человек
      // читает, «4,666» нет.
      average: Math.round((sum / entry.items.length) * 10) / 10,
      count: entry.items.length,
    };
  });
}

/** Отзывы об одном товаре — как `listProductReviews()`, но без базы. */
export function demoProductReviews(productId: string, limit = 5): DemoProductReview[] {
  const entry = PRODUCT_REVIEWS.find((e) => e.productId === productId);
  if (!entry) return [];

  return entry.items.slice(0, limit).map(([rating, comment], index) => ({
    id: `${productId}-demo-${index}`,
    rating,
    comment: comment ? `${DEMO_PREFIX}${comment}` : null,
    authorName: authorFor(index + productId.length),
    createdAt: dateFor(index * 11 + productId.length),
    isDemo: true,
  }));
}

export interface DemoReviewCard {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: string;
  isDemo: boolean;
}

export interface DemoExecutorCard {
  id: string;
  displayName: string;
  city: string | null;
  specialties: string[];
  bio: string | null;
  priceHint: string | null;
  completedDeals: number;
  cancelledDeals: number;
  completionRate: number | null;
  hasActiveSubscription: boolean;
  ratingAverage: number | null;
  reviewCount: number;
  reviews: DemoReviewCard[];
}

/**
 * Карточки бригад с рейтингом — как `listExecutors()`, но без базы.
 *
 * Рейтинг считается по отзывам, а не задан числом: ровно так же, как это
 * делает база. Бригада без отзывов остаётся без звёзд — «пока нет отзывов»,
 * а не «0». Это единственный случай, когда отсутствие оценки честнее нуля,
 * и портить его выдуманной пятёркой не стоит даже на витрине.
 */
export function demoExecutors(): DemoExecutorCard[] {
  return CREWS.map((crew, crewIndex) => {
    const rated = crew.deals.filter((deal) => deal.rating > 0);
    const sum = rated.reduce((acc, deal) => acc + deal.rating, 0);

    return {
      id: `demo-${crew.slug}`,
      displayName: crew.name,
      city: crew.city,
      specialties: crew.specialties,
      bio: crew.bio,
      priceHint: crew.priceHint,
      completedDeals: crew.deals.length,
      cancelledDeals: 0,
      completionRate: crew.deals.length > 0 ? 100 : null,
      // Значок платной подписки — только первой бригаде: если он у всех, он
      // ничего не значит и перестаёт читаться как отличие.
      hasActiveSubscription: crewIndex === 0,
      ratingAverage: rated.length > 0 ? Math.round((sum / rated.length) * 10) / 10 : null,
      reviewCount: rated.length,
      reviews: rated.slice(0, 5).map((deal, index) => ({
        id: `${crew.slug}-demo-${index}`,
        rating: deal.rating,
        comment: deal.comment ? `${DEMO_PREFIX}${deal.comment}` : null,
        authorName: authorFor(index + crewIndex * 3),
        createdAt: dateFor(index * 9 + crewIndex * 5),
        isDemo: true,
      })),
    };
  });
}

export interface DemoModerationUser {
  id: string;
  displayName: string;
  email: string;
  /** Телефона у выдуманных людей нет — и придумывать его точно не нужно. */
  phone: null;
  role: "client" | "executor";
  status: "pending" | "active" | "blocked";
  city: string | null;
  createdAt: string;
  emailVerifiedAt: string | null;
  lastAction: {
    action: string;
    reason: string;
    createdAt: string;
    actorName: string;
  } | null;
}

/** Очередь модерации — как `listUsers()`, но без базы. */
export function demoModerationUsers(): DemoModerationUser[] {
  return MODERATION_QUEUE.map((user, index) => ({
    id: `demo-${user.slug}`,
    displayName: user.name,
    email: `${user.slug}@demo.opusgroup`,
    phone: null,
    role: user.role,
    status: user.status,
    city: user.city,
    createdAt: dateFor(index * 4 + 3),
    emailVerifiedAt: dateFor(index * 4 + 2),
    lastAction: user.blockedFor
      ? {
          action: "block",
          reason: user.blockedFor,
          createdAt: dateFor(index * 4),
          actorName: "Модератор",
        }
      : null,
  }));
}

export interface DemoManager {
  id: string;
  name: string;
  city: string | null;
  about: string;
}

/** Менеджеры поставщиков для чата с карточки товара. */
export function demoManagers(): DemoManager[] {
  return MANAGERS.map((manager) => ({
    id: `demo-${manager.slug}`,
    name: manager.name,
    city: manager.city,
    about: manager.about,
  }));
}
