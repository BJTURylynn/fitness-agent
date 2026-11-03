/** Curved, paired anatomical illustrations. Paths share no SVG IDs, so cards can coexist. */
const escapeXML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const GROUP_NAMES = {chest:'胸部', shoulder:'肩部', back:'背部', legs:'腿部', arms:'手臂', abs:'腹部'};
const SUB_REGIONS = {
  chest:{'上胸':['chest-upper'], '中胸':['chest-middle'], '下胸':['chest-lower']},
  shoulder:{'前束':['shoulder-front'], '中束':['shoulder-middle'], '后束':['shoulder-rear']},
  back:{'背阔肌':['back-lats'], '中上背':['back-upper'], '竖脊肌':['back-erectors']},
  legs:{'股四头肌':['legs-quads'], '腘绳肌':['legs-hamstrings'], '臀部':['legs-glutes'], '小腿':['legs-calves']},
  arms:{'二头':['arms-biceps'], '三头':['arms-triceps'], '小臂':['arms-forearms']},
  abs:{'腹直肌':['abs-rectus'], '腹斜肌':['abs-obliques'], '核心稳定':['abs-rectus','abs-obliques','abs-core','back-erectors']}
};

// One smooth outside contour includes the torso, relaxed arms, fingers, legs, and feet.
const BODY_LEFT = 'M108 65 C109 76 106 83 96 87 L74 93 C58 93 47 104 44 120 C42 137 38 153 36 170 L34 184 C30 201 27 228 22 247 L22 257 C19 263 16 269 17 278 L18 286 Q20 291 23 284 L26 274 L25 286 Q27 291 30 284 L34 274 Q37 269 36 256 C41 240 46 219 49 199 L51 187 Q61 168 66 145 C68 164 76 185 78 204 Q80 223 76 239 C72 253 69 269 70 289 L73 337 Q73 351 76 363 C73 374 72 387 74 403 L79 445 Q81 464 80 478 L74 490 Q70 497 72 503 Q84 508 96 504 Q102 502 101 493 L98 479 Q98 460 102 443 C106 424 110 400 109 384 L107 366 Q113 346 115 326 L118 296 L120 283';
const BODY_RIGHT = 'L122 296 L125 326 Q127 346 133 366 L131 384 C130 400 134 424 138 443 Q142 460 142 479 L139 493 Q138 502 144 504 Q156 508 168 503 Q170 497 166 490 L160 478 Q159 464 161 445 L166 403 C168 387 167 374 164 363 Q167 351 167 337 L170 289 C171 269 168 253 164 239 Q160 223 162 204 C164 185 172 164 174 145 Q179 168 189 187 L191 199 C194 219 199 240 204 256 Q203 269 206 274 L210 284 Q213 291 215 286 L214 274 L217 284 Q220 291 222 286 L223 278 C224 269 221 263 218 257 L218 247 C213 228 210 201 206 184 L204 170 C202 153 198 137 196 120 C193 104 182 93 166 93 L144 87 C134 83 131 76 132 65 Z';
const BODY_OUTLINE = BODY_LEFT + BODY_RIGHT;

