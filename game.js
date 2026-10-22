/* ===========================================================
   بطاقات السيرة — منطق اللعبة
   =========================================================== */

/* ألوان اللاعبين: ستّ درجات متباينة فيما بينها وعن أرضية الصفحة الزرقاء الليلية */
const COLORS = ["#F5C451","#F2766A","#5EDB9A","#4FD3EE","#F59DC2","#B9A4FF"];
const OK_COLOR = "#5EDB9A", NO_COLOR = "#F2766A";
const ACCENT = "#3CCFE6";
const AR     = ["١","٢","٣","٤","٥","٦"];
const ORD    = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس"];
const LEVELS = ["المرحلة الأولى","المرحلة الثانية","المرحلة الثالثة","المرحلة الرابعة",
                "المرحلة الخامسة","المرحلة السادسة","المرحلة السابعة","المرحلة الثامنة"];
const TIERS  = [
  {key:"easy",   label:"سهل"},
  {key:"medium", label:"متوسط"},
  {key:"hard",   label:"صعب"}
];
/* مستوى الصعوبة: «متدرّج» يوزّع المستويات على المراحل، والبقية تثبّت مستوى واحداً */
const DIFFS = [
  {k:"ramp",   label:"متدرّج", note:"سهل ← صعب"},
  {k:"easy",   label:"سهل"},
  {k:"medium", label:"متوسط"},
  {k:"hard",   label:"صعب"}
];
const TOPICS = [
  {k:"",         label:"كل السيرة"},
  {k:"nashaa",   label:"النشأة"},
  {k:"makka",    label:"المرحلة المكية"},
  {k:"hijra",    label:"المرحلة المدنية"},
  {k:"ghazawat", label:"المغازي"},
  {k:"sahaba",   label:"الصحابة الكرام"}
];
const TIMES = [
  {v:5,  label:"٥ ثوانٍ",  note:"سريعة"},
  {v:20, label:"٢٠ ثانية"},
  {v:30, label:"٣٠ ثانية"},
  {v:45, label:"٤٥ ثانية"},
  {v:0,  label:"بلا مؤقّت"}
];
/* متى يتحوّل المؤقّت إلى اللون التحذيري: نسبةً إلى طول الوقت،
   وإلا لم يظهر التحذير أصلاً في الجولات السريعة */
const warnAt = () => qTime <= 10 ? 2 : Math.min(8, Math.round(qTime / 4));

const PREFS_KEY = 'sirah.prefs';
const SEEN_KEY  = 'sirah.seen';
const GAME_KEY  = 'sirah.game';

let nPlayers = 4, nLevels = 4, topic = "", qTime = 30, diff = "ramp";
let useSound = true, hideNote = false, bigText = false, preferFresh = true;
let players = [], level = 0, turn = 0, cards = [], locked = false;
let pools = {}, history = [];
let timerId = null, left = 0, timerCb = null, paused = false, wasTicking = false;
let curOrder = null;
let modalOk = null, modalCancel = null, modalPrev = null;

const $ = id => document.getElementById(id);
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
/* بطاقة زائدة دائماً على عدد اللاعبين، فيختار آخر لاعب أيضاً ولا تُفرض عليه البطاقة الأخيرة */
const cardsPerLevel = () => Math.max(4, nPlayers + 1);
const tierOf = i => diff === "ramp"
  ? Math.min(2, Math.floor(i * 3 / nLevels))
  : TIERS.findIndex(t => t.key === diff);
const qid = q => q.q;
/* تمييز العدد في العربية: ١ مفرد، ٢ مثنّى، ٣–١٠ جمع، و١١ فما فوق مفرد منصوب */
function qN(n){                         // مبتدأ: «فيه ستة أسئلة»
  if(n === 1) return 'سؤال واحد';
  if(n === 2) return 'سؤالان';
  const r = n % 100;
  return toAr(n) + ' ' + (r >= 3 && r <= 10 ? 'أسئلة' : 'سؤالاً');
}
function qOn(n){                        // بعد حرف جرّ: «يجيب على سؤالين»
  if(n === 1) return 'سؤال واحد';
  if(n === 2) return 'سؤالين';
  const r = n % 100;
  return toAr(n) + ' ' + (r >= 3 && r <= 10 ? 'أسئلة' : 'سؤالاً');
}
const mq = q => { try { return window.matchMedia(q).matches; } catch(e){ return false; } };
const narrow  = () => mq('(max-width: 820px)');
const reduced = () => mq('(prefers-reduced-motion: reduce)');

/* ================= التخزين =================
   مجرّد الوصول إلى localStorage يرمي استثناءً في المتصفحات التي تمنع
   بيانات المواقع أو في وضع التصفّح الخاص، فلا بد أن يقع داخل try نفسه. */
