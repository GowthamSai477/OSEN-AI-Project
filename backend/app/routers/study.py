from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Note
from ..schemas import StudyAnalyzeRequest, QuizGenerateRequest, DescriptiveGradeRequest
from ..auth import verify_clerk_token, ClerkUser
from ..services.provider_service import AIProviderService
import json
import uuid

router = APIRouter(prefix="/api/study", tags=["Study"])
ai_service = AIProviderService()

@router.post("/analyze")
async def analyze_document(
    req: StudyAnalyzeRequest,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    system_prompt = """You are a study assistant. 
Analyze the provided document and help the student.
Be educational, clear, and structured."""

    if req.action == "summarize":
        user_msg = f"Summarize this document:\n{req.file_content}"
    elif req.action == "key_concepts":
        user_msg = f"List all key concepts from:\n{req.file_content}"
    elif req.action == "create_notes":
        user_msg = f"Create structured study notes in markdown from:\n{req.file_content}"
    elif req.action == "explain":
        user_msg = f"Explain this document simply:\n{req.file_content}"
    else:
        user_msg = f"Document:\n{req.file_content}\n\nQuestion: {req.message}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg}
    ]

    try:
        response = await ai_service.chat(messages, max_tokens=1500)
        content = response["content"]

        note_created = False
        note_id = None

        if req.action == "create_notes":
            # Auto-save to notes
            note = Note(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title=f"Notes: {req.file_name}",
                content=content,
                tags=f"study, {req.file_name}",
                source="study_mode"
            )
            db.add(note)
            db.commit()
            db.refresh(note)
            note_created = True
            note_id = note.id

        return {
            "response": content,
            "note_created": note_created,
            "note_id": note_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-quiz")
async def generate_quiz(
    req: QuizGenerateRequest,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    topic_context = f"about {req.topic}"
    if req.file_content:
        topic_context = f"based on this document content: {req.file_content[:2000]}..."

    if req.quiz_type == "mcq":
        prompt = f"""Generate {req.num_questions} {req.difficulty} MCQ questions {topic_context}.
Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "...",
      "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
      "correct": "A",
      "explanation": "..."
    }}
  ]
}}"""
    else:
        prompt = f"""Generate {req.num_questions} {req.difficulty} descriptive questions {topic_context}.
Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "...",
      "model_answer": "...",
      "key_points": ["point1", "point2"]
    }}
  ]
}}"""

    messages = [
        {"role": "system", "content": "You are a quiz generator. Output ONLY valid JSON."},
        {"role": "user", "content": prompt}
    ]

    try:
        response = await ai_service.chat(messages, max_tokens=2000)
        # Try to parse JSON from content
        content = response["content"]
        # Clean potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        quiz_data = json.loads(content)
        return quiz_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")

@router.post("/grade-descriptive")
async def grade_descriptive(
    req: DescriptiveGradeRequest,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    results = []
    
    for i, q_data in enumerate(req.questions):
        student_answer = req.answers[i] if i < len(req.answers) else ""
        
        prompt = f"""Grade this answer out of 10.
Question: {q_data.get('question')}
Model answer: {q_data.get('model_answer')}
Key points: {q_data.get('key_points')}
Student answer: {student_answer}

Return ONLY valid JSON: {{"score": 7, "feedback": "...", "missed_points": ["..."]}}"""

        messages = [
            {"role": "system", "content": "You are a strict but fair academic grader. Output ONLY valid JSON."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = await ai_service.chat(messages, max_tokens=500)
            content = response["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
                
            grade = json.loads(content)
            results.append({
                "question": q_data.get('question'),
                "student_answer": student_answer,
                "model_answer": q_data.get('model_answer'),
                "score": grade.get("score", 0),
                "feedback": grade.get("feedback", ""),
                "missed_points": grade.get("missed_points", [])
            })
        except Exception:
            results.append({
                "question": q_data.get('question'),
                "student_answer": student_answer,
                "score": 0,
                "feedback": "Grading failed for this question.",
                "missed_points": []
            })
            
    return {"results": results}
