(function(){
  'use strict';
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const data=window.DARYA_MENU_DATA;
  const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const now=new Date();
  const dayKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const dateStr=now.getDate()+' '+months[now.getMonth()];
  const STORAGE={prefs:'dasha_prefs_v5',menu:'dasha_menu_'+dayKey,mood:'dasha_mood_'+dayKey,water:'dasha_water_'+dayKey,day:'dasha_day_'+dayKey,shared:'dasha_shared_v5',logs:'dasha_logs_v5'};
  const safeGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
  const safeSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const safeRemove=k=>{try{localStorage.removeItem(k)}catch(e){}};
  const escapeText=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let toastTimer;
  function showToast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}

  $('#today').textContent='Сегодня · '+dateStr;
  $('#menuDate').textContent=dateStr;

  const getPrefs=()=>{try{return JSON.parse(safeGet(STORAGE.prefs)||'{}')}catch(e){return {}}};
  const setPrefs=p=>safeSet(STORAGE.prefs,JSON.stringify(p));
  const loadCustomMenu=()=>{try{return JSON.parse(safeGet(STORAGE.menu)||'{}')}catch(e){return {}}};
  const saveCustomMenu=m=>safeSet(STORAGE.menu,JSON.stringify(m));
  let activePlan=data.plans[0];
  let weatherKind='normal';
  let currentWeatherSummary='Погода ещё не загружена';

  function initPrefs(){
    const prefs=getPrefs();
    $('#allergyGrid').innerHTML=data.allergyOptions.map(([id,label])=>`<label class="check-card"><input type="checkbox" value="${id}" ${(prefs.allergies||[]).includes(id)?'checked':''}>${label}</label>`).join('');
    $('#customAllergy').value=(prefs.customAllergy||[]).join(', ');
    $('#foodLikes').value=prefs.foodLikes||'';
  }
  function collectPrefs(){
    return {
      allergies: $$('#allergyGrid input:checked').map(x=>x.value),
      customAllergy: $('#customAllergy').value.split(',').map(x=>x.trim()).filter(Boolean),
      foodLikes: $('#foodLikes').value.trim()
    };
  }

  function pickBasePlan(){
    const dayOfYear=Math.floor((now-new Date(now.getFullYear(),0,0))/86400000);
    return {...data.plans[dayOfYear%data.plans.length]};
  }
  function applyAllergies(plan){
    const prefs=getPrefs();
    const blocked=new Set(prefs.allergies||[]);
    const p={...plan};
    blocked.forEach(id=>{
      const opt=data.allergyOptions.find(x=>x[0]===id);
      const label=opt ? opt[1] : id;
      const rx=new RegExp(label,'i');
      ['breakfast','lunch','snack','dinner'].forEach(k=>{
        if((p.tags||[]).includes(id)||rx.test(p[k])) p[k]=data.replacements[id]||'Безопасная замена по вкусу';
      });
    });
    if((prefs.customAllergy||[]).length) p.tip+=' Исключения учтены: '+prefs.customAllergy.join(', ')+'.';
    return p;
  }
  function applyWeather(plan){
    const p={...plan};
    if(weatherKind==='cold'){
      p.title='Тёплый день восстановления';
      p.dinner='Тёплый суп или рагу';
      p.tip='Сегодня холодно: прогулка короткая, одежда тёплая, после — отдых.';
    }
    if(weatherKind==='rain'){
      p.title='Домашний мягкий день';
      p.snack='Тёплый напиток и фрукт';
      p.tip='Осадки: прогулку можно заменить проветриванием и лёгкой растяжкой дома.';
    }
    if(weatherKind==='hot'){
      p.title='Лёгкий водный день';
      p.lunch='Лёгкий суп, рис/гречка и овощи';
      p.tip='Жарко: больше воды, меньше нагрузки, прогулка утром или вечером.';
    }
    return p;
  }
  function buildPlan(){
    activePlan=applyWeather(applyAllergies(pickBasePlan()));
    Object.assign(activePlan,loadCustomMenu());
    $('#menuTitle').textContent=activePlan.title;
    $('#mBreakfast').textContent=activePlan.breakfast;
    $('#mLunch').textContent=activePlan.lunch;
    $('#mSnack').textContent=activePlan.snack;
    $('#mDinner').textContent=activePlan.dinner;
    $('#mTip').textContent=activePlan.tip;
    $('#mFact').textContent=activePlan.fact;
    $$('[data-meal="breakfast"]').forEach(x=>x.textContent=activePlan.breakfast);
    $$('[data-meal="lunch"]').forEach(x=>x.textContent=activePlan.lunch);
    $$('[data-meal="snack"]').forEach(x=>x.textContent=activePlan.snack);
    $$('[data-meal="dinner"]').forEach(x=>x.textContent=activePlan.dinner);
  }

  function initMenuEditing(){
    ['breakfast','lunch','snack','dinner'].forEach(key=>{
      const row=$(`[data-meal-row="${key}"]`);
      row.querySelector('[data-edit]').addEventListener('click',()=>{
        const oldEdit=row.querySelector('.meal-edit');
        if(oldEdit){oldEdit.remove();return;}
        const edit=document.createElement('div');
        edit.className='meal-edit';
        edit.innerHTML=`<input value="${escapeText(activePlan[key])}"><button class="btn btn-small">OK</button>`;
        row.appendChild(edit);
        const input=edit.querySelector('input');
        input.focus();
        edit.querySelector('button').addEventListener('click',()=>{
          const value=input.value.trim();
          if(!value) return;
          const custom=loadCustomMenu();
          custom[key]=value;
          saveCustomMenu(custom);
          edit.remove();
          buildPlan();
          showToast('Меню изменено');
        });
      });
    });
    $('#resetMenu').addEventListener('click',()=>{safeRemove(STORAGE.menu);buildPlan();showToast('Ручные правки меню сброшены')});
  }

  function weatherCodeInfo(code){
    if([0].includes(code))return['☀️','ясно'];
    if([1,2].includes(code))return['🌤️','переменная облачность'];
    if([3].includes(code))return['☁️','пасмурно'];
    if([45,48].includes(code))return['🌫️','туман'];
    if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return['🌧️','дождь'];
    if([71,73,75,77,85,86].includes(code))return['❄️','снег'];
    if([95,96,99].includes(code))return['⛈️','гроза'];
    return['🌦️','погода'];
  }
  function setWalk(temp,wind,precip,code){
    let status='Можно коротко погулять', cls='', advice='15–20 минут спокойным шагом, без переохлаждения и перегруза.', time='15–20 минут', clothes='по погоде', task='Прогулка 15–20 минут по погоде';
    weatherKind='normal';
    const badRain=precip>0.2||[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code);
    const snow=[71,73,75,77,85,86].includes(code);
    if(temp<=-12||wind>=12||badRain||snow){
      status='Лучше домашний режим'; cls='no'; advice='Сегодня лучше не перегружаться: проветрить комнату, тёплое питьё, короткая активность дома.'; time='домашний режим'; clothes='тепло'; task='Домашний режим вместо прогулки'; weatherKind=badRain||snow?'rain':'cold';
    } else if(temp<5||wind>=8){
      status='Можно, но осторожно'; cls='care'; advice='Короткая прогулка 5–10 минут, тепло одеться, не мёрзнуть.'; time='5–10 минут'; clothes='шапка/шарф'; task='Короткая прогулка 5–10 минут'; weatherKind='cold';
    } else if(temp>=26){
      status='Лучше утром или вечером'; cls='care'; advice='Жара: вода, тень, без долгой ходьбы днём.'; time='10–15 минут'; clothes='лёгко'; task='Прогулка в тени утром/вечером'; weatherKind='hot';
    }
    $('#walkStatus').textContent=status;
    $('#walkStatus').className='walk-status '+cls;
    $('#walkAdvice').textContent=advice;
    $('#walkTime').textContent=time;
    $('#walkClothes').textContent=clothes;
    $('#walkTask').textContent=task;
    buildPlan();
  }
  async function loadWeather(manual){
    try{
      if(manual) showToast('Обновляю погоду...');
      const url='https://api.open-meteo.com/v1/forecast?latitude=57.054552&longitude=60.876482&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto';
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok) throw new Error('weather');
      const c=(await res.json()).current||{};
      const temp=Math.round(c.temperature_2m), feels=Math.round(c.apparent_temperature), wind=Math.round(c.wind_speed_10m), precip=Number(c.precipitation||0), code=Number(c.weather_code||0);
      const [icon,text]=weatherCodeInfo(code);
      $('#weatherIcon').textContent=icon; $('#temp').textContent=temp+'°'; $('#feels').textContent=feels+'°'; $('#wind').textContent=wind+' км/ч'; $('#rain').textContent=precip+' мм';
      $('#weatherUpdated').textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      currentWeatherSummary=`${text}, ${temp}°, ощущается ${feels}°, ветер ${wind} км/ч, осадки ${precip} мм`;
      $('#weatherText').textContent=currentWeatherSummary;
      setWalk(temp,wind,precip,code);
    }catch(e){
      $('#weatherText').textContent='Погоду не удалось загрузить. План работает в обычном режиме.';
      $('#weatherSource').textContent='offline';
      currentWeatherSummary='Погода недоступна';
      setWalk(18,2,0,1);
    }
  }

  function initMood(){
    const mood=safeGet(STORAGE.mood)||'normal';
    $$('.mood').forEach(button=>{
      button.classList.toggle('active',button.dataset.mood===mood);
      button.addEventListener('click',()=>{
        safeSet(STORAGE.mood,button.dataset.mood);
        $$('.mood').forEach(x=>x.classList.remove('active'));
        button.classList.add('active');
        showToast('Режим дня обновлён');
      });
    });
  }
  function initWater(){
    let count=Number(safeGet(STORAGE.water)||0);
    $('#waterDrops').innerHTML=Array.from({length:8},(_,i)=>`<button class="drop" data-water="${i+1}" aria-label="${i+1} стакан"><span>${i+1}</span></button>`).join('');
    function render(){
      count=Math.max(0,Math.min(8,count));
      $('#waterText').textContent=count+' / 8';
      $('#waterFill').style.width=Math.round(count/8*100)+'%';
      safeSet(STORAGE.water,String(count));
      $$('#waterDrops .drop').forEach(btn=>btn.classList.toggle('on',Number(btn.dataset.water)<=count));
    }
    $$('#waterDrops .drop').forEach(btn=>btn.addEventListener('click',()=>{count=Number(btn.dataset.water);render()}));
    $('#resetWater').addEventListener('click',()=>{count=0;render();showToast('Вода сброшена')});
    render();
  }
  function initProgress(){
    const boxes=$$('#timeline input[type="checkbox"]');
    const total=boxes.length;
    function message(done){if(done===0)return'Отметь первое дело — и день начнётся 🌱';if(done<total/2)return'Хорошее начало, продолжай мягко 🌼';if(done<total)return'Отлично идёшь, почти всё! ☀️';return'Ты сделала всё на сегодня — умница! 💛'}
    function render(){const done=boxes.filter(b=>b.checked).length,p=Math.round(done/total*100);$('#barFill').style.width=p+'%';$('#pct').textContent=p+'%';$('#msg').textContent=message(done)}
    let state={};try{state=JSON.parse(safeGet(STORAGE.day)||'{}')}catch(e){}
    boxes.forEach(box=>{
      const id=box.dataset.id;
      if(state[id]){box.checked=true;box.closest('label').classList.add('done')}
      box.addEventListener('change',()=>{box.closest('label').classList.toggle('done',box.checked);state[id]=box.checked;safeSet(STORAGE.day,JSON.stringify(state));render()});
    });
    $('#resetDay').addEventListener('click',()=>{boxes.forEach(b=>{b.checked=false;b.closest('label').classList.remove('done')});safeRemove(STORAGE.day);render();showToast('Галочки сброшены')});
    render();
  }
  const getShared=()=>{try{return JSON.parse(safeGet(STORAGE.shared)||'{}')}catch(e){return {}}};
  const setShared=d=>safeSet(STORAGE.shared,JSON.stringify(d));
  const getLogs=()=>{try{return JSON.parse(safeGet(STORAGE.logs)||'[]')}catch(e){return []}};
  const setLogs=d=>safeSet(STORAGE.logs,JSON.stringify(d));
  function collectShared(){return{noteFeeling:$('#noteFeeling').value.trim(),noteSinus:$('#noteSinus').value.trim(),noteDoctor:$('#noteDoctor').value.trim(),noteQuestions:$('#noteQuestions').value.trim(),updatedAt:new Date().toISOString()}}
  function loadShared(){const d=getShared();['noteFeeling','noteSinus','noteDoctor','noteQuestions'].forEach(id=>{$('#'+id).value=d[id]||''});renderLogs()}
  function renderLogs(){const logs=getLogs(),list=$('#logList');if(!logs.length){list.innerHTML='<div class="muted">История пока пустая.</div>';return}list.innerHTML=logs.slice().reverse().map(x=>`<div class="log-item"><b>${escapeText(new Date(x.createdAt).toLocaleString('ru-RU'))}</b><div>${escapeText(x.text).replace(/\n/g,'<br>')}</div></div>`).join('')}
  function report(){
    const prefs=getPrefs(), shared=getShared(), logs=getLogs();
    const allergyLabels=(prefs.allergies||[]).map(id=>(data.allergyOptions.find(x=>x[0]===id)||[])[1]).filter(Boolean).concat(prefs.customAllergy||[]);
    return ['Отчёт Дарьи — '+new Date().toLocaleString('ru-RU'),'','Погода: '+currentWeatherSummary,'Прогулка: '+$('#walkStatus').textContent+' — '+$('#walkAdvice').textContent,'','Меню:','Завтрак: '+activePlan.breakfast,'Обед: '+activePlan.lunch,'Полдник: '+activePlan.snack,'Ужин: '+activePlan.dinner,'','Исключения: '+(allergyLabels.join(', ')||'не указано'),'Что нравится: '+(prefs.foodLikes||'не указано'),'','Самочувствие: '+(shared.noteFeeling||'не записано'),'Симптомы гайморита: '+(shared.noteSinus||'не записано'),'Назначения врача: '+(shared.noteDoctor||'не записано'),'Вопросы врачу: '+(shared.noteQuestions||'не записано'),'','История:',...(logs.length?logs.map(x=>'- '+new Date(x.createdAt).toLocaleString('ru-RU')+': '+x.text.replace(/\s+/g,' ')):['нет записей'])].join('\n');
  }
  async function copyText(text){
    try{await navigator.clipboard.writeText(text);showToast('Отчёт скопирован')}catch(e){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();showToast('Отчёт скопирован')}
  }
  function initDiary(){
    loadShared();
    $('#saveSharedNotes').addEventListener('click',()=>{setShared(collectShared());$('#noteSaved').classList.add('show');setTimeout(()=>$('#noteSaved').classList.remove('show'),1400);showToast('Заметки сохранены')});
    ['noteFeeling','noteSinus','noteDoctor','noteQuestions'].forEach(id=>$('#'+id).addEventListener('input',()=>setShared(collectShared())));
    $('#addDailyLog').addEventListener('click',()=>{setShared(collectShared());const s=getShared();const text=[s.noteFeeling&&'Самочувствие: '+s.noteFeeling,s.noteSinus&&'Симптомы: '+s.noteSinus,s.noteDoctor&&'Назначения: '+s.noteDoctor,s.noteQuestions&&'Вопросы: '+s.noteQuestions].filter(Boolean).join('\n');if(!text){showToast('Сначала напиши заметку');return}const logs=getLogs();logs.push({createdAt:new Date().toISOString(),text});setLogs(logs.slice(-120));renderLogs();showToast('Запись добавлена')});
    $('#copyReport').addEventListener('click',()=>{setShared(collectShared());copyText(report())});
    $('#exportJson').addEventListener('click',()=>{setShared(collectShared());const payload={version:5,exportedAt:new Date().toISOString(),prefs:getPrefs(),shared:getShared(),logs:getLogs(),customMenu:loadCustomMenu()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='darya-care-diary-'+dayKey+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('Копия скачана')});
    $('#importJson').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(d.prefs)setPrefs(d.prefs);if(d.shared)setShared(d.shared);if(Array.isArray(d.logs))setLogs(d.logs);if(d.customMenu)saveCustomMenu(d.customMenu);initPrefs();loadShared();buildPlan();showToast('Копия импортирована')}catch(err){showToast('Не удалось импортировать')}e.target.value=''});
    $('#clearLogs').addEventListener('click',()=>{if(confirm('Очистить историю записей?')){setLogs([]);renderLogs();showToast('История очищена')}});
  }
  function initReveal(){
    if(!('IntersectionObserver' in window)){$$('.reveal').forEach(x=>x.classList.add('in'));return}
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');observer.unobserve(entry.target)}})},{threshold:.12});
    $$('.reveal').forEach(x=>observer.observe(x));
  }
  function initPwa(){
    if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
  }

  $('#savePrefs').addEventListener('click',()=>{setPrefs(collectPrefs());buildPlan();$('#prefsSaved').classList.add('show');setTimeout(()=>$('#prefsSaved').classList.remove('show'),1400);showToast('Настройки еды сохранены')});
  $('#refreshWeather').addEventListener('click',()=>loadWeather(true));
  initPrefs();
  initMenuEditing();
  initMood();
  initWater();
  initProgress();
  initDiary();
  initReveal();
  initPwa();
  buildPlan();
  loadWeather(false);
})();
