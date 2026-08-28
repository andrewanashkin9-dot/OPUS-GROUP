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

/**
 * TODO: удалить перед запуском — ответы менеджера без базы.
 *
 * Заготовленные, а не выдуманные на ходу: их видит человек, который просто
 * зашёл посмотреть, и они должны звучать как обычная деловая переписка.
 * Отвечает по кругу — переспросив, собеседник получит следующий, а не тот же.
 */
const OFFLINE_REPLIES = [
  "Здравствуйте! Эта позиция есть на складе, отгрузка со следующего дня после оплаты.",
  "По объёму от 300 м² даём цену ниже прайса — посчитаю, если скажете площадь кровли.",
  "Доставка по городу своя, за область считаем по километражу от склада.",
  "Остаток по этой партии — 640 м². Придёт ещё, но уже другой партией, оттенок может отличаться на полтона.",
  "Могу отложить объём на три дня без предоплаты, дальше уходит в общий остаток.",
];

interface ChatLine {
  id: number;
  mine: boolean;
  text: string;
}

export function DemoManagerChat({ productId }: { productId: string }) {
  const signedIn = useRoleCookie() !== null;
  const call = useApiFetch();
  const router = useRouter();

  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TODO: удалить перед запуском — переписка без базы, прямо в браузере.
  const [offline, setOffline] = useState(false);
  const [talkingTo, setTalkingTo] = useState<Manager | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void apiJson<{ managers?: Manager[]; offline?: boolean }>("/api/demo/managers").then((r) => {
      if (cancelled) return;
      setManagers(r.data.managers ?? []);
      setOffline(Boolean(r.data.offline));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Ни менеджеров, ни флага — блока нет вовсе. Пустая рамка «здесь могло
  // быть общение» сдвигает страницу и ничего не сообщает.
  if (!managers || managers.length === 0) return null;

  // TODO: удалить перед запуском — открыть переписку без базы.
  function writeOffline(manager: Manager) {
    setTalkingTo(manager);
    setLines([
      {
        id: 0,
        mine: false,
        text: `Здравствуйте! ${manager.name} на связи. Спрашивайте про наличие, сроки и объём.`,
      },
    ]);
    setDraft("");
  }

  function sendOffline() {
    const text = draft.trim();
    if (!text) return;
    setLines((prev) => [
      ...prev,
      { id: prev.length, mine: true, text },
      {
        id: prev.length + 1,
        mine: false,
        // По кругу: счётчик берётся из числа уже сказанного менеджером.
        text: OFFLINE_REPLIES[prev.filter((l) => !l.mine).length % OFFLINE_REPLIES.length],
      },
    ]);
    setDraft("");
  }

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
        демонстрационные —{" "}
        {offline
          ? "и ответы заготовлены заранее: база не подключена."
          : "переписка настоящая."}
      </p>

      {signedIn || offline ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {managers.map((manager) => (
            <button
              key={manager.id}
              type="button"
              disabled={pending !== null}
              onClick={() => (offline ? writeOffline(manager) : write(manager))}
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

      {/* TODO: удалить перед запуском — сама переписка без базы. */}
      {talkingTo && (
        <div className="mt-4 rounded-xl border border-[var(--plate-edge)] p-3">
          <p className="text-body-s font-bold text-cream-bright">
            {talkingTo.name}
            {talkingTo.city ? <span className="text-cream-dim"> · {talkingTo.city}</span> : null}
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {lines.map((line) => (
              <p
                key={line.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-body-s ${
                  line.mine
                    ? "self-end bg-[var(--plate)] text-cream"
                    : "self-start border border-[var(--plate-edge)] text-cream-dim"
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendOffline();
                }
              }}
              placeholder="Сообщение — Enter отправит"
              aria-label="Сообщение менеджеру"
              className="min-w-0 flex-1 rounded-full border border-[var(--plate-edge)] bg-transparent px-4 py-2 text-body-s text-cream placeholder:text-cream-dim"
            />
            <button
              type="button"
              onClick={sendOffline}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-body-s font-bold text-deep"
            >
              Отправить
            </button>
          </div>

          <p className="mt-2 text-caption text-cream-dim">
            Демо-переписка: собеседник выдуман, ответы заготовлены, история
            живёт до перезагрузки страницы.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-body-s text-error">
          {error}
        </p>
      )}
    </div>
  );
}
