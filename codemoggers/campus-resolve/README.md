# ALL-CLEAR CAMPUS

## Run on your computer (demo)
    cd backend
    python -m venv .venv ; .venv\Scripts\activate        (Mac/Linux: source .venv/bin/activate)
    pip install -r requirements.txt
    python -m uvicorn app.main:app --reload
Open http://localhost:8000. Delete backend/campus.db first if you ran an older version.
Demo mode shows the SMS code on screen. Demo university: Bangalore University (the other 37 are empty until you add people).

## Demo phone numbers (pick the matching role on page 1)
Student +919000001001 | Teacher +919000001002 | Non-teaching +919000001003 | Alumni +919000001004 | Vendor +919000001005
Admin +919000001011 (Resolvers ...006-009, HOD ...010, Committee ...012 also use the Admin login)
Non-teaching QR demo: open http://localhost:8000/q/demo-badge-n7001 and enter PIN 1234.

## Go live worldwide
1. Rent a small server (2 GB RAM), point your domain's DNS to it, install Docker.
2. Copy .env.example to .env and fill it in (SECRET_KEY, DB_PASSWORD, Twilio keys). Keep DEV_MODE=0.
3. docker compose up -d --build   -> HTTPS is automatic. Voice recording needs HTTPS, so do not skip this.
4. Create each university's first admin:
   docker compose exec api python -m app.cli list
   docker compose exec api python -m app.cli ORG-KA0001 --admin-id A1 --admin-name "Registrar" --admin-phone +919876543210
5. The admin then adds people (API page /docs: POST /api/admin/users and /api/admin/users/import) and creates QR badges
   for non-teaching staff (POST /api/admin/users/{id}/badge returns the QR image and PIN to print on the ID card).
6. Back up the database and the uploads volume every night.
