const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type MoveOut = {
  ply: number;
  san: string;
  uci: string;
  eval_before: number | null;
  eval_after: number | null;
  cp_loss: number | null;
  classification: "good" | "inaccuracy" | "mistake" | "blunder" | null;
  best_move: string | null;
};

export type PlayerStats = {
  acpl: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
};

export type GameOut = {
  id: number;
  white: string;
  black: string;
  white_elo: number | null;
  black_elo: number | null;
  result: string | null;
  status: "queued" | "done" | "error";
  moves: MoveOut[];
  white_stats: PlayerStats | null;
  black_stats: PlayerStats | null;
};

export type GameCreated = {
  id: number;
  status: string;
  has_elo: boolean;
};

export type GuessRandomOut = {
  game_id: number;
  moves: string[];
  result: string | null;
};

export type GuessDailyOut = GuessRandomOut & {
  date: string;
};

export type GuessOut = {
  white_actual: number;
  black_actual: number;
  white_guess: number;
  black_guess: number;
  score: number;
  white_stats: PlayerStats;
  black_stats: PlayerStats;
  percentile: number | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new ApiError(res.status, `${res.status} ${res.statusText}: ${detail}`);
  }
  return res.json();
}

export function createGame(pgn: string) {
  return request<GameCreated>("/games", {
    method: "POST",
    body: JSON.stringify({ pgn }),
  });
}

export function importGameFromUrl(url: string) {
  return request<GameCreated>("/games/import-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getGame(id: number | string) {
  return request<GameOut>(`/games/${id}`);
}

export function getRandomGuessGame(excludeIds: number[] = []) {
  const qs = excludeIds.length ? `?exclude=${excludeIds.join(",")}` : "";
  return request<GuessRandomOut>(`/guess/random${qs}`);
}

export function getDailyGuessGame() {
  return request<GuessDailyOut>("/guess/daily");
}

export function submitGuess(gameId: number, whiteGuess: number, blackGuess: number) {
  return request<GuessOut>("/guess", {
    method: "POST",
    body: JSON.stringify({ game_id: gameId, white_guess: whiteGuess, black_guess: blackGuess }),
  });
}
