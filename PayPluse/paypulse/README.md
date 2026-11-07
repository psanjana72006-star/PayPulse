# PayPulse (prototype)
## Backend
cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # API docs: http://localhost:8000/docs
## Frontend
cd frontend && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
The frontend reads VITE_API_URL (default http://localhost:8000). Demo data seeds on first backend start.
## Test
Open /app: KPIs come from the database. In Invoices: drop any file (simulated OCR), confirm, search, filter, change status, delete.
Reminder and forecast endpoints: /api/ai/reminder, /api/ai/forecast (see /docs).
