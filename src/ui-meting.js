// ---------- 2. Nieuwe procesmeting (en aanpassen van een bestaande meting) ----------

// Bij bewerken: het oorspronkelijke MetingID. Bij een nieuwe meting: null.
let metingBewerkId = null;
// Stappen in het formulier: [{ stapId, volgorde, stapnaam, tijdvastlegging }]
let formulierStappen = [];
// Eenheden van de meting in het formulier (kopie van het proces, of van de bestaande meting bij aanpassen)
let formulierEenheden = eenhedenKopieLeeg();
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
  if (!metingBewerkId) {
    werkMetingIdBij();
    // Eenheden volgen het (mogelijk zojuist aangepaste) proces.
    formulierEenheden = select.value ? eenhedenKopie(select.value) : eenhedenKopieLeeg();
    werkEenheidLabelsBij();
  }
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
    formulierEenheden = p ? eenhedenKopie(p.procesId) : eenhedenKopieLeeg();
    werkEenheidLabelsBij();
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
      if (s && (s.tijdvastlegging === 'Timer' || s.tijdvastlegging === 'Gekopieerd')) { s.tijdvastlegging += ', handmatig aangepast'; werkBronLabelBij(rij, s); }
      if (e.target.dataset.veld === 'wachttijd') werkRedenZichtbaarheidBij(rij);
    }
    if (rij && e.target.dataset.veld === 'knelpunt') werkKnelpuntRijBij(rij);
    werkKalenderweekBij();
    werkBerekeningBij();
    planMetingConcept();
  });
  $('#metingFormulier').addEventListener('change', () => { werkKalenderweekBij(); werkBerekeningBij(); planMetingConcept(); });
  $('#metingFormulier').addEventListener('submit', (e) => { e.preventDefault(); slaMetingOp(); });
  $('#mStappen').addEventListener('click', (e) => {
    const knop = e.target.closest('button[data-timer]');
    if (knop) timerActie(knop.closest('tr').dataset.stap, knop.dataset.timer);
  });
  renderMetingStappen();
  werkKalenderweekBij();
}

