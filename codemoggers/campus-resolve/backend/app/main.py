"""Campus Resolve - Phase 1-3 backend (stages A-D, G-H, S, I-lite)."""
import os, io, re, csv, json, math, uuid, hmac, secrets, hashlib, random, datetime as dt
from pathlib import Path
import jwt, qrcode, qrcode.image.svg
from fastapi import FastAPI, Depends, HTTPException, Header, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, String, Integer, Boolean, DateTime, Text, ForeignKey, Float, select, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session
from .sms import send_sms

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./campus.db")
SECRET = os.getenv("SECRET_KEY", "dev-secret-change-me")
DEV = os.getenv("DEV_MODE", "1") == "1"
engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})
Session_ = sessionmaker(engine, expire_on_commit=False)
now = lambda: dt.datetime.utcnow()
def check(s): return "ABCDEFGHJKLMNPQRSTUVWXYZ"[sum(map(ord, s)) % 24]
def h(s): return hmac.new(SECRET.encode(), s.encode(), hashlib.sha256).hexdigest()
COMPLAINANTS = ["student", "teacher", "nonteaching", "alumni", "vendor", "parent"]
TEAM = ["resolver", "hod", "admin", "committee"]
ALL_ROLES = COMPLAINANTS + TEAM
ALL = ",".join(COMPLAINANTS)

class Base(DeclarativeBase): pass
def col(t=String, **k): return mapped_column(t, **k)
class Org(Base):
    __tablename__ = "orgs"; id = col(Integer, primary_key=True); code = col(String, unique=True); name = col(); city = col(nullable=True); lat = col(Float, nullable=True); lng = col(Float, nullable=True)
class User(Base):
    __tablename__ = "users"; id = col(Integer, primary_key=True); org_id = col(ForeignKey("orgs.id"))
    identifier = col(); name = col(); role = col(); dept = col(nullable=True); email = col(nullable=True); person_id = col()
    phone = col(nullable=True); qr_token = col(nullable=True, unique=True); pin_hash = col(nullable=True)
    pin_fails = col(Integer, default=0); locked_until = col(DateTime, nullable=True)
class Otp(Base):
    __tablename__ = "otps"; id = col(Integer, primary_key=True); phone = col(); portal = col()
    code = col(); expires = col(DateTime); attempts = col(Integer, default=0); created = col(DateTime, default=now)
class Category(Base):
    __tablename__ = "categories"; id = col(Integer, primary_key=True); org_id = col(ForeignKey("orgs.id"))
    family = col(); name = col(); dept = col(); sensitive = col(Boolean, default=False); audience = col(default=ALL)
class Query(Base):
    __tablename__ = "queries"; id = col(Integer, primary_key=True); query_id = col(unique=True); short_code = col()
    org_id = col(ForeignKey("orgs.id")); submitter_id = col(ForeignKey("users.id")); category_id = col(ForeignKey("categories.id"))
    text = col(Text); location = col(nullable=True); anonymity = col(default="named"); priority = col(default="P3")
    status = col(default="submitted"); assignee_id = col(Integer, nullable=True); sensitive = col(Boolean, default=False)
    due_at = col(DateTime, nullable=True); closed_at = col(DateTime, nullable=True); reopen_count = col(Integer, default=0)
    rating = col(Integer, nullable=True); idem_key = col(nullable=True); extra = col(Text, nullable=True); created_at = col(DateTime, default=now)
class Media(Base):
    __tablename__ = "media"; id = col(Integer, primary_key=True); query_pk = col(ForeignKey("queries.id")); kind = col(); mime = col(); path = col()
class Event(Base):
    __tablename__ = "events"; id = col(Integer, primary_key=True); query_pk = col(ForeignKey("queries.id"))
    actor = col(); text = col(Text); public = col(Boolean, default=True); at = col(DateTime, default=now)

CATS = [("Educational","Exams & grading","Academic Office",0,"student,teacher,parent,alumni"),
 ("Educational","Attendance","Academic Office",0,"student,teacher,parent"),
 ("Educational","Certificates & transcripts","Academic Office",0,"alumni,student"),
 ("Institutional","Hostel","Hostel",0,"student,parent,teacher,nonteaching"),
 ("Institutional","IT & Wi-Fi","IT",0,"student,teacher,nonteaching,alumni"),
 ("Institutional","Classroom & infrastructure","Maintenance",0,"student,teacher,nonteaching,parent,vendor"),
 ("Institutional","Fees","Academic Office",0,"student,parent"),
 ("Institutional","Payments & invoices","Academic Office",0,"vendor"),
 ("Institutional","Salary, leave & work issues","Academic Office",0,"teacher,nonteaching"),
 ("Report","Harassment / ragging / discrimination","Committee",1,ALL)]
