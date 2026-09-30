from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import Game
from ..pgn_utils import parse_game_headers
from ..stats import compute_stats
from ..queue import analysis_queue
from ..worker import analyze_game
from ..config import DEFAULT_DEPTH

router = APIRouter()


@router.post("/games", response_model=schemas.GameCreated)
def create_game(payload: schemas.GameCreate, db: Session = Depends(get_db)):
    try:
        headers = parse_game_headers(payload.pgn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    game = Game(
        white=headers["white"],
        black=headers["black"],
        white_elo=headers["white_elo"],
        black_elo=headers["black_elo"],
        result=headers["result"],
        pgn=payload.pgn,
        status="queued",
    )
    db.add(game)
    db.commit()
    db.refresh(game)

    analysis_queue.enqueue(analyze_game, game.id, DEFAULT_DEPTH, job_timeout=1800)

    return schemas.GameCreated(id=game.id, status=game.status)


@router.get("/games/{game_id}", response_model=schemas.GameOut)
def get_game(game_id: int, db: Session = Depends(get_db)):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="game not found")

    white_stats, black_stats = compute_stats(game.moves)

    return schemas.GameOut(
        id=game.id,
        white=game.white,
        black=game.black,
        white_elo=game.white_elo,
        black_elo=game.black_elo,
        result=game.result,
        status=game.status,
        moves=game.moves,
        white_stats=white_stats if game.status == "done" else None,
        black_stats=black_stats if game.status == "done" else None,
    )
