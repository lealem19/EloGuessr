# Chess Analysis Platform

A full-stack chess analysis platform: paste a PGN, get a Stockfish-backed
move-by-move breakdown (eval graph, blunder/mistake/inaccuracy classification,
best-move suggestions), or play **Guess the Elo** — watch a real game unfold
and guess both players' ratings from their moves alone.

Analysis is distributed across a Redis-backed RQ job queue and parallel
Stockfish workers, backed by a Postgres position cache keyed on Zobrist
hashes so repeated positions (openings, transpositions, re-analysis) never
hit the engine twice.

## Benchmarks

_(measured against 400 real Lichess games from `lichess_db_standard_rated_2013-01`,
depth 12, on this machine — see [How to run](#how-to-run) → Benchmark to reproduce)_

**Position cache**

| run | positions | unique (engine calls) | cache hit rate | time |
|---|---|---|---|---|
| cross-game reuse, cold cache | 25,892 | 23,820 | 8.0% | 619.9s → 635.1s |
| re-analysis, warm cache | 25,892 | 0 | 100% | 619.9s → **6.8s** |

Even across 400 *different* games with no shared history, ~8% of positions
are exact transpositions (openings mostly) and skip the engine for free.
The bigger win shows up on re-analysis: once a game's positions are cached,
re-running the same analysis is **91x faster** — 0 engine calls, pure cache
reads. (The cold-cache pass looks marginally *slower* than no-cache at all
here — with only 8% overlap, the SELECT/INSERT round-trip per position isn't
fully paid back yet; the DB overhead only nets positive once reuse climbs,
which is exactly what the warm-cache row shows.)

**Worker throughput** (15 fresh, never-before-seen games per batch)

| workers | games | time | throughput |
|---|---|---|---|
| 1 | 15 | 26.6s | 0.56 games/sec |
| 4 | 15 | 8.1s | 1.86 games/sec |

**3.29x** speedup going from 1 to 4 parallel Stockfish workers (of a
theoretical 4x — the gap is queue/DB overhead shared across workers).

## Architecture

```
                    ┌─────────────┐
   paste PGN  ───▶  │   Next.js   │  poll GET /games/:id every 2s while queued
                    │  (frontend) │◀───────────────┐
                    └──────┬──────┘                │
                           │ REST (fetch)           │
                           ▼                        │
                    ┌─────────────┐                 │
                    │   FastAPI   │─────────────────┘
                    │  (backend)  │
                    └──┬───────┬──┘
                       │       │
         POST /games   │       │ GET /games/:id, /guess/*
      (enqueue job)    │       │ (read games/moves/positions)
                       ▼       ▼
                 ┌──────────┐ ┌────────────┐
                 │  Redis   │ │  Postgres  │
                 │  (RQ     │ │  games     │
                 │  queue)  │ │  moves     │
                 └────┬─────┘ │  positions │◀── unique(zobrist, depth)
                      │       │  elo_guesses│    cache: same position,
        analysis jobs │       └─────▲──────┘    same depth → no engine call
                      ▼             │
              ┌───────────────┐     │ cache hit/miss
              │  rq worker ×N │─────┘
              │  (1 Stockfish │
              │  process each)│──▶ Stockfish (depth-limited analyse)
              └───────────────┘
```

Each `rq worker` process owns one long-lived Stockfish process (`Threads=1`)
reused across every job it picks up, so N worker processes give N-way
parallelism without paying engine-startup cost per game. Every position
evaluated (before *and* after each move) is looked up by
`(zobrist_hash, depth)` in Postgres before falling back to the engine; a
`python-chess` Zobrist hash is unsigned 64-bit, so it's remapped into
Postgres's signed `BIGINT` range before storage.

## Repo layout

```
chess-platform/
  backend/    FastAPI + SQLAlchemy + RQ
    app/            API, models, analysis core, worker
    scripts/         bulk import + benchmark
    tests/          pytest (cp_loss / classify / Zobrist signing)
  frontend/   Next.js (App Router) + TypeScript
    app/            home, /games/[id] analyzer, /guess
    lib/            typed API client
  docker-compose.yml   Postgres + Redis only — everything else runs locally
```

## How to run

**1. Infra**

```bash
docker compose up -d          # Postgres on :5432, Redis on :6379
```

**2. Backend**

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
brew install stockfish         # or: apt install stockfish

.venv/bin/uvicorn app.main:app --reload --port 8000
```

**3. Workers** (run each in its own terminal — on macOS you need the fork-safety
env var below, or RQ's forked work-horses crash on startup)

```bash
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES PYTHONPATH=. .venv/bin/rq worker analysis
```

Run this 4 times (4 terminals, or background them) for 4-way parallelism.

**4. Frontend**

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev        # http://localhost:3000
```

**5. Bulk import** (optional — populates real games for the analyzer and
Guess the Elo; also what the benchmark numbers above were measured against)

```bash
cd backend/data
curl -O https://database.lichess.org/standard/lichess_db_standard_rated_2013-01.pgn.zst
zstd -d lichess_db_standard_rated_2013-01.pgn.zst
cd ..

.venv/bin/python -m scripts.import_games data/lichess_db_standard_rated_2013-01.pgn \
  --limit 400 --depth 12 --wait
```

**6. Benchmark**

```bash
cd backend
.venv/bin/python -m scripts.benchmark data/lichess_db_standard_rated_2013-01.pgn
```

## Tests / CI

```bash
cd backend && .venv/bin/pytest -q
```

`.github/workflows/backend-tests.yml` runs the same suite on every push /
PR touching `chess-platform/backend/**`.

## Resume bullet

> Built a full-stack chess analysis platform (Next.js/TypeScript, FastAPI,
> PostgreSQL, Redis) with a distributed Stockfish job queue; Zobrist-hash
> position caching made re-analysis of previously-seen games 91x faster
> (100% cache hit rate) and cut engine calls by 8% even across distinct
> games via shared openings, while parallel workers delivered a 3.29x
> throughput gain (1 → 4 workers) on 403 real Lichess games.
