"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDay, faInfinity } from "@fortawesome/free-solid-svg-icons";

// Daily ⇄ Endless segmented toggle — lives above the stat bar, not inside it.
export default function ModeSwitch({
  endless,
  onDaily,
  onEndless,
}: {
  endless: boolean;
  onDaily: () => void;
  onEndless: () => void;
}) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Game mode">
      <button
        type="button"
        role="tab"
        aria-selected={!endless}
        className={endless ? "" : "on"}
        onClick={() => {
          if (endless) onDaily();
        }}
      >
        <FontAwesomeIcon icon={faCalendarDay} width={11} height={11} /> Daily
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={endless}
        className={endless ? "on" : ""}
        onClick={() => {
          if (!endless) onEndless();
        }}
      >
        <FontAwesomeIcon icon={faInfinity} width={12} height={12} /> Endless
      </button>
    </div>
  );
}
