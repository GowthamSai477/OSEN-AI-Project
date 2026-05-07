from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import base64

from ..database import get_db
from ..models import User
from ..schemas import UserPreferencesUpdate, UserPreferencesResponse
from ..auth import verify_clerk_token, ClerkUser

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/preferences", response_model=UserPreferencesResponse)
def get_user_preferences(user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return UserPreferencesResponse(
        timezone=db_user.timezone or "Asia/Kolkata",
        email_notifications_enabled=db_user.email_notifications_enabled,
        email_morning_enabled=db_user.email_morning_enabled,
        email_evening_enabled=db_user.email_evening_enabled,
        email_events_enabled=db_user.email_events_enabled,
        email_plan_changes_enabled=db_user.email_plan_changes_enabled,
        morning_email_time=db_user.morning_email_time or "06:00",
        evening_email_time=db_user.evening_email_time or "22:00",
    )

@router.patch("/preferences", response_model=UserPreferencesResponse)
def update_user_preferences(prefs: UserPreferencesUpdate, user: ClerkUser = Depends(verify_clerk_token), db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.id == user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = prefs.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    
    return UserPreferencesResponse(
        timezone=db_user.timezone or "Asia/Kolkata",
        email_notifications_enabled=db_user.email_notifications_enabled,
        email_morning_enabled=db_user.email_morning_enabled,
        email_evening_enabled=db_user.email_evening_enabled,
        email_events_enabled=db_user.email_events_enabled,
        email_plan_changes_enabled=db_user.email_plan_changes_enabled,
        morning_email_time=db_user.morning_email_time or "06:00",
        evening_email_time=db_user.evening_email_time or "22:00",
    )

@router.get("/unsubscribe")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    try:
        # Decode the token to get the user ID
        user_id = base64.b64decode(token).decode('utf-8')
        db_user = db.query(User).filter(User.id == user_id).first()
        
        if not db_user:
            return {"status": "error", "message": "Invalid unsubscribe link"}
            
        db_user.email_notifications_enabled = False
        db.commit()
        
        return {"status": "success", "message": "You have been successfully unsubscribed from all email notifications."}
    except Exception as e:
        return {"status": "error", "message": "Invalid unsubscribe link"}
