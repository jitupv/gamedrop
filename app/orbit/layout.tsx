import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["orbit"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/orbit" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/orbit",
    type: "website",
  },
};

export default function OrbitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
