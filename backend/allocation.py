# allocation.py
import sqlite3
from typing import List, Dict, Any, Tuple
from backend.seeding import seed_mits_rooms

def run_12_12_allocation(
    session_id: int,
    exam_date: str,
    exam_time: str,
    conn: sqlite3.Connection,
    block: str = None,
    students_per_bench: int = 1
) -> Dict[str, Any]:
    """
    Simulates the "12-12" seating allocation algorithm for a specific exam slot.
    Returns a dict containing the allocation preview and stats.
    Does NOT write to the seating_ranges table; only prepares the preview.
    """
    cursor = conn.cursor()

    # 1. Fetch rooms
    query = """
        SELECT id, block, room_name, rows, columns, capacity 
        FROM rooms 
        WHERE session_id = ?
    """
    params = [session_id]
    if block and block != "All":
        query += " AND block = ?"
        params.append(block)
        
    cursor.execute(query, params)
    rooms = [dict(row) for row in cursor.fetchall()]
    
    # If no rooms, return failure instead of auto-seeding
    if not rooms:
        target_info = f" in block '{block}'" if block and block != "All" else ""
        return {
            "success": False,
            "error": f"No classrooms found{target_info} for this session. Please seed classrooms in the Classroom Ingestion section first."
        }
        
    # Sort rooms for deterministic assignment
    rooms.sort(key=lambda r: (r["block"], r["room_name"]))

    # 2. Get subjects scheduled for this slot
    cursor.execute("""
        SELECT subject FROM exam_schedules 
        WHERE session_id = ? AND exam_date = ? AND exam_time = ?
    """, (session_id, exam_date, exam_time))
    slot_subjects = [row["subject"] for row in cursor.fetchall()]
    
    if not slot_subjects:
        return {
            "success": False,
            "error": f"No subjects scheduled for slot {exam_date} | {exam_time}."
        }

    # 3. Get all student registrations for this session, and match them tolerantly in Python
    cursor.execute("""
        SELECT roll_number, subject 
        FROM student_registrations 
        WHERE session_id = ?
    """, (session_id,))
    all_students = [dict(row) for row in cursor.fetchall()]
    
    import re
    def normalize_subject(subj: str) -> str:
        # Remove parentheses and abbreviations inside them e.g. "Universal Human Values (UHV)" -> "Universal Human Values"
        cleaned = re.sub(r'\(.*?\)', '', subj)
        # Remove special characters, convert to lowercase, and normalize whitespace
        cleaned = re.sub(r'[^a-zA-Z0-9\s]', ' ', cleaned)
        return " ".join(cleaned.lower().split())

    # Map normalized scheduled subject to original scheduled subject name
    exact_scheduled = set(slot_subjects)
    
    students = []
    for s in all_students:
        if s["subject"] in exact_scheduled:
            students.append(s)
        else:
            norm_student_subj = normalize_subject(s["subject"])
            matched_sched = None
            for sched_subj in slot_subjects:
                norm_sched = normalize_subject(sched_subj)
                if norm_student_subj in norm_sched or norm_sched in norm_student_subj:
                    matched_sched = sched_subj
                    break
            
            if matched_sched:
                s["subject"] = matched_sched
                students.append(s)
    if not students:
        return {
            "success": False,
            "error": f"No students registered for subjects in this slot: {', '.join(slot_subjects)}."
        }

    # 4. Group and sort students by subject
    students_by_subject = {}
    for s in slot_subjects:
        students_by_subject[s] = []
    for s in students:
        students_by_subject[s["subject"]].append(s)
        
    # Sort students in each subject list numerically/alphabetically
    for subj in students_by_subject:
        students_by_subject[subj].sort(key=lambda x: x["roll_number"])

    # Prepare room allocations list
    room_allocations = []
    room_idx = 0
    
    # We want to iterate through rooms and populate them using our pairing strategy.
    # While we have active students and rooms:
    while room_idx < len(rooms) and any(len(students_by_subject[s]) > 0 for s in students_by_subject):
        room = rooms[room_idx]
        
        # Select two subjects with the most remaining students to pair
        active_subjects = sorted(
            [s for s in students_by_subject if len(students_by_subject[s]) > 0],
            key=lambda s: len(students_by_subject[s]),
            reverse=True
        )
        
        if not active_subjects:
            break
            
        capacity = 24 if students_per_bench == 1 else 48
        seats = [None] * capacity
        
        subj_A = active_subjects[0]
        subj_B = active_subjects[1] if len(active_subjects) > 1 else None
        
        count_A = 0
        count_B = 0
        
        half_capacity = capacity // 2
        
        # Decide how many students of A and B to allocate to this room
        # Case A: We have at least two subjects
        if subj_B:
            # We take up to half_capacity from A and up to half_capacity from B
            take_A = min(half_capacity, len(students_by_subject[subj_A]))
            take_B = min(half_capacity, len(students_by_subject[subj_B]))
            
            # Extract students
            room_students_A = [students_by_subject[subj_A].pop(0) for _ in range(take_A)]
            room_students_B = [students_by_subject[subj_B].pop(0) for _ in range(take_B)]
            
            # Layout checkerboard pattern:
            for i in range(capacity):
                if students_per_bench == 2:
                    col = i // 12
                    row = (i % 12) // 2
                    side = (i % 12) % 2
                    is_even = (row + col + side) % 2 == 0
                else:
                    row = i % 6
                    col = i // 6
                    is_even = (row + col) % 2 == 0
                
                if is_even:
                    if room_students_A:
                        seats[i] = room_students_A.pop(0)
                        count_A += 1
                    elif room_students_B:
                        # Fallback
                        seats[i] = room_students_B.pop(0)
                        count_B += 1
                else:
                    if room_students_B:
                        seats[i] = room_students_B.pop(0)
                        count_B += 1
                    elif room_students_A:
                        # Fallback A
                        seats[i] = room_students_A.pop(0)
                        count_A += 1
                        
            # Return any un-layouted students to the front of their respective lists
            if room_students_A:
                students_by_subject[subj_A] = room_students_A + students_by_subject[subj_A]
            if room_students_B:
                students_by_subject[subj_B] = room_students_B + students_by_subject[subj_B]
                
        else:
            # Only one subject left!
            # Place up to half_capacity students in alternate (even) seats to avoid adjacency
            take_A = min(half_capacity, len(students_by_subject[subj_A]))
            room_students_A = [students_by_subject[subj_A].pop(0) for _ in range(take_A)]
            
            for i in range(capacity):
                if students_per_bench == 2:
                    col = i // 12
                    row = (i % 12) // 2
                    side = (i % 12) % 2
                    is_even = (row + col + side) % 2 == 0
                else:
                    row = i % 6
                    col = i // 6
                    is_even = (row + col) % 2 == 0
                
                if is_even and room_students_A:
                    seats[i] = room_students_A.pop(0)
                    count_A += 1
                    
            # Return any un-layouted students
            if room_students_A:
                students_by_subject[subj_A] = room_students_A + students_by_subject[subj_A]
                
        # Register the room allocation preview
        room_allocations.append({
            "room_id": room["id"],
            "block": room["block"],
            "room_name": room["room_name"],
            "rows": 6,
            "columns": 4,
            "capacity": capacity,
            "seats": seats, # list of 24 or 48 elements (student dict or None)
            "subject_A": subj_A,
            "count_A": count_A,
            "subject_B": subj_B,
            "count_B": count_B,
            "empty_count": capacity - (count_A + count_B)
        })
        
        room_idx += 1

    # Check for remaining students that couldn't be allocated
    leftovers = []
    for subj in students_by_subject:
        for s in students_by_subject[subj]:
            leftovers.append(s)

    return {
        "success": True,
        "exam_date": exam_date,
        "exam_time": exam_time,
        "room_allocations": room_allocations,
        "total_rooms_used": len(room_allocations),
        "total_students_allocated": len(students) - len(leftovers),
        "total_leftovers": len(leftovers),
        "leftover_students": leftovers
    }


