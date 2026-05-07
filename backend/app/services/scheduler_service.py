from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta
import pytz
import httpx
from ..database import SessionLocal
from ..models import User, DailyTask, Notification, WeeklyReport, SubTask
from .email_service import send_morning_briefing, send_evening_report, send_event_reminder
import os
import json
from groq import Groq
from datetime import date

scheduler = AsyncIOScheduler()

def check_time_based_emails():
    """Runs every minute to check if any user's local time matches their preferred email time."""
    db = SessionLocal()
    try:
        current_utc = datetime.now(pytz.utc)
        users = db.query(User).filter(User.email_notifications_enabled == True).all()
        
        for user in users:
            try:
                user_tz = pytz.timezone(user.timezone or "Asia/Kolkata")
                local_time = current_utc.astimezone(user_tz)
                local_time_str = local_time.strftime("%H:%M")
                
                # Check Morning Briefing
                if user.email_morning_enabled and local_time_str == (user.morning_email_time or "06:00"):
                    send_morning_briefing(user.id, db)
                    
                # Check Evening Report
                if user.email_evening_enabled and local_time_str == (user.evening_email_time or "22:00"):
                    send_evening_report(user.id, db)
            except Exception as e:
                print(f"[Scheduler] Error processing user {user.id} for time-based emails: {e}")
                
    finally:
        db.close()

def check_event_reminders():
    """Runs every 15 minutes to check for upcoming important tasks in the next 3 hours."""
    db = SessionLocal()
    try:
        current_utc = datetime.now(pytz.utc)
        users = db.query(User).filter(User.email_notifications_enabled == True, User.email_events_enabled == True).all()
        
        for user in users:
            try:
                user_tz = pytz.timezone(user.timezone or "Asia/Kolkata")
                local_now = current_utc.astimezone(user_tz)
                local_date = local_now.date()
                
                # We need to find tasks for today that are within the next 3 hours
                tasks = db.query(DailyTask).filter(
                    DailyTask.user_id == user.id,
                    DailyTask.date == local_date,
                    DailyTask.reminder_sent == False,
                    DailyTask.completed == False
                ).all()
                
                for task in tasks:
                    # Parse task time
                    try:
                        task_time_obj = datetime.strptime(task.time, "%H:%M").time()
                        task_datetime = user_tz.localize(datetime.combine(local_date, task_time_obj))
                        
                        time_diff = task_datetime - local_now
                        
                        # If task is within the next 3 hours (and strictly in the future)
                        if timedelta(minutes=0) < time_diff <= timedelta(hours=3):
                            is_important = task.priority.lower() == "high" or task.category.lower() in ["flight", "exam", "meeting", "train", "appointment"]
                            if is_important:
                                send_event_reminder(user.id, task, db)
                                task.reminder_sent = True
                                db.commit()
                    except Exception as task_err:
                        print(f"[Scheduler] Error processing task {task.id}: {task_err}")
            except Exception as e:
                print(f"[Scheduler] Error processing user {user.id} for reminders: {e}")
    finally:
        db.close()


def create_upcoming_event_notifications():
    """8 AM job — create in-app notifications for today's tasks scheduled in the next 8 hours."""
    db = SessionLocal()
    try:
        current_utc = datetime.now(pytz.utc)
        users = db.query(User).all()

        for user in users:
            try:
                user_tz = pytz.timezone(user.timezone or "Asia/Kolkata")
                local_now = current_utc.astimezone(user_tz)
                local_date = local_now.date()

                tasks = db.query(DailyTask).filter(
                    DailyTask.user_id == user.id,
                    DailyTask.date == local_date,
                    DailyTask.completed == False
                ).order_by(DailyTask.time).limit(5).all()

                for task in tasks:
                    try:
                        task_time_obj = datetime.strptime(task.time, "%H:%M").time()
                        task_dt = user_tz.localize(datetime.combine(local_date, task_time_obj))
                        diff = task_dt - local_now
                        if timedelta(0) < diff <= timedelta(hours=8):
                            notif = Notification(
                                user_id=user.id,
                                title="Upcoming Task",
                                message=f"{task.task} at {task.time}",
                                type="upcoming_event",
                                link="/dashboard/schedule",
                            )
                            db.add(notif)
                    except Exception as te:
                        print(f"[Scheduler] Upcoming notif error for task {task.id}: {te}")

                db.commit()
            except Exception as e:
                print(f"[Scheduler] Upcoming events error for user {user.id}: {e}")
                db.rollback()
    finally:
        db.close()


