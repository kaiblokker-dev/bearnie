// ---------- Berekeningen ----------
//
// Alle berekeningen werken rechtstreeks op de ruwe invoer en worden nooit opgeslagen.
// Intern wordt met volledige precisie gerekend; alleen de weergave wordt afgerond.
// Ontbrekende waarden worden nooit als nul behandeld: een berekening waarvoor een
// waarde ontbreekt, levert null op ('Onbekend') en de reden wordt vastgelegd.

// Waarde van het medewerkerfilter voor metingen zonder MedewerkerID.
const MEDEWERKER_LEEG = '__leeg__';

/**
 * Filtert procesmetingen.
 * filters: { procesId, meetwijze ('alle' | groepcode), van, tot, medewerker ('' = alle | MEDEWERKER_LEEG | MedewerkerID),
 *            metTest (true = test/fictieve metingen meenemen; standaard uitgesloten) }
 */
function metingVoldoetAanFilters(m, filters) {
  if (filters.procesId && m.procesId !== filters.procesId) return false;
  if (isTestmeting(m) && !filters.metTest) return false;
  if (filters.medewerker === MEDEWERKER_LEEG && m.medewerkerId) return false;
  if (filters.medewerker && filters.medewerker !== MEDEWERKER_LEEG && m.medewerkerId !== filters.medewerker) return false;
  if (filters.meetwijze && filters.meetwijze !== 'alle') {
    const groep = MEETWIJZE_GROEPEN.find((g) => g.code === filters.meetwijze);
    if (!groep || m.meetwijze !== groep.meting) return false;
  }
  if (filters.van && (!m.datum || m.datum < filters.van)) return false;
  if (filters.tot && (!m.datum || m.datum > filters.tot)) return false;
  return true;
}

/** Berekende waarden voor één procesmeting. */
function berekenMeting(m) {
  const stappen = stapmetingenVan(m.metingId);
  const ontbrekendActief = stappen.filter((s) => !isGetal(s.actieveTijd)).map((s) => s.stapId);
  const ontbrekendWacht = stappen.filter((s) => !isGetal(s.wachttijd)).map((s) => s.stapId);
  // Zonder stapmetingen (geen detailmeting, versie 1.7) komt de tijd uit de totalen van de procesmeting.
  // Er wordt dan nooit een tijd per processtap afgeleid.
  const zonderDetail = !stappen.length;
  const totaalActief = zonderDetail ? (isGetal(m.actieveTijdTotaal) ? m.actieveTijdTotaal : null)
    : !ontbrekendActief.length ? som(stappen.map((s) => s.actieveTijd)) : null;
  const totaalWacht = zonderDetail ? (isGetal(m.wachttijdTotaal) ? m.wachttijdTotaal : null)
    : !ontbrekendWacht.length ? som(stappen.map((s) => s.wachttijd)) : null;
  const aantalBekend = isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen > 0;
  const omvangBekend = isGetal(m.omvang) && m.omvang > 0;
  const deel = (teller, noemerBekend, noemer) => (isGetal(teller) && noemerBekend ? teller / noemer : null);
  return {
    aantalStappen: stappen.length,
    bronTijd: zonderDetail ? 'Totaal procesmeting (geen detailmeting per stap)' : 'Som van de stapmetingen',
    totaalActief,
    totaalWacht,
    // Primair: per uitvoeringseenheid (bijv. per dossier)
    actiefPerUitvoering: deel(totaalActief, aantalBekend, m.aantalUitvoeringen),
    wachtPerUitvoering: deel(totaalWacht, aantalBekend, m.aantalUitvoeringen),
    // Aanvullend: per omvangseenheid (bijv. per dienstperiode)
    actiefPerOmvang: deel(totaalActief, omvangBekend, m.omvang),
    wachtPerOmvang: deel(totaalWacht, omvangBekend, m.omvang),
    // Omvang per uitvoering (bijv. dienstperioden per dossier)
    omvangPerUitvoering: deel(omvangBekend ? m.omvang : null, aantalBekend, m.aantalUitvoeringen),
    ontbrekendActief,
    ontbrekendWacht,
    aantalBekend,
    aantalNietVastgelegd: !('aantalUitvoeringen' in m),
    omvangBekend,
  };
}

