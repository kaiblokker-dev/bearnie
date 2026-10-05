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
  const aantalBekend = isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen > 0;
  const omvangBekend = isGetal(m.omvang) && m.omvang > 0;
  const deel = (teller, noemerBekend, noemer) => (isGetal(teller) && noemerBekend ? teller / noemer : null);
  return {
    aantalStappen: stappen.length,
    totaalActief,
    totaalWacht,
    // Primair: per uitvoeringseenheid (bijv. per dossier)
    actiefPerUitvoering: deel(totaalActief, aantalBekend, m.aantalUitvoeringen),
    wachtPerUitvoering: deel(totaalWacht, aantalBekend, m.aantalUitvoeringen),
    // Aanvullend: per omvangseenheid (bijv. per dienstperiode)
    actiefPerOmvang: deel(totaalActief, omvangBekend, m.omvang),
    wachtPerOmvang: deel(totaalWacht, omvangBekend, m.omvang),
    ontbrekendActief,
    ontbrekendWacht,
    aantalBekend,
    aantalNietVastgelegd: !('aantalUitvoeringen' in m),
    omvangBekend,
  };
}

function redenOntbrekend(m, b, soort) {
  const e = eenhedenVan(m);
  if (!b.aantalStappen) return 'geen stapmetingen';
  const tijd = soort.startsWith('actief') ? 'actief' : 'wacht';
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
