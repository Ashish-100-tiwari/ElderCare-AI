/**
 * Wellness detection rules — pure logic, no database, no network.
 *
 * Split out from wellnessService so the detector can be unit-tested directly
 * and so the classification rules are reviewable without wading through
 * persistence code.
 *
 * IMPORTANT — this is not diagnosis. Nothing here decides what is wrong with
 * anyone. It answers one narrow question: "did the senior just tell us they are
 * not feeling right?" The category is a routing label for the family, never a
 * medical conclusion.
 */

import { WellnessCategory, WellnessSeverity } from "@/generated/prisma";
import { sanitizeText } from "@/lib/sanitize";

export type WellnessAnalysis = {
  /** True when this message should create a WellnessReport + Alert. */
  isConcern: boolean;
  category: WellnessCategory;
  severity: WellnessSeverity;
  /** Which rule terms fired. Useful in logs and for explaining a decision. */
  matched: string[];
  source: "rules" | "model" | "none";
};

export const NOT_A_CONCERN: WellnessAnalysis = {
  isConcern: false,
  category: WellnessCategory.GENERAL,
  severity: WellnessSeverity.LOW,
  matched: [],
  source: "none",
};

/**
 * Phrases that read as a concern even though they contain a negation word
 * ("I do NOT feel well"). Checked before the negation guard so it cannot
 * cancel them out.
 */
