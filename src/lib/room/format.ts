/**
 * Числа так, как их пишут в замере: запятая вместо точки, неразрывный
 * пробел между разрядами и единицей — чтобы «14,7 м²» не разрывалось по
 * строкам посреди величины.
 */

const NBSP = " ";

export function metres(value: number, digits = 2): string {
  return trim(value.toFixed(digits));
}

export function squareMetres(value: number, digits = 1): string {
  return `${trim(value.toFixed(digits))}${NBSP}м²`;
}

export function roubles(value: number): string {
  return `${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${NBSP}₽`;
}

export function percent(value: number): string {
  return `${trim(String(value))}${NBSP}%`;
}

/** "4,20" → "4,2"; "3,00" → "3". */
function trim(text: string): string {
  return text
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")
    .replace(".", ",");
}
