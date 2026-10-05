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
  'meting-annuleren': () => { const was = !!metingBewerkId; verwijderConcept('meting'); resetMetingFormulier(false); if (was) toonTab('overzicht'); },
  'frequentie-annuleren': () => { const was = !!frequentieBewerkId; verwijderConcept('frequentie'); resetFrequentieFormulier(); if (was) toonTab('overzicht'); },
  'concept-meting-verwijderen': () => verwijderMetingConceptMetBevestiging(),
  'concept-frequentie-verwijderen': () => verwijderFrequentieConceptMetBevestiging(),
  'meting-dupliceren': (el) => dupliceerMeting(el.dataset.id),
  'meting-uitklappen': (el) => {
    const id = el.dataset.id;
    if (uitgeklapteMetingen.has(id)) uitgeklapteMetingen.delete(id); else uitgeklapteMetingen.add(id);
    renderOverzichtTabel();
  },
  'meting-openen': (el) => openMeting(el.dataset.id),
  'meting-bewerken': async (el) => {
    const c = laadConcept('meting');
    if (c && c.gegevens && c.gegevens.bewerkId !== el.dataset.id) {
      const ok = await bevestig('Niet-opgeslagen concept', '<p>Het formulier Nieuwe procesmeting bevat een niet-opgeslagen concept. Als u deze meting gaat aanpassen, wordt dat concept vervangen.</p>', 'Toch aanpassen', true);
      if (!ok) return;
      verwijderConcept('meting');
    }
    bewerkMeting(el.dataset.id);
  },
  'meting-verwijderen': (el) => verwijderMetingMetBevestiging(el.dataset.id),
  'frequentie-openen': (el) => openFrequentie(el.dataset.id),
  'frequentie-bewerken': async (el) => {
    const c = laadConcept('frequentie');
    if (c && c.gegevens && c.gegevens.bewerkId !== el.dataset.id) {
      const ok = await bevestig('Niet-opgeslagen concept', '<p>Het formulier Frequentie registreren bevat een niet-opgeslagen concept. Als u deze frequentiemeting gaat aanpassen, wordt dat concept vervangen.</p>', 'Toch aanpassen', true);
      if (!ok) return;
      verwijderConcept('frequentie');
    }
    bewerkFrequentie(el.dataset.id);
  },
  'frequentie-verwijderen': (el) => verwijderFrequentieMetBevestiging(el.dataset.id),
  'filters-wissen': () => wisOverzichtFilters(),
  'onderliggende-metingen': (el) => toonOnderliggendeMetingen(el.dataset.casustype),
  'grafiek-png': () => downloadGrafiekPng(),
  'excel-export': () => exporteerExcel(),
  'csv-procesmetingen': () => exporteerCsv('procesmetingen'),
  'csv-stapmetingen': () => exporteerCsv('stapmetingen'),
  'csv-frequentie': () => exporteerCsv('frequentie'),
  'csv-knelpunten': () => exporteerCsv('knelpunten'),
  'backup-download': () => downloadBackup(),
  'backup-import': () => $('#backupBestand').click(),
  'demo-laden': () => laadDemo(),
  'demo-verwijderen': () => verwijderDemo(),
  'alles-wissen': () => wisAlleGegevens(),
  'totaal-onderliggend': () => toonTotaalOnderliggend(),
  'knelpunten-bekijken': () => toonKnelpunten(),
  'metingen-medewerker': (el) => toonMetingenVanMedewerker(el.dataset.medewerker, el.dataset.casustype),
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
  $('#procesEditor').addEventListener('change', (e) => { if (e.target.id === 'peBlokken') verwerkProcesEditorInvoer(e); });
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
  // Uitleg-icoontjes in de vaste HTML
  for (const el of $$('[data-uitleg]')) el.outerHTML = infoHtml(el.dataset.uitleg);
  const herstelMeting = herstelMetingConcept();
  const herstelFrequentie = herstelFrequentieConcept();
  // Concepten direct wegschrijven bij sluiten of wegklikken van de pagina.
  const bewaarOpenConcepten = () => {
    if (metingConceptTimer) bewaarMetingConcept();
    if (frequentieConceptTimer) bewaarFrequentieConcept();
  };
  window.addEventListener('pagehide', bewaarOpenConcepten);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bewaarOpenConcepten(); });

  let starttab = staat.processen.length ? 'meting' : 'processen';
  try { starttab = sessionStorage.getItem('meettool-tab') || starttab; } catch (e) { /* niet kritiek */ }
  if (herstelMeting) starttab = 'meting';
  else if (herstelFrequentie) starttab = 'frequentie';
  toonTab(starttab);
  if (herstelMeting || herstelFrequentie) toonMelding('Niet-afgerond concept hersteld.');

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
    medewerkerSamenvatting,
    berekenTotaalOverzicht,
    blokkenAnalyse,
    knelpuntAnalyse,
    berekenMeting,
    berekenTijdsbelasting,
    kiesFrequentie,
    leesGetal,
    kalenderweek,
    kalenderweekTekst,
    controleProcesStap,
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
