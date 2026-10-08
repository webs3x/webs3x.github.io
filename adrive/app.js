(() => {
  'use strict';
  const data=window.ADriveData,reference=window.ADriveReference,core=window.ADriveCore;
  const main=document.querySelector('main'),modal=document.querySelector('#modal');
  if(!data||!reference||!core){main.textContent='База не загрузилась. Убедитесь, что папки data и assets находятся рядом с index.html.';return;}
  const questions=new Map(data.questions.map(q=>[q.id,q])),sets=new Map(data.sets.map(s=>[s.id,s])),units=new Map(reference.units.map(u=>[u.id,u]));
  const KEY='pdd-practice-adrive-5-v1';
  let page='practice',source='ticket',setId=data.sets[0].id,number=1,chapterId=data.chapters[0]?.id,session=null,review=false,bookUnit='ch1',saveWarning=false;
  let progress={},notice='';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalized=text=>String(text).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
  const questionCount=n=>`${n} ${n%10===1&&n%100!==11?'вопрос':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'вопроса':'вопросов'}`;
  function cleanProgress(input){
    if(!input||typeof input!=='object'||Array.isArray(input))return {};
    const output={};
    for(const q of data.questions){const p=input[q.id];if(p&&Number.isInteger(p.seen)&&p.seen>=0&&typeof p.wrong==='boolean'&&Array.isArray(p.contexts))output[q.id]={seen:Math.min(p.seen,100000),wrong:p.wrong,contexts:[...new Set(p.contexts.filter(c=>['chapter','theme','complex'].includes(c)))]};}
    return output;
  }
  try{const stored=JSON.parse(localStorage.getItem(KEY));if(stored?.schema===1){progress=cleanProgress(stored.progress);if(core.valid(stored.session,questions))session=stored.session;if(stored.config){const c=stored.config;if(['ticket','chapter','random','errors'].includes(c.source))source=c.source;if(sets.has(c.setId))setId=c.setId;if(data.chapters.some(ch=>ch.id===c.chapterId))chapterId=c.chapterId;if(Number.isInteger(c.number))number=c.number;}}}catch(_){notice='Сохранённые данные не удалось прочитать. Вы можете начать новую тренировку.';}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({schema:1,version:data.version,progress,session,config:{source,setId,number,chapterId}}));saveWarning=false;}catch(_){saveWarning=true;}}
  const errors=()=>data.questions.filter(q=>progress[q.id]?.wrong).map(q=>q.id);
  function ticket(){return sets.get(setId).tickets.find(t=>t.number===number)||sets.get(setId).tickets[0];}
  function clampNumber(){const list=sets.get(setId).tickets;const max=list[list.length-1].number;number=Math.max(list[0].number,Math.min(max,Math.trunc(Number(number)||1)));if(!list.some(t=>t.number===number))number=list[0].number;return max;}
  function updateNav(){document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});}
  function focusMain(){main.focus({preventScroll:true});main.scrollIntoView({behavior:'auto',block:'start'});}
  function button(label,action,cls=''){return `<button class="button ${cls}" data-action="${action}">${label}</button>`;}
  function stats(){const seen=Object.values(progress).filter(p=>p.seen>0).length,mastered=Object.values(progress).filter(p=>p.contexts.length===3).length;return `<section class="panel"><h2>Ваша подготовка</h2><div class="stat"><span>Разобрано вопросов</span><span><strong>${seen}</strong> / ${questions.size}</span></div><div class="progress"><span style="width:${seen/questions.size*100}%"></span></div><div class="stat"><span>Закреплено в трёх режимах</span><strong>${mastered}</strong></div><div class="stat"><span>В работе над ошибками</span><strong>${errors().length}</strong></div><p class="small">Закрепляйте каждый вопрос по главе, в тематическом и комплексном билетах.</p><div class="helpers">${button('Сохранить прогресс','export')}${button('Загрузить','import')}</div><input id="progress-file" type="file" accept="application/json,.json" hidden></section>`;}
  function home(){
    review=false;updateNav();const exam=page==='exam',max=clampNumber(),options=[['ticket','По билетам','Исходные наборы вопросов'],['chapter','По главам','Все вопросы раздела'],['random','Случайный билет','10 вопросов из всей базы'],['errors','Работа над ошибками',questionCount(errors().length)]];
    const count=source==='ticket'?ticket().questions.length:source==='chapter'?data.questions.filter(q=>q.chapters.includes(chapterId)).length:source==='errors'?errors().length:10;
    let fields='';
    if(source==='ticket')fields=`<div class="field"><label for="ticket-set">Набор билетов</label><select id="ticket-set">${data.sets.map(s=>`<option value="${s.id}" ${s.id===setId?'selected':''}>${esc(s.title)}</option>`).join('')}</select></div><div class="field"><label for="ticket-number">Номер билета</label><div class="ticket-picker"><button class="arrow" data-action="ticket-prev" aria-label="Предыдущий билет" ${number<=1?'disabled':''}>‹</button><div class="ticket-value"><input id="ticket-number" type="number" inputmode="numeric" min="1" max="${max}" value="${number}"><span aria-label="Всего билетов">/ ${max}</span></div><button class="arrow" data-action="ticket-next" aria-label="Следующий билет" ${number>=max?'disabled':''}>›</button></div></div>`;
    if(source==='chapter')fields=`<div class="field"><label for="chapter">Глава или раздел</label><select id="chapter">${data.chapters.map(c=>`<option value="${c.id}" ${c.id===chapterId?'selected':''}>${esc(c.name)}. ${esc(c.title)} (${c.count})</option>`).join('')}</select></div>`;
    main.innerHTML=`<div class="intro"><h1>${exam?'Проверьте готовность к экзамену':'Выберите тренировку'}</h1><p>${exam?'15 минут на билет. Результат и пояснения — после завершения.':'Решайте вопросы в удобном темпе и разбирайте дорожные ситуации.'}</p></div>${notice?`<p class="notice">${esc(notice)}</p>`:''}<div class="grid"><section class="panel"><h2>${exam?'Режим проверки':'Режим тренировки'}</h2><div class="modes">${options.map(([id,title,help])=>`<button class="mode ${source===id?'selected':''}" data-source="${id}" aria-pressed="${source===id}"><strong>${title}</strong><small>${help}</small></button>`).join('')}</div>${fields}<div class="start"><div class="start-info"><strong>${questionCount(count)}</strong><span>${exam?'15 минут · до 1 ошибки':'Без таймера'}</span></div><button class="button primary wide" data-action="start" ${count?'':'disabled'}>${exam?'Начать экзамен':'Начать тренировку'}</button></div></section><div class="stack">${session&&!session.finished?`<section class="panel soft"><h2>Незавершённый билет</h2><p class="small">${esc(session.title)}. Ответы сохранены.</p>${button('Продолжить билет','resume','primary wide')}</section>`:''}${stats()}<section class="panel"><h2>Учебная база</h2><p class="small">${questions.size.toLocaleString('ru')} вопрос · ${data.sets.length} наборов билетов · категория B</p><p class="small">Версия ${esc(data.version)}. Материалы Беларуси.</p></section></div></div>`;
  }
  function openDialog(title,body){document.querySelector('#modal-title').textContent=title;document.querySelector('#modal-body').innerHTML=body;if(!modal.open)modal.showModal();}
  function navigate(next){if(session&&!session.finished&&main.querySelector('.question-card')){openDialog('Вернуться в меню?','<p>Ответы сохранены. Этот билет можно продолжить из меню.</p><div class="result-actions">'+button('Продолжить решение','close')+`<button class="button primary" data-go="${next}">В меню</button></div>`);return;}go(next);}
  function go(next){page=next;review=false;if(page==='book')showBook();else home();focusMain();}
  function start(){
    let ids,title,context;
    if(source==='ticket'){ids=ticket().questions;title=sets.get(setId).title+' · № '+number;context=setId===200?'complex':'theme';}
    else if(source==='chapter'){ids=data.questions.filter(q=>q.chapters.includes(chapterId)).map(q=>q.id);title=data.chapters.find(c=>c.id===chapterId).title;context='chapter';}
    else if(source==='errors'){ids=errors();title='Работа над ошибками';context='errors';}
    else{ids=core.shuffled(data.questions.map(q=>q.id)).slice(0,10);title='Случайный билет';context='random';}
    session=core.create(ids,page==='exam'?'exam':'practice',title,context);save();renderQuestion();focusMain();
  }
  function renderQuestion(){
    if(!session)return home();
    if(!review&&core.expire(session)){save();return showResults();}
    page=session.mode==='exam'?'exam':'practice';updateNav();
    const q=questions.get(session.ids[session.position]),entry=session.entries[session.position],showAnswers=review||(session.mode==='practice'&&(entry.done||entry.attempts.length>0));
    const feedback=showAnswers&&(entry.done||review)?`<div class="feedback ${entry.answer===q.correct?'':'wrong'}" role="status"><p><strong>${entry.answer===q.correct?'Верно.':entry.answer===null?'Ответ не был дан.':'Правильный ответ: '+(q.correct+1)+'.'}</strong></p>${q.comment}</div>`:entry.attempts.length&&session.mode==='practice'?'<div class="feedback wrong" role="status">Этот ответ неверен. Попробуйте ещё раз.</div>':'';
    const remaining=Math.max(0,Math.ceil((session.deadline-Date.now())/1000));
    main.innerHTML=`<div class="session-head"><div><p class="small">${review?'Просмотр результата':session.mode==='exam'?'Экзамен':'Тренировка'} · категория B</p><h1>${esc(session.title)}</h1></div><div class="session-tools"><span class="clock ${remaining<120&&session.mode==='exam'?'urgent':''}" id="clock">${session.mode==='exam'&&!review?clockText(remaining):'Без таймера'}</span>${button('В меню','menu')}</div></div><section class="panel question-card"><p class="question-number">Вопрос ${session.position+1} / ${session.ids.length}</p><h2 class="question-title">${esc(q.text)}</h2><div class="question-layout ${q.image?'':'no-image'}">${q.image?`<button class="image-button" data-action="image" style="padding:0;border:0;background:transparent;align-self:start" aria-label="Увеличить изображение"><img class="question-image" src="${q.image}" alt="Дорожная ситуация к вопросу"></button>`:''}<div class="answers">${q.answers.map((answer,i)=>`<button class="answer ${entry.selected===i?'selected':''} ${showAnswers&&(entry.done||review)&&i===q.correct?'correct':''} ${showAnswers&&entry.attempts.includes(i)&&i!==q.correct?'wrong':''}" data-answer="${i}" aria-pressed="${entry.selected===i}" ${entry.done||review||entry.attempts.includes(i)?'disabled':''}><span class="answer-number">${i+1}</span><span>${esc(answer)}</span></button>`).join('')}</div></div>${feedback}<div class="actions"><div class="helpers">${button('Пояснение','comment')}${button('Пункты ПДД','references')}</div>${review||entry.done?button(session.position===session.ids.length-1?'Результат':'Следующий вопрос','next','primary'):button('Ответить','submit','primary')}</div></section><div class="dots" aria-label="Навигация по вопросам">${session.ids.map((id,i)=>{const e=session.entries[i];const status=review||session.mode==='practice'?e.done?(e.answer===questions.get(id).correct?'correct':'wrong'):'':e.done?'done':'';return `<button class="dot ${i===session.position?'current':''} ${status}" data-position="${i}" aria-label="Вопрос ${i+1}" ${i===session.position?'aria-current="step"':''}>${i+1}</button>`;}).join('')}</div><p class="navigator-hint">${review?'Можно просмотреть любой вопрос.':'Выбирайте ответ кнопкой или клавишей с его номером.'}${saveWarning?' Браузер не разрешил сохранить прогресс.':''}</p>`;
    const submitButton=main.querySelector('[data-action="submit"]');if(submitButton)submitButton.disabled=entry.selected===null;
  }
  function submit(){
    const entry=session.entries[session.position],q=questions.get(session.ids[session.position]),first=entry.attempts.length===0;
    if(!core.submit(session,questions))return;
    if(first){const rec=progress[q.id]||{seen:0,wrong:false,contexts:[]};rec.seen++;rec.wrong=entry.answer!==q.correct;if(!rec.wrong&&['chapter','theme','complex'].includes(session.context)&&!rec.contexts.includes(session.context))rec.contexts.push(session.context);progress[q.id]=rec;}
    save();if(session.finished)showResults();else renderQuestion();
  }
  function next(){if(!session)return;if(session.finished&&!review)return showResults();const nextIndex=review?session.position+1:session.entries.findIndex((e,i)=>i>session.position&&!e.done);if(nextIndex>=0&&nextIndex<session.ids.length)session.position=nextIndex;else{const pending=session.entries.findIndex(e=>!e.done);if(pending>=0&&!review)session.position=pending;else return showResults();}save();renderQuestion();focusMain();}
  function showResults(){
    review=false;updateNav();const r=core.result(session,questions),exam=session.mode==='exam';let title=exam?r.passed?'Экзамен сдан':'Экзамен не сдан':'Тренировка завершена';const reason=session.finished?.reason==='timeout'?'Время истекло.':session.finished?.reason==='second-error'?'Экзамен завершён после второй ошибки.':'Билет завершён.';
    main.innerHTML=`<div class="result"><div class="intro"><h1>${title}</h1><p>${esc(session.title)}</p></div><section class="panel"><p class="small">${reason}</p><div class="score">${r.correct}<span> / ${session.ids.length}</span></div><dl><div><dt>С первого раза</dt><dd>${r.first}</dd></div><div><dt>Ошибок</dt><dd>${r.wrong}</dd></div><div><dt>Без ответа</dt><dd>${r.unanswered}</dd></div></dl><div class="result-actions">${button('Посмотреть ответы','review')}${r.errors.length?button('Повторить ошибки','repeat-errors','primary'):''}${button('В меню','menu')}</div></section>${r.errors.length?`<section class="panel" style="margin-top:16px"><h2>Вопросы для повторения</h2>${r.errors.map(id=>`<button class="review-row" data-review="${id}">${esc(questions.get(id).text)}</button>`).join('')}</section>`:''}</div>`;focusMain();
  }
  function clockText(seconds){return Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');}
  function showBook(){
    updateNav();if(!units.has(bookUnit))bookUnit=reference.units[0]?.id;
    main.innerHTML=`<div class="intro"><h1>Правила и справочник</h1><p>Найдите нужный раздел или слово в материалах учебной базы.</p></div><div class="book-filter"><input id="book-search" type="search" placeholder="Поиск по справочнику" aria-label="Поиск по справочнику"><select id="book-unit" aria-label="Раздел справочника">${reference.units.map(u=>`<option value="${esc(u.id)}" ${u.id===bookUnit?'selected':''}>${esc(u.title)}</option>`).join('')}</select></div><div id="book-content"></div>`;bookContent('');
  }
  const textFromHTML=html=>{const node=document.createElement('div');node.innerHTML=html;return node.textContent;};
  const unitSearch=new Map(reference.units.map(u=>[u.id,normalized(u.title+' '+textFromHTML(u.html))]));
  function bookContent(query){
    const target=document.querySelector('#book-content'),search=normalized(query);
    if(!search){target.innerHTML=`<article class="panel reference">${units.get(bookUnit)?.html||'<p>Раздел не найден.</p>'}</article>`;return;}
    const matches=reference.units.filter(u=>unitSearch.get(u.id).includes(search));
    target.innerHTML=`<p class="search-count">Найдено разделов: ${matches.length}</p>${matches.map(u=>`<button class="book-item" data-unit="${esc(u.id)}">${esc(u.title)}</button>`).join('')}`;
  }
  function showReferences(){
    if(session.mode==='exam'&&!session.finished){return openDialog('Справочник после экзамена','<p>Связанные пункты доступны после завершения экзамена.</p>');}
    const q=questions.get(session.ids[session.position]);const entries=q.references.map(id=>reference.items[id]).filter(Boolean);
    openDialog('Связанные пункты',entries.length?`<div class="reference">${entries.map(item=>item.html||`<p><strong>${/^\d+(?:[._]\d+)*$/.test(item.number)?'Пункт '+esc(item.number):'Дополнительный учебный материал'}</strong></p><p>Текст этого материала отсутствует в справочнике исходной версии. Используйте пояснение к вопросу.</p>`).join('')}</div>`:'<p>Для этого вопроса отдельные пункты в базе не указаны.</p>');
  }
  function exportProgress(){const blob=new Blob([JSON.stringify({schema:1,version:data.version,progress},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pdd-progress-5.0.425.0.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function importProgress(file){if(!file)return;try{if(file.size>2000000)throw Error('Файл слишком большой.');const imported=JSON.parse(await file.text());if(imported.schema!==1||imported.version!==data.version)throw Error('Файл относится к другой базе вопросов.');const incoming=cleanProgress(imported.progress);for(const [id,value]of Object.entries(incoming)){const old=progress[id];progress[id]=old?{seen:Math.max(old.seen,value.seen),wrong:old.wrong||value.wrong,contexts:[...new Set([...old.contexts,...value.contexts])]}:value;}save();notice='Прогресс загружен. Достижения объединены с текущими.';home();}catch(e){openDialog('Не удалось загрузить прогресс','<p>'+esc(e.message)+'</p>');}}
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    if(target.classList.contains('brand')){event.preventDefault();return navigate('practice');}
    if(target.dataset.page)return navigate(target.dataset.page);
    if(target.dataset.go){modal.close();return go(target.dataset.go);}
    if(target.dataset.source){source=target.dataset.source;save();return home();}
    if(target.dataset.answer!==undefined&&session){const e=session.entries[session.position];if(!e.done&&!review){e.selected=Number(target.dataset.answer);save();renderQuestion();}return;}
    if(target.dataset.position!==undefined&&session){session.position=Number(target.dataset.position);save();renderQuestion();focusMain();return;}
    if(target.dataset.review){review=true;session.position=session.ids.indexOf(Number(target.dataset.review));return renderQuestion();}
    if(target.dataset.unit){bookUnit=target.dataset.unit;showBook();focusMain();return;}
    if(modal.open&&target.getAttribute('href')?.startsWith('#')){event.preventDefault();const id=target.getAttribute('href').slice(1),local=[...document.querySelectorAll('#modal-body [id]')].find(el=>el.id===id);if(local){local.scrollIntoView({block:'center'});return;}const item=Object.values(reference.items).find(r=>r.anchor===id&&r.html);if(item){openDialog('Пункт '+item.number,'<div class="reference">'+item.html+'</div>');return;}const unit=reference.units.find(u=>u.id===id||u.html.includes('id="'+id+'"'));if(unit){openDialog(unit.title,'<div class="reference">'+unit.html+'</div>');document.getElementById(id)?.scrollIntoView({block:'center'});}return;}
    if(page==='book'&&target.getAttribute('href')?.startsWith('#')){const id=target.getAttribute('href').slice(1);const unit=reference.units.find(u=>u.id===id||u.html.includes('id="'+id+'"'));if(unit){event.preventDefault();bookUnit=unit.id;showBook();document.getElementById(id)?.scrollIntoView({block:'center'});}return;}
    const action=target.dataset.action;
    if(action==='start')return start();
    if(action==='resume'){review=false;renderQuestion();focusMain();return;}
    if(action==='submit')return submit();
    if(action==='next')return next();
    if(action==='menu')return navigate(page);
    if(action==='ticket-prev'||action==='ticket-next'){number+=action==='ticket-prev'?-1:1;clampNumber();save();return home();}
    if(action==='references')return showReferences();
    if(action==='comment'){if(session.mode==='exam'&&!session.finished){return openDialog('Пояснения после экзамена','<p>Пояснения и правильные ответы доступны после завершения экзамена.</p>');}const q=questions.get(session.ids[session.position]);return openDialog('Пояснение','<div class="reference">'+(q.comment||'<p>Отдельного пояснения в базе нет.</p>')+'</div>');}
    if(action==='image'){const q=questions.get(session.ids[session.position]);return openDialog('Изображение к вопросу',`<img class="full-image" src="${q.image}" alt="Увеличенная дорожная ситуация"><p><a href="${q.image}" target="_blank" rel="noopener noreferrer">Открыть в полном размере</a></p>`);}
    if(action==='review'){review=true;session.position=0;renderQuestion();focusMain();return;}
    if(action==='repeat-errors'){const r=core.result(session,questions);session=core.create(r.errors,'practice','Работа над ошибками','errors');save();renderQuestion();focusMain();return;}
    if(action==='close'||target.classList.contains('close'))return modal.close();
    if(action==='export')return exportProgress();
    if(action==='import')document.querySelector('#progress-file').click();
  });
  document.addEventListener('change',event=>{const el=event.target;if(el.id==='ticket-set'){setId=Number(el.value);number=1;save();home();}else if(el.id==='ticket-number'){number=Number(el.value);clampNumber();save();home();}else if(el.id==='chapter'){chapterId=Number(el.value);save();home();}else if(el.id==='book-unit'){bookUnit=el.value;bookContent('');document.querySelector('#book-search').value='';}else if(el.id==='progress-file')importProgress(el.files[0]);});
  document.addEventListener('input',event=>{if(event.target.id==='book-search')bookContent(event.target.value);});
  document.addEventListener('keydown',event=>{if(modal.open||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)||!main.querySelector('.question-card'))return;const n=Number(event.key);if(Number.isInteger(n)&&n>0&&n<=5){const button=main.querySelector(`[data-answer="${n-1}"]`);if(button&&!button.disabled){event.preventDefault();button.click();}}else if(event.key==='Enter'){const button=main.querySelector('[data-action="submit"]')||main.querySelector('[data-action="next"]');if(button&&!button.disabled){event.preventDefault();button.click();}}});
  setInterval(()=>{if(!session||session.finished||session.mode!=='exam')return;if(core.expire(session)){save();if(main.querySelector('.question-card')){modal.close();showResults();}return;}const clock=document.querySelector('#clock');if(clock){const remaining=Math.max(0,Math.ceil((session.deadline-Date.now())/1000));clock.textContent=clockText(remaining);clock.classList.toggle('urgent',remaining<120);}},1000);
  home();
})();
