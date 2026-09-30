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
  questoes:  [],   // banco PESSOAL (concurso sem bancoId): [{id, concursoId, materia, enunciado, alts:[], correta, autor}]
  qstats:    {},   // desempenho individual por questão: { [questaoId]: {acertos, erros, ultimo} }
  simulados: [],   // [{id, concursoId, data, total, acertos}]
  fontes:    [],   // [{id, nome, link, obs, ultimaVisita}] — radar de concursos
  processos: [],   // [{id, empresa, vaga, link, status, prazo, obs, etapas:[{id, nome, data, status, obs}]}] — trainee
  trilhas:   [],   // [{id, concursoId, nome, pausada, aberta, itens:[{id, titulo, nota, feito, feitoEm, vinculos:[topicoId]}]}]
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
  cache.processos = toArr(cache.processos);
  cache.processos.forEach(p => { p.etapas = toArr(p.etapas); });
  cache.trilhas   = toArr(cache.trilhas);
  cache.trilhas.forEach(t => {
    t.itens = toArr(t.itens);
    t.itens.forEach(i => { i.vinculos = toArr(i.vinculos); });
  });
  cache.settings  = cache.settings || { activeId: null, dark: false };
  cache.concursos.forEach(c => {
    c.etapas   = toArr(c.etapas);
    c.materias = toArr(c.materias);
    c.materias.forEach(m => { m.topicos = toArr(m.topicos); });
  });
  cache.questoes.forEach(q => { q.alts = toArr(q.alts); });
  if (!cache.qstats || typeof cache.qstats !== 'object') cache.qstats = {};
  return migrarQuestoesLegadas();
}

// Formato antigo: questão ligada à matéria por id e com acertos/erros dentro dela.
// Novo formato: matéria por nome (comparável entre contas) e desempenho em qstats.
function migrarQuestoesLegadas() {
  let mudou = false;
  cache.questoes.forEach(q => {
    if (q.materia !== undefined && q.materiaId === undefined) return;
    const c = cache.concursos.find(x => x.id === q.concursoId);
    const m = c && c.materias.find(x => x.id === q.materiaId);
    q.materia = q.materia || (m ? m.nome : 'Geral');
    if (q.acertos || q.erros || q.ultimo) {
      cache.qstats[q.id] = { acertos: q.acertos || 0, erros: q.erros || 0, ultimo: q.ultimo || '' };
    }
    delete q.materiaId; delete q.acertos; delete q.erros; delete q.ultimo;
    if (q.autor === undefined) q.autor = '';
    mudou = true;
  });
  return mudou;
}

