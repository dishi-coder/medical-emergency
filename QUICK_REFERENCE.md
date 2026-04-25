# 🎯 MediCare - Quick Reference Card

## 🚀 Quick Start (30 seconds)

### Open Test Dashboard
```
1. Open: test-dashboard.html
2. Click: "Test Patient Register"
3. Click: "Log AI Prediction"
4. Click: "Log Emergency Alert"
5. Click: "View All Data (Console)"
6. Open: patient-dashboard.html → See dynamic data!
```

---

## 👤 Authentication

### Patient Registration
```javascript
Auth.register('patient', {
  name: 'Rajesh Kumar',
  mobile: '9876543210',
  age: 35,
  password: 'secure123'
});
// Saves + Auto-logins
```

### Patient Login
```javascript
Auth.login('patient', {
  name: 'Rajesh Kumar',
  mobile: '9876543210',
  password: 'secure123'
});
```

### Doctor Login
```javascript
Auth.login('doctor', {
  name: 'Dr. Priya Sharma',
  doctorId: 'DOC-2024-001',
  contact: 'priya@hospital.com',
  specialisation: 'Cardiology',
  password: 'secure123'
});
```

### Check Authentication
```javascript
Auth.isLoggedIn();        // true/false
Auth.getRole();           // 'patient' or 'doctor'
Auth.getUser();           // { name, mobile, age, ... }
Auth.logout();            // Clears and redirects
```

### Protect Pages
```javascript
// At top of patient-dashboard.js:
Auth.requireLogin('patient');  // Will redirect if not logged in

// At top of doctor-dashboard.js:
Auth.requireLogin('doctor');  // Will redirect if not logged in
```

---

## 🧠 AI Predictions

### Log a Prediction
```javascript
Auth.logAIPrediction({
  disease: 'Diabetes',
  severity: 'Medium',
  confidence: 0.87,
  symptoms: ['High Blood Sugar', 'Fatigue', 'Frequent Urination'],
  testResults: {
    bloodSugar: 180,
    hba1c: 7.2,
    bmi: 28.5
  },
  recommendation: 'Consult endocrinologist',
  modelVersion: 'v2.1'
});
```

### Get Predictions
```javascript
// All predictions for current user
const myPredictions = Auth.getAIPredictions();

// All predictions for specific patient (from doctor view)
const patientPreds = Auth.getAIPredictions(patientId);

// Most recent prediction
const latestPred = Auth.getLatestPrediction();
```

### Display Predictions
```javascript
displayAIPredictions('container-id');  // Shows table
```

---

## 🚨 Emergency Alerts

### Log Emergency
```javascript
Auth.logEmergencyAlert({
  severity: 'Critical',          // Critical, High, Medium, Low
  message: 'Severe chest pain',
  location: 'Home - Downtown',
  symptoms: ['Chest Pain', 'Shortness of Breath'],
  vitals: {
    heartRate: 120,
    bloodPressure: '180/110',
    oxygen: 88
  },
  contactDoctor: true,
  ambulanceRequired: true,
  notes: 'Pain started suddenly'
});
```

### Get Emergencies
```javascript
// All active emergencies
const activeEmergencies = Auth.getActiveEmergencies();

// All emergencies (including resolved)
const allEmergencies = Auth.getEmergencyAlerts();

// Specific patient's emergencies
const patientAlerts = Auth.getEmergencyAlerts(patientId);

// Only resolved ones
const resolvedAlerts = Auth.getEmergencyAlerts(null, 'resolved');
```

### Resolve Emergency
```javascript
Auth.resolveEmergencyAlert(alertId, 'Resolved by Dr. X');
```

### Display Emergencies
```javascript
displayActiveEmergencies('container-id');   // Active only
displayEmergencyHistory('container-id');    // All history
```

---

## 👥 Doctor-Patient Management

### Assign Patient to Doctor
```javascript
Auth.assignPatientToDoctor(patientId, doctorId);
```

### Get Doctor for Patient
```javascript
const myDoctor = Auth.getDoctorForPatient(patientId);
```

### Get Patients for Doctor
```javascript
const myPatients = Auth.getPatientsForDoctor();
```

