/* Пятёрка — генераторы задач.
   Каждый генератор: уровень (1..3) → задача
   {q, kind:'num'|'choice', ans:[[n,d],...], ansText, labels, opts, steps, hint, traps, fig, unit, frac} */
(function (root) {
'use strict';

/* ---------- утилиты ---------- */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const rnz = (a, b) => { let x; do { x = ri(a, b); } while (x === 0); return x; };
const pm = (a, b) => ri(a, b) * (Math.random() < 0.5 ? -1 : 1);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => a / gcd(a, b) * b;
const MI = '−';
const R = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };

const num = x => { const r = Math.round(x * 1e6) / 1e6; const s = String(Math.abs(r)).replace('.', ','); return (r < 0 ? MI : '') + s; };
const pn = x => x < 0 ? `(${num(x)})` : num(x);
const sg = x => x < 0 ? `${MI} ${num(-x)}` : `+ ${num(x)}`;
const fs = (t, b) => `<span class="fr"><span>${t}</span><span>${b}</span></span>`;
const frac = (n, d) => d === 1 ? num(n) : (n < 0 ? MI : '') + fs(Math.abs(n), d);
const rh = r => frac(r[0], r[1]);
const sup = (b, e) => `${b}<sup>${e}</sup>`;
const V = v => `<i>${v}</i>`;
const pv = (v, e) => e === 1 ? V(v) : sup(V(v), e);
const ex = s => `<span class="ex">${s}</span>`;
const ok = s => `<b class="ans">${s}</b>`;
const raz = k => (k % 10 >= 2 && k % 10 <= 4 && (k < 10 || k > 20)) ? 'раза' : 'раз';
const terminating = d => { while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; };

/* ---------- многочлены ---------- */
const T = (c, v) => ({ c, v: Object.assign({}, v || {}) });
const X = (c, v = 'x', e = 1) => T(c, { [v]: e });
const K = c => T(c, {});
const tkey = t => Object.keys(t.v).filter(k => t.v[k]).sort().map(k => k + t.v[k]).join('');
const tdeg = t => Object.values(t.v).reduce((s, e) => s + e, 0);
function cmpT(a, b) {
  const da = tdeg(a), db = tdeg(b); if (da !== db) return db - da;
  const vs = [...new Set([...Object.keys(a.v), ...Object.keys(b.v)])].sort();
  for (const k of vs) { const ea = a.v[k] || 0, eb = b.v[k] || 0; if (ea !== eb) return eb - ea; }
  return 0;
}
function P(terms) {
  const m = new Map();
  for (const t of terms) { const k = tkey(t); if (m.has(k)) m.get(k).c += t.c; else m.set(k, T(t.c, t.v)); }
  return [...m.values()].filter(t => t.c !== 0).sort(cmpT);
}
const mulT = (a, b) => { const v = Object.assign({}, a.v); for (const k in b.v) v[k] = (v[k] || 0) + b.v[k]; return T(a.c * b.c, v); };
const mulP = (A, B) => P(A.flatMap(a => B.map(b => mulT(a, b))));
const addP = (A, B) => P([...A, ...B]);
const negP = A => A.map(t => T(-t.c, t.v));
const powT = (t, n) => { const v = {}; for (const k in t.v) v[k] = t.v[k] * n; return T(Math.pow(t.c, n), v); };
function monoH(t, first) {
  const vs = Object.keys(t.v).filter(k => t.v[k]).sort();
  const vh = vs.map(k => pv(k, t.v[k])).join('');
  const a = Math.abs(t.c), coef = (a === 1 && vh) ? '' : num(a), body = coef + vh;
  if (first) return (t.c < 0 ? MI : '') + body;
  return (t.c < 0 ? ` ${MI} ` : ' + ') + body;
}
const ph = A => A.length ? A.map((t, i) => monoH(t, i === 0)).join('') : '0';
const phRaw = A => ph(A.filter(t => t.c !== 0));
const mono = t => ph([t]);
const monoP = t => t.c < 0 ? `(${mono(t)})` : mono(t);
const cf = a => a === 1 ? '' : a === -1 ? MI : num(a);

/* ---------- конструкторы задач ---------- */
function choice(correct, wrongs) {
  const seen = new Set([correct]), w = [];
  for (const o of wrongs) { if (!o || seen.has(o.t)) continue; seen.add(o.t); w.push(o); if (w.length === 3) break; }
  return shuffle([{ t: correct, ok: true }, ...w.map(o => ({ t: o.t, ok: false, why: o.why }))]);
}
function numP(o) {
  const p = Object.assign({ kind: 'num' }, o);
  if (!p.ansText) p.ansText = p.ans.map(rh).join('; ');
  const av = p.ans[0][0] / p.ans[0][1];
  p.traps = (p.traps || []).filter(t => t && isFinite(t.v) && Math.abs(t.v - av) > 1e-9);
  return p;
}
const choiceP = (q, correct, wrongs, steps, hint, extra) =>
  Object.assign({ kind: 'choice', q, opts: choice(correct, wrongs), ansText: correct, steps, hint }, extra || {});

/* ---------- рисунки (SVG) ---------- */
const f1 = x => x.toFixed(1);
const svgOpen = (w, h) => `<svg class="fig" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
const txt = (x, y, s, cls) => `<text x="${f1(x)}" y="${f1(y)}" class="${cls || ''}" text-anchor="middle" dominant-baseline="central">${s}</text>`;

function svgSeg(pts, marks) {
  const x0 = 24, x1 = 296, Xp = p => x0 + (x1 - x0) * p, pos = n => Xp(pts.find(q => q.n === n).p);
  let s = svgOpen(320, 52 + marks.length * 24);
  s += `<line x1="${Xp(pts[0].p)}" y1="30" x2="${Xp(pts[pts.length - 1].p)}" y2="30" class="ln"/>`;
  pts.forEach(q => { s += `<circle cx="${f1(Xp(q.p))}" cy="30" r="3.5" class="pt"/>` + txt(Xp(q.p), 13, q.n, 'nm'); });
  marks.forEach((m, i) => {
    const y = 54 + i * 24, a = pos(m.a), b = pos(m.b);
    s += `<path d="M${f1(a)} ${y - 5}V${y + 5}M${f1(a)} ${y}H${f1(b)}M${f1(b)} ${y - 5}V${y + 5}" class="dim${m.hl ? ' hl' : ''}"/>`;
    s += txt((a + b) / 2, y, m.t, 'lb' + (m.hl ? ' hl' : ''));
  });
  return s + '</svg>';
}

function svgRays(rays, arcs, o) {
  o = o || {};
  const cx = 160, cy = o.cy || 110, L = 115, H = o.h || 190, rad = Math.PI / 180;
  const at = (deg, r) => [cx + r * Math.cos(deg * rad), cy - r * Math.sin(deg * rad)];
  let s = svgOpen(320, H);
  rays.forEach(r => {
    const [x, y] = at(r.deg, r.len || L);
    s += `<line x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}" class="ln${r.dash ? ' dash' : ''}"/>`;
    if (r.n) { const [tx, ty] = at(r.deg, (r.len || L) + 12); s += txt(tx, ty, r.n, 'nm'); }
  });
  arcs.forEach(a => {
    let d1 = a.from, d2 = a.to; if (d2 < d1) d2 += 360;
    const rr = a.r || 24, [x1, y1] = at(d1, rr), [x2, y2] = at(d2, rr), large = d2 - d1 > 180 ? 1 : 0;
    s += `<path d="M${f1(x1)} ${f1(y1)}A${rr} ${rr} 0 ${large} 0 ${f1(x2)} ${f1(y2)}" class="arc${a.hl ? ' hl' : ''}"/>`;
    const [tx, ty] = at((d1 + d2) / 2, rr + 15);
    s += txt(tx, ty, a.t, 'lb' + (a.hl ? ' hl' : ''));
  });
  s += `<circle cx="${cx}" cy="${cy}" r="3" class="pt"/>`;
  if (o.o) s += txt(cx, cy + 14, o.o, 'nm');
  return s + '</svg>';
}
const svgCross = (alpha, lab, hl) => svgRays(
  [{ deg: 0 }, { deg: alpha }, { deg: 180 }, { deg: 180 + alpha }],
  [[0, alpha], [alpha, 180], [180, 180 + alpha], [180 + alpha, 360]].map((d, i) => ({ from: d[0], to: d[1], t: lab[i], hl: hl && hl.includes(i + 1), r: 22 })),
  { cy: 95, h: 190 });

function svgPar(alpha, hl) {
  const rad = Math.PI / 180, ya = 62, yb = 142, t = Math.tan(alpha * rad);
  const xt = 170 + 40 / t, xb = 170 - 40 / t, dx = Math.cos(alpha * rad), dy = Math.sin(alpha * rad), ext = 48;
  let s = svgOpen(320, 205);
  s += `<line x1="16" y1="${ya}" x2="294" y2="${ya}" class="ln"/><line x1="16" y1="${yb}" x2="294" y2="${yb}" class="ln"/>`;
  s += `<line x1="${f1(xb - ext * dx)}" y1="${f1(yb + ext * dy)}" x2="${f1(xt + ext * dx)}" y2="${f1(ya - ext * dy)}" class="ln"/>`;
  s += txt(306, ya, 'a', 'nm') + txt(306, yb, 'b', 'nm') + txt(xt + (ext + 10) * dx, ya - (ext + 10) * dy, 'c', 'nm');
  const dirs = [(alpha + 180) / 2, alpha / 2, 180 + alpha / 2, (540 + alpha) / 2];
  [[xt, ya, 1], [xb, yb, 5]].forEach(([cx, cy, n0]) => {
    dirs.forEach((d, i) => {
      const n = n0 + i, x = cx + 19 * Math.cos(d * rad), y = cy - 19 * Math.sin(d * rad);
      s += txt(x, y, n, 'lb sm' + (hl.includes(n) ? ' hl' : ''));
    });
    s += `<circle cx="${f1(cx)}" cy="${cy}" r="2.5" class="pt"/>`;
  });
  return s + '</svg>';
}

function svgTri(aA, aB, o) {
  o = o || {};
  const rad = Math.PI / 180, aC = 180 - aA - aB, ac = Math.sin(aB * rad) / Math.sin(aC * rad);
  let pts = [[0, 0], [1, 0], [ac * Math.cos(aA * rad), ac * Math.sin(aA * rad)]];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), maxy = Math.max(...ys);
  const sc = Math.min(250 / (maxx - minx), 135 / maxy), offx = (320 - (maxx - minx) * sc) / 2;
  pts = pts.map(p => [offx + (p[0] - minx) * sc, 168 - p[1] * sc]);
  const names = o.names || ['A', 'B', 'C'];
  const g = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3];
  const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  let s = svgOpen(320, 192);
  s += `<polygon points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" class="ln"/>`;
  pts.forEach((p, i) => {
    const [ux, uy] = unit(p[0] - g[0], p[1] - g[1]);
    s += txt(p[0] + ux * 14, p[1] + uy * 14, names[i], 'nm');
    const at = o.ang && o.ang[names[i]];
    if (at) { const [vx, vy] = unit(g[0] - p[0], g[1] - p[1]); s += txt(p[0] + vx * 32, p[1] + vy * 32, at, 'lb sm' + (String(at).includes('?') ? ' hl' : '')); }
  });
  const sides = { AB: [0, 1], BC: [1, 2], AC: [0, 2] };
  for (const k in (o.side || {})) {
    const lab = o.side[k]; if (lab === '' || lab == null) continue;
    const [i, j] = sides[k], mx = (pts[i][0] + pts[j][0]) / 2, my = (pts[i][1] + pts[j][1]) / 2, [ux, uy] = unit(mx - g[0], my - g[1]);
    s += txt(mx + ux * 13, my + uy * 13, lab, 'lb sm' + (String(lab).includes('?') ? ' hl' : ''));
  }
  return s + '</svg>';
}

/* =====================================================================
   ГЕНЕРАТОРЫ
   ===================================================================== */
const G = {};

/* ---------- БАЗА 5–6 КЛАСС ---------- */
G.order = lv => {
  const t = lv === 1 ? pick([0, 2]) : lv === 2 ? pick([1, 2, 3]) : pick([1, 3, 4]);
  let e, steps, ans; const traps = [];
  if (t === 0) {
    const a = ri(10, 99), b = ri(2, 9), c = ri(3, 12), m = b * c; ans = a + m;
    e = `${a} + ${b} · ${c}`;
    steps = [`Сначала умножение: ${b} · ${c} = ${m}`, `Потом сложение: ${a} + ${m} = ${ok(ans)}`];
    traps.push({ v: (a + b) * c, why: 'Умножение выполняется раньше сложения, даже если стоит правее.' });
  } else if (t === 1) {
    const a = ri(5, 40), b = ri(5, 40), c = ri(2, 6), s = a + b, m = s * c, d = ri(1, m - 1); ans = m - d;
    e = `(${a} + ${b}) · ${c} − ${d}`;
    steps = [`Сначала скобки: ${a} + ${b} = ${s}`, `Умножение: ${s} · ${c} = ${m}`, `Вычитание: ${m} − ${d} = ${ok(ans)}`];
    traps.push({ v: a + b * c - d, why: 'Действие в скобках выполняется первым.' });
  } else if (t === 2) {
    const b = ri(2, 9), k = ri(3, 25), a = b * k, c = ri(2, 9), d = ri(2, 15), m = c * d; ans = k + m;
    e = `${a} : ${b} + ${c} · ${d}`;
    steps = ['Деление и умножение выполняются раньше сложения', `${a} : ${b} = ${k}`, `${c} · ${d} = ${m}`, `${k} + ${m} = ${ok(ans)}`];
  } else if (t === 3) {
    const c = ri(8, 20), d = ri(1, c - 1), s = c - d, b = ri(2, 6), m = b * s, a = m + ri(5, 80); ans = a - m;
    e = `${a} − ${b} · (${c} − ${d})`;
    steps = [`Скобки: ${c} − ${d} = ${s}`, `Умножение: ${b} · ${s} = ${m}`, `Вычитание: ${a} − ${m} = ${ok(ans)}`];
    traps.push({ v: (a - b) * s, why: 'Умножение выполняется раньше вычитания.' });
  } else {
    const d = ri(2, 9), k = ri(2, 8), c = d * k, a = ri(3, 12), b = ri(3, 12), p = a * b; ans = p - k;
    e = `${a} · ${b} − ${c} : ${d}`;
    steps = ['Умножение и деление — раньше вычитания', `${a} · ${b} = ${p}`, `${c} : ${d} = ${k}`, `${p} − ${k} = ${ok(ans)}`];
  }
  return numP({ q: `Вычислите: ${ex(e)}`, ans: [R(ans)], steps, traps, hint: 'Порядок: скобки → умножение и деление → сложение и вычитание (слева направо).' });
};

const coprimeNum = d => { let n, g = 0; do { n = ri(1, d - 1); g++; } while (gcd(n, d) !== 1 && g < 60); return n; };
G.frac_add = lv => {
  const D = [2, 3, 4, 5, 6, 8, 9, 10, 12];
  for (let tries = 0; tries < 200; tries++) {
    let terms, ops;
    if (lv === 1) { const d = ri(5, 15); terms = [[coprimeNum(d), d], [coprimeNum(d), d]]; ops = [pick(['+', '−'])]; }
    else if (lv === 2) { const b = pick(D); let d = pick(D); while (d === b) d = pick(D); terms = [[coprimeNum(b), b], [coprimeNum(d), d]]; ops = [pick(['+', '−'])]; }
    else { const ds = shuffle(D).slice(0, 3); terms = ds.map(d => [coprimeNum(d), d]); ops = [pick(['+', '−']), pick(['+', '−'])]; }
    const L = terms.reduce((l, t) => lcm(l, t[1]), 1), k = terms.map(t => L / t[1]), nums = terms.map((t, i) => t[0] * k[i]);
    let s = nums[0]; ops.forEach((o, i) => { s += o === '+' ? nums[i + 1] : -nums[i + 1]; });
    if (s <= 0) continue;
    const r = R(s, L);
    const e = terms.map((t, i) => (i ? ` ${ops[i - 1]} ` : '') + frac(t[0], t[1])).join('');
    const numExpr = nums.map((n, i) => (i ? ` ${ops[i - 1]} ` : '') + n).join('');
    const steps = [];
    if (lv === 1) steps.push(`Знаменатели одинаковые — работаем только с числителями, знаменатель оставляем: ${numExpr} = ${s}`);
    else {
      steps.push(`Общий знаменатель — НОК(${terms.map(t => t[1]).join('; ')}) = ${L}`);
      steps.push(`Дополнительные множители: ${terms.map((t, i) => `${L} : ${t[1]} = ${k[i]}`).join(', ')}`);
      steps.push(`Приводим дроби: ${nums.map((n, i) => (i ? ` ${ops[i - 1]} ` : '') + fs(n, L)).join('')}`);
      steps.push(`Считаем числители: ${numExpr} = ${s}`);
    }
    const g = gcd(s, L);
    steps.push(g > 1 ? `${fs(s, L)} — сокращаем на ${g}: ${ok(rh(r))}` : `Получаем ${ok(rh(r))}`);
    if (r[0] > r[1] && r[1] > 1) steps.push(`То же смешанным числом: ${Math.floor(r[0] / r[1])}${fs(r[0] % r[1], r[1])}`);
    const traps = [];
    if (terms.length === 2) {
      const tn = ops[0] === '+' ? terms[0][0] + terms[1][0] : terms[0][0] - terms[1][0];
      const td = ops[0] === '+' ? terms[0][1] + terms[1][1] : terms[0][1] - terms[1][1];
      if (td > 0) traps.push({ v: tn / td, why: 'Знаменатели не складывают и не вычитают. Сначала общий знаменатель, потом действия с числителями.' });
    }
    return numP({ q: `Вычислите: ${ex(e)}`, note: 'Ответ — несократимая дробь, например 5/12', ans: [r], steps, traps, frac: true,
      hint: lv === 1 ? 'Одинаковые знаменатели: складываем (вычитаем) числители, знаменатель тот же.' : 'Приведи дроби к общему знаменателю (НОК знаменателей), потом действуй с числителями.' });
  }
  return G.frac_add(1);
};

