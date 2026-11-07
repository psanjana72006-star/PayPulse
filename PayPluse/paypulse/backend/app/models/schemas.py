from pydantic import BaseModel
class InvoiceIn(BaseModel):
    number: str; customer: str; invoice_date: str; due_date: str
    amount: float; status: str = "Pending"
