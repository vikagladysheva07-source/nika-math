/* Nika.math — страница Вики */
(function () {
'use strict';
const { SKILLS, BLOCKS } = window.PYAT;
const { UNITS } = window.NM_CONTENT;
const SB = { url: 'https://amcbxjwgiqphqikzcxfj.supabase.co', key: 'sb_publishable_pDMx4w2cbHbuf7Y6cHiE2g_mFT8hlPB' };
const GOAL = 50, CAP = 3000, LS = 'nm_parent_k';
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtN = n => Math.round(n).toLocaleString('ru-RU');
const fmtD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => fmtD(new Date());
const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtD(d); };
const ruDate = ds => new Date(ds + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

async function rpc(fn, args) {
  const r = await fetch(SB.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB.key, Authorization: 'Bearer ' + SB.key }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}

let K = null;
const m = location.hash.match(/k=([a-z0-9]{20,64})/);
if (m) { K = m[1]; try { localStorage.setItem(LS, K); } catch (e) {} history.replaceState(null, '', location.pathname); }
else { try { K = localStorage.getItem(LS); } catch (e) {} }

function askCode(msg) {
  app.innerHTML = `<div class="wrap"><div class="p-head"><div><h1>Nika.math</h1><small>страница прогресса для Вики</small></div></div>
  <div class="card">${msg ? `<div class="alert">${msg}</div>` : ''}<h3 class="hq">Код Ники</h3><p class="muted">Он есть в приложении Ники: Награды → ⚙ → «Сохранение в облаке». Или просто открой ссылку, которую Ника отправит из отчёта.</p>
  <label class="fld"><input id="code" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" autocomplete="off"></label>
  <button class="btn primary big" id="go">Открыть</button></div></div>`;
  document.getElementById('go').onclick = () => { const c = document.getElementById('code').value.replace(/\s+/g, '').toLowerCase(); if (c.length >= 20) { K = c; try { localStorage.setItem(LS, K); } catch (e) {} load(); } };
}

function status(S, id) {
  const s = S.sk[id]; if (!s || !s.h.length) return 'new';
  const h = s.h.slice(-10), a = h.reduce((x, y) => x + y, 0) / h.length;
  if (a < 0.6) return 'gap'; if (a >= 0.85 && s.h.length >= 8) return 'ok'; return 'learn';
}
function streak(S) {
  let n = 0, d = today(); if (!((S.days[d] || {}).n >= GOAL)) d = addDays(d, -1);
  while ((S.days[d] || {}).n >= GOAL) { n++; d = addDays(d, -1); } return n;
}

let R = null;
async function load() {
  app.innerHTML = '<div class="wrap"><p class="muted center" style="margin-top:40vh">Загружаю…</p></div>';
  try { R = await rpc('nm_get', { p_k: K }); }
  catch (e) { return askCode('Нет связи с сервером. Проверь, что SQL-скрипт выполнен в Supabase, и обнови страницу.'); }
  if (!R || !R.d) return askCode('По этому коду данных пока нет. Ника должна хотя бы раз открыть приложение с интернетом.');
  render();
}

function render() {
  const S = R.d, paid = new Set(R.paid || []), td = today();
  const d = S.days[td] || { n: 0, c: 0 }, week = [];
  for (let i = 0; i < 7; i++) week.push(S.days[addDays(td, -i)] || { n: 0, c: 0 });
  const wn = week.reduce((a, x) => a + x.n, 0), wc = week.reduce((a, x) => a + x.c, 0), wd = week.filter(x => x.n >= GOAL).length;
  const upd = R.updated ? Math.round((Date.now() - new Date(R.updated)) / 60000) : null;
  const updTxt = upd == null ? '' : upd < 2 ? 'обновлено только что' : upd < 60 ? `обновлено ${upd} мин назад` : upd < 1440 ? `обновлено ${Math.round(upd / 60)} ч назад` : `обновлено ${Math.round(upd / 1440)} дн. назад`;
  const em = (S.earned || {})[td.slice(0, 7)] || 0;
  const guess = []; for (let i = 0; i < 7; i++) { const ds = addDays(td, -i), x = S.days[ds]; if (x && x.n >= 20 && x.c / x.n < 0.5) guess.push(ds); }
  const lim = addDays(td, -7), cnt = {}; (S.errors || []).filter(e => e.d >= lim).forEach(e => { cnt[e.sk] = (cnt[e.sk] || 0) + 1; });
  const topErr = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const T = Object.fromEntries(SKILLS.map(s => [s.id, s.title]));
  const pending = (S.withdraw || []).filter(r => !paid.has(r.id)), done = (S.withdraw || []).filter(r => paid.has(r.id));
  const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(td, -i));
  const mx = Math.max(Math.round(GOAL * 1.25), ...days.map(x => (S.days[x] || {}).n || 0));
  const cur = (() => { for (const u of UNITS) for (const id of u.skills) if (status(S, id) !== 'ok' && !(S.mastered || {})[id]) return { u, id }; return null; })();

  app.innerHTML = `<div class="wrap">
  <div class="p-head"><div><h1>Ника · прогресс</h1><small>${updTxt}</small></div><button class="ibtn" id="rf" aria-label="Обновить"><svg viewBox="0 0 24 24" class="i"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button></div>
  ${d.n >= GOAL ? '<div class="alert ok">Сегодня норма выполнена.</div>' : `<div class="alert">${d.n ? `Сегодня решено ${d.n} из ${GOAL}.` : 'Сегодня ещё не занималась.'}</div>`}
  ${guess.length ? `<div class="alert">Похоже на ответы наугад: точность ниже 50% в дни ${guess.map(ruDate).join(', ')}. Стоит поговорить.</div>` : ''}
  <div class="kpis"><div><b>${d.n}</b><span>задач сегодня</span></div><div><b>${d.n ? Math.round(100 * d.c / d.n) : 0}%</b><span>верно сегодня</span></div><div><b>${streak(S)}</b><span>дней подряд</span></div></div>
  <div class="kpis" style="margin-top:10px"><div><b>${wn}</b><span>задач за 7 дней</span></div><div><b>${wn ? Math.round(100 * wc / wn) : 0}%</b><span>точность недели</span></div><div><b>${wd}/7</b><span>дней с нормой</span></div></div>

  <div class="card"><h3>Деньги</h3>
    <div class="mrow"><span>Баланс баллов</span><b>${fmtN(S.coins || 0)} ₽</b></div>
    <div class="mrow"><span>Заработано в этом месяце</span><b>${fmtN(em)} / ${fmtN(CAP)} ₽</b></div><div class="mbar gold"><i style="width:${100 * em / CAP}%"></i></div>
    ${pending.length ? `<p><b>Ждут выплаты:</b></p>${pending.map(r => `<div class="wd"><span>${ruDate(r.d)}</span><b>${fmtN(r.amt)} ₽</b><button class="btn primary" data-pay="${r.id}" data-amt="${r.amt}">Выплачено</button></div>`).join('')}` : '<p class="muted small">Запросов на выплату нет.</p>'}
    ${done.length ? `<p class="muted small">Выплачено всего: ${fmtN(done.reduce((a, r) => a + r.amt, 0))} ₽</p>` : ''}
  </div>

  <div class="card"><h3>Последние 14 дней</h3><div class="bars"><div class="goal" style="bottom:${100 * GOAL / mx}%"><span>${GOAL}</span></div>${days.map(x => { const v = (S.days[x] || {}).n || 0; return `<div class="bcol"><div class="bv ${v >= GOAL ? 'full' : ''}" style="height:${100 * v / mx}%"></div><span>${+x.slice(8)}</span></div>`; }).join('')}</div></div>

  <div class="card"><h3>Путь</h3>${cur ? `<p>Сейчас: <b>${esc(T[cur.id])}</b> · ${esc(cur.u.title)}</p>` : '<p>Весь путь пройден.</p>'}
    <div class="ups">${UNITS.map(u => { const dn = u.skills.filter(id => status(S, id) === 'ok' || (S.mastered || {})[id]).length; return `<div class="up"><span>${esc(u.title)}${(S.unitDone || {})[u.id] ? ' · сдан' : ''}</span><b>${dn}/${u.skills.length}</b><div class="mbar"><i style="width:${100 * dn / u.skills.length}%"></i></div></div>`; }).join('')}</div></div>

  ${topErr.length ? `<div class="card"><h3>Где больше всего ошибок за неделю</h3>${topErr.map(([id, n]) => `<div class="srow"><span>${esc(T[id])}</span><b>${n}</b></div>`).join('')}</div>` : ''}

  ${(S.controls || []).length ? `<div class="card"><h3>Контрольные</h3>${S.controls.slice(-8).reverse().map(c => `<div class="srow"><span>${ruDate(c.d)} · ${c.k === 'unit' ? 'раздел пути' : c.b === 'alg' ? 'алгебра' : 'геометрия'}</span><b>${c.pct}%</b><span class="grade sm g${c.grade}">${c.grade}</span></div>`).join('')}</div>` : ''}

  <div class="card"><h3>Карта тем</h3>${BLOCKS.map(b => `<div class="mapb"><small>${b.title}</small><div class="map">${SKILLS.filter(s => s.block === b.id).map(s => { const st = status(S, s.id), h = (S.sk[s.id] || { h: [] }).h.slice(-10); return `<div class="cell ${st}"><span>${esc(s.title)}</span><b>${h.length ? Math.round(100 * h.reduce((a, x) => a + x, 0) / h.length) + '%' : '—'}</b></div>`; }).join('')}</div></div>`).join('')}
  <div class="legend"><span><i class="dot gap"></i>пробел</span><span><i class="dot learn"></i>в процессе</span><span><i class="dot ok"></i>освоено</span><span><i class="dot new"></i>не начато</span></div></div>
  <p class="muted small center">Данные приходят с телефона Ники автоматически, когда она занимается.</p>
  </div>`;
  document.getElementById('rf').onclick = load;
  app.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
    const row = b.closest('.wd');
    row.insertAdjacentHTML('afterend', `<div class="pinrow"><p class="small muted">${R.pin ? 'Введи свой PIN, чтобы отметить выплату' : 'Придумай PIN (от 4 цифр). Им будешь отмечать выплаты — Нике его не говори.'}</p><div class="pinin"><input type="password" inputmode="numeric" autocomplete="off" placeholder="PIN"><button class="btn primary">Подтвердить</button></div><p class="small pinerr"></p></div>`);
    b.disabled = true;
    const box = row.nextElementSibling, inp = box.querySelector('input'); inp.focus();
    box.querySelector('button').onclick = () => pay(b.dataset.pay, +b.dataset.amt, inp.value.trim(), box.querySelector('.pinerr'));
  });
}

async function pay(id, amt, pin, err) {
  if (!pin || pin.length < 4) { err.textContent = 'PIN — минимум 4 цифры'; return; }
  try {
    if (!R.pin) { await rpc('nm_set_pin', { p_k: K, p_pin: pin }); R.pin = true; }
    await rpc('nm_mark_paid', { p_k: K, p_pin: pin, p_req: id, p_amt: amt });
    load();
  } catch (e) { err.textContent = String(e.message).includes('bad pin') ? 'Неверный PIN' : 'Не получилось, попробуй ещё раз'; }
}

if (K) load(); else askCode();
})();
