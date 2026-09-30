from typing import Optional
from pydantic import BaseModel


class GameCreate(BaseModel):
    pgn: str


class GameCreated(BaseModel):
    id: int
    status: str


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


class GuessIn(BaseModel):
    game_id: int
    white_guess: int
    black_guess: int


class GuessOut(BaseModel):
    white_actual: int
    black_actual: int
    white_guess: int
    black_guess: int
    score: int
    white_stats: PlayerStats
    black_stats: PlayerStats
