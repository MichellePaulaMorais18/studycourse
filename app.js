/* ══════════════════════════════════
   FIREBASE — INIT + AUTH + DATA
══════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-m0oHSbXNfwDIIsUrpX8ywRa_VTTi4Ww",
  authDomain: "studycourse-6174c.firebaseapp.com",
  databaseURL: "https://studycourse-6174c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studycourse-6174c",
  storageBucket: "studycourse-6174c.firebasestorage.app",
  messagingSenderId: "93654145934",
  appId: "1:93654145934:web:8462cc28eb107b70e422df"
};

const configOk = !FIREBASE_CONFIG.apiKey.includes("COLE_AQUI");
let auth = null, db = null;
if (configOk) {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db   = firebase.database();
}

// Cache em memória — Realtime Database é a fonte de verdade
let cache = {
  concursos: [],   // [{id, nome, orgao, cargo, banca, dataProva, editalLink, etapas:[], materias:[]}]
  sessoes:   [],   // [{id, concursoId, materiaId, data, minutos, obs}]
  questoes:  [],   // [{id, concursoId, materiaId, enunciado, alts:[], correta, acertos, erros, ultimo}]
  simulados: [],   // [{id, concursoId, data, total, acertos}]
  fontes:    [],   // [{id, nome, link, obs, ultimaVisita}] — radar de concursos
  settings:  { activeId: null, dark: false }
};
let currentUid = null;

function userRef() { return db.ref('users/' + currentUid + '/app'); }

// O Realtime Database não guarda arrays vazios e pode devolver objetos
// no lugar de arrays — garante a estrutura esperada pelo app.
function toArr(v) { return Array.isArray(v) ? v : Object.values(v || {}); }

function normalizeCache() {
  cache.concursos = toArr(cache.concursos);
  cache.sessoes   = toArr(cache.sessoes);
  cache.questoes  = toArr(cache.questoes);
  cache.simulados = toArr(cache.simulados);
  cache.fontes    = toArr(cache.fontes);
  cache.settings  = cache.settings || { activeId: null, dark: false };
  cache.concursos.forEach(c => {
    c.etapas   = toArr(c.etapas);
    c.materias = toArr(c.materias);
    c.materias.forEach(m => { m.topicos = toArr(m.topicos); });
  });
  cache.questoes.forEach(q => { q.alts = toArr(q.alts); });
}

async function loadFromDatabase() {
  try {
    const snap = await userRef().once('value');
    const data = snap.val() || {};
    Object.keys(cache).forEach(k => {
      if (data[k] !== undefined) cache[k] = data[k];
    });
    normalizeCache();
  } catch (e) { console.warn('Database load error', e); }
}

function save(key) {
  if (!currentUid) return;
  userRef().child(key).set(cache[key]).catch(e => console.warn('Save error', e));
}

function signInGoogle() {
  if (!configOk) { alert('Configure o Firebase primeiro (veja o aviso na tela).'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e => alert('Erro ao entrar: ' + e.message));
}

function signOutApp() {
  closeDrawer();
  auth.signOut();
}

function initApp() {
  if (!configOk) {
    document.getElementById('login-screen').classList.add('show');
    document.getElementById('setup-notice').style.display = 'block';
    return;
  }
  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUid = user.uid;
      document.getElementById('login-screen').classList.remove('show');
      document.getElementById('app-loading').classList.add('show');
      await loadFromDatabase();
      document.getElementById('app-loading').classList.remove('show');
      const info = document.getElementById('user-info');
      info.style.display = 'flex';
      document.getElementById('user-avatar').src = user.photoURL || '';
      applyDark();
      renderAll();
    } else {
      currentUid = null;
      document.getElementById('login-screen').classList.add('show');
      document.getElementById('user-info').style.display = 'none';
    }
  });
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function getActive() {
  return cache.concursos.find(c => c.id === cache.settings.activeId) || cache.concursos[0] || null;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function fmtMin(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/* ══════════════════════════════════
   NAVEGAÇÃO / UI
══════════════════════════════════ */
const VIEWS = ['dashboard', 'etapas', 'materias', 'estudos', 'quiz', 'fontes', 'concursos'];
let currentView = 'dashboard';

function setView(v) {
  currentView = v;
  VIEWS.forEach(x => {
    const sec = document.getElementById('view-' + x);
    if (sec) sec.style.display = (x === v) ? 'block' : 'none';
    const tab = document.getElementById('tab-' + x);
    if (tab) tab.classList.toggle('active', x === v);
  });
  renderConcursoSelect(); // o Radar é geral — a barra de concurso some nele
}

function openDrawer()  { document.getElementById('side-drawer').classList.add('open'); document.getElementById('drawer-overlay').classList.add('show'); }
function closeDrawer() { document.getElementById('side-drawer').classList.remove('open'); document.getElementById('drawer-overlay').classList.remove('show'); }

function toggleDark() {
  cache.settings.dark = !cache.settings.dark;
  applyDark();
  save('settings');
}
function applyDark() { document.body.classList.toggle('dark', !!cache.settings.dark); }

function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

/* ══════════════════════════════════
   CONCURSOS
══════════════════════════════════ */
function setActiveConcurso(id) {
  cache.settings.activeId = id;
  save('settings');
  renderAll();
}

function openConcursoModal(id) {
  const c = cache.concursos.find(x => x.id === id);
  document.getElementById('modal-concurso-title').textContent = c ? 'Editar concurso' : 'Novo concurso';
  document.getElementById('c-id').value     = c ? c.id : '';
  document.getElementById('c-nome').value   = c ? c.nome : '';
  document.getElementById('c-orgao').value  = c ? (c.orgao || '') : '';
  document.getElementById('c-cargo').value  = c ? (c.cargo || '') : '';
  document.getElementById('c-banca').value  = c ? (c.banca || '') : '';
  document.getElementById('c-status').value = c ? (c.status || 'publicado') : 'previsto';
  document.getElementById('c-data').value   = c ? (c.dataProva || '') : '';
  document.getElementById('c-edital').value = c ? (c.editalLink || '') : '';
  openModal('modal-concurso');
}

