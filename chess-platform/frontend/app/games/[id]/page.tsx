"use client";

import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { getGame, GameOut, MoveOut } from "@/lib/api";
import { classificationColor } from "@/lib/classification";

function fensForMoves(moves: MoveOut[]): string[] {
  const chess = new Chess();
  const fens = [chess.fen()];
  for (const m of moves) {
    try {
      chess.move(m.san);
    } catch {
      // Shouldn't happen for server-validated SANs, but don't crash the page.
    }
    fens.push(chess.fen());
  }
  return fens;
}

export default function GamePage() {
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<GameOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ply, setPly] = useState(0);

  const fetchGame = useCallback(async () => {
    try {
      const g = await getGame(gameId);
      setGame(g);
      return g;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game");
      return null;
    }
  }, [gameId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, setState only runs after the awaited network call resolves
    void fetchGame();
  }, [fetchGame]);

  useEffect(() => {
    if (!game || game.status !== "queued") return;
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, [game, fetchGame]);

  const fens = useMemo(() => (game ? fensForMoves(game.moves) : ["start"]), [game]);

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }
  if (!game) {
    return <div className="p-8 text-zinc-500">Loading…</div>;
  }

  const currentFen = fens[Math.min(ply, fens.length - 1)];
  const currentMove = ply > 0 ? game.moves[ply - 1] : null;

  const chartData = game.moves.map((m) => ({
    ply: m.ply,
    eval: m.eval_after ?? 0,
  }));

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black px-4 py-8">
      <div className="w-full max-w-5xl">
        <h1 className="text-2xl font-semibold mb-1">
          {game.white}
          {game.white_elo ? ` (${game.white_elo})` : ""} vs {game.black}
          {game.black_elo ? ` (${game.black_elo})` : ""}
        </h1>
        <p className="text-zinc-500 mb-6">
          Result: {game.result ?? "?"} ·{" "}
          {game.status === "queued" ? (
            <span className="text-amber-600">analyzing…</span>
          ) : game.status === "error" ? (
            <span className="text-red-600">analysis error</span>
          ) : (
            <span className="text-green-600">analysis complete</span>
          )}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr_260px] gap-6 items-start">
          <div>
            <div className="w-full max-w-[420px]">
              <Chessboard
                options={{
                  id: "analysis-board",
                  position: currentFen,
                  allowDragging: false,
                  boardOrientation: "white",
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
                onClick={() => setPly((p) => Math.min(game.moves.length, p + 1))}
                className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
              >
                Next →
              </button>
              <button
                onClick={() => setPly(game.moves.length)}
                className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
              >
                End ⏭
              </button>
            </div>

            {game.moves.length > 0 && (
              <div className="mt-6 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="ply" hide />
                    <YAxis domain={[-1000, 1000]} hide />
                    <Tooltip
                      formatter={(v) => [(Number(v) / 100).toFixed(2), "eval"]}
                      labelFormatter={(l) => `ply ${l}`}
                    />
                    <ReferenceLine y={0} stroke="#9e9e9e" strokeDasharray="3 3" />
                    <ReferenceLine x={ply} stroke="#2563eb" />
                    <Line
                      type="monotone"
                      dataKey="eval"
                      stroke="#2563eb"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-[560px] overflow-y-auto">
            <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 p-3 text-sm font-mono">
              {Array.from({ length: Math.ceil(game.moves.length / 2) }).map((_, i) => {
                const w = game.moves[i * 2];
                const b = game.moves[i * 2 + 1];
                return (
                  <Fragment key={i}>
                    <span className="text-zinc-400 select-none">
                      {i + 1}.
                    </span>
                    {w && (
                      <button
                        onClick={() => setPly(w.ply)}
                        className="text-left px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        style={{
                          backgroundColor: ply === w.ply ? "#dbeafe" : undefined,
                          color: classificationColor(w.classification),
                        }}
                      >
                        {w.san}
                      </button>
                    )}
                    {b ? (
                      <button
                        onClick={() => setPly(b.ply)}
                        className="text-left px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        style={{
                          backgroundColor: ply === b.ply ? "#dbeafe" : undefined,
                          color: classificationColor(b.classification),
                        }}
                      >
                        {b.san}
                      </button>
                    ) : (
                      <span />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 text-sm space-y-4">
            <div>
              <div className="text-zinc-500 mb-1">Current position</div>
              <div className="font-mono text-lg">
                {currentMove?.eval_after != null
                  ? (currentMove.eval_after / 100).toFixed(2)
                  : ply === 0 && game.moves[0]?.eval_before != null
                    ? (game.moves[0].eval_before / 100).toFixed(2)
                    : "–"}
              </div>
              {currentMove?.best_move && (
                <div className="text-zinc-500 mt-1">
                  Best was <span className="font-mono">{currentMove.best_move}</span>
                </div>
              )}
              {currentMove?.classification && (
                <div
                  className="mt-1 font-medium"
                  style={{ color: classificationColor(currentMove.classification) }}
                >
                  {currentMove.classification}
                  {currentMove.cp_loss ? ` (–${(currentMove.cp_loss / 100).toFixed(2)})` : ""}
                </div>
              )}
            </div>

            {game.white_stats && game.black_stats && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                {(
                  [
                    ["White", game.white_stats],
                    ["Black", game.black_stats],
                  ] as const
                ).map(([label, stats]) => (
                  <div key={label}>
                    <div className="font-medium mb-1">{label}</div>
                    <div className="text-zinc-500">
                      ACPL: <span className="text-zinc-900 dark:text-zinc-100">{stats.acpl}</span>
                    </div>
                    <div className="text-zinc-500">Inacc: {stats.inaccuracies}</div>
                    <div className="text-zinc-500">Mist: {stats.mistakes}</div>
                    <div className="text-zinc-500">Blun: {stats.blunders}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
