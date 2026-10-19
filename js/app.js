/* Nika.math — приложение */
(function () {
'use strict';
const { SKILLS, BLOCKS, make, gcd } = window.PYAT;
const KEY = 'pyaterka_v1', GOAL = 50, NAME = 'Ника';
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const BL = Object.fromEntries(BLOCKS.map(b => [b.id, b]));

/* ---------- даты ---------- */
const fmtD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => fmtD(new Date());
const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtD(d); };
const ruDate = ds => { const d = new Date(ds + 'T12:00:00'); return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); };

/* ---------- состояние ---------- */
const fresh = () => ({ v: 1, sk: {}, days: {}, errors: [], school: null, diag: false, session: null, best: 0 });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const st = id => S.sk[id] || (S.sk[id] = { h: [], n: 0, c: 0 });
function status(id) {
  const s = S.sk[id]; if (!s || !s.h.length) return 'new';
  const h = s.h.slice(-10), acc = h.reduce((a, b) => a + b, 0) / h.length;
  if (acc < 0.6) return 'gap';
  if (acc >= 0.85 && s.h.length >= 8) return 'ok';
  return 'learn';
}
const acc = id => { const s = S.sk[id]; if (!s || !s.h.length) return null; const h = s.h.slice(-10); return Math.round(100 * h.reduce((a, b) => a + b, 0) / h.length); };
const levelOf = id => ({ new: 1, gap: 1, learn: 2, ok: 3 })[status(id)];
const STATUS_TXT = { new: 'не начато', gap: 'пробел', learn: 'в процессе', ok: 'освоено' };
const RANK = { gap: 0, new: 1, learn: 2, ok: 3 };