export function anatomySVG(group = '', sub = '', options = {}) {
  const labels = options.labels === true;
  const knownGroup = Object.hasOwn(GROUP_NAMES, group) ? group : '';
  const chosen = SUB_REGIONS[knownGroup]?.[sub];
  const active = region => {
    if (!knownGroup) return options.overview === true && /^(chest|back)-/.test(region);
    if (chosen) return chosen.includes(region);
    return region.startsWith(knownGroup + '-');
  };
  const fill = (region, dark = false) => active(region) ? (dark ? '#1D4ED8' : '#2563EB') : (dark ? '#CBD3DD' : '#D8DEE6');
  const patch = (region, d, dark = false) => `<path class="${active(region) ? 'muscle-active' : 'muscle-base'}" data-muscle="${region}" d="${d}" fill="${fill(region, dark)}"/>`;
  const pair = (region, d, dark = false) => patch(region, d, dark) + `<g transform="translate(240 0) scale(-1 1)">${patch(region, d, dark)}</g>`;
  const fixedPair = (d, color = '#E3E8EE') => `<path d="${d}" fill="${color}"/><path d="${d}" transform="translate(240 0) scale(-1 1)" fill="${color}"/>`;
  const head = rear => `<g fill="#E3E8EE" stroke="#B7C0CC" stroke-width="0.75">
    <path d="M102 36 C101 23 106 15 120 15 C134 15 139 23 138 36 L136 51 C134 60 127 68 120 69 C113 68 106 60 104 51Z"/>
    <path d="M103 38 C98 35 98 48 104 49 M137 38 C142 35 142 48 136 49"/>
    ${rear ? '<path d="M107 56 Q120 61 133 56" fill="none" stroke="#CAD2DC"/>' : '<path d="M112 53 Q120 56 128 53 M120 39 L118 47 L122 48" fill="none" stroke="#C2CBD6" stroke-linecap="round"/>'}
  </g>`;
  const skeleton = rear => `<path d="${BODY_OUTLINE}" fill="#EEF1F5" stroke="#AEB8C5" stroke-width="0.85"/>${head(rear)}`;
  const smallDetails = rear => `<g fill="none" stroke="#BBC5D0" stroke-width="0.7" stroke-linecap="round">
    <path d="M20 268 Q23 267 25 270 M27 264 L29 274 M32 262 L33 271 M83 492 L96 493 M78 498 L96 499"/>
    <path d="M20 268 Q23 267 25 270 M27 264 L29 274 M32 262 L33 271 M83 492 L96 493 M78 498 L96 499" transform="translate(240 0) scale(-1 1)"/>
    ${rear ? '<path d="M120 86 L120 249 M87 360 Q94 365 102 361 M138 361 Q146 365 153 360"/>' : '<path d="M120 96 L120 246 M113 246 Q120 251 127 246 M86 361 Q93 355 101 361 M139 361 Q147 355 154 361"/>'}
  </g>`;

  const front = () => `${skeleton(false)}<g class="muscle-regions" stroke="#FFFFFF" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round">
    ${fixedPair('M108 70 Q109 84 100 89 L116 98 L118 80 Z', '#DAE1E9')}
    ${pair('shoulder-middle', 'M64 98 C52 101 47 111 46 124 Q46 136 52 144 L59 133 Q60 117 67 104Z')}
    ${pair('shoulder-front', 'M68 101 Q74 99 78 102 C77 116 70 132 60 141 L58 132 Q60 114 68 101Z')}
    ${pair('chest-upper', 'M79 99 Q96 92 117 98 L118 113 Q99 114 71 120 Q71 108 79 99Z')}
    ${pair('chest-middle', 'M71 121 Q93 116 118 115 L118 140 C107 150 87 150 75 140 Q72 133 71 121Z')}
    ${pair('chest-lower', 'M76 142 C87 151 105 152 118 143 L117 152 Q100 165 82 153Z', true)}
    ${pair('arms-triceps', 'M46 136 L53 143 C49 157 45 172 41 182 L37 178 C37 161 41 146 46 136Z', true)}
    ${pair('arms-biceps', 'M55 141 L64 145 C64 155 58 171 50 182 L43 187 L40 181 C44 162 48 149 55 141Z')}
    ${pair('arms-biceps', 'M61 154 L64 151 Q62 170 53 185 L48 190 L46 186 Q56 170 61 154Z', true)}
    ${pair('arms-forearms', 'M37 189 Q40 185 44 189 L44 204 Q36 228 28 252 L23 252 C27 231 29 207 37 189Z')}
    ${pair('arms-forearms', 'M45 190 L49 196 Q46 221 35 249 L30 253 C34 233 40 211 45 190Z', true)}
    ${pair('abs-obliques', 'M79 157 L99 164 L96 176 L82 169Z')}
    ${pair('abs-obliques', 'M82 173 L97 181 L96 193 L84 184Z', true)}
    ${pair('abs-obliques', 'M83 187 L97 197 L98 212 L84 202Z')}
    ${pair('abs-obliques', 'M82 205 L99 217 L105 239 L95 247 L78 233 Q82 219 82 205Z', true)}
    ${pair('abs-rectus', 'M106 158 Q112 158 118 157 L118 176 L102 176 Q101 166 106 158Z')}
    ${pair('abs-rectus', 'M102 179 L118 179 L118 197 L101 197 Q100 187 102 179Z')}
    ${pair('abs-rectus', 'M102 200 L118 200 L118 218 L104 218 Q101 209 102 200Z')}
    ${pair('abs-rectus', 'M105 221 L118 221 L118 241 L110 245 Q107 235 105 221Z')}
    ${pair('abs-core', 'M80 237 L94 248 L117 251 L117 275 Q105 266 93 261 L76 251Z')}
    ${fixedPair('M76 256 Q96 262 113 279 L105 285 L83 271 L74 272Z', '#DDE4EC')}
    ${pair('legs-quads', 'M77 274 Q80 270 85 272 C80 296 79 320 86 341 L81 354 Q73 337 73 311 Q71 291 77 274Z')}
    ${pair('legs-quads', 'M88 270 Q99 265 105 278 L104 306 Q101 330 94 348 L86 343 C80 321 82 289 88 270Z')}
    ${pair('legs-quads', 'M108 286 L116 285 Q113 316 107 337 Q104 353 96 357 L92 350 Q103 328 108 286Z', true)}
    ${pair('legs-quads', 'M79 258 Q97 262 115 281 L113 289 Q98 274 80 265Z')}
    ${fixedPair('M85 356 Q94 352 101 359 L101 369 Q92 376 82 367Z', '#E0E6EE')}
    ${pair('legs-calves', 'M78 373 L84 370 Q85 390 82 410 L81 438 Q76 421 74 401 Q71 385 78 373Z', true)}
    ${pair('legs-calves', 'M87 373 Q91 369 95 374 Q96 399 90 429 L85 460 L81 472 Q80 445 82 420 L85 390Z')}
    ${pair('legs-calves', 'M99 373 Q105 369 106 382 Q108 406 97 432 L90 451 L89 439 Q96 413 99 373Z')}
    ${fixedPair('M81 475 L87 462 L96 478 L98 491 L85 491 L77 498 L74 499 Q74 493 81 485Z')}
  </g>${smallDetails(false)}`;

  const back = () => `${skeleton(true)}<g class="muscle-regions" stroke="#FFFFFF" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round">
    ${pair('back-upper', 'M109 76 L118 84 L118 129 Q99 113 79 103 L95 91 Q105 87 109 76Z')}
    ${pair('shoulder-middle', 'M64 98 C52 101 47 111 46 124 Q46 136 52 144 L58 134 Q58 115 67 104Z')}
    ${pair('shoulder-rear', 'M70 101 Q78 103 82 111 Q77 129 62 143 L54 140 C57 122 59 108 70 101Z')}
    ${pair('back-upper', 'M80 108 Q100 115 118 133 L117 160 Q98 157 83 144 L75 127Z')}
    ${pair('back-upper', 'M81 145 Q94 156 115 162 L110 174 Q89 172 78 158Z', true)}
    ${pair('back-lats', 'M75 145 Q83 158 108 176 L108 202 L98 229 Q83 220 80 204 L75 177Z')}
    ${pair('back-lats', 'M78 164 Q88 175 106 183 L104 207 L97 226 Q85 210 83 189Z', true)}
    ${pair('back-erectors', 'M111 163 L118 164 L118 248 L108 251 Q102 237 105 216 Q108 190 111 163Z')}
    ${fixedPair('M81 224 Q91 232 103 237 L107 252 L95 255 L76 247Z', '#DCE3EB')}
    ${pair('abs-core', 'M108 252 L118 249 L118 267 L110 264 L102 258Z')}
    ${pair('arms-triceps', 'M52 140 L63 144 Q64 162 52 181 L45 188 L39 181 C41 164 45 148 52 140Z')}
    ${pair('arms-triceps', 'M51 145 L56 145 Q58 163 48 177 L43 182 Q44 161 51 145Z', true)}
    ${pair('arms-biceps', 'M63 153 L65 156 Q62 175 54 186 L49 190 L48 186 Q59 168 63 153Z')}
    ${pair('arms-forearms', 'M37 189 L44 188 Q44 206 36 227 L27 251 L23 251 Q29 213 37 189Z')}
    ${pair('arms-forearms', 'M45 191 L49 196 Q46 225 35 249 L30 252 Q34 227 45 191Z', true)}
    ${pair('legs-glutes', 'M78 245 Q91 240 107 249 L115 258 Q92 251 74 270 L72 261Z', true)}
    ${pair('legs-glutes', 'M85 255 C98 250 113 255 118 267 L117 286 C109 300 94 306 80 297 Q69 289 71 274 Q73 263 85 255Z')}
    ${pair('legs-hamstrings', 'M76 302 Q83 307 90 309 C86 325 84 341 85 354 L79 363 Q73 346 73 321Z')}
    ${pair('legs-hamstrings', 'M92 310 L103 308 Q101 333 92 357 L87 355 Q86 334 92 310Z', true)}
    ${pair('legs-hamstrings', 'M106 306 L116 295 L112 323 Q109 346 100 359 L94 364 Q95 344 101 326Z')}
    ${fixedPair('M81 358 Q91 364 102 360 L103 369 Q92 374 81 368Z', '#DCE3EC')}
    ${pair('legs-calves', 'M80 374 Q88 368 95 373 Q99 389 93 410 L86 432 Q78 423 76 406 Q71 386 80 374Z')}
    ${pair('legs-calves', 'M99 373 Q106 367 108 381 Q109 402 100 423 L91 442 L87 433 Q95 411 99 373Z', true)}
    ${fixedPair('M85 434 L91 437 Q88 459 87 478 L81 479 Q82 456 85 434Z', '#DDE4EC')}
    ${fixedPair('M81 479 L87 478 L96 491 L97 499 L76 499 Q76 491 81 479Z')}
  </g>${smallDetails(true)}`;

  const frontX = labels ? 160 : 70;
  const backX = labels ? 600 : 310;
  const leader = (text, region, textX, y, endX, endY, side) => {
    const selected = Array.isArray(region) ? region.some(active) : active(region);
    const startX = side === 'left' ? textX + 12 : textX - 12;
    const elbowX = side === 'left' ? startX + 26 : startX - 26;
    const color = selected ? '#2563EB' : '#8A96A7';
    return `<g class="anatomy-label ${selected ? 'is-active' : ''}" fill="${selected ? '#1D4ED8' : '#627083'}">
      <path d="M${startX} ${y - 4} H${elbowX} L${endX} ${endY}" fill="none" stroke="${color}" stroke-width="0.85" opacity="0.8"/>
      <circle cx="${endX}" cy="${endY}" r="2.2" fill="${color}" stroke="#FFFFFF" stroke-width="0.85"/>
      <text x="${textX}" y="${y}" text-anchor="${side === 'left' ? 'end' : 'start'}" font-size="13" font-weight="${selected ? '650' : '450'}">${text}</text>
    </g>`;
  };
  const annotations = labels ? [
    leader('胸大肌', ['chest-upper','chest-middle','chest-lower'], 139, 147, 247, 154, 'left'),
    leader('二头', 'arms-biceps', 139, 202, 210, 192, 'left'),
    leader('小臂', 'arms-forearms', 139, 266, 194, 249, 'left'),
    leader('股四头肌', 'legs-quads', 139, 361, 250, 343, 'left'),
    leader('前束', 'shoulder-front', 421, 115, 334, 147, 'right'),
    leader('腹直肌', 'abs-rectus', 421, 221, 291, 220, 'right'),
    leader('腹斜肌', 'abs-obliques', 421, 271, 313, 243, 'right'),
    leader('中上背', 'back-upper', 578, 134, 703, 164, 'left'),
    leader('背阔肌', 'back-lats', 578, 200, 690, 218, 'left'),
    leader('竖脊肌', 'back-erectors', 578, 262, 710, 254, 'left'),
    leader('后束', 'shoulder-rear', 866, 115, 777, 147, 'right'),
    leader('臀部', 'legs-glutes', 866, 308, 749, 305, 'right'),
    leader('腘绳肌', 'legs-hamstrings', 866, 379, 744, 359, 'right'),
    leader('小腿', 'legs-calves', 866, 448, 748, 428, 'right')
  ].join('') : '';
  const description = knownGroup ? `${GROUP_NAMES[knownGroup]}${sub && chosen ? ' · ' + sub : ''}训练肌群，蓝色为当前选中部位` : '人体前侧与后侧主要肌群示意';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="body-svg anatomy-diagram${labels ? ' anatomy-labeled' : ''}" viewBox="0 0 ${labels ? 1000 : 620} 560" role="img" aria-label="${escapeXML(description)}" preserveAspectRatio="xMidYMid meet">
    <title>${escapeXML(description)}</title>
    <g font-family="Inter, PingFang SC, Microsoft YaHei, sans-serif">
      <g fill="#8691A0" font-size="12" font-weight="500" letter-spacing="2"><text x="${frontX + 120}" y="23" text-anchor="middle">前侧</text><text x="${backX + 120}" y="23" text-anchor="middle">后侧</text></g>
      <g class="anatomy-front" transform="translate(${frontX} 28)">${front()}</g>
      <g class="anatomy-back" transform="translate(${backX} 28)">${back()}</g>
      ${annotations}
    </g>
  </svg>`;
}
