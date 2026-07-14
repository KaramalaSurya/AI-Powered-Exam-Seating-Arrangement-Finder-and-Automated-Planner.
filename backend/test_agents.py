import unittest
import sqlite3
import os
import shutil
from backend.agents import SeatMappingAgent, ValidationAgent
from backend.database import get_db_connection, init_db, DATABASE_FILE

class TestSeatingLogic(unittest.TestCase):
    
    def test_seating_coordinates_column_wise(self):
        """Test column_wise filling strategy coordinates calculation."""
        # Setup: 6 rows, 4 columns, 2 students per bench (total 48 seats)
        room_meta = {
            "rows": 6,
            "columns": 4,
            "filling_strategy": "column_wise",
            "students_per_bench": 2
        }
        
        # We have one range of 20 students, starting at roll 23711A0501
        ranges = [
            {
                "roll_prefix": "23711A05",
                "start_num": 1,
                "end_num": 20,
                "block": "CSE Block",
                "room_name": "401",
                "exam_date": "2026-07-06",
                "exam_time": "10:00 AM",
                "subject": "CN",
                "order_index": 0
            }
        ]
        
        # Test student 1 (Roll: 23711A0501 -> Offset: 0)
        # Should be Row 0, Column 0, Left side
        res = SeatMappingAgent.map_student_to_seat("23711A0501", ranges, room_meta)
        self.assertEqual(res["row"], 0)
        self.assertEqual(res["column"], 0)
        self.assertEqual(res["side"], "Left")
        self.assertEqual(res["seat_number"], 1)

        # Test student 2 (Roll: 23711A0502 -> Offset: 1)
        # Should be Row 0, Column 0, Right side
        res = SeatMappingAgent.map_student_to_seat("23711A0502", ranges, room_meta)
        self.assertEqual(res["row"], 0)
        self.assertEqual(res["column"], 0)
        self.assertEqual(res["side"], "Right")
        self.assertEqual(res["seat_number"], 2)

        # Test student 3 (Roll: 23711A0503 -> Offset: 2)
        # Should be Row 1, Column 0, Left side
        res = SeatMappingAgent.map_student_to_seat("23711A0503", ranges, room_meta)
        self.assertEqual(res["row"], 1)
        self.assertEqual(res["column"], 0)
        self.assertEqual(res["side"], "Left")

        # Test student 13 (Roll: 23711A0513 -> Offset: 12)
        # One column holds 6 rows * 2 students = 12 seats (0 to 11).
        # Offset 12 should shift to Column 1, Row 0, Left side.
        res = SeatMappingAgent.map_student_to_seat("23711A0513", ranges, room_meta)
        self.assertEqual(res["row"], 0)
        self.assertEqual(res["column"], 1)
        self.assertEqual(res["side"], "Left")

    def test_seating_coordinates_row_wise(self):
        """Test row_wise filling strategy coordinates calculation."""
        room_meta = {
            "rows": 6,
            "columns": 4,
            "filling_strategy": "row_wise",
            "students_per_bench": 2
        }
        
        ranges = [
            {
                "roll_prefix": "23711A05",
                "start_num": 1,
                "end_num": 20,
                "block": "CSE Block",
                "room_name": "401",
                "exam_date": "2026-07-06",
                "exam_time": "10:00 AM",
                "subject": "CN",
                "order_index": 0
            }
        ]
        
        # Test student 1 (Roll: 23711A0501 -> Offset: 0)
        # Should be Row 0, Column 0, Left side
        res = SeatMappingAgent.map_student_to_seat("23711A0501", ranges, room_meta)
        self.assertEqual(res["row"], 0)
        self.assertEqual(res["column"], 0)
        self.assertEqual(res["side"], "Left")

        # Test student 9 (Roll: 23711A0509 -> Offset: 8)
        # One row holds 4 columns * 2 students = 8 seats (0 to 7).
        # Offset 8 should shift to Row 1, Column 0, Left side.
        res = SeatMappingAgent.map_student_to_seat("23711A0509", ranges, room_meta)
        self.assertEqual(res["row"], 1)
        self.assertEqual(res["column"], 0)
        self.assertEqual(res["side"], "Left")

    def test_validation_agent(self):
        """Test error validation checks for overlaps."""
        bad_data = [
            # Two ranges of same prefix overlap in Room 401
            {
                "block": "CSE Block", "room_name": "401", "rows": 6, "columns": 4, "filling_strategy": "column_wise",
                "roll_prefix": "23711A05", "start_num": 1, "end_num": 20, "padding": 2,
                "exam_date": "2026-07-06", "exam_time": "10:00 AM", "subject": "CN"
            },
            {
                "block": "CSE Block", "room_name": "401", "rows": 6, "columns": 4, "filling_strategy": "column_wise",
                "roll_prefix": "23711A05", "start_num": 15, "end_num": 30, "padding": 2,
                "exam_date": "2026-07-06", "exam_time": "10:00 AM", "subject": "CN"
            }
        ]
        
        results = ValidationAgent.validate_arrangements(bad_data)
        self.assertFalse(results["is_valid"])
        self.assertTrue(any("overlapping" in err for err in results["errors"]))

        # Capacity overflow warning check
        over_capacity = [
            {
                "block": "CSE Block", "room_name": "403", "rows": 2, "columns": 2, "filling_strategy": "column_wise",
                "roll_prefix": "23711A05", "start_num": 1, "end_num": 10, "padding": 2,
                "exam_date": "2026-07-06", "exam_time": "10:00 AM", "subject": "CN"
            } # Size = 10. Room Capacity = 2 * 2 * 2 = 8.
        ]
        results_cap = ValidationAgent.validate_arrangements(over_capacity)
        self.assertTrue(results_cap["is_valid"])
        self.assertTrue(any("capacity warning" in warn for warn in results_cap["warnings"]))

    def test_seating_coordinates_single_student_per_bench(self):
        """Test coordinate mapping when there is 1 student per bench."""
        room_meta = {
            "rows": 6,
            "columns": 4,
            "filling_strategy": "column_wise",
            "students_per_bench": 1
        }
        
        ranges = [
            {
                "roll_prefix": "23711A05",
                "start_num": 1,
                "end_num": 10,
                "block": "CSE Block",
                "room_name": "401",
                "exam_date": "2026-07-06",
                "exam_time": "10:00 AM",
                "subject": "CN",
                "order_index": 0
            }
        ]
        
        # Test student 1 (Roll: 23711A0501 -> Offset: 0)
        # Should be Row 0, Column 0, Left side
        res = SeatMappingAgent.map_student_to_seat("23711A0501", ranges, room_meta)
        self.assertEqual(res["row"], 0)
        self.assertEqual(res["column"], 0)
        self.assertEqual(res["side"], "Left")
        self.assertEqual(res["seat_number"], 1)

        # Test student 7 (Roll: 23711A0507 -> Offset: 6)
        # One column holds 6 rows * 1 student = 6 seats (0 to 5).
        # Offset 6 should shift to Column 1, Row 0.
        res = SeatMappingAgent.map_student_to_seat("23711A0507", ranges, room_meta)
        self.assertEqual(res["row"], 0)
        self.assertEqual(res["column"], 1)
        self.assertEqual(res["side"], "Left")

if __name__ == "__main__":
    unittest.main()
