import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["sonar"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/sonar" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/sonar",
    type: "website",
  },
};

export default function SonarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
