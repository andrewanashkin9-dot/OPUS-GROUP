import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { requireUser } from "@/lib/server/auth/guard";
import { noStore, requestMeta } from "@/lib/server/auth/http";
import { createSession, setSessionCookies } from "@/lib/server/auth/session";
import { createUser } from "@/lib/server/auth/users";
import { isDbConfigured } from "@/lib/server/db-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TODO: удалить перед запуском — автоматический вход гостем.
 *
 * Заводит посетителю учётную запись и сессию молча, без формы регистрации,
 * чтобы демо-функции работали «просто так»: переписка с менеджером, отзывы,
 * переключатель роли и экран модерации требуют настоящего пользователя — не
 * из-за интерфейса, а потому что этого требует база. Сообщение без автора не
 * пропустит триггер, отзыв без author_id не вставится.
 *
 * Поэтому выбран этот путь, а не «снять проверки»: снимать их пришлось бы в
 * базе, то есть ломать те самые правила, ради показа которых всё и
 * затевалось. Здесь не ослаблено ничего — просто у гостя теперь есть имя.
 *
 * Учётная запись обычная, с ролью `client`: модератором посетитель делает
 * себя сам, кнопкой в углу.
 *
 * Почта в домене `@demo.opusgroup` — по ней демо-данные и убираются
 * (`npm run demo:seed -- --clean`), так что накопившиеся гости уйдут вместе с
 * остальным. Пароль случайный и никому не сообщается: входить этой записью
 * повторно незачем, сессия и так выдана.
 *
 * ⚠️ Цена, которую стоит назвать вслух: на каждого посетителя без cookie
 * заводится строка в `users`. Для витрины это ничего не значит, для боевого
 * сайта значило бы — ещё одна причина удалить всё это до запуска.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "no_db" }, noStore(503));
  }

  // Уже вошедшего не трогаем: иначе один заход на сайт выкидывал бы человека
  // из его собственной учётной записи в безымянного гостя.
  const existing = await requireUser();
  if (existing.ok) {
    return NextResponse.json({ created: false }, noStore(200));
  }

  try {
    const user = await createUser({
      email: `guest-${randomUUID()}@demo.opusgroup`,
      // Пароль не нужен никому, включая самого гостя, но колонка его требует,
      // и пустой строки там быть не должно.
      password: randomBytes(24).toString("base64url"),
      displayName: "Гость",
      role: "client",
    });

    const session = await createSession(user.id, user.role, requestMeta(request));
    await setSessionCookies(session);

    return NextResponse.json({ created: true, user }, noStore(201));
  } catch (error) {
    // Наружу ни текста ошибки базы, ни стека. Неудавшийся гость — это сайт,
    // каким он был до этой вставки, а не поломка.
    console.error("[demo/guest]", error);
    return NextResponse.json({ error: "guest_failed" }, noStore(500));
  }
}
