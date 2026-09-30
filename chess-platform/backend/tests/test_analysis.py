import chess

from app.analysis import cp_loss, classify, to_signed, MATE


class TestCpLoss:
    def test_white_move_loses_centipawns(self):
        # White was +100, drops to +40 after their move -> 60cp loss
        assert cp_loss(before=100, after=40, mover=chess.WHITE) == 60

    def test_black_move_loses_centipawns(self):
        # Eval is always from White's POV. Black is happy when it goes down.
        # Black was fine at -100, their move makes it -20 (better for White) -> loss for Black
        assert cp_loss(before=-100, after=-20, mover=chess.BLACK) == 80

    def test_black_move_gains_centipawns_no_loss(self):
        # Eval moves further in Black's favor -> no loss, clamped to 0
        assert cp_loss(before=-20, after=-100, mover=chess.BLACK) == 0

    def test_negative_loss_clamped_to_zero(self):
        # White's move improves the position -> no loss
        assert cp_loss(before=40, after=100, mover=chess.WHITE) == 0

    def test_mate_score_is_clamped_before_diffing(self):
        # Going from a huge mate-in-favor score to 0 shouldn't register as a
        # loss larger than the 1000cp clamp allows.
        loss = cp_loss(before=MATE, after=0, mover=chess.WHITE)
        assert loss == 1000

    def test_zero_loss_for_equal_eval(self):
        assert cp_loss(before=15, after=15, mover=chess.WHITE) == 0


class TestClassify:
    def test_good_move(self):
        assert classify(0) == "good"
        assert classify(29) == "good"

    def test_inaccuracy_boundary(self):
        assert classify(30) == "inaccuracy"
        assert classify(79) == "inaccuracy"

    def test_mistake_boundary(self):
        assert classify(80) == "mistake"
        assert classify(199) == "mistake"

    def test_blunder_boundary(self):
        assert classify(200) == "blunder"
        assert classify(1000) == "blunder"


class TestToSigned:
    def test_small_positive_hash_unchanged(self):
        assert to_signed(12345) == 12345

    def test_large_unsigned_hash_becomes_negative(self):
        # Anything >= 2**63 must wrap into signed 64-bit range for Postgres BIGINT
        h = 2**63 + 5
        signed = to_signed(h)
        assert signed == 5 - 2**63
        assert -(2**63) <= signed < 2**63

    def test_max_uint64_wraps_to_minus_one(self):
        assert to_signed(2**64 - 1) == -1
