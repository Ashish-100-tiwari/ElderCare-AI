import { HeartHandshake } from "lucide-react";

import { cn } from "@/lib/cn";

export function Logo({
  size = "md",
  className,
  tagline,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  tagline?: string;
}) {
  const box = { sm: "size-9", md: "size-11", lg: "size-14" }[size];
  const icon = { sm: 20, md: 24, lg: 30 }[size];
  const text = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-calm-400 to-calm-700 text-white shadow-soft",
          box,
        )}
        aria-hidden="true"
      >
        <HeartHandshake size={icon} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className={cn("block font-bold leading-tight tracking-tight text-ink-900", text)}>
          ElderCare <span className="text-calm-700">AI</span>
        </span>
        {tagline ? (
          <span className="block text-xs font-semibold uppercase tracking-wider text-ink-500">
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
