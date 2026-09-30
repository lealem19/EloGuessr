import io
import chess.pgn


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
