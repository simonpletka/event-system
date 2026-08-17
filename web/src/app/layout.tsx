import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Licensed font (commercial use allowed — see src/fonts/neue-regrade/LICENSE.txt).
// Self-hosted rather than Google Fonts since it isn't published there.
const neueRegrade = localFont({
  src: "../fonts/neue-regrade/NeueRegrade-Variable.ttf",
  variable: "--font-neue-regrade",
  weight: "300 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Event System",
  description: "Internal event-agency system — events, finance, time tracking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${neueRegrade.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-ink font-sans">{children}</body>
    </html>
  );
}
