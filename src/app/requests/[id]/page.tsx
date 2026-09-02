import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { requireUser } from "@/lib/server/auth/guard";
import { findRequest, listResponses } from "@/lib/server/requests/queries";
import { countUnread, listMessages, readThreadAccess } from "@/lib/server/messages/queries";
import { Chat } from "./Chat";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  RESPONSE_STATUS_LABELS,
  RESPONSE_STATUS_STYLES,
  formatDate,
  plural,
  workKindLabel,
} from "@/lib/requests-ui";

export const metadata: Metadata = {
  title: "Заявка — OPUS GROUP",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Страница одной заявки.
 *
 * Появилась вместе с историей в кабинете: до неё заявка жила только внутри
 * карточки в списке, и ни переслать ссылку, ни вернуться к ней было нельзя.
 *
 * Кто что видит — те же правила, что и у `/api/requests/[id]`, и они здесь
 * повторены, а не «унаследованы»: страница обращается к базе напрямую, и
 * проверка, оставшаяся только в маршруте API, её бы не защитила.
 *
 *  - владелец — заявку целиком и все отклики;
 *  - исполнитель — заявку и **только свой** отклик: чужие цены это чужая
 *    коммерческая информация, по ней подстраивают собственную;
 *  - посторонний — 404, даже если заявка существует. Иначе перебором
 *    адресов выясняется, какие заявки есть.
 */
export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const auth = await requireUser();
  if (!auth.ok) redirect(`/login?next=/requests/${id}`);

  const request = await findRequest(id);
  if (!request) notFound();

  const isOwner = request.clientId === auth.user.id;
  const all = await listResponses(id);
  const own = all.filter((r) => r.executorId === auth.user.id);

  // Посторонний не увидит и саму заявку, если она не в общей ленте.
  if (!isOwner && own.length === 0 && request.status !== "published") notFound();

  const responses = isOwner ? all : own;

  // Право на переписку считает сервер, и оно же решает, показывать ли чат
  // вовсе. Сообщения приезжают вместе со страницей, а не подгружаются после
  // отрисовки: сервер уже здесь, у базы.
  const thread = await readThreadAccess(id, auth.user.id);
  const messages = thread.canRead ? await listMessages(id) : [];
  // Считаем здесь, до того как чат откроют: если гасить непрочитанное самой
  // отрисовкой страницы, счётчик всегда показывал бы ноль и не сообщал бы
  // ничего. Гасит его сам чат, когда доезжает до экрана.
  const unread = thread.canRead ? await countUnread(id, auth.user.id) : 0;
  const details = [
    request.city,
    request.workKinds.map(workKindLabel).join(", "),
    request.budgetAmount ? `${Number(request.budgetAmount).toLocaleString("ru-RU")} ₽` : null,
  ].filter(Boolean);

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {/* -ml-2 с отступами: ссылка «назад» была высотой в строку текста,
            19 px. Это единственный выход со страницы, и промахиваться по
            нему нельзя. Отрицательный отступ слева возвращает надпись на
            прежнее место — на глаз ничего не сдвинулось. */}
        <Link
          href="/cabinet"
          className="-ml-2 inline-flex min-h-11 items-center px-2 text-body-s text-cream-dim hover:text-cream-bright"
        >
          ← В кабинет
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-h2 font-extrabold text-cream-bright">
              {request.title}
            </h1>
            <p className="mt-2 text-body-s text-cream-dim">
              {details.join(" · ")}
              {details.length > 0 && " · "}
              создана {formatDate(request.createdAt)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-caption ${REQUEST_STATUS_STYLES[request.status]}`}
          >
            {REQUEST_STATUS_LABELS[request.status]}
          </span>
        </div>

        {request.description && (
          <p className="mt-6 text-body text-cream-dim">{request.description}</p>
        )}

        {/* Вкладки страницы. Ссылками-якорями, а не переключением на
            скрипте: обе части нужны одновременно — читая переписку, человек
            сверяется с ценой из отклика, — и прятать одну за другой значит
            заставлять его прыгать туда-сюда. Ссылка при этом делает ровно
            то, чего от вкладки ждут: показывает, что раздел есть, и уводит
            к нему одним кликом.

            «Чат» видят только участники: у постороннего его нет ни в
            разметке, ни на сервере. */}
        <nav className="mt-10 flex flex-wrap gap-2 border-b border-line pb-3">
          <a
            href="#responses"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-body-s text-cream transition-colors hover:border-cream-dim"
          >
            {isOwner ? `Отклики (${responses.length})` : "Мой отклик"}
          </a>
          {thread.canRead && (
            <a
              href="#chat"
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-body-s transition-colors ${
                unread > 0
                  ? "border-[var(--accent-line)] text-accent"
                  : "border-line text-cream hover:border-cream-dim"
              }`}
            >
              Чат
              {unread > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-caption font-bold tabular-nums text-deep">
                  {unread}
                </span>
              )}
            </a>
          )}
        </nav>

        <section id="responses" className="mt-12 scroll-mt-20">
          <h2 className="font-display text-h3 font-extrabold text-cream-bright">
            {isOwner
              ? `Отклики (${responses.length})`
              : "Мой отклик"}
          </h2>
          {!isOwner && (
            <p className="mt-1 text-caption text-cream-dim">
              Чужие отклики и цены не показываются никому, кроме заказчика.
            </p>
          )}

          {responses.length === 0 ? (
            <p className="mt-4 text-body-s text-cream-dim">Откликов пока нет.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {responses.map((r) => (
                <li key={r.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body text-cream-bright">
                        {r.executorName}
                        {r.executorCity ? `, ${r.executorCity}` : ""}
                      </p>
                      <p className="mt-1 text-caption text-cream-dim">
                        {[
                          formatDate(r.createdAt),
                          r.priceAmount
                            ? `${Number(r.priceAmount).toLocaleString("ru-RU")} ₽`
                            : null,
                          r.leadTimeDays
                            ? `${r.leadTimeDays} ${plural(r.leadTimeDays, "день", "дня", "дней")}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-caption ${RESPONSE_STATUS_STYLES[r.status]}`}
                    >
                      {RESPONSE_STATUS_LABELS[r.status]}
                    </span>
                  </div>
                  {r.message && (
                    <p className="mt-3 text-body-s text-cream-dim">«{r.message}»</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Действия по заявке остаются в кабинете. Дублировать их здесь
              значит завести второе место, где они могут разойтись; страница
              же нужна прежде всего чтобы посмотреть и переслать ссылку. */}
          <p className="mt-6 text-caption text-cream-dim">
            Принять отклик, завершить или отменить заявку — в{" "}
            <Link
              href={`/cabinet#request-${request.id}`}
              className="text-accent underline underline-offset-2"
            >
              кабинете
            </Link>
            .
          </p>
        </section>

        {thread.canRead && (
          <Chat
            requestId={request.id}
            currentUserId={auth.user.id}
            initialMessages={messages.map((m) => ({
              ...m,
              createdAt: m.createdAt.toISOString(),
              readAt: m.readAt ? m.readAt.toISOString() : null,
            }))}
            initialCanWrite={thread.canWrite}
            initialReason={thread.reason}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
