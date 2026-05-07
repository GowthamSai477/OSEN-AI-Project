from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import verify_clerk_token, ClerkUser
from ..services.analytics_service import generate_weekly_report, suggest_tasks
from ..services.planner_service import check_schedule_health

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.post("/report")
async def create_weekly_report(week_offset: int = 0, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    report = await generate_weekly_report(user.id, week_offset, db)
    return {"success": True, "report": report}

@router.get("/insights")
def get_insights(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    health = check_schedule_health(user.id, db)
    return {"success": True, "health": health}

@router.get("/suggest")
async def get_suggestions(count: int = 3, focus: str = "general", user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    suggestions = await suggest_tasks(user.id, count, focus, db)
    return {"success": True, "suggestions": suggestions}
