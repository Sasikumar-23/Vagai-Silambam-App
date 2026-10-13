import os
import psycopg
from dotenv import load_dotenv

load_dotenv('c:/Office DTLP/Att/backend/.env')
db_url = os.getenv('DATABASE_URL')
# Convert sqlalchemy url postgresql+psycopg:// to postgresql://
if db_url and '+psycopg' in db_url:
    db_url = db_url.replace('+psycopg', '')

print(f"Connecting to database...")
with psycopg.connect(db_url) as conn:
    with conn.cursor() as cur:
        # Get all public tables
        cur.execute("""
            SELECT tablename, rowsecurity
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename;
        """)
        tables = cur.fetchall()
        print(f"Found {len(tables)} tables in public schema:")
        for t, rls in tables:
            print(f"  - {t}: RLS {'ENABLED' if rls else 'DISABLED'}")
