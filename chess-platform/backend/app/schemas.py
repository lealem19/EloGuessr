from typing import Optional
from pydantic import BaseModel, Field

# Matches the frontend slider's range (app/eloguessr/EloSlider.tsx).
ELO_MIN = 100
ELO_MAX = 3000


class GameCreate(BaseModel):
    pgn: str


class GameImportUrl(BaseModel):
    url: str


class GameCreated(BaseModel):
    id: int
    status: str
    has_elo: bool = True


class MoveOut(BaseModel):
    ply: int
    san: str
    uci: str
    eval_before: Optional[int]
    eval_after: Optional[int]
    cp_loss: Optional[int]
    classification: Optional[str]
    best_move: Optional[str]

    class Config:
        from_attributes = True


class PlayerStats(BaseModel):
    acpl: float
    inaccuracies: int
    mistakes: int
    blunders: int


class GameOut(BaseModel):
    id: int
    white: str
    black: str
    white_elo: Optional[int]
    black_elo: Optional[int]
    result: Optional[str]
    status: str
    moves: list[MoveOut]
    white_stats: Optional[PlayerStats] = None
    black_stats: Optional[PlayerStats] = None

    class Config:
        from_attributes = True


class GuessRandomOut(BaseModel):
    game_id: int
    moves: list[str]  # SAN list, no ratings
    result: Optional[str]


class GuessDailyOut(GuessRandomOut):
    date: str  # ISO date (UTC) this round is pinned to


class GuessIn(BaseModel):
    game_id: int
    white_guess: int = Field(ge=ELO_MIN, le=ELO_MAX)
    black_guess: int = Field(ge=ELO_MIN, le=ELO_MAX)


class GuessOut(BaseModel):
    white_actual: int
    black_actual: int
    white_guess: int
    black_guess: int
    score: int
    white_stats: PlayerStats
    black_stats: PlayerStats
