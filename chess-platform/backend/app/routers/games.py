import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import schemas
from ..db import get_db
from ..models import Game
from ..pgn_utils import extract_lichess_game_id, parse_game_headers
from ..stats import compute_stats
from ..queue import analysis_queue
from ..worker import analyze_game
from ..config import DEFAULT_DEPTH

router = APIRouter()


def _to_game_created(game: Game) -> schemas.GameCreated:
    return schemas.GameCreated(
        id=game.id,
        status=game.status,
        has_elo=game.white_elo is not None and game.black_elo is not None,
    )


def _create_game_from_pgn(pgn: str, db: Session, external_id: str | None = None) -> Game:
    try:
        headers = parse_game_headers(pgn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    game = Game(
        white=headers["white"],
        black=headers["black"],
        white_elo=headers["white_elo"],
        black_elo=headers["black_elo"],
        result=headers["result"],
        pgn=pgn,
        status="queued",
        external_id=external_id,
    )
    db.add(game)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent import of the same external_id lost the race -- fall
        # back to whichever row won, rather than erroring.
        db.rollback()
        if external_id is not None:
            existing = db.query(Game).filter(Game.external_id == external_id).first()
            if existing:
                return existing
        raise
    db.refresh(game)

    analysis_queue.enqueue(analyze_game, game.id, DEFAULT_DEPTH, job_timeout=1800)

    return game


@router.post("/games", response_model=schemas.GameCreated)
def create_game(payload: schemas.GameCreate, db: Session = Depends(get_db)):
    game = _create_game_from_pgn(payload.pgn, db)
    return _to_game_created(game)


@router.post("/games/import-url", response_model=schemas.GameCreated)
def import_game_from_url(payload: schemas.GameImportUrl, db: Session = Depends(get_db)):
    try:
        lichess_id = extract_lichess_game_id(payload.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    existing = db.query(Game).filter(Game.external_id == lichess_id).first()
    if existing:
        return _to_game_created(existing)

    try:
        resp = httpx.get(
            f"https://lichess.org/game/export/{lichess_id}.pgn",
            params={"clocks": "false", "evals": "false"},
            timeout=10,
            follow_redirects=True,
        )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"couldn't reach lichess: {e}")

    if resp.status_code == 404:
        raise HTTPException(status_code=400, detail="no such lichess game -- check the URL")
    if resp.status_code != 200 or not resp.text.strip():
        raise HTTPException(status_code=400, detail="lichess didn't return a PGN for that game")

    game = _create_game_from_pgn(resp.text, db, external_id=lichess_id)
    return _to_game_created(game)


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