function record(id, score) {
  const s = st(id); s.h.push(score); if (s.h.length > 20) s.h.shift(); s.n++; if (score === 1) s.c++; s.last = today();
  const d = S.days[today()] || (S.days[today()] = { n: 0, c: 0 }); d.n++; d.c += score;
  if (score === 0) { S.errors.push({ sk: id, d: today() }); if (S.errors.length > 200) S.errors.shift(); }
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

/* ---------- маршрут обучения ---------- */
const byBlock = b => SKILLS.filter(s => s.block === b);
function pathway() {
  const sc = S.school || { alg: 'lin_eq', geo: 'geo_theory' };
  const upTo = (b, id) => { const arr = byBlock(b), i = arr.findIndex(s => s.id === id); return arr.slice(0, i + 1).map(s => s.id); };
  return [...byBlock('base').map(s => s.id), ...upTo('alg', sc.alg), ...upTo('geo', sc.geo), ...byBlock('prob').map(s => s.id)];
}
function focusSkill() {
  const pw = pathway();
  const sorted = pw.slice().sort((a, b) => RANK[status(a)] - RANK[status(b)] || pw.indexOf(a) - pw.indexOf(b));
  return status(sorted[0]) === 'ok' ? (S.school || {}).alg || 'lin_eq' : sorted[0];
}
const task = (id, lv, extra) => Object.assign({ t: 'task', p: make(id, lv) }, extra || {});

function buildDaily() {
  const pw = pathway(), focus = focusSkill(), sc = S.school || { alg: 'lin_eq', geo: 'geo_theory' }, td = today();
  const dueList = pw.filter(id => id !== focus && S.sk[id] && S.sk[id].h.length && (!S.sk[id].due || S.sk[id].due <= td))
    .sort((a, b) => RANK[status(a)] - RANK[status(b)]);
  const review = [];
  for (let round = 0; round < 3 && review.length < 15; round++)
    for (const id of dueList) { if (review.length >= 15) break; review.push(task(id, levelOf(id))); }
  const warm = review.slice(0, 5), rest = review.slice(5);
  const fst = status(focus), focusT = [];
  for (let i = 0; i < 15; i++) focusT.push(task(focus, i < 5 ? 1 : i < 10 ? 2 : Math.max(2, levelOf(focus)), { focus: true }));
  const school = [];
  for (let i = 0; i < 5; i++) { school.push(task(sc.alg, levelOf(sc.alg))); school.push(task(sc.geo, levelOf(sc.geo))); }
  const mix = [];
  const need = 50 - warm.length - focusT.length - school.length - rest.length;
  for (let i = 0; i < need; i++) { const id = pw[Math.floor(Math.random() * pw.length)]; mix.push(task(id, levelOf(id))); }
  const tail = shuffle([...rest, ...mix]);
  const q = [...warm];
  if (fst === 'gap' || fst === 'new') q.push({ t: 'lesson', sk: focus });
  q.push(...focusT, ...school, ...tail);
  return { kind: 'daily', date: td, focus, queue: q, i: 0, res: [] };
}
function buildDiag() {
  const sc = S.school || { alg: 'lin_eq', geo: 'geo_theory' }, q = [];
  byBlock('base').forEach(s => { q.push(task(s.id, 1)); q.push(task(s.id, 2)); });
  const upTo = (b, id) => { const arr = byBlock(b), i = arr.findIndex(s => s.id === id); return arr.slice(0, i + 1); };
  [...upTo('alg', sc.alg), ...upTo('geo', sc.geo)].forEach(s => q.push(task(s.id, 1)));
  return { kind: 'diag', date: today(), queue: q, i: 0, res: [] };
}
function buildTrain(id, lv, n) {
  const q = [{ t: 'lesson', sk: id }];
  for (let i = 0; i < (n || 10); i++) q.push(task(id, lv || levelOf(id)));
  return { kind: 'train', date: today(), sk: id, queue: q, i: 0, res: [] };
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
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- рендер ---------- */
const app = document.getElementById('app');
let view = 'home', viewArg = null, ui = {};
function go(v, arg) { view = v; viewArg = arg; ui = {}; render(); window.scrollTo(0, 0); }
function render() { app.innerHTML = (VIEWS[view] || VIEWS.home)(viewArg); after(); }
let after = () => {};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dot = id => `<i class="dot ${status(id)}"></i>`;
const icon = (n) => ({
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8 0 4 3 7 7 7z"/></svg>',
})[n] || '';

const VIEWS = {};

/* ----- первый запуск ----- */
VIEWS.setup = () => {
  const sel = (b, cur) => byBlock(b).map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
  const sc = S.school || { alg: 'lin_eq', geo: 'geo_theory' };
  return `<div class="wrap">
  <div class="setup-hero"><div class="logo">N</div><h1>Nika<span class="dotm">.math</span></h1><p>Ежедневная тренировка по математике. 50 задач в день, ответ и разбор — сразу.</p></div>
  <div class="card"><h3>Что сейчас проходите в школе?</h3><p class="muted">От этого зависит, какие темы попадут в тренировку. Можно поменять в настройках.</p>
    <label class="fld"><span>Алгебра</span><select id="s-alg">${sel('alg', sc.alg)}</select></label>
    <label class="fld"><span>Геометрия</span><select id="s-geo">${sel('geo', sc.geo)}</select></label>
  </div>
  <button class="btn primary big" data-act="setup-save">Готово</button></div>`;
};

/* ----- главная ----- */
VIEWS.home = () => {
  if (!S.school) return VIEWS.setup();
  const d = S.days[today()] || { n: 0, c: 0 }, pct = Math.min(1, d.n / GOAL), R0 = 52, C = 2 * Math.PI * R0;
  const ses = S.session && S.session.date === today() && S.session.i < S.session.queue.length ? S.session : null;
  const daily = ses && ses.kind === 'daily' ? ses : null;
  const doneDaily = d.n >= GOAL;
  const focus = focusSkill(), errs = errorSkills(), str = streak();
  const tasksIn = s => s.queue.filter(x => x.t === 'task').length, doneIn = s => s.queue.slice(0, s.i).filter(x => x.t === 'task').length;
  let mainBtn;
  if (ses && ses.kind !== 'daily') mainBtn = `<button class="btn primary big" data-act="resume">Продолжить: ${ses.kind === 'diag' ? 'входной тест' : 'тренировка'} · ${doneIn(ses)}/${tasksIn(ses)}</button>`;
  else if (daily) mainBtn = `<button class="btn primary big" data-act="resume">Продолжить тренировку · ${doneIn(daily)}/${tasksIn(daily)}</button>`;
  else if (doneDaily) mainBtn = `<button class="btn primary big" data-act="daily-more">Ещё 20 задач</button>`;
  else if (!S.diag) mainBtn = `<button class="btn primary big" data-act="diag">Начать с входного теста</button>`;
  else mainBtn = `<button class="btn primary big" data-act="daily">Начать тренировку дня</button>`;
  const mastered = SKILLS.filter(s => status(s.id) === 'ok').length, gaps = SKILLS.filter(s => status(s.id) === 'gap').length;
  return `<div class="wrap">
  <header class="top"><div><div class="hello">Привет, ${NAME}!</div><div class="muted">${ruDate(today())}</div></div><button class="ibtn" data-act="go" data-v="settings" aria-label="Настройки">${icon('gear')}</button></header>
  <section class="hero">
    <div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R0}" class="rbg"/><circle cx="60" cy="60" r="${R0}" class="rfg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
      <div class="rin"><b>${d.n}</b><span>из ${GOAL}</span></div></div>
    <div class="hstats">
      <div class="hs"><span class="hsi fire">${icon('fire')}</span><b>${str}</b><span>${str === 1 ? 'день' : str >= 2 && str <= 4 ? 'дня' : 'дней'} подряд</span></div>
      <div class="hs"><span class="hsi ok">${icon('target')}</span><b>${d.n ? Math.round(100 * d.c / d.n) : 0}%</b><span>верно сегодня</span></div>
    </div>
  </section>
  ${mainBtn}
  ${!S.diag && !ses ? `<div class="tile wide accent"><span class="ti">${icon('target')}</span><span><b>Сначала — входной тест</b><small>≈ 30 задач. Найдёт пробелы за 5–6 класс и составит маршрут. <button class="link" data-act="daily">Пропустить и начать тренировку</button></small></span></div>` : ''}
  <div class="focus card"><span class="muted">Фокус дня</span><div class="fr-row">${dot(focus)}<b>${esc(SK[focus].title)}</b><span class="chip">${BL[SK[focus].block].short}</span></div></div>
  <div class="tiles">
    <button class="tile" data-act="go" data-v="topics"><span class="ti">${icon('book')}</span><b>Темы и теория</b><small>${mastered} из ${SKILLS.length} освоено</small></button>
    <button class="tile" data-act="errors" ${errs.length ? '' : 'disabled'}><span class="ti">${icon('redo')}</span><b>Работа над ошибками</b><small>${errs.length ? errs.length + ' ' + (errs.length === 1 ? 'тема' : errs.length < 5 ? 'темы' : 'тем') : 'ошибок нет'}</small></button>
    <button class="tile" data-act="go" data-v="progress"><span class="ti">${icon('chart')}</span><b>Прогресс</b><small>${gaps ? gaps + ' ' + (gaps === 1 ? 'пробел' : gaps < 5 ? 'пробела' : 'пробелов') : 'карта тем'}</small></button>
    <button class="tile" data-act="report"><span class="ti">${icon('send')}</span><b>Отчёт</b><small>отправить Вике</small></button>
  </div></div>`;
};

/* ----- сессия ----- */
const tasksTotal = s => s.queue.filter(x => x.t === 'task').length;
const tasksDone = s => s.queue.slice(0, s.i).filter(x => x.t === 'task').length;
VIEWS.session = () => {
  const s = S.session;
  if (!s || s.i >= s.queue.length) return VIEWS.summary();
  const it = s.queue[s.i], tot = tasksTotal(s), dn = tasksDone(s);
  const head = `<header class="shead"><button class="ibtn" data-act="home" aria-label="На главную">${icon('back')}</button>
    <div class="bar"><i style="width:${100 * dn / Math.max(1, tot)}%"></i></div><span class="cnt">${dn}/${tot}</span></header>`;
  if (it.t === 'lesson') {
    const sk = SK[it.sk], exP = make(it.sk, 1);
    return `<div class="wrap">${head}<div class="card lesson"><span class="chip">${BL[sk.block].title}</span><h2>${esc(sk.title)}</h2>
      <div class="theory">${sk.th}</div>
      <div class="worked"><div class="wk-h">Разбор на примере</div><div class="q">${exP.q}</div>${exP.fig || ''}
      <ol class="steps">${exP.steps.map(x => `<li>${x}</li>`).join('')}</ol></div></div>
      <button class="btn primary big" data-act="next">Понятно, решаю</button></div>`;
  }
  const p = it.p, sk = SK[p.sk], st0 = ui.state || 'ask';
  const stars = '★'.repeat(p.lv) + '<span class="off">' + '★'.repeat(3 - p.lv) + '</span>';
  let body = `<div class="card task ${ui.shake ? 'shake' : ''}"><div class="tmeta"><span class="chip">${BL[sk.block].short}</span><span class="tname">${esc(sk.title)}</span><span class="stars">${stars}</span>${it.retry ? '<span class="chip warn">повтор</span>' : ''}</div>
    <div class="q">${p.q}</div>${p.note ? `<div class="note">${p.note}</div>` : ''}${p.fig || ''}
    ${ui.hint ? `<div class="hint"><b>Подсказка.</b> ${p.hint}</div>` : ''}</div>`;
  if (st0 === 'ask') {
    if (p.kind === 'choice') {
      body += `<div class="opts">${p.opts.map((o, i) => `<button class="opt" data-act="pick" data-i="${i}">${o.t}</button>`).join('')}</div>`;
    } else {
      const labels = p.labels || [''];
      ui.inp = ui.inp || labels.map(() => ''); ui.act = ui.act || 0;
      body += `<div class="inputs">${labels.map((l, i) => `<button class="inbox ${i === ui.act ? 'on' : ''}" data-act="focus" data-i="${i}">${l ? `<i>${l}</i> =` : 'Ответ:'} <span class="val">${esc(ui.inp[i].replace(/-/g, '−')) || '<span class="ph">…</span>'}</span>${p.unit ? `<span class="unit">${p.unit}</span>` : ''}</button>`).join('')}</div>`;
      body += keypad();
    }
    body += `<div class="row2">${ui.hint ? '' : `<button class="btn ghost" data-act="hint">Подсказка</button>`}<button class="btn ghost" data-act="giveup">Не знаю — покажи решение</button></div>`;
  } else body += feedback(p);
  return `<div class="wrap">${head}${body}</div>`;
};
function keypad() {
  const K = ['7', '8', '9', 'del', '4', '5', '6', '/', '1', '2', '3', '-', '0', ',', 'ok'];
  const lab = { del: '⌫', '-': '−', ok: 'Проверить', '/': '/' };
  return `<div class="kpad">${K.map(k => `<button class="k ${k === 'ok' ? 'kok' : ''} ${['del', '/', '-'].includes(k) ? 'kf' : ''}" data-act="key" data-k="${k}">${lab[k] || k}</button>`).join('')}</div>`;
}
function feedback(p) {
  const r = ui.result, good = r.score > 0;
  let h = `<div class="fb ${good ? 'good' : 'bad'}"><div class="fb-h">${good ? (r.score === 1 ? pick(['Верно!', 'Точно!', 'Отлично!', 'Да, правильно!', 'Так держать!']) : 'Верно, но…') : r.gave ? 'Разбор решения' : 'Неверно'}</div>`;
  if (r.note) h += `<p class="fb-note">${r.note}</p>`;
  if (!good && r.your) h += `<p>Твой ответ: <b class="strike">${r.your}</b></p>`;
  if (!good || r.score < 1) h += `<p>Правильный ответ: <b class="ans">${p.ansText}</b>${p.unit && p.kind === 'num' ? p.unit : ''}</p>`;
  if (r.why) h += `<div class="why"><b>Где ошибка.</b> ${r.why}</div>`;
  const open = !good || ui.showSteps;
  h += open ? `<ol class="steps">${p.steps.map(x => `<li>${x}</li>`).join('')}</ol>` : `<button class="link" data-act="steps">Посмотреть решение</button>`;
  h += `</div><button class="btn primary big" data-act="next">${S.session.i + 1 >= S.session.queue.length ? 'Завершить' : 'Дальше'}</button>`;
  if (!good && S.session.kind !== 'diag') h += `<p class="muted center small">Похожая задача придёт через пару шагов — закрепим.</p>`;
  return h;
}
const pick = a => a[Math.floor(Math.random() * a.length)];

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
    if (ui.hint && !note) note = 'С подсказкой засчитывается наполовину. В следующий раз попробуй без неё.';
  } else {
    const t = (p.traps || []).find(t => Math.abs(t.v - vals[0].v) < 1e-9);
    if (t) why = t.why;
  }
  finish(score, { your: ui.inp.map(s => s.replace(/-/g, '−')).join('; '), note, why });
}
function finish(score, extra) {
  const s = S.session, it = s.queue[s.i];
  record(it.p.sk, score); s.res.push({ sk: it.p.sk, score });
  if (score === 0 && s.kind !== 'diag' && !it.retry) {
    const at = Math.min(s.i + 4, s.queue.length);
    s.queue.splice(at, 0, task(it.p.sk, it.p.lv, { retry: true }));
  }
  ui.state = 'done'; ui.result = Object.assign({ score }, extra); save(); render();
}
function nextItem() {
  const s = S.session; s.i++; save();
  if (s.i >= s.queue.length) endSession();
  ui = {}; render(); window.scrollTo(0, 0);
}
function endSession() {
  const s = S.session; scheduleDue(s.res.map(r => r.sk));
  if (s.kind === 'diag') S.diag = true;
  S.best = Math.max(S.best || 0, streak()); save();
}

