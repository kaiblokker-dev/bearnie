// ---------- 1. Processen beheren ----------

let procesBewerking = null; // { origineelId, procesId, naam, ...EENHEID_VELDEN, stappen: [{ stapId, volgorde, naam, bestaand, auto }] }

function voorgesteldeStapId(procesId, nummer) {
  return procesId ? `${procesId}-S${String(nummer).padStart(2, '0')}` : '';
}

function renderProcessenLijst() {
  const houder = $('#processenLijst');
  if (!staat.processen.length) {
    houder.innerHTML = '<p class="zacht">Er zijn nog geen processen vastgelegd. Klik op <strong>Nieuw proces</strong> om te beginnen.</p>';
    return;
  }
  const rijen = staat.processen.map((p) => {
    const stappen = stappenVanProces(p.procesId);
    const aantalMetingen = staat.procesmetingen.filter((m) => m.procesId === p.procesId).length;
    const aantalFreq = staat.frequentiemetingen.filter((f) => f.procesId === p.procesId).length;
    return `<tr>
      <td><strong>${esc(p.procesId)}</strong>${demoLabel(p)}</td>
      <td>${esc(p.naam)}</td>
      <td>${esc(p.uitvoeringseenheid || '—')}</td>
      <td>${esc(p.omvangseenheid || '—')}</td>
      <td class="klein">${stappen.map((s) => `${esc(s.volgorde)}. ${esc(s.naam)} <span class="zacht mono">(${esc(s.stapId)})</span>`).join('<br>')}</td>
      <td class="getal">${aantalMetingen}</td>
      <td class="getal">${aantalFreq}</td>
      <td class="acties">
        <button type="button" class="klein" data-actie="proces-bewerken" data-id="${esc(p.procesId)}">Aanpassen</button>
        <button type="button" class="klein gevaar" data-actie="proces-verwijderen" data-id="${esc(p.procesId)}">Verwijderen</button>
      </td>
    </tr>`;
  }).join('');
  houder.innerHTML = `<table>
    <thead><tr><th>ProcesID</th><th>Procesnaam</th><th>Uitvoeringseenheid</th><th>Omvangseenheid</th><th>Processtappen</th><th class="getal">Metingen</th><th class="getal">Frequenties</th><th></th></tr></thead>
    <tbody>${rijen}</tbody></table>`;
}

