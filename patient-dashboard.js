/* ═══════════════════════════════════════════════
   MediCare Hospital — patient-dashboard.js
   Handles: navigation, symptom checker,
            AI prediction, location, emergency,
            Twilio Telegram Alert Status (resend)
   ═══════════════════════════════════════════════ */

// ── Validate login using Auth ──
Auth.requireLogin('patient');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/* ── Backend Base URL — apna Flask server URL yahan dalo ── */
const BACKEND_URL = 'http://127.0.0.1:5000';

let locationSharing = true;
let lastPrediction  = null;

/* ════════════════════════════════════════════════
   DASHBOARD MAP — State Variables
   ════════════════════════════════════════════════ */
let dashMap         = null;
let dashMarker      = null;
let dashAccCircle   = null;
let dashWatchId     = null;
let dashUpdateCount = 0;
let dashCurrentLat  = null;
let dashCurrentLng  = null;
let dashTileLayer   = null;
const TILE_STREET   = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ════════════════════════════════════════════════
   INITIALIZE DASHBOARD WITH USER DATA
   ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  loadDashboardStats();
});

function loadUserData() {
  const user = Auth.getUser();
  if (!user) return;

  // Update sidebar
  const initials = Auth.getInitials(user.name);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-id').textContent = 'ID: ' + (user.id || 'Unknown');

  // Update topbar
  document.getElementById('topbar-greeting').textContent = 'Welcome back, ' + user.name;
  document.getElementById('topbar-avatar').textContent = initials;
}

function loadDashboardStats() {
  const predictions = Auth.getAIPredictions();
  const alerts = Auth.getEmergencyAlerts();
  
  // Update stats cards
  if (predictions.length > 0) {
    const latest = predictions[predictions.length - 1];
    document.getElementById('stat-disease').textContent = latest.disease;
    document.getElementById('stat-disease-time').textContent = new Date(latest.timestamp).toLocaleString();
    document.getElementById('stat-severity').textContent = latest.severity;
    document.getElementById('stat-severity-score').textContent = 'Confidence: ' + (latest.confidence * 100).toFixed(0) + '%';
    
    // Update diagnosis card
    document.getElementById('diagnosis-name').textContent = latest.disease;
    document.getElementById('diagnosis-rec').textContent = 'Severity: ' + latest.severity;
    document.getElementById('sev-badge').textContent = latest.severity + ' — ' + (latest.confidence * 100).toFixed(0);
    
    const sevMap = { 'Low': 25, 'Mild': 30, 'Moderate': 50, 'High': 75, 'Critical': 100 };
    const sevPercent = sevMap[latest.severity] || 50;
    document.getElementById('sev-fill').style.width = sevPercent + '%';
    
    // Display symptoms
    let symptoms = '<div class="condition-row top">';
    symptoms += '<span class="condition-name">' + latest.disease + '</span>';
    symptoms += '<div class="prob-bar"><div class="prob-fill" style="width:' + (latest.confidence * 100) + '%"></div></div>';
    symptoms += '<span class="prob-pct">' + (latest.confidence * 100).toFixed(0) + '%</span>';
    symptoms += '</div>';
    
    if (latest.symptoms && latest.symptoms.length > 0) {
      latest.symptoms.forEach((sym, idx) => {
        const prob = Math.max(85 - (idx * 15), 40);
        symptoms += '<div class="condition-row">';
        symptoms += '<span class="condition-name">' + sym + '</span>';
        symptoms += '<div class="prob-bar"><div class="prob-fill" style="width:' + prob + '%"></div></div>';
        symptoms += '<span class="prob-pct">' + prob + '%</span>';
        symptoms += '</div>';
      });
    }
    
    document.getElementById('conditions-list').innerHTML = symptoms;
  }
  
  // Update counts
  document.getElementById('stat-count').textContent = predictions.length;
  document.getElementById('stat-count-meta').textContent = predictions.length > 0 ? 'Last ' + new Date(predictions[predictions.length - 1].timestamp).toLocaleDateString() : 'No predictions';
  
  document.getElementById('stat-alerts').textContent = alerts.length;
  document.getElementById('alert-badge').textContent = alerts.length;
  document.getElementById('stat-alerts-meta').textContent = alerts.length > 0 ? alerts.length + ' alerts' : 'No alerts';
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
    overview:   'Overview',
    symptoms:   'Send Symptoms',
    'ai-result':'AI Results',
    reports:    'My Reports',
    location:   'Live Location',
    alerts:     'Alerts',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
  }

  if (name === 'location' && dashMap) {
    setTimeout(() => dashMap.invalidateSize(), 100);
  }
}