function store(kind){
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; }
  catch(e){ return null; }
}
function readJSON(kind, key){
  try { const s = store(kind); return s ? JSON.parse(s.getItem(key) || 'null') : null; }
  catch(e){ return null; }
}
function writeJSON(kind, key, val){
  try { const s = store(kind); if(s) s.setItem(key, JSON.stringify(val)); } catch(e){}
}
function dropKey(kind, key){
  try { const s = store(kind); if(s) s.removeItem(key); } catch(e){}
}

function savePrefs(){
  writeJSON('local', PREFS_KEY,
    { nPlayers, nLevels, topic, qTime, diff, useSound, hideNote, bigText, preferFresh });
}
function loadPrefs(){
  const p = readJSON('local', PREFS_KEY);
  if(!p) return;
  if([1,2,3,4,5,6].includes(p.nPlayers))            nPlayers = p.nPlayers;
  if([2,3,4,5,6,7,8].includes(p.nLevels))           nLevels  = p.nLevels;
  if(TOPICS.some(t => t.k === p.topic))             topic    = p.topic;
  if(TIMES.some(t => t.v === p.qTime))              qTime    = p.qTime;
  if(DIFFS.some(d => d.k === p.diff))               diff     = p.diff;
  if(typeof p.useSound    === 'boolean') useSound    = p.useSound;
  if(typeof p.hideNote    === 'boolean') hideNote    = p.hideNote;
  if(typeof p.bigText     === 'boolean') bigText     = p.bigText;
  if(typeof p.preferFresh === 'boolean') preferFresh = p.preferFresh;
}

function loadSeen(){ return readJSON('local', SEEN_KEY) || {}; }
function markSeen(q){
  if(!preferFresh) return;
  const seen = loadSeen();
  seen[qid(q)] = 1;
  // دار كامل على البنك؟ ابدأ دورة جديدة
  if(Object.keys(seen).length >= bankTotal()) { dropKey('local', SEEN_KEY); return; }
  writeJSON('local', SEEN_KEY, seen);
}
const bankTotal = () => BANK.easy.length + BANK.medium.length + BANK.hard.length;

function saveGame(){
  if(!players.length) return;
  writeJSON('session', GAME_KEY, {
    v:1, nPlayers, nLevels, topic, qTime, diff, useSound, hideNote, bigText, preferFresh,
    players: players.map(p => ({name:p.name, score:p.score, help:p.help, asked:p.asked})),
    level, turn,
    cards: cards.map(c => ({q:c.q, opened:c.opened, by:c.by, ok:c.ok})),
    history
  });
}
const loadGame  = () => readJSON('session', GAME_KEY);
const clearGame = () => dropKey('session', GAME_KEY);

/* ================= شاشة الإعداد ================= */
function buildSegments(){
  $('segPlayers').innerHTML = [1,2,3,4,5,6].map(n =>
    `<button type="button" role="radio" aria-checked="${n===nPlayers}" data-n="${n}" class="${n===nPlayers?'on':''}">${toAr(n)}</button>`).join('');
  $('segLevels').innerHTML = [2,3,4,5,6,7,8].map(n =>
    `<button type="button" role="radio" aria-checked="${n===nLevels}" data-n="${n}" class="${n===nLevels?'on':''}">${toAr(n)}</button>`).join('');
  $('segTime').innerHTML = TIMES.map(t =>
    `<button type="button" role="radio" aria-checked="${t.v===qTime}" data-v="${t.v}" class="${t.v===qTime?'on':''}">` +
    `${t.label}${t.note ? `<small>${t.note}</small>` : ''}</button>`).join('');
  $('segDiff').innerHTML = DIFFS.map(d => {
    // عدد أسئلة المستوى ضمن الموضوع المختار
    const n = d.k === "ramp" ? null : BANK[d.k].filter(q => !topic || q.t === topic).length;
    return `<button type="button" role="radio" aria-checked="${d.k===diff}" data-k="${d.k}" class="${d.k===diff?'on':''}">` +
           `${d.label}<small>${d.note || toAr(n)}</small></button>`;
  }).join('');
  $('segTopic').innerHTML = TOPICS.map(t => {
    const n = t.k ? countTopic(t.k) : bankTotal();
    return `<button type="button" role="radio" aria-checked="${t.k===topic}" data-k="${t.k}" class="${t.k===topic?'on':''}">` +
           `${t.label}<small>${toAr(n)}</small></button>`;
  }).join('');

  $('segPlayers').querySelectorAll('button').forEach(b => b.onclick = () => {
    nPlayers = +b.dataset.n; buildSegments(); buildNames(); updateMeta(); savePrefs();
  });
  $('segLevels').querySelectorAll('button').forEach(b => b.onclick = () => {
    nLevels = +b.dataset.n; buildSegments(); updateMeta(); savePrefs();
  });
  $('segDiff').querySelectorAll('button').forEach(b => b.onclick = () => {
    diff = b.dataset.k; buildSegments(); updateMeta(); savePrefs();
  });
  $('segTime').querySelectorAll('button').forEach(b => b.onclick = () => {
    qTime = +b.dataset.v; buildSegments(); savePrefs();
  });
  $('segTopic').querySelectorAll('button').forEach(b => b.onclick = () => {
    topic = b.dataset.k; buildSegments(); updateMeta(); savePrefs();
  });
}

