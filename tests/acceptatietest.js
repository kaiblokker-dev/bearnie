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
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1,
    // Standaard Nederlandse tijd: datumfouten rond middernacht vallen in UTC niet op.
    timezoneId: process.env.TEST_TIJDZONE || 'Europe/Amsterdam', locale: 'nl-NL' });
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

  // ---------- Datumcontrole (tijdzone-onafhankelijk) ----------
  const datums = await page.evaluate(() => ['2026-03-02', '2026-03-29', '2026-10-25', '2024-02-29', '2026-01-01', '2026-12-31', '2025-02-29', '2026-13-01', '2026-04-31', '02-03-2026']
    .map((d) => [d, window.__meettool.isGeldigeDatum(d)]));
  assert.deepStrictEqual(datums.map((x) => x[1]), [true, true, true, true, true, true, false, false, false, false], JSON.stringify(datums));
  ok('controle', `Datumcontrole correct in tijdzone ${await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)} (incl. zomertijdwissels en schrikkeldag)`);

  // ---------- 1. Proces met drie stappen ----------
  await tab('processen');
  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR24');
  await page.fill('#peNaam', 'Inkomende post registreren');
  // Controle: zonder eenheden wordt het proces geweigerd
  await page.fill(`#procesEditor tr[data-index="0"] input[data-stapveld="naam"]`, 'x');
  await page.click('[data-actie="proces-opslaan"]');
  assert.ok((await page.textContent('#procesEditor')).includes('uitvoeringseenheid (enkelvoud)'));
  await page.fill('#peUitvoering', 'dossier');
  await page.fill('#peUitvoeringMv', 'dossiers');
  await page.fill('#peOmvang', 'dienstperiode');
  await page.fill('#peOmvangMv', 'dienstperioden');
  await page.click('[data-actie="stap-toevoegen"]');
  await page.click('[data-actie="stap-toevoegen"]');
  const namen = ['Post openen en sorteren', 'Registreren in zaaksysteem', 'Doorzetten naar behandelaar'];
  for (let i = 0; i < 3; i++) await page.fill(`#procesEditor tr[data-index="${i}"] input[data-stapveld="naam"]`, namen[i]);
  // Controle: proces zonder stappen wordt geweigerd (los getest op een tweede proces hieronder)
  await page.click('[data-actie="proces-opslaan"]');
  let s = await staat();
  assert.deepStrictEqual(s.processtappen.map((x) => x.stapId), ['PR24-S01', 'PR24-S02', 'PR24-S03']);
  const p24 = s.processen.find((p) => p.procesId === 'PR24');
  assert.deepStrictEqual([p24.uitvoeringseenheid, p24.uitvoeringseenheidMeervoud, p24.omvangseenheid, p24.omvangseenheidMeervoud], ['dossier', 'dossiers', 'dienstperiode', 'dienstperioden']);
  ok('1', 'Proces PR24 met stappen PR24-S01..S03 aangemaakt; uitvoeringseenheid dossier, omvangseenheid dienstperiode (proces zonder eenheden geweigerd)');

  await page.click('[data-actie="proces-nieuw"]');
  await page.fill('#peId', 'PR99');
  await page.fill('#peNaam', 'Leeg proces');
  for (const [id, w] of [['#peUitvoering', 'zaak'], ['#peUitvoeringMv', 'zaken'], ['#peOmvang', 'regel'], ['#peOmvangMv', 'regels']]) await page.fill(id, w);
  await page.click('[data-actie="stap-verwijderen"]');
  await page.click('[data-actie="proces-opslaan"]');
  assert.ok((await page.textContent('#procesEditor')).includes('minimaal één processtap'));
  await page.click('[data-actie="proces-annuleren"]');
  ok('controle', 'Proces zonder processtap wordt geweigerd');

  // ---------- 2/3/5. Meting 1: normaal, handmatige invoer, wachttijd met reden ----------
  await tab('meting');
  await page.selectOption('#mProces', 'PR24');
  assert.strictEqual(await page.textContent('#mAantalLabel'), 'Aantal dossiers (uitvoeringen)');
  assert.strictEqual(await page.textContent('#mOmvangLabel'), 'Omvang: aantal dienstperioden');
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
  assert.ok((await page.textContent('#mFouten')).includes('Vul het aantal dossiers in'));
  ok('controle', 'Wachttijd > 0 zonder reden wordt geweigerd; aantal dossiers is verplicht');
  // Controle: negatieve tijd en omvang 0 worden geweigerd
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '-1');
  await page.fill('#mOmvang', '0');
  await page.fill('#mAantal', '0');
  await page.click('#mOpslaan');
  const ft = await page.textContent('#mFouten');
  assert.ok(ft.includes('niet negatief') && ft.includes('aantal dienstperioden) moet groter zijn dan nul') && ft.includes('aantal dossiers moet groter zijn dan nul'));
  ok('controle', 'Negatieve tijd, 0 dossiers en 0 dienstperioden worden geweigerd');
  await page.fill(stapVeld('PR24-S01', 'actieveTijd'), '5');
  await page.fill('#mOmvang', '10');
  await page.fill('#mAantal', '1');
  await page.fill(stapVeld('PR24-S02', 'redenWachttijd'), 'Wachten op scan');
  await page.click('#mOpslaan');
  await page.waitForFunction(() => window.__meettool.staat().procesmetingen.length === 1);
  s = await staat();
  const sm1 = s.stapmetingen.filter((x) => x.metingId === 'M-PR24-001');
  assert.deepStrictEqual(sm1.map((x) => x.actieveTijd), [5, 10.5, 3.25]);
  assert.strictEqual(sm1[1].redenWachttijd, 'Wachten op scan');
  const pm1 = s.procesmetingen.find((m) => m.metingId === 'M-PR24-001');
  assert.ok(pm1.aantalUitvoeringen === 1 && pm1.omvang === 10 && pm1.uitvoeringseenheid === 'dossier' && pm1.omvangseenheid === 'dienstperiode' && pm1.aantalUitvoeringenHerkomst === 'Ingevoerd');
  ok('2/3/5', 'Meting M-PR24-001 (normaal) handmatig ingevoerd, komma en punt als decimaal opgeslagen als getal; wachttijd 15 min met reden');

  // ---------- 4. Meting 2: normaal, met timer ----------
  await page.selectOption('#mProces', 'PR24');
  assert.strictEqual(await page.inputValue('#mMetingId'), 'M-PR24-002');
  await page.fill('#mDatum', '2026-03-03');
  await page.check('input[name="casustype"][value="Normaal"]');
  await page.fill('#mAantal', '2');
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
  await page.fill('#mAantal', '1');
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
  await page.fill('#mAantal', '1');
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

  // ---------- 6/7. Totale actieve tijd en tijd per dossier / per dienstperiode ----------
  const verwacht = {
    'M-PR24-001': { actief: 5 + 10.5 + 3.25, wacht: 15, aantal: 1, omvang: 10 },
    'M-PR24-002': { actief: 4 + 9 + 3, wacht: 0, aantal: 2, omvang: 4 },
    'M-PR24-003': { actief: 8 + 20 + 4, wacht: 60, aantal: 1, omvang: 2 },
  };
  for (const [id, v] of Object.entries(verwacht)) {
    const b = await page.evaluate((id) => {
      const m = window.__meettool.staat().procesmetingen.find((x) => x.metingId === id);
      return window.__meettool.berekenMeting(m);
    }, id);
    assert.ok(bijna(b.totaalActief, v.actief), id);
    assert.ok(bijna(b.totaalWacht, v.wacht), id);
    assert.ok(bijna(b.actiefPerUitvoering, v.actief / v.aantal), id);
    assert.ok(bijna(b.wachtPerUitvoering, v.wacht / v.aantal), id);
    assert.ok(bijna(b.actiefPerOmvang, v.actief / v.omvang), id);
  }
  const b4 = await page.evaluate(() => window.__meettool.berekenMeting(window.__meettool.staat().procesmetingen.find((x) => x.metingId === 'M-PR24-004')));
  assert.strictEqual(b4.totaalActief, null);
  assert.strictEqual(b4.actiefPerUitvoering, null);
  assert.strictEqual(b4.actiefPerOmvang, null);
  // Controle in de weergave (Metingen bekijken)
  await tab('overzicht');
  const rijTekst = await page.locator('#overzichtTabel tr', { hasText: 'M-PR24-001' }).first().innerText();
  assert.ok(rijTekst.includes('1 dossier') && rijTekst.includes('10 dienstperioden') && rijTekst.includes('18,75') && rijTekst.includes('1,88') && rijTekst.includes('15,00'), rijTekst);
  const rij2 = await page.locator('#overzichtTabel tr', { hasText: 'M-PR24-002' }).first().innerText();
  assert.ok(rij2.includes('2 dossiers') && rij2.includes('4 dienstperioden') && rij2.includes('8,00') && rij2.includes('4,00'), rij2);
  const rij4 = await page.locator('#overzichtTabel tr', { hasText: 'M-PR24-004' }).first().innerText();
  assert.ok(rij4.includes('Onbekend'));
  ok('6', 'Totale actieve tijd handmatig gecontroleerd: M-PR24-001 = 5 + 10,5 + 3,25 = 18,75; M-PR24-002 = 16; M-PR24-003 = 32; M-PR24-004 = Onbekend');
  ok('7', 'Per dossier (primair): 18,75/1 = 18,75; 16/2 = 8; 32/1 = 32. Per dienstperiode (aanvullend): 18,75/10 = 1,875 (weergave 1,88); 16/4 = 4; 32/2 = 16; zonder omvang = Onbekend. Overzicht toont "1 dossier · 10 dienstperioden" en "2 dossiers · 4 dienstperioden"');

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
  const act = [18.75, 8]; // per dossier
  assert.strictEqual(N.aantal, 3);
  assert.strictEqual(N.aantalUitvoeringen, 4); // 1 + 2 + 1 dossiers
  assert.strictEqual(N.actiefPerUitvoering.n, 2);
  assert.deepStrictEqual(N.actiefPerUitvoering.metingIds, ['M-PR24-001', 'M-PR24-002']);
  assert.ok(bijna(N.actiefPerUitvoering.mediaan, 13.375) && bijna(N.actiefPerUitvoering.mediaan, mediaan(act)) && bijna(N.actiefPerUitvoering.gemiddelde, gem(act)));
  assert.ok(bijna(N.actiefPerUitvoering.minimum, 8) && bijna(N.actiefPerUitvoering.maximum, 18.75));
  assert.ok(bijna(N.wachtPerUitvoering.mediaan, 7.5)); // 15/1 en 0/2
  assert.ok(bijna(N.actiefPerOmvang.mediaan, mediaan([1.875, 4])));
  assert.deepStrictEqual(N.uitgesloten.actiefPerUitvoering.map((u) => u.metingId), ['M-PR24-004']);
  const U = sam.perCasustype.Uitzondering;
  assert.ok(U.aantal === 1 && bijna(U.actiefPerUitvoering.mediaan, 32) && bijna(U.wachtPerUitvoering.mediaan, 60) && bijna(U.actiefPerOmvang.mediaan, 16));
  const gemeten = await page.evaluate(() => window.__meettool.procesSamenvatting('PR24', { meetwijze: 'gemeten' }));
  assert.strictEqual(gemeten.perCasustype.Normaal.aantal, 2);
  const geschat = await page.evaluate(() => window.__meettool.procesSamenvatting('PR24', { meetwijze: 'geschat' }));
  assert.strictEqual(geschat.perCasustype.Normaal.aantal, 1);
  // stapniveau
  const stappen = await page.evaluate(() => window.__meettool.stapSamenvatting('PR24', { meetwijze: 'alle' }, 'Normaal'));
  assert.strictEqual(stappen[1].actief.n, 2); // M-004 heeft geen waarde bij S02
  assert.ok(bijna(stappen[0].actief.mediaan, 5) && stappen[0].actief.n === 3); // per dossier: 5/1, 4/2, 6/1
  assert.ok(bijna(stappen[1].actief.mediaan, (10.5 + 4.5) / 2)); // 10,5/1 en 9/2
  assert.ok(bijna(stappen[1].percentageMetWacht, 50)); // 15 en 0 bekend
  ok('8', 'Normaal, per dossier (n=2 bruikbaar): mediaan = (18,75 + 8)/2 = 13,375; gemiddelde 13,375; min 8; max 18,75; wachttijd per dossier mediaan 7,5; per dienstperiode mediaan (1,875 + 4)/2 = 2,9375; M-PR24-004 uitgesloten (Onbekend). Uitzondering: 32 per dossier, 16 per dienstperiode. Stappen per dossier genormaliseerd; meetwijzefilter werkt');

  // Weergave dashboard
  await tab('resultaten');
  await page.selectOption('#rProces', 'PR24');
  const dash = await page.textContent('#resultatenInhoud');
  assert.ok(dash.includes('13,38') || dash.includes('13,37'), 'mediaan in dashboard');
  assert.ok(dash.includes('Mediane actieve tijd per dossier (primair)') && dash.includes('Mediane actieve tijd per dienstperiode (aanvullend)') && dash.includes('2,94'), 'eenheden in dashboard');
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
  assert.ok((await page.textContent('#fAantalLabel')).includes('Aantal dossiers') && (await page.textContent('#fVolumeLabel')).includes('dienstperioden'));
  // Totaal aantal dienstperioden in de meetperiode is onbekend: leeg laten.
  await page.fill('#fVolume', '');
  await page.click('#frequentieFormulier button[type="submit"]');
  s = await staat();
  assert.strictEqual(s.frequentiemetingen[0].totaalVolume, null);
  assert.strictEqual(s.frequentiemetingen[0].aantalUitvoeringen, 120);
  assert.ok(s.frequentiemetingen[0].uitvoeringseenheid === 'dossier' && s.frequentiemetingen[0].omvangseenheid === 'dienstperiode');
  ok('9', 'Frequentiemeting F-PR24-001 vastgelegd: 120 dossiers, totaal aantal dienstperioden onbekend (null, niet 0); dubbelzinnige invoer "1.450" wordt geweigerd met uitleg');
  await tab('resultaten');
  const tb = await page.evaluate(() => {
    const t = window.__meettool;
    const sam = t.procesSamenvatting('PR24', { meetwijze: 'alle' });
    return t.berekenTijdsbelasting(t.kiesFrequentie('PR24'), sam.perCasustype.Normaal);
  });
  assert.ok(bijna(tb.waarde, 120 * 13.375));
  const dash2 = await page.textContent('#resultatenInhoud');
  assert.ok(dash2.includes('1.605,00') && dash2.includes('F-PR24-001') && dash2.includes('M-PR24-001, M-PR24-002') && dash2.includes('Geteld'));
  assert.ok(dash2.includes('aantal dossiers in de meetperiode × mediaan actieve tijd per dossier') && dash2.includes('Totaal aantal dienstperioden in meetperiode'));
  ok('10', 'Geschatte tijdsbelasting = 120 dossiers × 13,375 min per dossier = 1.605 min (26,75 uur), terwijl het aantal dienstperioden in de meetperiode onbekend is; gebruikte frequentiemeting, mediaan, MetingID\'s en meetwijze getoond');

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
  assert.ok(Math.abs(xlsxInfo.pr24_normaal_mediaan - 13.375) < 1e-9);
  assert.ok(Math.abs(xlsxInfo.pr24_normaal_mediaan_omvang - 2.9375) < 1e-9);
  assert.ok(Math.abs(xlsxInfo.pr24_belasting - 1605) < 1e-9);
  assert.deepStrictEqual(xlsxInfo.pr24_eenheden, ['dossier', 'dienstperiode']);
  assert.ok(xlsxInfo.ruw_eenheden, 'eenheden in ruwe tabbladen');
  assert.ok(xlsxInfo.methode_eenheden, 'eenheden in Methode');
  assert.ok(xlsxInfo.methode_ontbrekend);
  assert.ok(xlsxInfo.ruw_zonder_berekening);
  ok('11', `Excel-export geopend met openpyxl: tabbladen ${xlsxInfo.bladen.join(', ')}; 4 procesmetingen, 12 stapmetingen, 1 frequentie; in Resultaten per dossier mediaan 13,375 (primair), per dienstperiode 2,9375 (aanvullend), tijdsbelasting 1605, met kolommen Uitvoeringseenheid/Omvangseenheid; ruwe tabbladen bevatten aantal dossiers en dienstperioden met eenheden; Methode bevat definities en een tabel met eenheden per proces en vermeldt dat ontbrekende waarden niet als nul zijn verwerkt`);

  // CSV-export
  const csv = await download(() => page.click('[data-actie="csv-stapmetingen"]'), 'stapmetingen.csv');
  const csvTekst = fs.readFileSync(csv.pad, 'utf8');
  assert.ok(csvTekst.startsWith('﻿MetingID;StapID;Volgorde') && csvTekst.includes(';10,5;') && csvTekst.includes(';3,25;'));
  const csvPm = fs.readFileSync((await download(() => page.click('[data-actie="csv-procesmetingen"]'), 'procesmetingen.csv')).pad, 'utf8');
  assert.ok(csvPm.includes('Aantal uitvoeringen;Uitvoeringseenheid;Omvang;Omvangseenheid') && csvPm.includes(';2;dossier;4;dienstperiode;'), 'procesmetingen-CSV');
  const csvF = fs.readFileSync((await download(() => page.click('[data-actie="csv-frequentie"]'), 'frequentiemetingen.csv')).pad, 'utf8');
  assert.ok(csvF.includes('Aantal uitvoeringen;Uitvoeringseenheid;Totale omvang;Omvangseenheid') && csvF.includes(';120;dossier;;dienstperiode;'), 'frequentie-CSV');
  ok('CSV', 'CSV-export procesmetingen, stapmetingen en frequentie (puntkomma, decimale komma, UTF-8 met BOM); kolommen Aantal uitvoeringen/Uitvoeringseenheid en Omvang/Omvangseenheid aanwezig');

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
  assert.ok(detail.includes('1 dossier') && detail.includes('10 dienstperioden') && detail.includes('Actieve tijd per dossier'), 'eenheden blijven bij verwijderd proces');
  await dialoogKnop('Sluiten');
  await tab('resultaten');
  assert.ok((await page.textContent('#resultatenInhoud')).includes('Registreren in zaaksysteem'));
  ok('controle', 'Na verwijderen van proces PR24 blijven metingen en resultaten leesbaar');

  // ---------- Overgang van versie 1.0 ----------
  const oud = {
    formaat: 'meettool-backup', toolversie: '1.0.1', schemaversie: 1, exportdatum: '2026-10-01T10:00:00.000Z', bevatDemogegevens: false,
    processen: [{ procesId: 'PR10', naam: 'Oud proces', eenheid: 'dienstperioden', demo: false }],
    processtappen: [{ stapId: 'PR10-S01', procesId: 'PR10', volgorde: 1, naam: 'Beoordelen', demo: false }],
    procesmetingen: [{ metingId: 'M-PR10-001', datum: '2026-02-01', procesId: 'PR10', procesnaam: 'Oud proces', medewerkerId: '', casustype: 'Normaal', omvang: 5, eenheid: 'dienstperioden', meetwijze: 'Gemeten', toelichting: '', demo: false }],
    stapmetingen: [{ metingId: 'M-PR10-001', stapId: 'PR10-S01', volgorde: 1, stapnaam: 'Beoordelen', actieveTijd: 12, wachttijd: 0, redenWachttijd: '', opmerking: '', tijdvastlegging: 'Handmatig', demo: false }],
    frequentiemetingen: [{ frequentieId: 'F-PR10-001', procesId: 'PR10', meetperiode: 'feb 2026', aantalUitvoeringen: 10, totaalVolume: 50, eenheid: 'dienstperioden', meetwijze: 'Geteld', bron: '', demo: false }],
    volgnummers: { meting: { PR10: 1 }, frequentie: { PR10: 1 } },
  };
  const oudPad = path.join(UIT, 'backup_v1.json');
  fs.writeFileSync(oudPad, JSON.stringify(oud));
  await tab('importexport');
  await page.setInputFiles('#backupBestand', oudPad);
  await page.waitForSelector('#dialoog[open]');
  await dialoogKnop('Samenvoegen');
  await page.waitForSelector('#dialoogKop:text("Samenvoegen voltooid")');
  await dialoogKnop('Sluiten');
  s = await staat();
  const p10 = s.processen.find((p) => p.procesId === 'PR10');
  const m10 = s.procesmetingen.find((m) => m.metingId === 'M-PR10-001');
  assert.ok(p10.omvangseenheid === 'dienstperioden' && p10.uitvoeringseenheid === '' && !('eenheid' in p10), JSON.stringify(p10));
  assert.ok(!('aantalUitvoeringen' in m10) && m10.omvang === 5 && m10.omvangseenheid === 'dienstperioden', JSON.stringify(m10));
  let b10 = await page.evaluate(() => window.__meettool.berekenMeting(window.__meettool.staat().procesmetingen.find((m) => m.metingId === 'M-PR10-001')));
  assert.ok(b10.actiefPerUitvoering === null && bijna(b10.actiefPerOmvang, 12 / 5));
  await tab('overzicht');
  assert.ok((await page.textContent('#overzichtLegacy')).includes('1 meting(en) zonder vastgelegd aantal uitvoeringen'));
  await page.click('#overzichtLegacy [data-actie="aantal-aanvullen"]');
  await dialoogKnop('Aantal = 1 vastleggen');
  await page.waitForFunction(() => 'aantalUitvoeringen' in window.__meettool.staat().procesmetingen.find((m) => m.metingId === 'M-PR10-001'));
  s = await staat();
  const m10b = s.procesmetingen.find((m) => m.metingId === 'M-PR10-001');
  assert.ok(m10b.aantalUitvoeringen === 1 && m10b.aantalUitvoeringenHerkomst.startsWith('Aangevuld met 1 na overgang naar versie'), m10b.aantalUitvoeringenHerkomst);
  b10 = await page.evaluate(() => window.__meettool.berekenMeting(window.__meettool.staat().procesmetingen.find((m) => m.metingId === 'M-PR10-001')));
  assert.ok(bijna(b10.actiefPerUitvoering, 12));
  assert.strictEqual(await page.textContent('#overzichtLegacy'), '');
  ok('versie 1.0', 'Back-up uit versie 1.0 geïmporteerd: oude eenheid wordt omvangseenheid (waarde ongewijzigd), aantal uitvoeringen blijft ontbreken (tijd per uitvoering Onbekend) tot de gebruiker expliciet bevestigt; daarna aantal = 1 met vastgelegde herkomst');

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
