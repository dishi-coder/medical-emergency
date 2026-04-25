/* ═══════════════════════════════════════════════
   MediCare Hospital — auth.js
   Shared auth logic — localStorage based
   Use karo: sabhi HTML pages mein include karo
   ═══════════════════════════════════════════════ */

const Auth = {

  /* ──────────────────────────────────────────
     CORE AUTH FUNCTIONS
     ────────────────────────────────────────── */

  /* ── Save login info ── */
  login(role, data) {
    localStorage.setItem('mc_logged_in', 'true');
    localStorage.setItem('mc_role', role);
    localStorage.setItem('mc_user', JSON.stringify(data));
    
    // Save user to appropriate list (for reference)
    this.saveUserToList(role, data);
  },

  /* ── Register new user ── */
  register(role, data) {
    // Add timestamp and ID
    data.id = 'id_' + Date.now();
    data.registeredAt = new Date().toISOString();
    data.password = data.password || '';
    
    // Save to users list
    const usersKey = role === 'patient' ? 'mc_patients' : 'mc_doctors';
    let users = JSON.parse(localStorage.getItem(usersKey) || '[]');
    users.push(data);
    localStorage.setItem(usersKey, JSON.stringify(users));
    
    // Auto-login after registration
    this.login(role, data);
    return data;
  },

  /* ── Save user to list ── */
  saveUserToList(role, data) {
    const usersKey = role === 'patient' ? 'mc_patients' : 'mc_doctors';
    let users = JSON.parse(localStorage.getItem(usersKey) || '[]');
    const existing = users.findIndex(u => u.mobile === data.mobile || u.id === data.id);
    if (existing >= 0) {
      users[existing] = { ...users[existing], ...data };
    } else {
      users.push(data);
    }
    localStorage.setItem(usersKey, JSON.stringify(users));
  },

  /* ── Logout ── */
  logout() {
    localStorage.removeItem('mc_logged_in');
    localStorage.removeItem('mc_role');
    localStorage.removeItem('mc_user');
    window.location.href = 'index.html';
  },

  /* ── Check if logged in ── */
  isLoggedIn() {
    return localStorage.getItem('mc_logged_in') === 'true';
  },

  /* ── Get role ── */
  getRole() {
    return localStorage.getItem('mc_role') || null;
  },

  /* ── Get user data ── */
  getUser() {
    const u = localStorage.getItem('mc_user');
    return u ? JSON.parse(u) : null;
  },

  /* ── Get initials from name ── */
  getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  /* ──────────────────────────────────────────
     AI PREDICTION LOGS
     ────────────────────────────────────────── */

  /* ── Add AI prediction log ── */
  logAIPrediction(prediction) {
    const user = this.getUser();
    if (!user) return;

    const log = {
      id: 'pred_' + Date.now(),
      userId: user.id,
      userRole: this.getRole(),
      userName: user.name,
      timestamp: new Date().toISOString(),
      ...prediction  // { disease, severity, confidence, symptoms, etc }
    };

    let logs = JSON.parse(localStorage.getItem('mc_ai_predictions') || '[]');
    logs.push(log);
    localStorage.setItem('mc_ai_predictions', JSON.stringify(logs));
    return log;
  },

  /* ── Get all AI prediction logs ── */
  getAIPredictions(userId = null) {
    let logs = JSON.parse(localStorage.getItem('mc_ai_predictions') || '[]');
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    return logs;
  },

  /* ── Get latest AI prediction ── */
  getLatestPrediction(userId = null) {
    const logs = this.getAIPredictions(userId);
    return logs.length > 0 ? logs[logs.length - 1] : null;
  },

  /* ──────────────────────────────────────────
     EMERGENCY ALERTS LOG
     ────────────────────────────────────────── */

  /* ── Log emergency alert ── */
  logEmergencyAlert(alert) {
    const user = this.getUser();
    const role = this.getRole();

    const log = {
      id: 'emergency_' + Date.now(),
      userId: user?.id || 'unknown',
      userRole: role,
      userName: user?.name || 'Unknown',
      timestamp: new Date().toISOString(),
      status: 'active',
      ...alert  // { severity, message, location, contactDoctor, etc }
    };

    let logs = JSON.parse(localStorage.getItem('mc_emergency_alerts') || '[]');
    logs.push(log);
    localStorage.setItem('mc_emergency_alerts', JSON.stringify(logs));
    return log;
  },

  /* ── Get all emergency alerts ── */
  getEmergencyAlerts(userId = null, status = null) {
    let logs = JSON.parse(localStorage.getItem('mc_emergency_alerts') || '[]');
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }
    if (status) {
      logs = logs.filter(log => log.status === status);
    }
    return logs;
  },

  /* ── Resolve emergency alert ── */
  resolveEmergencyAlert(alertId, resolution) {
    let logs = JSON.parse(localStorage.getItem('mc_emergency_alerts') || '[]');
    const idx = logs.findIndex(log => log.id === alertId);
    if (idx >= 0) {
      logs[idx].status = 'resolved';
      logs[idx].resolvedAt = new Date().toISOString();
      logs[idx].resolution = resolution;
      localStorage.setItem('mc_emergency_alerts', JSON.stringify(logs));
      return logs[idx];
    }
    return null;
  },

  /* ── Get active emergencies ── */
  getActiveEmergencies() {
    return this.getEmergencyAlerts(null, 'active');
  },

  /* ··────────────────────────────────────────
     DOCTOR PATIENT LINKAGE
     ────────────────────────────────────────── */

  /* ── Assign patient to doctor ── */
  assignPatientToDoctor(patientId, doctorId) {
    let assignments = JSON.parse(localStorage.getItem('mc_patient_doctor_map') || '{}');
    assignments[patientId] = doctorId;
    localStorage.setItem('mc_patient_doctor_map', JSON.stringify(assignments));
  },

  /* ── Get doctor for patient ── */
  getDoctorForPatient(patientId) {
    let assignments = JSON.parse(localStorage.getItem('mc_patient_doctor_map') || '{}');
    const doctorId = assignments[patientId];
    if (!doctorId) return null;

    let doctors = JSON.parse(localStorage.getItem('mc_doctors') || '[]');
    return doctors.find(d => d.id === doctorId);
  },

  /* ── Get patients for doctor ── */
  getPatientsForDoctor(doctorId) {
    const doctor = this.getUser();
    if (!doctor || this.getRole() !== 'doctor') return [];

    let assignments = JSON.parse(localStorage.getItem('mc_patient_doctor_map') || '{}');
    let patients = JSON.parse(localStorage.getItem('mc_patients') || '[]');

    const patientIds = Object.entries(assignments)
      .filter(([_, dId]) => dId === (doctor.id || doctorId))
      .map(([pId, _]) => pId);

    return patients.filter(p => patientIds.includes(p.id));
  },

  /* ──────────────────────────────────────────
     GENERAL DATA FUNCTIONS
     ────────────────────────────────────────── */

  /* ── Clear all data (for testing) ── */
  clearAllData() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('mc_'));
    keys.forEach(k => localStorage.removeItem(k));
  },

  /* ── Get dashboard stats ── */
  getDashboardStats() {
    const user = this.getUser();
    const role = this.getRole();

    if (role === 'doctor') {
      return {
        patients: this.getPatientsForDoctor(user?.id).length,
        emergencies: this.getActiveEmergencies().length,
        predictions: this.getAIPredictions().length,
      };
    } else {
      return {
        predictions: this.getAIPredictions(user?.id).length,
        emergencies: this.getEmergencyAlerts(user?.id).length,
      };
    }
  },

  /* ── Update navbar on index.html ── */
  updateNavbar() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    if (this.isLoggedIn()) {
      const user = this.getUser();
      const role = this.getRole();
      const name = user?.name || (role === 'doctor' ? 'Doctor' : 'Patient');
      const initials = this.getInitials(name);
      const dashLink = role === 'doctor' ? 'doctor-dashboard.html' : 'patient-dashboard.html';

      navRight.innerHTML = `
        <a href="${dashLink}" class="nav-profile-btn">
          <div class="nav-avatar">${initials}</div>
          <div class="nav-profile-info">
            <div class="nav-profile-name">${name}</div>
            <div class="nav-profile-role">${role === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}</div>
          </div>
        </a>
        <button class="btn btn-logout" onclick="Auth.logout()">Logout</button>
      `;
    } else {
      navRight.innerHTML = `
        <a href="patient-login.html" class="btn btn-outline">Patient Login</a>
        <a href="doctor-login.html" class="btn btn-blue">Doctor Login</a>
      `;
    }
  },

  /* ── Protect dashboard pages ──
     Call this on dashboard pages to redirect if not logged in ── */
  requireLogin(role) {
    if (!this.isLoggedIn()) {
      window.location.href = role === 'doctor' ? 'doctor-login.html' : 'patient-login.html';
      return false;
    }
    if (role && this.getRole() !== role) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};