function saveConcurso(e) {
  e.preventDefault();
  const id = document.getElementById('c-id').value;
  const dados = {
    nome:       document.getElementById('c-nome').value.trim(),
    orgao:      document.getElementById('c-orgao').value.trim(),
    cargo:      document.getElementById('c-cargo').value.trim(),
    banca:      document.getElementById('c-banca').value.trim(),
    status:     document.getElementById('c-status').value,
    dataProva:  document.getElementById('c-data').value,
    editalLink: document.getElementById('c-edital').value.trim()
  };
  if (id) {
    const c = cache.concursos.find(x => x.id === id);
    Object.assign(c, dados);
  } else {
    const novo = { id: genId(), etapas: [], materias: [], ...dados };
    cache.concursos.push(novo);
    cache.settings.activeId = novo.id;
    save('settings');
  }
  save('concursos');
  closeModal('modal-concurso');
  renderAll();
}

function delConcurso(id) {
  const c = cache.concursos.find(x => x.id === id);
  if (!confirm(`Excluir o concurso "${c.nome}" e todos os dados dele?`)) return;
  cache.concursos = cache.concursos.filter(x => x.id !== id);
  cache.sessoes   = cache.sessoes.filter(s => s.concursoId !== id);
  cache.questoes  = cache.questoes.filter(q => q.concursoId !== id);
  cache.simulados = cache.simulados.filter(s => s.concursoId !== id);
  if (cache.settings.activeId === id) {
    cache.settings.activeId = cache.concursos[0] ? cache.concursos[0].id : null;
    save('settings');
  }
  save('concursos'); save('sessoes'); save('questoes'); save('simulados');
  renderAll();
}

/* ══════════════════════════════════
   ETAPAS
══════════════════════════════════ */
const ETAPAS_PADRAO = [
  'Publicação do edital', 'Inscrições', 'Prova objetiva', 'Resultado preliminar',
  'Prazo de recursos', 'Resultado final', 'Homologação', 'Nomeação e posse'
];

function addDefaultEtapas() {
  const c = getActive();
  if (!c) return;
  ETAPAS_PADRAO.forEach(nome => {
    if (!c.etapas.some(e => e.nome === nome)) {
      c.etapas.push({ id: genId(), nome, data: '', status: 'pendente' });
    }
  });
  save('concursos');
  renderAll();
}

function openEtapaModal(id) {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  const et = c.etapas.find(x => x.id === id);
  document.getElementById('modal-etapa-title').textContent = et ? 'Editar etapa' : 'Nova etapa';
  document.getElementById('e-id').value     = et ? et.id : '';
  document.getElementById('e-nome').value   = et ? et.nome : '';
  document.getElementById('e-data').value   = et ? (et.data || '') : '';
  document.getElementById('e-status').value = et ? et.status : 'pendente';
  openModal('modal-etapa');
}

function saveEtapa(e) {
  e.preventDefault();
  const c = getActive();
  const id = document.getElementById('e-id').value;
  const dados = {
    nome:   document.getElementById('e-nome').value.trim(),
    data:   document.getElementById('e-data').value,
    status: document.getElementById('e-status').value
  };
  if (dados.status === 'atual') c.etapas.forEach(x => { if (x.status === 'atual') x.status = 'pendente'; });
  if (id) {
    Object.assign(c.etapas.find(x => x.id === id), dados);
  } else {
    c.etapas.push({ id: genId(), ...dados });
  }
  save('concursos');
  closeModal('modal-etapa');
  renderAll();
}

function setEtapaStatus(id, status) {
  const c = getActive();
  if (status === 'atual') c.etapas.forEach(x => { if (x.status === 'atual') x.status = 'pendente'; });
  c.etapas.find(x => x.id === id).status = status;
  save('concursos');
  renderAll();
}

function delEtapa(id) {
  const c = getActive();
  if (!confirm('Excluir esta etapa?')) return;
  c.etapas = c.etapas.filter(x => x.id !== id);
  save('concursos');
  renderAll();
}

/* ══════════════════════════════════
   MATÉRIAS E TÓPICOS
══════════════════════════════════ */
function openMateriaModal(id) {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  const m = c.materias.find(x => x.id === id);
  document.getElementById('modal-materia-title').textContent = m ? 'Editar matéria' : 'Nova matéria';
  document.getElementById('m-id').value      = m ? m.id : '';
  document.getElementById('m-nome').value    = m ? m.nome : '';
  document.getElementById('m-topicos').value = m ? m.topicos.map(t => t.nome).join('\n') : '';
  openModal('modal-materia');
}

function saveMateria(e) {
  e.preventDefault();
  const c = getActive();
  const id = document.getElementById('m-id').value;
  const nome = document.getElementById('m-nome').value.trim();
  const linhas = document.getElementById('m-topicos').value
    .split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (id) {
    const m = c.materias.find(x => x.id === id);
    m.nome = nome;
    // Preserva o status dos tópicos que já existiam (comparando pelo nome)
    const antigos = m.topicos;
    m.topicos = linhas.map(l => {
      const old = antigos.find(t => t.nome === l);
      return old || { id: genId(), nome: l, status: 0 };
    });
  } else {
    c.materias.push({
      id: genId(),
      nome,
      topicos: linhas.map(l => ({ id: genId(), nome: l, status: 0 })),
      aberta: true
    });
  }
  save('concursos');
  closeModal('modal-materia');
  renderAll();
}

function delMateria(id) {
  const c = getActive();
  const m = c.materias.find(x => x.id === id);
  if (!confirm(`Excluir a matéria "${m.nome}"?`)) return;
  c.materias = c.materias.filter(x => x.id !== id);
  save('concursos');
  renderAll();
}

