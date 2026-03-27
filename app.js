/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (V7.0 - EVENT & GANGBANG UPDATE)
   ========================================================================== */

const DEFAULTS = {
    arbeitsStart: '08:00', arbeitsEnde: '22:00', wochenstart: 'MO',
    kat1_name: 'VIP', kat1_farbe: '#e5b05c',
    kat2_name: 'Stamm', kat2_farbe: '#ff2a6d',
    kat3_name: 'Neu', kat3_farbe: '#05d9e8',
    plat1: 'WhatsApp', plat2: 'Instagram', plat3: 'Telegram', plat4: 'Telefon',
    testBestand: 0
};

let currentEditId = null; 

const SUPABASE_URL = 'https://xdynlrghhnxbmcylafxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkeW5scmdoaG54Ym1jeWxhZnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcxMzgsImV4cCI6MjA4OTkyMzEzOH0.Zre-Vv5MElN3q6-R804ZrhYxnvEwhB0b3f8_ohFoe3A';

let isCloudConnected = false; 
let isSyncingFromCloud = false;
let isUploading = false;
let syncTimeout = null;

// --- 1. DER AUTO-UPLOAD ---
const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
    originalSetItem.call(localStorage, key, value);

    if (isSyncingFromCloud) return; 

    // NEU: appEvents hinzugefügt!
    if (["appTermine", "appKunden", "appEinstellungen", "appPin", "appEvents"].includes(key)) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            isUploading = true;
            const newTimestamp = new Date().toISOString() + "-" + Math.random().toString(36).substring(2, 8);
            
            const payload = {
                id: 1, 
                termine: JSON.parse(localStorage.getItem('appTermine') || '[]'),
                kunden: JSON.parse(localStorage.getItem('appKunden') || '[]'),
                einstellungen: JSON.parse(localStorage.getItem('appEinstellungen') || '{}'),
                events: JSON.parse(localStorage.getItem('appEvents') || '[]'),
                pin: localStorage.getItem('appPin') || "0000",
                last_update: newTimestamp
            };

            try {
                await fetch(`${SUPABASE_URL}/rest/v1/systemdaten?id=eq.1`, {
                    method: 'PATCH', 
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify(payload)
                });
                originalSetItem.call(localStorage, 'lastCloudUpdate', newTimestamp);
                console.log("☁️ Auto-Upload erfolgreich!");
            } catch(e) { console.error("Cloud Upload Fehler:", e); }
            finally { isUploading = false; }
        }, 300); 
    }
};