const countTopic = k => TIERS.reduce((s,t) => s + BANK[t.key].filter(q => q.t === k).length, 0);

function buildNames(){
  const old = Array.from({length:6}, (_,i) => { const el = $('pn'+i); return el ? el.value : ''; });
  $('players').innerHTML = Array.from({length:nPlayers}, (_,i) => `
    <label class="pfield" style="--pc:${COLORS[i]}">
      <span class="dot">${AR[i]}</span>
      <input id="pn${i}" maxlength="14" placeholder="اللاعب ${ORD[i]}" autocomplete="off" value="${esc(old[i] || '')}">
    </label>`).join('');
}

function updateMeta(){
  const tiers = Array.from({length:nLevels}, (_,i) => TIERS[tierOf(i)].label);
  $('meta').innerHTML = `كل لاعب يجيب على <b>${qOn(nLevels)}</b> — ` + (diff === "ramp"
    ? `تسلسل المراحل: <b>${tiers.join(' ← ')}</b>`
    : `كل المراحل بمستوى: <b>${tiers[0]}</b>`);
  updateTopicWarn();
}

function updateTopicWarn(){
  const el = $('topicWarn');
  if(!topic){ el.hidden = true; return; }
  const per = cardsPerLevel();
  // كم بطاقة تحتاجها الجولة كلها من كل مستوى
  const demand = {};
  for(let i = 0; i < nLevels; i++){
    const k = TIERS[tierOf(i)].key;
    demand[k] = (demand[k] || 0) + per;
  }
  const msgs = [];
  TIERS.forEach(t => {
    if(!demand[t.key]) return;
    const have = BANK[t.key].filter(q => q.t === topic).length;
    if(have < per)
      msgs.push(`مستوى «${t.label}» فيه ${qN(have)} فقط، فستُكمَّل البطاقات الناقصة من أسئلة هذا الباب في المستويات الأخرى`);
    else if(have < demand[t.key])
      msgs.push(`مستوى «${t.label}» فيه ${qN(have)} وتحتاج الجولة ${toAr(demand[t.key])}، فسيتكرّر بعضها في المراحل اللاحقة`);
  });
  el.hidden = msgs.length === 0;
  if(msgs.length) el.textContent = msgs.join('. ') + '.';
}

function bindChip(id, get, set){
  const el = $(id);
  el.classList.toggle('on', get());
  el.setAttribute('aria-checked', String(get()));
  el.onclick = () => {
    const v = !get();
    set(v);
    el.classList.toggle('on', v);
    el.setAttribute('aria-checked', String(v));
    savePrefs();
  };
}

/* ================= إدارة بنك الأسئلة ================= */
function poolFor(tierKey){
  const all = BANK[tierKey];
  if(!topic) return all;
  const f = all.filter(q => q.t === topic);
  return f.length ? f : all;
}
function orderPool(list){
  const s = shuffle(list);
  if(!preferFresh) return s;
  const seen = loadSeen();
  return s.filter(q => !seen[qid(q)]).concat(s.filter(q => seen[qid(q)]));
}
function newPools(){
  pools = {};
  TIERS.forEach(t => { pools[t.key] = orderPool(poolFor(t.key)); });
}

/* يُرجع `count` سؤالاً مختلفاً — لا تكرار داخل المرحلة الواحدة أبداً */
function draw(tierKey, count){
  const used = new Set(), out = [];
  const pull = src => {
    while(out.length < count && src.length){
      const q = src.shift();
      if(!q || used.has(qid(q))) continue;
      used.add(qid(q)); out.push(q);
    }
  };
  if(!pools[tierKey]) pools[tierKey] = orderPool(poolFor(tierKey));
  pull(pools[tierKey]);                                   // المخزون الجاري
  if(out.length < count){                                 // نفد: أعِد خلط الباب، فتتكرّر أسئلته
    pools[tierKey] = orderPool(poolFor(tierKey));
    pull(pools[tierKey]);
  }
  if(out.length < count && topic){                        // المستوى أصغر من عدد البطاقات:
    pull(shuffle(TIERS.flatMap(t => BANK[t.key].filter(q => q.t === topic))));   // من الباب نفسه أولاً
  }
  if(out.length < count) pull(shuffle(BANK[tierKey]));     // احتياط أخير
  return out;
}

