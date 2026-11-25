'use strict';

// Interface translations are separate from the bilingual checklist maintained in data/.
const strings = {
  company:['EgyptAir','مصر للطيران'], subtitle:['Cybersecurity Audit Checklist','قائمة تدقيق الأمن السيبراني'],
  intro:['A simulated cybersecurity assessment of EgyptAir, Egypt’s national airline.','تقييم محاكاة للأمن السيبراني لشركة مصر للطيران، الناقل الوطني المصري.'],
  total:['Total items','إجمالي البنود'], pass:['Control in place','الضابط مطبّق'],
  gap:['Gap found','فجوة قائمة'], uncertain:['Unconfirmed','غير مؤكد'], open:['Open','مفتوح'], progress:['In progress','قيد التنفيذ'], closed:['Closed','مغلق'],
  viewSource:['View source','عرض المصدر'],
  checklist:['Checklist','قائمة التدقيق'], register:['Gap Register','سجل الفجوات'],
  order:['Highest risk first, then shortest deadline.','الأعلى خطورة أولًا، ثم الأقرب موعدًا.'],
  noGaps:['No active gaps recorded.','لا توجد فجوات نشطة مسجّلة.'],
  empty:['No checklist items to show.','لا توجد بنود لعرضها.'], add:['Add item','إضافة بند'],
  hide:['Hide completed','إخفاء البنود المكتملة'], details:['Interview details','تفاصيل المقابلة'],
  example:['Clarification example','مثال توضيحي'], actions:['Action items','الإجراءات المطلوبة'],
  why:['Justification','المبرر'], standard:['Standard & Control','المعيار والضابط'],
  comment:['Comments','التعليقات'], record:['Record outcome','تسجيل النتيجة'], outcome:['Outcome','النتيجة'],
  edit:['Edit item','تعديل البند'], remove:['Delete item','حذف البند'],
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
  storageError:['Browser storage is unavailable. Changes will only last while this page is open.','تخزين المتصفح غير متاح. تستمر التغييرات ما دامت هذه الصفحة مفتوحة.'],
  allDomains:['All domains','كل المجالات'], filterBy:['Filter by domain','التصفية حسب المجال'],
  domainField:['Domain','المجال'], other:['Other','أخرى'],
  noMatch:['No items in the selected domains match the current view.','لا توجد بنود مطابقة في المجالات المحددة.'],
  plan:['Action plan','خطة العمل']
};
const storageKey = 'egyptair-audit-v2';
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
// Domain definitions load from data/domains.json on every visit; items reference them by key.
let domains = [];
// Filtering replays only the card entrance, not the counters or the runway.
let animateCards = false;
// The domain menu stays open across rerenders so several domains can be ticked in a row.
let filterOpen = false;
// Rerendering replaces every button, so remember which control to refocus afterward.
let refocus = '';
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
    const [domainResponse, itemResponse] = await Promise.all([
      fetch('./data/domains.json'),
      Array.isArray(state?.items) ? null : fetch('./data/checklist.json')]);
    if (!domainResponse.ok || (itemResponse && !itemResponse.ok)) throw new Error('Checklist fetch failed');
    domains = await domainResponse.json();
    if (itemResponse) state = {lang:'en', hide:false, selected:[], items:await itemResponse.json()};
    if (!Array.isArray(state.selected)) state.selected = [];
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
// Workflow status follows the audit outcome: nothing recorded is Open, a gap or unconfirmed control is
// In progress, and a control confirmed in place is Closed.
const outcomeClass = outcome => outcome ? `${outcome}-tone` : '';
const statusOf = item => item.outcome === 'pass' ? 'closed' : item.outcome ? 'progress' : 'open';
const status = item => `<span class="pill st-${statusOf(item)} ${item.id === flipId ? 'flip' : ''}"><i></i>${t(statusOf(item))}</span>`;
const outcomePill = item => item.outcome ? `<span class="pill ${item.outcome}-tone"><i></i>${t(item.outcome)}</span>` : '';
// Colors follow heat: red is hottest, then orange, then calmer blues and grays.
const urgencyLevel = days => days === 0 ? 'now' : days <= 14 ? 'soon' : days <= 90 ? 'mid' : 'later';
const badge = (key, value, level) => `<span class="pill lv-${level}"><i></i>${t(key)} · ${value}</span>`;
const riskBadge = item => badge('risk', t(item.risk), riskKey(item.risk));
const urgencyBadge = item => badge('urgency', deadline(item.days), urgencyLevel(item.days));
const planeIcon = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><use href="#plane"/></svg>';
const riskKey = risk => rank[risk] ? risk : 'medium';

