"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGame } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [pgn, setPgn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pgn.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await createGame(pgn);
      router.push(`/games/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit PGN");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <main className="w-full max-w-2xl py-16">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Chess Analysis Platform
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Paste a PGN to get a full Stockfish analysis, or try{" "}
          <Link href="/guess" className="underline font-medium">
            Guess the Elo
          </Link>
          .
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder={`[Event "Casual Game"]\n[White "Alice"]\n[Black "Bob"]\n[WhiteElo "1500"]\n[BlackElo "1600"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 ...`}
            rows={14}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !pgn.trim()}
            className="self-start rounded-full bg-foreground text-background px-6 py-2.5 font-medium disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Analyze game"}
          </button>
        </form>
      </main>
    </div>
  );
}
