import Link from "next/link";
import { GAMES } from "@/lib/games";

export const metadata = { title: "The Vault — GAMEDROP" };

export default function Vault() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-16 sm:pt-14">
      <div className="mb-10 text-center">
        <p className="overline mb-2">The collection</p>
        <h1 className="font-serif text-4xl font-bold text-stone-900 mb-3">The Vault</h1>
        <p className="text-stone-500 max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
          Every game we&apos;ve ever dropped. The newest is always free — the vault is for
          subscribers (coming soon).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((g) => (
          <Link
            key={g.id}
            href={g.status === "live" ? g.path : "#"}
            className={`card lift p-6 flex flex-col items-start ${g.status !== "live" ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-stone-900/5 border border-stone-900/10 flex items-center justify-center text-2xl mb-4">
              {g.emoji}
            </div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-bold text-stone-900">{g.name}</h2>
              {g.status === "live" ? (
                <span className="text-[9px] uppercase tracking-widest text-amber-700 font-bold border border-amber-700/30 rounded-full px-2 py-0.5">
                  Live
                </span>
              ) : (
                <span className="text-[9px] uppercase tracking-widest text-stone-400 font-bold border border-stone-300 rounded-full px-2 py-0.5">
                  Soon
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500 mt-1.5 mb-5 leading-relaxed">{g.tagline}</p>
            <span className="mt-auto text-sm font-semibold text-stone-900">
              {g.status === "live" ? "Play free →" : "Dropping soon"}
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-12 text-center text-xs text-stone-400">
        A brand-new game every Friday · a fresh challenge every midnight
      </p>
    </main>
  );
}
