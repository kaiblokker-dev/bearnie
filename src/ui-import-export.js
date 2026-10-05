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

/** Kalenderjaar, -week en begin/einde van de week, afgeleid uit een datum (nooit opgeslagen). */
function KALENDER_KOLOMMEN(datum) {
  const k = (r) => kalenderweek(datum(r));
  return [
    ['Kalenderjaar (ISO-week, afgeleid)', (r) => (k(r) ? k(r).jaar : null)],
    ['Kalenderweek (afgeleid)', (r) => (k(r) ? k(r).week : null)],
    ['Begin kalenderweek (afgeleid)', (r) => (k(r) ? k(r).begin : '')],
    ['Einde kalenderweek (afgeleid)', (r) => (k(r) ? k(r).eind : '')],
  ];
}

function knelpuntTekst(s) {
  return s.knelpunt === true ? 'Ja' : s.knelpunt === false ? 'Nee' : 'Niet ingevuld';
}

const KNELPUNT_KOLOMMEN = [
  ['Knelpunt aanwezig', (s) => knelpuntTekst(s)],
  ['Knelpunt: categorie', (s) => (s.knelpunt ? s.knelpuntCategorie || '' : '')],
  ['Knelpunt: omschrijving', (s) => (s.knelpunt ? s.knelpuntOmschrijving || '' : '')],
  ['Knelpunt: gevolg(en)', (s) => (s.knelpunt ? (s.knelpuntGevolgen || []).join('; ') : '')],
  ['Knelpunt: geschatte extra actieve tijd (min)', (s) => (s.knelpunt && isGetal(s.knelpuntExtraActief) ? s.knelpuntExtraActief : null)],
  ['Knelpunt: geschatte extra wachttijd (min)', (s) => (s.knelpunt && isGetal(s.knelpuntExtraWacht) ? s.knelpuntExtraWacht : null)],
  ['Knelpunt: bron', (s) => (s.knelpunt ? s.knelpuntBron || '' : '')],
];

/** Eén rij per knelpunt, herleidbaar naar proces, meting, stap, medewerker, datum, kalenderweek, meetwijze en casustype. */
const KOLOMMEN_KNELPUNTEN = [
  ['ProcesID', ({ m }) => m.procesId],
  ['Procesnaam (bij meting)', ({ m }) => m.procesnaam || ''],
  ['MetingID', ({ m }) => m.metingId],
  ['StapID', ({ s }) => s.stapId],
  ['Processtap (bij meting)', ({ s }) => s.stapnaam],
  ['MedewerkerID', ({ m }) => m.medewerkerId || ''],
  ['Meetdatum', ({ m }) => m.datum],
  ['Kalenderjaar (ISO-week)', ({ k }) => (k ? k.jaar : null)],
  ['Kalenderweek', ({ k }) => (k ? k.week : null)],
  ['Meetwijze', ({ m }) => m.meetwijze],
  ['Casustype', ({ m }) => m.casustype],
  ['Test/fictief', ({ m }) => (isTestmeting(m) ? 'Ja' : 'Nee')],
  ['Categorie', ({ s }) => s.knelpuntCategorie || ''],
  ['Omschrijving', ({ s }) => s.knelpuntOmschrijving || ''],
  ['Gevolg(en)', ({ s }) => (s.knelpuntGevolgen || []).join('; ')],
  ['Geschatte extra actieve tijd (min)', ({ s }) => (isGetal(s.knelpuntExtraActief) ? s.knelpuntExtraActief : null)],
  ['Geschatte extra wachttijd (min)', ({ s }) => (isGetal(s.knelpuntExtraWacht) ? s.knelpuntExtraWacht : null)],
  ['Bron', ({ s }) => s.knelpuntBron || ''],
  ['Gemeten actieve tijd stap (min)', ({ s }) => s.actieveTijd],
  ['Gemeten wachttijd stap (min)', ({ s }) => s.wachttijd],
  ['Belangrijkste knelpunt (procesmeting)', ({ m }) => m.belangrijksteKnelpunt || ''],
  ['Bijzonderheden of uitzonderingen (procesmeting)', ({ m }) => m.bijzonderheden || ''],
];

const KOLOMMEN_PROCESMETINGEN = [
  ['MetingID', (m) => m.metingId],
  ['Meetdatum', (m) => m.datum],
  ['ProcesID', (m) => m.procesId],
  ['Procesnaam (bij meting)', (m) => m.procesnaam],
  ['MedewerkerID', (m) => m.medewerkerId || ''],
  ['Casustype', (m) => m.casustype],
  ['Aantal uitvoeringen', (m) => ('aantalUitvoeringen' in m ? m.aantalUitvoeringen : null)],
  ['Uitvoeringseenheid', (m) => m.uitvoeringseenheid || ''],
  ['Omvang', (m) => m.omvang],
  ['Omvangseenheid', (m) => m.omvangseenheid || ''],
  ['Meetwijze', (m) => m.meetwijze],
  ['Algemene toelichting', (m) => m.toelichting || ''],
  ['Herkomst aantal uitvoeringen', (m) => m.aantalUitvoeringenHerkomst || ('aantalUitvoeringen' in m ? 'Ingevoerd' : 'Niet vastgelegd (meting uit versie 1.0)')],
  ['Vastgelegd op', (m) => m.aangemaakt || ''],
  ['Laatst gewijzigd', (m) => m.gewijzigd || ''],
  ['Demogegevens', (m) => (m.demo ? 'Ja' : 'Nee')],
  // Sinds versie 1.4 (achteraan toegevoegd)
  ['Test/fictief', (m) => (isTestmeting(m) ? 'Ja' : 'Nee')],
  ['Controle: totale actieve tijd volgens procesmeting (min)', (m) => (isGetal(m.actieveTijdTotaal) ? m.actieveTijdTotaal : null)],
  ['Controle: totale wachttijd volgens procesmeting (min)', (m) => (isGetal(m.wachttijdTotaal) ? m.wachttijdTotaal : null)],
  ...KALENDER_KOLOMMEN((m) => m.datum),
  // Sinds versie 1.5
  ['Aantal resulterende diensttijdblokken', (m) => (isGetal(m.aantalBlokken) ? m.aantalBlokken : null)],
  // Sinds versie 1.6
  ['Belangrijkste knelpunt', (m) => m.belangrijksteKnelpunt || ''],
  ['Bijzonderheden of uitzonderingen', (m) => m.bijzonderheden || ''],
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
  ['Test/fictief (via procesmeting)', (s) => (isTestStapmeting(s) ? 'Ja' : 'Nee')],
  // Sinds versie 1.6
  ...KNELPUNT_KOLOMMEN,
];

