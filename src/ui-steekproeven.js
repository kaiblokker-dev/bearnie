// ---------- 2. Steekproeven ----------

// Bij aanpassen: het oorspronkelijke SteekproefID; bij een nieuwe steekproef: null.
let steekproefBewerkId = null;

function initSteekproeven() {
  vulSelect($('#spStatus'), STEEKPROEF_STATUSSEN, 'Concept');
  vulSelect($('#spSelectiemethode'), SELECTIEMETHODEN, null, '— Kies —');
  vulSelect($('#srMeetwijze'), [{ waarde: 'alle', label: 'Alle meetwijzen (gemengd, wordt vermeld)' }, ...MEETWIJZE_GROEPEN.map((g) => ({ waarde: g.code, label: g.label }))], 'alle');
  $('#spProces').addEventListener('change', () => { if (!steekproefBewerkId) werkSteekproefIdBij(); });
  $('#steekproefFormulier').addEventListener('submit', (e) => { e.preventDefault(); slaSteekproefOp(); });
  for (const id of ['#srSteekproef', '#srMeetwijze', '#srMetTest']) $(id).addEventListener('change', renderSteekproefResultaten);
}

function werkSteekproefIdBij() {
  const pid = $('#spProces').value;
  $('#spId').value = steekproefBewerkId || (pid ? volgendeId('steekproef', pid).id : '');
}

function startSteekproefBewerking(steekproefId) {
  const sp = steekproefId ? zoekSteekproef(steekproefId) : null;
  steekproefBewerkId = sp ? sp.steekproefId : null;
  const procesIds = sp ? [sp.procesId] : staat.processen.map((p) => p.procesId);
  vulSelect($('#spProces'), procesIds.map((id) => ({ waarde: id, label: procesLabel(id) })), sp ? sp.procesId : (staat.processen.some((p) => p.procesId === 'PR24') ? 'PR24' : undefined), sp ? undefined : '— Kies een proces —');
  // Het proces ligt vast zodra er metingen zijn gekoppeld.
  $('#spProces').disabled = !!(sp && metingenVanSteekproef(sp.steekproefId).length);
  if (sp && !$('#spProces').disabled) vulSelect($('#spProces'), staat.processen.map((p) => ({ waarde: p.procesId, label: procesLabel(p.procesId) })), sp.procesId);
  $('#steekproefTitel').textContent = sp ? `Steekproef ${sp.steekproefId} aanpassen` : 'Nieuwe steekproef';
  $('#spNaam').value = sp ? sp.naam : '';
  $('#spStatus').value = sp ? sp.status : 'Concept';
  $('#spPopulatie').value = sp ? sp.populatie || '' : '';
  $('#spPopulatiegrootte').value = sp ? naarInvoer(sp.populatiegrootte) : '';
  $('#spSteekproefgrootte').value = sp ? naarInvoer(sp.steekproefgrootte) : '';
  $('#spSelectiemethode').value = sp ? sp.selectiemethode || '' : '';
  $('#spStart').value = sp ? sp.startdatum || '' : '';
  $('#spEind').value = sp ? sp.einddatum || '' : '';
  $('#spInclusie').value = sp ? sp.inclusiecriteria || '' : '';
  $('#spExclusie').value = sp ? sp.exclusiecriteria || '' : '';
  $('#spToelichting').value = sp ? sp.toelichting || '' : '';
  $('#spFouten').innerHTML = '';
  werkSteekproefIdBij();
  $('#steekproefFormulier').hidden = false;
  $('#steekproefFormulier').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#spNaam').focus();
}

function sluitSteekproefEditor() {
  steekproefBewerkId = null;
  $('#steekproefFormulier').hidden = true;
}

