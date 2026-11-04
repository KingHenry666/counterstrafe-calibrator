
/* ================= routing ================= */
var ROUTES = { home: 'home', setup: 'setup', results: 'results', 'scenario-stop': 'scene', 'scenario-strafe': 'scene', 'scenario-validate': 'scene', 'scenario-sweep': 'lab', 'scenario-bounce': 'lab' };
var currentView = 'home', currentScenario = null;
function route() {
  var h = (location.hash || '#home').slice(1);
  if (!ROUTES[h]) h = 'home';
  show(h);
}
function show(hash) {
  var kind = ROUTES[hash];
  var scen = hash.indexOf('scenario-') === 0 ? hash.slice(9) : null;
  if (scen && (scen === 'validate' ? !(runs.stop && runs.stop.metrics) : checksDone() < CHECKLIST.length)) {
    toast(scen === 'validate' ? '先完成场景 01，验证轮需要基线成绩' : '先完成基线清单');
    location.hash = scen === 'validate' ? '#home' : '#setup';
    return;
  }
  if (currentView === 'scene' && kind !== 'scene') Ctrl.leaveScene();
  if (currentView === 'lab' && kind !== 'lab') Lab.leave();
  if (currentView === 'scene' && kind === 'scene' && currentScenario !== scen) Ctrl.leaveScene();
  currentView = kind; currentScenario = scen;
  $('#view-home').hidden = kind !== 'home';
  $('#view-setup').hidden = kind !== 'setup';
  $('#view-scene').hidden = kind !== 'scene';
  $('#view-lab').hidden = kind !== 'lab';
  $('#view-results').hidden = kind !== 'results';
  $$('#nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-view') === hash); });
  if (kind === 'home') renderHome();
  if (kind === 'setup') renderSetup();
  if (kind === 'results') renderResults();
  if (kind === 'scene') Ctrl.enterScene(scen);
  if (kind === 'lab') Lab.enter(scen);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ================= home ================= */
function checksDone() { return CHECKLIST.filter(function (c) { return checks[c.id]; }).length; }
function scenarioStat(id) {
  var r = runs[id]; if (!r) return null;
  if (id === 'stop') return [['分数', r.score], ['停稳率', pct(r.metrics.stopRate)]];
  if (id === 'strafe') return [['重叠率', pct(r.metrics.overlapRate)], ['空档中位', fmt(r.metrics.airMedian) + ' ms']];
  if (id === 'sweep') return [['按压深度', r.depth ? mm(r.depth.lo) + (r.depth.hi != null ? '–' + r.depth.hi : '+') : '—'], ['抬起', r.lift != null ? mm(r.lift) : '—']];
  if (id === 'bounce') return [['回弹', r.bounceEvents + ' 次'], ['误触', r.restFalse + ' 次']];
  if (id === 'validate') return [['结果', r.pass ? '通过' : '未通过'], ['停稳率', pct(r.metrics.stopRate)]];
  return null;
}
function renderHome() {
  var done = checksDone();
  $('#home-check-meta').textContent = done === CHECKLIST.length ? '基线清单已完成' : '基线清单 ' + done + ' / ' + CHECKLIST.length + ' 已勾选';
  $('#scenario-grid').innerHTML = Object.keys(SCENARIOS).map(function (id) {
    var c = SCENARIOS[id], st = scenarioStat(id), r = runs[id];
    var stats = st ? st.map(function (p) { return '<div><b>' + p[1] + '</b><span>' + p[0] + '</span></div>'; }).join('') + '<div><b style="font-size:14px;font-weight:500;color:var(--fg-2)">' + dstr(r.date).slice(5) + '</b><span>上次</span></div>' : '<div><b>—</b><span>还没测</span></div>';
    var action;
    if (id === 'validate' && !(runs.stop && runs.stop.metrics)) action = '<span class="pill">先完成场景 01</span>';
    else if (done < CHECKLIST.length) action = '<a class="btn primary" href="#setup">先完成基线设置</a>';
    else action = '<a class="btn primary" href="#scenario-' + id + '">' + (r ? '再测一次' : '开始') + '</a>';
    return '<div class="card"><span class="eyebrow">场景 ' + c.no + ' · ' + c.en + '</span><h3>' + c.name + '</h3><p class="desc">' + c.desc + '</p><div class="stats">' + stats + '</div><div class="actions">' + action + '</div></div>';
  }).join('');
  var hs = history.filter(function (h) { return !h.scenario || h.scenario === 'stop'; });
  if (!hs.length) { $('#home-history').innerHTML = '<p class="hint">还没有成绩。完成一次场景 01 后，这里会列出最近 20 次。</p>'; return; }
  $('#home-history').innerHTML = '<table><thead><tr><th>时间</th><th>分数</th><th>停稳率</th><th>命中率</th><th>松键→开枪</th><th>急停使用率</th></tr></thead><tbody>' +
    hs.slice(0, 20).map(function (h) { return '<tr><td>' + esc(dstr(h.date)) + '</td><td class="v">' + h.score + '</td><td class="v">' + pct(h.stopRate) + '</td><td class="v">' + pct(h.hitRate) + '</td><td class="v">' + fmt(h.fireAfterRelease) + ' ms</td><td class="v">' + pct(h.csUseRate) + '</td></tr>'; }).join('') + '</tbody></table>';
}

