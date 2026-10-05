// ---------- Datamodel ----------
//
// De staat bestaat uitsluitend uit ruwe invoer en automatisch vastgelegde
// identificatievelden. Berekende waarden worden nooit opgeslagen; ze worden
// telkens opnieuw afgeleid in berekeningen.js.
//
// Ieder proces heeft twee eenheden (elk in enkelvoud en meervoud):
// - uitvoeringseenheid: wat één uitvoering is (bijv. dossier);
// - omvangseenheid: waarin de omvang wordt uitgedrukt (bijv. dienstperiode).
// EENHEID_VELDEN = uitvoeringseenheid, uitvoeringseenheidMeervoud, omvangseenheid, omvangseenheidMeervoud
//
// processen:          { procesId, naam, ...EENHEID_VELDEN, demo, aangemaakt, gewijzigd }
// processtappen:      { stapId, procesId, volgorde, naam, demo }
// procesmetingen:     { metingId, datum, procesId, procesnaam, medewerkerId, casustype,
//                       aantalUitvoeringen, aantalUitvoeringenHerkomst, omvang, ...EENHEID_VELDEN,
//                       meetwijze, toelichting, demo, aangemaakt, gewijzigd }
// stapmetingen:       { metingId, stapId, volgorde, stapnaam, actieveTijd, wachttijd,
//                       redenWachttijd, opmerking, tijdvastlegging, demo }
// frequentiemetingen: { frequentieId, procesId, meetperiode, aantalUitvoeringen, totaalVolume,
//                       ...EENHEID_VELDEN, meetwijze, bron, demo, aangemaakt, gewijzigd,
//                       medewerkerId, periodeEenheid, bereik, afbakening, meetellenInTotaal }
// De laatste vijf velden bestaan sinds versie 1.3 en ontbreken bij oudere frequentiemetingen.
// meetellenInTotaal: true / false; ontbreekt (of null) = 'nog niet bepaald' en telt dan niet mee.
//
// procesnaam, stapnaam en de eenheden bij een meting zijn een kopie op het moment van
// meten, zodat metingen leesbaar blijven als een proces later wordt gewijzigd of verwijderd.
// Ontbrekende getallen worden als null opgeslagen, nooit als 0.
// Schemaversie 3 (versie 1.4) voegt optionele velden toe, die bij oudere records ontbreken:
// - procesmetingen:     testmeting (true = test/fictief), actieveTijdTotaal en wachttijdTotaal
//                       (optionele controlewaarden: totaal volgens de procesmeting zelf);
// - frequentiemetingen: testmeting, meetdatum (meetmoment, JJJJ-MM-DD).
// Een ontbrekend veld testmeting betekent 'geen testmeting'. Kalenderweek, -jaar en begin/einde
// van de week worden nooit opgeslagen maar altijd uit de datum berekend.
// Stapmetingen bij een test-procesmeting gelden automatisch ook als testgegevens.
//
// Metingen uit schemaversie 1 hebben geen veld aantalUitvoeringen (de sleutel ontbreekt);
// dit wordt nooit automatisch ingevuld, alleen na expliciete bevestiging door de gebruiker.

let staat = legeStaat();

function legeStaat() {
  return {
    schemaversie: 3,
    processen: [],
    processtappen: [],
    procesmetingen: [],
    stapmetingen: [],
    frequentiemetingen: [],
    volgnummers: { meting: {}, frequentie: {} },
  };
}

function normaliseerStaat(s) {
  const n = legeStaat();
  if (!s || typeof s !== 'object') return n;
  for (const k of ['processen', 'processtappen', 'procesmetingen', 'stapmetingen', 'frequentiemetingen']) {
    n[k] = Array.isArray(s[k]) ? s[k] : [];
  }
  // Schemaversie 1 -> 2: het enkele veld 'eenheid' was de eenheid van de omvang.
  // Alleen de veldnaam verandert; de waarde blijft gelijk.
  n.processen = n.processen.map(migreerEenheidVelden);
  n.procesmetingen = n.procesmetingen.map(migreerEenheidVelden);
  n.frequentiemetingen = n.frequentiemetingen.map(migreerEenheidVelden);
  if (s.volgnummers && typeof s.volgnummers === 'object') {
    n.volgnummers.meting = { ...(s.volgnummers.meting || {}) };
    n.volgnummers.frequentie = { ...(s.volgnummers.frequentie || {}) };
  }
  return n;
}

