from sqlalchemy.orm import Session
from ..models import DailyTask, UserConversationState, Notification
from datetime import datetime, timedelta
import json

def create_notification(user_id: str, title: str, message: str, notif_type: str, link: str, db: Session):
    """Helper to insert a notification row safely."""
    try:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notif_type,
            link=link,
        )
        db.add(notif)
        # do NOT commit here — caller manages the transaction
    except Exception as e:
        print(f"[Notif] Failed to queue notification: {e}")

async def execute_tool_call(tool_name: str, tool_args: dict, user_id: str, db: Session) -> dict:
    if tool_name == "execute_planner_plan":
        return await handle_execute_planner_plan(user_id, tool_args, db)
    elif tool_name == "execute_task_range":
        return await handle_execute_task_range(user_id, tool_args, db)
    elif tool_name == "delete_task_range":
        return await handle_delete_task_range(user_id, tool_args, db)
    elif tool_name == "web_search":
        from .search_service import SearchService
        search_service = SearchService()
        results = await search_service.search(tool_args.get("query", ""))
        return {"success": True, "results": results}
    elif tool_name == "display_study_resources":
        return {"success": True, "data": tool_args}
    return {"success": False, "message": f"Unknown or unimplemented tool: {tool_name}"}

async def handle_execute_planner_plan(user_id: str, tool_args: dict, db: Session) -> dict:
    try:
        print(f"[DEBUG] handle_execute_planner_plan called with args: {tool_args}")
        tasks = tool_args.get("tasks", [])
        print(f"[DEBUG] Found {len(tasks)} tasks in plan")
        tasks_created = 0
        added_tasks_data = []
        tasks_to_add = []
        
        for task_data in tasks:
            print(f"[DEBUG] Processing task: {task_data}")
            try:
                start_date_str = task_data.get("startDate", task_data.get("date"))
                end_date_str = task_data.get("endDate", start_date_str)
                
                if not start_date_str:
                    start_date_str = datetime.now().strftime("%Y-%m-%d")
                    end_date_str = start_date_str
                    
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                
                # Ensure end_date is not before start_date
                if end_date < start_date:
                    end_date = start_date
                    
            except Exception as d_err:
                print(f"[DEBUG] Date parse error for '{task_data}': {d_err}. Falling back to today.")
                start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                end_date = start_date
                
            current_date = start_date
            while current_date <= end_date:
                new_task = DailyTask(
                    user_id=user_id,
                    task=task_data.get("title", "Unnamed Task"),
                    time=task_data.get("time", "12:00"),
                    date=current_date,
                    duration_minutes=int(task_data.get("durationMinutes", 30)) if task_data.get("durationMinutes") else 30,
                    category=task_data.get("category", "Goal"),
                    task_type=task_data.get("taskType", "task"),
                    priority=task_data.get("priority", "medium"),
                    url=task_data.get("url"),
                    links=task_data.get("links"),
                    created_by="ai"
                )
                tasks_to_add.append(new_task)
                tasks_created += 1
                added_tasks_data.append({
                    "title": new_task.task,
                    "date": current_date,
                    "time": new_task.time,
                    "category": new_task.category
                })
                current_date += timedelta(days=1)
            
        if tasks_to_add:
            db.add_all(tasks_to_add)
            
        # Queue in-app notification before commit
        create_notification(
            user_id=user_id,
            title="Plan Updated",
            message=f"Your AI added {tasks_created} task(s) to your schedule.",
            notif_type="ai_change",
            link="/dashboard/schedule",
            db=db
        )

        # Committing tasks
        db.commit()
        return {"success": True, "message": f"Successfully scheduled {tasks_created} tasks for your plan."}
    except Exception as e:
        db.rollback()
        print(f"[ERROR] handle_execute_planner_plan failed: {e}")
        return {"success": False, "message": f"Failed to save plan tasks: {str(e)}"}

