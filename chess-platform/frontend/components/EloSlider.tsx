"use client";

import { useCallback, useRef, useState } from "react";

const MIN = 100;
const MAX = 3000;
const STEP = 10;
const BIG_STEP = 100;

function pctFor(value: number) {
  return ((value - MIN) / (MAX - MIN)) * 100;
}

function clamp(v: number) {
  return Math.min(MAX, Math.max(MIN, v));
}

function gapColor(diff: number) {
  if (diff <= 75) return "#22c55e";
  if (diff <= 200) return "#eab308";
  if (diff <= 400) return "#f97316";
  return "#ef4444";
}

export function EloSlider({
  label,
  value,
  onChange,
  disabled,
  revealedActual,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  revealedActual?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const valueFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(MIN + frac * (MAX - MIN));
  }, [value]);

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(valueFromClientX(e.clientX));
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || disabled) return;
    onChange(valueFromClientX(e.clientX));
  }
  function handlePointerUp() {
    setDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const deltas: Record<string, number> = {
      ArrowLeft: -STEP,
      ArrowDown: -STEP,
      ArrowRight: STEP,
      ArrowUp: STEP,
      PageDown: -BIG_STEP,
      PageUp: BIG_STEP,
    };
    if (e.key in deltas) {
      e.preventDefault();
      onChange(clamp(value + deltas[e.key]));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(MAX);
    }
  }

  const diff = revealedActual != null ? Math.abs(revealedActual - value) : null;

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-lg tabular-nums">{value}</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={`relative h-8 flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black ${
          disabled ? "" : "cursor-pointer touch-none"
        }`}
      >
        <div className="absolute left-0 right-0 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />

        {revealedActual != null && (
          <div
            className="absolute h-1.5 rounded-full transition-all duration-700"
            style={{
              left: `${Math.min(pctFor(value), pctFor(revealedActual))}%`,
              width: `${Math.abs(pctFor(revealedActual) - pctFor(value))}%`,
              backgroundColor: gapColor(diff ?? 0),
            }}
          />
        )}

        <div
          className="absolute w-5 h-5 rounded-full bg-foreground border-2 border-background shadow -translate-x-1/2 transition-[left] duration-700"
          style={{ left: `${pctFor(value)}%` }}
        />

        {revealedActual != null && (
          <div
            className="absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 ring-2 ring-white dark:ring-zinc-900 transition-all duration-700"
            style={{ left: `${pctFor(revealedActual)}%`, backgroundColor: gapColor(diff ?? 0) }}
            title={`Actual: ${revealedActual}`}
          />
        )}
      </div>
      {revealedActual != null ? (
        <div className="text-xs text-zinc-500 mt-1">
          Actual: <span className="font-mono">{revealedActual}</span> · off by{" "}
          <span className="font-mono font-medium" style={{ color: gapColor(diff ?? 0) }}>
            {diff}
          </span>
        </div>
      ) : (
        <div className="text-xs text-zinc-400 mt-1">Drag or use arrow keys to set your guess</div>
      )}
    </div>
  );
}
