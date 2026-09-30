"use client";

import { useEffect, useState } from "react";

const SPEED_MS = { "0.5x": 1600, "1x": 800, "2x": 400 } as const;
type Speed = keyof typeof SPEED_MS;

export function MoveControls({
  ply,
  maxPly,
  onChange,
  active = true,
}: {
  ply: number;
  maxPly: number;
  onChange: (ply: number) => void;
  /** false while this round isn't the live "playing" one (revealed, between
   *  rounds, etc.) -- forces autoplay off so it can't keep advancing the
   *  board behind a summary screen. */
  active?: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("1x");

  // Force-pause (without an effect/extra render) the instant this round
  // stops being the live one, so stale "isPlaying" from a previous round
  // can't silently resume autoplay once `active` flips back to true.
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    if (!active && isPlaying) setIsPlaying(false);
  }

  const playingNow = active && isPlaying && ply < maxPly;

  useEffect(() => {
    if (!playingNow) return;
    const t = setTimeout(() => onChange(ply + 1), SPEED_MS[speed]);
    return () => clearTimeout(t);
  }, [playingNow, ply, speed, onChange]);

  function jump(target: number) {
    setIsPlaying(false);
    onChange(Math.min(maxPly, Math.max(0, target)));
  }

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
      <button
        onClick={() => jump(0)}
        className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
      >
        ⏮ Start
      </button>
      <button
        onClick={() => jump(ply - 1)}
        className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
      >
        ← Prev
      </button>
      <button
        onClick={() => setIsPlaying((p) => !p)}
        disabled={!active}
        aria-label={playingNow ? "Pause" : "Play"}
        className="w-9 px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm text-center disabled:opacity-40"
      >
        {playingNow ? "⏸" : "▶"}
      </button>
      <button
        onClick={() => jump(ply + 1)}
        className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
      >
        Next →
      </button>
      <button
        onClick={() => jump(maxPly)}
        className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm"
      >
        End ⏭
      </button>
      <select
        value={speed}
        onChange={(e) => setSpeed(e.target.value as Speed)}
        aria-label="Playback speed"
        className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-900"
      >
        {(Object.keys(SPEED_MS) as Speed[]).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