/* ════════════════════════════════════════════════
   SIDEBAR TOGGLE (mobile)
   ════════════════════════════════════════════════ */
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const isOpen = sb.style.transform !== 'translateX(-100%)';
  sb.style.transform = isOpen ? 'translateX(-100%)' : 'translateX(0)';
}

/* ════════════════════════════════════════════════
   SYMPTOM CHIP SELECTION
   ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupSymptomChips();
});

function setupSymptomChips() {
  document.querySelectorAll('.symptom-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = chip.querySelector('input');
      input.checked = !input.checked;
      chip.classList.toggle('selected', input.checked);
      updateSelectedCount();
    });
  });
}

function updateSelectedCount() {
  const count = document.querySelectorAll('.symptom-chip.selected').length;
  const el = document.getElementById('selected-count');
  if (el) {
    el.textContent = count === 0
      ? '0 symptoms selected'
      : count + ' symptom' + (count > 1 ? 's' : '') + ' selected';
  }
}

function getSelectedSymptoms() {
  const selected = [];
  document.querySelectorAll('.symptom-chip input:checked').forEach(input => {
    selected.push(input.value);
  });
  return selected;
}

/* ════════════════════════════════════════════════
   AI SYMPTOM ANALYSIS — calls Flask API
   ════════════════════════════════════════════════ */
