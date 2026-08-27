/**
 * Словарь заявок и откликов для интерфейса.
 *
 * Вынесен из RequestsPanel, когда те же подписи понадобились на странице
 * заявки и в истории откликов. Три копии «Завершена» в трёх файлах
 * расходятся не сразу, а через месяц, когда одну из них поправят.
 *
 * Здесь нет `server-only`: словарь одинаков и на сервере, и в браузере.
 */

export type RequestStatus =
  | "draft"
  | "published"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ResponseStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Черновик",
  published: "Новая",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
};

/**
 * Цвет статуса. Один и тот же смысл — один и тот же цвет во всём приложении:
 * «в работе» жёлтое, «завершено» зелёное, отменённое и черновик приглушены.
 */
export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  draft: "border-line text-cream-dim",
  published: "border-cream-dim text-cream-bright",
  in_progress: "border-warning/50 text-warning",
  completed: "border-success/50 text-success",
  cancelled: "border-line text-cream-dim",
};

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  pending: "На рассмотрении",
  accepted: "Принят",
  rejected: "Отклонён",
  withdrawn: "Отозван",
};

export const RESPONSE_STATUS_STYLES: Record<ResponseStatus, string> = {
  pending: "border-cream-dim text-cream-bright",
  accepted: "border-success/50 text-success",
  rejected: "border-line text-cream-dim",
  withdrawn: "border-line text-cream-dim",
};

export const WORK_KINDS = [
  { id: "roof", label: "Кровля" },
  { id: "facade", label: "Фасад" },
  { id: "fence", label: "Забор" },
  { id: "foundation", label: "Фундамент" },
  { id: "window", label: "Окна" },
  { id: "door", label: "Двери" },
] as const;

export function workKindLabel(id: string): string {
  return WORK_KINDS.find((w) => w.id === id)?.label ?? id;
}

/**
 * Дата события списком: «27 августа», а для прошлых лет — с годом.
 *
 * Год добавляется только когда он отличается от текущего: «27 августа 2026»
 * в списке заявок этого же года — лишние символы в каждой строке.
 */
export function formatDate(value: string | Date): string {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Дата и время — для сообщений в чате, где важна минута. */
export function formatDateTime(value: string | Date): string {
  const date = new Date(value);
  return `${formatDate(date)}, ${date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** «3 отклика» с правильным окончанием. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
