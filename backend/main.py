import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
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
