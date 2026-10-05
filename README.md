# Meettool administratieve processen

Lokale meettool voor het registreren en analyseren van actieve verwerkingstijd, wachttijd, omvang en frequentie van handmatige administratieve processen.

**Gebruik:** dubbelklik op [`Meettool.html`](Meettool.html). Het bestand opent in de standaardbrowser (Edge of Chrome aanbevolen). U hoeft niets te installeren en er is geen internet nodig.

- Eén zelfstandig bestand: alle JavaScript en CSS staan erin. Er zijn geen CDN-verwijzingen of externe bibliotheken.
- Een Content-Security-Policy (`connect-src 'none'`) blokkeert iedere netwerkverbinding. Er gaan geen gegevens naar externe diensten.
- De gegevens worden lokaal in de browser opgeslagen (IndexedDB) en na iedere wijziging automatisch bewaard.

## Gebouwde functies

| Onderdeel | Functies |
|---|---|
| 1. Processen beheren | Processen (ProcesID, naam, uitvoeringseenheid en omvangseenheid, elk in enkelvoud en meervoud) en processtappen (StapID, volgorde, naam) toevoegen, aanpassen en verwijderen. StapID's worden voorgesteld als `PR24-S01`. Elk proces heeft minimaal één stap. CSV-import en -export (`ProcesID;Procesnaam;Uitvoeringseenheid;Uitvoeringseenheid meervoud;Omvangseenheid;Omvangseenheid meervoud;StapID;Volgorde;Processtap`). |
| 2. Nieuwe procesmeting | Een kort formulier met automatisch MetingID (`M-PR24-001`), datum (standaard vandaag), proces, anonieme MedewerkerID, casustype, aantal uitvoeringen (verplicht, bijv. *Aantal dossiers*), omvang (bijv. *aantal dienstperioden*, mag leeg) en meetwijze. De labels volgen de eenheden van het proces; de eenheden worden bij de meting vastgelegd. Na het kiezen van een proces worden de stappen automatisch geladen. Per stap vult u actieve tijd, wachttijd, reden wachttijd (verschijnt alleen bij wachttijd > 0) en een opmerking in. Een decimale komma en punt worden allebei geaccepteerd. Er is een optionele timer per stap (Start, Start wachttijd, Hervat actieve tijd, Afronden, Reset). Die vult de velden pas bij Afronden, zodat u ze kunt controleren en aanpassen. Tijdens het invullen staat er een live berekening (totaal, per uitvoeringseenheid en per omvangseenheid) onder het formulier. |
| 3. Frequentie registreren | FrequentieID (`F-PR24-001`), proces, meetperiode, aantal uitvoeringen (bijv. dossiers), totale omvang (bijv. dienstperioden; mag onbekend blijven), meetwijze (Geteld / Uit systeemgegevens / Geschat door medewerker) en bron. |
| 4. Metingen bekijken | Aparte weergaven voor procesmetingen, stapmetingen en frequentiemetingen. U kunt zoeken en filteren op proces, datum, medewerker, casustype en meetwijze. Metingen kunt u openen, aanpassen en verwijderen (na bevestiging). Per procesmeting zijn de bijbehorende stapmetingen uit te klappen. Berekende kolommen hebben een blauwgrijze achtergrond en zijn zo te onderscheiden van de ruwe invoer. |
| 5. Resultaten | Dashboard per proces met: aantal normale metingen en uitzonderingen, mediane actieve tijd per uitvoeringseenheid (primair, bijv. per dossier) en per omvangseenheid (aanvullend, bijv. per dienstperiode), mediane wachttijd per uitvoeringseenheid en geschatte tijdsbelasting per meetperiode. Verder een samenvattingstabel (Normaal en Uitzondering apart), resultaten per processtap en een staafgrafiek. De grafiek is als PNG te downloaden (3000×1680 px, witte achtergrond). U kunt filteren op meetwijze, medewerker (alle medewerkers of één MedewerkerID) en datum. De tabel *Resultaten per medewerker* toont per MedewerkerID het aantal metingen, de gemiddelde, minimale en maximale actieve tijd, de gemiddelde wachttijd en de gemiddelde omvang per uitvoering, elk met het aantal gebruikte metingen (n). Daaronder staat een gecombineerde rij voor alle medewerkers, met de bandbreedte. Per medewerker zijn de individuele metingen op te vragen. De knop *Onderliggende metingen bekijken* laat zien welke metingen zijn gebruikt en welke niet. |
| 6. Importeren en exporteren | Excel-export (.xlsx) met de tabbladen Resultaten, Per medewerker (samenvatting per medewerker en alle individuele metingen met berekende waarden), Procesmetingen, Stapmetingen, Frequentie en Methode. CSV-export van de drie ruwe tabellen. JSON-back-up downloaden en importeren, met de keuze *Samenvoegen*, *Huidige gegevens vervangen* of *Import annuleren*. Alle gegevens wissen (dubbele bevestiging: eerst bevestigen, dan `WISSEN` typen). Demogegevens laden en verwijderen. |

