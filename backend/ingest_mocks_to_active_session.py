# ingest_mocks_to_active_session.py
import sqlite3
import os
import sys

# Add workspace to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_db_connection
from backend.ingestion import parse_student_pin_list, parse_master_schedule

def run_ingestion():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Find active session
        cursor.execute("SELECT id, name FROM sessions WHERE is_active = 1 LIMIT 1")
        active = cursor.fetchone()
        if not active:
            print("Error: No active session found. Please activate a session first.")
            return
            
        session_id = active["id"]
        print(f"Active Session: {active['name']} (ID: {session_id})")
        
        # Paths
        base_dir = os.path.dirname(os.path.abspath(__file__))
        students_path = os.path.join(base_dir, "mock_students_list.xlsx")
        schedule_path = os.path.join(base_dir, "mock_exam_schedule.xlsx")
        
        # 1. Ingest students list
        if os.path.exists(students_path):
            with open(students_path, "rb") as f:
                file_bytes = f.read()
            students = parse_student_pin_list(file_bytes, "mock_students_list.xlsx")
            if students:
                cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
                insert_data = [(session_id, s["roll_number"], s["subject"]) for s in students]
                cursor.executemany("""
                    INSERT OR IGNORE INTO student_registrations (session_id, roll_number, subject)
                    VALUES (?, ?, ?)
                """, insert_data)
                print(f"Ingested {len(students)} student registration records.")
            else:
                print("No students parsed.")
        else:
            print("Students Excel file not found.")
            
        # 2. Ingest schedule
        if os.path.exists(schedule_path):
            with open(schedule_path, "rb") as f:
                file_bytes = f.read()
            schedule = parse_master_schedule(file_bytes, "mock_exam_schedule.xlsx")
            if schedule:
                cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
                insert_data = [(session_id, s["exam_date"], s["exam_time"], s["subject"]) for s in schedule]
                cursor.executemany("""
                    INSERT OR IGNORE INTO exam_schedules (session_id, exam_date, exam_time, subject)
                    VALUES (?, ?, ?, ?)
                """, insert_data)
                print(f"Ingested {len(schedule)} exam schedule entries.")
            else:
                print("No schedule entries parsed.")
        else:
            print("Schedule Excel file not found.")
            
        conn.commit()
        print("Ingestion of mock data completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_ingestion()
