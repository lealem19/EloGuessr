export type Verdict = {
  label: string;
  color: string;
};

// Same palette as the slider's gap indicator (components/EloSlider.tsx),
// so "how far off" reads consistently everywhere in the app.
const TIERS: { min: number; verdict: Verdict }[] = [
  { min: 900, verdict: { label: "Bullseye", color: "#22c55e" } },
  { min: 700, verdict: { label: "Sharp read", color: "#22c55e" } },
  { min: 450, verdict: { label: "Decent guess", color: "#eab308" } },
  { min: 200, verdict: { label: "Rough guess", color: "#f97316" } },
  { min: 0, verdict: { label: "Way off", color: "#ef4444" } },
];

/** score is out of 1000 (see backend scoring: max(0,500-err) per side). */
export function getVerdict(score: number): Verdict {
  return (TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]).verdict;
}
