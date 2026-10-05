// ---------- 4. Metingen bekijken ----------

let overzichtSubtab = 'procesmetingen';
const uitgeklapteMetingen = new Set();

function initOverzicht() {
  $('#overzichtSubtabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-subtab]');
    if (!b) return;
    overzichtSubtab = b.dataset.subtab;
    for (const x of $$('#overzichtSubtabs button')) x.classList.toggle('actief', x === b);
    $('#ozMeetwijze').value = '';
    renderOverzicht();
  });
  for (const id of ['#ozZoek', '#ozProces', '#ozVan', '#ozTot', '#ozMedewerker', '#ozCasustype', '#ozMeetwijze']) {
    $(id).addEventListener('input', renderOverzichtTabel);
    $(id).addEventListener('change', renderOverzichtTabel);
  }
}

function overzichtFilters() {
  return {
    zoek: $('#ozZoek').value.trim().toLowerCase(),
    procesId: $('#ozProces').value,
    van: $('#ozVan').value,
    tot: $('#ozTot').value,
    medewerker: $('#ozMedewerker').value,
    casustype: $('#ozCasustype').value,
    meetwijze: $('#ozMeetwijze').value,
  };
}

function wisOverzichtFilters() {
  for (const id of ['#ozZoek', '#ozProces', '#ozVan', '#ozTot', '#ozMedewerker', '#ozCasustype', '#ozMeetwijze']) $(id).value = '';
  renderOverzichtTabel();
}

function renderOverzicht() {
  const isFreq = overzichtSubtab === 'frequentiemetingen';
  for (const el of $$('#overzichtFilters [data-filter]')) el.hidden = isFreq;
  vulSelect($('#ozProces'), alleProcesIds().map((id) => ({ waarde: id, label: procesLabel(id) })), $('#ozProces').value, 'Alle processen');
  const medewerkers = uniek(staat.procesmetingen.map((m) => m.medewerkerId || '')).filter(Boolean).sort(vergelijkTekst);
  const huidigeMedewerker = $('#ozMedewerker').value;
  vulSelect($('#ozMedewerker'), [...medewerkers, { waarde: '__leeg__', label: '(niet ingevuld)' }], huidigeMedewerker, 'Alle medewerkers');
  vulSelect($('#ozCasustype'), CASUSTYPEN, $('#ozCasustype').value, 'Alle casustypen');
  vulSelect($('#ozMeetwijze'), isFreq ? MEETWIJZEN_FREQUENTIE : MEETWIJZEN_METING, $('#ozMeetwijze').value, 'Alle meetwijzen');
  renderOverzichtTabel();
}

function metingVoldoetAanOverzicht(m, f) {
  if (f.procesId && m.procesId !== f.procesId) return false;
  if (f.van && (!m.datum || m.datum < f.van)) return false;
  if (f.tot && (!m.datum || m.datum > f.tot)) return false;
  if (f.medewerker === '__leeg__' && m.medewerkerId) return false;
  if (f.medewerker && f.medewerker !== '__leeg__' && m.medewerkerId !== f.medewerker) return false;
  if (f.casustype && m.casustype !== f.casustype) return false;
  if (f.meetwijze && m.meetwijze !== f.meetwijze) return false;
  return true;
}

function bevatZoekterm(waarden, zoek) {
  if (!zoek) return true;
  return waarden.some((w) => w !== null && w !== undefined && String(typeof w === 'number' ? naarInvoer(w) : w).toLowerCase().includes(zoek));
}

function renderOverzichtTabel() {
  const f = overzichtFilters();
  if (overzichtSubtab === 'procesmetingen') renderProcesmetingenTabel(f);
  else if (overzichtSubtab === 'stapmetingen') renderStapmetingenTabel(f);
  else renderFrequentiesTabel(f);
}

