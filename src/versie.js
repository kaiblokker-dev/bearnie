// Versienummer van de meettool. Wordt opgenomen in exports en back-ups.
const VERSIE = '1.0.0';
const BACKUP_FORMAAT = 'meettool-backup';

const CASUSTYPEN = ['Normaal', 'Uitzondering'];
const MEETWIJZEN_METING = ['Gemeten', 'Geschat door medewerker', 'Uit systeemgegevens'];
const MEETWIJZEN_FREQUENTIE = ['Geteld', 'Uit systeemgegevens', 'Geschat door medewerker'];

// Groepering van meetwijzen voor het filteren van resultaten.
// Iedere meetwijze valt in precies één groep, zodat groepen nooit ongemerkt worden gemengd.
const MEETWIJZE_GROEPEN = [
  { code: 'gemeten', label: 'Gemeten', meting: 'Gemeten', frequentie: 'Geteld' },
  { code: 'geschat', label: 'Geschat door medewerker', meting: 'Geschat door medewerker', frequentie: 'Geschat door medewerker' },
  { code: 'systeem', label: 'Uit systeemgegevens', meting: 'Uit systeemgegevens', frequentie: 'Uit systeemgegevens' },
];
