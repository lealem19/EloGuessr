import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import Game, EloGuess
from ..stats import compute_stats

router = APIRouter()


@router.get("/guess/random", response_model=schemas.GuessRandomOut)
def guess_random(db: Session = Depends(get_db)):
    candidates = (
        db.query(Game)
        .filter(
            Game.status == "done",
            Game.white_elo.isnot(None),
            Game.black_elo.isnot(None),
        )
        .all()
    )
    candidates = [g for g in candidates if len(g.moves) >= 20]
    if not candidates:
        raise HTTPException(status_code=404, detail="no analyzed games available yet")

    game = random.choice(candidates)
    # Ratings are deliberately omitted here so they can't be read in DevTools
    # before the guess is submitted.
    sans = [m.san for m in game.moves]
    return schemas.GuessRandomOut(game_id=game.id, moves=sans, result=game.result)


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
