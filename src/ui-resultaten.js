// ---------- 5. Resultaten ----------

let resultaatCasustype = 'Normaal';
const gekozenFrequentie = {}; // per ProcesID het gekozen FrequentieID

function initResultaten() {
  vulSelect($('#rMeetwijze'), [{ waarde: 'alle', label: 'Alle meetwijzen (gemengd, wordt vermeld)' }, ...MEETWIJZE_GROEPEN.map((g) => ({ waarde: g.code, label: g.label }))], 'alle');
  for (const id of ['#rProces', '#rMeetwijze', '#rVan', '#rTot']) $(id).addEventListener('change', renderResultaten);
  $('#resultatenInhoud').addEventListener('change', (e) => {
    if (e.target.id === 'rFrequentie') {
      gekozenFrequentie[$('#rProces').value] = e.target.value;
      renderResultaten();
    }
  });
}

function resultaatFilters() {
  return { meetwijze: $('#rMeetwijze').value || 'alle', van: $('#rVan').value, tot: $('#rTot').value };
}

function kiesFrequentie(procesId) {
  const lijst = frequentiesVanProces(procesId);
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
  const filters = resultaatFilters();
  const sam = procesSamenvatting(procesId, filters);
  const N = sam.perCasustype.Normaal;
  const U = sam.perCasustype.Uitzondering;
  const e = eenhedenVoorResultaat(procesId, sam.metingen);
  const freq = kiesFrequentie(procesId);
  const belasting = berekenTijdsbelasting(freq, N, procesId);

  const meldingen = [legacyMeldingHtml(procesId)];
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
      <h3>Frequentie en geschatte tijdsbelasting</h3>
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
      `Casustype: ${resultaatCasustype} · ${sam.perCasustype[resultaatCasustype].aantal} procesmetingen · Meetwijze: ${groep ? groep.label : 'alle meetwijzen (' + meetwijzeVerdelingTekst(sam.perCasustype[resultaatCasustype].meetwijzen) + ')'} · Periode: ${periode}`,
      `Minuten per ${e.uitvoeringseenheid} (mediaan; één uitvoering = één ${e.uitvoeringseenheid}); n = aantal waarnemingen per stap.`,
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
  const tabel = metingen.length ? `<div class="tabelhouder"><table class="klein">
      <thead><tr><th>MetingID</th><th>Datum</th><th>Meetwijze</th><th class="getal">Aantal ${esc(e.uitvoeringseenheidMeervoud)}</th><th class="getal">Aantal ${esc(e.omvangseenheidMeervoud)}</th>
      <th class="getal berekend">Totaal actief (min)</th><th class="getal berekend">Actief per ${esc(e.uitvoeringseenheid)}</th><th class="getal berekend">Wacht per ${esc(e.uitvoeringseenheid)}</th><th class="getal berekend">Actief per ${esc(e.omvangseenheid)}</th></tr></thead>
      <tbody>${metingen.map((m) => {
        const b = berekenMeting(m);
        return `<tr><td class="mono">${esc(m.metingId)}${demoLabel(m)}</td><td>${esc(fmtDatum(m.datum))}</td><td>${meetwijzeHtml(m.meetwijze)}</td><td class="getal">${htmlAantal(m.aantalUitvoeringen)}</td><td class="getal">${htmlAantal(m.omvang)}</td>
          <td class="getal berekend">${htmlGetal(b.totaalActief)}</td><td class="getal berekend">${htmlGetal(b.actiefPerUitvoering)}</td><td class="getal berekend">${htmlGetal(b.wachtPerUitvoering)}</td><td class="getal berekend">${htmlGetal(b.actiefPerOmvang)}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="zacht">Geen metingen binnen de filters.</p>';
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
