// Fondo de campo procedural v2 — más realista:
// hierba con textura densa (miles de briznas), varias especies de plantas,
// seto de follaje menudo y alambrado de espino bien visible.
// Salida: bg.svg (rasterizar con Edge headless a 1600x1000).
'use strict';
const fs = require('fs');

const W = 1600, H = 1000;
const GROUND = 118; // línea donde el seto toca el suelo
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const out = [];
const add = s => out.push(s);

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);

// ── Base: gradiente apagado, menos saturado que v1 ──
add(`<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#7e9352"/><stop offset="0.2" stop-color="#6f8746"/>
<stop offset="0.6" stop-color="#5f7a3c"/><stop offset="1" stop-color="#516b34"/>
</linearGradient>
<linearGradient id="hs" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#16230c" stop-opacity=".42"/><stop offset="1" stop-color="#16230c" stop-opacity="0"/>
</linearGradient>
</defs>`);
add(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);

// ── Franjas de siega (perspectiva) muy sutiles ──
let fy = GROUND + 14, fh = 30, fi = 0;
while (fy < H + 220) {
  if (fi % 2 === 0) add(`<rect x="0" y="${fy | 0}" width="${W}" height="${fh | 0}" fill="#26330f" opacity="0.05"/>`);
  fy += fh; fh *= 1.22; fi++;
}

// ── Moteado orgánico (variación de tono) ──
for (let k = 0; k < 220; k++) {
  const cy = rnd(GROUND + 20, H);
  const sc = 0.4 + 0.9 * (cy / H);
  add(`<ellipse cx="${rnd(0, W) | 0}" cy="${cy | 0}" rx="${(rnd(30, 130) * sc) | 0}" ry="${(rnd(12, 45) * sc) | 0}" fill="${pick(['#43592a', '#7d9551', '#69833f', '#8c9c58', '#4d6630'])}" opacity="${rnd(.05, .11).toFixed(2)}"/>`);
}

// ── Calvas de tierra ──
for (let k = 0; k < 9; k++) {
  const cy = rnd(GROUND + 80, H);
  const sc = 0.4 + 0.9 * (cy / H);
  const cx = rnd(0, W);
  add(`<ellipse cx="${cx | 0}" cy="${cy | 0}" rx="${(rnd(40, 90) * sc) | 0}" ry="${(rnd(14, 26) * sc) | 0}" fill="#7a6a44" opacity="${rnd(.10, .18).toFixed(2)}"/>`);
  add(`<ellipse cx="${(cx + rnd(-20, 20)) | 0}" cy="${(cy + rnd(-6, 6)) | 0}" rx="${(rnd(18, 40) * sc) | 0}" ry="${(rnd(7, 13) * sc) | 0}" fill="#6b5a38" opacity="${rnd(.12, .2).toFixed(2)}"/>`);
}

// ── Sombra del seto sobre el suelo ──
add(`<rect x="0" y="${GROUND - 4}" width="${W}" height="46" fill="url(#hs)"/>`);

// ── Briznas de hierba: textura principal (capa lejana → cercana) ──
const farCols = ['#5d7a3c', '#688547', '#71904c', '#557236'];
const nearCols = ['#3e5a26', '#4a692e', '#557636', '#62843d', '#6f9247', '#54703a'];
const dryCols = ['#8d9050', '#9b9858', '#7f7f44'];
function blade(x, y, s, c, wmin) {
  const l = rnd(7, 15) * s;
  const lean = rnd(-4.5, 4.5) * s;
  return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} q${lean.toFixed(1)} ${(-l * .6).toFixed(1)} ${(lean * 1.9).toFixed(1)} ${(-l).toFixed(1)}" stroke="${c}" stroke-width="${(wmin + s * .75).toFixed(2)}" fill="none" stroke-linecap="round"/>`;
}
for (let k = 0; k < 6800; k++) {
  const t = Math.pow(Math.random(), 0.8);
  const y = GROUND + 16 + (H - GROUND - 12) * t;
  const s = 0.4 + 1.25 * t;
  const c = Math.random() < .06 ? pick(dryCols) : (t < .3 ? pick(farCols) : pick(nearCols));
  add(`<g opacity="${rnd(.4, .85).toFixed(2)}">${blade(rnd(0, W), y, s, c, .5)}</g>`);
}
// franja junto al seto: hierba fina extra para que no quede desnuda
for (let k = 0; k < 900; k++) {
  const y = rnd(GROUND + 6, GROUND + 70);
  add(`<g opacity="${rnd(.35, .7).toFixed(2)}">${blade(rnd(0, W), y, rnd(.35, .55), pick(farCols), .4)}</g>`);
}