def add_default_categories(db, org):
    for fam, name, dept, sens, aud in CATS: db.add(Category(org_id=org.id, family=fam, name=name, dept=dept, sensitive=bool(sens), audience=aud))
def norm_phone(p):
    p = re.sub(r"[\s\-()]", "", p or "")
    if not re.fullmatch(r"\+[1-9]\d{7,14}", p): raise HTTPException(422, "Phone must start with the country code, e.g. +919876543210")
    return p
def new_user(db, org, ident, name, role, phone, dept=None):
    ident = ident.strip().upper()
    if role not in ALL_ROLES: raise HTTPException(422, f"Unknown role '{role}'")
    if not ident or not name.strip(): raise HTTPException(422, "ID and name are required")
    if db.scalar(select(User).where(User.org_id == org.id, User.identifier == ident)): raise HTTPException(409, f"{ident} already exists")
    seq = db.scalar(select(func.count()).select_from(User).where(User.org_id == org.id)) + 1
    base = f"{org.code[4:]}-{role[:3].upper()}-{dt.date.today().year}-{seq:04d}"
    u = User(org_id=org.id, identifier=ident, name=name.strip(), role=role, dept=dept or None, phone=norm_phone(phone), person_id=f"{base}-{check(base)}")
    db.add(u); return u
UNIS = [("Bangalore University","Bengaluru",12.9507,77.5019),("Bengaluru City University","Bengaluru",12.9780,77.5840),("Bengaluru North University","Kolar",13.1100,78.1300),
 ("Visvesvaraya Technological University","Belagavi",15.8180,74.4890),("University of Mysore","Mysuru",12.3125,76.6153),("Karnataka State Open University","Mysuru",12.2958,76.6394),
 ("Karnatak University","Dharwad",15.4415,74.9910),("Mangalore University","Mangaluru",12.8186,74.9239),("Gulbarga University","Kalaburagi",17.3689,76.8180),
 ("Kuvempu University","Shivamogga",13.7722,75.6397),("Davangere University","Davanagere",14.4644,75.9218),("Rani Channamma University","Belagavi",15.8497,74.5498),
 ("Tumkur University","Tumakuru",13.3409,77.1010),("Vijayanagara Sri Krishnadevaraya University","Ballari",15.1394,76.9214),("Raichur University","Raichur",16.2076,77.3463),
 ("Mandya University","Mandya",12.5218,76.8951),("Karnataka State Akkamahadevi Women's University","Vijayapura",16.8302,75.7100),("Karnataka State Law University","Hubballi",15.3647,75.1240),
 ("Kannada University","Hampi",15.2930,76.4620),("Karnataka Samskrit University","Bengaluru",12.9570,77.5700),("Rajiv Gandhi University of Health Sciences","Bengaluru",12.9230,77.5830),
 ("University of Agricultural Sciences, Bengaluru","Bengaluru",13.0764,77.5803),("University of Agricultural Sciences, Dharwad","Dharwad",15.4880,74.9960),
 ("University of Agricultural and Horticultural Sciences","Shivamogga",13.9540,75.6190),("University of Horticultural Sciences","Bagalkot",16.1691,75.6615),
 ("Karnataka Veterinary, Animal & Fisheries Sciences University","Bidar",17.9104,77.5199),("Central University of Karnataka","Kalaburagi",17.3300,76.8300),
 ("Indian Institute of Science","Bengaluru",13.0219,77.5671),("IIT Dharwad","Dharwad",15.4920,74.9880),("NITK Surathkal","Mangaluru",13.0108,74.7949),
 ("National Law School of India University","Bengaluru",12.9400,77.5000),("Christ (Deemed to be University)","Bengaluru",12.9345,77.6061),("Jain (Deemed-to-be University)","Bengaluru",12.9250,77.5900),
 ("PES University","Bengaluru",12.9345,77.5340),("REVA University","Bengaluru",13.1160,77.6340),("Presidency University","Bengaluru",13.1700,77.5400),
 ("Manipal Academy of Higher Education","Manipal",13.3525,74.7860),("JSS Academy of Higher Education & Research","Mysuru",12.3050,76.6500)]  # coordinates approximate: verify with the client
