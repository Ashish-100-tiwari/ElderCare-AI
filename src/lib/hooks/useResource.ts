"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ResourceStatus } from "@/lib/types";

export interface Resource<T> {
  data: T | null;
  status: ResourceStatus;
  error: string | null;
  /** True while a background refresh runs over data we already have. */
  isRefreshing: boolean;
  reload: () => void;
  /** Optimistically replace the local copy without a round trip. */
  mutate: (updater: T | ((current: T | null) => T | null)) => void;
}

interface UseResourceOptions<T> {
  /** Decides whether a successful response should render the empty state. */
  isEmpty?: (data: T) => boolean;
  /** Seed from a cache (e.g. localStorage) to skip the spinner entirely. */
  initialData?: T | null;
  /** Poll interval in ms. Omit for no polling. */
  refreshIntervalMs?: number;
  enabled?: boolean;
}

/**
 * Loads one API resource and exposes the four states every screen must
 * handle: loading, error, empty and success.
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  options: UseResourceOptions<T> = {},
): Resource<T> {
  const { isEmpty, initialData = null, refreshIntervalMs, enabled = true } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [status, setStatus] = useState<ResourceStatus>(initialData ? "success" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep the latest fetcher without making it a dependency, so callers can
  // pass inline arrow functions without causing refetch loops.
  const fetcherRef = useRef(fetcher);
  // Assigned in an effect rather than during render: refs are not render output.
  // No dependency array, so it tracks every render — and effects run in
  // declaration order, so the load effect below always sees the current fetcher.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const hasData = data !== null;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "refresh") setIsRefreshing(true);
      else setStatus((current) => (current === "success" ? current : "loading"));

      try {
        const result = await fetcherRef.current();
        if (!mountedRef.current) return;
        setData(result);
        setError(null);
        setStatus(isEmpty?.(result) ? "empty" : "success");
      } catch (caught) {
        if (!mountedRef.current) return;
        setError(caught instanceof Error ? caught.message : "Something went wrong.");
        // A failed background refresh keeps the data already on screen.
        if (mode === "initial") setStatus("error");
      } finally {
        if (mountedRef.current) setIsRefreshing(false);
      }
    },
    [isEmpty],
  );

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting the fetch (and showing "loading" while it runs) is this effect's whole purpose
    void load(hasData ? "refresh" : "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only; `reload` covers the rest
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !refreshIntervalMs) return;
    const timer = window.setInterval(() => void load("refresh"), refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, refreshIntervalMs, load]);

  const reload = useCallback(() => {
    void load(data === null ? "initial" : "refresh");
  }, [load, data]);

  const mutate = useCallback(
    (updater: T | ((current: T | null) => T | null)) => {
      setData((current) => {
        const next =
          typeof updater === "function" ? (updater as (c: T | null) => T | null)(current) : updater;
        if (next !== null) setStatus(isEmpty?.(next) ? "empty" : "success");
        return next;
      });
    },
    [isEmpty],
  );

  return { data, status, error, isRefreshing, reload, mutate };
}
