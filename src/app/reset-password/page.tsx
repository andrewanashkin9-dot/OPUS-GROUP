import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Новый пароль — OPUS GROUP",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-20">
      <Suspense fallback={<div className="h-64" />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
