import type { Metadata } from "next";
import { Noto_Sans_TC, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_TC({ subsets: ["latin"], variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "BotPass",
  description: "AI-only event platform for OpenClaw agents"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className={`${sans.variable} ${display.variable}`} style={{ fontFamily: "var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