// The standard and control sit on a tear-off stub beside the ticket, readable without opening anything.
function stub(item) {
  const ref = item.standard || {};
  const [name, ...rest] = String(localized(ref.name || {})).split(' — ');
  const clause = /^(.*?)\s*\((.*)\)\s*$/.exec(String(ref.clause || ''));
  const number = escape(clause ? clause[1] : ref.clause), tag = clause ? escape(clause[2]) : '';
  return `<button type="button" class="stub" data-action="source" data-id="${escape(item.id)}">
    <span class="stub-label">${t('standard')}</span>
    <span class="stub-name">${name}</span>${rest.length ? `<span class="stub-sub">${rest.join(' — ')}</span>` : ''}
    <span class="stub-clause"><bdi>${number}</bdi></span>${tag ? `<span class="stub-tag"><bdi>${tag}</bdi></span>` : ''}
    <span class="stub-type ${escape(ref.type)}">${t(ref.type) }</span>
    <span class="stub-go">${t('viewSource')}<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 6h8M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <span class="barcode" aria-hidden="true"></span></button>`;
}

function card(item, index = 0) {
  return `<article class="card ${animateEntrance || animateCards ? 'enter' : ''}" data-risk="${riskKey(item.risk)}" style="--i:${Math.min(index, 8)}">
    <div class="pass-main">
    <div class="row pass-head"><small class="pass-id">${planeIcon}<bdi>${escape(item.id)}</bdi></small>${status(item)}</div>
    <h4>${localized(item.title)}</h4>
    <p class="question">${localized(item.question)}</p>
    <div class="meta">${riskBadge(item)}${urgencyBadge(item)}${outcomePill(item)}</div>
    <details data-record="${escape(item.id)}" ${openedDetails.has(item.id) ? 'open' : ''}><summary>${t('details')}</summary>
      ${label('example',localized(item.example))}${label('actions',localized(item.actions))}${label('why',localized(item.why))}
    </details>
    ${item.comment ? label('comment',`<bdi>${escape(item.comment)}</bdi>`) : ''}
    <div class="card-actions">${button('outcome','record',item.id,'primary')}
      ${button('comment','comment',item.id)}${button('edit','edit',item.id)}${button('delete','remove',item.id,'danger')}</div>
    </div>
    ${stub(item)}
  </article>`;
}

// Numeric deadlines and risk enums make sorting independent of display language.
const gapList = items => items.filter(item => item.outcome === 'gap').sort((a,b) =>
  rank[b.risk] - rank[a.risk] || a.days - b.days || a.id.localeCompare(b.id, 'en'));

// The action plan lists every gap, highest risk first, so it can be handed to the client.
function showPlan() {
  const gaps = gapList(state.items);
  dialog(t('plan'), `<div class="dialog-content"><p class="muted">${t('order')}</p>
    ${gaps.map(gapCard).join('') || `<p class="muted">${t('noGaps')}</p>`}</div>`);
}

function gapCard(item) {
  return `<article class="gap ${animateEntrance ? 'enter' : ''}"><div class="row"><small><bdi>${escape(item.id)}</bdi></small>${status(item)}</div>
    <h3>${localized(item.title)}</h3><div class="meta">${riskBadge(item)}${urgencyBadge(item)}${outcomePill(item)}</div>
    ${label('gapText',`<bdi>${escape(item.gapText)}</bdi>`)}${label('follow',`<bdi>${escape(item.follow)}</bdi>`)}
    ${button('outcome','editGap',item.id)}</article>`;
}

// Items point at a domain by key. Anything unmatched falls into an "Other" group instead of vanishing.
const otherDomain = () => ({key:'other', name:{en:strings.other[0], ar:strings.other[1]}, description:null});
const domainKeyOf = item => domains.some(d => d.key === item.domainKey) ? item.domainKey : 'other';
const gateLetter = index => index < 0 ? '•' : String.fromCharCode(65 + index);
function countText(n) {
  if (state.lang !== 'ar') return `${n} ${n === 1 ? 'item' : 'items'}`;
  if (n === 1) return 'بند واحد';
  if (n === 2) return 'بندان';
  return `${n} ${n <= 10 ? 'بنود' : 'بندًا'}`;
}