const KOLOMMEN_FREQUENTIE = [
  ['FrequentieID', (f) => f.frequentieId],
  ['ProcesID', (f) => f.procesId],
  ['Meetperiode', (f) => f.meetperiode],
  ['Aantal uitvoeringen', (f) => f.aantalUitvoeringen],
  ['Uitvoeringseenheid', (f) => f.uitvoeringseenheid || ''],
  ['Totale omvang', (f) => f.totaalVolume],
  ['Omvangseenheid', (f) => f.omvangseenheid || ''],
  ['Meetwijze', (f) => f.meetwijze],
  ['Bron of toelichting', (f) => f.bron || ''],
  ['Vastgelegd op', (f) => f.aangemaakt || ''],
  ['Laatst gewijzigd', (f) => f.gewijzigd || ''],
  ['Demogegevens', (f) => (f.demo ? 'Ja' : 'Nee')],
  // Sinds versie 1.3 (achteraan toegevoegd, zodat bestaande kolommen op hun plaats blijven)
  ['MedewerkerID', (f) => f.medewerkerId || ''],
  ['Periode', (f) => (f.periodeEenheid ? 'per ' + f.periodeEenheid.toLowerCase() : 'Nog niet bepaald')],
  ['Bereik', (f) => f.bereik || 'Nog niet bepaald'],
  ['Afbakening / toelichting', (f) => f.afbakening || ''],
  ['Meetellen in totaal', (f) => meetellenTekst(f)],
  // Sinds versie 1.4
  ['Meetdatum', (f) => f.meetdatum || ''],
  ['Test/fictief', (f) => (isTestmeting(f) ? 'Ja' : 'Nee')],
  ...KALENDER_KOLOMMEN((f) => f.meetdatum),
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
    knelpunten: [KOLOMMEN_KNELPUNTEN, alleKnelpuntRijen(), 'Meettool_knelpunten'],
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
  rijen.push(['Toelichting', 'Tijden in minuten. "Per uitvoering" = per uitvoeringseenheid van het proces (zie kolom Uitvoeringseenheid, bijv. per dossier); dit is de primaire uitkomst. "Per omvangseenheid" (zie kolom Omvangseenheid, bijv. per dienstperiode) is een aanvullende uitkomst. Getallen zijn onafgerond opgeslagen en worden met twee decimalen weergegeven. "Onbekend" = niet te berekenen door ontbrekende invoer (niet als nul verwerkt). n = aantal metingen met een bekende waarde.']);
  rijen.push([]);
  rijen.push([{ v: 'Samenvatting per proces en casustype', s: 'titel' }]);
  const koppen = [
    'ProcesID', 'Procesnaam', 'Casustype', 'Uitvoeringseenheid', 'Omvangseenheid', 'Gebruikte filters', 'Meetwijzen in selectie',
    'Aantal metingen', 'Aantal uitvoeringen (som)', 'Metingen met onbekend aantal uitvoeringen',
    'Primaire uitkomst', 'n primair', 'Mediaan actieve tijd per uitvoering (min) – primair', 'Gemiddelde actieve tijd per uitvoering (min)', 'Minimum actieve tijd per uitvoering (min)', 'Maximum actieve tijd per uitvoering (min)',
    'n wachttijd per uitvoering', 'Mediaan wachttijd per uitvoering (min)', 'Gemiddelde wachttijd per uitvoering (min)',
    'Aanvullende uitkomst', 'n aanvullend', 'Mediaan actieve tijd per omvangseenheid (min) – aanvullend', 'Gemiddelde actieve tijd per omvangseenheid (min)', 'Minimum actieve tijd per omvangseenheid (min)', 'Maximum actieve tijd per omvangseenheid (min)',
    'FrequentieID', 'Meetperiode', 'Aantal uitvoeringen in meetperiode', 'Totale omvang in meetperiode', 'Meetwijze frequentie',
    'Geschatte actieve tijd per meetperiode (min)', 'Geschatte actieve tijd per meetperiode (uur)', 'Toelichting tijdsbelasting',
    'Onderliggende MetingID\'s', 'MetingID\'s primaire uitkomst', 'MetingID\'s aanvullende uitkomst', 'Niet meegenomen (reden)',
  ];
  rijen.push(koppen.map(kop));
  const kopRij = rijen.length;
  for (const procesId of alleProcesIds()) {
    const sam = procesSamenvatting(procesId, filters);
    const freq = kiesFrequentie(procesId);
    const e = eenhedenVoorResultaat(procesId, sam.metingen);
    for (const c of CASUSTYPEN) {
      const g = sam.perCasustype[c];
      let belasting = null;
      let belastingTekst = '';
      if (c === 'Normaal') {
        const b = berekenTijdsbelasting(freq, g, procesId);
        belasting = b.waarde;
        belastingTekst = isGetal(b.waarde)
          ? `${fmtAantal(b.aantalUitvoeringen)} ${e.uitvoeringseenheidMeervoud} × mediaan ${fmtGetal(b.mediaan)} min per ${e.uitvoeringseenheid} (normale gevallen, n = ${b.n})`
          : 'Niet berekend: ' + b.ontbreekt.join(' ');
      } else {
        belastingTekst = 'Niet berekend voor uitzonderingen (tijdsbelasting gebruikt de mediaan van normale gevallen).';
      }
      const uitgesloten = [];
      const labels = { actiefPerUitvoering: 'primair', wachtPerUitvoering: 'wachttijd', actiefPerOmvang: 'aanvullend' };
      for (const [k, label] of Object.entries(labels)) for (const u of g.uitgesloten[k]) uitgesloten.push(`${u.metingId} (${label}): ${u.reden}`);
      rijen.push([
        procesId, procesNaam(procesId), c, e.uitvoeringseenheid, e.omvangseenheid, filtersAlsTekst(filters), meetwijzeVerdelingTekst(g.meetwijzen),
        g.aantal, g.aantalUitvoeringen, g.metingenZonderAantal.join(', '),
        `Actieve tijd per ${e.uitvoeringseenheid}`, g.actiefPerUitvoering.n, getalOfLeeg(g.actiefPerUitvoering.mediaan), getalOfLeeg(g.actiefPerUitvoering.gemiddelde), getalOfLeeg(g.actiefPerUitvoering.minimum), getalOfLeeg(g.actiefPerUitvoering.maximum),
        g.wachtPerUitvoering.n, getalOfLeeg(g.wachtPerUitvoering.mediaan), getalOfLeeg(g.wachtPerUitvoering.gemiddelde),
        `Actieve tijd per ${e.omvangseenheid}`, g.actiefPerOmvang.n, getalOfLeeg(g.actiefPerOmvang.mediaan), getalOfLeeg(g.actiefPerOmvang.gemiddelde), getalOfLeeg(g.actiefPerOmvang.minimum), getalOfLeeg(g.actiefPerOmvang.maximum),
        freq ? freq.frequentieId : ONBEKEND, freq ? freq.meetperiode : '', freq ? getalOfLeeg(freq.aantalUitvoeringen) : '', freq ? getalOfLeeg(freq.totaalVolume) : '', freq ? freq.meetwijze : '',
        c === 'Normaal' ? getalOfLeeg(belasting) : '', c === 'Normaal' ? (isGetal(belasting) ? belasting / 60 : ONBEKEND) : '', belastingTekst,
        g.metingIds.join(', '), g.actiefPerUitvoering.metingIds.join(', '), g.actiefPerOmvang.metingIds.join(', '), uitgesloten.join('; '),
      ]);
    }
  }
  rijen.push([]);
  rijen.push([{ v: 'Resultaten per processtap (tijden per uitvoering: stapwaarde / aantal uitvoeringen van de meting)', s: 'titel' }]);
  const stapKoppen = ['ProcesID', 'Casustype', 'Uitvoeringseenheid', 'StapID', 'Processtap', 'Aantal waarnemingen', 'n actieve tijd', 'Mediaan actieve tijd per uitvoering (min)', 'Gemiddelde actieve tijd per uitvoering (min)',
    'Minimum actieve tijd per uitvoering (min)', 'Maximum actieve tijd per uitvoering (min)', 'n wachttijd', 'Mediaan wachttijd per uitvoering (min)', 'Gemiddelde wachttijd per uitvoering (min)', 'Percentage metingen met wachttijd', 'Onderliggende MetingID\'s'];
  rijen.push(stapKoppen.map(kop));
  for (const procesId of alleProcesIds()) {
    const e = eenhedenVoorResultaat(procesId, staat.procesmetingen.filter((m) => m.procesId === procesId));
    for (const c of CASUSTYPEN) {
      for (const r of stapSamenvatting(procesId, filters, c)) {
        if (!r.aantalWaarnemingen) continue;
        rijen.push([procesId, c, e.uitvoeringseenheid, r.stapId, r.naam, r.aantalWaarnemingen, r.actief.n, getalOfLeeg(r.actief.mediaan), getalOfLeeg(r.actief.gemiddelde),
          getalOfLeeg(r.actief.minimum), getalOfLeeg(r.actief.maximum), r.wacht.n, getalOfLeeg(r.wacht.mediaan), getalOfLeeg(r.wacht.gemiddelde),
          getalOfLeeg(r.percentageMetWacht), r.metingIds.join(', ')]);
      }
    }
  }
  return { naam: 'Resultaten', rijen, kolombreedtes: [14, 30, 13, 16, 16, 40, 28, 10, 12, 20, 24, 8, 18, 16, 16, 16, 10, 16, 16, 24, 8, 18, 16, 16, 16, 16, 16, 14, 14, 20, 18, 18, 50, 40, 30, 30, 50], kopRij };
}

