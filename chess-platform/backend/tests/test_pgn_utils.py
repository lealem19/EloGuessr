import pytest

from app.pgn_utils import extract_lichess_game_id


class TestExtractLichessGameId:
    def test_plain_game_url(self):
        assert extract_lichess_game_id("https://lichess.org/AbCd1234") == "AbCd1234"

    def test_www_host_accepted(self):
        assert extract_lichess_game_id("https://www.lichess.org/AbCd1234") == "AbCd1234"

    def test_color_suffix_ignored(self):
        # /<id>/black and /<id>/white point at the same game
        assert extract_lichess_game_id("https://lichess.org/AbCd1234/black") == "AbCd1234"

    def test_rejects_non_lichess_host(self):
        with pytest.raises(ValueError):
            extract_lichess_game_id("https://chess.com/game/live/12345")

    def test_rejects_missing_scheme(self):
        with pytest.raises(ValueError):
            extract_lichess_game_id("lichess.org/AbCd1234")

    def test_rejects_url_with_no_game_id(self):
        with pytest.raises(ValueError):
            extract_lichess_game_id("https://lichess.org/")

    def test_rejects_reserved_top_level_routes(self):
        # /analysis and /training are real 8-letter Lichess routes, not
        # games -- must not be mistaken for an 8-char game id.
        with pytest.raises(ValueError):
            extract_lichess_game_id("https://lichess.org/analysis")
        with pytest.raises(ValueError):
            extract_lichess_game_id("https://lichess.org/training")
