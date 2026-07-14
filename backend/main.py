import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db, get_db_connection
from backend.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and populate sample data if empty
    init_db()
    yield

app = FastAPI(
    title="AI-Powered MITS Exam Seating Arrangement Finder API",
    description="Backend services for parsing and querying student exam room seating grids.",
    version="1.0.0",
    lifespan=lifespan
)

@app.middleware("http")
async def admin_auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
        
    if request.url.path.startswith("/api/admin/") and request.url.path != "/api/admin/login":
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JSONResponse(status_code=401, content={"detail": "Authorization Header Missing"})
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(status_code=401, content={"detail": "Invalid header format. Use 'Bearer <token>'"})
        token = parts[1]
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'admin_password'")
        row = cursor.fetchone()
        conn.close()
        actual_pass = row["value"] if row else "admin123"
        
        if token != f"token-{actual_pass}":
            return JSONResponse(status_code=401, content={"detail": "Invalid or expired session token"})
            
    response = await call_next(request)
    return response

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(router, prefix="/api")

@app.get("/")
def home():
    return {
        "status": "online",
        "service": "MITS Exam Seating Arrangement Finder Backend",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8085, reload=True)