/* ================= setup ================= */
function renderSetup() {
  var list = $('#checklist');
  if (!list.children.length) {
    list.innerHTML = CHECKLIST.map(function (c) { return '<label class="check"><input type="checkbox" id="ck-' + c.id + '" data-id="' + c.id + '"><div><div class="where">' + esc(c.where) + '</div><div class="what">' + c.what + '</div></div></label>'; }).join('');
    list.addEventListener('change', function (e) { var id = e.target.getAttribute('data-id'); if (!id) return; checks[id] = e.target.checked; Store.set('checklist', checks); updateCheckUI(); });
  }
  CHECKLIST.forEach(function (c) { $('#ck-' + c.id).checked = !!checks[c.id]; });
  updateCheckUI();
  $('#in-sens').value = settings.sens; $('#in-dpi').value = settings.dpi;
  $('#in-tacc').value = settings.tAcc; $('#in-tdec').value = settings.tDec; $('#in-trials').value = settings.trials; $('#in-spread').value = settings.maxSpreadDeg; $('#in-sound').value = String(settings.sound);
  updateSensUI();
  var g = estimateGranularity();
  $('#kv-gran').textContent = isFinite(g) ? '≈ ' + (g < 0.01 ? g.toFixed(3) : g.toFixed(2)) + ' ms（performance.now）' : '无法估计';
}
function updateCheckUI() {
  var done = checksDone();
  $('#check-count').textContent = done + ' / ' + CHECKLIST.length;
  $('#check-bar').style.width = (100 * done / CHECKLIST.length) + '%';
  var go = $('#go-scene');
  if (done === CHECKLIST.length) { go.removeAttribute('aria-disabled'); go.style.pointerEvents = ''; go.style.opacity = ''; }
  else { go.setAttribute('aria-disabled', 'true'); go.style.pointerEvents = 'none'; go.style.opacity = '0.45'; }
}
function updateSensUI() {
  var yaw = 0.07 * settings.sens, counts360 = 360 / yaw, cm = counts360 / settings.dpi * 2.54;
  $('#kv-yaw').textContent = yaw.toFixed(4) + ' ° / 计数';
  $('#kv-edpi').textContent = fmt(settings.sens * settings.dpi, 0);
  $('#kv-cm').textContent = fmt(cm, 1) + ' cm';
}
function bindSettings() {
  var map = { 'in-sens': ['sens', parseFloat], 'in-dpi': ['dpi', parseFloat], 'in-tacc': ['tAcc', parseFloat], 'in-tdec': ['tDec', parseFloat], 'in-trials': ['trials', parseInt], 'in-spread': ['maxSpreadDeg', parseFloat], 'in-sound': ['sound', parseInt] };
  Object.keys(map).forEach(function (id) {
    $('#' + id).addEventListener('change', function (e) { var v = map[id][1](e.target.value); if (isNaN(v)) return; settings[map[id][0]] = v; Store.set('settings', settings); updateSensUI(); });
  });
}
function estimateGranularity() { var min = Infinity, last = performance.now(); for (var i = 0; i < 4000; i++) { var n = performance.now(); var d = n - last; if (d > 0 && d < min) min = d; last = n; } return min; }
var SelfCheck = {
  log: [], lastT: null,
  push: function (label, t) { var d = this.lastT == null ? null : t - this.lastT; this.lastT = t; this.log.unshift((label + '            ').slice(0, 12) + (d == null ? '' : '+' + d.toFixed(1) + ' ms')); this.log = this.log.slice(0, 6); $('#evlog').textContent = this.log.join('\n'); },
  key: function (e, type) { var el = document.querySelector('.key[data-code="' + e.code + '"]'); if (el) { el.classList.toggle('down', type === 'down'); if (type === 'down') el.classList.add('seen'); } this.push(e.code + (type === 'down' ? ' ↓' : ' ↑'), e.timeStamp); }
};

