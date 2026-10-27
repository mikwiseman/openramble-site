// OpenRamble · Proof
// One rAF loop (scroll fallback, pointer depth, the swinging sign). One-shot moves use the
// Web Animations API so they run on the compositor. Everything animates transform/opacity.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const root = document.documentElement;
root.classList.add('js');

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const SCROLL_TL = !!(window.CSS && CSS.supports('animation-timeline: view()'));
const phone = () => innerWidth < 900;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const f2 = (n) => Math.round(n * 100) / 100;

// A scene's own clock. Scroll starts a figure and the clock finishes it; once the next sheet
// starts to cover a scene, whatever is left of it plays at triple speed (see hurryCheck).
function anim(el, kf, opt) {
  const a = el.animate(kf, REDUCE ? { ...opt, duration: 0, delay: 0 } : opt);
  if (el.closest?.('.scene')?._hurry) a.updatePlaybackRate(3);
  return a.finished.catch(() => {});
}
// a pause on that clock when `el` is given, on the wall clock otherwise
const wait = (ms, el) => (el ? anim(el, [], { duration: ms }) : new Promise((r) => setTimeout(r, REDUCE ? 0 : ms)));

/* ------------------------------------------------------------ triggers */
// A scene plays once when its element's top passes a line in the viewport.
const triggers = [];
function when(el, line, fn) { if (el) triggers.push({ el, line, fn }); }
function checkTriggers() {
  const vh = innerHeight;
  for (let i = triggers.length - 1; i >= 0; i--) {
    const t = triggers[i];
    const r = t.el.getBoundingClientRect();
    if (r.top < vh * t.line && r.bottom > 0) { triggers.splice(i, 1); t.fn(); }
  }
}

/* ---------------------------------------------------------------- loop */
const tasks = new Set();
let raf = 0;
let last = 0;
const quality = {
  n: 0, samples: [], done: false,
  sample(dt) {
    if (this.done || dt > 90) return;
    this.samples.push(dt);
    if (this.samples.length >= 90) {
      this.done = true;
      const s = this.samples.sort((a, b) => a - b);
      if (s[Math.floor(s.length / 2)] > 26) root.classList.add('q-low');
    }
  },
};
function frame(t) {
  raf = 0;
  const dt = last ? Math.min(t - last, 100) : 16.7;
  last = t;
  quality.sample(dt);
  for (const fn of Array.from(tasks)) if (fn(t, dt) === false) tasks.delete(fn);
  if (tasks.size && !document.hidden) raf = requestAnimationFrame(frame);
  else last = 0;
}
function run(fn) {
  tasks.add(fn);
  if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; }
  else if (tasks.size && !raf) raf = requestAnimationFrame(frame);
});

/* -------------------------------------------------------- paper & ink */
function deckle(el, amp, seed) {
  const r = rng(seed);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) return;
  const pts = [];
  const edge = (len, put) => {
    const n = Math.max(30, Math.round(len / 6));
    let drift = 0;
    const ph = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      drift = drift * 0.72 + (r() - 0.5) * 0.8;
      const fibre = r() < 0.16 ? r() * 1.1 : 0;
      const off = amp * (0.55 + 0.3 * Math.sin(t * 7 + ph) + 0.3 * drift + fibre);
      put(t, Math.max(0, off));
    }
  };
  edge(w, (t, o) => pts.push([t * w, o]));
  edge(h, (t, o) => pts.push([w - o, t * h]));
  edge(w, (t, o) => pts.push([w - t * w, h - o]));
  edge(h, (t, o) => pts.push([o, h - t * h]));
  el.style.setProperty('--deckle', `polygon(${pts.map(([x, y]) => `${((x / w) * 100).toFixed(3)}% ${((y / h) * 100).toFixed(3)}%`).join(',')})`);
}
function paperAll() {
  $$('[data-deckle]').forEach((el, i) => deckle(el, parseFloat(el.dataset.deckle) * 1.25, 101 + i * 17));
}
function inkWords() {
  $$('[data-press] .w').forEach((w, i) => {
    const r = rng(i * 31 + 5);
    w.style.setProperty('--ix', `${Math.round(r() * 190)}px`);
    w.style.setProperty('--iy', `${Math.round(r() * 190)}px`);
    w.style.setProperty('--io', (0.9 + r() * 0.1).toFixed(3));
  });
}
function signatures() {
  $$('.sheet[data-sig]').forEach((s, i) => {
    if ($('.sig', s)) return;
    const sig = document.createElement('span');
    sig.className = 'sig';
    sig.setAttribute('aria-hidden', 'true');
    sig.textContent = s.dataset.sig + (i ? '' : '');
    s.appendChild(sig);
  });
}

/* ------------------------------------------------------------- rulers */
const NS = 'http://www.w3.org/2000/svg';
function ruler(el) {
  const kind = el.dataset.ruler;
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (!w || !h) return null;
  let lines = '';
  let text = '';
  let out = null;
  if (kind === 'picas') {
    for (let y = 8, i = 1; y < h - 6; y += 8, i++) {
      const len = i % 12 === 0 ? 17 : i % 2 === 0 ? 10 : 5;
      lines += `M${w} ${y}h${-len}`;
      if (i % 12 === 0) text += `<text x="${w - 20}" y="${y + 3}" text-anchor="end">${i / 2}</text>`;
    }
    for (let y = 8, i = 1; y < h - 6; y += 8, i++) if (i % 2 === 0) lines += `M0 ${y}h${i % 12 === 0 ? 9 : 4}`;
    text += `<text transform="translate(12 ${h - 16}) rotate(-90)" style="letter-spacing:.3em">PICAS</text>`;
  } else if (kind === 'stick') {
    for (let x = 0, i = 0; x < w; x += 8, i++) {
      const len = i % 12 === 0 ? 9 : i % 2 === 0 ? 6 : 3;
      lines += `M${x + 0.5} 0v${len}`;
      if (i % 12 === 0 && i) text += `<text x="${x + 2.5}" y="${h - 1}">${i / 2}</text>`;
    }
  } else if (kind === 'ms') {
    const pad = Math.min(28, w * 0.04);
    const span = w - pad * 2;
    const per = span / 100;
    const step = per >= 4 ? 1 : 2;
    for (let ms = 0; ms <= 100; ms += step) {
      const x = pad + ms * per;
      const len = ms % 10 === 0 ? 20 : ms % 5 === 0 ? 13 : 7;
      lines += `M${f2(x)} 0v${len}M${f2(x)} ${h}v${-Math.round(len * 0.6)}`;
      if (ms % 10 === 0) text += `<text x="${f2(x)}" y="31" text-anchor="middle">${ms}</text>`;
    }
    text += `<text x="${w - 8}" y="${h - 12}" text-anchor="end" style="letter-spacing:.25em">MS</text>`;
    out = { x: (ms) => pad + ms * per };
  }
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${lines}" stroke="#2c2f33" stroke-width=".8" fill="none"/>${text}</svg>`;
  return out;
}

