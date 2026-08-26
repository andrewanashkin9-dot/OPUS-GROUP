import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmailForm } from "./VerifyEmailForm";

export const metadata: Metadata = {
  title: "Подтверждение адреса — OPUS GROUP",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-20">
      <Suspense fallback={<div className="h-40" />}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}