G.frac_mul = lv => {
  const rf = () => { const d = ri(2, 9); let n; do { n = ri(1, 12); } while (gcd(n, d) !== 1); return [n, d]; };
  let A, B, op;
  if (lv === 1) { A = rf(); B = rf(); op = '·'; }
  else if (lv === 2) { A = rf(); B = rf(); op = ':'; }
  else { const w = ri(2, 12); op = pick(['·', ':']); if (ri(0, 1)) { A = [w, 1]; B = rf(); } else { A = rf(); B = [w, 1]; } }
  const B2 = op === ':' ? [B[1], B[0]] : B, tn = A[0] * B2[0], td = A[1] * B2[1], r = R(tn, td);
  const steps = [];
  if (A[1] === 1 || B[1] === 1) { const w = A[1] === 1 ? A[0] : B[0]; steps.push(`Целое число записываем дробью: ${w} = ${fs(w, 1)}`); }
  if (op === ':') steps.push(`Деление заменяем умножением на обратную дробь: ${fs(B[0], B[1])} → ${fs(B2[0], B2[1])}`);
  steps.push(`Перемножаем числители и знаменатели: ${fs(A[0] + ' · ' + B2[0], A[1] + ' · ' + B2[1])} = ${fs(tn, td)}`);
  const g = gcd(tn, td);
  steps.push(g > 1 ? `Сокращаем на ${g}: ${ok(rh(r))}` : `Ответ: ${ok(rh(r))}`);
  steps.push('Совет: сокращай ещё до умножения — числа будут меньше.');
  const traps = [];
  if (op === ':') traps.push({ v: A[0] * B[0] / (A[1] * B[1]), why: 'При делении вторую дробь нужно «перевернуть» и умножить.' });
  const show = F => F[1] === 1 ? num(F[0]) : fs(F[0], F[1]);
  return numP({ q: `Вычислите: ${ex(`${show(A)} ${op} ${show(B)}`)}`, note: 'Ответ — несократимая дробь или целое число', ans: [r], steps, traps, frac: true,
    hint: op === ':' ? 'Делить на дробь = умножать на перевёрнутую дробь.' : 'Числитель умножаем на числитель, знаменатель на знаменатель.' });
};

G.dec = lv => {
  const fix2 = h => (h / 100).toFixed(2).replace('.', ',');
  if (lv === 1) {
    let a = ri(100, 9999), b = ri(11, 999); if (ri(0, 1)) a -= a % 10; if (ri(0, 1)) b -= b % 10;
    const op = pick(['+', '−']); if (op === '−' && b > a) [a, b] = [b, a];
    const r = op === '+' ? a + b : a - b;
    return numP({ q: `Вычислите: ${ex(`${num(a / 100)} ${op} ${num(b / 100)}`)}`, ans: [R(r, 100)], ansText: num(r / 100),
      steps: [`Запятая под запятой. Допишем нули, чтобы разрядов было поровну: ${fix2(a)} и ${fix2(b)}`, `${fix2(a)} ${op} ${fix2(b)} = ${ok(num(r / 100))}`],
      hint: 'Записывай столбиком: запятая под запятой, разряд под разрядом.' });
  }
  if (lv === 2) {
    let A; do { A = ri(2, 99); } while (A % 10 === 0);
    if (ri(0, 1)) {
      let B; do { B = ri(2, 30); } while (B % 10 === 0); const Pr = A * B;
      return numP({ q: `Вычислите: ${ex(`${num(A / 10)} · ${num(B / 10)}`)}`, ans: [R(Pr, 100)], ansText: num(Pr / 100),
        steps: [`Умножаем, не обращая внимания на запятые: ${A} · ${B} = ${Pr}`, `В множителях после запятой 1 + 1 = 2 знака — отделяем 2 знака справа: ${ok(num(Pr / 100))}`],
        traps: [{ v: Pr / 10, why: 'Знаков после запятой в ответе столько, сколько во всех множителях вместе: 1 + 1 = 2.' }],
        hint: 'Умножь как целые, потом отдели столько знаков, сколько их всего в множителях.' });
    }
    const B = ri(2, 9), Pr = A * B;
    return numP({ q: `Вычислите: ${ex(`${num(A / 10)} · ${B}`)}`, ans: [R(Pr, 10)], ansText: num(Pr / 10),
      steps: [`Умножаем как целые: ${A} · ${B} = ${Pr}`, `В множителе 1 знак после запятой — отделяем 1 знак: ${ok(num(Pr / 10))}`],
      traps: [{ v: Pr / 100, why: 'В множителях всего 1 знак после запятой — значит, и в ответе 1.' }, { v: Pr, why: 'Не забудь поставить запятую.' }],
      hint: 'Умножь как целые, потом отдели столько знаков, сколько их в множителях.' });
  }
  let C; do { C = ri(2, 99); } while (C % 10 === 0);
  const B = ri(2, 9);
  if (ri(0, 1)) {
    const Ah = B * C;
    return numP({ q: `Вычислите: ${ex(`${num(Ah / 100)} : ${num(B / 10)}`)}`, ans: [R(C, 10)], ansText: num(C / 10),
      steps: [`Делитель ${num(B / 10)} — переносим запятую на 1 знак вправо и в делителе, и в делимом`, `${num(Ah / 100)} : ${num(B / 10)} = ${num(Ah / 10)} : ${B}`, `${num(Ah / 10)} : ${B} = ${ok(num(C / 10))}`],
      traps: [{ v: C / 100, why: 'Запятую в делимом тоже нужно перенести — на столько же знаков, что и в делителе.' }, { v: C, why: 'Проверь, где стоит запятая в ответе.' }],
      hint: 'Сделай делитель целым: перенеси запятую вправо в обоих числах на одинаковое число знаков.' });
  }
  const At = B * C;
  return numP({ q: `Вычислите: ${ex(`${num(At / 10)} : ${B}`)}`, ans: [R(C, 10)], ansText: num(C / 10),
    steps: ['Делим как натуральные числа, а запятую в частном ставим, когда закончилась целая часть делимого', `${num(At / 10)} : ${B} = ${ok(num(C / 10))}`],
    traps: [{ v: C, why: 'Не забудь поставить запятую в частном.' }],
    hint: 'Дели уголком; дошли до запятой в делимом — ставим запятую в частном.' });
};

const sumRule = (x, y) => {
  const r = x + y;
  if (x === 0 || y === 0) return `${num(x)} + ${pn(y)} = ${num(r)}`;
  if ((x < 0) === (y < 0)) return `${num(x)} + ${pn(y)}: знаки одинаковые — складываем модули (${Math.abs(x)} + ${Math.abs(y)} = ${Math.abs(r)}) и ставим общий знак → ${num(r)}`;
  const big = Math.abs(x) >= Math.abs(y) ? x : y;
  return `${num(x)} + ${pn(y)}: знаки разные — из большего модуля вычитаем меньший (${Math.max(Math.abs(x), Math.abs(y))} − ${Math.min(Math.abs(x), Math.abs(y))} = ${Math.abs(r)}), знак берём у числа с бóльшим модулем (${num(big)}) → ${num(r)}`;
};
G.neg_add = lv => {
  const hint = 'Одинаковые знаки — складываем модули. Разные — вычитаем меньший модуль из большего, знак как у «более сильного» числа.';
  if (lv < 3) {
    const m = lv === 1 ? 20 : 60;
    const a = rnz(-m, m); let b = rnz(-m, m); if (a > 0 && b > 0) b = -b;
    const op = lv === 1 ? '+' : pick(['+', '−']), bb = op === '+' ? b : -b, r = a + bb;
    const steps = [];
    if (op === '−') steps.push(`Вычитание заменяем сложением с противоположным числом: ${num(a)} − ${pn(b)} = ${num(a)} + ${pn(bb)}`);
    steps.push(sumRule(a, bb)); steps.push(`Ответ: ${ok(num(r))}`);
    const traps = [{ v: -r, why: 'Ошибка в знаке ответа. Знак берём у числа с бóльшим модулем.' }];
    if (op === '−') traps.push({ v: a + b, why: 'Вычесть число = прибавить противоположное: a − (−b) = a + b, a − b = a + (−b).' });
    return numP({ q: `Вычислите: ${ex(`${num(a)} ${op} ${pn(b)}`)}`, ans: [R(r)], steps, traps, hint });
  }
  const a = rnz(-30, 30), b = rnz(-30, 30), c = rnz(-30, 30), o1 = pick(['+', '−']), o2 = pick(['+', '−']);
  const b2 = o1 === '+' ? b : -b, c2 = o2 === '+' ? c : -c, s1 = a + b2, r = s1 + c2;
  return numP({ q: `Вычислите: ${ex(`${num(a)} ${o1} ${pn(b)} ${o2} ${pn(c)}`)}`, ans: [R(r)],
    steps: [`Заменяем вычитание сложением: ${num(a)} + ${pn(b2)} + ${pn(c2)}`, sumRule(a, b2), sumRule(s1, c2), `Ответ: ${ok(num(r))}`],
    traps: [{ v: -r, why: 'Ошибка в знаке ответа.' }], hint });
};

G.neg_mul = lv => {
  const signTxt = k => k % 2 === 0 ? 'чётное → результат положительный' : 'нечётное → результат отрицательный';
  const hint = 'Считаем модули, а знак — по числу минусов: чётное — плюс, нечётное — минус.';
  let e, r, k, mods;
  if (lv === 1) { const a = pm(2, 12), b = rnz(-12, 12); const A = (a > 0 && b > 0) ? -a : a; r = A * b; k = [A, b].filter(x => x < 0).length; e = `${num(A)} · ${pn(b)}`; mods = `${Math.abs(A)} · ${Math.abs(b)} = ${Math.abs(r)}`; }
  else if (lv === 2) { let b = pm(2, 12); const q0 = rnz(-15, 15); if (b > 0 && q0 > 0) b = -b; const a = b * q0; r = q0; k = [a, b].filter(x => x < 0).length; e = `${num(a)} : ${pn(b)}`; mods = `${Math.abs(a)} : ${Math.abs(b)} = ${Math.abs(r)}`; }
  else { const f = [pm(2, 9), pm(2, 6), pm(2, 5)]; if (f.every(x => x > 0)) f[1] = -f[1]; r = f[0] * f[1] * f[2]; k = f.filter(x => x < 0).length; e = f.map((x, i) => i ? pn(x) : num(x)).join(' · '); mods = `${f.map(Math.abs).join(' · ')} = ${Math.abs(r)}`; }
  return numP({ q: `Вычислите: ${ex(e)}`, ans: [R(r)], steps: [`Модули: ${mods}`, `Количество минусов: ${k} — ${signTxt(k)}`, `Ответ: ${ok(num(r))}`],
    traps: [{ v: -r, why: 'Знак неверный: посчитай количество минусов. Минус на минус даёт плюс.' }], hint });
};

G.percent = lv => {
  const PS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
  if (lv < 3) {
    const p = pick(PS), base = 100 / gcd(p, 100), N = base * ri(Math.ceil(20 / base), Math.max(Math.ceil(20 / base), Math.floor(800 / base))), part = N * p / 100;
    if (lv === 1) return numP({ q: `Найдите ${p}% от числа ${N}.`, ans: [R(part)],
      steps: [`${p}% — это ${fs(p, 100)} = ${num(p / 100)}`, `${N} · ${num(p / 100)} = ${ok(num(part))}`, 'Или так: 1% = число : 100, потом умножаем на нужное количество процентов.'],
      traps: [{ v: N * p, why: 'Процент — это сотая часть. После умножения нужно разделить на 100.' }], hint: 'p% от числа = число · p : 100' });
    return numP({ q: `${p}% числа равны ${num(part)}. Найдите это число.`, ans: [R(N)],
      steps: [`1% числа: ${num(part)} : ${p} = ${num(part / p)}`, `Всё число — это 100%: ${num(part / p)} · 100 = ${ok(num(N))}`],
      traps: [{ v: part * p / 100, why: 'Здесь известна часть, а найти нужно всё число (100%). Делим часть на проценты и умножаем на 100.' }], hint: 'Число = часть : p · 100' });
  }
  if (ri(0, 1)) {
    const b = pick([20, 25, 40, 50, 80, 200, 250, 400, 500]), p = pick(PS.filter(x => b * x % 100 === 0)), a = b * p / 100;
    return numP({ q: `Сколько процентов составляет число ${a} от числа ${b}?`, ans: [R(p)], ansText: `${p}`, unit: '%',
      steps: [`Делим часть на целое: ${a} : ${b} = ${num(a / b)}`, `Переводим в проценты (умножаем на 100): ${ok(p)}%`],
      traps: [{ v: a / b, why: 'Чтобы получить проценты, результат деления умножают на 100.' }], hint: 'Процент = часть : целое · 100' });
  }
  const p = pick([10, 20, 25, 30, 40, 50]), price = 100 * ri(2, 30), up = ri(0, 1), d = price * p / 100, np = up ? price + d : price - d;
  return numP({ q: `Цена товара ${price} руб. Её ${up ? 'повысили' : 'снизили'} на ${p}%. Какой стала цена (в рублях)?`, ans: [R(np)],
    steps: [`${p}% от ${price}: ${price} · ${p} : 100 = ${d}`, `${price} ${up ? '+' : '−'} ${d} = ${ok(np)}`],
    traps: [{ v: d, why: 'Это только изменение цены. Его нужно прибавить к исходной цене или вычесть из неё.' }], hint: 'Найди, сколько рублей составляют проценты, потом прибавь или вычти.' });
};

G.proportion = lv => {
  if (lv === 1) {
    for (;;) {
      const a = ri(2, 15), b = ri(2, 15), m = a * b, divs = [];
      for (let d = 2; d <= 30; d++) if (m % d === 0 && d !== a && d !== b) divs.push(d);
      if (!divs.length) continue;
      const c = pick(divs), x = m / c;
      return numP({ q: `Решите пропорцию: ${ex(`${fs(V('x'), a)} = ${fs(b, c)}`)}`, ans: [R(x)],
        steps: ['Основное свойство пропорции: произведение крайних членов равно произведению средних (крест-накрест)', `${V('x')} · ${c} = ${a} · ${b}`, `${V('x')} · ${c} = ${m}`, `${V('x')} = ${m} : ${c} = ${ok(x)}`],
        hint: 'Перемножь «крест-накрест»: x · знаменатель справа = числитель справа · знаменатель слева.' });
    }
  }
  if (lv === 2) {
    const t = ri(0, 2);
    if (t === 0) {
      const item = pick(['яблок', 'конфет', 'груш', 'печенья', 'сыра']), k = ri(2, 6), pr = ri(4, 30) * 10, m = ri(2, 9);
      return numP({ q: `${k} кг ${item} стоят ${k * pr} руб. Сколько рублей стоят ${m} кг ${item}?`, ans: [R(pr * m)],
        steps: ['Стоимость прямо пропорциональна количеству', `Цена 1 кг: ${k * pr} : ${k} = ${pr} руб.`, `${m} кг: ${pr} · ${m} = ${ok(pr * m)} руб.`], hint: 'Найди цену одного килограмма.' });
    }
    if (t === 1) {
      const v = ri(4, 9) * 10, t1 = ri(2, 5), t2 = ri(2, 7);
      return numP({ q: `Машина за ${t1} ч проезжает ${v * t1} км. Сколько километров она проедет за ${t2} ч с той же скоростью?`, ans: [R(v * t2)],
        steps: ['Путь прямо пропорционален времени', `Скорость: ${v * t1} : ${t1} = ${v} км/ч`, `${v} · ${t2} = ${ok(v * t2)} км`], hint: 'Найди, сколько километров машина проезжает за 1 час.' });
    }
    const p = ri(3, 12), a = ri(2, 6), b = ri(3, 10);
    return numP({ q: `Принтер печатает ${p * a} стр. за ${a} мин. Сколько страниц он напечатает за ${b} мин?`, ans: [R(p * b)],
      steps: ['Количество страниц прямо пропорционально времени', `За 1 мин: ${p * a} : ${a} = ${p} стр.`, `${p} · ${b} = ${ok(p * b)}`], hint: 'Сколько страниц за 1 минуту?' });
  }
  for (;;) {
    if (ri(0, 1)) {
      const w1 = ri(2, 8), t1 = ri(2, 12), tot = w1 * t1, opts = [];
      for (let w = 2; w <= 24; w++) if (tot % w === 0 && w !== w1) opts.push(w);
      if (!opts.length) continue;
      const w2 = pick(opts), t2 = tot / w2;
      return numP({ q: `${w1} рабочих выполняют заказ за ${t1} дн. За сколько дней выполнят этот заказ ${w2} рабочих, если работают так же?`, ans: [R(t2)],
        steps: ['Величины обратно пропорциональны: больше рабочих — меньше дней', `Вся работа в «человеко-днях»: ${w1} · ${t1} = ${tot}`, `${tot} : ${w2} = ${ok(t2)} дн.`],
        traps: [{ v: t1 * w2 / w1, why: 'Здесь обратная пропорциональность: чем больше рабочих, тем меньше дней.' }], hint: 'Сначала найди общий объём работы: рабочие · дни.' });
    }
    const v1 = ri(4, 9) * 10, t1 = ri(2, 6), dist = v1 * t1, opts = [];
    for (let v = 20; v <= 150; v += 10) if (dist % v === 0 && v !== v1) opts.push(v);
    if (!opts.length) continue;
    const v2 = pick(opts), t2 = dist / v2;
    return numP({ q: `Со скоростью ${v1} км/ч путь занимает ${t1} ч. Сколько часов займёт этот путь со скоростью ${v2} км/ч?`, ans: [R(t2)],
      steps: ['Скорость и время обратно пропорциональны: быстрее — значит, меньше времени', `Длина пути: ${v1} · ${t1} = ${dist} км`, `${dist} : ${v2} = ${ok(t2)} ч`],
      traps: [{ v: t1 * v2 / v1, why: 'Здесь обратная пропорциональность: чем больше скорость, тем меньше времени.' }], hint: 'Сначала найди длину пути.' });
  }
};

