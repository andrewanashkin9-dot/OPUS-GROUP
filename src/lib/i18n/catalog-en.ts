import type { CategoryId } from "@/lib/marketplace";

/**
 * Английский каталог: названия товаров, описания и характеристики.
 *
 * Наложением поверх `marketplace-catalog.json`, а не второй копией каталога.
 * Копия разошлась бы с исходной на первом же добавленном товаре — и разошлась
 * бы молча, потому что цена, категория и фотография остались бы в одной, а
 * перевод в другой.
 *
 * Здесь только текст. Цена, единицы, идентификаторы и связи с моделью дома
 * живут в JSON и переводу не подлежат: это не язык, а данные.
 *
 * Товара, которого здесь нет, интерфейс покажет по-русски — так добавленная
 * позиция видна сразу, а не пропадает из английской версии без следа.
 */

export const CATEGORY_LABELS_EN: Record<CategoryId, string> = {
  roof: "Roofing",
  facade: "Façade",
  insulation: "Insulation",
  waterproofing: "Waterproofing",
  fence: "Fencing",
  foundation: "Foundation & mixes",
  openings: "Windows & doors",
  flooring: "Flooring",
  wallcover: "Walls",
  ceiling: "Ceiling",
  soundproof: "Soundproofing",
};

/**
 * Названия производителей.
 *
 * Здесь только те, что написаны кириллицей: «BRAER» и «Tarkett» и так
 * читаются одинаково на обоих языках, и переводить их — значит заводить
 * вторую запись, которая однажды разойдётся с первой.
 */
export const BRANDS_EN: Record<string, string> = {
  ТЕХНОНИКОЛЬ: "TECHNONICOL",
  "Металл Профиль": "Metall Profil",
  "Сибирский Лес": "Sibirsky Les",
  "ЖБИ-Урал": "ZhBI-Ural",
  "Опус Двери": "Opus Doors",
  "Опус Металл": "Opus Metal",
  "Акустик Групп": "Acoustic Group",
};

export interface ProductTextEn {
  name: string;
  summary: string;
  specs: [string, string][];
}

