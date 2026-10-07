// ---------- Maanddashboard PR24 (versie 1.8) ----------
//
// Eén dynamisch dashboard: de selectie (bestuur, maand, jaar) bepaalt welke maandmeting wordt getoond.
// Wijzigingen worden direct in de eigen localStorage-sleutel opgeslagen; ongeldige invoer niet.

let maandKeuze = { bestuur: 'LEV', jaar: new Date().getFullYear(), maand: new Date().getMonth() + 1 };
let maandSubtab = 'dashboard';
let maandSortering = 'volgorde';

const ONVOLDOENDE = 'onvoldoende gegevens';
const nietIngevuldHtml = () => '<span class="onbekend">niet ingevuld</span>';
const onvoldoendeHtml = (reden = ONVOLDOENDE) => `<span class="onbekend">${esc(reden)}</span>`;

function formuleIcoon(tekst) {
  return `<span class="uitleg-i" tabindex="0" role="img" title="${esc(tekst)}" aria-label="${esc('Formule: ' + tekst)}">i</span>`;
}

function initMaand() {
  try {
    const k = JSON.parse(sessionStorage.getItem('meettool-maandkeuze') || 'null');
    if (k && BESTUREN.includes(k.bestuur) && Number.isInteger(k.jaar) && k.maand >= 1 && k.maand <= 12) maandKeuze = k;
  } catch (e) { /* niet kritiek */ }
  vulSelect($('#mmBestuur'), BESTUREN, maandKeuze.bestuur);
  vulSelect($('#mmMaand'), MAANDNAMEN.map((n, i) => ({ waarde: String(i + 1), label: n })), String(maandKeuze.maand));
  for (const id of ['#mmBestuur', '#mmMaand', '#mmJaar']) {
    $(id).addEventListener('change', () => {
      maandKeuze = { bestuur: $('#mmBestuur').value, maand: Number($('#mmMaand').value), jaar: Number($('#mmJaar').value) };
      try { sessionStorage.setItem('meettool-maandkeuze', JSON.stringify(maandKeuze)); } catch (e) { /* niet kritiek */ }
      maandSubtab = 'dashboard';
      renderMaand();
    });
  }
  $('#maandSubtabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-maandtab]');
    if (b) toonMaandSubtab(b.dataset.maandtab);
  });
  $('#maandInhoud').addEventListener('input', verwerkMaandInvoer);
  $('#maandInhoud').addEventListener('change', (e) => {
    if (e.target.id === 'mmSortering') { maandSortering = e.target.value; renderMaand(); }
  });
  $('#maandInhoud').addEventListener('change', verwerkMaandInvoer);
}

function huidigeMaandmeting() {
  return zoekMaandmeting(maandKeuze.bestuur, maandKeuze.jaar, maandKeuze.maand);
}

function toonMaandSubtab(naam) {
  maandSubtab = naam;
  renderMaand();
  window.scrollTo(0, 0);
}

function werkMaandOpslagStatusBij() {
  const el = $('#mmOpslagStatus');
  if (maandOpslagGeblokkeerd) {
    el.textContent = 'Opslaan uitgeschakeld: de opgeslagen maandgegevens in deze browser zijn onleesbaar. Ze zijn niet gewist; importeer zo nodig een back-up.';
    el.classList.add('fout');
    return;
  }
  el.classList.remove('fout');
  if (!maandOpgeslagenOp) { el.textContent = 'Nog niets opgeslagen.'; return; }
  const d = new Date(maandOpgeslagenOp);
  const p = (x) => String(x).padStart(2, '0');
  el.textContent = `Laatst opgeslagen: ${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} om ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} (lokaal in deze browser)`;
}

/** Slaat op en meldt een mislukking. */
function slaMaandOp() {
  const ok = bewaarMaandmetingen();
  werkMaandOpslagStatusBij();
  if (!ok) toonMelding('De maandgegevens konden niet lokaal worden opgeslagen. Download een back-up.', true);
  return ok;
}

function renderMaand() {
  const jaren = uniek([...Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 2 + i), maandKeuze.jaar, ...maandStaat.maandmetingen.map((m) => m.jaar)]).sort();
  vulSelect($('#mmJaar'), jaren.map(String), String(maandKeuze.jaar));
  $('#mmBestuur').value = maandKeuze.bestuur;
  $('#mmMaand').value = String(maandKeuze.maand);
  const naam = procesNaam(MAAND_PROCES);
  vulSelect($('#mmProces'), [{ waarde: MAAND_PROCES, label: `${MAAND_PROCES}${naam ? ' – ' + naam : ''}` }], MAAND_PROCES);
  const m = huidigeMaandmeting();
  $('#mmLabel').textContent = maandLabel({ ...maandKeuze, procesId: MAAND_PROCES });
  $('#mmStatus').innerHTML = m ? `Aangemaakt ${esc(fmtTijdstip(m.aangemaakt))}${m.gewijzigd ? ` · laatst gewijzigd ${esc(fmtTijdstip(m.gewijzigd))}` : ''}` : '<span class="zacht">Nog geen maandmeting voor deze combinatie.</span>';
  $('#tab-maand [data-actie="maand-verwijderen"]').disabled = !m;
  $('#tab-maand [data-actie="maand-opslaan"]').disabled = !m;
  for (const b of $$('#maandSubtabs button')) b.classList.toggle('actief', b.dataset.maandtab === maandSubtab);
  $('#maandSubtabs').hidden = !m;
  werkMaandOpslagStatusBij();
  const houder = $('#maandInhoud');
  if (!m) { houder.innerHTML = legeMaandHtml(); return; }
  const b = berekenMaand(m);
  if (maandSubtab === 'gegevens') houder.innerHTML = maandGegevensHtml(m, b);
  else if (maandSubtab === 'dossiers') houder.innerHTML = maandDossiersHtml(m, b);
  else if (maandSubtab === 'stappen') houder.innerHTML = maandStappenHtml(m, b);
  else houder.innerHTML = maandDashboardHtml(b);
}

