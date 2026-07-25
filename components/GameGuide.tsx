import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { GAME_CONTENT, GUIDE_ORDER } from "@/lib/gameContent";
import { GAMES } from "@/lib/games";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import ThemeToggle from "./ThemeToggle";

// Server-rendered "how to play" page for one game. Real content plus VideoGame
// and FAQ structured data. No keyword stuffing - written to help a person first.
export default function GameGuide({ gameId }: { gameId: string }) {
  const c = GAME_CONTENT[gameId];
  const meta = GAMES.find((g) => g.id === gameId);
  if (!c || !meta) return null;

  const gameUrl = `${SITE_URL}/${gameId}`;
  const guideUrl = `${SITE_URL}/${gameId}/how-to-play`;

  const videoGameLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: c.name,
    description: c.what,
    genre: c.genre,
    url: gameUrl,
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    inLanguage: "en",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const others = GUIDE_ORDER.filter((id) => id !== gameId).map((id) => GAME_CONTENT[id]);

  return (
    <div className="hm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoGameLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <header className="hm-header">
        <div className="hm-wrap hm-header-inner">
          <Link href="/" className="hm-brand">
            GAMEDROP<span>.</span>
          </Link>
          <nav className="hm-nav">
            <Link href={`/${gameId}`}>
              <FontAwesomeIcon icon={faArrowLeft} width={12} height={12} /> Play {c.name}
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="sp-main hg">
        <p className="hm-eyebrow">{c.genre}</p>
        <h1 className="sp-title">How to play {c.name}</h1>
        <p className="sp-lede">{c.what}</p>

        <Link href={`/${gameId}`} className="hg-play">
          Play {c.name} <FontAwesomeIcon icon={faArrowRight} width={14} height={14} />
        </Link>

        <section className="hg-section">
          <h2>How to play</h2>
          <ol className="hg-steps">
            {c.how.map((step, i) => (
              <li key={i}>
                <span className="n">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="hg-section">
          <h2>Tips and strategy</h2>
          <ul className="hg-tips">
            {c.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="hg-section">
          <h2>Frequently asked questions</h2>
          <div className="hg-faq">
            {c.faq.map((f, i) => (
              <div key={i} className="hg-qa">
                <h3>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="hg-section">
          <h2>More games</h2>
          <div className="hg-more">
            {others.map((o) => (
              <Link key={o.id} href={`/${o.id}/how-to-play`} className="hg-morelink">
                <span className="nm">{o.name}</span>
                <span className="gn">{o.genre}</span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="sp-foot">
          <span>New game every Friday</span>
          <nav>
            <Link href="/about">About</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}

// shared canonical + OG metadata builder for each guide page
export function guideMetadata(gameId: string) {
  const c = GAME_CONTENT[gameId];
  if (!c) return {};
  const url = `/${gameId}/how-to-play`;
  return {
    title: c.guideTitle,
    description: c.guideDescription,
    alternates: { canonical: url },
    openGraph: {
      title: c.guideTitle,
      description: c.guideDescription,
      url,
      type: "article" as const,
    },
  };
}
