const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatRub(value: number): string {
  return rub.format(value);
}

const unitLabels: Record<string, string> = {
  m2: "м²",
  m: "м",
  pcs: "шт.",
};

export function formatUnit(unit: string): string {
  return unitLabels[unit] ?? unit;
}