EXTRA_KEYS = {"invoice_no", "passing_year", "course_year", "department"}
def seed():
    with Session_() as db:
        if db.scalar(select(Org)): return
        for i, (name, city, lat, lng) in enumerate(UNIS, 1):
            o = Org(code=f"ORG-KA{i:04d}", name=name, city=city, lat=lat, lng=lng); db.add(o); db.flush(); add_default_categories(db, o)
        if os.getenv("SEED_DEMO", "1") == "1":  # demo people exist only at the first university (Bangalore University)
            org = db.scalar(select(Org).order_by(Org.id))
            for k, (ident, name, role, dept) in enumerate([("S1001","Asha Rao","student",None),("T2001","Meena Iyer","teacher",None),("N7001","Lakshmi (Housekeeping)","nonteaching",None),
              ("L8001","Karthik Alumnus","alumni",None),("V9001","Sri Sai Caterers","vendor",None),("R3001","Hostel Resolver","resolver","Hostel"),("R3002","IT Resolver","resolver","IT"),
              ("R3003","Academic Resolver","resolver","Academic Office"),("R3004","Maintenance Resolver","resolver","Maintenance"),("H4001","Head of Department","hod",None),
              ("A5001","College Admin","admin",None),("C6001","Committee Chair","committee",None)], 1):
                ph = os.getenv("DEMO_PHONE") if ident in ("S1001", "A5001") and os.getenv("DEMO_PHONE") else f"+9190000010{k:02d}"
                new_user(db, org, ident, name, role, ph, dept)
            db.flush(); n = db.scalar(select(User).where(User.identifier == "N7001")); n.qr_token = "demo-badge-n7001"; n.pin_hash = h("1234" + n.qr_token)
        db.commit()

app = FastAPI(title="Campus Resolve")
@app.on_event("startup")
def startup(): Base.metadata.create_all(engine); seed()
def get_db():
    with Session_() as db: yield db

def notify(user, subject, body):  # Hook: replace with SMTP / n8n webhook later (stage D3, H5)
    print(f"[NOTIFY {user.email or user.phone}] {subject} :: {body}")

def current(authorization: str = Header(None), db: Session = Depends(get_db)):
    try: uid = jwt.decode((authorization or "").replace("Bearer ", ""), SECRET, algorithms=["HS256"])["uid"]
    except Exception: raise HTTPException(401, "Please sign in again")
    return db.get(User, uid)

# ---------- Stage A: college + SMS code or QR badge sign in ----------
PORTALS = {"student": {"student"}, "teacher": {"teacher"}, "staff": {"nonteaching"}, "alumni": {"alumni"}, "vendor": {"vendor"}, "parent": {"parent"}, "team": set(TEAM)}
class OtpReq(BaseModel): portal: str; phone: str
class OtpVerify(OtpReq): code: str
class Pick(BaseModel): org_code: str
class QrLogin(BaseModel): token: str; pin: str
def mask(p): return p[:3] + "•" * max(len(p) - 6, 3) + p[-3:]
def session(u):
    tok = jwt.encode({"uid": u.id, "exp": now() + dt.timedelta(hours=12)}, SECRET, algorithm="HS256")
    return {"token": tok, "user": dict(id=u.id, name=u.name, role=u.role, person_id=u.person_id)}
def members(db, phone, portal): return db.scalars(select(User).where(User.phone == phone, User.role.in_(PORTALS.get(portal, set())))).all()
def haversine(a, b, c, d):
    p = math.pi / 180; x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(x))
@app.get("/api/orgs")  # page 2: search by name/city, or sort by distance when lat/lng are given
def orgs(q: str = "", lat: float | None = None, lng: float | None = None, db: Session = Depends(get_db)):
    out = [dict(code=o.code, name=o.name, city=o.city, km=round(haversine(lat, lng, o.lat, o.lng)) if lat is not None and lng is not None and o.lat is not None else None)
           for o in db.scalars(select(Org)) if q.lower() in f"{o.name} {o.city}".lower()]
    return sorted(out, key=lambda o: (o["km"] is None, o["km"] or 0, o["name"]))
