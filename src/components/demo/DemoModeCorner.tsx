"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiFetch } from "@/lib/auth/useApiFetch";
import { useRoleCookie } from "@/lib/auth/useRoleCookie";
import { canModerate } from "@/lib/auth/cookie-names";

/**
 * ⚠️⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — удалить перед запуском (см. TODO_BEFORE_LAUNCH.md).
 *
 * Переключатель «Посетитель / Модератор» в углу экрана.
 *
 * Есть уже такой же в кабинете (DemoRoleSwitch), но туда надо дойти. Этот
 * висит поверх любой страницы: смысл проверки в том, чтобы увидеть одну и ту
 * же страницу двумя глазами подряд, а не в том, чтобы каждый раз возвращаться
 * в кабинет.
 *
 * Показывается только вошедшим и только при DEMO_MODE=true — решение
 * принимает серверная разметка, которая его отрисовывает. Маршрут смены роли
 * без флага отвечает 404, так что подделанная cookie тут ничего не даёт.
 *
 * Вид нарочно временный: пунктирная рамка и слово «демо». Временное должно
 * выглядеть временным, иначе через месяц никто не вспомнит, что это убрать.
 */

/** Роль, в которую возвращаемся из модератора. */
const VISITOR_ROLE = "client";

export function DemoModeCorner() {
  const role = useRoleCookie();
  const call = useApiFetch();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  // Гостю переключать нечего: роль есть только у вошедшего.
  if (role === null || hidden) return null;

  const asModerator = canModerate(role);

  async function switchTo(next: string) {
    setPending(true);
    setError(null);
    const { ok, data } = await call<{ error?: string }>("/api/demo/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: next }),
    });
    if (!ok) {
      setError(data.error ?? "Не получилось");
      setPending(false);
      return;
    }
    // refresh, а не reload: страницы серверные, Next перерисует их с новой
    // ролью, не перезагружая приложение целиком.
    router.refresh();
    setPending(false);
  }

  return (
    <div
      // Слева снизу: справа снизу живёт приветственная карточка, и два
      // всплывающих блока в одном углу перекрывали бы друг друга.
      className="fixed bottom-4 left-4 z-[55] rounded-2xl border border-dashed p-3 backdrop-blur"
      style={{ borderColor: "rgba(255,215,0,0.5)", backgroundColor: "var(--bar)" }}
      role="group"
      aria-label="Демо: режим просмотра"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption font-bold uppercase text-accent">Демо · режим</span>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Скрыть переключатель до перезагрузки"
          className="text-caption text-dim transition-colors hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex gap-1.5">
        <Chip
          active={!asModerator}
          disabled={pending}
          onClick={() => switchTo(VISITOR_ROLE)}
        >
          Посетитель
        </Chip>
        <Chip
          active={asModerator}
          disabled={pending}
          onClick={() => switchTo("moderator")}
        >
          Модератор
        </Chip>
      </div>

      {error && (
        <p role="alert" className="mt-2 max-w-48 text-caption text-error">
          {error}
        </p>
      )}
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Текущий режим не кнопка: нажимать на «вы и так здесь» бессмысленно,
      // а выключенная кнопка ещё и показывает, где ты сейчас.
      disabled={active || disabled}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-body-s font-medium transition-colors disabled:cursor-default ${
        active
          ? "border-accent text-accent"
          : "border-[var(--plate-edge)] text-cream hover:border-cream-dim disabled:opacity-50"
      }`}
    >
      {children}
    </button>
  );
}
