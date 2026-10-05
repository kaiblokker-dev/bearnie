// ---------- 6. Importeren en exporteren ----------

function renderImportExport() {
  const filters = resultaatFilters();
  $('#exportFilterInfo').innerHTML = `<div class="melding neutraal">Huidige filters voor de resultaten: ${esc(filtersAlsTekst(filters))}</div>`;
  const modusTekst = {
    indexeddb: 'IndexedDB in deze browser (aanbevolen)',
    localstorage: 'localStorage in deze browser (IndexedDB is niet beschikbaar)',
    geen: 'Geen lokale opslag beschikbaar. Gegevens gaan verloren bij het sluiten van de pagina!',
  }[Opslag.modus];
  $('#opslagInfo').innerHTML = `
    <dl class="gegevens">
      <dt>Opslagmethode</dt><dd>${esc(modusTekst)}</dd>
      <dt>Processen</dt><dd>${staat.processen.length} (${staat.processtappen.length} processtappen)</dd>
      <dt>Procesmetingen</dt><dd>${staat.procesmetingen.length} (${staat.stapmetingen.length} stapmetingen)</dd>
      <dt>Frequentiemetingen</dt><dd>${staat.frequentiemetingen.length}</dd>
      <dt>Demogegevens aanwezig</dt><dd>${bevatDemo() ? 'Ja' : 'Nee'}</dd>
      <dt>Toolversie</dt><dd>${esc(VERSIE)}</dd>
    </dl>
    <p class="zacht">De gegevens zijn gekoppeld aan deze browser op dit apparaat. Een andere browser (bijvoorbeeld Chrome in plaats van Edge) ziet andere gegevens. Gebruik de JSON-back-up om gegevens over te zetten.</p>`;
}

// ---------- Kolomdefinities voor ruwe gegevens (CSV en Excel) ----------

const KOLOMMEN_PROCESMETINGEN = [
  ['MetingID', (m) => m.metingId],
  ['Datum', (m) => m.datum],
  ['ProcesID', (m) => m.procesId],
  ['Procesnaam (bij meting)', (m) => m.procesnaam],
  ['MedewerkerID', (m) => m.medewerkerId || ''],
  ['Casustype', (m) => m.casustype],
  ['Omvang', (m) => m.omvang],
  ['Eenheid', (m) => m.eenheid],
  ['Meetwijze', (m) => m.meetwijze],
  ['Algemene toelichting', (m) => m.toelichting || ''],
  ['Vastgelegd op', (m) => m.aangemaakt || ''],
  ['Laatst gewijzigd', (m) => m.gewijzigd || ''],
  ['Demogegevens', (m) => (m.demo ? 'Ja' : 'Nee')],
];

const KOLOMMEN_STAPMETINGEN = [
  ['MetingID', (s) => s.metingId],
  ['StapID', (s) => s.stapId],
  ['Volgorde', (s) => s.volgorde],
  ['Processtap (bij meting)', (s) => s.stapnaam],
  ['Actieve tijd (min)', (s) => s.actieveTijd],
  ['Wachttijd (min)', (s) => s.wachttijd],
  ['Reden wachttijd', (s) => s.redenWachttijd || ''],
  ['Opmerking', (s) => s.opmerking || ''],
  ['Tijdvastlegging', (s) => s.tijdvastlegging || ''],
  ['Demogegevens', (s) => (s.demo ? 'Ja' : 'Nee')],
];

const KOLOMMEN_FREQUENTIE = [
  ['FrequentieID', (f) => f.frequentieId],
  ['ProcesID', (f) => f.procesId],
  ['Meetperiode', (f) => f.meetperiode],
  ['Aantal uitvoeringen', (f) => f.aantalUitvoeringen],
  ['Totaal volume', (f) => f.totaalVolume],
  ['Eenheid', (f) => f.eenheid],
  ['Meetwijze', (f) => f.meetwijze],
  ['Bron of toelichting', (f) => f.bron || ''],
  ['Vastgelegd op', (f) => f.aangemaakt || ''],
  ['Laatst gewijzigd', (f) => f.gewijzigd || ''],
  ['Demogegevens', (f) => (f.demo ? 'Ja' : 'Nee')],
];

function gesorteerdeProcesmetingen() {
  return [...staat.procesmetingen].sort((a, b) => vergelijkTekst(a.metingId, b.metingId));
}
function gesorteerdeStapmetingen() {
  return [...staat.stapmetingen].sort((a, b) => vergelijkTekst(a.metingId, b.metingId) || a.volgorde - b.volgorde);
}
function gesorteerdeFrequenties() {
  return [...staat.frequentiemetingen].sort((a, b) => vergelijkTekst(a.frequentieId, b.frequentieId));
}