const EENHEID_VELDEN = ['uitvoeringseenheid', 'uitvoeringseenheidMeervoud', 'omvangseenheid', 'omvangseenheidMeervoud'];

function migreerEenheidVelden(record) {
  if (!record || typeof record !== 'object') return record;
  const r = { ...record };
  if ('eenheid' in r) {
    const e = typeof r.eenheid === 'string' ? r.eenheid : '';
    if (r.omvangseenheid === undefined) r.omvangseenheid = e;
    if (r.omvangseenheidMeervoud === undefined) r.omvangseenheidMeervoud = e;
    delete r.eenheid;
  }
  for (const k of EENHEID_VELDEN) if (typeof r[k] !== 'string') r[k] = '';
  return r;
}

/**
 * Eenheden voor weergave bij een meting of frequentie: eerst de vastgelegde kopie,
 * anders die van het (huidige) proces, anders een algemene omschrijving.
 */
function eenhedenVan(record, procesId) {
  const p = zoekProces(procesId || (record && record.procesId));
  // Lege of nietszeggende eenheden (zoals "n.v.t.") worden overgeslagen.
  const geldig = (bron, veld) => (bron && !isOntbrekendeEenheid(bron[veld]) ? bron[veld] : '');
  const kies = (veld, standaard) => geldig(record, veld) || geldig(p, veld) || standaard;
  return {
    uitvoeringseenheid: kies('uitvoeringseenheid', 'uitvoering'),
    uitvoeringseenheidMeervoud: kies('uitvoeringseenheidMeervoud', 'uitvoeringen'),
    omvangseenheid: kies('omvangseenheid', 'omvangseenheid'),
    omvangseenheidMeervoud: kies('omvangseenheidMeervoud', 'omvangseenheden'),
  };
}

function eenhedenKopie(procesId) {
  const p = zoekProces(procesId);
  const r = {};
  for (const k of EENHEID_VELDEN) r[k] = p ? p[k] || '' : '';
  return r;
}

/** Waarschuwingstekst als de eenheden van een proces ontbreken of nietszeggend zijn (blokkeert niets). */
function eenheidWaarschuwing(procesId) {
  const p = zoekProces(procesId);
  if (!p) return '';
  const mist = [];
  if (isOntbrekendeEenheid(p.uitvoeringseenheid) || isOntbrekendeEenheid(p.uitvoeringseenheidMeervoud)) mist.push('uitvoeringseenheid (bijv. dossier / dossiers)');
  if (isOntbrekendeEenheid(p.omvangseenheid) || isOntbrekendeEenheid(p.omvangseenheidMeervoud)) mist.push('omvangseenheid (bijv. diensttijdregistratie / diensttijdregistraties)');
  return mist.length ? `Bij proces ${procesId} ontbreekt de ${mist.join(' en de ')}. Er wordt een algemene omschrijving getoond; vul de eenheid aan bij Processen beheren.` : '';
}

function isTestmeting(record) {
  return !!(record && record.testmeting === true);
}

/** Stapmetingen erven de teststatus van hun procesmeting. */
function isTestStapmeting(s) {
  return isTestmeting(zoekMeting(s.metingId));
}

// Afrondingstolerantie (minuten) voor de controle tussen proces- en stapmetingen.
const CONTROLE_TOLERANTIE = 0.05;

/**
 * Controle tussen de (optionele) totalen bij de procesmeting en de som van de stapmetingen.
 * Geeft per soort { procesmeting, stapmetingen, verschil, afwijking } of null als er niets te controleren valt.
 */