### Herleidbaarheid en datakwaliteit

- **Ruwe invoer en berekeningen zijn gescheiden.** De opgeslagen gegevens bevatten alleen invoer en automatisch vastgelegde identificatievelden. Alle uitkomsten worden telkens opnieuw uit de ruwe metingen berekend en nooit opgeslagen.
- **Ontbrekende waarden worden nooit als 0 behandeld.** Een leeg veld wordt opgeslagen als `null` en getoond als `Onbekend`. Ontbreekt bij een meting één stapwaarde, dan is de totale tijd van die meting Onbekend. Die meting telt dan niet mee in de statistiek, en dat is zichtbaar bij *Onderliggende metingen bekijken* en in de Excel-export.
- **Twee eenheden per proces:** de *uitvoeringseenheid* zegt wat één uitvoering is (bij PR24: één dossier); de *omvangseenheid* zegt waarin de omvang wordt uitgedrukt (bij PR24: relevante dienstperioden). Iedere meting toont het aantal van beide.
- **Controles:** het aantal uitvoeringen is verplicht en groter dan 0; omvang moet groter zijn dan 0 (of leeg blijven); tijden mogen niet negatief zijn; bij wachttijd > 0 is een reden verplicht; een meting moet een proces, datum, casustype en meetwijze hebben; MetingID's moeten uniek zijn.
- **Dubbelzinnige getallen worden geweigerd.** Bij invoer als `1.450` (decimaalpunt of duizendtal?) vraagt de tool om verduidelijking.
- **Verwijderde processen maken metingen niet onleesbaar.** Iedere meting bewaart de proces- en stapnamen van het moment van meten. ProcesID en StapID zijn na het aanmaken niet meer te wijzigen.
- **Meetwijzen worden niet ongemerkt gemengd.** De resultaten zijn te filteren op gemeten, geschat of systeemgegeven. Bij *alle meetwijzen* toont het dashboard een waarschuwing met de verdeling. Schattingen blijven overal herkenbaar als schatting.
- **Weinig metingen:** bij minder dan drie metingen verschijnt de melding *"Er zijn nog weinig metingen beschikbaar. Interpreteer de uitkomsten voorzichtig."* Er is geen betrouwbaarheidsscore.
- **Herkomst van tijden:** iedere stapmeting legt vast of de tijd met de hand is ingevoerd, met de timer is gemeten, of met de timer is gemeten en daarna met de hand is aangepast (*Tijdvastlegging*).
- **Demogegevens:** ProcesID's beginnen met `DEMO-` en de gegevens zijn overal gemarkeerd. Ze worden nooit automatisch geladen. Een export met demogegevens vraagt eerst om bevestiging en krijgt `MET-DEMOGEGEVENS` in de bestandsnaam en een waarschuwing in de inhoud.

## Berekeningsregels

**Per medewerker:** iedere waarde wordt eerst per individuele procesmeting berekend. Het gecombineerde resultaat voor alle medewerkers komt rechtstreeks uit alle individuele metingen, niet uit de gemiddelden per medewerker. Voorbeeld: PZ01 heeft één meting van 22 minuten en PZ02 één van 17 minuten. Het gecombineerde gemiddelde is dan 19,5 minuten (n = 2), met een bandbreedte van 17 tot 22 minuten. De omvang per uitvoering is de omvang gedeeld door het aantal uitvoeringen (bijvoorbeeld dienstperioden per dossier). MedewerkerID's zijn anonieme codes zoals PZ01. Bij een code die op een naam lijkt, waarschuwt de tool (zonder te blokkeren).

