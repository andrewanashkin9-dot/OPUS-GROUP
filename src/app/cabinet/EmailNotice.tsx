"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * Напоминание подтвердить почту.
 *
 * Показывается, пока адрес не подтверждён. Без подтверждённого адреса
 * восстановить пароль невозможно: письмо уйдёт туда, куда человек доступа не
 * имеет, — поэтому напоминание здесь, а не «когда-нибудь потом».
 */
export function EmailNotice() {
  const call = useApiFetch();
  const [state, setState] = useState<"idle" | "pending" | "sent" | "logged" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("pending");
    const { ok, data } = await call<{ delivered?: boolean; error?: string }>(
      "/api/auth/verify-email",
      { method: "POST" },
    );
    if (!ok) {
      setError(data.error ?? "Не получилось");
      setState("error");
      return;
    }
    // delivered = false означает, что почтовый сервис не подключён и ссылка
    // напечатана в лог сервера. Говорим об этом прямо: «письмо отправлено»
    // было бы неправдой.
    setState(data.delivered ? "sent" : "logged");
  }

  return (
    <div className="mt-8 rounded-2xl border border-warning/40 p-4">
      <p className="text-body-s text-cream">
        Почта не подтверждена. Пока это так, восстановить пароль не получится.
      </p>
      {state === "sent" && <p className="mt-2 text-body-s text-success">Письмо отправлено.</p>}
      {state === "logged" && (
        <p className="mt-2 text-body-s text-warning">
          Почтовый сервис ещё не подключён — ссылка напечатана в логе сервера.
        </p>
      )}
      {state === "error" && <p className="mt-2 text-body-s text-error">{error}</p>}
      {state !== "sent" && state !== "logged" && (
        <Button variant="secondary" className="mt-3" onClick={send} disabled={state === "pending"}>
          {state === "pending" ? "Отправляем…" : "Отправить письмо"}
        </Button>
      )}
    </div>
  );
}
