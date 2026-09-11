from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import json
import os
import uuid
from datetime import datetime, date
from functools import wraps

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-key-please")

APP_USERNAME = os.environ.get("APP_USERNAME", "admin")
APP_PASSWORD = os.environ.get("APP_PASSWORD", "admin123")

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')
LOCAL_DB_FILE = os.path.join(os.path.dirname(__file__), 'local_database.json')

DANGEROUS_PERMISSIONS = {
    "ACCESS_FINE_LOCATION": "Access precise location",
    "ACCESS_COARSE_LOCATION": "Access approximate location",
    "ACCESS_BACKGROUND_LOCATION": "Access location in the background",
    "CAMERA": "Use the camera",
    "RECORD_AUDIO": "Record audio",
    "READ_CONTACTS": "Read your contacts",
    "WRITE_CONTACTS": "Modify your contacts",
    "READ_SMS": "Read your SMS messages",
    "SEND_SMS": "Send SMS messages",
    "READ_CALL_LOG": "Read your call log",
    "READ_PHONE_STATE": "Read phone status and identity",
    "READ_EXTERNAL_STORAGE": "Read files on your device",
    "WRITE_EXTERNAL_STORAGE": "Write files on your device",
    "BODY_SENSORS": "Access body sensor data",
    "GET_ACCOUNTS": "Access accounts on your device",
}


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


def load_local_db():
    if not os.path.exists(LOCAL_DB_FILE):
        return {}
    with open(LOCAL_DB_FILE, 'r') as f:
        return json.load(f)


@app.route('/')
@login_required
def home():
    return render_template('index.html')


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


@app.route('/api/lookup/<path:handle>', methods=['GET'])
@login_required
def lookup_app(handle):
    handle = handle.strip()
    db = load_local_db()
    entry = db.get(handle)

    if not entry:
        return jsonify({
            "error": "not_found",
            "message": f"'{handle}' isn't in your local database yet. Look it up at "
                       f"reports.exodus-privacy.eu.org and add it to local_database.json.",
        }), 404

    permissions = entry.get("permissions", [])
    dangerous = [DANGEROUS_PERMISSIONS[p] for p in permissions if p in DANGEROUS_PERMISSIONS]

    return jsonify({
        "handle": handle,
        "app_name": entry.get("app_name", handle),
        "version": "curated entry",
        "updated": "manually verified",
        "trackers": [{"name": t, "categories": []} for t in entry.get("trackers", [])],
        "tracker_count": len(entry.get("trackers", [])),
        "permissions_total": len(permissions),
        "dangerous_permissions": dangerous,
        "source_report_url": entry.get("source_url", ""),
    })


if __name__ == '__main__':
    app.run(debug=True)