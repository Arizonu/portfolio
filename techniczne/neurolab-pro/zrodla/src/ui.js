import { gradientCSS } from './colormaps.js';

let uid = 0;
export function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k === 'style') e.style.cssText = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  if (kids) for (const c of [].concat(kids)) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}

export function sec(parent, title, hint) {
  const s = el('section', { class: 'sec' });
  if (title) s.append(el('h3', { text: title }));
  if (hint) s.append(el('p', { class: 'hint', text: hint }));
  parent.append(s);
  return s;
}

export function note(parent, text, cls) {
  const p = el('p', { class: cls || 'note', text });
  parent.append(p);
  return p;
}

export function slider(parent, o) {
  const id = o.id || 'c' + (++uid);
  const fmt = o.fmt || ((v) => (+v).toLocaleString('pl-PL', { maximumFractionDigits: o.dec != null ? o.dec : 2 }));
  const out = el('output', { for: id });
  const inp = el('input', { type: 'range', id, min: o.min, max: o.max, step: o.step || 'any', value: o.value });
  const row = el('div', { class: 'ctl' }, [
    el('label', { for: id }, [el('span', { text: o.label }), el('span', { class: 'val' }, [out, o.unit ? el('small', { text: ' ' + o.unit }) : null])]),
    inp
  ]);
  const paint = () => { out.textContent = fmt(+inp.value); const p = (inp.value - o.min) / (o.max - o.min) * 100; inp.style.setProperty('--p', p + '%'); };
  inp.addEventListener('input', () => { paint(); if (o.onInput) o.onInput(+inp.value); });
  inp.addEventListener('change', () => { if (o.onChange) o.onChange(+inp.value); });
  paint();
  parent.append(row);
  return { el: row, input: inp, get: () => +inp.value, set: (v) => { inp.value = v; paint(); } };
}

export function select(parent, o) {
  const id = o.id || 'c' + (++uid);
  const s = el('select', { id });
  for (const [v, t] of o.options) { const op = el('option', { value: v, text: t }); s.append(op); }
  s.value = o.value;
  s.addEventListener('change', () => o.onChange && o.onChange(s.value));
  const row = el('div', { class: 'ctl' }, [el('label', { for: id }, [el('span', { text: o.label })]), s]);
  parent.append(row);
  return { el: row, input: s, get: () => s.value, set: (v) => { s.value = v; } };
}

export function seg(parent, o) {
  const wrap = el('div', { class: 'seg', role: 'group', 'aria-label': o.label || '' });
  const btns = [];
  let cur = o.value;
  const paint = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(cur))));
  for (const [v, t] of o.options) {
    const b = el('button', { type: 'button', 'data-v': v, text: t });
    b.addEventListener('click', () => { cur = v; paint(); o.onChange && o.onChange(v); });
    btns.push(b); wrap.append(b);
  }
  paint();
  const row = el('div', { class: 'ctl' }, [o.label ? el('span', { class: 'lab', text: o.label }) : null, wrap]);
  parent.append(row);
  return { el: row, get: () => cur, set: (v) => { cur = v; paint(); } };
}

export function toggle(parent, o) {
  const id = o.id || 'c' + (++uid);
  const inp = el('input', { type: 'checkbox', id, role: 'switch' });
  inp.checked = !!o.value;
  inp.addEventListener('change', () => o.onChange && o.onChange(inp.checked));
  const row = el('div', { class: 'ctl tog' }, [el('label', { for: id }, [inp, el('span', { text: o.label })])]);
  parent.append(row);
  return { el: row, get: () => inp.checked, set: (v) => { inp.checked = v; } };
}

export function button(parent, label, onClick, cls) {
  const b = el('button', { type: 'button', class: 'btn ' + (cls || ''), text: label });
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

export function buttons(parent, list) {
  const w = el('div', { class: 'btns' });
  const out = list.map(([label, fn, cls]) => button(w, label, fn, cls));
  parent.append(w);
  return out;
}

/* key–value readout table */
export function kv(parent, rows) {
  const t = el('table', { class: 'kv' });
  const cells = {};
  for (const [k, label, unit] of rows) {
    const v = el('td', { class: 'num', text: '–' });
    cells[k] = v;
    t.append(el('tr', null, [el('th', { scope: 'row', text: label }), v, el('td', { class: 'unit', text: unit || '' })]));
  }
  parent.append(t);
  return {
    el: t,
    set(k, val, dec) {
      if (!cells[k]) return;
      cells[k].textContent = typeof val === 'number' ? (isFinite(val) ? val.toLocaleString('pl-PL', { maximumFractionDigits: dec != null ? dec : 2, minimumFractionDigits: dec != null ? Math.min(dec, 1) : 0 }) : '–') : (val == null ? '–' : String(val));
    }
  };
}

export function colorbar(parent) {
  const bar = el('div', { class: 'cbar-g' });
  const lo = el('span'), mid = el('span', { class: 'cbar-l' }), hi = el('span');
  const w = el('div', { class: 'cbar' }, [bar, el('div', { class: 'cbar-t' }, [lo, mid, hi])]);
  parent.append(w);
  return {
    el: w,
    set(cm, a, b, label, dec = 2) {
      bar.style.background = gradientCSS(cm);
      const f = (x) => x.toLocaleString('pl-PL', { maximumFractionDigits: dec });
      lo.textContent = f(a); hi.textContent = f(b); mid.textContent = label || '';
    },
    cats(list) {
      bar.style.background = 'linear-gradient(90deg,' + list.map((c, i) => `${c[1]} ${i / list.length * 100}%,${c[1]} ${(i + 1) / list.length * 100}%`).join(',') + ')';
      lo.textContent = ''; hi.textContent = ''; mid.textContent = '';
    }
  };
}

export function legend(parent, items) {
  const ul = el('ul', { class: 'legend' });
  for (const [col, text] of items) ul.append(el('li', null, [el('i', { style: `background:${col}` }), el('span', { text })]));
  parent.append(ul);
  return ul;
}

export function fmtN(v, d = 1) { return (+v).toLocaleString('pl-PL', { maximumFractionDigits: d, minimumFractionDigits: d }); }
