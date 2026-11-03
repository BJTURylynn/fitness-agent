// 子分类表示常见训练侧重。复合动作会同时刺激多个部位；“中胸”并非独立肌肉。
export const GROUPS = [
  {id:'chest',name:'胸部',subs:['上胸','中胸','下胸']},
  {id:'shoulder',name:'肩部',subs:['前束','中束','后束']},
  {id:'back',name:'背部',subs:['背阔肌','中上背','竖脊肌']},
  {id:'legs',name:'腿部',subs:['股四头肌','腘绳肌','臀部','小腿']},
  {id:'arms',name:'手臂',subs:['二头','三头','小臂']},
  {id:'abs',name:'腹部',subs:['腹直肌','腹斜肌','核心稳定']}
];
const ace = (path,title) => ({title:'ACE · '+title,url:'https://www.acefitness.org/resources/everyone/exercise-library/'+path+'/',scope:'动作独立教学页；中文要点为简述'});
const ref = (part) => ({title:'ACE 动作库（类别参考）',url:'https://www.acefitness.org/resources/everyone/exercise-library/',scope:'仅作分类参考（'+part+'）；该变式未逐项核验，中文练习提示为原创教育说明'});
const row = (id,name,en,group,sub,equipment,difficulty,kind,secondary,steps,cues,mistakes,source) => ({id,name,en,group,sub,equipment,difficulty,kind,secondary,steps,cues,mistakes,source});
export const EXERCISES = [
  row('barbell-bench','杠铃卧推','Barbell Bench Press','chest','中胸','杠铃','进阶','compound',['肩前束','肱三头肌'],['仰卧平凳，双脚踩稳，握距略宽于肩。','控制杠铃下放至胸前，再平稳推起。'],['臀部保持接触凳面；先用轻重量熟悉轨迹。','使用安全杆或合格保护者，握紧杠铃。'],['弹胸借力','无人保护时尝试极限重量'],ace('5/chest-press','杠铃卧推')),
  row('dumbbell-bench','哑铃卧推','Dumbbell Chest Press','chest','中胸','哑铃','入门','compound',['肩前束','肱三头肌'],['仰卧平凳，肩背与双脚保持支撑。','两侧哑铃受控下降，呼气推回上方。'],['手腕与前臂对齐。','结束时有控制地收回哑铃。'],['手腕后折','两侧明显不同步'],ace('19/chest-press','哑铃卧推')),
  row('incline-press','上斜哑铃卧推','Incline Dumbbell Press','chest','上胸','哑铃','入门','compound',['肩前束','肱三头肌'],['调整上斜凳并坐稳，双脚支撑。','哑铃向胸部两侧下降，再向上推起。'],['采用舒适的凳面角度。','上胸为训练侧重，前束也会参与。'],['大幅塌腰','过度追求下放深度'],ace('25/incline-chest-press','上斜哑铃推举')),
  row('incline-cable','坐姿上斜绳索推胸','Seated Incline Cable Press','chest','上胸','绳索','入门','compound',['肩前束','肱三头肌'],['坐稳并让绳索位于身体两侧。','沿上斜方向推出，控制收回。'],['躯干保持稳定。','先用轻负荷调整凳子与滑轮位置。'],['耸肩向上挤压','失控回程'],ace('167/seated-incline-cable-press','坐姿上斜绳索推胸')),
  row('decline-cable','坐姿下斜绳索推胸','Seated Decline Cable Press','chest','下胸','绳索','入门','compound',['肱三头肌'],['坐稳、双脚支撑，握住两侧把手。','沿斜向下方向推离胸前，再缓慢还原。'],['下胸指胸大肌下部训练侧重。','保持胸廓和骨盆位置稳定。'],['借躯干前后摇摆','过度拉到身后'],ace('166/seated-decline-cable-press','坐姿下斜绳索推胸')),
  row('chest-fly','平板哑铃飞鸟','Dumbbell Chest Fly','chest','中胸','哑铃','进阶','isolation',['肩前束'],['仰卧，双臂在胸前，肘部保留轻微弯曲。','向两侧展开到舒适幅度，再沿弧线合拢。'],['使用比卧推更轻的重量。','肘角在动作中相对稳定。'],['肘部完全伸直','肩部疼痛仍继续下放'],ace('21/lying-chest-fly','哑铃飞鸟')),
  row('front-raise','哑铃前平举','Dumbbell Front Raise','shoulder','前束','哑铃','入门','isolation',['胸大肌'],['站稳，哑铃位于大腿前侧。','抬至接近肩高，再缓慢放下。'],['腹部收紧，保持自然站姿。'],['甩腰借力','耸肩抬举'],ace('54/front-raise','前平举')),
  row('shoulder-press','器械肩推','Machine Shoulder Press','shoulder','前束','器械','入门','compound',['肩中束','肱三头肌'],['调座椅，让把手在舒适肩部高度。','向上推起，控制返回。'],['背部贴靠，保持腰部舒适。'],['过分挺腰','器械行程与肩部不适配'],ace('187/seated-machine-close-grip-shoulder-press','器械窄握肩推')),
  row('lateral-raise','哑铃侧平举','Dumbbell Lateral Raise','shoulder','中束','哑铃','入门','isolation',['斜方肌'],['站稳，双肘微屈，哑铃位于两侧。','向侧上方抬起至接近肩高，再受控下降。'],['选可控轻负荷，躯干稳定。','手腕保持自然，不刻意倒水式内旋。'],['全身摆动','负重过大且幅度失控'],ace('26/lateral-raise','侧平举')),
  row('cable-lateral','单臂绳索侧平举','Cable Lateral Raise','shoulder','中束','绳索','进阶','isolation',['斜方肌'],['站在低位滑轮侧方，握住把手。','肘部微屈向侧面抬起，缓慢还原。'],['保持绳索顺畅通过，不牵拉身体。'],['身体向一侧倒','用肩部疼痛换幅度'],ref('shoulders')),
  row('rear-fly','俯身哑铃反向飞鸟','Rear Delt Fly','shoulder','后束','哑铃','进阶','isolation',['菱形肌','中斜方肌'],['髋部后移俯身，保持躯干稳定。','双臂向两侧展开，再缓慢合回。'],['初学可用上斜凳支撑胸部。','把动作保持在无痛范围。'],['边抬边起身','头部过度后仰'],ref('shoulders')),
  row('lat-pulldown','高位下拉','Lat Pulldown','back','背阔肌','器械','入门','compound',['肱二头肌'],['固定大腿，握紧把手，躯干稍后倾。','肘部向下，拉至上胸前方，再控制回程。'],['胸前下拉，保持躯干角度基本稳定。'],['颈后下拉','大幅后仰甩动'],ace('158/seated-lat-pulldown','坐姿高位下拉')),
  row('chin-up','反手引体向上','Chin-up','back','背阔肌','自重','进阶','compound',['肱二头肌','前臂'],['反手握杠，先建立肩部与躯干控制。','将身体拉起，再缓慢回到起始位置。'],['可使用辅助器械降低难度。'],['摆腿甩动','疲劳后失控下落'],ace('190/chin-ups','反手引体向上')),
  row('barbell-row','俯身杠铃划船','Bent-over Barbell Row','back','中上背','杠铃','进阶','compound',['背阔肌','肱二头肌','肩后束'],['屈髋俯身，杠铃在身体前下方。','将杠铃拉向躯干，受控放回。'],['躯干角度稳定，先学会髋铰链。'],['圆背硬拉','借力起身代替划船'],ace('12/bent-over-row','俯身杠铃划船')),
  row('seated-row','坐姿绳索划船','Seated Cable Row','back','中上背','绳索','入门','compound',['背阔肌','肱二头肌','肩后束'],['坐稳、双脚支撑，脊柱自然。','把手向躯干拉近，再缓慢前伸。'],['肩胛自然运动，不突然耸肩。'],['腰部反复弯曲','拉得过远挤压肩前侧'],ace('46/seated-high-back-row','坐姿高位背部划船')),
  row('dumbbell-row','单臂哑铃划船','One-arm Dumbbell Row','back','背阔肌','哑铃','入门','compound',['菱形肌','肱二头肌'],['一手支撑凳面，双脚站稳。','持铃侧肘部向髋部拉近，缓慢放回。'],['骨盆基本朝下，不大幅转体。'],['猛拉哑铃','单侧腰部扭转'],ref('back')),
  row('bird-dog','鸟狗式','Bird Dog','back','竖脊肌','自重','入门','core',['腹部','臀部'],['四点跪姿，手在肩下、膝在髋下。','缓慢伸展对侧手脚，稳定后收回并换侧。'],['保持呼吸与骨盆稳定。'],['塌腰','抬腿过高'],ace('14/bird-dog','鸟狗式')),
  row('squat','自重深蹲','Bodyweight Squat','legs','股四头肌','自重','入门','compound',['臀部','核心'],['双脚站稳，脚尖略向外。','屈髋屈膝下蹲至可控深度，再站起。'],['膝盖方向随脚尖，双脚均匀受力。'],['膝盖明显内扣','为求深度而失去平衡'],ace('135/bodyweight-squat','自重深蹲')),
  row('back-squat','杠铃深蹲','Barbell Back Squat','legs','股四头肌','杠铃','进阶','compound',['臀部','竖脊肌'],['在深蹲架安全杆内架好杠铃并站稳。','收紧躯干，下蹲后平稳站起。'],['先掌握自重版本，再逐渐加重。','使用安全杆。'],['膝部内扣','姿势变形后仍加重量'],ref('legs-thighs')),
  row('leg-press','坐姿腿举','Seated Leg Press','legs','股四头肌','器械','入门','compound',['臀部'],['调整靠背与座位，双脚踩稳踏板。','平稳蹬出，缓慢屈膝回程。'],['腰臀保持贴靠，选择能控制的幅度。'],['回程时骨盆卷离靠垫','突然弹震蹬出'],ace('154/seated-leg-press','坐姿腿举')),
  row('leg-extension','坐姿腿屈伸','Seated Leg Extension','legs','股四头肌','器械','入门','isolation',[],['调整器械，让膝关节对齐旋转轴。','伸膝抬起滚垫，再缓慢放回。'],['滚垫位置和幅度应舒适。'],['猛烈踢起','膝部不适仍完成行程'],ace('183/seated-leg-extension','坐姿腿屈伸')),
  row('rdl','罗马尼亚硬拉','Romanian Deadlift','legs','腘绳肌','杠铃','进阶','compound',['臀部','竖脊肌','前臂'],['站直持杠，膝部微屈。','髋部向后移，杠贴近腿下降，再伸髋站起。'],['下放深度由髋部活动度与背部控制决定。'],['弓背追求触地','把动作做成深蹲'],{title:'ACE · 罗马尼亚硬拉教学',url:'https://www.acefitness.org/continuing-education/certified/may-2025/8865/the-ace-do-it-better-series-the-romanian-deadlift/',scope:'独立教学文章；中文为简述'}),
  row('leg-curl','坐姿腿弯举','Seated Leg Curl','legs','腘绳肌','器械','入门','isolation',[],['调节座椅及滚垫，膝关节对齐旋转轴。','屈膝把滚垫拉向下后方，再慢慢还原。'],['大腿固定，骨盆不前后移动。'],['猛甩回程','用腰部借力'],ref('legs-thighs')),
  row('glute-bridge','臀桥','Glute Bridge','legs','臀部','自重','入门','compound',['腘绳肌','核心'],['仰卧屈膝，双脚踩地。','收紧臀部抬髋至躯干与大腿近一直线，再放下。'],['上抬结束时保持肋骨与骨盆稳定。'],['过度挺腰','用颈部顶地'],ref('butt-hips')),
  row('calf-raise','站姿提踵','Standing Calf Raise','legs','小腿','自重','入门','isolation',[],['站稳并扶住固定支撑物。','脚跟上抬，短暂停留后缓慢下降。'],['先在平地控制完整动作。'],['反复弹跳','脚踝向外翻'],ref('legs-calves-and-shins')),
  row('barbell-curl','杠铃弯举','Barbell Biceps Curl','arms','二头','杠铃','入门','isolation',['肱肌','前臂'],['站稳反手握杠，上臂靠近身体。','屈肘抬起杠铃，再缓慢放下。'],['保持躯干安静，手腕自然。'],['用腰部甩动','肘部大幅前移'],ref('arms')),
  row('dumbbell-curl','哑铃弯举','Dumbbell Biceps Curl','arms','二头','哑铃','入门','isolation',['肱肌'],['站稳，两手持铃。','上臂位置稳定地屈肘，再控制伸肘。'],['左右侧使用都能控制的负荷。'],['快速自由落体','耸肩借力'],ref('arms')),
  row('hammer-curl','锤式弯举','Hammer Curl','arms','二头','哑铃','入门','isolation',['肱肌','肱桡肌'],['手心相对握哑铃，站稳。','保持握法屈肘抬起，再慢慢下降。'],['同时训练肱肌与肱桡肌，非二头专属。'],['躯干摇摆','手腕弯折'],ref('arms')),
  row('close-bench','窄握杠铃卧推','Close-grip Bench Press','arms','三头','杠铃','进阶','compound',['胸部','肩前束'],['仰卧并采用舒适的较窄握距。','控制下放，肘部靠近躯干方向，再推起。'],['握距不要窄到手腕不适。','安排安全杆或保护者。'],['双手挤得过近','肘部突然外张'],ace('311/close-grip-bench-press','窄握卧推')),
  row('triceps-pushdown','绳索下压','Cable Triceps Pushdown','arms','三头','绳索','入门','isolation',[],['面对高位滑轮，双肘在体侧。','伸肘向下推，再缓慢屈肘还原。'],['用肘关节运动，躯干保持稳定。'],['用整个身体压重量','肩部前后甩动'],ref('arms')),
  row('wrist-curl','哑铃腕弯举（掌心向上）','Wrist Curl — Flexion','arms','小臂','哑铃','入门','isolation',[],['前臂支撑在凳面，手心向上握紧哑铃。','仅通过手腕缓慢屈伸，保持前臂不动。'],['轻负荷、小幅度开始；全程握紧。'],['哑铃滚到指尖','手腕剧烈折动'],ace('30/wrist-curl-flexion','腕屈曲')),
  row('reverse-wrist','哑铃反向腕弯举','Wrist Curl — Extension','arms','小臂','哑铃','入门','isolation',[],['前臂获得支撑，手心向下持铃。','缓慢抬起手背，再有控制地放下。'],['负荷通常应比正向腕弯举轻。'],['甩动哑铃','手腕疼痛仍重复'],ace('29/wrist-curl-extension','腕伸展')),
  row('crunch','卷腹','Crunch','abs','腹直肌','自重','入门','core',[],['仰卧屈膝，双手轻放胸前或头侧。','缓慢抬起上背，再有控制地回到地面。'],['头颈随上身移动，目光保持自然。'],['用手拽头','用惯性猛坐起来'],ace('52/crunch','卷腹')),
  row('reverse-crunch','反向卷腹','Reverse Crunch','abs','腹直肌','自重','入门','core',['髋屈肌'],['仰卧屈膝抬腿，双手放身体两侧。','轻微卷起骨盆，再慢慢放回。'],['用骨盆卷动，避免摆腿。','所谓下腹侧重不代表能局部减脂。'],['蹬腿借力','下背大幅悬空'],ref('abs')),
  row('side-plank','侧平板支撑','Side Plank','abs','腹斜肌','自重','进阶','core',['臀中肌','肩部'],['侧卧，前臂位于肩下。','抬髋保持躯干近一直线，稳定呼吸后换侧。'],['可以屈膝支撑降低难度。'],['肩膀塌陷','髋部下沉'],ref('abs')),
  row('plank','平板支撑','Forearm Plank','abs','核心稳定','自重','入门','core',['竖脊肌','臀部'],['前臂和脚尖支撑，肘在肩下。','保持头、躯干、骨盆协调，稳定呼吸。'],['持续时长服从姿势质量。'],['塌腰','屏住呼吸追求时间'],ace('32/front-plank','平板支撑')),
  row('dead-bug','死虫式','Dead Bug','abs','核心稳定','自重','入门','core',['髋屈肌'],['仰卧，髋膝屈曲，双手朝上。','对侧手脚缓慢向远处伸展，收回后换侧。'],['只伸到能保持腰背稳定的位置。'],['肋骨抬起并大幅拱腰','快速甩动手脚'],ref('abs'))
];
