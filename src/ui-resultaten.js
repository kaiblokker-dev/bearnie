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

function eenheidVanProces(procesId, groepen) {
  const p = zoekProces(procesId);
  if (p) return p.eenheid;
  const e = uniek(groepen.flatMap((g) => g.eenheden));
  return e[0] || 'eenheid';
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
  const eenheid = eenheidVanProces(procesId, [N, U]);
  const freq = kiesFrequentie(procesId);
  const belasting = berekenTijdsbelasting(freq, N);

  const meldingen = [];
  meldingen.push(`<div class="melding info"><strong>Beschikbaar binnen de filters:</strong> ${sam.aantal} procesmetingen (${N.aantal} normaal, ${U.aantal} uitzondering).
    Meetwijzen: ${esc(meetwijzeVerdelingTekst(sam.meetwijzen))}. <span class="klein">Filters: ${esc(filtersAlsTekst(filters))}.</span></div>`);
  if (filters.meetwijze === 'alle' && Object.keys(sam.meetwijzen).length > 1) {
    meldingen.push(`<div class="melding waarschuwing"><strong>Let op: verschillende meetwijzen gecombineerd.</strong> Deze resultaten combineren ${esc(meetwijzeVerdelingTekst(sam.meetwijzen))}. Kies bij <em>Meetwijze</em> één meetwijze om ze afzonderlijk te bekijken.</div>`);
  }
  if (sam.aantal < 3 || (N.aantal > 0 && N.aantal < 3) || (U.aantal > 0 && U.aantal < 3)) {
    meldingen.push('<div class="melding neutraal">Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig.</div>');
  }
  const eenhedenGemengd = uniek([...N.eenheden, ...U.eenheden]);
  if (eenhedenGemengd.length > 1) {
    meldingen.push(`<div class="melding waarschuwing">Let op: de metingen gebruiken verschillende eenheden (${esc(eenhedenGemengd.join(', '))}). Tijd per eenheid is daardoor niet goed vergelijkbaar.</div>`);
  }

  const tegel = (titel, waardeHtml, toelichting) => `<div class="tegel"><div class="titel">${titel}</div><div class="waarde${waardeHtml.includes('onbekend') ? ' onbekend' : ''}">${waardeHtml}</div><div class="toelichting">${toelichting}</div></div>`;
  const tegels = [
    tegel('Normale metingen', String(N.aantal), 'aantal procesmetingen'),
    tegel('Uitzonderingen', String(U.aantal), 'aantal procesmetingen'),
    tegel('Mediane actieve tijd per uitvoering', htmlGetal(N.actief.mediaan, 2, ' min'), `normale gevallen, n = ${N.actief.n}`),
    tegel('Mediane actieve tijd per eenheid', htmlGetal(N.actiefPerEenheid.mediaan, 2, ' min'), `per ${esc(eenheid)}, normale gevallen, n = ${N.actiefPerEenheid.n}`),
    tegel('Mediane wachttijd', htmlGetal(N.wacht.mediaan, 2, ' min'), `per uitvoering, normale gevallen, n = ${N.wacht.n}`),
    tegel('Geschatte tijdsbelasting per meetperiode', isGetal(belasting.waarde) ? esc(fmtGetal(belasting.waarde, 1) + ' min') : `<span class="onbekend">${ONBEKEND}</span>`,
      isGetal(belasting.waarde) ? `${esc(fmtGetal(belasting.waarde / 60, 1))} uur · ${esc(freq.meetperiode)}` : 'zie toelichting hieronder'),
  ].join('');

  inhoud.innerHTML = `
    ${meldingen.join('')}
    <div class="tegels">${tegels}</div>
    <div class="kaart">
      <h3>Samenvatting per casustype</h3>
      <p class="klein zacht">Tijden in minuten per uitvoering van het proces, tenzij anders vermeld. Normale gevallen en uitzonderingen worden afzonderlijk berekend. Alleen metingen met een volledig bekende waarde tellen mee (n).</p>
      ${samenvattingTabelHtml(N, U, eenheid)}
    </div>
    <div class="kaart">
      <h3>Frequentie en geschatte tijdsbelasting</h3>
      ${tijdsbelastingHtml(procesId, freq, belasting)}
    </div>
    <div class="kaart">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h3 style="margin:0">Resultaten per processtap</h3>
        <div class="subtabs" style="margin:0" id="rCasustypeKeuze">
          ${CASUSTYPEN.map((c) => `<button type="button" data-casustype="${c}" class="${c === resultaatCasustype ? 'actief' : ''}">${c === 'Normaal' ? 'Normale gevallen' : 'Uitzonderingen'}</button>`).join('')}
        </div>
      </div>
      ${stapResultatenHtml(procesId, filters)}
    </div>`;

  $('#rCasustypeKeuze').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-casustype]');
    if (!b) return;
    resultaatCasustype = b.dataset.casustype;
    renderResultaten();
  });
  const canvas = $('#rGrafiek');
  if (canvas) tekenGrafiek(canvas, grafiekGegevens(procesId, filters), Math.max(1, window.devicePixelRatio || 1));
}

