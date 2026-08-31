import { styleDef } from "./styles";
import type { Facade, FloorCount, Footprint, HouseConfig, Opening } from "./types";
import { FLOOR_HEIGHT_M } from "./types";

/**
 * Places windows and the entrance from the floor count and the style, rather
 * than from a fixed list — a one-storey house and a three-storey one cannot
 * share an elevation, and the storeys have to line up vertically or the
 * facade reads as noise.
 */

// Живёт в types.ts вместе с остальной моделью; здесь только переэкспорт,
// чтобы не переписывать импорты по всему проекту.
export type { Footprint };

/** Evenly spaced offsets across a facade, centred on zero. */
function spread(count: number, span: number): number[] {
  if (count <= 0) return [];
  const usable = span * 0.72;
  if (count === 1) return [0];
  const step = usable / (count - 1);
  return Array.from({ length: count }, (_, i) => -usable / 2 + i * step);
}

/** How many windows each facade carries on a given storey. */
function windowsPerFacade(facade: Facade, floor: number): number {
  switch (facade) {
    case "front":
      // The ground floor gives its centre bay to the entrance.
      return floor === 0 ? 2 : 3;
    case "back":
      return 2;
    default:
      return 1;
  }
}

export function buildOpenings(
  footprint: Footprint,
  config: HouseConfig,
): Opening[] {
  const style = styleDef(config.style);
  const openings: Opening[] = [];
  const facades: Facade[] = ["front", "back", "left", "right"];

  for (let floor = 0; floor < config.floors; floor++) {
    const base = floor * FLOOR_HEIGHT_M;

    for (const facade of facades) {
      const span =
        facade === "front" || facade === "back"
          ? footprint.widthM
          : footprint.depthM;

      // A barnhouse glazes its gable walls almost fully. The ridge runs along
      // the width, so the gables are the left and right elevations.
      if (
        style.gableGlazing &&
        (facade === "left" || facade === "right") &&
        floor === 0
      ) {
        for (const offset of [-1.9, 0, 1.9]) {
          openings.push({
            id: `op-w-${facade}-gable-${offset}`,
            kind: "window",
            facade,
            offsetM: offset,
            sillM: 0.25,
            widthM: 1.7,
            heightM: 2.5,
          });
        }
        continue;
      }

      // High-tech puts a single full-height glazed bay on the ground floor
      // instead of a pair of punched windows.
      if (facade === "front" && floor === 0 && style.panoramicGround) {
        for (const offset of [-2.9, 2.9]) {
          openings.push({
            id: `op-w-front-0-${offset}`,
            kind: "window",
            facade,
            offsetM: offset,
            sillM: base + 0.35,
            widthM: 2.4,
            heightM: 2.3,
          });
        }
        continue;
      }

      const count = windowsPerFacade(facade, floor);
      spread(count, span).forEach((offset, i) => {
        openings.push({
          id: `op-w-${facade}-${floor}-${i}`,
          kind: "window",
          facade,
          offsetM: Number(offset.toFixed(2)),
          sillM: base + style.window.sillM,
          widthM: style.window.widthM,
          heightM: style.window.heightM,
        });
      });
    }
  }

  openings.push({
    id: "op-door",
    kind: "door",
    facade: "front",
    offsetM: 0,
    sillM: 0,
    widthM: 1.1,
    heightM: 2.1,
  });

  return openings;
}

export function wallHeightM(floors: FloorCount): number {
  return floors * FLOOR_HEIGHT_M;
}

export const FLOOR_LABELS: Record<FloorCount, string> = {
  1: "1 этаж",
  2: "2 этажа",
  3: "3 этажа",
};
