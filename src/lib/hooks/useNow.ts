"use client";

import { useEffect, useState } from "react";

/**
 * A ticking clock that is null on the server and during the first paint.
 *
 * Returning null until mount keeps server and client markup identical, which
 * avoids hydration mismatches on anything time-dependent (the header clock,
 * greeting, "up next" highlighting).
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Reading the clock is exactly the "external system" an effect is for, and
    // the first read has to happen here: doing it during render would put a
    // server timestamp in the HTML and mismatch on hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/** True once the component has mounted in the browser. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // The canonical "am I hydrated yet" signal — false in the server markup, true
  // immediately after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
  useEffect(() => setMounted(true), []);
  return mounted;
}
