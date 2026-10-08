
(function (root) {
  'use strict';
  const PATTERN = [1, 2, 2, 3, 3, 4, 4, 5, 6, 7];
  function random(seed) {
    let state = seed >>> 0;
    return n => { state = (Math.imul(state, 134775813) + 1) >>> 0; return Math.floor(state * n / 4294967296); };
  }
  function available(questions, category) { return questions.filter(q => category === 'BC' || q.category === 0); }
  function pools(questions, category) {
    const list = available(questions, category), result = {};
    for (let t = 1; t <= 17; t++) result[t] = list.filter(q => q.theme === t);
    return result;
  }
  function indexedPools(questions, category) {
    const p = pools(questions, category), rand = random(2012);
    for (let t = 1; t <= 17; t++) for (let i = 0; i < p[t].length; i++) {
      const j = rand(p[t].length); [p[t][i], p[t][j]] = [p[t][j], p[t][i]];
    }
    return p;
  }
  function fixedTicket(questions, category, number) {
    const p = indexedPools(questions, category);
    return PATTERN.map((theme, i) => {
      const a = p[theme], doubled = i >= 1 && i <= 6;
      let position = ((doubled ? number * 2 : number) % a.length) || a.length;
      if ([1, 3, 5].includes(i)) position = position === 1 ? a.length : position - 1;
      return a[position - 1];
    });
  }
  function shuffled(array, rand = n => Math.floor(Math.random() * n)) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) { const j = rand(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }
  function randomTicket(questions, category) {
    const p = pools(questions, category), used = new Set();
    return PATTERN.map(t => {
      const a = p[t].filter(q => !used.has(q.id)), q = a[Math.floor(Math.random() * a.length)]; used.add(q.id); return q;
    });
  }
  function build(questions, config) {
    const list = available(questions, config.category), p = pools(questions, config.category);
    if (config.source === 'errors') return list.filter(q => config.ids.includes(q.id));
    if (config.source === 'fixed') return fixedTicket(questions, config.category, config.number);
    if (config.source === 'random') return randomTicket(questions, config.category);
    if (config.source === 'x10') return shuffled(list.filter(q => q.theme <= 7)).slice(0, 10);
    const subset = config.source === 'part' ? list.filter(q => q.parts.includes(config.topic)) : p[config.topic];
    if (!subset || !subset.length) return [];
    if (config.source === 'theme') {
      if (config.number) {
        const indexed = indexedPools(questions, config.category)[config.topic];
        const offset = ((config.number - 1) * 10) % indexed.length;
        return Array.from({length: Math.min(10, indexed.length)}, (_, i) => indexed[(offset + i) % indexed.length]);
      }
      return shuffled(subset).slice(0, 10);
    }
    return subset;
  }
  function choices(q, shouldShuffle) { return shouldShuffle && q.rotate ? shuffled(q.answers.map((_, i) => i)) : q.answers.map((_, i) => i); }
  function createSession(questions, config, now = Date.now()) {
    const list = build(questions, config);
    return {schema:1, config:{...config}, ids:list.map(q => q.id), position:0,
      entries:list.map(q => ({order:choices(q, config.mode === 'exam'), selected:null, answer:null, attempts:[], done:false})),
      start:now, deadline:config.mode === 'exam' ? now + 15*60*1000 : null, completed:null};
  }
  function validSession(s, questions) {
    try {
      if (!s || s.schema !== 1 || !s.config || !['practice','exam'].includes(s.config.mode) || !['B','BC'].includes(s.config.category) ||
          !['part','theme','fixed','random','x10','errors'].includes(s.config.source) || !Array.isArray(s.ids) || !s.ids.length || s.ids.length > questions.length ||
          new Set(s.ids).size !== s.ids.length || !Array.isArray(s.entries) || s.entries.length !== s.ids.length || !Number.isInteger(s.position) || s.position < 0 || s.position >= s.ids.length ||
          !Number.isFinite(s.start) || (s.config.mode === 'exam' && !Number.isFinite(s.deadline)) ||
          (s.completed && (!Number.isFinite(s.completed.at) || !['complete','timeout','second-error'].includes(s.completed.reason)))) return false;
      if (s.config.source === 'part' && (!Number.isInteger(s.config.topic) || s.config.topic < 0 || s.config.topic > 47)) return false;
      if (s.config.source === 'theme' && ![1,2,3,4,5,6,7,11,12,13,14,15,16,17].includes(s.config.topic)) return false;
      if (s.config.source === 'fixed' && (!Number.isInteger(s.config.number) || s.config.number < 1 || s.config.number > 99999)) return false;
      return s.ids.every((id, i) => {
        const q = questions[id-1], e = s.entries[i];
        const validChoice = a => a === null || (Number.isInteger(a) && a >= 0 && a < q.answers.length);
        return q && q.id === id && (s.config.category === 'BC' || q.category === 0) && e && typeof e.done === 'boolean' && Array.isArray(e.order) &&
          e.order.length === q.answers.length && new Set(e.order).size === q.answers.length && e.order.every(a => a !== null && validChoice(a)) &&
          validChoice(e.selected) && validChoice(e.answer) && Array.isArray(e.attempts) && e.attempts.length <= 2 && e.attempts.every(a => a !== null && validChoice(a)) &&
          (!e.done || e.answer !== null);
      });
    } catch (_) { return false; }
  }
  function finish(s, reason, now = Date.now()) { if (!s.completed) s.completed = {reason, at:now}; }
  function expire(s, now = Date.now()) {
    if (!s.completed && s.config.mode === 'exam' && now >= s.deadline) finish(s, 'timeout', s.deadline);
    return !!s.completed;
  }
  function submit(s, questions, now = Date.now()) {
    if (expire(s, now)) return false;
    const q = questions[s.ids[s.position]-1], e = s.entries[s.position];
    if (e.done || e.selected === null || e.attempts.includes(e.selected)) return false;
    e.answer = e.selected; e.attempts.push(e.selected);
    e.done = s.config.mode === 'exam' || e.answer === q.correct || e.attempts.length >= 2;
    if (!e.done) e.selected = null;
    if (s.config.mode === 'exam' && s.config.source !== 'x10' && s.entries.filter((entry, i) => entry.done && entry.answer !== questions[s.ids[i]-1].correct).length >= 2) finish(s, 'second-error', now);
    else if (s.entries.every(entry => entry.done)) finish(s, 'complete', now);
    return true;
  }
  function result(s, questions) {
    const done = s.entries.filter(e => e.done).length;
    const correct = s.entries.filter((e,i) => e.done && e.answer === questions[s.ids[i]-1].correct).length;
    const firstCorrect = s.entries.filter((e,i) => e.attempts[0] === questions[s.ids[i]-1].correct).length;
    const wrongIds = s.ids.filter((id,i) => !s.entries[i].done || s.entries[i].attempts[0] !== questions[id-1].correct);
    return {done, correct, firstCorrect, wrong:done-correct, unanswered:s.ids.length-done, wrongIds,
      passed:done === s.ids.length && done-correct <= 1 && s.completed?.reason === 'complete',
      seconds:Math.max(0, Math.round(((s.completed?.at || Date.now())-s.start)/1000))};
  }
  const api = {PATTERN, random, available, pools, indexedPools, fixedTicket, randomTicket, shuffled, build, choices, createSession, validSession, finish, expire, submit, result};
  root.PddCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