/* ----- итоги ----- */
VIEWS.summary = () => {
  const s = S.session; if (!s) return VIEWS.home();
  const n = s.res.length, c = s.res.reduce((a, r) => a + r.score, 0), pct = n ? Math.round(100 * c / n) : 0;
  const by = {}; s.res.forEach(r => { (by[r.sk] = by[r.sk] || { n: 0, c: 0 }); by[r.sk].n++; by[r.sk].c += r.score; });
  const rows = Object.entries(by).sort((a, b) => a[1].c / a[1].n - b[1].c / b[1].n).map(([id, v]) =>
    `<div class="srow">${dot(id)}<span>${esc(SK[id].title)}</span><b>${Math.round(100 * v.c / v.n)}%</b><small>${v.c % 1 ? v.c.toFixed(1) : v.c}/${v.n}</small></div>`).join('');
  const title = s.kind === 'diag' ? 'Входной тест пройден' : s.kind === 'daily' ? 'Тренировка дня готова!' : 'Готово!';
  const msg = pct >= 85 ? 'Это уровень пятёрки. Так держать.' : pct >= 65 ? 'Хорошо. Ошибки — это карта того, что подтянуть.' : 'Ничего страшного: теперь понятно, где пробелы. Именно их и будем закрывать.';
  const diagMap = s.kind === 'diag' ? `<div class="card"><h3>Что нашли</h3>${['gap', 'learn'].map(k => {
      const ids = [...new Set(s.res.map(r => r.sk))].filter(id => status(id) === k);
      return ids.length ? `<p><b>${k === 'gap' ? 'Пробелы' : 'Почти освоено'}:</b> ${ids.map(id => esc(SK[id].title)).join(', ')}</p>` : '';
    }).join('')}<p class="muted">Тренировка дня начнёт с самого важного пробела.</p></div>` : '';
  return `<div class="wrap"><div class="sum-hero"><div class="big-pct">${pct}%</div><h2>${title}</h2><p>${msg}</p><p class="muted">${n} задач · верно ${c % 1 ? c.toFixed(1) : c}</p></div>
    ${diagMap}<div class="card"><h3>По темам</h3>${rows}</div>
    <button class="btn primary big" data-act="home">На главную</button><button class="btn ghost big" data-act="report">Отправить отчёт Вике</button></div>`;
};

