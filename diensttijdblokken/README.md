# Diensttijdblokken ABP → Visma

Zelfstandige browsertool die uit geanonimiseerde ABP-perioderegels het **verwacht aantal Visma-regels/diensttijdblokken** berekent.

**Gebruik:** dubbelklik op [`index.html`](index.html). Er is geen installatie, server of internet nodig. Alles (HTML, CSS, JavaScript) staat in dit ene bestand. Een Content-Security-Policy blokkeert netwerkverkeer. Gegevens worden alleen in de browser opgeslagen (localStorage).

## Berekeningslogica (in `index.html`, sectie 3 ‘BEREKENING’)

| Functie | Doel |
|---|---|
| `TELREGELS` / `telregelTeksten()` | Centrale instellingen en beschrijving van de telregels |
| `parseDatum()` | `dd-mm-jjjj` → dagnummer; weigert onbestaande of onduidelijke datums |
| `abpEindNaarVisma()` | ABP-einddatum (exclusief) → Visma-einddatum (t/m) = één dag eerder |
| `valideerRegel()` | Fouten per regel: ontbrekende vereniging, ongeldige datum, einde vóór begin |
| `vormBlokken()` | Per vereniging sorteren; overlap → samenvoegen; aansluitend → samenvoegen (AV-instelling); onderbreking → nieuw blok |
| `pasCorrectiesToe()` | Handmatige correcties (aanpassen, splitsen, samenvoegen, uitsluiten) in volgorde toepassen |
| `bereken()` | Hoofdfunctie: tellingen, waarschuwingen en berekeningslogboek |
| `voerTestsUit()` | Automatische tests, getoond onderaan de pagina |

Handmatige correcties verwijzen naar blokken via de interne ID's van hun bronregels. Ze blijven daardoor geldig als regels worden hernummerd. Een correctie die niet meer past (bijvoorbeeld omdat een bronregel is gewijzigd), wordt als waarschuwing gemeld.

## Testen

Bij het openen worden de tests automatisch uitgevoerd. Het resultaat staat onder ‘Automatische tests’, met per test ‘geslaagd’ of ‘mislukt’. Met de knop *Tests opnieuw uitvoeren* draait u ze opnieuw.
