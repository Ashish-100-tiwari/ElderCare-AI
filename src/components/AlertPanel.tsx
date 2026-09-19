"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BellRing,
  Check,
  ChevronDown,
  Clock,
  MessageSquareQuote,
  ShieldCheck,
  TriangleAlert,
  Webhook,
} from "lucide-react";
import { useState } from "react";

import { SeverityPill, WebhookPill } from "./ui/StatusPill";
import { ResourceView } from "./ui/StateView";
import { BigButton } from "./ui/BigButton";
import { cn } from "@/lib/cn";
import { formatDayAndTime, formatTimestamp } from "@/lib/format";
import type { Alert, ResourceStatus } from "@/lib/types";

/**
 * Discomfort / well-being alerts for the caregiver, including proof that the
 * webhook notification actually went out.
 */

interface AlertPanelProps {
  alerts: Alert[] | null;
  status: ResourceStatus;
  error?: string | null;
  onRetry?: () => void;
  onAcknowledge?: (id: string) => void;
  isNew?: (alert: Alert) => boolean;
  limit?: number;
  className?: string;
}

export function AlertPanel({
  alerts,
  status,
  error,
  onRetry,
  onAcknowledge,
  isNew,
  limit,
  className,
}: AlertPanelProps) {
  return (
    <ResourceView
      status={status}
      data={alerts}
      error={error}
      onRetry={onRetry}
      subject="alerts"
      loadingRows={2}
      empty={{
        title: "No alerts",
        detail: "You'll see an alert here the moment Rajesh reports any discomfort.",
        icon: <ShieldCheck size={24} className="text-calm-600" />,
      }}
    >
      {(items) => (
        <ul className={cn("space-y-3", className)}>
          <AnimatePresence initial={false}>
            {(limit ? items.slice(0, limit) : items).map((alert) => (
              <motion.li
                key={alert.id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28 }}
              >
                <AlertCard
                  alert={alert}
                  isNew={isNew?.(alert) ?? false}
                  onAcknowledge={onAcknowledge}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </ResourceView>
  );
}

function AlertCard({
  alert,
  isNew,
  onAcknowledge,
}: {
  alert: Alert;
  isNew: boolean;
  onAcknowledge?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = !alert.acknowledged;

  return (
    <article
      className={cn(
        "rounded-2xl border-2 p-4 transition-colors sm:p-5",
        active ? "border-care-300 bg-care-50" : "border-ink-200 bg-white",
      )}
      aria-label={`${alert.title} for ${alert.seniorName}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            active ? "bg-care-600 text-white" : "bg-ink-100 text-ink-600",
          )}
          aria-hidden="true"
        >
          {active ? <TriangleAlert size={22} /> : <Check size={22} strokeWidth={3} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-base font-bold", active ? "text-care-900" : "text-ink-800")}>
              {active ? `⚠ ${alert.title}` : alert.title}
            </h3>
            {isNew ? (
              <motion.span
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="rounded-full bg-care-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
              >
                New
              </motion.span>
            ) : null}
            <SeverityPill severity={alert.severity} />
          </div>

          <p className="mt-1 text-sm font-semibold text-ink-700">{alert.seniorName}</p>

          <blockquote className="mt-3 rounded-xl border-l-4 border-care-400 bg-white/90 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Reported</p>
            <p className="mt-0.5 text-base font-medium text-ink-900">&ldquo;{alert.reportedText}&rdquo;</p>
          </blockquote>

          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-ink-500" aria-hidden="true" />
              <dt className="sr-only">Time</dt>
              <dd className="font-semibold text-ink-800">{formatTimestamp(alert.createdAt)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Webhook size={15} className="text-ink-500" aria-hidden="true" />
              <dt className="font-semibold text-ink-600">Webhook:</dt>
              <dd>
                <WebhookPill status={alert.webhook.status} />
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <BigButton
              size="sm"
              variant="secondary"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              iconRight={
                <ChevronDown
                  size={16}
                  className={cn("transition-transform", open && "rotate-180")}
                />
              }
            >
              View Details
            </BigButton>

            {active && onAcknowledge ? (
              <BigButton size="sm" onClick={() => onAcknowledge(alert.id)} icon={<Check size={16} />}>
                Mark Reviewed
              </BigButton>
            ) : null}

            {!active && alert.acknowledgedAt ? (
              <span className="text-xs font-medium text-ink-500">
                Reviewed {formatDayAndTime(alert.acknowledgedAt)}
              </span>
            ) : null}
          </div>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-xl bg-white p-4 text-sm sm:grid-cols-2">
                  <Detail label="Alert ID" value={<code className="font-mono text-xs">{alert.id}</code>} />
                  <Detail label="Type" value={alert.type.replace("-", " ")} />
                  <Detail label="Raised" value={formatDayAndTime(alert.createdAt)} />
                  <Detail
                    label="Notification sent"
                    value={alert.webhook.sentAt ? formatDayAndTime(alert.webhook.sentAt) : "Not sent"}
                  />
                  <Detail label="Delivery attempts" value={String(alert.webhook.attempts)} />
                  <Detail
                    label="Endpoint"
                    value={<code className="break-all font-mono text-xs">{alert.webhook.endpoint}</code>}
                  />
                  <div className="sm:col-span-2">
                    <Detail
                      label="Related conversation"
                      value={
                        alert.conversationId ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MessageSquareQuote size={14} aria-hidden="true" />
                            <code className="font-mono text-xs">{alert.conversationId}</code>
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                  </div>
                  <p className="text-xs text-ink-500 sm:col-span-2">
                    Recorded from Rajesh&rsquo;s own words. ElderCare AI does not interpret or diagnose
                    symptoms — please follow up directly.
                  </p>
                </dl>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize text-ink-900">{value}</dd>
    </div>
  );
}

/** Compact banner for the top of the dashboard when something needs attention. */
export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const [first] = alerts;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-care-400 bg-care-100 px-4 py-3"
      role="alert"
    >
      <BellRing className="shrink-0 text-care-700" size={22} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-semibold text-care-900 sm:text-base">
        {alerts.length === 1
          ? `${first.seniorName} reported discomfort at ${formatTimestamp(first.createdAt)}.`
          : `${alerts.length} alerts need your attention.`}
      </p>
      <a
        href="#alerts"
        className="rounded-full bg-care-700 px-4 py-2 text-sm font-bold text-white hover:bg-care-800"
      >
        Review now
      </a>
    </motion.div>
  );
}
