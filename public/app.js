import { anatomySVG as bodySVG } from './anatomy.js';
import { GROUPS, EXERCISES } from './data.js';
import { today, emptyState, loadState, saveState, validateState, sessionStats, localReview, getProfile, uuid } from './logic.js';
import { shiftMonth, formatDuration } from './calendar.js';
import { renderCalendar } from './calendar-view.js';

const $ = (s, root = document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = url => { try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? esc(u.href) : '#'; } catch { return '#'; } };
const fmt = n => new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 1}).format(Number(n) || 0);
const aiText = value => esc(value).replace(/\*\*([^*\n]{1,160})\*\*/g, '<strong>$1</strong>');
const copy = value => JSON.parse(JSON.stringify(value));
const exById = id => EXERCISES.find(x => x.id === id);
const groupName = id => GROUPS.find(x => x.id === id)?.name || id;
const groupSub = ex => Array.isArray(ex.sub) ? ex.sub.join(' · ') : ex.sub;
const routes = {dashboard:'训练总览', library:'动作库', workout:'训练日志', calendar:'训练日历', profile:'身体档案', coach:'AI 教练', settings:'模型设置'};
const paths = {
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  dumbbell:'m6 6 12 12M4 3 1 6l5 5 3-3M20 21l3-3-5-5-3 3M8 4l3 3M16 20l-3-3',
  calendar:'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3',
  user:'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  spark:'m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2ZM20 2v4M18 4h4',
  settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  plus:'M12 5v14M5 12h14', arrow:'M5 12h14m-5-5 5 5-5 5', chevron:'m9 5 7 7-7 7',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  close:'m6 6 12 12M6 18 18 6', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  edit:'m16 3 5 5-13 13H3v-5L16 3ZM13 6l5 5', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  leaf:'M20 3C6 1 1 8 5 15s16 3 15-12ZM4 21 16 9M8 17l-1-6M12 13h5',
  trend:'m3 17 6-6 4 4 8-10M15 5h6v6', check:'m5 12 4 4L19 6',
  shield:'M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6l-9-4Zm-4 10 3 3 5-6',
  download:'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4', upload:'M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4',
  send:'m22 2-7 20-4-9L2 9 22 2ZM11 13 22 2', info:'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  reset:'M3 11a9 9 0 1 1 2 7M3 4v7h7', book:'M12 6c-3-3-7-3-10-2v16c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v16'
};
const icon = (name, size=18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
let state;
try { state = loadState(); } catch { state = emptyState(); }
if (!state || !Array.isArray(state.sessions)) state = emptyState();
let route = routes[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
let workoutTab = 'current';
let calendarMonth = today().slice(0,7), calendarSelected = today();
let dashboardGroup = 'back', dashboardSub = 'all';
let filters = {group:'all', sub:'all', q:'', favorites:false};
let chartMetric = 'weight';
let favorites = new Set();
try { favorites = new Set(JSON.parse(localStorage.getItem('lianji-favorites') || '[]')); } catch {}
let apiStatus = {modelConfigured:false, searchConfigured:false, loading:true};
let modelConfig = null, modelConfigLoading = false, modelConfigError = '', modelConfigBusy = '', modelConfigNotice = null;
let modelConfigDraft = {name:'我的 API',baseUrl:'',model:''};
let messages = [], chatBusy = false, reviewId = state.draft ? 'draft' : state.sessions[0]?.id || '';
let reviewResult = null, reviewBusy = false, dialogExercise = null, dialogBusy = false;
let toastTimeout, persistWarning = false;
const app = $('#app'), dialog = $('#exercise-dialog');
dialog.className = 'dialog';
const option = (value, label, selected) => `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;
const options = (items, selected) => items.map(v=>option(v,v,selected)).join('');
const button = (action, label, ico='', cls='', attrs='') => `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${ico?icon(ico,15):''}${label}</button>`;
const iconButton = (action, label, ico, attrs='') => `<button type="button" class="icon-btn" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(ico,16)}</button>`;
const sessionsSorted = () => [...state.sessions].sort((a,b)=>b.date.localeCompare(a.date));
function persist() {
  try { const ok = saveState(state); if(ok===false) throw Error(); persistWarning=false; }
  catch { if(!persistWarning){toast('浏览器存储不可用，请导出备份；当前页面中的更改仍保留。');persistWarning=true;} }
}
function toast(text) { const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('show'),3800); }
let confirmationOpen = false;
function confirmAction(message,{title='确认操作',confirmLabel='确认',danger=false,requiredText=null}={}) {
  if(confirmationOpen)return Promise.resolve(false);
  confirmationOpen=true;
  return new Promise(resolve=>{
    const previousFocus=document.activeElement,modal=document.createElement('dialog'),key='confirm-'+uuid();
    modal.className='dialog confirm-dialog';
    modal.setAttribute('aria-labelledby',key+'-title');
    modal.setAttribute('aria-describedby',key+'-description');
    modal.innerHTML=`<form class="confirm-form"><div class="confirm-content"><div class="confirm-symbol">${icon(danger?'trash':'info',23)}</div><h2 id="${key}-title">${esc(title)}</h2><p id="${key}-description">${esc(message)}</p>${requiredText?`<label class="field confirm-field">请输入「${esc(requiredText)}」以确认<input type="text" name="confirmation" autocomplete="off" maxlength="40" aria-label="输入${esc(requiredText)}以确认" required></label>`:''}</div><div class="confirm-actions"><button type="button" class="button white" data-confirm-cancel>取消</button><button type="submit" class="button ${danger?'danger':''}" data-confirm-accept ${requiredText?'disabled':''}>${esc(confirmLabel)}</button></div></form>`;
    let settled=false;
    const finish=accepted=>{
      if(settled)return;settled=true;confirmationOpen=false;
      if(modal.open)modal.close();modal.remove();
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
      resolve(accepted);
    };
    const input=$('input',modal),accept=$('[data-confirm-accept]',modal),cancel=$('[data-confirm-cancel]',modal);
    $('form',modal).addEventListener('submit',event=>{event.preventDefault();if(requiredText&&input.value!==requiredText)return;finish(true);});
    cancel.addEventListener('click',()=>finish(false));
    input?.addEventListener('input',()=>{accept.disabled=input.value!==requiredText;});
    modal.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
    modal.addEventListener('close',()=>finish(false));
    modal.addEventListener('click',event=>{if(event.target!==modal)return;const box=modal.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)finish(false);});
    document.body.append(modal);modal.showModal();(input||cancel).focus();
  });
}
function go(next) { if(!routes[next]) return; route=next; location.hash=next; render(); window.scrollTo({top:0,behavior:'instant'}); }
function newDraft(date=today()) { return {id:uuid(),date,startTime:null,durationSeconds:null,title:'我的训练',notes:'',readiness:3,soreness:'',exercises:[]}; }
function newSet(previous) { return {id:uuid(),weight:previous?.weight??0,reps:previous?.reps??10,rest:previous?.rest??90,rpe:null,done:false,warmup:false}; }
function ensureDraft() { if(!state.draft) state.draft=newDraft(); return state.draft; }
function addExercise(id) {
  if(!exById(id))return;
  const draft=ensureDraft();
  draft.exercises.push({id:uuid(),exerciseId:id,sets:[newSet(),newSet(),newSet()]});
  persist(); dialog.close(); workoutTab='current';go('workout');toast('已添加动作，填写重量并勾选完成的组。');
}
async function useTemplate() {
  if(state.draft?.exercises.length && !await confirmAction('将用胸部训练模板替换当前草稿，继续吗？',{title:'替换当前训练草稿',confirmLabel:'使用模板'}))return;
  const selected=EXERCISES.filter(x=>x.group==='chest').filter((x,i,arr)=>i===0 || !arr.slice(0,i).some(p=>groupSub(p)===groupSub(x))).slice(0,3);
  state.draft={...newDraft(),...(state.draft||{}),title:'胸部训练',exercises:selected.map(x=>({id:uuid(),exerciseId:x.id,sets:[newSet(),newSet(),newSet()]}))};
  persist();workoutTab='current';go('workout');toast('模板已加入草稿，按实际能力调整组数与负重。');
}
function stats(session) { try{return sessionStats(session);}catch{return {sets:0,reps:0,volume:0,exercises:session?.exercises?.length||0};} }
function heading(eyebrow,title,subtitle,action='') { return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`; }
function render() {
  const nav=[['dashboard','grid'],['library','dumbbell'],['workout','edit'],['calendar','calendar'],['profile','user'],['coach','spark'],['settings','settings']];
  app.innerHTML=`<div class="shell"><aside class="sidebar"><a class="brand" href="#dashboard" aria-label="练记首页"><span class="brand-mark">${icon('dumbbell',23)}</span><span><span class="brand-name">练记</span><small>FITNESS AGENT</small></span></a><div class="nav-label">YOUR WORKSPACE</div><nav class="nav-list" aria-label="主导航">${nav.map(([key,ico])=>`<a href="#${key}" data-page="${key}" class="nav-link ${route===key?'active':''}" ${route===key?'aria-current="page"':''}>${icon(ico,18)}<span>${routes[key]}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="side-note"><div class="sprout">${icon('leaf',23)}</div><strong>一点一滴，成为更好的自己。</strong>训练无需完美，保持记录就很好。</div><a href="#profile" class="user-mini"><div class="avatar">${esc((state.profile.name||'练')[0])}</div><div><strong>${esc(state.profile.name||'我的健身空间')}</strong><span>数据保存在当前浏览器</span></div>${icon('chevron',13)}</a></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">我的空间 ${icon('chevron',11)} <strong>${routes[route]}</strong></div><a href="#dashboard" class="mobile-brand">${icon('dumbbell',22)} 练记</a><div class="top-actions"><span class="top-date">${new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'long'})}</span><a href="#settings" class="status-pill ${apiStatus.modelConfigured?'ready':''}" title="${esc(apiStatus.modelConfigured?(apiStatus.model||'模型已配置')+' · 点击管理模型':'点击设置模型 API')}" aria-label="模型设置：${apiStatus.loading?'正在连接':apiStatus.modelConfigured?'AI 教练已配置':'AI 尚未配置'}">${apiStatus.loading?'正在连接':apiStatus.modelConfigured?'AI 教练已配置':'AI 尚未配置'}</a>${button('start','记录训练','plus','small')}</div></header><main id="main" class="main" tabindex="-1">${({dashboard:dashboardView,library:libraryView,workout:workoutView,calendar:calendarView,profile:profileView,coach:coachView,settings:settingsView})[route]()}<footer class="footer"><span>练记 · 让每一次努力，都有迹可循</span><span>本地记录 · 自主掌控 ${icon('shield',10)}</span></footer></main></div></div>`;
  updateTimer();
  if(route==='profile'){
    const key=$('.profile-grid > div > section:first-child .card-header .chart-key');
    if(key)key.outerHTML=`<select class="inline-select" id="body-trend-metric" aria-label="身体趋势指标">${option('weight','体重 / kg',chartMetric)}${option('bodyFat','体脂 / %',chartMetric)}</select>`;
  }
  if(route==='coach'){
    const head=$('.page-heading');
    head.insertAdjacentHTML('beforeend',`<a href="#settings" class="button white">${icon('settings',15)} 模型设置</a>`);
    head.insertAdjacentHTML('afterend',`<div class="coach-model-strip">${icon('spark',14)}<span data-active-model></span><a href="#settings">管理 API ${icon('arrow',12)}</a></div>`);
  }
  updateApiStatusUI();
  if(route==='settings'&&!modelConfig&&!modelConfigLoading&&!modelConfigError)void loadModelConfig();
}
function modelTime(value) { const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'尚未验证'; }
function settingsFeedbackHTML() {
  if(!modelConfigNotice)return '';
  return `<div class="model-feedback ${modelConfigNotice.type==='error'?'error':'success'}" role="${modelConfigNotice.type==='error'?'alert':'status'}">${icon(modelConfigNotice.type==='error'?'info':'check',16)}<span>${esc(modelConfigNotice.message)}</span></div>`;
}
function settingsView() {
  const head=heading('MODEL API','模型设置','接入你自己的模型 API，用于动作讲解、AI 对话和训练复盘。',`<a href="#coach" class="button white">${icon('spark',15)} 返回 AI 教练</a>`);
  if(!modelConfig)return head+`<section class="card model-loading" aria-live="polite"><div class="empty-icon">${icon('settings',25)}</div><h2>${modelConfigError?'暂时无法读取配置':'正在读取模型配置…'}</h2><p>${esc(modelConfigError||'请稍候，正在连接配置服务。')}</p>${modelConfigError?button('model-retry','重新加载','reset','white'):''}</section>`;
  const cfg=modelConfig,custom=cfg.source==='custom',savedKey=custom&&cfg.keyConfigured,busy=Boolean(modelConfigBusy),storage=cfg.storageAvailable!==false;
  return head+`<div class="model-settings-grid"><section class="card model-form-card"><div class="card-header"><h2>连接你的模型</h2><span class="tag outline">OpenAI 兼容 API</span></div><p class="model-form-intro">使用支持 Chat Completions 协议的服务。保存时会先验证连接，通过后立即用于 AI 教练。</p><form id="model-config-form" autocomplete="off"><fieldset class="model-fields" ${busy?'disabled':''}><div class="model-presets" role="group" aria-label="填写配置示例"><span>快速填写</span>${button('model-preset','当前默认 AiHubMix','','white small','data-id="aihubmix"')}${button('model-preset','自定义 OpenAI 兼容','','white small','data-id="custom"')}</div><label class="field">配置名称 <span class="field-optional">可选</span><input id="model-name" name="name" maxlength="60" value="${esc(modelConfigDraft.name)}" placeholder="我的 API" autocomplete="off"></label><label class="field">Base URL<input id="model-base-url" name="baseUrl" type="url" inputmode="url" required maxlength="2048" value="${esc(modelConfigDraft.baseUrl)}" placeholder="https://api.example.com/v1" autocomplete="off" spellcheck="false"><small>填写包含 /v1 的接口基础地址，或服务商文档指定的路径。仅支持公网 HTTPS；云端无法访问 localhost 或局域网地址。</small></label><label class="field">模型 ID<input id="model-id" name="model" required maxlength="120" value="${esc(modelConfigDraft.model)}" placeholder="填写服务商提供的模型 ID" autocomplete="off" spellcheck="false"><small>模型 ID 须与你的 API 账户权限一致。</small></label><label class="field">API Key<input id="model-api-key" name="apiKey" type="password" value="" ${savedKey?'':'required'} maxlength="4096" placeholder="${savedKey?'已保存，留空保持原密钥':'粘贴你的 API Key'}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="model-key-help"><small id="model-key-help">已保存的 Key 留空保留；修改地址后需重新填写 Key。密钥在云端加密保存，不会写入训练备份。</small></label><div class="model-test-note">${icon('info',15)}<span>测试会向所填服务发送简短验证请求，可能产生少量 API 用量。测试不会发送你的训练记录。</span></div><div id="model-config-feedback" aria-live="polite">${settingsFeedbackHTML()}</div><div class="model-form-actions">${button('model-test',modelConfigBusy==='test'?'正在测试连接…':'测试连接','spark','white')}<button id="model-save" class="button" type="submit" ${!storage?'disabled':''}>${icon('check',15)}${modelConfigBusy==='save'?'正在验证并保存…':'保存并使用'}</button></div></fieldset></form>${!storage?'<div class="notice model-storage-notice">'+icon('info',15)+'<span>当前环境尚未启用云端安全存储，暂时无法保存自定义配置。你仍可测试连接。</span></div>':''}</section><aside class="model-settings-aside"><section class="card model-current-card"><div class="card-header"><h2>当前使用</h2><span class="tag ${custom?'':'outline'}">${custom?'自定义':'默认配置'}</span></div><div class="model-current-symbol">${icon('spark',24)}</div><h3>${esc(custom?cfg.name||'我的 API':'默认模型服务')}</h3><p class="model-current-caption">${custom?'AI 教练正在使用你保存的配置。':cfg.defaultAvailable?'AI 教练正在使用站点默认配置。':'默认模型尚未配置，请填写自己的 API。'}</p><dl class="model-config-facts"><div><dt>模型</dt><dd>${esc(cfg.model||'尚未配置')}</dd></div><div><dt>Base URL</dt><dd>${esc(cfg.baseUrl||'尚未配置')}</dd></div><div><dt>密钥</dt><dd>${cfg.keyConfigured?`${esc(cfg.keyMasked||'••••••••')} <small>${custom?'已加密保存':'服务端已配置'}</small>`:'尚未配置'}</dd></div><div><dt>最近验证</dt><dd>${esc(modelTime(cfg.verifiedAt))}</dd></div>${cfg.updatedAt?`<div><dt>保存时间</dt><dd>${esc(modelTime(cfg.updatedAt))}</dd></div>`:''}</dl>${custom?`<div class="model-reset-area">${button('model-reset',modelConfigBusy==='reset'?'正在恢复…':'恢复默认配置','reset','ghost',busy?'disabled':'')}<p>${cfg.defaultAvailable?'移除自定义配置后，立即切换回站点默认模型。':'移除自定义配置后，需重新配置 API 才能使用 AI 教练。'}</p></div>`:''}</section><section class="model-security"><div>${icon('shield',19)}<strong>密钥由你掌控</strong></div><p>保存后只显示掩码，不回显完整密钥。模型设置与本地训练记录分开保存，导出训练备份不会包含密钥。</p></section></aside></div>`;
}
function updateApiStatusUI() {
  const status=$('.status-pill');
  if(status){
    status.className=`status-pill ${apiStatus.modelConfigured?'ready':''}`;
    status.textContent=apiStatus.loading?'正在连接':apiStatus.error?'AI 服务暂不可用':apiStatus.modelConfigured?'AI 教练已配置':'AI 尚未配置';
    status.title=(apiStatus.modelConfigured?(apiStatus.model||'模型已配置')+' · ':'')+'点击管理模型 API';
    status.setAttribute('aria-label','模型设置：'+status.textContent);
  }
  const model=$('[data-active-model]');
  if(model)model.textContent=apiStatus.loading?'正在读取当前模型…':apiStatus.error?'暂时无法读取模型状态':apiStatus.modelConfigured?`${apiStatus.source==='custom'?apiStatus.configName||'我的 API':'默认配置'} · ${apiStatus.model||'模型已配置'}`:'尚未配置模型，前往模型设置接入 API';
}
async function refreshApiStatus() {
  try { const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw Error();apiStatus={...await response.json(),loading:false,error:false}; }
  catch { apiStatus={...apiStatus,loading:false,error:true}; }
  updateApiStatusUI();
}
async function modelRequest(path,{method='GET',body}={}) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),95000);
  try {
    const response=await fetch('/api/model-config'+path,{method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});
    let data;try{data=await response.json();}catch{throw Error('配置服务返回格式异常，请稍后重试。');}
    if(!response.ok)throw Error(typeof data.error==='string'?data.error:'请求未完成，请稍后重试。');
    return data;
  } catch(error) { if(error.name==='AbortError')throw Error('连接验证超时，请检查配置后重试。');if(error instanceof TypeError)throw Error('暂时无法连接配置服务，请检查网络后重试。');throw error; }
  finally { clearTimeout(timeout); }
}
function setModelConfig(data) {
  modelConfig=data.config||data;
  modelConfigDraft={name:modelConfig.source==='custom'?modelConfig.name||'我的 API':'我的 API',baseUrl:modelConfig.baseUrl||'',model:modelConfig.model||''};
}
async function loadModelConfig() {
  if(modelConfigLoading)return;modelConfigLoading=true;modelConfigError='';if(route==='settings')render();
  try{setModelConfig(await modelRequest(''));}catch(error){modelConfigError=error.message;}
  finally{modelConfigLoading=false;if(route==='settings')render();}
}
function setModelBusy(kind) {
  modelConfigBusy=kind;
  const fields=$('#model-config-form fieldset');if(fields)fields.disabled=Boolean(kind);
  const reset=$('[data-action="model-reset"]');if(reset){reset.disabled=Boolean(kind);reset.innerHTML=icon('reset',15)+(kind==='reset'?'正在恢复…':'恢复默认配置');}
  const test=$('[data-action="model-test"]');if(test)test.innerHTML=icon('spark',15)+(kind==='test'?'正在测试连接…':'测试连接');
  const save=$('#model-save');if(save)save.innerHTML=icon('check',15)+(kind==='save'?'正在验证并保存…':'保存并使用');
}
function modelFeedback(type,message) {
  modelConfigNotice={type,message};
  const target=$('#model-config-feedback');if(target)target.innerHTML=settingsFeedbackHTML();
}
function modelPayload() {
  const form=$('#model-config-form');if(!form||!form.reportValidity())return null;
  const data=new FormData(form),baseUrl=String(data.get('baseUrl')||'').trim(),apiKey=String(data.get('apiKey')||'').trim();
  try{const url=new URL(baseUrl);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error();}catch{modelFeedback('error','请填写不含用户名、密码、查询参数或片段的 HTTPS Base URL。');return null;}
  if(!apiKey&&(!modelConfig?.keyConfigured||modelConfig.source!=='custom'||baseUrl.replace(/\/+$/,'')!==modelConfig.baseUrl.replace(/\/+$/,''))){modelFeedback('error','首次配置或修改 Base URL 后，请重新填写 API Key。');$('#model-api-key')?.focus();return null;}
  const model=String(data.get('model')||'').trim();if(!model){modelFeedback('error','请填写模型 ID。');$('#model-id')?.focus();return null;}
  return {name:String(data.get('name')||'').trim()||'我的 API',baseUrl,model,apiKey};
}
async function testModelConfig() {
  if(modelConfigBusy)return;const payload=modelPayload();if(!payload)return;
  setModelBusy('test');modelFeedback('success','正在向所填服务发送验证请求…');
  try{const result=await modelRequest('/test',{method:'POST',body:payload});if(result.ok===false)throw Error(result.error||'连接验证失败，请检查配置。');modelFeedback('success',`连接测试通过 · ${result.model||payload.model}${Number.isFinite(result.latencyMs)?' · '+result.latencyMs+' ms':''} · ${modelTime(new Date().toISOString())}。测试不会自动保存；如有修改，请点击“保存并使用”。`);}
  catch(error){modelFeedback('error',error.message);}
  finally{payload.apiKey='';setModelBusy('');}
}
async function saveModelConfig() {
  if(modelConfigBusy||modelConfig?.storageAvailable===false)return;const payload=modelPayload();if(!payload)return;
  setModelBusy('save');modelFeedback('success','正在验证连接，通过后将加密保存并启用…');
  try{setModelConfig(await modelRequest('',{method:'PUT',body:payload}));const key=$('#model-api-key');if(key)key.value='';modelConfigNotice={type:'success',message:'已验证并保存。AI 教练现在使用这份配置。'};await refreshApiStatus();if(route==='settings')render();toast('模型配置已保存并启用。');}
  catch(error){modelFeedback('error',error.message);}
  finally{payload.apiKey='';setModelBusy('');}
}
async function resetModelConfig() {
  if(modelConfigBusy||!await confirmAction('将删除你保存的自定义模型配置与密钥，并切换回站点默认配置。训练记录会继续保留。',{title:'恢复默认模型配置',confirmLabel:'恢复默认配置'}))return;
  setModelBusy('reset');
  try{setModelConfig(await modelRequest('',{method:'DELETE'}));modelConfigNotice={type:'success',message:'已恢复默认配置，自定义密钥已移除。'};await refreshApiStatus();if(route==='settings')render();toast('已恢复默认模型配置。');}
  catch(error){modelFeedback('error',error.message);}
  finally{setModelBusy('');}
}
function dashboardView() {
  const sorted=sessionsSorted(), now=new Date(today()+'T12:00:00'), cutoff=new Date(now);cutoff.setDate(now.getDate()-6);
  const week=sorted.filter(s=>s.date>=cutoff.toISOString().slice(0,10)&&s.date<=today());
  const weekVolume=week.reduce((n,s)=>n+stats(s).volume,0), profile=getProfile(state);
  return heading('TRAINING OVERVIEW','训练总览','选择训练部位，了解动作，然后记录每一次进步。',button('start',state.draft?'继续本次训练':'开始记录训练','plus'))+anatomyPanel()+
    '<div class="stats-grid">'+statCard('本周训练',week.length,'次','累计记录 '+sorted.length+' 次训练','calendar')+statCard('本周训练容量',fmt(weekVolume),'kg','已完成正式组 · 重量 × 次数','dumbbell')+statCard('最近体重',profile.weight?fmt(profile.weight):'—','kg',state.measurements.length?'最近记录 '+esc([...state.measurements].sort((a,b)=>b.date.localeCompare(a.date))[0].date):'填写身体档案，查看变化趋势','trend')+'</div>'+
    '<div class="dashboard-grid"><section class="card trend-card"><div class="card-header"><h2>身体趋势</h2><span class="chart-key">体重 / kg</span></div>'+weightChart()+'<div class="helper-links"><p class="chart-note">观察长期趋势，允许正常波动。</p><button class="text-button" data-action="nav" data-page="profile">记录身体数据 '+icon('arrow',12)+'</button></div></section><section class="card latest-card"><div class="card-header"><h2>最近训练</h2><button class="text-button" data-action="history">查看全部 '+icon('arrow',12)+'</button></div>'+(sorted.length?sorted.slice(0,3).map(sessionRow).join(''):'<div class="empty-row"><p>还没有训练记录，从第一个动作开始。</p>'+button('nav','去动作库选择','plus','ghost small','data-page="library"')+'</div>')+'</section></div>';
}
function anatomyPanel() {
  const group=GROUPS.find(g=>g.id===dashboardGroup)||GROUPS[0], count=EXERCISES.filter(e=>e.group===group.id&&(dashboardSub==='all'||e.sub===dashboardSub)).length;
  return '<section class="card anatomy-card" aria-labelledby="anatomy-title"><div class="anatomy-header"><div><h2 id="anatomy-title">训练部位</h2><p>正背面肌群示意 · 蓝色标记当前训练侧重</p></div>'+button('anatomy-open','查看'+group.name+'动作 · '+count,'arrow','white')+'</div><div class="anatomy-tabs" role="group" aria-label="选择训练部位">'+GROUPS.map(g=>'<button type="button" data-action="anatomy-group" data-id="'+g.id+'" aria-pressed="'+(g.id===group.id)+'" class="'+(g.id===group.id?'active':'')+'">'+g.name+'</button>').join('')+'</div><div class="anatomy-subtabs" role="group" aria-label="选择训练侧重">'+['all',...group.subs].map(sub=>'<button type="button" data-action="anatomy-sub" data-id="'+esc(sub)+'" aria-pressed="'+(sub===dashboardSub)+'" class="'+(sub===dashboardSub?'active':'')+'">'+(sub==='all'?'全部'+group.name:esc(sub))+'</button>').join('')+'</div><div class="anatomy-stage">'+'<div class="anatomy-desktop">'+bodySVG(group.id,dashboardSub==='all'?'':dashboardSub,{labels:true})+'</div><div class="anatomy-mobile">'+bodySVG(group.id,dashboardSub==='all'?'':dashboardSub)+'</div>'+'</div><div class="anatomy-caption"><span><i class="legend-dot selected"></i>当前侧重</span><span><i class="legend-dot base"></i>其他部位</span><p>肌群示意用于定位，复合动作会有多个部位协同参与。</p></div></section>';
}
function statCard(title,value,unit,foot,ico) { return `<section class="card stat-card"><div><div class="stat-title">${title}</div><div class="stat-value">${value}<small>${unit}</small></div><div class="stat-foot">${foot}</div></div><div class="stat-icon">${icon(ico,21)}</div></section>`; }
function weightChart(metric=route==='profile'?chartMetric:'weight') {
  const label=metric==='bodyFat'?'体脂':'体重',unit=metric==='bodyFat'?'%':'kg';
  const points=[...state.measurements].filter(m=>Number(m[metric])>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
  if(!points.length) return `<div class="chart-empty">${icon('trend',25)}<span>还没有${label}记录，给进步一个起点。</span>${button('nav','建立身体档案','plus','ghost','data-page="profile"')}</div>`;
  const w=440,h=150,pad=35, vals=points.map(p=>Number(p[metric])),low=Math.min(...vals)-1,high=Math.max(...vals)+1;
  const coords=points.map((p,i)=>({x:points.length===1?w/2:pad+i*(w-2*pad)/(points.length-1),y:14+(high-p[metric])/(high-low)*104,p}));
  const line=coords.map(p=>`${p.x},${p.y}`).join(' '),area=`${coords[0].x},120 ${line} ${coords.at(-1).x},120`;
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}趋势：${esc(points.map(p=>p.date+' '+p[metric]+unit).join('，'))}"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#60A5FA" stop-opacity=".32"/><stop offset="100%" stop-color="#60A5FA" stop-opacity=".02"/></linearGradient></defs>${[0,1,2].map(i=>`<line x1="${pad}" x2="${w-15}" y1="${15+i*52}" y2="${15+i*52}" stroke="#E7EDF5"/><text x="0" y="${18+i*52}" font-size="8" fill="#7C8DA5">${fmt(high-i*(high-low)/2)}</text>`).join('')}<polygon points="${area}" fill="url(#chartFill)"/><polyline points="${line}" fill="none" stroke="#2563EB" stroke-width="2.3" stroke-linejoin="round"/>${coords.map((c,i)=>`<circle cx="${c.x}" cy="${c.y}" r="3" fill="#fff" stroke="#2563EB" stroke-width="1.6"><title>${c.p.date} · ${c.p[metric]} ${unit}</title></circle>${i===0||i===coords.length-1||coords.length<5?`<text x="${c.x}" y="142" text-anchor="middle" fill="#7C8DA5" font-size="8">${c.p.date.slice(5).replace('-','/')}</text>`:''}`).join('')}</svg></div>`;
}
function sessionRow(s) {
  const st=stats(s), d=s.date.split('-');
  return `<div class="session-row"><div class="date-tile"><b>${d[2]}</b><span>${Number(d[1])} 月</span></div><div><h3>${esc(s.title||'我的训练')}</h3><p>${s.exercises.length} 个动作 · ${st.sets} 个完成组${s.startTime?' · '+esc(s.startTime):''} · ${formatDuration(s.durationSeconds)} ${s.notes?' · '+esc(s.notes.slice(0,28)):''}</p></div><div class="row-stats">${fmt(st.volume)} kg<small>训练容量</small></div><div class="row-actions">${iconButton('review-session','复盘这次训练','spark',`data-id="${esc(s.id)}"`)}${iconButton('edit-session','查看与编辑训练','edit',`data-id="${esc(s.id)}"`)}${workoutTab==='history'&&route==='workout'?iconButton('delete-session','删除这次训练','trash',`data-id="${esc(s.id)}"`):''}</div></div>`;
}
function filteredExercises() { const q=filters.q.trim().toLowerCase();return EXERCISES.filter(x=>(filters.group==='all'||x.group===filters.group)&&(filters.sub==='all'||(Array.isArray(x.sub)?x.sub.includes(filters.sub):x.sub===filters.sub))&&(!filters.favorites||favorites.has(x.id))&&(!q||`${x.name} ${x.en} ${x.equipment} ${groupSub(x)} ${groupName(x.group)}`.toLowerCase().includes(q))); }
function exerciseGrid() { const list=filteredExercises();return `<div class="library-header"><span>${filters.group==='all'?'全部肌群':esc(groupName(filters.group))} ${filters.sub!=='all'?' / '+esc(filters.sub):''} · ${list.length} 个动作</span><span>了解动作，再稳稳进步</span></div><div class="exercise-grid">${list.length?list.map(exerciseCard).join(''):'<div class="library-empty">没有找到匹配的动作。试试其他关键词或筛选条件。</div>'}</div>`; }
function libraryView() {
  const group=GROUPS.find(g=>g.id===filters.group);
  return `${heading('MOVEMENT LIBRARY','先了解，再发力。','按肌群找到适合你的动作，掌握每一次发力的细节。')}<div class="toolbar"><label class="search-box">${icon('search',17)}<span class="visually-hidden">搜索动作、器械或肌群</span><input type="search" id="exercise-search" placeholder="搜索动作、器械或肌群…" value="${esc(filters.q)}" autocomplete="off"></label><button class="button ${filters.favorites?'mint':'white'}" data-action="favorites">${icon('heart',14)} 我的收藏 <span>${favorites.size}</span></button></div><div class="category-tabs" role="group" aria-label="肌群筛选">${[['all','全部动作'],...GROUPS.map(g=>[g.id,g.name])].map(([id,name])=>`<button class="${filters.group===id?'active':''}" data-action="filter-group" data-id="${id}" aria-pressed="${filters.group===id}">${name}</button>`).join('')}</div><div class="sub-tabs" role="group" aria-label="区域筛选"><span>细分区域</span><span class="divider"></span>${['all',...(group?.subs||[])].map(s=>`<button class="${filters.sub===s?'active':''}" data-action="filter-sub" data-id="${esc(s)}" aria-pressed="${filters.sub===s}">${s==='all'?'全部区域':esc(s)}</button>`).join('')}${!group?'<span>选择肌群以查看区域</span>':''}</div><div id="library-results">${exerciseGrid()}</div><div class="notice">${icon('info',15)}<span>区域标签表示训练侧重。多数动作会让多个肌群共同参与，不能精确隔离某一小块肌肉。示意图仅帮助定位，动作细节以文字指南为准。</span></div>`;
}
function exerciseCard(x) {
  const attrs=`data-id="${esc(x.id)}"`;
  return `<article class="card exercise-card"><div class="exercise-art"><span class="art-subtitle">${esc(x.group).toUpperCase()} / ${esc(groupSub(x))}</span>${bodySVG(x.group,groupSub(x))}<button class="favorite-btn ${favorites.has(x.id)?'on':''}" data-action="favorite" ${attrs} aria-label="${favorites.has(x.id)?'取消收藏':'收藏'}${esc(x.name)}" aria-pressed="${favorites.has(x.id)}">${icon('heart',14)}</button><span class="group-mark">${esc(groupName(x.group))}</span></div><div class="exercise-body"><h3>${esc(x.name)}</h3><div class="english">${esc(x.en)}</div><div class="exercise-meta"><span class="tag">${esc(groupSub(x))}</span><span class="tag">${esc(x.equipment)}</span><span class="tag orange">${esc(x.difficulty)}</span></div><div class="exercise-bottom"><button class="text-button" data-action="exercise" ${attrs}>查看动作指南 ${icon('arrow',12)}</button>${iconButton('add-exercise','将'+x.name+'添加到训练','plus',attrs)}</div></div></article>`;
}
function calendarView() {
  return heading('TRAINING CALENDAR','每一次训练，都留下印记。','点击日历中的训练标签，直接打开对应记录；点击日期查看当天概览或补录训练。',button('history','全部训练记录','book','white'))+renderCalendar({month:calendarMonth,selected:calendarSelected,today:today(),sessions:state.sessions,draft:state.draft,icon});
}
function workoutTimeFields(draft) {
  return `<div class="workout-time-fields"><label class="field">开始时间 <span class="field-optional">可选</span><input type="time" data-draft-field="startTime" value="${esc(draft.startTime)}" step="60"><small>按训练当天的北京时间填写。</small></label><label class="field">训练时长 <span class="field-optional">时:分:秒，可选</span><input id="draft-duration" type="text" data-duration-field="true" value="${draft.durationSeconds?formatDuration(draft.durationSeconds):''}" placeholder="例如 01:20:30" maxlength="8" pattern="[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]" title="填写时:分:秒，例如 01:20:30，最长 24 小时" autocomplete="off"><small>记录本次训练的总用时，包含组间休息。</small></label></div><p class="workout-time-note">时间可留空，或在训练结束后补填。保存后会显示在训练日历中。</p>`;
}
function selectCalendarDate(date,focus=false) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  calendarSelected=date;calendarMonth=date.slice(0,7);render();
  if(focus)$(`[data-action="calendar-select"][data-id="${date}"]`)?.focus({preventScroll:true});
}
async function addCalendarSession(date) {
  if(date>today())return;
  if(state.draft?.date===date&&!state.sessions.some(session=>session.id===state.draft.id)){
    workoutTab='current';go('workout');return;
  }
  if(state.draft&&!await confirmAction('当前还有一份训练草稿。为所选日期新建训练会替换草稿，继续吗？',{title:'新建当天训练',confirmLabel:'新建训练'}))return;
  state.draft=newDraft(date);persist();workoutTab='current';go('workout');
}
function workoutView() {
  return `${heading('TRAINING JOURNAL','把努力，写下来。','记录负重、次数和训练感受，为下次进步留下参照。',button('nav','添加训练动作','plus','white','data-page="library"'))}<div class="view-tabs"><button data-action="workout-tab" data-id="current" class="${workoutTab==='current'?'active':''}">本次训练 ${state.draft?'<span class="tag">草稿</span>':''}</button><button data-action="workout-tab" data-id="history" class="${workoutTab==='history'?'active':''}">历史记录 <span class="tag">${state.sessions.length}</span></button></div>${workoutTab==='history'?historyView():currentWorkout()}`;
}
function currentWorkout() {
  const draft=state.draft,st=stats(draft);
  return `<div class="workout-layout"><div>${!draft?`<section class="card workout-empty"><div class="empty-icon">${icon('dumbbell',29)}</div><h2>今天的训练，从这里开始。</h2><p>选择动作，记录每组表现。草稿会自动保存在当前浏览器，完成后再保存为正式记录。</p><div class="empty-actions">${button('nav','去动作库选择','plus','','data-page="library"')}${button('template','使用胸部训练模板','','white')}</div></section>`:`<div class="workout-meta"><label class="field">训练名称<input id="draft-title" data-draft-field="title" maxlength="80" value="${esc(draft.title)}" required></label><label class="field">训练日期<input type="date" data-draft-field="date" value="${esc(draft.date)}" max="${today()}" required></label></div>${workoutTimeFields(draft)}${draft.exercises.length?draft.exercises.map(workoutExercise).join(''):`<section class="card workout-empty"><h2>添加第一个训练动作</h2><p>你可以从动作库选择动作，也可以用胸部训练模板开始。</p><div class="empty-actions">${button('nav','选择动作','plus','','data-page="library"')}${button('template','使用胸部模板','','white')}</div></section>`}<div class="notice">${icon('info',15)}<span>重量口径：杠铃含杆总重；哑铃按单只；自重填 0，额外负重填实际值。容量仅作同一动作的粗略参照，不宜直接比较不同动作。RPE 为主观用力程度（1–10），可留空。</span></div><section class="card workout-bottom"><div class="field-row"><label class="field">训练前状态<select data-draft-field="readiness">${[[1,'1 · 很疲惫'],[2,'2 · 有些疲惫'],[3,'3 · 状态一般'],[4,'4 · 状态不错'],[5,'5 · 精力充沛']].map(([v,t])=>option(v,t,draft.readiness)).join('')}</select></label><label class="field">酸痛或不适部位<input data-draft-field="soreness" value="${esc(draft.soreness)}" placeholder="可选，例如：腿部轻微酸痛" maxlength="200"></label></div><label class="field section-gap">训练笔记<textarea data-draft-field="notes" maxlength="2000" placeholder="今天的感受、动作调整或下次的小目标…">${esc(draft.notes)}</textarea></label><div class="workout-save"><span class="hint">草稿自动保存 · 保存前请勾选实际完成的组</span>${button('save-session','保存这次训练','check')}</div><div class="helper-links"><button class="text-button" data-action="discard-draft">放弃当前草稿</button>${button('review-draft','先做本次复盘','spark','ghost small')}</div></section>`}</div><aside class="workout-aside"><section class="card timer-card"><div class="eyebrow">TAKE A BREATH</div><h3>组间休息</h3><div id="timer-display" class="timer-display" aria-label="剩余休息时间">01:30</div><div class="timer-presets">${[60,90,120,180].map(n=>`<button data-action="timer-preset" data-id="${n}" class="${timer.duration===n?'active':''}">${n} 秒</button>`).join('')}</div><div class="timer-controls">${button('timer-toggle','开始休息','clock','mint small','id="timer-toggle"')}${iconButton('timer-reset','重置计时器','reset')}</div><p>完成一组后自动开始该组的休息计时</p></section><section class="card section-gap"><div class="card-header"><h2>这次训练</h2><span class="tag outline">实时记录</span></div><div class="summary-mini" style="margin-top:0;padding-top:0;border:0"><div><b id="draft-set-count">${st.sets}</b><span>完成工作组</span></div><div><b id="draft-volume">${fmt(st.volume)}</b><span>容量 / kg</span></div></div><p class="chart-note" style="margin-top:20px">热身组单独标记，不计入工作组与容量。勾选完成后才计入统计。</p><div class="notice" style="margin-bottom:0">${icon('leaf',14)}<span>充分休息也是训练的一部分。复合动作可根据表现延长休息。</span></div></section></aside></div>`;
}
function workoutExercise(entry,index) {
  const ex=exById(entry.exerciseId),name=ex?.name||'未知动作';
  return `<section class="card workout-exercise"><div class="workout-exercise-head"><div><h3><span style="color:#8998AE;font-weight:400;margin-right:7px">${String(index+1).padStart(2,'0')}</span>${esc(name)}</h3><p>${esc(ex?.equipment||'')} · ${esc(ex?groupSub(ex):'')}</p></div><div>${iconButton('exercise','查看'+name+'动作指南','book',`data-id="${esc(entry.exerciseId)}"`)}${iconButton('remove-exercise','移除'+name,'trash',`data-id="${esc(entry.id)}"`)}</div></div><table class="set-table"><thead><tr><th scope="col">组</th><th scope="col">重量 kg</th><th scope="col">次数</th><th scope="col">休息 s</th><th scope="col">RPE</th><th scope="col">热身</th><th scope="col">完成</th><th scope="col"><span class="visually-hidden">删除</span></th></tr></thead><tbody>${entry.sets.map((set,i)=>setRow(entry,set,i,name)).join('')}</tbody></table><div class="set-add"><button class="text-button" data-action="add-set" data-id="${esc(entry.id)}">${icon('plus',12)} 添加一组</button><small>${entry.sets.filter(s=>s.done).length} / ${entry.sets.length} 组完成</small></div></section>`;
}
function setRow(entry,set,i,name) {
  const base=`data-entry="${esc(entry.id)}" data-set="${esc(set.id)}"`, label=`${esc(name)}第${i+1}组`;
  const num=(field,min,max,step,aria)=>`<input type="number" ${base} data-set-field="${field}" value="${esc(set[field])}" min="${min}" max="${max}" step="${step}" ${field!=='rpe'?'required':''} aria-label="${label}${aria}" inputmode="decimal">`;
  return `<tr class="${set.done?'set-done':''}"><td>${i+1}</td><td>${num('weight',0,1000,0.5,'重量公斤')}</td><td>${num('reps',1,500,1,'次数')}</td><td>${num('rest',0,3600,5,'休息秒数')}</td><td>${num('rpe',1,10,0.5,'RPE可选')}</td><td><input type="checkbox" ${base} data-set-field="warmup" ${set.warmup?'checked':''} aria-label="${label}为热身组"></td><td><input type="checkbox" ${base} data-set-field="done" ${set.done?'checked':''} aria-label="${label}已完成"></td><td>${iconButton('remove-set','删除'+name+'第'+(i+1)+'组','close',base)}</td></tr>`;
}
function historyView() {
  return `<div class="history-tools"><div class="data-actions">${button('export','导出全部数据','download','white small')}${button('import','导入备份','upload','white small')}</div></div><section class="card"><div class="card-header"><h2>训练记录 <span>${state.sessions.length} 次</span></h2><span class="hint">按训练日期排列</span></div>${state.sessions.length?sessionsSorted().map(sessionRow).join(''):`<div class="empty-row"><p>还没有保存的训练。记录第一组，开始积累自己的数据。</p>${button('workout-current','开始记录','plus','ghost small')}</div>`}</section><div class="notice">${icon('shield',15)}<span>数据仅保存在此浏览器。建议定期导出 JSON 备份；更换设备或清理浏览器后，可通过备份恢复。</span></div>`;
}
function profileView() {
  const p=getProfile(state),ms=[...state.measurements].sort((a,b)=>b.date.localeCompare(a.date));
  return `${heading('BODY & GOALS','了解现在，靠近目标。','记录基础信息与身体变化，给训练一点更适合自己的方向。')}<div class="profile-grid"><section class="card profile-form"><div class="card-header"><h2>我的身体档案</h2><span class="tag outline">仅本地保存</span></div><form id="profile-form"><div class="form-section">基础信息</div><div class="field-row"><label class="field">怎么称呼你<input name="name" maxlength="40" value="${esc(state.profile.name)}" placeholder="例如：小林"></label><label class="field">身高 / cm<input name="height" type="number" min="80" max="250" step="0.1" value="${esc(state.profile.height)}" placeholder="可选" inputmode="decimal"></label></div><div class="field-row"><label class="field">训练目标<select name="goal">${options(['增肌','减脂','提升力量','保持健康'],state.profile.goal||'增肌')}</select></label><label class="field">训练经验<select name="experience">${options(['入门','有一定经验','进阶'],state.profile.experience||'入门')}</select></label></div><div class="form-section">添加一次身体记录 <span class="hint">（可选）</span></div><div class="field-row"><label class="field">体重 / kg<input name="weight" type="number" min="20" max="400" step="0.1" inputmode="decimal" placeholder="填写本次测量值"></label><label class="field">体脂率 / %<input name="bodyFat" type="number" min="2" max="70" step="0.1" inputmode="decimal" placeholder="可选"></label></div><label class="field">测量日期<input name="measurementDate" type="date" max="${today()}" value="${today()}" required><small>填写体重后会新增一条身体记录；相同日期会更新该日记录。</small></label><div id="profile-error" class="inline-error" role="alert"></div><button class="button" type="submit">${icon('check',15)} 保存身体档案</button></form><div class="profile-insight">${icon('leaf',20)}<span>身体变化不只体现在数字上。尽量在相近条件下测量，用长期趋势理解进步。体脂测量存在误差，不用于医疗判断。</span></div></section><div><section class="card"><div class="card-header"><h2>身体趋势</h2><span class="chart-key">体重 / kg</span></div><div class="profile-stats"><div class="profile-stat"><b>${p.height?fmt(p.height):'—'}</b><small>cm</small><span>身高</span></div><div class="profile-stat"><b>${p.weight?fmt(p.weight):'—'}</b><small>kg</small><span>最近体重</span></div><div class="profile-stat"><b>${p.bodyFat?fmt(p.bodyFat):'—'}</b><small>%</small><span>最近体脂</span></div></div>${weightChart()}<p class="chart-note">显示最近 12 次记录 · 完整数据保存在导出文件中</p></section><section class="card section-gap"><div class="card-header"><h2>测量记录</h2><span class="tag">${ms.length} 条</span></div>${ms.length?`<table class="measurement-table"><thead><tr><th scope="col">日期</th><th scope="col">体重 / kg</th><th scope="col">体脂 / %</th><th scope="col"><span class="visually-hidden">操作</span></th></tr></thead><tbody>${ms.slice(0,10).map(m=>`<tr><td>${esc(m.date)}</td><td>${fmt(m.weight)}</td><td>${m.bodyFat?fmt(m.bodyFat):'—'}</td><td>${iconButton('delete-measurement','删除'+m.date+'身体记录','trash',`data-id="${esc(m.id)}"`)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-row">每一次记录，都是了解自己的开始。</div>'}</section><section class="card section-gap"><div class="card-header"><h2>数据与备份</h2>${icon('shield',17)}</div><p class="section-intro">训练和身体数据保存在当前浏览器，不会自动同步。导出的备份包含你的个人记录，请妥善保管。</p><div class="data-actions">${button('export','导出 JSON','download','white small')}${button('import','导入备份','upload','white small')}${button('clear-data','清空本地数据','trash','danger small')}</div></section></div></div>`;
}
function selectedSession() {return reviewId==='draft'?state.draft:state.sessions.find(s=>s.id===reviewId);}
function reviewOptions() {return `${state.draft?option('draft','当前训练草稿',reviewId):''}${sessionsSorted().map(s=>option(s.id,`${s.date} · ${s.title}`,reviewId)).join('')}`;}
function ruleReviewHTML(s) {
  if(!s)return '<p>选择一次训练后，可以先查看本地规则检查。</p>';
  let review;try{review=localReview(getProfile(state),s,state.sessions);}catch{return '<p>暂无可用的规则检查，请先完成并保存训练。</p>';}
  if(typeof review==='string')return `<p>${esc(review)}</p>`;
  return `<p>${esc(review.summary)}</p>${(review.findings||[]).map(f=>`<div class="review-item"><strong>${esc(f.title)}</strong><span>${esc(f.detail)}</span></div>`).join('')}${review.suggestions?.length?`<ul>${review.suggestions.map(t=>`<li>${esc(typeof t==='object'?t.detail||t.title:t)}</li>`).join('')}</ul>`:''}`;
}
function coachView() {
  const s=selectedSession();
  return `${heading('YOUR TRAINING PARTNER','让每一次训练，更有方向。','从动作理解到训练复盘，把问题交给你的 AI 训练助手。')}<div class="coach-grid"><div><section class="coach-welcome"><div class="coach-symbol">${icon('spark',23)}</div><div><h2>你好，我是你的训练搭档。</h2><p>聊聊动作、计划或今天的训练表现。我们一起把下一次练得更好。</p></div></section><section class="card chat-card"><div class="chat-header"><strong>${icon('spark',14)} AI 教练对话</strong><span class="tag outline">基于模型知识与当前资料</span></div><div class="chat-messages" id="chat-messages" role="log" aria-live="polite">${messages.length?messages.map(messageHTML).join(''):`<div><p class="chat-intro">可以从一个具体问题开始。你的训练阶段和目标越清晰，建议越有参考价值。</p><div class="suggestions">${['新手胸部训练该怎么安排？','怎样判断一组的重量是否合适？','复合动作和孤立动作有什么区别？'].map(q=>`<button data-action="suggestion" data-question="${esc(q)}">${q} ${icon('arrow',10)}</button>`).join('')}</div></div>`}${chatBusy?`<div class="message"><div class="message-avatar">${icon('spark',14)}</div><div class="message-bubble">正在思考你的问题…</div></div>`:''}</div><form id="chat-form" class="chat-form"><div class="chat-compose"><label class="visually-hidden" for="chat-question">向 AI 教练提问</label><textarea id="chat-question" name="question" maxlength="1500" placeholder="写下你的训练问题…" required ${chatBusy?'disabled':''}></textarea><button type="submit" class="button" ${chatBusy?'disabled':''}>${icon('send',16)}<span>发送</span></button></div><p class="hint">点击发送后，将向模型服务发送你的问题、基础档案和本次对话上下文。不进行实时联网检索。</p></form></section>${reviewResult?`<section class="card section-gap" id="ai-review-output"><div class="card-header"><h2>AI 训练复盘</h2><span class="tag outline">${esc(reviewResult.title||'本次训练')}</span></div><div class="message-bubble" style="border:0;padding:0;background:none">${aiText(reviewResult.answer)}</div>${sourcesHTML(reviewResult.sources)}</section>`:''}<div class="privacy-note">${icon('info',14)}<span>AI 建议仅供训练参考，不用于医疗诊断。出现疼痛、头晕等不适时应停止训练并寻求专业帮助。动作学习可结合现场教练指导。</span></div></div><aside class="coach-aside"><section class="card coach-review"><div class="card-header"><h2>给这次训练做个复盘</h2>${icon('calendar',18)}</div><p>先看一眼完成情况，再让 AI 结合你的目标给出下次训练建议。</p><label class="field">选择训练<select id="review-session" ${!state.sessions.length&&!state.draft?'disabled':''}>${state.sessions.length||state.draft?reviewOptions():'<option value="">暂无训练记录</option>'}</select></label><div class="review-box"><h3>本地规则检查 <span class="tag">非 AI</span></h3>${ruleReviewHTML(s)}</div>${button('ai-review',reviewBusy?'正在生成复盘…':'请 AI 复盘这次训练','spark','',reviewBusy||!s?'disabled':'')}<p class="hint">点击后发送所选训练、基础档案及最近最多 8 次训练，用于分析训练安排。这里不会自动发送记录。</p></section><section class="card section-gap"><div class="card-header"><h2>你的训练方向</h2>${icon('leaf',18)}</div><div class="review-item"><strong>当前目标</strong><span>${esc(state.profile.goal||'尚未设置')}</span></div><div class="review-item"><strong>训练经验</strong><span>${esc(state.profile.experience||'尚未设置')}</span></div><button class="text-button" data-action="nav" data-page="profile">完善身体档案 ${icon('arrow',12)}</button></section></aside></div>`;
}
function messageHTML(m) {return `<div class="message ${m.role==='user'?'user':''}"><div class="message-avatar">${m.role==='user'?esc((state.profile.name||'我')[0]):icon('spark',14)}</div><div><div class="message-bubble">${aiText(m.content)}${sourcesHTML(m.sources)}</div>${m.role==='assistant'?'<div class="message-meta">'+(m.error?'请求失败 · 尚未获得 AI 回答':'AI 回答 · 请结合实际训练情况判断')+'</div>':''}</div></div>`;}
function sourcesHTML(sources=[]) {return sources?.length?`<div class="sources">${sources.filter(s=>s&&s.url).map(s=>`<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.url)} ↗</a>`).join('')}</div>`:'';}

