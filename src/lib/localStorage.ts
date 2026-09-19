import type { Alert, ConversationMessage, Mood, ScheduleStatus } from "./types";

/**
 * Small, typed wrapper around localStorage.
 *
 * Used for instant hydration (so the senior never stares at a spinner) and to
 * remember progress such as a finished meditation between reloads. It is a
 * cache, not a source of truth — the API always wins once it responds.
 *
 * NOTE: never store API keys, tokens or anything secret here.
 */

const PREFIX = "eldercare:";

export const STORAGE_KEYS = {
  currentSenior: `${PREFIX}current-senior`,
  scheduleOverrides: `${PREFIX}schedule-overrides`,
  meditation: `${PREFIX}meditation`,
  conversationCache: `${PREFIX}conversation-cache`,
  uiPreferences: `${PREFIX}ui-preferences`,
  demoAlerts: `${PREFIX}demo-alerts`,
  lastMood: `${PREFIX}last-mood`,
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private-mode failures must never break the experience.
  }
}

export function removeStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------- schedule + meditation */

/** Locally completed items, so progress survives a reload. */
export type ScheduleOverride = {
  status: ScheduleStatus;
  completedAt: string | null;
  /** The day the override belongs to; yesterday's progress is discarded. */
  day: string;
};
export type ScheduleOverrides = Record<string, ScheduleOverride>;

/** Returns only today's overrides — the schedule resets every morning. */
export function getScheduleOverrides(): ScheduleOverrides {
  const stored = readStorage<ScheduleOverrides>(STORAGE_KEYS.scheduleOverrides, {});
  const today = todayKey();
  return Object.fromEntries(
    Object.entries(stored).filter(([, override]) => override.day === today),
  );
}

export function setScheduleOverride(
  id: string,
  status: ScheduleStatus,
  completedAt: string | null = null,
): void {
  const overrides = getScheduleOverrides();
  overrides[id] = { status, completedAt, day: todayKey() };
  writeStorage(STORAGE_KEYS.scheduleOverrides, overrides);
}

/** Re-applies locally known progress on top of whatever the API returned. */
export function applyScheduleOverrides<T extends { id: string; status: ScheduleStatus; completedAt: string | null }>(
  items: T[],
): T[] {
  const overrides = getScheduleOverrides();
  if (Object.keys(overrides).length === 0) return items;

  return items.map((item) => {
    const override = overrides[item.id];
    // The API wins when it already reports completion.
    if (!override || item.status === "completed") return item;
    return { ...item, status: override.status, completedAt: override.completedAt };
  });
}

export interface MeditationState {
  /** YYYY-MM-DD of the day it was completed. */
  completedOn: string | null;
  completedAt: string | null;
  minutes: number;
  totalSessions: number;
}

const EMPTY_MEDITATION: MeditationState = {
  completedOn: null,
  completedAt: null,
  minutes: 0,
  totalSessions: 0,
};

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function getMeditationState(): MeditationState {
  return readStorage<MeditationState>(STORAGE_KEYS.meditation, EMPTY_MEDITATION);
}

export function isMeditationDoneToday(): boolean {
  return getMeditationState().completedOn === todayKey();
}

export function saveMeditationCompletion(minutes: number): MeditationState {
  const previous = getMeditationState();
  const next: MeditationState = {
    completedOn: todayKey(),
    completedAt: new Date().toISOString(),
    minutes,
    totalSessions: previous.totalSessions + 1,
  };
  writeStorage(STORAGE_KEYS.meditation, next);
  setScheduleOverride("sch_meditation", "completed", next.completedAt);
  return next;
}

/* --------------------------------------------------------- conversation */

export function getCachedConversation(): ConversationMessage[] {
  return readStorage<ConversationMessage[]>(STORAGE_KEYS.conversationCache, []);
}

export function cacheConversation(messages: ConversationMessage[]): void {
  // Keep the cache small — the last 40 turns is plenty for a session.
  writeStorage(STORAGE_KEYS.conversationCache, messages.slice(-40));
}

/* ----------------------------------------------------------------- alerts */

export function getDemoAlerts(): Alert[] {
  return readStorage<Alert[]>(STORAGE_KEYS.demoAlerts, []);
}

export function cacheDemoAlerts(alerts: Alert[]): void {
  writeStorage(STORAGE_KEYS.demoAlerts, alerts.slice(0, 20));
}

/* ---------------------------------------------------------------- moods */

export function getLastMood(): Mood | null {
  return readStorage<Mood | null>(STORAGE_KEYS.lastMood, null);
}

export function setLastMood(mood: Mood): void {
  writeStorage(STORAGE_KEYS.lastMood, mood);
}

/* ------------------------------------------------------- UI preferences */

export interface UiPreferences {
  /** Read companion replies aloud with the browser voice. */
  voiceEnabled: boolean;
  /** Bumps up type size across the senior experience. */
  largeText: boolean;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  voiceEnabled: true,
  largeText: false,
};

export function getUiPreferences(): UiPreferences {
  return { ...DEFAULT_UI_PREFERENCES, ...readStorage<Partial<UiPreferences>>(STORAGE_KEYS.uiPreferences, {}) };
}

export function setUiPreferences(preferences: Partial<UiPreferences>): UiPreferences {
  const next = { ...getUiPreferences(), ...preferences };
  writeStorage(STORAGE_KEYS.uiPreferences, next);
  return next;
}

/** Clears every ElderCare key — used by the "Reset demo" control. */
export function clearAllStorage(): void {
  Object.values(STORAGE_KEYS).forEach(removeStorage);
}
