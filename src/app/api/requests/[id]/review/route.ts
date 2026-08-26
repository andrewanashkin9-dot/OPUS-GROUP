import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { DomainError } from "@/lib/server/requests/queries";
import { MAX_RATING, MIN_RATING, createReview } from "@/lib/server/reviews/queries";

/**
 * Отзыв по завершённой заявке.
 *
 * Роль здесь — только первый рубеж: «клиент ли ты вообще». Своя ли это
 * заявка, завершена ли она и кому адресован отзыв — решает база, одним
 * запросом. Разносить такие проверки по коду нельзя: между «прочитали, что
 * заявка ваша» и «записали отзыв» состояние успевает измениться.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/requests/[id]/review">) {
  const auth = await requireRole(["client"]);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const rating = Number(body.value.rating);
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return NextResponse.json(
      { error: `Оценка — целое число от ${MIN_RATING} до ${MAX_RATING}` },
      noStore(400),
    );
  }

  const rawComment = typeof body.value.comment === "string" ? body.value.comment.trim() : "";
  if (rawComment.length > 2000) {
    return NextResponse.json({ error: "Отзыв длиннее 2000 символов" }, noStore(400));
  }

  try {
    const review = await createReview({
      requestId: id,
      authorId: auth.user.id,
      rating,
      comment: rawComment || null,
    });
    return NextResponse.json({ review }, noStore(201));
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[reviews/create]", error);
    return NextResponse.json({ error: "Не удалось сохранить отзыв" }, noStore(500));
  }
}
