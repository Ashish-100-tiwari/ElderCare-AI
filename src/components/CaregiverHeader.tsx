"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookUser, LayoutDashboard, MessagesSquare, RotateCcw, UserCog } from "lucide-react";
import { useState } from "react";

import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { useElderCare } from "./providers/ElderCareProvider";
import { LivePill } from "./ui/StatusPill";
import { Skeleton } from "./ui/StateView";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const NAV = [
  { href: "/caregiver", label: "Dashboard", icon: LayoutDashboard },
  { href: "/caregiver/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/caregiver/knowledge-base", label: "Knowledge Base", icon: BookUser },
  { href: "/caregiver/profile", label: "Profile", icon: UserCog },
] as const;

export function CaregiverHeader() {
  const pathname = usePathname();
  const { senior, unacknowledgedAlerts, resetDemo } = useElderCare();
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    await resetDemo();
    setResetting(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5">
          <div className="flex items-center gap-4">
            <Link href="/caregiver" aria-label="ElderCare AI caregiver home">
              <Logo size="sm" tagline="Caregiver Dashboard" />
            </Link>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Senior summary */}
            {senior.data ? (
              <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-ink-50/70 px-3 py-2">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-calm-400 to-calm-700 text-sm font-bold text-white"
                  aria-hidden="true"
                >
                  {initials(senior.data.name)}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-ink-900">{senior.data.name}</p>
                  <p className="text-xs text-ink-600">Age: {senior.data.age}</p>
                </div>
                <span className="ml-1">
                  {senior.data.status === "active" ? (
                    <LivePill label="Active" />
                  ) : (
                    <span className="rounded-full border border-ink-300 bg-white px-2.5 py-1 text-xs font-semibold capitalize text-ink-600">
                      {senior.data.status}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <Skeleton className="h-14 w-56" />
            )}

            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={resetting}
              className="hidden items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 disabled:opacity-60 sm:inline-flex"
              title="Reset the demo data"
            >
              <RotateCcw size={14} className={resetting ? "animate-spin" : undefined} />
              {resetting ? "Resetting…" : "Reset demo"}
            </button>

            <Link
              href="/senior"
              className="rounded-xl bg-calm-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-calm-700"
            >
              Senior view
            </Link>

            <SignOutButton />
          </div>
        </div>

        {/* Section nav */}
        <nav aria-label="Caregiver sections" className="-mb-px flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const showBadge = item.href === "/caregiver" && unacknowledgedAlerts.length > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-calm-600 text-calm-800"
                    : "border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900",
                )}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
                {showBadge ? (
                  <span className="ml-0.5 grid min-w-5 place-items-center rounded-full bg-care-600 px-1.5 text-[11px] font-bold text-white">
                    {unacknowledgedAlerts.length}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