/* ---------------------------------------------------------- type case */
function typeCase(svg) {
  if (!svg) return;
  const W = 520;
  const H = 300;
  const r = rng(77);
  const pad = 13;
  const ih = H - pad * 2;
  const rows = 7;
  const rh = ih / rows;
  const capsX = pad + (W - pad * 2) * 0.665;
  const boxes = [];
  const cw = (W - pad - capsX) / 7;
  for (let y = 0; y < rows; y++) for (let x = 0; x < 7; x++) boxes.push([capsX + x * cw, pad + y * rh, cw, rh]);
  const pats = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 1, 1, 1, 1, 1], [2, 1, 1, 2, 1, 1, 1, 2], [1, 2, 1, 1, 2, 1, 2], [2, 2, 1, 2, 1, 2], [1, 1, 2, 2, 2, 1, 1]];
  const lw = capsX - pad - 3;
  pats.forEach((p, y) => {
    const tot = p.reduce((a, b) => a + b, 0);
    let x = pad;
    p.forEach((u) => { const w = (lw * u) / tot; boxes.push([x, pad + y * rh, w, rh]); x += w; });
  });
  const letters = 'etaoinshrdlucmfwypvbgkqjxz,.;:!?ABCDEFGHIJKLMNOPQRSTUVWXYZ&';
  let floor = '';
  let sorts = '';
  let walls = '';
  boxes.forEach(([x, y, w, h], i) => {
    floor += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="url(#cs-floor)"/><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="url(#cs-shade)"/>`;
    const n = Math.round(2 + r() * (w * h) / 110);
    for (let k = 0; k < n; k++) {
      const sw = 3.6 + r() * 2.6;
      const sh = 5.4 + r() * 2.4;
      const sx = x + 3 + r() * Math.max(1, w - sw - 6);
      const sy = y + 3 + r() * Math.max(1, h - sh - 6);
      const rot = (r() - 0.5) * 70;
      const tone = ['#c9c6be', '#b7b4ab', '#a5a299', '#d5d2ca'][Math.floor(r() * 4)];
      sorts += `<g transform="rotate(${f2(rot)} ${f2(sx + sw / 2)} ${f2(sy + sh / 2)})"><rect x="${f2(sx)}" y="${f2(sy)}" width="${f2(sw)}" height="${f2(sh)}" fill="${tone}" stroke="#3f3c36" stroke-width=".35"/>`;
      if (r() < 0.45) sorts += `<text x="${f2(sx + sw / 2)}" y="${f2(sy + sh - 1.4)}" text-anchor="middle" font-size="4.6" fill="#1d1b19" font-family="EB Garamond, serif">${letters[(i + k) % letters.length]}</text>`;
      sorts += '</g>';
    }
    walls += `M${f2(x + w)} ${f2(y)}V${f2(y + h)}M${f2(x)} ${f2(y + h)}H${f2(x + w)}`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<defs>
    <pattern id="cs-wood" patternUnits="userSpaceOnUse" width="300" height="300"><image href="./assets/wood.webp" width="300" height="300"/></pattern>
    <linearGradient id="cs-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f5b3e"/><stop offset="1" stop-color="#8a7350"/></linearGradient>
    <linearGradient id="cs-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1206" stop-opacity=".55"/><stop offset=".35" stop-color="#1c1206" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="5" fill="url(#cs-wood)"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="5" fill="none" stroke="#5c4628" stroke-opacity=".6"/>
  <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" fill="#6f5b3e"/>
  ${floor}${sorts}
  <path d="${walls}" stroke="#4e3b20" stroke-width="3.2" stroke-opacity=".55" transform="translate(1.2 1.2)" fill="none"/>
  <path d="${walls}" stroke="url(#cs-wood)" stroke-width="2.6" fill="none"/>
  <path d="${walls}" stroke="#f3e2bf" stroke-width=".6" stroke-opacity=".7" transform="translate(-.8 -.8)" fill="none"/>
  <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" fill="none" stroke="#4e3b20" stroke-width="1.4" stroke-opacity=".7"/>`;
}

/* --------------------------------------------------------- thumbprint */
function thumbprint(svg) {
  if (!svg) return;
  const r = rng(23);
  const W = 74;
  const H = 94;
  const cx = 37 + (r() - 0.5) * 3;
  const cy = 46 + (r() - 0.5) * 4;
  let paths = '';
  for (let k = 1; k < 27; k++) {
    const rad = k * 1.72;
    const ph1 = r() * 6.28;
    const ph2 = r() * 6.28;
    let d = '';
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const wob = 1 + 0.07 * Math.sin(a * 3 + ph1) + 0.035 * Math.sin(a * 5 + ph2 + k * 0.3);
      const core = k < 5 ? 0.6 + k * 0.08 : 1;
      const x = cx + Math.cos(a) * rad * 0.8 * wob * core;
      const y = cy + Math.sin(a) * rad * (Math.sin(a) > 0 ? 1.12 : 1.02) * wob;
      d += `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`;
    }
    paths += `<path d="${d}" stroke-dasharray="${f2(5 + r() * 22)} ${f2(0.8 + r() * 2)}" stroke-dashoffset="${f2(r() * 30)}"/>`;
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<defs><radialGradient id="tp-g" cx="50%" cy="48%" r="52%"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".62" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="tp-m"><ellipse cx="${f2(cx)}" cy="${f2(cy + 2)}" rx="30" ry="40" fill="url(#tp-g)"/></mask></defs><g mask="url(#tp-m)" fill="none" stroke="#2a2420" stroke-width=".9" stroke-linecap="round" opacity=".34">${paths}</g>`;
}

/* ------------------------------------------------------------- lock-up */
// Loose, every sort sits a little crooked and every piece of furniture leaves a hairline of
// stone; the quoins expand and the forme closes up tight against the chase (CSS does the move).
function chase() {
  const set = setSorts($('#locked-type'), parse('Your words.'), 51);
  const r = rng(12);
  set.sorts.forEach(({ el }) => {
    el.style.setProperty('--jx', `${f2((r() - 0.5) * 1.6)}px`);
    el.style.setProperty('--jy', `${f2((r() - 0.5) * 3.4)}px`);
    el.style.setProperty('--jr', `${f2((r() - 0.5) * 5)}deg`);
  });
  // each block cut from a different log: its own pith, ring width and tone
  $$('.furn').forEach((el, i) => {
    const q = rng(300 + i * 7);
    el.style.setProperty('--gx', `${Math.round(q() * 120 - 10)}%`);
    el.style.setProperty('--gy', `${Math.round(q() < 0.5 ? -70 - q() * 90 : 170 + q() * 90)}%`);
    el.style.setProperty('--rp', `${f2(2.6 + q() * 1.6)}px`);
    el.style.setProperty('--ra', `${Math.round(q() * 90)}deg`);
    el.style.setProperty('--br', f2(0.9 + q() * 0.16));
    el.style.setProperty('--wx', `${Math.round(q() * 220)}px`);
    el.style.setProperty('--wy', `${Math.round(q() * 220)}px`);
  });
  $$('.quoin').forEach((el) => el.insertAdjacentHTML('afterbegin', quoinSvg(el.classList.contains('q-side'))));
}
// Two steel wedges meshing on a ratchet, drawn long and thin and stretched to the quoin's slot.
// The outer one bears on the chase; the key drives the inner one out against the furniture.
function quoinSvg(vertical) {
  const L = 200;
  const T = 22;
  const n = 16;
  const seam = (u) => T * (0.6 - 0.24 * u);
  const teeth = [];
  for (let i = 0; i < n; i++) teeth.push([(i / n) * L, seam(i / n)], [((i + 0.78) / n) * L, seam((i + 0.78) / n) - 2.4]);
  teeth.push([L, seam(1)]);
  const P = ([x, y]) => (vertical ? `${f2(T - y)},${f2(x)}` : `${f2(x)},${f2(y)}`);
  const outer = [[0, 0], [L, 0], ...teeth.slice().reverse()].map(P).join(' ');
  const inner = [...teeth, [L, T], [0, T]].map(P).join(' ');
  const g = vertical ? 'q-steel-v' : 'q-steel-h';
  const wedge = (pts, cls) => `<g class="${cls}"><polygon points="${pts}" fill="url(#${g})"/><polygon points="${pts}" fill="url(#q-brush)" class="q-brush"/><polygon points="${pts}" class="q-edge"/></g>`;
  return `<svg class="quoin-svg" viewBox="0 0 ${vertical ? `${T} ${L}` : `${L} ${T}`}" preserveAspectRatio="none" aria-hidden="true">${wedge(inner, 'w-in')}${wedge(outer, 'w-out')}</svg>`;
}

/* ------------------------------------------------------------- hellbox */
const HB = { box: $('#hellbox'), floor: $('#hb-sorts'), tally: $('#hb-tally'), n: 0, t: 0 };
// On a phone the hellbox waits in a drawer at the edge of the screen, clear of the text, and
// slides out while sorts are falling into it.
function hbOpen(ms) {
  if (!HB.box || REDUCE) return;
  HB.box.classList.add('is-open');
  clearTimeout(HB.t);
  HB.t = setTimeout(() => HB.box.classList.remove('is-open'), ms);
}
function hbTarget() {
  if (!HB.floor) return null;
  const r = HB.floor.getBoundingClientRect();
  // aim for where the drawer will be once it is open
  const dx = parseFloat(getComputedStyle(HB.box).translate) || 0;
  const left = r.left - dx;
  if (!r.width || r.bottom < 0 || r.top > innerHeight || left + r.width < 0 || left > innerWidth) return null;
  return { x: left + r.width * (0.14 + Math.random() * 0.72), y: r.top + r.height * (0.22 + Math.random() * 0.56), r };
}
function hbLand(ch, x, y) {
  const r = HB.floor.getBoundingClientRect();
  const s = document.createElement('span');
  s.className = 'hb-sort';
  s.textContent = ch === ' ' ? ' ' : ch;
  s.style.left = `${clamp((x - r.left) / r.width, 0.04, 0.86) * 100}%`;
  s.style.top = `${clamp((y - r.top) / r.height, 0.04, 0.8) * 100}%`;
  s.style.rotate = `${Math.round((Math.random() - 0.5) * 300)}deg`;
  HB.floor.appendChild(s);
  while (HB.floor.children.length > 64) HB.floor.firstElementChild.remove();
}
function hbTally(n) {
  HB.n = n;
  if (!HB.tally) return;
  const r = rng(9);
  let d = '';
  for (let i = 0; i < Math.min(n, 15); i++) {
    const g = Math.floor(i / 5);
    const k = i % 5;
    const x0 = g * 28;
    const j = (r() - 0.5) * 1.6;
    if (k < 4) d += `M${f2(x0 + 4 + k * 5 + j)} ${f2(5 + r())}L${f2(x0 + 4.6 + k * 5 + j)} ${f2(23 - r())}`;
    else d += `M${f2(x0 + 1)} ${f2(19 + r())}L${f2(x0 + 25)} ${f2(8 + r())}`;
  }
  HB.tally.innerHTML = `<path d="${d}"/>`;
}

/* --------------------------------------------------------------- sorts */
function parse(src) {
  const out = [];
  let del = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '[') { del = true; continue; }
    if (c === ']') { del = false; continue; }
    if (c === '{') {
      const j = src.indexOf('}', i);
      const [a, b] = src.slice(i + 1, j).split('|');
      out.push({ ch: a, del, swap: b });
      i = j;
      continue;
    }
    out.push({ ch: c, del, swap: null });
  }
  return out;
}
const cleanOf = (recs) => recs.filter((c) => !c.del).map((c) => c.swap || c.ch).join('').replace(/\s+/g, ' ').trim();

function setSorts(box, chars, seed = 1) {
  const r = rng(seed);
  box.textContent = '';
  const sorts = [];
  const words = [];
  let wd = null;
  let word = null;
  for (const c of chars) {
    if (!wd) {
      wd = document.createElement('span');
      wd.className = 'wd';
      box.appendChild(wd);
      word = { el: wd, sorts: [], text: '', allDel: true };
      words.push(word);
    }
    const el = document.createElement('span');
    if (c.ch === ' ') el.className = 'q';
    else {
      el.className = 's';
      el.textContent = c.ch;
      if (r() < 0.22) el.classList.add('patina');
    }
    const rec = { el, ch: c.ch, del: c.del, swap: c.swap };
    wd.appendChild(el);
    sorts.push(rec);
    word.sorts.push(rec);
    if (c.ch !== ' ') { word.text += c.ch; if (!c.del) word.allDel = false; }
    else wd = null;
  }
  return { sorts, words };
}

/* --------------------------------------------------------- glyph boxes */
// Marks live in layout space: each mark layer is an SVG that fills its positioned parent with a
// viewBox the size of that parent, so a sort's layout offsets from the parent are SVG units and
// no transform on the sheet (rotation, scroll tilt) can carry a mark off its letter. The pencil
// is then measured against the ink of each glyph, read from the font, not against its metal.
const inkCtx = document.createElement('canvas').getContext('2d');
const inkMemo = new Map();
function ink(ch, font) {
  const key = font + '|' + ch;
  if (!inkMemo.has(key)) {
    inkCtx.font = font;
    const m = inkCtx.measureText(ch);
    inkMemo.set(key, {
      l: -m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent,
      fa: m.fontBoundingBoxAscent, fd: m.fontBoundingBoxDescent, xh: inkCtx.measureText('x').actualBoundingBoxAscent,
    });
  }
  return inkMemo.get(key);
}
const fontOf = (cs) => `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

// Lay out sorts in the coordinates of `box`. Offsets are whole pixels, so within a line, where
// sorts abut, x adds up their exact widths from the line's first sort.
function place(recs, box) {
  let line = null;
  let x = 0;
  for (const rec of recs) {
    rec.box = null;
    rec.g = null;
    const el = rec.el;
    if (!el.isConnected || el.style.display === 'none') continue;
    let ox = 0;
    let oy = 0;
    for (let e = el; e && e !== box; e = e.offsetParent) { ox += e.offsetLeft; oy += e.offsetTop; }
    const cs = getComputedStyle(el);
    if (line === null || Math.abs(oy - line) > 2) { line = oy; x = ox; }
    const w = parseFloat(cs.width);
    rec.box = { x, y: oy, w, h: parseFloat(cs.height), fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), pl: parseFloat(cs.paddingLeft), font: fontOf(cs) };
    x += w;
  }
}
// the ink of one glyph, its baseline and x-height, in the same coordinates
function glyph(rec) {
  if (rec.g) return rec.g;
  const b = rec.box;
  const ch = rec.el ? rec.el.textContent || rec.ch : rec.ch;
  const m = ink(ch, b.font);
  const ox = b.x + b.pl;
  const base = b.y + (b.lh - (m.fa + m.fd)) / 2 + m.fa;
  rec.g = { ch, l: ox + m.l, r: ox + m.r, t: base - m.a, b: base + m.d, a: m.a, base, xh: m.xh, fs: b.fs };
  return rec.g;
}

// a run is a stretch of deleted sorts on one line
function runsOf(recs) {
  const runs = [];
  let cur = null;
  for (const rec of recs) {
    if (!rec.box) continue;
    if (rec.del) {
      if (cur && Math.abs(rec.box.y - cur.y) < 4) cur.recs.push(rec);
      else { cur = { recs: [rec], y: rec.box.y }; runs.push(cur); }
    } else cur = null;
  }
  return runs.filter((run) => run.recs.some((x) => x.ch !== ' '));
}

// Catmull-Rom through the points, every control point held inside [lo, hi] so the curve is too
function smooth(pts, lo, hi) {
  const cx = (v) => clamp(v, lo, hi);
  let d = `M${f2(cx(pts[0][0]))} ${f2(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += `C${f2(cx(p1[0] + (p2[0] - p0[0]) / 6))} ${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(cx(p2[0] - (p3[0] - p1[0]) / 6))} ${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(cx(p2[0]))} ${f2(p2[1])}`;
  }
  return d;
}

// One pencil stroke through a run of deleted glyphs. It strikes the letters through the middle
// of the x-height and dips through every comma: up through a leading one, down through a
// trailing one, a lone one gets a slash. It may not leave the deleted sorts [lo, hi], and the
// caller has already pulled lo and hi clear of the nearest kept letters.
const PUNCT = /^[,.;:!?…]$/;
function stroke(gl, lo, hi, seed, weight = 0.06) {
  const r = rng(seed * 13 + 7);
  const fs = gl[0].fs;
  const sw = Math.min(Math.max(1.4, fs * weight), Math.max(0.8, (hi - lo) * 0.7));
  const isP = (g) => PUNCT.test(g.ch);
  const letters = gl.filter((g) => !isP(g));
  const ref = letters[0] || gl[0];
  const yS = ref.base - ref.xh * 0.5;
  const j = () => (r() - 0.5) * fs * 0.03;
  const pts = [];
  if (!letters.length) {
    // a lone mark: one slash through it
    const g = gl[0];
    pts.push([g.l - fs * 0.05, g.b + fs * 0.1], [g.r + fs * 0.07, g.base - ref.xh * 0.95]);
  } else {
    gl.forEach((g, k) => {
      const w = g.r - g.l;
      const cx = (g.l + g.r) / 2;
      if (!isP(g)) {
        if (k === 0) pts.push([g.l - fs * 0.06, yS + j()]);
        pts.push([cx, yS + j()]);
        if (k === gl.length - 1) pts.push([g.r + fs * 0.06, yS - fs * 0.015 + j()]);
        return;
      }
      const yDot = g.base - g.a * 0.42;
      const before = gl.slice(0, k).some((h) => !isP(h));
      const after = gl.slice(k + 1).some((h) => !isP(h));
      if (!before) pts.push([g.l - fs * 0.02, g.b + fs * 0.07], [cx + w * 0.2, yDot]);
      else if (!after) pts.push([cx - w * 0.2, yDot], [g.r + fs * 0.04, g.b + fs * 0.07]);
      else pts.push([cx, yDot + fs * 0.01]);
    });
  }
  return { d: smooth(pts, lo + sw / 2, hi - sw / 2), sw };
}

// the pencil's room for a run: its own deleted sorts, minus a clearance from the nearest kept
// letter on either side
function roomOf(run, recs) {
  const a = run.recs[0];
  const z = run.recs[run.recs.length - 1];
  let lo = a.box.x;
  let hi = z.box.x + z.box.w;
  const clear = Math.max(2, a.box.fs * 0.055);
  const near = (from, step) => {
    for (let i = recs.indexOf(from) + step; i >= 0 && i < recs.length; i += step) {
      const x = recs[i];
      if (!x.box || Math.abs(x.box.y - a.box.y) > 2 || x.del) return null;
      if (x.ch !== ' ') return glyph(x);
    }
    return null;
  };
  const before = near(a, -1);
  const after = near(z, 1);
  if (before) lo = Math.max(lo, before.r + clear);
  if (after) hi = Math.min(hi, after.l - clear);
  return { lo, hi };
}

// The pencil filter is sized to its element's bounding box; a near-flat stroke has almost no
// height, so pad the group's box or the filter clips the stroke thin.
function padInk(svg) {
  const g = $('.mark-ink', svg);
  if (!g || !g.firstElementChild) return;
  const b = g.getBBox();
  g.insertAdjacentHTML('afterbegin', `<rect x="${f2(b.x - 8)}" y="${f2(b.y - 8)}" width="${f2(b.width + 16)}" height="${f2(b.height + 16)}" fill="none"/>`);
}

// Strike each run in red pencil, one stroke per run. With `margin`, a dele for each run is
// written in the sheet's margin level with its line, as a proofreader marks a galley.
function drawStrikes(svg, recs, { stagger = 200, margin = false } = {}) {
  const box = svg.parentElement;
  // the exact layout size, so one SVG unit is one layout pixel all the way across
  const cs = getComputedStyle(svg);
  const W = parseFloat(cs.width);
  svg.setAttribute('viewBox', `0 0 ${W} ${parseFloat(cs.height)}`);
  place(recs, box);
  const runs = runsOf(recs);
  let html = '';
  runs.forEach((run, i) => {
    const { lo, hi } = roomOf(run, recs);
    const { d, sw } = stroke(run.recs.filter((x) => x.ch !== ' ').map(glyph), lo, hi, i + 1);
    html += `<path class="mark-path" data-i="${i}" d="${d}" stroke-width="${f2(sw)}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>`;
    run.recs.forEach((x) => { x.marks = svg; });
  });
  let deles = '';
  const room = margin && runs.length ? box.closest('.sheet').getBoundingClientRect().right - box.getBoundingClientRect().right - 30 : 0;
  if (room > 40) {
    const fs = runs[0].recs[0].box.fs;
    const lines = [];
    runs.forEach((run, i) => {
      const ln = lines.find((l) => Math.abs(l.y - run.y) < 4);
      if (ln) ln.runs.push(i); else lines.push({ y: run.y, runs: [i] });
    });
    lines.forEach((ln) => {
      const n = ln.runs.length;
      const dw = Math.min(fs * 0.6, (room - (n - 1) * 9) / n);
      const dh = dw * 1.4;
      const g = recs.find((x) => x.box && Math.abs(x.box.y - ln.y) < 4);
      const mid = g.box.y + g.box.h * 0.5;
      ln.runs.forEach((i, k) => {
        const x = W + 16 + k * (dw + 9);
        deles += `<use href="#i-dele" class="mark-dele" data-i="${i}" x="${f2(x)}" y="${f2(mid - dh * 0.55)}" width="${f2(dw)}" height="${f2(dh)}" style="stroke-dasharray:1;stroke-dashoffset:1"/>`;
        if (k) deles += `<path class="mark-conc" data-i="${i}" d="M${f2(x - 2)} ${f2(mid - dh * 0.3)}L${f2(x - 7)} ${f2(mid + dh * 0.3)}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>`;
      });
    });
  }
  svg.innerHTML = `<g class="mark-ink">${html}</g>${deles}`;
  padInk(svg);
  const ps = [];
  $$('[data-i]', svg).forEach((el) => {
    const i = +el.dataset.i;
    const isDele = el.tagName.toLowerCase() === 'use';
    ps.push(anim(el, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: isDele ? 360 : 240 + Math.min(260, el.getTotalLength?.() * 0.4 || 0), delay: i * stagger + (isDele ? 200 : 0), easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards',
    }));
  });
  return { done: Promise.all(ps), runs };
}

