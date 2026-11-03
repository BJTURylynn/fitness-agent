import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {monthCells,shiftMonth,formatDuration,summarizeSessions} from '../public/calendar.js';
import {EXERCISES} from '../public/data.js';

test('calendar is a 42-day Monday-first grid with adjacent-month dates',()=>{
 const cells=monthCells('2026-11');
 assert.equal(cells.length,42);
 assert.deepEqual(cells[0],{date:'2026-10-26',inMonth:false});
 assert.deepEqual(cells[6],{date:'2026-11-01',inMonth:true});
 assert.deepEqual(cells[41],{date:'2026-12-06',inMonth:false});
 assert.equal(cells.filter(cell=>cell.inMonth).length,30);
 assert.equal(new Set(cells.map(cell=>cell.date)).size,42);
 assert.equal(monthCells('2024-04')[0].date,'2024-04-01');
});

test('calendar handles leap days, century rules, and year rollover',()=>{
 const leap=monthCells('2024-02');
 assert.equal(leap.filter(cell=>cell.inMonth).length,29);
 assert.deepEqual(leap.find(cell=>cell.date==='2024-02-29'),{date:'2024-02-29',inMonth:true});
 assert.equal(monthCells('1900-02').filter(cell=>cell.inMonth).length,28);
 assert.equal(monthCells('2000-02').filter(cell=>cell.inMonth).length,29);
 assert.equal(monthCells('2027-01')[0].date,'2026-12-28');
 assert.equal(monthCells('0099-02').filter(cell=>cell.inMonth).length,28);
});

test('calendar dates stay identical across time zones and daylight-saving transitions',()=>{
 const moduleURL=new URL('../public/calendar.js',import.meta.url).href;
 const script=`import {monthCells} from ${JSON.stringify(moduleURL)};process.stdout.write(JSON.stringify(['2026-03','2026-11'].map(monthCells)));`;
 const results=['UTC','America/Los_Angeles','Asia/Shanghai','Pacific/Kiritimati'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ},encoding:'utf8'}));
 for(const result of results)assert.equal(result,results[0]);
});

test('month navigation supports negative and multi-year shifts',()=>{
 assert.equal(shiftMonth('2026-12',1),'2027-01');
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
 assert.equal(shiftMonth('2026-11',14),'2028-01');
 assert.equal(shiftMonth('2026-11',-23),'2024-12');
 assert.equal(shiftMonth('0099-12',1),'0100-01');
 assert.equal(shiftMonth('2026-11',0),'2026-11');
 for(const month of ['2026-00','2026-13','2026-1','invalid',null]){
  assert.throws(()=>monthCells(month),RangeError);assert.throws(()=>shiftMonth(month,1),RangeError);
 }
 for(const delta of [0.5,NaN,'1'])assert.throws(()=>shiftMonth('2026-11',delta),RangeError);
});

test('duration formatting distinguishes missing timing and can display totals over a day',()=>{
 for(const [seconds,formatted] of [[0,'00:00:00'],[1,'00:00:01'],[3599,'00:59:59'],[3600,'01:00:00'],[86400,'24:00:00'],[90061,'25:01:01']])assert.equal(formatDuration(seconds),formatted);
 for(const value of [null,undefined,-1,NaN,Infinity,1.5,'3600'])assert.equal(formatDuration(value),'未记时');
});

test('summary counts distinct training days, known duration, completed exercises and formal sets',()=>{
 const chest=EXERCISES.find(exercise=>exercise.group==='chest').id;
 const shoulder=EXERCISES.find(exercise=>exercise.group==='shoulder').id;
 const back=EXERCISES.find(exercise=>exercise.group==='back').id;
 const done={done:true,warmup:false},warmup={done:true,warmup:true},planned={done:false,warmup:false};
 const sessions=[
  {date:'2026-11-03',durationSeconds:1800,exercises:[{exerciseId:shoulder,sets:[warmup]},{exerciseId:chest,sets:[done,warmup,planned]},{exerciseId:back,sets:[planned]}]},
  {date:'2026-11-03',durationSeconds:90,exercises:[{exerciseId:chest,sets:[done]}]},
  {date:'2026-11-04',exercises:[{exerciseId:back,sets:[planned]}]}
 ];
 const before=JSON.stringify(sessions);
 assert.deepEqual(summarizeSessions(sessions),{sessions:3,days:2,seconds:1890,unknownDurations:1,sets:2,exerciseCount:2,groups:['胸部','肩部']});
 assert.equal(JSON.stringify(sessions),before);
 assert.deepEqual(summarizeSessions([]),{sessions:0,days:0,seconds:0,unknownDurations:0,sets:0,exerciseCount:0,groups:[]});
});

test('unknown timing is never inferred from sets, rest, or start time',()=>{
 const sessions=[null,0,NaN,-1,86401,'120'].map(durationSeconds=>({date:'2026-11-03',startTime:'12:00',durationSeconds,exercises:[{exerciseId:EXERCISES[0].id,sets:[{done:true,warmup:false,rest:90}]}]}));
 const summary=summarizeSessions(sessions);
 assert.equal(summary.seconds,0);assert.equal(summary.unknownDurations,sessions.length);
});
