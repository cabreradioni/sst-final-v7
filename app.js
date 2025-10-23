/* =======================
   SST Dashboard – app.js
   ======================= */

/* ---------- LocalStorage keys ---------- */
const LS_KEYS = {
  STUDENTS: 'sst_student_list',        // lista guardada (select)
  HISTORY:  'sst_history'              // sesiones pasadas
};

/* ---------- State ---------- */
let studentList = [];                  // nombres guardados (select)
let sessionStudents = [];              // nombres en la tabla de la sesión
let metrics = {};                      // { [name]: {p:0,r:0,c:0} }

let timer = { startAt: null, elapsed: 0, interval: null };

/* ---------- Elements ---------- */
const el = (id) => document.getElementById(id);
const sessionMinutesInput = el('sessionMinutes');
const studentNameInput    = el('studentNameInput');
const studentSelect       = el('studentSelect');
const addStudentBtn       = el('addStudentBtn');
const deleteStudentBtn    = el('deleteStudentBtn');
const exportCsvBtn        = el('exportCsvBtn');
const endSessionBtn       = el('endSessionBtn');
const viewHistoryBtn      = el('viewHistoryBtn');

const timerDisplay        = el('timerDisplay');
const startBtn            = el('startBtn');
const stopBtn             = el('stopBtn');
const resetBtn            = el('resetBtn');

const studentsTbody       = el('studentsTbody');

/* Charts */
let barChart, donutChart;

/* ---------- Utilities ---------- */
const loadLS = (k, fb) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fb; }
  catch { return fb; }
};
const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const sum = (a) => a.reduce((x,y)=>x+y,0);

/* ---------- Init ---------- */
function init() {
  // cargar lista guardada
  studentList = loadLS(LS_KEYS.STUDENTS, []);
  renderStudentSelect();

  // limpiar sesión actual
  sessionStudents = [];
  metrics = {};
  renderStudentsTable();
  ensureCharts();

  // listeners
  addStudentBtn.addEventListener('click', onAddStudent);
  deleteStudentBtn.addEventListener('click', onDeleteStudentFromList);

  startBtn.addEventListener('click', startTimer);
  stopBtn.addEventListener('click', stopTimer);
  resetBtn.addEventListener('click', resetTimer);

  exportCsvBtn.addEventListener('click', exportCSV);
  endSessionBtn.addEventListener('click', endSession);
  viewHistoryBtn.addEventListener('click', () => (location.href = 'history.html'));

  // nav lateral
  document.getElementById('btnNavDashboard')
          .addEventListener('click', () => (location.href = 'index.html'));
  document.getElementById('btnNavHistory')
          .addEventListener('click', () => (location.href = 'history.html'));

  // theme
  document.getElementById('toggleThemeBtn')
          .addEventListener('click', () => document.documentElement.classList.toggle('dark'));

  // timer inicial
  updateTimerDisplay(0);
}

/* ---------- Student List (select) ---------- */
function renderStudentSelect() {
  studentSelect.innerHTML = '';
  if (studentList.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(no students saved)';
    studentSelect.appendChild(opt);
    return;
  }
  studentList.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    studentSelect.appendChild(opt);
  });
}

function onAddStudent() {
  // 1) texto del input; si está vacío, usa el seleccionado
  let name = (studentNameInput.value || '').trim();
  if (!name) name = (studentSelect.value || '').trim();
  if (!name) return;

  // 2) añadir a la tabla de esta sesión
  if (!sessionStudents.includes(name)) {
    sessionStudents.push(name);
    if (!metrics[name]) metrics[name] = { p:0, r:0, c:0 };
    renderStudentsTable();
    updateCharts();
  }
  // 3) si no estaba en la lista guardada, se agrega
  if (!studentList.includes(name)) {
    studentList.push(name);
    studentList.sort((a,b)=>a.localeCompare(b));
    saveLS(LS_KEYS.STUDENTS, studentList);
    renderStudentSelect();
    studentSelect.value = name;
  }
  studentNameInput.value = '';
}

function onDeleteStudentFromList() {
  const name = (studentSelect.value || '').trim();
  if (!name) return;
  // Eliminar SOLO del listado guardado
  studentList = studentList.filter(n => n !== name);
  saveLS(LS_KEYS.STUDENTS, studentList);
  renderStudentSelect();
  // Importante: NO tocar sessionStudents ni metrics (la sesión sigue igual)
}

