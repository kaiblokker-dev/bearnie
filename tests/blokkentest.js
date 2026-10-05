// Controletests voor diensttijdblokken (versie 1.5). Offline via file://, in Nederlandse tijd.
// Gebruik: node tests/blokkentest.js   (vereist Playwright en python3 met openpyxl)
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
  const totaal = (filters = {}, week = '') => page.evaluate(([f, w]) => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle', ...f }, 'Week', w), [filters, week]);

  const maakProces = async (id, eenheden) => {
    await tab('processen');
    await page.click('[data-actie="proces-nieuw"]');
    await page.fill('#peId', id);
    await page.fill('#peNaam', 'Herberekening dossier');
    for (const [veld, w] of [['#peUitvoering', eenheden[0]], ['#peUitvoeringMv', eenheden[1]], ['#peOmvang', eenheden[2]], ['#peOmvangMv', eenheden[3]]]) await page.fill(veld, w);
    await page.fill('#procesEditor tr[data-index="0"] input[data-stapveld="naam"]', 'Beoordelen en vastleggen');
    await page.click('[data-actie="proces-opslaan"]');
  };
  const vulMeting = async ({ proces = 'PR24', mw = 'PZ01', datum = '2026-10-05', aantal = '1', omvang, blokken, actief, test = false }) => {
    await tab('meting');
    await page.selectOption('#mProces', proces);
    await page.fill('#mDatum', datum);
    await page.fill('#mMedewerker', mw);
    await page.check('input[name="casustype"][value="Normaal"]');
    await page.fill('#mAantal', aantal);
    await page.fill('#mOmvang', omvang);
    if (blokken !== undefined) await page.fill('#mBlokken', blokken);
    await page.selectOption('#mMeetwijze', 'Gemeten');
    await page.fill(`#mStappen tr[data-stap="${proces}-S01"] [data-veld="actieveTijd"]`, actief);
    await page.fill(`#mStappen tr[data-stap="${proces}-S01"] [data-veld="wachttijd"]`, '0');
    if (test) await page.check('#mTest'); else await page.uncheck('#mTest');
  };
  const opslaan = async (n) => {
    await page.click('#mOpslaan');
    await page.waitForFunction((x) => window.__meettool.staat().procesmetingen.length === x, n);
  };

  // ---------- Invoerveld ----------
  await maakProces('PR24', ['dossier', 'dossiers', 'dienstperiode', 'dienstperioden']);
  await tab('meting');
  await page.selectOption('#mProces', 'PR24');
  assert.ok(await page.isVisible('#mBlokken'), 'veld zichtbaar bij PR24');
  assert.ok((await page.textContent('#mBlokkenVeld')).includes('Het aantal aaneengesloten diensttijdblokken dat na beoordeling van de ABP-periode-regels overblijft en mogelijk als afzonderlijke registratie in Visma wordt ingevoerd.'));
  for (const fout of ['2,5', '-1']) {
    await vulMeting({ omvang: '40', blokken: fout, actief: '20' });
    await page.click('#mOpslaan');
    assert.ok((await page.textContent('#mFouten')).includes('geheel getal van 0 of hoger'), 'weigert ' + fout);
  }
  await vulMeting({ omvang: '40', blokken: '50', actief: '20' });
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('Het aantal diensttijdblokken (50) is groter dan het aantal dienstperioden (40)'));
  await knop('Annuleren');
  ok('invoer', 'Veld zichtbaar bij PR24 met helptekst; 2,5 en -1 worden geweigerd; 50 blokken bij 40 dienstperioden geeft een waarschuwing die opslaan niet blokkeert');

  // ---------- Controlevoorbeeld ----------
  await page.fill('#mBlokken', '4');
  await opslaan(1);
  assert.strictEqual((await staat()).procesmetingen[0].aantalBlokken, 4);
  await tab('frequentie');
  await page.selectOption('#fProces', 'PR24');
  await page.fill('#fMedewerker', 'PZ01');
  await page.fill('#fPeriode', 'eigen telling');
  await page.fill('#fDatum', '2026-10-05');
  await page.selectOption('#fPeriodeEenheid', 'Week');
  await page.fill('#fAantal', '12');
  await page.selectOption('#fMeetwijze', 'Geteld');
  await page.selectOption('#fBereik', 'Eigen werkzaamheden');
  await page.check('#fMeetellen');
  await page.click('#frequentieFormulier button[type="submit"]');
  await page.waitForFunction(() => window.__meettool.staat().frequentiemetingen.length === 1);
  let t = await totaal();
  assert.ok(bijna(t.blokken.omvangPerDossier.waarde, 40) && bijna(t.blokken.blokkenPerDossier.waarde, 4) && bijna(t.blokken.actiefPerBlok.waarde, 5) && bijna(t.blokkenPerPeriode, 48), JSON.stringify(t.blokken));
  assert.ok(bijna(t.blokken.verhouding.waarde, 0.1) && t.totaleFrequentie === 12 && bijna(t.minuten, 240) && bijna(t.uren, 4), 'tijdsbelasting ongewijzigd');
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  let tekst = await page.textContent('#rTotaal');
  assert.ok(tekst.includes('40 dienstperioden resulteerden in 4 diensttijdblokken.'), 'verhoudingstekst');
  assert.ok(tekst.includes('240,00 minuten per week') && tekst.includes('4,00 uur per week') && tekst.includes('48,00') && tekst.includes('5,00 min'), tekst);
  assert.ok(tekst.includes('Gebruikte procesmeting-ID') && tekst.includes('M-PR24-001') && tekst.includes('1× gemeten') && tekst.includes('Geteld'));
  ok('controlevoorbeeld', '1 dossier, 40 dienstperioden, 4 blokken, 20 min; 12 dossiers per week → 40 dienstperioden en 4 blokken per dossier, 5 min per blok, 48 blokken per week; tijdsbelasting blijft 12 × 20 = 240 min = 4 uur; "40 dienstperioden resulteerden in 4 diensttijdblokken."');

  // ---------- Weging (totaal ÷ totaal) en lege waarden ----------
  await vulMeting({ omvang: '20', actief: '30' }); // zonder aantal blokken
  await opslaan(2);
  await vulMeting({ aantal: '2', omvang: '60', blokken: '2', actief: '40' });
  await opslaan(3);
  t = await totaal();
  assert.ok(bijna(t.blokken.blokkenPerDossier.waarde, (4 + 2) / (1 + 2)) && t.blokken.blokkenPerDossier.n === 2, 'blokken per dossier gewogen');
  assert.ok(bijna(t.blokken.actiefPerBlok.waarde, (20 + 40) / (4 + 2)), 'actieve tijd per blok gewogen');
  assert.ok(bijna(t.blokken.verhouding.waarde, (4 + 2) / (40 + 60)), 'verhouding gewogen');
  assert.ok(bijna(t.blokken.omvangPerDossier.waarde, (40 + 20 + 60) / (1 + 1 + 2)) && t.blokken.omvangPerDossier.n === 3, 'meting zonder blokken telt mee bij dienstperioden');
  assert.deepStrictEqual(t.blokken.metingenZonderBlokken, ['M-PR24-002']);
  assert.strictEqual(t.aantalProcesmetingen, 3, 'meting zonder blokken blijft in andere resultaten');
  assert.ok(!('aantalBlokken' in (await staat()).procesmetingen[1]) || (await staat()).procesmetingen[1].aantalBlokken === null, 'leeg blijft leeg');
  ok('weging', 'Gemiddelden als totaal ÷ totaal: (4+2)/(1+2) = 2 blokken per dossier, (20+40)/(4+2) = 10 min per blok, (4+2)/(40+60) = 0,06; meting zonder aantal blokken valt alleen buiten de berekeningen per blok');

  // ---------- Filters en testmetingen ----------
  await vulMeting({ mw: 'PZ02', omvang: '10', blokken: '10', actief: '10', test: true });
  await opslaan(4);
  t = await totaal();
  assert.strictEqual(t.blokken.aantalMetingen, 3, 'testmeting standaard uitgesloten');
  const tTest = await totaal({ metTest: true });
  assert.ok(tTest.blokken.aantalMetingen === 4 && bijna(tTest.blokken.blokkenPerDossier.waarde, (4 + 2 + 10) / (1 + 2 + 1)));
  await vulMeting({ mw: 'PZ02', datum: '2026-10-12', omvang: '8', blokken: '1', actief: '12' });
  await opslaan(5);
  const tPZ01 = await totaal({ medewerker: 'PZ01' });
  assert.ok(tPZ01.blokken.aantalMetingen === 3 && !tPZ01.blokken.metingIds.includes('M-PR24-005'), 'medewerkerfilter');
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  await page.selectOption('#rMedewerker', 'PZ01');
  assert.ok((await page.textContent('#rTotaal')).includes('gemiddelde van medewerker PZ01'));
  await page.selectOption('#rMedewerker', '');
  // Kalenderweek: frequentie alleen in week 41; in een andere week is er geen frequentie en dus geen schatting per week
  const tWeek = await totaal({}, '2026-W41');
  assert.ok(tWeek.totaleFrequentie === 12 && isFinite(tWeek.blokkenPerPeriode));
  const tAnders = await totaal({}, '2026-W42');
  assert.ok(tAnders.totaleFrequentie === null && tAnders.blokkenPerPeriode === null);
  ok('filters', 'Testmetingen standaard uitgesloten en meegenomen met de schakelaar; medewerkerfilter en kalenderweek werken door in de blokkenberekeningen');

  // ---------- Ander proces: veld verborgen tot de instelling aan staat ----------
  await maakProces('PR40', ['zaak', 'zaken', 'regel', 'regels']);
  await tab('meting');
  await page.selectOption('#mProces', 'PR40');
  assert.ok(!(await page.isVisible('#mBlokken')), 'verborgen bij ander proces');
  await tab('processen');
  await page.click('[data-actie="proces-bewerken"][data-id="PR40"]');
  await page.check('#peBlokken');
  await page.click('[data-actie="proces-opslaan"]');
  await tab('meting');
  await page.selectOption('#mProces', 'PR40');
  assert.ok(await page.isVisible('#mBlokken'), 'zichtbaar na aanzetten');
  await page.click('[data-actie="meting-annuleren"]');
  ok('instelling', 'Bij andere processen is het veld verborgen tot "diensttijdblokken vastleggen" in Processen beheren aan staat; bij PR24 standaard aan');

  // ---------- Dupliceren en concept ----------
  await tab('overzicht');
  await page.click('[data-actie="meting-dupliceren"][data-id="M-PR24-001"]');
  assert.strictEqual(await page.inputValue('#mBlokken'), '4');
  await page.waitForFunction(() => localStorage.getItem('meettool-concept-meting') !== null);
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.strictEqual(await page.inputValue('#mBlokken'), '4', 'concept herstelt aantal blokken');
  await opslaan(6);
  assert.strictEqual((await staat()).procesmetingen.find((m) => m.metingId === 'M-PR24-006').aantalBlokken, 4);
  ok('dupliceren', 'Dupliceren neemt het aantal diensttijdblokken over; het concept bewaart en herstelt het veld');

  // ---------- Excel ----------
  await tab('importexport');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="excel-export"]')]);
  const xl = path.join(UIT, 'export_blokken.xlsx');
  await dl.saveAs(xl);
  const scherm = await totaal();
  const x = JSON.parse(execFileSync('python3', ['-c', `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(xl)})
def tabel(naam, eerste):
    rijen = list(wb[naam].iter_rows(values_only=True))
    k = next(i for i, r in enumerate(rijen) if r and r[0] == eerste)
    return rijen[k], [r for r in rijen[k+1:] if r and r[0]]
kop, data = tabel("Procesmetingen", "MetingID")
pm = {r[0]: r[kop.index("Aantal resulterende diensttijdblokken")] for r in data}
kop, data = tabel("Totaaloverzicht", "ProcesID")
r = next(r for r in data if r[0] == "PR24" and r[kop.index("Kalenderweek (selectie)")] == "alle kalenderweken")
g = lambda n, kop=kop, r=r: r[kop.index(n)]
kop, data = tabel("Per medewerker", "MetingID")
ind = {r[0]: [r[kop.index("Aantal resulterende diensttijdblokken")], r[kop.index("Actieve tijd per diensttijdblok (min)")]] for r in data}
methode = " ".join(str(c) for rr in wb["Methode"].iter_rows(values_only=True) for c in rr if c)
print(json.dumps({"pm": pm, "totaal": [g("Totaal diensttijdblokken"), g("Gemiddeld aantal diensttijdblokken per uitvoering"), g("Gemiddelde actieve tijd per diensttijdblok (min)"), g("Geschat aantal diensttijdblokken per periode"), g("Verhouding diensttijdblokken / omvang"), g("Geschatte actieve tijdsbelasting (min)"), g("MetingID's met diensttijdblokken")], "ind": ind, "methode": "NIET met het aantal blokken vermenigvuldigd" in methode}))`]).toString());
  assert.deepStrictEqual([x.pm['M-PR24-001'], x.pm['M-PR24-002']], [4, null]);
  assert.ok(x.totaal[0] === scherm.blokken.totaalBlokken && x.totaal[1] === scherm.blokken.blokkenPerDossier.waarde && x.totaal[2] === scherm.blokken.actiefPerBlok.waarde
    && x.totaal[3] === scherm.blokkenPerPeriode && x.totaal[4] === scherm.blokken.verhouding.waarde && x.totaal[5] === scherm.minuten, JSON.stringify([x.totaal, scherm.blokken]));
  assert.deepStrictEqual(x.ind['M-PR24-001'], [4, 5]);
  assert.ok(x.methode);
  ok('excel', 'Excel: aantal diensttijdblokken in de ruwe procesmetingen (leeg blijft leeg), in Totaaloverzicht (gelijk aan het scherm) en per meting met actieve tijd per blok; Methode legt uit dat de tijdsbelasting niet met de blokken wordt vermenigvuldigd');

  // ---------- Back-up en bestaande gegevens ----------
  const voor = await staat();
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="backup-download"]')]);
  const bkPad = path.join(UIT, 'backup_blokken.json');
  await bk.saveAs(bkPad);
  const json = JSON.parse(fs.readFileSync(bkPad, 'utf8'));
  assert.strictEqual(json.procesmetingen.find((m) => m.metingId === 'M-PR24-001').aantalBlokken, 4);
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await tab('importexport');
  await page.setInputFiles('#backupBestand', bkPad);
  await page.waitForSelector('#dialoog[open]');
  await knop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await knop('Sluiten');
  assert.deepStrictEqual(await staat(), voor, 'herstel zonder verlies');
  // Ongeldig aantal blokken in een back-up wordt geweigerd
  const fout = JSON.parse(JSON.stringify(json));
  fout.procesmetingen[0].aantalBlokken = 2.5;
  fs.writeFileSync(path.join(UIT, 'blokken_fout.json'), JSON.stringify(fout));
  await page.setInputFiles('#backupBestand', path.join(UIT, 'blokken_fout.json'));
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('aantal diensttijdblokken moet een geheel getal'));
  await knop('Sluiten');
  ok('back-up', 'JSON-back-up bevat het aantal diensttijdblokken en wordt zonder verlies hersteld; een ongeldig aantal wordt bij herstel geweigerd');

  assert.deepStrictEqual(netwerk, []);
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  ok('offline', '0 netwerkverzoeken en 0 JavaScript-fouten');
  await browser.close();
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
