import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Analytics from "@/components/Analytics";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// FA CSS is imported above once - stop the runtime from injecting it (avoids icon flash)
config.autoAddCss = false;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
  ],
};

const DESC =
  "A brand-new game every Friday, each with a fresh daily challenge and an endless mode. Free to play, no download.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "GAMEDROP - a brand-new game every Friday",
  description: DESC,
  openGraph: {
    title: "GAMEDROP - a brand-new game every Friday",
    description: DESC,
    siteName: "GAMEDROP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GAMEDROP - a brand-new game every Friday",
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* set theme before paint - light is the default, dark only if chosen */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t='light';try{var s=localStorage.getItem('gd:theme');if(s==='dark'||s==='light')t=s;}catch(e){}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <Analytics />
        {children}
      </body>
    </html>
  );
}
