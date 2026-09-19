import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";

import { ElderCareProvider } from "@/components/providers/ElderCareProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/** Rounded and friendly — used across the senior experience. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ElderCare AI — A daily companion for senior citizens",
  description:
    "A GenAI companion that greets seniors each morning, guides meditation, keeps their daily routine on track, and keeps family informed.",
};

export const viewport: Viewport = {
  themeColor: "#fbf6ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${nunito.variable} antialiased`}>
        <a
          href="#main"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-xl bg-calm-700 px-4 py-3 text-lg font-bold text-white"
        >
          Skip to main content
        </a>
        {/* One shared data layer, so an alert raised by the senior is instantly
            visible on the caregiver dashboard. */}
        <ElderCareProvider>{children}</ElderCareProvider>
      </body>
    </html>
  );
}
