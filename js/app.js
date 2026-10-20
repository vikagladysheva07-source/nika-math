/* Nika.math — приложение */
(function () {
'use strict';
const { SKILLS, BLOCKS, make, gcd } = window.PYAT;
const { UNITS, EASY, KEYS, MISTAKES, LEVELS, ACH } = window.NM_CONTENT;
const KEY = 'pyaterka_v1', GOAL = 50, NAME = 'Ника';
const RATE = 1, CAP = 3000, MIN_OUT = 300;       // 1 балл = 1 ₽, потолок в месяц, минимальный обмен
const SB = { url: 'https://amcbxjwgiqphqikzcxfj.supabase.co', key: 'sb_publishable_pDMx4w2cbHbuf7Y6cHiE2g_mFT8hlPB' };
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const BL = Object.fromEntries(BLOCKS.map(b => [b.id, b]));
const UNIT_OF = {}; UNITS.forEach(u => u.skills.forEach(id => { UNIT_OF[id] = u; }));

/* ---------- даты и числа ---------- */
const fmtD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => fmtD(new Date());
const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtD(d); };
const ruDate = ds => new Date(ds + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const monthName = () => ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'][new Date().getMonth()];
const fmtN = n => Math.round(n).toLocaleString('ru-RU');
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const rid = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join(''); };

/* ---------- состояние ---------- */
const fresh = () => ({ v: 2, sk: {}, days: {}, errors: [], school: null, diag: false, session: null, best: 0,
  kid: rid(24), coins: 0, xp: 0, earned: {}, ledger: [], ach: {}, mastered: {}, dayBonus: {}, chests: {}, unitDone: {},
  controls: [], ctrlPaid: {}, withdraw: [], bestCombo: 0, ts: 0 });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
S = Object.assign(fresh(), S || {});
if (!S.kid) S.kid = rid(24);
const saveLocal = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const save = () => { S.ts = Date.now(); saveLocal(); queueSync(); };

const st = id => S.sk[id] || (S.sk[id] = { h: [], n: 0, c: 0 });
function status(id) {
  const s = S.sk[id]; if (!s || !s.h.length) return 'new';
  const h = s.h.slice(-10), a = h.reduce((x, y) => x + y, 0) / h.length;
  if (a < 0.6) return 'gap';
  if (a >= 0.85 && s.h.length >= 8) return 'ok';
  return 'learn';
}
const acc = id => { const s = S.sk[id]; if (!s || !s.h.length) return null; const h = s.h.slice(-10); return Math.round(100 * h.reduce((a, b) => a + b, 0) / h.length); };
const passed = id => status(id) === 'ok' || !!S.mastered[id];   // пройденная на пути тема остаётся пройденной
function mastery(id) {
  const s = S.sk[id]; if (!s || !s.h.length) return 0; if (passed(id)) return 1;
  const h = s.h.slice(-10), a = h.reduce((x, y) => x + y, 0) / h.length;
  return Math.min(0.95, Math.min(1, s.h.length / 8) * Math.min(1, a / 0.85));
}
const levelOf = id => ({ new: 1, gap: 1, learn: 2, ok: 3 })[status(id)];
const STATUS_TXT = { new: 'не начато', gap: 'пробел', learn: 'в процессе', ok: 'освоено' };
const RANK = { gap: 0, new: 1, learn: 2, ok: 3 };
const totalTasks = () => Object.values(S.days).reduce((a, d) => a + d.n, 0);

function record(id, score) {
  const s = st(id); s.h.push(score); if (s.h.length > 20) s.h.shift(); s.n++; if (score === 1) s.c++; s.last = today();
  const d = S.days[today()] || (S.days[today()] = { n: 0, c: 0 }); d.n++; d.c += score;
  if (score === 0) { S.errors.push({ sk: id, d: today() }); if (S.errors.length > 200) S.errors.shift(); }
  S.xp = (S.xp || 0) + 1;
}
function scheduleDue(ids) {
  [...new Set(ids)].forEach(id => {
    const s = st(id), stt = status(id);
    if (stt === 'gap') s.iv = 1; else if (stt === 'learn') s.iv = 2; else s.iv = Math.min(30, Math.max(4, (s.iv || 2) * 2));
    s.due = addDays(today(), s.iv);
  });
}
function streak() {
  let n = 0, d = today();
  if (!((S.days[d] || {}).n >= GOAL)) d = addDays(d, -1);
  while ((S.days[d] || {}).n >= GOAL) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------- экономика: баллы, уровни, достижения ---------- */
const popQueue = [];
const monthKey = () => today().slice(0, 7);
function award(n, why) {
  if (n <= 0) return 0;
  S.xp = (S.xp || 0) + n;
  const m = monthKey(), got = S.earned[m] || 0, give = Math.min(n, Math.max(0, CAP - got));
  if (give > 0) {
    S.coins += give; S.earned[m] = got + give;
    S.ledger.unshift({ d: today(), n: give, w: why }); if (S.ledger.length > 200) S.ledger.length = 200;
    if (S.session && !S.session.done) S.session.got = (S.session.got || 0) + give;
  }
  return give;
}
function level() {
  let i = 0; while (i + 1 < LEVELS.length && S.xp >= LEVELS[i + 1][0]) i++;
  const cur = LEVELS[i][0], nxt = LEVELS[i + 1] ? LEVELS[i + 1][0] : cur;
  return { i, name: LEVELS[i][1], cur, nxt, pct: nxt > cur ? (S.xp - cur) / (nxt - cur) : 1 };
}
function achStats() {
  return { total: totalTasks(), goalDays: Object.values(S.days).filter(d => d.n >= GOAL).length, streak: streak(), combo: S.bestCombo || 0,
    ok: SKILLS.filter(s => status(s.id) === 'ok').length, baseDone: SKILLS.filter(s => s.block === 'base').every(s => status(s.id) === 'ok'),
    units: Object.keys(S.unitDone).length, fives: S.controls.filter(c => c.grade === 5).length };
}
function checkAch() {
  const stt = achStats(); let got = 0;
  for (const [id, title, desc, rew, test] of ACH) {
    if (S.ach[id] || !test(stt)) continue;
    S.ach[id] = today(); const g = award(rew, 'Достижение: ' + title); got += g;
    popQueue.push({ kind: 'ach', title, desc, coins: g });
  }
  return got;
}
function checkMastery(id) {
  if (status(id) !== 'ok' || S.mastered[id]) return 0;
  S.mastered[id] = today(); const g = award(50, 'Тема освоена: ' + SK[id].title);
  popQueue.push({ kind: 'master', title: SK[id].title, coins: g });
  return g;
}
function checkDay() {
  const d = S.days[today()]; if (!d || d.n < GOAL || S.dayBonus[today()]) return 0;
  S.dayBonus[today()] = 1; const good = d.c / d.n >= 0.7;
  const g = award(good ? 20 : 5, 'Норма дня');
  popQueue.push({ kind: 'day', good, coins: g, acc: Math.round(100 * d.c / d.n) });
  return g;
}

/* ---------- маршрут ---------- */
const byBlock = b => SKILLS.filter(s => s.block === b);
const school = () => S.school || { alg: 'lin_eq', geo: 'geo_theory' };
function pathway() {
  const sc = school(), upTo = (b, id) => { const arr = byBlock(b), i = arr.findIndex(s => s.id === id); return arr.slice(0, i + 1).map(s => s.id); };
  return [...byBlock('base').map(s => s.id), ...upTo('alg', sc.alg), ...upTo('geo', sc.geo), ...byBlock('prob').map(s => s.id)];
}
function pathItems() {
  const items = []; let prevDone = true, current = null;
  UNITS.forEach(u => {
    items.push({ t: 'unit', u });
    u.skills.forEach((id, k) => {
      const done = passed(id), state = done ? 'done' : prevDone ? 'current' : 'locked';
      if (state === 'current' && !current) current = id;
      items.push({ t: 'node', id, u, k, state: state === 'current' && current !== id ? 'locked' : state });
      if (!done) prevDone = false;
      if ((k + 1) % 3 === 0 && k < u.skills.length - 1) { const key = u.id + '-' + k; items.push({ t: 'chest', key, u, k, state: S.chests[key] ? 'done' : prevDone ? 'open' : 'locked' }); }
    });
    items.push({ t: 'trophy', u, state: S.unitDone[u.id] ? 'done' : prevDone ? 'open' : 'locked' });
  });
  return { items, current };
}
function focusSkill() {
  const cur = pathItems().current; if (cur && S.diag) return cur;
  const pw = pathway(), sorted = pw.slice().sort((a, b) => RANK[status(a)] - RANK[status(b)] || pw.indexOf(a) - pw.indexOf(b));
  return status(sorted[0]) === 'ok' ? school().alg : sorted[0];
}
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const task = (id, lv, extra) => Object.assign({ t: 'task', p: make(id, lv) }, extra || {});

function buildDaily() {
  const pw = pathway(), focus = focusSkill(), sc = school(), td = today();
  const dueList = pw.filter(id => id !== focus && S.sk[id] && S.sk[id].h.length && (!S.sk[id].due || S.sk[id].due <= td)).sort((a, b) => RANK[status(a)] - RANK[status(b)]);
  const review = [];
  for (let r = 0; r < 3 && review.length < 15; r++) for (const id of dueList) { if (review.length >= 15) break; review.push(task(id, levelOf(id))); }
  const warm = review.slice(0, 5), rest = review.slice(5), fst = status(focus), focusT = [];
  for (let i = 0; i < 15; i++) focusT.push(task(focus, i < 5 ? 1 : i < 10 ? 2 : Math.max(2, levelOf(focus)), { focus: true }));
  const sch = []; for (let i = 0; i < 5; i++) { sch.push(task(sc.alg, levelOf(sc.alg))); sch.push(task(sc.geo, levelOf(sc.geo))); }
  const mix = [], need = 50 - warm.length - focusT.length - sch.length - rest.length;
  for (let i = 0; i < need; i++) { const id = pw[Math.floor(Math.random() * pw.length)]; mix.push(task(id, levelOf(id))); }
  const q = [...warm]; if (fst === 'gap' || fst === 'new') q.push({ t: 'lesson', sk: focus });
  q.push(...focusT, ...sch, ...shuffle([...rest, ...mix]));
  return { kind: 'daily', date: td, focus, queue: q, i: 0, res: [] };
}
function buildDiag() {
  const sc = school(), q = [], upTo = (b, id) => { const arr = byBlock(b), i = arr.findIndex(s => s.id === id); return arr.slice(0, i + 1); };
  byBlock('base').forEach(s => { q.push(task(s.id, 1)); q.push(task(s.id, 2)); });
  [...upTo('alg', sc.alg), ...upTo('geo', sc.geo)].forEach(s => q.push(task(s.id, 1)));
  return { kind: 'diag', date: today(), queue: q, i: 0, res: [] };
}
function buildTrain(id, lv, n) {
  const q = [{ t: 'lesson', sk: id }]; for (let i = 0; i < (n || 10); i++) q.push(task(id, lv || levelOf(id)));
  return { kind: 'train', date: today(), sk: id, queue: q, i: 0, res: [] };
}
function buildPath(id) {
  const q = []; if (status(id) !== 'learn') q.push({ t: 'lesson', sk: id });
  const g = status(id) === 'gap'; for (let i = 0; i < 15; i++) q.push(task(id, i < (g ? 6 : 5) ? 1 : i < (g ? 12 : 10) ? 2 : 3));
  return { kind: 'path', date: today(), sk: id, queue: q, i: 0, res: [] };
}
function errorSkills() {
  const lim = addDays(today(), -14), cnt = {};
  S.errors.filter(e => e.d >= lim).forEach(e => { cnt[e.sk] = (cnt[e.sk] || 0) + 1; });
  return Object.entries(cnt).filter(([id]) => status(id) !== 'ok').sort((a, b) => b[1] - a[1]).map(e => e[0]);
}
function buildErrors() {
  const ids = errorSkills().slice(0, 5), q = [];
  for (let i = 0; q.length < 15 && ids.length; i++) { const id = ids[i % ids.length]; q.push(task(id, Math.min(2, levelOf(id)))); }
  return { kind: 'errors', date: today(), queue: q, i: 0, res: [] };
}
const isExam = s => s && (s.kind === 'control' || s.kind === 'unit');
function buildExam(kind, pool, mins, extra) {
  const q = []; for (let i = 0; i < 10; i++) q.push(task(pool[i % pool.length], i < 5 ? 2 : 3));
  return Object.assign({ kind, date: today(), queue: shuffle(q), i: 0, res: [], endAt: Date.now() + mins * 60000, mins }, extra);
}
function controlPool(block) {
  const arr = byBlock(block).map(s => s.id), cur = school()[block], i = arr.indexOf(cur);
  const prev = arr.slice(Math.max(0, i - 2), i); return [cur, cur, ...prev, cur, cur, ...prev];
}

/* ---------- синхронизация (Supabase) ---------- */
let syncState = 'off', paidSet = new Set(), syncT = null;
async function rpc(fn, args) {
  const r = await fetch(SB.url + '/rest/v1/rpc/' + fn, { method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: SB.key, Authorization: 'Bearer ' + SB.key }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}
function snapshot() { const d = Object.assign({}, S); delete d.session; return d; }
function queueSync() { clearTimeout(syncT); syncT = setTimeout(push, 3000); }
async function push() { clearTimeout(syncT); try { await rpc('nm_put', { p_k: S.kid, p_d: snapshot() }); syncState = 'ok'; } catch (e) { syncState = 'err'; } }
async function pull() {
  try {
    const r = await rpc('nm_get', { p_k: S.kid }); syncState = 'ok';
    paidSet = new Set((r && r.paid) || []);
    if (r && r.d && (r.d.ts || 0) > (S.ts || 0)) { const ses = S.session; S = Object.assign(fresh(), r.d); S.session = ses; saveLocal(); }
    else if (!r || !r.d || (r.d.ts || 0) < (S.ts || 0)) push();
    if (view !== 'session') render();
  } catch (e) { syncState = 'err'; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(); else pull(); });
const parentLink = () => location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/') + 'parent.html#k=' + S.kid;

/* ---------- рендер ---------- */
const app = document.getElementById('app');
const sheet = document.createElement('div'); sheet.id = 'sheet'; document.body.appendChild(sheet);
const pop = document.createElement('div'); pop.id = 'pop'; document.body.appendChild(pop);
let view = 'home', viewArg = null, ui = {};
function go(v, arg) { view = v; viewArg = arg; ui = {}; closeSheet(); render(); window.scrollTo(0, 0); }
function render() { app.innerHTML = (VIEWS[view] || VIEWS.home)(viewArg); afterRender(); }
function afterRender() {
  if (view === 'home' && ui.scrollCur) { ui.scrollCur = false; const n = app.querySelector('.node.current'); if (n) n.scrollIntoView({ block: 'center' }); }
  showPops();
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dot = id => `<i class="dot ${status(id)}"></i>`;
const coin = (cls = '') => `<svg class="coin ${cls}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><circle cx="12" cy="12" r="7" class="ci"/><path d="M12 8.2l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" class="cs"/></svg>`;
const mascot = (sz = 64, mood = '') => `<svg class="pi ${mood}" width="${sz}" height="${sz}" viewBox="0 0 64 64" aria-hidden="true">
  <ellipse cx="32" cy="60" rx="15" ry="2.6" class="pi-sh"/>
  <path d="M32 8V3" class="pi-ant"/><circle cx="32" cy="3.4" r="3.2" class="pi-bulb"/>
  <path d="M32 8c14 0 23 10 23 25 0 14-9 23-23 23S9 47 9 33C9 18 18 8 32 8z" class="pi-body"/>
  <path d="M32 8c14 0 23 10 23 25 0 4-1 8-2 11C50 26 42 14 32 14S14 22 11 34c-1-1-2-3-2-1 0-15 9-25 23-25z" class="pi-glow"/>
  <ellipse cx="24.5" cy="31" rx="4.2" ry="5.6" class="pi-eye"/><ellipse cx="39.5" cy="31" rx="4.2" ry="5.6" class="pi-eye"/>
  <circle cx="26" cy="29" r="1.5" class="pi-shine"/><circle cx="41" cy="29" r="1.5" class="pi-shine"/>
  <circle cx="17.5" cy="39.5" r="3.2" class="pi-blush"/><circle cx="46.5" cy="39.5" r="3.2" class="pi-blush"/>
  <path d="M27.5 40.5q4.5 4 9 0" class="pi-mouth"/>
  <text x="32" y="53" class="pi-pi">π</text></svg>`;
const I = n => `<svg viewBox="0 0 24 24" class="i">${({
  back: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  fire: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  path: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  redo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2M11 12h2v3h-2z"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
})[n] || ''}</svg>`;
const GLYPH = { base: '½', alg: '𝑥', geo: '△', prob: '%' };

const VIEWS = {};
function nav(active) {
  const t = [['home', 'path', 'Путь'], ['topics', 'book', 'Темы'], ['rewards', 'gift', 'Награды'], ['progress', 'chart', 'Прогресс']];
  return `<nav class="nav">${t.map(([v, ic, l]) => `<button class="${active === v ? 'on' : ''}" data-act="go" data-v="${v}">${I(ic)}<span>${l}</span></button>`).join('')}</nav>`;
}

/* ----- первый запуск ----- */
VIEWS.setup = () => {
  const sel = (b, cur) => byBlock(b).map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
  const sc = school();
  return `<div class="wrap">
  <div class="setup-hero">${mascot(96, 'bounce')}<h1>Nika<span class="dotm">.math</span></h1><p>Привет! Я Пи. Буду помогать с математикой: 50 задач в день, разбор каждой ошибки, а за верные ответы — баллы, которые меняются на деньги.</p></div>
  <div class="card"><h3 class="hq">Что сейчас проходите в школе?</h3><p class="muted">От этого зависит, какие темы попадут в тренировку. Можно поменять в настройках.</p>
    <label class="fld"><span>Алгебра</span><select id="s-alg">${sel('alg', sc.alg)}</select></label>
    <label class="fld"><span>Геометрия</span><select id="s-geo">${sel('geo', sc.geo)}</select></label>
  </div>
  <button class="btn primary big" data-act="setup-save">Поехали</button></div>`;
};

/* ----- главная: путь ----- */
VIEWS.home = () => {
  if (!S.school) return VIEWS.setup();
  const d = S.days[today()] || { n: 0, c: 0 }, pct = Math.min(1, d.n / GOAL), R0 = 46, C = 2 * Math.PI * R0;
  const ses = S.session && !S.session.done && S.session.i < S.session.queue.length ? S.session : null;
  const lv = level(), str = streak(), errs = errorSkills();
  const tIn = s => s.queue.filter(x => x.t === 'task').length, dIn = s => s.queue.slice(0, s.i).filter(x => x.t === 'task').length;
  const names = { daily: 'тренировку дня', diag: 'входной тест', path: 'урок', control: 'контрольную', unit: 'контрольную раздела' };
  let main;
  if (ses && ses.date === today()) main = `<button class="btn primary big" data-act="resume">Продолжить ${names[ses.kind] || 'тренировку'} · ${dIn(ses)}/${tIn(ses)}</button>`;
  else if (!S.diag) main = `<button class="btn primary big" data-act="diag">Пройти входной тест</button>`;
  else if (d.n >= GOAL) main = `<button class="btn primary big" data-act="daily-more">Норма выполнена! Ещё 20 задач</button>`;
  else main = `<button class="btn primary big" data-act="daily">Тренировка дня</button>`;
  return `<div class="wrap with-nav">
  <header class="hbar">
    <button class="me" data-act="go" data-v="rewards">${mascot(40)}<span><b>${NAME}</b><small>${lv.name} · ур. ${lv.i + 1}</small></span></button>
    <div class="hchips"><span class="hc fire ${str ? 'on' : ''}">${I('fire')}<b>${str}</b></span><button class="hc gold" data-act="go" data-v="rewards">${coin()}<b>${fmtN(S.coins)}</b></button></div>
  </header>
  <section class="daily">
    <div class="ring sm"><svg viewBox="0 0 108 108"><circle cx="54" cy="54" r="${R0}" class="rbg"/><circle cx="54" cy="54" r="${R0}" class="rfg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><div class="rin"><b>${d.n}</b><span>из ${GOAL}</span></div></div>
    <div class="dtext"><b>${d.n >= GOAL ? 'Норма дня выполнена' : 'Цель дня — 50 задач'}</b><span>${d.n ? `верно ${Math.round(100 * d.c / d.n)}% · ` : ''}${d.n >= GOAL ? 'можно отдыхать или копить баллы' : `ещё ${GOAL - d.n} до бонуса`}</span></div>
  </section>
  ${main}
  <div class="quick">
    <button data-act="go" data-v="control">${I('clock')}<span>Контрольная</span></button>
    <button data-act="errors" ${errs.length ? '' : 'disabled'}>${I('redo')}<span>Ошибки${errs.length ? ` · ${errs.length}` : ''}</span></button>
    <button data-act="chat">${I('chat')}<span>Спросить Пи</span></button>
  </div>
  ${pathHTML()}
  </div>${nav('home')}`;
};
function pathHTML() {
  if (!S.diag) return `<div class="path-empty card">${mascot(84, 'bounce')}<h3 class="hq">Здесь будет твой путь</h3><p class="muted">Пройди входной тест: я найду пробелы и выстрою темы по порядку — от самых важных к следующим. Как уровни в игре.</p><button class="btn primary" data-act="diag">Пройти тест · ≈30 задач</button></div>`;
  const { items, current } = pathItems(), OFF = [0, 52, 78, 52, 0, -52, -78, -52];
  let k = 0, h = '<div class="path">';
  const say = id => ({ gap: 'Тут был пробел — закроем вместе!', new: 'Новая тема. Сначала покажу, как решать.', learn: 'Почти освоено, добьём!' })[status(id)] || 'Вперёд!';
  for (const it of items) {
    if (it.t === 'unit') {
      k = 0; const ids = it.u.skills, dn = ids.filter(passed).length;
      h += `<div class="ubox" style="--c:${it.u.color}"><div><small>Раздел ${UNITS.indexOf(it.u) + 1}</small><b>${it.u.title}</b><span>${it.u.sub}</span></div><div class="ubar"><i style="width:${100 * dn / ids.length}%"></i><em>${dn}/${ids.length}</em></div></div>`;
      continue;
    }
    const off = OFF[k++ % OFF.length], st0 = it.state;
    if (it.t === 'node') {
      const m = mastery(it.id), R = 41, Cc = 2 * Math.PI * R, isCur = st0 === 'current';
      const ring = st0 !== 'done' && m > 0 ? `<svg class="nring" viewBox="0 0 92 92"><circle cx="46" cy="46" r="${R}" class="nr-bg"/><circle cx="46" cy="46" r="${R}" class="nr-fg" stroke-dasharray="${Cc}" stroke-dashoffset="${Cc * (1 - m)}"/></svg>` : '';
      h += `<div class="prow" style="--x:${off}px;--c:${it.u.color}">
        ${isCur ? `<div class="bubble">${say(it.id)}</div>` : ''}
        <div class="nwrap">${ring}${st0 === 'done' && status(it.id) !== 'ok' ? `<span class="stale" title="Пора повторить">${I('redo')}</span>` : ''}<button class="node ${st0} ${status(it.id)}" data-act="node" data-id="${it.id}">${st0 === 'done' ? I('check') : st0 === 'locked' ? `<span class="g">${GLYPH[SK[it.id].block]}</span>` : `<span class="g">${GLYPH[SK[it.id].block]}</span>`}</button>
        ${isCur ? `<div class="mascot-side ${off >= 0 ? 'left' : 'right'}">${mascot(58, 'bounce')}</div>` : ''}</div>
        <div class="nlabel ${st0}">${esc(SK[it.id].title)}</div></div>`;
    } else if (it.t === 'chest') {
      h += `<div class="prow" style="--x:${off}px;--c:${it.u.color}"><button class="chest ${st0}" data-act="chest" data-k="${it.key}">${I('chest')}</button>${st0 === 'open' ? '<div class="nlabel open">Сундук! Открой</div>' : ''}</div>`;
    } else {
      h += `<div class="prow" style="--x:0px;--c:${it.u.color}"><button class="trophy ${st0}" data-act="trophy" data-u="${it.u.id}">${I('trophy')}</button><div class="nlabel ${st0}">${st0 === 'done' ? 'Раздел сдан' : 'Контрольная раздела'}</div></div>`;
    }
  }
  return h + `<div class="path-end">${I('star')}<span>Финиш 7 класса</span></div></div>`;
}

/* ----- карточки-листы (bottom sheet) ----- */
function openSheet(html, cls) { sheet.innerHTML = `<div class="sh-bg" data-sact="close"></div><div class="sh ${cls || ''}"><div class="sh-grip"></div>${html}</div>`; sheet.className = 'open'; }
function closeSheet() { sheet.className = ''; sheet.innerHTML = ''; chatOpen = false; }
function nodeSheet(id) {
  const s = SK[id], it = pathItems().items.find(x => x.t === 'node' && x.id === id), m = Math.round(100 * mastery(id));
  if (it.state === 'locked') return openSheet(`<div class="sh-c">${I('lock')}<h3 class="hq">${esc(s.title)}</h3><p class="muted">Откроется, когда освоишь темы перед ней. Потренироваться можно уже сейчас — в разделе «Темы».</p><button class="btn ghost big" data-sact="topic" data-id="${id}">Открыть тему</button></div>`);
  openSheet(`<div class="sh-c"><span class="chip">${BL[s.block].title}</span><h2>${esc(s.title)}</h2>
    <div class="mbar"><i style="width:${m}%"></i></div><p class="muted">${it.state === 'done' ? (status(id) === 'ok' ? 'Тема освоена. Можно повторить и заработать ещё баллов.' : 'Тема пройдена, но в последних задачах были ошибки. Пора повторить — точка на пути останется пройденной.') : `Освоено на ${m}%. Чтобы пройти тему, нужно 85% верных ответов.`}</p>
    <button class="btn primary big" data-sact="path-start" data-id="${id}">${it.state === 'done' ? 'Повторить' : 'Начать урок'} · 15 задач</button>
    <button class="btn ghost big" data-sact="topic" data-id="${id}">Теория и пример</button></div>`);
}

/* ----- сессия ----- */
const tasksTotal = s => s.queue.filter(x => x.t === 'task').length;
const tasksDone = s => s.queue.slice(0, s.i).filter(x => x.t === 'task').length;
const mmss = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m + ':' + String(s).padStart(2, '0'); };
VIEWS.session = () => {
  const s = S.session;
  if (!s || s.done || s.i >= s.queue.length) return VIEWS.summary();
  const it = s.queue[s.i], tot = tasksTotal(s), dn = tasksDone(s), exam = isExam(s);
  const head = `<header class="shead"><button class="ibtn" data-act="home" aria-label="На главную">${I('close')}</button>
    <div class="bar"><i style="width:${100 * dn / Math.max(1, tot)}%"></i></div>
    ${exam ? `<span class="timer" id="tmr">${I('clock')}${mmss(s.endAt - Date.now())}</span>` : `<span class="cnt">${dn}/${tot}</span>`}</header>`;
  if (it.t === 'lesson') {
    const sk = SK[it.sk], exP = make(it.sk, 1);
    return `<div class="wrap">${head}<div class="pi-say">${mascot(52)}<div>${status(it.sk) === 'gap' ? 'Эту тему подтянем. Сначала коротко правило и пример — потом задачи.' : 'Новая тема! Читай правило и смотри, как решается пример.'}</div></div>
      <div class="card lesson"><span class="chip">${BL[sk.block].title}</span><h2>${esc(sk.title)}</h2>
      <div class="theory">${sk.th}</div><div class="easy"><b>Проще говоря.</b> ${EASY[it.sk] || ''}</div>
      <div class="worked"><div class="wk-h">Разбор на примере</div><div class="q">${exP.q}</div>${exP.fig || ''}
      <ol class="steps">${exP.steps.map(x => `<li>${x}</li>`).join('')}</ol></div></div>
      <button class="btn primary big" data-act="next">Понятно, решаю</button></div>`;
  }
  const p = it.p, sk = SK[p.sk], st0 = ui.state || 'ask';
  const stars = '★'.repeat(p.lv) + '<span class="off">' + '★'.repeat(3 - p.lv) + '</span>';
  const combo = !exam && s.combo >= 3 ? `<span class="chip combo">${I('fire')}${s.combo} подряд</span>` : '';
  let body = `<div class="card task"><div class="tmeta"><span class="chip">${BL[sk.block].short}</span><span class="tname">${esc(sk.title)}</span>${combo}<span class="stars">${stars}</span>${it.retry ? '<span class="chip warn">повтор</span>' : ''}</div>
    <div class="q">${p.q}</div>${p.note ? `<div class="note">${p.note}</div>` : ''}${p.fig || ''}
    ${ui.hint && !exam ? `<div class="hint"><b>Подсказка.</b> ${p.hint}</div>` : ''}</div>`;
  if (st0 === 'ask') {
    if (p.kind === 'choice') body += `<div class="opts">${p.opts.map((o, i) => `<button class="opt" data-act="pick" data-i="${i}">${o.t}</button>`).join('')}</div>`;
    else {
      const labels = p.labels || ['']; ui.inp = ui.inp || labels.map(() => ''); ui.act = ui.act || 0;
      body += `<div class="inputs">${labels.map((l, i) => `<button class="inbox ${i === ui.act ? 'on' : ''}" data-act="focus" data-i="${i}">${l ? `<i>${l}</i> =` : 'Ответ:'} <span class="val">${esc(ui.inp[i].replace(/-/g, '−')) || '<span class="ph">…</span>'}</span>${p.unit ? `<span class="unit">${p.unit}</span>` : ''}</button>`).join('')}</div>` + keypad(exam);
    }
    body += exam ? `<div class="row2"><button class="btn ghost" data-act="skip">Пропустить</button></div>`
      : `<div class="row2"><button class="btn ghost" data-act="chat">${I('chat')}Спросить Пи</button><button class="btn ghost" data-act="giveup">Не знаю</button></div>`;
  } else body += feedback(p);
  return `<div class="wrap">${head}${body}</div>`;
};
function keypad(exam) {
  const K = ['7', '8', '9', 'del', '4', '5', '6', '/', '1', '2', '3', '-', '0', ',', 'ok'];
  const lab = { del: '⌫', '-': '−', ok: exam ? 'Ответить' : 'Проверить' };
  return `<div class="kpad">${K.map(k => `<button class="k ${k === 'ok' ? 'kok' : ''} ${['del', '/', '-'].includes(k) ? 'kf' : ''}" data-act="key" data-k="${k}">${lab[k] || k}</button>`).join('')}</div>`;
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function feedback(p) {
  const r = ui.result, good = r.score > 0;
  let h = `<div class="fb ${good ? 'good' : 'bad'}"><div class="fb-top"><div class="fb-h">${good ? (r.score === 1 ? pick(['Верно!', 'Точно!', 'Отлично!', 'Да, правильно!', 'Так держать!']) : 'Верно, но…') : r.gave ? 'Разбор решения' : 'Неверно'}</div>${r.got ? `<span class="plus">+${r.got} ${coin()}</span>` : ''}</div>`;
  if (r.note) h += `<p class="fb-note">${r.note}</p>`;
  if (!good && r.your) h += `<p>Твой ответ: <b class="strike">${r.your}</b></p>`;
  if (!good || r.score < 1) h += `<p>Правильный ответ: <b class="ans">${p.ansText}</b>${p.unit && p.kind === 'num' ? p.unit : ''}</p>`;
  if (r.why) h += `<div class="why"><b>Где ошибка.</b> ${r.why}</div>`;
  h += (!good || ui.showSteps) ? `<ol class="steps">${p.steps.map(x => `<li>${x}</li>`).join('')}</ol>` : `<button class="link" data-act="steps">Посмотреть решение</button>`;
  h += `</div><div class="row2 fbrow">${!good ? `<button class="btn ghost" data-act="chat">${I('chat')}Объясни, Пи</button>` : ''}<button class="btn primary big" data-act="next">${S.session.i + 1 >= S.session.queue.length ? 'Завершить' : 'Дальше'}</button></div>`;
  if (!good && S.session.kind !== 'diag') h += `<p class="muted center small">Похожая задача придёт через пару шагов — закрепим.</p>`;
  return h;
}
function parseVal(s) {
  s = String(s).replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, ' ').trim(); if (!s) return null;
  let m;
  if ((m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/))) { if (+m[4] === 0) return null; const v = +m[2] + m[3] / m[4]; return { v: m[1] ? -v : v, fr: [+m[3], +m[4]] }; }
  if ((m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/))) { if (+m[2] === 0) return null; return { v: +m[1] / +m[2], fr: [+m[1], +m[2]] }; }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return { v: +s };
  return null;
}
function check() {
  const it = S.session.queue[S.session.i], p = it.p, vals = ui.inp.map(parseVal);
  if (vals.some(v => !v)) { const c = app.querySelector('.task'); if (c) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); } toast(vals.every(v => !v) ? 'Введи ответ' : 'Не получилось прочитать число'); return; }
  const okAll = vals.every((v, i) => Math.abs(v.v - p.ans[i][0] / p.ans[i][1]) < 1e-9);
  let score = okAll ? (ui.hint ? 0.5 : 1) : 0, note = '', why = '';
  if (okAll) {
    const fr = vals.find(v => v.fr && Number.isInteger(v.fr[0]) && Number.isInteger(v.fr[1]) && gcd(v.fr[0], v.fr[1]) > 1);
    if (fr) { score = Math.min(score, 0.5); note = 'Ответ верный, но дробь можно сократить. В школе за несокращённую дробь снимут балл.'; }
    if (ui.hint && !note) note = 'С подсказкой засчитывается наполовину, баллы не начисляются. В следующий раз попробуй без неё.';
  } else { const t = (p.traps || []).find(t => Math.abs(t.v - vals[0].v) < 1e-9); if (t) why = t.why; }
  finish(score, { your: ui.inp.map(s => s.replace(/-/g, '−')).join('; '), note, why });
}
function finish(score, extra) {
  const s = S.session, it = s.queue[s.i], p = it.p;
  record(p.sk, score); s.res.push({ sk: p.sk, score });
  if (isExam(s)) { it.ans = { your: extra.your || '—', score }; save(); return nextItem(); }
  let got = 0;
  if (score === 1) {
    s.combo = (s.combo || 0) + 1; S.bestCombo = Math.max(S.bestCombo || 0, s.combo);
    got += award(p.lv, 'Верные ответы');
    if (s.combo % 10 === 0) { const g = award(10, `${s.combo} верных подряд`); got += g; popQueue.push({ kind: 'combo', n: s.combo, coins: g }); }
  } else s.combo = 0;
  checkMastery(p.sk); checkDay(); checkAch();
  if (score === 0 && s.kind !== 'diag' && !it.retry) s.queue.splice(Math.min(s.i + 4, s.queue.length), 0, task(p.sk, p.lv, { retry: true }));
  ui.state = 'done'; ui.result = Object.assign({ score, got }, extra); save(); render();
}
function nextItem() {
  const s = S.session; s.i++; save();
  if (s.i >= s.queue.length) endSession();
  ui = {}; closeSheet(); render(); window.scrollTo(0, 0);
}
function gradeOf(pct) { return pct >= 90 ? 5 : pct >= 70 ? 4 : pct >= 50 ? 3 : 2; }
function endSession() {
  const s = S.session; if (s.done) return;
  scheduleDue(s.res.map(r => r.sk));
  if (s.kind === 'diag') S.diag = true;
  if (isExam(s)) {
    const n = tasksTotal(s), c = s.res.reduce((a, r) => a + r.score, 0); s.pct = Math.round(100 * c / n); s.grade = gradeOf(s.pct);
    S.controls.push({ d: today(), k: s.kind, b: s.block || s.unit, pct: s.pct, grade: s.grade });
    if (s.kind === 'control') { const key = today() + s.block; if (!S.ctrlPaid[key]) { S.ctrlPaid[key] = 1; award({ 5: 100, 4: 50, 3: 10 }[s.grade] || 0, 'Контрольная: ' + s.grade); } }
    if (s.kind === 'unit' && s.pct >= 80 && !S.unitDone[s.unit]) { S.unitDone[s.unit] = today(); award(100, 'Раздел сдан'); }
  }
  s.done = true; checkAch(); S.best = Math.max(S.best || 0, streak()); save(); push();
}
function timeUp() {
  const s = S.session; if (!s || !isExam(s) || s.done) return;
  for (let i = s.i; i < s.queue.length; i++) { const it = s.queue[i]; if (it.t !== 'task') continue; record(it.p.sk, 0); s.res.push({ sk: it.p.sk, score: 0 }); it.ans = { your: '—', score: 0 }; }
  s.i = s.queue.length; endSession(); ui = {}; toast('Время вышло'); render();
}
setInterval(() => {
  const s = S.session; if (!s || !isExam(s) || s.done) return;
  if (Date.now() >= s.endAt) return timeUp();
  const el = document.getElementById('tmr'); if (el) { el.lastChild.textContent = mmss(s.endAt - Date.now()); el.classList.toggle('low', s.endAt - Date.now() < 300000); }
}, 1000);