Per procesmeting:

- Totale actieve tijd = som van de actieve tijd van alle processtappen. Deze is Onbekend als een stapwaarde ontbreekt.
- Totale wachttijd = som van de wachttijd van alle processtappen. Ook deze is Onbekend als een stapwaarde ontbreekt.
- **Actieve tijd per uitvoering (primaire uitkomst)** = totale actieve tijd / aantal uitvoeringen (bij PR24: minuten per dossier). Onbekend als het aantal ontbreekt.
- Wachttijd per uitvoering = totale wachttijd / aantal uitvoeringen.
- **Actieve tijd per omvangseenheid (aanvullende uitkomst)** = totale actieve tijd / omvang (bij PR24: minuten per dienstperiode). Onbekend als de omvang ontbreekt.
- Wachttijd per omvangseenheid = totale wachttijd / omvang.
- Per processtap: stapwaarde / aantal uitvoeringen van de meting (dus per dossier).

Per proces, apart voor Normaal en Uitzondering: het aantal metingen en n (het aantal metingen met een bekende waarde), het totale aantal uitvoeringen, plus mediaan, gemiddelde, minimum en maximum van de actieve tijd per uitvoering (primair). Daarnaast mediaan en gemiddelde van de wachttijd per uitvoering, en mediaan, gemiddelde, minimum en maximum van de actieve tijd per omvangseenheid (aanvullend).

Per processtap: het aantal waarnemingen, mediaan, gemiddelde, minimum en maximum van de actieve tijd, mediaan en gemiddelde van de wachttijd, en het percentage metingen met wachttijd (wachttijd > 0 gedeeld door het aantal stapmetingen met een bekende wachttijd).

- **Mediaan:** de middelste waarde. Bij een even aantal waarden is het het gemiddelde van de twee middelste.
- **Geschatte actieve tijd per meetperiode** = aantal uitvoeringen in de meetperiode × mediaan actieve tijd per uitvoering van de *normale* gevallen (bij PR24: aantal dossiers × mediane minuten per dossier). De totale omvang in de meetperiode (dienstperioden) wordt hierbij niet gebruikt en mag onbekend zijn. Het aantal uitvoeringen komt uit de gekozen frequentiemeting; standaard is dat de meest recente. Het dashboard toont de gebruikte frequentiemeting, de meetwijze daarvan, de mediaan en de MetingID's. Ontbreekt er invoer, dan wordt niets berekend en ziet u wat er ontbreekt.
- **Afronding:** er wordt intern met volledige precisie gerekend, met gecompenseerde sommatie tegen afrondingsfouten. Alleen de weergave wordt afgerond, standaard op twee decimalen. Excel-cellen bevatten onafgeronde getallen met een weergaveformaat van twee decimalen. De timer legt tijden vast tot op 0,01 minuut.

## Hoe de offline werking is getest

`tests/acceptatietest.js` (Playwright + Chromium) opent `Meettool.html` via `file://`, met de browser vanaf het begin **offline** (`context.setOffline(true)`). Elk netwerkverzoek wordt geregistreerd. De test doorloopt de acceptatiestappen:

