from fastapi import APIRouter, UploadFile, File
from app.services import ai
router = APIRouter(prefix="/api/ai", tags=["ai"])

@router.post("/extract")
async def extract(file: UploadFile = File(...)): return ai.fake_ocr(file.filename)

@router.get("/reminder")
def reminder(stage: int, number: str, amount: float, customer: str = "Customer"):
    return {"stage": stage, "draft": True, "message": ai.reminder(stage, number, amount, customer)}

@router.get("/forecast")
def forecast(days: int = 7): return ai.forecast(days)
