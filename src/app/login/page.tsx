import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Вход — OPUS GROUP",
  // Страницу входа незачем показывать в поиске.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <h1 className="font-display mb-2 text-h2 font-extrabold text-cream-bright">
          Вход в кабинет
        </h1>
        <p className="mb-10 text-body-s text-cream-dim">
          Заявки, отклики и подписка — в одном месте.
        </p>
        {/* useSearchParams требует Suspense: без него страница не соберётся
            статически, потому что параметры известны только в браузере. */}
        <Suspense fallback={<div className="h-96" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
