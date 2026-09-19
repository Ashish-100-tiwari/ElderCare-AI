"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BellRing, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useElderCare } from "./providers/ElderCareProvider";
import { WebhookPill } from "./ui/StatusPill";
import { BigButton } from "./ui/BigButton";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { cacheConversation, getCachedConversation } from "@/lib/localStorage";
import { useVoiceInput, useVoiceOutput } from "@/lib/hooks/useVoice";
import type { CompanionState } from "@/lib/avatar/types";
import type { Alert, ConversationMessage } from "@/lib/types";

/**
 * Voice + text conversation with the companion.
 *
 * Handles the states the demo needs to show: the senior typing or speaking,
 * the companion thinking, the companion speaking, and the moment a report of
 * discomfort escalates to the family.
 */

interface ConversationPanelProps {
  /** Lets the parent drive the avatar with the same state machine. */
  onStateChange?: (state: CompanionState) => void;
  /** Called with each new companion line, for live-avatar lip sync. */
  onCompanionLine?: (text: string) => void;
  /** Opening line shown before the senior says anything. */
  greeting?: string;
  autoFocus?: boolean;
  className?: string;
}

const QUICK_REPLIES = [
  "I am feeling good today",
  "My leg feels uncomfortable",
  "What is next on my schedule?",
  "I feel a little lonely",
];

