# Meettool administratieve processen

> **Nieuw: vereenvoudigde PR24-tool.** Alleen voor het verwerken van diensttijdopgaven in Visma (PR24) is er een aparte, eenvoudige tool: [`meettool-pr24-eenvoudig.html`](meettool-pr24-eenvoudig.html). Zie [Vereenvoudigde PR24-tool](#vereenvoudigde-pr24-tool). De brede meettool hieronder blijft ongewijzigd als back-up bestaan.

Lokale meettool voor het registreren en analyseren van actieve verwerkingstijd, wachttijd, omvang en frequentie van handmatige administratieve processen.

**Gebruik:** dubbelklik op [`Meettool.html`](Meettool.html). Het bestand opent in de standaardbrowser (Edge of Chrome aanbevolen). U hoeft niets te installeren en er is geen internet nodig.

- Eén zelfstandig bestand: alle JavaScript en CSS staan erin. Er zijn geen CDN-verwijzingen of externe bibliotheken.
- Een Content-Security-Policy (`connect-src 'none'`) blokkeert iedere netwerkverbinding. Er gaan geen gegevens naar externe diensten.
- De gegevens worden lokaal in de browser opgeslagen (IndexedDB) en na iedere wijziging automatisch bewaard.

## Gebouwde functies

| Onderdeel | Functies |
|---|---|
| 1. Maanddashboard PR24 | Selectie van proces (PR24), bestuur (LEV of SAMANAS), kalendermaand en -jaar; iedere combinatie is één maandmeting (bijv. *PR24 – LEV – augustus 2026*). Eén dynamisch dashboard met frequentie, documentvolume en complexiteit, tijd en een stappentabel, plus invoer van maandgegevens, geanonimiseerde dossiers en tijden per processtap. Knoppen voor nieuwe maandmeting, opslaan, verwijderen (met bevestiging), exporteren en importeren. |
| 2. Processen beheren | Processen (ProcesID, naam, uitvoeringseenheid en omvangseenheid, elk in enkelvoud en meervoud) en processtappen (StapID, volgorde, naam) toevoegen, aanpassen en verwijderen. StapID's worden voorgesteld als `PR24-S01`. Elk proces heeft minimaal één stap. CSV-import en -export (`ProcesID;Procesnaam;Uitvoeringseenheid;Uitvoeringseenheid meervoud;Omvangseenheid;Omvangseenheid meervoud;StapID;Volgorde;Processtap`). |
| 3. Steekproeven | Steekproeven vastleggen (automatisch SteekproefID `SP-PR24-001`, proces, naam, omschrijving en grootte van de populatie, beoogde steekproefgrootte, selectiemethode, in- en exclusiecriteria, start- en einddatum, toelichting, status). Bestaande procesmetingen koppelen via *Metingen koppelen*, met volgnummer en geanonimiseerd dossier-ID. Per steekproef de voortgang en de steekproefresultaten, met de geschatte tijdsbelasting van de populatie. |
| 4. Nieuwe procesmeting | Een kort formulier met automatisch MetingID (`M-PR24-001`), datum (standaard vandaag), proces, anonieme MedewerkerID, casustype, aantal uitvoeringen (verplicht, bijv. *Aantal dossiers*), omvang (bijv. *aantal dienstperioden*, mag leeg) en meetwijze. De labels volgen de eenheden van het proces; de eenheden worden bij de meting vastgelegd. Na het kiezen van een proces worden de stappen automatisch geladen. Per stap vult u actieve tijd, wachttijd, reden wachttijd (verschijnt alleen bij wachttijd > 0) en een opmerking in. Een decimale komma en punt worden allebei geaccepteerd. Er is een optionele timer per stap (Start, Start wachttijd, Hervat actieve tijd, Afronden, Reset). Die vult de velden pas bij Afronden, zodat u ze kunt controleren en aanpassen. Tijdens het invullen staat er een live berekening (totaal, per uitvoeringseenheid en per omvangseenheid) onder het formulier. |
| 5. Frequentie registreren | FrequentieID (`F-PR24-001`), proces, MedewerkerID (optioneel), meetperiode, periode (per dag/week/maand/kwartaal/jaar), bereik (eigen werkzaamheden, team, gehele afdeling, anders), afbakening/toelichting, *Meetellen in totaal*, aantal uitvoeringen (bijv. dossiers), totale omvang (bijv. dienstperioden; mag onbekend blijven), meetwijze (Geteld / Uit systeemgegevens / Geschat door medewerker) en bron. |
| 6. Metingen bekijken | Aparte weergaven voor procesmetingen, stapmetingen en frequentiemetingen. U kunt zoeken en filteren op proces, datum, medewerker, casustype en meetwijze. Metingen kunt u openen, aanpassen en verwijderen (na bevestiging). Per procesmeting zijn de bijbehorende stapmetingen uit te klappen. Berekende kolommen hebben een blauwgrijze achtergrond en zijn zo te onderscheiden van de ruwe invoer. |
| 7. Resultaten | Dashboard per proces met: aantal normale metingen en uitzonderingen, mediane actieve tijd per uitvoeringseenheid (primair, bijv. per dossier) en per omvangseenheid (aanvullend, bijv. per dienstperiode), mediane wachttijd per uitvoeringseenheid en geschatte tijdsbelasting per meetperiode. Verder een samenvattingstabel (Normaal en Uitzondering apart), resultaten per processtap en een staafgrafiek. De grafiek is als PNG te downloaden (3000×1680 px, witte achtergrond). U kunt filteren op meetwijze, medewerker (alle medewerkers of één MedewerkerID) en datum. De tabel *Resultaten per medewerker* toont per MedewerkerID het aantal metingen, de gemiddelde, minimale en maximale actieve tijd, de gemiddelde wachttijd en de gemiddelde omvang per uitvoering, elk met het aantal gebruikte metingen (n). Daaronder staat een gecombineerde rij voor alle medewerkers, met de bandbreedte. Per medewerker zijn de individuele metingen op te vragen. De knop *Onderliggende metingen bekijken* laat zien welke metingen zijn gebruikt en welke niet. |
| 8. Importeren en exporteren | Excel-export (.xlsx) met de tabbladen Resultaten, Totaaloverzicht (totale frequentie en geschatte actieve tijdsbelasting per proces en periode), Per medewerker (samenvatting per medewerker en alle individuele metingen met berekende waarden), Knelpuntenanalyse, Steekproefresultaten, Steekproeven, Procesmetingen, Stapmetingen, Knelpunten, Frequentie en Methode. CSV-export van de ruwe tabellen, de knelpunten en de steekproeven. JSON-back-up downloaden en importeren, met de keuze *Samenvoegen*, *Huidige gegevens vervangen* of *Import annuleren*. Alle gegevens wissen (dubbele bevestiging: eerst bevestigen, dan `WISSEN` typen). Demogegevens laden en verwijderen. |

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

**Totaaloverzicht:** de totale frequentie is de som van de frequentiemetingen van hetzelfde proces met *Meetellen in totaal* = Ja en dezelfde periode. Perioden worden niet omgerekend. Twee of meer frequenties worden alleen automatisch opgeteld als ze allemaal *Eigen werkzaamheden* van verschillende medewerkers zijn. Bij een schatting voor de gehele afdeling, een team of ander bereik, dezelfde of een ontbrekende MedewerkerID, of een ontbrekend aantal berekent de tool géén totaal en toont een waarschuwing. Geschatte actieve tijdsbelasting (min) = totale frequentie × gemiddelde actieve tijd per uitvoering (normale gevallen; alle medewerkers of één gekozen medewerker); uren = minuten / 60. Wachttijd telt niet mee. Voorbeeld: 25 + 15 = 40 dossiers per week × 19,5 min = 780 min = 13 uur per week. Frequentiemetingen uit eerdere versies hebben *Meetellen in totaal* = "Nog niet bepaald" en tellen niet mee.

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
NODE_PATH=$(npm root -g) node tests/acceptatietest.js         # vereist playwright en python3 met openpyxl en pillow
NODE_PATH=$(npm root -g) node tests/betrouwbaarheidstest.js   # controletests versie 1.4
NODE_PATH=$(npm root -g) node tests/blokkentest.js            # controletests diensttijdblokken (versie 1.5)
NODE_PATH=$(npm root -g) node tests/knelpuntentest.js         # controletests knelpunten per processtap (versie 1.6)
NODE_PATH=$(npm root -g) node tests/steekproeftest.js         # controletests steekproeven en dossierkenmerken (versie 1.7)
NODE_PATH=$(npm root -g) node tests/maandtest.js              # controletests maanddashboard PR24 (versie 1.8)
```

Node.js en npm zijn alleen nodig voor ontwikkeling en tests. De gebruiker opent gewoon `Meettool.html`.

## Openen op Windows

1. Download `Meettool.html` en zet het bestand in een vaste map, bijvoorbeeld *Documenten\Meettool*. Gebruik steeds hetzelfde bestand op dezelfde plek.
2. Dubbelklik op het bestand. Het opent in de standaardbrowser (Edge of Chrome). Als het in een andere browser opent: klik met de rechtermuisknop op het bestand en kies *Openen met* > *Microsoft Edge*.
3. Er is geen installatie, server of internet nodig. De gegevens blijven in deze browser op deze computer. Maak regelmatig een JSON-back-up (*Exporteren* > *JSON-back-up*).
4. Een nieuwe versie gebruikt u door het oude bestand te vervangen door het nieuwe, met dezelfde naam op dezelfde plek, en te openen in dezelfde browser. Uw opgeslagen gegevens blijven dan behouden.

## Versie 1.8: maanddashboard PR24

- **Selectie en maandmeting:** proces (PR24), bestuur (LEV, SAMANAS), kalendermaand en kalenderjaar. Iedere combinatie is een afzonderlijke maandmeting. Er wordt pas iets aangemaakt na *Nieuwe maandmeting*. Wijzigingen worden direct opgeslagen; bovenaan staat wanneer dat voor het laatst gebeurde. Wisselen van selectie toont het dashboard van die combinatie.
- **Opslag:** in een **eigen localStorage-sleutel** (`meettool-pr24-maandmetingen`). Bestaande gegevens (IndexedDB) en bestaande localStorage-sleutels worden niet gelezen, gewijzigd of overschreven. Een onleesbare opgeslagen versie wordt nooit overschreven.
- **Maandgegevens:** nieuwe medewerkers, aangeleverde en verwerkte diensttijdopgaven (gehele getallen ≥ 0; verwerkt ≤ aangeleverd ≤ nieuwe medewerkers), bron en toelichting. Ongeldige invoer krijgt een melding en wordt niet opgeslagen. Berekend: geen diensttijdopgave, nog te verwerken, aanleverpercentage, verwerkingspercentage en verwerkt ten opzichte van alle nieuwe medewerkers (één decimaal; bij deler 0 *niet te berekenen*).
- **Dossiers:** alleen geanonimiseerde codes (voorstel `LEV-2026-08-D01`). Per dossier ABP-periode-regels, verwacht aantal diensttijdblokken, verwerkingsstatus, werkelijk aantal regels in Visma, bijzonderheden en bron. Totalen zijn altijd de som van de dossiers. Gemiddelden gebruiken alleen ingevulde waarden en tonen op hoeveel dossiers ze zijn gebaseerd. Een afwijkend aantal dossiers ten opzichte van de aangeleverde opgaven geeft een waarschuwing, maar blokkeert niets.
- **Processtappen:** de negen standaardstappen PR24-S01 t/m S09 met actieve tijd en wachttijd per eenheid, rekeneenheid (S04–S06 standaard per diensttijdblok, de rest per dossier; aanpasbaar), meetwijze, aantal waarnemingen, knelpunt met toelichting en opmerkingen. Tijden kunnen worden overgenomen uit een andere maandmeting; de herkomst wordt dan vastgelegd. De bestaande stapmetingen van procesmetingen blijven ongewijzigd.
- **Tijd:** reeds uitgevoerd = tijd × verwerkte opgaven (per dossier) of × werkelijk ingevoerde Visma-regels (per blok). Verwacht = tijd × aangeleverde opgaven of × totaal verwachte blokken. Resterend = verwacht − uitgevoerd. Actieve tijd en wachttijd staan apart, in minuten, uren en minuten en decimale uren. Ontbreekt een gegeven, dan staat er *onvoldoende gegevens* (met de deelsom van de stappen die wel bekend zijn). Bij geschatte of niet-ingevulde meetwijzen staat het label *schatting*. De totale verwachte tijdsbelasting is actieve tijd + wachttijd.
- **Herleidbaarheid:** bij iedere uitkomst staat een i-icoon met de formule. *Herleiding: onderliggende gegevens* toont bestuur, maand, dossiers, stapmetingen, meetwijze, waarnemingen, de berekening met getallen en de wijzigingsdata.
- **Export en import:** *Exporteren* levert Excel (PR24 Dashboard, Maandmetingen, Dossiers, Processtappen, Berekeningen), CSV (maandmetingen, dossiers, processtappen) of de volledige JSON-back-up. De bestaande volledige Excel-export bevat deze vijf tabbladen ook. *Importeren* leest een JSON-back-up in (samenvoegen of vervangen, met controle en veiligheidsback-up).

## Versie 1.7: steekproeven en dossierkenmerken

- **Steekproeven** (nieuw tabblad 2): SteekproefID (automatisch, bijv. `SP-PR24-001`), proces, naam, omschrijving en totale grootte van de populatie, beoogde steekproefgrootte, selectiemethode (willekeurig, opeenvolgend, doelgericht), in- en exclusiecriteria, start- en einddatum en status (concept, bezig, afgerond). Iedere bestaande of nieuwe procesmeting kan worden gekoppeld: in het meetformulier of via *Metingen koppelen*. Een steekproef verwijderen ontkoppelt alleen; de metingen blijven bestaan.
- **Bij de procesmeting** (alle velden optioneel): SteekproefID, volgnummer binnen de steekproef (automatisch voorgesteld, uniek), geanonimiseerd dossier-ID (waarschuwing bij een lange cijferreeks). Bij PR24 (en bij andere processen na aanzetten in *Processen beheren*) ook: aantal ABP-periode-regels, aantal onderbrekingen, complexiteit, meest tijdrovende processtap (uit de bestaande stappen) en reden(en) tijdsbelasting. Voor ieder proces: knelpunt op dossierniveau (ja/nee, categorie, korte omschrijving, gevolg). Het aantal resulterende diensttijdblokken, het casustype (normaal/uitzondering) en de meetwijze waren er al; de meetwijze heeft er *Geobserveerd* bij gekregen.
- **Stapmetingen zijn optioneel:** met *Detailmeting per processtap uitgevoerd = Nee* slaat u een procesmeting op met alleen de totale actieve tijd en wachttijd. Die tijd telt mee in alle tijden per dossier, maar nooit in de tijd per processtap. Er wordt nooit een tijd per stap afgeleid.
- **Steekproefresultaten:** voortgang (bijv. 12 van 20 dossiers), bruikbare metingen, totale, gemiddelde en mediane actieve tijd met minimum en maximum, totale en gemiddelde wachttijd, gemiddelde actieve tijd per complexiteitsniveau, gemiddeld aantal periode-regels, diensttijdblokken en onderbrekingen (totaal ÷ dossiers), verdelingen naar complexiteit en normaal/uitzondering, de meest voorkomende knelpunten en het aantal gemeten en geschatte tijdswaarden. Testmetingen tellen standaard niet mee; de meetwijze is te filteren.
- **Twee aparte overzichten per stap:** *1. Meest genoemde tijdrovende processtap* (telling over alle procesmetingen) en *2. Gemiddelde tijd per processtap* (uitsluitend uit aanwezige stapmetingen).
- **Geschatte tijdsbelasting populatie:** gemiddelde actieve tijd per dossier × populatiegrootte, met de gebruikte populatiegrootte en het aantal onderzochte dossiers. Bij een doelgerichte steekproef of de status concept/bezig volgt een waarschuwing.
- **Export en opslag:** Excel heeft de tabbladen *Steekproeven* en *Steekproefresultaten* (met alle gekoppelde dossiers). *Procesmetingen*, *Stapmetingen* en *Knelpunten* (nu ook knelpunten op dossierniveau) bevatten SteekproefID, volgnummer en dossier-ID. Er is een CSV *Steekproeven*. De JSON-back-up (schemaversie 4) bevat alles; verwijzingen naar ontbrekende steekproeven, dubbele volgnummers en ongeldige waarden worden geweigerd. Bestaande gegevens blijven ongewijzigd.

## Versie 1.6: knelpunten per processtap

- **Registratie per stap (optioneel):** in de stappentabel van een procesmeting staat per stap de keuze *Knelpunt* (– / Nee / Ja). Leeg betekent *niet geregistreerd*, niet "geen knelpunt". Alleen bij *Ja* verschijnen de vervolgvelden: categorie (Wachten, Systeem, Ontbrekende of onduidelijke informatie, Handmatige invoer, Controle of herstelwerk, Overdracht tussen personen of afdelingen, Afwijkende werkwijze, Anders), korte omschrijving, gevolg (meerdere mogelijk), geschatte extra actieve tijd en wachttijd (min; leeg = onbekend, nooit 0) en bron (Geobserveerd, Door medewerker aangegeven, Uit systeemgegevens, Eigen inschatting). Geen van deze velden is verplicht.
- **Per procesmeting (optioneel):** *Belangrijkste knelpunt tijdens deze uitvoering* en *Bijzonderheden of uitzonderingen*.
- **Controles:** negatieve extra tijd wordt geweigerd; extra tijd die groter is dan de gemeten tijd van de stap geeft een waarschuwing (opslaan blijft mogelijk).
- **Knelpuntenanalyse** (tabblad Resultaten, binnen alle filters, normale gevallen en uitzonderingen apart): aantal en percentage metingen met minimaal één knelpunt, metingen zonder registratie, voorkomens per processtap, per categorie en per medewerker, en totale en gemiddelde geschatte extra tijd (gemiddelde per knelpunt met een schatting). Met *Alle knelpunten bekijken* ziet u ieder knelpunt met meting, stap, medewerker, datum/week, meetwijze en casustype.
- **Geen dubbeltelling:** de geschatte extra tijd is verklarend; die zit al in de gemeten actieve tijd en wachttijd. Ze wordt nooit opgeteld bij procesduur, gemiddelden of tijdsbelasting.
- **Export en opslag:** Excel krijgt de tabbladen *Knelpuntenanalyse* en *Knelpunten* (één rij per knelpunt met ProcesID, MetingID, StapID, MedewerkerID, datum, kalenderweek, meetwijze, casustype en test/fictief); *Stapmetingen* en *Procesmetingen* krijgen de knelpuntkolommen. Er is een CSV *Knelpunten*. Alle velden staan in de JSON-back-up en gaan mee bij dupliceren, concepten en herstel; ongeldige waarden in een back-up worden geweigerd. Bestaande metingen blijven ongewijzigd (knelpunt "Niet ingevuld").

## Versie 1.5: diensttijdblokken (PR24)

- **Invoer:** naast *Omvang: aantal dienstperioden* staat het optionele veld *Aantal resulterende diensttijdblokken*: een geheel getal vanaf 0, of leeg als het onbekend is. Meer blokken dan dienstperioden geeft een waarschuwing, maar opslaan blijft mogelijk. Het veld staat standaard aan bij PR24; bij andere processen verschijnt het pas als bij *Processen beheren* "diensttijdblokken vastleggen" aanstaat. Bestaande metingen blijven leeg.
- **Berekeningen** (normale gevallen, binnen alle filters, testmetingen standaard uitgesloten), steeds als totaal ÷ totaal:
  - dienstperioden per dossier = Σ dienstperioden ÷ Σ dossiers;
  - diensttijdblokken per dossier = Σ blokken ÷ Σ dossiers;
  - actieve tijd per diensttijdblok = Σ actieve tijd ÷ Σ blokken;
  - geschat aantal blokken per week = blokken per dossier × totale frequentie;
  - verhouding = Σ blokken ÷ Σ dienstperioden (bijv. *40 dienstperioden resulteerden in 4 diensttijdblokken.*).

  Metingen zonder aantal blokken vallen alleen buiten de berekeningen per blok.
- **Tijdsbelasting ongewijzigd:** totale frequentie × gemiddelde actieve tijd per dossier. De tijd voor de blokken zit al in de tijd per dossier en wordt niet nog eens vermenigvuldigd (geen dubbele telling).
- **Export en opslag:** het veld staat in de ruwe procesmetingen (Excel/CSV), in het Totaaloverzicht, in Per medewerker en in de JSON-back-up, en gaat mee bij dupliceren, concepten en herstel.

## Versie 1.4: gebruiksvriendelijkheid en betrouwbaarheid

- **Meetmoment en kalenderweek:** uit de meetdatum worden kalenderjaar, ISO-kalenderweek en begin- en einddatum van de week berekend (maandag t/m zondag), bijvoorbeeld *Kalenderweek 41 van 2026 (5 t/m 11 oktober 2026)*. Dit wordt niet opgeslagen, maar telkens uit de datum afgeleid, dus het werkt ook voor bestaande metingen. Frequentiemetingen hebben een optionele meetdatum. Het meetmoment staat los van de *frequentieperiode* (per dag/week/maand/jaar).
- **Eenheden:** alle uitkomsten tonen hun eenheid (bijv. *55 dossiers per week*). Een ontbrekende of nietszeggende eenheid ("n.v.t.") geeft een waarschuwing; de tool toont dan "uitvoeringen" en blokkeert niets.
- **Test/fictieve metingen:** een vinkje bij procesmetingen en frequentiemetingen. Testmetingen blijven zichtbaar in de ruwe gegevens, maar tellen standaard niet mee. Met de schakelaar *Testmetingen meenemen* bij de resultaten tellen ze wel mee. Stapmetingen volgen hun procesmeting. Bestaande metingen gelden als echt.
- **Controle proces- en stapmetingen:** optioneel kan bij een procesmeting de totale actieve tijd en wachttijd worden genoteerd. Een verschil met de som van de stappen groter dan 0,05 minuut geeft een waarschuwing, maar opslaan blijft mogelijk. Berekeningen gebruiken de som van de stappen.
- **Meting dupliceren:** maakt een nieuwe meting met een nieuw MetingID, de datum van vandaag en gekopieerde stapmetingen (gemarkeerd als "Gekopieerd"). De kopie wordt pas opgeslagen na controle.
- **Concept:** het meetformulier en het frequentieformulier worden tijdens het invullen automatisch lokaal bewaard. Na vernieuwen of sluiten wordt het concept hersteld; het is te verwijderen en verdwijnt na opslaan. Een concept overschrijft nooit ongemerkt een intussen gewijzigde meting.
- **Uitleg** bij begrippen via kleine i-icoontjes.
- **Volledige back-up en herstel:** bevat ook medewerker-ID's, instellingen, koppelingen, teststatussen, schemaversie (3) en tijdstip. Herstellen controleert eerst het bestand, toont een samenvatting en laat kiezen tussen samenvoegen en vervangen. Vóór vervangen wordt automatisch een veiligheidsback-up gedownload.

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

## Vereenvoudigde PR24-tool

`meettool-pr24-eenvoudig.html` is een zelfstandige tool voor alleen PR24. Er is één flow in vijf stappen, met *Vorige* en *Volgende* en een voortgangsindicator bovenaan:

1. **Bestuur en maand:** LEV of SAMANAS, kalendermaand en -jaar. Hier maakt u een nieuwe maandmeting, slaat u op, verwijdert u (met bevestiging) of opent u een bestaande maandmeting.
2. **Volume en frequentie:** nieuwe medewerkers, aangeleverde en verwerkte diensttijdopgaven, met bron en toelichting. De controle verwerkt ≤ aangeleverd ≤ nieuwe medewerkers wordt direct uitgevoerd. Afgeleide aantallen en percentages staan erbij (één decimaal; een deler 0 levert geen fout op).
3. **Dossiers:** één regel per opgave, met een geanonimiseerde dossiercode (voorstel `LEV-2026-08-D01`), het aantal ABP-periode-regels en een automatische complexiteitsklasse (1–19 Klein, 20–50 Middel, 51–100 Groot, 101 of meer Zeer groot; 0 is ongeldig). Daarnaast het verwachte aantal blokken, de status, de Visma-regels (alleen als bekend) en een bijzonderheid. Totalen zijn sommen, gemiddelden noemen het aantal dossiers, en lege velden tellen niet als 0.
4. **Processtappen en tijd:** negen stappen met een vaste rekeneenheid, actieve tijd en wachttijd in minuten (bij S02, S03 en S07 per complexiteitsklasse, uitklapbaar), meetwijze, knelpunt en toelichting.
   - Met *inbegrepen bij* telt een stap niet mee in de totalen, maar blijft hij zichtbaar. Zo wordt niets dubbel geteld.
5. **Resultaat en export:** frequentie, bronregels en complexiteit, diensttijdblokken en status, tijd per dossier, per stap (de drie hoogste gemarkeerd, oorspronkelijke volgorde), per klasse en per bestuur en maand, en de belangrijkste knelpunten. Daarbij export naar Excel (Samenvatting, Maandgegevens, Dossiers, Processtappen en tijden, Tijd per dossier en stap, Berekeningen en meetwijzen) en CSV, een JSON-back-up en het importeren van een JSON-back-up.

**Tijd (versie 1.1: berekend per dossier):** iedere stap heeft een vaste rekeneenheid.
- *Per dossier* (S01, S09): de tijd telt één keer per dossier.
- *Per complexiteitsklasse* (S02, S03, S07): de tijd die hoort bij de automatisch bepaalde klasse van het dossier (Klein 1–19, Middel 20–50, Groot 51–100, Zeer groot 101 of meer regels). Per klasse vult u een actieve tijd en een wachttijd in.
- *Per diensttijdblok* (S04, S05, S06, S08): tijd × aantal blokken. Bij volledig verwerkte dossiers telt het werkelijke aantal Visma-regels, bij de overige het verwachte aantal; nooit beide.
- Afbakening om dubbeltelling te voorkomen: S02 bepaalt welke arbeidsverhoudingen relevant zijn; S03 bepaalt hoe de relevante perioden door aansluitingen, onderbrekingen en overlap tot diensttijdblokken worden gevormd.
- Per dossier ziet u de tijd per stap, de rekeneenheid, de klasse, het gebruikte aantal blokken, de totale actieve tijd en wachttijd en de herkomst (gemeten, geschat of berekend).
- Het dashboard toont de gemiddelde en totale tijd per dossier, en de tijd per processtap, per klasse en per bestuur en maand. De stappen met de meeste actieve tijd zijn gemarkeerd.
- Ontbreekt een gegeven, dan staat er *onvoldoende gegevens* (met de deelsom van wat wel bekend is); er wordt nooit 0 ingevuld.
- Gegevens uit versie 1.0 worden bij het openen omgezet. Een tijd per dossier bij een stap die nu per klasse rekent, geldt voor iedere klasse. Een tijd met een onverenigbare eenheid (dossier ↔ blok) wordt niet overgenomen, maar wel in de toelichting vermeld. Er blijft een kopie bewaard onder `meettool-pr24-eenvoudig-kopie-versie-1.0`.

**Opslag:** alleen lokaal in de browser, onder de eigen localStorage-sleutel `meettool-pr24-eenvoudig`. De gegevens van de brede meettool worden niet gelezen of gewijzigd. Onleesbare opgeslagen gegevens worden nooit overschreven.

**Openen op Windows:** zet `meettool-pr24-eenvoudig.html` in een vaste map en dubbelklik erop. Het bestand opent in Edge of Chrome; kies anders *Openen met* > *Microsoft Edge*. Er is geen installatie, server of internet nodig. Gebruik steeds dezelfde browser en maak regelmatig een JSON-back-up.

**Ontwikkeling:** het bestand wordt rechtstreeks bewerkt; er is geen buildstap. De Excel-schrijver is overgenomen uit `src/xlsx.js`. Controletest (vereist Playwright en python3 met openpyxl): `NODE_PATH=$(npm root -g) node tests/eenvoudigtest.js`.
