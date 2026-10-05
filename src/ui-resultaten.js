// ---------- 5. Resultaten ----------

let resultaatCasustype = 'Normaal';
const gekozenFrequentie = {}; // per ProcesID het gekozen FrequentieID
const gekozenTotaalPeriode = {}; // per ProcesID de gekozen periode-eenheid voor het totaaloverzicht
const gekozenTotaalWeek = {}; // per ProcesID de gekozen kalenderweek ('' = alle kalenderweken)

function initResultaten() {
  vulSelect($('#rMeetwijze'), [{ waarde: 'alle', label: 'Alle meetwijzen (gemengd, wordt vermeld)' }, ...MEETWIJZE_GROEPEN.map((g) => ({ waarde: g.code, label: g.label }))], 'alle');
  for (const id of ['#rProces', '#rMeetwijze', '#rMedewerker', '#rVan', '#rTot', '#rMetTest']) $(id).addEventListener('change', renderResultaten);
  $('#resultatenInhoud').addEventListener('change', (e) => {
    if (e.target.id === 'rFrequentie') {
      gekozenFrequentie[$('#rProces').value] = e.target.value;
      renderResultaten();
    }
    if (e.target.id === 'rTotaalWeek') {
      gekozenTotaalWeek[$('#rProces').value] = e.target.value;
      renderResultaten();
    }
    if (e.target.id === 'rTotaalPeriode') {
      gekozenTotaalPeriode[$('#rProces').value] = e.target.value;
      renderResultaten();
    }
  });
}

function resultaatFilters() {
  return { meetwijze: $('#rMeetwijze').value || 'alle', medewerker: $('#rMedewerker').value || '', van: $('#rVan').value, tot: $('#rTot').value, metTest: $('#rMetTest').checked };
}

function kiesFrequentie(procesId) {
  // Testmetingen alleen als 'Testmetingen meenemen' aan staat.
  const metTest = !!($('#rMetTest') && $('#rMetTest').checked);
  const lijst = frequentiesVanProces(procesId).filter((f) => metTest || !isTestmeting(f));
  const gekozen = gekozenFrequentie[procesId];
  if (gekozen === '') return null;
  return lijst.find((f) => f.frequentieId === gekozen) || lijst[0] || null;
}

/** Eenheden voor de resultaten van een proces: die van het proces, anders van de eerste meting. */
function eenhedenVoorResultaat(procesId, metingen) {
  if (zoekProces(procesId)) return eenhedenVan(null, procesId);
  return eenhedenVan(metingen && metingen[0], procesId);
}

