"use client";

import { useState } from "react";
import { TitleBlock } from "@/components/TitleBlock";
import { formatRub } from "@/lib/format";
import {
  metres,
  squareMetres,
  strandedOpenings,
  validateDimensions,
} from "@/lib/room";
import {
  useAppStore,
  useRoomEstimate,
  useRoomSurfaces,
  useUsage,
  type RoomStep,
} from "@/lib/store";
import { EstimateStep } from "./EstimateStep";
import { FinishStep } from "./FinishStep";
import { OpeningsStep } from "./OpeningsStep";
import { RoomCanvas } from "./RoomCanvas";
import { RoomStart } from "./RoomStart";
import { RoomTopBar } from "./RoomTopBar";
import { SizeStep } from "./SizeStep";
import { StepNav } from "./StepNav";
import { SurfaceToolbar } from "./SurfaceToolbar";

export function RoomShell() {
  const room = useAppStore((s) => s.room);
  const roomStep = useAppStore((s) => s.roomStep);
  const setRoomStep = useAppStore((s) => s.setRoomStep);
  const selectedSurfaceId = useAppStore((s) => s.selectedSurfaceId);
  const selectSurface = useAppStore((s) => s.selectSurface);
  const insideView = useAppStore((s) => s.insideView);
  const setInsideView = useAppStore((s) => s.setInsideView);
  const roomError = useAppStore((s) => s.roomError);
  const surfaces = useRoomSurfaces();
  const estimate = useRoomEstimate();
  const [sheetOpen, setSheetOpen] = useState(true);
  useUsage();

  if (!room) return <RoomStart />;

  // One reason, computed once: it gates the step nav and is printed under the
  // panel, so the reader never sees a disabled control with no cause.
  const stranded = strandedOpenings(room);
  const blockedReason =
    validateDimensions(room) ??
    (stranded.length > 0
      ? "Сначала поправьте проёмы: они не помещаются в стены."
      : null);

  const panel =
    roomStep === "size" ? (
      <SizeStep room={room} />
    ) : roomStep === "openings" ? (
      <OpeningsStep room={room} />
    ) : roomStep === "finish" ? (
      <FinishStep room={room} />
    ) : (
      <EstimateStep room={room} />
    );

  const notice = roomError ?? blockedReason;

  return (
    <div className="flex h-[100dvh] flex-col">
      <RoomTopBar />

      <div className="flex shrink-0 items-center justify-between gap-3 overflow-x-auto border-b border-[var(--plate-edge)] bg-[var(--rail)] px-4 py-2 backdrop-blur-sm sm:px-6">
        <StepNav step={roomStep} onStep={setRoomStep} blockedReason={blockedReason} />
        <button
          type="button"
          onClick={() => setInsideView(!insideView)}
          aria-pressed={insideView}
          className="shrink-0 rounded-full border border-[var(--plate-edge)] px-3 py-1.5 text-caption font-medium text-dim transition-colors hover:border-[var(--plate-edge-hi)] hover:text-white"
        >
          {insideView ? "Смотреть снаружи" : "Встать внутри"}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1">
          <RoomCanvas
            room={room}
            selectedSurfaceId={selectedSurfaceId}
            insideView={insideView}
            onSelect={selectSurface}
          />
          <SurfaceToolbar
            surfaces={surfaces}
            selectedId={selectedSurfaceId}
            finishes={room.finishes}
            onSelect={selectSurface}
          />

          {/* The same штамп as everywhere else, carrying this room. Inert to
              the pointer so it never eats a drag meant for the camera, and
              clear of the surface chips pinned at bottom-6. */}
          <TitleBlock
            className="pointer-events-none absolute bottom-24 right-4 hidden w-[min(30rem,calc(100%-2rem))] backdrop-blur-sm xl:grid"
            fields={[
              { label: "Помещение", value: room.name },
              {
                label: "Габариты",
                value: `${metres(room.dimensions.widthM)} × ${metres(room.dimensions.lengthM)} м`,
              },
              { label: "Высота", value: `${metres(room.dimensions.heightM)} м` },
              { label: "Пол", value: squareMetres(estimate?.floorM2 ?? 0) },
              {
                label: "Стены",
                value: squareMetres(estimate?.wallsM2 ?? 0),
                secondary: true,
              },
              {
                label: "Материалы",
                value: formatRub(estimate?.total ?? 0),
                accent: true,
              },
            ]}
          />
        </div>

        {/* Desktop rail */}
        <aside className="hidden w-[26rem] shrink-0 flex-col gap-6 overflow-y-auto border-l border-[var(--plate-edge)] bg-[var(--rail)] p-6 backdrop-blur-sm lg:flex">
          {panel}
          {notice && (
            <p role="status" className="text-body-s" style={{ color: "var(--warning)" }}>
              {notice}
            </p>
          )}
        </aside>

        {/* Below lg the rail becomes a sheet. It opens by default: on a phone
            the panel is the screen, and the 3D view is the illustration. */}
        <div className="shrink-0 border-t border-[var(--plate-edge)] bg-[var(--rail)] backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-body-s font-medium text-white"
          >
            <span>{stepTitle(roomStep)}</span>
            <span aria-hidden="true">{sheetOpen ? "▾" : "▴"}</span>
          </button>
          {sheetOpen && (
            <div className="max-h-[52dvh] overflow-y-auto px-4 pb-5">
              {panel}
              {notice && (
                <p
                  role="status"
                  className="mt-4 text-body-s"
                  style={{ color: "var(--warning)" }}
                >
                  {notice}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function stepTitle(step: RoomStep): string {
  switch (step) {
    case "size":
      return "Размеры комнаты";
    case "openings":
      return "Двери и окна";
    case "finish":
      return "Отделка поверхностей";
    case "estimate":
      return "Расчёт материалов";
  }
}