function samenvattingTabelHtml(N, U, eenheid) {
  const rij = (label, fn, dec = 2) => `<tr><th>${label}</th><td class="getal berekend">${fn(N, dec)}</td><td class="getal berekend">${fn(U, dec)}</td></tr>`;
  const st = (sleutel, veld) => (g, dec) => htmlGetal(g[sleutel][veld], dec);
  const nVan = (sleutel) => (g) => String(g[sleutel].n);
  return `<div class="tabelhouder"><table>
    <thead><tr><th></th><th class="getal">Normaal</th><th class="getal">Uitzondering</th></tr></thead>
    <tbody>
      ${rij('Aantal metingen', (g) => String(g.aantal))}
      <tr><th colspan="3" class="zacht">Actieve tijd per uitvoering (min)</th></tr>
      ${rij('&nbsp;&nbsp;Gebruikte metingen (n)', nVan('actief'))}
      ${rij('&nbsp;&nbsp;<strong>Mediaan</strong>', st('actief', 'mediaan'))}
      ${rij('&nbsp;&nbsp;Gemiddelde', st('actief', 'gemiddelde'))}
      ${rij('&nbsp;&nbsp;Minimum', st('actief', 'minimum'))}
      ${rij('&nbsp;&nbsp;Maximum', st('actief', 'maximum'))}
      <tr><th colspan="3" class="zacht">Wachttijd per uitvoering (min)</th></tr>
      ${rij('&nbsp;&nbsp;Gebruikte metingen (n)', nVan('wacht'))}
      ${rij('&nbsp;&nbsp;<strong>Mediaan</strong>', st('wacht', 'mediaan'))}
      ${rij('&nbsp;&nbsp;Gemiddelde', st('wacht', 'gemiddelde'))}
      <tr><th colspan="3" class="zacht">Actieve tijd per eenheid (min per ${esc(eenheid)})</th></tr>
      ${rij('&nbsp;&nbsp;Gebruikte metingen (n)', nVan('actiefPerEenheid'))}
      ${rij('&nbsp;&nbsp;<strong>Mediaan</strong>', st('actiefPerEenheid', 'mediaan'))}
      ${rij('&nbsp;&nbsp;Gemiddelde', st('actiefPerEenheid', 'gemiddelde'))}
      <tr><th></th>
        <td class="rechts"><button type="button" class="klein" data-actie="onderliggende-metingen" data-casustype="Normaal">Onderliggende metingen bekijken</button></td>
        <td class="rechts"><button type="button" class="klein" data-actie="onderliggende-metingen" data-casustype="Uitzondering">Onderliggende metingen bekijken</button></td>
      </tr>
    </tbody></table></div>`;
}

function tijdsbelastingHtml(procesId, freq, belasting) {
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
      <div class="formule">Geschatte actieve tijd per meetperiode = aantal uitvoeringen × mediaan actieve tijd per uitvoering<br>
        = ${esc(fmtAantal(belasting.aantalUitvoeringen))} × ${esc(fmtGetal(belasting.mediaan))} min = <strong>${esc(fmtGetal(belasting.waarde))} min</strong> (${esc(fmtGetal(belasting.waarde / 60, 2))} uur)</div>
      <dl class="gegevens">
        <dt>Gebruikte frequentiemeting</dt><dd>${esc(f.frequentieId)}${demoLabel(f)} – meetperiode: ${esc(f.meetperiode)}</dd>
        <dt>Meetwijze frequentie</dt><dd>${meetwijzeHtml(f.meetwijze)}${f.bron ? ' – ' + esc(f.bron) : ''}</dd>
        <dt>Gebruikte mediaan</dt><dd>${esc(fmtGetal(belasting.mediaan))} min: mediaan actieve tijd per uitvoering van de normale gevallen (n = ${belasting.n})</dd>
        <dt>MetingID's onder de mediaan</dt><dd class="mono">${esc(belasting.metingIds.join(', '))}</dd>
      </dl>
      <p class="klein">Uitzonderingen zijn niet in deze mediaan meegenomen. De meetwijzen van tijd en frequentie zijn hierboven afzonderlijk vermeld.</p>
    </div>`;
}

function stapResultatenHtml(procesId, filters) {
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
      <td class="getal berekend">${htmlGetal(r.percentageMetWacht, 1, '%')}${r.wacht.n ? ` <span class="klein">(${r.aantalMetWacht}/${r.wacht.n})</span>` : ''}</td>
    </tr>`).join('');
  return `
    <p class="klein zacht mt">Casustype: <strong>${esc(resultaatCasustype)}</strong>. Tijden in minuten per uitvoering van de processtap. n = aantal waarnemingen met een bekende waarde.</p>
    <div class="tabelhouder"><table>
      <thead><tr><th>StapID</th><th>Processtap</th><th class="getal">n actief</th><th class="getal">Mediaan actief</th><th class="getal">Gemiddelde actief</th><th class="getal">Min. actief</th><th class="getal">Max. actief</th>
      <th class="getal">n wacht</th><th class="getal">Mediaan wacht</th><th class="getal">Gemiddelde wacht</th><th class="getal">Metingen met wachttijd</th></tr></thead>
      <tbody>${body}</tbody></table></div>
    <h4>Grafiek</h4>
    <div class="grafiekhouder"><canvas id="rGrafiek" width="1000" height="560" role="img" aria-label="Staafgrafiek met mediane actieve tijd en wachttijd per processtap"></canvas></div>
    <div class="knoppen"><button type="button" data-actie="grafiek-png">Grafiek downloaden als PNG (hoge resolutie)</button></div>`;
}

