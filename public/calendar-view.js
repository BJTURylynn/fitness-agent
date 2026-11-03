import { EXERCISES } from './data.js';
import { monthCells, formatDuration, summarizeSessions } from './calendar.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => new Intl.NumberFormat('zh-CN', {maximumFractionDigits:1}).format(value);
const dateLabel = date => `${Number(date.slice(5,7))} 月 ${Number(date.slice(8))} 日`;
const action = (name, label, id, cls='white small') => `<button type="button" class="button ${cls}" data-action="${name}" data-id="${esc(id)}">${label}</button>`;
const byStartTime = (a,b) => (a.startTime||'99:99').localeCompare(b.startTime||'99:99');

function calendarRecord(session) {
  const groups=summarizeSessions([session]).groups;
  const muscles=groups.map(group=>group.replace('部','')).join('·')||session.title||'训练';
  const label=`打开 ${session.date} ${session.title||'我的训练'}${session.startTime?'，'+session.startTime+' 开始':''}，${formatDuration(session.durationSeconds)}${groups.length?'，'+groups.join('、'):''}`;
  return `<button type="button" class="calendar-record" data-action="edit-session" data-id="${esc(session.id)}" aria-label="${esc(label)}" title="${esc(label)}"><span class="calendar-duration ${session.durationSeconds?'':'is-unknown'}">${formatDuration(session.durationSeconds)}</span><span class="calendar-muscles">${esc(muscles)}</span></button>`;
}

function sessionDetail(session) {
  const summary = summarizeSessions([session]);
  const entries = session.exercises.filter(entry => entry.sets.some(set => set.done));
  return `<article class="calendar-day-session"><div class="calendar-session-heading"><h3>${esc(session.title || '我的训练')}</h3><p>${session.startTime ? esc(session.startTime)+' 开始' : '开始时间未填写'} · ${formatDuration(session.durationSeconds)}</p></div><div class="calendar-session-tags">${summary.groups.map(group=>`<span class="tag">${esc(group)}</span>`).join('')}<span class="tag outline">${summary.sets} 个正式组</span></div><ul class="calendar-exercise-list">${entries.map(entry=>{
    const exercise=EXERCISES.find(item=>item.id===entry.exerciseId), done=entry.sets.filter(set=>set.done);
    return `<li><details><summary><strong>${esc(exercise?.name || '训练动作')}</strong><span>${done.length} 组完成 · 展开明细</span></summary><div class="calendar-set-lines">${done.map((set,index)=>`<p>第 ${index+1} 组${set.warmup?' · 热身':''}：${number(set.weight)} kg × ${set.reps} 次 <span>休息 ${set.rest} 秒${set.rpe!=null?' · RPE '+set.rpe:''}</span></p>`).join('')}</div></details></li>`;
  }).join('')}</ul>${session.notes?`<p class="calendar-session-note">${esc(session.notes)}</p>`:''}<div class="calendar-session-actions">${action('edit-session','查看 / 编辑',session.id)}${action('review-session','AI 复盘',session.id,'ghost small')}</div></article>`;
}

