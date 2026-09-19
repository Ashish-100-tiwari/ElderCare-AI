"use client";

import { HeartPulse, ShieldCheck } from "lucide-react";

import { MoodPill, WebhookPill } from "./ui/StatusPill";
import { ResourceView } from "./ui/StateView";
import { cn } from "@/lib/cn";
import { formatDayAndTime } from "@/lib/format";
import type { ResourceStatus, WellnessReport } from "@/lib/types";

/**
 * Recent well-being reports, each quoting the senior's own words and showing
 * whether the family was notified.
 */
interface WellnessReportsProps {
  reports: WellnessReport[] | null;
  status: ResourceStatus;
  error?: string | null;
  onRetry?: () => void;
  limit?: number;
  className?: string;
}

export function WellnessReports({
  reports,
  status,
  error,
  onRetry,
  limit,
  className,
}: WellnessReportsProps) {
  return (
    <ResourceView
      status={status}
      data={reports}
      error={error}
      onRetry={onRetry}
      subject="wellness reports"
      loadingRows={3}
      empty={{
        title: "No reports yet",
        detail: "Reports appear here after each check-in or conversation.",
        icon: <HeartPulse size={24} />,
      }}
    >
      {(items) => (
        <ul className={cn("divide-y divide-ink-200", className)}>
          {(limit ? items.slice(0, limit) : items).map((report) => (
            <li key={report.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold tabular-nums text-ink-800">
                  {formatDayAndTime(report.createdAt)}
                </p>
                <div className="flex items-center gap-2">
                  <MoodPill mood={report.mood} size="sm" />
                  {report.category === "discomfort" ? (
                    <span className="rounded-full border border-care-300 bg-care-50 px-2.5 py-1 text-xs font-semibold text-care-700">
                      Discomfort
                    </span>
                  ) : null}
                </div>
              </div>

              {report.quote ? (
                <blockquote className="mt-2 border-l-4 border-ink-200 pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Senior</p>
                  <p className="mt-0.5 text-base font-medium text-ink-900">&ldquo;{report.quote}&rdquo;</p>
                </blockquote>
              ) : null}

              <p className="mt-2 text-sm text-ink-600">{report.detail}</p>

              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-ink-600">
                  Status:
                  {report.familyNotified ? (
                    <span className="inline-flex items-center gap-1 text-calm-700">
                      <ShieldCheck size={14} aria-hidden="true" />
                      Family notified
                    </span>
                  ) : (
                    <span className="text-ink-500">Logged — no action needed</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-ink-600">
                  Webhook:
                  <WebhookPill status={report.webhookStatus} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ResourceView>
  );
}
