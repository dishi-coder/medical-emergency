# MediCare Hospital - LocalStorage Data Management Guide

## Overview
Your medical project now has a **complete localStorage-based authentication and data management system**. All data is stored locally in the browser and persists across sessions.

---

## 1. Authentication System

### User Login/Registration Flow

#### Patient Registration & Login
```javascript
// When patient registers:
- Name, Mobile, Age, Password captured
- Auth.register('patient', userData) saves to localStorage
- User auto-logged in after registration
- Redirects to patient-dashboard.html

// Patient localStorage structure:
{
  mc_logged_in: 'true',
  mc_role: 'patient',
  mc_user: { id, name, mobile, age, password, registeredAt },
  mc_patients: [{ all registered patients }]
}
```

#### Doctor Login/Registration
```javascript
// When doctor logs in:
- Doctor ID, Contact (mobile/email), Password, Specialisation
- Auth.login('doctor', userData) saves to localStorage
- Redirects to doctor-dashboard.html

// Doctor localStorage structure:
{
  mc_logged_in: 'true',
  mc_role: 'doctor',
  mc_user: { id, name, doctorId, contact, specialisation, registeredAt },
  mc_doctors: [{ all registered doctors }]
}
```

### Check Authentication Status
```javascript
// In your dashboard pages, add this at the top:
document.addEventListener('DOMContentLoaded', () => {
  Auth.requireLogin('patient'); // For patient pages
  // or
  Auth.requireLogin('doctor');  // For doctor pages
});

// This will redirect to login if user is not logged in
```

---

## 2. AI Prediction Logging

### Log a Prediction
```javascript
function makeAIPrediction() {
  // Your prediction logic here
  const prediction = {
    disease: 'Diabetes',
    severity: 'Medium',
    confidence: 0.85,
    symptoms: ['High Blood Sugar', 'Fatigue'],
    testResults: {
      bloodSugar: 180,
      hba1c: 7.2,
      bmi: 28.5
    },
    recommendation: 'Consult endocrinologist',
    modelVersion: 'v2.1'
  };
  
  // Save to localStorage
  const log = Auth.logAIPrediction(prediction);
  console.log('Prediction saved:', log);
}
```

### localStorage Structure for Predictions
```javascript
// mc_ai_predictions = [
{
  id: 'pred_1234567890',
  userId: 'id_xxx',
  userRole: 'patient',
  userName: 'Ravi Kumar',
  timestamp: '2026-04-25T10:30:00.000Z',
  disease: 'Diabetes',
  severity: 'Medium',
  confidence: 0.85,
  symptoms: [...],
  testResults: {...},
  recommendation: 'Consult endocrinologist',
  modelVersion: 'v2.1'
}
// ]
```

### Retrieve Predictions
```javascript
// Get all predictions for current user
const myPredictions = Auth.getAIPredictions();

// Get predictions for specific user (doctor view)
const patientPredictions = Auth.getAIPredictions(patientId);

// Get the most recent prediction
const latest = Auth.getLatestPrediction();

// Display in dashboard
displayAIPredictions('predictions-container');
```

---

## 3. Emergency Alerts Logging

### Log an Emergency Alert
```javascript
function raiseEmergencyAlert() {
  const alert = {
    severity: 'Critical',  // Critical, High, Medium, Low
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
  
  // Save to localStorage
  const log = Auth.logEmergencyAlert(alert);
  console.log('Emergency logged:', log);
}
```

### localStorage Structure for Emergencies
```javascript
// mc_emergency_alerts = [
{
  id: 'emergency_1234567890',
  userId: 'id_xxx',
  userRole: 'patient',
  userName: 'Ravi Kumar',
  timestamp: '2026-04-25T10:30:00.000Z',
  status: 'active', // or 'resolved'
  severity: 'Critical',
  message: 'Severe chest pain...',
  location: 'Home - 42 Street',
  symptoms: [...],
  vitals: {...},
  contactDoctor: true,
  ambulanceRequired: true,
  notes: 'Patient reports...',
  resolvedAt: '2026-04-25T10:45:00.000Z', // if resolved
  resolution: 'Handled by Dr. X'
}
// ]
```

