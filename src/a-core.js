(function () {
'use strict';
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var DEG = Math.PI / 180;

/* ================= config ================= */
var DEFAULTS = { sens: 0.4, dpi: 800, tAcc: 120, tDec: 100, csFactor: 0.5, stopThreshold: 0.1, trials: 30, warmup: 5, maxSpreadDeg: 2.5, sound: 1, hFov: 103, speedUnits: 5.4 };
var DKS_BOTTOM_MM = 3.6;
var CHECKLIST = [
  { id: 'dks', where: '按键 › 动态按键 (DKS)', what: 'A 和 D <b>取消 DKS</b>（红色背光的键改回普通按键）' },
  { id: 'speedtap', where: '模拟触发 › 瞬时动态切换', what: '<b>启用瞬时动态切换 (Speed Tap)</b> 关闭（键盘上 Fn + Tab 会直接开关它，测试中别误按）' },
  { id: 'rt', where: '模拟触发 › 触发', what: '<b>快速触发 (Rapid Trigger)</b> 打开，并确认机身背面的实体拨杆也在开启位' },
  { id: 'rtsplit', where: '模拟触发 › 触发', what: '<b>个别设置下压/上抬灵敏度</b> 打开' },
  { id: 'trig', where: '模拟触发 › 触发 › 单键触发点设置', what: 'A 和 D 的触发点设为最小值 <b>0.1 mm</b>。不开软件也行：双击触控条进入单键模式，按一下 A，在触控条上滑到 0.1 mm，再按 D 重复' },
  { id: 'press', where: '模拟触发 › 触发', what: '<b>下压</b> 设为 0.1 mm' },
  { id: 'release', where: '模拟触发 › 触发', what: '<b>上抬</b> 设为 0.1 mm' },
  { id: 'dz', where: '模拟触发 › 触发', what: '<b>顶部死区全区设置</b> 和 <b>底部死区全区设置</b> 都设为软件允许的最小值' },
  { id: 'crt', where: '模拟触发 › 触发', what: '<b>连续快速触发</b> 关闭' }
];
var COMPLIANCE = {
  updated: '2026-10-27',
  levels: {
    green: { label: '绿 · 纯灵敏度', text: '只改变按键判定深度，不改变输入与动作的一一对应。' },
    yellow: { label: '黄 · 灰色地带', text: 'VCT 2025 规则 2.3.5 允许 Snap Tap / SOCD 类功能，但 Riot 未来可能调整。' },
    orange: { label: '橙 · 风险自负', text: '一次输入产生两个动作，与 Valve 在 CS2 禁止的 autostop 属同一类；Valorant 松键即停，收益也很小。' }
  },
  sources: [
    { title: 'KeebForce：SOCD 与 Valorant', url: 'https://keebforce.com/socd-keyboard-valorant/' },
    { title: 'vlr.gg：VCT 规则 2.3.5 讨论', url: 'https://www.vlr.gg/486150/snap-tap-socd' },
    { title: 'TestYourDevice：CS2 与 Valorant 的键盘规则', url: 'https://testyourdevice.com/blog/snap-tap-socd-ban-cs2-valorant-2026' }
  ]
};
var SCENARIOS = {
  stop: { no: '01', name: '急停反应', en: 'Strafe · Stop · Shoot', desc: '按住 A/D 移动，靶子亮起后停稳再开枪。测松键、急停和开枪的时序。', view: 'scene' },
  strafe: { no: '02', name: '左右拉扯', en: 'A / D Strafe', desc: '连续交替 A、D 共 40 次切换，看切换时是重叠还是空档。', view: 'scene' },
  sweep: { no: '03', name: '阶梯扫频标定', en: 'Threshold Sweep', desc: '改触发点、上抬、下压，用二分法找你的习惯键程。', view: 'lab' },
  bounce: { no: '04', name: '误触与稳定性', en: 'Bounce · Rest', desc: '到底回弹和休息抖动，决定死区怎么设。', view: 'lab' },
  validate: { no: '05', name: '验证轮', en: 'Validation', desc: '填进推荐值后再打 15 发，和最小值基线并排比。', view: 'scene' }
};
var RULES = {
  trigFrac: 0.4, trigMin: 0.4, trigMax: 1.0, trigCap: 1.5, trigPerRest: 0.1, wsOffset: 0.2,
  release: 0.2, releaseBounce3: 0.3, releaseBounce6: 0.4, press: 0.2, pressMax: 0.5,
  dzTop: 0.2, dzTopRest2: 0.3, dzBot: 0.2, dzBotBounce3: 0.4, crtTrig: 0.8, speedTapOverlap: 0.1, dksMinDepth: 3.4, noBottomDepth: 3.0,
  validateStopTol: 0.02, validateFireShrink: 10, fallbackStep: 0.1, maxValidate: 2,
  sweepPassMisses: 1, liftLatencyDelta: 15, repressPassCount: 9
};

/* ================= storage ================= */
var Store = {
  get: function (k, d) { try { var v = localStorage.getItem('csb:v1:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('csb:v1:' + k, JSON.stringify(v)); } catch (e) {} }
};
var settings = Object.assign({}, DEFAULTS, Store.get('settings', {}));
var checks = Store.get('checklist', {});
var history = Store.get('history', []);
var runs = Store.get('runs', {});
(function migrate() { var old = Store.get('lastRun', null); if (old && !runs.stop) { runs.stop = old; Store.set('runs', runs); } })();
var stylePreset = Store.get('style', 'balanced');
function saveRun(id, run) { runs[id] = run; Store.set('runs', runs); }

function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 1800); }
function fmt(n, d) { if (n == null || isNaN(n)) return '—'; return Number(n).toFixed(d == null ? 0 : d); }
function mm(n) { return n == null ? '—' : Number(n).toFixed(1) + ' mm'; }
function pct(x) { return x == null || isNaN(x) ? '—' : Math.round(x * 100) + '%'; }
function median(a) { var b = a.filter(function (x) { return x != null && !isNaN(x); }).sort(function (x, y) { return x - y; }); if (!b.length) return null; var m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function mean(a) { var b = a.filter(function (x) { return x != null && !isNaN(x); }); if (!b.length) return null; return b.reduce(function (s, x) { return s + x; }, 0) / b.length; }
function cv(a) { var b = a.filter(function (x) { return x != null && !isNaN(x); }); if (b.length < 2) return null; var mu = mean(b); if (!mu) return null; var sd = Math.sqrt(b.reduce(function (s, x) { return s + (x - mu) * (x - mu); }, 0) / (b.length - 1)); return sd / mu; }
function rate(arr, f) { if (!arr.length) return null; return arr.filter(f).length / arr.length; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function r1(x) { return Math.round(x * 10) / 10; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function dstr(iso) { return iso ? iso.replace('T', ' ').slice(0, 16) : '—'; }

/* ================= movement model ================= */
function stepV(v, input, dt, m) {
  if (input === 0) {
    var r0 = dt / m.tDec;
    if (v > 0) return Math.max(0, v - r0);
    if (v < 0) return Math.min(0, v + r0);
    return 0;
  }
  if (v === 0 || (v > 0) === (input > 0)) {
    var r1 = dt / m.tAcc;
    return input > 0 ? Math.min(1, v + r1) : Math.max(-1, v - r1);
  }
  var decel = 1 / (m.tDec * m.csFactor);
  var tZero = Math.abs(v) / decel;
  if (dt <= tZero) return v - Math.sign(v) * decel * dt;
  return input * Math.min(1, (dt - tZero) / m.tAcc);
}
function modelFrom(s) { return { tAcc: s.tAcc, tDec: s.tDec, csFactor: s.csFactor, stopThreshold: s.stopThreshold }; }
function replayTrial(tr, m) {
  var evs = tr.events.filter(function (e) { return e.code === 'KeyA' || e.code === 'KeyD'; }).sort(function (a, b) { return a.t - b.t; });
  var keys = { KeyA: false, KeyD: false }, v = 0, t = tr.tHoldStart, i = 0, overshoot = false, tEnd = tr.tFire;
  while (t < tEnd) {
    while (i < evs.length && evs[i].t <= t) { keys[evs[i].code] = evs[i].type === 'down'; i++; }
    var input = (keys.KeyD ? 1 : 0) + (keys.KeyA ? -1 : 0);
    var step = Math.min(1, tEnd - t);
    v = stepV(v, input, step, m);
    if (tr.tRelease != null && t >= tr.tRelease && v !== 0 && (v > 0) !== (tr.dir > 0) && Math.abs(v) > m.stopThreshold) overshoot = true;
    t += step;
  }
  return { vAtFire: Math.abs(v), overshoot: overshoot };
}

/* ================= metrics ================= */
function stopMetrics(trials, m) {
  var valid = trials.filter(function (t) { return t.valid && !t.warmup; });
  var withRel = valid.filter(function (t) { return t.tRelease != null; });
  var cs = valid.filter(function (t) { return t.usedCs; });
  var gaps = valid.map(function (t) { if (t.fireAfterRelease == null) return null; return t.fireAfterRelease - (t.usedCs ? m.tDec * m.csFactor : m.tDec); });
  return {
    n: valid.length,
    releaseLatency: median(withRel.map(function (t) { return t.releaseLatency; })),
    fireAfterRelease: median(withRel.map(function (t) { return t.fireAfterRelease; })),
    firedWhileHoldingRate: rate(valid, function (t) { return t.firedWhileHolding; }),
    movingShotRate: rate(valid, function (t) { return t.moving; }),
    stopRate: valid.length ? 1 - rate(valid, function (t) { return t.moving; }) : null,
    hitRate: rate(valid, function (t) { return t.hit; }),
    csUseRate: rate(valid, function (t) { return t.usedCs; }),
    csGap: median(cs.map(function (t) { return t.csGap; })),
    csOverlapRate: cs.length ? rate(cs, function (t) { return t.csGap != null && t.csGap < 0; }) : null,
    csHold: median(cs.map(function (t) { return t.csHold; })),
    overshootRate: rate(valid, function (t) { return t.overshoot; }),
    stopGap: median(gaps),
    vFireMedian: median(valid.map(function (t) { return t.vFire; }))
  };
}
function stopScore(mt) { if (mt.stopRate == null) return 0; return Math.round(70 * mt.stopRate + 30 * (mt.hitRate || 0)); }

// events: [{t, code, type}] for KeyA / KeyD, in time order
function strafeMetrics(events, paced) {
  var evs = events.slice().sort(function (a, b) { return a.t - b.t; });
  var downs = evs.filter(function (e) { return e.type === 'down'; });
  var switches = [];
  for (var i = 1; i < downs.length; i++) {
    var prev = downs[i - 1], cur = downs[i];
    if (prev.code === cur.code) continue;
    var up = null;
    for (var j = 0; j < evs.length; j++) { var e = evs[j]; if (e.type === 'up' && e.code === prev.code && e.t >= prev.t) { up = e; break; } }
    if (!up) continue;
    switches.push({ t: cur.t, from: prev.code, to: cur.code, gap: cur.t - up.t, interval: cur.t - prev.t });
  }
  var free = paced == null ? switches : switches.slice(paced);
  var gaps = free.map(function (s) { return s.gap; });
  return {
    n: switches.length,
    overlapRate: rate(free, function (s) { return s.gap < 0; }),
    gapMedian: median(gaps),
    overlapMedian: median(free.filter(function (s) { return s.gap < 0; }).map(function (s) { return -s.gap; })),
    airMedian: median(free.filter(function (s) { return s.gap >= 0; }).map(function (s) { return s.gap; })),
    intervalMedian: median(free.map(function (s) { return s.interval; })),
    cv: cv(free.map(function (s) { return s.interval; })),
    switches: switches
  };
}

/* ================= hold tracker (bottom-out bounce) ================= */
function HoldTracker(opts) {
  this.key = opts.key || 'KeyA'; this.minHold = opts.minHold || 1500; this.gap = opts.bounceGap || 250;
  this.onEnd = opts.onEnd; this.onBounce = opts.onBounce; this.onStart = opts.onStart;
  this.state = 'idle'; this.start = null; this.lastUp = null; this.bounces = []; this.timer = 0;
}
HoldTracker.prototype.onKey = function (e, type) {
  if (e.code !== this.key) return;
  var t = e.timeStamp, self = this;
  if (this.state === 'idle' && type === 'down') { this.state = 'holding'; this.start = t; this.bounces = []; if (this.onStart) this.onStart(t); return; }
  if (this.state === 'holding' && type === 'up') {
    this.state = 'pending'; this.lastUp = t;
    this.timer = setTimeout(function () { self.finish(); }, this.gap);
    return;
  }
  if (this.state === 'pending' && type === 'down') {
    clearTimeout(this.timer); this.state = 'holding';
    this.bounces.push({ at: this.lastUp - this.start, gap: t - this.lastUp });
    if (this.onBounce) this.onBounce(this.bounces.length);
  }
};
HoldTracker.prototype.finish = function () {
  var dur = this.lastUp - this.start, res = { duration: dur, bounces: this.bounces.slice(), valid: dur >= this.minHold };
  this.state = 'idle'; this.start = null; this.bounces = [];
  if (this.onEnd) this.onEnd(res);
};
HoldTracker.prototype.reset = function () { clearTimeout(this.timer); this.state = 'idle'; this.start = null; this.bounces = []; };
HoldTracker.prototype.heldFor = function (now) { return this.state === 'holding' ? now - this.start : (this.state === 'pending' ? this.lastUp - this.start : 0); };

/* ================= sweep search ================= */
var PROFILE_GRID = [0.5, 1.0, 1.5, 2.0, 2.5];
// touch mode: continuous bisection on a 0.1 mm grid between lo (passed) and hi (failed)
function sweepNext(st) {
  if (st.mode === 'profile') {
    if (st.rounds.length >= 4) return null;
    var lo = st.loIdx, hi = st.hiIdx;
    if (hi - lo <= 1) return null;
    var mid = Math.floor((lo + hi) / 2);
    return PROFILE_GRID[mid];
  }
  if (st.rounds.length >= 5) return null;
  if (st.hi - st.lo <= 0.3) return null;
  var v = r1((st.lo + st.hi) / 2);
  if (v <= st.lo) v = r1(st.lo + 0.1);
  if (v >= st.hi) v = r1(st.hi - 0.1);
  return v;
}
function sweepApply(st, value, pass) {
  st.rounds.push({ value: value, pass: pass });
  if (st.mode === 'profile') { var idx = PROFILE_GRID.indexOf(value); if (pass) st.loIdx = idx; else st.hiIdx = idx; }
  else { if (pass) st.lo = value; else st.hi = value; }
}
function sweepResult(st) {
  if (st.mode === 'profile') {
    var lo = st.loIdx >= 0 ? PROFILE_GRID[st.loIdx] : 0.1;
    var hi = st.hiIdx < PROFILE_GRID.length ? PROFILE_GRID[st.hiIdx] : null;
    return { lo: lo, hi: hi };
  }
  return { lo: st.lo, hi: st.hi >= 3.9 ? null : st.hi };
}

/* ================= recommendation rules ================= */
function presetDelta(style) { return style === 'stable' ? 0.1 : (style === 'aggressive' ? -0.1 : 0); }
function buildRecs(R, style) {
  var st = R.stop && R.stop.metrics, sw = R.sweep, bo = R.bounce, sf = R.strafe && R.strafe.metrics, va = R.validate;
  var pend = function (n) { return '默认值，待' + n; };
  var dz = presetDelta(style || 'balanced');
  var trigAD = 0.6, trigStatus = pend('场景 03 3a'), trigWhy = '按习惯按压深度区间下限的 40% 取值，限制在 0.4–1.0 mm；现在先用默认值。';
  if (sw && sw.depth && sw.depth.lo != null) {
    trigAD = clamp(sw.depth.lo * RULES.trigFrac, RULES.trigMin, RULES.trigMax);
    trigStatus = '测得'; trigWhy = '你的习惯按压深度在 ' + mm(sw.depth.lo) + (sw.depth.hi != null ? ' 到 ' + mm(sw.depth.hi) : ' 以上') + '，取下限的 40%，限制在 0.4–1.0 mm。';
  }
  if (bo && bo.restFalse > 0) { trigAD = Math.min(RULES.trigCap, trigAD + bo.restFalse * RULES.trigPerRest); trigWhy += ' 休息时误触 ' + bo.restFalse + ' 次，每次加 0.1 mm。'; }
  trigAD = r1(trigAD);
  var trigWS = r1(trigAD + RULES.wsOffset);
  var release = RULES.release, relStatus = pend('场景 03 3b、场景 04 4a'), relWhy = '从 0.2 mm 起，按到底回弹次数上调；永远不超过习惯抬起幅度的一半。';
  if (bo) { if (bo.bounceEvents >= 6) release = RULES.releaseBounce6; else if (bo.bounceEvents >= 3) release = RULES.releaseBounce3; relWhy = '到底回弹 ' + bo.bounceEvents + ' 次' + (bo.bounceEvents >= 3 ? '，上抬调大一点避免误松键。' : '，可以用最灵敏的 0.2 mm。'); relStatus = '测得'; }
  var relNote = '';
  if (sw && sw.lift != null) { var cap = r1(sw.lift / 2); if (release > cap) { release = Math.max(0.1, cap); relNote = ' 你习惯只微抬（约 ' + mm(sw.lift) + ' 内），上抬压到 ' + mm(release) + '，别再调大。'; } else relNote = ' 你的习惯抬起幅度约 ' + mm(sw.lift) + '，这个值留有余量。'; relStatus = '测得'; }
  release = clamp(r1(release + dz), 0.1, 1.0);
  if (st && st.firedWhileHoldingRate > 0.2) relNote += ' 你有 ' + pct(st.firedWhileHoldingRate) + ' 的枪在松键前就打出去了，先别碰上抬，去练节奏。';
  var press = RULES.press, pressStatus = pend('场景 03 3c'), pressWhy = '从 0.2 mm 起，不超过你微抬后回压幅度的一半，上限 0.5 mm。';
  if (sw && sw.repress != null) { press = Math.min(RULES.pressMax, Math.max(0.1, r1(sw.repress / 2))); pressStatus = '测得'; pressWhy = '你微抬后回压幅度约 ' + mm(sw.repress) + '，取一半。'; }
  press = clamp(r1(press + dz), 0.1, RULES.pressMax);
  var dzTop = RULES.dzTop, dzTopStatus = pend('场景 04 4b'), dzTopWhy = '休息时误触越多越要加，但始终比触发点小 0.2 mm 以上。';
  if (bo) { if (bo.restFalse >= 2) dzTop = RULES.dzTopRest2; dzTopStatus = '测得'; dzTopWhy = '休息 10 秒误触 ' + bo.restFalse + ' 次' + (bo.restFalse >= 2 ? '，顶部死区加到 0.3 mm。' : '，保持 0.2 mm。'); }
  dzTop = clamp(r1(dzTop + dz), 0.1, Math.max(0.1, r1(trigAD - 0.2)));
  var dzBot = RULES.dzBot, dzBotStatus = pend('场景 04 4a'), dzBotWhy = '到底回弹次数多才需要加；不到底的人保持默认。';
  if (bo) { dzBotStatus = '测得'; if (sw && sw.depth && sw.depth.hi != null && sw.depth.hi < RULES.noBottomDepth) dzBotWhy = '你基本不到底（按压深度不到 ' + mm(sw.depth.hi) + '），底部死区对你影响不大，保持 0.2 mm。'; else if (bo.bounceEvents >= 3) { dzBot = RULES.dzBotBounce3; dzBotWhy = '到底回弹 ' + bo.bounceEvents + ' 次，底部死区加到 0.4 mm 吃掉回弹。'; } else dzBotWhy = '到底回弹 ' + bo.bounceEvents + ' 次，保持 0.2 mm。'; }
  dzBot = clamp(r1(dzBot + dz), 0.1, 1.0);
  var fb = va && va.fallback;
  if (fb) { release = Math.max(0.1, r1(release - fb.step)); dzTop = Math.max(0.1, r1(dzTop - fb.step)); dzBot = Math.max(0.1, r1(dzBot - fb.step)); }
  var rows = [];
  rows.push({ field: '快速触发 (Rapid Trigger)', value: '开', level: 'green', status: '测得', why: '急停全靠它：手指抬起很小的距离就判定松开。' });
  rows.push({ field: '个别设置下压/上抬灵敏度', value: '开', level: 'green', status: '测得', why: '让上抬可以比下压更灵敏。' });
  rows.push({ field: '选择应用快速触发的按键', value: 'W / A / S / D', level: 'green', status: '测得', why: '只对移动键开，其他键保持普通判定。' });
  rows.push({ field: '单键触发点设置 · A / D', value: mm(trigAD), level: 'green', status: trigStatus, why: trigWhy });
  rows.push({ field: '单键触发点设置 · W / S', value: mm(trigWS), level: 'green', status: trigStatus === '测得' ? '由 A/D 推导' : trigStatus, why: 'A/D 推荐值 + 0.2 mm，前后移动对急停不敏感。' });
  rows.push({ field: '上抬', value: mm(release), level: 'green', status: relStatus, why: relWhy + relNote + (fb ? ' 验证轮未通过，已回退 0.1 mm。' : '') });
  rows.push({ field: '下压', value: mm(press), level: 'green', status: pressStatus, why: pressWhy });
  rows.push({ field: '顶部死区全区设置', value: mm(dzTop), level: 'green', status: dzTopStatus, why: dzTopWhy + (fb ? ' 验证轮未通过，已回退 0.1 mm。' : '') });
  rows.push({ field: '底部死区全区设置', value: mm(dzBot), level: 'green', status: dzBotStatus, why: dzBotWhy + (fb ? ' 验证轮未通过，已回退 0.1 mm。' : '') });
  rows.push({ field: '连续快速触发', value: trigAD >= RULES.crtTrig ? '开' : '关', level: 'green', status: '由触发点推导', why: '触发点 ≥ 0.8 mm 才建议打开，让越过触发点后的整个键程都有 RT。' });
  var stVal = '关', stStatus = pend('场景 02'), stWhy = '默认关闭。';
  var overlap = sf ? sf.overlapRate : (st ? st.csOverlapRate : null);
  if (sf) { stStatus = '测得'; if (sf.overlapRate >= RULES.speedTapOverlap) { stVal = '可选'; stWhy = '左右拉扯时有 ' + pct(sf.overlapRate) + ' 的切换两键重叠（中位 ' + fmt(sf.overlapMedian) + ' ms），Speed Tap 能消掉重叠；黄色等级，自己决定。'; } else stWhy = '左右拉扯时重叠率只有 ' + pct(sf.overlapRate) + '，不需要 Speed Tap。'; }
  else if (st && st.csOverlapRate != null && st.csOverlapRate >= RULES.speedTapOverlap) { stVal = '可选'; stWhy = '急停时有 ' + pct(st.csOverlapRate) + ' 的次数两键重叠；等场景 02 再定。'; }
  rows.push({ field: '启用瞬时动态切换 (Speed Tap)', value: stVal, level: 'yellow', status: stStatus, why: stWhy });
  var split = { hardware: [], habit: [] };
  if (st) {
    if (st.stopGap != null) { if (st.stopGap < 0) split.habit.push('你开枪比模型里停稳的时刻早约 <b>' + fmt(-st.stopGap) + ' ms</b>。这是节奏问题，调驱动解决不了：靶子亮起后先松键，等速度条回到停稳线再点。'); else split.hardware.push('松键到开枪留了 <b>' + fmt(st.stopGap) + ' ms</b> 余量，停下来再开枪的节奏是对的。'); }
    if (st.firedWhileHoldingRate > 0) split.habit.push('有 <b>' + pct(st.firedWhileHoldingRate) + '</b> 的枪在按键还没松开时就打出去了。');
    if (st.overshootRate > 0.1) split.habit.push('急停时反方向键按太久，<b>' + pct(st.overshootRate) + '</b> 的次数已经往回走了（过冲）。点一下就够，不要按住。');
    if (st.csUseRate != null) split.hardware.push(st.csUseRate > 0.5 ? '你习惯按反方向键急停（<b>' + pct(st.csUseRate) + '</b>）。无畏契约松键即停，急停能再省一点时间，但两键重叠会变成不动。' : '你主要靠松键停下（急停使用率 <b>' + pct(st.csUseRate) + '</b>），这正是上抬值最能发挥的用法。');
  }
  if (sf) { if (sf.overlapRate >= RULES.speedTapOverlap) split.habit.push('左右拉扯有 <b>' + pct(sf.overlapRate) + '</b> 的切换重叠，重叠期间角色是不动的。先松再按，或者考虑 Speed Tap。'); if (sf.cv != null && sf.cv > 0.35) split.habit.push('拉扯节奏不稳（变异系数 <b>' + fmt(sf.cv, 2) + '</b>），跟着节拍器练一练。'); }
  if (sw && sw.depth) split.hardware.push('习惯按压深度 <b>' + mm(sw.depth.lo) + (sw.depth.hi != null ? ' – ' + mm(sw.depth.hi) : ' 以上') + '</b>，触发点按这个定。');
  if (bo) split.hardware.push('到底回弹 <b>' + bo.bounceEvents + '</b> 次、休息误触 <b>' + bo.restFalse + '</b> 次，死区和上抬按这个定。');
  if (!sw || !bo) split.hardware.push('上抬、下压、死区的具体数值需要场景 03 和 04，缺的部分表里是默认值。');
  var dksOK = !(sw && sw.depth && sw.depth.hi != null && sw.depth.hi < RULES.dksMinDepth);
  var dks1 = { title: '方案 1 · W 键"轻按静步、到底奔跑"', level: 'green', ok: dksOK, note: dksOK ? (sw && sw.depth ? '你能按到 ' + mm(sw.depth.lo) + ' 以上，到底这一层能触发。' : '需要场景 03 确认你能按到 ' + DKS_BOTTOM_MM + ' mm；按不到底的人这个方案无效。') : '场景 03 显示你基本按不到 ' + mm(sw.depth.hi) + '，到底这一层（' + DKS_BOTTOM_MM + ' mm）触发不了，这个方案对你无效。', cols: [mm(trigWS), DKS_BOTTOM_MM + ' mm', DKS_BOTTOM_MM + ' mm', '0.2 mm'], slots: [ { key: 'Shift', cells: ['hs', 'he', 'hs', 'he'] }, { key: 'W', cells: ['hs', 'hm', 'hm', 'he'] }, { key: '', cells: ['empty', 'empty', 'empty', 'empty'] }, { key: '', cells: ['empty', 'empty', 'empty', 'empty'] } ] };
  var dks2 = { title: '方案 2 · A 键松开自动急停（D 键镜像）', level: 'orange', ok: true, note: '一次输入产生两个动作，风险自负；无畏契约松键即停，这个方案的收益很小。', cols: [mm(trigAD), DKS_BOTTOM_MM + ' mm', DKS_BOTTOM_MM + ' mm', mm(release)], slots: [ { key: 'A', cells: ['hs', 'hm', 'hm', 'he'] }, { key: 'D', cells: ['empty', 'empty', 'empty', 'tap'] }, { key: '', cells: ['empty', 'empty', 'empty', 'empty'] }, { key: '', cells: ['empty', 'empty', 'empty', 'empty'] } ] };
  return { rows: rows, split: split, dks: [dks1, dks2], values: { trigAD: trigAD, trigWS: trigWS, release: release, press: press, dzTop: dzTop, dzBot: dzBot, crt: trigAD >= RULES.crtTrig, speedTap: stVal }, style: style || 'balanced' };
}
function validateCompare(base, baseBounce, cur, curBounce) {
  var rows = [];
  var stopOK = cur.stopRate != null && base.stopRate != null && cur.stopRate >= base.stopRate - RULES.validateStopTol;
  rows.push({ name: '停稳率', base: pct(base.stopRate), cur: pct(cur.stopRate), ok: stopOK, rule: '不低于基线（容差 2%）' });
  var shrink = (base.fireAfterRelease != null && cur.fireAfterRelease != null) ? base.fireAfterRelease - cur.fireAfterRelease : null;
  var fireOK = shrink == null || shrink <= RULES.validateFireShrink;
  rows.push({ name: '松键→开枪 中位数', base: fmt(base.fireAfterRelease) + ' ms', cur: fmt(cur.fireAfterRelease) + ' ms', ok: fireOK, rule: '缩短不超过 10 ms' });
  var basePer = baseBounce == null ? null : baseBounce.rate, curPer = curBounce == null ? null : curBounce.rate;
  var bounceOK = basePer == null || curPer == null || curPer <= basePer || curPer === 0;
  rows.push({ name: '每次到底的回弹数', base: basePer == null ? '未测' : fmt(basePer, 2), cur: curPer == null ? '未测' : fmt(curPer, 2), ok: bounceOK, rule: '不高于基线' });
  rows.push({ name: '命中率', base: pct(base.hitRate), cur: pct(cur.hitRate), ok: true, rule: '参考' });
  return { rows: rows, pass: stopOK && fireOK && bounceOK };
}
