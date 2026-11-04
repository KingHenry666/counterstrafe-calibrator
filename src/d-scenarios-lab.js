
/* ================= lab view (03 / 04) ================= */
function ringHTML(id, txt) { return '<div class="ring" id="' + id + '"><svg viewBox="0 0 180 180"><circle class="bg" cx="90" cy="90" r="80"></circle><circle class="fg" id="' + id + '-fg" cx="90" cy="90" r="80"></circle></svg><div class="txt" id="' + id + '-txt">' + txt + '</div></div>'; }
function ringSet(id, frac, txt) { var fg = $('#' + id + '-fg'); if (!fg) return; fg.style.strokeDashoffset = String(502 * (1 - clamp(frac, 0, 1))); fg.classList.toggle('done', frac >= 1); if (txt != null) { var t = $('#' + id + '-txt'); if (t) t.innerHTML = txt; } }
var Lab = {
  ctrl: null, raf: 0,
  enter: function (scen) {
    var c = SCENARIOS[scen];
    $('#lab-title').textContent = '场景 ' + c.no + ' · ' + c.name; $('#lab-sub').textContent = c.en; $('#lab-round').textContent = '';
    this.ctrl = scen === 'sweep' ? Sweep : Bounce;
    this.ctrl.start();
    var self = this;
    if (!this.raf) this.raf = requestAnimationFrame(function loop(now) { self.raf = requestAnimationFrame(loop); if (self.ctrl && self.ctrl.tick) self.ctrl.tick(now); });
  },
  leave: function () { if (this.ctrl) this.ctrl.abandon(); this.ctrl = null; if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } },
  draw: function () { if (!this.ctrl) return; $('#stage').innerHTML = this.ctrl.view(); var pill = $('#lab-round'); pill.textContent = this.ctrl.roundLabel ? this.ctrl.roundLabel() : ''; },
  onKey: function (e, type) { if (this.ctrl) this.ctrl.onKey(e, type); }
};
document.addEventListener('click', function (e) { var b = e.target.closest ? e.target.closest('[data-action]') : null; if (!b || !Lab.ctrl || $('#view-lab').hidden) return; Lab.ctrl.action(b.getAttribute('data-action'), b); });

function instructCard(title, valueText, steps, note, actionLabel, extraHtml) {
  return '<div class="panel instruct"><span class="scen-tag">设置键盘</span><h2>' + title + '</h2><div class="target"><b>' + valueText + '</b></div><ol>' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' + (note ? '<p class="hint">' + note + '</p>' : '') + (extraHtml || '') + '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-action="ready" type="button">' + (actionLabel || '我已设置好，开始') + '</button><button class="btn ghost" data-action="skip" type="button">跳过这一部分</button></div></div>';
}
function roundsHTML(rounds) { return rounds.length ? '<div class="rounds">' + rounds.map(function (r) { return '<span class="' + (r.pass ? 'pass' : 'fail') + '">' + mm(r.value) + ' ' + (r.pass ? '✓' : '✗') + (r.extra ? ' ' + r.extra : '') + '</span>'; }).join('') + '</div>' : ''; }

