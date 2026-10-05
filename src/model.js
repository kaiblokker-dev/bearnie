// ---------- Datamodel ----------
//
// De staat bestaat uitsluitend uit ruwe invoer en automatisch vastgelegde
// identificatievelden. Berekende waarden worden nooit opgeslagen; ze worden
// telkens opnieuw afgeleid in berekeningen.js.
//
// processen:          { procesId, naam, eenheid, demo, aangemaakt, gewijzigd }
// processtappen:      { stapId, procesId, volgorde, naam, demo }
// procesmetingen:     { metingId, datum, procesId, procesnaam, medewerkerId, casustype,
//                       omvang, eenheid, meetwijze, toelichting, demo, aangemaakt, gewijzigd }
// stapmetingen:       { metingId, stapId, volgorde, stapnaam, actieveTijd, wachttijd,
//                       redenWachttijd, opmerking, tijdvastlegging, demo }
// frequentiemetingen: { frequentieId, procesId, meetperiode, aantalUitvoeringen, totaalVolume,
//                       eenheid, meetwijze, bron, demo, aangemaakt, gewijzigd }
//
// procesnaam (bij meting) en stapnaam (bij stapmeting) zijn een kopie op het moment van
// meten, zodat metingen leesbaar blijven als een proces later wordt gewijzigd of verwijderd.
// Ontbrekende getallen worden als null opgeslagen, nooit als 0.

let staat = legeStaat();

function legeStaat() {
  return {
    schemaversie: 1,
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
  if (s.volgnummers && typeof s.volgnummers === 'object') {
    n.volgnummers.meting = { ...(s.volgnummers.meting || {}) };
    n.volgnummers.frequentie = { ...(s.volgnummers.frequentie || {}) };
  }
  return n;
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
  if (!(invoer.eenheid || '').trim()) fouten.push('Vul een eenheid in, bijvoorbeeld documenten of dossiers.');
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
    eenheid: invoer.eenheid.trim(),
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
  if (meting.omvang !== null && !(meting.omvang > 0)) fouten.push('Omvang moet groter zijn dan nul (of leeg als die onbekend is).');
  if (meting.medewerkerId && /\s/.test(meting.medewerkerId.trim())) waarschuwingen.push('MedewerkerID bevat een spatie. Gebruik bij voorkeur een korte anonieme code zoals M01, geen naam.');
  if (meting.omvang === null) waarschuwingen.push('Omvang is niet ingevuld. Tijd per eenheid wordt voor deze meting als Onbekend getoond.');
  if (!stapmetingen.length) fouten.push('Deze meting bevat geen processtappen.');
  for (const s of stapmetingen) {
    const label = `${s.stapId} (${s.stapnaam})`;
    if (s.actieveTijd !== null && s.actieveTijd < 0) fouten.push(`${label}: actieve tijd mag niet negatief zijn.`);
    if (s.wachttijd !== null && s.wachttijd < 0) fouten.push(`${label}: wachttijd mag niet negatief zijn.`);
    if (s.wachttijd > 0 && !(s.redenWachttijd || '').trim()) fouten.push(`${label}: er is wachttijd ingevuld. Geef ook de reden van de wachttijd op.`);
  }
  const zonderActief = stapmetingen.filter((s) => s.actieveTijd === null).map((s) => s.stapId);
  const zonderWacht = stapmetingen.filter((s) => s.wachttijd === null).map((s) => s.stapId);
  if (zonderActief.length) waarschuwingen.push(`Actieve tijd is niet ingevuld bij: ${zonderActief.join(', ')}. Deze waarden blijven Onbekend en worden niet als nul geteld; de totale actieve tijd van deze meting wordt daardoor Onbekend.`);
  if (zonderWacht.length) waarschuwingen.push(`Wachttijd is niet ingevuld bij: ${zonderWacht.join(', ')}. Vul 0 in als er geen wachttijd was; lege velden blijven Onbekend.`);
  return { fouten, waarschuwingen };
}

function bewaarMeting(meting, stapmetingen, origineelId) {
  const bestaand = origineelId ? zoekMeting(origineelId) : null;
  const record = {
    ...meting,
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
