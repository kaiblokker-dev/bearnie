// Geautomatiseerde acceptatietest voor Meettool.html.
// Draait Chromium (Playwright) volledig offline tegen het bestand via file://.
// Gebruik: node tests/acceptatietest.js   (vereist Playwright; alleen voor ontwikkeling)
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HTML = path.resolve(__dirname, '..', 'Meettool.html');
const UIT = path.resolve(process.env.TEST_UITVOER || path.join(__dirname, 'uitvoer'));
fs.mkdirSync(UIT, { recursive: true });

const resultaten = [];
function ok(stap, tekst) {
  resultaten.push(`✔ ${stap}: ${tekst}`);
  console.log(`✔ ${stap}: ${tekst}`);
}
const bijna = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const mediaan = (w) => { const s = [...w].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const gem = (w) => w.reduce((a, b) => a + b, 0) / w.length;
const num = (t) => Number(String(t).replace(',', '.'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PAD ? { executablePath: process.env.CHROMIUM_PAD } : {});
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  await context.setOffline(true);
  const netwerk = [];
  context.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) netwerk.push(r.url()); });
  const page = await context.newPage();
  const fouten = [];
  page.on('pageerror', (e) => fouten.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') fouten.push('console: ' + m.text()); });

  const url = 'file://' + HTML;
  await page.goto(url);
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);

  const tab = (naam) => page.click(`#tabs button[data-tab="${naam}"]`);
  const dialoogKnop = async (label) => { await page.click(`#dialoogKnoppen button:text-is("${label}")`); };
  const download = async (actie, naam) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), actie()]);
    const doel = path.join(UIT, naam || dl.suggestedFilename());
    await dl.saveAs(doel);
    return { pad: doel, naam: dl.suggestedFilename() };
  };
  const stapVeld = (stapId, veld) => `#mStappen tr[data-stap="${stapId}"] [data-veld="${veld}"]`;
  const timerKnop = (stapId, actie) => `#mStappen tr[data-stap="${stapId}"] button[data-timer="${actie}"]`;
  const staat = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__meettool.staat())));

  // ---------- 1. Proces met drie stappen ----------
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR24');
  await page.fill('#peNaam', 'Inkomende post registreren');
  await page.fill('#peEenheid', 'documenten');
  await page.click('[data-actie="stap-toevoegen"]');
  await page.click('[data-actie="stap-toevoegen"]');
  const namen = ['Post openen en sorteren', 'Registreren in zaaksysteem', 'Doorzetten naar behandelaar'];
  for (let i = 0; i < 3; i++) await page.fill(`#procesEditor tr[data-index="${i}"] input[data-stapveld="naam"]`, namen[i]);
  // Controle: proces zonder stappen wordt geweigerd (los getest op een tweede proces hieronder)
  await page.click('[data-actie="proces-opslaan"]');
  let s = await staat();
  assert.deepStrictEqual(s.processtappen.map((x) => x.stapId), ['PR24-S01', 'PR24-S02', 'PR24-S03']);
  ok('1', 'Proces PR24 met stappen PR24-S01..S03 aangemaakt');

  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR99');
  await page.fill('#peNaam', 'Leeg proces');
  await page.fill('#peEenheid', 'dossiers');
  await page.click('[data-actie="stap-verwijderen"]');
  await page.click('[data-actie="proces-opslaan"]');
  assert.ok((await page.textContent('#procesEditor')).includes('minimaal één processtap'));
  await page.click('[data-actie="proces-annuleren"]');
  ok('controle', 'Proces zonder processtap wordt geweigerd');

  // ---------- 2/3/5. Meting 1: normaal, handmatige invoer, wachttijd met reden ----------
  await tab('meting');
  await page.selectOption('#mProces', 'PR24');
  assert.strictEqual(await page.inputValue('#mEenheid'), 'documenten');
  assert.strictEqual(await page.inputValue('#mMetingId'), 'M-PR24-001');
  assert.strictEqual(await page.locator('#mStappen tr[data-stap]').count(), 3);
  await page.fill('#mDatum', '2026-03-02');
  await page.fill('#mMedewerker', 'M01');
  await page.check('input[name="casustype"][value="Normaal"]');
  await page.fill('#mOmvang', '10');
  await page.selectOption('#mMeetwijze', 'Gemeten');
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '5');
  await page.fill(stapVeld('PR24-S01', 'wachttijd'), '0');
  await page.fill(stapVeld('PR24-S02', 'actieveTijd'), '10,5');
  await page.fill(stapVeld('PR24-S02', 'wachttijd'), '15');
  await page.fill(stapVeld('PR24-S03', 'actieveTijd'), '3.25');
  await page.fill(stapVeld('PR24-S03', 'wachttijd'), '0');
  // Controle: wachttijd zonder reden wordt geweigerd
  await page.click('#mOpslaan');
  assert.ok((await page.textContent('#mFouten')).includes('reden van de wachttijd'));
  ok('controle', 'Wachttijd > 0 zonder reden wordt geweigerd');
  // Controle: negatieve tijd en omvang 0 worden geweigerd
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '-1');
  await page.fill('#mOmvang', '0');
  await page.click('#mOpslaan');
  const ft = await page.textContent('#mFouten');
  assert.ok(ft.includes('niet negatief') && ft.includes('groter zijn dan nul'));
  ok('controle', 'Negatieve tijd en omvang 0 worden geweigerd');
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '5');
  await page.fill('#mOmvang', '10');
  await page.fill(stapVeld('PR24-S02', 'redenWachttijd'), 'Wachten op scan');
  await page.click('#mOpslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 1);
  s = await staat();
  const sm1 = s.stapmetingen.filter((x) => x.metingId === 'M-PR24-001');
  assert.deepStrictEqual(sm1.map((x) => x.actieveTijd), [5, 10.5, 3.25]);
  assert.strictEqual(sm1[1].redenWachttijd, 'Wachten op scan');
  ok('2/3/5', 'Meting M-PR24-001 (normaal) handmatig ingevoerd, komma en punt als decimaal opgeslagen als getal; wachttijd 15 min met reden');

  // ---------- 4. Meting 2: normaal, met timer ----------
  await page.selectOption('#mProces', 'PR24');
  assert.strictEqual(await page.inputValue('#mMetingId'), 'M-PR24-002');
  await page.fill('#mDatum', '2026-03-03');
  await page.check('input[name="casustype"][value="Normaal"]');
  await page.fill('#mOmvang', '4');
  await page.selectOption('#mMeetwijze', 'Gemeten');
  await page.check('#mTimerTonen');
  await page.click(timerKnop('PR24-S01', 'start'));
  await page.waitForTimeout(1300);
  await page.click(timerKnop('PR24-S01', 'afronden'));
  await page.click(timerKnop('PR24-S02', 'start'));
  await page.waitForTimeout(700);
  await page.click(timerKnop('PR24-S02', 'wacht'));
  await page.waitForTimeout(700);
  await page.click(timerKnop('PR24-S02', 'hervat'));
  await page.waitForTimeout(700);
  await page.click(timerKnop('PR24-S02', 'afronden'));
  await page.click(timerKnop('PR24-S03', 'start'));
  await page.waitForTimeout(400);
  await page.click(timerKnop('PR24-S03', 'reset'));
  await page.click(timerKnop('PR24-S03', 'start'));
  await page.waitForTimeout(600);
  await page.click(timerKnop('PR24-S03', 'afronden'));
  const t1 = num(await page.inputValue(stapVeld('PR24-S01', 'actieveTijd')));
  const t2a = num(await page.inputValue(stapVeld('PR24-S02', 'actieveTijd')));
  const t2w = num(await page.inputValue(stapVeld('PR24-S02', 'wachttijd')));
  const t3 = num(await page.inputValue(stapVeld('PR24-S03', 'actieveTijd')));
  assert.ok(t1 >= 0.02 && t1 <= 0.03, 'timer stap 1 ' + t1);
  assert.ok(t2a >= 0.02 && t2a <= 0.03 && t2w >= 0.01 && t2w <= 0.02, 'timer stap 2 ' + t2a + ' ' + t2w);
  assert.ok(t3 >= 0.01 && t3 <= 0.02, 'timer stap 3 na reset ' + t3);
  assert.ok(await page.isVisible(stapVeld('PR24-S02', 'redenWachttijd')));
  // De timer is een hulpmiddel: de gebruiker corrigeert de voorgestelde waarden vóór het opslaan.
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '4');
  await page.fill(stapVeld('PR24-S02', 'actieveTijd'), '9');
  await page.fill(stapVeld('PR24-S02', 'wachttijd'), '0');
  await page.fill(stapVeld('PR24-S03', 'actieveTijd'), '3');
  await page.fill(stapVeld('PR24-S03', 'wachttijd'), '0');
  await page.fill(stapVeld('PR24-S01', 'wachttijd'), '0');
  await page.click('#mOpslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 2);
  s = await staat();
  const sm2 = s.stapmetingen.filter((x) => x.metingId === 'M-PR24-002');
  assert.ok(sm2.every((x) => x.tijdvastlegging === 'Timer, handmatig aangepast'));
  ok('4', `Meting M-PR24-002 met timer vastgelegd (voorstel ${t1}/${t2a}+${t2w} wacht/${t3} min na reset), daarna gecontroleerd en aangepast; herkomst "Timer, handmatig aangepast" vastgelegd`);

  // ---------- 2. Meting 3: uitzondering ----------
  await page.selectOption('#mProces', 'PR24');
  await page.fill('#mDatum', '2026-03-04');
  await page.check('input[name="casustype"][value="Uitzondering"]');
  await page.fill('#mOmvang', '2');
  await page.selectOption('#mMeetwijze', 'Gemeten');
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '8');
  await page.fill(stapVeld('PR24-S01', 'wachttijd'), '0');
  await page.fill(stapVeld('PR24-S02', 'actieveTijd'), '20');
  await page.fill(stapVeld('PR24-S02', 'wachttijd'), '60');
  await page.fill(stapVeld('PR24-S02', 'redenWachttijd'), 'Navraag bij afzender');
  await page.fill(stapVeld('PR24-S03', 'actieveTijd'), '4');
  await page.fill(stapVeld('PR24-S03', 'wachttijd'), '0');
  await page.click('#mOpslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 3);
  ok('2', 'Twee normale metingen en één uitzondering (M-PR24-003) geregistreerd');

  // Extra: meting met ontbrekende waarde (geen nul!) → Onbekend en uitgesloten
  await page.selectOption('#mProces', 'PR24');
  await page.fill('#mDatum', '2026-03-05');
  await page.check('input[name="casustype"][value="Normaal"]');
  await page.selectOption('#mMeetwijze', 'Geschat door medewerker');
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '6');
  await page.fill(stapVeld('PR24-S02', 'actieveTijd'), '');
  await page.fill(stapVeld('PR24-S03', 'actieveTijd'), '2');
  await page.click('#mOpslaan');
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('niet als nul'));
  await dialoogKnop('Toch opslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 4);
  s = await staat();
  const m4 = s.stapmetingen.filter((x) => x.metingId === 'M-PR24-004');
  assert.strictEqual(m4[1].actieveTijd, null);
  assert.strictEqual(m4[0].wachttijd, null);
  assert.strictEqual(s.procesmetingen.find((m) => m.metingId === 'M-PR24-004').omvang, null);
  ok('controle', 'Lege velden worden als null (Onbekend) opgeslagen, niet als 0 (M-PR24-004, geschat)');

  // ---------- 6/7. Totale actieve tijd en tijd per eenheid ----------
  const verwacht = {
    'M-PR24-001': { actief: 5 + 10.5 + 3.25, wacht: 15, omvang: 10 },
    'M-PR24-002': { actief: 4 + 9 + 3, wacht: 0, omvang: 4 },
    'M-PR24-003': { actief: 8 + 20 + 4, wacht: 60, omvang: 2 },
  };
  for (const [id, v] of Object.entries(verwacht)) {
    const b = await page.evaluate((id) => {
      const m = window.__meettool.staat().procesmetingen.find((x) => x.metingId === id);
      return window.__meettool.berekenMeting(m);
    }, id);
    assert.ok(bijna(b.totaalActief, v.actief), id);
    assert.ok(bijna(b.totaalWacht, v.wacht), id);
    assert.ok(bijna(b.actiefPerEenheid, v.actief / v.omvang), id);
  }
  const b4 = await page.evaluate(() => window.__meettool.berekenMeting(window.__meettool.staat().procesmetingen.find((x) => x.metingId === 'M-PR24-004')));
  assert.strictEqual(b4.totaalActief, null);
  assert.strictEqual(b4.actiefPerEenheid, null);
  // Controle in de weergave (Metingen bekijken)
  await tab('overzicht');
  const rijTekst = await page.locator('#overzichtTabel tr', { hasText: 'M-PR24-001' }).first().innerText();
  assert.ok(rijTekst.includes('18,75') && rijTekst.includes('1,88') && rijTekst.includes('15,00'), rijTekst);
  const rij4 = await page.locator('#overzichtTabel tr', { hasText: 'M-PR24-004' }).first().innerText();
  assert.ok(rij4.includes('Onbekend'));
  ok('6', 'Totale actieve tijd handmatig gecontroleerd: M-PR24-001 = 5 + 10,5 + 3,25 = 18,75; M-PR24-002 = 16; M-PR24-003 = 32; M-PR24-004 = Onbekend');
  ok('7', 'Actieve tijd per eenheid: 18,75/10 = 1,875 (weergave 1,88); 16/4 = 4; 32/2 = 16; zonder omvang = Onbekend');

  // Filters in overzicht
  await page.selectOption('#ozCasustype', 'Uitzondering');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '1 van 4 procesmetingen');
  await page.selectOption('#ozCasustype', '');
  await page.selectOption('#ozMeetwijze', 'Geschat door medewerker');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '1 van 4 procesmetingen');
  await page.click('[data-actie="filters-wissen"]');
  await page.fill('#ozZoek', 'scan');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '1 van 4 procesmetingen');
  await page.fill('#ozVan', '2026-03-03');
  await page.fill('#ozTot', '2026-03-04');
  await page.fill('#ozZoek', '');
  await page.dispatchEvent('#ozTot', 'change');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '2 van 4 procesmetingen');
  await page.click('[data-actie="filters-wissen"]');
  // MedewerkerID blijft na opslaan staan voor de volgende meting; alle vier de metingen hebben M01.
  await page.selectOption('#ozMedewerker', 'M01');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '4 van 4 procesmetingen');
  await page.selectOption('#ozMedewerker', '__leeg__');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '0 van 4 procesmetingen');
  await page.click('[data-actie="filters-wissen"]');
  await page.click('[data-actie="meting-uitklappen"][data-id="M-PR24-001"]');
  assert.ok((await page.textContent('#overzichtTabel')).includes('Wachten op scan'));
  await page.click('#overzichtSubtabs button[data-subtab="stapmetingen"]');
  assert.strictEqual(await page.textContent('#overzichtTelling'), '12 van 12 stapmetingen');
  await page.click('#overzichtSubtabs button[data-subtab="procesmetingen"]');
  ok('4 (weergave)', 'Zoeken en filteren op proces, datum, medewerker, casustype en meetwijze werken; stapmetingen per procesmeting zichtbaar');

  // ---------- 8. Statistiek ----------
  const sam = await page.evaluate(() => window.__meettool.procesSamenvatting('PR24', { meetwijze: 'alle' }));
  const N = sam.perCasustype.Normaal;
  const act = [18.75, 16];
  assert.strictEqual(N.aantal, 3);
  assert.strictEqual(N.actief.n, 2);
  assert.deepStrictEqual(N.actief.metingIds, ['M-PR24-001', 'M-PR24-002']);
  assert.ok(bijna(N.actief.mediaan, mediaan(act)) && bijna(N.actief.gemiddelde, gem(act)));
  assert.ok(bijna(N.actief.minimum, 16) && bijna(N.actief.maximum, 18.75));
  assert.ok(bijna(N.actiefPerEenheid.mediaan, mediaan([1.875, 4])));
  assert.deepStrictEqual(N.uitgesloten.actief.map((u) => u.metingId), ['M-PR24-004']);
  const U = sam.perCasustype.Uitzondering;
  assert.ok(U.aantal === 1 && bijna(U.actief.mediaan, 32) && bijna(U.wacht.mediaan, 60));
  const gemeten = await page.evaluate(() => window.__meettool.procesSamenvatting('PR24', { meetwijze: 'gemeten' }));
  assert.strictEqual(gemeten.perCasustype.Normaal.aantal, 2);
  const geschat = await page.evaluate(() => window.__meettool.procesSamenvatting('PR24', { meetwijze: 'geschat' }));
  assert.strictEqual(geschat.perCasustype.Normaal.aantal, 1);
  // stapniveau
  const stappen = await page.evaluate(() => window.__meettool.stapSamenvatting('PR24', { meetwijze: 'alle' }, 'Normaal'));
  assert.strictEqual(stappen[1].actief.n, 2); // M-004 heeft geen waarde bij S02
  assert.ok(bijna(stappen[0].actief.mediaan, 5) && stappen[0].actief.n === 3); // 5, 4, 6
  assert.ok(bijna(stappen[1].percentageMetWacht, 50)); // 15 en 0 bekend
  ok('8', 'Normaal (n=2 bruikbaar): mediaan = (16 + 18,75)/2 = 17,375; gemiddelde 17,375; min 16; max 18,75; M-PR24-004 uitgesloten (Onbekend). Uitzondering: n=1, mediaan 32. Meetwijzefilter werkt; stapstatistiek klopt');

  // Weergave dashboard
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  const dash = await page.textContent('#resultatenInhoud');
  assert.ok(dash.includes('17,38') || dash.includes('17,37'), 'mediaan in dashboard');
  assert.ok(dash.includes('verschillende meetwijzen gecombineerd'));
  assert.ok(dash.includes('Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig.'));
  await page.click('[data-actie="onderliggende-metingen"][data-casustype="Normaal"]');
  const ond = await page.textContent('#dialoogInhoud');
  assert.ok(ond.includes('M-PR24-001, M-PR24-002') && ond.includes('M-PR24-004'));
  await dialoogKnop('Sluiten');
  ok('8 (weergave)', 'Dashboard toont mediaan, waarschuwing gemengde meetwijzen, melding weinig metingen en onderliggende MetingID\'s');

  // ---------- 9/10. Frequentie en tijdsbelasting ----------
  await page.selectOption('#rMeetwijze', 'alle');
  assert.ok((await page.textContent('#resultatenInhoud')).includes('geen frequentiemeting'));
  await tab('frequentie');
  await page.selectOption('#fProces', 'PR24');
  assert.strictEqual(await page.inputValue('#fId'), 'F-PR24-001');
  await page.fill('#fPeriode', 'maart 2026');
  await page.fill('#fAantal', '120');
  await page.fill('#fVolume', '1.450');
  await page.selectOption('#fMeetwijze', 'Geteld');
  await page.fill('#fBron', 'Turflijst postkamer');
  await page.click('#frequentieFormulier button[type="submit"]');
  assert.ok((await page.textContent('#fFouten')).includes('dubbelzinnig'));
  assert.strictEqual((await staat()).frequentiemetingen.length, 0);
  await page.fill('#fVolume', '1450');
  await page.click('#frequentieFormulier button[type="submit"]');
  s = await staat();
  assert.strictEqual(s.frequentiemetingen[0].totaalVolume, 1450);
  ok('9', 'Frequentiemeting F-PR24-001 vastgelegd (120 uitvoeringen, Geteld); dubbelzinnige invoer "1.450" wordt geweigerd met uitleg');
  await tab('resultaten');
  const tb = await page.evaluate(() => {
    const t = window.__meettool;
    const sam = t.procesSamenvatting('PR24', { meetwijze: 'alle' });
    return t.berekenTijdsbelasting(t.kiesFrequentie('PR24'), sam.perCasustype.Normaal);
  });
  assert.ok(bijna(tb.waarde, 120 * 17.375));
  const dash2 = await page.textContent('#resultatenInhoud');
  assert.ok(dash2.includes('2.085,00') && dash2.includes('F-PR24-001') && dash2.includes('M-PR24-001, M-PR24-002') && dash2.includes('Geteld'));
  ok('10', 'Geschatte tijdsbelasting = 120 × 17,375 = 2.085 min (34,75 uur); gebruikte frequentiemeting, mediaan, MetingID\'s en meetwijze getoond');

  // ---------- Controle dubbele MetingID ----------
  const dubbel = await page.evaluate(() => {
    const st = window.__meettool.staat();
    return st.procesmetingen.length === new Set(st.procesmetingen.map((m) => m.metingId)).size;
  });
  assert.ok(dubbel);

  // ---------- 12. Grafiek als PNG ----------
  await page.screenshot({ path: path.join(UIT, 'scherm_resultaten.png'), fullPage: true });
  const png = await download(() => page.click('[data-actie="grafiek-png"]'), 'grafiek.png');
  const pngInfo = execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png.pad)}).convert('RGB')
