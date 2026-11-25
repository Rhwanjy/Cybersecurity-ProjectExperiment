'use strict';

// Interface translations are separate from the bilingual checklist maintained in data/.
const strings = {
  company:['EgyptAir','مصر للطيران'], subtitle:['Cybersecurity Audit Checklist','قائمة تدقيق الأمن السيبراني'],
  intro:['A simulated cybersecurity assessment of EgyptAir, Egypt’s national airline.','تقييم محاكاة للأمن السيبراني لشركة مصر للطيران، الناقل الوطني المصري.'],
  total:['Total items','إجمالي البنود'], reviewed:['Reviewed','تمت المراجعة'], pass:['Control in place','الضابط مطبّق'],
  gap:['Gap found','فجوة قائمة'], uncertain:['Unconfirmed','غير مؤكد'], pending:['Awaiting review','بانتظار المراجعة'],
  checklist:['Checklist','قائمة التدقيق'], register:['Gap Register','سجل الفجوات'],
  order:['Highest risk first, then shortest deadline.','الأعلى خطورة أولًا، ثم الأقرب موعدًا.'],
  noGaps:['No active gaps recorded.','لا توجد فجوات نشطة مسجّلة.'],
  empty:['No checklist items to show.','لا توجد بنود لعرضها.'], add:['Add item','إضافة بند'],
  hide:['Hide completed','إخفاء البنود المكتملة'], details:['Interview details','تفاصيل المقابلة'],
  example:['Clarification example','مثال توضيحي'], actions:['Action items','الإجراءات المطلوبة'],
  why:['Justification','المبرر'], standard:['Standard & Control','المعيار والضابط'],
  comment:['Comments','التعليقات'], record:['Record outcome','تسجيل النتيجة'], outcome:['Outcome','النتيجة'],
  edit:['Edit item','تعديل البند'], remove:['Delete item','حذف البند'],
  review:['Mark reviewed','تحديد كمُراجَع'], reopen:['Reopen','إعادة فتح'],
  risk:['Risk','الخطورة'], urgency:['Urgency','الأولوية الزمنية'], high:['High','مرتفعة'],
  medium:['Medium','متوسطة'], low:['Low','منخفضة'], immediate:['Immediate','فوري'],
  days:['days','يومًا'], title:['Title','العنوان'], domain:['Domain','المجال'], question:['Audit question','سؤال التدقيق'],
  id:['Item ID','معرّف البند'], name:['Standard name and edition','اسم المعيار وإصداره'],
  clause:['Clause / control ID','رقم البند أو الضابط'], excerpt:['Relevant excerpt','المقتطف ذي الصلة'],
  url:['Source URL','رابط المصدر'], type:['Excerpt status','حالة المقتطف'],
  verified:['Verified excerpt (English) / Arabic translation','مقتطف إنجليزي موثّق / ترجمة عربية'],
  paraphrase:['Paraphrase','إعادة صياغة'], unverified:['Needs verification','يحتاج إلى تحقق'],
  source:['Open ICAO source excerpt','فتح مصدر المقتطف من الإيكاو'], publication:['Full publication URL','رابط الإصدار الكامل'], full:['View full publication','عرض الإصدار الكامل'], close:['Close','إغلاق'], save:['Save','حفظ'],
  cancel:['Cancel','إلغاء'], gapText:['Gap description','وصف الفجوة'], follow:['Follow-up action','إجراء المتابعة'],
  editGap:['Edit gap','تعديل الفجوة'], duplicate:['This item ID already exists.','معرّف البند مستخدم بالفعل.'],
  confirm:['Delete this item and its saved comments or gap?','هل تريد حذف هذا البند وتعليقاته أو فجوته المسجّلة؟'],
  loadError:['Could not load the checklist. Refresh to try again.','تعذّر تحميل القائمة. أعد تحميل الصفحة للمحاولة مرة أخرى.'],
  storageError:['Browser storage is unavailable. Changes will only last while this page is open.','تخزين المتصفح غير متاح. تستمر التغييرات ما دامت هذه الصفحة مفتوحة.']
};
const storageKey = 'egyptair-audit-v1';
const modal = document.querySelector('#modal');
const notice = document.querySelector('#notice');
const rank = {high: 3, medium: 2, low: 1};
let state;
let storageFailed = false;
let openedDetails = new Set();
// Entrance animations run on first load and after a language switch, never after routine edits.
let animateEntrance = true;
// The item whose outcome or review state just changed gets a departure-board flip.
let flipId = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Escape all user-entered text before inserting markup. Restrict references to web URLs.
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const direction = lang => lang === 'ar' ? 'rtl' : 'ltr';
const t = key => strings[key][state.lang === 'ar' ? 1 : 0];
const localized = pair => escape(pair?.[state.lang]);
function webUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