/* ----- итоги ----- */
function confetti() { return `<div class="confetti">${Array.from({ length: 28 }, (_, i) => `<i style="--l:${Math.random() * 100}%;--d:${(Math.random() * 1.2).toFixed(2)}s;--r:${Math.floor(Math.random() * 360)}deg;--c:${['#A78BFA', '#C4B5FD', '#8B5CF6', '#E879F9', '#F5D27A', '#fff'][i % 6]}"></i>`).join('')}</div>`; }
VIEWS.summary = () => {
  const s = S.session; if (!s) return VIEWS.home();
  if (isExam(s)) return examSummary(s);
  const n = s.res.length, c = s.res.reduce((a, r) => a + r.score, 0), pct = n ? Math.round(100 * c / n) : 0;
  const by = {}; s.res.forEach(r => { (by[r.sk] = by[r.sk] || { n: 0, c: 0 }); by[r.sk].n++; by[r.sk].c += r.score; });
  const rows = Object.entries(by).sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n).map(([id, v]) =>
    `<div class="srow">${dot(id)}<span>${esc(SK[id].title)}</span><b>${Math.round(100 * v.c / v.n)}%</b><small>${v.c % 1 ? v.c.toFixed(1) : v.c}/${v.n}</small></div>`).join('');
  let title = s.kind === 'diag' ? 'Входной тест пройден' : s.kind === 'daily' ? 'Тренировка дня готова!' : 'Готово!';
  let msg = pct >= 85 ? 'Это уровень пятёрки. Так держать!' : pct >= 65 ? 'Хорошо! Ошибки показывают, что подтянуть.' : 'Ничего страшного. Теперь видно, где пробелы, — их и закроем.';
  if (s.kind === 'path') { const ok = passed(s.sk); title = ok ? 'Тема освоена!' : 'Урок пройден'; msg = ok ? `«${SK[s.sk].title}» — готово. Следующая точка на пути открыта.` : `Освоено на ${Math.round(100 * mastery(s.sk))}%. Ещё урок — и тема будет пройдена.`; }
  const diagBox = s.kind === 'diag' ? `<div class="card"><h3>Что нашли</h3>${['gap', 'learn'].map(k => {
    const ids = [...new Set(s.res.map(r => r.sk))].filter(id => status(id) === k);
    return ids.length ? `<p><b>${k === 'gap' ? 'Пробелы' : 'Почти освоено'}:</b> ${ids.map(id => esc(SK[id].title)).join(', ')}</p>` : '';
  }).join('')}<p class="muted">Я выстроил путь: начнём с первого пробела и пойдём по темам по порядку.</p></div>` : '';
  return `<div class="wrap">${pct >= 70 ? confetti() : ''}<div class="sum-hero">${mascot(88, pct >= 70 ? 'jump' : '')}<div class="big-pct">${pct}%</div><h2>${title}</h2><p>${msg}</p>
    <div class="sum-chips"><span>${n} ${plural(n, 'задача', 'задачи', 'задач')}</span>${s.got ? `<span class="gold">+${s.got} ${coin()}</span>` : ''}${s.combo >= 5 ? `<span>${I('fire')} серия ${s.combo}</span>` : ''}</div></div>
    ${diagBox}<div class="card"><h3>По темам</h3>${rows}</div>
    <button class="btn primary big" data-act="${s.kind === 'diag' ? 'see-path' : 'home'}">${s.kind === 'diag' ? 'Смотреть мой путь' : 'На главную'}</button></div>`;
};
function examSummary(s) {
  const g = s.grade, items = s.queue.filter(x => x.t === 'task');
  const title = s.kind === 'unit' ? (s.pct >= 80 ? 'Раздел сдан!' : 'Раздел пока не сдан') : 'Оценка за контрольную';
  const msg = s.kind === 'unit' ? (s.pct >= 80 ? 'Следующий раздел пути открыт.' : 'Нужно 80% верных. Повтори темы с ошибками и попробуй снова.')
    : { 5: 'Пятёрка! Именно так это и выглядит в школе.', 4: 'Четвёрка. До пятёрки совсем чуть-чуть — разбери ошибки ниже.', 3: 'Тройка. Разбери ошибки и потренируй эти темы.', 2: 'Пока двойка. Не страшно: смотри, где ошибки, и тренируй эти темы.' }[g];
  return `<div class="wrap">${g >= 4 ? confetti() : ''}<div class="sum-hero">${mascot(80, g >= 4 ? 'jump' : '')}<div class="grade g${g}">${g}</div><h2>${title}</h2><p>${msg}</p>
    <div class="sum-chips"><span>${s.pct}% верно</span>${s.got ? `<span class="gold">+${s.got} ${coin()}</span>` : ''}</div></div>
    <div class="card"><h3>Разбор заданий</h3>${items.map((it, i) => `<div class="xrow ${it.ans && it.ans.score ? 'ok' : 'bad'}"><button class="xh" data-act="xopen" data-i="${i}"><span class="xn">${i + 1}</span><span>${esc(SK[it.p.sk].title)}</span>${it.ans && it.ans.score ? I('check') : I('close')}</button>
      ${ui.open === i ? `<div class="xb"><div class="q">${it.p.q}</div>${it.p.fig || ''}<p>Твой ответ: <b>${it.ans ? it.ans.your : '—'}</b></p><p>Правильный: <b class="ans">${it.p.ansText}</b></p><ol class="steps">${it.p.steps.map(x => `<li>${x}</li>`).join('')}</ol></div>` : ''}</div>`).join('')}</div>
    <button class="btn primary big" data-act="home">На главную</button></div>`;
}