async def handle_execute_task_range(user_id: str, tool_args: dict, db: Session) -> dict:
    try:
        print(f"[DEBUG] handle_execute_task_range called with args: {tool_args}")
        tasks = tool_args.get("tasks", [])
        print(f"[DEBUG] Found {len(tasks)} tasks in range")
        tasks_created = 0
        added_tasks_data = []
        tasks_to_add = []
        
        chunks = [tasks[i:i + 10] for i in range(0, len(tasks), 10)]
        for chunk in chunks:
            for task_data in chunk:
                print(f"[DEBUG] Processing task: {task_data}")
                try:
                    start_date_str = task_data.get("startDate", task_data.get("date"))
                    end_date_str = task_data.get("endDate", start_date_str)
                    
                    if not start_date_str:
                        start_date_str = datetime.now().strftime("%Y-%m-%d")
                        end_date_str = start_date_str
                        
                    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                    
                    # Ensure end_date is not before start_date
                    if end_date < start_date:
                        end_date = start_date
                        
                except Exception as d_err:
                    print(f"[DEBUG] Date parse error for '{task_data}': {d_err}. Falling back to today.")
                    start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                    end_date = start_date
                    
                time_str = task_data.get("time", "12:00")
                
                # Conflict detection
                current_date = start_date
                while current_date <= end_date:
                    existing_task = db.query(DailyTask).filter(
                        DailyTask.user_id == user_id,
                        DailyTask.date == current_date,
                        DailyTask.time == time_str
                    ).first()
                    if existing_task:
                        print(f"[DEBUG] Conflict detected with {existing_task.task} on {current_date} at {time_str}")
                        return {
                            "success": False,
                            "type": "conflict",
                            "existing_task": existing_task.task,
                            "requested_task": task_data.get("title", "Unnamed Task"),
                            "time": time_str,
                            "date": str(current_date),
                            "task_data": task_data,
                            "message": "Time conflict detected"
                        }
                    current_date += timedelta(days=1)
                    
                current_date = start_date
                while current_date <= end_date:
                    new_task = DailyTask(
                        user_id=user_id,
                        task=task_data.get("title", "Unnamed Task"),
                        time=task_data.get("time", "12:00"),
                        date=current_date,
                        duration_minutes=int(task_data.get("durationMinutes", 30)) if task_data.get("durationMinutes") else 30,
                        category=task_data.get("category", "Task"),
                        task_type=task_data.get("taskType", "recurring"),
                        priority=task_data.get("priority", "medium"),
                        url=task_data.get("url"),
                        links=task_data.get("links"),
                        created_by="ai"
                    )
                    tasks_to_add.append(new_task)
                    tasks_created += 1
                    added_tasks_data.append({
                        "title": new_task.task,
                        "date": current_date,
                        "time": new_task.time,
                        "category": new_task.category
                    })
                    current_date += timedelta(days=1)
                
        if tasks_to_add:
            db.add_all(tasks_to_add)
                
        # Queue in-app notification before commit
        create_notification(
            user_id=user_id,
            title="Tasks Scheduled",
            message=f"Your AI added {tasks_created} recurring task(s) to your schedule.",
            notif_type="ai_change",
            link="/dashboard/schedule",
            db=db
        )

        # Committing tasks
        db.commit()
        return {"success": True, "message": f"Successfully scheduled {tasks_created} tasks."}
    except Exception as e:
        db.rollback()
        print(f"[ERROR] handle_execute_task_range failed: {e}")
        return {"success": False, "message": f"Failed to save recurring tasks: {str(e)}"}

async def handle_delete_task_range(user_id: str, tool_args: dict, db: Session) -> dict:
    try:
        start_date_str = tool_args.get("startDate")
        end_date_str = tool_args.get("endDate")
        
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        
        # Count how many tasks WOULD be deleted
        count = db.query(DailyTask).filter(
            DailyTask.user_id == user_id,
            DailyTask.date >= start_date,
            DailyTask.date <= end_date
        ).count()
        
        return {
            "success": True, 
            "message": f"Found {count} tasks to delete. Awaiting user confirmation to delete tasks between {start_date_str} and {end_date_str}.",
            "pending_confirmation": True,
            "task_count": count
        }
    except Exception as e:
        return {"success": False, "message": f"Failed to prepare deletion: {str(e)}"}

async def update_conversation_phase(user_id: str, phase: str, db: Session):
    state = db.query(UserConversationState).filter(UserConversationState.user_id == user_id).first()
    if state:
        state.phase = phase
        db.commit()
