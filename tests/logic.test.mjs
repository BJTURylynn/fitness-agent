import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateState,sessionStats,localReview,getProfile,today} from '../public/logic.js';
import {EXERCISES,GROUPS} from '../public/data.js';
const sample = () => ({id:'session-1',date:'2026-11-03',startTime:null,durationSeconds:null,title:'测试训练',notes:'',readiness:3,soreness:'',exercises:[{id:'entry-1',exerciseId:EXERCISES[0].id,sets:[{id:'set-1',weight:40,reps:8,rest:90,rpe:8,done:true,warmup:false},{id:'set-2',weight:20,reps:10,rest:60,rpe:null,done:true,warmup:true},{id:'set-3',weight:40,reps:8,rest:90,rpe:null,done:false,warmup:false}]}]});
test('taxonomy covers six groups, unique ids and valid subgroups',()=>{
 assert.equal(GROUPS.length,6); assert.ok(EXERCISES.length>=30);assert.equal(new Set(EXERCISES.map(e=>e.id)).size,EXERCISES.length);
 for(const e of EXERCISES){const g=GROUPS.find(g=>g.id===e.group);assert.ok(g,e.id);assert.ok(g.subs.includes(e.sub),e.id);assert.ok(e.steps.length);assert.ok(new URL(e.source.url).protocol==='https:')}
});
test('round-trip backup preserves completed sessions and optional body metrics',()=>{
 const state=emptyState();state.sessions=[sample()];state.profile.height=175;state.measurements=[{id:'m1',date:'2026-11-02',weight:70,bodyFat:null}];
 const result=validateState(JSON.parse(JSON.stringify(state)));assert.equal(result.valid,true,result.error);assert.deepEqual(result.state,state);assert.equal(getProfile(state).weight,70);
});
test('legacy backups normalize missing session and draft timing without inventing a duration',()=>{
 const state=emptyState();state.sessions=[sample()];state.draft={...sample(),id:'draft-1'};
 for(const session of [state.sessions[0],state.draft]){delete session.startTime;delete session.durationSeconds}
 const result=validateState(state);assert.equal(result.valid,true,result.error);
 for(const session of [result.state.sessions[0],result.state.draft]){assert.equal(session.startTime,null);assert.equal(session.durationSeconds,null)}
});
test('session and draft timing survives backup round trips with boundary values',()=>{
 const state=emptyState();state.sessions=[{...sample(),startTime:'00:00',durationSeconds:1}];state.draft={...sample(),id:'draft-1',startTime:'23:59',durationSeconds:86400};
 const result=validateState(JSON.parse(JSON.stringify(state)));assert.equal(result.valid,true,result.error);assert.deepEqual(result.state,state);
});
test('import validates clock strings and whole-second duration bounds for sessions and drafts',()=>{
 const invalidTimes=['','9:00','24:00','12:60','12:00:00',' 12:00',900];
 const invalidDurations=[0,-1,86401,1.5,'3600','',NaN,Infinity];
 for(const target of ['session','draft']){
  for(const [field,values] of [['startTime',invalidTimes],['durationSeconds',invalidDurations]]){
   for(const value of values){
    const state=emptyState(),session=sample();session[field]=value;
    if(target==='session')state.sessions=[session];else state.draft=session;
    assert.equal(validateState(state).valid,false,target+' '+field+' '+String(value));
   }
  }
 }
});
test('import rejects invalid dates, negative load and unknown exercises',()=>{
 for(const mutate of [s=>s.date='2026-02-31',s=>s.exercises[0].sets[0].weight=-3,s=>s.exercises[0].exerciseId='unknown']){
 const state=emptyState();const s=sample();mutate(s);state.sessions=[s];assert.equal(validateState(state).valid,false);
 }
});
test('volume counts completed working sets only',()=>{
 assert.deepEqual(sessionStats(sample()),{sets:1,reps:8,volume:320,exercises:1,plannedSets:2});
});
test('review never invents RPE and never treats planned sets as completed',()=>{
 const s=sample();s.exercises[0].sets[0].rpe=null;const review=localReview({},s,[]);assert.match(review.suggestions.join(' '),/RPE/);assert.match(review.findings[0].detail,/1 个正式组/);
});
test('latest measurement selection follows date rather than insertion order',()=>{
 const state=emptyState();state.measurements=[{date:'2026-11-03',weight:72,bodyFat:null},{date:'2026-11-01',weight:70,bodyFat:18}];
 assert.equal(getProfile(state).weight,72);assert.equal(getProfile(state).bodyFat,18);assert.match(today(),/^\d{4}-\d{2}-\d{2}$/);
});


test('import rejects long IDs before normalization at every editable level',()=>{
 const long='x'.repeat(101);
 const variants=[
  state=>state.measurements=[{id:long,date:'2026-11-03',weight:70,bodyFat:null}],
  state=>state.sessions[0].id=long,
  state=>state.sessions[0].exercises[0].id=long,
  state=>state.sessions[0].exercises[0].sets[0].id=long
 ];
 for(const mutate of variants){const state=emptyState();state.sessions=[sample()];mutate(state);assert.equal(validateState(state).valid,false)}
 const state=emptyState();
 state.measurements=[{id:'x'.repeat(100)+'A',date:'2026-11-01',weight:70,bodyFat:null},{id:'x'.repeat(100)+'B',date:'2026-11-02',weight:71,bodyFat:null}];
 assert.equal(validateState(state).valid,false);
});

test('profile retains separate measurement dates instead of assigning old body fat a new date',()=>{
 const state=emptyState();
 state.measurements=[{id:'new',date:'2026-11-03',weight:72,bodyFat:null},{id:'old',date:'2026-10-01',weight:70,bodyFat:18}];
 const profile=getProfile(state);
 assert.equal(profile.weight,72);assert.equal(profile.bodyFat,18);
 assert.equal(profile.weightDate,'2026-11-03');assert.equal(profile.bodyFatDate,'2026-10-01');
 assert.equal(profile.latestMeasurementDate,'2026-11-03');assert.equal(profile.measurementDate,null);
 state.measurements=[{id:'together',date:'2026-11-03',weight:72,bodyFat:18}];
 assert.equal(getProfile(state).measurementDate,'2026-11-03');
});
