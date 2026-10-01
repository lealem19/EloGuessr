"use client";

import { ScoreReveal } from "@/components/ScoreReveal";
import { getVerdict } from "@/lib/verdict";

export type RoundResult = {
  gameId: number;
  whiteGuess: number;
  blackGuess: number;
  whiteActual: number;
  blackActual: number;
  score: number;
};

export function MatchSummary({
  results,
  onPlayAgain,
}: {
  results: RoundResult[];
  onPlayAgain: () => void;
}) {
  const total = results.reduce((s, r) => s + r.score, 0);
  const max = results.length * 1000;

  return (
    <div className="w-full flex flex-col gap-5">
      <ScoreReveal score={total} maxScore={max} percentile={null} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-4">Round</th>
              <th className="py-2 pr-4">White guess / actual</th>
              <th className="py-2 pr-4">Black guess / actual</th>
              <th className="py-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const verdict = getVerdict(r.score);
              return (
                <tr key={r.gameId} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{i + 1}</td>
                  <td className="py-2 pr-4 font-mono">
                    {r.whiteGuess} / {r.whiteActual}
                  </td>
                  <td className="py-2 pr-4 font-mono">
                    {r.blackGuess} / {r.blackActual}
                  </td>
                  <td className="py-2 font-mono">
                    {r.score}
                    <span className="font-sans ml-2 text-xs" style={{ color: verdict.color }}>
                      {verdict.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={onPlayAgain}
        className="border border-zinc-900 dark:border-zinc-100 px-6 py-2.5 mx-auto"
      >
        Play again
      </button>
    </div>
  );
}
