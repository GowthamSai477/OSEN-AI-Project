from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, get_db
from .schemas import HealthResponse
import os
from sqlalchemy.orm import Session

from contextlib import asynccontextmanager
from .services.scheduler_service import start_scheduler, stop_scheduler

from .models import Base
from .database import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()

app = FastAPI(title="Planora API", version="1.0", lifespan=lifespan)

# CORS setup
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "https://planora-ai-silk.vercel.app",
    "https://planora-ai.vercel.app",
]

env_origins = os.getenv("CORS_ORIGINS")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",")])

if os.getenv("FRONTEND_URL"):
    origins.append(os.getenv("FRONTEND_URL").strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Planora AI Backend is running."}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    from fastapi.responses import JSONResponse
    
    error_stack = traceback.format_exc()
    print(f"GLOBAL ERROR: {repr(exc)}")
    print(error_stack)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error", 
            "error": repr(exc),
            "traceback": error_stack if os.getenv("DEBUG") == "true" else "Disabled in production"
        }
    )

from .routers import ai, goals, planner, analytics, users, export, notifications, progress, subtasks, notes, export_notes, study, health, gamification

app.include_router(ai.router)
app.include_router(goals.router)
app.include_router(planner.router)
app.include_router(analytics.router)
app.include_router(users.router)
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(notifications.router)
app.include_router(progress.router)
app.include_router(subtasks.router, prefix="/api/subtasks", tags=["subtasks"])
app.include_router(notes.router)
app.include_router(health.router)
app.include_router(gamification.router)
app.include_router(export_notes.router)
app.include_router(study.router)

from sqlalchemy import text

@app.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    # Check db connection
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {e}"
        
    return {"status": "ok", "database": db_status}
