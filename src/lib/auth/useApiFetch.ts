"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { apiJson, type ApiResult } from "./api-fetch";

/**
 * apiJson плюс одно правило: если сессия кончилась насовсем — уводим на
 * форму входа и запоминаем, куда человек шёл.
 *
 * Навигация живёт здесь, а не в сетевом модуле, потому что здесь есть
 * маршрутизатор Next. Прямой `window.location` перезагрузил бы приложение
 * целиком вместо перехода внутри него.
 */
export function useApiFetch() {
  const router = useRouter();

  return useCallback(
    async <T>(input: string, init?: RequestInit): Promise<ApiResult<T>> => {
      const result = await apiJson<T>(input, init);

      if (result.authExpired) {
        const next = window.location.pathname + window.location.search;
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }

      return result;
    },
    [router],
  );
}
