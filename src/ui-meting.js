// ---------- 2. Nieuwe procesmeting (en aanpassen van een bestaande meting) ----------

// Bij bewerken: het oorspronkelijke MetingID. Bij een nieuwe meting: null.
let metingBewerkId = null;
// Stappen in het formulier: [{ stapId, volgorde, stapnaam, tijdvastlegging }]
let formulierStappen = [];
// Timers per StapID: { status: 'gereed'|'actief'|'wacht'|'afgerond', actiefMs, wachtMs, sinds }
let timers = {};
let timerInterval = null;

function vulMetingProcesKeuze() {
  const select = $('#mProces');
  const huidig = select.value;
  if (metingBewerkId) return; // proces ligt vast tijdens bewerken
  vulSelect(select, staat.processen.map((p) => ({ waarde: p.procesId, label: `${p.procesId} – ${p.naam}${p.demo ? ' [DEMO]' : ''}` })), huidig, staat.processen.length ? '— Kies een proces —' : '— Leg eerst een proces vast (tabblad 1) —');
  if (huidig && select.value !== huidig) {
    // Het gekozen proces bestaat niet meer.
    formulierStappen = [];
    renderMetingStappen();
  }
  if (!metingBewerkId) werkMetingIdBij();
}

function werkMetingIdBij() {
  const pid = $('#mProces').value;
  $('#mMetingId').value = metingBewerkId || (pid ? volgendeId('meting', pid).id : '');
}

function initMetingFormulier() {
  vulSelect($('#mMeetwijze'), MEETWIJZEN_METING, null, '— Kies de meetwijze —');
  $('#mDatum').value = vandaagIso();
  vulMetingProcesKeuze();

  $('#mProces').addEventListener('change', () => {
    const p = zoekProces($('#mProces').value);
    $('#mEenheid').value = p ? p.eenheid : '';
    laadProcesStappenInFormulier(p ? p.procesId : null);
    werkMetingIdBij();
  });
  $('#mTimerTonen').addEventListener('change', () => {
    $('#mStappen').classList.toggle('verborgen-kolom', !$('#mTimerTonen').checked);
  });
  $('#mStappen').classList.add('verborgen-kolom');
  $('#metingFormulier').addEventListener('input', (e) => {
    const rij = e.target.closest('tr[data-stap]');
    if (rij && (e.target.dataset.veld === 'actieveTijd' || e.target.dataset.veld === 'wachttijd')) {
      const s = formulierStappen.find((x) => x.stapId === rij.dataset.stap);
      if (s && s.tijdvastlegging === 'Timer') { s.tijdvastlegging = 'Timer, handmatig aangepast'; werkBronLabelBij(rij, s); }
      if (e.target.dataset.veld === 'wachttijd') werkRedenZichtbaarheidBij(rij);
    }
    werkBerekeningBij();
  });
  $('#metingFormulier').addEventListener('change', werkBerekeningBij);
  $('#metingFormulier').addEventListener('submit', (e) => { e.preventDefault(); slaMetingOp(); });
  $('#mStappen').addEventListener('click', (e) => {
    const knop = e.target.closest('button[data-timer]');
    if (knop) timerActie(knop.closest('tr').dataset.stap, knop.dataset.timer);
  });
  renderMetingStappen();
}

function laadProcesStappenInFormulier(procesId) {
  timers = {};
  formulierStappen = procesId
    ? stappenVanProces(procesId).map((s) => ({ stapId: s.stapId, volgorde: s.volgorde, stapnaam: s.naam, tijdvastlegging: 'Handmatig' }))
    : [];
  renderMetingStappen();
}

