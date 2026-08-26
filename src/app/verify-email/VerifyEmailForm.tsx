"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

/**
 * Подтверждение адреса по ссылке из письма.
 *
 * Подтверждение происходит по нажатию, а не само при открытии страницы.
 * Причина не в удобстве: почтовые сервисы и антивирусы открывают ссылки из
 * писем сами, чтобы проверить их на вредоносность. Ссылка, срабатывающая от
 * одного открытия, погасилась бы до того, как человек её увидел.
 */
export function VerifyEmailForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("pending");
    const response = await fetch("/api/auth/verify-email", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data: { error?: string } = await response.json().catch(() => ({}));
    if (response.ok) {
      setState("done");
    } else {
      setError(data.error ?? "Не получилось");
      setState("error");
    }
  }

  if (!token) {
    return <Message title="Ссылка неполная" text="Откройте ссылку из письма целиком." />;
  }
  if (state === "done") {
    return (
      <Message title="Адрес подтверждён" text="Спасибо. Теперь можно вернуться в кабинет.">
        <Link href="/cabinet" className="text-cream underline underline-offset-2">
          В кабинет
        </Link>
      </Message>
    );
  }

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="font-display text-h2 font-extrabold text-cream-bright">
        Подтверждение адреса
      </h1>
      <p className="mt-3 text-body-s text-cream-dim">
        Нажмите кнопку, чтобы подтвердить, что этот адрес принадлежит вам.
      </p>
      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}
      <Button className="mt-8 w-full" onClick={confirm} disabled={state === "pending"}>
        {state === "pending" ? "Подтверждаем…" : "Подтвердить адрес"}
      </Button>
    </div>
  );
}

function Message({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md text-center">
      <h1 className="font-display text-h2 font-extrabold text-cream-bright">{title}</h1>
      <p className="mt-3 text-body-s text-cream-dim">{text}</p>
      {children && <p className="mt-6 text-body-s">{children}</p>}
    </div>
  );
}
