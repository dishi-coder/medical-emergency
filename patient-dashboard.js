/* ═══════════════════════════════════════════════
   MediCare Hospital — patient-dashboard.js
   FIXED: hardcoded 'Ravi Kumar' hata diya
   ═══════════════════════════════════════════════ */

Auth.requireLogin('patient');

const BACKEND_URL = 'http://127.0.0.1:5000';

let locationSharing = true;
let lastPrediction  = null;

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
   INITIALIZE
   ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  loadDashboardStats();
  setupSymptomChips();

  const overlay = document.getElementById('emergency-modal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }
});

/* ✅ FIXED: Auth.getUser() se real naam aata hai */
function loadUserData() {
  const user = Auth.getUser();
  if (!user) return;

  const initials = Auth.getInitials(user.name);
  document.getElementById('sidebar-avatar').textContent  = initials;
  document.getElementById('sidebar-name').textContent    = user.name;
  document.getElementById('sidebar-id').textContent      = 'ID: ' + (user.id || 'Unknown');
  document.getElementById('topbar-greeting').textContent = 'Welcome back, ' + user.name;
  document.getElementById('topbar-avatar').textContent   = initials;
}

function loadDashboardStats() {
  const user        = Auth.getUser();
  const predictions = Auth.getAIPredictions(user?.id);
  const alerts      = Auth.getEmergencyAlerts(user?.id);

  if (predictions.length > 0) {
    const latest     = predictions[predictions.length - 1];
    const sevMap     = { 'Low': 25, 'Mild': 30, 'Moderate': 50, 'High': 75, 'Critical': 100 };
    const sevPercent = sevMap[latest.severity] || 50;

    document.getElementById('stat-disease').textContent      = latest.disease;
    document.getElementById('stat-disease-time').textContent = new Date(latest.timestamp).toLocaleString();
    document.getElementById('stat-severity').textContent     = latest.severity;
    document.getElementById('stat-severity-score').textContent = 'Confidence: ' + (latest.confidence * 100).toFixed(0) + '%';
    document.getElementById('diagnosis-name').textContent    = latest.disease;
    document.getElementById('diagnosis-rec').textContent     = 'Severity: ' + latest.severity;
    document.getElementById('sev-badge').textContent         = latest.severity + ' — ' + (latest.confidence * 100).toFixed(0);
    document.getElementById('sev-fill').style.width          = sevPercent + '%';

    let sympHTML = `<div class="condition-row top">
      <span class="condition-name">${latest.disease}</span>
      <div class="prob-bar"><div class="prob-fill" style="width:${latest.confidence * 100}%"></div></div>
      <span class="prob-pct">${(latest.confidence * 100).toFixed(0)}%</span>
    </div>`;

    if (latest.symptoms?.length > 0) {
      latest.symptoms.forEach((sym, idx) => {
        const prob = Math.max(85 - idx * 15, 40);
        sympHTML += `<div class="condition-row">
          <span class="condition-name">${sym}</span>
          <div class="prob-bar"><div class="prob-fill" style="width:${prob}%"></div></div>
          <span class="prob-pct">${prob}%</span>
        </div>`;
      });
    }
    document.getElementById('conditions-list').innerHTML = sympHTML;
  }

  document.getElementById('stat-count').textContent      = predictions.length;
  document.getElementById('stat-count-meta').textContent = predictions.length > 0
    ? 'Last ' + new Date(predictions[predictions.length - 1].timestamp).toLocaleDateString()
    : 'No predictions';

  document.getElementById('stat-alerts').textContent      = alerts.length;
  document.getElementById('alert-badge').textContent      = alerts.length;
  document.getElementById('stat-alerts-meta').textContent = alerts.length > 0 ? alerts.length + ' alerts' : 'No alerts';
}