// The piece of red pencil that lies on one sort, cut out so it can leave with that sort.
function markPiece(rec) {
  const b = rec.box;
  const layer = rec.marks && rec.marks.querySelector('.mark-ink');
  if (!b || !layer) return null;
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'fly-mark');
  s.setAttribute('viewBox', `0 0 ${f2(b.w)} ${f2(b.h)}`);
  s.style.cssText = `width:${f2(b.w)}px;height:${f2(b.h)}px`;
  const paths = $$('path', layer).map((p) => `<path class="mark-path" d="${p.getAttribute('d')}" stroke-width="${p.getAttribute('stroke-width')}"/>`).join('');
  s.innerHTML = `<g class="mark-ink"><g transform="translate(${f2(-b.x)} ${f2(-b.y)})">${paths}</g></g>`;
  return s;
}

// Sorts leave the line and fall into the hellbox, each with its own piece of the pencil mark.
// With `ghost`, the proof keeps a grey impression of each sort where it stood.
function flySorts(recs, { delay = 0, ghost = false } = {}) {
  const layer = $('#flyers');
  if (recs.length) hbOpen(delay + recs.length * 26 + 2600);
  return Promise.all(recs.map((rec, i) => {
    const el = rec.el;
    const r = el.getBoundingClientRect();
    if (!r.width) return Promise.resolve();
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const wrap = document.createElement('div');
    wrap.className = 'fly';
    wrap.style.cssText = `left:${f2(r.left)}px;top:${f2(r.top)}px;font:400 ${fs}px/1 var(--serif)`;
    const clone = el.cloneNode(true);
    clone.style.cssText = '';
    clone.classList.remove('is-del');
    wrap.appendChild(clone);
    const piece = rec.ch !== ' ' && markPiece(rec);
    if (piece) wrap.appendChild(piece);
    layer.appendChild(wrap);
    if (ghost) el.classList.add('is-del');
    else el.style.visibility = 'hidden';
    const tgt = hbTarget();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const tx = tgt ? tgt.x : cx + (Math.random() - 0.5) * 160;
    const ty = tgt ? tgt.y : innerHeight + 120;
    const dx = tx - cx;
    const dy = ty - cy;
    const endS = tgt ? clamp(15 / fs, 0.08, 1) : 0.7;
    const rot = (Math.random() - 0.5) * 260;
    const arc = Math.min(140, 50 + Math.abs(dx) * 0.12);
    const kf = [{ transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 0 }, { transform: `translate(0px,${f2(-fs * 0.12)}px) scale(1.1) rotate(${f2(rot * 0.04)}deg)`, offset: 0.14 }];
    const N = 9;
    for (let k = 1; k <= N; k++) {
      const u = k / N;
      const x = dx * u;
      const y = -fs * 0.12 * (1 - u) + dy * u * u - arc * u * (1 - u);
      const s = 1.1 + (endS - 1.1) * Math.pow(u, 0.8);
      kf.push({ transform: `translate(${f2(x)}px,${f2(y)}px) scale(${f2(s)}) rotate(${f2(rot * u)}deg)`, offset: 0.14 + 0.86 * u });
    }
    const dur = 820 + Math.random() * 220;
    return anim(wrap, kf, { duration: dur, delay: delay + i * 26, easing: 'linear', fill: 'both' }).then(() => {
      if (tgt) hbLand(rec.ch, tx, ty);
      wrap.remove();
    });
  }));
}