/** Tabblad 'Knelpuntenanalyse': samenvatting per proces en casustype, per stap, per categorie en per medewerker. */
function knelpuntBlad(filters) {
  const rijen = [];
  rijen.push([{ v: 'Knelpuntenanalyse – automatisch berekend uit de geregistreerde knelpunten per processtap', s: 'titel' }]);
  if (bevatDemo()) rijen.push([{ v: DEMO_WAARSCHUWING, s: 'waarschuwing' }]);
  rijen.push(['Gebruikte filters', filtersAlsTekst(filters)]);
  rijen.push(['Let op', 'De geschatte extra tijd is verklarend en zit al in de gemeten actieve tijd en wachttijd. Ze is NIET opgeteld bij procesduur, gemiddelden of tijdsbelasting. Iedere knelpunt staat afzonderlijk in het tabblad Knelpunten.']);
  rijen.push([]);
  rijen.push([{ v: 'Samenvatting per proces en casustype', s: 'titel' }]);
  rijen.push(['ProcesID', 'Casustype', 'Metingen', 'Metingen met minimaal één knelpunt', 'Percentage metingen met knelpunt', 'Metingen zonder knelpuntregistratie', 'Aantal knelpunten',
    'Totaal geschatte extra actieve tijd (min)', 'Gemiddelde geschatte extra actieve tijd per knelpunt (min)', 'n extra actief',
    'Totaal geschatte extra wachttijd (min)', 'Gemiddelde geschatte extra wachttijd per knelpunt (min)', 'n extra wacht', 'MetingID\'s met knelpunt'].map(kop));
  const kopRij = rijen.length;
  const analyses = [];
  for (const procesId of alleProcesIds()) {
    for (const c of CASUSTYPEN) {
      const a = knelpuntAnalyse(procesId, filters, c);
      if (!a.aantalMetingen) continue;
      analyses.push([procesId, a]);
      rijen.push([procesId, c, a.aantalMetingen, a.metingenMetKnelpunt.length, getalOfLeeg(a.percentageMetKnelpunt), a.metingenZonderRegistratie.length, a.aantalKnelpunten,
        getalOfLeeg(a.extraActief.totaal), getalOfLeeg(a.extraActief.gemiddelde), a.extraActief.n, getalOfLeeg(a.extraWacht.totaal), getalOfLeeg(a.extraWacht.gemiddelde), a.extraWacht.n,
        a.metingenMetKnelpunt.join(', ')]);
    }
  }
  rijen.push([]);
  rijen.push([{ v: 'Voorkomens per processtap', s: 'titel' }]);
  rijen.push(['ProcesID', 'Casustype', 'StapID', 'Processtap', 'Waarnemingen', 'Waarvan ja/nee ingevuld', 'Aantal knelpunten', 'Totaal extra actief (min)', 'Totaal extra wacht (min)', 'MetingID\'s'].map(kop));
  for (const [procesId, a] of analyses) for (const r of a.perStap) rijen.push([procesId, a.casustype, r.stapId, r.naam, r.waarnemingen, r.geregistreerd, r.aantal, getalOfLeeg(r.extraActief.totaal), getalOfLeeg(r.extraWacht.totaal), r.metingIds.join(', ')]);
  rijen.push([]);
  rijen.push([{ v: 'Voorkomens per categorie', s: 'titel' }]);
  rijen.push(['ProcesID', 'Casustype', 'Categorie', 'Aantal knelpunten', 'Knelpunten (MetingID/StapID)'].map(kop));
  for (const [procesId, a] of analyses) for (const r of a.perCategorie) rijen.push([procesId, a.casustype, r.categorie, r.aantal, r.ids.join(', ')]);
  rijen.push([]);
  rijen.push([{ v: 'Uitsplitsing per medewerker', s: 'titel' }]);
  rijen.push(['ProcesID', 'Casustype', 'MedewerkerID', 'Metingen', 'Metingen met knelpunt', 'Aantal knelpunten', 'Totaal extra actief (min)', 'Totaal extra wacht (min)'].map(kop));
  for (const [procesId, a] of analyses) for (const r of a.perMedewerker) rijen.push([procesId, a.casustype, medewerkerLabel(r.medewerkerId), r.metingen, r.metKnelpunt, r.aantal, getalOfLeeg(r.extraActief.totaal), getalOfLeeg(r.extraWacht.totaal)]);
  return { naam: 'Knelpuntenanalyse', rijen, kolombreedtes: [14, 14, 22, 30, 14, 16, 14, 18, 18, 10, 18, 18, 10, 40], kopRij };
}

