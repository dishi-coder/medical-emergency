/* ═══════════════════════════════════════════════
   MediCare Hospital — doctor-dashboard.js
   Handles: doctor overview, patients, emergencies,
            AI predictions, alert history
   ═══════════════════════════════════════════════ */

// ── Validate login using Auth ──
Auth.requireLogin('doctor');

/* ════════════════════════════════════════════════
   INITIALIZE DASHBOARD WITH DOCTOR DATA
   ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadDoctorData();
  loadDashboardStats();
  loadEmergencies();
  loadPatients();
  loadPredictions();
  loadAlertHistory();
});

function loadDoctorData() {
  const doctor = Auth.getUser();
  if (!doctor) return;

  // Update sidebar
  const initials = Auth.getInitials(doctor.name);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = doctor.name;
  document.getElementById('sidebar-spec').textContent = 'Specialisation: ' + (doctor.specialisation || 'General');

  // Update topbar
  document.getElementById('topbar-greeting').textContent = 'Welcome, ' + doctor.name;
  document.getElementById('topbar-avatar').textContent = initials;
}

function loadDashboardStats() {
  const patients = Auth.getPatientsForDoctor();
  const emergencies = Auth.getActiveEmergencies();
  const predictions = Auth.getAIPredictions();
  const allAlerts = Auth.getEmergencyAlerts();

  // Update stat cards
  document.getElementById('stat-patients').textContent = patients.length;
  document.getElementById('stat-patients-meta').textContent = patients.length > 0 ? patients.length + ' active' : 'No patients';

  document.getElementById('stat-emergencies').textContent = emergencies.length;
  document.getElementById('emergency-badge').textContent = emergencies.length;
  document.getElementById('stat-emergencies-meta').textContent = emergencies.length > 0 ? 'URGENT' : 'None';

  document.getElementById('stat-predictions').textContent = predictions.length;
  document.getElementById('stat-predictions-meta').textContent = 'All time';

  const resolved = allAlerts.filter(a => a.status === 'resolved').length;
  const resolvedRate = allAlerts.length > 0 ? ((resolved / allAlerts.length) * 100).toFixed(0) : '--';
  document.getElementById('stat-resolution').textContent = resolvedRate + '%';
  document.getElementById('stat-resolution-meta').textContent = resolved + ' resolved out of ' + allAlerts.length;

  // Display active emergencies
  displayActiveEmergencies(emergencies);

  // Display recent patients
  displayRecentPatients(patients.slice(0, 3));
}

function displayActiveEmergencies(emergencies) {
  const container = document.getElementById('active-emergencies-list');

  if (emergencies.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No active emergencies</div>';
    return;
  }

  let html = '';
  emergencies.forEach(alert => {
    const time = new Date(alert.timestamp).toLocaleString();
    const sevClass = alert.severity === 'Critical' ? 'red' : alert.severity === 'High' ? 'yellow' : 'orange';
    html += `
      <div class="emergency-card emergency-active">
        <div style="flex:1;">
          <h4 style="margin:0 0 5px 0; color:#991b1b;">${alert.userName}</h4>
          <p style="margin:0 0 3px 0; font-size:13px;"><strong>Severity:</strong> ${alert.severity}</p>
          <p style="margin:0 0 3px 0; font-size:13px;"><strong>Message:</strong> ${alert.message}</p>
          <p style="margin:0 0 3px 0; font-size:12px; color:#666;"><strong>Location:</strong> ${alert.location}</p>
          <p style="margin:0; font-size:12px; color:#999;">${time}</p>
        </div>
        <button onclick="resolveEmergency('${alert.id}')" style="padding:8px 12px; background:#dc2626; color:white; border:none; border-radius:6px; cursor:pointer;">
          Resolve
        </button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function displayRecentPatients(patients) {
  const container = document.getElementById('recent-patients-list');

  if (patients.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No patients yet</div>';
    return;
  }

  let html = '<div class="patient-list">';
  patients.forEach(patient => {
    const initials = Auth.getInitials(patient.name);
    html += `
      <div class="patient-item">
        <div style="display:flex; align-items:center; gap:10px; flex:1;">
          <div style="width:40px; height:40px; border-radius:50%; background:#667eea; color:white; display:flex; align-items:center; justify-content:center; font-weight:600;">
            ${initials}
          </div>
          <div>
            <div style="font-weight:600; color:#333;">${patient.name}</div>
            <div style="font-size:12px; color:#999;">${patient.mobile || patient.id}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; color:#666;">Age: ${patient.age || '?'}</div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function displayEmergencies() {
  const emergencies = Auth.getEmergencyAlerts();
  const container = document.getElementById('emergencies-table');

  if (emergencies.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No emergencies</div>';
    return;
  }

  let html = `
    <table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f3f4f6; border-bottom:2px solid #e5e7eb;">
        <th style="padding:12px; text-align:left; font-weight:600;">Patient</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Severity</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Message</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Status</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Date</th>
      </tr>
  `;

  emergencies.forEach(alert => {
    const date = new Date(alert.timestamp).toLocaleDateString();
    const sevColor = alert.severity === 'Critical' ? '#dc2626' : alert.severity === 'High' ? '#ea580c' : '#f59e0b';
    html += `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px;">${alert.userName}</td>
        <td style="padding:12px;"><span style="color:${sevColor}; font-weight:600;">${alert.severity}</span></td>
        <td style="padding:12px; max-width:300px;">${alert.message}</td>
        <td style="padding:12px;"><span style="background:${alert.status === 'active' ? '#fee2e2' : '#e0e7ff'}; padding:4px 8px; border-radius:4px; font-size:12px;">${alert.status}</span></td>
        <td style="padding:12px; font-size:12px;">${date}</td>
      </tr>
    `;
  });

  html += '</table>';
  container.innerHTML = html;
}

function displayPatients() {
  const patients = Auth.getPatientsForDoctor();
  const container = document.getElementById('patients-table');

  if (patients.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No patients assigned</div>';
    return;
  }

  let html = `
    <table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f3f4f6; border-bottom:2px solid #e5e7eb;">
        <th style="padding:12px; text-align:left; font-weight:600;">Name</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Mobile</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Age</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Member Since</th>
      </tr>
  `;

  patients.forEach(patient => {
    const joinDate = new Date(patient.registeredAt).toLocaleDateString();
    html += `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px;">${patient.name}</td>
        <td style="padding:12px;">${patient.mobile || 'N/A'}</td>
        <td style="padding:12px;">${patient.age || '?'}</td>
        <td style="padding:12px; font-size:12px;">${joinDate}</td>
      </tr>
    `;
  });

  html += '</table>';
  container.innerHTML = html;
}

function displayPredictions() {
  const predictions = Auth.getAIPredictions();
  const container = document.getElementById('predictions-table');

  if (predictions.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No predictions</div>';
    return;
  }

  let html = `
    <table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f3f4f6; border-bottom:2px solid #e5e7eb;">
        <th style="padding:12px; text-align:left; font-weight:600;">Patient</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Disease</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Severity</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Confidence</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Date</th>
      </tr>
  `;

  predictions.slice(-20).reverse().forEach(pred => {
    const date = new Date(pred.timestamp).toLocaleDateString();
    html += `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px;">${pred.userName}</td>
        <td style="padding:12px;">${pred.disease}</td>
        <td style="padding:12px;">${pred.severity}</td>
        <td style="padding:12px;">${(pred.confidence * 100).toFixed(0)}%</td>
        <td style="padding:12px; font-size:12px;">${date}</td>
      </tr>
    `;
  });

  html += '</table>';
  container.innerHTML = html;
}

function displayAlertHistory() {
  const alerts = Auth.getEmergencyAlerts();
  const container = document.getElementById('alerts-log-table');

  if (alerts.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No alert history</div>';
    return;
  }

  let html = `
    <table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f3f4f6; border-bottom:2px solid #e5e7eb;">
        <th style="padding:12px; text-align:left; font-weight:600;">Patient</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Type</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Status</th>
        <th style="padding:12px; text-align:left; font-weight:600;">Date</th>
      </tr>
  `;

  alerts.slice(-50).reverse().forEach(alert => {
    const date = new Date(alert.timestamp).toLocaleDateString();
    const statusColor = alert.status === 'active' ? '#fee2e2' : '#e0e7ff';
    html += `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px;">${alert.userName}</td>
        <td style="padding:12px; font-size:14px;">${alert.severity}</td>
        <td style="padding:12px;"><span style="background:${statusColor}; padding:4px 8px; border-radius:4px; font-size:12px;">${alert.status}</span></td>
        <td style="padding:12px; font-size:12px;">${date}</td>
      </tr>
    `;
  });

  html += '</table>';
  container.innerHTML = html;
}

// Call all display functions
function loadEmergencies() {
  displayEmergencies();
}

function loadPatients() {
  displayPatients();
}

function loadPredictions() {
  displayPredictions();
}

function loadAlertHistory() {
  displayAlertHistory();
}

/* ════════════════════════════════════════════════
   SECTION NAVIGATION
   ════════════════════════════════════════════════ */
function showSection(name, linkEl) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('sec-' + name);
  if (target) target.classList.add('active');
  if (linkEl) linkEl.classList.add('active');

  const titles = {
    overview:      'Overview',
    emergencies:   'Emergency Alerts',
    patients:      'My Patients',
    predictions:   'AI Predictions',
    'alerts-log':  'Alert History',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
  }
}

/* ════════════════════════════════════════════════
   EMERGENCY MANAGEMENT
   ════════════════════════════════════════════════ */
function resolveEmergency(alertId) {
  if (confirm('Mark this emergency as resolved?')) {
    Auth.resolveEmergencyAlert(alertId, 'Resolved by ' + Auth.getUser().name);
    alert('Emergency marked as resolved');
    loadDashboardStats();
    displayEmergencies();
  }
}

/* ════════════════════════════════════════════════
   SIDEBAR TOGGLE
   ════════════════════════════════════════════════ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.style.transform === 'translateX(-100%)') {
    sidebar.style.transform = 'translateX(0)';
  } else {
    sidebar.style.transform = 'translateX(-100%)';
  }
}
