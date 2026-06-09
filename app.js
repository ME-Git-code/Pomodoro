// ── Audio Engine ──────────────────────────────────────────────
let audioCtx = null;
let soundOn = true;
let tickNode = null;
let tickGain = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function startTick() {
  if (!soundOn) return;
  stopTick();
  const ctx = getCtx();
  // Metronome-style tick using oscillator + envelope
  function scheduleTick() {
    if (!running) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1200;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
    tickTimer = setTimeout(scheduleTick, 1000);
  }
  scheduleTick();
}

let tickTimer = null;
function stopTick() { clearTimeout(tickTimer); }

function ringBell() {
  if (!soundOn) return;
  const ctx = getCtx();
  // Rich bell chord
  [[660, 0.4], [880, 0.25], [1320, 0.15], [1760, 0.08]].forEach(([freq, vol]) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.6);
  });
  // Second ring after 0.5s
  setTimeout(() => {
    if (!soundOn) return;
    [[660,0.3],[1320,0.12]].forEach(([freq,vol]) => {
      const ctx2 = getCtx();
      const osc = ctx2.createOscillator();
      const g   = ctx2.createGain();
      osc.connect(g); g.connect(ctx2.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx2.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx2.currentTime + 1.5);
      osc.start(ctx2.currentTime); osc.stop(ctx2.currentTime + 1.6);
    });
  }, 500);
}

// ── State ────────────────────────────────────────────────────
const CFG = { focus: 25, short: 5, long: 15 };
let mode = 'focus';
let totalSecs = CFG.focus * 60;
let remaining = totalSecs;
let running = false;
let iv = null;
let sessionInCycle = 0;
let completedToday = 0;
let totalMinutes = 0;
let streak = 0;
const CYCLES = 4;
const STORE_KEY = 'pomodoroProState';
let dailyGoal = 8;
let history = [];

const MODES = {
  focus: { lbl: 'FOKUS VAQTI',      ring: '#d4a853', tab: 'active' },
  short: { lbl: 'QISQA TANAFFUS',   ring: '#5a8f6a', tab: 'active-short' },
  long:  { lbl: 'UZUN TANAFFUS',    ring: '#4a7da8', tab: 'active-long'  },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return {
    date: todayKey(),
    cfg: { ...CFG },
    completedToday: 0,
    totalMinutes: 0,
    streak: 0,
    sessionInCycle: 0,
    dailyGoal: 8,
    task: '',
    history: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || defaultState();
    if (saved.cfg) Object.assign(CFG, saved.cfg);
    dailyGoal = Math.max(1, Math.min(24, Number(saved.dailyGoal) || 8));

    if (saved.date === todayKey()) {
      completedToday = Number(saved.completedToday) || 0;
      totalMinutes = Number(saved.totalMinutes) || 0;
      streak = Number(saved.streak) || 0;
      sessionInCycle = Number(saved.sessionInCycle) || 0;
      history = Array.isArray(saved.history) ? saved.history : [];
    }

    const taskInput = document.getElementById('taskInput');
    if (taskInput) taskInput.value = saved.task || '';
  } catch (err) {
    console.warn('Saqlangan maʼlumotni o‘qib bo‘lmadi:', err);
  }
}

function saveState() {
  const taskInput = document.getElementById('taskInput');
  const state = {
    date: todayKey(),
    cfg: { ...CFG },
    completedToday,
    totalMinutes,
    streak,
    sessionInCycle,
    dailyGoal,
    task: taskInput ? taskInput.value.trim() : '',
    history
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// ── Tick marks on ring ────────────────────────────────────────
(function buildTicks() {
  const g = document.getElementById('tickMarks');
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const r1 = i % 5 === 0 ? 92 : 95;
    const r2 = 100;
    const x1 = 110 + r1 * Math.cos(angle);
    const y1 = 110 + r1 * Math.sin(angle);
    const x2 = 110 + r2 * Math.cos(angle);
    const y2 = 110 + r2 * Math.sin(angle);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('stroke', i % 5 === 0 ? 'rgba(212,168,83,0.25)' : 'rgba(245,234,216,0.06)');
    line.setAttribute('stroke-width', i % 5 === 0 ? '1.5' : '0.8');
    g.appendChild(line);
  }
})();

// ── Particles ────────────────────────────────────────────────
(function spawnParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left  = Math.random() * 100 + '%';
    p.style.top   = Math.random() * 100 + '%';
    const dur  = 8 + Math.random() * 20;
    const delay = -Math.random() * 20;
    p.style.animation = `particleFall ${dur}s ${delay}s linear infinite`;
    p.style.opacity   = 0.2 + Math.random() * 0.5;
    container.appendChild(p);
  }
})();

// ── Render ───────────────────────────────────────────────────
function fmt(s) {
  const m = Math.floor(s / 60), sec = s % 60;
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function updateRing() {
  const pct    = remaining / totalSecs;
  const offset = 628.3 * (1 - pct);
  const ring   = document.getElementById('ring');
  ring.style.strokeDashoffset = offset;
  ring.setAttribute('stroke', MODES[mode].ring);
}

function buildDots() {
  const c = document.getElementById('dots');
  c.innerHTML = '';
  for (let i = 0; i < CYCLES; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i < sessionInCycle ? ' done' : i === sessionInCycle ? ' cur' : '');
    c.appendChild(d);
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '';

  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'Hali sessiya yo‘q';
    list.appendChild(empty);
    return;
  }

  history.slice(-5).reverse().forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = item.time;

    const task = document.createElement('div');
    task.className = 'history-task';
    task.textContent = item.task || 'Nomsiz fokus';
    task.title = item.task || 'Nomsiz fokus';

    const min = document.createElement('div');
    min.className = 'history-min';
    min.textContent = item.minutes + ' min';

    row.append(time, task, min);
    list.appendChild(row);
  });
}