G.brackets = lv => {
  const v = pick(['x', 'a', 'y', 'm']);
  const hint = 'Множитель перед скобкой (вместе со своим знаком) умножаем на КАЖДОЕ слагаемое в скобках.';
  if (lv === 1) {
    const a = pm(2, 9), b = rnz(-9, 9), res = P([X(a, v), K(a * b)]);
    return choiceP(`Раскройте скобки: ${ex(`${cf(a)}(${ph(P([X(1, v), K(b)]))})`)}`, ph(res), [
      { t: ph(P([X(a, v), K(b)])), why: 'На множитель перед скобкой нужно умножить каждое слагаемое, а не только первое.' },
      { t: ph(P([X(a, v), K(-a * b)])), why: 'Проверь знак второго слагаемого: минус на минус — плюс, плюс на минус — минус.' },
      { t: ph(P([X(-a, v), K(a * b)])), why: 'Проверь знак при переменной.' },
      { t: ph(P([X(a + b, v)])), why: 'Число и буквенное слагаемое не складываются в одно.' }],
      [`Умножаем ${num(a)} на каждое слагаемое в скобках`, `${pn(a)} · ${V(v)} = ${mono(X(a, v))}; ${pn(a)} · ${pn(b)} = ${num(a * b)}`, `Ответ: ${ok(ph(res))}`], hint);
  }
  const a = lv === 3 ? pm(2, 9) : ri(2, 9), b = rnz(-9, 9), c = ri(2, 9), d = rnz(-9, 9), s = lv === 2 ? pick([1, -1]) : -1;
  const res = P([X(a, v), K(a * b), X(s * c, v), K(s * c * d)]);
  const e = `${cf(a)}(${ph(P([X(1, v), K(b)]))}) ${s > 0 ? '+' : '−'} ${c}(${ph(P([X(1, v), K(d)]))})`;
  return choiceP(`Упростите выражение: ${ex(e)}`, ph(res), [
    { t: ph(P([X(a, v), K(a * b), X(s * c, v), K(-s * c * d)])), why: 'Множитель перед второй скобкой нужно умножить с его знаком на каждое слагаемое. Минус перед скобкой меняет знаки всех слагаемых.' },
    { t: ph(P([X(a, v), K(b), X(s * c, v), K(s * d)])), why: 'Множитель перед скобкой умножается на каждое слагаемое, а не только на первое.' },
    { t: ph(P([X(a, v), K(a * b), X(-s * c, v), K(s * c * d)])), why: 'Проверь знак у слагаемого с переменной во второй скобке.' },
    { t: ph(P([X(a - s * c, v), K(a * b + s * c * d)])), why: 'Ошибка при приведении подобных: проверь знаки коэффициентов.' }],
    [`Раскрываем первую скобку: ${ph(P([X(a, v), K(a * b)]))}`, `Раскрываем вторую (множитель ${s > 0 ? '' : MI}${c}): ${ph(P([X(s * c, v), K(s * c * d)]))}`,
      `Записываем всё вместе: ${phRaw([X(a, v), K(a * b), X(s * c, v), K(s * c * d)])}`, `Приводим подобные: ${ok(ph(res))}`], hint);
};

G.eq6 = lv => {
  const hint = 'Неизвестное — в одну сторону, числа — в другую. Переносим через «=» — меняем знак.';
  if (lv === 1) {
    const t = ri(0, 3);
    if (t === 0) { const x = ri(-10, 30), a = ri(2, 40), b = x + a;
      return numP({ q: `Решите уравнение: ${ex(`${V('x')} + ${a} = ${num(b)}`)}`, ans: [R(x)], steps: ['Неизвестное слагаемое = сумма − известное слагаемое', `${V('x')} = ${num(b)} − ${a} = ${ok(num(x))}`],
        traps: [{ v: b + a, why: 'Слагаемое переносим в другую часть с противоположным знаком: было +, стало −.' }], hint }); }
    if (t === 1) { const x = ri(-10, 30), a = ri(2, 40), b = x - a;
      return numP({ q: `Решите уравнение: ${ex(`${V('x')} − ${a} = ${num(b)}`)}`, ans: [R(x)], steps: ['Уменьшаемое = разность + вычитаемое', `${V('x')} = ${num(b)} + ${a} = ${ok(num(x))}`],
        traps: [{ v: b - a, why: 'Переносим −' + a + ' вправо со знаком «+».' }], hint }); }
    if (t === 2) { const x = rnz(-12, 15), a = ri(2, 9), b = a * x;
      return numP({ q: `Решите уравнение: ${ex(`${a}${V('x')} = ${num(b)}`)}`, ans: [R(x)], steps: ['Неизвестный множитель = произведение : известный множитель', `${V('x')} = ${num(b)} : ${a} = ${ok(num(x))}`],
        traps: [{ v: b * a, why: 'Чтобы найти множитель, произведение делят, а не умножают.' }, { v: b - a, why: 'Здесь умножение, а не сложение: делим на ' + a + '.' }], hint }); }
    const a = ri(2, 9), q0 = rnz(-9, 12), x = a * q0;
    return numP({ q: `Решите уравнение: ${ex(`${V('x')} : ${a} = ${num(q0)}`)}`, ans: [R(x)], steps: ['Делимое = частное · делитель', `${V('x')} = ${num(q0)} · ${a} = ${ok(num(x))}`],
      traps: [{ v: q0 / a, why: 'Чтобы найти делимое, частное умножают на делитель.' }], hint });
  }
  const x = ri(-12, 12);
  if (lv === 2) {
    const a = pm(2, 9), b = rnz(-20, 20), c = a * x + b;
    return numP({ q: `Решите уравнение: ${ex(`${ph(P([X(a), K(b)]))} = ${num(c)}`)}`, ans: [R(x)],
      steps: [`Переносим ${num(b)} вправо с противоположным знаком: ${mono(X(a))} = ${num(c)} ${sg(-b)}`, `${mono(X(a))} = ${num(c - b)}`, `${V('x')} = ${num(c - b)} : ${pn(a)} = ${ok(num(x))}`],
      traps: [{ v: (c + b) / a, why: 'При переносе через «=» число меняет знак.' }, { v: -x, why: 'Проверь знак при делении на ' + num(a) + '.' }], hint });
  }
  const a = pm(2, 9), b = rnz(-9, 9), c = a * (x + b);
  return numP({ q: `Решите уравнение: ${ex(`${cf(a)}(${ph(P([X(1), K(b)]))}) = ${num(c)}`)}`, ans: [R(x)],
    steps: [`Делим обе части на ${num(a)}: ${ph(P([X(1), K(b)]))} = ${num(c / a)}`, `${V('x')} = ${num(c / a)} ${sg(-b)} = ${ok(num(x))}`, `Можно и через раскрытие скобок: ${ph(P([X(a), K(a * b)]))} = ${num(c)}`],
    traps: [{ v: c / a + b, why: 'Переносим ' + num(b) + ' с противоположным знаком.' }], hint });
};

/* ---------- АЛГЕБРА 7 ---------- */
G.subst = lv => {
  if (lv === 1) {
    const v = pick(['x', 'a', 'b', 'y']), a = rnz(-9, 9), b = rnz(-15, 15), k = rnz(-9, 9), r = a * k + b;
    return numP({ q: `Найдите значение выражения ${ex(ph(P([X(a, v), K(b)])))} при ${V(v)} = ${num(k)}.`, ans: [R(r)],
      steps: [`Подставляем ${V(v)} = ${num(k)} (отрицательное число — в скобках): ${num(a)} · ${pn(k)} ${sg(b)}`, `${num(a * k)} ${sg(b)} = ${ok(num(r))}`],
      traps: [{ v: -a * k + b, why: 'Проверь знак произведения: минус на минус — плюс.' }], hint: 'Подставь число вместо буквы. Отрицательное — обязательно в скобках.' });
  }
  if (lv === 2) {
    const p = rnz(-9, 9), q = rnz(-9, 9), A = rnz(-6, 6), B = rnz(-6, 6), r = p * A + q * B;
    return numP({ q: `Найдите значение выражения ${ex(ph(P([T(p, { a: 1 }), T(q, { b: 1 })])))} при ${V('a')} = ${num(A)}, ${V('b')} = ${num(B)}.`, ans: [R(r)],
      steps: [`Подставляем: ${num(p)} · ${pn(A)} + ${pn(q)} · ${pn(B)}`, `${num(p * A)} ${sg(q * B)} = ${ok(num(r))}`],
      traps: [{ v: p * A - q * B, why: 'Проверь знак второго произведения.' }], hint: 'Подставляй каждую букву в скобках и считай произведения отдельно.' });
  }
  const k = rnz(-6, -1), p = rnz(-8, 8), q = rnz(-12, 12), r = k * k + p * k + q;
  return numP({ q: `Найдите значение выражения ${ex(ph(P([X(1, 'x', 2), X(p), K(q)])))} при ${V('x')} = ${num(k)}.`, ans: [R(r)],
    steps: [`${pn(k)}<sup>2</sup> = ${k * k} — квадрат отрицательного числа положителен`, `${num(p)} · ${pn(k)} = ${num(p * k)}`, `${k * k} ${sg(p * k)} ${sg(q)} = ${ok(num(r))}`],
    traps: [{ v: -k * k + p * k + q, why: 'Квадрат отрицательного числа положителен: (−3)² = 9, а не −9.' }], hint: 'Отрицательное число подставляй в скобках: (−3)² = (−3) · (−3).' });
};

G.like = lv => {
  const [u, w] = pick([['a', 'b'], ['x', 'y'], ['m', 'n']]);
  const U = c => T(c, { [u]: 1 }), W = c => T(c, { [w]: 1 });
  const hint = 'Подобные слагаемые — с одинаковой буквенной частью. Складываем только их коэффициенты.';
  if (lv === 1) {
    const p = ri(2, 9), q = rnz(-9, 9), r = rnz(-9, 9), s = rnz(-9, 9), res = P([U(p), W(q), U(r), W(s)]);
    return choiceP(`Приведите подобные слагаемые: ${ex(phRaw([U(p), W(q), U(r), W(s)]))}`, ph(res), [
      { t: mono(T(p + q + r + s, { [u]: 1, [w]: 1 })), why: `Складывать можно только подобные слагаемые: ${u} и ${w} — разные буквы, в одно слагаемое их не объединить.` },
      { t: ph(P([U(p - r), W(q + s)])), why: `Проверь знак перед ${num(Math.abs(r))}${u}: коэффициент берём вместе со знаком.` },
      { t: ph(P([U(p + r), W(q - s)])), why: `Проверь знак перед ${num(Math.abs(s))}${w}.` },
      { t: ph(P([U(p + r + q + s)])), why: 'Слагаемые с разными буквами не складываются.' }],
      [`Группируем: (${phRaw([U(p), U(r)])}) + (${phRaw([W(q), W(s)])})`, `${p} ${sg(r)} = ${p + r};  ${num(q)} ${sg(s)} = ${q + s}`, `Ответ: ${ok(ph(res))}`], hint);
  }
  if (lv === 2) {
    const U2 = c => T(c, { [u]: 2 });
    const p = ri(2, 9), q = rnz(-9, 9), r = rnz(-9, 9), s = rnz(-9, 9), res = P([U2(p), U(q), U2(r), U(s)]);
    return choiceP(`Приведите подобные слагаемые: ${ex(phRaw([U2(p), U(q), U2(r), U(s)]))}`, ph(res), [
      { t: mono(T(p + q + r + s, { [u]: 3 })), why: `${u}² и ${u} — НЕ подобные: степени разные. И показатели при сложении не складываются.` },
      { t: ph(P([U2(p + q), U(r + s)])), why: 'Подобные — с одинаковой буквой в одинаковой степени. Группируй по степеням.' },
      { t: ph(P([U2(p - r), U(q + s)])), why: 'Проверь знак коэффициента.' },
      { t: ph(P([U2(p + r), U(q - s)])), why: 'Проверь знак коэффициента.' }],
      [`Подобные: слагаемые с ${u}² и слагаемые с ${u}`, `${u}²: ${p} ${sg(r)} = ${p + r};  ${u}: ${num(q)} ${sg(s)} = ${q + s}`, `Ответ: ${ok(ph(res))}`], hint);
  }
  const p = ri(2, 9), r = ri(2, 9), s = rnz(-9, 9), q = rnz(-9, 9);
  const res = P([U(p), U(-r), W(s), W(q)]);
  const e = `${mono(U(p))} − (${ph(P([U(r), W(-s)]))})${monoH(W(q), false)}`;
  return choiceP(`Упростите выражение: ${ex(e)}`, ph(res), [
    { t: ph(P([U(p - r), W(-s + q)])), why: 'Минус перед скобкой меняет знаки ВСЕХ слагаемых в скобках, а не только первого.' },
    { t: ph(P([U(p + r), W(s + q)])), why: 'Минус перед скобкой: первое слагаемое тоже меняет знак.' },
    { t: ph(P([U(p - r), W(s - q)])), why: 'Проверь знак у последнего слагаемого.' }],
    [`Раскрываем скобки, меняя знаки: ${phRaw([U(p), U(-r), W(s), W(q)])}`, `Приводим подобные: ${ok(ph(res))}`],
    'Минус перед скобкой: раскрываем, меняя знаки всех слагаемых внутри.');
};

G.lin_eq = lv => {
  const x = ri(-12, 12);
  const hint = 'Слагаемые с x — влево, числа — вправо (меняя знак при переносе). Потом делим на коэффициент.';
  if (lv === 1) {
    const a = pm(2, 9), b = rnz(-20, 20), c = a * x + b;
    return numP({ q: `Решите уравнение: ${ex(`${ph(P([X(a), K(b)]))} = ${num(c)}`)}`, ans: [R(x)],
      steps: [`Переносим ${num(b)} вправо с противоположным знаком: ${mono(X(a))} = ${num(c)} ${sg(-b)}`, `${mono(X(a))} = ${num(c - b)}`, `${V('x')} = ${num(c - b)} : ${pn(a)} = ${ok(num(x))}`],
      traps: [{ v: (c + b) / a, why: 'При переносе через «=» число меняет знак.' }, { v: -x, why: 'Проверь знак при делении.' }], hint });
  }
  if (lv === 2) {
    const a = rnz(-9, 9); let c = rnz(-9, 9); while (c === a) c = rnz(-9, 9);
    const b = rnz(-20, 20), d = a * x + b - c * x;
    return numP({ q: `Решите уравнение: ${ex(`${ph(P([X(a), K(b)]))} = ${ph(P([X(c), K(d)]))}`)}`, ans: [R(x)],
      steps: [`Переносим ${mono(X(c))} влево, а ${num(b)} вправо — с противоположными знаками: ${phRaw([X(a), X(-c)])} = ${phRaw([K(d), K(-b)])}`,
        `${ph(P([X(a - c)]))} = ${num(d - b)}`, `${V('x')} = ${num(d - b)} : ${pn(a - c)} = ${ok(num(x))}`],
      traps: [{ v: (d + b) / (a - c), why: 'При переносе через знак «=» слагаемое меняет знак.' }, { v: (d - b) / (a + c), why: 'Слагаемое с x при переносе влево тоже меняет знак.' }], hint });
  }
  if (ri(0, 1)) {
    const a = ri(2, 9); let c = ri(2, 9); while (c === a) c = ri(2, 9);
    const b = rnz(-9, 9), d = rnz(-9, 9), e = a * (x + b) - c * (x - d), k0 = a * b + c * d;
    return numP({ q: `Решите уравнение: ${ex(`${a}(${ph(P([X(1), K(b)]))}) − ${c}(${ph(P([X(1), K(-d)]))}) = ${num(e)}`)}`, ans: [R(x)],
      steps: [`Раскрываем скобки (минус перед второй меняет знаки): ${phRaw([X(a), K(a * b), X(-c), K(c * d)])} = ${num(e)}`,
        `Приводим подобные: ${ph(P([X(a - c), K(k0)]))} = ${num(e)}`, `${ph(P([X(a - c)]))} = ${num(e)} ${sg(-k0)} = ${num(e - k0)}`, `${V('x')} = ${num(e - k0)} : ${pn(a - c)} = ${ok(num(x))}`],
      traps: [{ v: (e - a * b + c * d) / (a - c), why: 'Минус перед скобкой меняет знаки всех слагаемых в ней: −3(x − 2) = −3x + 6.' }], hint });
  }
  let p = pick([2, 3, 4, 5, 6]), q = pick([2, 3, 4, 5, 6]); while (q === p) q = pick([2, 3, 4, 5, 6]);
  const L = lcm(p, q), xx = L * rnz(-4, 4), r = xx / p + xx / q;
  return numP({ q: `Решите уравнение: ${ex(`${fs(V('x'), p)} + ${fs(V('x'), q)} = ${num(r)}`)}`, ans: [R(xx)],
    steps: [`Умножаем обе части на общий знаменатель ${L}: ${phRaw([X(L / p), X(L / q)])} = ${num(r * L)}`, `${mono(X(L / p + L / q))} = ${num(r * L)}`, `${V('x')} = ${num(r * L)} : ${L / p + L / q} = ${ok(num(xx))}`],
    hint: 'Избавься от дробей: умножь обе части уравнения на общий знаменатель.' });
};

