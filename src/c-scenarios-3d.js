
/* ================= scenario 01 / 05: strafe-stop-shoot ================= */
function makeTrials(n, warm) {
  var dirs = []; for (var i = 0; i < n; i++) dirs.push(i % 2 ? 1 : -1);
  for (var j = dirs.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var tmp = dirs[j]; dirs[j] = dirs[k]; dirs[k] = tmp; }
  return dirs.map(function (d, idx) { return { index: idx, warmup: idx < warm, dir: d, delay: 800 + Math.random() * 1700, events: [], valid: false }; });
}
var Game = {
  mode: 'stop', active: false, paused: false, finished: false, state: 'off', trials: [], i: 0, earlyCount: 0, timeoutCount: 0, betweenAt: 0, hold: null, holds: [], holdNeed: 5, warm: 5, total: 30,
  setup: function (scen) {
    this.mode = scen; this.active = false; this.paused = false; this.finished = false; this.state = 'off';
    if (scen === 'validate') { this.warm = 3; this.total = 18; } else { this.warm = settings.warmup; this.total = settings.trials; }
    this.renderStart();
    HUD.overlay('start');
    HUD.count('0<small>/ ' + (this.total - this.warm) + '</small>', '准备');
    HUD.msg('', '');
  },
  renderStart: function () {
    var box = $('#ov-start-box'), self = this;
    if (this.mode === 'stop') {
      box.innerHTML = '<span class="pill acc">场景 01</span><h2>急停反应</h2><div class="steps">' +
        '<div>1. 看到提示后<b>按住 A 或 D</b> 开始移动，保持不动手。</div><div>2. 靶子亮起的瞬间<b>停下来</b>：松开按键，或者顺手点一下反方向键急停。</div><div>3. 停稳后<b>按鼠标左键</b>开枪。移动中开枪会散布，命中率会掉。</div><div>4. 共 <b>' + this.total + '</b> 发，前 ' + this.warm + ' 发热身不计入。靶子亮之前开枪算抢枪，重来。</div></div>' +
        '<div class="row"><button class="btn primary" id="btn-start" type="button">点击开始并锁定鼠标</button><a class="btn ghost" href="#setup">先去基线设置</a></div><p class="hint">鼠标锁定后 Esc 可以暂停。</p>';
    } else {
      var recs = buildRecs(runs, stylePreset), v = recs.values, att = runs.validate ? (runs.validate.attempt || 1) : 0;
      box.innerHTML = '<span class="pill acc">场景 05</span><h2>验证轮' + (att ? '（第 ' + (att + 1) + ' 次）' : '') + '</h2><p class="hint">先把结果页的推荐值填进 Armoury Crate（只改下面这几项），然后再打 15 发急停反应，外加 5 次到底按住。打完和你的最小值基线并排比。</p>' +
        '<div class="tablewrap"><table><tbody>' + [['单键触发点设置 · A / D', mm(v.trigAD)], ['单键触发点设置 · W / S', mm(v.trigWS)], ['上抬', mm(v.release)], ['下压', mm(v.press)], ['顶部死区全区设置', mm(v.dzTop)], ['底部死区全区设置', mm(v.dzBot)], ['连续快速触发', v.crt ? '开' : '关']].map(function (p) { return '<tr><td>' + p[0] + '</td><td class="v">' + p[1] + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<label class="check" style="border:0;padding:4px 0"><input type="checkbox" id="val-ok"><div class="what">我已经把这些值填进 Armoury Crate 了</div></label>' +
        '<div class="row"><button class="btn primary" id="btn-start" type="button" disabled>点击开始并锁定鼠标</button><a class="btn ghost" href="#results">去看结果页</a></div>';
      $('#val-ok').addEventListener('change', function (e) { $('#btn-start').disabled = !e.target.checked; });
    }
    $('#btn-start').addEventListener('click', function () { self.start(); });
  },
  running: function () { return this.active && !this.paused; },
  cur: function () { return this.trials[this.i]; },
  start: function () {
    Audio.ensure();
    this.trials = makeTrials(this.total, this.warm);
    this.i = 0; this.earlyCount = 0; this.timeoutCount = 0; this.finished = false; this.active = true; this.state = 'off'; this.holds = [];
    Scene.reset(); Ctrl.v = 0;
    var self = this;
    Ctrl.requestLock(function () { self.onLocked(true); });
  },
  onLocked: function (locked) {
    if (!this.active) return;
    if (locked || Scene.fallback) { this.paused = false; HUD.overlay(null); Ctrl.keys.KeyA = false; Ctrl.keys.KeyD = false; if (this.state === 'off') this.begin(); else if (this.state !== 'holdphase') this.redo(); }
    else if (!this.finished) this.pause();
  },
  begin: function () { this.state = 'between'; this.betweenAt = performance.now(); Scene.placeTarget(); this.updateCount(); },
  nextTrial: function () {
    var tr = this.cur();
    tr.events = []; tr.tHoldStart = null; tr.t0 = null; tr.tRelease = null; tr.tFire = null; tr.cs = null; tr.valid = false; tr.delay = 800 + Math.random() * 1700;
    Scene.placeTarget(); this.state = 'ready'; this.updateCount(); this.instruct();
  },
  instruct: function () { var tr = this.cur(); HUD.msg(tr.dir > 0 ? '按住 <span class="dir">D ▶</span> 向右移动' : '按住 <span class="dir">◀ A</span> 向左移动', '靶子亮起：停下，再开枪'); },
  updateCount: function () {
    var tr = this.cur(); if (!tr) return;
    if (tr.warmup) HUD.count((tr.index + 1) + '<small>/ ' + this.warm + '</small>', '热身 · 不计入'); else HUD.count((tr.index - this.warm + 1) + '<small>/ ' + (this.total - this.warm) + '</small>', this.mode === 'validate' ? '验证轮 · 计分中' : '计分中');
  },
  resetHold: function (text) { var tr = this.cur(); tr.events = []; tr.tHoldStart = null; this.state = 'ready'; if (text) HUD.flash(text); this.instruct(); },
  redo: function () { var tr = this.cur(); if (!tr) return; tr.events = []; tr.tHoldStart = null; tr.t0 = null; Scene.setTarget('dim'); this.state = 'between'; this.betweenAt = performance.now(); },
  onKey: function (e, type) {
    if (!this.running()) return;
    if (this.state === 'holdphase') { if (this.hold) this.hold.onKey(e, type); return; }
    var code = e.code; if (code !== 'KeyA' && code !== 'KeyD') return;
    var tr = this.cur(); if (!tr) return;
    var t = e.timeStamp, dirKey = tr.dir > 0 ? 'KeyD' : 'KeyA', other = tr.dir > 0 ? 'KeyA' : 'KeyD';
    if (this.state === 'ready') {
      if (type === 'down' && code === dirKey && !Ctrl.keys[other]) { tr.events = [{ t: t, code: code, type: 'down' }]; tr.tHoldStart = t; this.state = 'holding'; HUD.msg('保持移动…', '等靶子亮'); }
      else if (type === 'down' && code === other) HUD.flash('方向反了，这一发要按 ' + (dirKey === 'KeyD' ? 'D' : 'A'));
      return;
    }
    if (this.state === 'holding') {
      tr.events.push({ t: t, code: code, type: type });
      if (type === 'down' && code === other) this.resetHold('靶子还没亮，先只按一个键'); else if (type === 'up' && code === dirKey) this.resetHold(null);
      return;
    }
    if (this.state === 'cue') {
      tr.events.push({ t: t, code: code, type: type });
      if (code === dirKey && type === 'up' && tr.tRelease == null) tr.tRelease = t;
      if (code === other) { if (type === 'down' && !tr.cs) tr.cs = { down: t, up: null }; else if (type === 'up' && tr.cs && tr.cs.up == null) tr.cs.up = t; }
    }
  },
  onFire: function (e) {
    if (!this.running()) return;
    var tr = this.cur(); if (!tr || this.state === 'holdphase') return;
    var t = e.timeStamp;
    if (this.state === 'ready' || this.state === 'holding') { this.earlyCount++; HUD.flash('抢枪！靶子还没亮'); Scene.fire(1); this.resetHold(null); return; }
    if (this.state !== 'cue') return;
    tr.tFire = t;
    var m = modelFrom(settings), rep = replayTrial(tr, m);
    tr.vFire = rep.vAtFire; tr.overshoot = rep.overshoot;
    var shot = Scene.fire(tr.vFire);
    tr.hit = shot.hit; tr.spreadDeg = shot.spreadDeg; tr.moving = tr.vFire > m.stopThreshold; tr.firedWhileHolding = tr.tRelease == null;
    tr.releaseLatency = tr.tRelease != null ? tr.tRelease - tr.t0 : null; tr.fireAfterRelease = tr.tRelease != null ? tr.tFire - tr.tRelease : null;
    tr.usedCs = !!tr.cs; tr.csGap = tr.cs && tr.tRelease != null ? tr.cs.down - tr.tRelease : null; tr.csHold = tr.cs && tr.cs.up != null ? tr.cs.up - tr.cs.down : null; tr.fireLatency = tr.tFire - tr.t0; tr.valid = true;
    Scene.setTarget(tr.hit ? 'hit' : 'miss');
    if (tr.hit) { var hm = $('#hitmark'); hm.classList.add('on'); setTimeout(function () { hm.classList.remove('on'); }, 140); Audio.beep(1200, 60); } else Audio.beep(220, 90);
    var parts = [];
    if (tr.firedWhileHolding) parts.push('<span class="bad">没松键就开枪</span>'); else parts.push('松键→开枪 <b>' + (tr.fireAfterRelease >= 0 ? '+' : '') + fmt(tr.fireAfterRelease) + ' ms</b>');
    parts.push(tr.moving ? '<span class="bad">移动中开枪 ' + Math.round(tr.vFire * 100) + '%</span>' : '<span class="ok">停稳</span>');
    if (tr.usedCs) parts.push('急停' + (tr.csGap != null && tr.csGap < 0 ? ' <span class="bad">重叠 ' + fmt(-tr.csGap) + ' ms</span>' : ''));
    parts.push(tr.hit ? '<span class="ok">命中</span>' : '<span class="bad">未命中</span>');
    HUD.readout(parts.join(' · ')); HUD.msg('', '');
    this.state = 'done';
    var self = this;
    setTimeout(function () { if (!self.active) return; Scene.setTarget('dim'); self.i++; if (self.i >= self.trials.length) self.afterTrials(); else { self.state = 'between'; self.betweenAt = performance.now(); } }, 650);
  },
  tick: function (now) {
    if (!this.running()) return;
    var tr = this.cur();
    if (this.state === 'holdphase') { var hf = this.hold ? clamp(this.hold.heldFor(now) / 2000, 0, 1) : 0; HUD.ring(true, hf, this.holds.length + '<small>/ ' + this.holdNeed + ' 次</small>'); return; }
    if (!tr) return;
    if (this.state === 'holding' && now - tr.tHoldStart >= tr.delay) { tr.t0 = performance.now(); this.state = 'cue'; Scene.setTarget('lit'); Audio.beep(880, 50); HUD.msg('停！开枪', '', true); }
    else if (this.state === 'cue' && now - tr.t0 > 2500) { this.timeoutCount++; HUD.flash('超时，这一发重来'); this.redo(); }
    else if (this.state === 'between') {
      var still = !Ctrl.keys.KeyA && !Ctrl.keys.KeyD && Math.abs(Ctrl.v) < 0.02;
      if (still && now - this.betweenAt > 380) this.nextTrial(); else if (!still && now - this.betweenAt > 1200) HUD.msg('松开所有按键', '等速度回到 0 再开始下一发');
    }
  },
  afterTrials: function () {
    if (this.mode !== 'validate') { this.finish(); return; }
    var self = this;
    this.state = 'holdphase'; this.holds = []; Scene.target.visible = false;
    HUD.count('5<small> 次</small>', '到底按住'); HUD.msg('把 <span class="dir">A</span> 按到底并按住 2 秒，圆环走满再松开', '重复 5 次，统计按住期间的回弹');
    this.hold = new HoldTracker({ key: 'KeyA', minHold: 1500, bounceGap: 250,
      onBounce: function (n) { HUD.flash('回弹 ×' + n); },
      onEnd: function (res) { if (!res.valid) { HUD.flash('按住时间不够 2 秒，重来'); return; } self.holds.push(res); HUD.readout('按住 ' + fmt(res.duration / 1000, 1) + ' s · 回弹 ' + res.bounces.length + ' 次'); if (self.holds.length >= self.holdNeed) self.finish(); }
    });
  },
  pause: function () {
    if (!this.active || this.paused) return;
    this.paused = true; Ctrl.keys.KeyA = false; Ctrl.keys.KeyD = false;
    var tr = this.cur();
    if (this.state === 'holdphase') { if (this.hold) this.hold.reset(); }
    else if (tr && (this.state === 'holding' || this.state === 'cue')) { tr.events = []; tr.tHoldStart = null; tr.t0 = null; Scene.setTarget('dim'); this.state = 'between'; }
    HUD.overlay('pause');
  },
  resume: function () { var self = this; if (Scene.fallback) this.onLocked(true); else Ctrl.requestLock(function () { self.onLocked(true); }); },
  abandon: function (silent) { this.active = false; this.paused = false; this.state = 'off'; if (this.hold) this.hold.reset(); HUD.ring(false); if (!silent) HUD.overlay('start'); },
  finish: function () {
    this.active = false; this.finished = true; this.state = 'off'; HUD.ring(false);
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    var m = modelFrom(settings), metrics = stopMetrics(this.trials, m), score = stopScore(metrics);
    var run = { version: 2, date: new Date().toISOString(), scenario: this.mode, settings: { sens: settings.sens, dpi: settings.dpi, trials: this.total, warmup: this.warm, maxSpreadDeg: settings.maxSpreadDeg, hFov: settings.hFov }, model: m, earlyCount: this.earlyCount, timeoutCount: this.timeoutCount, pointerLock: !Scene.fallback,
      trials: this.trials.map(function (t) { return { index: t.index, warmup: t.warmup, dir: t.dir, delay: Math.round(t.delay), tHoldStart: t.tHoldStart, t0: t.t0, tRelease: t.tRelease, tFire: t.tFire, cs: t.cs, events: t.events, vFire: t.vFire, moving: t.moving, hit: t.hit, overshoot: t.overshoot, fireAfterRelease: t.fireAfterRelease, releaseLatency: t.releaseLatency, spreadDeg: t.spreadDeg }; }),
      metrics: metrics, score: score };
    var box = $('#ov-end-box');
    if (this.mode === 'stop') {
      saveRun('stop', run);
      history.unshift({ scenario: 'stop', date: run.date, score: score, stopRate: metrics.stopRate, hitRate: metrics.hitRate, fireAfterRelease: metrics.fireAfterRelease, csUseRate: metrics.csUseRate }); history = history.slice(0, 20); Store.set('history', history);
      box.innerHTML = '<span class="pill acc">场景 01 结束</span><div class="bigscore"><b>' + score + '</b><span>分 · 停稳率 70% 权重，命中率 30% 权重</span></div><div class="mini-stats">' +
        [['停稳率', pct(metrics.stopRate)], ['命中率', pct(metrics.hitRate)], ['松键→开枪', fmt(metrics.fireAfterRelease) + ' ms'], ['松键延迟', fmt(metrics.releaseLatency) + ' ms'], ['急停使用', pct(metrics.csUseRate)], ['抢枪 / 超时', this.earlyCount + ' / ' + this.timeoutCount]].map(function (p) { return '<div><b>' + p[1] + '</b><span>' + p[0] + '</span></div>'; }).join('') +
        '</div><div class="row"><a class="btn primary" href="#scenario-strafe">下一项：场景 02</a><a class="btn" href="#results">查看结果</a><button class="btn ghost" id="btn-again" type="button">再测一次</button></div>';
    } else {
      var base = runs.stop.metrics, baseB = runs.bounce ? { rate: runs.bounce.bounceEvents / Math.max(1, runs.bounce.holds) } : null;
      var curB = { rate: this.holds.reduce(function (s, h) { return s + h.bounces.length; }, 0) / this.holdNeed };
      var cmp = validateCompare(base, baseB, metrics, curB);
      var prev = runs.validate, attempt = prev && !prev.pass ? (prev.attempt || 1) + 1 : 1;
      run.holds = this.holds; run.bounceRate = curB.rate; run.compare = cmp; run.pass = cmp.pass; run.attempt = attempt; run.appliedValues = buildRecs(runs, stylePreset).values;
      var fbStep = r1(RULES.fallbackStep * (cmp.pass ? attempt - 1 : attempt));
      run.fallback = fbStep > 0 ? { step: fbStep } : null;
      saveRun('validate', run);
      box.innerHTML = '<span class="pill acc">场景 05 结束</span><div class="bigscore"><b class="' + (cmp.pass ? '' : 'red') + '" style="color:' + (cmp.pass ? 'var(--hit)' : 'var(--miss)') + '">' + (cmp.pass ? '通过' : '未通过') + '</b><span>推荐值 vs 最小值基线</span></div>' +
        '<div class="tablewrap"><table class="cmp"><thead><tr><th>指标</th><th>基线</th><th>推荐值</th><th>标准</th></tr></thead><tbody>' + cmp.rows.map(function (r) { return '<tr><td>' + r.name + '</td><td class="v">' + r.base + '</td><td class="v ' + (r.ok ? 'up' : 'down') + '">' + r.cur + '</td><td class="why">' + r.rule + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (cmp.pass ? '<p class="hint">推荐值成立，把结果页的参数抄回主配置即可。</p>' : (attempt < RULES.maxValidate ? '<p class="hint">没通过：结果页已经把上抬和死区各回退 0.1 mm，按新值再验一次。</p>' : '<p class="hint">两次都没通过。结果页保留回退后的值，建议用"稳定"预设，并回头看看是不是节奏问题。</p>')) +
        '<div class="row"><a class="btn primary" href="#results">查看结果</a>' + (!cmp.pass && attempt < RULES.maxValidate ? '<button class="btn" id="btn-again" type="button">用回退值再验一次</button>' : '') + '<a class="btn ghost" href="#home">返回场景列表</a></div>';
    }
    var self = this, again = $('#btn-again');
    if (again) again.addEventListener('click', function () { self.setup(self.mode); self.start(); });
    HUD.overlay('end');
  }
};

/* ================= scenario 02: A / D strafe ================= */
var Strafe = {
  active: false, paused: false, events: [], switches: 0, need: 40, paced: 10, period: 333, lastDown: null, metro: 0, downState: { KeyA: false, KeyD: false }, lastUp: { KeyA: null, KeyD: null }, done: false,
  setup: function () {
    this.active = false; this.paused = false; this.done = false; this.events = []; this.switches = 0;
    var self = this;
    $('#ov-start-box').innerHTML = '<span class="pill acc">场景 02</span><h2>左右拉扯</h2><div class="steps">' +
      '<div>1. 用 <b>A 和 D 交替</b>左右拉扯，像在掩体后面蛇皮走位。</div><div>2. 前 <b>10 次切换跟着节拍</b>（约每 0.33 秒一次），之后 30 次按你自己的节奏。</div><div>3. 每次切换记录上一键松开到下一键按下的间隔：<b>负值就是两键重叠</b>，重叠期间角色是不动的。</div><div>4. 不需要开枪，鼠标也不用锁定。</div></div>' +
      '<div class="row"><button class="btn primary" id="btn-start" type="button">开始</button><a class="btn ghost" href="#home">返回</a></div>';
    $('#btn-start').addEventListener('click', function () { self.start(); });
    HUD.overlay('start'); HUD.count('0<small>/ ' + this.need + '</small>', '准备'); HUD.msg('', '');
  },
  running: function () { return this.active && !this.paused; },
  start: function () {
    Audio.ensure(); Scene.reset(); Scene.target.visible = false; Ctrl.v = 0;
    this.active = true; this.paused = false; this.done = false; this.events = []; this.switches = 0; this.lastDown = null; this.downState = { KeyA: false, KeyD: false }; this.lastUp = { KeyA: null, KeyD: null };
    HUD.overlay(null); HUD.count('0<small>/ ' + this.need + '</small>', '跟节拍 · 前 10 次'); HUD.msg('跟着节拍交替按 <span class="dir">A</span> 和 <span class="dir">D</span>', '先按哪个都行');
    var self = this; clearInterval(this.metro);
    this.metro = setInterval(function () { if (!self.running() || self.switches >= self.paced) return; Audio.beep(660, 35, 0.04); var m = $('#hud-msg'); m.style.transform = 'scale(1.06)'; setTimeout(function () { m.style.transform = ''; }, 90); }, this.period);
  },
  onKey: function (e, type) {
    if (!this.running() || this.done) return;
    var code = e.code; if (code !== 'KeyA' && code !== 'KeyD') return;
    var t = e.timeStamp;
    this.events.push({ t: t, code: code, type: type });
    if (type === 'up') { this.downState[code] = false; this.lastUp[code] = t; return; }
    var prev = this.lastDown; this.downState[code] = true;
    if (prev && prev !== code) {
      this.switches++;
      var live = this.downState[prev] ? '<span class="bad">重叠</span>' : (this.lastUp[prev] != null ? '空档 <b>+' + fmt(t - this.lastUp[prev]) + ' ms</b>' : '');
      HUD.readout('切换 ' + this.switches + ' · ' + live);
      HUD.count(this.switches + '<small>/ ' + this.need + '</small>', this.switches < this.paced ? '跟节拍 · 前 10 次' : '自由节奏');
      if (this.switches === this.paced) { HUD.msg('自由节奏，继续到 40 次', '按你平时拉扯的速度'); Audio.beep(990, 80); }
      if (this.switches >= this.need) this.finishSoon();
    }
    this.lastDown = code;
  },
  onFire: function () {},
  tick: function () {},
  finishSoon: function () { this.done = true; HUD.msg('完成，松开按键', ''); var self = this; setTimeout(function () { self.finish(); }, 500); },
  pause: function () { if (!this.active || this.paused) return; this.paused = true; Ctrl.keys.KeyA = false; Ctrl.keys.KeyD = false; HUD.overlay('pause'); },
  resume: function () { this.paused = false; HUD.overlay(null); },
  onLocked: function () {},
  abandon: function (silent) { this.active = false; this.paused = false; clearInterval(this.metro); if (!silent) HUD.overlay('start'); },
  finish: function () {
    this.active = false; clearInterval(this.metro);
    var mt = strafeMetrics(this.events, this.paced);
    var run = { version: 2, date: new Date().toISOString(), scenario: 'strafe', need: this.need, paced: this.paced, period: this.period, events: this.events, metrics: { n: mt.n, overlapRate: mt.overlapRate, gapMedian: mt.gapMedian, overlapMedian: mt.overlapMedian, airMedian: mt.airMedian, intervalMedian: mt.intervalMedian, cv: mt.cv }, switches: mt.switches };
    saveRun('strafe', run);
    $('#ov-end-box').innerHTML = '<span class="pill acc">场景 02 结束</span><div class="bigscore"><b>' + pct(mt.overlapRate) + '</b><span>切换重叠率（自由节奏的 30 次）</span></div><div class="mini-stats">' +
      [['空档中位', fmt(mt.airMedian) + ' ms'], ['重叠中位', mt.overlapMedian == null ? '无' : fmt(mt.overlapMedian) + ' ms'], ['切换间隔', fmt(mt.intervalMedian) + ' ms'], ['节奏稳定性', mt.cv == null ? '—' : fmt(mt.cv, 2)]].map(function (p) { return '<div><b>' + p[1] + '</b><span>' + p[0] + '</span></div>'; }).join('') +
      '</div><div class="row"><a class="btn primary" href="#scenario-sweep">下一项：场景 03</a><a class="btn" href="#results">查看结果</a><button class="btn ghost" id="btn-again" type="button">再测一次</button></div>';
    var self = this; $('#btn-again').addEventListener('click', function () { self.start(); });
    HUD.overlay('end');
  }
};