@app.post("/api/auth/request-otp")  # page 1: each role has its own login page; the phone must be registered for that role
def request_otp(b: OtpReq, db: Session = Depends(get_db)):
    phone = norm_phone(b.phone)
    if not members(db, phone, b.portal): raise HTTPException(404, "This number isn't registered for this login type. Ask your university admin to add you.")
    if db.scalar(select(func.count()).select_from(Otp).where(Otp.phone == phone, Otp.created > now() - dt.timedelta(minutes=10))) >= 3:
        raise HTTPException(429, "Too many codes requested. Please wait 10 minutes and try again.")
    code = f"{secrets.randbelow(1000000):06d}"
    try: send_sms(phone, f"{code} is your ALL-CLEAR CAMPUS code. It works for 10 minutes. Never share it.")
    except Exception as e:
        print("SMS failed:", e); raise HTTPException(502, "We couldn't send the SMS right now. Please try again in a minute.")
    db.add(Otp(phone=phone, portal=b.portal, code=h(code + phone), expires=now() + dt.timedelta(minutes=10))); db.commit()
    return {"sent": True, "to": mask(phone), "dev_code": code if DEV and os.getenv("SMS_PROVIDER", "console") == "console" else None}
@app.post("/api/auth/verify")
def verify(b: OtpVerify, db: Session = Depends(get_db)):
    phone = norm_phone(b.phone)
    o = db.scalar(select(Otp).where(Otp.phone == phone, Otp.portal == b.portal).order_by(Otp.id.desc()))
    if not o or o.expires < now() or o.attempts >= 5: raise HTTPException(400, "Code expired. Request a new one.")
    if not hmac.compare_digest(o.code, h(b.code.strip() + phone)):
        o.attempts += 1; db.commit(); raise HTTPException(400, "Wrong code. Try again.")
    db.delete(o); db.commit()
    pre = jwt.encode({"typ": "pre", "phone": phone, "portal": b.portal, "exp": now() + dt.timedelta(minutes=30)}, SECRET, algorithm="HS256")
    return {"pre": pre, "orgs": [db.get(Org, u.org_id).code for u in members(db, phone, b.portal)]}
@app.post("/api/auth/select")  # page 2 -> choose the university; you must be registered there
def select_org(b: Pick, authorization: str = Header(None), db: Session = Depends(get_db)):
    try:
        p = jwt.decode((authorization or "").replace("Bearer ", ""), SECRET, algorithms=["HS256"]); assert p["typ"] == "pre"
    except Exception: raise HTTPException(401, "Please sign in again")
    u = db.scalar(select(User).join(Org, Org.id == User.org_id).where(Org.code == b.org_code, User.phone == p["phone"], User.role.in_(PORTALS[p["portal"]])).order_by(User.id))
    if not u: raise HTTPException(404, "You are not registered at this university. Choose another one, or ask its admin to add you.")
    return session(u)
@app.post("/api/auth/qr")  # QR badge + 4-digit PIN: for staff who are not comfortable typing on a phone
def qr_login(b: QrLogin, db: Session = Depends(get_db)):
    u = db.scalar(select(User).where(User.qr_token == b.token))
    if not u: raise HTTPException(404, "This QR badge is no longer valid. Ask your admin for a new one.")
    if u.locked_until and u.locked_until > now(): raise HTTPException(429, "Too many wrong PINs. Please try again in 15 minutes.")
    if not hmac.compare_digest(u.pin_hash or "", h(b.pin.strip() + b.token)):
        u.pin_fails += 1
        if u.pin_fails >= 5: u.locked_until = now() + dt.timedelta(minutes=15); u.pin_fails = 0
        db.commit(); raise HTTPException(400, "Wrong PIN. Try again.")
    u.pin_fails = 0; db.commit(); return session(u)
@app.get("/api/me")
def me(u: User = Depends(current)): return dict(id=u.id, name=u.name, role=u.role, person_id=u.person_id, dept=u.dept)

# ---------- helpers ----------
STAFF = {"resolver", "hod", "admin", "committee"}
SLA_HOURS = {"P1": 24, "P2": 72, "P3": 168, "P4": 720}
DANGER = ["fire", "gas leak", "electric shock", "injur", "emergency", "suicide", "self-harm", "weapon", "threat"]
HIGH = ["no water", "power cut", "outage", "not working", "broken", "leak", "harass"]
SENSITIVE_WORDS = ["ragging", "harass", "discriminat", "molest", "posh"]
def priority_of(t):  # Phase 6 replaces this rule with the AI judge
    t = t.lower()
    return "P1" if any(w in t for w in DANGER) else "P2" if any(w in t for w in HIGH) else "P3"