/** Tabblad 'Totaaloverzicht': totale frequentie en geschatte actieve tijdsbelasting per proces en periode. */
function totaalBlad(filters) {
  const rijen = [];
  rijen.push([{ v: 'Totaaloverzicht – totale frequentie en geschatte actieve tijdsbelasting (automatisch berekend)', s: 'titel' }]);
  if (bevatDemo()) rijen.push([{ v: DEMO_WAARSCHUWING, s: 'waarschuwing' }]);
  rijen.push(['Gebruikte filters', filtersAlsTekst(filters)]);
  rijen.push(['Keuze gemiddelde', keuzeGemiddeldeTekst(filters) + ' (normale gevallen)']);
  rijen.push(['Formule', 'Geschatte actieve tijdsbelasting (min) = totale frequentie × gemiddelde actieve tijd per uitvoering; uren = minuten / 60. Wachttijd telt niet mee. Totale frequentie = som van frequentiemetingen met "Meetellen in totaal" = Ja en dezelfde periode, alleen als ze niet (mogelijk) overlappen.']);
  rijen.push([]);
  const koppen = ['ProcesID', 'Procesnaam', 'Periode', 'Kalenderweek (selectie)', 'Kalenderweken gebruikte frequenties', 'Meetperiode(n) (omschrijving)', 'Uitvoeringseenheid', 'Totale frequentie', 'Gemiddelde actieve tijd per uitvoering (min)',
    'Minimum actieve tijd (min)', 'Maximum actieve tijd (min)', 'Geschatte actieve tijdsbelasting (min)', 'Geschatte actieve tijdsbelasting (uur)',
    'Gemiddelde wachttijd per uitvoering (min, niet meegeteld)', 'Aantal procesmetingen', 'Aantal frequentiemetingen', 'Keuze gemiddelde', 'Test/fictieve metingen', 'Mogelijke overlap',
    'Gebruikte medewerker-ID\'s', 'Gebruikte MetingID\'s', 'Gebruikte frequentie-ID\'s', 'Bronnen frequentie', 'Meetwijzen tijd', 'Status', 'Waarschuwingen',
    'Dossiermetingen (normaal)', 'Waarvan met aantal diensttijdblokken', 'Totaal omvang (bijv. dienstperioden)', 'Totaal diensttijdblokken', 'Gemiddelde omvang per uitvoering',
    'Gemiddeld aantal diensttijdblokken per uitvoering', 'Gemiddelde actieve tijd per diensttijdblok (min)', 'Geschat aantal diensttijdblokken per periode', 'Verhouding diensttijdblokken / omvang', 'MetingID\'s met diensttijdblokken'];
  rijen.push(koppen.map(kop));
  const kopRij = rijen.length;
  for (const procesId of alleProcesIds()) {
    const perioden = totaalPeriodenVanProces(procesId);
    // Per periode: eerst alle kalenderweken samen, daarna iedere kalenderweek afzonderlijk.
    for (const periode of perioden.length ? perioden : [null]) {
      for (const week of ['', ...totaalWekenVanProces(procesId)]) {
        const t = berekenTotaalOverzicht(procesId, filters, periode, week);
        if (week && !t.frequenties.length) continue;
        const blokkades = [...t.frequentieBlokkades, ...t.tijdBlokkades];
        rijen.push([procesId, procesNaam(procesId), periode ? 'per ' + periode.toLowerCase() : ONBEKEND, week ? kalenderweekSleutelTekst(week) : 'alle kalenderweken',
          t.kalenderweken.map(kalenderweekSleutelTekst).join(', '), t.meetperioden.join(', '), t.eenheden.uitvoeringseenheid,
          getalOfLeeg(t.totaleFrequentie), getalOfLeeg(t.gemiddeldeActief), getalOfLeeg(t.minimumActief), getalOfLeeg(t.maximumActief),
          getalOfLeeg(t.minuten), getalOfLeeg(t.uren), getalOfLeeg(t.gemiddeldeWacht), t.aantalProcesmetingen, t.frequenties.length,
          keuzeGemiddeldeTekst(filters), filters.metTest ? 'meegenomen' : 'uitgesloten',
          t.frequenties.length < 2 ? 'n.v.t.' : t.mogelijkeOverlap ? 'Ja – totaal niet berekend' : 'Nee',
          t.medewerkerIds.join(', '), t.metingIds.join(', '), t.frequenties.map((f) => f.frequentieId).join(', '),
          t.bronnen.map(bronLabel).join('; '), t.meetwijzenTijd.join('; '),
          isGetal(t.minuten) ? 'Berekend' : 'Niet (volledig) berekend', [...blokkades, ...t.waarschuwingen].join(' | '),
          t.blokken.aantalMetingen, t.blokken.metingenMetBlokken.length, t.blokken.totaalOmvang, getalOfLeeg(t.blokken.totaalBlokken), getalOfLeeg(t.blokken.omvangPerDossier.waarde),
          getalOfLeeg(t.blokken.blokkenPerDossier.waarde), getalOfLeeg(t.blokken.actiefPerBlok.waarde), getalOfLeeg(t.blokkenPerPeriode), getalOfLeeg(t.blokken.verhouding.waarde),
          t.blokken.metingenMetBlokken.join(', ')]);
      }
    }
  }
  rijen.push([]);
  rijen.push([{ v: 'Status per frequentiemeting (alle kalenderweken, per eigen periode)', s: 'titel' }]);
  rijen.push(['FrequentieID', 'ProcesID', 'MedewerkerID', 'Meetdatum', 'Kalenderweek', 'Periode', 'Bereik', 'Aantal uitvoeringen', 'Uitvoeringseenheid', 'Bron', 'Meetellen in totaal', 'Test/fictief', 'Meegenomen in totaal', 'Reden'].map(kop));
  for (const procesId of alleProcesIds()) {
    for (const f of frequentiesVanProces(procesId).slice().sort((a, b) => vergelijkTekst(a.frequentieId, b.frequentieId))) {
      const t = berekenTotaalOverzicht(procesId, filters, f.periodeEenheid || null, '');
      const st = t.status.find((x) => x.frequentie.frequentieId === f.frequentieId);
      const meegeteld = st && st.geselecteerd && isGetal(t.totaleFrequentie);
      const reden = st && !st.geselecteerd ? st.reden : (!isGetal(t.totaleFrequentie) ? 'totaal niet berekend: ' + t.frequentieBlokkades.join(' ') : '');
      rijen.push([f.frequentieId, procesId, f.medewerkerId || '', f.meetdatum || '', kalenderweekTekst(f.meetdatum, true), f.periodeEenheid ? 'per ' + f.periodeEenheid.toLowerCase() : 'Nog niet bepaald',
        f.bereik || 'Nog niet bepaald', getalOfLeeg(f.aantalUitvoeringen), eenhedenVan(f).uitvoeringseenheid, bronLabel(f.meetwijze), meetellenTekst(f), isTestmeting(f) ? 'Ja' : 'Nee',
        meegeteld ? 'Ja' : 'Nee', reden]);
    }
  }
  return { naam: 'Totaaloverzicht', rijen, kolombreedtes: [12, 28, 12, 22, 26, 18, 14, 12, 16, 12, 12, 16, 14, 16, 10, 10, 26, 14, 18, 22, 30, 30, 34, 24, 18, 90], kopRij };
}

/** Of een procesmeting met de huidige filters in de resultaten is meegenomen, met reden. */
function meegenomenStatus(m, filters, b) {
  if (isTestmeting(m) && !filters.metTest) return 'Nee – test/fictieve meting (uitgesloten)';
  if (!metingVoldoetAanFilters(m, { ...filters, procesId: m.procesId })) return 'Nee – buiten de gekozen filters (meetwijze, medewerker of datum)';
  if (!isGetal((b || berekenMeting(m)).actiefPerUitvoering)) return `Ja (${m.casustype}), maar actieve tijd per uitvoering is Onbekend`;
  return `Ja (${m.casustype})`;
}

