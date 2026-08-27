"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/Button";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * Экран модерации.
 *
 * Устроен вокруг одного правила: **заблокировать без причины нельзя.** Кнопка
 * не отправляет запрос, пока причина не написана, а сервер всё равно
 * проверяет её сам — интерфейс убеждает, сервер обязывает.
 *
 * Причина последнего решения показана прямо в карточке: модератор, который
 * разблокирует человека, должен видеть, за что его заблокировали, а не
 * искать это в другом окне.
 */

const MIN_REASON = 10;

type Status = "pending" | "active" | "blocked" | "deleted";

const STATUS_LABELS: Record<Status, string> = {
  pending: "Ждёт проверки",
  active: "Активен",
  blocked: "Заблокирован",
  deleted: "Удалён",
};

const STATUS_STYLES: Record<Status, string> = {
  pending: "border-warning/50 text-warning",
  active: "border-success/50 text-success",
  blocked: "border-error/50 text-error",
  deleted: "border-line text-cream-dim",
};

const ROLE_LABELS: Record<string, string> = {
  client: "Заказчик",
  executor: "Исполнитель",
  moderator: "Модератор",
  admin: "Администратор",
};

export interface ManagedUser {
  id: string;
  role: string;
  status: Status;
  email: string | null;
  phone: string | null;
  displayName: string;
  city: string | null;
  createdAt: string;
  emailVerifiedAt: string | null;
  lastAction: {
    action: string;
    reason: string;
    actorName: string | null;
    createdAt: string;
  } | null;
}

const FILTERS = [
  { id: "pending", label: "Ждут проверки" },
  { id: "active", label: "Активные" },
  { id: "blocked", label: "Заблокированные" },
  { id: "all", label: "Все" },
] as const;

export function ModerationPanel({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: string;
}) {
  const call = useApiFetch();
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (nextFilter: string, nextSearch: string) => {
      setBusy(true);
      const params = new URLSearchParams({ status: nextFilter });
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      const { ok, data } = await call<{ users?: ManagedUser[]; error?: string }>(
        `/api/moderation/users?${params}`,
      );
      if (ok && data.users) setUsers(data.users);
      else setError(data.error ?? "Не удалось загрузить список");
      setBusy(false);
    },
    [call],
  );

  const act = useCallback(
    async (userId: string, action: string, reason: string) => {
      setBusy(true);
      setError(null);
      const { ok, data } = await call<{ error?: string }>(`/api/moderation/users/${userId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!ok) {
        setError(data.error ?? "Не получилось");
        setBusy(false);
        return false;
      }
      await load(filter, search);
      return true;
    },
    [call, filter, search, load],
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              void load(f.id, search);
            }}
            className={`rounded-full border px-4 py-2 text-ui transition-colors ${
              filter === f.id ? "border-cream text-cream-bright" : "border-line text-cream-dim"
            }`}
          >
            {f.label}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(filter, search);
          }}
          className="ml-auto flex gap-2"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя или почта"
            className="rounded-2xl border border-line bg-surface px-4 py-2 text-body-s text-cream-bright placeholder:text-cream-dim focus:border-cream-dim focus:outline-none"
          />
          <Button variant="secondary" type="submit" disabled={busy}>
            Найти
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}

      {users.length === 0 ? (
        <p className="mt-10 text-body-s text-cream-dim">Никого не найдено.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              busy={busy}
              act={act}
              // Себя модерировать нельзя — сервер это отвергает, но и
              // предлагать кнопку, которая заведомо не сработает, незачем.
              isSelf={user.id === currentUserId}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function UserCard({
  user,
  busy,
  act,
  isSelf,
}: {
  user: ManagedUser;
  busy: boolean;
  act: (userId: string, action: string, reason: string) => Promise<boolean>;
  isSelf: boolean;
}) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  const blocked = user.status === "blocked";
  const action = blocked ? "unblock" : user.status === "pending" ? "approve" : "block";
  const actionLabel = blocked ? "Разблокировать" : user.status === "pending" ? "Одобрить" : "Заблокировать";

  // Причина проверяется и здесь, и на сервере. Здесь — чтобы человек понял
  // требование до нажатия; на сервере — потому что интерфейс можно обойти.
  const reasonTooShort = reason.trim().length < MIN_REASON;

  return (
    <li className="rounded-3xl border border-line p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-body-l text-cream-bright">{user.displayName}</h3>
          <p className="mt-1 text-body-s text-cream-dim">
            {[
              ROLE_LABELS[user.role] ?? user.role,
              user.email,
              user.city,
              user.emailVerifiedAt ? "почта подтверждена" : "почта не подтверждена",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-caption ${STATUS_STYLES[user.status]}`}>
          {STATUS_LABELS[user.status]}
        </span>
      </div>

      {user.lastAction && (
        <p className="mt-4 rounded-2xl border border-line p-4 text-body-s text-cream-dim">
          <span className="text-cream">Последнее решение:</span> {user.lastAction.reason}
          <span className="block text-caption">
            {user.lastAction.actorName ?? "—"},{" "}
            {new Date(user.lastAction.createdAt).toLocaleString("ru-RU")}
          </span>
        </p>
      )}

      {isSelf ? (
        <p className="mt-5 text-body-s text-cream-dim">Это вы.</p>
      ) : open ? (
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-2 flex items-baseline justify-between text-body-s text-cream-dim">
              Причина решения
              <span className="text-caption">
                обязательна, не короче {MIN_REASON} символов — её увидит пользователь
              </span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-body-s text-cream-bright placeholder:text-cream-dim focus:border-cream-dim focus:outline-none"
              placeholder={blocked ? "Например: подтверждены документы, ограничение снято" : "Например: повторные жалобы на срыв сроков"}
            />
          </label>
          <div className="flex gap-3">
            <Button
              disabled={busy || reasonTooShort}
              onClick={async () => {
                const done = await act(user.id, action, reason);
                if (done) {
                  setReason("");
                  setOpen(false);
                }
              }}
            >
              {actionLabel}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <Button variant={blocked ? "primary" : "secondary"} onClick={() => setOpen(true)}>
            {actionLabel}
          </Button>
        </div>
      )}
    </li>
  );
}