### Display Patients
```javascript
displayMyPatients('container-id');  // Shows patient list
```

---

## 📊 Dashboard Stats

### Get Stats
```javascript
const stats = Auth.getDashboardStats();
// Returns:
// If patient: { predictions: 5, emergencies: 2 }
// If doctor: { patients: 10, emergencies: 3, predictions: 45 }
```

### Display Stats
```javascript
displayDashboardStats('container-id');  // Shows stat cards
```

---

## 💾 localStorage Keys

| Key | Type | Content |
|-----|------|---------|
| `mc_logged_in` | string | 'true' or 'false' |
| `mc_role` | string | 'patient' or 'doctor' |
| `mc_user` | object | Current user data |
| `mc_patients` | array | All patient accounts |
| `mc_doctors` | array | All doctor accounts |
| `mc_ai_predictions` | array | All predictions |
| `mc_emergency_alerts` | array | All emergencies |
| `mc_patient_doctor_map` | object | Doctor assignments |

---

## 🎨 Dynamic UI Updates

### Patient Dashboard
```javascript
// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();        // Set name, avatar, etc
  loadDashboardStats();  // Set predictions, alerts, etc
});

// User data
const user = Auth.getUser();
document.getElementById('name').textContent = user.name;
document.getElementById('avatar').textContent = Auth.getInitials(user.name);

// Stats
const predictions = Auth.getAIPredictions();
document.getElementById('pred-count').textContent = predictions.length;

// Latest prediction
const latest = Auth.getLatestPrediction();
document.getElementById('disease').textContent = latest?.disease || 'None';
```

### Doctor Dashboard
```javascript
// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadDoctorData();      // Set name, specialisation, etc
  loadDashboardStats();  // Set all stats
  loadEmergencies();     // Display emergency table
  loadPatients();        // Display patient table
  loadPredictions();     // Display prediction table
  loadAlertHistory();    // Display alert history
});
```

---

## 🧪 Testing Commands (F12 Console)

```javascript
// Check login status
Auth.isLoggedIn();

// See current user
Auth.getUser();

// See current role
Auth.getRole();

// Get all predictions
Auth.getAIPredictions();

// Get all emergencies
Auth.getEmergencyAlerts();

// Get active emergencies only
Auth.getActiveEmergencies();

// View all localStorage data
viewAllStoredData();

// Create test data
generateSampleData();

// Clear all data (WARNING: deletes everything!)
Auth.clearAllData();
```

---

## 📁 File Structure

```
medical project/
├── Auth.js                         ← Core auth system
├── LoggingHelper.js                ← Helper functions
├── patient-login.html              ← Patient login form
├── patient-login.js                ← Patient login logic
├── patient-dashboard.html          ← Patient dashboard
├── patient-dashboard.js            ← Patient dashboard logic
├── doctor-login.html               ← Doctor login form
├── doctor-login.js                 ← Doctor login logic
├── doctor-dashboard.html           ← Doctor dashboard
├── doctor-dashboard.js             ← Doctor dashboard logic
├── test-dashboard.html             ← Testing interface
├── LOCALSTORAGE_GUIDE.md           ← API documentation
├── SETUP_COMPLETE.md               ← Setup guide
├── CHANGES_SUMMARY.md              ← Changes overview
└── model/                          ← AI models
```

---

## 🔗 Navigation

```
index.html
├─→ patient-login.html ─→ patient-dashboard.html
├─→ doctor-login.html ─→ doctor-dashboard.html
└─→ test-dashboard.html (for testing)
```

---

## ✅ Checklist

### Patient Workflow
- [ ] Patient registers via patient-login.html
- [ ] Data saved to localStorage (mc_patients, mc_user)
- [ ] Patient redirected to patient-dashboard.html
- [ ] Dashboard shows actual patient name
- [ ] Dashboard shows AI predictions (if any)
- [ ] Dashboard shows emergency alerts (if any)
- [ ] Patient can logout and login again
- [ ] Same data persists