/** Tabblad 'Per medewerker': samenvatting per medewerker en de individuele metingen met berekende waarden. */
function medewerkerBlad(filters) {
  const rijen = [];
  const f = { ...filters, medewerker: '' };
  rijen.push([{ v: 'Resultaten per medewerker – automatisch berekend uit de individuele procesmetingen', s: 'titel' }]);
  if (bevatDemo()) rijen.push([{ v: DEMO_WAARSCHUWING, s: 'waarschuwing' }]);
  rijen.push(['Gebruikte filters', filtersAlsTekst(f) + ' (dit tabblad toont altijd alle medewerkers)']);
  rijen.push(['Toelichting', 'Iedere waarde is eerst per procesmeting berekend (actieve tijd en wachttijd per uitvoering; omvang per uitvoering = omvang / aantal uitvoeringen). De rij "Alle medewerkers (gecombineerd)" is berekend uit alle individuele metingen samen, niet uit de gemiddelden per medewerker. n = aantal metingen met een bekende waarde. Tijden in minuten.']);
  rijen.push([]);
  rijen.push([{ v: 'Samenvatting per medewerker', s: 'titel' }]);
  const koppen = ['ProcesID', 'Procesnaam', 'Casustype', 'MedewerkerID', 'Uitvoeringseenheid', 'Omvangseenheid', 'Aantal metingen',
    'n actieve tijd', 'Gemiddelde actieve tijd per uitvoering (min)', 'Minimum actieve tijd per uitvoering (min)', 'Maximum actieve tijd per uitvoering (min)',
    'n wachttijd', 'Gemiddelde wachttijd per uitvoering (min)', 'n omvang', 'Gemiddelde omvang per uitvoering', 'MetingID\'s'];
  rijen.push(koppen.map(kop));
  const kopRij = rijen.length;
  for (const procesId of alleProcesIds()) {
    const e = eenhedenVoorResultaat(procesId, staat.procesmetingen.filter((m) => m.procesId === procesId));
    for (const c of CASUSTYPEN) {
      const ms = medewerkerSamenvatting(procesId, f, c);
      if (!ms.totaal.aantal) continue;
      const regel = (label, g) => [procesId, procesNaam(procesId), c, label, e.uitvoeringseenheid, e.omvangseenheid, g.aantal,
        g.actief.n, getalOfLeeg(g.actief.gemiddelde), getalOfLeeg(g.actief.minimum), getalOfLeeg(g.actief.maximum),
        g.wacht.n, getalOfLeeg(g.wacht.gemiddelde), g.omvang.n, getalOfLeeg(g.omvang.gemiddelde), g.metingIds.join(', ')];
      for (const g of ms.perMedewerker) rijen.push(regel(medewerkerLabel(g.medewerkerId), g));
      rijen.push(regel('Alle medewerkers (gecombineerd)', ms.totaal));
    }
  }
  rijen.push([]);
  rijen.push([{ v: 'Individuele procesmetingen – alle metingen afzonderlijk, met berekende waarden, controles en of ze in de resultaten zijn meegenomen', s: 'titel' }]);
  rijen.push(['MetingID', 'Meetdatum', 'Kalenderweek', 'ProcesID', 'Casustype', 'MedewerkerID', 'Meetwijze', 'Test/fictief', 'Meegenomen in resultaten', 'Aantal uitvoeringen', 'Uitvoeringseenheid', 'Omvang', 'Omvangseenheid',
    'Totale actieve tijd (min)', 'Actieve tijd per uitvoering (min)', 'Totale wachttijd (min)', 'Wachttijd per uitvoering (min)', 'Omvang per uitvoering', 'Actieve tijd per omvangseenheid (min)',
    'Controle actief: procesmeting (min)', 'Controle actief: som stapmetingen (min)', 'Controle actief: verschil (min)',
    'Controle wacht: procesmeting (min)', 'Controle wacht: som stapmetingen (min)', 'Controle wacht: verschil (min)', 'Afwijking proces/stappen',
    'Aantal resulterende diensttijdblokken', 'Actieve tijd per diensttijdblok (min)'].map(kop));
  for (const m of [...staat.procesmetingen].sort((a, b) => vergelijkTekst(a.metingId, b.metingId))) {
    const b = berekenMeting(m);
    const e = eenhedenVan(m);
    const c = controleProcesStap(m, stapmetingenVan(m.metingId));
    const ctl = (x) => (x ? [x.procesmeting, x.stapmetingen, x.verschil] : ['', '', '']);
    rijen.push([m.metingId, m.datum, kalenderweekTekst(m.datum, true), m.procesId, m.casustype, m.medewerkerId || '(niet ingevuld)', m.meetwijze, isTestmeting(m) ? 'Ja' : 'Nee', meegenomenStatus(m, filters, b),
      'aantalUitvoeringen' in m ? getalOfLeeg(m.aantalUitvoeringen) : ONBEKEND, e.uitvoeringseenheid, getalOfLeeg(m.omvang), e.omvangseenheid,
      getalOfLeeg(b.totaalActief), getalOfLeeg(b.actiefPerUitvoering), getalOfLeeg(b.totaalWacht), getalOfLeeg(b.wachtPerUitvoering),
      getalOfLeeg(b.omvangPerUitvoering), getalOfLeeg(b.actiefPerOmvang),
      ...ctl(c.actief), ...ctl(c.wacht), c.actief || c.wacht ? (c.heeftAfwijking ? 'Ja: ' + controleTekst(c).join(' ') : 'Nee') : 'Niet te controleren (geen totaal bij procesmeting)',
      isGetal(m.aantalBlokken) ? m.aantalBlokken : '', isGetal(m.aantalBlokken) && m.aantalBlokken > 0 && isGetal(b.totaalActief) ? b.totaalActief / m.aantalBlokken : '']);
  }
  return { naam: 'Per medewerker', rijen, kolombreedtes: [16, 14, 18, 26, 16, 16, 18, 10, 34, 12, 14, 10, 14, 14, 16, 14, 16, 14, 16, 14, 14, 14, 14, 14, 14, 50], kopRij };
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
  r.push(['Uitvoeringseenheid', 'Wat één uitvoering van een proces is, vastgelegd per proces (bijvoorbeeld bij PR24: één uitvoering = één dossier).']);
  r.push(['Aantal uitvoeringen', 'Het aantal uitvoeringseenheden dat in één procesmeting is verwerkt (bijvoorbeeld het aantal dossiers). Verplicht bij iedere nieuwe meting en groter dan nul.']);
  r.push(['Omvangseenheid', 'De eenheid waarin de omvang van het werk wordt uitgedrukt, vastgelegd per proces (bijvoorbeeld bij PR24: het aantal relevante dienstperioden).']);
  r.push(['Omvang', 'Het aantal omvangseenheden dat in één procesmeting is verwerkt (bijvoorbeeld 7 dienstperioden). Groter dan nul, of leeg als onbekend.']);
  r.push(['Frequentie', 'Het aantal uitvoeringen (uitvoeringseenheden) van een proces in een meetperiode, met eventueel de totale omvang (omvangseenheden) in die periode. De totale omvang mag onbekend zijn. Een frequentie hoort bij het proces als geheel, niet bij een processtap.']);
  r.push(['Procesmeting', 'Eén waarneming van een proces, met het aantal uitvoeringen, de omvang en per processtap een stapmeting.']);
  r.push(['Casustype', 'Normaal of Uitzondering. Beide groepen worden altijd afzonderlijk geanalyseerd.']);
  r.push([]);
  r.push(t('Formules'));
  r.push(['Totale actieve tijd', 'Som van de actieve tijd van alle processtappen van een meting.']);
  r.push(['Totale wachttijd', 'Som van de wachttijd van alle processtappen van een meting.']);
  r.push(['Actieve tijd per uitvoering (PRIMAIRE UITKOMST)', 'Totale actieve tijd / aantal uitvoeringen (bijv. minuten per dossier).']);
  r.push(['Wachttijd per uitvoering', 'Totale wachttijd / aantal uitvoeringen.']);
  r.push(['Actieve tijd per omvangseenheid (aanvullende uitkomst)', 'Totale actieve tijd / omvang (bijv. minuten per dienstperiode).']);
  r.push(['Wachttijd per omvangseenheid', 'Totale wachttijd / omvang.']);
  r.push(['Tijd per processtap', 'Actieve tijd (of wachttijd) van de stap / aantal uitvoeringen van de meting, dus per uitvoeringseenheid.']);
  r.push(['Mediaan', 'De middelste waarde na sorteren; bij een even aantal waarden het gemiddelde van de twee middelste waarden. De mediaan is de belangrijkste uitkomst.']);
  r.push(['Gemiddelde', 'Som van de waarden / aantal waarden.']);
  r.push(['Minimum en maximum', 'Kleinste en grootste waarde.']);
  r.push(['Percentage met wachttijd', 'Aantal stapmetingen met wachttijd > 0 / aantal stapmetingen met een bekende wachttijd × 100.']);
  r.push(['Geschatte actieve tijd per meetperiode', 'Aantal uitvoeringen in de meetperiode (uit de gekozen frequentiemeting, bijv. aantal dossiers) × mediaan actieve tijd per uitvoering van de normale gevallen (bijv. minuten per dossier). De totale omvang in de meetperiode (bijv. dienstperioden) wordt hierbij niet gebruikt en mag onbekend zijn.']);
  r.push([]);
  r.push(t('Meetwijzen'));
  r.push(['Gemeten', 'De tijd is tijdens de uitvoering gemeten (handmatig genoteerd of met de timer in de tool).']);
  r.push(['Geschat door medewerker', 'De tijd of frequentie is achteraf door een medewerker geschat. Schattingen blijven als schatting zichtbaar.']);
  r.push(['Uit systeemgegevens', 'De waarde is afgeleid uit gegevens van een informatiesysteem (bijvoorbeeld logbestanden of rapportages).']);
  r.push(['Geteld (frequentie)', 'Het aantal uitvoeringen is handmatig geteld.']);
  r.push(['Resultaten per medewerker', 'Per MedewerkerID: aantal metingen, gemiddelde/minimum/maximum actieve tijd per uitvoering, gemiddelde wachttijd per uitvoering en gemiddelde omvang per uitvoering (omvang / aantal uitvoeringen), elk met het aantal gebruikte metingen (n). Het gecombineerde resultaat (alle medewerkers) wordt berekend uit alle individuele metingen samen, niet uit de gemiddelden per medewerker. MedewerkerID\'s zijn anonieme codes (bijv. PZ01); er worden geen namen vastgelegd.']);
  r.push(['Filter op medewerker', 'Resultaten kunnen worden berekend voor alle medewerkers samen (standaard) of voor één MedewerkerID. Het gebruikte filter staat bij de resultaten vermeld.']);
  r.push(['Meetmoment en kalenderweek', 'Meetdatum = de datum waarop de meting is uitgevoerd. Kalenderjaar, kalenderweek en begin/einde van de week worden automatisch uit de meetdatum berekend volgens ISO 8601 (Nederlandse weekindeling, maandag t/m zondag; week 1 bevat de eerste donderdag van het jaar). Kalenderjaar is het ISO-weekjaar. Het meetmoment is iets anders dan de frequentieperiode (per dag, week, maand of jaar).']);
  r.push(['Doorlooptijd', 'Actieve tijd + wachttijd van een uitvoering. Alleen actieve tijd telt mee in de geschatte tijdsbelasting.']);
  r.push(['Test/fictieve metingen', 'Gemarkeerd met Test/fictief = Ja. Ze blijven in de ruwe gegevens staan, maar worden standaard uitgesloten van gemiddelden, grafieken, totale frequenties en tijdsbelasting (tenzij bij de resultaten "Testmetingen meenemen" is gekozen; dat staat in de gebruikte filters). Stapmetingen van een test-procesmeting gelden ook als test. Metingen uit eerdere versies gelden als echt.']);
  r.push(['Controle proces- en stapmetingen', `Als bij een procesmeting een totale actieve tijd of wachttijd is genoteerd, wordt die vergeleken met de som van de stapmetingen. Een verschil groter dan ${fmtGetal(CONTROLE_TOLERANTIE)} minuut geeft een waarschuwing (opslaan blijft mogelijk) en staat in het tabblad Per medewerker. Voor alle berekeningen wordt de som van de stapmetingen gebruikt.`]);
  r.push(['Gekopieerde tijden', 'Tijdvastlegging "Gekopieerd" = waarde overgenomen bij het dupliceren van een eerdere meting; "Gekopieerd, handmatig aangepast" = daarna door de gebruiker gewijzigd.']);
  r.push(['Diensttijdblokken', 'Aantal resulterende diensttijdblokken: het aantal aaneengesloten diensttijdblokken dat na beoordeling van de ABP-periode-regels overblijft en mogelijk als afzonderlijke registratie in Visma wordt ingevoerd (optioneel, geheel getal ≥ 0). Berekeningen (totaal ÷ totaal, normale gevallen, binnen de filters): dienstperioden per dossier = Σ dienstperioden ÷ Σ dossiers; diensttijdblokken per dossier = Σ blokken ÷ Σ dossiers; actieve tijd per diensttijdblok = Σ actieve tijd ÷ Σ blokken; geschat aantal blokken per periode = blokken per dossier × totale frequentie; verhouding = Σ blokken ÷ Σ dienstperioden. Metingen zonder aantal blokken tellen alleen niet mee in de berekeningen per blok. De geschatte actieve tijdsbelasting wordt NIET met het aantal blokken vermenigvuldigd: de tijd voor de blokken zit al in de actieve tijd per dossier.']);
  r.push(['Knelpunten', 'Per processtap kan worden vastgelegd of er een knelpunt was (ja/nee; leeg = niet geregistreerd), met categorie, korte omschrijving, gevolg(en), geschatte extra actieve tijd en wachttijd en bron. Per procesmeting kunnen het belangrijkste knelpunt en bijzonderheden worden vastgelegd. Analyse (binnen de filters, normale gevallen en uitzonderingen apart): aantal en percentage metingen met minimaal één knelpunt (van alle metingen), voorkomens per stap, per categorie en per medewerker, en totale en gemiddelde geschatte extra tijd (gemiddelde per knelpunt met een schatting). De geschatte extra tijd is verklarend: die zit al in de gemeten actieve tijd en wachttijd en wordt NIET opgeteld bij procesduur, gemiddelden of tijdsbelasting (geen dubbeltelling).']);
  r.push(['Totaaloverzicht', 'Totale frequentie = som van het aantal uitvoeringen van frequentiemetingen van hetzelfde proces met "Meetellen in totaal" = Ja en dezelfde periode (dag, week, maand, kwartaal of jaar; perioden worden niet omgerekend). Geschatte actieve tijdsbelasting (min) = totale frequentie × gemiddelde actieve tijd per uitvoering (normale gevallen, alle medewerkers of de gekozen medewerker); uren = minuten / 60. Alleen actieve tijd; wachttijd wordt apart getoond als onderdeel van de doorlooptijd.']);
  r.push(['Overlap en dubbele telling', 'Twee of meer frequenties worden alleen automatisch opgeteld als ze allemaal het bereik "Eigen werkzaamheden" hebben en bij verschillende, ingevulde MedewerkerID\'s horen. Bij een schatting voor de gehele afdeling, een team- of ander bereik, dezelfde medewerker of een ontbrekende MedewerkerID wordt het totaal niet berekend en verschijnt een waarschuwing. Ontbreekt het aantal uitvoeringen, dan wordt het totaal ook niet berekend.']);
  r.push(['Meetellen in totaal', 'Ja / Nee door de gebruiker gekozen. Bij frequentiemetingen uit eerdere versies is dit "Nog niet bepaald"; die tellen niet mee in het totaal, zodat oude frequenties niet automatisch dubbel worden geteld.']);
  r.push(['Bereik van de frequentie', 'Eigen werkzaamheden, team, gehele afdeling of anders. Afbakening / toelichting beschrijft op welke dossiers of werkzaamheden de frequentie betrekking heeft.']);
  r.push(['Berekend / Anders (frequentie)', 'Berekend = afgeleid uit andere gegevens; Anders = zie bron of toelichting.']);
  r.push(['Filter op meetwijze', 'Resultaten kunnen per meetwijze worden berekend. Bij "alle meetwijzen" wordt de verdeling van de meetwijzen bij iedere samenvatting vermeld.']);
  r.push(['Tijdvastlegging', 'Handmatig = tijd rechtstreeks ingevoerd; Timer = tijd met de timer vastgelegd (tot op 0,01 minuut); "Timer, handmatig aangepast" = timerwaarde daarna door de gebruiker gewijzigd.']);
  r.push([]);
  r.push(t('Behandeling van ontbrekende waarden en afronding'));
  r.push(['Ontbrekende waarden', 'Ontbrekende waarden zijn NIET automatisch als nul verwerkt. Als bij een meting een stapwaarde ontbreekt, is de totale tijd van die meting Onbekend en telt de meting niet mee in de betreffende statistiek. Ontbreekt het aantal uitvoeringen, dan is de tijd per uitvoering Onbekend; ontbreekt de omvang, dan is de tijd per omvangseenheid Onbekend. Het aantal gebruikte metingen (n) en de niet meegenomen MetingID\'s staan in Resultaten.']);
  r.push(['Ruwe gegevens', 'De tabbladen Procesmetingen, Stapmetingen en Frequentie bevatten uitsluitend de oorspronkelijke invoer en automatisch vastgelegde identificatievelden. Ruwe meetgegevens worden nooit automatisch aangepast. Alle berekeningen staan in het tabblad Resultaten.']);
  r.push(['Afronding', 'Er wordt intern met volledige precisie gerekend. Alleen de weergave wordt afgerond (standaard op twee decimalen).']);
  r.push(['Weinig metingen', 'Bij minder dan drie metingen toont de tool de melding: "Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig." Er wordt geen betrouwbaarheidsscore berekend.']);
  r.push(['Overgang van versie 1.0', 'Versie 1.0 kende één eenheid per proces; die is overgenomen als omvangseenheid (alleen de veldnaam is gewijzigd, niet de waarde). In versie 1.0 gold één procesmeting als één uitvoering, maar het aantal werd niet vastgelegd. Voor zulke metingen is het aantal uitvoeringen Onbekend, tenzij de gebruiker het heeft aangevuld; de kolom "Herkomst aantal uitvoeringen" in Procesmetingen vermeldt dat.']);
  r.push([]);
  r.push(t('Eenheden per proces'));
  r.push(['ProcesID', 'Procesnaam', 'Uitvoeringseenheid', 'Omvangseenheid', 'Primaire uitkomst', 'Aanvullende uitkomst'].map(kop));
  for (const procesId of alleProcesIds()) {
    const e = eenhedenVoorResultaat(procesId, staat.procesmetingen.filter((m) => m.procesId === procesId));
    r.push([procesId, procesNaam(procesId), `${e.uitvoeringseenheid} (meervoud: ${e.uitvoeringseenheidMeervoud})`, `${e.omvangseenheid} (meervoud: ${e.omvangseenheidMeervoud})`,
      `Actieve tijd per ${e.uitvoeringseenheid} (min)`, `Actieve tijd per ${e.omvangseenheid} (min)`]);
  }
  return { naam: 'Methode', rijen: r, kolombreedtes: [38, 60, 30, 30, 30, 30] };
}

