// ---------- 3. Frequentie registreren ----------

let frequentieBewerkId = null;
let frequentieEenheden = null; // kopie van de eenheden van het proces (of van de bestaande frequentiemeting)

function vulFrequentieProcesKeuze() {
  const select = $('#fProces');
  if (frequentieBewerkId) return;
  const huidig = select.value;
  vulSelect(select, staat.processen.map((p) => ({ waarde: p.procesId, label: `${p.procesId} – ${p.naam}${p.demo ? ' [DEMO]' : ''}` })), huidig, staat.processen.length ? '— Kies een proces —' : '— Leg eerst een proces vast (tabblad 1) —');
  werkFrequentieIdBij();
  frequentieEenheden = select.value ? eenhedenKopie(select.value) : null;
  werkFrequentieLabelsBij();
}

function werkFrequentieIdBij() {
  const pid = $('#fProces').value;
  $('#fId').value = frequentieBewerkId || (pid ? volgendeId('frequentie', pid).id : '');
}

function initFrequentieFormulier() {
  vulSelect($('#fMeetwijze'), MEETWIJZEN_FREQUENTIE.map((m) => ({ waarde: m, label: MEETWIJZE_FREQUENTIE_LABELS[m] || m })), null, '— Kies de meetwijze / bron —');
  vulSelect($('#fPeriodeEenheid'), PERIODE_EENHEDEN.map((p) => ({ waarde: p, label: 'per ' + p.toLowerCase() })), null, '— Nog niet bepaald —');
  vulSelect($('#fBereik'), BEREIKEN, null, '— Nog niet bepaald —');
  // Bij een oudere frequentiemeting staat 'Meetellen in totaal' op 'nog niet bepaald' (onbepaald vinkje)
  // tot de gebruiker het vinkje zelf aanklikt.
  $('#fMeetellen').addEventListener('change', () => { $('#fMeetellen').dataset.onbepaald = ''; werkMeetellenStatusBij(); });
  vulFrequentieProcesKeuze();
  $('#fProces').addEventListener('change', () => {
    const p = zoekProces($('#fProces').value);
    frequentieEenheden = p ? eenhedenKopie(p.procesId) : null;
    werkFrequentieLabelsBij();
    werkFrequentieIdBij();
  });
  $('#frequentieFormulier').addEventListener('submit', (e) => { e.preventDefault(); slaFrequentieOp(); });
  $('#fDatum').value = vandaagIso();
  const bijInvoer = () => { werkFrequentieKalenderweekBij(); planFrequentieConcept(); };
  $('#frequentieFormulier').addEventListener('input', bijInvoer);
  $('#frequentieFormulier').addEventListener('change', bijInvoer);
  werkFrequentieKalenderweekBij();
}

function werkFrequentieKalenderweekBij() {
  const v = $('#fDatum').value;
  $('#fKalenderweek').textContent = v ? `Meetmoment: ${kalenderweekTekst(v)}` : 'Optioneel. Zonder meetdatum is de kalenderweek onbekend.';
}