function flip(els, mutate, dur = 480, stagger = 0) {
  const before = els.map((e) => e.getBoundingClientRect());
  mutate();
  const after = els.map((e) => e.getBoundingClientRect());
  return Promise.all(els.map((e, i) => {
    const dx = before[i].left - after[i].left;
    const dy = before[i].top - after[i].top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
    // A word changing lines should not travel through the words between them.
    if (Math.abs(dy) > before[i].height * .5) {
      return anim(e, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: dur, delay: i * stagger, easing: 'ease-out' });
    }
    return anim(e, [{ transform: `translate(${f2(dx)}px,${f2(dy)}px)` }, { transform: 'translate(0,0)' }], { duration: dur, delay: i * stagger, easing: 'cubic-bezier(.55,0,.2,1)' });
  }));
}

// Re-set a line after deletions so no word ever slides through another: first every line closes
// its own gaps; then the words that now belong on an earlier line lift out and every line slides
// to its final place; only then, with their spot empty, are the lifted words set there.
function reflow(keep, gone, mutate, dur = 440) {
  const rect = (e) => e.getBoundingClientRect();
  const B = keep.map(rect);
  // widths in layout space: on a rotated sheet a client rect is a little wider than its box,
  // and over a dozen sorts that error would carry a word into its neighbour
  const G = gone.filter((e) => e.isConnected).map((e) => {
    const cs = getComputedStyle(e);
    return { r: rect(e), w: parseFloat(cs.width) + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight) };
  });
  mutate();
  const A = keep.map(rect);
  const same = (a, b) => Math.abs(a.top - b.top) < Math.min(a.height, b.height) * 0.5;
  const shift = B.map((b) => G.reduce((s, g) => s + (same(g.r, b) && g.r.left < b.left ? g.w : 0), 0));
  // A word changes line when its line's index changes, not its height on the page: a block that
  // is centred, or that loses a whole line, moves every line at once and nothing crosses.
  const lineIdx = (rs) => {
    const tops = [];
    return rs.map((r) => {
      let k = tops.findIndex((t) => Math.abs(t - r.top) < r.height * 0.5);
      if (k < 0) k = tops.push(r.top) - 1;
      return k;
    });
  };
  const lb = lineIdx(B);
  const la = lineIdx(A);
  const lifted = la.map((k, i) => k !== lb[i]);
  const d1 = shift.some((s) => s > 0.5) ? dur : 0;
  const d0 = lifted.some(Boolean) ? 150 : 0;
  const d2 = keep.some((e, i) => !lifted[i] && (Math.abs(B[i].left - shift[i] - A[i].left) > 0.5 || Math.abs(B[i].top - A[i].top) > 0.5)) ? dur : 0;
  const d3 = d0 ? 300 : 0;
  const T = d1 + d0 + d2 + d3;
  if (!T || REDUCE) return Promise.resolve();
  const at = (ms) => ms / T;
  const t = (x, y) => `translate(${f2(x)}px,${f2(y)}px)`;
  const ease = 'cubic-bezier(.55,0,.2,1)';
  return Promise.all(keep.map((e, i) => {
    const x0 = B[i].left - A[i].left;
    const y0 = B[i].top - A[i].top;
    const x1 = x0 - shift[i];
    if (Math.abs(x0) < 0.5 && Math.abs(y0) < 0.5) return null;
    const kf = lifted[i] ? [
      { transform: t(x0, y0), opacity: 1, offset: 0, easing: ease },
      { transform: t(x1, y0), opacity: 1, offset: at(d1), easing: 'ease-in' },
      { transform: t(x1, y0 - 5), opacity: 0, offset: at(d1 + d0) },
      { transform: t(0, -6), opacity: 0, offset: at(d1 + d0 + d2), easing: 'ease-out' },
      { transform: t(0, 0), opacity: 1, offset: 1 },
    ] : [
      { transform: t(x0, y0), offset: 0, easing: ease },
      { transform: t(x1, y0), offset: at(d1) },
      { transform: t(x1, y0), offset: at(d1 + d0), easing: ease },
      { transform: t(0, 0), offset: at(d1 + d0 + d2) },
      { transform: t(0, 0), offset: 1 },
    ];
    return anim(e, kf, { duration: T, easing: 'linear' });
  }));
}

