"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiFetch } from "@/lib/auth/useApiFetch";
import { formatDateTime } from "@/lib/requests-ui";

/**
 * Переписка заказчика и исполнителя внутри заявки.
 *
 * Что здесь сознательно не сделано: живого соединения нет. Сообщения
 * подтягиваются опросом раз в десять секунд, пока вкладка открыта и видима.
 * WebSocket для чата на две реплики в час — это отдельный сервер, который
 * надо держать живым, и он тут не окупается; когда переписка станет
 * оживлённее, меняется одна эта функция, а не весь компонент.
 *
 * Право писать приходит с сервера (`canWrite`), а не выводится в браузере из
 * статуса заявки. Интерфейс не решает, кому можно, — он показывает решение
 * сервера. Отправка всё равно проверяется заново и на маршруте, и триггером
 * в базе.
 */

const POLL_MS = 10_000;

interface Message {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** Когда собеседник прочитал. null — ещё нет. */
  readAt: string | null;
}

export function Chat({
  requestId,
  currentUserId,
  initialMessages,
  initialCanWrite,
  initialReason,
}: {
  requestId: string;
  currentUserId: string;
  initialMessages: Message[];
  initialCanWrite: boolean;
  initialReason: string | null;
}) {
  const call = useApiFetch();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [canWrite, setCanWrite] = useState(initialCanWrite);
  const [reason, setReason] = useState(initialReason);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  // Первая загрузка — она же отметка «прочитано» — делается один раз, когда
  // чат доезжает до экрана. Гасить непрочитанное самой отрисовкой страницы
  // нечестно: заявка длинная, и переписка может остаться далеко внизу,
  // непрочитанной в буквальном смысле.
  const seen = useRef(false);
  // Прокручиваем вниз только когда человек и так внизу: иначе новое
  // сообщение выдёргивает его из середины разговора, который он читает.
  const stickToBottom = useRef(true);

  const load = useCallback(async () => {
    const { ok, data } = await call<{
      messages?: Message[];
      canWrite?: boolean;
      reason?: string | null;
    }>(`/api/requests/${requestId}/messages`);
    if (!ok || !data.messages) return;
    setMessages(data.messages);
    setCanWrite(Boolean(data.canWrite));
    setReason(data.reason ?? null);
  }, [call, requestId]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Во вкладке, на которую никто не смотрит, опрашивать сервер незачем —
      // а на телефоне это ещё и батарея.
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || seen.current) return;
      seen.current = true;
      // load() заодно помечает сообщения собеседника прочитанными — это
      // делает тот же GET на сервере.
      void load();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [load]);

  useEffect(() => {
    if (stickToBottom.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    const { ok, data } = await call<{ message?: Message; error?: string }>(
      `/api/requests/${requestId}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );

    if (!ok || !data.message) {
      setError(data.error ?? "Не удалось отправить");
      setSending(false);
      return;
    }

    // Дописываем ответ сервера, а не свою копию черновика: у серверной
    // строки настоящие id и время, и следующая загрузка не покажет
    // сообщение дважды.
    stickToBottom.current = true;
    setMessages((prev) => [...prev, data.message!]);
    setDraft("");
    setSending(false);
  }

  return (
    // Якорь для вкладки «Чат» на этой же странице. scroll-mt отводит
    // заголовок из-под липкой шапки.
    <section id="chat" className="mt-12 scroll-mt-20">
      <h2 className="font-display text-h3 font-extrabold text-cream-bright">Переписка</h2>
      <p className="mt-1 text-caption text-cream-dim">
        Видят только вы и вторая сторона по этой заявке.
      </p>

      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto rounded-2xl border border-line p-4"
      >
        {messages.length === 0 ? (
          <p className="text-body-s text-cream-dim">
            Сообщений пока нет. Напишите первым — здесь удобно уточнять сроки и
            детали, не выходя из заявки.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === currentUserId;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl border px-4 py-2.5 ${
                    mine
                      ? "border-[var(--accent-line)] bg-[var(--blue-lift)]"
                      : "border-line"
                  }`}
                >
                  {/* Имя показывается только у собеседника: подписывать
                      каждую свою реплику своим же именем — шум. */}
                  {!mine && (
                    <p className="text-caption font-medium text-cream">{m.authorName}</p>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap text-body-s text-cream-bright">
                    {m.body}
                  </p>
                  <p className="mt-1 text-caption text-cream-dim">
                    {formatDateTime(m.createdAt)}
                    {/* «Прочитано» показывается только на своих сообщениях:
                        знать, прочитал ли ты сам то, что видишь, незачем. */}
                    {mine && m.readAt && (
                      <span className="ml-2 text-success" title="Прочитано">
                        ✓✓
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canWrite ? (
        <form onSubmit={send} className="mt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter отправляет, Shift+Enter переносит строку — как везде,
              // где люди переписываются. Без этого каждое сообщение стоит
              // похода мышью до кнопки.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            rows={3}
            maxLength={4000}
            placeholder="Сообщение — Enter отправит, Shift+Enter перенесёт строку"
            className="w-full rounded-2xl border border-line bg-transparent p-3 text-body-s text-cream outline-none focus:border-cream-dim"
          />
          {error && (
            <p role="alert" className="mt-2 text-body-s text-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="mt-2 rounded-full bg-accent px-5 py-2.5 text-ui font-bold text-deep transition-[filter] hover:brightness-108 disabled:opacity-50"
          >
            {sending ? "Отправляем…" : "Отправить"}
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl border border-line p-4 text-body-s text-cream-dim">
          {reason ?? "Переписка недоступна"}
        </p>
      )}
    </section>
  );
}