function controleProcesStap(meting, stapmetingen) {
  const uit = {};
  for (const [soort, totaalVeld, stapVeld] of [['actief', 'actieveTijdTotaal', 'actieveTijd'], ['wacht', 'wachttijdTotaal', 'wachttijd']]) {
    const totaal = meting[totaalVeld];
    const waarden = stapmetingen.map((s) => s[stapVeld]);
    if (!isGetal(totaal) || !waarden.length || !waarden.every(isGetal)) { uit[soort] = null; continue; }
    const somStappen = som(waarden);
    const verschil = somStappen - totaal;
    uit[soort] = { procesmeting: totaal, stapmetingen: somStappen, verschil, afwijking: Math.abs(verschil) > CONTROLE_TOLERANTIE };
  }
  uit.heeftAfwijking = !!((uit.actief && uit.actief.afwijking) || (uit.wacht && uit.wacht.afwijking));
  return uit;
}

function controleTekst(c) {
  const delen = [];
  if (c.actief && c.actief.afwijking) delen.push(`Let op: de actieve tijd van de stapmetingen is samen ${fmtGetal(c.actief.stapmetingen)} minuten, terwijl bij de procesmeting ${fmtGetal(c.actief.procesmeting)} minuten staat (verschil ${fmtGetal(Math.abs(c.actief.verschil))} minuut).`);
  if (c.wacht && c.wacht.afwijking) delen.push(`Let op: de wachttijd van de stapmetingen is samen ${fmtGetal(c.wacht.stapmetingen)} minuten, terwijl bij de procesmeting ${fmtGetal(c.wacht.procesmeting)} minuten staat (verschil ${fmtGetal(Math.abs(c.wacht.verschil))} minuut).`);
  return delen;
}

/** Metingen uit een eerdere versie waarbij het aantal uitvoeringen nooit is vastgelegd. */
function metingenZonderAantalUitvoeringen() {
  return staat.procesmetingen.filter((m) => !('aantalUitvoeringen' in m));
}

/** Vult op verzoek van de gebruiker aantal uitvoeringen = 1 in voor metingen uit versie 1.0.x, met herkomst. */
function vulAantalUitvoeringenAan(metingIds) {
  const tijd = nuIso();
  const herkomst = `Aangevuld met 1 na overgang naar versie ${VERSIE} (definitie in versie 1.0: één procesmeting = één uitvoering); bevestigd door gebruiker op ${fmtTijdstip(tijd)}`;
  for (const m of staat.procesmetingen) {
    if (metingIds.includes(m.metingId) && !('aantalUitvoeringen' in m)) {
      m.aantalUitvoeringen = 1;
      m.aantalUitvoeringenHerkomst = herkomst;
      m.gewijzigd = tijd;
    }
  }
}

const ID_PATROON = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

// ---------- Opzoeken ----------

function zoekProces(procesId) {
  return staat.processen.find((p) => p.procesId === procesId) || null;
}

function stappenVanProces(procesId) {
  return staat.processtappen
    .filter((s) => s.procesId === procesId)
    .sort((a, b) => a.volgorde - b.volgorde || vergelijkTekst(a.stapId, b.stapId));
}

function zoekMeting(metingId) {
  return staat.procesmetingen.find((m) => m.metingId === metingId) || null;
}

function stapmetingenVan(metingId) {
  return staat.stapmetingen
    .filter((s) => s.metingId === metingId)
    .sort((a, b) => a.volgorde - b.volgorde || vergelijkTekst(a.stapId, b.stapId));
}

function zoekFrequentie(frequentieId) {
  return staat.frequentiemetingen.find((f) => f.frequentieId === frequentieId) || null;
}

function frequentiesVanProces(procesId) {
  return staat.frequentiemetingen
    .filter((f) => f.procesId === procesId)
    .sort((a, b) => vergelijkTekst(b.frequentieId, a.frequentieId));
}

/** Naam van een proces; valt terug op de naam die bij een meting is vastgelegd. */
function procesNaam(procesId) {
  const p = zoekProces(procesId);
  if (p) return p.naam;
  const m = staat.procesmetingen.find((x) => x.procesId === procesId && x.procesnaam);
  return m ? m.procesnaam : '';
}

function procesLabel(procesId) {
  const p = zoekProces(procesId);
  const naam = procesNaam(procesId);
  return `${procesId}${naam ? ' – ' + naam : ''}${p ? '' : ' (verwijderd proces)'}`;
}

