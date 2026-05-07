from sqlalchemy.orm import Session
from ..models import DailyTask
from datetime import datetime, timedelta

def check_schedule_health(user_id: str, db: Session) -> dict:
    today = datetime.now().date()
    
    # Check if any upcoming day has > 8 hours
    upcoming_tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user_id,
        DailyTask.date >= today,
        DailyTask.date <= today + timedelta(days=7)
    ).all()
    
    daily_duration = {}
    for t in upcoming_tasks:
        date_str = str(t.date.date())
        if date_str not in daily_duration:
            daily_duration[date_str] = 0
        daily_duration[date_str] += t.duration_minutes
        
    overloaded_days = []
    for date, duration in daily_duration.items():
        if duration > 480: # > 8 hours
            overloaded_days.append(date)
            
    # Check 3-day zero completion streak
    past_tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user_id,
        DailyTask.date < today,
        DailyTask.date >= today - timedelta(days=3)
    ).all()
    
    past_by_day = {}
    for t in past_tasks:
        date_str = str(t.date.date())
        if date_str not in past_by_day:
            past_by_day[date_str] = {"total": 0, "completed": 0}
        past_by_day[date_str]["total"] += 1
        if t.completed:
            past_by_day[date_str]["completed"] += 1
            
    burnout_risk = False
    if len(past_by_day) == 3:
        zero_completion_days = sum(1 for d in past_by_day.values() if d["completed"] == 0 and d["total"] > 0)
        if zero_completion_days == 3:
            burnout_risk = True
            
    return {
        "overloaded_days": overloaded_days,
        "burnout_risk": burnout_risk,
        "warning_message": "Burnout Risk: You've skipped tasks for 3 consecutive days." if burnout_risk else None
    }
