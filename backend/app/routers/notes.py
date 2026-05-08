from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Note
from ..schemas import NoteCreate, NoteUpdate, NoteResponse, NoteGenerateRequest
from ..auth import verify_clerk_token, ClerkUser
from ..services.provider_service import AIProviderService
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/notes", tags=["Notes"])
ai_service = AIProviderService()

@router.get("", response_model=List[NoteResponse])
async def get_notes(
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    notes = db.query(Note).filter(Note.user_id == user.id).order_by(Note.updated_at.desc()).all()
    return notes

@router.post("", response_model=NoteResponse)
async def create_note(
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    note = Note(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title=note_in.title,
        content=note_in.content,
        tags=note_in.tags,
        source=note_in.source
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    note_in: NoteUpdate,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note_in.title is not None:
        note.title = note_in.title
    if note_in.content is not None:
        note.content = note_in.content
    if note_in.tags is not None:
        note.tags = note_in.tags
    
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note

@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    return {"status": "success"}

@router.post("/generate", response_model=NoteResponse)
async def generate_note(
    req: NoteGenerateRequest,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    # Truncate topic to prevent massive payloads exhausting API quota
    safe_topic = req.topic[:50000] if req.topic else ""
    safe_file_content = ""
    if req.file_content:
        # Truncate file content to ~50k chars to avoid token limits
        safe_file_content = req.file_content[:50000] + "\n[...content truncated for length]" if len(req.file_content) > 50000 else req.file_content

    file_context = f"\n\nSource Document Content:\n{safe_file_content}\n\n" if safe_file_content else ""

    prompt = f"""
    Generate comprehensive, high-quality markdown notes on the topic: **{safe_topic}**.
    {file_context}
    Detail Level: {req.detail_level}
    
    Structure the notes using clean, professional Markdown:
    - Start with a single `# ` for the Main Title.
    - Use `## ` for sections (e.g., ## Introduction, ## Key Concepts, ## Detailed Analysis, ## Summary).
    - DO NOT use numbers before your headers (e.g., avoid "1. # Title" or "2. ## Introduction").
    - Use bullet points (`- ` or `* `) for lists to ensure they render cleanly.
    - Use bold text (`**term**`) to emphasize important concepts.
    - Include code blocks (```) if relevant.
    """

    messages = [
        {"role": "system", "content": "You are a world-class academic study assistant. You excel at creating organized, clear, and comprehensive study notes in Markdown format."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        response = await ai_service.chat(messages, max_tokens=3000, provider="gemini")
        content = response["content"]
        
        # Create the note in DB
        note = Note(
            id=str(uuid.uuid4()),
            user_id=user.id,
            title=f"AI: {req.topic}",
            content=content,
            tags=req.topic,
            source="ai_generated"
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return note
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
