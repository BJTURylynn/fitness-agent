import { EXERCISES, GROUPS } from './data.js';

function parseMonth(month) {
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new RangeError('月份应为 YYYY-MM');
  return [Number(month.slice(0,4)),Number(month.slice(5,7))-1];
}

// UTC arithmetic keeps calendar dates independent of the browser's time zone.
export function monthCells(monthYYYYMM) {
  const [year,month]=parseMonth(monthYYYYMM);
  const cursor=new Date(0);
  cursor.setUTCFullYear(year,month,1);
  cursor.setUTCHours(0,0,0,0);
  cursor.setUTCDate(1-(cursor.getUTCDay()+6)%7);
  return Array.from({length:42},()=>{
    const cell={date:cursor.toISOString().split('T')[0],inMonth:cursor.getUTCFullYear()===year&&cursor.getUTCMonth()===month};
    cursor.setUTCDate(cursor.getUTCDate()+1);
    return cell;
  });
}

export function shiftMonth(monthYYYYMM,delta) {
  const [year,month]=parseMonth(monthYYYYMM);
  if(!Number.isSafeInteger(delta))throw new RangeError('月份偏移应为整数');
  const target=year*12+month+delta;
  if(target<0||target>9999*12+11)throw new RangeError('月份超出支持范围');
  return String(Math.floor(target/12)).padStart(4,'0')+'-'+String(target%12+1).padStart(2,'0');
}

export function formatDuration(seconds) {
  if(!Number.isSafeInteger(seconds)||seconds<0)return '未记时';
  const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),remaining=seconds%60;
  return [hours,minutes,remaining].map(value=>String(value).padStart(2,'0')).join(':');
}

const exerciseById=new Map(EXERCISES.map(exercise=>[exercise.id,exercise]));

export function summarizeSessions(sessions=[]) {
  const days=new Set(),exerciseIds=new Set(),groups=new Set();
  let seconds=0,unknownDurations=0,sets=0;
  for(const session of sessions){
    days.add(session.date);
    if(Number.isInteger(session.durationSeconds)&&session.durationSeconds>=1&&session.durationSeconds<=86400)seconds+=session.durationSeconds;
    else unknownDurations++;
    for(const entry of session.exercises||[]){
      const completed=(entry.sets||[]).filter(set=>set.done===true);
      sets+=completed.filter(set=>!set.warmup).length;
      if(!completed.length)continue;
      exerciseIds.add(entry.exerciseId);
      const exercise=exerciseById.get(entry.exerciseId);
      if(exercise)groups.add(exercise.group);
    }
  }
  return {sessions:sessions.length,days:days.size,seconds,unknownDurations,sets,exerciseCount:exerciseIds.size,groups:GROUPS.filter(group=>groups.has(group.id)).map(group=>group.name)};
}
