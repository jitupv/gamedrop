import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("tilt");

export default function TiltHowToPlay() {
  return <GameGuide gameId="tilt" />;
}