G.word_eq = lv => {
  const tpl = lv === 1 ? pick(['ratio', 'diff']) : lv === 2 ? pick(['rect', 'shift', 'diff']) : pick(['meet', 'shift', 'rect']);
  const hint = 'Обозначь за x то, что спрашивают (или меньшую величину). Вырази остальное через x и составь уравнение.';
  const xx = V('x');
  if (tpl === 'ratio') {
    const k = ri(2, 5), x = ri(6, 40), S = x * (k + 1);
    return numP({ q: `На первой полке в ${k} ${raz(k)} больше книг, чем на второй. Всего книг на двух полках: ${S}. Сколько книг на второй полке?`, ans: [R(x)],
      steps: [`Пусть на второй полке ${xx} книг, тогда на первой — ${k}${xx}`, `Уравнение: ${xx} + ${k}${xx} = ${S}`, `${k + 1}${xx} = ${S}`, `${xx} = ${S} : ${k + 1} = ${ok(x)}`],
      traps: [{ v: S / k, why: 'Всего частей не ' + k + ', а ' + (k + 1) + ': x + ' + k + 'x.' }, { v: k * x, why: 'Это количество на первой полке, а спрашивают про вторую.' }], hint });
  }
  if (tpl === 'diff') {
    const x = ri(5, 60), d = ri(2, 30), S = 2 * x + d;
    return numP({ q: `Сумма двух чисел равна ${S}, одно из них на ${d} больше другого. Найдите меньшее число.`, ans: [R(x)],
      steps: [`Пусть меньшее число ${xx}, тогда большее ${xx} + ${d}`, `Уравнение: ${xx} + ${xx} + ${d} = ${S}`, `2${xx} = ${S - d}`, `${xx} = ${ok(x)}`],
      traps: [{ v: x + d, why: 'Это большее число, а спрашивают меньшее.' }, { v: (S + d) / 2, why: 'Переносим ' + d + ' вправо со знаком «−».' }], hint });
  }
  if (tpl === 'rect') {
    const x = ri(2, 25), d = ri(1, 15), Pm = 2 * (2 * x + d);
    return numP({ q: `Длина прямоугольника на ${d} см больше ширины, периметр равен ${Pm} см. Найдите ширину (в см).`, ans: [R(x)],
      steps: [`Пусть ширина ${xx} см, тогда длина ${xx} + ${d}`, `Периметр: 2(${xx} + ${xx} + ${d}) = ${Pm}`, `${xx} + ${xx} + ${d} = ${Pm / 2}`, `2${xx} = ${Pm / 2 - d}, ${xx} = ${ok(x)}`],
      traps: [{ v: (Pm - d) / 2, why: 'Периметр — это сумма ВСЕХ четырёх сторон: 2 · (длина + ширина).' }], hint });
  }
  if (tpl === 'shift') {
    const k = pick([2, 3]), m = ri(3, 15), x = 2 * m / (k - 1);
    return numP({ q: `В первой коробке в ${k} раза больше карандашей, чем во второй. Когда из первой коробки переложили ${m} шт. во вторую, карандашей в коробках стало поровну. Сколько карандашей было во второй коробке сначала?`, ans: [R(x)],
      steps: [`Пусть во второй коробке было ${xx}, тогда в первой ${k}${xx}`, `После перекладывания: в первой ${k}${xx} − ${m}, во второй ${xx} + ${m}`, `Уравнение: ${k}${xx} − ${m} = ${xx} + ${m}`, `${k - 1 === 1 ? '' : k - 1}${xx} = ${2 * m}`, `${xx} = ${ok(x)}`],
      traps: [{ v: m, why: 'Переложенные карандаши ушли из первой и пришли во вторую — разница изменилась на 2 · ' + m + '.' }], hint });
  }
  const x = ri(8, 16) * 5, d = pick([5, 10, 15, 20]), t = ri(2, 4), S = t * (2 * x + d);
  return numP({ q: `Из двух городов, расстояние между которыми ${S} км, одновременно навстречу друг другу выехали два автомобиля. Скорость одного на ${d} км/ч больше скорости другого. Через ${t} ч они встретились. Найдите скорость более медленного автомобиля (км/ч).`, ans: [R(x)],
    steps: [`Пусть скорость медленного ${xx} км/ч, быстрого ${xx} + ${d}`, `За ${t} ч вместе они проехали всё расстояние: ${t}${xx} + ${t}(${xx} + ${d}) = ${S}`, `${2 * t}${xx} + ${t * d} = ${S}`, `${2 * t}${xx} = ${S - t * d}`, `${xx} = ${ok(x)}`],
    traps: [{ v: x + d, why: 'Это скорость быстрого автомобиля.' }], hint });
};

const linF = (k, b) => `${V('y')} = ${ph(P([X(k), K(b)]))}`;
G.func = lv => {
  const k = rnz(-5, 5);
  if (lv === 1) {
    const b = rnz(-10, 10), x0 = rnz(-6, 6), y0 = k * x0 + b;
    return numP({ q: `Функция задана формулой ${ex(linF(k, b))}. Найдите значение ${V('y')} при ${V('x')} = ${num(x0)}.`, ans: [R(y0)],
      steps: [`Подставляем ${V('x')} = ${num(x0)}: ${V('y')} = ${num(k)} · ${pn(x0)} ${sg(b)}`, `${V('y')} = ${num(k * x0)} ${sg(b)} = ${ok(num(y0))}`],
      traps: [{ v: -k * x0 + b, why: 'Проверь знак произведения.' }], hint: 'Подставь x в формулу и посчитай.' });
  }
  if (lv === 2) {
    const b = rnz(-10, 10);
    if (ri(0, 1)) {
      const x0 = rnz(-8, 8), y0 = k * x0 + b;
      return numP({ q: `При каком значении ${V('x')} значение функции ${ex(linF(k, b))} равно ${num(y0)}?`, ans: [R(x0)],
        steps: [`Подставляем ${V('y')} = ${num(y0)}: ${num(y0)} = ${ph(P([X(k), K(b)]))}`, `${mono(X(k))} = ${num(y0)} ${sg(-b)} = ${num(y0 - b)}`, `${V('x')} = ${num(y0 - b)} : ${pn(k)} = ${ok(num(x0))}`],
        traps: [{ v: (y0 + b) / k, why: 'При переносе b меняет знак.' }], hint: 'Подставь y и реши уравнение относительно x.' });
    }
    const x0 = rnz(-6, 6), yes = ri(0, 1), real = k * x0 + b, y0 = yes ? real : real + pick([-2, -1, 1, 2]);
    return choiceP(`Проходит ли график функции ${ex(linF(k, b))} через точку A(${num(x0)}; ${num(y0)})?`, yes ? 'Да' : 'Нет',
      [{ t: yes ? 'Нет' : 'Да', why: 'Подставь абсциссу точки в формулу и сравни результат с ординатой.' }],
      [`Подставляем ${V('x')} = ${num(x0)}: ${V('y')} = ${num(k)} · ${pn(x0)} ${sg(b)} = ${num(real)}`,
        yes ? `Получили ${num(real)} — совпадает с ординатой точки. ${ok('Проходит')}` : `Получили ${num(real)}, а у точки ордината ${num(y0)}. ${ok('Не проходит')}`],
      'Точка лежит на графике, если при подстановке её x в формулу получается её y.');
  }
  if (ri(0, 1)) {
    const x0 = rnz(-8, 8), b = -k * x0;
    return numP({ q: `Найдите абсциссу точки пересечения графика функции ${ex(linF(k, b))} с осью ${V('Ox')}.`, ans: [R(x0)],
      steps: [`На оси ${V('Ox')} ордината равна нулю: 0 = ${ph(P([X(k), K(b)]))}`, `${mono(X(k))} = ${num(-b)}`, `${V('x')} = ${num(-b)} : ${pn(k)} = ${ok(num(x0))}`],
      traps: [{ v: b, why: 'Это точка пересечения с осью Oy (при x = 0). Для оси Ox подставляем y = 0.' }], hint: 'На оси Ox: y = 0.' });
  }
  let k2 = rnz(-5, 5); while (k2 === k) k2 = rnz(-5, 5);
  const x0 = rnz(-5, 5), y0 = rnz(-9, 9), b1 = y0 - k * x0, b2 = y0 - k2 * x0;
  return numP({ q: `Найдите координаты точки пересечения графиков функций ${ex(linF(k, b1))} и ${ex(linF(k2, b2))}.`, ans: [R(x0), R(y0)], labels: ['x', 'y'],
    ansText: `(${num(x0)}; ${num(y0)})`,
    steps: [`В точке пересечения значения ${V('y')} равны: ${ph(P([X(k), K(b1)]))} = ${ph(P([X(k2), K(b2)]))}`, `${ph(P([X(k - k2)]))} = ${num(b2 - b1)}`, `${V('x')} = ${num(x0)}`,
      `${V('y')} = ${num(k)} · ${pn(x0)} ${sg(b1)} = ${num(y0)}`, `Ответ: ${ok(`(${num(x0)}; ${num(y0)})`)}`],
    hint: 'Приравняй правые части формул и найди x, потом подставь его в любую формулу.' });
};

G.power = lv => {
  if (lv === 1) {
    if (ri(0, 1)) {
      const b = ri(2, 5), e = b === 2 ? ri(2, 6) : b === 3 ? ri(2, 4) : ri(2, 3), r = Math.pow(b, e);
      return numP({ q: `Вычислите: ${ex(sup(b, e))}`, ans: [R(r)], steps: [`${sup(b, e)} = ${Array(e).fill(b).join(' · ')} = ${ok(r)}`],
        traps: [{ v: b * e, why: `Степень — это не умножение основания на показатель: ${b}${'<sup>' + e + '</sup>'} = ${Array(e).fill(b).join(' · ')}.` }], hint: 'Показатель говорит, сколько раз основание умножается само на себя.' });
    }
    const b = ri(2, 3), e = ri(2, 5), r = Math.pow(-b, e);
    return numP({ q: `Вычислите: ${ex(`(${MI}${b})<sup>${e}</sup>`)}`, ans: [R(r)],
      steps: [`(${MI}${b})<sup>${e}</sup> = ${Array(e).fill(`(${MI}${b})`).join(' · ')}`, `Минусов ${e} — ${e % 2 ? 'нечётное число, ответ отрицательный' : 'чётное число, ответ положительный'}`, `= ${ok(num(r))}`],
      traps: [{ v: -r, why: 'Отрицательное число в чётной степени — положительное, в нечётной — отрицательное.' }], hint: 'Чётная степень «съедает» минус, нечётная — сохраняет.' });
  }
  if (lv === 2) {
    const t = ri(0, 3);
    if (t === 0) {
      const b = ri(2, 3), e = pick([2, 4]), r = -Math.pow(b, e);
      return numP({ q: `Вычислите: ${ex(`${MI}${sup(b, e)}`)}`, ans: [R(r)],
        steps: [`Минус стоит перед степенью, а не в скобках: ${MI}${sup(b, e)} = ${MI}(${Array(e).fill(b).join(' · ')})`, `= ${ok(num(r))}`],
        traps: [{ v: -r, why: `Здесь нет скобок: в степень возводится только ${b}, минус остаётся. ${MI}${b}² = ${MI}${b * b}, а (${MI}${b})² = ${b * b}.` }], hint: 'Без скобок минус не возводится в степень.' });
    }
    if (t === 1) {
      const b = ri(1, 9), e = b <= 5 ? pick([2, 3]) : 2, r = R(Math.pow(b, e), Math.pow(10, e));
      return numP({ q: `Вычислите: ${ex(sup(num(b / 10), e))}`, ans: [r], ansText: num(r[0] / r[1]),
        steps: [`${sup(num(b / 10), e)} = ${Array(e).fill(num(b / 10)).join(' · ')}`, `${b}<sup>${e}</sup> = ${Math.pow(b, e)}; знаков после запятой: ${e}`, `= ${ok(num(r[0] / r[1]))}`],
        traps: [{ v: Math.pow(b, e) / 10, why: `Знаков после запятой в результате ${e}: 0,3² = 0,09, а не 0,9.` }, { v: b * e / 10, why: 'Степень — это не умножение на показатель.' }], hint: 'Возведи как целое, потом отдели знаки: их столько, сколько всего у множителей.' });
    }
    if (t === 2) {
      const q = ri(2, 5), p = coprimeNum(q), e = pick([2, 3]), r = R(Math.pow(p, e), Math.pow(q, e));
      return numP({ q: `Вычислите: ${ex(`(${fs(p, q)})<sup>${e}</sup>`)}`, ans: [r], frac: true,
        steps: [`В степень возводятся и числитель, и знаменатель: ${fs(sup(p, e), sup(q, e))} = ${ok(rh(r))}`],
        traps: [{ v: Math.pow(p, e) / q, why: 'Знаменатель тоже нужно возвести в степень.' }], hint: '(a/b)ⁿ = aⁿ / bⁿ' });
    }
    const n = ri(10, 99), r = n % 2 ? -1 : 1;
    return numP({ q: `Вычислите: ${ex(`(${MI}1)<sup>${n}</sup>`)}`, ans: [R(r)], steps: [`Показатель ${n} — ${n % 2 ? 'нечётный' : 'чётный'}`, `(${MI}1) в ${n % 2 ? 'нечётной' : 'чётной'} степени = ${ok(num(r))}`],
      traps: [{ v: -r, why: 'Чётная степень — плюс, нечётная — минус.' }], hint: 'Смотри только на чётность показателя.' });
  }
  const c = ri(2, 5), a = ri(2, 5), b = ri(2, 3), r = c * a * a + Math.pow(b, 3);
  return numP({ q: `Вычислите: ${ex(`${c} · ${sup(a, 2)} − (${MI}${b})<sup>3</sup>`)}`, ans: [R(r)],
    steps: ['Сначала степени, потом умножение, потом вычитание', `${sup(a, 2)} = ${a * a};  (${MI}${b})<sup>3</sup> = ${num(-Math.pow(b, 3))}`, `${c} · ${a * a} − (${num(-Math.pow(b, 3))}) = ${c * a * a} + ${Math.pow(b, 3)} = ${ok(r)}`],
    traps: [{ v: c * a * a - Math.pow(b, 3), why: 'Минус на минус: −(−8) = +8.' }, { v: Math.pow(c * a, 2) + Math.pow(b, 3), why: `Степень выполняется раньше умножения: ${c} · ${a}² = ${c} · ${a * a}.` }],
    hint: 'Порядок: степень → умножение → сложение/вычитание.' });
};

G.power_props = lv => {
  const v = pick(['a', 'b', 'x', 'y', 'c']), vv = V(v);
  const hint = 'aᵐ · aⁿ = aᵐ⁺ⁿ;  aᵐ : aⁿ = aᵐ⁻ⁿ;  (aᵐ)ⁿ = aᵐⁿ';
  if (lv === 1) {
    const t = ri(0, 2); let m = ri(2, 9), n = ri(2, 9), e, r, rule, trap;
    if (t === 0) { e = `${sup(vv, m)} · ${sup(vv, n)}`; r = m + n; rule = `При умножении степеней с одинаковым основанием показатели складывают: ${m} + ${n} = ${r}`; trap = { v: m * n, why: 'При умножении степеней показатели складывают, а не перемножают.' }; }
    else if (t === 1) { if (m <= n) m = n + ri(1, 6); e = `${sup(vv, m)} : ${sup(vv, n)}`; r = m - n; rule = `При делении показатели вычитают: ${m} − ${n} = ${r}`; trap = { v: m / n, why: 'При делении степеней показатели вычитают, а не делят.' }; }
    else { m = ri(2, 6); n = ri(2, 5); e = `(${sup(vv, m)})<sup>${n}</sup>`; r = m * n; rule = `При возведении степени в степень показатели перемножают: ${m} · ${n} = ${r}`; trap = { v: m + n, why: 'При возведении степени в степень показатели перемножают.' }; }
    return numP({ q: `Представьте в виде степени с основанием ${vv}: ${ex(e)}. В ответ запишите показатель.`, ans: [R(r)],
      steps: [rule, `${e} = ${ok(sup(vv, r))}`], traps: [trap], hint });
  }
  if (lv === 2) {
    const m = ri(2, 4), n = ri(2, 3), p = ri(1, 7), q = ri(1, m * n + p - 1), r = m * n + p - q;
    const e = `(${sup(vv, m)})<sup>${n}</sup> · ${pv(v, p)} : ${sup(vv, q)}`;
    return numP({ q: `Представьте в виде степени с основанием ${vv}: ${ex(e)}. В ответ запишите показатель.`, ans: [R(r)],
      steps: [`(${sup(vv, m)})<sup>${n}</sup> = ${sup(vv, m * n)}`, `${sup(vv, m * n)} · ${pv(v, p)} = ${sup(vv, m * n + p)}`, `${sup(vv, m * n + p)} : ${sup(vv, q)} = ${ok(pv(v, r))}`],
      traps: [{ v: m + n + p - q, why: 'Степень в степень — показатели перемножают.' }], hint });
  }
  const b = pick([2, 3, 5]), s = b === 2 ? ri(1, 6) : b === 3 ? ri(1, 4) : ri(1, 3), r = Math.pow(b, s);
  if (ri(0, 1)) {
    const m = ri(3, 9), n = ri(3, 9), p = m + n - s;
    return numP({ q: `Вычислите: ${ex(`${fs(`${sup(b, m)} · ${sup(b, n)}`, sup(b, p))}`)}`, ans: [R(r)],
      steps: [`Основания одинаковые: показатели ${m} + ${n} − ${p} = ${s}`, `${sup(b, s)} = ${ok(r)}`], hint: 'Сначала упрости степени по свойствам, потом считай.' });
  }
  const m = ri(2, 5), p = 2 * m - s;
  return numP({ q: `Вычислите: ${ex(`(${sup(b, m)})<sup>2</sup> : ${sup(b, p)}`)}`, ans: [R(r)],
    steps: [`(${sup(b, m)})<sup>2</sup> = ${sup(b, 2 * m)}`, `${sup(b, 2 * m)} : ${sup(b, p)} = ${sup(b, s)} = ${ok(r)}`], hint: 'Сначала упрости степени по свойствам, потом считай.' });
};

