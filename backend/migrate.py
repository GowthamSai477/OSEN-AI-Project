from sqlalchemy import text
from app.database import engine

def migrate():
    print("Starting migration...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS url TEXT"))
            print("Added 'url' column")
        except Exception as e:
            print(f"Error adding url: {e}")
            
        try:
            conn.execute(text("ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS links JSONB"))
            print("Added 'links' column")
        except Exception as e:
            print(f"Error adding links: {e}")
            
        conn.commit()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
