"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { synthesizeSpeech, transcribeAudio } from "@/lib/api";
import { useSpeechRecognition, useSpeechSynthesis } from "@/lib/hooks/useSpeech";

/**
 * Voice input and output with a server-side fallback.
 *
 * Both hooks prefer the browser's own speech APIs — they are free, instant, and
 * stream interim results — and fall back to the OpenAI-backed `/api/bff/voice/*`
 * routes when the browser has nothing to offer. The point of the fallback is
 * reach: `SpeechRecognition` does not exist in Firefox, so without it a senior
 * there gets a microphone button that can never work.
 *
 * Neither hook ever throws. Voice is an enhancement over a working text UI, so
 * every failure degrades a step instead of surfacing an error.
 */

/* -------------------------------------------------------------- voice input */

export type VoiceInputMode = "browser" | "server" | "unavailable";

export interface UseVoiceInputResult {
  supported: boolean;
  listening: boolean;
  /** True while a recorded clip is in flight to the server for transcription. */
  transcribing: boolean;
  /** Live text while speaking (browser mode only — the server path is not streamed). */
  transcript: string;
  error: string | null;
  /** Which path is actually in use, so the UI can set honest expectations. */
  mode: VoiceInputMode;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/** MediaRecorder containers in rough order of transcription friendliness. */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function recorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Record-then-upload speech input.
 *
 * Unlike the browser's recogniser this has no interim results: the senior speaks,
 * presses stop, and the text arrives a moment later. `transcribing` exists so the
 * UI can say so rather than looking frozen.
 */
function useRecordedVoiceInput(options: {
  language?: string;
  onFinalResult?: (text: string) => void;
  enabled: boolean;
}): UseVoiceInputResult {
  const { language, onFinalResult, enabled } = options;

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const onFinalResultRef = useRef(onFinalResult);
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  });

  useEffect(() => {
    // Capability detection after mount: the server has no MediaRecorder, so
    // deciding this during render would mismatch on hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setSupported(enabled && recorderSupported());
  }, [enabled]);

  /** Releases the microphone. Leaving it open lights the browser's mic indicator. */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  const start = useCallback(() => {
    if (!enabled || listening || transcribing || !recorderSupported()) return;

    setError(null);
    chunksRef.current = [];

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (cause) {
        // NotAllowedError is a declined permission prompt; anything else means
        // there is no usable capture device.
        const denied = cause instanceof Error && cause.name === "NotAllowedError";
        setError(
          denied
            ? "Microphone access was blocked. You can type your message instead."
            : "We couldn't reach a microphone. You can type your message instead.",
        );
        return;
      }

      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("We couldn't record that. Please try again or type your message.");
        setListening(false);
        releaseStream();
      };

      recorder.onstop = () => {
        releaseStream();
        setListening(false);

        const clip = new Blob(chunksRef.current, {
          type: mimeType ?? chunksRef.current[0]?.type ?? "audio/webm",
        });
        chunksRef.current = [];

        // A tap rather than a sentence. Not worth a round trip.
        if (clip.size < 1200) return;

        setTranscribing(true);
        void transcribeAudio(clip, language)
          .then((text) => {
            if (text === null) {
              setError("We couldn't understand that. Please try again or type your message.");
              return;
            }
            const trimmed = text.trim();
            if (trimmed) onFinalResultRef.current?.(trimmed);
            else setError("We didn't catch any words there. Please try again.");
          })
          .finally(() => setTranscribing(false));
      };

      recorder.start();
      setListening(true);
    })();
  }, [enabled, listening, transcribing, language, releaseStream]);

  const stop = useCallback(() => {
    // `onstop` does the rest; calling stop on an inactive recorder throws.
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else setListening(false);
  }, []);

  const reset = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      supported,
      listening,
      transcribing,
      transcript: "",
      error,
      mode: supported ? ("server" as const) : ("unavailable" as const),
      start,
      stop,
      reset,
    }),
    [supported, listening, transcribing, error, start, stop, reset],
  );
}