function renderMetingStappen(waarden = {}) {
  const houder = $('#mStappen');
  if (!formulierStappen.length) {
    houder.innerHTML = '<p class="zacht">Kies eerst een proces. De processtappen worden dan automatisch geladen.</p>';
    werkBerekeningBij();
    return;
  }
  const rijen = formulierStappen.map((s) => {
    const w = waarden[s.stapId] || {};
    return `<tr data-stap="${esc(s.stapId)}">
      <td class="mono">${esc(s.stapId)}</td>
      <td>${esc(s.stapnaam)}<span class="bronlabel" data-bron></span></td>
      <td><input type="text" class="tijd" data-veld="actieveTijd" inputmode="decimal" value="${esc(naarInvoer(w.actieveTijd))}" aria-label="Actieve tijd in minuten voor ${esc(s.stapId)}"></td>
      <td><input type="text" class="tijd" data-veld="wachttijd" inputmode="decimal" value="${esc(naarInvoer(w.wachttijd))}" aria-label="Wachttijd in minuten voor ${esc(s.stapId)}"></td>
      <td><input type="text" data-veld="redenWachttijd" value="${esc(w.redenWachttijd || '')}" placeholder="Verplicht bij wachttijd" aria-label="Reden wachttijd voor ${esc(s.stapId)}"></td>
      <td><input type="text" data-veld="opmerking" value="${esc(w.opmerking || '')}" placeholder="Optioneel" aria-label="Opmerking voor ${esc(s.stapId)}"></td>
      <td class="timer">
        <span class="timerweergave" data-timerweergave>0:00</span>
        <span data-timerknoppen></span>
      </td>
    </tr>`;
  }).join('');
  houder.innerHTML = `<div class="tabelhouder"><table class="stappen">
    <thead><tr><th>StapID</th><th>Processtap</th><th>Actieve tijd (min)</th><th>Wachttijd (min)</th><th>Reden wachttijd</th><th>Opmerking</th><th class="timer">Timer</th></tr></thead>
    <tbody>${rijen}</tbody></table></div>
    <p class="klein zacht">Tijden in minuten; decimalen met komma of punt. Vul 0 in als er geen wachttijd was. De timer vult de velden pas na <em>Afronden</em>; controleer en corrigeer de waarden altijd vóór het opslaan.</p>`;
  for (const rij of $$('tr[data-stap]', houder)) {
    const s = formulierStappen.find((x) => x.stapId === rij.dataset.stap);
    werkRedenZichtbaarheidBij(rij);
    werkBronLabelBij(rij, s);
    werkTimerWeergaveBij(rij.dataset.stap);
  }
  werkBerekeningBij();
}

function werkBronLabelBij(rij, s) {
  const el = $('[data-bron]', rij);
  if (el) el.textContent = s && s.tijdvastlegging !== 'Handmatig' ? `Tijdvastlegging: ${s.tijdvastlegging}` : '';
}

function werkRedenZichtbaarheidBij(rij) {
  const wacht = leesGetal($('[data-veld="wachttijd"]', rij).value);
  const reden = $('[data-veld="redenWachttijd"]', rij);
  const nodig = isGetal(wacht.waarde) && wacht.waarde > 0;
  reden.style.visibility = nodig || reden.value.trim() ? 'visible' : 'hidden';
  if (!nodig) reden.classList.remove('ongeldig');
}

/** Leest het formulier uit. Geeft { meting, stapmetingen, invoerFouten }. */
function leesMetingFormulier() {
  const invoerFouten = [];
  const omvang = leesGetal($('#mOmvang').value);
  if (omvang.fout) invoerFouten.push('Omvang: ' + omvang.fout);
  $('#mOmvang').classList.toggle('ongeldig', !!omvang.fout || (isGetal(omvang.waarde) && omvang.waarde <= 0));
  const casus = $('input[name="casustype"]:checked');
  const pid = metingBewerkId ? zoekMeting(metingBewerkId).procesId : $('#mProces').value;
  const meting = {
    metingId: $('#mMetingId').value,
    datum: $('#mDatum').value,
    procesId: pid,
    procesnaam: metingBewerkId ? zoekMeting(metingBewerkId).procesnaam : procesNaam(pid),
    medewerkerId: $('#mMedewerker').value.trim(),
    casustype: casus ? casus.value : '',
    omvang: omvang.fout ? NaN : omvang.waarde,
    eenheid: $('#mEenheid').value.trim(),
    meetwijze: $('#mMeetwijze').value,
    toelichting: $('#mToelichting').value.trim(),
  };
  const stapmetingen = formulierStappen.map((s) => {
    const rij = $(`tr[data-stap="${CSS.escape(s.stapId)}"]`, $('#mStappen'));
    const lees = (veld) => {
      const invoer = $(`[data-veld="${veld}"]`, rij);
      const r = leesGetal(invoer.value);
      invoer.classList.toggle('ongeldig', !!r.fout || (isGetal(r.waarde) && r.waarde < 0));
      if (r.fout) invoerFouten.push(`${s.stapId} – ${veld === 'actieveTijd' ? 'actieve tijd' : 'wachttijd'}: ${r.fout}`);
      return r.fout ? NaN : r.waarde;
    };
    const actieveTijd = lees('actieveTijd');
    const wachttijd = lees('wachttijd');
    const redenWachttijd = $('[data-veld="redenWachttijd"]', rij).value.trim();
    $('[data-veld="redenWachttijd"]', rij).classList.toggle('ongeldig', wachttijd > 0 && !redenWachttijd);
    return {
      stapId: s.stapId,
      volgorde: s.volgorde,
      stapnaam: s.stapnaam,
      actieveTijd,
      wachttijd,
      redenWachttijd,
      opmerking: $('[data-veld="opmerking"]', rij).value.trim(),
      tijdvastlegging: s.tijdvastlegging,
    };
  });
  return { meting, stapmetingen, invoerFouten };
}