const DEMO_WAARSCHUWING = 'LET OP: deze export bevat fictieve demogegevens (kolom Demogegevens = Ja). Niet gebruiken als onderzoeksdata.';

async function exporteerCsv(soort) {
  if (!(await bevestigExportMetDemo())) return;
  const def = {
    procesmetingen: [KOLOMMEN_PROCESMETINGEN, gesorteerdeProcesmetingen(), 'Meettool_procesmetingen'],
    stapmetingen: [KOLOMMEN_STAPMETINGEN, gesorteerdeStapmetingen(), 'Meettool_stapmetingen'],
    frequentie: [KOLOMMEN_FREQUENTIE, gesorteerdeFrequenties(), 'Meettool_frequentiemetingen'],
  }[soort];
  const [kolommen, records, naam] = def;
  const csv = maakCsv(kolommen.map((k) => k[0]), records.map((r) => kolommen.map((k) => k[1](r))), bevatDemo() ? [DEMO_WAARSCHUWING] : []);
  downloadTekst(csv, bestandsnaamMetDemo(naam, 'csv'), 'text/csv;charset=utf-8');
  toonMelding('CSV-bestand is aangemaakt.');
}

// ---------- Excel ----------

function kop(tekst) { return { v: tekst, s: 'kop' }; }

function ruwBlad(naam, kolommen, records, breedtes) {
  const rijen = [];
  if (bevatDemo()) rijen.push([{ v: DEMO_WAARSCHUWING, s: 'waarschuwing' }]);
  rijen.push(kolommen.map((k) => kop(k[0])));
  for (const r of records) {
    rijen.push(kolommen.map((k) => {
      const w = k[1](r);
      return w === null || w === undefined ? null : w;
    }));
  }
  return { naam, rijen, kolombreedtes: breedtes, kopRij: rijen.length - records.length };
}

function getalOfLeeg(n) { return isGetal(n) ? n : ONBEKEND; }