// 0 = não estudado → 1 = estudado → 2 = revisado → 0
function cycleTopico(mid, tid) {
  const c = getActive();
  const t = c.materias.find(x => x.id === mid).topicos.find(x => x.id === tid);
  t.status = (t.status + 1) % 3;
  save('concursos');
  renderAll();
}

function toggleMateria(id) {
  const c = getActive();
  const m = c.materias.find(x => x.id === id);
  m.aberta = !m.aberta;
  renderMaterias();
}

function materiaProgresso(m) {
  const total = m.topicos.length;
  if (total === 0) return { estudado: 0, revisado: 0, total: 0 };
  const estudado = m.topicos.filter(t => t.status >= 1).length;
  const revisado = m.topicos.filter(t => t.status === 2).length;
  return { estudado: Math.round(estudado / total * 100), revisado: Math.round(revisado / total * 100), total };
}

/* ══════════════════════════════════
   SESSÕES DE ESTUDO + CRONÔMETRO
══════════════════════════════════ */
let timerSec = 0, timerInterval = null;

function timerTick() {
  timerSec++;
  const h = String(Math.floor(timerSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((timerSec % 3600) / 60)).padStart(2, '0');
  const s = String(timerSec % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
}

function timerStart() {
  const c = getActive();
  if (!c || c.materias.length === 0) { alert('Cadastre uma matéria primeiro.'); return; }
  if (timerInterval) return;
  timerInterval = setInterval(timerTick, 1000);
  document.getElementById('timer-start').disabled = true;
  document.getElementById('timer-pause').disabled = false;
  document.getElementById('timer-stop').disabled = false;
}

function timerPause() {
  clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById('timer-start').disabled = false;
  document.getElementById('timer-pause').disabled = true;
}

function timerStop() {
  clearInterval(timerInterval);
  timerInterval = null;
  const minutos = Math.max(1, Math.round(timerSec / 60));
  const materiaId = document.getElementById('timer-materia').value;
  timerSec = 0;
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('timer-start').disabled = false;
  document.getElementById('timer-pause').disabled = true;
  document.getElementById('timer-stop').disabled = true;
  openSessaoModal(minutos, materiaId);
}

function openSessaoModal(minutos, materiaId) {
  const c = getActive();
  if (!c || c.materias.length === 0) { alert('Cadastre uma matéria primeiro.'); return; }
  const sel = document.getElementById('s-materia');
  sel.innerHTML = c.materias.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('');
  if (materiaId) sel.value = materiaId;
  document.getElementById('s-data').value = todayISO();
  document.getElementById('s-minutos').value = minutos || '';
  document.getElementById('s-obs').value = '';
  openModal('modal-sessao');
}

function saveSessao(e) {
  e.preventDefault();
  const c = getActive();
  cache.sessoes.push({
    id: genId(),
    concursoId: c.id,
    materiaId: document.getElementById('s-materia').value,
    data: document.getElementById('s-data').value,
    minutos: parseInt(document.getElementById('s-minutos').value, 10),
    obs: document.getElementById('s-obs').value.trim()
  });
  save('sessoes');
  closeModal('modal-sessao');
  renderAll();
}

function delSessao(id) {
  if (!confirm('Excluir esta sessão de estudo?')) return;
  cache.sessoes = cache.sessoes.filter(s => s.id !== id);
  save('sessoes');
  renderAll();
}

/* ══════════════════════════════════
   RENDER
══════════════════════════════════ */
function renderAll() {
  renderConcursoSelect();
  renderDashboard();
  renderEtapas();
  renderMaterias();
  renderEstudos();
  renderQuiz();
  renderFontes();
  renderConcursos();
}

function renderConcursoSelect() {
  const bar = document.getElementById('concurso-bar');
  const sel = document.getElementById('concurso-select');
  if (cache.concursos.length === 0 || currentView === 'fontes') { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const ativo = getActive();
  sel.innerHTML = cache.concursos.map(c =>
    `<option value="${c.id}" ${ativo && c.id === ativo.id ? 'selected' : ''}>${esc(c.nome)}</option>`
  ).join('');
}

function renderDashboard() {
  const c = getActive();
  const empty = document.getElementById('dash-empty');
  const content = document.getElementById('dash-content');
  if (!c) { empty.style.display = 'block'; content.style.display = 'none'; return; }
  empty.style.display = 'none';
  content.style.display = 'block';

  // Countdown
  const dias = daysUntil(c.dataProva);
  const elDias = document.getElementById('countdown-days');
  const elLabel = document.getElementById('countdown-label');
  const elSub = document.getElementById('countdown-sub');
  if (dias === null && c.status === 'previsto') {
    elLabel.textContent = c.nome;
    elDias.textContent = '🔭';
    elSub.textContent = 'Concurso previsto — fique de olho nas atualizações' + (c.editalLink ? ' (link no cadastro)' : '');
  } else if (dias === null) {
    elLabel.textContent = c.nome;
    elDias.textContent = '📅';
    elSub.textContent = 'Defina a data da prova no cadastro do concurso';
  } else if (dias > 0) {
    elLabel.textContent = `${c.nome} — faltam`;
    elDias.textContent = dias === 1 ? '1 dia' : `${dias} dias`;
    const sem = Math.floor(dias / 7);
    elSub.textContent = `Prova em ${fmtDate(c.dataProva)}` + (sem > 0 ? ` · ${sem} semana${sem > 1 ? 's' : ''}` : '');
  } else if (dias === 0) {
    elLabel.textContent = c.nome;
    elDias.textContent = 'É HOJE! 🍀';
    elSub.textContent = 'Boa prova! Você se preparou para isso.';
  } else {
    elLabel.textContent = c.nome;
    elDias.textContent = 'Prova realizada';
    elSub.textContent = `Foi em ${fmtDate(c.dataProva)} — acompanhe as próximas etapas`;
  }

  // Etapa atual
  const atual = c.etapas.find(e => e.status === 'atual');
  document.getElementById('stat-etapa').textContent = atual ? atual.nome : '—';

  // Progresso do edital
  const todosTopicos = c.materias.flatMap(m => m.topicos);
  const pct = todosTopicos.length ? Math.round(todosTopicos.filter(t => t.status >= 1).length / todosTopicos.length * 100) : 0;
  document.getElementById('stat-progresso').textContent = pct + '%';

  // Horas
  const sess = cache.sessoes.filter(s => s.concursoId === c.id);
  const total = sess.reduce((a, s) => a + s.minutos, 0);
  const seteDias = new Date(); seteDias.setDate(seteDias.getDate() - 7);
  const isoLimite = `${seteDias.getFullYear()}-${String(seteDias.getMonth() + 1).padStart(2, '0')}-${String(seteDias.getDate()).padStart(2, '0')}`;
  const semana = sess.filter(s => s.data >= isoLimite).reduce((a, s) => a + s.minutos, 0);
  document.getElementById('stat-horas-total').textContent = fmtMin(total);
  document.getElementById('stat-horas-semana').textContent = fmtMin(semana);

  // Progresso por matéria
  const dm = document.getElementById('dash-materias');
  if (c.materias.length === 0) {
    dm.innerHTML = '<p class="hint">Nenhuma matéria cadastrada — adicione as matérias do edital na aba Matérias.</p>';
  } else {
    dm.innerHTML = c.materias.map(m => {
      const p = materiaProgresso(m);
      return `<div class="progress-row">
        <div class="progress-top"><span>${esc(m.nome)}</span><span class="pct">${p.estudado}% estudado · ${p.revisado}% revisado</span></div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${p.estudado}%"></div>
          <div class="progress-fill revisado" style="width:${p.revisado}%"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Próximas etapas
  const de = document.getElementById('dash-etapas');
  const proximas = c.etapas.filter(e => e.status !== 'concluida').slice(0, 4);
  de.innerHTML = proximas.length === 0
    ? '<p class="hint">Nenhuma etapa pendente — adicione as etapas na aba Etapas.</p>'
    : proximas.map(e => `<div class="sessao-row">
        <div class="sessao-info">
          <div class="sessao-materia">${e.status === 'atual' ? '📍 ' : ''}${esc(e.nome)}</div>
          ${e.data ? `<div class="sessao-meta">${fmtDate(e.data)}${daysUntil(e.data) >= 0 ? ` · em ${daysUntil(e.data)} dia(s)` : ''}</div>` : ''}
        </div>
        <span class="etapa-badge ${e.status}">${e.status === 'atual' ? 'Atual' : 'Pendente'}</span>
      </div>`).join('');
}

function renderEtapas() {
  const c = getActive();
  const list = document.getElementById('etapas-list');
  const btnPadrao = document.getElementById('btn-etapas-padrao');
  if (!c) { list.innerHTML = '<p class="hint">Cadastre um concurso primeiro.</p>'; btnPadrao.style.display = 'none'; return; }
  btnPadrao.style.display = c.etapas.length === 0 ? 'inline-block' : 'none';
  if (c.etapas.length === 0) {
    list.innerHTML = '<p class="hint">Nenhuma etapa cadastrada. Use o botão "Usar etapas padrão" para começar com as etapas comuns de um concurso.</p>';
    return;
  }
  list.innerHTML = c.etapas.map(e => `
    <div class="etapa-item ${e.status}">
      <div class="etapa-top">
        <div>
          <div class="etapa-nome">${esc(e.nome)}</div>
          ${e.data ? `<div class="etapa-data">📅 ${fmtDate(e.data)}${e.status !== 'concluida' && daysUntil(e.data) >= 0 ? ` — em ${daysUntil(e.data)} dia(s)` : ''}</div>` : ''}
        </div>
        <span class="etapa-badge ${e.status}">${{ pendente: 'Pendente', atual: '📍 Atual', concluida: '✅ Concluída' }[e.status]}</span>
      </div>
      <div class="etapa-actions">
        ${e.status !== 'atual' ? `<button class="btn-small" onclick="setEtapaStatus('${e.id}','atual')">📍 Marcar atual</button>` : ''}
        ${e.status !== 'concluida' ? `<button class="btn-small" onclick="setEtapaStatus('${e.id}','concluida')">✅ Concluir</button>` : `<button class="btn-small" onclick="setEtapaStatus('${e.id}','pendente')">↩ Reabrir</button>`}
        <button class="btn-small" onclick="openEtapaModal('${e.id}')">✏️ Editar</button>
        <button class="btn-small btn-danger" onclick="delEtapa('${e.id}')">🗑</button>
      </div>
    </div>`).join('');
}

function renderMaterias() {
  const c = getActive();
  const list = document.getElementById('materias-list');
  if (!c) { list.innerHTML = '<p class="hint">Cadastre um concurso primeiro.</p>'; return; }
  if (c.materias.length === 0) {
    list.innerHTML = '<p class="hint">Nenhuma matéria cadastrada. Adicione as matérias do edital e cole os tópicos de cada uma.</p>';
    return;
  }
  const ICONS = ['⬜', '✅', '🔁'];
  list.innerHTML = c.materias.map(m => {
    const p = materiaProgresso(m);
    return `
    <div class="materia-card ${m.aberta ? 'open' : ''}">
      <div class="materia-header" onclick="toggleMateria('${m.id}')">
        <div>
          <div class="materia-nome">${m.aberta ? '▾' : '▸'} ${esc(m.nome)}</div>
          <div class="materia-meta">${p.total} tópico(s) · ${p.estudado}% estudado · ${p.revisado}% revisado</div>
        </div>
      </div>
      <div class="progress-track" style="margin-top:8px">
        <div class="progress-fill" style="width:${p.estudado}%"></div>
        <div class="progress-fill revisado" style="width:${p.revisado}%"></div>
      </div>
      <div class="topicos-list">
        ${m.topicos.length === 0 ? '<p class="hint">Sem tópicos — edite a matéria para colar os tópicos do edital.</p>' : ''}
        ${m.topicos.map(t => `
          <div class="topico-item st-${t.status}" onclick="cycleTopico('${m.id}','${t.id}')">
            <span>${ICONS[t.status]}</span><span class="topico-nome">${esc(t.nome)}</span>
          </div>`).join('')}
        <div class="materia-actions">
          <button class="btn-small" onclick="event.stopPropagation();openMateriaModal('${m.id}')">✏️ Editar / tópicos</button>
          <button class="btn-small btn-danger" onclick="event.stopPropagation();delMateria('${m.id}')">🗑 Excluir</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderEstudos() {
  const c = getActive();
  const sel = document.getElementById('timer-materia');
  const list = document.getElementById('sessoes-list');
  if (!c) {
    sel.innerHTML = '<option>Cadastre um concurso</option>';
    list.innerHTML = '<p class="hint">Cadastre um concurso primeiro.</p>';
    return;
  }
  const keep = sel.value;
  sel.innerHTML = c.materias.length === 0
    ? '<option value="">Cadastre uma matéria primeiro</option>'
    : c.materias.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('');
  if (keep && c.materias.some(m => m.id === keep)) sel.value = keep;

  const sess = cache.sessoes
    .filter(s => s.concursoId === c.id)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 40);
  if (sess.length === 0) {
    list.innerHTML = '<p class="hint">Nenhuma sessão registrada ainda. Use o cronômetro ou registre manualmente.</p>';
    return;
  }
  list.innerHTML = sess.map(s => {
    const m = c.materias.find(x => x.id === s.materiaId);
    return `<div class="sessao-row">
      <div class="sessao-info">
        <div class="sessao-materia">${esc(m ? m.nome : 'Matéria removida')}</div>
        <div class="sessao-meta">${fmtDate(s.data)}${s.obs ? ' · ' + esc(s.obs) : ''}</div>
      </div>
      <span class="sessao-tempo">${fmtMin(s.minutos)}</span>
      <button class="btn-small btn-danger" onclick="delSessao('${s.id}')">🗑</button>
    </div>`;
  }).join('');
}

function renderConcursos() {
  const list = document.getElementById('concursos-list');
  const ativo = getActive();
  if (cache.concursos.length === 0) {
    list.innerHTML = '<p class="hint">Nenhum concurso cadastrado ainda.</p>';
    return;
  }
  list.innerHTML = cache.concursos.map(c => {
    const dias = daysUntil(c.dataProva);
    const st = c.status || 'publicado';
    return `
    <div class="concurso-card ${ativo && c.id === ativo.id ? 'ativo' : ''}">
      <h3>${esc(c.nome)}${ativo && c.id === ativo.id ? '<span class="badge-ativo">ativo</span>' : ''}
        <span class="status-badge ${st}">${STATUS_CONCURSO[st] || st}</span></h3>
      <div class="concurso-meta">
        ${c.orgao ? `🏛️ ${esc(c.orgao)}<br>` : ''}
        ${c.cargo ? `💼 ${esc(c.cargo)}<br>` : ''}
        ${c.banca ? `📋 Banca: ${esc(c.banca)}<br>` : ''}
        ${c.dataProva ? `📅 Prova: ${fmtDate(c.dataProva)}${dias > 0 ? ` (faltam ${dias} dias)` : ''}<br>` : ''}
        ${c.editalLink ? `🔗 <a href="${esc(c.editalLink)}" target="_blank" rel="noopener">Ver edital</a>` : ''}
      </div>
      <div class="concurso-actions">
        ${!(ativo && c.id === ativo.id) ? `<button class="btn-small" onclick="setActiveConcurso('${c.id}')">Tornar ativo</button>` : ''}
        <button class="btn-small" onclick="openConcursoModal('${c.id}')">✏️ Editar</button>
        <button class="btn-small btn-danger" onclick="delConcurso('${c.id}')">🗑 Excluir</button>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════
   QUIZ — BANCO DE QUESTÕES
══════════════════════════════════ */
let quiz = null; // sessão em andamento (não persiste)

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findOrCreateMateria(nome) {
  const c = getActive();
  let m = c.materias.find(x => x.nome.toLowerCase() === nome.toLowerCase());
  if (!m) {
    m = { id: genId(), nome, topicos: [], aberta: false };
    c.materias.push(m);
    save('concursos');
  }
  return m.id;
}

// Formato: [Matéria] muda a matéria; alternativas "A) ..." a "E) ..."; "GABARITO: X" fecha a questão.
function parseQuestoes(texto, materiaPadraoId) {
  const c = getActive();
  const LETRAS = 'ABCDE';
  const altRe = /^\(?([A-Ea-e])[\)\.\:]\s*(.+)$/;
  const gabRe = /^GABARITO\s*[:\-–]?\s*\(?([A-Ea-e])\)?/i;
  const matRe = /^\[(.+)\]\s*$/;
  const questoes = [];
  let problemas = 0;
  let materiaId = materiaPadraoId;
  let enun = [], alts = [];

  const descarta = () => { if (enun.length || alts.length) problemas++; enun = []; alts = []; };

  for (const raw of texto.split('\n')) {
    const l = raw.trim();
    if (!l) continue;

    const mMat = l.match(matRe);
    if (mMat) {
      descarta();
      materiaId = findOrCreateMateria(mMat[1].trim());
      continue;
    }

    const mGab = l.match(gabRe);
    if (mGab) {
      const idx = LETRAS.indexOf(mGab[1].toUpperCase());
      if (enun.length && alts.length >= 2 && idx > -1 && idx < alts.length) {
        questoes.push({
          id: genId(),
          concursoId: c.id,
          materiaId: materiaId || findOrCreateMateria('Geral'),
          enunciado: enun.join('\n'),
          alts: alts.slice(),
          correta: idx,
          acertos: 0, erros: 0, ultimo: ''
        });
      } else problemas++;
      enun = []; alts = [];
      continue;
    }

    // Só aceita como alternativa se a letra for a próxima esperada (A, B, C...);
    // assim listas "a)" dentro do enunciado não confundem o parser.
    const mAlt = l.match(altRe);
    if (mAlt && mAlt[1].toUpperCase() === LETRAS[alts.length] && enun.length) {
      alts.push(mAlt[2].trim());
      continue;
    }

    if (alts.length > 0) alts[alts.length - 1] += ' ' + l;  // continuação da alternativa
    else enun.push(l);
  }
  descarta();
  return { questoes, problemas };
}

function openImportarModal() {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  const sel = document.getElementById('imp-materia');
  sel.innerHTML = c.materias.length === 0
    ? '<option value="">(nenhuma — será criada pela linha [Matéria])</option>'
    : c.materias.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('');
  document.getElementById('imp-texto').value = '';
  openModal('modal-importar');
}

function importQuestoes(e) {
  e.preventDefault();
  const texto = document.getElementById('imp-texto').value;
  const materiaPadraoId = document.getElementById('imp-materia').value;
  const { questoes, problemas } = parseQuestoes(texto, materiaPadraoId);
  if (questoes.length === 0) {
    alert('Nenhuma questão reconhecida. Confira o formato: enunciado, alternativas A) a E) e a linha GABARITO: X.');
    return;
  }
  cache.questoes.push(...questoes);
  save('questoes');
  closeModal('modal-importar');
  renderAll();
  alert(`✅ ${questoes.length} questão(ões) importada(s)!` + (problemas ? `\n⚠️ ${problemas} bloco(s) não reconhecido(s) — confira o formato.` : ''));
}

function delQuestao(id) {
  if (!confirm('Excluir esta questão?')) return;
  cache.questoes = cache.questoes.filter(q => q.id !== id);
  save('questoes');
  renderQuiz();
}

/* ─── Telas do quiz ─── */
function showQuizScreen(name) {
  ['home', 'session', 'result'].forEach(s => {
    document.getElementById('quiz-' + s).style.display = (s === name) ? 'block' : 'none';
  });
}

function renderQuiz() {
  const c = getActive();
  const qs = c ? cache.questoes.filter(q => q.concursoId === c.id) : [];

  document.getElementById('qz-total').textContent = qs.length;
  const respondidas = qs.filter(q => (q.acertos || 0) + (q.erros || 0) > 0);
  document.getElementById('qz-respondidas').textContent = respondidas.length;
  const tA = qs.reduce((a, q) => a + (q.acertos || 0), 0);
  const tT = qs.reduce((a, q) => a + (q.acertos || 0) + (q.erros || 0), 0);
  document.getElementById('qz-acerto').textContent = tT ? Math.round(tA / tT * 100) + '%' : '—';

  const sel = document.getElementById('qz-livre-materia');
  const keep = sel.value;
  sel.innerHTML = '<option value="todas">Todas as matérias</option>' +
    (c ? c.materias.map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('') : '');
  if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;

  const hist = cache.simulados.filter(s => c && s.concursoId === c.id).slice(-5).reverse();
  document.getElementById('qz-historico').innerHTML = hist.length === 0 ? '' :
    '<div class="hint" style="margin-top:12px;margin-bottom:4px">Últimos simulados:</div>' +
    hist.map(s => `<div class="sessao-row">
      <div class="sessao-info"><div class="sessao-meta">${fmtDate(s.data)} · ${s.total} questões</div></div>
      <span class="sessao-tempo">${s.acertos}/${s.total} (${Math.round(s.acertos / s.total * 100)}%)</span>
    </div>`).join('');

  const banco = document.getElementById('qz-banco');
  if (!c) { banco.innerHTML = '<p class="hint">Cadastre um concurso primeiro.</p>'; return; }
  if (qs.length === 0) {
    banco.innerHTML = '<p class="hint">Nenhuma questão ainda. Importe questões de provas antigas — peça ao Claude para converter o PDF de uma prova para o formato de importação!</p>';
    return;
  }
  const grupos = c.materias.map(m => ({ m, qs: qs.filter(q => q.materiaId === m.id) })).filter(g => g.qs.length);
  const orfas = qs.filter(q => !c.materias.some(m => m.id === q.materiaId));
  banco.innerHTML = grupos.map(g => `
    <details class="qz-banco-mat">
      <summary>${esc(g.m.nome)} — ${g.qs.length} questão(ões)</summary>
      ${g.qs.map(q => `<div class="qz-banco-item">
        <span>${esc(q.enunciado.slice(0, 90))}${q.enunciado.length > 90 ? '…' : ''}</span>
        <button class="btn-small btn-danger" onclick="delQuestao('${q.id}')">🗑</button>
      </div>`).join('')}
    </details>`).join('') +
    (orfas.length ? `<details class="qz-banco-mat"><summary>Sem matéria — ${orfas.length}</summary>
      ${orfas.map(q => `<div class="qz-banco-item"><span>${esc(q.enunciado.slice(0, 90))}</span>
      <button class="btn-small btn-danger" onclick="delQuestao('${q.id}')">🗑</button></div>`).join('')}</details>` : '');
}

/* ─── Estudo livre ─── */
function startLivre(idsOverride) {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  let pool = cache.questoes.filter(q => q.concursoId === c.id);
  if (idsOverride) {
    pool = pool.filter(q => idsOverride.includes(q.id));
  } else {
    const mat = document.getElementById('qz-livre-materia').value;
    if (mat !== 'todas') pool = pool.filter(q => q.materiaId === mat);
    const filtro = document.getElementById('qz-livre-filtro').value;
    if (filtro === 'novas')   pool = pool.filter(q => !((q.acertos || 0) + (q.erros || 0)));
    if (filtro === 'erradas') pool = pool.filter(q => q.ultimo === 'errado');
  }
  if (pool.length === 0) { alert('Nenhuma questão encontrada com esses filtros.'); return; }
  quiz = { modo: 'livre', pool: shuffle(pool.slice()), idx: 0, respostas: {}, respondida: false, acertos: 0, interval: null };
  document.getElementById('qz-timer').style.display = 'none';
  showQuizScreen('session');
  renderQuizQuestion();
}

function answerLivre(i) {
  if (quiz.respondida) return;
  const q = quiz.pool[quiz.idx];
  quiz.respostas[q.id] = i;
  quiz.respondida = true;
  const ok = i === q.correta;
  if (ok) quiz.acertos++;
  q.acertos = (q.acertos || 0) + (ok ? 1 : 0);
  q.erros   = (q.erros   || 0) + (ok ? 0 : 1);
  q.ultimo  = ok ? 'certo' : 'errado';
  save('questoes');
  renderQuizQuestion();
}

function nextLivre() {
  quiz.idx++;
  quiz.respondida = false;
  renderQuizQuestion();
}

function finishLivre() {
  const erradas = quiz.pool
    .filter(q => quiz.respostas[q.id] !== q.correta)
    .map(q => ({ q, r: quiz.respostas[q.id] }));
  showResult(quiz.acertos, quiz.pool.length, erradas);
}

/* ─── Simulado ─── */
function startSimulado() {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  const todas = cache.questoes.filter(q => q.concursoId === c.id);
  if (todas.length === 0) { alert('Importe questões primeiro.'); return; }
  const qtd = Math.min(parseInt(document.getElementById('qz-sim-qtd').value, 10) || 10, todas.length);
  const minutos = parseInt(document.getElementById('qz-sim-min').value, 10) || 0;
  quiz = {
    modo: 'simulado',
    pool: shuffle(todas.slice()).slice(0, qtd),
    idx: 0, respostas: {}, interval: null,
    tempo: minutos * 60
  };
  const timerEl = document.getElementById('qz-timer');
  if (minutos > 0) {
    timerEl.style.display = 'inline';
    timerEl.classList.remove('acabando');
    updateQuizTimer();
    quiz.interval = setInterval(() => {
      quiz.tempo--;
      updateQuizTimer();
      if (quiz.tempo <= 0) {
        clearInterval(quiz.interval);
        alert('⏰ Tempo esgotado!');
        finishSimulado(true);
      }
    }, 1000);
  } else {
    timerEl.style.display = 'none';
  }
  showQuizScreen('session');
  renderQuizQuestion();
}

function updateQuizTimer() {
  const el = document.getElementById('qz-timer');
  const m = Math.floor(quiz.tempo / 60), s = quiz.tempo % 60;
  el.textContent = `⏳ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (quiz.tempo <= 60) el.classList.add('acabando');
}

function answerSimulado(i) {
  const q = quiz.pool[quiz.idx];
  quiz.respostas[q.id] = (quiz.respostas[q.id] === i) ? undefined : i;
  renderQuizQuestion();
}

function navSim(d) {
  quiz.idx += d;
  renderQuizQuestion();
}

function finishSimulado(force) {
  const emBranco = quiz.pool.filter(q => quiz.respostas[q.id] === undefined).length;
  if (!force && emBranco > 0 && !confirm(`${emBranco} questão(ões) em branco. Finalizar mesmo assim?`)) return;
  if (quiz.interval) clearInterval(quiz.interval);
  let acertos = 0;
  const erradas = [];
  quiz.pool.forEach(q => {
    const r = quiz.respostas[q.id];
    if (r === undefined) { erradas.push({ q, r: null }); return; }
    const ok = r === q.correta;
    if (ok) acertos++; else erradas.push({ q, r });
    q.acertos = (q.acertos || 0) + (ok ? 1 : 0);
    q.erros   = (q.erros   || 0) + (ok ? 0 : 1);
    q.ultimo  = ok ? 'certo' : 'errado';
  });
  save('questoes');
  cache.simulados.push({ id: genId(), concursoId: getActive().id, data: todayISO(), total: quiz.pool.length, acertos });
  save('simulados');
  showResult(acertos, quiz.pool.length, erradas);
}

/* ─── Questão na tela + resultado ─── */
function renderQuizQuestion() {
  const q = quiz.pool[quiz.idx];
  const c = getActive();
  const mat = c.materias.find(m => m.id === q.materiaId);
  const LETRAS = 'ABCDE';
  document.getElementById('qz-progress').textContent = `Questão ${quiz.idx + 1} de ${quiz.pool.length}`;
  document.getElementById('qz-q-materia').textContent = mat ? mat.nome : '';
  document.getElementById('qz-q-enunciado').textContent = q.enunciado;

  const resp = quiz.respostas[q.id];
  document.getElementById('qz-q-alts').innerHTML = q.alts.map((a, i) => {
    let cls = 'quiz-alt';
    if (quiz.modo === 'livre' && quiz.respondida) {
      if (i === q.correta) cls += ' certa';
      else if (i === resp) cls += ' errada';
    } else if (quiz.modo === 'simulado' && i === resp) {
      cls += ' selecionada';
    }
    const dis = (quiz.modo === 'livre' && quiz.respondida) ? 'disabled' : '';
    const fn = quiz.modo === 'livre' ? `answerLivre(${i})` : `answerSimulado(${i})`;
    return `<button class="${cls}" ${dis} onclick="${fn}"><b>${LETRAS[i]})</b> ${esc(a)}</button>`;
  }).join('');

  let nav = '';
  if (quiz.modo === 'livre') {
    if (quiz.respondida) {
      nav = quiz.idx < quiz.pool.length - 1
        ? '<button class="btn-primary" onclick="nextLivre()">Próxima →</button>'
        : '<button class="btn-primary" onclick="finishLivre()">Ver resultado 🏁</button>';
    }
  } else {
    nav = (quiz.idx > 0 ? '<button class="btn-small" onclick="navSim(-1)">← Anterior</button>' : '') +
          (quiz.idx < quiz.pool.length - 1 ? '<button class="btn-small" onclick="navSim(1)">Próxima →</button>' : '') +
          '<button class="btn-primary" onclick="finishSimulado()">Finalizar 🏁</button>';
  }
  document.getElementById('qz-nav').innerHTML = nav;
}

function showResult(acertos, total, erradas) {
  quiz.wrongIds = erradas.map(e => e.q.id);
  const pct = Math.round(acertos / total * 100);
  document.getElementById('qz-res-score').textContent = `${acertos}/${total}`;
  const msg = pct >= 80 ? 'Excelente! 🌟' : pct >= 60 ? 'Bom ritmo, continue! 💪' : 'Revise os erros e tente de novo! 📖';
  document.getElementById('qz-res-sub').textContent = `${pct}% de acerto — ${msg}`;
  document.getElementById('qz-res-refazer').style.display = erradas.length ? 'inline-block' : 'none';

  const c = getActive();
  const LETRAS = 'ABCDE';
  document.getElementById('qz-res-erradas').innerHTML = erradas.length === 0 ? '' :
    '<div class="section-header"><h2>Para revisar</h2></div>' +
    erradas.map(e => {
      const mat = c.materias.find(m => m.id === e.q.materiaId);
      return `<div class="qz-errada-card">
        <div class="quiz-materia">${esc(mat ? mat.nome : '')}</div>
        <div class="quiz-enunciado">${esc(e.q.enunciado)}</div>
        <div class="qz-errada-resp">✗ Sua resposta: ${e.r === null ? 'em branco' : LETRAS[e.r] + ') ' + esc(e.q.alts[e.r])}</div>
        <div class="qz-errada-certa">✓ Correta: ${LETRAS[e.q.correta]}) ${esc(e.q.alts[e.q.correta])}</div>
      </div>`;
    }).join('');
  showQuizScreen('result');
  renderQuiz();
}

function refazerErradas() {
  startLivre(quiz.wrongIds);
}

function backToQuizHome() {
  if (quiz && quiz.interval) clearInterval(quiz.interval);
  quiz = null;
  showQuizScreen('home');
  renderQuiz();
}

function quitQuiz() {
  if (!confirm('Sair do quiz? O progresso desta rodada será perdido.')) return;
  backToQuizHome();
}

/* ══════════════════════════════════
   RADAR DE CONCURSOS (FONTES)
══════════════════════════════════ */
const STATUS_CONCURSO = {
  previsto:  '🔭 Previsto',
  publicado: '📢 Edital publicado',
  andamento: '🏃 Em andamento',
  encerrado: '🏁 Encerrado'
};

function diasDesde(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const ref = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now - ref) / 86400000);
}

function openFonteModal(id) {
  const f = cache.fontes.find(x => x.id === id);
  document.getElementById('modal-fonte-title').textContent = f ? 'Editar lugar' : 'Novo lugar';
  document.getElementById('f-id').value   = f ? f.id : '';
  document.getElementById('f-nome').value = f ? f.nome : '';
  document.getElementById('f-link').value = f ? (f.link || '') : '';
  document.getElementById('f-obs').value  = f ? (f.obs || '') : '';
  openModal('modal-fonte');
}

function saveFonte(e) {
  e.preventDefault();
  const id = document.getElementById('f-id').value;
  const dados = {
    nome: document.getElementById('f-nome').value.trim(),
    link: document.getElementById('f-link').value.trim(),
    obs:  document.getElementById('f-obs').value.trim()
  };
  if (id) {
    Object.assign(cache.fontes.find(x => x.id === id), dados);
  } else {
    cache.fontes.push({ id: genId(), ultimaVisita: '', ...dados });
  }
  save('fontes');
  closeModal('modal-fonte');
  renderFontes();
}

function delFonte(id) {
  const f = cache.fontes.find(x => x.id === id);
  if (!confirm(`Excluir "${f.nome}" do radar?`)) return;
  cache.fontes = cache.fontes.filter(x => x.id !== id);
  save('fontes');
  renderFontes();
}

function marcarVisita(id) {
  cache.fontes.find(x => x.id === id).ultimaVisita = todayISO();
  save('fontes');
  renderFontes();
}

function renderFontes() {
  const list = document.getElementById('fontes-list');
  if (cache.fontes.length === 0) {
    list.innerHTML = '<p class="hint">Nenhum lugar anotado ainda. Adicione sites de notícias de concursos, órgãos que você acompanha, bancas...</p>';
    return;
  }
  // Mais tempo sem visita primeiro (nunca visitados no topo)
  const ordenadas = cache.fontes.slice().sort((a, b) => (a.ultimaVisita || '').localeCompare(b.ultimaVisita || ''));
  list.innerHTML = ordenadas.map(f => {
    const dias = diasDesde(f.ultimaVisita);
    let visita, alerta = false;
    if (dias === null) { visita = 'nunca visitado'; alerta = true; }
    else if (dias === 0) visita = 'visitado hoje ✅';
    else if (dias === 1) visita = 'visitado ontem';
    else { visita = `há ${dias} dias sem visitar`; alerta = dias >= 7; }
    return `
    <div class="concurso-card ${alerta ? 'fonte-alerta' : ''}">
      <h3>${esc(f.nome)}</h3>
      <div class="concurso-meta">
        ${f.obs ? `📝 ${esc(f.obs)}<br>` : ''}
        ${f.link ? `🔗 <a href="${esc(f.link)}" target="_blank" rel="noopener">Abrir site</a><br>` : ''}
        <span class="${alerta ? 'fonte-visita-alerta' : ''}">👁️ ${visita}</span>
      </div>
      <div class="concurso-actions">
        <button class="btn-small" onclick="marcarVisita('${f.id}')">✔ Visitei hoje</button>
        <button class="btn-small" onclick="openFonteModal('${f.id}')">✏️ Editar</button>
        <button class="btn-small btn-danger" onclick="delFonte('${f.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════
   BOOT
══════════════════════════════════ */
// Fecha modais clicando fora
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

initApp();
