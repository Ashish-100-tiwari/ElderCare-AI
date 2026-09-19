import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** `senior` cards are larger and softer; `pro` cards suit the dashboard. */
  tone?: "senior" | "pro";
  padding?: "none" | "sm" | "md" | "lg";
  /** Anchor target, e.g. so "Review now" can jump to the alerts card. */
  id?: string;
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

export function Card({
  children,
  className,
  as: Tag = "div",
  tone = "pro",
  padding = "md",
  id,
}: CardProps) {
  return (
    <Tag
      id={id}
      className={cn(
        // Offsets the sticky header when jumped to via an anchor link.
        id && "scroll-mt-28",
        "bg-white",
        tone === "senior"
          ? "rounded-4xl border-2 border-ink-200/70 shadow-soft"
          : "rounded-2xl border border-ink-200/80 shadow-soft",
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "senior" | "pro";
  className?: string;
}

export function CardHeader({ title, description, icon, action, tone = "pro", className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-2xl bg-calm-50 text-calm-700",
              tone === "senior" ? "size-12" : "size-10",
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold text-ink-900",
              tone === "senior" ? "text-2xl sm:text-3xl" : "text-lg",
            )}
          >
            {title}
          </h2>
          {description ? (
            <p className={cn("text-ink-600", tone === "senior" ? "mt-1 text-lg" : "mt-0.5 text-sm")}>
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
