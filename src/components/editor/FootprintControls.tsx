"use client";

import { useState } from "react";
import type { SceneModel } from "@/lib/3d/types";
import { HOUSE_SIDE_MAX_M, HOUSE_SIDE_MIN_M } from "@/lib/3d/types";
import { useAppStore } from "@/lib/store";

/**
 * Габариты дома в плане.
 *
 * Самый важный элемент во всей панели: из ширины и глубины считаются площадь
 * фасадов, площадь кровли, периметр забора и площадь фундамента — то есть
 * почти вся смета. Пока это число было зашито в код, любой дом стоил как
 * дом 9,5 × 8,2 метра.
 *
 * Сервис 3D их не измеряет — он рисует внешний вид по фотографии, а не
 * обмеряет постройку. Поэтому размеры вводит человек, и об этом сказано
 * прямо: иначе он решит, что цифры пришли с его фотографий, и не станет их
 * проверять.
 */
export function FootprintControls({ model }: { model: SceneModel }) {
  const setFootprint = useAppStore((s) => s.setFootprint);
  const rebuilding = useAppStore((s) => s.rebuilding);

  return (
    <div>
      <h3 className="text-caption font-medium uppercase text-cream-dim">
        Габариты дома
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SideField
          label="Ширина"
          value={model.dimensions.widthM}
          disabled={rebuilding}
          onCommit={(widthM) =>
            void setFootprint({ widthM, depthM: model.dimensions.depthM })
          }
        />
        <SideField
          label="Глубина"
          value={model.dimensions.depthM}
          disabled={rebuilding}
          onCommit={(depthM) =>
            void setFootprint({ widthM: model.dimensions.widthM, depthM })
          }
        />
      </div>
      <p className="mt-2 text-caption leading-snug text-cream-dim">
        По ним считается смета — измерьте дом по фундаменту. Сервис 3D строит
        внешний вид, но не размеры.
      </p>
    </div>
  );
}

/** Метры по-русски: «11,5», а не «11.5». */
function format(metres: number): string {
  return metres.toLocaleString("ru-RU");
}

/**
 * Поле одной стороны.
 *
 * Значение применяется по потере фокуса и по Enter, а не на каждый символ:
 * при вводе «12» пользователь неизбежно проходит через «1», и перестройка
 * дома на каждую цифру означала бы четыре пересчёта сметы вместо одного —
 * и мигающую сцену.
 */
function SideField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  // Запятая, а не точка: человек вводит «11,5», и возвращать ему «11.5» —
  // мелкая, но заметная неправда о том, что он только что напечатал.
  const [draft, setDraft] = useState(() => format(value));
  const [seen, setSeen] = useState(value);

  // Модель может перестроиться и помимо этого поля — сменой этажности или
  // откатом за пределы допустимого. Тогда черновик надо подтянуть к новому
  // значению. Это делается во время рендера, а не в эффекте: эффект здесь
  // означал бы лишний кадр со старым числом.
  if (value !== seen) {
    setSeen(value);
    setDraft(format(value));
  }

  function commit() {
    // Запятая — обычный десятичный разделитель в русской раскладке, и
    // parseFloat об этом не знает: «8,2» превратилось бы в 8.
    const parsed = Number.parseFloat(draft.replace(",", "."));
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setDraft(format(value));
  }

  return (
    <label className="block">
      <span className="block text-caption text-cream-dim">{label}, м</span>
      <input
        // Не type="number": браузер не даёт ввести туда запятую, а на
        // русской раскладке «11,5» набирают именно через запятую — символ
        // молча проглатывался, и поле выглядело сломанным. inputMode
        // всё равно поднимает цифровую клавиатуру на телефоне, а границы
        // проверяет стор, а не разметка.
        type="text"
        inputMode="decimal"
        aria-describedby={`${label}-range`}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="mt-1 w-full rounded-xl border border-line bg-transparent px-3 py-2 text-body-s tabular-nums text-cream-bright transition-colors focus:border-cream-bright focus:outline-none disabled:opacity-50"
      />
      <span id={`${label}-range`} className="sr-only">
        от {HOUSE_SIDE_MIN_M} до {HOUSE_SIDE_MAX_M} метров
      </span>
    </label>
  );
}
