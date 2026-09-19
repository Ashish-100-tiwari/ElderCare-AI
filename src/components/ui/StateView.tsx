"use client";

import { Inbox, RotateCcw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { BigButton } from "./BigButton";
import { cn } from "@/lib/cn";
import type { ResourceStatus } from "@/lib/types";

/** Grey shimmer placeholder. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-ink-200/70", className)} aria-hidden="true" />;
}

interface LoadingStateProps {
  label: string;
  tone?: "senior" | "pro";
  /** Number of placeholder rows to draw. */
  rows?: number;
}

export function LoadingState({ label, tone = "pro", rows = 3 }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className={cn("text-ink-600", tone === "senior" ? "text-xl" : "text-sm")}>{label}</p>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={tone === "senior" ? "h-20" : "h-12"} />
      ))}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  detail?: string | null;
  onRetry?: () => void;
  tone?: "senior" | "pro";
}

export function ErrorState({ title, detail, onRetry, tone = "pro" }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-4 rounded-2xl border-2 border-care-200 bg-care-50",
        tone === "senior" ? "p-6" : "p-5",
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 shrink-0 text-care-600" size={tone === "senior" ? 32 : 24} />
        <div>
          <p className={cn("font-semibold text-care-900", tone === "senior" ? "text-2xl" : "text-base")}>
            {title}
          </p>
          {detail ? (
            <p className={cn("mt-1 text-care-800", tone === "senior" ? "text-lg" : "text-sm")}>{detail}</p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <BigButton
          onClick={onRetry}
          variant="secondary"
          size={tone === "senior" ? "lg" : "sm"}
          icon={<RotateCcw size={tone === "senior" ? 24 : 16} />}
        >
          Try Again
        </BigButton>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  detail?: string;
  icon?: ReactNode;
  tone?: "senior" | "pro";
  action?: ReactNode;
}

export function EmptyState({ title, detail, icon, tone = "pro", action }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink-300 bg-ink-50/60 text-center",
        tone === "senior" ? "p-8" : "p-7",
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-white text-ink-500" aria-hidden="true">
        {icon ?? <Inbox size={24} />}
      </span>
      <p className={cn("font-semibold text-ink-800", tone === "senior" ? "text-2xl" : "text-base")}>
        {title}
      </p>
      {detail ? (
        <p className={cn("max-w-sm text-ink-600", tone === "senior" ? "text-lg" : "text-sm")}>{detail}</p>
      ) : null}
      {action}
    </div>
  );
}

interface ResourceViewProps<T> {
  status: ResourceStatus;
  data: T | null;
  error?: string | null;
  onRetry?: () => void;
  tone?: "senior" | "pro";
  /** e.g. "senior information" — used in "Loading …" / "Unable to load …". */
  subject: string;
  loadingRows?: number;
  empty?: { title: string; detail?: string; icon?: ReactNode; action?: ReactNode };
  children: (data: T) => ReactNode;
}

/**
 * Renders the right state for an API-backed section, so no screen has to
 * repeat the loading / error / empty / success branching.
 */
export function ResourceView<T>({
  status,
  data,
  error,
  onRetry,
  tone = "pro",
  subject,
  loadingRows,
  empty,
  children,
}: ResourceViewProps<T>) {
  if (status === "loading" && data === null) {
    return <LoadingState label={`Loading ${subject}…`} tone={tone} rows={loadingRows} />;
  }

  if (status === "error" && data === null) {
    return (
      <ErrorState
        title={`Unable to load ${subject}.`}
        detail={error ?? undefined}
        onRetry={onRetry}
        tone={tone}
      />
    );
  }

  if (status === "empty" || data === null) {
    return (
      <EmptyState
        title={empty?.title ?? `No ${subject} yet.`}
        detail={empty?.detail}
        icon={empty?.icon}
        action={empty?.action}
        tone={tone}
      />
    );
  }

  return <>{children(data)}</>;
}