// ── Trébol: parches de hojas trifolio ──
for (let p = 0; p < 22; p++) {
  const cx = rnd(20, W - 20), cy = rnd(GROUND + 60, H - 10);
  const sc = 0.5 + 1.0 * (cy / H);
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

// ── Llantén: rosetas de hojas alargadas ──
for (let p = 0; p < 16; p++) {
  const cx = rnd(20, W - 20), cy = rnd(GROUND + 70, H - 8);
  const sc = 0.5 + 1.0 * (cy / H);
  let g = '';
  const leaves = 5 + (rnd(0, 3) | 0);
  for (let i = 0; i < leaves; i++) {
    const ang = (i / leaves) * 360 + rnd(-15, 15);
    const len = rnd(9, 15) * sc;
    g += `<g transform="rotate(${ang.toFixed(0)})"><ellipse cx="0" cy="${(-len / 2).toFixed(1)}" rx="${(2.1 * sc).toFixed(1)}" ry="${(len / 2).toFixed(1)}" fill="${pick(['#41652c', '#4b7233'])}"/><line x1="0" y1="-1" x2="0" y2="${(-len + 2).toFixed(1)}" stroke="#5d8540" stroke-width="${(.6 * sc).toFixed(2)}"/></g>`;
  }
  add(`<g transform="translate(${cx | 0} ${cy | 0})" opacity=".9">${g}</g>`);
}

// ── Dientes de león: flores amarillas y vilanos ──
for (let p = 0; p < 16; p++) {
  const cx = rnd(15, W - 15), cy = rnd(GROUND + 50, H - 10);
  const sc = 0.5 + 1.0 * (cy / H);
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
for (let p = 0; p < 8; p++) {
  const cx = rnd(15, W - 15), cy = rnd(GROUND + 60, H - 10);
  const sc = 0.5 + 1.0 * (cy / H);
  const r = 4 * sc;
  let g = `<line x1="0" y1="0" x2="0" y2="${(-10 * sc).toFixed(1)}" stroke="#6d7d4a" stroke-width="${(.9 * sc).toFixed(2)}"/><g transform="translate(0 ${(-10 * sc - r * .4).toFixed(1)})"><circle r="${r.toFixed(1)}" fill="#eceadc" opacity=".55"/>`;
  for (let i = 0; i < 14; i++) {
    const rad = i / 14 * Math.PI * 2;
    g += `<line x1="0" y1="0" x2="${(Math.cos(rad) * r).toFixed(1)}" y2="${(Math.sin(rad) * r).toFixed(1)}" stroke="#f0eee2" stroke-width=".5" opacity=".8"/>`;
  }
  g += `<circle r="${(r * .25).toFixed(1)}" fill="#cfcaaf"/></g>`;
  add(`<g transform="translate(${cx | 0} ${cy | 0})">${g}</g>`);
}

// ── Margaritas ──
for (let p = 0; p < 18; p++) {
  const cx = rnd(15, W - 15), cy = rnd(GROUND + 50, H - 10);
  const sc = 0.45 + 0.95 * (cy / H);
  let g = '';
  for (let i = 0; i < 8; i++) {
    const ang = i * 45 + rnd(-8, 8);
    g += `<ellipse cx="0" cy="${(-3 * sc).toFixed(1)}" rx="${(1.1 * sc).toFixed(1)}" ry="${(3 * sc).toFixed(1)}" transform="rotate(${ang})" fill="#f0eee0"/>`;
  }
  g += `<circle r="${(1.7 * sc).toFixed(1)}" fill="#dfb23a"/>`;
  add(`<g transform="translate(${cx | 0} ${cy | 0})" opacity=".92">${g}</g>`);
}

// ── Cardos secos y matas altas ──
for (let p = 0; p < 12; p++) {
  const cx = rnd(15, W - 15), cy = rnd(GROUND + 90, H - 6);
  const sc = 0.5 + 1.0 * (cy / H);
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

// ── Piedras ──
for (let p = 0; p < 11; p++) {
  const cx = rnd(20, W - 20), cy = rnd(GROUND + 100, H - 10);
  const sc = 0.45 + 1.0 * (cy / H);
  const rx = rnd(5, 11) * sc, ry = rx * rnd(.55, .7);
  add(`<g transform="translate(${cx | 0} ${cy | 0}) rotate(${rnd(-10, 10).toFixed(0)})">
<ellipse cx="${(rx * .25).toFixed(1)}" cy="${(ry * .5).toFixed(1)}" rx="${(rx * 1.05).toFixed(1)}" ry="${(ry * .6).toFixed(1)}" fill="#1c2a10" opacity=".3"/>
<ellipse rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${pick(['#8d8a7e', '#94908a', '#827e72'])}"/>
<ellipse cx="${(-rx * .2).toFixed(1)}" cy="${(-ry * .3).toFixed(1)}" rx="${(rx * .55).toFixed(1)}" ry="${(ry * .45).toFixed(1)}" fill="#a5a196" opacity=".7"/>
</g>`);
}

// ── Seto: follaje menudo en bandas de luz ──
function hedgeHeight(x) { return 78 + 26 * Math.sin(x / 210) + 14 * Math.sin(x / 67 + 2); }
const hedgeDark = ['#1f3413', '#243d17', '#1b2e10'];
const hedgeMid = ['#2c481d', '#335322', '#2a431a'];
const hedgeLit = ['#3f6128', '#48702e', '#527c34', '#42662a'];
add(`<rect x="0" y="0" width="${W}" height="64" fill="#1d3011"/>`);
for (let x = -16; x < W + 16; x += 7) {
  const hh = hedgeHeight(x) + rnd(-6, 6);
  for (let yy = 4; yy < hh; yy += rnd(7, 12)) {
    const f = yy / hh;
    const c = f > .72 ? pick(hedgeDark) : f > .4 ? pick(hedgeMid) : pick(hedgeLit);
    add(`<circle cx="${(x + rnd(-5, 5)).toFixed(0)}" cy="${(yy + rnd(-3, 3)).toFixed(0)}" r="${rnd(4.5, 10).toFixed(1)}" fill="${c}" opacity="${rnd(.8, 1).toFixed(2)}"/>`);
  }
  if (Math.random() < .3) add(`<circle cx="${x}" cy="${(hedgeHeight(x) + rnd(2, 9)).toFixed(0)}" r="${rnd(3, 6).toFixed(1)}" fill="${pick(hedgeDark)}"/>`);
}
for (let k = 0; k < 130; k++) {
  const x = rnd(0, W), hh = hedgeHeight(x);
  add(`<circle cx="${x | 0}" cy="${rnd(2, hh * .5) | 0}" r="${rnd(2, 4.5).toFixed(1)}" fill="${pick(['#5d8a3c', '#558034'])}" opacity="${rnd(.5, .9).toFixed(2)}"/>`);
}

// ── Helechos delante del seto ──
for (let k = 0; k < 34; k++) {
  const cx = rnd(0, W), cy = rnd(GROUND - 14, GROUND + 8);
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

// ── Alambrado de espino: postes + 3 alambres combados con púas ──
const posts = [];
let px0 = rnd(70, 150);
while (px0 < W + 160) { posts.push(px0); px0 += rnd(260, 330); }
const wireHeights = [-78, -54, -28];

function wirePath(x1, x2, yAbs, sag) {
  const mx = (x1 + x2) / 2;
  return `M${x1.toFixed(0)} ${yAbs.toFixed(1)} Q${mx.toFixed(0)} ${(yAbs + sag).toFixed(1)} ${x2.toFixed(0)} ${yAbs.toFixed(1)}`;
}
const spans = [];
for (let i = -1; i < posts.length; i++) {
  const a = i < 0 ? -30 : posts[i];
  const b = i + 1 < posts.length ? posts[i + 1] : W + 30;
  if (b > a) spans.push([a, b]);
}
for (const wy of wireHeights) {
  const yAbs = GROUND + wy;
  for (const [a, b] of spans) {
    const sag = rnd(4, 8);
    add(`<path d="${wirePath(a, b, yAbs + 1.4, sag)}" stroke="#21251c" stroke-width="2.6" fill="none" opacity=".5"/>`);
    add(`<path d="${wirePath(a, b, yAbs, sag)}" stroke="#7d7a70" stroke-width="2" fill="none"/>`);
    add(`<path d="${wirePath(a, b, yAbs - .8, sag)}" stroke="#c4c0b2" stroke-width=".8" fill="none" opacity=".75"/>`);
    for (let bx = a + rnd(18, 40); bx < b - 12; bx += rnd(42, 64)) {
      const t = (bx - a) / (b - a);
      const by = yAbs + sag * 2 * t * (1 - t);
      add(`<g transform="translate(${bx.toFixed(0)} ${by.toFixed(1)}) rotate(${rnd(-12, 12).toFixed(0)})"><line x1="-3.4" y1="-3.4" x2="3.4" y2="3.4" stroke="#56524a" stroke-width="1.5"/><line x1="-3.4" y1="3.4" x2="3.4" y2="-3.4" stroke="#56524a" stroke-width="1.5"/></g>`);
    }
  }
}

for (const x of posts) {
  const ph = rnd(92, 110), pw = rnd(13, 16), tilt = rnd(-2.2, 2.2);
  add(`<g transform="translate(${x.toFixed(0)} ${GROUND + 3}) rotate(${tilt.toFixed(1)})">
<ellipse cx="5" cy="3" rx="${(pw * 1.5).toFixed(0)}" ry="5.5" fill="#16230c" opacity=".4"/>
<rect x="${(-pw / 2).toFixed(1)}" y="${-ph}" width="${pw}" height="${ph + 4}" rx="2" fill="#6b4f2e"/>
<rect x="${(-pw / 2).toFixed(1)}" y="${-ph}" width="${(pw * .3).toFixed(1)}" height="${ph + 4}" rx="2" fill="#7f6038" opacity=".9"/>
<rect x="${(pw / 2 - pw * .22).toFixed(1)}" y="${-ph}" width="${(pw * .22).toFixed(1)}" height="${ph + 4}" fill="#4d3820" opacity=".8"/>
<path d="M${(-pw * .12).toFixed(1)} ${-ph + 6} q2 ${ph * .3} -1 ${ph * .6} q-1 ${ph * .2} 1 ${ph * .36}" stroke="#553d22" stroke-width="1.1" fill="none" opacity=".8"/>
<path d="M${(pw * .2).toFixed(1)} ${-ph + 10} q-1.5 ${ph * .35} .5 ${ph * .7}" stroke="#553d22" stroke-width=".9" fill="none" opacity=".6"/>
${Math.random() < .5 ? `<circle cx="${rnd(-2, 2).toFixed(1)}" cy="${(-ph * rnd(.3, .7)).toFixed(0)}" r="2.1" fill="#503a20"/>` : ''}
<ellipse cx="0" cy="${-ph}" rx="${(pw / 2).toFixed(1)}" ry="2.6" fill="#8a6a42"/>
<ellipse cx="0" cy="${-ph}" rx="${(pw / 2 - 1.6).toFixed(1)}" ry="1.7" fill="#9d7c50"/>
</g>`);
  for (const wy of wireHeights)
    add(`<rect x="${(x - 2.6).toFixed(0)}" y="${(GROUND + wy - 2.6).toFixed(1)}" width="5.2" height="5.2" rx="1" fill="#4a463e"/>`);
}

// ── Luz ambiental: bandas diagonales suaves + viñeta ──
add(`<ellipse cx="${W * .3}" cy="${H * .45}" rx="${W * .42}" ry="${H * .3}" fill="#fff6c8" opacity=".045"/>`);
add(`<ellipse cx="${W * .82}" cy="${H * .75}" rx="${W * .3}" ry="${H * .22}" fill="#fff6c8" opacity=".035"/>`);
add(`<rect width="${W}" height="${H}" fill="#1a2a0e" opacity=".05"/>`);

add('</svg>');
const svg = out.join('\n');
fs.writeFileSync('bg.svg', svg);
console.log('bg.svg generado:', (svg.length / 1024).toFixed(0) + ' KB,', out.length, 'elementos');
