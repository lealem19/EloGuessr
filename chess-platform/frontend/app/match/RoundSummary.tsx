"use client";

import { useEffect, useState } from "react";
import type { PlayerStats } from "@/lib/api";

function useCountUp(target: number, durationMs = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- animation driver, resets per target change
    setValue(0);
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export function RoundSummary({
  roundScore,
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
  const shownScore = useCountUp(roundScore);
  const isLast = roundIndex === totalRounds - 1;

  return (
    <div className="mt-8 w-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold">
          Round {roundIndex + 1} of {totalRounds}
        </h2>
        <span className="text-sm text-zinc-500">
          Total: {runningTotal + shownScore} / {totalRounds * 1000}
        </span>
      </div>
      <div className="text-3xl font-bold tabular-nums mb-4">
        {shownScore} <span className="text-base font-normal text-zinc-500">/ 1000</span>
      </div>
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
      <button
        onClick={onNext}
        className="mt-6 rounded-full bg-foreground text-background px-6 py-2.5 font-medium"
      >
        {isLast ? "See final results →" : "Next round →"}
      </button>
    </div>
  );
}
