import sqlite3, os
from datetime import date, timedelta
DB = os.getenv("DATABASE_URL", "sqlite:///./paypulse.db").replace("sqlite:///", "")

def conn():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def init():
    c = conn()
    c.execute("""CREATE TABLE IF NOT EXISTS invoices(
      id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT, customer TEXT,
      invoice_date TEXT, due_date TEXT, amount REAL, status TEXT)""")
    if c.execute("SELECT COUNT(*) FROM invoices").fetchone()[0] == 0:
        t = date.today(); d = lambda n: (t + timedelta(days=n)).isoformat()
        rows = [("INV-1024","ABC Enterprises",d(-40),d(-10),45000,"Overdue"),
                ("INV-1025","Sharma Textiles",d(-30),d(-2),80000,"Overdue"),
                ("INV-1026","Kaveri Foods",d(-20),d(10),120000,"Pending"),
                ("INV-1027","Metro Retail",d(-15),d(15),60000,"Pending"),
                ("INV-1028","Lotus Traders",d(-50),d(-20),90000,"Paid"),
                ("INV-1029","Bharat Auto Parts",d(-10),d(20),100000,"Financing Requested")]
        c.executemany("INSERT INTO invoices(number,customer,invoice_date,due_date,amount,status) VALUES(?,?,?,?,?,?)", rows)
    c.commit(); c.close()
