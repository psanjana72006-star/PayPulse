"""Add a university's first admin:  python -m app.cli ORG-KA0001 --admin-id A1 --admin-name "Registrar" --admin-phone +919876543210
List university codes:           python -m app.cli list"""
import argparse
from .main import Base, engine, Session_, Org, new_user, select, seed
p = argparse.ArgumentParser(); p.add_argument("code")
p.add_argument("--admin-id"); p.add_argument("--admin-name"); p.add_argument("--admin-phone"); a = p.parse_args()
Base.metadata.create_all(engine); seed()
with Session_() as db:
    if a.code == "list":
        for o in db.scalars(select(Org)): print(o.code, o.name, "-", o.city)
        raise SystemExit
    org = db.scalar(select(Org).where(Org.code == a.code.upper()))
    if not org or not (a.admin_id and a.admin_name and a.admin_phone): raise SystemExit("Unknown code, or --admin-id/--admin-name/--admin-phone missing. Run: python -m app.cli list")
    new_user(db, org, a.admin_id, a.admin_name, "admin", a.admin_phone); db.commit()
print(f"Admin added to {org.name}. They sign in on the Admin login with that phone number.")
