/* ═══════════════════════════════════════════════
   MediCare Hospital — patient-login.js
   FIXED: Login ab real name use karta hai
   ═══════════════════════════════════════════════ */

let currentTab     = 'login';
let otpMobile      = '';
let countdownInterval = null;
let currentAuthMode   = 'login';
let pendingAuthData   = null;

document.addEventListener('DOMContentLoaded', () => {
  setupOTPBoxes();
  setupPasswordStrength();
});

/* ════════════════════════════════════════════════
   TAB SWITCHING
   ════════════════════════════════════════════════ */
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('otp-form').classList.add('hidden');
  document.getElementById('success-msg').classList.add('hidden');
}

/* ════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════ */
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
  else                           { input.type = 'password'; btn.textContent = '👁'; }
}

function showError(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearError(id)     { const el = document.getElementById(id); if (el) el.textContent = ''; }

function setInputState(inputId, isError) {
  const el = document.getElementById(inputId);
  if (el) el.classList.toggle('error', isError);
}

function isValidMobile(num) {
  return /^(\+91)?[6-9]\d{9}$/.test(num.replace(/\s/g, ''));
}

/* ════════════════════════════════════════════════
   ✅ FIXED: LOGIN HANDLER
   Ab registered user ka naam localStorage se
   dhundhta hai — 'Patient' hardcoded nahi hoga
   ════════════════════════════════════════════════ */
function handleLogin(e) {
  e.preventDefault();

  const mobile   = document.getElementById('login-mobile').value.trim();
  const password = document.getElementById('login-password').value;

  let valid = true;
  clearError('err-login-mobile');
  clearError('err-login-password');
  setInputState('login-mobile', false);
  setInputState('login-password', false);

  if (!mobile) {
    showError('err-login-mobile', 'Mobile number is required.');
    setInputState('login-mobile', true);
    valid = false;
  } else if (!isValidMobile(mobile)) {
    showError('err-login-mobile', 'Enter a valid 10-digit mobile number.');
    setInputState('login-mobile', true);
    valid = false;
  }

  if (!password) {
    showError('err-login-password', 'Password is required.');
    setInputState('login-password', true);
    valid = false;
  } else if (password.length < 6) {
    showError('err-login-password', 'Password must be at least 6 characters.');
    setInputState('login-password', true);
    valid = false;
  }

  if (!valid) return;

  const btn    = document.getElementById('login-btn');
  const btnTxt = document.getElementById('login-btn-text');
  const spin   = document.getElementById('login-spinner');

  btn.disabled       = true;
  btnTxt.textContent = 'Logging in...';
  spin.classList.remove('hidden');

  setTimeout(() => {
    btn.disabled       = false;
    btnTxt.textContent = 'Login to Account';
    spin.classList.add('hidden');

    /* ── ✅ FIX: LocalStorage se registered patient dhundho ── */
    const patients    = JSON.parse(localStorage.getItem('mc_patients') || '[]');
    const normalizedInput = mobile.replace(/\s/g, '');

    const matchedUser = patients.find(p => {
      const storedMobile = (p.mobile || '').replace(/\s/g, '');
      return storedMobile === normalizedInput && p.password === password;
    });

    if (matchedUser) {
      /* ── Registered user mila — uska real data use karo ── */
      currentAuthMode = 'login';
      pendingAuthData = matchedUser; // poora original data — naam, age, blood group sab
      showSuccess();
    } else {
      /* ── User nahi mila — error dikhao ── */
      showError('err-login-mobile', 'Mobile number or password incorrect.');
      setInputState('login-mobile', true);
      showError('err-login-password', 'Mobile number or password incorrect.');
      setInputState('login-password', true);
    }
  }, 1200);
}

/* ════════════════════════════════════════════════
   REGISTER HANDLER — pehle se theek tha
   ════════════════════════════════════════════════ */
function handleRegister(e) {
  e.preventDefault();

  const name     = document.getElementById('reg-name').value.trim();
  const mobile   = document.getElementById('reg-mobile').value.trim();
  const age      = document.getElementById('reg-age').value;
  const blood    = document.getElementById('reg-blood').value;
  const password = document.getElementById('reg-password').value;
  const terms    = document.getElementById('reg-terms').checked;

  let valid = true;

  ['err-reg-name','err-reg-mobile','err-reg-age','err-reg-password','err-reg-terms'].forEach(clearError);
  ['reg-name','reg-mobile','reg-age','reg-password'].forEach(id => setInputState(id, false));

  if (!name || name.length < 2) {
    showError('err-reg-name', 'Please enter your full name.');
    setInputState('reg-name', true);
    valid = false;
  }

  if (!mobile) {
    showError('err-reg-mobile', 'Mobile number is required.');
    setInputState('reg-mobile', true);
    valid = false;
  } else if (!isValidMobile(mobile)) {
    showError('err-reg-mobile', 'Enter a valid 10-digit mobile number.');
    setInputState('reg-mobile', true);
    valid = false;
  } else {
    /* ── ✅ Duplicate mobile check ── */
    const patients = JSON.parse(localStorage.getItem('mc_patients') || '[]');
    const normalizedInput = mobile.replace(/\s/g, '');
    const exists = patients.find(p => (p.mobile || '').replace(/\s/g, '') === normalizedInput);
    if (exists) {
      showError('err-reg-mobile', 'This mobile number is already registered. Please login.');
      setInputState('reg-mobile', true);
      valid = false;
    }
  }

  if (!age || age < 1 || age > 120) {
    showError('err-reg-age', 'Enter a valid age.');
    setInputState('reg-age', true);
    valid = false;
  }

  if (!password || password.length < 8) {
    showError('err-reg-password', 'Password must be at least 8 characters.');
    setInputState('reg-password', true);
    valid = false;
  }

  if (!terms) {
    showError('err-reg-terms', 'Please accept the Terms & Conditions.');
    valid = false;
  }

  if (!valid) return;

  const btn = e.target.querySelector('.submit-btn');
  btn.disabled     = true;
  btn.textContent  = 'Creating account...';

  setTimeout(() => {
    btn.disabled    = false;
    btn.textContent = 'Create Account';

    currentAuthMode = 'register';
    pendingAuthData = {
      name:     name,
      mobile:   mobile,
      age:      parseInt(age),
      blood:    blood || '',
      password: password,
    };

    showSuccess();
  }, 1500);
}

/* ════════════════════════════════════════════════
   OTP FLOW
   ════════════════════════════════════════════════ */
function switchToOTP() {
  const mobile = document.getElementById('login-mobile').value.trim();

  clearError('err-login-mobile');
  setInputState('login-mobile', false);

  if (!mobile) {
    showError('err-login-mobile', 'Enter your mobile number first to receive OTP.');
    setInputState('login-mobile', true);
    document.getElementById('login-mobile').focus();
    return;
  }

  if (!isValidMobile(mobile)) {
    showError('err-login-mobile', 'Enter a valid 10-digit mobile number.');
    setInputState('login-mobile', true);
    document.getElementById('login-mobile').focus();
    return;
  }

  otpMobile = mobile;

  /* ── OTP login mein bhi real naam dhundho ── */
  const patients = JSON.parse(localStorage.getItem('mc_patients') || '[]');
  const normalizedInput = mobile.replace(/\s/g, '');
  const matchedUser = patients.find(p => (p.mobile || '').replace(/\s/g, '') === normalizedInput);

  pendingAuthData = matchedUser || { name: 'Patient', mobile };

  document.getElementById('otp-mobile-display').textContent = mobile;
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('otp-form').classList.remove('hidden');

  for (let i = 0; i < 6; i++) {
    const box = document.getElementById('otp' + i);
    box.value = '';
    box.classList.remove('filled');
  }
  document.getElementById('otp0').focus();
  startCountdown(30);
}

function backFromOTP() {
  document.getElementById('otp-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  clearInterval(countdownInterval);
}

function handleOTP(e) {
  e.preventDefault();

  let otp = '';
  for (let i = 0; i < 6; i++) otp += document.getElementById('otp' + i).value;

  clearError('err-otp');

  if (otp.length < 6) {
    showError('err-otp', 'Please enter the complete 6-digit OTP.');
    return;
  }

  const btn = e.target.querySelector('.submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Verifying...';

  setTimeout(() => {
    btn.disabled    = false;
    btn.textContent = 'Verify OTP';
    currentAuthMode = 'login';
    showSuccess();
  }, 1500);
}

function resendOTP() {
  document.getElementById('resend-btn').classList.add('hidden');
  document.getElementById('resend-timer').classList.remove('hidden');
  startCountdown(30);
}

function startCountdown(seconds) {
  clearInterval(countdownInterval);
  let remaining = seconds;
  const timerEl  = document.getElementById('resend-timer');
  const countEl  = document.getElementById('countdown');
  const resendEl = document.getElementById('resend-btn');

  timerEl.classList.remove('hidden');
  resendEl.classList.add('hidden');
  countEl.textContent = remaining;

  countdownInterval = setInterval(() => {
    remaining--;
    countEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      timerEl.classList.add('hidden');
      resendEl.classList.remove('hidden');
    }
  }, 1000);
}

/* ════════════════════════════════════════════════
   OTP BOXES
   ════════════════════════════════════════════════ */
function setupOTPBoxes() {
  for (let i = 0; i < 6; i++) {
    const box = document.getElementById('otp' + i);
    if (!box) continue;

    box.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(-1);
      if (this.value) {
        this.classList.add('filled');
        if (i < 5) document.getElementById('otp' + (i + 1)).focus();
      } else {
        this.classList.remove('filled');
      }
    });

    box.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !this.value && i > 0)
        document.getElementById('otp' + (i - 1)).focus();
    });

    box.addEventListener('paste', function (e) {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      for (let j = 0; j < pasted.length; j++) {
        const target = document.getElementById('otp' + j);
        if (target) { target.value = pasted[j]; target.classList.add('filled'); }
      }
      document.getElementById('otp' + Math.min(pasted.length, 5)).focus();
    });
  }
}