function startProcesBewerking(procesId) {
  if (procesId) {
    const p = zoekProces(procesId);
    procesBewerking = {
      origineelId: p.procesId,
      procesId: p.procesId,
      naam: p.naam,
      ...Object.fromEntries(EENHEID_VELDEN.map((k) => [k, p[k] || ''])),
      stappen: stappenVanProces(p.procesId).map((s) => ({ stapId: s.stapId, volgorde: String(s.volgorde), naam: s.naam, bestaand: true, auto: false })),
    };
  } else {
    procesBewerking = { origineelId: null, procesId: '', naam: '', uitvoeringseenheid: '', uitvoeringseenheidMeervoud: '', omvangseenheid: '', omvangseenheidMeervoud: '', stappen: [] };
    voegStapToe();
  }
  renderProcesEditor();
  $('#procesEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function voegStapToe() {
  const b = procesBewerking;
  const volgordes = b.stappen.map((s) => Number(leesGetal(s.volgorde).waarde) || 0);
  const volgende = Math.max(0, ...volgordes) + 1;
  let nummer = volgende;
  const bezet = new Set([...b.stappen.map((s) => s.stapId), ...staat.processtappen.map((s) => s.stapId)]);
  while (bezet.has(voorgesteldeStapId(b.procesId, nummer))) nummer++;
  b.stappen.push({ stapId: voorgesteldeStapId(b.procesId, nummer), volgorde: String(volgende), naam: '', bestaand: false, auto: true });
}

function renderProcesEditor(fouten = []) {
  const ed = $('#procesEditor');
  const b = procesBewerking;
  if (!b) { ed.hidden = true; ed.innerHTML = ''; return; }
  ed.hidden = false;
  const aantalMetingen = b.origineelId ? staat.procesmetingen.filter((m) => m.procesId === b.origineelId).length : 0;
  const stapRijen = b.stappen.map((s, i) => `<tr data-index="${i}">
      <td style="width:90px"><input type="text" data-stapveld="volgorde" value="${esc(s.volgorde)}" inputmode="numeric" aria-label="Volgorde"></td>
      <td style="width:200px"><input type="text" data-stapveld="stapId" value="${esc(s.stapId)}" ${s.bestaand ? 'readonly title="Een bestaande StapID kan niet worden gewijzigd, omdat metingen ernaar verwijzen."' : ''} aria-label="StapID"></td>
      <td><input type="text" data-stapveld="naam" value="${esc(s.naam)}" aria-label="Naam van de processtap" placeholder="bijv. Document controleren"></td>
      <td class="acties"><button type="button" class="klein gevaar" data-actie="stap-verwijderen" data-index="${i}">Verwijderen</button></td>
    </tr>`).join('');
  ed.innerHTML = `
    <h3>${b.origineelId ? 'Proces aanpassen: ' + esc(b.origineelId) : 'Nieuw proces'}</h3>
    ${aantalMetingen ? `<div class="melding info">Voor dit proces zijn ${aantalMetingen} metingen opgeslagen. Wijzigingen gelden voor nieuwe metingen; bestaande metingen behouden de proces- en stapnamen van het moment van meten.</div>` : ''}
    <div class="velden">
      <div class="veld">
        <label for="peId" class="verplicht">ProcesID</label>
        <input type="text" id="peId" value="${esc(b.procesId)}" ${b.origineelId ? 'readonly title="Een bestaande ProcesID kan niet worden gewijzigd, omdat metingen ernaar verwijzen."' : ''} placeholder="bijv. PR24">
        ${b.origineelId ? '' : '<span class="hint">Korte code zonder spaties.</span>'}
      </div>
      <div class="veld">
        <label for="peNaam" class="verplicht">Procesnaam</label>
        <input type="text" id="peNaam" value="${esc(b.naam)}" placeholder="bijv. Facturen verwerken">
      </div>
    </div>
    <h4>Eenheden</h4>
    <p class="klein zacht" style="margin-top:0">De <strong>uitvoeringseenheid</strong> is wat één uitvoering van het proces is (bijvoorbeeld één dossier). De actieve tijd per uitvoeringseenheid is de primaire uitkomst.
      De <strong>omvangseenheid</strong> is waarin de omvang van een uitvoering wordt uitgedrukt (bijvoorbeeld het aantal relevante dienstperioden); dit geeft een aanvullende uitkomst.</p>
    ${b.origineelId && EENHEID_VELDEN.some((k) => !b[k]) ? '<div class="melding waarschuwing">Dit proces is vastgelegd met een eerdere versie van de tool, die maar één eenheid kende (nu de omvangseenheid). Vul de ontbrekende eenheden aan.</div>' : ''}
    <div class="velden">
      <div class="veld">
        <label for="peUitvoering" class="verplicht">Uitvoeringseenheid (enkelvoud)</label>
        <input type="text" id="peUitvoering" data-eenheidveld="uitvoeringseenheid" value="${esc(b.uitvoeringseenheid)}" placeholder="bijv. dossier">
        <span class="hint">Eén uitvoering = één …</span>
      </div>
      <div class="veld">
        <label for="peUitvoeringMv" class="verplicht">Uitvoeringseenheid (meervoud)</label>
        <input type="text" id="peUitvoeringMv" data-eenheidveld="uitvoeringseenheidMeervoud" value="${esc(b.uitvoeringseenheidMeervoud)}" placeholder="bijv. dossiers">
      </div>
      <div class="veld">
        <label for="peOmvang" class="verplicht">Omvangseenheid (enkelvoud)</label>
        <input type="text" id="peOmvang" data-eenheidveld="omvangseenheid" value="${esc(b.omvangseenheid)}" placeholder="bijv. dienstperiode">
      </div>
      <div class="veld">
        <label for="peOmvangMv" class="verplicht">Omvangseenheid (meervoud)</label>
        <input type="text" id="peOmvangMv" data-eenheidveld="omvangseenheidMeervoud" value="${esc(b.omvangseenheidMeervoud)}" placeholder="bijv. dienstperioden">
      </div>
    </div>
    ${b.origineelId && staat.procesmetingen.some((m) => m.procesId === b.origineelId) ? '<p class="klein zacht">Bestaande metingen behouden de eenheden die bij het meten zijn vastgelegd. Alleen metingen zonder vastgelegde eenheid (uit een eerdere versie) tonen de eenheden van het proces.</p>' : ''}
    <h4>Processtappen</h4>
    <div class="tabelhouder">
      <table>
        <thead><tr><th>Volgorde</th><th>StapID</th><th>Naam van de processtap</th><th></th></tr></thead>
        <tbody>${stapRijen || '<tr class="leeg"><td colspan="4">Nog geen processtappen.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="knoppen"><button type="button" data-actie="stap-toevoegen">Processtap toevoegen</button></div>
    <div class="mt">${foutenHtml(fouten)}</div>
    <div class="knoppen">
      <button type="button" class="primair" data-actie="proces-opslaan">Proces opslaan</button>
      <button type="button" data-actie="proces-annuleren">Annuleren</button>
    </div>`;
}

function verwerkProcesEditorInvoer(e) {
  const b = procesBewerking;
  if (!b) return;
  const t = e.target;
  if (t.id === 'peId') {
    const nieuw = t.value.trim();
    // Pas automatisch voorgestelde StapID's mee aan zolang de gebruiker ze niet zelf heeft gewijzigd.
    b.stappen.forEach((s) => {
      if (s.auto && !s.bestaand) {
        s.stapId = voorgesteldeStapId(nieuw, Number(leesGetal(s.volgorde).waarde) || 1);
        const veld = $(`tr[data-index="${b.stappen.indexOf(s)}"] input[data-stapveld="stapId"]`, $('#procesEditor'));
        if (veld) veld.value = s.stapId;
      }
    });
    b.procesId = nieuw;
  } else if (t.id === 'peNaam') b.naam = t.value;
  else if (t.dataset.eenheidveld) b[t.dataset.eenheidveld] = t.value;
  else if (t.dataset.stapveld) {
    const i = Number(t.closest('tr').dataset.index);
    const s = b.stappen[i];
    s[t.dataset.stapveld] = t.value;
    if (t.dataset.stapveld === 'stapId') s.auto = false;
  }
}

async function slaProcesOp() {
  const b = procesBewerking;
  const invoer = { procesId: b.procesId.trim(), naam: b.naam, ...Object.fromEntries(EENHEID_VELDEN.map((k) => [k, b[k]])), stappen: b.stappen };
  const fouten = valideerProces(invoer, b.origineelId);
  if (!b.origineelId && /^demo-/i.test(invoer.procesId)) fouten.push('ProcesID\'s die beginnen met "DEMO-" zijn gereserveerd voor demogegevens.');
  if (fouten.length) { renderProcesEditor(fouten); return; }
  if (b.origineelId) {
    const verwijderdeStappen = stappenVanProces(b.origineelId).filter((s) => !b.stappen.some((x) => x.stapId === s.stapId));
    const gebruikt = verwijderdeStappen.filter((s) => staat.stapmetingen.some((sm) => sm.stapId === s.stapId));
    if (gebruikt.length) {
      const ok = await bevestig('Processtap verwijderen',
        `<p>De volgende stappen worden verwijderd, maar komen voor in bestaande metingen:</p><ul>${gebruikt.map((s) => `<li>${esc(s.stapId)} – ${esc(s.naam)}</li>`).join('')}</ul><p>De bestaande stapmetingen blijven bewaard en leesbaar (met de stapnaam van het moment van meten). Nieuwe metingen bevatten deze stappen niet meer.</p>`,
        'Stappen verwijderen', true);
      if (!ok) return;
    }
  }
  const proces = bewaarProces(invoer, b.origineelId);
  procesBewerking = null;
  renderProcesEditor();
  await naWijziging(`Proces ${proces.procesId} is opgeslagen.`);
}

async function verwijderProcesMetBevestiging(procesId) {
  const aantalMetingen = staat.procesmetingen.filter((m) => m.procesId === procesId).length;
  const aantalFreq = staat.frequentiemetingen.filter((f) => f.procesId === procesId).length;
  const ok = await bevestig(
    `Proces ${procesId} verwijderen`,
    `<p>Weet u zeker dat u proces <strong>${esc(procesLabel(procesId))}</strong> en de bijbehorende processtappen wilt verwijderen?</p>
     ${aantalMetingen || aantalFreq ? `<div class="melding info">Er zijn ${aantalMetingen} procesmetingen en ${aantalFreq} frequentiemetingen voor dit proces. Deze worden <strong>niet</strong> verwijderd en blijven leesbaar en analyseerbaar met de proces- en stapnamen die bij de meting zijn vastgelegd.</div>` : ''}`,
    'Proces verwijderen',
    true
  );
  if (!ok) return;
  verwijderProces(procesId);
  if (procesBewerking && procesBewerking.origineelId === procesId) { procesBewerking = null; renderProcesEditor(); }
  await naWijziging(`Proces ${procesId} is verwijderd.`);
}

// ---------- CSV voor processen ----------

const PROCES_CSV_KOPPEN = ['ProcesID', 'Procesnaam', 'Uitvoeringseenheid', 'Uitvoeringseenheid meervoud', 'Omvangseenheid', 'Omvangseenheid meervoud', 'StapID', 'Volgorde', 'Processtap'];
const PROCES_CSV_EENHEDEN = [['Uitvoeringseenheid', 'uitvoeringseenheid'], ['Uitvoeringseenheid meervoud', 'uitvoeringseenheidMeervoud'], ['Omvangseenheid', 'omvangseenheid'], ['Omvangseenheid meervoud', 'omvangseenheidMeervoud']];

function exporteerProcessenCsv() {
  const rijen = [];
  for (const p of staat.processen) {
    for (const s of stappenVanProces(p.procesId)) rijen.push([p.procesId, p.naam, p.uitvoeringseenheid, p.uitvoeringseenheidMeervoud, p.omvangseenheid, p.omvangseenheidMeervoud, s.stapId, s.volgorde, s.naam]);
  }
  const voor = bevatDemo() && staat.processen.some((p) => p.demo) ? ['LET OP: dit bestand bevat demogegevens (processen met ProcesID DEMO-...).'] : [];
  downloadTekst(maakCsv(PROCES_CSV_KOPPEN, rijen, voor), bestandsnaamMetDemo('Meettool_processen', 'csv'), 'text/csv;charset=utf-8');
}

async function importeerProcessenCsv(bestand) {
  let rijen;
  try {
    rijen = leesCsv(await leesBestandAlsTekst(bestand));
  } catch (e) {
    toonMelding(e.message, true);
    return;
  }
  // Sla eventuele toelichtingsregels boven de kop over.
  const kopIndex = rijen.findIndex((r) => r.map((c) => c.trim().toLowerCase()).includes('procesid'));
  if (kopIndex < 0) {
    await informeer('Import niet mogelijk', `<div class="melding fout">Het bestand heeft niet het juiste formaat. De eerste regel moet de kolommen bevatten: <span class="mono">${PROCES_CSV_KOPPEN.join(';')}</span></div>`);
    return;
  }
  const kop = rijen[kopIndex].map((c) => c.trim().toLowerCase());
  const kolom = (naam) => kop.indexOf(naam.toLowerCase());
  const ontbrekend = PROCES_CSV_KOPPEN.filter((k) => kolom(k) < 0);
  if (ontbrekend.length) {
    await informeer('Import niet mogelijk', `<div class="melding fout">De volgende kolommen ontbreken: ${esc(ontbrekend.join(', '))}.${kolom('Eenheid') >= 0 ? '<br>Dit lijkt een bestand uit versie 1.0 met één kolom Eenheid. Vanaf versie 1.1 heeft ieder proces een uitvoeringseenheid en een omvangseenheid.' : ''}<br>Verwachte kolommen: <span class="mono">${PROCES_CSV_KOPPEN.join(';')}</span></div>`);
    return;
  }
  const perProces = new Map();
  const fouten = [];
  rijen.slice(kopIndex + 1).forEach((r, i) => {
    const waarde = (k) => (r[kolom(k)] || '').trim();
    const pid = waarde('ProcesID');
    if (!pid) { fouten.push(`Regel ${kopIndex + i + 2}: ProcesID ontbreekt.`); return; }
    const eenheden = Object.fromEntries(PROCES_CSV_EENHEDEN.map(([kop, veld]) => [veld, waarde(kop)]));
    if (!perProces.has(pid)) perProces.set(pid, { procesId: pid, naam: waarde('Procesnaam'), ...eenheden, stappen: [] });
    const p = perProces.get(pid);
    if (p.naam !== waarde('Procesnaam') || EENHEID_VELDEN.some((k) => p[k] !== eenheden[k])) fouten.push(`Regel ${kopIndex + i + 2}: procesnaam of eenheden van ${pid} verschillen van een eerdere regel.`);
    p.stappen.push({ stapId: waarde('StapID'), volgorde: waarde('Volgorde'), naam: waarde('Processtap') });
  });
  const nieuw = [];
  const overgeslagen = [];
  for (const p of perProces.values()) {
    if (zoekProces(p.procesId)) { overgeslagen.push(p.procesId); continue; }
    const pf = valideerProces(p, null);
    // Controleer ook op StapID's die al in eerder gelezen processen uit dit bestand voorkomen.
    for (const s of p.stappen) {
      if (nieuw.some((n) => n.stappen.some((x) => x.stapId === s.stapId))) pf.push(`StapID ${s.stapId} komt bij meerdere processen in het bestand voor.`);
    }
    if (pf.length) fouten.push(...pf.map((f) => `${p.procesId}: ${f}`));
    else nieuw.push(p);
  }
  if (fouten.length) {
    await informeer('Import niet mogelijk', foutenHtml(fouten, 'Het bestand bevat fouten. Er is niets geïmporteerd.'));
    return;
  }
  if (!nieuw.length) {
    await informeer('Niets te importeren', `<p>Alle processen in het bestand bestaan al (${esc(overgeslagen.join(', '))}). Bestaande processen worden bij import niet gewijzigd.</p>`);
    return;
  }
  const ok = await bevestig('Processen importeren',
    `<p>Gevonden nieuwe processen: <strong>${nieuw.length}</strong> (${nieuw.reduce((s, p) => s + p.stappen.length, 0)} processtappen).</p>
     <ul>${nieuw.map((p) => `<li>${esc(p.procesId)} – ${esc(p.naam)} (${p.stappen.length} stappen)</li>`).join('')}</ul>
     ${overgeslagen.length ? `<div class="melding info">Deze processen bestaan al en worden overgeslagen (niet gewijzigd): ${esc(overgeslagen.join(', '))}</div>` : ''}`,
    'Importeren');
  if (!ok) return;
  for (const p of nieuw) bewaarProces(p, null);
  await naWijziging(`${nieuw.length} proces(sen) geïmporteerd.`);
}
