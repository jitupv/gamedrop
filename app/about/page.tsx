import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDay, faEarthAsia, faInfinity, faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import SimplePage from "@/components/SimplePage";

export const metadata = { title: "About - GAMEDROP" };

export default function About() {
  return (
    <SimplePage
      title="About GAMEDROP"
      lede="A collection of original browser games built around one simple ritual: a brand-new game every Friday, and a fresh daily challenge in every game at midnight."
    >
      <div className="sp-features">
        <div className="sp-feature">
          <span className="ic">
            <FontAwesomeIcon icon={faCalendarDay} width={14} height={14} />
          </span>
          <div>
            <h3>New game every Friday</h3>
            <p>A brand-new original game drops weekly. Older drops stay playable in the Vault, forever free.</p>
          </div>
        </div>
        <div className="sp-feature">
          <span className="ic">
            <FontAwesomeIcon icon={faEarthAsia} width={14} height={14} />
          </span>
          <div>
            <h3>One challenge. Everyone.</h3>
            <p>Every game serves a fresh daily challenge at midnight - the same challenge for every player in the world.</p>
          </div>
        </div>
        <div className="sp-feature">
          <span className="ic">
            <FontAwesomeIcon icon={faInfinity} width={14} height={14} />
          </span>
          <div>
            <h3>Endless mode, no bottom</h3>
            <p>Finish the daily in minutes, then chase your own records for as long as you dare.</p>
          </div>
        </div>
        <div className="sp-feature">
          <span className="ic">
            <FontAwesomeIcon icon={faShieldHalved} width={14} height={14} />
          </span>
          <div>
            <h3>No installs, no sign-ups</h3>
            <p>Free to play in any browser. Your streaks and records are saved on your own device.</p>
          </div>
        </div>
      </div>
      <p>
        Beat today&apos;s challenge, share your result, and dare your friends to do better - every
        share link carries your score as a challenge.
      </p>
      <p>Made with ☕ &amp; 🍬 - new game every Friday.</p>
    </SimplePage>
  );
}
