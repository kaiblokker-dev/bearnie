// ---------- Excel-export (.xlsx) zonder externe bibliotheek ----------
//
// Een .xlsx-bestand is een ZIP-archief met XML-bestanden (Office Open XML).
// Deze module schrijft een minimale, geldige werkmap: tekstcellen (inline),
// getalcellen met volledige precisie en een weergaveformaat met twee decimalen.

const CRC_TABEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABEL[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Maakt een ZIP-archief (methode 'stored', zonder compressie). bestanden: [{ naam, inhoud: string }] */
function maakZip(bestanden) {
  const enc = new TextEncoder();
  const nu = new Date();
  const dosTijd = (nu.getHours() << 11) | (nu.getMinutes() << 5) | (Math.floor(nu.getSeconds() / 2));
  const dosDatum = ((nu.getFullYear() - 1980) << 9) | ((nu.getMonth() + 1) << 5) | nu.getDate();
  const delen = [];
  const centraal = [];
  let positie = 0;
  for (const b of bestanden) {
    const naam = enc.encode(b.naam);
    const data = enc.encode(b.inhoud);
    const crc = crc32(data);
    const lokaal = new DataView(new ArrayBuffer(30));
    lokaal.setUint32(0, 0x04034b50, true);
    lokaal.setUint16(4, 20, true);
    lokaal.setUint16(6, 0x0800, true); // UTF-8 bestandsnamen
    lokaal.setUint16(8, 0, true);
    lokaal.setUint16(10, dosTijd, true);
    lokaal.setUint16(12, dosDatum, true);
    lokaal.setUint32(14, crc, true);
    lokaal.setUint32(18, data.length, true);
    lokaal.setUint32(22, data.length, true);
    lokaal.setUint16(26, naam.length, true);
    lokaal.setUint16(28, 0, true);
    delen.push(new Uint8Array(lokaal.buffer), naam, data);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, dosTijd, true);
    c.setUint16(14, dosDatum, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, naam.length, true);
    c.setUint32(42, positie, true);
    centraal.push(new Uint8Array(c.buffer), naam);
    positie += 30 + naam.length + data.length;
  }
  const centraalGrootte = centraal.reduce((s, d) => s + d.length, 0);
  const eind = new DataView(new ArrayBuffer(22));
  eind.setUint32(0, 0x06054b50, true);
  eind.setUint16(8, bestanden.length, true);
  eind.setUint16(10, bestanden.length, true);
  eind.setUint32(12, centraalGrootte, true);
  eind.setUint32(16, positie, true);
  return new Blob([...delen, ...centraal, new Uint8Array(eind.buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function xmlEsc(t) {
  return String(t)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kolomLetter(i) {
  let s = '';
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

// Stijlindexen (zie stijlenXml): 0 standaard, 1 kop, 2 getal 0,00, 3 titel, 4 waarschuwing, 5 tekst met terugloop
const XLSX_STIJL = { standaard: 0, kop: 1, getal: 2, titel: 3, waarschuwing: 4, terugloop: 5 };

function stijlenXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="13"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF9C2A00"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDDF0E2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/**
 * Cel: string | number | null | { v, s } waarbij s een sleutel van XLSX_STIJL is.
 * Getallen worden onafgerond opgeslagen; het weergaveformaat toont twee decimalen.
 */
function celXml(cel, ref) {
  if (cel === null || cel === undefined || cel === '') return '';
  let waarde = cel;
  let stijl = null;
  if (typeof cel === 'object') { waarde = cel.v; stijl = cel.s; }
  if (waarde === null || waarde === undefined || waarde === '') {
    return stijl ? `<c r="${ref}" s="${XLSX_STIJL[stijl]}"/>` : '';
  }
  if (typeof waarde === 'number' && Number.isFinite(waarde)) {
    const s = XLSX_STIJL[stijl || 'getal'];
    return `<c r="${ref}" s="${s}"><v>${waarde}</v></c>`;
  }
  const s = stijl ? ` s="${XLSX_STIJL[stijl]}"` : '';
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlEsc(waarde)}</t></is></c>`;
}

function werkbladXml(blad) {
  const rijen = blad.rijen.map((rij, ri) => {
    const cellen = rij.map((cel, ci) => celXml(cel, kolomLetter(ci) + (ri + 1))).join('');
    return `<row r="${ri + 1}">${cellen}</row>`;
  }).join('');
  const breedtes = (blad.kolombreedtes || [])
    .map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`).join('');
  const vastzetten = blad.kopRij
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${blad.kopRij}" topLeftCell="A${blad.kopRij + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${vastzetten}${breedtes ? '<cols>' + breedtes + '</cols>' : ''}<sheetData>${rijen}</sheetData></worksheet>`;
}

/** bladen: [{ naam, rijen: [[cel]], kolombreedtes?: [getal], kopRij?: rijnummer om vast te zetten }] */
function maakXlsx(bladen) {
  const bestanden = [];
  bestanden.push({
    naam: '[Content_Types].xml',
    inhoud: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
${bladen.map((b, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`,
  });
  bestanden.push({
    naam: '_rels/.rels',
    inhoud: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  });
  const nu = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  bestanden.push({
    naam: 'docProps/core.xml',
    inhoud: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Meettool administratieve processen – export</dc:title>
<dc:creator>Meettool ${xmlEsc(VERSIE)}</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${nu}</dcterms:created>
</cp:coreProperties>`,
  });
  bestanden.push({
    naam: 'docProps/app.xml',
    inhoud: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Meettool ${xmlEsc(VERSIE)}</Application></Properties>`,
  });
  bestanden.push({
    naam: 'xl/workbook.xml',
    inhoud: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${bladen.map((b, i) => `<sheet name="${xmlEsc(b.naam.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`,
  });
  bestanden.push({
    naam: 'xl/_rels/workbook.xml.rels',
    inhoud: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${bladen.map((b, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${bladen.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  });
  bestanden.push({ naam: 'xl/styles.xml', inhoud: stijlenXml() });
  bladen.forEach((b, i) => bestanden.push({ naam: `xl/worksheets/sheet${i + 1}.xml`, inhoud: werkbladXml(b) }));
  return maakZip(bestanden);
}
