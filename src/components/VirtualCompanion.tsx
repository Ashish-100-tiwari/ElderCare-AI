"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ear, Loader2, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CompanionFace } from "./companion/CompanionFace";
import { cn } from "@/lib/cn";
import { getAvatarProvider } from "@/lib/avatar/registry";
import type { AvatarSession, CompanionState } from "@/lib/avatar/types";
import { requestAvatarSession } from "@/lib/api";

/**
 * The virtual human companion.
 *
 * Two render paths behind one component:
 *
 *  - **Built-in** (default): the illustrated `CompanionFace`, fully animated
 *    for the idle / listening / thinking / speaking states.
 *  - **Live provider**: if an `AvatarProvider` is registered *and* the server
 *    says one is configured, the provider's video is mounted into
 *    `containerRef` and driven through the same `state` prop.
 *
 * Callers only ever pass `state` and `caption`, so swapping in HeyGen later is
 * a registry call — no page or layout changes.
 */

export interface VirtualCompanionProps {
  state?: CompanionState;
  /** What the companion is currently saying — shown as a caption. */
  caption?: string;
  /** Text to speak through a live provider when one is active. */
  speakText?: string | null;
  companionName?: string;
  size?: "md" | "lg";
  className?: string;
}

const stateCopy: Record<CompanionState, { label: string; icon: typeof Ear }> = {
  idle: { label: "Here with you", icon: Sparkles },
  listening: { label: "Listening…", icon: Ear },
  thinking: { label: "Thinking…", icon: Loader2 },
  speaking: { label: "Speaking", icon: Volume2 },
};

const glowByState: Record<CompanionState, string> = {
  idle: "from-calm-200/60 via-calm-100/40 to-transparent",
  listening: "from-calm-300/70 via-calm-200/50 to-transparent",
  thinking: "from-warm-200/70 via-warm-100/50 to-transparent",
  speaking: "from-calm-300/80 via-calm-200/50 to-transparent",
};

export function VirtualCompanion({
  state = "idle",
  caption,
  speakText,
  companionName = "Asha",
  size = "lg",
  className,
}: VirtualCompanionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<AvatarSession | null>(null);
  const [liveState, setLiveState] = useState<CompanionState | null>(null);
  const [providerActive, setProviderActive] = useState(false);

  // Boot a live avatar only when both a provider and server config exist.
  useEffect(() => {
    const provider = getAvatarProvider();
    if (!provider) return;

    let cancelled = false;
    let disposeStateListener: (() => void) | undefined;

    (async () => {
      try {
        const config = await requestAvatarSession();
        if (cancelled || !config.configured || !config.token) return;

        const session = await provider.createSession({
          token: config.token,
          sessionId: config.sessionId,
          avatarId: config.avatarId,
        });
        if (cancelled) {
          void session.stop();
          return;
        }

        sessionRef.current = session;
        if (containerRef.current) session.attach(containerRef.current);
        disposeStateListener = session.on("statechange", setLiveState);
        setProviderActive(true);
      } catch (error) {
        console.warn("[eldercare] live avatar unavailable, using built-in companion:", error);
      }
    })();

    return () => {
      cancelled = true;
      disposeStateListener?.();
      void sessionRef.current?.stop();
      sessionRef.current = null;
      setProviderActive(false);
    };
  }, []);

  // Forward new companion lines to the live avatar so it lip-syncs them.
  useEffect(() => {
    if (!providerActive || !speakText) return;
    void sessionRef.current?.speak(speakText);
  }, [providerActive, speakText]);

  const effectiveState = providerActive ? (liveState ?? state) : state;
  const { label, icon: StateIcon } = stateCopy[effectiveState];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        className={cn(
          "relative grid place-items-center",
          size === "lg" ? "size-56 sm:size-72 lg:size-80" : "size-40 sm:size-48",
        )}
      >
        {/* Ambient glow reflects the companion's state */}
        <motion.div
          aria-hidden="true"
          className={cn(
            "absolute inset-[-14%] rounded-full bg-gradient-to-br blur-2xl",
            glowByState[effectiveState],
          )}
          animate={{ scale: effectiveState === "idle" ? [1, 1.04, 1] : [1, 1.09, 1] }}
          transition={{ duration: effectiveState === "idle" ? 5 : 2.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Live-provider video mounts here; empty for the built-in companion. */}
        <div
          ref={containerRef}
          className={cn(
            "absolute inset-0 overflow-hidden rounded-full",
            providerActive ? "z-10 ring-4 ring-white" : "pointer-events-none",
          )}
          data-avatar-mount="true"
        />

        {!providerActive ? (
          <CompanionFace state={effectiveState} className="relative size-full drop-shadow-xl" />
        ) : null}
      </div>

      {/* State badge */}
      <div className="mt-5 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={effectiveState}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-full border-2 px-4 py-2 text-base font-semibold",
              effectiveState === "thinking"
                ? "border-warm-400 bg-warm-100 text-warm-800"
                : "border-calm-300 bg-calm-50 text-calm-800",
            )}
          >
            <StateIcon
              size={20}
              aria-hidden="true"
              className={effectiveState === "thinking" ? "animate-spin" : undefined}
            />
            {companionName} · {label}
            {effectiveState === "speaking" ? <SpeakingBars /> : null}
          </motion.span>
        </AnimatePresence>
      </div>

      {caption ? (
        <p
          className="mt-4 max-w-md text-balance text-center text-lg text-ink-700 sm:text-xl"
          aria-live="polite"
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** Three little bars that bounce while the companion talks. */
function SpeakingBars() {
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 0.15, 0.3].map((delay) => (
        <motion.span
          key={delay}
          className="w-1 rounded-full bg-calm-600"
          animate={{ height: [5, 14, 7, 12, 5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
