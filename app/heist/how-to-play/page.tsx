import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("heist");

export default function HeistHowToPlay() {
  return <GameGuide gameId="heist" />;
}