### Retrieve and Manage Alerts
```javascript
// Get all active emergencies (for doctor dashboard)
const activeEmergencies = Auth.getActiveEmergencies();

// Get all alerts (including resolved)
const allAlerts = Auth.getEmergencyAlerts();

// Get alerts for specific patient
const patientAlerts = Auth.getEmergencyAlerts(patientId);

// Get only resolved alerts
const resolvedAlerts = Auth.getEmergencyAlerts(null, 'resolved');

// Resolve an emergency when handled
const resolved = Auth.resolveEmergencyAlert(alertId, 'Handled by Dr. Sharma');

// Display active emergencies
displayActiveEmergencies('emergencies-container');
```

---

## 4. Doctor-Patient Linkage

### Assign Patient to Doctor
```javascript
// Doctor accepts/is assigned to patient
Auth.assignPatientToDoctor(patientId, doctorId);

// localStorage: mc_patient_doctor_map = {
//   "id_patient1": "id_doctor1",
//   "id_patient2": "id_doctor1"
// }
```

### Get Doctor for Patient
```javascript
// Patient wants to know their doctor
const myDoctor = Auth.getDoctorForPatient(patientId);
console.log('Your doctor:', myDoctor);
```

### Get Patients for Doctor
```javascript
// Doctor sees their patient list
const myPatients = Auth.getPatientsForDoctor();

// Display on dashboard
displayMyPatients('patients-container');
```

---

## 5. Dashboard Implementation Examples

### Patient Dashboard
```html
<!-- patient-dashboard.html -->
<script src="Auth.js"></script>
<script src="LoggingHelper.js"></script>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Validate login
    Auth.requireLogin('patient');
    
    // Get current user
    const user = Auth.getUser();
    document.getElementById('user-name').textContent = user.name;
    
    // Display stats
    displayDashboardStats('stats-container');
    
    // Display recent predictions
    displayAIPredictions('predictions-container');
    
    // Display alert history
    displayEmergencyHistory('alerts-container');
  });
</script>

<div id="stats-container"></div>
<div id="predictions-container"></div>
<div id="alerts-container"></div>
```

### Doctor Dashboard
```html
<!-- doctor-dashboard.html -->
<script src="Auth.js"></script>
<script src="LoggingHelper.js"></script>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Validate login
    Auth.requireLogin('doctor');
    
    // Display dashboard stats
    displayDashboardStats('stats-container');
    
    // Display active emergencies
    displayActiveEmergencies('emergencies-container');
    
    // Display assigned patients
    displayMyPatients('patients-container');
  });
</script>

<div id="stats-container"></div>
<div id="emergencies-container"></div>
<div id="patients-container"></div>
```

---

## 6. localStorage Keys Reference

| Key | Purpose | Type |
|-----|---------|------|
| `mc_logged_in` | Login status | string ('true'/'false') |
| `mc_role` | User type | string ('patient'/'doctor') |
| `mc_user` | Current user data | JSON object |
| `mc_patients` | All registered patients | JSON array |
| `mc_doctors` | All registered doctors | JSON array |
| `mc_ai_predictions` | All AI prediction logs | JSON array |
| `mc_emergency_alerts` | All emergency alerts | JSON array |
| `mc_patient_doctor_map` | Patient-doctor linkage | JSON object |

---

## 7. Common Use Cases

### Use Case 1: Patient Views Their Predictions
```javascript
function viewMyPredictions() {
  const predictions = Auth.getAIPredictions();
  console.log('My AI predictions:', predictions);
  
  predictions.forEach(pred => {
    console.log(`${pred.disease} (${pred.severity}): ${(pred.confidence*100)}%`);
  });
}
```