/** Toont een voorlopige berekening van de ingevulde waarden (niet opgeslagen). */
function werkBerekeningBij() {
  const houder = $('#mBerekend');
  if (!formulierStappen.length) { houder.innerHTML = '<span class="etiket berekend">Automatisch berekend</span><div class="klein">Nog geen processtappen geladen.</div>'; return; }
  const { meting, stapmetingen } = leesMetingFormulier();
  const actief = stapmetingen.map((s) => s.actieveTijd);
  const wacht = stapmetingen.map((s) => s.wachttijd);
  const totaalActief = actief.every(isGetal) ? som(actief) : null;
  const totaalWacht = wacht.every(isGetal) ? som(wacht) : null;
  const omvangOk = isGetal(meting.omvang) && meting.omvang > 0;
  const eenheid = meting.eenheid || 'eenheid';
  const enkelvoud = eenheid;
  houder.innerHTML = `<span class="etiket berekend">Automatisch berekend (voorbeeld, wordt niet als invoer opgeslagen)</span>
    <div class="velden">
      <div><div class="klein">Totale actieve tijd</div><strong>${htmlGetal(totaalActief, 2, ' min')}</strong></div>
      <div><div class="klein">Totale wachttijd</div><strong>${htmlGetal(totaalWacht, 2, ' min')}</strong></div>
      <div><div class="klein">Actieve tijd per eenheid</div><strong>${htmlGetal(omvangOk ? (isGetal(totaalActief) ? totaalActief / meting.omvang : null) : null, 2, ' min per ' + enkelvoud)}</strong></div>
      <div><div class="klein">Wachttijd per eenheid</div><strong>${htmlGetal(omvangOk ? (isGetal(totaalWacht) ? totaalWacht / meting.omvang : null) : null, 2, ' min per ' + enkelvoud)}</strong></div>
    </div>
    ${!actief.every(isGetal) || !wacht.every(isGetal) || !omvangOk ? '<div class="klein mt">Onbekend = niet alle benodigde velden zijn (geldig) ingevuld. Lege velden worden niet als nul geteld.</div>' : ''}`;
}

