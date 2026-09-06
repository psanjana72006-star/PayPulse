from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import json
import os
import time
import uuid
import requests
from datetime import datetime, date
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-key-please")

APP_USERNAME = os.environ.get("APP_USERNAME", "admin")
APP_PASSWORD = os.environ.get("APP_PASSWORD", "admin123")

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')

EXODUS_BASE = "https://reports.exodus-privacy.eu.org"
EXODUS_API_KEY = os.environ.get("EXODUS_API_KEY", "")

DANGEROUS_PERMISSIONS = {
    "android.permission.READ_CONTACTS": "Read your contacts",
    "android.permission.WRITE_CONTACTS": "Modify your contacts",
    "android.permission.ACCESS_FINE_LOCATION": "Access precise location",
    "android.permission.ACCESS_COARSE_LOCATION": "Access approximate location",
    "android.permission.ACCESS_BACKGROUND_LOCATION": "Access location in the background",
    "android.permission.CAMERA": "Use the camera",
    "android.permission.RECORD_AUDIO": "Record audio",
    "android.permission.READ_SMS": "Read your SMS messages",
    "android.permission.SEND_SMS": "Send SMS messages",
    "android.permission.READ_CALL_LOG": "Read your call log",
    "android.permission.READ_PHONE_STATE": "Read phone status and identity",
    "android.permission.READ_EXTERNAL_STORAGE": "Read files on your device",
    "android.permission.WRITE_EXTERNAL_STORAGE": "Write files on your device",
    "android.permission.BODY_SENSORS": "Access body sensor data",
    "android.permission.GET_ACCOUNTS": "Access accounts on your device",
}

_tracker_cache = {"data": None, "fetched_at": 0}


# ---------- Auth ----------

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('logged_in'):
            if request.path.startswith('/api/'):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrapper


@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '')
        password = request.form.get('password', '')
        if username == APP_USERNAME and password == APP_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('home'))
        error = "Invalid username or password"
    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))


def _exodus_headers():
    headers = {"User-Agent": "dossier-privacy-tracker/1.0"}
    if EXODUS_API_KEY:
        headers["Authorization"] = f"Token {EXODUS_API_KEY}"
    return headers


def get_tracker_map():
    now = time.time()
    if _tracker_cache["data"] is not None and now - _tracker_cache["fetched_at"] < 86400:
        return _tracker_cache["data"]
    resp = requests.get(f"{EXODUS_BASE}/api/trackers", headers=_exodus_headers(), timeout=10)
    resp.raise_for_status()
    trackers = resp.json().get("trackers", {})
    _tracker_cache["data"] = trackers
    _tracker_cache["fetched_at"] = now
    return trackers


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"services": [], "requests": [], "scoreHistory": []}
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
        data.setdefault('scoreHistory', [])
        return data


def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)


# ---------- Page ----------

@app.route('/')
@login_required
def home():
    return render_template('index.html')


# ---------- Services API ----------

@app.route('/api/services', methods=['GET'])
@login_required
def get_services():
    data = load_data()
    return jsonify(data['services'])


@app.route('/api/services', methods=['POST'])
@login_required
def add_service():
    data = load_data()
    body = request.get_json(force=True) or {}

    name = (body.get('name') or '').strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    service = {
        "id": uuid.uuid4().hex[:10],
        "name": name,
        "category": body.get('category', 'Other'),
        "dataTypes": body.get('dataTypes', []),
        "risk": body.get('risk', 'low'),
        "reviewed": body.get('reviewed', ''),
        "notes": body.get('notes', ''),
    }
    data['services'].append(service)
    save_data(data)
    return jsonify(service), 201


@app.route('/api/services/<service_id>', methods=['PATCH'])
@login_required
def update_service(service_id):
    data = load_data()
    for s in data['services']:
        if s['id'] == service_id:
            body = request.get_json(force=True) or {}
            s['reviewed'] = body.get('reviewed', datetime.utcnow().strftime('%Y-%m-%d'))
            save_data(data)
            return jsonify(s)
    return jsonify({"error": "not found"}), 404


@app.route('/api/services/<service_id>', methods=['DELETE'])
@login_required
def delete_service(service_id):
    data = load_data()
    data['services'] = [s for s in data['services'] if s['id'] != service_id]
    save_data(data)
    return '', 204


# ---------- Requests API ----------

