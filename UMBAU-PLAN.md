# Agenda 2050 – Umbau 2026-10-17

Alle Änderungen sind **ausschließlich** im Entwicklungsbranch
\`feature/secure-selfhosted-kalender\`. Keine Änderung an der produktiven
SQLite-Datenbank oder laufenden Nginx-/Systemdiensten wurde vorgenommen.

## Gewünschte Punkte

| Nr. | Bereich | Umsetzung |
|----:|---------|-----------|
| 1 | Event per Kalender-Klick | Deep Link \`events.html?event=ID\` aus Woche/Tag/Monat |
| 4 | Kundenverknüpfung | Teilnehmer aus Kundenkartei auswählen oder neu anlegen |
| 5 | Kapazität und Warteliste | Plätze begrenzen; neue Gäste kommen bei vollem Event auf die Warteliste |
| 6 | Teilnehmerstatus | Angemeldet, Bestätigt, Erschienen, Warteliste, Abgesagt, No-Show |
| 7 | Check-in | Ein-Klick-Erschienen; direkt im Event-Dashboard |
| 8 | Eventabrechnung | Eintrittspreis pro Gast, Anzahlung, Restzahlung, Event-Ausgaben; erhalten/offen/Gewinn |
| 9 | Promo-Varianten | Ankündigung, freie Plätze, Erinnerung, ausgebucht; Copy-to-WhatsApp bleibt |
| 11 | Monatsansicht | \`monat.html\` mit Termin-, Event- und Sperrzeit-Markierungen |
| 13 | Überschneidungen | Atomare Prüfung auf dem Server zusätzlich zu den vorhandenen Kalenderprüfungen |
| 17 | Kundenhistorie | Termine, Events, No-Shows und Einnahmen im Kundenprofil |
| 20 | Finanzübersicht | Einzeltermine getrennt von Events, Eventkosten, offene Beträge, CSV-Export |
| 21 | Backups | Systemd-Timer täglich (03:15), 30 Tage Aufbewahrung, Backup/Restore mit Vorschau |

Die bestehende Cyber-/Neon-Gestaltung und die fünf Hauptnavigationspunkte
bleiben unverändert. Die Monatsansicht ist über den bisherigen Kalenderkopf
erreichbar. Die PIN bleibt aktiv, Geräte-Zertifikate weiterhin optional.

## Installation auf dem VPS – erst nach GitHub-CI

    ssh root@159.195.157.24
    cd /var/www/kalender
    git fetch origin feature/secure-selfhosted-kalender
    git show origin/feature/secure-selfhosted-kalender:deploy/update-kalender.sh > /root/kalender-update-v2.sh
    bash /root/kalender-update-v2.sh

Der Updatehelfer erstellt zuerst eine Online-Sicherung, überprüft den Code,
installiert den isolierten Backup-Timer und startet nur \`kalender.service\`
neu. Er ändert **keine** Nginx-vhosts, SSL-Zertifikate, Roomdo- oder Synsight-Dienste.
Bei Tests/Health-Fehlern stellt er die vorige Codeversion wieder her.

## Sichere Wiederherstellung ohne PIN-Verlust

Vorschau (durch echten Sicherungsdateinamen ersetzen):

    runuser -u kalender -- env KALENDER_DATA_DIR=/var/lib/kalender KALENDER_BACKUP_DIR=/var/backups/kalender python3 /var/www/kalender/restore_backup.py /var/backups/kalender/kalender-YYYYMMDD-HHMMSS.sqlite3

Nach Kontrolle mit \`--apply\` und expliziter Eingabe \`RESTORE\` wiederherstellen.
Die aktuelle DB wird zuerst in eine neue Sicherung geschrieben. Nur der
Kalender-Snapshot wird zurückgesetzt, **nicht** die aktuelle PIN oder Sitzungen.
Bestehende Daten vorher sorgfältig prüfen!

## Funktions-Check auf 2 Geräten (vor produktiver Nutzung)

1. Testkunden erstellen und einen Termin buchen; bei Überschneidung muss eine Warnung erscheinen.
2. Event erstellen, Kapazität 2; 3 Gäste hinzufügen -> dritter auf Warteliste.
3. Bestehenden Kunden in Event aufnehmen; Event-Link aus Monatskalender öffnen.
4. Gast bestätigen, einchecken; Anzahlung, Restzahlung, individuelle Preise ändern.
5. Zahlen in Event-Dashboard und Finance vergleichen; CSV prüfen.
6. Kundenprofil öffnen, Termin-/Eventverlauf und Umsatz vergleichen.
7. Auf zweitem Gerät anmelden; Änderungen übertragen? Gleichzeitige konkurrierende Änderungen müssen sicher abgewiesen werden.
8. \`systemctl list-timers kalender-backup.timer\` und \`ls -l /var/backups/kalender/\` prüfen.

Hinweise: Diese Implementierung wurde per CI-Syntax-, API- und Logiktests
geprüft, aber die visuelle Funktion auf deinen konkreten iPhones/Tablets
ist noch nicht manuell abgenommen. Den echten Datenbestand nicht als
Testdaten verwenden. Kleinere Fehler erst mit Testeinträgen ermitteln.
Da persönliche/teils sensible Daten gespeichert werden, keine JSON-Backups,
CSV-Dateien oder Kundendaten öffentlich verteilen.