async function slaFrequentieOp() {
  const fouten = [];
  const aantal = leesGetal($('#fAantal').value);
  const volume = leesGetal($('#fVolume').value);
  const e = eenhedenVan(frequentieEenheden, frequentieBewerkId ? zoekFrequentie(frequentieBewerkId).procesId : $('#fProces').value);
  if (aantal.fout) fouten.push(`Aantal ${e.uitvoeringseenheidMeervoud}: ` + aantal.fout);
  if (volume.fout) fouten.push(`Totale omvang (aantal ${e.omvangseenheidMeervoud}): ` + volume.fout);
  $('#fAantal').classList.toggle('ongeldig', !!aantal.fout);
  $('#fVolume').classList.toggle('ongeldig', !!volume.fout);
  if ($('#fDatum').value && !isGeldigeDatum($('#fDatum').value)) fouten.push('De meetdatum is ongeldig.');
  const f = {
    frequentieId: frequentieBewerkId || volgendeId('frequentie', $('#fProces').value || '-').id,
    procesId: frequentieBewerkId ? zoekFrequentie(frequentieBewerkId).procesId : $('#fProces').value,
    meetperiode: $('#fPeriode').value.trim(),
    aantalUitvoeringen: aantal.fout ? NaN : aantal.waarde,
    totaalVolume: volume.fout ? NaN : volume.waarde,
    ...(frequentieEenheden || eenhedenKopie(null)),
    meetwijze: $('#fMeetwijze').value,
    bron: $('#fBron').value.trim(),
    medewerkerId: $('#fMedewerker').value.trim(),
    periodeEenheid: $('#fPeriodeEenheid').value || null,
    bereik: $('#fBereik').value || null,
    afbakening: $('#fAfbakening').value.trim(),
    meetdatum: $('#fDatum').value || null,
  };
  if ($('#fTest').checked) f.testmeting = true;
  // Alleen vastleggen als de gebruiker een keuze heeft gemaakt; anders blijft het 'nog niet bepaald'.
  if ($('#fMeetellen').dataset.onbepaald !== '1') f.meetellenInTotaal = $('#fMeetellen').checked;
  if (!fouten.length) fouten.push(...valideerFrequentie(f, frequentieBewerkId));
  $('#fFouten').innerHTML = foutenHtml(fouten, 'De frequentie is nog niet opgeslagen. Controleer het volgende:');
  if (fouten.length) return;
  if (f.medewerkerId && !/^[A-Za-z]{1,4}-?\d{1,4}$/.test(f.medewerkerId)) {
    const ok = await bevestig('Controleer de MedewerkerID', `<p>MedewerkerID "${esc(f.medewerkerId)}" lijkt geen anonieme code. Gebruik een code zoals PZ01 en nooit een echte naam.</p><p>Toch opslaan?</p>`, 'Toch opslaan');
    if (!ok) return;
  }
  if (f.aantalUitvoeringen === null) {
    const ok = await bevestig('Aantal uitvoeringen ontbreekt', '<p>Zonder aantal uitvoeringen kan geen geschatte tijdsbelasting worden berekend. Wilt u de frequentie toch opslaan?</p>', 'Toch opslaan');
    if (!ok) return;
  }
  const wasBewerking = !!frequentieBewerkId;
  // Bij aanpassen blijft een eerder 'nog niet bepaald' meetellen-veld ontbreken als de gebruiker het niet heeft aangeraakt.
  const record = bewaarFrequentie(f, frequentieBewerkId);
  verwijderConcept('frequentie');
  resetFrequentieFormulier();
  await naWijziging(`Frequentiemeting ${record.frequentieId} is ${wasBewerking ? 'bijgewerkt' : 'opgeslagen'}.`);
  if (wasBewerking) toonTab('overzicht');
}

function resetFrequentieFormulier() {
  frequentieBewerkId = null;
  $('#frequentieTitel').textContent = 'Frequentie registreren';
  $('#frequentieBewerkMelding').innerHTML = '';
  $('#fFouten').innerHTML = '';
  $('#fProces').disabled = false;
  $('#fAnnuleren').textContent = 'Formulier leegmaken';
  for (const id of ['#fPeriode', '#fAantal', '#fVolume', '#fBron', '#fMedewerker', '#fAfbakening']) $(id).value = '';
  for (const id of ['#fMeetwijze', '#fPeriodeEenheid', '#fBereik']) $(id).value = '';
  $('#fMeetellen').checked = false;
  $('#fTest').checked = false;
  $('#fDatum').value = vandaagIso();
  annuleerFrequentieConceptTimer();
  $('#fMeetellen').indeterminate = false;
  $('#fMeetellen').dataset.onbepaald = '';
  werkMeetellenStatusBij();
  vulFrequentieProcesKeuze();
  const p = zoekProces($('#fProces').value);
  frequentieEenheden = p ? eenhedenKopie(p.procesId) : null;
  werkFrequentieLabelsBij();
}

