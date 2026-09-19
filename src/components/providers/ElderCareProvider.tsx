"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import * as api from "@/lib/api";
import { useResource, type Resource } from "@/lib/hooks/useResource";
import {
  applyScheduleOverrides,
  cacheDemoAlerts,
  clearAllStorage,
  getDemoAlerts,
  getMeditationState,
  getUiPreferences,
  isMeditationDoneToday,
  saveMeditationCompletion,
  setLastMood,
  setScheduleOverride,
  setUiPreferences,
  type UiPreferences,
} from "@/lib/localStorage";
import type {
  Alert,
  Conversation,
  Mood,
  ScheduleItem,
  ScheduleStatus,
  SendMessageResult,
  Senior,
  SeniorUpdate,
  WellnessReport,
} from "@/lib/types";

/**
 * One shared data layer for both experiences.
 *
 * Keeping it in the root layout means an alert raised on the senior screen is
 * already in memory when the presenter navigates to /caregiver — the demo
 * flows without a reload, and there is exactly one place that knows how to
 * talk to the API.
 */

interface ElderCareValue {
  senior: Resource<Senior>;
  schedule: Resource<ScheduleItem[]>;
  alerts: Resource<Alert[]>;
  wellnessReports: Resource<WellnessReport[]>;
  conversations: Resource<Conversation[]>;

  /** Alerts raised since this browser session began — drives the "New" badge. */
  isNewAlert: (alert: Alert) => boolean;
  unacknowledgedAlerts: Alert[];
  latestAlert: Alert | null;

  meditationDoneToday: boolean;
  preferences: UiPreferences;
  updatePreferences: (next: Partial<UiPreferences>) => void;

  setScheduleStatus: (id: string, status: ScheduleStatus) => Promise<void>;
  finishMeditation: (minutes: number) => Promise<void>;
  sendCompanionMessage: (text: string, source?: "text" | "voice") => Promise<SendMessageResult>;
  submitMood: (mood: Mood) => Promise<SendMessageResult>;
  acknowledge: (id: string) => Promise<void>;
  saveSenior: (update: SeniorUpdate) => Promise<Senior>;
  refreshAll: () => void;
  resetDemo: () => Promise<void>;
}

const ElderCareContext = createContext<ElderCareValue | null>(null);

const ALERT_POLL_MS = 20_000;
const NEW_ALERT_WINDOW_MS = 10 * 60 * 1000;