/* ════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════ */
function showSection(name, linkEl) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById('sec-' + name);
  if (target) target.classList.add('active');
  if (linkEl) linkEl.classList.add('active');

  const titles = {
    overview: 'Overview', symptoms: 'Send Symptoms',
    'ai-result': 'AI Results', reports: 'My Reports',
    location: 'Live Location', alerts: 'Alerts',
  };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (window.innerWidth < 768) {
    document.getElementById('sidebar').style.transform = 'translateX(-100%)';
  }
  if (name === 'location' && dashMap) setTimeout(() => dashMap.invalidateSize(), 100);
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
  if (el) el.textContent = count === 0 ? '0 symptoms selected' : count + ' symptom' + (count > 1 ? 's' : '') + ' selected';
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
  if (symptoms.length === 0) { alert('Please select at least one symptom.'); return; }

  const btn     = document.getElementById('analyze-btn');
  const btnText = document.getElementById('analyze-text');
  const spin    = document.getElementById('analyze-spin');

  btn.disabled        = true;
  btnText.textContent = 'Analyzing...';
  spin.classList.remove('hidden');

  /* ✅ Real user naam use karo */
  const user = Auth.getUser();

  try {
    const res = await fetch(`${BACKEND_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_name: user?.name || 'Patient',
        patient_age:  user?.age  || 'N/A',
        symptoms
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Prediction failed');

    const result = {
      severity_score:    data.prediction.confidence,
      severity_level:    data.prediction.severity,
      primary_diagnosis: data.prediction.disease,
      doctor_type:       data.prediction.doctor,
      recommendation:    data.emergency_alert.message,
      conditions: data.top3_predictions.map(p => ({ name: p.disease, probability: p.confidence }))
    };

    lastPrediction = result;

    /* Save to Auth log */
    Auth.logAIPrediction({
      disease:    result.primary_diagnosis,
      severity:   result.severity_level,
      confidence: result.severity_score / 100,
      symptoms,
    });

    displayAIResult(result, symptoms);
    showSection('ai-result', document.querySelector('[onclick*="ai-result"]'));
    updateTelegramCardDesc('family',   `${result.primary_diagnosis} · ${result.severity_level}`);
    updateTelegramCardDesc('hospital', `Dr. Sunita Mehta — ${result.doctor_type}`);

  } catch (err) {
    console.error('AI Error:', err);

    /* Demo fallback */
    let diagnosis = 'Common Cold', severity = 'Low', score = 25, doctor = 'General Physician';
    if (symptoms.includes('Chest_pain') || symptoms.includes('Shortness_breath')) {
      diagnosis = 'Possible Heart/Lung Issue'; severity = 'High'; score = 75; doctor = 'Cardiologist';
    } else if (symptoms.includes('High_fever') && symptoms.includes('Body_ache')) {
      diagnosis = 'Flu'; severity = 'Moderate'; score = 50;
    } else if (symptoms.includes('Severe_headache')) {
      diagnosis = 'Migraine'; severity = 'Low'; score = 30; doctor = 'Neurologist';
    }

    const demoResult = {
      primary_diagnosis: diagnosis, severity_level: severity, severity_score: score,
      doctor_type: doctor,
      recommendation: '⚠️ Demo mode: Backend not connected. Please consult a doctor.',
      conditions: [{ name: diagnosis, probability: score }, { name: 'Other Condition', probability: 40 }]
    };

    displayAIResult(demoResult, symptoms);
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
      <div style="margin-top:16px;font-size:12px;color:var(--muted)">Symptoms analyzed: ${symptoms.join(', ')}</div>
    </div>`;

  updateOverviewCard(r, score, sevColor);
}

function updateOverviewCard(r, score, sevColor) {
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
    dashTileLayer = L.tileLayer(TILE_STREET, { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(dashMap);
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
  dashAccCircle = L.circle([lat, lng], { radius: accuracy, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.06, weight: 1.5, dashArray: '4 4' }).addTo(dashMap);
}

function dashStartTracking() {
  if (!navigator.geolocation) { dashSetStatus('error', '❌ Geolocation not supported.'); return; }
  document.getElementById('dash-track-btn').style.display = 'none';
  document.getElementById('dash-stop-btn').style.display  = 'inline-flex';
  dashSetStatus('loading', '🔍 Locating... GPS signal liya ja raha hai');
  document.getElementById('dash-loc-dot').className = 'loc-dot sharing';
  document.getElementById('loc-text').textContent    = 'Location sharing — Active';
  if (dashWatchId) navigator.geolocation.clearWatch(dashWatchId);
  dashWatchId = navigator.geolocation.watchPosition(dashOnSuccess, dashOnError, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

function dashOnSuccess(pos) {
  const lat  = pos.coords.latitude;
  const lng  = pos.coords.longitude;
  const acc  = Math.round(pos.coords.accuracy);
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  dashUpdateCount++;
  dashSetStatus('success', `✅ Location found — Updated at ${time}`);
  document.getElementById('dash-gps-info')?.classList.add('visible');
  document.getElementById('dash-lat').textContent     = lat.toFixed(6);
  document.getElementById('dash-lng').textContent     = lng.toFixed(6);
  document.getElementById('dash-acc').textContent     = `±${acc} m`;
  document.getElementById('dash-updates').textContent = `#${dashUpdateCount} · ${time}`;
  dashUpdateMap(lat, lng, acc);
  if (dashUpdateCount === 1) {
    dashMap.setView([lat, lng], 16, { animate: true });
    dashMarker.openPopup();
    fetchNearbyHospitals();
  }
}

function dashOnError(err) {
  const msgs = { 1: 'Permission denied. Location allow karo.', 2: 'GPS signal nahi mila.', 3: 'Request timeout.' };
  dashSetStatus('error', '❌ ' + (msgs[err.code] || 'Unable to retrieve location.'));
  document.getElementById('dash-track-btn').style.display = 'inline-flex';
  document.getElementById('dash-stop-btn').style.display  = 'none';
}

function dashStopTracking() {
  if (dashWatchId) { navigator.geolocation.clearWatch(dashWatchId); dashWatchId = null; }
  document.getElementById('dash-track-btn').style.display = 'inline-flex';
  document.getElementById('dash-stop-btn').style.display  = 'none';
  document.getElementById('dash-loc-dot').className = 'loc-dot stopped';
  document.getElementById('loc-text').textContent   = 'Location sharing — Stopped';
  dashSetStatus('loading', 'ℹ️ Tracking stopped.');
}

function dashSetStatus(type, msg) {
  const bar = document.getElementById('dash-status-bar');
  if (!bar) return;
  bar.className   = `visible ${type}`;
  bar.textContent = msg;
}

function dashCenterMap() {
  if (dashMap && dashMarker) dashMap.flyTo(dashMarker.getLatLng(), 16, { animate: true, duration: 1 });
}

function dashShareLocation() {
  if (!dashCurrentLat) { alert('Pehle location fetch karo.'); return; }
  const url = `https://www.google.com/maps?q=${dashCurrentLat},${dashCurrentLng}`;
  if (navigator.share) { navigator.share({ title: 'MediCare Patient Location', url }); }
  else { navigator.clipboard.writeText(url).then(() => alert('📍 Location link copied!')).catch(() => prompt('Copy this link:', url)); }
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
  const R = 6371, dL = (lat2-lat1)*Math.PI/180, dG = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcETA(distKm) {
  const mins = Math.round((distKm/40)*60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `~${mins} min`;
  return `~${Math.round(mins/60)}h ${mins%60}m`;
}

async function fetchNearbyHospitals() {
  if (!dashCurrentLat || !dashCurrentLng) { showHospError('Pehle "Start Tracking" click karo.'); return; }
  showHospLoading();
  try {
    const d = 0.045;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${dashCurrentLng-d},${dashCurrentLat+d},${dashCurrentLng+d},${dashCurrentLat-d}&limit=10&extratags=1`;
    const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || data.length === 0) { await fetchNearbyHospitalsWide(); return; }
    renderHospitals(data);
  } catch (err) { console.error(err); fallbackHospitals(); }
}

async function fetchNearbyHospitalsWide() {
  try {
    const d = 0.135;
    const url = `https://nominatim.openstreetmap.org/search?format=json&amenity=hospital&bounded=1&viewbox=${dashCurrentLng-d},${dashCurrentLat+d},${dashCurrentLng+d},${dashCurrentLat-d}&limit=10&extratags=1`;
    const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    if (!data || data.length === 0) { fallbackHospitals(); return; }
    renderHospitals(data);
  } catch { fallbackHospitals(); }
}

function fallbackHospitals() {
  const known = [
    { name: 'Hamidia Hospital',        lat: 23.2687, lng: 77.4013, phone: '07552540222' },
    { name: 'AIIMS Bhopal',            lat: 23.1992, lng: 77.3188, phone: '07556091500' },
    { name: 'Bansal Hospital',         lat: 23.2343, lng: 77.4341, phone: '07554252000' },
    { name: 'Medanta Bhopal',          lat: 23.2567, lng: 77.4012, phone: '07552700108' },
    { name: 'Apollo Hospitals Bhopal', lat: 23.2432, lng: 77.4178, phone: '07554999900' },
  ];
  renderHospitalObjects(known.map(h => ({ ...h, dist: haversineDistance(dashCurrentLat, dashCurrentLng, h.lat, h.lng), type: 'Hospital' })).sort((a,b) => a.dist-b.dist));
}

function renderHospitals(results) {
  renderHospitalObjects(results.map(r => ({
    name: r.display_name.split(',')[0].trim(), lat: parseFloat(r.lat), lng: parseFloat(r.lon),
    phone: r.extratags?.phone || null, type: 'Hospital',
    dist: haversineDistance(dashCurrentLat, dashCurrentLng, parseFloat(r.lat), parseFloat(r.lon)),
  })).sort((a,b) => a.dist-b.dist).slice(0,5));
}

function renderHospitalObjects(hospitals) {
  if (!hospitals.length) { showHospError('Koi hospital nahi mila.'); return; }
  document.getElementById('hosp-list').innerHTML = hospitals.map((h, i) => `
    <div class="hosp-item ${i===0?'nearest':''}">
      <div class="hosp-item-top">
        <div class="hosp-item-left">
          ${i===0?'<span class="hosp-badge nearest-badge">⭐ Nearest</span>':''}
          <div class="hosp-item-name">${h.name}</div>
          <div class="hosp-item-type">${h.type}</div>
        </div>
        <div class="hosp-item-right">
          <div class="hosp-dist">${h.dist<1?(h.dist*1000).toFixed(0)+'m':h.dist.toFixed(1)+'km'}</div>
          <div class="hosp-eta">🕐 ${calcETA(h.dist)}</div>
        </div>
      </div>
      <div class="hosp-item-actions">
        <a href="tel:${h.phone||'108'}" class="hosp-btn call-btn">📞 ${h.phone?'Call':'108'}</a>
        <a href="https://www.google.com/maps/dir/${dashCurrentLat},${dashCurrentLng}/${h.lat},${h.lng}" target="_blank" class="hosp-btn dir-btn">🗺️ Directions</a>
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
   TELEGRAM ALERT STATUS
   ════════════════════════════════════════════════ */
function getTwilioBadgeClass(status) {
  const map = {
    delivered: { cls: 'delivered', label: 'Delivered' }, sent: { cls: 'sent', label: 'Sent' },
    queued: { cls: 'queued', label: 'Pending' }, accepted: { cls: 'queued', label: 'Pending' },
    sending: { cls: 'sent', label: 'Sending' }, failed: { cls: 'failed', label: 'Failed' },
    undelivered: { cls: 'failed', label: 'Undelivered' },
  };
  return map[status] || { cls: 'queued', label: status || 'Unknown' };
}

function applyTwilioStatus(badgeEl, twilioStatus) {
  if (!badgeEl) return;
  const { cls, label } = getTwilioBadgeClass(twilioStatus);
  badgeEl.className   = `tg-badge ${cls}`;
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
  toast.className   = `tg-toast show toast-${type}`;
  setTimeout(() => { toast.className = 'tg-toast'; }, 3000);
}

/* ✅ FIXED: Auth.getUser() se real naam — koi hardcoded naam nahi */
async function doResendAlert(btnId, badgeId, target) {
  const btn   = document.getElementById(btnId);
  const badge = document.getElementById(badgeId);
  if (!btn) return;

  const user     = Auth.getUser();
  btn.disabled   = true;
  const origHTML = btn.innerHTML;
  btn.innerHTML  = `<svg width="12" height="12" viewBox="0 0 12 12" style="animation:tgRotate .7s linear infinite"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="18 6"/></svg> Sending...`;

  try {
    const res = await fetch(`${BACKEND_URL}/api/resend-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        patient_name: user?.name || 'Patient',   // ✅ real naam
        patient_id:   user?.id   || 'Unknown',   // ✅ real id
        diagnosis:    lastPrediction?.primary_diagnosis || 'Not available',
        severity:     lastPrediction?.severity_level    || 'Unknown',
      })
    });

    const data = await res.json();
    if (data.success) {
      applyTwilioStatus(badge, data.status || 'sent');
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="1,6 4,9 11,2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Sent ✓`;
      btn.classList.add('success');
      showTgToast(`✅ Alert resent! SID: ${data.messageSid || 'OK'}`, 'success');
      setTimeout(() => { btn.innerHTML = origHTML; btn.classList.remove('success'); btn.disabled = false; }, 3500);
    } else throw new Error(data.error || 'Backend returned failure');

  } catch (err) {
    const isNetErr = err.message.includes('fetch') || err.message.includes('Failed');
    if (isNetErr) {
      applyTwilioStatus(badge, 'sent');
      btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="1,6 4,9 11,2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Sent (demo)`;
      btn.classList.add('success');
      showTgToast('ℹ️ Demo mode — backend not connected', 'info');
      setTimeout(() => { btn.innerHTML = origHTML; btn.classList.remove('success'); btn.disabled = false; }, 3500);
    } else {
      applyTwilioStatus(badge, 'failed');
      btn.innerHTML = '⚠️ Failed — Retry';
      btn.disabled  = false;
      showTgToast(`❌ Failed: ${err.message}`, 'error');
    }
  }
}

function resendTelegramAlert(target)  { doResendAlert(`tg-resend-${target}`,  `tg-badge-${target}`,  target); }
function resendTelegramAlert2(target) { doResendAlert(`tg-resend2-${target}`, `tg-badge2-${target}`, target); }

function receiveTwilioWebhook({ target, status }) {
  applyTwilioStatus(document.getElementById(`tg-badge-${target}`), status);
  applyTwilioStatus(document.getElementById(`tg-badge2-${target}`), status);
  const { label } = getTwilioBadgeClass(status);
  showTgToast(`📬 ${target} alert: ${label}`, status === 'delivered' ? 'success' : status === 'failed' ? 'error' : 'info');
}

const tgStyle = document.createElement('style');
tgStyle.textContent = `@keyframes tgRotate { to { transform: rotate(360deg); } }`;
document.head.appendChild(tgStyle);