// Resolves once every capital is in and its neighbours have settled, so what
// measures the line afterwards (the knee) sees the capital's real width.
function capSwaps(recs, all) {
  return Promise.all(recs.filter((x) => x.swap).map((x) => {
    const swap = () => flip(all.map((a) => a.el).filter((e) => e !== x.el), () => { x.el.textContent = x.swap; }, 220);
    if (REDUCE) { x.el.textContent = x.swap; return null; }
    // the capital opens from its left edge at the same pace as its neighbours make room for it
    const o = '0 60%';
    return anim(x.el, [{ transform: 'scaleX(1)', transformOrigin: o }, { transform: 'scaleX(0)', transformOrigin: o }], { duration: 130, easing: 'ease-in' }).then(() => Promise.all([
      swap(),
      anim(x.el, [{ transform: 'scaleX(0)', transformOrigin: o }, { transform: 'scaleX(1)', transformOrigin: o }], { duration: 220, easing: 'cubic-bezier(.55,0,.2,1)' }),
    ]));
  }));
}

// the proof press: a steel roller passes and the line appears behind it
function pull(slip, text) {
  const p = $('.printed', slip);
  const roller = $('.roller', slip);
  if (text != null) p.textContent = text;
  if (REDUCE) return Promise.resolve();
  const x0 = p.offsetLeft - 24;
  const x1 = p.offsetLeft + p.offsetWidth - 16;
  const dur = 720;
  const easing = 'cubic-bezier(.45,0,.25,1)';
  anim(p, [{ clipPath: 'inset(-40% 100% -40% -3%)' }, { clipPath: 'inset(-40% -3% -40% -3%)' }], { duration: dur, easing, fill: 'backwards' });
  return anim(roller, [
    { transform: `translateX(${x0 - 20}px)`, opacity: 0 },
    { transform: `translateX(${x0}px)`, opacity: 1, offset: 0.06 },
    { transform: `translateX(${x1}px)`, opacity: 1, offset: 0.93 },
    { transform: `translateX(${x1 + 26}px)`, opacity: 0 },
  ], { duration: dur, easing });
}