function resultatenBlad(filters) {
  const rijen = [];
  const exportdatum = fmtTijdstip(nuIso());
  rijen.push([{ v: 'Resultaten – automatisch berekend uit de ruwe metingen', s: 'titel' }]);
  if (bevatDemo()) rijen.push([{ v: DEMO_WAARSCHUWING, s: 'waarschuwing' }]);
  rijen.push(['Gebruikte filters', filtersAlsTekst(filters)]);
  rijen.push(['Exportdatum', exportdatum]);
  rijen.push(['Toolversie', VERSIE]);
  rijen.push(['Toelichting', 'Tijden in minuten. Getallen zijn onafgerond opgeslagen en worden met twee decimalen weergegeven. "Onbekend" = niet te berekenen door ontbrekende invoer (niet als nul verwerkt). n = aantal metingen met een bekende waarde.']);
  rijen.push([]);
  rijen.push([{ v: 'Samenvatting per proces en casustype', s: 'titel' }]);
  const koppen = [
    'ProcesID', 'Procesnaam', 'Casustype', 'Gebruikte filters', 'Meetwijzen in selectie', 'Aantal metingen',
    'n actieve tijd', 'Mediaan actieve tijd (min)', 'Gemiddelde actieve tijd (min)', 'Minimum actieve tijd (min)', 'Maximum actieve tijd (min)',
    'n wachttijd', 'Mediaan wachttijd (min)', 'Gemiddelde wachttijd (min)',
    'Eenheid', 'n per eenheid', 'Mediaan actieve tijd per eenheid (min)', 'Gemiddelde actieve tijd per eenheid (min)',
    'FrequentieID', 'Meetperiode', 'Aantal uitvoeringen', 'Totaal volume', 'Meetwijze frequentie',
    'Geschatte actieve tijd per meetperiode (min)', 'Geschatte actieve tijd per meetperiode (uur)', 'Toelichting tijdsbelasting',
    'Onderliggende MetingID\'s', 'MetingID\'s actieve tijd', 'Niet meegenomen (reden)',
  ];
  rijen.push(koppen.map(kop));
  const kopRij = rijen.length;
  for (const procesId of alleProcesIds()) {
    const sam = procesSamenvatting(procesId, filters);
    const freq = kiesFrequentie(procesId);
    const eenheid = eenheidVanProces(procesId, Object.values(sam.perCasustype));
    for (const c of CASUSTYPEN) {
      const g = sam.perCasustype[c];
      let belasting = null;
      let belastingTekst = '';
      if (c === 'Normaal') {
        const b = berekenTijdsbelasting(freq, g);
        belasting = b.waarde;
        belastingTekst = isGetal(b.waarde)
          ? `${fmtAantal(b.aantalUitvoeringen)} uitvoeringen × mediaan ${fmtGetal(b.mediaan)} min (normale gevallen, n = ${b.n})`
          : 'Niet berekend: ' + b.ontbreekt.join(' ');
      } else {
        belastingTekst = 'Niet berekend voor uitzonderingen (tijdsbelasting gebruikt de mediaan van normale gevallen).';
      }
      const uitgesloten = [
        ...g.uitgesloten.actief.map((u) => `${u.metingId}: ${u.reden}`),
        ...g.uitgesloten.actiefPerEenheid.filter((u) => !g.uitgesloten.actief.some((x) => x.metingId === u.metingId)).map((u) => `${u.metingId} (per eenheid): ${u.reden}`),
        ...g.uitgesloten.wacht.filter((u) => !g.uitgesloten.actief.some((x) => x.metingId === u.metingId)).map((u) => `${u.metingId} (wachttijd): ${u.reden}`),
      ];
      rijen.push([
        procesId, procesNaam(procesId), c, filtersAlsTekst(filters), meetwijzeVerdelingTekst(g.meetwijzen), g.aantal,
        g.actief.n, getalOfLeeg(g.actief.mediaan), getalOfLeeg(g.actief.gemiddelde), getalOfLeeg(g.actief.minimum), getalOfLeeg(g.actief.maximum),
        g.wacht.n, getalOfLeeg(g.wacht.mediaan), getalOfLeeg(g.wacht.gemiddelde),
        eenheid, g.actiefPerEenheid.n, getalOfLeeg(g.actiefPerEenheid.mediaan), getalOfLeeg(g.actiefPerEenheid.gemiddelde),
        freq ? freq.frequentieId : ONBEKEND, freq ? freq.meetperiode : '', freq ? getalOfLeeg(freq.aantalUitvoeringen) : '', freq ? getalOfLeeg(freq.totaalVolume) : '', freq ? freq.meetwijze : '',
        c === 'Normaal' ? getalOfLeeg(belasting) : '', c === 'Normaal' ? (isGetal(belasting) ? belasting / 60 : ONBEKEND) : '', belastingTekst,
        g.metingIds.join(', '), g.actief.metingIds.join(', '), uitgesloten.join('; '),
      ]);
    }
  }
  rijen.push([]);
  rijen.push([{ v: 'Resultaten per processtap', s: 'titel' }]);
  const stapKoppen = ['ProcesID', 'Casustype', 'StapID', 'Processtap', 'Aantal waarnemingen', 'n actieve tijd', 'Mediaan actieve tijd (min)', 'Gemiddelde actieve tijd (min)',
    'Minimum actieve tijd (min)', 'Maximum actieve tijd (min)', 'n wachttijd', 'Mediaan wachttijd (min)', 'Gemiddelde wachttijd (min)', 'Percentage metingen met wachttijd', 'Onderliggende MetingID\'s'];
  rijen.push(stapKoppen.map(kop));
  for (const procesId of alleProcesIds()) {
    for (const c of CASUSTYPEN) {
      for (const r of stapSamenvatting(procesId, filters, c)) {
        if (!r.aantalWaarnemingen) continue;
        rijen.push([procesId, c, r.stapId, r.naam, r.aantalWaarnemingen, r.actief.n, getalOfLeeg(r.actief.mediaan), getalOfLeeg(r.actief.gemiddelde),
          getalOfLeeg(r.actief.minimum), getalOfLeeg(r.actief.maximum), r.wacht.n, getalOfLeeg(r.wacht.mediaan), getalOfLeeg(r.wacht.gemiddelde),
          getalOfLeeg(r.percentageMetWacht), r.metingIds.join(', ')]);
      }
    }
  }
  return { naam: 'Resultaten', rijen, kolombreedtes: [14, 30, 13, 40, 28, 10, 10, 14, 14, 14, 14, 10, 14, 14, 14, 10, 16, 16, 16, 16, 12, 12, 20, 18, 18, 50, 40, 40, 50], kopRij };
}

