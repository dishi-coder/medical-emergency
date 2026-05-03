/* ═══════════════════════════════════════════════
   MediCare Hospital — patient-dashboard.js
   ✅ Location redirect fix — dashStartTracking()
   ✅ tracking-active bug fixed
   ✅ All text in English
   ✅ Prediction unavailable bug fixed
   ✅ Map invalidateSize timing fixed (300ms)
   ════════════════════════════════════════════════ */

Auth.requireLogin('patient');

const BACKEND_URL = 'http://127.0.0.1:5000';

let locationSharing = true;
let lastPrediction = null;

let dashMap = null;
let dashMarker = null;
let dashAccCircle = null;
let dashWatchId = null;
let dashUpdateCount = 0;
let dashCurrentLat = null;
let dashCurrentLng = null;
let dashTileLayer = null;
const TILE_STREET = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';




/* ════════════════════════════════════════════════
   INITIALIZE
   ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const savedPrediction = JSON.parse(localStorage.getItem('lastPrediction') || 'null');
  const savedSymptoms = JSON.parse(localStorage.getItem('lastSymptoms') || '[]');

  if (
    savedPrediction &&
    savedPrediction.primary_diagnosis &&
    savedPrediction.primary_diagnosis !== 'Prediction unavailable'
  ) {
    lastPrediction = savedPrediction;
    displayAIResult(savedPrediction, savedSymptoms);
    updateOverviewCard(savedPrediction, savedPrediction.severity_score, '#2563eb');
  }

  loadUserData();
  loadDashboardStats();
  setupSymptomChips();
  loadReportsFromDB();
  loadActivityFromDB();

  const overlay = document.getElementById('emergency-modal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }
});

/* ════════════════════════════════════════════════
   LOAD USER DATA
   ════════════════════════════════════════════════ */
function loadUserData() {
  const user = Auth.getUser();
  if (!user) return;
  const initials = Auth.getInitials(user.name);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-id').textContent = 'ID: ' + (user.id || 'Unknown');
  document.getElementById('topbar-greeting').textContent = 'Welcome back, ' + user.name;
  document.getElementById('topbar-avatar').textContent = initials;
}

/* ════════════════════════════════════════════════
   DASHBOARD STATS
   ════════════════════════════════════════════════ */
