"use client";

import { getVerdict } from "@/lib/verdict";
import { useCountUp } from "./useCountUp";

export function ScoreReveal({
  score,
  maxScore = 1000,
  percentile,
}: {
  score: number;
  maxScore?: number;
  percentile: number | null;
}) {
  // Tiers are calibrated on a /1000 scale; normalize so this also works for
  // e.g. a 5-round match total out of 5000.
  const verdict = getVerdict(Math.round((score / maxScore) * 1000));
  const shown = useCountUp(score);

  return (
    <div className="animate-reveal-in border border-zinc-200 dark:border-zinc-800 p-6 text-center">
      <div
        className="text-xs uppercase tracking-widest mb-3"
        style={{ color: verdict.color }}
      >
        {verdict.label}
      </div>
      <div className="text-6xl font-extralight tabular-nums" style={{ color: verdict.color }}>
        {shown}
        <span className="text-lg font-light text-zinc-400"> / {maxScore}</span>
      </div>
      {percentile != null && (
        <p className="text-sm text-zinc-500 mt-3">
          closer than {percentile}% of all guesses ever made
        </p>
      )}
    </div>
  );
}
