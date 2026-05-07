from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import GoalCreate, GoalResponse, GoalStatsResponse
from ..auth import verify_clerk_token, ClerkUser
from ..models import Goal, Constraint, UserConversationState, ProgressLog
import uuid

router = APIRouter(prefix="/api/goals", tags=["Goals"])

@router.post("", response_model=GoalResponse)
def create_goal(
    goal_data: GoalCreate,
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    # Check if goal exists
    existing_goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    if existing_goal:
        db.delete(existing_goal)
        # Clear existing constraints
        db.query(Constraint).filter(Constraint.user_id == user.id).delete()
        
    new_goal = Goal(
        user_id=user.id,
        title=goal_data.title,
        target=goal_data.target,
        duration=goal_data.duration
    )
    db.add(new_goal)
    
    for c_title in goal_data.constraints:
        db.add(Constraint(user_id=user.id, title=c_title))
        
    # Reset conversation state
    conv_state = db.query(UserConversationState).filter(UserConversationState.user_id == user.id).first()
    if conv_state:
        conv_state.phase = "interview"
        conv_state.interview_step = 0
        conv_state.collected_context = {}
    else:
        db.add(UserConversationState(user_id=user.id, phase="interview"))

    db.commit()
    db.refresh(new_goal)
    return new_goal

@router.get("/stats", response_model=GoalStatsResponse)
def get_goal_stats(
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(Goal.user_id == user.id).first()
    conv_state = db.query(UserConversationState).filter(UserConversationState.user_id == user.id).first()
    
    # Calculate stats
    logs = db.query(ProgressLog).filter(ProgressLog.user_id == user.id).order_by(ProgressLog.date.desc()).all()
    streak = 0
    for log in logs:
        if log.completed_tasks > 0 and log.completed_tasks == log.total_tasks:
            streak += 1
        else:
            break
            
    completion_percentage = 0.0
    if logs:
        total_all = sum([l.total_tasks for l in logs])
        comp_all = sum([l.completed_tasks for l in logs])
        if total_all > 0:
            completion_percentage = (comp_all / total_all) * 100

    return {
        "goal": goal,
        "completion_percentage": completion_percentage,
        "streak": streak,
        "interview_status": conv_state.phase if conv_state else "none"
    }