// Shared seed data initializes a browser once. All edits and findings stay browser-local.
async function start() {
  try {
    try { state = JSON.parse(localStorage.getItem(storageKey)); } catch { storageFailed = true; }
    if (!Array.isArray(state?.items)) {
      const response = await fetch('./data/checklist.json');
      if (!response.ok) throw new Error('Checklist fetch failed');
      state = {lang:'en', hide:false, items:await response.json()};
    }
    render();
  } catch {
    notice.textContent = strings.loadError.join(' / ');
    notice.hidden = false;
  }
}

// A single save operation keeps checklist, summary, and register in sync.
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { storageFailed = true; }
  render();
}

const button = (action, key, id = '', classes = '') =>
  `<button type="button" data-action="${action}" data-id="${escape(id)}" class="${classes}">${t(key)}</button>`;
const deadline = days => days === 0 ? t('immediate') : `${days} ${t('days')}`;
const label = (key, value) => `<section><small>${t(key)}</small><p class="preserve">${value}</p></section>`;
const outcomeClass = outcome => outcome ? `${outcome}-tone` : '';
const status = item => `<span class="pill ${outcomeClass(item.outcome)} ${item.id === flipId ? 'flip' : ''}">${t(item.outcome || (item.reviewed ? 'reviewed' : 'pending'))}</span>`;
const badge = (key, value) => `<span class="pill">${t(key)} · ${value}</span>`;
const planeIcon = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#plane"/></svg>';
const riskKey = risk => rank[risk] ? risk : 'medium';

// The checklist and register always render from the same item records.
function card(item, index = 0) {
  return `<article class="card ${animateEntrance ? 'enter' : ''}" data-risk="${riskKey(item.risk)}" style="--i:${Math.min(index, 8)}">
    <div class="row pass-head"><small class="pass-id">${planeIcon}<bdi>${escape(item.id)}</bdi><span>· ${localized(item.domain)}</span></small>${status(item)}</div>
    <h3>${localized(item.title)}</h3>
    <p class="question">${localized(item.question)}</p>
    <div class="meta">${badge('risk', t(item.risk))}${badge('urgency', deadline(item.days))}
      ${item.reviewed ? `<span class="pill">${t('reviewed')}</span>` : ''}</div>
    ${button('source', 'standard', item.id, 'reference')}
    <details data-record="${escape(item.id)}" ${openedDetails.has(item.id) ? 'open' : ''}><summary>${t('details')}</summary>
      ${label('example',localized(item.example))}${label('actions',localized(item.actions))}${label('why',localized(item.why))}
    </details>
    ${item.comment ? label('comment',`<bdi>${escape(item.comment)}</bdi>`) : ''}
    <div class="card-actions">${button('outcome','record',item.id,'primary')}${button('review',item.reviewed?'reopen':'review',item.id)}
      ${button('comment','comment',item.id)}${button('edit','edit',item.id)}${button('delete','remove',item.id,'danger')}</div>
  </article>`;
}

function gapCard(item) {
  return `<article class="gap ${animateEntrance ? 'enter' : ''}"><div class="row"><small><bdi>${escape(item.id)}</bdi></small>${status(item)}</div>
    <h3>${localized(item.title)}</h3><div class="meta">${badge('risk',t(item.risk))}${badge('urgency',deadline(item.days))}</div>
    ${label('gapText',`<bdi>${escape(item.gapText)}</bdi>`)}${label('follow',`<bdi>${escape(item.follow)}</bdi>`)}
    ${button('outcome','editGap',item.id)}</article>`;
}