function renderProcesmetingenTabel(f) {
  const lijst = staat.procesmetingen
    .filter((m) => metingVoldoetAanOverzicht(m, f))
    .filter((m) => bevatZoekterm([m.metingId, m.datum, fmtDatum(m.datum), m.procesId, m.procesnaam, m.medewerkerId, m.casustype, m.omvang, m.eenheid, m.meetwijze, m.toelichting,
      ...stapmetingenVan(m.metingId).flatMap((s) => [s.stapId, s.stapnaam, s.redenWachttijd, s.opmerking])], f.zoek))
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)) || vergelijkTekst(b.metingId, a.metingId));
  $('#overzichtTelling').textContent = `${lijst.length} van ${staat.procesmetingen.length} procesmetingen`;
  if (!lijst.length) { $('#overzichtTabel').innerHTML = '<p class="zacht">Geen procesmetingen gevonden.</p>'; return; }
  const rijen = lijst.map((m) => {
    const b = berekenMeting(m);
    const open = uitgeklapteMetingen.has(m.metingId);
    const stappen = stapmetingenVan(m.metingId);
    let html = `<tr>
      <td><button type="button" class="klein" data-actie="meting-uitklappen" data-id="${esc(m.metingId)}" aria-expanded="${open}" title="Stapmetingen tonen of verbergen">${open ? '▾' : '▸'} ${stappen.length}</button></td>
      <td class="mono">${esc(m.metingId)}${demoLabel(m)}</td>
      <td>${esc(fmtDatum(m.datum))}</td>
      <td>${esc(m.procesId)}${zoekProces(m.procesId) ? '' : ' <span class="zacht klein">(verwijderd)</span>'}</td>
      <td>${htmlTekst(m.medewerkerId)}</td>
      <td>${esc(m.casustype)}</td>
      <td class="getal">${htmlAantal(m.omvang)}</td>
      <td>${htmlTekst(m.eenheid)}</td>
      <td>${meetwijzeHtml(m.meetwijze)}</td>
      <td class="getal berekend">${htmlGetal(b.totaalActief)}</td>
      <td class="getal berekend">${htmlGetal(b.totaalWacht)}</td>
      <td class="getal berekend">${htmlGetal(b.actiefPerEenheid)}</td>
      <td class="acties">
        <button type="button" class="klein" data-actie="meting-openen" data-id="${esc(m.metingId)}">Openen</button>
        <button type="button" class="klein" data-actie="meting-bewerken" data-id="${esc(m.metingId)}">Aanpassen</button>
        <button type="button" class="klein gevaar" data-actie="meting-verwijderen" data-id="${esc(m.metingId)}">Verwijderen</button>
      </td>
    </tr>`;
    if (open) {
      html += `<tr class="subrij"><td colspan="13">${stapmetingenMiniTabel(stappen)}</td></tr>`;
    }
    return html;
  }).join('');
  $('#overzichtTabel').innerHTML = `<table>
    <thead><tr><th>Stappen</th><th>MetingID</th><th>Datum</th><th>ProcesID</th><th>Medewerker</th><th>Casustype</th><th class="getal">Omvang</th><th>Eenheid</th><th>Meetwijze</th>
    <th class="getal berekend">Totale actieve tijd (min)</th><th class="getal berekend">Totale wachttijd (min)</th><th class="getal berekend">Actief per eenheid (min)</th><th></th></tr></thead>
    <tbody>${rijen}</tbody></table>`;
}

function stapmetingenMiniTabel(stappen) {
  if (!stappen.length) return '<span class="zacht">Geen stapmetingen.</span>';
  return `<table class="klein"><thead><tr><th>StapID</th><th>Processtap</th><th class="getal">Actieve tijd (min)</th><th class="getal">Wachttijd (min)</th><th>Reden wachttijd</th><th>Opmerking</th><th>Tijdvastlegging</th></tr></thead><tbody>
    ${stappen.map((s) => `<tr><td class="mono">${esc(s.stapId)}</td><td>${esc(s.stapnaam)}</td><td class="getal">${htmlGetal(s.actieveTijd)}</td><td class="getal">${htmlGetal(s.wachttijd)}</td>
      <td>${esc(s.redenWachttijd || '')}</td><td>${esc(s.opmerking || '')}</td><td>${esc(s.tijdvastlegging || '')}</td></tr>`).join('')}
  </tbody></table>`;
}