async function analyzeSymptoms() {
  const symptoms = getSelectedSymptoms();

  if (symptoms.length === 0) {
    alert('Please select at least one symptom before analyzing.');
    return;
  }

  const btn     = document.getElementById('analyze-btn');
  const btnText = document.getElementById('analyze-text');
  const spin    = document.getElementById('analyze-spin');

  btn.disabled        = true;
  btnText.textContent = 'Analyzing...';
  spin.classList.remove('hidden');

  try {
    const res = await fetch(`${BACKEND_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: 'User', patient_age: 20, symptoms })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Prediction failed');

    const result = {
      severity_score:    data.prediction.confidence,
      severity_level:    data.prediction.severity,
      primary_diagnosis: data.prediction.disease,
      doctor_type:       data.prediction.doctor,
      recommendation:    data.emergency_alert.message,
      conditions: data.top3_predictions.map(p => ({
        name: p.disease, probability: p.confidence
      }))
    };

    lastPrediction = result;
    displayAIResult(result, symptoms);
    showSection('ai-result', document.querySelector('[onclick*="ai-result"]'));

    /* ── After AI result: update Telegram cards with latest diagnosis ── */
    updateTelegramCardDesc('family', `${result.primary_diagnosis} · ${result.severity_level}`);
    updateTelegramCardDesc('hospital', `Dr. Sunita Mehta — ${result.doctor_type}`);

  } catch (err) {
    console.error('AI Error:', err);
    document.getElementById('ai-result-body').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">Analysis failed. Please check backend/server and try again.</div>
      </div>`;
    showSection('ai-result', document.querySelector('[onclick*="ai-result"]'));
  } finally {
    btn.disabled        = false;
    btnText.textContent = '⚡ Analyze with AI';
    spin.classList.add('hidden');
  }
}

/* ════════════════════════════════════════════════
   DISPLAY AI RESULT
   ════════════════════════════════════════════════ */
function displayAIResult(r, symptoms) {
  const score    = Math.min(100, Math.max(0, r.severity_score || 0));
  const level    = (r.severity_level || 'Low').toLowerCase();
  const colorMap = { low:'#4ade80', moderate:'#f59e0b', high:'#f97316', critical:'#f87171' };
  const sevColor = colorMap[level] || '#4ade80';

  const condHTML = (r.conditions || []).map((c, i) => `
    <div class="condition-row ${i === 0 ? 'top' : ''}">
      <span class="condition-name">${c.name}</span>
      <div class="prob-bar"><div class="prob-fill" style="width:${c.probability}%"></div></div>
      <span class="prob-pct">${c.probability}%</span>
    </div>`).join('');

  document.getElementById('ai-result-body').innerHTML = `
    <div class="ai-result-card">
      <div class="ai-result-disease">${r.primary_diagnosis || 'Unknown'}</div>
      <div class="ai-result-sub">Recommended specialist: <strong style="color:#38bdf8">${r.doctor_type || 'General Physician'}</strong></div>
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
      <div style="margin-top:16px;font-size:12px;color:var(--muted)">Symptoms analyzed: ${symptoms.join(', ')}</div>
    </div>`;

  updateOverviewCard(r, score, level, sevColor);
}

/* ════════════════════════════════════════════════
   UPDATE OVERVIEW AFTER NEW PREDICTION
   ════════════════════════════════════════════════ */
function updateOverviewCard(r, score, level, sevColor) {
  const statCards = document.querySelectorAll('.stat-card');
  if (statCards[0]) {
    statCards[0].querySelector('.stat-value').textContent = r.primary_diagnosis;
    statCards[0].querySelector('.stat-meta').textContent  = 'Just now';
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

  const sevFill = document.querySelector('.sev-fill');
  if (sevFill) {
    sevFill.style.width      = score + '%';
    sevFill.style.background = sevColor;
    sevFill.className        = 'sev-fill';
  }

  const sevText = document.querySelector('.sev-text');
  if (sevText) {
    sevText.textContent = `${r.severity_level} — ${score}`;
    sevText.style.color = sevColor;
  }
}

/* ════════════════════════════════════════════════
   DASHBOARD MAP — INIT
   ════════════════════════════════════════════════ */
function dashInitMap(lat, lng) {
  const placeholder = document.getElementById('dash-map-placeholder');
  if (placeholder) placeholder.classList.add('hidden');

  const mapDiv = document.getElementById('dashboard-map');
  if (mapDiv) mapDiv.style.display = 'block';

  if (!dashMap) {
    dashMap = L.map('dashboard-map', { zoomControl: false }).setView([lat, lng], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(dashMap);

    dashTileLayer = L.tileLayer(TILE_STREET, {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(dashMap);

    const ctrl = document.getElementById('dash-map-controls');
    if (ctrl) ctrl.style.display = 'flex';
  }

  const icon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width:18px;height:18px;
        background:#1a56db;
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 4px rgba(26,86,219,.3),0 2px 8px rgba(0,0,0,.3);
        animation:dashPulse 2s infinite;
      "></div>
      <style>
        @keyframes dashPulse {
          0%,100%{box-shadow:0 0 0 4px rgba(26,86,219,.3),0 2px 8px rgba(0,0,0,.3);}
          50%{box-shadow:0 0 0 10px rgba(26,86,219,.1),0 2px 8px rgba(0,0,0,.3);}
        }
      </style>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  if (!dashMarker) {
    dashMarker = L.marker([lat, lng], { icon })
      .addTo(dashMap)
      .bindPopup(
        `<b>📍 Patient Location</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`,
        { closeButton: false }
      );
  } else {
    dashMarker.setLatLng([lat, lng]);
  }
}

/* ════════════════════════════════════════════════
   DASHBOARD MAP — UPDATE
   ════════════════════════════════════════════════ */
function dashUpdateMap(lat, lng, accuracy) {
  dashCurrentLat = lat;
  dashCurrentLng = lng;

  if (!dashMap) { dashInitMap(lat, lng); }

  dashMarker.setLatLng([lat, lng]);
  dashMarker.getPopup().setContent(
    `<b>📍 Patient Location</b><br>Lat: ${lat.toFixed(5)}<br>Lng: ${lng.toFixed(5)}`
  );

  if (dashAccCircle) dashMap.removeLayer(dashAccCircle);
  dashAccCircle = L.circle([lat, lng], {
    radius: accuracy,
    color: '#1a56db',
    fillColor: '#1a56db',
    fillOpacity: 0.08,
    weight: 1.5,
    dashArray: '4 4'
  }).addTo(dashMap);
}

/* ════════════════════════════════════════════════
   START TRACKING
   ════════════════════════════════════════════════ */
function dashStartTracking() {
  if (!navigator.geolocation) {
    dashSetStatus('error', '❌ Geolocation is not supported in this browser.');
    return;
  }

  const trackBtn = document.getElementById('dash-track-btn');
  const stopBtn  = document.getElementById('dash-stop-btn');
  if (trackBtn) trackBtn.style.display = 'none';
  if (stopBtn)  stopBtn.style.display  = 'inline-flex';

  dashSetStatus('loading', '🔍 Locating... GPS signal liya ja raha hai');

  const dot  = document.getElementById('dash-loc-dot');
  const text = document.getElementById('loc-text');
  if (dot)  dot.className    = 'loc-dot sharing';
  if (text) text.textContent = 'Location sharing — Active';

  if (dashWatchId) navigator.geolocation.clearWatch(dashWatchId);

  dashWatchId = navigator.geolocation.watchPosition(
    dashOnSuccess,
    dashOnError,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

/* ════════════════════════════════════════════════
   GPS SUCCESS
   ════════════════════════════════════════════════ */
function dashOnSuccess(pos) {
  const lat  = pos.coords.latitude;
  const lng  = pos.coords.longitude;
  const acc  = Math.round(pos.coords.accuracy);
  const time = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  dashUpdateCount++;

  dashSetStatus('success', `✅ Location found — Updated at ${time}`);

  const infoBox = document.getElementById('dash-gps-info');
  if (infoBox) infoBox.classList.add('visible');

  const latEl = document.getElementById('dash-lat');
  const lngEl = document.getElementById('dash-lng');
  const accEl = document.getElementById('dash-acc');
  const updEl = document.getElementById('dash-updates');
  if (latEl) latEl.textContent = lat.toFixed(6);
  if (lngEl) lngEl.textContent = lng.toFixed(6);
  if (accEl) accEl.textContent = `±${acc} m`;
  if (updEl) updEl.textContent = `#${dashUpdateCount} · ${time}`;

  dashUpdateMap(lat, lng, acc);

  if (dashUpdateCount === 1) {
    dashMap.setView([lat, lng], 16, { animate: true });
    dashMarker.openPopup();
    fetchNearbyHospitals();
  }

  const statCards = document.querySelectorAll('.stat-card');
  if (statCards[3]) {
    statCards[3].querySelector('.stat-value').textContent = 'Sharing';
    statCards[3].querySelector('.stat-value').style.color = '#2dd4bf';
    statCards[3].querySelector('.stat-meta').textContent  = `±${acc}m · ${time}`;
  }
}

/* ════════════════════════════════════════════════
   GPS ERROR
   ════════════════════════════════════════════════ */
function dashOnError(err) {
  let msg = 'Unable to retrieve location.';
  if (err.code === 1) msg = 'Permission denied. Location allow karo.';
  if (err.code === 2) msg = 'GPS signal nahi mila.';
  if (err.code === 3) msg = 'Request timeout. Dobara try karo.';

  dashSetStatus('error', '❌ ' + msg);

  const trackBtn = document.getElementById('dash-track-btn');
  const stopBtn  = document.getElementById('dash-stop-btn');
  if (trackBtn) trackBtn.style.display = 'inline-flex';
  if (stopBtn)  stopBtn.style.display  = 'none';
}

/* ════════════════════════════════════════════════
   STOP TRACKING
   ════════════════════════════════════════════════ */
function dashStopTracking() {
  if (dashWatchId) {
    navigator.geolocation.clearWatch(dashWatchId);
    dashWatchId = null;
  }

  const trackBtn = document.getElementById('dash-track-btn');
  const stopBtn  = document.getElementById('dash-stop-btn');
  if (trackBtn) { trackBtn.style.display = 'inline-flex'; trackBtn.textContent = '📍 Start Tracking'; }
  if (stopBtn)  stopBtn.style.display = 'none';

  const dot  = document.getElementById('dash-loc-dot');
  const text = document.getElementById('loc-text');
  if (dot)  dot.className    = 'loc-dot stopped';
  if (text) text.textContent = 'Location sharing — Stopped';

  dashSetStatus('loading', 'ℹ️ Tracking stopped.');
}

/* ════════════════════════════════════════════════
   STATUS BAR HELPER
   ════════════════════════════════════════════════ */
function dashSetStatus(type, msg) {
  const bar = document.getElementById('dash-status-bar');
  if (!bar) return;
  bar.className = `visible ${type}`;
  bar.textContent = msg;
}

/* ════════════════════════════════════════════════
   CENTER MAP
   ════════════════════════════════════════════════ */
function dashCenterMap() {
  if (dashMap && dashMarker) {
    dashMap.flyTo(dashMarker.getLatLng(), 16, { animate: true, duration: 1 });
  }
}

/* ════════════════════════════════════════════════
   SHARE LOCATION
   ════════════════════════════════════════════════ */
function dashShareLocation() {
  if (!dashCurrentLat) { alert('Pehle location fetch karo.'); return; }
  const url = `https://www.google.com/maps?q=${dashCurrentLat},${dashCurrentLng}`;
  if (navigator.share) {
    navigator.share({ title: 'MediCare Patient Location', url });
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert('📍 Location link copied!'))
      .catch(() => prompt('Copy this link:', url));
  }
}

function toggleLocation() {
  if (dashWatchId) dashStopTracking();
  else dashStartTracking();
}

/* ════════════════════════════════════════════════
   EMERGENCY ALERT
   ════════════════════════════════════════════════ */
function triggerEmergency() {
  document.getElementById('emergency-modal').classList.remove('hidden');
  setTimeout(closeModal, 6000);
}

function closeModal() {
  document.getElementById('emergency-modal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('emergency-modal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }
});

/* ════════════════════════════════════════════════
   NEAREST HOSPITALS — Nominatim (CORS-safe, free)
   ════════════════════════════════════════════════ */

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dG = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dL/2) ** 2 +
             Math.cos(lat1 * Math.PI/180) *
             Math.cos(lat2 * Math.PI/180) *
             Math.sin(dG/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcETA(distKm) {
  const mins = Math.round((distKm / 40) * 60);
  if (mins < 1)  return '< 1 min';
  if (mins < 60) return `~${mins} min`;
  return `~${Math.round(mins/60)}h ${mins%60}m`;
}

async function fetchNearbyHospitals() {
  const lat = dashCurrentLat;
  const lng = dashCurrentLng;

  if (!lat || !lng) {
    showHospError('Pehle "Start Tracking" click karo, phir hospitals load honge.');
    return;
  }

  showHospLoading();

  try {
    const d = 0.045;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${lng-d},${lat+d},${lng+d},${lat-d}&limit=10&extratags=1`;
    const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (!data || data.length === 0) {
      await fetchNearbyHospitalsWide(lat, lng);
      return;
    }

    renderHospitals(data, lat, lng);
  } catch (err) {
    console.error('Nominatim error:', err);
    fallbackHospitals(lat, lng);
  }
}

async function fetchNearbyHospitalsWide(lat, lng) {
  try {
    const d = 0.135;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${lng-d},${lat+d},${lng+d},${lat-d}&limit=10&extratags=1`;
    const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (!data || data.length === 0) { fallbackHospitals(lat, lng); return; }
    renderHospitals(data, lat, lng);
  } catch {
    fallbackHospitals(lat, lng);
  }
}

function fallbackHospitals(userLat, userLng) {
  const known = [
    { name: 'Hamidia Hospital',        lat: 23.2687, lng: 77.4013, phone: '07552540222' },
    { name: 'AIIMS Bhopal',            lat: 23.1992, lng: 77.3188, phone: '07556091500' },
    { name: 'Bansal Hospital',         lat: 23.2343, lng: 77.4341, phone: '07554252000' },
    { name: 'Medanta Bhopal',          lat: 23.2567, lng: 77.4012, phone: '07552700108' },
    { name: 'Apollo Hospitals Bhopal', lat: 23.2432, lng: 77.4178, phone: '07554999900' },
  ];
  const list = known
    .map(h => ({ ...h, dist: haversineDistance(userLat, userLng, h.lat, h.lng), type: 'Hospital' }))
    .sort((a,b) => a.dist - b.dist);
  renderHospitalObjects(list, userLat, userLng);
}

function renderHospitals(results, userLat, userLng) {
  const list = results.map(r => ({
    name:  r.display_name.split(',')[0].trim(),
    lat:   parseFloat(r.lat),
    lng:   parseFloat(r.lon),
    phone: r.extratags?.phone || r.extratags?.['contact:phone'] || null,
    type:  'Hospital',
    dist:  haversineDistance(userLat, userLng, parseFloat(r.lat), parseFloat(r.lon)),
  })).sort((a,b) => a.dist - b.dist).slice(0,5);
  renderHospitalObjects(list, userLat, userLng);
}

function renderHospitalObjects(hospitals, userLat, userLng) {
  if (!hospitals.length) { showHospError('Koi hospital nahi mila.'); return; }

  document.getElementById('hosp-list').innerHTML = hospitals.map((h, i) => `
    <div class="hosp-item ${i === 0 ? 'nearest' : ''}">
      <div class="hosp-item-top">
        <div class="hosp-item-left">
          ${i === 0 ? '<span class="hosp-badge nearest-badge">⭐ Nearest</span>' : ''}
          <div class="hosp-item-name">${h.name}</div>
          <div class="hosp-item-type">${h.type}</div>
        </div>
        <div class="hosp-item-right">
          <div class="hosp-dist">${h.dist < 1 ? (h.dist*1000).toFixed(0)+'m' : h.dist.toFixed(1)+'km'}</div>
          <div class="hosp-eta">🕐 ${calcETA(h.dist)}</div>
        </div>
      </div>
      <div class="hosp-item-actions">
        <a href="tel:${h.phone || '108'}" class="hosp-btn call-btn">📞 ${h.phone ? 'Call' : '108'}</a>
        <a href="https://www.google.com/maps/dir/${userLat},${userLng}/${h.lat},${h.lng}"
           target="_blank" class="hosp-btn dir-btn">🗺️ Directions</a>
      </div>
    </div>`).join('');

  const t = document.getElementById('hosp-update-time');
  if (t) t.textContent = `· Updated ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;

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
   ✅ TELEGRAM ALERT STATUS — Twilio Integration
   ════════════════════════════════════════════════

   HOW IT WORKS:
   1. resendTelegramAlert(target) — Location section ke cards ke liye
   2. resendTelegramAlert2(target) — Alerts section ke cards ke liye
   3. Backend API: POST /api/resend-alert
      Body: { target: 'family' | 'hospital' | 'emergency' }
      Response: { success: true, messageSid: '...', status: 'sent' }
   4. Twilio Webhook: POST /api/twilio-webhook
      Sets MessageStatus: delivered | sent | queued | failed
   ════════════════════════════════════════════════ */

/**
 * Twilio MessageStatus → badge class + label
 */
function getTwilioBadgeClass(status) {
  const map = {
    delivered: { cls: 'delivered', label: 'Delivered' },
    sent:      { cls: 'sent',      label: 'Sent'       },
    queued:    { cls: 'queued',    label: 'Pending'    },
    accepted:  { cls: 'queued',    label: 'Pending'    },
    sending:   { cls: 'sent',      label: 'Sending'    },
    failed:    { cls: 'failed',    label: 'Failed'     },
    undelivered:{ cls: 'failed',   label: 'Undelivered'},
  };
  return map[status] || { cls: 'queued', label: status || 'Unknown' };
}

/**
 * Update a badge element based on Twilio status string
 */
function applyTwilioStatus(badgeEl, twilioStatus) {
  if (!badgeEl) return;
  const { cls, label } = getTwilioBadgeClass(twilioStatus);
  badgeEl.className = `tg-badge ${cls}`;
  badgeEl.textContent = label;
}

/**
 * Update description text of telegram card (after new diagnosis)
 */
function updateTelegramCardDesc(target, text) {
  const el1 = document.getElementById(`tg-desc-${target}`);
  const el2 = document.getElementById(`tg-desc2-${target}`);
  if (el1) el1.textContent = text;
  if (el2) el2.textContent = text;
}

/**
 * Show toast notification
 */
function showTgToast(msg, type = 'info') {
  const toast = document.getElementById('tg-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `tg-toast show toast-${type}`;
  setTimeout(() => { toast.className = 'tg-toast'; }, 3000);
}

/**
 * Core resend logic — calls backend /api/resend-alert
 * @param {string} btnId    - ID of button element
 * @param {string} badgeId  - ID of badge element to update
 * @param {string} target   - 'family' | 'hospital' | 'emergency'
 */
async function doResendAlert(btnId, badgeId, target) {
  const btn   = document.getElementById(btnId);
  const badge = document.getElementById(badgeId);

  if (!btn) return;

  /* ── Set loading state ── */
  btn.disabled     = true;
  const origHTML   = btn.innerHTML;
  btn.innerHTML    = `
    <svg width="12" height="12" viewBox="0 0 12 12" class="tg-spin" style="animation:tgRotate .7s linear infinite">
      <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="18 6"/>
    </svg>
    Sending...`;

  try {
    const res = await fetch(`${BACKEND_URL}/api/resend-alert`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        target,
        patient_name:  'Ravi Kumar',
        patient_id:    'PAT-2024-001',
        diagnosis:     lastPrediction ? lastPrediction.primary_diagnosis : 'Not available',
        severity:      lastPrediction ? lastPrediction.severity_level     : 'Unknown',
      })
    });

    const data = await res.json();

    if (data.success) {
      /* ── Success: update badge with Twilio status ── */
      applyTwilioStatus(badge, data.status || 'sent');
      btn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <polyline points="1,6 4,9 11,2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Sent ✓`;
      btn.classList.add('success');
      showTgToast(`✅ Alert resent! SID: ${data.messageSid || 'OK'}`, 'success');

      /* ── Revert button text after 3s ── */
      setTimeout(() => {
        btn.innerHTML    = origHTML;
        btn.classList.remove('success');
        btn.disabled     = false;
      }, 3500);

    } else {
      throw new Error(data.error || 'Backend returned failure');
    }

  } catch (err) {
    console.error('Resend error:', err);

    /* ── Check if it's a network error (backend not running) ── */
    const isNetworkErr = err.message.includes('fetch') || err.message.includes('Failed');

    if (isNetworkErr) {
      /* Simulate success for demo/dev mode when backend not connected */
      applyTwilioStatus(badge, 'sent');
      btn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <polyline points="1,6 4,9 11,2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        Sent (demo)`;
      btn.classList.add('success');
      showTgToast('ℹ️ Demo mode — backend not connected', 'info');
      setTimeout(() => {
        btn.innerHTML    = origHTML;
        btn.classList.remove('success');
        btn.disabled     = false;
      }, 3500);
    } else {
      /* Real failure */
      applyTwilioStatus(badge, 'failed');
      btn.innerHTML = '⚠️ Failed — Retry';
      btn.disabled  = false;
      showTgToast(`❌ Failed: ${err.message}`, 'error');
    }
  }
}

/* ════════════════════════════════════════════
   Public resend functions called from HTML
   ════════════════════════════════════════════ */

/** Location section cards */
function resendTelegramAlert(target) {
  doResendAlert(`tg-resend-${target}`, `tg-badge-${target}`, target);
}

/** Alerts section cards */
function resendTelegramAlert2(target) {
  doResendAlert(`tg-resend2-${target}`, `tg-badge2-${target}`, target);
}

/* ════════════════════════════════════════════
   Twilio Webhook handler
   (call this from your backend SSE/polling or
    WebSocket when Twilio sends status update)

   Example Flask route:
   POST /api/twilio-webhook
   Twilio sends: MessageStatus, SmsSid, To

   Your Flask can broadcast via SSE, and frontend
   calls: receiveTwilioWebhook({ target:'family', status:'delivered' })
   ════════════════════════════════════════════ */
function receiveTwilioWebhook({ target, status }) {
  /* Update Location section badge */
  const badge1 = document.getElementById(`tg-badge-${target}`);
  applyTwilioStatus(badge1, status);

  /* Update Alerts section badge */
  const badge2 = document.getElementById(`tg-badge2-${target}`);
  applyTwilioStatus(badge2, status);

  /* Show toast */
  const { label } = getTwilioBadgeClass(status);
  showTgToast(`📬 ${target} alert: ${label}`, status === 'delivered' ? 'success' : status === 'failed' ? 'error' : 'info');
}

/* ════════════════════════════════════════════
   Poll Twilio status from backend
   (optional — call if SSE not available)
   Polls every 5 seconds for 60 seconds after
   a resend to get updated delivery status.
   ════════════════════════════════════════════ */
function pollTwilioStatus(target, messageSid, attempts = 12) {
  if (attempts <= 0) return;

  setTimeout(async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/twilio-status?sid=${messageSid}`);
      const data = await res.json();

      if (data.status) {
        receiveTwilioWebhook({ target, status: data.status });
        /* Stop polling on terminal states */
        if (['delivered', 'failed', 'undelivered'].includes(data.status)) return;
      }

      pollTwilioStatus(target, messageSid, attempts - 1);
    } catch {
      pollTwilioStatus(target, messageSid, attempts - 1);
    }
  }, 5000);
}

/* ── Add CSS for spinner rotation (needed by resend button) ── */
const tgStyle = document.createElement('style');
tgStyle.textContent = `@keyframes tgRotate { to { transform: rotate(360deg); } }`;
document.head.appendChild(tgStyle);