/* ================= سير اللعب ================= */
$('start').onclick = () => {
  players = Array.from({length:nPlayers}, (_,i) => ({
    name: ($('pn'+i).value || '').trim() || ('اللاعب ' + ORD[i]),
    color: COLORS[i],
    score: 0,
    asked: 0,
    help: true          // مساعدة واحدة في اللعبة كاملة، لا تتجدد مع المراحل
  }));
  history = [];
  newPools();
  level = 0;
  hideResume();
  startLevel();
};

function startLevel(){
  turn = 0;
  locked = false;
  const tier = TIERS[tierOf(level)];
  cards = draw(tier.key, cardsPerLevel()).map(q => ({q, opened:false, by:null, ok:false}));
  show('game');
  renderHUD(); renderScores(); renderBoard(); renderTurn();
  saveGame();
  flash(LEVELS[level], `مستوى ${tier.label} — ${toAr(nPlayers)} ${nPlayers===1?'لاعب':'لاعبين'}`, 1500);
}

function renderHUD(){
  const tier = TIERS[tierOf(level)];
  const tp = TOPICS.find(t => t.k === topic);
  $('stage').innerHTML =
    `${LEVELS[level]}<span class="tag t${tierOf(level)}">${tier.label}</span>` +
    `<small>المرحلة ${toAr(level+1)} من ${toAr(nLevels)}${topic ? ' · ' + esc(tp.label) : ''}</small>`;
  $('rail').innerHTML = Array.from({length:nLevels}, (_,i) =>
    `<span class="bar ${i<level?'done':''} ${i===level?'now':''}"></span>`).join('');
}

function renderScores(){
  $('scores').innerHTML = players.map((p,i) => `
    <div class="sc ${i===turn?'active':''}" style="--pc:${p.color}">
      <span class="av">${AR[i]}</span>
      <span class="nm">${esc(p.name)}</span>
      <span class="lf ${p.help ? '' : 'used'}" title="${p.help ? 'مساعدة متاحة' : 'استُخدمت المساعدة'}">50:50</span>
      <span class="pt">${toAr(p.score)}</span>
    </div>`).join('');
}

function renderTurn(){
  const p = players[turn];
  if(!p) return;
  $('turnbar').innerHTML =
    `<span>الدور الآن لـ <b style="--tc:${p.color}">${esc(p.name)}</b> — اختر بطاقة</span>`;
}

function renderBoard(){
  const n = cardsPerLevel();
  const cols = n <= 4 ? n : Math.ceil(n / 2);
  $('board').style.gridTemplateColumns = narrow()
    ? 'repeat(2, 1fr)'
    : `repeat(${Math.min(cols,4)}, 1fr)`;

  $('board').innerHTML = cards.map((c,i) => {
    if(!c.opened) return `
      <button class="card" data-i="${i}" aria-label="بطاقة رقم ${toAr(i+1)}">
        <div class="inner">
          <div class="face back">
            <span class="num">${String(i+1).padStart(2,'0')}</span>
            <svg viewBox="0 0 100 100" fill="none" stroke="${ACCENT}" stroke-width="2.5" aria-hidden="true">
              <rect x="20" y="20" width="60" height="60"/>
              <rect x="20" y="20" width="60" height="60" transform="rotate(45 50 50)"/>
              <circle cx="50" cy="50" r="15"/><circle cx="50" cy="50" r="4" fill="${ACCENT}"/>
            </svg>
          </div>
          <div class="face front"></div>
        </div>
      </button>`;
    const p = players[c.by] || {name:'', color:'#7F9DBA'};
    const col = c.ok ? OK_COLOR : NO_COLOR;
    return `
      <button class="card flipped" disabled data-i="${i}"
        aria-label="بطاقة ${toAr(i+1)} — ${esc(p.name)} ${c.ok ? 'أصاب' : 'أخطأ'}">
        <div class="inner">
          <div class="face back"></div>
          <div class="face front" style="--fc:${col};--wc:${p.color}">
            <span class="mark" aria-hidden="true">${c.ok ? '✔' : '✕'}</span>
            <span class="res">${c.ok ? 'نقطة' : 'بلا نقطة'}</span>
            <span class="who">${esc(p.name)}</span>
          </div>
        </div>
      </button>`;
  }).join('');

  $('board').querySelectorAll('.card:not([disabled])')
    .forEach(b => b.onclick = () => openCard(+b.dataset.i));
}

function openCard(i){
  if(locked || paused) return;
  locked = true;
  const el = $('board').querySelector(`.card[data-i="${i}"]`);
  el.classList.add('flipped');
  el.disabled = true;
  setTimeout(() => askQuestion(i), 380);
}

