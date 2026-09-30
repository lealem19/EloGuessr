"use client";

import { useCallback, useEffect, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getRandomGuessGame, submitGuess, ApiError, GuessRandomOut, GuessOut } from "@/lib/api";
import { MoveControls } from "@/components/MoveControls";
import { EloSlider } from "@/components/EloSlider";
import { RoundSummary } from "./RoundSummary";
import { MatchSummary, RoundResult } from "./MatchSummary";

const TOTAL_ROUNDS = 5;
const DEFAULT_GUESS = 1200;

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

type Phase = "loading" | "playing" | "revealed" | "match-summary";

export default function EloGuessrPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [roundIndex, setRoundIndex] = useState(0);
  const [playedGameIds, setPlayedGameIds] = useState<number[]>([]);
  const [results, setResults] = useState<RoundResult[]>([]);

  const [round, setRound] = useState<GuessRandomOut | null>(null);
  const [fens, setFens] = useState<string[]>(["start"]);
  const [ply, setPly] = useState(0);

  const [whiteGuess, setWhiteGuess] = useState(DEFAULT_GUESS);
  const [blackGuess, setBlackGuess] = useState(DEFAULT_GUESS);
  const [submitting, setSubmitting] = useState(false);
  const [reveal, setReveal] = useState<GuessOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRound = useCallback(async (exclude: number[]) => {
    setPhase("loading");
    setError(null);
    setReveal(null);
    setWhiteGuess(DEFAULT_GUESS);
    setBlackGuess(DEFAULT_GUESS);
    try {
      const r = await getRandomGuessGame(exclude);
      const f = fensForSans(r.moves);
      setRound(r);
      setFens(f);
      setPly(f.length - 1);
      setPhase("playing");
    } catch (err) {
      const outOfGames = err instanceof ApiError && err.status === 404 && exclude.length > 0;
      if (outOfGames) {
        // Genuinely ran out of unique analyzed games for this match — wrap up early.
        setPhase("match-summary");
      } else {
        // Any other failure (backend down, 500, network) — surface it and
        // let the player retry, rather than silently ending the match.
        setError(err instanceof Error ? err.message : "Failed to load a game");
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, setState only runs after the awaited network call resolves
    loadRound([]);
  }, [loadRound]);

  async function handleSubmit() {
    if (!round) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await submitGuess(round.game_id, whiteGuess, blackGuess);
      setReveal(r);
      setResults((prev) => [
        ...prev,
        {
          gameId: round.game_id,
          whiteGuess,
          blackGuess,
          whiteActual: r.white_actual,
          blackActual: r.black_actual,
          score: r.score,
        },
      ]);
      setPlayedGameIds((prev) => [...prev, round.game_id]);
      setPhase("revealed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNextRound() {
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      setPhase("match-summary");
      return;
    }
    const nextExclude = [...playedGameIds];
    setRoundIndex((i) => i + 1);
    loadRound(nextExclude);
  }

  function handlePlayAgain() {
    setRoundIndex(0);
    setPlayedGameIds([]);
    setResults([]);
    loadRound([]);
  }

  if (phase === "loading" && !round) {
    return <div className="p-8 text-zinc-500">Loading a game…</div>;
  }
  if (error && !round) {
    return (
      <div className="p-8 flex flex-col gap-3 items-start">
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => loadRound([])}
          className="rounded-full bg-foreground text-background px-5 py-2 font-medium text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === "match-summary") {
    return (
      <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black px-4 py-8">
        <div className="w-full max-w-2xl">
          <h1 className="text-2xl font-semibold mb-6">EloGuessr</h1>
          <MatchSummary results={results} onPlayAgain={handlePlayAgain} />
        </div>
      </div>
    );
  }

  if (!round) return null;

  const currentFen = fens[Math.min(ply, fens.length - 1)];
  const runningTotalBeforeThisRound = results
    .slice(0, results.length - 1)
    .reduce((s, r) => s + r.score, 0);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold">EloGuessr</h1>
          <div className="flex gap-1" aria-label={`Round ${roundIndex + 1} of ${TOTAL_ROUNDS}`}>
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
              <span
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < roundIndex
                    ? "bg-green-500"
                    : i === roundIndex
                      ? "bg-foreground"
                      : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
        <p className="text-zinc-500 mb-6">
          Round {roundIndex + 1} of {TOTAL_ROUNDS} · Step through the game, then guess each
          player&apos;s rating.
        </p>

        <div className="flex flex-col items-center">
          <div className="w-full max-w-[420px]">
            <Chessboard
              options={{ id: "eloguessr-board", position: currentFen, allowDragging: false }}
            />
          </div>

          <MoveControls
            ply={ply}
            maxPly={fens.length - 1}
            onChange={setPly}
            active={phase === "playing"}
          />

          <p className="text-zinc-400 text-sm mt-2">
            Ply {ply} / {fens.length - 1} · Result: {round.result ?? "?"}
          </p>
        </div>

        {phase === "loading" &&
          (error ? (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => loadRound(playedGameIds)}
                className="rounded-full bg-foreground text-background px-5 py-2 font-medium text-sm"
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="mt-8 text-zinc-500 text-center">Loading next round…</p>
          ))}

        {phase === "playing" && (
          <div className="mt-8 flex flex-col gap-6">
            <EloSlider label="White's Elo" value={whiteGuess} onChange={setWhiteGuess} />
            <EloSlider label="Black's Elo" value={blackGuess} onChange={setBlackGuess} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="self-center rounded-full bg-foreground text-background px-6 py-2.5 font-medium disabled:opacity-50"
            >
              {submitting ? "Scoring…" : "Submit guess"}
            </button>
          </div>
        )}

        {phase === "revealed" && reveal && (
          <>
            <div className="mt-8 flex flex-col gap-6">
              <EloSlider
                label="White's Elo"
                value={whiteGuess}
                onChange={setWhiteGuess}
                disabled
                revealedActual={reveal.white_actual}
              />
              <EloSlider
                label="Black's Elo"
                value={blackGuess}
                onChange={setBlackGuess}
                disabled
                revealedActual={reveal.black_actual}
              />
            </div>
            <RoundSummary
              roundScore={reveal.score}
              roundIndex={roundIndex}
              totalRounds={TOTAL_ROUNDS}
              runningTotal={runningTotalBeforeThisRound}
              whiteActual={reveal.white_actual}
              blackActual={reveal.black_actual}
              whiteGuess={whiteGuess}
              blackGuess={blackGuess}
              whiteStats={reveal.white_stats}
              blackStats={reveal.black_stats}
              onNext={handleNextRound}
            />
          </>
        )}
      </div>
    </div>
  );
}
