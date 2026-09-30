"use client";

export type RoundResult = {
  gameId: number;
  whiteGuess: number;
  blackGuess: number;
  whiteActual: number;
  blackActual: number;
  score: number;
};

function gradeFor(total: number, max: number) {
  const pct = max > 0 ? total / max : 0;
  if (pct >= 0.85) return "Grandmaster eye";
  if (pct >= 0.65) return "Strong intuition";
  if (pct >= 0.4) return "Solid read";
  return "Keep practicing";
}

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
    <div className="mt-8 w-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-xl font-semibold mb-1">Match complete</h2>
      <p className="text-zinc-500 mb-4">{gradeFor(total, max)}</p>
      <div className="text-4xl font-bold tabular-nums mb-6">
        {total} <span className="text-base font-normal text-zinc-500">/ {max}</span>
      </div>

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
            {results.map((r, i) => (
              <tr key={r.gameId} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2 pr-4">{i + 1}</td>
                <td className="py-2 pr-4 font-mono">
                  {r.whiteGuess} / {r.whiteActual}
                </td>
                <td className="py-2 pr-4 font-mono">
                  {r.blackGuess} / {r.blackActual}
                </td>
                <td className="py-2 font-mono">{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onPlayAgain}
        className="mt-6 rounded-full bg-foreground text-background px-6 py-2.5 font-medium"
      >
        Play again
      </button>
    </div>
  );
}
