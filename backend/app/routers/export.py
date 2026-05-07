from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import csv
import io

from ..database import get_db
from ..auth import verify_clerk_token, ClerkUser
from ..models import DailyTask, User

router = APIRouter()

def generate_pdf(tasks, title, date_range_str, user_name):
    # Try WeasyPrint first
    try:
        from weasyprint import HTML, CSS
        
        # Build HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                @page {{
                    size: A4;
                    margin: 2cm;
                    @bottom-right {{
                        content: counter(page);
                        font-family: 'Inter', sans-serif;
                        font-size: 10pt;
                        color: #8888aa;
                    }}
                }}
                body {{
                    font-family: 'Inter', -apple-system, sans-serif;
                    color: #111118;
                    background-color: #ffffff;
                    margin: 0;
                    padding: 0;
                }}
                .header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #7c3aed;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }}
                .logo {{
                    font-size: 24pt;
                    font-weight: 800;
                    color: #7c3aed;
                    margin: 0;
                }}
                .logo span {{ color: #111118; }}
                .user-info {{
                    text-align: right;
                }}
                .user-info h2 {{
                    margin: 0;
                    font-size: 14pt;
                    color: #111118;
                }}
                .user-info p {{
                    margin: 5px 0 0 0;
                    font-size: 10pt;
                    color: #666;
                }}
                .summary {{
                    background-color: #f3e8ff;
                    border-radius: 8px;
                    padding: 15px 20px;
                    margin-bottom: 30px;
                    display: flex;
                    justify-content: space-between;
                }}
                .summary-item {{
                    text-align: center;
                }}
                .summary-value {{
                    font-size: 18pt;
                    font-weight: bold;
                    color: #7c3aed;
                }}
                .summary-label {{
                    font-size: 10pt;
                    color: #4b5563;
                    text-transform: uppercase;
                    margin-top: 4px;
                }}
                .date-section {{
                    margin-bottom: 30px;
                }}
                .date-header {{
                    font-size: 16pt;
                    font-weight: bold;
                    color: #111118;
                    border-bottom: 1px solid #e5e7eb;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                }}
                th, td {{
                    padding: 12px 10px;
                    text-align: left;
                    border-bottom: 1px solid #f3f4f6;
                }}
                th {{
                    font-size: 10pt;
                    color: #6b7280;
                    font-weight: 600;
                    text-transform: uppercase;
                }}
                td {{
                    font-size: 11pt;
                }}
                .time-col {{ width: 15%; font-weight: bold; color: #7c3aed; }}
                .task-col {{ width: 45%; font-weight: 500; }}
                .category-col {{ width: 20%; }}
                .status-col {{ width: 20%; text-align: right; }}
                .category-badge {{
                    display: inline-block;
                    background-color: #ede9fe;
                    color: #6d28d9;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 9pt;
                    font-weight: bold;
                    text-transform: uppercase;
                }}
                .important-row {{
                    background-color: #fffbeb;
                }}
                .completed-icon {{ color: #10b981; font-weight: bold; }}
                .pending-icon {{ color: #9ca3af; }}
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="logo">Planora<span>AI</span></h1>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 10pt;">Generated {datetime.now().strftime('%b %d, %Y %H:%M')}</p>
                </div>
                <div class="user-info">
                    <h2>{user_name}'s Timetable</h2>
                    <p>{title}</p>
                    <p>{date_range_str}</p>
                </div>
            </div>
            
        """
        
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t.completed])
        completion_pct = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
        
        html_content += f"""
            <div class="summary">
                <div class="summary-item">
                    <div class="summary-value">{total_tasks}</div>
                    <div class="summary-label">Total Tasks</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{completed_tasks}</div>
                    <div class="summary-label">Completed</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{completion_pct}%</div>
                    <div class="summary-label">Completion</div>
                </div>
            </div>
        """
        
        if not tasks:
            html_content += "<p style='text-align: center; color: #666; margin-top: 50px;'>No tasks scheduled for this period.</p>"
        else:
            # Group tasks by date
            tasks_by_date = {}
            for t in tasks:
                date_str = t.date.strftime('%A, %B %d, %Y')
                if date_str not in tasks_by_date:
                    tasks_by_date[date_str] = []
                tasks_by_date[date_str].append(t)
                
            for date_str, daily_tasks in tasks_by_date.items():
                html_content += f"""
                <div class="date-section">
                    <div class="date-header">{date_str}</div>
                    <table>
                        <thead>
                            <tr>
                                <th class="time-col">Time</th>
                                <th class="task-col">Task</th>
                                <th class="category-col">Category</th>
                                <th class="status-col">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                """
                
                daily_tasks.sort(key=lambda x: x.time)
                for t in daily_tasks:
                    is_important = t.priority.lower() == "high" or t.category.lower() in ["flight", "exam", "meeting", "train", "appointment"]
                    row_class = "important-row" if is_important else ""
                    status_html = "<span class='completed-icon'>✅ Done</span>" if t.completed else "<span class='pending-icon'>⭕ Pending</span>"
                    
                    html_content += f"""
                            <tr class="{row_class}">
                                <td class="time-col">{t.time}<br><span style='font-size:8pt;font-weight:normal;color:#666;'>{t.duration_minutes}m</span></td>
                                <td class="task-col" style="{ 'text-decoration: line-through; color: #9ca3af;' if t.completed else ''}">{t.task}</td>
                                <td class="category-col"><span class="category-badge">{t.category}</span></td>
                                <td class="status-col">{status_html}</td>
                            </tr>
                    """
                
                html_content += """
                        </tbody>
                    </table>
                </div>
                """
                
        html_content += """
        </body>
        </html>
        """
        
        pdf_bytes = HTML(string=html_content).write_pdf()
        return pdf_bytes
        
    except Exception as e:
        print(f"[DEBUG] WeasyPrint failed, falling back to fpdf2: {e}")
        # Fallback to fpdf2
        from fpdf import FPDF
        
        class PDF(FPDF):
            def header(self):
                self.set_font('helvetica', 'B', 20)
                self.set_text_color(124, 58, 237) # Purple
                self.cell(0, 10, 'Planora AI', ln=True)
                
                self.set_font('helvetica', 'I', 10)
                self.set_text_color(100, 100, 100)
                self.cell(0, 10, f'Generated {datetime.now().strftime("%b %d, %Y %H:%M")}', ln=True)
                
                self.set_y(10)
                self.set_font('helvetica', 'B', 12)
                self.set_text_color(0, 0, 0)
                self.cell(0, 10, f"{user_name}'s Timetable", align='R', ln=True)
                
                self.set_font('helvetica', '', 10)
                self.set_text_color(100, 100, 100)
                self.cell(0, 5, title, align='R', ln=True)
                self.cell(0, 5, date_range_str, align='R', ln=True)
                self.ln(10)

            def footer(self):
                self.set_y(-15)
                self.set_font('helvetica', 'I', 8)
                self.set_text_color(150, 150, 150)
                self.cell(0, 10, f'Page {self.page_no()}', align='C')

        pdf = PDF()
        pdf.add_page()
        
        # Summary
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t.completed])
        completion_pct = int((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
        
        pdf.set_font('helvetica', 'B', 12)
        pdf.set_fill_color(243, 232, 255) # Light purple
        pdf.cell(0, 10, f"  Summary: {total_tasks} Tasks | {completed_tasks} Completed | {completion_pct}% Completion", fill=True, ln=True)
        pdf.ln(5)
        
        if not tasks:
            pdf.set_font('helvetica', 'I', 12)
            pdf.cell(0, 10, "No tasks scheduled for this period.", align='C', ln=True)
        else:
            tasks_by_date = {}
            for t in tasks:
                date_str = t.date.strftime('%A, %B %d, %Y')
                if date_str not in tasks_by_date:
                    tasks_by_date[date_str] = []
                tasks_by_date[date_str].append(t)
                
            for date_str, daily_tasks in tasks_by_date.items():
                pdf.set_font('helvetica', 'B', 14)
                pdf.set_text_color(0, 0, 0)
                pdf.cell(0, 10, date_str, border='B', ln=True)
                pdf.ln(5)
                
                pdf.set_font('helvetica', 'B', 10)
                pdf.set_text_color(100, 100, 100)
                pdf.cell(30, 8, "Time", border='B')
                pdf.cell(80, 8, "Task", border='B')
                pdf.cell(40, 8, "Category", border='B')
                pdf.cell(40, 8, "Status", border='B', ln=True)
                
                daily_tasks.sort(key=lambda x: x.time)
                for t in daily_tasks:
                    pdf.set_font('helvetica', '', 10)
                    pdf.set_text_color(0, 0, 0)
                    
                    is_important = t.priority.lower() == "high" or t.category.lower() in ["flight", "exam", "meeting", "train", "appointment"]
                    if is_important:
                        pdf.set_fill_color(255, 251, 235)
                        fill = True
                    else:
                        fill = False
                        
                    # Truncate task name if too long
                    task_name = t.task[:40] + "..." if len(t.task) > 40 else t.task
                    
                    pdf.cell(30, 10, f"{t.time} ({t.duration_minutes}m)", fill=fill)
                    pdf.cell(80, 10, task_name, fill=fill)
                    pdf.cell(40, 10, t.category, fill=fill)
                    pdf.cell(40, 10, "Done" if t.completed else "Pending", fill=fill, ln=True)
                pdf.ln(5)
                
        return bytes(pdf.output())


def generate_csv(tasks):
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Date", "Day", "Time", "Task Name", "Category", "Duration (mins)", "Status", "Completed"])
    
    tasks.sort(key=lambda x: (x.date, x.time))
    
    for t in tasks:
        writer.writerow([
            t.date.strftime("%Y-%m-%d"),
            t.date.strftime("%A"),
            t.time,
            t.task,
            t.category,
            t.duration_minutes,
            "Done" if t.completed else "Pending",
            t.completed
        ])
        
    return output.getvalue()


@router.get("/today")
def export_today(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user.id).first()
    name = db_user.name if db_user and db_user.name else "User"
    
    today = datetime.now().date()
    tasks = db.query(DailyTask).filter(DailyTask.user_id == user.id, DailyTask.date == today).all()
    
    pdf_bytes = generate_pdf(tasks, "Today's Schedule", today.strftime("%B %d, %Y"), name)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=planora-today-{today.strftime('%Y-%m-%d')}.pdf"}
    )

@router.get("/week")
def export_week(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user.id).first()
    name = db_user.name if db_user and db_user.name else "User"
    
    today = datetime.now().date()
    start_of_week = today - timedelta(days=today.weekday()) # Monday
    end_of_week = start_of_week + timedelta(days=6) # Sunday
    
    tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user.id,
        DailyTask.date >= start_of_week,
        DailyTask.date <= end_of_week
    ).all()
    
    pdf_bytes = generate_pdf(
        tasks, 
        "Weekly Schedule", 
        f"{start_of_week.strftime('%b %d')} - {end_of_week.strftime('%b %d, %Y')}", 
        name
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=planora-week-{start_of_week.strftime('%Y-%m-%d')}-to-{end_of_week.strftime('%Y-%m-%d')}.pdf"}
    )

@router.get("/month")
def export_month(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user.id).first()
    name = db_user.name if db_user and db_user.name else "User"
    
    today = datetime.now().date()
    start_of_month = today.replace(day=1)
    
    # Calculate end of month
    if today.month == 12:
        end_of_month = today.replace(year=today.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        end_of_month = today.replace(month=today.month + 1, day=1) - timedelta(days=1)
        
    tasks = db.query(DailyTask).filter(
        DailyTask.user_id == user.id,
        DailyTask.date >= start_of_month,
        DailyTask.date <= end_of_month
    ).all()
    
    pdf_bytes = generate_pdf(
        tasks, 
        "Monthly Schedule", 
        today.strftime("%B %Y"), 
        name
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=planora-month-{today.strftime('%B-%Y').lower()}.pdf"}
    )

@router.get("/csv")
def export_csv(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    tasks = db.query(DailyTask).filter(DailyTask.user_id == user.id).all()
    
    csv_str = generate_csv(tasks)
    
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=planora-all-tasks-{datetime.now().strftime('%Y-%m-%d')}.csv"}
    )