function legeMaandHtml() {
  return `<div class="kaart"><p>Er is nog geen maandmeting voor <strong>${esc(maandLabel({ ...maandKeuze, procesId: MAAND_PROCES }))}</strong>.</p>
    <div class="knoppen"><button type="button" class="primair" data-actie="maand-nieuw">Nieuwe maandmeting aanmaken</button></div></div>
    ${maandOverzichtHtml()}`;
}

/** Alle maandmetingen, om snel van selectie te wisselen. */
function maandOverzichtHtml() {
  if (!maandStaat.maandmetingen.length) return '';
  return `<div class="kaart"><h3>Alle maandmetingen</h3><div class="tabelhouder"><table class="klein maandtabel">
    <thead><tr><th>Maandmeting</th><th class="getal">Nieuwe medewerkers</th><th class="getal">Aangeleverd</th><th class="getal">Verwerkt</th><th class="getal">Dossiers</th><th>Laatst gewijzigd</th><th></th></tr></thead>
    <tbody>${maandStaat.maandmetingen.map((m) => `<tr><td>${esc(maandLabel(m))}</td><td class="getal">${htmlAantalOfLeeg(m.nieuweMedewerkers)}</td><td class="getal">${htmlAantalOfLeeg(m.aangeleverd)}</td><td class="getal">${htmlAantalOfLeeg(m.verwerkt)}</td>
      <td class="getal">${m.dossiers.length}</td><td>${esc(fmtTijdstip(m.gewijzigd || m.aangemaakt))}</td><td class="acties"><button type="button" class="klein" data-actie="maand-openen" data-id="${esc(m.id)}">Openen</button></td></tr>`).join('')}</tbody></table></div></div>`;
}

function htmlAantalOfLeeg(n) {
  return isGetal(n) ? esc(fmtAantal(n)) : nietIngevuldHtml();
}

const terugKnop = () => '<div class="knoppen" style="margin-top:0"><button type="button" data-actie="maand-dashboard">← Terug naar dashboard</button></div>';

// ---------- Onderdeel 1: maandgegevens ----------

function maandGegevensHtml(m, b) {
  const veld = (id, veldnaam, label, hint) => `<div class="veld"><label for="${id}">${label}</label>
    <input type="text" id="${id}" data-mveld="${veldnaam}" inputmode="numeric" value="${esc(naarInvoer(m[veldnaam]))}" placeholder="niet ingevuld"><span class="hint">${hint}</span></div>`;
  return `${terugKnop()}
    <div class="kaart ruw-kader"><span class="etiket ruw">Invoer</span><h3>Maandgegevens – ${esc(maandLabel(m))}</h3>
      <div class="velden">
        ${veld('mmNieuwe', 'nieuweMedewerkers', 'Aantal nieuwe medewerkers', 'Geheel getal; leeg = niet ingevuld (geen 0).')}
        ${veld('mmAangeleverd', 'aangeleverd', 'Aantal aangeleverde diensttijdopgaven', 'Niet meer dan het aantal nieuwe medewerkers.')}
        ${veld('mmVerwerkt', 'verwerkt', 'Aantal verwerkte diensttijdopgaven', 'Niet meer dan het aantal aangeleverde opgaven.')}
        <div class="veld"><label for="mmBron">Bron van de aantallen</label><input type="text" id="mmBron" data-mveld="bron" maxlength="200" value="${esc(m.bron || '')}" placeholder="bijv. maandrapportage HR"></div>
        <div class="veld breed"><label for="mmToelichting">Toelichting</label><textarea id="mmToelichting" data-mveld="toelichting" placeholder="Optioneel">${esc(m.toelichting || '')}</textarea></div>
      </div>
      <div id="mmGegevensFouten"></div>
    </div>
    <div class="berekend-kader" id="mmGegevensBerekend">${frequentieKaartenHtml(b)}</div>`;
}

function leesMaandgegevens() {
  const getal = (id) => {
    const r = leesGetal($(id).value);
    const w = r.fout ? NaN : r.waarde;
    return w;
  };
  return { nieuweMedewerkers: getal('#mmNieuwe'), aangeleverd: getal('#mmAangeleverd'), verwerkt: getal('#mmVerwerkt'), bron: $('#mmBron').value.trim(), toelichting: $('#mmToelichting').value.trim() };
}

// ---------- Onderdeel 2: dossiers ----------

function maandDossiersHtml(m, b) {
  const opties = (gekozen) => DOSSIER_STATUSSEN.map((s) => `<option ${s === (gekozen || 'Status onbekend') ? 'selected' : ''}>${esc(s)}</option>`).join('');
  const getal = (d, veld, label) => `<input type="text" class="tijd" data-dveld="${veld}" inputmode="numeric" value="${esc(naarInvoer(d[veld]))}" placeholder="–" aria-label="${label} ${esc(d.dossierId)}">`;
  const rijen = m.dossiers.map((d, i) => `<tr data-dossier="${i}">
      <td><input type="text" data-dveld="dossierId" value="${esc(d.dossierId)}" maxlength="40" aria-label="Dossier-ID" style="min-width:150px"></td>
      <td>${getal(d, 'perioderegels', 'ABP-periode-regels')}</td>
      <td>${getal(d, 'verwachteBlokken', 'Verwacht aantal diensttijdblokken')}</td>
      <td><select data-dveld="status" aria-label="Verwerkingsstatus ${esc(d.dossierId)}">${opties(d.status)}</select></td>
      <td>${getal(d, 'vismaRegels', 'Werkelijk aantal regels in Visma')}</td>
      <td><input type="text" data-dveld="bijzonderheden" value="${esc(d.bijzonderheden || '')}" maxlength="300" placeholder="Optioneel" aria-label="Bijzonderheden ${esc(d.dossierId)}"></td>
      <td><input type="text" data-dveld="bron" value="${esc(d.bron || '')}" maxlength="120" list="mmBronnen" placeholder="Optioneel" aria-label="Bron of meetwijze ${esc(d.dossierId)}"></td>
      <td class="acties"><button type="button" class="klein gevaar" data-actie="dossier-verwijderen" data-index="${i}">Verwijderen</button></td>
    </tr>`).join('');
  return `${terugKnop()}
    <div class="melding info">Gebruik uitsluitend <strong>geanonimiseerde dossiercodes</strong> (bijv. ${esc(voorgesteldDossierId(m))}). Nooit namen, personeelsnummers, BSN's of andere persoonsgegevens.</div>
    <div class="kaart ruw-kader"><span class="etiket ruw">Invoer</span><h3>Dossiers – ${esc(maandLabel(m))}</h3>
      <div class="tabelhouder"><table class="stappen maandtabel" id="mmDossiers">
        <thead><tr><th>Dossier-ID</th><th>ABP-periode-regels</th><th>Verwacht aantal diensttijdblokken</th><th>Verwerkingsstatus</th><th>Werkelijk aantal regels in Visma</th><th>Bijzonderheden</th><th>Bron of meetwijze</th><th></th></tr></thead>
        <tbody>${rijen || '<tr class="leeg"><td colspan="8">Nog geen dossiers ingevoerd.</td></tr>'}</tbody></table></div>
      <datalist id="mmBronnen"><option value="Telling in e-dossier"><option value="Visma (systeemregistratie)"><option value="Geschat door onderzoeker"><option value="Geschat door medewerker"></datalist>
      <p class="klein zacht">Laat een getal leeg als het (nog) niet bekend is: lege velden tellen niet mee als nul. Gemiddelden gebruiken alleen dossiers met een ingevulde waarde.</p>
      <div class="knoppen"><button type="button" class="primair" data-actie="dossier-toevoegen">Dossier toevoegen</button></div>
      <div id="mmDossierFouten"></div>
    </div>
    <div class="berekend-kader" id="mmDossierBerekend">${dossierKaartenHtml(b)}</div>`;
}