function bewerkFrequentie(frequentieId) {
  const f = zoekFrequentie(frequentieId);
  if (!f) return;
  frequentieBewerkId = frequentieId;
  $('#frequentieTitel').textContent = `Frequentiemeting ${frequentieId} aanpassen`;
  $('#frequentieBewerkMelding').innerHTML = `<div class="melding waarschuwing">U past de opgeslagen ruwe invoer van frequentiemeting <strong>${esc(frequentieId)}</strong> aan. Het tijdstip van de wijziging wordt vastgelegd.</div>`;
  vulSelect($('#fProces'), [{ waarde: f.procesId, label: procesLabel(f.procesId) }], f.procesId);
  $('#fProces').disabled = true;
  $('#fId').value = f.frequentieId;
  $('#fPeriode').value = f.meetperiode || '';
  $('#fAantal').value = naarInvoer(f.aantalUitvoeringen);
  $('#fVolume').value = naarInvoer(f.totaalVolume);
  const kopie = eenhedenKopie(f.procesId);
  frequentieEenheden = Object.fromEntries(EENHEID_VELDEN.map((k) => [k, f[k] || kopie[k] || '']));
  werkFrequentieLabelsBij();
  $('#fMeetwijze').value = f.meetwijze || '';
  $('#fBron').value = f.bron || '';
  $('#fMedewerker').value = f.medewerkerId || '';
  $('#fPeriodeEenheid').value = f.periodeEenheid || '';
  $('#fBereik').value = f.bereik || '';
  $('#fAfbakening').value = f.afbakening || '';
  $('#fDatum').value = f.meetdatum || '';
  $('#fTest').checked = isTestmeting(f);
  werkFrequentieKalenderweekBij();
  const onbepaald = typeof f.meetellenInTotaal !== 'boolean';
  $('#fMeetellen').checked = f.meetellenInTotaal === true;
  $('#fMeetellen').indeterminate = onbepaald;
  $('#fMeetellen').dataset.onbepaald = onbepaald ? '1' : '';
  werkMeetellenStatusBij();
  $('#fAnnuleren').textContent = 'Aanpassen annuleren';
  $('#fFouten').innerHTML = '';
  toonTab('frequentie');
}

function renderFrequentieRecent() {
  const lijst = [...staat.frequentiemetingen].sort((a, b) => String(b.aangemaakt || '').localeCompare(String(a.aangemaakt || ''))).slice(0, 8);
  $('#frequentieRecent').innerHTML = lijst.length
    ? `<table><thead><tr><th>FrequentieID</th><th>Proces</th><th>Meetperiode</th><th class="getal">Aantal uitvoeringen</th><th class="getal">Totale omvang</th><th>Meetwijze</th></tr></thead><tbody>
      ${lijst.map((f) => `<tr><td class="mono">${esc(f.frequentieId)}${demoLabel(f)}</td><td>${esc(procesLabel(f.procesId))}</td><td>${htmlTekst(f.meetperiode)}${f.meetdatum ? `<br><span class="klein zacht">${esc(kalenderweekTekst(f.meetdatum, true))}</span>` : ''}${testLabel(f)}</td>
        <td class="getal">${htmlMetEenheid(f.aantalUitvoeringen, eenhedenVan(f), 'uitvoering')}</td><td class="getal">${htmlMetEenheid(f.totaalVolume, eenhedenVan(f), 'omvang')}</td><td>${meetwijzeHtml(f.meetwijze)}</td></tr>`).join('')}
      </tbody></table><p class="klein zacht">Alle frequentiemetingen staan onder <em>Metingen bekijken</em>.</p>`
    : '<p class="zacht">Nog geen frequentiemetingen.</p>';
}

function werkFrequentieLabelsBij() {
  const pid = frequentieBewerkId ? zoekFrequentie(frequentieBewerkId).procesId : $('#fProces').value;
  if (!pid) {
    $('#fAantalLabel').textContent = 'Aantal uitvoeringen';
    $('#fVolumeLabel').textContent = 'Totale omvang';
    return;
  }
  const e = eenhedenVan(frequentieEenheden, pid);
  $('#fAantalLabel').textContent = `Aantal ${e.uitvoeringseenheidMeervoud} (uitvoeringen) in de meetperiode`;
  $('#fAantalHint').textContent = `Nodig voor de geschatte tijdsbelasting: aantal ${e.uitvoeringseenheidMeervoud} × mediane actieve tijd per ${e.uitvoeringseenheid}.`;
  $('#fVolumeLabel').textContent = `Totaal aantal ${e.omvangseenheidMeervoud} in de meetperiode`;
  $('#fVolumeHint').textContent = 'Mag onbekend blijven (leeg laten). Wordt niet gebruikt in de tijdsbelasting.';
}

function meetellenTekst(f) {
  return f.meetellenInTotaal === true ? 'Ja' : f.meetellenInTotaal === false ? 'Nee' : 'Nog niet bepaald';
}