function redenOntbrekend(m, b, soort) {
  const e = eenhedenVan(m);
  const tijd = soort.startsWith('actief') ? 'actief' : 'wacht';
  if (!b.aantalStappen) {
    if (tijd === 'actief' && !isGetal(b.totaalActief)) return 'geen detailmeting per stap en geen totale actieve tijd ingevuld';
    if (tijd === 'wacht' && !isGetal(b.totaalWacht)) return 'geen detailmeting per stap en geen totale wachttijd ingevuld';
  }
  if (tijd === 'actief' && b.ontbrekendActief.length) return `actieve tijd ontbreekt bij ${b.ontbrekendActief.join(', ')}`;
  if (tijd === 'wacht' && b.ontbrekendWacht.length) return `wachttijd ontbreekt bij ${b.ontbrekendWacht.join(', ')}`;
  if (soort.endsWith('PerUitvoering') && !b.aantalBekend) {
    return b.aantalNietVastgelegd
      ? `aantal ${e.uitvoeringseenheidMeervoud} niet vastgelegd (meting uit versie 1.0)`
      : `aantal ${e.uitvoeringseenheidMeervoud} ontbreekt`;
  }
  if (soort.endsWith('PerOmvang') && !b.omvangBekend) return `omvang (aantal ${e.omvangseenheidMeervoud}) ontbreekt`;
  return 'onbekend';
}

const SAMENVATTING_SLEUTELS = ['actiefPerUitvoering', 'wachtPerUitvoering', 'actiefPerOmvang', 'wachtPerOmvang'];

/** Samenvatting van één groep procesmetingen (één casustype). */
function vatGroepSamen(metingen) {
  const rijen = metingen.map((m) => ({ m, b: berekenMeting(m) }));
  const meetwijzen = {};
  for (const m of metingen) meetwijzen[m.meetwijze] = (meetwijzen[m.meetwijze] || 0) + 1;
  const groep = {
    aantal: metingen.length,
    metingIds: metingen.map((m) => m.metingId),
    meetwijzen,
    aantalUitvoeringen: som(metingen.filter((m) => isGetal(m.aantalUitvoeringen)).map((m) => m.aantalUitvoeringen)),
    metingenZonderAantal: metingen.filter((m) => !isGetal(m.aantalUitvoeringen)).map((m) => m.metingId),
    uitgesloten: {},
    eenheden: {
      uitvoering: uniek(metingen.map((m) => eenhedenVan(m).uitvoeringseenheid)),
      omvang: uniek(metingen.map((m) => eenhedenVan(m).omvangseenheid)),
    },
  };
  for (const k of SAMENVATTING_SLEUTELS) {
    groep[k] = beschrijf(rijen.map(({ m, b }) => ({ metingId: m.metingId, waarde: b[k] })));
    groep.uitgesloten[k] = rijen.filter(({ b }) => !isGetal(b[k])).map(({ m, b }) => ({ metingId: m.metingId, reden: redenOntbrekend(m, b, k) }));
  }
  return groep;
}

/** Samenvatting per proces, afzonderlijk voor Normaal en Uitzondering. */
function procesSamenvatting(procesId, filters) {
  const metingen = staat.procesmetingen
    .filter((m) => metingVoldoetAanFilters(m, { ...filters, procesId }))
    .sort((a, b) => vergelijkTekst(a.metingId, b.metingId));
  const perCasustype = {};
  for (const c of CASUSTYPEN) perCasustype[c] = vatGroepSamen(metingen.filter((m) => m.casustype === c));
  const meetwijzen = {};
  for (const m of metingen) meetwijzen[m.meetwijze] = (meetwijzen[m.meetwijze] || 0) + 1;
  return { procesId, aantal: metingen.length, metingen, perCasustype, meetwijzen };
}

