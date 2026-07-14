# seeding.py
import sqlite3

MITS_ROOMS = [
    # East Block (EB)
    # Ground Floor
    ("East Block (EB)", "EB-011"),
    ("East Block (EB)", "EB-012"),
    ("East Block (EB)", "EB-013"),
    ("East Block (EB)", "EB-014"),
    ("East Block (EB)", "EB-015"),
    # First Floor
    ("East Block (EB)", "EB-102"),
    ("East Block (EB)", "EB-105"),
    ("East Block (EB)", "EB-105A"),
    ("East Block (EB)", "EB-106"),
    ("East Block (EB)", "EB-107"),
    ("East Block (EB)", "EB-115"),
    # Second Floor
    ("East Block (EB)", "EB-210"),
    ("East Block (EB)", "EB-211"),
    ("East Block (EB)", "EB-212"),
    ("East Block (EB)", "EB-213"),
    ("East Block (EB)", "EB-214"),
    ("East Block (EB)", "EB-217"),
    ("East Block (EB)", "EB-219"),

    # West Block (WB)
    # First Floor
    ("West Block (WB)", "WB-103"),
    ("West Block (WB)", "WB-107"),
    ("West Block (WB)", "WB-108"),
    ("West Block (WB)", "WB-109"),
    ("West Block (WB)", "WB-110"),
    ("West Block (WB)", "WB-117"),
    ("West Block (WB)", "WB-118"),
    ("West Block (WB)", "WB-121"),
    ("West Block (WB)", "WB-122"),
    # Second Floor
    ("West Block (WB)", "WB-202"),
    ("West Block (WB)", "WB-203"),
    ("West Block (WB)", "WB-207"),
    ("West Block (WB)", "WB-208"),
    ("West Block (WB)", "WB-209"),
    ("West Block (WB)", "WB-210"),
    ("West Block (WB)", "WB-211A"),
    ("West Block (WB)", "WB-215"),
    ("West Block (WB)", "WB-216"),
    ("West Block (WB)", "WB-217"),
    ("West Block (WB)", "WB-218"),
    ("West Block (WB)", "WB-221"),
    # Third Floor
    ("West Block (WB)", "WB-302"),
    ("West Block (WB)", "WB-303"),
    ("West Block (WB)", "WB-308"),
    ("West Block (WB)", "WB-309"),
    ("West Block (WB)", "WB-310"),
    ("West Block (WB)", "WB-311"),
    ("West Block (WB)", "WB-314"),
    ("West Block (WB)", "WB-315"),
    ("West Block (WB)", "WB-316"),
    ("West Block (WB)", "WB-317"),
    ("West Block (WB)", "WB-320"),
    ("West Block (WB)", "WB-321"),
    ("West Block (WB)", "WB-322"),

    # South Block (SB)
    # Ground Floor
    ("South Block (SB)", "SB-011"),
    # First Floor
    ("South Block (SB)", "SB-112"),
    ("South Block (SB)", "SB-113"),
    ("South Block (SB)", "SB-114"),
    ("South Block (SB)", "SB-115"),
    ("South Block (SB)", "SB-116"),
    ("South Block (SB)", "SB-117"),
    ("South Block (SB)", "SB-118"),
    ("South Block (SB)", "SB-119"),
    # Second Floor
    ("South Block (SB)", "SB-207"),
    ("South Block (SB)", "SB-208"),
    ("South Block (SB)", "SB-209"),
    ("South Block (SB)", "SB-210"),
    ("South Block (SB)", "SB-212"),
    ("South Block (SB)", "SB-213"),
    ("South Block (SB)", "SB-214"),
    ("South Block (SB)", "SB-215"),
    ("South Block (SB)", "SB-216"),
    ("South Block (SB)", "SB-217"),
    ("South Block (SB)", "SB-218"),
    ("South Block (SB)", "SB-219"),
    # Third Floor
    ("South Block (SB)", "SB-302"),
    ("South Block (SB)", "SB-303"),
    ("South Block (SB)", "SB-304"),
    ("South Block (SB)", "SB-305"),
    ("South Block (SB)", "SB-306"),
    ("South Block (SB)", "SB-308"),
    ("South Block (SB)", "SB-310"),
    ("South Block (SB)", "SB-311"),
    ("South Block (SB)", "SB-312"),
    ("South Block (SB)", "SB-313"),
    ("South Block (SB)", "SB-314"),
    ("South Block (SB)", "SB-315"),
]

def seed_mits_rooms(session_id: int, conn: sqlite3.Connection):
    """
    Seeds the 68 MITS classrooms into the rooms table under the given session_id.
    Standard seating configuration is 6 rows, 4 columns, capacity 24, single bench student.
    """
    cursor = conn.cursor()
    
    # Rows=6, Cols=4, benches=1, students_per_bench=1, strategy=column_wise, cap=24
    rooms_data = [
        (session_id, block, room_name, 6, 4, 1, 1, 'column_wise', 24)
        for block, room_name in MITS_ROOMS
    ]
    
    # We use INSERT OR REPLACE. Since session_id, block, room_name is UNIQUE,
    # this will reset them to standard capacity.
    cursor.executemany("""
        INSERT OR REPLACE INTO rooms (session_id, block, room_name, rows, columns, benches_per_row, students_per_bench, filling_strategy, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rooms_data)
    
    conn.commit()