/* ================= scene (three.js) ================= */
var Scene = {
  inited: false, ok: false, locked: false, fallback: false, yaw: 0, pitch: 0, holes: [], anim: { targetPop: 0 }, targetState: 'dim',
  init: function () {
    if (this.inited) return this.ok;
    this.inited = true;
    var T = window.THREE; if (!T) { this.ok = false; return false; }
    var host = $('#canvas-host');
    this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.scene = new T.Scene(); this.scene.background = new T.Color(0x0b1013); this.scene.fog = new T.Fog(0x0b1013, 22, 48);
    this.camera = new T.PerspectiveCamera(70, 1, 0.05, 120); this.camera.rotation.order = 'YXZ'; this.camera.position.set(0, 1.6, 0);
    this.scene.add(new T.HemisphereLight(0x9fc3d6, 0x0b1013, 0.9));
    var sun = new T.DirectionalLight(0xffffff, 0.55); sun.position.set(4, 9, 3); this.scene.add(sun);
    var floor = new T.Mesh(new T.PlaneGeometry(70, 70), new T.MeshStandardMaterial({ color: 0x111a1f, roughness: 0.95, metalness: 0 })); floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
    var grid = new T.GridHelper(70, 70, 0x33454f, 0x1a252c); grid.position.y = 0.002; this.scene.add(grid);
    var wallMat = new T.MeshStandardMaterial({ color: 0x18222a, roughness: 0.9 });
    var back = new T.Mesh(new T.BoxGeometry(34, 8, 0.6), wallMat); back.position.set(0, 4, -14.3); this.scene.add(back);
    var left = new T.Mesh(new T.BoxGeometry(0.6, 8, 44), wallMat); left.position.set(-17, 4, 0); this.scene.add(left);
    var right = new T.Mesh(new T.BoxGeometry(0.6, 8, 44), wallMat); right.position.set(17, 4, 0); this.scene.add(right);
    var mk = new T.MeshStandardMaterial({ color: 0x2a3640, emissive: 0xf2b544, emissiveIntensity: 0.25, roughness: 0.6 });
    for (var x = -12; x <= 12; x += 6) { var bar = new T.Mesh(new T.BoxGeometry(0.08, 5.5, 0.08), mk); bar.position.set(x, 3, -13.95); this.scene.add(bar); }
    var lane = new T.Mesh(new T.PlaneGeometry(26, 0.06), new T.MeshBasicMaterial({ color: 0x2b3b46 })); lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.004, 0); this.scene.add(lane);
    this.walls = [back, left, right, floor];
    this.targetMat = new T.MeshStandardMaterial({ color: 0x2b3942, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.45, metalness: 0.1 });
    this.target = new T.Mesh(new T.SphereGeometry(0.4, 32, 24), this.targetMat); this.target.position.set(0, 1.6, -10); this.scene.add(this.target);
    this.holeGeo = new T.CircleGeometry(0.05, 14); this.ray = new T.Raycaster(); this.tmpV = new T.Vector3();
    this.resize(); this.ok = true; return true;
  },
  resize: function () {
    if (!this.renderer) return;
    var host = $('#canvas-host'); var w = host.clientWidth || 1, h = host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    var aspect = w / h; this.camera.aspect = aspect;
    var vfov = 2 * Math.atan(Math.tan(settings.hFov * DEG / 2) / Math.max(aspect, 0.5)) / DEG;
    this.camera.fov = Math.min(110, Math.max(40, vfov)); this.camera.updateProjectionMatrix();
  },
  reset: function () { this.yaw = 0; this.pitch = 0; this.camera.position.set(0, 1.6, 0); this.target.visible = true; this.setTarget('dim'); },
  forward: function (yaw, pitch) { var cp = Math.cos(pitch); return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }; },
  placeTarget: function () {
    var yaw = this.yaw + (Math.random() * 30 - 15) * DEG, pitch = (Math.random() * 7 - 2) * DEG, f = this.forward(yaw, pitch), d = 10, p = this.camera.position;
    this.target.position.set(clamp(p.x + f.x * d, -14, 14), clamp(p.y + f.y * d, 0.7, 5), clamp(p.z + f.z * d, -13.5, -6));
    this.target.scale.setScalar(1); this.target.visible = true; this.setTarget('dim');
  },
  setTarget: function (state) {
    this.targetState = state; var m = this.targetMat;
    if (state === 'dim') { m.color.setHex(0x2b3942); m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
    if (state === 'lit') { m.color.setHex(0xf2b544); m.emissive.setHex(0xf2b544); m.emissiveIntensity = 0.9; }
    if (state === 'hit') { m.color.setHex(0x5ad38a); m.emissive.setHex(0x5ad38a); m.emissiveIntensity = 1; this.anim.targetPop = 1; }
    if (state === 'miss') { m.color.setHex(0xff6b6b); m.emissive.setHex(0xff6b6b); m.emissiveIntensity = 0.8; }
  },
  fire: function (vFire) {
    var T = window.THREE;
    var spread = Math.max(0, settings.maxSpreadDeg) * Math.min(1, vFire) * DEG, theta = spread * Math.sqrt(Math.random()), phi = Math.random() * Math.PI * 2;
    var dir = new T.Vector3(Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), -Math.cos(theta)).applyQuaternion(this.camera.quaternion).normalize();
    this.ray.set(this.camera.position, dir);
    var hitT = this.target.visible ? this.ray.intersectObject(this.target, false) : [], hit = hitT.length > 0, impact = null;
    if (hit) impact = hitT[0].point; else { var hw = this.ray.intersectObjects(this.walls, false); if (hw.length) impact = hw[0].point; }
    if (impact) this.addHole(impact, hit);
    return { hit: hit, spreadDeg: theta / DEG };
  },
  addHole: function (p, hit) {
    var T = window.THREE;
    var m = new T.Mesh(this.holeGeo, new T.MeshBasicMaterial({ color: hit ? 0x5ad38a : 0xf2b544, transparent: true, opacity: 0.95, depthTest: false }));
    var toCam = this.tmpV.copy(this.camera.position).sub(p).normalize();
    m.position.copy(p).addScaledVector(toCam, 0.03); m.lookAt(this.camera.position); m.renderOrder = 5; this.scene.add(m);
    this.holes.push({ mesh: m, life: 1.6 });
    if (this.holes.length > 12) { var old = this.holes.shift(); this.scene.remove(old.mesh); old.mesh.material.dispose(); }
  },
  look: function (dx, dy) { var per = 0.07 * settings.sens * DEG; this.yaw -= dx * per; this.pitch = clamp(this.pitch - dy * per, -85 * DEG, 85 * DEG); },
  lookAbs: function (nx, ny) { this.yaw = -nx * 40 * DEG; this.pitch = clamp(-ny * 25 * DEG, -80 * DEG, 80 * DEG); },
  update: function (dt, v) {
    var s = dt / 1000, c = this.camera;
    c.rotation.y = this.yaw; c.rotation.x = this.pitch;
    var rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    c.position.x = clamp(c.position.x + rx * v * settings.speedUnits * s, -13, 13); c.position.z = clamp(c.position.z + rz * v * settings.speedUnits * s, -4, 12);
    if (this.targetState === 'lit') this.targetMat.emissiveIntensity = 0.85 + 0.15 * Math.sin(performance.now() / 90);
    if (this.anim.targetPop > 0) { this.anim.targetPop = Math.max(0, this.anim.targetPop - dt / 260); this.target.scale.setScalar(1 + 0.45 * this.anim.targetPop); }
    for (var i = this.holes.length - 1; i >= 0; i--) { var h = this.holes[i]; h.life -= s; h.mesh.material.opacity = clamp(h.life, 0, 1); if (h.life <= 0) { this.scene.remove(h.mesh); h.mesh.material.dispose(); this.holes.splice(i, 1); } }
    this.renderer.render(this.scene, c);
  }
};