function askQuestion(i){
  const q = cards[i].q, p = players[turn];
  if(!p){ locked = false; return; }
  markSeen(q);
  $('qwho').innerHTML = `<span class="av" style="--tc:${p.color}">${AR[turn]}</span> ${esc(p.name)}`;
  $('qtext').textContent = q.q;
  $('verdict').classList.remove('on');

  const order = shuffle(q.a.map((t,k) => ({t, ok: k === q.c})));
  $('answers').innerHTML = order.map((o,k) =>
    `<button class="ans" data-k="${k}"><span class="k">${AR[k]}</span><span>${esc(o.t)}</span></button>`).join('');
  $('answers').querySelectorAll('.ans').forEach(b =>
    b.onclick = () => answer(i, order, +b.dataset.k));

  setupLifeline(order);
  openOverlay();
  startTimer(() => answer(i, order, -1));
}

/* ================= النافذة والتركيز ================= */
function openOverlay(){
  $('overlay').classList.add('on');
  $('overlay').setAttribute('aria-hidden', 'false');
  $('wrap').setAttribute('inert', '');
  $('wrap').setAttribute('aria-hidden', 'true');
  document.body.classList.add('locked');
  const first = $('answers').querySelector('.ans');
  if(first) first.focus();
}
function closeOverlay(){
  stopTimer();
  $('overlay').classList.remove('on');
  $('overlay').setAttribute('aria-hidden', 'true');
  $('wrap').removeAttribute('inert');
  $('wrap').removeAttribute('aria-hidden');
  if(!$('modal').classList.contains('on')) document.body.classList.remove('locked');
}

