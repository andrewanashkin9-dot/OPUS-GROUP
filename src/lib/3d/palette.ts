import type { NodeKind } from "./types";

export interface ColorOption {
  hex: string;
  name: string;
}

/**
 * Real house colours, not brand colours. The cream-on-black identity governs
 * the interface around the canvas; a terracotta roof has to look terracotta
 * or the model stops being useful for choosing one.
 *
 * Colour is a free-tier control ("change colors, pick a roof format"), so
 * nothing here is gated.
 */
export const COLOR_OPTIONS: Record<NodeKind, ColorOption[]> = {
  roof: [
    { hex: "#8A4A32", name: "Терракота" },
    { hex: "#3A3A3D", name: "Графит" },
    { hex: "#5C4A3A", name: "Шоколад" },
    { hex: "#3E5140", name: "Зелёный мох" },
    { hex: "#6B2A2A", name: "Вишня" },
    { hex: "#2F3F4F", name: "Синий сланец" },
    { hex: "#2A2C2E", name: "Чёрный металл" },
    { hex: "#9CA3AA", name: "Цинк" },
    { hex: "#1C1C1E", name: "Чёрный" },
  ],
  facade: [
    { hex: "#EDE6D6", name: "Тёплый белый" },
    { hex: "#D9C6A5", name: "Песочный" },
    { hex: "#C8B9A6", name: "Слоновая кость" },
    { hex: "#A8A39C", name: "Серый камень" },
    { hex: "#8C6A52", name: "Терракотовый кирпич" },
    { hex: "#5A5F63", name: "Тёмно-серый" },
    { hex: "#4A3626", name: "Тёмный дуб" },
    { hex: "#B5813F", name: "Медовая сосна" },
    { hex: "#2A2C2E", name: "Чёрный металл" },
    { hex: "#2B2B2B", name: "Антрацит" },
  ],
  fence: [
    { hex: "#3E2A1F", name: "Шоколад" },
    { hex: "#41454A", name: "Графит" },
    { hex: "#3E5140", name: "Зелёный мох" },
    { hex: "#6B2A2A", name: "Вишня" },
    { hex: "#1C1C1C", name: "Чёрный" },
    { hex: "#B8A88C", name: "Песочный" },
  ],
  foundation: [
    { hex: "#6B6660", name: "Бетон серый" },
    { hex: "#7A756E", name: "Светлый бетон" },
    { hex: "#4A4642", name: "Тёмный бетон" },
    { hex: "#8C7B65", name: "Под камень" },
  ],
  window: [
    { hex: "#F2EFE8", name: "Белый" },
    { hex: "#33363A", name: "Антрацит" },
    { hex: "#6B4A32", name: "Золотой дуб" },
    { hex: "#5A5F63", name: "Серый" },
  ],
  door: [
    { hex: "#4A3626", name: "Тёмный дуб" },
    { hex: "#6B4A32", name: "Орех" },
    { hex: "#2B2B2B", name: "Антрацит" },
    { hex: "#F2EFE8", name: "Белый" },
    { hex: "#3E5140", name: "Зелёный мох" },
  ],
};

export function colorsForKind(kind: NodeKind): ColorOption[] {
  return COLOR_OPTIONS[kind] ?? [];
}

export function colorName(kind: NodeKind, hex: string): string | undefined {
  return colorsForKind(kind).find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase(),
  )?.name;
}
