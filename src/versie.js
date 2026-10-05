// Versienummer van de meettool. Wordt opgenomen in exports en back-ups.
const VERSIE = '1.3.0';
const BACKUP_FORMAAT = 'meettool-backup';

const CASUSTYPEN = ['Normaal', 'Uitzondering'];
const MEETWIJZEN_METING = ['Gemeten', 'Geschat door medewerker', 'Uit systeemgegevens'];
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
];