function trapTab(e, box){
  if(e.key !== 'Tab') return;
  const list = [...box.querySelectorAll('button:not([disabled]),input,select,textarea,[href]')]
    .filter(el => el.offsetWidth || el.offsetHeight || el === document.activeElement);
  if(!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
}

/* ================= نافذة الرسائل / التأكيد ================= */
function openModal(o){
  $('mtitle').textContent = o.title;
  $('mtext').textContent  = o.text || '';
  $('mok').textContent     = o.ok || 'حسناً';
  $('mcancel').textContent = o.cancel || '';
  $('mcancel').style.display = o.cancel ? '' : 'none';
  modalOk = o.onOk || closeModal;
  modalCancel = o.onCancel || closeModal;
  modalPrev = document.activeElement;
  if($('overlay').classList.contains('on')) $('overlay').setAttribute('inert', '');
  $('wrap').setAttribute('inert', '');
  $('modal').classList.add('on');
  $('modal').setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
  $('mok').focus();
}
function closeModal(){
  $('modal').classList.remove('on');
  $('modal').setAttribute('aria-hidden', 'true');
  $('overlay').removeAttribute('inert');
  if(!$('overlay').classList.contains('on')){
    $('wrap').removeAttribute('inert');
    document.body.classList.remove('locked');
  }
  if(modalPrev && modalPrev.focus) { try { modalPrev.focus(); } catch(e){} }
}
$('mok').onclick     = () => { const f = modalOk;     if(f) f(); };
$('mcancel').onclick = () => { const f = modalCancel; if(f) f(); };

/* ================= الإيقاف المؤقّت ================= */
function doPause(){
  if(paused || !$('game').classList.contains('on')) return;
  paused = true;
  wasTicking = timerId !== null;
  stopTimer();
  freezeBar();
  openModal({
    title: 'اللعبة متوقفة',
    text : 'السؤال مخفيّ حتى الاستئناف — والمؤقّت واقف.',
    ok   : 'استئناف اللعب',
    onOk : doResume
  });
}
function doResume(){
  paused = false;
  closeModal();
  if(wasTicking){ unfreezeBar(); runTimer(); }
  wasTicking = false;
}
function freezeBar(){
  const fill = $('tfill');
  fill.style.transition = 'none';
  fill.style.transform = `scaleX(${qTime ? Math.max(left,0)/qTime : 1})`;
}
function unfreezeBar(){
  const fill = $('tfill');
  requestAnimationFrame(() => { fill.style.transition = 'transform 1s linear'; });
}
$('pause').onclick  = doPause;
$('pauseQ').onclick = doPause;

/* ================= إنهاء الجولة ================= */
$('quit').onclick = () => openModal({
  title : 'إنهاء الجولة؟',
  text  : 'ستُعرض النتيجة على ما لُعب حتى الآن، مع مراجعة الأسئلة.',
  ok    : 'إنهاء وعرض النتيجة',
  cancel: 'متابعة اللعب',
  onOk  : () => { closeModal(); closeOverlay(); locked = false; finish(); },
  onCancel: closeModal
});

/* ================= المساعدة: حذف إجابتين خاطئتين ================= */
function setupLifeline(order){
  curOrder = order;
  const p = players[turn];
  $('lifewrap').style.display = 'flex';
  $('lifeline').disabled = !p.help;
  $('lifetext').textContent = p.help ? 'احذف إجابتين خاطئتين' : 'استُخدمت مساعدتك';
}

function useLifeline(){
  const p = players[turn];
  if(!p || !p.help || !curOrder || paused) return;
  if($('verdict').classList.contains('on')) return;   // بعد الإجابة لا مساعدة
  p.help = false;

  const wrong = shuffle(curOrder.map((o,k) => o.ok ? -1 : k).filter(k => k >= 0));
  const btns = $('answers').querySelectorAll('.ans');
  wrong.slice(0, 2).forEach(k => {
    if(btns[k]){ btns[k].classList.add('gone'); btns[k].disabled = true; }
  });

  $('lifeline').disabled = true;
  $('lifetext').textContent = 'حُذفت إجابتان';
  renderScores();
  saveGame();
}
$('lifeline').addEventListener('click', useLifeline);

/* ================= المؤقّت ================= */
function startTimer(onEnd){
  stopTimer();
  timerCb = onEnd;
  const fill = $('tfill'), clock = $('clock');
  fill.classList.remove('warn'); clock.classList.remove('warn');
  if(!qTime){
    clock.style.display = 'none';
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    return;
  }
  clock.style.display = '';
  left = qTime;
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(1)';
  clock.textContent = toAr(left);
  requestAnimationFrame(() => { fill.style.transition = 'transform 1s linear'; });
  runTimer();
}
function runTimer(){
  stopTimer();
  if(!qTime) return;
  timerId = setInterval(tick, 1000);
}
function stopTimer(){
  if(timerId){ clearInterval(timerId); timerId = null; }
}
function tick(){
  left--;
  const fill = $('tfill'), clock = $('clock');
  clock.textContent = toAr(Math.max(left, 0));
  fill.style.transform = `scaleX(${Math.max(left,0)/qTime})`;
  if(left === warnAt()){ fill.classList.add('warn'); clock.classList.add('warn'); }
  if(left <= 0){
    stopTimer();
    const cb = timerCb; timerCb = null;
    if(cb) cb();
  }
}

/* ================= الإجابة ================= */
function answer(i, order, pick){
  stopTimer();
  timerCb = null;
  $('lifewrap').style.display = 'none';
  const btns = [...$('answers').querySelectorAll('.ans')];
  btns.forEach(b => b.disabled = true);

  const correctIdx = order.findIndex(o => o.ok);
  const ok = pick === correctIdx;
  btns[correctIdx].classList.add('right');
  if(pick >= 0 && !ok) btns[pick].classList.add('wrong');

  const p = players[turn];
  p.asked++;
  if(ok) p.score++;
  cards[i].opened = true;
  cards[i].by = turn;
  cards[i].ok = ok;
  history.push({ lv: level, pi: turn, q: cards[i].q, ok, picked: pick >= 0 ? order[pick].t : null });

  $('vhead').className = 'vhead ' + (ok ? 'good' : 'bad');
  $('vhead').textContent = ok
    ? `أحسنت يا ${p.name} — نقطة لك!`
    : (pick < 0 ? 'انتهى الوقت!' : 'إجابة غير صحيحة');
  $('note').textContent = hideNote ? '' : (cards[i].q.n || '');
  $('verdict').classList.add('on');
  beep(ok);
  renderScores();
  saveGame();
  $('next').focus();
}

$('next').onclick = () => {
  closeOverlay();
  turn++;
  if(turn >= nPlayers){
    level++;
    if(level >= nLevels){ finish(); return; }
    renderBoard();                       // locked يبقى مفعّلاً حتى تبدأ المرحلة
    const tier = TIERS[tierOf(level)];
    flash(LEVELS[level], `مستوى ${tier.label}`, 1500, startLevel);
    return;
  }
  locked = false;
  renderBoard(); renderScores(); renderTurn();
  saveGame();
};

/* ================= لوحة المفاتيح ================= */
document.addEventListener('keydown', e => {
  if($('modal').classList.contains('on')){
    trapTab(e, $('modal'));
    if(e.key === 'Escape' && $('mcancel').style.display !== 'none'){
      e.preventDefault(); $('mcancel').click();
    }
    return;
  }
  if(e.key === 'p' || e.key === 'P' || e.key === 'ط'){
    if($('game').classList.contains('on')){ e.preventDefault(); doPause(); }
    return;
  }
  if(!$('overlay').classList.contains('on')) return;
  trapTab(e, $('overlay'));

  if(e.key === 'Enter' && $('verdict').classList.contains('on')){
    e.preventDefault();                  // وإلا فعّل المتصفح الزر مرة ثانية فتُتخطّى نوبة لاعب
    $('next').click();
    return;
  }
  if(e.key === 'h' || e.key === 'H' || e.key === 'ا'){
    const btn = $('lifeline');
    if($('lifewrap').style.display !== 'none' && !btn.disabled){ e.preventDefault(); btn.click(); }
    return;
  }
  const k = AR.indexOf(e.key) >= 0 ? AR.indexOf(e.key) : (+e.key - 1);
  if(k >= 0 && k <= 3){
    const b = $('answers').querySelectorAll('.ans')[k];
    if(b && !b.disabled){ e.preventDefault(); b.click(); }
  }
});

/* ================= الفاصل والنتائج ================= */
function flash(big, sub, ms, then){
  $('flashBig').textContent = big;
  $('flashSub').textContent = sub;
  $('flash').classList.add('on');
  setTimeout(() => { $('flash').classList.remove('on'); if(then) then(); }, ms);
}

function finish(){
  clearGame();
  // الترتيب بالنسبة أولاً: عند الإنهاء المبكّر قد يختلف عدد أسئلة اللاعبين
  const ranked = players.map((p,i) => ({...p, idx:i, pct: p.asked ? Math.round(p.score / p.asked * 100) : 0}))
                        .sort((a,b) => (b.asked > 0) - (a.asked > 0) || b.pct - a.pct || b.score - a.score);
  const played = ranked.filter(p => p.asked > 0);
  // لا نجمة إن تساوى الجميع أو لم يلعب أحد
  const hasWinner = played.length > 1 && played.some(p => p.pct < played[0].pct);
  const total = players.reduce((s,p) => s + p.score, 0);
  const asked = players.reduce((s,p) => s + p.asked, 0);
  const overall = asked ? Math.round(total / asked * 100) : 0;

  $('resTitle').textContent = nPlayers === 1 ? 'نتيجتك' : 'النتيجة النهائية';
  $('resSub').textContent = nPlayers === 1
    ? `أجبت على ${qOn(asked)} — نسبتك ${toAr(overall)}٪`
    : `مجموع الإجابات الصحيحة ${toAr(total)} من ${toAr(asked)} — نسبة المجموعة ${toAr(overall)}٪`;

  let place = 0, prev = null;
  $('podium').innerHTML = ranked.map((p,i) => {
    if(p.pct !== prev){ place = i + 1; prev = p.pct; }
    const top = hasWinner && place === 1 && p.asked > 0;
    return `<div class="row ${top ? 'first' : ''}" style="--pc:${p.color}">
      <span class="rank">${top ? '★' : (p.asked ? AR[place-1] : '—')}</span>
      <span class="rname"><span class="av">${AR[p.idx]}</span>${esc(p.name)}
        ${p.asked && p.help ? '<span class="kept">لم يستخدم مساعدته</span>' : ''}</span>
      <span class="pct">${p.asked ? toAr(p.pct) + '٪' : '—'}<small>${
        p.asked ? toAr(p.score) + ' من ' + toAr(p.asked) : 'لم يلعب'}</small></span>
      <span class="track"><i data-w="${p.asked ? p.pct : 0}"></i></span>
    </div>`;
  }).join('');

  renderReview();
  show('results');
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    $('podium').querySelectorAll('.track i').forEach(el => el.style.width = el.dataset.w + '%');
  });
  if(played.length && played[0].pct >= 50) confetti();
}