function render() {
  // Preserve expanded clarification panels when the interface rerenders.
  for (const detail of document.querySelectorAll('details[data-record]')) {
    if (detail.open) openedDetails.add(detail.dataset.record);
    else openedDetails.delete(detail.dataset.record);
  }
  document.documentElement.lang = state.lang;
  document.documentElement.dir = direction(state.lang);
  document.title = `${t('company')} | ${t('subtitle')}`;
  notice.hidden = !storageFailed;
  notice.textContent = storageFailed ? t('storageError') : '';
  document.querySelector('#hero').innerHTML = `<div><h1>${t('company')}</h1><p class="subtitle">${t('subtitle')}</p>
    <p>${t('intro')}</p></div><div class="switch" dir="ltr">
    <button lang="en" data-action="lang" data-id="en" aria-pressed="${state.lang==='en'}">English</button>
    <button lang="ar" data-action="lang" data-id="ar" aria-pressed="${state.lang==='ar'}">العربية</button></div>`;
  const items = state.items;
  const reviewed = items.filter(item => item.reviewed).length;
  // Numeric deadlines and risk enums make sorting independent of display language.
  const gaps = items.filter(item => item.outcome === 'gap').sort((a,b) =>
    rank[b.risk] - rank[a.risk] || a.days - b.days || a.id.localeCompare(b.id, 'en'));
  const metrics = [['total',items.length],['reviewed',reviewed],['pass',items.filter(i=>i.outcome==='pass').length],
    ['gap',gaps.length],['uncertain',items.filter(i=>i.outcome==='uncertain').length]];
  document.querySelector('#summary').innerHTML = `<div class="metrics">
    ${metrics.map(([key,count])=>`<div class="metric ${outcomeClass(key)}"><span>${t(key)}</span><strong data-count="${count}">${count}</strong></div>`).join('')}
    </div><div class="progress"><span>${t('reviewed')} <bdi>${reviewed} / ${items.length}</bdi></span>
    <div class="runway" role="progressbar" aria-label="${t('reviewed')}" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${reviewed}"
      style="--p:${items.length ? Math.round(reviewed / items.length * 100) : 0}%">
      <div class="runway-track"><div class="runway-fill ${animateEntrance ? 'grow' : ''}"></div></div>
      <span class="runway-plane ${animateEntrance ? 'grow' : ''}">${planeIcon}</span></div></div>`;
  const visible = items.filter(i => !state.hide || !i.reviewed);
  document.querySelector('#checklist').innerHTML = `<div class="bar"><h2>${t('checklist')}</h2><div class="row">
    <label class="inline"><input type="checkbox" id="hide" ${state.hide?'checked':''}>${t('hide')}</label>
    ${button('add','add','','primary')}</div></div>
    ${visible.map(card).join('') || `<p class="card muted">${t('empty')}</p>`}`;
  document.querySelector('#register').innerHTML = `<div class="register-box"><h2>${t('register')}</h2>
    <div class="register-body"><p class="muted">${t('order')}</p>${gaps.map(gapCard).join('') || `<p class="muted">${t('noGaps')}</p>`}</div></div>`;
  if (animateEntrance && !reducedMotion.matches) flipCounters();
  animateEntrance = false;
  flipId = null;
}

// Metric tiles tick up from zero like a departure board settling on its values.
function flipCounters() {
  for (const tile of document.querySelectorAll('.metric strong')) {
    const target = Number(tile.dataset.count);
    tile.classList.add('flip');
    if (!target) continue;
    const started = performance.now();
    const step = now => {
      const progress = Math.min((now - started) / 700, 1);
      tile.textContent = Math.round(target * progress);
      if (progress < 1) requestAnimationFrame(step);
    };
    tile.textContent = 0;
    requestAnimationFrame(step);
  }
}

