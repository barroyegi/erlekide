// Fondo de campo procedural v3 — dos variantes:
//   node gen-bg.js desktop  → bg.svg 1600x1000, seto+vallado arriba
//   node gen-bg.js mobile   → bg.svg 1000x1700, seto+vallado en banda derecha
// Realismo: grano y manchas tonales (feTurbulence), seto con desenfoque de
// profundidad, hierba en matas, sombras proyectadas de postes, alambrado destacado.
'use strict';
const fs = require('fs');

const MODE = process.argv[2] || 'desktop';
const M = MODE === 'mobile';
const W = M ? 1000 : 1600, H = M ? 1700 : 1000;
const GROUND = 118;          // desktop: y del pie del seto
const FX = W - 150;          // mobile: x del borde izquierdo de la banda del seto
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const out = [];
const add = s => out.push(s);

// zona de hierba utilizable
const gy0 = M ? 10 : GROUND + 14;
const inGrass = (x, y) => M ? x < FX - 6 : y > GROUND + 10;
function grassSpot(margin) {
  for (; ;) {
    const x = rnd(margin, (M ? FX - 20 : W) - margin);
    const y = rnd((M ? 12 : GROUND + 40) + margin, H - margin);
    if (inGrass(x, y)) return [x, y];
  }
}
// escala por "cercanía": desktop crece hacia abajo; mobile uniforme
const depth = y => M ? rnd(.75, 1.1) : 0.4 + 1.25 * Math.max(0, (y - GROUND) / (H - GROUND));

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);

add(`<defs>
<linearGradient id="g" x1="0" y1="0" x2="${M ? 1 : 0}" y2="${M ? 0 : 1}">
<stop offset="0" stop-color="${M ? '#5d7a3c' : '#7e9352'}"/><stop offset="0.25" stop-color="#6c8444"/>
<stop offset="0.65" stop-color="#5f7a3c"/><stop offset="1" stop-color="${M ? '#7e9352' : '#516b34'}"/>
</linearGradient>
<linearGradient id="hs" x1="${M ? 0 : 0}" y1="0" x2="${M ? 1 : 0}" y2="${M ? 0 : 1}">
<stop offset="0" stop-color="#16230c" stop-opacity="${M ? 0 : .45}"/><stop offset="1" stop-color="#16230c" stop-opacity="${M ? .45 : 0}"/>
</linearGradient>
<filter id="dof" x="-6%" y="-6%" width="112%" height="112%"><feGaussianBlur stdDeviation="1.5"/></filter>
<filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
<filter id="clouds"><feTurbulence type="fractalNoise" baseFrequency="${M ? '0.0045' : '0.003 0.005'}" numOctaves="3" seed="11" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
</defs>`);

add(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);

// ── Franjas de siega sutiles ──
if (!M) {
  let fy = GROUND + 14, fh = 30, fi = 0;
  while (fy < H + 220) {
    if (fi % 2 === 0) add(`<rect x="0" y="${fy | 0}" width="${W}" height="${fh | 0}" fill="#26330f" opacity="0.05"/>`);
    fy += fh; fh *= 1.22; fi++;
  }
} else {
  for (let fx2 = 0, fi = 0; fx2 < FX; fx2 += 96, fi++)
    if (fi % 2 === 0) add(`<rect x="${fx2}" y="0" width="96" height="${H}" fill="#26330f" opacity="0.045"/>`);
}

// ── Moteado orgánico ──
for (let k = 0; k < (M ? 240 : 220); k++) {
  const [x, y] = grassSpot(0);
  const sc = depth(y);
  add(`<ellipse cx="${x | 0}" cy="${y | 0}" rx="${(rnd(30, 130) * sc) | 0}" ry="${(rnd(12, 45) * sc) | 0}" fill="${pick(['#43592a', '#7d9551', '#69833f', '#8c9c58', '#4d6630'])}" opacity="${rnd(.05, .11).toFixed(2)}"/>`);
}

// ── Manchas tonales tipo nube (turbulencia, blend overlay) ──
add(`<rect width="${W}" height="${H}" filter="url(#clouds)" opacity=".16" style="mix-blend-mode:overlay"/>`);