function renderStapmetingenTabel(f) {
  const metingen = new Map(staat.procesmetingen.filter((m) => metingVoldoetAanOverzicht(m, f)).map((m) => [m.metingId, m]));
  const lijst = staat.stapmetingen
    .filter((s) => metingen.has(s.metingId))
    .filter((s) => {
      const m = metingen.get(s.metingId);
      return bevatZoekterm([s.metingId, s.stapId, s.stapnaam, s.actieveTijd, s.wachttijd, s.redenWachttijd, s.opmerking, s.tijdvastlegging, m.procesId, m.medewerkerId, fmtDatum(m.datum)], f.zoek);
    })
    .sort((a, b) => vergelijkTekst(b.metingId, a.metingId) || a.volgorde - b.volgorde);
  $('#overzichtTelling').textContent = `${lijst.length} van ${staat.stapmetingen.length} stapmetingen`;
  if (!lijst.length) { $('#overzichtTabel').innerHTML = '<p class="zacht">Geen stapmetingen gevonden.</p>'; return; }
  $('#overzichtTabel').innerHTML = `<table>
    <thead><tr><th>MetingID</th><th>Datum</th><th>ProcesID</th><th>StapID</th><th>Processtap</th><th class="getal">Actieve tijd (min)</th><th class="getal">Wachttijd (min)</th><th>Reden wachttijd</th><th>Opmerking</th><th>Tijdvastlegging</th><th></th></tr></thead>
    <tbody>${lijst.map((s) => {
      const m = metingen.get(s.metingId);
      return `<tr><td class="mono">${esc(s.metingId)}${demoLabel(s)}</td><td>${esc(fmtDatum(m.datum))}</td><td>${esc(m.procesId)}</td><td class="mono">${esc(s.stapId)}</td><td>${esc(s.stapnaam)}</td>
        <td class="getal">${htmlGetal(s.actieveTijd)}</td><td class="getal">${htmlGetal(s.wachttijd)}</td><td>${esc(s.redenWachttijd || '')}</td><td>${esc(s.opmerking || '')}</td><td>${esc(s.tijdvastlegging || '')}</td>
        <td class="acties"><button type="button" class="klein" data-actie="meting-openen" data-id="${esc(s.metingId)}">Meting openen</button></td></tr>`;
    }).join('')}</tbody></table>
    <p class="klein zacht">Stapmetingen aanpassen of verwijderen gaat via de bijbehorende procesmeting.</p>`;
}

function renderFrequentiesTabel(f) {
  const lijst = staat.frequentiemetingen
    .filter((x) => (!f.procesId || x.procesId === f.procesId) && (!f.meetwijze || x.meetwijze === f.meetwijze))
    .filter((x) => bevatZoekterm([x.frequentieId, x.procesId, procesNaam(x.procesId), x.meetperiode, x.aantalUitvoeringen, x.totaalVolume, x.eenheid, x.meetwijze, x.bron], f.zoek))
    .sort((a, b) => vergelijkTekst(b.frequentieId, a.frequentieId));
  $('#overzichtTelling').textContent = `${lijst.length} van ${staat.frequentiemetingen.length} frequentiemetingen`;
  if (!lijst.length) { $('#overzichtTabel').innerHTML = '<p class="zacht">Geen frequentiemetingen gevonden.</p>'; return; }
  $('#overzichtTabel').innerHTML = `<table>
    <thead><tr><th>FrequentieID</th><th>ProcesID</th><th>Meetperiode</th><th class="getal">Aantal uitvoeringen</th><th class="getal">Totaal volume</th><th>Eenheid</th><th>Meetwijze</th><th>Bron of toelichting</th><th></th></tr></thead>
    <tbody>${lijst.map((x) => `<tr><td class="mono">${esc(x.frequentieId)}${demoLabel(x)}</td><td>${esc(x.procesId)}${zoekProces(x.procesId) ? '' : ' <span class="zacht klein">(verwijderd)</span>'}</td><td>${htmlTekst(x.meetperiode)}</td>
      <td class="getal">${htmlAantal(x.aantalUitvoeringen)}</td><td class="getal">${htmlAantal(x.totaalVolume)}</td><td>${htmlTekst(x.eenheid)}</td><td>${meetwijzeHtml(x.meetwijze)}</td><td>${esc(x.bron || '')}</td>
      <td class="acties">
        <button type="button" class="klein" data-actie="frequentie-openen" data-id="${esc(x.frequentieId)}">Openen</button>
        <button type="button" class="klein" data-actie="frequentie-bewerken" data-id="${esc(x.frequentieId)}">Aanpassen</button>
        <button type="button" class="klein gevaar" data-actie="frequentie-verwijderen" data-id="${esc(x.frequentieId)}">Verwijderen</button>
      </td></tr>`).join('')}</tbody></table>`;
}