function renderResultaten() {
  const ids = alleProcesIds();
  vulSelect($('#rProces'), ids.map((id) => ({ waarde: id, label: procesLabel(id) })), $('#rProces').value || ids[0], ids.length ? undefined : '— Geen processen —');
  const inhoud = $('#resultatenInhoud');
  const procesId = $('#rProces').value;
  if (!procesId) {
    inhoud.innerHTML = '<div class="melding neutraal">Er zijn nog geen processen of metingen. Leg eerst een proces vast en registreer metingen.</div>';
    return;
  }
  // Medewerkerkeuze: alleen medewerkers van dit proces; een niet meer passende keuze vervalt naar 'alle'.
  const heeftZonderId = staat.procesmetingen.some((m) => m.procesId === procesId && !m.medewerkerId);
  vulSelect($('#rMedewerker'), [
    ...medewerkersVanProces(procesId),
    ...(heeftZonderId ? [{ waarde: MEDEWERKER_LEEG, label: '(niet ingevuld)' }] : []),
  ], $('#rMedewerker').value, 'Alle medewerkers');
  const filters = resultaatFilters();
  const sam = procesSamenvatting(procesId, filters);
  const N = sam.perCasustype.Normaal;
  const U = sam.perCasustype.Uitzondering;
  const e = eenhedenVoorResultaat(procesId, sam.metingen);
  const freq = kiesFrequentie(procesId);
  const belasting = berekenTijdsbelasting(freq, N, procesId);

  const meldingen = [legacyMeldingHtml(procesId)];
  const eenheidMelding = eenheidWaarschuwing(procesId);
  if (eenheidMelding) meldingen.push(`<div class="melding waarschuwing">${esc(eenheidMelding)}</div>`);
  // Aantallen echte en fictieve metingen binnen de overige filters.
  const metEnZonderTest = staat.procesmetingen.filter((m) => metingVoldoetAanFilters(m, { ...filters, procesId, metTest: true }));
  const aantalTest = metEnZonderTest.filter(isTestmeting).length;
  const freqTest = frequentiesVanProces(procesId).filter(isTestmeting).length;
  meldingen.push(`<div class="melding neutraal">Beschikbaar: <strong>${metEnZonderTest.length - aantalTest} echte</strong> en <strong>${aantalTest} test/fictieve</strong> procesmeting(en)${freqTest ? `; ${freqTest} test/fictieve frequentiemeting(en)` : ''}.
    Test/fictieve metingen zijn <strong>${filters.metTest ? 'meegenomen' : 'uitgesloten'}</strong> in de resultaten hieronder (zie <em>Testmetingen meenemen</em>).</div>`);
  if (filters.medewerker) {
    meldingen.push(`<div class="melding waarschuwing"><strong>Gefilterd op medewerker ${esc(medewerkerLabel(filters.medewerker === MEDEWERKER_LEEG ? '' : filters.medewerker))}.</strong>
      Alle uitkomsten hieronder (ook de geschatte tijdsbelasting en de grafiek) zijn alleen gebaseerd op de metingen van deze medewerker. Kies <em>Alle medewerkers</em> voor het gecombineerde resultaat van het hele proces.</div>`);
  }
  meldingen.push(`<div class="melding info"><strong>Beschikbaar binnen de filters:</strong> ${sam.aantal} procesmetingen (${N.aantal} normaal, ${U.aantal} uitzondering).
    Meetwijzen: ${esc(meetwijzeVerdelingTekst(sam.meetwijzen))}. <span class="klein">Filters: ${esc(filtersAlsTekst(filters))}.</span><br>
    <span class="klein">Eenheden: één uitvoering = één <strong>${esc(e.uitvoeringseenheid)}</strong>; omvang in <strong>${esc(e.omvangseenheidMeervoud)}</strong>.
    Primaire uitkomst: actieve tijd per ${esc(e.uitvoeringseenheid)}. Aanvullende uitkomst: actieve tijd per ${esc(e.omvangseenheid)}.</span></div>`);
  if (filters.meetwijze === 'alle' && Object.keys(sam.meetwijzen).length > 1) {
    meldingen.push(`<div class="melding waarschuwing"><strong>Let op: verschillende meetwijzen gecombineerd.</strong> Deze resultaten combineren ${esc(meetwijzeVerdelingTekst(sam.meetwijzen))}. Kies bij <em>Meetwijze</em> één meetwijze om ze afzonderlijk te bekijken.</div>`);
  }
  if (sam.aantal < 3 || (N.aantal > 0 && N.aantal < 3) || (U.aantal > 0 && U.aantal < 3)) {
    meldingen.push('<div class="melding neutraal">Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig.</div>');
  }
  const uitvoeringGemengd = uniek([...N.eenheden.uitvoering, ...U.eenheden.uitvoering]);
  const omvangGemengd = uniek([...N.eenheden.omvang, ...U.eenheden.omvang]);
  if (uitvoeringGemengd.length > 1 || omvangGemengd.length > 1) {
    meldingen.push(`<div class="melding waarschuwing">Let op: de metingen zijn vastgelegd met verschillende eenheden
      (uitvoeringseenheid: ${esc(uitvoeringGemengd.join(', '))}; omvangseenheid: ${esc(omvangGemengd.join(', '))}). De tijden per eenheid zijn daardoor niet goed vergelijkbaar.</div>`);
  }

  const tegel = (titel, waardeHtml, toelichting, primair) => `<div class="tegel"${primair ? ' style="border-top-color:var(--groen-donker);border-top-width:5px"' : ''}><div class="titel">${titel}</div><div class="waarde${waardeHtml.includes('onbekend') ? ' onbekend' : ''}">${waardeHtml}</div><div class="toelichting">${toelichting}</div></div>`;
  const tegels = [
    tegel('Normale metingen', String(N.aantal), `${esc(fmtMetEenheid(N.aantalUitvoeringen, e, 'uitvoering'))}${N.metingenZonderAantal.length ? ` + ${N.metingenZonderAantal.length} meting(en) met onbekend aantal` : ''}`),
    tegel('Uitzonderingen', String(U.aantal), `${esc(fmtMetEenheid(U.aantalUitvoeringen, e, 'uitvoering'))}${U.metingenZonderAantal.length ? ` + ${U.metingenZonderAantal.length} meting(en) met onbekend aantal` : ''}`),
    tegel(`Mediane actieve tijd per ${esc(e.uitvoeringseenheid)} <span class="klein">(primair)</span>`, htmlGetal(N.actiefPerUitvoering.mediaan, 2, ' min'), `normale gevallen, n = ${N.actiefPerUitvoering.n}`, true),
    tegel(`Mediane actieve tijd per ${esc(e.omvangseenheid)} <span class="klein">(aanvullend)</span>`, htmlGetal(N.actiefPerOmvang.mediaan, 2, ' min'), `normale gevallen, n = ${N.actiefPerOmvang.n}`),
    tegel(`Mediane wachttijd per ${esc(e.uitvoeringseenheid)}`, htmlGetal(N.wachtPerUitvoering.mediaan, 2, ' min'), `normale gevallen, n = ${N.wachtPerUitvoering.n}`),
    tegel('Geschatte tijdsbelasting per meetperiode', isGetal(belasting.waarde) ? esc(fmtGetal(belasting.waarde, 1) + ' min') : `<span class="onbekend">${ONBEKEND}</span>`,
      isGetal(belasting.waarde) ? `${esc(fmtGetal(belasting.waarde / 60, 1))} uur · ${esc(freq.meetperiode)}` : 'zie toelichting hieronder'),
  ].join('');

  inhoud.innerHTML = `
    ${meldingen.join('')}
    <div class="tegels">${tegels}</div>
    <div class="kaart">
      <h3>Samenvatting per casustype</h3>
      <p class="klein zacht">Tijden in minuten. Normale gevallen en uitzonderingen worden afzonderlijk berekend. Alleen metingen met een bekende waarde tellen mee (n).</p>
      ${samenvattingTabelHtml(N, U, e)}
    </div>
    <div class="kaart">
      <h3>Resultaten per medewerker</h3>
      ${medewerkerTabelHtml(procesId, filters, e)}
    </div>
    <div class="kaart" id="rKnelpunten">
      <h3>Knelpuntenanalyse ${infoHtml('knelpunt')}</h3>
      ${knelpuntenHtml(procesId, filters)}
    </div>
    <div class="kaart" id="rTotaal">
      <h3>Totale frequentie en geschatte tijdsbelasting</h3>
      ${totaalOverzichtHtml(procesId, filters)}
    </div>
    <div class="kaart">
      <h3>Frequentie en geschatte tijdsbelasting per frequentiemeting</h3>
      ${tijdsbelastingHtml(procesId, freq, belasting, e)}
    </div>
    <div class="kaart">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h3 style="margin:0">Resultaten per processtap</h3>
        <div class="subtabs" style="margin:0" id="rCasustypeKeuze">
          ${CASUSTYPEN.map((c) => `<button type="button" data-casustype="${c}" class="${c === resultaatCasustype ? 'actief' : ''}">${c === 'Normaal' ? 'Normale gevallen' : 'Uitzonderingen'}</button>`).join('')}
        </div>
      </div>
      ${stapResultatenHtml(procesId, filters, e)}
    </div>`;

  $('#rCasustypeKeuze').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-casustype]');
    if (!b) return;
    resultaatCasustype = b.dataset.casustype;
    renderResultaten();
  });
  const canvas = $('#rGrafiek');
  if (canvas) tekenGrafiek(canvas, grafiekGegevens(procesId, filters), Math.max(1, window.devicePixelRatio || 1));
}

function samenvattingTabelHtml(N, U, e) {
  const rij = (label, fn, dec = 2) => `<tr><th>${label}</th><td class="getal berekend">${fn(N, dec)}</td><td class="getal berekend">${fn(U, dec)}</td></tr>`;
  const st = (sleutel, veld) => (g, dec) => htmlGetal(g[sleutel][veld], dec);
  const nVan = (sleutel) => (g) => String(g[sleutel].n);
  const blok = (titel, sleutel, volledig) => `
      <tr><th colspan="3" class="zacht">${titel}</th></tr>
      ${rij('&nbsp;&nbsp;Gebruikte metingen (n)', nVan(sleutel))}
      ${rij('&nbsp;&nbsp;<strong>Mediaan</strong>', st(sleutel, 'mediaan'))}
      ${rij('&nbsp;&nbsp;Gemiddelde', st(sleutel, 'gemiddelde'))}
      ${volledig ? rij('&nbsp;&nbsp;Minimum', st(sleutel, 'minimum')) + rij('&nbsp;&nbsp;Maximum', st(sleutel, 'maximum')) : ''}`;
  return `<div class="tabelhouder"><table>
    <thead><tr><th></th><th class="getal">Normaal</th><th class="getal">Uitzondering</th></tr></thead>
    <tbody>
      ${rij('Aantal metingen', (g) => String(g.aantal))}
      ${rij(`Aantal ${esc(e.uitvoeringseenheidMeervoud)} (som)`, (g) => esc(fmtAantal(g.aantalUitvoeringen)) + (g.metingenZonderAantal.length ? ` <span class="klein">(+${g.metingenZonderAantal.length} onbekend)</span>` : ''))}
      ${blok(`<strong>Primair:</strong> actieve tijd per ${esc(e.uitvoeringseenheid)} (min)`, 'actiefPerUitvoering', true)}
      ${blok(`Wachttijd per ${esc(e.uitvoeringseenheid)} (min)`, 'wachtPerUitvoering', false)}
      ${blok(`<strong>Aanvullend:</strong> actieve tijd per ${esc(e.omvangseenheid)} (min)`, 'actiefPerOmvang', true)}
      <tr><th></th>
        <td class="rechts"><button type="button" class="klein" data-actie="onderliggende-metingen" data-casustype="Normaal">Onderliggende metingen bekijken</button></td>
        <td class="rechts"><button type="button" class="klein" data-actie="onderliggende-metingen" data-casustype="Uitzondering">Onderliggende metingen bekijken</button></td>
      </tr>
    </tbody></table></div>`;
}

