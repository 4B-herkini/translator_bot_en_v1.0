from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import translate

app = FastAPI(title="TransLit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translate.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
