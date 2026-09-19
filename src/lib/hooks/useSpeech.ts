"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Thin wrappers around the browser's built-in speech APIs.
 *
 * Both degrade gracefully: if the browser has no support the hook reports
 * `supported: false` and the UI hides or disables the control rather than
 * offering something broken.
 */

/* ----------------------------------------------------- speech recognition */

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  /** Live transcript while the senior is speaking. */
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(options: {
  lang?: string;
  /** Fired once the senior stops speaking, with the final transcript. */
  onFinalResult?: (text: string) => void;
} = {}): UseSpeechRecognitionResult {
  const { lang = "en-IN", onFinalResult } = options;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const onFinalResultRef = useRef(onFinalResult);
  // Kept current in an effect, not during render — a ref is not render output.
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  });

  useEffect(() => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;

    // Browser capability detection has to happen after mount: the server has no
    // SpeechRecognition, so deciding this during render would mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setSupported(true);
    const recognition = new Constructor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current += text;
        else interim += text;
      }
      setTranscript((finalRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      const code = (event as Event & { error?: string }).error;
      setError(
        code === "not-allowed"
          ? "Microphone access was blocked. You can type your message instead."
          : "We couldn't hear that. Please try again or type your message.",
      );
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      const finalText = finalRef.current.trim();
      if (finalText) onFinalResultRef.current?.(finalText);
      finalRef.current = "";
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    setError(null);
    setTranscript("");
    finalRef.current = "";
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      setError("The microphone is already in use.");
    }
  }, [listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}

/* ------------------------------------------------------- speech synthesis */

export interface UseSpeechSynthesisResult {
  supported: boolean;
  speaking: boolean;
  speak: (text: string) => void;
  cancel: () => void;
}

export function useSpeechSynthesis(enabled = true): UseSpeechSynthesisResult {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    // Same reason as above: capability detection belongs after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Stop any in-flight narration when the component unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Slightly slower and warmer than default — easier for seniors to follow.
      utterance.rate = 0.92;
      utterance.pitch = 1.02;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [enabled],
  );

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  // Memoised so callers can safely list the result in effect dependencies.
  return useMemo(
    () => ({ supported, speaking, speak, cancel }),
    [supported, speaking, speak, cancel],
  );
}
