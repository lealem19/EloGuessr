import hashlib
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .. import schemas
from ..db import get_db
from ..models import Game, Move, EloGuess
from ..stats import compute_stats

router = APIRouter()

MIN_PLIES = 20


def _eligible_game_ids(db: Session, exclude: set[int] = frozenset()) -> list[int]:
    """Game ids with >=MIN_PLIES moves and both ratings known, filtered at
    the SQL level (no per-candidate lazy-loading of .moves)."""
    move_counts = (
        db.query(Move.game_id, func.count(Move.id).label("n"))
        .group_by(Move.game_id)
        .subquery()
    )
    q = (
        db.query(Game.id)
        .join(move_counts, move_counts.c.game_id == Game.id)
        .filter(
            Game.status == "done",
            Game.white_elo.isnot(None),
            Game.black_elo.isnot(None),
            move_counts.c.n >= MIN_PLIES,
        )
        .order_by(Game.id)
    )
    if exclude:
        q = q.filter(~Game.id.in_(exclude))
    return [row[0] for row in q.all()]


def _load_game_round(db: Session, game_id: int) -> schemas.GuessRandomOut:
    game = (
        db.query(Game)
        .options(joinedload(Game.moves))
        .filter(Game.id == game_id)
        .first()
    )
    sans = [m.san for m in game.moves]
    # Ratings are deliberately omitted here so they can't be read in DevTools
    # before the guess is submitted.
    return schemas.GuessRandomOut(game_id=game.id, moves=sans, result=game.result)


@router.get("/guess/random", response_model=schemas.GuessRandomOut)
def guess_random(exclude: str = "", db: Session = Depends(get_db)):
    excluded_ids = {int(x) for x in exclude.split(",") if x.strip().isdigit()}

    ids = _eligible_game_ids(db, excluded_ids)
    if not ids:
        raise HTTPException(status_code=404, detail="no analyzed games available yet")

    return _load_game_round(db, random.choice(ids))


@router.get("/guess/daily", response_model=schemas.GuessDailyOut)
def guess_daily(db: Session = Depends(get_db)):
    ids = _eligible_game_ids(db)
    if not ids:
        raise HTTPException(status_code=404, detail="no analyzed games available yet")

    today = datetime.now(timezone.utc).date().isoformat()
    idx = int(hashlib.sha256(today.encode()).hexdigest(), 16) % len(ids)

    round_ = _load_game_round(db, ids[idx])
    return schemas.GuessDailyOut(**round_.model_dump(), date=today)


@router.post("/guess", response_model=schemas.GuessOut)
def submit_guess(payload: schemas.GuessIn, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == payload.game_id).first()
    if not game or game.white_elo is None or game.black_elo is None:
        raise HTTPException(status_code=404, detail="game not found")

    white_stats, black_stats = compute_stats(game.moves)

    white_err = abs(payload.white_guess - game.white_elo)
    black_err = abs(payload.black_guess - game.black_elo)
    score = max(0, 500 - white_err) + max(0, 500 - black_err)

    db.add(
        EloGuess(
            game_id=game.id,
            white_guess=payload.white_guess,
            black_guess=payload.black_guess,
            white_actual=game.white_elo,
            black_actual=game.black_elo,
            score=score,
        )
    )
    db.commit()

    return schemas.GuessOut(
        white_actual=game.white_elo,
        black_actual=game.black_elo,
        white_guess=payload.white_guess,
        black_guess=payload.black_guess,
        score=score,
        white_stats=white_stats,
        black_stats=black_stats,
    )