/* ================= audio ================= */
var Audio = {
  ctx: null,
  ensure: function () { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume().catch(function () {}); } },
  beep: function (freq, ms, vol) { if (!settings.sound || !this.ctx) return; try { var o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'square'; o.frequency.value = freq; var v0 = vol || 0.05; o.connect(g); g.connect(this.ctx.destination); var t = this.ctx.currentTime; o.start(t); g.gain.setValueAtTime(v0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000); o.stop(t + ms / 1000 + 0.02); } catch (e) {} }
};

/* ================= HUD helpers ================= */
var HUD = {
  msg: function (html, sub, cue) { var m = $('#hud-msg'); m.innerHTML = html; m.classList.toggle('cue', !!cue); $('#hud-sub').textContent = sub || ''; },
  flash: function (text) { var f = $('#hud-flash'); f.textContent = text; f.classList.add('on'); clearTimeout(this._ft); this._ft = setTimeout(function () { f.classList.remove('on'); }, 900); },
  readout: function (html) { var r = $('#hud-readout'); r.innerHTML = html; r.classList.add('on'); clearTimeout(this._rt); this._rt = setTimeout(function () { r.classList.remove('on'); }, 1300); },
  count: function (html, phase) { $('#hud-count').innerHTML = html; $('#hud-phase').textContent = phase; },
  overlay: function (which) { ['start', 'pause', 'end', 'error'].forEach(function (k) { $('#ov-' + k).hidden = k !== which; }); $('#view-scene').classList.toggle('ui-cursor', !!which); },
  ring: function (show, frac, txt) { var r = $('#hud-ring'); r.hidden = !show; if (!show) return; $('#hud-ring-fg').style.strokeDashoffset = String(502 * (1 - clamp(frac, 0, 1))); $('#hud-ring-fg').classList.toggle('done', frac >= 1); if (txt != null) $('#hud-ring-txt').innerHTML = txt; },
  speed: function (v) { var a = Math.abs(v); var fill = $('#speed-fill'); fill.style.width = (a * 100) + '%'; fill.classList.toggle('moving', a > settings.stopThreshold); $('#speed-val').textContent = Math.round(a * 100) + '%'; }
};

