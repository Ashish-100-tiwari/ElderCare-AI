"use client";

import { CalendarClock, Check, Heart, RotateCcw, Save, UserCog, Users } from "lucide-react";
import { useState } from "react";

import { useElderCare } from "@/components/providers/ElderCareProvider";
import { BigButton } from "@/components/ui/BigButton";
import { Card, CardHeader } from "@/components/ui/Card";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/ui/Field";
import { ResourceView } from "@/components/ui/StateView";
import type { Senior, SeniorUpdate } from "@/lib/types";

/**
 * Editable senior profile. Saving goes through the API layer, which updates
 * the backend when one is connected and the demo store otherwise. Changing a
 * routine time also shifts that activity on the daily schedule.
 */

interface FormState {
  name: string;
  firstName: string;
  age: string;
  language: string;
  city: string;
  wakeUp: string;
  meditation: string;
  breakfast: string;
  walking: string;
  lunch: string;
  rest: string;
  relaxation: string;
  sleep: string;
  interests: string;
  communicationStyle: string;
  dailyActivityGoalSteps: string;
  meditationDurationMinutes: string;
  familyName: string;
  familyRelationship: string;
  familyPhone: string;
  familyEmail: string;
  notifyOnDiscomfort: boolean;
}

function toForm(senior: Senior): FormState {
  return {
    name: senior.name,
    firstName: senior.firstName,
    age: String(senior.age),
    language: senior.language,
    city: senior.city,
    wakeUp: senior.routine.wakeUp,
    meditation: senior.routine.meditation,
    breakfast: senior.routine.breakfast,
    walking: senior.routine.walking,
    lunch: senior.routine.lunch,
    rest: senior.routine.rest,
    relaxation: senior.routine.relaxation,
    sleep: senior.routine.sleep,
    interests: senior.preferences.interests.join(", "),
    communicationStyle: senior.preferences.communicationStyle,
    dailyActivityGoalSteps: String(senior.preferences.dailyActivityGoalSteps),
    meditationDurationMinutes: String(senior.preferences.meditationDurationMinutes),
    familyName: senior.familyContact.name,
    familyRelationship: senior.familyContact.relationship,
    familyPhone: senior.familyContact.phone,
    familyEmail: senior.familyContact.email,
    notifyOnDiscomfort: senior.familyContact.notifyOnDiscomfort,
  };
}

function toUpdate(form: FormState): SeniorUpdate {
  return {
    name: form.name.trim(),
    firstName: form.firstName.trim(),
    age: Number(form.age) || 0,
    language: form.language,
    city: form.city.trim(),
    routine: {
      wakeUp: form.wakeUp,
      meditation: form.meditation,
      breakfast: form.breakfast,
      walking: form.walking,
      lunch: form.lunch,
      rest: form.rest,
      relaxation: form.relaxation,
      sleep: form.sleep,
    },
    preferences: {
      preferredLanguage: form.language,
      interests: form.interests
        .split(",")
        .map((interest) => interest.trim())
        .filter(Boolean),
      communicationStyle: form.communicationStyle.trim(),
      dailyActivityGoalSteps: Number(form.dailyActivityGoalSteps) || 0,
      meditationDurationMinutes: Number(form.meditationDurationMinutes) || 10,
    },
    familyContact: {
      name: form.familyName.trim(),
      relationship: form.familyRelationship.trim(),
      phone: form.familyPhone.trim(),
      email: form.familyEmail.trim(),
      notifyOnDiscomfort: form.notifyOnDiscomfort,
    },
  };
}

