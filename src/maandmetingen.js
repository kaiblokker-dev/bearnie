// ---------- PR24-maandmetingen (versie 1.8) ----------
//
// Eén maandmeting per combinatie van bestuur, maand en jaar (bijv. PR24 – LEV – augustus 2026), met
// maandgegevens, geanonimiseerde dossiers en per processtap de tijd per eenheid.
//
// Opslag: een EIGEN localStorage-sleutel (MAAND_SLEUTEL). De bestaande gegevens van de tool (IndexedDB)
// en de bestaande localStorage-sleutels worden niet gelezen, gewijzigd of overschreven. Is de opgeslagen
// tekst onleesbaar, dan wordt er niet overheen geschreven (opslaan blijft dan geblokkeerd).
//
// maandmeting: { id, procesId, bestuur, jaar, maand (1–12), nieuweMedewerkers, aangeleverd, verwerkt,
//                bron, toelichting, dossiers: [dossier], stappen: [stap], aangemaakt, gewijzigd }
// dossier:     { dossierId, perioderegels, verwachteBlokken, status, vismaRegels, bijzonderheden, bron,
//                aangemaakt, gewijzigd }
// stap:        { stapId, naam, volgorde, eenheid ('dossier' | 'blok'), actief, wacht (min per eenheid),
//                meetwijze, waarnemingen, knelpunt (true/false/null), knelpuntToelichting, opmerking, gewijzigd }
// Ontbrekende getallen zijn null en worden nooit als nul behandeld. Berekende waarden worden niet opgeslagen.

const MAAND_SLEUTEL = 'meettool-pr24-maandmetingen';
const MAAND_FORMAAT = 'meettool-pr24-maandmetingen';
const MAANDNAMEN = MAANDEN; // januari … december (hulpfuncties.js)

let maandStaat = { maandmetingen: [] };
let maandOpgeslagenOp = null;
let maandOpslagGeblokkeerd = false;

function laadMaandmetingen() {
  maandOpslagGeblokkeerd = false;
  try {
    const tekst = localStorage.getItem(MAAND_SLEUTEL);
    if (!tekst) { maandStaat = { maandmetingen: [] }; return true; }
    const j = JSON.parse(tekst);
    if (!j || !Array.isArray(j.maandmetingen)) throw new Error('onbekend formaat');
    maandStaat = { maandmetingen: j.maandmetingen.map(normaliseerMaandmeting) };
    maandOpgeslagenOp = j.opgeslagen || null;
    return true;
  } catch (e) {
    // Niet overschrijven: de opgeslagen tekst blijft staan voor herstel.
    maandStaat = { maandmetingen: [] };
    maandOpslagGeblokkeerd = true;
    return false;
  }
}

/** Schrijft alle maandmetingen naar de eigen localStorage-sleutel. Geeft true bij succes. */
function bewaarMaandmetingen() {
  if (maandOpslagGeblokkeerd) return false;
  const tijd = nuIso();
  try {
    localStorage.setItem(MAAND_SLEUTEL, JSON.stringify({ formaat: MAAND_FORMAAT, schemaversie: 1, toolversie: VERSIE, opgeslagen: tijd, maandmetingen: maandStaat.maandmetingen }));
    maandOpgeslagenOp = tijd;
    return true;
  } catch (e) {
    return false;
  }
}

function maandId(bestuur, jaar, maand) {
  return `${MAAND_PROCES}-${bestuur}-${jaar}-${String(maand).padStart(2, '0')}`;
}

function maandLabel(m) {
  return `${m.procesId || MAAND_PROCES} – ${m.bestuur} – ${MAANDNAMEN[m.maand - 1]} ${m.jaar}`;
}

function zoekMaandmeting(bestuur, jaar, maand) {
  return maandStaat.maandmetingen.find((m) => m.bestuur === bestuur && m.jaar === jaar && m.maand === maand) || null;
}

function legeStap(sjabloon) {
  return { stapId: sjabloon.stapId, naam: sjabloon.naam, volgorde: sjabloon.volgorde, eenheid: sjabloon.eenheid, actief: null, wacht: null, meetwijze: '', waarnemingen: null, knelpunt: null, knelpuntToelichting: '', opmerking: '', gewijzigd: null };
}

