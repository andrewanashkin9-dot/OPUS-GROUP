import type { Metadata } from "next";
import { RoomShell } from "@/components/room/RoomShell";

export const metadata: Metadata = {
  title: "Комната — OPUS GROUP",
  description:
    "Конструктор отделки комнаты: размеры, проёмы, материалы и расчёт с запасом на подрезку.",
};

export default function RoomPage() {
  return <RoomShell />;
}