function grafiekGegevens(procesId, filters) {
  const rijen = stapSamenvatting(procesId, filters, resultaatCasustype);
  const sam = procesSamenvatting(procesId, filters);
  const groep = MEETWIJZE_GROEPEN.find((g) => g.code === filters.meetwijze);
  const periode = filters.van || filters.tot ? `${filters.van ? fmtDatum(filters.van) : '…'} t/m ${filters.tot ? fmtDatum(filters.tot) : '…'}` : 'alle datums';
  return {
    titel: `${procesLabel(procesId)}: mediane tijd per processtap`,
    ondertitels: [
      `Casustype: ${resultaatCasustype} · ${sam.perCasustype[resultaatCasustype].aantal} procesmetingen · Meetwijze: ${groep ? groep.label : 'alle meetwijzen (' + meetwijzeVerdelingTekst(sam.perCasustype[resultaatCasustype].meetwijzen) + ')'} · Periode: ${periode}`,
      'Minuten per uitvoering van de processtap (mediaan); n = aantal waarnemingen per stap.',
    ],
    asLabel: 'Minuten per uitvoering (mediaan)',
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
  const eenheid = eenheidVanProces(procesId, [g]);
  const metingen = sam.metingen.filter((m) => m.casustype === casustype);
  const tabel = metingen.length ? `<div class="tabelhouder"><table class="klein">
      <thead><tr><th>MetingID</th><th>Datum</th><th>Meetwijze</th><th class="getal">Omvang</th><th class="getal berekend">Actief (min)</th><th class="getal berekend">Wacht (min)</th><th class="getal berekend">Actief per ${esc(eenheid)}</th></tr></thead>
      <tbody>${metingen.map((m) => {
        const b = berekenMeting(m);
        return `<tr><td class="mono">${esc(m.metingId)}${demoLabel(m)}</td><td>${esc(fmtDatum(m.datum))}</td><td>${meetwijzeHtml(m.meetwijze)}</td><td class="getal">${htmlAantal(m.omvang)}</td>
          <td class="getal berekend">${htmlGetal(b.totaalActief)}</td><td class="getal berekend">${htmlGetal(b.totaalWacht)}</td><td class="getal berekend">${htmlGetal(b.actiefPerEenheid)}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="zacht">Geen metingen binnen de filters.</p>';
  const lijstUitgesloten = (titel, lijst) => lijst.length
    ? `<li>${titel}: ${lijst.map((u) => `<span class="mono">${esc(u.metingId)}</span> (${esc(u.reden)})`).join('; ')}</li>` : '';
  const uitgesloten = [
    lijstUitgesloten('Actieve tijd', g.uitgesloten.actief),
    lijstUitgesloten('Wachttijd', g.uitgesloten.wacht),
    lijstUitgesloten('Actieve tijd per eenheid', g.uitgesloten.actiefPerEenheid),
  ].join('');
  informeer(`Onderliggende metingen – ${procesId} – ${casustype}`, `
    <p class="klein">Filters: ${esc(filtersAlsTekst(filters))}</p>
    <dl class="gegevens klein">
      <dt>Actieve tijd (n = ${g.actief.n})</dt><dd class="mono">${esc(g.actief.metingIds.join(', ') || '—')}</dd>
      <dt>Wachttijd (n = ${g.wacht.n})</dt><dd class="mono">${esc(g.wacht.metingIds.join(', ') || '—')}</dd>
      <dt>Actieve tijd per eenheid (n = ${g.actiefPerEenheid.n})</dt><dd class="mono">${esc(g.actiefPerEenheid.metingIds.join(', ') || '—')}</dd>
    </dl>
    ${uitgesloten ? `<div class="melding neutraal mt"><strong>Niet meegenomen (waarde Onbekend):</strong><ul>${uitgesloten}</ul></div>` : ''}
    <h4>Metingen</h4>${tabel}`);
}