async function loadDashboardStats() {
  const user = Auth.getUser();
  try {
    const res = await fetch(`${BACKEND_URL}/reports?patient_name=${encodeURIComponent(user?.name || '')}`);
    const data = await res.json();

    if (data.success && data.reports.length > 0) {
      const latest = data.reports[0];
      const sevMap = { 'Low': 25, 'Mild': 30, 'Moderate': 50, 'High': 75, 'Critical': 100 };
      const sevPercent = sevMap[latest.severity] || 50;
      const sevColor = {
        low: '#16a34a', moderate: '#d97706', high: '#ea580c', critical: '#dc2626'
      }[(latest.severity || '').toLowerCase()] || '#d97706';

      document.getElementById('stat-disease').textContent = latest.disease;
      document.getElementById('stat-disease-time').textContent = timeAgo(latest.time);
      document.getElementById('stat-severity').textContent = latest.severity;
      document.getElementById('stat-severity').style.color = sevColor;
      document.getElementById('stat-severity-score').textContent = `Confidence: ${latest.confidence}%`;
      document.getElementById('stat-count').textContent = data.reports.length;
      document.getElementById('stat-count-meta').textContent = `Last: ${new Date((latest.time || '').replace(' ', 'T')).toLocaleDateString('en-IN')}`;
      document.getElementById('diagnosis-name').textContent = latest.disease;
      document.getElementById('diagnosis-rec').textContent = `Recommended: ${latest.doctor}`;
      document.getElementById('sev-badge').textContent = `${latest.severity} — ${latest.confidence}`;
      document.getElementById('sev-fill').style.width = sevPercent + '%';
      document.getElementById('sev-fill').style.background = sevColor;

      let sympHTML = `<div class="condition-row top">
        <span class="condition-name">${latest.disease}</span>
        <div class="prob-bar"><div class="prob-fill" style="width:${latest.confidence}%"></div></div>
        <span class="prob-pct">${latest.confidence}%</span>
      </div>`;
      if (latest.symptoms) {
        latest.symptoms.split(', ').slice(0, 3).forEach((sym, idx) => {
          const prob = Math.max(70 - idx * 15, 30);
          sympHTML += `<div class="condition-row">
            <span class="condition-name">${sym.replace(/_/g, ' ')}</span>
            <div class="prob-bar"><div class="prob-fill" style="width:${prob}%"></div></div>
            <span class="prob-pct">${prob}%</span>
          </div>`;
        });
      }
      document.getElementById('conditions-list').innerHTML = sympHTML;

    } else {
      document.getElementById('stat-disease').textContent = '—';
      document.getElementById('stat-disease-time').textContent = 'No predictions yet';
      document.getElementById('stat-severity').textContent = '—';
      document.getElementById('stat-severity-score').textContent = '—';
      document.getElementById('stat-count').textContent = '0';
      document.getElementById('stat-count-meta').textContent = 'No predictions yet';
      document.getElementById('diagnosis-name').textContent = 'No predictions yet';
      document.getElementById('diagnosis-rec').textContent = 'Send your symptoms to get an AI diagnosis';
      document.getElementById('sev-badge').textContent = '—';
      document.getElementById('conditions-list').innerHTML = `
        <div style="text-align:center;padding:20px;color:#64748b;font-size:13px">
          📋 No predictions yet. Please analyze your symptoms!
        </div>`;
    }

    const actRes = await fetch(`${BACKEND_URL}/activity?patient_name=${encodeURIComponent(user?.name || '')}`);
    const actData = await actRes.json();
    const alertCount = actData.success ? actData.activity.length : 0;
    document.getElementById('stat-alerts').textContent = alertCount;
    document.getElementById('alert-badge').textContent = alertCount;
    document.getElementById('stat-alerts-meta').textContent = alertCount > 0 ? `${alertCount} activities` : 'No alerts';

  } catch (err) {
    console.warn('Dashboard stats load failed:', err);
    document.getElementById('stat-disease').textContent = '—';
    document.getElementById('stat-disease-time').textContent = 'Backend offline';
    document.getElementById('stat-severity').textContent = '—';
    document.getElementById('stat-severity-score').textContent = '—';
    document.getElementById('stat-count').textContent = '0';
    document.getElementById('stat-count-meta').textContent = 'Could not connect to backend';
    document.getElementById('stat-alerts').textContent = '0';
    document.getElementById('diagnosis-name').textContent = 'Could not connect to backend';
    document.getElementById('diagnosis-rec').textContent = 'Please start the Flask server: python app.py';
    document.getElementById('conditions-list').innerHTML = `
      <div style="text-align:center;padding:20px;color:#ef4444;font-size:13px">
        ⚠️ Backend is offline.<br>
        <code style="font-size:11px">Run: python app.py</code>
      </div>`;
  }
}

/* ════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════ */
function showSection(name, linkEl) {
  const titles = {
    overview: 'Overview', symptoms: 'Send Symptoms',
    'ai-result': 'AI Results', reports: 'My Reports',
    location: 'Live Location', alerts: 'Alerts',
  };

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('sec-' + name);
  if (target) target.classList.add('active');

  if (linkEl) {
    linkEl.classList.add('active');
  } else {
    const found = document.querySelector(`.nav-item[onclick*="'${name}'"]`);
    if (found) found.classList.add('active');
  }

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
  }

  // ✅ FIX: 300ms delay — section render hone ke baad map resize ho
  if (name === 'location' && dashMap) {
    setTimeout(() => dashMap.invalidateSize(), 300);
  }
}

/* ✅ navTo — Quick Action buttons ke liye */
function navTo(name) {
  const titles = {
    overview: 'Overview', symptoms: 'Send Symptoms',
    'ai-result': 'AI Results', reports: 'My Reports',
    location: 'Live Location', alerts: 'Alerts',
  };

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('sec-' + name);
  if (target) target.classList.add('active');

  const navLink = document.querySelector(`.nav-item[onclick*="'${name}'"]`);
  if (navLink) navLink.classList.add('active');

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
  }

  // ✅ FIX: 300ms delay — section render hone ke baad map resize ho
  if (name === 'location' && dashMap) {
    setTimeout(() => dashMap.invalidateSize(), 300);
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const isOpen = sb.style.transform !== 'translateX(-100%)';
  sb.style.transform = isOpen ? 'translateX(-100%)' : 'translateX(0)';
}

/* ════════════════════════════════════════════════
   SYMPTOM CHIPS
   ════════════════════════════════════════════════ */
function setupSymptomChips() {
  document.querySelectorAll('.symptom-chip input').forEach(input => {
    const chip = input.closest('.symptom-chip');
    const sync = () => {
      chip.classList.toggle('selected', input.checked);
      updateSelectedCount();
    };
    input.addEventListener('change', sync);
    sync();
  });
}

