from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

class HealthResponse(BaseModel):
    status: str
    database: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: List[Dict[str, Any]] = []
    mode: str = "chat"
    intelligence_level: str = "Standard"
    response_style: str = "Concise"

class GoalCreate(BaseModel):
    title: str
    target: str
    duration: str
    constraints: List[str] = []

class GoalResponse(BaseModel):
    id: UUID
    title: str
    target: str
    duration: str
    
    class Config:
        from_attributes = True

class GoalStatsResponse(BaseModel):
    goal: Optional[GoalResponse]
    completion_percentage: float
    streak: int
    interview_status: str
    
    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    task: str
    date: str
    time: str
    duration_minutes: int = 30
    category: str = "personal"
    task_type: str = "habit"
    priority: str = "medium"
    url: Optional[str] = None
    links: Optional[List[Dict[str, Any]]] = None

class TaskUpdate(BaseModel):
    task: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None
    url: Optional[str] = None
    links: Optional[List[Dict[str, Any]]] = None

class SubTaskResponse(BaseModel):
    id: UUID
    task_id: UUID
    title: str
    duration_minutes: int
    completed: bool
    order: int
    
    class Config:
        from_attributes = True

class TaskResponse(BaseModel):
    id: UUID
    task: str
    date: datetime
    time: str
    duration_minutes: int
    category: Optional[str] = "Task"
    task_type: Optional[str] = "task"
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    completed: bool
    url: Optional[str] = None
    links: Optional[List[Dict[str, Any]]] = None
    subtasks: List[SubTaskResponse] = []

    class Config:
        from_attributes = True

class ExecuteRequest(BaseModel):
    action_id: str
    actions: List[Dict[str, Any]]

class DeleteRangeRequest(BaseModel):
    startDate: str
    endDate: str
    messageId: Optional[str] = None

class ResolveConflictRequest(BaseModel):
    action: str  # "replace", "find_next_free_slot", or "keep_both"
    task_data: Dict[str, Any]
    messageId: Optional[str] = None

class UserPreferencesUpdate(BaseModel):
    timezone: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None
    email_morning_enabled: Optional[bool] = None
    email_evening_enabled: Optional[bool] = None
    email_events_enabled: Optional[bool] = None
    email_plan_changes_enabled: Optional[bool] = None
    morning_email_time: Optional[str] = None
    evening_email_time: Optional[str] = None

class UserPreferencesResponse(BaseModel):
    timezone: str
    email_notifications_enabled: bool
    email_morning_enabled: bool
    email_evening_enabled: bool
    email_events_enabled: bool
    email_plan_changes_enabled: bool
    morning_email_time: str
    evening_email_time: str

class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[str] = None
    source: str = "manual"

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None

class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    tags: Optional[str] = None
    source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NoteGenerateRequest(BaseModel):
    topic: str
    detail_level: str # "brief" | "detailed"
    file_content: Optional[str] = None

class StudyAnalyzeRequest(BaseModel):
    message: Optional[str] = None
    file_content: str
    file_name: str
    action: str # "chat"|"summarize"|"key_concepts"|"create_notes"|"explain"

class QuizGenerateRequest(BaseModel):
    topic: str
    file_content: Optional[str] = None
    quiz_type: str # "descriptive"|"mcq"
    difficulty: str # "easy"|"medium"|"hard"
    num_questions: int

class GenerateFlashcardsRequest(BaseModel):
    topic: str
    file_content: Optional[str] = None
    num_cards: int = 10

class DescriptiveGradeRequest(BaseModel):
    questions: List[Dict[str, Any]] # {question, model_answer, key_points}
    answers: List[str]

# Health Center Schemas
class UserHealthProfileUpdate(BaseModel):
    height_cm: Optional[int] = None
    weight_kg: Optional[int] = None
    daily_water_goal: Optional[int] = None
    daily_step_goal: Optional[int] = None
    track_menstrual_cycle: Optional[bool] = None

class UserHealthProfileResponse(BaseModel):
    height_cm: Optional[int]
    weight_kg: Optional[int]
    daily_water_goal: int
    daily_step_goal: int
    track_menstrual_cycle: bool

    class Config:
        from_attributes = True

class DailyHealthLogUpdate(BaseModel):
    water_glasses: Optional[int] = None
    sleep_hours: Optional[float] = None
    calories_consumed: Optional[int] = None
    mood: Optional[str] = None
    steps: Optional[int] = None
    period_active: Optional[bool] = None

class DailyHealthLogResponse(BaseModel):
    date: datetime
    water_glasses: int
    sleep_hours: float
    calories_consumed: int
    mood: Optional[str]
    steps: int
    period_active: bool

    class Config:
        from_attributes = True

class CalorieEstimateRequest(BaseModel):
    meal_description: str

# Gamification Schemas
class GamificationStatusResponse(BaseModel):
    xp: int
    level: int
    current_streak: int
    longest_streak: int
    badges: List[str]

    class Config:
        from_attributes = True

class AddXpRequest(BaseModel):
    amount: int
    reason: str
