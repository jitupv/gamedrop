import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["rush"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/rush" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/rush",
    type: "website",
  },
};

export default function RushLayout({ children }: { children: React.ReactNode }) {
  return children;
}