function methodeBlad(filters) {
  const r = [];
  const t = (tekst) => [{ v: tekst, s: 'titel' }];
  r.push(t('Methode en verantwoording'));
  if (bevatDemo()) r.push([{ v: DEMO_WAARSCHUWING, s: 'waarschuwing' }]);
  r.push(['Exportdatum', fmtTijdstip(nuIso())]);
  r.push(['Versienummer tool', VERSIE]);
  r.push(['Gebruikte filters (Resultaten)', filtersAlsTekst(filters)]);
  r.push([]);
  r.push(t('Definities'));
  r.push(['Actieve tijd', 'De tijd in minuten waarin een medewerker daadwerkelijk aan een processtap werkt.']);
  r.push(['Wachttijd', 'De tijd in minuten waarin een processtap stilligt of wacht (bijvoorbeeld op een reactie, goedkeuring of systeem) zonder dat er actief aan wordt gewerkt. Bij wachttijd groter dan nul is een reden verplicht.']);
  r.push(['Omvang', 'De hoeveelheid werk die in één procesmeting is verwerkt, uitgedrukt in de eenheid van het proces (bijvoorbeeld 12 documenten). Omvang moet groter zijn dan nul of ontbreekt.']);
  r.push(['Frequentie', 'Het aantal uitvoeringen van een proces in een meetperiode, met het totale verwerkte volume. Een frequentie hoort bij het proces als geheel, niet bij een processtap.']);
  r.push(['Procesmeting', 'Eén waargenomen uitvoering van een proces, met per processtap een stapmeting.']);
  r.push(['Casustype', 'Normaal of Uitzondering. Beide groepen worden altijd afzonderlijk geanalyseerd.']);
  r.push([]);
  r.push(t('Formules'));
  r.push(['Totale actieve tijd', 'Som van de actieve tijd van alle processtappen van een meting.']);
  r.push(['Totale wachttijd', 'Som van de wachttijd van alle processtappen van een meting.']);
  r.push(['Actieve tijd per eenheid', 'Totale actieve tijd / omvang.']);
  r.push(['Wachttijd per eenheid', 'Totale wachttijd / omvang.']);
  r.push(['Mediaan', 'De middelste waarde na sorteren; bij een even aantal waarden het gemiddelde van de twee middelste waarden. De mediaan is de belangrijkste uitkomst.']);
  r.push(['Gemiddelde', 'Som van de waarden / aantal waarden.']);
  r.push(['Minimum en maximum', 'Kleinste en grootste waarde.']);
  r.push(['Percentage met wachttijd', 'Aantal stapmetingen met wachttijd > 0 / aantal stapmetingen met een bekende wachttijd × 100.']);
  r.push(['Geschatte actieve tijd per meetperiode', 'Aantal uitvoeringen (uit de gekozen frequentiemeting) × mediaan actieve tijd per uitvoering van de normale gevallen.']);
  r.push([]);
  r.push(t('Meetwijzen'));
  r.push(['Gemeten', 'De tijd is tijdens de uitvoering gemeten (handmatig genoteerd of met de timer in de tool).']);
  r.push(['Geschat door medewerker', 'De tijd of frequentie is achteraf door een medewerker geschat. Schattingen blijven als schatting zichtbaar.']);
  r.push(['Uit systeemgegevens', 'De waarde is afgeleid uit gegevens van een informatiesysteem (bijvoorbeeld logbestanden of rapportages).']);
  r.push(['Geteld (frequentie)', 'Het aantal uitvoeringen is handmatig geteld.']);
  r.push(['Filter op meetwijze', 'Resultaten kunnen per meetwijze worden berekend. Bij "alle meetwijzen" wordt de verdeling van de meetwijzen bij iedere samenvatting vermeld.']);
  r.push(['Tijdvastlegging', 'Handmatig = tijd rechtstreeks ingevoerd; Timer = tijd met de timer vastgelegd (tot op 0,01 minuut); "Timer, handmatig aangepast" = timerwaarde daarna door de gebruiker gewijzigd.']);
  r.push([]);
  r.push(t('Behandeling van ontbrekende waarden en afronding'));
  r.push(['Ontbrekende waarden', 'Ontbrekende waarden zijn NIET automatisch als nul verwerkt. Als bij een meting een stapwaarde ontbreekt, is de totale tijd van die meting Onbekend en telt de meting niet mee in de betreffende statistiek. Ontbreekt de omvang, dan is de tijd per eenheid Onbekend. Het aantal gebruikte metingen (n) en de niet meegenomen MetingID\'s staan in Resultaten.']);
  r.push(['Ruwe gegevens', 'De tabbladen Procesmetingen, Stapmetingen en Frequentie bevatten uitsluitend de oorspronkelijke invoer en automatisch vastgelegde identificatievelden. Ruwe meetgegevens worden nooit automatisch aangepast. Alle berekeningen staan in het tabblad Resultaten.']);
  r.push(['Afronding', 'Er wordt intern met volledige precisie gerekend. Alleen de weergave wordt afgerond (standaard op twee decimalen).']);
  r.push(['Weinig metingen', 'Bij minder dan drie metingen toont de tool de melding: "Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig." Er wordt geen betrouwbaarheidsscore berekend.']);
  return { naam: 'Methode', rijen: r, kolombreedtes: [38, 120] };
}

