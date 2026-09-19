"use client";

import { ArrowLeft, Heart, Phone, Type, UserRound, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";

import { useElderCare } from "@/components/providers/ElderCareProvider";
import { Card, CardHeader } from "@/components/ui/Card";
import { BigButton } from "@/components/ui/BigButton";
import { ResourceView } from "@/components/ui/StateView";
import { formatClock } from "@/lib/format";

/**
 * A read-only, reassuring view of "who I am" for the senior, plus the two
 * settings they might actually want to change themselves.
 */
export default function SeniorProfilePage() {
  const { senior, preferences, updatePreferences } = useElderCare();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/senior"
        className="inline-flex items-center gap-2 rounded-2xl px-2 py-2 text-lg font-semibold text-ink-700 hover:text-calm-700"
      >
        <ArrowLeft size={22} aria-hidden="true" />
        Back to home
      </Link>

      <ResourceView
        status={senior.status}
        data={senior.data}
        error={senior.error}
        onRetry={senior.reload}
        tone="senior"
        subject="senior information"
      >
        {(data) => (
          <div className="mt-4 space-y-6">
            <Card tone="senior" padding="lg">
              <div className="flex flex-col items-center text-center">
                <span
                  className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-calm-300 to-calm-700 text-white"
                  aria-hidden="true"
                >
                  <UserRound size={48} />
                </span>
                <h1 className="mt-4 text-3xl font-bold text-ink-900 sm:text-4xl">{data.name}</h1>
                <p className="mt-1 text-xl text-ink-600">
                  {data.age} years · {data.city}
                </p>
              </div>

              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                <Fact label="Language" value={data.language} />
                <Fact label="Wake up" value={formatClock(data.routine.wakeUp)} />
                <Fact label="Meditation" value={formatClock(data.routine.meditation)} />
                <Fact label="Walk" value={formatClock(data.routine.walking)} />
                <Fact label="Sleep" value={formatClock(data.routine.sleep)} />
                <Fact label="Walking goal" value={`${data.preferences.dailyActivityGoalSteps} steps`} />
              </dl>
            </Card>

            <Card tone="senior" padding="lg">
              <CardHeader
                tone="senior"
                title="Things you enjoy"
                icon={<Heart size={26} />}
              />
              <ul className="mt-4 flex flex-wrap gap-3">
                {data.preferences.interests.map((interest) => (
                  <li
                    key={interest}
                    className="rounded-full border-2 border-calm-200 bg-calm-50 px-5 py-2.5 text-xl font-semibold text-calm-800"
                  >
                    {interest}
                  </li>
                ))}
              </ul>
            </Card>

            <Card tone="senior" padding="lg">
              <CardHeader
                tone="senior"
                title="Family"
                description="The person we tell if you're not feeling well."
                icon={<Phone size={26} />}
              />
              <div className="mt-4 rounded-3xl border-2 border-ink-200 bg-ink-50/60 p-5">
                <p className="text-2xl font-bold text-ink-900">{data.familyContact.name}</p>
                <p className="mt-1 text-xl text-ink-600">{data.familyContact.relationship}</p>
                <a
                  href={`tel:${data.familyContact.phone.replace(/\s/g, "")}`}
                  className="mt-4 inline-flex min-h-16 items-center gap-3 rounded-3xl bg-calm-600 px-6 text-xl font-bold text-white hover:bg-calm-700"
                >
                  <Phone size={24} aria-hidden="true" />
                  Call {data.familyContact.name.split(" ")[0]}
                </a>
              </div>
            </Card>

            <Card tone="senior" padding="lg">
              <CardHeader tone="senior" title="Settings" icon={<Type size={26} />} />
              <div className="mt-5 space-y-4">
                <BigButton
                  variant={preferences.voiceEnabled ? "primary" : "secondary"}
                  size="lg"
                  fullWidth
                  onClick={() => updatePreferences({ voiceEnabled: !preferences.voiceEnabled })}
                  icon={preferences.voiceEnabled ? <Volume2 size={26} /> : <VolumeX size={26} />}
                >
                  {preferences.voiceEnabled ? "Voice replies are on" : "Voice replies are off"}
                </BigButton>
              </div>
            </Card>
          </div>
        )}
      </ResourceView>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border-2 border-ink-200 bg-ink-50/50 p-4">
      <dt className="text-lg text-ink-600">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold text-ink-900">{value}</dd>
    </div>
  );
}