/* ----- контрольная ----- */
VIEWS.control = () => {
  const sc = school(), last = b => S.controls.filter(c => c.k === 'control' && c.b === b).slice(-1)[0];
  const card = b => { const l = last(b); return `<button class="ctrl" data-act="ctrl-start" data-b="${b}"><span class="ti">${b === 'alg' ? '𝑥' : '△'}</span><span><b>${BL[b].short}</b><small>${esc(SK[sc[b]].title)} и прошлые темы</small></span>${l ? `<span class="grade sm g${l.grade}">${l.grade}</span>` : ''}</button>`; };
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="home">${I('back')}</button><h2>Контрольная</h2><span></span></header>
  <div class="pi-say">${mascot(56)}<div>Как в школе: 10 заданий, 40 минут, без подсказок. Ответы и оценка — в конце. Лучше писать раз в неделю, перед школьной контрольной.</div></div>
  ${card('alg')}${card('geo')}
  <div class="card"><h3>Оценки</h3><div class="gr-rules"><span><b class="g5">5</b>90%+</span><span><b class="g4">4</b>70%+</span><span><b class="g3">3</b>50%+</span><span><b class="g2">2</b>меньше</span></div>
  <p class="muted small">За первую контрольную в день по предмету: «5» — 100 баллов, «4» — 50, «3» — 10.</p></div>
  ${S.controls.length ? `<div class="card"><h3>История</h3>${S.controls.slice(-8).reverse().map(c => `<div class="srow"><span>${ruDate(c.d)} · ${c.k === 'unit' ? 'раздел' : BL[c.b] ? BL[c.b].short : ''}</span><b>${c.pct}%</b><span class="grade sm g${c.grade}">${c.grade}</span></div>`).join('')}</div>` : ''}
  </div>`;
};

/* ----- награды ----- */
VIEWS.rewards = () => {
  const lv = level(), m = monthKey(), em = S.earned[m] || 0, stt = achStats();
  const reqs = S.withdraw.slice().reverse();
  return `<div class="wrap with-nav"><header class="top"><h2>Награды</h2><button class="ibtn" data-act="go" data-v="settings">${I('gear')}</button></header>
  <section class="wallet">${coin('big')}<div><small>Мои баллы</small><b>${fmtN(S.coins)}</b><span>= ${fmtN(S.coins * RATE)} ₽</span></div></section>
  <div class="card"><div class="mrow"><span>Заработано в ${monthName()}</span><b>${fmtN(em)} / ${fmtN(CAP)}</b></div><div class="mbar gold"><i style="width:${100 * em / CAP}%"></i></div>
    ${em >= CAP ? '<p class="muted small">Лимит месяца набран. Опыт и уровни продолжают расти.</p>' : ''}
    <button class="btn primary big" data-act="withdraw" ${S.coins < MIN_OUT ? 'disabled' : ''}>Обменять на деньги</button>
    <p class="muted small center">${S.coins < MIN_OUT ? `Обмен от ${MIN_OUT} баллов. Осталось ${MIN_OUT - S.coins}.` : 'Запрос уйдёт Вике, она переведёт деньги.'}</p>
    ${reqs.length ? reqs.map(r => `<div class="srow"><span>${ruDate(r.d)}</span><b>${fmtN(r.amt)} ₽</b><span class="chip ${paidSet.has(r.id) ? 'okc' : 'warn'}">${paidSet.has(r.id) ? 'выплачено' : 'ждёт'}</span></div>`).join('') : ''}</div>
  <div class="card lvl"><div class="mrow"><span>${mascot(44)}<span><b>${lv.name}</b><small>Уровень ${lv.i + 1} · ${fmtN(S.xp)} опыта</small></span></span><small>${LEVELS[lv.i + 1] ? 'до «' + LEVELS[lv.i + 1][1] + '» ' + fmtN(lv.nxt - S.xp) : 'максимум!'}</small></div><div class="mbar"><i style="width:${100 * lv.pct}%"></i></div></div>
  <div class="card"><h3>Как заработать</h3><div class="earn">
    <div><b>+1…3</b><span>верный ответ с первой попытки (★ / ★★ / ★★★)</span></div>
    <div><b>+10</b><span>каждые 10 верных подряд</span></div>
    <div><b>+20</b><span>норма дня (50 задач, точность от 70%)</span></div>
    <div><b>+50</b><span>тема освоена на пути</span></div>
    <div><b>+30</b><span>сундук на пути</span></div>
    <div><b>+100</b><span>контрольная раздела сдана</span></div>
    <div><b>+10…100</b><span>контрольная на 3, 4 или 5</span></div>
    <div><b>0</b><span>за ответ с подсказкой и за ошибку</span></div></div></div>
  <div class="card"><h3>Достижения · ${Object.keys(S.ach).length}/${ACH.length}</h3><div class="achs">${ACH.map(([id, t, d, r]) => `<div class="ach ${S.ach[id] ? 'on' : ''}"><span class="ai">${S.ach[id] ? I('star') : I('lock')}</span><b>${t}</b><small>${d}</small><em>+${r}</em></div>`).join('')}</div></div>
  ${S.ledger.length ? `<div class="card"><h3>История</h3>${S.ledger.slice(0, 12).map(l => `<div class="srow"><span>${esc(l.w)}</span><small>${ruDate(l.d)}</small><b class="${l.n < 0 ? '' : 'gold-t'}">${l.n > 0 ? '+' : ''}${l.n}</b></div>`).join('')}</div>` : ''}
  </div>${nav('rewards')}`;
};

/* ----- темы ----- */
VIEWS.topics = () => {
  const pw = new Set(pathway());
  return `<div class="wrap with-nav"><header class="top"><h2>Темы и теория</h2><span></span></header>
  ${BLOCKS.map(b => `<div class="blk-h"><b>${b.title}</b><small>${b.note}</small></div><div class="blk">
    ${byBlock(b.id).map(s => `<button class="trow" data-act="go" data-v="skill" data-a="${s.id}">${dot(s.id)}<span>${esc(s.title)}${pw.has(s.id) ? '' : ' <small class="muted">· впереди</small>'}</span><b>${acc(s.id) == null ? '' : acc(s.id) + '%'}</b></button>`).join('')}</div>`).join('')}
  <div class="legend"><span><i class="dot gap"></i>пробел</span><span><i class="dot learn"></i>в процессе</span><span><i class="dot ok"></i>освоено</span><span><i class="dot new"></i>не начато</span></div></div>${nav('topics')}`;
};
VIEWS.skill = id => {
  const s = SK[id], exP = ui.ex || (ui.ex = make(id, ui.exLv || 1)), lv = levelOf(id);
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="go" data-v="topics">${I('back')}</button><span class="chip">${BL[s.block].title}</span><span></span></header>
  <div class="card lesson"><h2>${esc(s.title)}</h2><p class="muted">${dot(id)} ${STATUS_TXT[status(id)]}${acc(id) == null ? '' : ' · точность ' + acc(id) + '%'}</p>
  <div class="theory">${s.th}</div><div class="easy"><b>Проще говоря.</b> ${EASY[id] || ''}</div>
  <div class="worked"><div class="wk-h">Пример с решением <span class="seg">${[1, 2, 3].map(l => `<button data-act="exlv" data-l="${l}" class="${(ui.exLv || 1) === l ? 'on' : ''}">${'★'.repeat(l)}</button>`).join('')}</span></div>
  <div class="q">${exP.q}</div>${exP.fig || ''}<ol class="steps">${exP.steps.map(x => `<li>${x}</li>`).join('')}</ol>
  <button class="link" data-act="newex">Другой пример</button></div></div>
  <div class="card"><h3>Тренировка · 10 задач</h3><div class="lvls">${[1, 2, 3].map(l => `<button class="btn ${l === lv ? 'primary' : 'ghost'}" data-act="train" data-a="${id}" data-l="${l}">${'★'.repeat(l)}<small>${['база', 'средний', 'на пятёрку'][l - 1]}</small></button>`).join('')}</div></div></div>`;
};

