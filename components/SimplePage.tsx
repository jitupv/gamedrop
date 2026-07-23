import Link from "next/link";

// shared shell for text pages (about / privacy / terms)
export default function SimplePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <header className="header-glass sticky top-0 z-30 border-b border-stone-300/70">
        <div className="mx-auto max-w-5xl px-4 h-12 flex items-center justify-between">
          <Link href="/" className="text-sm font-black tracking-[0.25em] text-stone-900">
            GAME<span className="text-amber-700">DROP</span>
          </Link>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition">
            ← Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-10 pb-16">
        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-6">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-stone-600 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-stone-900 [&_h2]:mt-6">
          {children}
        </div>
      </main>
    </>
  );
}
