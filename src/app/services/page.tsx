import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { StageApproach } from "@/components/stage/StageApproach";
import { listExecutors } from "@/lib/server/profiles/queries";
import { ExecutorList } from "./ExecutorList";

/**
 * Страница «Бригады».
 *
 * Была статической с захардкоженным списком, стала серверной: список
 * исполнителей приходит из базы при каждом заходе. Заранее собрать её
 * нельзя — состав бригад меняется, а заблокированный исполнитель должен
 * пропадать из выдачи сразу, а не после следующей сборки.
 */
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const executors = await listExecutors();

  return (
    <>
      <StageApproach stage="services" />
      <NavBar />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-h1 font-extrabold text-cream-bright">
          Бригады для монтажа
        </h1>
        <ExecutorList executors={executors} />
      </main>
      <Footer />
    </>
  );
}
