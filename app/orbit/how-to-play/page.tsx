import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("orbit");

export default function OrbitHowToPlay() {
  return <GameGuide gameId="orbit" />;
}
