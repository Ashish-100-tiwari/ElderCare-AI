import { Check, CircleDashed, Clock, Loader, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { scheduleStatusLabel, webhookStatusLabel } from "@/lib/format";
import type { Mood, ScheduleStatus, Severity, WebhookStatus } from "@/lib/types";

type PillSize = "sm" | "md" | "lg";

const sizeClasses: Record<PillSize, string> = {
  sm: "text-xs px-2.5 py-1 gap-1.5 font-semibold",
  md: "text-sm px-3 py-1.5 gap-2 font-semibold",
  lg: "text-lg px-4 py-2 gap-2.5 font-bold",
};

const iconSize: Record<PillSize, number> = { sm: 14, md: 16, lg: 20 };

interface PillProps {
  children: ReactNode;
  className?: string;
  size?: PillSize;
  icon?: ReactNode;
}

function Pill({ children, className, size = "md", icon }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border",
        sizeClasses[size],
        className,
      )}
    >
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------- schedule status */

const scheduleStyles: Record<ScheduleStatus, string> = {
  completed: "bg-calm-50 text-calm-800 border-calm-300",
  "in-progress": "bg-warm-100 text-warm-800 border-warm-400",
  upcoming: "bg-ink-100 text-ink-700 border-ink-300",
  scheduled: "bg-ink-50 text-ink-600 border-ink-200",
  missed: "bg-care-50 text-care-700 border-care-300",
};

export function ScheduleStatusPill({
  status,
  size = "md",
}: {
  status: ScheduleStatus;
  size?: PillSize;
}) {
  const icons: Record<ScheduleStatus, ReactNode> = {
    completed: <Check size={iconSize[size]} strokeWidth={3} />,
    "in-progress": <Loader size={iconSize[size]} strokeWidth={2.5} className="animate-spin [animation-duration:2.5s]" />,
    upcoming: <Clock size={iconSize[size]} strokeWidth={2.5} />,
    scheduled: <CircleDashed size={iconSize[size]} strokeWidth={2.5} />,
    missed: <TriangleAlert size={iconSize[size]} strokeWidth={2.5} />,
  };

  return (
    <Pill className={scheduleStyles[status]} size={size} icon={icons[status]}>
      {scheduleStatusLabel[status]}
    </Pill>
  );
}

/* ----------------------------------------------------------- mood status */

const moodStyles: Record<Mood, string> = {
  good: "bg-calm-50 text-calm-800 border-calm-300",
  okay: "bg-warm-100 text-warm-800 border-warm-400",
  unwell: "bg-care-50 text-care-700 border-care-300",
};

export function MoodPill({ mood, size = "md" }: { mood: Mood; size?: PillSize }) {
  const labels: Record<Mood, string> = { good: "Good", okay: "Okay", unwell: "Not well" };
  const emoji: Record<Mood, string> = { good: "😊", okay: "😐", unwell: "😟" };
  return (
    <Pill className={moodStyles[mood]} size={size} icon={<span>{emoji[mood]}</span>}>
      {labels[mood]}
    </Pill>
  );
}

/* -------------------------------------------------------- webhook status */

const webhookStyles: Record<WebhookStatus, string> = {
  sent: "bg-calm-600 text-white border-calm-700 tracking-wide",
  // Recorded but not delivered — deliberately not the same green as SENT.
  simulated: "bg-brand-100 text-brand-800 border-brand-400 tracking-wide",
  pending: "bg-warm-100 text-warm-800 border-warm-400 tracking-wide",
  failed: "bg-care-600 text-white border-care-700 tracking-wide",
  "not-required": "bg-ink-100 text-ink-600 border-ink-300 tracking-wide",
};

export function WebhookPill({ status, size = "sm" }: { status: WebhookStatus; size?: PillSize }) {
  return (
    <Pill className={cn(webhookStyles[status], "font-mono")} size={size}>
      {webhookStatusLabel[status]}
    </Pill>
  );
}

/* -------------------------------------------------------------- severity */

const severityStyles: Record<Severity, string> = {
  low: "bg-ink-100 text-ink-700 border-ink-300",
  medium: "bg-warm-100 text-warm-800 border-warm-400",
  high: "bg-care-100 text-care-800 border-care-400",
};

export function SeverityPill({ severity, size = "sm" }: { severity: Severity; size?: PillSize }) {
  const labels: Record<Severity, string> = { low: "Low", medium: "Medium", high: "Needs attention" };
  return (
    <Pill className={severityStyles[severity]} size={size}>
      {labels[severity]}
    </Pill>
  );
}

/* ------------------------------------------------------------ generic pill */

export function LivePill({ label = "Active" }: { label?: string }) {
  return (
    <Pill className="bg-calm-50 text-calm-800 border-calm-300" size="sm">
      <span className="relative flex size-2.5" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-calm-500 opacity-70" />
        <span className="relative inline-flex size-2.5 rounded-full bg-calm-600" />
      </span>
      {label}
    </Pill>
  );
}

export { Pill };
