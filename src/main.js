// ---------- Opstarten en centrale afhandeling van knoppen ----------

const ACTIES = {
  'proces-nieuw': () => startProcesBewerking(null),
  'proces-bewerken': (el) => startProcesBewerking(el.dataset.id),
  'proces-verwijderen': (el) => verwijderProcesMetBevestiging(el.dataset.id),
  'proces-opslaan': () => slaProcesOp(),
  'proces-annuleren': () => { procesBewerking = null; renderProcesEditor(); },
  'stap-toevoegen': () => { voegStapToe(); renderProcesEditor(); },
  'stap-verwijderen': (el) => { procesBewerking.stappen.splice(Number(el.dataset.index), 1); renderProcesEditor(); },
  'processen-csv-export': () => exporteerProcessenCsv(),
  'processen-csv-import': () => $('#processenCsvBestand').click(),
  'meting-annuleren': () => { const was = !!metingBewerkId; resetMetingFormulier(false); if (was) toonTab('overzicht'); },
  'frequentie-annuleren': () => { const was = !!frequentieBewerkId; resetFrequentieFormulier(); if (was) toonTab('overzicht'); },
  'meting-uitklappen': (el) => {
    const id = el.dataset.id;
    if (uitgeklapteMetingen.has(id)) uitgeklapteMetingen.delete(id); else uitgeklapteMetingen.add(id);
    renderOverzichtTabel();
  },
  'meting-openen': (el) => openMeting(el.dataset.id),
  'meting-bewerken': (el) => bewerkMeting(el.dataset.id),
  'meting-verwijderen': (el) => verwijderMetingMetBevestiging(el.dataset.id),
  'frequentie-openen': (el) => openFrequentie(el.dataset.id),
  'frequentie-bewerken': (el) => bewerkFrequentie(el.dataset.id),
  'frequentie-verwijderen': (el) => verwijderFrequentieMetBevestiging(el.dataset.id),
  'filters-wissen': () => wisOverzichtFilters(),
  'onderliggende-metingen': (el) => toonOnderliggendeMetingen(el.dataset.casustype),
  'grafiek-png': () => downloadGrafiekPng(),
  'excel-export': () => exporteerExcel(),
  'csv-procesmetingen': () => exporteerCsv('procesmetingen'),
  'csv-stapmetingen': () => exporteerCsv('stapmetingen'),
  'csv-frequentie': () => exporteerCsv('frequentie'),
  'backup-download': () => downloadBackup(),
  'backup-import': () => $('#backupBestand').click(),
  'demo-laden': () => laadDemo(),
  'demo-verwijderen': () => verwijderDemo(),
  'alles-wissen': () => wisAlleGegevens(),
  'aantal-aanvullen': (el) => vulAantalUitvoeringenAanMetBevestiging(el.dataset.proces || null),
};

async function start() {
  $('#versieLabel').textContent = 'versie ' + VERSIE;
  document.title = 'Meettool ' + VERSIE;

  document.addEventListener('click', (e) => {
    const tabKnop = e.target.closest('#tabs button[data-tab]');
    if (tabKnop) { toonTab(tabKnop.dataset.tab); return; }
    const el = e.target.closest('[data-actie]');
    if (el && ACTIES[el.dataset.actie] && !el.disabled) {
      Promise.resolve(ACTIES[el.dataset.actie](el)).catch((fout) => {
        console.error(fout);
        toonMelding('Er ging iets mis: ' + (fout && fout.message ? fout.message : fout), true);
      });
    }
  });
  $('#procesEditor').addEventListener('input', verwerkProcesEditorInvoer);
  $('#processenCsvBestand').addEventListener('change', async (e) => {
    const bestand = e.target.files[0];
    e.target.value = '';
    if (bestand) await importeerProcessenCsv(bestand);
  });
  $('#backupBestand').addEventListener('change', async (e) => {
    const bestand = e.target.files[0];
    e.target.value = '';
    if (bestand) await importeerBackup(bestand);
  });

  await Opslag.open();
  try {
    staat = normaliseerStaat(await Opslag.laad());
  } catch (e) {
    console.error(e);
    staat = legeStaat();
    toonMelding('De opgeslagen gegevens konden niet worden gelezen. Importeer zo nodig een back-up.', true);
  }

  initMetingFormulier();
  initFrequentieFormulier();
  initOverzicht();
  initResultaten();
  renderAlles();
  werkOpslagStatusBij();

  let starttab = staat.processen.length ? 'meting' : 'processen';
  try { starttab = sessionStorage.getItem('meettool-tab') || starttab; } catch (e) { /* niet kritiek */ }
  toonTab(starttab);

  window.addEventListener('beforeunload', (e) => {
    // Waarschuw bij sluiten als er nog een timer loopt of een wijziging nog wordt opgeslagen.
    if (Opslag.bezig > 0 || Object.values(timers).some((t) => t.status === 'actief' || t.status === 'wacht')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Alleen voor geautomatiseerde tests: lezen van berekeningen en staat (geen netwerk).
  window.__meettool = {
    versie: VERSIE,
    staat: () => staat,
    procesSamenvatting,
    stapSamenvatting,
    berekenMeting,
    berekenTijdsbelasting,
    kiesFrequentie,
    leesGetal,
    isGeldigeDatum,
    mediaan,
    wachtOpOpslag: () => Opslag.wachtrij.then(() => true, () => false),
    klaar: true,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  start().catch((e) => {
    console.error(e);
    const el = document.getElementById('opslagStatus');
    if (el) { el.textContent = 'Fout bij opstarten: ' + (e && e.message ? e.message : e); el.classList.add('fout'); }
  });
});
