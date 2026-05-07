from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ..database import get_db
from ..auth import verify_clerk_token, ClerkUser
from ..models import WeeklyReport
from ..services.report_service import get_or_create_report

router = APIRouter(prefix="/api/progress", tags=["Progress"])


def _report_to_dict(r: WeeklyReport) -> dict:
    return {
        "id":                   str(r.id),
        "week_start":           r.week_start.isoformat(),
        "week_end":             r.week_end.isoformat(),
        "completion_rate":      r.completion_rate,
        "prev_completion_rate": r.prev_completion_rate,
        "best_category":        r.best_category,
        "worst_category":       r.worst_category,
        "total_completed":      r.total_completed,
        "total_tasks":          r.total_tasks,
        "streak":               r.streak,
        "on_track_status":      r.on_track_status,
        "ai_recommendation":    r.ai_recommendation,
        "created_at":           r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/weekly")
def get_weekly_report(
    user: ClerkUser = Depends(verify_clerk_token),
    db:   Session   = Depends(get_db),
):
    """Return (or generate) the weekly report for the current week."""
    report = get_or_create_report(user.id, db)
    if not report:
        return {"no_data": True, "message": "No tasks found for this week yet."}
    return _report_to_dict(report)


@router.get("/history")
def get_report_history(
    user: ClerkUser = Depends(verify_clerk_token),
    db:   Session   = Depends(get_db),
):
    """Return the last 4 weekly reports for trend display."""
    reports = (
        db.query(WeeklyReport)
        .filter(WeeklyReport.user_id == user.id)
        .order_by(WeeklyReport.week_start.desc())
        .limit(4)
        .all()
    )

    # If there's no history at all, generate the current week on-the-fly
    if not reports:
        r = get_or_create_report(user.id, db)
        reports = [r] if r else []

    return [_report_to_dict(r) for r in reports]