/* ---------- scenario 03: threshold sweep ---------- */
var Sweep = {
  part: 'intro', phase: 'idle', method: 'touch', st: null, value: null, cd: 0, cdT: 0, timers: [],
  a: { rounds: [], result: null }, b: { rounds: [], values: [0.3, 0.6, 1.0, 1.5, 2.0], idx: 0, ref: null, result: null }, c: { rounds: [], values: [0.3, 0.6, 1.0], idx: 0, result: null },
  beats: null, cue: null, burst: null,
  start: function () { this.part = 'intro'; this.phase = 'idle'; this.practiceResult = null; this.a = { rounds: [], result: null }; this.b = { rounds: [], values: [0.3, 0.6, 1.0, 1.5, 2.0], idx: 0, ref: null, result: null }; this.c = { rounds: [], values: [0.3, 0.6, 1.0], idx: 0, result: null }; this.st = null; Lab.draw(); },
  abandon: function () { this.clearTimers(); this.phase = 'idle'; },
  clearTimers: function () { this.timers.forEach(clearTimeout); this.timers = []; },
  later: function (fn, ms) { var id = setTimeout(fn, ms); this.timers.push(id); return id; },
  roundLabel: function () { if (this.part === 'practice') return '练习 · 不计入'; if (this.part === 'a') return '3a · 第 ' + (this.a.rounds.length + 1) + ' 轮'; if (this.part === 'b') return '3b · 第 ' + (this.b.idx + 1) + ' / ' + this.b.values.length; if (this.part === 'c') return '3c · 第 ' + (this.c.idx + 1) + ' / ' + this.c.values.length; return ''; },
  view: function () {
    var self = this;
    if (this.part === 'intro') {
      var pr = this.practiceResult;
      return '<div class="panel"><span class="scen-tag">场景 03</span><h2>阶梯扫频标定</h2><p class="lead">网页读不到你按了几毫米，但键盘的触发点可以调。把触发点一档一档调深，你用平时的力度按：键盘还能注册，说明你按得比这个深；哪一档开始漏，那一档就是你平时按压的深度。</p>' +
        '<div class="instruct"><ol>' +
        '<li><b>页面给你一个值</b>，比如"把 A/D 的触发点改成 2.0 mm"，附触控条或 Armoury Crate 的操作步骤。</li>' +
        '<li>你改好后点 <b>"我已设置好"</b>，3 秒倒计时，手放回 WASD。</li>' +
        '<li><b>跟着节拍按</b>：每一拍按一下屏幕提示的键，先 A 12 拍再 D 12 拍，轻按，像打游戏一样，不要刻意用力。绿点 = 键盘注册到了，红点 = 没注册。</li>' +
        '<li>页面算出注册了几下，<b>自动给下一个值</b>。能注册就往深试，漏了就往浅试，4–5 轮收敛。</li>' +
        '</ol></div>' +
        '<p class="hint">三部分：<strong>3a 按压深度</strong>（改触发点，二分法）、<strong>3b 抬起幅度</strong>（改"上抬"，0.3 → 2.0 mm 递增，按住 A 看到"停"就松）、<strong>3c 回压幅度</strong>（改"下压"，可选，连点 A 十下）。每轮大约 20 秒，每部分都可以跳过。做完记得把三项都改回 0.1 mm。</p>' +
        '<div><div class="hint" style="margin-bottom:6px">3a 改触发点的方式</div><div class="seg"><button type="button" data-action="method-touch" class="' + (this.method === 'touch' ? 'on' : '') + '">触控条 · 任意值</button><button type="button" data-action="method-profile" class="' + (this.method === 'profile' ? 'on' : '') + '">配置文件 · 五档预设</button></div><p class="hint" style="margin-top:6px">' + (this.method === 'touch' ? '双击触控条进入单键模式改 A/D，每轮改到网站给的值。' : '提前在配置文件 2–6 存好 A/D 触发点 0.5 / 1.0 / 1.5 / 2.0 / 2.5 mm，每轮只切换配置文件，最多 3 轮。') + '</p></div>' +
        (pr ? '<p class="note">练习完成：6 拍里注册了 ' + pr + ' 下。' + (pr >= 5 ? '节奏对了，可以开始 3a。' : '漏得有点多，再练一次，等绿点亮起的那一拍按。') + '</p>' : '') +
        '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-action="practice" type="button">先练 6 拍（不改设置）</button><button class="btn primary" data-action="begin-a" type="button">开始 3a</button><a class="btn ghost" href="#home">返回</a></div></div>';
    }
    if (this.part === 'end') return this.endView();
    if (this.phase === 'instruct') return this.instructView();
    if (this.phase === 'countdown') return '<div class="panel center"><p class="hint">把手放回 WASD，准备</p><div class="big" id="cd">' + this.cd + '</div><p class="hint">' + (this.part === 'a' || this.part === 'practice' ? '跟着节拍，像平时打游戏一样轻轻按，不要刻意用力' : (this.part === 'b' ? '按住 A，看到"停"就尽快停下' : '快速连点 A 十次')) + '</p></div>';
    if (this.phase === 'task') return this.taskView();
    if (this.phase === 'roundResult') return this.roundResultView();
    return '';
  },
  instructView: function () {
    var v = this.value, extra = roundsHTML(this.part === 'a' ? this.a.rounds : (this.part === 'b' ? this.b.rounds : this.c.rounds));
    var whyA = '<p class="hint">为什么：触发点越深，轻按越可能按不到。改好后跟 24 拍，漏超过 1 下就说明 ' + mm(v) + ' 超过了你平时的按压深度。</p>';
    var whyB = '<p class="hint">为什么：上抬值越大，要抬得越高才算松开。改好后按住 A，看到"停"就松，共 8 次；松键比 0.3 mm 那轮慢 15 ms 以上或漏掉，就说明 ' + mm(v) + ' 超过了你习惯抬起的幅度。</p>';
    var whyC = '<p class="hint">为什么：下压值越大，微抬后要压回去越深才算重新按下。改好后快速连点 A 十下，计数少于 9 就说明 ' + mm(v) + ' 超过了你回压的幅度。</p>';
    if (this.part === 'a') {
      if (this.method === 'profile') { var n = PROFILE_GRID.indexOf(v) + 2; return instructCard('3a · 切换到配置文件 ' + n, mm(v) + ' <span>A / D 触发点</span>', ['在 Armoury Crate 右上角把配置文件切到 <b>配置文件 ' + n + '</b>（A/D 触发点 ' + mm(v) + '）。', '其他参数保持基线：上抬 0.1、下压 0.1、死区最小。'], null, null, whyA + extra); }
      return instructCard('3a · 把 A 和 D 的触发点改成', mm(v) + ' <span>单键触发点</span>', ['双击触控条进入单键模式，可调的键亮绿。', '按一下 <b>A</b>，在触控条上把触发点滑到 <b>' + mm(v) + '</b>。', '按一下 <b>D</b>，同样滑到 <b>' + mm(v) + '</b>，然后退出单键模式。', '不想用触控条：Armoury Crate › 模拟触发 › 触发 › 单键触发点设置 › 编辑。'], '上抬、下压、死区保持基线不动。', null, whyA + extra);
    }
    if (this.part === 'b') return instructCard('3b · 把"上抬"改成', mm(v) + ' <span>快速触发 · 上抬</span>', ['Armoury Crate › 模拟触发 › 触发：A/D 的 <b>单键触发点改回 0.1 mm</b>（基线）。', '同一页把 <b>上抬</b> 改成 <b>' + mm(v) + '</b>，下压保持 0.1 mm。', '触控条改不了上抬，这一步只能在软件里改。'], null, null, whyB + extra);
    return instructCard('3c · 把"下压"改成', mm(v) + ' <span>快速触发 · 下压</span>', ['Armoury Crate › 模拟触发 › 触发：<b>上抬改回 0.1 mm</b>。', '把 <b>下压</b> 改成 <b>' + mm(v) + '</b>。'], '这一部分可选，测的是微抬后再压回去多深才算重新按下。', null, whyC + extra);
  },
  taskView: function () {
    if (this.part === 'practice') return '<div class="panel center"><p class="prompt" id="task-prompt">准备…</p><div class="beatrow"><div class="lbl">练习 · A × 6</div><div class="beats">' + Array.apply(null, Array(6)).map(function (_, i) { return '<i id="bt-' + i + '"></i>'; }).join('') + '</div></div><p class="hint">绿点亮起的那一拍按一下 A，轻按。这一轮不改设置、不计入。</p></div>';
    if (this.part === 'a') {
      var rows = ['KeyA', 'KeyD'].map(function (k, ki) { return '<div class="beatrow"><div class="lbl">' + (k === 'KeyA' ? 'A' : 'D') + ' × 12</div><div class="beats">' + Array.apply(null, Array(12)).map(function (_, i) { return '<i id="bt-' + (ki * 12 + i) + '"></i>'; }).join('') + '</div></div>'; }).join('');
      return '<div class="panel center"><p class="prompt" id="task-prompt">准备…</p>' + rows + '<p class="hint">每一拍按一下亮起的键，像平时一样轻按。绿 = 键盘注册到了，红 = 没注册到。</p></div>';
    }
    if (this.part === 'b') return '<div class="panel center"><span class="scen-tag" id="cue-count">第 1 / 8 次</span><p class="prompt" id="task-prompt">按住 A</p><div class="evt-list" id="cue-log"></div><p class="hint">看到"停"立刻停下：松开或微抬都行，怎么顺手怎么来。</p></div>';
    return '<div class="panel center"><p class="prompt" id="task-prompt">快速连点 A 十次</p><div class="big" id="burst-count">0</div><p class="hint">点完停下来，网站 0.7 秒后自动结算。</p></div>';
  },
  roundResultView: function () {
    var r = this.lastRound, next = this.nextValue;
    var body = r.pass ? '<div class="big green">✓</div>' : '<div class="big red">✗</div>';
    var txt = this.part === 'a' ? ('注册 ' + r.registered + ' / 24（A ' + r.regA + '，D ' + r.regD + '），漏 ' + r.misses + ' 次' + (r.pass ? '，这个深度你每次都按得到' : '，这个深度已经超过你的习惯按压')) :
      (this.part === 'b' ? ('松键延迟中位 ' + fmt(r.latency) + ' ms，漏 ' + r.misses + ' 次' + (r.pass ? '，这个上抬值你抬得到' : '，这个上抬值已经超过你习惯抬起的幅度')) : ('注册 ' + r.count + ' / 10' + (r.pass ? '，这个下压值你压得到' : '，这个下压值已经超过你习惯回压的幅度')));
    var nextTxt = next != null ? '下一轮：' + mm(next) : (this.part === 'a' ? '3a 完成' : (this.part === 'b' ? '3b 完成' : '3c 完成'));
    return '<div class="panel center">' + body + '<p class="prompt">' + mm(this.value) + ' · ' + (r.pass ? '通过' : '未通过') + '</p><p class="hint">' + txt + '</p>' + roundsHTML(this.part === 'a' ? this.a.rounds : (this.part === 'b' ? this.b.rounds : this.c.rounds)) + '<p class="hint">' + nextTxt + '</p><div class="row" style="display:flex;gap:8px;justify-content:center"><button class="btn primary" data-action="next" type="button">继续</button></div></div>';
  },
  endView: function () {
    var a = this.a.result, b = this.b.result, c = this.c.result;
    return '<div class="panel"><span class="scen-tag">场景 03 结束</span><h2>你的习惯键程</h2><div class="mini-stats">' +
      '<div><b>' + (a ? mm(a.lo) + (a.hi != null ? ' – ' + a.hi : ' +') : '未测') + '</b><span>习惯按压深度</span></div><div><b>' + (b ? mm(b.lift) : '未测') + '</b><span>习惯抬起幅度上限</span></div><div><b>' + (c ? mm(c.repress) : '未测') + '</b><span>习惯回压幅度上限</span></div></div>' +
      '<p class="note">现在把 A/D 触发点、上抬、下压全部改回 <b>0.1 mm</b>（基线），再做场景 04。</p>' +
      '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="#scenario-bounce">下一项：场景 04</a><a class="btn" href="#results">查看结果</a><button class="btn ghost" data-action="restart" type="button">重做场景 03</button></div></div>';
  },
  action: function (name) {
    if (name === 'method-touch') { this.method = 'touch'; Lab.draw(); return; }
    if (name === 'method-profile') { this.method = 'profile'; Lab.draw(); return; }
    if (name === 'begin-a') { this.part = 'a'; this.st = this.method === 'profile' ? { mode: 'profile', loIdx: -1, hiIdx: PROFILE_GRID.length, rounds: [] } : { mode: 'touch', lo: 0.1, hi: 3.9, rounds: [] }; this.value = sweepNext(this.st); this.phase = 'instruct'; Lab.draw(); return; }
    if (name === 'ready') { this.countdown(); return; }
    if (name === 'practice') { this.part = 'practice'; this.countdown(); return; }
    if (name === 'skip') { this.finishPart(true); return; }
    if (name === 'next') { this.advance(); return; }
    if (name === 'restart') { this.start(); return; }
  },
  countdown: function () {
    var self = this; this.phase = 'countdown'; this.cd = 3; Lab.draw();
    var step = function () { self.cd--; if (self.cd <= 0) { self.beginTask(); return; } var el = $('#cd'); if (el) el.textContent = self.cd; Audio.beep(440, 40, 0.03); self.later(step, 1000); };
    Audio.ensure(); Audio.beep(440, 40, 0.03); this.later(step, 1000);
  },
  beginTask: function () {
    this.phase = 'task'; Lab.draw();
    var self = this, now = performance.now();
    if (this.part === 'a' || this.part === 'practice') {
      var nb = this.part === 'a' ? 24 : 6;
      this.beats = { t0: now + 800, period: 600, n: nb, hit: [], cur: -1, closed: 0 };
      for (var i = 0; i < nb; i++) this.beats.hit.push(false);
    } else if (this.part === 'b') { this.cue = { n: 8, i: 0, state: 'wait', t0: null, holdStart: null, delay: 0, results: [], log: [] }; this.cuePrompt('按住 A'); }
    else { this.burst = { count: 0, first: null, last: null, done: false }; }
  },
  cuePrompt: function (text, cue) { var p = $('#task-prompt'); if (p) { p.textContent = text; p.classList.toggle('cue', !!cue); } var c = $('#cue-count'); if (c && this.cue) c.textContent = '第 ' + Math.min(this.cue.i + 1, this.cue.n) + ' / ' + this.cue.n + ' 次'; },
  cueLog: function (html) { var l = $('#cue-log'); if (!l || !this.cue) return; this.cue.log.unshift(html); l.innerHTML = this.cue.log.slice(0, 5).join('<br>'); },
  tick: function (now) {
    if (this.phase !== 'task') return;
    if ((this.part === 'a' || this.part === 'practice') && this.beats) {
      var B = this.beats, idx = Math.floor((now - B.t0) / B.period);
      if (idx >= 0 && idx < B.n && idx !== B.cur) { B.cur = idx; var el = $('#bt-' + idx); if (el) el.classList.add('now'); var isA = this.beatKey(idx) === 'KeyA'; Audio.beep(isA ? 740 : 620, 35, 0.04); var p = $('#task-prompt'); if (p) p.textContent = isA ? '按 A' : '按 D'; }
      while (B.closed < B.n && now > B.t0 + B.closed * B.period + 350) { var e2 = $('#bt-' + B.closed); if (e2) { e2.classList.remove('now'); e2.classList.add(B.hit[B.closed] ? 'ok' : 'miss'); } B.closed++; }
      if (B.closed >= B.n) this.roundDone();
      return;
    }
    if (this.part === 'b' && this.cue) {
      var C = this.cue;
      if (C.state === 'holding' && now - C.holdStart >= C.delay) { C.state = 'cue'; C.t0 = performance.now(); this.cuePrompt('停！', true); Audio.beep(880, 60); }
      else if (C.state === 'cue' && now - C.t0 > 1200) { C.results.push({ latency: null, miss: true }); this.cueLog('<span class="bad">第 ' + (C.i + 1) + ' 次：1.2 秒内没有松键</span>'); C.i++; C.state = 'release'; this.cuePrompt('松开 A'); }
      else if (C.state === 'done' && now - C.doneAt > 400) this.roundDone();
      return;
    }
    if (this.part === 'c' && this.burst) { var Bu = this.burst; if (Bu.first != null && !Bu.done && now - Bu.last > 700) { Bu.done = true; this.roundDone(); } }
  },
  onKey: function (e, type) {
    if (this.phase !== 'task') return;
    var t = e.timeStamp;
    if ((this.part === 'a' || this.part === 'practice') && this.beats && type === 'down') {
      var B = this.beats; if (e.code !== 'KeyA' && e.code !== 'KeyD') return;
      for (var i = Math.max(0, B.closed); i < B.n; i++) { var bt = B.t0 + i * B.period; if (t >= bt - 150 && t <= bt + 350) { var want = this.beatKey(i); if (e.code === want && !B.hit[i]) { B.hit[i] = true; var el = $('#bt-' + i); if (el) el.classList.add('ok'); } break; } }
      return;
    }
    if (this.part === 'b' && this.cue) {
      var C = this.cue; if (e.code !== 'KeyA') return;
      if (C.state === 'wait' && type === 'down') { C.state = 'holding'; C.holdStart = t; C.delay = 800 + Math.random() * 1200; this.cuePrompt('保持按住…'); return; }
      if (C.state === 'holding' && type === 'up') { C.state = 'wait'; this.cuePrompt('太早松了，重新按住 A'); return; }
      if (C.state === 'cue' && type === 'up') { var lat = t - C.t0; C.results.push({ latency: lat, miss: false }); this.cueLog('第 ' + (C.i + 1) + ' 次：松键 ' + fmt(lat) + ' ms'); C.i++; if (C.i >= C.n) { C.state = 'done'; C.doneAt = performance.now(); this.cuePrompt('完成'); } else { C.state = 'wait'; this.cuePrompt('再按住 A'); } return; }
      if (C.state === 'release' && type === 'up') { if (C.i >= C.n) { C.state = 'done'; C.doneAt = performance.now(); this.cuePrompt('完成'); } else { C.state = 'wait'; this.cuePrompt('再按住 A'); } return; }
      if (C.state === 'release' && type === 'down') { return; }
      return;
    }
    if (this.part === 'c' && this.burst && type === 'down' && e.code === 'KeyA') { var Bu = this.burst; if (Bu.done) return; if (Bu.first == null) Bu.first = t; Bu.last = t; Bu.count++; var bc = $('#burst-count'); if (bc) bc.textContent = Bu.count; }
  },
  beatKey: function (i) { return this.part === 'practice' ? 'KeyA' : (i < 12 ? 'KeyA' : 'KeyD'); },
  roundDone: function () {
    if (this.part === 'practice') { var got = this.beats.hit.filter(Boolean).length; this.beats = null; this.practiceResult = got; Audio.beep(1100, 90); this.part = 'intro'; this.phase = 'idle'; Lab.draw(); return; }
    this.phase = 'roundResult'; var r;
    if (this.part === 'a') {
      var B = this.beats, regA = B.hit.slice(0, 12).filter(Boolean).length, regD = B.hit.slice(12).filter(Boolean).length, reg = regA + regD;
      r = { value: this.value, registered: reg, regA: regA, regD: regD, misses: 24 - reg, pass: 24 - reg <= RULES.sweepPassMisses, extra: reg + '/24' };
      sweepApply(this.st, this.value, r.pass); this.a.rounds = this.st.rounds.map(function (x, i) { return Object.assign({}, x, { extra: null }); }); this.a.rounds[this.a.rounds.length - 1].extra = r.extra;
      this.nextValue = sweepNext(this.st); this.beats = null;
    } else if (this.part === 'b') {
      var C = this.cue, lat = median(C.results.map(function (x) { return x.latency; })), misses = C.results.filter(function (x) { return x.miss; }).length;
      var pass = misses === 0 && (this.b.ref == null || lat - this.b.ref < RULES.liftLatencyDelta);
      if (this.b.idx === 0 && misses === 0) this.b.ref = lat;
      r = { value: this.value, latency: lat, misses: misses, pass: pass, extra: fmt(lat) + 'ms' };
      this.b.rounds.push(r); this.b.idx++;
      this.nextValue = (pass && this.b.idx < this.b.values.length) ? this.b.values[this.b.idx] : null; this.cue = null;
    } else {
      var Bu = this.burst; r = { value: this.value, count: Bu.count, pass: Bu.count >= RULES.repressPassCount, extra: Bu.count + '/10' };
      this.c.rounds.push(r); this.c.idx++;
      this.nextValue = (r.pass && this.c.idx < this.c.values.length) ? this.c.values[this.c.idx] : null; this.burst = null;
    }
    this.lastRound = r; Audio.beep(r.pass ? 1100 : 300, 90); Lab.draw();
  },
  advance: function () {
    if (this.nextValue != null) { this.value = this.nextValue; this.phase = 'instruct'; Lab.draw(); return; }
    this.finishPart(false);
  },
  finishPart: function (skipped) {
    this.clearTimers();
    if (this.part === 'a') {
      if (!skipped && this.st && this.st.rounds.length) this.a.result = sweepResult(this.st);
      this.part = 'b'; this.b.idx = 0; this.value = this.b.values[0]; this.phase = 'instruct'; Lab.draw(); return;
    }
    if (this.part === 'b') {
      if (!skipped && this.b.rounds.length) { var passed = this.b.rounds.filter(function (x) { return x.pass; }); this.b.result = { lift: passed.length ? passed[passed.length - 1].value : 0.3, refLatency: this.b.ref, allFailed: !passed.length }; }
      this.part = 'c'; this.c.idx = 0; this.value = this.c.values[0]; this.phase = 'instruct'; Lab.draw(); return;
    }
    if (!skipped && this.c.rounds.length) { var pc = this.c.rounds.filter(function (x) { return x.pass; }); this.c.result = { repress: pc.length ? pc[pc.length - 1].value : 0.3 }; }
    this.save(); this.part = 'end'; this.phase = 'idle'; Lab.draw();
  },
  save: function () {
    var run = { version: 2, date: new Date().toISOString(), scenario: 'sweep', method: this.method, depth: this.a.result, lift: this.b.result ? this.b.result.lift : null, liftRef: this.b.result ? this.b.result.refLatency : null, repress: this.c.result ? this.c.result.repress : null, rounds: { a: this.a.rounds, b: this.b.rounds, c: this.c.rounds } };
    saveRun('sweep', run);
  }
};

