"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, CircleCheckBig, Pause, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { VirtualCompanion } from "@/components/VirtualCompanion";
import { useElderCare } from "@/components/providers/ElderCareProvider";
import { BigButton, BigLinkButton } from "@/components/ui/BigButton";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useSpeechSynthesis } from "@/lib/hooks/useSpeech";

/**
 * Guided meditation.
 *
 * A breathing cycle the senior can simply follow — a growing circle to breathe
 * in with, a shrinking one to breathe out with, and one short instruction on
 * screen at a time. Completion is saved locally and synced to the backend.
 */

interface BreathPhase {
  label: string;
  seconds: number;
  scale: number;
}

const BREATH_CYCLE: BreathPhase[] = [
  { label: "Take a slow breath in.", seconds: 4, scale: 1 },
  { label: "Hold it gently.", seconds: 2, scale: 1 },
  { label: "Breathe out slowly.", seconds: 6, scale: 0.62 },
];

const CYCLE_SECONDS = BREATH_CYCLE.reduce((total, phase) => total + phase.seconds, 0);

type SessionState = "ready" | "running" | "paused" | "finished";

/** Which breath instruction belongs to a given second of the session. */
function breathPhaseAt(elapsed: number): { phase: BreathPhase; phaseIndex: number } {
  let cursor = elapsed % CYCLE_SECONDS;
  for (let index = 0; index < BREATH_CYCLE.length; index += 1) {
    const candidate = BREATH_CYCLE[index];
    if (cursor < candidate.seconds) return { phase: candidate, phaseIndex: index };
    cursor -= candidate.seconds;
  }
  return { phase: BREATH_CYCLE[0], phaseIndex: 0 };
}

