"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppStore, useUsage } from "@/lib/store";
import { FREE_PROJECT_LIMIT, remainingLabel } from "@/lib/usage";
import { DEFAULT_ROOM_DIMENSIONS, metres } from "@/lib/room";

/**
 * The room configurator before there is a room.
 *
 * It states the default dimensions rather than asking for them here: the
 * first screen's job is to get the reader to a room they can push around,
 * and every field in front of that is a reason to leave.
 */
export function RoomStart() {
  const createRoom = useAppStore((s) => s.createRoom);
  const roomError = useAppStore((s) => s.roomError);
  const usage = useUsage();
  const [busy, setBusy] = useState(false);

  const blocked = usage !== null && !usage.allowed;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <div className="plate p-6 sm:p-10">
        <p className="text-caption font-medium uppercase tracking-wide text-dim">
          Конструктор · Комната
        </p>
        <h1 className="mt-3 font-display text-h1 font-semibold tracking-tight text-white">
          Посчитаем отделку одной комнаты
        </h1>
        <p className="prose-measure mt-4 text-body text-soft">
          Введите три размера — комната соберётся сразу. Дальше отметите дверь
          и окна, выберете пол, стены и потолок, и увидите, сколько чего
          покупать, вместе с запасом на подрезку.
        </p>

        <dl className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--plate-edge)]">
          {[
            ["Ширина", `${metres(DEFAULT_ROOM_DIMENSIONS.widthM)} м`],
            ["Длина", `${metres(DEFAULT_ROOM_DIMENSIONS.lengthM)} м`],
            ["Высота", `${metres(DEFAULT_ROOM_DIMENSIONS.heightM)} м`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-r border-[var(--plate-edge)] px-3 py-2.5 last:border-r-0"
            >
              <dt className="text-caption uppercase text-dim">{label}</dt>
              <dd className="mt-0.5 font-body text-ui font-bold tabular-nums text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-caption text-dim">
          Начнём с типовой комнаты — свои размеры поставите на первом шаге.
        </p>

        <button
          type="button"
          disabled={busy || blocked}
          onClick={() => {
            setBusy(true);
            void createRoom().finally(() => setBusy(false));
          }}
          className="mt-8 w-full rounded-full bg-accent px-6 py-3.5 text-ui font-bold text-deep shadow-[var(--lift-1)] transition-[filter] hover:brightness-108 disabled:opacity-40"
        >
          {busy ? "Собираем комнату…" : "Собрать комнату"}
        </button>

        {blocked ? (
          <p role="status" className="mt-4 text-body-s" style={{ color: "var(--warning)" }}>
            На свободном тарифе доступно {FREE_PROJECT_LIMIT} проекта. Удалите
            один из начатых, чтобы освободить место.
          </p>
        ) : (
          usage &&
          usage.limit !== null && (
            <p className="mt-4 text-caption text-dim">
              {remainingLabel(usage)} на свободном тарифе.
            </p>
          )
        )}
        {roomError && !blocked && (
          <p role="alert" className="mt-3 text-body-s" style={{ color: "var(--error)" }}>
            {roomError}
          </p>
        )}

        <p className="mt-6 text-body-s text-dim">
          Считаете дом целиком?{" "}
          <Link
            href="/editor"
            className="font-medium text-white underline underline-offset-2"
          >
            Конструктор дома
          </Link>
        </p>
      </div>
    </div>
  );
}
