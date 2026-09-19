"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Check, MessageCircleHeart } from "lucide-react";
import { useState } from "react";

import { useElderCare } from "./providers/ElderCareProvider";
import { BigButton } from "./ui/BigButton";
import { WebhookPill } from "./ui/StatusPill";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import type { Alert, Mood } from "@/lib/types";

/**
 * The daily well-being check-in.
 *
 * Three faces, one tap. Choosing "Not Feeling Well" records a wellness report
 * and notifies the family immediately, then invites the senior to say more in
 * their own words — which is where the richer detail comes from.
 */

interface WellnessCheckProps {
  /** Opens the conversation panel — "Talk About It". */
  onTalkAboutIt?: () => void;
  className?: string;
}

const OPTIONS: { mood: Mood; emoji: string; label: string; classes: string; activeClasses: string }[] = [
  {
    mood: "good",
    emoji: "😊",
    label: "Good",
    classes: "border-calm-300 bg-white hover:bg-calm-50 text-calm-900",
    activeClasses: "border-calm-700 bg-calm-600 text-white",
  },
  {
    mood: "okay",
    emoji: "😐",
    label: "Okay",
    classes: "border-warm-300 bg-white hover:bg-warm-50 text-warm-900",
    activeClasses: "border-warm-600 bg-warm-400 text-warm-900",
  },
  {
    mood: "unwell",
    emoji: "😟",
    label: "Not Feeling Well",
    classes: "border-care-300 bg-white hover:bg-care-50 text-care-900",
    activeClasses: "border-care-700 bg-care-600 text-white",
  },
];

export function WellnessCheck({ onTalkAboutIt, className }: WellnessCheckProps) {
  const { submitMood, senior } = useElderCare();

  const [selected, setSelected] = useState<Mood | null>(null);
  const [saving, setSaving] = useState<Mood | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(mood: Mood) {
    if (saving) return;
    setSaving(mood);
    setError(null);

    try {
      const result = await submitMood(mood);
      setSelected(mood);
      setReply(result.reply.text);
      setAlert(result.alert ?? null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "We couldn't save that. Please try once more.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className={cn("", className)} aria-labelledby="wellness-check-heading">
      <h2 id="wellness-check-heading" className="text-2xl font-bold text-ink-900 sm:text-3xl">
        How are you feeling today?
      </h2>
      <p className="mt-2 text-lg text-ink-600">Tap the face that matches how you feel.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {OPTIONS.map((option) => {
          const isSelected = selected === option.mood;
          const isSaving = saving === option.mood;

          return (
            <button
              key={option.mood}
              type="button"
              onClick={() => void choose(option.mood)}
              disabled={Boolean(saving)}
              aria-pressed={isSelected}
              className={cn(
                "flex min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-4xl border-2 p-4 transition-all",
                "shadow-soft active:translate-y-px disabled:cursor-not-allowed",
                isSelected ? option.activeClasses : option.classes,
                saving && !isSaving && "opacity-60",
              )}
            >
              <span className="text-5xl leading-none" aria-hidden="true">
                {option.emoji}
              </span>
              <span className="flex items-center gap-2 text-center text-xl font-bold">
                {option.label}
                {isSelected ? <Check size={22} strokeWidth={3} aria-hidden="true" /> : null}
              </span>
              {isSaving ? <span className="text-base font-medium">Saving…</span> : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-2xl bg-care-50 p-4 text-lg font-semibold text-care-800">
          {error}
        </p>
      ) : null}

      <AnimatePresence>
        {reply ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-3xl border-2 border-calm-200 bg-calm-50 p-5"
            role="status"
          >
            <p className="text-lg text-calm-900 sm:text-xl">{reply}</p>

            {alert ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/80 p-3">
                <BellRing className="shrink-0 text-warm-700" size={22} aria-hidden="true" />
                <span className="text-base font-semibold text-ink-800">
                  {senior.data?.familyContact.name ?? "Your family"} notified at{" "}
                  {formatTimestamp(alert.createdAt)}
                </span>
                <WebhookPill status={alert.webhook.status} />
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {onTalkAboutIt ? (
        <BigButton
          onClick={onTalkAboutIt}
          variant="secondary"
          size="lg"
          fullWidth
          className="mt-5"
          icon={<MessageCircleHeart size={26} />}
        >
          Talk About It
        </BigButton>
      ) : null}
    </section>
  );
}
