import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { requireUser } from "@/lib/server/auth/guard";
import { findUserById } from "@/lib/server/auth/users";
import { LogoutButton } from "./LogoutButton";
import { RequestsPanel } from "./RequestsPanel";
import { ResponsesPanel } from "./ResponsesPanel";
import { SubscriptionPanel } from "./SubscriptionPanel";
import { ProfilePanel } from "./ProfilePanel";
import { EmailNotice } from "./EmailNotice";
import { FreeQuotaNote } from "./FreeQuotaNote";
// ⚠️ ВРЕМЕННЫЕ ДЕМО-ВСТАВКИ — удаляются одним коммитом (см. README).
import { DemoRoleSwitch } from "@/components/demo/DemoRoleSwitch";
import { isDemoMode } from "@/lib/demo-mode";
import { getOwnProfile } from "@/lib/server/profiles/queries";
import { query } from "@/lib/server/db";
import { readAccessState } from "@/lib/server/payments/access";
import {
  listClientRequests,
  listExecutorResponses,
  listExecutorWork,
  listOpenRequests,
} from "@/lib/server/requests/queries";

export const metadata: Metadata = {
  title: "Кабинет — OPUS GROUP",
  robots: { index: false, follow: false },
};

// Страница зависит от cookie, поэтому не может быть заранее собранной:
// иначе один посетитель увидел бы кабинет другого.
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  client: "Заказчик",
  executor: "Исполнитель",
  moderator: "Модератор",
  admin: "Администратор",
};

export default async function CabinetPage() {
  // Та же проверка, что и в маршрутах API. proxy.ts уже увёл бы гостя на
  // /login, но полагаться только на него нельзя: он смотрит лишь на наличие
  // cookie, а подделать cookie может кто угодно. Здесь проверяется подпись.
  const auth = await requireUser();
  if (!auth.ok) redirect("/login?next=/cabinet");

  const user = await findUserById(auth.user.id);
  if (!user || user.status !== "active") redirect("/login?next=/cabinet");

  return (
    // Шапка здесь появилась вместе с уведомлениями: колокольчик ведёт на
    // /cabinet#request-<id>, и без неё человек, перешедший по уведомлению,
    // оказывался на странице без колокольчика — и без единой ссылки обратно
    // на сайт.
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <p className="text-body-s text-cream-dim">Кабинет</p>
        <h1 className="font-display mt-2 text-h1 font-extrabold text-cream-bright">
          {user.displayName}
        </h1>

        <dl className="mt-10 divide-y divide-line border-y border-line">
          <Row label="Роль" value={ROLE_LABELS[user.role] ?? user.role} />
          <Row label="Почта" value={user.email ?? "—"} />
          <Row label="Город" value={user.city ?? "не указан"} />
          <Row
            label="В системе с"
            value={new Date(user.createdAt).toLocaleDateString("ru-RU")}
          />
        </dl>

        {(user.role === "moderator" || user.role === "admin") && (
          <p className="mt-8 rounded-2xl border border-line p-4 text-body-s text-cream-dim">
            Вам доступен маршрут{" "}
            <code className="text-cream">/api/moderation/users</code> — список
            тех, кто ждёт проверки. Остальным ролям он отвечает 403.
          </p>
        )}

        {user.email && !user.emailVerifiedAt && <EmailNotice />}

        {/* ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удалить вместе с остальными. */}
        {isDemoMode() && <DemoRoleSwitch currentRole={user.role} />}

        {/* Остаток бесплатных откликов — на том же экране, где исполнитель
            откликается. ⚠️ Помечено как временная вставка (см. README). */}
        {user.role === "executor" && (await renderFreeQuota(user.id))}

        {user.role === "executor" && (await renderSubscription(user.id))}
        {user.role === "executor" && (await renderProfile(user.id))}

        {/* История исполнителя идёт выше ленты новых заявок: свои дела
            важнее чужих предложений, и человек приходит в кабинет обычно за
            ними. */}
        {user.role === "executor" && (await renderExecutorHistory(user.id))}

        {(user.role === "client" || user.role === "executor") && (
          <RequestsPanel
            role={user.role}
            // Сервер уже здесь, у базы — запрашивать те же данные вторым
            // заходом из браузера значило бы показать пустой экран и сходить
            // по сети за тем, что было под рукой.
            initialRequests={
              user.role === "executor"
                ? await listOpenRequests(user.id)
                : await listClientRequests(user.id)
            }
          />
        )}

        <div className="mt-14">
          <LogoutButton />
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-4">
      <dt className="text-body-s text-cream-dim">{label}</dt>
      <dd className="text-body text-cream-bright">{value}</dd>
    </div>
  );
}

/** История исполнителя: принятая работа и все его отклики. */
async function renderExecutorHistory(executorId: string) {
  // Оба запроса разом: они независимы, и последовательное ожидание удвоило
  // бы задержку страницы на ровном месте.
  const [responses, work] = await Promise.all([
    listExecutorResponses(executorId),
    listExecutorWork(executorId),
  ]);
  return <ResponsesPanel responses={responses} work={work} />;
}

/**
 * Остаток бесплатных откликов.
 *
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — см. README.
 */
async function renderFreeQuota(executorId: string) {
  const access = await readAccessState(executorId);
  return (
    <FreeQuotaNote
      usedResponses={access.usedResponses}
      hasActiveSubscription={access.hasActiveSubscription}
    />
  );
}

/** Текущее состояние подписки исполнителя — читается прямо здесь, у базы. */
async function renderSubscription(executorId: string) {
  const { rows } = await query<{ status: string; paidUntil: Date }>(
    `select status, current_period_end as "paidUntil"
       from subscriptions
      where executor_id = $1 and status in ('active', 'past_due')
      limit 1`,
    [executorId],
  );
  const current = rows[0];
  return (
    <SubscriptionPanel
      status={current?.status ?? null}
      paidUntil={
        current ? new Date(current.paidUntil).toLocaleDateString("ru-RU") : null
      }
    />
  );
}

/** Профиль исполнителя — читается на сервере, редактируется на клиенте. */
async function renderProfile(executorId: string) {
  const profile = await getOwnProfile(executorId);
  return (
    <ProfilePanel
      initialSpecialties={profile?.specialties ?? []}
      initialBio={profile?.bio ?? null}
      initialPriceHint={profile?.priceHint ?? null}
      initialPortfolio={profile?.portfolio ?? []}
    />
  );
}