def log(db, q, actor, text, public=True): db.add(Event(query_pk=q.id, actor=actor, text=text, public=public))
def can_view(u, q):
    if q.submitter_id == u.id: return True
    if u.org_id != q.org_id: return False
    if q.sensitive: return u.role == "committee"
    return u.role in ("admin", "hod") or (u.role == "resolver" and q.assignee_id == u.id)
def ser(db, q, u, full=False):
    cat, sub = db.get(Category, q.category_id), db.get(User, q.submitter_id)
    show = q.submitter_id == u.id or q.anonymity == "named" or u.role == "committee" or (u.role == "admin" and q.anonymity == "hidden")
    d = dict(id=q.id, query_id=q.query_id, short_code=q.short_code, category=cat.name, family=cat.family, status=q.status, priority=q.priority,
             location=q.location, sensitive=q.sensitive, created_at=q.created_at.isoformat() + "Z", due_at=q.due_at and q.due_at.isoformat() + "Z",
             submitter=sub.name if show else "Anonymous", submitter_role=sub.role, assignee=(db.get(User, q.assignee_id).name if q.assignee_id else None), anonymity=q.anonymity)
    if full:
        evs = db.scalars(select(Event).where(Event.query_pk == q.id).order_by(Event.id)).all()
        if u.role not in STAFF or q.submitter_id == u.id: evs = [e for e in evs if e.public]
        d.update(extra=json.loads(q.extra or "{}"), media=[dict(id=m.id, kind=m.kind, mime=m.mime) for m in db.scalars(select(Media).where(Media.query_pk == q.id))], text=q.text, rating=q.rating, reopen_count=q.reopen_count, can_reopen=bool(q.status == "closed" and q.submitter_id == u.id and q.closed_at and now() - q.closed_at < dt.timedelta(days=7)),
                 events=[dict(actor=e.actor, text=e.text, public=e.public, at=e.at.isoformat() + "Z") for e in evs])
    return d
def route(db, q, cat):  # Stage G1/G2: pick least-loaded resolver in the dept, never the submitter
    cands = db.scalars(select(User).where(User.org_id == q.org_id, User.role == "resolver", User.dept == cat.dept, User.id != q.submitter_id)).all()
    if not cands:
        q.status = "unassigned"; log(db, q, "System", "Waiting for the admin to assign a resolver"); return
    load = lambda r: db.scalar(select(func.count()).select_from(Query).where(Query.assignee_id == r.id, Query.status.in_(["assigned", "in_progress"])))
    r = min(cands, key=load); q.assignee_id = r.id; q.status = "assigned"
    q.due_at = now() + dt.timedelta(hours=SLA_HOURS[q.priority])
    log(db, q, "System", f"Assigned to {cat.dept}. Due by {q.due_at:%d %b %Y}")

# ---------- Stages B-D: submit ----------
@app.get("/api/categories")
def categories(u: User = Depends(current), db: Session = Depends(get_db)):
    return [dict(id=c.id, family=c.family, name=c.name) for c in db.scalars(select(Category).where(Category.org_id == u.org_id)) if u.role in c.audience.split(",")]
