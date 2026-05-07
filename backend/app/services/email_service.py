import os
import resend
import base64
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from ..models import User, DailyTask

# Initialize Resend
resend.api_key = os.getenv("RESEND_API_KEY", "")

# We use a placeholder "from" email. In production, this should be a verified domain.
FROM_EMAIL = "Planora AI <onboarding@resend.dev>"

def generate_unsubscribe_link(user_id: str) -> str:
    # Basic token generation: base64 encoded user_id
    token = base64.b64encode(user_id.encode('utf-8')).decode('utf-8')
    base_url = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:8000")
    # In a real app, you might want a frontend route that hits the backend, 
    # but hitting the backend directly is fine for this requirement.
    return f"{base_url}/api/users/unsubscribe?token={token}"

def get_base_html_template(title: str, content: str, user_id: str) -> str:
    unsubscribe_url = generate_unsubscribe_link(user_id)
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #050505; color: #f0f0ff; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }}
            .wrapper {{ width: 100%; table-layout: fixed; background-color: #050505; padding-top: 40px; padding-bottom: 40px; }}
            .container {{ max-width: 600px; width: 100%; margin: 0 auto; background-color: #111118; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a35; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }}
            .header {{ background: linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%); padding: 32px 24px; text-align: center; }}
            .header h1 {{ margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }}
            .content {{ padding: 32px; line-height: 1.6; color: #d0d0e0; }}
            .content h2 {{ color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 24px; }}
            .task-list {{ list-style: none; padding: 0; margin: 0; }}
            .task-item {{ background-color: #1a1a24; border: 1px solid #2a2a35; border-radius: 12px; padding: 16px; margin-bottom: 12px; display: flex; flex-direction: column; }}
            .task-time {{ font-size: 14px; font-weight: 700; color: #a78bfa; margin-bottom: 4px; }}
            .task-title {{ font-size: 18px; font-weight: 600; color: #ffffff; line-height: 1.4; }}
            .task-category {{ display: inline-block; font-size: 11px; color: #e2e8f0; background-color: #7c3aed; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 12px; align-self: flex-start; font-weight: bold; }}
            .status-completed {{ color: #10b981; font-weight: bold; font-size: 14px; margin-top: 8px; }}
            .status-missed {{ color: #ef4444; font-weight: bold; font-size: 14px; margin-top: 8px; }}
            .footer {{ padding: 24px; text-align: center; border-top: 1px solid #2a2a35; font-size: 13px; color: #8888aa; background-color: #0a0a0f; }}
            .footer a {{ color: #a78bfa; text-decoration: none; font-weight: 500; }}
            .important-box {{ background-color: #fffbeb; border: 1px solid #f59e0b; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 24px; }}
            .important-box h3 {{ margin: 0 0 8px 0; color: #b45309; font-size: 16px; }}
            .important-box p {{ margin: 0; color: #92400e; font-size: 14px; font-weight: 500; }}
            .streak-box {{ background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); padding: 16px; border-radius: 12px; text-align: center; margin-top: 32px; color: white; font-weight: bold; font-size: 18px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2); }}
            .progress-bar-bg {{ background-color: #2a2a35; height: 12px; border-radius: 6px; width: 100%; overflow: hidden; margin: 16px 0; }}
            .progress-bar-fill {{ background: linear-gradient(90deg, #10b981 0%, #34d399 100%); height: 100%; border-radius: 6px; transition: width 0.5s ease; }}
            .countdown {{ font-size: 48px; font-weight: 900; color: #f59e0b; text-align: center; margin: 24px 0; line-height: 1; }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                    <h1>Planora AI</h1>
                </div>
                <div class="content">
                    <h2>{title}</h2>
                    {content}
                </div>
                <div class="footer">
                    <p>This automated email was sent by your intelligent life planner.</p>
                    <p><a href="{unsubscribe_url}">Unsubscribe from all notifications</a></p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

def calculate_user_streak(user_id: str, db: Session) -> int:
    from sqlalchemy import func, cast, Date
    thirty_days_ago = datetime.now().date() - timedelta(days=30)
    
    # Group by the date part only to ensure multiple tasks in one day don't break grouping
    completed_days = db.query(cast(DailyTask.date, Date)).filter(
        DailyTask.user_id == user_id,
        DailyTask.date >= thirty_days_ago,
        DailyTask.completed == True
    ).group_by(cast(DailyTask.date, Date)).order_by(cast(DailyTask.date, Date).desc()).all()
    
    if not completed_days:
        return 0
        
    streak = 0
    current_check_date = datetime.now().date()
    
    # Convert list of tuples to list of date objects
    dates = [d[0] for d in completed_days if d[0]]
    
    # Check if they completed anything today, if not, check yesterday
    if current_check_date not in dates:
        current_check_date -= timedelta(days=1)
        if current_check_date not in dates:
            return 0 # Streak broken
            
    for d in dates:
        if d == current_check_date:
            streak += 1
            current_check_date -= timedelta(days=1)
        elif d < current_check_date:
            break
            
    return streak

def send_morning_briefing(user_id: str, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email_notifications_enabled or not user.email_morning_enabled:
        return
        
    today = datetime.now().date()
    tasks = db.query(DailyTask).filter(DailyTask.user_id == user_id, DailyTask.date == today).order_by(DailyTask.time.asc()).all()
    
    if not tasks:
        content = "<p style='font-size: 16px;'>Your schedule for today is completely clear. Enjoy your free day or ask Planora to generate a new plan for you!</p>"
    else:
        important_tasks = [t for t in tasks if t.priority.lower() == "high" or t.category.lower() in ["flight", "exam", "meeting", "train", "appointment"]]
        
        content = f"<p style='font-size: 16px; margin-bottom: 24px;'>Good morning{f' {user.name}' if user.name else ''}! Here is your execution plan for today.</p>"
        
        if important_tasks:
            content += f"""
            <div class='important-box'>
                <h3>⚠️ Important Events Today</h3>
                <ul style='padding-left: 20px; margin-bottom: 0;'>
                    {''.join([f"<li><p>{t.task} at {t.time}</p></li>" for t in important_tasks])}
                </ul>
            </div>
            """
            
        content += "<ul class='task-list'>"
        for t in tasks:
            is_important = t in important_tasks
            border_style = "border-left: 4px solid #f59e0b;" if is_important else "border-left: 4px solid #7c3aed;"
            
            content += f"""
            <li class='task-item' style='{border_style}'>
                <div class='task-time'>{t.time} • {t.duration_minutes} min</div>
                <div class='task-title'>{t.task}</div>
                <div><span class='task-category'>{t.category}</span></div>
            </li>
            """
        content += "</ul>"
        
        # Streak calculation
        streak = calculate_user_streak(user_id, db)
        if streak > 0:
            content += f"<div class='streak-box'>🔥 {streak} Day Streak — Keep it up!</div>"
        
    html = get_base_html_template(f"☀️ Your Planora Plan for {today.strftime('%A, %b %d')}", content, user_id)
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": user.email,
            "subject": f"☀️ Good Morning! Your Planora Plan for {today.strftime('%A, %b %d')}",
            "html": html
        })
    except Exception as e:
        print(f"[EmailService] Failed to send morning briefing to {user.email}: {e}")


def send_evening_report(user_id: str, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email_notifications_enabled or not user.email_evening_enabled:
        return
        
    today = datetime.now().date()
    tasks = db.query(DailyTask).filter(DailyTask.user_id == user_id, DailyTask.date == today).all()
    
    if not tasks:
        return 
        
    completed = [t for t in tasks if t.completed]
    missed = [t for t in tasks if not t.completed]
    completion_percentage = int((len(completed) / len(tasks)) * 100) if tasks else 0
    
    content = f"<p style='font-size: 16px;'>Good evening! Here is a summary of your execution today.</p>"
    
    content += f"""
    <div style="margin: 32px 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
            <span style="font-weight: bold; font-size: 18px; color: #ffffff;">Daily Completion</span>
            <span style="font-weight: bold; font-size: 24px; color: #10b981;">{completion_percentage}%</span>
        </div>
        <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: {completion_percentage}%;"></div>
        </div>
    </div>
    
    <div style="display: flex; gap: 16px; margin-bottom: 32px;">
        <div style="background-color: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2); flex: 1; text-align: center;">
            <div style="font-size: 32px; font-weight: 900; color: #10b981;">{len(completed)}</div>
            <div style="font-size: 12px; color: #10b981; text-transform: uppercase; font-weight: bold; margin-top: 4px; letter-spacing: 0.05em;">Completed</div>
        </div>
        <div style="background-color: rgba(239, 68, 68, 0.1); padding: 16px; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2); flex: 1; text-align: center;">
            <div style="font-size: 32px; font-weight: 900; color: #ef4444;">{len(missed)}</div>
            <div style="font-size: 12px; color: #ef4444; text-transform: uppercase; font-weight: bold; margin-top: 4px; letter-spacing: 0.05em;">Missed</div>
        </div>
    </div>
    """
    
    if completed:
        content += "<h3 style='color: #10b981; border-bottom: 1px solid #2a2a35; padding-bottom: 8px;'>✅ Completed Tasks</h3><ul class='task-list' style='margin-bottom: 24px;'>"
        for t in completed:
            content += f"<li class='task-item' style='padding: 12px; border-left: 4px solid #10b981;'><div class='task-title' style='text-decoration: line-through; color: #8888aa;'>{t.task}</div></li>"
        content += "</ul>"
        
    if missed:
        content += "<h3 style='color: #ef4444; border-bottom: 1px solid #2a2a35; padding-bottom: 8px;'>❌ Missed Tasks</h3><ul class='task-list' style='margin-bottom: 24px;'>"
        for t in missed:
            content += f"<li class='task-item' style='padding: 12px; border-left: 4px solid #ef4444;'><div class='task-title'>{t.task}</div><div class='status-missed'>To be redistributed</div></li>"
        content += "</ul>"
        
    # Tomorrow preview
    tomorrow = today + timedelta(days=1)
    tomorrow_tasks = db.query(DailyTask).filter(DailyTask.user_id == user_id, DailyTask.date == tomorrow).order_by(DailyTask.time.asc()).limit(3).all()
    
    if tomorrow_tasks:
        content += "<div style='background-color: #1a1a24; padding: 24px; border-radius: 12px; border: 1px solid #7c3aed; margin-top: 32px;'>"
        content += "<h3 style='margin-top: 0; color: #a78bfa; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em;'>Tomorrow's Top 3 Tasks</h3>"
        content += "<ul style='padding-left: 20px; color: #d0d0e0; margin-bottom: 0;'>"
        for t in tomorrow_tasks:
            content += f"<li style='margin-bottom: 8px;'><strong>{t.time}</strong> — {t.task}</li>"
        content += "</ul></div>"
        
    html = get_base_html_template("🌙 Your Daily Report", content, user_id)
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": user.email,
            "subject": f"🌙 Your Planora Daily Report — {today.strftime('%b %d')}",
            "html": html
        })
    except Exception as e:
        print(f"[EmailService] Failed to send evening report to {user.email}: {e}")


def send_event_reminder(user_id: str, task: DailyTask, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email_notifications_enabled or not user.email_events_enabled:
        return
        
    try:
        task_dt = datetime.strptime(f"{task.date.strftime('%Y-%m-%d')} {task.time}", "%Y-%m-%d %H:%M")
        hours_remaining = max(1, round((task_dt - datetime.now()).total_seconds() / 3600))
    except Exception:
        hours_remaining = 1
        
    content = f"""
    <div style="text-align: center; padding: 32px 0;">
        <p style="color: #a78bfa; text-transform: uppercase; font-weight: bold; letter-spacing: 0.1em; margin-bottom: 8px;">Upcoming Event</p>
        <div class="countdown">IN {hours_remaining} HOUR{'S' if hours_remaining > 1 else ''}</div>
    </div>
    
    <div style="background-color: #1a1a24; border-left: 4px solid #f59e0b; padding: 24px; border-radius: 12px; margin-top: 8px;">
        <h3 style="margin-top: 0; color: #ffffff; font-size: 24px;">{task.task}</h3>
        <table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #8888aa; width: 80px;">Date</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">{task.date.strftime('%A, %b %d, %Y')}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #8888aa;">Time</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600;">{task.time} ({task.duration_minutes} mins)</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #8888aa;">Category</td>
                <td style="padding: 8px 0;"><span style="background-color: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">{task.category}</span></td>
            </tr>
        </table>
    </div>
    """
    
    html = get_base_html_template("⏰ Reminder", content, user_id)
    
    try:
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": user.email,
            "subject": f"⏰ Reminder: {task.task} in {hours_remaining} hour{'s' if hours_remaining > 1 else ''}",
            "html": html
        })
    except Exception as e:
        print(f"[EmailService] Failed to send event reminder to {user.email}: {e}")


def send_plan_change_notification_sync(user_id: str, changes_data: Dict[str, Any]):
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.email_notifications_enabled or not user.email_plan_changes_enabled:
            return
            
        print(f"[EMAIL SERVICE] Sending plan change notification to: {user.email}")
        
        action = changes_data.get("action", "Updated")
        tasks = changes_data.get("tasks", [])
        
        action_color = "#10b981" if action == "Added" else "#ef4444" if action == "Deleted" else "#3b82f6"
        action_icon = "✨" if action == "Added" else "🗑️" if action == "Deleted" else "📝"
            
        content = f"""
        <p style='font-size: 16px;'>Planora AI has made updates to your schedule based on your recent request.</p>
        <div style="background-color: #1a1a24; padding: 24px; border-radius: 12px; border: 1px solid {action_color}; margin-top: 24px;">
            <h3 style="margin-top: 0; color: {action_color}; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 16px;">
                {action_icon} {action} {len(tasks)} Task{'s' if len(tasks) != 1 else ''}
            </h3>
            <ul class='task-list'>
        """
        
        for t in tasks:
            date_str = t.get("date", "Unknown Date")
            if isinstance(date_str, date) or isinstance(date_str, datetime):
                date_str = date_str.strftime('%A, %b %d')
            elif isinstance(date_str, str) and "-" in date_str:
                try:
                    date_str = datetime.strptime(date_str, "%Y-%m-%d").strftime('%A, %b %d')
                except:
                    pass
                    
            content += f"""
            <li class='task-item' style='border-left: 4px solid {action_color}; margin-bottom: 8px;'>
                <div style='display: flex; justify-content: space-between; align-items: flex-start;'>
                    <div>
                        <div class='task-title' style='{"text-decoration: line-through; color: #8888aa;" if action == "Deleted" else ""}'>{t.get('title', t.get('task', 'Unnamed Task'))}</div>
                        <div style='color: #8888aa; font-size: 13px; margin-top: 4px;'>{date_str} at {t.get('time', '')}</div>
                    </div>
                    <span class='task-category' style='margin-top: 0; background-color: rgba(255,255,255,0.1); color: #d0d0e0;'>{t.get('category', 'Task')}</span>
                </div>
            </li>
            """
            
        content += """
            </ul>
        </div>
        """
        
        html = get_base_html_template("📋 Schedule Updated", content, user_id)
        
        try:
            resend.Emails.send({
                "from": FROM_EMAIL,
                "to": user.email,
                "subject": f"Planora AI: Schedule Updated",
                "html": html
            })
        except Exception as e:
            print(f"[EmailService] Failed to send plan change notification to {user.email}: {e}")
    finally:
        db.close()

async def trigger_plan_change_email(user_id: str, changes_data: Dict[str, Any]):
    import asyncio
    await asyncio.to_thread(send_plan_change_notification_sync, user_id, changes_data)


def send_weekly_report(user_id: str, db: Session):
    """Generate and email the weekly progress report for a single user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.email_notifications_enabled:
        return

    from ..services.report_service import get_or_create_report
    report = get_or_create_report(user_id, db)
    if not report:
        print(f"[EmailService] Skipping weekly report for {user_id} — no tasks this week.")
        return

    rate      = report.completion_rate
    prev_rate = report.prev_completion_rate
    diff      = rate - prev_rate
    diff_str  = f"↑ +{diff}%" if diff > 0 else (f"↓ {diff}%" if diff < 0 else "→ 0%")
    diff_color = "#10b981" if diff >= 0 else "#ef4444"
    status_color = {"on_track": "#10b981", "at_risk": "#f59e0b", "behind": "#ef4444"}.get(report.on_track_status, "#8888aa")
    status_label = {"on_track": "✅ On Track", "at_risk": "⚠️ At Risk", "behind": "❌ Behind"}.get(report.on_track_status, "Unknown")

    bar_width = max(4, rate)  # minimum visible bar

    # Next-week preview
    from datetime import timedelta
    next_week_start = report.week_end + timedelta(seconds=1)
    next_week_end   = next_week_start + timedelta(days=6)
    next_tasks_count = db.query(DailyTask).filter(
        DailyTask.user_id == user_id,
        DailyTask.date >= next_week_start,
        DailyTask.date <= next_week_end,
    ).count()

    week_label = report.week_start.strftime("%b %d") + " – " + report.week_end.strftime("%b %d, %Y")

    content = f"""
    <p style="font-size:16px; margin-bottom:28px;">
        Here is your weekly performance summary{f" {user.name}," if user.name else ","} for the week of <strong>{week_label}</strong>.
    </p>

    <!-- Completion Rate Hero -->
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#4c1d95 100%);padding:32px;border-radius:16px;text-align:center;margin-bottom:28px;">
        <div style="font-size:13px;color:#c4b5fd;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:8px;">Weekly Completion Rate</div>
        <div style="font-size:72px;font-weight:900;color:#ffffff;line-height:1;">{rate}%</div>
        <div style="font-size:18px;font-weight:700;color:{diff_color};margin-top:8px;">{diff_str} vs last week</div>
        <div style="background:rgba(255,255,255,.15);border-radius:8px;height:10px;margin-top:20px;overflow:hidden;">
            <div style="background:#ffffff;width:{bar_width}%;height:100%;border-radius:8px;"></div>
        </div>
    </div>

    <!-- Stat Pills -->
    <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#1a1a24;border:1px solid #2a2a35;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#10b981;">{report.total_completed}</div>
            <div style="font-size:11px;color:#8888aa;text-transform:uppercase;font-weight:700;margin-top:4px;letter-spacing:.05em;">Completed</div>
        </div>
        <div style="flex:1;min-width:120px;background:#1a1a24;border:1px solid #2a2a35;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#f59e0b;">🔥 {report.streak}</div>
            <div style="font-size:11px;color:#8888aa;text-transform:uppercase;font-weight:700;margin-top:4px;letter-spacing:.05em;">Day Streak</div>
        </div>
        <div style="flex:1;min-width:120px;background:#1a1a24;border:1px solid {status_color};border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:16px;font-weight:900;color:{status_color};">{status_label}</div>
            <div style="font-size:11px;color:#8888aa;text-transform:uppercase;font-weight:700;margin-top:4px;letter-spacing:.05em;">Status</div>
        </div>
    </div>

    <!-- Category Breakdown -->
    <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap;">
        {f'''<div style="flex:1;min-width:140px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#10b981;text-transform:uppercase;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">🏆 Best Category</div>
            <div style="font-size:18px;font-weight:800;color:#ffffff;">{report.best_category}</div>
        </div>''' if report.best_category else ''}
        {f'''<div style="flex:1;min-width:140px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#ef4444;text-transform:uppercase;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">⚠️ Needs Attention</div>
            <div style="font-size:18px;font-weight:800;color:#ffffff;">{report.worst_category}</div>
        </div>''' if report.worst_category else ''}
    </div>

    <!-- AI Recommendation -->
    {f'''<div style="background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.35);border-left:4px solid #7c3aed;border-radius:12px;padding:20px;margin-bottom:28px;">
        <div style="font-size:12px;color:#a78bfa;text-transform:uppercase;font-weight:700;letter-spacing:.08em;margin-bottom:8px;">✨ AI Recommendation</div>
        <p style="margin:0;color:#e2d9f3;font-size:15px;line-height:1.6;">{report.ai_recommendation}</p>
    </div>''' if report.ai_recommendation else ''}

    <!-- Next Week Preview -->
    <div style="background:#1a1a24;border:1px solid #2a2a35;border-radius:12px;padding:20px;text-align:center;">
        <div style="font-size:12px;color:#8888aa;text-transform:uppercase;font-weight:700;letter-spacing:.08em;margin-bottom:6px;">Next Week Preview</div>
        <div style="font-size:32px;font-weight:900;color:#a78bfa;">{next_tasks_count}</div>
        <div style="font-size:14px;color:#8888aa;margin-top:2px;">tasks already scheduled</div>
    </div>
    """

    html = get_base_html_template(f"📊 Your Planora Weekly Report", content, user_id)
    subject = f"📊 Your Planora Weekly Report — Week of {week_label}"

    try:
        resend.Emails.send({"from": FROM_EMAIL, "to": user.email, "subject": subject, "html": html})
        print(f"[EmailService] Weekly report sent to {user.email}")
    except Exception as e:
        print(f"[EmailService] Failed to send weekly report to {user.email}: {e}")

