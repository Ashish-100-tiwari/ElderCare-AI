/**
 * Text normalisation for anything that arrives from a client and will later be
 * stored, echoed back, or put in front of the model.
 *
 * This is not HTML escaping — the API returns JSON and React escapes on render.
 * What it does remove is control characters and zero-width joiners, which are
 * the pieces used to smuggle invisible instructions into a prompt or to break a
 * log line in two.
 */

// C0/C1 control characters, keeping \n (\u000A) and \t (\u0009).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Zero-width spaces/joiners, bidi overrides, line/paragraph separators, BOM.
const INVISIBLE_CHARS = /[\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF]/g;

/** Cleans a free-text field. Collapses blank runs, trims, and caps length. */
export function sanitizeText(input: string, maxLength = 2000): string {
  const cleaned = input
    .replace(CONTROL_CHARS, " ")
    .replace(INVISIBLE_CHARS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}
