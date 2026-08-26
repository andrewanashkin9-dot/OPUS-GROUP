"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

/**
 * Форма входа и регистрации.
 *
 * Клиентский компонент: нужны состояние полей и обработка ответа. Пароль
 * при этом никуда, кроме нашего же маршрута, не уходит, а токен обратно не
 * приходит — он ставится сервером в cookie с httpOnly, которую этот код
 * прочитать не может. Это и есть смысл httpOnly: даже своему JavaScript
 * токен не виден.
 */

type Mode = "login" | "register";
type Role = "client" | "executor";

const ROLE_LABELS: Record<Role, string> = {
  client: "Я заказчик — хочу построить",
  executor: "Я исполнитель — хочу работать",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Куда вернуть после входа. Принимаем только путь внутри сайта: полный
  // адрес позволил бы увести человека на чужую страницу сразу после входа.
  const rawNext = searchParams.get("next") ?? "/cabinet";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/cabinet";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login" ? { email, password } : { email, password, displayName, role };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: { error?: string; retryAfterSeconds?: number } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        // 429 — сработал предел частоты. Показываем, сколько ждать: без
        // этого человек видит «слишком много попыток» и не понимает,
        // сломалось навсегда или само пройдёт.
        if (response.status === 429 && data.retryAfterSeconds) {
          const minutes = Math.ceil(data.retryAfterSeconds / 60);
          setError(`Слишком много попыток. Попробуйте через ${minutes} мин.`);
        } else {
          setError(data.error ?? "Что-то пошло не так");
        }
        return;
      }

      // refresh() нужен, потому что /cabinet — серверная страница: без него
      // она может отрисоваться по старому состоянию, ещё без сессии.
      router.replace(next);
      router.refresh();
    } catch {
      setError("Сервер недоступен. Проверьте соединение.");
    } finally {
      setPending(false);
    }
  }

  const isRegister = mode === "register";

  return (
    <div className="w-full max-w-md">
      {/* Переключатель режима */}
      <div className="mb-8 flex gap-1 rounded-full border border-line p-1">
        {(["login", "register"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={`flex-1 rounded-full px-4 py-2 text-ui font-bold transition-colors ${
              mode === value ? "bg-cream text-bg" : "text-cream-dim hover:text-cream-bright"
            }`}
          >
            {value === "login" ? "Вход" : "Регистрация"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {isRegister && (
          <Field label="Как вас зовут">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Почта">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
          />
        </Field>

        <Field
          label="Пароль"
          hint={isRegister ? "Не короче 8 символов" : undefined}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
            // Подсказка браузеру: на входе предлагать сохранённый пароль,
            // при регистрации — предложить сгенерировать новый.
            autoComplete={isRegister ? "new-password" : "current-password"}
            className={inputClass}
          />
        </Field>

        {isRegister && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-body-s text-cream-dim">Кто вы</legend>
            {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-body-s transition-colors ${
                  role === value
                    ? "border-cream text-cream-bright"
                    : "border-line text-cream-dim hover:border-cream-dim"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                  className="accent-cream"
                />
                {ROLE_LABELS[value]}
              </label>
            ))}
          </fieldset>
        )}

        {error && (
          // role="alert" — чтобы программа чтения с экрана произнесла ошибку
          // сразу, а не когда до неё дойдут по порядку.
          <p role="alert" className="rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Подождите…" : isRegister ? "Зарегистрироваться" : "Войти"}
        </Button>

        {!isRegister && (
          <p className="text-center text-body-s">
            <Link href="/reset-password" className="text-cream-dim underline underline-offset-2 hover:text-cream-bright">
              Забыли пароль?
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-body text-cream-bright " +
  "placeholder:text-cream-dim focus:border-cream-dim focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between text-body-s text-cream-dim">
        {label}
        {hint && <span className="text-caption">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
