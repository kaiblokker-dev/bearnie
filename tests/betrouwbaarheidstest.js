// Controletests voor de gebruiksvriendelijkheids- en betrouwbaarheidsronde (versie 1.4).
// Draait Chromium (Playwright) offline tegen Meettool.html via file://, in Nederlandse tijd.
// Gebruik: node tests/betrouwbaarheidstest.js   (vereist Playwright en python3 met openpyxl)
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HTML = path.resolve(__dirname, '..', 'Meettool.html');
const UIT = path.resolve(process.env.TEST_UITVOER || path.join(__dirname, 'uitvoer'));
fs.mkdirSync(UIT, { recursive: true });
const url = 'file://' + HTML;
const bijna = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const resultaten = [];
function ok(stap, tekst) { resultaten.push(`✔ ${stap}: ${tekst}`); console.log(`✔ ${stap}: ${tekst}`); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PAD ? { executablePath: process.env.CHROMIUM_PAD } : {});
  const netwerk = [];
  const fouten = [];
  const nieuweContext = async () => {
    const c = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 }, timezoneId: process.env.TEST_TIJDZONE || 'Europe/Amsterdam', locale: 'nl-NL' });
    await c.setOffline(true);
    c.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) netwerk.push(r.url()); });
    const p = await c.newPage();
    p.on('pageerror', (e) => fouten.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') fouten.push('console: ' + m.text()); });
    await p.goto(url);
    await p.waitForFunction(() => window.__meettool && window.__meettool.klaar);
    return { c, p };
  };
  let { c: ctx, p: page } = await nieuweContext();
  const tab = (naam) => page.click(`#tabs button[data-tab="${naam}"]`);
  const knop = (label) => page.click(`#dialoogKnoppen button:text-is("${label}")`);
  const staat = (p = page) => p.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.staat())));
  const download = async (p, actie, naam) => {
    const [dl] = await Promise.all([p.waitForEvent('download'), actie()]);
    const doel = path.join(UIT, naam || dl.suggestedFilename());
    await dl.saveAs(doel);
    return { pad: doel, naam: dl.suggestedFilename() };
  };
  const stapVeld = (stapId, veld) => `#mStappen tr[data-stap="${stapId}"] [data-veld="${veld}"]`;
  const vandaag = await page.evaluate(() => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });

  const maakProces = async (id, naam, eenheden, stappen) => {
    await tab('processen');
    await page.click('[data-actie="proces-nieuw"]');
    await page.fill('#peId', id);
    await page.fill('#peNaam', naam);
    for (const [veld, w] of [['#peUitvoering', eenheden[0]], ['#peUitvoeringMv', eenheden[1]], ['#peOmvang', eenheden[2]], ['#peOmvangMv', eenheden[3]]]) await page.fill(veld, w);
    for (let i = 1; i < stappen.length; i++) await page.click('[data-actie="stap-toevoegen"]');
    for (let i = 0; i < stappen.length; i++) await page.fill(`#procesEditor tr[data-index="${i}"] input[data-stapveld="naam"]`, stappen[i]);
    await page.click('[data-actie="proces-opslaan"]');
  };
  const vulMeting = async ({ proces, datum, mw, aantal = '1', omvang = '6', tijden, test = false, actiefTotaal = '', wachtTotaal = '' }) => {
    await tab('meting');
    await page.selectOption('#mProces', proces);
    await page.fill('#mDatum', datum);
    await page.fill('#mMedewerker', mw);
    await page.check('input[name="casustype"][value="Normaal"]');
    await page.fill('#mAantal', aantal);
    await page.fill('#mOmvang', omvang);
    await page.selectOption('#mMeetwijze', 'Gemeten');
    for (const [stapId, actief, wacht] of tijden) {
      await page.fill(stapVeld(stapId, 'actieveTijd'), String(actief));
      await page.fill(stapVeld(stapId, 'wachttijd'), String(wacht));
    }
    await page.fill('#mActiefTotaal', actiefTotaal);
    await page.fill('#mWachtTotaal', wachtTotaal);
    if (test) await page.check('#mTest'); else await page.uncheck('#mTest');
  };
  const slaMetingOp = async (verwachtAantal) => {
    await page.click('#mOpslaan');
    await page.waitForFunction((n) => window.__meettool.staat().procesmetingen.length === n, verwachtAantal);
  };
  const vulFrequentie = async ({ proces, mw, aantal, datum, test = false }) => {
    await tab('frequentie');
    await page.selectOption('#fProces', proces);
    await page.fill('#fMedewerker', mw);
    await page.fill('#fPeriode', 'eigen telling');
    await page.fill('#fDatum', datum);
    await page.selectOption('#fPeriodeEenheid', 'Week');
    await page.fill('#fAantal', String(aantal));
    await page.selectOption('#fMeetwijze', 'Geteld');
    await page.selectOption('#fBereik', 'Eigen werkzaamheden');
    await page.fill('#fAfbakening', `Eigen dossiers ${mw}`);
    await page.check('#fMeetellen');
    if (test) await page.check('#fTest'); else await page.uncheck('#fTest');
    await page.click('#frequentieFormulier button[type="submit"]');
  };

  // ---------- 1. Kalenderweek ----------
  const kw = await page.evaluate(() => window.__meettool.kalenderweek('2026-10-05'));
  assert.deepStrictEqual(kw, { jaar: 2026, week: 41, begin: '2026-10-05', eind: '2026-10-11' });
  const randen = await page.evaluate(() => ['2026-10-11', '2026-12-31', '2027-01-01', '2027-01-04', '2024-12-30'].map((d) => window.__meettool.kalenderweekTekst(d)));
  assert.deepStrictEqual(randen, [
    'Kalenderweek 41 van 2026 (5 t/m 11 oktober 2026)',
    'Kalenderweek 53 van 2026 (28 december 2026 t/m 3 januari 2027)',
    'Kalenderweek 53 van 2026 (28 december 2026 t/m 3 januari 2027)',
    'Kalenderweek 1 van 2027 (4 t/m 10 januari 2027)',
    'Kalenderweek 1 van 2025 (30 december 2024 t/m 5 januari 2025)',
  ]);
  await maakProces('PR24', 'Herberekening dossier', ['dossier', 'dossiers', 'diensttijdregistratie', 'diensttijdregistraties'], ['Dossier beoordelen', 'Herberekening vastleggen']);
  await tab('meting');
  await page.selectOption('#mProces', 'PR24');
  await page.fill('#mDatum', '2026-10-05');
  assert.ok((await page.textContent('#mKalenderweek')).includes('Kalenderweek 41 van 2026 (5 t/m 11 oktober 2026)'));
  ok('kalenderweek', '5 oktober 2026 → kalenderjaar 2026, week 41, 5 t/m 11 oktober 2026; ook jaarwisselingen (week 53 van 2026, week 1 van 2025) kloppen; formulier toont "Kalenderweek 41 van 2026 (5 t/m 11 oktober 2026)"');

  // ---------- 2. Totale tijdsbelasting: 55 dossiers × 22,50 min ----------
  await vulMeting({ proces: 'PR24', datum: '2026-10-05', mw: 'PZ01', tijden: [['PR24-S01', 10, 0], ['PR24-S02', 12, 0]], actiefTotaal: '22' });
  await slaMetingOp(1);
  await vulMeting({ proces: 'PR24', datum: '2026-10-06', mw: 'PZ02', tijden: [['PR24-S01', 11, 0], ['PR24-S02', 12, 0]] });
  await slaMetingOp(2);
  await vulFrequentie({ proces: 'PR24', mw: 'PZ01', aantal: 30, datum: '2026-10-05' });
  await vulFrequentie({ proces: 'PR24', mw: 'PZ02', aantal: 25, datum: '2026-10-07' });
  await page.waitForFunction(() => window.__meettool.staat().frequentiemetingen.length === 2);
  let t = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
  assert.ok(t.totaleFrequentie === 55 && bijna(t.gemiddeldeActief, 22.5) && bijna(t.minuten, 1237.5) && bijna(t.uren, 20.625), JSON.stringify(t));
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  let tot = await page.textContent('#rTotaal');
  assert.ok(tot.includes('55 dossiers per week') && tot.includes('22,50 min per dossier') && tot.includes('1.237,50 minuten per week') && tot.includes('20,63 uur per week'), tot);
  assert.ok(tot.includes('alle kalenderweken') && tot.includes('kalenderweek 41 van 2026') && tot.includes('uitgesloten') && tot.includes('nee (eigen werkzaamheden van verschillende medewerkers)') && tot.includes('2× gemeten'), 'statusregels totaal');
  await page.selectOption('#rTotaalWeek', '2026-W41');
  assert.ok((await page.textContent('#rTotaal')).includes('kalenderweek 41 van 2026 (geselecteerd)'));
  ok('tijdsbelasting', '55 dossiers per week × 22,50 min per dossier = 1.237,50 minuten = 20,63 uur per week (intern 20,625); totaaloverzicht toont medewerkerselectie, kalenderweek, uitsluiting testmetingen, overlapstatus en meetwijze');

  // ---------- 3. Eenheden ----------
  assert.ok(!tot.includes('n.v.t.'));
  await maakProces('PR30', 'Proces zonder eenheid', ['n.v.t.', 'n.v.t.', 'regel', 'regels'], ['Verwerken']);
  await vulMeting({ proces: 'PR30', datum: '2026-10-05', mw: 'PZ01', tijden: [['PR30-S01', 5, 0]] });
  await slaMetingOp(3);
  await vulFrequentie({ proces: 'PR30', mw: 'PZ01', aantal: 55, datum: '2026-10-05' });
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR30');
  const tot30 = await page.textContent('#resultatenInhoud');
  assert.ok(tot30.includes('55 uitvoeringen per week') && !tot30.includes('n.v.t. per week') && tot30.includes('ontbreekt de uitvoeringseenheid'), 'eenheid ontbreekt');
  ok('eenheden', 'Totale frequentie toont "55 dossiers per week"; bij een proces met eenheid "n.v.t." verschijnt "55 uitvoeringen per week" met een niet-blokkerende waarschuwing');

  // ---------- 4. Testmeting ----------
  await vulMeting({ proces: 'PR24', datum: '2026-10-07', mw: 'PZ03', tijden: [['PR24-S01', 50, 0], ['PR24-S02', 50, 0]], test: true });
  await slaMetingOp(4);
  await vulFrequentie({ proces: 'PR24', mw: 'PZ03', aantal: 10, datum: '2026-10-07', test: true });
  await page.waitForFunction(() => window.__meettool.staat().frequentiemetingen.length === 4);
  const st = await staat();
  assert.ok(st.procesmetingen.find((m) => m.metingId === 'M-PR24-003').testmeting === true && !('testmeting' in st.procesmetingen.find((m) => m.metingId === 'M-PR24-001')));
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  assert.ok(!(await page.isChecked('#rMetTest')), 'schakelaar staat standaard uit');
  let inhoud = await page.textContent('#resultatenInhoud');
  assert.ok(inhoud.includes('2 echte') && inhoud.includes('1 test/fictieve'), 'aantallen echt/fictief');
  t = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle', metTest: false }, 'Week', ''));
  assert.ok(t.aantalProcesmetingen === 2 && bijna(t.gemiddeldeActief, 22.5) && t.totaleFrequentie === 55, 'standaard alleen echte metingen');
  const stap = await page.evaluate(() => window.__meettool.stapSamenvatting('PR24', { meetwijze: 'alle' }, 'Normaal'));
  assert.ok(stap[0].actief.n === 2, 'stapmetingen van testmeting uitgesloten');
  await page.check('#rMetTest');
  inhoud = await page.textContent('#resultatenInhoud');
  t = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle', metTest: true }, 'Week', ''));
  assert.ok(t.aantalProcesmetingen === 3 && bijna(t.gemiddeldeActief, (22 + 23 + 100) / 3) && t.totaleFrequentie === 65, JSON.stringify(t));
  assert.ok(inhoud.includes('meegenomen') && (await page.textContent('#rTotaal')).includes('65 dossiers per week'));
  const stap2 = await page.evaluate(() => window.__meettool.stapSamenvatting('PR24', { meetwijze: 'alle', metTest: true }, 'Normaal'));
  assert.ok(stap2[0].actief.n === 3);
  await page.uncheck('#rMetTest');
  ok('testmeting', 'Eén echte en één fictieve meting: standaard alleen de echte metingen (gemiddelde 22,50, n = 2, totaal 55); met "Testmetingen meenemen" beide (n = 3, totaal 65); stapmetingen volgen de teststatus; aantallen echt/fictief zichtbaar');

  // ---------- 5. Verschil proces- en stapmetingen ----------
  await vulMeting({ proces: 'PR24', datum: '2026-10-08', mw: 'PZ01', tijden: [['PR24-S01', 10, 2], ['PR24-S02', 11, 0]], actiefTotaal: '22', wachtTotaal: '2' });
  const live = await page.textContent('#mBerekend');
  assert.ok(live.includes('de actieve tijd van de stapmetingen is samen 21,00 minuten, terwijl bij de procesmeting 22,00 minuten staat (verschil 1,00 minuut)'), live);
  assert.ok(!live.includes('wachttijd van de stapmetingen is samen'), 'geen waarschuwing voor gelijke wachttijd');
  await page.fill(stapVeld('PR24-S01', 'redenWachttijd'), 'Systeem traag');
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('verschil 1,00 minuut'));
  await knop('Toch opslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 5);
  const c = await page.evaluate(() => { const t = window.__meettool; const s = t.staat(); return t.controleProcesStap(s.procesmetingen.find((m) => m.metingId === 'M-PR24-004'), s.stapmetingen.filter((x) => x.metingId === 'M-PR24-004')); });
  assert.ok(c.heeftAfwijking && bijna(c.actief.verschil, -1) && !c.wacht.afwijking);
  // Tolerantie: 21,99 vs 22 geeft geen waarschuwing
  await vulMeting({ proces: 'PR24', datum: '2026-10-08', mw: 'PZ01', tijden: [['PR24-S01', 10.99, 0], ['PR24-S02', 11, 0]], actiefTotaal: '22' });
  assert.ok(!(await page.textContent('#mBerekend')).includes('Let op: de actieve tijd'));
  await page.click('[data-actie="meting-annuleren"]');
  ok('verschil', 'Procesmeting 22 min, som stapmetingen 21 min → waarschuwing met verschil 1 minuut, opslaan blijft mogelijk; 0,01 min verschil valt binnen de tolerantie');

  // ---------- 6. Dupliceren ----------
  await tab('overzicht');
  await page.click('[data-actie="meting-dupliceren"][data-id="M-PR24-001"]');
  assert.strictEqual(await page.inputValue('#mDatum'), vandaag);
  assert.ok((await page.textContent('#metingBewerkMelding')).includes('Kopie van meting M-PR24-001'));
  assert.strictEqual(await page.inputValue('#mMetingId'), 'M-PR24-005');
  assert.strictEqual(await page.inputValue(stapVeld('PR24-S01', 'actieveTijd')), '10');
  assert.strictEqual(await page.inputValue('#mMedewerker'), 'PZ01');
  const kwVandaag = await page.evaluate((d) => window.__meettool.kalenderweekTekst(d), vandaag);
  assert.ok((await page.textContent('#mKalenderweek')).includes(kwVandaag));
  await page.fill('#mMedewerker', 'PZ02');
  await slaMetingOp(6);
  const na = await staat();
  const kopie = na.procesmetingen.find((m) => m.metingId === 'M-PR24-005');
  const kopieStappen = na.stapmetingen.filter((x) => x.metingId === 'M-PR24-005');
  assert.ok(kopie && kopie.datum === vandaag && kopie.medewerkerId === 'PZ02' && kopie.aangemaakt !== na.procesmetingen.find((m) => m.metingId === 'M-PR24-001').aangemaakt);
  assert.deepStrictEqual(kopieStappen.map((x) => [x.stapId, x.actieveTijd, x.tijdvastlegging]), [['PR24-S01', 10, 'Gekopieerd'], ['PR24-S02', 12, 'Gekopieerd']]);
  assert.strictEqual(na.stapmetingen.filter((x) => x.metingId === 'M-PR24-001').length, 2, 'origineel ongewijzigd');
  assert.strictEqual(new Set(na.procesmetingen.map((m) => m.metingId)).size, na.procesmetingen.length);
  ok('dupliceren', `M-PR24-001 gedupliceerd naar nieuw ID M-PR24-005 met gekopieerde stapmetingen; meetdatum ${vandaag} (${kwVandaag}); pas opgeslagen na controle en aanpassing; origineel ongewijzigd`);

  // ---------- 7. Concept automatisch opslaan ----------
  await vulMeting({ proces: 'PR24', datum: '2026-10-09', mw: 'PZ04', tijden: [['PR24-S01', 7, 0]] });
  await page.waitForFunction(() => /Concept automatisch opgeslagen/.test(document.querySelector('#mConceptStatus').textContent));
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.ok((await page.textContent('#metingBewerkMelding')).includes('Niet-afgerond concept hersteld'));
  assert.ok((await page.inputValue('#mMedewerker')) === 'PZ04' && (await page.inputValue(stapVeld('PR24-S01', 'actieveTijd'))) === '7' && (await page.inputValue('#mDatum')) === '2026-10-09');
  assert.strictEqual((await staat()).procesmetingen.length, 6, 'concept is geen definitieve meting');
  await page.click('[data-actie="concept-meting-verwijderen"]');
  await knop('Concept verwijderen');
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('meettool-concept-meting')), null);
  // Concept na opslaan verwijderd
  await vulMeting({ proces: 'PR24', datum: '2026-10-09', mw: 'PZ04', tijden: [['PR24-S01', 7, 0], ['PR24-S02', 8, 0]] });
  await page.waitForFunction(() => localStorage.getItem('meettool-concept-meting') !== null);
  await slaMetingOp(7);
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('meettool-concept-meting')), null);
  // Concept bij aanpassen overschrijft niet ongemerkt een intussen gewijzigde meting
  await tab('overzicht');
  await page.click('[data-actie="meting-bewerken"][data-id="M-PR24-006"]');
  await page.fill('#mToelichting', 'concept-wijziging');
  await page.waitForFunction(() => localStorage.getItem('meettool-concept-meting') !== null);
  await page.evaluate(() => { const m = window.__meettool.staat().procesmetingen.find((x) => x.metingId === 'M-PR24-006'); m.gewijzigd = '2030-01-01T00:00:00.000Z'; });
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoogKop:text("Meting is intussen gewijzigd")');
  await knop('Annuleren');
  await page.click('[data-actie="meting-annuleren"]');
  ok('concept', 'Invoer wordt automatisch als concept bewaard ("Concept automatisch opgeslagen"), na vernieuwen hersteld, kan worden verwijderd en verdwijnt na definitief opslaan; een concept overschrijft een intussen gewijzigde meting niet ongemerkt');

  // ---------- 8. Uitleg-icoontjes ----------
  const uitleg = await page.evaluate(() => [...document.querySelectorAll('.uitleg-i')].map((e) => e.title));
  for (const term of ['Actieve tijd:', 'Wachttijd:', 'Omvang:', 'Uitvoeringseenheid:', 'Frequentie:', 'Frequentieperiode:', 'Kalenderweek', 'Meetellen in totaal:', 'Test/fictieve meting:']) {
    assert.ok(uitleg.some((t) => t.startsWith(term)), 'uitleg ' + term);
  }
  await tab('resultaten');
  const uitleg2 = await page.evaluate(() => [...document.querySelectorAll('#tab-resultaten .uitleg-i')].map((e) => e.title));
  assert.ok(uitleg2.some((x) => x.startsWith('Geschatte actieve tijdsbelasting:')) && uitleg2.some((x) => x.startsWith('Wachttijd:')));
  await tab('meting');
  await page.selectOption('#mProces', 'PR24');
  assert.ok((await page.evaluate(() => [...document.querySelectorAll('#mBerekend .uitleg-i')].map((e) => e.title))).some((x) => x.startsWith('Doorlooptijd:')));
  ok('uitleg', 'Korte uitleg bij actieve tijd, wachttijd, doorlooptijd, omvang, uitvoeringseenheid, frequentie, frequentieperiode, kalenderweek, geschatte actieve tijdsbelasting en meetellen in totaal');

  // ---------- 9. Excel ----------
  await tab('importexport');
  const xl = await download(page, () => page.click('[data-actie="excel-export"]'), 'export_v14.xlsx');
  const x = JSON.parse(execFileSync('python3', [path.join(__dirname, 'controleer_xlsx_v14.py'), xl.pad]).toString());
  assert.deepStrictEqual(x.bladen, ['Resultaten', 'Totaaloverzicht', 'Per medewerker', 'Procesmetingen', 'Stapmetingen', 'Frequentie', 'Methode']);
  assert.deepStrictEqual(x.pm001, ['2026-10-05', 2026, 41, '2026-10-05', '2026-10-11', 'Nee', 'dossier', 'diensttijdregistratie']);
  assert.strictEqual(x.pm003_test, 'Ja');
  assert.strictEqual(x.stap003_test, 'Ja');
  assert.deepStrictEqual(x.freq001, ['2026-10-05', 'Nee', 41]);
  // Excel moet exact de berekening van het scherm bevatten (inmiddels met meer echte metingen dan bij de 55 × 22,50-controle).
  const scherm = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
  assert.ok(x.totaal.freq === 55 && x.totaal.min === scherm.minuten && x.totaal.uur === scherm.uren && x.totaal.week === 'alle kalenderweken' && x.totaal.test === 'uitgesloten', JSON.stringify([x.totaal, scherm.minuten]));
  assert.ok(x.totaal.fids === 'F-PR24-001, F-PR24-002' && x.totaal.mids === scherm.metingIds.join(', ') && !x.totaal.mids.includes('M-PR24-003') && x.totaal.mw === scherm.medewerkerIds.join(', ') && x.totaal.bron.includes('Geteld'), JSON.stringify(x.totaal));
  assert.ok(x.ind003.startsWith('Nee – test'), x.ind003);
  assert.ok(x.ind004_afwijking.startsWith('Ja: Let op: de actieve tijd') && x.ind004_verschil === -1, JSON.stringify(x));
  assert.ok(x.freqstatus003.startsWith('Nee') && x.freqstatus001 === 'Ja');
  ok('excel', 'Excel bevat meetdatum, kalenderjaar, -week en begin/einde week, uitvoerings- en omvangseenheid, test/fictief (ook bij stapmetingen), meegenomen ja/nee met reden, afwijking proces/stappen, medewerker-ID\'s, bronnen, frequentie-ID\'s en procesmeting-ID\'s; Totaaloverzicht gelijk aan de schermberekening (onafgeronde waarden), testmeting M-PR24-003 niet meegenomen');

  // ---------- 10. Back-up en herstel in een lege tool ----------
  const voor = await staat();
  const voorTotaal = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
  const bk = await download(page, () => page.click('[data-actie="backup-download"]'), 'volledige_backup.json');
  const json = JSON.parse(fs.readFileSync(bk.pad, 'utf8'));
  assert.ok(json.schemaversie === 3 && json.aangemaaktOp && json.instellingen && json.instellingen.volgnummers, 'metadata');
  assert.deepStrictEqual(json.medewerkerIds, ['PZ01', 'PZ02', 'PZ03', 'PZ04']);
  assert.strictEqual(json.koppelingen.length, voor.procesmetingen.length);
  assert.deepStrictEqual(json.teststatussen, { procesmetingen: ['M-PR24-003'], frequentiemetingen: ['F-PR24-003'] });
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  assert.strictEqual((await staat()).procesmetingen.length, 0, 'lege tool');
  await page.click('#tabs button[data-tab="importexport"]');
  await page.setInputFiles('#backupBestand', bk.pad);
  await page.waitForSelector('#dialoog[open]');
  const samenvatting = await page.textContent('#dialoogInhoud');
  assert.ok(samenvatting.includes('7 procesmetingen') && samenvatting.includes('1 procesmeting(en), 1 frequentiemeting(en)') && samenvatting.includes('PZ01, PZ02, PZ03, PZ04'), samenvatting);
  await knop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await knop('Sluiten');
  const hersteld = await staat();
  assert.deepStrictEqual(hersteld, voor, 'alle gegevens, koppelingen, bronnen en teststatussen gelijk');
  const naTotaal = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
  assert.deepStrictEqual([naTotaal.totaleFrequentie, naTotaal.gemiddeldeActief, naTotaal.minuten, naTotaal.metingIds, naTotaal.frequenties.map((f) => f.frequentieId)],
    [voorTotaal.totaleFrequentie, voorTotaal.gemiddeldeActief, voorTotaal.minuten, voorTotaal.metingIds, voorTotaal.frequenties.map((f) => f.frequentieId)]);
  // Vervangen: eerst automatisch een veiligheidsback-up
  await page.setInputFiles('#backupBestand', bk.pad);
  await page.waitForSelector('#dialoog[open]');
  await knop('Huidige gegevens vervangen');
  const [veilig] = await Promise.all([page.waitForEvent('download'), knop('Ja, vervangen')]);
  assert.ok(veilig.suggestedFilename().startsWith('Meettool_veiligheidsbackup_'));
  assert.ok(await page.evaluate(() => !!localStorage.getItem('meettool-veiligheidsbackup')));
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 7);
  assert.deepStrictEqual(await staat(), voor);
  // Beschadigd en inconsistent bestand
  const kapot = path.join(UIT, 'kapot.json');
  fs.writeFileSync(kapot, fs.readFileSync(bk.pad, 'utf8').slice(0, 500));
  await page.setInputFiles('#backupBestand', kapot);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('kon niet worden gelezen'));
  await knop('Sluiten');
  const inconsistent = path.join(UIT, 'inconsistent.json');
  fs.writeFileSync(inconsistent, JSON.stringify({ ...json, teststatussen: { procesmetingen: [], frequentiemetingen: [] } }));
  await page.setInputFiles('#backupBestand', inconsistent);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('teststatussen komen niet overeen'));
  await knop('Sluiten');
  ok('back-up', 'Volledige back-up (schemaversie 3, tijdstip, medewerker-ID\'s, instellingen, koppelingen, teststatussen) hersteld in een lege tool: alle gegevens en resultaten identiek; vervangen maakt eerst een veiligheidsback-up; beschadigde of inconsistente bestanden worden geweigerd met een duidelijke melding');

  // ---------- 11. Bestaande gegevens (versie 1.3 zonder nieuwe velden) ----------
  const oud = JSON.parse(JSON.stringify(json));
  oud.toolversie = '1.3.0'; oud.schemaversie = 2;
  for (const k of ['aangemaaktOp', 'instellingen', 'medewerkerIds', 'koppelingen', 'teststatussen']) delete oud[k];
  for (const m of oud.procesmetingen) { delete m.testmeting; delete m.actieveTijdTotaal; delete m.wachttijdTotaal; }
  for (const f of oud.frequentiemetingen) { delete f.testmeting; delete f.meetdatum; }
  const oudPad = path.join(UIT, 'backup_v13.json');
  fs.writeFileSync(oudPad, JSON.stringify(oud));
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await page.click('#tabs button[data-tab="importexport"]');
  await page.setInputFiles('#backupBestand', oudPad);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('ouder formaat'));
  await knop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await knop('Sluiten');
  const s13 = await staat();
  assert.ok(s13.procesmetingen.every((m) => !('testmeting' in m)) && s13.procesmetingen.length === 7, 'geen velden toegevoegd');
  const t13 = await page.evaluate(() => window.__meettool.berekenTotaalOverzicht('PR24', { meetwijze: 'alle' }, 'Week', ''));
  // 6 PR24-metingen (de 7e is PR30); zonder teststatus gelden ze allemaal als echt.
  assert.ok(t13.aantalProcesmetingen === 6 && t13.kalenderweken.length === 0, JSON.stringify([t13.aantalProcesmetingen, t13.kalenderweken]));
  await page.click('#tabs button[data-tab="overzicht"]');
  assert.ok((await page.textContent('#overzichtTabel')).includes('week 41 van 2026'), 'kalenderweek uit bestaande datum');
  ok('bestaande gegevens', 'Back-up uit versie 1.3 (zonder teststatus, controletotalen of meetdatum frequentie) wordt veilig ingelezen zonder velden toe te voegen; alle oude metingen gelden als echt, kalenderweek wordt uit de bestaande datum berekend');

  assert.deepStrictEqual(netwerk, [], 'netwerkverzoeken: ' + netwerk.join(', '));
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  ok('offline', '0 netwerkverzoeken en 0 JavaScript-fouten');
  await browser.close();
  fs.writeFileSync(path.join(UIT, 'resultaat_betrouwbaarheid.txt'), resultaten.join('\n') + '\n');
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