/**
 * Resultaten per processtap voor één casustype, uitgedrukt per uitvoering:
 * stapwaarde / aantal uitvoeringen van de meting. Zonder bekend aantal uitvoeringen: Onbekend.
 */
function stapSamenvatting(procesId, filters, casustype) {
  const metingen = staat.procesmetingen.filter((m) => metingVoldoetAanFilters(m, { ...filters, procesId }) && m.casustype === casustype);
  const metingPerId = new Map(metingen.map((m) => [m.metingId, m]));
  const stapmetingen = staat.stapmetingen.filter((s) => metingPerId.has(s.metingId));
  // Volgorde: eerst de huidige stappen van het proces, daarna stappen die alleen in metingen voorkomen.
  const huidige = stappenVanProces(procesId);
  const volgorde = [...huidige.map((s) => s.stapId)];
  const extra = uniek(stapmetingen.map((s) => s.stapId)).filter((id) => !volgorde.includes(id));
  extra.sort((a, b) => {
    const va = stapmetingen.find((s) => s.stapId === a).volgorde;
    const vb = stapmetingen.find((s) => s.stapId === b).volgorde;
    return va - vb || vergelijkTekst(a, b);
  });
  const perUitvoering = (s, veld) => {
    const m = metingPerId.get(s.metingId);
    return isGetal(s[veld]) && isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen > 0 ? s[veld] / m.aantalUitvoeringen : null;
  };
  return [...volgorde, ...extra].map((stapId) => {
    const huidig = huidige.find((s) => s.stapId === stapId);
    const waarnemingen = stapmetingen.filter((s) => s.stapId === stapId);
    const actief = beschrijf(waarnemingen.map((s) => ({ metingId: s.metingId, waarde: perUitvoering(s, 'actieveTijd') })));
    const wacht = beschrijf(waarnemingen.map((s) => ({ metingId: s.metingId, waarde: perUitvoering(s, 'wachttijd') })));
    // Percentage met wachttijd: op basis van de ruwe stapwaarde (ook zonder bekend aantal uitvoeringen).
    const bekendeWacht = waarnemingen.filter((s) => isGetal(s.wachttijd));
    const metWacht = bekendeWacht.filter((s) => s.wachttijd > 0).length;
    return {
      stapId,
      naam: huidig ? huidig.naam : (waarnemingen[0] ? waarnemingen[0].stapnaam : ''),
      bestaatNog: !!huidig,
      aantalWaarnemingen: waarnemingen.length,
      actief,
      wacht,
      aantalMetWacht: metWacht,
      aantalBekendeWacht: bekendeWacht.length,
      percentageMetWacht: bekendeWacht.length ? (metWacht / bekendeWacht.length) * 100 : null,
      metingIds: waarnemingen.map((s) => s.metingId),
    };
  });
}

/**
 * Geschatte actieve tijd per meetperiode = aantal uitvoeringen in de meetperiode
 * × mediaan actieve tijd per uitvoering (normale gevallen). Het totale volume
 * (omvang) in de meetperiode wordt hierbij niet gebruikt en mag onbekend zijn.
 * Berekent niets als invoer ontbreekt.
 */
