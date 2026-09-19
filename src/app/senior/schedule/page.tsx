"use client";

import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";

import { DailySchedule } from "@/components/DailySchedule";
import { useElderCare } from "@/components/providers/ElderCareProvider";
import { Card, CardHeader } from "@/components/ui/Card";

export default function SeniorSchedulePage() {
  const { schedule, setScheduleStatus } = useElderCare();

  const items = schedule.data ?? [];
  const completed = items.filter((item) => item.status === "completed").length;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/senior"
        className="inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-lg font-semibold text-ink-700 hover:text-calm-700"
      >
        <ArrowLeft size={22} aria-hidden="true" />
        Back to home
      </Link>

      <Card tone="senior" padding="lg" className="mt-4">
        <CardHeader
          tone="senior"
          title="My Schedule Today"
          description={
            items.length > 0
              ? `You have finished ${completed} of ${items.length} activities.`
              : "Your plan for today."
          }
          icon={<CalendarDays size={26} />}
        />

        {items.length > 0 ? (
          <div
            className="mt-5 h-4 w-full overflow-hidden rounded-full bg-ink-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={completed}
            aria-label="Activities completed today"
          >
            <div
              className="h-full rounded-full bg-calm-600 transition-all duration-500"
              style={{ width: `${(completed / items.length) * 100}%` }}
            />
          </div>
        ) : null}

        <div className="mt-6">
          <DailySchedule
            items={schedule.data}
            status={schedule.status}
            error={schedule.error}
            onRetry={schedule.reload}
            variant="senior"
            onToggleComplete={(item) => void setScheduleStatus(item.id, "completed")}
          />
        </div>

        <p className="mt-6 text-center text-lg text-ink-500">
          Tap any activity once you have finished it.
        </p>
      </Card>
    </div>
  );
}
