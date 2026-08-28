import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/server/auth/guard";
import { listUsers } from "@/lib/server/moderation/queries";
import { isDbConfigured } from "@/lib/server/db-config";
// TODO: удалить перед запуском — витрина без базы.
import { demoModerationUsers } from "@/lib/demo/fallback";
import { ModerationPanel } from "./ModerationPanel";

export const metadata: Metadata = {
  title: "Модерация — OPUS GROUP",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  // TODO: удалить перед запуском — экран модерации без базы.
  //
  // Без базы нет ни пользователей, ни сессий, а значит и роли модератора
  // взяться неоткуда: страница уводила бы всех на вход, которого тоже нет.
  // Поэтому здесь она открывается всем и показывает выдуманную очередь,
  // где решения живут до перезагрузки.
  //
  // Проверку роли это не ослабляет: как только база настроена, работает
  // ветка ниже, и без роли модератора на страницу по-прежнему не попасть.
  if (!isDbConfigured()) {
    return (
      <ModerationLayout demo>
        <ModerationPanel currentUserId="demo" initialUsers={demoModerationUsers()} offline />
      </ModerationLayout>
    );
  }

  // Та же проверка роли, что и в API. proxy.ts увёл бы гостя на вход, но он
  // смотрит только на наличие cookie и роль не знает вовсе.
  const auth = await requireRole(["moderator", "admin"]);
  if (!auth.ok) redirect("/login?next=/moderation");

  // Первый список готовит сервер: он уже у базы, и лишний поход из браузера
  // за теми же данными означал бы пустой экран на пол-секунды.
  const users = await listUsers({ actorId: auth.user.id, status: "pending" });

  return (
    <ModerationLayout>
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
    </ModerationLayout>
  );
}

/**
 * Общая обвязка экрана — заголовок и пояснение.
 *
 * Вынесена, чтобы витрина без базы и настоящий экран не разъехались: иначе
 * из двух копий правят одну.
 */
function ModerationLayout({
  children,
  demo = false,
}: {
  children: React.ReactNode;
  /** TODO: удалить перед запуском — подпись «решения не сохраняются». */
  demo?: boolean;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-body-s text-cream-dim">Модерация</p>
      <h1 className="font-display mt-2 text-h1 font-extrabold text-cream-bright">Пользователи</h1>
      <p className="prose-measure mt-4 text-body-s text-cream-dim">
        Каждое решение сохраняется вместе с причиной и автором. Причину видит
        пользователь — ограничение доступа должно быть объяснимо.
      </p>

      {/* TODO: удалить перед запуском — честная подпись у витрины без базы.
          Человек должен понимать, что заблокировал выдуманного человека, и
          что после перезагрузки страницы всё вернётся. */}
      {demo && (
        <p
          className="mt-4 rounded-xl border border-dashed p-3 text-body-s text-cream-dim"
          style={{ borderColor: "rgba(255,215,0,0.5)" }}
        >
          <span className="font-bold text-accent">Демо-данные.</span> Пользователи
          выдуманы, база не подключена. Блокировать и одобрять можно —
          по-настоящему всё работает так же, — но решения живут до перезагрузки
          страницы.
        </p>
      )}

      {children}
    </main>
  );
}
