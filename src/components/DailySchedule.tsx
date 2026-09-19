"use client";

import { motion } from "framer-motion";
import {
  Armchair,
  CalendarDays,
  Check,
  Footprints,
  Moon,
  Music,
  Pill,
  Sparkles,
  Sunrise,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { ScheduleStatusPill } from "./ui/StatusPill";
import { ResourceView } from "./ui/StateView";
import { cn } from "@/lib/cn";
import { formatClock, formatTimestamp } from "@/lib/format";
import type { ActivityKind, ResourceStatus, ScheduleItem } from "@/lib/types";

/**
 * Today's plan. One component serves both experiences:
 *
 *  - `variant="senior"`: very large rows, few words, tap to tick off.
 *  - `variant="timeline"`: compact timeline for the caregiver dashboard.
 */

const iconByKind: Record<ActivityKind, LucideIcon> = {
  wake: Sunrise,
  meditation: Sparkles,
  meal: UtensilsCrossed,
  walk: Footprints,
  rest: Armchair,
  relaxation: Music,
  sleep: Moon,
  medication: Pill,
};

interface DailyScheduleProps {
  items: ScheduleItem[] | null;
  status: ResourceStatus;
  error?: string | null;
  onRetry?: () => void;
  variant?: "senior" | "timeline";
  /** Senior-only: tap a row to mark it done. */
  onToggleComplete?: (item: ScheduleItem) => void;
  /** Show only the next N items (senior dashboard keeps it short). */
  limit?: number;
  className?: string;
}

export function DailySchedule({
  items,
  status,
  error,
  onRetry,
  variant = "senior",
  onToggleComplete,
  limit,
  className,
}: DailyScheduleProps) {
  const tone = variant === "senior" ? "senior" : "pro";

  return (
    <ResourceView
      status={status}
      data={items}
      error={error}
      onRetry={onRetry}
      tone={tone}
      subject="today's schedule"
      loadingRows={variant === "senior" ? 3 : 5}
      empty={{
        title: "Nothing planned yet",
        detail: "Your daily routine will appear here once it's set up.",
        icon: <CalendarDays size={24} />,
      }}
    >
      {(allItems) => {
        const upNextId = allItems.find((item) => item.status !== "completed")?.id;
        const visible = limit ? allItems.slice(0, limit) : allItems;

        return (
          <ol className={cn(variant === "senior" ? "space-y-3" : "space-y-1", className)}>
            {visible.map((item, index) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
              >
                {variant === "senior" ? (
                  <SeniorRow
                    item={item}
                    isUpNext={item.id === upNextId}
                    onToggleComplete={onToggleComplete}
                  />
                ) : (
                  <TimelineRow
                    item={item}
                    isUpNext={item.id === upNextId}
                    isLast={index === visible.length - 1}
                  />
                )}
              </motion.li>
            ))}
          </ol>
        );
      }}
    </ResourceView>
  );
}

/* ------------------------------------------------------------ senior row */

function SeniorRow({
  item,
  isUpNext,
  onToggleComplete,
}: {
  item: ScheduleItem;
  isUpNext: boolean;
  onToggleComplete?: (item: ScheduleItem) => void;
}) {
  const Icon = iconByKind[item.kind];
  const done = item.status === "completed";
  const interactive = Boolean(onToggleComplete) && !done;

  const content = (
    <>
      <span
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-2xl sm:size-16",
          done ? "bg-calm-600 text-white" : isUpNext ? "bg-warm-200 text-warm-900" : "bg-ink-100 text-ink-600",
        )}
        aria-hidden="true"
      >
        {done ? <Check size={30} strokeWidth={3} /> : <Icon size={28} strokeWidth={2.2} />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold tabular-nums text-ink-900 sm:text-3xl">
            {formatClock(item.time)}
          </span>
          <span
            className={cn(
              "text-xl font-semibold sm:text-2xl",
              done ? "text-ink-500" : "text-ink-800",
            )}
          >
            {item.title}
          </span>
        </span>
        {item.note && !done ? (
          <span className="mt-1 block text-base text-ink-600 sm:text-lg">{item.note}</span>
        ) : null}
        {done && item.completedAt ? (
          <span className="mt-1 block text-base text-calm-700">
            Done at {formatTimestamp(item.completedAt)}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-2">
        <ScheduleStatusPill status={item.status} size="md" />
        {isUpNext && !done ? (
          <span className="text-sm font-bold uppercase tracking-wide text-warm-700">Up next</span>
        ) : null}
      </span>
    </>
  );

  const shell = cn(
    "flex w-full items-center gap-4 rounded-3xl border-2 p-4 text-left transition-colors sm:gap-5 sm:p-5",
    done
      ? "border-calm-200 bg-calm-50/70"
      : isUpNext
        ? "border-warm-400 bg-warm-50 shadow-soft"
        : "border-ink-200 bg-white",
    interactive && "hover:border-calm-400 hover:bg-calm-50/60",
  );

  if (!interactive) {
    return <div className={shell}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onToggleComplete?.(item)}
      className={shell}
      aria-label={`Mark ${item.title} at ${formatClock(item.time)} as completed`}
    >
      {content}
    </button>
  );
}

/* ---------------------------------------------------------- timeline row */

function TimelineRow({
  item,
  isUpNext,
  isLast,
}: {
  item: ScheduleItem;
  isUpNext: boolean;
  isLast: boolean;
}) {
  const Icon = iconByKind[item.kind];
  const done = item.status === "completed";

  return (
    <div className="flex gap-4">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "z-10 grid size-9 shrink-0 place-items-center rounded-full border-2",
            done
              ? "border-calm-600 bg-calm-600 text-white"
              : isUpNext
                ? "border-warm-500 bg-warm-100 text-warm-800"
                : "border-ink-300 bg-white text-ink-500",
          )}
          aria-hidden="true"
        >
          {done ? <Check size={18} strokeWidth={3} /> : <Icon size={16} strokeWidth={2.4} />}
        </span>
        {!isLast ? <span className={cn("w-0.5 flex-1", done ? "bg-calm-300" : "bg-ink-200")} /> : null}
      </div>

      <div
        className={cn(
          "mb-3 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-3 py-2.5",
          isUpNext ? "bg-warm-50 ring-1 ring-warm-300" : "bg-transparent",
        )}
      >
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-ink-600">
            {formatClock(item.time)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{item.title}</p>
            {done && item.completedAt ? (
              <p className="text-xs text-ink-500">Completed {formatTimestamp(item.completedAt)}</p>
            ) : item.note ? (
              <p className="truncate text-xs text-ink-500">{item.note}</p>
            ) : null}
          </div>
        </div>
        <ScheduleStatusPill status={item.status} size="sm" />
      </div>
    </div>
  );
}
