import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { DomainError } from "@/lib/server/requests/queries";
import {
  MAX_RATING,
  MIN_RATING,
  createReviewForExecutorDEMO,
} from "@/lib/server/reviews/queries";

/**
 * ⚠️⚠️ ВРЕМЕННОЕ ТЕСТОВОЕ ПОСЛАБЛЕНИЕ — удалить перед запуском. ⚠️⚠️
 *
 * Отзыв об исполнителе от любого вошедшего пользователя.
 *
 * Настоящий маршрут — `POST /api/requests/[id]/review`: там отзыв
 * привязан к своей завершённой заявке, и это правило держит база. Этот
 * существует только чтобы форму подачи отзыва можно было проверить глазами.
 *
 * Он **не закрыт флагом DEMO_MODE** намеренно: закрытый, он не работал бы
 * там, где его собираются щупать, и смысла в нём не осталось бы. Цена
 * решения прямая — пока он жив, рейтинг перестаёт быть свидетельством:
 * любой зарегистрировавшийся может поставить конкуренту единицу, ни разу с
 * ним не работав. Удалять вместе с миграцией 0010, и до реального запуска.
 *
 * requireUser, а не requireRole(["client"]): роль исполнителя тоже пускаем —
 * отзыв самому себе всё равно не пройдёт, это ловит база.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteContext<"/api/executors/[id]/review">) {
  const auth = await requireUser();
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
    const review = await createReviewForExecutorDEMO({
      executorId: id,
      authorId: auth.user.id,
      rating,
      comment: rawComment || null,
    });
    return NextResponse.json({ review }, noStore(201));
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message }, noStore(error.status));
    }
    console.error("[reviews/create-demo]", error);
    return NextResponse.json({ error: "Не удалось сохранить отзыв" }, noStore(500));
  }
}
