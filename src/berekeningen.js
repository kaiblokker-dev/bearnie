// ---------- Berekeningen ----------
//
// Alle berekeningen werken rechtstreeks op de ruwe invoer en worden nooit opgeslagen.
// Intern wordt met volledige precisie gerekend; alleen de weergave wordt afgerond.
// Ontbrekende waarden worden nooit als nul behandeld: een berekening waarvoor een
// waarde ontbreekt, levert null op ('Onbekend') en de reden wordt vastgelegd.

/** Filtert procesmetingen. filters: { procesId, meetwijze ('alle' | groepcode), van, tot } */
function metingVoldoetAanFilters(m, filters) {
  if (filters.procesId && m.procesId !== filters.procesId) return false;
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
  const totaalActief = stappen.length && !ontbrekendActief.length ? som(stappen.map((s) => s.actieveTijd)) : null;
  const totaalWacht = stappen.length && !ontbrekendWacht.length ? som(stappen.map((s) => s.wachttijd)) : null;
  const omvangBekend = isGetal(m.omvang) && m.omvang > 0;
  return {
    aantalStappen: stappen.length,
    totaalActief,
    totaalWacht,
    actiefPerEenheid: isGetal(totaalActief) && omvangBekend ? totaalActief / m.omvang : null,
    wachtPerEenheid: isGetal(totaalWacht) && omvangBekend ? totaalWacht / m.omvang : null,
    ontbrekendActief,
    ontbrekendWacht,
    omvangBekend,
  };
}

function redenOntbrekend(m, b, soort) {
  if (!b.aantalStappen) return 'geen stapmetingen';
  if (soort === 'actief' && b.ontbrekendActief.length) return `actieve tijd ontbreekt bij ${b.ontbrekendActief.join(', ')}`;
  if (soort === 'wacht' && b.ontbrekendWacht.length) return `wachttijd ontbreekt bij ${b.ontbrekendWacht.join(', ')}`;
  if (soort === 'actiefPerEenheid') {
    if (b.ontbrekendActief.length) return `actieve tijd ontbreekt bij ${b.ontbrekendActief.join(', ')}`;
    if (!b.omvangBekend) return 'omvang ontbreekt';
  }
  if (soort === 'wachtPerEenheid') {
    if (b.ontbrekendWacht.length) return `wachttijd ontbreekt bij ${b.ontbrekendWacht.join(', ')}`;
    if (!b.omvangBekend) return 'omvang ontbreekt';
  }
  return 'onbekend';
}

