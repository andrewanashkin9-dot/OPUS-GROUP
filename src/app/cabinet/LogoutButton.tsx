"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

/**
 * Выход.
 *
 * Обязательно POST, а не ссылка: по ссылке (GET) чужая страница смогла бы
 * выкинуть человека из аккаунта, просто подсунув картинку с этим адресом.
 * Действия, которые что-то меняют, никогда не делаются по GET.
 */
export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      // Без refresh() серверная страница может остаться в кеше маршрутизатора
      // и мелькнуть уже после выхода.
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" onClick={handleLogout} disabled={pending}>
      {pending ? "Выходим…" : "Выйти"}
    </Button>
  );
}
