/**
 * OpenAI access.
 *
 * The only module that holds the API key, and it is server-only, so the key
 * cannot be pulled into a client bundle. Errors are translated into our own
 * types here: nothing from the SDK (which may quote request details) is allowed
 * to reach a route handler and risk being serialised to a client.
 */

import "server-only";

import OpenAI, { APIError } from "openai";
import { WellnessCategory, WellnessSeverity } from "@/generated/prisma";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { sanitizeText } from "@/lib/sanitize";
import { SYSTEM_PROMPT, buildContextMessage } from "@/services/systemPrompt";
import type { SeniorContext } from "@/services/knowledgeBaseService";

/** The companion should feel prompt. Better a graceful failure than a long wait. */
const CHAT_TIMEOUT_MS = 20_000;
const CLASSIFY_TIMEOUT_MS = 8_000;
// Audio round trips carry a payload, so they get more room than a chat call.
const TRANSCRIBE_TIMEOUT_MS = 30_000;
const SPEAK_TIMEOUT_MS = 30_000;

/** Raised when the model cannot be reached. Routes map this to a 503. */
export class AiUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super("AI service is unavailable.");
    this.name = "AiUnavailableError";
  }
}

let client: OpenAI | null = null;

/** Lazy so a missing key only fails the routes that actually need the model. */
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.openaiApiKey(),
      maxRetries: 1,
    });
  }
  return client;
}

/** Turns an SDK error into a short, non-revealing reason string for logs. */
function describeError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.status === 401) return "auth_rejected";
    if (error.status === 429) return "rate_limited";
    if (error.status && error.status >= 500) return "upstream_error";
    return `api_error_${error.status ?? "unknown"}`;
  }
  if (error instanceof Error) {
    if (error.name === "APIConnectionTimeoutError" || error.name === "TimeoutError") return "timeout";
    if (error.name === "APIConnectionError") return "connection_error";
  }
  return "unknown_error";
}

/**
 * Generates the companion's reply.
 *
 * The senior's message is passed as a user message and the knowledge base as a
 * separate system-role context block, so stored history can never be mistaken
 * for a new instruction.
 */
export async function generateCompanionReply(params: {
  context: SeniorContext;
  message: string;
}): Promise<string> {
  const { context, message } = params;

  let completion;
  try {
    completion = await getClient().chat.completions.create(
      {
        model: env.openaiModel(),
        // Warm but not rambling.
        temperature: 0.6,
        max_completion_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: buildContextMessage(context) },
          { role: "user", content: message },
        ],
      },
      { timeout: CHAT_TIMEOUT_MS },
    );
  } catch (error) {
    const reason = describeError(error);
    log.error("chat.openai_failed", { seniorId: context.seniorProfile.id, reason });
    throw new AiUnavailableError(reason);
  }

  const reply = sanitizeText(completion.choices[0]?.message?.content ?? "", 4000);
  if (!reply) {
    log.error("chat.openai_failed", { seniorId: context.seniorProfile.id, reason: "empty_response" });
    throw new AiUnavailableError("empty_response");
  }

  return reply;
}

/* ------------------------------------------------------------------- voice */

/**
 * Container MIME type to file extension.
 *
 * The transcription API identifies the audio format from the filename extension,
 * so a name that disagrees with the bytes is rejected with a 400 — labelling MP3
 * data `.webm` fails even though the content type is correct.
 */
const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  // Chrome labels audio-only WebM from MediaRecorder this way.
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

/** Extensions the API accepts, for deciding whether to trust a supplied name. */
const KNOWN_EXTENSION = /\.(webm|ogg|oga|mp4|m4a|mp3|mpga|mpeg|wav|flac)$/i;

/**
 * Picks the filename to upload a clip under.
 *
 * Exported for testing: getting this wrong is silent and total — the API answers
 * 400 for every request and no audio is ever transcribed.
 */
export function audioFilename(audio: Blob, provided?: string): string {
  if (provided && KNOWN_EXTENSION.test(provided)) return provided;
  // Strip codec parameters: "audio/webm;codecs=opus" -> "audio/webm".
  const container = audio.type.split(";")[0]?.trim().toLowerCase() ?? "";
  return `speech.${AUDIO_EXTENSIONS[container] ?? "webm"}`;
}

/**
 * Speech-to-text.
 *
 * The browser's own SpeechRecognition is the first choice — it is free and
 * streams interim results. This exists for the browsers that have none (Firefox
 * most importantly), so a senior there is not left with a dead microphone.
 *
 * `language` is an ISO-639-1 hint, not a constraint: passing it cuts latency and
 * materially improves accuracy on Hinglish, but the model may still return
 * another language if that is plainly what was said.
 */
export async function transcribeSpeech(params: {
  audio: Blob;
  /** The uploaded filename, when the client sent one. */
  filename?: string;
  language?: string;
}): Promise<string> {
  const { audio, filename, language } = params;

  let transcription;
  try {
    const name = audioFilename(audio, filename);
    transcription = await getClient().audio.transcriptions.create(
      {
        file: new File([audio], name, { type: audio.type || "audio/webm" }),
        model: env.openaiTranscribeModel(),
        // `json` is the only format gpt-4o-mini-transcribe supports.
        response_format: "json",
        ...(language ? { language } : {}),
      },
      { timeout: TRANSCRIBE_TIMEOUT_MS },
    );
  } catch (error) {
    const reason = describeError(error);
    log.error("voice.transcribe_failed", { reason });
    throw new AiUnavailableError(reason);
  }

  // Whatever the senior said is about to be treated as a chat message, so it
  // gets the same hygiene as typed input.
  return sanitizeText(transcription.text ?? "", 2000);
}