@app.route('/api/requests', methods=['GET'])
@login_required
def get_requests():
    data = load_data()
    return jsonify(data['requests'])


@app.route('/api/requests', methods=['POST'])
@login_required
def add_request():
    data = load_data()
    body = request.get_json(force=True) or {}

    service = (body.get('service') or '').strip()
    if not service:
        return jsonify({"error": "service is required"}), 400

    req = {
        "id": uuid.uuid4().hex[:10],
        "service": service,
        "type": body.get('type', 'export'),
        "dateFiled": body.get('dateFiled', ''),
        "dueDate": body.get('dueDate', ''),
        "status": body.get('status', 'pending'),
        "notes": body.get('notes', ''),
    }
    data['requests'].append(req)
    save_data(data)
    return jsonify(req), 201


@app.route('/api/requests/<request_id>', methods=['DELETE'])
@login_required
def delete_request(request_id):
    data = load_data()
    data['requests'] = [r for r in data['requests'] if r['id'] != request_id]
    save_data(data)
    return '', 204


# ---------- Score history API ----------

@app.route('/api/score-history', methods=['GET'])
@login_required
def get_score_history():
    data = load_data()
    return jsonify(data.get('scoreHistory', []))


@app.route('/api/score-history', methods=['POST'])
@login_required
def add_score_snapshot():
    data = load_data()
    body = request.get_json(force=True) or {}
    score = body.get('score')
    if score is None:
        return jsonify({"error": "score is required"}), 400

    today = date.today().isoformat()
    history = data.setdefault('scoreHistory', [])
    if history and history[-1]['date'] == today:
        history[-1]['score'] = score
    else:
        history.append({"date": today, "score": score})
    history[:] = history[-30:]
    save_data(data)
    return jsonify(history), 201


# ---------- Lookup API ----------

@app.route('/api/lookup/<path:handle>', methods=['GET'])
@login_required
def lookup_app(handle):
    handle = handle.strip()

    if not EXODUS_API_KEY:
        return jsonify({
            "error": "missing_api_key",
            "message": (
                "This feature needs a free Exodus Privacy API key before it can run. "
                "Email api@exodus-privacy.eu.org with your username, email, and a short "
                "description of this project, then set the key as the EXODUS_API_KEY "
                "environment variable and restart the server."
            ),
        }), 501

    try:
        resp = requests.get(
            f"{EXODUS_BASE}/api/search/{handle}/details",
            headers=_exodus_headers(),
            timeout=10,
        )
    except requests.RequestException as e:
        return jsonify({"error": "network_error", "message": str(e)}), 502

    if resp.status_code in (401, 403):
        return jsonify({
            "error": "unauthorized",
            "message": "Exodus rejected the API key. Double-check EXODUS_API_KEY is set correctly.",
        }), 502
    if resp.status_code == 404:
        return jsonify({
            "error": "not_found",
            "message": f"No εxodus report found for '{handle}'. Use the exact Android "
                       f"package name, e.g. com.instagram.android or com.whatsapp.",
        }), 404
    if not resp.ok:
        return jsonify({"error": "upstream_error", "message": f"Exodus API returned {resp.status_code}"}), 502

    reports = resp.json()
    if not reports:
        return jsonify({"error": "not_found", "message": f"No report found for '{handle}'."}), 404

    latest = max(reports, key=lambda r: r.get("updated", ""))

    try:
        tracker_map = get_tracker_map()
    except requests.RequestException:
        tracker_map = {}

    tracker_ids = latest.get("trackers", [])
    trackers = []
    for tid in tracker_ids:
        info = tracker_map.get(str(tid))
        if info:
            trackers.append({"name": info["name"], "categories": info.get("categories", [])})
        else:
            trackers.append({"name": f"Tracker #{tid}", "categories": []})

    permissions = latest.get("permissions", [])
    dangerous = [DANGEROUS_PERMISSIONS[p] for p in permissions if p in DANGEROUS_PERMISSIONS]

    return jsonify({
        "handle": latest.get("handle", handle),
        "app_name": latest.get("app_name") or handle,
        "version": latest.get("version_name", ""),
        "updated": latest.get("updated", ""),
        "trackers": trackers,
        "tracker_count": len(trackers),
        "permissions_total": len(permissions),
        "dangerous_permissions": dangerous,
        "source_report_url": f"https://reports.exodus-privacy.eu.org/en/reports/search/{handle}/",
    })


if __name__ == '__main__':
    app.run(debug=True)