/** Periode voor het totaaloverzicht: de gekozen periode, anders de eerste beschikbare. */
function kiesTotaalPeriode(procesId) {
  const perioden = totaalPeriodenVanProces(procesId);
  const gekozen = gekozenTotaalPeriode[procesId];
  return perioden.includes(gekozen) ? gekozen : perioden[0] || null;
}

function bronLabel(meetwijze) {
  return MEETWIJZE_FREQUENTIE_LABELS[meetwijze] || meetwijze || ONBEKEND;
}

/** Onderdeel 'Totale frequentie en geschatte tijdsbelasting' op het resultatenscherm. */
/** Gekozen kalenderweek voor het totaaloverzicht ('' = alle kalenderweken). */
function kiesTotaalWeek(procesId) {
  const gekozen = gekozenTotaalWeek[procesId] || '';
  return totaalWekenVanProces(procesId).includes(gekozen) ? gekozen : '';
}

function totaalOverzichtHtml(procesId, filters) {
  const perioden = totaalPeriodenVanProces(procesId);
  const periode = kiesTotaalPeriode(procesId);
  const weken = totaalWekenVanProces(procesId);
  const week = kiesTotaalWeek(procesId);
  const t = berekenTotaalOverzicht(procesId, filters, periode, week);
  const e = t.eenheden;
  const perTekst = periode ? `per ${periode.toLowerCase()}` : '';
  const keuze = `<div class="filterbalk" style="margin:8px 0 0">
      ${perioden.length ? `<div class="veld" style="width:220px"><label for="rTotaalPeriode">Frequentieperiode ${infoHtml('frequentieperiode')}</label><select id="rTotaalPeriode">${perioden.map((p) => `<option value="${esc(p)}" ${p === periode ? 'selected' : ''}>per ${esc(p.toLowerCase())}</option>`).join('')}</select></div>` : ''}
      ${weken.length ? `<div class="veld" style="width:260px"><label for="rTotaalWeek">Kalenderweek (meetmoment) ${infoHtml('kalenderweek')}</label><select id="rTotaalWeek"><option value="">Alle kalenderweken</option>${weken.map((w) => `<option value="${esc(w)}" ${w === week ? 'selected' : ''}>${esc(kalenderweekSleutelTekst(w))}</option>`).join('')}</select></div>` : ''}
    </div>`;
  const blokkades = [...t.frequentieBlokkades, ...t.tijdBlokkades];
  const waarde = (v, dec, eenheid) => (isGetal(v) ? `<strong>${esc(fmtGetal(v, dec))}</strong> ${eenheid}` : `<span class="onbekend">${ONBEKEND}</span>`);
  const statusRijen = t.status.map(({ frequentie: f, geselecteerd, reden }) => `<tr${geselecteerd ? ' class="gekozen"' : ''}>
      <td class="mono">${esc(f.frequentieId)}${demoLabel(f)}${testLabel(f)}</td><td>${htmlTekst(f.medewerkerId)}</td><td>${f.bereik ? esc(f.bereik) : '<span class="onbekend">Nog niet bepaald</span>'}</td>
      <td class="klein">${esc(f.afbakening || '')}</td><td>${f.periodeEenheid ? 'per ' + esc(f.periodeEenheid.toLowerCase()) : '<span class="onbekend">Nog niet bepaald</span>'}</td><td>${f.meetdatum ? esc(kalenderweekTekst(f.meetdatum, true)) : htmlTekst(f.meetperiode)}</td>
      <td class="getal">${htmlMetEenheid(f.aantalUitvoeringen, e, 'uitvoering')}</td><td>${meetwijzeHtml(f.meetwijze)}</td><td>${esc(meetellenTekst(f))}</td>
      <td>${geselecteerd ? '<strong>Ja</strong>' : `Nee <span class="klein zacht">(${esc(reden)})</span>`}</td>
      <td class="acties"><button type="button" class="klein" data-actie="frequentie-bewerken" data-id="${esc(f.frequentieId)}">Aanpassen</button></td></tr>`).join('');
  return `
    <p class="klein zacht">Totaalbeeld per proces. Alleen frequentiemetingen met <em>Meetellen in totaal</em> aangevinkt en dezelfde periode worden opgeteld, en alleen als ze niet (mogelijk) overlappen.
      De tijdsbelasting gebruikt uitsluitend actieve tijd; wachttijd telt niet mee. De afzonderlijke frequentiemetingen blijven hieronder en onder <em>Metingen bekijken</em> zichtbaar.</p>
    ${keuze}
    ${blokkades.length ? `<div class="melding fout mt"><strong>Niet (volledig) berekend:</strong><ul>${blokkades.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
    ${t.waarschuwingen.length ? `<div class="melding waarschuwing mt"><strong>Let op:</strong><ul>${t.waarschuwingen.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
    <div class="berekend-kader mt">
      <span class="etiket berekend">Automatisch berekend</span>
      <div class="formule">Geschatte actieve tijdsbelasting (min) = totale frequentie × gemiddelde actieve tijd per ${esc(e.uitvoeringseenheid)}<br>
        = ${isGetal(t.totaleFrequentie) ? esc(fmtAantal(t.totaleFrequentie)) : ONBEKEND} × ${isGetal(t.gemiddeldeActief) ? esc(fmtGetal(t.gemiddeldeActief)) : ONBEKEND} min = <strong>${isGetal(t.minuten) ? esc(fmtGetal(t.minuten)) + ' min' : ONBEKEND}</strong>
        ${isGetal(t.uren) ? ` = <strong>${esc(fmtGetal(t.uren, 2))} uur</strong> ${esc(perTekst)}` : ''}</div>
      <dl class="gegevens">
        <dt>Frequentieperiode ${infoHtml('frequentieperiode')}</dt><dd>${periode ? esc(perTekst) : `<span class="onbekend">${ONBEKEND}</span>`}</dd>
        <dt>Kalenderweek (meetmoment) ${infoHtml('kalenderweek')}</dt><dd>${week ? `<strong>${esc(kalenderweekSleutelTekst(week))}</strong> (geselecteerd)` : 'alle kalenderweken'}${t.kalenderweken.length ? ` <span class="klein">– gebruikte frequenties: ${esc(t.kalenderweken.map(kalenderweekSleutelTekst).join(', '))}</span>` : ''}${t.meetperioden.length ? ` <span class="klein">(omschrijving meetperiode: ${esc(t.meetperioden.join(', '))})</span>` : ''}</dd>
        <dt>Totale frequentie ${infoHtml('frequentie')}</dt><dd>${waarde(t.totaleFrequentie, Number.isInteger(t.totaleFrequentie) ? 0 : 2, `${esc(e.uitvoeringseenheidMeervoud)} ${esc(perTekst)}`)}</dd>
        <dt>Gemiddelde actieve tijd per ${esc(e.uitvoeringseenheid)}</dt><dd>${waarde(t.gemiddeldeActief, 2, `min per ${esc(e.uitvoeringseenheid)}`)}${t.aantalProcesmetingen ? ` <span class="klein">(n = ${t.aantalProcesmetingen}; bandbreedte ${esc(fmtGetal(t.minimumActief))}–${esc(fmtGetal(t.maximumActief))} min)</span>` : ''}</dd>
        <dt>Medewerkerselectie</dt><dd><strong>${esc(keuzeGemiddeldeTekst(filters))}</strong> <span class="klein">(normale gevallen; wijzig via het filter Medewerker bovenaan)</span></dd>
        <dt>Test/fictieve metingen ${infoHtml('test')}</dt><dd><strong>${filters.metTest ? 'meegenomen' : 'uitgesloten'}</strong></dd>
        <dt>Mogelijke overlap</dt><dd>${t.frequenties.length < 2 ? 'niet van toepassing (minder dan twee frequenties)' : t.mogelijkeOverlap ? '<strong class="schatting">ja – totaal niet berekend, controleer de selectie</strong>' : 'nee (eigen werkzaamheden van verschillende medewerkers)'}</dd>
        <dt>Geschatte actieve tijdsbelasting ${infoHtml('tijdsbelasting')}</dt><dd>${waarde(t.minuten, 2, `minuten ${esc(perTekst)}`)} · ${waarde(t.uren, 2, `uur ${esc(perTekst)}`)}</dd>
        <dt>Gemiddelde wachttijd (apart, niet meegeteld) ${infoHtml('wacht')}</dt><dd>${waarde(t.gemiddeldeWacht, 2, `min per ${esc(e.uitvoeringseenheid)}`)}${t.nWacht ? ` <span class="klein">(n = ${t.nWacht}; onderdeel van de doorlooptijd)</span>` : ''}</dd>
        <dt>Frequentiemetingen in totaal</dt><dd>${t.frequenties.length}${t.frequenties.length ? ` <span class="mono klein">(${esc(t.frequenties.map((f) => f.frequentieId).join(', '))})</span>` : ''}</dd>
        <dt>Procesmetingen voor gemiddelde</dt><dd>${t.aantalProcesmetingen}${t.metingIds.length ? ` <span class="mono klein">(${esc(t.metingIds.join(', '))})</span>` : ''}</dd>
        <dt>Medewerker-ID's (procesmetingen)</dt><dd>${esc(t.medewerkerIds.join(', ') || '—')}</dd>
        <dt>Bron(nen) frequentie</dt><dd>${esc(t.bronnen.map(bronLabel).join('; ') || '—')}</dd>
        <dt>Verwerkingstijd gemeten / geschat / uit systeem</dt><dd>${esc(meetwijzeVerdelingTekst(t.gebruikteMetingen.reduce((v, m) => { v[m.meetwijze] = (v[m.meetwijze] || 0) + 1; return v; }, {})))}</dd>
      </dl>
      <div class="knoppen"><button type="button" class="klein" data-actie="totaal-onderliggend">Onderliggende gegevens bekijken</button></div>
    </div>
    ${blokkenHtml(procesId, filters, t)}
    ${t.status.length ? `<h4>Frequentiemetingen van dit proces</h4>
      <div class="tabelhouder"><table class="klein">
        <thead><tr><th>FrequentieID</th><th>Medewerker</th><th>Bereik</th><th>Afbakening</th><th>Periode</th><th>Meetmoment</th><th class="getal">Aantal</th><th>Bron</th><th>Meetellen</th><th>In dit totaal</th><th></th></tr></thead>
        <tbody>${statusRijen}</tbody></table></div>` : '<p class="zacht klein mt">Er zijn voor dit proces nog geen frequentiemetingen.</p>'}`;
}

/** Onderdeel 'Knelpuntenanalyse': normale gevallen en uitzonderingen naast elkaar. */
function knelpuntenHtml(procesId, filters) {
  const N = knelpuntAnalyse(procesId, filters, 'Normaal');
  const U = knelpuntAnalyse(procesId, filters, 'Uitzondering');
  if (!N.aantalMetingen && !U.aantalMetingen) return '<p class="zacht klein">Geen metingen binnen de filters.</p>';
  const tijd = (x) => (x.n ? `${esc(fmtGetal(x.totaal))} min totaal · ${esc(fmtGetal(x.gemiddelde))} min gem. <span class="klein zacht">(n = ${x.n})</span>` : `<span class="onbekend">${ONBEKEND}</span> <span class="klein zacht">(n = 0)</span>`);
  const rij = (label, fn) => `<tr><th>${label}</th><td class="getal berekend">${fn(N)}</td><td class="getal berekend">${fn(U)}</td></tr>`;
  const stapIds = uniek([...N.perStap, ...U.perStap].map((r) => r.stapId));
  const stapRij = (id) => {
    const n = N.perStap.find((r) => r.stapId === id);
    const u = U.perStap.find((r) => r.stapId === id);
    const cel = (r) => (r ? `${r.aantal} <span class="klein zacht">van ${r.waarnemingen}</span>` : '–');
    return `<tr><td class="mono">${esc(id)}</td><td>${esc((n || u).naam)}</td><td class="getal berekend">${cel(n)}</td><td class="getal berekend">${cel(u)}</td></tr>`;
  };
  const categorieen = uniek([...N.perCategorie, ...U.perCategorie].map((r) => r.categorie));
  const catRij = (c) => {
    const tel = (g) => (g.perCategorie.find((r) => r.categorie === c) || { aantal: 0 }).aantal;
    return `<tr><td>${esc(c)}</td><td class="getal berekend">${tel(N)}</td><td class="getal berekend">${tel(U)}</td></tr>`;
  };
  const mwRijen = [N, U].flatMap((g) => g.perMedewerker.map((r) => `<tr><td>${esc(medewerkerLabel(r.medewerkerId))}</td><td>${esc(g.casustype)}</td>
      <td class="getal">${r.metingen}</td><td class="getal berekend">${r.metKnelpunt} <span class="klein zacht">(${esc(fmtGetal(r.metingen ? (r.metKnelpunt / r.metingen) * 100 : null, 0))}%)</span></td>
      <td class="getal berekend">${r.aantal}</td><td class="getal berekend">${r.extraActief.n ? esc(fmtGetal(r.extraActief.totaal)) : '–'}</td><td class="getal berekend">${r.extraWacht.n ? esc(fmtGetal(r.extraWacht.totaal)) : '–'}</td></tr>`)).join('');
  return `<p class="klein zacht">Knelpunten worden per processtap geregistreerd. De geschatte extra tijd is <strong>verklarend</strong>: die zit al in de gemeten actieve tijd en wachttijd en wordt <strong>niet</strong> opgeteld bij de procesduur, de gemiddelden of de tijdsbelasting (geen dubbeltelling).
      Binnen de filters bovenaan (incl. medewerker en testmetingen).</p>
    <div class="tabelhouder"><table>
      <thead><tr><th></th><th class="getal">Normaal</th><th class="getal">Uitzondering</th></tr></thead>
      <tbody>
        ${rij('Metingen', (g) => String(g.aantalMetingen))}
        ${rij('Metingen met minimaal één knelpunt', (g) => `${g.metingenMetKnelpunt.length} <span class="klein zacht">(${esc(fmtGetal(g.percentageMetKnelpunt, 1))}%)</span>`)}
        ${rij('Metingen zonder knelpuntregistratie', (g) => `${g.metingenZonderRegistratie.length} <span class="klein zacht">(bij geen enkele stap ja/nee ingevuld)</span>`)}
        ${rij('Aantal knelpunten (stappen met knelpunt)', (g) => String(g.aantalKnelpunten))}
        ${rij('Geschatte extra actieve tijd', (g) => tijd(g.extraActief))}
        ${rij('Geschatte extra wachttijd', (g) => tijd(g.extraWacht))}
      </tbody></table></div>
    <p class="klein zacht">Gemiddelde extra tijd = per knelpunt waarvoor een schatting is ingevuld. Het percentage is ten opzichte van alle metingen binnen de filters.</p>
    <div class="twee-kolommen">
      <div><h4>Voorkomens per processtap</h4>
        <div class="tabelhouder"><table class="klein"><thead><tr><th>StapID</th><th>Processtap</th><th class="getal">Normaal</th><th class="getal">Uitzondering</th></tr></thead>
        <tbody>${stapIds.map(stapRij).join('')}</tbody></table></div>
        <p class="klein zacht">"3 van 5" = 3 knelpunten bij 5 waarnemingen van die stap.</p></div>
      <div><h4>Voorkomens per categorie</h4>
        ${categorieen.length ? `<div class="tabelhouder"><table class="klein"><thead><tr><th>Categorie</th><th class="getal">Normaal</th><th class="getal">Uitzondering</th></tr></thead>
        <tbody>${categorieen.map(catRij).join('')}</tbody></table></div>` : '<p class="zacht klein">Nog geen knelpunten geregistreerd.</p>'}</div>
    </div>
    <h4>Uitsplitsing per medewerker</h4>
    <div class="tabelhouder"><table class="klein">
      <thead><tr><th>MedewerkerID</th><th>Casustype</th><th class="getal">Metingen</th><th class="getal">Met knelpunt</th><th class="getal">Knelpunten</th><th class="getal">Extra actief (min, totaal)</th><th class="getal">Extra wacht (min, totaal)</th></tr></thead>
      <tbody>${mwRijen}</tbody></table></div>
    <div class="knoppen"><button type="button" class="klein" data-actie="knelpunten-bekijken">Alle knelpunten bekijken</button></div>`;
}

/** Herleidbaarheid: iedere knelpunt met proces, meting, stap, medewerker, datum, kalenderweek, meetwijze en casustype. */
function toonKnelpunten() {
  const procesId = $('#rProces').value;
  const filters = resultaatFilters();
  const rijen = alleKnelpuntRijen().filter(({ m }) => m.procesId === procesId && metingVoldoetAanFilters(m, { ...filters, procesId }));
  informeer(`Knelpunten – ${procesId}`, `<p class="klein">Filters: ${esc(filtersAlsTekst(filters))}</p>
    ${rijen.length ? `<div class="tabelhouder"><table class="klein"><thead><tr><th>MetingID</th><th>StapID</th><th>Medewerker</th><th>Datum / week</th><th>Casustype</th><th>Meetwijze</th><th>Categorie</th><th>Omschrijving</th><th>Gevolg</th><th class="getal">Extra actief</th><th class="getal">Extra wacht</th><th>Bron</th></tr></thead><tbody>
    ${rijen.map(({ m, s }) => `<tr><td class="mono">${esc(m.metingId)}${testLabel(m)}</td><td class="mono">${esc(s.stapId)}</td><td>${htmlTekst(m.medewerkerId)}</td><td>${esc(fmtDatum(m.datum))}<br><span class="zacht">${esc(kalenderweekTekst(m.datum, true))}</span></td>
      <td>${esc(m.casustype)}</td><td>${meetwijzeHtml(m.meetwijze)}</td><td>${htmlTekst(s.knelpuntCategorie)}</td><td>${esc(s.knelpuntOmschrijving || '')}</td><td>${esc((s.knelpuntGevolgen || []).join('; '))}</td>
      <td class="getal">${htmlGetal(s.knelpuntExtraActief)}</td><td class="getal">${htmlGetal(s.knelpuntExtraWacht)}</td><td>${htmlTekst(s.knelpuntBron)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="zacht">Geen knelpunten binnen de filters.</p>'}`);
}

/** Diensttijdblokken (informatief): telt niet mee in de tijdsbelasting, omdat die tijd al in de tijd per dossier zit. */
function blokkenHtml(procesId, filters, t) {
  const N = t.blokken;
  if (!blokkenVastleggen(procesId) && !isGetal(N.totaalBlokken)) return '';
  const e = t.eenheden;
  const U = blokkenAnalyse(procesSamenvatting(procesId, filters).metingen.filter((m) => m.casustype === 'Uitzondering'));
  const perTekst = t.periodeEenheid ? `per ${t.periodeEenheid.toLowerCase()}` : 'per periode';
  const cel = (d, dec, eenheid) => (isGetal(d.waarde) ? `${esc(fmtGetal(d.waarde, dec))} ${eenheid} <span class="klein zacht">(n = ${d.n})</span>` : `<span class="onbekend">${ONBEKEND}</span> <span class="klein zacht">(n = ${d.n})</span>`);
  const rij = (label, fn) => `<tr><th>${label}</th><td class="getal berekend">${fn(N)}</td><td class="getal berekend">${fn(U)}</td></tr>`;
  const verhoudingTekst = isGetal(N.verhouding.waarde)
    ? `${fmtAantal(N.verhouding.noemer)} ${N.verhouding.noemer === 1 ? e.omvangseenheid : e.omvangseenheidMeervoud} resulteerden in ${fmtAantal(N.verhouding.teller)} ${N.verhouding.teller === 1 ? 'diensttijdblok' : 'diensttijdblokken'}.`
    : '';
  return `
    <h4>Diensttijdblokken ${infoHtml('blokken')}</h4>
    <p class="klein zacht">Informatief. De geschatte actieve tijdsbelasting hierboven blijft <em>frequentie × actieve tijd per ${esc(e.uitvoeringseenheid)}</em>: de tijd voor de diensttijdblokken zit al in de tijd per ${esc(e.uitvoeringseenheid)} en wordt dus niet nog eens met het aantal blokken vermenigvuldigd.
      Alle gemiddelden zijn totaal ÷ totaal. Metingen zonder aantal blokken tellen alleen niet mee in de berekeningen per blok.</p>
    ${verhoudingTekst ? `<div class="melding info"><strong>${esc(verhoudingTekst)}</strong> <span class="klein">(normale gevallen; ${N.verhouding.n} meting(en) waarvan zowel het aantal ${esc(e.omvangseenheidMeervoud)} als het aantal blokken bekend is; verhouding ${esc(fmtGetal(N.verhouding.waarde, 2))} blok per ${esc(e.omvangseenheid)})</span></div>` : ''}
    <div class="tabelhouder"><table>
      <thead><tr><th></th><th class="getal">Normaal</th><th class="getal">Uitzondering</th></tr></thead>
      <tbody>
        ${rij('Gebruikte dossiermetingen', (g) => `${g.aantalMetingen} <span class="klein zacht">(waarvan ${g.metingenMetBlokken.length} met aantal blokken)</span>`)}
        ${rij(`Totaal beoordeelde ${esc(e.omvangseenheidMeervoud)}`, (g) => esc(fmtAantal(g.totaalOmvang)))}
        ${rij('Totaal resulterende diensttijdblokken', (g) => htmlAantal(g.totaalBlokken))}
        ${rij(`Gemiddeld aantal ${esc(e.omvangseenheidMeervoud)} per ${esc(e.uitvoeringseenheid)}`, (g) => cel(g.omvangPerDossier, 2, ''))}
        ${rij(`Gemiddeld aantal diensttijdblokken per ${esc(e.uitvoeringseenheid)}`, (g) => cel(g.blokkenPerDossier, 2, ''))}
        ${rij('Gemiddelde actieve tijd per diensttijdblok', (g) => cel(g.actiefPerBlok, 2, 'min'))}
        ${rij(`Verhouding diensttijdblokken ÷ ${esc(e.omvangseenheidMeervoud)}`, (g) => cel(g.verhouding, 3, ''))}
        <tr><th>Geschat aantal diensttijdblokken ${esc(perTekst)}</th><td class="getal berekend">${isGetal(t.blokkenPerPeriode) ? `<strong>${esc(fmtGetal(t.blokkenPerPeriode, 2))}</strong> <span class="klein">(${esc(fmtGetal(N.blokkenPerDossier.waarde, 2))} × ${esc(fmtAantal(t.totaleFrequentie))} ${esc(e.uitvoeringseenheidMeervoud)})</span>` : `<span class="onbekend">${ONBEKEND}</span>`}</td><td class="getal zacht klein">niet berekend (de frequentie hoort bij normale gevallen)</td></tr>
        ${rij('Gebruikte procesmeting-ID\'s', (g) => `<span class="mono klein">${esc(g.metingIds.join(', ') || '—')}</span>`)}
        ${rij('Meetwijze (bron)', (g) => esc(meetwijzeVerdelingTekst(g.meetwijzen)))}
      </tbody></table></div>
    <p class="klein">Bron frequentie: ${esc(t.bronnen.map(bronLabel).join('; ') || '—')} · Filters: ${esc(filtersAlsTekst(filters))}${t.weekSleutel ? ` · ${esc(kalenderweekSleutelTekst(t.weekSleutel))}` : ''}</p>`;
}

/** Herleidbaarheid van het totaaloverzicht: alle gebruikte procesmetingen en frequentiemetingen. */
function toonTotaalOnderliggend() {
  const procesId = $('#rProces').value;
  const filters = resultaatFilters();
  const t = berekenTotaalOverzicht(procesId, filters, kiesTotaalPeriode(procesId), kiesTotaalWeek(procesId));
  const e = t.eenheden;
  informeer(`Onderliggende gegevens totaaloverzicht – ${procesId}`, `
    <p class="klein">Frequentieperiode: ${t.periodeEenheid ? 'per ' + esc(t.periodeEenheid.toLowerCase()) : ONBEKEND} · Kalenderweek: ${t.weekSleutel ? esc(kalenderweekSleutelTekst(t.weekSleutel)) : 'alle'} · Keuze gemiddelde: ${esc(keuzeGemiddeldeTekst(filters))} (normale gevallen) · Filters: ${esc(filtersAlsTekst(filters))}</p>
    <h4>Gebruikte frequentiemetingen (${t.frequenties.length})</h4>
    ${t.frequenties.length ? `<div class="tabelhouder"><table class="klein"><thead><tr><th>FrequentieID</th><th>Medewerker</th><th>Bereik</th><th>Afbakening</th><th>Meetmoment</th><th class="getal">Aantal ${esc(e.uitvoeringseenheidMeervoud)}</th><th>Meetwijze / bron</th><th>Bron of toelichting</th></tr></thead><tbody>
      ${t.frequenties.map((f) => `<tr><td class="mono">${esc(f.frequentieId)}${testLabel(f)}</td><td>${htmlTekst(f.medewerkerId)}</td><td>${esc(f.bereik || '')}</td><td>${esc(f.afbakening || '')}</td><td>${f.meetdatum ? esc(kalenderweekTekst(f.meetdatum)) : htmlTekst(f.meetperiode)}</td><td class="getal">${htmlAantal(f.aantalUitvoeringen)}</td><td>${meetwijzeHtml(f.meetwijze)}</td><td>${esc(f.bron || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="zacht">Geen.</p>'}
    <h4>Gebruikte procesmetingen (${t.gebruikteMetingen.length})</h4>
    ${metingenTabelHtml(t.gebruikteMetingen, e)}`);
}

/** Tabel 'Resultaten per medewerker', apart voor normale gevallen en uitzonderingen. */
function medewerkerTabelHtml(procesId, filters, e) {
  const cel = (stat, veld) => (stat.n ? `${htmlGetal(stat[veld])} <span class="klein zacht">(n=${stat.n})</span>` : `<span class="onbekend">${ONBEKEND}</span> <span class="klein zacht">(n=0)</span>`);
  const rij = (label, g, extraKlasse, medewerkerId) => `<tr${extraKlasse ? ` class="${extraKlasse}"` : ''}>
      <td>${label}</td>
      <td class="getal">${g.aantal}</td>
      <td class="getal berekend">${cel(g.actief, 'gemiddelde')}</td>
      <td class="getal berekend">${cel(g.actief, 'minimum')}</td>
      <td class="getal berekend">${cel(g.actief, 'maximum')}</td>
      <td class="getal berekend">${cel(g.wacht, 'gemiddelde')}</td>
      <td class="getal berekend">${cel(g.omvang, 'gemiddelde')}</td>
      <td class="acties">${g.aantal ? `<button type="button" class="klein" data-actie="metingen-medewerker" data-medewerker="${esc(medewerkerId)}" data-casustype="${esc(g.casustype)}">Metingen (${g.aantal})</button>` : ''}</td>
    </tr>`;
  const blokken = CASUSTYPEN.map((c) => {
    const ms = medewerkerSamenvatting(procesId, filters, c);
    if (!ms.totaal.aantal) return c === 'Normaal' ? `<h4>Normale gevallen</h4><p class="zacht klein">Geen normale metingen binnen de filters.</p>` : '';
    const t = ms.totaal;
    return `<h4>${c === 'Normaal' ? 'Normale gevallen' : 'Uitzonderingen'}</h4>
      <p class="klein" style="margin:0 0 6px">Actief en wacht: minuten per ${esc(e.uitvoeringseenheid)}. Omvang: aantal ${esc(e.omvangseenheidMeervoud)} per ${esc(e.uitvoeringseenheid)}.</p>
      <div class="tabelhouder"><table>
        <thead><tr><th>MedewerkerID</th><th class="getal">Metingen</th>
          <th class="getal berekend">Gem. actief</th><th class="getal berekend">Min. actief</th><th class="getal berekend">Max. actief</th>
          <th class="getal berekend">Gem. wacht</th><th class="getal berekend">Gem. omvang</th><th></th></tr></thead>
        <tbody>
          ${ms.perMedewerker.map((g) => rij(`<strong>${esc(medewerkerLabel(g.medewerkerId))}</strong>`, { ...g, casustype: c }, filters.medewerker && (filters.medewerker === MEDEWERKER_LEEG ? '' : filters.medewerker) === g.medewerkerId ? 'gekozen' : '', g.medewerkerId || MEDEWERKER_LEEG)).join('')}
          ${rij('<strong>Alle medewerkers (gecombineerd)</strong>', { ...t, casustype: c }, 'totaalrij', '')}
        </tbody></table></div>
      <p class="klein">Bandbreedte actieve tijd per ${esc(e.uitvoeringseenheid)}, alle medewerkers: <strong>${t.actief.n ? `${esc(fmtGetal(t.actief.minimum))} – ${esc(fmtGetal(t.actief.maximum))} min` : ONBEKEND}</strong> (n = ${t.actief.n} metingen).</p>`;
  }).join('');
  return `<p class="klein zacht">Iedere waarde wordt eerst per individuele procesmeting berekend (actieve tijd en wachttijd per ${esc(e.uitvoeringseenheid)}; omvang per ${esc(e.uitvoeringseenheid)} = aantal ${esc(e.omvangseenheidMeervoud)} / aantal ${esc(e.uitvoeringseenheidMeervoud)}).
      De rij <em>Alle medewerkers</em> is berekend uit alle individuele metingen samen, niet uit de gemiddelden per medewerker. n = aantal metingen met een bekende waarde.
      Deze tabel toont altijd alle medewerkers (het medewerkerfilter geldt hier niet); meetwijze- en datumfilter gelden wel.</p>
    ${blokken}`;
}

/** Tabel met individuele procesmetingen en hun berekende waarden. */
function metingenTabelHtml(metingen, e) {
  if (!metingen.length) return '<p class="zacht">Geen metingen binnen de filters.</p>';
  return `<div class="tabelhouder"><table class="klein">
      <thead><tr><th>MetingID</th><th>Datum</th><th>Medewerker</th><th>Meetwijze</th><th class="getal">Aantal ${esc(e.uitvoeringseenheidMeervoud)}</th><th class="getal">Aantal ${esc(e.omvangseenheidMeervoud)}</th>
      <th class="getal berekend">Totaal actief (min)</th><th class="getal berekend">Actief per ${esc(e.uitvoeringseenheid)}</th><th class="getal berekend">Wacht per ${esc(e.uitvoeringseenheid)}</th><th class="getal berekend">Actief per ${esc(e.omvangseenheid)}</th></tr></thead>
      <tbody>${metingen.map((m) => {
        const b = berekenMeting(m);
        return `<tr><td class="mono">${esc(m.metingId)}${demoLabel(m)}${testLabel(m)}</td><td>${esc(fmtDatum(m.datum))} <span class="klein zacht">(${esc(kalenderweekTekst(m.datum, true))})</span></td><td>${htmlTekst(m.medewerkerId)}</td><td>${meetwijzeHtml(m.meetwijze)}</td><td class="getal">${htmlAantal(m.aantalUitvoeringen)}</td><td class="getal">${htmlAantal(m.omvang)}</td>
          <td class="getal berekend">${htmlGetal(b.totaalActief)}</td><td class="getal berekend">${htmlGetal(b.actiefPerUitvoering)}</td><td class="getal berekend">${htmlGetal(b.wachtPerUitvoering)}</td><td class="getal berekend">${htmlGetal(b.actiefPerOmvang)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
}

function toonMetingenVanMedewerker(medewerker, casustype) {
  const procesId = $('#rProces').value;
  const filters = { ...resultaatFilters(), medewerker };
  const sam = procesSamenvatting(procesId, filters);
  const e = eenhedenVoorResultaat(procesId, sam.metingen);
  const metingen = sam.metingen.filter((m) => m.casustype === casustype);
  const naam = medewerker ? medewerkerLabel(medewerker === MEDEWERKER_LEEG ? '' : medewerker) : 'alle medewerkers';
  informeer(`Individuele metingen – ${procesId} – ${naam} – ${casustype}`, `<p class="klein">Filters: ${esc(filtersAlsTekst(filters))}</p>${metingenTabelHtml(metingen, e)}`);
}

function tijdsbelastingHtml(procesId, freq, belasting, e) {
  const lijst = frequentiesVanProces(procesId);
  const keuze = lijst.length
    ? `<div class="veld" style="max-width:520px"><label for="rFrequentie">Gebruikte frequentiemeting</label>
        <select id="rFrequentie">${lijst.map((f) => `<option value="${esc(f.frequentieId)}" ${freq && f.frequentieId === freq.frequentieId ? 'selected' : ''}>${esc(f.frequentieId)} – ${esc(f.meetperiode)} – ${esc(f.meetwijze)}${f.demo ? ' [DEMO]' : ''}</option>`).join('')}</select></div>`
    : '';
  if (!isGetal(belasting.waarde)) {
    return `${keuze}<div class="melding neutraal mt"><strong>Niet berekend: er ontbreekt invoer.</strong><ul>${belasting.ontbreekt.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>`;
  }
  const f = belasting.frequentie;
  return `${keuze}
    <div class="berekend-kader mt">
      <span class="etiket berekend">Automatisch berekend</span>
      <div class="formule">Geschatte actieve tijd per meetperiode = aantal ${esc(e.uitvoeringseenheidMeervoud)} in de meetperiode × mediaan actieve tijd per ${esc(e.uitvoeringseenheid)}<br>
        = ${esc(fmtAantal(belasting.aantalUitvoeringen))} × ${esc(fmtGetal(belasting.mediaan))} min = <strong>${esc(fmtGetal(belasting.waarde))} min</strong> (${esc(fmtGetal(belasting.waarde / 60, 2))} uur)</div>
      <dl class="gegevens">
        <dt>Gebruikte frequentiemeting</dt><dd>${esc(f.frequentieId)}${demoLabel(f)} – meetperiode: ${esc(f.meetperiode)}</dd>
        <dt>Aantal ${esc(e.uitvoeringseenheidMeervoud)} in meetperiode</dt><dd>${esc(fmtAantal(f.aantalUitvoeringen))}</dd>
        <dt>Totaal aantal ${esc(e.omvangseenheidMeervoud)} in meetperiode</dt><dd>${htmlAantal(f.totaalVolume)} <span class="klein zacht">(informatief; niet gebruikt in deze berekening)</span></dd>
        <dt>Meetwijze frequentie</dt><dd>${meetwijzeHtml(f.meetwijze)}${f.bron ? ' – ' + esc(f.bron) : ''}</dd>
        <dt>Gebruikte mediaan</dt><dd>${esc(fmtGetal(belasting.mediaan))} min: mediaan actieve tijd per ${esc(e.uitvoeringseenheid)} van de normale gevallen (n = ${belasting.n})</dd>
        <dt>MetingID's onder de mediaan</dt><dd class="mono">${esc(belasting.metingIds.join(', '))}</dd>
      </dl>
      <p class="klein">Uitzonderingen zijn niet in deze mediaan meegenomen. De meetwijzen van tijd en frequentie zijn hierboven afzonderlijk vermeld.</p>
    </div>`;
}

function stapResultatenHtml(procesId, filters, e) {
  const rijen = stapSamenvatting(procesId, filters, resultaatCasustype);
  if (!rijen.length) return '<p class="zacht mt">Er zijn geen processtappen of stapmetingen voor dit proces.</p>';
  const body = rijen.map((r) => `<tr>
      <td class="mono">${esc(r.stapId)}</td>
      <td>${esc(r.naam)}${r.bestaatNog ? '' : ' <span class="zacht klein">(niet meer in proces)</span>'}</td>
      <td class="getal berekend">${r.actief.n}</td>
      <td class="getal berekend"><strong>${htmlGetal(r.actief.mediaan)}</strong></td>
      <td class="getal berekend">${htmlGetal(r.actief.gemiddelde)}</td>
      <td class="getal berekend">${htmlGetal(r.actief.minimum)}</td>
      <td class="getal berekend">${htmlGetal(r.actief.maximum)}</td>
      <td class="getal berekend">${r.wacht.n}</td>
      <td class="getal berekend"><strong>${htmlGetal(r.wacht.mediaan)}</strong></td>
      <td class="getal berekend">${htmlGetal(r.wacht.gemiddelde)}</td>
      <td class="getal berekend">${htmlGetal(r.percentageMetWacht, 1, '%')}${r.aantalBekendeWacht ? ` <span class="klein">(${r.aantalMetWacht}/${r.aantalBekendeWacht})</span>` : ''}</td>
    </tr>`).join('');
  return `
    <p class="klein zacht mt">Casustype: <strong>${esc(resultaatCasustype)}</strong>. Tijden in minuten per ${esc(e.uitvoeringseenheid)}: stapwaarde gedeeld door het aantal ${esc(e.uitvoeringseenheidMeervoud)} van de meting. n = aantal waarnemingen met een bekende waarde.</p>
    <div class="tabelhouder"><table>
      <thead><tr><th>StapID</th><th>Processtap</th><th class="getal">n actief</th><th class="getal">Mediaan actief per ${esc(e.uitvoeringseenheid)}</th><th class="getal">Gemiddelde actief</th><th class="getal">Min. actief</th><th class="getal">Max. actief</th>
      <th class="getal">n wacht</th><th class="getal">Mediaan wacht per ${esc(e.uitvoeringseenheid)}</th><th class="getal">Gemiddelde wacht</th><th class="getal">Metingen met wachttijd</th></tr></thead>
      <tbody>${body}</tbody></table></div>
    <h4>Grafiek</h4>
    <div class="grafiekhouder"><canvas id="rGrafiek" width="1000" height="560" role="img" aria-label="Staafgrafiek met mediane actieve tijd en wachttijd per processtap"></canvas></div>
    <div class="knoppen"><button type="button" data-actie="grafiek-png">Grafiek downloaden als PNG (hoge resolutie)</button></div>`;
}

function grafiekGegevens(procesId, filters) {
  const rijen = stapSamenvatting(procesId, filters, resultaatCasustype);
  const sam = procesSamenvatting(procesId, filters);
  const groep = MEETWIJZE_GROEPEN.find((g) => g.code === filters.meetwijze);
  const e = eenhedenVoorResultaat(procesId, sam.metingen);
  const periode = filters.van || filters.tot ? `${filters.van ? fmtDatum(filters.van) : '…'} t/m ${filters.tot ? fmtDatum(filters.tot) : '…'}` : 'alle datums';
  return {
    titel: `${procesLabel(procesId)}: mediane tijd per processtap`,
    ondertitels: [
      `Casustype: ${resultaatCasustype} · ${sam.perCasustype[resultaatCasustype].aantal} procesmetingen · Medewerker: ${filters.medewerker ? medewerkerLabel(filters.medewerker === MEDEWERKER_LEEG ? '' : filters.medewerker) : 'alle'} · Meetwijze: ${groep ? groep.label : 'alle meetwijzen (' + meetwijzeVerdelingTekst(sam.perCasustype[resultaatCasustype].meetwijzen) + ')'} · Periode: ${periode}`,
      `Minuten per ${e.uitvoeringseenheid} (mediaan; één uitvoering = één ${e.uitvoeringseenheid}); n = aantal waarnemingen per stap. Test/fictieve metingen: ${filters.metTest ? 'meegenomen' : 'uitgesloten'}.`,
    ],
    asLabel: `Minuten per ${e.uitvoeringseenheid} (mediaan)`,
    voetnoot: `Bron: Meettool ${VERSIE} · ${fmtDatum(vandaagIso())} · Ontbrekende waarden zijn niet als nul meegeteld.${bevatDemo() ? ' · BEVAT DEMOGEGEVENS' : ''}`,
    stappen: rijen.map((r) => ({ stapId: r.stapId, naam: r.naam, actief: r.actief.mediaan, wacht: r.wacht.mediaan, nActief: r.actief.n, nWacht: r.wacht.n })),
  };
}

function downloadGrafiekPng() {
  const procesId = $('#rProces').value;
  if (!procesId) return;
  const filters = resultaatFilters();
  grafiekNaarPng(grafiekGegevens(procesId, filters), `Grafiek_${procesId}_${resultaatCasustype}${bevatDemo() ? '_MET-DEMOGEGEVENS' : ''}_${bestandsdatum()}.png`);
}

function toonOnderliggendeMetingen(casustype) {
  const procesId = $('#rProces').value;
  const filters = resultaatFilters();
  const sam = procesSamenvatting(procesId, filters);
  const g = sam.perCasustype[casustype];
  const e = eenhedenVoorResultaat(procesId, sam.metingen);
  const metingen = sam.metingen.filter((m) => m.casustype === casustype);
  const tabel = metingenTabelHtml(metingen, e);
  const labels = {
    actiefPerUitvoering: `Actieve tijd per ${e.uitvoeringseenheid} (primair)`,
    wachtPerUitvoering: `Wachttijd per ${e.uitvoeringseenheid}`,
    actiefPerOmvang: `Actieve tijd per ${e.omvangseenheid} (aanvullend)`,
  };
  const uitgesloten = Object.entries(labels).map(([k, titel]) => (g.uitgesloten[k].length
    ? `<li>${esc(titel)}: ${g.uitgesloten[k].map((u) => `<span class="mono">${esc(u.metingId)}</span> (${esc(u.reden)})`).join('; ')}</li>` : '')).join('');
  informeer(`Onderliggende metingen – ${procesId} – ${casustype}`, `
    <p class="klein">Filters: ${esc(filtersAlsTekst(filters))}</p>
    <dl class="gegevens klein">
      ${Object.entries(labels).map(([k, titel]) => `<dt>${esc(titel)} (n = ${g[k].n})</dt><dd class="mono">${esc(g[k].metingIds.join(', ') || '—')}</dd>`).join('')}
    </dl>
    ${uitgesloten ? `<div class="melding neutraal mt"><strong>Niet meegenomen (waarde Onbekend):</strong><ul>${uitgesloten}</ul></div>` : ''}
    <h4>Metingen</h4>${tabel}`);
}