/* ================= scene controller hub ================= */
var Ctrl = {
  active: null, raf: 0, lastFrame: 0, v: 0, keys: { KeyA: false, KeyD: false }, scen: null,
  enterScene: function (scen) {
    this.scen = scen;
    if (!Scene.init()) { HUD.overlay('error'); return; }
    Scene.resize(); Scene.reset();
    this.active = scen === 'strafe' ? Strafe : Game;
    this.active.setup(scen);
    HUD.ring(false);
    if (!this.raf) { this.lastFrame = performance.now(); this.raf = requestAnimationFrame(this.loop.bind(this)); }
  },
  leaveScene: function () {
    if (this.active) this.active.abandon(true);
    this.active = null; this.v = 0; this.keys.KeyA = false; this.keys.KeyD = false;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  },
  loop: function (now) {
    this.raf = requestAnimationFrame(this.loop.bind(this));
    var dt = Math.min(50, now - this.lastFrame); this.lastFrame = now;
    if (!this.active) return;
    var input = (this.keys.KeyD ? 1 : 0) + (this.keys.KeyA ? -1 : 0);
    if (!this.active.running()) input = 0;
    this.v = stepV(this.v, input, dt, modelFrom(settings));
    this.active.tick(now);
    if (Scene.ok) Scene.update(dt, this.v);
    HUD.speed(this.v);
  },
  onKey: function (e, type) { if (e.code === 'KeyA' || e.code === 'KeyD') this.keys[e.code] = type === 'down'; if (this.active) this.active.onKey(e, type); },
  onFire: function (e) { if (this.active && this.active.onFire) this.active.onFire(e); },
  requestLock: function (onFallback) {
    var c = Scene.canvas, self = this;
    clearTimeout(this.lockWatch);
    this.lockWatch = setTimeout(function () { if (!Scene.locked) { Scene.fallback = true; toast('无法锁定鼠标：改用跟随光标的视角'); onFallback(); } }, 700);
    try { var p = c.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(function () { try { var p2 = c.requestPointerLock(); if (p2 && p2.catch) p2.catch(function () {}); } catch (e) {} }); } catch (e) { try { c.requestPointerLock(); } catch (e2) {} }
  },
  onLocked: function (locked) { clearTimeout(this.lockWatch); if (this.active && this.active.onLocked) this.active.onLocked(locked); }
};