1. Proces met drie stappen; een proces zonder stap wordt geweigerd.
2. Twee normale metingen en één uitzondering, plus een meting met lege velden: die worden opgeslagen als `null` en niet als 0.
3. Handmatige invoer met een decimale komma en punt (`10,5` en `3.25`).
4. Timer: Start, wachttijd, hervatten, afronden en reset. Daarna worden de waarden gecontroleerd en aangepast.
5. Wachttijd met reden; wachttijd zonder reden wordt geweigerd.
6. en 7. Totale actieve tijd (5 + 10,5 + 3,25 = 18,75), per dossier (18,75 / 1; 16 / 2 = 8) en per dienstperiode (18,75 / 10 = 1,875), met de hand nagerekend.
8. Mediaan per dossier (18,75 + 8)/2 = 13,375, gemiddelde, minimum en maximum; mediaan per dienstperiode 2,9375; het meetwijzefilter en de statistiek per stap (per dossier).
9. en 10. Frequentiemeting (120 dossiers, aantal dienstperioden onbekend); tijdsbelasting 120 × 13,375 = 1605 min.
11. De Excel-export is geopend met `openpyxl`: alle vijf tabbladen, de aantallen, de uitkomsten in Resultaten, het Methode-tabblad, en geen berekeningen in de ruwe tabbladen.
12. De PNG is 3000×1680 px met een witte achtergrond.
13. tot en met 15. JSON-back-up downloaden, alles wissen (ook na herladen leeg), importeren via Samenvoegen. De gegevens zijn daarna exact gelijk aan het origineel. Een bestand met een dubbel MetingID wordt geweigerd.
16. Over de hele test: **0 netwerkverzoeken en 0 JavaScript-fouten**. Het bestand bevat geen externe `src`/`href`. Na herladen via `file://` blijven de gegevens behouden (IndexedDB).

Daarnaast worden getest: demogegevens laden en verwijderen (met de exportwaarschuwing), en het verwijderen van een proces terwijl de metingen leesbaar blijven.

Test uitvoeren (alleen nodig voor ontwikkeling):

```
node build.js
NODE_PATH=$(npm root -g) node tests/acceptatietest.js   # vereist playwright en python3 met openpyxl en pillow
```

## Overgang van versie 1.0 naar 1.1

- Versie 1.0 kende één eenheid per proces. Bij het openen of importeren wordt die eenheid de **omvangseenheid**; alleen de veldnaam verandert, de waarde niet. Vul bij *Processen beheren* de uitvoeringseenheid aan (bijv. PR24: dossier / dossiers en dienstperiode / dienstperioden).
- In versie 1.0 gold één procesmeting als één uitvoering, maar het aantal werd niet opgeslagen. Voor deze metingen blijft het aantal uitvoeringen leeg en is de tijd per uitvoering *Onbekend*. Dat wordt nooit automatisch ingevuld. Onder *Metingen bekijken* en *Resultaten* staat een melding met de knop *Aantal uitvoeringen aanvullen…*. Daarmee legt u na bevestiging voor deze metingen 1 vast. Per meting wordt dan in *Herkomst aantal uitvoeringen* opgeslagen dat het aantal is aangevuld, en wanneer. U kunt ook iedere meting afzonderlijk aanpassen.
- Een per-meting aanpasbare eenheid bestaat niet meer: de eenheden komen van het proces en worden bij iedere meting vastgelegd.

## Beperkingen

- **Stap 17 (Windows, dubbelklikken) is niet op een Windows-machine getest.** De ontwikkelomgeving is Linux. Getest is het openen via `file://` in Chromium, de engine van Edge en Chrome, zonder server, Node of npm. Controleer dit zelf één keer op uw laptop.
- **De gegevens horen bij één browser op één apparaat.** Edge en Chrome zien elk hun eigen gegevens. Ook het wissen van browsergegevens of een opschoonprogramma kan de metingen verwijderen. **Maak daarom regelmatig een JSON-back-up.** Als IndexedDB niet beschikbaar is, gebruikt de tool `localStorage`. Is er helemaal geen opslag, dan meldt de tool dat in de kopregel.
- Alleen getest in Chromium (Edge/Chrome). Firefox is niet getest; gebruik bij voorkeur Edge of Chrome.
- De timer loopt alleen zolang het tabblad open is. Bij sluiten met een lopende timer (of een nog niet afgeronde opslag) waarschuwt de browser.
- De weergave van datumvelden volgt de taalinstelling van de browser (op een Nederlandse Windows dd-mm-jjjj).
- Excel opent CSV-bestanden met puntkomma's en decimale komma's correct bij Nederlandse landinstellingen. Bij Engelse instellingen kunt u beter de .xlsx-export gebruiken.
- Bij samenvoegen worden bestaande records nooit overschreven. Records met dezelfde ID maar een andere inhoud worden gemeld en overgeslagen.

## Ontwikkeling

De broncode staat in `src/`; `node build.js` voegt alles samen tot `Meettool.html`. Het versienummer staat in `src/versie.js` en bovenaan het gebouwde bestand.