function showExercise(id) {
  const ex=exById(id);if(!ex)return;
  dialogExercise=id;dialogBusy=false;
  dialog.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">MOVEMENT GUIDE · ${esc(groupName(ex.group))}</div><h2 id="dialog-title">${esc(ex.name)}</h2><p>${esc(ex.en)}</p></div>${iconButton('close-dialog','关闭动作指南','close')}</div><div class="dialog-content"><div class="dialog-info"><div class="dialog-visual">${bodySVG(ex.group,groupSub(ex))}<span class="tag">部位示意</span></div><div><div class="exercise-meta" style="margin-bottom:18px"><span class="tag">${esc(groupSub(ex))}</span><span class="tag">${esc(ex.equipment)}</span><span class="tag orange">${esc(ex.difficulty)}</span></div><div class="dialog-section"><h3>如何完成这个动作</h3><ol>${(ex.steps||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol></div>${ex.secondary?.length?`<p class="hint">协同参与：${esc(ex.secondary.join('、'))}</p>`:''}</div></div><div class="field-row"><section class="dialog-section"><h3>记住这几个要点</h3><ul>${(ex.cues||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section><section class="dialog-section"><h3>留意常见错误</h3><ul>${(ex.mistakes||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section></div><div class="dialog-privacy">${button('explain-exercise','让 AI 讲解这个动作','spark','white small','id="explain-button"')}<span>点击后发送动作信息和基础档案</span></div><div class="dialog-response" id="exercise-ai-response" role="status"></div><div class="notice" style="margin-bottom:0">${icon('info',14)}<span>标签表示训练侧重；图示不代表精确肌肉隔离。先用可控负重学习动作，出现疼痛请停止训练。</span></div></div><div class="dialog-footer"><div class="dialog-source">参考资料：${ex.source?`<a href="${safeUrl(ex.source.url)}" target="_blank" rel="noopener noreferrer">${esc(ex.source.title)} ↗</a>`:'动作训练资料'}</div>${button('add-exercise','添加到本次训练','plus','',`data-id="${esc(ex.id)}"`)}</div>`;
  const source=$('.dialog-source',dialog);
  if(source)for(const note of [ex.source?.scope,ex.source?.note].filter(Boolean)){const line=document.createElement('span');line.style.display='block';line.style.marginTop='4px';line.textContent=note;source.append(line);}
  if(!dialog.open)dialog.showModal();
}

