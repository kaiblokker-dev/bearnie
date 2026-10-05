// ---------- Demogegevens (fictief) ----------
// Worden uitsluitend geladen na een klik op 'Demogegevens laden' en zijn gemarkeerd met demo: true.

function maakDemogegevens() {
  const tijd = nuIso();
  const processen = [
    { procesId: 'DEMO-PR01', naam: 'Dossier herberekenen (demo)', uitvoeringseenheid: 'dossier', uitvoeringseenheidMeervoud: 'dossiers', omvangseenheid: 'dienstperiode', omvangseenheidMeervoud: 'dienstperioden' },
    { procesId: 'DEMO-PR02', naam: 'Adreswijziging verwerken (demo)', uitvoeringseenheid: 'aanvraag', uitvoeringseenheidMeervoud: 'aanvragen', omvangseenheid: 'mutatie', omvangseenheidMeervoud: 'mutaties' },
  ];
  const stappen = [
    ['DEMO-PR01', 1, 'Dossier openen en controleren'],
    ['DEMO-PR01', 2, 'Dienstperioden beoordelen'],
    ['DEMO-PR01', 3, 'Besluit vastleggen'],
    ['DEMO-PR02', 1, 'Wijziging ontvangen en controleren'],
    ['DEMO-PR02', 2, 'Gegevens aanpassen in systeem'],
    ['DEMO-PR02', 3, 'Bevestiging versturen'],
  ].map(([procesId, volgorde, naam]) => ({ stapId: `${procesId}-S0${volgorde}`, procesId, volgorde, naam, demo: true }));

  // Fictieve knelpunten (versie 1.6). false = expliciet geen knelpunt; ontbreekt = niet geregistreerd.
  const KP_WACHTEN = { knelpunt: true, knelpuntCategorie: 'Wachten', knelpuntOmschrijving: 'Reactie werkgever nodig voor beoordeling', knelpuntGevolgen: ['Extra wachttijd', 'Vertraging in de doorlooptijd'], knelpuntExtraActief: null, knelpuntExtraWacht: 15, knelpuntBron: 'Door medewerker aangegeven' };
  // [procesId, nr, datum, medewerker, casustype, aantal uitvoeringen, omvang, meetwijze, [[actief, wacht, reden, opmerking, knelpunt], ...]]
  const metingen = [
    ['DEMO-PR01', 1, '2026-03-02', 'PZ01', 'Normaal', 1, 4, 'Gemeten', [[6, 0], [12.5, 0], [4, 0]]],
    ['DEMO-PR01', 2, '2026-03-03', 'PZ02', 'Normaal', 1, 3, 'Gemeten', [[5.5, 0], [10, 15, 'Wachten op reactie werkgever', '', KP_WACHTEN], [3.5, 0, '', '', null, false]]],
    ['DEMO-PR01', 3, '2026-03-04', 'PZ01', 'Normaal', 1, 6, 'Gemeten', [[7, 0], [14, 0], [4.5, 2, 'Systeemvertraging', 'Rekenmodule traag', { knelpunt: true, knelpuntCategorie: 'Systeem', knelpuntOmschrijving: 'Rekenmodule reageert traag', knelpuntGevolgen: ['Extra wachttijd'], knelpuntExtraActief: null, knelpuntExtraWacht: 2, knelpuntBron: 'Geobserveerd' }]]],
    ['DEMO-PR01', 4, '2026-03-05', 'PZ03', 'Normaal', 2, 5, 'Geschat door medewerker', [[11, 0], [21, 0], [8, 0, '', 'Twee samenhangende dossiers']]],
    ['DEMO-PR01', 5, '2026-03-09', 'PZ02', 'Uitzondering', 1, 12, 'Gemeten', [[4, 0, '', '', null, false], [25, 120, 'Ontbrekende loongegevens opgevraagd', '', { knelpunt: true, knelpuntCategorie: 'Ontbrekende of onduidelijke informatie', knelpuntOmschrijving: 'Loongegevens ontbraken in het dossier', knelpuntGevolgen: ['Extra actieve tijd', 'Extra wachttijd', 'Vertraging in de doorlooptijd'], knelpuntExtraActief: 8, knelpuntExtraWacht: 120, knelpuntBron: 'Geobserveerd' }], [6, 0, '', '', null, false]]],
    ['DEMO-PR01', 6, '2026-03-10', 'PZ03', 'Uitzondering', 1, null, 'Gemeten', [[5, 0], [18, 45, 'Navraag bij vorige werkgever'], [5, 0, '', 'Aantal dienstperioden niet te bepalen']]],
    ['DEMO-PR02', 1, '2026-03-02', 'PZ04', 'Normaal', 1, 2, 'Gemeten', [[3, 0], [8, 0], [2, 0]]],
    ['DEMO-PR02', 2, '2026-03-06', 'PZ04', 'Normaal', 1, 1, 'Uit systeemgegevens', [[2.5, 0], [7.5, 5, 'Wachten op koppeling basisregistratie'], [2, 0]]],
  ];

  const procesmetingen = [];
  const stapmetingen = [];
  for (const [procesId, nr, datum, medewerkerId, casustype, aantalUitvoeringen, omvang, meetwijze, rijen] of metingen) {
    const metingId = `M-${procesId}-${String(nr).padStart(3, '0')}`;
    const proces = processen.find((p) => p.procesId === procesId);
    procesmetingen.push({
      metingId, datum, procesId, procesnaam: proces.naam, medewerkerId, casustype, aantalUitvoeringen, aantalUitvoeringenHerkomst: 'Ingevoerd', omvang,
      ...eenhedenUit(proces), meetwijze, toelichting: 'Fictieve demometing', demo: true, aangemaakt: tijd, gewijzigd: null,
    });
    const procesStappen = stappen.filter((s) => s.procesId === procesId);
    rijen.forEach(([actief, wacht, reden, opmerking, knelpunt], i) => {
      const s = procesStappen[i];
      stapmetingen.push({
        metingId, stapId: s.stapId, volgorde: s.volgorde, stapnaam: s.naam, actieveTijd: actief, wachttijd: wacht,
        redenWachttijd: reden || '', opmerking: opmerking || '', tijdvastlegging: 'Handmatig',
        ...(knelpunt === false ? { knelpunt: false } : knelpunt || {}), demo: true,
      });
    });
  }

  const frequentiemetingen = [
    { frequentieId: 'F-DEMO-PR01-001', procesId: 'DEMO-PR01', meetperiode: 'maart 2026', aantalUitvoeringen: 140, totaalVolume: null, meetwijze: 'Uit systeemgegevens', bron: 'Fictief: rapport uit zaaksysteem; aantal dienstperioden onbekend',
      medewerkerId: '', periodeEenheid: 'Maand', bereik: 'Gehele afdeling', afbakening: 'Alle herberekeningen van de afdeling', meetellenInTotaal: false },
    { frequentieId: 'F-DEMO-PR01-002', procesId: 'DEMO-PR01', meetperiode: 'week 10 2026', aantalUitvoeringen: 25, totaalVolume: null, meetwijze: 'Geschat door medewerker', bron: 'Fictief: eigen inschatting',
      medewerkerId: 'PZ01', periodeEenheid: 'Week', bereik: 'Eigen werkzaamheden', afbakening: 'Eigen dossiers PZ01', meetellenInTotaal: true },
    { frequentieId: 'F-DEMO-PR01-003', procesId: 'DEMO-PR01', meetperiode: 'week 10 2026', aantalUitvoeringen: 15, totaalVolume: null, meetwijze: 'Geteld', bron: 'Fictief: turflijst',
      medewerkerId: 'PZ02', periodeEenheid: 'Week', bereik: 'Eigen werkzaamheden', afbakening: 'Eigen dossiers PZ02 (andere dossiers dan PZ01)', meetellenInTotaal: true },
    { frequentieId: 'F-DEMO-PR02-001', procesId: 'DEMO-PR02', meetperiode: 'week 10 2026', aantalUitvoeringen: 35, totaalVolume: 41, meetwijze: 'Geschat door medewerker', bron: 'Fictief: inschatting teamleider',
      medewerkerId: '', periodeEenheid: 'Week', bereik: 'Team', afbakening: 'Hele team', meetellenInTotaal: true },
  ].map((f) => ({ ...f, ...eenhedenUit(processen.find((p) => p.procesId === f.procesId)), demo: true, aangemaakt: tijd, gewijzigd: null }));

  return {
    processen: processen.map((p) => ({ ...p, demo: true, aangemaakt: tijd, gewijzigd: tijd })),
    processtappen: stappen,
    procesmetingen,
    stapmetingen,
    frequentiemetingen,
  };
}

function eenhedenUit(proces) {
  return Object.fromEntries(EENHEID_VELDEN.map((k) => [k, proces[k]]));
}

/** Voegt demogegevens toe zonder bestaande (echte) gegevens te wijzigen. */
function laadDemogegevens() {
  verwijderDemogegevens();
  const d = maakDemogegevens();
  const botsingen = [
    ...d.processen.filter((p) => zoekProces(p.procesId)).map((p) => p.procesId),
    ...d.processtappen.filter((s) => staat.processtappen.some((x) => x.stapId === s.stapId)).map((s) => s.stapId),
    ...d.procesmetingen.filter((m) => zoekMeting(m.metingId)).map((m) => m.metingId),
    ...d.frequentiemetingen.filter((f) => zoekFrequentie(f.frequentieId)).map((f) => f.frequentieId),
  ];
  if (botsingen.length) throw new Error('De demogegevens gebruiken codes die al bestaan: ' + botsingen.join(', '));
  for (const k of Object.keys(d)) staat[k].push(...d[k]);
  for (const m of d.procesmetingen) registreerVolgnummer('meting', m.procesId, m.metingId);
  for (const f of d.frequentiemetingen) registreerVolgnummer('frequentie', f.procesId, f.frequentieId);
}
