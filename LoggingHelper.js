/* ═══════════════════════════════════════════════════
   MediCare Hospital — LoggingHelper.js
   Helper functions for AI logs and Emergency alerts
   Use these functions in your dashboard pages
   ═══════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════
   AI PREDICTION LOGGING EXAMPLES
   ════════════════════════════════════════════════════ */

/**
 * Log an AI prediction when disease prediction is made
 * Use in: disease diagnosis pages, patient dashboard
 */
function logAIPredictionExample() {
  const prediction = {
    disease: 'Diabetes',
    severity: 'Medium',
    confidence: 0.85,
    symptoms: ['High Blood Sugar', 'Fatigue', 'Frequent Urination'],
    testResults: {
      bloodSugar: 180,
      hba1c: 7.2,
      bmi: 28.5
    },
    recommendation: 'Consult endocrinologist, start medication, lifestyle changes',
    modelVersion: 'v2.1'
  };
  
  const log = Auth.logAIPrediction(prediction);
  console.log('AI Prediction logged:', log);
  return log;
}

/**
 * Get all AI predictions for current user
 * Use in: patient dashboard to show history
 */
function getMyAIPredictions() {
  const user = Auth.getUser();
  const predictions = Auth.getAIPredictions(user?.id);
  console.log('My predictions:', predictions);
  return predictions;
}

/**
 * Get latest AI prediction
 * Use in: dashboard to show recent diagnosis
 */
function getLatestAIPrediction() {
  const user = Auth.getUser();
  const latest = Auth.getLatestPrediction(user?.id);
  console.log('Latest prediction:', latest);
  return latest;
}

/**
 * Display AI predictions in table format on dashboard
 */
function displayAIPredictions(containerId) {
  const predictions = getMyAIPredictions();
  const container = document.getElementById(containerId);
  
  if (!container || predictions.length === 0) return;
  
  let html = '<table class="predictions-table"><tr><th>Date</th><th>Disease</th><th>Severity</th><th>Confidence</th></tr>';
  
  predictions.forEach(pred => {
    const date = new Date(pred.timestamp).toLocaleDateString();
    html += `<tr>
      <td>${date}</td>
      <td>${pred.disease}</td>
      <td>${pred.severity}</td>
      <td>${(pred.confidence * 100).toFixed(0)}%</td>
    </tr>`;
  });
  
  html += '</table>';
  container.innerHTML = html;
}

/* ════════════════════════════════════════════════════
   EMERGENCY ALERT LOGGING EXAMPLES
   ════════════════════════════════════════════════════ */

/**
 * Log an emergency alert when patient is in danger
 * Use in: emergency response pages, critical alerts
 */
function logEmergencyAlertExample() {
  const alert = {
    severity: 'Critical',
    message: 'Severe chest pain with rapid heart rate',
    location: 'Home - 42 Street, Mumbai',
    symptoms: ['Chest Pain', 'Shortness of Breath', 'Dizziness'],
    vitals: {
      heartRate: 120,
      bloodPressure: '180/110',
      oxygen: 88
    },
    contactDoctor: true,
    ambulanceRequired: true,
    notes: 'Patient reports pain radiating to left arm'
  };
  
  const log = Auth.logEmergencyAlert(alert);
  console.log('Emergency alert logged:', log);
  return log;
}

/**
 * Get all active emergencies (for doctors dashboard)
 * Use in: doctor dashboard to see current emergencies
 */
function getActiveEmergencies() {
  const emergencies = Auth.getActiveEmergencies();
  console.log('Active emergencies:', emergencies);
  return emergencies;
}

/**
 * Get all emergency alerts (including resolved ones)
 * Use in: patient/doctor to view alert history
 */
function getAllEmergencyAlerts(userId = null) {
  const alerts = Auth.getEmergencyAlerts(userId);
  console.log('All alerts:', alerts);
  return alerts;
}

/**
 * Resolve an emergency alert
 * Use in: doctor dashboard when emergency is handled
 */
function resolveEmergency(alertId, resolution) {
  const resolved = Auth.resolveEmergencyAlert(alertId, resolution);
  console.log('Emergency resolved:', resolved);
  return resolved;
}

/**
 * Display active emergencies for doctor dashboard
 */