export default function CaregiverProfilePage() {
  const { senior, saveSenior } = useElderCare();

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Edits are held in `draft`; until the caregiver touches something, the form
   * is derived straight from the loaded senior. That way there is no effect
   * copying server data into state, and "Reset" is just `setDraft(null)`.
   */
  const [draft, setDraft] = useState<FormState | null>(null);
  const form = draft ?? (senior.data ? toForm(senior.data) : null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!form) return;
    setDraft({ ...form, [key]: value });
    setSaveState("idle");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;

    setSaveState("saving");
    setSaveError(null);
    try {
      await saveSenior(toUpdate(form));
      // Drop the draft so the form re-derives from what was actually saved.
      setDraft(null);
      setSaveState("saved");
      window.setTimeout(() => setSaveState((current) => (current === "saved" ? "idle" : current)), 3000);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "We couldn't save these changes.");
    }
  }

  return (
    <ResourceView
      status={senior.status}
      data={senior.data}
      error={senior.error}
      onRetry={senior.reload}
      subject="senior information"
      loadingRows={6}
    >
      {(data) =>
        form === null ? null : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">Profile</h1>
                <p className="mt-1 text-sm text-ink-600">
                  Update {data.firstName}&rsquo;s details, routine and family contact.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <BigButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw size={16} />}
                  onClick={() => {
                    setDraft(null);
                    setSaveState("idle");
                  }}
                >
                  Reset
                </BigButton>
                <BigButton
                  type="submit"
                  size="md"
                  disabled={saveState === "saving"}
                  icon={saveState === "saved" ? <Check size={18} /> : <Save size={18} />}
                >
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved"
                      : "Save changes"}
                </BigButton>
              </div>
            </div>

            {saveState === "error" ? (
              <p role="alert" className="rounded-xl border-2 border-care-300 bg-care-50 p-4 text-sm font-semibold text-care-800">
                {saveError}
              </p>
            ) : null}

            {saveState === "saved" ? (
              <p role="status" className="rounded-xl border-2 border-calm-300 bg-calm-50 p-4 text-sm font-semibold text-calm-800">
                Changes saved. {data.firstName}&rsquo;s schedule has been updated to match.
              </p>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              {/* ------------------------------------------------ personal */}
              <Card>
                <CardHeader title="Personal Information" icon={<UserCog size={20} />} />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="name"
                    label="Name"
                    value={form.name}
                    onChange={(event) => set("name", event.target.value)}
                    required
                  />
                  <TextField
                    id="firstName"
                    label="Preferred name"
                    hint="Used when the companion greets him."
                    value={form.firstName}
                    onChange={(event) => set("firstName", event.target.value)}
                    required
                  />
                  <TextField
                    id="age"
                    label="Age"
                    type="number"
                    min={40}
                    max={120}
                    value={form.age}
                    onChange={(event) => set("age", event.target.value)}
                    required
                  />
                  <SelectField
                    id="language"
                    label="Language"
                    value={form.language}
                    onChange={(event) => set("language", event.target.value)}
                    options={[
                      { value: "Hindi", label: "Hindi" },
                      { value: "English", label: "English" },
                      { value: "Marathi", label: "Marathi" },
                      { value: "Tamil", label: "Tamil" },
                      { value: "Bengali", label: "Bengali" },
                    ]}
                  />
                  <TextField
                    id="city"
                    label="City"
                    value={form.city}
                    onChange={(event) => set("city", event.target.value)}
                    className="sm:col-span-2"
                  />
                </div>
              </Card>

              {/* ------------------------------------------------- routine */}
              <Card>
                <CardHeader
                  title="Daily Routine"
                  description="Changing a time moves that activity on today's schedule."
                  icon={<CalendarClock size={20} />}
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["wakeUp", "Wake-up time"],
                      ["meditation", "Meditation time"],
                      ["breakfast", "Breakfast time"],
                      ["walking", "Walking time"],
                      ["lunch", "Lunch time"],
                      ["rest", "Rest time"],
                      ["relaxation", "Relaxation time"],
                      ["sleep", "Sleep time"],
                    ] as const
                  ).map(([key, label]) => (
                    <TextField
                      key={key}
                      id={key}
                      label={label}
                      type="time"
                      value={form[key]}
                      onChange={(event) => set(key, event.target.value)}
                    />
                  ))}
                </div>
              </Card>

              {/* --------------------------------------------- preferences */}
              <Card>
                <CardHeader title="Preferences" icon={<Heart size={20} />} />
                <div className="mt-5 grid gap-4">
                  <TextField
                    id="interests"
                    label="Interests"
                    hint="Comma separated — the companion uses these to make conversation."
                    value={form.interests}
                    onChange={(event) => set("interests", event.target.value)}
                  />
                  <TextAreaField
                    id="communicationStyle"
                    label="Communication style"
                    rows={2}
                    value={form.communicationStyle}
                    onChange={(event) => set("communicationStyle", event.target.value)}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      id="dailyActivityGoalSteps"
                      label="Daily walking goal"
                      type="number"
                      min={0}
                      step={500}
                      hint="steps per day"
                      value={form.dailyActivityGoalSteps}
                      onChange={(event) => set("dailyActivityGoalSteps", event.target.value)}
                    />
                    <TextField
                      id="meditationDurationMinutes"
                      label="Meditation duration"
                      type="number"
                      min={1}
                      max={60}
                      hint="minutes"
                      value={form.meditationDurationMinutes}
                      onChange={(event) => set("meditationDurationMinutes", event.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* --------------------------------------------------- family */}
              <Card>
                <CardHeader
                  title="Family Contact"
                  description="Who we notify when discomfort is reported."
                  icon={<Users size={20} />}
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <TextField
                    id="familyName"
                    label="Name"
                    value={form.familyName}
                    onChange={(event) => set("familyName", event.target.value)}
                  />
                  <TextField
                    id="familyRelationship"
                    label="Relationship"
                    value={form.familyRelationship}
                    onChange={(event) => set("familyRelationship", event.target.value)}
                  />
                  <TextField
                    id="familyPhone"
                    label="Phone"
                    type="tel"
                    value={form.familyPhone}
                    onChange={(event) => set("familyPhone", event.target.value)}
                  />
                  <TextField
                    id="familyEmail"
                    label="Email"
                    type="email"
                    value={form.familyEmail}
                    onChange={(event) => set("familyEmail", event.target.value)}
                  />
                  <div className="sm:col-span-2">
                    <ToggleField
                      id="notifyOnDiscomfort"
                      label="Notify on discomfort"
                      description="Send a webhook notification the moment discomfort is reported."
                      checked={form.notifyOnDiscomfort}
                      onChange={(checked) => set("notifyOnDiscomfort", checked)}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </form>
        )
      }
    </ResourceView>
  );
}