/* ---------------------------------------------------------------- hero */
const H = {
  sheet: $('.sheet-hero'), type: $('.hero-type'), h1: $('#h1'), dele: $('#dele-hero'),
  note: $('#size-note'), strike: $('#strike-hero'), margin: $('.margin-marks'),
};
function sizeNotes() {
  const fs = parseFloat(getComputedStyle(H.h1).fontSize);
  const pt = $('#size-pt');
  if (pt) pt.textContent = Math.round(fs * 0.75);
  $$('.sp').forEach((p) => {
    const s = $('.sp-size', p);
    if (s) s.textContent = Math.round(parseFloat(getComputedStyle(p).fontSize) * 0.75);
  });
}
function placeHeroMarks(lineRect) {
  const m = H.margin.getBoundingClientRect();
  const h1 = H.h1.getBoundingClientRect();
  const dh = H.dele.getBoundingClientRect().height || 72;
  const ref = lineRect || H.h1.querySelector('.w').getBoundingClientRect();
  H.dele.style.top = `${f2(ref.top - m.top + ref.height / 2 - dh * 0.55)}px`;
  $('.dele-note', H.margin).style.top = `${f2(ref.top - m.top + ref.height / 2 + dh * .55)}px`;
  H.note.style.top = `${f2(h1.bottom - m.top - 30)}px`;
}
// The display type is inked text, not sorts: measure it character by character with a Range,
// relative to its own word, and carry that into the sheet's layout space.
function inkChars(span, box) {
  let ox = 0;
  let oy = 0;
  for (let e = span; e && e !== box; e = e.offsetParent) { ox += e.offsetLeft; oy += e.offsetTop; }
  const cs = getComputedStyle(span);
  const sr = span.getBoundingClientRect();
  const node = span.firstChild;
  const rg = document.createRange();
  const b = { y: oy + parseFloat(cs.paddingTop), fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), pl: 0, font: fontOf(cs) };
  return [...node.textContent].map((ch, i) => {
    rg.setStart(node, i);
    rg.setEnd(node, i + 1);
    const r = rg.getBoundingClientRect();
    return { ch, el: null, del: true, box: { ...b, x: ox + r.left - sr.left, w: r.width, h: b.lh } };
  });
}
function fallFromInk(span, chars) {
  const r = span.getBoundingClientRect();
  const fs = parseFloat(getComputedStyle(span).fontSize);
  const row = document.createElement('div');
  row.className = 'fly fly-row';
  row.style.cssText = `left:${f2(r.left)}px;top:${f2(r.top + r.height / 2 - fs * 0.58)}px;font:400 ${fs}px/1 var(--serif);display:flex;letter-spacing:-.014em`;
  const recs = [...span.textContent].map((ch, i) => {
    const el = document.createElement('span');
    el.className = ch === ' ' ? 'q' : 's';
    if (ch !== ' ') el.textContent = ch;
    row.appendChild(el);
    // the same glyph, now cast on a sort: a taller body and a hair of side bearing
    const c = chars[i] && chars[i].box;
    const box = c && { ...c, x: c.x - fs * 0.012, y: c.y - (fs * 1.16 - c.lh) / 2, w: c.w + fs * 0.024, h: fs * 1.16 };
    return { el, ch, box, marks: H.strike };
  });
  $('#flyers').appendChild(row);
  anim(row, [{ opacity: 0, transform: 'translateY(0)' }, { opacity: 1, transform: `translateY(${f2(-fs * 0.05)}px)` }], { duration: 200, fill: 'forwards', easing: 'ease-out' });
  anim(span, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  return wait(210).then(() => {
    // the stroke leaves in pieces, each on its own sort
    const p = flySorts(recs);
    H.strike.innerHTML = '';
    return p;
  }).then(() => row.remove());
}
async function heroIntro() {
  const gone = $('.gone', H.h1);
  sizeNotes();
  if (REDUCE || !gone) {
    if (gone) gone.remove();
    placeHeroMarks();
    H.dele.classList.add('is-on');
    H.note.classList.add('is-on');
    root.classList.add('intro-go');
    if (REDUCE) {
      // the still: the hellbox already holds every sort the page deletes
      const r = HB.floor.getBoundingClientRect();
      const rr = rng(5);
      const chars = ', um,' + $$('.fig[data-line]').map((f) => parse(f.dataset.line).filter((c) => c.del).map((c) => c.ch).join('')).join('');
      [...chars].forEach((ch) => hbLand(ch, r.left + r.width * (0.08 + rr() * 0.8), r.top + r.height * (0.1 + rr() * 0.72)));
      hbTally(1 + $$('.fig[data-line]').reduce((n, f) => n + (f.dataset.line.match(/\[/g) || []).length, 0));
    } else hbTally(1);
    return;
  }
  await Promise.race([document.fonts.ready, wait(1500)]);
  await wait(120);
  root.classList.add('intro-go');
  // the first proof is pulled: a roller passes down the sheet
  const dur = 1050;
  pullSheet(H.sheet, H.type, dur);
  await wait(dur * 0.62);
  // the proofreader reads it and marks the only thing it ever marks
  const gr = gone.getBoundingClientRect();
  placeHeroMarks(gr);
  const scs = getComputedStyle(H.strike);
  H.strike.setAttribute('viewBox', `0 0 ${parseFloat(scs.width)} ${parseFloat(scs.height)}`);
  const chars = inkChars(gone, H.sheet);
  const gl = chars.filter((c) => c.ch !== ' ').map(glyph);
  let lo = chars[0].box.x;
  let hi = chars[chars.length - 1].box.x + chars[chars.length - 1].box.w;
  // clear of the "t" it follows, and of the next word if that shares the line
  const clear = Math.max(1.6, gl[0].fs * 0.05);
  const words = $$('.w', H.h1).filter((w) => w !== gone);
  const k = words.findIndex((w) => w.compareDocumentPosition(gone) & Node.DOCUMENT_POSITION_PRECEDING);
  const prev = k > 0 ? inkChars(words[k - 1], H.sheet) : null;
  const next = k >= 0 ? inkChars(words[k], H.sheet) : null;
  if (prev) lo = Math.max(lo, glyph(prev[prev.length - 1]).r + clear);
  if (next && Math.abs(next[0].box.y - chars[0].box.y) < 4) hi = Math.min(hi, glyph(next[0]).l - clear);
  const { d, sw } = stroke(gl, lo, hi, 3, 0.045);
  H.strike.innerHTML = `<g class="mark-ink"><path class="mark-path" d="${d}" stroke-width="${f2(sw)}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/></g>`;
  padInk(H.strike);
  await anim($('path', H.strike), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 380, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
  H.dele.classList.add('is-on');
  await wait(560);
  hbTally(1);
  const falling = fallFromInk(gone, chars);
  await wait(300);
  await reflow(words, [gone], () => { gone.style.display = 'none'; }, 520);
  H.note.classList.add('is-on');
  placeHeroMarks(phone() ? null : gr);
  await falling;
  gone.remove();
  H.strike.innerHTML = '';
}

/* -------------------------------------------------------- the gesture */
const SENT = [
  'It’s [a, uh, ]a leak.',
  '[Uh, ]I need you to [um, ]fix the login bug[, um,] and then update the readme.',
  'We’re meeting [with the, um, ]with Kowalski’s team on Wednesday.',
  '[Um, so the deploy failed, uh, scratch that, ]{t|T}he deploy passed.',
  'Мы[,] [э, ]думаем, что[,] [ээ, ]надо подождать.',
];
const G = {
  btn: $('#hold'), lines: $('#stick-lines'), marks: $('#stick-marks'), knee: $('#stick-knee'),
  slip: $('.slip-live'), no: $('#proof-no'), press: $('#press'), sheet: $('.sheet-gesture'), turn: $('#turn-note'),
  state: 'idle', idx: 0, set: null, dropped: 0, timer: 0, t0: 0, auto: false, ghost: false, used: false, proofs: 0, token: 0,
};
const proofText = (text) => (text ? (/[.!?]$/.test(text) ? text : `${text}…`) : '…');
// The plate never changes size: the stick and the proof slip are measured once for the
// longest line they will ever hold, at this width.
function reserve() {
  const probe = G.lines.cloneNode(false);
  probe.removeAttribute('id');
  probe.style.cssText = `position:absolute;left:0;top:0;width:${G.lines.clientWidth}px;min-height:0;visibility:hidden`;
  G.lines.parentElement.appendChild(probe);
  let h = 0;
  SENT.forEach((s) => { setSorts(probe, parse(s)); h = Math.max(h, probe.offsetHeight); });
  probe.remove();
  G.lines.style.minHeight = `${h}px`;
  const p = $('.printed', G.slip);
  const pp = p.cloneNode(false);
  pp.removeAttribute('id');
  pp.removeAttribute('aria-live');
  pp.style.cssText = `position:absolute;left:0;top:0;width:${p.clientWidth}px;visibility:hidden`;
  G.slip.appendChild(pp);
  let ph = 0;
  SENT.forEach((s) => { pp.textContent = proofText(cleanOf(parse(s))); ph = Math.max(ph, pp.offsetHeight); });
  pp.remove();
  p.style.minHeight = `${ph}px`;
}
function setStep(name) {
  G.sheet.classList.toggle('press-on', !!name);
  $$('.step', G.sheet).forEach((s) => s.classList.toggle('is-now', s.dataset.step === name));
}
function dropWord(w) {
  w.el.style.visibility = '';
  if (REDUCE) return;
  const r = rng(w.text.length * 7 + G.idx * 3);
  w.sorts.forEach((rec, i) => {
    rec.el.animate([
      { transform: `translate(${f2((r() - 0.5) * 10)}px,${f2(-22 - r() * 16)}px) scale(1.5) rotate(${f2((r() - 0.5) * 14)}deg)`, opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
    ], { duration: 400, delay: i * 18, easing: 'cubic-bezier(.25,1.5,.45,1)', fill: 'backwards' });
  });
}
function gStart(ghost) {
  G.token++;
  G.state = 'speaking';
  G.auto = false;
  G.ghost = ghost;
  G.t0 = performance.now();
  if (!ghost) { G.used = true; G.turn.classList.remove('is-on'); }
  G.btn.classList.add('is-down');
  setStep('speak');
  G.marks.innerHTML = '';
  G.knee.getAnimations().forEach((a) => a.cancel());
  const chars = parse(SENT[G.idx % SENT.length]);
  G.idx++;
  G.set = setSorts(G.lines, chars, G.idx * 11);
  G.set.words.forEach((w) => { w.el.style.visibility = 'hidden'; });
  G.dropped = 0;
  const next = () => {
    if (G.state !== 'speaking') return;
    if (G.dropped >= G.set.words.length) {
      if (G.auto || G.ghost) gRelease(true);
      else setStep('go');
      return;
    }
    const w = G.set.words[G.dropped++];
    dropWord(w);
    const nw = G.set.words[G.dropped];
    let delay = 150 + w.text.length * 40;
    if (nw && nw.allDel) delay += 170;
    G.timer = setTimeout(next, REDUCE ? 40 : delay);
  };
  next();
}
function gRelease(natural) {
  if (G.state !== 'speaking') return;
  const held = performance.now() - G.t0;
  G.btn.classList.remove('is-down');
  if (!natural && !G.ghost && held < 280 && G.dropped < G.set.words.length) { G.auto = true; return; }
  clearTimeout(G.timer);
  G.state = 'setting';
  setStep('go');
  G.set.words.slice(G.dropped).forEach((w) => w.el.remove());
  gSet(G.set.sorts.filter((x) => x.el.isConnected), ++G.token);
}
async function gSet(recs, tok) {
  const dels = recs.filter((x) => x.del);
  const keep = recs.filter((x) => !x.del);
  const text = cleanOf(recs);
  if (dels.length) {
    const { done, runs } = drawStrikes(G.marks, recs, { stagger: 150, margin: !phone() });
    await done;
    if (tok !== G.token) return;
    await wait(220);
    if (tok !== G.token) return;
    hbTally(HB.n + runs.length);
    flySorts(dels);
    // each stroke leaves in pieces with its sorts; the deles stay in the margin
    $('.mark-ink', G.marks)?.remove();
    await wait(260);
    if (tok !== G.token) return;
    await reflow(keep.map((x) => x.el), dels.map((x) => x.el), () => { dels.forEach((x) => { x.el.style.display = 'none'; }); });
    if (tok !== G.token) return;
    // the line is set: its margin marks have been carried out
    $$('.mark-dele, .mark-conc', G.marks).forEach((m) => anim(m, [{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }).then(() => m.remove()));
  }
  await capSwaps(keep, keep);
  if (tok !== G.token) return;
  // lock up: the knee closes on the line
  const sr = G.knee.parentElement.getBoundingClientRect();
  const kr = G.knee.getBoundingClientRect();
  const right = Math.max(...keep.map((x) => x.el.getBoundingClientRect().right), sr.left + 60);
  const dx = Math.min(0, right + 3 - kr.left);
  anim(G.knee, [{ transform: 'translateX(0)' }, { transform: `translateX(${f2(dx)}px)` }], { duration: 380, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' });
  await wait(420);
  if (tok !== G.token) return;
  G.proofs++;
  G.no.textContent = G.proofs;
  await pull(G.slip, proofText(text));
  if (tok !== G.token) return;
  G.state = 'idle';
  setStep(null);
  if (G.ghost) { G.ghost = false; if (!G.used) G.turn.classList.add('is-on'); }
}
function gDown() {
  if (G.state === 'speaking') {
    G.ghost = false; G.auto = false; G.used = true; G.t0 = -1e9;
    G.btn.classList.add('is-down');
    G.turn.classList.remove('is-on');
    if (G.dropped >= G.set.words.length) setStep('go');
    return;
  }
  gStart(false);
}
function gUp() {
  if (G.state === 'speaking' && !G.ghost && G.btn.classList.contains('is-down')) gRelease(false);
}
function gestureInit() {
  const b = G.btn;
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
    gDown();
  });
  b.addEventListener('pointerup', gUp);
  b.addEventListener('pointercancel', gUp);
  b.addEventListener('lostpointercapture', gUp);
  b.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) gDown(); }
  });
  b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); gUp(); } });
  b.addEventListener('blur', gUp);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', (e) => e.preventDefault());
  addEventListener('blur', gUp);
  if (REDUCE) {
    // a composed still: one line already set and proofed
    const set = setSorts(G.lines, parse('It’s a leak.'), 3);
    set.words.forEach((w) => { w.el.style.visibility = ''; });
    G.proofs = 1;
    G.no.textContent = 1;
    $('.printed', G.slip).textContent = 'It’s a leak.';
    return;
  }
  when($('#stick'), 0.62, () => {
    setTimeout(() => { if (!G.used && G.state === 'idle' && G.proofs === 0) gStart(true); }, 450);
  });
}