/* ----- темы ----- */
VIEWS.topics = () => {
  const pw = new Set(pathway());
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="home">${icon('back')}</button><h2>Темы и теория</h2><span></span></header>
  ${BLOCKS.map(b => `<div class="blk"><div class="blk-h"><b>${b.title}</b><small>${b.note}</small></div>
    ${byBlock(b.id).map(s => `<button class="trow" data-act="go" data-v="skill" data-a="${s.id}">${dot(s.id)}<span>${esc(s.title)}${pw.has(s.id) ? '' : ' <small class="muted">· впереди</small>'}</span><b>${acc(s.id) == null ? '' : acc(s.id) + '%'}</b></button>`).join('')}</div>`).join('')}
  <div class="legend"><span>${'<i class="dot gap"></i>'}пробел</span><span><i class="dot learn"></i>в процессе</span><span><i class="dot ok"></i>освоено</span><span><i class="dot new"></i>не начато</span></div></div>`;
};
VIEWS.skill = id => {
  const s = SK[id], exP = ui.ex || (ui.ex = make(id, ui.exLv || 1)), lv = levelOf(id);
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="go" data-v="topics">${icon('back')}</button><span class="chip">${BL[s.block].title}</span><span></span></header>
  <div class="card lesson"><h2>${esc(s.title)}</h2><p class="muted">${dot(id)} ${STATUS_TXT[status(id)]}${acc(id) == null ? '' : ' · точность ' + acc(id) + '%'}</p>
  <div class="theory">${s.th}</div>
  <div class="worked"><div class="wk-h">Пример с решением <span class="seg">${[1, 2, 3].map(l => `<button data-act="exlv" data-l="${l}" class="${(ui.exLv || 1) === l ? 'on' : ''}">${'★'.repeat(l)}</button>`).join('')}</span></div>
  <div class="q">${exP.q}</div>${exP.fig || ''}<ol class="steps">${exP.steps.map(x => `<li>${x}</li>`).join('')}</ol>
  <button class="link" data-act="newex">Другой пример</button></div></div>
  <div class="card"><h3>Тренировка: 10 задач</h3><div class="lvls">${[1, 2, 3].map(l => `<button class="btn ${l === lv ? 'primary' : 'ghost'}" data-act="train" data-a="${id}" data-l="${l}">${'★'.repeat(l)}<small>${['база', 'средний', 'на пятёрку'][l - 1]}</small></button>`).join('')}</div></div></div>`;
};

