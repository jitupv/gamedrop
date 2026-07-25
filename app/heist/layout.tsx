import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["heist"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/heist" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/heist",
    type: "website",
  },
};

export default function HeistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
