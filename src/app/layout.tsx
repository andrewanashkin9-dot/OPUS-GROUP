import type { Metadata } from "next";
import { StoreHydrator } from "@/components/StoreHydrator";
import { BlueprintSpace } from "@/components/ui/BlueprintSpace";
import { FilmGrain } from "@/components/ui/FilmGrain";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPUS GROUP — от фото дома до сметы на материалы",
  description:
    "Загрузите фото дома, получите 3D-модель, настройте кровлю, фасад и забор — и сразу увидите смету на материалы и бригады, готовые их установить.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full bg-deep font-body text-soft">
        {/* Entrance animation starts hidden and is played by an observer. With
            no scripting nothing would ever play it, so the hidden state is
            cancelled outright rather than leaving the page blank. */}
        <noscript>
          <style>{".reveal{opacity:1}"}</style>
        </noscript>

        <BlueprintSpace />

        {/* Content rides above the two fixed sheet layers. */}
        <div className="relative z-10 flex min-h-svh flex-col">
          <StoreHydrator />
          {children}
        </div>

        <FilmGrain />
      </body>
    </html>
  );
}
