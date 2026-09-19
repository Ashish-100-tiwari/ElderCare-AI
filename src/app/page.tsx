import Link from "next/link";
import { ArrowRight, HeartPulse, ShieldCheck, Sparkles } from "lucide-react";

import { Logo } from "@/components/Logo";

/**
 * Role chooser. Seniors normally launch straight into /senior on their own
 * device — this exists so a presenter can move between both experiences.
 */
export default function HomePage() {
  return (
    <main
      id="main"
      className="senior-scope mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-5 py-12 sm:px-8"
    >
      <Logo size="lg" className="mb-10" />

      <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
        A calm, familiar companion for every day.
      </h1>
      <p className="mt-4 max-w-2xl text-xl text-ink-600">
        ElderCare AI greets Rajesh each morning, guides his meditation, keeps his routine on track,
        and quietly keeps his family in the loop.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Link
          href="/senior"
          className="group flex flex-col rounded-4xl border-2 border-calm-300 bg-white p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:border-calm-500 hover:shadow-lift"
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-calm-100 text-calm-700">
            <HeartPulse size={30} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-3xl font-bold text-ink-900">I am Rajesh</h2>
          <p className="mt-2 flex-1 text-lg text-ink-600">
            Talk to your companion, see today&rsquo;s plan, and start your meditation.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-xl font-bold text-calm-700">
            Open my companion
            <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          href="/caregiver"
          className="group flex flex-col rounded-4xl border-2 border-ink-300 bg-white p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lift"
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
            <ShieldCheck size={30} aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-3xl font-bold text-ink-900">I am family</h2>
          <p className="mt-2 flex-1 text-lg text-ink-600">
            See Rajesh&rsquo;s day, his well-being reports, recent conversations and any alerts.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-xl font-bold text-brand-700">
            Open caregiver dashboard
            <ArrowRight size={22} className="transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <p className="mt-10 inline-flex items-center gap-2 text-base text-ink-500">
        <Sparkles size={18} aria-hidden="true" />
        ElderCare AI offers companionship and reminders. It never diagnoses or gives medical advice.
      </p>
    </main>
  );
}
