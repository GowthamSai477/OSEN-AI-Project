from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import SubTask, DailyTask, Notification
from ..auth import verify_clerk_token, ClerkUser
from pydantic import BaseModel
import uuid
import os
import json
from groq import Groq
from datetime import datetime, timedelta

router = APIRouter()
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

class SubTaskUpdate(BaseModel):
    completed: bool

@router.get("/{task_id}")
async def get_subtasks(task_id: str, db: Session = Depends(get_db), user: ClerkUser = Depends(verify_clerk_token)):
    subtasks = db.query(SubTask).filter(SubTask.task_id == task_id, SubTask.user_id == user.id).order_by(SubTask.order).all()
    return subtasks

@router.post("/generate/{task_id}")
async def generate_subtasks(task_id: str, db: Session = Depends(get_db), user: ClerkUser = Depends(verify_clerk_token)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id, DailyTask.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    prompt = f"""
    Task: {task.task}
    Category: {task.category}
    Duration: {task.duration_minutes} minutes
    
    Generate 3-6 specific subtasks for this task.
    Each subtask should fill the total duration.
    Return ONLY valid JSON array:
    [
      {{"title": "specific activity", "duration_minutes": 10}},
      ...
    ]
    Total durations must sum to {task.duration_minutes} minutes.
    Be specific — not "Exercise" but "Brisk walking".
    For Study tasks: break into topics/chapters.
    For Fitness: specific exercises with reps/duration.
    For Food/Meal: specific meal items with portions.
    """

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that generates specific subtasks in JSON format."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",
            max_tokens=300,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        response_content = chat_completion.choices[0].message.content
        data = json.loads(response_content)
        
        # Groq might return {"subtasks": [...]} or just [...] depending on the model and system prompt
        subtasks_data = data if isinstance(data, list) else data.get("subtasks", [])
        
        created_subtasks = []
        for i, st in enumerate(subtasks_data):
            new_subtask = SubTask(
                task_id=task.id,
                user_id=user.id,
                title=st["title"],
                duration_minutes=st["duration_minutes"],
                order=i
            )
            db.add(new_subtask)
            created_subtasks.append(new_subtask)
        
        db.commit()
        for st in created_subtasks:
            db.refresh(st)
        return created_subtasks
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{subtask_id}")
async def update_subtask(subtask_id: str, update: SubTaskUpdate, db: Session = Depends(get_db), user: ClerkUser = Depends(verify_clerk_token)):
    subtask = db.query(SubTask).filter(SubTask.id == subtask_id, SubTask.user_id == user.id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    
    subtask.completed = update.completed
    db.commit()
    
    # Check if all subtasks for parent task are done
    parent_task = db.query(DailyTask).filter(DailyTask.id == subtask.task_id).first()
    all_done = False
    if parent_task:
        remaining = db.query(SubTask).filter(SubTask.task_id == parent_task.id, SubTask.completed == False).count()
        if remaining == 0:
            parent_task.completed = True
            all_done = True
            db.commit()
            
    return {"subtask_updated": True, "task_completed": all_done}

@router.post("/redistribute/{task_id}")
async def redistribute_subtasks(task_id: str, db: Session = Depends(get_db), user: ClerkUser = Depends(verify_clerk_token)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id, DailyTask.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    incomplete_subtasks = db.query(SubTask).filter(SubTask.task_id == task_id, SubTask.completed == False).all()
    if not incomplete_subtasks:
        return {"redistributed": False, "message": "No incomplete subtasks found"}
    
    missed_mins = sum(st.duration_minutes for st in incomplete_subtasks)
    
    # Find future tasks with same category
    today = datetime.utcnow().date()
    future_tasks = db.query(DailyTask).filter(
        DailyTask.user_id == current_user,
        DailyTask.date > datetime(today.year, today.month, today.day),
        DailyTask.category == task.category
    ).order_by(DailyTask.date).limit(3).all()
    
    if not future_tasks:
        return {"redistributed": False, "message": "No future tasks of the same category found to redistribute to"}
    
    extra_per_day = missed_mins // len(future_tasks)
    for ft in future_tasks:
        ft.duration_minutes = (ft.duration_minutes or 0) + extra_per_day
    
    notif = Notification(
        user_id=user.id,
        title="⚡ Missed Tasks Redistributed",
        message=f"Missed {task.task} subtasks redistributed to next {len(future_tasks)} {task.category} sessions",
        type="missed_task",
        link="/dashboard/schedule"
    )
    db.add(notif)
    db.commit()
    
    return {"redistributed": True, "message": f"Missed time ({missed_mins} mins) redistributed across {len(future_tasks)} sessions"}
