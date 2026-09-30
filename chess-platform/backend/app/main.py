from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .routers import games, guess

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Chess Analysis Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router)
app.include_router(guess.router)


@app.get("/health")
def health():
    return {"status": "ok"}
