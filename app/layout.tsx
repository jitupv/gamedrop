import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAMEDROP — a brand-new game every Friday",
  description:
    "One original game every week. A fresh daily challenge in every game. Play today's free.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="header-glass sticky top-0 z-30 border-b border-stone-300/70">
          <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
            <Link href="/" className="text-lg font-black tracking-[0.25em] text-stone-900">
              GAME<span className="text-amber-700">DROP</span>
            </Link>
            <Nav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
