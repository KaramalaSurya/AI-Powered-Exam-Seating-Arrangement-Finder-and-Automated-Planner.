from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
import sqlite3
from pydantic import BaseModel
from backend.database import get_db_connection
from backend.agents import AIOrchestrator, ValidationAgent, SeatMappingAgent
from backend.seeding import seed_mits_rooms
from backend.ingestion import parse_student_pin_list, parse_master_schedule
from backend.allocation import run_12_12_allocation, commit_allocation
import backend.reports as reports

router = APIRouter()

# --- Pydantic Schemas ---
class SeedRoomsRequest(BaseModel):
    session_id: int
    text_content: str

class RunAllocationRequest(BaseModel):
    session_id: int
    exam_date: str
    exam_time: str
    block: Optional[str] = None
    students_per_bench: Optional[int] = 1

class SessionCreate(BaseModel):
    name: str

class SessionUpdate(BaseModel):
    is_active: bool

class RoomLayoutUpdate(BaseModel):
    rows: int
    columns: int
    filling_strategy: str
    capacity: int

class SettingsSave(BaseModel):
    gemini_api_key: str

class SeatingRangeSave(BaseModel):
    block: str
    room_name: str
    rows: int
    columns: int
    filling_strategy: str
    roll_prefix: str
    start_num: str
    end_num: str
    padding: int
    exam_date: str
    exam_time: str
    subject: str
    students_per_bench: Optional[int] = 1

class IngestionSaveRequest(BaseModel):
    session_id: int
    ranges: List[SeatingRangeSave]