/** Alle ProcesID's die voorkomen in processen of in metingen (ook van verwijderde processen). */
function alleProcesIds() {
  return uniek([
    ...staat.processen.map((p) => p.procesId),
    ...staat.procesmetingen.map((m) => m.procesId),
    ...staat.frequentiemetingen.map((f) => f.procesId),
  ]).sort(vergelijkTekst);
}

function bevatDemo() {
  return ['processen', 'processtappen', 'procesmetingen', 'stapmetingen', 'frequentiemetingen']
    .some((k) => staat[k].some((r) => r.demo));
}

// ---------- Identificatiecodes ----------

function volgnummerUitId(id, prefix) {
  if (!id || !id.startsWith(prefix)) return 0;
  const rest = id.slice(prefix.length);
  return /^\d+$/.test(rest) ? Number(rest) : 0;
}

function volgendeId(soort, procesId) {
  const prefix = soort === 'meting' ? `M-${procesId}-` : `F-${procesId}-`;
  const lijst = soort === 'meting' ? staat.procesmetingen.map((m) => m.metingId) : staat.frequentiemetingen.map((f) => f.frequentieId);
  const hoogsteBestaand = Math.max(0, ...lijst.map((id) => volgnummerUitId(id, prefix)));
  const teller = staat.volgnummers[soort][procesId] || 0;
  const volgende = Math.max(hoogsteBestaand, teller) + 1;
  return { id: prefix + String(volgende).padStart(3, '0'), nummer: volgende };
}

function registreerVolgnummer(soort, procesId, id) {
  const prefix = soort === 'meting' ? `M-${procesId}-` : `F-${procesId}-`;
  const nr = volgnummerUitId(id, prefix);
  if (nr > (staat.volgnummers[soort][procesId] || 0)) staat.volgnummers[soort][procesId] = nr;
}

// ---------- Processen ----------

/**
 * Controleert een proces met stappen. invoer: { procesId, naam, eenheid, stappen: [{stapId, volgorde, naam, bestaand}] }
 * origineelId: het ProcesID bij bewerken, anders null.
 */
function valideerProces(invoer, origineelId) {
  const fouten = [];
  const id = (invoer.procesId || '').trim();
  if (!id) fouten.push('Vul een ProcesID in.');
  else if (!ID_PATROON.test(id)) fouten.push('Een ProcesID mag alleen letters, cijfers, - en _ bevatten (geen spaties), bijvoorbeeld PR24.');
  else if (id !== origineelId && zoekProces(id)) fouten.push(`ProcesID ${id} bestaat al. Kies een andere code.`);
  if (!(invoer.naam || '').trim()) fouten.push('Vul een procesnaam in.');
  const eenheidLabels = {
    uitvoeringseenheid: 'uitvoeringseenheid (enkelvoud), bijvoorbeeld dossier',
    uitvoeringseenheidMeervoud: 'uitvoeringseenheid (meervoud), bijvoorbeeld dossiers',
    omvangseenheid: 'omvangseenheid (enkelvoud), bijvoorbeeld dienstperiode',
    omvangseenheidMeervoud: 'omvangseenheid (meervoud), bijvoorbeeld dienstperioden',
  };
  for (const k of EENHEID_VELDEN) if (!(invoer[k] || '').trim()) fouten.push(`Vul de ${eenheidLabels[k]} in.`);
  const stappen = invoer.stappen || [];
  if (stappen.length === 0) fouten.push('Een proces moet minimaal één processtap hebben.');
  const gezien = new Set();
  const volgordes = new Set();
  stappen.forEach((s, i) => {
    const nr = i + 1;
    const sid = (s.stapId || '').trim();
    if (!sid) fouten.push(`Stap ${nr}: vul een StapID in.`);
    else if (!ID_PATROON.test(sid)) fouten.push(`Stap ${nr}: StapID ${sid} mag alleen letters, cijfers, - en _ bevatten.`);
    else if (gezien.has(sid)) fouten.push(`StapID ${sid} komt meer dan één keer voor.`);
    else {
      const elders = staat.processtappen.find((x) => x.stapId === sid && x.procesId !== origineelId);
      if (elders) fouten.push(`StapID ${sid} wordt al gebruikt bij proces ${elders.procesId}.`);
    }
    gezien.add(sid);
    if (!(s.naam || '').trim()) fouten.push(`Stap ${nr}${sid ? ' (' + sid + ')' : ''}: vul de naam van de processtap in.`);
    const v = leesGetal(s.volgorde);
    if (v.fout || v.leeg || !Number.isInteger(v.waarde) || v.waarde < 1) fouten.push(`Stap ${nr}${sid ? ' (' + sid + ')' : ''}: volgorde moet een geheel getal van 1 of hoger zijn.`);
    else if (volgordes.has(v.waarde)) fouten.push(`Volgorde ${v.waarde} komt meer dan één keer voor.`);
    else volgordes.add(v.waarde);
  });
  return fouten;
}