// SMIL motion ignores CSS, so pause the flight path when the visitor asks for reduced motion.
function syncFlight() {
  const svg = document.querySelector('.flight svg');
  if (!svg?.pauseAnimations) return;
  if (reducedMotion.matches) { svg.pauseAnimations(); svg.setCurrentTime(6); }
  else svg.unpauseAnimations();
}
reducedMotion.addEventListener?.('change', syncFlight);
syncFlight();

// Native dialog supplies modal focus handling and Escape-to-close.
function dialog(title, content) {
  modal.innerHTML = `<div class="row"><h2 id="dialog-title">${title}</h2>${button('close','close')}</div>${content}`;
  modal.showModal();
}
function formButtons() {
  return `<div class="card-actions"><button class="primary" type="submit">${t('save')}</button>${button('close','cancel')}</div>`;
}
function field(title, name, value = '', type = 'text', attrs = 'required') {
  const control = type === 'textarea'
    ? `<textarea name="${name}" ${attrs}>${escape(value)}</textarea>`
    : `<input type="${type}" name="${name}" value="${escape(value)}" ${attrs}>`;
  return `<label class="field">${title}${control}</label>`;
}
function select(title, name, choices, value) {
  return `<label class="field">${title}<select name="${name}">${choices.map(key =>
    `<option value="${key}" ${key===value?'selected':''}>${t(key)}</option>`).join('')}</select></label>`;
}
// Form directions follow the field language, independent of the interface language.
function bilingualFields(key, values, type) {
  return `<div class="form-grid">${['en','ar'].map(lang => field(
    `${t(key)} · ${lang==='en'?'English':'العربية'}`, `${key}-${lang}`, values?.[lang], type,
    `required lang="${lang}" dir="${direction(lang)}"`)).join('')}</div>`;
}
function priorityFields(item) {
  return `<div class="form-grid">${select(t('risk'),'risk',['high','medium','low'],item?.risk || 'medium')}
    ${field(`${t('urgency')} · ${t('days')} (0 = ${t('immediate')})`,'days',item?.days ?? 14,'number','required min="0" step="1"')}</div>`;
}
function onSubmit(handler) {
  modal.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (handler(new FormData(event.currentTarget),event.currentTarget) === false) return;
    modal.close();
    save();
  });
}

// Both new and starter items use the same form and schema.
function editItem(item) {
  dialog(t(item?'edit':'add'),`<form>
    ${field(t('id'),'id',item?.id,'text','required dir="ltr"')}${priorityFields(item)}
    ${['title','domain','question','example','actions','why'].map(key=>bilingualFields(key,item?.[key],['title','domain'].includes(key)?'text':'textarea')).join('')}
    ${bilingualFields('name',item?.standard?.name,'text')}
    ${field(t('clause'),'clause',item?.standard?.clause,'text','required dir="ltr"')}
    ${bilingualFields('excerpt',item?.standard?.excerpt,'textarea')}
    ${select(t('type'),'type',['verified','paraphrase','unverified'],item?.standard?.type || 'unverified')}
    ${field(t('url'),'url',item?.standard?.url,'url','required dir="ltr"')}${field(t('publication'),'publicationUrl',item?.standard?.publicationUrl,'url','dir="ltr"')}${formButtons()}</form>`);
  onSubmit((data,form) => {
    const read = key => data.get(key).trim();
    const id = read('id');
    if (!id || state.items.some(other => other !== item && other.id.toLowerCase() === id.toLowerCase())) {
      form.elements.id.setCustomValidity(id ? t('duplicate') : t('id'));
      form.elements.id.reportValidity();
      form.elements.id.oninput = () => form.elements.id.setCustomValidity('');
      return false;
    }
    const url = webUrl(read('url'));
    const publicationUrl = webUrl(read('publicationUrl'));
    if (!url || (read('publicationUrl') && !publicationUrl)) {
      const invalid = form.elements[url ? 'publicationUrl' : 'url'];
      invalid.setCustomValidity(t(url ? 'publication' : 'url') + ' (https://)');
      invalid.reportValidity();
      invalid.oninput = () => invalid.setCustomValidity('');
      return false;
    }
    const pair = key => ({en:read(key+'-en'),ar:read(key+'-ar')});
    const values = {id,risk:read('risk'),days:Number(read('days'))};
    for (const key of ['title','domain','question','example','actions','why']) values[key]=pair(key);
    values.standard = {name:pair('name'),clause:read('clause'),excerpt:pair('excerpt'),type:read('type'),url,publicationUrl};
    // Update only checklist fields so existing review outcomes and notes survive edits.
    if (item) Object.assign(item,values);
    else state.items.push(values);
  });
}