class NewQuery(BaseModel): category_id: int; text: str; location: str | None = None; anonymity: str = "named"; idempotency_key: str | None = None; extra: dict | None = None; has_media: bool = False
@app.post("/api/queries")
def submit(b: NewQuery, u: User = Depends(current), db: Session = Depends(get_db)):
    if u.role in STAFF: raise HTTPException(403, "Staff accounts handle complaints. Sign in as a student, teacher or parent to raise one.")
    if b.idempotency_key:  # D1: double tap never creates two queries
        old = db.scalar(select(Query).where(Query.submitter_id == u.id, Query.idem_key == b.idempotency_key))
        if old: return dict(ser(db, old, u), emergency=False)
    text = b.text.strip()
    if len(text) < 15 and not b.has_media: raise HTTPException(422, "Please describe the problem in at least a sentence (15+ characters).")
    if b.anonymity not in ("named", "hidden", "anonymous"): raise HTTPException(422, "Invalid privacy choice")
    if db.scalar(select(func.count()).select_from(Query).where(Query.submitter_id == u.id, Query.created_at > now() - dt.timedelta(hours=1))) >= 5:
        raise HTTPException(429, "You have sent 5 complaints in the last hour. Please try again later.")
    cat = db.get(Category, b.category_id)
    if not cat or cat.org_id != u.org_id: raise HTTPException(422, "Choose a category")
    org = db.get(Org, u.org_id); low = text.lower()
    sensitive = cat.sensitive or any(w in low for w in SENSITIVE_WORDS)
    seq = db.scalar(select(func.count()).select_from(Query).where(Query.org_id == org.id)) + 1
    base = f"{org.code[4:]}-{now():%y%m}-{cat.family[:3].upper()}-{seq:05d}"
    q = Query(query_id=f"{base}-{check(base)}", short_code=f"{random.randint(0, 999999):06d}", org_id=org.id, submitter_id=u.id, category_id=cat.id,
              text=text or "(voice / photo complaint)", extra=json.dumps({k: str(v)[:100] for k, v in (b.extra or {}).items() if k in EXTRA_KEYS}), location=b.location, anonymity="hidden" if sensitive and b.anonymity == "named" else b.anonymity,
              priority=priority_of(text), sensitive=sensitive, idem_key=b.idempotency_key)
    db.add(q); db.flush(); log(db, q, "System", "Received")
    if sensitive:  # Stage S1: committee only, stage-only updates
        q.status = "received"; q.priority = "P1"; log(db, q, "System", "Received by the committee")
    else: route(db, q, cat)
    db.commit(); notify(u, f"[{q.query_id}] Received", f"Your complaint is registered. Short code {q.short_code}.")
    return dict(ser(db, q, u), emergency=any(w in low for w in DANGER))

# ---------- Lists + detail ----------
@app.get("/api/queries")
def mine(u: User = Depends(current), db: Session = Depends(get_db)):
    s = select(Query).where(Query.org_id == u.org_id).order_by(Query.id.desc())
    if u.role == "resolver": s = s.where(Query.assignee_id == u.id)
    elif u.role in ("hod", "admin"): s = s.where(Query.sensitive == False)
    elif u.role == "committee": s = s.where(Query.sensitive == True)
    else: s = select(Query).where(Query.submitter_id == u.id).order_by(Query.id.desc())
    return [ser(db, q, u) for q in db.scalars(s)]
def load(db, qid, u):
    q = db.get(Query, qid)
    if not q or not can_view(u, q): raise HTTPException(404, "Complaint not found")
    return q
@app.get("/api/queries/{qid}")
def detail(qid: int, u: User = Depends(current), db: Session = Depends(get_db)): return ser(db, load(db, qid, u), u, True)
@app.get("/api/resolvers")
def resolvers(u: User = Depends(current), db: Session = Depends(get_db)):
    return [dict(id=r.id, name=r.name, dept=r.dept) for r in db.scalars(select(User).where(User.org_id == u.org_id, User.role == "resolver"))]

# ---------- Stages G-H, S: actions ----------
# action: (role, allowed_from, new_status, note_required, label)
ACTIONS = {
 "start": ("resolver", {"assigned"}, "in_progress", False, "Work has started"),
 "propose_fix": ("resolver", {"assigned", "in_progress"}, None, True, "Fix proposed"),
 "hod_approve": ("hod", {"hod_review"}, "admin_review", False, "Approved by Head of Department"),
 "hod_return": ("hod", {"hod_review"}, "in_progress", True, "Returned to the resolver"),
 "close": ("admin", {"admin_review"}, "closed", False, "Closed"),
 "reject": ("admin", {"admin_review"}, "rejected", True, "Rejected"),
 "send_back": ("admin", {"admin_review"}, "in_progress", True, "Sent back to the resolver"),
 "start_inquiry": ("committee", {"received"}, "under_inquiry", False, "Inquiry started"),
 "decide": ("committee", {"under_inquiry"}, "closed", True, "Decision recorded"),
}
class Act(BaseModel): note: str | None = None
@app.post("/api/queries/{qid}/action/{name}")
def act(qid: int, name: str, b: Act, u: User = Depends(current), db: Session = Depends(get_db)):
    q = load(db, qid, u); a = ACTIONS.get(name)
    if not a or u.role != a[0] or q.status not in a[1]: raise HTTPException(400, "That action isn't available right now")
    role, _, to, need, label = a; note = (b.note or "").strip()
    if need and len(note) < 5: raise HTTPException(422, "A reason or note is required")
    if name == "propose_fix": to = "hod_review" if (q.priority in ("P1", "P2") or q.reopen_count) else "admin_review"
    q.status = to
    if to in ("closed", "rejected"): q.closed_at = now()
    public_note = note and not q.sensitive and name in ("propose_fix", "close", "reject")
    log(db, q, u.name, f"{label}: {note}" if public_note else label)
    if note and not public_note: log(db, q, u.name, f"Internal note: {note}", public=False)
    if to in ("closed", "rejected"):
        s = db.get(User, q.submitter_id); notify(s, f"[{q.query_id}] {label}", note or "Your complaint has been closed.")
    db.commit(); return ser(db, q, u, True)