let timer={duration:90,remaining:90,deadline:null,running:false};
try { const saved=JSON.parse(sessionStorage.getItem('lianji-timer')||'null');if(saved&&Number.isFinite(saved.duration)&&saved.duration>=0&&saved.duration<=3600)timer=saved; } catch {}
function saveTimer(){try{sessionStorage.setItem('lianji-timer',JSON.stringify(timer));}catch{}}
function timerText(){const n=Math.max(0,Math.ceil(timer.running?(timer.deadline-Date.now())/1000:timer.remaining));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function updateTimer(){const display=$('#timer-display');if(display)display.textContent=timerText();const toggle=$('#timer-toggle');if(toggle)toggle.innerHTML=`${icon('clock',14)} ${timer.running?'暂停':'开始休息'}`;}
function startTimer(seconds){timer.duration=Number(seconds)||0;timer.remaining=timer.duration;timer.deadline=Date.now()+timer.duration*1000;timer.running=timer.duration>0;saveTimer();updateTimer();}
setInterval(()=>{if(timer.running&&Date.now()>=timer.deadline){timer.running=false;timer.remaining=0;timer.deadline=null;saveTimer();toast('休息时间到，准备好再开始下一组。');}updateTimer();},300);
function getSet(entryId,setId){const e=state.draft?.exercises.find(e=>e.id===entryId);return {entry:e,set:e?.sets.find(s=>s.id===setId)};}
function updateDraftStats(){const st=stats(state.draft);if($('#draft-set-count'))$('#draft-set-count').textContent=st.sets;if($('#draft-volume'))$('#draft-volume').textContent=fmt(st.volume);}
function validInputs(root=$('#main')){for(const input of root.querySelectorAll('input,select,textarea'))if(!input.checkValidity()){input.reportValidity();return false;}return true;}
function saveSession(){
  const draft=state.draft;if(!draft)return;
  if(!validInputs())return;
  if(!draft.title.trim()){toast('给这次训练起个名字吧。');$('#draft-title')?.focus();return;}
  if(!draft.date||draft.date>today()){toast('请选择今天或之前的训练日期。');return;}
  if(!draft.exercises.length||!draft.exercises.some(e=>e.sets.some(s=>s.done))){toast('请至少记录并勾选一组已完成的训练。');return;}
  const candidate=copy(state),record=copy(draft),index=candidate.sessions.findIndex(s=>s.id===draft.id);
  if(index>=0)candidate.sessions[index]=record;else candidate.sessions.unshift(record);
  candidate.draft=null;const checked=validateState(candidate);
  if(!checked.valid){toast(checked.error||'请检查训练记录中的数值。');return;}
  state=checked.state;persist();reviewId=record.id;workoutTab='history';calendarSelected=record.date;calendarMonth=record.date.slice(0,7);go('calendar');toast('训练已保存到日历。');
}
async function editSession(id){const s=state.sessions.find(s=>s.id===id);if(!s)return;if(state.draft&&state.draft.id!==id&&!await confirmAction('当前还有训练草稿。改为编辑这次历史训练会替换草稿，继续吗？',{title:'替换训练草稿',confirmLabel:'编辑历史训练'}))return;if(state.draft?.id!==id){state.draft=copy(s);persist();}calendarSelected=s.date;calendarMonth=s.date.slice(0,7);workoutTab='current';go('workout');}
function exportData(){
  const checked=validateState(state);if(!checked.valid){toast('当前记录格式异常，请先检查输入。');return;}
  const blob=new Blob([JSON.stringify(checked.state,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`练记-数据备份-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，请妥善保管个人数据。');
}
async function importData(file){
  if(!file)return;if(file.size>8*1024*1024){toast('备份文件过大，请选择 8 MB 以内的 JSON 文件。');return;}
  try{const parsed=JSON.parse(await file.text()),checked=validateState(parsed);if(!checked.valid)throw Error(checked.error||'备份格式不正确');if(!await confirmAction(`备份包含 ${checked.state.sessions.length} 次训练、${checked.state.measurements.length} 条身体记录。导入将替换当前全部数据，建议先导出备份。继续导入吗？`,{title:'导入备份并替换记录',confirmLabel:'确认导入',danger:true}))return;state=checked.state;persist();reviewId=state.draft?'draft':sessionsSorted()[0]?.id||'';reviewResult=null;messages=[];render();toast('备份已导入。');}catch(e){toast('无法导入：'+e.message);}
}
async function callCoach(payload){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),95000);
  try{const res=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,webSearch:false}),signal:controller.signal});let data;try{data=await res.json();}catch{throw Error('服务返回格式异常，请稍后重试。');}if(!res.ok)throw Error(data.error||'模型服务暂时不可用。');if(typeof data.answer!=='string'||!data.answer.trim())throw Error('模型暂未返回回答，请重试。');return data;}catch(e){if(e.name==='AbortError')throw Error('模型响应超时，请稍后重试。');throw e;}finally{clearTimeout(timeout);}
}
async function sendChat(question){
  if(chatBusy)return;question=question.trim();if(!question||question.length>1500)return;
  const history=messages.filter(m=>!m.error).slice(-8).map(m=>({role:m.role,content:m.content}));
  messages.push({role:'user',content:question});chatBusy=true;render();scrollChat();
  try{const data=await callCoach({mode:'chat',question,profile:getProfile(state),history});messages.push({role:'assistant',content:data.answer,sources:data.sources||[]});}
  catch(e){messages.push({role:'assistant',content:'请求未完成：'+e.message,error:true});}
  finally{chatBusy=false;if(route==='coach'){render();scrollChat();}}
}
function scrollChat(){requestAnimationFrame(()=>{const el=$('#chat-messages');if(el)el.scrollTop=el.scrollHeight;});}
async function aiReview(){
  const s=selectedSession();if(!s||reviewBusy)return;
  if(!s.exercises.some(e=>e.sets.some(set=>set.done&&!set.warmup))){toast('请至少完成一个正式组，再生成 AI 复盘。');return;}
  const session=copy(s),profile=copy(getProfile(state));reviewBusy=true;render();
  try{const data=await callCoach({mode:'review',question:'请根据这次已完成的训练与我的目标，评价训练安排、负荷记录、组间休息及恢复，给出下一次可执行的改进建议。说明数据不足之处，不要从记录推断动作姿势。',profile,session,history:sessionsSorted().filter(x=>x.id!==s.id&&x.date<=s.date).slice(0,8)});reviewResult={...data,title:session.title};}
  catch(e){reviewResult={title:session.title,answer:'复盘请求未完成：'+e.message,sources:[]};}
  finally{reviewBusy=false;if(route==='coach'){render();$('#ai-review-output')?.scrollIntoView({behavior:'smooth',block:'nearest'});}}
}
async function explainExercise(){
  if(dialogBusy||!dialogExercise)return;const id=dialogExercise,ex=exById(id);dialogBusy=true;
  const btn=$('#explain-button');btn.disabled=true;btn.innerHTML=icon('spark',14)+' 正在整理动作讲解…';$('#exercise-ai-response').textContent='正在结合动作资料整理讲解…';
  try{const data=await callCoach({mode:'exercise',question:`请讲解${ex.name}的准备姿势、动作过程、呼吸节奏、训练侧重、常见错误与适合新手的学习方法。说明多肌群协同参与；不从个人数据推断姿势。`,exerciseId:id,profile:getProfile(state)});if(dialogExercise===id&&dialog.open){$('#exercise-ai-response').innerHTML=`${aiText(data.answer)}${sourcesHTML(data.sources)}`;}}
  catch(e){if(dialogExercise===id&&dialog.open)$('#exercise-ai-response').textContent='讲解请求未完成：'+e.message;}
  finally{if(dialogExercise===id){dialogBusy=false;const b=$('#explain-button');if(b){b.disabled=false;b.innerHTML=icon('spark',14)+' 让 AI 再讲解一次';}}}
}

document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action,id=el.dataset.id;
  switch(action){
    case 'nav':go(el.dataset.page);break;
    case 'model-retry':void loadModelConfig();break;
    case 'model-preset':{
      if(modelConfigBusy)break;
      modelConfigDraft=id==='aihubmix'?{name:'我的 API',baseUrl:'https://aihubmix.com/v1',model:'coding-glm-5.3-flash-free'}:{name:'我的 API',baseUrl:'https://api.openai.com/v1',model:''};
      modelConfigNotice=null;render();$('#model-base-url')?.focus();break;
    }
    case 'model-test':void testModelConfig();break;
    case 'model-reset':void resetModelConfig();break;
    case 'start':ensureDraft();persist();workoutTab='current';go('workout');break;
    case 'calendar-select':selectCalendarDate(id,true);break;
    case 'calendar-today':selectCalendarDate(today(),true);break;
    case 'calendar-month':{
      const next=shiftMonth(calendarMonth,Number(id));
      if(next<'1000-01'||next>'9998-12')break;
      calendarMonth=next;calendarSelected=next===today().slice(0,7)?today():next+'-01';render();break;
    }
    case 'calendar-add':await addCalendarSession(id);break;
    case 'calendar-resume':workoutTab='current';go('workout');break;
    case 'template':await useTemplate();break;
    case 'history':workoutTab='history';go('workout');break;
    case 'workout-current':ensureDraft();persist();workoutTab='current';render();break;
    case 'workout-tab':workoutTab=id;render();break;
    case 'anatomy-group':dashboardGroup=id;dashboardSub='all';render();break;
    case 'anatomy-sub':dashboardSub=id;render();break;
    case 'anatomy-open':filters={group:dashboardGroup,sub:dashboardSub,q:'',favorites:false};go('library');break;
    case 'group':filters={group:id,sub:'all',q:'',favorites:false};go('library');break;
    case 'filter-group':filters.group=id;filters.sub='all';render();break;
    case 'filter-sub':filters.sub=id;render();break;
    case 'favorites':filters.favorites=!filters.favorites;render();break;
    case 'favorite':favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('lianji-favorites',JSON.stringify([...favorites]));}catch{toast('收藏暂时无法写入浏览器存储。');}render();break;
    case 'exercise':showExercise(id);break;
    case 'close-dialog':dialog.close();break;
    case 'add-exercise':if(state.draft?.exercises.length>=60){toast('单次训练最多记录 60 个动作。');break;}addExercise(id);break;
    case 'remove-exercise':{const e=state.draft?.exercises.find(e=>e.id===id);if(!e)break;if(e.sets.some(s=>s.done)&&!await confirmAction('这个动作已有完成记录，仍要从本次训练移除吗？',{title:'移除训练动作',confirmLabel:'确认移除',danger:true}))break;state.draft.exercises=state.draft.exercises.filter(e=>e.id!==id);persist();render();break;}
    case 'add-set':{const e=state.draft?.exercises.find(e=>e.id===id);if(!e)break;if(e.sets.length>=100){toast('单个动作最多记录 100 组。');break;}e.sets.push(newSet(e.sets.at(-1)));persist();render();break;}
    case 'remove-set':{const {entry,set}=getSet(el.dataset.entry,el.dataset.set);if(!entry||!set)break;if(set.done&&!await confirmAction('这组已标记完成，仍要删除吗？',{title:'删除已完成训练组',confirmLabel:'确认删除',danger:true}))break;entry.sets=entry.sets.filter(s=>s.id!==set.id);persist();render();break;}
    case 'save-session':saveSession();break;
    case 'discard-draft':if(await confirmAction('放弃当前草稿吗？未保存的训练内容将被删除。',{title:'放弃训练草稿',confirmLabel:'放弃草稿',danger:true})){state.draft=null;persist();render();}break;
    case 'edit-session':await editSession(id);break;
    case 'delete-session':if(await confirmAction('确定删除这次训练记录吗？此操作无法撤销，建议先导出备份。',{title:'删除训练记录',confirmLabel:'确认删除',danger:true})){state.sessions=state.sessions.filter(s=>s.id!==id);if(state.draft?.id===id)state.draft=null;if(reviewId===id)reviewId=state.sessions[0]?.id||'';reviewResult=null;persist();render();toast('训练记录已删除。');}break;
    case 'delete-measurement':if(await confirmAction('确定删除这条身体测量记录吗？',{title:'删除身体记录',confirmLabel:'确认删除',danger:true})){state.measurements=state.measurements.filter(m=>m.id!==id);persist();render();toast('身体记录已删除。');}break;
    case 'export':exportData();break;
    case 'import':$('#import-file').click();break;
    case 'clear-data':if(await confirmAction('这将清空本浏览器中的全部训练、身体记录和收藏。建议先导出备份；此操作无法撤销。',{title:'清空全部本地记录',confirmLabel:'清空数据',danger:true,requiredText:'清空'})){state=emptyState();favorites.clear();messages=[];reviewResult=null;reviewId='';try{localStorage.removeItem('lianji-favorites');localStorage.removeItem('fitness-agent-state-v1-recovery');}catch{}persist();render();toast('本地记录已清空。');}break;
    case 'timer-preset':startTimer(Number(id));timer.running=false;timer.deadline=null;saveTimer();render();break;
    case 'timer-toggle':if(timer.running){timer.remaining=Math.max(0,Math.ceil((timer.deadline-Date.now())/1000));timer.running=false;timer.deadline=null;}else{if(timer.remaining<=0)timer.remaining=timer.duration;timer.deadline=Date.now()+timer.remaining*1000;timer.running=true;}saveTimer();updateTimer();break;
    case 'timer-reset':timer.running=false;timer.deadline=null;timer.remaining=timer.duration;saveTimer();updateTimer();break;
    case 'review-session':reviewId=id;go('coach');break;
    case 'review-draft':if(validInputs()){reviewId='draft';go('coach');}break;
    case 'suggestion':{const input=$('#chat-question');input.value=el.dataset.question;input.focus();break;}
    case 'ai-review':void aiReview();break;
    case 'explain-exercise':void explainExercise();break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.closest('#model-config-form')){
    if(['name','baseUrl','model'].includes(el.name))modelConfigDraft[el.name]=el.value;
    if(modelConfigNotice){modelConfigNotice=null;const feedback=$('#model-config-feedback');if(feedback)feedback.replaceChildren();}
    return;
  }
  if(el.id==='exercise-search'){filters.q=el.value;$('#library-results').innerHTML=exerciseGrid();return;}
  if(el.dataset.draftField&&state.draft){if(!el.validity.valid||(el.type==='date'&&!el.value))return;state.draft[el.dataset.draftField]=el.dataset.draftField==='readiness'?Number(el.value):el.dataset.draftField==='startTime'?(el.value||null):el.value;persist();}
  if(el.dataset.durationField&&state.draft){
    el.setCustomValidity('');
    if(!el.value.trim()){state.draft.durationSeconds=null;persist();return;}
    if(!/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(el.value)){el.setCustomValidity('请按 时:分:秒 填写，例如 01:20:30。');return;}
    const [hours,minutes,seconds]=el.value.split(':').map(Number),duration=hours*3600+minutes*60+seconds;
    if(duration<1||duration>86400){el.setCustomValidity('训练时长应在 1 秒到 24 小时之间。');return;}
    state.draft.durationSeconds=duration;persist();
  }
  if(el.dataset.setField&&el.type!=='checkbox'){
    const {set}=getSet(el.dataset.entry,el.dataset.set);if(!set)return;
    if(!el.validity.valid)return;
    set[el.dataset.setField]=el.value===''&&el.dataset.setField==='rpe'?null:Number(el.value);persist();updateDraftStats();
  }
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='calendar-jump'&&el.validity.valid&&/^\d{4}-\d{2}$/.test(el.value)){calendarMonth=el.value;calendarSelected=el.value===today().slice(0,7)?today():el.value+'-01';render();}
  if(el.dataset.setField&&el.type==='checkbox'){
    const {set}=getSet(el.dataset.entry,el.dataset.set);if(!set)return;
    if(el.dataset.setField==='done'&&el.checked&&!validInputs(el.closest('.workout-exercise'))){el.checked=false;return;}
    set[el.dataset.setField]=el.checked;if(el.dataset.setField==='done'&&set.done)startTimer(set.rest);persist();render();
  }
  if(el.id==='review-session'){reviewId=el.value;render();}
  if(el.id==='body-trend-metric'){chartMetric=el.value==='bodyFat'?'bodyFat':'weight';render();}
  if(el.id==='import-file'){void importData(el.files[0]);el.value='';}
});
document.addEventListener('submit',event=>{
  if(event.target.id==='model-config-form'){event.preventDefault();void saveModelConfig();return;}
  if(event.target.id==='chat-form'){event.preventDefault();void sendChat(new FormData(event.target).get('question')||'');}
  if(event.target.id==='profile-form'){
    event.preventDefault();const form=event.target;if(!form.reportValidity())return;const fd=new FormData(form),weight=String(fd.get('weight')||'').trim(),fat=String(fd.get('bodyFat')||'').trim(),date=String(fd.get('measurementDate'));
    const err=$('#profile-error');err.textContent='';
    if(fat&&!weight){err.textContent='添加身体记录时请同时填写本次体重。';return;}
    if((weight||fat)&&(!date||date>today())){err.textContent='请选择今天或之前的有效测量日期。';return;}
    const candidate=copy(state);candidate.profile={name:String(fd.get('name')||'').trim(),height:fd.get('height')===''?null:Number(fd.get('height')),goal:String(fd.get('goal')),experience:String(fd.get('experience'))};
    if(weight){const previous=candidate.measurements.find(m=>m.date===date),measurement={id:previous?.id||uuid(),date,weight:Number(weight),bodyFat:fat?Number(fat):null};if(previous)candidate.measurements[candidate.measurements.indexOf(previous)]=measurement;else candidate.measurements.push(measurement);}
    const checked=validateState(candidate);if(!checked.valid){err.textContent=checked.error;return;}state=checked.state;persist();render();toast(weight?'档案与本次身体记录已保存。':'身体档案已保存。');
  }
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(routes[next]&&route!==next){route=next;render();window.scrollTo({top:0,behavior:'instant'});}});
render();
if(globalThis.fitnessStorageError||globalThis.fitnessRecoveryNotice)setTimeout(()=>toast(globalThis.fitnessStorageError||globalThis.fitnessRecoveryNotice),350);
void refreshApiStatus();