function berekenTijdsbelasting(frequentie, groepNormaal, procesId) {
  const e = eenhedenVan(frequentie, procesId);
  const ontbreekt = [];
  if (!frequentie) ontbreekt.push('Er is voor dit proces geen frequentiemeting geregistreerd (tabblad Frequentie registreren).');
  else if (!isGetal(frequentie.aantalUitvoeringen)) ontbreekt.push(`In frequentiemeting ${frequentie.frequentieId} is het aantal ${e.uitvoeringseenheidMeervoud} (aantal uitvoeringen) niet ingevuld.`);
  if (!groepNormaal || !isGetal(groepNormaal.actiefPerUitvoering.mediaan)) {
    ontbreekt.push(`Er is (binnen de gekozen filters) geen normale procesmeting met een volledig ingevulde actieve tijd én een bekend aantal ${e.uitvoeringseenheidMeervoud}, dus er is geen mediaan actieve tijd per ${e.uitvoeringseenheid}.`);
  }
  if (ontbreekt.length) return { waarde: null, ontbreekt, frequentie };
  return {
    waarde: frequentie.aantalUitvoeringen * groepNormaal.actiefPerUitvoering.mediaan,
    aantalUitvoeringen: frequentie.aantalUitvoeringen,
    mediaan: groepNormaal.actiefPerUitvoering.mediaan,
    metingIds: groepNormaal.actiefPerUitvoering.metingIds,
    n: groepNormaal.actiefPerUitvoering.n,
    frequentie,
    ontbreekt: [],
  };
}

/**
 * Resultaten per medewerker voor één proces en casustype. Iedere waarde wordt per
 * individuele procesmeting berekend; gemiddelden, minimum en maximum (ook de
 * gecombineerde rij voor alle medewerkers) volgen rechtstreeks uit die metingen,
 * niet uit de gemiddelden per medewerker. Het medewerkerfilter wordt hier genegeerd.
 */
function medewerkerSamenvatting(procesId, filters, casustype) {
  const metingen = staat.procesmetingen
    .filter((m) => metingVoldoetAanFilters(m, { ...filters, procesId, medewerker: '' }) && m.casustype === casustype)
    .sort((a, b) => vergelijkTekst(a.metingId, b.metingId));
  const vat = (lijst) => {
    const rijen = lijst.map((m) => ({ m, b: berekenMeting(m) }));
    const reeks = (k) => beschrijf(rijen.map(({ m, b }) => ({ metingId: m.metingId, waarde: b[k] })));
    return {
      aantal: lijst.length,
      metingIds: lijst.map((m) => m.metingId),
      actief: reeks('actiefPerUitvoering'),
      wacht: reeks('wachtPerUitvoering'),
      omvang: reeks('omvangPerUitvoering'),
    };
  };
  const ids = uniek(metingen.map((m) => m.medewerkerId || '')).sort((a, b) => (a === '') - (b === '') || vergelijkTekst(a, b));
  return {
    perMedewerker: ids.map((id) => ({ medewerkerId: id, ...vat(metingen.filter((m) => (m.medewerkerId || '') === id)) })),
    totaal: vat(metingen),
  };
}

/** Alle MedewerkerID's die bij een proces voorkomen (zonder lege). */
function medewerkersVanProces(procesId) {
  return uniek(staat.procesmetingen.filter((m) => m.procesId === procesId && m.medewerkerId).map((m) => m.medewerkerId)).sort(vergelijkTekst);
}

function medewerkerLabel(id) {
  return id ? id : '(niet ingevuld)';
}

/**
 * Analyse van diensttijdblokken voor een set procesmetingen (al gefilterd op proces, medewerker,
 * casustype, datum en teststatus). Alle verhoudingen zijn totaal ÷ totaal, zodat metingen met een
 * grotere omvang zwaarder wegen. Per kengetal tellen alleen metingen mee waarvoor alle benodigde
 * waarden bekend zijn; metingen zonder aantal blokken vallen alleen buiten de berekeningen per blok.
 */
