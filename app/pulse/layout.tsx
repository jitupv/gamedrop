import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT.pulse;
export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/pulse" },
  openGraph: { title: c.playTitle, description: c.playDescription, url: "/pulse", type: "website" },
};
export default function PulseLayout({ children }: { children: React.ReactNode }) { return children; }