async function exporteerExcel() {
  if (!(await bevestigExportMetDemo())) return;
  const filters = resultaatFilters();
  const blob = maakXlsx([
    resultatenBlad(filters),
    totaalBlad(filters),
    medewerkerBlad(filters),
    knelpuntBlad(filters),
    ruwBlad('Procesmetingen', KOLOMMEN_PROCESMETINGEN, gesorteerdeProcesmetingen(), [16, 11, 12, 34, 13, 13, 9, 14, 24, 40, 22, 22, 13]),
    ruwBlad('Stapmetingen', KOLOMMEN_STAPMETINGEN, gesorteerdeStapmetingen(), [16, 16, 9, 34, 16, 16, 34, 34, 24, 13]),
    ruwBlad('Knelpunten', KOLOMMEN_KNELPUNTEN, alleKnelpuntRijen(), [12, 26, 16, 16, 28, 12, 12, 10, 10, 18, 12, 10, 28, 40, 34, 14, 14, 22, 14, 14, 34, 34]),
    ruwBlad('Frequentie', KOLOMMEN_FREQUENTIE, gesorteerdeFrequenties(), [18, 12, 20, 18, 14, 14, 24, 40, 22, 22, 13]),
    methodeBlad(filters),
  ]);
  downloadBlob(blob, bestandsnaamMetDemo('Meettool_export', 'xlsx'));
  toonMelding('Excel-bestand is aangemaakt.');
}

