"use client";

import { AnimatePresence, motion } from "motion/react";
import { EDUCATION_CARDS } from "@/lib/3d/education";
import { useAppStore } from "@/lib/store";

export function EducationCardPanel() {
  const activeId = useAppStore((s) => s.activeEducationCardId);
  const dismiss = useAppStore((s) => s.dismissEducationCard);
  const card = EDUCATION_CARDS.find((c) => c.id === activeId);

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          className="rounded-xl border border-line bg-surface p-4"
          role="note"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-caption font-medium uppercase text-cream-dim">
              {card.tag}
            </span>
            <button
              type="button"
              onClick={() => dismiss(card.id)}
              aria-label="Скрыть подсказку"
              className="text-cream-dim transition-colors hover:text-cream-bright"
            >
              ✕
            </button>
          </div>
          <h4 className="font-display mt-2 text-h3 font-medium text-cream-bright">
            {card.title}
          </h4>
          <p className="mt-2 text-body-s text-cream-dim">{card.body}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