/** What the TTS model should sound like. Not a script — a direction. */
const VOICE_INSTRUCTIONS = `Speak as a warm, patient companion to an elderly person.
Unhurried and clearly articulated, with genuine warmth rather than performed cheerfulness.
Never brisk, never clinical, never saccharine.`;

export type SynthesizedSpeech = {
  audio: ArrayBuffer;
  contentType: string;
};

/**
 * Text-to-speech.
 *
 * Returns MP3 bytes for the route to stream back. The browser's
 * speechSynthesis remains the fallback: it is instant and free, but it reads
 * with an OS voice whose flatness is exactly wrong for a companion.
 */
export async function synthesizeSpeech(params: { text: string }): Promise<SynthesizedSpeech> {
  // The API caps input at 4096 characters; a companion line is far shorter, so
  // this only ever trims something that has already gone wrong upstream.
  const input = sanitizeText(params.text, 4000);
  if (!input) {
    throw new AiUnavailableError("empty_input");
  }

  try {
    const response = await getClient().audio.speech.create(
      {
        model: env.openaiTtsModel(),
        voice: env.openaiTtsVoice(),
        input,
        instructions: VOICE_INSTRUCTIONS,
        response_format: "mp3",
        // Slightly slower, matching the browser-synthesis rate this replaces.
        speed: 0.95,
      },
      { timeout: SPEAK_TIMEOUT_MS },
    );

    return { audio: await response.arrayBuffer(), contentType: "audio/mpeg" };
  } catch (error) {
    const reason = describeError(error);
    log.error("voice.speak_failed", { reason });
    throw new AiUnavailableError(reason);
  }
}

export type ModelWellnessClassification = {
  isConcern: boolean;
  category: WellnessCategory;
  severity: WellnessSeverity;
};

/**
 * Prompt for the classifier. Note what it is NOT asked to do: no cause, no
 * condition, no advice. It reports only whether the senior described something
 * about their own wellbeing, and how loudly.
 */
const CLASSIFIER_PROMPT = `You label a single sentence spoken by a senior citizen to a companion app.

You are NOT a doctor and must NOT diagnose. Do not guess a cause or a condition.
Decide only whether the person is reporting something about their own wellbeing.

isConcern: true only if they describe their own physical discomfort, pain, feeling unwell,
an emotional difficulty, or another wellbeing problem. False for greetings, small talk,
questions, schedule chat, or someone else's health.

category:
  DISCOMFORT — a physical sensation or symptom they feel.
  EMOTIONAL  — loneliness, sadness, fear, anxiety, distress.
  GENERAL    — vaguely unwell, low energy, poor sleep or appetite.
  OTHER      — a wellbeing concern that fits none of the above.

severity:
  LOW    — mild, passing, or mentioned lightly.
  MEDIUM — a clear complaint worth telling the family.
  HIGH   — they describe it as severe, or mention chest/breathing trouble, fainting,
           a fall, bleeding, or anything they call an emergency.

If unsure, answer isConcern false.`;

const CLASSIFICATION_SCHEMA = {
  type: "object" as const,
  properties: {
    isConcern: { type: "boolean" as const },
    category: { type: "string" as const, enum: Object.values(WellnessCategory) },
    severity: { type: "string" as const, enum: Object.values(WellnessSeverity) },
  },
  required: ["isConcern", "category", "severity"],
  additionalProperties: false,
};

function isCategory(value: unknown): value is WellnessCategory {
  return typeof value === "string" && value in WellnessCategory;
}

function isSeverity(value: unknown): value is WellnessSeverity {
  return typeof value === "string" && value in WellnessSeverity;
}

/**
 * Second-layer wellness classification.
 *
 * Returns null on any failure — a missing key, a timeout, malformed JSON. The
 * caller treats null as "no concern detected", so the chat never breaks because
 * the classifier had a bad day. The deterministic rules remain the primary
 * detector.
 */
export async function classifyWellnessWithModel(
  message: string,
): Promise<ModelWellnessClassification | null> {
  try {
    const completion = await getClient().chat.completions.create(
      {
        model: env.openaiModel(),
        temperature: 0,
        max_completion_tokens: 60,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "wellness_classification",
            strict: true,
            schema: CLASSIFICATION_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: message },
        ],
      },
      { timeout: CLASSIFY_TIMEOUT_MS },
    );

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { isConcern, category, severity } = parsed as Record<string, unknown>;
    if (typeof isConcern !== "boolean" || !isCategory(category) || !isSeverity(severity)) {
      return null;
    }

    return { isConcern, category, severity };
  } catch (error) {
    // Includes MissingEnvError when no key is configured: classification is
    // optional, so we stay quiet at warn level and fall back to the rules.
    log.warn("chat.openai_failed", { context: "wellness_classifier", reason: describeError(error) });
    return null;
  }
}
