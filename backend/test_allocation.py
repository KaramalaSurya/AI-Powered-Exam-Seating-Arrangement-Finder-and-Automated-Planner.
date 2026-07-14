# test_allocation.py
import sqlite3
import os
import sys

# Add workspace to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_db_connection, init_db
from backend.seeding import seed_mits_rooms
from backend.allocation import run_12_12_allocation, commit_allocation

def run_tests():
    print("----- RUNNING BACKEND PLANNER & ALLOCATION TESTS -----")
    
    # 1. Initialize DB and get connection
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Create a test session
        cursor.execute("INSERT OR REPLACE INTO sessions (id, name, is_active) VALUES (999, 'Test Exam Session - 2026', 1)")
        session_id = 999
        
        # Initial cleanup for test session 999
        cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM seating_ranges WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM rooms WHERE session_id = ?", (session_id,))
        
        conn.commit()
        print("[Pass] Test session created and cleaned.")

        # 2. Seed rooms test
        seed_mits_rooms(session_id, conn)
        cursor.execute("SELECT COUNT(*) FROM rooms WHERE session_id = ?", (session_id,))
        rooms_count = cursor.fetchone()[0]
        assert rooms_count == 85, f"Expected 85 rooms, got {rooms_count}"
        print(f"[Pass] Seeding successful. Seeded {rooms_count} target classrooms.")

        # 3. Ingestion seeding (Mock Student registrations and Schedule)
        # We will create 2 subjects: "Computer Networks" and "Software Engineering"
        # We scheduled them in the same slot: 2026-07-06 at 10:00 AM - 01:00 PM
        cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
        
        # Schedule slot
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Computer Networks"))
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Software Engineering"))
        
        # 15 Students for Computer Networks
        for i in range(1, 16):
            roll = f"23711A05{str(i).zfill(2)}"
            cursor.execute("""
                INSERT INTO student_registrations (session_id, roll_number, subject)
                VALUES (?, ?, ?)
            """, (session_id, roll, "Computer Networks"))
            
        # 14 Students for Software Engineering
        for i in range(1, 15):
            roll = f"23711A12{str(i).zfill(2)}"
            cursor.execute("""
                INSERT INTO student_registrations (session_id, roll_number, subject)
                VALUES (?, ?, ?)
            """, (session_id, roll, "Software Engineering"))
            
        conn.commit()
        print("[Pass] Ingested 15 CN students, 14 SE students scheduled in the same slot.")

        # 4. Run Seating Allocation Algorithm
        res = run_12_12_allocation(session_id, "2026-07-06", "10:00 AM - 01:00 PM", conn)
        assert res["success"] is True, "Allocation failed"
        
        # Let's check allocations
        room_allocations = res["room_allocations"]
        print(f"Planner used {res['total_rooms_used']} rooms.")
        print(f"Students placed: {res['total_students_allocated']}. Leftovers: {res['total_leftovers']}")
        
        assert res["total_students_allocated"] == 29, "Expected 29 students allocated"
        assert res["total_leftovers"] == 0, "Expected 0 leftover students"
        
        # Verify room properties and checkerboard adjacency constraints
        for room in room_allocations:
            seats = room["seats"]
            assert len(seats) == 24, "Expected 24 seats in room"
            
            # Check adjacency constraints
            # (row + col) % 2 determines Checkerboard
            for i in range(24):
                row = i % 6
                col = i // 6
                current_seat = seats[i]
                
                if current_seat:
                    # Let's check adjacents: Row-1, Row+1, Col-1, Col+1
                    adjacents = []
                    if row > 0:
                        adjacents.append(seats[(col) * 6 + (row - 1)])
                    if row < 5:
                        adjacents.append(seats[(col) * 6 + (row + 1)])
                    if col > 0:
                        adjacents.append(seats[(col - 1) * 6 + row])
                    if col < 3:
                        adjacents.append(seats[(col + 1) * 6 + row])
                        
                    for adj in adjacents:
                        if adj:
                            # Verify different subjects
                            assert adj["subject"] != current_seat["subject"], \
                                f"Adjacency violation in room {room['room_name']}! Seat {i} has subject {current_seat['subject']} adjacent to seat with subject {adj['subject']}"
                                
        print("[Pass] Mixed-seating checkerboard constraint validated: NO adjacent seats share the same subject!")

        # 5. Commit Seating layouts to Database test
        commit_res = commit_allocation(session_id, res, conn)
        assert commit_res["success"] is True, "Database commit failed"
        
        # Verify db records in seating_ranges
        cursor.execute("""
            SELECT COUNT(*) FROM seating_ranges 
            WHERE session_id = ? AND exam_date = '2026-07-06'
        """, (session_id,))
        ranges_count = cursor.fetchone()[0]
        # Since we use 2 rooms and commit 24 ranges (either occupied or Empty) per room, total should be 48 ranges
        assert ranges_count == 48, f"Expected 48 ranges written to DB, got {ranges_count}"
        print(f"[Pass] Database write verified. Committed {ranges_count} seat ranges to seating_ranges table.")
        
        # 6. Mismatched Subject Parentheses Test (UHV test)
        # Reset test session tables
        cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM seating_ranges WHERE session_id = ?", (session_id,))
        
        # Schedule: "Universal Human Values (UHV)"
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Universal Human Values (UHV)"))
        # Schedule: "Discrete Mathematics"
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Discrete Mathematics"))
        
        # 12 Students registered for "Universal Human Values" (WITHOUT the (UHV) suffix)
        for i in range(1, 13):
            roll = f"24691A31{str(i).zfill(2)}"
            cursor.execute("""
                INSERT INTO student_registrations (session_id, roll_number, subject)
                VALUES (?, ?, ?)
            """, (session_id, roll, "Universal Human Values"))
            
        # 12 Students registered for "Discrete Mathematics"
        for i in range(13, 25):
            roll = f"24691A31{str(i).zfill(2)}"
            cursor.execute("""
                INSERT INTO student_registrations (session_id, roll_number, subject)
                VALUES (?, ?, ?)
            """, (session_id, roll, "Discrete Mathematics"))
            
        conn.commit()
        
        res = run_12_12_allocation(session_id, "2026-07-06", "10:00 AM - 01:00 PM", conn)
        assert res["success"] is True, "Fuzzy subject allocation failed"
        assert res["total_students_allocated"] == 24, f"Expected 24 students allocated, got {res['total_students_allocated']}"
        assert res["total_leftovers"] == 0, f"Expected 0 leftovers, got {res['total_leftovers']}"
        print("[Pass] Mismatched/Parenthesized subject matching test PASSED successfully!")
        
        # 7. 48 Capacity Seating Allocation Test (2 students per bench)
        # Reset test session tables
        cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM seating_ranges WHERE session_id = ?", (session_id,))
        
        # Schedule: "Universal Human Values (UHV)"
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Universal Human Values (UHV)"))
        # Schedule: "Discrete Mathematics"
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Discrete Mathematics"))
        
        # 30 Students registered for "Universal Human Values"
        for i in range(1, 31):
            roll = f"24691A31{str(i).zfill(2)}"
            cursor.execute("""
                INSERT INTO student_registrations (session_id, roll_number, subject)
                VALUES (?, ?, ?)
            """, (session_id, roll, "Universal Human Values"))
            
        # 30 Students registered for "Discrete Mathematics"
        for i in range(31, 61):
            roll = f"24691A31{str(i).zfill(2)}"
            cursor.execute("""
                INSERT INTO student_registrations (session_id, roll_number, subject)
                VALUES (?, ?, ?)
            """, (session_id, roll, "Discrete Mathematics"))
            
        conn.commit()
        
        res = run_12_12_allocation(session_id, "2026-07-06", "10:00 AM - 01:00 PM", conn, students_per_bench=2)
        assert res["success"] is True, "48 capacity seating allocation failed"
        
        # We have 60 students. Capacity per room is 48.
        # Room 1: 24 UHV + 24 DM = 48 students.
        # Room 2: 6 UHV + 6 DM = 12 students.
        # Total placed: 60 students.
        assert res["total_students_allocated"] == 60, f"Expected 60 students allocated, got {res['total_students_allocated']}"
        assert res["total_leftovers"] == 0, f"Expected 0 leftovers, got {res['total_leftovers']}"
        
        # Verify 3D checkerboard layout for Room 1
        room_1 = res["room_allocations"][0]
        seats = room_1["seats"]
        assert len(seats) == 48, f"Expected 48 seats in room 1, got {len(seats)}"
        
        # Check that Left and Right seats on every bench have different subjects
        for i in range(48):
            col = i // 12
            row = (i % 12) // 2
            side = (i % 12) % 2
            
            # Adjacency checks
            # Same bench mate: side is 0 vs 1
            mate_idx = i + 1 if side == 0 else i - 1
            if seats[i] and seats[mate_idx]:
                assert seats[i]["subject"] != seats[mate_idx]["subject"], \
                    f"Same bench mate adjacency violation at index {i} vs {mate_idx}!"
                    
        print("[Pass] 48 Capacity (2 per bench) seating allocation and checkerboard layout test PASSED successfully!")
        
        # Test 8: Verify tolerant subject matching with department prefixes
        cursor.execute("DELETE FROM student_registrations WHERE session_id = ?", (session_id,))
        cursor.execute("DELETE FROM exam_schedules WHERE session_id = ?", (session_id,))
        
        # Schedule with department prefix
        cursor.execute("""
            INSERT INTO exam_schedules (session_id, exam_date, exam_time, subject)
            VALUES (?, ?, ?, ?)
        """, (session_id, "2026-07-06", "10:00 AM - 01:00 PM", "Computer Science and Engineering (CSE) Machine Learning"))
        
        # Registration without department prefix
        cursor.execute("""
            INSERT INTO student_registrations (session_id, roll_number, subject)
            VALUES (?, ?, ?)
        """, (session_id, "24691A0501", "Machine Learning"))
        
        conn.commit()
        
        res = run_12_12_allocation(session_id, "2026-07-06", "10:00 AM - 01:00 PM", conn)
        assert res["success"] is True, "Department-prefixed subject matching allocation failed"
        assert res["total_students_allocated"] == 1, f"Expected 1 student allocated, got {res['total_students_allocated']}"
        print("[Pass] Department-prefixed subject matching test PASSED successfully!")
        
        # Clean up test session
        cursor.execute("DELETE FROM sessions WHERE id = 999")
        conn.commit()
        print("[Pass] Clean up completed.")
        
    except AssertionError as ae:
        print(f"[Fail] Assertion failed: {ae}")
        conn.close()
        sys.exit(1)
    except Exception as e:
        print(f"[Fail] Unexpected error: {e}")
        conn.close()
        sys.exit(1)
        
    conn.close()
    print("------------------------------------------------------")
    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
