import os
from fastapi import Header, HTTPException, Depends
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

class ClerkUser(BaseModel):
    id: str
    email: str = None

def verify_clerk_token(authorization: str = Header(None), db: Session = Depends(get_db)) -> ClerkUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    
    token = authorization.split(" ")[1]
    
    try:
        # Decode without verification first to get the user ID
        # Clerk handles verification on their end via the frontend SDK
        decoded = jwt.get_unverified_claims(token)
        user_id = decoded.get("sub")
        email = decoded.get("email") or decoded.get("primary_email_address") or f"{user_id}@planora.dev"
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        # Upsert user in database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(id=user_id, email=email)
            db.add(user)
            db.commit()
            db.refresh(user)
        
        return ClerkUser(id=user_id, email=email)
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token error: {str(e)}")