/** Vult ontbrekende onderdelen aan zonder bestaande waarden te wijzigen. */
function normaliseerMaandmeting(m) {
  const r = { ...m };
  r.procesId = r.procesId || MAAND_PROCES;
  r.dossiers = Array.isArray(r.dossiers) ? r.dossiers : [];
  r.stappen = Array.isArray(r.stappen) ? r.stappen : [];
  for (const s of PR24_STAPPEN) if (!r.stappen.some((x) => x.stapId === s.stapId)) r.stappen.push(legeStap(s));
  r.stappen.sort((a, b) => (a.volgorde || 99) - (b.volgorde || 99) || vergelijkTekst(a.stapId, b.stapId));
  r.id = r.id || maandId(r.bestuur, r.jaar, r.maand);
  return r;
}

function nieuweMaandmeting(bestuur, jaar, maand) {
  const tijd = nuIso();
  const m = {
    id: maandId(bestuur, jaar, maand), procesId: MAAND_PROCES, bestuur, jaar, maand,
    nieuweMedewerkers: null, aangeleverd: null, verwerkt: null, bron: '', toelichting: '',
    dossiers: [], stappen: PR24_STAPPEN.map(legeStap), aangemaakt: tijd, gewijzigd: null,
  };
  maandStaat.maandmetingen.push(m);
  maandStaat.maandmetingen.sort((a, b) => a.jaar - b.jaar || a.maand - b.maand || vergelijkTekst(a.bestuur, b.bestuur));
  return m;
}

function verwijderMaandmeting(id) {
  maandStaat.maandmetingen = maandStaat.maandmetingen.filter((m) => m.id !== id);
}

/** Voorstel voor een nieuw dossier-ID, bijv. LEV-2026-08-D01. */
function voorgesteldDossierId(m) {
  const prefix = `${m.bestuur}-${m.jaar}-${String(m.maand).padStart(2, '0')}-D`;
  const nummers = m.dossiers.map((d) => (d.dossierId.startsWith(prefix) && /^\d+$/.test(d.dossierId.slice(prefix.length)) ? Number(d.dossierId.slice(prefix.length)) : 0));
  return prefix + String(Math.max(0, ...nummers) + 1).padStart(2, '0');
}

// ---------- Validatie ----------

const isGeheelOfLeeg = (v) => v === null || (Number.isInteger(v) && v >= 0);

/** Controleert de maandgegevens: geheel ≥ 0 en verwerkt ≤ aangeleverd ≤ nieuwe medewerkers. */
function valideerMaandgegevens(g) {
  const fouten = [];
  for (const [veld, label] of [['nieuweMedewerkers', 'Het aantal nieuwe medewerkers'], ['aangeleverd', 'Het aantal aangeleverde diensttijdopgaven'], ['verwerkt', 'Het aantal verwerkte diensttijdopgaven']]) {
    if (Number.isNaN(g[veld])) fouten.push(`${label} is geen geldig getal.`);
    else if (!isGeheelOfLeeg(g[veld])) fouten.push(`${label} moet een geheel getal van 0 of hoger zijn.`);
  }
  if (!fouten.length) {
    if (isGetal(g.aangeleverd) && isGetal(g.nieuweMedewerkers) && g.aangeleverd > g.nieuweMedewerkers) fouten.push(`Er zijn meer diensttijdopgaven aangeleverd (${g.aangeleverd}) dan er nieuwe medewerkers zijn (${g.nieuweMedewerkers}).`);
    if (isGetal(g.verwerkt) && isGetal(g.aangeleverd) && g.verwerkt > g.aangeleverd) fouten.push(`Er zijn meer diensttijdopgaven verwerkt (${g.verwerkt}) dan aangeleverd (${g.aangeleverd}).`);
  }
  return fouten;
}

function valideerDossier(d, m, index) {
  const fouten = [];
  const id = (d.dossierId || '').trim();
  if (!id) fouten.push('Vul een dossier-ID in.');
  else if (!ID_PATROON.test(id)) fouten.push(`Dossier-ID "${id}" mag alleen letters, cijfers, - en _ bevatten.`);
  else if (m.dossiers.some((x, i) => i !== index && x.dossierId === id)) fouten.push(`Dossier-ID ${id} komt al voor in deze maandmeting.`);
  for (const [veld, label] of [['perioderegels', 'ABP-periode-regels'], ['verwachteBlokken', 'Verwacht aantal diensttijdblokken'], ['vismaRegels', 'Werkelijk aantal regels in Visma']]) {
    if (Number.isNaN(d[veld]) || !isGeheelOfLeeg(d[veld])) fouten.push(`${label}: vul een geheel getal van 0 of hoger in, of laat het veld leeg.`);
  }
  if (d.status && !DOSSIER_STATUSSEN.includes(d.status)) fouten.push('Kies een geldige verwerkingsstatus.');
  return fouten;
}

