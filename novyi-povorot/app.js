(() => {
  'use strict';
  const D = window.PDD_DATA, R = window.PDD_REFERENCE, C = window.PddCore;
  const main = document.querySelector('main'), category = document.querySelector('#category');
  if (!D || !R || !C) {
    main.innerHTML = '<section class="panel error-panel"><h1>Не удалось загрузить базу</h1><p>Откройте index.html из полной папки приложения.</p></section>'; return;
  }
  const KEY = `pdd-web-v1-${D.revision || D.version}`, referenceDialog = document.querySelector('#reference-dialog'), leaveDialog = document.querySelector('#leave-dialog');
  document.querySelector('.edition').textContent = D.region;
  document.querySelector('.sidebar-footer p').textContent = `${D.version} · ${D.date}`;
  document.querySelector('.app-footer span').textContent = `Материалы ПДД.by · версия базы: ${D.date}`;
  const plural = (n, one, few, many) => n%10===1&&n%100!==11 ? one : n%10>=2&&n%10<=4&&!(n%100>=12&&n%100<=14) ? few : many;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  let saved = {}, storageAvailable = true;
  try { const value = JSON.parse(localStorage.getItem(KEY) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value; } catch (_) {}
  if (!saved.stats || typeof saved.stats !== 'object' || Array.isArray(saved.stats)) saved.stats = {};
  if (!C.validSession(saved.session, D.questions) || saved.session?.completed) saved.session = null;
  if (!C.validSession(saved.lastResult, D.questions) || !saved.lastResult?.completed) saved.lastResult = null;
  let page = 'practice', source = 'random', topic = 0, number = 1, session = null, reviewing = false, timer = null, pendingLeave = null;
  let bookSection = 1, bookSearch = '', bookLimit = 50;
  category.value = saved.category === 'BC' ? 'BC' : 'B';
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(saved)); }
    catch (_) { storageAvailable = false; }
  }
  persist();
  function button(text, action, style = '', disabled = false) { return `<button class="button ${style}" data-action="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`; }
  function currentQuestions() { return C.available(D.questions, category.value); }
  function heading(title, subtitle = '') { return `<div class="page-heading"><div class="eyebrow">Учебная программа ПДД</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`; }
  function syncNav() {
    document.querySelectorAll('[data-page]').forEach(el => { el.classList.toggle('active', el.dataset.page === page); el.setAttribute('aria-current', el.dataset.page === page ? 'page' : 'false'); });
    category.disabled = !!session;
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function focusQuestion() { document.querySelector('.question-title')?.focus({preventScroll:true}); main.scrollIntoView({block:'start',behavior:'instant'}); }
  function home() {
    stopTimer(); session = null; reviewing = false; syncNav();
    if (page === 'book') { book(); return; }
    const exam = page === 'exam';
    const modes = exam ? [['theme','По темам','Зачёт по выбранной теме'],['fixed','Билет по номеру','Фиксированный набор вопросов'],['random','Случайный билет','Вопросы из разных тем'],['x10','Случайный билет x10','Результат после всех ответов']] : [['part','По разделам','Все вопросы выбранного раздела'],['theme','По темам','Тематический билет'],['fixed','Билет по номеру','Фиксированный набор вопросов'],['random','Случайный билет','Вопросы из разных тем']];
    if (!modes.some(m => m[0] === source)) source = 'random';
    const list = currentQuestions(), ids = new Set(list.map(q => q.id));
    const unique = Object.keys(saved.stats).filter(id => ids.has(+id)).length;
    main.innerHTML = `${heading(exam ? 'Проверить знания' : 'Выберите тренировку', exam ? '15 минут на билет. Допускается одна ошибка.' : 'Решайте билеты и разбирайте сложные ситуации в удобном темпе.')}
      <div class="home-grid"><section class="panel"><h2>Режим ${exam ? 'экзамена' : 'тренировки'}</h2><div class="mode-grid">${modes.map((m,i) => `<button class="mode-card ${source === m[0] ? 'selected' : ''}" data-source="${m[0]}" aria-pressed="${source === m[0]}"><span class="mode-index">0${i+1}</span><span><strong>${m[1]}</strong><small>${m[2]}</small></span></button>`).join('')}</div>
      <div id="setup-fields"></div><div class="start-row"><div class="start-info"><strong id="question-count">10 вопросов</strong>${exam ? 'Время ограничено 15 минутами' : 'Без ограничения времени'}</div>${button(exam ? 'Начать экзамен' : 'Начать тренировку','start')}</div></section>
      <aside class="stack">${saved.session ? `<section class="panel resume"><h3>Незавершённый билет</h3><p class="small-copy">${saved.session.config.mode === 'exam' ? 'Экзамен сохранён. Таймер продолжает идти.' : 'Ответы сохранены. Можно вернуться к решению.'}</p>${button('Продолжить билет','resume')}</section>` : ''}<section class="panel"><h3>Ваша подготовка</h3><div class="stat-line"><span>Разобрано вопросов</span><strong>${unique} <span>/ ${list.length}</span></strong></div><div class="meter" role="progressbar" aria-label="Разобрано вопросов" aria-valuenow="${unique}" aria-valuemin="0" aria-valuemax="${list.length}"><div class="meter-fill" style="width:${unique/list.length*100}%"></div></div><p class="small-copy">${storageAvailable ? 'Прогресс сохраняется на этом устройстве.' : 'Браузер запретил сохранение. Прогресс доступен до закрытия страницы.'}</p>${saved.lastResult ? '<button class="text-button last-result" data-action="last-result">Последний результат</button>' : ''}</section><section class="panel"><h3>${exam ? 'Как проходит экзамен' : 'Во время тренировки'}</h3><p class="small-copy">${exam ? 'В обычном экзамене вторая ошибка завершает билет. В режиме x10 оценка появится после всех 10 ответов.' : 'После первой ошибки можно попробовать снова. Пояснение и связанные пункты ПДД помогают разобраться в ответе.'}</p><div class="keyboard-list"><span class="key-hint"><kbd>1–5</kbd> выбор</span><span class="key-hint"><kbd>Enter</kbd> ответ</span>${exam ? '<span class="key-hint"><kbd>Пробел</kbd> пропуск</span>' : '<span class="key-hint"><kbd>X</kbd> пояснение</span><span class="key-hint"><kbd>Z</kbd> ПДД</span>'}</div></section></aside></div>`;
    fields();
  }
  function fields() {
    let html = '';
    if (source === 'part') html = `<div class="form-field"><label for="topic">Раздел</label><select id="topic">${D.parts.map((p,i) => { const count = currentQuestions().filter(q => q.parts.includes(i)).length; return count ? `<option value="${i}">${i+1}. ${esc(p)} · ${count}</option>` : ''; }).join('')}</select></div>`;
    if (source === 'theme') html = `<div class="form-field"><label for="topic">Тема</label><select id="topic">${D.themes.map((t,i) => `<option value="${i+1}">${i+1}. ${esc(t)}</option>`).join('')}${category.value === 'BC' ? D.devices.map((t,i) => `<option value="${11+i}">Устройство ТС: ${esc(t)}</option>`).join('') : ''}</select></div><div class="form-field"><label for="ticket-number">Номер тематического билета</label>${ticketPicker(1,true)}<p class="form-help" id="ticket-help"></p><button class="text-button" data-action="random-theme">Случайный набор вопросов</button></div>`;
    if (source === 'fixed') html = `<div class="form-field"><label for="ticket-number">Номер билета</label>${ticketPicker(99999,false)}<p class="form-help">Допустимые номера: 1–99999. Набор вопросов зависит от номера.</p></div>`;
    document.querySelector('#setup-fields').innerHTML = html;
    const select = document.querySelector('#topic');
    if (select) { if ([...select.options].some(o => +o.value === topic)) select.value = topic; else topic = +select.value; }
    updatePicker();
    countLabel();
  }
  function ticketPicker(max, thematic) {
    return `<div class="ticket-picker"><button class="ticket-arrow" data-action="previous-ticket" aria-label="Предыдущий билет">‹</button><div class="ticket-value"><input id="ticket-number" type="number" min="1" max="${max}" step="1" ${thematic ? '' : 'required'} value="${number || ''}" placeholder="Случайный" aria-describedby="ticket-total"><span id="ticket-total" class="ticket-total"></span></div><button class="ticket-arrow" data-action="next-ticket" aria-label="Следующий билет">›</button></div>`;
  }
  function updatePicker() {
    const input=document.querySelector('#ticket-number');if(!input)return;
    const count=source==='theme'?Math.ceil(currentQuestions().filter(q=>q.theme===topic).length/10):99999;
    input.max=count;
    if(number>count){number=count;input.value=count;}
    document.querySelector('#ticket-total').textContent=source==='theme'?`/ ${count}`:'';
    document.querySelector('#ticket-total').setAttribute('aria-label',source==='theme'?`из ${count} ${plural(count,'тематического билета','тематических билетов','тематических билетов')}`:'Допустимый номер от 1 до 99999');
    document.querySelector('[data-action="previous-ticket"]').disabled=!number||number<=1;
    document.querySelector('[data-action="next-ticket"]').disabled=number>=count;
    const total=currentQuestions().filter(q=>q.theme===topic).length;
    const help=document.querySelector('#ticket-help');if(help)help.textContent=number?`${total} ${plural(total,'вопрос','вопроса','вопросов')} в теме · ${count} ${plural(count,'билет','билета','билетов')} по 10 вопросов`:`Случайный набор · в теме ${count} ${plural(count,'нумерованный билет','нумерованных билета','нумерованных билетов')}`;
  }
  function stepTicket(direction) {
    const input=document.querySelector('#ticket-number');if(!input)return;
    number=Math.max(1,Math.min(+input.max,Math.trunc(Number(input.value)||0)+direction));input.value=number;updatePicker();
  }
  function countLabel() {
    const n = source === 'part' ? currentQuestions().filter(q => q.parts.includes(topic)).length : 10;
    document.querySelector('#question-count').textContent = `${n} ${n%10 === 1 && n%100 !== 11 ? 'вопрос' : n%10 >= 2 && n%10 <= 4 && !(n%100 >= 12 && n%100 <= 14) ? 'вопроса' : 'вопросов'}`;
  }
  function start() {
    const input = document.querySelector('#ticket-number');
    number = input && input.value ? Number(input.value) : null;
    if (input && !input.checkValidity()) { input.reportValidity(); input.focus(); return; }
    begin({mode:page, source, category:category.value, topic, number});
  }
  function begin(config) {
    session = C.createSession(D.questions, config);
    if (!session.ids.length) { home(); return; }
    reviewing = false; page = config.mode; category.value = config.category;
    saveSession(); showQuestion(); focusQuestion();
  }
  function saveSession() {
    if (!session) return;
    saved.category = session.config.category;
    if (session.completed) { saved.lastResult = session; if (saved.session?.start === session.start) saved.session = null; }
    else saved.session = session;
    persist();
  }
  function current() { return {q:D.questions[session.ids[session.position]-1], e:session.entries[session.position]}; }
  function sessionName() {
    const f = session.config;
    return f.source === 'part' ? D.parts[f.topic] : f.source === 'theme' ? `${D.themes[f.topic-1] || D.devices[f.topic-11]}${f.number ? ` · билет № ${f.number}` : ''}` : f.source === 'fixed' ? `Билет № ${f.number}` : f.source === 'errors' ? 'Работа над ошибками' : f.source === 'x10' ? 'Случайный билет x10' : 'Случайный билет';
  }
  function tick() {
    if (!session || reviewing || session.completed || session.config.mode !== 'exam') return;
    if (C.expire(session)) { saveSession(); referenceDialog.close(); leaveDialog.close(); results(); return; }
    const seconds = Math.max(0, Math.ceil((session.deadline-Date.now())/1000)), clock = document.querySelector('#clock');
    if (clock) { clock.textContent = time(seconds); clock.classList.toggle('low', seconds <= 60); clock.setAttribute('aria-label', `Осталось ${Math.floor(seconds/60)} мин. ${seconds%60} сек.`); }
  }
  function feedback(q,e,concealed) {
    if (!e.attempts.length && !reviewing) return '';
    if (reviewing) {
      const answer = session.config.mode === 'practice' ? e.attempts[0] : e.answer;
      return `<div class="feedback ${answer === q.correct ? 'success' : 'error'}" role="status">${answer === undefined || answer === null ? 'Вы не ответили на этот вопрос.' : answer === q.correct ? 'Ваш ответ верный.' : 'В вашем ответе была ошибка.'}${answer === undefined || answer === null ? '' : ` Ваш ответ: ${esc(q.answers[answer])}`} Правильный ответ: ${esc(q.answers[q.correct])}</div>`;
    }
    if (concealed) return '<div class="feedback" role="status">Ответ принят. Результат будет доступен после завершения билета.</div>';
    if (e.done && e.answer === q.correct) return `<div class="feedback success" role="status">${e.attempts.length > 1 ? 'Верно со второй попытки.' : 'Верно.'} Можно перейти к следующему вопросу.</div>`;
    if (!e.done) return '<div class="feedback error" role="status">Неверно. Выберите другой вариант — у вас есть ещё одна попытка.</div>';
    return `<div class="feedback error" role="status">Неверно. Правильный ответ: ${esc(q.answers[q.correct])}${q.tip ? `<br>${esc(q.tip)}` : ''}</div>`;
  }
  function showQuestion() {
    stopTimer();
    if (!reviewing && C.expire(session)) { saveSession(); results(); return; }
    syncNav(); const {q,e} = current(), exam = session.config.mode === 'exam';
    const concealed = exam && session.config.source === 'x10' && !reviewing;
    const reveal = reviewing || (e.done && !concealed), locked = reviewing || e.done;
    const answer = reviewing && !exam ? e.attempts[0] : e.answer;
    main.innerHTML = `<div class="session-header"><div><div class="session-label">${reviewing ? 'Разбор билета' : exam ? 'Экзамен' : 'Тренировка'} · категория ${session.config.category === 'BC' ? 'B + C' : 'B'}</div><h1>${esc(sessionName())}</h1></div><div class="session-meta">${reviewing ? '' : `<span class="clock" id="clock">${exam ? time(Math.max(0, Math.ceil((session.deadline-Date.now())/1000))) : 'Без таймера'}</span>`}${button(reviewing ? 'К результату' : 'В меню',reviewing ? 'results' : 'leave','outline')}</div></div>
      <section class="panel question-card"><div class="eyebrow">Вопрос ${session.position+1} из ${session.ids.length}</div><h2 class="question-title" tabindex="-1">${esc(q.text)}</h2><div class="question-grid ${q.image ? '' : 'no-image'}">${q.image ? `<figure class="question-media"><button class="image-button" data-action="zoom" aria-label="Увеличить иллюстрацию"><img src="assets/questions/${q.image}.webp" alt="Дорожная ситуация к вопросу ${session.position+1}"></button><figcaption>Нажмите на изображение, чтобы увеличить</figcaption></figure>` : ''}<div class="answers" role="group" aria-label="Варианты ответа">${e.order.map((a,i) => `<button class="answer ${(!reviewing && e.selected === a) || (reviewing && answer === a) ? 'selected' : ''} ${reveal && a === q.correct ? 'correct' : ''} ${(reveal && answer === a && a !== q.correct) || (!reveal && !concealed && e.attempts.includes(a) && a !== q.correct) ? 'wrong' : ''}" data-answer="${a}" aria-pressed="${!reviewing && e.selected === a}" ${locked || e.attempts.includes(a) ? 'disabled' : ''}><span class="answer-number">${i+1}</span><span>${esc(q.answers[a])}</span></button>`).join('')}</div></div>
      ${feedback(q,e,concealed)}<div class="question-actions"><div class="helper-actions">${exam && !reviewing ? '' : button('Пояснение · X','comment','outline')+button('Пункт ПДД · Z','rules','outline')}</div>${reviewing ? button(session.position === session.ids.length-1 ? 'К результату' : 'Следующий вопрос',session.position === session.ids.length-1 ? 'results' : 'next') : button(e.done ? 'Следующий вопрос' : 'Ответить',e.done ? 'next' : 'submit','',!e.done && e.selected === null)}</div></section>
      <div class="question-nav" aria-label="Вопросы билета">${session.ids.map((id,i) => {
        const entry = session.entries[i];
        const status = !entry.done ? '' : concealed ? 'accepted' : entry.attempts[0] === D.questions[id-1].correct ? 'done' : 'missed';
        const label = !entry.done ? 'без ответа' : concealed ? 'ответ принят' : status === 'done' ? 'верно' : 'ошибка';
        return `<button class="question-dot ${i === session.position ? 'current' : ''} ${status}" data-question="${i}" aria-label="Вопрос ${i+1}, ${label}" ${i === session.position ? 'aria-current="step"' : ''}>${i+1}</button>`;
      }).join('')}</div><div class="navigator-footer"><span>${reviewing ? 'Выберите вопрос, чтобы открыть разбор.' : `Принято ответов: ${session.entries.filter(e=>e.done).length} из ${session.ids.length}. Можно пропускать вопросы и возвращаться к ним.`}</span>${reviewing ? '' : '<span><kbd>Пробел</kbd> следующий вопрос</span>'}</div>`;
    if (exam && !reviewing) { tick(); if (!session.completed) timer = setInterval(tick, 500); }
  }
  function choose(index) {
    if (!session || reviewing || C.expire(session)) { if (session?.completed && !reviewing) { saveSession(); results(); } return; }
    const {q,e} = current();
    if (e.done || !e.order.includes(index) || e.attempts.includes(index)) return;
    e.selected = index; saveSession(); showQuestion();
    document.querySelector(`[data-answer="${index}"]`)?.focus({preventScroll:true});
  }
  function submit() {
    if (!session || reviewing) return;
    const {q,e} = current(), accepted = C.submit(session,D.questions);
    if (accepted && e.done && !e.recorded) {
      const previous = saved.stats[q.id];
      saved.stats[q.id] = {times:(Number(previous?.times)||0)+1, firstCorrect:e.attempts[0] === q.correct, at:Date.now()};
      e.recorded = true;
    }
    saveSession();
    if (session.completed) results(); else { showQuestion(); document.querySelector(`[data-action="${e.done?'next':'submit'}"]`)?.focus({preventScroll:true}); }
  }
  function next() {
    if (!session) return;
    if (reviewing) { if (session.position === session.ids.length-1) { results(); return; } session.position++; }
    else {
      if (C.expire(session)) { saveSession(); results(); return; }
      const nextUnanswered = Array.from({length:session.ids.length},(_,i)=>(session.position+i+1)%session.ids.length).find(i=>!session.entries[i].done);
      if (nextUnanswered === undefined) { C.finish(session,'complete');saveSession();results();return; }
      session.position = nextUnanswered;
    }
    saveSession(); showQuestion(); focusQuestion();
  }
  function results() {
    stopTimer(); reviewing = false; syncNav();
    const r = C.result(session,D.questions), exam = session.config.mode === 'exam';
    const title = exam ? (r.passed ? 'Экзамен сдан' : 'Экзамен не сдан') : 'Тренировка завершена';
    const reason = session.completed.reason === 'timeout' ? 'Время истекло. На билет отводится 15 минут.' : session.completed.reason === 'second-error' ? 'Допущена вторая ошибка. Экзамен остановлен.' : exam ? 'Билет завершён. Допускается не больше одной ошибки.' : 'Все вопросы разобраны. Вы можете повторить сложные ситуации.';
    main.innerHTML = `${heading(title,esc(sessionName()))}<div class="result-grid"><section class="panel"><div class="eyebrow">${exam ? 'Верных ответов' : 'Верно с первой попытки'}</div><div class="result-score">${exam ? r.correct : r.firstCorrect}<span> / ${session.ids.length}</span></div><p class="result-title ${exam && !r.passed ? 'fail' : 'pass'}">${reason}</p><dl class="result-details"><div><dt>${exam?'Ошибок':'Сложных вопросов'}</dt><dd>${exam?r.wrong:r.wrongIds.length}</dd></div><div><dt>Без ответа</dt><dd>${r.unanswered}</dd></div><div><dt>Время</dt><dd>${time(r.seconds)}</dd></div></dl><div class="review-actions">${button('Разобрать билет','review','outline')}${button('В меню','menu')}</div>${r.wrongIds.length ? `<div class="review-actions">${button('Повторить ошибки','retry-errors','secondary')}</div>` : ''}</section><section class="panel"><h2>${r.wrongIds.length ? 'Вопросы для повторения' : 'Все ответы верные'}</h2>${r.wrongIds.length ? `<div class="review-list">${r.wrongIds.map(id=>{const i=session.ids.indexOf(id);return `<button class="review-item" data-review="${i}"><span>Вопрос ${i+1} · ${session.entries[i].done ? (exam ? 'неверный ответ' : 'ошибка в первой попытке') : 'без ответа'}</span><strong>${esc(D.questions[id-1].text)}</strong></button>`;}).join('')}</div>` : '<p class="small-copy">Попробуйте другой билет или перейдите к следующему разделу.</p>'}</section></div>`;
    main.focus({preventScroll:true}); main.scrollIntoView({block:'start',behavior:'instant'});
  }
  function showReference(title, html) {
    document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-body').innerHTML=html;
    if (!referenceDialog.open) referenceDialog.showModal();
    referenceDialog.scrollTop=0;
  }
  function explanation() {
    if (!session || (session.config.mode === 'exam' && !reviewing)) return;
    const {q}=current();
    const html = R.comments[q.comment] || (q.tip ? `<p>${esc(q.tip)}</p>` : q.rules.map(id=>`<div class="rule-entry">${R.rules[id] || ''}</div>`).join('')) || '<p>Для этого вопроса пояснение отсутствует в исходной базе.</p>';
    showReference('Пояснение',html);
  }
  function rules() {
    if (!session || (session.config.mode === 'exam' && !reviewing)) return;
    const {q}=current();showReference('Связанные пункты ПДД',q.rules.map(id=>`<div class="rule-entry">${R.rules[id] || ''}</div>`).join('') || '<p>Для этого вопроса нет связанного пункта ПДД.</p>');
  }
  function leave(target = page) {
    if (!session || session.completed) { page=target;home();return; }
    pendingLeave=target;
    document.querySelector('#leave-dialog p').textContent = session.config.mode === 'exam' ? 'Ответы сохранены. Таймер экзамена продолжит идти, пока вы в меню.' : 'Ответы сохранены. Этот билет можно продолжить из меню.';
    if (!leaveDialog.open) leaveDialog.showModal();
  }
  const textContainer = document.createElement('div');
  const bookItems = Object.entries(R.rules).map(([id,html])=>{textContainer.innerHTML=html;return {id:+id,html,text:textContainer.textContent.toLocaleLowerCase('ru')};}).sort((a,b)=>a.id-b.id);
  function book() {
    main.innerHTML = `${heading('Правила и справочник','ПДД Республики Беларусь, дорожные знаки, безопасность и устройство автомобиля.')}<section class="panel book-panel"><div class="book-controls"><div class="form-field"><label for="book-section">Раздел справочника</label><select id="book-section">${R.sections.map(s=>`<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></div><div class="form-field"><label for="book-search">Поиск по всему справочнику</label><input id="book-search" type="search" placeholder="Например: пешеходный переход" autocomplete="off" value="${esc(bookSearch)}"></div></div><div id="book-results" class="reference-body"></div></section>`;
    document.querySelector('#book-section').value=bookSection; renderBook();
  }
  function renderBook() {
    const index = R.sections.findIndex(s=>s.id===bookSection), end = R.sections[index+1]?.id || Infinity;
    const terms = bookSearch.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
    const items = bookItems.filter(entry=>terms.length ? terms.every(t=>entry.text.includes(t)) : entry.id>=bookSection && entry.id<end);
    const displayed = terms.length ? items.slice(0,bookLimit) : items;
    document.querySelector('#book-results').innerHTML = `${terms.length ? `<p class="muted search-count" role="status">Найдено: ${items.length}</p>` : ''}${displayed.map(entry=>`<div class="rule-entry" id="rule-${entry.id}">${entry.html}</div>`).join('') || '<p class="muted" role="status">По вашему запросу ничего не найдено.</p>'}${terms.length && items.length>displayed.length ? button('Показать ещё','more-book','outline') : ''}`;
  }
  main.addEventListener('click', event => {
    const t=event.target.closest('button'); if(!t || t.disabled)return;
    if(t.dataset.source){source=t.dataset.source;topic=source==='theme'?1:0;number=1;home();return;}
    if(t.dataset.answer!==undefined){choose(+t.dataset.answer);return;}
    if(t.dataset.question!==undefined){session.position=+t.dataset.question;saveSession();showQuestion();focusQuestion();return;}
    if(t.dataset.review!==undefined){session.position=+t.dataset.review;reviewing=true;showQuestion();focusQuestion();return;}
    const a=t.dataset.action;
    if(a==='start')start();
    else if(a==='submit')submit();
    else if(a==='next')next();
    else if(a==='leave')leave();
    else if(a==='menu')home();
    else if(a==='results')results();
    else if(a==='resume'&&saved.session){session=saved.session;category.value=session.config.category;page=session.config.mode;reviewing=false;showQuestion();focusQuestion();}
    else if(a==='last-result'&&saved.lastResult){session=saved.lastResult;category.value=session.config.category;page=session.config.mode;results();}
    else if(a==='review'){reviewing=true;session.position=0;showQuestion();focusQuestion();}
    else if(a==='retry-errors'){const ids=C.result(session,D.questions).wrongIds;begin({mode:'practice',source:'errors',category:session.config.category,ids});}
    else if(a==='comment')explanation();
    else if(a==='rules')rules();
    else if(a==='zoom'){const {q}=current();if(q.image)showReference('Иллюстрация к вопросу',`<img class="zoom-image" src="assets/questions/${q.image}.webp" alt="Иллюстрация к вопросу">`);}
    else if(a==='more-book'){bookLimit+=50;renderBook();}
    else if(a==='previous-ticket')stepTicket(-1);
    else if(a==='next-ticket')stepTicket(1);
    else if(a==='random-theme'){number=null;document.querySelector('#ticket-number').value='';updatePicker();}
  });
  main.addEventListener('change', event=>{
    if(event.target.id==='topic'){topic=+event.target.value;updatePicker();countLabel();}
    if(event.target.id==='book-section'){bookSection=+event.target.value;bookSearch='';bookLimit=50;document.querySelector('#book-search').value='';renderBook();}
  });
  main.addEventListener('input',event=>{if(event.target.id==='book-search'){bookSearch=event.target.value;bookLimit=50;renderBook();}if(event.target.id==='ticket-number'){number=event.target.value?Number(event.target.value):null;updatePicker();}});
  main.addEventListener('error',event=>{
    if(event.target.tagName==='IMG') { event.target.alt='Не удалось загрузить иллюстрацию. Проверьте, что папка assets находится рядом с index.html.';event.target.classList.add('image-error'); }
  },true);
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>leave(b.dataset.page)));
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();leave('practice');});
  category.addEventListener('change',()=>{saved.category=category.value;persist();home();});
  document.querySelector('#dialog-close').addEventListener('click',()=>referenceDialog.close());
  document.querySelector('#leave-cancel').addEventListener('click',()=>leaveDialog.close());
  document.querySelector('#leave-confirm').addEventListener('click',()=>{saveSession();leaveDialog.close();page=pendingLeave||page;home();});
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey || event.metaKey || event.altKey || event.repeat || referenceDialog.open || leaveDialog.open || event.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if(!session){if(event.key==='Enter'&&page!=='book'&&event.target===document.body){event.preventDefault();start();}return;}
    const key=event.key.toLowerCase();
    if (key === 'escape') { event.preventDefault(); leave(); return; }
    if (!document.querySelector('.question-title')) return;
    if ((key === 'enter' || key === ' ') && event.target.closest('button') && !event.target.closest('.answer')) return;
    if(/^[1-5]$/.test(key)&&!reviewing){event.preventDefault();const index=current().e.order[+key-1];if(index!==undefined)choose(index);}
    else if(key==='enter'){event.preventDefault();if(reviewing || current().e.done)next();else submit();}
    else if(key===' '){event.preventDefault();next();}
    else if(key==='x'||key==='ч'){event.preventDefault();explanation();}
    else if(key==='z'||key==='я'){event.preventDefault();rules();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  window.addEventListener('pagehide',()=>{if(session)saveSession();});
  function learningState() {
    const onQuestion = !!document.querySelector('.question-title');
    const visibleQuestion = session && onQuestion ? current() : null;
    return {view:onQuestion ? (reviewing ? 'review' : 'question') : session?.completed ? 'result' : page,
      category:category.value, mode:session?.config.mode || page,
      question:visibleQuestion ? {number:session.position+1,total:session.ids.length,text:visibleQuestion.q.text,
        answers:visibleQuestion.e.order.map(i=>visibleQuestion.q.answers[i]),accepted:visibleQuestion.e.done,
        feedback:document.querySelector('.feedback')?.textContent || ''} : null,
      result:session?.completed && !onQuestion ? C.result(session,D.questions) : null};
  }
  const toolContext = document.modelContext;
  if (toolContext?.registerTool) {
    const lifecycle = new AbortController();
    const register = tool => {
      try { Promise.resolve(toolContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch (_) {}
    };
    register({name:'get_learning_state',title:'Текущее состояние тренажёра',description:'Read the visible question, answer choices, feedback or final result. Active exams do not expose correct answers.',
      inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>learningState()});
    register({name:'start_training_ticket',title:'Начать тренировочный билет',description:'Start a local practice ticket. Replaces the unfinished ticket; accumulated question progress is retained. No timer or network access.',
      inputSchema:{type:'object',properties:{category:{type:'string',enum:['B','BC']},number:{type:'integer',minimum:1,maximum:99999}},required:['category','number'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},
      execute(input) {
        if (!input || !['B','BC'].includes(input.category) || !Number.isInteger(input.number) || input.number<1 || input.number>99999) throw new Error('Укажите категорию B или BC и целый номер билета от 1 до 99999.');
        if (referenceDialog.open || leaveDialog.open) throw new Error('Сначала закройте открытый диалог.');
        begin({mode:'practice',source:'fixed',category:input.category,number:input.number}); return learningState();
      }});
    register({name:'submit_question_answer',title:'Подтвердить ответ',description:'Select and confirm a one-based answer number from the current visible question. Saves progress and may complete an exam or practice ticket.',
      inputSchema:{type:'object',properties:{answer:{type:'integer',minimum:1,maximum:5}},required:['answer'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},
      execute(input) {
        if (!session || reviewing || session.completed || !document.querySelector('.question-title') || referenceDialog.open || leaveDialog.open) throw new Error('Нет активного вопроса для ответа.');
        const {e}=current();
        if (!Number.isInteger(input?.answer) || input.answer<1 || input.answer>e.order.length || e.done || e.attempts.includes(e.order[input.answer-1])) throw new Error('Этот вариант ответа недоступен.');
        choose(e.order[input.answer-1]); submit(); return learningState();
      }});
    register({name:'go_to_next_question',title:'Следующий вопрос',description:'Move to the next unanswered question, or to the next question during review. Does not confirm an unsubmitted choice.',
      inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},
      execute() {
        if (!session || !document.querySelector('.question-title') || referenceDialog.open || leaveDialog.open) throw new Error('Нет открытого билета.');
        next(); return learningState();
      }});
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
  home();
})();
