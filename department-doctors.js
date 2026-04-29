/* ═══════════════════════════════════════════════
   MediCare — departments-doctors.js
   - Departments Flask se load karo
   - Department click → filtered doctors dikhao
   - Har 30 sec mein availability auto-refresh
   ═══════════════════════════════════════════════ */

const BACKEND = 'http://127.0.0.1:5000';

let allDoctors        = [];   // saare doctors cache
let activeSpecialty   = '';   // currently selected department
let refreshInterval   = null;

/* ════════════════════════════════════════════════
   PAGE LOAD
   ════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadDepartments();
  loadDoctors('');          // sabhi doctors load karo
  startAutoRefresh();       // har 30 sec mein refresh
});

/* ════════════════════════════════════════════════
   LOAD DEPARTMENTS FROM FLASK
   ════════════════════════════════════════════════ */
async function loadDepartments() {
  const grid = document.querySelector('.dept-grid');
  if (!grid) return;

  try {
    const res  = await fetch(`${BACKEND}/departments`);
    const data = await res.json();
    if (!data.success) return;

    grid.innerHTML = data.departments.map(d => `
      <div class="dept-card ${d.specialty_key ? 'dept-clickable' : ''} ${d.name === 'Emergency' ? 'dept-emergency' : ''}"
           data-specialty="${d.specialty_key}"
           onclick="filterByDepartment(this, '${d.specialty_key}', '${d.name}')">
        <span class="dept-icon">${d.icon}</span>
        <div class="dept-name">${d.name}</div>
        <div class="dept-count">${d.doctor_count}</div>
      </div>
    `).join('');

  } catch (err) {
    console.warn('Departments load failed — using existing HTML');
    /* Flask nahi chala toh existing HTML rehne do */
  }
}

/* ════════════════════════════════════════════════
   LOAD DOCTORS FROM FLASK
   ════════════════════════════════════════════════ */
async function loadDoctors(specialty = '') {
  const grid = document.querySelector('.doctors-grid');
  if (!grid) return;

  try {
    const url  = specialty ? `${BACKEND}/doctors?specialty=${encodeURIComponent(specialty)}` : `${BACKEND}/doctors`;
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.success) return;

    allDoctors = data.doctors;
    renderDoctors(data.doctors, grid);

  } catch (err) {
    console.warn('Doctors load failed — using existing HTML');
  }
}

/* ════════════════════════════════════════════════
   RENDER DOCTORS
   ════════════════════════════════════════════════ */
function renderDoctors(doctors, grid) {
  if (!grid) return;

  if (doctors.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748b;">
        <div style="font-size:32px;margin-bottom:8px">👨‍⚕️</div>
        <div>Is department mein koi doctor available nahi hai abhi.</div>
        <button onclick="filterByDepartment(null,'','')" 
          style="margin-top:12px;padding:8px 20px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;cursor:pointer;font-family:inherit">
          Sab doctors dekhao
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = doctors.map(d => {
    const statusLabel = d.status === 'available'  ? 'Available'  :
                        d.status === 'in_surgery'  ? 'In surgery' : 'Off duty';
    const statusClass = d.status === 'available'  ? 'available'  :
                        d.status === 'in_surgery'  ? 'busy'       : 'busy';
    return `
      <div class="doctor-card" data-id="${d.id}" data-status="${d.status}">
        <div class="doctor-avatar" style="background:${d.color}">${d.initials}</div>
        <div class="doctor-name">${d.name}</div>
        <div class="doctor-spec">${d.specialty}</div>
        <div class="doctor-exp">${d.experience} years experience</div>
        <span class="available-badge ${statusClass}">${statusLabel}</span>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════════════
   DEPARTMENT CLICK → FILTER DOCTORS
   ════════════════════════════════════════════════ */
function filterByDepartment(cardEl, specialty, deptName) {
  /* Emergency card — seedha call karo */
  if (deptName === 'Emergency') {
    window.location.href = 'tel:108';
    return;
  }

  /* Specialty nahi hai (Pathology, Pharmacy etc) */
  if (!specialty) return;

  /* Active state toggle — same click = deselect */
  const allCards = document.querySelectorAll('.dept-card');
  allCards.forEach(c => c.classList.remove('active'));

  if (activeSpecialty === specialty) {
    /* Deselect — sab doctors dikhao */
    activeSpecialty = '';
    loadDoctors('');
    updateDoctorSectionTitle('Meet our specialists');
  } else {
    activeSpecialty = specialty;
    if (cardEl) cardEl.classList.add('active');
    loadDoctors(specialty);
    updateDoctorSectionTitle(`${deptName} Specialists`);

    /* Doctors section mein scroll karo */
    document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateDoctorSectionTitle(title) {
  const el = document.querySelector('.doctors-section .section-title');
  if (el) el.textContent = title;
}

/* ════════════════════════════════════════════════
   AUTO REFRESH — har 30 sec mein availability update
   ════════════════════════════════════════════════ */
function startAutoRefresh() {
  refreshInterval = setInterval(async () => {
    try {
      const url  = activeSpecialty
        ? `${BACKEND}/doctors?specialty=${encodeURIComponent(activeSpecialty)}`
        : `${BACKEND}/doctors`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.success) return;

      const grid = document.querySelector('.doctors-grid');
      if (!grid) return;

      /* Sirf status badges update karo — pura re-render mat karo */
      data.doctors.forEach(d => {
        const card = grid.querySelector(`[data-id="${d.id}"]`);
        if (!card) return;

        const badge       = card.querySelector('.available-badge');
        const prevStatus  = card.dataset.status;

        if (badge && prevStatus !== d.status) {
          /* Status badla — badge update karo with animation */
          badge.style.transition = 'opacity 0.3s';
          badge.style.opacity    = '0';
          setTimeout(() => {
            badge.textContent  = d.status === 'available' ? 'Available' : d.status === 'in_surgery' ? 'In surgery' : 'Off duty';
            badge.className    = `available-badge ${d.status === 'available' ? 'available' : 'busy'}`;
            badge.style.opacity = '1';
            card.dataset.status = d.status;
          }, 300);
        }
      });

    } catch (err) {
      /* Backend offline — quietly ignore */
    }
  }, 30000); // 30 seconds
}