def create_missed_task_notifications():
    """11 PM job — create in-app notifications for tasks that were not completed today."""
    db = SessionLocal()
    try:
        current_utc = datetime.now(pytz.utc)
        users = db.query(User).all()

        for user in users:
            try:
                user_tz = pytz.timezone(user.timezone or "Asia/Kolkata")
                local_now = current_utc.astimezone(user_tz)
                local_date = local_now.date()

                missed_tasks = db.query(DailyTask).filter(
                    DailyTask.user_id == user.id,
                    DailyTask.date == local_date,
                    DailyTask.completed == False,
                ).count()

                if missed_tasks > 0:
                    notif = Notification(
                        user_id=user.id,
                        title="Missed Tasks Today",
                        message=f"You missed {missed_tasks} task(s) today. Check your schedule to reschedule.",
                        type="missed_task",
                        link="/dashboard/schedule",
                    )
                    db.add(notif)
                    db.commit()
            except Exception as e:
                print(f"[Scheduler] Missed tasks error for user {user.id}: {e}")
                db.rollback()
    finally:
        db.close()


def check_streak_milestones():
    """Daily job — check for streak milestones (3, 7, 14, 30 consecutive days with tasks completed)."""
    db = SessionLocal()
    try:
        current_utc = datetime.now(pytz.utc)
        users = db.query(User).all()
        MILESTONES = [3, 7, 14, 30]

        for user in users:
            try:
                user_tz = pytz.timezone(user.timezone or "Asia/Kolkata")
                local_today = current_utc.astimezone(user_tz).date()

                streak = 0
                check_date = local_today - timedelta(days=1)  # start from yesterday
                while True:
                    tasks_that_day = db.query(DailyTask).filter(
                        DailyTask.user_id == user.id,
                        DailyTask.date == check_date
                    ).all()
                    total = len(tasks_that_day)
                    completed = sum(1 for t in tasks_that_day if t.completed)
                    if total == 0 or completed == 0:
                        break
                    streak += 1
                    check_date -= timedelta(days=1)
                    if streak >= max(MILESTONES):
                        break

                if streak in MILESTONES:
                    notif = Notification(
                        user_id=user.id,
                        title=f"🔥 {streak}-Day Streak!",
                        message=f"Amazing! You've completed tasks for {streak} days in a row. Keep it up!",
                        type="streak_milestone",
                        link="/dashboard",
                    )
                    db.add(notif)
                    db.commit()
            except Exception as e:
                print(f"[Scheduler] Streak check error for user {user.id}: {e}")
                db.rollback()
    finally:
        db.close()


async def keep_alive():
    try:
        backend_url = os.getenv("RENDER_EXTERNAL_URL", "https://planora-backend-z7lx.onrender.com")
        async with httpx.AsyncClient(timeout=10) as client:
            await client.get(f"{backend_url}/health")
    except:
        pass


def generate_weekly_reports():
    """Sunday 8 AM — generate WeeklyReport for every user and send email."""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        from .report_service import get_or_create_report
        from .email_service import send_weekly_report

        for user in users:
            try:
                report = get_or_create_report(user.id, db)
                if report:
                    send_weekly_report(user.id, db)
                    # Also create an in-app notification
                    notif = Notification(
                        user_id=user.id,
                        title="📊 Weekly Report Ready",
                        message=f"Your week: {report.completion_rate}% completion rate. Tap to view.",
                        type="goal_update",
                        link="/dashboard/progress",
                    )
                    db.add(notif)
                    db.commit()
            except Exception as e:
                print(f"[Scheduler] Weekly report error for user {user.id}: {e}")
                db.rollback()
    finally:
        db.close()