G.monomial = lv => {
  const [u, w] = pick([['a', 'b'], ['x', 'y'], ['m', 'n']]);
  const hint = 'Числа перемножаем с числами, одинаковые буквы — складывая показатели.';
  if (lv === 1) {
    const k = pm(2, 6), m = pm(2, 6), p = ri(1, 3), q = ri(1, 3);
    const f1 = T(k, { [u]: p }), f2 = T(m, { [w]: 1 }), f3 = T(1, { [u]: q }), res = mulT(mulT(f1, f2), f3);
    return choiceP(`Запишите одночлен в стандартном виде: ${ex(`${monoP(f1)} · ${monoP(f2)} · ${mono(f3)}`)}`, mono(res), [
      { t: mono(T(-res.c, res.v)), why: 'Проверь знак: посчитай количество минусов.' },
      { t: mono(T(res.c, { [u]: p * q, [w]: 1 })), why: 'При умножении степеней показатели складывают: a² · a³ = a⁵.' },
      { t: mono(T(k + m, res.v)), why: 'Числовые множители перемножают, а не складывают.' },
      { t: mono(T(res.c, { [u]: p, [w]: 1 })), why: `Не забудь множитель ${pv(u, q)} — его степень добавляется.` }],
      [`Числа: ${num(k)} · ${pn(m)} = ${num(k * m)}`, `Буква ${u}: ${pv(u, p)} · ${pv(u, q)} = ${pv(u, p + q)} (показатели складываем)`, `Ответ: ${ok(mono(res))}`], hint);
  }
  if (lv === 2) {
    const A = T(pm(2, 7), { [u]: ri(1, 3), [w]: ri(1, 3) }), B = T(pm(2, 6), { [u]: ri(1, 3), [w]: ri(0, 3) }), res = mulT(A, B);
    const mulExp = T(res.c, { [u]: A.v[u] * B.v[u], [w]: A.v[w] * (B.v[w] || 1) });
    return choiceP(`Выполните умножение: ${ex(`${monoP(A)} · ${monoP(B)}`)}`, mono(res), [
      { t: mono(T(-res.c, res.v)), why: 'Проверь знак произведения.' },
      { t: mono(mulExp), why: 'При умножении степеней показатели складывают, а не перемножают.' },
      { t: mono(T(A.c + B.c, res.v)), why: 'Коэффициенты перемножают.' }],
      [`Коэффициенты: ${num(A.c)} · ${pn(B.c)} = ${num(res.c)}`, `${u}: показатели ${A.v[u]} + ${B.v[u]} = ${res.v[u]};  ${w}: ${A.v[w]} + ${B.v[w] || 0} = ${res.v[w]}`, `Ответ: ${ok(mono(res))}`], hint);
  }
  const c = pm(2, 3), n = c === 3 || c === -3 ? 2 : ri(2, 3), t = T(c, { [u]: ri(1, 4), [w]: ri(1, 2) }), res = powT(t, n);
  const added = {}; for (const k in t.v) added[k] = t.v[k] + n;
  return choiceP(`Возведите в степень: ${ex(`(${mono(t)})<sup>${n}</sup>`)}`, mono(res), [
    { t: mono(T(c, res.v)), why: 'В степень возводится и числовой коэффициент.' },
    { t: mono(T(c * n, res.v)), why: `Коэффициент возводят в степень, а не умножают на ${n}.` },
    { t: mono(T(res.c, added)), why: 'При возведении степени в степень показатели перемножают.' },
    { t: mono(T(-res.c, res.v)), why: 'Проверь знак: отрицательное число в чётной степени — плюс, в нечётной — минус.' }],
    [`Каждый множитель возводим в степень ${n}`, `(${num(c)})<sup>${n}</sup> = ${num(res.c)}`, `${Object.keys(t.v).map(k => `(${pv(k, t.v[k])})<sup>${n}</sup> = ${pv(k, res.v[k])}`).join(';  ')}`, `Ответ: ${ok(mono(res))}`],
    '(abc)ⁿ = aⁿbⁿcⁿ;  (aᵐ)ⁿ = aᵐⁿ');
};

G.poly_add = lv => {
  let A, B;
  if (lv === 1) { A = P([X(pm(1, 9)), K(rnz(-9, 9))]); B = P([X(pm(1, 9)), K(rnz(-9, 9))]); }
  else if (lv === 2) { A = P([X(pm(1, 6), 'x', 2), X(rnz(-9, 9)), K(rnz(-9, 9))]); B = P([X(pm(1, 6), 'x', 2), X(rnz(-9, 9)), K(rnz(-9, 9))]); }
  else { const tr = () => P([T(pm(1, 6), { a: 2 }), T(rnz(-9, 9), { a: 1, b: 1 }), T(rnz(-9, 9), { b: 2 })]); A = tr(); B = tr(); }
  const op = lv === 1 ? pick(['−', '−', '+']) : pick(['−', '+']);
  const res = op === '+' ? addP(A, B) : addP(A, negP(B));
  const wr = [];
  if (op === '−') {
    wr.push({ t: ph(addP(A, B.map((t, i) => i === 0 ? T(-t.c, t.v) : t))), why: 'Минус перед скобкой меняет знаки ВСЕХ слагаемых в скобке, а не только первого.' });
    wr.push({ t: ph(addP(A, B)), why: 'Перед второй скобкой стоит минус — знаки в ней меняются.' });
  } else wr.push({ t: ph(addP(A, negP(B))), why: 'Перед скобкой плюс — знаки не меняются.' });
  wr.push({ t: ph(res.map((t, i) => i === res.length - 1 ? T(-t.c, t.v) : t)), why: 'Проверь знак последнего слагаемого.' });
  wr.push({ t: ph(res.map((t, i) => i === 0 ? T(-t.c, t.v) : t)), why: 'Проверь знак первого слагаемого.' });
  return choiceP(`Упростите: ${ex(`(${ph(A)}) ${op} (${ph(B)})`)}`, ph(res), wr,
    [`Раскрываем скобки${op === '−' ? ' — перед второй минус, меняем знаки всех её слагаемых' : ''}: ${phRaw([...A, ...(op === '+' ? B : negP(B))])}`, `Приводим подобные: ${ok(ph(res))}`],
    'Минус перед скобкой меняет знаки всех слагаемых внутри. Потом — приведение подобных.');
};

G.poly_mul = lv => {
  if (lv === 1) {
    const k = pm(2, 6), p = pm(1, 5), q = rnz(-9, 9), Km = X(k), B = P([X(p), K(q)]), res = mulP([Km], B);
    return choiceP(`Выполните умножение: ${ex(`${mono(Km)}(${ph(B)})`)}`, ph(res), [
      { t: phRaw([mulT(Km, B[0]), B[1]]), why: 'Одночлен умножаем на КАЖДЫЙ член многочлена.' },
      { t: phRaw([X(k * p), K(k * q)]), why: `${V('x')} · ${V('x')} = ${pv('x', 2)}, и второй член тоже получает ${V('x')}.` },
      { t: phRaw([X(k * p, 'x', 2), X(-k * q)]), why: 'Проверь знак второго слагаемого.' }],
      [`${mono(Km)} · ${monoP(B[0])} = ${mono(res[0])}`, `${mono(Km)} · ${pn(q)} = ${mono(X(k * q))}`, `Ответ: ${ok(ph(res))}`], 'a(b + c) = ab + ac');
  }
  if (lv === 2) {
    const a = rnz(-9, 9), b = rnz(-9, 9), A = P([X(1), K(a)]), B = P([X(1), K(b)]), res = mulP(A, B);
    return choiceP(`Выполните умножение: ${ex(`(${ph(A)})(${ph(B)})`)}`, ph(res), [
      { t: ph(P([X(1, 'x', 2), K(a * b)])), why: 'Каждый член первой скобки умножается на каждый член второй — получается 4 произведения, средние не теряем.' },
      { t: ph(P([X(1, 'x', 2), X(a + b), K(-a * b)])), why: 'Проверь знак произведения чисел.' },
      { t: ph(P([X(1, 'x', 2), X(-(a + b)), K(a * b)])), why: 'Проверь знак у слагаемого с x.' },
      { t: ph(P([X(1, 'x', 2), X(a * b), K(a + b)])), why: 'Числа перемножаются, а при x стоит их сумма.' }],
      [`Каждый член первой скобки умножаем на каждый член второй: ${phRaw([X(1, 'x', 2), X(b), X(a), K(a * b)])}`, `Приводим подобные: ${ok(ph(res))}`], '(a + b)(c + d) = ac + ad + bc + bd');
  }
  const p = ri(2, 5), q = ri(1, 4), a = rnz(-7, 7), b = rnz(-7, 7), A = P([X(p), K(a)]), B = P([X(q), K(b)]), res = mulP(A, B);
  return choiceP(`Выполните умножение: ${ex(`(${ph(A)})(${ph(B)})`)}`, ph(res), [
    { t: ph(P([X(p * q, 'x', 2), K(a * b)])), why: 'Потеряны средние слагаемые: каждый член умножаем на каждый.' },
    { t: ph(P([X(p * q, 'x', 2), X(p * b + a * q), K(-a * b)])), why: 'Проверь знак произведения чисел.' },
    { t: ph(P([X(p * q, 'x', 2), X(p * a + b * q), K(a * b)])), why: 'Проверь, что на что умножается: x-член первой скобки умножается на число из второй.' },
    { t: ph(P([X(p + q, 'x', 2), X(p * b + a * q), K(a * b)])), why: 'Коэффициенты при x перемножаются.' }],
    [`Перемножаем почленно: ${phRaw([X(p * q, 'x', 2), X(p * b), X(a * q), K(a * b)])}`, `Приводим подобные: ${ok(ph(res))}`], '(a + b)(c + d) = ac + ad + bc + bd');
};

G.factor = lv => {
  const hint = 'Найди наибольший общий множитель всех слагаемых (число и буквы) и раздели на него каждое слагаемое.';
  if (lv === 1 || lv === 2) {
    let g = ri(2, 9), p, q; do { p = ri(1, 7); q = rnz(-9, 9); } while (gcd(p, q) !== 1 || p === Math.abs(q));
    const withX = lv === 2, inner = P([X(p), K(q)]);
    const expd = withX ? P([X(g * p, 'x', 2), X(g * q)]) : P([X(g * p), K(g * q)]);
    const pre = withX ? `${g}${V('x')}` : `${g}`, correct = `${pre}(${ph(inner)})`;
    const wr = [];
    let d = 0; for (let i = 2; i < g; i++) if (g % i === 0) d = i;
    if (d) wr.push({ t: `${withX ? d + V('x') : d}(${ph(P([X(g / d * p), K(g / d * q)]))})`, why: 'Это не наибольший общий множитель — можно вынести больше.' });
    if (withX) {
      wr.push({ t: `${V('x')}(${ph(P([X(g * p), K(g * q)]))})`, why: `Число ${g} тоже общий множитель — его нужно вынести.` });
      wr.push({ t: `${g}(${ph(P([X(p, 'x', 2), X(q)]))})`, why: `${V('x')} тоже есть в обоих слагаемых — его нужно вынести.` });
    } else wr.push({ t: `${g}(${ph(P([X(p), K(g * q)]))})`, why: 'Каждое слагаемое нужно разделить на вынесенный множитель.' });
    wr.push({ t: `${pre}(${ph(P([X(p), K(-q)]))})`, why: 'Проверь знак: раскрой скобки обратно — должно получиться исходное выражение.' });
    return choiceP(`Вынесите общий множитель за скобки: ${ex(ph(expd))}`, correct, wr,
      [`Общий множитель: ${pre} (НОД чисел ${g * p} и ${Math.abs(g * q)} равен ${g}${withX ? `, и ${V('x')} есть в обоих слагаемых` : ''})`,
        `Делим каждое слагаемое на ${pre}: ${ph(inner)}`, `Ответ: ${ok(correct)}`, 'Проверка: раскрой скобки — получится исходное выражение.'], hint);
  }
  let a = rnz(-7, 7), b = rnz(-7, 7); while (Math.abs(a) === Math.abs(b)) b = rnz(-7, 7);
  const expd = P([T(1, { x: 1, y: 1 }), T(b, { x: 1 }), T(a, { y: 1 }), K(a * b)]);
  const xa = ph(P([X(1), K(a)])), yb = ph(P([X(1, 'y'), K(b)]));
  const correct = `(${xa})(${yb})`;
  return choiceP(`Разложите на множители способом группировки: ${ex(ph(expd))}`, correct, [
    { t: `(${ph(P([X(1), K(b)]))})(${ph(P([X(1, 'y'), K(a)]))})`, why: 'Перепутаны числа: проверь, раскрыв скобки.' },
    { t: `(${ph(P([X(1), K(-a)]))})(${yb})`, why: 'Проверь знаки: раскрой скобки обратно.' },
    { t: `(${xa})(${ph(P([X(1, 'y'), K(-b)]))})`, why: 'Проверь знаки: раскрой скобки обратно.' }],
    [`Группируем: (${phRaw([T(1, { x: 1, y: 1 }), T(b, { x: 1 })])}) + (${phRaw([T(a, { y: 1 }), K(a * b)])})`,
      `Выносим из каждой группы: ${V('x')}(${yb}) ${a < 0 ? MI : '+'} ${Math.abs(a)}(${yb})`, `Общая скобка (${yb}): ${ok(correct)}`],
    'Сгруппируй слагаемые по два так, чтобы в каждой группе было что вынести, и получилась одинаковая скобка.');
};

G.fsu = lv => {
  const xx = V('x');
  if (lv === 1) {
    const a = ri(1, 9), sgn = pick([1, -1]), res = P([X(1, 'x', 2), X(2 * sgn * a), K(a * a)]), s = sgn > 0 ? '+' : '−';
    return choiceP(`Преобразуйте в многочлен: ${ex(`(${ph(P([X(1), K(sgn * a)]))})<sup>2</sup>`)}`, ph(res), [
      { t: ph(P([X(1, 'x', 2), K(a * a)])), why: 'Потеряно удвоенное произведение 2ab. (a + b)² ≠ a² + b²!' },
      { t: ph(P([X(1, 'x', 2), X(sgn * a), K(a * a)])), why: 'Среднее слагаемое — УДВОЕННОЕ произведение: 2 · x · ' + a + '.' },
      { t: ph(P([X(1, 'x', 2), X(2 * sgn * a), K(-a * a)])), why: 'Квадрат числа всегда положителен: последнее слагаемое со знаком «+».' },
      { t: ph(P([X(1, 'x', 2), X(-2 * sgn * a), K(a * a)])), why: 'Знак среднего слагаемого совпадает со знаком в скобке.' }],
      [`Формула: (a ${s} b)² = a² ${s} 2ab + b²`, `Здесь a = ${xx}, b = ${a}`, `${pv('x', 2)} ${s} 2 · ${xx} · ${a} + ${a}² = ${ok(ph(res))}`], '(a ± b)² = a² ± 2ab + b²');
  }
  if (lv === 2) {
    const p = ri(2, 5), a = ri(1, 9);
    if (ri(0, 1)) {
      const sgn = pick([1, -1]), s = sgn > 0 ? '+' : '−', res = P([X(p * p, 'x', 2), X(2 * sgn * p * a), K(a * a)]);
      return choiceP(`Преобразуйте в многочлен: ${ex(`(${ph(P([X(p), K(sgn * a)]))})<sup>2</sup>`)}`, ph(res), [
        { t: ph(P([X(p, 'x', 2), X(2 * sgn * p * a), K(a * a)])), why: `В квадрат возводится весь первый член: (${p}x)² = ${p * p}x².` },
        { t: ph(P([X(p * p, 'x', 2), K(a * a)])), why: 'Потеряно удвоенное произведение 2ab.' },
        { t: ph(P([X(p * p, 'x', 2), X(sgn * p * a), K(a * a)])), why: 'Среднее слагаемое — удвоенное произведение.' }],
        [`(a ${s} b)² = a² ${s} 2ab + b², где a = ${p}${xx}, b = ${a}`, `(${p}${xx})² = ${p * p}${pv('x', 2)};  2 · ${p}${xx} · ${a} = ${2 * p * a}${xx};  ${a}² = ${a * a}`, `Ответ: ${ok(ph(res))}`], '(a ± b)² = a² ± 2ab + b²');
    }
    const res = P([X(p * p, 'x', 2), K(-a * a)]);
    return choiceP(`Выполните умножение: ${ex(`(${ph(P([X(p), K(-a)]))})(${ph(P([X(p), K(a)]))})`)}`, ph(res), [
      { t: ph(P([X(p * p, 'x', 2), K(a * a)])), why: 'Разность квадратов: (a − b)(a + b) = a² − b², со знаком «минус».' },
      { t: ph(P([X(p * p, 'x', 2), X(-2 * p * a), K(a * a)])), why: 'Это квадрат разности. Здесь скобки разные — средние слагаемые взаимно уничтожаются.' },
      { t: ph(P([X(p, 'x', 2), K(-a * a)])), why: `В квадрат возводится весь член: (${p}x)² = ${p * p}x².` }],
      ['Формула разности квадратов: (a − b)(a + b) = a² − b²', `a = ${p}${xx}, b = ${a}`, `Ответ: ${ok(ph(res))}`], '(a − b)(a + b) = a² − b²');
  }
  const t = ri(0, 3);
  if (t === 0) {
    const a = ri(2, 9), correct = `(${xx} − ${a})(${xx} + ${a})`;
    return choiceP(`Разложите на множители: ${ex(ph(P([X(1, 'x', 2), K(-a * a)])))}`, correct, [
      { t: `(${xx} − ${a})<sup>2</sup>`, why: `(x − ${a})² = x² − ${2 * a}x + ${a * a} — это другой многочлен.` },
      { t: `(${xx} + ${a})<sup>2</sup>`, why: 'Квадрат суммы даёт три слагаемых, а здесь разность квадратов.' },
      { t: `(${a} − ${xx})(${a} + ${xx})`, why: `Порядок важен: (${a} − x)(${a} + x) = ${a * a} − x².` }],
      [`${a * a} = ${a}², значит, это разность квадратов: ${pv('x', 2)} − ${a}²`, `a² − b² = (a − b)(a + b)`, `Ответ: ${ok(correct)}`], 'a² − b² = (a − b)(a + b)');
  }
  if (t === 1) {
    const a = ri(2, 9), sgn = pick([1, -1]), s = sgn > 0 ? '+' : '−', correct = `(${xx} ${s} ${a})<sup>2</sup>`;
    return choiceP(`Представьте в виде квадрата двучлена: ${ex(ph(P([X(1, 'x', 2), X(2 * sgn * a), K(a * a)])))}`, correct, [
      { t: `(${xx} ${sgn > 0 ? '−' : '+'} ${a})<sup>2</sup>`, why: 'Знак в скобке совпадает со знаком среднего слагаемого.' },
      { t: `(${xx} − ${a})(${xx} + ${a})`, why: 'Это разность квадратов: x² − ' + a * a + '. Здесь три слагаемых.' },
      { t: `(${xx} ${s} ${2 * a})<sup>2</sup>`, why: `Среднее слагаемое — это 2ab, значит, b = ${2 * a} : 2 = ${a}.` }],
      [`${a * a} = ${a}², среднее слагаемое ${2 * a}${xx} = 2 · ${xx} · ${a}`, `Это ${sgn > 0 ? 'квадрат суммы' : 'квадрат разности'}: ${ok(correct)}`], 'a² ± 2ab + b² = (a ± b)²');
  }
  const t10 = ri(2, 9) * 10, k = ri(1, 4);
  if (t === 2) {
    const n1 = t10 + k, n2 = t10 - k, r = t10 * t10 - k * k;
    return numP({ q: `Вычислите удобным способом: ${ex(`${n1} · ${n2}`)}`, ans: [R(r)],
      steps: [`${n1} · ${n2} = (${t10} + ${k})(${t10} − ${k})`, `= ${t10}² − ${k}² = ${t10 * t10} − ${k * k} = ${ok(r)}`], hint: 'Представь множители как (a + b)(a − b).' });
  }
  const sgn = pick([1, -1]), n = t10 + sgn * k, r = n * n;
  return numP({ q: `Вычислите удобным способом: ${ex(sup(n, 2))}`, ans: [R(r)],
    steps: [`${n}² = (${t10} ${sgn > 0 ? '+' : '−'} ${k})²`, `= ${t10 * t10} ${sgn > 0 ? '+' : '−'} 2 · ${t10} · ${k} + ${k * k} = ${t10 * t10} ${sgn > 0 ? '+' : '−'} ${2 * t10 * k} + ${k * k} = ${ok(r)}`],
    traps: [{ v: t10 * t10 + k * k, why: 'Потеряно удвоенное произведение 2ab.' }], hint: 'Представь число как круглое ± небольшое и используй формулу квадрата.' });
};

