import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("trace");

export default function TraceHowToPlay() {
  return <GameGuide gameId="trace" />;
}
