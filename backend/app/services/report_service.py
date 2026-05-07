"""
Shared weekly-report calculation logic.
Used by both the scheduler (batch) and the progress router (on-demand).
"""

import os
from datetime import datetime, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session

from ..models import DailyTask, WeeklyReport, User
from ..services.email_service import calculate_user_streak


def _week_bounds(anchor: datetime):
    """Return (week_start, week_end) as Monday–Sunday for the week containing anchor."""
    # anchor.weekday() == 0 for Monday
    week_start = (anchor - timedelta(days=anchor.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end   = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return week_start, week_end


def _calc_rate(tasks) -> int:
    if not tasks:
        return 0
    completed = sum(1 for t in tasks if t.completed)
    return round(completed / len(tasks) * 100)


def _best_worst_category(tasks):
    by_cat: dict[str, list] = defaultdict(list)
    for t in tasks:
        cat = (t.category or "Other").strip()
        by_cat[cat].append(t)

    rates = {}
    for cat, cat_tasks in by_cat.items():
        if len(cat_tasks) >= 2:          # only categories with ≥2 tasks are meaningful
            rates[cat] = _calc_rate(cat_tasks)

    if not rates:
        return None, None

    best  = max(rates, key=lambda c: rates[c])
    worst = min(rates, key=lambda c: rates[c])
    return best if rates[best] > 0 else None, worst if rates[worst] < 100 else None


def _on_track(rate: int) -> str:
    if rate >= 70:
        return "on_track"
    if rate >= 50:
        return "at_risk"
    return "behind"


def _generate_recommendation(worst_category: str | None, on_track_status: str) -> str:
    """Call Groq for a short 1-2 sentence tip. Falls back to a static message."""
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

        if worst_category:
            prompt = (
                f"The user's worst-performing category this week is '{worst_category}' and their "
                f"overall status is '{on_track_status}'. "
                "Write a single, encouraging, actionable tip (max 2 sentences, under 80 words) "
                "to help them improve next week. Be specific and positive."
            )
        else:
            prompt = (
                f"The user's weekly planning status is '{on_track_status}'. "
                "Write one encouraging tip (max 2 sentences) to help them stay or get on track."
            )

        resp = client.chat.completions.create(
            model="llama3-8b-8192", # Faster model for report generation
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[WeeklyReport] Groq recommendation failed: {e}")
        if on_track_status == "on_track":
            return "Great work this week! Keep up your momentum by scheduling your next week's tasks tonight."
        if on_track_status == "at_risk":
            return "You're close — aim to complete just one extra task per day to cross the 70% threshold."
        return "Break your tasks into smaller 15-minute steps and tackle them one at a time to rebuild momentum."


def calculate_weekly_report(user_id: str, db: Session, anchor: datetime | None = None) -> dict:
    """
    Calculate a weekly report for user_id.
    anchor defaults to now (= current week).
    Returns a dict with all report fields — does NOT write to the DB.
    """
    now = anchor or datetime.utcnow()
    ws, we = _week_bounds(now)
    prev_ws = ws - timedelta(days=7)
    prev_we = ws - timedelta(seconds=1)

    this_week_tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user_id,
        DailyTask.date >= ws,
        DailyTask.date <= we,
    ).all()

    prev_week_tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user_id,
        DailyTask.date >= prev_ws,
        DailyTask.date <= prev_we,
    ).all()

    total_tasks      = len(this_week_tasks)
    total_completed  = sum(1 for t in this_week_tasks if t.completed)
    completion_rate  = _calc_rate(this_week_tasks)
    prev_rate        = _calc_rate(prev_week_tasks)
    best_cat, worst_cat = _best_worst_category(this_week_tasks)
    on_track         = _on_track(completion_rate)
    streak           = calculate_user_streak(user_id, db)
    recommendation   = _generate_recommendation(worst_cat, on_track)

    return {
        "week_start":           ws,
        "week_end":             we,
        "completion_rate":      completion_rate,
        "prev_completion_rate": prev_rate,
        "best_category":        best_cat,
        "worst_category":       worst_cat,
        "total_completed":      total_completed,
        "total_tasks":          total_tasks,
        "streak":               streak,
        "on_track_status":      on_track,
        "ai_recommendation":    recommendation,
    }


def get_or_create_report(user_id: str, db: Session, anchor: datetime | None = None) -> "WeeklyReport":
    """
    Return the cached WeeklyReport for this week if it exists,
    otherwise calculate it on-the-fly and persist it.
    """
    now = anchor or datetime.utcnow()
    ws, we = _week_bounds(now)

    existing = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == user_id,
        WeeklyReport.week_start == ws,
    ).first()

    if existing:
        return existing

    data = calculate_weekly_report(user_id, db, anchor=now)
    if data["total_tasks"] == 0:
        return None                   # Nothing to report

    report = WeeklyReport(user_id=user_id, **data)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
