// ---------- Algemene hulpfuncties ----------

const ONBEKEND = 'Onbekend';

/** Escapet tekst voor veilig gebruik in HTML. */
function esc(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isGetal(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Leest een getal uit gebruikersinvoer. Accepteert komma en punt als decimaalteken.
 * Geeft { leeg: true, waarde: null } bij lege invoer, { waarde } bij een geldig getal
 * en { fout } bij ongeldige invoer. Lege invoer wordt nooit als nul geïnterpreteerd.
 */
function leesGetal(invoer) {
  if (invoer === null || invoer === undefined) return { leeg: true, waarde: null };
  if (typeof invoer === 'number') {
    return Number.isFinite(invoer) ? { waarde: invoer } : { fout: 'Ongeldig getal.' };
  }
  const tekst = String(invoer).trim().replace(/\s+/g, '');
  if (tekst === '') return { leeg: true, waarde: null };
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(tekst)) {
    return { fout: 'Vul een getal in, bijvoorbeeld 1,5 (gebruik geen duizendtalscheiding).' };
  }
  // "1.450" of "12.500" is dubbelzinnig: decimaalpunt of duizendtalscheiding? Niet gokken, maar laten verduidelijken.
  if (/^[-+]?[1-9]\d{0,2}\.\d{3}$/.test(tekst)) {
    const [heel, deel] = tekst.replace(/^[-+]/, '').split('.');
    return { fout: `"${tekst}" is dubbelzinnig. Bedoelt u ${heel}${deel}? Typ dan ${heel}${deel} zonder punt. Bedoelt u een decimaal getal? Typ dan ${heel},${deel}.` };
  }
  const n = Number(tekst.replace(',', '.'));
  if (!Number.isFinite(n)) return { fout: 'Ongeldig getal.' };
  return { waarde: n };
}

/** Rondt alleen voor weergave af. Ontbrekende waarden worden als 'Onbekend' getoond. */
function fmtGetal(n, decimalen = 2) {
  if (!isGetal(n)) return ONBEKEND;
  const negatief = n < 0;
  const [heel, deel] = Math.abs(n).toFixed(decimalen).split('.');
  const heelMetPunten = heel.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const uit = deel ? `${heelMetPunten},${deel}` : heelMetPunten;
  return (negatief && Number(Math.abs(n).toFixed(decimalen)) !== 0 ? '-' : '') + uit;
}

/** Zet een getal om naar invoertekst met komma, zonder af te ronden. */
function naarInvoer(n) {
  if (!isGetal(n)) return '';
  return String(n).replace('.', ',');
}

/** HTML-weergave van een getal: 'Onbekend' cursief bij ontbrekende waarde. */
function htmlGetal(n, decimalen = 2, achtervoegsel = '') {
  if (!isGetal(n)) return `<span class="onbekend">${ONBEKEND}</span>`;
  return esc(fmtGetal(n, decimalen) + achtervoegsel);
}

function htmlTekst(t) {
  if (t === null || t === undefined || String(t).trim() === '') return `<span class="onbekend">${ONBEKEND}</span>`;
  return esc(t);
}

function fmtDatum(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ? String(iso) : ONBEKEND;
  const [j, m, d] = iso.split('-');
  return `${d}-${m}-${j}`;
}

function fmtTijdstip(iso) {
  if (!iso) return ONBEKEND;
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function vandaagIso() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function nuIso() {
  return new Date().toISOString();
}

function isGeldigeDatum(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  // Volledig in UTC controleren: lokale middernacht valt in UTC+1/+2 op de vorige dag.
  const [j, m, d] = iso.split('-').map(Number);
  const datum = new Date(Date.UTC(j, m - 1, d));
  return datum.getUTCFullYear() === j && datum.getUTCMonth() === m - 1 && datum.getUTCDate() === d;
}

function bestandsdatum() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------- Statistiek ----------

/** Som met compensatie (Neumaier) om afrondingsfouten bij decimalen te beperken. */
function som(waarden) {
  let totaal = 0;
  let correctie = 0;
  for (const w of waarden) {
    const t = totaal + w;
    if (Math.abs(totaal) >= Math.abs(w)) correctie += (totaal - t) + w;
    else correctie += (w - t) + totaal;
    totaal = t;
  }
  return totaal + correctie;
}

function gemiddelde(waarden) {
  return waarden.length ? som(waarden) / waarden.length : null;
}

/** Mediaan: middelste waarde; bij een even aantal het gemiddelde van de twee middelste. */
function mediaan(waarden) {
  if (!waarden.length) return null;
  const s = [...waarden].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Beschrijvende statistiek over een lijst { metingId, waarde }.
 * Alleen waarden die echt bekend zijn, worden meegenomen.
 */
function beschrijf(items) {
  const geldig = items.filter((i) => isGetal(i.waarde));
  const w = geldig.map((i) => i.waarde);
  return {
    n: w.length,
    gemiddelde: gemiddelde(w),
    mediaan: mediaan(w),
    minimum: w.length ? Math.min(...w) : null,
    maximum: w.length ? Math.max(...w) : null,
    metingIds: geldig.map((i) => i.metingId),
    items: geldig,
  };
}

// ---------- CSV ----------

function csvVeld(waarde) {
  if (waarde === null || waarde === undefined) return '';
  let t = typeof waarde === 'number' ? naarInvoer(waarde) : String(waarde);
  if (/[";\r\n]/.test(t) || /^\s|\s$/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/** Bouwt CSV met puntkomma als scheidingsteken en komma als decimaalteken (Nederlandse Excel). */
function maakCsv(koppen, rijen, voorregels = []) {
  const regels = [...voorregels.map((r) => csvVeld(r)), koppen.map(csvVeld).join(';')];
  for (const r of rijen) regels.push(r.map(csvVeld).join(';'));
  return '﻿' + regels.join('\r\n') + '\r\n';
}

/** Leest CSV; herkent puntkomma, komma of tab als scheidingsteken. */
function leesCsv(tekst) {
  tekst = tekst.replace(/^﻿/, '');
  const eersteRegel = tekst.split(/\r?\n/)[0] || '';
  const tellen = (c) => eersteRegel.split(c).length - 1;
  const kandidaten = [';', ',', '\t'];
  const scheiding = kandidaten.reduce((best, c) => (tellen(c) > tellen(best) ? c : best), ';');
  const rijen = [];
  let rij = [];
  let veld = '';
  let tussenAanhalingstekens = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (tussenAanhalingstekens) {
      if (c === '"') {
        if (tekst[i + 1] === '"') { veld += '"'; i++; } else tussenAanhalingstekens = false;
      } else veld += c;
    } else if (c === '"') tussenAanhalingstekens = true;
    else if (c === scheiding) { rij.push(veld); veld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++;
      rij.push(veld); veld = '';
      if (rij.some((v) => v.trim() !== '')) rijen.push(rij);
      rij = [];
    } else veld += c;
  }
  rij.push(veld);
  if (rij.some((v) => v.trim() !== '')) rijen.push(rij);
  return rijen;
}

// ---------- Bestanden ----------

function downloadBlob(blob, bestandsnaam) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function downloadTekst(tekst, bestandsnaam, type) {
  downloadBlob(new Blob([tekst], { type }), bestandsnaam);
}

function leesBestandAlsTekst(bestand) {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader();
    lezer.onload = () => resolve(String(lezer.result));
    lezer.onerror = () => reject(new Error('Het bestand kon niet worden gelezen.'));
    lezer.readAsText(bestand, 'utf-8');
  });
}

function vergelijkTekst(a, b) {
  return String(a).localeCompare(String(b), 'nl', { numeric: true });
}

function uniek(lijst) {
  return [...new Set(lijst)];
}

/** Toont gehele getallen zonder decimalen en overige getallen met twee decimalen. */
function fmtAantal(n) {
  return isGetal(n) && Number.isInteger(n) ? fmtGetal(n, 0) : fmtGetal(n, 2);
}

function htmlAantal(n, achtervoegsel = '') {
  if (!isGetal(n)) return `<span class="onbekend">${ONBEKEND}</span>`;
  return esc(fmtAantal(n) + achtervoegsel);
}

// ---------- Kalenderweek (ISO 8601, Nederlandse weekindeling: maandag t/m zondag) ----------

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/**
 * Kalenderweek van een datum (JJJJ-MM-DD). Week 1 is de week met de eerste donderdag van het jaar.
 * jaar = ISO-weekjaar (bijv. 1 januari 2027 valt in week 53 van 2026). Volledig in UTC, dus tijdzone-onafhankelijk.
 */
function kalenderweek(isoDatum) {
  if (!isGeldigeDatum(isoDatum)) return null;
  const [j, m, d] = isoDatum.split('-').map(Number);
  const datum = Date.UTC(j, m - 1, d);
  const dagNr = new Date(datum).getUTCDay() || 7; // 1 = maandag … 7 = zondag
  const DAG = 864e5;
  const begin = datum - (dagNr - 1) * DAG;
  const donderdag = new Date(begin + 3 * DAG);
  const jaar = donderdag.getUTCFullYear();
  const jan4 = Date.UTC(jaar, 0, 4);
  const maandagWeek1 = jan4 - ((new Date(jan4).getUTCDay() || 7) - 1) * DAG;
  const naarIso = (t) => new Date(t).toISOString().slice(0, 10);
  return { jaar, week: Math.round((begin - maandagWeek1) / (7 * DAG)) + 1, begin: naarIso(begin), eind: naarIso(begin + 6 * DAG) };
}

/** Bijv. "5 t/m 11 oktober 2026" of "28 december 2026 t/m 3 januari 2027". */
function weekBereikTekst(beginIso, eindIso) {
  const [bj, bm, bd] = beginIso.split('-').map(Number);
  const [ej, em, ed] = eindIso.split('-').map(Number);
  if (bj !== ej) return `${bd} ${MAANDEN[bm - 1]} ${bj} t/m ${ed} ${MAANDEN[em - 1]} ${ej}`;
  if (bm !== em) return `${bd} ${MAANDEN[bm - 1]} t/m ${ed} ${MAANDEN[em - 1]} ${ej}`;
  return `${bd} t/m ${ed} ${MAANDEN[em - 1]} ${ej}`;
}

/** Bijv. "Kalenderweek 41 van 2026 (5 t/m 11 oktober 2026)". */
function kalenderweekTekst(isoDatum, kort) {
  const k = kalenderweek(isoDatum);
  if (!k) return '';
  return kort ? `week ${k.week} van ${k.jaar}` : `Kalenderweek ${k.week} van ${k.jaar} (${weekBereikTekst(k.begin, k.eind)})`;
}

/** Sleutel voor groeperen/kiezen van een kalenderweek, bijv. "2026-W41". */
function kalenderweekSleutel(isoDatum) {
  const k = kalenderweek(isoDatum);
  return k ? `${k.jaar}-W${String(k.week).padStart(2, '0')}` : '';
}

function kalenderweekSleutelTekst(sleutel) {
  const m = /^(\d{4})-W(\d{2})$/.exec(sleutel || '');
  return m ? `kalenderweek ${Number(m[2])} van ${m[1]}` : '';
}

// ---------- Eenheden ----------

/** Lege of nietszeggende eenheden ("n.v.t.", "-", "onbekend") gelden als ontbrekend. */
function isOntbrekendeEenheid(tekst) {
  const t = String(tekst || '').trim().toLowerCase();
  return !t || /^(n\.?\s?v\.?\s?t\.?|nvt|-+|\?+|onbekend|geen|x)$/.test(t);
}

// ---------- Korte uitleg bij begrippen ----------

const UITLEG = {
  actief: 'Actieve tijd: tijd waarin een medewerker daadwerkelijk aan het dossier werkt.',
  wacht: 'Wachttijd: tijd waarin het proces stilligt zonder dat de medewerker eraan werkt (bijv. wachten op een reactie of systeem).',
  doorlooptijd: 'Doorlooptijd: actieve tijd + wachttijd; de totale tijd van begin tot einde van de uitvoering.',
  omvang: 'Omvang: het aantal items dat binnen één procesuitvoering wordt verwerkt, uitgedrukt in de omvangseenheid (bijv. diensttijdregistraties).',
  uitvoeringseenheid: 'Uitvoeringseenheid: wat één uitvoering van het proces is (bijv. één dossier). Tijden worden per uitvoeringseenheid berekend.',
  frequentie: 'Frequentie: hoe vaak het proces binnen een bepaalde periode wordt uitgevoerd (bijv. 25 dossiers per week).',
  frequentieperiode: 'Frequentieperiode: de periode waarop het aantal betrekking heeft (per dag, week, maand, kwartaal of jaar). Dit is iets anders dan het meetmoment.',
  kalenderweek: 'Kalenderweek (meetmoment): de ISO-week (maandag t/m zondag) waarin de meetdatum valt. Wordt automatisch uit de datum berekend.',
  tijdsbelasting: 'Geschatte actieve tijdsbelasting: totale frequentie × gemiddelde actieve tijd per procesuitvoering. Wachttijd telt niet mee.',
  meetellen: 'Meetellen in totaal: alleen aanvinken als deze frequentie een eigen, niet-overlappend deel van het werk beschrijft. Alleen aangevinkte frequenties worden opgeteld.',
  blokken: 'Aantal resulterende diensttijdblokken: het aantal aaneengesloten diensttijdblokken dat na beoordeling van de ABP-periode-regels overblijft en mogelijk als afzonderlijke registratie in Visma wordt ingevoerd. Bijv. 40 beoordeelde dienstperioden → 4 diensttijdblokken.',
  knelpunt: 'Knelpunt: iets dat de uitvoering van een stap hindert (bijv. wachten, systeem, onduidelijke informatie). De geschatte extra tijd is verklarend: die zit al in de gemeten actieve tijd of wachttijd en wordt niet opnieuw opgeteld bij de procesduur of tijdsbelasting.',
  test: 'Test/fictieve meting: blijft zichtbaar in de ruwe gegevens, maar telt standaard niet mee in gemiddelden, grafieken, totalen en tijdsbelasting.',
};

function infoHtml(term) {
  const t = UITLEG[term] || '';
  return `<span class="uitleg-i" tabindex="0" role="img" title="${esc(t)}" aria-label="${esc('Uitleg: ' + t)}">i</span>`;
}
