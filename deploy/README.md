# Kalender auf kalender.bytevo.de bereitstellen

## Vorher: bestehende Daten sichern

Die bisherige Version speichert Daten teils lokal im Browser und synchronisiert mit Supabase.
Ein neues Subdomain-Origin kann den alten Browser-Speicher NICHT auslesen. VOR der
Umstellung am bisherigen Kalender anmelden und ein vollständiges JSON-Backup exportieren
(siehe MIGRATION.md). Supabase erst nach Prüfung der Migration abschalten.
Das neue System importiert Daten nicht automatisch von Supabase.

## Debian VPS – erste Installation

1. Beim DNS-Provider einen A-Record "kalender" auf die öffentliche IPv4 deines VPS setzen.
   Ggf. auch einen AAAA-Record auf die korrekte öffentliche IPv6 setzen.
2. Als sudo-Benutzer ausführen (Port 3102 vorher auf Belegung prüfen):

    sudo apt update
    sudo apt install -y git nginx certbot python3-certbot-nginx python3
    sudo useradd --system --home /var/lib/kalender --shell /usr/sbin/nologin kalender
    sudo mkdir -p /var/www/kalender /var/lib/kalender /var/backups/kalender
    sudo chown -R kalender:kalender /var/lib/kalender /var/backups/kalender
    sudo chmod 700 /var/lib/kalender /var/backups/kalender
    sudo git clone -b feature/secure-selfhosted-kalender https://github.com/wixertv-droid/Kalender-.git /var/www/kalender
    cd /var/www/kalender

3. Administrator-Passwort mit mindestens 12 Zeichen interaktiv festlegen
   (nicht als Argument in die Shell-History schreiben!):

    sudo -u kalender env KALENDER_DATA_DIR=/var/lib/kalender python3 /var/www/kalender/server.py init-admin

4. Dienste konfigurieren:

    sudo cp /var/www/kalender/deploy/kalender.service /etc/systemd/system/kalender.service
    sudo cp /var/www/kalender/deploy/kalender.nginx /etc/nginx/sites-available/kalender
    sudo ln -s /etc/nginx/sites-available/kalender /etc/nginx/sites-enabled/kalender
    sudo nginx -t
    sudo systemctl daemon-reload
    sudo systemctl enable --now kalender
    sudo systemctl reload nginx

5. DNS testen; dann HTTPS aktivieren. Die App erwartet zwingend HTTPS und
   funktioniert wegen Secure-Cookie absichtlich nicht über unverschlüsseltes HTTP:

    sudo certbot --nginx -d kalender.bytevo.de --redirect
    curl -sS -D- -o /dev/null https://kalender.bytevo.de/

6. https://kalender.bytevo.de öffnen, mit dem festgelegten Passwort anmelden.
   Anschließend in Einstellungen > Backup-Import die JSON-Datei einspielen.
   Termine, Kunden, Events, Sperrzeiten und Einstellungen prüfen.

## Regelmäßiges Backup (tägl. 03:00 Uhr)

Cronjob des Nutzers "kalender":

    sudo crontab -u kalender -e

Folgende Zeile hinzufügen:

    0 3 * * * KALENDER_DATA_DIR=/var/lib/kalender KALENDER_BACKUP_DIR=/var/backups/kalender /usr/bin/python3 /var/www/kalender/backup.py >> /var/lib/kalender/backup.log 2>&1

Das Script nutzt SQLite Online-Backup und prüft die Datenbankintegrität.
30 Tage Aufbewahrung; externe/offsite verschlüsselte Sicherung ebenfalls einrichten.
Eine Sicherung gilt erst nach erfolgreichem Rücksicherungstest als zuverlässig.

## Updates ohne Datenverlust

    cd /var/www/kalender
    sudo git pull --ff-only
    sudo systemctl restart kalender
    sudo systemctl status kalender

Besser: Vor Updates explizit unter dem "kalender"-Benutzer sichern:

    sudo -u kalender env KALENDER_DATA_DIR=/var/lib/kalender KALENDER_BACKUP_DIR=/var/backups/kalender python3 /var/www/kalender/backup.py

## Serververwaltung

- Fehlerlogs: sudo journalctl -u kalender -n 100 --no-pager
- Admin-Passwort zurücksetzen: sudo -u kalender env KALENDER_DATA_DIR=/var/lib/kalender python3 /var/www/kalender/server.py reset-password
- SQLite liegt ausschließlich unter /var/lib/kalender, nicht im Webroot und nicht auf GitHub.
- Die App bindet nur an 127.0.0.1:3102. Nginx stellt HTTPS bereit.
- Andere Websites / PM2-Anwendungen auf dem VPS bleiben unangetastet.
- NGINX rate limiting, Firewall, Fail2ban, HTTPS-Härtung und unabhängige Backups ergänzen.
