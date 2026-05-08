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

    # Prevent Quota Exceeded errors by truncating large PDFs to ~50k chars (approx 12k tokens)
    safe_content = req.file_content[:50000] if req.file_content else ""

    if req.action == "summarize":
        user_msg = f"Summarize this document:\n{safe_content}"
    elif req.action == "key_concepts":
        user_msg = f"List all key concepts from:\n{safe_content}"
    elif req.action == "create_notes":
        user_msg = f"Create structured study notes in markdown from:\n{safe_content}"
    elif req.action == "explain":
        user_msg = f"Explain this document simply:\n{safe_content}"
    else:
        user_msg = f"Document:\n{safe_content}\n\nQuestion: {req.message}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg}
    ]

    try:
        # Switch to Gemini for document analysis
        response = await ai_service.chat(messages, max_tokens=3000, provider="gemini")
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
        import traceback
        print("STUDY ANALYZE ERROR:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-quiz")
async def generate_quiz(
    req: QuizGenerateRequest,
    db: Session = Depends(get_db),
    user: ClerkUser = Depends(verify_clerk_token)
):
    topic_context = f"about {req.topic}"
    if req.file_content:
        # Increase context window significantly for Gemini
        topic_context = f"based on this document content:\n\n{req.file_content[:50000]}\n\n"

    if req.quiz_type == "mcq":
        prompt = f"""
        You are a senior academic examiner. Generate {req.num_questions} high-quality MCQ questions for a {req.difficulty} level quiz {topic_context}.
        
        CRITICAL DIFFICULTY RULES:
        - EASY: Focus on basic facts, definitions, and direct recall.
        - MEDIUM: Focus on application of concepts, explaining relationships, and intermediate understanding.
        - HARD: Focus on deep critical analysis, complex problem solving, nuanced exceptions, and synthesizing multiple parts of the content. Questions must be challenging and require significant cognitive effort.
        
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
        prompt = f"""
        You are a senior academic examiner. Generate {req.num_questions} challenging descriptive questions for a {req.difficulty} level quiz {topic_context}.
        
        CRITICAL DIFFICULTY RULES:
        - EASY: Define or describe basic concepts.
        - MEDIUM: Compare and contrast, explain processes, or apply concepts to standard scenarios.
        - HARD: Evaluate complex scenarios, synthesize theoretical information, or critique advanced arguments. Requires deep analytical thinking.
        
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
        # Switch to Gemini for quiz generation
        response = await ai_service.chat(messages, max_tokens=4000, provider="gemini")
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
            # Switch to Gemini for grading
            response = await ai_service.chat(messages, max_tokens=1000, provider="gemini")
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