export function ElderCareProvider({ children }: { children: ReactNode }) {
  /**
   * When this browser session began — used to mark alerts raised while the
   * caregiver was watching. Read from the clock after mount, not during render,
   * so render stays pure. Until then it is +∞, which makes nothing look "new"
   * by this test; the ten-minute window below still catches recent alerts.
   */
  const sessionStartedAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    sessionStartedAt.current = Date.now();
  }, []);

  const senior = useResource<Senior>(api.getSenior);

  const schedule = useResource<ScheduleItem[]>(
    useCallback(async () => applyScheduleOverrides(await api.getSchedule()), []),
    { isEmpty: (items) => items.length === 0 },
  );

  const alerts = useResource<Alert[]>(api.getAlerts, {
    isEmpty: (items) => items.length === 0,
    refreshIntervalMs: ALERT_POLL_MS,
  });

  const wellnessReports = useResource<WellnessReport[]>(api.getWellnessReports, {
    isEmpty: (items) => items.length === 0,
    refreshIntervalMs: ALERT_POLL_MS,
  });

  const conversations = useResource<Conversation[]>(api.getConversations, {
    isEmpty: (items) => items.length === 0,
  });

  const [meditationDoneToday, setMeditationDoneToday] = useState(false);
  const [preferences, setPreferences] = useState<UiPreferences>(getUiPreferences);

  // Hydrate from localStorage after mount so SSR markup stays stable.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is a browser-only external store; reading it during render would break hydration
    setMeditationDoneToday(isMeditationDoneToday());
    setPreferences(getUiPreferences());

    const cached = getDemoAlerts();
    if (cached.length > 0) {
      alerts.mutate((current) => (current && current.length > 0 ? current : cached));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-off hydration
  }, []);

  // Keep a local copy of alerts so a page refresh mid-demo still shows them.
  useEffect(() => {
    if (alerts.data) cacheDemoAlerts(alerts.data);
  }, [alerts.data]);

  // A completed meditation locally should be reflected in the schedule too.
  useEffect(() => {
    if (!meditationDoneToday) return;
    schedule.mutate((items) =>
      items
        ? items.map((item) =>
            item.id === "sch_meditation" && item.status !== "completed"
              ? { ...item, status: "completed", completedAt: getMeditationState().completedAt }
              : item,
          )
        : items,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedule.mutate is stable
  }, [meditationDoneToday]);

  const updatePreferences = useCallback((next: Partial<UiPreferences>) => {
    setPreferences(setUiPreferences(next));
  }, []);

  const setScheduleStatus = useCallback(
    async (id: string, status: ScheduleStatus) => {
      const completedAt = status === "completed" ? new Date().toISOString() : null;

      // Optimistic: the senior sees the tick instantly.
      schedule.mutate((items) =>
        items ? items.map((item) => (item.id === id ? { ...item, status, completedAt } : item)) : items,
      );
      setScheduleOverride(id, status, completedAt);

      try {
        await api.updateSchedule(id, { status, completedAt });
      } catch {
        // The local override keeps the UI truthful to what the senior did;
        // the next successful poll reconciles with the server.
      }
    },
    [schedule],
  );

  const finishMeditation = useCallback(
    async (minutes: number) => {
      saveMeditationCompletion(minutes);
      setMeditationDoneToday(true);
      schedule.mutate((items) =>
        items
          ? items.map((item) =>
              item.id === "sch_meditation"
                ? { ...item, status: "completed", completedAt: new Date().toISOString() }
                : item,
            )
          : items,
      );

      try {
        await api.completeMeditation(minutes);
      } catch {
        /* localStorage already recorded it; nothing user-facing to do */
      } finally {
        senior.reload();
      }
    },
    [schedule, senior],
  );

  /** Folds a conversation turn's side effects into the shared state. */
  const absorbResult = useCallback(
    (result: SendMessageResult) => {
      if (result.wellnessReport) {
        const report = result.wellnessReport;
        wellnessReports.mutate((items) => [report, ...(items ?? []).filter((r) => r.id !== report.id)]);
      }
      if (result.alert) {
        const alert = result.alert;
        alerts.mutate((items) => [alert, ...(items ?? []).filter((a) => a.id !== alert.id)]);
      }
      senior.reload();
      conversations.reload();
    },
    [alerts, wellnessReports, senior, conversations],
  );

  const sendCompanionMessage = useCallback(
    async (text: string, source: "text" | "voice" = "text") => {
      const result = await api.sendMessage({ text, source });
      absorbResult(result);
      return result;
    },
    [absorbResult],
  );

  const submitMood = useCallback(
    async (mood: Mood) => {
      setLastMood(mood);
      const result = await api.submitWellnessCheck(mood);
      absorbResult(result);
      return result;
    },
    [absorbResult],
  );

  const acknowledge = useCallback(
    async (id: string) => {
      alerts.mutate((items) =>
        items
          ? items.map((alert) =>
              alert.id === id
                ? { ...alert, acknowledged: true, acknowledgedAt: new Date().toISOString() }
                : alert,
            )
          : items,
      );
      try {
        await api.acknowledgeAlert(id);
      } catch {
        alerts.reload();
      }
    },
    [alerts],
  );

  const saveSenior = useCallback(
    async (update: SeniorUpdate) => {
      const updated = await api.updateSenior(update);
      senior.mutate(updated);
      schedule.reload();
      return updated;
    },
    [senior, schedule],
  );

  const refreshAll = useCallback(() => {
    senior.reload();
    schedule.reload();
    alerts.reload();
    wellnessReports.reload();
    conversations.reload();
  }, [senior, schedule, alerts, wellnessReports, conversations]);

  const resetDemo = useCallback(async () => {
    clearAllStorage();
    setMeditationDoneToday(false);
    setPreferences(getUiPreferences());
    await api.resetDemo().catch(() => undefined);
    refreshAll();
  }, [refreshAll]);

  const isNewAlert = useCallback((alert: Alert) => {
    if (alert.acknowledged) return false;
    const created = new Date(alert.createdAt).getTime();
    return created >= sessionStartedAt.current || Date.now() - created < NEW_ALERT_WINDOW_MS;
  }, []);

  const unacknowledgedAlerts = useMemo(
    () => (alerts.data ?? []).filter((alert) => !alert.acknowledged),
    [alerts.data],
  );

  const value = useMemo<ElderCareValue>(
    () => ({
      senior,
      schedule,
      alerts,
      wellnessReports,
      conversations,
      isNewAlert,
      unacknowledgedAlerts,
      latestAlert: alerts.data?.[0] ?? null,
      meditationDoneToday,
      preferences,
      updatePreferences,
      setScheduleStatus,
      finishMeditation,
      sendCompanionMessage,
      submitMood,
      acknowledge,
      saveSenior,
      refreshAll,
      resetDemo,
    }),
    [
      senior,
      schedule,
      alerts,
      wellnessReports,
      conversations,
      isNewAlert,
      unacknowledgedAlerts,
      meditationDoneToday,
      preferences,
      updatePreferences,
      setScheduleStatus,
      finishMeditation,
      sendCompanionMessage,
      submitMood,
      acknowledge,
      saveSenior,
      refreshAll,
      resetDemo,
    ],
  );

  return <ElderCareContext.Provider value={value}>{children}</ElderCareContext.Provider>;
}

export function useElderCare(): ElderCareValue {
  const context = useContext(ElderCareContext);
  if (!context) {
    throw new Error("useElderCare must be used inside <ElderCareProvider>.");
  }
  return context;
}