function bewaarProces(invoer, origineelId) {
  const procesId = invoer.procesId.trim();
  const bestaand = origineelId ? zoekProces(origineelId) : null;
  const proces = {
    procesId,
    naam: invoer.naam.trim(),
    uitvoeringseenheid: invoer.uitvoeringseenheid.trim(),
    uitvoeringseenheidMeervoud: invoer.uitvoeringseenheidMeervoud.trim(),
    omvangseenheid: invoer.omvangseenheid.trim(),
    omvangseenheidMeervoud: invoer.omvangseenheidMeervoud.trim(),
    demo: bestaand ? !!bestaand.demo : false,
    aangemaakt: bestaand ? bestaand.aangemaakt : nuIso(),
    gewijzigd: nuIso(),
  };
  staat.processen = staat.processen.filter((p) => p.procesId !== origineelId);
  staat.processen.push(proces);
  staat.processtappen = staat.processtappen.filter((s) => s.procesId !== origineelId);
  for (const s of invoer.stappen) {
    staat.processtappen.push({
      stapId: s.stapId.trim(),
      procesId,
      volgorde: leesGetal(s.volgorde).waarde,
      naam: s.naam.trim(),
      demo: proces.demo,
    });
  }
  staat.processen.sort((a, b) => vergelijkTekst(a.procesId, b.procesId));
  return proces;
}

/** Verwijdert een proces en de stapdefinities. Metingen blijven bestaan met hun vastgelegde namen. */
function verwijderProces(procesId) {
  staat.processen = staat.processen.filter((p) => p.procesId !== procesId);
  staat.processtappen = staat.processtappen.filter((s) => s.procesId !== procesId);
}

// ---------- Procesmetingen ----------

/**
 * Controleert een procesmeting. Geeft { fouten, waarschuwingen }.
 * Fouten blokkeren het opslaan; waarschuwingen vragen om bevestiging.
 */
