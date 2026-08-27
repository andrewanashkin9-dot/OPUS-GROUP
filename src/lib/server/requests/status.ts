import "server-only";

/**
 * Жизненный путь заявки.
 *
 *     новая ──принят отклик──▶ в работе ──клиент подтвердил──▶ завершена
 *       │                          │
 *       └────────отменена ◀────────┘
 *
 * В базе статусов пять: есть ещё `draft` — черновик, который видит только
 * автор. Через API он пока не выдаётся: заявка создаётся сразу «новой».
 * Место под него оставлено в схеме, чтобы позже не переделывать таблицу.
 */

export type RequestStatus = "draft" | "published" | "in_progress" | "completed" | "cancelled";

/** Подписи для интерфейса. В базе живут технические имена, см. 0001_init. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Черновик",
  published: "Новая",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
};

/**
 * Что из чего может получиться.
 *
 * Таблица переходов, а не набор проверок по месту. Разница в том, что здесь
 * видно правило целиком: «завершённую нельзя отменить» читается с одной
 * строки, тогда как рассыпанные по обработчикам `if` пришлось бы собирать
 * по всему проекту — и через полгода никто не поручится, что собрал все.
 */
const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  // Дальше пути нет. Завершённую заявку не отменяют: по ней уже прошли
  // деньги и она попала в отчёт. Отменённую не воскрешают — создают новую.
  completed: [],
  cancelled: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Сообщение, которое поймёт человек, а не только программист. */
export function transitionError(from: RequestStatus, to: RequestStatus): string {
  return (
    `Нельзя перевести заявку из состояния «${REQUEST_STATUS_LABELS[from]}» ` +
    `в «${REQUEST_STATUS_LABELS[to]}»`
  );
}
