import type { ReactNode } from "react";

import { CaregiverHeader } from "@/components/CaregiverHeader";

export default function CaregiverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <CaregiverHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-ink-200 bg-white px-4 py-5 text-center text-xs text-ink-500">
        ElderCare AI records what Rajesh says in his own words. It does not diagnose or provide
        medical advice — always follow up directly for anything concerning.
      </footer>
    </div>
  );
}
