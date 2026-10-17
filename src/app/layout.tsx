import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "earworm. — guess the song",
  description:
    "A Heardle-style music guessing game. One artist, 10 songs, 5 ever-longer snippets. Score points and climb the global leaderboard.",
};

export const viewport: Viewport = {
  themeColor: "#07070c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={grotesk.variable}>
      <body className="font-grotesk min-h-dvh bg-ink antialiased">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
