import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle, json, numpy as np

# ── DB SETUP ─────────────────────────────
conn = sqlite3.connect("database.db", check_same_thread=False)
cursor = conn.cursor()

# Patients table
cursor.execute("""
CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    password TEXT
)
""")

# Reports table
cursor.execute("""
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT,
    patient_age TEXT,
    disease TEXT,
    doctor TEXT,
    severity TEXT,
    confidence REAL,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# ✅ Doctors table
cursor.execute("""
CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    specialty TEXT,
    experience INTEGER,
    status TEXT DEFAULT 'available',
    initials TEXT,
    color TEXT
)
""")

# ✅ Departments table
cursor.execute("""
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    icon TEXT,
    doctor_count TEXT,
    specialty_key TEXT
)
""")

conn.commit()

# ✅ Doctors seed data — sirf pehli baar insert karo
cursor.execute("SELECT COUNT(*) FROM doctors")
if cursor.fetchone()[0] == 0:
    doctors_data = [
        ("Dr. Deepak Sharma", "Cardiologist",      18, "available",  "DS", "linear-gradient(135deg,#2563eb,#0ea5e9)"),
        ("Dr. Priya Rao",     "Neurologist",        14, "available",  "PR", "linear-gradient(135deg,#7c3aed,#a78bfa)"),
        ("Dr. Amit Kumar",    "Orthopaedic",        11, "in_surgery", "AK", "linear-gradient(135deg,#0d9488,#2dd4bf)"),
        ("Dr. Sunita Mehta",  "General Physician",   9, "available",  "SM", "linear-gradient(135deg,#dc2626,#f87171)"),
        ("Dr. Ramesh Gupta",  "Pulmonologist",      16, "available",  "RG", "linear-gradient(135deg,#ea580c,#fb923c)"),
        ("Dr. Anjali Singh",  "Paediatrician",      12, "off_duty",   "AS", "linear-gradient(135deg,#0891b2,#22d3ee)"),
    ]
    cursor.executemany("""
        INSERT INTO doctors (name, specialty, experience, status, initials, color)
        VALUES (?, ?, ?, ?, ?, ?)
    """, doctors_data)
    conn.commit()
    print("✅ Doctors seeded!")

# ✅ Departments seed data — sirf pehli baar insert karo
cursor.execute("SELECT COUNT(*) FROM departments")
if cursor.fetchone()[0] == 0:
    departments_data = [
        ("Cardiology",  "❤️", "8 specialists",    "Cardiologist"),
        ("Neurology",   "🧠", "5 specialists",    "Neurologist"),
        ("Orthopaedic", "🦴", "6 specialists",    "Orthopaedic"),
        ("Pulmonology", "🫁", "4 specialists",    "Pulmonologist"),
        ("General OPD", "🩺", "12 doctors",       "General Physician"),
        ("Paediatrics", "👶", "5 specialists",    "Paediatrician"),
        ("Pathology",   "🔬", "Lab 24x7",         ""),
        ("Pharmacy",    "💊", "In-house 24x7",    ""),
        ("Radiology",   "🩻", "MRI · CT · X-Ray", ""),
        ("Emergency",   "🚑", "Always open",      ""),
    ]
    cursor.executemany("""
        INSERT INTO departments (name, icon, doctor_count, specialty_key)
        VALUES (?, ?, ?, ?)
    """, departments_data)
    conn.commit()
    print("✅ Departments seeded!")

# ── FLASK SETUP ──────────────────────────
app = Flask(__name__)
CORS(app)

# ── LOAD MODEL ──────────────────────────
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

# ── ROUTES ──────────────────────────────

@app.route("/")
def home():
    return jsonify({"status": "API running"})

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

# ✅ GET all departments
@app.route("/departments", methods=["GET"])
def get_departments():
    cursor.execute("SELECT * FROM departments")
    rows = cursor.fetchall()
    return jsonify({
        "success": True,
        "departments": [
            {"id": r[0], "name": r[1], "icon": r[2], "doctor_count": r[3], "specialty_key": r[4]}
            for r in rows
        ]
    })

# ✅ GET doctors — optional ?specialty= filter
@app.route("/doctors", methods=["GET"])
def get_doctors():
    specialty = request.args.get("specialty", "").strip()
    if specialty:
        cursor.execute("SELECT * FROM doctors WHERE specialty = ?", (specialty,))
    else:
        cursor.execute("SELECT * FROM doctors")
    rows = cursor.fetchall()
    return jsonify({
        "success": True,
        "doctors": [
            {"id": r[0], "name": r[1], "specialty": r[2], "experience": r[3],
             "status": r[4], "initials": r[5], "color": r[6]}
            for r in rows
        ]
    })

# ✅ UPDATE doctor status
@app.route("/doctors/<int:doctor_id>/status", methods=["PATCH"])
def update_doctor_status(doctor_id):
    data   = request.get_json()
    status = data.get("status")
    if status not in ["available", "in_surgery", "off_duty"]:
        return jsonify({"error": "Invalid status. Use: available, in_surgery, off_duty"}), 400
    cursor.execute("UPDATE doctors SET status = ? WHERE id = ?", (status, doctor_id))
    conn.commit()
    return jsonify({"success": True, "id": doctor_id, "status": status})

# ── PREDICT ──────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data         = request.get_json()
        symptoms_in  = data.get("symptoms", [])
        patient_name = data.get("patient_name", "Unknown")
        patient_age  = data.get("patient_age", "N/A")

        if not symptoms_in:
            return jsonify({"error": "No symptoms"}), 400

        input_vec = np.zeros(len(feature_cols))
        for s in symptoms_in:
            s = s.lower().replace(" ", "_")
            if s in feature_cols:
                input_vec[feature_cols.index(s)] = 1

        probs    = model.predict_proba([input_vec])[0]
        pred_idx = np.argmax(probs)

        disease    = le.inverse_transform([pred_idx])[0]
        confidence = round(float(probs[pred_idx]) * 100, 2)
        doctor     = disease_doctor_map.get(disease, "General Physician")
        severity   = disease_severity_map.get(disease, "Medium")

        top3_idx = np.argsort(probs)[::-1][:3]
        top3 = [
            {"disease": le.inverse_transform([i])[0], "confidence": round(float(probs[i]) * 100, 2)}
            for i in top3_idx
        ]

        cursor.execute("""
            INSERT INTO reports (patient_name, patient_age, disease, doctor, severity, confidence)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (patient_name, patient_age, disease, doctor, severity, confidence))
        conn.commit()

        return jsonify({
            "success": True,
            "prediction": {"disease": disease, "doctor": doctor, "severity": severity, "confidence": confidence},
            "top3_predictions": top3,
            "emergency_alert": {
                "message": f"Patient {patient_name} has symptoms of {disease}. Severity: {severity}. Please consult a {doctor}."
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)