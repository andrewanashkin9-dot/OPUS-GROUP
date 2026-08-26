import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth/guard";
import { noStore } from "@/lib/server/auth/http";
import { readJson } from "@/lib/server/auth/validate";
import { getOwnProfile, saveOwnProfile, addPortfolioItem } from "@/lib/server/profiles/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORK_KINDS = ["roof", "facade", "fence", "foundation", "window", "door"];

export async function GET() {
  const auth = await requireRole(["executor"]);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ profile: await getOwnProfile(auth.user.id) }, noStore(200));
}

/** Сохранение навыков и описания. */
export async function PUT(request: Request) {
  const auth = await requireRole(["executor"]);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const raw = Array.isArray(body.value.specialties) ? body.value.specialties : [];
  const specialties = [...new Set(raw.filter((s): s is string => typeof s === "string" && WORK_KINDS.includes(s)))];
  if (specialties.length !== raw.length) {
    return NextResponse.json({ error: "Неизвестный вид работ" }, noStore(400));
  }

  const bio = typeof body.value.bio === "string" ? body.value.bio.trim().slice(0, 2000) : null;
  const priceHint =
    typeof body.value.priceHint === "string" ? body.value.priceHint.trim().slice(0, 120) : null;

  await saveOwnProfile(auth.user.id, { specialties, bio: bio || null, priceHint: priceHint || null });
  return NextResponse.json({ ok: true }, noStore(200));
}

/** Добавление работы в портфолио. */
export async function POST(request: Request) {
  const auth = await requireRole(["executor"]);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, noStore(400));

  const title = typeof body.value.title === "string" ? body.value.title.trim() : "";
  if (!title || title.length > 200) {
    return NextResponse.json({ error: "Укажите название работы (до 200 символов)" }, noStore(400));
  }

  const workKind = typeof body.value.workKind === "string" && WORK_KINDS.includes(body.value.workKind)
    ? body.value.workKind
    : null;

  const rawUrl = typeof body.value.imageUrl === "string" ? body.value.imageUrl.trim() : "";
  // Разрешены только http(s). Без проверки сюда прошло бы javascript:... —
  // и ссылка на «фото» выполнила бы чужой код в браузере посетителя.
  const imageUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl.slice(0, 1000) : null;
  if (rawUrl && !imageUrl) {
    return NextResponse.json({ error: "Ссылка на фото должна начинаться с http:// или https://" }, noStore(400));
  }

  const description =
    typeof body.value.description === "string" ? body.value.description.trim().slice(0, 1000) : null;

  const item = await addPortfolioItem(auth.user.id, {
    title,
    description: description || null,
    imageUrl,
    workKind,
  });
  return NextResponse.json({ item }, noStore(201));
}
