import { Viewer } from './viewer.js';
import { el } from './ui.js';
import cortex from './mod_cortex.js';
import morph from './mod_morph.js';
import hh from './mod_hh.js';
import cable from './mod_cable.js';
import synapse from './mod_synapse.js';
import network from './mod_network.js';
import start from './mod_start.js';

const MODS = [start, cortex, morph, hh, cable, synapse, network];
const $ = (id) => document.getElementById(id);
const tabs = $('tabs');
for (const m of MODS) {
  if (m.id === 'start') continue;
  tabs.append(el('a', { href: '#' + m.id, 'data-id': m.id, text: m.tab }));
}

const viewer = new Viewer($('stage'));
const readout = $('readout');
let cur = null;

const ctx = {
  viewer,
  left: $('left'), right: $('right'), dock: $('dock'), work: $('work'),
  title(t, sub) { const e = $('ttl'); e.replaceChildren(t, sub ? el('small', { text: sub }) : ''); },
  readout(lines) {
    if (!lines) { readout.classList.remove('on'); return; }
    readout.replaceChildren(...lines.map((l) => (Array.isArray(l) ? el('div', null, [el('b', { text: l[0] }), ' ', el('span', { class: 'mono', text: l[1] })]) : el('div', { text: l }))));
    readout.classList.add('on');
  },
  busy(on) { $('busy').classList.toggle('on', !!on); },
  dockSize(v) { document.body.classList.toggle('nodock', !v); document.documentElement.style.setProperty('--dock', (v || 0) + '%'); },
  meta(t) { $('meta').textContent = t || ''; },
  go(id) { location.hash = id; }
};

$('zin').onclick = () => viewer.zoom(1.25);
$('zout').onclick = () => viewer.zoom(0.8);
$('zhome').onclick = () => viewer.home();
$('zrot').onclick = (e) => { viewer.controls.autoRotate = !viewer.controls.autoRotate; viewer.controls.autoRotateSpeed = 0.8; e.currentTarget.setAttribute('aria-pressed', String(viewer.controls.autoRotate)); };

async function route() {
  const id = (location.hash || '#start').slice(1);
  const mod = MODS.find((m) => m.id === id) || MODS[0];
  if (cur === mod) return;
  if (cur && cur.unmount) { try { cur.unmount(); } catch (e) { console.error(e); } }
  viewer.clear && viewer.clear();
  ctx.left.replaceChildren(); ctx.right.replaceChildren(); ctx.dock.replaceChildren();
  ctx.readout(null); ctx.busy(false); ctx.meta('');
  document.querySelectorAll('.about').forEach((n) => n.remove());
  for (const a of tabs.children) { if (a.dataset.id === mod.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  document.body.classList.toggle('page', !!mod.page);
  $('zrot').setAttribute('aria-pressed', 'false');
  cur = mod;
  document.title = mod.id === 'start' ? 'NeuroLab Pro' : 'NeuroLab Pro · ' + mod.tab;
  if (!mod.page && !viewer.ok) ctx.title('WebGL niedostępny', 'Ta przeglądarka nie obsługuje grafiki 3D; wykresy i symulacje nadal działają.');
  try { await mod.mount(ctx); } catch (e) { console.error(e); ctx.title('Błąd modułu', String(e && e.message || e)); }
}
window.addEventListener('hashchange', route);
route();
