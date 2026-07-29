import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["prism"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/prism" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/prism",
    type: "website",
  },
};

export default function PrismLayout({ children }: { children: React.ReactNode }) {
  return children;
}
