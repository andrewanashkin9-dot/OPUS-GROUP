import type { Metadata } from "next";
import { ServicesPage } from "@/components/pages/ServicesPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crews for installation — OPUS GROUP",
  description:
    "Roofing, façade, fence and foundation crews, matched against the model of your house.",
  alternates: {
    canonical: "/en/services",
    languages: { ru: "/services", en: "/en/services" },
  },
};

export default function Page() {
  return <ServicesPage locale="en" />;
}