function updateSelectedCount() {
  const count = document.querySelectorAll('.symptom-chip.selected').length;
  const el = document.getElementById('selected-count');
  if (el) el.textContent = count === 0
    ? '0 symptoms selected'
    : count + ' symptom' + (count > 1 ? 's' : '') + ' selected';
}

function getSelectedSymptoms() {
  const selected = [];
  document.querySelectorAll('.symptom-chip input:checked').forEach(input => selected.push(input.value));
  return selected;
}

/* ════════════════════════════════════════════════
   AI ANALYSIS
   ════════════════════════════════════════════════ */
async function analyzeSymptoms() {
  const symptoms = getSelectedSymptoms();
  if (symptoms.length === 0) {
    alert('Please select at least one symptom.');
    return;
  }

  const btn = document.getElementById('analyze-btn');
  const btnText = document.getElementById('analyze-text');
  const spin = document.getElementById('analyze-spin');

  btn.disabled = true;
  btnText.textContent = 'Analyzing...';
  spin.classList.remove('hidden');

  const user = Auth.getUser();

  try {
    const payload = {
      patient_name: user?.name || 'Patient',
      patient_age: user?.age || 'N/A',
      symptoms
    };

    const res = await fetch(`${BACKEND_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw}`);

    let data;
    try { data = JSON.parse(raw); }
    catch { throw new Error('Backend did not return valid JSON'); }

    if (!data.success) throw new Error(data.error || 'Prediction failed');

    const result = {
      severity_score: data.prediction?.confidence || 0,
      severity_level: data.prediction?.severity || 'Unknown',
      primary_diagnosis: data.prediction?.disease || 'Unknown',
      doctor_type: data.prediction?.doctor || 'General Physician',
      recommendation: data.emergency_alert?.message || 'No recommendation available',
      conditions: (data.top3_predictions || []).map(p => ({
        name: p.disease,
        probability: p.confidence
      }))
    };

    lastPrediction = result;

    if (result.primary_diagnosis && result.primary_diagnosis !== 'Prediction unavailable') {
      localStorage.setItem('lastPrediction', JSON.stringify(result));
      localStorage.setItem('lastSymptoms', JSON.stringify(symptoms));
    }

    Auth.logAIPrediction({
      disease: result.primary_diagnosis,
      severity: result.severity_level,
      confidence: result.severity_score / 100,
      symptoms,
    });

    displayAIResult(result, symptoms);
    navTo('ai-result');
    updateTelegramCardDesc('family', `${result.primary_diagnosis} · ${result.severity_level}`);
    updateTelegramCardDesc('hospital', `Recommended: ${result.doctor_type}`);

    loadReportsFromDB();
    loadActivityFromDB();

  } catch (err) {
    console.error('AI Error:', err);

    const saved = JSON.parse(localStorage.getItem('lastPrediction') || 'null');
    const savedSymptoms = JSON.parse(localStorage.getItem('lastSymptoms') || '[]');

    if (saved && saved.primary_diagnosis && saved.primary_diagnosis !== 'Prediction unavailable') {
      lastPrediction = saved;
      displayAIResult(saved, savedSymptoms);
      navTo('ai-result');
      showTgToast('⚠️ Backend offline — Showing last saved result', 'info');
    } else {
      document.getElementById('ai-result-body').innerHTML = `
        <div style="padding:40px;text-align:center">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <div style="font-size:18px;font-weight:600;color:#dc2626;margin-bottom:8px">Could not connect to backend</div>
          <div style="font-size:14px;color:#64748b;margin-bottom:20px">
            Please start the Flask server:<br>
            <code style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:13px">python app.py</code>
          </div>
          <div style="font-size:12px;color:#94a3b8">Error: ${err.message}</div>
          <button class="submit-btn-dash" style="width:auto;padding:10px 24px;margin-top:20px"
            onclick="navTo('symptoms')">← Back to Symptoms</button>
        </div>`;
      navTo('ai-result');
    }

  } finally {
    btn.disabled = false;
    btnText.textContent = '⚡ Analyze with AI';
    spin.classList.add('hidden');
  }
}

/* ════════════════════════════════════════════════
   DISPLAY AI RESULT
   ════════════════════════════════════════════════ */
