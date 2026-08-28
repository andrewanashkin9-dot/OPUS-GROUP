import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/server/db-config";
// TODO: удалить перед запуском — витрина без базы.
import { demoProductReviews } from "@/lib/demo/fallback";
import { productById } from "@/lib/marketplace";
import { listProductReviews } from "@/lib/server/reviews/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Отзывы об одном товаре.
 *
 * Существование товара проверяется по каталогу — тому же файлу, из которого
 * рисуется страница. Внешнего ключа в базе нет (каталог в неё не заведён),
 * и без этой проверки маршрут отвечал бы пустым списком на любую строку,
 * превращаясь в способ проверять чужие догадки об идентификаторах.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/products/[id]/reviews">) {
  const { id } = await ctx.params;
  if (!productById(id)) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }

  // TODO: удалить перед запуском — без базы отдаём выдуманные отзывы.
  if (!isDbConfigured()) {
    return NextResponse.json({ reviews: demoProductReviews(id) });
  }

  try {
    const reviews = await listProductReviews(id);
    return NextResponse.json(
      { reviews },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    console.error("[products/reviews]", error);
    return NextResponse.json({ reviews: [] });
  }
}
