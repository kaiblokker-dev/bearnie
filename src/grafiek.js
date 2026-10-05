// ---------- Grafiek: mediane actieve tijd en wachttijd per processtap ----------
//
// Eenvoudige gegroepeerde staafgrafiek op een canvas. De y-as begint altijd bij nul,
// ontbrekende waarden worden als 'Onbekend' getoond (geen staaf), en onder iedere
// stap staat het aantal waarnemingen. De achtergrond is altijd wit.

const GRAFIEK_BREEDTE = 1000;
const GRAFIEK_HOOGTE = 560;
const KLEUR_ACTIEF = '#2e7347';
const KLEUR_WACHT = '#d39a2c';

function mooieStap(max, doelAantal) {
  const ruw = max / doelAantal;
  const macht = Math.pow(10, Math.floor(Math.log10(ruw)));
  const f = ruw / macht;
  const mooi = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return mooi * macht;
}

function knipTekst(ctx, tekst, maxBreedte, maxRegels) {
  const woorden = String(tekst).split(/\s+/);
  const regels = [];
  let regel = '';
  for (const w of woorden) {
    const test = regel ? regel + ' ' + w : w;
    if (ctx.measureText(test).width <= maxBreedte) regel = test;
    else {
      if (regel) regels.push(regel);
      regel = w;
    }
  }
  if (regel) regels.push(regel);
  if (regels.length > maxRegels) {
    const r = regels.slice(0, maxRegels);
    let laatste = r[maxRegels - 1];
    while (laatste.length > 1 && ctx.measureText(laatste + '…').width > maxBreedte) laatste = laatste.slice(0, -1);
    r[maxRegels - 1] = laatste + '…';
    return r;
  }
  return regels.map((r) => {
    let t = r;
    while (t.length > 1 && ctx.measureText(t).width > maxBreedte) t = t.slice(0, -1);
    return t === r ? r : t + '…';
  });
}

/**
 * Tekent de grafiek. gegevens: { titel, ondertitels: [tekst], voetnoot, stappen: [{ stapId, naam, actief, wacht, nActief, nWacht }] }
 * schaal: pixelfactor (bijv. 3 voor een PNG met hoge resolutie).
 */
