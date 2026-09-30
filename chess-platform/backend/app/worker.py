import io
import time

import chess
import chess.pgn
import chess.engine

from .db import SessionLocal
from .models import Game, Move
from .analysis import evaluate, cp_loss, classify
from .config import STOCKFISH_PATH, DEFAULT_DEPTH

# One Stockfish process per worker process, reused across every job it runs
# (rather than spawned per-job) so N `rq worker` processes give N-way
# parallelism without paying engine-startup cost on every game.
_engine = None


def get_engine() -> chess.engine.SimpleEngine:
    global _engine
    if _engine is None:
        _engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        _engine.configure({"Threads": 1})
    return _engine


def reset_engine() -> None:
    """Drop the cached engine handle so the next job respawns a fresh one.

    Without this, a Stockfish process that dies mid-job (OOM, crash) leaves
    every subsequent job on this worker failing against the same dead
    handle until the worker itself is restarted.
    """
    global _engine
    if _engine is not None:
        try:
            _engine.quit()
        except Exception:
            pass
    _engine = None


def analyze_game(game_id: int, depth: int = DEFAULT_DEPTH) -> dict:
    db = SessionLocal()
    eng = get_engine()
    positions = 0
    cache_hits = 0
    start = time.time()

    try:
        game_row = db.query(Game).filter(Game.id == game_id).first()
        if game_row is None:
            return {"positions": 0, "cache_hits": 0, "seconds": 0.0}

        db.query(Move).filter(Move.game_id == game_id).delete()
        db.commit()

        pgn_game = chess.pgn.read_game(io.StringIO(game_row.pgn))
        board = pgn_game.board()

        before_cp, before_best, hit = evaluate(board, eng, depth, db)
        positions += 1
        cache_hits += int(hit)

        ply = 0
        for move in pgn_game.mainline_moves():
            mover = board.turn
            san = board.san(move)
            uci = move.uci()
            board.push(move)
            ply += 1

            after_cp, after_best, hit = evaluate(board, eng, depth, db)
            positions += 1
            cache_hits += int(hit)

            loss = cp_loss(before_cp, after_cp, mover)
            cls = classify(loss)

            db.add(
                Move(
                    game_id=game_id,
                    ply=ply,
                    san=san,
                    uci=uci,
                    eval_before=before_cp,
                    eval_after=after_cp,
                    cp_loss=loss,
                    classification=cls,
                    best_move=before_best,  # what the engine recommended before this move
                )
            )
            before_cp, before_best = after_cp, after_best

        game_row.status = "done"
        db.commit()
    except Exception as e:
        db.rollback()
        if isinstance(e, (chess.engine.EngineTerminatedError, BrokenPipeError)):
            reset_engine()
        game_row = db.query(Game).filter(Game.id == game_id).first()
        if game_row:
            game_row.status = "error"
            db.commit()
        raise
    finally:
        elapsed = time.time() - start
        db.close()

    return {"positions": positions, "cache_hits": cache_hits, "seconds": elapsed}
