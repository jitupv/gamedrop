import type { Metadata } from "next";
import GameGuide, { guideMetadata } from "@/components/GameGuide";

export const metadata: Metadata = guideMetadata("pulse");
export default function PulseHowToPlay() { return <GameGuide gameId="pulse" />; }