function tekenGrafiek(canvas, gegevens, schaal) {
  canvas.width = Math.round(GRAFIEK_BREEDTE * schaal);
  canvas.height = Math.round(GRAFIEK_HOOGTE * schaal);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(schaal, 0, 0, schaal, 0, 0);
  const W = GRAFIEK_BREEDTE;
  const H = GRAFIEK_HOOGTE;
  const lettertype = '"Segoe UI", Arial, sans-serif';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1f2a24';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `600 18px ${lettertype}`;
  ctx.fillText(gegevens.titel, 24, 32);
  ctx.font = `13px ${lettertype}`;
  ctx.fillStyle = '#4b5650';
  (gegevens.ondertitels || []).forEach((t, i) => ctx.fillText(t, 24, 54 + i * 18));

  // Legenda
  const legY = 54 + (gegevens.ondertitels || []).length * 18 + 8;
  ctx.font = `13px ${lettertype}`;
  ctx.fillStyle = KLEUR_ACTIEF;
  ctx.fillRect(24, legY - 10, 14, 14);
  ctx.fillStyle = '#1f2a24';
  ctx.fillText('Mediaan actieve tijd', 44, legY + 2);
  ctx.fillStyle = KLEUR_WACHT;
  ctx.fillRect(210, legY - 10, 14, 14);
  ctx.fillStyle = '#1f2a24';
  ctx.fillText('Mediaan wachttijd', 230, legY + 2);

  const links = 80;
  const rechts = W - 24;
  const boven = legY + 30;
  const onder = H - 110;
  const stappen = gegevens.stappen || [];

  const waarden = stappen.flatMap((s) => [s.actief, s.wacht]).filter(isGetal);
  if (!stappen.length || !waarden.length) {
    ctx.fillStyle = '#5a6660';
    ctx.font = `15px ${lettertype}`;
    ctx.textAlign = 'center';
    ctx.fillText('Er zijn nog geen bekende waarden om weer te geven.', W / 2, (boven + onder) / 2);
    tekenVoetnoot(ctx, gegevens.voetnoot, W, H, lettertype);
    return;
  }

  const max = Math.max(...waarden);
  const stapGrootte = max > 0 ? mooieStap(max, 5) : 1;
  const asMax = max > 0 ? Math.ceil(max / stapGrootte) * stapGrootte : 1;
  const y = (v) => onder - (v / asMax) * (onder - boven);

  // Rasterlijnen en y-as (begint altijd bij 0)
  ctx.font = `12px ${lettertype}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const decimalen = stapGrootte < 1 ? 2 : stapGrootte % 1 ? 1 : 0;
  for (let v = 0; v <= asMax + 1e-9; v += stapGrootte) {
    const yy = Math.round(y(v)) + 0.5;
    ctx.strokeStyle = v === 0 ? '#5a6660' : '#e3e8e5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(links, yy);
    ctx.lineTo(rechts, yy);
    ctx.stroke();
    ctx.fillStyle = '#4b5650';
    ctx.fillText(fmtGetal(v, decimalen), links - 8, yy);
  }
  ctx.save();
  ctx.translate(22, (boven + onder) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1f2a24';
  ctx.font = `13px ${lettertype}`;
  ctx.fillText(gegevens.asLabel || 'Minuten per uitvoering', 0, 0);
  ctx.restore();

  // Staven
  const groepBreedte = (rechts - links) / stappen.length;
  const staafBreedte = Math.min(46, groepBreedte * 0.32);
  stappen.forEach((s, i) => {
    const midden = links + groepBreedte * (i + 0.5);
    const posities = [
      { v: s.actief, x: midden - staafBreedte - 2, kleur: KLEUR_ACTIEF },
      { v: s.wacht, x: midden + 2, kleur: KLEUR_WACHT },
    ];
    for (const p of posities) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      if (isGetal(p.v)) {
        const top = y(p.v);
        ctx.fillStyle = p.kleur;
        ctx.fillRect(p.x, top, staafBreedte, onder - top);
        ctx.fillStyle = '#1f2a24';
        ctx.font = `12px ${lettertype}`;
        ctx.fillText(fmtGetal(p.v, 2), p.x + staafBreedte / 2, top - 3);
      } else {
        ctx.fillStyle = '#7a8580';
        ctx.font = `italic 11px ${lettertype}`;
        ctx.fillText(ONBEKEND, p.x + staafBreedte / 2, onder - 3);
      }
    }
    // Labels onder de staven
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1f2a24';
    ctx.font = `600 12px ${lettertype}`;
    ctx.fillText(s.stapId, midden, onder + 8);
    ctx.font = `12px ${lettertype}`;
    const regels = knipTekst(ctx, s.naam || '', groepBreedte - 8, 2);
    regels.forEach((r, ri) => ctx.fillText(r, midden, onder + 24 + ri * 15));
    ctx.fillStyle = '#4b5650';
    ctx.font = `11px ${lettertype}`;
    const nTekst = s.nActief === s.nWacht ? `n = ${s.nActief}` : `n = ${s.nActief} (actief) / ${s.nWacht} (wacht)`;
    ctx.fillText(nTekst, midden, onder + 24 + regels.length * 15 + 2);
  });

  tekenVoetnoot(ctx, gegevens.voetnoot, W, H, lettertype);
}

function tekenVoetnoot(ctx, tekst, W, H, lettertype) {
  if (!tekst) return;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#6b7570';
  ctx.font = `11px ${lettertype}`;
  ctx.fillText(tekst, 24, H - 10);
}

function grafiekNaarPng(gegevens, bestandsnaam) {
  const canvas = document.createElement('canvas');
  tekenGrafiek(canvas, gegevens, 3);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, bestandsnaam);
    else toonMelding('De afbeelding kon niet worden gemaakt.', true);
  }, 'image/png');
}