function valideerMeting(meting, stapmetingen, origineelId) {
  const fouten = [];
  const waarschuwingen = [];
  if (!meting.metingId) fouten.push('MetingID ontbreekt.');
  else if (meting.metingId !== origineelId && zoekMeting(meting.metingId)) fouten.push(`MetingID ${meting.metingId} bestaat al. Dubbele MetingID's zijn niet toegestaan.`);
  if (!meting.procesId) fouten.push('Kies een proces.');
  if (!meting.datum) fouten.push('Vul een datum in.');
  else if (!isGeldigeDatum(meting.datum)) fouten.push('De datum is ongeldig.');
  if (!CASUSTYPEN.includes(meting.casustype)) fouten.push('Kies een casustype: Normaal of Uitzondering.');
  if (!MEETWIJZEN_METING.includes(meting.meetwijze)) fouten.push('Kies een meetwijze.');
  const e = eenhedenVan(meting);
  if (meting.aantalUitvoeringen === null) fouten.push(`Vul het aantal ${e.uitvoeringseenheidMeervoud} in (aantal uitvoeringen in deze meting).`);
  else if (!(meting.aantalUitvoeringen > 0)) fouten.push(`Het aantal ${e.uitvoeringseenheidMeervoud} moet groter zijn dan nul.`);
  else if (!Number.isInteger(meting.aantalUitvoeringen)) waarschuwingen.push(`Het aantal ${e.uitvoeringseenheidMeervoud} (${fmtAantal(meting.aantalUitvoeringen)}) is geen geheel getal.`);
  if (meting.omvang !== null && !(meting.omvang > 0)) fouten.push(`De omvang (aantal ${e.omvangseenheidMeervoud}) moet groter zijn dan nul, of leeg als die onbekend is.`);
  // Geen blokkade (oudere codes blijven geldig), wel een waarschuwing als de code op een naam lijkt.
  if (meting.medewerkerId && !/^[A-Za-z]{1,4}-?\d{1,4}$/.test(meting.medewerkerId.trim())) {
    waarschuwingen.push(`MedewerkerID "${meting.medewerkerId}" lijkt geen anonieme code. Gebruik een code zoals PZ01 en nooit een echte naam.`);
  }
  if (meting.omvang === null) waarschuwingen.push(`De omvang (aantal ${e.omvangseenheidMeervoud}) is niet ingevuld. Actieve tijd per ${e.omvangseenheid} wordt voor deze meting als Onbekend getoond.`);
  if (!stapmetingen.length) fouten.push('Deze meting bevat geen processtappen.');
  for (const s of stapmetingen) {
    const label = `${s.stapId} (${s.stapnaam})`;
    if (s.actieveTijd !== null && s.actieveTijd < 0) fouten.push(`${label}: actieve tijd mag niet negatief zijn.`);
    if (s.wachttijd !== null && s.wachttijd < 0) fouten.push(`${label}: wachttijd mag niet negatief zijn.`);
    if (s.wachttijd > 0 && !(s.redenWachttijd || '').trim()) fouten.push(`${label}: er is wachttijd ingevuld. Geef ook de reden van de wachttijd op.`);
  }
  for (const [veld, label] of [['actieveTijdTotaal', 'Totale actieve tijd volgens procesmeting'], ['wachttijdTotaal', 'Totale wachttijd volgens procesmeting']]) {
    if (isGetal(meting[veld]) && meting[veld] < 0) fouten.push(`${label} mag niet negatief zijn.`);
  }
  waarschuwingen.push(...controleTekst(controleProcesStap(meting, stapmetingen)));
  const zonderActief = stapmetingen.filter((s) => s.actieveTijd === null).map((s) => s.stapId);
  const zonderWacht = stapmetingen.filter((s) => s.wachttijd === null).map((s) => s.stapId);
  if (zonderActief.length) waarschuwingen.push(`Actieve tijd is niet ingevuld bij: ${zonderActief.join(', ')}. Deze waarden blijven Onbekend en worden niet als nul geteld; de totale actieve tijd van deze meting wordt daardoor Onbekend.`);
  if (zonderWacht.length) waarschuwingen.push(`Wachttijd is niet ingevuld bij: ${zonderWacht.join(', ')}. Vul 0 in als er geen wachttijd was; lege velden blijven Onbekend.`);
  return { fouten, waarschuwingen };
}

function bewaarMeting(meting, stapmetingen, origineelId) {
  const bestaand = origineelId ? zoekMeting(origineelId) : null;
  // Herkomst van het aantal uitvoeringen blijft alleen behouden als de waarde ongewijzigd is.
  const herkomst = bestaand && bestaand.aantalUitvoeringen === meting.aantalUitvoeringen && bestaand.aantalUitvoeringenHerkomst
    ? bestaand.aantalUitvoeringenHerkomst : 'Ingevoerd';
  const record = {
    ...meting,
    aantalUitvoeringenHerkomst: herkomst,
    demo: bestaand ? !!bestaand.demo : false,
    aangemaakt: bestaand ? bestaand.aangemaakt : nuIso(),
    gewijzigd: bestaand ? nuIso() : null,
  };
  staat.procesmetingen = staat.procesmetingen.filter((m) => m.metingId !== origineelId);
  staat.stapmetingen = staat.stapmetingen.filter((s) => s.metingId !== origineelId);
  staat.procesmetingen.push(record);
  for (const s of stapmetingen) staat.stapmetingen.push({ ...s, metingId: record.metingId, demo: record.demo });
  registreerVolgnummer('meting', record.procesId, record.metingId);
  return record;
}

