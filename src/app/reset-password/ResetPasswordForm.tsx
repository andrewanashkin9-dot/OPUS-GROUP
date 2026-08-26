"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

/**
 * Две страницы в одной: без токена — «пришлите мне ссылку», с токеном —
 * «задайте новый пароль». Так человек, потерявший письмо, не ищет вторую
 * форму и не переходит по старой ссылке.
 */
export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  return token ? <SetNewPassword token={token} /> : <RequestLink />;
}

function RequestLink() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Ответ всегда одинаковый — сервер намеренно не сообщает, есть такой
    // адрес или нет. Поэтому и здесь показываем одно и то же.
    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-h2 font-extrabold text-cream-bright">Проверьте почту</h1>
        <p className="mt-3 text-body-s text-cream-dim">
          Если такой адрес у нас есть, письмо со ссылкой уже отправлено.
          Ссылка действует час.
        </p>
        <p className="mt-6 text-body-s">
          <Link href="/login" className="text-cream underline underline-offset-2">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <h1 className="font-display text-h2 font-extrabold text-cream-bright">Забыли пароль</h1>
      <p className="mt-3 text-body-s text-cream-dim">
        Пришлём ссылку для смены пароля на вашу почту.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        placeholder="Почта"
        className={inputClass + " mt-8"}
      />
      <Button type="submit" className="mt-4 w-full" disabled={pending}>
        {pending ? "Отправляем…" : "Прислать ссылку"}
      </Button>
    </form>
  );
}

function SetNewPassword({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/password-reset", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data: { error?: string } = await response.json().catch(() => ({}));
    if (response.ok) {
      setDone(true);
      // Входить автоматически не будем: смена пароля закрывает все сессии,
      // и правильнее показать это явно, а не делать вид, что ничего не было.
      setTimeout(() => router.replace("/login"), 2500);
    } else {
      setError(data.error ?? "Не получилось");
    }
    setPending(false);
  }

  if (done) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="font-display text-h2 font-extrabold text-cream-bright">Пароль изменён</h1>
        <p className="mt-3 text-body-s text-cream-dim">
          Все прежние входы закрыты — на других устройствах придётся войти заново.
          Сейчас перенесём вас на форму входа.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <h1 className="font-display text-h2 font-extrabold text-cream-bright">Новый пароль</h1>
      <label className="mt-8 block">
        <span className="mb-2 flex items-baseline justify-between text-body-s text-cream-dim">
          Пароль
          <span className="text-caption">не короче 8 символов</span>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-6 w-full" disabled={pending}>
        {pending ? "Сохраняем…" : "Задать пароль"}
      </Button>
    </form>
  );
}

const inputClass =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-body text-cream-bright " +
  "placeholder:text-cream-dim focus:border-cream-dim focus:outline-none";