async function loadFromDatabase() {
  try {
    const snap = await userRef().once('value');
    const data = snap.val() || {};
    Object.keys(cache).forEach(k => {
      if (data[k] !== undefined) cache[k] = data[k];
    });
    if (normalizeCache()) { save('questoes'); save('qstats'); }
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
const VIEWS = ['dashboard', 'etapas', 'materias', 'trilhas', 'estudos', 'quiz', 'fontes', 'processos', 'concursos'];
const VIEWS_GLOBAIS = ['fontes', 'processos']; // não dependem do concurso ativo
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
  cache.trilhas   = cache.trilhas.filter(t => t.concursoId !== id);
  if (cache.settings.activeId === id) {
    cache.settings.activeId = cache.concursos[0] ? cache.concursos[0].id : null;
    save('settings');
  }
  save('concursos'); save('sessoes'); save('questoes'); save('simulados'); save('trilhas');
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

// Tópicos creditados como estudados por itens de trilha já concluídos. É calculado na hora
// (não gravado no tópico), então desmarcar o item da trilha desfaz só o crédito automático
// e nunca apaga o que foi marcado à mão.
let credCache = null;
function trilhasDoConcurso(c) { return c ? cache.trilhas.filter(t => t.concursoId === c.id) : []; }
function creditados() {
  if (credCache) return credCache;
  const s = new Set();
  trilhasDoConcurso(getActive()).forEach(t => t.itens.forEach(i => { if (i.feito) i.vinculos.forEach(id => s.add(id)); }));
  return (credCache = s);
}
function statusEfetivo(t) { return Math.max(t.status, creditados().has(t.id) ? 1 : 0); }

// 0 = não estudado → 1 = estudado → 2 = revisado → (volta) — parte sempre do que aparece na tela.
// Com crédito de trilha, o tópico nunca volta abaixo de "estudado" enquanto o item estiver concluído.
function cycleTopico(mid, tid) {
  const c = getActive();
  const t = c.materias.find(x => x.id === mid).topicos.find(x => x.id === tid);
  t.status = (statusEfetivo(t) + 1) % 3;
  save('concursos');
  renderAll();
}

function toggleMateria(id) {
  const c = getActive();
  const m = c.materias.find(x => x.id === id);
  m.aberta = !m.aberta;
  renderMaterias();
}

/* ─── Exportar / importar a estrutura de matérias e tópicos ─── */
function exportarMateriasJSON(c) {
  return JSON.stringify({
    studycourse: 'materias',
    versao: 1,
    concurso: c.nome,
    materias: c.materias.map(m => ({ nome: m.nome, topicos: m.topicos.map(t => t.nome) }))
  }, null, 2);
}

function openExportarMaterias() {
  const c = getActive();
  if (!c || c.materias.length === 0) { alert('Não há matérias para exportar neste concurso.'); return; }
  document.getElementById('exp-materias-texto').value = exportarMateriasJSON(c);
  openModal('modal-exp-materias');
}

function copiarExportMaterias() {
  const ta = document.getElementById('exp-materias-texto');
  const ok = () => alert('Texto copiado! É só colar em "Importar" no app de quem vai receber.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(ok, () => { ta.select(); document.execCommand('copy'); ok(); });
  } else { ta.select(); document.execCommand('copy'); ok(); }
}

function baixarExportMaterias() {
  const c = getActive();
  const slug = c.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'concurso';
  const blob = new Blob([document.getElementById('exp-materias-texto').value], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `materias-${slug}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function openImportarMaterias() {
  if (!getActive()) { alert('Cadastre um concurso primeiro.'); return; }
  document.getElementById('imp-materias-texto').value = '';
  document.getElementById('imp-materias-arquivo').value = '';
  openModal('modal-imp-materias');
}

function lerArquivoMaterias(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('imp-materias-texto').value = reader.result; };
  reader.readAsText(f);
}

// Mescla por nome (sem diferenciar caixa): cria matérias novas e só acrescenta tópicos que faltam.
function importarMaterias(e) {
  e.preventDefault();
  const c = getActive();
  let dados;
  try { dados = JSON.parse(document.getElementById('imp-materias-texto').value); }
  catch (_) { alert('Não consegui ler esse texto. Cole exatamente o que foi exportado pelo app.'); return; }
  if (!dados || dados.studycourse !== 'materias' || !Array.isArray(dados.materias)) {
    alert('Esse texto não parece uma exportação de matérias do StudyCourse.');
    return;
  }

  let novasMaterias = 0, novosTopicos = 0;
  dados.materias.forEach(item => {
    const nome = typeof item.nome === 'string' ? item.nome.trim() : '';
    if (!nome) return;
    let m = c.materias.find(x => x.nome.trim().toLowerCase() === nome.toLowerCase());
    if (!m) {
      m = { id: genId(), nome, topicos: [], aberta: false };
      c.materias.push(m);
      novasMaterias++;
    }
    const tem = new Set(m.topicos.map(t => t.nome.trim().toLowerCase()));
    (Array.isArray(item.topicos) ? item.topicos : []).forEach(t => {
      const tn = typeof t === 'string' ? t.trim() : '';
      if (!tn || tem.has(tn.toLowerCase())) return;
      tem.add(tn.toLowerCase());
      m.topicos.push({ id: genId(), nome: tn, status: 0 });
      novosTopicos++;
    });
  });

  save('concursos');
  closeModal('modal-imp-materias');
  renderAll();
  alert(novasMaterias + novosTopicos === 0
    ? 'Nada novo: você já tinha todas essas matérias e tópicos.'
    : `✅ Importado: ${novasMaterias} matéria(s) nova(s) e ${novosTopicos} tópico(s) adicionado(s).`);
}

function materiaProgresso(m) {
  const total = m.topicos.length;
  if (total === 0) return { estudado: 0, revisado: 0, total: 0 };
  const estudado = m.topicos.filter(t => statusEfetivo(t) >= 1).length;
  const revisado = m.topicos.filter(t => statusEfetivo(t) === 2).length;
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
  credCache = null;
  renderConcursoSelect();
  renderDashboard();
  renderEtapas();
  renderMaterias();
  renderTrilhas();
  renderEstudos();
  renderQuiz();
  renderFontes();
  renderProcessos();
  renderConcursos();
}

function renderConcursoSelect() {
  const bar = document.getElementById('concurso-bar');
  const sel = document.getElementById('concurso-select');
  if (cache.concursos.length === 0 || VIEWS_GLOBAIS.includes(currentView)) { bar.style.display = 'none'; return; }
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
  const pct = todosTopicos.length ? Math.round(todosTopicos.filter(t => statusEfetivo(t) >= 1).length / todosTopicos.length * 100) : 0;
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
        ${m.topicos.map(t => {
          const st = statusEfetivo(t);
          const viaTrilha = t.status < 1 && creditados().has(t.id);
          return `
          <div class="topico-item st-${st}" onclick="cycleTopico('${m.id}','${t.id}')">
            <span>${ICONS[st]}</span><span class="topico-nome">${esc(t.nome)}</span>
            ${viaTrilha ? '<span class="via-trilha" title="Contado porque um item de trilha ligado a este tópico foi concluído">🧭 via trilha</span>' : ''}
          </div>`;
        }).join('')}
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

/* ─── Origem das questões: banco pessoal ou banco compartilhado do concurso ─── */
const bancoCache = {};                        // bancoId -> [questões] (espelho em tempo real)
let bancoWatch = { id: null, ref: null };
let bancoErro = '';

function msgErroBanco(e) {
  return e && e.code === 'PERMISSION_DENIED'
    ? 'Sem permissão no Firebase. Publique as regras novas do Realtime Database (README, seção "Banco compartilhado").'
    : (e && e.message) || String(e);
}

// Liga/desliga a escuta do banco conforme o concurso ativo.
function syncBanco() {
  if (!db || !currentUid) return;
  const c = getActive();
  const id = c && c.bancoId ? c.bancoId : null;
  if (bancoWatch.id === id) return;
  if (bancoWatch.ref) bancoWatch.ref.off();
  bancoWatch = { id, ref: null };
  bancoErro = '';
  if (!id) return;
  const ref = db.ref('bancos/' + id + '/questoes');
  bancoWatch.ref = ref;
  ref.on('value', snap => {
    bancoErro = '';
    // No banco o id da questão é a chave do nó, não um campo — devolve para dentro do objeto.
    bancoCache[id] = Object.entries(snap.val() || {}).map(([qid, q]) => ({ ...q, id: qid, alts: toArr(q.alts) }));
    renderQuiz();
  }, err => {
    bancoErro = msgErroBanco(err);
    renderQuiz();
  });
}

function questoesDoConcurso(c) {
  if (!c) return [];
  if (c.bancoId) return bancoCache[c.bancoId] || [];
  return cache.questoes.filter(q => q.concursoId === c.id);
}

function statOf(q) { return cache.qstats[q.id] || { acertos: 0, erros: 0, ultimo: '' }; }

function registrarResposta(q, ok) {
  const s = statOf(q);
  cache.qstats[q.id] = { acertos: s.acertos + (ok ? 1 : 0), erros: s.erros + (ok ? 0 : 1), ultimo: ok ? 'certo' : 'errado' };
}

// Mesma questão importada por pessoas diferentes não deve duplicar no banco.
function chaveQuestao(q) {
  return (q.enunciado + '|' + q.alts.join('|')).toLowerCase().replace(/[^a-z0-9à-ú]/g, '');
}

function podeExcluir(c, q) { return !c.bancoId || q.autor === currentUid; }

// Reaproveita a grafia já existente (matérias do concurso, do banco ou desta importação),
// ignorando maiúsculas/minúsculas e espaços, para não criar "Direito" e "direito" separados.
function nomeMateriaCanonico(c, nome, vistas) {
  const k = nome.trim().toLowerCase();
  if (vistas[k]) return vistas[k];
  const existente = c.materias.map(m => m.nome).concat(questoesDoConcurso(c).map(q => q.materia))
    .find(n => n.trim().toLowerCase() === k);
  return (vistas[k] = existente || nome.trim());
}

// Formato: [Matéria] muda a matéria; alternativas "A) ..." a "E) ..."; "GABARITO: X" fecha a questão.
function parseQuestoes(texto, materiaPadrao) {
  const c = getActive();
  const LETRAS = 'ABCDE';
  const altRe = /^\(?([A-Ea-e])[\)\.\:]\s*(.+)$/;
  const gabRe = /^GABARITO\s*[:\-–]?\s*\(?([A-Ea-e])\)?/i;
  const matRe = /^\[(.+)\]\s*$/;
  const questoes = [];
  let problemas = 0;
  const vistas = {};
  let materia = materiaPadrao || 'Geral';
  let enun = [], alts = [];

  const descarta = () => { if (enun.length || alts.length) problemas++; enun = []; alts = []; };

  for (const raw of texto.split('\n')) {
    const l = raw.trim();
    if (!l) continue;

    const mMat = l.match(matRe);
    if (mMat) {
      descarta();
      materia = nomeMateriaCanonico(c, mMat[1], vistas);
      continue;
    }

    const mGab = l.match(gabRe);
    if (mGab) {
      const idx = LETRAS.indexOf(mGab[1].toUpperCase());
      if (enun.length && alts.length >= 2 && idx > -1 && idx < alts.length) {
        questoes.push({
          id: genId(),
          materia,
          enunciado: enun.join('\n'),
          alts: alts.slice(),
          correta: idx
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
    ? '<option value="Geral">Geral</option>'
    : c.materias.map(m => `<option value="${esc(m.nome)}">${esc(m.nome)}</option>`).join('');
  document.getElementById('imp-texto').value = '';
  openModal('modal-importar');
}

async function importQuestoes(e) {
  e.preventDefault();
  const c = getActive();
  const texto = document.getElementById('imp-texto').value;
  const materiaPadrao = document.getElementById('imp-materia').value;
  const { questoes, problemas } = parseQuestoes(texto, materiaPadrao);
  if (questoes.length === 0) {
    alert('Nenhuma questão reconhecida. Confira o formato: enunciado, alternativas A) a E) e a linha GABARITO: X.');
    return;
  }

  const existentes = new Set(questoesDoConcurso(c).map(chaveQuestao));
  const novas = [];
  let duplicadas = 0;
  questoes.forEach(q => {
    const k = chaveQuestao(q);
    if (existentes.has(k)) { duplicadas++; return; }
    existentes.add(k);
    novas.push(q);
  });
  if (novas.length === 0) {
    alert(`Essas ${duplicadas} questão(ões) já estão no banco — nada foi importado.`);
    return;
  }

  if (c.bancoId) {
    const payload = {};
    novas.forEach(q => {
      payload[q.id] = { materia: q.materia, enunciado: q.enunciado, alts: q.alts, correta: q.correta, autor: currentUid, criadoEm: Date.now() };
    });
    try {
      await db.ref('bancos/' + c.bancoId + '/questoes').update(payload);
    } catch (err) {
      alert('Não foi possível salvar no banco compartilhado:\n' + msgErroBanco(err));
      return;
    }
  } else {
    cache.questoes.push(...novas.map(q => ({ ...q, concursoId: c.id, autor: currentUid || '' })));
    save('questoes');
  }
  closeModal('modal-importar');
  renderAll();
  alert(`✅ ${novas.length} questão(ões) importada(s)!` +
    (duplicadas ? `\n♻️ ${duplicadas} já existia(m) no banco e foi(ram) ignorada(s).` : '') +
    (problemas ? `\n⚠️ ${problemas} bloco(s) não reconhecido(s) — confira o formato.` : ''));
}

async function delQuestao(id) {
  const c = getActive();
  if (!confirm('Excluir esta questão?' + (c.bancoId ? '\n\nEla sairá do banco de todos que o usam.' : ''))) return;
  if (c.bancoId) {
    try { await db.ref('bancos/' + c.bancoId + '/questoes/' + id).remove(); }
    catch (err) { alert('Não foi possível excluir:\n' + msgErroBanco(err)); }
    return;
  }
  cache.questoes = cache.questoes.filter(q => q.id !== id);
  save('questoes');
  renderQuiz();
}

/* ─── Banco compartilhado: criar, entrar, copiar código, sair ─── */
function novoCodigoBanco() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

// Ao ligar o concurso a um banco, oferece levar junto as questões pessoais que já existiam.
async function moverPessoaisParaBanco(c, bancoId) {
  const pessoais = cache.questoes.filter(q => q.concursoId === c.id);
  if (pessoais.length === 0) return;
  if (!confirm(`Você já tem ${pessoais.length} questão(ões) pessoais neste concurso.\n\nEnviá-las para o banco compartilhado?\n(Se cancelar, elas ficam guardadas só para você e voltam a aparecer se você sair do banco.)`)) return;

  const snap = await db.ref('bancos/' + bancoId + '/questoes').once('value');
  const jaNoBanco = new Set(Object.values(snap.val() || {}).map(q => chaveQuestao({ ...q, alts: toArr(q.alts) })));
  const payload = {};
  pessoais.forEach(q => {
    if (jaNoBanco.has(chaveQuestao(q))) return;
    payload[q.id] = { materia: q.materia, enunciado: q.enunciado, alts: q.alts, correta: q.correta, autor: currentUid, criadoEm: Date.now() };
  });
  if (Object.keys(payload).length) await db.ref('bancos/' + bancoId + '/questoes').update(payload);
  cache.questoes = cache.questoes.filter(q => q.concursoId !== c.id);
  save('questoes');
}

function ligarAoBanco(c, bancoId) {
  c.bancoId = bancoId;
  save('concursos');
  renderAll();
}

async function criarBanco() {
  const c = getActive();
  if (!c) return;
  if (!currentUid) { alert('Entre na sua conta primeiro.'); return; }
  if (!confirm(`Criar um banco de questões compartilhado para "${c.nome}"?\n\nVocê receberá um código para passar a quem estuda o mesmo concurso.`)) return;
  const codigo = novoCodigoBanco();
  try {
    await db.ref('bancos/' + codigo + '/meta').set({ criadoPor: currentUid, criadoEm: Date.now(), concurso: c.nome });
    await moverPessoaisParaBanco(c, codigo);
  } catch (err) { alert('Não foi possível criar o banco:\n' + msgErroBanco(err)); return; }
  ligarAoBanco(c, codigo);
}

async function entrarBanco() {
  const c = getActive();
  if (!c) return;
  if (!currentUid) { alert('Entre na sua conta primeiro.'); return; }
  const codigo = (prompt('Cole o código do banco compartilhado:') || '').trim().toLowerCase();
  if (!codigo) return;
  if (!/^[a-z0-9]{6,32}$/.test(codigo)) { alert('Código inválido — ele tem só letras minúsculas e números.'); return; }
  try {
    const meta = await db.ref('bancos/' + codigo + '/meta').once('value');
    if (!meta.exists()) { alert('Código não encontrado. Confira com quem criou o banco.'); return; }
    await moverPessoaisParaBanco(c, codigo);
  } catch (err) { alert('Não foi possível entrar no banco:\n' + msgErroBanco(err)); return; }
  ligarAoBanco(c, codigo);
}

function copiarCodigoBanco() {
  const c = getActive();
  if (!c || !c.bancoId) return;
  const fallback = () => prompt('Copie o código:', c.bancoId);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(c.bancoId).then(() => alert('Código copiado! Envie para quem estuda com você.'), fallback);
  } else fallback();
}

function sairBanco() {
  const c = getActive();
  if (!c || !c.bancoId) return;
  if (!confirm('Sair do banco compartilhado?\n\nAs questões continuam no banco para os outros. Você poderá voltar com o código.')) return;
  delete c.bancoId;
  save('concursos');
  renderAll();
}

function renderBancoCard(c) {
  const el = document.getElementById('qz-banco-card');
  if (!c) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = c.bancoId
    ? `<h2>👥 Banco compartilhado</h2>
       <p class="hint">Este concurso usa um banco de questões em comum. Passe o código para quem estuda com você:</p>
       <div class="banco-codigo"><code>${esc(c.bancoId)}</code>
         <button class="btn-small" onclick="copiarCodigoBanco()">📋 Copiar</button>
         <button class="btn-small btn-danger" onclick="sairBanco()">Sair do banco</button></div>
       ${bancoErro ? `<p class="fonte-visita-alerta" style="margin-top:8px">⚠️ ${esc(bancoErro)}</p>` : ''}`
    : `<h2>👥 Banco compartilhado</h2>
       <p class="hint">Estuda o mesmo concurso com mais gente? Criem um banco em comum: todos importam e todos treinam com as mesmas questões. Seu desempenho (acertos e erros) continua só seu.</p>
       <div class="quiz-config">
         <button class="btn-primary" onclick="criarBanco()">+ Criar banco</button>
         <button class="btn-small" onclick="entrarBanco()">Entrar com código</button>
       </div>`;
}

/* ─── Telas do quiz ─── */
function showQuizScreen(name) {
  ['home', 'session', 'result'].forEach(s => {
    document.getElementById('quiz-' + s).style.display = (s === name) ? 'block' : 'none';
  });
}

function renderQuiz() {
  syncBanco();
  const c = getActive();
  const qs = questoesDoConcurso(c);
  renderBancoCard(c);

  document.getElementById('qz-total').textContent = qs.length;
  const respondidas = qs.filter(q => statOf(q).acertos + statOf(q).erros > 0);
  document.getElementById('qz-respondidas').textContent = respondidas.length;
  const tA = qs.reduce((a, q) => a + statOf(q).acertos, 0);
  const tT = qs.reduce((a, q) => a + statOf(q).acertos + statOf(q).erros, 0);
  document.getElementById('qz-acerto').textContent = tT ? Math.round(tA / tT * 100) + '%' : '—';

  const materias = [...new Set(qs.map(q => q.materia))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sel = document.getElementById('qz-livre-materia');
  const keep = sel.value;
  sel.innerHTML = '<option value="todas">Todas as matérias</option>' +
    materias.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
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
  banco.innerHTML = materias.map(nome => {
    const doGrupo = qs.filter(q => q.materia === nome);
    return `
    <details class="qz-banco-mat">
      <summary>${esc(nome)} — ${doGrupo.length} questão(ões)</summary>
      ${doGrupo.map(q => `<div class="qz-banco-item">
        <span>${esc(q.enunciado.slice(0, 90))}${q.enunciado.length > 90 ? '…' : ''}</span>
        ${podeExcluir(c, q) ? `<button class="btn-small btn-danger" onclick="delQuestao('${q.id}')">🗑</button>` : ''}
      </div>`).join('')}
    </details>`;
  }).join('');
}

/* ─── Estudo livre ─── */
function startLivre(idsOverride) {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  let pool = questoesDoConcurso(c).slice();
  if (idsOverride) {
    pool = pool.filter(q => idsOverride.includes(q.id));
  } else {
    const mat = document.getElementById('qz-livre-materia').value;
    if (mat !== 'todas') pool = pool.filter(q => q.materia === mat);
    const filtro = document.getElementById('qz-livre-filtro').value;
    if (filtro === 'novas')   pool = pool.filter(q => statOf(q).acertos + statOf(q).erros === 0);
    if (filtro === 'erradas') pool = pool.filter(q => statOf(q).ultimo === 'errado');
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
  registrarResposta(q, ok);
  save('qstats');
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
  const todas = questoesDoConcurso(c);
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
    registrarResposta(q, ok);
  });
  save('qstats');
  cache.simulados.push({ id: genId(), concursoId: getActive().id, data: todayISO(), total: quiz.pool.length, acertos });
  save('simulados');
  showResult(acertos, quiz.pool.length, erradas);
}

/* ─── Questão na tela + resultado ─── */
function renderQuizQuestion() {
  const q = quiz.pool[quiz.idx];
  const LETRAS = 'ABCDE';
  document.getElementById('qz-progress').textContent = `Questão ${quiz.idx + 1} de ${quiz.pool.length}`;
  document.getElementById('qz-q-materia').textContent = q.materia || '';
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
      return `<div class="qz-errada-card">
        <div class="quiz-materia">${esc(e.q.materia || '')}</div>
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
   TRILHAS DE ESTUDO
══════════════════════════════════ */
function normNome(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Acha o tópico pelo nome da matéria + nome do tópico (sem diferenciar acentos/caixa).
// topico '*' significa "todos os tópicos da matéria".
function acharTopicos(c, materiaNome, topicoNome) {
  const mn = normNome(materiaNome);
  const m = c.materias.find(x => normNome(x.nome) === mn)
         || c.materias.find(x => { const n = normNome(x.nome); return n.includes(mn) || mn.includes(n); });
  if (!m) return [];
  if (topicoNome === '*') return m.topicos.slice();
  const tn = normNome(topicoNome);
  const t = m.topicos.find(x => normNome(x.nome) === tn)
         || (tn.length >= 12 ? m.topicos.find(x => { const n = normNome(x.nome); return n.includes(tn) || tn.includes(n); }) : null);
  return t ? [t] : [];
}

function nomesTopico(c, id) {
  for (const m of c.materias) {
    const t = m.topicos.find(x => x.id === id);
    if (t) return { materia: m.nome, topico: t.nome };
  }
  return null;
}

// Plano montado a partir do documento "Integração: Trilhas x Edital TCE-GO (B02 — TI)".
// O documento traz o cruzamento trilha × edital, não o conteúdo semana a semana de cada trilha;
// por isso os itens são blocos (ex.: "Semanas 5-11") ligados ao que o documento marca como coberto.
function planoTCE() {
  const v = (materia, ...topicos) => topicos.map(topico => ({ materia, topico }));
  const tudo = materia => [{ materia, topico: '*' }];
  const SO = 'Sistemas Operacionais, Redes e Nuvem', DEV = 'DevOps e Engenharia de Entrega', BD = 'Banco de Dados';
  const IA = 'IA, Ciência de Dados e Automação', DS = 'Desenvolvimento de Sistemas', SEG = 'Segurança da Informação';
  const ES = 'Engenharia de Software', GOV = 'Governança de TI', LEG = 'Legislação Aplicada à TI';
  return { studycourse: 'trilhas', versao: 1, trilhas: [
    { nome: 'DevOps', itens: [
      { titulo: 'Semanas 1-3 e 10 — Linux, redes e cloud', nota: 'Falta Windows/PowerShell/Active Directory — está na trilha "Edital TCE-GO"',
        vinculos: v(SO, 'TCP/IP; IPv4 e IPv6; DNS e DHCP', 'HTTP/2, HTTP/3, HTTPS, SMTP, FTP e SSH', 'Nuvem: IaaS, PaaS, SaaS e serverless') },
      { titulo: 'Semanas 5-11 — CI/CD, IaC, observabilidade, containers e Git', nota: 'Cobertura forte de DevOps e Engenharia de Entrega',
        vinculos: v(DEV, 'CI/CD; pipelines; automação de build e testes', 'Infraestrutura como código e gerenciamento de configuração',
          'Observabilidade: métricas, logs, traces, telemetria e alertas', 'Git distribuído; GitHub e GitLab', 'Branching: Git Flow e trunk-based development',
          'Pull/merge requests e revisão de código', 'Docker e Docker Compose', 'Orquestração com Kubernetes',
          'Ambientes de desenvolvimento, homologação e produção', 'GitHub Actions, GitLab CI/CD e Jenkins') }
    ] },
    { nome: 'Dados', itens: [
      { titulo: 'Semanas 1, 8 e 9 — SQL, modelagem e ETL', nota: 'Falta administração de PostgreSQL/Oracle, NoSQL e bancos vetoriais',
        vinculos: v(BD, 'Modelo entidade-relacionamento; normalização e desnormalização', 'SQL e álgebra relacional') },
      { titulo: 'Semanas 2 e 5-7 — Ciência de dados e IA', nota: 'Falta IA generativa e ética em IA aplicada',
        vinculos: v(IA, 'Ciência de dados: coleta, preparação, limpeza, transformação e análise', 'Estatística aplicada e avaliação de modelos',
          'Aprendizado supervisionado, não supervisionado e por reforço') }
    ] },
    { nome: 'n8n', itens: [
      { titulo: 'Semana 3 — Credenciais, webhooks e LGPD', nota: 'Cobre só a fatia de automação de Segurança da Informação — ligue aqui os tópicos que considerar cobertos', vinculos: [] },
      { titulo: 'Semana 6 — APIs, OAuth2 e autenticação', nota: '',
        vinculos: v(DS, 'APIs RESTful; GraphQL e WebSockets', 'Formatos JSON e XML', 'OAuth 2.0, OpenID Connect 1.0, tokens, claims e JWT') },
      { titulo: 'Semanas 7, 8 e 10 — Self-hosting, escalabilidade e observabilidade', nota: 'Reforça a trilha DevOps',
        vinculos: [...v(DEV, 'Observabilidade: métricas, logs, traces, telemetria e alertas'), ...v(SO, 'Escalabilidade, alta disponibilidade, integração local-nuvem e monitoramento')] }
    ] },
    { nome: 'QA', pausada: true, itens: [
      { titulo: 'Semana 11 — Performance e automação de testes', nota: 'Trilha pausada até a prova: só essa fatia aparece no edital',
        vinculos: v(ES, 'Testes: unitários, integração, funcionais, regressão, carga e estresse; automatizados') }
    ] },
    { nome: 'Edital TCE-GO — lacunas', itens: [
      { titulo: 'Engenharia de Software — fundamentos', nota: 'SOLID, Design Patterns, UML/BPMN, Scrum/Kanban/XP, requisitos',
        vinculos: v(ES, 'Princípios SOLID, DRY, KISS e YAGNI; coesão e acoplamento', 'Modelagem com UML e BPMN', 'Padrões de projeto: criacionais, estruturais e comportamentais',
          'Scrum, Kanban, Lean Software Development e XP', 'Requisitos funcionais e não funcionais: levantamento, especificação e gerenciamento', 'Histórias de usuário, casos de uso e critérios de aceite') },
      { titulo: 'Governança de TI', nota: 'COBIT 2019, ITIL v4, ISO 38500, PMBOK, Lei do Governo Digital, ENGD', vinculos: tudo(GOV) },
      { titulo: 'Legislação Aplicada à TI', nota: 'LGPD técnica, Marco Civil, certificação digital e normativos do TCE-GO (estudar direto no site do TCE-GO)', vinculos: tudo(LEG) },
      { titulo: 'Segurança da Informação — parte ampla', nota: 'Criptografia, PKI, OWASP, Zero Trust, ISO 27000',
        vinculos: v(SEG, 'Criptografia simétrica e assimétrica; ICP; certificados e assinatura digital', 'OWASP Top 10:2025; DevSecOps', 'Zero Trust', 'Família ABNT NBR ISO/IEC 27000') },
      { titulo: 'Windows, PowerShell e Active Directory/LDAP', nota: 'Seu DevOps é todo Linux',
        vinculos: v(SO, 'Windows e Linux: administração básica', 'Shell (Linux) e PowerShell; automação por scripts', 'Active Directory e LDAP') },
      { titulo: 'Língua Inglesa técnica', nota: 'Leitura de documentação real do trabalho conta', vinculos: tudo('Língua Inglesa (Leitura Técnica)') },
      { titulo: 'Conhecimentos Gerais — Língua Portuguesa', nota: '', vinculos: tudo('Língua Portuguesa') },
      { titulo: 'Conhecimentos Gerais — Matemática e Raciocínio Lógico', nota: '', vinculos: tudo('Matemática e Raciocínio Lógico') },
      { titulo: 'Conhecimentos Gerais — Legislação Institucional', nota: 'Lei Orgânica e Regimento Interno do TCE-GO: 1 sessão por semana, material denso', vinculos: tudo('Legislação Institucional') },
      { titulo: 'Engenharia de Software assistida por IA — sistematizar a prática', nota: '2-3 sessões transformando o que você já faz no trabalho em anotação de estudo', vinculos: tudo('Eng. de Software com IA e Sistemas Agentivos') },
      { titulo: 'Prova Discursiva — Estudo de Caso', nota: 'Treinar respostas técnicas objetivas dentro do limite de linhas, cronometrado', vinculos: [] }
    ] }
  ] };
}

// Mescla por nome: trilhas novas são criadas; em trilhas existentes só entram os itens que faltam.
function aplicarTrilhas(c, dados) {
  const r = { trilhas: 0, itens: 0, vinculosOk: 0, vinculosFalha: 0 };
  dados.trilhas.forEach(td => {
    const nome = typeof td.nome === 'string' ? td.nome.trim() : '';
    if (!nome) return;
    let t = trilhasDoConcurso(c).find(x => normNome(x.nome) === normNome(nome));
    if (!t) {
      t = { id: genId(), concursoId: c.id, nome, pausada: !!td.pausada, aberta: true, itens: [] };
      cache.trilhas.push(t);
      r.trilhas++;
    }
    const tem = new Set(t.itens.map(i => normNome(i.titulo)));
    (Array.isArray(td.itens) ? td.itens : []).forEach(id => {
      const titulo = typeof id.titulo === 'string' ? id.titulo.trim() : '';
      if (!titulo || tem.has(normNome(titulo))) return;
      tem.add(normNome(titulo));
      const ids = new Set();
      (Array.isArray(id.vinculos) ? id.vinculos : []).forEach(vn => {
        const achados = vn && vn.materia ? acharTopicos(c, vn.materia, vn.topico || '') : [];
        if (achados.length) { achados.forEach(x => ids.add(x.id)); r.vinculosOk++; } else r.vinculosFalha++;
      });
      t.itens.push({ id: genId(), titulo, nota: typeof id.nota === 'string' ? id.nota : '', feito: false, feitoEm: '', vinculos: [...ids] });
      r.itens++;
    });
  });
  save('trilhas');
  return r;
}

function resumoTrilhas(r) {
  if (r.trilhas + r.itens === 0) return 'Nada novo: você já tinha essas trilhas e itens.';
  return `✅ ${r.trilhas} trilha(s) nova(s) e ${r.itens} item(ns) adicionado(s).` +
    (r.vinculosOk ? `\n🔗 ${r.vinculosOk} ligação(ões) com tópicos do edital.` : '') +
    (r.vinculosFalha ? `\n⚠️ ${r.vinculosFalha} ligação(ões) não encontrada(s): a matéria ou o tópico tem nome diferente no seu edital. Ligue-as editando o item.` : '');
}

function carregarPlanoTCE() {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  const r = aplicarTrilhas(c, planoTCE());
  closeModal('modal-imp-trilhas');
  renderAll();
  alert(resumoTrilhas(r));
}

function parseTrilhasTexto(txt) {
  const trilhas = [];
  let cur = null;
  txt.split('\n').forEach(raw => {
    const l = raw.trim();
    if (!l) return;
    const m = l.match(/^\[(.+)\]$/);
    if (m) { cur = { nome: m[1].trim(), itens: [] }; trilhas.push(cur); return; }
    if (!cur) { cur = { nome: 'Minha trilha', itens: [] }; trilhas.push(cur); }
    cur.itens.push({ titulo: l.replace(/^([-*•]|\d+[\.\)])\s+/, ''), vinculos: [] });
  });
  return { studycourse: 'trilhas', trilhas };
}

function importarTrilhas(e) {
  e.preventDefault();
  const c = getActive();
  const txt = document.getElementById('imp-trilhas-texto').value.trim();
  if (!txt) { alert('Cole um texto ou escolha um arquivo.'); return; }
  let dados;
  if (txt.startsWith('{')) {
    try { dados = JSON.parse(txt); } catch (_) { alert('Não consegui ler esse texto. Cole exatamente o que foi exportado pelo app.'); return; }
    if (!dados || dados.studycourse !== 'trilhas' || !Array.isArray(dados.trilhas)) { alert('Esse texto não parece uma exportação de trilhas do StudyCourse.'); return; }
  } else {
    dados = parseTrilhasTexto(txt);
  }
  const r = aplicarTrilhas(c, dados);
  closeModal('modal-imp-trilhas');
  renderAll();
  alert(resumoTrilhas(r));
}

function openImportarTrilhas() {
  if (!getActive()) { alert('Cadastre um concurso primeiro.'); return; }
  document.getElementById('imp-trilhas-texto').value = '';
  document.getElementById('imp-trilhas-arquivo').value = '';
  openModal('modal-imp-trilhas');
}

function lerArquivoTrilhas(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('imp-trilhas-texto').value = reader.result; };
  reader.readAsText(f);
}

function exportarTrilhasJSON(c) {
  return JSON.stringify({
    studycourse: 'trilhas',
    versao: 1,
    concurso: c.nome,
    trilhas: trilhasDoConcurso(c).map(t => ({
      nome: t.nome,
      pausada: !!t.pausada,
      itens: t.itens.map(i => ({ titulo: i.titulo, nota: i.nota || '', vinculos: i.vinculos.map(id => nomesTopico(c, id)).filter(Boolean) }))
    }))
  }, null, 2);
}

function openExportarTrilhas() {
  const c = getActive();
  if (!c || trilhasDoConcurso(c).length === 0) { alert('Não há trilhas para exportar neste concurso.'); return; }
  document.getElementById('exp-trilhas-texto').value = exportarTrilhasJSON(c);
  openModal('modal-exp-trilhas');
}

function copiarExportTrilhas() {
  const ta = document.getElementById('exp-trilhas-texto');
  const ok = () => alert('Texto copiado! Cole em "Importar" no app de quem vai receber.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(ok, () => { ta.select(); document.execCommand('copy'); ok(); });
  } else { ta.select(); document.execCommand('copy'); ok(); }
}

function baixarExportTrilhas() {
  const slug = getActive().nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'concurso';
  const blob = new Blob([document.getElementById('exp-trilhas-texto').value], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `trilhas-${slug}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ─── Trilhas e itens: criar, editar, concluir ─── */
function getTrilha(id) { return cache.trilhas.find(t => t.id === id); }

function openTrilhaModal(id) {
  const c = getActive();
  if (!c) { alert('Cadastre um concurso primeiro.'); return; }
  const t = getTrilha(id);
  document.getElementById('modal-trilha-title').textContent = t ? 'Renomear trilha' : 'Nova trilha';
  document.getElementById('tr-id').value = t ? t.id : '';
  document.getElementById('tr-nome').value = t ? t.nome : '';
  openModal('modal-trilha');
}

function saveTrilha(e) {
  e.preventDefault();
  const id = document.getElementById('tr-id').value;
  const nome = document.getElementById('tr-nome').value.trim();
  if (id) getTrilha(id).nome = nome;
  else cache.trilhas.push({ id: genId(), concursoId: getActive().id, nome, pausada: false, aberta: true, itens: [] });
  save('trilhas');
  closeModal('modal-trilha');
  renderTrilhas();
}

function delTrilha(id) {
  const t = getTrilha(id);
  if (!confirm(`Excluir a trilha "${t.nome}" e todos os itens dela?\n\nOs tópicos ligados deixam de contar como estudados por ela.`)) return;
  cache.trilhas = cache.trilhas.filter(x => x.id !== id);
  save('trilhas');
  renderAll();
}

function pausarTrilha(id) {
  const t = getTrilha(id);
  t.pausada = !t.pausada;
  save('trilhas');
  renderTrilhas();
}

function toggleTrilha(id) {
  const t = getTrilha(id);
  t.aberta = !t.aberta;
  save('trilhas');
  renderTrilhas();
}

function toggleItemTrilha(tid, iid) {
  const i = getTrilha(tid).itens.find(x => x.id === iid);
  i.feito = !i.feito;
  i.feitoEm = i.feito ? todayISO() : '';
  save('trilhas');
  renderAll();
}

function delItemTrilha(tid, iid) {
  if (!confirm('Excluir este item?')) return;
  const t = getTrilha(tid);
  t.itens = t.itens.filter(x => x.id !== iid);
  save('trilhas');
  renderAll();
}

let tiSel = new Set();

function openItemTrilhaModal(tid, iid) {
  const c = getActive();
  const i = iid ? getTrilha(tid).itens.find(x => x.id === iid) : null;
  document.getElementById('modal-trilha-item-title').textContent = i ? 'Editar item' : 'Novo item';
  document.getElementById('ti-tid').value = tid;
  document.getElementById('ti-id').value = i ? i.id : '';
  document.getElementById('ti-titulo').value = i ? i.titulo : '';
  document.getElementById('ti-nota').value = i ? (i.nota || '') : '';
  document.getElementById('ti-busca').value = '';
  const existentes = new Set(c.materias.flatMap(m => m.topicos.map(t => t.id)));
  tiSel = new Set(i ? i.vinculos.filter(id => existentes.has(id)) : []);
  renderTopicosItem();
  openModal('modal-trilha-item');
}

function atualizarContadorItem() {
  document.getElementById('ti-contador').textContent = tiSel.size ? `${tiSel.size} selecionado(s).` : 'Nenhum selecionado.';
}

function renderTopicosItem() {
  const c = getActive();
  const f = normNome(document.getElementById('ti-busca').value);
  const html = c.materias.map(m => {
    const ts = m.topicos.filter(t => !f || normNome(t.nome).includes(f) || normNome(m.nome).includes(f));
    if (ts.length === 0) return '';
    const sel = m.topicos.filter(t => tiSel.has(t.id)).length;
    return `<details class="ti-mat" ${f || sel ? 'open' : ''}>
      <summary>${esc(m.nome)}${sel ? ` <span class="ti-sel">· ${sel} selecionado(s)</span>` : ''}</summary>
      ${ts.map(t => `<label class="ti-topico"><input type="checkbox" ${tiSel.has(t.id) ? 'checked' : ''} onchange="tiToggle('${t.id}', this.checked)" /> <span>${esc(t.nome)}</span></label>`).join('')}
    </details>`;
  }).join('');
  document.getElementById('ti-topicos').innerHTML = html || '<p class="hint">Nenhum tópico encontrado. Cadastre as matérias e tópicos do edital na aba Matérias.</p>';
  atualizarContadorItem();
}

function tiToggle(id, marcado) {
  if (marcado) tiSel.add(id); else tiSel.delete(id);
  atualizarContadorItem();
}

function saveItemTrilha(e) {
  e.preventDefault();
  const t = getTrilha(document.getElementById('ti-tid').value);
  const id = document.getElementById('ti-id').value;
  const dados = {
    titulo: document.getElementById('ti-titulo').value.trim(),
    nota: document.getElementById('ti-nota').value.trim(),
    vinculos: [...tiSel]
  };
  if (id) Object.assign(t.itens.find(x => x.id === id), dados);
  else t.itens.push({ id: genId(), feito: false, feitoEm: '', ...dados });
  save('trilhas');
  closeModal('modal-trilha-item');
  renderAll();
}

function renderTrilhas() {
  const c = getActive();
  const el = document.getElementById('trilhas-list');
  if (!c) {
    el.innerHTML = '<p class="hint">Cadastre um concurso primeiro.</p>';
    ['tr-st-itens', 'tr-st-topicos', 'tr-st-trilhas'].forEach(id => { document.getElementById(id).textContent = id === 'tr-st-itens' ? '0/0' : '0'; });
    return;
  }
  const ts = trilhasDoConcurso(c);
  const todosItens = ts.flatMap(t => t.itens);
  const existentes = new Set(c.materias.flatMap(m => m.topicos.map(t => t.id)));
  document.getElementById('tr-st-itens').textContent = `${todosItens.filter(i => i.feito).length}/${todosItens.length}`;
  document.getElementById('tr-st-topicos').textContent = [...creditados()].filter(id => existentes.has(id)).length;
  document.getElementById('tr-st-trilhas').textContent = ts.length;

  if (ts.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🧭</div>
      <p>Nenhuma trilha ainda. Comece pelo plano montado a partir do seu documento de integração, ou crie as suas.</p>
      <div class="quiz-nav" style="justify-content:center">
        <button class="btn-primary" onclick="carregarPlanoTCE()">🧭 Carregar plano TCE-GO (B02)</button>
        <button class="btn-small" onclick="openTrilhaModal()">+ Criar trilha</button>
        <button class="btn-small" onclick="openImportarTrilhas()">⬇ Importar</button>
      </div></div>`;
    return;
  }

  el.innerHTML = ts.map(t => {
    const feitos = t.itens.filter(i => i.feito).length;
    const pct = t.itens.length ? Math.round(feitos / t.itens.length * 100) : 0;
    const itens = t.itens.length === 0
      ? '<p class="hint">Trilha vazia — adicione os itens que você vai estudar.</p>'
      : t.itens.map(i => {
          const ligados = i.vinculos.map(id => nomesTopico(c, id)).filter(Boolean);
          const meta = [
            ligados.length ? `<span title="${esc(ligados.map(x => x.materia + ' › ' + x.topico).join('\n'))}">🔗 ${ligados.length} tópico(s) do edital</span>` : '<span>sem tópicos do edital ligados</span>',
            i.feito && i.feitoEm ? `concluído em ${fmtDate(i.feitoEm)}` : ''
          ].filter(Boolean).join(' · ');
          return `<div class="proc-etapa ${i.feito ? 'concluida' : 'pendente'}">
            <button class="proc-etapa-ico" title="${i.feito ? 'Desmarcar' : 'Marcar como estudado'}" onclick="toggleItemTrilha('${t.id}','${i.id}')">${i.feito ? '✅' : '⬜'}</button>
            <div class="proc-etapa-info">
              <div class="proc-etapa-nome">${esc(i.titulo)}</div>
              <div class="sessao-meta">${meta}</div>
              ${i.nota ? `<div class="sessao-meta">📝 ${esc(i.nota)}</div>` : ''}
            </div>
            <button class="btn-small" onclick="openItemTrilhaModal('${t.id}','${i.id}')">✏️</button>
            <button class="btn-small btn-danger" onclick="delItemTrilha('${t.id}','${i.id}')">🗑</button>
          </div>`;
        }).join('');
    return `<div class="materia-card ${t.aberta ? 'open' : ''} ${t.pausada ? 'trilha-pausada' : ''}">
      <div class="materia-header" onclick="toggleTrilha('${t.id}')">
        <div>
          <div class="materia-nome">${t.aberta ? '▾' : '▸'} ${esc(t.nome)} ${t.pausada ? '<span class="status-badge encerrado">⏸ pausada</span>' : ''}</div>
          <div class="materia-meta">${feitos}/${t.itens.length} itens · ${pct}%</div>
        </div>
      </div>
      <div class="progress-track" style="margin-top:8px"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="topicos-list">
        ${itens}
        <div class="materia-actions">
          <button class="btn-small" onclick="openItemTrilhaModal('${t.id}')">+ Item</button>
          <button class="btn-small" onclick="pausarTrilha('${t.id}')">${t.pausada ? '▶ Retomar' : '⏸ Pausar'}</button>
          <button class="btn-small" onclick="openTrilhaModal('${t.id}')">✏️ Renomear</button>
          <button class="btn-small btn-danger" onclick="delTrilha('${t.id}')">🗑 Excluir</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════
   PROCESSOS SELETIVOS (TRAINEE)
══════════════════════════════════ */
const STATUS_PROC = {
  interesse: '👀 Quero me inscrever',
  inscrito:  '📨 Inscrito',
  andamento: '🏃 Em andamento',
  aprovado:  '🎉 Aprovado',
  reprovado: '❌ Não passei',
  desistiu:  '🚪 Desisti'
};
const PROC_ABERTOS = ['interesse', 'inscrito', 'andamento'];
const ETAPAS_TRAINEE = ['Inscrição', 'Testes online', 'Dinâmica de grupo', 'Entrevista com RH', 'Entrevista com gestor', 'Painel final', 'Resultado'];
const ICONE_ETAPA = { pendente: '⬜', atual: '📍', concluida: '✅' };
let procFiltro = 'abertos';

function labelDias(n) { return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`; }

function getProc(id) { return cache.processos.find(p => p.id === id); }

function openProcModal(id) {
  const p = getProc(id);
  document.getElementById('modal-proc-title').textContent = p ? 'Editar processo' : 'Novo processo seletivo';
  document.getElementById('p-id').value      = p ? p.id : '';
  document.getElementById('p-empresa').value = p ? p.empresa : '';
  document.getElementById('p-vaga').value    = p ? (p.vaga || '') : '';
  document.getElementById('p-status').value  = p ? p.status : 'interesse';
  document.getElementById('p-prazo').value   = p ? (p.prazo || '') : '';
  document.getElementById('p-link').value    = p ? (p.link || '') : '';
  document.getElementById('p-obs').value     = p ? (p.obs || '') : '';
  openModal('modal-proc');
}

function saveProc(e) {
  e.preventDefault();
  const id = document.getElementById('p-id').value;
  const dados = {
    empresa: document.getElementById('p-empresa').value.trim(),
    vaga:    document.getElementById('p-vaga').value.trim(),
    status:  document.getElementById('p-status').value,
    prazo:   document.getElementById('p-prazo').value,
    link:    document.getElementById('p-link').value.trim(),
    obs:     document.getElementById('p-obs').value.trim()
  };
  if (id) Object.assign(getProc(id), dados);
  else cache.processos.push({ id: genId(), etapas: [], ...dados });
  save('processos');
  closeModal('modal-proc');
  renderProcessos();
}

function delProc(id) {
  const p = getProc(id);
  if (!confirm(`Excluir o processo "${p.empresa}"${p.vaga ? ' — ' + p.vaga : ''}?`)) return;
  cache.processos = cache.processos.filter(x => x.id !== id);
  save('processos');
  renderProcessos();
}

function mudarStatusProc(id, status) {
  getProc(id).status = status;
  save('processos');
  renderProcessos();
}

function setProcFiltro(f) { procFiltro = f; renderProcessos(); }

function addEtapasTrainee(pid) {
  const p = getProc(pid);
  ETAPAS_TRAINEE.forEach(nome => {
    if (!p.etapas.some(e => e.nome === nome)) p.etapas.push({ id: genId(), nome, data: '', status: 'pendente', obs: '' });
  });
  save('processos');
  renderProcessos();
}

function openProcEtapaModal(pid, eid) {
  const e = eid ? getProc(pid).etapas.find(x => x.id === eid) : null;
  document.getElementById('modal-proc-etapa-title').textContent = e ? 'Editar etapa' : 'Nova etapa';
  document.getElementById('pe-pid').value    = pid;
  document.getElementById('pe-id').value     = e ? e.id : '';
  document.getElementById('pe-nome').value   = e ? e.nome : '';
  document.getElementById('pe-data').value   = e ? (e.data || '') : '';
  document.getElementById('pe-status').value = e ? e.status : 'pendente';
  document.getElementById('pe-obs').value    = e ? (e.obs || '') : '';
  openModal('modal-proc-etapa');
}

function saveProcEtapa(ev) {
  ev.preventDefault();
  const p = getProc(document.getElementById('pe-pid').value);
  const id = document.getElementById('pe-id').value;
  const dados = {
    nome:   document.getElementById('pe-nome').value.trim(),
    data:   document.getElementById('pe-data').value,
    status: document.getElementById('pe-status').value,
    obs:    document.getElementById('pe-obs').value.trim()
  };
  if (dados.status === 'atual') p.etapas.forEach(x => { if (x.status === 'atual' && x.id !== id) x.status = 'pendente'; });
  if (id) Object.assign(p.etapas.find(x => x.id === id), dados);
  else p.etapas.push({ id: genId(), ...dados });
  save('processos');
  closeModal('modal-proc-etapa');
  renderProcessos();
}

// ⬜ pendente → 📍 atual → ✅ concluída → ⬜
function cicloProcEtapa(pid, eid) {
  const p = getProc(pid);
  const et = p.etapas.find(x => x.id === eid);
  et.status = { pendente: 'atual', atual: 'concluida', concluida: 'pendente' }[et.status];
  if (et.status === 'atual') p.etapas.forEach(x => { if (x.status === 'atual' && x.id !== eid) x.status = 'pendente'; });
  save('processos');
  renderProcessos();
}

function delProcEtapa(pid, eid) {
  if (!confirm('Excluir esta etapa?')) return;
  const p = getProc(pid);
  p.etapas = p.etapas.filter(x => x.id !== eid);
  save('processos');
  renderProcessos();
}

// Datas que ainda exigem ação: prazo de inscrição (se ainda não se inscreveu) e etapas não concluídas.
function compromissosProc(p) {
  const itens = [];
  if (p.status === 'interesse' && p.prazo) itens.push({ data: p.prazo, texto: 'Fim do prazo de inscrição' });
  p.etapas.forEach(e => { if (e.status !== 'concluida' && e.data) itens.push({ data: e.data, texto: e.nome }); });
  return itens;
}

function proximaDataProc(p) {
  const futuras = compromissosProc(p).map(i => i.data).filter(d => daysUntil(d) >= 0).sort();
  return futuras[0] || '';
}

function renderProcessos() {
  const abertos = cache.processos.filter(p => PROC_ABERTOS.includes(p.status));

  // Resumo e agenda (só processos em aberto)
  const agenda = [];
  abertos.forEach(p => compromissosProc(p).forEach(i => {
    const d = daysUntil(i.data);
    if (d >= 0) agenda.push({ ...i, dias: d, empresa: p.empresa });
  }));
  agenda.sort((a, b) => a.data.localeCompare(b.data));

  document.getElementById('proc-st-abertos').textContent = abertos.length;
  document.getElementById('proc-st-prazo').textContent =
    abertos.filter(p => p.status === 'interesse' && p.prazo && daysUntil(p.prazo) >= 0 && daysUntil(p.prazo) <= 7).length;
  document.getElementById('proc-st-etapas').textContent =
    agenda.filter(i => i.dias <= 7 && i.texto !== 'Fim do prazo de inscrição').length;

  document.getElementById('proc-agenda').innerHTML = agenda.length === 0
    ? '<p class="hint">Nada marcado pela frente. Coloque datas nas etapas e nos prazos de inscrição para aparecerem aqui.</p>'
    : agenda.slice(0, 6).map(i => `<div class="sessao-row">
        <div class="sessao-info">
          <div class="sessao-materia">${esc(i.empresa)} — ${esc(i.texto)}</div>
          <div class="sessao-meta">${fmtDate(i.data)}</div>
        </div>
        <span class="sessao-tempo ${i.dias <= 2 ? 'fonte-visita-alerta' : ''}">${labelDias(i.dias)}</span>
      </div>`).join('');

  // Filtros
  const encerrados = cache.processos.length - abertos.length;
  document.getElementById('proc-filtros').innerHTML = [
    ['abertos', `Em aberto (${abertos.length})`],
    ['encerrados', `Encerrados (${encerrados})`],
    ['todos', `Todos (${cache.processos.length})`]
  ].map(([f, t]) => `<button class="chip ${procFiltro === f ? 'active' : ''}" onclick="setProcFiltro('${f}')">${t}</button>`).join('');

  // Lista: em aberto com data mais próxima primeiro; sem data no fim
  let lista = cache.processos.filter(p =>
    procFiltro === 'todos' || (procFiltro === 'abertos') === PROC_ABERTOS.includes(p.status));
  lista = lista.slice().sort((a, b) => {
    const da = proximaDataProc(a), db_ = proximaDataProc(b);
    if (da && db_) return da.localeCompare(db_);
    return da ? -1 : db_ ? 1 : a.empresa.localeCompare(b.empresa, 'pt-BR');
  });

  const el = document.getElementById('proc-list');
  if (cache.processos.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">💼</div><p>Nenhum processo seletivo ainda. Adicione os trainees em que você vai se inscrever ou já se inscreveu.</p></div>';
    return;
  }
  if (lista.length === 0) { el.innerHTML = '<p class="hint">Nenhum processo nesta categoria.</p>'; return; }

  el.innerHTML = lista.map(p => {
    let prazoHtml = '';
    if (p.prazo && p.status === 'interesse') {
      const d = daysUntil(p.prazo);
      prazoHtml = d < 0
        ? `<div class="fonte-visita-alerta">⏰ Prazo de inscrição encerrou em ${fmtDate(p.prazo)}</div>`
        : `<div class="${d <= 3 ? 'fonte-visita-alerta' : ''}">⏰ Inscrições até ${fmtDate(p.prazo)} (${labelDias(d)})</div>`;
    } else if (p.prazo) {
      prazoHtml = `<div>⏰ Inscrições até ${fmtDate(p.prazo)}</div>`;
    }
    const etapasHtml = p.etapas.length === 0
      ? '<p class="hint" style="margin:8px 0 0">Sem etapas ainda — cadastre as fases do processo para acompanhar.</p>'
      : p.etapas.map(e => {
          const d = e.data ? daysUntil(e.data) : null;
          let meta = e.data ? fmtDate(e.data) : '';
          if (e.data && e.status !== 'concluida') {
            meta += d >= 0 ? ` · ${labelDias(d)}` : ' · ⚠️ a data passou — atualize a situação';
          }
          return `<div class="proc-etapa ${e.status}">
            <button class="proc-etapa-ico" title="Clique para mudar a situação" onclick="cicloProcEtapa('${p.id}','${e.id}')">${ICONE_ETAPA[e.status]}</button>
            <div class="proc-etapa-info">
              <div class="proc-etapa-nome">${esc(e.nome)}</div>
              ${meta ? `<div class="sessao-meta">${meta}</div>` : ''}
              ${e.obs ? `<div class="sessao-meta">📝 ${esc(e.obs)}</div>` : ''}
            </div>
            <button class="btn-small" onclick="openProcEtapaModal('${p.id}','${e.id}')">✏️</button>
            <button class="btn-small btn-danger" onclick="delProcEtapa('${p.id}','${e.id}')">🗑</button>
          </div>`;
        }).join('');

    return `<div class="concurso-card proc-card">
      <h3>${esc(p.empresa)}${p.vaga ? ` <span class="proc-vaga">— ${esc(p.vaga)}</span>` : ''}</h3>
      <div class="concurso-meta">
        ${prazoHtml}
        ${p.link ? `<div>🔗 <a href="${esc(p.link)}" target="_blank" rel="noopener">Abrir vaga / portal</a></div>` : ''}
        ${p.obs ? `<div style="white-space:pre-wrap">📝 ${esc(p.obs)}</div>` : ''}
      </div>
      <div class="proc-status-row">
        <select class="proc-status ${p.status}" onchange="mudarStatusProc('${p.id}', this.value)">
          ${Object.entries(STATUS_PROC).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="proc-etapas">${etapasHtml}</div>
      <div class="concurso-actions">
        <button class="btn-small" onclick="openProcEtapaModal('${p.id}')">+ Etapa</button>
        ${p.etapas.length === 0 ? `<button class="btn-small" onclick="addEtapasTrainee('${p.id}')">Usar etapas padrão</button>` : ''}
        <button class="btn-small" onclick="openProcModal('${p.id}')">✏️ Editar</button>
        <button class="btn-small btn-danger" onclick="delProc('${p.id}')">🗑 Excluir</button>
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
