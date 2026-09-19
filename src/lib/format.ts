import type { ActivityKind, Mood, ScheduleStatus, Severity, WebhookStatus } from "./types";

/** "07:30" -> "7:30 AM". Kept locale-independent so SSR and client agree. */
export function formatClock(time: string): string {
  const [rawHours, rawMinutes] = time.split(":");
  const hours = Number(rawHours);
  const minutes = rawMinutes ?? "00";
  if (Number.isNaN(hours)) return time;
  const suffix = hours >= 12 ? "PM" : "AM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes.padStart(2, "0")} ${suffix}`;
}

/** ISO timestamp -> "10:32 AM". */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatClock(`${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`);
}

/** ISO timestamp -> "Today, 10:32 AM" / "Yesterday, 9:10 PM" / "17 Sep, 9:10 PM". */
export function formatDayAndTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

  if (dayDiff === 0) return `Today, ${formatTimestamp(iso)}`;
  if (dayDiff === 1) return `Yesterday, ${formatTimestamp(iso)}`;

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}, ${formatTimestamp(iso)}`;
}

/** Seconds -> "09:58". */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

export const scheduleStatusLabel: Record<ScheduleStatus, string> = {
  completed: "Completed",
  "in-progress": "In Progress",
  upcoming: "Upcoming",
  scheduled: "Scheduled",
  missed: "Missed",
};

export const moodLabel: Record<Mood, string> = {
  good: "Good",
  okay: "Okay",
  unwell: "Not Feeling Well",
};

export const moodEmoji: Record<Mood, string> = {
  good: "😊",
  okay: "😐",
  unwell: "😟",
};

export const severityLabel: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "Needs attention",
};

export const webhookStatusLabel: Record<WebhookStatus, string> = {
  sent: "SENT",
  simulated: "SIMULATED",
  pending: "PENDING",
  failed: "FAILED",
  "not-required": "NOT SENT",
};

export const activityKindLabel: Record<ActivityKind, string> = {
  wake: "Wake up",
  meditation: "Meditation",
  meal: "Meal",
  walk: "Walk",
  rest: "Rest",
  relaxation: "Relaxation",
  sleep: "Sleep",
  medication: "Medicine",
};

/** "Rajesh Sharma" -> "RS" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Minutes between "07:00" and "22:00", used to lay out the timeline. */
export function minutesFromMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours)) return 0;
  return hours * 60 + (Number.isNaN(minutes) ? 0 : minutes);
}