def commit_allocation(
    session_id: int,
    allocation_result: Dict[str, Any],
    conn: sqlite3.Connection
) -> Dict[str, Any]:
    """
    Saves the allocation preview generated by run_12_12_allocation into the SQLite database.
    This overwrites rooms configurations (to 6x4) and inserts seating ranges.
    """
    cursor = conn.cursor()
    
    try:
        # First, find rooms under this session
        cursor.execute("SELECT id FROM rooms WHERE session_id = ?", (session_id,))
        room_ids = [row["id"] for row in cursor.fetchall()]
        
        # Clear existing seating ranges for the rooms that we are allocating
        allocated_room_ids = [r["room_id"] for r in allocation_result["room_allocations"]]
        if allocated_room_ids:
            placeholders = ",".join("?" for _ in allocated_room_ids)
            cursor.execute(f"DELETE FROM seating_ranges WHERE room_id IN ({placeholders})", allocated_room_ids)
            
        for r_alloc in allocation_result["room_allocations"]:
            room_id = r_alloc["room_id"]
            capacity = r_alloc["capacity"]
            students_per_bench = 1 if capacity == 24 else 2
            
            # Ensure the room layout is set in database
            cursor.execute("""
                UPDATE rooms 
                SET rows = 6, columns = 4, benches_per_row = 1, students_per_bench = ?, capacity = ?, filling_strategy = 'column_wise'
                WHERE id = ?
            """, (students_per_bench, capacity, room_id))
            
            # Insert the seating ranges (either 24 or 48)
            for i, seat in enumerate(r_alloc["seats"]):
                if seat:
                    roll = seat["roll_number"]
                    prefix = roll[:-2]
                    suffix = roll[-2:]
                    subj = seat["subject"]
                else:
                    # Special roll representation for empty seats
                    prefix = ""
                    suffix = "Empty"
                    subj = "Empty"
                    
                cursor.execute("""
                    INSERT INTO seating_ranges (
                        session_id, room_id, roll_prefix, start_num, end_num, padding,
                        exam_date, exam_time, subject, order_index
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    session_id,
                    room_id,
                    prefix,
                    suffix,
                    suffix,
                    len(suffix),
                    allocation_result["exam_date"],
                    allocation_result["exam_time"],
                    subj,
                    i
                ))
                
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
