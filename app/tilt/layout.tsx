import type { Metadata } from "next";
import { GAME_CONTENT } from "@/lib/gameContent";

const c = GAME_CONTENT["tilt"];

export const metadata: Metadata = {
  title: c.playTitle,
  description: c.playDescription,
  alternates: { canonical: "/tilt" },
  openGraph: {
    title: c.playTitle,
    description: c.playDescription,
    url: "/tilt",
    type: "website",
  },
};

export default function TiltLayout({ children }: { children: React.ReactNode }) {
  return children;
}
