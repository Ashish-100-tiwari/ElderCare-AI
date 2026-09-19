"use client";

import { AlertTriangle, MessagesSquare } from "lucide-react";

import { useElderCare } from "@/components/providers/ElderCareProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { MoodPill } from "@/components/ui/StatusPill";
import { ResourceView } from "@/components/ui/StateView";
import { cn } from "@/lib/cn";
import { formatDayAndTime, formatTimestamp } from "@/lib/format";

/** Full transcripts, so a caregiver can read exactly what was said. */
export default function CaregiverConversationsPage() {
  const { conversations } = useElderCare();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">Conversations</h1>
        <p className="mt-1 text-sm text-ink-600">
          Everything Rajesh and his companion discussed, newest first.
        </p>
      </div>

      <ResourceView
        status={conversations.status}
        data={conversations.data}
        error={conversations.error}
        onRetry={conversations.reload}
        subject="conversations"
        loadingRows={4}
        empty={{
          title: "No conversations yet",
          detail: "Transcripts appear here as soon as Rajesh talks to his companion.",
          icon: <MessagesSquare size={24} />,
        }}
      >
        {(items) => (
          <div className="space-y-5">
            {items.map((conversation) => {
              const flagged = conversation.messages.some((message) => message.signals?.discomfort);

              return (
                <Card key={conversation.id}>
                  <CardHeader
                    title={conversation.summary}
                    description={`${formatDayAndTime(conversation.startedAt)} · ${
                      conversation.messages.length
                    } messages`}
                    icon={<MessagesSquare size={20} />}
                    action={
                      flagged ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-care-300 bg-care-50 px-3 py-1.5 text-xs font-bold text-care-700">
                          <AlertTriangle size={14} />
                          Discomfort reported
                        </span>
                      ) : conversation.endedAt === null ? (
                        <span className="rounded-full border border-calm-300 bg-calm-50 px-3 py-1.5 text-xs font-bold text-calm-800">
                          Ongoing
                        </span>
                      ) : null
                    }
                  />

                  <ol className="mt-5 space-y-3">
                    {conversation.messages.map((message) => {
                      const fromSenior = message.role === "senior";

                      return (
                        <li
                          key={message.id}
                          className={cn("flex gap-3", fromSenior ? "flex-row-reverse" : "flex-row")}
                        >
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white",
                              fromSenior ? "bg-ink-700" : "bg-gradient-to-br from-calm-400 to-calm-700",
                            )}
                            aria-hidden="true"
                          >
                            {fromSenior ? "RS" : "AI"}
                          </span>

                          <div
                            className={cn(
                              "max-w-[min(38rem,80%)] rounded-2xl border px-4 py-3",
                              fromSenior
                                ? "rounded-br-sm border-ink-200 bg-ink-50"
                                : "rounded-bl-sm border-calm-200 bg-calm-50/70",
                              message.signals?.discomfort && "ring-2 ring-care-300",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
                                {fromSenior ? "Rajesh" : "Asha (AI)"}
                              </p>
                              <p className="text-xs tabular-nums text-ink-400">
                                {formatTimestamp(message.createdAt)}
                              </p>
                              {message.signals?.mood ? <MoodPill mood={message.signals.mood} size="sm" /> : null}
                            </div>
                            <p className="mt-1.5 text-[15px] text-ink-900">{message.text}</p>
                            {message.signals?.topic ? (
                              <p className="mt-2 text-xs capitalize text-ink-500">
                                Topic: {message.signals.topic}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Card>
              );
            })}
          </div>
        )}
      </ResourceView>
    </div>
  );
}
