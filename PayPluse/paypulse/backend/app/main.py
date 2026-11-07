import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.db import init
from app.routes import invoices, ai
app = FastAPI(title="PayPulse API")
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
                   allow_methods=["*"], allow_headers=["*"])
@app.on_event("startup")
def startup(): init()
app.include_router(invoices.router); app.include_router(ai.router)
@app.get("/api/health")
def health(): return {"ok": True}
