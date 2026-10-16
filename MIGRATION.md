# Vollständige Migration aus alter Browser-/Supabase-Version

ACHTUNG: GitHub enthält nur den Quellcode, keine laufenden Kundendaten.
Die bisherige Version verwendete localStorage und die Supabase-Tabelle systemdaten.

1. Öffne die BISHERIGE Kalenderadresse im Browser, auf dem alle aktuellen Daten sichtbar sind.
2. Kontrolliere, ob die aktuellen Termine/Kunden angezeigt werden und das letzte
   Cloud-Sync erfolgreich war. Erstelle zuerst auch ein Backup der Supabase-Datenbank.
3. Öffne im bisherigen Kalender die Browser-Entwicklerkonsole und führe
   ausschließlich dort (nicht in fremden Websites!) den folgenden Export aus:

    const keys = {termine:'appTermine',kunden:'appKunden',
      einstellungen:'appEinstellungen',events:'appEvents',sperrzeiten:'appSperrzeiten'};
    const data = {};
    for (const [k,v] of Object.entries(keys)) {
      data[k] = JSON.parse(localStorage.getItem(v) || (k==='einstellungen'?'{}':'[]'));
    }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='kalender-vollbackup.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);

4. Die JSON-Datei an einem sicheren Ort aufbewahren; sie enthält personenbezogene Daten.
5. Nach Aufsetzen der neuen Domain einloggen > Einstellungen > Import. Auf der neuen
   Domain keine neuen Einträge erstellen, bevor das Backup erfolgreich importiert wurde.
6. Zahlen / Termine / Events / Sperrzeiten auf beiden Versionen vergleichen und
   testweise Änderung, Abmeldung/Anmeldung, weiteres Gerät und Backup-Restore prüfen.
7. Erst danach die alte Supabase-Synchronisierung deaktivieren und ihre
   Tabellen-/RLS-Regeln sichern bzw. schließen. Das alte Anon-Token war öffentlich.

Wichtig: Die alte Export-Funktion in Einstellungen enthielt keine "events".
Darum ist der obige Voll-Export für eine vollständige Migration vorzuziehen.
