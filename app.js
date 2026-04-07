/* ==========================================================================
   AGENDA 2050 - ULTIMATIVE ZENTRALE ENGINE (V6.20 - VOLLSTÄNDIG & KORREKT)
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

function generiereWochenAnsicht() {
    const container = document.querySelector('.wochen-container');
    if (!container) return; 

    const urlParams = new URLSearchParams(window.location.search);
    let startDatum = new Date();
    if (urlParams.get('d')) startDatum = new Date(urlParams.get('d'));

    let tag = startDatum.getDay();
    let diff = startDatum.getDate() - tag + (tag === 0 ? -6 : 1);
    let montag = new Date(startDatum.setDate(diff));

    const wochentage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const heute = new Date();
    const heuteISO = new Date(heute.getTime() - (heute.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const storedSettings = JSON.parse(localStorage.getItem('appEinstellungen')) || {};
    const settings = { ...DEFAULTS, ...storedSettings }; 
    
    const zeiten = getArbeitsZeiten(settings);
    const startMin = zeiten.startMin;
    const endeMin = zeiten.endeMin;
    
    const viertel = zeiten.gesamtArbeitsMin / 4;
    const q1Min = Math.floor(startMin + viertel);
    const midMin = Math.floor(startMin + viertel * 2);
    const q3Min = Math.floor(startMin + viertel * 3);
    
    const timeStr = (m) => {
        let h = Math.floor(m / 60);
        let min = m % 60;
        if (h === 24) return `00:${String(min).padStart(2, '0')}`;
        return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    };
    
    const skalaHTML = `<span>${settings.arbeitsStart}</span><span>${timeStr(q1Min)}</span><span>${timeStr(midMin)}</span><span>${timeStr(q3Min)}</span><span>${settings.arbeitsEnde}</span>`;

    container.innerHTML = ''; 

    for (let i = 0; i < 7; i++) {
        let aktuellesDatum = new Date(montag);
        aktuellesDatum.setDate(montag.getDate() + i);
        
        let isoDatum = new Date(aktuellesDatum.getTime() - (aktuellesDatum.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        let tagZahl = String(aktuellesDatum.getDate()).padStart(2, '0');
        let monatZahl = String(aktuellesDatum.getMonth() + 1).padStart(2, '0');
        
        let isHeute = (isoDatum === heuteISO) ? 'heute' : '';
        let timelineId = (isoDatum === heuteISO) ? 'id="timeline-heute"' : '';

        if (i === 0 && document.getElementById('header-monat')) {
            const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            const cloudDot = isCloudConnected ? ' <span id="cloud-dot-indicator" style="color: var(--neon-green); font-size: 0.6em; vertical-align: super; text-shadow: 0 0 10px var(--neon-green);" title="Cloud Sync Aktiv">●</span>' : '';
            document.getElementById('header-monat').innerHTML = `${monate[aktuellesDatum.getMonth()]} ${aktuellesDatum.getFullYear()}${cloudDot}`;
        }

        container.innerHTML += `
            <div class="tag-zeile ${isHeute}" data-datum="${isoDatum}" style="cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;" onclick="window.location.href='tag.html?d=${isoDatum}'">
                <div class="tag-header"><span class="tag-name">${wochentage[i]} <small>${tagZahl}.${monatZahl}.</small></span></div>
                <div class="timeline-horizontal" ${timelineId} style="background-image: repeating-linear-gradient(to right, transparent, transparent 24.8%, rgba(255,255,255,0.06) 25%); overflow: visible;"></div>
                <div class="timeline-skala">${skalaHTML}</div>
            </div>
        `;
    }
}

function openModal(editId = null) {
    const modal = document.getElementById('terminModal');
    if (!modal) return;

    currentEditId = editId;

    const storedSettings = JSON.parse(localStorage.getItem('appEinstellungen')) || {};
    const settings = { ...DEFAULTS, ...storedSettings };
    
    const catDropdown = document.getElementById('terminKategorie');
    if (catDropdown) {
        catDropdown.innerHTML = `
            <option value="kat1">${settings.kat1_name}</option>
            <option value="kat2">${settings.kat2_name}</option>
            <option value="kat3">${settings.kat3_name}</option>
        `;
    }

    const platDropdown = document.getElementById('terminPlattform');
    if (platDropdown) {
        platDropdown.innerHTML = `
            <option value="none">Keine Plattform</option>
            <option value="${settings.plat1}">${settings.plat1}</option>
            <option value="${settings.plat2}">${settings.plat2}</option>
            <option value="${settings.plat3}">${settings.plat3}</option>
            <option value="${settings.plat4}">${settings.plat4}</option>
        `;
    }

    if (editId) {
        const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
        const kunden = JSON.parse(localStorage.getItem('appKunden')) || [];
        const t = termine.find(x => x.id === editId);
        
        if (t) {
            let liveKunde = null;
            if (t.kunde_id) {
                liveKunde = kunden.find(k => k.id == t.kunde_id);
            }
            if (!liveKunde) {
                liveKunde = kunden.find(k => k.name.toLowerCase().trim() === (t.name || '').toLowerCase().trim());
            }

            if(document.getElementById('terminKundeId')) {
                document.getElementById('terminKundeId').value = liveKunde ? liveKunde.id : '';
            }

            document.getElementById('terminName').value = t.name || '';
            document.getElementById('terminDatum').value = t.datum || '';
            document.getElementById('terminStart').value = t.start || '';
            document.getElementById('terminEnde').value = t.ende || '';
            document.getElementById('terminKategorie').value = t.kat || 'kat1';
            
            document.getElementById('terminPlattform').value = (liveKunde && liveKunde.plattform) ? liveKunde.plattform : (t.plattform || 'none');
            document.getElementById('terminKontakt').value = (liveKunde && liveKunde.kontakt) ? liveKunde.kontakt : (t.kontakt || '');
            
            document.getElementById('terminNotizen').value = t.notizen || '';
            
            if(document.getElementById('terminPreis')) {
                document.getElementById('terminPreis').value = (liveKunde && liveKunde.preis) ? liveKunde.preis : (t.preis || '');
            }
            if(document.getElementById('terminPraeferenz')) {
                document.getElementById('terminPraeferenz').value = (liveKunde && liveKunde.praeferenz) ? liveKunde.praeferenz : (t.praeferenz || 'none');
            }
        }
    } else {
        if(document.getElementById('terminKundeId')) document.getElementById('terminKundeId').value = '';
        document.getElementById('terminName').value = '';
        document.getElementById('terminKontakt').value = '';
        document.getElementById('terminNotizen').value = '';
        document.getElementById('terminStart').value = '';
        document.getElementById('terminEnde').value = '';
        
        if(document.getElementById('terminPreis')) document.getElementById('terminPreis').value = '';
        if(document.getElementById('terminPraeferenz')) document.getElementById('terminPraeferenz').value = 'none';
    }

    const kontaktContainer = document.getElementById('kontaktContainer');
    if (kontaktContainer) {
        const pValue = document.getElementById('terminPlattform').value;
        kontaktContainer.style.display = (pValue !== 'none') ? 'block' : 'none';
    }

    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('terminModal');
    if (modal) modal.style.display = 'none';
    const vBox = document.getElementById('kundenVorschlaege');
    if (vBox) vBox.style.display = 'none';
    currentEditId = null;
}

function toggleKontaktFeld() {
    const platSelect = document.getElementById('terminPlattform');
    const container = document.getElementById('kontaktContainer');
    if (platSelect && container) {
        container.style.display = (platSelect.value !== 'none') ? 'block' : 'none';
    }
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

function renderWeek() {
    const wochenContainer = document.querySelector('.wochen-container');
    if (!wochenContainer) return;

    const termine = JSON.parse(localStorage.getItem('appTermine')) || [];
    const events = JSON.parse(localStorage.getItem('appEvents')) || [];
    const sperrzeiten = JSON.parse(localStorage.getItem('appSperrzeiten')) || []; 
    const storedSettings = JSON.parse(localStorage.getItem('appEinstellungen')) || {};
    const settings = { ...DEFAULTS, ...storedSettings };

    const zeiten = getArbeitsZeiten(settings);
    const startMin = zeiten.startMin;
    const endeMin = zeiten.endeMin;
    const gesamtArbeitsMin = zeiten.gesamtArbeitsMin;

    document.querySelectorAll('.termin-segment').forEach(el => el.remove());

    if(gesamtArbeitsMin <= 0) return;

    const formatiertEvents = events.map(e => ({
        ...e,
        isEvent: true,
        start: e.start || "00:00",
        ende: e.ende || "23:59",
        kat: 'event'
    }));
    
    const formatiertSperrzeiten = [];
    sperrzeiten.forEach(s => {
        let aktDatum = new Date(s.startDatum);
        const endDatum = new Date(s.endDatum);
        
        while (aktDatum <= endDatum) {
            const isoDatum = aktDatum.toISOString().split('T')[0];
            let drawStart = s.startZeit;
            let drawEnd = s.endZeit;
            
            if (isoDatum !== s.startDatum) drawStart = "00:00";
            if (isoDatum !== s.endDatum) drawEnd = "23:59";
            
            formatiertSperrzeiten.push({
                isSperre: true,
                id: s.id,
                name: s.name,
                datum: isoDatum,
                start: drawStart,
                ende: drawEnd
            });
            
            aktDatum.setDate(aktDatum.getDate() + 1);
        }
    });

    const combinedItems = [...termine, ...formatiertEvents, ...formatiertSperrzeiten];

    combinedItems.forEach(t => {
        if (!t || !t.datum || !t.start || !t.ende || !t.start.includes(':') || !t.ende.includes(':')) return;

        const tagZeile = document.querySelector(`.tag-zeile[data-datum="${t.datum}"]`);
        if (tagZeile) {
            const timeline = tagZeile.querySelector('.timeline-horizontal');
            if (timeline) {
                try {
                    let tStartMin = parseTimeStr(t.start, "00:00");
                    let tEndeMin = parseTimeStr(t.ende, "23:59");
                    if (t.ende === "00:00" || tEndeMin === 0) tEndeMin = 1440; 

                    let anzeigeStart = tStartMin;
                    let anzeigeEnde = tEndeMin;
                    let isOutsideLeft = false;
                    let isOutsideRight = false;

                    if (tEndeMin <= startMin) {
                        anzeigeStart = startMin;
                        anzeigeEnde = startMin + (gesamtArbeitsMin * 0.05); 
                        isOutsideLeft = true;
                    } else if (tStartMin >= endeMin) {
                        anzeigeStart = endeMin - (gesamtArbeitsMin * 0.05);
                        anzeigeEnde = endeMin;
                        isOutsideRight = true;
                    } else {
                        if (anzeigeStart < startMin) { anzeigeStart = startMin; isOutsideLeft = true; }
                        if (anzeigeEnde > endeMin) { anzeigeEnde = endeMin; isOutsideRight = true; }
                    }

                    let anzeigeDauer = anzeigeEnde - anzeigeStart;
                    if (anzeigeDauer < (gesamtArbeitsMin * 0.03)) anzeigeDauer = gesamtArbeitsMin * 0.03;

                    const linksPosition = ((anzeigeStart - startMin) / gesamtArbeitsMin) * 100;
                    const breite = (anzeigeDauer / gesamtArbeitsMin) * 100;

                    const segment = document.createElement('div');
                    
                    let timeText = `${t.start} - ${t.ende}`;
                    if(isOutsideLeft) timeText = `<< ${timeText}`;
                    if(isOutsideRight) timeText = `${timeText} >>`;

                    if (t.isSperre) {
                        segment.className = `termin-segment`;
                        segment.style.background = `repeating-linear-gradient(45deg, rgba(255, 51, 0, 0.2), rgba(255, 51, 0, 0.2) 10px, rgba(0, 0, 0, 0.4) 10px, rgba(0, 0, 0, 0.4) 20px)`;
                        segment.style.border = `1px dashed #ff3300`;
                        segment.style.zIndex = "4"; 
                        
                        segment.innerHTML = `
                            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; overflow: hidden; padding: 0 2px;">
                                <span class="status-label" style="margin-bottom: 2px; color: #ff3300; font-weight: bold; font-size:0.6rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; width: 100%; text-align: center;">⛔ ${t.name}</span>
                            </div>
                        `;
                        segment.onclick = (e) => {
                            e.stopPropagation();
                            window.location.href = 'einstellungen.html';
                        };
                        segment.style.pointerEvents = 'auto'; 
                    }
                    else if (t.isEvent) {
                        const f = t.color || '#ff3300';
                        segment.className = `termin-segment`;
                        segment.style.background = `linear-gradient(90deg, rgba(255,51,0,0.6) 0%, rgba(10,0,0,0.8) 100%)`;
                        segment.style.borderLeft = `3px solid ${f}`;
                        segment.style.boxShadow = `0 0 8px ${f}`;
                        segment.style.zIndex = "5"; 
                        
                        segment.innerHTML = `
                            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; overflow: hidden; padding: 0 2px;">
                                <span class="status-label" style="margin-bottom: 2px; color: #fff; font-weight: bold; font-size:0.6rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; width: 100%; text-align: center;">🔥 ${t.name}</span>
                                <span style="font-size: 0.5rem; font-weight: bold; background: rgba(0,0,0,0.6); padding: 1px 4px; border-radius: 4px; white-space: nowrap;">${timeText}</span>
                            </div>
                        `;
                        segment.onclick = (e) => {
                            e.stopPropagation();
                            window.location.href = 'events.html';
                        };
                        segment.style.pointerEvents = 'auto'; 
                    } else {
                        const safeKat = t.kat || 'kat1';
                        segment.className = `termin-segment ${safeKat}`;
                        const katName = settings[safeKat + "_name"] || "Termin";
                        const displayName = t.name ? t.name : 'Unbekannt';
                        
                        segment.innerHTML = `
                            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; pointer-events: none; overflow: hidden; padding: 0 2px;">
                                <span class="status-label" style="margin-bottom: 2px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-width: 100%;">${displayName} <span style="opacity:0.7; font-size:0.8em;">(${katName})</span></span>
                                <span style="font-size: 0.6rem; font-weight: bold; background: rgba(0,0,0,0.3); padding: 1px 4px; border-radius: 4px; white-space: nowrap;">${timeText}</span>
                            </div>
                        `;
                    }

                    segment.style.left = linksPosition + '%';
                    segment.style.width = (breite < 0.5 ? 0.5 : breite) + '%';
                    
                    if (isOutsideLeft || isOutsideRight) {
                        segment.style.opacity = '0.5';
                    }
                    
                    timeline.appendChild(segment);
                } catch (e) {
                    console.error("Fehler beim Malen des Blocks:", e);
                }
            }
        }
    });
}

// ============================================================================
// INITIALISIERUNG BEIM LADEN DER SEITE
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!sessionStorage.getItem('authKey')) {
        window.location.href = 'index.html';
        return; 
    }

    ladeUndWendeEinstellungenAn();
    if(typeof generiereWochenAnsicht === 'function') generiereWochenAnsicht(); 
    if(typeof renderWeek === 'function') renderWeek();             
    if(typeof updateLiveSystem === 'function') updateLiveSystem();
    
    initCloud();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
            reg.update();
        }).catch(err => console.log('SW Fehler:', err));
    }

    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }

        const heuteZeile = document.querySelector('.tag-zeile.heute');
        if (heuteZeile) {
            heuteZeile.scrollIntoView({ behavior: 'smooth', block: 'center' });
            heuteZeile.style.transition = "background-color 0.8s ease-out";
            heuteZeile.style.backgroundColor = "rgba(5, 217, 232, 0.15)";
            setTimeout(() => {
                heuteZeile.style.backgroundColor = "transparent";
            }, 1200);
        }
    }, 600); 
});
