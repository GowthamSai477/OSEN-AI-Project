from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import get_db
from ..models import UserHealthProfile, DailyHealthLog
from ..schemas import (
    UserHealthProfileUpdate, UserHealthProfileResponse,
    DailyHealthLogUpdate, DailyHealthLogResponse,
    CalorieEstimateRequest
)
from ..auth import verify_clerk_token, ClerkUser
from ..services.provider_service import AIProviderService

router = APIRouter(prefix="/api/health", tags=["Health"])
ai_service = AIProviderService()

@router.get("/profile", response_model=UserHealthProfileResponse)
async def get_health_profile(
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    profile = db.query(UserHealthProfile).filter(UserHealthProfile.user_id == user.id).first()
    if not profile:
        profile = UserHealthProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.patch("/profile", response_model=UserHealthProfileResponse)
async def update_health_profile(
    req: UserHealthProfileUpdate,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    profile = db.query(UserHealthProfile).filter(UserHealthProfile.user_id == user.id).first()
    if not profile:
        profile = UserHealthProfile(user_id=user.id)
        db.add(profile)
    
    if req.height_cm is not None: profile.height_cm = req.height_cm
    if req.weight_kg is not None: profile.weight_kg = req.weight_kg
    if req.daily_water_goal is not None: profile.daily_water_goal = req.daily_water_goal
    if req.daily_step_goal is not None: profile.daily_step_goal = req.daily_step_goal
    if req.track_menstrual_cycle is not None: profile.track_menstrual_cycle = req.track_menstrual_cycle
    
    db.commit()
    db.refresh(profile)
    return profile

@router.get("/today", response_model=DailyHealthLogResponse)
async def get_today_log(
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    today = datetime.utcnow().date()
    # Find log for today
    log = db.query(DailyHealthLog).filter(
        DailyHealthLog.user_id == user.id,
        DailyHealthLog.date >= datetime.combine(today, datetime.min.time()),
        DailyHealthLog.date < datetime.combine(today, datetime.max.time())
    ).first()
    
    if not log:
        log = DailyHealthLog(user_id=user.id, date=datetime.utcnow())
        db.add(log)
        db.commit()
        db.refresh(log)
        
    return log

@router.patch("/log", response_model=DailyHealthLogResponse)
async def update_health_log(
    req: DailyHealthLogUpdate,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    today = datetime.utcnow().date()
    log = db.query(DailyHealthLog).filter(
        DailyHealthLog.user_id == user.id,
        DailyHealthLog.date >= datetime.combine(today, datetime.min.time()),
        DailyHealthLog.date < datetime.combine(today, datetime.max.time())
    ).first()
    
    if not log:
        log = DailyHealthLog(user_id=user.id, date=datetime.utcnow())
        db.add(log)
        
    if req.water_glasses is not None: log.water_glasses = req.water_glasses
    if req.sleep_hours is not None: log.sleep_hours = req.sleep_hours
    if req.calories_consumed is not None: log.calories_consumed = req.calories_consumed
    if req.mood is not None: log.mood = req.mood
    if req.steps is not None: log.steps = req.steps
    if req.period_active is not None: log.period_active = req.period_active
    
    db.commit()
    db.refresh(log)
    return log

@router.post("/estimate-calories")
async def estimate_calories(
    req: CalorieEstimateRequest,
    user: ClerkUser = Depends(verify_clerk_token)
):
    messages = [
        {"role": "system", "content": "You are a nutrition expert. Given a meal description, return ONLY the estimated integer number of calories. Do not return any text, just the number (e.g. 450)."},
        {"role": "user", "content": f"Estimate calories for: {req.meal_description}"}
    ]
    try:
        res = await ai_service.chat(messages, max_tokens=10, provider="gemini")
        content = res["content"].strip()
        # Keep only digits
        digits = ''.join(filter(str.isdigit, content))
        return {"calories": int(digits) if digits else 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/weekly-insights")
async def get_weekly_insights(
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    # Fetch last 7 days of logs
    logs = db.query(DailyHealthLog).filter(
        DailyHealthLog.user_id == user.id
    ).order_by(DailyHealthLog.date.desc()).limit(7).all()
    
    if not logs:
        return {"insights": "Start logging your health data to receive personalized AI insights!"}
        
    summary_text = "Here is the user's health data for the last few days:\\n"
    for log in logs:
        summary_text += f"- {log.date.date()}: {log.water_glasses} glasses water, {log.sleep_hours}h sleep, {log.calories_consumed} calories, mood: {log.mood}, {log.steps} steps.\\n"
        
    messages = [
        {"role": "system", "content": "You are a health and wellness AI assistant. Analyze the user's recent health logs and provide a brief, encouraging 2-3 sentence insight or suggestion. Focus on actionable advice like drinking more water or adjusting sleep. Be friendly and supportive."},
        {"role": "user", "content": summary_text}
    ]
    
    try:
        res = await ai_service.chat(messages, max_tokens=150, provider="gemini")
        return {"insights": res["content"]}
    except Exception as e:
        return {"insights": "Unable to generate insights at this time."}