export function renderCalendar({month, selected, today, sessions, draft, icon}) {
  const byDate=new Map();
  for(const session of sessions){if(!byDate.has(session.date))byDate.set(session.date,[]);byDate.get(session.date).push(session);}
  const monthly=summarizeSessions(sessions.filter(session=>session.date.startsWith(month+'-')));
  const daily=[...(byDate.get(selected)||[])].sort(byStartTime);
  const selectedDraft=draft?.date===selected;
  return `<div class="calendar-overview"><div class="calendar-metric"><b>${monthly.days}<small> 天</small></b><span>本月训练 · ${monthly.sessions} 次</span></div><div class="calendar-metric"><b>${monthly.seconds?formatDuration(monthly.seconds):'—'}</b><span>已记录时长${monthly.unknownDurations?' · '+monthly.unknownDurations+' 次未记时':''}</span></div><div class="calendar-metric"><b>${monthly.sets}<small> 组</small></b><span>本月完成正式组</span></div></div><div class="calendar-layout"><section class="card calendar-board" aria-label="训练月历"><div class="calendar-top"><div class="calendar-month-title"><h2>${Number(month.slice(5))}<small> 月</small></h2><p>${month.slice(0,4)} 年</p></div><div class="calendar-controls"><button type="button" class="icon-btn" data-action="calendar-month" data-id="-1" aria-label="上个月">${icon('chevron',18).replace('<svg ','<svg style="transform:rotate(180deg)" ')}</button><button type="button" class="button white small" data-action="calendar-today">今天</button><button type="button" class="icon-btn" data-action="calendar-month" data-id="1" aria-label="下个月">${icon('chevron',18)}</button><label class="visually-hidden" for="calendar-jump">跳转月份</label><input id="calendar-jump" type="month" min="1000-01" max="9998-12" value="${month}" aria-label="跳转月份"></div></div><div class="calendar-weekdays" aria-hidden="true">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid" role="group" aria-label="${month.slice(0,4)}年${Number(month.slice(5))}月日期">${monthCells(month).map(cell=>{
    const records=[...(byDate.get(cell.date)||[])].sort(byStartTime), summary=summarizeSessions(records), isDraft=draft?.date===cell.date;
    const durationText=summary.seconds?formatDuration(summary.seconds):'未记时';
    const label=`${cell.date}${cell.date===today?'，今天':''}，${records.length?records.length+'次训练，'+durationText+'，'+summary.groups.join('、'):'无训练记录'}${isDraft?'，有草稿':''}`;
    return `<div class="calendar-day ${cell.inMonth?'':'is-outside'} ${cell.date===today?'is-today':''} ${cell.date===selected?'is-selected':''}"><button type="button" class="calendar-day-select" data-action="calendar-select" data-id="${cell.date}" aria-label="${esc(label)}" aria-pressed="${cell.date===selected}" ${cell.date===today?'aria-current="date"':''}><span class="calendar-date">${Number(cell.date.slice(8))}${isDraft?'<i title="训练草稿" aria-hidden="true"></i>':''}</span></button><div class="calendar-events">${records.map(calendarRecord).join('')}${records.length>1?`<span class="calendar-count">${records.length} 次训练</span>`:!records.length&&isDraft?'<span class="calendar-count">草稿</span>':''}</div></div>`;
  }).join('')}</div><div class="calendar-legend"><span><i class="legend-dot"></i> 今天</span><span><i class="legend-duration"></i> 训练时长</span><span>蓝色标签 · 训练部位</span></div></section><section class="card calendar-day-panel" aria-label="所选日期训练详情"><div class="calendar-day-heading"><div><h2>${dateLabel(selected)}</h2><p>${selected.slice(0,4)} 年 · ${daily.length} 次训练${selected===today?' · 今天':''}</p></div>${icon('calendar',20)}</div>${daily.length?daily.map(sessionDetail).join(''):`<div class="calendar-day-empty">${icon('dumbbell',30)}<h3>${selected>today?'为下一次努力留个位置':'这一天，还没有训练记录'}</h3><p>${selected>today?'可以浏览未来日期；完成训练后再来记录。':'记录动作、组数和时长，让每一次努力都有迹可循。'}</p></div>`}${selectedDraft?`<div class="notice">${icon('info',15)}<span>这一天有一份训练草稿，保存后会计入月历。</span></div>${action('calendar-resume','继续当天草稿',selected,'calendar-return')}`:''}${selected<=today?action('calendar-add',daily.length?'再记一次训练':'记录当天训练',selected,'calendar-return') : ''}<p class="chart-note">训练与日历共用本地记录。时长按实际填写汇总，未记时的训练不会计入累计时长。</p></section></div>`;
}