function renderReview(){
  const onlyWrong = $('rvToggle').getAttribute('aria-pressed') === 'true';
  const list = onlyWrong ? history.filter(h => !h.ok) : history;
  $('rvToggle').textContent = onlyWrong ? 'الأخطاء فقط' : 'كل الأسئلة';

  if(!list.length){
    $('rvlist').innerHTML = `<p class="rvempty">${
      onlyWrong ? 'ما وقع خطأ واحد — أحسنتم!' : 'لم يُجب على أي سؤال بعد.'}</p>`;
    return;
  }
  $('rvlist').innerHTML = list.map(h => {
    const p = players[h.pi] || {name:'', color:'#7F9DBA'};
    const correct = h.q.a[h.q.c];
    return `<div class="rv" style="--pc:${p.color};--rc:${h.ok ? OK_COLOR : NO_COLOR}">
      <div class="top"><span class="av">${AR[h.pi]}</span>${esc(p.name)} · ${LEVELS[h.lv]} · ${TIERS[tierOf(h.lv)].label}</div>
      <div class="q">${esc(h.q.q)}</div>
      <div class="ok">الإجابة الصحيحة: ${esc(correct)}</div>
      ${h.ok ? '' : `<div class="no">${h.picked === null ? 'انتهى الوقت دون إجابة' : 'اختار: ' + esc(h.picked)}</div>`}
      ${h.q.n ? `<div class="nt">${esc(h.q.n)}</div>` : ''}
    </div>`;
  }).join('');
}

$('rvToggle').onclick = () => {
  const now = $('rvToggle').getAttribute('aria-pressed') === 'true';
  $('rvToggle').setAttribute('aria-pressed', String(!now));
  renderReview();
};

$('again').onclick = () => {
  players.forEach(p => { p.score = 0; p.asked = 0; p.help = true; });
  history = [];
  newPools();
  level = 0;
  startLevel();
};
$('reset').onclick = () => { clearGame(); show('setup'); window.scrollTo(0, 0); };

