import type { Metadata } from "next";
import { Home } from "@/components/pages/HomePage";

export const metadata: Metadata = {
  title: "OPUS GROUP — from a photo of your house to a materials estimate",
  description:
    "Upload photos of your house, get a 3D model, adjust the roof, façade and fence — and see the materials estimate and the crews ready to install them.",
  // Поисковику сказано, что это две версии одной страницы, а не дубликат.
  // Без этого английская и русская главные конкурируют друг с другом в
  // выдаче, и обе проседают.
  alternates: {
    canonical: "/en",
    languages: { ru: "/", en: "/en" },
  },
};

export default function Page() {
  return <Home locale="en" />;
}
