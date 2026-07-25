import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("sonar");

export default function SonarHowToPlay() {
  return <GameGuide gameId="sonar" />;
}
