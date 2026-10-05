// ---------- Knelpuntenanalyse ----------
//
// Knelpunten worden per stapmeting geregistreerd (knelpunt = true/false; ontbreekt = niet geregistreerd).
// De geschatte extra tijd van een knelpunt is VERKLAREND: die zit al in de gemeten actieve tijd of
// wachttijd van de stap. Ze wordt daarom nooit opgeteld bij procesduur, gemiddelden of tijdsbelasting.

function knelpuntenVanMeting(m) {
  return stapmetingenVan(m.metingId).filter((s) => s.knelpunt === true);
}

/** Of bij een meting voor minstens één stap expliciet ja/nee is ingevuld. */
function heeftKnelpuntRegistratie(m) {
  return stapmetingenVan(m.metingId).some((s) => typeof s.knelpunt === 'boolean');
}

/** Analyse voor één proces en casustype, binnen de resultaatfilters (incl. medewerker en teststatus). */
function knelpuntAnalyse(procesId, filters, casustype) {
  const metingen = staat.procesmetingen
    .filter((m) => metingVoldoetAanFilters(m, { ...filters, procesId }) && m.casustype === casustype)
    .sort((a, b) => vergelijkTekst(a.metingId, b.metingId));
  const knelpunten = metingen.flatMap((m) => knelpuntenVanMeting(m).map((s) => ({ m, s })));
  const metKnelpunt = metingen.filter((m) => knelpuntenVanMeting(m).length > 0);
  const extra = (veld, lijst) => {
    const b = beschrijf(lijst.map(({ m, s }) => ({ metingId: `${m.metingId}/${s.stapId}`, waarde: s[veld] })));
    return { ...b, totaal: b.n ? som(b.items.map((i) => i.waarde)) : null };
  };
  // Per processtap: huidige stappen van het proces, daarna stappen die alleen in metingen voorkomen.
  const stapIds = uniek([...stappenVanProces(procesId).map((s) => s.stapId), ...metingen.flatMap((m) => stapmetingenVan(m.metingId).map((s) => s.stapId))]);
  const perStap = stapIds.map((stapId) => {
    const waarnemingen = metingen.flatMap((m) => stapmetingenVan(m.metingId).filter((s) => s.stapId === stapId));
    const kp = knelpunten.filter(({ s }) => s.stapId === stapId);
    const huidig = stappenVanProces(procesId).find((s) => s.stapId === stapId);
    return {
      stapId,
      naam: huidig ? huidig.naam : (waarnemingen[0] ? waarnemingen[0].stapnaam : ''),
      waarnemingen: waarnemingen.length,
      geregistreerd: waarnemingen.filter((s) => typeof s.knelpunt === 'boolean').length,
      aantal: kp.length,
      metingIds: kp.map(({ m }) => m.metingId),
      extraActief: extra('knelpuntExtraActief', kp),
      extraWacht: extra('knelpuntExtraWacht', kp),
    };
  }).filter((r) => r.waarnemingen > 0);
  const perCategorie = [...KNELPUNT_CATEGORIEEN, ''].map((c) => {
    const kp = knelpunten.filter(({ s }) => (s.knelpuntCategorie || '') === c);
    return { categorie: c || '(categorie niet ingevuld)', aantal: kp.length, ids: kp.map(({ m, s }) => `${m.metingId}/${s.stapId}`) };
  }).filter((r) => r.aantal > 0);
  const medewerkers = uniek(metingen.map((m) => m.medewerkerId || '')).sort((a, b) => (a === '') - (b === '') || vergelijkTekst(a, b));
  const perMedewerker = medewerkers.map((id) => {
    const ms = metingen.filter((m) => (m.medewerkerId || '') === id);
    const kp = knelpunten.filter(({ m }) => (m.medewerkerId || '') === id);
    return {
      medewerkerId: id,
      metingen: ms.length,
      metKnelpunt: ms.filter((m) => knelpuntenVanMeting(m).length > 0).length,
      aantal: kp.length,
      extraActief: extra('knelpuntExtraActief', kp),
      extraWacht: extra('knelpuntExtraWacht', kp),
    };
  });
  return {
    casustype,
    aantalMetingen: metingen.length,
    metingIds: metingen.map((m) => m.metingId),
    metingenMetKnelpunt: metKnelpunt.map((m) => m.metingId),
    percentageMetKnelpunt: metingen.length ? (metKnelpunt.length / metingen.length) * 100 : null,
    metingenZonderRegistratie: metingen.filter((m) => !heeftKnelpuntRegistratie(m)).map((m) => m.metingId),
    aantalKnelpunten: knelpunten.length,
    extraActief: extra('knelpuntExtraActief', knelpunten),
    extraWacht: extra('knelpuntExtraWacht', knelpunten),
    perStap,
    perCategorie,
    perMedewerker,
    belangrijksteKnelpunten: metingen.filter((m) => m.belangrijksteKnelpunt).map((m) => ({ metingId: m.metingId, medewerkerId: m.medewerkerId || '', tekst: m.belangrijksteKnelpunt })),
  };
}

/** Alle geregistreerde knelpunten met volledige herleidbaarheid (voor export). */
function alleKnelpuntRijen() {
  const rijen = [];
  for (const m of [...staat.procesmetingen].sort((a, b) => vergelijkTekst(a.metingId, b.metingId))) {
    for (const s of knelpuntenVanMeting(m)) rijen.push({ m, s, k: kalenderweek(m.datum) });
  }
  return rijen;
}