/* ---------- Tabla de la sesión ---------- */
function renderStudentsTable() {
  studentsTbody.innerHTML = '';
  sessionStudents.forEach(name => {
    const m = metrics[name] || {p:0, r:0, c:0};
    const total = m.p + m.r + m.c;

    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = name;

    const tdP = counterCell(name, 'p', m.p);
    const tdR = counterCell(name, 'r', m.r);
    const tdC = counterCell(name, 'c', m.c);

    const tdTotal = document.createElement('td');
    tdTotal.textContent = total;

    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'btn danger soft';
    delBtn.textContent = '🗑';
    delBtn.title = 'Remove row from this session';
    delBtn.addEventListener('click', () => {
      // quitar de ESTA sesión únicamente
      sessionStudents = sessionStudents.filter(n => n !== name);
      delete metrics[name];
      renderStudentsTable();
      updateCharts();
    });
    tdDel.appendChild(delBtn);

    tr.append(tdName, tdP, tdR, tdC, tdTotal, tdDel);
    studentsTbody.appendChild(tr);
  });
}

function counterCell(name, key, value) {
  const td = document.createElement('td');

  const minus = document.createElement('button');
  minus.className = 'btn danger tiny';
  minus.textContent = '−';
  minus.addEventListener('click', () => {
    metrics[name][key] = Math.max(0, metrics[name][key]-1);
    renderStudentsTable();
    updateCharts();
  });

  const span = document.createElement('span');
  span.className = 'counter';
  span.textContent = value;

  const plus = document.createElement('button');
  plus.className = 'btn primary tiny';
  plus.textContent = '+';
  plus.addEventListener('click', () => {
    metrics[name][key] += 1;
    renderStudentsTable();
    updateCharts();
  });

  td.append(minus, span, plus);
  return td;
}

/* ---------- Timer ---------- */
function startTimer() {
  if (timer.interval) return;
  timer.startAt = Date.now() - timer.elapsed;
  timer.interval = setInterval(() => {
    timer.elapsed = Date.now() - timer.startAt;
    updateTimerDisplay(timer.elapsed);
  }, 250);
}
function stopTimer() {
  if (timer.interval) {
    clearInterval(timer.interval);
    timer.interval = null;
  }
}
function resetTimer() {
  stopTimer();
  timer.elapsed = 0;
  timer.startAt = null;
  updateTimerDisplay(0);
}
function updateTimerDisplay(ms) {
  const totalSeconds = Math.floor(ms/1000);
  const hh = String(Math.floor(totalSeconds/3600)).padStart(2,'0');
  const mm = String(Math.floor((totalSeconds%3600)/60)).padStart(2,'0');
  const ss = String(totalSeconds%60).padStart(2,'0');
  timerDisplay.textContent = `${hh}:${mm}:${ss}`;
}

/* ---------- End session & History ---------- */
function endSession() {
  const record = {
    at: new Date().toISOString(),
    minutesPlanned: Number(sessionMinutesInput.value || 0),
    durationMs: timer.elapsed,
    students: sessionStudents.map(name => ({
      name,
      p: metrics[name]?.p ?? 0,
      r: metrics[name]?.r ?? 0,
      c: metrics[name]?.c ?? 0
    }))
  };

  const hist = loadLS(LS_KEYS.HISTORY, []);
  hist.push(record);
  saveLS(LS_KEYS.HISTORY, hist);

  // limpiar SOLO la sesión
  sessionStudents = [];
  metrics = {};
  renderStudentsTable();
  updateCharts();
  resetTimer();

  alert('Session saved to history and cleared.');
}

/* ---------- CSV ---------- */
function exportCSV() {
  if (sessionStudents.length === 0) {
    alert('No data to export.');
    return;
  }
  const header = ['Student','Participation','Responses','Chat','Total'];
  const rows = sessionStudents.map(name => {
    const m = metrics[name] || {p:0,r:0,c:0};
    return [name, m.p, m.r, m.c, m.p+m.r+m.c];
  });
  const lines = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([lines], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sst-session.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Charts ---------- */
function ensureCharts() {
  const barCtx = document.getElementById('barChart');
  const donutCtx = document.getElementById('donutChart');

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Participation', data: [], backgroundColor: '#2d8cff' },
        { label: 'Responses',    data: [], backgroundColor: '#27ae60' },
        { label: 'Chat',         data: [], backgroundColor: '#f1c40f' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: 'bottom' } }
    }
  });

  donutChart = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: ['Participation','Responses','Chat'],
      datasets: [{ data: [0,0,0],
        backgroundColor: ['#2d8cff','#27ae60','#f1c40f'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{position:'bottom'}} }
  });
  updateCharts();
}

function updateCharts() {
  const labels = sessionStudents.slice();
  const dataP = labels.map(n => (metrics[n]?.p ?? 0));
  const dataR = labels.map(n => (metrics[n]?.r ?? 0));
  const dataC = labels.map(n => (metrics[n]?.c ?? 0));

  // bar
  barChart.data.labels = labels;
  barChart.data.datasets[0].data = dataP;
  barChart.data.datasets[1].data = dataR;
  barChart.data.datasets[2].data = dataC;
  barChart.update();

  // donut
  donutChart.data.datasets[0].data = [sum(dataP), sum(dataR), sum(dataC)];
  donutChart.update();
}

/* ---------- Start ---------- */
document.addEventListener('DOMContentLoaded', init);
