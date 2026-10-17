/* Agenda 2050 – Erinnerungen ohne schwebende Glocke.
   Die Bedienelemente befinden sich ausschließlich unter SYSTEM.
   In-App-Erinnerungen funktionieren nur solange eine Kalenderseite geöffnet ist. */
(function () {
    'use strict';

    const KEY = 'kalender-webmeldungen';
    const seenKey = 'kalender-webmeldungen-gesehen';
    const validLeads = [5, 15, 30, 60, 120];
    let pref = {active: true, lead: 30, browser: false};

    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            pref.active = saved.active !== false;
            if (validLeads.includes(Number(saved.lead))) pref.lead = Number(saved.lead);
            pref.browser = saved.browser === true;
        }
    } catch (error) {
        // Damaged optional preferences must never disrupt appointments.
    }

    const seen = new Set();
    try {
        const values = JSON.parse(localStorage.getItem(seenKey) || '[]');
        if (Array.isArray(values)) values.forEach(value => {
            if (typeof value === 'string') seen.add(value);
        });
    } catch (error) {
        // Do not stop the app if an old dismissed-reminder list is corrupt.
    }

    function savePrefs() {
        try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (error) {}
    }

    function read(key) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    function upcoming() {
        if (!pref.active) return [];
        const now = Date.now();
        const appointments = read('appTermine').map(item => ({...item, kind: 'Termin'}));
        const events = read('appEvents').map(item => ({...item, kind: 'Event'}));

        return appointments.concat(events).map(item => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.datum || '')) ||
                !/^\d{1,2}:\d{2}$/.test(String(item.start || ''))) return null;
            const date = new Date(item.datum + 'T' + String(item.start).padStart(5, '0') + ':00');
            const when = date.getTime();
            return Number.isFinite(when) ? {...item, when} : null;
        }).filter(item => item && item.when >= now && item.when - now <= pref.lead * 60000)
          .sort((a, b) => a.when - b.when);
    }

    function toast(message) {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;bottom:96px;left:12px;right:12px;' +
            'z-index:1000;pointer-events:none;margin:auto;max-width:420px;' +
            'background:#101824;color:#fff;border:1px solid #05d9e8;' +
            'padding:12px 16px;border-radius:10px;box-shadow:0 7px 28px #000a;' +
            'font:14px system-ui,sans-serif';
        el.textContent = message;
        document.body.append(el);
        setTimeout(() => el.remove(), 6500);
    }
    window.webmeldung = toast;

    function refreshList() {
        const list = document.getElementById('reminderUpcoming');
        if (!list) return;
        list.replaceChildren();

        if (!pref.active) {
            list.textContent = 'Erinnerungen sind ausgeschaltet.';
            return;
        }
        const entries = upcoming();
        if (!entries.length) {
            list.textContent = 'Keine bald anstehenden Termine oder Events.';
            return;
        }
        entries.slice(0, 35).forEach(item => {
            const row = document.createElement('div');
            row.style.cssText = 'padding:9px 0;border-bottom:1px solid #35404c';
            row.textContent = item.kind + ': ' + (item.name || 'Ohne Name') +
                ' · ' + item.datum + ' · ' + item.start + ' Uhr';
            list.append(row);
        });
    }

    function supportedNotifications() {
        return 'Notification' in window && typeof Notification.requestPermission === 'function';
    }

    function refreshPermissionUI() {
        const button = document.getElementById('reminderPermissionBtn');
        const info = document.getElementById('reminderPermissionInfo');
        const status = document.getElementById('reminderPermissionStatus');
        if (!button || !info || !status) return;

        // Show a real action button only while permission can be requested.
        // An allowed, blocked or unsupported state is INFORMATION, not a huge button.
        button.hidden = true;
        button.disabled = true;
        status.dataset.state = 'unavailable';

        if (!supportedNotifications()) {
            status.textContent = 'ⓘ Systemmitteilungen nicht verfügbar';
            info.textContent = 'Hier sind nur Erinnerungen in der geöffneten Kalender-App möglich. ' +
                'Auf dem iPhone lassen sich Systemmitteilungen gegebenenfalls über eine zum Home-Bildschirm hinzugefügte App aktivieren.';
        } else if (Notification.permission === 'granted') {
            status.dataset.state = 'allowed';
            status.textContent = '✓ Systemmitteilungen erlaubt';
            info.textContent = 'Die Berechtigung ist erteilt. Erinnerungen werden derzeit trotzdem nur zugestellt, ' +
                'solange der Kalender geöffnet ist. Hintergrund-Push ist noch nicht eingerichtet.';
        } else if (Notification.permission === 'denied') {
            status.dataset.state = 'blocked';
            status.textContent = 'ⓘ Systemmitteilungen blockiert';
            info.textContent = 'Mitteilungen kannst du in den Geräte- bzw. Browsereinstellungen erlauben. ' +
                'Erinnerungen im geöffneten Kalender funktionieren weiterhin.';
        } else {
            status.dataset.state = 'available';
            status.textContent = 'Mitteilungen noch nicht aktiviert';
            info.textContent = 'Optional: Systemmitteilungen auf diesem Gerät erlauben. ' +
                'Dauerhafte Hintergrundmeldungen benötigen später einen Push-Dienst.';
            button.hidden = false;
            button.disabled = false;
        }
    }

    function initSettings() {
        const enabled = document.getElementById('reminderEnabled');
        const lead = document.getElementById('reminderLead');
        const request = document.getElementById('reminderPermissionBtn');
        if (!enabled || !lead || !request) return;

        enabled.checked = pref.active;
        lead.value = String(pref.lead);
        lead.disabled = !pref.active;

        enabled.addEventListener('change', () => {
            pref.active = enabled.checked;
            lead.disabled = !pref.active;
            savePrefs();
            refreshList();
        });
        lead.addEventListener('change', () => {
            const number = Number(lead.value);
            if (!validLeads.includes(number)) return;
            pref.lead = number;
            savePrefs();
            refreshList();
        });
        request.addEventListener('click', async () => {
            if (!supportedNotifications()) return;
            try {
                const permission = await Notification.requestPermission();
                pref.browser = permission === 'granted';
                savePrefs();
                refreshPermissionUI();
            } catch (error) {
                const info = document.getElementById('reminderPermissionInfo');
                if (info) info.textContent = 'Die Mitteilungsfreigabe ist hier nicht möglich.';
            }
        });
        refreshPermissionUI();
        refreshList();
    }

    function notify() {
        const entries = upcoming();
        entries.slice(0, 35).forEach(item => {
            const key = [item.kind, item.id || item.name, item.datum, item.start].join(':');
            if (seen.has(key)) return;
            seen.add(key);
            try { localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-300))); }
            catch (error) {}
            toast(item.kind + ' beginnt bald um ' + item.start + ' Uhr');
            if (pref.browser && supportedNotifications() && Notification.permission === 'granted') {
                try {
                    new Notification('Kalender-Erinnerung', {
                        body: 'Ein ' + item.kind + ' beginnt um ' + item.start + ' Uhr.',
                        tag: 'kalender-' + key,
                        icon: '/icon-192.png'
                    });
                } catch (error) {}
            }
        });
        refreshList();
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSettings();
        // No fixed-position bell or popover. The rest of the app stays unobstructed.
        setTimeout(notify, 2000);
        setInterval(notify, 60000);
        window.addEventListener('storage', event => {
            if (event.key === KEY) {
                try {
                    const next = JSON.parse(event.newValue || '{}');
                    if (next && typeof next === 'object') {
                        pref.active = next.active !== false;
                        if (validLeads.includes(Number(next.lead))) pref.lead = Number(next.lead);
                        pref.browser = next.browser === true;
                    }
                } catch (error) {}
                const enabled = document.getElementById('reminderEnabled');
                const lead = document.getElementById('reminderLead');
                if (enabled) enabled.checked = pref.active;
                if (lead) {
                    lead.value = String(pref.lead);
                    lead.disabled = !pref.active;
                }
            }
            if (event.key === 'appTermine' || event.key === 'appEvents' || event.key === KEY) {
                refreshList();
            }
        });
    });
})();
