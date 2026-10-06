// ---------- Algemene interfacefuncties ----------

const $ = (sel, ouder = document) => ouder.querySelector(sel);
const $$ = (sel, ouder = document) => [...ouder.querySelectorAll(sel)];

let actieveTab = 'processen';

function toonTab(naam) {
  actieveTab = naam;
  for (const s of $$('section.tab')) s.hidden = s.id !== 'tab-' + naam;
  for (const b of $$('#tabs button')) b.classList.toggle('actief', b.dataset.tab === naam);
  if (naam === 'resultaten') renderResultaten();
  if (naam === 'steekproeven') renderSteekproeven();
  if (naam === 'overzicht') renderOverzicht();
  if (naam === 'importexport') renderImportExport();
  try { sessionStorage.setItem('meettool-tab', naam); } catch (e) { /* niet kritiek */ }
  window.scrollTo(0, 0);
}

function toonMelding(tekst, isFout = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isFout ? ' fout' : '');
  el.textContent = tekst;
  $('#meldingen').appendChild(el);
  setTimeout(() => el.remove(), isFout ? 8000 : 3500);
}

function foutenHtml(fouten, titel = 'Controleer de invoer:') {
  if (!fouten.length) return '';
  return `<div class="melding fout"><strong>${esc(titel)}</strong><ul>${fouten.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
}

/**
 * Toont een dialoogvenster en wacht op een keuze.
 * knoppen: [{ label, waarde, soort: 'primair' | 'gevaar' | undefined }]
 * Geeft de waarde van de gekozen knop terug, of null bij sluiten met Escape.
 */
function dialoog({ titel, inhoud, knoppen }) {
  const d = $('#dialoog');
  $('#dialoogKop').textContent = titel;
  $('#dialoogInhoud').innerHTML = inhoud;
  const houder = $('#dialoogKnoppen');
  houder.innerHTML = '';
  return new Promise((resolve) => {
    let klaar = false;
    const sluit = (waarde) => {
      if (klaar) return;
      klaar = true;
      d.removeEventListener('cancel', bijAnnuleren);
      if (d.open) d.close();
      resolve(waarde);
    };
    const bijAnnuleren = (e) => { e.preventDefault(); sluit(null); };
    d.addEventListener('cancel', bijAnnuleren);
    for (const k of knoppen) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = k.label;
      if (k.soort) b.className = k.soort;
      b.addEventListener('click', () => {
        if (k.controle && !k.controle()) return;
        sluit(k.waarde);
      });
      houder.appendChild(b);
    }
    d.showModal();
    const eerste = houder.querySelector('button');
    if (eerste) eerste.focus();
  });
}

async function bevestig(titel, tekstHtml, bevestigLabel = 'Ja', gevaarlijk = false) {
  const keuze = await dialoog({
    titel,
    inhoud: tekstHtml,
    knoppen: [
      { label: 'Annuleren', waarde: false },
      { label: bevestigLabel, waarde: true, soort: gevaarlijk ? 'gevaar' : 'primair' },
    ],
  });
  return keuze === true;
}

function informeer(titel, inhoud) {
  return dialoog({ titel, inhoud, knoppen: [{ label: 'Sluiten', waarde: true, soort: 'primair' }] });
}

function vulSelect(select, opties, gekozen, legeOptie) {
  const html = [];
  if (legeOptie !== undefined) html.push(`<option value="">${esc(legeOptie)}</option>`);
  for (const o of opties) {
    const waarde = typeof o === 'object' ? o.waarde : o;
    const label = typeof o === 'object' ? o.label : o;
    html.push(`<option value="${esc(waarde)}">${esc(label)}</option>`);
  }
  select.innerHTML = html.join('');
  if (gekozen !== undefined && gekozen !== null && [...select.options].some((o) => o.value === gekozen)) select.value = gekozen;
}

function testLabel(record) {
  return isTestmeting(record) ? '<span class="testlabel" title="Test/fictieve meting">TEST</span>' : '';
}

function demoLabel(record) {
  return record && record.demo ? '<span class="demolabel">DEMO</span>' : '';
}

/** Getal met de juiste eenheid, bijv. "1 dossier" of "7 dienstperioden". soort: 'uitvoering' | 'omvang'. */
function fmtMetEenheid(n, e, soort) {
  if (!isGetal(n)) return ONBEKEND;
  const enk = soort === 'uitvoering' ? e.uitvoeringseenheid : e.omvangseenheid;
  const mv = soort === 'uitvoering' ? e.uitvoeringseenheidMeervoud : e.omvangseenheidMeervoud;
  return `${fmtAantal(n)} ${n === 1 ? enk : mv}`;
}

function htmlMetEenheid(n, e, soort) {
  return isGetal(n) ? esc(fmtMetEenheid(n, e, soort)) : `<span class="onbekend">${ONBEKEND}</span>`;
}

/** Melding voor metingen uit versie 1.0 zonder vastgelegd aantal uitvoeringen (optioneel beperkt tot één proces). */
function legacyMeldingHtml(procesId) {
  const lijst = metingenZonderAantalUitvoeringen().filter((m) => !procesId || m.procesId === procesId);
  if (!lijst.length) return '';
  return `<div class="melding waarschuwing"><strong>${lijst.length} meting(en) zonder vastgelegd aantal uitvoeringen.</strong>
    Deze metingen zijn vastgelegd met versie 1.0, waarin één procesmeting als één uitvoering gold maar het aantal niet werd opgeslagen.
    Hun tijd per uitvoering is daarom Onbekend en telt niet mee in de primaire uitkomst. U kunt het aantal per meting aanpassen, of voor al deze metingen in één keer 1 vastleggen.
    <div class="knoppen" style="margin-top:8px"><button type="button" class="klein" data-actie="aantal-aanvullen" data-proces="${esc(procesId || '')}">Aantal uitvoeringen aanvullen…</button></div></div>`;
}

async function vulAantalUitvoeringenAanMetBevestiging(procesId) {
  const lijst = metingenZonderAantalUitvoeringen().filter((m) => !procesId || m.procesId === procesId);
  if (!lijst.length) return;
  const ok = await bevestig('Aantal uitvoeringen aanvullen',
    `<p>Voor de volgende ${lijst.length} meting(en) wordt het aantal uitvoeringen op <strong>1</strong> gezet:</p>
     <p class="mono klein">${esc(lijst.map((m) => m.metingId).join(', '))}</p>
     <div class="melding info">Dit volgt de definitie van versie 1.0 (één procesmeting = één uitvoering). Per meting wordt vastgelegd dat dit aantal is aangevuld, door wie (de gebruiker) en wanneer. Deze herkomst staat ook in de exports.</div>
     <p>Klopt dit niet voor een meting (bijvoorbeeld omdat er meerdere ${esc(eenhedenVan(lijst[0]).uitvoeringseenheidMeervoud)} in één meting zaten)? Annuleer dan en pas die meting afzonderlijk aan.</p>`,
    'Aantal = 1 vastleggen');
  if (!ok) return;
  vulAantalUitvoeringenAan(lijst.map((m) => m.metingId));
  await naWijziging(`Aantal uitvoeringen aangevuld voor ${lijst.length} meting(en).`);
}

function meetwijzeHtml(meetwijze) {
  if (!meetwijze) return htmlTekst(meetwijze);
  return /geschat/i.test(meetwijze) ? `<span class="schatting">${esc(meetwijze)}</span>` : esc(meetwijze);
}

// ---------- Opslaan na iedere wijziging ----------

async function naWijziging(melding) {
  renderAlles();
  try {
    await Opslag.bewaar(staat);
    werkOpslagStatusBij();
    if (melding) toonMelding(melding);
  } catch (e) {
    werkOpslagStatusBij(e);
    toonMelding('Let op: de wijziging kon niet lokaal worden opgeslagen. Download direct een back-up. (' + (e && e.message ? e.message : e) + ')', true);
  }
}

function werkOpslagStatusBij(fout) {
  const el = $('#opslagStatus');
  el.classList.toggle('fout', !!fout || Opslag.modus === 'geen');
  if (Opslag.modus === 'geen') {
    el.textContent = 'Geen lokale opslag beschikbaar: gegevens gaan verloren bij sluiten. Gebruik de JSON-back-up.';
  } else if (fout) {
    el.textContent = 'Opslaan mislukt – download een back-up';
  } else if (Opslag.laatsteOpslag) {
    const t = Opslag.laatsteOpslag;
    el.textContent = `Automatisch opgeslagen om ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')} (lokaal op dit apparaat)`;
  } else {
    el.textContent = 'Gegevens worden lokaal op dit apparaat opgeslagen';
  }
}