export const PRODUCTS_EN: Record<string, ProductTextEn> = {
  "tn-shinglas-ultra": {
    name: "Shinglas Ultra “Samba” asphalt shingles",
    summary:
      "Five-layer bitumen shingles with basalt granules. Quiet in the rain, cut with a knife, laid without a hoist.",
    specs: [
      ["Type", "Bitumen shingle, “Samba” cut"],
      ["Thickness", "4.3 mm"],
      ["Coverage", "1 pack per 2 m²"],
      ["Warranty", "60 years"],
      ["Min. roof pitch", "12°"],
      ["Weight", "15 kg/m²"],
    ],
  },
  "gl-kvinta-uno": {
    name: "Grand Line Kvinta Uno metal tile",
    summary:
      "Modular tile with a tall lock: the wave stands higher than standard, so the roof reads with more depth even from the ground.",
    specs: [
      ["Type", "Modular metal tile"],
      ["Steel thickness", "0.5 mm"],
      ["Coating", "Polyester 25 µm"],
      ["Effective width", "1100 mm"],
      ["Warranty", "25 years"],
      ["Weight", "5 kg/m²"],
    ],
  },
  "mp-monterrey": {
    name: "“Monterrey” metal tile, graphite",
    summary:
      "The classic profile that covers nearly half the country's private roofs. The most predictable choice on both price and installation.",
    specs: [
      ["Type", "Sheet metal tile"],
      ["Steel thickness", "0.45 mm"],
      ["Coating", "Polyester"],
      ["Effective width", "1100 mm"],
      ["Warranty", "10 years"],
      ["Weight", "4.5 kg/m²"],
    ],
  },
  "koramic-alegra-10": {
    name: "Koramic Alegra 10 clay roof tile",
    summary:
      "Fired clay with no coating: the colour never fades, because it is the colour of the body itself, not of paint on top of it.",
    specs: [
      ["Type", "Clay tile, pantile"],
      ["Coverage", "10 pcs/m²"],
      ["Min. roof pitch", "22°"],
      ["Frost resistance", "F150"],
      ["Service life", "over 70 years"],
      ["Weight", "42 kg/m²"],
    ],
  },
  "gl-seam-line": {
    name: "Grand Line standing seam roofing",
    summary:
      "The double standing seam is closed on site — not a single fastener pierces the roof.",
    specs: [
      ["Type", "Seam panel, double standing seam"],
      ["Steel thickness", "0.5 mm"],
      ["Coating", "Zn-Al-Mg"],
      ["Min. roof pitch", "7°"],
      ["Warranty", "30 years"],
      ["Weight", "5.4 kg/m²"],
    ],
  },
  "mp-profnastil-s21": {
    name: "S21 galvanised corrugated sheet",
    summary:
      "A 21 mm structural profile: it carries snow load on battens spaced up to 800 mm apart.",
    specs: [
      ["Sheet size", "1051 × 2000 mm"],
      ["Effective area", "2.0 m² per sheet"],
      ["Steel thickness", "0.45 mm"],
      ["Profile height", "21 mm"],
      ["Coating", "Galvanised 275 g/m²"],
    ],
  },
  "braer-brick-red": {
    name: "BRAER facing brick, red",
    summary:
      "Solid ceramic brick, single format. The geometry holds well enough for a 10 mm joint across the whole façade.",
    specs: [
      ["Format", "1NF, 250 × 120 × 65 mm"],
      ["Coverage", "51 pcs/m² at a 10 mm joint"],
      ["Strength grade", "M150"],
      ["Frost resistance", "F100"],
      ["Water absorption", "6–9 %"],
    ],
  },
  "braer-brick-ivory": {
    name: "BRAER facing brick, ivory",
    summary:
      "A pale façade brick with no added pigment: the tone comes from the clay itself, so it does not fade in patches.",
    specs: [
      ["Format", "1NF, 250 × 120 × 65 mm"],
      ["Coverage", "51 pcs/m² at a 10 mm joint"],
      ["Strength grade", "M150"],
      ["Frost resistance", "F100"],
      ["Water absorption", "6–9 %"],
    ],
  },
  "feldhaus-r735": {
    name: "Feldhaus Klinker R735 clinker tile",
    summary:
      "Clinker is fired to vitrification: water absorption below 3 %, so the façade takes on no moisture and does not flake in frost.",
    specs: [
      ["Format", "NF, 240 × 71 × 14 mm"],
      ["Coverage", "48 pcs/m²"],
      ["Water absorption", "under 3 %"],
      ["Frost resistance", "F300"],
      ["Substrate", "Render, concrete, cement board"],
    ],
  },
  "ceresit-ct64": {
    name: "Ceresit CT 64 decorative render, 2 mm “bark beetle”",
    summary:
      "Acrylic render with a 2 mm grain. The “bark beetle” pattern comes from the float, not the mix — vertical, circular or crosswise.",
    specs: [
      ["Pack size", "25 kg"],
      ["Coverage", "2.7 kg/m²"],
      ["Grain", "2.0 mm"],
      ["Working time", "15 min"],
      ["Application temperature", "+5 to +30 °C"],
    ],
  },
  "docke-block-house": {
    name: "Döcke Premium “Block House” siding",
    summary:
      "A vinyl panel imitating a turned log. Needs no painting and survives −50 °C without cracking.",
    specs: [
      ["Panel size", "3660 × 244 mm"],
      ["Effective area", "0.85 m² per panel"],
      ["Thickness", "1.1 mm"],
      ["Working range", "−50…+60 °C"],
      ["Warranty", "50 years"],
    ],
  },
  "larch-planken": {
    name: "Larch planken cladding, grade AB",
    summary:
      "Bevelled kiln-dried planken. Fixed with concealed clips, so not one screw shows on the façade.",
    specs: [
      ["Profile", "Bevelled, 20 × 140 mm"],
      ["Moisture", "12 ± 2 %"],
      ["Length", "3–4 m"],
      ["Grade", "AB (no loose knots)"],
      ["Finish", "Oil or stain required"],
    ],
  },
  "rockwool-scandic": {
    name: "ROCKWOOL Light Butts Scandic mineral wool",
    summary:
      "Stone wool with a springing Flexi edge: the slab wedges between studs and needs no trimming on site.",
    specs: [
      ["Slab size", "800 × 600 × 100 mm"],
      ["Per pack", "5.76 m² (6 slabs)"],
      ["Density", "35 kg/m³"],
      ["Thermal conductivity", "0.036 W/(m·K)"],
      ["Fire class", "Non-combustible"],
    ],
  },
  "tn-technoplex": {
    name: "TECHNONICOL Technoplex extruded polystyrene, 50 mm",
    summary:
      "Closed cells barely draw water, so XPS goes where mineral wool would not work: plinth, apron, floor on ground.",
    specs: [
      ["Slab size", "1180 × 580 × 50 mm"],
      ["Per pack", "4.10 m² (6 slabs)"],
      ["Density", "26–35 kg/m³"],
      ["Thermal conductivity", "0.032 W/(m·K)"],
      ["Water absorption", "0.2 % over 24 h"],
    ],
  },
  "isover-profi": {
    name: "ISOVER Profi mineral wool roll, 50 mm",
    summary:
      "Glass wool in a roll: it unrolls down the whole slope, with no joints across the rafters.",
    specs: [
      ["Size", "5000 × 1200 × 50 mm"],
      ["Per roll", "12 m² (2 sheets)"],
      ["Density", "13 kg/m³"],
      ["Thermal conductivity", "0.037 W/(m·K)"],
      ["Fire class", "Non-combustible"],
    ],
  },
  "tn-technoelast-epp": {
    name: "Technoelast EPP torch-on waterproofing",
    summary:
      "SBS-modified bitumen on a polyester carrier. Works on a flat roof and in a foundation — where felt does not survive a second winter.",
    specs: [
      ["Roll size", "10 × 1 m"],
      ["Carrier", "Polyester 180 g/m²"],
      ["Flexibility", "down to −25 °C"],
      ["Heat resistance", "+100 °C"],
      ["Service life", "up to 30 years"],
    ],
  },
  "tn-membrane-a": {
    name: "TECHNONICOL A wind and moisture barrier",
    summary:
      "Fitted outside the insulation: it lets vapour out of the structure and keeps wind and droplets from getting in.",
    specs: [
      ["Roll size", "70 × 1.6 m"],
      ["Area", "112 m²"],
      ["Vapour permeability", "over 1000 g/m² per day"],
      ["Water resistance", "over 250 mm water column"],
      ["UV resistance", "4 months"],
    ],
  },
  "gl-shtaketnik-m": {
    name: "Grand Line M-profile fence picket",
    summary:
      "A picket with a double-folded edge: it will not cut your hands and will not unbend under wind load.",
    specs: [
      ["Size", "118 × 1500 mm"],
      ["Steel thickness", "0.5 mm"],
      ["Coating", "Print Elite (both sides)"],
      ["Coverage", "8 pcs per metre at a 40 mm gap"],
      ["Warranty", "20 years"],
    ],
  },
  "forged-section-classic": {
    name: "“Classic” wrought iron fence section, 2000 × 1800 mm",
    summary:
      "Welded from 12 mm bar with hot-forged joints. Primed and powder-coated in the shop — only installation happens on site.",
    specs: [
      ["Section size", "2000 × 1800 mm"],
      ["Bar", "12 × 12 mm"],
      ["Coating", "Primer + powder enamel"],
      ["Section weight", "46 kg"],
      ["Installation", "On a 60 × 60 mm post"],
    ],
  },
  "knauf-m150": {
    name: "Knauf M-150 universal mix",
    summary:
      "Cement-sand mix for masonry and screed. Grade M-150 is the working minimum for load-bearing masonry; do not go lower.",
    specs: [
      ["Pack size", "25 kg"],
      ["Strength grade", "M-150"],
      ["Coverage", "18 kg/m² at a 10 mm layer"],
      ["Pot life", "2 h"],
      ["Frost resistance", "F50"],
    ],
  },
  "fbs-24-4-6": {
    name: "FBS 24-4-6 foundation block",
    summary:
      "Solid foundation block in B12.5 concrete. The footing goes up in a day but needs a crane — 380 kg will not be set by hand.",
    specs: [
      ["Size", "2380 × 400 × 580 mm"],
      ["Concrete", "B12.5 (M150)"],
      ["Weight", "1.3 t"],
      ["Frost resistance", "F50"],
      ["Installation", "Crane from 5 t"],
    ],
  },
  "rehau-blitz-window": {
    name: "REHAU Blitz window, 1300 × 1400 mm",
    summary:
      "A three-chamber profile with a double-glazed unit. The baseline choice for a living room in a temperate climate.",
    specs: [
      ["Size", "1300 × 1400 mm"],
      ["Profile", "REHAU Blitz, 60 mm, 3 chambers"],
      ["Glazing", "Double unit, 32 mm"],
      ["Thermal resistance", "0.64 m²·°C/W"],
      ["Sashes", "One tilt-and-turn"],
    ],
  },
  "opus-door-thermo": {
    name: "“Thermo” entrance door, 960 × 2050 mm",
    summary:
      "A steel door with a thermal break: the leaf does not freeze over or run with condensation at −30 °C outside.",
    specs: [
      ["Size", "960 × 2050 mm"],
      ["Steel", "1.5 mm, two seal lines"],
      ["Thermal break", "Yes"],
      ["Locks", "Two, burglary class 3"],
      ["Insulation", "Mineral wool 80 mm"],
    ],
  },
  "tarkett-holiday-laminate": {
    name: "Tarkett Holiday laminate, “Waveless Oak”",
    summary:
      "Class 33: the lock survives furniture being moved and a hallway walked in outdoor shoes. Floats on underlay, no glue.",
    specs: [
      ["Wear class", "33 (AC5)"],
      ["Thickness", "8 mm"],
      ["Lock", "T-Lock, glueless"],
      ["Board format", "1292 × 194 mm"],
      ["Bevel", "V-groove on four sides"],
      ["Underfloor heating", "Allowed, up to 27 °C"],
      ["Cutting allowance", "5 % laid straight"],
    ],
  },
  "alpine-spc-vanilla": {
    name: "Alpine Floor SPC tile, “Vanilla Oak”",
    summary:
      "A stone-polymer core does not swell with water — the only wood-look covering that goes in a kitchen or a bathroom.",
    specs: [
      ["Core", "SPC, stone-polymer composite"],
      ["Thickness", "4 mm, 0.5 mm wear layer"],
      ["Class", "43, commercial"],
      ["Moisture resistance", "Full, joints do not swell"],
      ["Plank format", "1220 × 183 mm"],
      ["Underfloor heating", "Allowed, up to 28 °C"],
      ["Cutting allowance", "5 %"],
    ],
  },
  "kerama-pro-stone": {
    name: "Kerama Marazzi “Pro Stone” porcelain stoneware",
    summary:
      "Rectified 60 × 60 stoneware: the edge is cut after firing, so the joint comes down to 1.5 mm and the floor reads as one surface.",
    specs: [
      ["Format", "600 × 600 × 9 mm"],
      ["Coverage", "2.78 pcs/m²"],
      ["Surface", "Matt, anti-slip R10"],
      ["Water absorption", "under 0.5 %"],
      ["Rectified", "Yes, joint from 1.5 mm"],
      ["Underfloor heating", "Allowed"],
      ["Cutting allowance", "7 %"],
    ],
  },
  "coswick-oak-natur": {
    name: "Coswick engineered board, Oak “Natur”",
    summary:
      "A 3.8 mm solid oak layer on plywood: the board can be resanded twice, and humidity swings do not cup it the way they cup solid wood.",
    specs: [
      ["Construction", "Oak 3.8 mm on birch plywood"],
      ["Thickness", "15 mm"],
      ["Board format", "1860 × 190 mm"],
      ["Finish", "Hardwax oil, brushed"],
      ["Laying", "Glued, to screed or plywood"],
      ["Underfloor heating", "Allowed when glued down"],
      ["Cutting allowance", "7 %"],
    ],
  },
  "erismann-vlies-paint": {
    name: "Erismann non-woven wallpaper for painting",
    summary:
      "Non-woven paper is pasted to the wall, not to the sheet: the paste goes on the substrate, strips do not stretch and seams do not open. Repaintable up to eight times.",
    specs: [
      ["Roll format", "1.06 × 25 m"],
      ["Coverage", "26 m² per roll"],
      ["Density", "130 g/m²"],
      ["For painting", "Up to 8 repaints"],
      ["Seam", "Butt joint, no overlap"],
      ["Matching allowance", "10 %"],
    ],
  },
  "dulux-diamond-matt": {
    name: "Dulux Diamond Matt interior paint",
    summary:
      "Matt but washable: the film takes wet cleaning, so it also suits a hallway where sleeves brush the wall.",
    specs: [
      ["Volume", "10 l"],
      ["Coverage", "65 m² per tin, two coats"],
      ["Sheen", "Matt, 5 % at 60°"],
      ["Wash resistance", "Class 1 per EN 13300"],
      ["Substrate", "Non-woven, filler, plasterboard"],
      ["Tinting", "By fan deck, 2000+ shades"],
    ],
  },
  "kerama-murano-wall": {
    name: "Kerama Marazzi “Murano” wall tile",
    summary:
      "Glossy 30 × 60 glaze for a bathroom. The tile itself does not fear water — waterproofing underneath is what keeps it sealed, not the tile.",
    specs: [
      ["Format", "300 × 600 × 9 mm"],
      ["Coverage", "5.56 pcs/m²"],
      ["Surface", "Gloss glaze"],
      ["Use", "Walls, wet rooms"],
      ["Joint", "2 mm"],
      ["Cutting allowance", "10 %"],
    ],
  },
  "vgt-travertine": {
    name: "VGT “Travertine” decorative render",
    summary:
      "Applied with a trowel in two passes: the first builds relief, the second burnishes the peaks. Mistakes are worked back in while the layer is still open.",
    specs: [
      ["Volume", "15 kg"],
      ["Coverage", "9 m² per tub"],
      ["Application", "Trowel, two passes"],
      ["Time before burnishing", "20–40 minutes"],
      ["Substrate", "Filler, plasterboard, concrete"],
      ["Wet rooms", "Allowed once waxed"],
    ],
  },
  "pongs-stretch-matt": {
    name: "Pongs stretch ceiling, matt fabric",
    summary:
      "The sheet is welded to the size of the room and tensioned in one visit. It holds water from above: after a leak it is drained and put back.",
    specs: [
      ["Material", "PVC, Germany"],
      ["Surface", "Matt"],
      ["Sheet width", "up to 3.25 m seamless"],
      ["Installation", "Harpoon, bead around the perimeter"],
      ["Height lost", "35 mm"],
      ["Included", "Sheet, bead and fitting"],
      ["Allowance", "None — cut to measure"],
    ],
  },
  "knauf-gkl-ceiling": {
    name: "KNAUF ceiling plasterboard, 9.5 mm",
    summary:
      "A ceiling sheet is thinner than a wall one and a quarter lighter — one person holds it while the second drives the screws.",
    specs: [
      ["Format", "2500 × 1200 × 9.5 mm"],
      ["Coverage", "3 m² per sheet"],
      ["Sheet weight", "23 kg"],
      ["Frame spacing", "400 mm on a ceiling"],
      ["Edge", "Tapered, for filling"],
      ["Cutting allowance", "10 %"],
    ],
  },
  "tikkurila-siro-ceiling": {
    name: "Tikkurila Siro Himmeä ceiling paint",
    summary:
      "Deep matt with no glint: on a ceiling any sheen drags out every ripple in the filler under raking light.",
    specs: [
      ["Volume", "9 l"],
      ["Coverage", "63 m² per tin, two coats"],
      ["Sheen", "Deep matt, 3 %"],
      ["Thinning", "Water, up to 10 %"],
      ["Substrate", "Plasterboard, filler, concrete"],
      ["Drying between coats", "2 hours"],
    ],
  },
  "rockwool-acoustic-butts": {
    name: "ROCKWOOL Acoustic Butts sound insulation",
    summary:
      "The slab only works inside a frame: it damps sound within the battens. Glued to a bare wall it gives almost nothing.",
    specs: [
      ["Format", "1000 × 600 × 50 mm"],
      ["Coverage", "6 m² per pack"],
      ["Density", "45 kg/m³"],
      ["Sound absorption", "0.95 (NRC)"],
      ["Fire class", "Non-combustible"],
      ["Allowance", "5 %"],
    ],
  },
  "shumanet-100-kombi": {
    name: "Shumanet-100 Combi membrane",
    summary:
      "A heavy membrane adds mass to a thin partition. Glued as one continuous sheet: any gap at a joint cancels the effect.",
    specs: [
      ["Roll format", "10 × 1.5 m"],
      ["Coverage", "15 m² per roll"],
      ["Surface density", "4 kg/m²"],
      ["Insulation gain", "+9 dB to the partition"],
      ["Installation", "Butt joints, taped"],
      ["Allowance", "5 %"],
    ],
  },
  "arbiton-secura-thermo": {
    name: "Arbiton Secura Thermo underlay",
    summary:
      "Goes under laminate and SPC: it evens out small waves in the screed and removes the hollow footfall heard on the floor below.",
    specs: [
      ["Roll format", "1.1 × 10 m"],
      ["Coverage", "11 m² per roll"],
      ["Thickness", "1.5 mm"],
      ["Impact noise", "−19 dB"],
      ["Underfloor heating", "Compatible, R = 0.013 m²·K/W"],
      ["Allowance", "5 %"],
    ],
  },
};
