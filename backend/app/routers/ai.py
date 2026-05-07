from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import ChatRequest
from ..auth import verify_clerk_token, ClerkUser
from ..services.provider_service import AIProviderService
from ..services.ai_service import build_system_prompt, build_chat_prompt, PLANORA_TOOLS
from ..models import Goal, Constraint, DailyTask, UserConversationState, ChatSession, ChatMessage
import json

router = APIRouter(prefix="/api/ai", tags=["AI"])
provider_service = AIProviderService()

@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    try:
        # Ensure user exists in the database to prevent foreign key errors
        from ..models import User
        db_user = db.query(User).filter(User.id == user.id).first()
        if not db_user:
            db_user = User(id=user.id, email=user.email or f"{user.id}@placeholder.com", name="User")
            db.add(db_user)
            db.commit()
        elif user.email and (db_user.email.endswith("@placeholder.com") or not db_user.email):
            db_user.email = user.email
            db.commit()

        # Retrieve user context
        from datetime import date
        today = date.today()
        goal = db.query(Goal).filter(Goal.user_id == user.id).first()
        constraints = db.query(Constraint).filter(Constraint.user_id == user.id).all()
        
        try:
            from datetime import datetime
            tasks = db.query(DailyTask).filter(
                DailyTask.user_id == user.id, 
                DailyTask.date >= datetime.now().date()
            ).order_by(DailyTask.date.asc(), DailyTask.time.asc()).all()
            
            tasks_list = []
            for t in tasks:
                day_name = t.date.strftime("%A")
                date_str = t.date.strftime("%Y-%m-%d")
                tasks_list.append({
                    "date": f"{date_str} ({day_name})",
                    "task": t.task, 
                    "time": t.time, 
                    "duration": t.duration_minutes, 
                    "category": t.category, 
                    "completed": t.completed
                })
        except Exception:
            db.rollback()
            tasks_list = []
            
        conv_state = db.query(UserConversationState).filter(UserConversationState.user_id == user.id).first()
        
        goal_dict = {"title": goal.title, "target": goal.target, "duration": goal.duration} if goal else None
        constraints_list = [c.title for c in constraints]
        
        phase = conv_state.phase if conv_state else "interview"
        collected_context = conv_state.collected_context if conv_state and conv_state.collected_context else {}
        
        user_context = {
            "goal": goal_dict,
            "constraints": constraints_list,
            "existing_tasks": tasks_list,
            "phase": phase,
            "collected_context": collected_context
        }
        
        from ..services.ai_service import PLANORA_TOOLS, build_system_prompt, build_chat_prompt, build_study_prompt
        
        tools_to_use = None
        if request.mode == "planner":
            system_prompt = build_system_prompt(user_context, request.intelligence_level, request.response_style)
            tools_to_use = PLANORA_TOOLS
        elif request.mode == "study":
            system_prompt = build_study_prompt(user_context, request.intelligence_level, request.response_style)
            tools_to_use = PLANORA_TOOLS
        else:
            system_prompt = build_chat_prompt(user_context, request.intelligence_level, request.response_style)
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Session handling
        session_id_obj = None
        if request.session_id:
            import uuid
            try:
                session_id_obj = uuid.UUID(request.session_id)
            except ValueError:
                pass
                
        if not session_id_obj:
            words = request.message.split()
            title = " ".join(words[:5]) + ("..." if len(words) > 5 else "")
            if not title.strip():
                title = "New Conversation"
                
            new_session = ChatSession(user_id=user.id, title=title)
            db.add(new_session)
            db.commit()
            db.refresh(new_session)
            session_id_obj = new_session.id

        # Add history
        for msg in request.history:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
        messages.append({"role": "user", "content": request.message})

        try:
            # Tool loop (up to 3 iterations for multi-turn search/agent behavior)
            current_iter = 0
            max_iters = 3
            final_response = None
            all_tool_calls = []
            status = "pending"
            
            from ..services.tool_executor import execute_tool_call
            
            while current_iter < max_iters:
                response = await provider_service.chat(
                    messages=messages,
                    tools=tools_to_use
                )
                final_response = response
                
                if not response.get("tool_calls"):
                    break
                
                # Add assistant's tool call to history
                assistant_msg = {
                    "role": "assistant",
                    "content": response.get("content") or None,
                    "tool_calls": response["tool_calls"]
                }
                messages.append(assistant_msg)
                
                # We also want to keep track of ALL tool calls for the final UI return
                for tc in response["tool_calls"]:
                    all_tool_calls.append(tc)
                
                # Execute tools and add results to history
                found_new_info = False
                for call in response["tool_calls"]:
                    name = call["function"]["name"]
                    try:
                        args = json.loads(call["function"]["arguments"]) if isinstance(call["function"]["arguments"], str) else call["function"]["arguments"]
                        res = await execute_tool_call(name, args, user.id, db)
                        
                        # Add tool result to history
                        messages.append({
                            "role": "tool",
                            "tool_call_id": call["id"],
                            "name": name,
                            "content": json.dumps(res)
                        })
                        
                        # Handle conflicts for planner
                        if res and res.get("type") == "conflict":
                            status = "conflict"
                            call["conflict_data"] = res
                            
                        # If it's a search, the AI definitely needs to see it to continue
                        if name == "web_search":
                            found_new_info = True
                            
                    except Exception as e:
                        print(f"Tool execution error in loop: {e}")
                        messages.append({
                            "role": "tool",
                            "tool_call_id": call["id"],
                            "name": name,
                            "content": json.dumps({"success": False, "error": str(e)})
                        })
                
                if not found_new_info:
                    # If no "informational" tools were called, we might not need to re-invoke
                    # But usually, if tools were called, we want to see if the AI has a final word.
                    pass
                
                current_iter += 1
            
            response = final_response
            # Use accumulated tool calls
            if all_tool_calls:
                response["tool_calls"] = all_tool_calls

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "rate limit" in error_msg.lower():
                friendly_msg = "AI is temporarily rate limited. Please wait a moment and try again."
            else:
                friendly_msg = f"Sorry, I ran into an error trying to process that: {repr(e)}"
                
            return {
                "message": friendly_msg,
                "type": "chat",
                "tool_calls_made": False,
                "parsed_actions": [],
                "session_id": str(session_id_obj) if session_id_obj else None
            }

        # Save the interaction to db
        if session_id_obj:
            chat_msg_user = ChatMessage(session_id=session_id_obj, role="user", content=request.message)
            db.add(chat_msg_user)
            chat_msg_assistant = ChatMessage(
                session_id=session_id_obj, 
                role="assistant", 
                content=response.get("content") or "",
                actions=response["tool_calls"] if response.get("tool_calls") else None,
                status=status,
                message_type="action" if response.get("tool_calls") else "chat"
            )
            db.add(chat_msg_assistant)
            db.commit()
            
        return {
            "message": response.get("content") or "",
            "type": "action" if response.get("tool_calls") else "chat",
            "tool_calls_made": bool(response.get("tool_calls")),
            "parsed_actions": response.get("tool_calls"),
            "status": status,
            "session_id": str(session_id_obj) if session_id_obj else None
        }

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

@router.get("/sessions")
async def get_sessions(
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    try:
        sessions = db.query(ChatSession).filter(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc()).all()
        return [{"id": str(s.id), "title": s.title, "created_at": s.created_at.isoformat()} for s in sessions]
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

@router.get("/sessions/{session_id}")
async def get_session_messages(
    session_id: str,
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    try:
        import uuid
        try:
            sid = uuid.UUID(session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session ID")
            
        session = db.query(ChatSession).filter(ChatSession.id == sid, ChatSession.user_id == user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        messages = db.query(ChatMessage).filter(ChatMessage.session_id == sid).order_by(ChatMessage.created_at.asc()).all()
        
        result = []
        for msg in messages:
            result.append({
                "id": str(msg.id),
                "role": msg.role,
                "content": msg.content,
                "actions": msg.actions,
                "status": msg.status,
                "type": msg.message_type
            })
        return result
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: ClerkUser = Depends(verify_clerk_token),
    db: Session = Depends(get_db)
):
    try:
        import uuid
        try:
            sid = uuid.UUID(session_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid session ID")
            
        session = db.query(ChatSession).filter(ChatSession.id == sid, ChatSession.user_id == user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        db.delete(session)
        db.commit()
        return {"status": "success", "message": "Session deleted"}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
