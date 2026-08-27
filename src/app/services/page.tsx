import { ServicesPage } from "@/components/pages/ServicesPage";

export const dynamic = "force-dynamic";

/** Русские «Бригады». Английская версия — в app/en/services/page.tsx. */
export default function Page() {
  return <ServicesPage locale="ru" />;
}
