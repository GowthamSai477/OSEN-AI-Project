from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..database import get_db
from ..models import GamificationProfile
from ..schemas import GamificationStatusResponse, AddXpRequest, GenerateFlashcardsRequest
from ..auth import verify_clerk_token, ClerkUser
from ..services.provider_service import AIProviderService
import json

router = APIRouter(prefix="/api/gamification", tags=["Gamification"])
ai_service = AIProviderService()

def calculate_level(xp: int) -> int:
    # Example logic: Level 1 is 0 XP. Level 2 is 100 XP. Level 3 is 250 XP. Level 4 is 450 XP, etc.
    # Level = sqrt(xp / 50) + 1 roughly
    return int((xp / 50) ** 0.5) + 1

@router.get("/status", response_model=GamificationStatusResponse)
async def get_status(
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    profile = db.query(GamificationProfile).filter(GamificationProfile.user_id == user.id).first()
    
    if not profile:
        # Create profile if it doesn't exist
        profile = GamificationProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    
    # Check streak logic
    today = datetime.utcnow().date()
    if profile.last_active_date:
        days_diff = (today - profile.last_active_date.date()).days
        if days_diff == 1:
            pass # Streak continues
        elif days_diff > 1:
            profile.current_streak = 0 # Streak lost
            db.commit()

    return profile

@router.post("/add-xp", response_model=GamificationStatusResponse)
async def add_xp(
    req: AddXpRequest,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    profile = db.query(GamificationProfile).filter(GamificationProfile.user_id == user.id).first()
    if not profile:
        profile = GamificationProfile(user_id=user.id)
        db.add(profile)
        db.commit()
    
    profile.xp += req.amount
    profile.level = calculate_level(profile.xp)
    
    # Handle streak logic
    today = datetime.utcnow().date()
    if not profile.last_active_date:
        profile.current_streak = 1
    else:
        days_diff = (today - profile.last_active_date.date()).days
        if days_diff == 1:
            profile.current_streak += 1
        elif days_diff > 1:
            profile.current_streak = 1 # Reset to 1 since they are active today
    
    profile.last_active_date = datetime.utcnow()
    
    if profile.current_streak > profile.longest_streak:
        profile.longest_streak = profile.current_streak
        
    # Example badge awarding
    badges = list(profile.badges) if profile.badges else []
    if profile.current_streak == 7 and "7-day-streak" not in badges:
        badges.append("7-day-streak")
    if profile.level >= 10 and "level-10" not in badges:
        badges.append("level-10")
        
    profile.badges = badges
    db.commit()
    db.refresh(profile)
    
    return profile

@router.post("/generate-flashcards")
async def generate_flashcards(
    req: GenerateFlashcardsRequest,
    user: ClerkUser = Depends(verify_clerk_token)
):
    safe_topic = req.topic[:50000] if req.topic else ""
    safe_file_content = req.file_content[:50000] if req.file_content else ""
    
    file_context = f"Based on this document:\n{safe_file_content}\n\n" if safe_file_content else ""
    
    prompt = f"""
    {file_context}
    Topic: {safe_topic}
    Generate {req.num_cards} flashcards (key terms and their definitions).
    Return the result strictly as a JSON array of objects.
    Each object must have exactly two keys: "term" and "definition".
    No markdown formatting outside the JSON array.
    """
    
    try:
        response = await ai_service.chat([{"role": "user", "content": prompt}], max_tokens=1500, provider="gemini")
        content = response["content"]
        
        content = content.replace("```json", "").replace("```", "").strip()
        flashcards = json.loads(content)
        return {"flashcards": flashcards}
    except Exception as e:
        print(f"Error generating flashcards: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate flashcards.")
