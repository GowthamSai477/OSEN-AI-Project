# Planora AI - Adaptive Life Planning System

Most people have goals, but very few people achieve them. The gap between "I want to lose 10kg" and actually doing it is not motivation — it is a lack of a concrete, realistic, day-by-day execution plan that adapts when life gets in the way.

Planora bridges this gap. It is an AI-powered agentic system that:
1. Learns your goal, your constraints, your daily schedule through a conversational interview.
2. Generates a complete 7-day structured plan tailored to your life.
3. Tracks what you complete and what you skip.
4. Automatically rebalances your future schedule when you fall behind.
5. Lets you talk to it like a human and updates your plan in real time.

## Tech Stack
- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL (Supabase)
- **Frontend**: Next.js 14, TailwindCSS, shadcn/ui
- **AI Models**: Groq (LLaMA 3.3 70B primary), DeepSeek API (fallback)
- **Authentication**: Clerk

## Setup Instructions

### 1. Backend Setup
1. Open the `backend/` directory.
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `.\venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. Install requirements: `pip install -r requirements.txt`
5. Configure `.env` using `.env.example` as a template. You need a Supabase Database URL and a Groq API Key.
6. Run migrations: `alembic upgrade head`
7. Start server: `uvicorn app.main:app --reload --port 8000`

### 2. Frontend Setup
1. Open the `frontend/` directory.
2. Install dependencies: `npm install`
3. Configure `.env.local` with your Clerk Publishable Key and Secret Key. Ensure `NEXT_PUBLIC_API_URL=http://localhost:8000`
4. Run development server: `npm run dev`

### How to get Groq API Key
1. Go to https://console.groq.com and Sign Up.
2. Go to "API Keys" -> "Create API Key".
3. Store the key in your `backend/.env` file.

## API Documentation
- `GET /health` - Health check
- `POST /api/goals` - Set goal
- `GET /api/goals/stats` - Goal progress
- `POST /api/ai/chat` - Interact with Planora AI
- `GET /api/planner/tasks` - Get schedule
- `POST /api/planner/execute` - Execute AI actions
- `POST /api/analytics/report` - Generate weekly report
