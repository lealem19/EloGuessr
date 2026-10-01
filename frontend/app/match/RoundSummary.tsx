"use client";

import type { PlayerStats } from "@/lib/api";
import { ScoreReveal } from "@/components/ScoreReveal";

export function RoundSummary({
  roundScore,
  percentile,
  roundIndex,
  totalRounds,
  runningTotal,
  whiteActual,
  blackActual,
  whiteGuess,
  blackGuess,
  whiteStats,
  blackStats,
  onNext,
}: {
  roundScore: number;
  percentile: number | null;
  roundIndex: number;
  totalRounds: number;
  runningTotal: number;
  whiteActual: number;
  blackActual: number;
  whiteGuess: number;
  blackGuess: number;
  whiteStats: PlayerStats;
  blackStats: PlayerStats;
  onNext: () => void;
}) {
  const isLast = roundIndex === totalRounds - 1;

  return (
    <div className="flex flex-col gap-5">
      <ScoreReveal score={roundScore} percentile={percentile} />

      <div className="grid grid-cols-2 gap-6 text-sm">
        {(
          [
            ["White", whiteActual, whiteGuess, whiteStats],
            ["Black", blackActual, blackGuess, blackStats],
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
              ACPL: {stats.acpl} · Blunders: {stats.blunders} · Mistakes: {stats.mistakes} ·
              Inaccuracies: {stats.inaccuracies}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-zinc-400">
          Match total: {runningTotal + roundScore} / {totalRounds * 1000}
        </span>
        <button
          onClick={onNext}
          className="border border-zinc-900 dark:border-zinc-100 px-5 py-2 text-sm"
        >
          {isLast ? "See final results →" : "Next round →"}
        </button>
      </div>
    </div>
  );
}
