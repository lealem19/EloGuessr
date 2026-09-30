"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGame, importGameFromUrl } from "@/lib/api";

type Mode = "pgn" | "url";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pgn");
  const [pgn, setPgn] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = mode === "pgn" ? pgn : url;
    if (!value.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = mode === "pgn" ? await createGame(pgn) : await importGameFromUrl(url);
      router.push(`/games/${id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${mode === "pgn" ? "submit PGN" : "import game"}`,
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 bg-zinc-50 dark:bg-black px-4">
      <main className="w-full max-w-2xl mx-auto py-16">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            See the game the way Stockfish does
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            Paste a PGN or a Lichess link and get a full move-by-move
            breakdown — eval graph, blunders, and the best move you missed.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex gap-1 mb-4 bg-zinc-100 dark:bg-zinc-950 rounded-full p-1 w-fit">
            {(
              [
                ["pgn", "Paste PGN"],
                ["url", "Import from Lichess URL"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-white dark:bg-zinc-700 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "pgn" ? (
              <textarea
                value={pgn}
                onChange={(e) => setPgn(e.target.value)}
                placeholder={`[Event "Casual Game"]\n[White "Alice"]\n[Black "Bob"]\n[WhiteElo "1500"]\n[BlackElo "1600"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...`}
                rows={12}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://lichess.org/AbCd1234"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !(mode === "pgn" ? pgn : url).trim()}
              className="self-start rounded-full bg-foreground text-background px-6 py-2.5 font-medium disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Analyze game"}
            </button>
          </form>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/daily"
            className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">Daily Guess the Elo</span>
              <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              One game, one guess. A new challenge every day — how close can
              you get?
            </p>
          </Link>

          <Link
            href="/eloguessr"
            className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">EloGuessr Match</span>
              <span className="text-zinc-400 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              Five rounds, running score, full recap at the end. The full
              GeoGuessr-style experience.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
