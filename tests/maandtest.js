// Controletests voor het PR24-maanddashboard (versie 1.8). Offline via file://, in Nederlandse tijd.
// Gebruik: node tests/maandtest.js   (vereist Playwright en python3 met openpyxl)
//
// Controlevoorbeeld LEV – augustus 2026: 30 nieuwe medewerkers, 14 aangeleverd, 5 verwerkt
//   → geen opgave 16, nog te verwerken 9, aanleverpercentage 46,7%, verwerkingspercentage 35,7%, verwerkt t.o.v. nieuw 16,7%.
// Dossiers: D01 50 regels/5 blokken/volledig/5 Visma; D02 60/6/gedeeltelijk/3; D03 –/–/nog niet; D04 64/7/nog niet/–
//   → totaal 174 regels (niet 58 × 14), gemiddeld 58 (n = 3); 18 blokken, gemiddeld 6; 8 Visma-regels; resterend 0 + 3 + 7 = 10.
// Stappen: S01 2 min per dossier → uitgevoerd 2 × 5 = 10, verwacht 2 × 14 = 28; S04 1,5 min per blok (+0,5 wacht)
//   → uitgevoerd 1,5 × 8 = 12, verwacht 1,5 × 18 = 27; wacht 4 en 9.
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HTML = path.resolve(__dirname, '..', 'Meettool.html');
const UIT = path.resolve(process.env.TEST_UITVOER || path.join(__dirname, 'uitvoer'));
fs.mkdirSync(UIT, { recursive: true });
const bijna = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const SLEUTEL = 'meettool-pr24-maandmetingen';
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
    await p.waitForFunction(() => window.__meettool && window.__meettool.klaar);
    return { c, p };
  };
  let { c: ctx, p: page } = await nieuweContext();
  const tab = (naam) => page.click(`#tabs button[data-tab="${naam}"]`);
  const knop = (label) => page.click(`#dialoogKnoppen button:text-is("${label}")`);
  const staat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.staat())));
  const maand = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.maandStaat().maandmetingen)));
  const opgeslagen = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SLEUTEL);
  const bereken = (id) => page.evaluate((x) => {
    const m = window.__meettool.maandStaat().maandmetingen.find((y) => y.id === x);
    return JSON.parse(JSON.stringify(window.__meettool.berekenMaand(m), (k, v) => (k === 'meting' ? undefined : v)));
  }, id);
  const kies = async (bestuur, maandNr, jaar) => {
    await page.selectOption('#mmBestuur', bestuur);
    await page.selectOption('#mmMaand', String(maandNr));
    await page.selectOption('#mmJaar', String(jaar));
  };
  const subtab = (n) => page.click(`#maandSubtabs [data-maandtab="${n}"]`);
  const lees = (sel) => page.textContent(sel);

  // ---------- Bestaande gegevens vastleggen (om behoud te controleren) ----------
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR10');
  await page.fill('#peNaam', 'Bestaand proces');
  for (const [veld, w] of [['#peUitvoering', 'zaak'], ['#peUitvoeringMv', 'zaken'], ['#peOmvang', 'regel'], ['#peOmvangMv', 'regels']]) await page.fill(veld, w);
  await page.fill('#procesEditor tr[data-index="0"] input[data-stapveld="naam"]', 'Behandelen');
  await page.click('[data-actie="proces-opslaan"]');
  await page.waitForFunction(() => window.__meettool.staat().processen.length === 1);
  await page.evaluate(() => { localStorage.setItem('meettool-veiligheidsbackup', '{"bestaand":true}'); localStorage.setItem('andere-toepassing', 'niet aanraken'); });
  await page.evaluate(() => window.__meettool.wachtOpOpslag());
  const staatVoor = await staat();
  const andereSleutels = () => page.evaluate((k) => Object.fromEntries(Object.keys(localStorage).filter((x) => x !== k && !x.startsWith('meettool-concept')).sort().map((x) => [x, localStorage.getItem(x)])), SLEUTEL);
  const sleutelsVoor = await andereSleutels();

  // ---------- Selectie en nieuwe maandmeting ----------
  await tab('maand');
  assert.strictEqual(await page.inputValue('#mmProces'), 'PR24', 'proces standaard PR24');
  assert.deepStrictEqual(await page.$$eval('#mmBestuur option', (o) => o.map((x) => x.value)), ['LEV', 'SAMANAS']);
  await kies('LEV', 8, 2026);
  assert.strictEqual(await lees('#mmLabel'), 'PR24 – LEV – augustus 2026');
  assert.ok((await lees('#maandInhoud')).includes('Er is nog geen maandmeting'), 'niets automatisch aangemaakt');
  assert.strictEqual(await opgeslagen(), null, 'niets opgeslagen zonder actie');
  await page.click('.maandselectie [data-actie="maand-nieuw"]');
  await page.waitForSelector('#mmNieuwe');
  let m = (await maand())[0];
  assert.deepStrictEqual([m.id, m.bestuur, m.maand, m.jaar, m.nieuweMedewerkers, m.stappen.length], ['PR24-LEV-2026-08', 'LEV', 8, 2026, null, 9]);
  assert.deepStrictEqual(m.stappen.map((s) => s.eenheid), ['dossier', 'dossier', 'dossier', 'blok', 'blok', 'blok', 'dossier', 'dossier', 'dossier'], 'standaard rekeneenheden');
  assert.deepStrictEqual(m.stappen.map((s) => s.stapId), ['PR24-S01', 'PR24-S02', 'PR24-S03', 'PR24-S04', 'PR24-S05', 'PR24-S06', 'PR24-S07', 'PR24-S08', 'PR24-S09']);
  assert.ok((await lees('#mmOpslagStatus')).startsWith('Laatst opgeslagen:'));
  ok('selectie', 'Proces standaard PR24, besturen LEV en SAMANAS; "PR24 – LEV – augustus 2026" wordt pas aangemaakt na "Nieuwe maandmeting", met 9 standaardstappen en de voorgestelde rekeneenheden (S04–S06 per diensttijdblok)');

  // ---------- 1. Validatie verwerkt ≤ aangeleverd ≤ nieuwe medewerkers ----------
  await page.fill('#mmNieuwe', '30');
  await page.fill('#mmAangeleverd', '31');
  assert.ok((await lees('#mmGegevensFouten')).includes('meer diensttijdopgaven aangeleverd (31) dan er nieuwe medewerkers zijn (30)'));
  assert.strictEqual((await maand())[0].aangeleverd, null, 'ongeldige waarde niet opgeslagen');
  assert.ok(await page.$eval('#mmAangeleverd', (e) => e.classList.contains('ongeldig')));
  await page.fill('#mmAangeleverd', '14');
  await page.fill('#mmVerwerkt', '15');
  assert.ok((await lees('#mmGegevensFouten')).includes('meer diensttijdopgaven verwerkt (15) dan aangeleverd (14)'));
  for (const fout of ['-1', '2,5', 'abc']) {
    await page.fill('#mmVerwerkt', fout);
    assert.ok((await lees('#mmGegevensFouten')).length > 0, 'fout bij ' + fout);
  }
  assert.strictEqual((await maand())[0].verwerkt, null);
  await page.fill('#mmVerwerkt', '5');
  assert.strictEqual(await lees('#mmGegevensFouten'), '');
  await page.fill('#mmBron', 'Maandrapportage HR (fictief)');
  ok('1 validatie', 'Aangeleverd 31 > 30 nieuwe en verwerkt 15 > 14 aangeleverd geven een duidelijke melding en worden niet opgeslagen; negatieve, decimale en niet-numerieke aantallen worden geweigerd');

  // ---------- 2. LEV-voorbeeld ----------
  let b = await bereken('PR24-LEV-2026-08');
  const f = b.frequentie;
  assert.deepStrictEqual([f.nieuwe, f.aangeleverd, f.verwerkt, f.geenOpgave, f.nogTeVerwerken], [30, 14, 5, 16, 9]);
  assert.ok(bijna(f.aanleverPct.waarde, 1400 / 30) && bijna(f.verwerkingsPct.waarde, 500 / 14) && bijna(f.verwerktVanNieuwePct.waarde, 500 / 30));
  const freqTekst = await lees('#mmGegevensBerekend');
  for (const w of ['46,7%', '35,7%', '16,7%']) assert.ok(freqTekst.includes(w), w);
  await subtab('dashboard');
  const dash = await lees('#mmDashFrequentie');
  assert.ok(['30', '14', '16', '5', '9', '46,7%', '35,7%', '16,7%'].every((w) => dash.includes(w)), dash);
  ok('2 LEV-voorbeeld', '30 nieuw, 14 aangeleverd, 5 verwerkt → geen opgave 16, nog te verwerken 9, aanleverpercentage 46,7%, verwerkingspercentage 35,7%, verwerkt t.o.v. nieuwe medewerkers 16,7% (scherm en berekening)');

  // ---------- 6. Ontbrekende aantallen en deler nul ----------
  await kies('SAMANAS', 8, 2026);
  assert.ok((await lees('#maandInhoud')).includes('Er is nog geen maandmeting'), 'SAMANAS apart');
  await page.click('.maandselectie [data-actie="maand-nieuw"]');
  await page.fill('#mmNieuwe', '20');
  b = await bereken('PR24-SAMANAS-2026-08');
  assert.ok(b.frequentie.geenOpgave === null && b.frequentie.nogTeVerwerken === null && b.frequentie.aanleverPct.waarde === null && b.frequentie.aanleverPct.reden === 'onvoldoende gegevens');
  assert.ok((await lees('#mmGegevensBerekend')).includes('onvoldoende gegevens'));
  await page.fill('#mmNieuwe', '0');
  await page.fill('#mmAangeleverd', '0');
  b = await bereken('PR24-SAMANAS-2026-08');
  assert.ok(b.frequentie.geenOpgave === 0 && b.frequentie.aanleverPct.reden === 'niet te berekenen (deler is 0)', JSON.stringify(b.frequentie));
  assert.ok((await lees('#mmGegevensBerekend')).includes('niet te berekenen (deler is 0)'));
  await page.fill('#mmNieuwe', '22');
  await page.fill('#mmAangeleverd', '10');
  await page.fill('#mmVerwerkt', '');
  b = await bereken('PR24-SAMANAS-2026-08');
  assert.ok(b.frequentie.verwerkt === null && b.frequentie.nogTeVerwerken === null && b.frequentie.verwerkingsPct.waarde === null, 'leeg verwerkt is geen 0');
  ok('6 ontbrekend ≠ 0', 'Ontbrekend aangeleverd of verwerkt geeft "onvoldoende gegevens" (niet 0); 0 is een echte waarde en een deler 0 geeft "niet te berekenen (deler is 0)" zonder foutmelding');

  // ---------- 3 en 4. Besturen en maanden gescheiden ----------
  await kies('LEV', 8, 2026);
  assert.strictEqual(await page.inputValue('#mmNieuwe').catch(() => null), null, 'dashboard is de standaardweergave');
  assert.ok((await lees('#mmDashFrequentie')).includes('46,7%'));
  await kies('LEV', 9, 2026);
  assert.ok((await lees('#maandInhoud')).includes('Er is nog geen maandmeting'));
  await page.click('.maandselectie [data-actie="maand-nieuw"]');
  await page.fill('#mmNieuwe', '12');
  const ls = await opgeslagen();
  assert.deepStrictEqual(ls.maandmetingen.map((x) => [x.id, x.nieuweMedewerkers]), [['PR24-LEV-2026-08', 30], ['PR24-SAMANAS-2026-08', 22], ['PR24-LEV-2026-09', 12]]);
  ok('3 en 4 gescheiden', 'LEV en SAMANAS (augustus) en LEV september zijn drie afzonderlijke maandmetingen met eigen gegevens in de eigen localStorage-sleutel');

  // ---------- 5. Dossiers en gemiddelden ----------
  await kies('LEV', 8, 2026);
  await subtab('dossiers');
  assert.ok((await lees('#maandInhoud')).includes('geanonimiseerde dossiercodes'));
  const dossiers = [['50', '5', 'Volledig verwerkt', '5'], ['60', '6', 'Gedeeltelijk verwerkt', '3'], ['', '', 'Nog niet verwerkt', ''], ['64', '7', 'Nog niet verwerkt', '']];
  for (const [i, [r, bl, st, v]] of dossiers.entries()) {
    await page.click('[data-actie="dossier-toevoegen"]');
    const rij = `#mmDossiers tr[data-dossier="${i}"]`;
    assert.strictEqual(await page.inputValue(`${rij} [data-dveld="dossierId"]`), `LEV-2026-08-D0${i + 1}`, 'dossier-ID voorgesteld');
    if (r) await page.fill(`${rij} [data-dveld="perioderegels"]`, r);
    if (bl) await page.fill(`${rij} [data-dveld="verwachteBlokken"]`, bl);
    await page.selectOption(`${rij} [data-dveld="status"]`, st);
    if (v) await page.fill(`${rij} [data-dveld="vismaRegels"]`, v);
  }
  await page.fill('#mmDossiers tr[data-dossier="0"] [data-dveld="bron"]', 'Telling in e-dossier');
  b = await bereken('PR24-LEV-2026-08');
  const d = b.dossiers;
  assert.deepStrictEqual([d.aantal, d.regels.totaal, d.regels.gemiddelde, d.regels.n, d.regels.ontbrekend], [4, 174, 58, 3, ['LEV-2026-08-D03']]);
  assert.ok(d.regels.totaal !== 58 * 14, 'totaal is de som van de dossiers, niet 58 × 14');
  assert.deepStrictEqual([d.blokken.totaal, d.blokken.gemiddelde, d.blokken.n, d.visma.totaal, d.visma.n], [18, 6, 3, 8, 2]);
  assert.deepStrictEqual([d.resterend.totaal, d.resterend.onbekend], [10, ['LEV-2026-08-D03']]);
  const dosTekst = await lees('#mmDossierBerekend');
  assert.ok(dosTekst.includes('Er zijn 4 dossiers ingevoerd, maar 14 diensttijdopgaven aangeleverd') && dosTekst.includes('58,00') && dosTekst.includes('174') && dosTekst.includes('gebaseerd op 3 van 4 dossiers'), dosTekst);
  // Ongeldige of dubbele invoer wordt niet opgeslagen; een nummer dat op een BSN lijkt geeft een waarschuwing.
  await page.fill('#mmDossiers tr[data-dossier="3"] [data-dveld="perioderegels"]', '-2');
  assert.ok((await lees('#mmDossierFouten')).includes('geheel getal van 0 of hoger'));
  await page.fill('#mmDossiers tr[data-dossier="3"] [data-dveld="perioderegels"]', '64');
  await page.fill('#mmDossiers tr[data-dossier="3"] [data-dveld="dossierId"]', 'LEV-2026-08-D01');
  assert.ok((await lees('#mmDossierFouten')).includes('komt al voor'));
  await page.fill('#mmDossiers tr[data-dossier="3"] [data-dveld="dossierId"]', '123456789');
  assert.ok((await lees('#mmDossierFouten')).includes('lijkt op een echt nummer'));
  await page.fill('#mmDossiers tr[data-dossier="3"] [data-dveld="dossierId"]', 'LEV-2026-08-D04');
  assert.strictEqual((await maand()).find((x) => x.id === 'PR24-LEV-2026-08').dossiers[3].perioderegels, 64);
  ok('5 gemiddelden', '4 dossiers (ID\'s voorgesteld als LEV-2026-08-D01…); 174 ABP-regels als som (niet 58 × 14), gemiddeld 58 over 3 ingevulde dossiers (D03 niet meegeteld); 18 blokken (gem. 6), 8 Visma-regels, 10 resterende blokken (D03 onvoldoende gegevens); waarschuwing 4 dossiers ≠ 14 aangeleverd zonder blokkade; ongeldig, dubbel en BSN-achtig dossier-ID afgevangen');

  // ---------- 7. Berekening per dossier en per diensttijdblok ----------
  await subtab('stappen');
  const stap = (s) => `#mmStappen tr[data-stapid="PR24-${s}"]`;
  await page.fill(`${stap('S01')} [data-sveld="actief"]`, '2');
  await page.fill(`${stap('S01')} [data-sveld="wacht"]`, '0');
  await page.selectOption(`${stap('S01')} [data-sveld="meetwijze"]`, 'Daadwerkelijk gemeten');
  await page.fill(`${stap('S01')} [data-sveld="waarnemingen"]`, '6');
  await page.fill(`${stap('S04')} [data-sveld="actief"]`, '1,5');
  await page.fill(`${stap('S04')} [data-sveld="wacht"]`, '0,5');
  await page.selectOption(`${stap('S04')} [data-sveld="meetwijze"]`, 'Daadwerkelijk gemeten');
  await page.selectOption(`${stap('S04')} [data-sveld="knelpunt"]`, 'ja');
  await page.fill(`#mmStappen tr[data-stapid="PR24-S04"] + tr [data-sveld="knelpuntToelichting"]`, 'Visma traag bij opslaan');
  b = await bereken('PR24-LEV-2026-08');
  const r = (id) => b.stappen.find((x) => x.stap.stapId === id);
  assert.deepStrictEqual([r('PR24-S01').actief.uitgevoerd, r('PR24-S01').actief.verwacht, r('PR24-S01').actief.resterend], [10, 28, 18]);
  assert.deepStrictEqual([r('PR24-S04').actief.uitgevoerd, r('PR24-S04').actief.verwacht, r('PR24-S04').actief.resterend, r('PR24-S04').wacht.uitgevoerd, r('PR24-S04').wacht.verwacht], [12, 27, 15, 4, 9]);
  assert.ok(r('PR24-S02').actief.verwacht === null, 'lege stap is onvoldoende gegevens');
  assert.ok(b.tijd.actief.verwacht.waarde === null && b.tijd.actief.verwacht.deelsom === 55 && b.tijd.actief.verwacht.nBekend === 2);
  assert.ok((await lees('#mmStapBerekend')).includes('onvoldoende gegevens') && (await lees('#mmStapBerekend')).includes('Deelsom van 2 van 9 stappen: 55,00 min'));
  assert.strictEqual((await maand()).find((x) => x.id === 'PR24-LEV-2026-08').stappen[3].knelpuntToelichting, 'Visma traag bij opslaan');
  // Rekeneenheid aanpassen: S01 per diensttijdblok → 2 × 8 Visma-regels en 2 × 18 blokken.
  await page.selectOption(`${stap('S01')} [data-sveld="eenheid"]`, 'blok');
  b = await bereken('PR24-LEV-2026-08');
  assert.deepStrictEqual([r('PR24-S01').actief.uitgevoerd, r('PR24-S01').actief.verwacht], [16, 36]);
  await page.selectOption(`${stap('S01')} [data-sveld="eenheid"]`, 'dossier');
  await page.fill(`${stap('S02')} [data-sveld="actief"]`, '-3');
  assert.ok((await lees('#mmStapFouten')).includes('PR24-S02 – Actieve tijd'));
  // Alle stappen invullen: S06–S09 geschat → schatting.
  const tijden = [2, 3, 6, 1.5, 1, 0.5, 2, 3, 1];
  for (let i = 1; i < 9; i++) {
    const s = stap(`S0${i + 1}`);
    await page.fill(`${s} [data-sveld="actief"]`, String(tijden[i]).replace('.', ','));
    if (i !== 3) await page.fill(`${s} [data-sveld="wacht"]`, '0');
    await page.selectOption(`${s} [data-sveld="meetwijze"]`, i < 5 ? 'Daadwerkelijk gemeten' : 'Geschat door onderzoeker');
    await page.fill(`${s} [data-sveld="waarnemingen"]`, '4');
  }
  b = await bereken('PR24-LEV-2026-08');
  // Verwacht per dossier: (2+3+6+2+3+1) × 14 = 238; per blok: (1,5+1+0,5) × 18 = 54 → 292. Uitgevoerd: 17 × 5 + 3 × 8 = 109.
  assert.deepStrictEqual([b.tijd.actief.verwacht.waarde, b.tijd.actief.uitgevoerd.waarde, b.tijd.actief.resterend.waarde, b.tijd.wacht.verwacht.waarde, b.tijd.wacht.uitgevoerd.waarde, b.tijd.totaleBelasting], [292, 109, 183, 9, 4, 301]);
  assert.ok(b.schatting && b.geschatteStappen.join() === 'PR24-S06,PR24-S07,PR24-S08,PR24-S09');
  await subtab('dashboard');
  const tijdTekst = await lees('#mmDashTijd');
  assert.ok(tijdTekst.includes('292,00 min') && tijdTekst.includes('4 uur 52 min') && tijdTekst.includes('4,87 uur') && tijdTekst.includes('109,00 min') && tijdTekst.includes('301,00 min') && tijdTekst.includes('schatting'), tijdTekst);
  await page.selectOption('#mmSortering', 'tijd');
  const volgorde = await page.$$eval('#mmDashStappen tbody tr td:first-child', (t) => t.map((x) => x.textContent));
  assert.deepStrictEqual(volgorde.slice(0, 3), ['PR24-S03', 'PR24-S02', 'PR24-S08'], 'gesorteerd op berekende actieve tijd');
  await page.click('details.herleiding summary');
  const herleiding = await lees('details.herleiding');
  assert.ok(['PR24-LEV-2026-08', 'LEV-2026-08-D01', 'Telling in e-dossier', '2,00 min × 14 aangeleverde diensttijdopgaven = 28,00 min', 'Daadwerkelijk gemeten'].every((w) => herleiding.includes(w)), herleiding);
  await page.screenshot({ path: path.join(UIT, 'scherm_maanddashboard.png'), fullPage: true });
  ok('7 per dossier en per blok', 'S01 per dossier: 2 × 5 = 10 uitgevoerd, 2 × 14 = 28 verwacht, 18 resterend; S04 per blok: 1,5 × 8 = 12 en 1,5 × 18 = 27, wacht 4 en 9; omzetten van S01 naar per blok geeft 2 × 8 = 16 en 2 × 18 = 36; totaal pas berekend als alle stappen gegevens hebben (eerst "onvoldoende gegevens", deelsom 55); daarna 292 min verwacht (4 uur 52 min, 4,87 uur), 109 uitgevoerd, 183 resterend, totale tijdsbelasting 301 min, gemarkeerd als schatting; sortering en herleiding');

  // Tijden overnemen naar SAMANAS augustus.
  await kies('SAMANAS', 8, 2026);
  await subtab('stappen');
  await page.click('[data-actie="maand-stappen-overnemen"]');
  await page.waitForSelector('#mmOvernameBron');
  await page.selectOption('#mmOvernameBron', 'PR24-LEV-2026-08');
  await knop('Tijden overnemen');
  const sam = (await maand()).find((x) => x.id === 'PR24-SAMANAS-2026-08');
  assert.ok(sam.stappen[0].actief === 2 && sam.stappen[3].actief === 1.5 && sam.stappen[3].knelpunt === null && sam.stappen[0].opmerking.includes('overgenomen uit PR24 – LEV – augustus 2026'));
  ok('overnemen', 'Tijden, rekeneenheid, meetwijze en waarnemingen overgenomen naar SAMANAS augustus, met herkomst in de opmerking; knelpunten niet overgenomen');

  // ---------- 8. Excel, CSV en JSON ----------
  const download = async (klik, naam) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), klik()]);
    const pad = path.join(UIT, naam);
    await dl.saveAs(pad);
    return pad;
  };
  const exportKeuze = (label) => async () => { await page.click('.maandselectie [data-actie="maand-exporteren"]'); await knop(label); };
  const xl = await download(exportKeuze('Excel (alle maandmetingen)'), 'maand_export.xlsx');
  const x = JSON.parse(execFileSync('python3', ['-c', `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(xl)})
def tabel(naam, eerste):
    rijen = list(wb[naam].iter_rows(values_only=True))
    k = next(i for i, r in enumerate(rijen) if r and r[0] == eerste)
    return [dict(zip(rijen[k], r)) for r in rijen[k+1:] if r and r[0] is not None]
uit = {"bladen": wb.sheetnames, "dash": tabel("PR24 Dashboard", "Proces"), "mm": tabel("PR24 Maandmetingen", "Proces"), "dos": tabel("PR24 Dossiers", "Proces"),
  "st": tabel("PR24 Processtappen", "Proces"), "ber": tabel("PR24 Berekeningen", "Maandmeting"),
  "kop": [c for r in wb["PR24 Dashboard"].iter_rows(values_only=True, max_row=3) for c in r if c]}
print(json.dumps(uit, default=str))`]).toString());
  assert.deepStrictEqual(x.bladen, ['PR24 Dashboard', 'PR24 Maandmetingen', 'PR24 Dossiers', 'PR24 Processtappen', 'PR24 Berekeningen']);
  const lev = x.dash.find((rr) => rr.Maandmeting === 'PR24 – LEV – augustus 2026');
  assert.ok(lev.Bestuur === 'LEV' && lev.Maand === 'augustus' && lev.Jaar === 2026 && lev['Geen diensttijdopgave'] === 16 && lev['Aanleverpercentage (%)'] === 46.7 && lev['Verwerkingspercentage (%)'] === 35.7
    && lev['Totaal ABP-periode-regels'] === 174 && lev['Gemiddeld ABP-periode-regels'] === 58 && lev['Totale verwachte actieve tijd (min)'] === 292 && lev['Totale verwachte tijdsbelasting (min, actief + wacht)'] === 301
    && lev.Schatting.startsWith('Ja') && lev['Bron van de aantallen'] === 'Maandrapportage HR (fictief)' && lev['Totaal aantal waarnemingen'] === 38, JSON.stringify(lev));
  assert.ok(x.kop.includes('Exportdatum en -tijd'));
  assert.strictEqual(x.dash.find((rr) => rr.Bestuur === 'SAMANAS')['Nog te verwerken'], 'onvoldoende gegevens');
  assert.deepStrictEqual(x.mm.map((rr) => [rr.Bestuur, rr.Maand, rr.Jaar, rr['Aantal nieuwe medewerkers'], rr['Aantal verwerkte diensttijdopgaven']]), [['LEV', 'augustus', 2026, 30, 5], ['SAMANAS', 'augustus', 2026, 22, null], ['LEV', 'september', 2026, 12, null]]);
  assert.strictEqual(x.dos.length, 4);
  assert.deepStrictEqual([x.dos[0].Bestuur, x.dos[0]['Dossier-ID'], x.dos[0]['ABP-periode-regels'], x.dos[0]['Bron of meetwijze'], x.dos[2]['ABP-periode-regels']], ['LEV', 'LEV-2026-08-D01', 50, 'Telling in e-dossier', null]);
  assert.ok(x.dos.every((rr) => rr['Exportdatum en -tijd']));
  assert.strictEqual(x.st.length, 27);
  const s04 = x.st.find((rr) => rr.Bestuur === 'LEV' && rr.Maand === 'augustus' && rr['Stap-ID'] === 'PR24-S04');
  assert.deepStrictEqual([s04.Rekeneenheid, s04['Actieve tijd per eenheid (min)'], s04['Wachttijd per eenheid (min)'], s04.Meetwijze, s04.Knelpunt, s04['Toelichting knelpunt']], ['Per diensttijdblok', 1.5, 0.5, 'Daadwerkelijk gemeten', 'Ja', 'Visma traag bij opslaan']);
  const ber = x.ber.filter((rr) => rr.Maandmeting === 'PR24 – LEV – augustus 2026');
  assert.ok(ber.some((rr) => rr['Berekening (met gebruikte getallen)'] === '2,00 min × 5 verwerkte diensttijdopgaven = 10,00 min' && rr.Waarde === 10));
  assert.ok(ber.some((rr) => rr['Berekening (met gebruikte getallen)'] === '1,50 min × 18 verwachte diensttijdblokken = 27,00 min' && rr['Aantal waarnemingen'] === 4));
  assert.ok(ber.some((rr) => rr.Uitkomst === 'Totaal ABP-periode-regels' && rr.Waarde === 174 && rr['Berekening (met gebruikte getallen)'] === 'LEV-2026-08-D01: 50 + LEV-2026-08-D02: 60 + LEV-2026-08-D04: 64 = 174'));
  ok('8a Excel', 'Excel met PR24 Dashboard (gelijk aan het scherm: 16, 46,7%, 35,7%, 174, 58, 292, 301, schatting, bron, waarnemingen), Maandmetingen, Dossiers, Processtappen en Berekeningen (formules met getallen, bijv. "2,00 min × 5 verwerkte diensttijdopgaven = 10,00 min"); proces, bestuur, maand, jaar en exportdatum overal aanwezig');

  const csvPad = await download(exportKeuze('CSV dossiers'), 'maand_dossiers.csv');
  const csv = fs.readFileSync(csvPad, 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
  assert.ok(csv[0].startsWith('Proces;Bestuur;Maand;Maandnummer;Jaar;Maandmeting;Dossier-ID;ABP-periode-regels') && csv.length === 5 && csv[1].startsWith('PR24;LEV;augustus;8;2026;PR24-LEV-2026-08;LEV-2026-08-D01;50;5;Volledig verwerkt;5'), csv.join('\n'));
  const csvSt = fs.readFileSync(await download(exportKeuze('CSV processtappen'), 'maand_stappen.csv'), 'utf8').trim().split(/\r\n/);
  assert.ok(csvSt.length === 28 && csvSt.some((rr) => rr.includes('PR24-S04') && rr.includes('1,5;0,5;Daadwerkelijk gemeten')));
  const csvMm = fs.readFileSync(await download(exportKeuze('CSV maandmetingen'), 'maand_maand.csv'), 'utf8').trim().split(/\r\n/);
  assert.ok(csvMm.length === 4 && csvMm[1].includes('PR24;LEV;augustus;8;2026;PR24-LEV-2026-08;30;14;5;Maandrapportage HR (fictief)'));
  ok('8b CSV', 'CSV maandmetingen, dossiers en processtappen met proces, bestuur, maand, jaar, decimale komma\'s en exportdatum');

  const voorBackup = await maand();
  const bkPad = await download(exportKeuze('JSON-back-up (volledig)'), 'maand_backup.json');
  const json = JSON.parse(fs.readFileSync(bkPad, 'utf8'));
  assert.ok(json.maandmetingen.length === 3 && json.processen.length === 1 && json.toolversie === '1.8.0');
  ok('8c JSON', 'Volledige JSON-back-up bevat de 3 maandmetingen (met dossiers en stappen) én de bestaande gegevens');

  // ---------- 9. Import en herstel ----------
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await page.click('.maandselectie [data-actie="maand-importeren"]').catch(() => {});
  await page.setInputFiles('#backupBestand', bkPad);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await lees('#dialoogInhoud')).includes('3 PR24-maandmetingen'));
  await knop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await knop('Sluiten');
  assert.deepStrictEqual(await maand(), voorBackup, 'maandmetingen hersteld zonder verlies');
  assert.deepStrictEqual((await opgeslagen()).maandmetingen, voorBackup, 'en lokaal opgeslagen');
  assert.strictEqual((await staat()).processen[0].procesId, 'PR10');
  await kies('LEV', 8, 2026);
  assert.ok((await lees('#mmDashFrequentie')).includes('46,7%'));
  // Vervangen herstelt na een wijziging de toestand van de back-up.
  await subtab('gegevens');
  await page.fill('#mmNieuwe', '31');
  await page.setInputFiles('#backupBestand', bkPad);
  await page.waitForSelector('#dialoog[open]');
  await knop('Huidige gegevens vervangen');
  const [veilig] = await Promise.all([page.waitForEvent('download'), knop('Ja, vervangen')]);
  assert.ok(veilig.suggestedFilename().startsWith('Meettool_veiligheidsbackup'));
  await page.waitForFunction(() => window.__meettool.maandStaat().maandmetingen[0].nieuweMedewerkers === 30);
  const veiligJson = JSON.parse(fs.readFileSync(await veilig.path(), 'utf8'));
  assert.strictEqual(veiligJson.maandmetingen[0].nieuweMedewerkers, 31, 'veiligheidsback-up bevat de gewijzigde maandmeting');
  // Ongeldige back-up wordt geweigerd.
  const fout = JSON.parse(JSON.stringify(json));
  fout.maandmetingen[0].verwerkt = 20;
  fs.writeFileSync(path.join(UIT, 'maand_fout.json'), JSON.stringify(fout));
  await page.setInputFiles('#backupBestand', path.join(UIT, 'maand_fout.json'));
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await lees('#dialoogInhoud')).includes('meer diensttijdopgaven verwerkt (20) dan aangeleverd (14)'));
  await knop('Sluiten');
  ok('9 import en herstel', 'Back-up in een lege browser samengevoegd: maandmetingen en bestaande gegevens identiek terug; "vervangen" herstelt na een wijziging (met veiligheidsback-up die de wijziging bevat); een back-up met verwerkt > aangeleverd wordt geweigerd');
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());

  // ---------- 10. Bestaande gegevens behouden ----------
  // Nieuwe context = lege browser; gebruik daarom een eigen scenario: bestaande gegevens + oude localStorage, dan het maanddashboard gebruiken.
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR10');
  await page.fill('#peNaam', 'Bestaand proces');
  for (const [veld, w] of [['#peUitvoering', 'zaak'], ['#peUitvoeringMv', 'zaken'], ['#peOmvang', 'regel'], ['#peOmvangMv', 'regels']]) await page.fill(veld, w);
  await page.fill('#procesEditor tr[data-index="0"] input[data-stapveld="naam"]', 'Behandelen');
  await page.click('[data-actie="proces-opslaan"]');
  await page.waitForFunction(() => window.__meettool.staat().processen.length === 1);
  await page.evaluate(() => { localStorage.setItem('meettool-veiligheidsbackup', '{"bestaand":true}'); localStorage.setItem('andere-toepassing', 'niet aanraken'); });
  await page.evaluate(() => window.__meettool.wachtOpOpslag());
  const staat2 = await staat();
  const sleutels2 = await andereSleutels();
  await tab('maand');
  await kies('LEV', 10, 2026);
  await page.click('.maandselectie [data-actie="maand-nieuw"]');
  await page.fill('#mmNieuwe', '8');
  await subtab('dossiers');
  await page.click('[data-actie="dossier-toevoegen"]');
  await page.click('#mmDossiers [data-actie="dossier-verwijderen"]');
  await knop('Dossier verwijderen');
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.deepStrictEqual(await staat(), staat2, 'IndexedDB-gegevens ongewijzigd');
  assert.deepStrictEqual(await andereSleutels(), sleutels2, 'andere localStorage-sleutels ongewijzigd');
  assert.strictEqual((await maand())[0].nieuweMedewerkers, 8, 'maandmeting blijft bewaard na herladen');
  assert.deepStrictEqual(staatVoor.processen.map((p) => p.procesId), ['PR10']);
  assert.deepStrictEqual(Object.keys(sleutelsVoor), Object.keys(sleutels2));
  // Onleesbare maandgegevens worden niet overschreven.
  await page.evaluate((k) => localStorage.setItem(k, '{kapot'), SLEUTEL);
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.ok((await lees('#mmOpslagStatus')).includes('Opslaan uitgeschakeld'));
  await kies('LEV', 11, 2026);
  await page.click('.maandselectie [data-actie="maand-nieuw"]');
  assert.strictEqual(await page.evaluate((k) => localStorage.getItem(k), SLEUTEL), '{kapot', 'onleesbare gegevens niet overschreven');
  ok('10 bestaande gegevens', 'Na gebruik van het maanddashboard en herladen zijn de bestaande gegevens (IndexedDB) en alle andere localStorage-sleutels ongewijzigd; de maandmeting blijft bewaard; onleesbare maandgegevens worden nooit overschreven');

  // ---------- Verwijderen met bevestiging ----------
  await page.evaluate((k) => localStorage.removeItem(k), SLEUTEL);
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  for (const [best, mnd] of [['LEV', 8], ['SAMANAS', 8]]) { await kies(best, mnd, 2026); await page.click('.maandselectie [data-actie="maand-nieuw"]'); }
  await kies('LEV', 8, 2026);
  await page.click('.maandselectie [data-actie="maand-verwijderen"]');
  await page.waitForSelector('#dialoog[open]');
  await knop('Annuleren');
  assert.strictEqual((await maand()).length, 2, 'annuleren verwijdert niets');
  await page.click('.maandselectie [data-actie="maand-verwijderen"]');
  await knop('Maandmeting verwijderen');
  assert.deepStrictEqual((await maand()).map((y) => y.id), ['PR24-SAMANAS-2026-08']);
  ok('verwijderen', 'Verwijderen vraagt bevestiging; na annuleren blijft alles staan, daarna verdwijnt alleen LEV augustus');

  // ---------- 11. Offline in de browser ----------
  assert.deepStrictEqual(netwerk, []);
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  ok('11 offline', 'Meettool.html geopend via file:// zonder server, Node.js of npm: 0 netwerkverzoeken en 0 JavaScript-fouten');
  await browser.close();
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
