"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/auth/api-fetch";
import { useApiFetch } from "@/lib/auth/useApiFetch";
import { useRoleCookie } from "@/lib/auth/useRoleCookie";

/**
 * TODO: удалить перед запуском — временная демо-вставка
 * (см. TODO_BEFORE_LAUNCH.md).
 *
 * «Написать менеджеру» на странице товара.
 *
 * Открывает переписку с выдуманным менеджером поставщика, не заводя
 * настоящей заявки на работы. Под капотом заявка всё-таки создаётся — но
 * это делает сервер, и благодаря этому правило «переписка только внутри
 * заявки» осталось нетронутым: ни триггер в базе, ни проверки в маршруте
 * не ослаблены. Подробности в src/app/api/demo/manager-chat/route.ts.
 *
 * TODO: удалить перед запуском. Блок включён всегда; если демо-менеджеров
 * в базе нет, список приходит пустым и блок сам себя не рисует.
 */

interface Manager {
  id: string;
  name: string;
  city: string | null;
}

export function DemoManagerChat({ productId }: { productId: string }) {
  const signedIn = useRoleCookie() !== null;
  const call = useApiFetch();
  const router = useRouter();

  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiJson<{ managers?: Manager[] }>("/api/demo/managers").then((r) => {
      if (!cancelled) setManagers(r.data.managers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ни менеджеров, ни флага — блока нет вовсе. Пустая рамка «здесь могло
  // быть общение» сдвигает страницу и ничего не сообщает.
  if (!managers || managers.length === 0) return null;

  async function write(manager: Manager) {
    setPending(manager.id);
    setError(null);
    const { ok, data } = await call<{ requestId?: string; error?: string }>(
      "/api/demo/manager-chat",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ managerId: manager.id, productId }),
      },
    );
    if (!ok || !data.requestId) {
      setError(data.error ?? "Не удалось открыть переписку");
      setPending(null);
      return;
    }
    router.push(`/requests/${data.requestId}#chat`);
  }

  return (
    <div
      className="mt-6 rounded-2xl border border-dashed p-4"
      style={{ borderColor: "rgba(255,215,0,0.45)" }}
    >
      <p className="text-caption font-bold uppercase text-accent">
        Временно · чат с менеджером
      </p>
      <p className="mt-2 text-body-s text-cream-dim">
        Спросить про наличие, сроки поставки и объём. Менеджеры
        демонстрационные — переписка настоящая.
      </p>

      {signedIn ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {managers.map((manager) => (
            <button
              key={manager.id}
              type="button"
              disabled={pending !== null}
              onClick={() => write(manager)}
              className="rounded-full border border-[var(--plate-edge)] px-4 py-2 text-body-s text-cream transition-colors hover:border-cream-dim disabled:opacity-60"
            >
              {pending === manager.id ? "Открываем…" : `Написать: ${manager.name}`}
            </button>
          ))}
        </div>
      ) : (
        // Гостю кнопка, которая гарантированно ответит 401, — не
        // приглашение, а ловушка. Вместо неё вход с возвратом сюда же.
        <Link
          href={`/login?next=/market/${productId}`}
          className="mt-3 inline-flex items-center rounded-full border border-[var(--plate-edge)] px-4 py-2 text-body-s text-cream transition-colors hover:border-cream-dim"
        >
          Войти, чтобы написать
        </Link>
      )}

      {error && (
        <p role="alert" className="mt-3 text-body-s text-error">
          {error}
        </p>
      )}
    </div>
  );
}
