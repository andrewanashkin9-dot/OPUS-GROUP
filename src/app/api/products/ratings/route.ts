import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/server/db-config";
// TODO: удалить перед запуском — витрина без базы.
import { demoProductRatings } from "@/lib/demo/fallback";
import { listProductRatings } from "@/lib/server/reviews/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Рейтинги всех товаров разом.
 *
 * Открыт всем: оценки товаров — витрина, как и цены. Личных данных здесь
 * нет, только идентификатор позиции и два числа.
 *
 * Отдаётся одним списком, чтобы страница каталога сходила за ними один раз,
 * а не по разу на каждую из 37 карточек.
 */
export async function GET() {
  if (!isDbConfigured()) {
    // TODO: удалить перед запуском — без базы отдаём выдуманные оценки.
    // Раньше здесь был пустой список, и каталог выглядел так, будто товары
    // никто не оценивал. Пустая витрина не показывает функцию; выдуманная
    // показывает — и помечена как выдуманная везде, где видна.
    return NextResponse.json({ ratings: demoProductRatings() }, { headers: cacheHeaders() });
  }

  try {
    const ratings = await listProductRatings();
    return NextResponse.json({ ratings }, { headers: cacheHeaders() });
  } catch (error) {
    // В журнал целиком, наружу — пусто: в тексте ошибки подключения бывают
    // хост и имя пользователя. Каталог из-за этого не должен падать.
    console.error("[products/ratings]", error);
    return NextResponse.json({ ratings: [] }, { headers: cacheHeaders() });
  }
}

/**
 * Минута кеша на общем кеше и сутки на «отдай устаревшее, пока обновляешь».
 * Оценки — не курс валют: показать минутной давности среднюю по 12 отзывам
 * ничем не хуже свежей, а база от этого не получает запрос на каждый заход.
 */
function cacheHeaders(): Record<string, string> {
  return { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400" };
}
