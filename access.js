(function(root){
  'use strict';
  const KEY='pdd-site-access-v1';
  const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  const bytes=text=>Uint8Array.from(text.match(/.{2}/g)||[],value=>parseInt(value,16));
  function valid(config){return Boolean(config&&config.schema===1&&Number.isInteger(config.iterations)&&config.iterations>=100000&&config.iterations<=1000000&&/^[a-f0-9]{32}$/.test(config.salt)&&/^[a-f0-9]{64}$/.test(config.verifier)&&/^[a-f0-9]{32}$/.test(config.revision));}
  async function verify(password,config){
    if(!valid(config)||typeof password!=='string'||!password)return false;
    const key=await root.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const digest=hex(await root.crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(config.salt),iterations:config.iterations,hash:'SHA-256'},key,256));
    let diff=0;for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^config.verifier.charCodeAt(i);
    return diff===0;
  }
  if(typeof module!=='undefined')module.exports={valid,verify};
  if(!root.document)return;
  const document=root.document,config=root.PddAccessConfig;
  let unlocked=false;
  function remembered(){try{return valid(config)&&root.localStorage.getItem(KEY)===config.revision;}catch(_){return false;}}
  function forget(){try{root.localStorage.removeItem(KEY);}catch(_){}root.location.reload();}
  function message(target,text){target.textContent=text;target.hidden=!text;}
  async function open(){
    if(unlocked)return;
    unlocked=true;
    document.querySelector('#site-access')?.remove();
    document.documentElement.removeAttribute('data-site-locked');
    const footer=document.querySelector('footer');
    if(footer){const controls=document.createElement('div');controls.className='site-access-controls';const exit=document.createElement('button');exit.type='button';exit.textContent='Выйти';exit.addEventListener('click',forget);controls.append(exit);footer.append(controls);}
    try{
      for(const entry of document.querySelectorAll('script[data-site-src]')){
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=entry.dataset.siteSrc;script.async=false;script.onload=resolve;script.onerror=reject;document.head.append(script);});
      }
    }catch(_){const main=document.querySelector('main');if(main){main.textContent='Не удалось загрузить программу. Обновите страницу.';}}
  }
  function start(){
    if(remembered()){open();return;}
    const gate=document.createElement('section');gate.id='site-access';gate.setAttribute('aria-label','Вход на сайт');
    gate.innerHTML='<div class="site-access-card"><span class="site-access-mark" aria-hidden="true">↗</span><p class="site-access-name">ПРАКТИКА ПДД</p><h1>Вход на сайт</h1><p class="site-access-intro">Введите пароль, чтобы открыть тренажёры.</p><form id="site-access-form"><label for="site-password">Пароль</label><div class="site-access-input"><input id="site-password" name="password" type="password" inputmode="numeric" autocomplete="current-password" required aria-describedby="site-access-error"><button type="button" id="site-password-toggle" aria-label="Показать пароль" aria-pressed="false">Показать</button></div><p id="site-access-error" class="site-access-error" role="alert" hidden></p><button type="submit" class="site-access-submit">Войти</button></form><p class="site-access-note">Вход сохранится в этом браузере. При следующем посещении пароль не потребуется.</p></div>';
    document.body.append(gate);
    const form=gate.querySelector('form'),input=gate.querySelector('input'),submit=form.querySelector('[type="submit"]'),error=gate.querySelector('#site-access-error'),toggle=gate.querySelector('#site-password-toggle');
    toggle.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'Скрыть':'Показать';toggle.setAttribute('aria-label',show?'Скрыть пароль':'Показать пароль');toggle.setAttribute('aria-pressed',String(show));});
    input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');message(error,'');});
    if(!valid(config)){message(error,'Вход временно недоступен. Обновите страницу.');submit.disabled=true;return;}
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(submit.disabled)return;
      submit.disabled=true;submit.textContent='Проверяем…';message(error,'');
      try{
        if(!await verify(input.value,config)){input.setAttribute('aria-invalid','true');message(error,'Неверный пароль. Попробуйте ещё раз.');input.focus();input.select();return;}
        input.value='';let saved=true;try{root.localStorage.setItem(KEY,config.revision);}catch(_){saved=false;}
        await open();
        if(!saved){const note=document.createElement('p');note.className='site-access-storage-note';note.textContent='Браузер не разрешил запомнить вход. При следующем посещении потребуется пароль.';document.querySelector('footer')?.append(note);}
      }catch(_){message(error,'Не удалось проверить пароль. Откройте сайт в современном браузере по HTTPS.');}
      finally{submit.disabled=false;submit.textContent='Войти';}
    });
  }
  root.addEventListener('storage',event=>{if(event.key===KEY&&unlocked&&!remembered())root.location.reload();});
  root.addEventListener('pageshow',event=>{if(event.persisted&&unlocked&&!remembered())root.location.reload();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(globalThis);
