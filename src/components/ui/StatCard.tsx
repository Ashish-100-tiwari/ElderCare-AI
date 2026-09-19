import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "./StateView";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "good" | "warn" | "alert" | "brand";

const toneClasses: Record<Tone, { icon: string; value: string }> = {
  neutral: { icon: "bg-ink-100 text-ink-600", value: "text-ink-900" },
  good: { icon: "bg-calm-100 text-calm-700", value: "text-calm-800" },
  warn: { icon: "bg-warm-100 text-warm-700", value: "text-warm-800" },
  alert: { icon: "bg-care-100 text-care-700", value: "text-care-800" },
  brand: { icon: "bg-brand-100 text-brand-700", value: "text-brand-700" },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  loading?: boolean;
  className?: string;
}

/** Compact KPI tile for the caregiver overview row. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  loading = false,
  className,
}: StatCardProps) {
  const classes = toneClasses[tone];

  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-200 bg-white p-4 shadow-soft transition-shadow hover:shadow-lift",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", classes.icon)} aria-hidden="true">
          <Icon size={18} />
        </span>
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <p className={cn("mt-2 text-2xl font-bold leading-tight", classes.value)}>{value}</p>
      )}

      {hint && !loading ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}