async function exporteerExcel() {
  if (!(await bevestigExportMetDemo())) return;
  const filters = resultaatFilters();
  const blob = maakXlsx([
    resultatenBlad(filters),
    ruwBlad('Procesmetingen', KOLOMMEN_PROCESMETINGEN, gesorteerdeProcesmetingen(), [16, 11, 12, 34, 13, 13, 9, 14, 24, 40, 22, 22, 13]),
    ruwBlad('Stapmetingen', KOLOMMEN_STAPMETINGEN, gesorteerdeStapmetingen(), [16, 16, 9, 34, 16, 16, 34, 34, 24, 13]),
    ruwBlad('Frequentie', KOLOMMEN_FREQUENTIE, gesorteerdeFrequenties(), [18, 12, 20, 18, 14, 14, 24, 40, 22, 22, 13]),
    methodeBlad(filters),
  ]);
  downloadBlob(blob, bestandsnaamMetDemo('Meettool_export', 'xlsx'));
  toonMelding('Excel-bestand is aangemaakt.');
}

// ---------- JSON-back-up ----------

function maakBackup() {
  return {
    formaat: BACKUP_FORMAAT,
    toolversie: VERSIE,
    schemaversie: staat.schemaversie,
    exportdatum: nuIso(),
    bevatDemogegevens: bevatDemo(),
    processen: staat.processen,
    processtappen: staat.processtappen,
    procesmetingen: staat.procesmetingen,
    stapmetingen: staat.stapmetingen,
    frequentiemetingen: staat.frequentiemetingen,
    volgnummers: staat.volgnummers,
  };
}

async function downloadBackup() {
  if (!(await bevestigExportMetDemo())) return;
  downloadTekst(JSON.stringify(maakBackup(), null, 2), bestandsnaamMetDemo('Meettool_backup', 'json'), 'application/json');
  toonMelding('Back-up is gedownload.');
}

/** Controleert een back-up. Geeft { fouten, gegevens } terug. */
function controleerBackup(json) {
  const fouten = [];
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { fouten: ['Het bestand bevat geen geldige back-up (geen JSON-object).'] };
  if (json.formaat !== BACKUP_FORMAAT) return { fouten: ['Het bestand is geen back-up van deze meettool (het kenmerk "formaat" ontbreekt of klopt niet).'] };
  const lijsten = ['processen', 'processtappen', 'procesmetingen', 'stapmetingen', 'frequentiemetingen'];
  for (const k of lijsten) if (!Array.isArray(json[k])) fouten.push(`Het onderdeel "${k}" ontbreekt of is geen lijst.`);
  if (fouten.length) return { fouten };

  const getalOfNull = (v) => v === null || v === undefined || isGetal(v);
  const tekst = (v) => typeof v === 'string' && v.trim() !== '';
  const dubbel = (lijst, sleutel, naam) => {
    const gezien = new Set();
    for (const r of lijst) {
      const id = sleutel(r);
      if (gezien.has(id)) fouten.push(`${naam} ${id} komt meer dan één keer voor.`);
      gezien.add(id);
    }
  };

  json.processen.forEach((p, i) => {
    if (!tekst(p.procesId)) fouten.push(`Proces ${i + 1}: ProcesID ontbreekt.`);
    if (!tekst(p.naam)) fouten.push(`Proces ${p.procesId || i + 1}: procesnaam ontbreekt.`);
  });
  json.processtappen.forEach((s, i) => {
    if (!tekst(s.stapId)) fouten.push(`Processtap ${i + 1}: StapID ontbreekt.`);
    if (!tekst(s.procesId)) fouten.push(`Processtap ${s.stapId || i + 1}: ProcesID ontbreekt.`);
    if (!isGetal(s.volgorde)) fouten.push(`Processtap ${s.stapId || i + 1}: volgorde ontbreekt.`);
  });
  json.procesmetingen.forEach((m, i) => {
    const l = `Meting ${m.metingId || i + 1}`;
    if (!tekst(m.metingId)) fouten.push(`Meting ${i + 1}: MetingID ontbreekt.`);
    if (!tekst(m.procesId)) fouten.push(`${l}: ProcesID ontbreekt.`);
    if (!isGeldigeDatum(m.datum)) fouten.push(`${l}: datum ontbreekt of is ongeldig.`);
    if (!CASUSTYPEN.includes(m.casustype)) fouten.push(`${l}: casustype ontbreekt of is ongeldig.`);
    if (!MEETWIJZEN_METING.includes(m.meetwijze)) fouten.push(`${l}: meetwijze ontbreekt of is ongeldig.`);
    if (!getalOfNull(m.omvang) || (isGetal(m.omvang) && m.omvang <= 0)) fouten.push(`${l}: omvang moet groter zijn dan nul of leeg.`);
  });
  const metingIds = new Set(json.procesmetingen.map((m) => m.metingId));
  json.stapmetingen.forEach((s, i) => {
    const l = `Stapmeting ${s.metingId || '?'} / ${s.stapId || i + 1}`;
    if (!tekst(s.metingId) || !metingIds.has(s.metingId)) fouten.push(`${l}: hoort niet bij een procesmeting in het bestand.`);
    if (!tekst(s.stapId)) fouten.push(`${l}: StapID ontbreekt.`);
    if (!getalOfNull(s.actieveTijd) || s.actieveTijd < 0) fouten.push(`${l}: actieve tijd is ongeldig.`);
    if (!getalOfNull(s.wachttijd) || s.wachttijd < 0) fouten.push(`${l}: wachttijd is ongeldig.`);
    if (s.wachttijd > 0 && !tekst(s.redenWachttijd)) fouten.push(`${l}: wachttijd zonder reden.`);
  });
  json.frequentiemetingen.forEach((f, i) => {
    const l = `Frequentiemeting ${f.frequentieId || i + 1}`;
    if (!tekst(f.frequentieId)) fouten.push(`Frequentiemeting ${i + 1}: FrequentieID ontbreekt.`);
    if (!tekst(f.procesId)) fouten.push(`${l}: ProcesID ontbreekt.`);
    if (!MEETWIJZEN_FREQUENTIE.includes(f.meetwijze)) fouten.push(`${l}: meetwijze ontbreekt of is ongeldig.`);
    if (!getalOfNull(f.aantalUitvoeringen) || !getalOfNull(f.totaalVolume)) fouten.push(`${l}: aantal of volume is ongeldig.`);
  });
  dubbel(json.processen, (p) => p.procesId, 'ProcesID');
  dubbel(json.processtappen, (s) => s.stapId, 'StapID');
  dubbel(json.procesmetingen, (m) => m.metingId, 'MetingID');
  dubbel(json.stapmetingen, (s) => `${s.metingId}/${s.stapId}`, 'Stapmeting');
  dubbel(json.frequentiemetingen, (f) => f.frequentieId, 'FrequentieID');

  const normaliseerGetal = (v) => (isGetal(v) ? v : null);
  const gegevens = normaliseerStaat(json);
  // Ontbrekende getallen consequent als null (nooit als 0).
  gegevens.procesmetingen = gegevens.procesmetingen.map((m) => ({ ...m, omvang: normaliseerGetal(m.omvang) }));
  gegevens.stapmetingen = gegevens.stapmetingen.map((s) => ({ ...s, actieveTijd: normaliseerGetal(s.actieveTijd), wachttijd: normaliseerGetal(s.wachttijd) }));
  gegevens.frequentiemetingen = gegevens.frequentiemetingen.map((f) => ({ ...f, aantalUitvoeringen: normaliseerGetal(f.aantalUitvoeringen), totaalVolume: normaliseerGetal(f.totaalVolume) }));
  return { fouten, gegevens };
}