/* ════════════════════════════════════════════════
   PASSWORD STRENGTH
   ════════════════════════════════════════════════ */
function setupPasswordStrength() {
  const input = document.getElementById('reg-password');
  if (!input) return;

  input.addEventListener('input', function () {
    const val = this.value;
    const bar = document.getElementById('pwd-strength');
    if (!bar) return;

    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const configs = [
      { width: '0%',   color: '#e2e8f0' },
      { width: '25%',  color: '#ef4444' },
      { width: '50%',  color: '#f97316' },
      { width: '75%',  color: '#eab308' },
      { width: '100%', color: '#22c55e' },
    ];
    const cfg = configs[score];
    bar.style.width      = cfg.width;
    bar.style.background = cfg.color;
  });
}

/* ════════════════════════════════════════════════
   SUCCESS & REDIRECT
   ════════════════════════════════════════════════ */
function showSuccess() {
  if (currentAuthMode === 'register') {
    Auth.register('patient', pendingAuthData);
  } else {
    Auth.login('patient', pendingAuthData);
  }

  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('otp-form').classList.add('hidden');
  document.getElementById('success-msg').classList.remove('hidden');

  setTimeout(() => {
    const bar = document.getElementById('redirect-bar');
    if (bar) bar.style.width = '100%';
  }, 100);

  setTimeout(() => {
    window.location.href = 'patient-dashboard.html';
  }, 2300);
}
