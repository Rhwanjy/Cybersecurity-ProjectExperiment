'use strict';

// Interface translations are separate from the bilingual checklist maintained in data/.
const strings = {
  company:['EgyptAir','مصر للطيران'], subtitle:['Cybersecurity Audit Checklist','قائمة تدقيق الأمن السيبراني'],
  intro:['A simulated cybersecurity assessment of EgyptAir, Egypt’s national airline.','تقييم محاكاة للأمن السيبراني لشركة مصر للطيران، الناقل الوطني المصري.'],
  total:['Total items','إجمالي البنود'], pass:['Control in place','الضابط مطبّق'],
  gap:['Gap found','فجوة قائمة'], uncertain:['Needs evidence','يحتاج دليلًا'], open:['Open','مفتوح'], progress:['In progress','قيد التنفيذ'], closed:['Closed','مغلق'],
  viewSource:['View source','عرض المصدر'],
  checklist:['Checklist','قائمة التدقيق'], register:['Gap Register','سجل الفجوات'],
  order:['Highest risk first, then shortest deadline.','الأعلى خطورة أولًا، ثم الأقرب موعدًا.'],
  noGaps:['No active gaps recorded.','لا توجد فجوات نشطة مسجّلة.'],
  empty:['No checklist items to show.','لا توجد بنود لعرضها.'], 
  hide:['Hide completed','إخفاء البنود المكتملة'], details:['Interview details','تفاصيل المقابلة'],
  example:['Clarification example','مثال توضيحي'], actions:['Action items','الإجراءات المطلوبة'],
  why:['Justification','المبرر'], standard:['Standard & Control','المعيار والضابط'],
  comment:['Comments','التعليقات'], result:['Audit result','نتيجة التدقيق'], goToItem:['Go to item','انتقل إلى البند'],
  gapPlaceholder:['What did the client fail to show?','ما الذي عجز العميل عن إثباته؟'],
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
  loadError:['Could not load the checklist. Refresh to try again.','تعذّر تحميل القائمة. أعد تحميل الصفحة للمحاولة مرة أخرى.'],
  storageError:['Browser storage is unavailable. Changes will only last while this page is open.','تخزين المتصفح غير متاح. تستمر التغييرات ما دامت هذه الصفحة مفتوحة.'],
  allDomains:['All domains','كل المجالات'], filterBy:['Filter by domain','التصفية حسب المجال'],
  askAuditor:['Who would you like to assist you today?','مَن تودّ أن يساعدك اليوم؟'], everyone:['Whole team','الفريق كله'],
  auditorTag:['Auditor','المدقق'], noAuditorItems:['No items are assigned to this auditor yet.','لا توجد بنود مُسندة لهذا المدقق بعد.'],
  other:['Other','أخرى'],
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
let auditors = [];
// Filtering replays only the card entrance, not the counters or the runway.
let animateCards = false;
// The domain menu stays open across rerenders so several domains can be ticked in a row.
let filterOpen = false;
let scrollTarget = '';
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

// The checklist always loads from data/, so updating the JSON updates every visitor. Each browser
// stores only its own progress: outcomes, gaps, comments, and the interface choices.
const progressKeys = ['outcome','gapText','follow','comment','risk','days'];
let baseItems = [];
const pickProgress = (item, base) => Object.fromEntries(progressKeys
  .filter(key => item[key] !== undefined && !(base && item[key] === base[key]))
  .map(key => [key, item[key]]));

async function start() {
  try {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { storageFailed = true; }
    const [domainResponse, itemResponse, auditorResponse] = await Promise.all([fetch('./data/domains.json'), fetch('./data/checklist.json'), fetch('./data/auditors.json')]);
    if (!domainResponse.ok || !itemResponse.ok || !auditorResponse.ok) throw new Error('Checklist fetch failed');
    domains = await domainResponse.json();
    auditors = await auditorResponse.json();
    baseItems = await itemResponse.json();
    // Earlier versions saved whole items; keep their progress and drop the copied content.
    const progress = saved?.progress ?? Object.fromEntries((saved?.items ?? []).map(item =>
      [item.id, pickProgress(item, baseItems.find(base => base.id === item.id))]));
    state = {lang: saved?.lang === 'ar' ? 'ar' : 'en', hide: !!saved?.hide,
      selected: Array.isArray(saved?.selected) ? saved.selected : [],
      auditor: auditors.some(person => person.key === saved?.auditor) ? saved.auditor : '',
      items: baseItems.map(base => ({...base, ...progress[base.id]}))};
    render();
  } catch {
    notice.textContent = strings.loadError.join(' / ');
    notice.hidden = false;
  }
}

// A single save operation keeps checklist, summary, and register in sync.
function persist() {
  const {lang, hide, selected, auditor} = state;
  const progress = Object.fromEntries(state.items.map(item => [item.id, pickProgress(item, baseItems.find(base => base.id === item.id))]));
  try { localStorage.setItem(storageKey, JSON.stringify({lang, hide, selected, auditor, progress})); }
  catch { storageFailed = true; }
}
function save() {
  persist();
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
const auditorPill = item => {
  const who = auditors.find(person => person.key === item.auditor);
  return who ? `<span class="pill who">${t('auditorTag')} · ${localized(who.name)}</span>` : '';
};
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

// The three audit results sit on the ticket itself; a gap opens its two notes right underneath.
const resultIcons = {
  pass:'<path d="m4 12 5 5L20 6"/>',
  gap:'<path d="M12 4 2.5 20h19Z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  uncertain:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5"/>'
};
const followOf = item => item.follow ?? localized(item.actions);
function resultBar(item) {
  const buttons = ['pass','gap','uncertain'].map(key => `<button type="button" class="res res-${key}" data-action="result" data-id="${escape(item.id)}" data-value="${key}"
    aria-pressed="${item.outcome === key}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${resultIcons[key]}</svg>${t(key)}</button>`).join('');
  const notes = item.outcome === 'gap' ? `<div class="gap-fields">
    <label class="field">${t('gapText')}<textarea rows="2" dir="auto" data-gap="gapText" data-id="${escape(item.id)}" placeholder="${t('gapPlaceholder')}">${escape(item.gapText ?? '')}</textarea></label>
    <label class="field">${t('follow')}<textarea rows="2" dir="auto" data-gap="follow" data-id="${escape(item.id)}">${escape(followOf(item))}</textarea></label></div>` : '';
  return `<div class="result" role="group" aria-label="${t('result')}"><span class="result-label">${t('result')}</span>${buttons}</div>${notes}`;
}

function card(item, index = 0) {
  return `<article class="card ${animateEntrance || animateCards ? 'enter' : ''}" data-item="${escape(item.id)}" data-risk="${riskKey(item.risk)}" style="--i:${Math.min(index, 8)}">
    <div class="pass-main">
    <div class="row pass-head"><small class="pass-id">${planeIcon}<bdi>${escape(item.id)}</bdi></small>${status(item)}</div>
    <h4>${localized(item.title)}</h4>
    <p class="question">${localized(item.question)}</p>
    <div class="meta">${riskBadge(item)}${urgencyBadge(item)}${state.auditor ? '' : auditorPill(item)}</div>
    <details data-record="${escape(item.id)}" ${openedDetails.has(item.id) ? 'open' : ''}><summary>${t('details')}</summary>
      ${label('example',localized(item.example))}${label('actions',localized(item.actions))}${label('why',localized(item.why))}
    </details>
    ${item.comment ? label('comment',`<bdi>${escape(item.comment)}</bdi>`) : ''}
    ${resultBar(item)}
    <div class="card-actions">${button('comment','comment',item.id)}</div>
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
    <h3>${localized(item.title)}</h3><div class="meta">${riskBadge(item)}${urgencyBadge(item)}</div>
    ${label('gapText',`<bdi>${escape(item.gapText || '—')}</bdi>`)}${label('follow',`<bdi>${escape(followOf(item))}</bdi>`)}
    ${button('goto','goToItem',item.id)}</article>`;
}

// Items point at a domain by key. Anything unmatched falls into an "Other" group instead of vanishing.
const otherDomain = () => ({key:'other', name:{en:strings.other[0], ar:strings.other[1]}, description:null});
const domainKeyOf = item => domains.some(d => d.key === item.domainKey) ? item.domainKey : 'other';
// Each domain gets a drawn icon; unknown domains fall back to a shield.
const domainIcons = {
  access:'<circle cx="8" cy="15" r="4"/><path d="M11 12.5 20 4M16 8l3 3M14 10l2.5 2.5"/>',
  risk:'<path d="M12 3v17M5 20h14M5 7h14"/><path d="M5 7 2.5 13a3 3 0 0 0 5 0Zm14 0-2.5 6a3 3 0 0 0 5 0Z"/>',
  network:'<circle cx="12" cy="5" r="2.3"/><circle cx="5" cy="19" r="2.3"/><circle cx="19" cy="19" r="2.3"/><path d="M11 7 6 17M13 7l5 10M7.5 19h9"/>',
  asset:'<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  incident:'<path d="M6 19v-6a6 6 0 0 1 12 0v6M4 19h16"/><path d="M12 3v2M4.5 6l1.4 1.4M19.5 6l-1.4 1.4"/>',
  data:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  vendor:'<path d="M3 11l5-4 3 2 3-2 7 5-4 5-3-1-2 2-3-2-2 2-4-4Z"/>',
  training:'<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>',
  other:'<path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'
};
const domainIcon = key => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${domainIcons[key] || domainIcons.other}</svg>`;
function countText(n) {
  if (state.lang !== 'ar') return `${n} ${n === 1 ? 'item' : 'items'}`;
  if (n === 1) return 'بند واحد';
  if (n === 2) return 'بندان';
  return `${n} ${n <= 10 ? 'بنود' : 'بندًا'}`;
}

// Each auditor is drawn from a few traits so the desk character always matches the person selected.
const looks = {
  youssef:{skin:'#ebc6a2', hair:'#2a1d16', shirt:'#2f6fd0', glasses:'square'},
  fareed:{skin:'#c28a5c', hair:'#1f1712', shirt:'#2a9d8f', glasses:'round'},
  zaina:{skin:'#f2d0ae', hair:'#3a2418', shirt:'#e07a5f'},
  jana:{skin:'#d9a577', hair:'#2a1d16', shirt:'#6c5aa8', scarf:'#d4789a'}
};
function person(auditor, pop) {
  const look = looks[auditor.key] || looks.youssef;
  const female = auditor.gender === 'female', hijab = auditor.hijab;
  const face = `<ellipse cx="70" cy="62" rx="${hijab ? 18 : 24}" ry="${hijab ? 22 : 28}" fill="${look.skin}"/>`;
  const hair = hijab ? '' : female
    ? `<path d="M43 64C37 22 103 22 97 64L102 112C88 106 52 106 38 112Z" fill="${look.hair}"/>`
    : '';
  const fringe = hijab ? '' : female
    ? `<path d="M45 56C49 33 91 33 95 56C84 45 58 43 45 56Z" fill="${look.hair}"/>`
    : `<path d="M45 58C42 28 98 28 95 58C90 44 50 44 45 58Z" fill="${look.hair}"/>`;
  const scarf = hijab ? `<path d="M70 26C42 26 38 52 41 72C41 90 34 102 20 118C50 130 90 130 120 118C106 102 99 90 99 72C102 52 98 26 70 26Z" fill="${look.scarf}"/>` : '';
  const neck = hijab ? '' : `<rect x="60" y="88" width="20" height="20" rx="8" fill="${look.skin}"/>`;
  const frames = {
    round:'<circle cx="61" cy="63" r="8"/><circle cx="79" cy="63" r="8"/><path d="M69 63h2"/>',
    square:'<rect x="52" y="56" width="17" height="13" rx="3"/><rect x="71" y="56" width="17" height="13" rx="3"/><path d="M69 62h2"/>'
  };
  const glasses = look.glasses ? `<g fill="none" stroke="#1f2937" stroke-width="2">${frames[look.glasses]}</g>` : '';
  return `<div class="person ${pop ? 'pop' : ''}"><svg viewBox="0 0 140 170" focusable="false">
    ${hijab ? '' : hair}
    <path d="M12 170C12 124 38 102 70 102C102 102 128 124 128 170Z" fill="${look.shirt}"/>
    ${scarf}${neck}
    ${hijab ? '' : `<path d="M57 102 70 118 83 102" fill="#fff"/>`}
    ${face}${fringe}
    <g class="eyes" fill="#1b2a3a"><circle cx="62" cy="64" r="2.6"/><circle cx="78" cy="64" r="2.6"/></g>${glasses}
    <path d="M62 76Q70 83 78 76" fill="none" stroke="#7a3b2e" stroke-width="2.2" stroke-linecap="round"/>
    <g class="tag"><rect x="70" y="124" width="56" height="26" rx="5" fill="#fff" stroke="#c9d9ea"/><rect x="70" y="124" width="56" height="7" rx="3.5" fill="#c8283d"/>
      <text x="98" y="145" text-anchor="middle" font-size="12" font-weight="800" fill="#0b2a4a">${localized(auditor.name)}</text></g>
  </svg></div>`;
}

// The picker doubles as a filter: the chosen auditor sits behind the statistics bar as if it were their desk.
function deskScene(counts) {
  const chosen = auditors.find(person => person.key === state.auditor);
  const pop = animateCards || animateEntrance;
  const chips = [['', t('everyone'), state.items.length], ...auditors.map(person => [person.key, localized(person.name), counts[person.key] || 0])]
    .map(([key, name, count]) => `<button type="button" data-action="auditor" data-id="${key}" aria-pressed="${state.auditor === key}">${name}<span class="chip-count">${count}</span></button>`).join('');
  const bubble = chosen ? (state.lang === 'ar'
    ? `أهلًا، أنا ${localized(chosen.name)} — ${countText(counts[chosen.key] || 0)} على مكتبي.`
    : `Hi, I’m ${localized(chosen.name)} — ${countText(counts[chosen.key] || 0)} on my desk.`) : '';
  return `<div class="desk-pick"><h2>${t('askAuditor')}</h2><div class="auditor-chips" role="group" aria-label="${t('askAuditor')}">${chips}</div></div>
    <div class="stage ${chosen ? 'solo' : ''}" aria-hidden="true">${chosen ? person(chosen, pop) + `<p class="bubble">${bubble}</p>` : auditors.map(person_ => person(person_, pop)).join('')}</div>`;
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
function filterMenu(groups, total) {
  const rows = groups.map(({domain, all}) => `<label class="menu-row"><input type="checkbox" data-domain="${escape(domain.key)}"
    ${state.selected.includes(domain.key) ? 'checked' : ''}><span class="menu-icon" aria-hidden="true">${domainIcon(domain.key)}</span><span class="menu-text">${localized(domain.name)}</span><span class="chip-count">${all.length}</span></label>`).join('');
  return `<div class="filter-menu"><button type="button" class="menu-toggle" data-action="menu" aria-haspopup="true"
    aria-expanded="${filterOpen}" aria-controls="domain-menu"><span class="menu-label">${t('filterBy')}</span>
    <span class="menu-value">${domainSummary(groups)}</span>
    <svg class="chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <div class="menu" id="domain-menu" role="group" aria-label="${t('filterBy')}" ${filterOpen ? '' : 'hidden'}>
      <label class="menu-row"><input type="checkbox" data-domain-all ${state.selected.length ? '' : 'checked'}><span class="menu-text">${t('allDomains')}</span>
        <span class="chip-count">${total}</span></label>${rows}</div></div>`;
}
function setMenu(open) {
  filterOpen = open;
  const menu = document.querySelector('#domain-menu'), toggle = document.querySelector('.menu-toggle');
  if (!menu || !toggle) return;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
}

function domainGroup({domain, shown}, order) {
  return `<section class="domain-group" aria-labelledby="dg-${escape(domain.key)}">
    <div class="domain-head"><span class="gate" aria-hidden="true">${domainIcon(domain.key)}</span>
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
  // Statistics, sections and the domain menu follow the chosen auditor; the action plan always covers the whole team.
  const items = state.auditor ? state.items.filter(item => item.auditor === state.auditor) : state.items;
  const counts = {};
  for (const item of state.items) counts[item.auditor] = (counts[item.auditor] || 0) + 1;
  const closed = items.filter(item => statusOf(item) === 'closed').length;
  // Numeric deadlines and risk enums make sorting independent of display language.
  const gaps = gapList(items), teamGaps = gapList(state.items);
  const metrics = [['total',items.length],['pass',items.filter(i=>i.outcome==='pass').length],
    ['gap',gaps.length],['uncertain',items.filter(i=>i.outcome==='uncertain').length]];
  document.querySelector('#summary').innerHTML = `${deskScene(counts)}<div class="metrics">
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
    <div class="toolbar">${filterMenu(groups, items.length)}<div class="tools">
      <label class="inline"><input type="checkbox" id="hide" ${state.hide?'checked':''}>${t('hide')}</label>
      <button type="button" data-action="plan">${t('plan')}<span class="chip-count">${teamGaps.length}</span></button>
</div></div>
    ${chosen.map(group => domainGroup(group, order)).join('') || `<p class="card muted">${t(items.length ? 'noMatch' : state.auditor ? 'noAuditorItems' : 'empty')}</p>`}`;
  if (animateEntrance && !reducedMotion.matches) flipCounters();
  animateEntrance = false;
  animateCards = false;
  flipId = null;
  if (refocus) { document.querySelector(refocus)?.focus(); refocus = ''; }
  if (scrollTarget) { document.querySelector(`[data-item="${scrollTarget}"]`)?.scrollIntoView({block:'center', behavior: reducedMotion.matches ? 'auto' : 'smooth'}); scrollTarget = ''; }
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
function onSubmit(handler) {
  modal.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (handler(new FormData(event.currentTarget),event.currentTarget) === false) return;
    modal.close();
    save();
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
    case 'auditor': state.auditor = id; animateCards = true; refocus = `button[data-action="auditor"][data-id="${id}"]`; save(); break;
    case 'plan': showPlan(); break;
    case 'close': modal.close(); break;
    case 'source': showSource(item); break;
    case 'result': {
      const value = control.dataset.value;
      item.outcome = item.outcome === value ? undefined : value;
      flipId = item.id;
      refocus = item.outcome === 'gap' ? `textarea[data-gap="gapText"][data-id="${id}"]` : `button[data-action="result"][data-id="${id}"][data-value="${value}"]`;
      save(); break;
    }
    case 'goto':
      // Jump to the item from the action plan, clearing filters that could hide it.
      modal.close(); state.auditor = ''; state.selected = []; scrollTarget = id; save(); break;
    case 'comment':
      dialog(t('comment'),`<form>${field(t('comment'),'comment',item.comment,'textarea','dir="auto"')}${formButtons()}</form>`);
      onSubmit(data=>{ item.comment = data.get('comment'); });
      break;
  }
});
document.addEventListener('change',event=>{
  const box = event.target;
  if (!state) return;
  if (box.dataset.gap) {
    // Notes save quietly so typing is never interrupted by a rerender.
    const note = state.items.find(candidate => candidate.id === box.dataset.id);
    if (note) { note[box.dataset.gap] = box.value.trim(); persist(); }
    return;
  }
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