// ── Calvas de tierra ──
for (let k = 0; k < 9; k++) {
  const [x, y] = grassSpot(60);
  const sc = depth(y);
  add(`<ellipse cx="${x | 0}" cy="${y | 0}" rx="${(rnd(40, 90) * sc) | 0}" ry="${(rnd(14, 26) * sc) | 0}" fill="#7a6a44" opacity="${rnd(.10, .18).toFixed(2)}"/>`);
  add(`<ellipse cx="${(x + rnd(-20, 20)) | 0}" cy="${(y + rnd(-6, 6)) | 0}" rx="${(rnd(18, 40) * sc) | 0}" ry="${(rnd(7, 13) * sc) | 0}" fill="#6b5a38" opacity="${rnd(.12, .2).toFixed(2)}"/>`);
}

// ── Sombra del seto sobre el suelo ──
if (!M) add(`<rect x="0" y="${GROUND - 6}" width="${W}" height="52" fill="url(#hs)"/>`);
else add(`<rect x="${FX - 44}" y="0" width="58" height="${H}" fill="url(#hs)"/>`);

// ── Briznas de hierba ──
const farCols = ['#5d7a3c', '#688547', '#71904c', '#557236'];
const nearCols = ['#3e5a26', '#4a692e', '#557636', '#62843d', '#6f9247', '#54703a'];
const dryCols = ['#8d9050', '#9b9858', '#7f7f44'];
function blade(x, y, s, c, w) {
  const l = rnd(7, 15) * s;
  const lean = rnd(-4.5, 4.5) * s;
  return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${lean.toFixed(1)} ${(-l * .6).toFixed(1)} ${(lean * 1.9).toFixed(1)} ${(-l).toFixed(1)}" stroke="${c}" stroke-width="${(w + s * .75).toFixed(2)}" fill="none" stroke-linecap="round"/>`;
}
function bladeCol(y) {
  if (Math.random() < .06) return pick(dryCols);
  if (!M && (y - GROUND) / (H - GROUND) < .3) return pick(farCols);
  return pick(M ? nearCols.concat(farCols) : nearCols);
}
// sueltas
for (let k = 0; k < 4600; k++) {
  let x, y;
  if (M) { [x, y] = grassSpot(0); } else {
    const t = Math.pow(Math.random(), 0.8);
    y = GROUND + 16 + (H - GROUND - 12) * t; x = rnd(0, W);
  }
  add(`<g opacity="${rnd(.4, .85).toFixed(2)}">${blade(x, y, depth(y), bladeCol(y), .5)}</g>`);
}
// en matas (la hierba real crece a grupos)
for (let k = 0; k < 420; k++) {
  let cx, cy;
  if (M) { [cx, cy] = grassSpot(8); } else {
    const t = Math.pow(Math.random(), 0.75);
    cy = GROUND + 26 + (H - GROUND - 20) * t; cx = rnd(0, W);
  }
  const s = depth(cy);
  let g = '';
  const n = 5 + (rnd(0, 5) | 0);
  for (let i = 0; i < n; i++) g += blade(rnd(-6, 6) * s, rnd(-2, 2), s * rnd(.85, 1.15), bladeCol(cy), .5);
  add(`<g transform="translate(${cx.toFixed(0)} ${cy.toFixed(0)})" opacity="${rnd(.5, .9).toFixed(2)}">${g}</g>`);
}
// franja fina junto al seto
for (let k = 0; k < 800; k++) {
  if (!M) add(`<g opacity="${rnd(.35, .7).toFixed(2)}">${blade(rnd(0, W), rnd(GROUND + 6, GROUND + 70), rnd(.35, .55), pick(farCols), .4)}</g>`);
  else add(`<g opacity="${rnd(.35, .7).toFixed(2)}">${blade(rnd(FX - 70, FX + 6), rnd(0, H), rnd(.5, .8), pick(farCols), .4)}</g>`);
}
// espigas altas (fleo) dispersas
for (let k = 0; k < 70; k++) {
  const [x, y] = grassSpot(10);
  const s = depth(y);
  const hgt = rnd(18, 30) * s, lean = rnd(-5, 5);
  add(`<g transform="translate(${x | 0} ${y | 0})" opacity=".75">
<path d="M0 0 q${lean} ${-hgt * .6} ${lean * 1.5} ${-hgt}" stroke="#8a9a52" stroke-width="${(1 * s).toFixed(2)}" fill="none"/>
<ellipse cx="${(lean * 1.5).toFixed(1)}" cy="${(-hgt - 2 * s).toFixed(1)}" rx="${(1.4 * s).toFixed(1)}" ry="${(4.5 * s).toFixed(1)}" fill="#a3a35e"/></g>`);
}