const vergelijkbaar = (r) => JSON.stringify(r, Object.keys(r).filter((k) => !['aangemaakt', 'gewijzigd'].includes(k)).sort());

/** Voegt gegevens samen. Bestaande gegevens worden nooit overschreven. Geeft een verslag terug. */
function voegSamen(nieuw, uitvoeren) {
  const verslag = { toegevoegd: { processen: 0, procesmetingen: 0, frequentiemetingen: 0 }, gelijk: [], conflicten: [] };
  const doel = uitvoeren ? staat : JSON.parse(JSON.stringify(staat));
  for (const p of nieuw.processen) {
    const bestaand = doel.processen.find((x) => x.procesId === p.procesId);
    const stappen = nieuw.processtappen.filter((s) => s.procesId === p.procesId);
    if (bestaand) {
      const bestaandeStappen = doel.processtappen.filter((s) => s.procesId === p.procesId);
      const gelijk = bestaand.naam === p.naam && bestaand.eenheid === p.eenheid &&
        JSON.stringify(bestaandeStappen.map(vergelijkbaar).sort()) === JSON.stringify(stappen.map(vergelijkbaar).sort());
      if (gelijk) verslag.gelijk.push(`Proces ${p.procesId}`);
      else verslag.conflicten.push(`Proces ${p.procesId}: bestaat al met een andere inhoud; de huidige versie blijft behouden.`);
      continue;
    }
    const botsendeStap = stappen.find((s) => doel.processtappen.some((x) => x.stapId === s.stapId));
    if (botsendeStap) { verslag.conflicten.push(`Proces ${p.procesId}: StapID ${botsendeStap.stapId} bestaat al bij een ander proces; proces niet toegevoegd.`); continue; }
    doel.processen.push(p);
    doel.processtappen.push(...stappen);
    verslag.toegevoegd.processen++;
  }
  for (const m of nieuw.procesmetingen) {
    const bestaand = doel.procesmetingen.find((x) => x.metingId === m.metingId);
    const stappen = nieuw.stapmetingen.filter((s) => s.metingId === m.metingId);
    if (bestaand) {
      const bestaandeStappen = doel.stapmetingen.filter((s) => s.metingId === m.metingId);
      const gelijk = vergelijkbaar(bestaand) === vergelijkbaar(m) &&
        JSON.stringify(bestaandeStappen.map(vergelijkbaar).sort()) === JSON.stringify(stappen.map(vergelijkbaar).sort());
      if (gelijk) verslag.gelijk.push(`Meting ${m.metingId}`);
      else verslag.conflicten.push(`Meting ${m.metingId}: bestaat al met andere waarden; de huidige versie blijft behouden.`);
      continue;
    }
    doel.procesmetingen.push(m);
    doel.stapmetingen.push(...stappen);
    verslag.toegevoegd.procesmetingen++;
  }
  for (const f of nieuw.frequentiemetingen) {
    const bestaand = doel.frequentiemetingen.find((x) => x.frequentieId === f.frequentieId);
    if (bestaand) {
      if (vergelijkbaar(bestaand) === vergelijkbaar(f)) verslag.gelijk.push(`Frequentie ${f.frequentieId}`);
      else verslag.conflicten.push(`Frequentie ${f.frequentieId}: bestaat al met andere waarden; de huidige versie blijft behouden.`);
      continue;
    }
    doel.frequentiemetingen.push(f);
    verslag.toegevoegd.frequentiemetingen++;
  }
  for (const soort of ['meting', 'frequentie']) {
    for (const [pid, nr] of Object.entries(nieuw.volgnummers[soort] || {})) {
      if (isGetal(nr) && nr > (doel.volgnummers[soort][pid] || 0)) doel.volgnummers[soort][pid] = nr;
    }
  }
  return verslag;
}

