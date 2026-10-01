# EloGuessr

A GeoGuessr-style game for chess ratings: watch a real rated game play out
move by move, no names or numbers attached, and guess both players' Elo.
**Daily** is one pinned game a day, same for everyone; **Match** is five
rounds with a running score and an end-of-match recap.

Underneath it, every game — whether played through EloGuessr or submitted
directly — gets a full Stockfish breakdown (eval graph, blunder/mistake/
inaccuracy classification, best-move suggestions) via the **Analyze** tab:
paste a PGN or a Lichess game URL. That analysis pipeline is what powers
EloGuessr itself, not a separate feature bolted on afterward.

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
backend/    FastAPI + SQLAlchemy + RQ
  app/            API, models, analysis core, worker
  scripts/         bulk import + benchmark
  tests/          pytest (cp_loss / classify / Zobrist signing)
frontend/   Next.js (App Router) + TypeScript
  app/            / (landing), /daily, /match, /analyze, /games/[id]
  components/     shared EloGuessr UI (slider, move controls, nav)
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

**3. Workers** (run each in its own terminal, or background them)

```bash
cd backend
PYTHONPATH=. .venv/bin/rq worker --worker-class rq.worker.SimpleWorker analysis
```

Run this 4 times for 4-way parallelism. `SimpleWorker` runs jobs in-process
instead of RQ's default fork-per-job model — RQ's default forking crashes on
macOS (`Objective-C fork safety`) once any framework has touched the ObjC
runtime pre-fork, which happens easily via psycopg2/networking libs. The
trade-off is that a job no longer gets its own OS-level process sandbox, so a
hard crash inside one job takes down that worker rather than just that job;
`app/worker.py` guards the common case (a dead Stockfish process) by
respawning the engine on the next job instead of wedging the worker.

**4. Frontend**

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev        # http://localhost:3000
```

**5. Bulk import** (optional — populates real games for Daily/Match and the
analyzer; also what the benchmark numbers above were measured against)

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
PR touching `backend/**`.

## Resume bullets

One bullet, if you only get one:

> Built EloGuessr, a full-stack web game (Next.js/TypeScript, FastAPI,
> PostgreSQL, Redis) where players guess a chess player's rating from their
> moves alone, backed by a distributed Stockfish analysis pipeline;
> Zobrist-hash position caching made re-analysis of previously-seen games
> 91x faster (100% cache hit) and parallel RQ workers delivered a 3.29x
> throughput gain across 430+ real Lichess games.

Split in two, if the role wants product + infra separated:

> Designed and built EloGuessr, a GeoGuessr-style game for chess ratings
> (Next.js/TypeScript, FastAPI, PostgreSQL) — a daily challenge and a
> 5-round match mode, direct Lichess game import, and a percentile-ranking
> feature computed live from real historical gameplay data stored in
> Postgres.

> Built the distributed analysis engine underneath it: a Redis-backed RQ
> job queue with parallel Stockfish workers and a Zobrist-hash position
> cache, cutting re-analysis time by 91x (100% cache hit rate) and
> delivering a 3.29x throughput gain across 4 parallel workers on 430+ real
> Lichess games; 20 automated tests with CI via GitHub Actions.
