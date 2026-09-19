import type { ReactNode } from "react";

import { SeniorHeader } from "@/components/SeniorHeader";

export default function SeniorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="senior-scope flex min-h-dvh flex-col bg-canvas">
      <SeniorHeader />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="border-t-2 border-ink-200/70 px-4 py-6 text-center text-base text-ink-500">
        ElderCare AI is here to keep you company. It does not give medical advice.
      </footer>
    </div>
  );
}
