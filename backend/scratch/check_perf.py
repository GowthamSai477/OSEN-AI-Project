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

def check_perf():
    with engine.connect() as conn:
        print("--- Checking Indexes ---")
        res = conn.execute(text("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename IN ('daily_tasks', 'goals', 'progress_logs', 'users');
        """))
        for row in res:
            print(f"Index: {row[0]}")

        print("\n--- Checking Table Sizes ---")
        for table in ['daily_tasks', 'goals', 'chat_messages', 'notifications', 'weekly_reports']:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"Table {table}: {count} rows")

        print("\n--- Checking Weekly Reports ---")
        reports = conn.execute(text("SELECT id, user_id, week_start FROM weekly_reports LIMIT 5")).fetchall()
        for r in reports:
            print(f"Report: {r}")

if __name__ == "__main__":
    check_perf()
