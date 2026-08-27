"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удаляется одним коммитом (см. README).
 *
 * Переключатель роли в кабинете: чтобы увидеть раздел «Модерация», не заходя
 * в базу. Показывается только при DEMO_MODE=true — решение принимает
 * серверная страница, которая его отрисовывает.
 *
 * Плашка нарочно уродливая, с рамкой и словом «демо»: временное должно
 * выглядеть временным, иначе через месяц никто не вспомнит, что это надо
 * убрать.
 */
const ROLES = [
  { id: "client", label: "Заказчик" },
  { id: "executor", label: "Исполнитель" },
  { id: "moderator", label: "Модератор" },
];

export function DemoRoleSwitch({ currentRole }: { currentRole: string }) {
  const call = useApiFetch();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(role: string) {
    setPending(role);
    setError(null);
    const { ok, data } = await call<{ error?: string }>("/api/demo/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!ok) {
      setError(data.error ?? "Не получилось");
      setPending(null);
      return;
    }
    // refresh, а не reload: страница серверная, и Next перерисует её с новой
    // ролью, не перезагружая приложение целиком.
    router.refresh();
    setPending(null);
  }

  return (
    <section
      className="mt-10 rounded-2xl border border-dashed p-4"
      style={{ borderColor: "rgba(255,215,0,0.5)" }}
    >
      <p className="text-caption font-bold uppercase text-accent">
        Демо · временная вставка
      </p>
      <p className="mt-2 text-body-s text-cream-dim">
        Переключить свою роль, чтобы посмотреть разделы, — без правки базы.
        В боевом окружении этой плашки не будет.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const active = role.id === currentRole;
          return (
            <button
              key={role.id}
              type="button"
              disabled={active || pending !== null}
              onClick={() => switchTo(role.id)}
              className={`rounded-full border px-4 py-2 text-body-s font-medium transition-colors disabled:opacity-60 ${
                active
                  ? "border-accent text-accent"
                  : "border-[var(--plate-edge)] text-cream hover:border-cream-dim"
              }`}
            >
              {pending === role.id ? "Меняем…" : role.label}
              {active && " · сейчас"}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-body-s text-error">
          {error}
        </p>
      )}
    </section>
  );
}
