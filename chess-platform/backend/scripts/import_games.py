#!/usr/bin/env python
"""Bulk-import games from a PGN file and enqueue them for analysis.

Usage:
    python scripts/import_games.py data/lichess_db_standard_rated_2013-01.pgn \
        --limit 400 --depth 12 --wait

Run one or more `rq worker analysis` processes (from the backend/ dir) so the
enqueued jobs actually get processed. With --wait, this script polls job
results and prints the same positions / cache-hit / seconds numbers the
benchmark step needs.
"""
import argparse
import time

import chess.pgn

from app.db import Base, SessionLocal, engine
from app.models import Game
from app.queue import analysis_queue
from app.worker import analyze_game


def load_games(pgn_path: str, limit: int, min_plies: int = 20):
    games = []
    with open(pgn_path, encoding="utf-8", errors="replace") as f:
        while len(games) < limit:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            h = game.headers
            if not h.get("WhiteElo", "").isdigit() or not h.get("BlackElo", "").isdigit():
                continue
            if sum(1 for _ in game.mainline_moves()) < min_plies:
                continue
            games.append(game)
    return games


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pgn_path")
    parser.add_argument("--limit", type=int, default=400)
    parser.add_argument("--depth", type=int, default=12)
    parser.add_argument(
        "--wait",
        action="store_true",
        help="poll until all enqueued jobs finish and print aggregate stats",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)

    print(f"Reading up to {args.limit} rated games (>= {20} plies) from {args.pgn_path} ...")
    t0 = time.time()
    games = load_games(args.pgn_path, args.limit)
    print(f"Loaded {len(games)} eligible games in {time.time() - t0:.1f}s")

    db = SessionLocal()
    jobs = []
    for g in games:
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
        db.commit()
        db.refresh(row)
        job = analysis_queue.enqueue(analyze_game, row.id, args.depth, job_timeout=1800)
        jobs.append((row.id, job))
    db.close()
    print(f"Enqueued {len(jobs)} analysis jobs on queue '{analysis_queue.name}' at depth {args.depth}.")

    if not args.wait:
        print("Run with --wait to block and print aggregate positions/cache-hit stats.")
        return

    print("Waiting for `rq worker analysis` processes to finish the queue...")
    total_positions = 0
    total_cache_hits = 0
    total_engine_seconds = 0.0
    done = 0
    failed = 0
    pending = dict(jobs)
    start = time.time()

    while pending:
        for gid, job in list(pending.items()):
            job.refresh()
            if job.is_finished:
                result = job.result or {}
                total_positions += result.get("positions", 0)
                total_cache_hits += result.get("cache_hits", 0)
                total_engine_seconds += result.get("seconds", 0.0)
                done += 1
                del pending[gid]
            elif job.is_failed:
                failed += 1
                del pending[gid]
        print(f"  {done + failed}/{len(jobs)} done ({failed} failed), {len(pending)} pending...", end="\r")
        if pending:
            time.sleep(2)
    wall = time.time() - start

    print()
    print("=== Import summary ===")
    print(f"games analyzed:      {done} ({failed} failed)")
    print(f"positions:           {total_positions}")
    hit_pct = 100 * total_cache_hits / max(1, total_positions)
    print(f"cache hits:          {total_cache_hits} ({hit_pct:.1f}%)")
    print(f"engine calls saved:  {hit_pct:.1f}%")
    print(f"total engine time:   {total_engine_seconds:.1f}s (summed across workers)")
    print(f"wall time:           {wall:.1f}s")
    print(f"avg sec/game:        {total_engine_seconds / max(1, done):.2f}s (engine) / {wall / max(1, done):.2f}s (wall)")


if __name__ == "__main__":
    main()
