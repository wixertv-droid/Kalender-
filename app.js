/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (V6.18 - SMART SAVE)
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

/* ==========================================================================
   >>> SUPABASE ANBINDUNG <<<
   ========================================================================== */
const SUPABASE_URL = 'https://xdynlrghhnxbmcylafxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkeW5scmdoaG54Ym1jeWxhZnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcxMzgsImV4cCI6MjA4OTkyMzEzOH0.Zre-Vv5MElN3q6-R804ZrhYxnvEwhB0b3f8_ohFoe3A';

let isCloudConnected = false; 
let isSyncingFromCloud = false;
let isUploading = false;
let syncTimeout = null;

const originalSetItem = localStorage.setItem;

localStorage.setItem = function(key, value) {
    originalSetItem.call(localStorage, key, value);

    if (isSyncingFromCloud) return; 

    if (["appTermine", "appKunden", "appEinstellungen", "appPin", "appEvents", "appSperrzeiten"].includes(key)) {
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            isUploading = true;
            const newTimestamp = new Date().toISOString() + "-" + Math.random().toString(36).substring(2, 8);
            
            const payload = {
                id: 1, 
                termine: JSON.parse(localStorage.getItem('appTermine') || '[]'),
                kunden: JSON.parse(localStorage.getItem('appKunden') || '[]'),
                einstellungen: JSON.parse(localStorage.getItem('appEinstellungen') || '{}'),
                pin: localStorage.getItem('appPin') || "0000",
                events: JSON.parse(localStorage.getItem('appEvents') || '[]'), 
                sperrzeiten: JSON.parse(localStorage.getItem('appSperrzeiten') || '[]'),
                last_update: newTimestamp
            };

            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/systemdaten?id=eq.1`, {
                    method: 'PATCH', 
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) { return; }
                originalSetItem.call(localStorage, 'lastCloudUpdate', newTimestamp);
            } catch(e) {}
            finally {
                isUploading = false;
            }
        }, 500); 
    }
};

async function autoFetchCloud() {
    if (isUploading) return; 
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/systemdaten?id=eq.1&select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Cache-Control': 'no-cache'
            },
            cache: 'no-store'
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
            if (dbData.pin) originalSetItem.call(localStorage, 'appPin', dbData.pin);
            if (dbData.events) originalSetItem.call(localStorage, 'appEvents', JSON.stringify(dbData.events)); 
            if (dbData.sperrzeiten) originalSetItem.call(localStorage, 'appSperrzeiten', JSON.stringify(dbData.sperrzeiten)); 
            
            originalSetItem.call(localStorage, 'lastCloudUpdate', dbData.last_update);
            
            ladeUndWendeEinstellungenAn();
            if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
            if(typeof renderWeek === 'function') renderWeek();
            if(typeof renderKunden === 'function') renderKunden();
            if(typeof calculateStats === 'function') calculateStats();
            if(typeof renderEvents === 'function') renderEvents(); 
            if(typeof renderTimeline === 'function') {
                const urlParams = new URLSearchParams(window.location.search);
                renderTimeline(urlParams.get('d') || new Date().toISOString().split('T')[0], false);
            }
            updateLiveSystem(); 
            isSyncingFromCloud = false;
        }
    } catch(e) {}
}

async function initCloud() {
    isCloudConnected = true;
    await autoFetchCloud();
    setInterval(autoFetchCloud, 5000); 

    const hdCountdown = document.getElementById('header-countdown');
    if(hdCountdown) {
        hdCountdown.innerText = "SUPABASE CONNECTED";
        hdCountdown.style.color = "var(--neon-green)";
        hdCountdown.style.borderColor = "var(--neon-green)";
        hdCountdown.style.textShadow = "0 0 10px rgba(57, 255, 20, 0.5)";
        
        setTimeout(() => {
            hdCountdown.innerText = "SYNCING..."; 
            hdCountdown.style.color = "";
            hdCountdown.style.borderColor = "";
            hdCountdown.style.textShadow = "";
            if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
            if(typeof renderWeek === 'function') renderWeek(); 
            updateLiveSystem(); 
        }, 3000);
    }
}

window.forceCloudUpload = async function() { alert("System speichert alles sofort!"); };
window.forceCloudDownload = async function() { alert("Manueller Sync gestartet..."); await autoFetchCloud(); }

function parseTimeStr(timeStr, defaultStr) {
    if (!timeStr || !timeStr.includes(':')) timeStr = defaultStr;
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = parseInt(defaultStr.split(':')[0], 10);
    if (isNaN(m)) m = parseInt(defaultStr.split(':')[1], 10);
    return h * 60 + m;
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
        const storedSettings = JSON.parse(localStorage.getItem('appEinstellungen')) || {};
        const settings = { ...DEFAULTS, ...storedSettings };

        const root = document.documentElement;
        root.style.setProperty('--color-kat1', settings.kat1_farbe);
        root.style.setProperty('--color-kat2', settings.kat2_farbe);
        root.style.setProperty('--color-kat3', settings.kat3_farbe);
    } catch (e) {}
}

// --- INTELLIGENTER SAVE ---
function saveAppointment() {
    try {
        const name = document.getElementById('terminName').value;
        const datum = document.getElementById('terminDatum').value;
        const start = document.getElementById('terminStart').value;
        const ende = document.getElementById('terminEnde').value;
        let kat = document.getElementById('terminKategorie').value;
        let plattform = document.getElementById('terminPlattform').value;
        let kontakt = document.getElementById('terminKontakt').value;
        const notizen = document.getElementById('terminNotizen').value;
        
        const kundeIdInput = document.getElementById('terminKundeId');
        const kundeIdStr = kundeIdInput ? kundeIdInput.value : '';
        
        const preisInput = document.getElementById('terminPreis');
        const praefInput = document.getElementById('terminPraeferenz');
        let preis = preisInput ? preisInput.value : '';
        let praeferenz = praefInput ? praefInput.value : 'none';

        if (!name || !datum || !start || !ende) {
            alert("Bitte alle Pflichtfelder ausfüllen.");
            return;
        }

        let nStartMin = parseTimeStr(start, "00:00");
        let nEndeMin = parseTimeStr(ende, "23:59");
        if (ende === "00:00" || nEndeMin === 0) nEndeMin = 1440; 
        
        // 1. SPERRZEITEN-CHECK
        let sperrzeiten = JSON.parse(localStorage.getItem('appSperrzeiten')) || [];
        const apptDate = new Date(datum);
        
        const sperrOverlap = sperrzeiten.find(s => {
            let sStartD = new Date(s.startDatum);
            let sEndD = new Date(s.endDatum);
            
            if (apptDate >= sStartD && apptDate <= sEndD) {
                let sStartMin = (datum === s.startDatum) ? parseTimeStr(s.startZeit, "00:00") : 0;
                let sEndMin = (datum === s.endDatum) ? parseTimeStr(s.endZeit, "23:59") : 1440;
                if (s.endZeit === "00:00" || sEndMin === 0) sEndMin = 1440;
                return (nStartMin < sEndMin && nEndeMin > sStartMin);
            }
            return false;
        });

        if (sperrOverlap) {
            alert(`⛔ SPERRZEIT BLOCKIERT DEN TERMIN!\n\nDieser Zeitraum ist durch "${sperrOverlap.name}" blockiert.\nBitte wähle eine andere Zeit.`);
            return; 
        }

        // 2. TERMIN DOPPELBUCHUNG-CHECK
        let termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const overlap = termine.find(t => {
            if (t.datum === datum && t.id !== currentEditId) {
                let eStartMin = parseTimeStr(t.start, "00:00");
                let eEndeMin = parseTimeStr(t.ende, "23:59");
                if (t.ende === "00:00" || eEndeMin === 0) eEndeMin = 1440; 
                return (nStartMin < eEndeMin && nEndeMin > eStartMin);
            }
            return false;
        });

        if (overlap) {
            alert(`⚠️ DOPPELBUCHUNG VERHINDERT!\n\nDu hast zur selben Zeit bereits den Termin "${overlap.name}" (${overlap.start} - ${overlap.ende} Uhr).\nBitte ändere die Zeit.`);
            return; 
        }

        // 3. KUNDEN AUTO-FILL LOGIK
        let kunden = JSON.parse(localStorage.getItem('appKunden')) || [];
        let kundeGefunden = null;

        if (kundeIdStr) {
            kundeGefunden = kunden.find(k => k.id == parseInt(kundeIdStr));
        }

        if (!kundeGefunden) {
            kundeGefunden = kunden.find(k => k.name.toLowerCase().trim() === name.toLowerCase().trim());
        }

        let finalKundeId;

        if (!kundeGefunden) {
            finalKundeId = Date.now() + 1;
            const neuerKunde = {
                id: finalKundeId, 
                name: name.trim(),
                plattform: plattform !== 'none' ? plattform : '',
                kontakt: kontakt.trim(),
                preis: preis,
                praeferenz: praeferenz,
                link: '', status: kat, 
                notizen: 'Automatisch durch Termin erstellt.',
                bild1: '', bild2: ''
            };
            kunden.push(neuerKunde);
            localStorage.setItem('appKunden', JSON.stringify(kunden));
        } else {
            finalKundeId = kundeGefunden.id;
            
            // Wenn Name eingetippt (aber nicht in Vorschlagsliste geklickt) wurde -> Daten laden
            if (!kundeIdStr) {
                if (kundeGefunden.status && kundeGefunden.status !== 'none') kat = kundeGefunden.status;
                if (!preis && kundeGefunden.preis) preis = kundeGefunden.preis;
                if (praeferenz === 'none' && kundeGefunden.praeferenz) praeferenz = kundeGefunden.praeferenz;
                if (plattform === 'none' && kundeGefunden.plattform) plattform = kundeGefunden.plattform;
                if (!kontakt && kundeGefunden.kontakt) kontakt = kundeGefunden.kontakt;
            }
        }

        if (currentEditId) {
            const index = termine.findIndex(t => t.id === currentEditId);
            if(index > -1) {
                termine[index].kunde_id = finalKundeId; 
                termine[index].name = name.trim();
                termine[index].datum = datum;
                termine[index].start = start;
                termine[index].ende = ende;
                termine[index].kat = kat;
                termine[index].plattform = plattform;
                termine[index].kontakt = kontakt;
                termine[index].notizen = notizen;
                termine[index].preis = preis;
                termine[index].praeferenz = praeferenz;
            }
            currentEditId = null; 
        } else {
            const neuerTermin = {
                id: Date.now(),
                kunde_id: finalKundeId, 
                name: name.trim(),
                datum: datum,
                start: start,
                ende: ende,
                kat: kat,
                plattform: plattform,
                kontakt: kontakt,
                notizen: notizen,
                preis: preis,
                praeferenz: praeferenz
            };
            termine.push(neuerTermin);
        }

        localStorage.setItem('appTermine', JSON.stringify(termine));
        
        if(typeof closeModal === 'function') closeModal();
        if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht();
        if(typeof renderWeek === 'function') renderWeek();
        
        if(typeof renderTimeline === 'function') {
            const urlParams = new URLSearchParams(window.location.search);
            let d = urlParams.get('d');
            if(!d) {
                const heute = new Date();
                d = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            }
            renderTimeline(d, false);
        }

        if(typeof updateLiveSystem === 'function') updateLiveSystem();
        
    } catch (e) { console.error("Fehler beim Speichern:", e); }
}

function updateLiveSystem() {
    const containerHeute = document.getElementById('timeline-heute');
    if (containerHeute) {
        const storedSettings = JSON.parse(localStorage.getItem('appEinstellungen')) || {};
        const settings = { ...DEFAULTS, ...storedSettings };
        
        const zeiten = getArbeitsZeiten(settings);
        const startMin = zeiten.startMin;
        const endeMin = zeiten.endeMin;
        const gesamtArbeitsMin = zeiten.gesamtArbeitsMin;

        const jetzt = new Date();
        const aktuelleMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
        
        const hStr = String(jetzt.getHours()).padStart(2, '0');
        const mStr = String(jetzt.getMinutes()).padStart(2, '0');
        const uhrzeit = `${hStr}:${mStr}`;
        
        let linie = document.getElementById('rote-linie');
        
        let anzeigeMinuten = aktuelleMinuten;
        let feierabendText = "";
        
        if (aktuelleMinuten < startMin) {
            anzeigeMinuten = startMin;
            feierabendText = " (Vorher)";
        } else if (aktuelleMinuten > endeMin) {
            anzeigeMinuten = endeMin;
            feierabendText = " (Feierabend)";
        }
        
        const prozentPosition = ((anzeigeMinuten - startMin) / gesamtArbeitsMin) * 100;
        
        if (!linie) {
            linie = document.createElement('div');
            linie.id = 'rote-linie';
            linie.className = 'jetzt-linie-horizontal';
            containerHeute.appendChild(linie);
        }
        
        linie.innerHTML = `<div style="position: absolute; top: -26px; left: -16px; background: var(--bg-deep, #0a0a0d); color: white; font-size: 0.75rem; font-weight: bold; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--neon-pink, #ff2a6d); box-shadow: 0 0 10px rgba(255, 42, 109, 0.6); z-index: 50; white-space: nowrap;">${uhrzeit}${feierabendText}</div>`;
        linie.style.left = prozentPosition + '%';
        linie.style.display = 'block';
        
        if (feierabendText !== "") {
            linie.style.opacity = '0.6';
        } else {
            linie.style.opacity = '1';
        }
    }

    const countdownElement = document.getElementById('header-countdown');
    if (countdownElement && countdownElement.innerText !== "SUPABASE CONNECTED") {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const jetzt = new Date();
        const jetztTime = jetzt.getTime();
        
        const heuteKalenderTime = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();

        let zukuenftigeTermine = termine
            .filter(t => t && t.datum && t.start && typeof t.start === 'string' && t.start.includes(':'))
            .map(t => {
                const parts = t.datum.split('-'); 
                const timeParts = t.start.split(':'); 
                
                const tDate = new Date(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1]);
                const kalenderTag = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
                
                return { ...t, timestamp: tDate.getTime(), kalenderTag: kalenderTag };
            })
            .filter(t => t.timestamp > jetztTime)
            .sort((a, b) => a.timestamp - b.timestamp);

        if (zukuenftigeTermine.length > 0) {
            const naechster = zukuenftigeTermine[0];
            const diffTage = Math.round((naechster.kalenderTag - heuteKalenderTime) / (1000 * 60 * 60 * 24));

            if (diffTage === 0) {
                const diffMs = naechster.timestamp - jetztTime;
                const diffStunden = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinuten = Math.floor((diffMs / 1000 / 60) % 60);
                countdownElement.innerText = `HEUTE: ${diffStunden > 0 ? diffStunden + 'H ' : ''}${diffMinuten}M`;
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

document.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem('authKey')) {
        return; 
    }
    initCloud();
});
