"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { useApiFetch } from "@/lib/auth/useApiFetch";

/**
 * Профиль исполнителя: навыки, описание и портфолио.
 *
 * Это то, что заказчик увидит на странице «Бригады». Рейтинг здесь не
 * редактируется и не показывается — он считается из завершённых заявок, и
 * поле, которое исполнитель мог бы заполнить сам, репутацией не является.
 */

const WORK_KINDS = [
  { id: "roof", label: "Кровля" },
  { id: "facade", label: "Фасад" },
  { id: "fence", label: "Забор" },
  { id: "foundation", label: "Фундамент" },
  { id: "window", label: "Окна" },
  { id: "door", label: "Двери" },
] as const;

export interface PortfolioItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  workKind: string | null;
}

export function ProfilePanel({
  initialSpecialties,
  initialBio,
  initialPriceHint,
  initialPortfolio,
}: {
  initialSpecialties: string[];
  initialBio: string | null;
  initialPriceHint: string | null;
  initialPortfolio: PortfolioItem[];
}) {
  const call = useApiFetch();
  const [specialties, setSpecialties] = useState<string[]>(initialSpecialties);
  const [bio, setBio] = useState(initialBio ?? "");
  const [priceHint, setPriceHint] = useState(initialPriceHint ?? "");
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [itemTitle, setItemTitle] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemKind, setItemKind] = useState("");

  async function saveProfile() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const { ok, data } = await call<{ error?: string }>("/api/executors/me", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ specialties, bio, priceHint }),
    });
    if (ok) setSaved(true);
    else setError(data.error ?? "Не удалось сохранить");
    setBusy(false);
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await call<{ item?: PortfolioItem; error?: string }>("/api/executors/me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: itemTitle, imageUrl: itemUrl || null, workKind: itemKind || null }),
    });
    if (ok && data.item) {
      setPortfolio((prev) => [data.item!, ...prev]);
      setItemTitle("");
      setItemUrl("");
      setItemKind("");
    } else {
      setError(data.error ?? "Не удалось добавить работу");
    }
    setBusy(false);
  }

  async function removeItem(id: string) {
    setBusy(true);
    const { ok } = await call(`/api/executors/me/portfolio/${id}`, { method: "DELETE" });
    if (ok) setPortfolio((prev) => prev.filter((i) => i.id !== id));
    setBusy(false);
  }

  return (
    // Якорь для приветственной карточки: её кнопка «Заполнить профиль» ведёт
    // на /cabinet#profile. scroll-mt отводит заголовок из-под липкой шапки.
    <section id="profile" className="mt-14 scroll-mt-20 rounded-3xl border border-line p-6">
      <h2 className="font-display text-h3 font-extrabold text-cream-bright">Профиль бригады</h2>
      <p className="mt-2 text-body-s text-cream-dim">
        Это увидят заказчики на странице «Бригады».
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {WORK_KINDS.map((kind) => {
          const active = specialties.includes(kind.id);
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() =>
                setSpecialties((prev) =>
                  active ? prev.filter((k) => k !== kind.id) : [...prev, kind.id],
                )
              }
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-ui transition-colors ${
                active ? "border-cream text-cream-bright" : "border-line text-cream-dim"
              }`}
            >
              {kind.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Чем занимаетесь, какие гарантии даёте"
        className={`${inputClass} mt-4`}
      />
      <input
        value={priceHint}
        onChange={(e) => setPriceHint(e.target.value)}
        maxLength={120}
        placeholder="Ориентир по цене — например, «от 450 ₽/м²»"
        className={`${inputClass} mt-3`}
      />

      <div className="mt-4 flex items-center gap-4">
        <Button onClick={saveProfile} disabled={busy}>
          Сохранить профиль
        </Button>
        {saved && <span className="text-body-s text-success">Сохранено</span>}
      </div>

      <h3 className="mt-10 text-body-l text-cream-bright">Портфолио</h3>
      {portfolio.length > 0 && (
        <ul className="mt-4 space-y-2">
          {portfolio.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 border-b border-line pb-2">
              <span className="text-body-s text-cream">
                {item.title}
                {item.workKind && (
                  <span className="text-cream-dim">
                    {" · "}
                    {WORK_KINDS.find((k) => k.id === item.workKind)?.label}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={busy}
                className="text-caption text-cream-dim hover:text-error"
              >
                удалить
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addItem} className="mt-4 flex flex-wrap gap-3">
        <input
          value={itemTitle}
          onChange={(e) => setItemTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Что за объект"
          className={`${inputClass} flex-1 min-w-48`}
        />
        <select
          value={itemKind}
          onChange={(e) => setItemKind(e.target.value)}
          className={`${inputClass} max-w-40`}
        >
          <option value="">вид работ</option>
          {WORK_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={itemUrl}
          onChange={(e) => setItemUrl(e.target.value)}
          placeholder="Ссылка на фото (необязательно)"
          className={`${inputClass} flex-1 min-w-48`}
        />
        <Button variant="secondary" type="submit" disabled={busy || !itemTitle.trim()}>
          Добавить
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-error/40 px-4 py-3 text-body-s text-error">
          {error}
        </p>
      )}
    </section>
  );
}

const inputClass =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-body-s text-cream-bright " +
  "placeholder:text-cream-dim focus:border-cream-dim focus:outline-none";
