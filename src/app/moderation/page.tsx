import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/server/auth/guard";
import { listUsers } from "@/lib/server/moderation/queries";
import { ModerationPanel } from "./ModerationPanel";

export const metadata: Metadata = {
  title: "Модерация — OPUS GROUP",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  // Та же проверка роли, что и в API. proxy.ts увёл бы гостя на вход, но он
  // смотрит только на наличие cookie и роль не знает вовсе.
  const auth = await requireRole(["moderator", "admin"]);
  if (!auth.ok) redirect("/login?next=/moderation");

  // Первый список готовит сервер: он уже у базы, и лишний поход из браузера
  // за теми же данными означал бы пустой экран на пол-секунды.
  const users = await listUsers({ actorId: auth.user.id, status: "pending" });

  return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-body-s text-cream-dim">Модерация</p>
      <h1 className="font-display mt-2 text-h1 font-extrabold text-cream-bright">Пользователи</h1>
      <p className="prose-measure mt-4 text-body-s text-cream-dim">
        Каждое решение сохраняется вместе с причиной и автором. Причину видит
        пользователь — ограничение доступа должно быть объяснимо.
      </p>

      <ModerationPanel
        currentUserId={auth.user.id}
        initialUsers={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
          lastAction: u.lastAction
            ? { ...u.lastAction, createdAt: new Date(u.lastAction.createdAt).toISOString() }
            : null,
        }))}
      />
    </main>
  );
}