class Assign(BaseModel): assignee_id: int; reason: str
@app.post("/api/queries/{qid}/assign")
def assign(qid: int, b: Assign, u: User = Depends(current), db: Session = Depends(get_db)):
    q = load(db, qid, u); r = db.get(User, b.assignee_id)
    if u.role != "admin" or q.status in ("closed", "rejected") or not r or r.role != "resolver" or r.id == q.submitter_id: raise HTTPException(400, "Can't assign this complaint")
    q.assignee_id = r.id; q.status = "assigned"; q.due_at = q.due_at or now() + dt.timedelta(hours=SLA_HOURS[q.priority])
    log(db, q, u.name, f"Reassigned to {r.name}"); log(db, q, u.name, f"Internal note: {b.reason}", public=False); db.commit(); return ser(db, q, u, True)
@app.post("/api/queries/{qid}/reopen")  # Stage I2: 7-day window; 2nd reopen goes to HOD
def reopen(qid: int, b: Act, u: User = Depends(current), db: Session = Depends(get_db)):
    q = load(db, qid, u)
    if q.submitter_id != u.id or q.status != "closed" or now() - q.closed_at > dt.timedelta(days=7): raise HTTPException(400, "Reopening is only possible within 7 days of closure")
    if len((b.note or "").strip()) < 5: raise HTTPException(422, "Please tell us what is still not fixed")
    q.reopen_count += 1; q.closed_at = None
    q.status = "hod_review" if q.reopen_count >= 2 and not q.sensitive else ("under_inquiry" if q.sensitive else "in_progress")
    log(db, q, u.name if q.anonymity == "named" else "Complainant", "Reopened: " + b.note.strip()); db.commit(); return ser(db, q, u, True)
class Rate(BaseModel): rating: int
@app.post("/api/queries/{qid}/rate")
def rate(qid: int, b: Rate, u: User = Depends(current), db: Session = Depends(get_db)):
    q = load(db, qid, u)
    if q.submitter_id != u.id or q.status != "closed" or not 1 <= b.rating <= 5: raise HTTPException(400, "Can't rate this complaint")
    q.rating = b.rating; log(db, q, "Complainant", f"Rated the outcome {b.rating}/5"); db.commit(); return ser(db, q, u, True)

FRONT = Path(__file__).resolve().parents[2] / "frontend"

# ---------- Admin: people + QR badges ----------
def need_admin(u):
    if u.role != "admin": raise HTTPException(403, "Admins only")
class NewUser(BaseModel): identifier: str; name: str; role: str; phone: str; dept: str | None = None
class CsvIn(BaseModel): csv: str
@app.get("/api/admin/users")
def list_users(u: User = Depends(current), db: Session = Depends(get_db)):
    need_admin(u)
    return [dict(id=x.id, identifier=x.identifier, name=x.name, role=x.role, dept=x.dept, phone=mask(x.phone) if x.phone else None, badge=bool(x.qr_token))
            for x in db.scalars(select(User).where(User.org_id == u.org_id).order_by(User.id))]
@app.post("/api/admin/users")
def add_user(b: NewUser, u: User = Depends(current), db: Session = Depends(get_db)):
    need_admin(u); new_user(db, db.get(Org, u.org_id), b.identifier, b.name, b.role, b.phone, b.dept); db.commit(); return {"ok": True}