function leesDossierRij(rij, bestaand) {
  const getal = (veld) => { const r = leesGetal($(`[data-dveld="${veld}"]`, rij).value); return r.fout ? NaN : r.waarde; };
  return {
    ...bestaand,
    dossierId: $('[data-dveld="dossierId"]', rij).value.trim(),
    perioderegels: getal('perioderegels'),
    verwachteBlokken: getal('verwachteBlokken'),
    status: $('[data-dveld="status"]', rij).value,
    vismaRegels: getal('vismaRegels'),
    bijzonderheden: $('[data-dveld="bijzonderheden"]', rij).value.trim(),
    bron: $('[data-dveld="bron"]', rij).value.trim(),
  };
}

// ---------- Onderdeel 3: processtappen ----------

function maandStappenHtml(m, b) {
  const rijen = m.stappen.map((s) => `<tr data-stapid="${esc(s.stapId)}">
      <td class="mono">${esc(s.stapId)}</td><td style="min-width:180px">${esc(s.naam)}</td>
      <td><input type="text" class="tijd" data-sveld="actief" inputmode="decimal" value="${esc(naarInvoer(s.actief))}" placeholder="–" aria-label="Actieve tijd per eenheid ${esc(s.stapId)}"></td>
      <td><input type="text" class="tijd" data-sveld="wacht" inputmode="decimal" value="${esc(naarInvoer(s.wacht))}" placeholder="–" aria-label="Wachttijd per eenheid ${esc(s.stapId)}"></td>
      <td><select data-sveld="eenheid" aria-label="Rekeneenheid ${esc(s.stapId)}">${Object.entries(REKENEENHEDEN).map(([k, l]) => `<option value="${k}" ${s.eenheid === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
      <td><select data-sveld="meetwijze" aria-label="Meetwijze ${esc(s.stapId)}"><option value="">— Kies —</option>${MAAND_MEETWIJZEN.map((w) => `<option ${s.meetwijze === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></td>
      <td><input type="text" class="tijd" data-sveld="waarnemingen" inputmode="numeric" value="${esc(naarInvoer(s.waarnemingen))}" placeholder="–" aria-label="Aantal waarnemingen ${esc(s.stapId)}"></td>
      <td><select data-sveld="knelpunt" aria-label="Knelpunt ${esc(s.stapId)}"><option value="">–</option><option value="nee" ${s.knelpunt === false ? 'selected' : ''}>Nee</option><option value="ja" ${s.knelpunt === true ? 'selected' : ''}>Ja</option></select></td>
    </tr>
    <tr class="stapdetail"><td></td><td colspan="7"><div class="stapdetailvelden">
      <label>Toelichting knelpunt <input type="text" data-sveld="knelpuntToelichting" value="${esc(s.knelpuntToelichting || '')}" maxlength="300" placeholder="Optioneel" aria-label="Toelichting knelpunt ${esc(s.stapId)}"></label>
      <label>Overige opmerkingen <input type="text" data-sveld="opmerking" value="${esc(s.opmerking || '')}" maxlength="300" placeholder="Optioneel" aria-label="Overige opmerkingen ${esc(s.stapId)}"></label>
    </div></td></tr>`).join('');
  return `${terugKnop()}
    <div class="kaart ruw-kader"><span class="etiket ruw">Invoer</span><h3>Processtappen – ${esc(maandLabel(m))}</h3>
      <p class="klein zacht">Tijden in minuten <strong>per eenheid</strong>: per dossier of per diensttijdblok (rekeneenheid). Decimalen met komma of punt. Leeg = niet ingevuld; een lege tijd wordt nooit als 0 gerekend.</p>
      <div class="tabelhouder"><table class="stappen maandtabel" id="mmStappen">
        <thead><tr><th>Stap-ID</th><th>Processtap</th><th>Actieve tijd per eenheid (min)</th><th>Wachttijd per eenheid (min)</th><th>Rekeneenheid</th><th>Meetwijze</th><th>Aantal waarnemingen</th><th>Knelpunt</th></tr></thead>
        <tbody>${rijen}</tbody></table></div>
      <div class="knoppen"><button type="button" data-actie="maand-stappen-overnemen">Tijden overnemen uit een andere maandmeting…</button></div>
      <div id="mmStapFouten"></div>
    </div>
    <div class="berekend-kader" id="mmStapBerekend">${tijdKaartenHtml(b)}</div>`;
}

function leesStapRij(rij, bestaand) {
  const getal = (veld) => { const r = leesGetal($(`[data-sveld="${veld}"]`, rij).value); return r.fout ? NaN : r.waarde; };
  const detail = rij.nextElementSibling;
  const k = $('[data-sveld="knelpunt"]', rij).value;
  return {
    ...bestaand,
    actief: getal('actief'),
    wacht: getal('wacht'),
    eenheid: $('[data-sveld="eenheid"]', rij).value,
    meetwijze: $('[data-sveld="meetwijze"]', rij).value,
    waarnemingen: getal('waarnemingen'),
    knelpunt: k === 'ja' ? true : k === 'nee' ? false : null,
    knelpuntToelichting: $('[data-sveld="knelpuntToelichting"]', detail).value.trim(),
    opmerking: $('[data-sveld="opmerking"]', detail).value.trim(),
  };
}

// ---------- Invoer verwerken (automatisch opslaan; ongeldige invoer niet) ----------

const zelfde = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function verwerkMaandInvoer(e) {
  const m = huidigeMaandmeting();
  if (!m || !e.target.matches('[data-mveld], [data-dveld], [data-sveld]')) return;
  const tijd = nuIso();
  let gewijzigd = false;
  if (e.target.matches('[data-mveld]')) {
    const g = leesMaandgegevens();
    const fouten = valideerMaandgegevens(g);
    const markeer = {
      '#mmNieuwe': !isGeheelOfLeeg(g.nieuweMedewerkers),
      '#mmAangeleverd': !isGeheelOfLeeg(g.aangeleverd) || fouten.some((f) => f.startsWith('Er zijn meer diensttijdopgaven aangeleverd')),
      '#mmVerwerkt': !isGeheelOfLeeg(g.verwerkt) || fouten.some((f) => f.startsWith('Er zijn meer diensttijdopgaven verwerkt')),
    };
    for (const [id, fout] of Object.entries(markeer)) $(id).classList.toggle('ongeldig', fout);
    $('#mmGegevensFouten').innerHTML = foutenHtml(fouten, 'Ongeldige invoer – deze wijziging is niet opgeslagen:');
    if (!fouten.length) {
      const nieuw = { ...m, ...g };
      if (!zelfde(nieuw, m)) { Object.assign(m, g); gewijzigd = true; }
    }
  } else if (e.target.matches('[data-dveld]')) {
    const fouten = [];
    const waarschuwingen = [];
    for (const rij of $$('#mmDossiers tr[data-dossier]')) {
      const i = Number(rij.dataset.dossier);
      const d = leesDossierRij(rij, m.dossiers[i]);
      const f = valideerDossier(d, m, i);
      for (const el of $$('[data-dveld]', rij)) el.classList.remove('ongeldig');
      if (f.length) {
        fouten.push(...f.map((x) => `${d.dossierId || `Rij ${i + 1}`}: ${x}`));
        for (const veld of ['perioderegels', 'verwachteBlokken', 'vismaRegels']) if (!isGeheelOfLeeg(d[veld])) $(`[data-dveld="${veld}"]`, rij).classList.add('ongeldig');
        if (f.some((x) => /dossier-ID|Dossier-ID/.test(x))) $('[data-dveld="dossierId"]', rij).classList.add('ongeldig');
        continue;
      }
      if (lijktOpPersoonsnummer(d.dossierId)) waarschuwingen.push(`Dossier-ID "${d.dossierId}" bevat een lange cijferreeks en lijkt op een echt nummer. Gebruik een geanonimiseerde code.`);
      if (!zelfde(d, m.dossiers[i])) { m.dossiers[i] = { ...d, gewijzigd: tijd }; gewijzigd = true; }
    }
    $('#mmDossierFouten').innerHTML = foutenHtml(fouten, 'Ongeldige invoer – deze wijziging is niet opgeslagen:') + waarschuwingen.map((w) => `<div class="melding waarschuwing">${esc(w)}</div>`).join('');
  } else {
    const fouten = [];
    for (const rij of $$('#mmStappen tr[data-stapid]')) {
      const i = m.stappen.findIndex((s) => s.stapId === rij.dataset.stapid);
      const s = leesStapRij(rij, m.stappen[i]);
      const f = valideerStap(s);
      for (const veld of ['actief', 'wacht', 'waarnemingen']) $(`[data-sveld="${veld}"]`, rij).classList.toggle('ongeldig', f.some((x) => x.includes(veld === 'actief' ? 'Actieve tijd' : veld === 'wacht' ? 'Wachttijd' : 'waarnemingen')));
      if (f.length) { fouten.push(...f); continue; }
      if (!zelfde(s, m.stappen[i])) { m.stappen[i] = { ...s, gewijzigd: tijd }; gewijzigd = true; }
    }
    $('#mmStapFouten').innerHTML = foutenHtml(fouten, 'Ongeldige invoer – deze wijziging is niet opgeslagen:');
  }
  if (!gewijzigd) return;
  m.gewijzigd = tijd;
  slaMaandOp();
  $('#mmStatus').innerHTML = `Aangemaakt ${esc(fmtTijdstip(m.aangemaakt))} · laatst gewijzigd ${esc(fmtTijdstip(m.gewijzigd))}`;
  const b = berekenMaand(m);
  if ($('#mmGegevensBerekend')) $('#mmGegevensBerekend').innerHTML = frequentieKaartenHtml(b);
  if ($('#mmDossierBerekend')) $('#mmDossierBerekend').innerHTML = dossierKaartenHtml(b);
  if ($('#mmStapBerekend')) $('#mmStapBerekend').innerHTML = tijdKaartenHtml(b);
}

// ---------- Kaarten met berekende uitkomsten ----------

function statKaart(label, waardeHtml, formule, sub = '') {
  return `<div class="statkaart"><div class="statlabel">${esc(label)} ${formule ? formuleIcoon(formule) : ''}</div><div class="statwaarde">${waardeHtml}</div>${sub ? `<div class="statsub">${sub}</div>` : ''}</div>`;
}

function pctHtml(p) {
  return isGetal(p.waarde) ? esc(`${fmtGetal(p.waarde, 1)}%`) : onvoldoendeHtml(p.reden);
}

function berekendAantalHtml(n) {
  return isGetal(n) ? esc(fmtAantal(n)) : onvoldoendeHtml();
}

function minutenHtml(min) {
  if (!isGetal(min)) return onvoldoendeHtml();
  return `${esc(fmtGetal(min))} min`;
}

function urenSub(min) {
  return isGetal(min) ? `${esc(fmtUrenMinuten(min))} · ${esc(fmtGetal(min / 60))} uur` : '';
}

/** Totaal over de stappen: alleen als alle stappen voldoende gegevens hebben; anders de deelsom als toelichting. */
function totaalKaart(label, t, formule) {
  const sub = isGetal(t.waarde) ? urenSub(t.waarde)
    : t.nBekend ? `Deelsom van ${t.nBekend} van ${t.n} stappen: ${esc(fmtGetal(t.deelsom))} min (onvolledig)` : `Geen enkele stap heeft voldoende gegevens.`;
  return statKaart(label, minutenHtml(t.waarde), formule, sub);
}

function frequentieKaartenHtml(b) {
  const f = b.frequentie;
  return `<span class="etiket berekend">Frequentie</span>
    <div class="statgrid">
      ${statKaart('Nieuwe medewerkers', htmlAantalOfLeeg(f.nieuwe), 'Ingevoerd bij de maandgegevens.')}
      ${statKaart('Diensttijdopgaven aangeleverd', htmlAantalOfLeeg(f.aangeleverd), 'Ingevoerd bij de maandgegevens.')}
      ${statKaart('Geen diensttijdopgave', berekendAantalHtml(f.geenOpgave), 'Nieuwe medewerkers − aangeleverde diensttijdopgaven')}
      ${statKaart('Volledig verwerkt', htmlAantalOfLeeg(f.verwerkt), 'Aantal verwerkte diensttijdopgaven (maandgegevens).')}
      ${statKaart('Nog te verwerken', berekendAantalHtml(f.nogTeVerwerken), 'Aangeleverde − verwerkte diensttijdopgaven')}
      ${statKaart('Aanleverpercentage', pctHtml(f.aanleverPct), 'Aangeleverd ÷ nieuwe medewerkers × 100%, afgerond op één decimaal')}
      ${statKaart('Verwerkingspercentage', pctHtml(f.verwerkingsPct), 'Verwerkt ÷ aangeleverd × 100%, afgerond op één decimaal')}
      ${statKaart('Verwerkt t.o.v. alle nieuwe medewerkers', pctHtml(f.verwerktVanNieuwePct), 'Verwerkt ÷ nieuwe medewerkers × 100%, afgerond op één decimaal')}
    </div>`;
}

function dossierKaartenHtml(b) {
  const d = b.dossiers;
  const n = (r) => `gebaseerd op ${r.n} van ${d.aantal} dossiers`;
  return `<span class="etiket berekend">Documentvolume en complexiteit</span>
    ${d.afwijking ? `<div class="melding waarschuwing">Er zijn ${d.aantal} dossiers ingevoerd, maar ${esc(fmtAantal(b.frequentie.aangeleverd))} diensttijdopgaven aangeleverd. Dit blokkeert niets; de gegevensverzameling kan nog onvolledig zijn.</div>` : ''}
    <div class="statgrid">
      ${statKaart('Geregistreerde dossiers', esc(String(d.aantal)), 'Aantal ingevoerde dossiers in deze maandmeting.')}
      ${statKaart('Totaal ABP-periode-regels', berekendAantalHtml(d.regels.totaal), 'Som van de ABP-periode-regels van de afzonderlijke dossiers (niet gemiddelde × aantal).', n(d.regels))}
      ${statKaart('Gemiddeld aantal ABP-periode-regels', isGetal(d.regels.gemiddelde) ? esc(fmtGetal(d.regels.gemiddelde)) : onvoldoendeHtml(), 'Totaal ABP-periode-regels ÷ aantal dossiers met een ingevulde waarde', n(d.regels))}
      ${statKaart('Dossiers onder het gemiddelde', esc(String(d.regels.n)), 'Aantal dossiers met een ingevuld aantal ABP-periode-regels.', d.regels.ontbrekend.length ? `niet ingevuld bij ${esc(d.regels.ontbrekend.join(', '))}` : '')}
      ${statKaart('Totaal verwachte diensttijdblokken', berekendAantalHtml(d.blokken.totaal), 'Som van het verwachte aantal diensttijdblokken van de afzonderlijke dossiers.', n(d.blokken))}
      ${statKaart('Gemiddeld verwachte diensttijdblokken', isGetal(d.blokken.gemiddelde) ? esc(fmtGetal(d.blokken.gemiddelde)) : onvoldoendeHtml(), 'Totaal verwachte blokken ÷ aantal dossiers met een ingevulde waarde', n(d.blokken))}
      ${statKaart('Werkelijk ingevoerde Visma-regels', berekendAantalHtml(d.visma.totaal), 'Som van het werkelijke aantal regels in Visma van de afzonderlijke dossiers.', n(d.visma))}
      ${statKaart('Verwacht resterend aantal blokken', berekendAantalHtml(d.resterend.totaal), 'Per dossier: volledig verwerkt = 0; anders verwachte blokken − Visma-regels (minimaal 0); nog niet verwerkt zonder Visma-regels = verwachte blokken. Dossiers zonder voldoende gegevens tellen niet mee.',
        d.resterend.onbekend.length ? `onvolledig: onvoldoende gegevens bij ${esc(d.resterend.onbekend.join(', '))}` : `gebaseerd op ${d.resterend.n} dossiers`)}
    </div>`;
}

function tijdKaartenHtml(b) {
  const t = b.tijd;
  const formule = (deel) => (deel === 'uitgevoerd'
    ? 'Som over de stappen van: per dossier → tijd per dossier × verwerkte diensttijdopgaven; per diensttijdblok → tijd per blok × werkelijk ingevoerde Visma-regels'
    : deel === 'verwacht' ? 'Som over de stappen van: per dossier → tijd per dossier × aangeleverde diensttijdopgaven; per diensttijdblok → tijd per blok × totaal verwachte diensttijdblokken'
      : 'Verwachte totale maandbelasting − reeds uitgevoerde belasting');
  return `<span class="etiket berekend">Tijd ${b.schatting ? '<span class="schattinglabel">schatting</span>' : ''}</span>
    ${b.schatting ? `<div class="melding waarschuwing klein">De uitkomsten zijn (deels) een <strong>schatting</strong>: bij ${esc(b.geschatteStappen.join(', '))} is de tijd geschat of is de meetwijze niet ingevuld.</div>` : ''}
    <div class="statgrid">
      ${totaalKaart('Reeds uitgevoerde actieve tijd', t.actief.uitgevoerd, formule('uitgevoerd'))}
      ${totaalKaart('Resterende actieve tijd', t.actief.resterend, formule('resterend'))}
      ${totaalKaart('Totale verwachte actieve tijd', t.actief.verwacht, formule('verwacht'))}
      ${totaalKaart('Reeds opgetreden wachttijd', t.wacht.uitgevoerd, formule('uitgevoerd').replace(/tijd per/g, 'wachttijd per'))}
      ${totaalKaart('Resterende wachttijd', t.wacht.resterend, formule('resterend'))}
      ${totaalKaart('Totale verwachte wachttijd', t.wacht.verwacht, formule('verwacht').replace(/tijd per/g, 'wachttijd per'))}
      ${statKaart('Totale verwachte tijdsbelasting', minutenHtml(t.totaleBelasting), 'Totale verwachte actieve tijd + totale verwachte wachttijd', isGetal(t.totaleBelasting) ? `${urenSub(t.totaleBelasting)} · actief + wacht` : 'actief + wacht; onvoldoende gegevens bij een of meer stappen')}
    </div>
    ${b.waarschuwingen.filter((w) => w.includes('negatieve')).map((w) => `<div class="melding waarschuwing klein">${esc(w)}</div>`).join('')}`;
}

// ---------- Dashboard ----------

function maandDashboardHtml(b) {
  const m = b.meting;
  const rijen = [...b.stappen];
  if (maandSortering === 'tijd') rijen.sort((x, y) => (isGetal(y.actief.verwacht) ? y.actief.verwacht : -1) - (isGetal(x.actief.verwacht) ? x.actief.verwacht : -1) || x.stap.volgorde - y.stap.volgorde);
  const max = Math.max(0, ...b.stappen.map((r) => r.actief.verwacht).filter(isGetal));
  const stapRij = (r) => {
    const s = r.stap;
    const balk = isGetal(r.actief.verwacht) && max > 0 ? `<div class="balk" title="${esc(fmtGetal(r.actief.verwacht))} min"><span style="width:${((r.actief.verwacht / max) * 100).toFixed(1)}%"></span></div>` : '';
    return `<tr><td class="mono">${esc(s.stapId)}</td><td>${esc(s.naam)}</td><td>${esc(REKENEENHEDEN[s.eenheid] || '')}</td>
      <td class="getal">${isGetal(s.actief) ? esc(fmtGetal(s.actief)) : nietIngevuldHtml()}</td>
      <td class="getal berekend">${minutenHtml(r.actief.verwacht)}${balk}<div class="klein zacht">uitgevoerd ${isGetal(r.actief.uitgevoerd) ? esc(fmtGetal(r.actief.uitgevoerd)) : '–'} · resterend ${isGetal(r.actief.resterend) ? esc(fmtGetal(r.actief.resterend)) : '–'}</div></td>
      <td class="getal">${isGetal(s.wacht) ? esc(fmtGetal(s.wacht)) : nietIngevuldHtml()}<div class="klein zacht">verwacht ${isGetal(r.wacht.verwacht) ? esc(fmtGetal(r.wacht.verwacht)) + ' min' : '–'}</div></td>
      <td>${s.knelpunt === true ? `<strong>Ja</strong>${s.knelpuntToelichting ? `<div class="klein">${esc(s.knelpuntToelichting)}</div>` : ''}` : s.knelpunt === false ? 'Nee' : nietIngevuldHtml()}</td>
      <td>${s.meetwijze ? `${r.schatting ? '<span class="schatting">' : ''}${esc(s.meetwijze)}${r.schatting ? '</span>' : ''}` : nietIngevuldHtml()}</td>
      <td class="getal">${htmlAantalOfLeeg(s.waarnemingen)}</td></tr>`;
  };
  return `<div class="maandkop"><h3 style="margin:0">${esc(maandLabel(m))}</h3>
      <div class="knoppen" style="margin:0"><button type="button" class="klein" data-actie="maand-subtab" data-tab="gegevens">Maandgegevens invullen</button>
      <button type="button" class="klein" data-actie="maand-subtab" data-tab="dossiers">Dossiers (${m.dossiers.length})</button>
      <button type="button" class="klein" data-actie="maand-subtab" data-tab="stappen">Processtappen</button></div></div>
    <div class="berekend-kader" id="mmDashFrequentie">${frequentieKaartenHtml(b)}</div>
    <div class="berekend-kader mt" id="mmDashDossiers">${dossierKaartenHtml(b)}</div>
    <div class="berekend-kader mt" id="mmDashTijd">${tijdKaartenHtml(b)}</div>
    <div class="kaart mt"><div class="maandkop"><h3 style="margin:0">Processtappen ${formuleIcoon('Berekende totale actieve tijd = actieve tijd per eenheid × aantal eenheden (per dossier: aangeleverde diensttijdopgaven; per diensttijdblok: totaal verwachte diensttijdblokken).')}</h3>
      <label class="klein">Sorteren op <select id="mmSortering"><option value="volgorde" ${maandSortering === 'volgorde' ? 'selected' : ''}>stapvolgorde</option><option value="tijd" ${maandSortering === 'tijd' ? 'selected' : ''}>berekende actieve tijd (hoogste eerst)</option></select></label></div>
      <div class="tabelhouder mt"><table class="maandtabel" id="mmDashStappen"><thead><tr><th>Stap-ID</th><th>Processtap</th><th>Rekeneenheid</th><th class="getal">Actief per<br>eenheid (min)</th><th class="getal">Berekende totale<br>actieve tijd (verwacht)</th><th class="getal">Wacht per<br>eenheid (min)</th><th>Knelpunt</th><th>Meetwijze</th><th class="getal">Waar-<br>nemingen</th></tr></thead>
      <tbody>${rijen.map(stapRij).join('')}</tbody></table></div></div>
    ${herleidingHtml(b)}
    ${maandOverzichtHtml()}`;
}

/** Herleidbaarheid: alle onderliggende gegevens van deze maandmeting. */
function herleidingHtml(b) {
  const m = b.meting;
  return `<details class="kaart mt herleiding"><summary><strong>Herleiding: onderliggende gegevens</strong> <span class="klein zacht">(bestuur, maand, dossiers, stapmetingen, meetwijze, waarnemingen en wijzigingsdata)</span></summary>
    <dl class="gegevens mt">
      <dt>Maandmeting</dt><dd class="mono">${esc(m.id)}</dd>
      <dt>Proces / bestuur</dt><dd>${esc(m.procesId)} / ${esc(m.bestuur)}</dd>
      <dt>Maand en jaar</dt><dd>${esc(MAANDNAMEN[m.maand - 1])} ${esc(String(m.jaar))}</dd>
      <dt>Bron van de aantallen</dt><dd>${m.bron ? esc(m.bron) : nietIngevuldHtml()}</dd>
      <dt>Toelichting</dt><dd>${m.toelichting ? esc(m.toelichting) : nietIngevuldHtml()}</dd>
      <dt>Aangemaakt / laatst gewijzigd</dt><dd>${esc(fmtTijdstip(m.aangemaakt))} / ${m.gewijzigd ? esc(fmtTijdstip(m.gewijzigd)) : 'niet gewijzigd'}</dd>
    </dl>
    <h4>Dossiers (${m.dossiers.length})</h4>
    ${m.dossiers.length ? `<div class="tabelhouder"><table class="klein maandtabel"><thead><tr><th>Dossier-ID</th><th class="getal">ABP-regels</th><th class="getal">Verwachte blokken</th><th>Status</th><th class="getal">Visma-regels</th><th class="getal">Resterende blokken</th><th>Bron</th><th>Bijzonderheden</th><th>Laatst gewijzigd</th></tr></thead>
      <tbody>${m.dossiers.map((d) => `<tr><td class="mono">${esc(d.dossierId)}</td><td class="getal">${htmlAantalOfLeeg(d.perioderegels)}</td><td class="getal">${htmlAantalOfLeeg(d.verwachteBlokken)}</td><td>${esc(d.status || 'Status onbekend')}</td><td class="getal">${htmlAantalOfLeeg(d.vismaRegels)}</td>
        <td class="getal berekend">${berekendAantalHtml(resterendeBlokken(d))}</td><td>${esc(d.bron || '')}</td><td>${esc(d.bijzonderheden || '')}</td><td>${esc(fmtTijdstip(d.gewijzigd || d.aangemaakt))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="zacht klein">Nog geen dossiers.</p>'}
    <h4>Stapmetingen</h4>
    <div class="tabelhouder"><table class="klein maandtabel"><thead><tr><th>Stap-ID</th><th>Rekeneenheid</th><th class="getal">Actief per eenheid</th><th class="getal">Wacht per eenheid</th><th>Meetwijze</th><th class="getal">Waarnemingen</th><th>Berekening actieve tijd (verwacht)</th><th>Laatst gewijzigd</th></tr></thead>
      <tbody>${b.stappen.map((r) => `<tr><td class="mono">${esc(r.stap.stapId)}</td><td>${esc(REKENEENHEDEN[r.stap.eenheid])}</td><td class="getal">${htmlAantalOfLeeg(r.stap.actief)}</td><td class="getal">${htmlAantalOfLeeg(r.stap.wacht)}</td>
        <td>${r.stap.meetwijze ? esc(r.stap.meetwijze) : nietIngevuldHtml()}</td><td class="getal">${htmlAantalOfLeeg(r.stap.waarnemingen)}</td><td class="klein">${esc(stapFormuleTekst(r, 'actief', 'verwacht'))}</td><td>${r.stap.gewijzigd ? esc(fmtTijdstip(r.stap.gewijzigd)) : '–'}</td></tr>`).join('')}</tbody></table></div>
  </details>`;
}

/** Bijv. "2,00 min × 14 aangeleverde diensttijdopgaven = 28,00 min". */
function stapFormuleTekst(r, soort, deel) {
  const t = r.stap[soort];
  const n = r.eenheden[deel];
  const label = r.eenheden[`${deel}Label`];
  const uitkomst = r[soort][deel];
  if (!isGetal(t) || !isGetal(n)) return `${isGetal(t) ? fmtGetal(t) + ' min' : 'tijd niet ingevuld'} × ${isGetal(n) ? fmtAantal(n) : '?'} ${label} = ${ONVOLDOENDE}`;
  return `${fmtGetal(t)} min × ${fmtAantal(n)} ${label} = ${fmtGetal(uitkomst)} min`;
}

// ---------- Acties ----------

function maandNieuw() {
  const bestaand = huidigeMaandmeting();
  if (bestaand) { toonMelding(`De maandmeting ${maandLabel(bestaand)} bestaat al en is geopend.`); maandSubtab = 'dashboard'; renderMaand(); return; }
  if (maandOpslagGeblokkeerd) { toonMelding('Opslaan is uitgeschakeld omdat de bestaande maandgegevens onleesbaar zijn.', true); return; }
  const m = nieuweMaandmeting(maandKeuze.bestuur, maandKeuze.jaar, maandKeuze.maand);
  slaMaandOp();
  maandSubtab = 'gegevens';
  renderMaand();
  toonMelding(`Maandmeting ${maandLabel(m)} is aangemaakt.`);
}

function maandOpslaan() {
  if (!huidigeMaandmeting()) return;
  const ongeldig = $$('#maandInhoud .ongeldig').length;
  if (slaMaandOp()) toonMelding(ongeldig ? 'Opgeslagen. Let op: ongeldige invoer (rood gemarkeerd) is niet opgeslagen.' : 'Alle wijzigingen zijn opgeslagen.', !!ongeldig);
}

async function maandVerwijderen() {
  const m = huidigeMaandmeting();
  if (!m) return;
  const ok = await bevestig('Maandmeting verwijderen', `<p>De maandmeting <strong>${esc(maandLabel(m))}</strong> wordt verwijderd, met ${m.dossiers.length} dossier(s) en alle stapgegevens van deze maand.</p>
    <div class="melding waarschuwing">Dit kan niet ongedaan worden gemaakt. Download eerst een back-up als u de gegevens wilt bewaren. Andere maanden en besturen blijven ongewijzigd.</div>`, 'Maandmeting verwijderen', true);
  if (!ok) return;
  verwijderMaandmeting(m.id);
  slaMaandOp();
  renderMaand();
  toonMelding(`Maandmeting ${maandLabel(m)} is verwijderd.`);
}

async function dossierToevoegen() {
  const m = huidigeMaandmeting();
  if (!m) return;
  const tijd = nuIso();
  m.dossiers.push({ dossierId: voorgesteldDossierId(m), perioderegels: null, verwachteBlokken: null, status: 'Status onbekend', vismaRegels: null, bijzonderheden: '', bron: '', aangemaakt: tijd, gewijzigd: null });
  m.gewijzigd = tijd;
  slaMaandOp();
  renderMaand();
  const rijen = $$('#mmDossiers tr[data-dossier]');
  const laatste = rijen[rijen.length - 1];
  if (laatste) $('[data-dveld="perioderegels"]', laatste).focus();
}

async function dossierVerwijderen(index) {
  const m = huidigeMaandmeting();
  const d = m && m.dossiers[index];
  if (!d) return;
  const ok = await bevestig('Dossier verwijderen', `<p>Dossier <strong>${esc(d.dossierId)}</strong> wordt verwijderd uit ${esc(maandLabel(m))}.</p>`, 'Dossier verwijderen', true);
  if (!ok) return;
  m.dossiers.splice(index, 1);
  m.gewijzigd = nuIso();
  slaMaandOp();
  renderMaand();
}

/** Neemt tijden, rekeneenheid, meetwijze en aantal waarnemingen over uit een andere maandmeting (na bevestiging). */
async function stappenOvernemen() {
  const m = huidigeMaandmeting();
  if (!m) return;
  const bronnen = maandStaat.maandmetingen.filter((x) => x.id !== m.id && x.stappen.some((s) => isGetal(s.actief) || isGetal(s.wacht)));
  if (!bronnen.length) { await informeer('Tijden overnemen', '<p>Er is nog geen andere maandmeting met ingevulde tijden per processtap.</p>'); return; }
  let bronId = null;
  const antwoord = await dialoog({
    titel: 'Tijden overnemen uit een andere maandmeting',
    inhoud: `<p>Actieve tijd, wachttijd, rekeneenheid, meetwijze en aantal waarnemingen worden overgenomen voor alle stappen. Knelpunten en opmerkingen van deze maand blijven staan. Bij iedere stap wordt de herkomst in de opmerking vastgelegd.</p>
      <div class="veld"><label for="mmOvernameBron">Overnemen uit</label><select id="mmOvernameBron">${bronnen.map((x) => `<option value="${esc(x.id)}">${esc(maandLabel(x))}</option>`).join('')}</select></div>`,
    knoppen: [{ label: 'Annuleren', waarde: null }, { label: 'Tijden overnemen', waarde: 'ok', soort: 'primair', controle: () => { bronId = $('#mmOvernameBron').value; return true; } }],
  });
  if (antwoord !== 'ok') return;
  const bron = maandStaat.maandmetingen.find((x) => x.id === bronId);
  const tijd = nuIso();
  for (const s of m.stappen) {
    const b = bron.stappen.find((x) => x.stapId === s.stapId);
    if (!b) continue;
    Object.assign(s, { actief: b.actief, wacht: b.wacht, eenheid: b.eenheid, meetwijze: b.meetwijze, waarnemingen: b.waarnemingen, gewijzigd: tijd });
    s.opmerking = [s.opmerking, `Tijden overgenomen uit ${maandLabel(bron)} op ${fmtTijdstip(tijd)}.`].filter(Boolean).join(' ');
  }
  m.gewijzigd = tijd;
  slaMaandOp();
  renderMaand();
  toonMelding(`Tijden overgenomen uit ${maandLabel(bron)}.`);
}

async function maandExportDialoog() {
  const actie = await dialoog({
    titel: 'Maandmetingen exporteren',
    inhoud: `<p>Alle exports bevatten proces, bestuur, maand en jaar, datum en tijd van export, bron en meetwijze, aantal waarnemingen en opmerkingen. De Excel-export bevat alle maandmetingen; de volledige JSON-back-up bevat ook alle overige gegevens van de tool en kan later opnieuw worden geïmporteerd.</p>`,
    knoppen: [
      { label: 'Annuleren', waarde: null },
      { label: 'CSV processtappen', waarde: 'csv-stappen' },
      { label: 'CSV dossiers', waarde: 'csv-dossiers' },
      { label: 'CSV maandmetingen', waarde: 'csv-maand' },
      { label: 'JSON-back-up (volledig)', waarde: 'json' },
      { label: 'Excel (alle maandmetingen)', waarde: 'excel', soort: 'primair' },
    ],
  });
  if (actie === 'excel') exporteerMaandExcel();
  else if (actie === 'csv-maand') exporteerCsv('maandmetingen');
  else if (actie === 'csv-dossiers') exporteerCsv('maanddossiers');
  else if (actie === 'csv-stappen') exporteerCsv('maandstappen');
  else if (actie === 'json') downloadBackup();
}
