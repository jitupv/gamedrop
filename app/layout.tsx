import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://gamedrop-ten.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "GAMEDROP — a brand-new game every Friday",
  description:
    "Six original games. A fresh daily challenge in every one. Play today's free.",
  openGraph: {
    title: "GAMEDROP — a brand-new game every Friday",
    description: "Six original games. A fresh daily challenge in every one. Play today's free.",
    siteName: "GAMEDROP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GAMEDROP — a brand-new game every Friday",
    description: "Six original games. A fresh daily challenge in every one. Play today's free.",
  },
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
