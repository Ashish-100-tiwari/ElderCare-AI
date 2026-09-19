"use client";

import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Footprints,
  HeartPulse,
  ListChecks,
  MessagesSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { AlertBanner, AlertPanel } from "@/components/AlertPanel";
import { DailySchedule } from "@/components/DailySchedule";
import { WellnessReports } from "@/components/WellnessReports";
import { useElderCare } from "@/components/providers/ElderCareProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { MoodPill } from "@/components/ui/StatusPill";
import { StatCard } from "@/components/ui/StatCard";
import { ResourceView } from "@/components/ui/StateView";
import { formatDayAndTime, formatTimestamp, moodLabel, scheduleStatusLabel } from "@/lib/format";

export default function CaregiverDashboardPage() {
  const {
    senior,
    schedule,
    alerts,
    wellnessReports,
    conversations,
    unacknowledgedAlerts,
    acknowledge,
    isNewAlert,
    refreshAll,
  } = useElderCare();

  const stats = useMemo(() => {
    const items = schedule.data ?? [];
    const completed = items.filter((item) => item.status === "completed").length;
    return {
      completed,
      total: items.length,
      meditation: items.find((item) => item.id === "sch_meditation"),
      walk: items.find((item) => item.id === "sch_walk"),
    };
  }, [schedule.data]);

  const mood = senior.data?.currentMood ?? null;
  const scheduleLoading = schedule.status === "loading" && !schedule.data;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ head */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">Today at a glance</h1>
          <p className="mt-1 text-sm text-ink-600">
            {senior.data
              ? `${senior.data.name} · last check-in ${formatDayAndTime(senior.data.lastCheckInAt)}`
              : "Loading senior information…"}
          </p>
        </div>

        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-700 shadow-soft hover:bg-ink-100"
        >
          <RefreshCw size={15} className={alerts.isRefreshing ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>

      {unacknowledgedAlerts.length > 0 ? <AlertBanner alerts={unacknowledgedAlerts} /> : null}

      {/* -------------------------------------------------- overview cards */}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Today's Activities"
          value={`${stats.completed} / ${stats.total}`}
          hint="completed"
          icon={ListChecks}
          tone={stats.total > 0 && stats.completed === stats.total ? "good" : "brand"}
          loading={scheduleLoading}
        />
        <StatCard
          label="Meditation"
          value={stats.meditation ? scheduleStatusLabel[stats.meditation.status] : "—"}
          hint={
            stats.meditation?.completedAt
              ? `at ${formatTimestamp(stats.meditation.completedAt)}`
              : stats.meditation
                ? `scheduled ${stats.meditation.time}`
                : undefined
          }
          icon={Sparkles}
          tone={stats.meditation?.status === "completed" ? "good" : "warn"}
          loading={scheduleLoading}
        />
        <StatCard
          label="Walking"
          value={stats.walk ? scheduleStatusLabel[stats.walk.status] : "—"}
          hint={
            stats.walk?.completedAt
              ? `at ${formatTimestamp(stats.walk.completedAt)}`
              : stats.walk
                ? `scheduled ${stats.walk.time}`
                : undefined
          }
          icon={Footprints}
          tone={stats.walk?.status === "completed" ? "good" : "neutral"}
          loading={scheduleLoading}
        />
        <StatCard
          label="Wellness"
          value={mood ? moodLabel[mood] : "No check-in"}
          hint={mood === "unwell" ? "Needs attention" : "Self-reported"}
          icon={HeartPulse}
          tone={mood === "good" ? "good" : mood === "okay" ? "warn" : mood === "unwell" ? "alert" : "neutral"}
          loading={senior.status === "loading" && !senior.data}
        />
        <StatCard
          label="Last Check-in"
          value={senior.data ? formatTimestamp(senior.data.lastCheckInAt) : "—"}
          hint={senior.data?.lastCheckInAt ? formatDayAndTime(senior.data.lastCheckInAt) : undefined}
          icon={Clock3}
          tone="neutral"
          loading={senior.status === "loading" && !senior.data}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ------------------------------------------------------ timeline */}
        <Card className="lg:col-span-7">
          <CardHeader
            title="Daily Timeline"
            description="Rajesh's full day, updated as he completes each activity."
            icon={<CalendarClock size={20} />}
            action={
              stats.total > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-calm-50 px-3 py-1.5 text-xs font-bold text-calm-800">
                  <CheckCircle2 size={14} />
                  {stats.completed}/{stats.total} done
                </span>
              ) : null
            }
          />
          <div className="mt-5">
            <DailySchedule
              items={schedule.data}
              status={schedule.status}
              error={schedule.error}
              onRetry={schedule.reload}
              variant="timeline"
            />
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          {/* --------------------------------------------------- alerts */}
          <Card id="alerts">
            <CardHeader
              title="Alerts"
              description={
                unacknowledgedAlerts.length > 0
                  ? `${unacknowledgedAlerts.length} awaiting your review`
                  : "Everything reviewed"
              }
              icon={<BellRing size={20} />}
            />
            <div className="mt-5">
              <AlertPanel
                alerts={alerts.data}
                status={alerts.status}
                error={alerts.error}
                onRetry={alerts.reload}
                onAcknowledge={(id) => void acknowledge(id)}
                isNew={isNewAlert}
                limit={4}
              />
            </div>
          </Card>

          {/* -------------------------------------------------- wellness */}
          <Card>
            <CardHeader
              title="Wellness"
              description="Mood and recent well-being reports."
              icon={<HeartPulse size={20} />}
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Current Mood
                </p>
                <div className="mt-2">
                  {mood ? (
                    <MoodPill mood={mood} size="md" />
                  ) : (
                    <span className="text-sm text-ink-500">No check-in yet</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Last Check-in
                </p>
                <p className="mt-2 text-lg font-bold text-ink-900">
                  {senior.data ? formatTimestamp(senior.data.lastCheckInAt) : "—"}
                </p>
              </div>
            </div>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink-500">
              Recent Wellness Reports
            </h3>
            <div className="mt-3">
              <WellnessReports
                reports={wellnessReports.data}
                status={wellnessReports.status}
                error={wellnessReports.error}
                onRetry={wellnessReports.reload}
                limit={3}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------- recent conversations */}
      <Card>
        <CardHeader
          title="Recent Conversations"
          description="What Rajesh and his companion talked about."
          icon={<MessagesSquare size={20} />}
          action={
            <Link
              href="/caregiver/conversations"
              className="rounded-xl border border-ink-200 px-3.5 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
            >
              View all
            </Link>
          }
        />

        <div className="mt-5">
          <ResourceView
            status={conversations.status}
            data={conversations.data}
            error={conversations.error}
            onRetry={conversations.reload}
            subject="conversations"
            loadingRows={2}
            empty={{ title: "No conversations yet", icon: <MessagesSquare size={24} /> }}
          >
            {(items) => (
              <ul className="grid gap-3 md:grid-cols-3">
                {items.slice(0, 3).map((conversation) => {
                  const lastSeniorLine = [...conversation.messages]
                    .reverse()
                    .find((message) => message.role === "senior");

                  return (
                    <li
                      key={conversation.id}
                      className="rounded-xl border border-ink-200 bg-ink-50/50 p-4"
                    >
                      <p className="text-xs font-semibold tabular-nums text-ink-500">
                        {formatDayAndTime(conversation.startedAt)}
                      </p>
                      <p className="mt-1.5 font-semibold text-ink-900">{conversation.summary}</p>
                      {lastSeniorLine ? (
                        <p className="mt-2 text-sm text-ink-600">
                          &ldquo;{lastSeniorLine.text}&rdquo;
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs text-ink-500">
                        {conversation.messages.length} messages
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </ResourceView>
        </div>
      </Card>
    </div>
  );
}