/* ------------------------------------------------- clean verbatim figs */
function figuresInit() {
  const figs = $$('.fig[data-line]');
  figs.forEach((fig, i) => {
    fig._set = setSorts($('.galley-lines', fig), parse(fig.dataset.line), 40 + i * 9);
  });
  if (REDUCE) {
    requestAnimationFrame(() => figs.forEach((fig) => figureMarks(fig, true)));
    return;
  }
  figs.forEach((fig) => when($('.galley', fig), 0.6, () => playFigure(fig)));
  const kept = $('.fig-kept');
  when(kept, 0.62, () => kept.classList.add('is-on'));
}
function figureMarks(fig, still) {
  const { done, runs } = drawStrikes($('.galley-marks', fig), fig._set.sorts, { stagger: still ? 0 : 230 });
  const margin = $('.galley-margin', fig);
  margin.textContent = '';
  runs.forEach((run, i) => {
    if (i) { const c = document.createElement('span'); c.className = 'conc'; c.textContent = '/'; margin.appendChild(c); }
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'dele');
    s.setAttribute('viewBox', '0 0 40 56');
    s.innerHTML = '<use href="#i-dele"/>';
    margin.appendChild(s);
  });
  const kids = Array.from(margin.children);
  kids.forEach((k, i) => setTimeout(() => k.classList.add('is-on'), still ? 0 : 150 + i * 115));
  if (still) fig.classList.add('is-printed');
  return { p: done, runs };
}
async function playFigure(fig) {
  if (fig._played) return;
  fig._played = true;
  const { p, runs } = figureMarks(fig, false);
  await p;
  await wait(420, fig);
  const dels = fig._set.sorts.filter((x) => x.del);
  hbTally(HB.n + runs.length);
  // each sort leaves with its piece of the mark; the galley keeps a marked impression of it
  const flying = flySorts(dels, { ghost: true });
  await wait(420, fig);
  fig.classList.add('is-printed');
  await pull($('.slip-fig', fig));
  await flying;
  fig.classList.add('is-done');
}

/* ----------------------------------------------------------- where */
function whereInit() {
  const letter = $('#letter');
  const tty = $('#tty');
  [letter, tty].forEach(el => {
    const cmd = $('.said-cmd', el);
    el._command = setSorts(cmd, parse(`[${cmd.textContent.trim()}]`));
    const marks = document.createElementNS(NS, 'svg');
    marks.classList.add('command-marks');
    marks.setAttribute('aria-hidden', 'true');
    cmd.appendChild(marks);
  });
  if (REDUCE) { letter.classList.add('is-done'); tty.classList.add('is-done'); return; }
  when(letter, 0.55, () => playLetter(letter));
  when(tty, 0.55, () => playTty(tty));
}
async function playLetter(el) {
  await wait(500, el);
  await deleteCommand(el);
  const lp2 = $('.lp2', el);
  await flip([lp2], () => el.classList.add('is-done'), 640);
}
async function playTty(el) {
  await wait(900, el);
  await deleteCommand(el);
  const first = $('.tl', el);
  await flip([first], () => el.classList.add('is-done'), 520);
  el.classList.add('is-pressed');
  await wait(170, el);
  el.classList.remove('is-pressed');
}

async function deleteCommand(el) {
  const sorts = el._command.sorts;
  const marks = $('.command-marks', el);
  await drawStrikes(marks, sorts, { stagger: 0 }).done;
  await wait(300, el);
  hbTally(HB.n + 1);
  const flying = flySorts(sorts);
  $('.mark-ink', marks)?.remove();
  await flying;
}

/* ------------------------------------------------------------ the sign */
const SIGN = { el: $('#sign'), art: $('.chase-art'), th: 0, w: 0, vis: false };
function signTask(t, dt) {
  const s = dt / 1000;
  SIGN.w += (-10 * Math.sin(SIGN.th) - 1.05 * SIGN.w) * s;
  SIGN.th += SIGN.w * s;
  SIGN.el.style.transform = `rotate(${(SIGN.th * 57.2958).toFixed(3)}deg)`;
  return SIGN.vis && (Math.abs(SIGN.th) > 0.0004 || Math.abs(SIGN.w) > 0.0004);
}
function signKick(v) {
  if (REDUCE || !SIGN.vis) return;
  SIGN.w = clamp(SIGN.w + v, -1.4, 1.4);
  run(signTask);
}
function signInit() {
  if (!SIGN.el) return;
  new IntersectionObserver((ents) => ents.forEach((e) => {
    const was = SIGN.vis;
    SIGN.vis = e.isIntersecting;
    if (SIGN.vis && !was && !SIGN.art.classList.contains('is-locked')) {
      // a beat to see it loose, then the key turns
      setTimeout(() => { SIGN.art.classList.add('is-locked'); signKick(0.32); }, REDUCE ? 0 : 450);
    }
  }), { threshold: 0.45 }).observe(SIGN.art);
  if (FINE) {
    SIGN.art.addEventListener('pointermove', (e) => {
      const r = SIGN.el.getBoundingClientRect();
      if (e.clientY > r.top - 20 && e.clientY < r.bottom + 10 && e.clientX > r.left - 10 && e.clientX < r.right + 10) signKick(clamp(e.movementX * 0.01, -0.25, 0.25));
    });
  }
}

