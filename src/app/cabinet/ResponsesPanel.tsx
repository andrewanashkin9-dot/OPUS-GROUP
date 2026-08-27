"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusFilter } from "@/components/cabinet/StatusFilter";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  RESPONSE_STATUS_LABELS,
  RESPONSE_STATUS_STYLES,
  formatDate,
  plural,
  type RequestStatus,
  type ResponseStatus,
} from "@/lib/requests-ui";

/**
 * История исполнителя: что он предлагал и что из этого вышло.
 *
 * Два списка, а не один, хотя данные пересекаются. Отклик — это заявка о
 * себе, принятая заявка — обязательство. Смешанные в кучу, они заставляют
 * каждый раз глазами отделять «я предложил» от «я должен сделать», а это
 * ровно те две вещи, за которыми сюда и приходят.
 *
 * Отклонённые отклики не прячутся: «откликался, не выбрали» — факт, который
 * человек имеет право видеть. В списке, где неудачи молча исчезают,
 * остаётся ощущение, что отклик просто не отправился.
 */

export interface ExecutorResponseItem {
  id: string;
  requestId: string;
  requestTitle: string;
  requestStatus: RequestStatus;
  requestCity: string | null;
  status: ResponseStatus;
  message: string | null;
  priceAmount: string | null;
  leadTimeDays: number | null;
  createdAt: string | Date;
}

export interface ExecutorWorkItem {
  id: string;
  title: string;
  status: RequestStatus;
  city: string | null;
  createdAt: string | Date;
  responsesCount?: number;
}

const RESPONSE_ORDER: ResponseStatus[] = ["pending", "accepted", "rejected", "withdrawn"];
const WORK_ORDER: RequestStatus[] = ["in_progress", "completed", "cancelled"];

export function ResponsesPanel({
  responses,
  work,
}: {
  responses: ExecutorResponseItem[];
  work: ExecutorWorkItem[];
}) {
  return (
    <>
      <WorkList work={work} />
      <ResponseList responses={responses} />
    </>
  );
}

function WorkList({ work }: { work: ExecutorWorkItem[] }) {
  const [filter, setFilter] = useState<RequestStatus | "all">("all");

  const counts = useMemo(
    () => WORK_ORDER.map((id) => ({ id, count: work.filter((w) => w.status === id).length })),
    [work],
  );
  const visible = useMemo(
    () => (filter === "all" ? work : work.filter((w) => w.status === filter)),
    [work, filter],
  );

  return (
    <section className="mt-16">
      <h2 className="font-display text-h3 font-extrabold text-cream-bright">Моя работа</h2>
      <p className="mt-1 text-body-s text-cream-dim">
        Заявки, где ваш отклик приняли.
      </p>

      <StatusFilter
        value={filter}
        onChange={setFilter}
        counts={counts}
        labels={REQUEST_STATUS_LABELS}
        total={work.length}
      />

      {visible.length === 0 ? (
        <p className="mt-6 text-body-s text-cream-dim">
          {work.length > 0
            ? "В этом статусе заявок нет."
            : "Пока ничего не приняли. Откликайтесь на заявки ниже."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/requests/${item.id}`}
                  className="text-body text-cream-bright underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-caption text-cream-dim">
                  {[item.city, formatDate(item.createdAt)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge className={REQUEST_STATUS_STYLES[item.status]}>
                {REQUEST_STATUS_LABELS[item.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResponseList({ responses }: { responses: ExecutorResponseItem[] }) {
  const [filter, setFilter] = useState<ResponseStatus | "all">("all");

  const counts = useMemo(
    () =>
      RESPONSE_ORDER.map((id) => ({ id, count: responses.filter((r) => r.status === id).length })),
    [responses],
  );
  const visible = useMemo(
    () => (filter === "all" ? responses : responses.filter((r) => r.status === filter)),
    [responses, filter],
  );

  return (
    <section className="mt-16">
      <h2 className="font-display text-h3 font-extrabold text-cream-bright">Мои отклики</h2>
      <p className="mt-1 text-body-s text-cream-dim">
        {responses.length} {plural(responses.length, "отклик", "отклика", "откликов")} — свежие
        сверху.
      </p>

      <StatusFilter
        value={filter}
        onChange={setFilter}
        counts={counts}
        labels={RESPONSE_STATUS_LABELS}
        total={responses.length}
      />

      {visible.length === 0 ? (
        <p className="mt-6 text-body-s text-cream-dim">
          {responses.length > 0 ? "В этом статусе откликов нет." : "Откликов пока нет."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/requests/${item.requestId}`}
                    className="text-body text-cream-bright underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                  >
                    {item.requestTitle}
                  </Link>
                  <p className="mt-1 text-caption text-cream-dim">
                    {[
                      item.requestCity,
                      formatDate(item.createdAt),
                      item.priceAmount
                        ? `${Number(item.priceAmount).toLocaleString("ru-RU")} ₽`
                        : null,
                      item.leadTimeDays
                        ? `${item.leadTimeDays} ${plural(item.leadTimeDays, "день", "дня", "дней")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge className={RESPONSE_STATUS_STYLES[item.status]}>
                    {RESPONSE_STATUS_LABELS[item.status]}
                  </Badge>
                  {/* Статус заявки рядом со статусом отклика: «принят», но
                      заявка отменена — это разные новости, и вторая важнее. */}
                  {item.requestStatus !== "published" && (
                    <Badge className={REQUEST_STATUS_STYLES[item.requestStatus]}>
                      {REQUEST_STATUS_LABELS[item.requestStatus]}
                    </Badge>
                  )}
                </div>
              </div>

              {item.message && (
                <p className="mt-3 text-body-s text-cream-dim">«{item.message}»</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-caption ${className}`}>{children}</span>
  );
}
