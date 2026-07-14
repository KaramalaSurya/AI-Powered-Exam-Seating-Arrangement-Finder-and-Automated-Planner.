# generate_artifact_pdfs.py
import sqlite3
import os
import sys

# Add workspace to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_db_connection
from backend.allocation import run_12_12_allocation, commit_allocation
import backend.reports as reports

def generate_pdfs():
    print("Generating artifact PDFs...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Find active session
        cursor.execute("SELECT id, name FROM sessions WHERE is_active = 1 LIMIT 1")
        active = cursor.fetchone()
        if not active:
            print("Error: No active session found.")
            return
            
        session_id = active["id"]
        session_name = active["name"]
        exam_date = "2026-07-15"
        exam_time = "10:00 AM - 01:00 PM"
        
        # 1. Run allocation & commit to database so ranges are present
        alloc = run_12_12_allocation(session_id, exam_date, exam_time, conn)
        if not alloc["success"]:
            print(f"Error running allocation: {alloc.get('error')}")
            return
            
        commit_res = commit_allocation(session_id, alloc, conn)
        if not commit_res["success"]:
            print(f"Error committing allocation: {commit_res.get('error')}")
            return
            
        print("Allocation committed successfully. Gathering seating data...")
        
        # 2. Get slot seating data for reports
        rooms_data = reports.get_slot_seating_data(session_id, exam_date, exam_time, conn)
        if not rooms_data:
            print("Error: No seating data found after commit.")
            return
            
        # Target directory in artifacts
        artifact_dir = "C:\\Users\\surya\\.gemini\\antigravity-ide\\brain\\9d0d3343-9990-4481-91bb-4f4fc404493c"
        os.makedirs(artifact_dir, exist_ok=True)
        
        # 3. Generate Door Seating Charts
        door_pdf = reports.generate_door_charts_pdf(session_name, exam_date, exam_time, rooms_data)
        door_path = os.path.join(artifact_dir, "mits_door_charts.pdf")
        with open(door_path, "wb") as f:
            f.write(door_pdf)
        print(f"Created Door Seating Charts: {door_path}")
        
        # 4. Generate Master Hall Allocation Board List
        board_pdf = reports.generate_master_allocation_pdf(session_name, exam_date, exam_time, rooms_data)
        board_path = os.path.join(artifact_dir, "mits_master_hall_allocation.pdf")
        with open(board_path, "wb") as f:
            f.write(board_pdf)
        print(f"Created Board Summary list: {board_path}")
        
        # 5. Generate Attendance Sheets
        attendance_pdf = reports.generate_attendance_sheets_pdf(session_name, exam_date, exam_time, rooms_data)
        attendance_path = os.path.join(artifact_dir, "mits_attendance_sheets.pdf")
        with open(attendance_path, "wb") as f:
            f.write(attendance_pdf)
        print(f"Created Invigilator Attendance sheets: {attendance_path}")
        
        print("All reports generated successfully!")
        
    except Exception as e:
        print(f"Error during PDF generation: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    generate_pdfs()
