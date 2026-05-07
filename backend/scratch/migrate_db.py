import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found")
    exit(1)

# Handle postgres:// vs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Checking for missing columns in daily_tasks...")
        
        # Add 'url' column to daily_tasks
        try:
            conn.execute(text("ALTER TABLE daily_tasks ADD COLUMN url TEXT;"))
            print("Added 'url' column to daily_tasks")
        except Exception as e:
            print(f"Column 'url' might already exist or error: {e}")
            
        # Add 'links' column to daily_tasks
        try:
            conn.execute(text("ALTER TABLE daily_tasks ADD COLUMN links JSONB;"))
            print("Added 'links' column to daily_tasks")
        except Exception as e:
            print(f"Column 'links' might already exist or error: {e}")

        # Add 'user_id' column to subtasks if missing (I noticed it was added recently)
        try:
            conn.execute(text("ALTER TABLE subtasks ADD COLUMN user_id TEXT;"))
            print("Added 'user_id' column to subtasks")
        except Exception as e:
            print(f"Column 'user_id' in subtasks might already exist or error: {e}")

        # Create notifications table if missing
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    type TEXT NOT NULL,
                    read BOOLEAN DEFAULT FALSE,
                    link TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            print("Ensured notifications table exists")
        except Exception as e:
            print(f"Error creating notifications table: {e}")

        # Create weekly_reports table if missing
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS weekly_reports (
                    id UUID PRIMARY KEY,
                    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                    week_start TIMESTAMP NOT NULL,
                    week_end TIMESTAMP NOT NULL,
                    completion_rate INTEGER DEFAULT 0,
                    prev_completion_rate INTEGER DEFAULT 0,
                    best_category TEXT,
                    worst_category TEXT,
                    total_completed INTEGER DEFAULT 0,
                    total_tasks INTEGER DEFAULT 0,
                    streak INTEGER DEFAULT 0,
                    on_track_status TEXT DEFAULT 'behind',
                    ai_recommendation TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            print("Ensured weekly_reports table exists")
        except Exception as e:
            print(f"Error creating weekly_reports table: {e}")

        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
