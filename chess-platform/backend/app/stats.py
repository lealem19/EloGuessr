from . import schemas


def _stats_for(moves, parity: int) -> "schemas.PlayerStats":
    # ply 1,3,5,... are White's moves; ply 2,4,6,... are Black's
    subset = [m for m in moves if m.ply % 2 == parity]
    if not subset:
        return schemas.PlayerStats(acpl=0.0, inaccuracies=0, mistakes=0, blunders=0)
    acpl = sum(m.cp_loss or 0 for m in subset) / len(subset)
    return schemas.PlayerStats(
        acpl=round(acpl, 1),
        inaccuracies=sum(1 for m in subset if m.classification == "inaccuracy"),
        mistakes=sum(1 for m in subset if m.classification == "mistake"),
        blunders=sum(1 for m in subset if m.classification == "blunder"),
    )


def compute_stats(moves):
    return _stats_for(moves, 1), _stats_for(moves, 0)
