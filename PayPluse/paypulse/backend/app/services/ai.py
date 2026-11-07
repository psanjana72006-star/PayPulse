"""Simulated AI layer. Replace function bodies with real OCR/LLM calls using keys from env."""
import random
def fake_ocr(filename: str) -> dict:
    return {"customer": "Sharma Textiles", "number": f"INV-{random.randint(1030, 1999)}",
            "amount": 75000, "invoice_date": "2026-10-20", "due_date": "2026-11-19", "source": filename}

def reminder(stage: int, number: str, amount: float, customer: str = "Customer") -> str:
    amt = f"₹{amount:,.0f}"
    if stage == 1:
        return (f"Dear {customer},\n\nThis is a friendly reminder regarding invoice {number} amounting to {amt}, "
                "which is due for payment.\n\nWe kindly request you to process the payment at your earliest convenience.\n\nThank you for your cooperation.")
    if stage == 2:
        return f"Dear {customer},\n\nInvoice {number} ({amt}) is now past its due date. Please confirm when we can expect payment."
    return (f"DRAFT FOR REVIEW. Not legal advice.\n\nDear {customer},\n\nInvoice {number} ({amt}) remains unpaid after repeated follow-ups. "
            "Please settle it within 7 days or contact us to discuss. Have a professional review this draft before sending.")

def forecast(days: int = 7):
    bal, out = 150000, []
    for d in range(1, days + 1):
        inflow = 25000 if d % 3 == 0 else 8000
        outflow = 22000 if d % 4 == 0 else 9000
        bal += inflow - outflow
        out.append({"day": f"D{d}", "inflow": inflow, "outflow": outflow, "balance": bal})
    return out
