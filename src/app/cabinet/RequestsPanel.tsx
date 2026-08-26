"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/Button";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * Заявки в кабинете. Один компонент на обе роли: клиент видит свои заявки и
 * отклики на них, исполнитель — ленту новых заявок.
 *
 * Все запросы идут через useApiFetch: он сам продлевает сессию, когда
 * пятнадцатиминутный токен истёк, и уводит на вход, только если продлить
 * действительно нечем.
 */

type Status = "draft" | "published" | "in_progress" | "completed" | "cancelled";

const STATUS_LABELS: Record<Status, string> = {
  draft: "Черновик",
  published: "Новая",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
};

const STATUS_STYLES: Record<Status, string> = {
  draft: "border-line text-cream-dim",
  published: "border-cream-dim text-cream-bright",
  in_progress: "border-warning/50 text-warning",
  completed: "border-success/50 text-success",
  cancelled: "border-line text-cream-dim",
};

const WORK_KINDS = [
  { id: "roof", label: "Кровля" },
  { id: "facade", label: "Фасад" },
  { id: "fence", label: "Забор" },
  { id: "foundation", label: "Фундамент" },
  { id: "window", label: "Окна" },
  { id: "door", label: "Двери" },
] as const;

interface RequestItem {
  id: string;
  status: Status;
  title: string;
  description: string | null;
  city: string | null;
  workKinds: string[];
  budgetAmount: string | null;
  responsesCount?: number;
}

interface ResponseItem {
  id: string;
  executorName: string;
  executorCity: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  message: string | null;
  priceAmount: string | null;
  leadTimeDays: number | null;
}

/**
 * Первый список приходит с сервера готовым (`initialRequests`), а не
 * догружается после отрисовки. Две причины: человек сразу видит заявки без
 * пустого экрана с «загружаем», и на странице нет запроса, который стартует
 * из эффекта, — React такое не любит и справедливо ругается.
 *
 * Перезагрузка через API нужна только после действий: создали заявку,
 * приняли отклик, завершили.
 */