/**
 * Speech input, whichever way this browser can manage it.
 *
 * Both underlying hooks are always called — hooks cannot be conditional — but
 * neither touches the microphone until `start()`, so the unused one costs
 * nothing.
 */
export function useVoiceInput(options: {
  lang?: string;
  /** ISO-639-1 hint for the server transcriber, e.g. "hi" or "en". */
  language?: string;
  onFinalResult?: (text: string) => void;
} = {}): UseVoiceInputResult {
  const { lang = "en-IN", language, onFinalResult } = options;

  const browser = useSpeechRecognition({ lang, onFinalResult });

  // Only arm the recorder path where the browser recogniser is missing, so a
  // Chrome user never sees a permission prompt they did not need.
  const [browserChecked, setBrowserChecked] = useState(false);
  useEffect(() => {
    // Runs after the recogniser hook's own mount effect has reported support.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ordering, see above
    setBrowserChecked(true);
  }, []);

  const recorded = useRecordedVoiceInput({
    language,
    onFinalResult,
    enabled: browserChecked && !browser.supported,
  });

  return useMemo(() => {
    if (browser.supported) {
      return {
        supported: true,
        listening: browser.listening,
        transcribing: false,
        transcript: browser.transcript,
        error: browser.error,
        mode: "browser" as const,
        start: browser.start,
        stop: browser.stop,
        reset: browser.reset,
      };
    }
    return recorded;
  }, [browser, recorded]);
}

/* ------------------------------------------------------------- voice output */

export interface UseVoiceOutputResult {
  supported: boolean;
  speaking: boolean;
  /** True while waiting on the server to render audio, before playback starts. */
  preparing: boolean;
  speak: (text: string) => void;
  cancel: () => void;
}

/**
 * Speech output, preferring the OpenAI voice.
 *
 * Server synthesis sounds markedly warmer than any OS voice, which for an
 * elder-care companion is the substance rather than the polish. It costs a round
 * trip, so the browser's speechSynthesis stays as the fallback for when the
 * request fails, the key is missing, or autoplay blocks playback.
 */
export function useVoiceOutput(enabled = true): UseVoiceOutputResult {
  const browser = useSpeechSynthesis(enabled);

  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  /** Guards against an earlier, slower request finishing after a newer one. */
  const requestIdRef = useRef(0);

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    releaseAudio();
    browser.cancel();
    setSpeaking(false);
    setPreparing(false);
  }, [browser, releaseAudio]);

  // Never leave audio playing after the panel unmounts.
  useEffect(() => releaseAudio, [releaseAudio]);

  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      const line = text.trim();
      if (!line) return;

      // Supersede anything currently playing or in flight.
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      releaseAudio();
      browser.cancel();
      setSpeaking(false);
      setPreparing(true);

      void synthesizeSpeech(line)
        .then((url) => {
          // A newer line was requested while this one was rendering.
          if (requestId !== requestIdRef.current) {
            if (url) URL.revokeObjectURL(url);
            return;
          }

          if (!url) {
            browser.speak(line);
            return;
          }

          urlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            setSpeaking(false);
            releaseAudio();
          };
          audio.onerror = () => {
            setSpeaking(false);
            releaseAudio();
            browser.speak(line);
          };

          audio.play().then(
            () => setSpeaking(true),
            () => {
              // Autoplay policy, most likely: no user gesture yet. The browser
              // voice is subject to the same rule but fails more quietly.
              releaseAudio();
              browser.speak(line);
            },
          );
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setPreparing(false);
        });
    },
    [enabled, browser, releaseAudio],
  );

  return useMemo(
    () => ({
      // The browser fallback needs no support check of its own: if neither path
      // works, `speak` is simply a no-op and the text is still on screen.
      supported: true,
      speaking: speaking || browser.speaking,
      preparing,
      speak,
      cancel,
    }),
    [speaking, browser.speaking, preparing, speak, cancel],
  );
}
