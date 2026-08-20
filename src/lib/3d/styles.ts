import type { FloorCount, HouseStyle, NodeKind, RoofShape } from "./types";
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
  /** The storey count this style is normally built in. */
  defaultFloors: FloorCount;
  /** Ground-floor front glazing runs full height instead of a window pair. */
  panoramicGround: boolean;
  /**
   * Full-height glazing in the gable walls. The ridge runs along the width,
   * so the gables are the left and right elevations.
   */
  gableGlazing: boolean;
  details: {
    shutters: boolean;
    quoins: boolean;
    stringCourse: boolean;
    /** Masonry stack, slim metal flue, or nothing at all. */
    chimney: "masonry" | "flue" | "none";
    porchCanopy: boolean;
    /** A wide timber terrace instead of a compact entrance porch. */
    deck: boolean;
  };
  /**
   * Per-node overrides, keyed by scene node id. Lets a style clad one
   * elevation differently from the rest — the wood gable of a barnhouse
   * against its black metal flanks.
   */
  accents?: Record<string, { materialId?: string; colorHex?: string }>;
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
    defaultFloors: 2,
    panoramicGround: false,
    gableGlazing: false,
    details: {
      shutters: true,
      quoins: false,
      stringCourse: true,
      chimney: "masonry",
      porchCanopy: true,
      deck: false,
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
    defaultFloors: 2,
    panoramicGround: false,
    gableGlazing: false,
    details: {
      shutters: false,
      quoins: false,
      stringCourse: false,
      chimney: "masonry",
      porchCanopy: true,
      deck: false,
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
    defaultFloors: 2,
    panoramicGround: true,
    gableGlazing: false,
    details: {
      shutters: false,
      quoins: false,
      stringCourse: false,
      chimney: "none",
      porchCanopy: false,
      deck: true,
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
    defaultFloors: 2,
    panoramicGround: false,
    gableGlazing: false,
    details: {
      shutters: false,
      quoins: true,
      stringCourse: true,
      chimney: "masonry",
      porchCanopy: true,
      deck: false,
    },
    plinthColor: "#8C7B65",
    trimColor: "#FFFFFF",
  },

  barnhouse: {
    id: "barnhouse",
    name: "Барнхаус",
    tagline: "Чёрный фальц, деревянный фронтон, панорамное остекление.",
    // A barnhouse deliberately runs its eaves almost flush — the roof metal
    // wraps the wall and the silhouette stays a single clean prism. This is
    // the one style that steps outside the one-metre eaves rule, and it is a
    // stylistic choice rather than a modelling slip.
    roof: { shape: "gable", pitchDeg: 22, overhangM: 0.25 },
    materials: {
      roof: "roof-seam",
      facade: "facade-metal-seam",
      window: "window-alu",
      door: "door-steel",
      fence: "fence-profnastil",
      foundation: "foundation-slab",
    },
    colors: {
      roof: "#2A2C2E",
      facade: "#2A2C2E",
      window: "#2E3236",
      door: "#2A2C2E",
      fence: "#2F3134",
      foundation: "#55514C",
    },
    // The gable elevation is clad in warm timber against the black flanks.
    accents: {
      "node-facade-left": {
        materialId: "facade-imitation-brus",
        colorHex: "#B5813F",
      },
      "node-facade-right": {
        materialId: "facade-imitation-brus",
        colorHex: "#B5813F",
      },
    },
    window: { widthM: 1.5, heightM: 2.4, sillM: 0.2 },
    defaultFloors: 1,
    panoramicGround: false,
    gableGlazing: true,
    details: {
      shutters: false,
      quoins: false,
      stringCourse: false,
      chimney: "flue",
      porchCanopy: false,
      deck: true,
    },
    plinthColor: "#4A4642",
    trimColor: "#2A2C2E",
  },
};

export const STYLE_LIST: StyleDef[] = [
  STYLES.barnhouse,
  STYLES.european,
  STYLES.scandi,
  STYLES.hightech,
  STYLES.classic,
];

export function styleDef(style: HouseStyle): StyleDef {
  return STYLES[style] ?? STYLES.european;
}