async function slaMetingOp() {
  const { meting, stapmetingen, invoerFouten } = leesMetingFormulier();
  const { fouten, waarschuwingen } = invoerFouten.length ? { fouten: invoerFouten, waarschuwingen: [] } : valideerMeting(meting, stapmetingen, metingBewerkId);
  $('#mFouten').innerHTML = foutenHtml(fouten, 'De meting is nog niet opgeslagen. Controleer het volgende:');
  if (fouten.length) { $('#mFouten').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  if (Object.values(timers).some((t) => t.status === 'actief' || t.status === 'wacht')) {
    waarschuwingen.unshift('Er loopt nog een timer. Tijd die na het opslaan wordt gemeten, wordt niet meegenomen.');
  }
  if (waarschuwingen.length) {
    const ok = await bevestig('Controleer voor het opslaan',
      `<ul>${waarschuwingen.map((w) => `<li>${esc(w)}</li>`).join('')}</ul><p>Wilt u de meting toch opslaan?</p>`, 'Toch opslaan');
    if (!ok) return;
  }
  const wasBewerking = !!metingBewerkId;
  const record = bewaarMeting(meting, stapmetingen, metingBewerkId);
  resetMetingFormulier(true);
  await naWijziging(`Meting ${record.metingId} is ${wasBewerking ? 'bijgewerkt' : 'opgeslagen'}.`);
  if (wasBewerking) toonTab('overzicht');
}

/** Maakt het formulier leeg. behoudAlgemeen: datum, proces, medewerker en meetwijze blijven staan voor de volgende meting. */
function resetMetingFormulier(behoudAlgemeen) {
  const wasBewerking = !!metingBewerkId;
  metingBewerkId = null;
  timers = {};
  $('#metingTitel').textContent = 'Nieuwe procesmeting';
  $('#metingBewerkMelding').innerHTML = '';
  $('#mFouten').innerHTML = '';
  $('#mProces').disabled = false;
  $('#mAnnuleren').textContent = 'Formulier leegmaken';
  if (!behoudAlgemeen || wasBewerking) {
    $('#mDatum').value = vandaagIso();
    $('#mProces').value = '';
    $('#mMedewerker').value = '';
    $('#mMeetwijze').value = '';
    $('#mEenheid').value = '';
  }
  $$('input[name="casustype"]').forEach((r) => { r.checked = false; });
  $('#mOmvang').value = '';
  $('#mToelichting').value = '';
  vulMetingProcesKeuze();
  const p = zoekProces($('#mProces').value);
  if (p && !$('#mEenheid').value) $('#mEenheid').value = p.eenheid;
  laadProcesStappenInFormulier(p ? p.procesId : null);
  werkMetingIdBij();
}

/** Laadt een bestaande meting in het formulier om aan te passen. */
function bewerkMeting(metingId) {
  const m = zoekMeting(metingId);
  if (!m) return;
  metingBewerkId = metingId;
  timers = {};
  $('#metingTitel').textContent = `Meting ${metingId} aanpassen`;
  $('#metingBewerkMelding').innerHTML = `<div class="melding waarschuwing">U past de opgeslagen ruwe invoer van meting <strong>${esc(metingId)}</strong> aan. Het MetingID en het proces blijven gelijk. De processtappen zijn die van het moment van meten. Het tijdstip van de wijziging wordt vastgelegd.</div>`;
  vulSelect($('#mProces'), [{ waarde: m.procesId, label: procesLabel(m.procesId) }], m.procesId);
  $('#mProces').disabled = true;
  $('#mMetingId').value = m.metingId;
  $('#mDatum').value = m.datum || '';
  $('#mMedewerker').value = m.medewerkerId || '';
  $$('input[name="casustype"]').forEach((r) => { r.checked = r.value === m.casustype; });
  $('#mOmvang').value = naarInvoer(m.omvang);
  $('#mEenheid').value = m.eenheid || '';
  $('#mMeetwijze').value = m.meetwijze || '';
  $('#mToelichting').value = m.toelichting || '';
  const sm = stapmetingenVan(metingId);
  formulierStappen = sm.map((s) => ({ stapId: s.stapId, volgorde: s.volgorde, stapnaam: s.stapnaam, tijdvastlegging: s.tijdvastlegging || 'Handmatig' }));
  const waarden = {};
  for (const s of sm) waarden[s.stapId] = s;
  $('#mAnnuleren').textContent = 'Aanpassen annuleren';
  $('#mFouten').innerHTML = '';
  renderMetingStappen(waarden);
  toonTab('meting');
}

// ---------- Timer ----------

function timerVan(stapId) {
  if (!timers[stapId]) timers[stapId] = { status: 'gereed', actiefMs: 0, wachtMs: 0, sinds: null };
  return timers[stapId];
}

function sluitSegment(t) {
  if (t.sinds === null) return;
  const duur = Date.now() - t.sinds;
  if (t.status === 'actief') t.actiefMs += duur;
  if (t.status === 'wacht') t.wachtMs += duur;
  t.sinds = null;
}

function timerActie(stapId, actie) {
  const t = timerVan(stapId);
  if (actie === 'start' && (t.status === 'gereed')) { t.status = 'actief'; t.sinds = Date.now(); }
  else if (actie === 'wacht' && t.status === 'actief') { sluitSegment(t); t.status = 'wacht'; t.sinds = Date.now(); }
  else if (actie === 'hervat' && t.status === 'wacht') { sluitSegment(t); t.status = 'actief'; t.sinds = Date.now(); }
  else if (actie === 'afronden' && (t.status === 'actief' || t.status === 'wacht')) {
    sluitSegment(t);
    t.status = 'afgerond';
    const rij = $(`tr[data-stap="${CSS.escape(stapId)}"]`, $('#mStappen'));
    // Vastgelegd tot op 0,01 minuut (0,6 seconde). De gebruiker kan de waarden daarna controleren en aanpassen.
    $('[data-veld="actieveTijd"]', rij).value = naarInvoer(Math.round(t.actiefMs / 600) / 100);
    $('[data-veld="wachttijd"]', rij).value = naarInvoer(Math.round(t.wachtMs / 600) / 100);
    const s = formulierStappen.find((x) => x.stapId === stapId);
    s.tijdvastlegging = 'Timer';
    werkBronLabelBij(rij, s);
    werkRedenZichtbaarheidBij(rij);
    werkBerekeningBij();
    toonMelding(`Timer ${stapId} afgerond. Controleer de ingevulde tijden${t.wachtMs > 0 ? ' en vul de reden van de wachttijd in' : ''}.`);
  } else if (actie === 'reset') {
    // Zet alleen de timer terug op nul. Ingevulde tijden blijven staan; de gebruiker past ze zelf aan.
    delete timers[stapId];
  }
  werkTimerWeergaveBij(stapId);
  regelTimerInterval();
}

function fmtDuur(ms) {
  const sec = Math.floor(ms / 1000);
  const u = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (u ? u + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

function werkTimerWeergaveBij(stapId) {
  const rij = $(`tr[data-stap="${CSS.escape(stapId)}"]`, $('#mStappen'));
  if (!rij) return;
  const t = timers[stapId] || { status: 'gereed', actiefMs: 0, wachtMs: 0, sinds: null };
  const lopend = t.sinds !== null ? Date.now() - t.sinds : 0;
  const actiefMs = t.actiefMs + (t.status === 'actief' ? lopend : 0);
  const wachtMs = t.wachtMs + (t.status === 'wacht' ? lopend : 0);
  const weergave = $('[data-timerweergave]', rij);
  const statusTekst = { gereed: 'Gereed', actief: 'Actief', wacht: 'Wachttijd', afgerond: 'Afgerond' }[t.status];
  weergave.textContent = `${statusTekst} · actief ${fmtDuur(actiefMs)} · wacht ${fmtDuur(wachtMs)}`;
  weergave.className = 'timerweergave' + (t.status === 'actief' ? ' loopt' : t.status === 'wacht' ? ' wacht' : '');
  const knoppen = [
    ['start', 'Start', t.status === 'gereed'],
    ['wacht', 'Start wachttijd', t.status === 'actief'],
    ['hervat', 'Hervat actieve tijd', t.status === 'wacht'],
    ['afronden', 'Afronden', t.status === 'actief' || t.status === 'wacht'],
    ['reset', 'Reset', t.status !== 'gereed'],
  ];
  $('[data-timerknoppen]', rij).innerHTML = knoppen
    .map(([actie, label, actiefKnop]) => `<button type="button" data-timer="${actie}" ${actiefKnop ? '' : 'disabled'}>${label}</button>`)
    .join(' ');
}

function regelTimerInterval() {
  const lopend = Object.values(timers).some((t) => t.status === 'actief' || t.status === 'wacht');
  if (lopend && !timerInterval) {
    timerInterval = setInterval(() => {
      for (const [stapId, t] of Object.entries(timers)) if (t.status === 'actief' || t.status === 'wacht') werkTimerWeergaveBij(stapId);
    }, 500);
  } else if (!lopend && timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}
