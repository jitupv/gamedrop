import SimplePage from "@/components/SimplePage";

export const metadata = { title: "Privacy — GAMEDROP" };

export default function Privacy() {
  return (
    <SimplePage title="Privacy Policy">
      <p>Last updated: July 2026</p>
      <h2>What we collect</h2>
      <p>
        GAMEDROP currently has no accounts and no sign-in. Your game progress — scores, streaks,
        settings — is stored only in your browser&apos;s local storage, on your device. We cannot
        see it, and clearing your browser data removes it.
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
      <p>Questions? Reach us via the contact details on the About page.</p>
    </SimplePage>
  );
}
