/**
 * Server-only environment access.
 *
 * Nothing here is NEXT_PUBLIC_*, so none of it reaches the browser bundle.
 * Reads are lazy and never echo a value back in an error message — a thrown
 * error says which variable is missing, never what it contains.
 */

import "server-only";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Throws if the variable is absent. Message contains the name only. */
function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new MissingEnvError(name);
  }
  return value;
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = "MissingEnvError";
  }
}

export const env = {
  /** Postgres connection string. Required by every request that touches the DB. */
  databaseUrl: () => requireEnv("DATABASE_URL"),

  /** OpenAI key. Required only by the chat route. */
  openaiApiKey: () => requireEnv("OPENAI_API_KEY"),

  /** Chat model. Cheap + fast default, overridable without a code change. */
  openaiModel: () => read("OPENAI_MODEL") ?? "gpt-4o-mini",

  /** Speech-to-text model, for browsers with no SpeechRecognition of their own. */
  openaiTranscribeModel: () => read("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe",

  /** Text-to-speech model. Warmer than any built-in OS voice. */
  openaiTtsModel: () => read("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts",

  /**
   * Which voice Asha speaks with. `coral` is warm and unhurried; `alloy` and
   * `shimmer` are the other two that hold up at a slow speaking rate.
   */
  openaiTtsVoice: () => read("OPENAI_TTS_VOICE") ?? "coral",

  /** Family webhook. Optional by design — absence means "simulate", not "fail". */
  familyWebhookUrl: () => read("FAMILY_WEBHOOK_URL"),

  isProduction: () => process.env.NODE_ENV === "production",
} as const;