function blokkenAnalyse(metingen) {
  const rijen = metingen.map((m) => ({ m, b: berekenMeting(m) }));
  const aantalOk = (m) => isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen > 0;
  const deling = (lijst, teller, noemer) => {
    const t = som(lijst.map(teller));
    const n = som(lijst.map(noemer));
    return { waarde: lijst.length && n > 0 ? t / n : null, teller: lijst.length ? t : null, noemer: lijst.length ? n : null, n: lijst.length, metingIds: lijst.map((x) => x.m.metingId) };
  };
  const metBlokken = rijen.filter(({ m }) => isGetal(m.aantalBlokken));
  return {
    aantalMetingen: metingen.length,
    metingIds: metingen.map((m) => m.metingId),
    metingenMetBlokken: metBlokken.map(({ m }) => m.metingId),
    metingenZonderBlokken: rijen.filter(({ m }) => !isGetal(m.aantalBlokken)).map(({ m }) => m.metingId),
    totaalDossiers: som(rijen.filter(({ m }) => aantalOk(m)).map(({ m }) => m.aantalUitvoeringen)),
    totaalOmvang: som(rijen.filter(({ m }) => isGetal(m.omvang)).map(({ m }) => m.omvang)),
    totaalBlokken: metBlokken.length ? som(metBlokken.map(({ m }) => m.aantalBlokken)) : null,
    // 1. dienstperioden per dossier = Σ omvang ÷ Σ dossiers
    omvangPerDossier: deling(rijen.filter(({ m }) => aantalOk(m) && isGetal(m.omvang)), ({ m }) => m.omvang, ({ m }) => m.aantalUitvoeringen),
    // 2. diensttijdblokken per dossier = Σ blokken ÷ Σ dossiers
    blokkenPerDossier: deling(metBlokken.filter(({ m }) => aantalOk(m)), ({ m }) => m.aantalBlokken, ({ m }) => m.aantalUitvoeringen),
    // 3. actieve tijd per diensttijdblok = Σ actieve tijd ÷ Σ blokken
    actiefPerBlok: deling(metBlokken.filter(({ b }) => isGetal(b.totaalActief)), ({ b }) => b.totaalActief, ({ m }) => m.aantalBlokken),
    // 5. verhouding invoer/uitvoer = Σ blokken ÷ Σ dienstperioden
    verhouding: deling(metBlokken.filter(({ m }) => isGetal(m.omvang)), ({ m }) => m.aantalBlokken, ({ m }) => m.omvang),
    meetwijzen: metingen.reduce((v, m) => { v[m.meetwijze] = (v[m.meetwijze] || 0) + 1; return v; }, {}),
  };
}

/** Periode-eenheden waarvoor bij een proces frequentiemetingen zijn aangevinkt voor het totaal. */
function totaalPeriodenVanProces(procesId) {
  const aanwezig = frequentiesVanProces(procesId).filter((f) => f.meetellenInTotaal === true && f.periodeEenheid).map((f) => f.periodeEenheid);
  return PERIODE_EENHEDEN.filter((p) => aanwezig.includes(p));
}

/**
 * Totale frequentie en geschatte actieve tijdsbelasting voor één proces en één periode-eenheid.
 *
 * Totale frequentie = som van het aantal uitvoeringen van de frequentiemetingen die
 *   - bij dit proces horen,
 *   - door de gebruiker zijn aangevinkt voor 'Meetellen in totaal',
 *   - dezelfde periode-eenheid hebben (bijv. per week),
 *   - en niet (mogelijk) overlappen.
 * Bij mogelijke overlap of ontbrekende waarden wordt het totaal NIET berekend.
 *
 * Geschatte actieve tijd (min) = totale frequentie × gemiddelde actieve tijd per uitvoering
 * (normale gevallen, binnen de filters inclusief het medewerkerfilter). Wachttijd telt niet mee.
 */
