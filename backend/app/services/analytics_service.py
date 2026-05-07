from sqlalchemy.orm import Session
from ..models import DailyTask, Goal, ProgressLog
from datetime import datetime, timedelta
from .provider_service import AIProviderService
import json

provider_service = AIProviderService()

async def generate_weekly_report(user_id: str, week_offset: int, db: Session) -> dict:
    today = datetime.now()
    start_date = today - timedelta(days=today.weekday() + (7 * week_offset))
    end_date = start_date + timedelta(days=6)
    
    tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user_id,
        DailyTask.date >= start_date,
        DailyTask.date <= end_date
    ).all()
    
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.completed)
    
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    categories = {}
    for t in tasks:
        cat = t.category
        if cat not in categories:
            categories[cat] = {"total": 0, "completed": 0}
        categories[cat]["total"] += 1
        if t.completed:
            categories[cat]["completed"] += 1
            
    # Send data to Groq to generate text report
    prompt = f"""
    Analyze this week's data and write a short, human-readable weekly report.
    Total Tasks: {total_tasks}
    Completed: {completed_tasks} ({completion_rate:.1f}%)
    Categories Breakdown: {json.dumps(categories)}
    Identify the most neglected category and the most overloaded day if any. Give brief recommendations.
    Format clearly with headers and bullet points.
    """
    
    response = await provider_service.chat(
        messages=[
            {"role": "system", "content": "You are Planora's analytics engine. Write a warm but direct weekly review."},
            {"role": "user", "content": prompt}
        ]
    )
    
    return {
        "text": response["content"],
        "metrics": {
            "completion_rate": completion_rate,
            "total": total_tasks,
            "completed": completed_tasks
        }
    }

async def suggest_tasks(user_id: str, count: int, focus_area: str, db: Session) -> list:
    goal = db.query(Goal).filter(Goal.user_id == user_id).first()
    goal_title = goal.title if goal else "General productivity"
    
    prompt = f"""
    Based on the goal: '{goal_title}', suggest {count} highly impactful daily tasks.
    Focus Area: {focus_area if focus_area else 'General'}
    Provide them as a JSON list of objects with 'task', 'duration_minutes', and 'category'.
    Only output the JSON list, nothing else.
    """
    
    response = await provider_service.chat(
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Simple extraction attempt
    try:
        content = response["content"]
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        suggestions = json.loads(content)
        return suggestions
    except:
        return [{"task": "Review goals", "duration_minutes": 15, "category": "personal"}]
