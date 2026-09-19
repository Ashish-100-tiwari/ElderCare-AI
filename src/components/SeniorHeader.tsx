"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";

import { Logo } from "./Logo";
import { useElderCare } from "./providers/ElderCareProvider";
import { Skeleton } from "./ui/StateView";
import { formatClock, greetingForHour } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";

/**
 * Senior header: identity on the left, a warm greeting in the middle, the
 * time and profile on the right. Nothing else — navigation stays minimal.
 */
export function SeniorHeader() {
  const { senior } = useElderCare();
  const now = useNow(15_000);

  const firstName = senior.data?.firstName;
  const greeting = now ? greetingForHour(now.getHours()) : "Hello";
  const clock = now
    ? formatClock(`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`)
    : null;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink-200/80 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/senior" className="rounded-2xl" aria-label="ElderCare AI home">
          <Logo size="md" />
        </Link>

        <p className="order-3 w-full text-center text-2xl font-bold text-ink-900 sm:order-none sm:w-auto sm:flex-1 sm:text-3xl">
          {firstName ? (
            <>
              {greeting}, <span className="text-calm-700">{firstName}</span>
            </>
          ) : (
            <Skeleton className="mx-auto h-8 w-56" />
          )}
        </p>

        <div className="flex items-center gap-3 sm:gap-4">
          <p
            className="text-right text-2xl font-bold tabular-nums text-ink-800 sm:text-3xl"
            aria-label="Current time"
          >
            {clock ?? <Skeleton className="h-8 w-24" />}
          </p>

          <Link
            href="/senior/profile"
            className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-calm-300 bg-white text-calm-700 transition-colors hover:bg-calm-50"
            aria-label="Your profile"
            title="Your profile"
          >
            <UserRound size={28} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
