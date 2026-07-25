import SimplePage from "@/components/SimplePage";
import { SITE_EMAIL } from "@/lib/site";

export const metadata = { title: "Privacy - JEETLE" };

export default function Privacy() {
  return (
    <SimplePage title="Privacy Policy" lede="Your progress stays on your device. Here's exactly what that means.">
      <p>Last updated: July 2026</p>
      <h2>What we collect</h2>
      <p>
        You can play everything without an account. Your game progress - scores, streaks,
        settings - is stored in your browser&apos;s local storage, on your device. If you play
        while online, your leaderboard scores and display name are stored with our database
        provider (Supabase) under an anonymous identity.
      </p>
      <h2>Optional accounts</h2>
      <p>
        If you choose to add your email, it is used only to sign you in and to sync your name
        and scores across devices. We do not sell it, share it, or send marketing to it without
        asking you first. Playing never requires an account.
      </p>
      <h2>Analytics</h2>
      <p>
        We may use privacy-respecting analytics to understand how the games are played (for
        example, which games are completed and how often pages are visited). This data is
        aggregated and is not used to identify you personally.
      </p>
      <h2>Sharing features</h2>
      <p>
        When you use a share button, content is shared through your own device&apos;s share
        functions or clipboard. We do not read your contacts or messages.
      </p>
      <h2>Future features</h2>
      <p>
        If we introduce accounts, leaderboards, or prize competitions, this policy will be
        updated first, and creating an account will always be optional for playing the free
        daily games.
      </p>
      <h2>Contact</h2>
      <p>
        Questions, or want your data removed? Email{" "}
        <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
      </p>
    </SimplePage>
  );
}
