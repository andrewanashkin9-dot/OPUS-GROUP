import type { Metadata } from "next";
import { StoreHydrator } from "@/components/StoreHydrator";
import { WelcomeAchievement } from "@/components/WelcomeAchievement";
// ⚠️ ВРЕМЕННАЯ ДЕМО-ВСТАВКА — см. TODO_BEFORE_LAUNCH.md
import { DemoModeCorner } from "@/components/demo/DemoModeCorner";
import { isDemoMode } from "@/lib/demo-mode";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
      // The blocking script below stamps data-theme on this element before
      // React arrives, so the client tree legitimately differs from the
      // server one here — by design, and only on this one attribute.
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved sheet colour before first paint. Inlined and
            blocking on purpose: a module would arrive a hop too late and the
            reader would see the default theme flash first. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
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

        {/* Приветствие после регистрации. В корневой разметке, потому что
            попасть после неё человек может на любую страницу — и застать его
            надо там, где он оказался, а не только в кабинете. Гостю ничего не
            рисует и никуда не ходит. */}
        <WelcomeAchievement />

        {/* ⚠️ ВРЕМЕННО: переключатель «Посетитель / Модератор» в углу.
            Только при DEMO_MODE=true — решение принимается здесь, на
            сервере, чтобы в боевой сборке этого кода в разметке не было
            вовсе. */}
        {isDemoMode() && <DemoModeCorner />}

        <FilmGrain />
      </body>
    </html>
  );
}