/* ----- прогресс ----- */
VIEWS.progress = () => {
  const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(today(), -i));
  const mx = Math.max(Math.round(GOAL * 1.25), ...days.map(d => (S.days[d] || {}).n || 0)), str = streak();
  const bars = days.map(d => { const v = (S.days[d] || {}).n || 0; return `<div class="bcol"><div class="bv ${v >= GOAL ? 'full' : ''}" style="height:${100 * v / mx}%"></div><span>${+d.slice(8)}</span></div>`; }).join('');
  return `<div class="wrap with-nav"><header class="top"><h2>Прогресс</h2><button class="ibtn" data-act="go" data-v="settings">${I('gear')}</button></header>
  <div class="kpis"><div><b>${fmtN(totalTasks())}</b><span>задач всего</span></div><div><b>${str}</b><span>серия дней</span></div><div><b>${SKILLS.filter(s => status(s.id) === 'ok').length}/${SKILLS.length}</b><span>тем освоено</span></div></div>
  <div class="card"><h3>Последние 14 дней</h3><div class="bars"><div class="goal" style="bottom:${100 * GOAL / mx}%"><span>${GOAL}</span></div>${bars}</div></div>
  <div class="card"><h3>Карта тем</h3>${BLOCKS.map(b => `<div class="mapb"><small>${b.title}</small><div class="map">${byBlock(b.id).map(s => `<button class="cell ${status(s.id)}" data-act="go" data-v="skill" data-a="${s.id}"><span>${esc(s.title)}</span><b>${acc(s.id) == null ? '—' : acc(s.id) + '%'}</b></button>`).join('')}</div></div>`).join('')}
  <div class="legend"><span><i class="dot gap"></i>пробел</span><span><i class="dot learn"></i>в процессе</span><span><i class="dot ok"></i>освоено</span><span><i class="dot new"></i>не начато</span></div></div>
  <button class="btn ghost big" data-act="report">${I('send')}Отправить отчёт Вике</button></div>${nav('progress')}`;
};