function werkMeetellenStatusBij() {
  const el = $('#fMeetellen');
  $('#fMeetellenStatus').textContent = el.dataset.onbepaald === '1'
    ? 'Huidige stand: nog niet bepaald (vastgelegd met een eerdere versie). Deze frequentie telt niet mee in het totaal tot u het vinkje aan- of uitzet.'
    : '';
}

// ---------- Concept frequentiemeting ----------

let frequentieConceptTimer = null;
const FREQ_CONCEPT_VELDEN = ['fProces', 'fMedewerker', 'fPeriode', 'fDatum', 'fPeriodeEenheid', 'fAantal', 'fVolume', 'fMeetwijze', 'fBereik', 'fAfbakening', 'fBron'];

function planFrequentieConcept() {
  clearTimeout(frequentieConceptTimer);
  frequentieConceptTimer = setTimeout(() => { frequentieConceptTimer = null; bewaarFrequentieConcept(); }, 400);
}

function annuleerFrequentieConceptTimer() {
  clearTimeout(frequentieConceptTimer);
  frequentieConceptTimer = null;
}

function bewaarFrequentieConcept() {
  annuleerFrequentieConceptTimer();
  const velden = Object.fromEntries(FREQ_CONCEPT_VELDEN.map((id) => [id, $('#' + id).value]));
  const g = { bewerkId: frequentieBewerkId, velden, meetellen: $('#fMeetellen').checked, onbepaald: $('#fMeetellen').dataset.onbepaald || '', test: $('#fTest').checked };
  const inhoud = frequentieBewerkId || ['fMedewerker', 'fPeriode', 'fAantal', 'fVolume', 'fAfbakening', 'fBron'].some((id) => velden[id].trim()) || g.meetellen || g.test;
  if (!velden.fProces || !inhoud) { if (!frequentieBewerkId && heeftConcept('frequentie')) verwijderConcept('frequentie'); return; }
  toonConceptStatus('f', bewaarConcept('frequentie', g));
}

function herstelFrequentieConcept() {
  const c = laadConcept('frequentie');
  if (!c || !c.gegevens || !c.gegevens.velden) return false;
  const g = c.gegevens;
  if (g.bewerkId) {
    if (!zoekFrequentie(g.bewerkId)) { verwijderConcept('frequentie'); return false; }
    bewerkFrequentie(g.bewerkId);
  } else {
    if (!zoekProces(g.velden.fProces)) { verwijderConcept('frequentie'); return false; }
    resetFrequentieFormulier();
  }
  for (const id of FREQ_CONCEPT_VELDEN) if (!(g.bewerkId && id === 'fProces')) $('#' + id).value = g.velden[id] || '';
  if (!g.bewerkId) {
    frequentieEenheden = eenhedenKopie(g.velden.fProces);
    werkFrequentieIdBij();
  }
  werkFrequentieLabelsBij();
  $('#fMeetellen').checked = !!g.meetellen;
  $('#fMeetellen').dataset.onbepaald = g.onbepaald || '';
  $('#fMeetellen').indeterminate = g.onbepaald === '1';
  $('#fTest').checked = !!g.test;
  werkMeetellenStatusBij();
  werkFrequentieKalenderweekBij();
  $('#frequentieBewerkMelding').innerHTML = `<div class="melding info"><strong>Niet-afgerond concept hersteld</strong> (automatisch opgeslagen op ${esc(fmtTijdstip(c.opgeslagen))}). Controleer de invoer en sla op, of verwijder het concept.${g.bewerkId ? ` Concept voor het aanpassen van ${esc(g.bewerkId)}.` : ''}</div>`;
  toonConceptStatus('f', true, c.opgeslagen);
  return true;
}

async function verwijderFrequentieConceptMetBevestiging() {
  const ok = await bevestig('Concept verwijderen', '<p>Het automatisch opgeslagen concept en de niet-opgeslagen invoer in het formulier worden verwijderd. Opgeslagen frequentiemetingen blijven ongewijzigd.</p>', 'Concept verwijderen', true);
  if (!ok) return;
  const was = !!frequentieBewerkId;
  verwijderConcept('frequentie');
  resetFrequentieFormulier();
  toonMelding('Concept verwijderd.');
  if (was) toonTab('overzicht');
}