async function slaSteekproefOp() {
  const invoerFouten = [];
  const geheel = (id, label) => {
    const r = leesGetal($(id).value);
    if (r.fout) invoerFouten.push(`${label}: ${r.fout}`);
    $(id).classList.toggle('ongeldig', !!r.fout || (isGetal(r.waarde) && (r.waarde <= 0 || !Number.isInteger(r.waarde))));
    return r.fout ? NaN : r.waarde;
  };
  const pid = $('#spProces').value;
  const sp = {
    steekproefId: steekproefBewerkId || (pid ? volgendeId('steekproef', pid).id : ''),
    procesId: pid,
    naam: $('#spNaam').value.trim(),
    populatie: $('#spPopulatie').value.trim(),
    populatiegrootte: geheel('#spPopulatiegrootte', 'Totale populatiegrootte'),
    steekproefgrootte: geheel('#spSteekproefgrootte', 'Beoogde steekproefgrootte'),
    selectiemethode: $('#spSelectiemethode').value,
    inclusiecriteria: $('#spInclusie').value.trim(),
    exclusiecriteria: $('#spExclusie').value.trim(),
    startdatum: $('#spStart').value,
    einddatum: $('#spEind').value,
    toelichting: $('#spToelichting').value.trim(),
    status: $('#spStatus').value,
  };
  const { fouten, waarschuwingen } = invoerFouten.length ? { fouten: invoerFouten, waarschuwingen: [] } : valideerSteekproef(sp, steekproefBewerkId);
  $('#spFouten').innerHTML = foutenHtml(fouten, 'De steekproef is nog niet opgeslagen. Controleer het volgende:');
  if (fouten.length) return;
  if (waarschuwingen.length && !(await bevestig('Controleer voor het opslaan', `<ul>${waarschuwingen.map((w) => `<li>${esc(w)}</li>`).join('')}</ul><p>Wilt u de steekproef toch opslaan?</p>`, 'Toch opslaan'))) return;
  const was = !!steekproefBewerkId;
  const record = bewaarSteekproef(sp, steekproefBewerkId);
  sluitSteekproefEditor();
  $('#srSteekproef').dataset.kies = record.steekproefId;
  await naWijziging(`Steekproef ${record.steekproefId} is ${was ? 'bijgewerkt' : 'opgeslagen'}.`);
}

async function verwijderSteekproefMetBevestiging(steekproefId) {
  const sp = zoekSteekproef(steekproefId);
  if (!sp) return;
  const n = metingenVanSteekproef(steekproefId).length;
  const ok = await bevestig('Steekproef verwijderen',
    `<p>Steekproef <strong>${esc(sp.steekproefId)}</strong> (${esc(sp.naam)}) wordt verwijderd.</p>
     ${n ? `<div class="melding waarschuwing">Er ${n === 1 ? 'is 1 procesmeting' : `zijn ${n} procesmetingen`} aan gekoppeld. Die metingen blijven bestaan; alleen de koppeling (SteekproefID en volgnummer) vervalt. Het dossier-ID blijft bewaard.</div>` : ''}`,
    'Steekproef verwijderen', true);
  if (!ok) return;
  verwijderSteekproef(steekproefId);
  if (steekproefBewerkId === steekproefId) sluitSteekproefEditor();
  await naWijziging(`Steekproef ${steekproefId} is verwijderd.`);
}