async function importeerBackup(bestand) {
  let json;
  try {
    json = JSON.parse(await leesBestandAlsTekst(bestand));
  } catch (e) {
    await informeer('Import niet mogelijk', '<div class="melding fout">Het bestand kon niet worden gelezen als JSON. Kies een back-upbestand dat met deze tool is gemaakt.</div>');
    return;
  }
  const { fouten, gegevens } = controleerBackup(json);
  if (fouten.length) {
    await informeer('Import niet mogelijk', foutenHtml(fouten.slice(0, 30), 'De back-up is niet geïmporteerd, omdat het bestand fouten bevat:') +
      (fouten.length > 30 ? `<p>… en nog ${fouten.length - 30} andere fouten.</p>` : ''));
    return;
  }
  const proef = voegSamen(gegevens, false);
  const keuze = await dialoog({
    titel: 'Back-up importeren',
    inhoud: `
      <dl class="gegevens">
        <dt>Bestand</dt><dd>${esc(bestand.name)}</dd>
        <dt>Toolversie back-up</dt><dd>${esc(json.toolversie || ONBEKEND)}${json.toolversie && json.toolversie !== VERSIE ? ` (huidige versie: ${esc(VERSIE)})` : ''}</dd>
        <dt>Exportdatum</dt><dd>${esc(fmtTijdstip(json.exportdatum))}</dd>
        <dt>Inhoud</dt><dd>${gegevens.processen.length} processen, ${gegevens.processtappen.length} processtappen, ${gegevens.procesmetingen.length} procesmetingen, ${gegevens.stapmetingen.length} stapmetingen, ${gegevens.frequentiemetingen.length} frequentiemetingen</dd>
        <dt>Demogegevens</dt><dd>${json.bevatDemogegevens ? '<strong>Ja</strong>' : 'Nee'}</dd>
      </dl>
      <div class="melding info mt">Het bestand is gecontroleerd: het formaat klopt, verplichte velden zijn aanwezig en alle identificatiecodes zijn uniek.</div>
      <h4>Kies hoe u wilt importeren</h4>
      <p><strong>Samenvoegen:</strong> nieuwe gegevens worden toegevoegd; bestaande gegevens worden nooit overschreven.
      Resultaat: ${proef.toegevoegd.processen} processen, ${proef.toegevoegd.procesmetingen} procesmetingen en ${proef.toegevoegd.frequentiemetingen} frequentiemetingen erbij;
      ${proef.gelijk.length} al aanwezig (identiek); ${proef.conflicten.length} conflicten (niet geïmporteerd).</p>
      ${proef.conflicten.length ? `<div class="melding waarschuwing"><ul>${proef.conflicten.slice(0, 15).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>${proef.conflicten.length > 15 ? `… en nog ${proef.conflicten.length - 15}` : ''}</div>` : ''}
      <p><strong>Huidige gegevens vervangen:</strong> alle huidige gegevens (${staat.procesmetingen.length} procesmetingen, ${staat.frequentiemetingen.length} frequentiemetingen, ${staat.processen.length} processen) worden gewist en vervangen door de inhoud van de back-up.</p>`,
    knoppen: [
      { label: 'Import annuleren', waarde: 'annuleren' },
      { label: 'Huidige gegevens vervangen', waarde: 'vervangen', soort: 'gevaar' },
      { label: 'Samenvoegen', waarde: 'samenvoegen', soort: 'primair' },
    ],
  });
  if (keuze === 'samenvoegen') {
    const verslag = voegSamen(gegevens, true);
    await naWijziging('Back-up samengevoegd.');
    await informeer('Samenvoegen voltooid', `<p>Toegevoegd: ${verslag.toegevoegd.processen} processen, ${verslag.toegevoegd.procesmetingen} procesmetingen, ${verslag.toegevoegd.frequentiemetingen} frequentiemetingen.</p>
      ${verslag.conflicten.length ? `<div class="melding waarschuwing"><strong>Niet geïmporteerd (conflict):</strong><ul>${verslag.conflicten.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}`);
  } else if (keuze === 'vervangen') {
    const ok = await bevestig('Huidige gegevens vervangen', '<div class="melding waarschuwing">Alle huidige gegevens worden gewist en vervangen door de back-up. Maak eventueel eerst een back-up van de huidige gegevens.</div><p>Weet u het zeker?</p>', 'Ja, vervangen', true);
    if (!ok) return;
    staat = gegevens;
    metingBewerkId = null;
    frequentieBewerkId = null;
    procesBewerking = null;
    renderProcesEditor();
    resetMetingFormulier(false);
    resetFrequentieFormulier();
    await naWijziging('Gegevens vervangen door de back-up.');
  }
}

// ---------- Wissen en demogegevens ----------

async function wisAlleGegevens() {
  const stap1 = await bevestig('Alle gegevens wissen (stap 1 van 2)',
    `<div class="melding waarschuwing">Hiermee worden <strong>alle</strong> processen, metingen en frequenties van dit apparaat verwijderd (${staat.procesmetingen.length} procesmetingen, ${staat.frequentiemetingen.length} frequentiemetingen, ${staat.processen.length} processen).</div>
     <p>Download eerst een back-up als u de gegevens wilt bewaren. Wilt u doorgaan?</p>`, 'Doorgaan', true);
  if (!stap1) return;
  const stap2 = await dialoog({
    titel: 'Alle gegevens wissen (stap 2 van 2)',
    inhoud: `<p>Typ <strong>WISSEN</strong> in het vak hieronder om te bevestigen.</p><input type="text" id="wisBevestiging" autocomplete="off" aria-label="Typ WISSEN om te bevestigen">
             <div id="wisFout" class="veldfout"></div>`,
    knoppen: [
      { label: 'Annuleren', waarde: false },
      {
        label: 'Alle gegevens definitief wissen', waarde: true, soort: 'gevaar',
        controle: () => {
          const ok = $('#wisBevestiging').value.trim() === 'WISSEN';
          if (!ok) $('#wisFout').textContent = 'Typ precies WISSEN (hoofdletters) om te bevestigen.';
          return ok;
        },
      },
    ],
  });
  if (stap2 !== true) return;
  staat = legeStaat();
  procesBewerking = null;
  renderProcesEditor();
  resetMetingFormulier(false);
  resetFrequentieFormulier();
  await naWijziging('Alle gegevens zijn gewist.');
}

async function laadDemo() {
  const ok = await bevestig('Demogegevens laden',
    '<p>Er worden fictieve processen, metingen en frequenties toegevoegd (ProcesID\'s beginnen met <strong>DEMO-</strong>). Uw eigen gegevens worden niet gewijzigd.</p><p>Demogegevens zijn overal gemarkeerd en kunnen met <em>Demogegevens verwijderen</em> weer worden verwijderd.</p>',
    'Demogegevens laden');
  if (!ok) return;
  try {
    laadDemogegevens();
  } catch (e) {
    toonMelding(e.message, true);
    return;
  }
  await naWijziging('Demogegevens zijn geladen.');
}

async function verwijderDemo() {
  if (!bevatDemo()) { toonMelding('Er zijn geen demogegevens aanwezig.'); return; }
  const ok = await bevestig('Demogegevens verwijderen', '<p>Alle gegevens die als demo zijn gemarkeerd worden verwijderd. Uw eigen gegevens blijven behouden.</p>', 'Demogegevens verwijderen', true);
  if (!ok) return;
  verwijderDemogegevens();
  if (metingBewerkId && !zoekMeting(metingBewerkId)) resetMetingFormulier(false);
  if (frequentieBewerkId && !zoekFrequentie(frequentieBewerkId)) resetFrequentieFormulier();
  if (procesBewerking && procesBewerking.origineelId && !zoekProces(procesBewerking.origineelId)) { procesBewerking = null; renderProcesEditor(); }
  await naWijziging('Demogegevens zijn verwijderd.');
}
