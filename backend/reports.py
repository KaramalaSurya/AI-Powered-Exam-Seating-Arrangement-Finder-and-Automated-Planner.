# reports.py
import os
import sqlite3
from io import BytesIO
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def get_slot_seating_data(session_id: int, exam_date: str, exam_time: str, conn: sqlite3.Connection, block: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves all rooms and seating ranges allocated for a given session and slot.
    Returns a grouped structure of rooms, each containing 24 seat elements.
    """
    cursor = conn.cursor()
    
    # 1. Get rooms in this session that have seating ranges for this slot
    query = """
        SELECT DISTINCT r.id, r.block, r.room_name, r.rows, r.columns, r.capacity, r.filling_strategy
        FROM rooms r
        JOIN seating_ranges sr ON r.id = sr.room_id
        WHERE r.session_id = ? AND sr.exam_date = ? AND sr.exam_time = ?
    """
    params = [session_id, exam_date, exam_time]
    if block:
        query += " AND r.block = ?"
        params.append(block)
    query += " ORDER BY r.block, r.room_name"
    
    cursor.execute(query, params)
    
    rooms = [dict(row) for row in cursor.fetchall()]
    
    room_seating_list = []
    
    for room in rooms:
        # Get ranges for this room sorted by order_index
        cursor.execute("""
            SELECT roll_prefix, start_num, end_num, subject, order_index
            FROM seating_ranges
            WHERE room_id = ? AND exam_date = ? AND exam_time = ?
            ORDER BY order_index ASC
        """, (room["id"], exam_date, exam_time))
        
        ranges = [dict(row) for row in cursor.fetchall()]
        
        # Expand ranges into a list of seats
        # (Since we write ranges aligning with capacity, this aligns perfectly)
        seats = [None] * room["capacity"]
        for r in ranges:
            idx = r["order_index"]
            if idx < room["capacity"]:
                prefix = r["roll_prefix"]
                start = r["start_num"]
                
                # If roll is Empty, represent as None (Empty seat)
                if start == "Empty" or prefix == "":
                    seats[idx] = None
                else:
                    seats[idx] = {
                        "roll_number": f"{prefix}{start}",
                        "subject": r["subject"]
                    }
                    
        room_seating_list.append({
            "room_id": room["id"],
            "block": room["block"],
            "room_name": room["room_name"],
            "rows": room["rows"],
            "columns": room["columns"],
            "capacity": room["capacity"],
            "seats": seats
        })
        
    return room_seating_list


def generate_door_charts_pdf(session_name: str, exam_date: str, exam_time: str, rooms_data: List[Dict[str, Any]]) -> bytes:
    """
    Generates a PDF containing 2D visual seating grid layouts for the door of each room.
    Uses reportlab.pdfgen.canvas to draw pixel-perfect maps.
    """
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4 # 595.27 x 841.89 points
    
    for r_idx, room in enumerate(rooms_data):
        # Draw border
        p.setStrokeColor(colors.HexColor("#3b82f6")) # Blue accent
        p.setLineWidth(2)
        p.rect(20, 20, width - 40, height - 40)
        
        # Header Box
        p.setFillColor(colors.HexColor("#1e3a8a")) # Dark blue
        p.rect(30, height - 100, width - 60, 70, fill=1, stroke=0)
        
        p.setFillColor(colors.white)
        p.setFont("Helvetica-Bold", 14)
        p.drawCentredString(width / 2.0, height - 55, "MADANAPALLE INSTITUTE OF TECHNOLOGY & SCIENCE")
        p.setFont("Helvetica", 10)
        p.drawCentredString(width / 2.0, height - 72, "(UGC-AUTONOMOUS)")
        p.setFont("Helvetica-Bold", 11)
        p.drawCentredString(width / 2.0, height - 90, "EXAMINATION ROOM SEATING CHART")
        
        # Info details
        p.setFillColor(colors.HexColor("#0f172a")) # Slate dark
        p.setFont("Helvetica-Bold", 12)
        p.drawString(35, height - 130, f"ROOM: {room['room_name']}")
        p.drawString(180, height - 130, f"BLOCK: {room['block']}")
        p.setFont("Helvetica", 10)
        p.drawRightString(width - 35, height - 130, f"Session: {session_name}")
        
        p.drawString(35, height - 150, f"Date: {exam_date}")
        p.drawString(180, height - 150, f"Time: {exam_time}")
        p.drawRightString(width - 35, height - 150, f"Total Seating Capacity: {room['capacity']}")
        
        # Draw blackboard/screen representer
        p.setStrokeColor(colors.HexColor("#64748b"))
        p.setFillColor(colors.HexColor("#f1f5f9"))
        p.rect(120, height - 200, width - 240, 25, fill=1, stroke=1)
        p.setFillColor(colors.HexColor("#475569"))
        p.setFont("Helvetica-Bold", 10)
        p.drawCentredString(width / 2.0, height - 193, "FRONT / BLACKBOARD / PROCTOR TABLE")
        
        # Seating Grid layout coordinates
        # 6 rows, 4 columns
        # Cell sizing
        cell_width = 115
        cell_height = 65
        grid_start_x = 45
        grid_start_y = height - 230
        
        gap_x = 15
        gap_y = 15
        
        # Grid seats A-B checkerboard filling
        for col_idx in range(4):
            for row_idx in range(6):
                # Calculate coordinates
                # X coordinate: col_idx * (cell_width + gap_x) + grid_start_x
                # Y coordinate: grid_start_y - (row_idx * (cell_height + gap_y)) - cell_height
                x = col_idx * (cell_width + gap_x) + grid_start_x
                y = grid_start_y - (row_idx * (cell_height + gap_y)) - cell_height
                
                is_two_per_bench = room["capacity"] == 48
                
                if is_two_per_bench:
                    # Draw two seats per bench side-by-side
                    left_idx = col_idx * 12 + row_idx * 2
                    right_idx = left_idx + 1
                    
                    half_width = cell_width / 2.0 - 2
                    
                    for s_idx, x_offset in [(left_idx, 0), (right_idx, cell_width / 2.0 + 2)]:
                        seat = room["seats"][s_idx] if s_idx < len(room["seats"]) else None
                        sx = x + x_offset
                        
                        if seat:
                            p.setStrokeColor(colors.HexColor("#cbd5e1"))
                            # Alternating color based on row + col + side
                            side_idx = 0 if s_idx == left_idx else 1
                            if (row_idx + col_idx + side_idx) % 2 == 0:
                                p.setFillColor(colors.HexColor("#eff6ff")) # Very light blue
                            else:
                                p.setFillColor(colors.HexColor("#f0fdf4")) # Very light green
                                
                            p.rect(sx, y, half_width, cell_height, fill=1, stroke=1)
                            
                            # Roll text
                            p.setFillColor(colors.HexColor("#1e293b"))
                            p.setFont("Helvetica-Bold", 8.5)
                            p.drawCentredString(sx + half_width/2.0, y + cell_height/2.0 + 5, seat["roll_number"])
                            
                            # Subject text
                            p.setFillColor(colors.HexColor("#64748b"))
                            p.setFont("Helvetica", 6.5)
                            subj_text = seat["subject"]
                            if len(subj_text) > 13:
                                subj_text = subj_text[:11] + ".."
                            p.drawCentredString(sx + half_width/2.0, y + cell_height/2.0 - 10, subj_text)
                            
                            # Seat label
                            p.setFillColor(colors.HexColor("#94a3b8"))
                            p.setFont("Helvetica", 5.5)
                            p.drawString(sx + 3, y + 4, f"S{s_idx + 1}")
                        else:
                            # Vacant half-bench
                            p.setStrokeColor(colors.HexColor("#cbd5e1"))
                            p.setDash(1.5, 1.5)
                            p.setFillColor(colors.HexColor("#f8fafc"))
                            p.rect(sx, y, half_width, cell_height, fill=1, stroke=1)
                            p.setDash()
                            
                            p.setFillColor(colors.HexColor("#94a3b8"))
                            p.setFont("Helvetica-Oblique", 7.5)
                            p.drawCentredString(sx + half_width/2.0, y + cell_height/2.0 - 2, "VACANT")
                            p.setFont("Helvetica", 5.5)
                            p.drawString(sx + 3, y + 4, f"S{s_idx + 1}")
                else:
                    # Draw single seat per bench (original logic)
                    seat_idx = col_idx * 6 + row_idx
                    seat = room["seats"][seat_idx] if seat_idx < len(room["seats"]) else None
                    
                    if seat:
                        # Draw occupied bench
                        p.setStrokeColor(colors.HexColor("#cbd5e1"))
                        # Alternating colors for visualization
                        row_col_sum = row_idx + col_idx
                        if row_col_sum % 2 == 0:
                            p.setFillColor(colors.HexColor("#eff6ff")) # Very light blue
                        else:
                            p.setFillColor(colors.HexColor("#f0fdf4")) # Very light green
                        
                        p.rect(x, y, cell_width, cell_height, fill=1, stroke=1)
                        
                        # Roll text
                        p.setFillColor(colors.HexColor("#1e293b"))
                        p.setFont("Helvetica-Bold", 11)
                        p.drawCentredString(x + cell_width/2.0, y + cell_height/2.0 + 5, seat["roll_number"])
                        
                        # Subject text
                        p.setFillColor(colors.HexColor("#64748b"))
                        p.setFont("Helvetica", 7.5)
                        # Truncate subject if long
                        subj_text = seat["subject"]
                        if len(subj_text) > 22:
                            subj_text = subj_text[:20] + ".."
                        p.drawCentredString(x + cell_width/2.0, y + cell_height/2.0 - 10, subj_text)
                        
                        # Seat number label
                        p.setFillColor(colors.HexColor("#94a3b8"))
                        p.setFont("Helvetica", 6.5)
                        p.drawString(x + 5, y + 5, f"Seat {seat_idx + 1}")
                    else:
                        # Draw empty bench
                        p.setStrokeColor(colors.HexColor("#cbd5e1"))
                        p.setDash(2, 2) # Dashed border
                        p.setFillColor(colors.HexColor("#f8fafc"))
                        p.rect(x, y, cell_width, cell_height, fill=1, stroke=1)
                        p.setDash() # Reset to solid
                        
                        p.setFillColor(colors.HexColor("#94a3b8"))
                        p.setFont("Helvetica-Oblique", 9)
                        p.drawCentredString(x + cell_width/2.0, y + cell_height/2.0 - 2, "VACANT")
                        p.setFont("Helvetica", 6.5)
                        p.drawString(x + 5, y + 5, f"Seat {seat_idx + 1}")
                    
        # Entrance Label at the bottom
        p.setFillColor(colors.HexColor("#f1f5f9"))
        p.setStrokeColor(colors.HexColor("#cbd5e1"))
        p.rect(width/2.0 - 50, 30, 100, 15, fill=1, stroke=1)
        p.setFillColor(colors.HexColor("#64748b"))
        p.setFont("Helvetica-Bold", 8)
        p.drawCentredString(width / 2.0, 34, "CLASSROOM ENTRANCE")
        
        # Show page
        p.showPage()
        
    p.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_master_allocation_pdf(session_name: str, exam_date: str, exam_time: str, rooms_data: List[Dict[str, Any]]) -> bytes:
    """
    Generates a master hall allocation summary PDF for notice boards.
    Groups occupied seats by subject & roll prefix, showing concise ranges per room.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        textColor=colors.HexColor("#1e3a8a"),
        alignment=1, # Centered
        spaceAfter=5
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        alignment=1, # Centered
        spaceAfter=15
    )
    table_text_style = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=10
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.white,
        leading=11
    )

    story = []
    
    # Titles
    story.append(Paragraph("MADANAPALLE INSTITUTE OF TECHNOLOGY & SCIENCE", title_style))
    story.append(Paragraph("(UGC-AUTONOMOUS) | OFFICE OF CONTROLLER OF EXAMINATIONS", ParagraphStyle('Sub', parent=subtitle_style, spaceAfter=2)))
    story.append(Paragraph(f"MASTER HALL ALLOCATION FOR NOTICE BOARDS", ParagraphStyle('SubBold', parent=title_style, fontSize=12, textColor=colors.HexColor("#0f172a"))))
    story.append(Paragraph(f"Exam Session: <b>{session_name}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Date: <b>{exam_date}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Time: <b>{exam_time}</b>", subtitle_style))
    
    # Table headers
    headers = [
        Paragraph("<b>Room</b>", table_header_style),
        Paragraph("<b>Block / Location</b>", table_header_style),
        Paragraph("<b>Subject & Roll Ranges Allocated</b>", table_header_style),
        Paragraph("<b>Total Seats</b>", table_header_style)
    ]
    
    table_data = [headers]
    
    for room in rooms_data:
        # Group rolls by subject and find ranges
        rolls_by_subject = {}
        for seat in room["seats"]:
            if seat:
                subj = seat["subject"]
                roll = seat["roll_number"]
                if subj not in rolls_by_subject:
                    rolls_by_subject[subj] = []
                rolls_by_subject[subj].append(roll)
                
        # Format the allocations block
        allocation_paragraphs = []
        total_students_in_room = 0
        
        for subj, rolls in rolls_by_subject.items():
            total_students_in_room += len(rolls)
            rolls.sort()
            
            # Simple range generation: find prefix and start/end suffixes
            # e.g. 23711A0501, 23711A0503, ...
            # Let's group rolls by their prefix (first 8 characters)
            groups = {}
            for r in rolls:
                prefix = r[:-2]
                suffix = r[-2:]
                if prefix not in groups:
                    groups[prefix] = []
                groups[prefix].append(suffix)
                
            range_strs = []
            for prefix, suffixes in groups.items():
                min_s = suffixes[0]
                max_s = suffixes[-1]
                if len(suffixes) == 1:
                    range_strs.append(f"{prefix}{min_s}")
                else:
                    range_strs.append(f"{prefix}{min_s} to {prefix}{max_s} (Alt)")
                    
            allocation_paragraphs.append(
                Paragraph(f"• <b>{subj}</b>: {', '.join(range_strs)} ({len(rolls)} Students)", table_text_style)
            )
            
        if not allocation_paragraphs:
            allocation_paragraphs.append(Paragraph("<i>No students allocated</i>", table_text_style))
            
        # Compile row
        # To avoid Flowable list formatting problems, we put paragraph objects in a list
        room_desc = Paragraph(f"<b>Room {room['room_name']}</b>", table_text_style)
        block_desc = Paragraph(room['block'], table_text_style)
        total_desc = Paragraph(f"<b>{total_students_in_room}</b>", ParagraphStyle('Cent', parent=table_text_style, alignment=1))
        
        # The range cell has a nested structure of Paragraphs
        range_cell_content = []
        for p in allocation_paragraphs:
            range_cell_content.append(p)
            
        table_data.append([room_desc, block_desc, range_cell_content, total_desc])
        
    # Build layout table
    # Columns widths: Room (70pt), Block (130pt), Ranges (280pt), Total (50pt)
    t = Table(table_data, colWidths=[70, 130, 285, 50])
    
    t_style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1e3a8a")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0,1), (-1,-1), 8),
        ('BOTTOMPADDING', (0,1), (-1,-1), 8),
        ('VALIGN', (2,1), (2,-1), 'TOP'), # Align ranges to top of cell
    ])
    t.setStyle(t_style)
    story.append(t)
    
    # Save document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_attendance_sheets_pdf(session_name: str, exam_date: str, exam_time: str, rooms_data: List[Dict[str, Any]]) -> bytes:
    """
    Generates a PDF of invigilator attendance sheets.
    Each page represents a classroom sheet with signature columns.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor("#0f172a"),
        alignment=1, # Centered
        spaceAfter=2
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        alignment=1, # Centered
        spaceAfter=10
    )
    table_text_style = ParagraphStyle(
        'TableText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=9
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=colors.white,
        leading=10
    )

    story = []
    
    for r_idx, room in enumerate(rooms_data):
        if r_idx > 0:
            story.append(PageBreak())
            
        story.append(Paragraph("MADANAPALLE INSTITUTE OF TECHNOLOGY & SCIENCE (UGC-AUTONOMOUS)", ParagraphStyle('Uni', parent=title_style, fontSize=10, textColor=colors.HexColor("#64748b"))))
        story.append(Paragraph("INVIGILATOR ATTENDANCE SIGNATURE SHEET", title_style))
        story.append(Paragraph(f"Session: {session_name} &nbsp;&nbsp;|&nbsp;&nbsp; Date: {exam_date} &nbsp;&nbsp;|&nbsp;&nbsp; Time: {exam_time}", subtitle_style))
        
        # Meta info details
        meta_table_data = [
            [
                Paragraph(f"<b>Room Name:</b> {room['room_name']}", table_text_style),
                Paragraph(f"<b>Block:</b> {room['block']}", table_text_style),
                Paragraph("<b>Invigilator Name:</b> ___________________", table_text_style)
            ],
            [
                Paragraph(f"<b>Total Capacity:</b> {room['capacity']}", table_text_style),
                Paragraph(f"<b>Students Present:</b> ________", table_text_style),
                Paragraph("<b>Invigilator Signature:</b> ________________", table_text_style)
            ]
        ]
        meta_table = Table(meta_table_data, colWidths=[150, 150, 235])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('LINEBELOW', (0,-1), (-1,-1), 1, colors.HexColor("#3b82f6")),
        ]))
        
        story.append(meta_table)
        story.append(Spacer(1, 10))
        
        # Table of students
        headers = [
            Paragraph("<b>Seat No</b>", table_header_style),
            Paragraph("<b>Roll Number</b>", table_header_style),
            Paragraph("<b>Subject Title</b>", table_header_style),
            Paragraph("<b>Student Signature</b>", table_header_style)
        ]
        
        student_table_data = [headers]
        
        for idx, seat in enumerate(room["seats"]):
            seat_no = Paragraph(f"<b>{idx + 1}</b>", ParagraphStyle('Cent', parent=table_text_style, alignment=1))
            
            if seat:
                roll = Paragraph(seat["roll_number"], table_text_style)
                subj = Paragraph(seat["subject"], table_text_style)
                sig = Paragraph("", table_text_style) # Empty for physical signature
            else:
                roll = Paragraph("<font color='#94a3b8'><i>VACANT</i></font>", table_text_style)
                subj = Paragraph("<font color='#94a3b8'><i>—</i></font>", table_text_style)
                sig = Paragraph("<font color='#e2e8f0'>N/A</font>", table_text_style)
                
            student_table_data.append([seat_no, roll, subj, sig])
            
        # Draw table
        # Columns widths: Seat (50pt), Roll (120pt), Subject (225pt), Signature (140pt)
        t = Table(student_table_data, colWidths=[50, 120, 225, 140])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        
        story.append(t)
        
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