/* ---------- scenario 04: bounce & rest ---------- */
var Bounce = {
  phase: 'intro', holds: [], need: 10, tracker: null, rest: null, timers: [], cd: 0,
  start: function () { this.phase = 'intro'; this.holds = []; this.rest = null; this.tracker = null; Lab.draw(); },
  abandon: function () { this.timers.forEach(clearTimeout); this.timers = []; if (this.tracker) this.tracker.reset(); this.phase = 'idle'; },
  later: function (fn, ms) { var id = setTimeout(fn, ms); this.timers.push(id); return id; },
  roundLabel: function () { if (this.phase === 'task4a') return '4a · ' + this.holds.length + ' / ' + this.need; if (this.phase === 'task4b') return '4b · 休息 10 秒'; return ''; },
  view: function () {
    if (this.phase === 'intro') return '<div class="panel"><span class="scen-tag">场景 04</span><h2>误触与稳定性</h2><p class="lead">两个小测试，都在最小值基线下做（触发点、上抬、下压 0.1 mm，死区最小）。<strong>4a 到底回弹</strong>：用平时的力度把 A 按到底并按住 2 秒，重复 10 次，统计按住期间键盘多报的松开和按下。<strong>4b 休息抖动</strong>：手指像平时一样搭在 WASD 上但不按，保持 10 秒，统计意外按键。</p><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-action="begin4a" type="button">开始 4a</button><a class="btn ghost" href="#home">返回</a></div></div>';
    if (this.phase === 'task4a') return '<div class="panel center"><p class="prompt" id="task-prompt">把 A 按到底并按住，圆环走满再松开</p>' + ringHTML('hold', this.holds.length + '<small>/ ' + this.need + ' 次</small>') + '<div class="evt-list" id="hold-log"></div><p class="hint">用平时打游戏的力度，不用刻意压。按住不到 2 秒的不计。</p></div>';
    if (this.phase === 'intro4b') return '<div class="panel"><span class="scen-tag">4a 完成</span><h2>到底回弹 ' + this.bounceEvents() + ' 次</h2><p class="hint">' + this.need + ' 次按住里键盘一共多报了 ' + this.bounceEvents() + ' 对松开/按下。接下来是 4b：把手指像平时一样放在 WASD 上，不要按，保持 10 秒。</p><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-action="begin4b" type="button">开始 4b</button></div></div>';
    if (this.phase === 'countdown') return '<div class="panel center"><p class="hint">把手指搭上去，不要按</p><div class="big" id="cd">' + this.cd + '</div></div>';
    if (this.phase === 'task4b') return '<div class="panel center"><p class="prompt" id="task-prompt">保持不按</p>' + ringHTML('rest', '10<small>秒</small>') + '<div class="evt-list" id="rest-log"></div></div>';
    if (this.phase === 'end') return '<div class="panel"><span class="scen-tag">场景 04 结束</span><h2>误触与稳定性</h2><div class="mini-stats"><div><b>' + this.bounceEvents() + '</b><span>到底回弹（10 次按住）</span></div><div><b>' + this.rest.events.length + '</b><span>休息误触（10 秒）</span></div></div>' + (this.rest.events.length ? '<p class="hint">误触的键：' + this.rest.events.map(function (e) { return e.code.replace('Key', ''); }).join('、') + '</p>' : '') + '<div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="#results">查看结果和推荐值</a><button class="btn ghost" data-action="restart" type="button">重做场景 04</button></div></div>';
    return '';
  },
  bounceEvents: function () { return this.holds.reduce(function (s, h) { return s + h.bounces.length; }, 0); },
  action: function (name) {
    var self = this;
    if (name === 'begin4a') {
      this.phase = 'task4a'; this.holds = []; Audio.ensure(); Lab.draw();
      this.tracker = new HoldTracker({ key: 'KeyA', minHold: 1500, bounceGap: 250,
        onBounce: function (n) { Audio.beep(300, 50); var l = $('#hold-log'); if (l) l.innerHTML = '<span class="bad">回弹 ×' + n + '</span><br>' + l.innerHTML; },
        onEnd: function (res) { var l = $('#hold-log'); if (!res.valid) { if (l) l.innerHTML = '<span class="bad">按住不到 2 秒，不计</span><br>' + l.innerHTML; return; } self.holds.push(res); Audio.beep(1000, 50); if (l) l.innerHTML = '第 ' + self.holds.length + ' 次：按住 ' + fmt(res.duration / 1000, 1) + ' s，回弹 ' + res.bounces.length + ' 次<br>' + l.innerHTML; $('#lab-round').textContent = self.roundLabel(); if (self.holds.length >= self.need) { self.tracker = null; self.phase = 'intro4b'; Lab.draw(); } }
      });
      return;
    }
    if (name === 'begin4b') { this.phase = 'countdown'; this.cd = 3; Lab.draw(); var step = function () { self.cd--; if (self.cd <= 0) { self.phase = 'task4b'; self.rest = { t0: performance.now(), events: [] }; Lab.draw(); Audio.beep(880, 60); return; } var el = $('#cd'); if (el) el.textContent = self.cd; Audio.beep(440, 40, 0.03); self.later(step, 1000); }; Audio.beep(440, 40, 0.03); this.later(step, 1000); return; }
    if (name === 'restart') { this.start(); return; }
  },
  onKey: function (e, type) {
    if (this.phase === 'task4a' && this.tracker) { this.tracker.onKey(e, type); return; }
    if (this.phase === 'task4b' && this.rest && type === 'down' && /^Key[WASD]$/.test(e.code)) { this.rest.events.push({ code: e.code, t: e.timeStamp - this.rest.t0 }); Audio.beep(300, 50); var l = $('#rest-log'); if (l) l.innerHTML = '<span class="bad">' + e.code.replace('Key', '') + ' 在 ' + fmt((e.timeStamp - this.rest.t0) / 1000, 1) + ' s 被按下</span><br>' + l.innerHTML; }
  },
  tick: function (now) {
    if (this.phase === 'task4a' && this.tracker) { ringSet('hold', clamp(this.tracker.heldFor(now) / 2000, 0, 1), this.holds.length + '<small>/ ' + this.need + ' 次</small>'); return; }
    if (this.phase === 'task4b' && this.rest) { var el = (now - this.rest.t0) / 1000; ringSet('rest', el / 10, Math.max(0, Math.ceil(10 - el)) + '<small>秒</small>'); if (el >= 10) this.finish(); }
  },
  finish: function () {
    this.phase = 'end';
    var run = { version: 2, date: new Date().toISOString(), scenario: 'bounce', holds: this.holds.length, holdData: this.holds, bounceEvents: this.bounceEvents(), restFalse: this.rest.events.length, restEvents: this.rest.events };
    saveRun('bounce', run); Audio.beep(1100, 90); Lab.draw();
  }
};
