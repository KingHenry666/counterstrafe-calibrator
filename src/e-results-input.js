
/* ================= results ================= */
function dksGrid(p) {
  var head = '<div class="h"></div>' + ['第 1 列 ↓ 按下', '第 2 列 ↓ 到底', '第 3 列 ↑ 离底', '第 4 列 ↑ 松开'].map(function (h, i) { return '<div class="h">' + h + '<b>' + p.cols[i] + '</b></div>'; }).join('');
  var body = p.slots.map(function (s, i) { return '<div class="slot"><b>' + (s.key || '—') + '</b>槽 ' + (i + 1) + '</div>' + s.cells.map(function (c) { return '<div class="c ' + c + '"></div>'; }).join(''); }).join('');
  return '<div class="tablewrap"><div class="dks">' + head + body + '</div></div>';
}
function metricTable(defs) { return '<div class="panel" style="padding:0"><div class="tablewrap"><table><thead><tr><th>指标</th><th>值</th><th>定义</th></tr></thead><tbody>' + defs.map(function (d) { return '<tr><td>' + d[0] + '</td><td class="v">' + d[1] + '</td><td class="why">' + d[2] + '</td></tr>'; }).join('') + '</tbody></table></div></div>'; }
function buildCopyText(recs) {
  var L = ['急停标定台 · 推荐参数（预设：' + ({ stable: '稳定', balanced: '平衡', aggressive: '激进' })[recs.style] + '）', '生成时间：' + dstr(new Date().toISOString()), '已完成：' + Object.keys(SCENARIOS).filter(function (id) { return runs[id]; }).map(function (id) { return SCENARIOS[id].no; }).join(' / '), '', 'Armoury Crate › 模拟触发 › 触发'];
  recs.rows.forEach(function (r) { L.push('- ' + r.field + '：' + r.value + (r.status.indexOf('默认') === 0 ? '（' + r.status + '）' : '')); });
  L.push('', '按键 › 动态按键 (DKS)');
  L.push('- 方案 1（W 键）：槽 1 Shift 从第 1 列按住到第 2 列、第 3 列按住到第 4 列；槽 2 W 从第 1 列按住到第 4 列；第 1 列深度 ' + recs.dks[0].cols[0] + '。' + (recs.dks[0].ok ? '' : '（场景 03 显示你按不到底，这个方案对你无效）'));
  L.push('- 方案 2 默认不建议。');
  return L.join('\n');
}
function renderResults() {
  var box = $('#results-body');
  var done = Object.keys(SCENARIOS).filter(function (id) { return runs[id]; });
  if (!done.length) { box.innerHTML = '<div class="empty"><p>还没有结果。先完成基线设置，再从场景 01 开始。</p><a class="btn primary" href="#setup">去基线设置</a></div>'; return; }
  var recs = buildRecs(runs, stylePreset), st = runs.stop, sf = runs.strafe, sw = runs.sweep, bo = runs.bounce, va = runs.validate;
  var lvl = function (k) { return '<span class="lv lv-' + k + '">' + COMPLIANCE.levels[k].label + '</span>'; };
  var html = '<p class="lead">已完成 ' + Object.keys(SCENARIOS).map(function (id) { return '<span class="pill' + (runs[id] ? ' acc' : '') + '" style="margin-right:4px">' + SCENARIOS[id].no + '</span>'; }).join('') + '。推荐值按文档第 5 节的规则从这些结果推出来，缺的场景用默认值并标出。</p>';
  if (st) {
    var m = st.metrics;
    html += '<div class="tiles" style="margin-top:16px"><div class="tile score"><b>' + st.score + '</b><span>场景 01 分数</span></div><div class="tile"><b>' + pct(m.stopRate) + '</b><span>停稳率</span></div><div class="tile"><b>' + pct(m.hitRate) + '</b><span>命中率</span></div><div class="tile"><b>' + fmt(m.fireAfterRelease) + '<small>ms</small></b><span>松键→开枪 中位数</span></div>' + (sf ? '<div class="tile"><b>' + pct(sf.metrics.overlapRate) + '</b><span>拉扯重叠率</span></div>' : '') + (sw && sw.depth ? '<div class="tile"><b>' + fmt(sw.depth.lo, 1) + (sw.depth.hi != null ? '–' + fmt(sw.depth.hi, 1) : '+') + '<small>mm</small></b><span>习惯按压深度</span></div>' : '') + (bo ? '<div class="tile"><b>' + bo.bounceEvents + '<small>次</small></b><span>到底回弹</span></div>' : '') + '</div>';
  }
  html += '<div class="section"><div class="section-head"><h3>硬件能解决的 / 习惯要练的</h3><span class="meta">最小值基线下的判断</span></div><div class="split"><div class="panel"><h3>调参数能解决</h3><ul>' + (recs.split.hardware.length ? recs.split.hardware.map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li>暂无</li>') + '</ul></div><div class="panel"><h3>要靠练</h3><ul>' + (recs.split.habit.length ? recs.split.habit.map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li>没有发现节奏问题。</li>') + '</ul></div></div></div>';
  html += '<div class="section"><div class="section-head"><h3>推荐参数</h3><span class="meta">字段名与 Armoury Crate 一致</span><span class="seg" style="margin-left:auto">' + [['stable', '稳定'], ['balanced', '平衡'], ['aggressive', '激进']].map(function (p) { return '<button type="button" data-style="' + p[0] + '" class="' + (stylePreset === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</span></div>' +
    '<p class="hint">预设只在上抬、下压、死区上加减 0.1 mm（稳定 +0.1，激进 −0.1），触发点不变。' + (va && va.fallback ? ' 验证轮回退已生效：上抬和死区各减 ' + mm(va.fallback.step) + '。' : '') + '</p>' +
    '<div class="panel" style="padding:0"><div class="tablewrap"><table><thead><tr><th>Armoury Crate 字段</th><th>推荐值</th><th>合规</th><th>依据</th></tr></thead><tbody>' + recs.rows.map(function (r) { return '<tr><td>' + r.field + '<div class="status' + (r.status.indexOf('默认') !== 0 ? ' measured' : '') + '">' + r.status + '</div></td><td class="v">' + r.value + '</td><td>' + lvl(r.level) + '</td><td class="why">' + r.why + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '<div class="panel"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="btn-copy" type="button">复制纯文本清单</button><button class="btn" id="btn-json" type="button">显示导出 JSON</button>' + (st ? '<a class="btn" href="#scenario-validate">去做场景 05 验证</a>' : '') + '</div><textarea class="export" id="json-out" hidden readonly></textarea></div></div>';
  html += '<div class="section"><div class="section-head"><h3>DKS 方案</h3><span class="meta">按键 › 动态按键 (DKS) › 编辑，4 列 × 4 槽</span></div>';
  html += '<div class="panel"><h3>' + recs.dks[0].title + ' ' + lvl('green') + '</h3>' + dksGrid(recs.dks[0]) + '<p class="' + (recs.dks[0].ok ? 'hint' : 'note warn') + '">' + recs.dks[0].note + '</p></div>';
  html += '<div class="panel"><h3>' + recs.dks[1].title + ' ' + lvl('orange') + '</h3><p class="note warn">' + COMPLIANCE.levels.orange.text + '</p><label class="check" style="border:0;padding:4px 0"><input type="checkbox" id="risk-ok"><div class="what">我了解风险，展开方案 2</div></label><div id="dks2" hidden>' + dksGrid(recs.dks[1]) + '<p class="hint">' + recs.dks[1].note + '</p></div></div></div>';
  if (va) {
    html += '<div class="section"><div class="section-head"><h3>场景 05 · 验证轮</h3><span class="meta">' + dstr(va.date) + ' · 第 ' + va.attempt + ' 次 · ' + (va.pass ? '通过' : '未通过') + '</span></div><div class="panel" style="padding:0"><div class="tablewrap"><table class="cmp"><thead><tr><th>指标</th><th>最小值基线</th><th>推荐值</th><th>标准</th></tr></thead><tbody>' + va.compare.rows.map(function (r) { return '<tr><td>' + r.name + '</td><td class="v">' + r.base + '</td><td class="v ' + (r.ok ? 'up' : 'down') + '">' + r.cur + '</td><td class="why">' + r.rule + '</td></tr>'; }).join('') + '</tbody></table></div></div><p class="hint">验证时填入的值：A/D 触发点 ' + mm(va.appliedValues.trigAD) + '、上抬 ' + mm(va.appliedValues.release) + '、下压 ' + mm(va.appliedValues.press) + '、顶部死区 ' + mm(va.appliedValues.dzTop) + '、底部死区 ' + mm(va.appliedValues.dzBot) + '。</p></div>';
  }
  if (st) {
    var mt = st.metrics;
    html += '<div class="section"><div class="section-head"><h3>场景 01 · 急停反应</h3><span class="meta">' + dstr(st.date) + ' · 计分 ' + mt.n + ' 发' + (st.pointerLock ? '' : ' · 未锁定鼠标') + '</span></div>' + metricTable([
      ['松键延迟', fmt(mt.releaseLatency) + ' ms', '靶子亮起到方向键 keyup 的中位数'], ['松键到开枪', fmt(mt.fireAfterRelease) + ' ms', '方向键 keyup 到鼠标 pointerdown 的中位数；负值 = 还没松就开枪'], ['没松键就开枪', pct(mt.firedWhileHoldingRate), '按键仍按住时开枪的占比'], ['移动中开枪率', pct(mt.movingShotRate), '模型判定开枪瞬间剩余速度 > 10% 的占比'], ['开枪时剩余速度', pct(mt.vFireMedian), '中位数，占最高速度的比例'], ['急停使用率', pct(mt.csUseRate), '靶子亮后按了反方向键的占比'], ['急停重叠 / 间隔', (mt.csGap == null ? '—' : (mt.csGap < 0 ? '重叠 ' + fmt(-mt.csGap) : '空档 ' + fmt(mt.csGap)) + ' ms'), '反方向键 keydown 减去方向键 keyup 的中位数'], ['急停按住时长', fmt(mt.csHold) + ' ms', '反方向键按下到松开的中位数'], ['过冲率', pct(mt.overshootRate), '反方向键按太久、速度已反向的占比'], ['停稳余量', (mt.stopGap == null ? '—' : (mt.stopGap >= 0 ? '+' : '') + fmt(mt.stopGap) + ' ms'), '松键到开枪 减去 模型减速时间（急停时减半）'], ['抢枪 / 超时', st.earlyCount + ' / ' + st.timeoutCount, '靶子亮前开枪 / 亮后 2.5 s 没开枪']]) + '</div>';
  }
  if (sf) {
    var s2 = sf.metrics;
    html += '<div class="section"><div class="section-head"><h3>场景 02 · 左右拉扯</h3><span class="meta">' + dstr(sf.date) + ' · 自由节奏 30 次</span></div>' + metricTable([['切换重叠率', pct(s2.overlapRate), '下一键按下时上一键还没松开的切换占比'], ['重叠中位', s2.overlapMedian == null ? '无' : fmt(s2.overlapMedian) + ' ms', '重叠切换里两键同时按住的时长'], ['空档中位', fmt(s2.airMedian) + ' ms', '上一键松开到下一键按下'], ['切换间隔', fmt(s2.intervalMedian) + ' ms', '相邻两次切换的 keydown 间隔'], ['节奏稳定性', s2.cv == null ? '—' : fmt(s2.cv, 2), '切换间隔的变异系数，越小越稳']]) + '</div>';
  }
  if (sw) {
    var rr = function (rs) { return rs && rs.length ? roundsHTML(rs) : '<span class="hint">跳过</span>'; };
    html += '<div class="section"><div class="section-head"><h3>场景 03 · 阶梯扫频标定</h3><span class="meta">' + dstr(sw.date) + ' · ' + (sw.method === 'profile' ? '配置文件五档' : '触控条任意值') + '</span></div><div class="panel"><div class="kv-wide"><p><b>3a 习惯按压深度：</b>' + (sw.depth ? mm(sw.depth.lo) + (sw.depth.hi != null ? ' 到 ' + mm(sw.depth.hi) + ' 之间' : ' 以上（测到的最大值都能注册）') : '跳过') + '</p>' + rr(sw.rounds.a) + '<p style="margin-top:10px"><b>3b 习惯抬起幅度上限：</b>' + (sw.lift != null ? mm(sw.lift) + '（参考延迟 ' + fmt(sw.liftRef) + ' ms）' : '跳过') + '</p>' + rr(sw.rounds.b) + '<p style="margin-top:10px"><b>3c 习惯回压幅度上限：</b>' + (sw.repress != null ? mm(sw.repress) : '跳过') + '</p>' + rr(sw.rounds.c) + '</div></div></div>';
  }
  if (bo) {
    html += '<div class="section"><div class="section-head"><h3>场景 04 · 误触与稳定性</h3><span class="meta">' + dstr(bo.date) + '</span></div>' + metricTable([['到底回弹', bo.bounceEvents + ' 次', bo.holds + ' 次按住 2 秒期间多报的松开/按下对'], ['休息误触', bo.restFalse + ' 次', '手指搭在 WASD 上 10 秒内的意外 keydown' + (bo.restEvents && bo.restEvents.length ? '：' + bo.restEvents.map(function (e) { return e.code.replace('Key', ''); }).join('、') : '')]]) + '</div>';
  }
  html += '<div class="section"><p class="src">合规等级说明（更新于 ' + COMPLIANCE.updated + '）：' + Object.keys(COMPLIANCE.levels).map(function (k) { return COMPLIANCE.levels[k].label + '，' + COMPLIANCE.levels[k].text; }).join(' ') + ' 来源：' + COMPLIANCE.sources.map(function (s) { return '<a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.title) + '</a>'; }).join('、') + '。所有毫秒数只做同一台机器内的相对比较。</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><a class="btn" href="#home">返回场景列表</a><button class="btn ghost" id="btn-clear" type="button">清空全部结果</button></div></div>';
  box.innerHTML = html;
  $('#btn-copy').addEventListener('click', function () { copyText(buildCopyText(recs)); });
  $('#btn-json').addEventListener('click', function () { var ta = $('#json-out'); ta.hidden = false; ta.value = JSON.stringify({ version: 2, exported: new Date().toISOString(), settings: settings, style: stylePreset, recommendations: recs.values, runs: runs }, null, 1); ta.focus(); ta.select(); });
  $('#risk-ok').addEventListener('change', function (e) { $('#dks2').hidden = !e.target.checked; });
  $$('[data-style]').forEach(function (b) { b.addEventListener('click', function () { stylePreset = b.getAttribute('data-style'); Store.set('style', stylePreset); renderResults(); }); });
  $('#btn-clear').addEventListener('click', function () { var b = this; if (b.getAttribute('data-arm')) { runs = {}; history = []; Store.set('runs', runs); Store.set('history', history); Store.set('lastRun', null); renderResults(); toast('已清空'); } else { b.setAttribute('data-arm', '1'); b.textContent = '再点一次确认清空'; } });
}
function copyText(text) {
  var done = function () { toast('已复制'); };
  var fallback = function () { var ta = $('#json-out'); ta.hidden = false; ta.value = text; ta.focus(); ta.select(); toast('已放到下方文本框，手动复制'); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}

/* ================= global input ================= */
var MOVE_KEYS = { KeyA: 1, KeyD: 1, KeyW: 1, KeyS: 1, Space: 1 };
function inField(e) { return e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName); }
window.addEventListener('keydown', function (e) {
  if (currentView === 'scene') { if (MOVE_KEYS[e.code] || e.code === 'Tab') e.preventDefault(); if (e.repeat) return; if (e.code === 'Escape' && Ctrl.active === Strafe && Strafe.active && !Strafe.paused) { Strafe.pause(); return; } Ctrl.onKey(e, 'down'); return; }
  if (currentView === 'lab') { if (MOVE_KEYS[e.code] && !inField(e)) e.preventDefault(); if (e.repeat) return; Lab.onKey(e, 'down'); return; }
  if (e.repeat) return;
  if (currentView === 'setup' && !inField(e)) { if (MOVE_KEYS[e.code]) e.preventDefault(); SelfCheck.key(e, 'down'); }
}, { capture: true });
window.addEventListener('keyup', function (e) {
  if (currentView === 'scene') { Ctrl.onKey(e, 'up'); return; }
  if (currentView === 'lab') { Lab.onKey(e, 'up'); return; }
  if (currentView === 'setup' && !inField(e)) SelfCheck.key(e, 'up');
}, { capture: true });
window.addEventListener('pointerdown', function (e) {
  if (currentView !== 'scene' || e.button !== 0) return;
  if (e.target && e.target.closest && (e.target.closest('.overlay') || e.target.closest('.hud-tr'))) return;
  Ctrl.onFire(e);
}, { capture: true });
document.addEventListener('contextmenu', function (e) { if (currentView === 'scene') e.preventDefault(); });
document.addEventListener('pointerlockchange', function () { Scene.locked = document.pointerLockElement === Scene.canvas; if (Scene.locked) Scene.fallback = false; Ctrl.onLocked(Scene.locked); });
document.addEventListener('mousemove', function (e) {
  if (currentView !== 'scene' || !Scene.ok) return;
  if (Scene.locked) Scene.look(e.movementX || 0, e.movementY || 0);
  else if (Scene.fallback && Ctrl.active && Ctrl.active.running && Ctrl.active.running() && Ctrl.active === Game) { var r = Scene.canvas.getBoundingClientRect(); Scene.lookAbs((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1); }
});
window.addEventListener('blur', function () { Ctrl.keys.KeyA = false; Ctrl.keys.KeyD = false; if (Ctrl.active && Ctrl.active.pause && !Scene.locked) Ctrl.active.pause(); });
document.addEventListener('visibilitychange', function () { if (document.hidden) { Ctrl.keys.KeyA = false; Ctrl.keys.KeyD = false; if (Ctrl.active && Ctrl.active.pause) Ctrl.active.pause(); } });
window.addEventListener('resize', function () { if (Scene.ok) Scene.resize(); });

$('#btn-resume').addEventListener('click', function () { if (Ctrl.active && Ctrl.active.resume) Ctrl.active.resume(); });
$('#btn-abandon').addEventListener('click', function () { if (Ctrl.active) Ctrl.active.abandon(false); });
$('#btn-exit').addEventListener('click', function () { location.hash = '#home'; });
$('#btn-fullscreen').addEventListener('click', function () { try { var p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(function () { toast('这个窗口不支持全屏'); }); } catch (e) { toast('这个窗口不支持全屏'); } });
$('#firepad').addEventListener('pointerdown', function (e) { if (e.button !== 0) return; e.preventDefault(); this.classList.add('down'); SelfCheck.push('Mouse L ↓', e.timeStamp); });
$('#firepad').addEventListener('pointerup', function (e) { if (e.button !== 0) return; this.classList.remove('down'); SelfCheck.push('Mouse L ↑', e.timeStamp); });

/* ================= boot ================= */
function start(data) {
  if (data && data.runs && !Object.keys(runs).length) runs = data.runs;
  bindSettings();
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 760) $('#mobile-note').hidden = false;
  route();
}
try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(function () { return { runs: runs }; }); } catch (e) {}
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