/* ----- прогресс ----- */
VIEWS.progress = () => {
  const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(today(), -i));
  const mx = Math.max(Math.round(GOAL * 1.25), ...days.map(d => (S.days[d] || {}).n || 0));
  const total = Object.values(S.days).reduce((a, d) => a + d.n, 0), str = streak();
  const bars = days.map(d => { const v = (S.days[d] || {}).n || 0; return `<div class="bcol"><div class="bv ${v >= GOAL ? 'full' : ''}" style="height:${100 * v / mx}%" title="${v}"></div><span>${+d.slice(8)}</span></div>`; }).join('');
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="home">${icon('back')}</button><h2>Прогресс</h2><span></span></header>
  <div class="kpis"><div><b>${total}</b><span>задач всего</span></div><div><b>${str}</b><span>серия дней</span></div><div><b>${SKILLS.filter(s => status(s.id) === 'ok').length}/${SKILLS.length}</b><span>тем освоено</span></div></div>
  <div class="card"><h3>Последние 14 дней</h3><div class="bars"><div class="goal" style="bottom:${100 * GOAL / mx}%"><span>${GOAL}</span></div>${bars}</div></div>
  <div class="card"><h3>Карта тем</h3>${BLOCKS.map(b => `<div class="mapb"><small>${b.title}</small><div class="map">${byBlock(b.id).map(s => `<button class="cell ${status(s.id)}" data-act="go" data-v="skill" data-a="${s.id}" title="${esc(s.title)}"><span>${esc(s.title)}</span><b>${acc(s.id) == null ? '—' : acc(s.id) + '%'}</b></button>`).join('')}</div></div>`).join('')}
  <div class="legend"><span><i class="dot gap"></i>пробел</span><span><i class="dot learn"></i>в процессе</span><span><i class="dot ok"></i>освоено</span><span><i class="dot new"></i>не начато</span></div></div>
  <button class="btn ghost big" data-act="report">Отправить отчёт Вике</button></div>`;
};

/* ----- настройки ----- */
VIEWS.settings = () => {
  const sc = S.school || { alg: 'lin_eq', geo: 'geo_theory' };
  const sel = (b, cur) => byBlock(b).map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
  return `<div class="wrap"><header class="top"><button class="ibtn" data-act="home">${icon('back')}</button><h2>Настройки</h2><span></span></header>
  <div class="card"><h3>Тема в школе сейчас</h3><p class="muted">Меняй, когда в классе начинается новая тема — тренировка подстроится.</p>
  <label class="fld"><span>Алгебра</span><select id="s-alg">${sel('alg', sc.alg)}</select></label>
  <label class="fld"><span>Геометрия</span><select id="s-geo">${sel('geo', sc.geo)}</select></label>
  <button class="btn primary" data-act="setup-save">Сохранить</button></div>
  <div class="card"><h3>Входной тест</h3><p class="muted">Можно пройти заново, например раз в месяц, чтобы увидеть рост.</p><button class="btn ghost" data-act="diag">Пройти входной тест</button></div>
  <div class="card"><h3>Сбросить прогресс</h3><p class="muted">Удалит всю статистику на этом устройстве.</p><button class="btn danger" data-act="reset">Сбросить</button></div></div>`;
};

/* ---------- отчёт ---------- */
function reportText() {
  const d = S.days[today()] || { n: 0, c: 0 }, w = [];
  for (let i = 0; i < 7; i++) w.push(S.days[addDays(today(), -i)] || { n: 0, c: 0 });
  const wn = w.reduce((a, x) => a + x.n, 0), wc = w.reduce((a, x) => a + x.c, 0), wd = w.filter(x => x.n >= GOAL).length;
  const list = k => SKILLS.filter(s => status(s.id) === k).map(s => s.title);
  const gaps = list('gap'), ok = list('ok');
  return `Nika.math · отчёт · ${ruDate(today())}