function berekenTotaalOverzicht(procesId, filters, periodeEenheid, weekSleutel) {
  const e = eenhedenVan(null, procesId);
  const alle = frequentiesVanProces(procesId).slice().sort((a, b) => vergelijkTekst(a.frequentieId, b.frequentieId));
  // Uitgesloten vóór de selectie: testmetingen (tenzij meegenomen) en, bij een gekozen kalenderweek, andere weken.
  const binnenFilters = (f) => (!isTestmeting(f) || filters.metTest) && (!weekSleutel || kalenderweekSleutel(f.meetdatum) === weekSleutel);
  const aangevinkt = alle.filter((f) => f.meetellenInTotaal === true && binnenFilters(f));
  const geselecteerd = aangevinkt.filter((f) => f.periodeEenheid === periodeEenheid);
  const frequentieBlokkades = [];
  const tijdBlokkades = [];
  const waarschuwingen = [];

  // Status per frequentiemeting, voor de herleidbaarheid.
  const status = alle.map((f) => {
    let reden = '';
    if (isTestmeting(f) && !filters.metTest) reden = 'test/fictieve meting (uitgesloten)';
    else if (weekSleutel && !f.meetdatum) reden = 'geen meetdatum, dus kalenderweek onbekend';
    else if (weekSleutel && kalenderweekSleutel(f.meetdatum) !== weekSleutel) reden = `andere kalenderweek (${kalenderweekTekst(f.meetdatum, true)})`;
    else if (f.meetellenInTotaal !== true) reden = typeof f.meetellenInTotaal === 'boolean' ? 'Meetellen in totaal staat uit' : 'Meetellen in totaal nog niet bepaald';
    else if (!f.periodeEenheid) reden = 'periode niet bepaald';
    else if (f.periodeEenheid !== periodeEenheid) reden = `andere periode (per ${f.periodeEenheid.toLowerCase()})`;
    return { frequentie: f, geselecteerd: !reden, reden };
  });

  if (!periodeEenheid) frequentieBlokkades.push('Er is geen periode gekozen. Vink bij een frequentiemeting "Meetellen in totaal" aan en kies een periode (bijv. per week).');
  else if (!geselecteerd.length) frequentieBlokkades.push(`Er is voor dit proces geen frequentiemeting per ${periodeEenheid.toLowerCase()} met "Meetellen in totaal" aangevinkt.`);

  const anderePeriode = aangevinkt.filter((f) => f.periodeEenheid && f.periodeEenheid !== periodeEenheid);
  if (anderePeriode.length) {
    waarschuwingen.push(`Niet meegeteld omdat de periode verschilt (perioden worden niet omgerekend): ${anderePeriode.map((f) => `${f.frequentieId} (per ${f.periodeEenheid.toLowerCase()})`).join(', ')}.`);
  }
  const nietBepaald = alle.filter((f) => typeof f.meetellenInTotaal !== 'boolean');
  if (nietBepaald.length) {
    waarschuwingen.push(`Bij ${nietBepaald.length} frequentiemeting(en) is "Meetellen in totaal" nog niet bepaald; deze tellen niet mee: ${nietBepaald.map((f) => f.frequentieId).join(', ')}.`);
  }

  const zonderAantal = geselecteerd.filter((f) => !isGetal(f.aantalUitvoeringen));
  if (zonderAantal.length) frequentieBlokkades.push(`Het aantal ${e.uitvoeringseenheidMeervoud} ontbreekt bij: ${zonderAantal.map((f) => f.frequentieId).join(', ')}. Het totaal wordt niet berekend (ontbrekende waarden tellen niet als nul).`);

  // Mogelijke overlap (dubbele telling) bij twee of meer geselecteerde frequenties.
  if (geselecteerd.length >= 2) {
    const lijst = geselecteerd.map((f) => `${f.frequentieId} (${f.bereik || 'bereik onbekend'}${f.medewerkerId ? ', ' + f.medewerkerId : ''})`).join('; ');
    const afdeling = geselecteerd.filter((f) => f.bereik === 'Gehele afdeling');
    const nietEigen = geselecteerd.filter((f) => f.bereik !== 'Eigen werkzaamheden');
    const ids = geselecteerd.map((f) => f.medewerkerId || '');
    const dubbeleIds = uniek(ids.filter((id, i) => id && ids.indexOf(id) !== i));
    if (afdeling.length) {
      frequentieBlokkades.push(`Mogelijke overlap: ${afdeling.map((f) => f.frequentieId).join(', ')} ${afdeling.length > 1 ? 'zijn schattingen' : 'is een schatting'} voor de gehele afdeling en ${afdeling.length > 1 ? 'mogen' : 'mag'} niet worden opgeteld bij andere frequenties. Controleer de selectie: laat voor de afdeling maar één frequentie meetellen. Geselecteerd: ${lijst}.`);
    } else if (nietEigen.length) {
      frequentieBlokkades.push(`Mogelijke overlap: de bereiken van de geselecteerde frequenties kunnen elkaar overlappen (${nietEigen.map((f) => `${f.frequentieId}: ${f.bereik || 'bereik onbekend'}`).join('; ')}). Alleen frequenties voor eigen werkzaamheden van verschillende medewerkers worden automatisch opgeteld. Controleer de selectie. Geselecteerd: ${lijst}.`);
    } else if (dubbeleIds.length) {
      frequentieBlokkades.push(`Mogelijke dubbele telling: meer dan één frequentie voor de eigen werkzaamheden van ${dubbeleIds.join(', ')}. Controleer de selectie. Geselecteerd: ${lijst}.`);
    } else if (ids.some((id) => !id)) {
      frequentieBlokkades.push(`Mogelijke dubbele telling: bij een of meer frequenties voor eigen werkzaamheden ontbreekt de MedewerkerID, zodat overlap niet is uit te sluiten. Geselecteerd: ${lijst}.`);
    }
  }
  const meetperioden = uniek(geselecteerd.map((f) => (f.meetperiode || '').trim()).filter(Boolean));
  const kalenderweken = uniek(geselecteerd.map((f) => kalenderweekSleutel(f.meetdatum)).filter(Boolean)).sort();
  if (kalenderweken.length > 1) {
    waarschuwingen.push(`De geselecteerde frequenties komen uit verschillende kalenderweken (${kalenderweken.map(kalenderweekSleutelTekst).join(', ')}). Kies zo nodig één kalenderweek, zodat dezelfde medewerker niet voor meerdere weken wordt opgeteld.`);
  } else if (!kalenderweken.length && meetperioden.length > 1) {
    waarschuwingen.push(`De geselecteerde frequenties noemen verschillende meetperioden (${meetperioden.join(', ')}). Controleer of het om hetzelfde soort tijdvak gaat en of samen optellen klopt.`);
  }
  const eenheidMelding = eenheidWaarschuwing(procesId);
  if (eenheidMelding) waarschuwingen.push(eenheidMelding);
  const testInTotaal = geselecteerd.filter(isTestmeting);
  if (testInTotaal.length) waarschuwingen.push(`Testmetingen zijn meegenomen in de totale frequentie: ${testInTotaal.map((f) => f.frequentieId).join(', ')}.`);
  const andereEenheid = geselecteerd.filter((f) => !isOntbrekendeEenheid(f.uitvoeringseenheid) && f.uitvoeringseenheid !== e.uitvoeringseenheid);
  if (andereEenheid.length) {
    waarschuwingen.push(`Let op: ${andereEenheid.map((f) => `${f.frequentieId} (${f.uitvoeringseenheid})`).join(', ')} gebruikt een andere uitvoeringseenheid dan het proces (${e.uitvoeringseenheid}).`);
  }
  const schattingen = geselecteerd.filter((f) => f.meetwijze === 'Geschat door medewerker');
  if (schattingen.length) waarschuwingen.push(`De totale frequentie bevat schattingen door medewerkers: ${schattingen.map((f) => f.frequentieId).join(', ')}.`);

  // Gemiddelde actieve tijd per uitvoering uit de individuele (normale) procesmetingen.
  const sam = procesSamenvatting(procesId, filters);
  const groep = sam.perCasustype.Normaal;
  const actief = groep.actiefPerUitvoering;
  if (!actief.n) tijdBlokkades.push(`Er is (binnen de filters) geen normale procesmeting met een bekende actieve tijd per ${e.uitvoeringseenheid}.`);
  if (actief.n && actief.n < 3) waarschuwingen.push('Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig.');
  const gebruikteMetingen = actief.metingIds.map((id) => zoekMeting(id)).filter(Boolean);

  const totaleFrequentie = frequentieBlokkades.length ? null : som(geselecteerd.map((f) => f.aantalUitvoeringen));
  const gemiddeldeActief = actief.n ? actief.gemiddelde : null;
  // De tijdsbelasting blijft frequentie × actieve tijd per dossier; de blokken zitten al in die tijd (geen dubbele telling).
  const minuten = isGetal(totaleFrequentie) && isGetal(gemiddeldeActief) ? totaleFrequentie * gemiddeldeActief : null;
  const blokken = blokkenAnalyse(sam.metingen.filter((m) => m.casustype === 'Normaal'));
  // 4. geschat aantal diensttijdblokken per periode = blokken per dossier × totale frequentie (informatief)
  const blokkenPerPeriode = isGetal(totaleFrequentie) && isGetal(blokken.blokkenPerDossier.waarde) ? blokken.blokkenPerDossier.waarde * totaleFrequentie : null;
  return {
    blokken,
    blokkenPerPeriode,
    procesId,
    periodeEenheid,
    eenheden: e,
    filters,
    frequenties: geselecteerd,
    status,
    totaleFrequentie,
    gemiddeldeActief,
    minimumActief: actief.minimum,
    maximumActief: actief.maximum,
    gemiddeldeWacht: groep.wachtPerUitvoering.n ? groep.wachtPerUitvoering.gemiddelde : null,
    nWacht: groep.wachtPerUitvoering.n,
    minuten,
    uren: isGetal(minuten) ? minuten / 60 : null,
    aantalProcesmetingen: actief.n,
    metingIds: actief.metingIds,
    gebruikteMetingen,
    medewerkerIds: uniek(gebruikteMetingen.map((m) => m.medewerkerId || '(niet ingevuld)')),
    meetwijzenTijd: uniek(gebruikteMetingen.map((m) => m.meetwijze)),
    bronnen: uniek(geselecteerd.map((f) => f.meetwijze)),
    meetperioden,
    kalenderweken,
    weekSleutel: weekSleutel || '',
    mogelijkeOverlap: frequentieBlokkades.some((b) => /overlap|dubbele telling/i.test(b)),
    frequentieBlokkades,
    tijdBlokkades,
    waarschuwingen,
  };
}

