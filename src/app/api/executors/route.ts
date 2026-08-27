import { NextResponse } from "next/server";
import { listExecutors } from "@/lib/server/profiles/queries";

/**
 * Публичный список исполнителей для страницы «Бригады».
 *
 * Без проверки входа: это витрина, её видят и незарегистрированные. Личных
 * данных здесь нет — только то, что исполнитель публикует сам.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORK_KINDS = ["roof", "facade", "fence", "foundation", "window", "door"];

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("specialties");
  // Значения фильтра сверяются со списком: они уходят в запрос как work_kind[],
  // и незнакомое значение уронило бы запрос ошибкой приведения типа.
  const specialties = raw
    ? raw.split(",").map((s) => s.trim()).filter((s) => WORK_KINDS.includes(s))
    : undefined;

  const executors = await listExecutors({ specialties });
  return NextResponse.json(
    { executors },
    // Витрина меняется редко: минуту можно отдавать из кеша, это снимает
    // нагрузку при наплыве. Но не дольше — заблокированный исполнитель
    // должен исчезать быстро.
    { status: 200, headers: { "Cache-Control": "public, max-age=0, s-maxage=60" } },
  );
}