// Outcome is intentionally independent of review completion.
// Switching away from a gap removes it from the register but retains its draft text.
function editOutcome(item) {
  dialog(t(item.outcome==='gap'?'editGap':'record'),`<form>
    ${select(t('outcome'),'outcome',['pass','gap','uncertain'],item.outcome || 'uncertain')}
    <div id="gap-fields" class="dialog-content">
      ${field(t('gapText'),'gapText',item.gapText,'textarea','required dir="auto"')}
      ${priorityFields(item)}${field(t('follow'),'follow',item.follow ?? item.actions[state.lang],'textarea','required dir="auto"')}
    </div>${formButtons()}</form>`);
  const form = modal.querySelector('form');
  const fields = form.querySelector('#gap-fields');
  // Hidden fields should not participate in validation for non-gap outcomes.
  const toggle = () => {
    fields.hidden = form.elements.outcome.value !== 'gap';
    for (const field of fields.querySelectorAll('input,select,textarea')) field.disabled = fields.hidden;
  };
  form.elements.outcome.addEventListener('change', toggle);
  toggle();
  onSubmit(data => {
    flipId = item.id;
    item.outcome = data.get('outcome');
    if (item.outcome === 'gap') {
      item.gapText = data.get('gapText').trim();
      item.follow = data.get('follow').trim();
      item.risk = data.get('risk');
      item.days = Number(data.get('days'));
    }
  });
}

// Show the quotation source and full publication separately when both are available.
function showSource(item) {
  const ref = item.standard;
  const url = webUrl(ref.url);
  const publicationUrl = webUrl(ref.publicationUrl);
  dialog(t('standard'),`<div class="dialog-content"><h3>${localized(ref.name)}</h3>
    <p><bdi>${escape(ref.clause)}</bdi> · ${t(ref.type)}</p>
    <blockquote class="preserve">${localized(ref.excerpt)}</blockquote>
    ${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${t('source')}</a>` : ''}
    ${publicationUrl ? `<a href="${escape(publicationUrl)}" target="_blank" rel="noopener noreferrer">${t('full')}</a>` : ''}</div>`);
}

// Delegate actions because cards are replaced after every saved state change.
document.addEventListener('click', event => {
  const control = event.target.closest('button[data-action]');
  if (!control || !state) return;
  const {action,id} = control.dataset;
  const item = state.items.find(candidate=>candidate.id===id);
  switch (action) {
    case 'lang': if (state.lang !== id) animateEntrance = true; state.lang = id; save(); break;
    case 'close': modal.close(); break;
    case 'add': editItem(); break;
    case 'edit': editItem(item); break;
    case 'review': item.reviewed = !item.reviewed; flipId = item.id; save(); break;
    case 'source': showSource(item); break;
    case 'outcome': editOutcome(item); break;
    case 'comment':
      dialog(t('comment'),`<form>${field(t('comment'),'comment',item.comment,'textarea','dir="auto"')}${formButtons()}</form>`);
      onSubmit(data=>{ item.comment = data.get('comment'); });
      break;
    case 'delete':
      dialog(t('remove'),`<form><p>${t('confirm')}</p><bdi>${escape(item.id)}</bdi>${formButtons()}</form>`);
      onSubmit(()=>{ state.items = state.items.filter(candidate=>candidate!==item); });
      break;
  }
});
document.addEventListener('change',event=>{
  if (event.target.id === 'hide') {
    state.hide = event.target.checked;
    save();
  }
});
start();
