/**
 * Structured JSON logging.
 *
 * One line per event so logs stay greppable in a terminal during the demo.
 * Everything goes through `redact()`, which drops any field whose name looks
 * like a credential — a defence in depth so a careless `log.info("x", config)`
 * can never print an API key or a connection string.
 */

import "server-only";

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "chat.request"
  | "chat.response"
  | "chat.openai_failed"
  | "wellness.detected"
  | "wellness.report_created"
  | "alert.created"
  | "webhook.result"
  | "voice.transcribe_failed"
  | "voice.speak_failed"
  | "db.error"
  | "request.rejected"
  | "request.failed";

const SENSITIVE_KEY = /(key|token|secret|password|passwd|credential|authorization|cookie|connectionstring|database_url|apikey)/i;

/** Anything that looks like a secret value regardless of its field name. */
const SENSITIVE_VALUE = /(sk-[A-Za-z0-9_-]{8,}|postgres(ql)?:\/\/[^\s]+)/g;

function scrubString(value: string): string {
  return value.replace(SENSITIVE_VALUE, "[REDACTED]");
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  if (value instanceof Error) {
    // Message only. Stack traces stay out of logs we might ship anywhere.
    return { name: value.name, message: scrubString(value.message) };
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, event: LogEvent, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...(redact(data) as Record<string, unknown>),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: LogEvent, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: LogEvent, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: LogEvent, data?: Record<string, unknown>) => emit("error", event, data),
};

/**
 * Message text is only ever logged as a length + short preview. Full health
 * complaints are personal; they belong in the database, not in stdout.
 */
export function preview(text: string, max = 60): string {
  const clean = scrubString(text.replace(/\s+/g, " ").trim());
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}