/** Kalenderweken (sleutels) van de frequentiemetingen van een proces met 'Meetellen in totaal'. */
function totaalWekenVanProces(procesId) {
  return uniek(frequentiesVanProces(procesId).filter((f) => f.meetellenInTotaal === true && f.meetdatum).map((f) => kalenderweekSleutel(f.meetdatum)).filter(Boolean)).sort();
}

function keuzeGemiddeldeTekst(filters) {
  return !filters.medewerker ? 'gemiddelde van alle medewerkers'
    : filters.medewerker === MEDEWERKER_LEEG ? 'gemiddelde van metingen zonder MedewerkerID'
      : `gemiddelde van medewerker ${filters.medewerker}`;
}

function filtersAlsTekst(filters) {
  const delen = [];
  delen.push('Medewerker: ' + (!filters.medewerker ? 'alle medewerkers' : filters.medewerker === MEDEWERKER_LEEG ? 'zonder MedewerkerID' : filters.medewerker));
  const groep = MEETWIJZE_GROEPEN.find((g) => g.code === filters.meetwijze);
  delen.push('Meetwijze: ' + (groep ? groep.label : 'alle meetwijzen (gemengd)'));
  delen.push('Testmetingen: ' + (filters.metTest ? 'meegenomen' : 'uitgesloten'));
  delen.push('Datum vanaf: ' + (filters.van ? fmtDatum(filters.van) : 'geen'));
  delen.push('Datum tot en met: ' + (filters.tot ? fmtDatum(filters.tot) : 'geen'));
  return delen.join('; ');
}

function meetwijzeVerdelingTekst(verdeling) {
  const delen = Object.entries(verdeling).map(([k, v]) => `${v}× ${k.toLowerCase()}`);
  return delen.length ? delen.join(', ') : 'geen';
}
