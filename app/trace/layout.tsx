import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["trace"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/trace" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/trace",
    type: "website",
  },
};

export default function TraceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
