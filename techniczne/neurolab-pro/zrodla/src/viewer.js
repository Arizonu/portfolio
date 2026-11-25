import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export { THREE, CSS2DObject };

/* Shared 3D stage: one renderer for the whole app, modules swap content in `root`. */
export class Viewer {
  constructor(stage) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas.gl');
    this.ok = true;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
      this.ok = false;
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.localClippingEnabled = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07080a);
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100000);
    this.camera.position.set(0, 0, 10);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.screenSpacePanning = true;

    this.key = new THREE.DirectionalLight(0xffffff, 1.6);
    this.key.position.set(1, 1.4, 1.2);
    this.camera.add(this.key);
    this.fill = new THREE.DirectionalLight(0x9db8ff, 0.5);
    this.fill.position.set(-1.2, -0.4, 0.6);
    this.camera.add(this.fill);
    this.scene.add(this.camera);
    this.ambient = new THREE.HemisphereLight(0xdfe8ff, 0x101014, 0.35);
    this.scene.add(this.ambient);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.labels = new CSS2DRenderer({ element: stage.querySelector('.labels') });

    this.gizmo = this._makeGizmo();
    this.frames = [];
    this.pickables = [];
    this.onHover = null;
    this.onPick = null;
    this.units = { name: 'µm', perUnit: 1 };
    this.ray = new THREE.Raycaster();
    this.ray.params.Line = { threshold: 2 };
    this.ndc = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.visible = true;
    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(stage);
    this._io = new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; });
    this._io.observe(stage);
    this.scaleEl = stage.querySelector('.scalebar');
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    if (!this.ok) return;
    const w = Math.max(10, this.stage.clientWidth), h = Math.max(10, this.stage.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  /* Remove module content and reset defaults. */
  clear() {
    if (!this.ok) return;
    const kill = (o) => {
      o.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { for (const k in x) { if (x[k] && x[k].isTexture) x[k].dispose(); } x.dispose(); });
        if (m.isCSS2DObject && m.element && m.element.parentNode) m.element.parentNode.removeChild(m.element);
      });
    };
    for (const c of [...this.root.children]) { this.root.remove(c); kill(c); }
    this.frames = [];
    this.pickables = [];
    this.onHover = null;
    this.onPick = null;
    this.bloom.strength = 0.35;
    this.bloom.threshold = 0.82;
    this.scene.background.set(0x07080a);
    this.controls.autoRotate = false;
    this.controls.enabled = true;
    this.renderer.clippingPlanes = [];
    this.gizmoLabels = ['x', 'y', 'z'];
    this._setGizmoLabels(['x', 'y', 'z']);
    this.setUnits('µm', 1);
  }

  setUnits(name, perUnit) { this.units = { name, perUnit }; }

  frame(target, radius, dir) {
    const d = (dir || new THREE.Vector3(0, 0, 1)).clone().normalize();
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (this.w && this.h ? this.w / this.h : 1.6));
    const dist = radius / Math.sin(Math.min(vf, hf) / 2) * 1.05;
    this.camera.near = Math.max(dist / 1000, 0.01);
    this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(d, dist);
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this._home = { target: target.clone(), pos: this.camera.position.clone(), up: this.camera.up.clone() };
  }

  view(dir, up) {
    const t = this.controls.target.clone();
    const dist = this.camera.position.distanceTo(t);
    this.camera.up.copy(up || new THREE.Vector3(0, 1, 0));
    this.camera.position.copy(t).addScaledVector(dir.clone().normalize(), dist);
    this.camera.lookAt(t);
    this.controls.update();
  }

  home() {
    if (!this._home) return;
    this.controls.target.copy(this._home.target);
    this.camera.position.copy(this._home.pos);
    this.camera.up.copy(this._home.up);
    this.controls.update();
  }

  zoom(f) {
    const t = this.controls.target;
    const v = this.camera.position.clone().sub(t).multiplyScalar(1 / f);
    this.camera.position.copy(t).add(v);
    this.controls.update();
  }

  _bindPointer() {
    const c = this.canvas;
    let down = null;
    let last = 0;
    c.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    c.addEventListener('pointerup', (e) => {
      if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) < 5 && this.onPick) {
        const h = this.hit(e);
        this.onPick(h, e);
      }
      down = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.onHover || e.buttons) return;
      const now = performance.now();
      if (now - last < 40) return;
      last = now;
      this.onHover(this.hit(e), e);
    });
    c.addEventListener('pointerleave', () => { if (this.onHover) this.onHover(null); });
  }

  hit(e) {
    if (!this.pickables.length) return null;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.pickables, false);
    for (const h of hits) {
      let o = h.object, vis = true;
      while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
      if (!vis) continue;
      if (h.object.userData.skipPick) continue;
      const planes = this.renderer.clippingPlanes;
      if (planes && planes.length && planes.some((p) => p.distanceToPoint(h.point) < 0)) continue;
      return h;
    }
    return null;
  }

  _makeGizmo() {
    const s = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
    cam.position.set(0, 0, 4);
    const g = new THREE.Group();
    const cols = [0xff6b6b, 0x7ee787, 0x79c0ff];
    const dirs = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    this._gizmoSprites = [];
    dirs.forEach((d, i) => {
      const arrow = new THREE.ArrowHelper(d, new THREE.Vector3(), 1, cols[i], 0.28, 0.16);
      g.add(arrow);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._labelTex('xyz'[i], cols[i]), depthTest: false }));
      sp.position.copy(d).multiplyScalar(1.38);
      sp.scale.setScalar(0.55);
      g.add(sp);
      this._gizmoSprites.push({ sp, col: cols[i] });
    });
    s.add(g);
    return { scene: s, cam, group: g };
  }

  _labelTex(txt, col) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const cx = cv.getContext('2d');
    cx.font = '600 64px "IBM Plex Mono", monospace';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = '#' + new THREE.Color(col).getHexString();
    cx.fillText(txt, 64, 68);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _setGizmoLabels(arr) {
    if (!this._gizmoSprites) return;
    this._gizmoSprites.forEach((g, i) => {
      g.sp.material.map.dispose();
      g.sp.material.map = this._labelTex(arr[i], g.col);
      g.sp.material.needsUpdate = true;
    });
  }

  setGizmoLabels(arr) { this._setGizmoLabels(arr); }

  _updateScaleBar() {
    if (!this.scaleEl) return;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const worldH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const pxPerUnit = this.h / worldH;
    const target = 120 / pxPerUnit;
    const p = Math.pow(10, Math.floor(Math.log10(target)));
    const n = [1, 2, 5, 10].map((m) => m * p).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const px = n * pxPerUnit;
    const val = n * this.units.perUnit;
    const txt = (val >= 1000 && this.units.name === 'µm') ? (val / 1000) + ' mm' : (val >= 1000 && this.units.name === 'nm') ? (val / 1000) + ' µm' : (+val.toPrecision(3)) + ' ' + this.units.name;
    if (this._sbTxt !== txt || Math.abs((this._sbPx || 0) - px) > 0.5) {
      this.scaleEl.querySelector('i').style.width = px.toFixed(1) + 'px';
      this.scaleEl.querySelector('span').textContent = txt;
      this._sbTxt = txt; this._sbPx = px;
    }
  }

  _loop() {
    requestAnimationFrame(this._loop);
    if (!this.ok || !this.visible || document.hidden) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.controls.update();
    for (const f of this.frames) f(t, dt);
    this.composer.render();
    this.labels.render(this.scene, this.camera);
    const r = this.renderer;
    const sz = Math.round(Math.min(96, this.w * 0.16));
    r.autoClear = false;
    r.clearDepth();
    r.setScissorTest(true);
    r.setViewport(10, 10, sz, sz);
    r.setScissor(10, 10, sz, sz);
    this.gizmo.group.quaternion.copy(this.camera.quaternion).invert();
    const savedClip = r.clippingPlanes;
    r.clippingPlanes = [];
    r.render(this.gizmo.scene, this.gizmo.cam);
    r.clippingPlanes = savedClip;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.w, this.h);
    r.autoClear = true;
    this._updateScaleBar();
  }
}