function confetti(){
  if(reduced()) return;
  for(let i = 0; i < 70; i++){
    const d = document.createElement('div');
    d.className = 'conf';
    d.style.background = COLORS[i % COLORS.length];
    d.style.insetInlineStart = Math.random() * 100 + 'vw';
    d.style.animation = `fall ${2.4 + Math.random()*2}s ${Math.random()*1.2}s ease-in forwards`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6500);
  }
}

/* ================= الصوت ================= */
let actx;
function beep(ok){
  if(!useSound) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === 'suspended') actx.resume();
    const notes = ok ? [523, 659, 784] : [220, 175];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      const t0 = actx.currentTime + i * 0.11;
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + 0.32);
    });
  }catch(e){}
}

/* ================= استئناف جولة غير مكتملة ================= */
function hideResume(){ $('resumeBar').classList.remove('on'); }

function offerResume(){
  const s = loadGame();
  if(!s || s.v !== 1 || !s.players || !s.players.length || s.level >= s.nLevels) return;
  const tp = TOPICS.find(t => t.k === s.topic);
  $('resumeInfo').textContent =
    `${toAr(s.players.length)} ${s.players.length === 1 ? 'لاعب' : 'لاعبين'} · ` +
    `المرحلة ${toAr(s.level + 1)} من ${toAr(s.nLevels)}${tp && tp.k ? ' · ' + tp.label : ''}`;
  $('resumeBar').classList.add('on');
  $('resumeGo').onclick   = () => restore(s);
  $('resumeDrop').onclick = () => { clearGame(); hideResume(); };
}

function restore(s){
  nPlayers = s.nPlayers; nLevels = s.nLevels; topic = s.topic; qTime = s.qTime;
  diff = DIFFS.some(d => d.k === s.diff) ? s.diff : "ramp";   // الجولات المحفوظة قبل الميزة
  useSound = s.useSound; hideNote = s.hideNote; preferFresh = s.preferFresh;
  setBig(!!s.bigText);
  players = s.players.map((p,i) => ({ ...p, color: COLORS[i], asked: p.asked || 0 }));
  level = s.level; turn = s.turn; history = s.history || [];
  cards = (s.cards || []).map(c => ({ q:c.q, opened:c.opened, by:c.by, ok:c.ok }));

  newPools();                                   // لا تُعِد طرح ما سُئل في هذه الجولة
  const done = new Set(history.map(h => qid(h.q)));
  cards.forEach(c => done.add(qid(c.q)));
  Object.keys(pools).forEach(k => { pools[k] = pools[k].filter(q => !done.has(qid(q))); });

  locked = false;
  hideResume();
  buildSegments(); buildNames(); updateMeta();
  show('game');
  renderHUD(); renderScores(); renderBoard(); renderTurn();
  window.scrollTo(0, 0);
}

function setBig(v){
  bigText = v;
  document.body.classList.toggle('big', v);
  const el = $('chipBig');
  el.classList.toggle('on', v);
  el.setAttribute('aria-checked', String(v));
}

/* ================= التشغيل ================= */
function fatal(msg){
  const box = document.querySelector('#setup .panel');
  if(!box) return;
  box.innerHTML =
    `<h2>تعذّر تحميل اللعبة</h2>` +
    `<p class="hint">${esc(msg)}</p>` +
    `<div class="center"><button class="btn" id="retry" type="button">أعد المحاولة</button></div>`;
  // بلا onclick داخل السطر: سياسة أمان المحتوى تمنع النصوص المضمّنة
  const b = document.getElementById('retry');
  if(b) b.addEventListener('click', () => location.reload());
}

function boot(){
  if(typeof BANK === 'undefined' || !BANK.easy || !BANK.medium || !BANK.hard){
    fatal('لم يصل ملف الأسئلة (questions.js). تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.');
    return;
  }
  loadPrefs();
  setBig(bigText);
  bindChip('chipSound', () => useSound,    v => useSound = v);
  bindChip('chipNote',  () => hideNote,    v => hideNote = v);
  bindChip('chipFresh', () => preferFresh, v => preferFresh = v);
  $('chipBig').classList.toggle('on', bigText);
  $('chipBig').setAttribute('aria-checked', String(bigText));
  $('chipBig').onclick = () => { setBig(!bigText); savePrefs(); };

  $('bankCount').textContent = toAr(bankTotal());
  buildSegments();
  buildNames();
  updateMeta();
  offerResume();

  let lastNarrow = narrow();
  window.addEventListener('resize', () => {
    const n = narrow();
    if(n === lastNarrow) return;   // تغيّر الارتفاع فقط (شريط عنوان الجوال) — لا تُعِد بناء اللوح
    lastNarrow = n;
    if($('game').classList.contains('on') && !$('overlay').classList.contains('on')) renderBoard();
  });

  if('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

try { boot(); } catch(e){
  console.error('بطاقات السيرة — خطأ في التشغيل:', e);
  fatal('حدث خطأ غير متوقّع أثناء التشغيل.');
}
