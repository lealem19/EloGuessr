import io
import re
from urllib.parse import urlparse

import chess.pgn

_LICHESS_HOSTS = {"lichess.org", "www.lichess.org"}
_LICHESS_ID_RE = re.compile(r"^/([A-Za-z0-9]{8})(?:/|$)")

# A real game id is an 8-char base62 token, but that's indistinguishable at
# the URL-shape level from Lichess's own 8-letter top-level routes (e.g.
# /analysis, /training). Best-effort denylist for the ones known to collide;
# anything that slips through still fails cleanly as a 404 from Lichess.
_RESERVED_TOP_LEVEL = {"analysis", "training", "practice", "streamer"}


def extract_lichess_game_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or parsed.netloc not in _LICHESS_HOSTS:
        raise ValueError("not a lichess.org game URL")

    match = _LICHESS_ID_RE.match(parsed.path)
    if not match or match.group(1).lower() in _RESERVED_TOP_LEVEL:
        raise ValueError("couldn't find a game id in that URL")

    return match.group(1)


def parse_game_headers(pgn_text: str) -> dict:
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        raise ValueError("invalid PGN")

    h = game.headers

    def to_int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    return {
        "white": h.get("White", "?"),
        "black": h.get("Black", "?"),
        "white_elo": to_int(h.get("WhiteElo")),
        "black_elo": to_int(h.get("BlackElo")),
        "result": h.get("Result"),
    }
