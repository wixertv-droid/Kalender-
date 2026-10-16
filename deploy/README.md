# kalender.bytevo.de auf bestehendem netcup-VPS installieren (ohne App-Login)

## Vorher prüfen: unveränderte andere Domains

Der Kalender läuft in /var/www/kalender, mit SQLite unter /var/lib/kalender, einem
eigenen systemd-Dienst und dem internen Port 3102. Bestehende PM2-Anwendungen,
Nginx-vhosts, Datenbanken, Ports und Domains werden nicht verändert.

Der Screenshot im netcup CCP zeigte den neuen DNS-A-Record "kalender" ->
159.195.157.24 noch unter "Gewünschte Änderungen an der Zonenrevision".
Bitte zuerst "Änderungen anwenden" anklicken und DNS-Ausbreitung abwarten.

WICHTIG: Keine PIN, kein Passwort im Kalender. Stattdessen braucht jedes Gerät
ein einmalig installiertes Client-Zertifikat (mTLS). Ohne ein Zertifikat
blockt Nginx alle Seiten und APIs. So bleiben personenbezogene Daten geschützt.
Die .p12-Dateien niemals öffentlich hochladen oder in Git speichern.

## 1. Verbindungs-/Konfliktprüfung auf dem Server

    ssh root@159.195.157.24
    hostname
    nginx -t
    systemctl is-active nginx
    ss -ltnp | grep -E ':(80|443|3102)\b' || true
    ls -la /etc/nginx/sites-enabled/
    getent ahostsv4 kalender.bytevo.de

Stoppen, falls Port 3102 bereits benutzt ist oder "kalender.bytevo.de"
schon von einem existierenden Nginx-vhost bedient wird. Nicht dessen
Konfiguration überschreiben. Erst bestehenden Zustand klären.

## 2. Nur neue Anwendung installieren

    apt update
    apt install -y git python3 nginx openssl certbot
    id -u kalender >/dev/null 2>&1 || useradd --system --home /var/lib/kalender --shell /usr/sbin/nologin kalender
    mkdir -p /var/www /var/lib/kalender /var/backups/kalender /var/www/letsencrypt
    chown -R kalender:kalender /var/lib/kalender /var/backups/kalender
    chmod 700 /var/lib/kalender /var/backups/kalender
    git clone -b feature/secure-selfhosted-kalender https://github.com/wixertv-droid/Kalender-.git /var/www/kalender
    cp -a /etc/nginx /root/nginx-pre-kalender-$(date +%Y%m%d-%H%M%S)

Wichtig: Der Befehl "git clone" bricht ab, falls /var/www/kalender bereits
existiert, anstatt bestehende Daten zu überschreiben. KEIN "rm -rf" verwenden.

## 3. HTTPS-Zertifikat erstellen (noch KEINE App freigeben)

    cp /var/www/kalender/deploy/kalender.bootstrap.nginx /etc/nginx/sites-available/kalender
    ln -s /etc/nginx/sites-available/kalender /etc/nginx/sites-enabled/kalender
    nginx -t && systemctl reload nginx
    certbot certonly --webroot -w /var/www/letsencrypt -d kalender.bytevo.de

Bei Port 80 muss Let's Encrypt den Challenge-Pfad erreichen. Falls dies
fehlschlägt, DNS/Firewall/andere VHosts prüfen. Bestehende Sites nicht deaktivieren.

## 4. Gerätezertifikate erzeugen (nur auf VPS, nicht in Git!)

    bash /var/www/kalender/deploy/device-certificates.sh init-ca
    bash /var/www/kalender/deploy/device-certificates.sh issue pc
    bash /var/www/kalender/deploy/device-certificates.sh issue iphone

Das .p12-Export-Passwort ist NUR zum geschützten Installieren der Geräte-Datei
notwendig. Es gibt KEIN Kalender-Passwort und keine PIN.

Ergebnis:
  /root/kalender-device-certificates/pc.p12
  /root/kalender-device-certificates/iphone.p12

