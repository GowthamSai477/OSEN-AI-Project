# Planora System Architecture

## Overview
Planora is built on a clear separation of concerns, ensuring maximum testability and AI agent modularity. The Next.js frontend handles state and UI, while the FastAPI Python backend acts as an orchestrator between the database and the Groq/DeepSeek AI models.

## Structure

```
planora-api/
├── backend/                    
│   ├── app/
│   │   ├── main.py             (FastAPI app entry point)
│   │   ├── database.py         (SQLAlchemy + Supabase connection)
│   │   ├── models.py           (PostgreSQL tables)
│   │   ├── schemas.py          (Pydantic validation schemas)
│   │   ├── auth.py             (Clerk JWT middleware)
│   │   ├── routers/            (HTTP Endpoints)
│   │   │   ├── ai.py           
│   │   │   ├── planner.py      
│   │   │   ├── goals.py        
│   │   │   └── analytics.py    
│   │   └── services/           (Business & AI Logic)
│   │       ├── ai_service.py          
│   │       ├── provider_service.py    
│   │       ├── planner_service.py     
│   │       ├── tool_executor.py       
│   │       └── analytics_service.py   
│   ├── alembic/                (Database migrations)
│
└── frontend/                   (Next.js 14 UI)
```

## AI Data Flow
1. User types in chat. Next.js calls `POST /api/ai/chat`.
2. `ai.py` fetches user constraints, history, and goals from PostgreSQL.
3. `provider_service.py` sends the prompt + tool list to Groq API.
4. Groq returns a `tool_call` (e.g., `add_task`).
5. `tool_executor.py` translates this tool call into a SQLAlchemy database insert.
6. The updated state is returned to the frontend.