function valideerStap(s) {
  const fouten = [];
  for (const [veld, label] of [['actief', 'Actieve tijd'], ['wacht', 'Wachttijd']]) {
    if (Number.isNaN(s[veld]) || (s[veld] !== null && !(isGetal(s[veld]) && s[veld] >= 0))) fouten.push(`${s.stapId} – ${label}: vul een getal van 0 of hoger in, of laat het veld leeg.`);
  }
  if (Number.isNaN(s.waarnemingen) || !isGeheelOfLeeg(s.waarnemingen)) fouten.push(`${s.stapId} – Aantal waarnemingen: vul een geheel getal van 0 of hoger in.`);
  if (!REKENEENHEDEN[s.eenheid]) fouten.push(`${s.stapId}: kies een rekeneenheid.`);
  if (s.meetwijze && !MAAND_MEETWIJZEN.includes(s.meetwijze)) fouten.push(`${s.stapId}: kies een geldige meetwijze.`);
  return fouten;
}

/** Een privacywaarschuwing voor dossier-ID's met een lange cijferreeks (lijkt op een echt nummer). */
function lijktOpPersoonsnummer(id) {
  return /\d{7,}/.test(id || '');
}

// ---------- Berekeningen ----------

/** Resultaat van een berekening: { waarde, reden } met reden bij een ontbrekende waarde. */
function percentage(teller, noemer) {
  if (!isGetal(teller) || !isGetal(noemer)) return { waarde: null, reden: 'onvoldoende gegevens' };
  if (noemer === 0) return { waarde: null, reden: 'niet te berekenen (deler is 0)' };
  return { waarde: (teller / noemer) * 100 };
}

function reeksVan(dossiers, veld) {
  const met = dossiers.filter((d) => isGetal(d[veld]));
  const totaal = met.length ? som(met.map((d) => d[veld])) : null;
  return { n: met.length, totaal, gemiddelde: met.length ? totaal / met.length : null, ids: met.map((d) => d.dossierId), ontbrekend: dossiers.filter((d) => !isGetal(d[veld])).map((d) => d.dossierId) };
}

/** Verwacht aantal nog in te voeren diensttijdblokken van één dossier, of null als dat niet vast te stellen is. */
function resterendeBlokken(d) {
  if (d.status === 'Volledig verwerkt') return 0;
  if (!isGetal(d.verwachteBlokken)) return null;
  if (isGetal(d.vismaRegels)) return Math.max(0, d.verwachteBlokken - d.vismaRegels);
  if (d.status === 'Nog niet verwerkt') return d.verwachteBlokken;
  return null;
}

const GESCHATTE_MEETWIJZEN = ['Geschat door onderzoeker', 'Geschat door medewerker'];

