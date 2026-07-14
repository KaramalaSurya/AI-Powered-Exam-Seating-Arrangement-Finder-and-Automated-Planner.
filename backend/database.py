import sqlite3
import os

DATABASE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mits_exam.db")

def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. Rooms table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        block TEXT NOT NULL,
        room_name TEXT NOT NULL,
        rows INTEGER NOT NULL,
        columns INTEGER NOT NULL,
        benches_per_row INTEGER DEFAULT 1,
        students_per_bench INTEGER DEFAULT 1,
        filling_strategy TEXT DEFAULT 'column_wise',
        capacity INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE(session_id, block, room_name)
    )
    """)
    
    # 3. Seating Ranges table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS seating_ranges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        roll_prefix TEXT NOT NULL,
        start_num TEXT NOT NULL,
        end_num TEXT NOT NULL,
        padding INTEGER DEFAULT 2,
        exam_date TEXT,
        exam_time TEXT,
        subject TEXT,
        order_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
    """)

    # 4. Settings table (for storing API keys and configs)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    
    # 5. Student Registrations table (completely additive)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_registrations (
        session_id INTEGER NOT NULL,
        roll_number TEXT NOT NULL,
        subject TEXT NOT NULL,
        PRIMARY KEY (session_id, roll_number, subject),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
    """)

    # 6. Exam Schedules table (completely additive)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS exam_schedules (
        session_id INTEGER NOT NULL,
        exam_date TEXT NOT NULL,
        exam_time TEXT NOT NULL,
        subject TEXT NOT NULL,
        PRIMARY KEY (session_id, exam_date, exam_time, subject),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
    """)
    
    # Insert default active session if not exists
    cursor.execute("SELECT COUNT(*) FROM sessions")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO sessions (name, is_active) VALUES ('Semester Exams - July 2026', 1)")
        session_id = cursor.lastrowid
        
        # Add some sample rooms
        sample_rooms = [
            (session_id, 'CSE Block (Block B)', '401', 6, 4, 1, 1, 'column_wise', 24),
            (session_id, 'CSE Block (Block B)', '402', 6, 4, 1, 2, 'column_wise', 48),
            (session_id, 'CSE Block (Block B)', '403', 5, 3, 1, 1, 'row_wise', 15),
            (session_id, 'Main Block (Block A)', '201', 6, 5, 1, 2, 'column_wise', 60),
            (session_id, 'Main Block (Block A)', '202', 6, 5, 1, 1, 'column_wise', 30)
        ]
        cursor.executemany("""
        INSERT INTO rooms (session_id, block, room_name, rows, columns, benches_per_row, students_per_bench, filling_strategy, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_rooms)
        
        # Add some sample seating ranges
        # Let's assume Room 401 has 23711A0501 to 23711A0520 (CSE - 20 students)
        # and some other branch for the remaining 4 seats.
        cursor.execute("SELECT id FROM rooms WHERE room_name = '401'")
        room_401_id = cursor.fetchone()[0]
        
        cursor.execute("SELECT id FROM rooms WHERE room_name = '402'")
        room_402_id = cursor.fetchone()[0]

        cursor.execute("SELECT id FROM rooms WHERE room_name = '403'")
        room_403_id = cursor.fetchone()[0]

        sample_ranges = [
            (session_id, room_401_id, '23711A05', '01', '20', 2, '2026-07-06', '10:00 AM - 01:00 PM', 'Computer Networks', 0),
            (session_id, room_401_id, '23711A12', '01', '04', 2, '2026-07-06', '10:00 AM - 01:00 PM', 'Software Engineering', 20),
            (session_id, room_402_id, '23711A05', '21', '68', 2, '2026-07-06', '10:00 AM - 01:00 PM', 'Computer Networks', 0),
            (session_id, room_403_id, '23711A04', '01', '15', 2, '2026-07-06', '10:00 AM - 01:00 PM', 'Digital Signal Processing', 0)
        ]
        cursor.executemany("""
        INSERT INTO seating_ranges (session_id, room_id, roll_prefix, start_num, end_num, padding, exam_date, exam_time, subject, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_ranges)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
