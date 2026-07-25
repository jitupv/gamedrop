"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";

// A link from inside a game to its full "how to play" guide. Shown at the bottom
// of the in-game help overlay so a player looking for help can read the full guide.
export default function GuideLink({ game }: { game: string }) {
  return (
    <Link href={`/${game}/how-to-play`} className="help-guidelink">
      <FontAwesomeIcon icon={faBookOpen} width={11} height={11} />
      Read the full guide &amp; tips
    </Link>
  );
}
