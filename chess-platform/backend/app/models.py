from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    DateTime,
    func,
)
from sqlalchemy.orm import relationship

from .db import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True)
    white = Column(String, nullable=False)
    black = Column(String, nullable=False)
    white_elo = Column(Integer)
    black_elo = Column(Integer)
    result = Column(String)
    pgn = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="queued")  # queued | done | error
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    moves = relationship(
        "Move", back_populates="game", cascade="all, delete-orphan", order_by="Move.ply"
    )


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True)
    zobrist = Column(BigInteger, nullable=False)
    depth = Column(Integer, nullable=False)
    fen = Column(Text, nullable=False)
    eval_cp = Column(Integer)
    best_move = Column(String)

    __table_args__ = (UniqueConstraint("zobrist", "depth", name="uq_zobrist_depth"),)


class Move(Base):
    __tablename__ = "moves"

    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    ply = Column(Integer, nullable=False)
    san = Column(String, nullable=False)
    uci = Column(String, nullable=False)
    eval_before = Column(Integer)
    eval_after = Column(Integer)
    cp_loss = Column(Integer)
    classification = Column(String)
    best_move = Column(String)

    game = relationship("Game", back_populates="moves")

    __table_args__ = (Index("ix_moves_game_id_ply", "game_id", "ply"),)


class EloGuess(Base):
    __tablename__ = "elo_guesses"

    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    white_guess = Column(Integer, nullable=False)
    black_guess = Column(Integer, nullable=False)
    white_actual = Column(Integer, nullable=False)
    black_actual = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