function metingDetailHtml(m) {
  const b = berekenMeting(m);
  const stappen = stapmetingenVan(m.metingId);
  const eenheid = m.eenheid || 'eenheid';
  return `<div class="ruw-kader">
      <span class="etiket ruw">Ruwe invoer</span>
      ${m.demo ? '<div class="melding neutraal"><span class="demolabel">DEMO</span> Dit is een fictieve demometing.</div>' : ''}
      <dl class="gegevens">
        <dt>MetingID</dt><dd class="mono">${esc(m.metingId)}</dd>
        <dt>Datum</dt><dd>${esc(fmtDatum(m.datum))}</dd>
        <dt>Proces</dt><dd>${esc(m.procesId)} – ${htmlTekst(m.procesnaam)}${zoekProces(m.procesId) ? '' : ' <span class="zacht">(proces is inmiddels verwijderd)</span>'}</dd>
        <dt>MedewerkerID</dt><dd>${htmlTekst(m.medewerkerId)}</dd>
        <dt>Casustype</dt><dd>${esc(m.casustype)}</dd>
        <dt>Omvang</dt><dd>${htmlAantal(m.omvang)} ${esc(m.eenheid || '')}</dd>
        <dt>Meetwijze</dt><dd>${meetwijzeHtml(m.meetwijze)}</dd>
        <dt>Algemene toelichting</dt><dd>${esc(m.toelichting || '—')}</dd>
        <dt>Vastgelegd op</dt><dd>${esc(fmtTijdstip(m.aangemaakt))}</dd>
        <dt>Laatst gewijzigd</dt><dd>${m.gewijzigd ? esc(fmtTijdstip(m.gewijzigd)) : 'Niet gewijzigd'}</dd>
      </dl>
      <h4>Stapmetingen bij deze meting (${stappen.length})</h4>
      <div class="tabelhouder">${stapmetingenMiniTabel(stappen)}</div>
    </div>
    <div class="berekend-kader mt">
      <span class="etiket berekend">Automatisch berekend</span>
      <dl class="gegevens">
        <dt>Totale actieve tijd</dt><dd>${htmlGetal(b.totaalActief, 2, ' min')}</dd>
        <dt>Totale wachttijd</dt><dd>${htmlGetal(b.totaalWacht, 2, ' min')}</dd>
        <dt>Actieve tijd per eenheid</dt><dd>${htmlGetal(b.actiefPerEenheid, 2, ' min per ' + eenheid)}</dd>
        <dt>Wachttijd per eenheid</dt><dd>${htmlGetal(b.wachtPerEenheid, 2, ' min per ' + eenheid)}</dd>
      </dl>
      <div class="formule">Totale actieve tijd = ${stappen.map((s) => (isGetal(s.actieveTijd) ? fmtGetal(s.actieveTijd) : ONBEKEND)).join(' + ')}${isGetal(b.totaalActief) ? ' = ' + fmtGetal(b.totaalActief) : ''}</div>
      ${isGetal(b.actiefPerEenheid) ? `<div class="formule">Actieve tijd per eenheid = ${fmtGetal(b.totaalActief)} / ${fmtAantal(m.omvang)} = ${fmtGetal(b.actiefPerEenheid)}</div>` : ''}
      ${b.ontbrekendActief.length ? `<div class="klein">Actieve tijd ontbreekt bij: ${esc(b.ontbrekendActief.join(', '))}</div>` : ''}
      ${b.ontbrekendWacht.length ? `<div class="klein">Wachttijd ontbreekt bij: ${esc(b.ontbrekendWacht.join(', '))}</div>` : ''}
      ${!b.omvangBekend ? '<div class="klein">Omvang ontbreekt; tijd per eenheid is niet berekend.</div>' : ''}
    </div>`;
}

async function openMeting(metingId) {
  const m = zoekMeting(metingId);
  if (!m) return;
  const keuze = await dialoog({
    titel: `Procesmeting ${metingId}`,
    inhoud: metingDetailHtml(m),
    knoppen: [
      { label: 'Verwijderen', waarde: 'verwijderen', soort: 'gevaar' },
      { label: 'Aanpassen', waarde: 'bewerken' },
      { label: 'Sluiten', waarde: null, soort: 'primair' },
    ],
  });
  if (keuze === 'bewerken') bewerkMeting(metingId);
  if (keuze === 'verwijderen') verwijderMetingMetBevestiging(metingId);
}