w,h = im.size
print(w, h, im.getpixel((2,2)), im.getpixel((w-3,h-3)))`]).toString().trim();
  assert.ok(pngInfo.startsWith('3000 1680 (255, 255, 255) (255, 255, 255)'), pngInfo);
  ok('12', `Grafiek als PNG gedownload: ${png.naam} (3000×1680 px, witte achtergrond)`);

  // ---------- 11. Excel-export ----------
  await tab('importexport');
  const xlsx = await download(() => page.click('[data-actie="excel-export"]'), 'export.xlsx');
  const xlsxInfo = JSON.parse(execFileSync('python3', [path.join(__dirname, 'controleer_xlsx.py'), xlsx.pad]).toString());
  assert.deepStrictEqual(xlsxInfo.bladen, ['Resultaten', 'Procesmetingen', 'Stapmetingen', 'Frequentie', 'Methode']);
  assert.strictEqual(xlsxInfo.procesmetingen, 4);
  assert.strictEqual(xlsxInfo.stapmetingen, 12);
  assert.strictEqual(xlsxInfo.frequentie, 1);
  assert.ok(Math.abs(xlsxInfo.pr24_normaal_mediaan - 17.375) < 1e-9);
  assert.ok(Math.abs(xlsxInfo.pr24_belasting - 2085) < 1e-9);
  assert.ok(xlsxInfo.methode_ontbrekend);
  assert.ok(xlsxInfo.ruw_zonder_berekening);
  ok('11', `Excel-export geopend met openpyxl: tabbladen ${xlsxInfo.bladen.join(', ')}; 4 procesmetingen, 12 stapmetingen, 1 frequentie; mediaan 17,375 en tijdsbelasting 2085 in Resultaten; Methode vermeldt dat ontbrekende waarden niet als nul zijn verwerkt`);

  // CSV-export
  const csv = await download(() => page.click('[data-actie="csv-stapmetingen"]'), 'stapmetingen.csv');
  const csvTekst = fs.readFileSync(csv.pad, 'utf8');
  assert.ok(csvTekst.startsWith('﻿MetingID;StapID;Volgorde') && csvTekst.includes(';10,5;') && csvTekst.includes(';3,25;'));
  await download(() => page.click('[data-actie="csv-procesmetingen"]'), 'procesmetingen.csv');
  await download(() => page.click('[data-actie="csv-frequentie"]'), 'frequentiemetingen.csv');
  ok('CSV', 'CSV-export procesmetingen, stapmetingen en frequentie (puntkomma, decimale komma, UTF-8 met BOM)');

  // ---------- 13. JSON-back-up ----------
  const voor = await staat();
  const backup = await download(() => page.click('[data-actie="backup-download"]'), 'backup.json');
  const bj = JSON.parse(fs.readFileSync(backup.pad, 'utf8'));
  assert.strictEqual(bj.toolversie, await page.evaluate(() => window.__meettool.versie));
  for (const k of ['processen', 'processtappen', 'procesmetingen', 'stapmetingen', 'frequentiemetingen']) assert.ok(Array.isArray(bj[k]));
  ok('13', `JSON-back-up gedownload (${backup.naam}, toolversie ${bj.toolversie})`);

  // Persistentie na herladen
  await page.evaluate(() => window.__meettool.wachtOpOpslag());
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.strictEqual((await staat()).procesmetingen.length, 4);
  ok('opslag', 'Gegevens blijven bewaard na herladen van de pagina (IndexedDB via file://)');

  // ---------- 14. Wissen met dubbele bevestiging ----------
  await tab('importexport');
  await page.click('[data-actie="alles-wissen"]');
  await dialoogKnop('Doorgaan');
  await page.fill('#wisBevestiging', 'wissen');
  await dialoogKnop('Alle gegevens definitief wissen');
  assert.ok(await page.isVisible('#dialoog[open]'), 'verkeerde bevestiging mag niet wissen');
  await page.fill('#wisBevestiging', 'WISSEN');
  await dialoogKnop('Alle gegevens definitief wissen');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 0);
  await page.evaluate(() => window.__meettool.wachtOpOpslag());
  await page.reload();
  await page.waitForFunction(() => window.__meettool && window.__meettool.klaar);
  assert.strictEqual((await staat()).processen.length, 0);
  ok('14', 'Lokale gegevens gewist na dubbele bevestiging (typen van WISSEN); ook na herladen leeg');

  // ---------- 15. Back-up importeren ----------
  await tab('importexport');
  await page.setInputFiles('#backupBestand', backup.pad);
  await page.waitForSelector('#dialoog[open]');
  const importTekst = await page.textContent('#dialoogInhoud');
  assert.ok(importTekst.includes('Samenvoegen') && importTekst.includes('Huidige gegevens vervangen'));
  await dialoogKnop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await dialoogKnop('Sluiten');
  const na = await staat();
  assert.deepStrictEqual(na, voor);
  // Nogmaals samenvoegen: alles identiek, niets dubbel
  await page.setInputFiles('#backupBestand', backup.pad);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('0 procesmetingen'));
  await dialoogKnop('Import annuleren');
  assert.deepStrictEqual(await staat(), voor);
  // Ongeldig bestand
  const kapot = path.join(UIT, 'ongeldig.json');
  fs.writeFileSync(kapot, JSON.stringify({ ...bj, procesmetingen: [...bj.procesmetingen, bj.procesmetingen[0]] }));
  await page.setInputFiles('#backupBestand', kapot);
  await page.waitForSelector('#dialoog[open]');
  assert.ok((await page.textContent('#dialoogInhoud')).includes('MetingID M-PR24-001 komt meer dan één keer voor'));
  await dialoogKnop('Sluiten');
  ok('15', 'Back-up geïmporteerd (Samenvoegen): alle processen, stappen, metingen, stapmetingen en frequenties exact terug; dubbele ID\'s in een bestand worden geweigerd');

  // ---------- Demogegevens ----------
  await page.click('#tab-importexport [data-actie="demo-laden"]');
  await dialoogKnop('Demogegevens laden');
  await page.waitForSelector('#demoBalk:not([hidden])');
  await page.click('[data-actie="excel-export"]');
  await page.waitForSelector('#dialoogKop:text("Export bevat demogegevens")');
  const demoXlsx = await download(() => dialoogKnop('Toch exporteren'), 'demo.xlsx');
  assert.ok(demoXlsx.naam.includes('MET-DEMOGEGEVENS'));
  await tab('resultaten');
  await page.selectOption('#rProces', 'DEMO-PR01');
  await page.screenshot({ path: path.join(UIT, 'scherm_resultaten_demo.png'), fullPage: true });
  await download(() => page.click('[data-actie="grafiek-png"]'), 'grafiek_demo.png');
  await tab('importexport');
  await page.click('#tab-importexport [data-actie="demo-verwijderen"]');
  await dialoogKnop('Demogegevens verwijderen');
  await page.waitForSelector('#demoBalk[hidden]', { state: 'attached' });
  assert.deepStrictEqual(await staat(), voor);
  ok('demo', 'Demogegevens laden/verwijderen; export met demogegevens alleen na waarschuwing en gemarkeerd in bestandsnaam; eigen gegevens onaangetast');

  // Proces verwijderen: metingen blijven leesbaar
  await tab('processen');
  await page.click('[data-actie="proces-verwijderen"][data-id="PR24"]');
  await dialoogKnop('Proces verwijderen');
  await tab('overzicht');
  await page.click('[data-actie="meting-openen"][data-id="M-PR24-001"]');
  const detail = await page.textContent('#dialoogInhoud');
  assert.ok(detail.includes('Inkomende post registreren') && detail.includes('Registreren in zaaksysteem') && detail.includes('18,75'));
  await dialoogKnop('Sluiten');
  await tab('resultaten');
  assert.ok((await page.textContent('#resultatenInhoud')).includes('Registreren in zaaksysteem'));
  ok('controle', 'Na verwijderen van proces PR24 blijven metingen en resultaten leesbaar');

  await tab('meting');
  await page.screenshot({ path: path.join(UIT, 'scherm_meting.png'), fullPage: true });

  // ---------- 16. Offline ----------
  assert.deepStrictEqual(netwerk, [], 'netwerkverzoeken: ' + netwerk.join(', '));
  assert.deepStrictEqual(fouten, [], fouten.join('\n'));
  const html = fs.readFileSync(HTML, 'utf8');
  assert.ok(!/(src|href)\s*=\s*["']https?:/i.test(html), 'externe verwijzing');
  ok('16', 'Volledige test draaide met de browser offline (context.setOffline): 0 netwerkverzoeken, 0 JavaScript-fouten; geen externe verwijzingen in het bestand');

  await browser.close();
  fs.writeFileSync(path.join(UIT, 'resultaat.txt'), resultaten.join('\n') + '\n');
  console.log('\nALLE TESTS GESLAAGD');
})().catch((e) => {
  console.error('\nTEST MISLUKT:', e);
  process.exit(1);
});
