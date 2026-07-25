import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("rush");

export default function RushHowToPlay() {
  return <GameGuide gameId="rush" />;
}
