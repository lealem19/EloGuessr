import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 bg-zinc-50 dark:bg-black px-4">
      <main className="w-full max-w-2xl mx-auto py-20 text-center">
        <p className="text-sm font-medium text-zinc-400 mb-3">♟️ EloGuessr</p>
        <h1 className="text-4xl font-semibold tracking-tight mb-3">
          Guess the rating. Just from the moves.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-10">
          Watch a real rated game unfold, no names or ratings attached, and
          guess both players&apos; Elo. Blunders, brilliancies, and
          everything in between — how good is your eye?
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
          <Link
            href="/daily"
            className="rounded-full bg-foreground text-background px-8 py-3.5 font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Play today&apos;s Daily
          </Link>
          <Link
            href="/match"
            className="rounded-full border border-zinc-300 dark:border-zinc-700 px-8 py-3.5 font-semibold text-lg hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
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
          className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-2.5 text-sm text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
        >
          Got a game of your own? Run a full Stockfish analysis
          <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </Link>
      </main>
    </div>
  );
}