function renderSteekproeven() {
  const lijst = staat.steekproeven;
  $('#steekproevenLijst').innerHTML = lijst.length ? `<table>
    <thead><tr><th>SteekproefID</th><th>Proces</th><th>Naam</th><th>Status</th><th>Voortgang</th><th class="getal">Populatie</th><th>Selectiemethode</th><th>Meetperiode</th><th></th></tr></thead>
    <tbody>${lijst.map((sp) => {
      const n = metingenVanSteekproef(sp.steekproefId).filter((m) => !isTestmeting(m)).length;
      return `<tr><td class="mono">${esc(sp.steekproefId)}${demoLabel(sp)}</td><td>${esc(sp.procesId)}</td><td>${esc(sp.naam)}</td><td>${esc(sp.status)}</td>
        <td>${voortgangHtml({ aantal: n, doel: sp.steekproefgrootte })}</td><td class="getal">${htmlAantal(sp.populatiegrootte)}</td><td>${htmlTekst(sp.selectiemethode)}</td>
        <td class="klein">${sp.startdatum || sp.einddatum ? `${esc(sp.startdatum ? fmtDatum(sp.startdatum) : '…')} t/m ${esc(sp.einddatum ? fmtDatum(sp.einddatum) : '…')}` : '<span class="zacht">—</span>'}</td>
        <td class="acties">
          <button type="button" class="klein" data-actie="steekproef-resultaten" data-id="${esc(sp.steekproefId)}">Resultaten</button>
          <button type="button" class="klein" data-actie="steekproef-koppelen" data-id="${esc(sp.steekproefId)}">Metingen koppelen</button>
          <button type="button" class="klein" data-actie="steekproef-bewerken" data-id="${esc(sp.steekproefId)}">Aanpassen</button>
          <button type="button" class="klein gevaar" data-actie="steekproef-verwijderen" data-id="${esc(sp.steekproefId)}">Verwijderen</button>
        </td></tr>`;
    }).join('')}</tbody></table>` : '<p class="zacht">Nog geen steekproeven vastgelegd. Klik op <em>Nieuwe steekproef</em>.</p>';
  const kies = $('#srSteekproef').dataset.kies || $('#srSteekproef').value;
  delete $('#srSteekproef').dataset.kies;
  vulSelect($('#srSteekproef'), lijst.map((sp) => ({ waarde: sp.steekproefId, label: `${sp.steekproefId} – ${sp.naam}` })), kies || (lijst[0] && lijst[0].steekproefId), lijst.length ? undefined : '— Geen steekproeven —');
  renderSteekproefResultaten();
}

function voortgangHtml(v) {
  const pct = isGetal(v.doel) && v.doel > 0 ? Math.min(100, (v.aantal / v.doel) * 100) : null;
  return `<strong>${esc(voortgangTekst(v))}</strong>${pct !== null ? `<div class="voortgang" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>` : ''}`;
}

function steekproefOpties() {
  return { meetwijze: $('#srMeetwijze').value || 'alle', metTest: $('#srMetTest').checked };
}

function renderSteekproefResultaten() {
  const houder = $('#steekproefResultaten');
  const id = $('#srSteekproef').value;
  const a = id ? steekproefAnalyse(id, steekproefOpties()) : null;
  if (!a) { houder.innerHTML = '<p class="zacht">Kies een steekproef.</p>'; return; }
  houder.innerHTML = steekproefResultatenHtml(a);
}

function tijdCel(x, eenheid = ' min') {
  return x.n ? `${esc(fmtGetal(x.gemiddelde))}${esc(eenheid)}` : `<span class="onbekend">${ONBEKEND}</span>`;
}