G.system = lv => {
  const x = rnz(-6, 6), y = rnz(-6, 6);
  const sys = (e1, e2) => `<span class="sys"><span>${e1}</span><span>${e2}</span></span>`;
  const eq = (a, b, c) => `${ph(P([T(a, { x: 1 }), T(b, { y: 1 })]))} = ${num(c)}`;
  const base = { ans: [R(x), R(y)], labels: ['x', 'y'], ansText: `${V('x')} = ${num(x)}, ${V('y')} = ${num(y)}` };
  if (lv === 1) {
    const a = y - x, b = ri(1, 3), s = b * x + y;
    return numP(Object.assign({ q: `Решите систему уравнений: ${ex(sys(`${V('y')} = ${ph(P([X(1), K(a)]))}`, eq(b, 1, s)))}`,
      steps: [`Из первого уравнения ${V('y')} уже выражен: ${V('y')} = ${ph(P([X(1), K(a)]))}`, `Подставляем во второе: ${mono(X(b))} + ${ph(P([X(1), K(a)]))} = ${num(s)}`,
        `${mono(X(b + 1))} = ${num(s)} ${sg(-a)} = ${num(s - a)}, ${V('x')} = ${ok(num(x))}`, `${V('y')} = ${num(x)} ${sg(a)} = ${ok(num(y))}`],
      hint: 'Способ подстановки: вырази одну переменную и подставь в другое уравнение.' }, base));
  }
  if (lv === 2) {
    let a1 = rnz(-5, 5), a2 = rnz(-5, 5); while (a1 + a2 === 0) a2 = rnz(-5, 5);
    const b = ri(1, 5), c1 = a1 * x + b * y, c2 = a2 * x - b * y;
    return numP(Object.assign({ q: `Решите систему уравнений: ${ex(sys(eq(a1, b, c1), eq(a2, -b, c2)))}`,
      steps: [`Коэффициенты при ${V('y')} противоположны — складываем уравнения: ${ph(P([X(a1 + a2)]))} = ${num(c1 + c2)}`, `${V('x')} = ${num(c1 + c2)} : ${pn(a1 + a2)} = ${ok(num(x))}`,
        `Подставляем в первое: ${num(a1)} · ${pn(x)} + ${b === 1 ? '' : b}${V('y')} = ${num(c1)}`, `${b === 1 ? '' : b}${V('y')} = ${num(c1 - a1 * x)}, ${V('y')} = ${ok(num(y))}`],
      hint: 'Способ сложения: если при y противоположные коэффициенты, сложи уравнения — y исчезнет.' }, base));
  }
  let a1, b1, a2, b2, det;
  do { a1 = rnz(-5, 5); b1 = rnz(-5, 5); a2 = rnz(-5, 5); b2 = rnz(-5, 5); det = a1 * b2 - a2 * b1; } while (det === 0 || Math.abs(b1) === Math.abs(b2));
  const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y;
  return numP(Object.assign({ q: `Решите систему уравнений: ${ex(sys(eq(a1, b1, c1), eq(a2, b2, c2)))}`,
    steps: [`Уравняем коэффициенты при ${V('y')}: первое уравнение умножим на ${pn(b2)}, второе — на ${pn(b1)} и вычтем`,
      `(${num(a1)} · ${pn(b2)} − ${num(a2)} · ${pn(b1)})${V('x')} = ${num(c1)} · ${pn(b2)} − ${num(c2)} · ${pn(b1)}`,
      `${mono(X(det))} = ${num(c1 * b2 - c2 * b1)}, ${V('x')} = ${ok(num(x))}`, `Подставляем ${V('x')} в первое уравнение и находим ${V('y')} = ${ok(num(y))}`],
    hint: 'Умножь уравнения на числа так, чтобы коэффициенты при одной переменной стали равны, и вычти.' }, base));
};

/* ---------- ГЕОМЕТРИЯ 7 ---------- */
G.segments = lv => {
  if (lv === 1) {
    const a = ri(2, 15), b = ri(2, 15), tot = a + b, pts = [{ n: 'A', p: 0 }, { n: 'C', p: a / tot }, { n: 'B', p: 1 }];
    if (ri(0, 1)) return numP({ q: `Точка C лежит на отрезке AB, AC = ${a}, CB = ${b}. Найдите длину отрезка AB.`, ans: [R(tot)],
      fig: svgSeg(pts, [{ a: 'A', b: 'C', t: a }, { a: 'C', b: 'B', t: b }, { a: 'A', b: 'B', t: '?', hl: 1 }]),
      steps: ['Если точка лежит на отрезке, она делит его на две части. Длина отрезка = сумма частей', `AB = AC + CB = ${a} + ${b} = ${ok(tot)}`], hint: 'Длина отрезка равна сумме длин его частей.' });
    return numP({ q: `Точка C лежит на отрезке AB, AB = ${tot}, AC = ${a}. Найдите длину отрезка CB.`, ans: [R(b)],
      fig: svgSeg(pts, [{ a: 'A', b: 'C', t: a }, { a: 'C', b: 'B', t: '?', hl: 1 }, { a: 'A', b: 'B', t: tot }]),
      steps: ['AB = AC + CB, значит CB = AB − AC', `CB = ${tot} − ${a} = ${ok(b)}`], hint: 'Целый отрезок минус известная часть.' });
  }
  if (lv === 2) {
    if (ri(0, 1)) { const a = ri(3, 20);
      return numP({ q: `Точка M — середина отрезка AB, AM = ${a}. Найдите длину отрезка AB.`, ans: [R(2 * a)],
        fig: svgSeg([{ n: 'A', p: 0 }, { n: 'M', p: .5 }, { n: 'B', p: 1 }], [{ a: 'A', b: 'M', t: a }, { a: 'A', b: 'B', t: '?', hl: 1 }]),
        steps: ['Середина делит отрезок на две равные части: AM = MB', `AB = 2 · AM = 2 · ${a} = ${ok(2 * a)}`],
        traps: [{ v: a / 2, why: 'AM — это половина AB, значит AB в 2 раза больше.' }], hint: 'Середина делит отрезок пополам.' }); }
    const s = 4 * ri(2, 10);
    return numP({ q: `Точка M — середина отрезка AB, точка C — середина отрезка AM. AB = ${s}. Найдите длину отрезка CB.`, ans: [R(3 * s / 4)],
      fig: svgSeg([{ n: 'A', p: 0 }, { n: 'C', p: .25 }, { n: 'M', p: .5 }, { n: 'B', p: 1 }], [{ a: 'A', b: 'B', t: s }, { a: 'C', b: 'B', t: '?', hl: 1 }]),
      steps: [`AM = MB = ${s} : 2 = ${s / 2}`, `AC = CM = ${s / 2} : 2 = ${s / 4}`, `CB = CM + MB = ${s / 4} + ${s / 2} = ${ok(3 * s / 4)}`], hint: 'Найди по очереди AM, потом CM.' });
  }
  const ab = ri(2, 9), bc = ri(2, 9), cd = ri(2, 9), tot = ab + bc + cd, p = ab + bc, q = bc + cd;
  return numP({ q: `Точки A, B, C, D лежат на прямой в указанном порядке. AC = ${p}, BD = ${q}, AD = ${tot}. Найдите BC.`, ans: [R(bc)],
    fig: svgSeg([{ n: 'A', p: 0 }, { n: 'B', p: ab / tot }, { n: 'C', p: p / tot }, { n: 'D', p: 1 }], [{ a: 'A', b: 'C', t: p }, { a: 'B', b: 'D', t: q }, { a: 'A', b: 'D', t: tot }]),
    steps: ['AC + BD = (AB + BC) + (BC + CD) = AD + BC — отрезок BC посчитан дважды', `BC = AC + BD − AD = ${p} + ${q} − ${tot} = ${ok(bc)}`],
    hint: 'Сложи AC и BD: какой отрезок вошёл в сумму дважды?' });
};

G.angles = lv => {
  const deg = '°';
  if (lv === 1) {
    let a; do { a = ri(25, 155); } while (a > 80 && a < 100);
    const val = i => i % 2 ? a : 180 - a, g = ri(1, 4); let k = ri(1, 4); while (k === g) k = ri(1, 4);
    const vert = Math.abs(g - k) === 2;
    return numP({ q: `Две прямые пересекаются. ∠${g} = ${val(g)}°. Найдите ∠${k}.`, ans: [R(val(k))], unit: deg,
      fig: svgCross(a, ['1', '2', '3', '4'], [g, k]),
      steps: vert ? [`∠${g} и ∠${k} — вертикальные. Вертикальные углы равны`, `∠${k} = ${ok(val(k))}°`]
        : [`∠${g} и ∠${k} — смежные. Сумма смежных углов 180°`, `∠${k} = 180° − ${val(g)}° = ${ok(val(k))}°`],
      traps: [{ v: 180 - val(k), why: vert ? 'Вертикальные углы равны, а не дополняют друг друга до 180°.' : 'Смежные углы в сумме дают 180°, а не равны.' }],
      hint: 'Вертикальные (напротив) — равны. Смежные (рядом) — в сумме 180°.' });
  }
  if (lv === 2) {
    if (ri(0, 1)) {
      const d = 2 * ri(5, 40), x = (180 - d) / 2;
      return numP({ q: `Один из смежных углов на ${d}° больше другого. Найдите больший угол.`, ans: [R(x + d)], unit: deg,
        fig: svgRays([{ deg: 0 }, { deg: x, n: '' }, { deg: 180 }], [{ from: 0, to: x, t: 'x' }, { from: x, to: 180, t: `x + ${d}`, hl: 1 }]),
        steps: [`Пусть меньший угол x, тогда больший x + ${d}`, `Сумма смежных углов 180°: x + x + ${d} = 180`, `2x = ${180 - d}, x = ${x}°`, `Больший: ${x} + ${d} = ${ok(x + d)}°`],
        traps: [{ v: x, why: 'Это меньший угол, а спрашивают больший.' }], hint: 'Сумма смежных углов 180°. Обозначь меньший за x.' });
    }
    const k = pick([2, 3, 4, 5, 8, 9]), x = 180 / (k + 1);
    return numP({ q: `Один из смежных углов в ${k} ${raz(k)} больше другого. Найдите меньший угол.`, ans: [R(x)], unit: deg,
      fig: svgRays([{ deg: 0 }, { deg: x }, { deg: 180 }], [{ from: 0, to: x, t: 'x', hl: 1 }, { from: x, to: 180, t: `${k}x` }]),
      steps: [`Пусть меньший угол x, тогда больший ${k}x`, `x + ${k}x = 180`, `${k + 1}x = 180, x = ${ok(x)}°`],
      traps: [{ v: k * x, why: 'Это больший угол.' }, { v: 180 / k, why: `Частей всего ${k + 1}: x + ${k}x.` }], hint: 'Сумма смежных углов 180°.' });
  }
  let h; do { h = ri(20, 160); } while (h > 80 && h < 100);
  const S = 2 * h;
  return numP({ q: `При пересечении двух прямых образовалось четыре угла. Сумма двух из них равна ${S}°. Найдите ${h < 90 ? 'больший' : 'меньший'} из четырёх углов.`, ans: [R(180 - h)], unit: deg,
    fig: svgCross(h, ['', '?', '', '?'], [2, 4]),
    steps: [`Сумма смежных углов 180°, а здесь ${S}° — значит, это вертикальные углы. Они равны: ${S} : 2 = ${h}°`, `Смежный с ним угол: 180° − ${h}° = ${ok(180 - h)}°`],
    traps: [{ v: h, why: 'Это один из двух равных вертикальных углов. Спрашивают другой.' }], hint: 'Если сумма двух углов не 180°, то эти углы вертикальные.' });
};

G.bisector = lv => {
  const hint = 'Биссектриса делит угол пополам.';
  if (lv === 1) {
    const a = 2 * ri(20, 85);
    return numP({ q: `Луч OC — биссектриса угла AOB, ∠AOB = ${a}°. Найдите ∠AOC.`, ans: [R(a / 2)], unit: '°',
      fig: svgRays([{ deg: 0, n: 'A' }, { deg: a, n: 'B' }, { deg: a / 2, n: 'C', dash: 1 }], [{ from: 0, to: a / 2, t: '?', hl: 1, r: 30 }], { o: 'O' }),
      steps: ['Биссектриса делит угол на два равных угла', `∠AOC = ${a}° : 2 = ${ok(a / 2)}°`], traps: [{ v: a * 2, why: 'Биссектриса делит угол пополам, а не удваивает.' }], hint });
  }
  if (lv === 2) {
    const b = ri(15, 80);
    return numP({ q: `Луч OC — биссектриса угла AOB, ∠BOC = ${b}°. Найдите угол, смежный с углом AOB.`, ans: [R(180 - 2 * b)], unit: '°',
      fig: svgRays([{ deg: 0, n: 'A' }, { deg: 2 * b, n: 'B' }, { deg: b, n: 'C', dash: 1 }, { deg: 180, n: 'D' }], [{ from: b, to: 2 * b, t: `${b}°`, r: 30 }, { from: 2 * b, to: 180, t: '?', hl: 1, r: 26 }], { o: 'O' }),
      steps: [`∠AOB = 2 · ${b}° = ${2 * b}°`, `Смежный угол: 180° − ${2 * b}° = ${ok(180 - 2 * b)}°`],
      traps: [{ v: 180 - b, why: `Сначала найди весь угол AOB: он в 2 раза больше ${b}°.` }, { v: 2 * b, why: 'Это ∠AOB. Спрашивают смежный с ним.' }], hint });
  }
  const a = 4 * ri(10, 40);
  return numP({ q: `∠AOB = ${a}°. Луч OC — биссектриса угла AOB, луч OD — биссектриса угла AOC. Найдите ∠DOB.`, ans: [R(3 * a / 4)], unit: '°',
    fig: svgRays([{ deg: 0, n: 'A' }, { deg: a, n: 'B' }, { deg: a / 2, n: 'C', dash: 1 }, { deg: a / 4, n: 'D', dash: 1 }], [{ from: a / 4, to: a, t: '?', hl: 1, r: 40 }], { o: 'O' }),
    steps: [`∠AOC = ${a} : 2 = ${a / 2}°`, `∠AOD = ${a / 2} : 2 = ${a / 4}°`, `∠DOB = ∠AOB − ∠AOD = ${a} − ${a / 4} = ${ok(3 * a / 4)}°`], hint });
};

const GEO_BANK = [
  ['Два угла называются смежными, если…', 'одна сторона у них общая, а две другие являются продолжениями одна другой', ['у них общая вершина', 'их сумма равна 90°', 'они равны'], 'Смежные углы: общая вершина и общая сторона, а две другие стороны образуют прямую. Их сумма — 180°.'],
  ['Чему равна сумма смежных углов?', '180°', ['90°', '360°', 'зависит от углов'], 'Смежные углы вместе образуют развёрнутый угол — 180°.'],
  ['Что верно для вертикальных углов?', 'они равны', ['их сумма 180°', 'их сумма 90°', 'один острый, другой тупой'], 'Вертикальные углы равны.'],
  ['Первый признак равенства треугольников — по…', 'двум сторонам и углу между ними', ['двум сторонам и любому углу', 'трём углам', 'стороне и любому углу'], 'Если две стороны и угол между ними одного треугольника равны двум сторонам и углу между ними другого, то треугольники равны.'],
  ['Второй признак равенства треугольников — по…', 'стороне и двум прилежащим к ней углам', ['двум сторонам', 'трём углам', 'стороне и одному углу'], 'Сторона и два угла, прилежащих к ней.'],
  ['Третий признак равенства треугольников — по…', 'трём сторонам', ['трём углам', 'двум сторонам', 'двум углам и стороне'], 'Если три стороны одного треугольника равны трём сторонам другого, треугольники равны.'],
  ['AB = A₁B₁, AC = A₁C₁, ∠A = ∠A₁. По какому признаку равны треугольники ABC и A₁B₁C₁?', 'по первому', ['по второму', 'по третьему', 'они не обязательно равны'], 'Угол A лежит между сторонами AB и AC — это две стороны и угол между ними.'],
  ['AB = A₁B₁, ∠A = ∠A₁, ∠B = ∠B₁. По какому признаку равны треугольники ABC и A₁B₁C₁?', 'по второму', ['по первому', 'по третьему', 'они не обязательно равны'], 'Сторона AB и два прилежащих к ней угла A и B — второй признак.'],
  ['AB = A₁B₁, BC = B₁C₁, AC = A₁C₁. По какому признаку равны треугольники?', 'по третьему', ['по первому', 'по второму', 'они не обязательно равны'], 'Три стороны — третий признак.'],
  ['Медиана треугольника — это отрезок, соединяющий вершину с…', 'серединой противоположной стороны', ['любой точкой противоположной стороны', 'центром треугольника', 'другой вершиной'], 'Медиана идёт из вершины в середину противоположной стороны.'],
  ['Биссектриса треугольника делит пополам…', 'угол треугольника', ['противоположную сторону', 'площадь треугольника', 'периметр'], 'Биссектриса — отрезок, который делит угол пополам.'],
  ['Высота треугольника — это перпендикуляр, проведённый из вершины к…', 'прямой, содержащей противоположную сторону', ['середине противоположной стороны', 'биссектрисе', 'соседней вершине'], 'Высота перпендикулярна противоположной стороне (или её продолжению).'],
  ['В равнобедренном треугольнике углы при основании…', 'равны', ['в сумме дают 180°', 'прямые', 'тупые'], 'Свойство равнобедренного треугольника: углы при основании равны.'],
  ['Биссектриса равнобедренного треугольника, проведённая к основанию, является…', 'и медианой, и высотой', ['только медианой', 'только высотой', 'ни медианой, ни высотой'], 'Это главное свойство равнобедренного треугольника.'],
  ['Чему равна сумма углов треугольника?', '180°', ['360°', '90°', 'зависит от треугольника'], 'Сумма углов любого треугольника — 180°.'],
  ['Внешний угол треугольника равен…', 'сумме двух углов треугольника, не смежных с ним', ['смежному с ним углу треугольника', 'разности двух других углов', '90°'], 'Внешний угол = сумма двух внутренних углов, не смежных с ним.'],
  ['В треугольнике против большей стороны лежит…', 'больший угол', ['меньший угол', 'прямой угол', 'такой же угол, как против меньшей'], 'Против большей стороны лежит больший угол, и наоборот.'],
  ['Существует ли треугольник со сторонами 3, 4 и 8?', 'нет', ['да', 'только прямоугольный', 'только равнобедренный'], '3 + 4 = 7 < 8. Неравенство треугольника: каждая сторона меньше суммы двух других.'],
  ['Если при пересечении двух прямых секущей накрест лежащие углы равны, то прямые…', 'параллельны', ['перпендикулярны', 'пересекаются', 'совпадают'], 'Это признак параллельности прямых.'],
  ['Две параллельные прямые пересечены секущей. Сумма односторонних углов равна…', '180°', ['90°', '360°', 'они равны'], 'Свойство параллельных прямых: сумма односторонних углов 180°.'],
  ['Сколько прямых, параллельных данной, можно провести через точку, не лежащую на ней?', 'только одну', ['две', 'бесконечно много', 'ни одной'], 'Аксиома параллельных прямых.'],
  ['Катет прямоугольного треугольника, лежащий против угла 30°, равен…', 'половине гипотенузы', ['гипотенузе', 'другому катету', 'удвоенной гипотенузе'], 'Катет против угла 30° равен половине гипотенузы.'],
  ['Сумма острых углов прямоугольного треугольника равна…', '90°', ['180°', '60°', '45°'], '180° − 90° = 90°.'],
  ['Гипотенуза — это…', 'сторона, лежащая против прямого угла', ['любая сторона прямоугольного треугольника', 'самая короткая сторона', 'сторона, прилежащая к прямому углу'], 'Гипотенуза лежит против прямого угла и является самой длинной стороной.'],
  ['Сколько прямых можно провести через две различные точки?', 'только одну', ['две', 'бесконечно много', 'ни одной'], 'Через любые две точки проходит прямая, и притом только одна.'],
  ['Хорда, проходящая через центр окружности, называется…', 'диаметром', ['радиусом', 'касательной', 'дугой'], 'Диаметр — хорда через центр, он равен двум радиусам.'],
  ['Какой угол называется тупым?', 'больше 90°, но меньше 180°', ['меньше 90°', 'равный 90°', 'равный 180°'], 'Острый < 90°, прямой = 90°, тупой — от 90° до 180°.'],
  ['Если два угла треугольника равны, то треугольник…', 'равнобедренный', ['прямоугольный', 'равносторонний', 'тупоугольный'], 'Признак равнобедренного треугольника.'],
];
G.geo_theory = () => {
  const [q, a, w, e] = pick(GEO_BANK);
  return choiceP(q, a, w.map(t => ({ t, why: e })), [e], 'Вспомни определение или формулировку теоремы из учебника.');
};

