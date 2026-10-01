import os

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg2://postgres:dev@localhost:5432/chess"
)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
STOCKFISH_PATH = os.environ.get("STOCKFISH_PATH", "stockfish")
DEFAULT_DEPTH = int(os.environ.get("ANALYSIS_DEPTH", "12"))