// ── Especies ──
for (let p = 0; p < 22; p++) {       // trébol
  const [cx, cy] = grassSpot(46);
  const sc = depth(cy);
  let g = '';
  const n = 8 + (rnd(0, 14) | 0);
  for (let i = 0; i < n; i++) {
    const lx = rnd(-46, 46) * sc, ly = rnd(-17, 17) * sc, r = rnd(2.2, 3.4) * sc;
    const c = pick(['#2f4f22', '#38602a', '#2a451d']);
    g += `<g transform="translate(${lx.toFixed(0)} ${ly.toFixed(0)})">`;
    for (let a = 0; a < 3; a++) {
      const rad = (a * 120 + rnd(-12, 12)) * Math.PI / 180;
      g += `<circle cx="${(Math.cos(rad) * r * .95).toFixed(1)}" cy="${(Math.sin(rad) * r * .95).toFixed(1)}" r="${r.toFixed(1)}" fill="${c}"/>`;
    }
    g += '</g>';
  }
  add(`<g transform="translate(${cx | 0} ${cy | 0})" opacity=".85">${g}</g>`);
}
for (let p = 0; p < 16; p++) {       // llantén
  const [cx, cy] = grassSpot(16);
  const sc = depth(cy);
  let g = '';
  const leaves = 5 + (rnd(0, 3) | 0);
  for (let i = 0; i < leaves; i++) {
    const ang = (i / leaves) * 360 + rnd(-15, 15);
    const len = rnd(9, 15) * sc;
    g += `<g transform="rotate(${ang.toFixed(0)})"><ellipse cx="0" cy="${(-len / 2).toFixed(1)}" rx="${(2.1 * sc).toFixed(1)}" ry="${(len / 2).toFixed(1)}" fill="${pick(['#41652c', '#4b7233'])}"/><line x1="0" y1="-1" x2="0" y2="${(-len + 2).toFixed(1)}" stroke="#5d8540" stroke-width="${(.6 * sc).toFixed(2)}"/></g>`;
  }
  add(`<g transform="translate(${cx | 0} ${cy | 0})" opacity=".9">${g}</g>`);
}
for (let p = 0; p < 16; p++) {       // diente de león (flor)
  const [cx, cy] = grassSpot(12);
  const sc = depth(cy);
  const r = 3.4 * sc;
  let g = `<line x1="0" y1="0" x2="${rnd(-2, 2).toFixed(1)}" y2="${(-9 * sc).toFixed(1)}" stroke="#557637" stroke-width="${(1 * sc).toFixed(2)}"/>`;
  g += `<g transform="translate(${rnd(-2, 2).toFixed(1)} ${(-9 * sc).toFixed(1)})">`;
  for (let i = 0; i < 10; i++) {
    const rad = i / 10 * Math.PI * 2;
    g += `<ellipse cx="${(Math.cos(rad) * r * .7).toFixed(1)}" cy="${(Math.sin(rad) * r * .7).toFixed(1)}" rx="${(r * .55).toFixed(1)}" ry="${(r * .3).toFixed(1)}" transform="rotate(${(rad * 57.3).toFixed(0)} ${(Math.cos(rad) * r * .7).toFixed(1)} ${(Math.sin(rad) * r * .7).toFixed(1)})" fill="#e3c43c"/>`;
  }
  g += `<circle r="${(r * .5).toFixed(1)}" fill="#c9a428"/></g>`;
  add(`<g transform="translate(${cx | 0} ${cy | 0})">${g}</g>`);
}
for (let p = 0; p < 8; p++) {        // diente de león (vilano)
  const [cx, cy] = grassSpot(12);
  const sc = depth(cy);
  const r = 4 * sc;
  let g = `<line x1="0" y1="0" x2="0" y2="${(-10 * sc).toFixed(1)}" stroke="#6d7d4a" stroke-width="${(.9 * sc).toFixed(2)}"/><g transform="translate(0 ${(-10 * sc - r * .4).toFixed(1)})"><circle r="${r.toFixed(1)}" fill="#eceadc" opacity=".55"/>`;
  for (let i = 0; i < 14; i++) {
    const rad = i / 14 * Math.PI * 2;
    g += `<line x1="0" y1="0" x2="${(Math.cos(rad) * r).toFixed(1)}" y2="${(Math.sin(rad) * r).toFixed(1)}" stroke="#f0eee2" stroke-width=".5" opacity=".8"/>`;
  }
  g += `<circle r="${(r * .25).toFixed(1)}" fill="#cfcaaf"/></g>`;
  add(`<g transform="translate(${cx | 0} ${cy | 0})">${g}</g>`);
}
for (let p = 0; p < 18; p++) {       // margaritas
  const [cx, cy] = grassSpot(10);
  const sc = .9 * depth(cy);
  let g = '';
  for (let i = 0; i < 8; i++) {
    const ang = i * 45 + rnd(-8, 8);
    g += `<ellipse cx="0" cy="${(-3 * sc).toFixed(1)}" rx="${(1.1 * sc).toFixed(1)}" ry="${(3 * sc).toFixed(1)}" transform="rotate(${ang})" fill="#f0eee0"/>`;
  }
  g += `<circle r="${(1.7 * sc).toFixed(1)}" fill="#dfb23a"/>`;
  add(`<g transform="translate(${cx | 0} ${cy | 0})" opacity=".92">${g}</g>`);
}
for (let p = 0; p < 12; p++) {       // cardos secos
  const [cx, cy] = grassSpot(14);
  const sc = depth(cy);
  let g = '';
  const stems = 3 + (rnd(0, 3) | 0);
  for (let i = 0; i < stems; i++) {
    const lx = (i - stems / 2) * 3.2 * sc, hgt = rnd(14, 24) * sc, lean = rnd(-4, 4);
    const c = pick(['#9c9456', '#a89e5e', '#8a8148']);
    g += `<path d="M${lx.toFixed(1)} 0 q${lean} ${-hgt * .6} ${lean * 1.6} ${-hgt}" stroke="${c}" stroke-width="${(1 * sc).toFixed(2)}" fill="none"/>`;
    g += `<ellipse cx="${(lx + lean * 1.6).toFixed(1)}" cy="${-hgt.toFixed(1)}" rx="${(1.6 * sc).toFixed(1)}" ry="${(2.6 * sc).toFixed(1)}" fill="${c}"/>`;
  }
  add(`<g transform="translate(${cx | 0} ${cy | 0})" opacity=".8">${g}</g>`);
}
for (let p = 0; p < 11; p++) {       // piedras
  const [cx, cy] = grassSpot(20);
  const sc = depth(cy);
  const rx = rnd(5, 11) * sc, ry = rx * rnd(.55, .7);
  add(`<g transform="translate(${cx | 0} ${cy | 0}) rotate(${rnd(-10, 10).toFixed(0)})">
<ellipse cx="${(rx * .25).toFixed(1)}" cy="${(ry * .5).toFixed(1)}" rx="${(rx * 1.05).toFixed(1)}" ry="${(ry * .6).toFixed(1)}" fill="#1c2a10" opacity=".3" filter="url(#soft)"/>
<ellipse rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${pick(['#8d8a7e', '#94908a', '#827e72'])}"/>
<ellipse cx="${(-rx * .2).toFixed(1)}" cy="${(-ry * .3).toFixed(1)}" rx="${(rx * .55).toFixed(1)}" ry="${(ry * .45).toFixed(1)}" fill="#a5a196" opacity=".7"/>
</g>`);
}

