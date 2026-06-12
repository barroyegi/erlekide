#!/usr/bin/env node
// SVG cleaner: strips Inkscape/Sodipodi metadata, DarkReader artifacts, unused IDs
// Usage: node clean-svg.js
'use strict';
const fs = require('fs');

function clean(src) {
  let s = src;

  // 1. Remove XML declaration
  s = s.replace(/^<\?xml[^?]*\?>\s*/m, '');

  // 2. Remove sodipodi:namedview block (self-closing, multi-line)
  s = s.replace(/\s*<sodipodi:namedview[\s\S]*?\/>/g, '');

  // 3. Strip Inkscape/Sodipodi namespace declarations from root <svg>
  s = s.replace(/\s+xmlns:inkscape="[^"]*"/g, '');
  s = s.replace(/\s+xmlns:sodipodi="[^"]*"/g, '');
  s = s.replace(/\s+xmlns:svg="[^"]*"/g, '');  // redundant alias

  // 4. Strip all inkscape:* and sodipodi:* attributes from any element
  // Attributes may span one line: inkscape:foo="bar"
  s = s.replace(/\s+inkscape:[a-zA-Z_-]+=(?:"[^"]*"|'[^']*')/g, '');
  s = s.replace(/\s+sodipodi:[a-zA-Z_-]+=(?:"[^"]*"|'[^']*')/g, '');

  // 5. Strip DarkReader browser-extension attributes
  s = s.replace(/\s+data-darkreader-[a-zA-Z_-]+=(?:"[^"]*"|'[^']*'|="")/g, '');

  // 6. Strip class="img-fluid" (Bootstrap class not used in this project)
  s = s.replace(/\s+class="img-fluid"/g, '');

  // 7. Strip empty <defs> elements
  s = s.replace(/\s*<defs[^>]*\/>\s*/g, '\n');
  s = s.replace(/\s*<defs[^>]*>\s*<\/defs>\s*/g, '\n');

  // 8. Strip id attributes — SVGs are loaded as <img>, so internal IDs are
  //    inaccessible from the parent document; none are referenced by JS or CSS.
  s = s.replace(/\s+id="[^"]*"/g, '');

  // 9. Collapse runs of 3+ blank lines to 2
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim() + '\n';
}

const targets = [
  'public/images/kaja.svg',
  'public/images/nukleoa.svg',
];

for (const f of targets) {
  const orig = fs.readFileSync(f, 'utf8');
  const cleaned = clean(orig);
  const out = f.replace('.svg', '-clean.svg');
  fs.writeFileSync(out, cleaned, 'utf8');

  const pct = Math.round((1 - cleaned.length / orig.length) * 100);
  console.log(`${f.split('/').pop()}: ${(orig.length / 1024).toFixed(0)} KB → ${(cleaned.length / 1024).toFixed(0)} KB  (−${pct}%)`);
  console.log(`  → ${out}`);
}
console.log('icon.svg: already minimal, skipped.');
