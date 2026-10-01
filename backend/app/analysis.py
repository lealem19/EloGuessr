import chess
import chess.engine
import chess.polyglot

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .models import Position

MATE = 10000


def to_signed(h: int) -> int:
    """Postgres BIGINT is signed 64-bit; python-chess zobrist hashes are unsigned."""
    return h - 2**64 if h >= 2**63 else h


def get_position(db: Session, zobrist: int, depth: int):
    return (
        db.query(Position)
        .filter(Position.zobrist == zobrist, Position.depth == depth)
        .first()
    )


def save_position(db: Session, zobrist: int, depth: int, fen: str, eval_cp, best_move):
    # Executed but deliberately not committed here -- the caller (typically
    # one full game's worth of positions) batches these into a single
    # commit. ON CONFLICT DO NOTHING keeps it correct either way.
    stmt = pg_insert(Position).values(
        zobrist=zobrist, depth=depth, fen=fen, eval_cp=eval_cp, best_move=best_move
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["zobrist", "depth"])
    db.execute(stmt)


def evaluate(board: chess.Board, engine: chess.engine.SimpleEngine, depth: int, db: Session):
    """Returns (eval_cp, best_move_uci, was_cache_hit) with eval always from White's POV."""
    key = to_signed(chess.polyglot.zobrist_hash(board))
    hit = get_position(db, key, depth)
    if hit:
        return hit.eval_cp, hit.best_move, True

    if board.is_checkmate():
        cp, best = (-MATE if board.turn == chess.WHITE else MATE), None
    elif board.is_game_over():
        cp, best = 0, None
    else:
        info = engine.analyse(board, chess.engine.Limit(depth=depth))
        cp = info["score"].white().score(mate_score=MATE)
        best = info["pv"][0].uci() if info.get("pv") else None

    save_position(db, key, depth, board.fen(), cp, best)
    return cp, best, False


def cp_loss(before: int, after: int, mover: bool) -> int:
    """mover is chess.WHITE or chess.BLACK. Caps mate scores before diffing."""
    b = max(-1000, min(1000, before))
    a = max(-1000, min(1000, after))
    loss = (b - a) if mover == chess.WHITE else (a - b)
    return max(0, loss)


def classify(loss: int) -> str:
    if loss < 30:
        return "good"
    if loss < 80:
        return "inaccuracy"
    if loss < 200:
        return "mistake"
    return "blunder"
