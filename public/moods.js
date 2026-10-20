// Pixel mood faces (20×20). Each row: o outline, f fill, s shade, h highlight,
// e features, w white, b blush, t tear, r red, y yellow, p tongue.
const FIXED = { e: '#3B2F35', w: '#fff', b: '#F79AB3', t: '#6FB5EE', r: '#E5475F', y: '#FFE27A', p: '#F26E86' };
const PALETTE = {
  happy: ["#FFD978", "#F6BE55", "#FFF1C2", "#C98A2A"],
  excited: ["#FFC4A0", "#F7A57A", "#FFE6D6", "#C46E44"],
  calm: ["#CDE9C0", "#AFD6A0", "#EEF8E8", "#6E9E5E"],
  moved: ["#FFE0A6", "#F6C97C", "#FFF4DC", "#C2914A"],
  love: ["#FFBBCF", "#F59AB5", "#FFE3EC", "#C75F84"],
  tired: ["#BCD2EA", "#9DBBDC", "#E3EDF8", "#5E7FA6"],
  sad: ["#9FAED2", "#8495C2", "#D5DCEE", "#4F5F8E"],
  angry: ["#F5A595", "#EA8873", "#FDD8CF", "#B4523F"],
  nervous: ["#CEC6EB", "#B5AADF", "#ECE8F8", "#6E63A6"],
  miss: ["#C3E0F6", "#A2CBEE", "#E8F3FC", "#4F87B7"],
};
const GRIDS = {
  happy: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "offffffffffffffffffo", "offeeeffffffffeeeffo", "ofeefeeffffffeefeefo", "oeefffeeffffeefffeeo", "offffffffffffffffsso", "obbffffffffffffffbbo", "offffffeeeeeefffssso", ".offsfferrrreffssso.", ".ofsssffeppeffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  excited: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "offeeeffffffffeeeffo", "ofeeyeeffffffeeyeefo", "ofeyyyeffffffeyyyefo", "ofeeyeeffffffeeyeefo", "offeeeffffffffeeesso", "obbfffeeeeeeeefffbbo", "offffferrrrrreffssso", ".offsffeppppeffssso.", ".ofsssffeeeeffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  calm: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "offffffffffffffffffo", "offffffffffffffffffo", "oeefffeeffffeefffeeo", "ofeeeeeffffffeeeeefo", "offffffffffffffffsso", "obbffffffffffffffbbo", "offfffffffffffffssso", ".offsfffeffefffssso.", ".ofsssfffeefffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  moved: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "offeeeffffffffeeeffo", "ofewweeffffffeewwefo", "ofeweeffffffffeewefo", "ofeeeeeffffffeeeeefo", "offeeeffffffffeeesso", "ofttttffffffffttttso", "obbfffffffffffffsbbo", ".offsfffeffefffssso.", ".ofsssfffeefffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  love: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "ofrrfrrffffffrrfrrfo", "orwrrrrrffffrrrrrwro", "orrrrrrrffffrrrrrrro", "ofrrrrrffffffrrrrrfo", "offrrrffffffffrrrsso", "obbfrffffffffffrfbbo", "offfffffffffffffssso", ".offsfffeeeefffssso.", ".ofsssfffeefffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  tired: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "offffffffffffffffffo", "offffffffffffffffffo", "ofeeeeeffffffeeeeefo", "ofewweeffffffeewwefo", "offeeeffffffffeeesso", "obbffffffffffffffbbo", "offfffffffffffffssso", ".offsfffeeffeffssso.", ".ofsssfeffeeffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  sad: ["......oooooooo......", "....ooffffffffoo....", "...offffffffffffo...", "..offhhffffffffffo..", ".offhhffffffffffffo.", ".ofhffffffffffffffo.", "offffffffffffffffffo", "offffffffffffffffffo", "ofeeeeeffffffeeeeefo", "offtftfffffffftftffo", "offtftfffffffftftffo", "offtftfffffffftftsso", "obttwttffffffttwttbo", "offfffffffffffffssso", ".offsfffeeeefffssso.", ".ofsssfeffffefsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  angry: ["......oooooooo......", "....ooffffffffor.r..", "...offffffffffffr...", "..offhhffffffffrfr..", ".offhhffffffffffffo.", ".oeeffffffffffffeeo.", "offfeeffffffffeefffo", "offffeffffffffeffffo", "ofewweeffffffeewwefo", "ofeweeffffffffeewefo", "ofeeeeeffffffeeeeefo", "offeeeffffffffeeesso", "obbffffffffffffffbbo", "offfffffffffffffssso", ".offsfffeeeefffssso.", ".ofsssfeffffefsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  nervous: ["......oooooooo......", "....ooffffffffoo....", "...offfffffffffft...", "..offhhfffffffffto..", ".offhhfffffffffttto.", ".ofhffffffffffftwto.", "offffffffffffffftffo", "ofeeffffffffffffeefo", "offeeeffffffffeeeffo", "offffeeffffffeeffffo", "offeeeffffffffeeeffo", "ofeeffffffffffffeeso", "obbffffffffffffffbbo", "offfffffffffffffssso", ".offsfffeffefffssso.", ".ofsssfefeefefsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
  miss: ["......oooooooo..r.r.", "....ooffffffffoorrr.", "...offffffffffffor..", "..offhhffffffffffo..", ".offheeffffffeefffo.", ".ofeeffffffffffeefo.", "offffffffffffffffffo", "offeeeffffffffeeeffo", "ofewweeffffffeewwefo", "ofeweeffffffffeewefo", "ofeeeeeffffffeeeeefo", "offeeeffffffffeeesso", "obbffffffffffffffbbo", "offfffffffffffffssso", ".offsfffeeeefffssso.", ".ofsssffffffffsssso.", "..ossssffffffsssso..", "...osssssssssssso...", "....oossssssssoo....", "......oooooooo......"],
};

const cache = new Map();

// SVG markup for the face of an emotion key; '' for unknown keys.
export function moodFaceSvg(key, size = 20) {
  const grid = GRIDS[key];
  if (!grid) return '';
  if (!cache.has(key)) {
    const [f, s, h, o] = PALETTE[key];
    const colors = { ...FIXED, f, s, h, o };
    const paths = {};
    grid.forEach((row, y) => [...row].forEach((c, x) => {
      if (colors[c]) paths[c] = (paths[c] || '') + `M${x} ${y}h1v1h-1z`;
    }));
    cache.set(key, Object.entries(paths).map(([c, d]) => `<path fill="${colors[c]}" d="${d}"/>`).join(''));
  }
  return `<svg class="mood-face" width="${size}" height="${size}" viewBox="0 0 20 20" shape-rendering="crispEdges" aria-hidden="true">${cache.get(key)}</svg>`;
}

// Same face as a DOM element (a span wrapping the svg).
export function moodFace(key, size = 20) {
  const span = document.createElement('span');
  span.className = 'mood-face-wrap';
  span.innerHTML = moodFaceSvg(key, size);
  return span;
}