Die Zertifikate sicher auf die jeweiligen Geräte übertragen, nicht als
unverschlüsselten E-Mail-Anhang verschicken und niemals hier im Chat posten.
Am Windows-PC lässt sich .p12 im Zertifikatsspeicher "Aktueller Benutzer /
Eigene Zertifikate" importieren. Auf iPhone die .p12-Datei als Profil installieren.
Bei Browser-Zugriff ggf. das passende Client-Zertifikat auswählen.

Auf dem lokalen Windows-PC aus PowerShell (nicht auf dem Server!) z.B.:

    scp root@159.195.157.24:/root/kalender-device-certificates/pc.p12 .

Die iPhone-Datei sicher übertragen, z.B. über eine geeignete
Ende-zu-Ende-verschlüsselte Dateiübertragung oder USB.

## 5. Nur Kalender-vhost auf HTTPS / mTLS umschalten

    cp /var/www/kalender/deploy/kalender.nginx /etc/nginx/sites-available/kalender
    nginx -t && systemctl reload nginx
    cp /var/www/kalender/deploy/kalender.service /etc/systemd/system/kalender.service
    systemctl daemon-reload
    systemctl enable --now kalender
    systemctl status kalender --no-pager

Der neue Webserver bindet ausschließlich an 127.0.0.1:3102.
Nginx verwendet für "kalender.bytevo.de" ein einziges eigenes vhost.
Die Konfiguration der anderen Sites bleibt unverändert.

## 6. Daten aus alter Kalender-Version übernehmen

GitHub enthält KEINE Laufzeitdaten. Alte Daten nicht durch leere ersetzen!
Siehe MIGRATION.md für vollständigen JSON-Export inklusive Events aus
localStorage und Sicherung der alten Supabase-Daten.

Mit deinem Zertifikat https://kalender.bytevo.de öffnen,
Einstellungen -> Backup importieren. Vorher Originaldaten sichern.
Danach Termine, Kunden, Events und Sperrzeiten durchzählen.
Die alte Supabase-Anbindung erst nach erfolgreichem Vergleich schließen.

## 7. Tägliches Backup und Wiederherstellungstest

    crontab -u kalender -e

Cron-Zeile hinzufügen:

    0 3 * * * KALENDER_DATA_DIR=/var/lib/kalender KALENDER_BACKUP_DIR=/var/backups/kalender /usr/bin/python3 /var/www/kalender/backup.py >> /var/lib/kalender/backup.log 2>&1

30 Tage lokale Aufbewahrung. Zusätzlich regelmäßig ein verschlüsseltes Backup
auf einen anderen Speicherort übertragen; Wiederherstellung testen.

## Wartung

- Logs: journalctl -u kalender -n 100 --no-pager
- Rücksicherung: Kalender stoppen und SQLite-Datei aus geprüftem Backup wiederherstellen.
- Updates: erst Backup, dann git pull --ff-only, dann systemctl restart kalender.
- HTTPS-Erneuerung: certbot renew --dry-run kontrollieren.
- Gerätezertifikate laufen nach 365 Tagen ab; vor Ablauf erneuern.
- Bei Verlust eines Geräts: Zertifikat/CA sperren bzw. neu ausstellen; ggf.
  alle Geräte-Zertifikate ersetzen. Zertifikate nie öffentlich speichern.
- Kein echter Web-Push bei geschlossenem Browser implementiert. Webmeldungen
  funktionieren in der offenen App, optional mit Browser-Benachrichtigungen.
- Die alten Kalender-Templates verwenden an mehreren Stellen HTML-Zusammensetzung.
  Vor Freigabe weiterer Geräte vollständige XSS-Prüfung und echte Datenmigration testen.

## Bedienung

Bei Aufruf prüft der Browser das auf dem Gerät installierte Zertifikat.
Danach öffnet sich die Wochenansicht. Kein Login, keine PIN und kein Passwort.