function render() {
  document.getElementById('timeDsp').textContent    = fmt(remaining);
  document.getElementById('modeLbl').textContent    = MODES[mode].lbl;
  document.getElementById('sessionPill').textContent = 'Sessiya ' + (sessionInCycle+1) + ' / ' + CYCLES;
  document.getElementById('stCompleted').textContent = completedToday;
  document.getElementById('stMinutes').textContent   = Math.round(totalMinutes);
  document.getElementById('stStreak').textContent    = streak;
  document.getElementById('todaySpan').textContent   = completedToday;
  document.getElementById('goalDone').textContent     = completedToday;
  document.getElementById('goalTarget').textContent   = dailyGoal;
  document.getElementById('goalFill').style.width     = Math.min(100, (completedToday / dailyGoal) * 100) + '%';
  document.getElementById('vFocus').textContent       = CFG.focus;
  document.getElementById('vShort').textContent       = CFG.short;
  document.getElementById('vLong').textContent        = CFG.long;
  updateRing();
  buildDots();
  renderHistory();

  // Pulse ring while running
  document.getElementById('clockWrap').classList.toggle('running', running);

  // Time display color near end
  const disp = document.getElementById('timeDsp');
  if (remaining <= 60 && mode === 'focus') {
    disp.style.color = '#c0564a';
  } else {
    disp.style.color = 'var(--text)';
  }
}

// ── Tab update ───────────────────────────────────────────────
function updateTabs() {
  const btns = document.querySelectorAll('.tab');
  ['focus','short','long'].forEach((m2, i) => {
    btns[i].className = 'tab' + (m2 === mode ? (' ' + MODES[m2].tab) : '');
  });
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Mode ─────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  stopTimer();
  totalSecs = CFG[m] * 60;
  remaining = totalSecs;
  updateTabs();
  render();
}

function stopTimer() {
  clearInterval(iv); iv = null;
  stopTick();
  running = false;
  document.getElementById('playIco').className = 'ti ti-player-play';
}

// ── Toggle ───────────────────────────────────────────────────
function toggleTimer() {
  if (running) {
    stopTimer();
  } else {
    running = true;
    document.getElementById('playIco').className = 'ti ti-player-pause';
    if (soundOn) startTick();
    iv = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        onComplete();
      }
      render();
    }, 1000);
  }
  render();
}

function addHistoryEntry() {
  const taskInput = document.getElementById('taskInput');
  const task = taskInput && taskInput.value.trim() ? taskInput.value.trim() : 'Nomsiz fokus';
  history.push({
    task,
    minutes: CFG.focus,
    time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  });
  history = history.slice(-20);
}

function onComplete() {
  stopTimer();
  ringBell();

  if (mode === 'focus') {
    addHistoryEntry();
    completedToday++;
    totalMinutes += CFG.focus;
    streak++;
    sessionInCycle = (sessionInCycle + 1) % CYCLES;
    saveState();
    if (sessionInCycle === 0) {
      showToast('🎉 4 sessiya tugadi! Uzoq tanaffus vaqti.');
      setTimeout(() => setMode('long'), 400);
    } else {
      showToast('✓ Sessiya tugadi! Qisqa tanaffus oling.');
      setTimeout(() => setMode('short'), 400);
    }
  } else {
    showToast('Tayyor! Yangi fokus sessiyasi.');
    setTimeout(() => setMode('focus'), 400);
  }
  render();
}

// ── Skip ─────────────────────────────────────────────────────
function skipBack() {
  stopTimer();
  remaining = totalSecs;
  render();
}

function skipNext() { onComplete(); }

// ── Adjust settings ──────────────────────────────────────────
function adj(type, delta) {
  CFG[type] = Math.max(1, Math.min(90, CFG[type] + delta));
  document.getElementById('v' + type.charAt(0).toUpperCase() + type.slice(1)).textContent = CFG[type];
  if (mode === type) {
    stopTimer();
    totalSecs = CFG[type] * 60;
    remaining = totalSecs;
    render();
  }
  saveState();
}

function adjGoal(delta) {
  dailyGoal = Math.max(1, Math.min(24, dailyGoal + delta));
  saveState();
  render();
}

function clearToday() {
  completedToday = 0;
  totalMinutes = 0;
  streak = 0;
  sessionInCycle = 0;
  history = [];
  saveState();
  render();
  showToast('Bugungi statistika tozalandi.');
}

// ── Sound ────────────────────────────────────────────────────
function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('soundIco').className = soundOn ? 'ti ti-volume' : 'ti ti-volume-off';
  document.getElementById('soundTxt').textContent = soundOn ? 'Ovoz yoqilgan' : "Ovoz o'chirilgan";
  if (!soundOn) stopTick();
  else if (running) startTick();
}

// ── Init ─────────────────────────────────────────────────────
loadState();
totalSecs = CFG[mode] * 60;
remaining = totalSecs;
updateTabs();
document.getElementById('taskInput').addEventListener('input', saveState);
render();
