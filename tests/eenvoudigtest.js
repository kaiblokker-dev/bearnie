// Controletests voor meettool-pr24-eenvoudig.html. Offline via file://, in Nederlandse tijd.
// Gebruik: node tests/eenvoudigtest.js   (vereist Playwright en python3 met openpyxl; de tool zelf niet)
//
// Controlevoorbeeld LEV – augustus 2026: 30 nieuw, 14 aangeleverd, 5 verwerkt.
// Dossiers: D01 19 regels/2 blokken/volledig/2 Visma; D02 20/3/volledig/3; D03 50/5/gedeeltelijk/2; D04 51/6/nog niet;
//           D05 100/10/nog niet; D06 101/–/onbekend; D07 –/4/nog niet (later 30 regels → 371 regels, n = 7, gem. 53).
//   → eerst regels 341 (n = 6), gem. 56,83; blokken 30 (n = 6), gem. 5; Visma 7 (n = 3); resterend 0+0+3+6+10+4 = 23 (D06 onbekend).
// S02 per klasse: Klein 5, Gemiddeld 10, Groot 30, Zeer groot 45 → verwacht 1×5 + 3×10 + 2×30 + 1×45 = 140;
//   uitgevoerd (volledig verwerkt: D01 Klein, D02 Gemiddeld) = 5 + 10 = 15.
// Per dossier: S01 2 min → 2 × 5 = 10, 2 × 14 = 28. Per blok: S04 1,5 min → 1,5 × 7 = 10,5, 1,5 × 30 = 45.
// S03 (8 min per dossier) is inbegrepen bij S02 en telt niet mee: totaal verwacht 342 in plaats van 342 + 112 = 454.
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
  assert.deepStrictEqual(klassen, ['Klein', 'Gemiddeld', 'Gemiddeld', 'Groot', 'Groot', 'Zeer groot', 'niet ingevuld']);
  assert.deepStrictEqual(await page.evaluate(() => [0, 1, 19, 20, 50, 51, 100, 101, null].map(window.__pr24.klasse)), [null, 'Klein', 'Klein', 'Gemiddeld', 'Gemiddeld', 'Groot', 'Groot', 'Zeer groot', null]);
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="regels"]', '0');
  assert.ok((await tekst('#fouten3')).includes('0 is niet geldig'));
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="regels"]', '');
  b = await bereken('PR24-LEV-2026-08');
  const d = b.dos;
  assert.deepStrictEqual([d.aantal, d.perKlasse, d.zonderKlasse], [7, { Klein: 1, Gemiddeld: 2, Groot: 2, 'Zeer groot': 1 }, ['LEV-2026-08-D07']]);
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
  ok('4 complexiteit', '19 Klein; 20 en 50 Gemiddeld; 51 en 100 Groot; 101 Zeer groot; 0 is ongeldig; leeg = niet ingevuld');
  ok('5 lege waarden', 'Lege regels, blokken en Visma-regels tellen niet als 0: totalen 341 regels (6 dossiers), 30 blokken (6), 7 Visma-regels (3); resterend 23 met D06 als onbekend');
  ok('6 gemiddelde met n', 'Gemiddeld 56,83 regels en 5 blokken, met "gebaseerd op 6 van 7 dossiers"; waarschuwing 7 dossiers ≠ 14 aangeleverd zonder blokkade; dubbele en BSN-achtige code afgevangen');

  // ---------- 7, 8 en 9. Tijd: S02 per klasse, per dossier/blok, geen dubbeltelling ----------
  await stap(4);
  const rij = (s) => `#stapTabel tr[data-stap="PR24-${s}"]`;
  const eenheden = await page.$$eval('#stapTabel tr[data-stap]', (r) => r.map((x) => (x.querySelector('[data-s="eenheid"]') || { value: 'S02' }).value));
  assert.deepStrictEqual(eenheden, ['dossier', 'S02', 'dossier', 'blok', 'blok', 'blok', 'dossier', 'dossier', 'dossier']);
  await page.click('[data-klassen-toggle]');
  for (const [k, w] of [['Klein', '5'], ['Gemiddeld', '10'], ['Groot', '30']]) await page.fill(`[data-klasse-tijd="${k}"]`, w);
  await page.fill(`${rij('S02')} [data-s="wacht"]`, '1');
  await page.selectOption(`${rij('S02')} [data-s="meetwijze"]`, 'Geschat door medewerker');
  b = await bereken('PR24-LEV-2026-08');
  let s02 = b.stappen[1];
  assert.ok(s02.actief.verw === null && s02.redenS02.includes('1 dossier(s) zonder ABP-periode-regels') && s02.redenS02.includes('geen tijd ingevuld voor Zeer groot'), s02.redenS02);
  await stap(3);
  await page.fill('#dossierTabel tr[data-i="6"] [data-d="regels"]', '30');
  await stap(4);
  await page.click('[data-klassen-toggle]');
  await page.fill('[data-klasse-tijd="Zeer groot"]', '45');
  b = await bereken('PR24-LEV-2026-08');
  s02 = b.stappen[1];
  assert.deepStrictEqual([s02.actief.verw, s02.actief.uit, s02.actief.rest, s02.wacht.uit, s02.wacht.verw], [140, 15, 125, 5, 14]);
  assert.strictEqual(s02.berekening.actief.verw, '1 × 5,00 min (Klein) + 3 × 10,00 min (Gemiddeld) + 2 × 30,00 min (Groot) + 1 × 45,00 min (Zeer groot) = 140,00 min');
  ok('7 S02 per klasse', 'Zonder tijd voor een aanwezige klasse of met een dossier zonder regels: "onvoldoende gegevens"; daarna 1×5 + 3×10 + 2×30 + 1×45 = 140 min verwacht, 15 uitgevoerd (volledig verwerkte dossiers), wacht 1 × 5 en 1 × 14');

  const vul = async (s, actief, wacht, meetwijze = 'Daadwerkelijk gemeten') => {
    await page.fill(`${rij(s)} [data-s="actief"]`, actief);
    await page.fill(`${rij(s)} [data-s="wacht"]`, wacht);
    await page.selectOption(`${rij(s)} [data-s="meetwijze"]`, meetwijze);
  };
  await vul('S01', '2', '0');
  await vul('S04', '1,5', '0');
  b = await bereken('PR24-LEV-2026-08');
  assert.deepStrictEqual([b.stappen[0].actief.uit, b.stappen[0].actief.verw, b.stappen[0].actief.rest], [10, 28, 18]);
  assert.deepStrictEqual([b.stappen[3].actief.uit, b.stappen[3].actief.verw, b.stappen[3].actief.rest], [10.5, 45, 34.5]);
  await page.selectOption(`${rij('S01')} [data-s="eenheid"]`, 'blok');
  b = await bereken('PR24-LEV-2026-08');
  assert.deepStrictEqual([b.stappen[0].actief.uit, b.stappen[0].actief.verw], [14, 60], 'S01 per blok: 2 × 7 en 2 × 30');
  await page.selectOption(`${rij('S01')} [data-s="eenheid"]`, 'dossier');
  for (const [s, a] of [['S03', '8'], ['S05', '1'], ['S06', '0,5'], ['S07', '2'], ['S08', '3'], ['S09', '1']]) await vul(s, a, '0');
  await page.selectOption(`${rij('S04')} [data-s="knelpunt"]`, 'ja');
  await page.fill(`${rij('S04')} [data-s="toelichting"]`, 'Visma traag bij opslaan');
  b = await bereken('PR24-LEV-2026-08');
  assert.strictEqual(b.tijd.actief.verw.waarde, 454, 'zonder inbegrepen: S03 telt mee (8 × 14 = 112)');
  await page.check(`${rij('S03')} [data-s="inbegrepen"]`);
  assert.ok((await tekst('#fouten4')).includes('niet gekozen bij welke stap'));
  await page.selectOption(`${rij('S03')} [data-s="inbegrepenBij"]`, 'PR24-S02');
  b = await bereken('PR24-LEV-2026-08');
  assert.deepStrictEqual([b.tijd.actief.verw.waarde, b.tijd.actief.uit.waarde, b.tijd.actief.rest.waarde, b.tijd.wacht.verw.waarde], [342, 76, 266, 14]);
  assert.ok(b.stappen[2].inbegrepen && b.stappen[2].stap.inbegrepenBij === 'PR24-S02' && b.stappen[2].actief.verw === 112, 'S03 blijft zichtbaar met eigen waarde');
  assert.deepStrictEqual(b.hoogste, ['PR24-S02', 'PR24-S04', 'PR24-S08']);
  assert.ok(b.schatting, 'S02 geschat');
  ok('8 per dossier en per blok', 'S01 per dossier 2 × 5 = 10 en 2 × 14 = 28; S04 per blok 1,5 × 7 = 10,5 en 1,5 × 30 = 45; S01 omgezet naar per blok 2 × 7 = 14 en 2 × 30 = 60');
  ok('9 geen dubbeltelling', 'Totaal verwacht 454 min met S03; na "inbegrepen bij PR24-S02" 342 min (uitgevoerd 76, resterend 266); S03 blijft zichtbaar; waarschuwing zolang geen stap gekozen is');

  // ---------- Resultaat ----------
  await page.click('#knopVolgende');
  const res = await tekst('#resultaat5');
  assert.ok(['46,7%', '35,7%', '371', '53,00', 'n = 7 dossiers', 'Klein', '30', '342,00 min', '5 uur 42 min', '76,00 min', '266,00 min', 'Visma traag bij opslaan', 'n.v.t. (inbegrepen bij PR24-S02)'].every((w) => res.includes(w)), res);
  assert.deepStrictEqual(await page.$$eval('#resultaatStappen tbody tr', (r) => r.map((x) => x.querySelector('.mono').textContent)), ['PR24-S01', 'PR24-S02', 'PR24-S03', 'PR24-S04', 'PR24-S05', 'PR24-S06', 'PR24-S07', 'PR24-S08', 'PR24-S09'], 'oorspronkelijke volgorde');
  assert.strictEqual(await page.$$eval('#resultaatStappen .label-hoog', (x) => x.length), 3);
  await page.screenshot({ path: path.join(UIT, 'scherm_pr24_eenvoudig.png'), fullPage: true });
  ok('resultaat', 'Dashboard met frequentie, bronregels en complexiteit, blokken en status, tijd per stap (volgorde behouden, 3 hoogste gemarkeerd) en knelpunten');

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
  "dos": tabel("Dossiers", "Bestuur"), "st": tabel("Processtappen en tijden", "Bestuur"), "ber": tabel("Berekeningen en meetwijzen", "Onderdeel")}, default=str))`]).toString());
  assert.deepStrictEqual(x.bladen, ['Samenvatting', 'Maandgegevens', 'Dossiers', 'Processtappen en tijden', 'Berekeningen en meetwijzen']);
  const kopTekst = JSON.stringify(x.kop);
  assert.ok(['LEV', 'augustus', '2026', 'Exportdatum', 'PR24 – LEV – augustus 2026'].every((w) => kopTekst.includes(w)), kopTekst);
  const sam = (u) => x.sam.find((r) => r.Uitkomst === u);
  assert.ok(sam('Geen diensttijdopgave').Waarde === 16 && sam('Aanleverpercentage').Waarde === 46.7 && sam('Verwerkingspercentage').Waarde === 35.7 && sam('Totaal ABP-periode-regels').Waarde === 371
    && sam('Gemiddeld ABP-periode-regels').Waarde === 53 && sam('Gemiddeld ABP-periode-regels').Toelichting === 'gebaseerd op 7 dossiers' && sam('Totale verwachte actieve tijd').Waarde === 342 && sam('Totale verwachte actieve tijd').Toelichting === '5,70 uur');
  assert.ok(x.sam.some((r) => r.Onderdeel === 'Knelpunt' && r.Uitkomst === 'PR24-S04' && r.Waarde === 'Visma traag bij opslaan'));
  assert.ok(JSON.stringify(x.mg).includes('Maandrapportage (fictief)'));
  assert.strictEqual(x.dos.length, 7);
  assert.deepStrictEqual(x.dos.map((r) => r.Complexiteitsklasse), ['Klein', 'Gemiddeld', 'Gemiddeld', 'Groot', 'Groot', 'Zeer groot', 'Gemiddeld']);
  assert.strictEqual(x.dos[5]['Verwacht aantal diensttijdblokken'], 'niet ingevuld');
  const s03 = x.st.find((r) => r['Stap-ID'] === 'PR24-S03');
  assert.ok(s03['Inbegrepen bij'] === 'PR24-S02' && s03['Actief verwacht (min)'] === 'n.v.t. (inbegrepen)' && s03['Telt mee in totaal'] === 'Nee');
  const s02x = x.st.find((r) => r['Stap-ID'] === 'PR24-S02');
  assert.ok(s02x['S02 Groot (min per dossier)'] === 30 && s02x['Actief verwacht (min)'] === 140 && s02x.Meetwijze === 'Geschat door medewerker');
  assert.ok(x.ber.some((r) => r.Onderdeel === 'PR24-S02 – Groot' && r.Waarde === 60 && r['Gebaseerd op'] === '2 dossiers (0 volledig verwerkt)'));
  assert.ok(x.ber.some((r) => r.Uitkomst === 'Gemiddeld ABP-periode-regels' && r['Gebaseerd op'] === '7 dossiers' && r['Berekening met gebruikte getallen'] === '371 ÷ 7'));
  assert.ok(x.ber.some((r) => r['Berekening met gebruikte getallen'] === '1,50 min × 30 verwachte diensttijdblokken = 45,00 min' && r.Meetwijze === 'Daadwerkelijk gemeten'));
  const csvPad = await download(async () => { await page.selectOption('#csvKeuze', 'dossiers'); await page.click('#knopCsv'); }, 'pr24_dossiers.csv');
  const csv = fs.readFileSync(csvPad, 'utf8').replace(/^﻿/, '').split(/\r\n/);
  assert.ok(csv.some((r) => r.startsWith('Bestuur;Maand;Jaar;Dossiercode;ABP-periode-regels;Complexiteitsklasse')) && csv.some((r) => r.startsWith('LEV;augustus;2026;LEV-2026-08-D01;19;Klein;2;Volledig verwerkt;2')) && csv.some((r) => r.startsWith('Exportdatum;')));
  const voor = await metingen();
  const bk = await download(() => page.click('#knopJson'), 'pr24_backup.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(bk, 'utf8')).metingen.length, 3);
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await page.setInputFiles('#importBestand', bk);
  await page.waitForSelector('#dialoog[open]');
  await knop('Samenvoegen');
  await page.waitForFunction(() => window.__pr24.staat().metingen.length === 3);
  assert.deepStrictEqual(await metingen(), voor, 'import zonder verlies');
  assert.strictEqual(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), SLEUTEL)).metingen.length, 3, 'na import lokaal opgeslagen');
  await page.click('#voortgang [data-ga="1"]');
  await page.click('[data-open="PR24-LEV-2026-08"]');
  await page.click('#voortgang [data-ga="5"]');
  assert.ok((await tekst('#resultaat5')).includes('342,00 min'));
  const fout = JSON.parse(fs.readFileSync(bk, 'utf8'));
  fout.metingen[0].verwerkt = 20;
  fs.writeFileSync(path.join(UIT, 'pr24_fout.json'), JSON.stringify(fout));
  await page.setInputFiles('#importBestand', path.join(UIT, 'pr24_fout.json'));
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await tekst('#dialoogInhoud')).includes('Verwerkt (20) mag niet hoger zijn dan aangeleverd (14)'));
  await knop('Sluiten');
  ok('11 export en import', 'Excel met Samenvatting, Maandgegevens, Dossiers, Processtappen en tijden, Berekeningen en meetwijzen (bestuur, maand, jaar, exportdatum, formules, n achter gemiddelden, meetwijzen, knelpunten); CSV dossiers; JSON-back-up in een lege browser hersteld; ongeldige back-up geweigerd');

  // ---------- Verwijderen en behoud van andere gegevens ----------
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
  assert.deepStrictEqual((await metingen()).map((m) => m.id), ['PR24-SAMANAS-2026-08', 'PR24-LEV-2026-09']);
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
