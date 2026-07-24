// Product analytics via PostHog. The project key is write-only and public by
// design (like Supabase's anon key). No session recordings, no personal data -
// anonymous event counts only, per our privacy policy.
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_vQp5jDAawTKdYqqV23VHJFEwXQDoWtcuhEBf5kPkDiz2";
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let ready = false;

function ensure(): boolean {
  if (typeof window === "undefined") return false;
  if (!ready) {
    try {
      posthog.init(KEY, {
        api_host: HOST,
        disable_session_recording: true,
        capture_pageview: false, // we send route-aware pageviews ourselves
        autocapture: false, // custom events only - keeps the data clean
        persistence: "localStorage",
      });
      ready = true;
    } catch {
      return false;
    }
  }
  return true;
}

export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (ensure()) posthog.capture(event, props);
  } catch {}
}

export function trackPageview(path: string): void {
  track("$pageview", { $current_url: window.location.origin + path });
}
