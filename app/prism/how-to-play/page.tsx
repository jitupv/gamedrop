import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("prism");

export default function PrismHowToPlay() {
  return <GameGuide gameId="prism" />;
}