// ── Seto (con desenfoque de profundidad) ──
const hedgeDark = ['#1f3413', '#243d17', '#1b2e10'];
const hedgeMid = ['#2c481d', '#335322', '#2a431a'];
const hedgeLit = ['#3f6128', '#48702e', '#527c34', '#42662a'];
let hedgeEls = [];
if (!M) {
  const hh = x => 78 + 26 * Math.sin(x / 210) + 14 * Math.sin(x / 67 + 2);
  hedgeEls.push(`<rect x="0" y="0" width="${W}" height="64" fill="#1d3011"/>`);
  for (let x = -16; x < W + 16; x += 7) {
    const h0 = hh(x) + rnd(-6, 6);
    for (let yy = 4; yy < h0; yy += rnd(7, 12)) {
      const f = yy / h0;
      const c = f > .72 ? pick(hedgeDark) : f > .4 ? pick(hedgeMid) : pick(hedgeLit);
      hedgeEls.push(`<circle cx="${(x + rnd(-5, 5)).toFixed(0)}" cy="${(yy + rnd(-3, 3)).toFixed(0)}" r="${rnd(4.5, 10).toFixed(1)}" fill="${c}" opacity="${rnd(.8, 1).toFixed(2)}"/>`);
    }
    if (Math.random() < .3) hedgeEls.push(`<circle cx="${x}" cy="${(hh(x) + rnd(2, 9)).toFixed(0)}" r="${rnd(3, 6).toFixed(1)}" fill="${pick(hedgeDark)}"/>`);
  }
  for (let k = 0; k < 130; k++) {
    const x = rnd(0, W);
    hedgeEls.push(`<circle cx="${x | 0}" cy="${rnd(2, hh(x) * .5) | 0}" r="${rnd(2, 4.5).toFixed(1)}" fill="${pick(['#5d8a3c', '#558034'])}" opacity="${rnd(.5, .9).toFixed(2)}"/>`);
  }
} else {
  const hw = y => 78 + 26 * Math.sin(y / 210) + 14 * Math.sin(y / 67 + 2);
  hedgeEls.push(`<rect x="${W - 64}" y="0" width="64" height="${H}" fill="#1d3011"/>`);
  for (let y = -16; y < H + 16; y += 7) {
    const w0 = hw(y) + rnd(-6, 6);
    for (let xx = 4; xx < w0; xx += rnd(7, 12)) {
      const f = xx / w0;
      const c = f > .72 ? pick(hedgeDark) : f > .4 ? pick(hedgeMid) : pick(hedgeLit);
      hedgeEls.push(`<circle cx="${(W - xx + rnd(-3, 3)).toFixed(0)}" cy="${(y + rnd(-5, 5)).toFixed(0)}" r="${rnd(4.5, 10).toFixed(1)}" fill="${c}" opacity="${rnd(.8, 1).toFixed(2)}"/>`);
    }
    if (Math.random() < .3) hedgeEls.push(`<circle cx="${(W - hw(y) - rnd(2, 9)).toFixed(0)}" cy="${y}" r="${rnd(3, 6).toFixed(1)}" fill="${pick(hedgeDark)}"/>`);
  }
  for (let k = 0; k < 140; k++) {
    const y = rnd(0, H);
    hedgeEls.push(`<circle cx="${(W - rnd(2, hw(y) * .5)) | 0}" cy="${y | 0}" r="${rnd(2, 4.5).toFixed(1)}" fill="${pick(['#5d8a3c', '#558034'])}" opacity="${rnd(.5, .9).toFixed(2)}"/>`);
  }
}
add(`<g filter="url(#dof)">${hedgeEls.join('')}</g>`);