export default function MeditationPage() {
  const { senior, finishMeditation, meditationDoneToday, preferences } = useElderCare();
  const speech = useSpeechSynthesis(preferences.voiceEnabled);

  const plannedMinutes = senior.data?.preferences.meditationDurationMinutes ?? 10;
  const totalSeconds = plannedMinutes * 60;

  const [state, setState] = useState<SessionState>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, totalSeconds - elapsed);

  // The clock only advances while running.
  useEffect(() => {
    if (state !== "running") return;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  // Arithmetic over three constants — cheaper to recompute than to memoise.
  const { phase, phaseIndex } = breathPhaseAt(elapsed);

  const complete = useCallback(
    async (secondsDone: number) => {
      setState("finished");
      speech.cancel();
      setSaving(true);
      const minutes = Math.max(1, Math.round(secondsDone / 60));
      await finishMeditation(minutes);
      setSaving(false);
    },
    [finishMeditation, speech],
  );

  // Ends on its own when the full session has been sat through. The timer
  // running out is an external event, and this is where we react to it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    if (state === "running" && remaining === 0) void complete(totalSeconds);
  }, [state, remaining, complete, totalSeconds]);

  // Speak each new instruction once, gently.
  const lastSpokenPhase = useRef<number | null>(null);
  useEffect(() => {
    if (state !== "running" || !preferences.voiceEnabled) return;
    if (lastSpokenPhase.current === phaseIndex) return;
    lastSpokenPhase.current = phaseIndex;
    speech.speak(phase.label);
  }, [state, phaseIndex, phase.label, preferences.voiceEnabled, speech]);

  const progress = totalSeconds === 0 ? 0 : Math.min(1, elapsed / totalSeconds);
  const minutesDone = Math.max(1, Math.round(elapsed / 60));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/senior"
        className="inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-lg font-semibold text-ink-700 hover:text-calm-700"
      >
        <ArrowLeft size={22} aria-hidden="true" />
        Back to home
      </Link>

      <Card tone="senior" padding="lg" className="mt-4 overflow-hidden">
        <AnimatePresence mode="wait">
          {state === "finished" ? (
            /* ------------------------------------------------ completion */
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-6 text-center"
            >
              <motion.span
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 14 }}
                className="grid size-24 place-items-center rounded-full bg-calm-100 text-calm-700"
              >
                <CircleCheckBig size={56} aria-hidden="true" />
              </motion.span>

              <h1 className="mt-6 text-3xl font-bold text-ink-900 sm:text-4xl">Well done, {senior.data?.firstName ?? "Rajesh"}.</h1>
              <p className="mt-3 max-w-lg text-balance text-xl text-ink-600">
                You meditated for {minutesDone} {minutesDone === 1 ? "minute" : "minutes"}. Your
                schedule is updated and your family can see you completed it.
              </p>

              <p
                className="mt-5 inline-flex items-center gap-2 rounded-full border-2 border-calm-300 bg-calm-50 px-5 py-2.5 text-lg font-bold text-calm-800"
                aria-live="polite"
              >
                <Check size={22} strokeWidth={3} aria-hidden="true" />
                {saving ? "Saving…" : "Meditation completed"}
              </p>

              <div className="mt-8 grid w-full gap-4 sm:max-w-md sm:grid-cols-2">
                <BigLinkButton href="/senior" size="lg" fullWidth>
                  Back to Home
                </BigLinkButton>
                <BigButton
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => {
                    setElapsed(0);
                    lastSpokenPhase.current = null;
                    setState("ready");
                  }}
                >
                  Do it again
                </BigButton>
              </div>
            </motion.div>
          ) : (
            /* --------------------------------------------------- session */
            <motion.div key="session" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="text-center">
                <p className="inline-flex items-center gap-2 rounded-full bg-warm-100 px-4 py-1.5 text-base font-bold uppercase tracking-wide text-warm-800">
                  <Sparkles size={18} aria-hidden="true" />
                  Guided by Asha
                </p>
                <h1 className="mt-3 text-3xl font-bold text-ink-900 sm:text-4xl">Morning Meditation</h1>
                {meditationDoneToday ? (
                  <p className="mt-2 text-lg font-semibold text-calm-700">
                    You&rsquo;ve already completed today&rsquo;s session — you&rsquo;re welcome to sit again.
                  </p>
                ) : (
                  <p className="mt-2 text-lg text-ink-600">
                    {plannedMinutes} calm minutes. Sit comfortably and follow my voice.
                  </p>
                )}
              </div>

              {/* Timer + breathing circle */}
              <div className="mt-8 flex flex-col items-center">
                <div className="relative grid size-72 place-items-center sm:size-80">
                  <BreathingOrb
                    scale={phase.scale}
                    seconds={phase.seconds}
                    active={state === "running"}
                  />
                  <ProgressRing progress={progress} />

                  <div className="relative z-10 text-center">
                    <p
                      className="text-6xl font-bold tabular-nums text-ink-900 sm:text-7xl"
                      aria-label={`${Math.ceil(remaining / 60)} minutes remaining`}
                    >
                      {formatDuration(remaining)}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-ink-500">
                      {state === "running" ? "remaining" : state === "paused" ? "paused" : "ready"}
                    </p>
                  </div>
                </div>

                {/* Instruction */}
                <div className="mt-8 min-h-20 text-center" aria-live="polite">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={state === "running" ? phase.label : state}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                      className="text-balance text-3xl font-semibold text-calm-800 sm:text-4xl"
                    >
                      {state === "running"
                        ? phase.label
                        : state === "paused"
                          ? "Take your time. Press Start when you're ready."
                          : "When you're ready, press Start."}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <div className="mt-2 flex items-center justify-center gap-2" aria-hidden="true">
                  {BREATH_CYCLE.map((item, index) => (
                    <span
                      key={item.label}
                      className={cn(
                        "h-2.5 rounded-full transition-all duration-500",
                        state === "running" && index === phaseIndex
                          ? "w-10 bg-calm-600"
                          : "w-2.5 bg-ink-300",
                      )}
                    />
                  ))}
                </div>

                <div className="mt-8">
                  <VirtualCompanion
                    state={state === "running" ? "speaking" : "idle"}
                    companionName="Asha"
                    size="md"
                  />
                </div>

                {/* Controls */}
                <div className="mt-8 grid w-full gap-4 sm:max-w-2xl sm:grid-cols-3">
                  <BigButton
                    size="lg"
                    fullWidth
                    onClick={() => setState("running")}
                    disabled={state === "running"}
                    icon={<Play size={26} />}
                  >
                    Start
                  </BigButton>
                  <BigButton
                    size="lg"
                    variant="secondary"
                    fullWidth
                    onClick={() => setState("paused")}
                    disabled={state !== "running"}
                    icon={<Pause size={26} />}
                  >
                    Pause
                  </BigButton>
                  <BigButton
                    size="lg"
                    variant="warm"
                    fullWidth
                    onClick={() => void complete(elapsed)}
                    disabled={elapsed === 0}
                    icon={<Check size={26} />}
                  >
                    Finish
                  </BigButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- visuals */

/** A soft circle that grows on the in-breath and settles on the out-breath. */
function BreathingOrb({
  scale,
  seconds,
  active,
}: {
  scale: number;
  seconds: number;
  active: boolean;
}) {
  return (
    <>
      <motion.div
        aria-hidden="true"
        className="absolute size-56 rounded-full bg-gradient-to-br from-calm-200 via-calm-100 to-warm-100 blur-md sm:size-64"
        animate={{ scale: active ? scale : 0.82, opacity: active ? 0.95 : 0.6 }}
        transition={{ duration: active ? seconds : 1.2, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute size-44 rounded-full border-4 border-calm-300/70 sm:size-52"
        animate={{ scale: active ? scale * 1.06 : 0.85, opacity: active ? 0.8 : 0.4 }}
        transition={{ duration: active ? seconds : 1.2, ease: "easeInOut" }}
      />
    </>
  );
}

/** Thin ring showing how much of the session is done. */
function ProgressRing({ progress }: { progress: number }) {
  const radius = 140;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      viewBox="0 0 300 300"
      className="absolute size-full -rotate-90"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="150" cy="150" r={radius} fill="none" stroke="#e7e3dc" strokeWidth="8" />
      <motion.circle
        cx="150"
        cy="150"
        r={radius}
        fill="none"
        stroke="#0b8677"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset: circumference * (1 - progress) }}
        transition={{ duration: 0.8, ease: "linear" }}
      />
    </svg>
  );
}
