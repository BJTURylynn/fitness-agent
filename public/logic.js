import { EXERCISES } from './data.js';

export const STORAGE_KEY = 'fitness-agent-state-v1';
export function today() {
  return new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
export function uuid() { return globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2); }
export function emptyState() {
  return {version:1,profile:{name:'',goal:'增肌',experience:'入门',height:null},measurements:[],sessions:[],draft:null};
}
const obj = x => x && typeof x==='object' && !Array.isArray(x);
const dateOK = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x+'T00:00:00Z')) && new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const text = (x,n=200) => typeof x==='string'?x.slice(0,n):'';
const idOK = x => typeof x==='string' && x.length>0 && x.length<=100;
const number = (x,min,max,nullable=false) => (nullable&&(x==null||x===''))?null:(typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max?x:undefined);
export function validateState(input) {
  try {
    if (!obj(input)||input.version!==1||!obj(input.profile)||!Array.isArray(input.measurements)||!Array.isArray(input.sessions)||input.measurements.length>5000||input.sessions.length>5000) throw Error('备份格式或版本不正确');
    const p=input.profile;
    const height=number(p.height,50,260,true);
    if(height===undefined)throw Error('身高应为 50–260 cm');
    const state=emptyState();
    state.profile={name:text(p.name,60),goal:text(p.goal,30)||'增肌',experience:text(p.experience,30)||'入门',height};
    const ids=new Set();
    state.measurements=input.measurements.map(m=>{
      if(!obj(m)||!dateOK(m.date)||!idOK(m.id)||ids.has(m.id))throw Error('身体记录日期或编号无效');
      ids.add(m.id);
      const weight=number(m.weight,20,500,true), bodyFat=number(m.bodyFat,1,75,true);
      if(weight===undefined||bodyFat===undefined||(weight===null&&bodyFat===null))throw Error('体重或体脂率不在可记录范围');
      return {id:text(m.id,100),date:m.date,weight,bodyFat};
    });
    const known=new Set(EXERCISES.map(e=>e.id));
    function session(s) {
      if(!obj(s)||!dateOK(s.date)||!idOK(s.id)||!Array.isArray(s.exercises)||s.exercises.length>60)throw Error('训练记录格式错误');
      const seen=new Set();
      const exercises=s.exercises.map(e=>{
        if(!obj(e)||!idOK(e.id)||seen.has(e.id)||!known.has(e.exerciseId)||!Array.isArray(e.sets)||e.sets.length>100)throw Error('动作或组数无效');
        seen.add(e.id);
        const setIds=new Set();
        return {id:text(e.id,100),exerciseId:e.exerciseId,sets:e.sets.map(s=>{
          if(!obj(s)||!idOK(s.id)||setIds.has(s.id))throw Error('训练组编号无效');
          setIds.add(s.id);
          const weight=number(s.weight,0,1000),reps=number(s.reps,1,1000),rest=number(s.rest,0,3600),rpe=number(s.rpe,1,10,true);
          if(weight===undefined||reps===undefined||!Number.isInteger(reps)||rest===undefined||rpe===undefined||typeof s.done!=='boolean'||typeof s.warmup!=='boolean')throw Error('训练组数值无效：重量≥0，次数为正整数，RPE 为 1–10');
          return {id:text(s.id,100),weight,reps,rest,rpe,done:s.done,warmup:s.warmup};
        })};
      });
      const readiness=number(s.readiness,1,5,true);
      if(readiness===undefined)throw Error('训练状态应为 1–5');
      const startTime=s.startTime==null?null:s.startTime;
      const durationSeconds=s.durationSeconds==null?null:s.durationSeconds;
      if(startTime!==null&&(typeof startTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)))throw Error('训练开始时间应为 HH:mm');
      if(durationSeconds!==null&&(!Number.isInteger(durationSeconds)||durationSeconds<1||durationSeconds>86400))throw Error('训练时长应为 1–86400 秒的整数');
      return {id:text(s.id,100),date:s.date,startTime,durationSeconds,title:text(s.title,120),notes:text(s.notes,2000),readiness,soreness:text(s.soreness,500),exercises};
    }
    const sessionsSeen=new Set();
    state.sessions=input.sessions.map(s=>{if(sessionsSeen.has(s.id))throw Error('训练编号重复');sessionsSeen.add(s.id);return session(s)});
    state.draft=input.draft==null?null:session(input.draft);
    return {valid:true,state};
  } catch(e) { return {valid:false,error:e.message}; }
}
export function loadState() {
  let raw;
  try {
    raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return emptyState();
    const result=validateState(JSON.parse(raw));
    if(!result.valid)throw Error(result.error);
    return result.state;
  } catch(e) {
    try {
      if(raw&&!localStorage.getItem(STORAGE_KEY+'-recovery'))localStorage.setItem(STORAGE_KEY+'-recovery',raw);
      globalThis.fitnessRecoveryNotice='原始异常记录已保留在本地恢复副本中，可重新导入有效备份。';
    } catch {
      globalThis.fitnessStorageError='本地存储不可用，请检查浏览器存储空间或权限。';
    }
    return emptyState();
  }
}
export function saveState(state) {
  const checked=validateState(state);
  if(!checked.valid)throw Error(checked.error);
  if(globalThis.fitnessStorageError)throw Error(globalThis.fitnessStorageError);
  localStorage.setItem(STORAGE_KEY,JSON.stringify(checked.state));
  return checked.state;
}
export function getProfile(state) {
  const sorted=[...state.measurements].sort((a,b)=>b.date.localeCompare(a.date));
  const weight=sorted.find(m=>m.weight!=null), fat=sorted.find(m=>m.bodyFat!=null);
  return {...state.profile,weight:weight?.weight??null,bodyFat:fat?.bodyFat??null,weightDate:weight?.date??null,bodyFatDate:fat?.date??null,measurementDate:weight?.date===fat?.date?weight?.date??null:null,latestMeasurementDate:sorted[0]?.date??null};
}
export function sessionStats(session) {
  let sets=0,reps=0,volume=0,exercises=0,plannedSets=0;
  for(const e of session?.exercises||[]){
    const complete=e.sets.filter(s=>s.done&&!s.warmup);
    plannedSets+=e.sets.filter(s=>!s.warmup).length;
    if(complete.length)exercises++;
    for(const s of complete){sets++;reps+=Number(s.reps)||0;volume+=(Number(s.weight)||0)*(Number(s.reps)||0)}
  }
  return {sets,reps,volume:Math.round(volume*10)/10,exercises,plannedSets};
}
export function localReview(profile,session,history=[]) {
  const stats=sessionStats(session);
  const findings=[],suggestions=[];
  if(!stats.sets)return {summary:'还没有已完成的正式组。勾选完成后再复盘。',findings:[],suggestions:['先记录实际训练，不将计划组计入训练量。']};
  findings.push({title:'本次完成',detail:stats.exercises+' 个动作，'+stats.sets+' 个正式组，'+stats.reps+' 次。重量×次数合计 '+stats.volume+' kg·次。',tone:'good'});
  const entries=(session.exercises||[]).flatMap(e=>e.sets.filter(s=>s.done&&!s.warmup).map(s=>({...s,exercise:EXERCISES.find(x=>x.id===e.exerciseId)})));
  const rpes=entries.map(s=>s.rpe).filter(x=>x!=null&&x!=='');
  if(rpes.length){
    const avg=rpes.reduce((a,b)=>a+Number(b),0)/rpes.length;
    findings.push({title:'主观用力',detail:rpes.length+'/'+stats.sets+' 组填写 RPE，已填写组平均 '+avg.toFixed(1)+'。未填写组的强度未知。',tone:avg>=9?'warn':'neutral'});
    if(avg>=9)suggestions.push('多组接近力竭时，先确认恢复和动作稳定性，下次可减少部分组数或负荷。');
  }else suggestions.push('补充每组 RPE（主观用力 1–10）能帮助判断训练强度，重量本身不能代表吃力程度。');
  if(entries.some(s=>s.exercise?.kind==='compound'&&s.rest<60))suggestions.push('部分复合动作记录的组间休息不足 60 秒；若后续表现下降，可适当延长休息。这里记录的是你的设定休息时间。');
  const groups=new Set(entries.map(s=>s.exercise?.group).filter(Boolean));
  findings.push({title:'部位覆盖',detail:'本次涉及 '+[...groups].map(g=>({chest:'胸',shoulder:'肩',back:'背',legs:'腿',arms:'手臂',abs:'腹'}[g])).join('、')+'。单次集中练一个部位可以合理，需结合整周安排判断。',tone:'neutral'});
  const prior=history.filter(s=>s.id!==session.id&&s.date<session.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(prior)findings.push({title:'历史参照',detail:'最近一次历史训练为 '+prior.date+'。不同动作、器械的重量×次数不能直接比较进步。',tone:'neutral'});
  if(session.readiness!=null&&Number(session.readiness)<=2)suggestions.push('今天自评状态偏低，优先控制训练量和技术稳定，必要时安排轻量恢复。');
  if(session.soreness?.trim())suggestions.push('已记录不适：'+session.soreness.slice(0,150)+'。若有锐痛或持续加重的疼痛，停止相关动作并寻求专业评估。');
  if(!profile?.height||!profile?.weight)suggestions.push('可补充身体档案和训练经验；体脂率仅作趋势参考，不据此给出诊断或精确负荷。');
  suggestions.push('下一次先复现稳定动作和目标次数，再考虑小幅增加负荷；数据记录无法确认动作姿势。');
  return {summary:'基于已记录数据的本地规则复盘',findings,suggestions};
}
