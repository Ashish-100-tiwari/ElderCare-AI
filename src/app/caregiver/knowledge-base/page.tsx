"use client";

import { BookUser, BrainCircuit, CalendarClock, Heart, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { ResourceView } from "@/components/ui/StateView";
import { useResource } from "@/lib/hooks/useResource";
import { getKnowledgeBase } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDayAndTime } from "@/lib/format";
import type { KnowledgeSource } from "@/lib/types";

/**
 * What the companion knows about the senior — the context it uses in every
 * conversation. Grouped by where each fact came from so the caregiver can
 * tell profile data from things picked up while chatting.
 */

const sectionIcons: Record<string, LucideIcon> = {
  personal: BookUser,
  routine: CalendarClock,
  preferences: Heart,
  family: Users,
};

const sourceStyles: Record<KnowledgeSource, string> = {
  profile: "bg-ink-100 text-ink-600",
  conversation: "bg-calm-100 text-calm-700",
  caregiver: "bg-brand-100 text-brand-700",
};

const sourceLabels: Record<KnowledgeSource, string> = {
  profile: "Profile",
  conversation: "From conversation",
  caregiver: "Set by caregiver",
};

export default function KnowledgeBasePage() {
  const knowledgeBase = useResource(getKnowledgeBase, {
    isEmpty: (data) => data.sections.length === 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">Knowledge Base</h1>
        <p className="mt-1 text-sm text-ink-600">
          The context ElderCare AI uses when it talks with Rajesh.
        </p>
      </div>

      <ResourceView
        status={knowledgeBase.status}
        data={knowledgeBase.data}
        error={knowledgeBase.error}
        onRetry={knowledgeBase.reload}
        subject="the knowledge base"
        loadingRows={5}
        empty={{ title: "Nothing recorded yet", icon: <BrainCircuit size={24} /> }}
      >
        {(data) => (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              {data.sections.map((section) => {
                const Icon = sectionIcons[section.id] ?? BookUser;

                return (
                  <Card key={section.id}>
                    <CardHeader title={section.title} icon={<Icon size={20} />} />
                    <dl className="mt-5 divide-y divide-ink-200">
                      {section.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                        >
                          <dt className="text-sm font-semibold text-ink-600">{entry.label}</dt>
                          <dd className="flex items-center gap-2 text-right text-[15px] font-medium text-ink-900">
                            {entry.value}
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                sourceStyles[entry.source],
                              )}
                            >
                              {sourceLabels[entry.source]}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                );
              })}
            </div>

            {data.learned.length > 0 ? (
              <Card>
                <CardHeader
                  title="Learned from conversations"
                  description="Details the companion picked up on its own. Nothing here is a medical assessment."
                  icon={<Sparkles size={20} />}
                />
                <ul className="mt-5 grid gap-3 md:grid-cols-2">
                  {data.learned.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-calm-200 bg-calm-50/60 p-4"
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-calm-700">
                        {entry.label}
                      </p>
                      <p className="mt-1.5 text-[15px] text-ink-900">{entry.value}</p>
                      <p className="mt-2 text-xs text-ink-500">
                        Noted {formatDayAndTime(entry.updatedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}
      </ResourceView>
    </div>
  );
}
