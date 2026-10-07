// Controletests voor meettool-pr24-eenvoudig.html. Offline via file://, in Nederlandse tijd.
// Gebruik: node tests/eenvoudigtest.js   (vereist Playwright en python3 met openpyxl; de tool zelf niet)
//
// Controlevoorbeeld LEV – augustus 2026: 30 nieuw, 14 aangeleverd, 5 verwerkt.
// Dossiers: D01 19 regels/2 blokken/volledig/2 Visma; D02 20/3/volledig/3; D03 50/5/gedeeltelijk/2; D04 51/6/nog niet;
//           D05 100/10/nog niet; D06 101/–/onbekend; D07 –/4/nog niet (later 30 regels → 371 regels, n = 7, gem. 53).
//   → eerst regels 341 (n = 6), gem. 56,83; blokken 30 (n = 6), gem. 5; Visma 7 (n = 3); resterend 0+0+3+6+10+4 = 23 (D06 onbekend).
//
// Tijd per dossier (LEV – oktober 2026): D01 19 regels (Klein), 2 verwacht/3 Visma, volledig verwerkt → 3 blokken (werkelijk);
//   D02 30 (Middel), 4 verwacht, nog niet verwerkt → 4; D03 60 (Groot), 6 verwacht/2 Visma, gedeeltelijk → 6 (verwacht);
//   D04 120 (Zeer groot), 10 verwacht, volledig verwerkt → eerst Visma leeg (onvoldoende gegevens), daarna 8.
// Tijden: S01 2 en S09 1 per dossier; S02/S03/S07 per klasse (Klein 5/3/1, Middel 10/6/2, Groot 20/12/3, Zeer groot 30/20/4;
//   wacht S02 Groot 15); S04 1,5 (+0,5 wacht), S05 1, S06 0,5, S08 0,5 per blok (samen 3,5 per blok).
//   D01 = 3 + 9 + 3,5×3 = 22,5; D02 = 3 + 18 + 14 = 35; D03 = 3 + 35 + 21 = 59; D04 = 3 + 54 + 28 = 85 → 201,5 (gem. 50,375).
//   Wacht: 1,5 + 2 + 18 + 4 = 25,5. Met S03 inbegrepen bij S02: 201,5 − 41 = 160,5.
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HTML = path.resolve(__dirname, '..', 'meettool-pr24-eenvoudig.html');
const UIT = path.resolve(process.env.TEST_UITVOER || path.join(__dirname, 'uitvoer'));
fs.mkdirSync(UIT, { recursive: true });
const SLEUTEL = 'meettool-pr24-eenvoudig';
const bijna = (a, b) => Math.abs(a - b) < 1e-9;
function ok(stap, tekst) { console.log(`✔ ${stap}: ${tekst}`); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PAD ? { executablePath: process.env.CHROMIUM_PAD } : {});
  const netwerk = [];
  const fouten = [];
  const nieuweContext = async () => {
    const c = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 }, timezoneId: 'Europe/Amsterdam', locale: 'nl-NL' });
    await c.setOffline(true);
    c.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) netwerk.push(r.url()); });
    const p = await c.newPage();
    p.on('pageerror', (e) => fouten.push('pageerror: ' + e.message));
    await p.goto('file://' + HTML);
    await p.waitForFunction(() => window.__pr24 && window.__pr24.klaar);
    return { c, p };
  };
  let { c: ctx, p: page } = await nieuweContext();
  const knop = (label) => page.click(`#dialoogKnoppen button:text-is("${label}")`);
  const metingen = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pr24.staat().metingen)));
  const bereken = (id) => page.evaluate((x) => JSON.parse(JSON.stringify(window.__pr24.bereken(window.__pr24.staat().metingen.find((m) => m.id === x)), (k, v) => (k === 'meting' ? undefined : v))), id);
  const kies = async (b, m, j) => { await page.selectOption('#bestuur', b); await page.selectOption('#maand', String(m)); await page.selectOption('#jaar', String(j)); };
  const stap = (n) => page.click(`#voortgang [data-ga="${n}"]`);
  const tekst = (sel) => page.textContent(sel);

  // Bestaande gegevens van andere tools in dezelfde browser mogen niet veranderen.
  await page.evaluate(() => {
    localStorage.setItem('meettool-pr24-maandmetingen', '{"bestaand":"maanddashboard"}');
    localStorage.setItem('meettool-veiligheidsbackup', '{"bestaand":true}');
  });
  const anderen = () => page.evaluate((k) => Object.fromEntries(Object.keys(localStorage).filter((x) => x !== k).sort().map((x) => [x, localStorage.getItem(x)])), SLEUTEL);
  const anderenVoor = await anderen();

  // ---------- Navigatie ----------
  assert.deepStrictEqual(await page.$$eval('#voortgang button', (b) => b.map((x) => x.textContent.trim())), ['1Bestuur en maand', '2Volume en frequentie', '3Dossiers', '4Processtappen en tijd', '5Resultaat en export']);
  assert.strictEqual(await page.$$eval('section[data-stap]:not([hidden])', (s) => s.length), 1, 'één onderdeel tegelijk');
  for (const oud of ['Steekproeven', 'Nieuwe procesmeting', 'Metingen bekijken', 'Processen']) assert.ok(!(await tekst('body')).includes(oud), 'geen oud onderdeel: ' + oud);
  await kies('LEV', 8, 2026);
  assert.strictEqual(await tekst('#keuzeLabel'), 'PR24 – LEV – augustus 2026');
  assert.strictEqual(await page.evaluate((k) => localStorage.getItem(k), SLEUTEL), null, 'niets automatisch opgeslagen');
  await page.click('#knopVolgende');
  assert.ok((await tekst('section[data-stap="2"]')).includes('Er is nog geen maandmeting'));
  await page.click('#knopVorige');
  await page.click('#knopNieuw');
  assert.ok(await page.isVisible('#nieuwe'), 'na aanmaken direct naar stap 2');
  ok('navigatie', 'Vijf stappen met voortgangsindicator, één onderdeel tegelijk, Vorige/Volgende; geen oude onderdelen; maandmeting pas na "Nieuwe maandmeting"');

  // ---------- 3. Validatie en 10. LEV-voorbeeld ----------
  await page.fill('#nieuwe', '30');
  await page.fill('#aangeleverd', '31');
  assert.ok((await tekst('#fouten2')).includes('Aangeleverd (31) mag niet hoger zijn dan het aantal nieuwe medewerkers (30)'));
  assert.strictEqual((await metingen())[0].aangeleverd, null, 'ongeldig niet opgeslagen');
  await page.fill('#aangeleverd', '14');
  await page.fill('#verwerkt', '15');
  assert.ok((await tekst('#fouten2')).includes('Verwerkt (15) mag niet hoger zijn dan aangeleverd (14)'));
  for (const v of ['-1', '2,5', 'x']) { await page.fill('#verwerkt', v); assert.ok((await tekst('#fouten2')).includes('geheel getal'), v); }
  await page.fill('#verwerkt', '5');
  await page.fill('#bron', 'Maandrapportage (fictief)');
  assert.strictEqual(await tekst('#fouten2'), '');
  let b = await bereken('PR24-LEV-2026-08');
  assert.deepStrictEqual([b.freq.geenOpgave, b.freq.nogTeVerwerken], [16, 9]);
  assert.ok(bijna(b.freq.aanleverPct.waarde, 1400 / 30) && bijna(b.freq.verwerkingsPct.waarde, 500 / 14) && bijna(b.freq.verwerktVanNieuwePct.waarde, 500 / 30));
  const freq = await tekst('#resultaat2');
  for (const w of ['16', '9', '46,7%', '35,7%', '16,7%']) assert.ok(freq.includes(w), w);
  ok('3 validatie', 'Aangeleverd 31 > 30 en verwerkt 15 > 14 geven een melding en worden niet opgeslagen; negatief, decimaal en tekst geweigerd');
  ok('10 LEV-voorbeeld', '30 / 14 / 5 → geen opgave 16, nog te verwerken 9, aanleverpercentage 46,7%, verwerkingspercentage 35,7%, verwerkt van alle nieuwe medewerkers 16,7%');

  // ---------- 1 en 2. Besturen en maanden gescheiden ----------
  await stap(1);
  await kies('SAMANAS', 8, 2026);
  assert.ok(!(await page.isEnabled('#knopVerwijderen')) && (await tekst('#keuzeStatus')).includes('Nog niet aangemaakt'));
  await page.click('#knopNieuw');
  await page.fill('#nieuwe', '0');
  await page.fill('#aangeleverd', '0');
  b = await bereken('PR24-SAMANAS-2026-08');
  assert.ok(b.freq.geenOpgave === 0 && b.freq.aanleverPct.reden === 'niet te berekenen (deler is 0)' && b.freq.nogTeVerwerken === null, 'deler 0 en ontbrekend verwerkt');
  assert.ok((await tekst('#resultaat2')).includes('niet te berekenen (deler is 0)') && (await tekst('#resultaat2')).includes('niet ingevuld'));
  await stap(1);
  await kies('LEV', 9, 2026);
  await page.click('#knopNieuw');
  await page.fill('#nieuwe', '12');
  await stap(1);
  await kies('LEV', 8, 2026);
  await stap(2);
  assert.strictEqual(await page.inputValue('#nieuwe'), '30');
  const opgeslagen = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).metingen.map((m) => [m.id, m.nieuwe]), SLEUTEL);
  assert.deepStrictEqual(opgeslagen, [['PR24-LEV-2026-08', 30], ['PR24-SAMANAS-2026-08', 0], ['PR24-LEV-2026-09', 12]]);
  ok('1 en 2 gescheiden', 'LEV en SAMANAS (augustus) en LEV september zijn afzonderlijke maandmetingen; 0 is een echte waarde, "niet ingevuld" en "deler 0" worden apart getoond');

  // ---------- 4, 5 en 6. Dossiers, complexiteit en gemiddelden ----------
  await stap(3);
  assert.ok((await tekst('section[data-stap="3"]')).includes('nooit een naam, personeelsnummer, BSN'));
  const dossiers = [['19', '2', 'Volledig verwerkt', '2'], ['20', '3', 'Volledig verwerkt', '3'], ['50', '5', 'Gedeeltelijk verwerkt', '2'], ['51', '6', 'Nog niet verwerkt', ''],
    ['100', '10', 'Nog niet verwerkt', ''], ['101', '', 'Status onbekend', ''], ['', '4', 'Nog niet verwerkt', '']];
  for (const [i, [r, bl, st, v]] of dossiers.entries()) {
    await page.click('#knopDossier');
    const rij = `#dossierTabel tr[data-i="${i}"]`;
    assert.strictEqual(await page.inputValue(`${rij} [data-d="code"]`), `LEV-2026-08-D0${i + 1}`);
    if (r) await page.fill(`${rij} [data-d="regels"]`, r);
    if (bl) await page.fill(`${rij} [data-d="blokken"]`, bl);
    await page.selectOption(`${rij} [data-d="status"]`, st);
    if (v) await page.fill(`${rij} [data-d="visma"]`, v);
  }
  const klassen = await page.$$eval('#dossierTabel [data-klasse]', (c) => c.map((x) => x.textContent.trim()));
  assert.deepStrictEqual(klassen, ['Klein', 'Middel', 'Middel', 'Groot', 'Groot', 'Zeer groot', 'niet ingevuld']);
  assert.deepStrictEqual(await page.evaluate(() => [0, 1, 19, 20, 50, 51, 100, 101, null].map(window.__pr24.klasse)), [null, 'Klein', 'Klein', 'Middel', 'Middel', 'Groot', 'Groot', 'Zeer groot', null]);
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="regels"]', '0');
  assert.ok((await tekst('#fouten3')).includes('0 is niet geldig'));
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="regels"]', '');
  b = await bereken('PR24-LEV-2026-08');
  const d = b.dos;
  assert.deepStrictEqual([d.aantal, d.perKlasse, d.zonderKlasse], [7, { Klein: 1, Middel: 2, Groot: 2, 'Zeer groot': 1 }, ['LEV-2026-08-D07']]);
  assert.deepStrictEqual([d.regels.totaal, d.regels.n, d.blokken.totaal, d.blokken.n, d.blokken.gemiddelde, d.visma.totaal, d.visma.n], [341, 6, 30, 6, 5, 7, 3]);
  assert.ok(bijna(d.regels.gemiddelde, 341 / 6));
  assert.deepStrictEqual([d.perStatus['Volledig verwerkt'], d.perStatus['Nog niet verwerkt'], d.resterend.totaal, d.resterend.onbekend], [2, 3, 23, ['LEV-2026-08-D06']]);
  const res3 = await tekst('#resultaat3');
  assert.ok(res3.includes('Er zijn 7 dossiers geregistreerd, maar 14 diensttijdopgaven aangeleverd') && res3.includes('56,83') && res3.includes('gebaseerd op 6 van 7 dossiers'), res3);
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="code"]', '123456789');
  assert.ok((await tekst('#fouten3')).includes('lijkt op een echt nummer'));
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="code"]', 'LEV-2026-08-D01');
  assert.ok((await tekst('#fouten3')).includes('komt al voor'));
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="code"]', 'LEV-2026-08-D07');
  ok('4 complexiteit', '19 Klein; 20 en 50 Middel; 51 en 100 Groot; 101 Zeer groot; 0 is ongeldig; leeg = niet ingevuld');
  ok('5 lege waarden', 'Lege regels, blokken en Visma-regels tellen niet als 0: totalen 341 regels (6 dossiers), 30 blokken (6), 7 Visma-regels (3); resterend 23 met D06 als onbekend');
  ok('6 gemiddelde met n', 'Gemiddeld 56,83 regels en 5 blokken, met "gebaseerd op 6 van 7 dossiers"; waarschuwing 7 dossiers ≠ 14 aangeleverd zonder blokkade; dubbele en BSN-achtige code afgevangen');

  // ---------- 7, 8 en 9. Tijd per dossier ----------
  // Aparte maandmeting met vier dossiers (zie de berekening bovenaan dit bestand).
  await stap(1);
  await kies('LEV', 10, 2026);
  await page.click('#knopNieuw');
  await page.fill('#nieuwe', '30');
  await page.fill('#aangeleverd', '14');
  await page.fill('#verwerkt', '5');
  await stap(3);
  for (const [i, [r, bl, st, v]] of [['19', '2', 'Volledig verwerkt', '3'], ['30', '4', 'Nog niet verwerkt', ''], ['60', '6', 'Gedeeltelijk verwerkt', '2'], ['120', '10', 'Volledig verwerkt', '']].entries()) {
    await page.click('#knopDossier');
    const rij = `#dossierTabel tr[data-i="${i}"]`;
    await page.fill(`${rij} [data-d="regels"]`, r);
    await page.fill(`${rij} [data-d="blokken"]`, bl);
    await page.selectOption(`${rij} [data-d="status"]`, st);
    if (v) await page.fill(`${rij} [data-d="visma"]`, v);
  }
  await stap(4);
  const rij = (s) => `#stapTabel tr[data-stap="PR24-${s}"]`;
  const eenheden = await page.$$eval('#stapTabel tr[data-stap] td:nth-child(2)', (c) => c.map((x) => x.textContent.trim()));
  assert.deepStrictEqual(eenheden, ['Per dossier', 'Per complexiteitsklasse', 'Per complexiteitsklasse', 'Per diensttijdblok', 'Per diensttijdblok', 'Per diensttijdblok', 'Per complexiteitsklasse', 'Per diensttijdblok', 'Per dossier']);
  assert.strictEqual(await page.$$eval('#stapTabel select[data-s="eenheid"]', (x) => x.length), 0, 'rekeneenheid vast');
  const stapTekst = await tekst('#stapTabel');
  assert.ok(stapTekst.includes('Bepalen welke arbeidsverhoudingen relevant zijn.') && stapTekst.includes('Bepalen hoe relevante perioden door aansluitingen, onderbrekingen en overlap tot diensttijdblokken worden gevormd.'));
  const vul = async (s, actief, wacht, meetwijze = 'Daadwerkelijk gemeten') => {
    await page.fill(`${rij(s)} [data-s="actief"]`, actief);
    await page.fill(`${rij(s)} [data-s="wacht"]`, wacht);
    await page.selectOption(`${rij(s)} [data-s="meetwijze"]`, meetwijze);
  };
  const vulKlassen = async (s, waarden, meetwijze = 'Daadwerkelijk gemeten') => {
    await page.click(`[data-klassen-toggle="PR24-${s}"]`);
    for (const [k, [a, w]] of Object.entries(waarden)) {
      await page.fill(`tr[data-klassen-voor="PR24-${s}"] [data-klasse-actief="${k}"]`, a);
      await page.fill(`tr[data-klassen-voor="PR24-${s}"] [data-klasse-wacht="${k}"]`, w);
    }
    await page.selectOption(`${rij(s)} [data-s="meetwijze"]`, meetwijze);
  };
  await vul('S01', '2', '0');
  await vulKlassen('S02', { Klein: ['5', '0'], Middel: ['10', '0'], Groot: ['20', '15'] }, 'Geschat door medewerker');
  b = await bereken('PR24-LEV-2026-10');
  const s02D04 = b.dossiers[3].stappen[1];
  assert.ok(s02D04.actief === null && s02D04.redenen.some((x) => x.includes('actieve tijd (Zeer groot) niet ingevuld')), JSON.stringify(s02D04.redenen));
  assert.strictEqual(b.perStap[1].actief.waarde, null, 'S02 onvolledig zolang Zeer groot leeg is');
  assert.strictEqual(b.perStap[1].actief.deelsom, 35, 'deelsom 5 + 10 + 20');
  await page.fill('tr[data-klassen-voor="PR24-S02"] [data-klasse-actief="Zeer groot"]', '30');
  await page.fill('tr[data-klassen-voor="PR24-S02"] [data-klasse-wacht="Zeer groot"]', '0');
  await vulKlassen('S03', { Klein: ['3', '0'], Middel: ['6', '0'], Groot: ['12', '0'], 'Zeer groot': ['20', '0'] });
  await vulKlassen('S07', { Klein: ['1', '0'], Middel: ['2', '0'], Groot: ['3', '0'], 'Zeer groot': ['4', '0'] });
  for (const [s, a, w] of [['S04', '1,5', '0,5'], ['S05', '1', '0'], ['S06', '0,5', '0'], ['S08', '0,5', '0'], ['S09', '1', '0']]) await vul(s, a, w);
  b = await bereken('PR24-LEV-2026-10');
  assert.deepStrictEqual(b.perStap[1].stap.klasseActief, { Klein: 5, Middel: 10, Groot: 20, 'Zeer groot': 30 });
  assert.deepStrictEqual(b.dossiers.map((x) => x.stappen[1].actief), [5, 10, 20, 30], 'S02: tijd van de klasse van het dossier');
  ok('7 per klasse', 'S02, S03 en S07 rekenen met de tijd van de automatisch bepaalde klasse (S02: Klein 5, Middel 10, Groot 20, Zeer groot 30); een ontbrekende klassetijd geeft "onvoldoende gegevens" (deelsom 35) in plaats van 0; afbakening S02/S03 zichtbaar');

  // Blokken: werkelijk aantal bij volledig verwerkt, anders verwacht; D04 (volledig verwerkt, Visma leeg) = onvoldoende gegevens.
  assert.deepStrictEqual(b.dossiers.map((x) => [x.blokken.n, x.blokken.bron]), [[3, 'werkelijk (Visma)'], [4, 'verwacht'], [6, 'verwacht'], [null, 'werkelijk (Visma)']]);
  assert.deepStrictEqual(b.dossiers.map((x) => x.stappen[3].actief), [4.5, 6, 9, null], 'S04 1,5 × 3 werkelijk (niet 2 verwacht), × 4, × 6 verwacht (niet 2 Visma)');
  assert.deepStrictEqual(b.dossiers.map((x) => x.actief.waarde), [22.5, 35, 59, null]);
  assert.deepStrictEqual([b.tijd.actief.waarde, b.tijd.actief.deelsom, b.tijd.actief.nBekend, b.tijd.actief.n], [null, 116.5, 3, 4]);
  assert.ok(bijna(b.tijd.actief.gemiddelde, 116.5 / 3));
  await stap(3);
  await page.fill('#dossierTabel tr[data-i="3"] [data-d="visma"]', '8');
  b = await bereken('PR24-LEV-2026-10');
  assert.deepStrictEqual(b.dossiers.map((x) => x.actief.waarde), [22.5, 35, 59, 85]);
  assert.deepStrictEqual(b.dossiers.map((x) => x.wacht.waarde), [1.5, 2, 18, 4]);
  assert.deepStrictEqual([b.tijd.actief.waarde, b.tijd.actief.gemiddelde, b.tijd.wacht.waarde, b.tijd.verwerkt.waarde, b.tijd.nogTeVerwerken.waarde], [201.5, 50.375, 25.5, 107.5, 94]);
  assert.deepStrictEqual(b.perStap.map((r) => r.actief.waarde), [8, 65, 41, 31.5, 21, 10.5, 10, 10.5, 4]);
  assert.deepStrictEqual(b.perKlasseTijd.map((k) => [k.klasse, k.aantal, k.actief.waarde]), [['Klein', 1, 22.5], ['Middel', 1, 35], ['Groot', 1, 59], ['Zeer groot', 1, 85]]);
  assert.deepStrictEqual(b.hoogste, ['PR24-S02', 'PR24-S03', 'PR24-S04']);
  assert.ok(b.schatting);
  const d03 = b.dossiers[2];
  assert.strictEqual(await page.evaluate(() => window.__pr24.bereken(window.__pr24.staat().metingen.find((m) => m.id === 'PR24-LEV-2026-10')).dossiers[2].stappen[3].formule('actief')), '1,50 min × 6 blokken (verwacht) = 9,00 min');
  assert.ok(d03.herkomst.includes('8 gemeten, 1 geschatte'), d03.herkomst);
  ok('8 per dossier en per blok', 'Per dossier: 2 min één keer; per blok: volledig verwerkt met het werkelijke aantal (D01: 1,5 × 3 Visma = 4,5, niet × 2 verwacht), anders het verwachte aantal (D03: 1,5 × 6 = 9, niet × 2 Visma); ontbrekend Visma-aantal = onvoldoende gegevens; dossiers 22,5 + 35 + 59 + 85 = 201,5 min, gemiddeld 50,38; wacht 25,5; per stap en per klasse correct; meeste tijd S02, S03, S04');

  await stap(4);
  await page.selectOption(`${rij('S04')} [data-s="knelpunt"]`, 'ja');
  await page.fill(`${rij('S04')} [data-s="toelichting"]`, 'Visma traag bij opslaan');
  await page.check(`${rij('S03')} [data-s="inbegrepen"]`);
  assert.ok((await tekst('#fouten4')).includes('niet gekozen bij welke stap'));
  await page.selectOption(`${rij('S03')} [data-s="inbegrepenBij"]`, 'PR24-S02');
  b = await bereken('PR24-LEV-2026-10');
  assert.deepStrictEqual([b.tijd.actief.waarde, b.dossiers.map((x) => x.actief.waarde)], [160.5, [19.5, 29, 47, 65]]);
  assert.ok(b.perStap[2].inbegrepen && b.perStap[2].actief.deelsom === 41, 'S03 blijft zichtbaar met eigen waarde');
  assert.deepStrictEqual(b.hoogste, ['PR24-S02', 'PR24-S04', 'PR24-S05']);
  ok('9 geen dubbeltelling', 'Met S03 201,5 min; na "S03 inbegrepen bij S02" 160,5 min (41 min minder); S03 blijft zichtbaar; waarschuwing zolang geen stap gekozen is');

  // ---------- Resultaat ----------
  await page.click('#knopVolgende');
  const res = await tekst('#resultaat5');
  for (const w of ['Gemiddelde actieve tijd per dossier', '40,13 min', 'Totale actieve tijd alle dossiers', '160,50 min', '2 uur 41 min', 'Tijd per processtap', 'Tijd per complexiteitsklasse', 'Tijd per dossier', 'Tijd per bestuur en maand',
    'PR24 – LEV – oktober 2026', 'Visma traag bij opslaan', 'n.v.t. (inbegrepen bij PR24-S02)', '3 werkelijk (Visma)', '6 verwacht', 'berekend uit 7 gemeten, 1 geschatte staptijden']) assert.ok(res.includes(w), w);
  assert.deepStrictEqual(await page.$$eval('#resultaatStappen tbody tr', (r) => r.map((x) => x.querySelector('.mono').textContent)), ['PR24-S01', 'PR24-S02', 'PR24-S03', 'PR24-S04', 'PR24-S05', 'PR24-S06', 'PR24-S07', 'PR24-S08', 'PR24-S09'], 'oorspronkelijke volgorde');
  assert.strictEqual(await page.$$eval('#resultaatStappen .label-hoog', (x) => x.length), 3);
  await page.click('[data-dossier-detail="2"]');
  const detail = await tekst('tr[data-detail="2"]');
  assert.ok(detail.includes('klasse Groot') && detail.includes('6 blokken (verwacht)') && detail.includes('1,50 min × 6 blokken (verwacht) = 9,00 min') && detail.includes('geschat'), detail);
  const maanden = await page.$$eval('#resultaatMaanden tbody tr', (r) => r.map((x) => [...x.cells].map((c) => c.textContent.trim()).join(' | ')));
  assert.ok(maanden.includes('PR24 – LEV – oktober 2026 | 4 | 160,50 | 40,13 | 25,50'), maanden.join(' || '));
  assert.ok(maanden.some((r) => r.startsWith('PR24 – LEV – augustus 2026 | 7 | onvoldoende gegevens')), 'andere maanden ook zichtbaar; onvolledige tijd niet als 0');
  await page.screenshot({ path: path.join(UIT, 'scherm_pr24_eenvoudig.png'), fullPage: true });
  ok('resultaat', 'Dashboard: gemiddelde (40,13) en totale tijd (160,50 min) per dossier, tijd per stap (volgorde behouden, 3 hoogste gemarkeerd), per klasse, per dossier (met gebruikte blokken, herkomst en details per stap), per bestuur en maand, en knelpunten');

  // ---------- 11. Export en import ----------
  const download = async (klik, naam) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), klik()]);
    const pad = path.join(UIT, naam);
    await dl.saveAs(pad);
    return pad;
  };
  const xl = await download(() => page.click('#knopExcel'), 'pr24_eenvoudig.xlsx');
  const x = JSON.parse(execFileSync('python3', ['-c', `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(xl)})
def rijen(n): return [list(r) for r in wb[n].iter_rows(values_only=True)]
def tabel(n, eerste):
    rr = rijen(n); k = next(i for i, r in enumerate(rr) if r and r[0] == eerste and len([c for c in r if c is not None]) > 2)
    return [dict(zip(rr[k], r)) for r in rr[k+1:] if r and r[0] is not None]
print(json.dumps({"bladen": wb.sheetnames, "kop": rijen("Samenvatting")[:8], "sam": tabel("Samenvatting", "Onderdeel"), "mg": rijen("Maandgegevens"),
  "dos": tabel("Dossiers", "Bestuur"), "st": tabel("Processtappen en tijden", "Bestuur"), "pds": tabel("Tijd per dossier en stap", "Bestuur"), "ber": tabel("Berekeningen en meetwijzen", "Onderdeel")}, default=str))`]).toString());
  assert.deepStrictEqual(x.bladen, ['Samenvatting', 'Maandgegevens', 'Dossiers', 'Processtappen en tijden', 'Tijd per dossier en stap', 'Berekeningen en meetwijzen']);
  const kopTekst = JSON.stringify(x.kop);
  assert.ok(['LEV', 'oktober', '2026', 'Exportdatum', 'PR24 – LEV – oktober 2026'].every((w) => kopTekst.includes(w)), kopTekst);
  const sam = (u) => x.sam.find((r) => r.Uitkomst === u);
  assert.ok(sam('Geen diensttijdopgave').Waarde === 16 && sam('Aanleverpercentage').Waarde === 46.7 && sam('Verwerkingspercentage').Waarde === 35.7);
  assert.ok(sam('Totale actieve tijd alle dossiers').Waarde === 160.5 && sam('Totale actieve tijd alle dossiers').Toelichting === '2,67 uur; 4 dossiers' && sam('Gemiddelde actieve tijd per dossier').Waarde === 40.125
    && sam('Gemiddelde actieve tijd per dossier').Toelichting === 'gebaseerd op 4 van 4 dossiers' && sam('Totale wachttijd alle dossiers').Waarde === 25.5, JSON.stringify(x.sam.filter((r) => r.Onderdeel === 'Tijd')));
  assert.ok(x.sam.some((r) => r.Onderdeel === 'Tijd per processtap' && r.Uitkomst.startsWith('PR24-S02') && r.Waarde === 65 && r.Toelichting.includes('meeste actieve tijd')));
  assert.ok(x.sam.some((r) => r.Onderdeel === 'Tijd per processtap' && r.Uitkomst.startsWith('PR24-S03') && r.Waarde === 'n.v.t. (inbegrepen)'));
  assert.ok(x.sam.some((r) => r.Onderdeel === 'Tijd per complexiteitsklasse' && r.Uitkomst === 'Zeer groot' && r.Waarde === 65));
  assert.ok(x.sam.some((r) => r.Onderdeel === 'Tijd per bestuur en maand' && r.Uitkomst === 'PR24 – LEV – oktober 2026' && r.Waarde === 160.5));
  assert.ok(x.sam.some((r) => r.Onderdeel === 'Knelpunt' && r.Uitkomst === 'PR24-S04' && r.Waarde === 'Visma traag bij opslaan'));
  assert.strictEqual(x.dos.length, 4);
  const xd = (c) => x.dos.find((r) => r.Dossiercode === c);
  assert.deepStrictEqual([xd('LEV-2026-10-D01').Complexiteitsklasse, xd('LEV-2026-10-D01')['Gebruikt aantal blokken'], xd('LEV-2026-10-D01')['Bron gebruikte blokken'], xd('LEV-2026-10-D01')['PR24-S04 actief (min)'], xd('LEV-2026-10-D01')['PR24-S03 actief (min)'], xd('LEV-2026-10-D01')['Totale actieve tijd (min)'], xd('LEV-2026-10-D01')['Totale wachttijd (min)']],
    ['Klein', 3, 'werkelijk (Visma)', 4.5, 'n.v.t. (inbegrepen)', 19.5, 1.5]);
  assert.strictEqual(xd('LEV-2026-10-D02').Complexiteitsklasse, 'Middel');
  const s02x = x.st.find((r) => r['Stap-ID'] === 'PR24-S02');
  assert.ok(s02x.Rekeneenheid === 'Per complexiteitsklasse' && s02x['Actief Groot (min per dossier)'] === 20 && s02x['Wacht Groot (min per dossier)'] === 15 && s02x['Actieve tijd alle dossiers (min)'] === 65 && s02x.Afbakening === 'Bepalen welke arbeidsverhoudingen relevant zijn.' && s02x['Meeste actieve tijd (top 3)'] === 'Ja');
  const s03x = x.st.find((r) => r['Stap-ID'] === 'PR24-S03');
  assert.ok(s03x['Inbegrepen bij'] === 'PR24-S02' && s03x['Telt mee in totaal'] === 'Nee' && s03x['Actieve tijd alle dossiers (min)'] === 'n.v.t. (inbegrepen)');
  assert.strictEqual(x.pds.length, 36, '4 dossiers × 9 stappen');
  const p = x.pds.find((r) => r.Dossiercode === 'LEV-2026-10-D03' && r['Stap-ID'] === 'PR24-S04');
  assert.deepStrictEqual([p.Rekeneenheid, p['Gebruikt aantal blokken'], p['Bron blokken'], p['Actieve tijd (min)'], p['Berekening actief'], p.Meetwijze], ['Per diensttijdblok', 6, 'verwacht', 9, '1,50 min × 6 blokken (verwacht) = 9,00 min', 'Daadwerkelijk gemeten']);
  const pk = x.pds.find((r) => r.Dossiercode === 'LEV-2026-10-D04' && r['Stap-ID'] === 'PR24-S02');
  assert.deepStrictEqual([pk.Complexiteitsklasse, pk['Actieve tijd (min)'], pk.Herkomst], ['Zeer groot', 30, 'geschat']);
  assert.ok(x.ber.some((r) => r.Uitkomst === 'LEV-2026-10-D01 – totale actieve tijd' && r.Waarde === 19.5 && r['Berekening met gebruikte getallen'] === 'S01 2,00 + S02 5,00 + S04 4,50 + S05 3,00 + S06 1,50 + S07 1,00 + S08 1,50 + S09 1,00 = 19,50 min'));
  assert.ok(x.ber.some((r) => r.Uitkomst === 'Per diensttijdblok' && r.Formule.includes('nooit beide')));
  const csvPad = await download(async () => { await page.selectOption('#csvKeuze', 'perDossierStap'); await page.click('#knopCsv'); }, 'pr24_per_dossier.csv');
  const csv = fs.readFileSync(csvPad, 'utf8').replace(/^﻿/, '').split(/\r\n/);
  assert.ok(csv.some((r) => r.startsWith('Bestuur;Maand;Jaar;Dossiercode;Verwerkingsstatus;Stap-ID')) && csv.some((r) => r.startsWith('LEV;oktober;2026;LEV-2026-10-D03;Gedeeltelijk verwerkt;PR24-S04;') && r.includes(';6;verwacht;1,5;0,5;9;3;')), csv.slice(8, 14).join('\n'));
  const csvDos = fs.readFileSync(await download(async () => { await page.selectOption('#csvKeuze', 'dossiers'); await page.click('#knopCsv'); }, 'pr24_dossiers.csv'), 'utf8').split(/\r\n/);
  assert.ok(csvDos.some((r) => r.startsWith('LEV;oktober;2026;LEV-2026-10-D02;30;Middel;4;Nog niet verwerkt;')));
  const voor = await metingen();
  const bk = await download(() => page.click('#knopJson'), 'pr24_backup.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(bk, 'utf8')).metingen.length, 4);
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await page.setInputFiles('#importBestand', bk);
  await page.waitForSelector('#dialoog[open]');
  await knop('Samenvoegen');
  await page.waitForFunction(() => window.__pr24.staat().metingen.length === 4);
  assert.deepStrictEqual(await metingen(), voor, 'import zonder verlies');
  assert.strictEqual(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SLEUTEL)).metingen.length, 4, 'na import lokaal opgeslagen');
  await page.click('#voortgang [data-ga="1"]');
  await page.click('[data-open="PR24-LEV-2026-10"]');
  await page.click('#voortgang [data-ga="5"]');
  assert.ok((await tekst('#resultaat5')).includes('160,50 min'));
  const fout = JSON.parse(fs.readFileSync(bk, 'utf8'));
  fout.metingen[0].verwerkt = 20;
  fs.writeFileSync(path.join(UIT, 'pr24_fout.json'), JSON.stringify(fout));
  await page.setInputFiles('#importBestand', path.join(UIT, 'pr24_fout.json'));
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await tekst('#dialoogInhoud')).includes('Verwerkt (20) mag niet hoger zijn dan aangeleverd (14)'));
  await knop('Sluiten');
  ok('11 export en import', 'Excel met Samenvatting (tijd per dossier, stap, klasse en maand), Maandgegevens, Dossiers (gebruikte blokken, tijd per stap, totalen), Processtappen en tijden (rekeneenheid, klassetijden, afbakening), Tijd per dossier en stap (36 regels met berekening en herkomst) en Berekeningen; CSV per dossier en stap; JSON-back-up hersteld; ongeldige back-up geweigerd');

  // ---------- Verwijderen en behoud van andere gegevens ----------
  await page.click('#voortgang [data-ga="1"]');
  await page.click('[data-open="PR24-LEV-2026-08"]');
  await page.click('#voortgang [data-ga="3"]');
  await page.click('[data-verwijder-dossier="6"]');
  await knop('Annuleren');
  assert.strictEqual((await metingen())[0].dossiers.length, 7);
  await page.click('[data-verwijder-dossier="6"]');
  await knop('Dossier verwijderen');
  assert.strictEqual((await metingen())[0].dossiers.length, 6);
  await page.click('#voortgang [data-ga="1"]');
  await page.click('#knopVerwijderen');
  await knop('Maandmeting verwijderen');
  assert.deepStrictEqual((await metingen()).map((m) => m.id), ['PR24-SAMANAS-2026-08', 'PR24-LEV-2026-09', 'PR24-LEV-2026-10']);
  await ctx.close();
  // Eerste context: andere localStorage-sleutels ongewijzigd (gecontroleerd vóór sluiten is niet meer mogelijk; opnieuw in nieuwe context met dezelfde voorbereiding).
  ({ c: ctx, p: page } = await nieuweContext());
  await page.evaluate(() => { localStorage.setItem('meettool-pr24-maandmetingen', '{"bestaand":"maanddashboard"}'); localStorage.setItem('meettool-veiligheidsbackup', '{"bestaand":true}'); });
  await page.reload();
  await page.waitForFunction(() => window.__pr24 && window.__pr24.klaar);
  await page.click('#knopNieuw');
  await page.fill('#nieuwe', '3');
  await page.reload();
  await page.waitForFunction(() => window.__pr24 && window.__pr24.klaar);
  assert.strictEqual((await metingen())[0].nieuwe, 3, 'bewaard na herladen');
  assert.deepStrictEqual(await anderen(), anderenVoor, 'andere localStorage-sleutels ongewijzigd');
  ok('verwijderen en opslag', 'Dossier en maandmeting alleen na bevestiging verwijderd; gegevens blijven na herladen; andere localStorage-sleutels (o.a. van de brede meettool) ongewijzigd');

  // ---------- Migratie van versie 1.0 en klik direct na invoer ----------
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  const oud = { formaat: SLEUTEL, versie: 'PR24-eenvoudig 1.0', opgeslagen: '2026-10-01T08:00:00.000Z', metingen: [{
    id: 'PR24-SAMANAS-2026-07', bestuur: 'SAMANAS', jaar: 2026, maand: 7, nieuwe: 10, aangeleverd: 4, verwerkt: 1, bron: '', toelichting: '',
    dossiers: [{ code: 'SAMANAS-2026-07-D01', regels: 25, blokken: 3, status: 'Nog niet verwerkt', visma: null, bijzonderheid: '', aangemaakt: '2026-10-01T08:00:00.000Z', gewijzigd: null }],
    s02: { Klein: 5, Gemiddeld: 10, Groot: 30, 'Zeer groot': 45 },
    stappen: [
      { stapId: 'PR24-S02', naam: 'x', actief: null, wacht: 1, eenheid: 'dossier', meetwijze: 'Geschat door medewerker', knelpunt: null, toelichting: '', inbegrepen: false, inbegrepenBij: '', gewijzigd: null },
      { stapId: 'PR24-S03', naam: 'x', actief: 8, wacht: 0, eenheid: 'dossier', meetwijze: '', knelpunt: null, toelichting: '', inbegrepen: false, inbegrepenBij: '', gewijzigd: null },
      { stapId: 'PR24-S04', naam: 'x', actief: 1.5, wacht: 0, eenheid: 'blok', meetwijze: 'Daadwerkelijk gemeten', knelpunt: true, toelichting: 'traag', inbegrepen: false, inbegrepenBij: '', gewijzigd: null },
      { stapId: 'PR24-S08', naam: 'x', actief: 3, wacht: 0, eenheid: 'dossier', meetwijze: '', knelpunt: null, toelichting: '', inbegrepen: false, inbegrepenBij: '', gewijzigd: null },
    ],
    aangemaakt: '2026-10-01T08:00:00.000Z', gewijzigd: null }] };
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SLEUTEL, JSON.stringify(oud)]);
  await page.reload();
  await page.waitForFunction(() => window.__pr24 && window.__pr24.klaar);
  const mig = (await metingen())[0];
  const st = (id) => mig.stappen.find((s) => s.stapId === id);
  assert.deepStrictEqual(st('PR24-S02').klasseActief, { Klein: 5, Middel: 10, Groot: 30, 'Zeer groot': 45 }, 'S02: Gemiddeld → Middel');
  assert.deepStrictEqual(st('PR24-S02').klasseWacht, { Klein: 1, Middel: 1, Groot: 1, 'Zeer groot': 1 });
  assert.deepStrictEqual(st('PR24-S03').klasseActief, { Klein: 8, Middel: 8, Groot: 8, 'Zeer groot': 8 }, 'per dossier → zelfde tijd voor iedere klasse');
  assert.ok(st('PR24-S04').actief === 1.5 && st('PR24-S04').eenheid === 'blok' && st('PR24-S04').knelpunt === true);
  assert.ok(st('PR24-S08').actief === null && st('PR24-S08').eenheid === 'blok' && st('PR24-S08').toelichting.includes('Eerdere waarde (per dossier): actief 3 min'), 'onverenigbare eenheid niet overgenomen, wel vermeld');
  assert.ok(!('s02' in mig));
  assert.strictEqual(await page.evaluate((k) => JSON.parse(localStorage.getItem(k + '-kopie-versie-1.0')).versie, SLEUTEL), 'PR24-eenvoudig 1.0', 'kopie van versie 1.0 bewaard');
  // Klik op Volgende direct na het invullen van een klassetijd moet aankomen (pagina verspringt niet).
  await page.click('[data-open="PR24-SAMANAS-2026-07"]');
  await page.click('#voortgang [data-ga="4"]');
  await page.click('[data-klassen-toggle="PR24-S07"]');
  await page.fill('tr[data-klassen-voor="PR24-S07"] [data-klasse-wacht="Zeer groot"]', '2');
  await page.click('#knopVolgende');
  assert.ok(await page.isVisible('section[data-stap="5"]'), 'Volgende werkt direct na invoer');
  ok('migratie en klikken', 'Gegevens uit versie 1.0 worden omgezet (S02-klassetijden met Gemiddeld → Middel, tijd per dossier naar iedere klasse, onverenigbare eenheid niet overgenomen maar vermeld) met een kopie van de oude gegevens; "Volgende" werkt direct na invoer');

  // ---------- 12. Direct in de browser ----------
  assert.deepStrictEqual(netwerk, []);
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  ok('12 browser', 'Geopend via file:// zonder Node.js, npm, server of buildstap: 0 netwerkverzoeken, 0 JavaScript-fouten');
  await browser.close();
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