async function verwijderMetingMetBevestiging(metingId) {
  const m = zoekMeting(metingId);
  if (!m) return;
  const aantal = stapmetingenVan(metingId).length;
  const ok = await bevestig(`Meting ${metingId} verwijderen`,
    `<div class="melding waarschuwing">U staat op het punt een meting definitief te verwijderen. Dit kan niet ongedaan worden gemaakt (behalve via een eerder gemaakte back-up).</div>
     <dl class="gegevens"><dt>MetingID</dt><dd>${esc(metingId)}</dd><dt>Datum</dt><dd>${esc(fmtDatum(m.datum))}</dd><dt>Proces</dt><dd>${esc(procesLabel(m.procesId))}</dd><dt>Casustype</dt><dd>${esc(m.casustype)}</dd></dl>
     <p>De procesmeting en de ${aantal} bijbehorende stapmetingen worden verwijderd.</p>`,
    'Meting definitief verwijderen', true);
  if (!ok) return;
  verwijderMeting(metingId);
  uitgeklapteMetingen.delete(metingId);
  await naWijziging(`Meting ${metingId} is verwijderd.`);
}

async function openFrequentie(frequentieId) {
  const f = zoekFrequentie(frequentieId);
  if (!f) return;
  const keuze = await dialoog({
    titel: `Frequentiemeting ${frequentieId}`,
    inhoud: `<div class="ruw-kader"><span class="etiket ruw">Ruwe invoer</span>
      ${f.demo ? '<div class="melding neutraal"><span class="demolabel">DEMO</span> Dit is een fictieve demometing.</div>' : ''}
      <dl class="gegevens">
      <dt>FrequentieID</dt><dd class="mono">${esc(f.frequentieId)}</dd>
      <dt>Proces</dt><dd>${esc(procesLabel(f.procesId))}</dd>
      <dt>Meetperiode</dt><dd>${htmlTekst(f.meetperiode)}</dd>
      <dt>Aantal uitvoeringen</dt><dd>${htmlAantal(f.aantalUitvoeringen)}</dd>
      <dt>Totaal volume</dt><dd>${htmlAantal(f.totaalVolume)} ${esc(f.eenheid || '')}</dd>
      <dt>Meetwijze</dt><dd>${meetwijzeHtml(f.meetwijze)}</dd>
      <dt>Bron of toelichting</dt><dd>${esc(f.bron || '—')}</dd>
      <dt>Vastgelegd op</dt><dd>${esc(fmtTijdstip(f.aangemaakt))}</dd>
      <dt>Laatst gewijzigd</dt><dd>${f.gewijzigd ? esc(fmtTijdstip(f.gewijzigd)) : 'Niet gewijzigd'}</dd>
    </dl></div>`,
    knoppen: [
      { label: 'Verwijderen', waarde: 'verwijderen', soort: 'gevaar' },
      { label: 'Aanpassen', waarde: 'bewerken' },
      { label: 'Sluiten', waarde: null, soort: 'primair' },
    ],
  });
  if (keuze === 'bewerken') bewerkFrequentie(frequentieId);
  if (keuze === 'verwijderen') verwijderFrequentieMetBevestiging(frequentieId);
}

async function verwijderFrequentieMetBevestiging(frequentieId) {
  const f = zoekFrequentie(frequentieId);
  if (!f) return;
  const ok = await bevestig(`Frequentiemeting ${frequentieId} verwijderen`,
    `<div class="melding waarschuwing">U staat op het punt een frequentiemeting definitief te verwijderen. Dit kan niet ongedaan worden gemaakt (behalve via een eerder gemaakte back-up).</div>
     <dl class="gegevens"><dt>FrequentieID</dt><dd>${esc(frequentieId)}</dd><dt>Proces</dt><dd>${esc(procesLabel(f.procesId))}</dd><dt>Meetperiode</dt><dd>${htmlTekst(f.meetperiode)}</dd></dl>`,
    'Definitief verwijderen', true);
  if (!ok) return;
  verwijderFrequentie(frequentieId);
  await naWijziging(`Frequentiemeting ${frequentieId} is verwijderd.`);
}
