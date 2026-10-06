// ---------- Steekproefresultaten (versie 1.7) ----------
//
// Alle uitkomsten worden per steekproef afgeleid uit de gekoppelde procesmetingen (dossiermetingen)
// en nooit opgeslagen. Normale gevallen en uitzonderingen worden samen ("alle dossiers") én apart
// getoond: een steekproef beschrijft de hele populatie, inclusief uitzonderingen.
//
// Twee uitkomsten blijven strikt gescheiden:
// 1. "Meest genoemde tijdrovende processtap": telling van de keuze per dossier, over alle metingen.
// 2. "Gemiddelde tijd per processtap": uitsluitend uit aanwezige stapmetingen. Zonder stapmeting wordt
//    nooit een tijd per stap afgeleid (ook niet uit de totale tijd of de meest tijdrovende stap).

const NIET_INGEVULD = '(niet ingevuld)';

/** Opties: { meetwijze: 'alle' | groepcode, metTest: boolean } */
function steekproefAnalyse(steekproefId, opties = {}) {
  const sp = zoekSteekproef(steekproefId);
  if (!sp) return null;
  const gekoppeld = metingenVanSteekproef(steekproefId);
  const testmetingen = gekoppeld.filter(isTestmeting);
  const binnenTest = gekoppeld.filter((m) => opties.metTest || !isTestmeting(m));
  const groep = MEETWIJZE_GROEPEN.find((g) => g.code === opties.meetwijze);
  const metingen = groep ? binnenTest.filter((m) => m.meetwijze === groep.meting) : binnenTest;
  const rijen = metingen.map((m) => ({ m, b: berekenMeting(m) }));
  const bruikbaar = rijen.filter(({ b }) => isGetal(b.actiefPerUitvoering));
  const reeks = (lijst, veld) => beschrijf(lijst.map(({ m, b }) => ({ metingId: m.metingId, waarde: b[veld] })));
  const totaal = (lijst, veld) => (lijst.length ? som(lijst.map(({ b }) => b[veld])) : null);
  const metWacht = rijen.filter(({ b }) => isGetal(b.wachtPerUitvoering));
  const aantalOk = (m) => isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen > 0;

  // Gemiddelde per dossier van een kenmerk: Σ kenmerk ÷ Σ dossiers (alleen metingen met een bekende waarde).
  const kenmerk = (veld) => {
    const lijst = metingen.filter((m) => isGetal(m[veld]) && aantalOk(m));
    const t = som(lijst.map((m) => m[veld]));
    const n = som(lijst.map((m) => m.aantalUitvoeringen));
    return { waarde: lijst.length && n > 0 ? t / n : null, totaal: lijst.length ? t : null, n: lijst.length, metingIds: lijst.map((m) => m.metingId), ontbrekend: metingen.filter((m) => !lijst.includes(m)).map((m) => m.metingId) };
  };

  const verdeling = (waarden, sleutel) => waarden.map((w) => {
    const lijst = metingen.filter((m) => (sleutel(m) || '') === w);
    return { waarde: w || NIET_INGEVULD, aantal: lijst.length, percentage: metingen.length ? (lijst.length / metingen.length) * 100 : null, metingIds: lijst.map((m) => m.metingId) };
  }).filter((r) => r.aantal > 0 || r.waarde !== NIET_INGEVULD);

  const perComplexiteit = [...COMPLEXITEITEN, ''].map((c) => {
    const lijst = bruikbaar.filter(({ m }) => (m.complexiteit || '') === c);
    return { complexiteit: c || NIET_INGEVULD, aantalMetingen: metingen.filter((m) => (m.complexiteit || '') === c).length, actief: reeks(lijst, 'actiefPerUitvoering') };
  }).filter((r) => r.aantalMetingen > 0 || r.complexiteit !== NIET_INGEVULD);

  const perCasustype = CASUSTYPEN.map((c) => {
    const lijst = rijen.filter(({ m }) => m.casustype === c);
    return { casustype: c, aantal: lijst.length, actief: reeks(lijst, 'actiefPerUitvoering'), wacht: reeks(lijst, 'wachtPerUitvoering') };
  });

  // 1. Meest genoemde tijdrovende processtap (alle metingen, ook zonder detailmeting).
  const huidigeStappen = stappenVanProces(sp.procesId);
  const metStapKeuze = metingen.filter((m) => m.tijdrovendsteStapId);
  const genoemd = uniek(metStapKeuze.map((m) => m.tijdrovendsteStapId)).map((stapId) => {
    const lijst = metStapKeuze.filter((m) => m.tijdrovendsteStapId === stapId);
    const huidig = huidigeStappen.find((s) => s.stapId === stapId);
    return {
      stapId,
      naam: huidig ? huidig.naam : lijst[0].tijdrovendsteStapnaam || '',
      volgorde: huidig ? huidig.volgorde : Infinity,
      aantal: lijst.length,
      percentage: (lijst.length / metStapKeuze.length) * 100,
      metingIds: lijst.map((m) => m.metingId),
    };
  }).sort((a, b) => b.aantal - a.aantal || a.volgorde - b.volgorde || vergelijkTekst(a.stapId, b.stapId));

  // 2. Gemiddelde tijd per processtap: alleen aanwezige stapmetingen (per uitvoering, zoals op Resultaten).
  const metDetail = metingen.filter((m) => stapmetingenVan(m.metingId).length > 0);
  const stapmetingen = metDetail.flatMap((m) => stapmetingenVan(m.metingId).map((s) => ({ m, s })));
  const stapIds = uniek([...huidigeStappen.map((s) => s.stapId), ...stapmetingen.map(({ s }) => s.stapId)]);
  const perUitvoering = ({ m, s }, veld) => (isGetal(s[veld]) && aantalOk(m) ? s[veld] / m.aantalUitvoeringen : null);
  const stapTijden = stapIds.map((stapId) => {
    const lijst = stapmetingen.filter(({ s }) => s.stapId === stapId);
    const huidig = huidigeStappen.find((s) => s.stapId === stapId);
    return {
      stapId,
      naam: huidig ? huidig.naam : (lijst[0] ? lijst[0].s.stapnaam : ''),
      actief: beschrijf(lijst.map((x) => ({ metingId: x.m.metingId, waarde: perUitvoering(x, 'actieveTijd') }))),
      wacht: beschrijf(lijst.map((x) => ({ metingId: x.m.metingId, waarde: perUitvoering(x, 'wachttijd') }))),
    };
  });

  // Knelpunten: per categorie het aantal dossiers waarin die voorkomt (dossierniveau of bij een stap; één dossier telt één keer).
  const categorieenVan = (m) => {
    const c = [];
    if (m.knelpunt === true) c.push(m.knelpuntCategorie || '');
    for (const s of stapmetingenVan(m.metingId)) if (s.knelpunt === true) c.push(s.knelpuntCategorie || '');
    return uniek(c);
  };
  const metKnelpunt = metingen.filter((m) => m.knelpunt === true || stapmetingenVan(m.metingId).some((s) => s.knelpunt === true));
  const knelpunten = [...KNELPUNT_CATEGORIEEN, ''].map((c) => {
    const lijst = metingen.filter((m) => categorieenVan(m).includes(c));
    return {
      categorie: c || '(categorie niet ingevuld)',
      aantal: lijst.length,
      percentage: metingen.length ? (lijst.length / metingen.length) * 100 : null,
      metingIds: lijst.map((m) => m.metingId),
      omschrijvingen: uniek(lijst.flatMap((m) => [
        ...(m.knelpunt === true && (m.knelpuntCategorie || '') === c && m.belangrijksteKnelpunt ? [m.belangrijksteKnelpunt] : []),
        ...stapmetingenVan(m.metingId).filter((s) => s.knelpunt === true && (s.knelpuntCategorie || '') === c && s.knelpuntOmschrijving).map((s) => s.knelpuntOmschrijving),
      ])),
    };
  }).filter((r) => r.aantal > 0).sort((a, b) => b.aantal - a.aantal);

  const meetwijzen = MEETWIJZEN_METING.map((w) => {
    const lijst = rijen.filter(({ m }) => m.meetwijze === w);
    return { meetwijze: w, aantal: lijst.length, metBekendeTijd: lijst.filter(({ b }) => isGetal(b.totaalActief)).length };
  });
  const telMeetwijze = (lijst) => som(meetwijzen.filter((x) => lijst.includes(x.meetwijze)).map((x) => x.metBekendeTijd));

  const actief = reeks(bruikbaar, 'actiefPerUitvoering');
  const voortgangAantal = binnenTest.length;
  const extrapolatie = { waarde: null, ontbreekt: [] };
  if (!isGetal(sp.populatiegrootte)) extrapolatie.ontbreekt.push('De totale populatiegrootte is niet ingevuld bij de steekproef.');
  if (!actief.n) extrapolatie.ontbreekt.push('Er is nog geen bruikbare meting met een bekende actieve tijd per dossier.');
  if (!extrapolatie.ontbreekt.length) {
    extrapolatie.waarde = actief.gemiddelde * sp.populatiegrootte;
    extrapolatie.uren = extrapolatie.waarde / 60;
  }
  extrapolatie.populatiegrootte = isGetal(sp.populatiegrootte) ? sp.populatiegrootte : null;
  extrapolatie.n = actief.n;
  extrapolatie.gemiddelde = actief.n ? actief.gemiddelde : null;

  const waarschuwingen = [];
  if (!groep && uniek(metingen.map((m) => m.meetwijze)).length > 1) waarschuwingen.push(`De resultaten combineren meetwijzen (${meetwijzeVerdelingTekst(metingen.reduce((v, m) => { v[m.meetwijze] = (v[m.meetwijze] || 0) + 1; return v; }, {}))}). Kies zo nodig één meetwijze.`);
  if (sp.selectiemethode === 'Doelgericht') waarschuwingen.push('De dossiers zijn doelgericht geselecteerd. De steekproef is daardoor niet representatief; gebruik de geschatte tijdsbelasting van de populatie alleen als indicatie.');
  if (!sp.selectiemethode) waarschuwingen.push('De selectiemethode is niet ingevuld; de representativiteit van de steekproef is daardoor onbekend.');
  if (sp.status !== 'Afgerond') waarschuwingen.push(`De steekproef heeft de status ${sp.status.toLowerCase()}: de resultaten zijn voorlopig.`);
  if (actief.n && actief.n < 5) waarschuwingen.push('Er zijn nog weinig bruikbare metingen. Interpreteer de uitkomsten voorzichtig.');
  const meerdere = metingen.filter((m) => isGetal(m.aantalUitvoeringen) && m.aantalUitvoeringen !== 1);
  if (meerdere.length) waarschuwingen.push(`${meerdere.length} gekoppelde meting(en) omvatten meer dan één dossier (${meerdere.map((m) => m.metingId).join(', ')}). Tijden en kenmerken zijn per dossier omgerekend; de voortgang telt procesmetingen.`);
  if (testmetingen.length && opties.metTest) waarschuwingen.push(`Testmetingen zijn meegenomen: ${testmetingen.map((m) => m.metingId).join(', ')}.`);
  const zonderVolgnummer = metingen.filter((m) => !isGetal(m.volgnummerSteekproef)).map((m) => m.metingId);
  if (zonderVolgnummer.length) waarschuwingen.push(`Zonder volgnummer: ${zonderVolgnummer.join(', ')}.`);

  return {
    steekproef: sp,
    opties: { meetwijze: groep ? groep.code : 'alle', metTest: !!opties.metTest },
    meetwijzeLabel: groep ? groep.label : 'alle meetwijzen',
    voortgang: { aantal: voortgangAantal, doel: isGetal(sp.steekproefgrootte) ? sp.steekproefgrootte : null, percentage: isGetal(sp.steekproefgrootte) ? (voortgangAantal / sp.steekproefgrootte) * 100 : null, dossiers: som(binnenTest.filter(aantalOk).map((m) => m.aantalUitvoeringen)) },
    testmetingen: testmetingen.map((m) => m.metingId),
    metingen,
    metingIds: metingen.map((m) => m.metingId),
    bruikbaar: bruikbaar.map(({ m }) => m.metingId),
    nietBruikbaar: rijen.filter(({ b }) => !isGetal(b.actiefPerUitvoering)).map(({ m, b }) => ({ metingId: m.metingId, dossierId: m.dossierId || '', reden: redenOntbrekend(m, b, 'actiefPerUitvoering') })),
    totaalActief: totaal(bruikbaar, 'totaalActief'),
    actief,
    totaalWacht: totaal(metWacht, 'totaalWacht'),
    wacht: reeks(metWacht, 'wachtPerUitvoering'),
    perCasustype,
    perComplexiteit,
    kenmerken: { perioderegels: kenmerk('aantalPerioderegels'), blokken: kenmerk('aantalBlokken'), onderbrekingen: kenmerk('aantalOnderbrekingen') },
    complexiteit: verdeling([...COMPLEXITEITEN, ''], (m) => m.complexiteit),
    casustypen: verdeling(CASUSTYPEN, (m) => m.casustype),
    tijdrovend: { ranglijst: genoemd, n: metStapKeuze.length, zonder: metingen.length - metStapKeuze.length },
    stapTijden: { stappen: stapTijden, metingenMetDetail: metDetail.map((m) => m.metingId), metingenZonderDetail: metingen.filter((m) => !metDetail.includes(m)).map((m) => m.metingId) },
    knelpunten: { perCategorie: knelpunten, metingenMetKnelpunt: metKnelpunt.map((m) => m.metingId) },
    meetwijzen,
    tijdswaarden: {
      gemeten: telMeetwijze(['Gemeten', 'Geobserveerd']),
      geschat: telMeetwijze(['Geschat door medewerker']),
      systeem: telMeetwijze(['Uit systeemgegevens']),
      stapwaarden: stapmetingen.filter(({ s }) => isGetal(s.actieveTijd)).length,
    },
    extrapolatie,
    waarschuwingen,
  };
}

/** Korte voortgangstekst, bijv. "12 van 20 dossiers". */
function voortgangTekst(v) {
  return `${v.aantal}${isGetal(v.doel) ? ` van ${v.doel}` : ''} ${v.aantal === 1 && !isGetal(v.doel) ? 'dossier' : 'dossiers'}`;
}