/* ----- настройки ----- */
VIEWS.settings = () => {
  const sc = school(), sel = (b, cur) => byBlock(b).map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
  const sync = { ok: '<span class="chip okc">синхронизировано</span>', err: '<span class="chip warn">нет связи с сервером</span>', off: '<span class="chip">проверяю…</span>' }[syncState];
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="home">${I('back')}</button><h2>Настройки</h2><span></span></header>
  <div class="card"><h3>Тема в школе сейчас</h3><p class="muted">Меняй, когда в классе начинается новая тема — тренировка подстроится.</p>
  <label class="fld"><span>Алгебра</span><select id="s-alg">${sel('alg', sc.alg)}</select></label>
  <label class="fld"><span>Геометрия</span><select id="s-geo">${sel('geo', sc.geo)}</select></label>
  <button class="btn primary" data-act="setup-save">Сохранить</button></div>
  <div class="card"><h3>Сохранение в облаке</h3><p>${sync}</p><p class="muted small">Прогресс и баллы сохраняются на сервере. Если сменишь телефон, введи этот код на новом:</p>
  <div class="code">${S.kid.match(/.{1,4}/g).join(' ')}</div>
  <label class="fld"><span>Перенести с другого телефона</span><input id="s-code" placeholder="Код с другого устройства" autocomplete="off"></label>
  <button class="btn ghost" data-act="code-load">Загрузить прогресс</button></div>
  <div class="card"><h3>Для Вики</h3><p class="muted small">Ссылка на страницу прогресса — открывается у Вики на телефоне.</p><button class="btn ghost" data-act="parent-link">${I('send')}Отправить ссылку Вике</button></div>
  <div class="card"><h3>Входной тест</h3><p class="muted">Раз в месяц можно пройти заново и посмотреть рост.</p><button class="btn ghost" data-act="diag">Пройти входной тест</button></div>
  <div class="card"><h3>Сбросить прогресс</h3><p class="muted">Удалит статистику на этом телефоне.</p><button class="btn danger" data-act="reset">Сбросить</button></div></div>`;
};

/* ---------- помощник Пи (чат без ИИ) ---------- */
let chat = null, chatOpen = false;
const curTask = () => { const s = S.session; if (view !== 'session' || !s || s.done) return null; const it = s.queue[s.i]; return it && it.t === 'task' && !isExam(s) ? it : null; };
const pmsg = html => ({ from: 'pi', html }), mmsg = html => ({ from: 'me', html });
function chatChips() {
  const it = curTask();
  if (!it) return [['topics', 'Какие темы ты знаешь?'], ['motiv', 'Мне лень'], ['how', 'Как заработать баллы?']];
  if (ui.state === 'done') return [['why', 'Почему такой ответ?'], ['easy', 'Объясни проще'], ['mist', 'Частые ошибки'], ['example', 'Ещё пример']];
  return [['rule', 'Какое правило?'], ['easy', 'Объясни проще'], ['hint', 'Подсказка'], ['step', 'С чего начать?'], ['example', 'Похожий пример'], ['mist', 'Где обычно ошибаются?']];
}
function openChat() {
  const it = curTask(), key = it ? S.session.i + ':' + it.p.sk + ':' + (ui.state || 'ask') : 'free';
  if (!chat || chat.key !== key) {
    chat = { key, msgs: [] };
    chat.msgs.push(pmsg(it ? (ui.state === 'done' ? (ui.result.score ? 'Верно! Хочешь, разберём, почему так?' : 'Не вышло — бывает. Давай разберёмся, что тут происходит.') : `Тема «${esc(SK[it.p.sk].title)}». Чем помочь? Ответ сразу не скажу — но доведу до него.`)
      : 'Привет! Я Пи. Спроси про любую тему из учебника: «как складывать дроби», «что такое медиана», «формулы квадрата». Или выбери вопрос ниже.'));
  }
  chatOpen = true; renderChat();
}
function renderChat() {
  if (!chatOpen) return;
  openSheet(`<div class="chat"><div class="chat-h">${mascot(36)}<b>Пи</b><small>помощник</small><button class="ibtn sm" data-sact="close">${I('close')}</button></div>
    <div class="msgs">${chat.msgs.map(m => `<div class="msg ${m.from}">${m.html}</div>`).join('')}</div>
    <div class="chips">${chatChips().map(([a, l]) => `<button data-sact="ask" data-a="${a}">${l}</button>`).join('')}</div>
    <form class="cin" data-sact="form"><input id="cin" placeholder="Напиши вопрос…" autocomplete="off"><button class="send" type="submit">${I('send')}</button></form></div>`, 'tall');
  const m = sheet.querySelector('.msgs'); if (m) m.scrollTop = m.scrollHeight;
}
function useHint() {
  if (ui.state === 'done' || ui.hint) return '';
  ui.hint = true; render(); return '<p class="small muted">Подсказка взята: задача засчитается наполовину и без баллов.</p>';
}
function similarExample(sk, lv) { const e = make(sk, lv); return `<div class="cq">${e.q}</div>${e.fig || ''}<ol class="steps">${e.steps.map(x => `<li>${x}</li>`).join('')}</ol>`; }
function answerChip(a) {
  const it = curTask(), p = it && it.p, sk = p && p.sk;
  switch (a) {
    case 'rule': return `<b>Правило.</b> ${SK[sk].th}`;
    case 'easy': return EASY[sk];
    case 'hint': return useHint() + `<b>Подсказка.</b> ${p.hint}`;
    case 'step': return useHint() + `<b>Первый шаг.</b> ${p.steps[0]}`;
    case 'example': return (ui.state === 'done' ? '' : useHint()) + 'Вот похожая задача с решением:' + similarExample(sk, p.lv);
    case 'mist': {
      const w = [...new Set([...(p.traps || []).map(t => t.why), ...((p.opts || []).filter(o => !o.ok && o.why).map(o => o.why)), ...(MISTAKES[sk] || [])])].slice(0, 4);
      return `<b>Частые ошибки:</b><ul>${w.map(x => `<li>${x}</li>`).join('')}</ul>`;
    }
    case 'why': return `<ol class="steps">${p.steps.map(x => `<li>${x}</li>`).join('')}</ol>`;
    case 'topics': return 'Я знаю все темы 7 класса из твоих учебников и базу 5–6 класса: ' + BLOCKS.map(b => `<b>${b.short}</b>: ${byBlock(b.id).map(s => s.title.toLowerCase()).join(', ')}`).join('. ') + '.';
    case 'motiv': return pick(['Понимаю. Давай договоримся: всего 10 задач, а потом решишь, продолжать или нет. Обычно после десятой уже втягиваешься.', 'Лень — нормально. Но каждая задача — это минимум 1 балл, то есть 1 ₽. 50 задач — уже на кофе.', 'Серия дней сгорает, если пропустить день. Давай хотя бы норму — и свобода!']);
    case 'how': return 'Баллы дают за верные ответы с первой попытки: 1–3 в зависимости от сложности. Ещё бонусы за норму дня, серии, сундуки, освоенные темы и контрольные. Всё есть во вкладке «Награды». 1 балл = 1 ₽.';
  }
  return '';
}
function findSkill(t) {
  let best = null, bs = 0;
  for (const s of SKILLS) { let sc = 0; for (const k of KEYS[s.id] || []) { const parts = k.split(' '); if (parts.every(p => t.includes(p))) sc += k.length; } if (t.includes(s.title.toLowerCase())) sc += 30; if (sc > bs) { bs = sc; best = s.id; } }
  return best;
}
function answerText(raw) {
  const t = raw.toLowerCase().replace(/ё/g, 'е'), it = curTask();
  if (it) {
    if (/ответ|скажи|реши за/.test(t) && ui.state !== 'done') return 'Готовый ответ скажу после твоей попытки. Попробуй — а если совсем не идёт, нажми «Не знаю», и я разберу решение по шагам.';
    if (/подсказ/.test(t)) return answerChip('hint');
    if (/начать|первый шаг|с чего/.test(t)) return answerChip('step');
    if (/пример/.test(t)) return answerChip('example');
    if (/ошиб/.test(t)) return answerChip('mist');
    if (/почему|не понял|не понимаю|непонятно|проще|объясни/.test(t)) return answerChip(ui.state === 'done' && /почему/.test(t) ? 'why' : 'easy');
  }
  if (/лень|не хочу|устал|скучно/.test(t)) return answerChip('motiv');
  if (/балл|деньг|монет|заработ/.test(t)) return answerChip('how');
  if (/привет|здравств/.test(t)) return 'Привет! Спроси про любую тему — например, «как найти процент от числа».';
  const sk = findSkill(t);
  if (sk) return `<b>${esc(SK[sk].title)}</b>${SK[sk].th}<div class="easy"><b>Проще говоря.</b> ${EASY[sk]}</div>Пример с решением:${similarExample(sk, 1)}`;
  return 'Пока не понял вопрос. Я лучше всего понимаю вопросы про темы учебника: «как делить дроби», «что такое биссектриса», «как решать систему». Попробуй так.';
}
sheet.addEventListener('click', e => {
  const b = e.target.closest('[data-sact]'); if (!b) return;
  const a = b.dataset.sact;
  if (a === 'close') return closeSheet();
  if (a === 'ask') { const lab = b.textContent; chat.msgs.push(mmsg(esc(lab))); chat.msgs.push(pmsg(answerChip(b.dataset.a))); return renderChat(); }
  if (a === 'path-start') { closeSheet(); return startSession(buildPath(b.dataset.id)); }
  if (a === 'topic') { closeSheet(); ui = {}; view = 'skill'; viewArg = b.dataset.id; render(); return window.scrollTo(0, 0); }
  if (a === 'unit-start') { closeSheet(); const u = UNITS.find(x => x.id === b.dataset.u); return startSession(buildExam('unit', u.skills, 25, { unit: u.id })); }
  if (a === 'wd-confirm') {
    const amt = Math.floor(S.coins / 100) * 100; if (amt < MIN_OUT) return closeSheet();
    const r = { id: rid(8), d: today(), amt }; S.withdraw.push(r); S.coins -= amt; S.ledger.unshift({ d: today(), n: -amt, w: 'Обмен на деньги' });
    save(); push(); closeSheet(); render();
    const text = `Вика, запрос на выплату из Nika.math: ${amt} ₽ (${amt} баллов). Отметить выплату: ${parentLink()}`;
    if (navigator.share) navigator.share({ text }).catch(() => {}); else toast('Запрос отправлен Вике');
  }
});
sheet.addEventListener('submit', e => {
  e.preventDefault(); const inp = document.getElementById('cin'); const t = inp.value.trim(); if (!t) return;
  chat.msgs.push(mmsg(esc(t))); chat.msgs.push(pmsg(answerText(t))); renderChat(); const n = document.getElementById('cin'); if (n) n.focus();
});

/* ---------- всплывающие награды ---------- */
function showPops() {
  if (pop.className === 'open' || !popQueue.length || view === 'session' && ui.state !== 'done' && !(S.session && S.session.done)) return;
  const p = popQueue.shift();
  const t = { ach: ['Достижение!', p.title, p.desc], master: ['Тема освоена!', p.title, 'Точка на пути пройдена'], day: [p.good ? 'Норма дня!' : 'Норма выполнена', '50 задач решено', p.good ? `Точность ${p.acc}%` : `Точность ${p.acc}%: для полного бонуса нужно от 70%`],
    combo: [`${p.n} подряд!`, 'Без единой ошибки', 'Серия продолжается'], chest: ['Сундук открыт!', 'Награда за пройденные темы', 'Идём дальше по пути'] }[p.kind];
  pop.innerHTML = `<div class="pop-bg" data-pact="close"></div><div class="pop-card">${confetti()}${mascot(84, 'jump')}<small>${t[0]}</small><h2>${esc(t[1])}</h2><p>${t[2]}</p>${p.coins ? `<div class="pop-coins">+${p.coins} ${coin()}</div>` : ''}<button class="btn primary big" data-pact="close">Класс!</button></div>`;
  pop.className = 'open';
}
pop.addEventListener('click', e => { if (e.target.closest('[data-pact]')) { pop.className = ''; pop.innerHTML = ''; setTimeout(showPops, 200); } });

/* ---------- отчёт ---------- */
function reportText() {
  const d = S.days[today()] || { n: 0, c: 0 }, w = [];
  for (let i = 0; i < 7; i++) w.push(S.days[addDays(today(), -i)] || { n: 0, c: 0 });
  const wn = w.reduce((a, x) => a + x.n, 0), wc = w.reduce((a, x) => a + x.c, 0), wd = w.filter(x => x.n >= GOAL).length;
  const list = k => SKILLS.filter(s => status(s.id) === k).map(s => s.title), gaps = list('gap');
  return `Nika.math · отчёт · ${ruDate(today())}
Сегодня: ${d.n} задач, верно ${d.n ? Math.round(100 * d.c / d.n) : 0}%
За 7 дней: ${wn} задач, точность ${wn ? Math.round(100 * wc / wn) : 0}%, норма ${wd} из 7 дней
Серия: ${streak()} дн. · Баллы: ${fmtN(S.coins)}
Освоено тем: ${list('ok').length} из ${SKILLS.length}
Пробелы: ${gaps.length ? gaps.join(', ') : 'нет'}
Весь прогресс: ${parentLink()}`;
}
async function share(text) {
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Скопировано — вставь в Телеграм'); } catch (e) { prompt('Скопируй:', text); }
}
function toast(msg) {
  let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show'; clearTimeout(t._h); t._h = setTimeout(() => { t.className = ''; }, 2200);
}

/* ---------- события ---------- */
function startSession(s) { S.session = s; save(); go('session'); }
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const a = b.dataset.act;
  switch (a) {
    case 'go': if (b.dataset.a) { ui = {}; view = b.dataset.v; viewArg = b.dataset.a; render(); window.scrollTo(0, 0); } else go(b.dataset.v); break;
    case 'home': go('home'); break;
    case 'see-path': go('home'); ui.scrollCur = true; render(); break;
    case 'setup-save': S.school = { alg: document.getElementById('s-alg').value, geo: document.getElementById('s-geo').value }; save(); toast('Сохранено'); go('home'); break;
    case 'daily': startSession(buildDaily()); break;
    case 'daily-more': { const s = buildDaily(); s.queue = s.queue.filter(x => x.t === 'task').slice(0, 20); s.kind = 'extra'; startSession(s); break; }
    case 'resume': go('session'); break;
    case 'diag': startSession(buildDiag()); break;
    case 'errors': startSession(buildErrors()); break;
    case 'train': startSession(buildTrain(b.dataset.a, +b.dataset.l)); break;
    case 'ctrl-start': startSession(buildExam('control', controlPool(b.dataset.b), 40, { block: b.dataset.b })); break;
    case 'node': nodeSheet(b.dataset.id); break;
    case 'chest': {
      const k = b.dataset.k;
      if (S.chests[k]) return toast('Этот сундук уже открыт');
      if (b.classList.contains('locked')) return toast('Сундук откроется, когда пройдёшь темы перед ним');
      S.chests[k] = today(); const g = award(30, 'Сундук на пути'); popQueue.push({ kind: 'chest', coins: g }); save(); render(); break;
    }
    case 'trophy': {
      const u = UNITS.find(x => x.id === b.dataset.u);
      if (S.unitDone[u.id]) return toast('Раздел уже сдан');
      if (b.classList.contains('locked')) return toast('Сначала пройди все темы раздела');
      openSheet(`<div class="sh-c">${I('trophy')}<h2>Контрольная раздела</h2><p>«${u.title}»: 10 заданий из тем раздела, 25 минут, без подсказок.</p><p class="muted">Нужно 80% верных. Награда — 100 баллов и следующий раздел.</p><button class="btn primary big" data-sact="unit-start" data-u="${u.id}">Начать</button></div>`);
      break;
    }
    case 'next': nextItem(); break;
    case 'hint': ui.hint = true; render(); break;
    case 'giveup': finish(0, { gave: true }); break;
    case 'skip': finish(0, { your: '—' }); break;
    case 'steps': ui.showSteps = true; render(); break;
    case 'chat': openChat(); break;
    case 'xopen': ui.open = ui.open === +b.dataset.i ? null : +b.dataset.i; render(); break;
    case 'pick': {
      const p = S.session.queue[S.session.i].p, o = p.opts[+b.dataset.i];
      finish(o.ok ? (ui.hint ? 0.5 : 1) : 0, { your: o.t, why: o.ok ? '' : o.why, note: o.ok && ui.hint ? 'С подсказкой засчитывается наполовину, баллы не начисляются.' : '' });
      break;
    }
    case 'focus': ui.act = +b.dataset.i; paintInputs(); break;
    case 'key': press(b.dataset.k); break;
    case 'report': share(reportText()); break;
    case 'parent-link': share(`Вика, вот моя страница прогресса в Nika.math: ${parentLink()}`); break;
    case 'withdraw': {
      const amt = Math.floor(S.coins / 100) * 100;
      openSheet(`<div class="sh-c">${coin('big')}<h2>Обменять ${fmtN(amt)} баллов</h2><p>Получишь <b>${fmtN(amt * RATE)} ₽</b>. Запрос уйдёт Вике — она переведёт деньги и отметит выплату.</p><button class="btn primary big" data-sact="wd-confirm">Отправить запрос</button><button class="btn ghost big" data-sact="close">Пока коплю</button></div>`);
      break;
    }
    case 'exlv': ui.exLv = +b.dataset.l; ui.ex = null; render(); break;
    case 'newex': ui.ex = null; render(); break;
    case 'code-load': {
      const c = (document.getElementById('s-code').value || '').replace(/\s+/g, '').toLowerCase();
      if (c.length < 20) return toast('Код слишком короткий');
      if (!confirm('Прогресс на этом телефоне заменится прогрессом с другого. Продолжить?')) return;
      S = Object.assign(fresh(), { kid: c, ts: 0 }); saveLocal(); pull().then(() => { toast(S.school ? 'Прогресс загружен' : 'По этому коду ничего не нашлось'); go('home'); });
      break;
    }
    case 'reset': if (confirm('Точно удалить весь прогресс?')) { const k = S.kid; S = fresh(); S.kid = k; save(); go('home'); } break;
  }
});
function press(k) {
  if (view !== 'session' || ui.state === 'done' || !ui.inp) return;
  let v = ui.inp[ui.act];
  if (k === 'ok') return check();
  if (k === 'del') v = v.slice(0, -1);
  else if (k === '-') v = v.startsWith('-') ? v.slice(1) : '-' + v;
  else if (k === ',') { if (!/[.,]\d*$/.test(v) && !v.endsWith(',')) v += (v === '' || v === '-' || v.endsWith('/')) ? '0,' : ','; }
  else if (k === '/') { if (!v.includes('/') && /\d$/.test(v)) v += '/'; }
  else if (v.length < 12) v += k;
  ui.inp[ui.act] = v; paintInputs();
}
function paintInputs() {
  app.querySelectorAll('.inbox').forEach((el, i) => { el.classList.toggle('on', i === ui.act); el.querySelector('.val').innerHTML = esc(ui.inp[i].replace(/-/g, '−')) || '<span class="ph">…</span>'; });
}
document.addEventListener('keydown', e => {
  if (view !== 'session' || chatOpen || e.target.closest && e.target.closest('input,textarea,select')) return;
  const it = S.session && S.session.queue[S.session.i];
  if (ui.state === 'done' && e.key === 'Enter') { e.preventDefault(); return nextItem(); }
  if (!it || it.t !== 'task' || ui.state === 'done') { if (it && it.t === 'lesson' && e.key === 'Enter') nextItem(); return; }
  if (it.p.kind === 'choice') { const n = parseInt(e.key, 10); if (n >= 1 && n <= it.p.opts.length) { const btn = app.querySelectorAll('.opt')[n - 1]; btn && btn.click(); } return; }
  const map = { Enter: 'ok', Backspace: 'del', '-': '-', '−': '-', ',': ',', '.': ',', '/': '/' };
  if (/^\d$/.test(e.key)) press(e.key);
  else if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
  else if (e.key === 'Tab' && ui.inp && ui.inp.length > 1) { e.preventDefault(); ui.act = (ui.act + 1) % ui.inp.length; paintInputs(); }
});

saveLocal(); render(); pull();
})();