/* ------------------------------------------------------------- gauge */
const GA = { el: $('#gauge'), needle: $('#gauge-needle'), map: null };
function gaugeLayout() {
  GA.map = ruler($('.gauge-face', GA.el));
  if (!GA.map) return;
  const x70 = GA.map.x(70);
  GA.el.style.setProperty('--mx', `${f2(x70)}px`);
  if (GA.done || REDUCE) GA.needle.style.setProperty('--x', `${f2(x70)}px`);
  else GA.needle.style.setProperty('--x', `${f2(GA.map.x(0))}px`);
}
function gaugeInit() {
  if (!GA.el) return;
  gaugeLayout();
  if (REDUCE) { GA.el.classList.add('is-on'); GA.done = true; return; }
  when(GA.el, 0.62, () => {
    setTimeout(() => {
      const a = GA.map.x(0);
      const b = GA.map.x(70);
      GA.done = true;
      GA.needle.style.setProperty('--x', `${f2(b)}px`);
      // the needle takes the time it measures: 70 ms
      anim(GA.needle, [
        { transform: `translateX(${f2(a)}px)` },
        { transform: `translateX(${f2(b + 4)}px)`, offset: 0.33 },
        { transform: `translateX(${f2(b - 1.5)}px)`, offset: 0.62 },
        { transform: `translateX(${f2(b)}px)` },
      ], { duration: 210, easing: 'linear' });
      setTimeout(() => GA.el.classList.add('is-on'), 260);
    }, 500);
  });
}

/* ------------------------------------------------------------- depth */
const DEPTH = { els: $$('[data-depth]'), vis: new Set(), tx: 0, ty: 0, x: 0, y: 0 };
function docTop(el) {
  let y = 0;
  let e = el;
  while (e) { y += e.offsetTop; e = e.offsetParent; }
  return y;
}
function depthLayout() {
  $$('.scene').forEach(el => el.style.setProperty('--scene-height', `${el.offsetHeight}px`));
  DEPTH.els.forEach((el) => {
    el._d = parseFloat(el.dataset.depth) || 0;
    el._top = !!el.closest('.hero');
    el._cy = docTop(el) + el.offsetHeight / 2;
    el.style.setProperty('--d', el._d);
  });
}
function scrollFallback() {
  const y = scrollY;
  const vh = innerHeight;
  for (const el of DEPTH.vis) {
    const off = el._top ? -el._d * Math.min(y, 1000) : el._d * (el._cy - y - vh / 2);
    el.style.transform = `translate3d(0,${off.toFixed(1)}px,0)`;
  }
  return false;
}
function pointerTask() {
  DEPTH.x += (DEPTH.tx - DEPTH.x) * 0.06;
  DEPTH.y += (DEPTH.ty - DEPTH.y) * 0.06;
  for (const el of DEPTH.vis) el.style.translate = `${(-DEPTH.x * el._d * 260).toFixed(2)}px ${(-DEPTH.y * el._d * 180).toFixed(2)}px`;
  return Math.abs(DEPTH.tx - DEPTH.x) + Math.abs(DEPTH.ty - DEPTH.y) > 0.0008 && !root.classList.contains('q-low');
}
function depthInit() {
  depthLayout();
  if (REDUCE) return;
  const io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (e.isIntersecting) DEPTH.vis.add(e.target); else DEPTH.vis.delete(e.target);
  }), { rootMargin: '25% 0px' });
  DEPTH.els.forEach((el) => io.observe(el));
  if (FINE) {
    addEventListener('pointermove', (e) => {
      DEPTH.tx = (e.clientX / innerWidth - 0.5) * 2;
      DEPTH.ty = (e.clientY / innerHeight - 0.5) * 2;
      if (!root.classList.contains('q-low')) run(pointerTask);
    }, { passive: true });
  }
  if (!SCROLL_TL) run(scrollFallback);
}

/* ------------------------------------------------------------- dwell */
// On a desk wide enough, each sheet stays pinned while the next one slides over it, and the
// gap before the next one (CSS --dwell) is its time to finish. If the next sheet arrives
// first anyway, the scene's own clock runs at triple speed until it is uncovered again.
const SCENES = $$('.scene');
const STICKY = matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)');
function hurryCheck() {
  if (!STICKY.matches) return;
  for (let i = 0; i < SCENES.length - 1; i++) {
    const a = SCENES[i];
    const covered = SCENES[i + 1].getBoundingClientRect().top < Math.min(a.getBoundingClientRect().bottom, innerHeight) - 2;
    if (covered && !a._hurry) {
      a.getAnimations({ subtree: true }).forEach((x) => {
        if (x.timeline === document.timeline && !(x instanceof CSSAnimation) && !(x instanceof CSSTransition)) x.updatePlaybackRate(3);
      });
    }
    a._hurry = covered;
  }
}

/* ------------------------------------------------------------ bookend */
// The page ends the way it began: the roller pulls one last proof and the dele is written.
function pullSheet(sheet, type, dur) {
  const band = document.createElement('div');
  band.className = 'press-band';
  band.setAttribute('aria-hidden', 'true');
  sheet.appendChild(band);
  const tr = type.getBoundingClientRect();
  const sr = sheet.getBoundingClientRect();
  const easing = 'cubic-bezier(.5,0,.3,1)';
  anim(type, [{ clipPath: 'inset(-12% -12% 100% -12%)' }, { clipPath: 'inset(-12% -12% -12% -12%)' }], { duration: dur, easing, fill: 'backwards' });
  return anim(band, [{ transform: `translateY(${tr.top - sr.top - 80}px)`, opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { transform: `translateY(${tr.bottom - sr.top + 40}px)`, opacity: 0 }], { duration: dur, easing, fill: 'forwards' }).then(() => band.remove());
}
function bookendInit() {
  const sheet = $('.sheet-colophon');
  const type = $('.colophon-type', sheet);
  if (!sheet || REDUCE) return;
  type.classList.add('is-waiting');
  $('.device', sheet).classList.add('is-pending');
  let pulled = false;
  const lastProof = async () => {
    if (pulled) return;
    pulled = true;
    type.classList.remove('is-waiting');
    await pullSheet(sheet, type, 1250);
    $('.device', sheet).classList.add('is-on');
  };
  when(type, 0.5, lastProof);
  // a keyboard user can reach Download before the sheet is half way up the screen
  type.addEventListener('focusin', lastProof);
}

/* -------------------------------------------------- masthead & scroll */
const MAST = $('#mast');
let lastY = scrollY;
function onScroll() {
  const y = scrollY;
  MAST.classList.toggle('is-solid', y > 40);
  if (y > lastY + 5 && y > 420 && !MAST.contains(document.activeElement)) MAST.classList.add('is-hidden');
  else if (y < lastY - 5) MAST.classList.remove('is-hidden');
  if (SIGN.vis) signKick(clamp((y - lastY) * 0.0012, -0.12, 0.12));
  lastY = y;
  if (!SCROLL_TL && !REDUCE) run(scrollFallback);
  run(trigTask);
}
function trigTask() { if (triggers.length) checkTriggers(); hurryCheck(); return false; }
addEventListener('scroll', onScroll, { passive: true });
MAST.addEventListener('focusin', () => MAST.classList.remove('is-hidden'));

/* ------------------------------------------------------------- resize */
let rzT = 0;
let lastW = innerWidth;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    paperAll();
    $$('[data-ruler="picas"],[data-ruler="stick"]').forEach(ruler);
    gaugeLayout();
    sizeNotes();
    reserve();
    if (!$('.gone', H.h1)) placeHeroMarks();
    depthLayout();
    if (innerWidth !== lastW) {
      lastW = innerWidth;
      $$('.fig.is-printed').forEach(fig => figureMarks(fig, true));
    }
  }, 160);
});

/* --------------------------------------------------------------- boot */
function boot() {
  signatures();
  inkWords();
  paperAll();
  $$('[data-ruler="picas"],[data-ruler="stick"]').forEach(ruler);
  typeCase($('#case-svg'));
  thumbprint($('#thumb'));
  chase();
  if (!REDUCE) $$('.sheet').forEach((s) => s.setAttribute('data-tilt', ''));
  depthInit();
  gestureInit();
  reserve();
  figuresInit();
  whereInit();
  signInit();
  gaugeInit();
  bookendInit();
  onScroll();
  heroIntro();
  setTimeout(checkTriggers, 300);
  document.fonts.ready.then(() => { paperAll(); sizeNotes(); reserve(); gaugeLayout(); if (!$('.gone', H.h1)) placeHeroMarks(); $$('.fig.is-printed').forEach(fig => figureMarks(fig, true)); depthLayout(); });
}
boot();
