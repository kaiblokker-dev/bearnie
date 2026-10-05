"""Leest de Excel-export van de betrouwbaarheidstest en geeft kerngegevens terug als JSON."""
import json
import sys

import openpyxl

wb = openpyxl.load_workbook(sys.argv[1])
uit = {"bladen": wb.sheetnames}


def tabel(naam, eerste_kop, vanaf=0):
    """Geeft (koppen, rijen) van de eerste tabel in een blad waarvan de kop begint met eerste_kop."""
    rijen = list(wb[naam].iter_rows(values_only=True))
    k = next(i for i, r in enumerate(rijen) if i >= vanaf and r and r[0] == eerste_kop)
    data = []
    for r in rijen[k + 1:]:
        if not r or r[0] is None:
            break
        data.append(r)
    return rijen[k], data, k


def rij(koppen, data, sleutel):
    return next(r for r in data if r[0] == sleutel)


kop, data, _ = tabel("Procesmetingen", "MetingID")
r = rij(kop, data, "M-PR24-001")
g = lambda n: r[kop.index(n)]
uit["pm001"] = [g("Meetdatum"), g("Kalenderjaar (ISO-week, afgeleid)"), g("Kalenderweek (afgeleid)"), g("Begin kalenderweek (afgeleid)"),
                g("Einde kalenderweek (afgeleid)"), g("Test/fictief"), g("Uitvoeringseenheid"), g("Omvangseenheid")]
uit["pm003_test"] = rij(kop, data, "M-PR24-003")[kop.index("Test/fictief")]

kop, data, _ = tabel("Stapmetingen", "MetingID")
uit["stap003_test"] = rij(kop, data, "M-PR24-003")[kop.index("Test/fictief (via procesmeting)")]

kop, data, _ = tabel("Frequentie", "FrequentieID")
r = rij(kop, data, "F-PR24-001")
uit["freq001"] = [r[kop.index("Meetdatum")], r[kop.index("Test/fictief")], r[kop.index("Kalenderweek (afgeleid)")]]

kop, data, k = tabel("Totaaloverzicht", "ProcesID")
r = next(x for x in data if x[0] == "PR24" and x[kop.index("Kalenderweek (selectie)")] == "alle kalenderweken")
g = lambda n: r[kop.index(n)]
uit["totaal"] = {"freq": g("Totale frequentie"), "min": g("Geschatte actieve tijdsbelasting (min)"), "uur": g("Geschatte actieve tijdsbelasting (uur)"),
                 "week": g("Kalenderweek (selectie)"), "test": g("Test/fictieve metingen"), "fids": g("Gebruikte frequentie-ID's"),
                 "mids": g("Gebruikte MetingID's"), "mw": g("Gebruikte medewerker-ID's"), "bron": g("Bronnen frequentie")}
kop, data, _ = tabel("Totaaloverzicht", "FrequentieID", k + 1)
uit["freqstatus001"] = rij(kop, data, "F-PR24-001")[kop.index("Meegenomen in totaal")]
uit["freqstatus003"] = rij(kop, data, "F-PR24-003")[kop.index("Meegenomen in totaal")]

kop, data, _ = tabel("Per medewerker", "MetingID")
uit["ind003"] = rij(kop, data, "M-PR24-003")[kop.index("Meegenomen in resultaten")]
r = rij(kop, data, "M-PR24-004")
uit["ind004_afwijking"] = r[kop.index("Afwijking proces/stappen")]
uit["ind004_verschil"] = r[kop.index("Controle actief: verschil (min)")]

print(json.dumps(uit, default=str))