/** Toont onder de meetdatum de kalenderweek, bijv. "Kalenderweek 41 van 2026 (5 t/m 11 oktober 2026)". */
function werkKalenderweekBij() {
  const tekst = kalenderweekTekst($('#mDatum').value);
  $('#mKalenderweek').innerHTML = tekst ? `Meetmoment: ${esc(tekst)} ${infoHtml('kalenderweek')}` : '';
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
      <td><input type="text" class="tijd" data-veld="actieveTijd" inputmode="decimal" value="${esc(typeof w.actieveTijd === 'string' ? w.actieveTijd : naarInvoer(w.actieveTijd))}" aria-label="Actieve tijd in minuten voor ${esc(s.stapId)}"></td>
      <td><input type="text" class="tijd" data-veld="wachttijd" inputmode="decimal" value="${esc(typeof w.wachttijd === 'string' ? w.wachttijd : naarInvoer(w.wachttijd))}" aria-label="Wachttijd in minuten voor ${esc(s.stapId)}"></td>
      <td><input type="text" data-veld="redenWachttijd" value="${esc(w.redenWachttijd || '')}" placeholder="Verplicht bij wachttijd" aria-label="Reden wachttijd voor ${esc(s.stapId)}"></td>
      <td><input type="text" data-veld="opmerking" value="${esc(w.opmerking || '')}" placeholder="Optioneel" aria-label="Opmerking voor ${esc(s.stapId)}"></td>
      <td><select data-veld="knelpunt" aria-label="Knelpunt aanwezig bij ${esc(s.stapId)}">
        ${[['', '–'], ['nee', 'Nee'], ['ja', 'Ja']].map(([w2, l]) => `<option value="${w2}" ${knelpuntKeuze(w) === w2 ? 'selected' : ''}>${l}</option>`).join('')}
      </select></td>
      <td class="timer">
        <span class="timerweergave" data-timerweergave>0:00</span>
        <span data-timerknoppen></span>
      </td>
    </tr>
    ${knelpuntRijHtml(s, w)}`;
  }).join('');
  houder.innerHTML = `<div class="tabelhouder"><table class="stappen">
    <thead><tr><th>StapID</th><th>Processtap</th><th>Actieve tijd (min) ${infoHtml('actief')}</th><th>Wachttijd (min) ${infoHtml('wacht')}</th><th>Reden wachttijd</th><th>Opmerking</th><th>Knelpunt ${infoHtml('knelpunt')}</th><th class="timer">Timer</th></tr></thead>
    <tbody>${rijen}</tbody></table></div>
    <p class="klein zacht">Tijden in minuten; decimalen met komma of punt. Vul 0 in als er geen wachttijd was. De timer vult de velden pas na <em>Afronden</em>; controleer en corrigeer de waarden altijd vóór het opslaan.</p>`;
  for (const rij of $$('tr[data-stap]', houder)) {
    const s = formulierStappen.find((x) => x.stapId === rij.dataset.stap);
    werkRedenZichtbaarheidBij(rij);
    werkBronLabelBij(rij, s);
    werkTimerWeergaveBij(rij.dataset.stap);
    werkKnelpuntRijBij(rij);
  }
  werkBerekeningBij();
}

// ---------- Knelpunt per processtap ----------

function knelpuntKeuze(w) {
  if (w.knelpunt === true || w.knelpunt === 'ja') return 'ja';
  if (w.knelpunt === false || w.knelpunt === 'nee') return 'nee';
  return '';
}

/** Vervolgvelden van een knelpunt, direct onder de stap; alleen zichtbaar bij 'Ja'. */
function knelpuntRijHtml(s, w) {
  const invoer = (v) => (typeof v === 'string' ? v : naarInvoer(v));
  const gevolgen = Array.isArray(w.knelpuntGevolgen) ? w.knelpuntGevolgen : [];
  const opties = (lijst, gekozen) => `<option value="">— Kies —</option>${lijst.map((x) => `<option ${x === gekozen ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
  return `<tr class="knelpuntrij" data-knelpunt-voor="${esc(s.stapId)}" hidden><td colspan="8">
    <div class="knelpuntvelden">
      <div class="veld"><label>Categorie</label><select data-kveld="knelpuntCategorie">${opties(KNELPUNT_CATEGORIEEN, w.knelpuntCategorie)}</select></div>
      <div class="veld" style="grid-column: span 2"><label>Korte omschrijving van het knelpunt</label><input type="text" data-kveld="knelpuntOmschrijving" maxlength="200" value="${esc(w.knelpuntOmschrijving || '')}" placeholder="Optioneel"></div>
      <div class="veld"><label>Bron</label><select data-kveld="knelpuntBron">${opties(KNELPUNT_BRONNEN, w.knelpuntBron)}</select></div>
      <div class="veld"><label>Geschatte extra actieve tijd (min)</label><input type="text" class="tijd" inputmode="decimal" data-kveld="knelpuntExtraActief" value="${esc(invoer(w.knelpuntExtraActief))}" placeholder="Optioneel"></div>
      <div class="veld"><label>Geschatte extra wachttijd (min)</label><input type="text" class="tijd" inputmode="decimal" data-kveld="knelpuntExtraWacht" value="${esc(invoer(w.knelpuntExtraWacht))}" placeholder="Optioneel"></div>
      <div class="veld" style="grid-column: span 2"><span class="label">Gevolg (meerdere mogelijk)</span><div class="keuzes">
        ${KNELPUNT_GEVOLGEN.map((g) => `<label><input type="checkbox" data-kgevolg value="${esc(g)}" ${gevolgen.includes(g) ? 'checked' : ''}> ${esc(g)}</label>`).join('')}
      </div></div>
    </div>
    <div class="klein zacht">De geschatte extra tijd is verklarend: die zit al in de gemeten tijd van deze stap en wordt niet opnieuw opgeteld.</div>
  </td></tr>`;
}

function knelpuntRij(stapId) {
  return $(`tr[data-knelpunt-voor="${CSS.escape(stapId)}"]`, $('#mStappen'));
}

function werkKnelpuntRijBij(rij) {
  const sub = knelpuntRij(rij.dataset.stap);
  if (sub) sub.hidden = $('[data-veld="knelpunt"]', rij).value !== 'ja';
}

/** Leest de knelpuntvelden van een stap. Geeft de velden voor de stapmeting (leeg object = niet geregistreerd). */
function leesKnelpunt(stapId, rij, invoerFouten) {
  const keuze = $('[data-veld="knelpunt"]', rij).value;
  if (keuze === 'nee') return { knelpunt: false };
  if (keuze !== 'ja') return {};
  const sub = knelpuntRij(stapId);
  const getal = (veld, naam) => {
    const el = $(`[data-kveld="${veld}"]`, sub);
    const r = leesGetal(el.value);
    if (r.fout) invoerFouten.push(`${stapId} – ${naam}: ${r.fout}`);
    el.classList.toggle('ongeldig', !!r.fout || (isGetal(r.waarde) && r.waarde < 0));
    return r.fout ? NaN : r.waarde;
  };
  return {
    knelpunt: true,
    knelpuntCategorie: $('[data-kveld="knelpuntCategorie"]', sub).value,
    knelpuntOmschrijving: $('[data-kveld="knelpuntOmschrijving"]', sub).value.trim(),
    knelpuntGevolgen: $$('[data-kgevolg]', sub).filter((c) => c.checked).map((c) => c.value),
    knelpuntExtraActief: getal('knelpuntExtraActief', 'geschatte extra actieve tijd'),
    knelpuntExtraWacht: getal('knelpuntExtraWacht', 'geschatte extra wachttijd'),
    knelpuntBron: $('[data-kveld="knelpuntBron"]', sub).value,
  };
}

/** Ruwe invoer van de knelpuntvelden, voor het concept. */
function knelpuntConceptWaarden(rij) {
  const sub = knelpuntRij(rij.dataset.stap);
  const v = { knelpunt: $('[data-veld="knelpunt"]', rij).value };
  if (!sub) return v;
  for (const el of $$('[data-kveld]', sub)) v[el.dataset.kveld] = el.value;
  v.knelpuntGevolgen = $$('[data-kgevolg]', sub).filter((c) => c.checked).map((c) => c.value);
  return v;
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
  const e = eenhedenVan(formulierEenheden, metingBewerkId ? zoekMeting(metingBewerkId).procesId : $('#mProces').value);
  const aantal = leesGetal($('#mAantal').value);
  if (aantal.fout) invoerFouten.push(`Aantal ${e.uitvoeringseenheidMeervoud}: ` + aantal.fout);
  $('#mAantal').classList.toggle('ongeldig', !!aantal.fout || (isGetal(aantal.waarde) && aantal.waarde <= 0));
  const blokken = leesGetal($('#mBlokken').value);
  if (blokken.fout) invoerFouten.push('Aantal resulterende diensttijdblokken: ' + blokken.fout);
  $('#mBlokken').classList.toggle('ongeldig', !!blokken.fout || (isGetal(blokken.waarde) && (blokken.waarde < 0 || !Number.isInteger(blokken.waarde))));
  const omvang = leesGetal($('#mOmvang').value);
  if (omvang.fout) invoerFouten.push(`Omvang (aantal ${e.omvangseenheidMeervoud}): ` + omvang.fout);
  $('#mOmvang').classList.toggle('ongeldig', !!omvang.fout || (isGetal(omvang.waarde) && omvang.waarde <= 0));
  const leesControle = (id, label) => {
    const r = leesGetal($(id).value);
    if (r.fout) invoerFouten.push(`${label}: ${r.fout}`);
    $(id).classList.toggle('ongeldig', !!r.fout || (isGetal(r.waarde) && r.waarde < 0));
    return r.fout ? NaN : r.waarde;
  };
  const actieveTijdTotaal = leesControle('#mActiefTotaal', 'Totale actieve tijd volgens procesmeting');
  const wachttijdTotaal = leesControle('#mWachtTotaal', 'Totale wachttijd volgens procesmeting');
  const casus = $('input[name="casustype"]:checked');
  const pid = metingBewerkId ? zoekMeting(metingBewerkId).procesId : $('#mProces').value;
  const meting = {
    metingId: $('#mMetingId').value,
    datum: $('#mDatum').value,
    procesId: pid,
    procesnaam: metingBewerkId ? zoekMeting(metingBewerkId).procesnaam : procesNaam(pid),
    medewerkerId: $('#mMedewerker').value.trim(),
    casustype: casus ? casus.value : '',
    aantalUitvoeringen: aantal.fout ? NaN : aantal.waarde,
    omvang: omvang.fout ? NaN : omvang.waarde,
    ...formulierEenheden,
    meetwijze: $('#mMeetwijze').value,
    toelichting: $('#mToelichting').value.trim(),
    belangrijksteKnelpunt: $('#mBelangrijksteKnelpunt').value.trim(),
    bijzonderheden: $('#mBijzonderheden').value.trim(),
    actieveTijdTotaal,
    wachttijdTotaal,
  };
  // Alleen vastleggen als het veld bij dit proces wordt gebruikt of al een waarde heeft (oude metingen blijven ongewijzigd).
  if (!$('#mBlokkenVeld').hidden || $('#mBlokken').value.trim()) meting.aantalBlokken = blokken.fout ? NaN : blokken.waarde;
  // Alleen vastleggen als het een test/fictieve meting is; ontbreken = geen testmeting.
  if ($('#mTest').checked) meting.testmeting = true;
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
      ...leesKnelpunt(s.stapId, rij, invoerFouten),
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
  const aantalOk = isGetal(meting.aantalUitvoeringen) && meting.aantalUitvoeringen > 0;
  const e = eenhedenVan(meting);
  const deel = (t, ok, n) => (ok && isGetal(t) ? t / n : null);
  houder.innerHTML = `<span class="etiket berekend">Automatisch berekend (voorbeeld, wordt niet als invoer opgeslagen)</span>
    <div class="velden">
      <div><div class="klein">Totale actieve tijd</div><strong>${htmlGetal(totaalActief, 2, ' min')}</strong></div>
      <div><div class="klein">Totale wachttijd</div><strong>${htmlGetal(totaalWacht, 2, ' min')}</strong></div>
      <div><div class="klein"><strong>Actieve tijd per ${esc(e.uitvoeringseenheid)}</strong> (primair)</div><strong>${htmlGetal(deel(totaalActief, aantalOk, meting.aantalUitvoeringen), 2, ' min')}</strong></div>
      <div><div class="klein">Actieve tijd per ${esc(e.omvangseenheid)} (aanvullend)</div><strong>${htmlGetal(deel(totaalActief, omvangOk, meting.omvang), 2, ' min')}</strong></div>
      <div><div class="klein">Wachttijd per ${esc(e.uitvoeringseenheid)}</div><strong>${htmlGetal(deel(totaalWacht, aantalOk, meting.aantalUitvoeringen), 2, ' min')}</strong></div>
      ${isGetal(meting.aantalBlokken) ? `<div><div class="klein">Actieve tijd per diensttijdblok</div><strong>${htmlGetal(meting.aantalBlokken > 0 && isGetal(totaalActief) ? totaalActief / meting.aantalBlokken : null, 2, ' min')}</strong></div>` : ''}
      <div><div class="klein">Doorlooptijd (actief + wacht) ${infoHtml('doorlooptijd')}</div><strong>${htmlGetal(isGetal(totaalActief) && isGetal(totaalWacht) ? totaalActief + totaalWacht : null, 2, ' min')}</strong></div>
    </div>
    ${controleHtml(controleProcesStap(meting, stapmetingen))}
    ${!actief.every(isGetal) || !wacht.every(isGetal) || !omvangOk || !aantalOk ? '<div class="klein mt">Onbekend = niet alle benodigde velden zijn (geldig) ingevuld. Lege velden worden niet als nul geteld.</div>' : ''}`;
}

async function slaMetingOp() {
  const { meting, stapmetingen, invoerFouten } = leesMetingFormulier();
  // Een nieuwe meting krijgt bij opslaan altijd een vrij MetingID (nooit een bestaande overschrijven).
  if (!metingBewerkId && meting.procesId) meting.metingId = volgendeId('meting', meting.procesId).id;
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
  if (metingBewerkId && metingConceptBasis !== null) {
    const huidig = zoekMeting(metingBewerkId);
    if (huidig && (huidig.gewijzigd || huidig.aangemaakt || '') !== metingConceptBasis) {
      const ok = await bevestig('Meting is intussen gewijzigd',
        `<div class="melding waarschuwing">Meting ${esc(metingBewerkId)} is opgeslagen gewijzigd nadat dit concept is begonnen (laatst gewijzigd: ${esc(fmtTijdstip(huidig.gewijzigd || huidig.aangemaakt))}). Als u nu opslaat, vervangt dit concept die versie.</div><p>Wilt u het concept toch opslaan?</p>`,
        'Concept toch opslaan', true);
      if (!ok) return;
    }
  }
  const wasBewerking = !!metingBewerkId;
  const record = bewaarMeting(meting, stapmetingen, metingBewerkId);
  verwijderConcept('meting');
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
  }
  $$('input[name="casustype"]').forEach((r) => { r.checked = false; });
  $('#mAantal').value = '';
  $('#mOmvang').value = '';
  $('#mBlokken').value = '';
  $('#mBelangrijksteKnelpunt').value = '';
  $('#mBijzonderheden').value = '';
  $('#mActiefTotaal').value = '';
  $('#mWachtTotaal').value = '';
  $('#mTest').checked = false;
  metingConceptBasis = null;
  annuleerMetingConceptTimer();
  $('#mToelichting').value = '';
  vulMetingProcesKeuze();
  const p = zoekProces($('#mProces').value);
  formulierEenheden = p ? eenhedenKopie(p.procesId) : eenhedenKopieLeeg();
  werkEenheidLabelsBij();
  laadProcesStappenInFormulier(p ? p.procesId : null);
  werkMetingIdBij();
  werkKalenderweekBij();
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
  $('#mAantal').value = 'aantalUitvoeringen' in m ? naarInvoer(m.aantalUitvoeringen) : '';
  $('#mOmvang').value = naarInvoer(m.omvang);
  $('#mBlokken').value = naarInvoer(m.aantalBlokken);
  $('#mBelangrijksteKnelpunt').value = m.belangrijksteKnelpunt || '';
  $('#mBijzonderheden').value = m.bijzonderheden || '';
  $('#mActiefTotaal').value = naarInvoer(m.actieveTijdTotaal);
  $('#mWachtTotaal').value = naarInvoer(m.wachttijdTotaal);
  $('#mTest').checked = isTestmeting(m);
  metingConceptBasis = m.gewijzigd || m.aangemaakt || '';
  // Vastgelegde eenheden van de meting; ontbrekende (meting uit versie 1.0) aangevuld vanuit het proces.
  const kopie = eenhedenKopie(m.procesId);
  formulierEenheden = Object.fromEntries(EENHEID_VELDEN.map((k) => [k, m[k] || kopie[k] || '']));
  werkEenheidLabelsBij();
  if (!('aantalUitvoeringen' in m)) {
    $('#metingBewerkMelding').innerHTML += `<div class="melding info">Deze meting is vastgelegd met versie 1.0. Toen was één procesmeting één uitvoering en werd het aantal ${esc(eenhedenVan(m).uitvoeringseenheidMeervoud)} niet apart vastgelegd. Vul het aantal nu zelf in.</div>`;
  }
  $('#mMeetwijze').value = m.meetwijze || '';
  $('#mToelichting').value = m.toelichting || '';
  const sm = stapmetingenVan(metingId);
  formulierStappen = sm.map((s) => ({ stapId: s.stapId, volgorde: s.volgorde, stapnaam: s.stapnaam, tijdvastlegging: s.tijdvastlegging || 'Handmatig' }));
  const waarden = {};
  for (const s of sm) waarden[s.stapId] = s;
  $('#mAnnuleren').textContent = 'Aanpassen annuleren';
  $('#mFouten').innerHTML = '';
  renderMetingStappen(waarden);
  werkKalenderweekBij();
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

function eenhedenKopieLeeg() {
  return Object.fromEntries(EENHEID_VELDEN.map((k) => [k, '']));
}

/** Zet de labels van aantal en omvang in het formulier op de eenheden van het proces. */
function werkEenheidLabelsBij() {
  const pid = metingBewerkId ? zoekMeting(metingBewerkId).procesId : $('#mProces').value;
  $('#mBlokkenVeld').hidden = !(pid && blokkenVastleggen(pid)) && !$('#mBlokken').value.trim();
  if (!pid) {
    $('#mAantalLabel').textContent = 'Aantal uitvoeringen';
    $('#mAantalHint').textContent = 'Kies eerst een proces; de eenheden volgen uit het proces.';
    $('#mOmvangLabel').textContent = 'Omvang';
    $('#mOmvangHint').textContent = 'Positief getal. Leeg laten als onbekend.';
    return;
  }
  const e = eenhedenVan(formulierEenheden, pid);
  $('#mAantalLabel').textContent = `Aantal ${e.uitvoeringseenheidMeervoud} (uitvoeringen)`;
  $('#mAantalHint').textContent = `Uitvoeringseenheid: ${e.uitvoeringseenheid}. Eén uitvoering = één ${e.uitvoeringseenheid}.`;
  $('#mOmvangLabel').textContent = `Omvang: aantal ${e.omvangseenheidMeervoud}`;
  $('#mOmvangHint').textContent = `Omvangseenheid: ${e.omvangseenheid}. Positief getal; leeg laten als onbekend.`;
}

/** Niet-blokkerende waarschuwing bij een verschil tussen procesmeting en stapmetingen. */
function controleHtml(c) {
  if (!c.actief && !c.wacht) return '';
  const regel = (label, x) => (x ? `<tr><td>${label}</td><td class="getal">${esc(fmtGetal(x.procesmeting))}</td><td class="getal">${esc(fmtGetal(x.stapmetingen))}</td><td class="getal${x.afwijking ? ' afwijking' : ''}">${esc(fmtGetal(x.verschil))}</td></tr>` : '');
  const tabel = `<table class="klein" style="max-width:560px;margin-top:6px"><thead><tr><th>Controle</th><th class="getal">Procesmeting (min)</th><th class="getal">Som stapmetingen (min)</th><th class="getal">Verschil (min)</th></tr></thead>
    <tbody>${regel('Actieve tijd', c.actief)}${regel('Wachttijd', c.wacht)}</tbody></table>`;
  if (!c.heeftAfwijking) return `<div class="klein mt">Controle proces- en stapmetingen: geen verschil (tolerantie ${fmtGetal(CONTROLE_TOLERANTIE)} min).</div>${tabel}`;
  return `<div class="melding waarschuwing mt">${controleTekst(c).map(esc).join('<br>')}<br><span class="klein">U kunt de meting toch opslaan; de afwijking wordt vastgelegd in de export. Voor de berekeningen wordt de som van de stapmetingen gebruikt.</span>${tabel}</div>`;
}

// ---------- Meting dupliceren ----------

/** Laadt een kopie van een bestaande meting als NIEUWE meting in het formulier (pas opgeslagen na controle). */
async function dupliceerMeting(metingId) {
  const bron = zoekMeting(metingId);
  if (!bron) return;
  if (!zoekProces(bron.procesId)) {
    await informeer('Dupliceren niet mogelijk', `<p>Proces ${esc(bron.procesId)} bestaat niet meer, dus er kan geen nieuwe meting voor worden aangemaakt.</p>`);
    return;
  }
  if (heeftConcept('meting')) {
    const ok = await bevestig('Huidige invoer vervangen?', '<p>Het formulier Nieuwe procesmeting bevat een niet-opgeslagen concept. Dit wordt vervangen door de kopie.</p>', 'Vervangen door kopie', true);
    if (!ok) return;
  }
  resetMetingFormulier(false);
  $('#mProces').value = bron.procesId;
  formulierEenheden = eenhedenKopie(bron.procesId);
  werkEenheidLabelsBij();
  // Stappen volgens de huidige procesdefinitie; waarden overnemen waar de StapID overeenkomt.
  laadProcesStappenInFormulier(bron.procesId);
  const waarden = {};
  for (const s of stapmetingenVan(metingId)) {
    const stap = formulierStappen.find((x) => x.stapId === s.stapId);
    if (!stap) continue;
    waarden[s.stapId] = { ...s };
    stap.tijdvastlegging = 'Gekopieerd';
  }
  $('#mDatum').value = vandaagIso();
  $('#mMedewerker').value = bron.medewerkerId || '';
  $$('input[name="casustype"]').forEach((r) => { r.checked = r.value === bron.casustype; });
  $('#mAantal').value = 'aantalUitvoeringen' in bron ? naarInvoer(bron.aantalUitvoeringen) : '';
  $('#mOmvang').value = naarInvoer(bron.omvang);
  $('#mBlokken').value = naarInvoer(bron.aantalBlokken);
  $('#mBelangrijksteKnelpunt').value = bron.belangrijksteKnelpunt || '';
  $('#mBijzonderheden').value = bron.bijzonderheden || '';
  $('#mMeetwijze').value = bron.meetwijze || '';
  $('#mToelichting').value = bron.toelichting || '';
  $('#mActiefTotaal').value = naarInvoer(bron.actieveTijdTotaal);
  $('#mWachtTotaal').value = naarInvoer(bron.wachttijdTotaal);
  $('#mTest').checked = isTestmeting(bron);
  renderMetingStappen(waarden);
  werkEenheidLabelsBij();
  werkMetingIdBij();
  werkKalenderweekBij();
  $('#metingBewerkMelding').innerHTML = `<div class="melding info"><strong>Kopie van meting ${esc(metingId)} – nog niet opgeslagen.</strong>
    De meetdatum is op vandaag gezet en de meting krijgt een nieuw MetingID. Controleer en pas zo nodig medewerker, omvang, tijden, casustype en toelichting aan, en sla daarna op.
    Gekopieerde tijden zijn gemarkeerd als "Gekopieerd".</div>`;
  toonTab('meting');
  bewaarMetingConcept();
}

// ---------- Concept: automatisch tussentijds opslaan ----------

let metingConceptBasis = null; // bij aanpassen: 'gewijzigd'-tijdstip van de meting bij het begin van het concept
let metingConceptTimer = null;

function planMetingConcept() {
  clearTimeout(metingConceptTimer);
  metingConceptTimer = setTimeout(() => { metingConceptTimer = null; bewaarMetingConcept(); }, 400);
}

function annuleerMetingConceptTimer() {
  clearTimeout(metingConceptTimer);
  metingConceptTimer = null;
}

/** Alleen echte invoer is een concept waard (niet alleen een gekozen proces). */
function metingConceptHeeftInhoud(g) {
  const v = g.velden;
  return !!(g.bewerkId || v.medewerker || v.casustype || v.aantal || v.omvang || v.blokken || v.belangrijksteKnelpunt || v.bijzonderheden || v.toelichting || v.actiefTotaal || v.wachtTotaal || v.test
    || Object.values(g.waarden).some((w) => Object.values(w).some((x) => String(x).trim() !== ''))
    || /Kopie van meting/.test(g.melding || ''));
}

function metingConceptGegevens() {
  const waarden = {};
  for (const rij of $$('tr[data-stap]', $('#mStappen'))) {
    waarden[rij.dataset.stap] = {
      ...Object.fromEntries(['actieveTijd', 'wachttijd', 'redenWachttijd', 'opmerking'].map((v) => [v, $(`[data-veld="${v}"]`, rij).value])),
      ...knelpuntConceptWaarden(rij),
    };
  }
  const casus = $('input[name="casustype"]:checked');
  return {
    bewerkId: metingBewerkId,
    basis: metingConceptBasis,
    melding: $('#metingBewerkMelding').innerHTML,
    procesId: metingBewerkId ? zoekMeting(metingBewerkId).procesId : $('#mProces').value,
    velden: {
      datum: $('#mDatum').value, medewerker: $('#mMedewerker').value, casustype: casus ? casus.value : '',
      aantal: $('#mAantal').value, omvang: $('#mOmvang').value, blokken: $('#mBlokken').value,
      belangrijksteKnelpunt: $('#mBelangrijksteKnelpunt').value, bijzonderheden: $('#mBijzonderheden').value, meetwijze: $('#mMeetwijze').value, toelichting: $('#mToelichting').value,
      actiefTotaal: $('#mActiefTotaal').value, wachtTotaal: $('#mWachtTotaal').value, test: $('#mTest').checked,
    },
    stappen: formulierStappen,
    waarden,
  };
}

function bewaarMetingConcept() {
  annuleerMetingConceptTimer();
  const g = metingConceptGegevens();
  if (!g.procesId || !metingConceptHeeftInhoud(g)) { if (heeftConcept('meting') && !g.bewerkId) verwijderConcept('meting'); return; }
  if (bewaarConcept('meting', g)) toonConceptStatus('m', true);
  else toonConceptStatus('m', false);
}

function herstelMetingConcept() {
  const c = laadConcept('meting');
  if (!c || !c.gegevens || !c.gegevens.procesId) return false;
  const g = c.gegevens;
  if (g.bewerkId) {
    if (!zoekMeting(g.bewerkId)) { verwijderConcept('meting'); return false; }
    bewerkMeting(g.bewerkId);
    metingConceptBasis = g.basis;
  } else {
    if (!zoekProces(g.procesId)) { verwijderConcept('meting'); return false; }
    resetMetingFormulier(false);
    $('#mProces').value = g.procesId;
    formulierEenheden = eenhedenKopie(g.procesId);
    werkEenheidLabelsBij();
  }
  const v = g.velden;
  $('#mDatum').value = v.datum || '';
  $('#mMedewerker').value = v.medewerker || '';
  $$('input[name="casustype"]').forEach((r) => { r.checked = r.value === v.casustype; });
  $('#mAantal').value = v.aantal || '';
  $('#mOmvang').value = v.omvang || '';
  $('#mBlokken').value = v.blokken || '';
  $('#mBelangrijksteKnelpunt').value = v.belangrijksteKnelpunt || '';
  $('#mBijzonderheden').value = v.bijzonderheden || '';
  $('#mMeetwijze').value = v.meetwijze || '';
  $('#mToelichting').value = v.toelichting || '';
  $('#mActiefTotaal').value = v.actiefTotaal || '';
  $('#mWachtTotaal').value = v.wachtTotaal || '';
  $('#mTest').checked = !!v.test;
  formulierStappen = Array.isArray(g.stappen) ? g.stappen : formulierStappen;
  renderMetingStappen(g.waarden || {});
  werkEenheidLabelsBij();
  werkMetingIdBij();
  werkKalenderweekBij();
  $('#metingBewerkMelding').innerHTML = `<div class="melding info"><strong>Niet-afgerond concept hersteld</strong> (automatisch opgeslagen op ${esc(fmtTijdstip(c.opgeslagen))}).
    Controleer de invoer en sla de meting op, of verwijder het concept.${g.bewerkId ? ` Dit is een concept voor het aanpassen van meting ${esc(g.bewerkId)}.` : ''}</div>`;
  toonConceptStatus('m', true, c.opgeslagen);
  return true;
}

async function verwijderMetingConceptMetBevestiging() {
  const ok = await bevestig('Concept verwijderen', '<p>Het automatisch opgeslagen concept en de niet-opgeslagen invoer in het formulier worden verwijderd. Opgeslagen metingen blijven ongewijzigd.</p>', 'Concept verwijderen', true);
  if (!ok) return;
  const wasBewerking = !!metingBewerkId;
  verwijderConcept('meting');
  resetMetingFormulier(false);
  toonMelding('Concept verwijderd.');
  if (wasBewerking) toonTab('overzicht');
}
