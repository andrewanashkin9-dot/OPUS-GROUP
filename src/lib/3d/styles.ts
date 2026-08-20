import type { HouseStyle, NodeKind, RoofShape } from "./types";
import { MIN_ROOF_OVERHANG_M } from "./types";

/**
 * A style is not a skin. It sets the roof form and pitch, the materials and
 * colours each surface starts with, how tall and wide the windows are, and
 * which construction details the house carries — the things that actually
 * make a European house read differently from a high-tech one.
 */
export interface StyleDef {
  id: HouseStyle;
  name: string;
  tagline: string;
  roof: { shape: RoofShape; pitchDeg: number; overhangM: number };
  materials: Partial<Record<NodeKind, string>>;
  colors: Partial<Record<NodeKind, string>>;
  window: {
    widthM: number;
    heightM: number;
    /** Sill height above the floor of the storey the window sits on. */
    sillM: number;
  };
  /** Ground-floor front glazing runs full height instead of a window pair. */
  panoramicGround: boolean;
  details: {
    shutters: boolean;
    quoins: boolean;
    stringCourse: boolean;
    chimney: boolean;
    porchCanopy: boolean;
  };
  plinthColor: string;
  trimColor: string;
}

export const STYLES: Record<HouseStyle, StyleDef> = {
  european: {
    id: "european",
    name: "Европейский",
    tagline: "Кирпич, вальмовая кровля, ставни и симметричные окна.",
    roof: { shape: "hip", pitchDeg: 35, overhangM: MIN_ROOF_OVERHANG_M },
    materials: {
      roof: "roof-metal-tile",
      facade: "facade-brick-facing",
      window: "window-pvc",
      door: "door-oak",
      fence: "fence-shtaketnik",
      foundation: "foundation-strip",
    },
    colors: {
      roof: "#5C4A3A",
      facade: "#D9C6A5",
      window: "#F2EFE8",
      door: "#4A3626",
      fence: "#3E2A1F",
      foundation: "#6B6660",
    },
    window: { widthM: 1.2, heightM: 1.5, sillM: 0.9 },
    panoramicGround: false,
    details: {
      shutters: true,
      quoins: false,
      stringCourse: true,
      chimney: true,
      porchCanopy: true,
    },
    plinthColor: "#5A554F",
    trimColor: "#F2EFE8",
  },

  scandi: {
    id: "scandi",
    name: "Скандинавский",
    tagline: "Крутая двускатная кровля, деревянный фасад, высокие окна.",
    roof: { shape: "gable", pitchDeg: 42, overhangM: MIN_ROOF_OVERHANG_M },
    materials: {
      roof: "roof-shingle",
      facade: "facade-planken",
      window: "window-alu",
      door: "door-oak",
      fence: "fence-shtaketnik",
      foundation: "foundation-slab",
    },
    colors: {
      roof: "#3A3A3D",
      facade: "#4A3626",
      window: "#33363A",
      door: "#6B4A32",
      fence: "#41454A",
      foundation: "#4A4642",
    },
    window: { widthM: 1.1, heightM: 1.9, sillM: 0.7 },
    panoramicGround: false,
    details: {
      shutters: false,
      quoins: false,
      stringCourse: false,
      chimney: true,
      porchCanopy: true,
    },
    plinthColor: "#3A3733",
    trimColor: "#2B2B2B",
  },

  hightech: {
    id: "hightech",
    name: "Хай-тек",
    tagline: "Плоская кровля, панорамное остекление, композитные панели.",
    roof: { shape: "flat", pitchDeg: 5, overhangM: MIN_ROOF_OVERHANG_M },
    materials: {
      roof: "roof-seam",
      facade: "facade-hpl",
      window: "window-alu",
      door: "door-steel",
      fence: "fence-profnastil",
      foundation: "foundation-slab",
    },
    // Graphite rather than true black: the canvas background is #000, and a
    // near-black facade on it reads as a silhouette rather than a building.
    colors: {
      roof: "#55595E",
      facade: "#464A4F",
      window: "#2E3236",
      door: "#3A3E42",
      fence: "#4B4F54",
      foundation: "#55514C",
    },
    window: { widthM: 1.6, heightM: 2.1, sillM: 0.5 },
    panoramicGround: true,
    details: {
      shutters: false,
      quoins: false,
      stringCourse: false,
      chimney: false,
      porchCanopy: false,
    },
    plinthColor: "#35383B",
    trimColor: "#7A7F86",
  },

  classic: {
    id: "classic",
    name: "Классический",
    tagline: "Штукатурка, рустованные углы, карнизы между этажами.",
    roof: { shape: "gable", pitchDeg: 30, overhangM: MIN_ROOF_OVERHANG_M },
    materials: {
      roof: "roof-ceramic-wave",
      facade: "facade-plaster",
      window: "window-pvc",
      door: "door-oak",
      fence: "fence-forged",
      foundation: "foundation-strip",
    },
    colors: {
      roof: "#8A4A32",
      facade: "#EDE6D6",
      window: "#F2EFE8",
      door: "#4A3626",
      fence: "#1C1C1C",
      foundation: "#7A756E",
    },
    window: { widthM: 1.15, heightM: 1.6, sillM: 0.95 },
    panoramicGround: false,
    details: {
      shutters: false,
      quoins: true,
      stringCourse: true,
      chimney: true,
      porchCanopy: true,
    },
    plinthColor: "#8C7B65",
    trimColor: "#FFFFFF",
  },
};

export const STYLE_LIST: StyleDef[] = [
  STYLES.european,
  STYLES.scandi,
  STYLES.hightech,
  STYLES.classic,
];

export function styleDef(style: HouseStyle): StyleDef {
  return STYLES[style] ?? STYLES.european;
}
