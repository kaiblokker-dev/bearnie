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
  vulSelect($('#fMeetwijze'), MEETWIJZEN_FREQUENTIE, null, '— Kies de meetwijze —');
  vulFrequentieProcesKeuze();
  $('#fProces').addEventListener('change', () => {
    const p = zoekProces($('#fProces').value);
    frequentieEenheden = p ? eenhedenKopie(p.procesId) : null;
    werkFrequentieLabelsBij();
    werkFrequentieIdBij();
  });
  $('#frequentieFormulier').addEventListener('submit', (e) => { e.preventDefault(); slaFrequentieOp(); });
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
  const f = {
    frequentieId: $('#fId').value,
    procesId: frequentieBewerkId ? zoekFrequentie(frequentieBewerkId).procesId : $('#fProces').value,
    meetperiode: $('#fPeriode').value.trim(),
    aantalUitvoeringen: aantal.fout ? NaN : aantal.waarde,
    totaalVolume: volume.fout ? NaN : volume.waarde,
    ...(frequentieEenheden || eenhedenKopie(null)),
    meetwijze: $('#fMeetwijze').value,
    bron: $('#fBron').value.trim(),
  };
  if (!fouten.length) fouten.push(...valideerFrequentie(f, frequentieBewerkId));
  $('#fFouten').innerHTML = foutenHtml(fouten, 'De frequentie is nog niet opgeslagen. Controleer het volgende:');
  if (fouten.length) return;
  if (f.aantalUitvoeringen === null) {
    const ok = await bevestig('Aantal uitvoeringen ontbreekt', '<p>Zonder aantal uitvoeringen kan geen geschatte tijdsbelasting worden berekend. Wilt u de frequentie toch opslaan?</p>', 'Toch opslaan');
    if (!ok) return;
  }
  const wasBewerking = !!frequentieBewerkId;
  const record = bewaarFrequentie(f, frequentieBewerkId);
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
  for (const id of ['#fPeriode', '#fAantal', '#fVolume', '#fBron']) $(id).value = '';
  $('#fMeetwijze').value = '';
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
  $('#fAnnuleren').textContent = 'Aanpassen annuleren';
  $('#fFouten').innerHTML = '';
  toonTab('frequentie');
}

function renderFrequentieRecent() {
  const lijst = [...staat.frequentiemetingen].sort((a, b) => String(b.aangemaakt || '').localeCompare(String(a.aangemaakt || ''))).slice(0, 8);
  $('#frequentieRecent').innerHTML = lijst.length
    ? `<table><thead><tr><th>FrequentieID</th><th>Proces</th><th>Meetperiode</th><th class="getal">Aantal uitvoeringen</th><th class="getal">Totale omvang</th><th>Meetwijze</th></tr></thead><tbody>
      ${lijst.map((f) => `<tr><td class="mono">${esc(f.frequentieId)}${demoLabel(f)}</td><td>${esc(procesLabel(f.procesId))}</td><td>${htmlTekst(f.meetperiode)}</td>
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
