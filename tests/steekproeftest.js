// Controletests voor steekproeven en dossierkenmerken (versie 1.7). Offline via file://, in Nederlandse tijd.
// Gebruik: node tests/steekproeftest.js   (vereist Playwright en python3 met openpyxl)
//
// Controlevoorbeeld (steekproef SP-PR24-001, populatie 400, beoogd 20 dossiers):
//   M-PR24-001  nr 1  D-001  Normaal       Gemeten       detail 5+12+3 = 20 min, wacht 0   Gemiddeld  40 regels  4 blokken  2 onderbr.  tijdrovend S02  knelpunt Systeem
//   M-PR24-002  nr 2  D-002  Normaal       Geobserveerd  GEEN detail: totaal 30, wacht 10  Complex    60 regels  6 blokken  4 onderbr.  tijdrovend S02  knelpunt Wachten
//   M-PR24-003  nr 3  D-003  Uitzondering  Geschat       detail 4+6+2 = 12, wacht 5        Eenvoudig  10 regels  –          0 onderbr.  tijdrovend S01  knelpunt nee, stap S02 Wachten
//   M-PR24-004  nr 4  D-004  TEST          Gemeten       detail 50+50+50                     (telt standaard niet mee)
//   M-PR24-005  nr 5  D-005  Normaal       Gemeten       detail 10+10+10 = 30 (eerst zonder steekproef, later gekoppeld)
// Verwacht (zonder test): 4 van 20 dossiers; actief 20, 30, 12, 30 → totaal 92, gemiddelde 23, mediaan 25, min 12, max 30;
// wacht totaal 15, gemiddeld 3,75; regels 110/3, blokken 10/2 = 5, onderbrekingen 6/3 = 2;
// tijdrovend: S02 2×, S01 1×; tijd per stap alleen uit M1, M3, M5: S02 = (12+6+10)/3; populatie 23 × 400 = 9200 min.
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
  const meting = async (id) => (await staat()).procesmetingen.find((m) => m.metingId === id);
  const analyse = (opties = {}) => page.evaluate((o) => JSON.parse(JSON.stringify(window.__meettool.steekproefAnalyse('SP-PR24-001', o))), opties);
  const stap = (s) => `#mStappen tr[data-stap="PR24-${s}"]`;

  // ---------- Proces met drie stappen ----------
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR24');
  await page.fill('#peNaam', 'Herberekening dossier');
  for (const [veld, w] of [['#peUitvoering', 'dossier'], ['#peUitvoeringMv', 'dossiers'], ['#peOmvang', 'dienstperiode'], ['#peOmvangMv', 'dienstperioden']]) await page.fill(veld, w);
  await page.fill('#procesEditor tr[data-index="0"] input[data-stapveld="naam"]', 'Dossier controleren');
  await page.click('[data-actie="stap-toevoegen"]');
  await page.fill('#procesEditor tr[data-index="1"] input[data-stapveld="naam"]', 'Perioden beoordelen');
  await page.click('[data-actie="stap-toevoegen"]');
  await page.fill('#procesEditor tr[data-index="2"] input[data-stapveld="naam"]', 'Vastleggen in Visma');
  assert.ok(await page.isChecked('#peDossierkenmerken'), 'dossierkenmerken standaard aan bij PR24');
  await page.click('[data-actie="proces-opslaan"]');
  await page.waitForFunction(() => window.__meettool.staat().processtappen.length === 3);

  // ---------- Steekproef vastleggen ----------
  await tab('steekproeven');
  await page.click('[data-actie="steekproef-nieuw"]');
  assert.strictEqual(await page.inputValue('#spId'), 'SP-PR24-001');
  await page.fill('#spNaam', 'Herberekeningen oktober 2026');
  await page.fill('#spPopulatie', 'Alle herberekeningsdossiers die in september 2026 zijn binnengekomen');
  await page.fill('#spPopulatiegrootte', '2,5');
  await page.fill('#spSteekproefgrootte', '20');
  await page.selectOption('#spSelectiemethode', 'Willekeurig');
  await page.fill('#spStart', '2026-10-31');
  await page.fill('#spEind', '2026-10-01');
  await page.fill('#spInclusie', 'Herberekening na wijziging dienstverband');
  await page.fill('#spExclusie', 'Bezwaarzaken');
  await page.selectOption('#spStatus', 'Bezig');
  await page.click('#spOpslaan');
  assert.ok((await page.textContent('#spFouten')).includes('geheel getal groter dan nul'), 'populatie 2,5 geweigerd');
  await page.fill('#spPopulatiegrootte', '400');
  await page.click('#spOpslaan');
  assert.ok((await page.textContent('#spFouten')).includes('De einddatum ligt vóór de startdatum'), 'einddatum vóór startdatum geweigerd');
  await page.fill('#spStart', '2026-10-01');
  await page.fill('#spEind', '2026-10-31');
  await page.click('#spOpslaan');
  await page.waitForFunction(() => window.__meettool.staat().steekproeven.length === 1);
  const sp = (await staat()).steekproeven[0];
  assert.deepStrictEqual([sp.steekproefId, sp.procesId, sp.naam, sp.populatiegrootte, sp.steekproefgrootte, sp.selectiemethode, sp.startdatum, sp.einddatum, sp.status, sp.inclusiecriteria, sp.exclusiecriteria],
    ['SP-PR24-001', 'PR24', 'Herberekeningen oktober 2026', 400, 20, 'Willekeurig', '2026-10-01', '2026-10-31', 'Bezig', 'Herberekening na wijziging dienstverband', 'Bezwaarzaken']);
  assert.ok((await page.textContent('#steekproevenLijst')).includes('0 van 20 dossiers'));
  ok('steekproef', 'Steekproef SP-PR24-001 met automatisch ID, populatie (omschrijving en 400), beoogd 20, willekeurig, in-/exclusiecriteria, 1 t/m 31 oktober, status bezig; ongeldige populatiegrootte en einddatum vóór startdatum geweigerd');

  // ---------- Procesmetingen met dossierkenmerken ----------
  const vul = async ({ casus = 'Normaal', meetwijze = 'Gemeten', mw = 'PZ01', datum = '2026-10-05', detail = true, tijden, totaal, steekproef = 'SP-PR24-001', dossier, regels, blokken, onderbr, complexiteit, tijdrovend, redenen = [], knelpunt, test = false }) => {
    await tab('meting');
    await page.selectOption('#mProces', 'PR24');
    await page.fill('#mDatum', datum);
    await page.fill('#mMedewerker', mw);
    await page.check(`input[name="casustype"][value="${casus}"]`);
    await page.fill('#mAantal', '1');
    await page.fill('#mOmvang', regels || '10');
    if (blokken !== undefined) await page.fill('#mBlokken', blokken);
    await page.selectOption('#mMeetwijze', meetwijze);
    if (steekproef) await page.selectOption('#mSteekproef', steekproef);
    if (dossier) await page.fill('#mDossierId', dossier);
    if (regels) await page.fill('#mPerioderegels', regels);
    if (onderbr !== undefined) await page.fill('#mOnderbrekingen', onderbr);
    if (complexiteit) await page.check(`input[name="complexiteit"][value="${complexiteit}"]`);
    if (tijdrovend) await page.selectOption('#mTijdrovendste', `PR24-${tijdrovend}`);
    for (const r of redenen) await page.check(`#mRedenen [data-reden][value="${r}"]`);
    if (knelpunt) {
      await page.selectOption('#mKnelpunt', knelpunt.ja ? 'ja' : 'nee');
      if (knelpunt.categorie) await page.selectOption('#mKnelpuntCategorie', knelpunt.categorie);
      for (const g of knelpunt.gevolgen || []) await page.check(`#mKnelpuntGevolgen [data-mgevolg][value="${g}"]`);
      if (knelpunt.omschrijving) await page.fill('#mBelangrijksteKnelpunt', knelpunt.omschrijving);
    }
    await page.selectOption('#mDetail', detail ? 'ja' : 'nee');
    if (detail) {
      for (const [s, [a, w, reden]] of Object.entries(tijden)) {
        await page.fill(`${stap(s)} [data-veld="actieveTijd"]`, a);
        await page.fill(`${stap(s)} [data-veld="wachttijd"]`, w);
        if (reden) await page.fill(`${stap(s)} [data-veld="redenWachttijd"]`, reden);
      }
    } else if (totaal) {
      await page.fill('#mActiefTotaal', totaal[0]);
      await page.fill('#mWachtTotaal', totaal[1]);
    }
    if (test) await page.check('#mTest'); else await page.uncheck('#mTest');
  };
  const opslaan = async (n, bevestigWaarschuwing = false) => {
    await page.click('#mOpslaan');
    if (bevestigWaarschuwing) { await page.waitForSelector('#dialoog[open]'); await knop('Toch opslaan'); }
    await page.waitForFunction((x) => window.__meettool.staat().procesmetingen.length === x, n, { timeout: 5000 }).catch(async () => {
      throw new Error(`Opslaan mislukt: ${await page.textContent('#mFouten')} | ${await page.isVisible('#dialoog[open]') ? await page.textContent('#dialoogInhoud') : ''}`);
    });
  };

  await tab('meting');
  await page.selectOption('#mProces', 'PR24');
  assert.ok(await page.isVisible('#mDossierKaart') && await page.isVisible('#mKenmerken'), 'dossierkaart en kenmerken zichtbaar bij PR24');
  assert.ok(!(await page.isVisible('#mKnelpuntCategorie')), 'knelpuntcategorie verborgen tot Ja');
  const stapOpties = await page.$$eval('#mTijdrovendste option', (o) => o.map((x) => x.value));
  assert.deepStrictEqual(stapOpties, ['', 'PR24-S01', 'PR24-S02', 'PR24-S03'], 'tijdrovendste stap uit bestaande processtappen');
  await page.selectOption('#mSteekproef', 'SP-PR24-001');
  assert.strictEqual(await page.inputValue('#mVolgnummer'), '1', 'eerste volgnummer automatisch voorgesteld');

  await vul({ dossier: 'D-001', regels: '40', blokken: '4', onderbr: '2', complexiteit: 'Gemiddeld', tijdrovend: 'S02', redenen: ['Veel periode-regels', 'Onderbrekingen'],
    knelpunt: { ja: true, categorie: 'Systeem', gevolgen: ['Extra wachttijd'], omschrijving: 'Visma traag bij opslaan' }, tijden: { S01: ['5', '0'], S02: ['12', '0'], S03: ['3', '0'] } });
  assert.ok(await page.isVisible('#mKnelpuntCategorie'), 'categorie zichtbaar bij Ja');
  await opslaan(1);
  let m1 = await meting('M-PR24-001');
  assert.deepStrictEqual([m1.steekproefId, m1.volgnummerSteekproef, m1.dossierId, m1.aantalPerioderegels, m1.aantalBlokken, m1.aantalOnderbrekingen, m1.complexiteit, m1.tijdrovendsteStapId, m1.tijdrovendsteStapnaam, m1.redenenTijdsbelasting, m1.knelpunt, m1.knelpuntCategorie, m1.knelpuntGevolgen, m1.belangrijksteKnelpunt, m1.detailmeting],
    ['SP-PR24-001', 1, 'D-001', 40, 4, 2, 'Gemiddeld', 'PR24-S02', 'Perioden beoordelen', ['Veel periode-regels', 'Onderbrekingen'], true, 'Systeem', ['Extra wachttijd'], 'Visma traag bij opslaan', true]);
  assert.strictEqual(await page.inputValue('#mSteekproef'), 'SP-PR24-001', 'steekproef blijft staan voor het volgende dossier');
  assert.strictEqual(await page.inputValue('#mVolgnummer'), '2', 'volgnummer schuift door');

  // Validatie: dubbel volgnummer, ongeldig dossier-ID, dossier-ID dat op een echt nummer lijkt.
  await vul({ dossier: 'D 002', detail: false, totaal: ['30', '10'] });
  await page.fill('#mVolgnummer', '1');
  await page.click('#mOpslaan');
  const foutTekst = await page.textContent('#mFouten');
  assert.ok(foutTekst.includes('Volgnummer 1 is binnen steekproef SP-PR24-001 al gebruikt door meting M-PR24-001') && foutTekst.includes('dossier-ID mag alleen letters'), foutTekst);
  await page.fill('#mVolgnummer', '2');
  await page.fill('#mDossierId', '123456789');
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('lijkt op een echt dossier-'), 'waarschuwing bij nummer');
  await knop('Annuleren');
  ok('validatie', 'Dubbel volgnummer en dossier-ID met spatie worden geweigerd; een dossier-ID met een lange cijferreeks geeft een privacywaarschuwing');

  // M2: zonder detailmeting.
  await page.fill('#mDossierId', 'D-002');
  await page.selectOption('#mMeetwijze', 'Geobserveerd');
  await page.fill('#mPerioderegels', '60');
  await page.fill('#mOmvang', '60');
  await page.fill('#mBlokken', '6');
  await page.fill('#mOnderbrekingen', '4');
  await page.check('input[name="complexiteit"][value="Complex"]');
  await page.selectOption('#mTijdrovendste', 'PR24-S02');
  await page.selectOption('#mKnelpunt', 'ja');
  await page.selectOption('#mKnelpuntCategorie', 'Wachten');
  assert.ok(!(await page.isVisible('#mStappen')), 'stappentabel verborgen zonder detailmeting');
  assert.ok((await page.textContent('#mActiefTotaalLabel')).startsWith('Totale actieve tijd (min)'), 'label wordt totale actieve tijd');
  assert.ok((await page.textContent('#mBerekend')).includes('30,00 min'), 'voorlopige berekening gebruikt het totaal');
  await opslaan(2);
  const m2 = await meting('M-PR24-002');
  assert.ok(m2.detailmeting === false && m2.actieveTijdTotaal === 30 && m2.wachttijdTotaal === 10 && m2.meetwijze === 'Geobserveerd');
  assert.strictEqual((await staat()).stapmetingen.filter((s) => s.metingId === 'M-PR24-002').length, 0, 'geen stapmetingen opgeslagen');
  const b2 = await page.evaluate(() => window.__meettool.berekenMeting(window.__meettool.staat().procesmetingen[1]));
  assert.ok(b2.totaalActief === 30 && b2.totaalWacht === 10 && b2.actiefPerUitvoering === 30 && b2.aantalStappen === 0);
  ok('zonder detailmeting', 'Procesmeting opgeslagen zonder tijden per stap (geen stapmetingen); tijd per dossier = totale actieve tijd 30 min; meetwijze Geobserveerd');

  // Zonder detailmeting en zonder totaal: waarschuwing.
  await vul({ dossier: 'D-003', casus: 'Uitzondering', meetwijze: 'Geschat door medewerker', regels: '10', onderbr: '0', complexiteit: 'Eenvoudig', tijdrovend: 'S01', knelpunt: { ja: false }, detail: false });
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('totale actieve tijd is niet ingevuld'), 'waarschuwing zonder totaal');
  await knop('Annuleren');
  // M3: toch met detailmeting, incl. een knelpunt bij een stap.
  await page.selectOption('#mDetail', 'ja');
  for (const [s, a, w] of [['S01', '4', '0'], ['S02', '6', '5'], ['S03', '2', '0']]) {
    await page.fill(`${stap(s)} [data-veld="actieveTijd"]`, a);
    await page.fill(`${stap(s)} [data-veld="wachttijd"]`, w);
  }
  await page.fill(`${stap('S02')} [data-veld="redenWachttijd"]`, 'Wachten op werkgever');
  await page.selectOption(`${stap('S02')} [data-veld="knelpunt"]`, 'ja');
  await page.selectOption('#mStappen tr[data-knelpunt-voor="PR24-S02"] [data-kveld="knelpuntCategorie"]', 'Wachten');
  await opslaan(3);
  // M4: testmeting.
  await vul({ dossier: 'D-004', tijden: { S01: ['50', '0'], S02: ['50', '0'], S03: ['50', '0'] }, test: true });
  await opslaan(4);
  // M5: eerst zonder steekproef.
  await vul({ steekproef: '', tijden: { S01: ['10', '0'], S02: ['10', '0'], S03: ['10', '0'] } });
  await page.selectOption('#mSteekproef', '');
  await opslaan(5);
  assert.ok(!(await meting('M-PR24-005')).steekproefId);
  ok('dossiermetingen', 'Vijf procesmetingen met steekproef, volgnummer (automatisch doorgenummerd), dossier-ID, periode-regels, blokken, onderbrekingen, complexiteit, meest tijdrovende stap (uit de processtappen), redenen, knelpunt op dossierniveau en detailmeting ja/nee');

  // ---------- Bestaande meting koppelen ----------
  await tab('overzicht');
  await page.selectOption('#ozSteekproef', '__geen__');
  assert.ok((await page.textContent('#overzichtTelling')).startsWith('1 van 5'), 'filter zonder steekproef');
  await page.selectOption('#ozSteekproef', '');
  await tab('steekproeven');
  await page.click('#steekproevenLijst [data-actie="steekproef-koppelen"][data-id="SP-PR24-001"]');
  await page.waitForSelector('#koppelTabel');
  const rij5 = '#koppelTabel tr[data-meting="M-PR24-005"]';
  await page.check(`${rij5} [data-koppel]`);
  assert.strictEqual(await page.inputValue(`${rij5} [data-volgnummer]`), '5', 'volgnummer voorgesteld in koppelvenster');
  await page.fill(`${rij5} [data-volgnummer]`, '1');
  await knop('Koppeling opslaan');
  assert.ok((await page.textContent('#koppelFouten')).includes('Volgnummer 1 is meer dan één keer gebruikt'), 'dubbel volgnummer in koppelvenster');
  await page.fill(`${rij5} [data-volgnummer]`, '5');
  await page.fill(`${rij5} [data-dossier]`, 'D-005');
  await knop('Koppeling opslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.find((m) => m.metingId === 'M-PR24-005').steekproefId === 'SP-PR24-001');
  const m5 = await meting('M-PR24-005');
  assert.ok(m5.volgnummerSteekproef === 5 && m5.dossierId === 'D-005' && m5.gewijzigd, 'koppeling vastgelegd met wijzigingstijdstip');
  ok('koppelen', 'Bestaande meting M-PR24-005 gekoppeld via "Metingen koppelen" (volgnummer 5 voorgesteld, dubbel volgnummer geweigerd, dossier-ID D-005)');

  // ---------- Steekproefresultaten ----------
  let a = await analyse();
  assert.deepStrictEqual([a.voortgang.aantal, a.voortgang.doel, a.metingIds, a.bruikbaar.length], [4, 20, ['M-PR24-001', 'M-PR24-002', 'M-PR24-003', 'M-PR24-005'], 4]);
  assert.ok(a.totaalActief === 92 && a.actief.gemiddelde === 23 && a.actief.mediaan === 25 && a.actief.minimum === 12 && a.actief.maximum === 30, JSON.stringify(a.actief));
  assert.ok(a.totaalWacht === 15 && a.wacht.gemiddelde === 3.75 && a.wacht.n === 4);
  const pc = Object.fromEntries(a.perComplexiteit.map((r) => [r.complexiteit, [r.aantalMetingen, r.actief.gemiddelde]]));
  assert.deepStrictEqual(pc, { Eenvoudig: [1, 12], Gemiddeld: [1, 20], Complex: [1, 30], '(niet ingevuld)': [1, 30] });
  assert.ok(bijna(a.kenmerken.perioderegels.waarde, 110 / 3) && a.kenmerken.perioderegels.n === 3 && a.kenmerken.blokken.waarde === 5 && a.kenmerken.blokken.n === 2 && a.kenmerken.onderbrekingen.waarde === 2);
  assert.deepStrictEqual(a.casustypen.map((r) => [r.waarde, r.aantal, r.percentage]), [['Normaal', 3, 75], ['Uitzondering', 1, 25]]);
  assert.deepStrictEqual(a.complexiteit.map((r) => [r.waarde, r.aantal]), [['Eenvoudig', 1], ['Gemiddeld', 1], ['Complex', 1], ['(niet ingevuld)', 1]]);
  assert.ok(bijna(a.perCasustype[0].actief.gemiddelde, 80 / 3) && a.perCasustype[1].actief.gemiddelde === 12);
  ok('resultaten', 'Voortgang 4 van 20 (testmeting niet meegeteld); 4 bruikbaar; actief totaal 92, gemiddelde 23, mediaan 25, min 12, max 30; wacht totaal 15, gemiddeld 3,75; per complexiteit 12/20/30/(niet ingevuld) 30; gem. 36,67 periode-regels, 5 blokken (n = 2), 2 onderbrekingen; 75% normaal, 25% uitzondering');

  // Onderscheid: meest genoemde tijdrovende stap (alle metingen) vs. tijd per stap (alleen stapmetingen).
  assert.deepStrictEqual(a.tijdrovend.ranglijst.map((r) => [r.stapId, r.aantal, r.metingIds]), [['PR24-S02', 2, ['M-PR24-001', 'M-PR24-002']], ['PR24-S01', 1, ['M-PR24-003']]]);
  assert.ok(a.tijdrovend.n === 3 && a.tijdrovend.zonder === 1);
  assert.deepStrictEqual(a.stapTijden.metingenMetDetail, ['M-PR24-001', 'M-PR24-003', 'M-PR24-005']);
  assert.deepStrictEqual(a.stapTijden.metingenZonderDetail, ['M-PR24-002']);
  const st = Object.fromEntries(a.stapTijden.stappen.map((r) => [r.stapId, [r.actief.n, r.actief.gemiddelde]]));
  assert.ok(st['PR24-S01'][0] === 3 && bijna(st['PR24-S01'][1], 19 / 3) && bijna(st['PR24-S02'][1], 28 / 3) && st['PR24-S03'][1] === 5, JSON.stringify(st));
  // Op Resultaten telt de meting zonder detail niet mee per stap, wel per dossier.
  const ps = await page.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.procesSamenvatting('PR24', { meetwijze: 'alle' }).perCasustype.Normaal.actiefPerUitvoering)));
  assert.deepStrictEqual(ps.metingIds, ['M-PR24-001', 'M-PR24-002', 'M-PR24-005']);
  const stN = await page.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.stapSamenvatting('PR24', { meetwijze: 'alle' }, 'Normaal'))));
  assert.deepStrictEqual(stN.find((r) => r.stapId === 'PR24-S02').actief.metingIds, ['M-PR24-001', 'M-PR24-005']);
  ok('stappen', 'Meest genoemde tijdrovende stap (alle metingen): S02 2×, S01 1×; gemiddelde tijd per stap alleen uit stapmetingen van M1, M3, M5 (S02 = 28/3); M2 zonder detail telt wel per dossier, nooit per stap');

  assert.deepStrictEqual(a.knelpunten.perCategorie.map((r) => [r.categorie, r.aantal, r.metingIds]), [['Wachten', 2, ['M-PR24-002', 'M-PR24-003']], ['Systeem', 1, ['M-PR24-001']]]);
  assert.deepStrictEqual(a.knelpunten.metingenMetKnelpunt, ['M-PR24-001', 'M-PR24-002', 'M-PR24-003']);
  assert.deepStrictEqual(a.meetwijzen.map((r) => [r.meetwijze, r.aantal]), [['Gemeten', 2], ['Geschat door medewerker', 1], ['Uit systeemgegevens', 0], ['Geobserveerd', 1]]);
  assert.deepStrictEqual([a.tijdswaarden.gemeten, a.tijdswaarden.geschat, a.tijdswaarden.systeem, a.tijdswaarden.stapwaarden], [3, 1, 0, 9]);
  assert.ok(a.extrapolatie.waarde === 9200 && bijna(a.extrapolatie.uren, 9200 / 60) && a.extrapolatie.populatiegrootte === 400 && a.extrapolatie.n === 4);
  ok('knelpunten en extrapolatie', 'Knelpunten: Wachten 2 dossiers (dossierniveau M2, stap M3), Systeem 1; 3 gemeten/geobserveerde, 1 geschatte tijdswaarde, 9 stapwaarden; geschatte tijdsbelasting populatie 23 × 400 = 9200 min (153,33 uur), n = 4');

  const aTest = await analyse({ metTest: true });
  assert.ok(aTest.voortgang.aantal === 5 && aTest.actief.n === 5 && aTest.waarschuwingen.some((w) => w.includes('Testmetingen zijn meegenomen')));
  const aGemeten = await analyse({ meetwijze: 'gemeten' });
  assert.deepStrictEqual(aGemeten.metingIds, ['M-PR24-001', 'M-PR24-005']);
  assert.ok(a.waarschuwingen.some((w) => w.includes('combineren meetwijzen')) && a.waarschuwingen.some((w) => w.includes('voorlopig')));
  ok('filters', 'Testmeting alleen met de schakelaar (5 van 20); meetwijzefilter Gemeten geeft M1 en M5; gemengde meetwijzen en status "bezig" worden gemeld');

  // Scherm
  await tab('steekproeven');
  await page.selectOption('#srSteekproef', 'SP-PR24-001');
  const kern = await page.textContent('#srKerncijfers');
  assert.ok(kern.includes('4 van 20 dossiers') && kern.includes('92,00 min') && kern.includes('23,00 min') && kern.includes('25,00 min'), kern);
  const ex = await page.textContent('#srExtrapolatie');
  assert.ok(ex.includes('9.200,00 minuten') && ex.includes('153,33 uur') && ex.includes('populatiegrootte 400') && ex.includes('4 onderzochte dossiers'), ex);
  const scherm = await page.textContent('#steekproefResultaten');
  assert.ok(scherm.includes('Geschatte tijdsbelasting populatie') && scherm.includes('1. Meest genoemde tijdrovende processtap') && scherm.includes('2. Gemiddelde tijd per processtap') && scherm.includes('3 van 4 metingen hebben een detailmeting'));
  await page.click('#steekproefResultaten [data-actie="steekproef-dossiers"]');
  await page.waitForSelector('#dialoog[open]');
  const dossiers = await page.textContent('#dialoogInhoud');
  assert.ok(['D-001', 'D-002', 'D-005', 'M-PR24-004', 'TEST'].every((w) => dossiers.includes(w)));
  await knop('Sluiten');
  await page.screenshot({ path: path.join(UIT, 'scherm_steekproef.png'), fullPage: true });
  ok('scherm', 'Steekproefresultaten op het scherm: voortgang, kerncijfers, beide stapoverzichten apart gelabeld, "Geschatte tijdsbelasting populatie" met populatiegrootte en aantal onderzochte dossiers; dossierlijst herleidbaar');

  // ---------- Aanpassen, dupliceren en concept ----------
  await tab('overzicht');
  await page.click('[data-actie="meting-bewerken"][data-id="M-PR24-002"]');
  assert.strictEqual(await page.inputValue('#mDetail'), 'nee');
  assert.ok(!(await page.isVisible('#mStappen')));
  assert.deepStrictEqual([await page.inputValue('#mActiefTotaal'), await page.inputValue('#mVolgnummer'), await page.inputValue('#mDossierId'), await page.inputValue('#mTijdrovendste'), await page.inputValue('#mKnelpunt')], ['30', '2', 'D-002', 'PR24-S02', 'ja']);
  await page.click('[data-actie="meting-annuleren"]');
  await tab('overzicht');
  await page.click('[data-actie="meting-dupliceren"][data-id="M-PR24-001"]');
  assert.deepStrictEqual([await page.inputValue('#mSteekproef'), await page.inputValue('#mVolgnummer'), await page.inputValue('#mDossierId'), await page.inputValue('#mPerioderegels')], ['SP-PR24-001', '6', '', '40']);
  await page.fill('#mDossierId', 'D-006');
  await page.selectOption('#mDetail', 'nee');
  await page.fill('#mActiefTotaal', '17');
  await page.waitForFunction(() => (localStorage.getItem('meettool-concept-meting') || '').includes('D-006'));
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.deepStrictEqual([await page.inputValue('#mSteekproef'), await page.inputValue('#mVolgnummer'), await page.inputValue('#mDossierId'), await page.inputValue('#mDetail'), await page.inputValue('#mActiefTotaal')], ['SP-PR24-001', '6', 'D-006', 'nee', '17']);
  assert.ok(await page.isChecked('input[name="complexiteit"][value="Gemiddeld"]'));
  await page.click('[data-actie="meting-annuleren"]');
  ok('aanpassen en concept', 'Aanpassen toont detailmeting Nee met totalen en dossiervelden; dupliceren neemt steekproef en kenmerken over, nummert door (6) en laat het dossier-ID leeg; het concept bewaart en herstelt alle nieuwe velden');

  // ---------- Excel ----------
  await tab('importexport');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="excel-export"]')]);
  const xl = path.join(UIT, 'export_steekproef.xlsx');
  await dl.saveAs(xl);
  const x = JSON.parse(execFileSync('python3', ['-c', `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(xl)})
def tabel(naam, eerste, start=0):
    rijen = list(wb[naam].iter_rows(values_only=True))
    k = next(i for i, r in enumerate(rijen) if i >= start and r and r[0] == eerste)
    data = []
    for r in rijen[k+1:]:
        if not r or r[0] is None: break
        data.append(dict(zip(rijen[k], r)))
    return data, k
uit = {"bladen": wb.sheetnames}
uit["sp"], _ = tabel("Steekproeven", "SteekproefID")
uit["pm"], _ = tabel("Procesmetingen", "MetingID")
uit["sm"], _ = tabel("Stapmetingen", "MetingID")
uit["kn"], _ = tabel("Knelpunten", "ProcesID")
rijen = list(wb["Steekproefresultaten"].iter_rows(values_only=True))
uit["sam"], k = tabel("Steekproefresultaten", "SteekproefID")
secties = {}
for i, r in enumerate(rijen):
    if r and isinstance(r[0], str) and (r[0].startswith("1. ") or r[0].startswith("2. ") or r[0].startswith("Alle gekoppelde")):
        secties[r[0][:2]] = tabel("Steekproefresultaten", "SteekproefID", i)[0]
uit["secties"] = secties
print(json.dumps(uit, default=str))`]).toString());
  assert.deepStrictEqual(x.bladen, ['Resultaten', 'Totaaloverzicht', 'Per medewerker', 'Knelpuntenanalyse', 'Steekproefresultaten', 'Steekproeven', 'Procesmetingen', 'Stapmetingen', 'Knelpunten', 'Frequentie', 'Methode']);
  const xsp = x.sp[0];
  assert.deepStrictEqual([xsp.SteekproefID, xsp['Totale populatiegrootte'], xsp['Beoogde steekproefgrootte'], xsp.Selectiemethode, xsp.Status, xsp['Gekoppelde procesmetingen (aantal)']], ['SP-PR24-001', 400, 20, 'Willekeurig', 'Bezig', 5]);
  const xm = (id) => x.pm.find((r) => r.MetingID === id);
  assert.deepStrictEqual([xm('M-PR24-001').SteekproefID, xm('M-PR24-001')['Volgnummer binnen steekproef'], xm('M-PR24-001')['Geanonimiseerd dossier-ID'], xm('M-PR24-001')['Aantal ABP-periode-regels'], xm('M-PR24-001').Complexiteit, xm('M-PR24-001')['Meest tijdrovende processtap (StapID)'], xm('M-PR24-001')['Knelpunt aanwezig (dossierniveau)']],
    ['SP-PR24-001', 1, 'D-001', 40, 'Gemiddeld', 'PR24-S02', 'Ja']);
  assert.strictEqual(xm('M-PR24-002')['Detailmeting op stapniveau uitgevoerd'], 'Nee');
  assert.ok(x.sm.filter((r) => r.MetingID === 'M-PR24-003').every((r) => r['SteekproefID (via procesmeting)'] === 'SP-PR24-001' && r['DossierID (via procesmeting)'] === 'D-003'));
  assert.ok(!x.sm.some((r) => r.MetingID === 'M-PR24-002'), 'geen stapmetingen voor M2');
  const dossierKn = x.kn.filter((r) => r.Niveau === 'Dossier (procesmeting)');
  assert.deepStrictEqual(dossierKn.map((r) => [r.MetingID, r.Categorie, r.SteekproefID, r.DossierID]), [['M-PR24-001', 'Systeem', 'SP-PR24-001', 'D-001'], ['M-PR24-002', 'Wachten', 'SP-PR24-001', 'D-002']]);
  assert.ok(x.kn.some((r) => r.Niveau === 'Processtap' && r.MetingID === 'M-PR24-003' && r.StapID === 'PR24-S02'));
  const sam = x.sam[0];
  assert.ok(sam['Gemeten dossiers (procesmetingen)'] === 4 && sam['Gemiddelde actieve tijd per dossier (min)'] === 23 && sam['Mediaan actieve tijd per dossier (min)'] === 25 && sam['Totale actieve tijd (min)'] === 92
    && sam['Geschatte tijdsbelasting populatie (min)'] === 9200 && sam['Gebruikte populatiegrootte'] === 400 && sam['Aantal onderzochte dossiers (extrapolatie)'] === 4, JSON.stringify(sam));
  assert.deepStrictEqual(x.secties['1.'].map((r) => [r.StapID, r['Keer genoemd']]), [['PR24-S02', 2], ['PR24-S01', 1]]);
  const s2 = x.secties['2.'].find((r) => r.StapID === 'PR24-S02');
  assert.ok(bijna(s2['Gemiddelde actief (min)'], 28 / 3) && s2.n === 3 && s2['Metingen zonder detailmeting (niet meegeteld)'] === 'M-PR24-002');
  const alle = x.secties.Al;
  assert.strictEqual(alle.length, 5);
  assert.deepStrictEqual(alle.find((r) => r.MetingID === 'M-PR24-004')['Meegenomen in resultaten'], 'Nee');
  assert.deepStrictEqual([alle.find((r) => r.MetingID === 'M-PR24-002')['Bron totale tijd'], alle.find((r) => r.MetingID === 'M-PR24-002').DossierID], ['Totaal procesmeting (geen detailmeting per stap)', 'D-002']);
  ok('excel', 'Excel: aparte tabbladen Steekproeven, Procesmetingen (steekproef, volgnummer, dossier-ID, kenmerken, knelpunt, detailmeting), Stapmetingen (via SteekproefID/DossierID), Knelpunten (ook dossierniveau, met SteekproefID en DossierID) en Steekproefresultaten (gelijk aan het scherm: 4 dossiers, gem. 23, mediaan 25, 9200 min; beide stapoverzichten apart; alle 5 dossiers herleidbaar, testmeting niet meegenomen)');

  // ---------- CSV ----------
  const [cv] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="csv-steekproeven"]')]);
  const csvPad = path.join(UIT, 'steekproeven.csv');
  await cv.saveAs(csvPad);
  const csv = fs.readFileSync(csvPad, 'utf8').replace(/^﻿/, '').trim().split(/\r\n/);
  assert.ok(csv[0].startsWith('SteekproefID;ProcesID;Naam van de steekproef') && csv.length === 2 && csv[1].includes('SP-PR24-001') && csv[1].includes(';400;20;Willekeurig;'), csv.join('\n'));
  const [cvp] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="csv-procesmetingen"]')]);
  await cvp.saveAs(path.join(UIT, 'procesmetingen_sp.csv'));
  const csvP = fs.readFileSync(path.join(UIT, 'procesmetingen_sp.csv'), 'utf8');
  assert.ok(csvP.includes('SteekproefID;Volgnummer binnen steekproef;Geanonimiseerd dossier-ID') && csvP.includes('SP-PR24-001;1;D-001;40'));
  ok('csv', 'CSV Steekproeven en CSV Procesmetingen met steekproef, volgnummer, dossier-ID en dossierkenmerken');

  // ---------- Back-up ----------
  const voor = await staat();
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('[data-actie="backup-download"]')]);
  const bkPad = path.join(UIT, 'backup_steekproef.json');
  await bk.saveAs(bkPad);
  const json = JSON.parse(fs.readFileSync(bkPad, 'utf8'));
  assert.ok(json.schemaversie === 4 && json.steekproeven.length === 1 && json.volgnummers.steekproef.PR24 === 1);
  await ctx.close();
  ({ c: ctx, p: page } = await nieuweContext());
  await tab('importexport');
  await page.setInputFiles('#backupBestand', bkPad);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('1 steekproeven'));
  await knop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await knop('Sluiten');
  assert.deepStrictEqual(await staat(), voor, 'herstel zonder verlies');
  assert.strictEqual((await analyse()).extrapolatie.waarde, 9200, 'resultaten na herstel gelijk');
  for (const [wijzig, melding] of [
    [(j) => { j.steekproeven = []; }, 'steekproef SP-PR24-001 staat niet in het bestand'],
    [(j) => { j.procesmetingen[1].volgnummerSteekproef = 1; }, 'volgnummer 1 komt in steekproef SP-PR24-001 meer dan één keer voor'],
    [(j) => { j.procesmetingen[0].complexiteit = 'Heel moeilijk'; }, 'complexiteit is ongeldig'],
    [(j) => { j.steekproeven[0].status = 'Klaar'; }, 'status ontbreekt of is ongeldig'],
    [(j) => { delete j.procesmetingen[1].detailmeting; }, 'heeft geen stapmetingen'],
  ]) {
    const fout = JSON.parse(JSON.stringify(json));
    wijzig(fout);
    fs.writeFileSync(path.join(UIT, 'steekproef_fout.json'), JSON.stringify(fout));
    await page.setInputFiles('#backupBestand', path.join(UIT, 'steekproef_fout.json'));
    await page.waitForSelector('#dialoog[open]');
    assert.ok((await page.textContent('#dialoogInhoud')).includes(melding), melding);
    await knop('Sluiten');
  }
  ok('back-up', 'JSON-back-up (schemaversie 4) bevat steekproeven en alle dossiervelden en wordt zonder verlies hersteld; ontbrekende steekproef, dubbel volgnummer, ongeldige complexiteit of status en een meting zonder stappen én zonder "geen detailmeting" worden geweigerd');

  // ---------- Proces-instelling en verwijderen ----------
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR40');
  await page.fill('#peNaam', 'Ander proces');
  for (const [veld, w] of [['#peUitvoering', 'zaak'], ['#peUitvoeringMv', 'zaken'], ['#peOmvang', 'regel'], ['#peOmvangMv', 'regels']]) await page.fill(veld, w);
  await page.fill('#procesEditor tr[data-index="0"] input[data-stapveld="naam"]', 'Behandelen');
  assert.ok(!(await page.isChecked('#peDossierkenmerken')));
  await page.click('[data-actie="proces-opslaan"]');
  await tab('meting');
  await page.selectOption('#mProces', 'PR40');
  assert.ok(await page.isVisible('#mDossierKaart') && !(await page.isVisible('#mKenmerken')), 'steekproefkoppeling bij ieder proces; kenmerken alleen bij PR24 of na aanzetten');
  assert.deepStrictEqual(await page.$$eval('#mSteekproef option', (o) => o.map((x) => x.value)), [''], 'alleen steekproeven van het eigen proces');
  await page.click('[data-actie="meting-annuleren"]');
  await tab('steekproeven');
  await page.click('#steekproevenLijst [data-actie="steekproef-verwijderen"][data-id="SP-PR24-001"]');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('zijn 5 procesmetingen'));
  await knop('Steekproef verwijderen');
  await page.waitForFunction(() => window.__meettool.staat().steekproeven.length === 0);
  const na = await staat();
  assert.ok(na.procesmetingen.length === 5 && na.procesmetingen.every((m) => !m.steekproefId && !('volgnummerSteekproef' in m)) && na.procesmetingen.find((m) => m.metingId === 'M-PR24-001').dossierId === 'D-001');
  ok('instelling en verwijderen', 'Steekproefkoppeling bij ieder proces, dossierkenmerken alleen bij PR24 (of na aanzetten); steekproef verwijderen ontkoppelt de 5 metingen, die met dossier-ID blijven bestaan');

  // ---------- Demogegevens ----------
  await tab('importexport');
  await page.click('[data-actie="demo-laden"]');
  await knop('Demogegevens laden');
  await page.waitForFunction(() => window.__meettool.staat().steekproeven.length === 1);
  const demo = await page.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.steekproefAnalyse('SP-DEMO-PR01-001', {}))));
  assert.ok(demo.voortgang.aantal === 7 && demo.stapTijden.metingenZonderDetail.length === 1 && isFinite(demo.extrapolatie.waarde));
  await page.click('#tab-importexport [data-actie="demo-verwijderen"]');
  await knop('Demogegevens verwijderen');
  await page.waitForFunction(() => window.__meettool.staat().steekproeven.length === 0);
  ok('demo', 'Demogegevens bevatten een fictieve steekproef (7 dossiers, één zonder detailmeting) en worden volledig verwijderd');

  assert.deepStrictEqual(netwerk, []);
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  ok('offline', '0 netwerkverzoeken en 0 JavaScript-fouten');
  await browser.close();
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
