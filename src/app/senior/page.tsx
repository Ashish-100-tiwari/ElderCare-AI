"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MessageCircle, Sparkles, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConversationPanel } from "@/components/ConversationPanel";
import { DailySchedule } from "@/components/DailySchedule";
import { VirtualCompanion } from "@/components/VirtualCompanion";
import { WellnessCheck } from "@/components/WellnessCheck";
import { useElderCare } from "@/components/providers/ElderCareProvider";
import { BigButton, BigLinkButton } from "@/components/ui/BigButton";
import { Card, CardHeader } from "@/components/ui/Card";
import type { CompanionState } from "@/lib/avatar/types";
import { formatClock, greetingForHour } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { useVoiceOutput } from "@/lib/hooks/useVoice";
import { istHour } from "@/lib/timezone";

export default function SeniorDashboardPage() {
  const { senior, schedule, setScheduleStatus, meditationDoneToday, preferences } = useElderCare();
  const now = useNow(60_000);

  const [companionState, setCompanionState] = useState<CompanionState>("idle");
  const [talking, setTalking] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const speech = useVoiceOutput(preferences.voiceEnabled);
  const hasGreeted = useRef(false);

  const firstName = senior.data?.firstName ?? "Rajesh";

  /** The companion's opening line — reacts to what's actually next today. */
  const companionMessage = useMemo(() => {
    const greeting = now ? greetingForHour(istHour(now)) : "Good Morning";
    const nextItem = schedule.data?.find((item) => item.status !== "completed");

    if (!nextItem) {
      return `${greeting} ${firstName}. You have finished everything on your plan today. I'm proud of you.`;
    }
    if (nextItem.id === "sch_meditation") {
      return `${greeting} ${firstName}.\nIt's time for your morning meditation.`;
    }
    return `${greeting} ${firstName}.\nNext up is your ${nextItem.title.toLowerCase()} at ${formatClock(
      nextItem.time,
    )}.`;
  }, [now, schedule.data, firstName]);

  // Greet once, out loud, the way a companion would. Reading the message and
  // speak function from refs keeps this to a single utterance per visit.
  const greetRef = useRef({ speak: speech.speak, message: companionMessage });
  // Updated in an effect, which runs before the greeting effect below.
  useEffect(() => {
    greetRef.current = { speak: speech.speak, message: companionMessage };
  });
  const seniorLoaded = Boolean(senior.data);

  useEffect(() => {
    if (hasGreeted.current || !seniorLoaded || !preferences.voiceEnabled) return;
    hasGreeted.current = true;
    const timer = window.setTimeout(
      () => greetRef.current.speak(greetRef.current.message.replace(/\n/g, " ")),
      900,
    );
    return () => window.clearTimeout(timer);
  }, [seniorLoaded, preferences.voiceEnabled]);

  const openConversation = useCallback(() => {
    setTalking(true);
    // Let the panel mount before scrolling to it.
    window.setTimeout(
      () => conversationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      120,
    );
  }, []);

  const avatarState: CompanionState = talking
    ? companionState
    : speech.preparing
      ? "thinking"
      : speech.speaking
        ? "speaking"
        : companionState;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ------------------------------------------------ virtual human */}
        <Card
          tone="senior"
          padding="lg"
          className="animate-rise-in bg-gradient-to-b from-white to-calm-50/40 lg:col-span-7"
        >
          <div className="flex flex-col items-center">
            <VirtualCompanion state={avatarState} companionName="Asha" size="lg" />

            <div className="mt-6 w-full rounded-4xl border-2 border-calm-200 bg-calm-50/80 bg-gradient-to-br from-white via-calm-50 to-calm-100/70 p-5 shadow-soft sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <p className="whitespace-pre-line text-balance text-2xl font-semibold leading-snug tracking-tight text-ink-900 sm:text-3xl">
                  {companionMessage}
                </p>
                <button
                  type="button"
                  onClick={() => speech.speak(companionMessage.replace(/\n/g, " "))}
                  disabled={!speech.supported}
                  className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-calm-300 bg-white text-calm-700 shadow-soft transition-all hover:border-calm-500 hover:bg-calm-100 active:translate-y-px disabled:opacity-40 disabled:shadow-none"
                  aria-label="Read this message aloud"
                  title="Read aloud"
                >
                  <Volume2 size={24} aria-hidden="true" />
                </button>
              </div>

              {meditationDoneToday ? (
                <p className="animate-rise-in mt-4 inline-flex items-center gap-2 rounded-full border border-calm-200 bg-white/80 px-3.5 py-1.5 text-lg font-semibold text-calm-700">
                  <Sparkles size={20} aria-hidden="true" />
                  Meditation completed today. Well done.
                </p>
              ) : null}
            </div>

            {/* Three large, unmistakable actions */}
            <div className="mt-6 grid w-full gap-4 sm:grid-cols-3">
              <BigButton
                size="xl"
                onClick={openConversation}
                icon={<MessageCircle size={30} />}
                fullWidth
                className="sm:min-h-[6.5rem] sm:flex-col sm:gap-2 sm:px-4 sm:text-xl hover:-translate-y-0.5 hover:shadow-lift"
              >
                Talk to Me
              </BigButton>

              <BigLinkButton
                href="/senior/meditation"
                size="xl"
                variant="warm"
                icon={<Sparkles size={30} />}
                fullWidth
                className="sm:min-h-[6.5rem] sm:flex-col sm:gap-2 sm:px-4 sm:text-xl hover:-translate-y-0.5 hover:shadow-lift"
              >
                Start Meditation
              </BigLinkButton>

              <BigLinkButton
                href="/senior/schedule"
                size="xl"
                variant="secondary"
                icon={<CalendarDays size={30} />}
                fullWidth
                className="sm:min-h-[6.5rem] sm:flex-col sm:gap-2 sm:px-4 sm:text-xl hover:-translate-y-0.5 hover:shadow-lift"
              >
                My Schedule
              </BigLinkButton>
            </div>
          </div>
        </Card>

        {/* ---------------------------------------------------- schedule */}
        <Card
          tone="senior"
          padding="lg"
          className="animate-rise-in lg:col-span-5 [animation-delay:90ms]"
        >
          <CardHeader
            tone="senior"
            title="Today's Schedule"
            description="Tap an activity once you've finished it."
            icon={<CalendarDays size={26} />}
            action={
              <BigLinkButton href="/senior/schedule" variant="ghost" size="sm" className="text-calm-700">
                See all
              </BigLinkButton>
            }
          />
          <div className="mt-5">
            <DailySchedule
              items={schedule.data}
              status={schedule.status}
              error={schedule.error}
              onRetry={schedule.reload}
              variant="senior"
              limit={5}
              onToggleComplete={(item) => void setScheduleStatus(item.id, "completed")}
            />
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------- wellness check */}
      <Card
        tone="senior"
        padding="lg"
        className="animate-rise-in bg-gradient-to-b from-white to-warm-50/50 [animation-delay:180ms]"
      >
        <WellnessCheck onTalkAboutIt={openConversation} />
      </Card>

      {/* -------------------------------------------------- conversation */}
      <AnimatePresence>
        {talking ? (
          <motion.div
            ref={conversationRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <Card tone="senior" padding="lg" className="shadow-lift">
              <CardHeader
                tone="senior"
                title="Talk to Asha"
                description="Say anything you like — I'm listening."
                icon={<MessageCircle size={26} />}
                action={
                  <button
                    type="button"
                    onClick={() => setTalking(false)}
                    className="grid size-12 place-items-center rounded-full border-2 border-ink-300 bg-white text-ink-700 transition-colors hover:border-ink-400 hover:bg-ink-100"
                    aria-label="Close the conversation"
                  >
                    <X size={24} aria-hidden="true" />
                  </button>
                }
              />
              <div className="mt-5">
                <ConversationPanel
                  autoFocus
                  onStateChange={setCompanionState}
                  greeting={`Hello ${firstName}. How are you feeling today? You can type, or press the microphone and just talk to me.`}
                />
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
