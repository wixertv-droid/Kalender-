#!/usr/bin/env bash
# Safe, non-destructive update of ONLY kalender.bytevo.de.
# Run on the VPS as root: bash /var/www/kalender/deploy/update-kalender.sh
set -Eeuo pipefail
APP=/var/www/kalender
PREVIOUS=""
UPDATED=0
rollback() {
  local code=$?
  trap - ERR
  if [[ "$UPDATED" == "1" && -n "$PREVIOUS" ]]; then
    echo "FEHLER: Stelle vorherige Kalender-Codeversion wieder her ..." >&2
    cd "$APP"
    git reset --hard "$PREVIOUS" >/dev/null
    systemctl restart kalender || true
  fi
  exit "$code"
}
trap rollback ERR

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen" >&2; exit 1; }
cd "$APP"
[[ $(git branch --show-current) == "feature/secure-selfhosted-kalender" ]] ||
  { echo "Falscher Git-Branch – Update abgebrochen." >&2; exit 1; }
[[ -z $(git status --porcelain) ]] ||
  { echo "Nicht gesicherte lokale Code-Änderungen – Update abgebrochen." >&2; git status --short; exit 1; }

echo "1/6 Vorhandene SQLite-Datenbank konsistent sichern"
runuser -u kalender -- env KALENDER_DATA_DIR=/var/lib/kalender \
    KALENDER_BACKUP_DIR=/var/backups/kalender python3 "$APP/backup.py"

echo "2/6 Nur Kalender-Code von GitHub aktualisieren"
PREVIOUS=$(git rev-parse HEAD)
git pull --ff-only
UPDATED=1

echo "3/6 Syntax und Server-Sicherheitstests"
python3 -m compileall -q server.py backup.py schedule_validation.py import_backup_json.py selective_delete.py
python3 -m unittest discover -s tests -v
if command -v node >/dev/null 2>&1; then
    node --check events.js
    node --check app.js
    node --check webmeldungen.js
    node --check datenverwaltung.js
    node --test tests/test_event_core.cjs tests/test_webmeldungen.cjs
fi

echo "4/6 Gesicherte Backup-Automatik aktivieren (03:15, 30 Tage)"
install -o root -g root -m 0644 deploy/kalender-backup.service /etc/systemd/system/kalender-backup.service
install -o root -g root -m 0644 deploy/kalender-backup.timer /etc/systemd/system/kalender-backup.timer
systemctl daemon-reload
systemctl enable --now kalender-backup.timer

echo "5/6 Nur Kalender-Backend neu starten"
systemctl restart kalender
sleep 2
systemctl is-active --quiet kalender
curl --fail --silent --show-error http://127.0.0.1:3102/health
printf '\n'

echo "6/6 Kalender und Backup-Timer prüfen"
systemctl list-timers kalender-backup.timer --no-pager
echo "FERTIG. Nginx, Zertifikate, Roomdo und Synsight wurden nicht verändert."
echo "Bitte auf Handy und PC Event-, Kalender- und Finance-Funktionen prüfen."
UPDATED=0
