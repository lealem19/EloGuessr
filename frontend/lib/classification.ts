export const CLASSIFICATION_COLORS: Record<string, string> = {
  good: "#4caf50",
  inaccuracy: "#ffc107",
  mistake: "#ff7043",
  blunder: "#e53935",
};

export function classificationColor(c: string | null | undefined): string {
  return c ? CLASSIFICATION_COLORS[c] ?? "#9e9e9e" : "#9e9e9e";
}
