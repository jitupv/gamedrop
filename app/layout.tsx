import type { Metadata } from "next";
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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
