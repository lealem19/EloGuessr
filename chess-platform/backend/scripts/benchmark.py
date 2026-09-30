#!/usr/bin/env python
"""Benchmark the position cache and worker parallelism.

1. Zobrist cache benchmark: re-analyzes a sample of already-imported games
   twice at the same depth -- once bypassing the position cache entirely
   (every position hits the engine), once through it (starts empty, fills
   as shared openings/transpositions recur across the sample) -- and prints
   the engine-calls-saved percentage and wall-clock time for both.

2. Worker throughput benchmark: analyzes two fresh (never-before-seen)
   batches of games pulled further into the PGN file, one batch through a
   single `rq worker`, the other through four, to show real parallel
   throughput rather than a cache-assisted number.

Usage:
    python scripts/benchmark.py data/lichess_db_standard_rated_2013-01.pgn
"""
import argparse
import io
import os
import subprocess
import sys
import time

import chess
import chess.engine
import chess.pgn
from sqlalchemy import text

from app.analysis import evaluate
from app.config import STOCKFISH_PATH
from app.db import Base, SessionLocal, engine as sa_engine
from app.models import Game
from app.queue import analysis_queue
from app.worker import analyze_game
from scripts.import_games import load_games


def iter_positions(pgn_text: str):
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    board = game.board()
    yield board.copy()
    for move in game.mainline_moves():
        board.push(move)
        yield board.copy()


def bench_no_cache(pgns, depth, eng):
    total = 0
    t0 = time.time()
    for pgn in pgns:
        for board in iter_positions(pgn):
            if board.is_game_over():
                continue
            eng.analyse(board, chess.engine.Limit(depth=depth))
            total += 1
    return total, time.time() - t0


def bench_with_cache(pgns, depth, eng, db):
    total = 0
    hits = 0
    t0 = time.time()
    for pgn in pgns:
        for board in iter_positions(pgn):
            _, _, hit = evaluate(board, eng, depth, db)
            total += 1
            hits += int(hit)
        db.commit()  # one commit per game, matching worker.py's batching
    return total, hits, time.time() - t0


def cache_benchmark(sample: int, depth: int):
    db = SessionLocal()
    games = db.query(Game).filter(Game.status == "done").limit(sample).all()
    pgns = [g.pgn for g in games]
    db.close()

    print(f"\n=== Zobrist cache benchmark ({len(pgns)} games, depth={depth}) ===")
    if not pgns:
        print("No analyzed games found -- run the import script first.")
        return

    # Fresh start: wipe the position cache at this depth so both passes are
    # apples-to-apples. Safe -- Move rows (what the API/UI actually serve)
    # are independent of the Position cache.
    db = SessionLocal()
    db.execute(text("DELETE FROM positions WHERE depth = :d"), {"d": depth})
    db.commit()
    db.close()

    eng = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    eng.configure({"Threads": 1})

    n_no_cache, t_no_cache = bench_no_cache(pgns, depth, eng)

    db = SessionLocal()
    n_with_cache, hits, t_with_cache = bench_with_cache(pgns, depth, eng, db)
    db.close()

    eng.quit()

    unique = n_with_cache - hits
    saved_pct = 100 * hits / max(1, n_with_cache)

    print(
        f"positions: {n_with_cache}   unique: {unique}   "
        f"engine calls saved: {saved_pct:.1f}%   "
        f"time: {t_no_cache:.1f}s -> {t_with_cache:.1f}s"
    )
    return {
        "positions": n_with_cache,
        "unique": unique,
        "saved_pct": saved_pct,
        "time_no_cache": t_no_cache,
        "time_with_cache": t_with_cache,
    }


def start_workers(n: int, log_prefix: str):
    env = {**os.environ, "PYTHONPATH": "."}
    procs = []
    for i in range(n):
        log = open(f"{log_prefix}_{i}.log", "w")
        p = subprocess.Popen(
            # --burst: process whatever's on the queue, then exit. That exit
            # is the completion signal, so timing doesn't depend on polling
            # individual job objects. SimpleWorker avoids RQ's default
            # fork-per-job model, which crashes on macOS.
            [sys.executable, "-m", "rq.cli", "worker",
             "--worker-class", "rq.worker.SimpleWorker", "--burst", "analysis",
             "--url", os.environ.get("REDIS_URL", "redis://localhost:6379/0")],
            env=env, stdout=log, stderr=subprocess.STDOUT,
        )
        procs.append(p)
    return procs


def run_batch_with_n_workers(pgn_games, depth: int, n_workers: int, tag: str):
    db = SessionLocal()
    rows = []
    for g in pgn_games:
        h = g.headers
        row = Game(
            white=h.get("White", "?"),
            black=h.get("Black", "?"),
            white_elo=int(h["WhiteElo"]),
            black_elo=int(h["BlackElo"]),
            result=h.get("Result"),
            pgn=str(g),
            status="queued",
        )
        db.add(row)
        rows.append(row)
    db.commit()
    ids = [r.id for r in rows]
    db.close()

    for gid in ids:
        analysis_queue.enqueue(analyze_game, gid, depth, job_timeout=1800)

    t0 = time.time()
    procs = start_workers(n_workers, f"/tmp/bench_worker_{tag}")
    for p in procs:
        p.wait(timeout=600)
    elapsed = time.time() - t0

    return len(ids), elapsed


def worker_benchmark(pgn_path: str, batch_size: int, depth: int, already_used: int):
    print(f"\n=== Worker throughput benchmark ({batch_size} games/batch, depth={depth}) ===")
    all_games = load_games(pgn_path, already_used + 2 * batch_size)
    fresh = all_games[already_used:]
    batch_1 = fresh[:batch_size]
    batch_4 = fresh[batch_size : 2 * batch_size]

    if len(batch_1) < batch_size or len(batch_4) < batch_size:
        print("Not enough fresh games left in the PGN file for this benchmark size.")
        return

    n1, t1 = run_batch_with_n_workers(batch_1, depth, 1, "1w")
    print(f"1 worker:  {n1} games in {t1:.1f}s  ({n1 / t1:.2f} games/sec)")

    n4, t4 = run_batch_with_n_workers(batch_4, depth, 4, "4w")
    print(f"4 workers: {n4} games in {t4:.1f}s  ({n4 / t4:.2f} games/sec)")

    speedup = (n4 / t4) / (n1 / t1)
    print(f"speedup: {speedup:.2f}x")
    return {"n1": n1, "t1": t1, "n4": n4, "t4": t4, "speedup": speedup}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pgn_path")
    parser.add_argument("--sample", type=int, default=50, help="games for the cache benchmark")
    parser.add_argument("--depth", type=int, default=12)
    parser.add_argument("--worker-batch", type=int, default=15, help="games per batch for the worker benchmark")
    parser.add_argument("--already-imported", type=int, default=400, help="games already imported, to skip for fresh batches")
    parser.add_argument("--skip-workers", action="store_true", help="only run the cache benchmark")
    args = parser.parse_args()

    Base.metadata.create_all(bind=sa_engine)

    cache_benchmark(args.sample, args.depth)

    if not args.skip_workers:
        worker_benchmark(args.pgn_path, args.worker_batch, args.depth, args.already_imported)


if __name__ == "__main__":
    main()
