import os
import sys
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# Add backend directory's parent to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ingestion import parse_student_pin_list

def create_test_students_pdf():
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.drawString(100, 750, "Student Registration / PIN List")
    can.drawString(100, 720, "Subject: Universal Human Values (UHV)")
    can.drawString(100, 700, "1. 24691A3101")
    can.drawString(100, 685, "2. 24691A3102")
    can.drawString(100, 650, "Subject: Discrete Mathematics")
    can.drawString(100, 630, "1. 24691A3166")
    can.drawString(100, 615, "2. 25695A3101")
    can.save()
    packet.seek(0)
    return packet.read()

def test_parsing():
    print("Generating mock student PDF...")
    pdf_bytes = create_test_students_pdf()
    
    print("Parsing student PDF...")
    students = parse_student_pin_list(pdf_bytes, "test_students.pdf")
    
    print(f"Parsed {len(students)} students:")
    for s in students:
        print(f"Roll: {s['roll_number']}, Subject: {s['subject']}")
        
    assert len(students) == 4, f"Expected 4 students, got {len(students)}"
    assert students[0]['subject'] == "Universal Human Values (UHV)", f"Expected 'Universal Human Values (UHV)', got '{students[0]['subject']}'"
    assert students[2]['subject'] == "Discrete Mathematics", f"Expected 'Discrete Mathematics', got '{students[2]['subject']}'"
    
    print("All student list parsing tests with parentheses PASSED successfully!")

if __name__ == "__main__":
    test_parsing()
