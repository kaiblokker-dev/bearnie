// ---------- Algemene interfacefuncties ----------

const $ = (sel, ouder = document) => ouder.querySelector(sel);
const $$ = (sel, ouder = document) => [...ouder.querySelectorAll(sel)];

let actieveTab = 'processen';

function toonTab(naam) {
  actieveTab = naam;
  for (const s of $$('section.tab')) s.hidden = s.id !== 'tab-' + naam;
  for (const b of $$('#tabs button')) b.classList.toggle('actief', b.dataset.tab === naam);
  if (naam === 'resultaten') renderResultaten();
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

function demoLabel(record) {
  return record && record.demo ? '<span class="demolabel">DEMO</span>' : '';
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
  vulFrequentieProcesKeuze();
  renderFrequentieRecent();
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