export function RequestsPanel({
  role,
  initialRequests,
}: {
  role: string;
  initialRequests: RequestItem[];
}) {
  const call = useApiFetch();
  const isClient = role === "client";

  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { ok, data } = await call<{ requests?: RequestItem[]; error?: string }>("/api/requests");
    if (ok && data.requests) setRequests(data.requests);
    else setError(data.error ?? "Не удалось загрузить заявки");
  }, [call]);

  /** Одно место, где выполняются действия: запрос, разбор ошибки, перезагрузка. */
  const act = useCallback(
    async (url: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      const { ok, data } = await call<{ error?: string }>(url, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!ok) setError(data.error ?? "Не получилось");
      else await load();
      setBusy(false);
      return ok;
    },
    [call, load],
  );

  return (
    <section className="mt-16">
      <h2 className="font-display text-h3 font-extrabold text-cream-bright">
        {isClient ? "Мои заявки" : "Новые заявки"}
      </h2>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}

      {isClient && <NewRequestForm busy={busy} onCreate={(body) => act("/api/requests", body)} />}

      {requests.length === 0 ? (
        <p className="mt-8 text-body-s text-cream-dim">
          {isClient ? "Заявок пока нет — создайте первую." : "Свободных заявок сейчас нет."}
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {requests.map((item) => (
            <RequestCard key={item.id} item={item} isClient={isClient} busy={busy} act={act} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestCard({
  item,
  isClient,
  busy,
  act,
}: {
  item: RequestItem;
  isClient: boolean;
  busy: boolean;
  act: (url: string, body?: unknown) => Promise<boolean>;
}) {
  const call = useApiFetch();
  const [responses, setResponses] = useState<ResponseItem[] | null>(null);
  const [open, setOpen] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && responses === null) {
      const { data } = await call<{ responses?: ResponseItem[] }>(`/api/requests/${item.id}`);
      setResponses(data.responses ?? []);
    }
  }

  return (
    <li className="rounded-3xl border border-line p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-body-l text-cream-bright">{item.title}</h3>
          <p className="mt-1 text-body-s text-cream-dim">
            {[
              item.city,
              item.workKinds.map((k) => WORK_KINDS.find((w) => w.id === k)?.label ?? k).join(", "),
              item.budgetAmount ? `${Number(item.budgetAmount).toLocaleString("ru-RU")} ₽` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-caption ${STATUS_STYLES[item.status]}`}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </div>

      {item.description && <p className="mt-4 text-body-s text-cream-dim">{item.description}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isClient ? (
          <>
            <button
              type="button"
              onClick={toggle}
              className="text-ui font-bold text-cream-dim hover:text-cream-bright"
            >
              {open ? "Скрыть отклики" : `Отклики (${item.responsesCount ?? 0})`}
            </button>
            {item.status === "in_progress" && (
              <Button
                disabled={busy}
                onClick={() => act(`/api/requests/${item.id}/status`, { status: "completed" })}
              >
                Работа выполнена
              </Button>
            )}
            {(item.status === "published" || item.status === "in_progress") && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => act(`/api/requests/${item.id}/status`, { status: "cancelled" })}
              >
                Отменить
              </Button>
            )}
          </>
        ) : (
          <RespondForm busy={busy} onSend={(body) => act(`/api/requests/${item.id}/responses`, body)} />
        )}
      </div>

      {open && responses !== null && (
        <ul className="mt-5 space-y-3 border-t border-line pt-5">
          {responses.length === 0 && <li className="text-body-s text-cream-dim">Откликов пока нет.</li>}
          {responses.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-body-s text-cream-bright">
                  {r.executorName}
                  {r.executorCity ? `, ${r.executorCity}` : ""}
                </p>
                <p className="text-caption text-cream-dim">
                  {[
                    r.priceAmount ? `${Number(r.priceAmount).toLocaleString("ru-RU")} ₽` : null,
                    r.leadTimeDays ? `${r.leadTimeDays} дн.` : null,
                    r.message,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "без условий"}
                </p>
              </div>
              {r.status === "pending" && item.status === "published" ? (
                <Button disabled={busy} onClick={() => act(`/api/responses/${r.id}/accept`)}>
                  Принять
                </Button>
              ) : (
                <span className="text-caption text-cream-dim">
                  {r.status === "accepted" ? "принят" : r.status === "rejected" ? "отклонён" : "—"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function NewRequestForm({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: unknown) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const created = await onCreate({
      title,
      city: city || null,
      budgetAmount: budget || null,
      workKinds: kinds,
    });
    if (created) {
      setTitle("");
      setCity("");
      setBudget("");
      setKinds([]);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border border-line p-6">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Что нужно сделать"
        required
        maxLength={200}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-2">
        {WORK_KINDS.map((kind) => {
          const active = kinds.includes(kind.id);
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() =>
                setKinds((prev) =>
                  active ? prev.filter((k) => k !== kind.id) : [...prev, kind.id],
                )
              }
              className={`rounded-full border px-4 py-2 text-ui transition-colors ${
                active ? "border-cream text-cream-bright" : "border-line text-cream-dim"
              }`}
            >
              {kind.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Город"
          className={inputClass}
        />
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="Бюджет, ₽"
          inputMode="decimal"
          className={inputClass}
        />
      </div>
      <Button type="submit" disabled={busy || kinds.length === 0}>
        Создать заявку
      </Button>
    </form>
  );
}

function RespondForm({
  busy,
  onSend,
}: {
  busy: boolean;
  onSend: (body: unknown) => Promise<boolean>;
}) {
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const sent = await onSend({ priceAmount: price || null, leadTimeDays: days || null });
        if (sent) {
          setPrice("");
          setDays("");
        }
      }}
      className="flex w-full flex-wrap items-center gap-3"
    >
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Цена, ₽"
        inputMode="decimal"
        className={`${inputClass} max-w-40`}
      />
      <input
        value={days}
        onChange={(e) => setDays(e.target.value)}
        placeholder="Срок, дней"
        inputMode="numeric"
        className={`${inputClass} max-w-40`}
      />
      <Button type="submit" disabled={busy}>
        Откликнуться
      </Button>
    </form>
  );
}

const inputClass =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-body text-cream-bright " +
  "placeholder:text-cream-dim focus:border-cream-dim focus:outline-none";
