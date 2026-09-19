import type { Mood } from "@/lib/types";

/**
 * Rule-based stand-in for the backend's GenAI companion.
 *
 * This exists only so the frontend demo is self-sufficient. With a live backend
 * every message goes to it instead (see `lib/server/live.ts`) and it owns the
 * LLM call. The browser never talks to an LLM provider directly either way.
 *
 * It deliberately never diagnoses, never names a condition and never gives
 * medical advice — it acknowledges, records, and escalates to the family.
 */

export interface CompanionAnalysis {
  reply: string;
  discomfort: boolean;
  mood: Mood | null;
  topic: string;
}

const DISCOMFORT_TERMS = [
  "uncomfortable",
  "discomfort",
  "pain",
  "painful",
  "hurts",
  "hurting",
  "ache",
  "aching",
  "sore",
  "dizzy",
  "dizziness",
  "nausea",
  "breathless",
  "weak",
  "weakness",
  "swollen",
  "stiff",
  "cramp",
  "fever",
  "headache",
  "unwell",
  "not well",
  "not feeling well",
  "chest",
  "giddy",
];

const LOW_MOOD_TERMS = ["sad", "lonely", "alone", "low", "worried", "anxious", "upset", "bored", "miss"];
const GOOD_MOOD_TERMS = ["good", "great", "happy", "fine", "wonderful", "better", "calm", "peaceful", "relaxed"];

const MEDITATION_TERMS = ["meditate", "meditation", "breathe", "breathing", "relax"];
const SCHEDULE_TERMS = ["schedule", "today", "plan", "next", "routine", "walk", "lunch", "breakfast", "dinner"];
const GREETING_TERMS = ["hello", "hi ", "hey", "namaste", "good morning", "good evening", "good afternoon"];
const THANKS_TERMS = ["thank", "thanks", "shukriya"];
const FAMILY_TERMS = ["son", "rahul", "family", "grandchild", "daughter", "wife"];
const MEDICINE_TERMS = ["medicine", "tablet", "pill", "medication"];

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/** Pulls out the body part the senior mentioned, to echo it back warmly. */
function bodyPart(text: string): string | null {
  const parts = [
    "leg",
    "legs",
    "knee",
    "knees",
    "back",
    "head",
    "shoulder",
    "arm",
    "hand",
    "foot",
    "feet",
    "hip",
    "neck",
    "stomach",
    "chest",
    "eye",
    "tooth",
  ];
  return parts.find((part) => new RegExp(`\\b${part}\\b`).test(text)) ?? null;
}

export function analyseMessage(rawText: string, seniorFirstName: string): CompanionAnalysis {
  const text = ` ${rawText.toLowerCase().trim()} `;

  // Discomfort takes priority over everything else.
  if (includesAny(text, DISCOMFORT_TERMS)) {
    const part = bodyPart(text);
    const acknowledgement = part
      ? `I'm sorry your ${part} is troubling you.`
      : "I'm sorry you're experiencing discomfort.";

    return {
      reply: `${acknowledgement} I've recorded what you told me and will notify your family member. Please sit somewhere comfortable and rest for a little while. I'll stay right here with you.`,
      discomfort: true,
      mood: "unwell",
      topic: part ? `discomfort: ${part}` : "discomfort",
    };
  }

  if (includesAny(text, LOW_MOOD_TERMS)) {
    return {
      reply: `Thank you for telling me, ${seniorFirstName}. It's alright to feel this way. I've noted it down for your family. Would you like to talk about it, or shall we do a few slow breaths together?`,
      discomfort: false,
      mood: "okay",
      topic: "low mood",
    };
  }

  if (includesAny(text, MEDITATION_TERMS)) {
    return {
      reply: `That sounds lovely. Your morning meditation is ten minutes long. Tap "Start Meditation" whenever you're ready and I'll guide you breath by breath.`,
      discomfort: false,
      mood: null,
      topic: "meditation",
    };
  }

  if (includesAny(text, MEDICINE_TERMS)) {
    return {
      reply: `I'll remind you at the right time, ${seniorFirstName}. For anything about your medicines, it's best to check with your son Rahul or your doctor — I'll pass along a note that you asked.`,
      discomfort: false,
      mood: null,
      topic: "medicine",
    };
  }

  if (includesAny(text, SCHEDULE_TERMS)) {
    return {
      reply: `Here's what's coming up today: a morning walk at 10:30, lunch at 1 o'clock, and some rest at 4. Your schedule is on the screen below whenever you'd like to look.`,
      discomfort: false,
      mood: null,
      topic: "schedule",
    };
  }

  if (includesAny(text, FAMILY_TERMS)) {
    return {
      reply: `Rahul checks on you every day, and he can see that you're doing well. Shall I let him know you were thinking of him?`,
      discomfort: false,
      mood: "good",
      topic: "family",
    };
  }

  if (includesAny(text, THANKS_TERMS)) {
    return {
      reply: `You're very welcome, ${seniorFirstName}. I'm always here when you'd like to talk.`,
      discomfort: false,
      mood: null,
      topic: "small talk",
    };
  }

  if (includesAny(text, GOOD_MOOD_TERMS)) {
    return {
      reply: `That's wonderful to hear, ${seniorFirstName}. I've noted that you're feeling good today — your family will be happy to see it.`,
      discomfort: false,
      mood: "good",
      topic: "mood check",
    };
  }

  if (includesAny(text, GREETING_TERMS)) {
    return {
      reply: `Hello ${seniorFirstName}, it's good to hear from you. How are you feeling right now?`,
      discomfort: false,
      mood: null,
      topic: "greeting",
    };
  }

  return {
    reply: `I hear you, ${seniorFirstName}. Tell me a little more, and I'll make a note of it for your family.`,
    discomfort: false,
    mood: null,
    topic: "general",
  };
}

/** Mirrors the message the senior sees when a mood button is tapped. */
export function replyForMood(mood: Mood, seniorFirstName: string): string {
  switch (mood) {
    case "good":
      return `That's lovely to hear, ${seniorFirstName}. I've saved that you're feeling good today.`;
    case "okay":
      return `Thank you for letting me know, ${seniorFirstName}. I've noted that you're feeling just okay. We can take today gently.`;
    case "unwell":
      return `I'm sorry you're not feeling well, ${seniorFirstName}. I've recorded it and your family member has been notified. Tell me what's troubling you whenever you're ready.`;
  }
}