### Use Case 2: Doctor Views Active Emergencies
```javascript
function checkEmergencies() {
  const emergencies = Auth.getActiveEmergencies();
  console.log(`${emergencies.length} active emergencies`);
  
  emergencies.forEach(alert => {
    console.log(`${alert.severity}: ${alert.userName} - ${alert.message}`);
  });
}
```

### Use Case 3: Log and Track Health Data
```javascript
function trackHealthMetrics() {
  // Step 1: Patient inputs data
  const vitals = {
    bloodPressure: '120/80',
    heartRate: 72,
    oxygen: 99
  };
  
  // Step 2: Run AI prediction with the data
  const prediction = {
    disease: 'Normal',
    severity: 'None',
    confidence: 0.99,
    testResults: vitals,
    recommendation: 'Continue regular monitoring'
  };
  
  // Step 3: Log the prediction
  Auth.logAIPrediction(prediction);
  
  // Step 4: Display to patient
  console.log('Health status: Normal - Keep up good habits!');
}
```

---

## 8. Testing Your Integration

### Using LoggingHelper Functions
```javascript
// In browser console on patient-dashboard:
logAIPredictionExample();        // Log a sample prediction
getMyAIPredictions();            // View all predictions
displayDashboardStats('container-id');  // Show stats

// In browser console on doctor-dashboard:
logEmergencyAlertExample();      // Log sample emergency
getActiveEmergencies();          // View active emergencies
displayMyPatients('container-id');      // Show patients

// View all data:
viewAllStoredData();             // See everything in console

// Generate test data:
generateSampleData();            // Create sample predictions/alerts
```

### Debugging Tips
```javascript
// Check current user
Auth.getUser();

// Check login status
Auth.isLoggedIn();

// Check role
Auth.getRole();

// View all predictions
Auth.getAIPredictions();

// View all alerts
Auth.getEmergencyAlerts();

// View all stats
Auth.getDashboardStats();
```

---

## 9. Data Persistence

- **All data is stored in browser's localStorage**
- Data persists across browser sessions
- Data is NOT synced to server (local only in demo)
- Clearing browser cache will delete all data
- Each browser has separate storage

---

## 10. Next Steps

1. **Include scripts in your dashboard pages:**
   ```html
   <script src="Auth.js"></script>
   <script src="LoggingHelper.js"></script>
   ```

2. **Call Auth.requireLogin() on page load to protect pages**

3. **Use logAIPrediction() and logEmergencyAlert() in your features**

4. **Create UI components for displaying the logged data**

5. **Integrate with your Flask backend for API calls (future)**

---

## API Reference

### Auth.login(role, data)
Save login info to localStorage and set session

### Auth.register(role, data)
Create new user account and auto-login

### Auth.logout()
Clear session and redirect to login

### Auth.isLoggedIn()
Check if user is currently logged in

### Auth.getUser()
Get current logged-in user's data

### Auth.getRole()
Get current user's role (patient/doctor)

### Auth.logAIPrediction(prediction)
Save AI prediction to logs

### Auth.getAIPredictions(userId)
Get all predictions (filter by userId optional)

### Auth.getLatestPrediction(userId)
Get most recent prediction

### Auth.logEmergencyAlert(alert)
Save emergency alert to logs

### Auth.getEmergencyAlerts(userId, status)
Get emergency alerts (filter by userId/status optional)

### Auth.getActiveEmergencies()
Get all unresolved emergencies

### Auth.resolveEmergencyAlert(alertId, resolution)
Mark emergency as resolved

### Auth.assignPatientToDoctor(patientId, doctorId)
Link patient to doctor

### Auth.getDoctorForPatient(patientId)
Get assigned doctor for patient

### Auth.getPatientsForDoctor(doctorId)
Get all patients assigned to doctor

### Auth.getDashboardStats()
Get dashboard statistics for current user

### Auth.requireLogin(role)
Validate login and redirect if not authenticated

---

## Questions or Issues?

Check the console (F12 → Console tab) for error messages.
Use `viewAllStoredData()` to inspect all saved data.
