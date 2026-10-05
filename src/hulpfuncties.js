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
  const d = new Date(iso + 'T00:00:00');
  return !isNaN(d) && d.toISOString().slice(0, 10) === iso;
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