/** Alle berekende uitkomsten van één maandmeting. Niets hiervan wordt opgeslagen. */
function berekenMaand(m) {
  const nieuwe = m.nieuweMedewerkers;
  const aangeleverd = m.aangeleverd;
  const verwerkt = m.verwerkt;
  const verschil = (a, b) => (isGetal(a) && isGetal(b) ? a - b : null);
  const frequentie = {
    nieuwe, aangeleverd, verwerkt,
    geenOpgave: verschil(nieuwe, aangeleverd),
    nogTeVerwerken: verschil(aangeleverd, verwerkt),
    aanleverPct: percentage(aangeleverd, nieuwe),
    verwerkingsPct: percentage(verwerkt, aangeleverd),
    verwerktVanNieuwePct: percentage(verwerkt, nieuwe),
  };

  const regels = reeksVan(m.dossiers, 'perioderegels');
  const blokken = reeksVan(m.dossiers, 'verwachteBlokken');
  const visma = reeksVan(m.dossiers, 'vismaRegels');
  const rest = m.dossiers.map((d) => ({ d, r: resterendeBlokken(d) }));
  const restBekend = rest.filter((x) => isGetal(x.r));
  const dossiers = {
    aantal: m.dossiers.length,
    regels, blokken, visma,
    resterend: {
      totaal: restBekend.length ? som(restBekend.map((x) => x.r)) : null,
      n: restBekend.length,
      ids: restBekend.map((x) => x.d.dossierId),
      onbekend: rest.filter((x) => !isGetal(x.r)).map((x) => x.d.dossierId),
    },
    statussen: DOSSIER_STATUSSEN.map((s) => ({ status: s, aantal: m.dossiers.filter((d) => (d.status || 'Status onbekend') === s).length })),
    afwijking: isGetal(aangeleverd) && m.dossiers.length !== aangeleverd,
  };

  // Aantal eenheden per rekeneenheid: uitgevoerd en verwacht.
  const eenheden = {
    dossier: { uitgevoerd: verwerkt, verwacht: aangeleverd, uitgevoerdLabel: 'verwerkte diensttijdopgaven', verwachtLabel: 'aangeleverde diensttijdopgaven' },
    blok: { uitgevoerd: visma.totaal, verwacht: blokken.totaal, uitgevoerdLabel: 'werkelijk ingevoerde Visma-regels', verwachtLabel: 'verwachte diensttijdblokken' },
  };
  const maal = (t, n) => (isGetal(t) && isGetal(n) ? t * n : null);
  const stappen = m.stappen.map((s) => {
    const e = eenheden[s.eenheid] || eenheden.dossier;
    const uit = {};
    for (const soort of ['actief', 'wacht']) {
      const uitgevoerd = maal(s[soort], e.uitgevoerd);
      const verwacht = maal(s[soort], e.verwacht);
      uit[soort] = { uitgevoerd, verwacht, resterend: isGetal(uitgevoerd) && isGetal(verwacht) ? verwacht - uitgevoerd : null };
    }
    return { stap: s, eenheden: e, ...uit, schatting: (isGetal(s.actief) || isGetal(s.wacht)) && (!s.meetwijze || GESCHATTE_MEETWIJZEN.includes(s.meetwijze)) };
  });
  const totaalVan = (soort, deel) => {
    const waarden = stappen.map((r) => r[soort][deel]);
    const bekend = waarden.filter(isGetal);
    return { waarde: bekend.length === waarden.length ? som(waarden) : null, deelsom: bekend.length ? som(bekend) : null, nBekend: bekend.length, n: waarden.length };
  };
  const tijd = {};
  for (const soort of ['actief', 'wacht']) tijd[soort] = { uitgevoerd: totaalVan(soort, 'uitgevoerd'), resterend: totaalVan(soort, 'resterend'), verwacht: totaalVan(soort, 'verwacht') };
  tijd.totaleBelasting = isGetal(tijd.actief.verwacht.waarde) && isGetal(tijd.wacht.verwacht.waarde) ? tijd.actief.verwacht.waarde + tijd.wacht.verwacht.waarde : null;

  const waarschuwingen = [];
  if (dossiers.afwijking) waarschuwingen.push(`Er zijn ${dossiers.aantal} dossiers ingevoerd, terwijl er ${aangeleverd} diensttijdopgaven zijn aangeleverd. De berekeningen per diensttijdblok gebruiken alleen de ingevoerde dossiers.`);
  if (stappen.some((r) => isGetal(r.actief.resterend) && r.actief.resterend < 0)) waarschuwingen.push('Bij een of meer stappen is de reeds uitgevoerde tijd groter dan de verwachte tijd (negatieve resterende tijd). Controleer de aantallen.');
  return {
    meting: m, frequentie, dossiers, eenheden, stappen, tijd,
    schatting: stappen.some((r) => r.schatting),
    geschatteStappen: stappen.filter((r) => r.schatting).map((r) => r.stap.stapId),
    waarschuwingen,
  };
}

/** Bijv. "1 uur 3 min" (afgerond op hele minuten). */
function fmtUrenMinuten(minuten) {
  if (!isGetal(minuten)) return '';
  const teken = minuten < 0 ? '-' : '';
  const totaal = Math.round(Math.abs(minuten));
  const u = Math.floor(totaal / 60);
  const min = totaal % 60;
  return `${teken}${u ? `${u} uur ` : ''}${min} min`;
}
