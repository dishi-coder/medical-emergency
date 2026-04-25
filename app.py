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

conn.commit()

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

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        symptoms_in = data.get("symptoms", [])
        patient_name = data.get("patient_name", "Unknown")
        patient_age = data.get("patient_age", "N/A")

        if not symptoms_in:
            return jsonify({"error": "No symptoms"}), 400

        # Input vector
        input_vec = np.zeros(len(feature_cols))
        for s in symptoms_in:
            s = s.lower().replace(" ", "_")
            if s in feature_cols:
                input_vec[feature_cols.index(s)] = 1

        # Prediction
        probs = model.predict_proba([input_vec])[0]
        pred_idx = np.argmax(probs)

        disease = le.inverse_transform([pred_idx])[0]
        confidence = round(float(probs[pred_idx]) * 100, 2)
        doctor = disease_doctor_map.get(disease, "General Physician")
        severity = disease_severity_map.get(disease, "Medium")

        # ✅ SAVE TO DB
        cursor.execute("""
        INSERT INTO reports (patient_name, patient_age, disease, doctor, severity, confidence)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (patient_name, patient_age, disease, doctor, severity, confidence))

        conn.commit()

        return jsonify({
            "success": True,
            "disease": disease,
            "doctor": doctor,
            "severity": severity,
            "confidence": confidence
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── RUN ──────────────────────────────
if __name__ == "__main__":
    app.run(debug=True)