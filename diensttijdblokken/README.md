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

## Plakken en importeren

Het plakveld herkent automatisch twee vormen:

1. **Tekst uit een ABP-diensttijdoverzicht** (sectie 4b ‘ABP-TEKSTPARSER’). Een state machine leest de tekst regel voor regel:
   - Een regel `ArbeidsVerhouding …` of `WerkloosheidsVerhouding …` wordt de actieve verhouding. De eerste datum is het begin, de tweede het einde (optioneel) en de tekst na de laatste datum de vereniging. Het AV-ID (AV1, AV2, …) wordt automatisch toegekend.
   - Een regel als `07-10-2004 tot 09-10-2004 1.25 100 %` wordt een perioderegel bij de actieve verhouding. Een regel als `… 0 %` heeft geen deeltijdfactor. Bij `01-01-2026 tot 0.8 100 %` is de periode open.
   - Kopregels, paginanummers, ABP/APG-voetteksten en regels over het handelsregister of de KvK worden genegeerd. Ze komen in het importlogboek met de reden ‘Niet herkend als relevante gegevensregel’.
   - Een regel die met een datum begint maar niet volledig te lezen is, krijgt de status ‘Waarschuwing’. Zo'n regel wordt pas geïmporteerd nadat u hem handmatig hebt gecorrigeerd en aangevinkt.
2. **Tabgescheiden tabel** (`parsePlaktekst`), zoals voorheen.

| Functie | Doel |
|---|---|
| `isAbpTekst()` | Bepaalt of de tekst een ABP-overzicht is |
| `normaliseerAbpRegel()` | Zet harde spaties en meervoudige spaties om naar één spatie |
| `zoekAbpDatums()` | Strikte datumherkenning `dd-mm-jjjj` |
| `classificeerAbpRegel()` | Bepaalt het type: verhouding, perioderegel, negeren of onbekend |
| `parseAbpVerhoudingsregel()` | Leest de ArbeidsVerhouding-/WerkloosheidsVerhouding-regel |
| `parseAbpPerioderegel()` | Leest een perioderegel (normaal, zonder deeltijdfactor of open) |
| `controleerAbpImportrij()` | Bepaalt status en importkeuze, ook na handmatige aanpassing |
| `parseAbpTekst()` | State machine; levert de importrijen en het importlogboek |

Met de knop *Voorbeeldtekst invullen* vult u de aangeleverde voorbeeldtekst in. Die geeft 65 perioderegels en 10 verwachte Visma-regels.

Handmatige correcties verwijzen naar blokken via de interne ID's van hun bronregels. Ze blijven daardoor geldig als regels worden hernummerd. Een correctie die niet meer past (bijvoorbeeld omdat een bronregel is gewijzigd), wordt als waarschuwing gemeld.

## Testen

Bij het openen worden de tests automatisch uitgevoerd. Het resultaat staat onder ‘Automatische tests’, met per test ‘geslaagd’ of ‘mislukt’. Met de knop *Tests opnieuw uitvoeren* draait u ze opnieuw.
