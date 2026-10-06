// Bouwt Meettool.html: voegt sjabloon, CSS en JavaScript samen tot één zelfstandig bestand.
// Gebruik: node build.js
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const JS_BESTANDEN = [
  'versie.js',
  'hulpfuncties.js',
  'opslag.js',
  'model.js',
  'berekeningen.js',
  'knelpunten.js',
  'steekproeven.js',
  'xlsx.js',
  'grafiek.js',
  'demo.js',
  'ui-algemeen.js',
  'ui-processen.js',
  'ui-steekproeven.js',
  'ui-meting.js',
  'ui-frequentie.js',
  'ui-overzicht.js',
  'ui-resultaten.js',
  'ui-import-export.js',
  'main.js',
];

const lees = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const versieBron = lees('versie.js');
const versie = (versieBron.match(/VERSIE\s*=\s*'([^']+)'/) || [])[1];
if (!versie) throw new Error('Versienummer niet gevonden in src/versie.js');

const script =
  '(function () {\n\'use strict\';\n' +
  JS_BESTANDEN.map((f) => `// ===== ${f} =====\n${lees(f)}`).join('\n') +
  '\n})();';

if (/<\/script/i.test(script)) throw new Error('JavaScript bevat "</script", dit breekt het HTML-bestand.');

const vandaag = new Date().toISOString().slice(0, 10);
const html = lees('template.html')
  .replace('{{VERSIE}}', versie)
  .replace('{{BOUWDATUM}}', vandaag)
  .replace('{{STIJL}}', () => lees('stijl.css'))
  .replace('{{BODY}}', () => lees('body.html'))
  .replace('{{SCRIPT}}', () => script);

if (/(src|href)\s*=\s*["']https?:/i.test(html)) throw new Error('Externe verwijzing gevonden in de uitvoer.');

fs.writeFileSync(path.join(__dirname, 'Meettool.html'), html);
console.log(`Meettool.html gebouwd (versie ${versie}, ${(html.length / 1024).toFixed(0)} kB)`);