// ---------- JSON-back-up ----------

/**
 * Volledige back-up. De lijsten met records zijn de bron; medewerkerIds, koppelingen en teststatussen
 * zijn afgeleide overzichten die bij herstel worden gecontroleerd op consistentie.
 */
function maakBackup() {
  const tijd = nuIso();
  return {
    formaat: BACKUP_FORMAAT,
    toolversie: VERSIE,
    schemaversie: staat.schemaversie,
    exportdatum: tijd,
    aangemaaktOp: tijd,
    bevatDemogegevens: bevatDemo(),
    processen: staat.processen,
    processtappen: staat.processtappen,
    procesmetingen: staat.procesmetingen,
    stapmetingen: staat.stapmetingen,
    frequentiemetingen: staat.frequentiemetingen,
    volgnummers: staat.volgnummers,
    instellingen: { volgnummers: staat.volgnummers },
    medewerkerIds: uniek([...staat.procesmetingen, ...staat.frequentiemetingen].map((r) => r.medewerkerId).filter(Boolean)).sort(vergelijkTekst),
    koppelingen: staat.procesmetingen.map((m) => ({ metingId: m.metingId, procesId: m.procesId, stapIds: stapmetingenVan(m.metingId).map((x) => x.stapId) })),
    teststatussen: {
      procesmetingen: staat.procesmetingen.filter(isTestmeting).map((m) => m.metingId),
      frequentiemetingen: staat.frequentiemetingen.filter(isTestmeting).map((f) => f.frequentieId),
    },
  };
}

