(function(root){
  'use strict';
  const shuffled = list => { const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy; };
  function create(ids, mode, title, context, now=Date.now()){
    if(!ids.length || new Set(ids).size!==ids.length) throw Error('Пустой или некорректный билет');
    return {schema:1,ids:[...ids],mode,title,context,position:0,entries:ids.map(()=>({selected:null,answer:null,attempts:[],done:false})),started:now,deadline:mode==='exam'?now+900000:null,finished:null};
  }
  function valid(s, questions){
    if(!s || s.schema!==1 || !['practice','exam'].includes(s.mode) || typeof s.title!=='string' || typeof s.context!=='string' || !Array.isArray(s.ids) || !s.ids.length || s.ids.length>questions.size || new Set(s.ids).size!==s.ids.length || !Array.isArray(s.entries) || s.entries.length!==s.ids.length || !Number.isInteger(s.position) || s.position<0 || s.position>=s.ids.length || !Number.isFinite(s.started) || (s.mode==='exam'&&!Number.isFinite(s.deadline)) || (s.finished&&(!Number.isFinite(s.finished.at)||!['complete','timeout','second-error'].includes(s.finished.reason))))return false;
    return s.ids.every((id,i)=>{const q=questions.get(id),e=s.entries[i];const choice=a=>a===null||(Number.isInteger(a)&&a>=0&&a<q.answers.length);return q&&e&&typeof e.done==='boolean'&&choice(e.selected)&&choice(e.answer)&&Array.isArray(e.attempts)&&e.attempts.length<=2&&e.attempts.every(a=>a!==null&&choice(a))&&(!e.done||e.answer!==null);});
  }
  function expire(s,now=Date.now()){if(!s.finished&&s.mode==='exam'&&now>=s.deadline)s.finished={reason:'timeout',at:s.deadline};return Boolean(s.finished);}
  function submit(s,questions,now=Date.now()){
    if(expire(s,now))return false;
    const entry=s.entries[s.position],question=questions.get(s.ids[s.position]);
    if(entry.done || entry.selected===null || entry.attempts.includes(entry.selected))return false;
    entry.answer=entry.selected;entry.attempts.push(entry.selected);
    entry.done=s.mode==='exam'||entry.answer===question.correct||entry.attempts.length===2;
    if(!entry.done)entry.selected=null;
    const wrong=s.entries.filter((e,i)=>e.done&&e.answer!==questions.get(s.ids[i]).correct).length;
    if(s.mode==='exam'&&wrong>=2)s.finished={reason:'second-error',at:now};
    else if(s.entries.every(e=>e.done))s.finished={reason:'complete',at:now};
    return true;
  }
  function result(s,questions){
    const answered=s.entries.filter(e=>e.done).length,correct=s.entries.filter((e,i)=>e.done&&e.answer===questions.get(s.ids[i]).correct).length;
    return {answered,correct,wrong:answered-correct,first:s.entries.filter((e,i)=>e.attempts[0]===questions.get(s.ids[i]).correct).length,unanswered:s.ids.length-answered,errors:s.ids.filter((id,i)=>s.entries[i].attempts[0]!==questions.get(id).correct),passed:s.finished?.reason==='complete'&&answered===s.ids.length&&answered-correct<=1};
  }
  const api={shuffled,create,valid,expire,submit,result};root.ADriveCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