G.isosceles = lv => {
  const fig = (b, s1, s2) => svgTri(68, 68, { side: { AB: b, AC: s1, BC: s2 } });
  const hint = 'В равнобедренном треугольнике две боковые стороны равны. P = 2 · боковая + основание.';
  if (lv === 1) {
    const a = ri(4, 20), b = ri(2, 2 * a - 1);
    return numP({ q: `В равнобедренном треугольнике ABC с основанием AB боковая сторона равна ${a} см, основание ${b} см. Найдите периметр (см).`, ans: [R(2 * a + b)],
      fig: fig(b, a, a), steps: ['Боковые стороны равны: AC = BC', `P = ${a} + ${a} + ${b} = ${ok(2 * a + b)}`], traps: [{ v: a + b, why: 'Боковых сторон две.' }], hint });
  }
  if (lv === 2) {
    const a = ri(4, 20), b = ri(2, 2 * a - 1), Pm = 2 * a + b;
    if (ri(0, 1)) return numP({ q: `Периметр равнобедренного треугольника равен ${Pm} см, основание ${b} см. Найдите боковую сторону (см).`, ans: [R(a)],
      fig: fig(b, '?', '?'), steps: [`На две боковые стороны приходится ${Pm} − ${b} = ${Pm - b}`, `Боковая сторона: ${Pm - b} : 2 = ${ok(a)}`], traps: [{ v: Pm - b, why: 'Это сумма двух боковых сторон — раздели пополам.' }], hint });
    return numP({ q: `Периметр равнобедренного треугольника равен ${Pm} см, боковая сторона ${a} см. Найдите основание (см).`, ans: [R(b)],
      fig: fig('?', a, a), steps: [`Основание = P − 2 · боковая = ${Pm} − ${2 * a} = ${ok(b)}`], traps: [{ v: Pm - a, why: 'Боковых сторон две.' }], hint });
  }
  if (ri(0, 1)) {
    const x = ri(6, 25), d = ri(1, x - 2), b = x - d, Pm = 3 * x - d;
    return numP({ q: `Основание равнобедренного треугольника на ${d} см меньше боковой стороны, периметр ${Pm} см. Найдите основание (см).`, ans: [R(b)],
      fig: fig('x − ' + d, 'x', 'x'), steps: [`Пусть боковая сторона x, основание x − ${d}`, `x + x + x − ${d} = ${Pm}`, `3x = ${Pm + d}, x = ${x}`, `Основание: ${x} − ${d} = ${ok(b)}`],
      traps: [{ v: x, why: 'Это боковая сторона, а спрашивают основание.' }], hint });
  }
  const b = ri(2, 12), Pm = 5 * b;
  return numP({ q: `Боковая сторона равнобедренного треугольника в 2 раза больше основания, периметр ${Pm} см. Найдите основание (см).`, ans: [R(b)],
    fig: fig('x', '2x', '2x'), steps: ['Пусть основание x, боковые стороны по 2x', `x + 2x + 2x = ${Pm}`, `5x = ${Pm}, x = ${ok(b)}`], traps: [{ v: Pm / 3, why: 'Частей всего 5: x + 2x + 2x.' }], hint });
};

G.parallel = lv => {
  const a = ri(35, 80), val = { 1: 180 - a, 2: a, 3: a, 4: 180 - a, 5: 180 - a, 6: a, 7: a, 8: 180 - a };
  const same = (g, k) => (g <= 4) === (k <= 4), vert = ['1-4', '2-3', '5-8', '6-7'];
  const rel = (g, k) => {
    const key = Math.min(g, k) + '-' + Math.max(g, k);
    if (same(g, k)) return vert.includes(key) ? 'vert' : 'adj';
    if (Math.abs(g - k) === 4) return 'corr';
    if (key === '3-6' || key === '4-5') return 'cross';
    if (key === '3-5' || key === '4-6') return 'one';
    return null;
  };
  const NM = { vert: 'вертикальные', adj: 'смежные', corr: 'соответственные', cross: 'накрест лежащие', one: 'односторонние' };
  const RL = { vert: 'вертикальные углы равны', adj: 'сумма смежных углов 180°', corr: 'при параллельных прямых соответственные углы равны', cross: 'при параллельных прямых накрест лежащие углы равны', one: 'при параллельных прямых сумма односторонних углов 180°' };
  const eqR = r => r === 'vert' || r === 'corr' || r === 'cross';
  const explain = (g, k) => {
    const r = rel(g, k);
    if (r) return [`∠${g} и ∠${k} — ${NM[r]}: ${RL[r]}`, eqR(r) ? `∠${k} = ∠${g} = ${val[k]}°` : `∠${k} = 180° − ${val[g]}° = ${val[k]}°`];
    const m = g <= 4 ? g + 4 : g - 4;
    return [`∠${g} и ∠${m} — соответственные, значит ∠${m} = ${val[m]}°`, ...explain(m, k)];
  };
  const hint = 'Все углы на рисунке равны либо α, либо 180° − α. Накрест лежащие и соответственные — равны, односторонние — в сумме 180°.';
  const intro = 'Прямые a и b параллельны, c — секущая.';
  if (lv < 3) {
    const g = ri(1, 8); let ks = [1, 2, 3, 4, 5, 6, 7, 8].filter(k => k !== g && !same(g, k));
    if (lv === 1) ks = ks.filter(k => rel(g, k));
    const k = pick(ks);
    return numP({ q: `${intro} ∠${g} = ${val[g]}°. Найдите ∠${k}.`, ans: [R(val[k])], unit: '°', fig: svgPar(a, [g, k]),
      steps: [...explain(g, k), `Ответ: ${ok(val[k])}°`], traps: [{ v: 180 - val[k], why: 'Проверь: эти углы равны или дают в сумме 180°?' }], hint });
  }
  if (ri(0, 1)) {
    const [p1, p2] = pick([[3, 6], [4, 5]]), S = 2 * val[p1], k = pick([1, 2, 3, 4, 5, 6, 7, 8].filter(x => x !== p1 && x !== p2));
    return numP({ q: `${intro} Сумма углов ∠${p1} и ∠${p2} равна ${S}°. Найдите ∠${k}.`, ans: [R(val[k])], unit: '°', fig: svgPar(a, [p1, p2, k]),
      steps: [`∠${p1} и ∠${p2} — накрест лежащие, они равны: ${S} : 2 = ${val[p1]}°`, ...explain(p1, k).slice(0), `Ответ: ${ok(val[k])}°`], hint });
  }
  const d = 180 - 2 * a, k = pick([1, 2, 4, 6, 7, 8]);
  return numP({ q: `${intro} ∠5 больше ∠3 на ${d}°. Найдите ∠${k}.`, ans: [R(val[k])], unit: '°', fig: svgPar(a, [3, 5, k]),
    steps: ['∠3 и ∠5 — односторонние: ∠3 + ∠5 = 180°', `Пусть ∠3 = x, тогда x + x + ${d} = 180, x = ${a}°`, ...explain(3, k), `Ответ: ${ok(val[k])}°`], hint });
};

G.tri_sum = lv => {
  const hint = 'Сумма углов треугольника 180°. Внешний угол = сумма двух внутренних, не смежных с ним.';
  if (lv === 1) {
    const a = ri(25, 95), b = ri(25, Math.min(95, 155 - a)), c = 180 - a - b;
    return numP({ q: `В треугольнике ABC ∠A = ${a}°, ∠B = ${b}°. Найдите ∠C.`, ans: [R(c)], unit: '°', fig: svgTri(a, b, { ang: { A: a + '°', B: b + '°', C: '?' } }),
      steps: ['Сумма углов треугольника 180°', `∠C = 180° − ${a}° − ${b}° = ${ok(c)}°`], hint });
  }
  if (lv === 2) {
    if (ri(0, 1)) {
      const c = 2 * ri(10, 70), base = (180 - c) / 2;
      return numP({ q: `В равнобедренном треугольнике ABC с основанием AB ∠C = ${c}°. Найдите ∠A.`, ans: [R(base)], unit: '°', fig: svgTri(base, base, { ang: { A: '?', C: c + '°' } }),
        steps: ['Углы при основании равны: ∠A = ∠B', `∠A + ∠B = 180° − ${c}° = ${180 - c}°`, `∠A = ${180 - c} : 2 = ${ok(base)}°`],
        traps: [{ v: 180 - c, why: 'Это сумма двух углов при основании — раздели пополам.' }], hint });
    }
    const a = ri(25, 85), b = ri(25, Math.min(90, 160 - a)), e = a + b;
    return numP({ q: `Внешний угол при вершине C треугольника ABC равен ${e}°, ∠A = ${a}°. Найдите ∠B.`, ans: [R(b)], unit: '°', fig: svgTri(a, b, { ang: { A: a + '°', B: '?' } }),
      steps: ['Внешний угол равен сумме двух внутренних углов, не смежных с ним', `${e}° = ∠A + ∠B`, `∠B = ${e}° − ${a}° = ${ok(b)}°`],
      traps: [{ v: 180 - e - a, why: 'Внешний угол сам равен сумме ∠A + ∠B.' }], hint });
  }
  if (ri(0, 1)) {
    let p, q, r, s; do { p = ri(1, 7); q = ri(1, 7); r = ri(1, 7); s = p + q + r; } while (180 % s !== 0 || p === q && q === r);
    const u = 180 / s, mx = Math.max(p, q, r);
    return numP({ q: `Углы треугольника относятся как ${p} : ${q} : ${r}. Найдите наибольший угол.`, ans: [R(mx * u)], unit: '°', fig: svgTri(p * u, q * u, { ang: { A: p + 'x', B: q + 'x', C: r + 'x' } }),
      steps: [`Пусть углы ${p}x, ${q}x, ${r}x`, `${p}x + ${q}x + ${r}x = 180°, ${s}x = 180°`, `x = ${u}°`, `Наибольший: ${mx} · ${u}° = ${ok(mx * u)}°`], hint });
  }
  let d; do { d = ri(4, 40); } while ((180 - d) % 4 !== 0);
  const x = (180 - d) / 4;
  return numP({ q: `В треугольнике ABC ∠A на ${d}° больше ∠B, а ∠C в 2 раза больше ∠B. Найдите ∠B.`, ans: [R(x)], unit: '°', fig: svgTri(x + d, x, { ang: { A: `x + ${d}`, B: 'x', C: '2x' } }),
    steps: [`Пусть ∠B = x, тогда ∠A = x + ${d}, ∠C = 2x`, `x + ${d} + x + 2x = 180`, `4x = ${180 - d}, x = ${ok(x)}°`], hint });
};

G.right_tri = lv => {
  const hint = 'В прямоугольном треугольнике острые углы в сумме 90°. Катет против угла 30° — половина гипотенузы.';
  if (lv === 1) {
    const a = ri(15, 75);
    return numP({ q: `В прямоугольном треугольнике ABC (∠C = 90°) ∠A = ${a}°. Найдите ∠B.`, ans: [R(90 - a)], unit: '°', fig: svgTri(a, 90 - a, { ang: { A: a + '°', B: '?', C: '90°' } }),
      steps: ['Сумма острых углов прямоугольного треугольника 90°', `∠B = 90° − ${a}° = ${ok(90 - a)}°`], traps: [{ v: 180 - a, why: 'Не забудь про прямой угол C: острые углы в сумме 90°.' }], hint });
  }
  if (lv === 2) {
    if (ri(0, 1)) { const c = 2 * ri(2, 20);
      return numP({ q: `В прямоугольном треугольнике ABC (∠C = 90°) ∠B = 30°, гипотенуза AB = ${c}. Найдите катет AC.`, ans: [R(c / 2)], fig: svgTri(60, 30, { ang: { B: '30°', C: '90°' }, side: { AB: c, AC: '?' } }),
        steps: ['Катет AC лежит против угла B = 30°', `Катет против угла 30° равен половине гипотенузы: AC = ${c} : 2 = ${ok(c / 2)}`], traps: [{ v: 2 * c, why: 'Катет меньше гипотенузы — это половина, а не удвоение.' }], hint }); }
    const k = ri(2, 20);
    return numP({ q: `В прямоугольном треугольнике ABC (∠C = 90°) ∠A = 60°, AC = ${k}. Найдите гипотенузу AB.`, ans: [R(2 * k)], fig: svgTri(60, 30, { ang: { A: '60°', C: '90°' }, side: { AC: k, AB: '?' } }),
      steps: ['∠B = 90° − 60° = 30°', `Катет AC лежит против угла 30°, значит, гипотенуза в 2 раза больше: AB = 2 · ${k} = ${ok(2 * k)}`], traps: [{ v: k / 2, why: 'Гипотенуза больше катета.' }], hint });
  }
  if (ri(0, 1)) { const k = ri(2, 15), S = 3 * k;
    return numP({ q: `В прямоугольном треугольнике ABC (∠C = 90°) ∠A = 60°, AB + AC = ${S}. Найдите гипотенузу AB.`, ans: [R(2 * k)], fig: svgTri(60, 30, { ang: { A: '60°', C: '90°' }, side: { AC: 'x', AB: '2x' } }),
      steps: ['∠B = 30°, катет AC лежит против него, значит, AC = AB : 2', `Пусть AC = x, AB = 2x: x + 2x = ${S}`, `x = ${k}, AB = ${ok(2 * k)}`], traps: [{ v: k, why: 'Это катет AC.' }], hint }); }
  const c = 2 * ri(2, 20);
  return numP({ q: `Внешний угол при вершине B прямоугольного треугольника ABC (∠C = 90°) равен 150°, AB = ${c}. Найдите AC.`, ans: [R(c / 2)], fig: svgTri(60, 30, { ang: { B: '?', C: '90°' }, side: { AB: c, AC: '?' } }),
    steps: ['∠B = 180° − 150° = 30° (смежный с внешним)', `AC лежит против угла 30°: AC = ${c} : 2 = ${ok(c / 2)}`], hint });
};

