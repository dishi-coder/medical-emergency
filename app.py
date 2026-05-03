import sqlite3
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import pickle, json, numpy as np

# 🔔 Telegram import
try:
    from telegram_alert import send_alert
    TELEGRAM_ENABLED = True
except ImportError:
    TELEGRAM_ENABLED = False
    print("⚠️ telegram_alert module nahi mila — Telegram disabled")

DATABASE = "database.db"

# ── DB HELPER — har request ka apna connection ────────────────────────────
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

def query_db(query, args=(), one=False, commit=False):
    db = get_db()
    cur = db.execute(query, args)
    if commit:
        db.commit()
        return cur
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv

# ── FLASK SETUP ──────────────────────────
app = Flask(__name__)
CORS(app)

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# ── DB SETUP (startup mein ek baar) ─────────────────────────────
def init_db():
    with sqlite3.connect(DATABASE) as con:
        cur = con.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, email TEXT, password TEXT
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT, patient_age TEXT,
            disease TEXT, doctor TEXT, severity TEXT,
            confidence REAL, symptoms TEXT,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, specialty TEXT, experience INTEGER,
            status TEXT DEFAULT 'available', initials TEXT, color TEXT
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, icon TEXT, doctor_count TEXT, specialty_key TEXT
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT, type TEXT, message TEXT,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_name TEXT, lat REAL, lng REAL, accuracy REAL,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""")
        con.commit()

        # ── SEED DATA ────────────────────────────
        cur.execute("SELECT COUNT(*) FROM doctors")
        if cur.fetchone()[0] == 0:
            cur.executemany(
                "INSERT INTO doctors (name,specialty,experience,status,initials,color) VALUES (?,?,?,?,?,?)",
                [
                    ("Dr. Deepak Sharma", "Cardiologist", 18, "available", "DS", "linear-gradient(135deg,#2563eb,#0ea5e9)"),
                    ("Dr. Priya Rao", "Neurologist", 14, "available", "PR", "linear-gradient(135deg,#7c3aed,#a78bfa)"),
                    ("Dr. Amit Kumar", "Orthopaedic", 11, "in_surgery", "AK", "linear-gradient(135deg,#0d9488,#2dd4bf)"),
                    ("Dr. Sunita Mehta", "General Physician", 9, "available", "SM", "linear-gradient(135deg,#dc2626,#f87171)"),
                    ("Dr. Ramesh Gupta", "Pulmonologist", 16, "available", "RG", "linear-gradient(135deg,#ea580c,#fb923c)"),
                    ("Dr. Anjali Singh", "Paediatrician", 12, "off_duty", "AS", "linear-gradient(135deg,#0891b2,#22d3ee)"),
                ],
            )
            con.commit()
            print("✅ Doctors seeded!")

        cur.execute("SELECT COUNT(*) FROM departments")
        if cur.fetchone()[0] == 0:
            cur.executemany(
                "INSERT INTO departments (name,icon,doctor_count,specialty_key) VALUES (?,?,?,?)",
                [
                    ("Cardiology", "❤️", "8 specialists", "Cardiologist"),
                    ("Neurology", "🧠", "5 specialists", "Neurologist"),
                    ("Orthopaedic", "🦴", "6 specialists", "Orthopaedic"),
                    ("Pulmonology", "🫁", "4 specialists", "Pulmonologist"),
                    ("General OPD", "🩺", "12 doctors", "General Physician"),
                    ("Paediatrics", "👶", "5 specialists", "Paediatrician"),
                    ("Pathology", "🔬", "Lab 24x7", ""),
                    ("Pharmacy", "💊", "In-house 24x7", ""),
                    ("Radiology", "🩻", "MRI · CT · X-Ray", ""),
                    ("Emergency", "🚑", "Always open", ""),
                ],
            )
            con.commit()
            print("✅ Departments seeded!")

init_db()

# ── LOAD MODEL ───────────────────────────
MODEL_DIR = "model"

def load_artifacts():
    with open(f"{MODEL_DIR}/model.pkl", "rb") as f:
        model = pickle.load(f)
    with open(f"{MODEL_DIR}/label_encoder.pkl", "rb") as f:
        le = pickle.load(f)
    with open(f"{MODEL_DIR}/feature_cols.json") as f:
        feature_cols = json.load(f)
    with open(f"{MODEL_DIR}/disease_doctor_map.json") as f:
        ddm = json.load(f)
    with open(f"{MODEL_DIR}/disease_severity_map.json") as f:
        dsm = json.load(f)
    return model, le, feature_cols, ddm, dsm

model, le, feature_cols, disease_doctor_map, disease_severity_map = load_artifacts()
print("✅ AI Model loaded!")

# ── ROUTES ───────────────────────────────
@app.route("/")
def home():
    return jsonify({"status": "API running"})

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/departments")
def get_departments():
    rows = query_db("SELECT * FROM departments")
    return jsonify({
        "success": True,
        "departments": [
            {"id": r[0], "name": r[1], "icon": r[2], "doctor_count": r[3], "specialty_key": r[4]}
            for r in rows
        ]
    })

@app.route("/doctors")
def get_doctors():
    specialty = request.args.get("specialty", "").strip()
    if specialty:
        rows = query_db("SELECT * FROM doctors WHERE specialty=?", (specialty,))
    else:
        rows = query_db("SELECT * FROM doctors")
    return jsonify({
        "success": True,
        "doctors": [
            {
                "id": r[0], "name": r[1], "specialty": r[2],
                "experience": r[3], "status": r[4],
                "initials": r[5], "color": r[6]
            }
            for r in rows
        ]
    })

@app.route("/doctors/<int:doctor_id>/status", methods=["PATCH"])
def update_doctor_status(doctor_id):
    data = request.get_json(force=True)
    status = data.get("status")
    if status not in ["available", "in_surgery", "off_duty"]:
        return jsonify({"error": "Invalid status"}), 400
    query_db("UPDATE doctors SET status=? WHERE id=?", (status, doctor_id), commit=True)
    return jsonify({"success": True, "id": doctor_id, "status": status})

@app.route("/reports")
def get_reports():
    patient_name = request.args.get("patient_name", "").strip()
    if patient_name:
        rows = query_db(
            "SELECT * FROM reports WHERE patient_name=? ORDER BY time DESC LIMIT 20",
            (patient_name,)
        )
    else:
        rows = query_db("SELECT * FROM reports ORDER BY time DESC LIMIT 20")
    return jsonify({
        "success": True,
        "reports": [
            {
                "id": r[0], "patient_name": r[1], "patient_age": r[2],
                "disease": r[3], "doctor": r[4], "severity": r[5],
                "confidence": r[6], "symptoms": r[7], "time": r[8] or ""
            }
            for r in rows
        ]
    })

@app.route("/activity")
def get_activity():
    patient_name = request.args.get("patient_name", "").strip()
    if patient_name:
        rows = query_db(
            "SELECT * FROM activity WHERE patient_name=? ORDER BY time DESC LIMIT 10",
            (patient_name,)
        )
    else:
        rows = query_db("SELECT * FROM activity ORDER BY time DESC LIMIT 10")
    return jsonify({
        "success": True,
        "activity": [
            {"id": r[0], "patient_name": r[1], "type": r[2], "message": r[3], "time": r[4]}
            for r in rows
        ]
    })

@app.route("/location", methods=["POST"])
def save_location():
    data = request.get_json(force=True)
    patient_name = data.get("patient_name", "Unknown")
    lat = data.get("lat")
    lng = data.get("lng")
    accuracy = data.get("accuracy", 0)

    db = get_db()
    db.execute(
        "INSERT INTO locations (patient_name,lat,lng,accuracy) VALUES (?,?,?,?)",
        (patient_name, lat, lng, accuracy)
    )
    db.execute(
        "INSERT INTO activity (patient_name,type,message) VALUES (?,?,?)",
        (patient_name, "location", "Location shared with hospital")
    )
    db.commit()
    return jsonify({"success": True})

@app.route("/alert-log", methods=["POST"])
def alert_log():
    data = request.get_json(force=True)
    patient_name = data.get("patient_name", "Unknown")
    target = data.get("target", "family")
    db = get_db()
    db.execute(
        "INSERT INTO activity (patient_name,type,message) VALUES (?,?,?)",
        (patient_name, "telegram", f"Telegram alert sent to {target}")
    )
    db.commit()
    return jsonify({"success": True})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        symptoms_in = data.get("symptoms", [])
        patient_name = data.get("patient_name", "Unknown")
        patient_age = data.get("patient_age", "N/A")

        if not symptoms_in:
            return jsonify({"success": False, "error": "No symptoms"}), 400

        input_vec = np.zeros(len(feature_cols))
        for s in symptoms_in:
            s = s.lower().replace(" ", "_")
            if s in feature_cols:
                input_vec[feature_cols.index(s)] = 1

        probs = model.predict_proba([input_vec])[0]
        pred_idx = int(np.argmax(probs))

        disease = le.classes_[pred_idx]
        confidence = round(float(probs[pred_idx]) * 100, 2)
        doctor = disease_doctor_map.get(disease, "General Physician")
        severity = disease_severity_map.get(disease, "Medium")

        top3_idx = np.argsort(probs)[::-1][:3]
        top3 = [
            {"disease": le.classes_[i], "confidence": round(float(probs[i]) * 100, 2)}
            for i in top3_idx
        ]

        symptoms_str = ", ".join(symptoms_in)

        db = get_db()
        db.execute("""
            INSERT INTO reports (patient_name,patient_age,disease,doctor,severity,confidence,symptoms)
            VALUES (?,?,?,?,?,?,?)
        """, (patient_name, patient_age, disease, doctor, severity, confidence, symptoms_str))

        db.execute("""
            INSERT INTO activity (patient_name,type,message)
            VALUES (?,?,?)
        """, (patient_name, "diagnosis", f"AI diagnosis completed — {disease}"))

        db.commit()

        telegram_sent = False
        if TELEGRAM_ENABLED and severity in ["Critical", "Moderate", "High"]:
            try:
                send_alert(
                    patient_name=patient_name,
                    disease=disease,
                    doctor=doctor,
                    severity=severity,
                    confidence=confidence
                )
                telegram_sent = True
                db.execute("""
                    INSERT INTO activity (patient_name,type,message)
                    VALUES (?,?,?)
                """, (patient_name, "telegram", f"Telegram alert sent to family — {disease}"))
                db.commit()
            except Exception as alert_error:
                print("⚠️ Telegram Error:", alert_error)

        return jsonify({
            "success": True,
            "prediction": {
                "disease": disease,
                "doctor": doctor,
                "severity": severity,
                "confidence": confidence
            },
            "top3_predictions": top3,
            "telegram_sent": telegram_sent,
            "emergency_alert": {
                "message": f"Patient {patient_name} has symptoms of {disease}. Severity: {severity}. Please consult a {doctor}."
            }
        })

    except Exception as e:
        db = getattr(g, '_database', None)
        if db:
            db.rollback()
        print("PREDICT ERROR:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/resend-alert", methods=["POST"])
def resend_alert():
    try:
        data = request.get_json(force=True)
        target = data.get("target", "family")
        patient_name = data.get("patient_name", "Unknown")
        diagnosis = data.get("diagnosis", "N/A")
        severity = data.get("severity", "Unknown")

        if TELEGRAM_ENABLED:
            try:
                send_alert(
                    patient_name=patient_name,
                    disease=diagnosis,
                    doctor="General Physician",
                    severity=severity,
                    confidence=0
                )
                db = get_db()
                db.execute(
                    "INSERT INTO activity (patient_name,type,message) VALUES (?,?,?)",
                    (patient_name, "telegram", f"Alert resent to {target}")
                )
                db.commit()
                return jsonify({"success": True, "status": "sent"})
            except Exception as e:
                return jsonify({"success": False, "error": str(e)}), 500
        else:
            return jsonify({"success": True, "status": "sent", "note": "demo mode"})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)