# --- Helper to get API Key from DB ---
def get_gemini_api_key() -> Optional[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'GEMINI_API_KEY'")
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else None


# ==========================================
#          STUDENT API ENDPOINTS
# ==========================================

def is_roll_in_range(roll_num: str, prefix: str, start_str: str, end_str: str) -> bool:
    if not prefix or start_str == "Empty" or end_str == "Empty":
        return False
        
    if not roll_num.startswith(prefix):
        return False
        
    suffix = roll_num[len(prefix):]
    
    # Numeric comparison
    if start_str.isdigit() and end_str.isdigit() and suffix.isdigit():
        return int(start_str) <= int(suffix) <= int(end_str)
        
    # Lexicographical comparison for alphanumeric JNTU suffixes of same length
    if len(start_str) == len(end_str) == len(suffix):
        return start_str <= suffix <= end_str
        
    from backend.agents import expand_roll_range
    expanded = expand_roll_range(prefix, start_str, end_str)
    return roll_num in expanded

@router.get("/student/search")
def search_student_seating(roll_number: str):
    """
    Search endpoint for students. 
    Performs optimized SQL lookup using BETWEEN operation to find the corresponding room range.
    """
    roll_number = roll_number.strip().upper()
    if not roll_number:
        raise HTTPException(status_code=400, detail="Roll number cannot be empty.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch active sessions
    cursor.execute("SELECT id, name FROM sessions WHERE is_active = 1")
    active_sessions = [dict(row) for row in cursor.fetchall()]
    if not active_sessions:
        conn.close()
        raise HTTPException(status_code=404, detail="No active exam session found.")
        
    session_ids = [s["id"] for s in active_sessions]
    
    # 2. Fetch all ranges for active sessions to filter in Python
    placeholders = ",".join("?" for _ in session_ids)
    query = f"""
        SELECT 
            sr.*, 
            r.block, 
            r.room_name, 
            r.rows, 
            r.columns, 
            r.benches_per_row,
            r.students_per_bench,
            r.filling_strategy
        FROM seating_ranges sr
        JOIN rooms r ON sr.room_id = r.id
        WHERE sr.session_id IN ({placeholders})
    """
    cursor.execute(query, session_ids)
    all_ranges = [dict(row) for row in cursor.fetchall()]
    
    # Find matching range
    match_range = None
    for r in all_ranges:
        if is_roll_in_range(roll_number, r["roll_prefix"], r["start_num"], r["end_num"]):
            match_range = r
            break
            
    if not match_range:
        conn.close()
        raise HTTPException(
            status_code=404, 
            detail=f"Seating arrangement not found for roll number '{roll_number}' in current active sessions."
        )
        
    room_id = match_range["room_id"]
    
    # 3. Fetch all ranges for this room (sorted by order_index) for the same exam slot to calculate seating layout offsets
    cursor.execute("""
        SELECT sr.*, r.block, r.room_name
        FROM seating_ranges sr
        JOIN rooms r ON sr.room_id = r.id
        WHERE sr.room_id = ? AND sr.exam_date = ? AND sr.exam_time = ?
        ORDER BY sr.order_index ASC
    """, (room_id, match_range["exam_date"], match_range["exam_time"]))
    
    ranges_in_room = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    # 4. Map student to exact row, column, bench position using SeatMappingAgent
    room_meta = {
        "rows": match_range["rows"],
        "columns": match_range["columns"],
        "filling_strategy": match_range["filling_strategy"],
        "students_per_bench": match_range["students_per_bench"]
    }
    
    seating_map = SeatMappingAgent.map_student_to_seat(roll_number, ranges_in_room, room_meta)
    
    if "error" in seating_map:
        raise HTTPException(status_code=500, detail=seating_map["error"])
        
    match_session_id = match_range["session_id"]
    match_session_name = next((s["name"] for s in active_sessions if s["id"] == match_session_id), "Active Session")
    
    return {
        "session_name": match_session_name,
        "roll_number": roll_number,
        "seating_details": seating_map
    }


# ==========================================
#          ADMIN API ENDPOINTS
# ==========================================

@router.get("/admin/sessions")
def list_sessions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
    sessions = [dict(s) for s in cursor.fetchall()]
    conn.close()
    return sessions

@router.post("/admin/sessions")
def create_session(data: SessionCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO sessions (name, is_active) VALUES (?, 0)", (data.name,))
        conn.commit()
        session_id = cursor.lastrowid
        conn.close()
        return {"success": True, "session_id": session_id}
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Session name already exists.")

@router.put("/admin/sessions/{session_id}")
def update_session_status(session_id: int, data: SessionUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET is_active = ? WHERE id = ?", (1 if data.is_active else 0, session_id))
    conn.commit()
    conn.close()
    return {"success": True}

@router.delete("/admin/sessions/{session_id}")
def delete_session(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/admin/upload")
async def upload_document(
    file: UploadFile = File(...), 
    session_id: int = Form(...)
):
    """
    Endpoint for uploading a file (PDF, Excel, Image).
    Extracts, OCRs, parses, and validates the data, returning it for admin preview.
    """
    file_bytes = await file.read()
    api_key = get_gemini_api_key()
    
    result = AIOrchestrator.ingest_document(
        filename=file.filename,
        file_bytes=file_bytes,
        session_id=session_id,
        gemini_api_key=api_key
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result


@router.post("/admin/save-arrangements")
def save_arrangements(payload: IngestionSaveRequest):
    """
    Saves parsed and edited arrangement ranges into the database.
    Creates rooms if they do not exist and maps ranges accordingly.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Clear existing room layouts and seating ranges for this session to update fresh
        # First, find rooms under this session
        cursor.execute("SELECT id FROM rooms WHERE session_id = ?", (payload.session_id,))
        room_ids = [row["id"] for row in cursor.fetchall()]
        
        if room_ids:
            # Delete ranges
            placeholders = ",".join("?" for _ in room_ids)
            cursor.execute(f"DELETE FROM seating_ranges WHERE room_id IN ({placeholders})", room_ids)
            # Delete rooms
            cursor.execute("DELETE FROM rooms WHERE session_id = ?", (payload.session_id,))
            
        # Track map of (block, room_name) -> room_id to keep order_index offsets correct
        room_id_map = {}
        room_range_counters = {} # (block, room_name) -> total accumulated students
        
        for entry in payload.ranges:
            block = entry.block.strip()
            room_name = entry.room_name.strip()
            
            # 1. Create or get room
            room_key = (block, room_name)
            if room_key not in room_id_map:
                students_per_bench = entry.students_per_bench if entry.students_per_bench is not None else 1
                capacity = entry.rows * entry.columns * students_per_bench
                cursor.execute("""
                    INSERT INTO rooms (session_id, block, room_name, rows, columns, students_per_bench, capacity, filling_strategy)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    payload.session_id, 
                    block, 
                    room_name, 
                    entry.rows, 
                    entry.columns, 
                    students_per_bench,
                    capacity, 
                    entry.filling_strategy
                ))
                room_id = cursor.lastrowid
                room_id_map[room_key] = room_id
                room_range_counters[room_key] = 0
            else:
                room_id = room_id_map[room_key]
                
            # Compute order_index for this range
            order_index = room_range_counters[room_key]
            
            # 2. Insert Seating Range
            cursor.execute("""
                INSERT INTO seating_ranges (
                    session_id, room_id, roll_prefix, start_num, end_num, padding, 
                    exam_date, exam_time, subject, order_index
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                payload.session_id,
                room_id,
                entry.roll_prefix.strip(),
                str(entry.start_num).strip(),
                str(entry.end_num).strip(),
                entry.padding,
                entry.exam_date,
                entry.exam_time,
                entry.subject,
                order_index
            ))
            
            # Increment range offset count for next range in this room
            from backend.agents import expand_roll_range
            expanded = expand_roll_range(entry.roll_prefix, str(entry.start_num), str(entry.end_num))
            range_size = len(expanded)
            room_range_counters[room_key] += range_size
            
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database save error: {str(e)}")


@router.get("/admin/ranges")
def list_ranges(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sr.*, r.block, r.room_name, r.rows, r.columns, r.students_per_bench, r.filling_strategy
        FROM seating_ranges sr
        JOIN rooms r ON sr.room_id = r.id
        WHERE sr.session_id = ?
        ORDER BY r.block, r.room_name, sr.order_index
    """, (session_id,))
    ranges = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ranges


@router.get("/admin/settings")
def get_settings():
    api_key = get_gemini_api_key()
    return {"gemini_api_key": api_key or ""}

@router.post("/admin/settings")
def save_settings(data: SettingsSave):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO settings (key, value) 
        VALUES ('GEMINI_API_KEY', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    """, (data.gemini_api_key.strip(),))
    conn.commit()
    conn.close()
    return {"success": True}


@router.get("/admin/dashboard-stats")
def get_stats():
    """Provides general stats for the admin homepage dashboard."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM sessions")
    total_sessions = cursor.fetchone()[0]
    
    cursor.execute("SELECT id, name FROM sessions WHERE is_active = 1")
    active_sessions = [dict(row) for row in cursor.fetchall()]
    
    total_rooms = 0
    total_ranges = 0
    active_session_name = "None"
    
    if active_sessions:
        active_session_name = ", ".join(s["name"] for s in active_sessions)
        session_ids = [s["id"] for s in active_sessions]
        placeholders = ",".join("?" for _ in session_ids)
        
        cursor.execute(f"SELECT COUNT(*) FROM rooms WHERE session_id IN ({placeholders})", session_ids)
        total_rooms = cursor.fetchone()[0]
        
        cursor.execute(f"SELECT COUNT(*) FROM seating_ranges WHERE session_id IN ({placeholders})", session_ids)
        total_ranges = cursor.fetchone()[0]
        
    conn.close()
    return {
        "total_sessions": total_sessions,
        "active_session": active_session_name,
        "total_rooms": total_rooms,
        "total_ranges": total_ranges
    }

import io

# ==========================================
#      PLANNER & ALLOCATION API ENDPOINTS
# ==========================================

@router.post("/admin/seed-rooms")
def seed_rooms_endpoint(data: SeedRoomsRequest):
    conn = get_db_connection()
    try:
        import re
        rooms_to_seed = []
        current_block = "General Block"
        
        lines = data.text_content.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if ":" in line:
                floor_part, rooms_part = line.split(":", 1)
                room_tokens = rooms_part.split(",")
                for token in room_tokens:
                    token = token.strip()
                    if not token:
                        continue
                    room_name = re.sub(r'\(.*?\)', '', token).strip()
                    if room_name:
                        rooms_to_seed.append((current_block, room_name))
            else:
                block_name = re.sub(r'\(.*?\)', '', line).strip()
                if block_name:
                    current_block = line.strip()
                    
        if not rooms_to_seed:
            raise HTTPException(status_code=400, detail="No classrooms parsed from the text content. Please check format.")
            
        cursor = conn.cursor()
        
        # Clear existing rooms under this session to start completely fresh
        cursor.execute("DELETE FROM rooms WHERE session_id = ?", (data.session_id,))
        
        # Format list to insert: session_id, block, room_name, rows, columns, benches_per_row, students_per_bench, filling_strategy, capacity
        rooms_data = [
            (data.session_id, block, room_name, 6, 4, 1, 1, 'column_wise', 24)
            for block, room_name in rooms_to_seed
        ]
        
        cursor.executemany("""
            INSERT OR REPLACE INTO rooms (session_id, block, room_name, rows, columns, benches_per_row, students_per_bench, filling_strategy, capacity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rooms_data)
        
        conn.commit()
        return {"success": True, "count": len(rooms_to_seed)}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error seeding classrooms: {str(e)}")
    finally:
        conn.close()

@router.post("/admin/ingest-students")
async def ingest_students(
    file: UploadFile = File(...),
    session_id: int = Form(...)
):
    file_bytes = await file.read()
    students = parse_student_pin_list(file_bytes, file.filename)
    if not students:
        raise HTTPException(status_code=400, detail="No students parsed from registration list.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Clear existing registrations for this session
        cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
        
        # Insert
        insert_data = [(session_id, s["roll_number"], s["subject"]) for s in students]
        cursor.executemany("""
            INSERT OR IGNORE INTO student_registrations (session_id, roll_number, subject)
            VALUES (?, ?, ?)
        """, insert_data)
        
        conn.commit()
        return {"success": True, "count": len(students)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during ingestion: {str(e)}")
    finally:
        conn.close()

@router.post("/admin/ingest-schedule")
async def ingest_schedule(
    file: UploadFile = File(...),
    session_id: int = Form(...)
):
    file_bytes = await file.read()
    schedule = parse_master_schedule(file_bytes, file.filename)
    if not schedule:
        raise HTTPException(status_code=400, detail="No exams parsed from master schedule.")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Clear existing schedules for this session
        cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
        
        # Insert
        insert_data = [(session_id, s["exam_date"], s["exam_time"], s["subject"]) for s in schedule]
        cursor.executemany("""
            INSERT OR IGNORE INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, insert_data)
        
        conn.commit()
        return {"success": True, "count": len(schedule)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during ingestion: {str(e)}")
    finally:
        conn.close()

@router.get("/admin/planner-status")
def get_planner_status(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(DISTINCT roll_number) FROM student_registrations WHERE session_id = ?", (session_id,))
    students_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM exam_schedules WHERE session_id = ?", (session_id,))
    schedule_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM rooms WHERE session_id = ?", (session_id,))
    rooms_count = cursor.fetchone()[0]
    
    conn.close()
    return {
        "students_count": students_count,
        "schedule_count": schedule_count,
        "rooms_count": rooms_count
    }

@router.get("/admin/allocation/slots")
def get_allocation_slots(session_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT exam_date, exam_time 
        FROM exam_schedules 
        WHERE session_id = ? 
        ORDER BY exam_date, exam_time
    """, (session_id,))
    slots = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return slots

@router.post("/admin/allocation/run")
def run_allocation_endpoint(data: RunAllocationRequest):
    conn = get_db_connection()
    try:
        res = run_12_12_allocation(data.session_id, data.exam_date, data.exam_time, conn, block=data.block, students_per_bench=data.students_per_bench)
        if not res.get("success", False):
            raise HTTPException(status_code=400, detail=res.get("error", "Failed to run seating planner."))
        return res
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Allocation runtime error: {str(e)}")
    finally:
        conn.close()

@router.post("/admin/allocation/approve")
def approve_allocation_endpoint(data: RunAllocationRequest):
    conn = get_db_connection()
    try:
        allocation_result = run_12_12_allocation(data.session_id, data.exam_date, data.exam_time, conn, block=data.block, students_per_bench=data.students_per_bench)
        if not allocation_result["success"]:
            raise HTTPException(status_code=400, detail=allocation_result.get("error", "Failed to run allocation planner."))
            
        commit_res = commit_allocation(data.session_id, allocation_result, conn)
        if not commit_res["success"]:
            raise HTTPException(status_code=500, detail=commit_res.get("error", "Database commit failed."))
            
        return {"success": True}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval database commit error: {str(e)}")
    finally:
        conn.close()

# ==========================================
#          REPORTS API ENDPOINTS
# ==========================================

@router.get("/admin/reports/door-charts")
def get_door_charts(session_id: int, exam_date: str, exam_time: str, block: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Get active session name
    cursor.execute("SELECT name FROM sessions WHERE id = ?", (session_id,))
    session_row = cursor.fetchone()
    session_name = session_row["name"] if session_row else "Semester Exams"
    
    filter_block = block if block and block != "All" else None
    rooms_data = reports.get_slot_seating_data(session_id, exam_date, exam_time, conn, block=filter_block)
    conn.close()
    
    if not rooms_data:
        raise HTTPException(status_code=404, detail="No seating arrangements found to generate door charts.")
        
    pdf_bytes = reports.generate_door_charts_pdf(session_name, exam_date, exam_time, rooms_data)
    
    filename_block = f"_{filter_block.replace(' ', '_')}" if filter_block else ""
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="door_charts_{exam_date.replace("-", "_")}{filename_block}.pdf"'}
    )

@router.get("/admin/reports/master-allocation")
def get_master_allocation(session_id: int, exam_date: str, exam_time: str, block: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sessions WHERE id = ?", (session_id,))
    session_row = cursor.fetchone()
    session_name = session_row["name"] if session_row else "Semester Exams"
    
    filter_block = block if block and block != "All" else None
    rooms_data = reports.get_slot_seating_data(session_id, exam_date, exam_time, conn, block=filter_block)
    conn.close()
    
    if not rooms_data:
        raise HTTPException(status_code=404, detail="No seating arrangements found to generate master allocation summary.")
        
    pdf_bytes = reports.generate_master_allocation_pdf(session_name, exam_date, exam_time, rooms_data)
    
    filename_block = f"_{filter_block.replace(' ', '_')}" if filter_block else ""
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="master_hall_allocation_{exam_date.replace("-", "_")}{filename_block}.pdf"'}
    )

@router.get("/admin/reports/attendance-sheets")
def get_attendance_sheets(session_id: int, exam_date: str, exam_time: str, block: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sessions WHERE id = ?", (session_id,))
    session_row = cursor.fetchone()
    session_name = session_row["name"] if session_row else "Semester Exams"
    
    filter_block = block if block and block != "All" else None
    rooms_data = reports.get_slot_seating_data(session_id, exam_date, exam_time, conn, block=filter_block)
    conn.close()
    
    if not rooms_data:
        raise HTTPException(status_code=404, detail="No seating arrangements found to generate attendance sheets.")
        
    pdf_bytes = reports.generate_attendance_sheets_pdf(session_name, exam_date, exam_time, rooms_data)
    
    filename_block = f"_{filter_block.replace(' ', '_')}" if filter_block else ""
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="invigilator_attendance_sheets_{exam_date.replace("-", "_")}{filename_block}.pdf"'}
    )