function steekproefResultatenHtml(a) {
  const sp = a.steekproef;
  const e = eenhedenVoorResultaat(sp.procesId, a.metingen);
  // Ieder MetingID blijft heel; afbreken alleen tussen de ID's.
  const ids = (lijst) => (lijst.length ? `<span class="mono klein">${lijst.map((id) => `<span style="white-space:nowrap">${esc(id)}</span>`).join(', ')}</span>` : '<span class="zacht">—</span>');
  const statRij = (label, b, extra = '') => `<tr><th>${label}</th><td class="getal berekend">${b.n ? esc(fmtGetal(b.gemiddelde)) : `<span class="onbekend">${ONBEKEND}</span>`}</td><td class="getal berekend">${htmlGetal(b.mediaan)}</td>
    <td class="getal berekend">${htmlGetal(b.minimum)}</td><td class="getal berekend">${htmlGetal(b.maximum)}</td><td class="getal">${b.n}</td>${extra}</tr>`;
  const kenmerkRij = (label, k) => `<tr><th>${label}</th><td class="getal berekend">${htmlGetal(k.waarde)}</td><td class="getal">${k.n}</td><td class="klein">${k.ontbrekend.length ? `onbekend bij ${esc(k.ontbrekend.join(', '))}` : ''}</td></tr>`;
  const verdelingTabel = (titel, rijen) => `<div><h4>${titel}</h4><div class="tabelhouder"><table class="klein"><thead><tr><th></th><th class="getal">Dossiers</th><th class="getal">%</th></tr></thead>
    <tbody>${rijen.map((r) => `<tr><td>${esc(r.waarde)}</td><td class="getal berekend">${r.aantal}</td><td class="getal berekend">${htmlGetal(r.percentage, 1)}</td></tr>`).join('')}</tbody></table></div></div>`;
  const x = a.extrapolatie;
  return `
    <div class="melding neutraal klein">Steekproef <strong>${esc(sp.steekproefId)}</strong> – ${esc(sp.naam)} · proces ${esc(procesLabel(sp.procesId))} · status ${esc(sp.status.toLowerCase())} · selectiemethode ${esc(sp.selectiemethode ? sp.selectiemethode.toLowerCase() : 'onbekend')} · meetwijze: ${esc(a.meetwijzeLabel)} · testmetingen ${a.opties.metTest ? 'meegenomen' : 'uitgesloten'}${a.testmetingen.length && !a.opties.metTest ? ` (${a.testmetingen.length} uitgesloten)` : ''}</div>
    ${a.waarschuwingen.map((w) => `<div class="melding waarschuwing klein">${esc(w)}</div>`).join('')}
    <div class="velden kerncijfers mt" id="srKerncijfers">
      <div><div class="klein">Voortgang</div>${voortgangHtml(a.voortgang)}</div>
      <div><div class="klein">Bruikbare metingen ${infoHtml('steekproef')}</div><strong>${a.bruikbaar.length}</strong> <span class="klein zacht">van ${a.metingen.length}</span></div>
      <div><div class="klein">Totale actieve tijd</div><strong>${htmlGetal(a.totaalActief, 2, ' min')}</strong></div>
      <div><div class="klein">Gemiddelde actieve tijd per ${esc(e.uitvoeringseenheid)}</div><strong>${tijdCel(a.actief)}</strong></div>
      <div><div class="klein">Mediane actieve tijd per ${esc(e.uitvoeringseenheid)}</div><strong>${htmlGetal(a.actief.mediaan, 2, ' min')}</strong></div>
      <div><div class="klein">Totale wachttijd</div><strong>${htmlGetal(a.totaalWacht, 2, ' min')}</strong></div>
    </div>

    <h4>Tijd per ${esc(e.uitvoeringseenheid)} (alle dossiers en per casustype)</h4>
    <div class="tabelhouder"><table id="srTijden">
      <thead><tr><th></th><th class="getal">Gemiddelde (min)</th><th class="getal">Mediaan (min)</th><th class="getal">Minimum (min)</th><th class="getal">Maximum (min)</th><th class="getal">n</th><th>Onderliggende metingen</th></tr></thead>
      <tbody>
        ${statRij('Actieve tijd – alle dossiers', a.actief, `<td>${ids(a.actief.metingIds)}</td>`)}
        ${a.perCasustype.map((c) => statRij(`Actieve tijd – ${esc(c.casustype.toLowerCase())}`, c.actief, `<td>${ids(c.actief.metingIds)}</td>`)).join('')}
        ${statRij('Wachttijd – alle dossiers', a.wacht, `<td>${ids(a.wacht.metingIds)}</td>`)}
      </tbody></table></div>
    <p class="klein zacht">Totale wachttijd ${htmlGetal(a.totaalWacht, 2, ' min')} (n = ${a.wacht.n}); gemiddelde wachttijd per ${esc(e.uitvoeringseenheid)} ${tijdCel(a.wacht)}.
      ${a.nietBruikbaar.length ? `Niet bruikbaar voor de actieve tijd: ${a.nietBruikbaar.map((n) => `${esc(n.metingId)} (${esc(n.reden)})`).join('; ')}.` : 'Alle metingen hebben een bekende actieve tijd.'}</p>

    <div class="twee-kolommen">
      <div><h4>Gemiddelde actieve tijd per complexiteitsniveau</h4>
        <div class="tabelhouder"><table class="klein" id="srComplexiteit"><thead><tr><th>Complexiteit</th><th class="getal">Dossiers</th><th class="getal">Gemiddelde (min)</th><th class="getal">Mediaan (min)</th><th class="getal">n</th></tr></thead>
        <tbody>${a.perComplexiteit.map((r) => `<tr><td>${esc(r.complexiteit)}</td><td class="getal">${r.aantalMetingen}</td><td class="getal berekend">${tijdCel(r.actief, '')}</td><td class="getal berekend">${htmlGetal(r.actief.mediaan)}</td><td class="getal">${r.actief.n}</td></tr>`).join('')}</tbody></table></div></div>
      <div><h4>Gemiddelde dossierkenmerken (per ${esc(e.uitvoeringseenheid)})</h4>
        <div class="tabelhouder"><table class="klein" id="srKenmerken"><thead><tr><th></th><th class="getal">Gemiddeld</th><th class="getal">n</th><th></th></tr></thead>
        <tbody>${kenmerkRij('ABP-periode-regels', a.kenmerken.perioderegels)}${kenmerkRij('Diensttijdblokken', a.kenmerken.blokken)}${kenmerkRij('Onderbrekingen', a.kenmerken.onderbrekingen)}</tbody></table></div>
        <p class="klein zacht">Gemiddeld = totaal ÷ aantal dossiers, alleen over metingen waarbij de waarde bekend is.</p></div>
    </div>

    <div class="twee-kolommen">
      ${verdelingTabel('Verdeling complexiteit', a.complexiteit)}
      ${verdelingTabel('Verdeling normale situaties en uitzonderingen', a.casustypen)}
    </div>

    <div class="twee-kolommen">
      <div><h4>1. Meest genoemde tijdrovende processtap ${infoHtml('tijdrovend')}</h4>
        <p class="klein zacht">Telling van de keuze per dossier, over <strong>alle</strong> procesmetingen (ook zonder detailmeting). Dit is geen gemeten tijd. ${a.tijdrovend.n} van ${a.metingen.length} metingen noemen een stap.</p>
        ${a.tijdrovend.ranglijst.length ? `<div class="tabelhouder"><table class="klein" id="srTijdrovend"><thead><tr><th>#</th><th>StapID</th><th>Processtap</th><th class="getal">Keer genoemd</th><th class="getal">%</th><th>Metingen</th></tr></thead>
        <tbody>${a.tijdrovend.ranglijst.map((r, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(r.stapId)}</td><td>${esc(r.naam)}</td><td class="getal berekend">${r.aantal}</td><td class="getal berekend">${htmlGetal(r.percentage, 1)}</td><td>${ids(r.metingIds)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="zacht klein">Nog bij geen enkele meting ingevuld.</p>'}</div>
      <div><h4>2. Gemiddelde tijd per processtap</h4>
        <p class="klein zacht">Uitsluitend uit aanwezige stapmetingen: ${a.stapTijden.metingenMetDetail.length} van ${a.metingen.length} metingen hebben een detailmeting per stap. Voor metingen zonder detailmeting wordt <strong>geen</strong> tijd per stap berekend.</p>
        <div class="tabelhouder"><table class="klein" id="srStapTijden"><thead><tr><th>StapID</th><th>Processtap</th><th class="getal">Gem. actief (min)</th><th class="getal">Mediaan actief</th><th class="getal">Gem. wacht (min)</th><th class="getal">n</th></tr></thead>
        <tbody>${a.stapTijden.stappen.map((r) => `<tr><td class="mono">${esc(r.stapId)}</td><td>${esc(r.naam)}</td>${r.actief.n || r.wacht.n
          ? `<td class="getal berekend">${tijdCel(r.actief, '')}</td><td class="getal berekend">${htmlGetal(r.actief.mediaan)}</td><td class="getal berekend">${tijdCel(r.wacht, '')}</td><td class="getal">${r.actief.n}</td>`
          : '<td colspan="4" class="zacht">Geen stapmetingen</td>'}</tr>`).join('')}</tbody></table></div></div>
    </div>

    <div class="twee-kolommen">
      <div><h4>Meest voorkomende knelpunten</h4>
        <p class="klein zacht">${a.knelpunten.metingenMetKnelpunt.length} van ${a.metingen.length} dossiers met minimaal één knelpunt (op dossierniveau of bij een stap). Per categorie telt een dossier één keer.</p>
        ${a.knelpunten.perCategorie.length ? `<div class="tabelhouder"><table class="klein" id="srKnelpunten"><thead><tr><th>Categorie</th><th class="getal">Dossiers</th><th class="getal">%</th><th>Omschrijvingen</th><th>Metingen</th></tr></thead>
        <tbody>${a.knelpunten.perCategorie.map((r) => `<tr><td>${esc(r.categorie)}</td><td class="getal berekend">${r.aantal}</td><td class="getal berekend">${htmlGetal(r.percentage, 1)}</td><td>${esc(r.omschrijvingen.join('; '))}</td><td>${ids(r.metingIds)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="zacht klein">Geen knelpunten geregistreerd.</p>'}</div>
      <div><h4>Gemeten en geschatte tijdswaarden</h4>
        <div class="tabelhouder"><table class="klein" id="srMeetwijzen"><thead><tr><th>Meetwijze</th><th class="getal">Metingen</th><th class="getal">Met bekende actieve tijd</th></tr></thead>
        <tbody>${a.meetwijzen.map((r) => `<tr><td>${meetwijzeHtml(r.meetwijze)}</td><td class="getal">${r.aantal}</td><td class="getal">${r.metBekendeTijd}</td></tr>`).join('')}</tbody></table></div>
        <p class="klein zacht">Tijdswaarden: ${a.tijdswaarden.gemeten} gemeten of geobserveerd, ${a.tijdswaarden.geschat} geschat door medewerker, ${a.tijdswaarden.systeem} uit systeemgegevens; daarnaast ${a.tijdswaarden.stapwaarden} actieve tijden per processtap.</p></div>
    </div>

    <h4>Geschatte tijdsbelasting populatie ${infoHtml('extrapolatie')}</h4>
    <div class="berekend-kader" id="srExtrapolatie">
      <span class="etiket berekend">Automatisch berekend – schatting</span>
      ${isGetal(x.waarde) ? `<div style="font-size:1.4em"><strong>${esc(fmtGetal(x.waarde))} minuten</strong> (${esc(fmtGetal(x.uren))} uur)</div>
        <div class="klein">= gemiddelde actieve tijd per ${esc(e.uitvoeringseenheid)} ${esc(fmtGetal(x.gemiddelde))} min × populatiegrootte ${esc(fmtAantal(x.populatiegrootte))} ${esc(e.uitvoeringseenheidMeervoud)}.
        Gebaseerd op ${x.n} onderzochte ${x.n === 1 ? esc(e.uitvoeringseenheid) : esc(e.uitvoeringseenheidMeervoud)} met een bekende actieve tijd (normaal en uitzondering samen).</div>`
        : `<div><span class="onbekend">${ONBEKEND}</span></div><ul class="klein">${x.ontbreekt.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`}
      <div class="klein zacht">Gebruikte populatiegrootte: ${htmlAantal(x.populatiegrootte)} · aantal onderzochte dossiers: ${x.n}. Wachttijd telt niet mee. Dit is een extrapolatie, geen meting.</div>
    </div>
    <div class="knoppen"><button type="button" class="klein" data-actie="steekproef-dossiers" data-id="${esc(sp.steekproefId)}">Gekoppelde dossiers bekijken</button>
      <button type="button" class="klein" data-actie="steekproef-koppelen" data-id="${esc(sp.steekproefId)}">Metingen koppelen</button></div>`;
}

/** Herleidbaarheid: alle gekoppelde dossiermetingen met hun kenmerken en berekende tijd. */
function toonSteekproefDossiers(steekproefId) {
  const sp = zoekSteekproef(steekproefId);
  if (!sp) return;
  const lijst = metingenVanSteekproef(steekproefId);
  informeer(`Dossiers in steekproef ${sp.steekproefId}`, lijst.length ? `<div class="tabelhouder"><table class="klein">
    <thead><tr><th class="getal">Nr.</th><th>DossierID</th><th>MetingID</th><th>Datum</th><th>Medewerker</th><th>Casustype</th><th>Meetwijze</th><th>Complexiteit</th><th class="getal">Periode-regels</th><th class="getal">Blokken</th><th class="getal">Onderbr.</th><th>Tijdrovendste stap</th><th>Detail</th><th class="getal">Actief per dossier</th><th class="getal">Wacht per dossier</th></tr></thead>
    <tbody>${lijst.map((m) => {
      const b = berekenMeting(m);
      return `<tr><td class="getal">${htmlAantal(m.volgnummerSteekproef)}</td><td class="mono">${htmlTekst(m.dossierId)}</td><td class="mono">${esc(m.metingId)}${testLabel(m)}${demoLabel(m)}</td><td>${esc(fmtDatum(m.datum))}</td><td>${htmlTekst(m.medewerkerId)}</td><td>${esc(m.casustype)}</td><td>${meetwijzeHtml(m.meetwijze)}</td>
        <td>${htmlTekst(m.complexiteit)}</td><td class="getal">${htmlAantal(m.aantalPerioderegels)}</td><td class="getal">${htmlAantal(m.aantalBlokken)}</td><td class="getal">${htmlAantal(m.aantalOnderbrekingen)}</td>
        <td>${m.tijdrovendsteStapId ? `<span class="mono">${esc(m.tijdrovendsteStapId)}</span>` : '<span class="zacht">—</span>'}</td><td>${heeftDetailmeting(m) ? 'Ja' : 'Nee'}</td>
        <td class="getal berekend">${htmlGetal(b.actiefPerUitvoering)}</td><td class="getal berekend">${htmlGetal(b.wachtPerUitvoering)}</td></tr>`;
    }).join('')}</tbody></table></div><p class="klein zacht">Testmetingen zijn gemarkeerd met TEST en tellen standaard niet mee in de resultaten.</p>` : '<p class="zacht">Er zijn nog geen metingen gekoppeld.</p>');
}

/** Dialoog om bestaande procesmetingen van het proces aan de steekproef te koppelen of te ontkoppelen. */
async function koppelMetingenDialoog(steekproefId) {
  const sp = zoekSteekproef(steekproefId);
  if (!sp) return;
  const kandidaten = staat.procesmetingen
    .filter((m) => m.procesId === sp.procesId && (!m.steekproefId || m.steekproefId === steekproefId))
    .sort((a, b) => (a.steekproefId ? 0 : 1) - (b.steekproefId ? 0 : 1) || (a.volgnummerSteekproef || 0) - (b.volgnummerSteekproef || 0) || vergelijkTekst(a.metingId, b.metingId));
  const elders = staat.procesmetingen.filter((m) => m.procesId === sp.procesId && m.steekproefId && m.steekproefId !== steekproefId).length;
  if (!kandidaten.length) {
    await informeer('Metingen koppelen', `<p>Er zijn geen procesmetingen van proces ${esc(sp.procesId)} die aan deze steekproef kunnen worden gekoppeld.</p>`);
    return;
  }
  const keuze = await dialoog({
    titel: `Metingen koppelen aan ${sp.steekproefId}`,
    inhoud: `<p class="klein">Vink de procesmetingen aan die bij steekproef <strong>${esc(sp.naam)}</strong> horen en vul het volgnummer en het geanonimiseerde dossier-ID in. Uitvinken ontkoppelt een meting (de meting zelf blijft bestaan).${elders ? ` ${elders} meting(en) van dit proces zijn aan een andere steekproef gekoppeld en staan niet in deze lijst.` : ''}</p>
      <div class="tabelhouder"><table class="klein" id="koppelTabel"><thead><tr><th>Koppelen</th><th>MetingID</th><th>Datum</th><th>Medewerker</th><th>Casustype</th><th>Meetwijze</th><th>Volgnummer</th><th>Dossier-ID</th></tr></thead>
      <tbody>${kandidaten.map((m) => `<tr data-meting="${esc(m.metingId)}"><td><input type="checkbox" data-koppel ${m.steekproefId === steekproefId ? 'checked' : ''} aria-label="Meting ${esc(m.metingId)} koppelen"></td>
        <td class="mono">${esc(m.metingId)}${testLabel(m)}${demoLabel(m)}</td><td>${esc(fmtDatum(m.datum))}</td><td>${htmlTekst(m.medewerkerId)}</td><td>${esc(m.casustype)}</td><td>${meetwijzeHtml(m.meetwijze)}</td>
        <td><input type="text" class="tijd" data-volgnummer inputmode="numeric" value="${esc(naarInvoer(m.volgnummerSteekproef))}" aria-label="Volgnummer ${esc(m.metingId)}"></td>
        <td><input type="text" data-dossier maxlength="40" value="${esc(m.dossierId || '')}" placeholder="bijv. D-001" aria-label="Dossier-ID ${esc(m.metingId)}"></td></tr>`).join('')}</tbody></table></div>
      <div id="koppelFouten"></div>`,
    knoppen: [
      { label: 'Annuleren', waarde: false },
      {
        label: 'Koppeling opslaan', waarde: true, soort: 'primair',
        controle: () => {
          const koppelingen = [];
          const fouten = [];
          for (const rij of $$('#koppelTabel tbody tr')) {
            if (!$('[data-koppel]', rij).checked) continue;
            const r = leesGetal($('[data-volgnummer]', rij).value);
            if (r.fout) fouten.push(`Meting ${rij.dataset.meting}: volgnummer – ${r.fout}`);
            koppelingen.push({ metingId: rij.dataset.meting, volgnummer: r.fout ? NaN : r.waarde, dossierId: $('[data-dossier]', rij).value.trim() });
          }
          const alle = fouten.length ? fouten : koppelMetingen(steekproefId, koppelingen);
          $('#koppelFouten').innerHTML = foutenHtml(alle, 'De koppeling is niet opgeslagen:');
          return !alle.length;
        },
      },
    ],
  });
  if (keuze === true) await naWijziging(`Koppeling van steekproef ${steekproefId} is opgeslagen.`);
}

/** Vult bij het aanvinken in het koppelvenster direct het eerstvolgende vrije volgnummer in (zichtbaar en aanpasbaar). */
function initKoppelDialoog() {
  $('#dialoogInhoud').addEventListener('change', (e) => {
    if (!e.target.matches('#koppelTabel [data-koppel]') || !e.target.checked) return;
    const veld = $('[data-volgnummer]', e.target.closest('tr'));
    if (veld.value.trim()) return;
    const gebruikt = $$('#koppelTabel tbody tr').filter((r) => $('[data-koppel]', r).checked).map((r) => leesGetal($('[data-volgnummer]', r).value).waarde).filter(isGetal);
    veld.value = String(Math.max(0, ...gebruikt) + 1);
  });
}
