import type { Metadata } from "next";
import { StoreHydrator } from "@/components/StoreHydrator";
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
      <body className="min-h-full flex flex-col bg-bg text-cream font-body">
        {/* Reveal-on-scroll starts hidden and is played by an observer. With
            no scripting nothing would ever play it, so the hidden state is
            cancelled outright rather than leaving the page blank. */}
        <noscript>
          <style>{".reveal{opacity:1}"}</style>
        </noscript>
        <StoreHydrator />
        {children}
        <FilmGrain />
      </body>
    </html>
  );
}