function displayActiveEmergencies(containerId) {
  const emergencies = getActiveEmergencies();
  const container = document.getElementById(containerId);
  
  if (!container || emergencies.length === 0) {
    if (container) container.innerHTML = '<p>No active emergencies</p>';
    return;
  }
  
  let html = '<div class="emergencies-list">';
  
  emergencies.forEach(emergency => {
    const date = new Date(emergency.timestamp).toLocaleString();
    html += `
      <div class="emergency-card severity-${emergency.severity.toLowerCase()}">
        <h4>${emergency.userName} - ${emergency.severity}</h4>
        <p><strong>Message:</strong> ${emergency.message}</p>
        <p><strong>Location:</strong> ${emergency.location}</p>
        <p><strong>Time:</strong> ${date}</p>
        <button onclick="resolveEmergency('${emergency.id}', 'Handled by Dr. X')">Mark Resolved</button>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

/**
 * Display emergency alert history
 */
function displayEmergencyHistory(containerId) {
  const alerts = getAllEmergencyAlerts();
  const container = document.getElementById(containerId);
  
  if (!container || alerts.length === 0) {
    if (container) container.innerHTML = '<p>No emergency alerts</p>';
    return;
  }
  
  let html = '<table class="alerts-table"><tr><th>Date</th><th>Patient</th><th>Severity</th><th>Message</th><th>Status</th></tr>';
  
  alerts.forEach(alert => {
    const date = new Date(alert.timestamp).toLocaleDateString();
    html += `<tr class="status-${alert.status}">
      <td>${date}</td>
      <td>${alert.userName}</td>
      <td>${alert.severity}</td>
      <td>${alert.message}</td>
      <td><span class="badge ${alert.status}">${alert.status}</span></td>
    </tr>`;
  });
  
  html += '</table>';
  container.innerHTML = html;
}

/* ════════════════════════════════════════════════════
   DASHBOARD STATS EXAMPLES
   ════════════════════════════════════════════════════ */

/**
 * Get dashboard statistics for current user
 * Use in: dashboard header to show quick stats
 */
function getDashboardStats() {
  const stats = Auth.getDashboardStats();
  console.log('Dashboard stats:', stats);
  return stats;
}

/**
 * Display dashboard stats in card format
 */
function displayDashboardStats(containerId) {
  const stats = getDashboardStats();
  const container = document.getElementById(containerId);
  
  if (!container) return;
  
  let html = '<div class="stats-container">';
  
  Object.entries(stats).forEach(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
    
    html += `
      <div class="stat-card">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

/* ════════════════════════════════════════════════════
   DOCTOR-PATIENT LINKAGE EXAMPLES
   ════════════════════════════════════════════════════ */

/**
 * Assign a patient to a doctor
 * Use in: admin panel or doctor assignment page
 */
function assignPatientToDoctor(patientId, doctorId) {
  Auth.assignPatientToDoctor(patientId, doctorId);
  console.log(`Patient ${patientId} assigned to Doctor ${doctorId}`);
}

/**
 * Get the doctor assigned to a patient
 * Use in: patient portal to show assigned doctor
 */
function getMyAssignedDoctor() {
  const user = Auth.getUser();
  const doctor = Auth.getDoctorForPatient(user?.id);
  console.log('My assigned doctor:', doctor);
  return doctor;
}

/**
 * Get all patients assigned to current doctor
 * Use in: doctor dashboard to see patient list
 */
function getMyPatients() {
  const patients = Auth.getPatientsForDoctor();
  console.log('My patients:', patients);
  return patients;
}

/**
 * Display assigned patients for doctor
 */
function displayMyPatients(containerId) {
  const patients = getMyPatients();
  const container = document.getElementById(containerId);
  
  if (!container || patients.length === 0) {
    if (container) container.innerHTML = '<p>No patients assigned</p>';
    return;
  }
  
  let html = '<div class="patients-list">';
  
  patients.forEach(patient => {
    html += `
      <div class="patient-card">
        <h4>${patient.name}</h4>
        <p><strong>Age:</strong> ${patient.age}</p>
        <p><strong>Mobile:</strong> ${patient.mobile}</p>
        <p><strong>Member Since:</strong> ${new Date(patient.registeredAt).toLocaleDateString()}</p>
        <button onclick="viewPatientDetails('${patient.id}')">View Details</button>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

/* ════════════════════════════════════════════════════
   DATA MANAGEMENT (TESTING/DEBUG)
   ════════════════════════════════════════════════════ */

/**
 * View all localStorage data (for debugging)
 */
function viewAllStoredData() {
  const data = {};
  const keys = Object.keys(localStorage).filter(k => k.startsWith('mc_'));
  
  keys.forEach(key => {
    try {
      data[key] = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      data[key] = localStorage.getItem(key);
    }
  });
  
  console.table(data);
  return data;
}

/**
 * Clear all medical records (for testing)
 * WARNING: This deletes all data!
 */
function clearAllMedicalData() {
  if (confirm('Are you sure? This will delete ALL data!')) {
    Auth.clearAllData();
    console.log('All data cleared');
    window.location.reload();
  }
}

/**
 * Generate sample data for testing
 */
function generateSampleData() {
  // Sample prediction
  Auth.logAIPrediction({
    disease: 'Hypertension',
    severity: 'Mild',
    confidence: 0.92,
    symptoms: ['High Blood Pressure', 'Headaches'],
    testResults: { bloodPressure: '140/90', bmi: 26 },
    recommendation: 'Reduce salt, exercise daily',
    modelVersion: 'v2.1'
  });
  
  // Sample emergency
  Auth.logEmergencyAlert({
    severity: 'Medium',
    message: 'Acute abdominal pain',
    location: 'Hospital - ER',
    symptoms: ['Abdominal Pain', 'Nausea'],
    vitals: { heartRate: 100, bloodPressure: '130/85', oxygen: 98 },
    contactDoctor: true,
    ambulanceRequired: false,
    notes: 'Patient reports pain started 2 hours ago'
  });
  
  console.log('Sample data generated');
}
