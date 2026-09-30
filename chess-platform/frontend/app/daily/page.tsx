"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { getDailyGuessGame, submitGuess, GuessDailyOut } from "@/lib/api";
import { MoveControls } from "@/components/MoveControls";
import { EloSlider } from "@/components/EloSlider";

const DEFAULT_GUESS = 1200;
const STORAGE_PREFIX = "chesslab-daily-";

type SavedResult = {
  whiteGuess: number;
  blackGuess: number;
  whiteActual: number;
  blackActual: number;
  score: number;
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
    const text = `Chess Lab Daily · ${round.date}\nScore: ${result.score} / 1000`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (phase === "loading" && !round) {
    return <div className="p-8 text-zinc-500">Loading today&apos;s game…</div>;
  }
  if (error && !round) {
    return <div className="p-8 text-red-600">{error}</div>;
  }
  if (!round) return null;

  const currentFen = fens[Math.min(ply, fens.length - 1)];

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black px-4 py-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold mb-1">Daily Guess the Elo</h1>
        <p className="text-zinc-500 mb-6">
          One game, one guess, resets every day at midnight UTC.{" "}
          <span className="font-mono text-xs">{round.date}</span>
        </p>

        <div className="flex flex-col items-center">
          <div className="w-full max-w-[420px]">
            <Chessboard
              options={{ id: "daily-board", position: currentFen, allowDragging: false }}
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

        {phase === "revealed" && result && (
          <>
            <div className="mt-8 flex flex-col gap-6">
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

            <div className="mt-8 w-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 text-center">
              <p className="text-zinc-500 mb-1">Today&apos;s score</p>
              <div className="text-4xl font-bold tabular-nums mb-4">
                {result.score} <span className="text-base font-normal text-zinc-500">/ 1000</span>
              </div>
              <p className="text-zinc-500 text-sm mb-6">
                Come back tomorrow for a new game — or keep playing right now.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={handleCopy}
                  className="rounded-full border border-zinc-300 dark:border-zinc-700 px-5 py-2 font-medium text-sm"
                >
                  {copied ? "Copied!" : "Copy result"}
                </button>
                <Link
                  href="/eloguessr"
                  className="rounded-full bg-foreground text-background px-5 py-2 font-medium text-sm"
                >
                  Play a 5-round match →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