/* ---------- ВЕРОЯТНОСТЬ И СТАТИСТИКА ---------- */
G.stats = lv => {
  const list = a => a.join('; ');
  if (lv === 1) {
    const n = pick([4, 5]), vals = Array.from({ length: n }, () => ri(1, 20));
    if (ri(0, 1)) {
      const sm = vals.reduce((s, v) => s + v, 0); vals[n - 1] += (n - sm % n) % n;
      const sum = vals.reduce((s, v) => s + v, 0);
      return numP({ q: `Найдите среднее арифметическое чисел: ${list(vals)}.`, ans: [R(sum / n)],
        steps: [`Сумма: ${vals.join(' + ')} = ${sum}`, `Делим на количество чисел (${n}): ${sum} : ${n} = ${ok(sum / n)}`], hint: 'Среднее = сумма всех чисел : их количество.' });
    }
    const mx = Math.max(...vals), mn = Math.min(...vals);
    return numP({ q: `Найдите размах ряда: ${list(vals)}.`, ans: [R(mx - mn)], steps: [`Наибольшее: ${mx}, наименьшее: ${mn}`, `Размах = ${mx} − ${mn} = ${ok(mx - mn)}`], hint: 'Размах = наибольшее − наименьшее.' });
  }
  if (lv === 2) {
    if (ri(0, 1)) {
      const n = ri(5, 8), vals = Array.from({ length: n }, () => ri(1, 30)), s = vals.slice().sort((a, b) => a - b);
      let r, st;
      if (n % 2) { r = R(s[(n - 1) / 2]); st = `Чисел ${n} — нечётное количество. Медиана — число ровно посередине (${(n + 1) / 2}-е): ${ok(num(r[0]))}`; }
      else { const a = s[n / 2 - 1], b = s[n / 2]; r = R(a + b, 2); st = `Чисел ${n} — чётное количество. Медиана — среднее двух средних: (${a} + ${b}) : 2 = ${ok(num((a + b) / 2))}`; }
      return numP({ q: `Найдите медиану ряда: ${list(vals)}.`, ans: [r], ansText: num(r[0] / r[1]), steps: [`Упорядочим по возрастанию: ${list(s)}`, st],
        traps: [{ v: vals[Math.floor(n / 2)], why: 'Сначала ряд нужно упорядочить по возрастанию!' }], hint: 'Сначала упорядочь числа, потом найди середину.' });
    }
    const pool = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, ri(4, 6)), m = pick(pool), vals = shuffle([...pool, m, ...(ri(0, 1) ? [m] : [])]);
    return numP({ q: `Найдите моду ряда: ${list(vals)}.`, ans: [R(m)], steps: [`Мода — число, которое встречается чаще всех`, `${m} встречается ${vals.filter(v => v === m).length} раза, остальные — по одному: мода ${ok(m)}`], hint: 'Мода — самое частое значение.' });
  }
  const m = ri(5, 20), four = Array.from({ length: 4 }, () => ri(1, 2 * m)), s4 = four.reduce((s, v) => s + v, 0), fifth = 5 * m - s4;
  if (fifth < 1 || fifth > 60) return G.stats(3);
  return numP({ q: `Среднее арифметическое пяти чисел равно ${m}. Четыре из них: ${list(four)}. Найдите пятое число.`, ans: [R(fifth)],
    steps: [`Сумма всех пяти чисел: ${m} · 5 = ${5 * m}`, `Сумма четырёх известных: ${four.join(' + ')} = ${s4}`, `Пятое: ${5 * m} − ${s4} = ${ok(fifth)}`], hint: 'Сумма = среднее · количество.' });
};

G.prob = lv => {
  const out = (q, f, n, steps, hint, traps) => {
    const r = R(f, n), val = r[0] / r[1];
    return numP({ q: q + ' Ответ — дробью или десятичной дробью.', ans: [r], ansText: rh(r) + (r[1] > 1 && terminating(r[1]) ? ` = ${num(val)}` : ''), frac: false,
      steps: [...steps, `P = ${fs(f, n)} = ${ok(rh(r))}${r[1] > 1 && terminating(r[1]) ? ' = ' + num(val) : ''}`], hint, traps });
  };
  const hint = 'Вероятность = число благоприятных исходов : число всех исходов.';
  if (lv === 1) {
    const k = ri(2, 5), evs = [
      ['выпадет чётное число', [2, 4, 6]], ['выпадет нечётное число', [1, 3, 5]], [`выпадет число больше ${k}`, [1, 2, 3, 4, 5, 6].filter(x => x > k)],
      [`выпадет число меньше ${k}`, [1, 2, 3, 4, 5, 6].filter(x => x < k)], ['выпадет число, кратное 3', [3, 6]], [`выпадет ${k}`, [k]]];
    const [t, fav] = pick(evs);
    return out(`Игральный кубик бросают один раз. Найдите вероятность того, что ${t}.`, fav.length, 6,
      ['Всего исходов: 6 (числа от 1 до 6)', `Благоприятные: ${fav.join(', ')} — их ${fav.length}`], hint, [{ v: fav.length / 10, why: 'Делим на число всех исходов — у кубика их 6.' }]);
  }
  if (lv === 2) {
    if (ri(0, 1)) {
      const r = ri(2, 10), b = ri(2, 10), g = ri(1, 8), n = r + b + g, notBlue = ri(0, 1);
      return out(`В коробке ${r} красных, ${b} синих и ${g} зелёных шаров. Наугад достают один шар. Найдите вероятность того, что он ${notBlue ? 'не синий' : 'красный'}.`, notBlue ? r + g : r, n,
        [`Всего шаров: ${r} + ${b} + ${g} = ${n}`, notBlue ? `Не синие — красные и зелёные: ${r} + ${g} = ${r + g}` : `Красных: ${r}`], hint,
        [{ v: (notBlue ? r + g : r) / (notBlue ? b : b + g), why: 'Делить нужно на ВСЕ шары, а не только на «другие».' }]);
    }
    const N = pick([20, 25, 40, 50, 100]), k = ri(1, Math.floor(N / 4));
    return out(`В лотерее ${N} билетов, из них ${k} выигрышных. Найдите вероятность выиграть, купив один билет.`, k, N, [`Всего исходов: ${N}`, `Благоприятных: ${k}`], hint);
  }
  if (ri(0, 2)) {
    const s = ri(3, 11), pairs = []; for (let i = 1; i <= 6; i++) { const j = s - i; if (j >= 1 && j <= 6) pairs.push(`(${i}; ${j})`); }
    return out(`Бросают два игральных кубика. Найдите вероятность того, что сумма очков равна ${s}.`, pairs.length, 36,
      ['Всего исходов: 6 · 6 = 36 (каждому числу первого кубика — 6 вариантов второго)', `Благоприятные пары: ${pairs.join(', ')} — их ${pairs.length}`], hint,
      [{ v: pairs.length / 11, why: 'Исходов не 11 (суммы от 2 до 12), а 36: пары (1; 2) и (2; 1) — разные исходы.' }]);
  }
  const t = pick([['хотя бы один раз выпадет орёл', 3, ['ОО, ОР, РО']], ['оба раза выпадет решка', 1, ['РР']], ['орёл выпадет ровно один раз', 2, ['ОР, РО']]]);
  return out(`Монету бросают два раза. Найдите вероятность того, что ${t[0]}.`, t[1], 4, ['Все исходы: ОО, ОР, РО, РР — их 4', `Благоприятные: ${t[2][0]} — ${t[1]}`], hint);
};

/* ---------- КАТАЛОГ НАВЫКОВ ---------- */
const BLOCKS = [
  { id: 'base', title: 'База 5–6 класса', short: 'База', note: 'Фундамент: без него не решается алгебра 7 класса' },
  { id: 'alg', title: 'Алгебра 7', short: 'Алгебра', note: 'Учебник Макарычева, под ред. С. А. Теляковского' },
  { id: 'geo', title: 'Геометрия 7', short: 'Геометрия', note: 'Учебник Атанасяна, 7–9 классы' },
  { id: 'prob', title: 'Вероятность и статистика', short: 'Вероятность', note: 'Учебник Высоцкого, Ященко, 7–9 классы' },
];
const ex1 = (s, a) => `<div class="th-ex"><span>Пример</span> ${s} ${a ? '= <b>' + a + '</b>' : ''}</div>`;
const SKILLS = [
  { id: 'order', block: 'base', title: 'Порядок действий', th: `<p>1) действия в скобках; 2) умножение и деление; 3) сложение и вычитание. Действия одной ступени — слева направо.</p>${ex1('20 − 3 · (2 + 4) = 20 − 3 · 6 = 20 − 18', '2')}` },
  { id: 'frac_add', block: 'base', title: 'Дроби: сложение и вычитание', th: `<p>Одинаковые знаменатели — складываем числители, знаменатель оставляем. Разные — сначала приводим к общему знаменателю (НОК), домножая числитель и знаменатель на дополнительный множитель. Ответ сокращаем.</p>${ex1(`${fs(1, 4)} + ${fs(1, 6)} = ${fs(3, 12)} + ${fs(2, 12)}`, fs(5, 12))}<p class="warn">Знаменатели НЕ складывают: ${fs(1, 4)} + ${fs(1, 6)} ≠ ${fs(2, 10)}</p>` },
  { id: 'frac_mul', block: 'base', title: 'Дроби: умножение и деление', th: `<p>Умножение: числитель на числитель, знаменатель на знаменатель. Деление: вторую дробь переворачиваем и умножаем. Целое число = дробь со знаменателем 1. Сокращай до умножения.</p>${ex1(`${fs(2, 3)} : ${fs(4, 9)} = ${fs(2, 3)} · ${fs(9, 4)} = ${fs(18, 12)}`, fs(3, 2))}` },
  { id: 'dec', block: 'base', title: 'Десятичные дроби', th: `<p>Сложение/вычитание — запятая под запятой. Умножение — как целые, потом отделяем столько знаков, сколько всего после запятой у множителей. Деление на десятичную — переносим запятую в делителе и делимом, чтобы делитель стал целым.</p>${ex1('0,3 · 0,2', '0,06')}${ex1('1,44 : 0,4 = 14,4 : 4', '3,6')}` },
  { id: 'neg_add', block: 'base', title: 'Отрицательные: + и −', th: `<p>Одинаковые знаки: складываем модули, ставим общий знак. Разные знаки: из большего модуля вычитаем меньший, знак — как у числа с бóльшим модулем. Вычитание = сложение с противоположным: a − b = a + (−b).</p>${ex1('−7 + 3', '−4')}${ex1('5 − (−8) = 5 + 8', '13')}` },
  { id: 'neg_mul', block: 'base', title: 'Отрицательные: · и :', th: `<p>Перемножаем модули. Знак: чётное число минусов — плюс, нечётное — минус. «Минус на минус даёт плюс».</p>${ex1('(−4) · (−5)', '20')}${ex1('−36 : 9', '−4')}` },
  { id: 'percent', block: 'base', title: 'Проценты', th: `<p>1% — сотая часть. p% от числа: число · p : 100. Число по его части: часть : p · 100. Сколько процентов a от b: a : b · 100.</p>${ex1('20% от 350 = 350 · 0,2', '70')}` },
  { id: 'proportion', block: 'base', title: 'Пропорции', th: `<p>В пропорции произведение крайних членов равно произведению средних («крест-накрест»). Прямая пропорциональность: одна величина растёт — другая растёт во столько же раз. Обратная: одна растёт — другая уменьшается.</p>${ex1(`${fs('x', 4)} = ${fs(6, 8)} → 8x = 24 → x`, '3')}` },
  { id: 'brackets', block: 'base', title: 'Раскрытие скобок', th: `<p>Множитель перед скобкой умножаем на каждое слагаемое в ней. Минус перед скобкой меняет знаки всех слагаемых внутри. Потом приводим подобные.</p>${ex1('−2(x − 5) = −2x + 10', '')}` },
  { id: 'eq6', block: 'base', title: 'Простые уравнения', th: `<p>Неизвестное слагаемое = сумма − известное. Неизвестный множитель = произведение : известный. При переносе через «=» слагаемое меняет знак.</p>${ex1('3x + 5 = 20 → 3x = 15 → x', '5')}` },

  { id: 'subst', block: 'alg', title: 'Значение выражения', th: `<p>Подставляем число вместо буквы. Отрицательные числа — в скобках! Затем соблюдаем порядок действий.</p>${ex1('x² − 3x при x = −2: (−2)² − 3 · (−2) = 4 + 6', '10')}` },
  { id: 'like', block: 'alg', title: 'Подобные слагаемые', th: `<p>Подобные — с одинаковой буквенной частью (и одинаковыми степенями). Складываем их коэффициенты, буквенная часть не меняется. 3a + 2b — НЕ 5ab.</p>${ex1('5a − 2b − 3a + 7b', '2a + 5b')}` },
  { id: 'lin_eq', block: 'alg', title: 'Линейные уравнения', th: `<p>1) Раскрыть скобки. 2) Слагаемые с x — влево, числа — вправо, меняя знак при переносе. 3) Привести подобные. 4) Разделить на коэффициент при x.</p>${ex1('5x − 3 = 2x + 9 → 3x = 12 → x', '4')}` },
  { id: 'word_eq', block: 'alg', title: 'Задачи на уравнения', th: `<p>1) Обозначь за x неизвестное (часто меньшую величину). 2) Вырази остальные величины через x. 3) Составь уравнение по условию «всего», «стало поровну». 4) Реши и проверь, отвечает ли число на вопрос задачи.</p>` },
  { id: 'func', block: 'alg', title: 'Линейная функция', th: `<p>y = kx + b. Найти y: подставить x. Найти x: подставить y и решить уравнение. Точка лежит на графике, если её координаты обращают формулу в верное равенство. С осью Ox: y = 0; с осью Oy: x = 0 (y = b).</p>${ex1('y = 2x − 3 при x = 4: y = 8 − 3', '5')}` },
  { id: 'power', block: 'alg', title: 'Степень', th: `<p>aⁿ = a · a · … · a (n раз). Отрицательное число в чётной степени — положительное, в нечётной — отрицательное. −3² = −9, но (−3)² = 9.</p>${ex1('(−2)³ = (−2)(−2)(−2)', '−8')}` },
  { id: 'power_props', block: 'alg', title: 'Свойства степеней', th: `<p>aᵐ · aⁿ = aᵐ⁺ⁿ;  aᵐ : aⁿ = aᵐ⁻ⁿ;  (aᵐ)ⁿ = aᵐⁿ;  (ab)ⁿ = aⁿbⁿ.</p>${ex1('x⁵ · x³ = x⁸;  (x²)⁴ = x⁸', '')}` },
  { id: 'monomial', block: 'alg', title: 'Одночлены', th: `<p>Стандартный вид: число впереди, каждая буква один раз. При умножении коэффициенты перемножаем, показатели одинаковых букв складываем. При возведении в степень — в степень возводится и число, и каждая буква.</p>${ex1('(−2a²b)³', '−8a⁶b³')}` },
  { id: 'poly_add', block: 'alg', title: 'Сложение многочленов', th: `<p>Раскрываем скобки (минус перед скобкой меняет все знаки внутри) и приводим подобные.</p>${ex1('(3x² − x) − (x² − 4x) = 3x² − x − x² + 4x', '2x² + 3x')}` },
  { id: 'poly_mul', block: 'alg', title: 'Умножение многочленов', th: `<p>Каждый член первого многочлена умножаем на каждый член второго, потом приводим подобные.</p>${ex1('(x + 2)(x − 5) = x² − 5x + 2x − 10', 'x² − 3x − 10')}` },
  { id: 'factor', block: 'alg', title: 'Разложение на множители', th: `<p>Вынесение общего множителя: находим НОД коэффициентов и общие буквы в наименьшей степени. Группировка: объединяем слагаемые в группы, из каждой выносим множитель — получается общая скобка.</p>${ex1('6x² − 9x', '3x(2x − 3)')}` },
  { id: 'fsu', block: 'alg', title: 'Формулы сокращённого умножения', th: `<p>(a + b)² = a² + 2ab + b²<br>(a − b)² = a² − 2ab + b²<br>(a − b)(a + b) = a² − b²</p><p class="warn">(a + b)² ≠ a² + b² — самая частая ошибка!</p>${ex1('(x − 3)²', 'x² − 6x + 9')}` },
  { id: 'system', block: 'alg', title: 'Системы уравнений', th: `<p>Подстановка: выразить одну переменную и подставить в другое уравнение. Сложение: уравнять коэффициенты при одной переменной (с противоположными знаками) и сложить уравнения.</p>${ex1('x + y = 7, x − y = 1 → 2x = 8, x = 4, y = 3', '')}` },

  { id: 'segments', block: 'geo', title: 'Отрезки', th: `<p>Если точка C лежит на отрезке AB, то AB = AC + CB. Середина делит отрезок пополам.</p>` },
  { id: 'angles', block: 'geo', title: 'Смежные и вертикальные углы', th: `<p>Смежные углы: одна сторона общая, две другие образуют прямую. Их сумма 180°. Вертикальные углы (напротив друг друга при пересечении прямых) равны.</p>` },
  { id: 'bisector', block: 'geo', title: 'Биссектриса угла', th: `<p>Биссектриса — луч, который делит угол на два равных угла.</p>` },
  { id: 'geo_theory', block: 'geo', title: 'Определения и признаки', th: `<p>Три признака равенства треугольников: 1) две стороны и угол между ними; 2) сторона и два прилежащих угла; 3) три стороны. Медиана — в середину стороны, биссектриса — делит угол, высота — перпендикуляр.</p><p>Геометрию сдают устно и письменно — определения нужно знать дословно.</p>` },
  { id: 'isosceles', block: 'geo', title: 'Равнобедренный треугольник', th: `<p>Две боковые стороны равны, углы при основании равны. Биссектриса к основанию — также медиана и высота. Периметр: P = 2 · боковая + основание.</p>` },
  { id: 'parallel', block: 'geo', title: 'Параллельные прямые', th: `<p>Если a ∥ b, то накрест лежащие углы равны, соответственные равны, сумма односторонних 180°. Все 8 углов равны либо α, либо 180° − α.</p>` },
  { id: 'tri_sum', block: 'geo', title: 'Сумма углов треугольника', th: `<p>Сумма углов треугольника 180°. Внешний угол равен сумме двух внутренних, не смежных с ним.</p>` },
  { id: 'right_tri', block: 'geo', title: 'Прямоугольный треугольник', th: `<p>Сумма острых углов 90°. Катет против угла 30° равен половине гипотенузы. И обратно: если катет — половина гипотенузы, против него угол 30°.</p>` },

  { id: 'stats', block: 'prob', title: 'Среднее, медиана, размах', th: `<p>Среднее = сумма : количество. Медиана — число в середине упорядоченного ряда (при чётном количестве — среднее двух средних). Размах = наибольшее − наименьшее. Мода — самое частое значение.</p>` },
  { id: 'prob', block: 'prob', title: 'Вероятность', th: `<p>P = число благоприятных исходов : число всех равновозможных исходов. Вероятность — от 0 до 1. У кубика 6 исходов, у двух кубиков 36, у двух монет 4.</p>${ex1('P(чётное на кубике) = 3 : 6', '0,5')}` },
];

function make(id, lv) {
  for (let i = 0; i < 6; i++) {
    try { const p = G[id](lv); p.sk = id; p.lv = lv; return p; }
    catch (e) { if (i === 5) throw e; }
  }
}

const API = { G, SKILLS, BLOCKS, make, gcd };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PYAT = API;
})(typeof window !== 'undefined' ? window : globalThis);
