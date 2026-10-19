// 試玩版用的小人（向量），腳底在 (0,0)，高約 112
const OUT = '#5b3a3e';
const NS = 'http://www.w3.org/2000/svg';
export const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.append(e); return e; };
const ln = { stroke: OUT, 'stroke-width': 1.3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' };
const thin = { ...ln, 'stroke-width': .8 };

// ================= 小人 =================
// 腳底在 (0,0)，高約 112
export function chibi(g, o) {
  const skin = '#ffe6d5', skinS = '#f9cdb8';
  el('ellipse', { cx: 0, cy: 0, rx: 17, ry: 4.5, fill: 'rgba(120,60,80,.18)' }, g);
  // 腿＋襪子＋鞋
  [-5.5, 5.5].forEach((x) => {
    const lg = el('g', { class: x < 0 ? 'leg-l' : 'leg-r' }, g);
    el('path', { d: `M${x},-24 V-6`, stroke: OUT, 'stroke-width': 6.6, 'stroke-linecap': 'round' }, lg);
    el('path', { d: `M${x},-24 V-6`, stroke: skin, 'stroke-width': 4, 'stroke-linecap': 'round' }, lg);
    el('path', { d: `M${x},-13 V-6`, stroke: o.sock || '#fff', 'stroke-width': 4, 'stroke-linecap': 'butt' }, lg);
    const s = x < 0 ? -1 : 1;
    el('path', { d: `M${x - 3.6 + s * .6},-6.5 q0,-3 3.6,-3 q3.6,0 3.6,3 q${s * 2.5},.5 ${s * 2.5},3.5 q0,3 -3,3 h-5.6 q-2.6,0 -2.6,-3 z`, fill: o.shoe, ...ln }, lg);
    el('path', { d: `M${x - 1.6},-6.2 q1,-1.2 2.6,-1.2`, stroke: 'rgba(255,255,255,.8)', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }, lg);
  });
  // 手（先畫後面）
  const arm = (s) => {
    const ag = el('g', { class: s < 0 ? 'arm-l' : 'arm-r' }, g);
    const d = `M${s * 9},-50 q${s * 7},7 ${s * 7.5},18`;
    el('path', { d, stroke: OUT, 'stroke-width': 6.4, 'stroke-linecap': 'round', fill: 'none' }, ag);
    el('path', { d, stroke: skin, 'stroke-width': 3.8, 'stroke-linecap': 'round', fill: 'none' }, ag);
    el('circle', { cx: s * 16.5, cy: -31, r: 3.4, fill: skin, ...ln }, ag);
  };
  arm(-1); arm(1);
  // 衣服
  o.outfit(g, skin);
  // 脖子
  el('rect', { x: -3, y: -56, width: 6, height: 5, fill: skinS }, g);
  // 後面的頭髮
  if (o.back) o.back(g);
  // 耳朵＋臉
  [-1, 1].forEach((s) => el('ellipse', { cx: s * 30, cy: -76, rx: 4, ry: 5, fill: skin, ...ln }, g));
  el('path', { d: 'M-31,-80 C-31,-104 31,-104 31,-80 C31,-62 18,-54 0,-54 C-18,-54 -31,-62 -31,-80 Z', fill: skin, ...ln }, g);
  el('path', { d: 'M20,-60 C26,-64 29,-70 30,-78 C30,-66 24,-58 14,-56 Z', fill: skinS, opacity: .7 }, g);
  // 眉毛（被瀏海蓋住一點）
  [-11, 11].forEach((x) => el('path', { d: `M${x - 3},-84 q3,-2 6,0`, stroke: o.brow || '#4a3028', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }, g));
  // 前面的頭髮
  o.front(g);
  // 眼睛
  [-11, 11].forEach((x) => {
    el('ellipse', { cx: x, cy: -74, rx: 4, ry: 5.6, fill: '#2b1d21' }, g);
    el('ellipse', { cx: x - 1.2, cy: -76.4, rx: 1.8, ry: 2.1, fill: '#fff' }, g);
    el('circle', { cx: x + 1.5, cy: -71.6, r: .9, fill: '#fff' }, g);
  });
  // 腮紅
  [-1, 1].forEach((s) => {
    el('ellipse', { cx: s * 20, cy: -66, rx: 5.2, ry: 3, fill: '#ff9fb4', opacity: .75 }, g);
    [-2, 0, 2].forEach((d) => el('path', { d: `M${s * 20 + d - .8},-65 l1.4,-2.2`, stroke: '#fff', 'stroke-width': .7, opacity: .9 }, g));
  });
  if (o.freckle) [[-21, -70], [-18, -71], [-19.5, -68.6], [21, -70], [18, -71], [19.5, -68.6]].forEach(([x, y]) => el('circle', { cx: x, cy: y - 2, r: .65, fill: '#c98472' }, g));
  // 鼻子、嘴
  el('path', { d: 'M-1,-68.5 q1,.8 2,0', stroke: '#d9957f', 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round' }, g);
  el('path', { d: 'M-4.2,-63.5 q4.2,5.2 8.4,0 z', fill: '#e8697f', stroke: OUT, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
  el('path', { d: 'M-1.8,-61.4 q1.8,1.4 3.6,0', fill: '#ffb0bf' }, g);
  if (o.acc) o.acc(g);
}
const hairPath = (g, d, c, hl) => {
  el('path', { d, fill: c, ...ln }, g);
  if (hl) el('path', { d: hl, fill: 'none', stroke: 'rgba(255,255,255,.55)', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, g);
};
const strands = (g, d, c) => el('path', { d, fill: 'none', stroke: c, 'stroke-width': 1, 'stroke-linecap': 'round' }, g);
const dress = (main, dark, trim) => (g) => {
  // 泡泡袖
  [-1, 1].forEach((s) => el('ellipse', { cx: s * 10, cy: -49, rx: 5.5, ry: 4.6, fill: main, ...ln }, g));
  el('path', { d: 'M-9,-54 H9 C11,-44 16,-33 20,-23 Q0,-18 -20,-23 C-16,-33 -11,-44 -9,-54 Z', fill: main, ...ln }, g);
  el('path', { d: 'M4,-53 C6,-43 11,-32 14,-21.5 Q18,-22 20,-23 C16,-33 11,-44 9,-54 Z', fill: dark }, g);
  el('path', { d: 'M-19,-25 q3.3,3 6.6,0 q3.3,3 6.6,0 q3.3,3 6.6,0 q3.3,3 6.6,0 q3.3,3 6.6,0 q3.3,3 6.6,0', fill: 'none', stroke: trim, 'stroke-width': 1.6 }, g);
  el('path', { d: 'M-9,-54 Q-8,-46 0,-49.5 Q8,-46 9,-54 Z', fill: '#fff', ...ln }, g);
  el('path', { d: 'M-2.6,-49 l2.6,1.6 l2.6,-1.6 l-.6,3.4 h-4 z', fill: trim, ...thin }, g);
  [-41, -35].forEach((y) => el('circle', { cx: 0, cy: y, r: 1.1, fill: '#fff', ...thin }, g));
};
const shirtShorts = (shirt, dark, shorts) => (g) => {
  [-1, 1].forEach((s) => el('path', { d: `M${s * 8},-54 l${s * 8},4 l${s * -2},7 l${s * -7},-3 z`, fill: shirt, ...ln }, g));
  el('path', { d: 'M-6,-30 h12 l1.5,8 h-6 l-1.5,-4 l-1.5,4 h-6 z', fill: shorts, ...ln }, g);
  el('path', { d: 'M-9,-54 H9 L10,-30 H-10 Z', fill: shirt, ...ln }, g);
  el('path', { d: 'M4,-54 H9 L10,-30 H5 Z', fill: dark }, g);
  el('path', { d: 'M-10,-33 H10', stroke: OUT, 'stroke-width': .8 }, g);
  el('path', { d: 'M-4,-54 L0,-49 L4,-54', fill: '#fff', ...ln }, g);
  // 胸前小星星
  el('path', { d: 'M-4,-44 l1,2 l2.2,.3 l-1.6,1.5 l.4,2.2 l-2,-1 l-2,1 l.4,-2.2 l-1.6,-1.5 l2.2,-.3 z', fill: '#fff', ...thin }, g);
};
export const CHARS = [
  { name: '小鮑', sub: '鮑伯頭・星星髮夾', shoe: '#e65f7a', freckle: true,
    outfit: dress('#ffc7d6', '#f5adc1', '#fff'),
    back: (g) => hairPath(g, 'M-34,-80 C-36,-112 36,-112 34,-80 L34,-62 Q30,-55 23,-58 L22,-66 L-22,-66 L-23,-58 Q-30,-55 -34,-62 Z', '#5a3a2e'),
    front: (g) => {
      hairPath(g, 'M-33,-80 C-36,-112 36,-112 33,-80 Q28,-88 23,-83 Q19,-93 13,-85 Q7,-95 0,-86 Q-7,-95 -13,-85 Q-19,-93 -23,-83 Q-28,-88 -32,-80 Z', '#5a3a2e', 'M-18,-97 Q-4,-102 10,-99');
      [-1, 1].forEach((s) => hairPath(g, `M${s * 31},-84 C${s * 35},-72 ${s * 34},-64 ${s * 29},-57 Q${s * 26},-64 ${s * 26},-76 Z`, '#5a3a2e'));
      strands(g, 'M-8,-100 Q-11,-94 -13,-88 M8,-100 Q10,-94 13,-88 M0,-101 V-90', '#3e271f');
    },
    acc: (g) => { el('path', { d: 'M17,-98 l2.8,5.6 l6.2,.9 l-4.5,4.3 l1.1,6.1 l-5.6,-2.9 l-5.6,2.9 l1.1,-6.1 l-4.5,-4.3 l6.2,-.9 z', fill: '#ffd963', ...ln }, g); el('circle', { cx: 15.6, cy: -91, r: .9, fill: '#fff' }, g); } },
  { name: '小栗', sub: '側馬尾・紅色蝴蝶結', shoe: '#4f9f90', freckle: false, sock: '#fff4d6',
    outfit: dress('#b9e6d8', '#9fd6c5', '#fff'),
    back: (g) => {
      hairPath(g, 'M-33,-78 C-35,-110 35,-110 33,-78 L32,-66 L-32,-66 Z', '#9a5530');
      hairPath(g, 'M26,-92 C46,-94 50,-74 44,-58 C40,-48 34,-44 30,-38 C34,-50 34,-58 30,-66 C27,-73 25,-80 26,-92 Z', '#9a5530', 'M38,-84 Q43,-76 41,-66');
      strands(g, 'M34,-80 Q38,-66 33,-50', '#7a3f22');
    },
    front: (g) => {
      hairPath(g, 'M-33,-76 C-37,-112 35,-112 33,-80 C26,-87 16,-91 6,-88 C-4,-85 -12,-90 -19,-86 C-25,-83 -29,-80 -33,-76 Z', '#9a5530', 'M-18,-97 Q-4,-102 10,-99');
      hairPath(g, 'M-32,-80 C-34,-70 -32,-62 -28,-57 Q-27,-66 -28,-78 Z', '#9a5530');
      strands(g, 'M14,-102 Q6,-96 -2,-88 M24,-98 Q18,-93 12,-90', '#7a3f22');
    },
    acc: (g) => {
      el('path', { d: 'M24,-96 L14,-104 Q11,-96 15,-89 Z M24,-96 L34,-104 Q37,-96 33,-89 Z', fill: '#ef5470', ...ln }, g);
      el('circle', { cx: 24, cy: -96, r: 3.2, fill: '#ef5470', ...ln }, g);
      el('path', { d: 'M15.5,-100 q1,-2 3,-1.5', stroke: '#fff', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }, g);
    } },
  { name: '小翹', sub: '短髮・一撮呆毛', shoe: '#5c74c4', freckle: true, sock: '#fff', brow: '#2a2433',
    outfit: shirtShorts('#ffe08a', '#f6cd63', '#7d93d6'),
    back: (g) => hairPath(g, 'M-32,-78 C-34,-110 34,-110 32,-78 L31,-70 L-31,-70 Z', '#36303f'),
    front: (g) => {
      hairPath(g, 'M-33,-74 C-36,-112 36,-112 33,-74 Q29,-82 26,-86 L22,-80 L19,-89 L13,-83 L9,-92 L3,-85 L-2,-93 L-7,-85 L-13,-91 L-17,-83 L-23,-88 L-26,-80 Q-29,-80 -31,-74 Z', '#36303f', 'M-18,-98 Q-4,-103 10,-100');
      hairPath(g, 'M1,-100 C0,-114 10,-121 19,-116 C12,-115 8,-110 7,-101 Z', '#36303f');
      [-1, 1].forEach((s) => hairPath(g, `M${s * 31},-80 Q${s * 33},-72 ${s * 30},-66 Q${s * 28},-72 ${s * 28},-78 Z`, '#36303f'));
    },
    acc: null },
];