function displayAIResult(r, symptoms) {
  const score = Math.min(100, Math.max(0, r.severity_score || 0));
  const level = (r.severity_level || 'Low').toLowerCase();
  const colorMap = { low: '#16a34a', moderate: '#d97706', high: '#ea580c', critical: '#dc2626' };
  const sevColor = colorMap[level] || '#16a34a';

  const condHTML = (r.conditions || []).map((c, i) => `
    <div class="condition-row ${i === 0 ? 'top' : ''}">
      <span class="condition-name">${c.name}</span>
      <div class="prob-bar"><div class="prob-fill" style="width:${c.probability}%"></div></div>
      <span class="prob-pct">${c.probability}%</span>
    </div>`).join('');

  document.getElementById('ai-result-body').innerHTML = `
    <div class="ai-result-card">
      <div class="ai-result-disease">${r.primary_diagnosis || 'Unknown'}</div>
      <div class="ai-result-sub">Recommended specialist: <strong style="color:var(--teal)">${r.doctor_type || 'General Physician'}</strong></div>
      <div class="sev-bar-wrap">
        <div class="sev-bar-label">
          <span>Severity Index</span>
          <span style="color:${sevColor};font-weight:600">${r.severity_level} — ${score}/100</span>
        </div>
        <div class="sev-track">
          <div class="sev-fill" style="width:${score}%;background:${sevColor}"></div>
        </div>
        <div class="sev-ticks"><span>Low</span><span>Moderate</span><span>High</span><span>Critical</span></div>
      </div>
      <div class="card-title">Possible Conditions</div>
      <div class="conditions-list" style="margin-bottom:16px">${condHTML}</div>
      <div class="ai-rec"><strong>AI Recommendation:</strong> ${r.recommendation || ''}</div>
      <div style="margin-top:16px;font-size:12px;color:var(--muted)">
        Symptoms analyzed: ${symptoms.map(s => s.replace(/_/g, ' ')).join(', ')}
      </div>
    </div>`;

  updateOverviewCard(r, score, sevColor);
}

function updateOverviewCard(r, score, sevColor) {
  const statCards = document.querySelectorAll('.stat-card');
  if (statCards[0]) {
    statCards[0].querySelector('.stat-value').textContent = r.primary_diagnosis;
    statCards[0].querySelector('.stat-meta').textContent = 'Just now';
  }
  if (statCards[1]) {
    const valEl = statCards[1].querySelector('.stat-value');
    valEl.textContent = r.severity_level;
    valEl.style.color = sevColor;
    statCards[1].querySelector('.stat-meta').textContent = `Score: ${score} / 100`;
  }
  const diagEl = document.querySelector('.diagnosis-name');
  if (diagEl) diagEl.textContent = r.primary_diagnosis;
  const diagSub = document.querySelector('.diagnosis-sub');
  if (diagSub) diagSub.textContent = `Recommended: ${r.doctor_type}`;
  const sevFill = document.getElementById('sev-fill');
  if (sevFill) { sevFill.style.width = score + '%'; sevFill.style.background = sevColor; }
  const sevText = document.getElementById('sev-badge');
  if (sevText) { sevText.textContent = `${r.severity_level} — ${score}`; sevText.style.color = sevColor; }
}

/* ════════════════════════════════════════════════
   MAP
   ════════════════════════════════════════════════ */
function dashInitMap(lat, lng) {
  document.getElementById('dash-map-placeholder')?.classList.add('hidden');
  const mapDiv = document.getElementById('dashboard-map');
  if (mapDiv) mapDiv.style.display = 'block';

  if (!dashMap) {
    dashMap = L.map('dashboard-map', { zoomControl: false }).setView([lat, lng], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(dashMap);
    dashTileLayer = L.tileLayer(TILE_STREET, {
      attribution: '© OpenStreetMap contributors', maxZoom: 19
    }).addTo(dashMap);
    const ctrl = document.getElementById('dash-map-controls');
    if (ctrl) ctrl.style.display = 'flex';
  }

  const icon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,.25),0 2px 8px rgba(0,0,0,.2);"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9]
  });

  if (!dashMarker) {
    dashMarker = L.marker([lat, lng], { icon }).addTo(dashMap)
      .bindPopup(`<b>📍 Patient Location</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`, { closeButton: false });
  } else {
    dashMarker.setLatLng([lat, lng]);
  }
}

function dashUpdateMap(lat, lng, accuracy) {
  dashCurrentLat = lat; dashCurrentLng = lng;
  if (!dashMap) { dashInitMap(lat, lng); return; }
  dashMarker.setLatLng([lat, lng]);
  dashMarker.getPopup().setContent(`<b>📍 Patient Location</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`);
  if (dashAccCircle) dashMap.removeLayer(dashAccCircle);
  dashAccCircle = L.circle([lat, lng], {
    radius: accuracy, color: '#2563eb', fillColor: '#2563eb',
    fillOpacity: 0.06, weight: 1.5, dashArray: '4 4'
  }).addTo(dashMap);
}