function verwijderMeting(metingId) {
  staat.procesmetingen = staat.procesmetingen.filter((m) => m.metingId !== metingId);
  staat.stapmetingen = staat.stapmetingen.filter((s) => s.metingId !== metingId);
}

// ---------- Frequentiemetingen ----------

function valideerFrequentie(f, origineelId) {
  const fouten = [];
  if (!f.frequentieId) fouten.push('FrequentieID ontbreekt.');
  else if (f.frequentieId !== origineelId && zoekFrequentie(f.frequentieId)) fouten.push(`FrequentieID ${f.frequentieId} bestaat al.`);
  if (!f.procesId) fouten.push('Kies een proces.');
  if (!(f.meetperiode || '').trim()) fouten.push('Vul de meetperiode in, bijvoorbeeld "maart 2026".');
  if (!MEETWIJZEN_FREQUENTIE.includes(f.meetwijze)) fouten.push('Kies een meetwijze.');
  if (f.aantalUitvoeringen === null && f.totaalVolume === null) fouten.push('Vul het aantal uitvoeringen en/of het totale volume in.');
  if (f.aantalUitvoeringen !== null && f.aantalUitvoeringen < 0) fouten.push('Aantal uitvoeringen mag niet negatief zijn.');
  if (f.totaalVolume !== null && f.totaalVolume < 0) fouten.push('Totaal volume mag niet negatief zijn.');
  if (f.periodeEenheid && !PERIODE_EENHEDEN.includes(f.periodeEenheid)) fouten.push('Kies een geldige periode (dag, week, maand, kwartaal of jaar).');
  if (f.bereik && !BEREIKEN.includes(f.bereik)) fouten.push('Kies een geldig bereik.');
  if (f.meetellenInTotaal === true) {
    // Een frequentie die in het totaal meetelt, moet vergelijkbaar en optelbaar zijn.
    if (!f.periodeEenheid) fouten.push('Meetellen in totaal: kies de periode waarop de frequentie betrekking heeft (bijv. per week).');
    if (!f.bereik) fouten.push('Meetellen in totaal: kies het bereik van de frequentie (eigen werkzaamheden, team, gehele afdeling of anders).');
    if (f.aantalUitvoeringen === null) fouten.push('Meetellen in totaal: vul het aantal uitvoeringen in.');
    if (f.bereik === 'Eigen werkzaamheden' && !f.medewerkerId) fouten.push('Meetellen in totaal met bereik "Eigen werkzaamheden": vul de MedewerkerID in, zodat dubbele tellingen herkend kunnen worden.');
  }
  return fouten;
}

function bewaarFrequentie(f, origineelId) {
  const bestaand = origineelId ? zoekFrequentie(origineelId) : null;
  const record = {
    ...f,
    demo: bestaand ? !!bestaand.demo : false,
    aangemaakt: bestaand ? bestaand.aangemaakt : nuIso(),
    gewijzigd: bestaand ? nuIso() : null,
  };
  staat.frequentiemetingen = staat.frequentiemetingen.filter((x) => x.frequentieId !== origineelId);
  staat.frequentiemetingen.push(record);
  registreerVolgnummer('frequentie', record.procesId, record.frequentieId);
  return record;
}

function verwijderFrequentie(frequentieId) {
  staat.frequentiemetingen = staat.frequentiemetingen.filter((f) => f.frequentieId !== frequentieId);
}

function verwijderDemogegevens() {
  for (const k of ['processen', 'processtappen', 'procesmetingen', 'stapmetingen', 'frequentiemetingen']) {
    staat[k] = staat[k].filter((r) => !r.demo);
  }
  for (const soort of ['meting', 'frequentie']) {
    for (const pid of Object.keys(staat.volgnummers[soort])) {
      if (pid.startsWith('DEMO-')) delete staat.volgnummers[soort][pid];
    }
  }
}
