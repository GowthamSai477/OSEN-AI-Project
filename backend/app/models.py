from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .database import Base
import uuid
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True) # Clerk user ID
    email = Column(String, unique=True, nullable=False)
    name = Column(String)
    timezone = Column(String, default="Asia/Kolkata")
    email_notifications_enabled = Column(Boolean, default=True)
    email_morning_enabled = Column(Boolean, default=True)
    email_evening_enabled = Column(Boolean, default=True)
    email_events_enabled = Column(Boolean, default=True)
    email_plan_changes_enabled = Column(Boolean, default=True)
    morning_email_time = Column(String, default="06:00")
    evening_email_time = Column(String, default="22:00")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String, nullable=False)
    target = Column(String, nullable=False)
    duration = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class Constraint(Base):
    __tablename__ = "constraints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String, nullable=False)

class DailyTask(Base):
    __tablename__ = "daily_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"))
    task = Column(String, nullable=False)
    time = Column(String, nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, default=30)
    category = Column(String)
    task_type = Column(String)
    status = Column(String, default="pending")
    priority = Column(String, default="medium")
    url = Column(String, nullable=True)
    links = Column(JSONB, nullable=True) # For multiple resources
    is_locked = Column(Boolean, default=False)
    completed = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)
    created_by = Column(String, default="ai")
    created_at = Column(DateTime, server_default=func.now())
    subtasks = relationship("SubTask", back_populates="parent_task", cascade="all, delete-orphan", order_by="SubTask.order")

class UserConversationState(Base):
    __tablename__ = "user_conversation_state"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    phase = Column(String, default="interview")
    interview_step = Column(Integer, default=0)
    planner_version = Column(Integer, default=1)
    collected_context = Column(JSONB)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role = Column(String, nullable=False)
    content = Column(String, nullable=False)
    message_type = Column(String, default="chat")
    actions = Column(JSONB)
    status = Column(String, default="pending")
    created_at = Column(DateTime, server_default=func.now())

class ProgressLog(Base):
    __tablename__ = "progress_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    date = Column(DateTime, server_default=func.now())
    completed_tasks = Column(Integer, default=0)
    total_tasks = Column(Integer, default=0)

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False)
    input = Column(String)
    action_id = Column(String, unique=True)
    actions = Column(JSONB)
    status = Column(String)
    created_at = Column(DateTime, server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, nullable=False)  # missed_task / upcoming_event / ai_change / streak_milestone / goal_update
    read = Column(Boolean, default=False)
    link = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    week_start = Column(DateTime, nullable=False)
    week_end = Column(DateTime, nullable=False)
    completion_rate = Column(Integer, default=0)          # 0-100
    prev_completion_rate = Column(Integer, default=0)
    best_category = Column(String, nullable=True)
    worst_category = Column(String, nullable=True)
    total_completed = Column(Integer, default=0)
    total_tasks = Column(Integer, default=0)
    streak = Column(Integer, default=0)
    on_track_status = Column(String, default="behind")    # on_track / at_risk / behind
    ai_recommendation = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class SubTask(Base):
    __tablename__ = "subtasks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("daily_tasks.id", ondelete="CASCADE"))
    user_id = Column(String, index=True)
    title = Column(String, nullable=False)
    duration_minutes = Column(Integer, default=10)
    completed = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    parent_task = relationship("DailyTask", back_populates="subtasks")

class Note(Base):
    __tablename__ = "notes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    title = Column(String)
    content = Column(Text)  # markdown format
    tags = Column(String, nullable=True)  # comma separated
    source = Column(String, nullable=True) # "manual" | "ai_generated" | "study_mode"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
