// Versienummer van de meettool. Wordt opgenomen in exports en back-ups.
const VERSIE = '1.8.0';
const BACKUP_FORMAAT = 'meettool-backup';

const CASUSTYPEN = ['Normaal', 'Uitzondering'];
// 'Geobserveerd' bestaat sinds versie 1.7 (waarneming door de onderzoeker).
const MEETWIJZEN_METING = ['Gemeten', 'Geschat door medewerker', 'Uit systeemgegevens', 'Geobserveerd'];
// Meetwijze = bron van de frequentie. De eerste drie waarden bestaan sinds versie 1.0 en blijven ongewijzigd.
const MEETWIJZEN_FREQUENTIE = ['Geteld', 'Uit systeemgegevens', 'Geschat door medewerker', 'Berekend', 'Anders'];
const MEETWIJZE_FREQUENTIE_LABELS = {
  'Geteld': 'Geteld (daadwerkelijke telling)',
  'Uit systeemgegevens': 'Uit systeemgegevens (systeemregistratie)',
  'Geschat door medewerker': 'Geschat door medewerker (inschatting)',
  'Berekend': 'Berekend (afgeleid uit andere gegevens)',
  'Anders': 'Anders (zie bron of toelichting)',
};

// Aanvullende velden bij een frequentiemeting (versie 1.3). Ontbreken bij oudere frequentiemetingen.
const PERIODE_EENHEDEN = ['Dag', 'Week', 'Maand', 'Kwartaal', 'Jaar'];
const BEREIKEN = ['Eigen werkzaamheden', 'Team', 'Gehele afdeling', 'Anders'];

// Groepering van meetwijzen voor het filteren van resultaten.
// Iedere meetwijze valt in precies één groep, zodat groepen nooit ongemerkt worden gemengd.
const MEETWIJZE_GROEPEN = [
  { code: 'gemeten', label: 'Gemeten', meting: 'Gemeten', frequentie: 'Geteld' },
  { code: 'geschat', label: 'Geschat door medewerker', meting: 'Geschat door medewerker', frequentie: 'Geschat door medewerker' },
  { code: 'systeem', label: 'Uit systeemgegevens', meting: 'Uit systeemgegevens', frequentie: 'Uit systeemgegevens' },
  { code: 'geobserveerd', label: 'Geobserveerd', meting: 'Geobserveerd', frequentie: null },
];

// Knelpunten per processtap (versie 1.6). Alle velden zijn optioneel.
const KNELPUNT_CATEGORIEEN = ['Wachten', 'Systeem', 'Ontbrekende of onduidelijke informatie', 'Handmatige invoer', 'Controle of herstelwerk', 'Overdracht tussen personen of afdelingen', 'Afwijkende werkwijze', 'Anders'];
const KNELPUNT_GEVOLGEN = ['Extra actieve tijd', 'Extra wachttijd', 'Verhoogde foutkans', 'Herstelwerk', 'Vertraging in de doorlooptijd', 'Anders'];
const KNELPUNT_BRONNEN = ['Geobserveerd', 'Door medewerker aangegeven', 'Uit systeemgegevens', 'Eigen inschatting'];

// Steekproeven en dossierkenmerken (versie 1.7). Alle dossierkenmerken zijn optioneel.
const SELECTIEMETHODEN = ['Willekeurig', 'Opeenvolgend', 'Doelgericht'];
const STEEKPROEF_STATUSSEN = ['Concept', 'Bezig', 'Afgerond'];
const COMPLEXITEITEN = ['Eenvoudig', 'Gemiddeld', 'Complex'];
const REDENEN_TIJDSBELASTING = ['Veel periode-regels', 'Veel diensttijdblokken', 'Onderbrekingen', 'Korte opeenvolgende perioden', 'Verschillende arbeidsverhoudingen', 'Onduidelijke informatie', 'Handmatige invoer', 'Controle of herstel', 'Anders'];

// PR24-maandmetingen (versie 1.8): één maandmeting per bestuur, maand en jaar.
const MAAND_PROCES = 'PR24';
const BESTUREN = ['LEV', 'SAMANAS'];
const DOSSIER_STATUSSEN = ['Nog niet verwerkt', 'Gedeeltelijk verwerkt', 'Volledig verwerkt', 'Status onbekend'];
const MAAND_MEETWIJZEN = ['Daadwerkelijk gemeten', 'Geschat door onderzoeker', 'Geschat door medewerker', 'Afkomstig uit systeemregistratie'];
const REKENEENHEDEN = { dossier: 'Per dossier', blok: 'Per diensttijdblok' };
// Standaardstappen van PR24 met de voorgestelde rekeneenheid.
const PR24_STAPPEN = [
  ['PR24-S01', 'ABP-diensttijdoverzicht in het e-dossier openen', 'dossier'],
  ['PR24-S02', 'Vaststellen welke diensttijd moet worden geregistreerd', 'dossier'],
  ['PR24-S03', 'Dienstperioden en onderbrekingen beoordelen', 'dossier'],
  ['PR24-S04', 'Nieuwe diensttijdregel toevoegen in Visma', 'blok'],
  ['PR24-S05', 'Begin- en einddatum en werkgever invoeren', 'blok'],
  ['PR24-S06', 'Instellingen van de diensttijdregel aanpassen', 'blok'],
  ['PR24-S07', 'Controleren of alle relevante perioden zijn ingevoerd', 'dossier'],
  ['PR24-S08', 'Ingevoerde diensttijd vergelijken met het overzicht', 'dossier'],
  ['PR24-S09', 'Registratie van de diensttijd afronden', 'dossier'],
].map(([stapId, naam, eenheid], i) => ({ stapId, naam, eenheid, volgorde: i + 1 }));
