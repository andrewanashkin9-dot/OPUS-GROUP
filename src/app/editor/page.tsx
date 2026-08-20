import type { Metadata } from "next";
import { EditorShell } from "@/components/editor/EditorShell";

export const metadata: Metadata = {
  title: "Конструктор — OPUS GROUP",
};

export default function EditorPage() {
  return <EditorShell />;
}
