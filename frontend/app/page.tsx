import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <main className="w-full max-w-xl text-center">
        <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight mb-3">
          Guess the rating. Just from the moves.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-10">
          Watch a real rated game unfold, no names or ratings attached, and
          guess both players&apos; Elo.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <Link
            href="/daily"
            className="border border-zinc-900 dark:border-zinc-100 px-8 py-3 text-base hover:bg-zinc-900 hover:text-zinc-50 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-colors"
          >
            Play today&apos;s Daily
          </Link>
          <Link
            href="/match"
            className="border border-zinc-300 dark:border-zinc-700 px-8 py-3 text-base hover:border-zinc-900 dark:hover:border-zinc-100 transition-colors"
          >
            Play a 5-round Match
          </Link>
        </div>
        <p className="text-sm text-zinc-400 mb-16">
          Daily resets every day, same game for everyone · Match is five
          rounds with a running score
        </p>

        <Link
          href="/analyze"
          className="group inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 border-b border-transparent hover:border-current transition-colors"
        >
          Got a game of your own? Run a full Stockfish analysis
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </main>
    </div>
  );
}