/* ════════════════════════════════════════════════
   TRACKING
   ✅ FIX 1: navTo('location') — section active karo pehle
   ✅ FIX 2: tracking-active class REMOVED
   ✅ FIX 3: map invalidateSize 300ms delay
   ════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   FIXED: Tracking Logic
   ════════════════════════════════════════════════ */
function dashStartTracking() {
  // 1. Navigation Check: Agar hum location page par nahi hain, toh wahan jayein
  if (!document.getElementById('sec-location').classList.contains('active')) {
    navTo('location');
  }

  // 2. Geolocation support check
  if (!navigator.geolocation) {
    dashSetStatus('error', '❌ Geolocation not supported.');
    return;
  }

  // 3. UI Update
  document.getElementById('dash-track-btn').style.display = 'none';
  document.getElementById('dash-stop-btn').style.display = 'inline-flex';
  dashSetStatus('loading', '🔍 Locating...');
  document.getElementById('dash-loc-dot').className = 'loc-dot sharing';
  document.getElementById('loc-text').textContent = 'Location sharing — Active';

  // 4. Tracking Start
  if (dashWatchId) navigator.geolocation.clearWatch(dashWatchId);
  
  navigator.geolocation.getCurrentPosition(
  (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    console.log("Location mili:", lat, lng);

    // 👇 TEST: direct UI me dikhao
    document.getElementById('loc-text').textContent =
      `📍 ${lat}, ${lng}`;

    // 👇 existing function call
    dashOnSuccess(pos);
  },
    (err) => {
      // Error function: Agar yahan redirect ho raha hai, toh isse hata dein
      console.error("Location Error Code:", err.code);
      dashOnError(err);
    }, 
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function dashOnSuccess(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const acc = Math.round(pos.coords.accuracy);
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  dashUpdateCount++;
  dashSetStatus('success', `✅ Location found — Updated at ${time}`);
  document.getElementById('dash-gps-info')?.classList.add('visible');
  document.getElementById('dash-lat').textContent = lat.toFixed(6);
  document.getElementById('dash-lng').textContent = lng.toFixed(6);
  document.getElementById('dash-acc').textContent = `±${acc} m`;
  document.getElementById('dash-updates').textContent = `#${dashUpdateCount} · ${time}`;
  dashUpdateMap(lat, lng, acc);

  if (dashUpdateCount === 1) {
    dashMap.setView([lat, lng], 16, { animate: true });
    dashMarker.openPopup();
    fetchNearbyHospitals();

    const user = Auth.getUser();
    fetch(`${BACKEND_URL}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: user?.name || 'Patient', lat, lng, accuracy: acc })
    }).then(() => loadActivityFromDB()).catch(() => {});
  }
}

function dashOnError(err) {
  const msgs = {
    1: 'Permission denied. Please allow location access.',
    2: 'GPS signal not found.',
    3: 'Request timed out.'
  };
  dashSetStatus('error', '❌ ' + (msgs[err.code] || 'Unable to retrieve location.'));
  document.getElementById('dash-track-btn').style.display = 'inline-flex';
  document.getElementById('dash-stop-btn').style.display = 'none';
  dashWatchId = null;
}

function dashStopTracking() {
  if (dashWatchId) { navigator.geolocation.clearWatch(dashWatchId); dashWatchId = null; }
  document.getElementById('dash-track-btn').style.display = 'inline-flex';
  document.getElementById('dash-stop-btn').style.display = 'none';
  document.getElementById('dash-loc-dot').className = 'loc-dot stopped';
  document.getElementById('loc-text').textContent = 'Location sharing — Stopped';
  dashSetStatus('loading', 'ℹ️ Tracking stopped.');
}

function dashSetStatus(type, msg) {
  const bar = document.getElementById('dash-status-bar');
  if (!bar) return;
  bar.className = `visible ${type}`;
  bar.textContent = msg;
}

function dashCenterMap() {
  if (dashMap && dashMarker) dashMap.flyTo(dashMarker.getLatLng(), 16, { animate: true, duration: 1 });
}

function dashShareLocation() {
  if (!dashCurrentLat) { alert('Please fetch your location first.'); return; }
  const url = `https://www.google.com/maps?q=${dashCurrentLat},${dashCurrentLng}`;
  if (navigator.share) { navigator.share({ title: 'MediCare Patient Location', url }); }
  else {
    navigator.clipboard.writeText(url)
      .then(() => alert('📍 Location link copied!'))
      .catch(() => prompt('Copy this link:', url));
  }
}

/* ════════════════════════════════════════════════
   EMERGENCY
   ════════════════════════════════════════════════ */
function triggerEmergency() {
  document.getElementById('emergency-modal').classList.remove('hidden');
  setTimeout(closeModal, 6000);
}

function closeModal() {
  document.getElementById('emergency-modal').classList.add('hidden');
}

/* ════════════════════════════════════════════════
   NEAREST HOSPITALS
   ════════════════════════════════════════════════ */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371, dL = (lat2 - lat1) * Math.PI / 180, dG = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dL / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcETA(distKm) {
  const mins = Math.round((distKm / 40) * 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `~${mins} min`;
  return `~${Math.round(mins / 60)}h ${mins % 60}m`;
}

async function fetchNearbyHospitals() {
  if (!dashCurrentLat || !dashCurrentLng) {
    showHospError('Please click "Start Tracking" first.');
    return;
  }
  showHospLoading();
  try {
    const d = 0.045;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${dashCurrentLng - d},${dashCurrentLat - d},${dashCurrentLng + d},${dashCurrentLat + d}&limit=10&extratags=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || data.length === 0) { await fetchNearbyHospitalsWide(); return; }
    renderHospitals(data);
  } catch (err) { console.error(err); fallbackHospitals(); }
}

async function fetchNearbyHospitalsWide() {
  try {
    const d = 0.135;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${dashCurrentLng - d},${dashCurrentLat - d},${dashCurrentLng + d},${dashCurrentLat + d}&limit=10&extratags=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (!data || data.length === 0) { fallbackHospitals(); return; }
    renderHospitals(data);
  } catch { fallbackHospitals(); }
}

function fallbackHospitals() {
  const known = [
    { name: 'Hamidia Hospital', lat: 23.2687, lng: 77.4013, phone: '07552540222' },
    { name: 'AIIMS Bhopal', lat: 23.1992, lng: 77.3188, phone: '07556091500' },
    { name: 'Bansal Hospital', lat: 23.2343, lng: 77.4341, phone: '07554252000' },
    { name: 'Medanta Bhopal', lat: 23.2567, lng: 77.4012, phone: '07552700108' },
    { name: 'Apollo Hospitals Bhopal', lat: 23.2432, lng: 77.4178, phone: '07554999900' },
  ];
  renderHospitalObjects(known.map(h => ({
    ...h,
    dist: haversineDistance(dashCurrentLat, dashCurrentLng, h.lat, h.lng),
    type: 'Hospital'
  })).sort((a, b) => a.dist - b.dist));
}

function renderHospitals(results) {
  renderHospitalObjects(results.map(r => ({
    name: r.display_name.split(',')[0].trim(),
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    phone: r.extratags?.phone || null,
    type: 'Hospital',
    dist: haversineDistance(dashCurrentLat, dashCurrentLng, parseFloat(r.lat), parseFloat(r.lon)),
  })).sort((a, b) => a.dist - b.dist).slice(0, 5));
}

function renderHospitalObjects(hospitals) {
  if (!hospitals.length) { showHospError('No hospitals found nearby.'); return; }
  document.getElementById('hosp-list').innerHTML = hospitals.map((h, i) => `
    <div class="hosp-item ${i === 0 ? 'nearest' : ''}">
      <div class="hosp-item-top">
        <div class="hosp-item-left">
          ${i === 0 ? '<span class="hosp-badge nearest-badge">⭐ Nearest</span>' : ''}
          <div class="hosp-item-name">${h.name}</div>
          <div class="hosp-item-type">${h.type}</div>
        </div>
        <div class="hosp-item-right">
          <div class="hosp-dist">${h.dist < 1 ? (h.dist * 1000).toFixed(0) + 'm' : h.dist.toFixed(1) + 'km'}</div>
          <div class="hosp-eta">🕐 ${calcETA(h.dist)}</div>
        </div>
      </div>
      <div class="hosp-item-actions">
        <a href="tel:${h.phone || '108'}" class="hosp-btn call-btn">📞 ${h.phone ? 'Call' : '108'}</a>
        <a href="https://www.google.com/maps/dir/${dashCurrentLat},${dashCurrentLng}/${h.lat},${h.lng}"
           target="_blank" class="hosp-btn dir-btn">🗺️ Directions</a>
      </div>
    </div>`).join('');

  const t = document.getElementById('hosp-update-time');
  if (t) t.textContent = `· Updated ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  document.getElementById('hosp-loading').classList.add('hidden');
  document.getElementById('hosp-error').classList.add('hidden');
  document.getElementById('hosp-list').classList.remove('hidden');
  document.getElementById('hosp-refresh-btn').classList.remove('hidden');
}

function showHospLoading() {
  document.getElementById('hosp-loading').classList.remove('hidden');
  document.getElementById('hosp-error').classList.add('hidden');
  document.getElementById('hosp-list').classList.add('hidden');
  document.getElementById('hosp-refresh-btn').classList.add('hidden');
}

function showHospError(msg) {
  document.getElementById('hosp-loading').classList.add('hidden');
  document.getElementById('hosp-error').classList.remove('hidden');
  document.getElementById('hosp-error-msg').textContent = msg;
  document.getElementById('hosp-list').classList.add('hidden');
}

/* ════════════════════════════════════════════════
   TELEGRAM / TWILIO
   ════════════════════════════════════════════════ */
function getTwilioBadgeClass(status) {
  const map = {
    delivered: { cls: 'delivered', label: 'Delivered' },
    sent: { cls: 'sent', label: 'Sent' },
    queued: { cls: 'queued', label: 'Pending' },
    accepted: { cls: 'queued', label: 'Pending' },
    sending: { cls: 'sent', label: 'Sending' },
    failed: { cls: 'failed', label: 'Failed' },
    undelivered: { cls: 'failed', label: 'Undelivered' },
  };
  return map[status] || { cls: 'queued', label: status || 'Unknown' };
}

function applyTwilioStatus(badgeEl, twilioStatus) {
  if (!badgeEl) return;
  const { cls, label } = getTwilioBadgeClass(twilioStatus);
  badgeEl.className = `tg-badge ${cls}`;
  badgeEl.textContent = label;
}

function updateTelegramCardDesc(target, text) {
  const el1 = document.getElementById(`tg-desc-${target}`);
  const el2 = document.getElementById(`tg-desc2-${target}`);
  if (el1) el1.textContent = text;
  if (el2) el2.textContent = text;
}

function showTgToast(msg, type = 'info') {
  const toast = document.getElementById('tg-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `tg-toast show toast-${type}`;
  setTimeout(() => { toast.className = 'tg-toast'; }, 3000);
}

async function doResendAlert(btnId, badgeId, target) {
  const btn = document.getElementById(btnId);
  const badge = document.getElementById(badgeId);
  if (!btn) return;

  const user = Auth.getUser();
  btn.disabled = true;
  const origHTML = btn.innerHTML;
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" style="animation:tgRotate .7s linear infinite">
    <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="18 6"/>
  </svg> Sending...`;

  try {
    const res = await fetch(`${BACKEND_URL}/api/resend-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        patient_name: user?.name || 'Patient',
        patient_id: user?.id || 'Unknown',
        diagnosis: lastPrediction?.primary_diagnosis || 'Not available',
        severity: lastPrediction?.severity_level || 'Unknown',
      })
    });

    const data = await res.json();
    if (data.success) {
      applyTwilioStatus(badge, data.status || 'sent');
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <polyline points="1,6 4,9 11,2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg> Sent ✓`;
      btn.classList.add('success');
      showTgToast(`✅ Alert resent successfully!`, 'success');

      const u = Auth.getUser();
      fetch(`${BACKEND_URL}/alert-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_name: u?.name || 'Patient', target })
      }).then(() => loadActivityFromDB()).catch(() => {});

      setTimeout(() => { btn.innerHTML = origHTML; btn.classList.remove('success'); btn.disabled = false; }, 3500);
    } else throw new Error(data.error || 'Backend returned failure');

  } catch (err) {
    const isNetErr = err.message.includes('fetch') || err.message.includes('Failed');
    if (isNetErr) {
      applyTwilioStatus(badge, 'sent');
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <polyline points="1,6 4,9 11,2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg> Sent (demo)`;
      btn.classList.add('success');
      showTgToast('ℹ️ Demo mode — backend not connected', 'info');
      setTimeout(() => { btn.innerHTML = origHTML; btn.classList.remove('success'); btn.disabled = false; }, 3500);
    } else {
      applyTwilioStatus(badge, 'failed');
      btn.innerHTML = '⚠️ Failed — Retry';
      btn.disabled = false;
      showTgToast(`❌ Failed: ${err.message}`, 'error');
    }
  }
}

function resendTelegramAlert(target) { doResendAlert(`tg-resend-${target}`, `tg-badge-${target}`, target); }
function resendTelegramAlert2(target) { doResendAlert(`tg-resend2-${target}`, `tg-badge2-${target}`, target); }

function receiveTwilioWebhook({ target, status }) {
  applyTwilioStatus(document.getElementById(`tg-badge-${target}`), status);
  applyTwilioStatus(document.getElementById(`tg-badge2-${target}`), status);
  const { label } = getTwilioBadgeClass(status);
  showTgToast(`📬 ${target} alert: ${label}`,
    status === 'delivered' ? 'success' : status === 'failed' ? 'error' : 'info');
}

const tgStyle = document.createElement('style');
tgStyle.textContent = `@keyframes tgRotate { to { transform: rotate(360deg); } }`;
document.head.appendChild(tgStyle);

/* ════════════════════════════════════════════════
   MY REPORTS
   ════════════════════════════════════════════════ */
async function loadReportsFromDB() {
  const user = Auth.getUser();
  const reportsTable = document.querySelector('.reports-table');
  if (!reportsTable) return;

  try {
    const res = await fetch(`${BACKEND_URL}/reports?patient_name=${encodeURIComponent(user?.name || '')}`);
    const data = await res.json();

    if (!data.success || data.reports.length === 0) {
      reportsTable.innerHTML = `
        <div class="report-header">
          <span>Report Name</span><span>Date</span><span>Type</span><span>Severity</span><span>Confidence</span>
        </div>
        <div style="text-align:center;padding:32px;color:var(--muted)">
          <div style="font-size:32px;margin-bottom:8px">📋</div>
          <div>No reports found. Please analyze your symptoms first!</div>
        </div>`;
      return;
    }

    reportsTable.innerHTML = `
      <div class="report-header">
        <span>Disease</span><span>Date</span><span>Type</span><span>Severity</span><span>Confidence</span>
      </div>
      ${data.reports.map(r => `
        <div class="report-row">
          <span>AI Diagnosis — ${r.disease}</span>
          <span>${r.time ? new Date(r.time.replace(' ', 'T')).toLocaleDateString('en-IN') : '—'}</span>
          <span class="type-badge ai">AI</span>
          <span class="status-badge ${r.severity === 'Low' ? 'ready' : 'pending'}">${r.severity}</span>
          <span style="font-size:13px;font-weight:600;color:var(--blue)">${r.confidence}%</span>
        </div>`).join('')}`;

  } catch (err) {
    console.warn('Reports load failed:', err);
    reportsTable.innerHTML = `
      <div style="text-align:center;padding:32px;color:#ef4444;font-size:13px">
        ⚠️ Backend is offline — Run: <code>python app.py</code>
      </div>`;
  }
}

/* ════════════════════════════════════════════════
   RECENT ACTIVITY
   ════════════════════════════════════════════════ */
async function loadActivityFromDB() {
  const user = Auth.getUser();
  const activityList = document.querySelector('.activity-list');
  if (!activityList) return;

  try {
    const res = await fetch(`${BACKEND_URL}/activity?patient_name=${encodeURIComponent(user?.name || '')}`);
    const data = await res.json();

    if (!data.success || data.activity.length === 0) {
      activityList.innerHTML = `
        <div style="color:var(--muted);font-size:13px;padding:8px 0">No recent activity.</div>`;
      return;
    }

    const iconMap = {
      diagnosis: { dot: 'blue' },
      location: { dot: 'green' },
      telegram: { dot: 'amber' },
    };

    activityList.innerHTML = data.activity.map(a => {
      const cfg = iconMap[a.type] || { dot: 'gray' };
      return `
        <div class="activity-item">
          <div class="activity-dot ${cfg.dot}"></div>
          <div>
            <div class="activity-text">${a.message}</div>
            <div class="activity-time">${timeAgo(a.time)}</div>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    console.warn('Activity load failed:', err);
    activityList.innerHTML = `
      <div style="color:#ef4444;font-size:13px;padding:8px 0">⚠️ Backend is offline.</div>`;
  }
}

/* ════════════════════════════════════════════════
   TIME AGO
   ════════════════════════════════════════════════ */
function timeAgo(timeStr) {
  if (!timeStr) return '—';
  const fixed = (timeStr || '').replace(' ', 'T');
  const diff = Date.now() - new Date(fixed).getTime();
  const mins = Math.floor(diff / 60000);
  if (isNaN(mins) || mins < 0) return 'Just now';
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
}
// Ye code check karega ki redirect kahan se ho raha hai
(function() {
    var pushState = history.pushState;
    var replaceState = history.replaceState;
    
    history.pushState = function() {
        console.log("Redirect attempt detected!");
        console.trace(); // Ye batayega ki kaunsa function redirect kar raha hai
        return pushState.apply(this, arguments);
    };
    
    // Agar window.location.href use ho raha hai, toh ye warn karega
    window.addEventListener("beforeunload", function (e) {
        console.log("Page is reloading or navigating away!");
    });
})();