function werkDemoBalkBij() {
  $('#demoBalk').hidden = !bevatDemo();
}

function renderAlles() {
  werkDemoBalkBij();
  renderProcessenLijst();
  vulMetingProcesKeuze();
  werkDossierVeldenBij();
  vulFrequentieProcesKeuze();
  renderFrequentieRecent();
  if (actieveTab === 'steekproeven') renderSteekproeven();
  if (actieveTab === 'overzicht') renderOverzicht();
  if (actieveTab === 'resultaten') renderResultaten();
  if (actieveTab === 'importexport') renderImportExport();
}

/** Vraagt bij aanwezigheid van demogegevens om bevestiging voordat er wordt geëxporteerd. */
async function bevestigExportMetDemo() {
  if (!bevatDemo()) return true;
  return bevestig(
    'Export bevat demogegevens',
    `<div class="melding waarschuwing"><strong>Let op:</strong> de huidige gegevens bevatten fictieve demogegevens.</div>
     <p>De export wordt gemarkeerd als <strong>MET DEMOGEGEVENS</strong> (in de bestandsnaam en in de inhoud). Gebruik deze export niet als echte onderzoeksdata. Verwijder de demogegevens eerst als u alleen echte metingen wilt exporteren.</p>`,
    'Toch exporteren',
    true
  );
}

function bestandsnaamMetDemo(basis, extensie) {
  return `${basis}${bevatDemo() ? '_MET-DEMOGEGEVENS' : ''}_${bestandsdatum()}.${extensie}`;
}
