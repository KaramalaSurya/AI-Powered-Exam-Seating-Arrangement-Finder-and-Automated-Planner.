# MITS Seating Arrangement Finder & Automated Planner

An AI-powered, high-performance examination seating arrangement coordinator and public student finder portal. This application streamlines institutional exam coordination through automated mixed-subject checkerboard seat planning, AI document digitisation, multi-session active searches, and visual door chart generation.

---

## 🌟 Key Features

1. **"12-12" Mixed Seating Planner**: Pairs and distributes students of two different subjects horizontally and vertically to prevent academic malpractice.
2. **3D Checkerboard Grid Logic**: Automatically spaces seat allocations on double-benches side-by-side (Left vs Right) using the spatial coordinate formula:
   $$\text{Seat Index} = (\text{row} + \text{col} + \text{side}) \bmod 2$$
3. **Dynamic Classroom Capacities**: Supports customizable seat configs:
   * **1 Student per Bench (24/room capacity)**.
   * **2 Students per Bench (48/room capacity)** with automatic bench-mate subject separation.
4. **AI-Powered Notice Ingestion**: Upload scanned physical seating charts and board lists. The system digitizes them using **Google Gemini Pro Vision OCR** and maps them to active database seating ranges.
5. **Multi-Session Active Search**: Allows the administrator to toggle **multiple exam sessions active concurrently**. The student finder lookup scans across all active sessions in parallel.
6. **O(1) Direct Bounds Search Lookup**: High-speed search performance (**3.76 ms** response time) utilizing direct alphanumeric bounds evaluation.
7. **Automated Door Chart Rendering**: Generates print-ready PDFs showing split-bench cards colored by subject using **ReportLab**.

---

## 🛠️ Technology Stack

* **Backend**: Python 3.10+, FastAPI, SQLite (sqlite3), ReportLab, pdfplumber, openpyxl.
* **Frontend**: React.js, Vite, Lucide Icons, Vanilla CSS Variables.
* **AI Integration**: Google Gemini API.

---

## 📂 Project Structure

```text
├── backend/
│   ├── main.py                    # FastAPI entry point & lifespan handler
│   ├── routes.py                  # API endpoints (seating search, sessions, planner)
│   ├── database.py                # Database connection, schemas, and seeding
│   ├── allocation.py              # Seating Planner algorithm (12-12 mixed seating)
│   ├── ingestion.py               # Document extraction (PDF / Excel parsing)
│   ├── reports.py                 # ReportLab PDF door charts rendering engine
│   ├── agents.py                  # Gemini AI Orchestrator & SeatMappingAgent
│   ├── requirements.txt           # Backend python dependencies
│   └── mits_exam.db               # SQLite database file
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminPortal.jsx    # UI for uploads, planners, and sessions
│   │   │   └── StudentFinder.jsx  # UI for student seating search lookup
│   │   ├── App.jsx                # Client-side router and theme shell
│   │   └── index.css              # Glassmorphic design system and styling
│   └── package.json               # Frontend React dependencies
└── README.md                      # Project manual
```

---

## 🚀 Installation & Setup

### 1. Backend Setup
1. Navigate to the backend workspace directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database initialization and seeds:
   ```bash
   python -c "from backend.database import init_db; init_db()"
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```

---

## 🏃 Running the Application

For development, run both the backend server and frontend client concurrently:

### Run Backend API Server
In the root directory, activate the Python virtual environment and launch:
```bash
python -m backend.main
```
The FastAPI documentation will be available at `http://localhost:8085/docs`.

### Run Frontend Client
In the `frontend` folder, execute the Vite development command:
```bash
npm run dev
```
The web portal will open at `http://localhost:5173`.

---

## 🧪 Testing

The backend includes tests for validation logic and checkerboard algorithms.

* Run seating allocation checkerboard tests:
  ```bash
  python backend/test_allocation.py
  ```
* Run parsing and OCR agent tests:
  ```bash
  python -m backend.test_agents
  ```
