import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def optimize():
    with engine.connect() as conn:
        print("Creating indexes for performance...")
        
        indexes = [
            ("daily_tasks", "user_id"),
            ("daily_tasks", "date"),
            ("daily_tasks", "goal_id"),
            ("goals", "user_id"),
            ("chat_sessions", "user_id"),
            ("chat_messages", "session_id"),
            ("notifications", "user_id"),
            ("progress_logs", "user_id"),
            ("weekly_reports", "user_id"),
            ("subtasks", "task_id"),
            ("subtasks", "user_id")
        ]
        
        for table, col in indexes:
            idx_name = f"ix_{table}_{col}"
            try:
                # Use CONCURRENTLY if possible, but in a script like this simple is better
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({col});"))
                print(f"Ensured index {idx_name} exists.")
            except Exception as e:
                print(f"Error creating index {idx_name}: {e}")

        conn.commit()
        print("\nAll optimizations applied!")

if __name__ == "__main__":
    optimize()
