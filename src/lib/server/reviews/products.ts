import "server-only";

import { query } from "../db";

/**
 * Рейтинги товаров каталога.
 *
 * Средняя оценка, как и у исполнителей, **нигде не хранится** — считается по
 * таблице при каждом запросе. Хранимое число пришлось бы пересчитывать при
 * каждом новом отзыве, и оно разошлось бы с реальностью после первой же
 * забытой ветки кода.
 *
 * Каталог лежит в файле, а не в базе, поэтому здесь нет ни соединения с
 * таблицей товаров, ни проверки, что товар существует: она возможна только
 * там, где виден сам каталог, — в приложении.
 */

export interface ProductRating {
  productId: string;
  /** Округлена до одного знака в базе: «4,7» человек читает, «4,666» нет. */
  average: number;
  count: number;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string;
  createdAt: Date;
  /**
   * ⚠️ Отзыв заведён сид-скриптом для показа, а не настоящим покупателем.
   *
   * Признак вычисляется по автору, а не хранится колонкой: демо-заказчики
   * заведены с почтой на `@demo.opusgroup`, и когда их удалят вместе с
   * отзывами (`npm run demo:seed -- --clean`), признак исчезнет сам. Колонка
   * в таблице пережила бы уборку и осталась бы врать.
   */
  isDemo: boolean;
}

/**
 * Рейтинги всех товаров разом.
 *
 * Одним запросом на всю страницу, а не по запросу на карточку: в каталоге
 * 37 позиций, и 37 обращений к базе ради одной цифры в каждой — это
 * страница, которая думает секунду вместо десяти миллисекунд.
 */
export async function listProductRatings(): Promise<ProductRating[]> {
  const { rows } = await query<{ productId: string; average: string; count: number }>(
    `select product_id                     as "productId",
            round(avg(rating)::numeric, 1) as average,
            count(*)::int                  as count
       from product_reviews
      group by product_id`,
  );
  // numeric приезжает строкой: драйвер не превращает его в число сам, чтобы
  // не терять точность на больших значениях. Здесь это обычная оценка.
  return rows.map((r) => ({ ...r, average: Number(r.average) }));
}

/** Последние отзывы об одном товаре — с текстом, для его страницы. */
export async function listProductReviews(
  productId: string,
  limit = 5,
): Promise<ProductReview[]> {
  const { rows } = await query<ProductReview>(
    `select v.id,
            v.rating,
            v.comment,
            u.display_name as "authorName",
            v.created_at   as "createdAt",
            -- ⚠️ ВРЕМЕННО: пометка демо-отзывов. Удаляется вместе с
            -- сид-скриптом, когда появятся настоящие покупатели.
            (u.email like '%@demo.opusgroup') as "isDemo"
       from product_reviews v
       join users u on u.id = v.author_id
      where v.product_id = $1
      order by v.created_at desc
      limit $2`,
    [productId, limit],
  );
  return rows;
}