export function ConversationPanel({
  onStateChange,
  onCompanionLine,
  greeting = "Hello Rajesh. How are you feeling today? You can type, or press the microphone and just talk to me.",
  autoFocus = false,
  className,
}: ConversationPanelProps) {
  const { sendCompanionMessage, preferences, updatePreferences, senior } = useElderCare();

  const greetingMessage = useMemo<ConversationMessage>(
    () => ({ id: "greeting", role: "companion", text: greeting, createdAt: new Date().toISOString() }),
    [greeting],
  );

  const [messages, setMessages] = useState<ConversationMessage[]>([greetingMessage]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const speech = useVoiceOutput(preferences.voiceEnabled);

  // Restore this session's chat so a reload mid-demo doesn't lose context.
  useEffect(() => {
    const cached = getCachedConversation();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is a browser-only store; reading it during render would break hydration
    if (cached.length > 0) setMessages([greetingMessage, ...cached]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once
  }, []);

  useEffect(() => {
    cacheConversation(messages.filter((message) => message.id !== "greeting"));
  }, [messages]);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = useCallback(
    async (text: string, source: "text" | "voice" = "text") => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      setDraft("");
      setSendError(null);
      setMessages((current) => [
        ...current,
        {
          id: `local_${Date.now()}`,
          role: "senior",
          text: trimmed,
          createdAt: new Date().toISOString(),
        },
      ]);
      setThinking(true);

      try {
        const result = await sendCompanionMessage(trimmed, source);
        setMessages((current) => [
          // Replace our optimistic copy with the server's stored message.
          ...current.slice(0, -1),
          result.message,
          result.reply,
        ]);
        if (result.alert) setLatestAlert(result.alert);
        if (preferences.voiceEnabled) speech.speak(result.reply.text);
        onCompanionLine?.(result.reply.text);
      } catch (error) {
        setSendError(
          error instanceof Error
            ? error.message
            : "We couldn't send your message. Please try again.",
        );
      } finally {
        setThinking(false);
        inputRef.current?.focus();
      }
    },
    [thinking, sendCompanionMessage, preferences.voiceEnabled, speech, onCompanionLine],
  );

  const speaksHindi = senior.data?.language === "Hindi";
  const recognition = useVoiceInput({
    lang: speaksHindi ? "hi-IN" : "en-IN",
    language: speaksHindi ? "hi" : "en",
    onFinalResult: (text) => void send(text, "voice"),
  });

  // Surface one combined state to the avatar. Transcribing and preparing speech
  // are both "thinking" as far as the senior is concerned — something is
  // happening and it isn't their turn.
  const companionState: CompanionState = thinking || recognition.transcribing || speech.preparing
    ? "thinking"
    : recognition.listening
      ? "listening"
      : speech.speaking
        ? "speaking"
        : "idle";

  useEffect(() => {
    onStateChange?.(companionState);
  }, [companionState, onStateChange]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const micBusy = recognition.listening;
  /** Any voice work in flight — the mic must not be re-armed mid-transcription. */
  const voiceBusy = recognition.listening || recognition.transcribing;
  /**
   * The server path returns nothing until the senior stops talking, so it needs
   * an explicit "press stop when you're done" rather than a live transcript.
   */
  const needsStopHint = recognition.mode === "server" && recognition.listening;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* ------------------------------------------------------- history */}
      <div
        ref={listRef}
        className="scrollbar-slim min-h-56 flex-1 space-y-4 overflow-y-auto px-1 pb-2"
        role="log"
        aria-live="polite"
        aria-label="Conversation with your companion"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <AnimatePresence>
          {thinking ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <CompanionBadge />
              <span className="inline-flex items-center gap-2 rounded-3xl rounded-bl-lg border-2 border-ink-200 bg-white px-5 py-4">
                <TypingDots />
                <span className="sr-only">Your companion is thinking</span>
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {latestAlert ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border-2 border-warm-400 bg-warm-50 p-4 sm:p-5"
              role="status"
            >
              <div className="flex items-start gap-3">
                <BellRing className="mt-0.5 shrink-0 text-warm-700" size={26} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-warm-900 sm:text-xl">
                    Your family has been notified
                  </p>
                  <p className="mt-1 text-base text-warm-800 sm:text-lg">
                    {senior.data?.familyContact.name ?? "Your family member"} received a message about
                    what you told me at {formatTimestamp(latestAlert.createdAt)}.
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-warm-800">
                    <span className="font-semibold">Notification</span>
                    <WebhookPill status={latestAlert.webhook.status} />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* --------------------------------------------------------- errors */}
      {sendError ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-2xl border-2 border-care-300 bg-care-50 p-4"
        >
          <AlertTriangle className="mt-0.5 shrink-0 text-care-600" size={22} aria-hidden="true" />
          <div>
            <p className="font-semibold text-care-900">{sendError}</p>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="mt-1 text-base font-semibold text-care-700 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {recognition.error ? (
        <p role="alert" className="mt-3 rounded-2xl bg-care-50 p-3 text-base font-medium text-care-800">
          {recognition.error}
        </p>
      ) : null}

      {needsStopHint ? (
        <p className="mt-3 rounded-2xl bg-calm-50 p-3 text-base font-medium text-calm-800" aria-live="polite">
          I&apos;m recording. Press the red button again when you&apos;ve finished speaking.
        </p>
      ) : null}

      {/* -------------------------------------------------- quick replies */}
      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            type="button"
            disabled={thinking}
            onClick={() => void send(reply, "text")}
            className="rounded-full border-2 border-calm-200 bg-calm-50 px-4 py-2.5 text-base font-semibold text-calm-800 transition-colors hover:border-calm-400 hover:bg-calm-100 disabled:opacity-50"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------ composer */}
      <form
        className="mt-4 flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="companion-input" className="sr-only">
          Type your message to your companion
        </label>
        <textarea
          id="companion-input"
          ref={inputRef}
          rows={1}
          value={micBusy && recognition.transcript ? recognition.transcript : draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
          placeholder={
            recognition.transcribing
              ? "Writing down what you said…"
              : micBusy
                ? "Listening…"
                : "Type here…"
          }
          readOnly={voiceBusy}
          className="min-h-16 flex-1 resize-none rounded-3xl border-2 border-ink-300 bg-white px-5 py-4 text-xl text-ink-900 placeholder:text-ink-400 focus:border-calm-500"
        />

        <button
          type="button"
          onClick={() => (micBusy ? recognition.stop() : recognition.start())}
          disabled={!recognition.supported || thinking || recognition.transcribing}
          aria-pressed={micBusy}
          aria-label={micBusy ? "Stop listening" : "Speak to your companion"}
          title={
            recognition.supported
              ? micBusy
                ? "Stop listening"
                : "Press and speak"
              : "Voice input isn't available in this browser — please type instead"
          }
          className={cn(
            "grid size-16 shrink-0 place-items-center rounded-full border-2 transition-all",
            micBusy
              ? "border-care-700 bg-care-600 text-white"
              : "border-calm-300 bg-white text-calm-700 hover:bg-calm-50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {micBusy ? (
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="grid place-items-center"
            >
              <MicOff size={28} aria-hidden="true" />
            </motion.span>
          ) : recognition.supported ? (
            <Mic size={28} aria-hidden="true" />
          ) : (
            <MicOff size={28} aria-hidden="true" />
          )}
        </button>

        <BigButton
          type="submit"
          size="lg"
          disabled={thinking || voiceBusy || !draft.trim()}
          icon={<Send size={24} />}
          className="shrink-0"
        >
          Send
        </BigButton>
      </form>

      {/* ------------------------------------------------ voice preference */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            const next = !preferences.voiceEnabled;
            updatePreferences({ voiceEnabled: next });
            if (!next) speech.cancel();
          }}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-base font-semibold text-ink-700 hover:bg-ink-100"
          aria-pressed={preferences.voiceEnabled}
        >
          {preferences.voiceEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          {preferences.voiceEnabled ? "Voice replies on" : "Voice replies off"}
        </button>

        {speech.speaking ? (
          <button
            type="button"
            onClick={speech.cancel}
            className="text-base font-semibold text-calm-700 underline"
          >
            Stop speaking
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function MessageBubble({ message }: { message: ConversationMessage }) {
  const fromSenior = message.role === "senior";
  const flagged = message.signals?.discomfort;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex items-end gap-3", fromSenior && "flex-row-reverse")}
    >
      {fromSenior ? (
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink-800 text-base font-bold text-white"
          aria-hidden="true"
        >
          You
        </span>
      ) : (
        <CompanionBadge />
      )}

      <div
        className={cn(
          "max-w-[min(34rem,85%)] rounded-3xl border-2 px-5 py-4 text-xl leading-relaxed",
          fromSenior
            ? "rounded-br-lg border-calm-700 bg-calm-600 text-white"
            : "rounded-bl-lg border-ink-200 bg-white text-ink-900",
          flagged && "ring-4 ring-warm-300",
        )}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        <p className={cn("mt-1.5 text-sm", fromSenior ? "text-calm-100" : "text-ink-500")}>
          {formatTimestamp(message.createdAt)}
        </p>
      </div>
    </motion.div>
  );
}

function CompanionBadge() {
  return (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-calm-300 to-calm-600 text-base font-bold text-white"
      aria-hidden="true"
    >
      A
    </span>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 0.18, 0.36].map((delay) => (
        <motion.span
          key={delay}
          className="size-2.5 rounded-full bg-calm-500"
          animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay }}
        />
      ))}
    </span>
  );
}