async def nightly_analysis():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        today = date.today()
        tomorrow = today + timedelta(days=1)
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

        for user in users:
            try:
                # Get today's tasks
                todays_tasks = db.query(DailyTask).filter(
                    DailyTask.user_id == user.id,
                    DailyTask.date == today
                ).all()

                if not todays_tasks:
                    continue

                completed = [t for t in todays_tasks if t.completed]
                missed = [t for t in todays_tasks if not t.completed]
                completion_rate = len(completed) / len(todays_tasks) if todays_tasks else 0

                # Get tomorrow's tasks
                tomorrow_tasks = db.query(DailyTask).filter(
                    DailyTask.user_id == user.id,
                    DailyTask.date == tomorrow
                ).all()

                # If completion < 70% and missed tasks exist, ask AI to analyze
                if completion_rate < 0.7 and missed and tomorrow_tasks:
                    missed_summary = ", ".join([t.task for t in missed])
                    tomorrow_summary = ", ".join([t.task for t in tomorrow_tasks])

                    prompt = f"""
                    User completed {len(completed)}/{len(todays_tasks)} tasks today.
                    Missed: {missed_summary}
                    Tomorrow's current plan: {tomorrow_summary}
                    
                    Should tomorrow's plan be modified? 
                    Reply with JSON only:
                    {{
                        "modify": true,
                        "reason": "brief reason",
                        "suggestion": "one sentence suggestion for user"
                    }}
                    """

                    chat_completion = groq_client.chat.completions.create(
                        messages=[{"role": "user", "content": prompt}],
                        model="llama-3.3-70b-versatile",
                        max_tokens=150,
                        response_format={"type": "json_object"}
                    )
                    
                    result = json.loads(chat_completion.choices[0].message.content)
                    
                    if result.get("modify"):
                        notification = Notification(
                            user_id=user.id,
                            title="📊 Tonight's Plan Analysis",
                            message=f"You completed {len(completed)}/{len(todays_tasks)} tasks. {result['suggestion']}",
                            type="ai_change",
                            link="/dashboard"
                        )
                        db.add(notification)

                # Redistribute missed subtasks
                for task in missed:
                    subtasks = db.query(SubTask).filter(
                        SubTask.task_id == task.id,
                        SubTask.completed == False
                    ).all()

                    if subtasks:
                        # Find future tasks same category
                        future_tasks = db.query(DailyTask).filter(
                            DailyTask.user_id == user.id,
                            DailyTask.date > today,
                            DailyTask.category == task.category
                        ).order_by(DailyTask.date).limit(3).all()

                        if future_tasks:
                            missed_mins = sum(s.duration_minutes for s in subtasks)
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
            except Exception as user_err:
                print(f"[Scheduler] Nightly analysis error for user {user.id}: {user_err}")
                db.rollback()
    finally:
        db.close()

def start_scheduler():
    if not scheduler.running:
        # Check every minute for exact time matches
        scheduler.add_job(check_time_based_emails, CronTrigger(minute="*"))
        
        # Check every 15 minutes for upcoming events
        scheduler.add_job(check_event_reminders, IntervalTrigger(minutes=15))
        
        # 8 AM job — upcoming event in-app notifications
        scheduler.add_job(create_upcoming_event_notifications, CronTrigger(hour=8, minute=0))

        # 11 PM job — missed task in-app notifications
        scheduler.add_job(create_missed_task_notifications, CronTrigger(hour=23, minute=0))

        # Daily streak milestone check at midnight
        scheduler.add_job(check_streak_milestones, CronTrigger(hour=0, minute=5))

        # Keep-alive ping every 8 minutes to prevent cold start
        scheduler.add_job(keep_alive, IntervalTrigger(minutes=8))

        # Sunday 8 AM — weekly progress report + email
        scheduler.add_job(generate_weekly_reports, CronTrigger(day_of_week="sun", hour=8, minute=0))
        
        # 11:55 PM job — nightly plan analysis
        scheduler.add_job(nightly_analysis, CronTrigger(hour=23, minute=55))
        
        scheduler.start()
        print("[Scheduler] APScheduler started.")

def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("[Scheduler] APScheduler stopped.")
