// Controletests voor knelpunten per processtap (versie 1.6). Offline via file://, in Nederlandse tijd.
// Gebruik: node tests/knelpuntentest.js   (vereist Playwright en python3 met openpyxl)
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
  const analyse = (casustype, filters = {}) => page.evaluate(([c, f]) => JSON.parse(JSON.stringify(window.__meettool.knelpuntAnalyse('PR24', { meetwijze: 'alle', ...f }, c))), [casustype, filters]);
  const stapRij = (stap) => `#mStappen tr[data-stap="PR24-${stap}"]`;
  const subRij = (stap) => `#mStappen tr[data-knelpunt-voor="PR24-${stap}"]`;

  // ---------- Proces met twee stappen ----------
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR24');
  await page.fill('#peNaam', 'Herberekening dossier');
  for (const [veld, w] of [['#peUitvoering', 'dossier'], ['#peUitvoeringMv', 'dossiers'], ['#peOmvang', 'dienstperiode'], ['#peOmvangMv', 'dienstperioden']]) await page.fill(veld, w);
  await page.fill('#procesEditor tr[data-index="0"] input[data-stapveld="naam"]', 'Dossier controleren');
  await page.click('[data-actie="stap-toevoegen"]');
  await page.fill('#procesEditor tr[data-index="1"] input[data-stapveld="naam"]', 'Dienstperioden vastleggen');
  await page.click('[data-actie="proces-opslaan"]');
  await page.waitForFunction(() => window.__meettool.staat().processtappen.length === 2);

  const kp = async (stap, { categorie, omschrijving, gevolgen = [], actief, wacht, bron } = {}) => {
    await page.selectOption(`${stapRij(stap)} [data-veld="knelpunt"]`, 'ja');
    const sub = subRij(stap);
    if (categorie) await page.selectOption(`${sub} [data-kveld="knelpuntCategorie"]`, categorie);
    if (omschrijving) await page.fill(`${sub} [data-kveld="knelpuntOmschrijving"]`, omschrijving);
    for (const g of gevolgen) await page.check(`${sub} [data-kgevolg][value="${g}"]`);
    if (actief !== undefined) await page.fill(`${sub} [data-kveld="knelpuntExtraActief"]`, actief);
    if (wacht !== undefined) await page.fill(`${sub} [data-kveld="knelpuntExtraWacht"]`, wacht);
    if (bron) await page.selectOption(`${sub} [data-kveld="knelpuntBron"]`, bron);
  };
  const vulMeting = async ({ mw, casus = 'Normaal', datum = '2026-10-05', tijden, test = false }) => {
    await tab('meting');
    await page.selectOption('#mProces', 'PR24');
    await page.fill('#mDatum', datum);
    await page.fill('#mMedewerker', mw);
    await page.check(`input[name="casustype"][value="${casus}"]`);
    await page.fill('#mAantal', '1');
    await page.fill('#mOmvang', '10');
    await page.selectOption('#mMeetwijze', 'Gemeten');
    for (const [stap, [a, w]] of Object.entries(tijden)) {
      await page.fill(`${stapRij(stap)} [data-veld="actieveTijd"]`, a);
      await page.fill(`${stapRij(stap)} [data-veld="wachttijd"]`, w);
      if (w !== '0') await page.fill(`${stapRij(stap)} [data-veld="redenWachttijd"]`, 'Wachten op werkgever');
    }
    if (test) await page.check('#mTest'); else await page.uncheck('#mTest');
  };
  const opslaan = async (n) => {
    await page.click('#mOpslaan');
    await page.waitForFunction((x) => window.__meettool.staat().procesmetingen.length === x, n, { timeout: 5000 }).catch(async (e) => {
      throw new Error(`Opslaan mislukt: ${await page.textContent('#mFouten')} | ${await page.isVisible('#dialoog[open]') ? await page.textContent('#dialoogInhoud') : ''}`);
    });
  };

  // ---------- Registratie: tonen/verbergen, validatie, opslag ----------
  await vulMeting({ mw: 'PZ01', tijden: { S01: ['10', '0'], S02: ['10', '0'] } });
  assert.ok(await page.isVisible(`${stapRij('S01')} [data-veld="knelpunt"]`), 'keuze knelpunt per stap zichtbaar');
  assert.ok(!(await page.isVisible(subRij('S01'))), 'vervolgvelden standaard verborgen');
  await page.selectOption(`${stapRij('S01')} [data-veld="knelpunt"]`, 'nee');
  assert.ok(!(await page.isVisible(subRij('S01'))), 'verborgen bij Nee');
  await kp('S01', { categorie: 'Systeem', omschrijving: 'Rekenmodule traag', gevolgen: ['Extra actieve tijd', 'Verhoogde foutkans'], actief: '-1', bron: 'Geobserveerd' });
  assert.ok(await page.isVisible(subRij('S01')), 'zichtbaar bij Ja');
  for (const c of ['Wachten', 'Systeem', 'Ontbrekende of onduidelijke informatie', 'Handmatige invoer', 'Controle of herstelwerk', 'Overdracht tussen personen of afdelingen', 'Afwijkende werkwijze', 'Anders']) {
    assert.ok(await page.$(`${subRij('S01')} [data-kveld="knelpuntCategorie"] option:text-is("${c}")`), 'categorie ' + c);
  }
  await page.selectOption(`${stapRij('S02')} [data-veld="knelpunt"]`, 'nee');
  await page.fill('#mBelangrijksteKnelpunt', 'Rekenmodule traag bij grote dossiers');
  await page.fill('#mBijzonderheden', 'Dossier met samenloop');
  await page.click('#mOpslaan');
  assert.ok((await page.textContent('#mFouten')).includes('mag niet negatief zijn'), 'negatieve extra tijd geweigerd');
  await page.fill(`${subRij('S01')} [data-kveld="knelpuntExtraActief"]`, '15');
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('is groter dan de gemeten actieve tijd van deze stap'), 'waarschuwing extra tijd > gemeten');
  await knop('Annuleren');
  await page.fill(`${subRij('S01')} [data-kveld="knelpuntExtraActief"]`, '3');
  await opslaan(1);
  let st = await staat();
  const s1 = st.stapmetingen.find((s) => s.metingId === 'M-PR24-001' && s.stapId === 'PR24-S01');
  const s2 = st.stapmetingen.find((s) => s.metingId === 'M-PR24-001' && s.stapId === 'PR24-S02');
  assert.deepStrictEqual([s1.knelpunt, s1.knelpuntCategorie, s1.knelpuntOmschrijving, s1.knelpuntGevolgen, s1.knelpuntExtraActief, s1.knelpuntExtraWacht, s1.knelpuntBron],
    [true, 'Systeem', 'Rekenmodule traag', ['Extra actieve tijd', 'Verhoogde foutkans'], 3, null, 'Geobserveerd']);
  assert.strictEqual(s2.knelpunt, false);
  assert.ok(!('knelpuntCategorie' in s2), 'bij Nee geen vervolgvelden opgeslagen');
  assert.strictEqual(st.procesmetingen[0].belangrijksteKnelpunt, 'Rekenmodule traag bij grote dossiers');
  assert.strictEqual(st.procesmetingen[0].bijzonderheden, 'Dossier met samenloop');
  ok('registratie', 'Per stap Knelpunt –/Nee/Ja; vervolgvelden alleen zichtbaar bij Ja met alle 8 categorieën; negatieve extra tijd geweigerd; extra tijd groter dan gemeten geeft waarschuwing; opgeslagen velden kloppen (onbekende extra wachttijd blijft leeg, niet 0); belangrijkste knelpunt en bijzonderheden bij de procesmeting');

  // ---------- Meer metingen ----------
  await vulMeting({ mw: 'PZ02', tijden: { S01: ['8', '0'], S02: ['12', '30'] } });
  await page.selectOption(`${stapRij('S01')} [data-veld="knelpunt"]`, 'nee');
  await kp('S02', { categorie: 'Wachten', gevolgen: ['Extra wachttijd'], wacht: '20', bron: 'Door medewerker aangegeven' });
  await opslaan(2);
  await vulMeting({ mw: 'PZ01', tijden: { S01: ['9', '0'], S02: ['11', '0'] } }); // geen knelpuntregistratie
  await opslaan(3);
  await vulMeting({ mw: 'PZ02', casus: 'Uitzondering', tijden: { S01: ['20', '60'], S02: ['15', '0'] } });
  await kp('S01', { categorie: 'Wachten', actief: '5', bron: 'Eigen inschatting' });
  await opslaan(4);
  await vulMeting({ mw: 'PZ01', tijden: { S01: ['10', '0'], S02: ['10', '0'] }, test: true });
  await kp('S01', { categorie: 'Anders', actief: '1' });
  await opslaan(5);
  st = await staat();
  assert.ok(st.stapmetingen.filter((s) => s.metingId === 'M-PR24-003').every((s) => !('knelpunt' in s)), 'niet ingevuld blijft ontbreken');

  // ---------- Analyse ----------
  const N = await analyse('Normaal');
  assert.deepStrictEqual([N.aantalMetingen, N.metingenMetKnelpunt, N.metingenZonderRegistratie, N.aantalKnelpunten], [3, ['M-PR24-001', 'M-PR24-002'], ['M-PR24-003'], 2]);
  assert.ok(bijna(N.percentageMetKnelpunt, 200 / 3));
  assert.deepStrictEqual([N.extraActief.n, N.extraActief.totaal, N.extraActief.gemiddelde, N.extraWacht.n, N.extraWacht.totaal], [1, 3, 3, 1, 20]);
  const ps = Object.fromEntries(N.perStap.map((r) => [r.stapId, [r.waarnemingen, r.geregistreerd, r.aantal, r.metingIds]]));
  assert.deepStrictEqual(ps, { 'PR24-S01': [3, 2, 1, ['M-PR24-001']], 'PR24-S02': [3, 2, 1, ['M-PR24-002']] });
  assert.deepStrictEqual(N.perCategorie.map((r) => [r.categorie, r.aantal, r.ids]), [['Wachten', 1, ['M-PR24-002/PR24-S02']], ['Systeem', 1, ['M-PR24-001/PR24-S01']]]);
  assert.deepStrictEqual(N.perMedewerker.map((r) => [r.medewerkerId, r.metingen, r.metKnelpunt, r.aantal, r.extraActief.totaal, r.extraWacht.totaal]), [['PZ01', 2, 1, 1, 3, null], ['PZ02', 1, 1, 1, null, 20]]);
  const U = await analyse('Uitzondering');
  assert.deepStrictEqual([U.aantalMetingen, U.metingenMetKnelpunt, U.percentageMetKnelpunt, U.extraActief.totaal, U.perCategorie.map((r) => r.categorie)], [1, ['M-PR24-004'], 100, 5, ['Wachten']]);
  const NT = await analyse('Normaal', { metTest: true });
  assert.deepStrictEqual([NT.aantalMetingen, NT.aantalKnelpunten, NT.perCategorie.map((r) => r.categorie)], [4, 3, ['Wachten', 'Systeem', 'Anders']]);
  const N1 = await analyse('Normaal', { medewerker: 'PZ01' });
  assert.deepStrictEqual([N1.aantalMetingen, N1.metingenMetKnelpunt], [2, ['M-PR24-001']]);
  ok('analyse', 'Normaal: 2 van 3 metingen met knelpunt (66,7%), M-PR24-003 zonder registratie; per stap 1 van 3 waarnemingen; per categorie Wachten 1 en Systeem 1 (herleidbaar naar MetingID/StapID); extra actief 3 min (n = 1), extra wacht 20 min; per medewerker PZ01 1 van 2, PZ02 1 van 1; Uitzondering apart (1 van 1, 100%); testmeting alleen met de schakelaar; medewerkerfilter werkt');

  // ---------- Geen dubbeltelling ----------
  const b1 = await page.evaluate(() => window.__meettool.berekenMeting(window.__meettool.staat().procesmetingen[0]));
  assert.strictEqual(b1.totaalActief, 20, 'extra tijd niet opgeteld bij procesduur');
  const zonder = await page.evaluate(() => {
    const t = window.__meettool;
    const voor = JSON.stringify(t.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
    const s = t.staat();
    const bewaard = s.stapmetingen.map((x) => ({ ...x }));
    for (const x of s.stapmetingen) for (const k of Object.keys(x)) if (k.startsWith('knelpunt')) delete x[k];
    const na = JSON.stringify(t.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
    s.stapmetingen.splice(0, s.stapmetingen.length, ...bewaard);
    return voor === na;
  });
  assert.ok(zonder, 'totaaloverzicht identiek met en zonder knelpunten');
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  const kaart = await page.textContent('#rKnelpunten');
  assert.ok(kaart.includes('Knelpuntenanalyse') && kaart.includes('Metingen met minimaal één knelpunt') && kaart.includes('66,7%') && kaart.includes('niet opgeteld'), kaart);
  await page.click('[data-actie="knelpunten-bekijken"]');
  await page.waitForSelector('#dialoog[open]');
  const lijst = await page.textContent('#dialoogInhoud');
  assert.ok(['M-PR24-001', 'PR24-S01', 'PZ01', 'week 41', 'Systeem', 'Rekenmodule traag', 'Geobserveerd', 'M-PR24-004'].every((w) => lijst.includes(w)), lijst);
  assert.ok(!lijst.includes('M-PR24-005'), 'testmeting niet in lijst');
  await knop('Sluiten');
  ok('geen dubbeltelling', 'Totale actieve tijd M-PR24-001 blijft 20 (niet 23); totaaloverzicht is identiek met en zonder knelpuntvelden; resultatenkaart en lijst "Alle knelpunten bekijken" tonen meting, stap, medewerker, week, categorie, omschrijving en bron');

  // ---------- Overzicht ----------
  await tab('overzicht');
  await page.click('[data-actie="meting-openen"][data-id="M-PR24-001"]');
  await page.waitForSelector('#dialoog[open]');
  const detail = await page.textContent('#dialoogInhoud');
  assert.ok(detail.includes('Rekenmodule traag bij grote dossiers') && detail.includes('Dossier met samenloop') && detail.includes('Ja – Systeem'), detail);
  await knop('Sluiten');

  // ---------- Dupliceren en concept ----------
  await page.click('[data-actie="meting-dupliceren"][data-id="M-PR24-001"]');
  assert.strictEqual(await page.inputValue(`${stapRij('S01')} [data-veld="knelpunt"]`), 'ja');
  assert.ok(await page.isVisible(subRij('S01')));
  assert.strictEqual(await page.inputValue(`${subRij('S01')} [data-kveld="knelpuntCategorie"]`), 'Systeem');
  await page.fill(`${subRij('S01')} [data-kveld="knelpuntOmschrijving"]`, 'Concepttekst');
  await page.waitForFunction(() => (localStorage.getItem('meettool-concept-meting') || '').includes('Concepttekst'));
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.strictEqual(await page.inputValue(`${subRij('S01')} [data-kveld="knelpuntOmschrijving"]`), 'Concepttekst', 'concept hersteld');
  assert.ok(await page.isChecked(`${subRij('S01')} [data-kgevolg][value="Verhoogde foutkans"]`));
  assert.strictEqual(await page.inputValue('#mBelangrijksteKnelpunt'), 'Rekenmodule traag bij grote dossiers');
  await page.click('[data-actie="meting-annuleren"]');
  ok('overzicht en concept', 'Detail toont knelpunt per stap, belangrijkste knelpunt en bijzonderheden; dupliceren neemt knelpunten over; concept bewaart en herstelt de knelpuntvelden');

  // ---------- Excel en CSV ----------
  await tab('importexport');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="excel-export"]')]);
  const xl = path.join(UIT, 'export_knelpunten.xlsx');
  await dl.saveAs(xl);
  const x = JSON.parse(execFileSync('python3', ['-c', `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(xl)})
def tabel(naam, eerste):
    rijen = list(wb[naam].iter_rows(values_only=True))
    k = next(i for i, r in enumerate(rijen) if r and r[0] == eerste)
    return rijen[k], [r for r in rijen[k+1:] if r and r[0]]
kop, data = tabel("Knelpunten", "ProcesID")
kn = [dict(zip(kop, r)) for r in data]
kop, data = tabel("Stapmetingen", "MetingID")
sm = [dict(zip(kop, r)) for r in data]
kop, data = tabel("Procesmetingen", "MetingID")
pm = [dict(zip(kop, r)) for r in data]
ana = [[c for c in r] for r in wb["Knelpuntenanalyse"].iter_rows(values_only=True)]
print(json.dumps({"bladen": wb.sheetnames, "kn": kn, "sm": sm, "pm": pm, "ana": ana}, default=str))`]).toString());
  assert.deepStrictEqual(x.bladen, ['Resultaten', 'Totaaloverzicht', 'Per medewerker', 'Knelpuntenanalyse', 'Steekproefresultaten', 'Steekproeven', 'Procesmetingen', 'Stapmetingen', 'Knelpunten', 'Frequentie', 'Methode']);
  assert.strictEqual(x.kn.length, 4, 'alle knelpunten (incl. test) in ruw tabblad');
  const k1 = x.kn.find((r) => r.MetingID === 'M-PR24-001');
  for (const [kol, w] of [['ProcesID', 'PR24'], ['StapID', 'PR24-S01'], ['MedewerkerID', 'PZ01'], ['Kalenderweek', 41], ['Meetwijze', 'Gemeten'], ['Casustype', 'Normaal'], ['Categorie', 'Systeem'],
    ['Omschrijving', 'Rekenmodule traag'], ['Gevolg(en)', 'Extra actieve tijd; Verhoogde foutkans'], ['Geschatte extra actieve tijd (min)', 3], ['Geschatte extra wachttijd (min)', null], ['Bron', 'Geobserveerd']]) {
    assert.deepStrictEqual(k1[kol], w, kol);
  }
  assert.ok(Object.keys(k1).some((k) => k.startsWith('Meetdatum')), 'meetdatum');
  assert.strictEqual(x.kn.find((r) => r.MetingID === 'M-PR24-005')['Test/fictief'], 'Ja');
  const sm = (m, s) => x.sm.find((r) => r.MetingID === m && r.StapID === s);
  assert.deepStrictEqual([sm('M-PR24-001', 'PR24-S01')['Knelpunt aanwezig'], sm('M-PR24-001', 'PR24-S02')['Knelpunt aanwezig'], sm('M-PR24-003', 'PR24-S01')['Knelpunt aanwezig']], ['Ja', 'Nee', 'Niet ingevuld']);
  assert.strictEqual(sm('M-PR24-002', 'PR24-S02')['Knelpunt: geschatte extra wachttijd (min)'], 20);
  const p1 = x.pm.find((r) => r.MetingID === 'M-PR24-001');
  assert.deepStrictEqual([p1['Belangrijkste knelpunt'], p1['Bijzonderheden of uitzonderingen']], ['Rekenmodule traag bij grote dossiers', 'Dossier met samenloop']);
  const anaKop = x.ana.findIndex((r) => r[0] === 'ProcesID' && r[1] === 'Casustype');
  const anaN = x.ana.slice(anaKop + 1).find((r) => r[0] === 'PR24' && r[1] === 'Normaal');
  assert.ok(anaN[2] === 3 && anaN[3] === 2 && bijna(anaN[4], 200 / 3) && anaN[6] === 2, JSON.stringify(anaN));
  ok('excel', 'Excel: tabbladen Knelpuntenanalyse (2 van 3, 66,7%) en Knelpunten (1 rij per knelpunt met proces-, meting-, stap- en medewerker-ID, datum, kalenderweek, meetwijze, casustype en test/fictief); Stapmetingen met Ja/Nee/Niet ingevuld en knelpuntvelden; Procesmetingen met belangrijkste knelpunt en bijzonderheden');

  const [cv] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="csv-knelpunten"]')]);
  const csvPad = path.join(UIT, 'knelpunten.csv');
  await cv.saveAs(csvPad);
  const csv = fs.readFileSync(csvPad, 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
  assert.ok(csv[0].startsWith('ProcesID;') && csv[0].includes('StapID') && csv[0].includes('Kalenderweek') && csv.length === 5, csv.join('\n'));
  assert.ok(csv.some((r) => r.includes('M-PR24-001') && r.includes('PR24-S01') && r.includes('Rekenmodule traag') && r.includes('Geobserveerd')));
  ok('csv', 'CSV Knelpunten: één regel per knelpunt met alle herleidingsvelden');

  // ---------- Back-up ----------
  const voor = await staat();
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="backup-download"]')]);
  const bkPad = path.join(UIT, 'backup_knelpunten.json');
  await bk.saveAs(bkPad);
  const json = JSON.parse(fs.readFileSync(bkPad, 'utf8'));
  assert.deepStrictEqual(json.stapmetingen.find((s) => s.metingId === 'M-PR24-001' && s.stapId === 'PR24-S01').knelpuntGevolgen, ['Extra actieve tijd', 'Verhoogde foutkans']);
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await tab('importexport');
  await page.setInputFiles('#backupBestand', bkPad);
  await page.waitForSelector('#dialoog[open]');
  await knop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await knop('Sluiten');
  assert.deepStrictEqual(await staat(), voor, 'herstel zonder verlies');
  for (const [wijzig, melding] of [
    [(s) => { s.knelpuntCategorie = 'Onzin'; }, 'knelpuntcategorie is ongeldig'],
    [(s) => { s.knelpuntGevolgen = ['Onzin']; }, 'gevolg(en) van het knelpunt zijn ongeldig'],
    [(s) => { s.knelpuntExtraActief = -2; }, 'geschatte extra tijd van het knelpunt is ongeldig'],
    [(s) => { s.knelpunt = 'ja'; }, '"knelpunt aanwezig" is ongeldig'],
  ]) {
    const fout = JSON.parse(JSON.stringify(json));
    wijzig(fout.stapmetingen.find((s) => s.knelpunt === true));
    fs.writeFileSync(path.join(UIT, 'knelpunt_fout.json'), JSON.stringify(fout));
    await page.setInputFiles('#backupBestand', path.join(UIT, 'knelpunt_fout.json'));
    await page.waitForSelector('#dialoog[open]');
    assert.ok((await page.textContent('#dialoogInhoud')).includes(melding), melding);
    await knop('Sluiten');
  }
  ok('back-up', 'JSON-back-up bevat alle knelpuntvelden en wordt zonder verlies hersteld; ongeldige categorie, gevolg, extra tijd of ja/nee-waarde wordt geweigerd');

  // ---------- Demogegevens ----------
  await tab('importexport');
  await page.click('[data-actie="demo-laden"]').catch(() => {});
  if (await page.isVisible('#dialoog[open]')) await knop('Demogegevens laden').catch(() => {});
  const demo = await page.evaluate(() => window.__meettool.staat().stapmetingen.filter((s) => s.demo && s.knelpunt === true).length);
  if (demo) ok('demo', `Demogegevens bevatten ${demo} fictieve knelpunten`);

  assert.deepStrictEqual(netwerk, []);
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  ok('offline', '0 netwerkverzoeken en 0 JavaScript-fouten');
  await browser.close();
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
