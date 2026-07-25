import SimplePage from "@/components/SimplePage";
import { SITE_EMAIL } from "@/lib/site";

export const metadata = { title: "Terms - JEETLE" };

export default function Terms() {
  return (
    <SimplePage title="Terms of Use" lede="Play fair, have fun, share your results anywhere.">
      <p>Last updated: July 2026</p>
      <h2>The service</h2>
      <p>
        JEETLE provides browser games for personal entertainment. The games are free to play
        and provided &quot;as is&quot;, without warranties of any kind.
      </p>
      <h2>Fair play</h2>
      <p>
        Don&apos;t attempt to disrupt the service, exploit bugs for unfair advantage in any
        competitive feature, or use automated tools to play on your behalf. If competitions or
        prizes are introduced, they will carry their own published rules; entry will always be
        free, and manipulated or automated entries will be disqualified.
      </p>
      <h2>Content</h2>
      <p>
        All games, artwork, and text on JEETLE are our original work. You&apos;re welcome to
        share screenshots and results anywhere; please don&apos;t republish the games themselves.
      </p>
      <h2>Changes</h2>
      <p>
        Games, features, and these terms may change as the product evolves. Continued use after
        changes means you accept the updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
      </p>
    </SimplePage>
  );
}
