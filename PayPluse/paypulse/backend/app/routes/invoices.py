from fastapi import APIRouter, HTTPException
from app.database.db import conn
from app.models.schemas import InvoiceIn
router = APIRouter(prefix="/api/invoices", tags=["invoices"])

@router.get("")
def list_invoices():
    c = conn(); r = [dict(x) for x in c.execute("SELECT * FROM invoices ORDER BY due_date")]; c.close(); return r

@router.get("/stats/summary")
def stats():
    c = conn(); rows = [dict(x) for x in c.execute("SELECT * FROM invoices")]; c.close()
    s = lambda f: sum(r["amount"] for r in rows if f(r))
    return {"total_receivables": s(lambda r: r["status"] != "Paid"),
            "overdue": s(lambda r: r["status"] == "Overdue"),
            "collected": s(lambda r: r["status"] == "Paid"),
            "active": len([r for r in rows if r["status"] != "Paid"])}

@router.post("", status_code=201)
def create(i: InvoiceIn):
    c = conn()
    cur = c.execute("INSERT INTO invoices(number,customer,invoice_date,due_date,amount,status) VALUES(?,?,?,?,?,?)",
        (i.number, i.customer, i.invoice_date, i.due_date, i.amount, i.status))
    c.commit(); c.close(); return {"id": cur.lastrowid, **i.model_dump()}

@router.put("/{iid}")
def update(iid: int, i: InvoiceIn):
    c = conn()
    cur = c.execute("UPDATE invoices SET number=?,customer=?,invoice_date=?,due_date=?,amount=?,status=? WHERE id=?",
        (i.number, i.customer, i.invoice_date, i.due_date, i.amount, i.status, iid))
    c.commit(); c.close()
    if cur.rowcount == 0: raise HTTPException(404, "Invoice not found")
    return {"id": iid, **i.model_dump()}

@router.delete("/{iid}")
def delete(iid: int):
    c = conn(); c.execute("DELETE FROM invoices WHERE id=?", (iid,)); c.commit(); c.close(); return {"deleted": iid}