@app.post("/api/admin/users/import")  # one person per line: ID, name, role, phone, department
def import_users(b: CsvIn, u: User = Depends(current), db: Session = Depends(get_db)):
    need_admin(u); org = db.get(Org, u.org_id); added, errors = 0, []
    for n, row in enumerate(csv.reader(io.StringIO(b.csv.strip())), 1):
        row = [c.strip() for c in row] + [""] * 5
        if not row[0] or row[0].lower().startswith("id"): continue
        try: new_user(db, org, row[0], row[1], row[2].lower(), row[3], row[4]); added += 1
        except HTTPException as e: errors.append(f"Line {n}: {e.detail}")
    db.commit(); return {"added": added, "errors": errors}
@app.post("/api/admin/users/{uid}/badge")
def make_badge(uid: int, req: Request, u: User = Depends(current), db: Session = Depends(get_db)):
    need_admin(u); t = db.get(User, uid)
    if not t or t.org_id != u.org_id or t.role in TEAM: raise HTTPException(404, "Person not found")
    t.qr_token = secrets.token_urlsafe(24); pin = f"{secrets.randbelow(10000):04d}"
    t.pin_hash = h(pin + t.qr_token); t.pin_fails = 0; t.locked_until = None; db.commit()
    url = os.getenv("PUBLIC_URL", str(req.base_url)).rstrip("/") + "/q/" + t.qr_token
    buf = io.BytesIO(); qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, border=2).save(buf)
    svg = re.sub(r"<\?xml.*?\?>", "", buf.getvalue().decode())
    return dict(name=t.name, identifier=t.identifier, org=db.get(Org, t.org_id).name, pin=pin, url=url, svg=svg)

# ---------- Voice + photo evidence ----------
UPLOADS = Path(os.getenv("UPLOAD_DIR", "uploads")); UPLOADS.mkdir(parents=True, exist_ok=True)
MEDIA_OK = {"photo": ({"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}, 8_000_000, 3),
            "voice": ({"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav"}, 6_000_000, 1)}
@app.post("/api/queries/{qid}/media")
def add_media(qid: int, kind: str, f: UploadFile = File(...), u: User = Depends(current), db: Session = Depends(get_db)):
    q = db.get(Query, qid)
    if not q or q.submitter_id != u.id: raise HTTPException(404, "Complaint not found")
    if kind not in MEDIA_OK: raise HTTPException(422, "kind must be photo or voice")
    types, cap, maxn = MEDIA_OK[kind]; mime = (f.content_type or "").split(";")[0]
    if mime not in types: raise HTTPException(415, "This file type isn't supported")
    if db.scalar(select(func.count()).select_from(Media).where(Media.query_pk == q.id, Media.kind == kind)) >= maxn: raise HTTPException(409, f"Limit reached ({maxn} {kind})")
    data = f.file.read(cap + 1)
    if len(data) > cap: raise HTTPException(413, "File is too large")
    name = f"{uuid.uuid4().hex}.{types[mime]}"; (UPLOADS / name).write_bytes(data)
    m = Media(query_pk=q.id, kind=kind, mime=mime, path=name); db.add(m); log(db, q, "System", "Voice message added" if kind == "voice" else "Photo added"); db.commit()
    return {"id": m.id}
@app.get("/api/media/{mid}")
def get_media(mid: int, u: User = Depends(current), db: Session = Depends(get_db)):
    m = db.get(Media, mid); q = m and db.get(Query, m.query_pk)
    if not q or not can_view(u, q): raise HTTPException(404, "Not found")
    return FileResponse(UPLOADS / m.path, media_type=m.mime)
@app.get("/api/admin/stats")
def stats(u: User = Depends(current), db: Session = Depends(get_db)):
    need_admin(u); rows = db.scalars(select(Query).where(Query.org_id == u.org_id, Query.sensitive == False)).all()
    op = [q for q in rows if q.status not in ("closed", "rejected")]
    return dict(total=len(rows), open=len(op), overdue=sum(1 for q in op if q.due_at and q.due_at < now()), closed=len(rows) - len(op))

@app.get("/login/{p}", include_in_schema=False)
@app.get("/q/{t}", include_in_schema=False)
def page(p: str = "", t: str = ""): return FileResponse(FRONT / "index.html")
app.mount("/", StaticFiles(directory=FRONT, html=True), name="web")