/** Samenvatting van één groep procesmetingen (één casustype). */
function vatGroepSamen(metingen) {
  const rijen = metingen.map((m) => ({ m, b: berekenMeting(m) }));
  const reeks = (sleutel) => rijen.map(({ m, b }) => ({ metingId: m.metingId, waarde: b[sleutel] }));
  const meetwijzen = {};
  for (const m of metingen) meetwijzen[m.meetwijze] = (meetwijzen[m.meetwijze] || 0) + 1;
  return {
    aantal: metingen.length,
    metingIds: metingen.map((m) => m.metingId),
    meetwijzen,
    actief: beschrijf(reeks('totaalActief')),
    wacht: beschrijf(reeks('totaalWacht')),
    actiefPerEenheid: beschrijf(reeks('actiefPerEenheid')),
    wachtPerEenheid: beschrijf(reeks('wachtPerEenheid')),
    uitgesloten: {
      actief: rijen.filter(({ b }) => !isGetal(b.totaalActief)).map(({ m, b }) => ({ metingId: m.metingId, reden: redenOntbrekend(m, b, 'actief') })),
      wacht: rijen.filter(({ b }) => !isGetal(b.totaalWacht)).map(({ m, b }) => ({ metingId: m.metingId, reden: redenOntbrekend(m, b, 'wacht') })),
      actiefPerEenheid: rijen.filter(({ b }) => !isGetal(b.actiefPerEenheid)).map(({ m, b }) => ({ metingId: m.metingId, reden: redenOntbrekend(m, b, 'actiefPerEenheid') })),
      wachtPerEenheid: rijen.filter(({ b }) => !isGetal(b.wachtPerEenheid)).map(({ m, b }) => ({ metingId: m.metingId, reden: redenOntbrekend(m, b, 'wachtPerEenheid') })),
    },
    eenheden: uniek(metingen.map((m) => m.eenheid || '').filter(Boolean)),
  };
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

/** Resultaten per processtap voor één casustype. */
function stapSamenvatting(procesId, filters, casustype) {
  const metingen = staat.procesmetingen.filter((m) => metingVoldoetAanFilters(m, { ...filters, procesId }) && m.casustype === casustype);
  const metingIds = new Set(metingen.map((m) => m.metingId));
  const stapmetingen = staat.stapmetingen.filter((s) => metingIds.has(s.metingId));
  // Volgorde: eerst de huidige stappen van het proces, daarna stappen die alleen in metingen voorkomen.
  const huidige = stappenVanProces(procesId);
  const volgorde = [...huidige.map((s) => s.stapId)];
  const extra = uniek(stapmetingen.map((s) => s.stapId)).filter((id) => !volgorde.includes(id));
  extra.sort((a, b) => {
    const va = stapmetingen.find((s) => s.stapId === a).volgorde;
    const vb = stapmetingen.find((s) => s.stapId === b).volgorde;
    return va - vb || vergelijkTekst(a, b);
  });
  return [...volgorde, ...extra].map((stapId) => {
    const huidig = huidige.find((s) => s.stapId === stapId);
    const waarnemingen = stapmetingen.filter((s) => s.stapId === stapId);
    const actief = beschrijf(waarnemingen.map((s) => ({ metingId: s.metingId, waarde: s.actieveTijd })));
    const wacht = beschrijf(waarnemingen.map((s) => ({ metingId: s.metingId, waarde: s.wachttijd })));
    const metWacht = wacht.items.filter((i) => i.waarde > 0).length;
    return {
      stapId,
      naam: huidig ? huidig.naam : (waarnemingen[0] ? waarnemingen[0].stapnaam : ''),
      bestaatNog: !!huidig,
      aantalWaarnemingen: waarnemingen.length,
      actief,
      wacht,
      aantalMetWacht: metWacht,
      percentageMetWacht: wacht.n ? (metWacht / wacht.n) * 100 : null,
      metingIds: waarnemingen.map((s) => s.metingId),
    };
  });
}

/**
 * Geschatte actieve tijd per meetperiode = aantal uitvoeringen × mediaan actieve tijd per uitvoering.
 * Gebruikt de mediaan van de normale gevallen. Berekent niets als invoer ontbreekt.
 */
function berekenTijdsbelasting(frequentie, groepNormaal) {
  const ontbreekt = [];
  if (!frequentie) ontbreekt.push('Er is voor dit proces geen frequentiemeting geregistreerd (tabblad Frequentie registreren).');
  else if (!isGetal(frequentie.aantalUitvoeringen)) ontbreekt.push(`In frequentiemeting ${frequentie.frequentieId} is het aantal uitvoeringen niet ingevuld.`);
  if (!groepNormaal || !isGetal(groepNormaal.actief.mediaan)) {
    ontbreekt.push('Er is (binnen de gekozen filters) geen normale procesmeting met een volledig ingevulde actieve tijd, dus er is geen mediaan actieve tijd per uitvoering.');
  }
  if (ontbreekt.length) return { waarde: null, ontbreekt, frequentie };
  return {
    waarde: frequentie.aantalUitvoeringen * groepNormaal.actief.mediaan,
    aantalUitvoeringen: frequentie.aantalUitvoeringen,
    mediaan: groepNormaal.actief.mediaan,
    metingIds: groepNormaal.actief.metingIds,
    n: groepNormaal.actief.n,
    frequentie,
    ontbreekt: [],
  };
}

function filtersAlsTekst(filters) {
  const delen = [];
  const groep = MEETWIJZE_GROEPEN.find((g) => g.code === filters.meetwijze);
  delen.push('Meetwijze: ' + (groep ? groep.label : 'alle meetwijzen (gemengd)'));
  delen.push('Datum vanaf: ' + (filters.van ? fmtDatum(filters.van) : 'geen'));
  delen.push('Datum tot en met: ' + (filters.tot ? fmtDatum(filters.tot) : 'geen'));
  return delen.join('; ');
}

function meetwijzeVerdelingTekst(verdeling) {
  const delen = Object.entries(verdeling).map(([k, v]) => `${v}× ${k.toLowerCase()}`);
  return delen.length ? delen.join(', ') : 'geen';
}