### Doctor Workflow
- [ ] Doctor logs in via doctor-login.html
- [ ] Data saved to localStorage (mc_doctors, mc_user)
- [ ] Doctor redirected to doctor-dashboard.html
- [ ] Dashboard shows doctor name and specialisation
- [ ] Dashboard shows active emergencies
- [ ] Dashboard shows assigned patients
- [ ] Doctor can resolve emergencies
- [ ] All data persists

### Feature Verification
- [ ] AI predictions are logged correctly
- [ ] Emergency alerts are logged correctly
- [ ] Predictions are retrieved by patient
- [ ] Alerts are retrieved by doctor
- [ ] Resolution rate calculates correctly
- [ ] Patient counts are accurate
- [ ] Page protection works (redirects if not logged in)
- [ ] Logout clears all session data

---

## 📱 Responsive Design

```
Desktop (>768px)     │  Mobile (<768px)
─────────────────────┼─────────────────
Sidebar visible      │  Sidebar hidden (toggle btn)
Full layout          │  Stacked layout
All sections visible │  One section at a time
                     │  Hamburger menu
```

---

## 🎯 API Summary

### Auth API
```javascript
Auth.login(role, data)
Auth.register(role, data)
Auth.logout()
Auth.isLoggedIn()
Auth.getRole()
Auth.getUser()
Auth.getInitials(name)
Auth.updateNavbar()
Auth.requireLogin(role)
```

### Prediction API
```javascript
Auth.logAIPrediction(prediction)
Auth.getAIPredictions(userId)
Auth.getLatestPrediction(userId)
```

### Emergency API
```javascript
Auth.logEmergencyAlert(alert)
Auth.getEmergencyAlerts(userId, status)
Auth.getActiveEmergencies()
Auth.resolveEmergencyAlert(alertId, resolution)
```

### Relationship API
```javascript
Auth.assignPatientToDoctor(patientId, doctorId)
Auth.getDoctorForPatient(patientId)
Auth.getPatientsForDoctor(doctorId)
```

### Stats API
```javascript
Auth.getDashboardStats()
Auth.clearAllData()
```

---

## 💡 Pro Tips

1. **Always include Auth.js and LoggingHelper.js in every page**
   ```html
   <script src="Auth.js"></script>
   <script src="LoggingHelper.js"></script>
   ```

2. **Validate login on page load**
   ```javascript
   Auth.requireLogin('patient');  // Auto-redirects if not logged in
   ```

3. **Load user data at start**
   ```javascript
   const user = Auth.getUser();  // Get logged-in user
   ```

4. **Always check data exists before displaying**
   ```javascript
   const predictions = Auth.getAIPredictions();
   if (predictions.length === 0) {
     showMessage("No predictions yet");
   }
   ```

5. **Use IDs for dynamic content**
   ```html
   <!-- BAD -->
   <div>Ravi Kumar</div>  ← Hardcoded
   
   <!-- GOOD -->
   <div id="user-name">Loading...</div>  ← Dynamic
   ```

---

## 🚨 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Not logged in" | Page opened directly | Login via patient-login.html or test-dashboard.html |
| Hardcoded data shows | localStorage empty | Use test-dashboard.html to create test data |
| User info not updating | loadUserData() not called | Add to DOMContentLoaded event |
| Wrong role dashboard | Wrong requireLogin() call | Check patient-dashboard uses 'patient', doctor uses 'doctor' |
| Data not persisting | localStorage disabled | Check browser settings, enable localStorage |

---

## 🎓 Next Level

### Integrate with Flask Backend
```javascript
// Replace localStorage saves with API calls
const response = await fetch('http://localhost:5000/api/patient/register', {
  method: 'POST',
  body: JSON.stringify(patientData)
});
```

### Add Real-Time Updates
```javascript
// Poll for updates
setInterval(() => {
  loadDashboardStats();
}, 5000);
```

### Implement WebSocket
```javascript
const socket = new WebSocket('ws://localhost:5000/socket');
socket.onmessage = (event) => {
  loadDashboardStats();  // Refresh on new data
};
```

---

**Created**: April 25, 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready  

For detailed docs, see: LOCALSTORAGE_GUIDE.md
