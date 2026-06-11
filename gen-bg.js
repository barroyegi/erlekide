// Genera un fondo de campo procedural coherente con la vista frontal de las colmenas:
// suelo de hierba con perspectiva (franjas que crecen hacia abajo, matas más grandes cerca),
// seto frontal y postes de valla arriba. Salida: bg.svg (se rasteriza con Edge headless).
'use strict';
const fs = require('fs');

const W = 1600, H = 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;

// ── Suelo base: más claro al fondo (lejos), más saturado cerca ──
s += `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#86a554"/><stop offset="0.25" stop-color="#74963f"/>
<stop offset="1" stop-color="#5d7c33"/></linearGradient></defs>`;
s += `<rect width="${W}" height="${H}" fill="url(#g)"/>`;

// ── Franjas de siega con perspectiva: estrechas lejos, anchas cerca ──
let y = 118, bh = 30, i = 0;
while (y < H + 200) {
  if (i % 2 === 0) s += `<rect x="0" y="${y.toFixed(0)}" width="${W}" height="${bh.toFixed(0)}" fill="#000" opacity="0.045"/>`;
  y += bh; bh *= 1.22; i++;
}

// ── Manchas orgánicas grandes muy sutiles ──
for (let k = 0; k < 14; k++) {
  const cy = rnd(160, H);
  const sc = 0.4 + 0.8 * (cy / H);
  s += `<ellipse cx="${rnd(0, W).toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(rnd(90, 220) * sc).toFixed(0)}" ry="${(rnd(40, 90) * sc).toFixed(0)}" fill="${pick(['#4e6b2a', '#83a352', '#6d8d3d'])}" opacity="${rnd(.06, .13).toFixed(2)}"/>`;
}

// ── Matas de hierba: tamaño según cercanía (perspectiva) ──
const greens = ['#4e6b2a', '#557334', '#46622a', '#62823a'];
for (let k = 0; k < 320; k++) {
  const cy = rnd(140, H - 4);
  const cx = rnd(0, W);
  const sc = (0.35 + 1.05 * ((cy - 140) / (H - 140))) * rnd(.8, 1.2);
  const c = pick(greens);
  let tuft = '';
  const blades = 3 + Math.floor(rnd(0, 3));
  for (let b = 0; b < blades; b++) {
    const bx = (b - blades / 2) * 5;
    const hgt = rnd(10, 17), lean = rnd(-4, 4);
    tuft += `<path d="M${bx} 0 Q${bx + lean} ${-hgt * .6} ${bx + lean * 1.6} ${-hgt} Q${bx + lean + 2.2} ${-hgt * .5} ${bx + 3.5} 0 Z" fill="${c}"/>`;
  }
  s += `<g transform="translate(${cx.toFixed(0)} ${cy.toFixed(0)}) scale(${sc.toFixed(2)})" opacity="${rnd(.55, .9).toFixed(2)}">${tuft}</g>`;
}

// ── Florecillas dispersas ──
for (let k = 0; k < 26; k++) {
  const cy = rnd(200, H);
  const sc = 0.5 + 0.8 * (cy / H);
  const col = pick(['#f4eecf', '#f4eecf', '#e8c54a', '#d8e0f2']);
  s += `<circle cx="${rnd(0, W).toFixed(0)}" cy="${cy.toFixed(0)}" r="${(rnd(2.2, 3.6) * sc).toFixed(1)}" fill="${col}" opacity=".85"/>`;
  s += `<circle cx="${(rnd(0, W)).toFixed(0)}" cy="${(cy + rnd(-30, 30)).toFixed(0)}" r="${(rnd(1.6, 2.6) * sc).toFixed(1)}" fill="${col}" opacity=".6"/>`;
}

// ── Seto al fondo (vista frontal, como las colmenas) ──
const hedge = ['#2e481c', '#3a5a24', '#44682b', '#33511f'];
for (let x = -40; x < W + 40; x += rnd(34, 56)) {
  const ry = rnd(34, 58), cy = rnd(42, 78);
  s += `<ellipse cx="${x.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rnd(38, 62).toFixed(0)}" ry="${ry.toFixed(0)}" fill="${pick(hedge)}"/>`;
}
for (let x = -40; x < W + 40; x += rnd(26, 46)) {
  s += `<ellipse cx="${x.toFixed(0)}" cy="${rnd(20, 50).toFixed(0)}" rx="${rnd(26, 44).toFixed(0)}" ry="${rnd(22, 38).toFixed(0)}" fill="${pick(hedge)}" opacity=".9"/>`;
}
// helechos sueltos delante del seto
for (let k = 0; k < 60; k++) {
  const cx = rnd(0, W), cy = rnd(86, 118);
  let fr = '';
  for (let b = 0; b < 5; b++) {
    const ang = -90 + (b - 2) * 22, len = rnd(14, 26);
    const rad = ang * Math.PI / 180;
    fr += `<line x1="0" y1="0" x2="${(Math.cos(rad) * len).toFixed(1)}" y2="${(Math.sin(rad) * len).toFixed(1)}" stroke="${pick(['#3f6126', '#4c7330'])}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  s += `<g transform="translate(${cx.toFixed(0)} ${cy.toFixed(0)})">${fr}</g>`;
}

// ── Valla: alambres y postes frontales ──
s += `<line x1="0" y1="58" x2="${W}" y2="58" stroke="#4a4540" stroke-width="2" opacity=".55"/>`;
s += `<line x1="0" y1="86" x2="${W}" y2="86" stroke="#4a4540" stroke-width="2" opacity=".55"/>`;
for (let x = 90; x < W; x += rnd(240, 330)) {
  const ph = rnd(72, 86), pw = rnd(11, 14), py = 118 - ph;
  s += `<rect x="${x.toFixed(0)}" y="${py.toFixed(0)}" width="${pw.toFixed(0)}" height="${ph.toFixed(0)}" rx="2" fill="#6e5233" stroke="#46321c" stroke-width="2"/>`;
  s += `<ellipse cx="${(x + pw / 2).toFixed(0)}" cy="${py.toFixed(0)}" rx="${(pw / 2).toFixed(0)}" ry="3" fill="#8a6b44"/>`;
  s += `<ellipse cx="${(x + pw / 2).toFixed(0)}" cy="121" rx="${(pw * 1.1).toFixed(0)}" ry="4" fill="#1e2a0e" opacity=".4"/>`;
}

// ── Sombra del seto sobre la hierba (ancla el fondo al suelo) ──
s += `<rect x="0" y="112" width="${W}" height="26" fill="#1e2a0e" opacity=".18"/>`;
s += `<rect x="0" y="112" width="${W}" height="10" fill="#1e2a0e" opacity=".16"/>`;

s += '</svg>';
fs.writeFileSync('bg.svg', s);
console.log('bg.svg generado:', (s.length / 1024).toFixed(0) + ' KB');