// --- 2. DER AUTO-DOWNLOAD ---
async function autoFetchCloud() {
    if (isUploading) return; 
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/systemdaten?id=eq.1&select=*`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        if (!response.ok) return;
        const data = await response.json();
        
        if(data && data.length > 0) {
            const dbData = data[0];
            const localUpdate = localStorage.getItem('lastCloudUpdate');
            
            if (!dbData.last_update || dbData.last_update === localUpdate) return;

            isSyncingFromCloud = true;
            
            if (dbData.termine) originalSetItem.call(localStorage, 'appTermine', JSON.stringify(dbData.termine));
            if (dbData.kunden) originalSetItem.call(localStorage, 'appKunden', JSON.stringify(dbData.kunden));
            if (dbData.einstellungen) originalSetItem.call(localStorage, 'appEinstellungen', JSON.stringify(dbData.einstellungen));
            if (dbData.events) originalSetItem.call(localStorage, 'appEvents', JSON.stringify(dbData.events));
            if (dbData.pin) originalSetItem.call(localStorage, 'appPin', dbData.pin);
            
            originalSetItem.call(localStorage, 'lastCloudUpdate', dbData.last_update);
            
            ladeUndWendeEinstellungenAn();
            if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
            if(typeof renderWeek === 'function') renderWeek();
            if(typeof renderKunden === 'function') renderKunden();
            if(typeof renderEvents === 'function') renderEvents();
            if(typeof calculateStats === 'function') calculateStats();
            updateLiveSystem(); 
            
            isSyncingFromCloud = false;
        }
    } catch(e) { console.log("Cloud Sync Fehler:", e); }
}

async function initCloud() {
    isCloudConnected = true;
    await autoFetchCloud();
    setInterval(autoFetchCloud, 10000); 

    const hdCountdown = document.getElementById('header-countdown');
    if(hdCountdown) {
        hdCountdown.innerText = "SUPABASE CONNECTED";
        hdCountdown.style.color = "var(--neon-green)";
        hdCountdown.style.textShadow = "0 0 10px rgba(57, 255, 20, 0.5)";
        setTimeout(() => {
            hdCountdown.innerText = "SYNCING..."; 
            hdCountdown.style.color = "";
            hdCountdown.style.textShadow = "";
            if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
            if(typeof renderWeek === 'function') renderWeek(); 
            updateLiveSystem(); 
        }, 3000);
    }
}

window.forceCloudUpload = async function() { alert("Speichert automatisch!"); };
window.forceCloudDownload = async function() { await autoFetchCloud(); };

function parseTimeStr(timeStr, defaultStr) {
    if (!timeStr || !timeStr.includes(':')) timeStr = defaultStr;
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
}

function getArbeitsZeiten(settingsObj) {
    const settings = { ...DEFAULTS, ...settingsObj };
    let startMin = parseTimeStr(settings.arbeitsStart, "08:00");
    let endeMin = parseTimeStr(settings.arbeitsEnde, "22:00");
    if (settings.arbeitsEnde === "00:00" || endeMin === 0) endeMin = 1440;
    if (endeMin <= startMin) endeMin = startMin + 60; 
    return { startMin, endeMin, gesamtArbeitsMin: endeMin - startMin };
}

function ladeUndWendeEinstellungenAn() {
    try {
        const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('appEinstellungen')) };
        const root = document.documentElement;
        root.style.setProperty('--color-kat1', s.kat1_farbe);
        root.style.setProperty('--color-kat2', s.kat2_farbe);
        root.style.setProperty('--color-kat3', s.kat3_farbe);
    } catch (e) {}
}

function updateLiveSystem() {
    const containerHeute = document.getElementById('timeline-heute');
    if (containerHeute) {
        const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('appEinstellungen')) };
        const zeiten = getArbeitsZeiten(settings);
        const jetzt = new Date();
        const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        
        let anzeigeMinuten = aktuelleMinuten;
        let feierabendText = "";
        if (aktuelleMinuten < zeiten.startMin) { anzeigeMinuten = zeiten.startMin; feierabendText = " (Vorher)"; } 
        else if (aktuelleMinuten > zeiten.endeMin) { anzeigeMinuten = zeiten.endeMin; feierabendText = " (Feierabend)"; }
        
        const prozentPosition = ((anzeigeMinuten - zeiten.startMin) / zeiten.gesamtArbeitsMin) * 100;
        let linie = document.getElementById('rote-linie');
        if (!linie) {
            linie = document.createElement('div');
            linie.id = 'rote-linie';
            linie.className = 'jetzt-linie-horizontal';
            containerHeute.appendChild(linie);
        }
        linie.innerHTML = `<div style="position: absolute; top: -26px; left: -16px; background: var(--bg-deep, #0a0a0d); color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--neon-pink, #ff2a6d); box-shadow: 0 0 10px rgba(255, 42, 109, 0.6); z-index: 50; white-space: nowrap;">${String(jetzt.getHours()).padStart(2, '0')}:${String(jetzt.getMinutes()).padStart(2, '0')}${feierabendText}</div>`;
        linie.style.left = prozentPosition + '%';
        linie.style.display = 'block';
    }

    const countdownElement = document.getElementById('header-countdown');
    if (countdownElement && countdownElement.innerText !== "SUPABASE CONNECTED") {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const events = JSON.parse(localStorage.getItem('appEvents')) || [];
        const jetztTime = new Date().getTime();
        const heuteKalenderTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

        // Kombiniere Termine und Events für den Countdown!
        let combined = [...termine, ...events.map(e => ({ ...e, isEvent: true }))];

        let zukuenftigeTermine = combined
            .filter(t => t && t.datum && t.start && typeof t.start === 'string' && t.start.includes(':'))
            .map(t => {
                const parts = t.datum.split('-'); const timeParts = t.start.split(':'); 
                return { ...t, timestamp: new Date(parts[0], parts[1]-1, parts[2], timeParts[0], timeParts[1]).getTime(), kalenderTag: new Date(parts[0], parts[1]-1, parts[2]).getTime() };
            })
            .filter(t => t.timestamp > jetztTime)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (zukuenftigeTermine.length > 0) {
            const naechster = zukuenftigeTermine[0];
            const diffTage = Math.round((naechster.kalenderTag - heuteKalenderTime) / (1000 * 60 * 60 * 24));
            let prefix = naechster.isEvent ? "🔥 EVENT IN " : "HEUTE: ";

            if (diffTage === 0) {
                const diffMs = naechster.timestamp - jetztTime;
                countdownElement.innerText = `${naechster.isEvent ? '🔥 EVENT' : 'HEUTE'}: ${Math.floor(diffMs / 3600000)}H ${Math.floor((diffMs / 60000) % 60)}M`;
            } else if (diffTage === 1) {
                countdownElement.innerText = `MORGEN ${naechster.start} UHR`;
            } else {
                countdownElement.innerText = `IN ${diffTage} TAGEN`;
            }
        } else {
            countdownElement.innerText = "KEINE TERMINE";
        }
    }
}

// --- WICHTIG: RENDERT JETZT TERMINE UND EVENTS IN DER TIMELINE! ---
function renderWeek() {
    const wochenContainer = document.querySelector('.wochen-container');
    if (!wochenContainer) return;

    const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
    const events = JSON.parse(localStorage.getItem('appEvents')) || [];
    const settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('appEinstellungen')) };

    const zeiten = getArbeitsZeiten(settings);
    document.querySelectorAll('.termin-segment').forEach(el => el.remove());

    if(zeiten.gesamtArbeitsMin <= 0) return;

    // Funktion zum Malen eines Blocks
    const drawBlock = (t, isEvent) => {
        if (!t || !t.datum || !t.start || !t.ende) return;
        const tagZeile = document.querySelector(`.tag-zeile[data-datum="${t.datum}"]`);
        if (!tagZeile) return;
        const timeline = tagZeile.querySelector('.timeline-horizontal');
        if (!timeline) return;

        let tStartMin = parseTimeStr(t.start, "00:00");
        let tEndeMin = parseTimeStr(t.ende, "23:59");
        if (t.ende === "00:00" || tEndeMin === 0) tEndeMin = 1440; 

        let anzeigeStart = tStartMin; let anzeigeEnde = tEndeMin;
        let isOutsideLeft = false; let isOutsideRight = false;

        if (tEndeMin <= zeiten.startMin) { anzeigeStart = zeiten.startMin; anzeigeEnde = zeiten.startMin + (zeiten.gesamtArbeitsMin * 0.05); isOutsideLeft = true; } 
        else if (tStartMin >= zeiten.endeMin) { anzeigeStart = zeiten.endeMin - (zeiten.gesamtArbeitsMin * 0.05); anzeigeEnde = zeiten.endeMin; isOutsideRight = true; } 
        else {
            if (anzeigeStart < zeiten.startMin) { anzeigeStart = zeiten.startMin; isOutsideLeft = true; }
            if (anzeigeEnde > zeiten.endeMin) { anzeigeEnde = zeiten.endeMin; isOutsideRight = true; }
        }

        let anzeigeDauer = Math.max(anzeigeEnde - anzeigeStart, zeiten.gesamtArbeitsMin * 0.03);
        const segment = document.createElement('div');
        
        let bgColor = isEvent ? (t.color || '#ff3300') : '';
        segment.className = `termin-segment ${!isEvent ? (t.kat || 'kat1') : ''}`;
        segment.style.left = (((anzeigeStart - zeiten.startMin) / zeiten.gesamtArbeitsMin) * 100) + '%';
        segment.style.width = Math.max((anzeigeDauer / zeiten.gesamtArbeitsMin) * 100, 0.5) + '%';
        if (isEvent) {
            segment.style.background = `linear-gradient(135deg, ${bgColor}88, ${bgColor})`;
            segment.style.border = `1px solid ${bgColor}`;
            segment.style.boxShadow = `0 0 10px ${bgColor}55`;
            // Klickbar machen, damit es direkt zum Event springt
            segment.style.cursor = 'pointer';
            segment.onclick = (e) => { e.stopPropagation(); location.href = `events.html?edit=${t.id}`; };
        }
        
        if (isOutsideLeft || isOutsideRight) segment.style.opacity = '0.5';
        
        const label = isEvent ? "🔥 " + t.name : (settings[t.kat + "_name"] || "Termin");
        
        segment.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; pointer-events: none; overflow: hidden; padding: 0 2px;">
                <span class="status-label" style="margin-bottom: 2px;">${label}</span>
                <span style="font-size: 0.6rem; font-weight: bold; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 4px; white-space: nowrap;">${t.start} - ${t.ende}</span>
            </div>
        `;
        timeline.appendChild(segment);
    };

    termine.forEach(t => drawBlock(t, false));
    events.forEach(e => drawBlock(e, true));
}

document.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem('authKey')) { window.location.href = 'index.html'; return; }
    ladeUndWendeEinstellungenAn();
    if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
    renderWeek(); updateLiveSystem();
    initCloud();
    
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 500); }
    }, 600); 
});
