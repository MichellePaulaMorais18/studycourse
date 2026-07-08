/* ══════════════════════════════════
   FIREBASE — INIT + AUTH + DATA
══════════════════════════════════ */
// ⚠️ COLE AQUI a configuração do seu projeto Firebase "studycourse":
// Console Firebase → Adicionar app → Web (</>) → copiar firebaseConfig
const FIREBASE_CONFIG = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI.firebaseapp.com",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI.firebasestorage.app",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

const configOk = !FIREBASE_CONFIG.apiKey.includes("COLE_AQUI");
let auth = null, db = null;
if (configOk) {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db   = firebase.firestore();
}

// Cache em memória — Firestore é a fonte de verdade
let cache = {
  concursos: [],   // [{id, nome, orgao, cargo, banca, dataProva, editalLink, etapas:[], materias:[]}]
  sessoes:   [],   // [{id, concursoId, materiaId, data, minutos, obs}]
  settings:  { activeId: null, dark: false }
};
let currentUid = null;

function userRef() { return db.collection('users').doc(currentUid).collection('app'); }

async function loadFromFirestore() {
  try {
    const snap = await userRef().get();
    snap.forEach(doc => {
      if (cache[doc.id] !== undefined) cache[doc.id] = doc.data().value;
    });
  } catch (e) { console.warn('Firestore load error', e); }
}

function save(key) {
  if (!currentUid) return;
  userRef().doc(key).set({ value: cache[key] }).catch(e => console.warn('Save error', e));
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
      await loadFromFirestore();
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
const VIEWS = ['dashboard', 'etapas', 'materias', 'estudos', 'concursos'];

function setView(v) {
  VIEWS.forEach(x => {
    const sec = document.getElementById('view-' + x);
    if (sec) sec.style.display = (x === v) ? 'block' : 'none';
    const tab = document.getElementById('tab-' + x);
    if (tab) tab.classList.toggle('active', x === v);
  });
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
  cache.sessoes = cache.sessoes.filter(s => s.concursoId !== id);
  if (cache.settings.activeId === id) {
    cache.settings.activeId = cache.concursos[0] ? cache.concursos[0].id : null;
    save('settings');
  }
  save('concursos'); save('sessoes');
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
  renderConcursos();
}

function renderConcursoSelect() {
  const bar = document.getElementById('concurso-bar');
  const sel = document.getElementById('concurso-select');
  if (cache.concursos.length === 0) { bar.style.display = 'none'; return; }
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
  if (dias === null) {
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
    return `
    <div class="concurso-card ${ativo && c.id === ativo.id ? 'ativo' : ''}">
      <h3>${esc(c.nome)}${ativo && c.id === ativo.id ? '<span class="badge-ativo">ativo</span>' : ''}</h3>
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
   BOOT
══════════════════════════════════ */
// Fecha modais clicando fora
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
});

initApp();
