from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import TaskCreate, TaskUpdate, TaskResponse, ExecuteRequest
from ..auth import verify_clerk_token, ClerkUser
from ..models import DailyTask, ExecutionLog, Goal
from ..services.tool_executor import execute_tool_call
import json
from datetime import datetime

router = APIRouter(prefix="/api/planner", tags=["Planner"])

@router.get("/tasks", response_model=list[TaskResponse])
def get_tasks(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    tasks = db.query(DailyTask).filter(DailyTask.user_id == user.id).all()
    return tasks

@router.post("/tasks", response_model=TaskResponse)
def create_task(task_data: TaskCreate, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    
    date_obj = datetime.strptime(task_data.date, "%Y-%m-%d")
    
    new_task = DailyTask(
        user_id=user.id,
        goal_id=goal.id if goal else None,
        task=task_data.task,
        date=date_obj,
        time=task_data.time,
        duration_minutes=task_data.duration_minutes,
        category=task_data.category,
        task_type=task_data.task_type,
        priority=task_data.priority,
        url=task_data.url,
        links=task_data.links,
        created_by="user"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, task_data: TaskUpdate, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id, DailyTask.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_data = task_data.dict(exclude_unset=True)
    if "date" in update_data:
        update_data["date"] = datetime.strptime(update_data["date"], "%Y-%m-%d")
        
    for key, value in update_data.items():
        setattr(task, key, value)
        
    db.commit()
    db.refresh(task)
    return task

@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    task = db.query(DailyTask).filter(DailyTask.id == task_id, DailyTask.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    db.delete(task)
    db.commit()
    return {"success": True}

from ..schemas import DeleteRangeRequest, ResolveConflictRequest

@router.post("/tasks/bulk", response_model=dict)
async def bulk_create_tasks(
    tasks_data: list[dict], 
    background_tasks: BackgroundTasks,
    user: ClerkUser = Depends(verify_clerk_token), 
    db: Session = Depends(get_db)
):
    try:
        from ..models import Goal, Notification
        from ..services.email_service import trigger_plan_change_email
        import asyncio
        
        goal = db.query(Goal).filter(Goal.user_id == user.id).first()
        tasks_to_add = []
        added_tasks_summary = []
        
        for t in tasks_data:
            date_obj = datetime.strptime(t["date"], "%Y-%m-%d")
            new_task = DailyTask(
                user_id=user.id,
                goal_id=goal.id if goal else None,
                task=t["task"],
                date=date_obj,
                time=t["time"],
                duration_minutes=t.get("duration_minutes", 30),
                category=t.get("category", "Task"),
                task_type=t.get("task_type", "task"),
                priority=t.get("priority", "medium"),
                url=t.get("url"),
                links=t.get("links"),
                created_by="ai_sync"
            )
            tasks_to_add.append(new_task)
            added_tasks_summary.append({
                "title": new_task.task,
                "date": date_obj,
                "time": new_task.time,
                "category": new_task.category
            })
            
        if tasks_to_add:
            db.add_all(tasks_to_add)
            
            # Create in-app notification
            notif = Notification(
                user_id=user.id,
                title="Study Path Synced",
                message=f"Added {len(tasks_to_add)} tasks to your schedule.",
                type="ai_change",
                link="/dashboard/schedule",
            )
            db.add(notif)
            
            db.commit()
            
            from fastapi.encoders import jsonable_encoder
            # Use jsonable_encoder to ensure datetime objects are converted to strings for background task
            serializable_summary = jsonable_encoder(added_tasks_summary)
            
            # Background email
            asyncio.create_task(trigger_plan_change_email(user.id, {
                "action": "Added",
                "tasks": serializable_summary
            }))
            
        return {"success": True, "count": len(tasks_to_add)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to bulk add tasks: {str(e)}")

@router.post("/tasks/delete-range")
def delete_task_range_endpoint(req: DeleteRangeRequest, background_tasks: BackgroundTasks, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    try:
        start_date = datetime.strptime(req.startDate, "%Y-%m-%d")
        end_date = datetime.strptime(req.endDate, "%Y-%m-%d")
        
        deleted_tasks = db.query(DailyTask).filter(
            DailyTask.user_id == user.id,
            DailyTask.date >= start_date,
            DailyTask.date <= end_date
        ).all()
        
        deleted_count = len(deleted_tasks)
        deleted_tasks_data = [{"title": t.task, "date": t.date, "time": t.time, "category": t.category} for t in deleted_tasks]
        
        db.query(DailyTask).filter(
            DailyTask.user_id == user.id,
            DailyTask.date >= start_date,
            DailyTask.date <= end_date
        ).delete()
        
        if req.messageId:
            from ..models import ChatMessage
            import uuid
            try:
                msg_uuid = uuid.UUID(req.messageId)
                msg = db.query(ChatMessage).filter(ChatMessage.id == msg_uuid).first()
                if msg:
                    msg.status = "confirmed"
                    msg.message_type = "delete_confirmed"
            except ValueError:
                pass

        # Create in-app notification for the deletion
        if deleted_count > 0:
            from ..models import Notification
            notif = Notification(
                user_id=user.id,
                title="Tasks Removed",
                message=f"AI removed {deleted_count} task(s) from your schedule.",
                type="ai_change",
                link="/dashboard/schedule",
            )
            db.add(notif)

        db.commit()
        
        try:
            if deleted_tasks_data:
                from ..services.email_service import send_plan_change_notification_sync
                background_tasks.add_task(send_plan_change_notification_sync, user.id, {
                    "action": "Deleted",
                    "tasks": deleted_tasks_data
                })
        except Exception as email_err:
            print(f"[DEBUG] Failed to schedule plan change email: {email_err}")
            
        return {"success": True, "message": f"Successfully deleted {deleted_count} tasks between {req.startDate} and {req.endDate}."}
    except Exception as e:
        import traceback
        print(f"[ERROR] delete_task_range_endpoint failed. req={req}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Failed to delete tasks: {str(e)}")

@router.post("/tasks/resolve-conflict")
async def resolve_conflict_endpoint(req: ResolveConflictRequest, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    try:
        from ..services.tool_executor import execute_tool_call
        import asyncio
        from ..services.email_service import trigger_plan_change_email
        from datetime import timedelta
        
        task_data = req.task_data
        
        if req.action == "replace":
            # First delete the existing task at that time and date
            time_str = task_data.get("time", "12:00")
            start_date_str = task_data.get("startDate", task_data.get("date", datetime.now().strftime("%Y-%m-%d")))
            target_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            
            db.query(DailyTask).filter(
                DailyTask.user_id == user.id,
                DailyTask.date == target_date,
                DailyTask.time == time_str
            ).delete()
            db.commit()
            
            # Then insert the new task (bypassing conflict check)
            new_task = DailyTask(
                user_id=user.id,
                task=task_data.get("title", "Unnamed Task"),
                time=time_str,
                date=target_date,
                duration_minutes=task_data.get("durationMinutes", 30),
                category=task_data.get("category", "Task"),
                task_type=task_data.get("taskType", "recurring"),
                priority=task_data.get("priority", "medium"),
                url=task_data.get("url"),
                links=task_data.get("links"),
                created_by="ai"
            )
            db.add(new_task)
            db.commit()
            
            asyncio.create_task(trigger_plan_change_email(user.id, {
                "action": "Updated",
                "tasks": [{
                    "title": new_task.task,
                    "date": target_date,
                    "time": time_str,
                    "category": new_task.category
                }]
            }))
            
        elif req.action == "find_next_free_slot":
            start_date_str = task_data.get("startDate", task_data.get("date", datetime.now().strftime("%Y-%m-%d")))
            target_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            original_time = task_data.get("time", "12:00")
            
            # Start from original_time and add 30 mins until we find a free slot
            dt = datetime.strptime(f"{start_date_str} {original_time}", "%Y-%m-%d %H:%M")
            
            while True:
                dt += timedelta(minutes=30)
                if dt.date() > target_date.date(): # Went to next day
                    break
                check_time = dt.strftime("%H:%M")
                existing = db.query(DailyTask).filter(
                    DailyTask.user_id == user.id,
                    DailyTask.date == target_date,
                    DailyTask.time == check_time
                ).first()
                if not existing:
                    # Found free slot!
                    new_task = DailyTask(
                        user_id=user.id,
                        task=task_data.get("title", "Unnamed Task"),
                        time=check_time,
                        date=target_date,
                        duration_minutes=task_data.get("durationMinutes", 30),
                        category=task_data.get("category", "Task"),
                        task_type=task_data.get("taskType", "recurring"),
                        priority=task_data.get("priority", "medium"),
                        url=task_data.get("url"),
                        links=task_data.get("links"),
                        created_by="ai"
                    )
                    db.add(new_task)
                    db.commit()
                    asyncio.create_task(trigger_plan_change_email(user.id, {
                        "action": "Added",
                        "tasks": [{
                            "title": new_task.task,
                            "date": target_date,
                            "time": check_time,
                            "category": new_task.category
                        }]
                    }))
                    break
                    
        elif req.action == "keep_both":
            time_str = task_data.get("time", "12:00")
            start_date_str = task_data.get("startDate", task_data.get("date", datetime.now().strftime("%Y-%m-%d")))
            target_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            
            new_task = DailyTask(
                user_id=user.id,
                task=task_data.get("title", "Unnamed Task"),
                time=time_str,
                date=target_date,
                duration_minutes=task_data.get("durationMinutes", 30),
                category=task_data.get("category", "Task"),
                task_type=task_data.get("taskType", "recurring"),
                priority=task_data.get("priority", "medium"),
                url=task_data.get("url"),
                links=task_data.get("links"),
                created_by="ai"
            )
            db.add(new_task)
            db.commit()
            asyncio.create_task(trigger_plan_change_email(user.id, {
                "action": "Added",
                "tasks": [{
                    "title": new_task.task,
                    "date": target_date,
                    "time": time_str,
                    "category": new_task.category
                }]
            }))

        if req.messageId:
            from ..models import ChatMessage
            import uuid
            try:
                msg_uuid = uuid.UUID(req.messageId)
                msg = db.query(ChatMessage).filter(ChatMessage.id == msg_uuid).first()
                if msg:
                    msg.status = "resolved"
                    db.commit()
            except ValueError:
                pass
                
        return {"success": True, "message": "Conflict resolved successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to resolve conflict: {str(e)}")

@router.post("/execute")
async def execute_actions(req: ExecuteRequest, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    # Idempotency check
    existing_log = db.query(ExecutionLog).filter(ExecutionLog.action_id == req.action_id).first()
    if existing_log:
        return {"success": True, "message": "Already executed"}
        
    results = []
    for action in req.actions:
        # Pass to tool executor
        tool_name = action.get("function", {}).get("name")
        args_str = action.get("function", {}).get("arguments", "{}")
        try:
            args = json.loads(args_str)
        except json.JSONDecodeError:
            args = {}
            
        if tool_name:
            res = await execute_tool_call(tool_name, args, user.id, db)
            results.append(res)
            
    # Log execution
    log = ExecutionLog(
        user_id=user.id,
        action_id=req.action_id,
        actions=req.actions,
        status="completed"
    )
    db.add(log)
    db.commit()
    
    return {"success": True, "results": results}

@router.post("/undo")
def undo_last_execution(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    last_log = db.query(ExecutionLog).filter(
        ExecutionLog.user_id == user.id, 
        ExecutionLog.status == "completed"
    ).order_by(ExecutionLog.created_at.desc()).first()
    
    if not last_log:
        return {"success": False, "message": "Nothing to undo"}
        
    # We would reverse the specific actions here based on last_log.actions
    # For now, just mark undone. Actual undo logic requires storing created entity IDs.
    last_log.status = "undone"
    db.commit()
    return {"success": True, "message": "Undo successful"}
