"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getRandomGuessGame, submitGuess, GuessRandomOut, GuessOut } from "@/lib/api";

function fensForSans(sans: string[]): string[] {
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const san of sans) {
    try {
      chess.move(san);
    } catch {
      // ignore malformed SAN defensively
    }
    fens.push(chess.fen());
  }
  return fens;
}

export default function GuessPage() {
  const [round, setRound] = useState<GuessRandomOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ply, setPly] = useState(0);
  const [whiteGuess, setWhiteGuess] = useState("1200");
  const [blackGuess, setBlackGuess] = useState("1200");
  const [result, setResult] = useState<GuessOut | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadRound() {
    setLoading(true);
    setError(null);
    setResult(null);
    setPly(0);
    try {
      const r = await getRandomGuessGame();
      setRound(r);
      setPly(r.moves.length); // show the final position by default
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load a game");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, setState only runs after the awaited network call resolves
    loadRound();
  }, []);

  const fens = useMemo(() => (round ? fensForSans(round.moves) : ["start"]), [round]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!round) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await submitGuess(round.game_id, Number(whiteGuess), Number(blackGuess));
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-zinc-500">Loading a game…</div>;
  }
  if (error && !round) {
    return <div className="p-8 text-red-600">{error}</div>;
  }
  if (!round) return null;

  const currentFen = fens[Math.min(ply, fens.length - 1)];

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black px-4 py-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold mb-1">Guess the Elo</h1>
        <p className="text-zinc-500 mb-6">
          Step through the game, then guess each player&apos;s rating.
        </p>

        <div className="flex flex-col items-center">
          <div className="w-full max-w-[420px]">
            <Chessboard
              options={{
                id: "guess-board",
                position: currentFen,
                allowDragging: false,
              }}
            />
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setPly(0)}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
            >
              ⏮ Start
            </button>
            <button
              onClick={() => setPly((p) => Math.max(0, p - 1))}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPly((p) => Math.min(round.moves.length, p + 1))}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
            >
              Next →
            </button>
            <button
              onClick={() => setPly(round.moves.length)}
              className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
            >
              End ⏭
            </button>
          </div>
          <p className="text-zinc-400 text-sm mt-2">
            Ply {ply} / {round.moves.length} · Result: {round.result ?? "?"}
          </p>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 items-center">
            <div className="flex gap-6">
              <label className="flex flex-col text-sm">
                White&apos;s Elo
                <input
                  type="number"
                  value={whiteGuess}
                  onChange={(e) => setWhiteGuess(e.target.value)}
                  className="mt-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 w-32"
                  min={100}
                  max={3200}
                />
              </label>
              <label className="flex flex-col text-sm">
                Black&apos;s Elo
                <input
                  type="number"
                  value={blackGuess}
                  onChange={(e) => setBlackGuess(e.target.value)}
                  className="mt-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 w-32"
                  min={100}
                  max={3200}
                />
              </label>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-foreground text-background px-6 py-2.5 font-medium disabled:opacity-50"
            >
              {submitting ? "Scoring…" : "Submit guess"}
            </button>
          </form>
        ) : (
          <div className="mt-8 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-xl font-semibold mb-4">
              Score: {result.score} / 1000
            </h2>
            <div className="grid grid-cols-2 gap-6 text-sm">
              {(
                [
                  ["White", result.white_actual, result.white_guess, result.white_stats],
                  ["Black", result.black_actual, result.black_guess, result.black_stats],
                ] as const
              ).map(([label, actual, guess, stats]) => (
                <div key={label}>
                  <div className="font-medium mb-1">{label}</div>
                  <div>
                    Actual: <span className="font-mono">{actual}</span>
                  </div>
                  <div>
                    Your guess: <span className="font-mono">{guess}</span>
                  </div>
                  <div className="text-zinc-500 mt-1">
                    ACPL: {stats.acpl} · Blunders: {stats.blunders} · Mistakes:{" "}
                    {stats.mistakes} · Inaccuracies: {stats.inaccuracies}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={loadRound}
              className="mt-6 rounded-full bg-foreground text-background px-6 py-2.5 font-medium"
            >
              Next game →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