/** Veiligheidsback-up vóór vervangen: als download én lokaal in de browser (localStorage, indien mogelijk). */
function maakVeiligheidsbackup() {
  const tekst = JSON.stringify(maakBackup(), null, 2);
  downloadTekst(tekst, `Meettool_veiligheidsbackup_${bestandsdatum()}.json`, 'application/json');
  try { localStorage.setItem('meettool-veiligheidsbackup', tekst); } catch (e) { /* te groot of niet beschikbaar; de download blijft */ }
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
    if (m.aantalBlokken !== undefined && m.aantalBlokken !== null && !(Number.isInteger(m.aantalBlokken) && m.aantalBlokken >= 0)) fouten.push(`${l}: aantal diensttijdblokken moet een geheel getal van 0 of hoger zijn.`);
    if ('aantalUitvoeringen' in m && (!getalOfNull(m.aantalUitvoeringen) || (isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen <= 0))) fouten.push(`${l}: aantal uitvoeringen moet groter zijn dan nul of leeg.`);
  });
  const metingIds = new Set(json.procesmetingen.map((m) => m.metingId));
  json.stapmetingen.forEach((s, i) => {
    const l = `Stapmeting ${s.metingId || '?'} / ${s.stapId || i + 1}`;
    if (!tekst(s.metingId) || !metingIds.has(s.metingId)) fouten.push(`${l}: hoort niet bij een procesmeting in het bestand.`);
    if (!tekst(s.stapId)) fouten.push(`${l}: StapID ontbreekt.`);
    if (!getalOfNull(s.actieveTijd) || s.actieveTijd < 0) fouten.push(`${l}: actieve tijd is ongeldig.`);
    if (!getalOfNull(s.wachttijd) || s.wachttijd < 0) fouten.push(`${l}: wachttijd is ongeldig.`);
    if (s.wachttijd > 0 && !tekst(s.redenWachttijd)) fouten.push(`${l}: wachttijd zonder reden.`);
    if (s.knelpunt !== undefined && typeof s.knelpunt !== 'boolean') fouten.push(`${l}: "knelpunt aanwezig" is ongeldig.`);
    if (s.knelpuntCategorie && !KNELPUNT_CATEGORIEEN.includes(s.knelpuntCategorie)) fouten.push(`${l}: knelpuntcategorie is ongeldig.`);
    if (s.knelpuntBron && !KNELPUNT_BRONNEN.includes(s.knelpuntBron)) fouten.push(`${l}: bron van het knelpunt is ongeldig.`);
    if (s.knelpuntGevolgen !== undefined && (!Array.isArray(s.knelpuntGevolgen) || s.knelpuntGevolgen.some((g) => !KNELPUNT_GEVOLGEN.includes(g)))) fouten.push(`${l}: gevolg(en) van het knelpunt zijn ongeldig.`);
    for (const v of ['knelpuntExtraActief', 'knelpuntExtraWacht']) if (s[v] !== undefined && s[v] !== null && !(isGetal(s[v]) && s[v] >= 0)) fouten.push(`${l}: geschatte extra tijd van het knelpunt is ongeldig.`);
  });
  json.frequentiemetingen.forEach((f, i) => {
    const l = `Frequentiemeting ${f.frequentieId || i + 1}`;
    if (!tekst(f.frequentieId)) fouten.push(`Frequentiemeting ${i + 1}: FrequentieID ontbreekt.`);
    if (!tekst(f.procesId)) fouten.push(`${l}: ProcesID ontbreekt.`);
    if (!MEETWIJZEN_FREQUENTIE.includes(f.meetwijze)) fouten.push(`${l}: meetwijze ontbreekt of is ongeldig.`);
    if (!getalOfNull(f.aantalUitvoeringen) || !getalOfNull(f.totaalVolume)) fouten.push(`${l}: aantal of volume is ongeldig.`);
    if (f.periodeEenheid && !PERIODE_EENHEDEN.includes(f.periodeEenheid)) fouten.push(`${l}: periode is ongeldig.`);
    if (f.bereik && !BEREIKEN.includes(f.bereik)) fouten.push(`${l}: bereik is ongeldig.`);
    if (f.meetellenInTotaal !== undefined && f.meetellenInTotaal !== null && typeof f.meetellenInTotaal !== 'boolean') fouten.push(`${l}: "Meetellen in totaal" is ongeldig.`);
  });
  // Afgeleide overzichten (sinds versie 1.4) moeten kloppen met de records; een afwijking duidt op een beschadigd bestand.
  if (Array.isArray(json.koppelingen)) {
    for (const k of json.koppelingen) {
      const echt = json.stapmetingen.filter((x) => x.metingId === k.metingId).map((x) => x.stapId).sort();
      if (!metingIds.has(k.metingId) || JSON.stringify(echt) !== JSON.stringify([...(k.stapIds || [])].sort())) {
        fouten.push(`Koppeling van meting ${k.metingId} komt niet overeen met de stapmetingen in het bestand (bestand mogelijk beschadigd).`);
      }
    }
    if (json.koppelingen.length !== json.procesmetingen.length) fouten.push('Het aantal koppelingen komt niet overeen met het aantal procesmetingen (bestand mogelijk beschadigd).');
  }
  if (json.teststatussen && Array.isArray(json.teststatussen.procesmetingen)) {
    const echt = json.procesmetingen.filter((m) => m.testmeting === true).map((m) => m.metingId).sort();
    if (JSON.stringify(echt) !== JSON.stringify([...json.teststatussen.procesmetingen].sort())) fouten.push('De teststatussen komen niet overeen met de procesmetingen (bestand mogelijk beschadigd).');
  }
  for (const r of [...json.procesmetingen, ...json.frequentiemetingen]) {
    if (r.testmeting !== undefined && typeof r.testmeting !== 'boolean') fouten.push(`${r.metingId || r.frequentieId}: teststatus is ongeldig.`);
  }
  json.frequentiemetingen.forEach((f) => { if (f.meetdatum && !isGeldigeDatum(f.meetdatum)) fouten.push(`Frequentiemeting ${f.frequentieId}: meetdatum is ongeldig.`); });
  dubbel(json.processen, (p) => p.procesId, 'ProcesID');
  dubbel(json.processtappen, (s) => s.stapId, 'StapID');
  dubbel(json.procesmetingen, (m) => m.metingId, 'MetingID');
  dubbel(json.stapmetingen, (s) => `${s.metingId}/${s.stapId}`, 'Stapmeting');
  dubbel(json.frequentiemetingen, (f) => f.frequentieId, 'FrequentieID');

  const normaliseerGetal = (v) => (isGetal(v) ? v : null);
  const gegevens = normaliseerStaat(json);
  // Ontbrekende getallen consequent als null (nooit als 0).
  // Een ontbrekende sleutel aantalUitvoeringen (meting uit versie 1.0) blijft ontbreken.
  gegevens.procesmetingen = gegevens.procesmetingen.map((m) => ({
    ...m,
    omvang: normaliseerGetal(m.omvang),
    ...('aantalUitvoeringen' in m ? { aantalUitvoeringen: normaliseerGetal(m.aantalUitvoeringen) } : {}),
  }));
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
        <dt>Test/fictief</dt><dd>${gegevens.procesmetingen.filter(isTestmeting).length} procesmeting(en), ${gegevens.frequentiemetingen.filter(isTestmeting).length} frequentiemeting(en)</dd>
        <dt>Medewerker-ID's</dt><dd>${esc(uniek([...gegevens.procesmetingen, ...gegevens.frequentiemetingen].map((r) => r.medewerkerId).filter(Boolean)).sort(vergelijkTekst).join(', ') || '—')}</dd>
        <dt>Schemaversie</dt><dd>${esc(json.schemaversie || 1)}${(json.schemaversie || 1) < 3 ? ' (ouder formaat; wordt veilig omgezet, opgeslagen waarden blijven gelijk)' : ''}</dd>
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
    const ok = await bevestig('Huidige gegevens vervangen', '<div class="melding waarschuwing">Alle huidige gegevens worden gewist en vervangen door de back-up.</div><p>Vóór het vervangen wordt automatisch een <strong>veiligheidsback-up</strong> van de huidige gegevens gedownload (en lokaal bewaard). Weet u het zeker?</p>', 'Ja, vervangen', true);
    if (!ok) return;
    maakVeiligheidsbackup();
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