// ── Helechos delante del seto ──
for (let k = 0; k < 34; k++) {
  const cx = M ? rnd(FX - 16, FX + 14) : rnd(0, W);
  const cy = M ? rnd(0, H) : rnd(GROUND - 14, GROUND + 8);
  const sc = rnd(.7, 1.25);
  let g = '';
  const fronds = 3 + (rnd(0, 3) | 0);
  for (let f = 0; f < fronds; f++) {
    const ang = -90 + (f - fronds / 2) * rnd(20, 30);
    const len = rnd(16, 30) * sc;
    const rad = ang * Math.PI / 180;
    const tx = Math.cos(rad) * len, ty = Math.sin(rad) * len;
    let fr = `<line x1="0" y1="0" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#3a5c24" stroke-width="1.1"/>`;
    for (let l = .25; l < 1; l += .16) {
      const px = tx * l, py = ty * l, ll = (1 - l) * 7 * sc;
      const pa = rad + Math.PI / 2;
      fr += `<line x1="${(px - Math.cos(pa) * ll).toFixed(1)}" y1="${(py - Math.sin(pa) * ll).toFixed(1)}" x2="${(px + Math.cos(pa) * ll).toFixed(1)}" y2="${(py + Math.sin(pa) * ll).toFixed(1)}" stroke="${pick(['#46702c', '#518036'])}" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    g += fr;
  }
  add(`<g transform="translate(${cx | 0} ${cy | 0})">${g}</g>`);
}

// ── Alambrado: postes grandes + 3 alambres con púas, bien visibles ──
const wireHeights = [-84, -58, -30];
function drawPost(x, baseY) {
  const ph = rnd(104, 124), pw = rnd(15, 18), tilt = rnd(-2.2, 2.2);
  // sombra proyectada sobre la hierba (sol arriba-izquierda)
  add(`<ellipse cx="${(x + 20).toFixed(0)}" cy="${(baseY + 6).toFixed(0)}" rx="30" ry="7" fill="#16230c" opacity=".3" filter="url(#soft)" transform="rotate(12 ${x} ${baseY})"/>`);
  add(`<g transform="translate(${x.toFixed(0)} ${baseY.toFixed(0)}) rotate(${tilt.toFixed(1)})">
<ellipse cx="3" cy="2" rx="${(pw * 1.4).toFixed(0)}" ry="5.5" fill="#16230c" opacity=".42"/>
<rect x="${(-pw / 2).toFixed(1)}" y="${-ph}" width="${pw}" height="${ph + 5}" rx="2" fill="#6b4f2e"/>
<rect x="${(-pw / 2).toFixed(1)}" y="${-ph}" width="${(pw * .32).toFixed(1)}" height="${ph + 5}" rx="2" fill="#82613a"/>
<rect x="${(pw / 2 - pw * .24).toFixed(1)}" y="${-ph}" width="${(pw * .24).toFixed(1)}" height="${ph + 5}" fill="#4a3520" opacity=".85"/>
<path d="M${(-pw * .1).toFixed(1)} ${-ph + 7} q2.2 ${ph * .3} -1.2 ${ph * .6} q-1.2 ${ph * .2} 1.2 ${ph * .35}" stroke="#523b21" stroke-width="1.3" fill="none" opacity=".85"/>
<path d="M${(pw * .2).toFixed(1)} ${-ph + 11} q-1.6 ${ph * .35} .6 ${ph * .68}" stroke="#523b21" stroke-width="1" fill="none" opacity=".65"/>
${Math.random() < .6 ? `<circle cx="${rnd(-2.5, 2.5).toFixed(1)}" cy="${(-ph * rnd(.3, .7)).toFixed(0)}" r="2.4" fill="#4d3820"/>` : ''}
<ellipse cx="0" cy="${-ph}" rx="${(pw / 2).toFixed(1)}" ry="2.8" fill="#8f6e45"/>
<ellipse cx="0" cy="${-ph}" rx="${(pw / 2 - 1.8).toFixed(1)}" ry="1.8" fill="#a38153"/>
</g>`);
  // grapas
  for (const wy of wireHeights)
    add(`<rect x="${(x - 3).toFixed(0)}" y="${(baseY + wy - 3).toFixed(1)}" width="6" height="6" rx="1.2" fill="#3f3b34"/>`);
  // hierba al pie del poste
  let tuft = '';
  for (let i = 0; i < 7; i++) tuft += blade(rnd(-12, 12), rnd(-1, 2), rnd(.7, 1), pick(nearCols), .5);
  add(`<g transform="translate(${x.toFixed(0)} ${(baseY + 3).toFixed(0)})">${tuft}</g>`);
}
function drawWireSpan(p1, p2, wy, vertical) {
  // p1/p2: coordenada a lo largo de la valla; wy: altura del alambre
  const sag = rnd(5, 9);
  let d, shadow, hi;
  if (!vertical) {
    const yA = GROUND + 2 + wy, mx = (p1 + p2) / 2;
    d = `M${p1.toFixed(0)} ${yA} Q${mx.toFixed(0)} ${(yA + sag).toFixed(1)} ${p2.toFixed(0)} ${yA}`;
    shadow = `M${p1.toFixed(0)} ${yA + 1.6} Q${mx.toFixed(0)} ${(yA + sag + 1.6).toFixed(1)} ${p2.toFixed(0)} ${yA + 1.6}`;
    hi = `M${p1.toFixed(0)} ${yA - 1} Q${mx.toFixed(0)} ${(yA + sag - 1).toFixed(1)} ${p2.toFixed(0)} ${yA - 1}`;
  } else {
    // los hilos cruzan sobre los postes (centro FX+26), separados ±13px
    const xA = FX + 26 + (wy + 58) * .48, my = (p1 + p2) / 2;
    d = `M${xA.toFixed(1)} ${p1.toFixed(0)} Q${(xA - sag).toFixed(1)} ${my.toFixed(0)} ${xA.toFixed(1)} ${p2.toFixed(0)}`;
    shadow = `M${(xA + 1.6).toFixed(1)} ${p1.toFixed(0)} Q${(xA - sag + 1.6).toFixed(1)} ${my.toFixed(0)} ${(xA + 1.6).toFixed(1)} ${p2.toFixed(0)}`;
    hi = `M${(xA - 1).toFixed(1)} ${p1.toFixed(0)} Q${(xA - sag - 1).toFixed(1)} ${my.toFixed(0)} ${(xA - 1).toFixed(1)} ${p2.toFixed(0)}`;
  }
  add(`<path d="${shadow}" stroke="#1d2117" stroke-width="3" fill="none" opacity=".5"/>`);
  add(`<path d="${d}" stroke="#8a8678" stroke-width="2.6" fill="none"/>`);
  add(`<path d="${hi}" stroke="#d2cebe" stroke-width="1" fill="none" opacity=".8"/>`);
  // púas
  for (let t = rnd(.1, .2); t < .95; t += rnd(.12, .2)) {
    let bx, by;
    if (!vertical) { bx = p1 + (p2 - p1) * t; by = GROUND + 2 + wy + sag * 2 * t * (1 - t); }
    else { by = p1 + (p2 - p1) * t; bx = FX + 26 + (wy + 58) * .48 - sag * 2 * t * (1 - t); }
    add(`<g transform="translate(${bx.toFixed(0)} ${by.toFixed(1)}) rotate(${rnd(-14, 14).toFixed(0)})"><line x1="-4.2" y1="-4.2" x2="4.2" y2="4.2" stroke="#4f4b42" stroke-width="1.8"/><line x1="-4.2" y1="4.2" x2="4.2" y2="-4.2" stroke="#4f4b42" stroke-width="1.8"/></g>`);
  }
}

const posts = [];
let pp = rnd(70, 140);
const SPAN_END = M ? H : W;
while (pp < SPAN_END + 140) { posts.push(pp); pp += rnd(230, 290); }
const spans = [];
for (let i = -1; i < posts.length; i++) {
  const a = i < 0 ? -30 : posts[i];
  const b = i + 1 < posts.length ? posts[i + 1] : SPAN_END + 30;
  if (b > a) spans.push([a, b]);
}
for (const wy of wireHeights)
  for (const [a, b] of spans) drawWireSpan(a, b, wy, M);
for (const p of posts) {
  if (!M) drawPost(p, GROUND + 4);
  else {
    // en móvil el poste es "billboard": de pie, delante de la banda del seto
    drawPostMobile(p);
  }
}
function drawPostMobile(yBase) {
  const x = FX + 26;
  drawPost(x, yBase);
}

// ── Luz ambiental + viñeta + grano ──
add(`<ellipse cx="${W * .3}" cy="${H * .45}" rx="${W * .42}" ry="${H * .3}" fill="#fff6c8" opacity=".045"/>`);
add(`<ellipse cx="${W * .82}" cy="${H * .75}" rx="${W * .3}" ry="${H * .22}" fill="#fff6c8" opacity=".035"/>`);
add(`<rect width="${W}" height="${H}" fill="#1a2a0e" opacity=".05"/>`);
add(`<rect width="${W}" height="${H}" filter="url(#grain)" opacity=".10" style="mix-blend-mode:overlay"/>`);

add('</svg>');
const svg = out.join('\n');
fs.writeFileSync('bg.svg', svg);
console.log(`bg.svg (${MODE}) generado:`, (svg.length / 1024).toFixed(0) + ' KB,', out.length, 'elementos');
