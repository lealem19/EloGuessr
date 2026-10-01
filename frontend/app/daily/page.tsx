"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getDailyGuessGame, submitGuess, GuessDailyOut } from "@/lib/api";
import { MoveControls } from "@/components/MoveControls";
import { EloSlider } from "@/components/EloSlider";
import { ScoreReveal } from "@/components/ScoreReveal";
import { getVerdict } from "@/lib/verdict";

const DEFAULT_GUESS = 1200;
const STORAGE_PREFIX = "eloguessr-daily-";

type SavedResult = {
  whiteGuess: number;
  blackGuess: number;
  whiteActual: number;
  blackActual: number;
  score: number;
  percentile: number | null;
};

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

function loadSaved(date: string): SavedResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + date);
    return raw ? (JSON.parse(raw) as SavedResult) : null;
  } catch {
    return null;
  }
}

function saveResult(date: string, result: SavedResult) {
  try {
    localStorage.setItem(STORAGE_PREFIX + date, JSON.stringify(result));
  } catch {
    // localStorage unavailable (private mode, etc.) -- the round still
    // works, it just won't remember you've played today.
  }
}

type Phase = "loading" | "playing" | "revealed";

export default function DailyPage() {
  const [round, setRound] = useState<GuessDailyOut | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [fens, setFens] = useState<string[]>(["start"]);
  const [ply, setPly] = useState(0);

  const [whiteGuess, setWhiteGuess] = useState(DEFAULT_GUESS);
  const [blackGuess, setBlackGuess] = useState(DEFAULT_GUESS);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SavedResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await getDailyGuessGame();
        const f = fensForSans(r.moves);
        setRound(r);
        setFens(f);
        setPly(f.length - 1);
        const saved = loadSaved(r.date);
        if (saved) {
          setResult(saved);
          setWhiteGuess(saved.whiteGuess);
          setBlackGuess(saved.blackGuess);
          setPhase("revealed");
        } else {
          setPhase("playing");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load today's game");
      }
    }
    load();
  }, []);

  async function handleSubmit() {
    if (!round) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await submitGuess(round.game_id, whiteGuess, blackGuess);
      const saved: SavedResult = {
        whiteGuess,
        blackGuess,
        whiteActual: r.white_actual,
        blackActual: r.black_actual,
        score: r.score,
        percentile: r.percentile,
      };
      saveResult(round.date, saved);
      setResult(saved);
      setPhase("revealed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy() {
    if (!round || !result) return;
    const verdict = getVerdict(result.score);
    const text = `EloGuessr Daily · ${round.date}\n${verdict.label} — ${result.score} / 1000`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (phase === "loading" && !round) {
    return <div className="flex-1 flex items-center justify-center text-zinc-500">Loading today&apos;s game…</div>;
  }
  if (error && !round) {
    return <div className="flex-1 flex items-center justify-center text-red-600">{error}</div>;
  }
  if (!round) return null;

  const currentFen = fens[Math.min(ply, fens.length - 1)];

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-6 overflow-hidden">
      <div className="w-full max-w-4xl">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-lg font-normal">Daily</h1>
          <span className="text-xs font-mono text-zinc-400">{round.date}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
          <div>
            <Chessboard
              options={{ id: "daily-board", position: currentFen, allowDragging: false }}
            />
            <MoveControls
              ply={ply}
              maxPly={fens.length - 1}
              onChange={setPly}
              active={phase === "playing"}
            />
            <p className="text-zinc-400 text-xs mt-2">
              Ply {ply} / {fens.length - 1} · Result: {round.result ?? "?"}
            </p>
          </div>

          <div>
            {phase === "playing" && (
              <div className="flex flex-col gap-5">
                <EloSlider label="White's Elo" value={whiteGuess} onChange={setWhiteGuess} />
                <EloSlider label="Black's Elo" value={blackGuess} onChange={setBlackGuess} />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="border border-zinc-900 dark:border-zinc-100 px-6 py-2.5 disabled:opacity-50"
                >
                  {submitting ? "Scoring…" : "Submit guess"}
                </button>
              </div>
            )}

            {phase === "revealed" && result && (
              <div className="flex flex-col gap-5">
                <ScoreReveal score={result.score} percentile={result.percentile} />

                <div className="flex flex-col gap-4">
                  <EloSlider
                    label="White's Elo"
                    value={result.whiteGuess}
                    onChange={() => {}}
                    disabled
                    revealedActual={result.whiteActual}
                  />
                  <EloSlider
                    label="Black's Elo"
                    value={result.blackGuess}
                    onChange={() => {}}
                    disabled
                    revealedActual={result.blackActual}
                  />
                </div>

                <div className="flex gap-3 flex-wrap items-center">
                  <button
                    onClick={handleCopy}
                    className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm"
                  >
                    {copied ? "Copied" : "Copy result"}
                  </button>
                  <Link
                    href="/match"
                    className="border border-zinc-900 dark:border-zinc-100 px-4 py-2 text-sm"
                  >
                    Play a 5-round match →
                  </Link>
                </div>
                <p className="text-zinc-400 text-xs">Come back tomorrow for a new game.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