Сегодня: ${d.n} задач, верно ${d.n ? Math.round(100 * d.c / d.n) : 0}%
За 7 дней: ${wn} задач, точность ${wn ? Math.round(100 * wc / wn) : 0}%, норма выполнена ${wd} из 7 дней
Серия: ${streak()} дн.
Освоено тем: ${ok.length} из ${SKILLS.length}
Пробелы: ${gaps.length ? gaps.join(', ') : 'нет'}
Фокус сейчас: ${SK[focusSkill()].title}`;
}
async function shareReport() {
  const text = reportText();
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Отчёт скопирован — вставь в Телеграм'); }
  catch (e) { prompt('Скопируй отчёт:', text); }
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
    case 'setup-save': S.school = { alg: document.getElementById('s-alg').value, geo: document.getElementById('s-geo').value }; save(); toast('Сохранено'); go('home'); break;
    case 'daily': startSession(buildDaily()); break;
    case 'daily-more': { const s = buildDaily(); s.queue = s.queue.filter(x => x.t === 'task').slice(0, 20); s.kind = 'extra'; startSession(s); break; }
    case 'resume': go('session'); break;
    case 'diag': if (S.session && S.session.i < S.session.queue.length && S.session.date === today() && S.session.kind === 'daily' && !confirm('Текущая тренировка дня будет отложена. Начать тест?')) return; startSession(buildDiag()); break;
    case 'errors': startSession(buildErrors()); break;
    case 'train': startSession(buildTrain(b.dataset.a, +b.dataset.l)); break;
    case 'next': nextItem(); break;
    case 'hint': ui.hint = true; render(); break;
    case 'giveup': finish(0, { gave: true }); break;
    case 'steps': ui.showSteps = true; render(); break;
    case 'pick': {
      const p = S.session.queue[S.session.i].p, o = p.opts[+b.dataset.i];
      finish(o.ok ? (ui.hint ? 0.5 : 1) : 0, { your: o.t, why: o.ok ? '' : o.why, note: o.ok && ui.hint ? 'С подсказкой засчитывается наполовину.' : '' });
      break;
    }
    case 'focus': ui.act = +b.dataset.i; paintInputs(); break;
    case 'key': press(b.dataset.k); break;
    case 'report': shareReport(); break;
    case 'exlv': ui.exLv = +b.dataset.l; ui.ex = null; render(); break;
    case 'newex': ui.ex = null; render(); break;
    case 'reset': if (confirm('Точно удалить весь прогресс?')) { S = fresh(); save(); go('home'); } break;
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
  ui.inp[ui.act] = v;
  paintInputs();
}
function paintInputs() {
  app.querySelectorAll('.inbox').forEach((el, i) => {
    el.classList.toggle('on', i === ui.act);
    el.querySelector('.val').innerHTML = esc(ui.inp[i].replace(/-/g, '−')) || '<span class="ph">…</span>';
  });
}
document.addEventListener('keydown', e => {
  if (view !== 'session') return;
  const it = S.session && S.session.queue[S.session.i];
  if (ui.state === 'done' && e.key === 'Enter') { e.preventDefault(); return nextItem(); }
  if (!it || it.t !== 'task' || ui.state === 'done') { if (it && it.t === 'lesson' && e.key === 'Enter') nextItem(); return; }
  if (it.p.kind === 'choice') { const n = parseInt(e.key, 10); if (n >= 1 && n <= it.p.opts.length) { const btn = app.querySelectorAll('.opt')[n - 1]; btn && btn.click(); } return; }
  const map = { Enter: 'ok', Backspace: 'del', '-': '-', '−': '-', ',': ',', '.': ',', '/': '/' };
  if (/^\d$/.test(e.key)) press(e.key);
  else if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
  else if (e.key === 'Tab' && ui.inp && ui.inp.length > 1) { e.preventDefault(); ui.act = (ui.act + 1) % ui.inp.length; paintInputs(); }
});

render();
})();
