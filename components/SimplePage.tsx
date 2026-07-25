import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { SITE_NAME } from "@/lib/site";
import ThemeToggle from "./ThemeToggle";

// shared shell for text pages (about / privacy / terms) - matches the homepage chrome
export default function SimplePage({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hm">
      <header className="hm-header">
        <div className="hm-wrap hm-header-inner">
          <Link href="/" className="hm-brand">
            JEETLE<span>.</span>
          </Link>
          <nav className="hm-nav">
            <Link href="/">
              <FontAwesomeIcon icon={faArrowLeft} width={12} height={12} /> All games
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="sp-main">
        <p className="hm-eyebrow">{SITE_NAME}</p>
        <h1 className="sp-title">{title}</h1>
        {lede && <p className="sp-lede">{lede}</p>}
        <div className="sp-prose">{children}</div>
        <footer className="sp-foot">
          <span>New games keep dropping</span>
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