const NEGATED_PHRASES: Array<{ pattern: RegExp; category: WellnessCategory; severity: WellnessSeverity }> = [
  { pattern: /\b(do|does|did)\s?n[o']?t\s+feel\s+(well|good|right|ok(ay)?)\b/i, category: WellnessCategory.GENERAL, severity: WellnessSeverity.MEDIUM },
  { pattern: /\b(am|i'?m|feeling|feel)\s+not\s+(well|good|right|ok(ay)?)\b/i, category: WellnessCategory.GENERAL, severity: WellnessSeverity.MEDIUM },
  { pattern: /\bnot\s+feeling\s+(well|good|right|myself|too\s+good)\b/i, category: WellnessCategory.GENERAL, severity: WellnessSeverity.MEDIUM },
  { pattern: /\bcan(no|')?t\s+(sleep|breathe|walk|stand|get\s+up)\b/i, category: WellnessCategory.DISCOMFORT, severity: WellnessSeverity.MEDIUM },
  { pattern: /\bno\s+(appetite|energy|strength)\b/i, category: WellnessCategory.GENERAL, severity: WellnessSeverity.MEDIUM },
  { pattern: /\btabiyat\s+(theek|thik)\s+nahi\b/i, category: WellnessCategory.GENERAL, severity: WellnessSeverity.MEDIUM },
];

/**
 * Single terms and short phrases, grouped by what they tell the family.
 * Hindi/Hinglish spellings are included because our senior speaks Hindi and
 * mixes scripts in practice.
 */
const RULES: Array<{ terms: string[]; category: WellnessCategory; severity: WellnessSeverity }> = [
  // Body sensations the family should hear about.
  {
    terms: [
      "hurt", "hurts", "hurting", "pain", "painful", "paining", "ache", "aches", "aching",
      "sore", "soreness", "uncomfortable", "discomfort", "cramp", "cramps", "stiff",
      "stiffness", "swollen", "swelling", "burning", "itching", "numb", "numbness",
      "dizzy", "dizziness", "giddy", "lightheaded", "nausea", "nauseous", "vomit",
      "vomiting", "fever", "feverish", "chills", "cough", "coughing", "headache",
      "migraine", "breathless", "wheezing", "shivering",
      "dard", "chakkar", "bukhar", "khansi", "kamzori", "jalan", "sujan",
    ],
    category: WellnessCategory.DISCOMFORT,
    severity: WellnessSeverity.MEDIUM,
  },
  // Vague "something is off" reports.
  {
    terms: [
      "unwell", "weak", "weakness", "exhausted", "fatigue", "drained", "sick",
      "ill", "uneasy", "unsteady", "wobbly",
    ],
    category: WellnessCategory.GENERAL,
    severity: WellnessSeverity.MEDIUM,
  },
  // Emotional wellbeing.
  {
    terms: [
      "lonely", "loneliness", "sad", "sadness", "depressed", "anxious", "anxiety",
      "worried", "scared", "afraid", "frightened", "crying", "tearful", "upset",
      "hopeless", "helpless", "useless", "burden",
      "akela", "akelapan", "udaas", "pareshan", "chinta",
    ],
    category: WellnessCategory.EMOTIONAL,
    severity: WellnessSeverity.MEDIUM,
  },
];

/**
 * Phrases serious enough to raise a HIGH concern entirely on their own, even
 * when no other symptom word appears.
 *
 * These exist because the escalation list below only *sharpens* a concern that
 * some other term already triggered — "I am having trouble breathing" contains
 * no word from RULES and would otherwise be missed completely.
 *
 * They are phrases, not bare words, on purpose: a companion app that guides
 * meditation hears "let's do some breathing" and "my chest feels open" all day,
 * and neither is a medical report. A HIGH alert here is still only a statement
 * that the senior said this — never a conclusion about what it means.
 */
const CRITICAL_PHRASES: Array<{ pattern: RegExp; category: WellnessCategory }> = [
  { pattern: /\b(trouble|difficulty|difficult|hard|struggling|problem)\s+(to\s+|in\s+|with\s+)?breath(e|ing)\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bshort(ness)?\s+of\s+breath\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bcan(no|')?t\s+breathe\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bchest\s+(pain|pressure|tight|tightness|heavy|heaviness|burning|discomfort)\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bpain\s+in\s+(my\s+)?chest\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\b(fainted|collapsed|passed\s+out|blacked\s+out)\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bi\s+(fell|have\s+fallen|slipped)\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bbleeding\b/i, category: WellnessCategory.DISCOMFORT },
  { pattern: /\bsaans\s+(nahi|lene|phool)/i, category: WellnessCategory.DISCOMFORT },
];

/**
 * Terms that warrant the family's immediate attention. We still do not say why
 * — only that it was reported and deserves a faster look.
 */
const HIGH_SEVERITY_TERMS = [
  "chest", "breath", "breathe", "breathing", "suffocating", "choking",
  "faint", "fainted", "fainting", "collapse", "collapsed", "unconscious",
  "fell", "fallen", "slipped", "bleeding", "seizure",
  "stroke", "slurred", "paralysed", "paralyzed", "severe", "unbearable",
  "excruciating", "emergency", "ambulance", "saans", "seene",
];

/** Softeners that pull a routine report down to LOW. */
const MILD_QUALIFIERS = [
  "a little", "a bit", "slightly", "slight", "mild", "mildly", "somewhat",
  "thoda", "thodi",
];

/** Intensifiers that push a routine report up to HIGH. */
const STRONG_QUALIFIERS = [
  "very", "really", "extremely", "terribly", "awfully", "badly",
  "so much", "a lot", "too much", "can't bear", "cannot bear", "bahut", "bohot",
];

/** Words that cancel a symptom term when they appear just before it. */
const NEGATORS = new Set([
  "no", "not", "never", "without", "dont", "doesnt", "didnt", "isnt", "wasnt",
  "nahi", "nahin",
]);

/** Tokenises to lowercase words, keeping apostrophes so "don't" survives. */
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);
}

/**
 * True when a negator sits within the three words before `index`.
 * Deliberately crude — a hackathon-appropriate trade-off that catches
 * "my leg does not hurt" without a parser.
 */
function isNegated(tokens: string[], index: number): boolean {
  return tokens
    .slice(Math.max(0, index - 3), index)
    .some((token) => NEGATORS.has(token) || token.endsWith("n't"));
}

function containsAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    const hit = needle.includes(" ")
      ? haystack.includes(needle)
      : new RegExp(`\\b${needle}\\b`).test(haystack);
    if (hit) return needle;
  }
  return null;
}

/** Category precedence when a message trips more than one group. */
const CATEGORY_RANK: Record<WellnessCategory, number> = {
  [WellnessCategory.DISCOMFORT]: 3,
  [WellnessCategory.EMOTIONAL]: 2,
  [WellnessCategory.GENERAL]: 1,
  [WellnessCategory.OTHER]: 0,
};

const SEVERITY_RANK: Record<WellnessSeverity, number> = {
  [WellnessSeverity.HIGH]: 3,
  [WellnessSeverity.MEDIUM]: 2,
  [WellnessSeverity.LOW]: 1,
};

/**
 * Layer 1 of detection: deterministic keyword and phrase rules.
 * Instant, free, and identical every run — which is what makes it safe to demo.
 */
export function analyzeWithRules(rawMessage: string): WellnessAnalysis {
  const message = sanitizeText(rawMessage);
  if (!message) return NOT_A_CONCERN;

  const lower = message.toLowerCase();
  const tokens = tokenize(message);

  let category: WellnessCategory | null = null;
  let severity: WellnessSeverity | null = null;
  const matched: string[] = [];

  const promote = (nextCategory: WellnessCategory, nextSeverity: WellnessSeverity, term: string) => {
    matched.push(term);
    if (category === null || CATEGORY_RANK[nextCategory] > CATEGORY_RANK[category]) {
      category = nextCategory;
    }
    if (severity === null || SEVERITY_RANK[nextSeverity] > SEVERITY_RANK[severity]) {
      severity = nextSeverity;
    }
  };

  // Critical phrases first: they stand alone and cannot be talked down later.
  let critical = false;
  for (const phrase of CRITICAL_PHRASES) {
    const found = lower.match(phrase.pattern);
    if (found) {
      critical = true;
      promote(phrase.category, WellnessSeverity.HIGH, found[0].trim());
    }
  }

  // Negation-bearing phrases next, so the guard below cannot erase them.
  for (const phrase of NEGATED_PHRASES) {
    const found = lower.match(phrase.pattern);
    if (found) promote(phrase.category, phrase.severity, found[0].trim());
  }

  // Single terms, skipping any that a nearby negator cancels.
  for (const rule of RULES) {
    for (const term of rule.terms) {
      if (term.includes(" ")) {
        if (lower.includes(term)) promote(rule.category, rule.severity, term);
        continue;
      }
      const index = tokens.indexOf(term);
      if (index !== -1 && !isNegated(tokens, index)) {
        promote(rule.category, rule.severity, term);
      }
    }
  }

  if (category === null || severity === null) return NOT_A_CONCERN;

  // Adjust intensity. A high-risk term wins outright; otherwise qualifiers nudge.
  const highTerm = containsAny(lower, HIGH_SEVERITY_TERMS);
  const strongTerm = containsAny(lower, STRONG_QUALIFIERS);
  const mildTerm = containsAny(lower, MILD_QUALIFIERS);

  let finalSeverity: WellnessSeverity = severity;
  if (critical) {
    // A softener ("a little trouble breathing") must not pull this down.
    finalSeverity = WellnessSeverity.HIGH;
  } else if (highTerm) {
    finalSeverity = WellnessSeverity.HIGH;
    matched.push(highTerm);
  } else if (strongTerm) {
    finalSeverity = WellnessSeverity.HIGH;
    matched.push(strongTerm);
  } else if (mildTerm) {
    finalSeverity = WellnessSeverity.LOW;
    matched.push(mildTerm);
  }

  return {
    isConcern: true,
    category,
    severity: finalSeverity,
    matched: [...new Set(matched)],
    source: "rules",
  };
}

/**
 * Hints that a sentence is about the senior's own state. Used only to decide
 * whether the model classifier is worth a call — it keeps "Good morning!" from
 * costing an API round trip while still catching phrasings our list missed.
 */
export const SELF_REPORT_HINTS =
  /\b(i|my|me|mera|meri|mujhe|feel|feeling|felt|body|sleep|slept|appetite|energy|strength|mood|tabiyat)\b/i;