function domainsCount(n) {
  if (state.lang !== 'ar') return `${n} domains`;
  return n === 2 ? 'مجالان' : `${n} ${n <= 10 ? 'مجالات' : 'مجالًا'}`;
}
function domainSummary(groups) {
  const picked = groups.filter(({domain}) => state.selected.includes(domain.key));
  if (!picked.length) return t('allDomains');
  return picked.length === 1 ? localized(picked[0].domain.name) : domainsCount(picked.length);
}

// A multi-select dropdown scales to any number of domains without taking up page space.
function filterMenu(groups) {
  const rows = groups.map(({domain, all}) => `<label class="menu-row"><input type="checkbox" data-domain="${escape(domain.key)}"
    ${state.selected.includes(domain.key) ? 'checked' : ''}><span>${localized(domain.name)}</span><span class="chip-count">${all.length}</span></label>`).join('');
  return `<div class="filter-menu"><button type="button" class="menu-toggle" data-action="menu" aria-haspopup="true"
    aria-expanded="${filterOpen}" aria-controls="domain-menu"><span class="menu-label">${t('filterBy')}</span>
    <span class="menu-value">${domainSummary(groups)}</span>
    <svg class="chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="menu" id="domain-menu" role="group" aria-label="${t('filterBy')}" ${filterOpen ? '' : 'hidden'}>
      <label class="menu-row"><input type="checkbox" data-domain-all ${state.selected.length ? '' : 'checked'}><span>${t('allDomains')}</span>
        <span class="chip-count">${state.items.length}</span></label>${rows}</div></div>`;
}
function setMenu(open) {
  filterOpen = open;
  const menu = document.querySelector('#domain-menu'), toggle = document.querySelector('.menu-toggle');
  if (!menu || !toggle) return;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

function domainGroup({domain, shown}, order) {
  const letter = gateLetter(domains.findIndex(d => d.key === domain.key));
  return `<section class="domain-group" aria-labelledby="dg-${escape(domain.key)}">
    <div class="domain-head"><span class="gate" aria-hidden="true">${letter}</span>
      <div class="domain-title"><h3 id="dg-${escape(domain.key)}">${localized(domain.name)}</h3>
        ${domain.description ? `<p>${localized(domain.description)}</p>` : ''}</div>
      <span class="count-badge">${countText(shown.length)}</span></div>
    ${shown.map(item => card(item, order.next++)).join('')}</section>`;
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
  const closed = items.filter(item => statusOf(item) === 'closed').length;
  // Numeric deadlines and risk enums make sorting independent of display language.
  const gaps = gapList(items);
  const metrics = [['total',items.length],['pass',items.filter(i=>i.outcome==='pass').length],
    ['gap',gaps.length],['uncertain',items.filter(i=>i.outcome==='uncertain').length]];
  document.querySelector('#summary').innerHTML = `<div class="metrics">
    ${metrics.map(([key,count])=>`<div class="metric ${outcomeClass(key)}"><span>${t(key)}</span><strong data-count="${count}">${count}</strong></div>`).join('')}
    </div><div class="progress"><span>${t('closed')} <bdi>${closed} / ${items.length}</bdi></span>
    <div class="runway" role="progressbar" aria-label="${t('closed')}" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${closed}"
      style="--p:${items.length ? Math.round(closed / items.length * 100) : 0}%">
      <div class="runway-track"><div class="runway-fill ${animateEntrance ? 'grow' : ''}"></div></div>
      <span class="runway-plane ${animateEntrance ? 'grow' : ''}">${planeIcon}</span></div></div>`;
  // Group items by domain in the order domains.json lists them. Empty domains get no chip or section.
  const known = [...domains];
  if (items.some(item => domainKeyOf(item) === 'other')) known.push(otherDomain());
  const groups = known.map(domain => {
    const all = items.filter(item => domainKeyOf(item) === domain.key);
    return {domain, all, shown:all.filter(item => !state.hide || statusOf(item) !== 'closed')};
  }).filter(group => group.all.length);
  state.selected = state.selected.filter(key => groups.some(group => group.domain.key === key));
  const chosen = groups.filter(group => (!state.selected.length || state.selected.includes(group.domain.key)) && group.shown.length);
  const order = {next:0};
  document.querySelector('#checklist').innerHTML = `<h2 class="section-title">${t('checklist')}</h2>
    <div class="toolbar">${filterMenu(groups)}<div class="tools">
      <label class="inline"><input type="checkbox" id="hide" ${state.hide?'checked':''}>${t('hide')}</label>
      <button type="button" data-action="plan">${t('plan')}<span class="chip-count">${gaps.length}</span></button>
      ${button('add','add','','primary')}</div></div>
    ${chosen.map(group => domainGroup(group, order)).join('') || `<p class="card muted">${t(items.length ? 'noMatch' : 'empty')}</p>`}`;
  if (animateEntrance && !reducedMotion.matches) flipCounters();
  animateEntrance = false;
  animateCards = false;
  flipId = null;
  if (refocus) { document.querySelector(refocus)?.focus(); refocus = ''; }
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
  for (const svg of document.querySelectorAll('.emblem svg')) {
    if (!svg.pauseAnimations) continue;
    if (reducedMotion.matches) { svg.pauseAnimations(); svg.setCurrentTime(6); }
    else svg.unpauseAnimations();
  }
}
reducedMotion.addEventListener?.('change', syncFlight);
syncFlight();

// Native dialog supplies modal focus handling and Escape-to-close.
function dialog(title, content) {
  modal.innerHTML = `<div class="row"><h2 id="dialog-title">${title}</h2>${button('close','close')}</div>${content}`;
  // Opening a form from inside the action plan reuses the dialog that is already open.
  if (!modal.open) modal.showModal();
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
function domainSelect(value) {
  return `<label class="field">${t('domainField')}<select name="domainKey">${domains.map(domain =>
    `<option value="${escape(domain.key)}" ${domain.key===value?'selected':''}>${localized(domain.name)}</option>`).join('')}</select></label>`;
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
    ${domainSelect(item?.domainKey)}
    ${['title','question','example','actions','why'].map(key=>bilingualFields(key,item?.[key],key==='title'?'text':'textarea')).join('')}
    ${bilingualFields('name',item?.standard?.name,'text')}
    ${field(t('clause'),'clause',item?.standard?.clause,'text','required dir="ltr"')}
    ${bilingualFields('excerpt',item?.standard?.excerpt,'textarea')}
    ${select(t('type'),'type',['verified','paraphrase','unverified'],item?.standard?.type || 'unverified')}
    ${field(t('url'),'url',item?.standard?.url,'url','dir="ltr"')}${field(t('publication'),'publicationUrl',item?.standard?.publicationUrl,'url','dir="ltr"')}${formButtons()}</form>`);
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
    // Links are optional so an unverified source can be saved without one, but any link given must be a web URL.
    const badUrl = read('url') && !url;
    if (badUrl || (read('publicationUrl') && !publicationUrl)) {
      const invalid = form.elements[badUrl ? 'url' : 'publicationUrl'];
      invalid.setCustomValidity(t(badUrl ? 'url' : 'publication') + ' (https://)');
      invalid.reportValidity();
      invalid.oninput = () => invalid.setCustomValidity('');
      return false;
    }
    const pair = key => ({en:read(key+'-en'),ar:read(key+'-ar')});
    const values = {id,domainKey:read('domainKey'),risk:read('risk'),days:Number(read('days'))};
    for (const key of ['title','question','example','actions','why']) values[key]=pair(key);
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
  if (filterOpen && !event.target.closest('.filter-menu')) setMenu(false);
  const control = event.target.closest('button[data-action]');
  if (!control || !state) return;
  const {action,id} = control.dataset;
  const item = state.items.find(candidate=>candidate.id===id);
  switch (action) {
    case 'lang': if (state.lang !== id) animateEntrance = true; state.lang = id; save(); break;
    case 'menu': setMenu(!filterOpen); break;
    case 'plan': showPlan(); break;
    case 'close': modal.close(); break;
    case 'add': editItem(); break;
    case 'edit': editItem(item); break;
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
  const box = event.target;
  if (!state) return;
  if (box.id === 'hide') {
    state.hide = box.checked;
    save();
  } else if (box.dataset.domain) {
    // Domains toggle independently, so any combination can be shown together.
    const key = box.dataset.domain;
    state.selected = box.checked ? [...new Set([...state.selected, key])] : state.selected.filter(selected => selected !== key);
    animateCards = true; refocus = `input[data-domain="${key}"]`; save();
  } else if ('domainAll' in box.dataset) {
    state.selected = [];
    animateCards = true; refocus = 'input[data-domain-all]'; save();
  }
});
// Close the menu from the keyboard, or when focus moves to another control.
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && filterOpen) { setMenu(false); document.querySelector('.menu-toggle')?.focus(); }
});
document.addEventListener('focusout', event => {
  if (filterOpen && event.relatedTarget && !event.relatedTarget.closest?.('.filter-menu')) setMenu(false);
});
start();
